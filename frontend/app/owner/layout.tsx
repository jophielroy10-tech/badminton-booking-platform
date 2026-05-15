"use client";

import DashboardLayoutShell from "@/src/components/dashboard/DashboardLayoutShell";
import { ownerMenu } from "@/src/config/ownerMenu";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayoutShell menuItems={ownerMenu} role="OWNER" brandLabel="Owner Console">
      {children}
    </DashboardLayoutShell>
  );
}
