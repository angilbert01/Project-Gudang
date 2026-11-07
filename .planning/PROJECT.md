# PROJECT.md — Sistem Informasi Manajemen Gudang Percetakan & PO

## 1. Overview
Sistem Informasi Operasional Gudang Percetakan dirancang untuk memproses transaksi material percetakan dengan akurasi tinggi, penegakan integritas data stok (Append-Only ledger & Anti-Stok Negatif), pemotongan kertas plano & manajemen sisa lembar, pelacakan siklus Purchase Order (PO) & hutang supplier, serta Stock Opname non-blocking yang dapat berjalan bersamaan dengan aktivitas produksi.

Dokumen acuan utama: `_Web App Operasional Gudang Percetakan.md` (Integrasi PRD v2.0 fondasi & PRD v1.0 spesifikasi percetakan).

---

## 2. Core Architecture & Constraints
- **Framework & Runtime**: Next.js 15 (TypeScript, Tailwind CSS, App Router) running on Node.js v24.
- **Database**: SQLite WAL mode (`data/gudang.db`) dengan native `node:sqlite`.
- **Append-Only Principle (BR-02)**: Tabel `stock_mutations` tidak boleh di-UPDATE atau di-DELETE langsung. Seluruh perubahan stok terjadi melalui trigger otomatis saat transaksi dicatat.
- **Strict Negative Stock Block (BR-01)**: Trigger database menolak transaksi keluar jika kuantitas melebihi `current_stock`.
- **Idempotency & Reversals (BR-03 & BR-09)**: Transaksi dilengkapi `idempotency_key` (UUID v4) dan koreksi dilakukan melalui mekanisme Void & Jurnal Pembalik (reversal).
- **Design System**: Mengikuti standar `taste-skill` (Palette `white-mint-tiles`, Font `Geist` + `Geist Mono` tabular nums, Radius `sharp`, bebas warna violet/ungu dan minim teks bertumpuk).

---

## 3. User Roles (RBAC)
1. **ADMIN**: Hak akses menyeluruh, manajemen user & hak akses, konfigurasi sistem, dan audit log.
2. **KEPALA_GUDANG / Purchasing**: Pengelolaan stok, persetujuan & pencatatan PO, void transaksi, adjustment saldo, dan pelaporan biaya/valuasi.
3. **PETUGAS**: Operasional harian penerimaan barang masuk, pengeluaran barang cetak SPK, pemotongan plano, dan penginputan fisik stock opname (tanpa akses harga).

