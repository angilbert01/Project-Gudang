# ROADMAP.md — Tahapan Fase Pengembangan Sistem Gudang Percetakan

## Ringkasan Milestone

| Fase | Nama Fase | Deskripsi & Ruang Lingkup | Status |
| :---: | :--- | :--- | :---: |
| **01** | **Fondasi Database, Skema & Append-Only Ledger** | SQLite WAL, schema DB, triggers anti-stok negatif, sequence nomor dokumen, dan seed data realistis percetakan. | **COMPLETED** |
| **02** | **Fullstack Transaksi & Pemotongan Plano** | Inbound, Outbound SPK, konversi Rim/Lembar & Kaleng/Kg, visualisasi & kalkulasi pemotongan sisa plano ($\ge 20\text{ cm}$ SKU Sisa vs $< 20\text{ cm}$ Waste). | **COMPLETED** |
| **03** | **Siklus Purchase Order & Hutang Supplier** | Multi-item PO form, PPN 11%, penerimaan parsial PO, rekapitulasi pembayaran hutang, dan tampilan cetak Surat PO. | **COMPLETED** |
| **04** | **Non-Blocking Stock Opname & Audit Laporan** | Sesi opname berjalan (rumus snapshot), adjustment bertingkat, buku besar Kartu Stok, laporan periodik, SPK usage, dan fluktuasi harga. | **COMPLETED** |
| **05** | **Art Direction & UI/UX Decluttering** | Integrasi `taste-skill`, palet `white-mint-tiles`, tipografi `Geist Mono`, anti-slop rules, mobile touch optimization, dan decluttering layout. | **COMPLETED** |
| **06** | **Integrasi Perangkat Fisik & Mobile Barcode/QR Scanner** | Implementasi pemindaian Barcode/QR menggunakan kamera smartphone untuk pencarian cepat barang, serah terima SPK, dan input opname cepat di lorong gudang. | **COMPLETED** |
| **07** | **Pencetakan Label Rak & Thermal Bluetooth Printer** | Fitur cetak stiker barcode untuk rak gudang, palet kertas plano, dan slip bukti mutasi via printer thermal 58mm/80mm. | **BACKLOG** |

---

## Rincian Fase Selanjutnya: Fase 06 (Integrasi Pemindaian Barcode/QR Mobile)
- **Tujuan**: Memungkinkan petugas gudang memakai kamera HP untuk memindai SKU barang atau nomor SPK secara instan saat menerima barang masuk, mengeluarkan bahan baku, maupun saat stock opname di rak fisik.
- **Rencana Pengujian (UAT)**:
  - Kamera dapat aktif langsung di browser mobile (HTTPS / tunnel / localhost).
  - Pembacaan kode barcode/QR langsung mengisi form transaksi terkait tanpa input ketik manual.
  - Kompatibel dengan kamera smartphone modern.

