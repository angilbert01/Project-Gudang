import { NextRequest, NextResponse } from "next/server";
import { generateDocNumber, getDb, writeAuditLog } from "@/lib/db";
import { canVoidOrAdjust, getSessionUser } from "@/lib/auth";
import crypto from "node:crypto";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  const sessions = db
    .prepare(
      `SELECT
        sc.*,
        c.name as category_name,
        u1.name as started_by_name,
        u2.name as approved_by_name,
        t.transaction_number as adjustment_transaction_number
      FROM stock_counts sc
      LEFT JOIN categories c ON c.id = sc.category_id
      JOIN users u1 ON u1.id = sc.started_by
      LEFT JOIN users u2 ON u2.id = sc.approved_by
      LEFT JOIN transactions t ON t.id = sc.adjustment_transaction_id
      ORDER BY sc.id DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const itemsStmt = db.prepare(
    `SELECT
      sci.*,
      i.sku,
      i.name as item_name,
      i.current_stock as live_current_stock,
      i.avg_cost,
      u.name as unit_name,
      c.name as category_name
     FROM stock_count_items sci
     JOIN items i ON i.id = sci.item_id
     JOIN units u ON u.id = i.unit_id
     JOIN categories c ON c.id = i.category_id
     WHERE sci.stock_count_id = ?
     ORDER BY i.sku ASC`
  );

  // Hitung mutasi yang terjadi setelah snapshot_at (Mekanisme Non-Blocking PRD v1.0 Bagian 3.4)
  const mutasiStmt = db.prepare(
    `SELECT
      COALESCE(SUM(CASE WHEN td.qty_delta > 0 THEN td.qty_delta ELSE 0 END), 0) as mutasi_masuk,
      COALESCE(SUM(CASE WHEN td.qty_delta < 0 THEN ABS(td.qty_delta) ELSE 0 END), 0) as mutasi_keluar
     FROM transaction_details td
     JOIN transactions t ON t.id = td.transaction_id
     WHERE td.item_id = ?
       AND (t.created_at > ? OR t.transaction_date > substr(?, 1, 10))
       AND (? IS NULL OR t.id != ?)`
  );

  const enrichedSessions = sessions.map((sc) => {
    const rawItems = itemsStmt.all(Number(sc.id)) as Array<Record<string, unknown>>;
    const snapshotAt = String(sc.snapshot_at);
    const adjTxId = sc.adjustment_transaction_id ? Number(sc.adjustment_transaction_id) : null;

    const items = rawItems.map((it) => {
      const mut = mutasiStmt.get(
        Number(it.item_id),
        snapshotAt,
        snapshotAt,
        adjTxId,
        adjTxId
      ) as { mutasi_masuk: number; mutasi_keluar: number };

      const snapshotQty = Number(it.system_qty_snapshot);
      const mutasiMasuk = Number(mut.mutasi_masuk || 0);
      const mutasiKeluar = Number(mut.mutasi_keluar || 0);
      const expectedSystemStock = Number(
        (snapshotQty + mutasiMasuk - mutasiKeluar).toFixed(3)
      );

      const countedQty =
        it.counted_qty !== null && it.counted_qty !== undefined
          ? Number(it.counted_qty)
          : null;

      // Rumus PRD v1.0 (3.4): Selisih = HasilFisik - (SnapshotBalance + MutasiMasukSetelahSnapshot - MutasiKeluarSetelahSnapshot)
      const difference =
        countedQty !== null
          ? Number((countedQty - expectedSystemStock).toFixed(3))
          : null;

      return {
        ...it,
        mutasi_masuk_after: mutasiMasuk,
        mutasi_keluar_after: mutasiKeluar,
        expected_system_stock: expectedSystemStock,
        counted_qty: countedQty,
        difference,
      };
    });

    return {
      ...sc,
      items,
    };
  });

  return NextResponse.json({ stock_counts: enrichedSessions });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create_session") {
      if (!canVoidOrAdjust(session.role)) {
        return NextResponse.json(
          { error: "BR-15: Hanya Admin atau Kepala Gudang yang dapat membuka sesi Stock Opname." },
          { status: 403 }
        );
      }

      const title = String(body.title || "Sesi Stock Opname Berkala").trim();
      const categoryId = body.category_id ? Number(body.category_id) : null;
      const notes = body.notes ? String(body.notes).trim() : null;
      const todayYmd = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);

      const itemsToSnapshot = (
        categoryId
          ? db
              .prepare("SELECT id, current_stock FROM items WHERE is_active = 1 AND category_id = ?")
              .all(categoryId)
          : db.prepare("SELECT id, current_stock FROM items WHERE is_active = 1").all()
      ) as Array<{ id: number; current_stock: number }>;

      if (itemsToSnapshot.length === 0) {
        return NextResponse.json(
          { error: "Tidak ada barang aktif untuk dimasukkan ke sesi Stock Opname." },
          { status: 400 }
        );
      }

      db.exec("BEGIN IMMEDIATE TRANSACTION;");
      try {
        const countNo = generateDocNumber(db, "SO", todayYmd);
        const snapshotAt = new Date().toISOString().replace("T", " ").slice(0, 19);

        const res = db
          .prepare(
            `INSERT INTO stock_counts (count_number, title, status, category_id, snapshot_at, started_by, notes)
             VALUES (?, ?, 'COUNTING', ?, ?, ?, ?)`
          )
          .run(countNo, title, categoryId, snapshotAt, session.userId, notes);

        const scId = Number(res.lastInsertRowid);
        const insertItem = db.prepare(
          `INSERT INTO stock_count_items (stock_count_id, item_id, system_qty_snapshot)
           VALUES (?, ?, ?)`
        );

        for (const it of itemsToSnapshot) {
          insertItem.run(scId, it.id, it.current_stock);
        }

        writeAuditLog(db, {
          userId: session.userId,
          userName: session.name,
          action: "OPNAME_CREATE",
          entityType: "STOCK_COUNT",
          entityId: countNo,
          newValues: { countNo, title, itemCount: itemsToSnapshot.length, snapshotAt },
          ipAddress: ip,
        });

        db.exec("COMMIT;");
        return NextResponse.json({
          success: true,
          stock_count_id: scId,
          count_number: countNo,
          message: `Sesi Stock Opname ${countNo} berhasil dibuka dengan Snapshot Balance (${itemsToSnapshot.length} SKU). Transaksi harian tetap dapat berjalan normal!`,
        });
      } catch (e) {
        db.exec("ROLLBACK;");
        throw e;
      }
    }

    // Petugas maupun Kepala Gudang/Admin dapat menginput hasil hitung fisik
    if (action === "save_counts") {
      const stockCountId = Number(body.stock_count_id);
      const counts = (body.counts || []) as Array<{
        item_id: number;
        counted_qty: number | null | string;
        notes?: string;
      }>;

      const sc = db
        .prepare("SELECT * FROM stock_counts WHERE id = ?")
        .get(stockCountId) as { id: number; count_number: string; status: string } | undefined;

      if (!sc || sc.status !== "COUNTING") {
        return NextResponse.json(
          { error: "Sesi Stock Opname tidak ditemukan atau sudah ditutup." },
          { status: 400 }
        );
      }

      const updateStmt = db.prepare(
        `UPDATE stock_count_items
         SET counted_qty = ?, notes = ?
         WHERE stock_count_id = ? AND item_id = ?`
      );

      db.exec("BEGIN IMMEDIATE TRANSACTION;");
      try {
        for (const c of counts) {
          const val =
            c.counted_qty === "" || c.counted_qty === null || c.counted_qty === undefined
              ? null
              : Number(c.counted_qty);
          if (val !== null && (isNaN(val) || val < 0)) {
            throw new Error("Hasil hitung fisik tidak boleh bernilai negatif.");
          }
          updateStmt.run(val, c.notes ? String(c.notes).trim() : null, stockCountId, Number(c.item_id));
        }
        db.exec("COMMIT;");
      } catch (e) {
        db.exec("ROLLBACK;");
        throw e;
      }

      return NextResponse.json({
        success: true,
        message: `Hasil hitung fisik sesi ${sc.count_number} berhasil disimpan.`,
      });
    }

    // Approval & Posting Penyesuaian Opname (Admin / Kepala Gudang)
    if (action === "approve_session") {
      if (!canVoidOrAdjust(session.role)) {
        return NextResponse.json(
          { error: "BR-15: Hanya Admin atau Kepala Gudang yang dapat menyetujui hasil Stock Opname." },
          { status: 403 }
        );
      }

      const stockCountId = Number(body.stock_count_id);
      const sc = db
        .prepare("SELECT * FROM stock_counts WHERE id = ?")
        .get(stockCountId) as
        | { id: number; count_number: string; title: string; status: string; snapshot_at: string }
        | undefined;

      if (!sc || sc.status !== "COUNTING") {
        return NextResponse.json(
          { error: "Sesi Stock Opname sudah diproses atau tidak aktif." },
          { status: 400 }
        );
      }

      const scItems = db
        .prepare(
          `SELECT sci.*, i.sku, i.name as item_name, i.current_stock, i.avg_cost, u.name as unit_name
           FROM stock_count_items sci
           JOIN items i ON i.id = sci.item_id
           JOIN units u ON u.id = i.unit_id
           WHERE sci.stock_count_id = ?
           ORDER BY sci.item_id ASC`
        )
        .all(stockCountId) as Array<{
        item_id: number;
        system_qty_snapshot: number;
        counted_qty: number | null;
        notes: string | null;
        sku: string;
        item_name: string;
        current_stock: number;
        avg_cost: number;
        unit_name: string;
      }>;

      const uncounted = scItems.filter((it) => it.counted_qty === null);
      if (uncounted.length > 0) {
        return NextResponse.json(
          {
            error: `Masih ada ${uncounted.length} barang yang belum diisi hasil hitung fisiknya (misal: ${uncounted[0].sku}). Isi semua baris sebelum menyetujui opname.`,
          },
          { status: 400 }
        );
      }

      const mutasiStmt = db.prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN td.qty_delta > 0 THEN td.qty_delta ELSE 0 END), 0) as mutasi_masuk,
          COALESCE(SUM(CASE WHEN td.qty_delta < 0 THEN ABS(td.qty_delta) ELSE 0 END), 0) as mutasi_keluar
         FROM transaction_details td
         JOIN transactions t ON t.id = td.transaction_id
         WHERE td.item_id = ?
           AND (t.created_at > ? OR t.transaction_date > substr(?, 1, 10))`
      );

      const adjustmentsToPost: Array<{
        itemId: number;
        sku: string;
        unitName: string;
        qtyDelta: number;
        absQty: number;
        unitCost: number;
        newStock: number;
      }> = [];

      for (const it of scItems) {
        const mut = mutasiStmt.get(it.item_id, sc.snapshot_at, sc.snapshot_at) as {
          mutasi_masuk: number;
          mutasi_keluar: number;
        };
        const expectedStock = Number(
          (
            Number(it.system_qty_snapshot) +
            Number(mut.mutasi_masuk || 0) -
            Number(mut.mutasi_keluar || 0)
          ).toFixed(3)
        );
        const diff = Number((Number(it.counted_qty) - expectedStock).toFixed(3));

        if (Math.abs(diff) > 0.0001) {
          const newStock = Number((Number(it.current_stock) + diff).toFixed(3));
          if (newStock < -0.0001) {
            return NextResponse.json(
              {
                error: `BR-01: Penyesuaian opname untuk '${it.sku}' akan menghasilkan stok negatif (${newStock}). Periksa kembali angka fisik.`,
              },
              { status: 400 }
            );
          }
          adjustmentsToPost.push({
            itemId: it.item_id,
            sku: it.sku,
            unitName: it.unit_name,
            qtyDelta: diff,
            absQty: Math.abs(diff),
            unitCost: Number(it.avg_cost),
            newStock: Math.max(0, newStock),
          });
        }
      }

      db.exec("BEGIN IMMEDIATE TRANSACTION;");
      try {
        let adjTxId: number | null = null;
        let adjTxNo: string | null = null;

        if (adjustmentsToPost.length > 0) {
          const todayYmd = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 10);
          adjTxNo = generateDocNumber(db, "ADJ", todayYmd);

          const txRes = db
            .prepare(
              `INSERT INTO transactions (
                transaction_number, type, transaction_date, reference_number,
                reason_code, notes, request_id, user_id
              ) VALUES (?, 'ADJUSTMENT', ?, ?, 'SELISIH_OPNAME', ?, ?, ?)`
            )
            .run(
              adjTxNo,
              todayYmd,
              sc.count_number,
              `Penyesuaian otomatis dari persetujuan Stock Opname ${sc.count_number} (${sc.title})`,
              crypto.randomUUID(),
              session.userId
            );

          adjTxId = Number(txRes.lastInsertRowid);

          for (const adj of adjustmentsToPost) {
            db.prepare(
              `INSERT INTO transaction_details (
                transaction_id, item_id, quantity, input_quantity, input_unit,
                qty_delta, unit_cost, balance_after
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              adjTxId,
              adj.itemId,
              adj.absQty,
              adj.absQty,
              adj.unitName,
              adj.qtyDelta,
              adj.unitCost,
              adj.newStock
            );

            db.prepare(
              `UPDATE items SET
                current_stock = ?,
                zero_stock_since = CASE WHEN ? = 0 THEN datetime('now') ELSE NULL END,
                updated_at = datetime('now')
               WHERE id = ?`
            ).run(adj.newStock, adj.newStock, adj.itemId);
          }
        }

        db.prepare(
          `UPDATE stock_counts SET
            status = 'APPROVED',
            approved_by = ?,
            approved_at = datetime('now'),
            adjustment_transaction_id = ?
           WHERE id = ?`
        ).run(session.userId, adjTxId, stockCountId);

        writeAuditLog(db, {
          userId: session.userId,
          userName: session.name,
          action: "OPNAME_APPROVE",
          entityType: "STOCK_COUNT",
          entityId: sc.count_number,
          newValues: {
            adjustedItemCount: adjustmentsToPost.length,
            adjustment_transaction_number: adjTxNo,
          },
          ipAddress: ip,
        });

        db.exec("COMMIT;");

        return NextResponse.json({
          success: true,
          adjustment_transaction_number: adjTxNo,
          message:
            adjustmentsToPost.length > 0
              ? `Stock Opname ${sc.count_number} disetujui! Sistem otomatis membuat transaksi koreksi ${adjTxNo} untuk ${adjustmentsToPost.length} SKU yang berselisih.`
              : `Stock Opname ${sc.count_number} disetujui! Seluruh barang 100% akurat sesuai fisik (0 selisih).`,
        });
      } catch (e) {
        db.exec("ROLLBACK;");
        throw e;
      }
    }

    if (action === "cancel_session") {
      if (!canVoidOrAdjust(session.role)) {
        return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
      }
      const stockCountId = Number(body.stock_count_id);
      db.prepare("UPDATE stock_counts SET status = 'CANCELLED' WHERE id = ? AND status = 'COUNTING'").run(
        stockCountId
      );
      return NextResponse.json({ success: true, message: "Sesi Stock Opname dibatalkan." });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

