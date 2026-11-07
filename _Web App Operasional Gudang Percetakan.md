# **PRD (MVP) \- Web App Operasional Gudang Percetakan**

## **1\. Ringkasan Eksekutif**

Aplikasi web sederhana untuk mencatat pergerakan stok gudang percetakan, pembuatan purchase order, dan tracking yang diperlukan. **Tujuan utama:** Menghilangkan pencatatan manual/buku, mencegah *double input*, memastikan pelaporan teratur, dan memudahkan pelacakan sisa stok aktual.

## **2\. Cakupan Proyek (Scope)**

**In-Scope (Dikerjakan di versi ini):**

* Login & autentikasi berbasis *Role*.  
* CRUD Master Data Barang (SKU, Nama, Kategori, Satuan Terkecil).  
* Pencatatan Transaksi Barang Masuk (Inbound).  
* Pencatatan Transaksi Barang Keluar (Outbound untuk produksi).  
* Laporan Saldo Stok Terkini dan Kartu Stok/Mutasi.  
* Pembuatan sistem purchase order dan rekapitulasi purchase order  
  **Out-of-Scope (TIDAK dikerjakan di versi ini):**

* Konversi satuan yang rumit (Rim ke Lembar). Di MVP ini, **semua barang diinput menggunakan satuan dasar terkecil** (misal: kertas dalam "Lembar", tinta dalam "Gram/Botol").  
* *Approval* bertingkat, integrasi *barcode scanner*, dan *multi-gudang*.

  ## **3\. Peran Pengguna (User Roles)**

1. **Admin / Kepala Gudang:** Memiliki akses penuh. Bisa menambah/mengedit Master Barang, menambah *User* baru, melakukan koreksi stok manual, dan melihat semua laporan.  
2. **Petugas Gudang:** Akses terbatas. Hanya bisa membuat transaksi Barang Masuk, Barang Keluar, dan melihat ketersediaan stok.

   ## **4\. Aturan Bisnis (Business Rules)**

* **BR-01 (Blokir Stok Minus):** Transaksi Barang Keluar akan **ditolak/gagal** jika kuantitas yang diminta melebihi stok yang tersedia.  
* **BR-02 (Audit Trail mutlak):** Saldo stok (current\_stock) **tidak boleh** diedit langsung secara manual oleh siapapun. Stok hanya berubah melalui penambahan di "Transaksi Masuk", pengurangan di "Transaksi Keluar", atau "Transaksi Koreksi" oleh Admin.  
* **BR-03 (Pencegahan Duplikat):** Sistem harus menggunakan validasi agar jika tombol "Simpan" tertekan dua kali secara tidak sengaja, transaksi dan pengurangan stok tidak tercatat ganda.

  ## **5\. Kebutuhan Fitur (User Stories & Acceptance Criteria)**

* **FR-01: Autentikasi**  
  * *Story:* Sebagai pengguna, saya bisa login dengan *email* dan *password*.  
  * *AC:* Hak akses menu dibatasi sesuai *role* (Petugas vs Admin).  
* **FR-02: Kelola Master Barang**  
  * *Story:* Sebagai Admin, saya bisa menambah data barang cetak (SKU, Nama, Satuan Dasar).  
  * *AC:* SKU harus unik. Stok awal otomatis 0\.  
* **FR-03: Transaksi Barang Masuk**  
  * *Story:* Sebagai Petugas Gudang, saya bisa mencatat barang masuk dari *supplier*.  
  * *AC:* Wajib mengisi Nomor Referensi/Nota, memilih Barang, dan jumlah. Setelah disimpan, stok bertambah.  
* **FR-04: Transaksi Barang Keluar**  
  * *Story:* Sebagai Petugas Gudang, saya bisa mencatat bahan yang diambil untuk produksi.  
  * *AC:* Wajib mengisi Nomor Job/SPK, memilih Barang, dan jumlah. Berlaku aturan **BR-01** (stok tidak boleh minus).  
* **FR-05: Laporan & Kartu Stok**  
  * *Story:* Sebagai Admin, saya ingin melihat Saldo Stok Terkini dan detail mutasinya.  
  * *AC:* Terdapat tabel daftar barang dengan sisa stok aktual. Jika barang diklik, muncul histori (tanggal, nomor referensi, tipe masuk/keluar, jumlah, dan user yang input).

  ## **6\. Referensi Struktur Database (Untuk Agent/Developer)**

  Berikut adalah draf skema basis data (*Relational Database*) agar sistem *tracking* berjalan sesuai dokumen:

* **users**: id, name, role (enum: admin, petugas), email, password\_hash.  
* **items**: id, sku (unique), name, category, base\_unit (satuan, misal: lembar, kg), current\_stock (integer, default 0).  
* **transactions**: id, type (enum: IN, OUT, ADJUSTMENT), reference\_number (No. PO / No. Job Produksi), transaction\_date, user\_id (relasi ke users), notes.  
* **transaction\_details**: id, transaction\_id, item\_id, quantity (integer positif).


  

**Bahan yang hendak dimasukkan:**

1. Kertas \= Plano (berukuran besar) dibeli per rim dan dikeluarkan secara lembaran dan ketika keluar ada ukuran potong sesuai dengan keperluan dari kebutuhan customer.   
2. Plate \= Plate tidak melalui proses pemotongan, digunakan sebagai pelat cetak, sesuai kebutuhan mesin   
3. Bahan Baku Penolong   
4. Bahan Baku Finishing   
5. Bahan Baku Tinta  
6. Pemrosesan yang melibatkan pihak ketiga (proses luar)  
7. Sparepart perawatan mesin 

Buat sistem untuk (secara otomatis):

1. Purchase Order Management System  
   1. Pembuatan PO secara otomatis dari Form dengan referensi 

![][image1]

Setelah barang semua sudah terisi akan bisa setup dokumen berupa surat berisi no PO dst. 

2. Kartu Stock/Mutasi  
   1. Pembelian   
   2. Pengeluaran (HPP)  
   3. Saldo Stock   
3. Transaksi Hutang 

   **PRD FollowUp**

Berdasarkan konfirmasi penting dari Anda bahwa **transaksi harian tetap harus dapat berjalan saat proses Stock Opname berlangsung** (karena proses penghitungan fisik memakan waktu yang lama), kita telah menyelesaikan seluruh tahapan **Discovery**.

Seluruh fakta, aturan bisnis, penanganan sisa potong kertas, fleksibilitas kemasan tinta, mekanisme *non-bljocking Stock Opname*, serta kontrol *Audit Trail* telah tervalidasi.

Berikut adalah **Draft PRD (Product Requirements Document) v1.0** yang dirancang lengkap, detail, dan spesifik untuk memenuhi kebutuhan designer dan developer software gudang percetakan Anda.

# **DOKUMEN SPESIFIKASI KEBUTUHAN PRODUK (PRD)**

**SISTEM INFORMASI MANAJEMEN OPERASIONAL GUDANG PERCETAKAN (WEB APP)**

| Metadata Dokumen | Keterangan |
| :---- | :---- |
| **Versi Dokumen** | v1.0 — Draft Discovery Terkonfirmasi |
| **Status** | Siap Desain & Pengisian Backlog Developer |
| **Pemilik Produk** | Senior Product Manager & Business Analyst |
| **Target Pengguna** | Petugas Gudang (Bruder), Staf Purchasing, Admin/Manager |

## **1\. RINGKASAN EKSEKUTIF & LATAR BELAKANG**

### **1.1 Latar Belakang & Problem Statement**

Operasional gudang percetakan saat ini menghadapi kendala utama dalam hal pencatatan manual berbasis Excel, tidak tersedianya standar kode SKU yang baku, tidak adanya kartu stok mutasi, serta tingginya potensi *human error* dalam mengelola bahan baku dengan spesifikasi kompleks.

Bahan baku utama seperti **Kertas** (memiliki variasi ukuran, gramatur, serta konversi Rim ke Lembar), **Tinta** (fluktuasi ukuran kemasan kaleng/kg), serta **Sisa Potongan Kertas** sering kali mengalami ketidaksesuaian pencatatan. Selain itu, fluktuasi harga beli dari supplier menyulitkan pemantauan riwayat harga dan valuasi persediaan.

### **1.2 Problem Statement Utama**

Petugas gudang dan tim purchasing memerlukan web app terintegrasi untuk mencatat barang masuk dari PO/Supplier, pengeluaran barang berbasis Form Permintaan, pemotongan kertas dengan manajemen SKU sisa, serta penyesuaian stok opname yang dapat berjalan serentak dengan transaksi harian tanpa menyebabkan penguncian (*locking/blocking*) sistem.

### **1.3 Indikator Keberhasilan (Success Metrics)**

* **Akurasi Stok Phys vs System:** Target selisih fisik vs sistem \$\< 2\\%\$ saat *Stock Opname*.  
* **Eliminasi Double Input:** 0% kejadian transaksi duplikat akibat pengiriman ganda (*idempotency*).  
* **Auditability:** \$100\\%\$ transaksi mutasi dapat ditelusuri ke akun pengguna, waktu, dokumen sumber, dan alasan koreksi.  
* **Efisiensi Input:** Waktu input transaksi barang masuk/keluar rata-rata $<60$ detik per lembar dokumen sumber.

### **1.4 Non-Goals (Out of Scope untuk MVP)**

* Integrasi otomatis ke hardware barcode/QR scanner offline.  
* Integrasi otomatis ke software akuntansi pihak ketiga secara *real-time* (cukup via ekspor Excel/PDF).  
* Fitur *offline-first sync* (sistem sepenuhnya berjalan berbasis jaringan online web app).

## **2\. PERSONA & PERAN PENGGUNA**

| Role | Tanggung Jawab Utama | Akses Modul Utama |
| :---- | :---- | :---- |
| **Petugas Gudang**  | Input Barang Masuk, Input Barang Keluar, Input Pemotongan Kertas, Input Hitung Opname | Dashboard Stok, Transaksi Masuk/Keluar, Pemotongan Kertas, Input Opname |
| **Staf Purchasing** | Memantau penerimaan barang PO, melihat riwayat harga beli supplier, evaluasi restock | Dashboard Stock, Transaksi Masuk, Master Data Harga, Laporan Fluktuasi Harga, Laporan Stok |
| **Admin / Manager** | Kelola Master Data SKU, Ekspor Laporan, Audit Trail Review, Approval Penyesuaian Opname | Akses Penuh All Modul, Master Data, Audit Trail, Penyesuaian Opname, User Mgmt |

## **3\. ALUR KERJA SIKLUS TRANSAKSI (CURRENT VS FUTURE STATE)**

### **3.1 Transaksi Barang Masuk (Inbound)**

* **Pemicu:** Kedatangan fisik barang dari Supplier.  
* **Dokumen Sumber:** Surat Jalan / Invoice \+ Nomor PO.  
* **Input Wajib:** Nomor PO, Nomor Surat Jalan/Invoice, Nama Supplier, Pilih SKU, Kuantitas Masuk, Satuan Beli, **Harga Beli Satuan (Unit Price)**.  
* **Dampak Stok:** Stok Fisik & Stok Tersedia bertambah seketika. Snapshot harga beli tersimpan untuk histori fluktuasi harga.

### **3.2 Transaksi Barang Keluar (Outbound)**

* **Pemicu:** Permintaan bahan baku dari tim produksi.  
* **Dokumen Sumber:** Form Permintaan Barang.  
* **Input Wajib:** Nomor Form Permintaan (opsional/free text), Nama Pemohon/Divisi, Pilih SKU, Kuantitas Keluar, Satuan.  
* **Dampak Stok:** Stok Fisik & Stok Tersedia berkurang seketika.

### **3.3 Transaksi Pemotongan Kertas & Manajemen Sisa**

* **Pemicu:** Pengeluaran kertas yang memerlukan proses potong ukuran spesifik.  
* **Proses Aturan Bisnis:**  
  1. Pengguna memilih SKU Kertas Utama (misal: *AP 150g Plano*).  
  2. Input jumlah lembar yang dipotong.  
  3. Input dimensi sisa kertas (Panjang $\times$ Lebar dalam cm).  
  4. **Validasi Sistem:**  
     * Jika Dimensi Sisa $\geq 20cm$: Sistem mewajibkan pembuatan/pemilihan **SKU Turunan Kategori Sisa** (misal: *SISA-AP150-25x40*) dan memasukkan kuantitas sisa ke stok sisa.  
     * Jika Dimensi Sisa $<20cm$: Sistem otomatis mengalokasikan sisa tersebut sebagai ***Waste*** (sampah/susut) tanpa menambah stok.

### **3.4 Transaksi Non-Blocking Stock Opname**

* **Pemicu:** Jadwal pencocokan stok berkala.  
* **Mekanisme Non-Blocking:**  
  1. Admin membuka *Sesi Stock Opname* dengan membuat **Snapshot Balance** (sistem merekam angka stok sistem pada Jam X, Tanggal Y).  
  2. Transaksi harian (Barang Masuk / Barang Keluar) **TETAP BISA BERJALAN NORMAL**.  
  3. Petugas menginput hasil hitungan fisik.  
  4. Sistem menghitung selisih dengan rumus:

  5. $Selisih=HasilFisik-(SnapshotBalance+MutasiMasukSetelahSnapshot-MutasiKeluarSetelahSnapshot)$  
  6. Setelah diverifikasi Manager, sistem melakukan penyesuaian (*Adjustment Posting*).

## **4\. ATURAN BISNIS (BUSINESS RULES \- BR)**

* **BR-001 (Konversi Kertas Baku):** Kategori kertas wajib menggunakan rasio baku **1 Rim \= 500 Lembar**. Transaksi masuk dapat menggunakan Rim, namun saldo disimpan dalam satuan dasar Lembar.  
* **BR-002 (Fleksibilitas Satuan Tinta):** Tinta disimpan dalam satuan Kaleng atau Kg. Master data menyimpan kapasitas bersih per kaleng (misal 1 Kaleng \= 5 Kg) untuk mendukung konversi otomatis.  
* **BR-003 (Batas Minimum Sisa Potong Kertas):** Potongan sisa kertas dengan ukuran $<20cm$ **DILARANG** masuk kembali sebagai stok dan wajib dicatat sebagai *Waste*. Potongan $\geq 20cm$ wajib masuk ke **Kategori Sisa** dengan SKU Turunan Spesifik.  
* **BR-004 (Auto-Archive SKU Sisa Nilai Nol):** SKU Turunan Kategori Sisa yang memiliki saldo $0$ selama $>30$ hari otomatis disembunyikan (*auto-archived*) dari daftar pencarian input harian agar tidak mengganggu operasional.  
* **BR-005 (Mandatory Unit Price):** Transaksi Barang Masuk **DILARANG** diposting tanpa mengisi Harga Beli Satuan dari Invoice.  
* **BR-006 (Prohibition of Hard Delete):** Transaksi yang sudah status *POSTED* tidak dapat dihapus permanen. Koreksi wajib melalui fitur *Reversal/Penyesuaian* dengan mencantumkan alasan tertulis minimal 10 karakter.  
* **BR-007 (No Approval Flow for Speed):** Transaksi harian tidak memerlukan *approval* atasan. Semua tindakan langsung memutasi stok dan mencatat rekaman *Audit Trail*.  
* **BR-008 (Idempotency Control):** Tombol "Simpan/Post" pada seluruh form transaksi akan mengalami *disable* otomatis seketika setelah diklik untuk mencegah duplikasi data ganda.

## **5\. KEBUTUHAN FUNGSIONAL (FUNCTIONAL REQUIREMENTS \- FR)**

### **FR-001: Manajemen Master Data SKU & Kategori**

* **Tujuan:** Mengelola daftar barang baku dan sisa secara terstruktur.  
* **Aktor:** Admin / Manager.  
* **Aturan & Validasi:**  
  * Kode SKU unik dan otomatis ter-generate atau kustom.  
  * Atribut Kertas: Jenis, Gramatur, Ukuran Plano (Panjang $\times$ Lebar), Satuan Dasar (Lembar).  
  * Atribut Tinta: Warna/Tipe, Kemasan (Kaleng/Kg), Berat Bersih per Kaleng.  
  * Atribut Kategori: Kertas, Tinta, Plate, Bahan Penolong, Finishing, Kategori Sisa.  
* **Acceptance Criteria:**  
  * Given Admin mengisi form SKU Kertas baru dengan ukuran dan gramatur, When disimpan, Then sistem menghasilkan SKU unik yang siap digunakan di transaksi.

### **FR-002: Pencatatan Barang Masuk (Inbound)**

* **Tujuan:** Mencatat penerimaan bahan dari supplier dan merekam riwayat harga beli.  
* **Aktor:** Petugas Gudang / Staf Purchasing.  
* **Input Field:** No. PO, No. Surat Jalan/Invoice, Supplier, SKU, Qty, Satuan, Harga Beli per Satuan.  
* **Acceptance Criteria:**  
  * Given pengguna menginput barang masuk 2 Rim Kertas (1.000 Lembar) dengan harga Rp 250.000/Rim, When diposting, Then stok bertambah 1.000 Lembar, dan kartu stok mencatat mutasi beserta snapshot harga belinya.

### **FR-003: Pencatatan Barang Keluar (Outbound)**

