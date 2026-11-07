"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, X, AlertTriangle, RefreshCw } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
  description?: string;
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "Pindai Barcode / QR Code",
  description = "Arahkan kamera smartphone Anda ke label barcode atau QR SKU barang",
}: BarcodeScannerModalProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = "barcode-scanner-region";

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
      setErrorMsg(null);
      setIsStarting(true);
      return;
    }

    let isMounted = true;

    async function initScanner() {
      try {
        setIsStarting(true);
        setErrorMsg(null);

        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (!devices || devices.length === 0) {
          setErrorMsg("Kamera tidak ditemukan pada perangkat ini.");
          setIsStarting(false);
          return;
        }

        setCameras(devices);

        // Cari kamera belakang (environment)
        const backCamera =
          devices.find(
            (d) =>
              d.label.toLowerCase().includes("back") ||
              d.label.toLowerCase().includes("belakang") ||
              d.label.toLowerCase().includes("environment")
          ) || devices[devices.length - 1];

        const selectedId = backCamera ? backCamera.id : devices[0].id;
        setActiveCameraId(selectedId);

        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;

        await scanner.start(
          selectedId,
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // Haptic vibration feedback di smartphone
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate(80);
            }
            onScan(decodedText);
            onClose();
          },
          () => {
            // Frame error (abaikan frame tanpa barcode)
          }
        );

        if (isMounted) setIsStarting(false);
      } catch (err: any) {
        if (!isMounted) return;
        setIsStarting(false);
        const str = String(err?.message || err);
        if (str.includes("Permission") || str.includes("NotAllowedError")) {
          setErrorMsg(
            "Izin kamera ditolak. Harap izinkan akses kamera di pengaturan browser Anda."
          );
        } else {
          setErrorMsg(`Gagal membuka kamera: ${str}`);
        }
      }
    }

    // Delay sedikit agar elemen DOM #barcode-scanner-region sudah dirender
    const timer = setTimeout(initScanner, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen, onClose, onScan]);

  const switchCamera = async () => {
    if (cameras.length <= 1 || !scannerRef.current) return;
    try {
      setIsStarting(true);
      await scannerRef.current.stop();

      const currentIndex = cameras.findIndex((c) => c.id === activeCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCamera = cameras[nextIndex];

      setActiveCameraId(nextCamera.id);

      await scannerRef.current.start(
        nextCamera.id,
        {
          fps: 15,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(80);
          }
          onScan(decodedText);
          onClose();
        },
        () => {}
      );
      setIsStarting(false);
    } catch {
      setIsStarting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#232323]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="taste-card bg-white w-full max-w-md overflow-hidden flex flex-col">
        {/* Header Modal */}
        <div className="p-4 border-b border-[#232323]/12 flex items-center justify-between bg-[#efefec]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[4px] bg-[#232323] text-[#a1ffcb] flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-medium text-[#232323]">
                {title}
              </h3>
              <p className="text-[11px] text-[#666662]">{description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[4px] hover:bg-[#232323]/10 text-[#232323]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanner Viewport */}
        <div className="p-4 flex flex-col items-center justify-center bg-[#f6f6f4] relative min-h-[300px]">
          {errorMsg ? (
            <div className="p-4 rounded-[6px] bg-rose-50 border border-rose-300 text-rose-900 text-xs text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-rose-600 mx-auto" />
              <p className="font-medium">{errorMsg}</p>
              <p className="text-[11px] text-[#666662]">
                Pastikan Anda membuka halaman via HTTPS atau localhost dan memberikan izin kamera.
              </p>
            </div>
          ) : (
            <>
              {isStarting && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#f6f6f4]/90 gap-2">
                  <RefreshCw className="w-6 h-6 text-[#232323] animate-spin" />
                  <span className="text-xs font-mono text-[#666662]">
                    Memulai video stream kamera...
                  </span>
                </div>
              )}
              {/* Target elemen untuk html5-qrcode */}
              <div
                id={regionId}
                className="w-full max-w-[280px] overflow-hidden rounded-[6px] border-2 border-[#232323]"
              />
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-[#232323]/12 bg-white flex items-center justify-between text-xs">
          {cameras.length > 1 ? (
            <button
              onClick={switchCamera}
              className="btn btn--secondary px-3 py-1.5 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ganti Kamera</span>
            </button>
          ) : (
            <span className="font-mono text-[11px] text-[#666662]">
              Kamera Aktif
            </span>
          )}
          <button
            onClick={onClose}
            className="btn btn--secondary px-4 py-1.5"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

