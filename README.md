# SIM Operasional Gudang Percetakan & Purchase Order (PRD v2.0 + v1.0)

Aplikasi web terintegrasi untuk manajemen operasional gudang percetakan, pembuatan dan pelacakan Purchase Order (PO), konversi satuan kertas (`1 Rim = 500 Lembar`) dan tinta (`1 Kaleng = 5 Kg`), pemotongan kertas plano dengan manajemen SKU sisa ($\ge 20\text{ cm}$ vs *Waste*), *Non-Blocking Stock Opname*, serta kartu stok mutasi *append-only*.

---

## Cara Menjalankan Aplikasi

1. Pastikan Node.js (v22.5+ / v24+) sudah terpasang.
2. Jalankan server development:
   ```bash
   npm run dev
   ```
3. Buka browser di: **`http://localhost:3000`**

*(Database SQLite `data/gudang.db` beserta data awal bahan percetakan, PO, mutasi kartu stok, dan sesi stock opname otomatis terinisialisasi saat pertama kali dijalankan).*

---

## Akun Demo (3 Role Sesuai Matriks Hak Akses PRD)

Tersedia tombol **Login Cepat 1-Klik** di halaman login, atau masuk manual dengan kredensial berikut:

| Role | Email | Password | Hak Akses Utama |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@percetakan.co.id` | `AdminGudang123!` | Akses penuh semua modul, Manajemen User, Impor CSV, Opening Balance, Pengaturan, Audit Log |
| **Kepala Gudang** | `kepala@percetakan.co.id` | `KepalaGudang123!` | Master Barang/Supplier, Buat/Kirim/Tutup PO, Void Transaksi, Koreksi Stok, Approval Opname, Lihat Harga & Semua Laporan |
| **Petugas Gudang** | `petugas@percetakan.co.id` | `PetugasGudang123!` | Catat Barang Masuk (termasuk dari PO), Barang Keluar (SPK), Pemotongan Kertas, Input Fisik Opname, Lihat Stok & Kartu Stok (Tanpa Harga) |

---

## Fitur Utama yang Diimplementasikan

1. **Autentikasi, Keamanan & RBAC Server-Side (`FR-01`, `FR-02`, `BR-15`)**:
   - Hash password (`scrypt`), penguncian akun otomatis 15 menit setelah 5x gagal login (`NFR-04`), proteksi penurunan/penonaktifan Admin terakhir.
   - Pembatasan harga & nilai persediaan di tingkat API server untuk role `PETUGAS`.
2. **Master Data Bahan Percetakan & Konversi Satuan (`FR-03`, `FR-04`, `BR-001..004`, `BR-09`, `BR-10`)**:
   - 8 Kategori Percetakan: Kertas, Tinta, Plate Cetak, Bahan Baku Penolong, Bahan Baku Finishing, Sparepart Mesin, Proses Luar, dan Kategori Sisa.
   - Konversi otomatis `1 Rim = 500 Lembar` (Kertas) dan `1 Kaleng = 5 Kg` (Tinta).
   - Penguncian kode SKU dan satuan dasar setelah barang memiliki transaksi (`BR-10`), serta *soft-delete* (`BR-09`).
   - Impor CSV Master Barang dengan pratinjau dan laporan error per baris (`FR-11`).
3. **Purchase Order Management System & Pelacakan Hutang (`FR-08`, `FR-09`, `FR-10`, `BR-11`, `BR-12`)**:
   - Form PO sesuai mockup referensi (Info PO, Info Vendor/Supplier otomatis, Diskon per baris, PPN, Biaya Lain, Ringkasan Total).
   - Buat PO Draft 1-klik langsung dari daftar Peringatan Stok Minimum di Dashboard (`FR-05`).
   - Siklus status PO lengkap: `DRAFT` $\rightarrow$ `SENT` $\rightarrow$ `PARTIALLY_RECEIVED` $\rightarrow$ `FULLY_RECEIVED`, `CLOSED` (Tutup Manual), `CANCELLED`.
   - Cetak Surat PO resmi (PDF / Print View) lengkap dengan kop perusahaan dan blok tanda tangan.
   - Pencatatan pembayaran / cicilan hutang PO ke supplier.
4. **Transaksi Mutasi Atomic, Idempotent & Append-Only (`FR-06`, `FR-07`, `FR-12`, `BR-01..08`, `NFR-05`)**:
   - **Blokir Mutlak Stok Minus (`BR-01`)** pada Barang Keluar, Pemotongan Kertas, Koreksi Negatif, dan Void Barang Masuk.
   - **Database Trigger Append-Only (`BR-02` & `NFR-05`)**: Tabel `transactions` dan `transaction_details` dilindungi trigger database yang menolak `UPDATE` dan `DELETE`.
   - **Void / Reversal (`FR-12` & `BR-06`)**: Pembatalan transaksi dengan alasan wajib ($\ge 10$ karakter) yang otomatis membalik stok, menghitung ulang status PO, dan memperbarui *Moving Average Cost*.
   - **Idempotency Control (`BR-03`)**: Setiap form transaksi menghasilkan `request_id` (UUID) unik yang divalidasi di server untuk mencegah *double input*.
5. **Pemotongan Kertas Plano & Manajemen SKU Sisa (`FR-004` & `BR-003`)**:
   - Validasi otomatis dimensi sisa potongan kertas:
     - Sisa $\ge 20\text{ cm}$: wajib masuk ke **SKU Turunan Kategori Sisa** (otomatis dibuat/dipilih, misal `SISA-AP150-35X50`) dan menambah saldo stok sisa.
     - Sisa $< 20\text{ cm}$: otomatis dialokasikan sebagai **Waste (Sampah/Susut)** tanpa menambah stok.
6. **Non-Blocking Stock Opname (`FR-005` & `FR-13`)**:
   - Merekam *Snapshot Balance* saat sesi dibuka; transaksi keluar-masuk harian tetap berjalan normal.
   - Menghitung selisih dengan rumus offset mutasi setelah snapshot dan memposting transaksi `ADJUSTMENT` otomatis saat disetujui Kepala Gudang/Admin.
7. **Pusat Laporan, Kartu Stok & Ekspor (`FR-14`, `FR-15`, Bagian 8)**:
   - Laporan Saldo Stok Terkini & Valuasi (*Moving Average*), Kartu Stok Kronologis per SKU, Laporan Periodik, Rekap Pemakaian Bahan & HPP per Job/SPK, serta Laporan & Grafik Fluktuasi Harga Beli Supplier.
   - Ekspor ke **Excel (`.xls`)**, **CSV**, dan **Cetak PDF** (setiap ekspor tercatat otomatis di Audit Log).