* **Tujuan:** Mengeluarkan stok untuk kebutuhan produksi.  
* **Aktor:** Petugas Gudang.  
* **Input Field:** No. Form Permintaan (opsional), Divisi/Pemohon, SKU, Qty Keluar, Satuan, Catatan.  
* **Acceptance Criteria:**  
  * Given Qty Keluar melebihi Stok Tersedia, When pengguna menekan simpan, Then sistem menampilkan peringatan stok kurang, namun tetap mengizinkan simpan jika mengonfirmasi catatan alasan (Sesuai kebijakan penanganan stok minus fleksibel).

### **FR-004: Pemotongan Kertas & Pembuatan SKU Sisa**

* **Tujuan:** Mengelola pemotongan kertas plano dan pemisahan sisa potong $\geq 20cm$ vs *Waste*.  
* **Aktor:** Petugas Gudang.  
* **Acceptance Criteria:**  
  * Given Petugas menginput pemotongan Kertas AP 150g dengan sisa ukuran $15cm\times 20cm$, When diproses, Then sistem memasukkan sisa tersebut sebagai *Waste* (tidak ada SKU baru).  
  * Given Petugas menginput sisa ukuran $25cm\times 40cm$, When diproses, Then sistem mewajibkan pembuatan/pemilihan SKU Kategori Sisa dan menambah saldo pada SKU Sisa tersebut.

### **FR-005: Non-Blocking Stock Opname**

* **Tujuan:** Melakukan penyesuaian stok fisik tanpa menghentikan operasional transaksi harian.  
* **Aktor:** Petugas Gudang (Input Hitung), Admin/Manager (Approval Penyesuaian).  
* **Acceptance Criteria:**  
  * Given Sesi Opname aktif, When transaksi harian dilakukan, Then transaksi tetap sukses diposting dan sistem memperhitungkan *offset* mutasi pada kalkulasi selisih opname akhir.

## **6\. MODEL DATA & ENTITAS UTAMA**

![][image2]

## **7\. PENANGANAN ERROR & AUDIT TRAIL**

### **7.1 Mencegah Concurrency & Duplicate Submissions**

* **Client-side Prevention:** Tombol simpan langsung memasuki kondisi *disabled* dan menampilkan *loading spinner* setelah diklik 1 kali.  
* **Server-side Prevention:** Menggunakan transaksi atomic (database transaction lock) saat penulisan saldo stok agar perhitungan saldo tetap tepat meskipun dua petugas menyimpan data pada detik yang sama.

### **7.2 Spesifikasi Audit Trail (Wajib)**

Sistem mencatat secara otomatis ke dalam tabel log yang tidak dapat diubah (*read-only log*):

* **Waktu Tepat:** Timestamp presisi hingga detik.  
* **Aktor:** ID & Nama Pengguna yang melakukan aksi.  
* **Modul & Jenis Aksi:** (INSERT / REVERSAL / ADJUSTMENT / MASTER\_UPDATE).  
* **Data Snapshot:** Nilai sebelum (*Before*) dan nilai sesudah (*After*).  
* **IP Address / Device Info:** Informasi alamat IP pengguna.

## **8\. LAPORAN & KEBUTUHAN INFORMASI**

1. **Laporan Saldo Stok Terkini:** Menampilkan Kode SKU, Nama Barang, Kategori, Stok Fisik, Satuan, Nilai Valuasi Terakhir.  
2. **Laporan Kartu Stok (Mutasi):** Dilihat per SKU dengan alur kronologis: Saldo Awal $\rightarrow$ Masuk $\rightarrow$ Keluar $\rightarrow$ Adjustment $\rightarrow$ Saldo Akhir.  
3. **Laporan Fluktuasi Harga Beli Supplier:** Grafik/Tabel riwayat perbandingan harga beli per SKU berdasarkan data Invoice penerimaan.  
4. **Laporan Selisih Stock Opname:** Menampilkan Saldo Sistem, Hasil Hitung Fisik, Selisih Kuantitas, dan Alasan Penyesuaian.  
5. **Fitur Ekspor:** Seluruh laporan wajib dapat di-ekspor ke format **Excel (.xlsx)** dan **PDF**.

## **9\. NON-FUNCTIONAL REQUIREMENTS (NFR)**

* **Usability:** Antarmuka web ramah pengguna pemula, ukuran tombol besar, serta bidang pencarian SKU berbasis pencarian cepat (*autocomplete*).  
* **Performance:** Waktu muat halaman dashboard dan laporan $<2$ detik untuk beban hingga $10.000$ baris data mutasi.  
* **Security & Access Control:**  
  * Login berbasis Akun Individual dengan enkripsi password (Bcrypt/Argon2).  
  * Akses berbasis peran (Role-Based Access Control / RBAC).  
* **Data Backup & Protection:**  
  * Pembuatan cadangan basis data (*Automated Database Backup*) harian.

## **10\. MATRIKS TRACEABILITY (PENGUJAN & VALIDASI)**

| Problem ID | Requirement ID | Business Rule | Acceptance Criteria | Scenario Test Case |
| :---- | :---- | :---- | :---- | :---- |
| **P-01** (Susah melacak stok manual & SKU ganda) | **FR-001** (Master SKU) | **BR-004** (Auto-archive sisa) | Master SKU unik dengan atribut kertas/tinta. | Pengujian input barang dengan SKU yang sama ditolak sistem. |
| **P-02** (Konversi Rim vs Lembar acak) | **FR-002** (Barang Masuk) | **BR-001** (1 Rim \= 500 Lembar) | Input 1 Rim otomatis menambah stok 500 Lembar. | Input 5 Rim, cek saldo di kartu stok apakah bernilai 2.500 Lembar. |
| **P-03** (Fluktuasi harga tak terdeteksi) | **FR-002** (Mandatory Price) | **BR-005** (Harga Beli Wajib) | Barang masuk wajib mencatat harga beli invoice. | Coba posting barang masuk tanpa mengisi harga beli, sistem memblokir simpan. |
| **P-04** (Sisa potong kertas terbengkalai) | **FR-004** (Pemotongan Kertas) | **BR-003** (Limit Sisa $\geq 20cm$) | Sisa $<20cm$ jadi waste, $\geq 20cm$ jadi SKU sisa. | Input potong kertas dengan sisa $10cm$, pastikan tidak muncul form SKU Sisa. |
| **P-05** (Opname menghentikan gudang) | **FR-005** (Non-blocking Opname) | **BR-007** (Fast Flow) | Transaksi harian tetap jalan saat sesi opname buka. | Buka Opname, buat transaksi Barang Keluar, pastikan selisih opname dihitung akurat. |

### **Langkah Selanjutnya Untuk Tim Pengembang & Desainer:**

1. **Tim UI/UX Designer:** Dapat langsung merancang *wireframe/figma* berdasarkan alur **FR-001 hingga FR-005** dan daftar field input di atas.  
2. **Tim Developer / System Architect:** Dapat memulai perancangan skema basis data (*Database Schema*) berdasarkan ERD Model Data pada Bagian 6 dan menyusun API endpoint transaksi.  
   

# **PRD (MVP) v2.0: Web App Operasional Gudang Percetakan**

*Versi 2.0 (revisi dari v1.0) · Disusun oleh Claude · 27 Oktober 2026 · Status: Draft untuk review pemilik produk*

## **0\. Cara Membaca Dokumen Ini**

Dokumen ini merevisi PRD v1.0 dan menutup seluruh temuan review kesiapan production. Keputusan yang tidak bisa diambil dari dokumen asli diberi nilai default yang masuk akal dan ditandai **\[Asumsi\]**. Semua asumsi dikumpulkan di Bagian 12 untuk dikonfirmasi pemilik produk sebelum development dimulai.

Prioritas memakai skala MoSCoW: **Must** (wajib sebelum go-live), **Should** (dianjurkan, Rilis 1.1), **Could** (backlog).

**Perubahan utama dibanding v1.0**

| Area | v1.0 | v2.0 |
| :---- | :---- | :---- |
| Purchase Order | Disebut di scope, tanpa detail | Modul lengkap: status, penomoran, penerimaan sebagian, cetak PDF, rekap (FR-08 s.d. FR-10) |
| Jenis transaksi | IN, OUT, ADJUSTMENT | IN, OUT, ADJUSTMENT, OPENING, REVERSAL (void) |
| Tipe kuantitas | integer | decimal(15,3), bertanda per baris mutasi |
| Konsistensi stok | Tidak dispesifikasikan | Atomic, row locking, constraint stok tidak minus, rekonsiliasi harian |
| Anti-duplikat | Hanya disebut | request\_id unik divalidasi di server |
| Koreksi salah input | Tidak ada | Void/reversal dengan alasan wajib |
| Data master | Kategori teks bebas | Master kategori, satuan, supplier; soft delete |
| Role | 2 role | 3 role dengan matriks hak akses |
| Laporan | Saldo dan kartu stok | Ditambah laporan periodik, pemakaian per SPK, nilai persediaan, rekap PO, ekspor |
| NFR | Tidak ada | Keamanan, performa, backup, audit log, kompatibilitas, monitoring |
| Persiapan production | Tidak ada | Rencana UAT, migrasi data, go-live paralel, pelatihan, support |

## **1\. Ringkasan Eksekutif**

Aplikasi web untuk mencatat pergerakan stok gudang percetakan, membuat dan memantau purchase order (PO), serta menyajikan laporan stok yang akurat.

**Tujuan utama:** menghilangkan pencatatan manual/buku, mencegah *double input*, memastikan pelaporan teratur, memudahkan pelacakan sisa stok aktual, dan menghubungkan pembelian (PO) dengan penerimaan barang.

**Indikator keberhasilan** (diukur 1 bulan setelah go-live):

| Metrik | Target |
| :---- | :---- |
| Selisih stok fisik vs sistem saat stok opname | Di bawah 2% dari jumlah SKU yang dihitung |
| Transaksi masuk/keluar yang tercatat di aplikasi | 100% (buku manual dihentikan) |
| Transaksi ganda akibat double input | 0 |
| Waktu input satu transaksi (3 barang) | Di bawah 1 menit |
| PO yang dibuat lewat aplikasi | 100% |
| Laporan bulanan tersedia | Paling lambat H+1 setelah akhir bulan |

## **2\. Ruang Lingkup**

**In-scope, dibagi per rilis**

| Rilis | Cakupan |
| :---- | :---- |
| Rilis 1 (Go-live, Must) | Login dan role, manajemen user, master barang/kategori/satuan/supplier, PO lengkap, barang masuk (termasuk dari PO), barang keluar, void/reversal, opening balance dan impor CSV, koreksi stok, dashboard stok minimum, laporan saldo dan kartu stok, ekspor, audit log |
| Rilis 1.1 (Should) | Stok opname terstruktur, laporan periodik, rekap pemakaian per SPK, laporan nilai persediaan |
| Backlog (Could) | Tutup periode bulanan, notifikasi email stok minimum dan PO terlambat, kirim PO via email dari aplikasi, revisi PO bernomor, impor Excel master barang |

**Out-of-scope (tidak dikerjakan di versi ini)**

•         Konversi satuan rumit (Rim ke Lembar). Semua barang diinput dalam satuan dasar terkecil (kertas dalam Lembar, tinta dalam Gram atau Botol).  
•         Approval bertingkat, integrasi *barcode scanner*, dan multi-gudang.  
•         Integrasi dengan sistem akuntansi/ERP dan master Job/SPK terintegrasi (Nomor SPK tetap berupa teks yang divalidasi formatnya).  
•         Modul retur khusus. Retur ke supplier dicatat sebagai transaksi Barang Keluar dengan catatan; sisa bahan yang kembali dari produksi dicatat sebagai Koreksi Stok (lihat pertanyaan terbuka di Bagian 12).  
•         Perhitungan pajak yang kompleks. PO hanya menyediakan kolom PPN (%) opsional.

**Keputusan satuan dan kuantitas:** kuantitas disimpan sebagai decimal(15,3) agar tinta (gram/liter) dan barang pecahan bisa dicatat. Tiap barang punya flag allow\_decimal; jika false (misal Lembar, Pcs), sistem menolak kuantitas pecahan.

## **3\. Peran Pengguna dan Matriks Hak Akses**

Tiga role, karena Admin sistem dan Kepala Gudang bisa jadi dua orang dengan kebutuhan berbeda. Jika keduanya orang yang sama, cukup beri akun satu role Admin.

1\.       **Admin:** mengelola user, konfigurasi, opening balance/impor, audit log, dan memiliki seluruh hak Kepala Gudang.  
2\.       **Kepala Gudang:** supervisi operasional. Mengelola master barang dan supplier, membuat/mengirim/membatalkan PO, melakukan void, koreksi, dan stok opname, serta melihat semua laporan dan harga.  
3\.       **Petugas Gudang:** mencatat Barang Masuk dan Barang Keluar, melihat stok, dan melihat PO untuk keperluan penerimaan (tanpa harga).

| Fitur | Admin | Kepala Gudang | Petugas |
| :---- | :---- | :---- | :---- |
| Login, ganti password sendiri | Ya | Ya | Ya |
| Kelola user dan role, reset password user | Ya | Tidak | Tidak |
| Master barang/kategori/satuan/supplier (tambah, ubah, nonaktifkan) | Ya | Ya | Hanya lihat |
| Lihat harga dan nilai persediaan | Ya | Ya | Tidak |
| Buat dan ubah PO Draft | Ya | Ya | Tidak |
| Kirim, batalkan, tutup manual PO | Ya | Ya | Tidak |
| Lihat PO (tanpa harga untuk Petugas) | Ya | Ya | Ya |
| Catat Barang Masuk dan Barang Keluar | Ya | Ya | Ya |
| Void (reversal) transaksi | Ya | Ya | Tidak |
| Koreksi stok dan stok opname | Ya | Ya | Tidak |
| Opening balance dan impor CSV | Ya | Tidak | Tidak |
| Lihat saldo stok dan dashboard | Ya | Ya | Ya |
| Kartu stok per barang (tanpa harga untuk Petugas) | Ya | Ya | Ya |
| Daftar riwayat transaksi | Semua | Semua | Hanya miliknya |
| Laporan periodik, rekap PO, nilai persediaan | Ya | Ya | Tidak |
| Ekspor laporan | Semua laporan | Semua laporan | Hanya saldo stok |
| Audit log | Ya | Tidak | Tidak |

Catatan: pertentangan di v1.0 (Petugas hanya "melihat ketersediaan stok" vs FR-05 yang hanya menyebut Admin) diselesaikan oleh matriks ini. Seluruh pengecekan hak akses dilakukan di server (BR-15).

## **4\. Aturan Bisnis (Business Rules)**

