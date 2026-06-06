"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2,
  Search,
  Download,
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Filter,
  ArrowUpDown,
  Phone,
  MessageSquare,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type {
  AdminStats,
  AdminComplaintsPage,
  AdminComplaintDetail,
  AdminNoteItem,
  ComplaintStatus,
} from "@/lib/api";
import { cn } from "@/lib/utils";

// --- KPI Card ---
function KPICard({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  colorClass: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/60 bg-white/55 p-5 shadow-glass-soft backdrop-blur-sm">
      <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", colorClass)}>
        <Icon className="size-6" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-ink-900 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// --- Status Badge ---
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  under_review: "bg-blue-100 text-blue-800 border-blue-200",
  escalated: "bg-red-100 text-red-800 border-red-200",
  resolved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-gray-100 text-gray-600 border-gray-200",
  intake_in_progress: "bg-amber-100 text-amber-800 border-amber-200",
  evidence_under_review: "bg-blue-100 text-blue-800 border-blue-200",
};

function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  const color = STATUS_COLORS[status] || "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize", color)}>
      {label}
    </span>
  );
}

// --- Status Update Dropdown ---
const STATUS_OPTIONS: { value: ComplaintStatus; label: string; color: string }[] = [
  { value: "pending", label: "Pending", color: "bg-amber-100" },
  { value: "under_review", label: "Under Review", color: "bg-blue-100" },
  { value: "escalated", label: "Escalated", color: "bg-red-100" },
  { value: "resolved", label: "Resolved", color: "bg-green-100" },
  { value: "rejected", label: "Rejected", color: "bg-gray-100" },
];

