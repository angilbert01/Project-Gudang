# RESEARCH.md — Fase 06: Integrasi Pemindaian Barcode & QR Code Mobile

## 1. Domain & Technical Requirements
Petugas gudang fisik membutuhkan kemampuan memindai barcode/QR dari kemasan kertas plano, kaleng tinta, palet SKU sisa, atau lembar SPK produksi langsung menggunakan kamera smartphone (tanpa memerlukan alat dedicated barcode scanner eksternal).

### Tantangan Teknis di Browser:
1. **Dukungan API Browser**: `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })` untuk kamera belakang smartphone.
2. **Library Scanner di Next.js (React Client Component)**:
   - Menggunakan `@zxing/library` atau `html5-qrcode`, atau implementasi pure Web Streams + BarcodeDetector API bawaan browser modern (Chrome Android & iOS Safari 17+) dengan fallback library ringan.
   - Pilihan paling stabil dan zero-extra-heavy-backend: **`html5-qrcode`** (mendukung Code 128, Code 39, QR Code, EAN-13 langsung dari video canvas).
3. **Penyambungan ke Alur Transaksi**:
   - **Pencarian Master Barang**: Scan SKU langsung memfilter tabel barang.
   - **Form Barang Masuk / Keluar**: Scan SKU menambahkan baris barang otomatis tanpa memilih dropdown manual.
   - **Stock Opname**: Scan barcode label rak langsung melompat ke baris barang yang dihitung.

---

## 2. Arsitektur Komponen UI
- Komponen modal reusable: `src/components/BarcodeScannerModal.tsx`.
- Desain mengikuti `taste-skill`: Frame bidik kamera dengan aksen mint `#a1ffcb`, tombol switch kamera depan/belakang, toggle senter/flash (jika didukung perangkat), dan tombol tutup bersih.
- Respon pemindaian: Umpan balik getar haptic (`navigator.vibrate(80)`) dan audio beep subtle untuk konfirmasi hasil scan sukses.