•         **BR-01 Blokir stok minus:** Barang Keluar, Koreksi negatif, dan void dari transaksi Barang Masuk **ditolak** jika membuat stok kurang dari nol. Pengecekan dilakukan server saat commit, di dalam lock (BR-04), bukan hanya di UI. Transaksi multi-barang bersifat *all-or-nothing*.  
•         **BR-02 Audit trail mutlak:** current\_stock tidak bisa diedit siapa pun, tidak ada endpoint maupun layar untuk itu. Stok hanya berubah lewat transaksi IN, OUT, ADJUSTMENT, OPENING, atau REVERSAL. Transaksi **tidak boleh di-UPDATE atau DELETE**; koreksi hanya lewat REVERSAL atau ADJUSTMENT.  
•         **BR-03 Pencegahan duplikat:** setiap form menghasilkan request\_id (UUID) saat dibuka. Server menolak pemakaian request\_id yang sama dan mengembalikan hasil transaksi yang sudah tersimpan. Menonaktifkan tombol Simpan saat proses berjalan hanya lapisan tambahan.  
•         **BR-04 Atomicity dan locking:** simpan header, detail, dan pembaruan current\_stock dalam **satu database transaction**; gagal sebagian berarti rollback total. Baris items dikunci dengan SELECT ... FOR UPDATE secara terurut berdasarkan item\_id untuk mencegah *race condition* dan *deadlock*. Database juga memasang CHECK (current\_stock \>= 0\) sebagai pengaman terakhir.  
•         **BR-05 Rekonsiliasi:** job harian membandingkan current\_stock dengan SUM(qty\_delta) per barang. Selisih ditulis ke log dan ditampilkan sebagai peringatan di dashboard Admin.  
•         **BR-06 Void/reversal:** transaksi hanya bisa dibatalkan lewat transaksi REVERSAL penuh (semua baris), oleh Admin atau Kepala Gudang, dengan alasan wajib (minimal 10 karakter). Satu transaksi hanya bisa di-void sekali dan REVERSAL tidak bisa di-void. Void Barang Masuk dari PO mengembalikan qty\_received PO dan status PO dihitung ulang.  
•         **BR-07 Koreksi stok:** setiap baris ADJUSTMENT punya arah (tambah/kurang) lewat qty\_delta bertanda dan **alasan wajib** (pilihan: selisih opname, rusak, hilang, sisa produksi kembali, salah catat, lainnya) ditambah catatan.  
•         **BR-08 Tanggal transaksi:** default hari ini (WIB), tidak boleh tanggal masa depan. Petugas boleh mundur maksimal 2 hari, Kepala Gudang dan Admin maksimal 30 hari **\[Asumsi, bisa diatur di pengaturan\]**. Kartu stok diurutkan berdasarkan urutan pencatatan, dengan tanggal transaksi sebagai kolom. Laporan periodik dihitung dari tanggal transaksi sehingga bisa berubah bila ada transaksi mundur; itu sebabnya batas mundur dibuat ketat dan Tutup Periode masuk backlog.  
•         **BR-09 Soft delete:** barang, supplier, kategori, satuan, dan user yang pernah dipakai tidak boleh dihapus permanen, hanya dinonaktifkan (is\_active \= false). Barang nonaktif tidak muncul di form transaksi baru namun tetap tampil di riwayat dan laporan. Barang hanya bisa dinonaktifkan jika stok 0 dan tidak ada PO terbuka.  
•         **BR-10 Keunikan dan penguncian:** SKU unik (tidak peka huruf besar/kecil). SKU dan satuan dasar terkunci setelah barang punya transaksi.  
•         **BR-11 Penerimaan PO:** kuantitas diterima kumulatif tidak boleh melebihi kuantitas PO ditambah toleransi. Toleransi default 0% dan bisa diatur Admin di pengaturan **\[Asumsi\]**.  
•         **BR-12 Nomor dokumen otomatis:** nomor PO PO/YYYY/MM/NNNN dan nomor transaksi IN/, OUT/, ADJ/, OPN/, REV/ dengan pola sama (urutan reset tiap bulan). Nomor dibuat server di dalam database transaction lewat tabel document\_sequences, unik, dan tidak dipakai ulang meski dokumen dibatalkan.  
•         **BR-13 Validasi referensi:** Barang Masuk wajib Nomor Nota/Surat Jalan supplier; Barang Keluar wajib Nomor Job/SPK. Nomor SPK boleh dipakai berulang (satu job bisa beberapa kali pengambilan) dan dinormalisasi (trim, huruf besar). Nomor nota yang sama dari supplier yang sama memicu peringatan duplikat yang harus dikonfirmasi pengguna.  
•         **BR-14 Harga dan nilai persediaan:** harga beli (unit\_cost) dicatat di PO dan Barang Masuk. Nilai persediaan memakai **rata-rata bergerak** (*moving average*) per barang, disimpan di items.avg\_cost **\[Asumsi\]**. Transaksi keluar dan koreksi mencatat unit\_cost sebesar avg\_cost saat itu; REVERSAL memakai unit\_cost transaksi asal dan avg\_cost dihitung ulang. Hanya Admin dan Kepala Gudang yang melihat harga.  
•         **BR-15 Otorisasi di server:** setiap endpoint memeriksa role dan kepemilikan data. Menyembunyikan menu di UI tidak dianggap sebagai kontrol akses.

## **5\. Kebutuhan Fungsional (User Stories dan Acceptance Criteria)**

Semua validasi dan aturan di bawah ditegakkan di server; validasi di UI hanya untuk kemudahan pengguna.

### **FR-01: Autentikasi dan Sesi (Must)**

*Story:* Sebagai pengguna, saya login dengan email dan password agar hanya saya yang bisa memakai akun saya.

•         Menu dan API dibatasi sesuai role (BR-15).  
•         Password disimpan dengan argon2id atau bcrypt. Kebijakan: minimal 10 karakter dan tidak boleh sama dengan email.  
•         Akun terkunci 15 menit setelah 5 kali gagal login berturut-turut; rate limiting per IP.  
•         Sesi berakhir setelah 30 menit tidak aktif dan maksimal 12 jam **\[Asumsi\]**.  
•         Pengguna bisa mengganti password sendiri (wajib memasukkan password lama) dan logout.  
•         Pesan error login tidak membocorkan apakah email terdaftar.

### **FR-02: Manajemen User (Must, Admin)**

*Story:* Sebagai Admin, saya mengelola akun karyawan gudang.

•         Tambah user (nama, email unik, role, password sementara). User wajib mengganti password saat login pertama.  
•         Ubah role, nonaktifkan/aktifkan user, dan reset password (menghasilkan password sementara sekali pakai).  
•         User nonaktif tidak bisa login, riwayat transaksinya tetap utuh. Tidak ada hapus permanen.  
•         Sistem menolak menonaktifkan atau menurunkan role Admin terakhir yang aktif.  
•         Semua perubahan tercatat di audit log (FR-16).

### **FR-03: Kelola Master Barang (Must)**

*Story:* Sebagai Admin atau Kepala Gudang, saya mengelola data barang cetak.

•         Field: SKU, nama, kategori (dropdown master), satuan dasar (dropdown master), stok minimum (min\_stock), allow\_decimal, status aktif, keterangan.  
•         SKU unik (BR-10). Stok awal otomatis 0 dan hanya terisi lewat Opening Balance (FR-11) atau transaksi; stok dan avg\_cost tidak bisa diedit di form.  
•         Penguncian SKU dan satuan setelah ada transaksi (BR-10); penonaktifan mengikuti BR-09.  
•         Daftar barang punya pencarian (SKU/nama), filter kategori dan status, pengurutan, serta pagination 25/50/100 per halaman.

### **FR-04: Master Kategori, Satuan, dan Supplier (Must)**

*Story:* Sebagai Admin atau Kepala Gudang, saya mengelola data pendukung agar input konsisten (tidak ada "Kertas" vs "kertas").

•         Kategori dan satuan: nama unik (tidak peka huruf besar/kecil), bisa diubah namanya, bisa dinonaktifkan.  
•         Supplier: kode otomatis, nama, nama kontak (PIC), telepon, email, alamat, catatan termin pembayaran, status aktif.  
•         Supplier nonaktif tidak bisa dipilih di PO atau Barang Masuk baru.  
•         Pencarian dan pagination pada semua daftar master.

### **FR-05: Dashboard dan Peringatan Stok Minimum (Must)**

*Story:* Sebagai pengguna gudang, saya langsung melihat barang yang perlu dipesan dan PO yang perlu ditindaklanjuti.

•         Dashboard menampilkan: jumlah barang di bawah atau sama dengan stok minimum, daftar barang kritis (diurutkan rasio stok terhadap minimum), PO terbuka (Dikirim atau Diterima Sebagian), PO terlambat, dan 10 transaksi terakhir.  
•         Dari daftar stok minimum, Kepala Gudang dan Admin bisa memilih barang lalu menekan **Buat PO**; sistem membuat PO Draft dengan kuantitas usulan (stok minimum dikurangi stok saat ini) yang bisa diubah.  
•         Petugas melihat peringatan stok minimum tanpa data harga.

### **FR-06: Transaksi Barang Masuk (Must)**

*Story:* Sebagai Petugas Gudang, saya mencatat barang masuk dari supplier, dengan atau tanpa PO.

•         Satu transaksi bisa **multi-barang**: tabel baris dinamis (tambah/hapus baris). Barang yang sama tidak boleh muncul dua kali dalam satu transaksi.  
•         Wajib: tanggal, supplier, Nomor Nota/Surat Jalan, dan minimal 1 baris dengan kuantitas lebih dari 0\. Berlaku BR-03, BR-08, BR-13.  
•         Opsional menautkan ke PO: pilih PO berstatus Dikirim atau Diterima Sebagian milik supplier tersebut. Baris terisi otomatis dengan sisa kuantitas PO dan bisa diubah; kuantitas melebihi sisa ditolak (BR-11).  
•         Harga satuan default dari PO. Pada Barang Masuk tanpa PO, harga bersifat opsional dan hanya bisa diisi Admin atau Kepala Gudang; bila kosong, barang dinilai pada avg\_cost terakhir (BR-14).  
•         Setelah disimpan: stok bertambah, status PO diperbarui otomatis, dan layar konfirmasi menampilkan nomor transaksi (misal IN/2026/10/0001).

### **FR-07: Transaksi Barang Keluar (Must)**

*Story:* Sebagai Petugas Gudang, saya mencatat bahan yang diambil untuk produksi.

•         Multi-barang. Wajib: tanggal, Nomor Job/SPK, dan minimal 1 baris dengan kuantitas lebih dari 0; catatan opsional. Berlaku BR-01, BR-03, BR-08, BR-13.  
•         Saat memilih barang, UI menampilkan stok tersedia di samping baris (informasi, bukan jaminan; yang menentukan adalah pengecekan server).  
•         Jika ada satu barang yang stoknya tidak cukup, **seluruh transaksi ditolak** dengan pesan yang menyebut barang dan stok tersedia.  
•         Nomor SPK dinormalisasi dan boleh berulang. Layar konfirmasi menampilkan nomor transaksi (OUT/2026/10/0001).

### **FR-08: Purchase Order, Pembuatan dan Siklus Status (Must)**

*Story:* Sebagai Kepala Gudang, saya membuat PO ke supplier, menandainya terkirim, dan memantau penerimaannya.

•         **Header:** Nomor PO otomatis PO/YYYY/MM/NNNN (BR-12), supplier (wajib, aktif), tanggal PO, tanggal kirim yang diharapkan, PPN (%) opsional (default 0), dan catatan.  
•         **Baris:** barang aktif, kuantitas lebih dari 0, harga satuan 0 atau lebih, subtotal dan total dihitung otomatis. Barang yang sama tidak boleh muncul dua kali dalam satu PO.  
•         **Draft** bisa diedit bebas. Draft yang tidak jadi dipakai **dibatalkan**, bukan dihapus, agar urutan nomor tetap utuh.  
•         **Setelah Dikirim**, kuantitas, harga, dan barang terkunci; hanya catatan dan tanggal yang diharapkan yang bisa diubah. Perubahan substansi dilakukan dengan membatalkan PO dan membuat PO baru (revisi PO bernomor masuk backlog).  
•         Pembatalan wajib alasan dan hanya untuk PO Draft atau Dikirim yang belum punya penerimaan. PO yang sudah diterima sebagian tidak bisa dibatalkan, tetapi bisa **Ditutup Manual** (sisa kuantitas tidak jadi dikirim), juga dengan alasan wajib.  
•         **Cetak/Unduh PDF PO:** kop perusahaan, nomor dan tanggal PO, data supplier, tabel barang (kuantitas, satuan, harga, subtotal), total, catatan, dan kolom tanda tangan. Pengiriman ke supplier dilakukan manual oleh pengguna (email atau WhatsApp), lalu PO ditandai Dikirim.  
•         Siapa yang boleh: membuat, mengirim, membatalkan, dan menutup PO hanya Admin dan Kepala Gudang (lihat matriks di Bagian 3).

**Siklus status PO**

| Status | Arti | Transisi yang diizinkan |
| :---- | :---- | :---- |
| Draft | PO sedang disusun, belum dikirim | Dikirim, Dibatalkan |
| Dikirim | Sudah dikirim ke supplier, belum ada penerimaan | Diterima Sebagian atau Diterima Penuh (otomatis), Dibatalkan |
| Diterima Sebagian | Ada penerimaan, masih ada sisa kuantitas | Diterima Penuh (otomatis), Ditutup Manual |
| Diterima Penuh | Semua baris sudah diterima sesuai kuantitas | Final. Kembali ke Diterima Sebagian atau Dikirim hanya jika penerimaan di-void |
| Ditutup Manual | Sisa kuantitas tidak akan dikirim supplier | Final |
| Dibatalkan | Dibatalkan sebelum ada penerimaan | Final |

### **FR-09: Purchase Order, Penerimaan Barang dan Selisih (Must)**

*Story:* Sebagai Petugas Gudang, saya menerima barang berdasarkan PO dan melihat selisih antara yang dipesan dan yang datang.

•         Halaman detail PO punya tombol **Terima Barang** yang membuka form Barang Masuk (FR-06) dengan baris terisi dari sisa PO.  
•         Penerimaan bisa bertahap (*partial receipt*) tanpa batas jumlah selama masih ada sisa. Setiap penerimaan adalah satu transaksi IN yang tertaut ke PO.  
•         Detail PO menampilkan per baris: kuantitas dipesan, diterima, sisa, dan selisih, ditambah riwayat penerimaan (tautan ke transaksi IN).  
•         Penerimaan melebihi kuantitas PO ditolak sesuai toleransi (BR-11).  
•         Status PO berubah otomatis setelah penerimaan dan setelah void penerimaan (BR-06).  
•         Petugas melihat PO tanpa kolom harga.

### **FR-10: Rekapitulasi PO (Must)**

*Story:* Sebagai Kepala Gudang atau Admin, saya merekap PO per periode, supplier, dan status.

•         Daftar PO dengan filter periode (tanggal PO), supplier, status, nomor PO, dan barang; pencarian dan pagination.  
•         Kolom: nomor PO, tanggal, supplier, status, total nilai, persentase terpenuhi, tanggal kirim yang diharapkan, dan penanda **terlambat** (lewat tanggal harapan dan belum Diterima Penuh).  
•         Ringkasan di atas tabel: jumlah PO per status dan total nilai PO pada periode terpilih.  
•         Rekap per supplier: jumlah PO, total nilai, dan persentase terpenuhi.  
•         Bisa diekspor (FR-15). Rekap tidak bisa diakses Petugas.

### **FR-11: Opening Balance dan Impor Data Awal (Must, Admin)**

*Story:* Sebagai Admin, saya memasukkan stok awal dari pencatatan buku manual tanpa melanggar audit trail.

•         Impor CSV untuk master barang (SKU, nama, kategori, satuan, stok minimum) dengan pratinjau dan laporan error per baris sebelum disimpan. Baris bermasalah tidak mengikutkan baris lain yang valid.  
•         Opening balance dicatat sebagai transaksi bertipe **OPENING** (nomor OPN/YYYY/MM/NNNN), berisi kuantitas dan harga satuan awal per barang, sehingga tampil di kartu stok.  
•         Opening balance hanya bisa dilakukan sekali per barang; selanjutnya perubahan memakai Koreksi (FR-13).  
•         Fitur ini dikunci setelah tanggal cut-over yang ditetapkan di pengaturan (lihat Bagian 9).

### **FR-12: Void/Reversal Transaksi (Must)**

*Story:* Sebagai Kepala Gudang, saya membatalkan transaksi yang salah input tanpa menghapus jejaknya.

•         Dari detail transaksi IN, OUT, ADJUSTMENT, atau OPENING, Admin dan Kepala Gudang memilih **Void**, mengisi alasan wajib (minimal 10 karakter), lalu sistem membuat transaksi REVERSAL (REV/YYYY/MM/NNNN) yang membalik semua baris.  
•         Transaksi asal ditandai *Dibatalkan* dan menampilkan tautan ke REVERSAL-nya; keduanya tetap terlihat di kartu stok.  
•         Aturan BR-01 berlaku: void ditolak jika stoknya sudah terpakai (misal void Barang Masuk setelah barangnya keluar). Pesan error menyebut barang dan kekurangannya.  
•         Satu transaksi hanya bisa di-void sekali, REVERSAL tidak bisa di-void. Untuk memperbaiki, buat transaksi baru yang benar.  
•         Void Barang Masuk dari PO memperbarui qty\_received dan status PO.

### **FR-13: Koreksi Stok dan Stok Opname (Must untuk Koreksi, Should untuk Opname)**

*Story:* Sebagai Kepala Gudang, saya menyesuaikan stok sistem dengan stok fisik secara tercatat.

•         **Koreksi (Must):** transaksi ADJUSTMENT per barang dengan arah tambah atau kurang, kuantitas, **alasan wajib** dari daftar (BR-07), dan catatan. Koreksi kurang tunduk pada BR-01.  
•         **Stok Opname (Should, Rilis 1.1):** Kepala Gudang membuat sesi opname (seluruh barang atau per kategori). Sistem membekukan *snapshot* stok sistem, petugas memasukkan jumlah hitung fisik, sistem menampilkan selisih per barang, lalu Kepala Gudang menyetujui dan sistem membuat satu transaksi ADJUSTMENT untuk semua selisih.  
•         Selisih opname dihitung terhadap snapshot, lalu diterapkan sebagai delta. Transaksi yang terjadi selama opname tidak merusak hasilnya.  
•         Riwayat sesi opname dapat dilihat dan diekspor.

### **FR-14: Laporan dan Kartu Stok (Must untuk saldo dan kartu stok, Should untuk lainnya)**

*Story:* Sebagai Admin atau Kepala Gudang, saya melihat saldo, mutasi, dan ringkasan periodik untuk pelaporan teratur.

•         **Saldo Stok Terkini (Must):** tabel barang dengan stok aktual, satuan, stok minimum, dan penanda di bawah minimum; filter kategori; pencarian; pagination. Nilai persediaan hanya untuk Admin dan Kepala Gudang.  
•         **Kartu Stok (Must):** klik barang untuk melihat histori: tanggal transaksi, nomor transaksi, tipe (masuk, keluar, koreksi, opening, reversal), nomor referensi, kuantitas bertanda, saldo setelah transaksi, catatan, dan user yang menginput. Filter rentang tanggal dan tipe. Transaksi dengan status Dibatalkan diberi tanda.  
•         **Laporan Periodik (Should):** per barang dan periode: stok awal, total masuk, total keluar, koreksi, stok akhir, dan nilai (untuk role yang berhak). Periode bebas (harian, bulanan, kustom).  
•         **Pemakaian per Job/SPK (Should):** total barang keluar per Nomor SPK dan periode, dengan rincian barang dan kuantitas.  
•         **Nilai Persediaan (Should):** stok dikalikan avg\_cost per barang dan per kategori pada tanggal tertentu.  
•         **Riwayat Transaksi:** daftar semua transaksi dengan filter tipe, tanggal, referensi, dan user. Petugas hanya melihat transaksi miliknya.

