# PLAN.md — Fase 06: Integrasi Pemindaian Barcode / QR Code Mobile

## 1. Goal & Outcome
Menyediakan fitur pemindaian kamera interaktif pada smartphone/tablet untuk membaca kode barcode SKU barang dan dokumen SPK, sehingga petugas lantai gudang dapat bekerja cepat tanpa harus mengetik manual di layar kecil HP.

---

## 2. Rincian Task / Wave Pengerjaan

### Task 1: Instalasi Library Scanner Kamera (`html5-qrcode`)
- **Aksi**: Install package `html5-qrcode` yang stabil untuk Next.js client component.
- **Output**: `package.json` terupdate dengan dependency scanner.

### Task 2: Pembuatan Komponen Reusable `BarcodeScannerModal.tsx`
- **File**: `src/components/BarcodeScannerModal.tsx`
- **Fitur**:
  - Inisialisasi video stream kamera belakang (`facingMode: "environment"`).
  - Tampilan overlay pemindaian khas `taste-skill` (laser line mint `#a1ffcb`, sudut bidik tajam).
  - Penanganan error izin kamera (Permission Denied) yang ramah pengguna.
  - Haptic feedback (`navigator.vibrate`) saat kode barcode/QR terdeteksi.
  - Callback event `onScanSuccess(decodedText: string)`.

### Task 3: Integrasi Tombol Scan ke Modul Transaksi & Pencarian
- **Transaksi Inbound/Outbound (`src/components/TransactionsModule.tsx`)**:
  - Tombol icon barcode di samping pilihan barang untuk langsung menambahkan baris barang yang ter-scan.
- **Stock Opname (`src/components/OpnameModule.tsx`)**:
  - Tombol scan cepat untuk langsung memfokuskan kursor ke input kuantitas fisik item yang bersangkutan.
- **Master Data (`src/components/MasterAndReportsModule.tsx`)**:
  - Tombol scan di samping kolom pencarian SKU/Barang.

### Task 4: Verifikasi & Uji Kompilasi Build
- **Aksi**: Menjalankan `npm.cmd run build` untuk memastikan tidak ada error SSR/hydration pada Next.js client component dan API kamera.

---

## 3. Kriteria Keberhasilan (Acceptance Criteria)
1. Modal scanner dapat dibuka dan ditutup dengan responsif di layar HP.
2. Kamera berhasil mendeteksi barcode 1D (Code 128 / SKU) dan QR Code.
3. Nilai SKU hasil scan otomatis terisi ke dalam transaksi tanpa refresh halaman.
4. Kompilasi build produksi Next.js `0 errors`.

