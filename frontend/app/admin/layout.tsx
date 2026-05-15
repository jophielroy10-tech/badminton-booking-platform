"use client";

import DashboardLayoutShell from "@/src/components/dashboard/DashboardLayoutShell";
import { adminMenu } from "@/src/config/adminMenu";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayoutShell menuItems={adminMenu} role="ADMIN" brandLabel="Admin Console">
      {children}
    </DashboardLayoutShell>
  );
}