### **FR-15: Ekspor Laporan (Must)**

•         Semua laporan dan daftar (saldo, kartu stok, riwayat transaksi, rekap PO, laporan periodik) bisa diekspor ke **Excel (.xlsx)** dan **CSV**; PO dan laporan ringkas juga ke **PDF**.  
•         Ekspor mengikuti filter yang sedang aktif dan mematuhi hak akses (kolom harga tidak ikut jika role tidak berhak).  
•         Ekspor besar dibatasi (misal 50.000 baris) dan menampilkan pesan jika terlampaui.  
•         Setiap ekspor tercatat di audit log.

### **FR-16: Audit Log (Must)**

*Story:* Sebagai Admin, saya bisa menelusuri siapa melakukan apa dan kapan di luar transaksi stok.

•         Dicatat: login berhasil dan gagal, logout, ganti dan reset password, perubahan user dan role, perubahan data master (nilai lama dan baru), perubahan status PO, perubahan pengaturan, impor, ekspor, dan void.  
•         Field: waktu, user, aksi, objek, nilai sebelum dan sesudah, alamat IP.  
•         Hanya Admin yang bisa melihat; log tidak bisa diedit atau dihapus lewat aplikasi. Filter berdasarkan user, aksi, dan tanggal.  
•         Retensi minimal 2 tahun **\[Asumsi\]**.

### **FR-17: Pencarian, Filter, dan Pagination Umum (Must)**

•         Setiap daftar (barang, transaksi, PO, supplier, kartu stok, log) punya pencarian teks, filter relevan, pengurutan kolom, dan pagination (25/50/100 per halaman).  
•         Filter dan halaman terakhir dipertahankan ketika pengguna kembali dari halaman detail.  
•         Semua daftar tetap bisa dipakai di layar HP (kolom penting diprioritaskan atau tabel bisa digeser).

## **6\. Kebutuhan Non-Fungsional (NFR)**

Angka performa dan kapasitas adalah **\[Asumsi\]** dan perlu dikonfirmasi.

| ID | Area | Persyaratan |
| :---- | :---- | :---- |
| NFR-01 | Keamanan | Seluruh akses lewat HTTPS (TLS 1.2 ke atas); cookie sesi memakai flag Secure, HttpOnly, dan SameSite |
| NFR-02 | Keamanan | Password di-hash dengan argon2id atau bcrypt; tidak pernah dicatat di log atau dikirim ulang dalam teks biasa |
| NFR-03 | Keamanan | Proteksi terhadap CSRF, XSS, dan SQL injection (query berparameter, escaping output, validasi input di server) |
| NFR-04 | Keamanan | Rate limiting login, lockout setelah 5 kali gagal selama 15 menit, timeout sesi idle 30 menit |
| NFR-05 | Keamanan | Akun database aplikasi tidak punya hak UPDATE atau DELETE pada tabel transaksi dan detail transaksi (penguat BR-02) |
| NFR-06 | Performa | Halaman standar dan penyimpanan transaksi: respons p95 di bawah 1 detik; laporan sampai 12 bulan data di bawah 5 detik |
| NFR-07 | Kapasitas | Mendukung minimal 20 user bersamaan, 5.000 SKU, 500 transaksi per hari, dan pertumbuhan data 5 tahun tanpa perubahan arsitektur |
| NFR-08 | Ketersediaan | Target uptime 99% pada jam operasional gudang (misal Senin sampai Sabtu 07.00-18.00 WIB); pemeliharaan dijadwalkan di luar jam tersebut |
| NFR-09 | Backup | Backup database penuh harian, retensi 30 hari harian dan 12 bulan bulanan, salinan di lokasi terpisah (off-site) |
| NFR-10 | Recovery | RPO maksimal 24 jam (disarankan 1 jam dengan log transaksi), RTO maksimal 4 jam |
| NFR-11 | Recovery | **Uji restore** dilakukan sebelum go-live dan tiap kuartal, hasilnya didokumentasikan |
| NFR-12 | Audit | Audit log sesuai FR-16 dan rekonsiliasi stok harian sesuai BR-05 |
| NFR-13 | Kompatibilitas | Responsif (lebar mulai 360 px); form Barang Masuk dan Keluar nyaman dipakai di tablet dan HP (target sentuh besar); dua versi terbaru Chrome, Edge, Firefox, dan Safari |
| NFR-14 | Bahasa dan format | Antarmuka Bahasa Indonesia; tanggal DD/MM/YYYY; angka format Indonesia (1.234,56); zona waktu WIB, disimpan di database dalam UTC |
| NFR-15 | Monitoring | Pencatatan error terpusat, pemeriksaan uptime, dan peringatan ke pemilik teknis saat error beruntun atau aplikasi tidak bisa diakses |
| NFR-16 | Integritas data | Semua perubahan stok atomic (BR-04); migrasi skema dikelola dengan skrip versi yang bisa diulang dan di-rollback |
| NFR-17 | Kemudahan pakai | Petugas baru bisa mencatat transaksi pertama setelah pelatihan maksimal 30 menit; pesan error berbahasa jelas dan menyebut barang atau field yang bermasalah |

## **7\. Skema Database (Referensi untuk Developer)**

Database relasional (disarankan PostgreSQL atau MySQL 8 dengan InnoDB). Semua tabel memiliki id, created\_at, dan created\_by (kecuali tabel append-only), waktu disimpan dalam UTC. Tabel transactions dan transaction\_details bersifat **append-only**: tidak ada UPDATE atau DELETE (BR-02, NFR-05). Status "Dibatalkan" pada transaksi diturunkan dari keberadaan REVERSAL yang menunjuk ke transaksi itu, bukan dari kolom yang diubah.

### **7.1 users**

| Kolom | Tipe | Keterangan |
| :---- | :---- | :---- |
| name | varchar(100) | Wajib |
| email | varchar(150) | Unik, disimpan huruf kecil |
| password\_hash | varchar(255) | argon2id atau bcrypt |
| role | enum | admin, kepala\_gudang, petugas |
| is\_active | boolean | Default true; pengganti hapus |
| must\_change\_password | boolean | True untuk password sementara |
| failed\_login\_count, locked\_until | int, timestamp | Untuk lockout login |
| last\_login\_at, updated\_at | timestamp |   |

### **7.2 items**

| Kolom | Tipe | Keterangan |
| :---- | :---- | :---- |
| sku | varchar(50) | Unik tidak peka huruf besar/kecil; terkunci setelah ada transaksi |
| name | varchar(200) | Wajib |
| category\_id, unit\_id | FK | Ke master kategori dan satuan |
| current\_stock | decimal(15,3) | Default 0, CHECK (current\_stock \>= 0\), hanya diubah oleh proses transaksi |
| avg\_cost | decimal(18,4) | Rata-rata bergerak, default 0 |
| min\_stock | decimal(15,3) | Default 0, dasar peringatan stok minimum |
| allow\_decimal | boolean | False untuk barang bulat (Lembar, Pcs) |
| is\_active, notes, updated\_at |   | Soft delete |

### **7.3 transactions (append-only)**

| Kolom | Tipe | Keterangan |
| :---- | :---- | :---- |
| transaction\_number | varchar(30) | Unik, contoh IN/2026/10/0001 |
| type | enum | IN, OUT, ADJUSTMENT, OPENING, REVERSAL |
| transaction\_date | date | Tanggal bisnis (BR-08) |
| reference\_number | varchar(80) | Nomor Nota (IN), Nomor Job/SPK (OUT), dinormalisasi |
| supplier\_id | FK, null | Wajib untuk IN |
| purchase\_order\_id | FK, null | Terisi jika IN berasal dari PO |
| reverses\_transaction\_id | FK, null | Hanya untuk REVERSAL; **unik**, sehingga satu transaksi hanya bisa di-void sekali |
| reason\_code, notes | varchar | Wajib untuk ADJUSTMENT dan REVERSAL |
| request\_id | uuid | **Unik**, kunci idempotensi (BR-03) |
| user\_id, created\_at | FK, timestamp | Pencatat dan waktu pencatatan |

### **7.4 transaction\_details (append-only)**

| Kolom | Tipe | Keterangan |
| :---- | :---- | :---- |
| transaction\_id, item\_id | FK | Unik sebagai pasangan: satu barang satu baris per transaksi |
| po\_item\_id | FK, null | Baris PO yang diterima |
| quantity | decimal(15,3) | Positif, CHECK (quantity \> 0\), nilai yang diinput pengguna |
| qty\_delta | decimal(15,3) | **Bertanda**, efek ke stok: IN dan OPENING positif, OUT negatif, ADJUSTMENT dan REVERSAL sesuai arah |
| unit\_cost | decimal(18,4), null | Snapshot harga untuk nilai persediaan (BR-14) |
| balance\_after | decimal(15,3) | Saldo barang setelah baris ini, menurut urutan pencatatan |

### **7.5 purchase\_orders**

| Kolom | Tipe | Keterangan |
| :---- | :---- | :---- |
| po\_number | varchar(30) | Unik, PO/YYYY/MM/NNNN |
| supplier\_id | FK | Wajib |
| po\_date, expected\_date | date | Tanggal PO dan tanggal kirim yang diharapkan |
| status | enum | DRAFT, SENT, PARTIALLY\_RECEIVED, FULLY\_RECEIVED, CLOSED, CANCELLED |
| ppn\_percent | decimal(5,2) | Default 0 |
| subtotal, tax\_amount, total\_amount | decimal(18,2) | Dihitung server |
| notes, status\_reason | text | Alasan wajib untuk pembatalan dan tutup manual |
| sent\_at, closed\_at, cancelled\_at | timestamp, null | Jejak waktu status |
| updated\_at | timestamp |   |

### **7.6 purchase\_order\_items**

| Kolom | Tipe | Keterangan |
| :---- | :---- | :---- |
| purchase\_order\_id, item\_id | FK | Unik sebagai pasangan |
| qty\_ordered | decimal(15,3) | CHECK (qty\_ordered \> 0\) |
| qty\_received | decimal(15,3) | Default 0, CHECK (qty\_received \>= 0\); di-update atomic bersama transaksi IN dan REVERSAL |
| unit\_price | decimal(18,4) | 0 atau lebih |
| line\_total | decimal(18,2) | Dihitung server |

### **7.7 Tabel pendukung**

| Tabel | Kolom utama |
| :---- | :---- |
| suppliers | code (unik, otomatis), name, contact\_name, phone, email, address, payment\_terms, is\_active |
| categories | name (unik tidak peka huruf), is\_active |
| units | name (unik tidak peka huruf), is\_active |
| document\_sequences | doc\_type, period (YYYYMM), last\_number; PK gabungan; dinaikkan di dalam database transaction dengan lock |
| stock\_counts | count\_number, status (DRAFT, COUNTING, APPROVED, CANCELLED), scope, started\_by, approved\_by, approved\_at, adjustment\_transaction\_id |
| stock\_count\_items | stock\_count\_id, item\_id, system\_qty\_snapshot, counted\_qty, difference |
| audit\_logs (append-only) | occurred\_at, user\_id, action, entity\_type, entity\_id, old\_values (JSON), new\_values (JSON), ip\_address |
| settings | key, value: batas mundur tanggal, toleransi lebih terima PO, timeout sesi, tanggal cut-over |

### **7.8 Indeks yang wajib ada**

•         items: unik pada lower(sku); (category\_id, is\_active).  
•         transaction\_details: (item\_id, id) untuk kartu stok; (transaction\_id); unik (transaction\_id, item\_id).  
•         transactions: unik transaction\_number, unik request\_id, unik reverses\_transaction\_id; (transaction\_date); (type, transaction\_date); (reference\_number); (supplier\_id, reference\_number); (purchase\_order\_id).  
•         purchase\_orders: unik po\_number; (supplier\_id, status); (po\_date).  
•         audit\_logs: (occurred\_at); (user\_id, occurred\_at); (entity\_type, entity\_id).

### **7.9 Alur wajib penyimpanan transaksi**

1\.       Validasi input dan hak akses (BR-15).  
2\.       Mulai database transaction.  
3\.       Jika request\_id sudah ada, kembalikan hasil transaksi lama dan berhenti (BR-03).  
4\.       Kunci baris items terkait dengan SELECT ... FOR UPDATE terurut berdasarkan item\_id (BR-04).  
5\.       Validasi aturan bisnis: stok cukup (BR-01), sisa PO dan toleransi (BR-11), batas tanggal (BR-08), alasan wajib.  
6\.       Buat nomor dokumen dari document\_sequences (BR-12).  
7\.       Insert header dan detail dengan qty\_delta, unit\_cost, dan balance\_after.  
8\.       Update items.current\_stock dan avg\_cost, serta purchase\_order\_items.qty\_received dan status PO bila ada.  
9\.       Commit. Jika ada langkah yang gagal, rollback total.  
10\.   Tulis audit log untuk aksi yang relevan (void, koreksi, ekspor).

## **8\. Daftar Layar dan Alur Utama**

Wireframe resolusi rendah wajib dibuat dan disetujui sebelum development (lihat Bagian 10). Daftar layar minimal:

| Layar | Pengguna | Isi utama |
| :---- | :---- | :---- |
| Login, Ganti Password | Semua | Form login, ganti password, paksa ganti password pertama |
| Dashboard | Semua | Stok minimum, PO terbuka dan terlambat, transaksi terbaru |
| Daftar dan Form Barang | Admin, Kepala Gudang (Petugas hanya lihat) | Pencarian, filter, tambah, ubah, nonaktifkan |
| Master Kategori, Satuan, Supplier | Admin, Kepala Gudang | CRUD ringan dengan status aktif |
| Form Barang Masuk | Semua | Header, tabel baris dinamis, tautan PO opsional, konfirmasi nomor |
| Form Barang Keluar | Semua | Header SPK, tabel baris dengan stok tersedia, pesan error jelas |
| Daftar dan Detail Transaksi | Semua (Petugas hanya miliknya) | Filter, detail baris, tombol Void untuk yang berhak |
| Daftar PO, Form PO, Detail PO | Admin dan Kepala Gudang (Petugas hanya lihat tanpa harga) | Status, tombol Kirim, Batalkan, Tutup, Terima Barang, cetak PDF |
| Rekap PO | Admin, Kepala Gudang | Filter, ringkasan, ekspor |
| Saldo Stok dan Kartu Stok | Semua | Tabel saldo, histori per barang |
| Koreksi Stok dan Stok Opname | Admin, Kepala Gudang | Form koreksi, sesi opname, review selisih |
| Laporan | Admin, Kepala Gudang | Periodik, pemakaian per SPK, nilai persediaan, ekspor |
| Opening Balance dan Impor | Admin | Unggah CSV, pratinjau, laporan error |
| Manajemen User dan Pengaturan | Admin | User, role, parameter sistem |
| Audit Log | Admin | Filter dan pencarian log |

**Alur utama yang harus dibuat wireframe-nya:** (1) buat PO sampai Dikirim, (2) terima barang dari PO secara bertahap, (3) barang keluar untuk SPK dengan stok kurang, (4) void transaksi salah input, (5) stok opname sampai koreksi.

## **9\. Persiapan Production**

### **9.1 Environment dan Deployment**

•         Tiga environment terpisah: **development**, **staging** (mirip production, dipakai UAT), dan **production**, masing-masing dengan database dan kredensial sendiri.  
•         Rahasia (password database, kunci) disimpan di konfigurasi environment, bukan di kode.  
•         CI/CD: setiap perubahan menjalankan tes otomatis; deploy ke staging otomatis, deploy ke production dengan persetujuan manual dan bisa di-rollback.  
•         Hosting: server atau layanan cloud dengan domain, sertifikat SSL otomatis, backup terjadwal (NFR-09), dan akses admin server terbatas. Pilihan penyedia ditentukan pemilik produk.

### **9.2 Rencana Testing**

•         **Unit test** logika stok, rata-rata bergerak, status PO, penomoran dokumen, dan aturan tanggal.  
•         **Test konkurensi:** kirim banyak permintaan Barang Keluar paralel untuk barang yang sama; stok tidak boleh minus dan tidak ada deadlock.  
•         **Test idempotensi:** kirim request\_id yang sama berulang; hanya satu transaksi tersimpan.  
•         **Test keamanan:** daftar periksa OWASP Top 10, uji hak akses per role (akses langsung ke endpoint, bukan hanya menu), uji lockout dan rate limiting.  
•         **Test performa** sesuai NFR-06 dan NFR-07 dengan data uji sebesar data 5 tahun.  
•         **UAT** di staging dengan petugas gudang dan kepala gudang sungguhan memakai data yang mendekati nyata.

### **9.3 Skenario UAT Minimal**

