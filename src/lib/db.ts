import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { hashPassword } from "./crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "gudang.db");

declare global {
  // eslint-disable-next-line no-var
  var __gudangDb: DatabaseSync | undefined;
}

export function getDb(): DatabaseSync {
  if (!global.__gudangDb) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("PRAGMA busy_timeout = 5000;");
    initSchema(db);
    seedIfEmpty(db);
    global.__gudangDb = db;
  }
  return global.__gudangDb;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'KEPALA_GUDANG', 'PETUGAS')),
      is_active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      failed_login_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      code_prefix TEXT NOT NULL DEFAULT 'ITM',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      payment_terms TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      unit_id INTEGER NOT NULL REFERENCES units(id),
      purchase_unit_id INTEGER REFERENCES units(id),
      conversion_factor REAL NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),
      current_stock REAL NOT NULL DEFAULT 0 CHECK (current_stock >= -0.0001),
      avg_cost REAL NOT NULL DEFAULT 0,
      last_purchase_cost REAL NOT NULL DEFAULT 0,
      min_stock REAL NOT NULL DEFAULT 0,
      allow_decimal INTEGER NOT NULL DEFAULT 0,
      paper_type TEXT,
      grammage INTEGER,
      length_cm REAL,
      width_cm REAL,
      ink_color TEXT,
      is_remnant INTEGER NOT NULL DEFAULT 0,
      parent_item_id INTEGER REFERENCES items(id),
      zero_stock_since TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS document_sequences (
      doc_type TEXT NOT NULL,
      period TEXT NOT NULL,
      last_number INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (doc_type, period)
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT NOT NULL UNIQUE,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      po_date TEXT NOT NULL,
      expected_date TEXT,
      status TEXT NOT NULL CHECK (status IN ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED', 'CANCELLED')),
      ppn_percent REAL NOT NULL DEFAULT 0,
      discount_total REAL NOT NULL DEFAULT 0,
      other_cost REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PARTIAL', 'PAID')),
      paid_amount REAL NOT NULL DEFAULT 0,
      due_date TEXT,
      notes TEXT,
      status_reason TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      sent_at TEXT,
      closed_at TEXT,
      cancelled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id),
      description TEXT,
      input_qty REAL NOT NULL CHECK (input_qty > 0),
      input_unit TEXT NOT NULL,
      conversion_factor REAL NOT NULL DEFAULT 1,
      qty_ordered REAL NOT NULL CHECK (qty_ordered > 0),
      qty_received REAL NOT NULL DEFAULT 0 CHECK (qty_received >= 0),
      unit_price REAL NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
      discount_amount REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      UNIQUE (purchase_order_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS po_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      payment_method TEXT NOT NULL DEFAULT 'TRANSFER',
      reference_number TEXT,
      notes TEXT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_number TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT', 'OPENING', 'REVERSAL', 'CUTTING')),
      transaction_date TEXT NOT NULL,
      reference_number TEXT,
      requester_name TEXT,
      supplier_id INTEGER REFERENCES suppliers(id),
      purchase_order_id INTEGER REFERENCES purchase_orders(id),
      reverses_transaction_id INTEGER UNIQUE REFERENCES transactions(id),
      reason_code TEXT,
      notes TEXT,
      cutting_info_json TEXT,
      request_id TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transaction_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id),
      item_id INTEGER NOT NULL REFERENCES items(id),
      po_item_id INTEGER REFERENCES purchase_order_items(id),
      quantity REAL NOT NULL CHECK (quantity > 0),
      input_quantity REAL,
      input_unit TEXT,
      qty_delta REAL NOT NULL,
      unit_cost REAL NOT NULL DEFAULT 0,
      balance_after REAL NOT NULL,
      UNIQUE (transaction_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS supplier_price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id),
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      transaction_id INTEGER REFERENCES transactions(id),
      purchase_order_id INTEGER REFERENCES purchase_orders(id),
      reference_number TEXT,
      input_unit TEXT NOT NULL,
      input_unit_price REAL NOT NULL,
      base_unit_cost REAL NOT NULL,
      transaction_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      count_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('COUNTING', 'APPROVED', 'CANCELLED')),
      category_id INTEGER REFERENCES categories(id),
      snapshot_at TEXT NOT NULL,
      started_by INTEGER NOT NULL REFERENCES users(id),
      approved_by INTEGER REFERENCES users(id),
      approved_at TEXT,
      adjustment_transaction_id INTEGER REFERENCES transactions(id),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_count_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_count_id INTEGER NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id),
      system_qty_snapshot REAL NOT NULL,
      counted_qty REAL,
      notes TEXT,
      UNIQUE (stock_count_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indeks wajib sesuai PRD v2.0 Bagian 7.8
    CREATE INDEX IF NOT EXISTS idx_items_category_active ON items(category_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_tx_details_item_id ON transaction_details(item_id, id);
    CREATE INDEX IF NOT EXISTS idx_tx_details_tx_id ON transaction_details(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_tx_type_date ON transactions(type, transaction_date);
    CREATE INDEX IF NOT EXISTS idx_tx_ref ON transactions(reference_number);
    CREATE INDEX IF NOT EXISTS idx_tx_supplier_ref ON transactions(supplier_id, reference_number);
    CREATE INDEX IF NOT EXISTS idx_tx_po ON transactions(purchase_order_id);
    CREATE INDEX IF NOT EXISTS idx_po_supplier_status ON purchase_orders(supplier_id, status);
    CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders(po_date);
    CREATE INDEX IF NOT EXISTS idx_audit_occurred ON audit_logs(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, occurred_at);

    -- Trigger Append-Only (BR-02 & NFR-05): Larang UPDATE dan DELETE pada transactions & transaction_details
    CREATE TRIGGER IF NOT EXISTS trg_transactions_no_update
    BEFORE UPDATE ON transactions
    BEGIN
      SELECT RAISE(ABORT, 'BR-02/NFR-05: Transaksi bersifat append-only dan tidak boleh diubah.');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_transactions_no_delete
    BEFORE DELETE ON transactions
    BEGIN
      SELECT RAISE(ABORT, 'BR-02/NFR-05: Transaksi bersifat append-only dan tidak boleh dihapus.');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_tx_details_no_update
    BEFORE UPDATE ON transaction_details
    BEGIN
      SELECT RAISE(ABORT, 'BR-02/NFR-05: Detail transaksi bersifat append-only dan tidak boleh diubah.');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_tx_details_no_delete
    BEFORE DELETE ON transaction_details
    BEGIN
      SELECT RAISE(ABORT, 'BR-02/NFR-05: Detail transaksi bersifat append-only dan tidak boleh dihapus.');
    END;
  `);
}

export function generateDocNumber(db: DatabaseSync, docType: string, dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  const month = String((isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth()) + 1).padStart(2, "0");
  const period = `${year}${month}`;

  const existing = db
    .prepare("SELECT last_number FROM document_sequences WHERE doc_type = ? AND period = ?")
    .get(docType, period) as { last_number: number } | undefined;

  let nextNum = 1;
  if (existing) {
    nextNum = existing.last_number + 1;
    db.prepare("UPDATE document_sequences SET last_number = ? WHERE doc_type = ? AND period = ?").run(
      nextNum,
      docType,
      period
    );
  } else {
    db.prepare("INSERT INTO document_sequences (doc_type, period, last_number) VALUES (?, ?, ?)").run(
      docType,
      period,
      nextNum
    );
  }

  return `${docType}/${year}/${month}/${String(nextNum).padStart(4, "0")}`;
}

export function writeAuditLog(
  db: DatabaseSync,
  params: {
    userId?: number | null;
    userName?: string | null;
    action: string;
    entityType: string;
    entityId?: string | number | null;
    oldValues?: unknown;
    newValues?: unknown;
    ipAddress?: string | null;
  }
) {
  db.prepare(
    `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, old_values, new_values, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    params.userId ?? null,
    params.userName ?? "System",
    params.action,
    params.entityType,
    params.entityId != null ? String(params.entityId) : null,
    params.oldValues !== undefined ? JSON.stringify(params.oldValues) : null,
    params.newValues !== undefined ? JSON.stringify(params.newValues) : null,
    params.ipAddress ?? "127.0.0.1"
  );
}

function seedIfEmpty(db: DatabaseSync) {
  const userCount = (db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number }).cnt;
  if (userCount > 0) return;

  db.exec("BEGIN IMMEDIATE TRANSACTION;");
  try {
    // 1. Seed Users (3 Roles)
    const insertUser = db.prepare(
      `INSERT INTO users (name, email, password_hash, role, is_active, must_change_password)
       VALUES (?, ?, ?, ?, 1, 0)`
    );
    insertUser.run("Administrator Sistem", "admin@percetakan.co.id", hashPassword("AdminGudang123!"), "ADMIN");
    insertUser.run("Budi Santoso (Kepala Gudang)", "kepala@percetakan.co.id", hashPassword("KepalaGudang123!"), "KEPALA_GUDANG");
    insertUser.run("Bruder Andi (Petugas Gudang)", "petugas@percetakan.co.id", hashPassword("PetugasGudang123!"), "PETUGAS");

    // 2. Seed Settings
    const insertSetting = db.prepare(
      `INSERT INTO settings (key, value, description) VALUES (?, ?, ?)`
    );
    insertSetting.run("max_backdate_petugas", "2", "Batas maksimal mundur tanggal transaksi untuk Petugas (hari)");
    insertSetting.run("max_backdate_manager", "30", "Batas maksimal mundur tanggal transaksi untuk Kepala Gudang & Admin (hari)");
    insertSetting.run("po_over_receipt_tolerance_percent", "0", "Toleransi kelebihan penerimaan barang PO (%)");
    insertSetting.run("session_timeout_minutes", "30", "Timeout sesi tidak aktif (menit)");
    insertSetting.run("cut_over_date", "2027-01-31", "Tanggal cut-over penguncian menu Opening Balance");
    insertSetting.run("company_name", "PT Grafika Nusantara Percetakan", "Nama perusahaan pada kop surat PO & laporan");
    insertSetting.run("company_address", "Jl. Industri Grafika Raya No. 88, Surabaya", "Alamat perusahaan pada kop surat PO");
    insertSetting.run("company_phone", "(031) 8492-7700 | purchasing@percetakan.co.id", "Kontak perusahaan pada kop surat PO");

    // 3. Seed Categories (7 Bahan Percetakan + Kategori Sisa)
    const insertCat = db.prepare("INSERT INTO categories (name, code_prefix) VALUES (?, ?)");
    insertCat.run("Kertas", "KRT");
    insertCat.run("Tinta", "TNT");
    insertCat.run("Plate Cetak", "PLT");
    insertCat.run("Bahan Baku Penolong", "BBP");
    insertCat.run("Bahan Baku Finishing", "FIN");
    insertCat.run("Sparepart Mesin", "SPR");
    insertCat.run("Proses Luar (Pihak Ketiga)", "PRL");
    insertCat.run("Kategori Sisa", "SISA");

    // 4. Seed Units
    const insertUnit = db.prepare("INSERT INTO units (name) VALUES (?)");
    const unitNames = ["Lembar", "Rim", "Kg", "Gram", "Kaleng", "Botol", "Pcs", "Roll", "Set", "Liter"];
    for (const u of unitNames) insertUnit.run(u);

    // Map unit & category IDs
    const cats = Object.fromEntries(
      (db.prepare("SELECT id, name FROM categories").all() as { id: number; name: string }[]).map((c) => [c.name, c.id])
    );
    const units = Object.fromEntries(
      (db.prepare("SELECT id, name FROM units").all() as { id: number; name: string }[]).map((u) => [u.name, u.id])
    );

    // 5. Seed Suppliers
    const insertSupplier = db.prepare(
      `INSERT INTO suppliers (code, name, contact_name, phone, email, address, payment_terms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insertSupplier.run(
      "SUP-0001",
      "PT Kertas Jaya Abadi",
      "Bpk. Hendra Wijaya",
      "0812-3100-4455",
      "sales@kertasjaya.co.id",
      "Jl. Margomulyo Indah Blok A-12, Surabaya",
      "NET 30 Hari"
    );
    insertSupplier.run(
      "SUP-0002",
      "CV Tinta Prima Grafika",
      "Ibu Sari Lestari",
      "0813-5700-8899",
      "order@tintaprima.com",
      "Jl. Rungkut Industri III No. 45, Surabaya",
      "NET 14 Hari"
    );
    insertSupplier.run(
      "SUP-0003",
      "PT Indo Plate & Chemical",
      "Bpk. Antonius Halim",
      "0811-320-9911",
      "cs@indoplate.co.id",
      "Kawasan Industri Jababeka Kav. 19, Cikarang",
      "NET 30 Hari"
    );
    insertSupplier.run(
      "SUP-0004",
      "UD Teknik Mesin & Sparepart Cetak",
      "Bpk. Rudi Hartono",
      "0857-3011-2233",
      "ruditeknik@gmail.com",
      "Jl. Semarang No. 104, Surabaya",
      "COD / Tunai"
    );

    // 6. Seed Items
    const insertItem = db.prepare(`
      INSERT INTO items (
        sku, name, category_id, unit_id, purchase_unit_id, conversion_factor,
        current_stock, avg_cost, last_purchase_cost, min_stock, allow_decimal,
        paper_type, grammage, length_cm, width_cm, ink_color, is_remnant, parent_item_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Kertas (Satuan Dasar: Lembar, Satuan Beli: Rim = 500 Lembar sesuai BR-001)
    insertItem.run(
      "KRT-AP150-79X109",
      "Kertas Art Paper 150 gsm Plano (79x109 cm)",
      cats["Kertas"],
      units["Lembar"],
      units["Rim"],
      500,
      2500,
      0,
      "Art Paper",
      150,
      109,
      79,
      null,
      0,
      null,
      "1 Rim = 500 Lembar. Kertas brosur & majalah utama."
    );
    insertItem.run(
      "KRT-AC210-79X109",
      "Kertas Art Carton 210 gsm Plano (79x109 cm)",
      cats["Kertas"],
      units["Lembar"],
      units["Rim"],
      500,
      1500,
      0,
      "Art Carton",
      210,
      109,
      79,
      null,
      0,
      null,
      "1 Rim = 500 Lembar. Kertas cover & packaging."
    );
    insertItem.run(
      "KRT-HVS80-65X100",
      "Kertas HVS Putih 80 gsm Plano (65x100 cm)",
      cats["Kertas"],
      units["Lembar"],
      units["Rim"],
      500,
      5000,
      0,
      "HVS",
      80,
      100,
      65,
      null,
      0,
      null,
      "1 Rim = 500 Lembar. Kertas buku & form."
    );
    insertItem.run(
      "KRT-IVR260-79X109",
      "Kertas Ivory 260 gsm Plano (79x109 cm)",
      cats["Kertas"],
      units["Lembar"],
      units["Rim"],
      500,
      1500,
      0,
      "Ivory",
      260,
      109,
      79,
      null,
      0,
      null,
      "1 Rim = 500 Lembar. Kertas kemasan box makanan/kosmetik."
    );

    // Tinta (Satuan Dasar: Kg, Satuan Beli: Kaleng = 5 Kg sesuai BR-002)
    insertItem.run(
      "TNT-CMYK-CYAN",
      "Tinta Offset Process Cyan High Gloss (5 Kg/Kaleng)",
      cats["Tinta"],
      units["Kg"],
      units["Kaleng"],
      5,
      10,
      1,
      null,
      null,
      null,
      null,
      "Process Cyan",
      0,
      null,
      "Kemasan 1 Kaleng = 5 Kg bersih."
    );
    insertItem.run(
      "TNT-CMYK-MAGENTA",
      "Tinta Offset Process Magenta High Gloss (5 Kg/Kaleng)",
      cats["Tinta"],
      units["Kg"],
      units["Kaleng"],
      5,
      10,
      1,
      null,
      null,
      null,
      null,
      "Process Magenta",
      0,
      null,
      "Kemasan 1 Kaleng = 5 Kg bersih."
    );
    insertItem.run(
      "TNT-CMYK-YELLOW",
      "Tinta Offset Process Yellow High Gloss (5 Kg/Kaleng)",
      cats["Tinta"],
      units["Kg"],
      units["Kaleng"],
      5,
      10,
      1,
      null,
      null,
      null,
      null,
      "Process Yellow",
      0,
      null,
      "Kemasan 1 Kaleng = 5 Kg bersih."
    );
    insertItem.run(
      "TNT-CMYK-BLACK",
      "Tinta Offset Process Black Super Dense (5 Kg/Kaleng)",
      cats["Tinta"],
      units["Kg"],
      units["Kaleng"],
      5,
      15,
      1,
      null,
      null,
      null,
      null,
      "Process Black",
      0,
      null,
      "Kemasan 1 Kaleng = 5 Kg bersih."
    );

    // Plate, Bahan Penolong, Finishing, Sparepart
    insertItem.run(
      "PLT-CTP-SM74",
      "Plate CTP Thermal Heidelberg SM74 (605x745 mm)",
      cats["Plate Cetak"],
      units["Pcs"],
      units["Pcs"],
      1,
      50,
      0,
      null,
      null,
      74.5,
      60.5,
      null,
      0,
      null,
      "Pelat cetak offset mesin SM74 tanpa potong."
    );
    insertItem.run(
      "BBP-FOUNT-01",
      "Fountain Solution Offset Concentrate",
      cats["Bahan Baku Penolong"],
      units["Liter"],
      units["Liter"],
      1,
      20,
      1,
      null,
      null,
      null,
      null,
      null,
      0,
      null,
      "Cairan pembasah air mesin cetak offset."
    );
    insertItem.run(
      "FIN-LAM-GLOSS60",
      "Plastik Laminasi Thermal Glossy 60 cm x 3000 m",
      cats["Bahan Baku Finishing"],
      units["Roll"],
      units["Roll"],
      1,
      5,
      0,
      null,
      null,
      null,
      60,
      null,
      0,
      null,
      "Roll laminasi finishing cover."
    );
    insertItem.run(
      "SPR-BLANKET-SM74",
      "Rubber Blanket Offset SM74 4-Ply Compressible",
      cats["Sparepart Mesin"],
      units["Pcs"],
      units["Pcs"],
      1,
      4,
      0,
      null,
      null,
      null,
      null,
      null,
      0,
      null,
      "Sparepart perawatan silinder blanket mesin cetak."
    );

    // SKU Turunan Kategori Sisa (FR-004 & BR-003: >= 20 cm)
    insertItem.run(
      "SISA-AP150-35X50",
      "Sisa Potong Art Paper 150g Ukuran 35x50 cm",
      cats["Kategori Sisa"],
      units["Lembar"],
      units["Lembar"],
      1,
      0,
      0,
      "Art Paper",
      150,
      50,
      35,
      null,
      1,
      1,
      "SKU Turunan Kategori Sisa (>= 20 cm) dari KRT-AP150-79X109"
    );

    // 7. Seed Initial OPENING Balance Transaction (OPN/2026/10/0001)
    const opnNo = generateDocNumber(db, "OPN", "2026-10-01");
    const opnRes = db
      .prepare(
        `INSERT INTO transactions (transaction_number, type, transaction_date, reference_number, notes, request_id, user_id)
         VALUES (?, 'OPENING', '2026-10-01', 'SALDO-AWAL-OKT26', 'Saldo awal cut-over buku manual ke sistem', ?, 1)`
      )
      .run(opnNo, crypto.randomUUID());
    const opnTxId = Number(opnRes.lastInsertRowid);

    const openingData: Array<{ sku: string; qty: number; inputQty: number; inputUnit: string; costPerBase: number }> = [
      { sku: "KRT-AP150-79X109", qty: 4000, inputQty: 8, inputUnit: "Rim", costPerBase: 520 }, // Rp 260.000/Rim
      { sku: "KRT-AC210-79X109", qty: 1000, inputQty: 2, inputUnit: "Rim", costPerBase: 780 }, // Di bawah min_stock (1500) -> muncul di alert!
      { sku: "KRT-HVS80-65X100", qty: 6000, inputQty: 12, inputUnit: "Rim", costPerBase: 310 },
      { sku: "KRT-IVR260-79X109", qty: 1000, inputQty: 2, inputUnit: "Rim", costPerBase: 950 }, // Di bawah min_stock (1500) -> muncul di alert!
      { sku: "TNT-CMYK-CYAN", qty: 15, inputQty: 3, inputUnit: "Kaleng", costPerBase: 95000 },
      { sku: "TNT-CMYK-MAGENTA", qty: 8, inputQty: 1.6, inputUnit: "Kaleng", costPerBase: 98000 }, // Di bawah min_stock (10) -> alert!
      { sku: "TNT-CMYK-YELLOW", qty: 15, inputQty: 3, inputUnit: "Kaleng", costPerBase: 92000 },
      { sku: "TNT-CMYK-BLACK", qty: 20, inputQty: 4, inputUnit: "Kaleng", costPerBase: 85000 },
      { sku: "PLT-CTP-SM74", qty: 40, inputQty: 40, inputUnit: "Pcs", costPerBase: 42000 }, // Di bawah min_stock (50) -> alert!
      { sku: "BBP-FOUNT-01", qty: 25, inputQty: 25, inputUnit: "Liter", costPerBase: 65000 },
      { sku: "FIN-LAM-GLOSS60", qty: 6, inputQty: 6, inputUnit: "Roll", costPerBase: 850000 },
      { sku: "SPR-BLANKET-SM74", qty: 3, inputQty: 3, inputUnit: "Pcs", costPerBase: 1250000 }, // Di bawah min_stock (4) -> alert!
    ];

    for (const row of openingData) {
      const item = db.prepare("SELECT id FROM items WHERE sku = ?").get(row.sku) as { id: number };
      db.prepare(
        `INSERT INTO transaction_details (transaction_id, item_id, quantity, input_quantity, input_unit, qty_delta, unit_cost, balance_after)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(opnTxId, item.id, row.qty, row.inputQty, row.inputUnit, row.qty, row.costPerBase, row.qty);

      db.prepare(
        `UPDATE items SET current_stock = ?, avg_cost = ?, last_purchase_cost = ? WHERE id = ?`
      ).run(row.qty, row.costPerBase, row.costPerBase, item.id);
    }

    // 8. Seed Sample POs + Inbound Receipt + Price Fluctuation History
    // PO 1: Sudah Diterima Penuh (Oktober)
    const po1No = generateDocNumber(db, "PO", "2026-10-15");
    const po1Res = db
      .prepare(
        `INSERT INTO purchase_orders (
          po_number, supplier_id, po_date, expected_date, status, ppn_percent,
          subtotal, tax_amount, total_amount, payment_status, paid_amount, due_date, notes, created_by, sent_at
        ) VALUES (?, 1, '2026-10-15', '2026-10-18', 'FULLY_RECEIVED', 11, 2700000, 297000, 2997000, 'PAID', 2997000, '2026-11-14', 'Pembelian kertas Art Paper rutin', 2, '2026-10-15 09:00:00')`
      )
      .run(po1No);
    const po1Id = Number(po1Res.lastInsertRowid);

    const po1ItemRes = db
      .prepare(
        `INSERT INTO purchase_order_items (
          purchase_order_id, item_id, description, input_qty, input_unit, conversion_factor,
          qty_ordered, qty_received, unit_price, discount_amount, line_total
        ) VALUES (?, 1, 'Art Paper 150g Plano (10 Rim = 5.000 Lembar)', 10, 'Rim', 500, 5000, 5000, 270000, 0, 2700000)`
      )
      .run(po1Id);
    const po1ItemId = Number(po1ItemRes.lastInsertRowid);

    db.prepare(
      `INSERT INTO po_payments (purchase_order_id, payment_date, amount, payment_method, reference_number, notes, user_id)
       VALUES (?, '2026-10-28', 2997000, 'TRANSFER BCA', 'TRF-BCA-261028', 'Pelunasan Invoice INV/KJA/10/882', 1)`
    ).run(po1Id);

    // Transaksi IN untuk PO 1
    const in1No = generateDocNumber(db, "IN", "2026-10-17");
    const in1Res = db
      .prepare(
        `INSERT INTO transactions (
          transaction_number, type, transaction_date, reference_number, supplier_id, purchase_order_id, notes, request_id, user_id
        ) VALUES (?, 'IN', '2026-10-17', 'SJ-KJA-2026-1092', 1, ?, 'Penerimaan 10 Rim (5.000 Lembar) Art Paper 150g sesuai PO', ?, 3)`
      )
      .run(in1No, po1Id, crypto.randomUUID());
    const in1TxId = Number(in1Res.lastInsertRowid);

    // Harga baru: Rp 270.000/Rim = Rp 540/Lembar. Stok lama 4.000 @ 520 + 5.000 @ 540 = 9.000 @ 531.1111
    const newAvgAp150 = (4000 * 520 + 5000 * 540) / 9000;
    db.prepare(
      `INSERT INTO transaction_details (transaction_id, item_id, po_item_id, quantity, input_quantity, input_unit, qty_delta, unit_cost, balance_after)
       VALUES (?, 1, ?, 5000, 10, 'Rim', 5000, 540, 9000)`
    ).run(in1TxId, po1ItemId);
    db.prepare(`UPDATE items SET current_stock = 9000, avg_cost = ?, last_purchase_cost = 540 WHERE id = 1`).run(newAvgAp150);

    // Riwayat fluktuasi harga beli supplier untuk KRT-AP150-79X109
    const insertPriceHist = db.prepare(
      `INSERT INTO supplier_price_history (item_id, supplier_id, transaction_id, purchase_order_id, reference_number, input_unit, input_unit_price, base_unit_cost, transaction_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertPriceHist.run(1, 1, opnTxId, null, "INV-KJA-0901", "Rim", 255000, 510, "2026-09-10");
    insertPriceHist.run(1, 1, opnTxId, null, "INV-KJA-1001", "Rim", 260000, 520, "2026-10-01");
    insertPriceHist.run(1, 1, in1TxId, po1Id, "SJ-KJA-2026-1092", "Rim", 270000, 540, "2026-10-17");

    // Riwayat harga untuk Tinta Cyan
    insertPriceHist.run(5, 2, opnTxId, null, "INV-TPG-0915", "Kaleng", 460000, 92000, "2026-09-15");
    insertPriceHist.run(5, 2, opnTxId, null, "INV-TPG-1001", "Kaleng", 475000, 95000, "2026-10-01");

    // 9. Seed Transaksi Barang Keluar (OUT) untuk SPK Produksi
    const out1No = generateDocNumber(db, "OUT", "2026-10-22");
    const out1Res = db
      .prepare(
        `INSERT INTO transactions (
          transaction_number, type, transaction_date, reference_number, requester_name, notes, request_id, user_id
        ) VALUES (?, 'OUT', '2026-10-22', 'SPK/2026/10/088', 'Divisi Cetak Offset 1 (Pak Wahyu)', 'Pengambilan bahan cetak katalog produk 2026', ?, 3)`
      )
      .run(out1No, crypto.randomUUID());
    const out1TxId = Number(out1Res.lastInsertRowid);

    db.prepare(
      `INSERT INTO transaction_details (transaction_id, item_id, quantity, input_quantity, input_unit, qty_delta, unit_cost, balance_after)
       VALUES (?, 1, 2000, 2000, 'Lembar', -2000, ?, 7000)`
    ).run(out1TxId, newAvgAp150);
    db.prepare(`UPDATE items SET current_stock = 7000 WHERE id = 1`).run();

    db.prepare(
      `INSERT INTO transaction_details (transaction_id, item_id, quantity, input_quantity, input_unit, qty_delta, unit_cost, balance_after)
       VALUES (?, 5, 2.5, 2.5, 'Kg', -2.5, 95000, 12.5)`
    ).run(out1TxId);
    db.prepare(`UPDATE items SET current_stock = 12.5 WHERE id = 5`).run();

    // 10. Seed Transaksi Pemotongan Kertas & SKU Sisa (CUTTING - FR-004 & BR-003)
    const cut1No = generateDocNumber(db, "OUT", "2026-11-02");
    const cuttingInfo = JSON.stringify({
      sourceSku: "KRT-AP150-79X109",
      sourceQty: 500,
      targetSize: "65 x 79 cm",
      remnantLengthCm: 50,
      remnantWidthCm: 35,
      isWaste: false,
      remnantSku: "SISA-AP150-35X50",
      remnantQty: 500,
    });
    const cut1Res = db
      .prepare(
        `INSERT INTO transactions (
          transaction_number, type, transaction_date, reference_number, requester_name, notes, cutting_info_json, request_id, user_id
        ) VALUES (?, 'CUTTING', '2026-11-02', 'SPK/2026/11/004', 'Divisi Potong Polar (Kang Dedi)', 'Potong 500 lbr AP 150g Plano -> ukuran cetak 65x79 cm, sisa 35x50 cm (>= 20cm masuk SKU Sisa)', ?, ?, 3)`
      )
      .run(cut1No, cuttingInfo, crypto.randomUUID());
    const cut1TxId = Number(cut1Res.lastInsertRowid);

    // Kurangi Kertas Utama 500 lembar (7000 -> 6500), tambah SKU Sisa 500 lembar (0 -> 500)
    db.prepare(
      `INSERT INTO transaction_details (transaction_id, item_id, quantity, input_quantity, input_unit, qty_delta, unit_cost, balance_after)
       VALUES (?, 1, 500, 500, 'Lembar', -500, ?, 6500)`
    ).run(cut1TxId, newAvgAp150);
    db.prepare(`UPDATE items SET current_stock = 6500 WHERE id = 1`).run();

    db.prepare(
      `INSERT INTO transaction_details (transaction_id, item_id, quantity, input_quantity, input_unit, qty_delta, unit_cost, balance_after)
       VALUES (?, 13, 500, 500, 'Lembar', 500, ?, 500)`
    ).run(cut1TxId, newAvgAp150 * 0.2);
    db.prepare(`UPDATE items SET current_stock = 500, avg_cost = ? WHERE id = 13`).run(newAvgAp150 * 0.2);

    // 11. Seed Open POs (1 PARTIALLY_RECEIVED & Terlambat, 1 SENT, 1 DRAFT)
    const po2No = generateDocNumber(db, "PO", "2026-10-25");
    const po2Res = db
      .prepare(
        `INSERT INTO purchase_orders (
          po_number, supplier_id, po_date, expected_date, status, ppn_percent,
          subtotal, tax_amount, total_amount, payment_status, paid_amount, due_date, notes, created_by, sent_at
        ) VALUES (?, 2, '2026-10-25', '2026-11-01', 'PARTIALLY_RECEIVED', 11, 2940000, 323400, 3263400, 'PARTIAL', 1500000, '2026-11-15', 'Restock Tinta Magenta & Cyan (Sebagian masih pending pengiriman)', 2, '2026-10-25 10:15:00')`
      )
      .run(po2No);
    const po2Id = Number(po2Res.lastInsertRowid);

    // 4 Kaleng Magenta (20 Kg) dipesan, baru diterima 1 Kaleng (5 Kg)
    const po2Item1Res = db
      .prepare(
        `INSERT INTO purchase_order_items (
          purchase_order_id, item_id, description, input_qty, input_unit, conversion_factor,
          qty_ordered, qty_received, unit_price, discount_amount, line_total
        ) VALUES (?, 6, 'Tinta Process Magenta 5 Kg/Kaleng', 4, 'Kaleng', 5, 20, 5, 495000, 0, 1980000)`
      )
      .run(po2Id);
    const po2Item1Id = Number(po2Item1Res.lastInsertRowid);

    // 2 Kaleng Cyan (10 Kg) dipesan, belum diterima (0 Kg)
    db.prepare(
      `INSERT INTO purchase_order_items (
        purchase_order_id, item_id, description, input_qty, input_unit, conversion_factor,
        qty_ordered, qty_received, unit_price, discount_amount, line_total
      ) VALUES (?, 5, 'Tinta Process Cyan 5 Kg/Kaleng', 2, 'Kaleng', 5, 10, 0, 480000, 0, 960000)`
    ).run(po2Id);

    // Transaksi IN Partial Receipt untuk PO 2
    const in2No = generateDocNumber(db, "IN", "2026-10-29");
    const in2Res = db
      .prepare(
        `INSERT INTO transactions (
          transaction_number, type, transaction_date, reference_number, supplier_id, purchase_order_id, notes, request_id, user_id
        ) VALUES (?, 'IN', '2026-10-29', 'SJ-TPG-2610-441', 2, ?, 'Penerimaan tahap 1: 1 Kaleng (5 Kg) Tinta Magenta', ?, 3)`
      )
      .run(in2No, po2Id, crypto.randomUUID());
    const in2TxId = Number(in2Res.lastInsertRowid);

    const newAvgMagenta = (8 * 98000 + 5 * 99000) / 13;
    db.prepare(
      `INSERT INTO transaction_details (transaction_id, item_id, po_item_id, quantity, input_quantity, input_unit, qty_delta, unit_cost, balance_after)
       VALUES (?, 6, ?, 5, 1, 'Kaleng', 5, 99000, 13)`
    ).run(in2TxId, po2Item1Id);
    // Keluarkan 5 Kg Magenta lagi di transaksi berikutnya agar Magenta tetap di bawah min_stock (8 Kg < 10 Kg)
    const out2No = generateDocNumber(db, "OUT", "2026-11-03");
    const out2Res = db
      .prepare(
        `INSERT INTO transactions (
          transaction_number, type, transaction_date, reference_number, requester_name, notes, request_id, user_id
        ) VALUES (?, 'OUT', '2026-11-03', 'SPK/2026/11/009', 'Divisi Cetak Offset 2 (Pak Bambang)', 'Cetak poster full color kampanye akhir tahun', ?, 3)`
      )
      .run(out2No, crypto.randomUUID());
    const out2TxId = Number(out2Res.lastInsertRowid);
    db.prepare(
      `INSERT INTO transaction_details (transaction_id, item_id, quantity, input_quantity, input_unit, qty_delta, unit_cost, balance_after)
       VALUES (?, 6, 5, 5, 'Kg', -5, ?, 8)`
    ).run(out2TxId, newAvgMagenta);

    db.prepare(`UPDATE items SET current_stock = 8, avg_cost = ?, last_purchase_cost = 99000 WHERE id = 6`).run(newAvgMagenta);
    insertPriceHist.run(6, 2, opnTxId, null, "INV-TPG-1001", "Kaleng", 490000, 98000, "2026-10-01");
    insertPriceHist.run(6, 2, in2TxId, po2Id, "SJ-TPG-2610-441", "Kaleng", 495000, 99000, "2026-10-29");

    // PO 3: Status SENT (Dikirim ke PT Indo Plate & Chemical)
    const po3No = generateDocNumber(db, "PO", "2026-11-04");
    const po3Res = db
      .prepare(
        `INSERT INTO purchase_orders (
          po_number, supplier_id, po_date, expected_date, status, ppn_percent,
          subtotal, tax_amount, total_amount, payment_status, paid_amount, due_date, notes, created_by, sent_at
        ) VALUES (?, 3, '2026-11-04', '2026-11-10', 'SENT', 11, 4300000, 473000, 4773000, 'UNPAID', 0, '2026-12-04', 'Order 100 pcs Plate CTP SM74', 2, '2026-11-04 14:20:00')`
      )
      .run(po3No);
    const po3Id = Number(po3Res.lastInsertRowid);

    db.prepare(
      `INSERT INTO purchase_order_items (
        purchase_order_id, item_id, description, input_qty, input_unit, conversion_factor,
        qty_ordered, qty_received, unit_price, discount_amount, line_total
      ) VALUES (?, 9, 'Plate CTP Thermal Heidelberg SM74', 100, 'Pcs', 1, 100, 0, 43000, 0, 4300000)`
    ).run(po3Id);

    // 12. Seed Active Non-Blocking Stock Opname Session (FR-005 & FR-13)
    const soNo = generateDocNumber(db, "SO", "2026-11-01");
    const soRes = db
      .prepare(
        `INSERT INTO stock_counts (count_number, title, status, category_id, snapshot_at, started_by, notes)
         VALUES (?, 'Stock Opname Kertas & Sisa Potong Awal November 2026', 'COUNTING', ?, '2026-11-01 08:00:00', 2, 'Sesi opname berjalan non-blocking; transaksi potong kertas tanggal 2 Nov otomatis diperhitungkan offset-nya.')`
      )
      .run(soNo, cats["Kertas"]);
    const soId = Number(soRes.lastInsertRowid);

    // Snapshot Kertas pada 1 Nov (sebelum transaksi CUTTING 2 Nov yang mengurangi 500 lembar KRT-AP150-79X109!)
    db.prepare(
      `INSERT INTO stock_count_items (stock_count_id, item_id, system_qty_snapshot, counted_qty, notes)
       VALUES (?, 1, 7000, 6480, 'Dihitung fisik setelah pemotongan 500 lbr (ada selisih kurang 20 lembar)')`
    ).run(soId);
    db.prepare(
      `INSERT INTO stock_count_items (stock_count_id, item_id, system_qty_snapshot, counted_qty, notes)
       VALUES (?, 2, 1000, 1000, 'Sesuai fisik (2 Rim utuh)')`
    ).run(soId);
    db.prepare(
      `INSERT INTO stock_count_items (stock_count_id, item_id, system_qty_snapshot, counted_qty, notes)
       VALUES (?, 3, 6000, 6000, 'Sesuai fisik (12 Rim utuh)')`
    ).run(soId);
    db.prepare(
      `INSERT INTO stock_count_items (stock_count_id, item_id, system_qty_snapshot, counted_qty, notes)
       VALUES (?, 4, 1000, null, 'Belum selesai dihitung rak B-4')`
    ).run(soId);

    // 13. Seed Audit Logs
    writeAuditLog(db, {
      userId: 1,
      userName: "Administrator Sistem",
      action: "SYSTEM_INIT",
      entityType: "SYSTEM",
      entityId: "INIT",
      newValues: { message: "Inisialisasi database & opening balance gudang percetakan v2.0" },
    });
    writeAuditLog(db, {
      userId: 2,
      userName: "Budi Santoso (Kepala Gudang)",
      action: "PO_STATUS_CHANGE",
      entityType: "PURCHASE_ORDER",
      entityId: po3No,
      oldValues: { status: "DRAFT" },
      newValues: { status: "SENT" },
    });

    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    console.error("Seed error:", err);
  }
}

