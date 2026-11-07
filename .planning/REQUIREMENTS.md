# REQUIREMENTS.md — Spesifikasi Kebutuhan Fungsional & Non-Fungsional

## 1. Functional Requirements (FR)

### Modul Autentikasi & Akun
- **FR-01**: Login multi-role (Admin, Kepala Gudang, Petugas Gudang) dengan hashing SHA-256 + salt dan pengingat ganti kata sandi default.

### Modul Master Data Percetakan
- **FR-02**: Konversi satuan beli ke satuan simpan (Kertas: 1 Rim = 500 Lembar, Tinta Offset: 1 Kaleng = 5 Kg).
- **FR-03**: Manajemen Master Barang percetakan (Kertas plano, tinta, plat cetak, lem, vernish) lengkap dengan batas stok minimum.
- **FR-04**: Master Supplier dan ketentuan tempo pembayaran (Term of Payment / TOP).

### Modul Operasional & Pemotongan Plano
- **FR-05**: Dashboard Peringatan Stok Minimum otomatis dengan rekomendasi kuantitas order PO.
- **FR-06**: Transaksi Barang Masuk (Inbound) dengan verifikasi faktur supplier (BR-13 anti duplikat nota).
- **FR-07**: Transaksi Barang Keluar SPK dengan alokasi nomor surat perintah kerja produksi.
- **FR-08**: Pemotongan Kertas Plano (Mesin Polar) dengan pemisahan otomatis:
  - Sisa $\ge 20\text{ cm}$: Didaftarkan sebagai **SKU Sisa Layak Pakai**.
  - Sisa $< 20\text{ cm}$: Dialokasikan sebagai **Waste / Scrap**.

### Modul Purchase Order & Hutang
- **FR-09**: Pembuatan dokumen PO resmi dengan kalkulasi PPN 11%, diskon, dan biaya lain.
- **FR-10**: Penerimaan bertahap (Partial Receiving) terhadap PO dan pelacakan status hutang supplier.
- **FR-11**: Mode cetak Surat Pesanan (PO) formal siap print atau simpan PDF.

### Modul Kontrol Persediaan & Stock Opname
- **FR-12**: Stock Opname Non-Blocking: Menghitung selisih fisik tanpa mengunci aktivitas gudang menggunakan rumus $Fisik - (Snapshot + Masuk - Keluar)$.
- **FR-13**: Koreksi Stok (Adjustment) wajib dengan alasan terdokumentasi (BR-07).
- **FR-14**: Kartu Stok Mutasi buku besar (Ledger) historis per barang dengan saldo berjalan.
- **FR-15**: Laporan Valuasi Moving Average, Rekapitulasi SPK, dan Tren Fluktuasi Harga Beli.

---

## 2. Business Rules (BR) & Non-Functional Requirements (NFR)
- **BR-01**: Stok negatif dilarang keras di level database (Strict Trigger Block).
- **BR-02**: Buku besar mutasi append-only, dilarang modifikasi data historis secara langsung.
- **BR-03**: Dukungan Idempotency UUID v4 pada seluruh submit transaksi untuk mencegah double submission.
- **BR-05**: Rekonsiliasi harian memastikan `current_stock` selalu identik dengan `SUM(qty_delta)`.
- **NFR-01**: Waktu respon transaksi $< 200\text{ ms}$ menggunakan SQLite WAL mode.
- **NFR-02**: Tampilan responsif di smartphone untuk petugas fisik di lantai gudang.

