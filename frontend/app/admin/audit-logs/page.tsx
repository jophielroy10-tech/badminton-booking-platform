"use client";

import { useEffect, useState } from "react";
import { getAdminAuditLogs } from "@/lib/api";
import BackButton from "@/components/ui/BackButton";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    getAdminAuditLogs().then((response) => setLogs((response.data as any[]) ?? [])).catch(() => setLogs([]));
  }, []);

  return (
    <main className="page-shell">
      <BackButton fallback="/admin/dashboard" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Admin Audit Logs</h1>
      <div className="mt-6 space-y-3">
        {logs.map((log) => (
          <article key={log.id} className="surface-card">
            <p className="font-semibold text-slate-950 dark:text-white">{log.action}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{log.entity} · {log.entityId ?? "system"} · {new Date(log.createdAt).toLocaleString()}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
