import { NextRequest, NextResponse } from "next/server";
import { getDb, writeAuditLog } from "@/lib/db";
import { canSeePrices, getSessionUser, isAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const showPrices = canSeePrices(session.role);
  const { searchParams } = new URL(req.url);
  const reportType = searchParams.get("type") || "dashboard";

  // ===========================================================================
  // 1. DASHBOARD & PERINGATAN STOK MINIMUM + REKONSILIASI BR-05
  // ===========================================================================
  if (reportType === "dashboard") {
    const todayYmd = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);

    // FR-05: Barang di bawah atau sama dengan stok minimum, diurutkan rasio stok terhadap minimum
    const criticalItems = db
      .prepare(
        `SELECT
          i.id, i.sku, i.name, i.current_stock, i.min_stock, i.conversion_factor,
          i.avg_cost, i.last_purchase_cost,
          c.name as category_name,
          u.name as unit_name,
          pu.name as purchase_unit_name,
          CASE WHEN i.min_stock > 0 THEN (i.current_stock * 1.0 / i.min_stock) ELSE 0 END as stock_ratio
        FROM items i
        JOIN categories c ON c.id = i.category_id
        JOIN units u ON u.id = i.unit_id
        LEFT JOIN units pu ON pu.id = i.purchase_unit_id
        WHERE i.is_active = 1 AND i.min_stock > 0 AND i.current_stock <= i.min_stock
        ORDER BY stock_ratio ASC, i.sku ASC`
      )
      .all() as Array<Record<string, unknown>>;

    // Open & Late POs
    const openPos = db
      .prepare(
        `SELECT
          po.id, po.po_number, po.po_date, po.expected_date, po.status, po.total_amount,
          po.payment_status, po.paid_amount,
          s.name as supplier_name
        FROM purchase_orders po
        JOIN suppliers s ON s.id = po.supplier_id
        WHERE po.status IN ('SENT', 'PARTIALLY_RECEIVED')
        ORDER BY po.expected_date ASC, po.id DESC`
      )
      .all() as Array<Record<string, unknown>>;

    const formattedOpenPos = openPos.map((p) => ({
      ...p,
      total_amount: showPrices ? Number(p.total_amount) : null,
      paid_amount: showPrices ? Number(p.paid_amount) : null,
      is_late: Boolean(p.expected_date && String(p.expected_date) < todayYmd),
    }));

    // 10 Transaksi Terakhir
    const recentTxs = db
      .prepare(
        `SELECT
          t.id, t.transaction_number, t.type, t.transaction_date, t.reference_number,
          t.requester_name, t.created_at,
          u.name as user_name,
          s.name as supplier_name,
          rev.transaction_number as reversed_by_number,
          (SELECT COUNT(*) FROM transaction_details td WHERE td.transaction_id = t.id) as item_count
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        LEFT JOIN suppliers s ON s.id = t.supplier_id
        LEFT JOIN transactions rev ON rev.reverses_transaction_id = t.id
        ORDER BY t.id DESC
        LIMIT 10`
      )
      .all();

    // BR-05: Rekonsiliasi Stok Harian (current_stock vs SUM(qty_delta))
    const reconDiscrepancies = db
      .prepare(
        `SELECT
          i.id, i.sku, i.name, i.current_stock,
          COALESCE(SUM(td.qty_delta), 0) as calculated_stock,
          ROUND(i.current_stock - COALESCE(SUM(td.qty_delta), 0), 3) as discrepancy
        FROM items i
        LEFT JOIN transaction_details td ON td.item_id = i.id
        GROUP BY i.id
        HAVING ABS(i.current_stock - COALESCE(SUM(td.qty_delta), 0)) > 0.001`
      )
      .all();

    // Summary KPI
    const kpiRow = db
      .prepare(
        `SELECT
          COUNT(*) as total_active_items,
          COALESCE(SUM(current_stock * avg_cost), 0) as total_inventory_value
        FROM items WHERE is_active = 1`
      )
      .get() as { total_active_items: number; total_inventory_value: number };

    const debtRow = db
      .prepare(
        `SELECT COALESCE(SUM(total_amount - paid_amount), 0) as total_unpaid_po
         FROM purchase_orders
         WHERE status IN ('SENT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED')
           AND payment_status != 'PAID'`
      )
      .get() as { total_unpaid_po: number };

    return NextResponse.json({
      kpi: {
        total_active_items: kpiRow.total_active_items,
        critical_stock_count: criticalItems.length,
        open_po_count: formattedOpenPos.length,
        late_po_count: formattedOpenPos.filter((p) => p.is_late).length,
        total_inventory_value: showPrices ? kpiRow.total_inventory_value : null,
        total_unpaid_po: showPrices ? debtRow.total_unpaid_po : null,
      },
      critical_items: criticalItems.map((it) => {
        const deficit = Math.max(1, Number(it.min_stock) - Number(it.current_stock));
        const factor = Number(it.conversion_factor || 1);
        const suggestedPurchaseQty = Math.ceil(deficit / factor);
        return {
          ...it,
          avg_cost: showPrices ? Number(it.avg_cost) : null,
          last_purchase_cost: showPrices ? Number(it.last_purchase_cost) : null,
          suggested_base_qty: deficit,
          suggested_purchase_qty: suggestedPurchaseQty,
        };
      }),
      open_pos: formattedOpenPos,
      recent_transactions: recentTxs,
      reconciliation: {
        is_healthy: reconDiscrepancies.length === 0,
        discrepancies: reconDiscrepancies,
        checked_at: new Date().toISOString(),
      },
    });
  }

  // ===========================================================================
  // 2. KARTU STOK / MUTASI PER BARANG (FR-14 Must - Terbuka untuk semua role)
  // ===========================================================================
  if (reportType === "kartu_stok") {
    const itemId = Number(searchParams.get("item_id"));
    const startDate = searchParams.get("start_date") || "";
    const endDate = searchParams.get("end_date") || "";
    const txType = searchParams.get("tx_type") || "";

    if (!itemId) {
      return NextResponse.json({ error: "item_id wajib dipilih." }, { status: 400 });
    }

    const item = db
      .prepare(
        `SELECT i.*, c.name as category_name, u.name as unit_name, pu.name as purchase_unit_name
         FROM items i
         JOIN categories c ON c.id = i.category_id
         JOIN units u ON u.id = i.unit_id
         LEFT JOIN units pu ON pu.id = i.purchase_unit_id
         WHERE i.id = ?`
      )
      .get(itemId) as Record<string, unknown> | undefined;

    if (!item) {
      return NextResponse.json({ error: "Barang tidak ditemukan." }, { status: 404 });
    }

    const clauses = ["td.item_id = ?"];
    const args: Array<string | number> = [itemId];

    if (startDate) {
      clauses.push("t.transaction_date >= ?");
      args.push(startDate);
    }
    if (endDate) {
      clauses.push("t.transaction_date <= ?");
      args.push(endDate);
    }
    if (txType) {
      clauses.push("t.type = ?");
      args.push(txType);
    }

    // BR-08: Kartu stok diurutkan berdasarkan urutan pencatatan (td.id ASC)
    const mutations = db
      .prepare(
        `SELECT
          td.id,
          td.transaction_id,
          td.quantity,
          td.input_quantity,
          td.input_unit,
          td.qty_delta,
          td.unit_cost,
          td.balance_after,
          t.transaction_number,
          t.type,
          t.transaction_date,
          t.reference_number,
          t.requester_name,
          t.reason_code,
          t.notes,
          t.created_at,
          u.name as user_name,
          s.name as supplier_name,
          po.po_number,
          rev.transaction_number as reversed_by_number
        FROM transaction_details td
        JOIN transactions t ON t.id = td.transaction_id
        JOIN users u ON u.id = t.user_id
        LEFT JOIN suppliers s ON s.id = t.supplier_id
        LEFT JOIN purchase_orders po ON po.id = t.purchase_order_id
        LEFT JOIN transactions rev ON rev.reverses_transaction_id = t.id
        WHERE ${clauses.join(" AND ")}
        ORDER BY td.id ASC`
      )
      .all(...args) as Array<Record<string, unknown>>;

    return NextResponse.json({
      item: {
        ...item,
        avg_cost: showPrices ? Number(item.avg_cost) : null,
        last_purchase_cost: showPrices ? Number(item.last_purchase_cost) : null,
      },
      mutations: mutations.map((m) => ({
        ...m,
        unit_cost: showPrices ? Number(m.unit_cost) : null,
        is_voided: Boolean(m.reversed_by_number),
      })),
    });
  }

  // ===========================================================================
  // 3. LAPORAN PERIODIK, PEMAKAIAN SPK, NILAI PERSEDIAAN, FLUKTUASI HARGA
  //    (Bagian 3 Matriks Hak Akses: Hanya Admin & Kepala Gudang)
  // ===========================================================================
  if (!showPrices) {
    return NextResponse.json(
      { error: "BR-15: Role Petugas tidak memiliki akses ke laporan manajemen dan harga." },
      { status: 403 }
    );
  }

  if (reportType === "periodic") {
    const startDate = searchParams.get("start_date") || "2026-10-01";
    const endDate = searchParams.get("end_date") || "2026-12-31";

    const rows = db
      .prepare(
        `SELECT
          i.id,
          i.sku,
          i.name,
          i.avg_cost,
          c.name as category_name,
          u.name as unit_name,
          COALESCE((
            SELECT SUM(td1.qty_delta)
            FROM transaction_details td1
            JOIN transactions t1 ON t1.id = td1.transaction_id
            WHERE td1.item_id = i.id AND t1.transaction_date < ?
          ), 0) as opening_stock,
          COALESCE((
            SELECT SUM(td2.qty_delta)
            FROM transaction_details td2
            JOIN transactions t2 ON t2.id = td2.transaction_id
            WHERE td2.item_id = i.id
              AND t2.transaction_date BETWEEN ? AND ?
              AND t2.type IN ('IN', 'OPENING')
          ), 0) as total_in,
          COALESCE((
            SELECT SUM(ABS(td3.qty_delta))
            FROM transaction_details td3
            JOIN transactions t3 ON t3.id = td3.transaction_id
            WHERE td3.item_id = i.id
              AND t3.transaction_date BETWEEN ? AND ?
              AND t3.type IN ('OUT', 'CUTTING')
              AND td3.qty_delta < 0
          ), 0) as total_out,
          COALESCE((
            SELECT SUM(td4.qty_delta)
            FROM transaction_details td4
            JOIN transactions t4 ON t4.id = td4.transaction_id
            WHERE td4.item_id = i.id
              AND t4.transaction_date BETWEEN ? AND ?
              AND (t4.type IN ('ADJUSTMENT', 'REVERSAL') OR (t4.type = 'CUTTING' AND td4.qty_delta > 0))
          ), 0) as total_adjustment
        FROM items i
        JOIN categories c ON c.id = i.category_id
        JOIN units u ON u.id = i.unit_id
        ORDER BY i.sku ASC`
      )
      .all(
        startDate,
        startDate,
        endDate,
        startDate,
        endDate,
        startDate,
        endDate
      ) as Array<Record<string, unknown>>;

    const periodic = rows.map((r) => {
      const opening = Number(r.opening_stock || 0);
      const tin = Number(r.total_in || 0);
      const tout = Number(r.total_out || 0);
      const tadj = Number(r.total_adjustment || 0);
      const closing = Number((opening + tin - tout + tadj).toFixed(3));
      const closingValue = Number((closing * Number(r.avg_cost || 0)).toFixed(2));
      return {
        ...r,
        opening_stock: opening,
        total_in: tin,
        total_out: tout,
        total_adjustment: tadj,
        closing_stock: closing,
        closing_value: closingValue,
      };
    });

    return NextResponse.json({ start_date: startDate, end_date: endDate, periodic });
  }

  if (reportType === "spk_usage") {
    const spkRows = db
      .prepare(
        `SELECT
          t.reference_number as spk_number,
          t.transaction_date,
          t.transaction_number,
          t.type,
          t.requester_name,
          i.sku,
          i.name as item_name,
          u.name as unit_name,
          td.qty_delta,
          ABS(td.qty_delta) as qty_used,
          td.unit_cost,
          ROUND(ABS(td.qty_delta) * td.unit_cost, 2) as total_cost
        FROM transaction_details td
        JOIN transactions t ON t.id = td.transaction_id
        JOIN items i ON i.id = td.item_id
        JOIN units u ON u.id = i.unit_id
        LEFT JOIN transactions rev ON rev.reverses_transaction_id = t.id
        WHERE t.type IN ('OUT', 'CUTTING')
          AND rev.id IS NULL
          AND td.qty_delta < 0
        ORDER BY t.reference_number DESC, t.transaction_date DESC`
      )
      .all();

    return NextResponse.json({ spk_usage: spkRows });
  }

  if (reportType === "price_fluctuation") {
    const history = db
      .prepare(
        `SELECT
          sph.*,
          i.sku,
          i.name as item_name,
          u.name as base_unit_name,
          s.name as supplier_name,
          s.code as supplier_code
        FROM supplier_price_history sph
        JOIN items i ON i.id = sph.item_id
        JOIN units u ON u.id = i.unit_id
        JOIN suppliers s ON s.id = sph.supplier_id
        ORDER BY sph.item_id ASC, sph.transaction_date ASC, sph.id ASC`
      )
      .all();

    return NextResponse.json({ price_history: history });
  }

  if (reportType === "audit_logs") {
    if (!isAdmin(session.role)) {
      return NextResponse.json(
        { error: "FR-16: Hanya Admin yang dapat melihat Audit Log." },
        { status: 403 }
      );
    }
    const logs = db
      .prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500")
      .all();
    return NextResponse.json({ audit_logs: logs });
  }

  return NextResponse.json({ error: "Jenis laporan tidak valid." }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const body = await req.json();

  // FR-15: Setiap ekspor tercatat di audit log
  writeAuditLog(db, {
    userId: session.userId,
    userName: session.name,
    action: "REPORT_EXPORT",
    entityType: String(body.report_name || "REPORT"),
    entityId: String(body.format || "CSV"),
    newValues: {
      report_name: body.report_name,
      format: body.format,
      row_count: body.row_count,
    },
    ipAddress: ip,
  });

  return NextResponse.json({ success: true });
}

