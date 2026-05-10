"use client";

import { useEffect, useMemo, useState } from "react";
import BackButton from "@/components/ui/BackButton";
import { BookingCardSkeleton } from "@/components/ui/Skeleton";
import { getAdminActivity, getAdminActivitySummary, type ActivitySummary, type AuditActivity, type UserRole } from "@/lib/api";

const actionOptions = [
  "USER_LOGIN",
  "OWNER_LOGIN",
  "ADMIN_LOGIN",
  "WEBSITE_ENTERED",
  "USER_VIEWED_COURTS",
  "USER_VIEWED_COURT_DETAILS",
  "USER_STARTED_BOOKING",
  "BOOKING_HOLD_CREATED",
  "BOOKING_CONFIRMED",
  "BOOKING_CANCELLED",
  "PAYMENT_ORDER_CREATED",
  "PAYMENT_VERIFIED",
  "PAYMENT_FAILED",
  "REFUND_INITIATED",
  "OWNER_CREATED_COURT",
  "OWNER_UPDATED_COURT",
  "OWNER_UPLOADED_COURT_IMAGE",
  "OWNER_CHANGED_COURT_STATUS",
  "OWNER_VIEWED_BOOKINGS",
  "OWNER_CHECKED_IN_USER",
  "ADMIN_APPROVED_COURT",
  "ADMIN_REJECTED_COURT",
  "ADMIN_DELETED_USER",
  "ADMIN_DELETED_OWNER",
  "ADMIN_DELETED_COURT",
  "ADMIN_RESET_USER_PASSWORD",
  "ADMIN_CHANGED_USER_STATUS",
  "WEBHOOK_PAYMENT_CAPTURED",
  "WEBHOOK_PAYMENT_FAILED",
  "WEBHOOK_REFUND_PROCESSED"
];

const entityOptions = ["auth", "session", "court", "booking", "payment", "refund", "USER", "OWNER", "COURT", "system", "auditLog"];

type Filters = {
  role: "" | UserRole;
  action: string;
  entity: string;
  from: string;
  to: string;
  search: string;
};

