"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Scissors,
  SlidersHorizontal,
  History,
  Plus,
  Trash2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Download,
  Search,
  Database,
  Camera,
} from "lucide-react";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import {
  exportToCsvOrExcel,
  formatDateId,
  formatNumber,
  formatRupiah,
  todayYmd,
} from "@/lib/format";

interface TransactionsModuleProps {
  user: {
    userId: number;
    name: string;
    role: "ADMIN" | "KEPALA_GUDANG" | "PETUGAS";
  };
  items: Array<Record<string, any>>;
  suppliers: Array<Record<string, any>>;
  purchaseOrders: Array<Record<string, any>>;
  transactions: Array<Record<string, any>>;
  initialSubTab?: "IN" | "OUT" | "CUTTING" | "ADJUSTMENT" | "OPENING" | "HISTORY";
  preselectedPo?: Record<string, any> | null;
  onClearPreselectedPo?: () => void;
  onRefresh: () => Promise<void>;
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function TransactionsModule({
  user,
  items,
  suppliers,
  purchaseOrders,
  transactions,
  initialSubTab = "IN",
  preselectedPo,
  onClearPreselectedPo,
  onRefresh,
}: TransactionsModuleProps) {
  const canAdjustOrVoid = user.role === "ADMIN" || user.role === "KEPALA_GUDANG";
  const isAdmin = user.role === "ADMIN";

  const [subTab, setSubTab] = useState<
    "IN" | "OUT" | "CUTTING" | "ADJUSTMENT" | "OPENING" | "HISTORY"
  >(preselectedPo ? "IN" : initialSubTab);

  // Idempotency request_id (BR-03): Regenerated every time form opens or completes
  const [requestId, setRequestId] = useState<string>(() => generateUuid());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
    docNo?: string;
  } | null>(null);

  // Common Header State
  const [txDate, setTxDate] = useState(todayYmd());
  const [supplierId, setSupplierId] = useState<number>(
    preselectedPo?.supplier_id || suppliers.find((s) => s.is_active)?.id || 1
  );
  const [selectedPoId, setSelectedPoId] = useState<number | "">(
    preselectedPo?.id || ""
  );
  const [referenceNumber, setReferenceNumber] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [reasonCode, setReasonCode] = useState("SELISIH_OPNAME");
  const [notes, setNotes] = useState("");
  const [duplicateNotaWarning, setDuplicateNotaWarning] = useState<string | null>(
    null
  );
  const [showScanner, setShowScanner] = useState(false);

  // Line items for IN / OUT / ADJUSTMENT / OPENING
  const activeItems = items.filter((i) => i.is_active && !i.is_auto_archived);
  const [lines, setLines] = useState<
    Array<{
      item_id: number;
      po_item_id?: number | null;
      input_quantity: number;
      use_purchase_unit: boolean;
      direction: "PLUS" | "MINUS";
      unit_cost: number;
    }>
  >(() => {
    const first = activeItems[0];
    return first
      ? [
          {
            item_id: first.id,
            input_quantity: 1,
            use_purchase_unit: Number(first.conversion_factor) > 1,
            direction: "PLUS",
            unit_cost:
              Number(first.last_purchase_cost || first.avg_cost || 0) *
              (Number(first.conversion_factor) > 1
                ? Number(first.conversion_factor)
                : 1),
          },
        ]
      : [];
  });

  // State khusus Pemotongan Kertas & Sisa (FR-004 & BR-003)
  const paperItems = items.filter(
    (i) =>
      i.is_active &&
      (String(i.category_name).toLowerCase().includes("kertas") ||
        String(i.category_name).toLowerCase().includes("sisa"))
  );
  const [cutSourceItemId, setCutSourceItemId] = useState<number>(
    paperItems[0]?.id || activeItems[0]?.id || 1
  );
  const [cutQty, setCutQty] = useState<number>(100);
  const [cutSpk, setCutSpk] = useState<string>("SPK/2026/11/");
  const [cutRequester, setCutRequester] = useState<string>("Divisi Potong Polar");
  const [cutTargetSize, setCutTargetSize] = useState<string>("65 x 79 cm");
  const [remnantWidthCm, setRemnantWidthCm] = useState<number>(30);
  const [remnantLengthCm, setRemnantLengthCm] = useState<number>(45);
  const [remnantQty, setRemnantQty] = useState<number>(100);
  const [customRemnantSku, setCustomRemnantSku] = useState<string>("");

  // State History Filter & Void Modal
  const [histSearch, setHistSearch] = useState("");
  const [histType, setHistType] = useState("ALL");
  const [voidModal, setVoidModal] = useState<{
    tx: Record<string, any>;
    reason: string;
  } | null>(null);

  // Handle Preselected PO from PO Module ("Terima Barang")
  useEffect(() => {
    if (preselectedPo) {
      setSubTab("IN");
      setSupplierId(Number(preselectedPo.supplier_id));
      setSelectedPoId(Number(preselectedPo.id));
      const poLines = (preselectedPo.items || [])
        .filter((it: any) => Number(it.remaining_base_qty) > 0)
        .map((it: any) => {
          const usePurch = Number(it.conversion_factor) > 1;
          return {
            item_id: Number(it.item_id),
            po_item_id: Number(it.id),
            input_quantity: usePurch
              ? Number(it.remaining_input_qty)
              : Number(it.remaining_base_qty),
            use_purchase_unit: usePurch,
            direction: "PLUS" as const,
            unit_price: Number(it.unit_price || 0),
            unit_cost: Number(it.unit_price || 0),
          };
        });
      if (poLines.length > 0) {
        setLines(poLines);
      }
      if (onClearPreselectedPo) onClearPreselectedPo();
    }
  }, [preselectedPo, onClearPreselectedPo]);

