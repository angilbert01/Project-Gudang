import { NextRequest, NextResponse } from "next/server";
import { generateDocNumber, getDb, writeAuditLog } from "@/lib/db";
import {
  canSeePrices,
  canVoidOrAdjust,
  getSessionUser,
  isAdmin,
  validateTransactionDate,
} from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const { searchParams } = new URL(req.url);

  // BR-13: Cek peringatan duplikat Nomor Nota dari Supplier yang sama
  const checkNota = searchParams.get("check_nota");
  const checkSupplierId = searchParams.get("supplier_id");
  if (checkNota && checkSupplierId) {
    const normalizedNota = checkNota.trim().toUpperCase();
    const existing = db
      .prepare(
        `SELECT t.transaction_number, t.transaction_date
         FROM transactions t
         LEFT JOIN transactions rev ON rev.reverses_transaction_id = t.id
         WHERE t.type = 'IN'
           AND t.supplier_id = ?
           AND upper(trim(t.reference_number)) = ?
           AND rev.id IS NULL
         LIMIT 1`
      )
      .get(Number(checkSupplierId), normalizedNota) as
      | { transaction_number: string; transaction_date: string }
      | undefined;

    return NextResponse.json({
      isDuplicate: Boolean(existing),
      existingTransaction: existing || null,
    });
  }

  const showPrices = canSeePrices(session.role);

  // Bagian 3 Matriks Hak Akses: Daftar riwayat transaksi -> Petugas hanya miliknya
  const whereClause =
    session.role === "PETUGAS" ? "WHERE t.user_id = ?" : "";
  const queryArgs = session.role === "PETUGAS" ? [session.userId] : [];

  const txs = db
    .prepare(
      `SELECT
        t.*,
        u.name as user_name,
        u.role as user_role,
        s.name as supplier_name,
        s.code as supplier_code,
        po.po_number,
        rev.id as reversed_by_id,
        rev.transaction_number as reversed_by_number,
        orig.transaction_number as reverses_transaction_number
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN suppliers s ON s.id = t.supplier_id
      LEFT JOIN purchase_orders po ON po.id = t.purchase_order_id
      LEFT JOIN transactions rev ON rev.reverses_transaction_id = t.id
      LEFT JOIN transactions orig ON orig.id = t.reverses_transaction_id
      ${whereClause}
      ORDER BY t.id DESC
      LIMIT 300`
    )
    .all(...queryArgs) as Array<Record<string, unknown>>;

  const detailsStmt = db.prepare(
    `SELECT
      td.*,
      i.sku,
      i.name as item_name,
      u.name as unit_name
     FROM transaction_details td
     JOIN items i ON i.id = td.item_id
     JOIN units u ON u.id = i.unit_id
     WHERE td.transaction_id = ?
     ORDER BY td.id ASC`
  );

  const transactions = txs.map((tx) => {
    const rawDetails = detailsStmt.all(Number(tx.id)) as Array<Record<string, unknown>>;
    const details = rawDetails.map((d) => ({
      ...d,
      unit_cost: showPrices ? Number(d.unit_cost) : null,
    }));
    return {
      ...tx,
      is_voided: Boolean(tx.reversed_by_id),
      cutting_info: tx.cutting_info_json ? JSON.parse(String(tx.cutting_info_json)) : null,
      details,
    };
  });

  return NextResponse.json({ transactions });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 });
  }

  const type = String(body.type || "").toUpperCase();
  const requestId = String(body.request_id || "").trim();

  if (!requestId) {
    return NextResponse.json(
      { error: "BR-03: request_id (UUID) wajib disertakan untuk pencegahan transaksi ganda." },
      { status: 400 }
    );
  }

  // Step 1: Otorisasi Role di Server (BR-15)
  if (["ADJUSTMENT", "REVERSAL"].includes(type) && !canVoidOrAdjust(session.role)) {
    return NextResponse.json(
      { error: `BR-15: Role ${session.role} tidak berhak melakukan transaksi ${type}.` },
      { status: 403 }
    );
  }
  if (type === "OPENING" && !isAdmin(session.role)) {
    return NextResponse.json(
      { error: "BR-15/FR-11: Hanya Admin yang berhak mencatat Opening Balance." },
      { status: 403 }
    );
  }

  const txDate = String(
    body.transaction_date ||
      new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  );

  // Validasi Tanggal Transaksi (BR-08) kecuali untuk REVERSAL yang memakai tanggal hari ini
  if (type !== "REVERSAL") {
    const dateCheck = validateTransactionDate(txDate, session.role);
    if (!dateCheck.valid) {
      return NextResponse.json({ error: dateCheck.error }, { status: 400 });
    }
  }

  // Step 3: Cek Idempotensi request_id sebelum/di dalam transaksi (BR-03)
  const existingTx = db
    .prepare("SELECT id, transaction_number, type FROM transactions WHERE request_id = ?")
    .get(requestId) as { id: number; transaction_number: string; type: string } | undefined;

  if (existingTx) {
    return NextResponse.json({
      success: true,
      idempotent_replay: true,
      transaction_id: existingTx.id,
      transaction_number: existingTx.transaction_number,
      message: `BR-03 (Idempotency): Transaksi sudah tersimpan sebelumnya dengan nomor ${existingTx.transaction_number}. Duplikasi dicegah.`,
    });
  }

  // Step 2: Mulai Atomic Database Transaction (BR-04)
  db.exec("BEGIN IMMEDIATE TRANSACTION;");
  try {
    // =========================================================================
    // A. TRANSAKSI VOID / REVERSAL (FR-12 & BR-06)
    // =========================================================================
    if (type === "REVERSAL") {
      const targetTxId = Number(body.reverses_transaction_id);
      const reason = String(body.notes || "").trim();

      if (!targetTxId) {
        throw new Error("ID transaksi yang akan di-void wajib dipilih.");
      }
      if (reason.length < 10) {
        throw new Error("BR-06/BR-006: Alasan Void/Reversal wajib diisi minimal 10 karakter.");
      }

      const targetTx = db
        .prepare("SELECT * FROM transactions WHERE id = ?")
        .get(targetTxId) as Record<string, unknown> | undefined;

      if (!targetTx) {
        throw new Error("Transaksi asal tidak ditemukan.");
      }
      if (targetTx.type === "REVERSAL") {
        throw new Error("BR-06: Transaksi bertipe REVERSAL tidak dapat di-void kembali.");
      }

      const alreadyReversed = db
        .prepare("SELECT transaction_number FROM transactions WHERE reverses_transaction_id = ?")
        .get(targetTxId) as { transaction_number: string } | undefined;

      if (alreadyReversed) {
        throw new Error(
          `BR-06: Transaksi ini sudah pernah di-void oleh ${alreadyReversed.transaction_number}.`
        );
      }

      const origDetails = db
        .prepare(
          `SELECT td.*, i.sku, i.name as item_name, i.current_stock, i.avg_cost
           FROM transaction_details td
           JOIN items i ON i.id = td.item_id
           WHERE td.transaction_id = ?
           ORDER BY td.item_id ASC`
        )
        .all(targetTxId) as Array<{
        id: number;
        item_id: number;
        po_item_id: number | null;
        quantity: number;
        input_quantity: number | null;
        input_unit: string | null;
        qty_delta: number;
        unit_cost: number;
        sku: string;
        item_name: string;
        current_stock: number;
        avg_cost: number;
      }>;

      // BR-01: Cek apakah pembalikan membuat stok minus
      for (const line of origDetails) {
        const reversalDelta = -Number(line.qty_delta);
        const projectedStock = Number(line.current_stock) + reversalDelta;
        if (projectedStock < -0.0001) {
          throw new Error(
            `BR-01 & BR-06: Void ditolak! Stok barang '${line.sku} - ${line.item_name}' sudah terpakai (Stok saat ini: ${line.current_stock}, butuh dikurangi: ${Math.abs(reversalDelta)}).`
          );
        }
      }

      const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
      const revNumber = generateDocNumber(db, "REV", todayStr);

      const revInsert = db
        .prepare(
          `INSERT INTO transactions (
            transaction_number, type, transaction_date, reference_number,
            supplier_id, purchase_order_id, reverses_transaction_id,
            reason_code, notes, request_id, user_id
          ) VALUES (?, 'REVERSAL', ?, ?, ?, ?, ?, 'VOID_REVERSAL', ?, ?, ?)`
        )
        .run(
          revNumber,
          todayStr,
          `VOID:${targetTx.transaction_number}`,
          targetTx.supplier_id != null ? Number(targetTx.supplier_id) : null,
          targetTx.purchase_order_id != null ? Number(targetTx.purchase_order_id) : null,
          targetTxId,
          reason,
          requestId,
          session.userId
        );

      const revTxId = Number(revInsert.lastInsertRowid);

      for (const line of origDetails) {
        const curItem = db
          .prepare("SELECT current_stock, avg_cost FROM items WHERE id = ?")
          .get(line.item_id) as { current_stock: number; avg_cost: number };

        const revDelta = -Number(line.qty_delta);
        const newStock = Math.max(0, Number((curItem.current_stock + revDelta).toFixed(3)));

        // BR-14: Hitung ulang avg_cost bila membalik transaksi IN
        let newAvgCost = curItem.avg_cost;
        if (revDelta < 0 && newStock > 0) {
          const totalValueBefore = curItem.current_stock * curItem.avg_cost;
          const removedValue = Math.abs(revDelta) * Number(line.unit_cost);
          newAvgCost = Math.max(0, (totalValueBefore - removedValue) / newStock);
        }

        db.prepare(
          `INSERT INTO transaction_details (
            transaction_id, item_id, po_item_id, quantity, input_quantity, input_unit,
            qty_delta, unit_cost, balance_after
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          revTxId,
          line.item_id,
          line.po_item_id,
          line.quantity,
          line.input_quantity,
          line.input_unit,
          revDelta,
          line.unit_cost,
          newStock
        );

        db.prepare(
          `UPDATE items SET
            current_stock = ?,
            avg_cost = ?,
            zero_stock_since = CASE WHEN ? = 0 THEN datetime('now') ELSE NULL END,
            updated_at = datetime('now')
           WHERE id = ?`
        ).run(newStock, newAvgCost, newStock, line.item_id);

        // BR-06: Jika membalik Barang Masuk dari PO, kembalikan qty_received PO
        if (line.po_item_id) {
          db.prepare(
            `UPDATE purchase_order_items
             SET qty_received = MAX(0, qty_received - ?)
             WHERE id = ?`
          ).run(line.quantity, line.po_item_id);
        }
      }

      // Hitung ulang status PO bila terkait PO (BR-06)
      if (targetTx.purchase_order_id) {
        recalculatePoStatus(db, Number(targetTx.purchase_order_id));
      }

      writeAuditLog(db, {
        userId: session.userId,
        userName: session.name,
        action: "TRANSACTION_VOID",
        entityType: "TRANSACTION",
        entityId: String(targetTx.transaction_number),
        oldValues: { status: "POSTED" },
        newValues: { status: "VOIDED", reversal_number: revNumber, reason },
        ipAddress: ip,
      });

      db.exec("COMMIT;");
      return NextResponse.json({
        success: true,
        transaction_id: revTxId,
        transaction_number: revNumber,
        message: `Transaksi ${targetTx.transaction_number} berhasil di-void dengan nomor reversal ${revNumber}.`,
      });
    }

    // =========================================================================
    // B. TRANSAKSI PEMOTONGAN KERTAS & MANAJEMEN SISA (CUTTING - FR-004 & BR-003)
    // =========================================================================
    if (type === "CUTTING") {
      const sourceItemId = Number(body.source_item_id);
      const qtyCut = Number(body.qty_cut);
      const spkNumber = String(body.reference_number || "").trim().toUpperCase();
      const requesterName = String(body.requester_name || "").trim();
      const targetSize = String(body.target_size || "").trim();
      const remnantLengthCm = Number(body.remnant_length_cm || 0);
      const remnantWidthCm = Number(body.remnant_width_cm || 0);
      const remnantQty = Number(body.remnant_qty || qtyCut);
      const notes = String(body.notes || "").trim();

      if (!sourceItemId || qtyCut <= 0 || !spkNumber) {
        throw new Error("SKU Kertas Utama, Jumlah Lembar Dipotong (> 0), dan Nomor Job/SPK wajib diisi.");
      }

      const sourceItem = db
        .prepare("SELECT * FROM items WHERE id = ? AND is_active = 1")
        .get(sourceItemId) as
        | {
            id: number;
            sku: string;
            name: string;
            current_stock: number;
            avg_cost: number;
            unit_id: number;
            paper_type: string | null;
            grammage: number | null;
          }
        | undefined;

      if (!sourceItem) {
        throw new Error("SKU Kertas Utama tidak ditemukan atau tidak aktif.");
      }

      if (!Number.isInteger(qtyCut)) {
        throw new Error("Jumlah lembar kertas yang dipotong harus berupa bilangan bulat.");
      }

      // BR-01: Cek stok kertas utama
      if (qtyCut > sourceItem.current_stock) {
        throw new Error(
          `BR-01: Stok kertas '${sourceItem.sku}' tidak mencukupi! Diminta: ${qtyCut} Lembar, Tersedia: ${sourceItem.current_stock} Lembar.`
        );
      }

      // BR-003: Validasi ukuran sisa potong kertas (>= 20 cm vs < 20 cm Waste)
      const minDimension = Math.min(remnantLengthCm, remnantWidthCm);
      const isWaste = minDimension < 20;

      let remnantItemId: number | null = null;
      let remnantSkuCode: string | null = null;

      if (!isWaste) {
        // Sisa >= 20 cm wajib masuk ke Kategori Sisa dengan SKU Turunan Spesifik
        if (remnantQty <= 0) {
          throw new Error("BR-003: Kuantitas lembar sisa potong (>= 20 cm) wajib lebih dari 0.");
        }

        const chosenRemnantId = body.remnant_item_id ? Number(body.remnant_item_id) : null;
        if (chosenRemnantId) {
          const existingRemnant = db
            .prepare("SELECT id, sku FROM items WHERE id = ?")
            .get(chosenRemnantId) as { id: number; sku: string } | undefined;
          if (!existingRemnant) {
            throw new Error("SKU Sisa yang dipilih tidak ditemukan.");
          }
          remnantItemId = existingRemnant.id;
          remnantSkuCode = existingRemnant.sku;
        } else {
          // Buat atau cari SKU Turunan otomatis: SISA-{TYPE}{GSM}-{W}X{L}
          const wInt = Math.round(Math.min(remnantLengthCm, remnantWidthCm));
          const lInt = Math.round(Math.max(remnantLengthCm, remnantWidthCm));
          const baseTag = sourceItem.sku
            .replace(/^KRT-/, "")
            .split("-")[0]
            .toUpperCase();
          const generatedSku = String(
            body.custom_remnant_sku || `SISA-${baseTag}-${wInt}X${lInt}`
          )
            .trim()
            .toUpperCase();

          const foundRemnant = db
            .prepare("SELECT id, sku FROM items WHERE lower(sku) = lower(?)")
            .get(generatedSku) as { id: number; sku: string } | undefined;

          if (foundRemnant) {
            remnantItemId = foundRemnant.id;
            remnantSkuCode = foundRemnant.sku;
          } else {
            const sisaCat = db
              .prepare("SELECT id FROM categories WHERE lower(name) = 'kategori sisa'")
              .get() as { id: number } | undefined;
            const catId = sisaCat ? sisaCat.id : 8;
            const remnantName = `Sisa Potong ${sourceItem.paper_type || sourceItem.name} ${
              sourceItem.grammage ? sourceItem.grammage + "g " : ""
            }Ukuran ${wInt}x${lInt} cm`;

            const newRemnant = db
              .prepare(
                `INSERT INTO items (
                  sku, name, category_id, unit_id, purchase_unit_id, conversion_factor,
                  current_stock, avg_cost, last_purchase_cost, min_stock, allow_decimal,
                  paper_type, grammage, length_cm, width_cm, is_remnant, parent_item_id, notes
                ) VALUES (?, ?, ?, ?, ?, 1, 0, ?, 0, 0, 0, ?, ?, ?, ?, 1, ?, ?)`
              )
              .run(
                generatedSku,
                remnantName,
                catId,
                sourceItem.unit_id,
                sourceItem.unit_id,
                Number((sourceItem.avg_cost * 0.2).toFixed(2)),
                sourceItem.paper_type,
                sourceItem.grammage,
                lInt,
                wInt,
                sourceItem.id,
                `SKU Turunan Sisa Potong otomatis dari ${sourceItem.sku} (SPK: ${spkNumber})`
              );
            remnantItemId = Number(newRemnant.lastInsertRowid);
            remnantSkuCode = generatedSku;
          }
        }
      }

      const docNo = generateDocNumber(db, "OUT", txDate);
      const cuttingMeta = {
        sourceSku: sourceItem.sku,
        sourceName: sourceItem.name,
        sourceQty: qtyCut,
        targetSize: targetSize || "Ukuran Cetak Produksi",
        remnantLengthCm,
        remnantWidthCm,
        isWaste,
        remnantSku: isWaste ? "WASTE (< 20 cm)" : remnantSkuCode,
        remnantQty: isWaste ? 0 : remnantQty,
      };

      const txInsert = db
        .prepare(
          `INSERT INTO transactions (
            transaction_number, type, transaction_date, reference_number, requester_name,
            notes, cutting_info_json, request_id, user_id
          ) VALUES (?, 'CUTTING', ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          docNo,
          txDate,
          spkNumber,
          requesterName || "Divisi Potong / Produksi",
          notes ||
            (isWaste
              ? `Pemotongan ${qtyCut} Lbr ${sourceItem.sku}. Sisa ${remnantWidthCm}x${remnantLengthCm} cm (< 20cm) dialokasikan sebagai Waste.`
              : `Pemotongan ${qtyCut} Lbr ${sourceItem.sku}. Sisa ${remnantWidthCm}x${remnantLengthCm} cm (>= 20cm) masuk ke ${remnantSkuCode} (+${remnantQty} Lbr).`),
          JSON.stringify(cuttingMeta),
          requestId,
          session.userId
        );

      const txId = Number(txInsert.lastInsertRowid);

      // 1. Kurangi stok Kertas Utama
      const newSourceStock = Number((sourceItem.current_stock - qtyCut).toFixed(3));
      db.prepare(
        `INSERT INTO transaction_details (
          transaction_id, item_id, quantity, input_quantity, input_unit,
          qty_delta, unit_cost, balance_after
        ) VALUES (?, ?, ?, ?, 'Lembar', ?, ?, ?)`
      ).run(txId, sourceItem.id, qtyCut, qtyCut, -qtyCut, sourceItem.avg_cost, newSourceStock);

      db.prepare(
        `UPDATE items SET current_stock = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(newSourceStock, sourceItem.id);

      // 2. Jika Sisa >= 20 cm, tambahkan stok ke SKU Turunan Kategori Sisa
      if (!isWaste && remnantItemId) {
        const remItem = db
          .prepare("SELECT current_stock, avg_cost FROM items WHERE id = ?")
          .get(remnantItemId) as { current_stock: number; avg_cost: number };
        const newRemStock = Number((remItem.current_stock + remnantQty).toFixed(3));
        const remUnitCost = Number((sourceItem.avg_cost * 0.2).toFixed(2));

        db.prepare(
          `INSERT INTO transaction_details (
            transaction_id, item_id, quantity, input_quantity, input_unit,
            qty_delta, unit_cost, balance_after
          ) VALUES (?, ?, ?, ?, 'Lembar', ?, ?, ?)`
        ).run(txId, remnantItemId, remnantQty, remnantQty, remnantQty, remUnitCost, newRemStock);

        db.prepare(
          `UPDATE items SET
            current_stock = ?,
            avg_cost = CASE WHEN avg_cost = 0 THEN ? ELSE avg_cost END,
            zero_stock_since = NULL,
            is_active = 1,
            updated_at = datetime('now')
           WHERE id = ?`
        ).run(newRemStock, remUnitCost, remnantItemId);
      }

      db.exec("COMMIT;");
      return NextResponse.json({
        success: true,
        transaction_id: txId,
        transaction_number: docNo,
        cutting_info: cuttingMeta,
        message: isWaste
          ? `Pemotongan kertas berhasil (${docNo}). Sisa ${remnantWidthCm}x${remnantLengthCm} cm (< 20 cm) otomatis dicatat sebagai Waste.`
          : `Pemotongan kertas berhasil (${docNo}). Sisa ${remnantWidthCm}x${remnantLengthCm} cm (>= 20 cm) otomatis menambah saldo SKU Sisa '${remnantSkuCode}' sebanyak ${remnantQty} Lembar.`,
      });
    }

    // =========================================================================
    // C. TRANSAKSI STANDAR: IN, OUT, ADJUSTMENT, OPENING
    // =========================================================================
    if (!["IN", "OUT", "ADJUSTMENT", "OPENING"].includes(type)) {
      throw new Error(`Tipe transaksi '${type}' tidak valid.`);
    }

    const rawLines = (body.items || []) as Array<{
      item_id: number;
      po_item_id?: number | null;
      input_quantity: number;
      use_purchase_unit?: boolean;
      direction?: "PLUS" | "MINUS"; // untuk ADJUSTMENT
      unit_cost?: number | null; // Harga per satuan input (atau satuan dasar)
    }>;

    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      throw new Error("Minimal harus ada 1 baris barang dalam transaksi.");
    }

    // Cek duplikasi barang dalam satu transaksi (FR-06/FR-07/Section 7.4)
    const seenItemIds = new Set<number>();
    for (const l of rawLines) {
      const iid = Number(l.item_id);
      if (!iid) throw new Error("Pilih barang pada setiap baris transaksi.");
      if (seenItemIds.has(iid)) {
        throw new Error(
          "FR-06/FR-07: Barang yang sama tidak boleh muncul dua kali dalam satu transaksi."
        );
      }
      seenItemIds.add(iid);
    }

    // Urutkan berdasarkan item_id untuk mencegah deadlock (BR-04)
    const sortedLines = [...rawLines].sort((a, b) => Number(a.item_id) - Number(b.item_id));

    let referenceNumber = String(body.reference_number || "").trim();
    const requesterName = body.requester_name ? String(body.requester_name).trim() : null;
    const supplierId = body.supplier_id ? Number(body.supplier_id) : null;
    const purchaseOrderId = body.purchase_order_id ? Number(body.purchase_order_id) : null;
    const reasonCode = body.reason_code ? String(body.reason_code).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;

    // Validasi Header Spesifik per Tipe
    if (type === "IN") {
      if (!supplierId) {
        throw new Error("FR-06: Supplier wajib dipilih untuk Transaksi Barang Masuk.");
      }
      if (!referenceNumber) {
        throw new Error("BR-13/FR-06: Nomor Nota / Surat Jalan Supplier wajib diisi.");
      }
      referenceNumber = referenceNumber.toUpperCase();
    } else if (type === "OUT") {
      if (!referenceNumber) {
        throw new Error("BR-13/FR-07: Nomor Job / SPK wajib diisi untuk Transaksi Barang Keluar.");
      }
      // BR-13: Nomor SPK dinormalisasi (trim, huruf besar)
      referenceNumber = referenceNumber.toUpperCase();
    } else if (type === "ADJUSTMENT") {
      if (!reasonCode) {
        throw new Error(
          "BR-07/FR-13: Alasan koreksi wajib dipilih (Selisih Opname, Rusak, Hilang, Sisa Produksi Kembali, Salah Catat, Lainnya)."
        );
      }
      if (!notes || notes.length < 5) {
        throw new Error("BR-07: Catatan penjelasan koreksi stok wajib diisi.");
      }
    } else if (type === "OPENING") {
      // FR-11: Cek tanggal cut-over
      const cutOverSetting = db
        .prepare("SELECT value FROM settings WHERE key = 'cut_over_date'")
        .get() as { value: string } | undefined;
      const todayYmd = new Date().toISOString().slice(0, 10);
      if (cutOverSetting && todayYmd > cutOverSetting.value) {
        throw new Error(
          `FR-11: Fitur Opening Balance telah dikunci karena melewati tanggal cut-over (${cutOverSetting.value}). Gunakan Koreksi Stok.`
        );
      }
      referenceNumber = referenceNumber || `OPENING-${txDate}`;
    }

    // Jika IN terkait PO, validasi PO
    let tolerancePercent = 0;
    if (type === "IN" && purchaseOrderId) {
      const po = db
        .prepare("SELECT * FROM purchase_orders WHERE id = ?")
        .get(purchaseOrderId) as
        | { id: number; po_number: string; supplier_id: number; status: string }
        | undefined;
      if (!po) throw new Error("Purchase Order tidak ditemukan.");
      if (!["SENT", "PARTIALLY_RECEIVED"].includes(po.status)) {
        throw new Error(
          `FR-06: Hanya PO berstatus Dikirim atau Diterima Sebagian yang dapat diterima (Status PO saat ini: ${po.status}).`
        );
      }
      const tolRow = db
        .prepare("SELECT value FROM settings WHERE key = 'po_over_receipt_tolerance_percent'")
        .get() as { value: string } | undefined;
      tolerancePercent = tolRow ? parseFloat(tolRow.value) || 0 : 0;
    }

    // Persiapkan kalkulasi baris
    const preparedDetails: Array<{
      itemId: number;
      sku: string;
      poItemId: number | null;
      baseQty: number;
      inputQty: number;
      inputUnitName: string;
      inputUnitPrice: number;
      qtyDelta: number;
      baseUnitCost: number;
      newStock: number;
      newAvgCost: number;
    }> = [];

    for (const line of sortedLines) {
      const itemId = Number(line.item_id);
      const item = db
        .prepare(
          `SELECT i.*, u.name as unit_name, pu.name as purchase_unit_name
           FROM items i
           JOIN units u ON u.id = i.unit_id
           LEFT JOIN units pu ON pu.id = i.purchase_unit_id
           WHERE i.id = ?`
        )
        .get(itemId) as
        | {
            id: number;
            sku: string;
            name: string;
            current_stock: number;
            avg_cost: number;
            last_purchase_cost: number;
            allow_decimal: number;
            conversion_factor: number;
            unit_name: string;
            purchase_unit_name: string | null;
            is_active: number;
          }
        | undefined;

      if (!item || !item.is_active) {
        throw new Error(`BR-09: Barang tidak ditemukan atau berstatus nonaktif.`);
      }

      const inputQty = Number(line.input_quantity);
      if (isNaN(inputQty) || inputQty <= 0) {
        throw new Error(`Kuantitas untuk '${item.sku} - ${item.name}' harus lebih dari 0.`);
      }

      const usePurchaseUnit = Boolean(line.use_purchase_unit && item.conversion_factor > 1);
      const factor = usePurchaseUnit ? Number(item.conversion_factor) : 1;
      const baseQty = Number((inputQty * factor).toFixed(3));
      const inputUnitName = usePurchaseUnit
        ? item.purchase_unit_name || item.unit_name
        : item.unit_name;

      // Validasi allow_decimal (Bagian 2 PRD v2.0)
      if (!item.allow_decimal && !Number.isInteger(baseQty)) {
        throw new Error(
          `Barang '${item.sku} (${item.unit_name})' tidak mengizinkan kuantitas pecahan (${baseQty}).`
        );
      }

      let qtyDelta = baseQty;
      if (type === "OUT") {
        qtyDelta = -baseQty;
      } else if (type === "ADJUSTMENT") {
        qtyDelta = line.direction === "MINUS" ? -baseQty : baseQty;
      }

      const projectedStock = Number((Number(item.current_stock) + qtyDelta).toFixed(3));

      // BR-01: Blokir Mutlak Stok Minus!
      if (projectedStock < -0.0001) {
        throw new Error(
          `BR-01 (Blokir Stok Minus): Stok '${item.sku} - ${item.name}' tidak mencukupi! Diminta keluar: ${Math.abs(
            qtyDelta
          )} ${item.unit_name}, Stok tersedia: ${item.current_stock} ${item.unit_name}.`
        );
      }

      // FR-11: Opening balance hanya boleh sekali per barang
      if (type === "OPENING") {
        const hasOpening = db
          .prepare(
            `SELECT t.transaction_number
             FROM transaction_details td
             JOIN transactions t ON t.id = td.transaction_id
             LEFT JOIN transactions rev ON rev.reverses_transaction_id = t.id
             WHERE td.item_id = ? AND t.type = 'OPENING' AND rev.id IS NULL
             LIMIT 1`
          )
          .get(itemId) as { transaction_number: string } | undefined;
        if (hasOpening) {
          throw new Error(
            `FR-11: Barang '${item.sku}' sudah memiliki Opening Balance (${hasOpening.transaction_number}). Gunakan Koreksi Stok untuk perubahan selanjutnya.`
          );
        }
      }

      // Validasi Penerimaan PO & Toleransi (BR-11 & FR-09)
      let poItemId: number | null = line.po_item_id ? Number(line.po_item_id) : null;
      let poUnitPriceBase: number | null = null;

      if (type === "IN" && purchaseOrderId) {
        const poItem = db
          .prepare(
            "SELECT * FROM purchase_order_items WHERE purchase_order_id = ? AND item_id = ?"
          )
          .get(purchaseOrderId, itemId) as
          | {
              id: number;
              qty_ordered: number;
              qty_received: number;
              unit_price: number;
              conversion_factor: number;
            }
          | undefined;

        if (!poItem) {
          throw new Error(`Barang '${item.sku}' tidak terdaftar pada PO tersebut.`);
        }
        poItemId = poItem.id;
        const maxAllowed = Number(
          (poItem.qty_ordered * (1 + tolerancePercent / 100)).toFixed(3)
        );
        const cumulativeReceived = Number((poItem.qty_received + baseQty).toFixed(3));
        if (cumulativeReceived > maxAllowed + 0.0001) {
          const remaining = Math.max(0, poItem.qty_ordered - poItem.qty_received);
          throw new Error(
            `BR-11: Kuantitas terima '${item.sku}' (${baseQty} ${item.unit_name}) melebihi sisa PO (${remaining} ${item.unit_name}, toleransi ${tolerancePercent}%).`
          );
        }
        poUnitPriceBase =
          poItem.conversion_factor > 0
            ? poItem.unit_price / poItem.conversion_factor
            : poItem.unit_price;
      }

      // BR-14 & BR-005: Penentuan Harga Satuan & Moving Average Cost
      let baseUnitCost = Number(item.avg_cost);
      let inputUnitPrice = Number(line.unit_cost ?? 0);

      if (type === "IN" || type === "OPENING") {
        if (line.unit_cost !== undefined && line.unit_cost !== null && Number(line.unit_cost) > 0) {
          inputUnitPrice = Number(line.unit_cost);
          baseUnitCost = Number((inputUnitPrice / factor).toFixed(4));
        } else if (poUnitPriceBase !== null && poUnitPriceBase > 0) {
          baseUnitCost = Number(poUnitPriceBase.toFixed(4));
          inputUnitPrice = Number((baseUnitCost * factor).toFixed(2));
        } else if (item.avg_cost > 0) {
          baseUnitCost = Number(item.avg_cost);
          inputUnitPrice = Number((baseUnitCost * factor).toFixed(2));
        } else {
          throw new Error(
            `BR-005/BR-14: Harga Beli Satuan untuk '${item.sku}' wajib diisi (> 0).`
          );
        }
      }

      // Hitung Moving Average Cost baru (BR-14)
      let newAvgCost = Number(item.avg_cost);
      if ((type === "IN" || type === "OPENING") && projectedStock > 0) {
        const oldVal = Number(item.current_stock) * Number(item.avg_cost);
        const addedVal = baseQty * baseUnitCost;
        newAvgCost = Number(((oldVal + addedVal) / projectedStock).toFixed(4));
      }

      preparedDetails.push({
        itemId,
        sku: item.sku,
        poItemId,
        baseQty,
        inputQty,
        inputUnitName,
        inputUnitPrice,
        qtyDelta,
        baseUnitCost,
        newStock: Math.max(0, projectedStock),
        newAvgCost,
      });
    }

    // Step 6: Buat Nomor Dokumen Otomatis (BR-12)
    const docPrefixMap: Record<string, string> = {
      IN: "IN",
      OUT: "OUT",
      ADJUSTMENT: "ADJ",
      OPENING: "OPN",
    };
    const txNumber = generateDocNumber(db, docPrefixMap[type], txDate);

    // Step 7: Insert Header Transaksi
    const txRes = db
      .prepare(
        `INSERT INTO transactions (
          transaction_number, type, transaction_date, reference_number, requester_name,
          supplier_id, purchase_order_id, reason_code, notes, request_id, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        txNumber,
        type,
        txDate,
        referenceNumber || null,
        requesterName,
        supplierId,
        purchaseOrderId,
        reasonCode,
        notes,
        requestId,
        session.userId
      );

    const transactionId = Number(txRes.lastInsertRowid);

    // Step 8: Insert Detail, Update Saldo & Moving Average, Update PO & Riwayat Harga
    for (const d of preparedDetails) {
      db.prepare(
        `INSERT INTO transaction_details (
          transaction_id, item_id, po_item_id, quantity, input_quantity, input_unit,
          qty_delta, unit_cost, balance_after
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        transactionId,
        d.itemId,
        d.poItemId,
        d.baseQty,
        d.inputQty,
        d.inputUnitName,
        d.qtyDelta,
        d.baseUnitCost,
        d.newStock
      );

      db.prepare(
        `UPDATE items SET
          current_stock = ?,
          avg_cost = ?,
          last_purchase_cost = CASE WHEN ? IN ('IN', 'OPENING') THEN ? ELSE last_purchase_cost END,
          zero_stock_since = CASE WHEN ? = 0 THEN datetime('now') ELSE NULL END,
          updated_at = datetime('now')
         WHERE id = ?`
      ).run(d.newStock, d.newAvgCost, type, d.baseUnitCost, d.newStock, d.itemId);

      if (type === "IN" && d.poItemId) {
        db.prepare(
          `UPDATE purchase_order_items
           SET qty_received = qty_received + ?
           WHERE id = ?`
        ).run(d.baseQty, d.poItemId);
      }

      // Simpan ke Riwayat Fluktuasi Harga Beli Supplier (FR-002 & Bagian 8.3)
      if (type === "IN" && supplierId && d.inputUnitPrice > 0) {
        db.prepare(
          `INSERT INTO supplier_price_history (
            item_id, supplier_id, transaction_id, purchase_order_id,
            reference_number, input_unit, input_unit_price, base_unit_cost, transaction_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          d.itemId,
          supplierId,
          transactionId,
          purchaseOrderId,
          referenceNumber,
          d.inputUnitName,
          d.inputUnitPrice,
          d.baseUnitCost,
          txDate
        );
      }
    }

    if (type === "IN" && purchaseOrderId) {
      recalculatePoStatus(db, purchaseOrderId);
    }

    // Step 10: Tulis Audit Log
    writeAuditLog(db, {
      userId: session.userId,
      userName: session.name,
      action: `TRANSACTION_${type}`,
      entityType: "TRANSACTION",
      entityId: txNumber,
      newValues: {
        transaction_number: txNumber,
        type,
        transaction_date: txDate,
        reference_number: referenceNumber,
        item_count: preparedDetails.length,
        reason_code: reasonCode,
      },
      ipAddress: ip,
    });

    // Step 9: Commit Transaction
    db.exec("COMMIT;");

    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      transaction_number: txNumber,
      message: `Transaksi ${txNumber} berhasil disimpan.`,
    });
  } catch (err: unknown) {
    db.exec("ROLLBACK;");
    const message = err instanceof Error ? err.message : "Gagal menyimpan transaksi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function recalculatePoStatus(db: ReturnType<typeof getDb>, poId: number) {
  const poItems = db
    .prepare("SELECT qty_ordered, qty_received FROM purchase_order_items WHERE purchase_order_id = ?")
    .all(poId) as Array<{ qty_ordered: number; qty_received: number }>;

  const totalReceived = poItems.reduce((acc, r) => acc + Number(r.qty_received), 0);
  const allFulfilled = poItems.every((r) => Number(r.qty_received) >= Number(r.qty_ordered) - 0.0001);

  let nextStatus = "SENT";
  if (allFulfilled && poItems.length > 0) {
    nextStatus = "FULLY_RECEIVED";
  } else if (totalReceived > 0) {
    nextStatus = "PARTIALLY_RECEIVED";
  }

  db.prepare(
    "UPDATE purchase_orders SET status = ?, updated_at = datetime('now') WHERE id = ? AND status NOT IN ('CLOSED', 'CANCELLED')"
  ).run(nextStatus, poId);
}