export default function AdminActivityPage() {
  const [items, setItems] = useState<AuditActivity[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [filters, setFilters] = useState<Filters>({ role: "", action: "", entity: "", from: "", to: "", search: "" });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openMetadataId, setOpenMetadataId] = useState<string | null>(null);

  const query = useMemo(() => ({ ...filters, page, limit: 20 }), [filters, page]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [activityResponse, summaryResponse] = await Promise.all([getAdminActivity(query), getAdminActivitySummary()]);
      setItems(activityResponse.data?.items ?? []);
      setTotalPages(activityResponse.data?.pagination.totalPages ?? 1);
      setSummary(summaryResponse.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [query]);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setPage(1);
    setFilters({ role: "", action: "", entity: "", from: "", to: "", search: "" });
  }

  return (
    <main className="page-shell">
      <BackButton fallback="/admin/dashboard" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Platform Activity</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-300">Monitor user, owner, admin and system actions.</p>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Today Logins" value={summary?.todayLogins ?? 0} />
        <Stat label="User Logins" value={summary?.todayUserLogins ?? 0} />
        <Stat label="Owner Logins" value={summary?.todayOwnerLogins ?? 0} />
        <Stat label="Bookings Today" value={summary?.todayBookings ?? 0} />
        <Stat label="Payments Today" value={summary?.todayPayments ?? 0} />
        <Stat label="Owner Actions" value={summary?.todayOwnerActions ?? 0} />
        <Stat label="Admin Actions" value={summary?.todayAdminActions ?? 0} />
        <Stat label="Admin Logins" value={summary?.todayAdminLogins ?? 0} />
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input className="field" placeholder="Search user, email, action" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} />
          <select className="field" value={filters.role} onChange={(event) => updateFilter("role", event.target.value as Filters["role"])}>
            <option value="">All roles</option>
            <option value="USER">USER</option>
            <option value="OWNER">OWNER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <select className="field" value={filters.action} onChange={(event) => updateFilter("action", event.target.value)}>
            <option value="">All actions</option>
            {actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
          <select className="field" value={filters.entity} onChange={(event) => updateFilter("entity", event.target.value)}>
            <option value="">All entities</option>
            {entityOptions.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
          </select>
          <input className="field" type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} />
          <input className="field" type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} />
          <button className="btn-secondary" type="button" onClick={clearFilters}>Clear filters</button>
        </div>
      </section>

      {loading && <div className="mt-6 grid gap-4"><BookingCardSkeleton /><BookingCardSkeleton /><BookingCardSkeleton /></div>}
      {error && <p className="mt-6 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="mt-6 surface-card text-slate-600 dark:text-slate-300">No activity found</p>}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">IP Address</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {items.map((item) => (
                  <ActivityRow key={item.id} item={item} open={openMetadataId === item.id} onToggle={() => setOpenMetadataId(openMetadataId === item.id ? null : item.id)} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-4 lg:hidden">
            {items.map((item) => (
              <ActivityCard key={item.id} item={item} open={openMetadataId === item.id} onToggle={() => setOpenMetadataId(openMetadataId === item.id ? null : item.id)} />
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button className="btn-secondary w-full sm:w-auto" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>Previous</button>
            <span className="text-sm text-slate-600 dark:text-slate-300">Page {page} of {totalPages}</span>
            <button className="btn-secondary w-full sm:w-auto" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        </>
      )}
    </main>
  );
}

function ActivityRow({ item, open, onToggle }: { item: AuditActivity; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr>
        <td className="px-4 py-3 whitespace-nowrap">{new Date(item.createdAt).toLocaleString("en-IN")}</td>
        <td className="px-4 py-3"><p className="font-medium">{item.user?.name ?? "System"}</p><p className="text-xs text-slate-500">{item.user?.email ?? "-"}</p></td>
        <td className="px-4 py-3"><RoleBadge role={item.user?.role} /></td>
        <td className="px-4 py-3"><ActionBadge action={item.action} /></td>
        <td className="px-4 py-3">{item.entity}</td>
        <td className="px-4 py-3">{item.ipAddress ?? "-"}</td>
        <td className="px-4 py-3"><button className="text-sm font-semibold text-emerald-600" onClick={onToggle}>{open ? "Hide" : "Details"}</button></td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="bg-slate-50 px-4 py-3 dark:bg-slate-950">
            <pre className="whitespace-pre-wrap break-words text-xs text-slate-700 dark:text-slate-300">{JSON.stringify({ metadata: item.metadata ?? {}, userAgent: item.userAgent }, null, 2)}</pre>
          </td>
        </tr>
      )}
    </>
  );
}

function ActivityCard({ item, open, onToggle }: { item: AuditActivity; open: boolean; onToggle: () => void }) {
  return (
    <article className="surface-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <ActionBadge action={item.action} />
          <p className="mt-3 font-semibold text-slate-950 dark:text-white">{item.user?.name ?? "System"}</p>
          <p className="break-all text-sm text-slate-600 dark:text-slate-300">{item.user?.email ?? "-"}</p>
        </div>
        <RoleBadge role={item.user?.role} />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
        <p>Entity: <span className="font-semibold">{item.entity}</span></p>
        <p>IP: <span className="font-semibold">{item.ipAddress ?? "-"}</span></p>
        <p>{new Date(item.createdAt).toLocaleString("en-IN")}</p>
      </div>
      <button className="mt-4 text-sm font-semibold text-emerald-600" onClick={onToggle}>{open ? "Hide details" : "Show details"}</button>
      {open && <pre className="mt-3 whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs dark:bg-slate-950">{JSON.stringify({ metadata: item.metadata ?? {}, userAgent: item.userAgent }, null, 2)}</pre>}
    </article>
  );
}

function ActionBadge({ action }: { action: string }) {
  return <span className="inline-block max-w-full break-all rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{action}</span>;
}

function RoleBadge({ role }: { role?: UserRole }) {
  return <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{role ?? "SYSTEM"}</span>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="surface-card"><p className="text-sm text-slate-600 dark:text-slate-300">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</p></div>;
}