  // BR-13: Cek duplikat Nomor Nota dari Supplier yang sama
  useEffect(() => {
    if (subTab !== "IN" || !referenceNumber.trim() || !supplierId) {
      setDuplicateNotaWarning(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/transactions?check_nota=${encodeURIComponent(
            referenceNumber.trim()
          )}&supplier_id=${supplierId}`
        );
        const data = await res.json();
        if (data.isDuplicate && data.existingTransaction) {
          setDuplicateNotaWarning(
            `BR-13 Peringatan: Nomor Nota '${referenceNumber
              .trim()
              .toUpperCase()}' dari supplier ini sudah pernah dicatat pada transaksi ${
              data.existingTransaction.transaction_number
            } (${formatDateId(
              data.existingTransaction.transaction_date
            )}). Pastikan bukan input ganda.`
          );
        } else {
          setDuplicateNotaWarning(null);
        }
      } catch {
        // ignore
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [referenceNumber, supplierId, subTab]);

  // Saat memilih PO pada form Barang Masuk, isi otomatis sisa kuantitas PO (FR-06)
  const handleSelectPoForInbound = (poIdVal: string) => {
    if (!poIdVal) {
      setSelectedPoId("");
      return;
    }
    const poIdNum = Number(poIdVal);
    setSelectedPoId(poIdNum);
    const po = purchaseOrders.find((p) => Number(p.id) === poIdNum);
    if (!po) return;
    setSupplierId(Number(po.supplier_id));
    const remainingLines = (po.items || [])
      .filter((it: any) => Number(it.remaining_base_qty) > 0)
      .map((it: any) => {
        const usePurch = Number(it.conversion_factor) > 1;
        return {
          item_id: Number(it.item_id),
          po_item_id: Number(it.id),
          input_quantity: usePurch
            ? Number(it.remaining_input_qty)
            : Number(it.remaining_base_qty),
          use_purchase_unit: usePurch,
          direction: "PLUS" as const,
          unit_cost: Number(it.unit_price || 0),
        };
      });
    if (remainingLines.length > 0) {
      setLines(remainingLines);
    }
  };

  const handleSubmitStandardTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: subTab,
          request_id: requestId,
          transaction_date: txDate,
          supplier_id: subTab === "IN" ? supplierId : null,
          purchase_order_id:
            subTab === "IN" && selectedPoId ? Number(selectedPoId) : null,
          reference_number: referenceNumber,
          requester_name: requesterName,
          reason_code: subTab === "ADJUSTMENT" ? reasonCode : null,
          notes,
          items: lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Transaksi ditolak." });
      } else {
        setFeedback({
          type: "success",
          text: data.message,
          docNo: data.transaction_number,
        });
        setRequestId(generateUuid());
        setReferenceNumber("");
        setNotes("");
        setSelectedPoId("");
        await onRefresh();
      }
    } catch {
      setFeedback({ type: "error", text: "Gagal menghubungi server." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitCutting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CUTTING",
          request_id: requestId,
          transaction_date: txDate,
          source_item_id: cutSourceItemId,
          qty_cut: cutQty,
          reference_number: cutSpk,
          requester_name: cutRequester,
          target_size: cutTargetSize,
          remnant_width_cm: remnantWidthCm,
          remnant_length_cm: remnantLengthCm,
          remnant_qty: remnantQty,
          custom_remnant_sku: customRemnantSku,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Gagal memproses pemotongan.",
        });
      } else {
        setFeedback({
          type: "success",
          text: data.message,
          docNo: data.transaction_number,
        });
        setRequestId(generateUuid());
        setNotes("");
        await onRefresh();
      }
    } catch {
      setFeedback({ type: "error", text: "Gagal menghubungi server." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidTransaction = async () => {
    if (!voidModal || submitting) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "REVERSAL",
          request_id: generateUuid(),
          reverses_transaction_id: voidModal.tx.id,
          notes: voidModal.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Void ditolak." });
      } else {
        setFeedback({
          type: "success",
          text: data.message,
          docNo: data.transaction_number,
        });
        setVoidModal(null);
        await onRefresh();
      }
    } catch {
      setFeedback({ type: "error", text: "Gagal menghubungi server." });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSourcePaper = items.find(
    (i) => Number(i.id) === Number(cutSourceItemId)
  );
  const minRemnantDim = Math.min(
    Number(remnantWidthCm || 0),
    Number(remnantLengthCm || 0)
  );
  const isRemnantWaste = minRemnantDim < 20;
  const autoRemnantSkuPreview = (() => {
    if (!selectedSourcePaper) return "SISA-KRT-20X20";
    const wInt = Math.round(Math.min(remnantWidthCm, remnantLengthCm));
    const lInt = Math.round(Math.max(remnantWidthCm, remnantLengthCm));
    const baseTag = String(selectedSourcePaper.sku)
      .replace(/^KRT-/, "")
      .split("-")[0]
      .toUpperCase();
    return `SISA-${baseTag}-${wInt}X${lInt}`;
  })();

  const openPosForSupplier = purchaseOrders.filter(
    (p) =>
      Number(p.supplier_id) === Number(supplierId) &&
      ["SENT", "PARTIALLY_RECEIVED"].includes(p.status)
  );

  const filteredHistory = transactions.filter((tx) => {
    if (histType !== "ALL" && tx.type !== histType) return false;
    if (histSearch.trim()) {
      const q = histSearch.toLowerCase();
      const matchNo = String(tx.transaction_number).toLowerCase().includes(q);
      const matchRef = String(tx.reference_number || "")
        .toLowerCase()
        .includes(q);
      const matchSup = String(tx.supplier_name || "").toLowerCase().includes(q);
      const matchItem = (tx.details || []).some(
        (d: any) =>
          String(d.sku).toLowerCase().includes(q) ||
          String(d.item_name).toLowerCase().includes(q)
      );
      if (!matchNo && !matchRef && !matchSup && !matchItem) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Navigasi Sub-Tab Transaksi — Unified Two-Style System (taste-skill) */}
      <div className="taste-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setSubTab("IN");
              setRequestId(generateUuid());
              setFeedback(null);
            }}
            className={`btn px-3 py-1.5 text-xs flex items-center gap-1.5 ${
              subTab === "IN" ? "btn--primary" : "btn--secondary"
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Barang Masuk</span>
          </button>

          <button
            onClick={() => {
              setSubTab("OUT");
              setRequestId(generateUuid());
              setFeedback(null);
            }}
            className={`btn px-3 py-1.5 text-xs flex items-center gap-1.5 ${
              subTab === "OUT" ? "btn--primary" : "btn--secondary"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Barang Keluar</span>
          </button>

          <button
            onClick={() => {
              setSubTab("CUTTING");
              setRequestId(generateUuid());
              setFeedback(null);
            }}
            className={`btn px-3 py-1.5 text-xs flex items-center gap-1.5 ${
              subTab === "CUTTING" ? "btn--primary" : "btn--secondary"
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Potong Plano &amp; Sisa</span>
          </button>

          {canAdjustOrVoid && (
            <button
              onClick={() => {
                setSubTab("ADJUSTMENT");
                setRequestId(generateUuid());
                setFeedback(null);
              }}
              className={`btn px-3 py-1.5 text-xs flex items-center gap-1.5 ${
                subTab === "ADJUSTMENT" ? "btn--primary" : "btn--secondary"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Koreksi Stok</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => {
                setSubTab("OPENING");
                setRequestId(generateUuid());
                setFeedback(null);
              }}
              className={`btn px-3 py-1.5 text-xs flex items-center gap-1.5 ${
                subTab === "OPENING" ? "btn--primary" : "btn--secondary"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Saldo Awal</span>
            </button>
          )}
        </div>

        <button
          onClick={() => setSubTab("HISTORY")}
          className={`btn px-3 py-1.5 text-xs flex items-center gap-1.5 ${
            subTab === "HISTORY" ? "btn--primary" : "btn--secondary"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Riwayat ({transactions.length})</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-[6px] border flex items-center justify-between text-xs ${
            feedback.type === "success"
              ? "bg-white border-[#232323] text-[#232323]"
              : "bg-rose-50 border-rose-300 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-[4px] bg-[#a1ffcb] text-[#113823]">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <div>
              <p className="font-medium">{feedback.text}</p>
              {feedback.docNo && (
                <p className="text-[11px] text-[#666662] mt-0.5">
                  Nomor Dokumen Resmi:{" "}
                  <span className="font-mono font-medium text-[#232323]">
                    {feedback.docNo}
                  </span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="font-medium underline ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {/* =====================================================================
          FORM PEMOTONGAN KERTAS & MANAJEMEN SKU SISA (FR-004 & BR-003)
          ===================================================================== */}
      {subTab === "CUTTING" && (
        <form
          onSubmit={handleSubmitCutting}
          className="taste-card p-5 sm:p-6 space-y-5"
        >
          <div className="border-b border-[#232323]/12 pb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-medium text-[#232323]">
                Pemotongan Kertas Plano
              </h3>
              <p className="text-xs text-[#666662] mt-0.5">
                Potong lembar plano untuk SPK dan klasifikasikan potongan sisa otomatis (&ge;20 cm masuk stok baru, &lt;20 cm jadi waste).
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#666662]">
              ID: {requestId.slice(0, 8)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[#232323] mb-1">
                Tanggal Pemotongan <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#232323] mb-1">
                Nomor Job / SPK Produksi <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: SPK/2026/11/015"
                value={cutSpk}
                onChange={(e) => setCutSpk(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#232323] mb-1">
                Operator Potong / Divisi Pemohon
              </label>
              <input
                type="text"
                placeholder="Contoh: Operator Mesin Polar (Kang Dedi)"
                value={cutRequester}
                onChange={(e) => setCutRequester(e.target.value)}
                className="w-full px-3 py-2 border border-[#232323]/25 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-[6px] bg-[#f6f6f4] border border-[#232323]/15">
            <div className="md:col-span-2">
              <label className="block text-[13px] font-medium text-[#232323] mb-1">
                Pilih SKU Kertas Utama yang Dipotong{" "}
                <span className="text-rose-600">*</span>
              </label>
              <select
                value={cutSourceItemId}
                onChange={(e) => setCutSourceItemId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-medium bg-white"
              >
                {paperItems.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name} (Stok Tersedia: {formatNumber(p.current_stock)}{" "}
                    {p.unit_name})
                  </option>
                ))}
              </select>
              {selectedSourcePaper && (
                <p className="text-xs text-[#666662] mt-1.5 font-mono">
                  Saldo Saat Ini:{" "}
                  <span className="font-medium text-[#232323]">
                    {formatNumber(selectedSourcePaper.current_stock)} Lembar
                  </span>{" "}
                  ({formatNumber(Number(selectedSourcePaper.current_stock) / 500)}{" "}
                  Rim)
                </p>
              )}
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#232323] mb-1">
                Jumlah Lembar Plano Dipotong <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={cutQty}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setCutQty(v);
                  setRemnantQty(v);
                }}
                className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-mono font-medium bg-white"
              />
              {selectedSourcePaper &&
                cutQty > Number(selectedSourcePaper.current_stock) && (
                  <p className="text-xs text-rose-700 font-medium mt-1">
                    BR-01: Melebihi stok tersedia ({selectedSourcePaper.current_stock}{" "}
                    Lbr)
                  </p>
                )}
            </div>
          </div>

          {/* Input Dimensi Potong & Dimensi Sisa */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[#232323] mb-1">
                Ukuran Jadi Hasil Potong (Untuk Mesin Cetak)
              </label>
              <input
                type="text"
                placeholder="Contoh: 65 x 79 cm (Bagi 2)"
                value={cutTargetSize}
                onChange={(e) => setCutTargetSize(e.target.value)}
                className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#232323] mb-1">
                Lebar Sisa Kertas (cm) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                required
                value={remnantWidthCm}
                onChange={(e) => setRemnantWidthCm(Number(e.target.value))}
                className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-mono font-medium"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#232323] mb-1">
                Panjang Sisa Kertas (cm) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                required
                value={remnantLengthCm}
                onChange={(e) => setRemnantLengthCm(Number(e.target.value))}
                className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-mono font-medium"
              />
            </div>
          </div>

          {/* Live Sheet Cutting Diagram & BR-003 Validation Frame */}
          <div
            data-visual="plano-cut-diagram"
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 rounded-[6px] border border-[#232323]/20 bg-[#f6f6f4]"
          >
            {/* Visual Skema Lembar Plano */}
            <div className="lg:col-span-5 flex flex-col justify-between p-4 bg-white border border-[#232323]/15 rounded-[6px]">
              <div className="flex items-center justify-between text-xs font-mono text-[#666662] mb-3">
                <span>SKEMA POTONG PLANO</span>
                <span>{selectedSourcePaper?.dimensions || "79 x 109 cm"}</span>
              </div>
              <div className="grid grid-cols-12 gap-1.5 h-32">
                <div className="col-span-8 border border-[#232323] bg-[#efefec] rounded-[4px] p-3 flex flex-col justify-between">
                  <span className="font-mono text-[11px] text-[#666662]">
                    AREA CETAK UTAMA (SPK)
                  </span>
                  <div className="font-mono text-xs font-medium text-[#232323]">
                    {cutTargetSize || "Area Produksi"}
                  </div>
                  <span className="font-mono text-[11px] text-[#666662]">
                    -{formatNumber(cutQty)} Lembar
                  </span>
                </div>
                <div
                  className={`col-span-4 border border-dashed rounded-[4px] p-2.5 flex flex-col justify-between ${
                    isRemnantWaste
                      ? "border-amber-500 bg-amber-50/70 text-amber-900"
                      : "border-[#113823] bg-[#a1ffcb] text-[#113823]"
                  }`}
                >
                  <span className="font-mono text-[10px] font-semibold">
                    {isRemnantWaste ? "WASTE (<20cm)" : "SKU SISA (≥20cm)"}
                  </span>
                  <div className="font-mono text-xs font-semibold">
                    {remnantWidthCm} × {remnantLengthCm} cm
                  </div>
                  <span className="font-mono text-[10px]">
                    {isRemnantWaste ? "0 Lbr ke Stok" : `+${formatNumber(remnantQty)} Lbr`}
                  </span>
                </div>
              </div>
            </div>

            {/* Detail Keputusan Aturan Bisnis BR-003 */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              {isRemnantWaste ? (
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-amber-100 text-amber-900 border border-amber-300 font-mono text-xs font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>ALOKASI WASTE / SCRAP (BR-003)</span>
                  </div>
                  <h4 className="font-display text-base font-medium text-[#232323]">
                    Dimensi sisa {remnantWidthCm} cm × {remnantLengthCm} cm memiliki sisi
                    di bawah 20 cm
                  </h4>
                  <p className="text-xs text-[#666662] leading-relaxed">
                    Sesuai aturan bisnis BR-003, potongan kertas dengan lebar atau panjang
                    kurang dari 20 cm tidak layak disimpan sebagai SKU aktif dan otomatis
                    dicatat sebagai susut produksi (waste) pada transaksi ini.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-[#a1ffcb] text-[#113823] font-mono text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>MASUK KATEGORI SISA (BR-003: &ge; 20 CM)</span>
                    </div>
                    <h4 className="font-display text-base font-medium text-[#232323] mt-1.5">
                      Dimensi sisa {remnantWidthCm} cm × {remnantLengthCm} cm memenuhi
                      syarat SKU Turunan
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#232323] mb-1">
                        Kode SKU Turunan Kategori Sisa
                      </label>
                      <input
                        type="text"
                        placeholder={autoRemnantSkuPreview}
                        value={customRemnantSku}
                        onChange={(e) =>
                          setCustomRemnantSku(e.target.value.toUpperCase())
                        }
                        className="w-full px-3 py-2 border border-[#232323]/25 bg-white text-sm font-mono font-medium"
                      />
                      <p className="text-[11px] text-[#666662] mt-1">
                        Default otomatis:{" "}
                        <span className="font-mono font-medium text-[#232323]">
                          {autoRemnantSkuPreview}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#232323] mb-1">
                        Kuantitas Lembar Sisa Masuk Stok{" "}
                        <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={remnantQty}
                        onChange={(e) => setRemnantQty(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-[#232323]/25 bg-white text-sm font-mono font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={
                submitting ||
                Boolean(
                  selectedSourcePaper &&
                    cutQty > Number(selectedSourcePaper.current_stock)
                )
              }
              className="btn btn--primary px-6 py-3 text-xs flex items-center gap-2 disabled:opacity-50"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>
                {submitting
                  ? "Memproses Pemotongan..."
                  : "Simpan & Posting Transaksi Pemotongan Kertas"}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* =====================================================================
          FORM TRANSAKSI STANDAR: IN, OUT, ADJUSTMENT, OPENING
          ===================================================================== */}
      {["IN", "OUT", "ADJUSTMENT", "OPENING"].includes(subTab) && (
        <form
          onSubmit={handleSubmitStandardTx}
          className="taste-card p-5 sm:p-6 space-y-5"
        >
          <div className="border-b border-[#232323]/12 pb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-medium text-[#232323]">
                {subTab === "IN" && "Pencatatan Barang Masuk"}
                {subTab === "OUT" && "Pencatatan Barang Keluar (SPK)"}
                {subTab === "ADJUSTMENT" && "Koreksi Stok Manual"}
                {subTab === "OPENING" && "Saldo Awal Barang"}
              </h3>
              <p className="text-xs text-[#666662] mt-0.5">
                {subTab === "IN" &&
                  "Konversi otomatis 1 Rim = 500 Lembar / 1 Kaleng = 5 Kg dan Moving Average Cost."}
                {subTab === "OUT" &&
                  "Stok negatif ditolak otomatis jika melebihi ketersediaan gudang."}
                {subTab === "ADJUSTMENT" &&
                  "Wajib mengisi alasan koreksi dan catatan operasional."}
                {subTab === "OPENING" &&
                  "Hanya berlaku untuk pengisian saldo awal barang."}
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#666662]">
              ID: {requestId.slice(0, 8)}
            </span>
          </div>

          {duplicateNotaWarning && subTab === "IN" && (
            <div className="p-3.5 rounded-[6px] bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{duplicateNotaWarning}</span>
            </div>
          )}

          {/* Header Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[#232323] mb-1">
                Tanggal Transaksi <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                max={todayYmd()}
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-mono"
              />
              <p className="text-[11px] text-[#666662] mt-1">
                BR-08: Tidak boleh masa depan (Maks mundur Petugas: 2 hr, Manager: 30 hr).
              </p>
            </div>

            {subTab === "IN" && (
              <>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Supplier <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => {
                      setSupplierId(Number(e.target.value));
                      setSelectedPoId("");
                    }}
                    className="w-full px-3 py-2 border border-[#232323]/25 text-sm"
                  >
                    {suppliers
                      .filter((s) => s.is_active)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Tautkan ke Purchase Order (Opsional)
                  </label>
                  <select
                    value={selectedPoId}
                    onChange={(e) => handleSelectPoForInbound(e.target.value)}
                    className="w-full px-3 py-2 border border-[#232323]/25 bg-[#f6f6f4] text-sm font-medium"
                  >
                    <option value="">-- Penerimaan Tanpa PO / Langsung --</option>
                    {openPosForSupplier.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.po_number} ({po.status} — Terpenuhi {po.fulfilled_percent}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Nomor Nota / Surat Jalan Supplier{" "}
                    <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: SJ-KJA-2026-1140"
                    value={referenceNumber}
                    onChange={(e) =>
                      setReferenceNumber(e.target.value.toUpperCase())
                    }
                    className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-mono uppercase"
                  />
                </div>
              </>
            )}

            {subTab === "OUT" && (
              <>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Nomor Job / SPK Produksi <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: SPK/2026/11/012"
                    value={referenceNumber}
                    onChange={(e) =>
                      setReferenceNumber(e.target.value.toUpperCase())
                    }
                    className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Divisi / Nama Pemohon
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Divisi Cetak Offset 1 (Pak Wahyu)"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#232323]/25 text-sm"
                  />
                </div>
              </>
            )}

            {subTab === "ADJUSTMENT" && (
              <>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Alasan Wajib Koreksi (BR-07){" "}
                    <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-medium"
                  >
                    <option value="SELISIH_OPNAME">Selisih Stock Opname</option>
                    <option value="SISA_PRODUKSI_KEMBALI">
                      Sisa Bahan Kembali dari Produksi
                    </option>
                    <option value="RUSAK">Barang Rusak / Lembab / Cacat</option>
                    <option value="HILANG">Barang Hilang / Susut</option>
                    <option value="SALAH_CATAT">Koreksi Salah Catat Manual</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    No. Referensi Berita Acara (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: BA-KOR-2026-11"
                    value={referenceNumber}
                    onChange={(e) =>
                      setReferenceNumber(e.target.value.toUpperCase())
                    }
                    className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-mono"
                  />
                </div>
              </>
            )}
          </div>

          {/* Tabel Baris Barang Dinamis */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-[#666662]">
                Daftar Baris Barang ({lines.length} Baris)
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="btn btn--accent px-3 py-1.5 text-xs flex items-center gap-1.5"
                  title="Scan Barcode / QR dengan Kamera HP"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan Barcode</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const avail = activeItems.find(
                      (i) => !lines.some((l) => Number(l.item_id) === Number(i.id))
                    );
                    if (!avail) return;
                    const usePurch =
                      subTab === "IN" && Number(avail.conversion_factor) > 1;
                    const factor = usePurch ? Number(avail.conversion_factor) : 1;
                    setLines((prev) => [
                      ...prev,
                      {
                        item_id: avail.id,
                        input_quantity: 1,
                        use_purchase_unit: usePurch,
                        direction: "PLUS",
                        unit_cost: Math.round(
                          Number(avail.last_purchase_cost || avail.avg_cost || 0) *
                            factor
                        ),
                      },
                    ]);
                  }}
                  className="btn btn--secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-[#232323]/15 rounded-[6px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#efefec] border-b border-[#232323]/12 text-left text-xs font-medium text-[#666662]">
                    <th className="py-2.5 px-3">Pilih Barang (SKU &amp; Nama)</th>
                    <th className="py-2.5 px-3 text-right">Stok Saat Ini</th>
                    {subTab === "ADJUSTMENT" && (
                      <th className="py-2.5 px-3">Arah Koreksi</th>
                    )}
                    <th className="py-2.5 px-3 w-32 text-right">Kuantitas</th>
                    <th className="py-2.5 px-3 w-44">Satuan Input</th>
                    {(subTab === "IN" || subTab === "OPENING") && (
                      <th className="py-2.5 px-3 w-44 text-right">
                        Harga Beli / Satuan (Rp){" "}
                        <span className="text-rose-600">*</span>
                      </th>
                    )}
                    <th className="py-2.5 px-3 text-right">Efek ke Saldo Dasar</th>
                    <th className="py-2.5 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232323]/10">
                  {lines.map((line, idx) => {
                    const itemObj = items.find(
                      (i) => Number(i.id) === Number(line.item_id)
                    );
                    const hasConversion =
                      itemObj && Number(itemObj.conversion_factor) > 1;
                    const factor =
                      hasConversion && line.use_purchase_unit
                        ? Number(itemObj.conversion_factor)
                        : 1;
                    const baseQty = Number(
                      (Number(line.input_quantity || 0) * factor).toFixed(3)
                    );
                    const isMinus =
                      subTab === "OUT" ||
                      (subTab === "ADJUSTMENT" && line.direction === "MINUS");
                    const insufficient =
                      isMinus && itemObj && baseQty > Number(itemObj.current_stock);

                    return (
                      <tr
                        key={idx}
                        className={insufficient ? "bg-rose-50/70" : ""}
                      >
                        <td className="py-2.5 px-3">
                          <select
                            value={line.item_id}
                            onChange={(e) => {
                              const newId = Number(e.target.value);
                              const found = items.find(
                                (i) => Number(i.id) === newId
                              );
                              if (!found) return;
                              const useP =
                                subTab === "IN" &&
                                Number(found.conversion_factor) > 1;
                              const f = useP ? Number(found.conversion_factor) : 1;
                              setLines((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        item_id: newId,
                                        po_item_id: null,
                                        use_purchase_unit: useP,
                                        unit_cost: Math.round(
                                          Number(
                                            found.last_purchase_cost ||
                                              found.avg_cost ||
                                              0
                                          ) * f
                                        ),
                                      }
                                    : r
                                )
                              );
                            }}
                            className="w-full px-2.5 py-1.5 border border-[#232323]/25 text-sm font-medium bg-white"
                          >
                            {activeItems.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.sku} — {it.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono">
                          <span className="font-medium text-[#232323]">
                            {formatNumber(itemObj?.current_stock)}{" "}
                            {itemObj?.unit_name}
                          </span>
                          {hasConversion && (
                            <div className="text-[11px] text-[#666662]">
                              (
                              {formatNumber(
                                Number(itemObj.current_stock) /
                                  Number(itemObj.conversion_factor)
                              )}{" "}
                              {itemObj.purchase_unit_name})
                            </div>
                          )}
                        </td>

                        {subTab === "ADJUSTMENT" && (
                          <td className="py-2.5 px-3">
                            <select
                              value={line.direction}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? {
                                          ...r,
                                          direction: e.target.value as
                                            | "PLUS"
                                            | "MINUS",
                                        }
                                      : r
                                  )
                                )
                              }
                              className="px-2.5 py-1.5 border border-[#232323]/25 text-xs font-mono font-medium bg-white"
                            >
                              <option value="PLUS">+ Tambah Stok</option>
                              <option value="MINUS">- Kurangi Stok</option>
                            </select>
                          </td>
                        )}

                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="0.001"
                            step={
                              itemObj?.allow_decimal || line.use_purchase_unit
                                ? "any"
                                : "1"
                            }
                            required
                            value={line.input_quantity}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        input_quantity: Number(e.target.value),
                                      }
                                    : r
                                )
                              )
                            }
                            className="w-full px-2.5 py-1.5 border border-[#232323]/25 text-right font-mono font-medium bg-white"
                          />
                        </td>

                        <td className="py-2.5 px-3">
                          {hasConversion ? (
                            <select
                              value={line.use_purchase_unit ? "PURCHASE" : "BASE"}
                              onChange={(e) => {
                                const useP = e.target.value === "PURCHASE";
                                const f = useP
                                  ? Number(itemObj.conversion_factor)
                                  : 1;
                                setLines((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? {
                                          ...r,
                                          use_purchase_unit: useP,
                                          unit_cost: Math.round(
                                            Number(
                                              itemObj.last_purchase_cost ||
                                                itemObj.avg_cost ||
                                                0
                                            ) * f
                                          ),
                                        }
                                      : r
                                  )
                                );
                              }}
                              className="w-full px-2.5 py-1.5 border border-[#232323]/25 text-xs font-mono bg-white"
                            >
                              <option value="PURCHASE">
                                {itemObj.purchase_unit_name} (1=
                                {itemObj.conversion_factor} {itemObj.unit_name})
                              </option>
                              <option value="BASE">
                                {itemObj.unit_name} (Satuan Dasar)
                              </option>
                            </select>
                          ) : (
                            <span className="px-3 py-1.5 rounded-[4px] bg-[#efefec] text-[#232323] text-xs font-mono inline-block">
                              {itemObj?.unit_name}
                            </span>
                          )}
                        </td>

                        {(subTab === "IN" || subTab === "OPENING") && (
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              required
                              value={line.unit_cost}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? { ...r, unit_cost: Number(e.target.value) }
                                      : r
                                  )
                                )
                              }
                              className="w-full px-2.5 py-1.5 border border-[#232323]/25 text-right font-mono bg-white"
                            />
                            {hasConversion && line.use_purchase_unit && (
                              <div className="text-[10px] font-mono text-[#666662] text-right mt-0.5">
                                = {formatRupiah(Number(line.unit_cost || 0) / factor)}{" "}
                                / {itemObj.unit_name}
                              </div>
                            )}
                          </td>
                        )}

                        <td className="py-2.5 px-3 text-right font-mono">
                          <span
                            className={`font-medium ${
                              isMinus ? "text-rose-700" : "text-[#113823]"
                            }`}
                          >
                            {isMinus ? "-" : "+"}
                            {formatNumber(baseQty)} {itemObj?.unit_name}
                          </span>
                          {insufficient && (
                            <div className="text-[11px] font-medium text-rose-700">
                              BR-01: Stok Kurang
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setLines((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded-[4px]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-[13px] font-medium text-[#232323] mb-1">
              Catatan / Keterangan{" "}
              {subTab === "ADJUSTMENT" && (
                <span className="text-rose-600">* (Wajib)</span>
              )}
            </label>
            <textarea
              rows={2}
              required={subTab === "ADJUSTMENT"}
              placeholder="Tambahkan catatan transaksi..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-[#232323]/25 text-sm"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="btn btn--primary px-6 py-3 text-xs disabled:opacity-50"
            >
              {submitting
                ? "Menyimpan Transaksi (Locked)..."
                : "Simpan & Posting Transaksi"}
            </button>
          </div>
        </form>
      )}

      {/* =====================================================================
          TAB RIWAYAT TRANSAKSI & FITUR VOID / REVERSAL (FR-12 & BR-06)
          ===================================================================== */}
      {subTab === "HISTORY" && (
        <div className="taste-card overflow-hidden">
          <div className="p-4 border-b border-[#232323]/12 flex flex-col sm:flex-row gap-3 items-center justify-between bg-[#efefec]">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#666662] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari No. Transaksi, No. SPK, Nota, SKU..."
                value={histSearch}
                onChange={(e) => setHistSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-[#232323]/25 text-xs bg-white"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={histType}
                onChange={(e) => setHistType(e.target.value)}
                className="px-3 py-1.5 border border-[#232323]/25 text-xs font-medium bg-white"
              >
                <option value="ALL">Semua Tipe Transaksi</option>
                <option value="IN">IN (Barang Masuk)</option>
                <option value="OUT">OUT (Barang Keluar SPK)</option>
                <option value="CUTTING">CUTTING (Pemotongan Kertas)</option>
                <option value="ADJUSTMENT">ADJUSTMENT (Koreksi Stok)</option>
                <option value="OPENING">OPENING (Saldo Awal)</option>
                <option value="REVERSAL">REVERSAL (Void)</option>
              </select>
              <button
                onClick={() => {
                  const headers = [
                    "No. Transaksi",
                    "Tanggal",
                    "Tipe",
                    "No. Referensi (Nota/SPK)",
                    "Supplier / Pemohon",
                    "Rincian Barang",
                    "Status",
                    "Petugas Input",
                  ];
                  const rows = filteredHistory.map((tx) => [
                    tx.transaction_number,
                    formatDateId(tx.transaction_date),
                    tx.type,
                    tx.reference_number || "-",
                    tx.supplier_name || tx.requester_name || "-",
                    (tx.details || [])
                      .map(
                        (d: any) =>
                          `${d.sku}: ${d.qty_delta > 0 ? "+" : ""}${d.qty_delta} ${
                            d.unit_name
                          }`
                      )
                      .join("; "),
                    tx.is_voided ? `DIBATALKAN (${tx.reversed_by_number})` : "SAH",
                    tx.user_name,
                  ]);
                  exportToCsvOrExcel(
                    "Riwayat_Transaksi_Gudang",
                    headers,
                    rows,
                    "EXCEL"
                  );
                }}
                className="btn btn--secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Excel</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f6f6f4] border-b border-[#232323]/12 text-left text-xs font-medium text-[#666662]">
                  <th className="py-3 px-4">No. Dokumen</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Tipe</th>
                  <th className="py-3 px-4">No. Referensi (Nota/SPK)</th>
                  <th className="py-3 px-4">Rincian Mutasi Barang</th>
                  <th className="py-3 px-4">Dicatat Oleh</th>
                  <th className="py-3 px-4 text-right">Tindakan (Void BR-06)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232323]/10">
                {filteredHistory.map((tx) => (
                  <tr
                    key={tx.id}
                    className={
                      tx.is_voided
                        ? "bg-rose-50/30 text-[#666662]"
                        : "hover:bg-[#f6f6f4]"
                    }
                  >
                    <td className="py-3 px-4 font-mono font-medium text-[#232323]">
                      <div
                        className={
                          tx.is_voided ? "line-through text-rose-700" : ""
                        }
                      >
                        {tx.transaction_number}
                      </div>
                      {tx.is_voided && (
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-[4px] bg-rose-100 text-rose-800 text-[10px] font-mono">
                          Dibatalkan oleh {tx.reversed_by_number}
                        </span>
                      )}
                      {tx.type === "REVERSAL" &&
                        tx.reverses_transaction_number && (
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-[4px] bg-[#efefec] text-[#232323] border border-[#232323]/15 text-[10px] font-mono">
                            Membalik {tx.reverses_transaction_number}
                          </span>
                        )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-[#666662]">
                      {formatDateId(tx.transaction_date)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-[4px] bg-[#efefec] text-[#232323] border border-[#232323]/15 font-mono text-xs font-medium">
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-medium text-[#232323] text-xs">
                        {tx.reference_number || "-"}
                      </div>
                      <div className="text-xs text-[#666662]">
                        {tx.supplier_name ||
                          tx.requester_name ||
                          tx.reason_code ||
                          ""}
                      </div>
                      {tx.po_number && (
                        <div className="text-[11px] text-[#232323] font-mono">
                          PO: {tx.po_number}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <ul className="space-y-1 text-xs">
                        {(tx.details || []).map((d: any) => (
                          <li
                            key={d.id}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="text-[#232323]">
                              <strong className="font-mono font-medium">
                                {d.sku}
                              </strong>{" "}
                              — {d.item_name}
                            </span>
                            <span
                              className={`font-mono font-medium tabular-nums ${
                                Number(d.qty_delta) > 0
                                  ? "text-[#113823]"
                                  : "text-rose-700"
                              }`}
                            >
                              {Number(d.qty_delta) > 0 ? "+" : ""}
                              {formatNumber(d.qty_delta)} {d.unit_name}
                              <span className="text-[#666662] font-normal ml-1.5">
                                (Saldo: {formatNumber(d.balance_after)})
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      {tx.notes && (
                        <p className="text-[11px] text-[#666662] italic mt-1">
                          Catatan: {tx.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#666662]">
                      {tx.user_name}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canAdjustOrVoid &&
                        !tx.is_voided &&
                        tx.type !== "REVERSAL" && (
                          <button
                            onClick={() => setVoidModal({ tx, reason: "" })}
                            className="btn btn--secondary px-2.5 py-1 text-xs text-rose-700 inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Void / Reversal</span>
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Void / Reversal Transaksi (FR-12 & BR-06) */}
      {voidModal && (
        <div className="fixed inset-0 z-50 bg-[#232323]/60 flex items-center justify-center p-4">
          <div className="taste-card bg-white max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-base font-medium text-[#232323] flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-700" />
              <span>
                Void / Reversal Transaksi {voidModal.tx.transaction_number}
              </span>
            </h3>
            <p className="text-xs text-[#666662] leading-relaxed">
              BR-02 &amp; BR-06: Transaksi yang sudah diposting tidak boleh dihapus.
              Sistem akan membuat transaksi <strong className="text-[#232323]">REVERSAL</strong>{" "}
              untuk membalik seluruh baris stok. Wajib isi alasan minimal 10
              karakter.
            </p>
            <textarea
              rows={3}
              placeholder="Jelaskan alasan pembatalan/void transaksi ini (minimal 10 karakter)..."
              value={voidModal.reason}
              onChange={(e) =>
                setVoidModal({ ...voidModal, reason: e.target.value })
              }
              className="w-full px-3 py-2 border border-[#232323]/25 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setVoidModal(null)}
                className="btn btn--secondary px-4 py-2 text-xs"
              >
                Batal
              </button>
              <button
                disabled={submitting || voidModal.reason.trim().length < 10}
                onClick={handleVoidTransaction}
                className="btn btn--primary px-4 py-2 text-xs disabled:opacity-50"
              >
                {submitting ? "Memproses..." : "Konfirmasi Void Transaksi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode & QR Scanner Camera Modal */}
      <BarcodeScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        title="Scan Barcode Barang"
        description="Arahkan kamera ke barcode SKU atau label palet barang percetakan"
        onScan={(decodedSku) => {
          const cleanCode = decodedSku.trim().toUpperCase();
          const found = items.find(
            (i) =>
              String(i.sku).toUpperCase() === cleanCode ||
              cleanCode.includes(String(i.sku).toUpperCase())
          );
          if (found) {
            const usePurch = subTab === "IN" && Number(found.conversion_factor) > 1;
            const factor = usePurch ? Number(found.conversion_factor) : 1;
            setLines((prev) => [
              ...prev,
              {
                item_id: found.id,
                input_quantity: 1,
                use_purchase_unit: usePurch,
                direction: "PLUS",
                unit_cost: Math.round(
                  Number(found.last_purchase_cost || found.avg_cost || 0) * factor
                ),
              },
            ]);
            setFeedback({
              type: "success",
              text: `Barcode terdeteksi: Berhasil menambahkan ${found.sku} (${found.name}) ke baris transaksi.`,
            });
          } else {
            setFeedback({
              type: "error",
              text: `Barcode '${decodedSku}' terbaca tetapi tidak cocok dengan SKU barang aktif manapun di database.`,
            });
          }
        }}
      />
    </div>
  );
}
