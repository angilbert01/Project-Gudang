"use client";

import React, { useEffect, useState } from "react";
import {
  Plus,
  Save,
  CheckCircle2,
  Download,
  Clock,
  Camera,
} from "lucide-react";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import {
  exportToCsvOrExcel,
  formatDateTimeId,
  formatNumber,
} from "@/lib/format";

interface OpnameModuleProps {
  user: {
    userId: number;
    name: string;
    role: "ADMIN" | "KEPALA_GUDANG" | "PETUGAS";
  };
  categories: Array<Record<string, any>>;
  stockCounts: Array<Record<string, any>>;
  onRefresh: () => Promise<void>;
}

export default function OpnameModule({
  user,
  categories,
  stockCounts,
  onRefresh,
}: OpnameModuleProps) {
  const canApproveOrCreate =
    user.role === "ADMIN" || user.role === "KEPALA_GUDANG";

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
    stockCounts[0]?.id || null
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState(
    "Stock Opname Berkala Gudang Percetakan"
  );
  const [newCategoryId, setNewCategoryId] = useState<string>("");
  const [newNotes, setNewNotes] = useState("");

  // Local editable counts for active session
  const [localCounts, setLocalCounts] = useState<
    Record<number, { counted_qty: string; notes: string }>
  >({});
  const [showOpnameScanner, setShowOpnameScanner] = useState(false);
  const [highlightItemId, setHighlightItemId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const activeSession =
    stockCounts.find((s) => Number(s.id) === Number(selectedSessionId)) ||
    stockCounts[0] ||
    null;

  useEffect(() => {
    if (activeSession) {
      const map: Record<number, { counted_qty: string; notes: string }> = {};
      for (const it of activeSession.items || []) {
        map[Number(it.item_id)] = {
          counted_qty:
            it.counted_qty !== null && it.counted_qty !== undefined
              ? String(it.counted_qty)
              : "",
          notes: it.notes || "",
        };
      }
      setLocalCounts(map);
    }
  }, [activeSession]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_session",
          title: newTitle,
          category_id: newCategoryId ? Number(newCategoryId) : null,
          notes: newNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error });
      } else {
        setFeedback({ type: "success", text: data.message });
        setShowCreateModal(false);
        await onRefresh();
        setSelectedSessionId(data.stock_count_id);
      }
    } catch {
      setFeedback({ type: "error", text: "Gagal menghubungi server." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCounts = async () => {
    if (!activeSession || submitting) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      const countsPayload = Object.entries(localCounts).map(([itemId, val]) => ({
        item_id: Number(itemId),
        counted_qty: val.counted_qty === "" ? null : Number(val.counted_qty),
        notes: val.notes,
      }));
      const res = await fetch("/api/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_counts",
          stock_count_id: activeSession.id,
          counts: countsPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error });
      } else {
        setFeedback({ type: "success", text: data.message });
        await onRefresh();
      }
    } catch {
      setFeedback({ type: "error", text: "Gagal menyimpan hitungan fisik." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveSession = async () => {
    if (!activeSession || submitting) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      const countsPayload = Object.entries(localCounts).map(([itemId, val]) => ({
        item_id: Number(itemId),
        counted_qty: val.counted_qty === "" ? null : Number(val.counted_qty),
        notes: val.notes,
      }));
      await fetch("/api/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_counts",
          stock_count_id: activeSession.id,
          counts: countsPayload,
        }),
      });

      const res = await fetch("/api/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_session",
          stock_count_id: activeSession.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error });
      } else {
        setFeedback({ type: "success", text: data.message });
        await onRefresh();
      }
    } catch {
      setFeedback({ type: "error", text: "Gagal menyetujui sesi opname." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Penjelasan Mekanisme Non-Blocking Opname */}
      <div className="taste-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-medium text-[#232323]">
              Stock Opname
            </h2>
            <p className="text-xs text-[#666662] mt-0.5">
              Pencatatan fisik gudang berjalan secara non-blocking tanpa menghentikan aktivitas transaksi.
            </p>
          </div>
          {canApproveOrCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn--primary px-3.5 py-2 text-xs flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Sesi Opname Baru</span>
            </button>
          )}
        </div>

        {/* Rumus Non-Blocking Ringkas */}
        <div className="px-3.5 py-2 rounded-[6px] bg-[#f6f6f4] border border-[#232323]/12 text-xs text-[#232323] flex items-center justify-between">
          <div className="text-[11px] text-[#666662]">
            Formula: <code className="font-mono font-medium text-[#232323]">Selisih = Fisik − (Snapshot + Masuk − Keluar)</code>
          </div>
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

      {/* Pilihan Sesi Opname & Tabel Hitung Fisik */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Daftar Sesi di Samping Kiri */}
        <div className="taste-card p-4 space-y-3">
          <h3 className="text-xs font-medium text-[#666662]">
            Daftar Sesi Stock Opname ({stockCounts.length})
          </h3>
          <div className="space-y-2">
            {stockCounts.map((sc) => {
              const isSelected = activeSession?.id === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => setSelectedSessionId(sc.id)}
                  className={`w-full text-left p-3.5 rounded-[6px] border transition ${
                    isSelected
                      ? "bg-[#232323] text-white border-[#232323]"
                      : "bg-white text-[#232323] border-[#232323]/15 hover:bg-[#f6f6f4]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono font-medium text-xs ${
                        isSelected ? "text-[#a1ffcb]" : "text-[#232323]"
                      }`}
                    >
                      {sc.count_number}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-[4px] font-mono text-[10px] font-medium ${
                        sc.status === "COUNTING"
                          ? "bg-amber-200 text-[#232323]"
                          : sc.status === "APPROVED"
                          ? "bg-[#a1ffcb] text-[#113823]"
                          : "bg-[#efefec] text-[#666662]"
                      }`}
                    >
                      {sc.status === "COUNTING"
                        ? "DIHITUNG"
                        : sc.status === "APPROVED"
                        ? "DISETUJUI"
                        : "BATAL"}
                    </span>
                  </div>
                  <p
                    className={`text-xs font-medium mt-1.5 line-clamp-2 ${
                      isSelected ? "text-white" : "text-[#232323]"
                    }`}
                  >
                    {sc.title}
                  </p>
                  <p
                    className={`text-[11px] font-mono mt-1.5 flex items-center gap-1 ${
                      isSelected ? "text-[#a4a4a4]" : "text-[#666662]"
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{formatDateTimeId(sc.snapshot_at)}</span>
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail Sesi & Input Hitung Fisik */}
        <div className="lg:col-span-3 taste-card overflow-hidden">
          {!activeSession ? (
            <div className="p-8 text-center text-sm text-[#666662]">
              Belum ada sesi Stock Opname.
            </div>
          ) : (
            <div>
              <div className="p-5 border-b border-[#232323]/12 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#efefec]">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-medium text-base text-[#232323]">
                      {activeSession.count_number}
                    </span>
                    <h3 className="font-display text-base font-medium text-[#232323]">
                      {activeSession.title}
                    </h3>
                  </div>
                  <p className="text-xs text-[#666662] mt-1">
                    Snapshot:{" "}
                    <strong className="font-mono text-[#232323]">
                      {activeSession.snapshot_at}
                    </strong>{" "}
                    • Cakupan:{" "}
                    <strong className="text-[#232323]">
                      {activeSession.category_name || "Semua Kategori"}
                    </strong>{" "}
                    • Dibuka oleh: {activeSession.started_by_name}
                  </p>
                  {activeSession.adjustment_transaction_number && (
                    <p className="text-xs font-medium text-[#113823] mt-1">
                      Telah Diposting ke Transaksi Koreksi:{" "}
                      <span className="font-mono font-semibold">
                        {activeSession.adjustment_transaction_number}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const headers = [
                        "SKU",
                        "Nama Barang",
                        "Satuan",
                        "Snapshot Balance",
                        "Mutasi Masuk Setelah Snapshot",
                        "Mutasi Keluar Setelah Snapshot",
                        "Stok Sistem Ekspektasi",
                        "Hasil Hitung Fisik",
                        "Selisih Opname",
                        "Catatan",
                      ];
                      const rows = (activeSession.items || []).map((it: any) => [
                        it.sku,
                        it.item_name,
                        it.unit_name,
                        it.system_qty_snapshot,
                        it.mutasi_masuk_after,
                        it.mutasi_keluar_after,
                        it.expected_system_stock,
                        it.counted_qty !== null
                          ? it.counted_qty
                          : "Belum Dihitung",
                        it.difference !== null ? it.difference : "-",
                        it.notes || "-",
                      ]);
                      exportToCsvOrExcel(
                        `Laporan_Selisih_Opname_${activeSession.count_number}`,
                        headers,
                        rows,
                        "EXCEL"
                      );
                    }}
                    className="btn btn--secondary px-3 py-2 text-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ekspor Selisih (.xls)</span>
                  </button>

                  {activeSession.status === "COUNTING" && (
                    <>
                      <button
                        onClick={() => setShowOpnameScanner(true)}
                        className="btn btn--accent px-3 py-2 text-xs flex items-center gap-1.5"
                        title="Scan Barcode Rak / Barang"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Scan Rak/Item</span>
                      </button>
                      <button
                        disabled={submitting}
                        onClick={handleSaveCounts}
                        className="btn btn--secondary px-3.5 py-2 text-xs flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Simpan</span>
                      </button>
                      {canApproveOrCreate && (
                        <button
                          disabled={submitting}
                          onClick={handleApproveSession}
                          className="btn btn--primary px-3.5 py-2 text-xs flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Setujui Opname</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#f6f6f4] border-b border-[#232323]/12 text-left text-xs font-medium text-[#666662]">
                      <th className="py-3 px-3">SKU &amp; Nama Barang</th>
                      <th className="py-3 px-3 text-right">Snapshot Balance</th>
                      <th className="py-3 px-3 text-right">
                        Mutasi Setelah Snapshot
                      </th>
                      <th className="py-3 px-3 text-right">
                        Stok Sistem Ekspektasi
                      </th>
                      <th className="py-3 px-3 w-36 text-right">
                        Hasil Hitung Fisik
                      </th>
                      <th className="py-3 px-3 text-right">Selisih Opname</th>
                      <th className="py-3 px-3">Catatan / Alasan Selisih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232323]/10">
                    {(activeSession.items || []).map((it: any) => {
                      const local = localCounts[Number(it.item_id)] || {
                        counted_qty: "",
                        notes: "",
                      };
                      const countedNum =
                        local.counted_qty !== ""
                          ? Number(local.counted_qty)
                          : null;
                      const expected = Number(it.expected_system_stock);
                      const liveDiff =
                        countedNum !== null
                          ? Number((countedNum - expected).toFixed(3))
                          : null;

                      const isHighlighted = highlightItemId === Number(it.item_id);

                      return (
                        <tr
                          key={it.id}
                          className={`hover:bg-[#f6f6f4] transition-colors ${
                            isHighlighted ? "bg-[#a1ffcb]/25 ring-2 ring-[#113823]" : ""
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="font-mono font-medium text-[#232323]">
                              {it.sku}
                            </div>
                            <div className="text-xs text-[#666662]">
                              {it.item_name}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums">
                            {formatNumber(it.system_qty_snapshot)} {it.unit_name}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                            <span className="text-[#113823] font-medium">
                              +{formatNumber(it.mutasi_masuk_after)}
                            </span>{" "}
                            /{" "}
                            <span className="text-rose-700 font-medium">
                              -{formatNumber(it.mutasi_keluar_after)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-medium text-[#232323] tabular-nums">
                            {formatNumber(expected)} {it.unit_name}
                          </td>
                          <td className="py-3 px-3">
                            {activeSession.status === "COUNTING" ? (
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="Isi fisik..."
                                value={local.counted_qty}
                                onChange={(e) =>
                                  setLocalCounts((prev) => ({
                                    ...prev,
                                    [Number(it.item_id)]: {
                                      ...local,
                                      counted_qty: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full px-2.5 py-1.5 border border-[#232323]/30 text-right font-mono font-medium bg-white"
                              />
                            ) : (
                              <div className="text-right font-mono font-medium tabular-nums">
                                {formatNumber(it.counted_qty)} {it.unit_name}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-medium tabular-nums">
                            {liveDiff === null ? (
                              <span className="text-[#666662] text-xs">
                                Belum dihitung
                              </span>
                            ) : liveDiff === 0 ? (
                              <span className="text-[#113823]">0 (Sesuai)</span>
                            ) : liveDiff > 0 ? (
                              <span className="text-[#113823]">
                                +{formatNumber(liveDiff)} {it.unit_name}
                              </span>
                            ) : (
                              <span className="text-rose-700">
                                {formatNumber(liveDiff)} {it.unit_name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {activeSession.status === "COUNTING" ? (
                              <input
                                type="text"
                                placeholder="Catatan..."
                                value={local.notes}
                                onChange={(e) =>
                                  setLocalCounts((prev) => ({
                                    ...prev,
                                    [Number(it.item_id)]: {
                                      ...local,
                                      notes: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full px-2.5 py-1 border border-[#232323]/20 text-xs"
                              />
                            ) : (
                              <span className="text-xs text-[#666662]">
                                {it.notes || "-"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Buka Sesi Stock Opname Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#232323]/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSession}
            className="taste-card bg-white max-w-md w-full p-6 space-y-4"
          >
            <h3 className="font-display text-base font-medium text-[#232323]">
              Buka Sesi Non-Blocking Stock Opname Baru
            </h3>
            <p className="text-xs text-[#666662] leading-relaxed">
              Sistem akan merekam <strong className="text-[#232323]">Snapshot Balance</strong>{" "}
              saat ini. Transaksi harian gudang tetap dapat berjalan normal
              selama penghitungan berlangsung.
            </p>
            <div>
              <label className="block text-[13px] font-medium text-[#232323] mb-1">
                Judul Sesi Opname
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 border border-[#232323]/25 text-sm"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#232323] mb-1">
                Cakupan Kategori Barang
              </label>
              <select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-[#232323]/25 text-sm"
              >
                <option value="">
                  -- Seluruh Barang Aktif (Semua Kategori) --
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    Hanya Kategori: {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#232323] mb-1">
                Catatan Sesi
              </label>
              <textarea
                rows={2}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full px-3 py-2 border border-[#232323]/25 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="btn btn--secondary px-4 py-2 text-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn--primary px-4 py-2 text-xs"
              >
                {submitting ? "Membuka Sesi..." : "Rekam Snapshot & Buka Sesi"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Barcode / QR Scanner Modal untuk Stock Opname */}
      <BarcodeScannerModal
        isOpen={showOpnameScanner}
        onClose={() => setShowOpnameScanner(false)}
        title="Scan Barcode / Label Rak Barang"
        description="Pindai barcode pada rak atau pallet untuk langsung menemukan item opname"
        onScan={(decodedText) => {
          const cleanCode = decodedText.trim().toUpperCase();
          const target = (activeSession?.items || []).find(
            (it: any) =>
              String(it.sku).toUpperCase() === cleanCode ||
              cleanCode.includes(String(it.sku).toUpperCase())
          );
          if (target) {
            setHighlightItemId(Number(target.item_id));
            setFeedback({
              type: "success",
              text: `Barcode '${target.sku}' terdeteksi! Baris ${target.item_name} otomatis disorot.`,
            });
            setTimeout(() => setHighlightItemId(null), 4000);
          } else {
            setFeedback({
              type: "error",
              text: `Barcode '${decodedText}' tidak ditemukan dalam daftar barang sesi opname ini.`,
            });
          }
        }}
      />
    </div>
  );
}