| ID | Skenario | Hasil yang diharapkan |
| :---- | :---- | :---- |
| UAT-01 | Barang Keluar melebihi stok | Transaksi ditolak seluruhnya, pesan menyebut barang dan stok tersedia (BR-01) |
| UAT-02 | Tekan Simpan dua kali pada Barang Masuk | Hanya satu transaksi dan stok bertambah sekali (BR-03) |
| UAT-03 | Dua petugas mengeluarkan barang yang sama bersamaan, stok hanya cukup untuk satu | Satu berhasil, satu ditolak, stok tidak minus (BR-04) |
| UAT-04 | Coba mengubah atau menghapus transaksi yang sudah disimpan | Tidak ada jalur di UI maupun API (BR-02) |
| UAT-05 | Void Barang Masuk yang barangnya sudah keluar | Void ditolak dengan penjelasan (BR-06, BR-01) |
| UAT-06 | Void transaksi yang benar | REVERSAL tercatat, stok kembali, kartu stok menampilkan keduanya |
| UAT-07 | Buat PO, kirim, terima sebagian, terima sisanya | Status Dikirim, Diterima Sebagian, lalu Diterima Penuh; selisih benar di detail PO |
| UAT-08 | Terima barang melebihi sisa PO | Ditolak sesuai toleransi (BR-11) |
| UAT-09 | Void salah satu penerimaan PO | qty\_received dan status PO dihitung ulang |
| UAT-10 | Petugas mencoba membuat PO, melihat harga, atau membuka audit log | Ditolak di server walau URL diketik langsung (BR-15) |
| UAT-11 | Koreksi stok tanpa alasan | Ditolak; dengan alasan, tercatat sebagai ADJUSTMENT bertanda |
| UAT-12 | Backdate di luar batas role | Ditolak dengan pesan batas tanggal (BR-08) |
| UAT-13 | Impor CSV dengan baris bermasalah | Baris valid masuk, baris salah dilaporkan beserta alasannya |
| UAT-14 | Login salah 5 kali berturut-turut | Akun terkunci 15 menit dan tercatat di audit log |
| UAT-15 | Pulihkan backup ke staging | Data lengkap dan aplikasi berjalan (NFR-11) |

### **9.4 Rencana Migrasi Data**

1\.       Bersihkan dan standarkan daftar barang dari buku (SKU, nama, kategori, satuan dasar), lalu impor lewat FR-11.  
2\.       Kumpulkan data supplier aktif dan input lewat FR-04.  
3\.       Tetapkan **tanggal cut-over**, lalu lakukan **stok opname fisik** pada tanggal tersebut sebagai sumber opening balance.  
4\.       Input opening balance (tipe OPENING) beserta harga rata-rata terakhir jika tersedia.  
5\.       PO yang masih terbuka di buku diinput ulang sebagai PO dengan sisa kuantitas yang belum datang.  
6\.       Verifikasi: jumlah SKU, total stok per kategori, dan sampel acak minimal 10% barang dibandingkan dengan hasil hitung fisik.

### **9.5 Rencana Go-Live**

•         **Paralel run 2 sampai 4 minggu:** buku manual dan aplikasi dipakai bersamaan; setiap akhir pekan stok sampel dicocokkan antara buku, aplikasi, dan fisik.  
•         **Kriteria cut-over (semua terpenuhi):** UAT-01 sampai UAT-15 lulus; tidak ada bug kritis atau tinggi yang terbuka; selisih stok sampel di bawah 2% selama 2 minggu berturut-turut; semua petugas sudah dilatih; backup dan uji restore berhasil.  
•         **Setelah cut-over:** buku manual dihentikan dan disimpan sebagai arsip; aplikasi menjadi satu-satunya sumber data.  
•         **Rencana rollback:** selama paralel run, buku manual tetap sah sehingga kembali ke buku tidak kehilangan data. Setelah cut-over, rollback aplikasi dilakukan dengan memulihkan backup terakhir dan mengejar transaksi manual yang dicatat sementara.  
•         Masa *hypercare* 2 minggu pertama setelah go-live dengan pemantauan harian.

### **9.6 Pelatihan dan Dokumentasi**

•         Pelatihan tatap muka maksimal 1 jam per role (petugas dan kepala gudang), memakai staging.  
•         Panduan singkat bergambar (maksimal 5 halaman) untuk petugas: login, Barang Masuk, Barang Keluar, cek stok, dan apa yang dilakukan jika salah input.  
•         Panduan Kepala Gudang dan Admin: PO, void, koreksi, opname, laporan, user, dan backup.

### **9.7 Kepemilikan dan Support**

•         **Pemilik produk** (ditentukan pemilik bisnis): memutuskan prioritas dan menyetujui perubahan.  
•         **Penanggung jawab teknis:** menangani bug, pemantauan, dan backup.  
•         Jalur laporan masalah (satu kanal, misal grup WhatsApp khusus atau email) dan target respons: bug kritis di bawah 4 jam kerja, lainnya 2 hari kerja **\[Asumsi\]**.  
•         Permintaan perubahan masuk backlog dan dinilai bulanan.

## **10\. Timeline Estimasi**

Estimasi kasar untuk satu tim kecil (1 sampai 2 developer), perlu dikonfirmasi setelah desain teknis **\[Asumsi\]**.

| Fase | Durasi | Hasil |
| :---- | :---- | :---- |
| Finalisasi PRD, keputusan terbuka, wireframe | Minggu 1-2 | PRD final dan wireframe disetujui |
| Desain teknis dan setup environment | Minggu 2-3 | Skema database, CI/CD, staging |
| Pengembangan Rilis 1 (Must) | Minggu 3-8 | Semua FR bertanda Must |
| UAT dan perbaikan | Minggu 9-10 | UAT-01 s.d. UAT-15 lulus |
| Persiapan data dan pelatihan | Minggu 10-11 | Stok opname fisik, opening balance, pelatihan |
| Paralel run | Minggu 11-14 | Kriteria cut-over terpenuhi |
| Go-live dan hypercare | Minggu 15-16 | Buku manual dihentikan |
| Rilis 1.1 (Should) | Setelah hypercare, 3-4 minggu | Opname, laporan periodik, SPK, nilai persediaan |

## **11\. Risiko dan Mitigasi**

| Risiko | Dampak | Mitigasi |
| :---- | :---- | :---- |
| Petugas kembali ke buku karena aplikasi dianggap lambat | Data ganda dan tidak sinkron | Form ringkas, pelatihan, paralel run terbatas waktu, dukungan langsung |
| Data awal (stok dan SKU) tidak bersih | Stok sistem salah sejak hari pertama | Opname fisik saat cut-over, impor dengan pratinjau dan verifikasi sampel |
| Race condition stok | Stok minus atau tidak akurat | Locking, constraint database, test konkurensi (UAT-03) |
| Salah input yang tidak bisa dibetulkan | Kehilangan kepercayaan pengguna | Void/reversal (FR-12) dan koreksi (FR-13) |
| Backup tidak pernah diuji | Data hilang saat insiden | Uji restore terjadwal (NFR-11) |
| Perubahan scope di tengah jalan | Jadwal molor | Prioritas MoSCoW, backlog, persetujuan pemilik produk |
| Transaksi mundur mengubah laporan periode lampau | Laporan bulanan berubah setelah dikirim | Batas mundur ketat (BR-08), Tutup Periode di backlog |
| Satu orang memegang semua pengetahuan teknis | Pemeliharaan terhambat | Dokumentasi, README deployment, akses cadangan |

## **12\. Keputusan Terbuka dan Asumsi**

Berikut keputusan yang diambil dengan nilai default di dokumen ini. Mohon konfirmasi atau koreksi sebelum development dimulai.

| No | Keputusan | Default di PRD | Dikonfirmasi oleh |
| :---- | :---- | :---- | :---- |
| 1 | Nilai persediaan memakai harga | Dicatat; metode rata-rata bergerak (BR-14) | Pemilik bisnis |
| 2 | Jumlah role | Tiga: Admin, Kepala Gudang, Petugas | Pemilik bisnis |
| 3 | Batas mundur tanggal transaksi | Petugas 2 hari, Kepala Gudang dan Admin 30 hari | Kepala Gudang |
| 4 | Toleransi lebih terima dari PO | 0%, bisa diatur Admin | Kepala Gudang |
| 5 | Nomor Job/SPK | Teks bebas, boleh berulang, dinormalisasi | Produksi |
| 6 | Sisa bahan yang kembali dari produksi | Dicatat sebagai Koreksi Stok dengan alasan khusus | Kepala Gudang |
| 7 | Retur ke supplier | Dicatat sebagai Barang Keluar dengan catatan; modul retur khusus tidak ada | Kepala Gudang |
| 8 | Petugas melihat riwayat transaksi | Hanya miliknya; kartu stok terbuka untuk semua | Kepala Gudang |
| 9 | PPN pada PO | Kolom persen opsional, default 0 | Pembelian atau keuangan |
| 10 | Kapasitas dan performa | 20 user, 5.000 SKU, 500 transaksi per hari (NFR-06, NFR-07) | Pemilik bisnis |
| 11 | Jam operasional dan target uptime | Senin sampai Sabtu 07.00-18.00 WIB, 99% | Pemilik bisnis |
| 12 | Retensi audit log | 2 tahun | Pemilik bisnis |
| 13 | Pengiriman PO ke supplier | Manual (unduh PDF), status Dikirim ditandai manual | Pembelian |
| 14 | Hosting dan penyedia | Belum ditentukan | Pemilik bisnis dan penanggung jawab teknis |
| 15 | Pemilik produk dan penanggung jawab support | Belum ditunjuk | Pemilik bisnis |

## **Langkah Berikutnya**

