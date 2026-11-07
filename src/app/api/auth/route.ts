import { NextRequest, NextResponse } from "next/server";
import { getDb, writeAuditLog } from "@/lib/db";
import { createSessionToken, hashPassword, verifyPassword } from "@/lib/crypto";
import { getSessionUser, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
  const db = getDb();
  const settingsRows = db.prepare("SELECT key, value FROM settings").all() as Array<{
    key: string;
    value: string;
  }>;
  const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));

  return NextResponse.json({
    authenticated: true,
    user,
    settings,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const db = getDb();
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

    if (action === "login") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (!email || !password) {
        return NextResponse.json(
          { error: "Email dan password wajib diisi." },
          { status: 400 }
        );
      }

      const user = db
        .prepare("SELECT * FROM users WHERE lower(email) = ?")
        .get(email) as
        | {
            id: number;
            name: string;
            email: string;
            password_hash: string;
            role: "ADMIN" | "KEPALA_GUDANG" | "PETUGAS";
            is_active: number;
            must_change_password: number;
            failed_login_count: number;
            locked_until: string | null;
          }
        | undefined;

      // FR-01: Pesan error login tidak membocorkan apakah email terdaftar
      if (!user || !user.is_active) {
        writeAuditLog(db, {
          userId: user?.id ?? null,
          userName: email,
          action: "LOGIN_FAILED",
          entityType: "AUTH",
          newValues: { reason: user ? "Account inactive" : "Unknown email" },
          ipAddress: ip,
        });
        return NextResponse.json(
          { error: "Email atau password tidak valid." },
          { status: 401 }
        );
      }

      // Check lockout (FR-01 & NFR-04: 15 menit setelah 5 kali gagal)
      if (user.locked_until) {
        const lockTime = new Date(user.locked_until).getTime();
        if (Date.now() < lockTime) {
          const remainingMin = Math.ceil((lockTime - Date.now()) / 60000);
          return NextResponse.json(
            {
              error: `FR-01/NFR-04: Akun terkunci sementara karena 5x gagal login. Coba lagi dalam ${remainingMin} menit.`,
            },
            { status: 423 }
          );
        }
      }

      const isValid = verifyPassword(password, user.password_hash);
      if (!isValid) {
        const newCount = (user.failed_login_count || 0) + 1;
        let lockedUntil: string | null = null;
        if (newCount >= 5) {
          lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }
        db.prepare(
          "UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(newCount, lockedUntil, user.id);

        writeAuditLog(db, {
          userId: user.id,
          userName: user.name,
          action: newCount >= 5 ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
          entityType: "AUTH",
          entityId: user.id,
          newValues: { failed_login_count: newCount, locked_until: lockedUntil },
          ipAddress: ip,
        });

        if (newCount >= 5) {
          return NextResponse.json(
            {
              error:
                "FR-01/NFR-04: Akun dikunci selama 15 menit karena 5 kali gagal login berturut-turut.",
            },
            { status: 423 }
          );
        }

        return NextResponse.json(
          { error: "Email atau password tidak valid." },
          { status: 401 }
        );
      }

      // Reset failed_login_count on success
      db.prepare(
        "UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = datetime('now') WHERE id = ?"
      ).run(user.id);

      writeAuditLog(db, {
        userId: user.id,
        userName: user.name,
        action: "LOGIN_SUCCESS",
        entityType: "AUTH",
        entityId: user.id,
        ipAddress: ip,
      });

      const token = createSessionToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: Boolean(user.must_change_password),
      });

      const res = NextResponse.json({
        success: true,
        user: {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: Boolean(user.must_change_password),
        },
      });

      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 12 * 3600,
      });

      return res;
    }

    if (action === "logout") {
      const session = await getSessionUser();
      if (session) {
        writeAuditLog(db, {
          userId: session.userId,
          userName: session.name,
          action: "LOGOUT",
          entityType: "AUTH",
          entityId: session.userId,
          ipAddress: ip,
        });
      }
      const res = NextResponse.json({ success: true });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    if (action === "change_password") {
      const session = await getSessionUser();
      if (!session) {
        return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
      }
      const { oldPassword, newPassword } = body;
      if (!oldPassword || !newPassword) {
        return NextResponse.json(
          { error: "Password lama dan password baru wajib diisi." },
          { status: 400 }
        );
      }
      if (String(newPassword).length < 10) {
        return NextResponse.json(
          { error: "FR-01: Password baru minimal harus 10 karakter." },
          { status: 400 }
        );
      }
      if (String(newPassword).toLowerCase() === session.email.toLowerCase()) {
        return NextResponse.json(
          { error: "FR-01: Password tidak boleh sama dengan alamat email." },
          { status: 400 }
        );
      }

      const dbUser = db
        .prepare("SELECT password_hash FROM users WHERE id = ?")
        .get(session.userId) as { password_hash: string } | undefined;

      if (!dbUser || !verifyPassword(oldPassword, dbUser.password_hash)) {
        return NextResponse.json(
          { error: "Password lama yang dimasukkan salah." },
          { status: 400 }
        );
      }

      const newHash = hashPassword(newPassword);
      db.prepare(
        "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?"
      ).run(newHash, session.userId);

      writeAuditLog(db, {
        userId: session.userId,
        userName: session.name,
        action: "PASSWORD_CHANGE",
        entityType: "USER",
        entityId: session.userId,
        ipAddress: ip,
      });

      const updatedToken = createSessionToken({
        ...session,
        mustChangePassword: false,
      });
      const res = NextResponse.json({
        success: true,
        message: "Password berhasil diperbarui.",
      });
      res.cookies.set(SESSION_COOKIE_NAME, updatedToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 12 * 3600,
      });
      return res;
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

