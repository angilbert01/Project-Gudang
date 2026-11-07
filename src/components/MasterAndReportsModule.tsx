"use client";

import React, { useEffect, useState } from "react";
import {
  Layers,
  Upload,
  BookOpen,
  CalendarRange,
  Briefcase,
  TrendingUp,
  Plus,
  Edit3,
  Power,
  Lock,
  Download,
  Printer,
  Search,
  X,
  ArrowUpRight,
} from "lucide-react";
import {
  exportToCsvOrExcel,
  formatDateId,
  formatNumber,
  formatRupiah,
} from "@/lib/format";

interface MasterAndReportsProps {
  mode: "MASTERS" | "REPORTS";
  user: {
    userId: number;
    name: string;
    role: "ADMIN" | "KEPALA_GUDANG" | "PETUGAS";
  };
  items: Array<Record<string, any>>;
  categories: Array<Record<string, any>>;
  units: Array<Record<string, any>>;
  suppliers: Array<Record<string, any>>;
  initialSelectedKartuStokItemId?: number | null;
  onRefresh: () => Promise<void>;
}

export default function MasterAndReportsModule({
  mode,
  user,
  items,
  categories,
  units,
  suppliers,
  initialSelectedKartuStokItemId,
  onRefresh,
}: MasterAndReportsProps) {
  const canManage = user.role === "ADMIN" || user.role === "KEPALA_GUDANG";
  const showPrices = user.role === "ADMIN" || user.role === "KEPALA_GUDANG";
  const isAdmin = user.role === "ADMIN";

  // ===========================================================================
  // STATE UNTUK MODE MASTERS
  // ===========================================================================
  const [masterTab, setMasterTab] = useState<
    "ITEMS" | "SUPPLIERS" | "CATEGORIES_UNITS" | "CSV_IMPORT"
  >("ITEMS");
  const [itemSearch, setItemSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Item Modal
  const [itemModal, setItemModal] = useState<Record<string, any> | null>(null);
  const [supplierModal, setSupplierModal] = useState<Record<string, any> | null>(
    null
  );
  const [newCatName, setNewCatName] = useState("");
  const [newCatPrefix, setNewCatPrefix] = useState("ITM");
  const [newUnitName, setNewUnitName] = useState("");

  // CSV Import State (FR-11)
  const [csvText, setCsvText] = useState(
    `SKU,Nama,Kategori,Satuan,SatuanBeli,Konversi,StokMin,Desimal\nKRT-DUP310-79X109,Kertas Duplex 310 gsm Plano (79x109 cm),Kertas,Lembar,Rim,500,1500,false\nTNT-PANTONE-GOLD,Tinta Offset Metallic Gold 871C (1 Kg/Kaleng),Tinta,Kg,Kaleng,1,5,true`
  );
  const [csvResult, setCsvResult] = useState<{
    insertedCount: number;
    errorCount: number;
    insertedSkus: string[];
    errors: Array<{ row: number; sku: string; error: string }>;
  } | null>(null);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ===========================================================================
  // STATE UNTUK MODE REPORTS
  // ===========================================================================
  const [reportTab, setReportTab] = useState<
    "SALDO" | "KARTU_STOK" | "PERIODIC" | "SPK_USAGE" | "PRICE_FLUCTUATION"
  >(initialSelectedKartuStokItemId ? "KARTU_STOK" : "SALDO");

  const [kartuItemId, setKartuItemId] = useState<number>(
    initialSelectedKartuStokItemId || items[0]?.id || 1
  );
  const [kartuStartDate, setKartuStartDate] = useState("");
  const [kartuEndDate, setKartuEndDate] = useState("");
  const [kartuTxType, setKartuTxType] = useState("");
  const [kartuData, setKartuData] = useState<{
    item: Record<string, any> | null;
    mutations: Array<Record<string, any>>;
  }>({ item: null, mutations: [] });

  const [periodicStart, setPeriodicStart] = useState("2026-10-01");
  const [periodicEnd, setPeriodicEnd] = useState("2026-11-30");
  const [periodicRows, setPeriodicRows] = useState<Array<Record<string, any>>>([]);
  const [spkRows, setSpkRows] = useState<Array<Record<string, any>>>([]);
  const [priceHistRows, setPriceHistRows] = useState<Array<Record<string, any>>>(
    []
  );
  const [priceFilterItemId, setPriceFilterItemId] = useState<string>("ALL");

  useEffect(() => {
    if (initialSelectedKartuStokItemId) {
      setKartuItemId(initialSelectedKartuStokItemId);
      setReportTab("KARTU_STOK");
    }
  }, [initialSelectedKartuStokItemId]);

  // Fetch Kartu Stok
  useEffect(() => {
    if (mode !== "REPORTS" || reportTab !== "KARTU_STOK" || !kartuItemId) return;
    const params = new URLSearchParams({
      type: "kartu_stok",
      item_id: String(kartuItemId),
    });
    if (kartuStartDate) params.set("start_date", kartuStartDate);
    if (kartuEndDate) params.set("end_date", kartuEndDate);
    if (kartuTxType) params.set("tx_type", kartuTxType);

    fetch(`/api/reports?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.item)
          setKartuData({ item: d.item, mutations: d.mutations || [] });
      })
      .catch(() => {});
  }, [mode, reportTab, kartuItemId, kartuStartDate, kartuEndDate, kartuTxType]);

  // Fetch Periodic / SPK / Price Fluctuation
  useEffect(() => {
    if (mode !== "REPORTS" || !showPrices) return;
    if (reportTab === "PERIODIC") {
      fetch(
        `/api/reports?type=periodic&start_date=${periodicStart}&end_date=${periodicEnd}`
      )
        .then((r) => r.json())
        .then((d) => setPeriodicRows(d.periodic || []))
        .catch(() => {});
    } else if (reportTab === "SPK_USAGE") {
      fetch(`/api/reports?type=spk_usage`)
        .then((r) => r.json())
        .then((d) => setSpkRows(d.spk_usage || []))
        .catch(() => {});
    } else if (reportTab === "PRICE_FLUCTUATION") {
      fetch(`/api/reports?type=price_fluctuation`)
        .then((r) => r.json())
        .then((d) => setPriceHistRows(d.price_history || []))
        .catch(() => {});
    }
  }, [mode, reportTab, periodicStart, periodicEnd, showPrices]);

  // ===========================================================================
  // HANDLERS MASTER DATA
  // ===========================================================================
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemModal || submitting) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/masters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: itemModal.id ? "update_item" : "create_item",
          ...itemModal,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error });
      } else {
        setFeedback({ type: "success", text: data.message });
        setItemModal(null);
        await onRefresh();
      }
    } catch {
      setFeedback({ type: "error", text: "Gagal menyimpan barang." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleItemActive = async (item: Record<string, any>) => {
    setFeedback(null);
    const res = await fetch("/api/masters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_item_active",
        id: item.id,
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

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierModal || submitting) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/masters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: supplierModal.id ? "update_supplier" : "create_supplier",
          ...supplierModal,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error });
      } else {
        setFeedback({ type: "success", text: data.message });
        setSupplierModal(null);
        await onRefresh();
      }
    } catch {
      setFeedback({ type: "error", text: "Gagal menyimpan supplier." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportCsv = async () => {
    setFeedback(null);
    setCsvResult(null);
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      setFeedback({
        type: "error",
        text: "Data CSV minimal harus memiliki baris header dan 1 baris data.",
      });
      return;
    }
    const parsedRows = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      return {
        sku: cols[0] || "",
        name: cols[1] || "",
        category: cols[2] || "",
        unit: cols[3] || "",
        purchase_unit: cols[4] || cols[3] || "",
        conversion_factor: Number(cols[5] || 1),
        min_stock: Number(cols[6] || 0),
        allow_decimal: cols[7] || "false",
      };
    });

    const res = await fetch("/api/masters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "import_csv",
        rows: parsedRows,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFeedback({ type: "error", text: data.error });
    } else {
      setCsvResult(data);
      await onRefresh();
    }
  };

  const filteredItems = items.filter((it) => {
    if (catFilter !== "ALL" && String(it.category_id) !== catFilter)
      return false;
    if (statusFilter === "ACTIVE" && (!it.is_active || it.is_auto_archived))
      return false;
    if (statusFilter === "INACTIVE" && it.is_active && !it.is_auto_archived)
      return false;
    if (statusFilter === "REMNANT" && !it.is_remnant) return false;
    if (itemSearch.trim()) {
      const q = itemSearch.toLowerCase();
      if (
        !String(it.sku).toLowerCase().includes(q) &&
        !String(it.name).toLowerCase().includes(q) &&
        !String(it.category_name).toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pagedItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // ===========================================================================
  // RENDER MODE 1: MASTER DATA BARANG, KATEGORI, SATUAN, SUPPLIER & IMPOR CSV
  // ===========================================================================
  if (mode === "MASTERS") {
    return (
      <div className="space-y-6">
        <div className="taste-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-medium text-[#232323]">
              Master Data Gudang
            </h2>
            <p className="text-xs text-[#666662] mt-0.5">
              Katalog bahan baku percetakan, rasio konversi satuan, dan data rekanan supplier.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setMasterTab("ITEMS")}
              className={`btn px-3 py-1.5 text-xs ${
                masterTab === "ITEMS" ? "btn--primary" : "btn--secondary"
              }`}
            >
              Barang ({items.length})
            </button>
            <button
              onClick={() => setMasterTab("SUPPLIERS")}
              className={`btn px-3 py-1.5 text-xs ${
                masterTab === "SUPPLIERS" ? "btn--primary" : "btn--secondary"
              }`}
            >
              Supplier ({suppliers.length})
            </button>
            <button
              onClick={() => setMasterTab("CATEGORIES_UNITS")}
              className={`btn px-3 py-1.5 text-xs ${
                masterTab === "CATEGORIES_UNITS"
                  ? "btn--primary"
                  : "btn--secondary"
              }`}
            >
              Kategori &amp; Satuan
            </button>
            {isAdmin && (
              <button
                onClick={() => setMasterTab("CSV_IMPORT")}
                className={`btn px-3 py-1.5 text-xs flex items-center gap-1.5 ${
                  masterTab === "CSV_IMPORT" ? "btn--primary" : "btn--secondary"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Impor CSV</span>
              </button>
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

        {/* SUB-TAB 1: MASTER BARANG */}
        {masterTab === "ITEMS" && (
          <div className="taste-card overflow-hidden">
            <div className="p-4 border-b border-[#232323]/12 flex flex-col sm:flex-row gap-3 items-center justify-between bg-[#efefec]">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-[#666662] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari Kode SKU atau Nama Barang..."
                  value={itemSearch}
                  onChange={(e) => {
                    setItemSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 border border-[#232323]/25 text-xs bg-white"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={catFilter}
                  onChange={(e) => {
                    setCatFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 border border-[#232323]/25 text-xs font-medium bg-white"
                >
                  <option value="ALL">Semua Kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 border border-[#232323]/25 text-xs font-medium bg-white"
                >
                  <option value="ACTIVE">Status Aktif</option>
                  <option value="REMNANT">
                    Khusus SKU Sisa Potong (&ge;20cm)
                  </option>
                  <option value="INACTIVE">
                    Nonaktif / Auto-Archived (BR-004)
                  </option>
                  <option value="ALL">Semua Status</option>
                </select>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 border border-[#232323]/25 text-xs font-mono bg-white"
                >
                  <option value={25}>25 / hal</option>
                  <option value={50}>50 / hal</option>
                  <option value={100}>100 / hal</option>
                </select>
                {canManage && (
                  <button
                    onClick={() =>
                      setItemModal({
                        sku: "",
                        name: "",
                        category_id: categories[0]?.id || 1,
                        unit_id: units[0]?.id || 1,
                        purchase_unit_id: units[1]?.id || 1,
                        conversion_factor: 500,
                        min_stock: 1000,
                        allow_decimal: false,
                        paper_type: "Art Paper",
                        grammage: 150,
                        length_cm: 109,
                        width_cm: 79,
                        ink_color: "",
                        notes: "",
                      })
                    }
                    className="btn btn--primary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah SKU Baru</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f6f6f4] border-b border-[#232323]/12 text-left text-xs font-medium text-[#666662]">
                    <th className="py-3 px-4">Kode SKU</th>
                    <th className="py-3 px-4">Nama &amp; Spesifikasi Barang</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Konversi Satuan</th>
                    <th className="py-3 px-4 text-right">Saldo Stok</th>
                    <th className="py-3 px-4 text-right">Stok Min</th>
                    {showPrices && (
                      <th className="py-3 px-4 text-right">
                        Avg Cost (BR-14)
                      </th>
                    )}
                    {canManage && (
                      <th className="py-3 px-4 text-right">Tindakan</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232323]/10">
                  {pagedItems.map((it) => (
                    <tr
                      key={it.id}
                      className={
                        !it.is_active
                          ? "bg-[#efefec]/60 text-[#666662]"
                          : "hover:bg-[#f6f6f4]"
                      }
                    >
                      <td className="py-3 px-4 font-mono font-medium text-[#232323]">
                        <div className="flex items-center gap-1.5">
                          <span>{it.sku}</span>
                          {it.has_transactions && (
                            <span title="BR-10: SKU & Satuan Dasar terkunci karena sudah ada transaksi">
                              <Lock className="w-3.5 h-3.5 text-[#666662]" />
                            </span>
                          )}
                        </div>
                        {it.is_remnant ? (
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-[4px] bg-[#a1ffcb] text-[#113823] text-[10px] font-mono">
                            SKU Sisa Potong
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#232323]">
                          {it.name}
                        </div>
                        <div className="text-xs text-[#666662]">
                          {it.paper_type && `${it.paper_type} `}
                          {it.grammage && `${it.grammage} gsm `}
                          {it.width_cm &&
                            it.length_cm &&
                            `(${it.width_cm}×${it.length_cm} cm) `}
                          {it.ink_color && `Warna: ${it.ink_color}`}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-[#666662]">
                        {it.category_name}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono">
                        <div className="font-medium text-[#232323]">
                          Dasar: {it.unit_name}
                        </div>
                        {Number(it.conversion_factor) > 1 && (
                          <div className="text-[#666662]">
                            1 {it.purchase_unit_name} = {it.conversion_factor}{" "}
                            {it.unit_name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium tabular-nums">
                        <span
                          className={
                            Number(it.current_stock) <= Number(it.min_stock) &&
                            Number(it.min_stock) > 0
                              ? "text-rose-700 font-semibold"
                              : "text-[#232323]"
                          }
                        >
                          {formatNumber(it.current_stock)} {it.unit_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-[#666662] tabular-nums">
                        {formatNumber(it.min_stock)} {it.unit_name}
                      </td>
                      {showPrices && (
                        <td className="py-3 px-4 text-right font-mono text-xs text-[#232323] tabular-nums">
                          {formatRupiah(it.avg_cost)} / {it.unit_name}
                        </td>
                      )}
                      {canManage && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setItemModal({ ...it })}
                              className="btn btn--secondary p-1.5"
                              title="Ubah Master Barang"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleItemActive(it)}
                              className={`btn btn--secondary p-1.5 ${
                                it.is_active
                                  ? "text-rose-700"
                                  : "text-[#113823]"
                              }`}
                              title={
                                it.is_active
                                  ? "Nonaktifkan Barang (BR-09: Stok harus 0)"
                                  : "Aktifkan Barang"
                              }
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer (FR-17) */}
            <div className="p-4 border-t border-[#232323]/12 flex items-center justify-between text-xs text-[#666662] bg-[#efefec]">
              <span className="font-mono">
                Menampilkan {pagedItems.length} dari {filteredItems.length} SKU
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="btn btn--secondary px-3 py-1 text-xs disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <span className="font-mono font-medium text-[#232323]">
                  Hal {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="btn btn--secondary px-3 py-1 text-xs disabled:opacity-40"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 2: MASTER SUPPLIER (FR-04) */}
        {masterTab === "SUPPLIERS" && (
          <div className="taste-card overflow-hidden">
            <div className="p-4 border-b border-[#232323]/12 flex items-center justify-between bg-[#efefec]">
              <h3 className="text-sm font-medium text-[#232323]">
                Daftar Master Supplier / Vendor Bahan Percetakan
              </h3>
              {canManage && (
                <button
                  onClick={() =>
                    setSupplierModal({
                      name: "",
                      contact_name: "",
                      phone: "",
                      email: "",
                      address: "",
                      payment_terms: "NET 30 Hari",
                      is_active: 1,
                    })
                  }
                  className="btn btn--primary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Supplier</span>
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f6f6f4] border-b border-[#232323]/12 text-left text-xs font-medium text-[#666662]">
                    <th className="py-3 px-4">Kode</th>
                    <th className="py-3 px-4">Nama Supplier</th>
                    <th className="py-3 px-4">Kontak PIC</th>
                    <th className="py-3 px-4">Telepon / Email</th>
                    <th className="py-3 px-4">Termin</th>
                    <th className="py-3 px-4">Status</th>
                    {canManage && (
                      <th className="py-3 px-4 text-right">Tindakan</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232323]/10">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-[#f6f6f4]">
                      <td className="py-3 px-4 font-mono font-medium text-xs">
                        {s.code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#232323]">
                          {s.name}
                        </div>
                        <div className="text-xs text-[#666662]">{s.address}</div>
                      </td>
                      <td className="py-3 px-4 text-[#232323]">
                        {s.contact_name || "-"}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono">
                        <div>{s.phone || "-"}</div>
                        <div className="text-[#666662]">{s.email || ""}</div>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono font-medium">
                        {s.payment_terms}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-[4px] font-mono text-[11px] font-medium ${
                            s.is_active
                              ? "bg-[#a1ffcb] text-[#113823]"
                              : "bg-[#efefec] text-[#666662]"
                          }`}
                        >
                          {s.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      {canManage && (
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSupplierModal({ ...s })}
                            className="btn btn--secondary px-2.5 py-1 text-xs"
                          >
                            Ubah
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUB-TAB 3: MASTER KATEGORI & SATUAN (FR-04) */}
        {masterTab === "CATEGORIES_UNITS" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Master Kategori */}
            <div className="taste-card p-6 space-y-4">
              <h3 className="text-sm font-medium text-[#232323]">
                Master Kategori Bahan Percetakan
              </h3>
              {canManage && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nama Kategori Baru..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-[#232323]/25 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Prefix"
                    value={newCatPrefix}
                    onChange={(e) =>
                      setNewCatPrefix(e.target.value.toUpperCase())
                    }
                    className="w-20 px-2.5 py-1.5 border border-[#232323]/25 text-sm font-mono uppercase"
                  />
                  <button
                    onClick={async () => {
                      if (!newCatName.trim()) return;
                      await fetch("/api/masters", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "create_category",
                          name: newCatName,
                          code_prefix: newCatPrefix,
                        }),
                      });
                      setNewCatName("");
                      await onRefresh();
                    }}
                    className="btn btn--primary px-4 py-1.5 text-xs"
                  >
                    Tambah
                  </button>
                </div>
              )}
              <ul className="divide-y divide-[#232323]/10 text-sm">
                {categories.map((c) => (
                  <li
                    key={c.id}
                    className="py-2.5 flex items-center justify-between"
                  >
                    <span className="font-medium text-[#232323]">{c.name}</span>
                    <span className="px-2 py-0.5 rounded-[4px] bg-[#efefec] border border-[#232323]/15 font-mono text-xs">
                      Prefix: {c.code_prefix}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Master Satuan */}
            <div className="taste-card p-6 space-y-4">
              <h3 className="text-sm font-medium text-[#232323]">
                Master Satuan Barang
              </h3>
              {canManage && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nama Satuan Baru (misal: Box, Pack)..."
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-[#232323]/25 text-sm"
                  />
                  <button
                    onClick={async () => {
                      if (!newUnitName.trim()) return;
                      await fetch("/api/masters", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "create_unit",
                          name: newUnitName,
                        }),
                      });
                      setNewUnitName("");
                      await onRefresh();
                    }}
                    className="btn btn--primary px-4 py-1.5 text-xs"
                  >
                    Tambah
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {units.map((u) => (
                  <span
                    key={u.id}
                    className="px-3 py-1.5 rounded-[4px] bg-[#efefec] border border-[#232323]/15 font-mono text-xs font-medium text-[#232323]"
                  >
                    {u.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 4: IMPOR CSV MASTER BARANG (FR-11) */}
        {masterTab === "CSV_IMPORT" && isAdmin && (
          <div className="taste-card p-6 space-y-4">
            <h3 className="font-display text-base font-medium text-[#232323]">
              Impor CSV Master Barang dengan Pratinjau &amp; Laporan Error per
              Baris (FR-11)
            </h3>
            <p className="text-xs text-[#666662]">
              Format Kolom CSV:{" "}
              <code className="px-2 py-0.5 rounded-[4px] bg-[#efefec] border border-[#232323]/15 font-mono font-medium text-[#232323]">
                SKU,Nama,Kategori,Satuan,SatuanBeli,Konversi,StokMin,Desimal
              </code>
              . Baris yang bermasalah tidak akan menggagalkan baris lain yang
              valid (UAT-13).
            </p>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full p-3 border border-[#232323]/25 font-mono text-xs"
            />
            <button
              onClick={handleImportCsv}
              className="btn btn--primary px-5 py-2.5 text-xs flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Jalankan Validasi &amp; Impor CSV</span>
            </button>

            {csvResult && (
              <div className="p-4 rounded-[6px] bg-[#f6f6f4] border border-[#232323]/15 space-y-3 text-xs">
                <div className="flex items-center gap-4 font-mono font-medium">
                  <span className="text-[#113823]">
                    Berhasil Diimpor: {csvResult.insertedCount} SKU
                  </span>
                  <span className="text-rose-700">
                    Baris Bermasalah: {csvResult.errorCount} Baris
                  </span>
                </div>
                {csvResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="font-medium text-rose-800">
                      Detail Error per Baris:
                    </p>
                    <ul className="list-disc pl-5 text-rose-800 font-mono">
                      {csvResult.errors.map((err, i) => (
                        <li key={i}>
                          Baris #{err.row} (SKU: {err.sku}): {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* MODAL TAMBAH / EDIT MASTER BARANG */}
        {itemModal && (
          <div className="fixed inset-0 z-50 bg-[#232323]/60 flex items-center justify-center p-4 overflow-y-auto">
            <form
              onSubmit={handleSaveItem}
              className="taste-card bg-white max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-[#232323]/12 pb-3">
                <h3 className="font-display text-base font-medium text-[#232323]">
                  {itemModal.id
                    ? `Ubah Master Barang: ${itemModal.sku}`
                    : "Tambah Master Barang Baru"}
                </h3>
                <button
                  type="button"
                  onClick={() => setItemModal(null)}
                  className="btn btn--secondary px-2.5 py-1 text-xs flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Tutup</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Kode SKU (Unik) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(itemModal.has_transactions)}
                    placeholder="Contoh: KRT-AP150-79X109"
                    value={itemModal.sku}
                    onChange={(e) =>
                      setItemModal({
                        ...itemModal,
                        sku: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-2 border border-[#232323]/25 font-mono uppercase disabled:bg-[#efefec]"
                  />
                  {itemModal.has_transactions && (
                    <p className="text-[11px] text-[#666662] mt-0.5 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>BR-10: Terkunci karena sudah memiliki transaksi.</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Kategori <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={itemModal.category_id}
                    onChange={(e) =>
                      setItemModal({
                        ...itemModal,
                        category_id: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-[#232323]/25"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Nama Lengkap Barang <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kertas Art Paper 150 gsm Plano (79x109 cm)"
                    value={itemModal.name}
                    onChange={(e) =>
                      setItemModal({ ...itemModal, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#232323]/25"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Satuan Dasar Stok (Terkecil){" "}
                    <span className="text-rose-600">*</span>
                  </label>
                  <select
                    disabled={Boolean(itemModal.has_transactions)}
                    value={itemModal.unit_id}
                    onChange={(e) =>
                      setItemModal({
                        ...itemModal,
                        unit_id: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-[#232323]/25 disabled:bg-[#efefec]"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Satuan Beli / Kemasan (Konversi PO/Inbound)
                  </label>
                  <select
                    value={itemModal.purchase_unit_id || itemModal.unit_id}
                    onChange={(e) =>
                      setItemModal({
                        ...itemModal,
                        purchase_unit_id: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-[#232323]/25"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Rasio Konversi (1 Satuan Beli = X Satuan Dasar)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={itemModal.conversion_factor}
                    onChange={(e) =>
                      setItemModal({
                        ...itemModal,
                        conversion_factor: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-[#232323]/25 font-mono font-medium"
                  />
                  <p className="text-[11px] text-[#666662] mt-0.5">
                    BR-001 Kertas: 1 Rim = 500 Lembar. BR-002 Tinta: 1 Kaleng =
                    5 Kg.
                  </p>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Batas Stok Minimum (Dalam Satuan Dasar)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={itemModal.min_stock}
                    onChange={(e) =>
                      setItemModal({
                        ...itemModal,
                        min_stock: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-[#232323]/25 font-mono font-medium"
                  />
                </div>

                {/* Atribut Spesifik Kertas / Tinta */}
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Jenis Kertas / Warna Tinta (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: Art Paper / Process Cyan"
                    value={itemModal.paper_type || itemModal.ink_color || ""}
                    onChange={(e) =>
                      setItemModal({
                        ...itemModal,
                        paper_type: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-[#232323]/25"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-[#232323] mb-1">
                      Gramatur (gsm)
                    </label>
                    <input
                      type="number"
                      value={itemModal.grammage || ""}
                      onChange={(e) =>
                        setItemModal({
                          ...itemModal,
                          grammage: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      className="w-full px-2 py-2 border border-[#232323]/25 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#232323] mb-1">
                      Lebar (cm)
                    </label>
                    <input
                      type="number"
                      value={itemModal.width_cm || ""}
                      onChange={(e) =>
                        setItemModal({
                          ...itemModal,
                          width_cm: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      className="w-full px-2 py-2 border border-[#232323]/25 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#232323] mb-1">
                      Panjang (cm)
                    </label>
                    <input
                      type="number"
                      value={itemModal.length_cm || ""}
                      onChange={(e) =>
                        setItemModal({
                          ...itemModal,
                          length_cm: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      className="w-full px-2 py-2 border border-[#232323]/25 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allowDec"
                    checked={Boolean(itemModal.allow_decimal)}
                    onChange={(e) =>
                      setItemModal({
                        ...itemModal,
                        allow_decimal: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-[#232323]"
                  />
                  <label
                    htmlFor="allowDec"
                    className="text-xs font-medium text-[#232323]"
                  >
                    Izinkan kuantitas desimal/pecahan (Aktifkan untuk Tinta
                    Kg/Liter, matikan untuk Lembar/Pcs)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#232323]/12">
                <button
                  type="button"
                  onClick={() => setItemModal(null)}
                  className="btn btn--secondary px-4 py-2 text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn--primary px-5 py-2 text-xs"
                >
                  {submitting ? "Menyimpan..." : "Simpan Master Barang"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL SUPPLIER */}
        {supplierModal && (
          <div className="fixed inset-0 z-50 bg-[#232323]/60 flex items-center justify-center p-4">
            <form
              onSubmit={handleSaveSupplier}
              className="taste-card bg-white max-w-md w-full p-6 space-y-4"
            >
              <h3 className="font-display text-base font-medium text-[#232323]">
                {supplierModal.id ? "Ubah Supplier" : "Tambah Supplier Baru"}
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Nama Perusahaan Supplier *
                  </label>
                  <input
                    type="text"
                    required
                    value={supplierModal.name}
                    onChange={(e) =>
                      setSupplierModal({
                        ...supplierModal,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-[#232323]/25"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Nama Kontak (PIC)
                  </label>
                  <input
                    type="text"
                    value={supplierModal.contact_name || ""}
                    onChange={(e) =>
                      setSupplierModal({
                        ...supplierModal,
                        contact_name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-[#232323]/25"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[13px] font-medium text-[#232323] mb-1">
                      Telepon
                    </label>
                    <input
                      type="text"
                      value={supplierModal.phone || ""}
                      onChange={(e) =>
                        setSupplierModal({
                          ...supplierModal,
                          phone: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-[#232323]/25 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#232323] mb-1">
                      Termin Pembayaran
                    </label>
                    <input
                      type="text"
                      value={supplierModal.payment_terms || ""}
                      onChange={(e) =>
                        setSupplierModal({
                          ...supplierModal,
                          payment_terms: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-[#232323]/25 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#232323] mb-1">
                    Alamat Lengkap
                  </label>
                  <textarea
                    rows={2}
                    value={supplierModal.address || ""}
                    onChange={(e) =>
                      setSupplierModal({
                        ...supplierModal,
                        address: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-[#232323]/25"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSupplierModal(null)}
                  className="btn btn--secondary px-4 py-2 text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn--primary px-4 py-2 text-xs"
                >
                  Simpan Supplier
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // RENDER MODE 2: KARTU STOK & LAPORAN LENGKAP (FR-14, FR-15, Bagian 8)
  // ===========================================================================
  const totalValuation = items
    .filter((i) => i.is_active)
    .reduce(
      (acc, i) =>
        acc + Number(i.current_stock || 0) * Number(i.avg_cost || 0),
      0
    );

  return (
    <div className="space-y-6">
      <div className="taste-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h2 className="font-display text-xl font-medium text-[#232323]">
            Laporan Gudang
          </h2>
          <p className="text-xs text-[#666662] mt-0.5">
            Audit mutasi stok, kartu persediaan, dan rekap pemakaian produksi.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setReportTab("SALDO")}
            className={`btn px-3 py-1.5 text-xs flex items-center gap-1.5 ${
              reportTab === "SALDO" ? "btn--primary" : "btn--secondary"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Saldo Stok</span>
          </button>
          <button
            onClick={() => setReportTab("KARTU_STOK")}
            className={`btn px-3 py-1.5 text-xs flex items-center gap-1.5 ${
              reportTab === "KARTU_STOK" ? "btn--primary" : "btn--secondary"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Kartu Stok</span>
          </button>
          {showPrices && (
            <>
              <button
                onClick={() => setReportTab("PERIODIC")}
                className={`btn px-3 py-1.5 text-xs flex items-center gap-1.5 ${
                  reportTab === "PERIODIC" ? "btn--primary" : "btn--secondary"
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Periodik</span>
              </button>
              <button
                onClick={() => setReportTab("SPK_USAGE")}
                className={`btn px-3 py-1.5 text-xs flex items-center gap-1.5 ${
                  reportTab === "SPK_USAGE" ? "btn--primary" : "btn--secondary"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Pemakaian SPK</span>
              </button>
              <button
                onClick={() => setReportTab("PRICE_FLUCTUATION")}
                className={`btn px-3 py-1.5 text-xs flex items-center gap-1.5 ${
                  reportTab === "PRICE_FLUCTUATION"
                    ? "btn--primary"
                    : "btn--secondary"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Fluktuasi Harga</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* =====================================================================
          LAPORAN 1: SALDO STOK TERKINI & VALUASI PERSEDIAAN (FR-14 Must)
          ===================================================================== */}
      {reportTab === "SALDO" && (
        <div className="taste-card overflow-hidden">
          <div className="p-4 border-b border-[#232323]/12 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#efefec]">
            <div>
              <h3 className="text-sm font-medium text-[#232323]">
                Laporan Saldo Stok Aktual Gudang Percetakan
              </h3>
              {showPrices && (
                <p className="text-xs text-[#666662] mt-0.5">
                  Total Nilai Persediaan (Moving Average Valuation):{" "}
                  <strong className="font-mono font-semibold text-[#232323] text-sm">
                    {formatRupiah(totalValuation)}
                  </strong>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 no-print">
              <button
                onClick={() => {
                  const headers = showPrices
                    ? [
                        "Kode SKU",
                        "Nama Barang",
                        "Kategori",
                        "Stok Aktual",
                        "Satuan Dasar",
                        "Stok Minimum",
                        "Status",
                        "Harga Rata-Rata (Rp)",
                        "Nilai Valuasi (Rp)",
                      ]
                    : [
                        "Kode SKU",
                        "Nama Barang",
                        "Kategori",
                        "Stok Aktual",
                        "Satuan Dasar",
                        "Stok Minimum",
                        "Status",
                      ];
                  const rows = items
                    .filter((i) => i.is_active)
                    .map((i) => {
                      const isLow =
                        Number(i.min_stock) > 0 &&
                        Number(i.current_stock) <= Number(i.min_stock);
                      const base = [
                        i.sku,
                        i.name,
                        i.category_name,
                        i.current_stock,
                        i.unit_name,
                        i.min_stock,
                        isLow ? "KRITIS (Di Bawah Minimum)" : "AMAN",
                      ];
                      if (showPrices) {
                        base.push(
                          Math.round(Number(i.avg_cost || 0)),
                          Math.round(
                            Number(i.current_stock) * Number(i.avg_cost || 0)
                          )
                        );
                      }
                      return base;
                    });
                  exportToCsvOrExcel(
                    "Laporan_Saldo_Stok_Terkini",
                    headers,
                    rows,
                    "EXCEL"
                  );
                }}
                className="btn btn--secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Excel (.xls)</span>
              </button>
              <button
                onClick={() => {
                  const headers = [
                    "SKU",
                    "Nama Barang",
                    "Kategori",
                    "Stok",
                    "Satuan",
                  ];
                  const rows = items
                    .filter((i) => i.is_active)
                    .map((i) => [
                      i.sku,
                      i.name,
                      i.category_name,
                      i.current_stock,
                      i.unit_name,
                    ]);
                  exportToCsvOrExcel("Saldo_Stok_Gudang", headers, rows, "CSV");
                }}
                className="btn btn--secondary px-3 py-1.5 text-xs"
              >
                Ekspor CSV
              </button>
              <button
                onClick={() => window.print()}
                className="btn btn--primary px-3 py-1.5 text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak PDF</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f6f6f4] border-b border-[#232323]/12 text-left text-xs font-medium text-[#666662]">
                  <th className="py-3 px-4">Kode SKU</th>
                  <th className="py-3 px-4">Nama Barang</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4 text-right">Saldo Stok Aktual</th>
                  <th className="py-3 px-4 text-right">Setara Kemasan Beli</th>
                  <th className="py-3 px-4 text-center">Status Stok</th>
                  {showPrices && (
                    <>
                      <th className="py-3 px-4 text-right">Harga Rata-Rata</th>
                      <th className="py-3 px-4 text-right">Nilai Persediaan</th>
                    </>
                  )}
                  <th className="py-3 px-4 text-right no-print">Kartu Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232323]/10">
                {items
                  .filter((i) => i.is_active)
                  .map((it) => {
                    const isLow =
                      Number(it.min_stock) > 0 &&
                      Number(it.current_stock) <= Number(it.min_stock);
                    const val =
                      Number(it.current_stock) * Number(it.avg_cost || 0);
                    return (
                      <tr key={it.id} className="hover:bg-[#f6f6f4]">
                        <td className="py-3 px-4 font-mono font-medium text-[#232323]">
                          {it.sku}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#232323]">
                          {it.name}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#666662]">
                          {it.category_name}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-[#232323] tabular-nums">
                          {formatNumber(it.current_stock)} {it.unit_name}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-[#666662] tabular-nums">
                          {Number(it.conversion_factor) > 1
                            ? `${formatNumber(
                                Number(it.current_stock) /
                                  Number(it.conversion_factor)
                              )} ${it.purchase_unit_name}`
                            : "-"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isLow ? (
                            <span className="px-2 py-0.5 rounded-[4px] bg-rose-50 text-rose-800 border border-rose-200 font-mono text-xs font-medium">
                              Kritis (&le;{formatNumber(it.min_stock)})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-[4px] bg-[#a1ffcb] text-[#113823] font-mono text-xs font-medium">
                              Aman
                            </span>
                          )}
                        </td>
                        {showPrices && (
                          <>
                            <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                              {formatRupiah(it.avg_cost)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium text-[#232323] tabular-nums">
                              {formatRupiah(val)}
                            </td>
                          </>
                        )}
                        <td className="py-3 px-4 text-right no-print">
                          <button
                            onClick={() => {
                              setKartuItemId(it.id);
                              setReportTab("KARTU_STOK");
                            }}
                            className="btn btn--secondary px-2.5 py-1 text-xs inline-flex items-center gap-1"
                          >
                            <span>Mutasi</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          LAPORAN 2: KARTU STOK / MUTASI PER BARANG (FR-14 Must)
          ===================================================================== */}
      {reportTab === "KARTU_STOK" && (
        <div className="taste-card overflow-hidden space-y-4">
          <div className="p-5 border-b border-[#232323]/12 bg-[#efefec] flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-1">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#232323] mb-1">
                  Pilih Barang (SKU)
                </label>
                <select
                  value={kartuItemId}
                  onChange={(e) => setKartuItemId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-[#232323]/25 text-sm font-medium bg-white"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.sku} — {it.name} (Saldo:{" "}
                      {formatNumber(it.current_stock)} {it.unit_name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#232323] mb-1">
                  Filter Tipe Mutasi
                </label>
                <select
                  value={kartuTxType}
                  onChange={(e) => setKartuTxType(e.target.value)}
                  className="w-full px-3 py-2 border border-[#232323]/25 text-xs font-medium bg-white"
                >
                  <option value="">Semua Tipe</option>
                  <option value="OPENING">OPENING (Saldo Awal)</option>
                  <option value="IN">IN (Barang Masuk)</option>
                  <option value="OUT">OUT (Barang Keluar SPK)</option>
                  <option value="CUTTING">CUTTING (Potong Kertas)</option>
                  <option value="ADJUSTMENT">ADJUSTMENT (Koreksi)</option>
                  <option value="REVERSAL">REVERSAL (Void)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#232323] mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={kartuStartDate}
                  onChange={(e) => setKartuStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#232323]/25 text-xs font-mono bg-white"
                />
              </div>
            </div>

            <button
              onClick={() => {
                const headers = [
                  "Tanggal",
                  "No. Transaksi",
                  "Tipe",
                  "No. Referensi (Nota/SPK)",
                  "Masuk",
                  "Keluar",
                  "Saldo Akhir",
                  "Satuan",
                  "Petugas Input",
                  "Keterangan",
                ];
                const rows = kartuData.mutations.map((m) => [
                  formatDateId(m.transaction_date),
                  m.transaction_number,
                  m.type,
                  m.reference_number || "-",
                  Number(m.qty_delta) > 0 ? m.qty_delta : 0,
                  Number(m.qty_delta) < 0 ? Math.abs(Number(m.qty_delta)) : 0,
                  m.balance_after,
                  kartuData.item?.unit_name || "",
                  m.user_name,
                  m.notes || "-",
                ]);
                exportToCsvOrExcel(
                  `Kartu_Stok_${kartuData.item?.sku || "SKU"}`,
                  headers,
                  rows,
                  "EXCEL"
                );
              }}
              className="btn btn--secondary px-4 py-2 text-xs flex items-center gap-1.5 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Kartu Stok (.xls)</span>
            </button>
          </div>

          {kartuData.item && (
            <div className="px-5 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                Kartu Stok:{" "}
                <strong className="text-[#232323] font-mono text-sm">
                  {kartuData.item.sku} — {kartuData.item.name}
                </strong>
              </div>
              <div className="flex items-center gap-4">
                <span>
                  Saldo Saat Ini:{" "}
                  <strong className="text-base text-[#232323] font-mono">
                    {formatNumber(kartuData.item.current_stock)}{" "}
                    {kartuData.item.unit_name}
                  </strong>
                </span>
                {showPrices && (
                  <span>
                    Harga Rata-Rata (HPP):{" "}
                    <strong className="text-[#232323] font-mono">
                      {formatRupiah(kartuData.item.avg_cost)} /{" "}
                      {kartuData.item.unit_name}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f6f6f4] border-b border-[#232323]/12 text-left text-xs font-medium text-[#666662]">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">No. Transaksi</th>
                  <th className="py-3 px-4">Tipe</th>
                  <th className="py-3 px-4">No. Referensi (Nota / SPK)</th>
                  <th className="py-3 px-4 text-right">Masuk (+)</th>
                  <th className="py-3 px-4 text-right">Keluar (-)</th>
                  <th className="py-3 px-4 text-right">Saldo Akhir</th>
                  {showPrices && (
                    <th className="py-3 px-4 text-right">Harga Satuan</th>
                  )}
                  <th className="py-3 px-4">Petugas &amp; Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232323]/10">
                {kartuData.mutations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-8 text-center text-sm text-[#666662]"
                    >
                      Belum ada riwayat mutasi untuk barang ini.
                    </td>
                  </tr>
                ) : (
                  kartuData.mutations.map((m) => (
                    <tr
                      key={m.id}
                      className={
                        m.is_voided
                          ? "bg-rose-50/30 text-[#666662]"
                          : "hover:bg-[#f6f6f4]"
                      }
                    >
                      <td className="py-3 px-4 font-mono text-xs text-[#666662]">
                        {formatDateId(m.transaction_date)}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-xs">
                        <span
                          className={
                            m.is_voided
                              ? "line-through text-rose-700"
                              : "text-[#232323]"
                          }
                        >
                          {m.transaction_number}
                        </span>
                        {m.is_voided && (
                          <span className="block text-[10px] text-rose-700 font-mono">
                            VOID ({m.reversed_by_number})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-[4px] bg-[#efefec] text-[#232323] border border-[#232323]/15 font-mono text-[11px]">
                          {m.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-mono font-medium text-[#232323]">
                          {m.reference_number || "-"}
                        </div>
                        <div className="text-[#666662]">
                          {m.supplier_name || m.requester_name || ""}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-[#113823] tabular-nums">
                        {Number(m.qty_delta) > 0
                          ? `+${formatNumber(m.qty_delta)}`
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-rose-700 tabular-nums">
                        {Number(m.qty_delta) < 0
                          ? formatNumber(m.qty_delta)
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[#232323] bg-[#f6f6f4] tabular-nums">
                        {formatNumber(m.balance_after)}
                      </td>
                      {showPrices && (
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                          {formatRupiah(m.unit_cost)}
                        </td>
                      )}
                      <td className="py-3 px-4 text-xs">
                        <div className="font-medium text-[#232323]">
                          {m.user_name}
                        </div>
                        {m.notes && (
                          <div className="text-[#666662] italic">{m.notes}</div>
                        )}
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
          LAPORAN 3: LAPORAN PERIODIK MUTASI BARANG (FR-14 Should)
          ===================================================================== */}
      {reportTab === "PERIODIC" && showPrices && (
        <div className="taste-card overflow-hidden">
          <div className="p-4 border-b border-[#232323]/12 bg-[#efefec] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-[11px] font-medium text-[#666662]">
                  Periode Awal
                </label>
                <input
                  type="date"
                  value={periodicStart}
                  onChange={(e) => setPeriodicStart(e.target.value)}
                  className="px-3 py-1.5 border border-[#232323]/25 text-xs bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#666662]">
                  Periode Akhir
                </label>
                <input
                  type="date"
                  value={periodicEnd}
                  onChange={(e) => setPeriodicEnd(e.target.value)}
                  className="px-3 py-1.5 border border-[#232323]/25 text-xs bg-white font-mono"
                />
              </div>
            </div>
            <button
              onClick={() => {
                const headers = [
                  "SKU",
                  "Nama Barang",
                  "Satuan",
                  "Stok Awal",
                  "Total Masuk",
                  "Total Keluar",
                  "Koreksi / Sisa",
                  "Stok Akhir",
                  "Nilai Persediaan Akhir (Rp)",
                ];
                const rows = periodicRows.map((r) => [
                  r.sku,
                  r.name,
                  r.unit_name,
                  r.opening_stock,
                  r.total_in,
                  r.total_out,
                  r.total_adjustment,
                  r.closing_stock,
                  r.closing_value,
                ]);
                exportToCsvOrExcel(
                  `Laporan_Periodik_${periodicStart}_sd_${periodicEnd}`,
                  headers,
                  rows,
                  "EXCEL"
                );
              }}
              className="btn btn--secondary px-4 py-2 text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Laporan Periodik (.xls)</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f6f6f4] border-b border-[#232323]/12 text-left text-xs font-medium text-[#666662]">
                  <th className="py-3 px-4">SKU &amp; Nama Barang</th>
                  <th className="py-3 px-4 text-right">Stok Awal</th>
                  <th className="py-3 px-4 text-right">Total Masuk</th>
                  <th className="py-3 px-4 text-right">Total Keluar</th>
                  <th className="py-3 px-4 text-right">Koreksi / Sisa</th>
                  <th className="py-3 px-4 text-right">Stok Akhir</th>
                  <th className="py-3 px-4 text-right">Nilai Akhir (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232323]/10">
                {periodicRows.map((r) => (
                  <tr key={r.id} className="hover:bg-[#f6f6f4]">
                    <td className="py-3 px-4">
                      <div className="font-mono font-medium text-[#232323]">
                        {r.sku}
                      </div>
                      <div className="text-xs text-[#666662]">
                        {r.name} ({r.unit_name})
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatNumber(r.opening_stock)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-[#113823] tabular-nums">
                      +{formatNumber(r.total_in)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-rose-700 tabular-nums">
                      -{formatNumber(r.total_out)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {Number(r.total_adjustment) > 0 ? "+" : ""}
                      {formatNumber(r.total_adjustment)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-[#232323] tabular-nums">
                      {formatNumber(r.closing_stock)} {r.unit_name}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-[#232323] tabular-nums">
                      {formatRupiah(r.closing_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          LAPORAN 4: REKAP PEMAKAIAN BAHAN & HPP PER JOB / SPK (FR-14 Should)
          ===================================================================== */}
      {reportTab === "SPK_USAGE" && showPrices && (
        <div className="taste-card overflow-hidden">
          <div className="p-4 border-b border-[#232323]/12 bg-[#efefec] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-[#232323]">
                Rekapitulasi Pemakaian Bahan Baku &amp; HPP per Nomor Job / SPK
                Produksi
              </h3>
              <p className="text-xs text-[#666662]">
                Melacak seluruh pengambilan bahan kertas, tinta, dan plate
                berdasarkan Nomor SPK.
              </p>
            </div>
            <button
              onClick={() => {
                const headers = [
                  "Nomor Job / SPK",
                  "Tanggal",
                  "No. Transaksi",
                  "Divisi / Pemohon",
                  "SKU",
                  "Nama Bahan",
                  "Qty Terpakai",
                  "Satuan",
                  "HPP Satuan (Rp)",
                  "Total HPP Bahan (Rp)",
                ];
                const rows = spkRows.map((r) => [
                  r.spk_number,
                  formatDateId(r.transaction_date),
                  r.transaction_number,
                  r.requester_name || "-",
                  r.sku,
                  r.item_name,
                  r.qty_used,
                  r.unit_name,
                  r.unit_cost,
                  r.total_cost,
                ]);
                exportToCsvOrExcel(
                  "Laporan_Pemakaian_Bahan_Per_SPK",
                  headers,
                  rows,
                  "EXCEL"
                );
              }}
              className="btn btn--secondary px-4 py-2 text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Laporan SPK (.xls)</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f6f6f4] border-b border-[#232323]/12 text-left text-xs font-medium text-[#666662]">
                  <th className="py-3 px-4">Nomor Job / SPK</th>
                  <th className="py-3 px-4">Tanggal &amp; Dokumen</th>
                  <th className="py-3 px-4">Pemohon / Divisi</th>
                  <th className="py-3 px-4">Bahan Baku (SKU)</th>
                  <th className="py-3 px-4 text-right">Kuantitas Keluar</th>
                  <th className="py-3 px-4 text-right">HPP Satuan</th>
                  <th className="py-3 px-4 text-right">Total HPP Bahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232323]/10">
                {spkRows.map((r, i) => (
                  <tr key={i} className="hover:bg-[#f6f6f4]">
                    <td className="py-3 px-4 font-mono font-medium text-[#232323]">
                      {r.spk_number}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono">
                      <div className="text-[#232323]">
                        {formatDateId(r.transaction_date)}
                      </div>
                      <div className="text-[#666662]">
                        {r.transaction_number}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#666662]">
                      {r.requester_name || "-"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-medium text-[#232323]">
                        {r.sku}
                      </div>
                      <div className="text-xs text-[#666662]">
                        {r.item_name}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium tabular-nums">
                      {formatNumber(r.qty_used)} {r.unit_name}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      {formatRupiah(r.unit_cost)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-[#232323] tabular-nums">
                      {formatRupiah(r.total_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          LAPORAN 5: FLUKTUASI HARGA BELI SUPPLIER (PRD v1.0 Bagian 8.3)
          ===================================================================== */}
      {reportTab === "PRICE_FLUCTUATION" && showPrices && (
        <div className="taste-card overflow-hidden space-y-4">
          <div className="p-4 border-b border-[#232323]/12 bg-[#efefec] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-[#232323]">
                Laporan &amp; Grafik Riwayat Fluktuasi Harga Beli Supplier (PRD
                Bagian 8.3)
              </h3>
              <p className="text-xs text-[#666662]">
                Memantau kenaikan/penurunan harga beli kertas dan tinta dari
                invoice penerimaan supplier.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={priceFilterItemId}
                onChange={(e) => setPriceFilterItemId(e.target.value)}
                className="px-3 py-1.5 border border-[#232323]/25 text-xs font-medium bg-white"
              >
                <option value="ALL">
                  Semua Barang yang Memiliki Riwayat Harga
                </option>
                {items.map((it) => (
                  <option key={it.id} value={String(it.id)}>
                    {it.sku} — {it.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const headers = [
                    "Tanggal Transaksi",
                    "SKU",
                    "Nama Barang",
                    "Supplier",
                    "No. Invoice / Nota",
                    "Harga Beli per Kemasan",
                    "Satuan Beli",
                    "Harga per Satuan Dasar",
                  ];
                  const filtered = priceHistRows.filter(
                    (p) =>
                      priceFilterItemId === "ALL" ||
                      String(p.item_id) === priceFilterItemId
                  );
                  const rows = filtered.map((p) => [
                    formatDateId(p.transaction_date),
                    p.sku,
                    p.item_name,
                    p.supplier_name,
                    p.reference_number || "-",
                    p.input_unit_price,
                    p.input_unit,
                    p.base_unit_cost,
                  ]);
                  exportToCsvOrExcel(
                    "Laporan_Fluktuasi_Harga_Supplier",
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
                  <th className="py-3 px-4">Tanggal Nota</th>
                  <th className="py-3 px-4">SKU &amp; Nama Barang</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">No. Referensi Nota</th>
                  <th className="py-3 px-4 text-right">Harga Beli Kemasan</th>
                  <th className="py-3 px-4 text-right">Harga Satuan Dasar</th>
                  <th className="py-3 px-4">Proporsi Tren Harga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232323]/10">
                {priceHistRows
                  .filter(
                    (p) =>
                      priceFilterItemId === "ALL" ||
                      String(p.item_id) === priceFilterItemId
                  )
                  .map((p, idx, arr) => {
                    const sameItemPrices = arr
                      .filter((x) => x.item_id === p.item_id)
                      .map((x) => Number(x.input_unit_price));
                    const maxP = Math.max(...sameItemPrices, 1);
                    const pctWidth = Math.round(
                      (Number(p.input_unit_price) / maxP) * 100
                    );

                    return (
                      <tr key={p.id || idx} className="hover:bg-[#f6f6f4]">
                        <td className="py-3 px-4 font-mono text-xs text-[#666662]">
                          {formatDateId(p.transaction_date)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-medium text-[#232323]">
                            {p.sku}
                          </div>
                          <div className="text-xs text-[#666662]">
                            {p.item_name}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-[#232323]">
                          {p.supplier_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-[#666662]">
                          {p.reference_number || "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-[#232323] tabular-nums">
                          {formatRupiah(p.input_unit_price)} / {p.input_unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-[#666662] tabular-nums">
                          {formatRupiah(p.base_unit_cost)} / {p.base_unit_name}
                        </td>
                        <td className="py-3 px-4 w-48">
                          <div className="w-full bg-[#efefec] h-2 rounded-[2px] overflow-hidden border border-[#232323]/10">
                            <div
                              className="bg-[#232323] h-full"
                              style={{ width: `${pctWidth}%` }}
                            />
                          </div>
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
  );
}