1\.       Pemilik produk meninjau dan mengonfirmasi Bagian 12\.  
2\.       Susun wireframe untuk lima alur utama di Bagian 8\.  
3\.       Buat ERD dari Bagian 7 untuk disepakati dengan developer.  
4\.       Kunci PRD sebagai v2.0 final lalu mulai fase desain teknis.

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAloAAAFXCAYAAAB6LeCpAABKz0lEQVR4Xu29f5BU9Z336x/7h09vxd1iazehdqueTNVNrbJPStl4TdgbvbFuvCsVNyvRpx4mS9bxIYmOVoEko87EOJllbhBWgyMTZYwPPx6uKPiQCMmogxcCJFFnFQJEofglgzBgMwozoOOQYeBzz+f7Pef0t7/dPdM9dDc9w+tFvTnnfM/3nD7943zOq0/3nL5MAAAAAKAkXOY3AAAAAEBxQLQAAAAASgSiBQAAAFAisopWIpGwuWKimW65Vqcnx0O3T806ka7HJ6eWmdmRuZ4g7nTUv2Nmav6Ue9eaPsmNLWa680Od6rD9wmWjNbu3rUyemJAJVVMkeTaYOGCXt6kJlwg42ydTPz9BEhMmhQ123ZradUnTEq/3qc60aU22/hFR+8RrpoYtXc5yknY/dRuj+x8NAQCg9HzrW9/ym0rO9ddf7zfFDA4OyqOPPiqf+tSn0o43o82FcurUKTlw4IDfDBfIMKJVbYe3r8opWhN1fiBWw4nW5MZOmWzmpfr4opXctdwOl041wz3hdHbRSgmP3tbym9PXnUu0oja7LdPi9exZOs0Mu8I+XdvazHDq0qSzntS2uP3ddVc/Z/uv+kjStkGJ7ue0CXZbES0AgPKyZMkSM4zqbs29tdK0y+tUIrLJlkqNe4wpRorF2bN61iKTv3nwnHxq1uhSKfT09MjQ0JDfPCp0Pbq+kRhGtGrs8NqWnKJVG85Xaswydl6E9pn8eFfaGR2NL1pRX386q2i5IhXctr3dCTLtc1VSFSSa72OXie5Dat3+bUR9dbujoSWzf4RO17xkhy36ZuCl8LEL1xfdr2iIaAHA2GNQ9r3QIL19ffJakJIy0O+3FA2tu01zm2TCl1tM3S4Hb7/9tt8kDz74YHyceLTztHx48B1547H0Y6Vm175fp01/x5vvxmfWrFnyid+YlcxeyWT6Jze+OI0mw9E/6LcEDKa/DgazdsqfI0eOxOP9RXwNu+vNxjCiZbO8O/dHh1Yc7PRwolVjzuRMiNfpi1aUlARFT7Jz9kr7i/cxpd7etqZwfIq9UU/E3G3JJlpRoj7RMBKt1PzM/hF+e/S46LRuc9r9nDAH0QKAMUfvjl/K00uWxNnuHKcGOxeZ4YuPLk41yk5pbD8a1Gjb1jq3UY4Hx8lenTixRQaH+qVhvp33bOd+aWx7QxofbjTTx9sXS+NcO/7so82yYOXWYGy31D26wbRZdsqbrfPN2Or68HbNbfWkuoT8/d//fTweH0OuaYpFa4rW421rZSAY37Hefo0lkbhRdgTHP83an2+WHT9fK12b7TxDd5skrtD6bR+IzXuDpc8Gx62zA7J2/Q7T5oqcuw3Hjh1LO24cXNcmH398WtYePB23Hft4W2o4rU227+6Wju8l5OMPe+TDvtMyY/GvZfvW59PW4/LvgWTpo5aNrYHztC5tFf2Gzr/NelCSwT/5eFeabn3ySbp8ucLU97Gd3hO037L0vPxHh5UobTsUjP5gn46ft22/OB8vN3WRbVNat1lpGkxulcZlW4Pp9NfBpiPB/LefN2kIXgv7Audav3KDvLnyJ9LQNF+a62vlxb0i77y1Qt4J1mNfL/ulYZ59TegyyvpdW+XZTM+Vo+FwxowZcduMJ9+S/r0rzfj+379mhmvrZ8jRHTpun+dDb9v213ZEaxiZYUQr/OhweraPDgfMvOijPiWXaEXZczY17YvW5kftx3GuaFkyRWvV7Tpubzfqu/n7k1LTBYrWgtutAEZ9omEu0XL7R+i0+9FhU1XCCJVON21LidaEcJsQLQAYaxxvD0QpGFbPuMOk3T3hsXdF4DevyOz76qQ2iGWn+b/7rcWyfYk96O1bMd/I0bJdIk9/f7G82WlVQA+yUX9d7/F2K27LggOp9rH97PyI7iGRTfNsPzuMzn7Yfg1tqf5/+Zd/GY9r3c3G8rsmGTGaaD4dqZfoqyf204rJ5hinRMcVrd36KUpbIGI3Llpu5lcnJkjXUzdKVdUEs5wrWu42vPvuu6njy9R/N5K1aMH35OO+Hvm/w3ZXtK567DV5evHzRrSe1vnfe9nMu+rvrkytxzuWHFn3b+aM1q7kqfT2rc/F4+3HVLTagrGkDH6cS8sskSzdG0jLnmC5f59rRcucqUqel75952UgGP1UZ0q0Nv/inAyEUqbRjx6V9ofuMK+V6lYrWIoO3dfB9rZGK86hqLe3vWIy2HdInm1pjtv1Nalyra8RHTd52b7edH1pr1MH1aRnfvaMEa3olTNjxnflfz2k4tUj9866V+5dscOIlkbkLdHX2J2198qM+rUm+TKMaNWE8lSTRbQ67ZP6mpUJJZdopT56yy1akcS4ouW2ux8dzjFnx2qttARZfm+t1N5rv9Nllin0o8PwY76oTzTM+dGh0z9Cp6OPDnU4VW/ry3Y79Lte0f2MHk9ECwDGGipakWS5otVa3yDL3kqd3rIHPiUUrXY96A1Kw9xF8uYJbQn7Dh6Vp/WAKdlEa7G0PmnPTDQ+0CzN9dovJU6Nd9gDtR74dB16tqP6jlrTprff2LLEiFjEt7/97dREFmq+ZN9A65bpsaX+tQG5MTjWVP1gh2mPRGvyFQnZHG7+nM12qCclJmkd3zxHJny/U/peqpWqr0zJEC13G/wzWt9f3y1rH/4n6bg/1ZaWv/ueJP7hn+RRv92LT/vKJdLeuddvzgv9DpmL+/GfGZ46b0QrmlbR+tTc8xmidVtnatknNtozWuvN6yDg0BrpfWuFND68JG/RagheD63zG0SG9suy3/aFr7dBeXrJYjPeEDz3eta0dYmV8FyiNS+QLOXQ/p64Tc9oKQ+9eFTuDARs14A9ozV48H/JnQ/MEyNad363uKI1TYdVTfEXzq2kTAnevSxIe3K7pDiilZq2Z8yyiZb9Mnsq5ntiianh7Y8kWlX2bJPZzkxxcodTFo1OtPQMlrt9+oV9X7SiM4GIFgDA+CfbXzvef//96ceKIqSY+N/Ran4p9RHgaKLLX2xOnIgMr7iMtN5hRMum0/zxQV883dGX+ow76qtfAM9HtPqcL4nXvNSXIVrRMjZ6aYlM0YrWufaOcNmze1LLXNPk/dVh6oXXcVdV3Kb3IZs4+cu5011Z+kdkW07Fa8E12laTIVruMvo4AABAadm4caPfVBaiv3bMxj/8wz+kHT8uNMWCSzwUl6yiBQAAMB5ZvXq1+b6ULynFjt6G3tZInDx50nxnS+XmYkc/0tRre0FxQbQAAAAASgSiBQAAAFAiEC0AAACAEnGZXr+DEEIIIYQUP4gWIYQQQkiJgmgRQgghhJQoiBYhhBBCSImCaBFCCCGElCiIFiGEEEJIiYJoEUIIIYSUKMOK1rFj3dLdfVhOnerNmFeMfPDBcdm3b09GOyGEEELIeEhO0Tp+/P2MtlJFhc5vI4QQQggZ68kqWhfjLBOyRQghhJDxlqyi5ec7M2Z4bfvkgA73rZYDpzL7u/ndEzPkd1naD6yuM8N75jwWt/X0HM/oRwghhBAyVjOiaM2YcacsfuqpOLY9EK1jv5FtHwTjp96SGXc3y6I5gYwdWC11T/3CjOtwxozZRrRm3N0gzfcE809slGfWbQzaZ8SiNWPGE/Ft7dr1TsbtE0IIIYSM1eQhWjPkg4z2fYE8PSLfeeI3Rpi0j0ZFy8wPh3VBW+qMViBnH+yM+2YTrbff3plx+4QQQgghYzUjipbmd633eG3hR4en9skL+07Lcz+aLTPunJ1TtBYvCWRsZiBWoWg9VpddtN57ryvjtgkhhBBCxmqyitaBA/sy2gghhBBCSGHJKlqad955O6OtlCnn5SQIIYQQQsqRnKKlKdeZrYtxOQlCCCGEkFJnWNEihBBCCCGjD6JFCCGEEFKiIFqEEEIIISUKokUIIYQQUqIgWoQQQgghJQqiRQghhBBSouQUrY8+OiUffPCBAACUm08++USOHTuaUZf8aB/qFABcDLT25FOnsorWoUNd/voAAMpOV9fBjPoURecBAFxshqtTmqyiBQBQKRw/nsyoUdQpAKgk/PrkpiDRWtd5Xvb0nvebAQBKxoEDBzJqVK46Nfj+Jtnz27VxBv0OAAAlwK9PbvIWrUO/OiefmnVOFh07L5/68ciyNe3LVX5TQSTXL/Cb8mLgw6TfZNm5XJbv9BsBoNIpRLT+v9v+k7Q7ea3T75Gdpjum+k0FkpTaRzr8xjSW35yIx/uSOepUNpIdsmB9UhKJif4cAKgQ/PrkpmDRiuKSSEyWjpkJqboiIW27BqTt1iqp+lyVJNfVSuKKidI1YPt1PT5ZWg7Y8eVBnYnKkrYlZiww051P1QTLVJm+UyYkJDFhiumTSCRk1d5g5OweM65lqvPxaklMtPOVSYmwkO1tMfN1uyY/3mXWUz97mtS8lL5MIlFt2gCgcrlQ0dKhS42pEx3SMr3K1BLZWB/UBH1j2CeTglpR/XhoZ91tkpi+yow2bUuvHfU6HtabppurZNL0OZK4tiVYZm3cPjkYmraQCbM3m6HWpQjto+g2RTWvdp2VML2NCZ+vDh6AFlPH7HJ2G7WPLpNI1MTrAoCLh1+f3BQkWn/zw3Pyv/0wt2hF40qXjs+0KhUJkBYSLUJRIUoTLe0bFpSor+GALVR2uaBt73K7fNAercuWL+0zIRyzIme3JbyVXQuMVEXLJK6opUgBjAEuRLSiuESiFdGlbS+lpGfg59XxvLavJOyZKK/euLXLvnkcMFIV1RStZ9H6LHuc8aB3n4pTIkO0FK2lun57G13S5YiWkbcw9n4AQCXg1yc3BYnWXzYUJlp7VtSYgtDZZ/u5Z7SUCVowqqalRCugY+5UI0y5RKvzEZ0fiprpm15sdHrS9GgZuw4901bTWGuKabSMbhOiBVD5FCJaMtgn7f/PKnnjX/+TnOpNSvus+fL7WfmJlpztM7Viyr1r43lKdCbKrTeuaNV+aYJM+GqTEa2BXeEbQUmJmzJnQmq8/uZJpo85cxW+cZyWsKKlt1/9lJWyOQ9OsWf03TNa4TZWBTUO0QKoHPz65CZv0RI5L/cuPRcHAKAcFCRaol+I75D3P7bj53p3yOHe9PkXg2QyfLc5DPGby5Dhv/EFAJWEX5/cFCBaAADlp1DRAgAoN359coNoAUBFg2gBQKXj1yc3iBYAVDSIFgBUOn59coNoAUBFg2gBQKXj1yc3iBYAVDSIFgBUOn59coNoAUBFg2gBQKXj1yc3iBYAVDSIFgBUOn59coNoAUBFg2gBQKXj1yc3iBYAVDSIFgBUOn59coNoAUBFg2gBQKXj1yc3iBYAVDSIFgBUOn59clOQaO05q/9vlvqN/px82CxVn6uS2rnLzdTyudNkWjgO45fND1aZ510zWswP/gaY9Xx5mp0Y6AqmJ0vHgQE7fXq/fPjH9+04jCsKEq1DbdKy128cmRrn9TnsrxK+lPuH6HsP75e+rj/6zQBwCeDXJzcFidaCx6eI/tSpHvgmJibK2rsmmV+WT3y+NphOyJ71c0y/KcH45senBmNdMnXuqnDp8CdSPwqmD7WEbSKJRO7CBeMF+9w3ze0wrw1lajCuz33TVQnp2JWMx7u2tZnxlgeXS/VE2zcSrcS19nWTuHm5TH68yzZua7LD/vflw6ETdhzGFQWJVlCPah5tiWUpfh0F7cu37UmrU3uSyfj1KJIUVfY5Qd+OuyZKcpd9E5gI6lzb9ImitSzx5TkyNVzXnmSXqYEt1yZk7bak6ftR73vSXwE/YA0A5cevT24KEi09XNYEhUYPfInEFNncOMUWtmBaC07EpKAA7VlRLVqcUqT/Fv2ND3YYUat5adj3jzAusM994tblMucq+zrpCjI5MVmW35yQ+p+tNXKl46serzbjiap6aQumtZ8vWooeMJPmYJd63cH4pGDRCl4vHTNVjiR+HWm74tYprTzR61FJBK+lpl0iq6YnpK+vy7bpa06XPdspE29ps9K2qymY3xeLFgCAX5/cFCRaAMUmuXmtGSauarLjZ/vMOEBEQaIFAHAR8OuTG0QLACoaRAsAKh2/PrlBtACgokG0AKDS8euTG0QLACoaRAsAKh2/PrlBtACgokG0AKDS8euTm4JEa+DMH+X8+fN+M4BBXxv6GsnGid5TfhOAQV83h48d95tjRiNavN4AoJgMd3xT/PrkpiDRAhgNHPQgHz44mf1SL4WKFq83ACgVueqUX5/c5C1avac+8psAsuK+VnjdQL58eDK7IBUiWrzeAKCU5KpTfn1yk7doHTx8LG16dvgzPKvfF9m/VC9OKnJqS3M8/9Qba8zQ9Ntq2294bLd0rNluxg8HuftXH4S9RW555kjw/xHZFLcE6z2j/5v/ZParwXadfFXWBfdxU903nF5QabivFXe88/sTzEUho7joc73/p6nndZPzWr7lyqvM8PAzpXveo9flDV9fKt+8/n4zft09v5KOQ/r6s/vEbY/ZPlBeChGttDrV/6p0ZK+JI3MmVZuGY3bwehmJ1TO/5jeFbPEbAGCM4tcnN0URLStJlk3xmGLXNftz9sC1qc4eMOX9X5nBnd+6Xzpe/pVoLcwUrVQRim5LuSUobIhWZZNLtDpmWsGqmpiQiVe4opV+wLml7d00qdLnfPaU68O28AB4ao28/qObzGjjG1HPD2R1j5V46bevMZHd0UzDuv5w+TdSbwpcVPCeOWTHo23Y9ljwRmLj/fLjb9XIih/lOmhCIbz441lm+ON1XekzsjBq0QrYtvKH8s2HVorWFqWqzr7WzGskB4/dUy2PvXzEPOf2bZ5Iz+rwp8KGOqXxC3bblUi0oteMcsu0lHxtqrs+HHNedxttPfRf97pN0e0BwNjCr09uLli0lFNh4di/JlWAVLLiN5Nv25+/uGVpULzeTRWhxjfsbenBMVO0giJ5MvhvyPa5e/URObO3TTb1c0ar0hlOtCYFolV76ySp/tKEuF3R57ojPiiln71S0VKuDM9s9Qyl+t7wkH1tPbY1eJ2cedcuYIgOYvYAu828GM+Y1+ThM3r29dVwfkjwulwX/ib13VP0dXxGrntoi2x6yMqc8s2VwcFyyL0NuBB2vW1/I3AkRi1au1fKmeC1Yl8X9nUQvSmMReuUf1bJqs6pl++3cr39tKk72m+1nt08uUX2h6/N1fNWyuwvWGHfZP63Ul/lneXS+rh/yHndeaK1OiyU0TbdcE/0JgEAxgp+fXKTt2i9151fUQRwXyvueMddqY8N/Y8OAYaGzvlNhkJEq6h1KhYiAABLrjrl1yc3eYvW2bP61hBgZNzXio5zSRDIh0M5JKkQ0eL1BgClJFed8uuTm7xFS+k6kv7xIYBPttfIcNceAVA+/mTAb4opRLQUXm8AUAqyHd8i/PrkpiDRUtTmPhngK5uQjp5OzWX6il57hNcN+ESvm3Pnsp+OVwoVLYXXGwAUi5GOb4pfn9wULFoAAOVkNKIFAFBO/PrkBtECgIoG0QKASsevT27KJ1qD/X7LqBnsH/SbAGCcUumiVex61F/k9V0oxd2c4Vc2yN9cwRjFr09uChat1p/80m/Kj22L/Za88X9utr3tFa8lk+Jfw3un3wAAZaAw0dpp6kX3lkVxS1Q//DqSPz1pU+0PpdeyfOpRIbS2FVprMvuP/r4Wl9aH/Mcmc1td2of/GkzeNLSnP2fDkbmNAIXj1yc3BYlWa31YvPrshfYaluyU9l1H7by3ol490qWDtxbL9iWNpqV7XYMRrcaX7Yu/t6/P7AitLfaS3tHO1brNDrVIdOnIW7ag6fT2NruuhqAIaWHb7pwg0/XpslEfxYiWs51vdm6V3mhmuF5d7tmmFbLwdfsuS29H23p/rffTbmt/ML3Q7Ii2QKTmA0A5KFS09gX76PY1PxHdh3WfjtKV1i8d3a+1ZrTPW+G07pduHQzZfT+qBZFoxdPhMqvnrhEZ6Jd9LzTI00Gt7O0flH0rmuM6oyxYtjt4s7ohbt9nWpWjqXoV1Didr6gvpPpE6PbY+mRrpt0+U0eTVhq6j7jy4MwP3/DG2xROu2IWPV7vHLE/nhvV5cHTQe3r2x/3i+9/i/25NdMvvP24xkcSE943f76tvUfj228/Yo8n7v3POAc22G+WV95ckrpIdvOTW81Q672uO1rH9rbmeBsNzjYo8TYOpI5nAIXi1yc3BYmW4egr0j0UFIwnl4i6TmPLEqmb/4r073heGo2I2eIW7cCz72uWfesa4+m6oIgsXLLE7oThO7dItN5sa5DW+Y3xjh4t0xDchgwckoVzG83y5h3k0FFpD/eJ1mB9ZicP+yh18xabAhVtZ8TqlmY53hmu9+H50r6/P03wnp3bII3LdIe1hUzv34JwR1y47I14/mC4DgAoLYWKVkoa0kXLlQmlrmmRNDxqD8BPBzXEiJZ3dqq9pUEWrFFJGIxrQe+WnwS1JTXd3vZ8ULcapDswgoVN82XZkw2y8OFAtp6cb5ZrXbLI1BmLPbhH7SlsvWkO6pWti4Ph8unbXTc/eMP6gkqbK1q2Nr04v04WrkiJU/vc6GemMkUrqn2uaL25ZlGw/ufjx0rrdPPLR+PbaAxue+GTkYi6998+ZrFoDewPtn2RlZ2VDfEb3GVNwWPy+oa0+Xbd4TFD7DZ2t+t2p+6/y8LgMVvd1GyWj9BjguF0cGwJbkMf6Wcf0OOAXcebJ7zn1dlGJd7GnjfMfdLjG0Ch+PXJTeGiVSDRu4aKoYjfFQOA0lOYaMHoGZTe0xnnjwAgD/z65KbkogUAcCEgWgBQ6fj1yQ2iBQAVDaIFAJWOX5/cIFoAUNEgWgBQ6fj1yQ2iBQAVDaIFAJWOX5/cIFoAUNEgWgBQ6fj1yU1BolX1uaog05yWAfv/umqnLTdrZySk04xtDtdV5fXIn5YDdhitpyttbsDeBTJ1aZGufgcAF43CRWtPeBGFLknM7PDm5eCj1F9HV11Tb4bVn5sSt2Wj5dqE3wQAlyh+fXJTkGjV/3ytrN2WlD1zJ0kyGRSz5CpJfhjI1ks1QTVskeXb9kgiMUX2rJ9j+u9JJuXGp5KyanpCkod2SMfMREqIdJmA5Oom2dyoBa1LalfskDlfDorX2aDvrmSwrqDPtqZgPbZgNs3tkK7NTWa5SLSUmpeC6WA5vb3q1QPBcgkZCLZH2xOJSVI9MZi3q0MSVzVJ56J6WT59omw+m1oeACqXQkVrUrDPT0hMlUi0mtZrXbrR1J+pQQ3R+tAW1AAlmtfZOFn67PvG4H2grV+rPhKZGNQzrRda3xKfr5UpWluC2tWV1OUS0nHXREnuWiv6lk6n93wUrgMALin8+uSmINFKvTcckKmfn5BqCUVLmfx4V9yr+vFV9h3l2T6ZEshONtFafnNC1v5c30GGc5x1qWh1PT7Zjs/UAjkp6LvWTPuiNTkocrX31krtz3ZI4toWsw4jWsFy8TqC9c0JtmPtUzVpywNA5VKQaHW3GeHRRKKV+Hy13KhSFNYf8wbO1JhkPC+qERGr1lnZSlTdaOpKVE90HRqlqSohNeZ2gnp0SNebvg4AuHTw65ObgkSr3OgZKC2GyqS5e9JnAsAlQUGiBQBwEfDrk5uKFi0AAEQLACodvz65QbQAoKJBtACg0vHrkxtECwAqGkQLACodvz65QbQAoKJBtACg0vHrk5uCRGvgzB/l/PnzfjMAwKjRmnL42HG/OWY0onWi95TfBAAwarROqQPlwq9PbgoSLQCAUvHBydRFQ10KFS0kCwBKRa465dcnN3mLVu8prsQHAKXjw5PZBakQ0aJOAUApyVWn/PrkJm/ROnj4WGoiuTy+KKC9MGDEB3Zw8lU7PLUlNSug6srrw7H09rzZeL/fksH+V9eY4TOHRFZ/y97euuBxOeP02Zb9cQKACqQQ0UqrUyFaC275+lK/WW555ogZ/vjrUV2yzM7Sd7Q89nY09oFsctpdbqkboR4eSm1PVN8e++o3zPC6kZYFgLLg1yc3oxOtAy0y8YqETPBE6/Azduc340HUZ6qcQjB7Y1AoTJ+gbWtz3N6zMvqtxO2yaShqtUUwUqR3HrvJiFYkTD2r7ZXlZagzU8CGrPBFhTQqsqe269Wgt8g3562UjpWp2weA8vLij2eZ4Y/XdaXPyEKpReunjmjdsvRIVtHSdSizw/eQSrS81rpovmmf5izfb+vf3b86bUQr6qfL/nSvrWauaOm6RHbHUmZqqiNaEbM3npZnpmktPZJ22wBwcfDrk5tRi1b1lybIjRMTMintjNZpI0Jn9rbFLb5omeH1V0kkUlHfx75lxem2x7Zrazw/whScQKh+vP20XebUFll9KOh3cku6aA29G4+uu8cW0E39IjdMtz/ro/TEMgcAF4tdb+f3o++jFa0VP7KCsk3SRetw+G4tEiXlhplrTO3QttlfsG/CeuK5EouPKzU3fD2oQ0OnjRzZ+bvN/1WeqH1zrq2Bm4Lc8tN3zRl/vR3djG0LbspyRuuI6atvVJ+ZdpURrXhbgm28+1fhJwcGRAugEvDrk5u8Reu9bqcoHmrJ8dEhAMDoGBo65zcZChGttDoFAFBkctUpvz65yVu0zp7lNBAAlI5DOSSpENHSOsUlaACgVOSqU359cpO3aCldRzK//wAAcKF8/MmA3xRTiGgpw13rBgBgtAznQH59clOQaClqc58MuH/DBwAwOvQ0vNaUc+eyn45XChUtRa91Q50CgGIQ1anh8OuTm4JFCwCgnIxGtAAAyolfn9wgWgBQ0SBaAFDp+PXJTflEa6A/bbK/f1AGgxTOyMvoui8mhdyvQvoCXIogWgBQ6fj1yU1BorW9bbHflDfH29OXbW3bGY65V6vJh2i53KTWPTpa9cI7ZaK97RW/CQAcEC0AqHT8+uRmdKI10C/7XmgI5GmRmVSxaX0r1e/Fo6nx3r4+WV2/OCVaffbifA3BMlYyrGip3Aye7gv67w+XdKdtn9Vz9ecndkrtXCsnOl/X3d5if5YiEqTWefY2Fra8If3B7S986BVpn7fCtEXTkbC1J0W67WKil0pVXNHq1f8G3jDn0fS+RH2an9ya6hQ+HrLN3sdInpb9ZIO53d5fzzfLbupzz8fZ+9n68Cupx2TJzuBxmh/3AABECwAqH78+uRmVaC1smi/LnlTRstPmDNKJrdK80spH//4N0rrBisTTS5ZIqytaopKyxCzji1bj/MWy8EkrREpqukcaHl0s3cZSrCBt77fzdd2R2MSi9eQvg22sk/6hoE/LElmgohX2iaZd0dq3YYnMblocS9SCB+bLi3vt+KbWRmlcafvqfYn66P1dOLfRjEaPhy9aLguXpO5/hG7Ls2HfBcFjoh+u+mf+AC51ChKtAy1S85JI9cTcF1JuuTZ9nj+duKrJDKtXD6S1+yQS4c+AAcAlj1+f3BQkWiPR79SlsfbVo96+9O+QAUBlUKho6a9VLO8W6ZiZEC1JcyYkYplSOYrG1/58rUxJ2HmJaxbEqxhYXW1ifmps0VpZcGv68pMTVfF4okqlTP/su0sSt6+K1wEAlxZ+fXJTVNECACg2hYqWntGqmZgwstS0ORkI0ZQM0Ro422Gm9bdadXrP41PctQT9JgX/75GJ05fL2sdXpS0/J1h3367lZnxSYqLsWRFImYrWTLtOALj08OuTG0QLACqagkQLAOAi4NcnN4gWAFQ0iBYAVDp+fXKDaAFARYNoAUCl49cnN4gWAFQ0iBYAVDp+fXKDaAFARTNa0Xq/54QcPHyMEEIuKO91J+Xs2SG/xKTh1yc3iBYAVDSFitbAmT/6TQAAF0zXkWN+U4xfn9wgWgBQ0RQqWid6T/lNAABF4YOTfX6Twa9PbhAtAKhoChEt/bjQZV3dTXL1dV8z49+c80O57h/vN+O33fNDuXP1u3L4mW/IDV+5Sa78XI2c2r5Ubqq5X545JHL19TeZ9oht+qlB90rTdt287XLDddeY9uu+VmPWAwCXBp8MnPGbDH59coNoAUBFU4ho6fcpYrY2x6P7e+zvocqpV4P/zgTTH8hNX01dDV5/CKwjkKmOl3W+yE+D4ZnwKxm3PfOudLz9gRnfVBfK10YrbErjlFnxOABcmvj1yQ2iBQAVzahFq/9VeT3j+6unU5IUDrfNvd4MZ2+0zXd/fakdObRUdmxpkwcf+qFUfbVGVu+2zbM/d3+87OqZ9mwZAFza+PXJDaIFABXNqEUr4PV535Crv3qXGdeP/W77kT1jdV0wfvcz9ifib2ixBtXzarPp0xPI2dXXXS833BOeBQuoqtsicuaImb/ppMSipetxP2IEgEsTvz65QbQAoKIpRLT872gBABQTvqMFAOOOQkRL4a8OAaBU8FeHADDuKFS0FGQLAIrJ+fPnh71Gn1+f3CBaAFDRjEa0FK4MTwgpRrgyPACMa0YrWgAA5cKvT24QLQCoaBAtAKh0/PrkBtECgIqmUNEaGhrK6EsIIReaM2cG/HIT4/d1g2gBQEVTiGgNVwgBAC6UwcHsX4j365MbRAsAKppCRCtXOwBAKfHrkxtECwAqGkQLACodvz65QbQAoKIptmj19g/6TYbevn6/ydC+K709x+Ix/UX/9HIw5zYDQGXg1yc3iBYAVDQXIlrVM+6Q7W13yL8GQ2XmnXfIgg09MvOOO+RN59d6tF/1jEaREzvNuDK7ZbE0tPeYGPr3S/WdddK6TaTuu0H/7zbI8fZG0//Z+Q2p5eb9RGY+vMKM6+2+o552Ymsw/9ui0qT91h+x4lQ9oy74v0+q524w69T2hmB+w3ftcvvaF8nstkVS3bZTNrU1yswmu17dtuMvN5pxALj4+PXJDaIFABVNMURLUUEy431b4nmGvVZeVLQGOxfJ00uWiP7cdCRY0bA57K/rqX7gJ/L0fJUkMX11XdFys184JF0v1El7UqTxySVS/dArgV/1SG0gT5vm2X4aw64V0mjW2yfNYbuKlqLLVc9YLDLwhhGt6ie3Su+v58vTO1LbBACVgV+f3CBaAFDRXIhoAQCUA78+uUG0AKCiQbQAoNLx65MbRAsAKhpECwAqHb8+uUG0AKCiuRDRap/7bfP9qe7hfw8WAOCC8OuTG0QLACqaUYtWUr9MfocZNV8qD9ne1mjm+egX2ZVle0UaH55vxpvra+XFvX1SN2++9Ibz9S8BXzs6KAubGkX/dnDByt2mfX1PkF1bpX/vBmls2xD2Dta3otkM32xLbUNE81z9y8EeOR78r3nnredl2Vt9Zl60Df96X2OwDfEiItvserZnvxoFAFwE/PrkBtECgIpm1KIl0WUb7kj7K71covVaX5/09lnp6Q3G9a8LY6lx+qlcmXWI/eu/hradZlz/ylAlzVz3qu8Nsx5Fl134er90ZZxVC27rtK4tJVpd2vyWvc1oG9L/wrBfFvz6qHS3q7zxl4cAlYJfn9wgWgBQ0VyIaJlrVEWXcQh4ra1Bml8+akRr9n11MvvRDRJ5jCtTrUuWWNEa2i/LfqtntBbLPme+K1q9nYulYe4aI1qafS80y8KVi9NEy6Wufr7pL4P75ekli8QVLbNMKHfRNjz7QKPZBqVWt/k+e1kJRAugcvDrkxtECwAqmgsTLQCA0uPXJzeIFgBUNIgWAFQ6fn1yg2gBQEVzIaL15hp7tfX4SuwAACXAr09uEC0AqGguRLT0+1mbjtjvaa1fGf4l4NAhM9DvQy18+JcymNwiMrDVtL348KLwy+f6nageWb23XwYHJP7Cu2K/iB6N/yQc65PtfYPy4kOpeQBw6eDXJzeIFgBUNBcqWno2S4f7tu03bV0vWDlSoerfsUYaW18JRGu/vLNrtzQ2rTHzmlu3yr4VjbL+YL80zn3F/AVg75FAtoaOxutW3lwTiZZl2S6uuQBwKeLXJzeIFgBUNBcqWm92bpVn594h7W3hJR363zCD7QNhp9NbzY9JK93r7F8Tmmtmndgiqk3r5y0yl3Tw6UoOpolX+zx73SsAuPTw65MbRAsAKpoLEa3egzuNaGkAAEqFX5/cIFoAUNFciGgBAJQDvz65QbQAoKIpRLT6+z/ymwAAisb58+f9JoNfn9wgWgBQ0RQiWkNDQ3LuXMZv3QAAFIVctcevT24QLQCoaAoRLQCAi4Ffn9wgWgBQ0SBaAFDp+PXJDaIFABXNwYMHM2oUdQoAKgm/PrnJKlr6PQcAgIvN2bNn5dSp3owaRZ0CgEpB65Rfn9xkFa2TJz8Mhh/76wIAKCu2FmXWqKhOAQBcbIarU5qsohXl+PGk+X4EIYSUM4cPH86oR7lCnSKEXIxo7fHrUbYMK1qEEEIIIWT0QbQIIYQQQkoURIsQQgghpERBtAghhBBCShREixBCCCGkRBlWtPhrHkIIIYSQzFzQXx3qNSE++eQT/1IRAAAAAOAwqutonT9/3l8PAAAAAHioM/keNaJoAQAAAJSbpo3/U/56/n+ViY/cXhH5L0/8d9lycKe/mRn4HoVoAQAAQMWwdvdrflNFseL3r/pNafgehWgBAABARfD1//eHflNFMpxs+R41atE64zcAAAAAXACvv7crbfq5pbfLe2kt+fO23xDSsr3XbxqW9169328yXP+z2X6TwfeoUYrWoJw557elSCQmixxo8ZuLSsu1CWn7+Vppe/BGadnrzwUAAICxzuKnMkXrnkduN8PbF1Wb704pE5f+D5m4oFpO9XSaofJvHfPi+V989Ha56bmNZvyG1c/FfRS9DcsRc1u6zPy3PzYtLb+eJ+91WKG6vaVaPrvoB2HfTCmM8D1qdKKV/KXc83u7MVFcXNFquiph2ybMCdrD8Xg42Qw7Zk4I/h+QxFVNZrrrcW3vCKe7gn8ibd1mliSutetV0dJ20xasJ1pmx9lg8566UWrXiyzvC5r+o1467krIgm1Rb7v+lgMSrz9aJwAAAFQOw4nW1Qusfyw+GvjIc51BS2c8VDaE/Sc+tSZ2FV3XDR1HRKUqIhKtMx8flOdOptxG0XVY0fpYPhvc3tX/47l4uXM5rsrge9ToROvkRvneTpHvrX4qjosRqEMtsufQZkkunSprt+0xZ50isfKHdtzK14Tbl0vTl3U8EK2ZHaatK5w/9ctVaaKlZ7Tqb58sHX0pOau6tUkmBX07A+FKVE2TtnunSNeiabJ5VzJYx9R4/Ua0wvUjWgAAAJXHiKK14J6covWDF2enzngFw3vCjyGziZaVK3uWS8dv8EXr6G9N+9X/c028XMtrqXEX36NGJ1qB2b33R7/twkhMX+U3pZEcsMOqxh3pM9Kw4gQAAABjj1wfx1UiJf6OFgAAAEBx2fn+u2NCtvT6XrnwPQrRAgAAgIpixgvz/KaKYaRLUPgehWgBAAAAFAnfoxAtAAAAgCLhexSiBQAAAFAkfI8aUbTO/HGQEEIIIYTkEd+jEC1CCCGEkCLF9yhEixBCCCGkSPE9CtEihBBCCClSfI8atWgt/9plcuaF6bL8ROa8KNMvu0wu01z+2Yx5fq58ZF/a9Np/uUym/yK9j67LXy6fNP3ycEZbzvSvk8u++IQZvzLa/j/588x+YfY8cmXGtmuueTSzLcpll+VeHyGEjNd8+k9sTZ3/m55g+k3pzNKnGLk8rN3zf++2H5aamf+W0fdCoscIHc7/u+C2dmfOHzEHV9hjjH9se/PpzL4XmOh2rpn5gpjH4pfpx3f/eJsrl9+1PljP9Ix2N+U6xmV/nq17pKYPy9rD/rKZr71szjHa+B41StHaFz9pGS8QJ3pnzYvv1Vpzp27+XoNc9ncLpP7//EwgL5+RZNC2dtY1gYhdY2RFX6y6nK4zutOfddZvbmv3Arnv6svl8qvnSN+KW6UvaG/54mXSctDOv++XPXbZe241t6EipO26rmsuvyxY7s5gXYFM/e2dMv25FbEofvFxK2PL/9muS8ejnehM/x/k8n9ZJ1seudWsa8ep4Db/+TNmPBKtr/y59g3X+wsrjjr/yqCwfPEHv5HkL+eY6S8+8odhHzNCCBmX+X2DzP+Djp+2NTk+htg34nrQzFhmlLmy+Q/xuK5X674eX8yxRecH9Tmu3X+tb6Y/Y/pGxzQ9NvnrzBZftKLbco8FRgb+JDgOBceQ+/TYF0xvOW6Xv8a5z+/9wh4j9Laj7YiOiXpMO3PiTdMWrf9uPQb99a0Z25QrkRzN/8Jl5rip2xYdl7TdTAfHan2OVIg//c8L7HL/WOscs/4gHf26LntcbQv6uvfJnpyw8+xt2mOevy3Fivs82/u3zgyj15ZuX/S8n+nvMUO9X9H8zqemm2HNC4crULQO65253EjQcO8QUjuSfdCjMz92qOv4Uvjg2DZftHRod0wbs55AtPZof+2jbf+5wSQSqmhZfcDMi9O5Pe2v/aInw67zciNXqduYGo/HomXa74zXb148l9thSuT0HVpqvZFo6bg+Dmtn2hfjfa/aJztaLyGEXArpfMDKjMaecbA1ueOuy80b3VtX5DjejCb9p82b3Mvv+U1cs+0JAq3/6aKl/aKaHA8DKcpYZ5bo/Xjv8GGp/1srWqnbio4F9j5G67zvb6NjSOqMUOdzC0xb8lUrPea2fxFKkSta/fZNerR+XW98MiPLtvmJb/P1BrusHiPD45Kdr+u+Jj7G6m3q86InR7RNl6n/dNQ3On5elnafomOmXac91ukxz9+WoiV4nlt+MDV8ntNFS+dHz7s+RtG2WS+wj9+Op6bGj2nliVaQy/7bC8HG3ZjR7sZ/EUSipWekojNaHXpG60/Cj9/6D2fc6fr/bB8cc5v6QHmi5c/X06K+aGn75fesN5Yev9sIXyjvPR7I3uW14ToCq+13tjfclss/fY2Z3vEza7962vuzKlrhGTPddv0oNZlFtHQnvmbWepn+hT8306vCM2/RbRBCyKUSc/YorIM6HdXCYp7N0pjjSHiM0fGvhIJwczC8+1V7e7d+7TOxaN38f1kBi7anENHSoQqRHnNSt5U6FrT94E6575Fg+g4rWp/+xxvjeatm6bg9LlnR+kx42+Eb8vCYeOv/oeNWtKL1Fy5a9rGf/vhv7LYH2xsdl6LpM/1vyjWP/ME8PvEZrUi0+tfbcW37W3ssNGe0nPuUJlq77cei0XNdikT3SZ/n6cFr69P/op86pZ/Rivq5Z7SitooXrXGR4IGv+UHxPwuPUjNTpS6znRBCiM19QZ3sKOHB+GKnJRCtmpkNGe1k/Mb3qEtbtAghhBBCihjfoxAtQgghhJAixfcoRIsQQgghpEjxPWpE0QIAAACA/PA9CtECAAAAKBK+RyFaAAAAAEXC96iSi9bAmT/K+fPn/WYAABgnaI3XWj8SF3o80GUPHzvuN2flRO8pv6kg8l0+3+0pJfluQ779ikG+r4mxxIH//Sa/KWub71ElFa1z587Jx58M+M0AADDOyKfW59MnH/TYMhzFEoqR1jPSdpSTkbZlpPtSCor1fFcC2YQq4sy+d9OmfY8atWg1tO30mzL48GR+7wiycua0nOr3G3PQ/6r0+G2j4gO/AQAA8qT31Ed+U8xw8wrlgo4tReSibsdA+gHyom6LQ7/nVsV83iuFj4eC+9V2fzx9cslKZ26ZRSuNQ0vlurotZvSWZ47Iqe0r5YavWEO8c94WM74tx+vkcJCbZv3KjFeF69hU9414/je/tSYev2XaUjM89atZsikYzv6vN0njq1agel5tlpvu0flHZEV3vIisnlcTtwMAQHaOHnvfb0rj4OFjflOMP29T2lTp2PT+q3LD12rMuDnu6Li2feVrsj/fN/OVxsAbdrhrRXr7RaZxQ58ZtidTbf7zXpl0SCKRMMmHvidnyidDfmsK36PKKlrKLdffb0RrU9j8zNeD6VCedPzOQLgiCTrTs9sMr5zWFixjT81dHfZdd09KtM7EYyHvrzFytinIbV/7htzylWucmSpTR+SZQ6mWZ4J1ffNbXwvnAQBANlS0NP9023R/lmG4g6o/b1PaVOnYFA9Tx50ze9fIbfcsCKfGIHtDweqzx8NK4cWjdti6LdXmP+/jhXO9++Pxkp3RKphQtBQVrZvusWehbll6JE20LCl10jGVJjm1RdS1NtVdb9qveyh6gVkZc/nm3PCsVxA9SfbMtKucuVambvlpsLKTr4rewo+3B/026m0jWgAAw5FLspThDqr+vE1pU6XjulnBsWbIHstu+pYeh07Ltjdsrb/7Vxlv08cM/UOB0Mxq9JsvKgvvXRT8Pxj8S+E/72OV3ud/4TfFHLvvh2nTvkeVVLSGhob/cl4xOHPywrYRAACKw3vdzmdGHsPNK5RCji2b/IYiUsh2lJpK2haXYj7vF5tsX4jP1uZ7VElF69A4eoABAGB4zp7N/cWV4eYVykjHlgu5hITLSOsZaTvKyUjbMtJ9KRXFfN7HCr5HlVS0lK4j4+O0IQAA5CafWp9Pn5HI55IBxbp+Uz7ryWd7Sk0+26D3JZ9+xaQYz/dYxPeokouWoqZdqac1AQBg9HwycGbEsyku2leXKRQ9huiyI10vKuKDk32jvuSBLqfL54Nuj/a/GMc4vU297Xwfk2hbS02hr4nxhu9RZREtAAAAgEsB36PKIlr6Ga1+IU7/+oAQQsj4yfs9Jy7J7+EA5ML3qJKL1qX6GS0AwKUEtR7A4ntUSUUr38+4AQAAAMYDvkeVVLTSvvCYfCUebWgvzi8TjoboJwL2vbzEmwMAABeCfowIcKnje1RJRSuNQLS2t80yoypa63dZ4dEryFY/sEIGk1ukrr5ZZCD12zjdL6auervpaNBzMLVMbetW254cTFvXzAcWi5zeL8v2Bn0eXhM09qT97lLE9rY7ZHCvvYK8rqvhxaPB6o/Ka+12vaudn+gBAICR0e9sAVzq+B5VVtFSGmYtNqLV3tIozfPmy3ZJ/QCl+/tIDcG85ofrUg0h2rdh7nyZOWNxqi3LuvQ2dNrMj0TrxIZwxIqW9O83y+m6NrU1y7Ptu6X3rRWm7WKedQMAGIsgWgAVIFqKSszC+jpZOLchp2g1P7lYnn4h9fHesodnyezaWjPe2LJEFjiilW1dRpRO75eFKzek2palfhfRiNbRLWY5XVfjrGD99YvlnZXN0vokogUAUCiIFkCZRWs0F6UrJoN9h+TpNamzWBHvtD8vm470+80AAHAB8B0tgDKLFn91CAAAAJcSvkeVVLQUrq0CADD+odYDWHyPKrloKVwZnhBCxme4MjxAOr5HlUW0AAAAAC4FfI9CtAAAAACKhO9RI4pWlOPHk3LgwAFCCCGEEOJEHcn3pmwZVrQIIYQQQsjog2gRQgghhJQoiBYhhBBCSImCaBFCCCGElCiIFiGEEEJIiZJTtA4d6vL/ehEAAApEa6lfX92cPPmhJJNJfzEAGAO8//77Gfu0n6yihWQBABSPrq6DGXU2Sn8/P3YPMJYZbv/WZBUtAAAoLn6d1eh1eABg7OPv224QLQCAMuDXWY1e9DArZ87Luk4bAKh8/H3bTUGidUVdSyr1S9NnftghiURCqh/vTGteu3FP2nSuNgCA8YxfZzW5ROvaWedS479yZOulGlNnNcqUR3ak5vkcaPFb8idYNrqdxMyOtFkDaVMik8NtAbiU8fdtN/mL1s616aJVl74TJxKTzXDgI5HkuvqwEHTZHfXaFpn6+Qky4Us1cVvX2aQZTpm5yuzUtV+aIFMeTN+hAQDGC36d1QwnWn8T5FON5zJEq+YlO1q7PpCcx7ukY2ZCqq5ISNuuQIG615q6Wn9rIhatzsYpIn2dpr1PG/ausvU5qMGTJqTX4ERiQnxT2qbrV7T/2gMD0nKtla+1D041wz1nES0Axd+33eQvWid/M7xofaUtHk+utu+6WoIaopKlaCFIawtFy+zwYUHQnRgAYDzi11nNcKL13+8/J7dtOZ8hWnHdlJRoKfpmN3rDa9rCs1I1L/XFoqVnp/YsrY5Fy6/B+kY4Rpe/qyNe/4Kr7FB7rJpZZZcNajmiBZB9/46Sv2id65IrHlhsBOuvfvQzf268I9evS1rRuqLKSNW0Kt2RbzSiVTtzWtzWdsju5DXOOy9ECwDGK36d1QwnWko20bJntPqkZW+maOkHe/X31sqqO1J1tS9Yps8RrQU3T0oTLbcGZ4hW+LGheZP8H+Z8mBlHtADS8fdtN/mLFgAAjBq/zmpyidaoGUhKUyBaez7yZwBAKfH3bTeIFgBAGfDrrKboogUAFwV/33aDaAEAlAG/zmoQLYDxgb9vu0G0AADKgF9nNYgWwPjA37fdIFoAAGXAr7MaRAtgfODv224QLQCAMuDXWQ2iBTA+8PdtN4gWAEAZ8OusBtECGB/4+7YbRAsAoAz4dVaDaAGMD/x92w2iBQBQBvw6q0G0AMYH/r7tBtECACgDfp3VIFoA4wN/33ZTsGgd6k7KJwNn/GYAgEsWrYlaG4fDr7MaRAtgfODv224KEq2PPxnwmwAAIGS4GunXWQ2iBTA+8PdtN3mL1tmzQ34TAAB45KqVfp3VIFoA4wN/33aTt2i9550W731rhSxsaZZ9/WnNGbxz0P7iezF5beUr8fi+l5935pSOZ2fNl/6BHr85gwvbnj4Z9Js82h9a7DcBQAXh18oIv85qhhOt2gfmy8zaRr9Z2p3VZ9SLgaN+CzUDIA8SiYRJ0/rszjL5imB+1TS/Ocbft93kLVoHDx/zm2LW7+qT/k5nZx7YbwZvDog0tO00493B+IsP1ZnxBesOyfFfL4q7z7y3QbRk7AveCLY/PMuMawHRfjreG/y/cMtR6d+7RqqD9Wnh2N5WK5uSg8EwKETJV0z/fc83Sn+wjtp5W2TTht1m3boNM78brH+oX2pX2O1Sjr8cFbAe2d4XLD2gtyXSFfRfVt8ssmNJ3FdpfUjlLiVajd9fLIN7t5jx2tatUvvkVlPkzPbE2P69R3rMdsjQbjn+upXE2WsOScN39b4G23h0ULpf1OV2yvFwScPATlm2rU+6NvwkbqJoAlQ2uWqlX2c1w4nW+uhN6rZon7e1tLY+mB6086J6oTVs/aN1phaadlNnrIZRMwBGJjGzwwynBbJVE6Tt52sl8eWWcG6ndOng7Nq4n4+/b7sZtWi96ZzJenqH7tC2CBjCwtC6LSVaxwMBOt6eKSGKypPS/Os+mb3MCpLL9iAqW0pKtOy6ItGy2PXo/NoldtxsQ7u9LStLDgNarFLbsU88kx3sjwuZK1rdKnPBdmxvs6LUOsPe3+4tizzRsqx++NvStaZB6gLRa3+o2bQ1BOuzj02PmM0z9yFdtFIymHrfStEEqGz8Whnh11nNcKJlGHhDZO+K1LjYmqZs6otEK6xbOj+shVGd0fnUDICRSXy1XppuTsiqYHdS0TJt4VBp6w72tNXTZOrS/M9YRxm1aPXv3SCz76uT3kA6FtbXyYI19iOz2qCtf+ioPN3SbArCa0/WBf0Wy+z6+bJ6iZ65ikgJTsO63UGfWjvRvz8YtwIToaJ1vHONrO7syVu0NrU0xNvgilZ1KFv60aduv26Hbn9trT3b1jBrljQs2xpsxivhfIt/RkuC+yhHt8jCuQ2yIBCthQ/MCvrPD7crLHxDfWYddW22QKou9e96XpqfXCx1sWiJNN4XbOsL9gzazGA7erekzmAt/H6tNAbbE2Ek8o70s20AUDn4tTLCr7Oa4USrdlZQO1tsvWqorZXW1zeY8Rff3iqza2291Hrx4kFbtxa26xn7PpkZLGfqzMONiBZAnkRnqiaGZ7RUsjo+TM2fVpWQCV+qTzV4+Pu2m1GLVjF5cUf2z0Rdune9Ie2/zTzbdeGMfNvF4Nl254wfAIxbctVKv85qhhMtALg4LL83PPFTAP6+7aYiRAsAYLyQq1b6dVaDaAGMD/x92w2iBQBQRHLVSr/OahAtgPGBv2+7QbQAAIpIrlrp11kNogUwPvD3bTeIFgBAEclVK/06qymlaH1wsq8ifi5taOic+Xmic+fO+bMAxg3+vu0G0QIAKCK5aqVfZzWlEq3Dx9KuyFcxIFswXvH3bTeIFgBAEclVK/06qymVaJ0/f95vqghG+uFtgLGKv2+7QbQAAIpIrlrp11lNvqLV3+/82M7ACL975tG/f400zir8z9VLgX6MCDAe8fdtN4gWAEARyVUr/TqryUe0VLGeXblb1rfNlxd39Mvx9sXmJ8UChZKGpvl2fud+aQgvburzYvjzh61vpbcDQPHw9203iBYAQBHJVSv9OqvJR7T058da23bK4NHd0vzy0UC05kvj3Ffk6YetWC2b90r4szzZf/S+cYO9KPP6E94MAMibI3fPlq4w2fD3bTeIFgBAEclVK/06qxlOtMzPd821v3OoolX38HxZti08o6UMHpXW+Q3mZ9CGEy39qbDoJ3sAoDT4+7YbRAsAoIjkqpV+ndUMJ1rjkQ9PnvKbAMYF/r7tBtECACgiuWqlX2c1pRItLu8AUF78fdsNogUAUERy1Uq/zmpKJVoKFywFKB/+vu0G0QIAKCK5aqVfZzWlFC0AKB/+vu0G0QIAKCK5aqVfZzWIFsD4wN+33SBaAABFJFet9OusBtECGB/4+7YbRAsAoIjkqpV+ndWUUrT4jhZA+fD3bTeIFgBAEclVK/06qymVaPFXhwDlxd+33SBaAABFJFet9OusplSiValwHS0Yr/j7tpu8Res9fnUdAGBYvvvd7+aslX6d1QwnWl1b1kjrmi1+s0PqSvCN63NcFT6geZa9knxhP0UNAIXg79tu8hat3lMf+U0AAOCRq1b6dVYznGhF6G8drl+5QRrqm830vg2L5dm3dkskWsse/aU8+7b9Yels8KPSAKXH37fd5C1aysefDPhNAACXPHomSzl7dsibk8Kvs5rcojUYj+0L0t5mf0BaZL90m+EhUdF6c52VL/2tQ/t7h5nwo9IAF86D36qRb4bJhr9vuylItBT965FK+EsWAIBKQWui1sbh8OusJrdo5cYoWP8bfvOYQP8CEWA84u/bbgoWLQAAKBy/zmpGI1r5cP78eb+pIhhJRgHGKv6+7QbRAgAoA36d1ZRKtLi8A0B58fdtN4gWAEAZ8OusplSipXDBUoDy4e/bbhAtAIAy4NdZTSlFCwDKh79vu0G0AADKgF9nNYgWwPjA37fdIFoAAGXAr7MaRAtgfODv224QLQCAMuDXWc3FEi39zlQlXGpBv0Om3yUDGOv4+7YbRAsAoAz4dVZTbtHSL6RX4oWnK3GbAArB37fdIFoAAGXAr7OacotWJV/Harir6gNUOv6+7QbRAgAoA36d1QwnWrPvq5NnN+jvF+6Ud/yZeXD8ZfvzPC5pHxee2CJvBuW+v9P+6PTFJtePcQOMBfx92w2iBQBQBvw6qxlOtHr7+mT9svmiv2kYXX5Uf89w4ZNbRQa2Stehftn3fIO7iCFu37bYpHtQpKF1q99N2h9q9JsuKgcPH/ObAMYM/r7tBtECACgDfp3VDCdaln5xRauhvce0tXYOysLXB6V3Q+ZZq7g9FC0l9aPUDv1vyKbkoHSvqwzhQrRgLOPv224QLQCAMuDXWc3IonXpgGjBWMbft90gWgAAZcCvs5pyi9aHJ0/5TRVD76mP/CaAMYO/b7tBtAAAyoBfZzXlFi0u7wBQGvx92w2iBQBQBvw6qym3aEVwwVKA4uLv224QLQCAMuDXWc3FEi0AKC7+vu0G0QIAKAN+ndUgWgDjA3/fdoNoAQCUAb/OahAtgPGBv2+7QbQAAMqAX2c1iBbA+MDft90gWgAAZcCvs5rhROuNzv8ghFRgsuHv224QLQCAMuDXWc1wogUAYwd/33aDaAEAlAG/zmoQLYDxgb9vu0G0AADKgF9nNYgWwPjA37fdIFoAAGXAr7MaRAtgfODv224QLQCAMuDXWQ2iBTA+8PdtN4gWAEAZ8OusJpdoHV55l9zwlZtMNg3Ztqv/y1Vyd8urZjyapzmsDf2vyt1rPgiX7pQf/y4cBYCsJBIJk6prpvqzMlj74FTTt++sPyeFv2+7QbQAAMqAX2c1uUTLsPF+2RSOVn3uKuk5I/LgP14lVV9tidsiGr9wlTO9RWZvjGcBQBaMZH2uygrXV9qkL5mUgUCkNv98rd/V9Kn5qu2bC3/fdoNoAQCUAb/OavISrZ41wQHha3FzJFSuaKl8vdNyk5wxU4gWwEhE0rTn8SnB+BSpUeGaOFWShzanC9VLNcF0TbzMnNdSs1z8fdsNogUAUAb8OqvJS7QCnpl+jVx9/U1Grh7caGt0JFqv/+i6sFfQduUsUdG68jr7sSIAZMec0aqaEEuVitaNTyXjeTEfrYqnddiZmpOGv2+7QbQAAMqAX2c1w4oWAJSMSJ66FqXOaN04s9a0N63vS+vbMt1+bNg1kNachr9vu0G0AADKgF9nNYgWQGWgolXzkt+aP/6+7QbRAgAoA36d1SBaAOMDf992g2gBAJQBv85qEC2A8YG/b7tBtAAAyoBfZzWIFsD4wN+33SBaAABlwK+zGkQLYHzg79tuEC0AgDLg11nN8eP2z8kBYGzj79tusorWoUNd/joAAGCUdHUdzKizUU6f5s0twFhmuP1bk1W0NMgWAMCFo7XUr69uTp78UI4fP+4vBgBjAN13/X3aT07RIoQQQgghFxZEixBCCCGkREG0CCGEEEJKFESLEEIIIaREQbQIIYQQQkoURIsQQgghpEQZUbRuuumr8ld/9VeSSCQuyfzZn/1ZxmOSK++887acOPFBRvtwOXWqV95//6i8++7+jHmEEEIIGdsZVrR86biU8+lPfzrj8Yly5Mh7GW2jiUpasdZFCCGEkIufrKL1+99vzRANkpA//dM/zXis3n57Z0bbhUYvYOi3EUIIIWTsJato+YLR4f4c18CejPnlSW2WtmKlVlb/rD5Le2b8x+rC0y2//kN3Wpt+lJjZjxBCCCFjLXmJ1p7Ar6LxPiNbO+z0ij2yZ1eQvUnp2zi8qCzfm1qHxqzmowEz9Ptmz/IsbfmlaUuwfd17pC+4ueW3Z87XdUvf5iztmVm8+Kn4ccomRDNmzJDFTz0l9905I2Pe757IbPv449/IjCd+k6WdEEIIIWM9eYtWOn12XiRa3X3S8YNJUr8lbA+lqP7mSbL6gMiORdlEy/atXZ+003vtMqY9WG/nU7XS9NqA9G1ZYERJ19m1bo4kvtwknXMT8sTStrB/MhbB+u9PEz35ZtqTHanbciRK0e2UgS7RM1l7nquV1XsHTB89cxet0wxNn/TH4i/+YkL8OO3a9U7GYxeJ1ndC0frdgRNm+J2fvZUhWjNmfEcQLUIIIWT8piDRikTFFS1fYHR80lP2jFdy3TSZ9FyX7FmRXbRqZtakpo0M1dp1h+tV8em4K5h/eyBYzhktXV9gQfF6zG3eXB1um72dSWm3lbptPRun27n5QZ1+Qto+H/R9pNPc/o6z4bKft31tn/T8xV9MiB+nXKIVjS/6bTD94w7bHshULFq/fcLpi2gRQggh4zV5ida0QJz0Y74oXVueyOhT6VERm5SlvdCM9NEhIYQQQkiUvESLpOI/VqUIAkcIIYSMj2QVLS7vkD1c3oEQQgghhSSraEXxReNSDhcsJYQQQkihGVa0NPwEDz/BQwghhJDRZUTRIoQQQgghowuiRQghhBBSoiBahBBCCCElCqJFCCGEEFKiIFqEEEIIISUKokUIIYQQUqIgWoQQQgghJQqiRQghhBBSoiBahBBCCCElyv8PM9XzdrYurkgAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,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>