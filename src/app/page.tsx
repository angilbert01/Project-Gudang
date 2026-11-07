"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  ClipboardCheck,
  BarChart3,
  Package,
  ShieldAlert,
  LogOut,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Plus,
  PackageCheck,
  UserPlus,
  Settings,
  ScrollText,
  Printer,
  RefreshCw,
  Scissors,
  Download,
  ArrowUpRight,
  Layers,
  ChevronDown,
  Info,
} from "lucide-react";
import PoModule from "@/components/PoModule";
import TransactionsModule from "@/components/TransactionsModule";
import OpnameModule from "@/components/OpnameModule";
import MasterAndReportsModule from "@/components/MasterAndReportsModule";
import {
  exportToCsvOrExcel,
  formatDateId,
  formatDateTimeId,
  formatNumber,
  formatRupiah,
} from "@/lib/format";

type ActiveMenu =
  | "DASHBOARD"
  | "TRANSACTIONS"
  | "PO"
  | "OPNAME"
  | "REPORTS"
  | "MASTERS"
  | "ADMIN";

export default function HomePage() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [user, setUser] = useState<{
    userId: number;
    email: string;
    name: string;
    role: "ADMIN" | "KEPALA_GUDANG" | "PETUGAS";
    mustChangePassword: boolean;
  } | null>(null);

  // Login State
  const [loginEmail, setLoginEmail] = useState("admin@percetakan.co.id");
  const [loginPassword, setLoginPassword] = useState("AdminGudang123!");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showSpecDetails, setShowSpecDetails] = useState(false);

  // Change Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwdFeedback, setPwdFeedback] = useState<string | null>(null);

  // Navigation & Cross-Module Routing State
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>("DASHBOARD");
  const [txSubTab, setTxSubTab] = useState<
    "IN" | "OUT" | "CUTTING" | "ADJUSTMENT" | "OPENING" | "HISTORY"
  >("IN");
  const [preselectedPoForInbound, setPreselectedPoForInbound] = useState<
    Record<string, any> | null
  >(null);
  const [poDraftFromMinStock, setPoDraftFromMinStock] = useState<Array<{
    item_id: number;
    input_qty: number;
    use_purchase_unit: boolean;
    unit_price: number;
  }> | null>(null);
  const [selectedKartuStokItemId, setSelectedKartuStokItemId] = useState<
    number | null
  >(null);

  // App Data State
  const [dashboardData, setDashboardData] = useState<Record<string, any> | null>(
    null
  );
  const [items, setItems] = useState<Array<Record<string, any>>>([]);
  const [categories, setCategories] = useState<Array<Record<string, any>>>([]);
  const [units, setUnits] = useState<Array<Record<string, any>>>([]);
  const [suppliers, setSuppliers] = useState<Array<Record<string, any>>>([]);
  const [usersList, setUsersList] = useState<Array<Record<string, any>>>([]);
  const [settingsMap, setSettingsMap] = useState<Record<string, string>>({});
  const [purchaseOrders, setPurchaseOrders] = useState<Array<Record<string, any>>>(
    []
  );
  const [transactions, setTransactions] = useState<Array<Record<string, any>>>([]);
  const [stockCounts, setStockCounts] = useState<Array<Record<string, any>>>([]);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, any>>>([]);

  // Dashboard Min-Stock Checkbox Selection for "Buat PO" (FR-05)
  const [selectedCriticalIds, setSelectedCriticalIds] = useState<number[]>([]);

  // Admin Panel State
  const [adminTab, setAdminTab] = useState<"USERS" | "SETTINGS" | "AUDIT">(
    "USERS"
  );
  const [newUserModal, setNewUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("PETUGAS");
  const [newUserPassword, setNewUserPassword] = useState("GudangBaru123!");
  const [adminFeedback, setAdminFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchAllData = useCallback(async () => {
    try {
      const [dashRes, masterRes, poRes, txRes, opRes] = await Promise.all([
        fetch("/api/reports?type=dashboard"),
        fetch("/api/masters"),
        fetch("/api/po"),
        fetch("/api/transactions"),
        fetch("/api/opname"),
      ]);

      if (dashRes.ok) {
        const d = await dashRes.json();
        setDashboardData(d);
      }
      if (masterRes.ok) {
        const m = await masterRes.json();
        setItems(m.items || []);
        setCategories(m.categories || []);
        setUnits(m.units || []);
        setSuppliers(m.suppliers || []);
        setUsersList(m.users || []);
        const sMap = Object.fromEntries(
          (m.settings || []).map((s: any) => [s.key, s.value])
        );
        setSettingsMap(sMap);
      }
      if (poRes.ok) {
        const p = await poRes.json();
        setPurchaseOrders(p.purchase_orders || []);
      }
      if (txRes.ok) {
        const t = await txRes.json();
        setTransactions(t.transactions || []);
      }
      if (opRes.ok) {
        const o = await opRes.json();
        setStockCounts(o.stock_counts || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated && d.user) {
          setUser(d.user);
          if (d.settings) setSettingsMap(d.settings);
          if (d.user.mustChangePassword) setShowPasswordModal(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAuth(false));
  }, []);

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user, fetchAllData]);

  useEffect(() => {
    if (user?.role === "ADMIN" && activeMenu === "ADMIN" && adminTab === "AUDIT") {
      fetch("/api/reports?type=audit_logs")
        .then((r) => r.json())
        .then((d) => setAuditLogs(d.audit_logs || []))
        .catch(() => {});
    }
  }, [user, activeMenu, adminTab]);

  const handleLogin = async (
    e?: React.FormEvent,
    overrideEmail?: string,
    overridePwd?: string
  ) => {
    if (e) e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email: overrideEmail ?? loginEmail,
          password: overridePwd ?? loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Login gagal.");
      } else {
        setUser(data.user);
        if (data.user.mustChangePassword) {
          setShowPasswordModal(true);
        }
      }
    } catch {
      setLoginError("Gagal menghubungi server.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setUser(null);
    setActiveMenu("DASHBOARD");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdFeedback(null);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "change_password",
        oldPassword,
        newPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPwdFeedback(data.error);
    } else {
      setOldPassword("");
      setNewPassword("");
      setShowPasswordModal(false);
      if (user) setUser({ ...user, mustChangePassword: false });
    }
  };

  // FR-05: Buat PO Draft dari Barang Kritis di Dashboard
  const handleCreatePoFromCriticalItems = () => {
    const critList = dashboardData?.critical_items || [];
    const chosen =
      selectedCriticalIds.length > 0
        ? critList.filter((c: any) => selectedCriticalIds.includes(Number(c.id)))
        : critList;
    if (chosen.length === 0) return;

    const draftLines = chosen.map((c: any) => {
      const usePurch = Number(c.conversion_factor) > 1;
      const factor = usePurch ? Number(c.conversion_factor) : 1;
      const baseCost = Number(c.last_purchase_cost || c.avg_cost || 0);
      return {
        item_id: Number(c.id),
        input_qty: usePurch
          ? Number(c.suggested_purchase_qty)
          : Number(c.suggested_base_qty),
        use_purchase_unit: usePurch,
        unit_price: Math.round(baseCost * factor),
      };
    });

    setPoDraftFromMinStock(draftLines);
    setActiveMenu("PO");
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f4] text-[#232323]">
        <div className="flex items-center gap-3 text-sm font-medium">
          <RefreshCw className="w-4 h-4 animate-spin text-[#232323]" />
          <span>Memuat sistem operasional gudang...</span>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // LAYAR LOGIN — Clean, Centered & Modern (Decluttered)
  // ===========================================================================
  if (!user) {
    return (
      <div className="min-h-screen bg-[#f6f6f4] text-[#232323] flex flex-col justify-between">
        {/* Minimal Header */}
        <header className="border-b border-[#232323]/10 bg-white">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[4px] bg-[#232323] text-[#a1ffcb] flex items-center justify-center">
                <Printer className="w-4 h-4" />
              </div>
              <span className="font-display font-medium text-sm sm:text-base tracking-tight text-[#232323]">
                PT Grafika Nusantara Percetakan
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#666662] font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-[#16a34a]" />
              <span>Sistem Gudang v2.0</span>
            </div>
          </div>
        </header>

        {/* Center Container */}
        <div className="max-w-md w-full mx-auto px-4 py-8">
          <div className="taste-card p-6 sm:p-7 bg-white space-y-5 shadow-sm">
            <div className="space-y-1 text-center">
              <h1 className="font-display text-xl font-medium text-[#232323]">
                Masuk ke Sistem Gudang
              </h1>
              <p className="text-xs text-[#666662]">
                Kelola stok kertas plano, PO, dan mutasi barang percetakan.
              </p>
            </div>

            {loginError && (
              <div className="p-3 rounded-[4px] bg-rose-50 border border-rose-300 text-rose-900 text-xs font-medium flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-700" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={(e) => handleLogin(e)} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#232323] mb-1">
                  Email Akun
                </label>
                <input
                  type="email"
                  required
                  placeholder="nama@percetakan.co.id"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#232323]/25 text-sm text-[#232323] rounded-[4px] focus:outline-none focus:border-[#232323]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#232323] mb-1">
                  Kata Sandi
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#232323]/25 text-sm text-[#232323] rounded-[4px] focus:outline-none focus:border-[#232323]"
                />
              </div>
              <button
                type="submit"
                disabled={loginLoading}
                className="btn btn--primary w-full h-10 px-4 text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-1"
              >
                <span>{loginLoading ? "Memverifikasi..." : "Masuk"}</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick 1-Click Role Switcher */}
            <div className="pt-4 border-t border-[#232323]/10 space-y-2">
              <span className="text-[11px] font-mono text-[#666662] block text-center uppercase tracking-wider">
                Pilih Akun Demo (1-Klik Masuk)
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail("admin@percetakan.co.id");
                    setLoginPassword("AdminGudang123!");
                    handleLogin(undefined, "admin@percetakan.co.id", "AdminGudang123!");
                  }}
                  className="btn btn--secondary py-2 text-center text-xs flex flex-col items-center justify-center gap-0.5"
                >
                  <span className="font-medium text-[#232323]">Admin</span>
                  <span className="text-[10px] text-[#666662] font-mono">Penuh</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail("kepala@percetakan.co.id");
                    setLoginPassword("KepalaGudang123!");
                    handleLogin(undefined, "kepala@percetakan.co.id", "KepalaGudang123!");
                  }}
                  className="btn btn--secondary py-2 text-center text-xs flex flex-col items-center justify-center gap-0.5"
                >
                  <span className="font-medium text-[#232323]">Kepala</span>
                  <span className="text-[10px] text-[#666662] font-mono">PO &amp; Harga</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail("petugas@percetakan.co.id");
                    setLoginPassword("PetugasGudang123!");
                    handleLogin(undefined, "petugas@percetakan.co.id", "PetugasGudang123!");
                  }}
                  className="btn btn--secondary py-2 text-center text-xs flex flex-col items-center justify-center gap-0.5"
                >
                  <span className="font-medium text-[#232323]">Petugas</span>
                  <span className="text-[10px] text-[#666662] font-mono">Fisik</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Minimal Footer */}
        <footer className="border-t border-[#232323]/10 bg-white py-3">
          <div className="max-w-5xl mx-auto px-6 text-center text-xs text-[#666662]">
            PT Grafika Nusantara Percetakan &copy; 2026
          </div>
        </footer>
      </div>
    );
  }

  const showPrices = user.role === "ADMIN" || user.role === "KEPALA_GUDANG";
  const canManagePo = user.role === "ADMIN" || user.role === "KEPALA_GUDANG";

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f6f4] text-[#232323]">
      {/* Fixed Opaque Inverse Top Header (taste-skill system.md Nav rules) */}
      <header className="no-print bg-[#232323] text-white border-b border-white/15 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[6px] bg-[#a1ffcb] text-[#113823] flex items-center justify-center font-bold">
              <Printer className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-display font-medium text-sm sm:text-base tracking-tight text-white">
                {settingsMap.company_name || "PT Grafika Nusantara Percetakan"}
              </span>
              <span className="hidden md:inline-block px-2 py-0.5 rounded-[4px] bg-[#303030] text-[#a1ffcb] border border-white/10 font-mono text-[11px]">
                SIM GUDANG v2.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="text-right hidden sm:block pr-1">
              <div className="text-xs font-medium text-white leading-tight">{user.name}</div>
              <div className="text-[11px] font-mono text-[#a4a4a4] leading-tight">
                {user.email}
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-[4px] bg-[#303030] text-[#a1ffcb] border border-white/15 font-mono text-[11px] font-medium">
              {user.role.replace("_", " ")}
            </span>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="p-2 rounded-[6px] bg-[#303030] hover:bg-[#3d3d3d] text-[#d4d4d4] border border-white/10"
              title="Ganti Kata Sandi"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-[6px] bg-[#303030] hover:bg-rose-950 hover:text-rose-200 hover:border-rose-700 text-white border border-white/15 text-xs font-medium flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>

        {/* Navigation Strip — Clean 2px active bar under current page */}
        <div className="bg-[#1b1b1b] border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveMenu("DASHBOARD")}
              aria-current={activeMenu === "DASHBOARD" ? "page" : undefined}
              className={`no-step px-3.5 py-2.5 text-xs font-medium flex items-center gap-2 whitespace-nowrap border-b-2 transition-colors ${
                activeMenu === "DASHBOARD"
                  ? "border-[#a1ffcb] text-white bg-white/[0.04]"
                  : "border-transparent text-[#a4a4a4] hover:text-white"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Ringkasan &amp; Stok Min</span>
              {(dashboardData?.kpi?.critical_stock_count ?? 0) > 0 && (
                <span className="px-1.5 py-0.2 rounded-[4px] bg-rose-600 text-white font-mono text-[10px]">
                  {dashboardData?.kpi?.critical_stock_count}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveMenu("TRANSACTIONS")}
              aria-current={activeMenu === "TRANSACTIONS" ? "page" : undefined}
              className={`no-step px-3.5 py-2.5 text-xs font-medium flex items-center gap-2 whitespace-nowrap border-b-2 transition-colors ${
                activeMenu === "TRANSACTIONS"
                  ? "border-[#a1ffcb] text-white bg-white/[0.04]"
                  : "border-transparent text-[#a4a4a4] hover:text-white"
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Transaksi &amp; Potong Kertas</span>
            </button>

            <button
              onClick={() => setActiveMenu("PO")}
              aria-current={activeMenu === "PO" ? "page" : undefined}
              className={`no-step px-3.5 py-2.5 text-xs font-medium flex items-center gap-2 whitespace-nowrap border-b-2 transition-colors ${
                activeMenu === "PO"
                  ? "border-[#a1ffcb] text-white bg-white/[0.04]"
                  : "border-transparent text-[#a4a4a4] hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Purchase Order (PO)</span>
              {(dashboardData?.kpi?.late_po_count ?? 0) > 0 && (
                <span className="px-1.5 py-0.2 rounded-[4px] bg-amber-400 text-[#232323] font-mono font-semibold text-[10px]">
                  {dashboardData?.kpi?.late_po_count} Telat
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveMenu("OPNAME")}
              aria-current={activeMenu === "OPNAME" ? "page" : undefined}
              className={`no-step px-3.5 py-2.5 text-xs font-medium flex items-center gap-2 whitespace-nowrap border-b-2 transition-colors ${
                activeMenu === "OPNAME"
                  ? "border-[#a1ffcb] text-white bg-white/[0.04]"
                  : "border-transparent text-[#a4a4a4] hover:text-white"
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Stock Opname</span>
            </button>

            <button
              onClick={() => setActiveMenu("REPORTS")}
              aria-current={activeMenu === "REPORTS" ? "page" : undefined}
              className={`no-step px-3.5 py-2.5 text-xs font-medium flex items-center gap-2 whitespace-nowrap border-b-2 transition-colors ${
                activeMenu === "REPORTS"
                  ? "border-[#a1ffcb] text-white bg-white/[0.04]"
                  : "border-transparent text-[#a4a4a4] hover:text-white"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Kartu Stok &amp; Laporan</span>
            </button>

            <button
              onClick={() => setActiveMenu("MASTERS")}
              aria-current={activeMenu === "MASTERS" ? "page" : undefined}
              className={`no-step px-3.5 py-2.5 text-xs font-medium flex items-center gap-2 whitespace-nowrap border-b-2 transition-colors ${
                activeMenu === "MASTERS"
                  ? "border-[#a1ffcb] text-white bg-white/[0.04]"
                  : "border-transparent text-[#a4a4a4] hover:text-white"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Master Barang &amp; Supplier</span>
            </button>

            {user.role === "ADMIN" && (
              <button
                onClick={() => setActiveMenu("ADMIN")}
                aria-current={activeMenu === "ADMIN" ? "page" : undefined}
                className={`no-step px-3.5 py-2.5 text-xs font-medium flex items-center gap-2 whitespace-nowrap border-b-2 transition-colors ${
                  activeMenu === "ADMIN"
                    ? "border-[#a1ffcb] text-white bg-white/[0.04]"
                    : "border-transparent text-[#a4a4a4] hover:text-white"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Administrasi &amp; Audit</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* ===================================================================
            MENU 1: DASHBOARD OPERASIONAL & PERINGATAN STOK MINIMUM (FR-05)
            =================================================================== */}
        {activeMenu === "DASHBOARD" && (
          <div className="space-y-6">
            {/* Editorial Section Header + Two-Style Button Row */}
            <div className="taste-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-medium text-[#232323]">
                  Ikhtisar Gudang &amp; Stok
                </h1>
                <p className="text-xs text-[#666662] mt-0.5">
                  Status persediaan real-time, peringatan stok kritis, dan pemantauan Purchase Order.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setTxSubTab("IN");
                    setActiveMenu("TRANSACTIONS");
                  }}
                  className="btn btn--primary px-3.5 py-2 text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Barang Masuk</span>
                </button>
                <button
                  onClick={() => {
                    setTxSubTab("OUT");
                    setActiveMenu("TRANSACTIONS");
                  }}
                  className="btn btn--secondary px-3.5 py-2 text-xs flex items-center gap-1.5"
                >
                  <span>Barang Keluar</span>
                </button>
                <button
                  onClick={() => {
                    setTxSubTab("CUTTING");
                    setActiveMenu("TRANSACTIONS");
                  }}
                  className="btn btn--secondary px-3.5 py-2 text-xs flex items-center gap-1.5"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Potong Plano</span>
                </button>
              </div>
            </div>

            {/* Status Integritas Stok Ringkas */}
            {dashboardData?.reconciliation && (
              <div
                className={`px-4 py-2.5 rounded-[6px] border flex flex-wrap items-center justify-between gap-2 text-xs ${
                  dashboardData.reconciliation.is_healthy
                    ? "bg-white border-[#232323]/12 text-[#232323]"
                    : "bg-rose-50 border-rose-300 text-rose-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  {dashboardData.reconciliation.is_healthy ? (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#a1ffcb] text-[#113823]">
                      <CheckCircle2 className="w-3 h-3" />
                    </span>
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>
                    {dashboardData.reconciliation.is_healthy
                      ? "Integritas Data: 100% konsisten antara saldo fisik dan buku besar mutasi."
                      : `Perhatian: Ditemukan ${dashboardData.reconciliation.discrepancies.length} SKU dengan selisih mutasi.`}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[#666662]">
                  Append-Only Mode
                </span>
              </div>
            )}

            {/* KPI Hairline Grid Strip */}
            <div
              className={`taste-card overflow-hidden grid grid-cols-2 ${
                showPrices ? "lg:grid-cols-6" : "lg:grid-cols-4"
              } divide-y lg:divide-y-0 sm:divide-x divide-[#232323]/12`}
            >
              <div className="p-5">
                <p className="text-[13px] font-medium text-[#666662]">Total SKU Aktif</p>
                <p className="font-display text-2xl font-medium text-[#232323] mt-1.5 font-mono tabular-nums">
                  {dashboardData?.kpi?.total_active_items ?? items.length}
                </p>
              </div>
              <div className="p-5">
                <p className="text-[13px] font-medium text-[#666662]">
                  Stok Kritis (&le; Min)
                </p>
                <p
                  className={`font-display text-2xl font-medium mt-1.5 font-mono tabular-nums ${
                    (dashboardData?.kpi?.critical_stock_count ?? 0) > 0
                      ? "text-rose-600"
                      : "text-[#232323]"
                  }`}
                >
                  {dashboardData?.kpi?.critical_stock_count ?? 0} SKU
                </p>
              </div>
              <div className="p-5">
                <p className="text-[13px] font-medium text-[#666662]">PO Terbuka</p>
                <p className="font-display text-2xl font-medium text-[#232323] mt-1.5 font-mono tabular-nums">
                  {dashboardData?.kpi?.open_po_count ?? 0} PO
                </p>
              </div>
              <div className="p-5">
                <p className="text-[13px] font-medium text-[#666662]">PO Terlambat</p>
                <p
                  className={`font-display text-2xl font-medium mt-1.5 font-mono tabular-nums ${
                    (dashboardData?.kpi?.late_po_count ?? 0) > 0
                      ? "text-amber-700"
                      : "text-[#232323]"
                  }`}
                >
                  {dashboardData?.kpi?.late_po_count ?? 0} PO
                </p>
              </div>
              {showPrices && (
                <>
                  <div className="p-5">
                    <p className="text-[13px] font-medium text-[#666662]">
                      Nilai Persediaan
                    </p>
                    <p className="font-mono text-base font-medium text-[#232323] mt-2 tabular-nums">
                      {formatRupiah(dashboardData?.kpi?.total_inventory_value)}
                    </p>
                  </div>
                  <div className="p-5">
                    <p className="text-[13px] font-medium text-[#666662]">Sisa Hutang PO</p>
                    <p className="font-mono text-base font-medium text-rose-700 mt-2 tabular-nums">
                      {formatRupiah(dashboardData?.kpi?.total_unpaid_po)}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Peringatan Stok Minimum & Tombol "Buat PO" (FR-05) */}
            <div className="taste-card overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[#232323]/12 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-600" />
                    <h2 className="font-display text-base font-medium text-[#232323]">
                      Peringatan Stok Minimum
                    </h2>
                    {(dashboardData?.critical_items || []).length > 0 && (
                      <span className="px-2 py-0.5 rounded-[4px] bg-rose-50 border border-rose-200 text-rose-800 font-mono text-[11px] font-medium">
                        {(dashboardData?.critical_items || []).length} Kritis
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#666662] mt-0.5">
                    Item di bawah reorder point. Centang untuk generate draft PO otomatis.
                  </p>
                </div>
                {canManagePo && (dashboardData?.critical_items || []).length > 0 && (
                  <button
                    onClick={handleCreatePoFromCriticalItems}
                    className="btn btn--accent px-3.5 py-2 text-xs flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      Buat Draft PO (
                      {selectedCriticalIds.length > 0
                        ? `${selectedCriticalIds.length} SKU`
                        : "Semua"}
                      )
                    </span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#efefec] border-b border-[#232323]/12 text-left text-[12px] font-medium text-[#666662]">
                      {canManagePo && <th className="py-3 px-4 w-10">Pilih</th>}
                      <th className="py-3 px-4">SKU &amp; Nama Barang</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4 text-right">Stok Saat Ini</th>
                      <th className="py-3 px-4 text-right">Batas Minimum</th>
                      <th className="py-3 px-4 text-center">Rasio</th>
                      <th className="py-3 px-4 text-right">Usulan Order PO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232323]/10">
                    {(dashboardData?.critical_items || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-sm text-[#666662]">
                          Seluruh stok barang berada di atas batas minimum.
                        </td>
                      </tr>
                    ) : (
                      (dashboardData?.critical_items || []).map((it: any) => {
                        const pct = Math.round(Number(it.stock_ratio || 0) * 100);
                        const checked = selectedCriticalIds.includes(Number(it.id));
                        return (
                          <tr key={it.id} className="hover:bg-[#f6f6f4]">
                            {canManagePo && (
                              <td className="py-3 px-4">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const idNum = Number(it.id);
                                    setSelectedCriticalIds((prev) =>
                                      e.target.checked
                                        ? [...prev, idNum]
                                        : prev.filter((x) => x !== idNum)
                                    );
                                  }}
                                  className="w-4 h-4 accent-[#232323]"
                                />
                              </td>
                            )}
                            <td className="py-3 px-4">
                              <div className="font-mono font-medium text-[#232323]">
                                {it.sku}
                              </div>
                              <div className="text-xs text-[#666662]">{it.name}</div>
                            </td>
                            <td className="py-3 px-4 text-xs text-[#666662]">
                              {it.category_name}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-rose-700 tabular-nums">
                              {formatNumber(it.current_stock)} {it.unit_name}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-[#666662] tabular-nums">
                              {formatNumber(it.min_stock)} {it.unit_name}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded-[4px] bg-rose-50 text-rose-800 border border-rose-200 font-mono text-xs font-medium">
                                {pct}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium text-[#232323] tabular-nums">
                              {Number(it.conversion_factor) > 1
                                ? `${formatNumber(it.suggested_purchase_qty)} ${
                                    it.purchase_unit_name
                                  } (${formatNumber(it.suggested_base_qty)} ${it.unit_name})`
                                : `${formatNumber(it.suggested_base_qty)} ${it.unit_name}`}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2 Kolom Bawah: PO Terbuka/Terlambat & 10 Transaksi Terakhir */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* PO Terbuka & Terlambat */}
              <div className="taste-card overflow-hidden flex flex-col">
                <div className="p-4 border-b border-[#232323]/12 flex items-center justify-between bg-[#efefec]">
                  <h3 className="text-sm font-medium text-[#232323]">
                    PO Terbuka &amp; Menunggu Penerimaan
                  </h3>
                  <button
                    onClick={() => setActiveMenu("PO")}
                    className="text-xs font-medium text-[#232323] hover:underline flex items-center gap-1"
                  >
                    <span>Lihat Semua PO</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-[#232323]/10">
                  {(dashboardData?.open_pos || []).length === 0 ? (
                    <p className="p-8 text-center text-xs text-[#666662]">
                      Tidak ada PO terbuka saat ini.
                    </p>
                  ) : (
                    (dashboardData?.open_pos || []).map((po: any) => (
                      <div
                        key={po.id}
                        className="p-4 flex items-center justify-between gap-3 hover:bg-[#f6f6f4]"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-sm text-[#232323]">
                              {po.po_number}
                            </span>
                            <span className="px-2 py-0.5 rounded-[4px] bg-[#efefec] text-[#232323] border border-[#232323]/15 font-mono text-[10px]">
                              {po.status}
                            </span>
                            {po.is_late && (
                              <span className="px-2 py-0.5 rounded-[4px] bg-rose-600 text-white font-mono text-[10px]">
                                TERLAMBAT
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-[#232323] mt-1">
                            {po.supplier_name}
                          </p>
                          <p className="text-[11px] text-[#666662]">
                            Estimasi tiba: {formatDateId(po.expected_date)}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const fullPo = purchaseOrders.find(
                              (x) => Number(x.id) === Number(po.id)
                            );
                            if (fullPo) {
                              setPreselectedPoForInbound(fullPo);
                              setActiveMenu("TRANSACTIONS");
                            }
                          }}
                          className="btn btn--primary px-3 py-1.5 text-xs flex items-center gap-1.5 shrink-0"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Terima Barang</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 10 Transaksi Terakhir */}
              <div className="taste-card overflow-hidden flex flex-col">
                <div className="p-4 border-b border-[#232323]/12 flex items-center justify-between bg-[#efefec]">
                  <h3 className="text-sm font-medium text-[#232323]">
                    10 Transaksi Gudang Terakhir
                  </h3>
                  <button
                    onClick={() => {
                      setTxSubTab("HISTORY");
                      setActiveMenu("TRANSACTIONS");
                    }}
                    className="text-xs font-medium text-[#232323] hover:underline flex items-center gap-1"
                  >
                    <span>Riwayat Lengkap</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-[#232323]/10">
                  {(dashboardData?.recent_transactions || []).map((tx: any) => (
                    <div
                      key={tx.id}
                      className="p-3.5 flex items-center justify-between text-xs hover:bg-[#f6f6f4]"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-medium ${
                              tx.reversed_by_number
                                ? "line-through text-rose-700"
                                : "text-[#232323]"
                            }`}
                          >
                            {tx.transaction_number}
                          </span>
                          <span className="px-2 py-0.5 rounded-[4px] bg-[#efefec] text-[#232323] border border-[#232323]/15 font-mono text-[10px]">
                            {tx.type}
                          </span>
                        </div>
                        <p className="text-[#666662] mt-1">
                          Ref: <strong className="text-[#232323]">{tx.reference_number || "-"}</strong>{" "}
                          {tx.supplier_name || tx.requester_name
                            ? `• ${tx.supplier_name || tx.requester_name}`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right text-[#666662]">
                        <div className="font-mono text-[#232323]">
                          {formatDateId(tx.transaction_date)}
                        </div>
                        <div>{tx.user_name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            MENU 2: TRANSAKSI BARANG MASUK, KELUAR, POTONG KERTAS, VOID
            =================================================================== */}
        {activeMenu === "TRANSACTIONS" && (
          <TransactionsModule
            user={user}
            items={items}
            suppliers={suppliers}
            purchaseOrders={purchaseOrders}
            transactions={transactions}
            initialSubTab={txSubTab}
            preselectedPo={preselectedPoForInbound}
            onClearPreselectedPo={() => setPreselectedPoForInbound(null)}
            onRefresh={fetchAllData}
          />
        )}

        {/* ===================================================================
            MENU 3: PURCHASE ORDER MANAGEMENT SYSTEM
            =================================================================== */}
        {activeMenu === "PO" && (
          <PoModule
            user={user}
            settings={settingsMap}
            purchaseOrders={purchaseOrders}
            suppliers={suppliers}
            items={items}
            initialDraftItems={poDraftFromMinStock}
            onClearDraftItems={() => setPoDraftFromMinStock(null)}
            onReceiveFromPo={(po) => {
              setPreselectedPoForInbound(po);
              setActiveMenu("TRANSACTIONS");
            }}
            onRefresh={fetchAllData}
          />
        )}

        {/* ===================================================================
            MENU 4: NON-BLOCKING STOCK OPNAME
            =================================================================== */}
        {activeMenu === "OPNAME" && (
          <OpnameModule
            user={user}
            categories={categories}
            stockCounts={stockCounts}
            onRefresh={fetchAllData}
          />
        )}

        {/* ===================================================================
            MENU 5: KARTU STOK & PUSAT LAPORAN
            =================================================================== */}
        {activeMenu === "REPORTS" && (
          <MasterAndReportsModule
            mode="REPORTS"
            user={user}
            items={items}
            categories={categories}
            units={units}
            suppliers={suppliers}
            initialSelectedKartuStokItemId={selectedKartuStokItemId}
            onRefresh={fetchAllData}
          />
        )}

        {/* ===================================================================
            MENU 6: MASTER DATA BARANG, KATEGORI, SATUAN, SUPPLIER & CSV
            =================================================================== */}
        {activeMenu === "MASTERS" && (
          <MasterAndReportsModule
            mode="MASTERS"
            user={user}
            items={items}
            categories={categories}
            units={units}
            suppliers={suppliers}
            onRefresh={fetchAllData}
          />
        )}

        {/* ===================================================================
            MENU 7: PANEL ADMIN — MANAJEMEN USER, PENGATURAN & AUDIT LOG
            =================================================================== */}
        {activeMenu === "ADMIN" && user.role === "ADMIN" && (
          <div className="space-y-6">
            <div className="taste-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[13px] font-medium text-[#666662]">
                  Otoritas Administrator (FR-02 &amp; FR-16)
                </div>
                <h2 className="font-display text-xl font-medium text-[#232323] mt-0.5">
                  Manajemen Pengguna, Parameter Sistem &amp; Jejak Audit
                </h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setAdminTab("USERS")}
                  className={`btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
                    adminTab === "USERS" ? "btn--primary" : "btn--secondary"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Pengguna ({usersList.length})</span>
                </button>
                <button
                  onClick={() => setAdminTab("SETTINGS")}
                  className={`btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
                    adminTab === "SETTINGS" ? "btn--primary" : "btn--secondary"
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Pengaturan Sistem</span>
                </button>
                <button
                  onClick={() => setAdminTab("AUDIT")}
                  className={`btn px-3.5 py-2 text-xs flex items-center gap-1.5 ${
                    adminTab === "AUDIT" ? "btn--primary" : "btn--secondary"
                  }`}
                >
                  <ScrollText className="w-3.5 h-3.5" />
                  <span>Audit Log (FR-16)</span>
                </button>
              </div>
            </div>

            {adminFeedback && (
              <div
                className={`p-4 rounded-[6px] border flex items-center justify-between text-xs ${
                  adminFeedback.type === "success"
                    ? "bg-white border-[#232323] text-[#232323]"
                    : "bg-rose-50 border-rose-300 text-rose-900"
                }`}
              >
                <span className="font-medium">{adminFeedback.text}</span>
                <button
                  onClick={() => setAdminFeedback(null)}
                  className="font-medium underline"
                >
                  Tutup
                </button>
              </div>
            )}

            {/* SUB-TAB 1: MANAJEMEN USER (FR-02) */}
            {adminTab === "USERS" && (
              <div className="taste-card overflow-hidden">
                <div className="p-4 border-b border-[#232323]/12 flex items-center justify-between bg-[#efefec]">
                  <h3 className="text-sm font-medium text-[#232323]">
                    Daftar Akun Pengguna &amp; Hak Akses Peran (FR-02)
                  </h3>
                  <button
                    onClick={() => setNewUserModal(true)}
                    className="btn btn--primary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Pengguna</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#f6f6f4] border-b border-[#232323]/12 text-left text-xs font-medium text-[#666662]">
                        <th className="py-3 px-4">Nama Lengkap</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Peran (RBAC)</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Login Terakhir</th>
                        <th className="py-3 px-4 text-right">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232323]/10">
                      {usersList.map((u) => (
                        <tr key={u.id} className="hover:bg-[#f6f6f4]">
                          <td className="py-3 px-4 font-medium text-[#232323]">{u.name}</td>
                          <td className="py-3 px-4 font-mono text-xs text-[#666662]">
                            {u.email}
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={u.role}
                              onChange={async (e) => {
                                const res = await fetch("/api/masters", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    action: "update_user",
                                    id: u.id,
                                    role: e.target.value,
                                  }),
                                });
                                const data = await res.json();
                                if (!res.ok) {
                                  setAdminFeedback({ type: "error", text: data.error });
                                } else {
                                  setAdminFeedback({ type: "success", text: data.message });
                                  await fetchAllData();
                                }
                              }}
                              className="px-2.5 py-1 bg-white border border-[#232323]/25 font-mono text-xs font-medium"
                            >
                              <option value="ADMIN">ADMIN</option>
                              <option value="KEPALA_GUDANG">KEPALA_GUDANG</option>
                              <option value="PETUGAS">PETUGAS</option>
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-[4px] font-mono text-xs font-medium ${
                                u.is_active
                                  ? "bg-[#a1ffcb] text-[#113823]"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {u.is_active ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-[#666662]">
                            {formatDateTimeId(u.last_login_at)}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={async () => {
                                const res = await fetch("/api/masters", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    action: "update_user",
                                    id: u.id,
                                    is_active: !u.is_active,
                                  }),
                                });
                                const data = await res.json();
                                if (!res.ok) {
                                  setAdminFeedback({ type: "error", text: data.error });
                                } else {
                                  setAdminFeedback({ type: "success", text: data.message });
                                  await fetchAllData();
                                }
                              }}
                              className="btn btn--secondary px-2.5 py-1 text-xs"
                            >
                              {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                            <button
                              onClick={async () => {
                                const res = await fetch("/api/masters", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    action: "reset_user_password",
                                    id: u.id,
                                    temp_password: "ResetGudang123!",
                                  }),
                                });
                                if (res.ok) {
                                  setAdminFeedback({
                                    type: "success",
                                    text: `Kata sandi ${u.name} direset ke: ResetGudang123!`,
                                  });
                                }
                              }}
                              className="btn btn--secondary px-2.5 py-1 text-xs"
                            >
                              Reset Sandi
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: PENGATURAN SISTEM (BR-08, BR-11, FR-11) */}
            {adminTab === "SETTINGS" && (
              <div className="taste-card p-6 space-y-5 max-w-2xl">
                <h3 className="font-display text-base font-medium text-[#232323]">
                  Parameter &amp; Pengaturan Aturan Bisnis Gudang
                </h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <label className="block text-[13px] font-medium text-[#232323] mb-1">
                      Nama Perusahaan (Kop Surat PO &amp; Laporan)
                    </label>
                    <input
                      type="text"
                      value={settingsMap.company_name || ""}
                      onChange={(e) =>
                        setSettingsMap({ ...settingsMap, company_name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-[#232323]/25"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#232323] mb-1">
                      Alamat Perusahaan
                    </label>
                    <input
                      type="text"
                      value={settingsMap.company_address || ""}
                      onChange={(e) =>
                        setSettingsMap({
                          ...settingsMap,
                          company_address: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-[#232323]/25"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-medium text-[#232323] mb-1">
                        Batas Mundur Tanggal Petugas (Hari — BR-08)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settingsMap.max_backdate_petugas || "2"}
                        onChange={(e) =>
                          setSettingsMap({
                            ...settingsMap,
                            max_backdate_petugas: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-[#232323]/25 font-mono font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-[#232323] mb-1">
                        Batas Mundur Tanggal Kepala/Admin (Hari)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settingsMap.max_backdate_manager || "30"}
                        onChange={(e) =>
                          setSettingsMap({
                            ...settingsMap,
                            max_backdate_manager: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-[#232323]/25 font-mono font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-[#232323] mb-1">
                        Toleransi Lebih Terima Barang PO (% — BR-11)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={settingsMap.po_over_receipt_tolerance_percent || "0"}
                        onChange={(e) =>
                          setSettingsMap({
                            ...settingsMap,
                            po_over_receipt_tolerance_percent: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-[#232323]/25 font-mono font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-[#232323] mb-1">
                        Tanggal Cut-Over Kunci Opening Balance (FR-11)
                      </label>
                      <input
                        type="date"
                        value={settingsMap.cut_over_date || "2027-01-31"}
                        onChange={(e) =>
                          setSettingsMap({
                            ...settingsMap,
                            cut_over_date: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-[#232323]/25 font-mono font-medium"
                      />
                    </div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const res = await fetch("/api/masters", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "update_settings",
                        settings: settingsMap,
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setAdminFeedback({ type: "success", text: data.message });
                    }
                  }}
                  className="btn btn--primary px-5 py-2.5 text-xs"
                >
                  Simpan Pengaturan Sistem
                </button>
              </div>
            )}

            {/* SUB-TAB 3: AUDIT LOG READ-ONLY (FR-16) */}
            {adminTab === "AUDIT" && (
              <div className="taste-card overflow-hidden">
                <div className="p-4 border-b border-[#232323]/12 bg-[#efefec] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-[#232323]">
                      Rekaman Jejak Audit (Read-Only Audit Trail — FR-16)
                    </h3>
                    <p className="text-xs text-[#666662]">
                      Mencatat seluruh login, perubahan master, perubahan status PO, void,
                      opname, dan ekspor laporan.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const headers = [
                        "Waktu",
                        "Pengguna",
                        "Aksi",
                        "Objek",
                        "ID Objek",
                        "Data Sesudah",
                        "IP Address",
                      ];
                      const rows = auditLogs.map((l) => [
                        l.occurred_at,
                        l.user_name,
                        l.action,
                        l.entity_type,
                        l.entity_id || "-",
                        l.new_values || "-",
                        l.ip_address || "-",
                      ]);
                      exportToCsvOrExcel("Audit_Log_Sistem_Gudang", headers, rows, "EXCEL");
                    }}
                    className="btn btn--secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ekspor Audit Log</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#f6f6f4] border-b border-[#232323]/12 text-left font-medium text-[#666662]">
                        <th className="py-2.5 px-4">Waktu (UTC)</th>
                        <th className="py-2.5 px-4">Aktor</th>
                        <th className="py-2.5 px-4">Aksi</th>
                        <th className="py-2.5 px-4">Entitas &amp; ID</th>
                        <th className="py-2.5 px-4">Snapshot Perubahan (Before / After)</th>
                        <th className="py-2.5 px-4">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232323]/10">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#f6f6f4]">
                          <td className="py-2.5 px-4 font-mono whitespace-nowrap text-[#666662]">
                            {log.occurred_at}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-[#232323]">
                            {log.user_name}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded-[4px] bg-[#efefec] text-[#232323] border border-[#232323]/15 font-mono font-medium">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono">
                            {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ""}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-[#666662] max-w-md truncate">
                            {log.new_values || log.old_values || "-"}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[#666662]">
                            {log.ip_address}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Tambah User Baru */}
            {newUserModal && (
              <div className="fixed inset-0 z-50 bg-[#232323]/60 flex items-center justify-center p-4">
                <div className="taste-card bg-white max-w-md w-full p-6 space-y-4">
                  <h3 className="font-display text-base font-medium text-[#232323]">
                    Tambah Akun Karyawan Gudang Baru (FR-02)
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <label className="block text-[13px] font-medium text-[#232323] mb-1">
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className="w-full px-3 py-2 border border-[#232323]/25"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-[#232323] mb-1">
                        Email Login
                      </label>
                      <input
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-[#232323]/25"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-[#232323] mb-1">
                        Peran Pengguna
                      </label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value)}
                        className="w-full px-3 py-2 border border-[#232323]/25 font-medium"
                      >
                        <option value="PETUGAS">PETUGAS (Petugas Gudang / Bruder)</option>
                        <option value="KEPALA_GUDANG">
                          KEPALA_GUDANG (Kepala Gudang / Purchasing)
                        </option>
                        <option value="ADMIN">ADMIN (Administrator Penuh)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-[#232323] mb-1">
                        Kata Sandi Sementara (Min. 10 Karakter)
                      </label>
                      <input
                        type="text"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-[#232323]/25 font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setNewUserModal(false)}
                      className="btn btn--secondary px-4 py-2 text-xs"
                    >
                      Batal
                    </button>
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/masters", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "create_user",
                            name: newUserName,
                            email: newUserEmail,
                            role: newUserRole,
                            password: newUserPassword,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setAdminFeedback({ type: "error", text: data.error });
                        } else {
                          setAdminFeedback({ type: "success", text: data.message });
                          setNewUserModal(false);
                          setNewUserName("");
                          setNewUserEmail("");
                          await fetchAllData();
                        }
                      }}
                      className="btn btn--primary px-4 py-2 text-xs"
                    >
                      Simpan Pengguna
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Ganti Password Sendiri / Wajib Ganti Password Pertama (FR-01 & FR-02) */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-[#232323]/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleChangePassword}
            className="taste-card bg-white max-w-md w-full p-6 space-y-4"
          >
            <h3 className="font-display text-base font-medium text-[#232323]">
              {user.mustChangePassword
                ? "Wajib Ganti Kata Sandi Sementara (FR-02)"
                : "Ganti Kata Sandi Akun (FR-01)"}
            </h3>
            {pwdFeedback && (
              <div className="p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {pwdFeedback}
              </div>
            )}
            <div>
              <label className="block text-[13px] font-medium text-[#232323] mb-1">
                Kata Sandi Saat Ini
              </label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 border border-[#232323]/25 text-sm"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#232323] mb-1">
                Kata Sandi Baru (Minimal 10 Karakter)
              </label>
              <input
                type="password"
                required
                minLength={10}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-[#232323]/25 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              {!user.mustChangePassword && (
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="btn btn--secondary px-4 py-2 text-xs"
                >
                  Batal
                </button>
              )}
              <button type="submit" className="btn btn--primary px-4 py-2 text-xs">
                Simpan Kata Sandi Baru
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
