import { cookies } from "next/headers";
import { verifySessionToken, SessionPayload } from "./crypto";
import { getDb } from "./db";

export const SESSION_COOKIE_NAME = "gudang_session";

export async function getSessionUser(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = verifySessionToken(token);
    if (!payload) return null;

    // Verify user is still active in DB
    const db = getDb();
    const user = db
      .prepare("SELECT id, name, email, role, is_active, must_change_password FROM users WHERE id = ?")
      .get(payload.userId) as
      | {
          id: number;
          name: string;
          email: string;
          role: "ADMIN" | "KEPALA_GUDANG" | "PETUGAS";
          is_active: number;
          must_change_password: number;
        }
      | undefined;

    if (!user || !user.is_active) return null;

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: Boolean(user.must_change_password),
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function canSeePrices(role: string): boolean {
  return role === "ADMIN" || role === "KEPALA_GUDANG";
}

export function canManageMasters(role: string): boolean {
  return role === "ADMIN" || role === "KEPALA_GUDANG";
}

export function canManagePO(role: string): boolean {
  return role === "ADMIN" || role === "KEPALA_GUDANG";
}

export function canVoidOrAdjust(role: string): boolean {
  return role === "ADMIN" || role === "KEPALA_GUDANG";
}

export function isAdmin(role: string): boolean {
  return role === "ADMIN";
}

export function validateTransactionDate(
  dateStr: string,
  role: "ADMIN" | "KEPALA_GUDANG" | "PETUGAS"
): { valid: boolean; error?: string } {
  const db = getDb();
  const today = new Date();
  const todayYmd = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  if (dateStr > todayYmd) {
    return {
      valid: false,
      error: `BR-08: Tanggal transaksi (${dateStr}) tidak boleh di masa depan (Hari ini: ${todayYmd}).`,
    };
  }

  const settingKey = role === "PETUGAS" ? "max_backdate_petugas" : "max_backdate_manager";
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(settingKey) as
    | { value: string }
    | undefined;
  const maxDays = row ? parseInt(row.value, 10) : role === "PETUGAS" ? 2 : 30;

  const txDate = new Date(dateStr + "T00:00:00");
  const curDate = new Date(todayYmd + "T00:00:00");
  const diffDays = Math.floor((curDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays > maxDays) {
    return {
      valid: false,
      error: `BR-08: Tanggal transaksi mundur (${diffDays} hari) melebihi batas maksimal untuk role ${role} (${maxDays} hari).`,
    };
  }

  return { valid: true };
}