function StatusDropdown({
  current,
  isSuperAdmin,
  onUpdate,
  disabled,
}: {
  current: string;
  isSuperAdmin: boolean;
  onUpdate: (status: ComplaintStatus) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUS_OPTIONS.map((opt) => {
        const isCurrent = current === opt.value;
        const isResolved = opt.value === "resolved";
        const cantClick = disabled || (isResolved && !isSuperAdmin) || isCurrent;
        return (
          <button
            key={opt.value}
            onClick={() => !cantClick && onUpdate(opt.value)}
            disabled={cantClick}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all",
              isCurrent
                ? "border-sky-300 bg-sky-100 text-sky-800"
                : cantClick
                  ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
                  : "border-gray-200 bg-white text-ink-700 hover:border-sky-300 hover:bg-sky-50",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// --- Complaint Detail Drawer ---
function ComplaintDrawer({
  complaintId,
  open,
  onClose,
  isSuperAdmin,
}: {
  complaintId: string | null;
  open: boolean;
  onClose: () => void;
  isSuperAdmin: boolean;
}) {
  const [detail, setDetail] = useState<AdminComplaintDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!complaintId) return;
    setLoading(true);
    try {
      const data = await api.adminComplaintDetail(complaintId);
      setDetail(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    if (open && complaintId) fetchDetail();
  }, [open, complaintId, fetchDetail]);

  const handleStatusUpdate = async (status: ComplaintStatus) => {
    if (!complaintId) return;
    try {
      const result = await api.adminUpdateStatus(complaintId, status);
      setDetail((prev) => (prev ? { ...prev, status: result.new_status } : prev));
    } catch {
      // ignore
    }
  };

  const handleAddNote = async () => {
    if (!complaintId || !noteText.trim()) return;
    setAddingNote(true);
    try {
      const result = await api.adminAddNote(complaintId, noteText.trim());
      setDetail((prev) =>
        prev ? { ...prev, notes: [result.note, ...prev.notes] } : prev,
      );
      setNoteText("");
    } catch {
      // ignore
    } finally {
      setAddingNote(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl border-l border-white/60 bg-white/95 shadow-glass-strong backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/60 px-6 py-4">
        <div>
          <h3 className="text-lg font-bold text-ink-900">
            Complaint #{complaintId?.slice(-8)}
          </h3>
          {detail && (
            <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
              <StatusBadge status={detail.status} />
              <span>•</span>
              <span>{detail.pipeline.replace(/_/g, " ")}</span>
            </div>
          )}
        </div>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-gray-100" aria-label="Close">
          <X className="size-5" />
        </button>
      </div>

      {/* Content */}
      <div className="h-[calc(100vh-73px)] overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-ink-300" />
          </div>
        ) : detail ? (
          <div className="space-y-6">
            {/* Status Actions */}
            <div className="rounded-2xl border border-white/60 bg-white/55 p-4">
              <h4 className="mb-2 text-sm font-semibold text-ink-700">Update Status</h4>
              <StatusDropdown
                current={detail.status}
                isSuperAdmin={isSuperAdmin}
                onUpdate={handleStatusUpdate}
                disabled={false}
              />
            </div>

            {/* Personal Info */}
            <div className="rounded-2xl border border-white/60 bg-white/55 p-4">
              <h4 className="mb-3 text-sm font-semibold text-ink-700">Personal Info</h4>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-ink-500">Name</dt>
                <dd className="text-ink-900">{detail.victim_name}</dd>
                <dt className="text-ink-500">Contact</dt>
                <dd className="text-ink-900">{detail.contact}</dd>
                <dt className="text-ink-500">State</dt>
                <dd className="text-ink-900">{detail.state}</dd>
                <dt className="text-ink-500">District</dt>
                <dd className="text-ink-900">{detail.district}</dd>
              </dl>
            </div>

            {/* Complaint */}
            <div className="rounded-2xl border border-white/60 bg-white/55 p-4">
              <h4 className="mb-3 text-sm font-semibold text-ink-700">Complaint Details</h4>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-ink-500">Fraud Type</dt>
                <dd className="text-ink-900 capitalize">{detail.fraud_type.replace(/_/g, " ")}</dd>
                <dt className="text-ink-500">Platform</dt>
                <dd className="text-ink-900">{detail.platform_used || "N/A"}</dd>
                <dt className="text-ink-500">Amount</dt>
                <dd className="font-semibold text-ink-900">₹{detail.amount.toLocaleString("en-IN")}</dd>
                <dt className="text-ink-500">Severity</dt>
                <dd className="text-ink-900 capitalize">{detail.severity}</dd>
                <dt className="text-ink-500">Pipeline</dt>
                <dd className="text-ink-900 capitalize">{detail.pipeline.replace(/_/g, " ")}</dd>
                <dt className="text-ink-500">Filed At</dt>
                <dd className="text-ink-900">
                  {new Date(detail.filed_at).toLocaleString("en-IN")}
                </dd>
              </dl>
              {detail.description && (
                <div className="mt-3">
                  <dt className="mb-1 text-sm text-ink-500">Description</dt>
                  <dd className="rounded-xl bg-gray-50 p-3 text-sm text-ink-800">{detail.description}</dd>
                </div>
              )}
            </div>

            {/* Evidence */}
            {detail.evidence_items.length > 0 && (
              <div className="rounded-2xl border border-white/60 bg-white/55 p-4">
                <h4 className="mb-3 text-sm font-semibold text-ink-700">
                  Evidence ({detail.evidence_items.length})
                </h4>
                <div className="space-y-2">
                  {detail.evidence_items.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {ev.kind}
                        </Badge>
                        {ev.extracted_fields &&
                          Object.entries(ev.extracted_fields).map(([k, v]) =>
                            v ? (
                              <span key={k} className="text-ink-500">
                                {k}: <span className="font-mono text-ink-800">{String(v)}</span>
                              </span>
                            ) : null,
                          )}
                      </div>
                      {ev.redacted_text && (
                        <p className="text-ink-600 line-clamp-3">{ev.redacted_text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cluster */}
            {detail.cluster_id && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <AlertCircle className="size-4" />
                  Part of Cluster
                </h4>
                <p className="text-xs text-amber-700">
                  Cluster ID: {detail.cluster_id}
                  {detail.cluster_report_count !== null && (
                    <> • {detail.cluster_report_count} related complaints</>
                  )}
                </p>
              </div>
            )}

            {/* Officer Notes */}
            <div className="rounded-2xl border border-white/60 bg-white/55 p-4">
              <h4 className="mb-3 text-sm font-semibold text-ink-700">
                Officer Notes ({detail.notes.length})
              </h4>
              {/* Add note */}
              <div className="mb-3 flex gap-2">
                <Input
                  placeholder="Add investigation note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="h-10 flex-1 rounded-xl text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={addingNote || !noteText.trim()}
                  className="h-10 rounded-xl"
                >
                  {addingNote ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <MessageSquare className="size-4" />
                  )}
                </Button>
              </div>

              {/* Notes list */}
              <div className="space-y-2">
                {detail.notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xl border border-gray-100 bg-gray-50/70 p-3"
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs text-ink-500">
                      <Shield className="size-3" />
                      <span className="font-medium">{note.officer_name}</span>
                      <span>•</span>
                      <span>{new Date(note.timestamp).toLocaleString("en-IN")}</span>
                    </div>
                    <p className="text-sm text-ink-800">{note.note}</p>
                  </div>
                ))}
                {detail.notes.length === 0 && (
                  <p className="py-4 text-center text-xs text-ink-400">No notes yet.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="py-20 text-center text-sm text-ink-400">Failed to load complaint.</p>
        )}
      </div>
    </div>
  );
}

// --- Main Dashboard Page ---
export default function AdminDashboardPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [complaintsData, setComplaintsData] = useState<AdminComplaintsPage | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedComplaint, setSelectedComplaint] = useState<string | null>(null);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // Check auth on mount
  useEffect(() => {
    api.adminMe()
      .then((user) => {
        setIsLoggedIn(true);
        setAdminName(user.name);
        setAdminRole(user.role);
      })
      .catch(() => {
        setIsLoggedIn(false);
      })
      .finally(() => setCheckingAuth(false));
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        api.adminStats(),
        api.adminComplaints({
          page,
          page_size: 20,
          search: search || undefined,
          status: statusFilter || undefined,
          urgency: urgencyFilter || undefined,
        }),
      ]);
      setStats(s);
      setComplaintsData(c);
      setFetchError("");
    } catch {
      setFetchError("Failed to load data. Check console for details.");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, urgencyFilter]);

  useEffect(() => {
    if (isLoggedIn) fetchData();
  }, [isLoggedIn, fetchData]);

  const handleLogout = async () => {
    try {
      await api.adminLogout();
    } catch {
      // ignore
    }
    setIsLoggedIn(false);
    setAdminName("");
    setAdminRole("");
  };

  const handleLoginSuccess = (name: string, role: string) => {
    setIsLoggedIn(true);
    setAdminName(name);
    setAdminRole(role);
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-ink-300" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
          <ShieldCheck className="size-8" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-ink-900">Authority Access</h2>
          <p className="mt-1 text-sm text-ink-500">
            CyberSaathi Police Admin Portal — authorised personnel only.
          </p>
        </div>

        {/* Inline login form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const officerId = (form.elements.namedItem("officer_id") as HTMLInputElement).value.trim();
            const password = (form.elements.namedItem("password") as HTMLInputElement).value;
            if (!officerId || !password) return;
            setLoginError("");
            setLoginLoading(true);
            try {
              const result = await api.adminLogin({ officer_id: officerId, password });
              if (result.success) {
                handleLoginSuccess(result.name, result.role);
              }
            } catch {
              setLoginError("Invalid credentials. Access attempt logged.");
            } finally {
              setLoginLoading(false);
            }
          }}
          className="w-full max-w-sm space-y-4 rounded-2xl border border-white/60 bg-white/70 p-6 shadow-glass-soft"
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink-700">Officer ID</label>
            <input
              name="officer_id"
              type="text"
              placeholder="e.g. admin"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              autoComplete="username"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink-700">Password</label>
            <input
              name="password"
              type="password"
              placeholder="Enter password"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              autoComplete="current-password"
            />
          </div>
          {loginError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {loginError}
            </div>
          )}
          <button
            type="submit"
            disabled={loginLoading}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-sky-700 font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-50"
          >
            {loginLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              "Access Portal"
            )}
          </button>
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-3 text-center">
            <p className="text-xs font-medium text-ink-600">Demo Credentials</p>
            <p className="mt-1 text-xs text-ink-500">
              Super Admin:{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">admin</code>
              {" / "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">admin</code>
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              Field Officer:{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">officer</code>
              {" / "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">officer</code>
            </p>
          </div>
          <p className="text-center text-[11px] text-ink-400">
            All access is logged and audited.
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Police Authority Dashboard</h1>
          <p className="text-sm text-ink-500">
            Welcome, {adminName} ({adminRole.replace("_", " ")})
          </p>
        </div>
        <div className="flex items-center gap-2">
          {adminRole === "super_admin" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => api.adminExportCsv({
                search: search || undefined,
                status: statusFilter || undefined,
              })}
              className="h-10 rounded-xl"
            >
              <Download className="mr-1.5 size-4" />
              Export CSV
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="h-10 rounded-xl text-red-600 hover:bg-red-50"
          >
            <LogOut className="mr-1.5 size-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {fetchError}
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            icon={FileText}
            label="Total Complaints"
            value={stats.total_complaints}
            colorClass="bg-sky-100 text-sky-700"
          />
          <KPICard
            icon={AlertCircle}
            label="Pending / Unresolved"
            value={stats.pending_unresolved}
            colorClass="bg-amber-100 text-amber-700"
          />
          <KPICard
            icon={CheckCircle2}
            label="Resolved This Week"
            value={stats.resolved_this_week}
            colorClass="bg-green-100 text-green-700"
          />
          <KPICard
            icon={Clock}
            label="Golden Hour Cases"
            value={stats.golden_hour_cases}
            colorClass="bg-red-100 text-red-700"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <Input
            placeholder="Search by name, phone, UPI ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under Review</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={urgencyFilter}
          onChange={(e) => {
            setUrgencyFilter(e.target.value);
            setPage(1);
          }}
          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
        >
          <option value="">All Urgency</option>
          <option value="golden_hour">Golden Hour</option>
          <option value="post">Post Golden Hour</option>
        </select>

        {/* Active filter chips */}
        {(statusFilter || urgencyFilter || search) && (
          <button
            onClick={() => {
              setStatusFilter("");
              setUrgencyFilter("");
              setSearch("");
              setPage(1);
            }}
            className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-gray-200"
          >
            <X className="size-3" />
            Clear Filters
          </button>
        )}
      </div>

      {/* Complaints Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/55 shadow-glass-soft backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-ink-300" />
          </div>
        ) : complaintsData && complaintsData.complaints.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Fraud Type</th>
                  <th className="px-5 py-3">Amount Lost</th>
                  <th className="px-5 py-3">Urgency</th>
                  <th className="px-5 py-3">Filed At</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {complaintsData.complaints.map((c) => (
                  <tr
                    key={c.id}
                    className="group cursor-pointer transition-colors hover:bg-sky-50/50"
                    onClick={() => setSelectedComplaint(c.id)}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-ink-500">
                      #{c.id.slice(-8)}
                    </td>
                    <td className="px-5 py-3 capitalize text-ink-800">
                      {c.fraud_type.replace(/_/g, " ")}
                    </td>
                    <td className="px-5 py-3 font-semibold text-ink-900 tabular-nums">
                      ₹{c.amount_lost.toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          c.urgency === "Golden Hour"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-ink-600",
                        )}
                      >
                        {c.pipeline === "golden_hour" && (
                          <Clock className="mr-1 size-3" />
                        )}
                        {c.urgency}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-500">
                      {new Date(c.filed_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-lg text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedComplaint(c.id);
                        }}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <p className="text-xs text-ink-500">
                Showing {(complaintsData.page - 1) * complaintsData.page_size + 1}–
                {Math.min(
                  complaintsData.page * complaintsData.page_size,
                  complaintsData.total,
                )}{" "}
                of {complaintsData.total}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="h-8 w-8 rounded-lg p-0"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                {Array.from({ length: Math.min(complaintsData.total_pages, 5) }, (_, i) => {
                  const start = Math.max(
                    1,
                    Math.min(
                      page - 2,
                      complaintsData.total_pages - 4,
                    ),
                  );
                  const p = start + i;
                  if (p > complaintsData.total_pages) return null;
                  return (
                    <Button
                      key={p}
                      size="sm"
                      variant={p === page ? "default" : "outline"}
                      onClick={() => setPage(p)}
                      className={cn(
                        "h-8 w-8 rounded-lg p-0 text-xs",
                        p === page
                          ? "bg-sky-700 text-white"
                          : "",
                      )}
                    >
                      {p}
                    </Button>
                  );
                })}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= complaintsData.total_pages}
                  onClick={() => setPage(page + 1)}
                  className="h-8 w-8 rounded-lg p-0"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="mb-3 size-10 text-ink-300" />
            <p className="text-sm font-medium text-ink-500">No complaints found</p>
            <p className="text-xs text-ink-400">Try adjusting your filters.</p>
          </div>
        )}
      </div>

      {/* Complaint Detail Drawer */}
      <ComplaintDrawer
        complaintId={selectedComplaint}
        open={selectedComplaint !== null}
        onClose={() => setSelectedComplaint(null)}
        isSuperAdmin={adminRole === "super_admin"}
      />
    </div>
  );
}
