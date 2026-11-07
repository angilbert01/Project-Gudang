import { NextRequest, NextResponse } from "next/server";
import { generateDocNumber, getDb, writeAuditLog } from "@/lib/db";
import { canManagePO, canSeePrices, getSessionUser } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const showPrices = canSeePrices(session.role);
  const todayYmd = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  const pos = db
    .prepare(
      `SELECT
        po.*,
        s.code as supplier_code,
        s.name as supplier_name,
        s.contact_name as supplier_contact,
        s.phone as supplier_phone,
        s.address as supplier_address,
        s.payment_terms as supplier_terms,
        u.name as created_by_name
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      JOIN users u ON u.id = po.created_by
      ORDER BY po.id DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const itemsStmt = db.prepare(
    `SELECT
      poi.*,
      i.sku,
      i.name as item_name,
      i.current_stock,
      u.name as base_unit_name
     FROM purchase_order_items poi
     JOIN items i ON i.id = poi.item_id
     JOIN units u ON u.id = i.unit_id
     WHERE poi.purchase_order_id = ?
     ORDER BY poi.id ASC`
  );

  const receiptsStmt = db.prepare(
    `SELECT
      t.id,
      t.transaction_number,
      t.transaction_date,
      t.reference_number,
      u.name as user_name,
      rev.transaction_number as reversed_by_number
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN transactions rev ON rev.reverses_transaction_id = t.id
     WHERE t.purchase_order_id = ? AND t.type = 'IN'
     ORDER BY t.id DESC`
  );

  const paymentsStmt = db.prepare(
    `SELECT p.*, u.name as user_name
     FROM po_payments p
     JOIN users u ON u.id = p.user_id
     WHERE p.purchase_order_id = ?
     ORDER BY p.id DESC`
  );

  const result = pos.map((po) => {
    const rawItems = itemsStmt.all(Number(po.id)) as Array<Record<string, unknown>>;
    let totalOrdered = 0;
    let totalReceived = 0;

    const items = rawItems.map((it) => {
      const ordered = Number(it.qty_ordered);
      const received = Number(it.qty_received);
      totalOrdered += ordered;
      totalReceived += Math.min(ordered, received);
      const remainingBase = Math.max(0, Number((ordered - received).toFixed(3)));
      const factor = Number(it.conversion_factor || 1);
      const remainingInput = Number((remainingBase / factor).toFixed(3));

      return {
        ...it,
        remaining_base_qty: remainingBase,
        remaining_input_qty: remainingInput,
        unit_price: showPrices ? Number(it.unit_price) : null,
        discount_amount: showPrices ? Number(it.discount_amount) : null,
        line_total: showPrices ? Number(it.line_total) : null,
      };
    });

    const fulfilledPercent =
      totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

    const isLate =
      Boolean(po.expected_date) &&
      String(po.expected_date) < todayYmd &&
      ["SENT", "PARTIALLY_RECEIVED"].includes(String(po.status));

    const receipts = receiptsStmt.all(Number(po.id));
    const payments = showPrices ? paymentsStmt.all(Number(po.id)) : [];

    return {
      ...po,
      subtotal: showPrices ? Number(po.subtotal) : null,
      discount_total: showPrices ? Number(po.discount_total) : null,
      other_cost: showPrices ? Number(po.other_cost) : null,
      tax_amount: showPrices ? Number(po.tax_amount) : null,
      total_amount: showPrices ? Number(po.total_amount) : null,
      paid_amount: showPrices ? Number(po.paid_amount) : null,
      fulfilled_percent: fulfilledPercent,
      is_late: isLate,
      items,
      receipts,
      payments,
    };
  });

  return NextResponse.json({ purchase_orders: result });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // BR-15: Hanya Admin dan Kepala Gudang yang berhak mengelola PO
  if (!canManagePO(session.role)) {
    return NextResponse.json(
      { error: "BR-15: Role Petugas tidak memiliki hak akses untuk membuat atau mengubah PO." },
      { status: 403 }
    );
  }

  const db = getDb();
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create_po" || action === "update_po") {
      const supplierId = Number(body.supplier_id);
      const poDate = String(
        body.po_date ||
          new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
      );
      const expectedDate = body.expected_date ? String(body.expected_date) : null;
      const dueDate = body.due_date ? String(body.due_date) : null;
      const ppnPercent = Math.max(0, Number(body.ppn_percent || 0));
      const discountTotal = Math.max(0, Number(body.discount_total || 0));
      const otherCost = Math.max(0, Number(body.other_cost || 0));
      const notes = body.notes ? String(body.notes).trim() : null;
      const initialStatus = body.send_immediately ? "SENT" : "DRAFT";

      if (action === "update_po") {
        const poId = Number(body.id);
        const existingPo = db
          .prepare("SELECT * FROM purchase_orders WHERE id = ?")
          .get(poId) as Record<string, unknown> | undefined;
        if (!existingPo) {
          return NextResponse.json({ error: "PO tidak ditemukan." }, { status: 404 });
        }

        // FR-08: Setelah Dikirim, kuantitas, harga, dan barang terkunci; hanya catatan dan tanggal yang diharapkan yang bisa diubah
        if (existingPo.status !== "DRAFT") {
          db.prepare(
            "UPDATE purchase_orders SET expected_date = ?, due_date = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
          ).run(expectedDate, dueDate, notes, poId);

          writeAuditLog(db, {
            userId: session.userId,
            userName: session.name,
            action: "PO_UPDATE_META",
            entityType: "PURCHASE_ORDER",
            entityId: String(existingPo.po_number),
            newValues: { expectedDate, dueDate, notes },
            ipAddress: ip,
          });

          return NextResponse.json({
            success: true,
            message: `Catatan & estimasi tanggal kirim PO ${existingPo.po_number} diperbarui (Barang & harga terkunci karena status bukan Draft).`,
          });
        }
      }

      const sup = db
        .prepare("SELECT id, is_active FROM suppliers WHERE id = ?")
        .get(supplierId) as { id: number; is_active: number } | undefined;
      if (!sup || !sup.is_active) {
        return NextResponse.json(
          { error: "FR-04/FR-08: Supplier wajib dipilih dan berstatus aktif." },
          { status: 400 }
        );
      }

      const rawLines = (body.items || []) as Array<{
        item_id: number;
        description?: string;
        input_qty: number;
        use_purchase_unit?: boolean;
        unit_price: number;
        discount_amount?: number;
      }>;

      if (!Array.isArray(rawLines) || rawLines.length === 0) {
        return NextResponse.json(
          { error: "FR-08: Minimal harus ada 1 baris barang dalam Purchase Order." },
          { status: 400 }
        );
      }

      const seenItems = new Set<number>();
      let subtotal = 0;

      const preparedItems: Array<{
        itemId: number;
        description: string;
        inputQty: number;
        inputUnit: string;
        conversionFactor: number;
        qtyOrderedBase: number;
        unitPrice: number;
        discountAmount: number;
        lineTotal: number;
      }> = [];

      for (const l of rawLines) {
        const itemId = Number(l.item_id);
        if (!itemId) {
          return NextResponse.json({ error: "Pilih barang pada setiap baris PO." }, { status: 400 });
        }
        if (seenItems.has(itemId)) {
          return NextResponse.json(
            { error: "FR-08: Barang yang sama tidak boleh muncul dua kali dalam satu PO." },
            { status: 400 }
          );
        }
        seenItems.add(itemId);

        const item = db
          .prepare(
            `SELECT i.*, u.name as unit_name, pu.name as purchase_unit_name
             FROM items i
             JOIN units u ON u.id = i.unit_id
             LEFT JOIN units pu ON pu.id = i.purchase_unit_id
             WHERE i.id = ? AND i.is_active = 1`
          )
          .get(itemId) as
          | {
              id: number;
              sku: string;
              name: string;
              conversion_factor: number;
              unit_name: string;
              purchase_unit_name: string | null;
            }
          | undefined;

        if (!item) {
          return NextResponse.json(
            { error: "Barang tidak ditemukan atau nonaktif." },
            { status: 400 }
          );
        }

        const inputQty = Number(l.input_qty);
        const unitPrice = Number(l.unit_price || 0);
        const discountAmount = Math.max(0, Number(l.discount_amount || 0));

        if (isNaN(inputQty) || inputQty <= 0) {
          return NextResponse.json(
            { error: `Kuantitas PO untuk '${item.sku}' harus lebih dari 0.` },
            { status: 400 }
          );
        }
        if (unitPrice < 0) {
          return NextResponse.json(
            { error: `Harga satuan untuk '${item.sku}' tidak boleh negatif.` },
            { status: 400 }
          );
        }

        const usePurchaseUnit =
          l.use_purchase_unit !== undefined
            ? Boolean(l.use_purchase_unit && item.conversion_factor > 1)
            : item.conversion_factor > 1;
        const factor = usePurchaseUnit ? Number(item.conversion_factor) : 1;
        const inputUnit = usePurchaseUnit
          ? item.purchase_unit_name || item.unit_name
          : item.unit_name;
        const qtyOrderedBase = Number((inputQty * factor).toFixed(3));
        const lineTotal = Math.max(0, Number((inputQty * unitPrice - discountAmount).toFixed(2)));
        subtotal += lineTotal;

        preparedItems.push({
          itemId,
          description: l.description ? String(l.description).trim() : item.name,
          inputQty,
          inputUnit,
          conversionFactor: factor,
          qtyOrderedBase,
          unitPrice,
          discountAmount,
          lineTotal,
        });
      }

      const afterDiscount = Math.max(0, subtotal - discountTotal);
      const taxAmount = Number(((afterDiscount * ppnPercent) / 100).toFixed(2));
      const totalAmount = Number((afterDiscount + taxAmount + otherCost).toFixed(2));

      db.exec("BEGIN IMMEDIATE TRANSACTION;");
      try {
        let poId: number;
        let poNumber: string;

        if (action === "create_po") {
          poNumber = generateDocNumber(db, "PO", poDate);
          const sentAt = initialStatus === "SENT" ? new Date().toISOString() : null;
          const res = db
            .prepare(
              `INSERT INTO purchase_orders (
                po_number, supplier_id, po_date, expected_date, due_date, status,
                ppn_percent, discount_total, other_cost, subtotal, tax_amount, total_amount,
                notes, created_by, sent_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              poNumber,
              supplierId,
              poDate,
              expectedDate,
              dueDate,
              initialStatus,
              ppnPercent,
              discountTotal,
              otherCost,
              subtotal,
              taxAmount,
              totalAmount,
              notes,
              session.userId,
              sentAt
            );
          poId = Number(res.lastInsertRowid);
        } else {
          poId = Number(body.id);
          const existing = db
            .prepare("SELECT po_number FROM purchase_orders WHERE id = ?")
            .get(poId) as { po_number: string };
          poNumber = existing.po_number;

          db.prepare(
            `UPDATE purchase_orders SET
              supplier_id = ?, po_date = ?, expected_date = ?, due_date = ?,
              status = ?, ppn_percent = ?, discount_total = ?, other_cost = ?,
              subtotal = ?, tax_amount = ?, total_amount = ?, notes = ?,
              sent_at = CASE WHEN ? = 'SENT' THEN datetime('now') ELSE sent_at END,
              updated_at = datetime('now')
             WHERE id = ?`
          ).run(
            supplierId,
            poDate,
            expectedDate,
            dueDate,
            initialStatus,
            ppnPercent,
            discountTotal,
            otherCost,
            subtotal,
            taxAmount,
            totalAmount,
            notes,
            initialStatus,
            poId
          );

          db.prepare("DELETE FROM purchase_order_items WHERE purchase_order_id = ?").run(poId);
        }

        const insertItem = db.prepare(
          `INSERT INTO purchase_order_items (
            purchase_order_id, item_id, description, input_qty, input_unit, conversion_factor,
            qty_ordered, qty_received, unit_price, discount_amount, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
        );

        for (const it of preparedItems) {
          insertItem.run(
            poId,
            it.itemId,
            it.description,
            it.inputQty,
            it.inputUnit,
            it.conversionFactor,
            it.qtyOrderedBase,
            it.unitPrice,
            it.discountAmount,
            it.lineTotal
          );
        }

        writeAuditLog(db, {
          userId: session.userId,
          userName: session.name,
          action: action === "create_po" ? "PO_CREATE" : "PO_UPDATE",
          entityType: "PURCHASE_ORDER",
          entityId: poNumber,
          newValues: { poNumber, status: initialStatus, totalAmount, itemCount: preparedItems.length },
          ipAddress: ip,
        });

        db.exec("COMMIT;");

        return NextResponse.json({
          success: true,
          po_id: poId,
          po_number: poNumber,
          message: `Purchase Order ${poNumber} berhasil disimpan (${initialStatus}).`,
        });
      } catch (e) {
        db.exec("ROLLBACK;");
        throw e;
      }
    }

    if (action === "change_status") {
      const poId = Number(body.id);
      const nextStatus = String(body.status || "").toUpperCase();
      const reason = String(body.reason || "").trim();

      const po = db
        .prepare("SELECT * FROM purchase_orders WHERE id = ?")
        .get(poId) as
        | { id: number; po_number: string; status: string }
        | undefined;

      if (!po) {
        return NextResponse.json({ error: "PO tidak ditemukan." }, { status: 404 });
      }

      if (nextStatus === "SENT") {
        if (po.status !== "DRAFT") {
          return NextResponse.json(
            { error: "FR-08: Hanya PO berstatus Draft yang dapat ditandai Dikirim." },
            { status: 400 }
          );
        }
        db.prepare(
          "UPDATE purchase_orders SET status = 'SENT', sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
        ).run(poId);
      } else if (nextStatus === "CANCELLED") {
        if (!["DRAFT", "SENT"].includes(po.status)) {
          return NextResponse.json(
            {
              error:
                "FR-08: Hanya PO Draft atau Dikirim yang belum memiliki penerimaan yang dapat Dibatalkan.",
            },
            { status: 400 }
          );
        }
        const totalRec = (
          db
            .prepare(
              "SELECT COALESCE(SUM(qty_received), 0) as rec FROM purchase_order_items WHERE purchase_order_id = ?"
            )
            .get(poId) as { rec: number }
        ).rec;
        if (totalRec > 0) {
          return NextResponse.json(
            {
              error:
                "FR-08: PO sudah memiliki riwayat penerimaan dan tidak bisa Dibatalkan. Gunakan fitur Tutup Manual.",
            },
            { status: 400 }
          );
        }
        if (reason.length < 5) {
          return NextResponse.json(
            { error: "FR-08: Alasan pembatalan PO wajib diisi." },
            { status: 400 }
          );
        }
        db.prepare(
          "UPDATE purchase_orders SET status = 'CANCELLED', status_reason = ?, cancelled_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
        ).run(reason, poId);
      } else if (nextStatus === "CLOSED") {
        if (po.status !== "PARTIALLY_RECEIVED") {
          return NextResponse.json(
            {
              error:
                "FR-08: Hanya PO berstatus Diterima Sebagian yang dapat Ditutup Manual.",
            },
            { status: 400 }
          );
        }
        if (reason.length < 5) {
          return NextResponse.json(
            { error: "FR-08: Alasan Tutup Manual PO wajib diisi." },
            { status: 400 }
          );
        }
        db.prepare(
          "UPDATE purchase_orders SET status = 'CLOSED', status_reason = ?, closed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
        ).run(reason, poId);
      } else {
        return NextResponse.json({ error: "Transisi status tidak valid." }, { status: 400 });
      }

      writeAuditLog(db, {
        userId: session.userId,
        userName: session.name,
        action: "PO_STATUS_CHANGE",
        entityType: "PURCHASE_ORDER",
        entityId: po.po_number,
        oldValues: { status: po.status },
        newValues: { status: nextStatus, reason },
        ipAddress: ip,
      });

      return NextResponse.json({
        success: true,
        message: `Status PO ${po.po_number} berhasil diubah menjadi ${nextStatus}.`,
      });
    }

    // Pencatatan Pembayaran / Pelunasan Hutang PO Supplier
    if (action === "record_payment") {
      const poId = Number(body.purchase_order_id);
      const amount = Number(body.amount);
      const paymentDate = String(
        body.payment_date ||
          new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
      );
      const paymentMethod = String(body.payment_method || "TRANSFER BANK").trim();
      const referenceNumber = body.reference_number ? String(body.reference_number).trim() : null;
      const notes = body.notes ? String(body.notes).trim() : null;

      const po = db
        .prepare("SELECT * FROM purchase_orders WHERE id = ?")
        .get(poId) as
        | { id: number; po_number: string; total_amount: number; paid_amount: number }
        | undefined;
      if (!po) {
        return NextResponse.json({ error: "PO tidak ditemukan." }, { status: 404 });
      }
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: "Nominal pembayaran harus lebih dari 0." }, { status: 400 });
      }

      const remainingDebt = Math.max(0, Number((po.total_amount - po.paid_amount).toFixed(2)));
      if (amount > remainingDebt + 1) {
        return NextResponse.json(
          { error: `Nominal bayar melebihi sisa hutang PO (Rp ${remainingDebt.toLocaleString("id-ID")}).` },
          { status: 400 }
        );
      }

      const newPaid = Number((po.paid_amount + amount).toFixed(2));
      const newPayStatus = newPaid >= po.total_amount - 1 ? "PAID" : "PARTIAL";

      db.exec("BEGIN IMMEDIATE TRANSACTION;");
      try {
        db.prepare(
          `INSERT INTO po_payments (purchase_order_id, payment_date, amount, payment_method, reference_number, notes, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(poId, paymentDate, amount, paymentMethod, referenceNumber, notes, session.userId);

        db.prepare(
          `UPDATE purchase_orders SET paid_amount = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(newPaid, newPayStatus, poId);

        writeAuditLog(db, {
          userId: session.userId,
          userName: session.name,
          action: "PO_PAYMENT_RECORDED",
          entityType: "PURCHASE_ORDER",
          entityId: po.po_number,
          newValues: { amount, newPaid, payment_status: newPayStatus, referenceNumber },
          ipAddress: ip,
        });

        db.exec("COMMIT;");
      } catch (e) {
        db.exec("ROLLBACK;");
        throw e;
      }

      return NextResponse.json({
        success: true,
        message: `Pembayaran hutang PO ${po.po_number} sebesar Rp ${amount.toLocaleString("id-ID")} berhasil dicatat (${newPayStatus}).`,
      });
    }

    return NextResponse.json({ error: "Aksi PO tidak dikenali." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

