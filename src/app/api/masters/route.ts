import { NextRequest, NextResponse } from "next/server";
import { getDb, writeAuditLog } from "@/lib/db";
import {
  canManageMasters,
  canSeePrices,
  getSessionUser,
  isAdmin,
} from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const showPrices = canSeePrices(session.role);

  const rawItems = db
    .prepare(
      `SELECT
        i.*,
        c.name as category_name,
        c.code_prefix as category_prefix,
        u.name as unit_name,
        pu.name as purchase_unit_name,
        pi.sku as parent_sku,
        (SELECT COUNT(*) FROM transaction_details td WHERE td.item_id = i.id) as tx_count,
        (SELECT COUNT(*) FROM purchase_order_items poi
         JOIN purchase_orders po ON po.id = poi.purchase_order_id
         WHERE poi.item_id = i.id AND po.status IN ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED')) as open_po_count
      FROM items i
      JOIN categories c ON c.id = i.category_id
      JOIN units u ON u.id = i.unit_id
      LEFT JOIN units pu ON pu.id = i.purchase_unit_id
      LEFT JOIN items pi ON pi.id = i.parent_item_id
      ORDER BY i.is_active DESC, i.sku ASC`
    )
    .all() as Array<Record<string, unknown>>;

  const nowMs = Date.now();
  const items = rawItems.map((item) => {
    // BR-004: Auto-Archive SKU Sisa Nilai Nol selama > 30 hari
    let isAutoArchived = false;
    if (item.is_remnant && Number(item.current_stock) === 0 && item.zero_stock_since) {
      const zeroMs = new Date(String(item.zero_stock_since)).getTime();
      if (!isNaN(zeroMs) && nowMs - zeroMs > 30 * 24 * 3600 * 1000) {
        isAutoArchived = true;
      }
    }

    return {
      ...item,
      avg_cost: showPrices ? Number(item.avg_cost) : null,
      last_purchase_cost: showPrices ? Number(item.last_purchase_cost) : null,
      has_transactions: Number(item.tx_count) > 0,
      has_open_po: Number(item.open_po_count) > 0,
      is_auto_archived: isAutoArchived,
    };
  });

  const categories = db
    .prepare("SELECT * FROM categories ORDER BY id ASC")
    .all();
  const units = db.prepare("SELECT * FROM units ORDER BY id ASC").all();
  const suppliers = db
    .prepare("SELECT * FROM suppliers ORDER BY is_active DESC, code ASC")
    .all();

  const users = isAdmin(session.role)
    ? db
        .prepare(
          "SELECT id, name, email, role, is_active, must_change_password, failed_login_count, locked_until, last_login_at, created_at FROM users ORDER BY id ASC"
        )
        .all()
    : [];

  const settings = db.prepare("SELECT * FROM settings ORDER BY key ASC").all();

  return NextResponse.json({
    items,
    categories,
    units,
    suppliers,
    users,
    settings,
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;
    const db = getDb();
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

    // Check role for master data management
    if (
      [
        "create_item",
        "update_item",
        "toggle_item_active",
        "create_category",
        "update_category",
        "create_unit",
        "update_unit",
        "create_supplier",
        "update_supplier",
      ].includes(action) &&
      !canManageMasters(session.role)
    ) {
      return NextResponse.json(
        { error: "BR-15: Role Anda tidak memiliki hak akses untuk mengubah Data Master." },
        { status: 403 }
      );
    }

    if (action === "create_item") {
      const sku = String(body.sku || "").trim().toUpperCase();
      const name = String(body.name || "").trim();
      const categoryId = Number(body.category_id);
      const unitId = Number(body.unit_id);
      const purchaseUnitId = body.purchase_unit_id ? Number(body.purchase_unit_id) : unitId;
      const conversionFactor = Number(body.conversion_factor || 1);
      const minStock = Number(body.min_stock || 0);
      const allowDecimal = body.allow_decimal ? 1 : 0;
      const paperType = body.paper_type ? String(body.paper_type).trim() : null;
      const grammage = body.grammage ? Number(body.grammage) : null;
      const lengthCm = body.length_cm ? Number(body.length_cm) : null;
      const widthCm = body.width_cm ? Number(body.width_cm) : null;
      const inkColor = body.ink_color ? String(body.ink_color).trim() : null;
      const isRemnant = body.is_remnant ? 1 : 0;
      const parentItemId = body.parent_item_id ? Number(body.parent_item_id) : null;
      const notes = body.notes ? String(body.notes).trim() : null;

      if (!sku || !name || !categoryId || !unitId) {
        return NextResponse.json(
          { error: "SKU, Nama Barang, Kategori, dan Satuan Dasar wajib diisi." },
          { status: 400 }
        );
      }

      if (conversionFactor <= 0) {
        return NextResponse.json(
          { error: "Faktor konversi satuan beli harus lebih dari 0." },
          { status: 400 }
        );
      }

      // BR-10: SKU unik (case-insensitive)
      const exists = db
        .prepare("SELECT id FROM items WHERE lower(sku) = lower(?)")
        .get(sku);
      if (exists) {
        return NextResponse.json(
          { error: `BR-10: Kode SKU '${sku}' sudah digunakan oleh barang lain.` },
          { status: 400 }
        );
      }

      const res = db
        .prepare(
          `INSERT INTO items (
            sku, name, category_id, unit_id, purchase_unit_id, conversion_factor,
            current_stock, avg_cost, last_purchase_cost, min_stock, allow_decimal,
            paper_type, grammage, length_cm, width_cm, ink_color, is_remnant, parent_item_id, notes
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          sku,
          name,
          categoryId,
          unitId,
          purchaseUnitId,
          conversionFactor,
          minStock,
          allowDecimal,
          paperType,
          grammage,
          lengthCm,
          widthCm,
          inkColor,
          isRemnant,
          parentItemId,
          notes
        );

      writeAuditLog(db, {
        userId: session.userId,
        userName: session.name,
        action: "MASTER_ITEM_CREATE",
        entityType: "ITEM",
        entityId: sku,
        newValues: { sku, name, categoryId, unitId, purchaseUnitId, conversionFactor, minStock },
        ipAddress: ip,
      });

      return NextResponse.json({
        success: true,
        id: Number(res.lastInsertRowid),
        message: `Barang ${sku} - ${name} berhasil ditambahkan (Stok awal: 0).`,
      });
    }

    if (action === "update_item") {
      const id = Number(body.id);
      const oldItem = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as
        | Record<string, unknown>
        | undefined;
      if (!oldItem) {
        return NextResponse.json({ error: "Barang tidak ditemukan." }, { status: 404 });
      }

      const txCount = (
        db
          .prepare("SELECT COUNT(*) as cnt FROM transaction_details WHERE item_id = ?")
          .get(id) as { cnt: number }
      ).cnt;

      const newSku = String(body.sku || oldItem.sku).trim().toUpperCase();
      const newUnitId = Number(body.unit_id || oldItem.unit_id);

      // BR-10: SKU dan satuan dasar terkunci setelah barang punya transaksi
      if (txCount > 0) {
        if (newSku.toLowerCase() !== String(oldItem.sku).toLowerCase()) {
          return NextResponse.json(
            {
              error:
                "BR-10: Kode SKU terkunci dan tidak dapat diubah karena barang sudah memiliki riwayat transaksi.",
            },
            { status: 400 }
          );
        }
        if (newUnitId !== Number(oldItem.unit_id)) {
          return NextResponse.json(
            {
              error:
                "BR-10: Satuan dasar terkunci dan tidak dapat diubah karena barang sudah memiliki riwayat transaksi.",
            },
            { status: 400 }
          );
        }
      } else {
        const dup = db
          .prepare("SELECT id FROM items WHERE lower(sku) = lower(?) AND id != ?")
          .get(newSku, id);
        if (dup) {
          return NextResponse.json(
            { error: `BR-10: Kode SKU '${newSku}' sudah digunakan.` },
            { status: 400 }
          );
        }
      }

      const name = String(body.name || "").trim();
      const categoryId = Number(body.category_id);
      const purchaseUnitId = body.purchase_unit_id ? Number(body.purchase_unit_id) : newUnitId;
      const conversionFactor = Number(body.conversion_factor || 1);
      const minStock = Number(body.min_stock || 0);
      const allowDecimal = body.allow_decimal ? 1 : 0;
      const paperType = body.paper_type ? String(body.paper_type).trim() : null;
      const grammage = body.grammage ? Number(body.grammage) : null;
      const lengthCm = body.length_cm ? Number(body.length_cm) : null;
      const widthCm = body.width_cm ? Number(body.width_cm) : null;
      const inkColor = body.ink_color ? String(body.ink_color).trim() : null;
      const notes = body.notes ? String(body.notes).trim() : null;

      db.prepare(
        `UPDATE items SET
          sku = ?, name = ?, category_id = ?, unit_id = ?, purchase_unit_id = ?,
          conversion_factor = ?, min_stock = ?, allow_decimal = ?,
          paper_type = ?, grammage = ?, length_cm = ?, width_cm = ?, ink_color = ?,
          notes = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        newSku,
        name,
        categoryId,
        newUnitId,
        purchaseUnitId,
        conversionFactor,
        minStock,
        allowDecimal,
        paperType,
        grammage,
        lengthCm,
        widthCm,
        inkColor,
        notes,
        id
      );

      writeAuditLog(db, {
        userId: session.userId,
        userName: session.name,
        action: "MASTER_ITEM_UPDATE",
        entityType: "ITEM",
        entityId: newSku,
        oldValues: oldItem,
        newValues: { sku: newSku, name, categoryId, newUnitId, conversionFactor, minStock },
        ipAddress: ip,
      });

      return NextResponse.json({
        success: true,
        message: `Master barang ${newSku} berhasil diperbarui.`,
      });
    }

    if (action === "toggle_item_active") {
      const id = Number(body.id);
      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as
        | { id: number; sku: string; name: string; current_stock: number; is_active: number }
        | undefined;
      if (!item) {
        return NextResponse.json({ error: "Barang tidak ditemukan." }, { status: 404 });
      }

      const nextActive = item.is_active ? 0 : 1;
      if (nextActive === 0) {
        // BR-09: Barang hanya bisa dinonaktifkan jika stok 0 dan tidak ada PO terbuka
        if (Number(item.current_stock) > 0) {
          return NextResponse.json(
            {
              error: `BR-09: Barang '${item.sku}' tidak dapat dinonaktifkan karena masih memiliki saldo stok (${item.current_stock}).`,
            },
            { status: 400 }
          );
        }
        const openPo = (
          db
            .prepare(
              `SELECT COUNT(*) as cnt FROM purchase_order_items poi
               JOIN purchase_orders po ON po.id = poi.purchase_order_id
               WHERE poi.item_id = ? AND po.status IN ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED')`
            )
            .get(id) as { cnt: number }
        ).cnt;
        if (openPo > 0) {
          return NextResponse.json(
            {
              error: `BR-09: Barang '${item.sku}' tidak dapat dinonaktifkan karena masih ada ${openPo} PO terbuka.`,
            },
            { status: 400 }
          );
        }
      }

      db.prepare("UPDATE items SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(
        nextActive,
        id
      );

      writeAuditLog(db, {
        userId: session.userId,
        userName: session.name,
        action: nextActive ? "MASTER_ITEM_ACTIVATE" : "MASTER_ITEM_DEACTIVATE",
        entityType: "ITEM",
        entityId: item.sku,
        oldValues: { is_active: Boolean(item.is_active) },
        newValues: { is_active: Boolean(nextActive) },
        ipAddress: ip,
      });

      return NextResponse.json({
        success: true,
        message: `Barang ${item.sku} berhasil ${nextActive ? "diaktifkan" : "dinonaktifkan"}.`,
      });
    }

    if (action === "create_category" || action === "update_category") {
      const name = String(body.name || "").trim();
      const codePrefix = String(body.code_prefix || "ITM").trim().toUpperCase();
      if (!name) {
        return NextResponse.json({ error: "Nama kategori wajib diisi." }, { status: 400 });
      }
      if (action === "create_category") {
        const dup = db.prepare("SELECT id FROM categories WHERE lower(name) = lower(?)").get(name);
        if (dup) {
          return NextResponse.json({ error: "Nama kategori sudah ada." }, { status: 400 });
        }
        db.prepare("INSERT INTO categories (name, code_prefix) VALUES (?, ?)").run(name, codePrefix);
      } else {
        const id = Number(body.id);
        const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;
        db.prepare("UPDATE categories SET name = ?, code_prefix = ?, is_active = ? WHERE id = ?").run(
          name,
          codePrefix,
          isActive,
          id
        );
      }
      return NextResponse.json({ success: true, message: "Data kategori berhasil disimpan." });
    }

    if (action === "create_unit" || action === "update_unit") {
      const name = String(body.name || "").trim();
      if (!name) {
        return NextResponse.json({ error: "Nama satuan wajib diisi." }, { status: 400 });
      }
      if (action === "create_unit") {
        const dup = db.prepare("SELECT id FROM units WHERE lower(name) = lower(?)").get(name);
        if (dup) {
          return NextResponse.json({ error: "Nama satuan sudah ada." }, { status: 400 });
        }
        db.prepare("INSERT INTO units (name) VALUES (?)").run(name);
      } else {
        const id = Number(body.id);
        const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;
        db.prepare("UPDATE units SET name = ?, is_active = ? WHERE id = ?").run(name, isActive, id);
      }
      return NextResponse.json({ success: true, message: "Data satuan berhasil disimpan." });
    }

    if (action === "create_supplier" || action === "update_supplier") {
      const name = String(body.name || "").trim();
      const contactName = body.contact_name ? String(body.contact_name).trim() : null;
      const phone = body.phone ? String(body.phone).trim() : null;
      const email = body.email ? String(body.email).trim() : null;
      const address = body.address ? String(body.address).trim() : null;
      const paymentTerms = body.payment_terms ? String(body.payment_terms).trim() : "NET 30 Hari";

      if (!name) {
        return NextResponse.json({ error: "Nama supplier wajib diisi." }, { status: 400 });
      }

      if (action === "create_supplier") {
        const count = (db.prepare("SELECT COUNT(*) as cnt FROM suppliers").get() as { cnt: number }).cnt;
        const code = `SUP-${String(count + 1).padStart(4, "0")}`;
        db.prepare(
          `INSERT INTO suppliers (code, name, contact_name, phone, email, address, payment_terms)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(code, name, contactName, phone, email, address, paymentTerms);

        writeAuditLog(db, {
          userId: session.userId,
          userName: session.name,
          action: "SUPPLIER_CREATE",
          entityType: "SUPPLIER",
          entityId: code,
          newValues: { code, name, contactName, phone, paymentTerms },
          ipAddress: ip,
        });
      } else {
        const id = Number(body.id);
        const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;
        db.prepare(
          `UPDATE suppliers SET
            name = ?, contact_name = ?, phone = ?, email = ?, address = ?, payment_terms = ?,
            is_active = ?, updated_at = datetime('now')
           WHERE id = ?`
        ).run(name, contactName, phone, email, address, paymentTerms, isActive, id);

        writeAuditLog(db, {
          userId: session.userId,
          userName: session.name,
          action: "SUPPLIER_UPDATE",
          entityType: "SUPPLIER",
          entityId: id,
          newValues: { name, contactName, phone, isActive },
          ipAddress: ip,
        });
      }
      return NextResponse.json({ success: true, message: "Data supplier berhasil disimpan." });
    }

    // FR-11: Impor CSV Master Barang dengan laporan error per baris
    if (action === "import_csv") {
      if (!isAdmin(session.role)) {
        return NextResponse.json(
          { error: "FR-11: Hanya Admin yang dapat melakukan impor CSV data awal." },
          { status: 403 }
        );
      }

      const rows = (body.rows || []) as Array<{
        sku?: string;
        name?: string;
        category?: string;
        unit?: string;
        purchase_unit?: string;
        conversion_factor?: number | string;
        min_stock?: number | string;
        allow_decimal?: boolean | string;
      }>;

      const validInserted: string[] = [];
      const rowErrors: Array<{ row: number; sku: string; error: string }> = [];

      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];
        const rowNum = idx + 1;
        const sku = String(r.sku || "").trim().toUpperCase();
        const name = String(r.name || "").trim();
        const catName = String(r.category || "").trim();
        const unitName = String(r.unit || "").trim();
        const purchaseUnitName = String(r.purchase_unit || unitName).trim();
        const conv = Number(r.conversion_factor || 1);
        const minStock = Number(r.min_stock || 0);
        const allowDec =
          r.allow_decimal === true ||
          String(r.allow_decimal).toLowerCase() === "true" ||
          String(r.allow_decimal) === "1"
            ? 1
            : 0;

        if (!sku || !name || !catName || !unitName) {
          rowErrors.push({
            row: rowNum,
            sku: sku || "(Kosong)",
            error: "Kolom SKU, Nama, Kategori, dan Satuan wajib diisi.",
          });
          continue;
        }

        const existing = db.prepare("SELECT id FROM items WHERE lower(sku) = lower(?)").get(sku);
        if (existing) {
          rowErrors.push({
            row: rowNum,
            sku,
            error: `SKU '${sku}' sudah terdaftar di database.`,
          });
          continue;
        }

        let cat = db
          .prepare("SELECT id FROM categories WHERE lower(name) = lower(?)")
          .get(catName) as { id: number } | undefined;
        if (!cat) {
          const res = db
            .prepare("INSERT INTO categories (name, code_prefix) VALUES (?, ?)")
            .run(catName, catName.slice(0, 3).toUpperCase());
          cat = { id: Number(res.lastInsertRowid) };
        }

        let unit = db
          .prepare("SELECT id FROM units WHERE lower(name) = lower(?)")
          .get(unitName) as { id: number } | undefined;
        if (!unit) {
          const res = db.prepare("INSERT INTO units (name) VALUES (?)").run(unitName);
          unit = { id: Number(res.lastInsertRowid) };
        }

        let pUnit = db
          .prepare("SELECT id FROM units WHERE lower(name) = lower(?)")
          .get(purchaseUnitName) as { id: number } | undefined;
        if (!pUnit) {
          pUnit = unit;
        }

        db.prepare(
          `INSERT INTO items (
            sku, name, category_id, unit_id, purchase_unit_id, conversion_factor,
            current_stock, avg_cost, last_purchase_cost, min_stock, allow_decimal
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`
        ).run(sku, name, cat.id, unit.id, pUnit.id, conv > 0 ? conv : 1, minStock >= 0 ? minStock : 0, allowDec);

        validInserted.push(sku);
      }

      writeAuditLog(db, {
        userId: session.userId,
        userName: session.name,
        action: "CSV_IMPORT_ITEMS",
        entityType: "ITEM",
        newValues: { insertedCount: validInserted.length, errorCount: rowErrors.length, validInserted },
        ipAddress: ip,
      });

      return NextResponse.json({
        success: true,
        insertedCount: validInserted.length,
        errorCount: rowErrors.length,
        insertedSkus: validInserted,
        errors: rowErrors,
      });
    }

    // FR-02: Manajemen User (Admin Only)
    if (["create_user", "update_user", "reset_user_password"].includes(action)) {
      if (!isAdmin(session.role)) {
        return NextResponse.json(
          { error: "FR-02: Hanya Admin yang dapat mengelola akun pengguna." },
          { status: 403 }
        );
      }

      if (action === "create_user") {
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const role = String(body.role || "PETUGAS");
        const tempPassword = String(body.password || "GudangBaru123!");

        if (!name || !email || tempPassword.length < 10) {
          return NextResponse.json(
            { error: "Nama, email, dan password sementara (min. 10 karakter) wajib diisi." },
            { status: 400 }
          );
        }

        const dup = db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email);
        if (dup) {
          return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 400 });
        }

        const res = db
          .prepare(
            `INSERT INTO users (name, email, password_hash, role, is_active, must_change_password)
             VALUES (?, ?, ?, ?, 1, 1)`
          )
          .run(name, email, hashPassword(tempPassword), role);

        writeAuditLog(db, {
          userId: session.userId,
          userName: session.name,
          action: "USER_CREATE",
          entityType: "USER",
          entityId: Number(res.lastInsertRowid),
          newValues: { name, email, role, must_change_password: true },
          ipAddress: ip,
        });

        return NextResponse.json({
          success: true,
          message: `User ${name} (${role}) berhasil dibuat dengan password sementara.`,
        });
      }

      if (action === "update_user") {
        const targetId = Number(body.id);
        const targetUser = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as
          | { id: number; name: string; role: string; is_active: number }
          | undefined;
        if (!targetUser) {
          return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
        }

        const newRole = String(body.role || targetUser.role);
        const newActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : targetUser.is_active;
        const newName = String(body.name || targetUser.name).trim();

        // FR-02: Sistem menolak menonaktifkan atau menurunkan role Admin terakhir yang aktif
        if (targetUser.role === "ADMIN" && (newRole !== "ADMIN" || newActive === 0)) {
          const activeAdmins = (
            db
              .prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'ADMIN' AND is_active = 1 AND id != ?")
              .get(targetId) as { cnt: number }
          ).cnt;
          if (activeAdmins === 0) {
            return NextResponse.json(
              {
                error:
                  "FR-02: Sistem menolak menonaktifkan atau menurunkan role Admin terakhir yang aktif.",
              },
              { status: 400 }
            );
          }
        }

        db.prepare(
          "UPDATE users SET name = ?, role = ?, is_active = ?, locked_until = NULL, failed_login_count = 0, updated_at = datetime('now') WHERE id = ?"
        ).run(newName, newRole, newActive, targetId);

        writeAuditLog(db, {
          userId: session.userId,
          userName: session.name,
          action: "USER_UPDATE",
          entityType: "USER",
          entityId: targetId,
          oldValues: { name: targetUser.name, role: targetUser.role, is_active: targetUser.is_active },
          newValues: { name: newName, role: newRole, is_active: newActive },
          ipAddress: ip,
        });

        return NextResponse.json({
          success: true,
          message: `Data user ${newName} berhasil diperbarui.`,
        });
      }

      if (action === "reset_user_password") {
        const targetId = Number(body.id);
        const tempPassword = String(body.temp_password || "ResetGudang123!");
        if (tempPassword.length < 10) {
          return NextResponse.json(
            { error: "Password sementara minimal 10 karakter." },
            { status: 400 }
          );
        }

        db.prepare(
          "UPDATE users SET password_hash = ?, must_change_password = 1, failed_login_count = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?"
        ).run(hashPassword(tempPassword), targetId);

        writeAuditLog(db, {
          userId: session.userId,
          userName: session.name,
          action: "USER_PASSWORD_RESET",
          entityType: "USER",
          entityId: targetId,
          ipAddress: ip,
        });

        return NextResponse.json({
          success: true,
          message: "Password sementara berhasil diatur. User wajib mengganti password saat login.",
        });
      }
    }

    if (action === "update_settings") {
      if (!isAdmin(session.role)) {
        return NextResponse.json({ error: "Hanya Admin yang dapat mengubah pengaturan." }, { status: 403 });
      }
      const updates = body.settings as Record<string, string>;
      for (const [k, v] of Object.entries(updates)) {
        db.prepare(
          "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
        ).run(k, String(v));
      }
      writeAuditLog(db, {
        userId: session.userId,
        userName: session.name,
        action: "SETTINGS_UPDATE",
        entityType: "SETTINGS",
        newValues: updates,
        ipAddress: ip,
      });
      return NextResponse.json({ success: true, message: "Pengaturan sistem berhasil disimpan." });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

