"use client";

import React, { useState } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Printer,
  Send,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  CreditCard,
  Download,
  Search,
  Building2,
  ArrowLeft,
  X,
} from "lucide-react";
import {
  exportToCsvOrExcel,
  formatDateId,
  formatNumber,
  formatRupiah,
  todayYmd,
} from "@/lib/format";

interface PoModuleProps {
  user: {
    userId: number;
    name: string;
    role: "ADMIN" | "KEPALA_GUDANG" | "PETUGAS";
  };
  settings: Record<string, string>;
  purchaseOrders: Array<Record<string, any>>;
  suppliers: Array<Record<string, any>>;
  items: Array<Record<string, any>>;
  initialDraftItems?: Array<{
    item_id: number;
    input_qty: number;
    use_purchase_unit: boolean;
    unit_price: number;
  }> | null;
  onClearDraftItems?: () => void;
  onReceiveFromPo: (po: Record<string, any>) => void;
  onRefresh: () => Promise<void>;
}

export default function PoModule({
  user,
  settings,
  purchaseOrders,
  suppliers,
  items,
  initialDraftItems,
  onClearDraftItems,
  onReceiveFromPo,
  onRefresh,
}: PoModuleProps) {
  const canManage = user.role === "ADMIN" || user.role === "KEPALA_GUDANG";
  const showPrices = user.role === "ADMIN" || user.role === "KEPALA_GUDANG";

  const [subTab, setSubTab] = useState<"LIST" | "FORM" | "RECAP">(
    initialDraftItems && initialDraftItems.length > 0 ? "FORM" : "LIST"
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("ALL");

  // Form PO State (Sesuai Mockup image1.png & FR-08)
  const [editingPoId, setEditingPoId] = useState<number | null>(null);
  const [supplierId, setSupplierId] = useState<number>(
    suppliers.find((s) => s.is_active)?.id || 1
  );
  const [poDate, setPoDate] = useState(todayYmd());
  const [expectedDate, setExpectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [ppnPercent, setPpnPercent] = useState<number>(11);
  const [discountTotal, setDiscountTotal] = useState<number>(0);
  const [otherCost, setOtherCost] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<
    Array<{
      item_id: number;
      description: string;
      input_qty: number;
      use_purchase_unit: boolean;
      unit_price: number;
      discount_amount: number;
    }>
  >(() => {
    if (initialDraftItems && initialDraftItems.length > 0) {
      return initialDraftItems.map((d) => {
        const found = items.find((i) => i.id === d.item_id);
        return {
          item_id: d.item_id,
          description: found ? found.name : "",
          input_qty: d.input_qty,
          use_purchase_unit: d.use_purchase_unit,
          unit_price: d.unit_price,
          discount_amount: 0,
        };
      });
    }
    const firstItem = items.find((i) => i.is_active && !i.is_remnant);
    return firstItem
      ? [
          {
            item_id: firstItem.id,
            description: firstItem.name,
            input_qty: 1,
            use_purchase_unit: Number(firstItem.conversion_factor) > 1,
            unit_price:
              Number(firstItem.last_purchase_cost || firstItem.avg_cost || 0) *
              (Number(firstItem.conversion_factor) > 1
                ? Number(firstItem.conversion_factor)
                : 1),
            discount_amount: 0,
          },
        ]
      : [];
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Modal Detail / Print / Status / Payment
  const [selectedPo, setSelectedPo] = useState<Record<string, any> | null>(null);
  const [printMode, setPrintMode] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    po: Record<string, any>;
    targetStatus: "CANCELLED" | "CLOSED";
    reason: string;
  } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{
    po: Record<string, any>;
    amount: number;
    payment_date: string;
    payment_method: string;
    reference_number: string;
    notes: string;
  } | null>(null);

  const selectedSupplier = suppliers.find((s) => Number(s.id) === Number(supplierId));

  // Kalkulasi Ringkasan Total Form PO
  const calcSubtotal = lines.reduce((acc, l) => {
    const lineSub = Math.max(
      0,
      Number(l.input_qty || 0) * Number(l.unit_price || 0) - Number(l.discount_amount || 0)
    );
    return acc + lineSub;
  }, 0);
  const afterDiscount = Math.max(0, calcSubtotal - Number(discountTotal || 0));
  const calcTax = (afterDiscount * Number(ppnPercent || 0)) / 100;
  const calcGrandTotal = afterDiscount + calcTax + Number(otherCost || 0);

  const handleSelectItemLine = (idx: number, newItemId: number) => {
    const found = items.find((i) => Number(i.id) === newItemId);
    if (!found) return;
    const usePurch = Number(found.conversion_factor) > 1;
    const factor = usePurch ? Number(found.conversion_factor) : 1;
    const defaultPrice = Number(found.last_purchase_cost || found.avg_cost || 0) * factor;
    setLines((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              item_id: newItemId,
              description: found.name,
              use_purchase_unit: usePurch,
              unit_price: Math.round(defaultPrice),
            }
          : row
      )
    );
  };

  const handleSavePo = async (sendImmediately: boolean) => {
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/po", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editingPoId ? "update_po" : "create_po",
          id: editingPoId,
          supplier_id: supplierId,
          po_date: poDate,
          expected_date: expectedDate,
          due_date: dueDate,
          ppn_percent: ppnPercent,
          discount_total: discountTotal,
          other_cost: otherCost,
          notes,
          send_immediately: sendImmediately,
          items: lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Gagal menyimpan PO." });
      } else {
        setFeedback({ type: "success", text: data.message });
        setEditingPoId(null);
        if (onClearDraftItems) onClearDraftItems();
        await onRefresh();
        setSubTab("LIST");
      }
    } catch {
      setFeedback({ type: "error", text: "Gagal menghubungi server." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendPo = async (po: Record<string, any>) => {
    setFeedback(null);
    const res = await fetch("/api/po", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "change_status",
        id: po.id,
        status: "SENT",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFeedback({ type: "error", text: data.error });
    } else {
      setFeedback({ type: "success", text: data.message });
      await onRefresh();
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!statusModal) return;
    const res = await fetch("/api/po", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "change_status",
        id: statusModal.po.id,
        status: statusModal.targetStatus,
        reason: statusModal.reason,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFeedback({ type: "error", text: data.error });
    } else {
      setFeedback({ type: "success", text: data.message });
      setStatusModal(null);
      setSelectedPo(null);
      await onRefresh();
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentModal) return;
    const res = await fetch("/api/po", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record_payment",
        purchase_order_id: paymentModal.po.id,
        amount: paymentModal.amount,
        payment_date: paymentModal.payment_date,
        payment_method: paymentModal.payment_method,
        reference_number: paymentModal.reference_number,
        notes: paymentModal.notes,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFeedback({ type: "error", text: data.error });
    } else {
      setFeedback({ type: "success", text: data.message });
      setPaymentModal(null);
      setSelectedPo(null);
      await onRefresh();
    }
  };

  const filteredPos = purchaseOrders.filter((po) => {
    if (statusFilter !== "ALL") {
      if (statusFilter === "LATE") {
        if (!po.is_late) return false;
      } else if (po.status !== statusFilter) {
        return false;
      }
    }
    if (supplierFilter !== "ALL" && String(po.supplier_id) !== supplierFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNo = String(po.po_number).toLowerCase().includes(q);
      const matchSup = String(po.supplier_name).toLowerCase().includes(q);
      const matchItem = (po.items || []).some(
        (it: any) =>
          String(it.sku).toLowerCase().includes(q) ||
          String(it.item_name).toLowerCase().includes(q)
      );
      if (!matchNo && !matchSup && !matchItem) return false;
    }
    return true;
  });

  const statusBadge = (status: string, isLate?: boolean) => {
    const map: Record<string, { label: string; cls: string }> = {
      DRAFT: {
        label: "Draft",
        cls: "bg-[#efefec] text-[#666662] border-[#232323]/15",
      },
      SENT: {
        label: "Dikirim",
        cls: "bg-white text-[#232323] border-[#232323]/30",
      },
      PARTIALLY_RECEIVED: {
        label: "Diterima Sebagian",
        cls: "bg-amber-50 text-amber-800 border-amber-300",
      },
      FULLY_RECEIVED: {
        label: "Diterima Penuh",
        cls: "bg-[#a1ffcb] text-[#113823] border-[#113823]/20",
      },
      CLOSED: {
        label: "Ditutup Manual",
        cls: "bg-[#232323] text-white border-[#232323]",
      },
      CANCELLED: {
        label: "Dibatalkan",
        cls: "bg-rose-50 text-rose-800 border-rose-200",
      },
    };
    const info = map[status] || {
      label: status,
      cls: "bg-[#efefec] text-[#232323] border-[#232323]/15",
    };
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`px-2 py-0.5 text-[11px] font-mono font-medium rounded-[4px] border ${info.cls}`}
        >
          {info.label}
        </span>
        {isLate && (
          <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-[4px] bg-rose-600 text-white">
            TERLAMBAT
          </span>
        )}
      </div>
    );
  };

  // Mode Cetak Surat Purchase Order (PDF / Print Document - FR-08)
  if (printMode && selectedPo) {
    return (
      <div className="taste-card bg-white p-8 max-w-4xl mx-auto">
        <div className="no-print flex justify-between items-center mb-6 pb-4 border-b border-[#232323]/12">
          <button
            onClick={() => setPrintMode(false)}
            className="btn btn--secondary px-4 py-2 text-xs flex items-center gap-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Detail PO</span>
          </button>
          <button
            onClick={() => window.print()}
            className="btn btn--primary px-5 py-2.5 text-xs flex items-center gap-2"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / Simpan PDF Sekarang</span>
          </button>
        </div>

        {/* Kop Surat Perusahaan */}
        <div className="flex justify-between items-start border-b-2 border-[#232323] pb-4 mb-6">
          <div>
            <h1 className="font-display text-2xl font-medium tracking-tight text-[#232323]">
              {settings.company_name || "PT GRAFIKA NUSANTARA PERCETAKAN"}
            </h1>
            <p className="text-sm text-[#666662] mt-1">
              {settings.company_address || "Jl. Industri Grafika Raya No. 88, Surabaya"}
            </p>
            <p className="text-xs font-mono text-[#666662] mt-0.5">
              Telp/Email:{" "}
              {settings.company_phone || "(031) 8492-7700 | purchasing@percetakan.co.id"}
            </p>
          </div>
          <div className="text-right">
            <div className="inline-block px-4 py-1.5 bg-[#232323] text-white font-mono font-medium text-base tracking-wider rounded-[4px]">
              PURCHASE ORDER
            </div>
            <p className="text-sm font-mono font-medium text-[#232323] mt-2">
              No: {selectedPo.po_number}
            </p>
            <p className="text-xs font-mono text-[#666662]">
              Tanggal: {formatDateId(selectedPo.po_date)}
            </p>
          </div>
        </div>

        {/* Info Supplier & Pengiriman */}
        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div className="p-4 rounded-[6px] border border-[#232323]/25 bg-[#f6f6f4]">
            <p className="text-xs font-medium text-[#666662] mb-1">
              Kepada Yth. Supplier / Vendor:
            </p>
            <p className="font-medium text-base text-[#232323]">{selectedPo.supplier_name}</p>
            <p className="text-[#666662] mt-1">{selectedPo.supplier_address || "-"}</p>
            <p className="text-[#666662] mt-1">
              UP / Kontak:{" "}
              <span className="font-medium text-[#232323]">
                {selectedPo.supplier_contact || "-"}
              </span>{" "}
              ({selectedPo.supplier_phone || "-"})
            </p>
          </div>
          <div className="p-4 rounded-[6px] border border-[#232323]/25 bg-[#f6f6f4]">
            <p className="text-xs font-medium text-[#666662] mb-1">
              Informasi Pengiriman &amp; Termin:
            </p>
            <div className="grid grid-cols-2 gap-y-1.5 text-sm mt-2">
              <span className="text-[#666662]">Estimasi Kirim:</span>
              <span className="font-mono font-medium text-[#232323]">
                {formatDateId(selectedPo.expected_date)}
              </span>
              <span className="text-[#666662]">Termin Pembayaran:</span>
              <span className="font-mono font-medium text-[#232323]">
                {selectedPo.supplier_terms || "NET 30 Hari"}
              </span>
              <span className="text-[#666662]">Status Dokumen:</span>
              <span className="font-mono font-medium text-[#232323]">{selectedPo.status}</span>
            </div>
          </div>
        </div>

        {/* Tabel Barang PO */}
        <table className="w-full border-collapse border border-[#232323]/30 text-sm mb-6">
          <thead>
            <tr className="bg-[#232323] text-white">
              <th className="border border-[#232323]/30 px-3 py-2 text-center w-10">No</th>
              <th className="border border-[#232323]/30 px-3 py-2 text-left">
                Kode SKU &amp; Deskripsi Barang
              </th>
              <th className="border border-[#232323]/30 px-3 py-2 text-right">Kuantitas</th>
              <th className="border border-[#232323]/30 px-3 py-2 text-center">Satuan</th>
              {showPrices && (
                <>
                  <th className="border border-[#232323]/30 px-3 py-2 text-right">
                    Harga Satuan
                  </th>
                  <th className="border border-[#232323]/30 px-3 py-2 text-right">Diskon</th>
                  <th className="border border-[#232323]/30 px-3 py-2 text-right">Subtotal</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {(selectedPo.items || []).map((it: any, idx: number) => (
              <tr key={it.id} className="border-b border-[#232323]/20">
                <td className="border border-[#232323]/20 px-3 py-2 text-center font-mono">
                  {idx + 1}
                </td>
                <td className="border border-[#232323]/20 px-3 py-2">
                  <div className="font-mono font-medium text-[#232323]">{it.sku}</div>
                  <div className="text-[#232323]">{it.description || it.item_name}</div>
                  {Number(it.conversion_factor) > 1 && (
                    <div className="text-xs font-mono text-[#666662]">
                      Setara: {formatNumber(it.qty_ordered)} {it.base_unit_name} (1{" "}
                      {it.input_unit} = {it.conversion_factor} {it.base_unit_name})
                    </div>
                  )}
                </td>
                <td className="border border-[#232323]/20 px-3 py-2 text-right font-mono font-medium">
                  {formatNumber(it.input_qty)}
                </td>
                <td className="border border-[#232323]/20 px-3 py-2 text-center font-mono">
                  {it.input_unit}
                </td>
                {showPrices && (
                  <>
                    <td className="border border-[#232323]/20 px-3 py-2 text-right font-mono">
                      {formatRupiah(it.unit_price)}
                    </td>
                    <td className="border border-[#232323]/20 px-3 py-2 text-right font-mono">
                      {formatRupiah(it.discount_amount)}
                    </td>
                    <td className="border border-[#232323]/20 px-3 py-2 text-right font-mono font-medium">
                      {formatRupiah(it.line_total)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Catatan & Ringkasan Total */}
        <div className="grid grid-cols-2 gap-6 mb-10">
          <div className="text-sm">
            <p className="font-medium text-[#232323] mb-1">
              Catatan / Instruksi Pengiriman:
            </p>
            <div className="p-3 rounded-[4px] border border-[#232323]/25 min-h-[80px] text-[#666662] whitespace-pre-wrap">
              {selectedPo.notes ||
                "Harap cantumkan Nomor PO pada Surat Jalan dan Invoice tagihan."}
            </div>
          </div>
          {showPrices && (
            <div className="border border-[#232323]/30 rounded-[6px] p-4 bg-[#f6f6f4] text-sm space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-[#666662]">Subtotal:</span>
                <span className="font-medium">{formatRupiah(selectedPo.subtotal)}</span>
              </div>
              {Number(selectedPo.discount_total) > 0 && (
                <div className="flex justify-between text-rose-700">
                  <span>Diskon Tambahan:</span>
                  <span>- {formatRupiah(selectedPo.discount_total)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#666662]">PPN ({selectedPo.ppn_percent}%):</span>
                <span className="font-medium">{formatRupiah(selectedPo.tax_amount)}</span>
              </div>
              {Number(selectedPo.other_cost) > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#666662]">Biaya Lain-lain:</span>
                  <span className="font-medium">{formatRupiah(selectedPo.other_cost)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-[#232323]/25 text-base font-semibold text-[#232323]">
                <span>TOTAL PO:</span>
                <span>{formatRupiah(selectedPo.total_amount)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Kolom Tanda Tangan */}
        <div className="grid grid-cols-3 gap-8 text-center text-sm pt-4">
          <div>
            <p className="text-[#666662] mb-16">Dibuat Oleh (Purchasing/Gudang),</p>
            <p className="font-medium text-[#232323] border-t border-[#232323]/40 pt-1 inline-block min-w-[180px]">
              {selectedPo.created_by_name}
            </p>
          </div>
          <div>
            <p className="text-[#666662] mb-16">Disetujui Oleh (Kepala Gudang/Manager),</p>
            <p className="font-medium text-[#232323] border-t border-[#232323]/40 pt-1 inline-block min-w-[180px]">
              Manager Operasional
            </p>
          </div>
          <div>
            <p className="text-[#666662] mb-16">Dikonfirmasi Supplier,</p>
            <p className="font-medium text-[#232323] border-t border-[#232323]/40 pt-1 inline-block min-w-[180px]">
              {selectedPo.supplier_name}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Navigasi Sub-Tab PO */}
      <div className="taste-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium text-[#232323]">
            Purchase Order
          </h2>
          <p className="text-xs text-[#666662] mt-0.5">
            Pengadaan barang, penerimaan parsial, dan kontrol hutang supplier.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSubTab("LIST")}
            className={`btn px-3.5 py-2 text-xs ${
              subTab === "LIST" ? "btn--primary" : "btn--secondary"
            }`}
          >
            Daftar PO ({purchaseOrders.length})
          </button>
          {canManage && (
            <>
              <button
                onClick={() => {
                  setEditingPoId(null);
                  setSubTab("FORM");
                }}
                className={`btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
                  subTab === "FORM" ? "btn--accent" : "btn--secondary"
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>PO Baru</span>
              </button>
              <button
                onClick={() => setSubTab("RECAP")}
                className={`btn px-3.5 py-2 text-xs ${
                  subTab === "RECAP" ? "btn--primary" : "btn--secondary"
                }`}
              >
                Rekap Hutang
              </button>
            </>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-[6px] border flex items-center justify-between text-xs ${
            feedback.type === "success"
              ? "bg-white border-[#232323] text-[#232323]"
              : "bg-rose-50 border-rose-300 text-rose-900"
          }`}
        >
          <span className="font-medium">{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="font-medium underline ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {/* =====================================================================
          TAB 1: FORM BUAT PURCHASE ORDER BARU (Sesuai Gambar Mockup image1.png)
          ===================================================================== */}
      {subTab === "FORM" && canManage && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSubTab("LIST")}
              className="btn btn--secondary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Daftar</span>
            </button>
            <span className="font-mono text-xs text-[#666662]">
              {editingPoId
                ? `Mode Edit PO #${editingPoId}`
                : "Format Nomor: PO/YYYY/MM/NNNN (BR-12)"}
            </span>
          </div>

          {/* 2 Kartu Atas: Info Purchase Order & Info Vendor/Supplier */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Kartu Kiri: Info Purchase Order */}
            <div className="taste-card p-6 space-y-4">
              <h3 className="text-sm font-medium text-[#232323] flex items-center gap-2 border-b border-[#232323]/12 pb-3">
                <FileText className="w-4 h-4 text-[#232323]" />
                <span>Info Purchase Order</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Nomor PO
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingPoId ? "PO Existing" : "Otomatis (PO/YYYY/MM/NNNN)"}
                    className="w-full px-3 py-2 border border-[#232323]/15 bg-[#efefec] text-[#666662] text-xs font-mono"
                  />
                  <p className="text-[11px] text-[#666662] mt-1">
                    Digenerate otomatis secara sekuensial saat disimpan.
                  </p>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Tanggal PO <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Estimasi Tanggal Terima
                  </label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-mono"
                  />
                  <p className="text-[11px] text-[#666662] mt-1">
                    Dasar indikator PO terlambat (FR-10).
                  </p>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Jatuh Tempo Pembayaran (Hutang)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Kartu Kanan: Info Vendor / Supplier */}
            <div className="taste-card p-6 space-y-4">
              <h3 className="text-sm font-medium text-[#232323] flex items-center gap-2 border-b border-[#232323]/12 pb-3">
                <Building2 className="w-4 h-4 text-[#232323]" />
                <span>Info Vendor / Supplier</span>
              </h3>
              <div>
                <label className="block text-[13px] font-medium text-[#232323] mb-1">
                  Nama Vendor / Supplier <span className="text-rose-600">*</span>
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(Number(e.target.value))}
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
                <p className="text-[11px] text-[#666662] mt-1">
                  Pilih dari daftar master supplier aktif; alamat dan termin terisi otomatis.
                </p>
              </div>

              {selectedSupplier && (
                <div className="p-4 rounded-[6px] bg-[#f6f6f4] border border-[#232323]/15 text-xs space-y-1.5">
                  <div className="font-medium text-[#232323]">
                    {selectedSupplier.name}{" "}
                    <span className="font-mono text-[#666662]">
                      ({selectedSupplier.code})
                    </span>
                  </div>
                  <div className="text-[#666662]">
                    Alamat: <span className="text-[#232323]">{selectedSupplier.address || "-"}</span>
                  </div>
                  <div className="text-[#666662]">
                    Kontak PIC:{" "}
                    <span className="text-[#232323]">
                      {selectedSupplier.contact_name || "-"} ({selectedSupplier.phone || "-"})
                    </span>
                  </div>
                  <div className="text-[#666662]">
                    Termin Pembayaran:{" "}
                    <span className="font-mono font-medium text-[#232323]">
                      {selectedSupplier.payment_terms || "NET 30 Hari"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Kartu Tengah: Item yang Dipesan */}
          <div className="taste-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#232323]/12 pb-3">
              <h3 className="text-sm font-medium text-[#232323]">Item yang Dipesan</h3>
              <button
                type="button"
                onClick={() => {
                  const avail = items.find(
                    (i) => i.is_active && !lines.some((l) => l.item_id === i.id)
                  );
                  if (!avail) return;
                  const usePurch = Number(avail.conversion_factor) > 1;
                  const factor = usePurch ? Number(avail.conversion_factor) : 1;
                  setLines((prev) => [
                    ...prev,
                    {
                      item_id: avail.id,
                      description: avail.name,
                      input_qty: 1,
                      use_purchase_unit: usePurch,
                      unit_price: Math.round(
                        Number(avail.last_purchase_cost || avail.avg_cost || 0) * factor
                      ),
                      discount_amount: 0,
                    },
                  ]);
                }}
                className="btn btn--secondary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris Item</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#232323]/15 text-left text-xs font-medium text-[#666662]">
                    <th className="py-2.5 px-2 w-8">#</th>
                    <th className="py-2.5 px-2 min-w-[260px]">
                      Produk Persediaan / Deskripsi
                    </th>
                    <th className="py-2.5 px-2 w-28 text-right">Kuantitas</th>
                    <th className="py-2.5 px-2 w-40">Satuan Order</th>
                    <th className="py-2.5 px-2 w-40 text-right">Harga Satuan (Rp)</th>
                    <th className="py-2.5 px-2 w-36 text-right">Diskon Baris (Rp)</th>
                    <th className="py-2.5 px-2 text-right w-40">Subtotal</th>
                    <th className="py-2.5 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232323]/10">
                  {lines.map((line, idx) => {
                    const itemObj = items.find((i) => Number(i.id) === Number(line.item_id));
                    const hasConversion = itemObj && Number(itemObj.conversion_factor) > 1;
                    const factor =
                      hasConversion && line.use_purchase_unit
                        ? Number(itemObj.conversion_factor)
                        : 1;
                    const baseQty = Number(line.input_qty || 0) * factor;
                    const lineSubtotal = Math.max(
                      0,
                      Number(line.input_qty || 0) * Number(line.unit_price || 0) -
                        Number(line.discount_amount || 0)
                    );

                    return (
                      <tr key={idx} className="align-top">
                        <td className="py-3 px-2 font-mono text-xs text-[#666662]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-2 space-y-1.5">
                          <select
                            value={line.item_id}
                            onChange={(e) => handleSelectItemLine(idx, Number(e.target.value))}
                            className="w-full px-3 py-1.5 border border-[#232323]/25 text-sm font-medium"
                          >
                            {items
                              .filter((i) => i.is_active)
                              .map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.sku} — {i.name} (Stok: {formatNumber(i.current_stock)}{" "}
                                  {i.unit_name})
                                </option>
                              ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Deskripsi / spesifikasi barang pada surat PO..."
                            value={line.description}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, description: e.target.value } : r
                                )
                              )
                            }
                            className="w-full px-3 py-1 border border-[#232323]/15 text-xs text-[#666662]"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={line.input_qty}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, input_qty: Number(e.target.value) } : r
                                )
                              )
                            }
                            className="w-full px-3 py-1.5 border border-[#232323]/25 text-sm text-right font-mono font-medium"
                          />
                          {hasConversion && line.use_purchase_unit && (
                            <div className="text-[11px] font-mono text-[#666662] mt-1 text-right">
                              = {formatNumber(baseQty)} {itemObj.unit_name}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {hasConversion ? (
                            <select
                              value={line.use_purchase_unit ? "PURCHASE" : "BASE"}
                              onChange={(e) => {
                                const useP = e.target.value === "PURCHASE";
                                setLines((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, use_purchase_unit: useP } : r
                                  )
                                );
                              }}
                              className="w-full px-2.5 py-1.5 border border-[#232323]/25 text-xs font-mono"
                            >
                              <option value="PURCHASE">
                                {itemObj.purchase_unit_name} (1={itemObj.conversion_factor}{" "}
                                {itemObj.unit_name})
                              </option>
                              <option value="BASE">{itemObj.unit_name} (Dasar)</option>
                            </select>
                          ) : (
                            <div className="px-3 py-1.5 rounded-[4px] bg-[#efefec] text-[#232323] text-xs font-mono text-center">
                              {itemObj?.unit_name || "Unit"}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={line.unit_price}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, unit_price: Number(e.target.value) } : r
                                )
                              )
                            }
                            className="w-full px-3 py-1.5 border border-[#232323]/25 text-sm text-right font-mono"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={line.discount_amount}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? { ...r, discount_amount: Number(e.target.value) }
                                    : r
                                )
                              )
                            }
                            className="w-full px-3 py-1.5 border border-[#232323]/25 text-sm text-right font-mono"
                          />
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-medium text-[#232323] tabular-nums">
                          {formatRupiah(lineSubtotal)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setLines((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-[4px]"
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

          {/* 2 Kartu Bawah: Catatan & Ringkasan Total */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="taste-card p-6">
              <h3 className="text-sm font-medium text-[#232323] mb-3">
                Catatan Purchase Order
              </h3>
              <textarea
                rows={4}
                placeholder="Catatan pengiriman, spesifikasi kemasan kertas/tinta, syarat pembayaran, dll..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#232323]/25 text-sm"
              />
            </div>

            <div className="taste-card p-6 space-y-3">
              <h3 className="text-sm font-medium text-[#232323] border-b border-[#232323]/12 pb-2">
                Ringkasan Nilai PO
              </h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#666662]">Subtotal</span>
                <span className="font-mono font-medium text-[#232323] tabular-nums">
                  {formatRupiah(calcSubtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#666662]">Diskon Tambahan (Rp)</span>
                <input
                  type="number"
                  min="0"
                  value={discountTotal}
                  onChange={(e) => setDiscountTotal(Number(e.target.value))}
                  className="w-36 px-3 py-1 border border-[#232323]/25 text-right text-sm font-mono"
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#666662]">Pajak PPN (%)</span>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={ppnPercent}
                    onChange={(e) => setPpnPercent(Number(e.target.value))}
                    className="w-20 px-2.5 py-1 border border-[#232323]/25 text-right text-sm font-mono"
                  />
                  <span className="font-mono text-[#232323] min-w-[110px] text-right tabular-nums">
                    {formatRupiah(calcTax)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#666662]">Biaya Lain / Ongkir (Rp)</span>
                <input
                  type="number"
                  min="0"
                  value={otherCost}
                  onChange={(e) => setOtherCost(Number(e.target.value))}
                  className="w-36 px-3 py-1 border border-[#232323]/25 text-right text-sm font-mono"
                />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#232323]/15 text-lg font-mono font-semibold text-[#232323]">
                <span>TOTAL PO</span>
                <span className="tabular-nums">{formatRupiah(calcGrandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Tombol Aksi Simpan PO */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSavePo(true)}
              className="btn btn--primary px-6 py-3 text-xs flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {submitting ? "Memproses..." : "Buat & Tandai Dikirim ke Supplier"}
              </span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSavePo(false)}
              className="btn btn--secondary px-6 py-3 text-xs disabled:opacity-50"
            >
              {submitting ? "Menyimpan..." : "Simpan sebagai Draft PO"}
            </button>
            <button
              type="button"
              onClick={() => setSubTab("LIST")}
              className="btn btn--secondary px-5 py-3 text-xs"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: DAFTAR PURCHASE ORDER & DETAIL PENERIMAAN (FR-08 & FR-09)
          ===================================================================== */}
      {subTab === "LIST" && (
        <div className="taste-card overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-[#232323]/12 flex flex-col sm:flex-row gap-3 items-center justify-between bg-[#efefec]">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[#666662] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari No. PO, Supplier, atau SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-[#232323]/25 text-xs bg-white"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-[#232323]/25 text-xs font-medium bg-white"
              >
                <option value="ALL">Semua Status PO</option>
                <option value="DRAFT">Draft</option>
                <option value="SENT">Dikirim (Menunggu Barang)</option>
                <option value="PARTIALLY_RECEIVED">Diterima Sebagian</option>
                <option value="FULLY_RECEIVED">Diterima Penuh</option>
                <option value="LATE">PO Terlambat</option>
                <option value="CLOSED">Ditutup Manual</option>
                <option value="CANCELLED">Dibatalkan</option>
              </select>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="px-3 py-1.5 border border-[#232323]/25 text-xs font-medium bg-white"
              >
                <option value="ALL">Semua Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabel Daftar PO */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f6f6f4] border-b border-[#232323]/12 text-left text-xs font-medium text-[#666662]">
                  <th className="py-3 px-4">Nomor PO</th>
                  <th className="py-3 px-4">Tanggal PO</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Target Kirim</th>
                  <th className="py-3 px-4">Status PO</th>
                  <th className="py-3 px-4">% Terpenuhi</th>
                  {showPrices && (
                    <>
                      <th className="py-3 px-4 text-right">Total Nilai PO</th>
                      <th className="py-3 px-4 text-center">Status Hutang</th>
                    </>
                  )}
                  <th className="py-3 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232323]/10">
                {filteredPos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-sm text-[#666662]">
                      Tidak ada dokumen Purchase Order yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredPos.map((po) => (
                    <tr key={po.id} className="hover:bg-[#f6f6f4]">
                      <td className="py-3 px-4 font-mono font-medium text-[#232323]">
                        {po.po_number}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#666662]">
                        {formatDateId(po.po_date)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#232323]">{po.supplier_name}</div>
                        <div className="text-xs text-[#666662]">
                          {(po.items || []).length} jenis barang
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#666662]">
                        {formatDateId(po.expected_date)}
                      </td>
                      <td className="py-3 px-4">{statusBadge(po.status, po.is_late)}</td>
                      <td className="py-3 px-4">
                        <div className="w-28">
                          <div className="flex justify-between font-mono text-xs mb-1">
                            <span>{po.fulfilled_percent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#efefec] rounded-[2px] overflow-hidden border border-[#232323]/10">
                            <div
                              className={`h-full ${
                                po.fulfilled_percent === 100
                                  ? "bg-[#232323]"
                                  : po.fulfilled_percent > 0
                                  ? "bg-amber-600"
                                  : "bg-transparent"
                              }`}
                              style={{ width: `${po.fulfilled_percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      {showPrices && (
                        <>
                          <td className="py-3 px-4 text-right font-mono font-medium text-[#232323] tabular-nums">
                            {formatRupiah(po.total_amount)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 text-[11px] font-mono font-medium rounded-[4px] border ${
                                po.payment_status === "PAID"
                                  ? "bg-[#a1ffcb] text-[#113823] border-[#113823]/20"
                                  : po.payment_status === "PARTIAL"
                                  ? "bg-amber-50 text-amber-800 border-amber-300"
                                  : "bg-rose-50 text-rose-800 border-rose-200"
                              }`}
                            >
                              {po.payment_status === "PAID"
                                ? "LUNAS"
                                : po.payment_status === "PARTIAL"
                                ? "CICILAN"
                                : "BELUM BAYAR"}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {["SENT", "PARTIALLY_RECEIVED"].includes(po.status) && (
                            <button
                              onClick={() => onReceiveFromPo(po)}
                              className="btn btn--primary px-2.5 py-1 text-xs flex items-center gap-1"
                              title="Terima Barang Masuk dari PO ini (FR-09)"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Terima Barang</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedPo(po);
                              setPrintMode(false);
                            }}
                            className="btn btn--secondary px-2.5 py-1 text-xs"
                          >
                            Detail &amp; Surat PO
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: REKAPITULASI PO & HUTANG SUPPLIER (FR-10)
          ===================================================================== */}
      {subTab === "RECAP" && showPrices && (
        <div className="space-y-6">
          {/* Ringkasan Kartu Status PO */}
          <div className="taste-card overflow-hidden grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#232323]/12">
            <div className="p-5">
              <p className="text-[13px] font-medium text-[#666662]">Total Dokumen PO</p>
              <p className="font-display text-2xl font-medium text-[#232323] mt-1 font-mono tabular-nums">
                {purchaseOrders.length} PO
              </p>
            </div>
            <div className="p-5">
              <p className="text-[13px] font-medium text-[#666662]">Total Nilai PO Aktif</p>
              <p className="font-mono text-lg font-medium text-[#232323] mt-1.5 tabular-nums">
                {formatRupiah(
                  purchaseOrders
                    .filter((p) => p.status !== "CANCELLED")
                    .reduce((a, b) => a + Number(b.total_amount || 0), 0)
                )}
              </p>
            </div>
            <div className="p-5">
              <p className="text-[13px] font-medium text-[#666662]">
                Total Sisa Hutang Supplier
              </p>
              <p className="font-mono text-lg font-medium text-rose-700 mt-1.5 tabular-nums">
                {formatRupiah(
                  purchaseOrders
                    .filter((p) => p.status !== "CANCELLED")
                    .reduce(
                      (a, b) =>
                        a +
                        Math.max(
                          0,
                          Number(b.total_amount || 0) - Number(b.paid_amount || 0)
                        ),
                      0
                    )
                )}
              </p>
            </div>
            <div className="p-5">
              <p className="text-[13px] font-medium text-[#666662]">PO Terlambat Kirim</p>
              <p className="font-display text-2xl font-medium text-amber-700 mt-1 font-mono tabular-nums">
                {purchaseOrders.filter((p) => p.is_late).length} PO
              </p>
            </div>
          </div>

          {/* Rekap Per Supplier */}
          <div className="taste-card overflow-hidden">
            <div className="p-4 border-b border-[#232323]/12 bg-[#efefec] flex items-center justify-between">
              <h3 className="text-sm font-medium text-[#232323]">
                Rekapitulasi Purchase Order &amp; Hutang per Supplier (FR-10)
              </h3>
              <button
                onClick={() => {
                  const headers = [
                    "Kode Supplier",
                    "Nama Supplier",
                    "Jumlah PO",
                    "Total Nilai PO (Rp)",
                    "Total Terbayar (Rp)",
                    "Sisa Hutang (Rp)",
                    "Rata-rata Terpenuhi (%)",
                  ];
                  const supRows = suppliers.map((s) => {
                    const sPos = purchaseOrders.filter(
                      (p) => p.supplier_id === s.id && p.status !== "CANCELLED"
                    );
                    const totVal = sPos.reduce((a, b) => a + Number(b.total_amount || 0), 0);
                    const totPaid = sPos.reduce((a, b) => a + Number(b.paid_amount || 0), 0);
                    const avgFul =
                      sPos.length > 0
                        ? Math.round(
                            sPos.reduce((a, b) => a + Number(b.fulfilled_percent || 0), 0) /
                              sPos.length
                          )
                        : 0;
                    return [
                      s.code,
                      s.name,
                      sPos.length,
                      totVal,
                      totPaid,
                      Math.max(0, totVal - totPaid),
                      `${avgFul}%`,
                    ];
                  });
                  exportToCsvOrExcel(
                    "Rekap_PO_dan_Hutang_Supplier",
                    headers,
                    supRows,
                    "EXCEL"
                  );
                }}
                className="btn btn--secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Excel (.xls)</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f6f6f4] border-b border-[#232323]/12 text-left text-xs font-medium text-[#666662]">
                    <th className="py-3 px-4">Kode</th>
                    <th className="py-3 px-4">Nama Supplier</th>
                    <th className="py-3 px-4 text-center">Jumlah PO</th>
                    <th className="py-3 px-4 text-right">Total Nilai PO</th>
                    <th className="py-3 px-4 text-right">Sudah Dibayar</th>
                    <th className="py-3 px-4 text-right">Sisa Hutang</th>
                    <th className="py-3 px-4 text-center">% Rata-rata Terpenuhi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232323]/10">
                  {suppliers.map((s) => {
                    const sPos = purchaseOrders.filter(
                      (p) => p.supplier_id === s.id && p.status !== "CANCELLED"
                    );
                    const totVal = sPos.reduce((a, b) => a + Number(b.total_amount || 0), 0);
                    const totPaid = sPos.reduce((a, b) => a + Number(b.paid_amount || 0), 0);
                    const debt = Math.max(0, totVal - totPaid);
                    const avgFul =
                      sPos.length > 0
                        ? Math.round(
                            sPos.reduce((a, b) => a + Number(b.fulfilled_percent || 0), 0) /
                              sPos.length
                          )
                        : 0;

                    return (
                      <tr key={s.id} className="hover:bg-[#f6f6f4]">
                        <td className="py-3 px-4 font-mono text-xs font-medium">{s.code}</td>
                        <td className="py-3 px-4 font-medium text-[#232323]">{s.name}</td>
                        <td className="py-3 px-4 text-center font-mono">{sPos.length}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {formatRupiah(totVal)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#113823] tabular-nums">
                          {formatRupiah(totPaid)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-rose-700 tabular-nums">
                          {formatRupiah(debt)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">{avgFul}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL DETAIL PO, RIWAYAT PENERIMAAN & PEMBAYARAN HUTANG (FR-09)
          ===================================================================== */}
      {selectedPo && !printMode && (
        <div className="fixed inset-0 z-50 bg-[#232323]/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="taste-card bg-white max-w-4xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#232323]/12 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-mono text-lg font-medium text-[#232323]">
                    {selectedPo.po_number}
                  </h3>
                  {statusBadge(selectedPo.status, selectedPo.is_late)}
                </div>
                <p className="text-xs text-[#666662] mt-1">
                  Supplier:{" "}
                  <span className="font-medium text-[#232323]">
                    {selectedPo.supplier_name}
                  </span>{" "}
                  • Tanggal PO: {formatDateId(selectedPo.po_date)} • Estimasi Terima:{" "}
                  {formatDateId(selectedPo.expected_date)}
                </p>
              </div>
              <button
                onClick={() => setSelectedPo(null)}
                className="btn btn--secondary px-2.5 py-1 text-xs flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tutup</span>
              </button>
            </div>

            {/* Tabel Baris Barang & Selisih Penerimaan (FR-09) */}
            <div>
              <h4 className="text-xs font-medium text-[#666662] mb-2">
                Rincian Barang Dipesan vs Diterima (FR-09)
              </h4>
              <div className="overflow-x-auto border border-[#232323]/15 rounded-[6px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#efefec] border-b border-[#232323]/12 text-left text-xs font-medium text-[#666662]">
                      <th className="py-2.5 px-3">SKU &amp; Nama Barang</th>
                      <th className="py-2.5 px-3 text-right">Qty PO (Beli)</th>
                      <th className="py-2.5 px-3 text-right">Dipesan (Dasar)</th>
                      <th className="py-2.5 px-3 text-right">Diterima (Dasar)</th>
                      <th className="py-2.5 px-3 text-right">Sisa Belum Datang</th>
                      {showPrices && <th className="py-2.5 px-3 text-right">Subtotal</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232323]/10">
                    {(selectedPo.items || []).map((it: any) => (
                      <tr key={it.id}>
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-medium text-[#232323]">
                            {it.sku}
                          </div>
                          <div className="text-xs text-[#666662]">{it.item_name}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatNumber(it.input_qty)} {it.input_unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatNumber(it.qty_ordered)} {it.base_unit_name}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-[#113823]">
                          {formatNumber(it.qty_received)} {it.base_unit_name}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-amber-800">
                          {formatNumber(it.remaining_base_qty)} {it.base_unit_name}
                        </td>
                        {showPrices && (
                          <td className="py-2.5 px-3 text-right font-mono font-medium">
                            {formatRupiah(it.line_total)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Riwayat Penerimaan Barang (Transaksi IN terkait PO ini) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-[6px] bg-[#f6f6f4] border border-[#232323]/15">
                <h4 className="text-xs font-medium text-[#666662] mb-2">
                  Riwayat Penerimaan Barang (Transaksi IN)
                </h4>
                {(selectedPo.receipts || []).length === 0 ? (
                  <p className="text-xs text-[#666662]">
                    Belum ada penerimaan barang untuk PO ini.
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {(selectedPo.receipts || []).map((r: any) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between p-2.5 rounded-[4px] bg-white border border-[#232323]/12"
                      >
                        <div>
                          <span className="font-mono font-medium text-[#232323]">
                            {r.transaction_number}
                          </span>{" "}
                          — Nota: <span className="font-medium">{r.reference_number}</span>
                          <div className="text-[11px] text-[#666662]">
                            {formatDateId(r.transaction_date)} oleh {r.user_name}
                          </div>
                        </div>
                        {r.reversed_by_number ? (
                          <span className="px-2 py-0.5 rounded-[4px] bg-rose-100 text-rose-800 font-mono text-[11px]">
                            VOID ({r.reversed_by_number})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-[4px] bg-[#a1ffcb] text-[#113823] font-mono text-[11px]">
                            SAH
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {showPrices && (
                <div className="p-4 rounded-[6px] bg-[#f6f6f4] border border-[#232323]/15">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-[#666662]">
                      Status Hutang &amp; Pembayaran PO
                    </h4>
                    <span className="text-xs font-mono font-medium text-[#232323]">
                      {formatRupiah(selectedPo.paid_amount)} /{" "}
                      {formatRupiah(selectedPo.total_amount)}
                    </span>
                  </div>
                  {(selectedPo.payments || []).length === 0 ? (
                    <p className="text-xs text-[#666662]">Belum ada pembayaran tercatat.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {(selectedPo.payments || []).map((p: any) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between p-2.5 rounded-[4px] bg-white border border-[#232323]/12"
                        >
                          <div>
                            <span className="font-mono font-medium text-[#113823]">
                              {formatRupiah(p.amount)}
                            </span>{" "}
                            ({p.payment_method})
                            <div className="text-[11px] text-[#666662]">
                              {formatDateId(p.payment_date)} — Ref:{" "}
                              {p.reference_number || "-"}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Tombol Aksi di Detail PO */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-[#232323]/12">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setPrintMode(true)}
                  className="btn btn--primary px-4 py-2 text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Unduh Surat PO (PDF)</span>
                </button>

                {["SENT", "PARTIALLY_RECEIVED"].includes(selectedPo.status) && (
                  <button
                    onClick={() => {
                      const poToRec = selectedPo;
                      setSelectedPo(null);
                      onReceiveFromPo(poToRec);
                    }}
                    className="btn btn--accent px-4 py-2 text-xs flex items-center gap-1.5"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Terima Barang dari PO Ini</span>
                  </button>
                )}

                {canManage && selectedPo.status === "DRAFT" && (
                  <button
                    onClick={async () => {
                      await handleSendPo(selectedPo);
                      setSelectedPo(null);
                    }}
                    className="btn btn--secondary px-4 py-2 text-xs flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Tandai Dikirim ke Supplier</span>
                  </button>
                )}

                {canManage &&
                  selectedPo.status !== "CANCELLED" &&
                  selectedPo.payment_status !== "PAID" && (
                    <button
                      onClick={() =>
                        setPaymentModal({
                          po: selectedPo,
                          amount: Math.max(
                            0,
                            Number(selectedPo.total_amount) - Number(selectedPo.paid_amount)
                          ),
                          payment_date: todayYmd(),
                          payment_method: "TRANSFER BANK",
                          reference_number: "",
                          notes: "",
                        })
                      }
                      className="btn btn--secondary px-4 py-2 text-xs flex items-center gap-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Catat Pembayaran Hutang</span>
                    </button>
                  )}
              </div>

              {canManage && (
                <div className="flex items-center gap-2">
                  {["DRAFT", "SENT"].includes(selectedPo.status) &&
                    selectedPo.fulfilled_percent === 0 && (
                      <button
                        onClick={() =>
                          setStatusModal({
                            po: selectedPo,
                            targetStatus: "CANCELLED",
                            reason: "",
                          })
                        }
                        className="btn btn--secondary px-3.5 py-2 text-xs text-rose-700 flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Batalkan PO</span>
                      </button>
                    )}
                  {selectedPo.status === "PARTIALLY_RECEIVED" && (
                    <button
                      onClick={() =>
                        setStatusModal({
                          po: selectedPo,
                          targetStatus: "CLOSED",
                          reason: "",
                        })
                      }
                      className="btn btn--secondary px-3.5 py-2 text-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Tutup Manual Sisa PO</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Alasan Pembatalan / Tutup Manual PO */}
      {statusModal && (
        <div className="fixed inset-0 z-50 bg-[#232323]/60 flex items-center justify-center p-4">
          <div className="taste-card bg-white max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-base font-medium text-[#232323]">
              {statusModal.targetStatus === "CANCELLED"
                ? `Batalkan Purchase Order ${statusModal.po.po_number}`
                : `Tutup Manual Sisa PO ${statusModal.po.po_number}`}
            </h3>
            <p className="text-xs text-[#666662]">
              FR-08: Wajib mencantumkan alasan tertulis untuk jejak audit.
            </p>
            <textarea
              rows={3}
              placeholder="Masukkan alasan pembatalan / penutupan manual..."
              value={statusModal.reason}
              onChange={(e) =>
                setStatusModal({ ...statusModal, reason: e.target.value })
              }
              className="w-full px-3 py-2 border border-[#232323]/25 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setStatusModal(null)}
                className="btn btn--secondary px-4 py-2 text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmStatusChange}
                className="btn btn--primary px-4 py-2 text-xs"
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Catat Pembayaran Hutang PO */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 bg-[#232323]/60 flex items-center justify-center p-4">
          <div className="taste-card bg-white max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-base font-medium text-[#232323]">
              Catat Pembayaran Hutang — {paymentModal.po.po_number}
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-[13px] font-medium text-[#232323] mb-1">
                  Nominal Pembayaran (Rp)
                </label>
                <input
                  type="number"
                  value={paymentModal.amount}
                  onChange={(e) =>
                    setPaymentModal({ ...paymentModal, amount: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-[#232323]/25 font-mono font-medium"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#232323] mb-1">
                  Tanggal Bayar
                </label>
                <input
                  type="date"
                  value={paymentModal.payment_date}
                  onChange={(e) =>
                    setPaymentModal({ ...paymentModal, payment_date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#232323]/25 font-mono"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#232323] mb-1">
                  Metode &amp; No. Referensi Bukti Transfer
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Transfer BCA #TRF-20261105"
                  value={paymentModal.reference_number}
                  onChange={(e) =>
                    setPaymentModal({ ...paymentModal, reference_number: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#232323]/25"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPaymentModal(null)}
                className="btn btn--secondary px-4 py-2 text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleRecordPayment}
                className="btn btn--primary px-4 py-2 text-xs"
              >
                Simpan Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
