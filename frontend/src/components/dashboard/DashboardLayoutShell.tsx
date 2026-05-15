"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UserCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DashboardSidebar from "./DashboardSidebar";
import type { DashboardMenuItem } from "@/src/config/dashboardMenuTypes";

type DashboardRole = "OWNER" | "ADMIN";

type DashboardLayoutShellProps = {
  children: React.ReactNode;
  menuItems: DashboardMenuItem[];
  role: DashboardRole;
  brandLabel: string;
};

type StoredUser = {
  name?: string;
  email?: string;
  role?: string;
};

function readStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

function findPageTitle(menuItems: DashboardMenuItem[], pathname: string) {
  for (const item of menuItems) {
    const child = item.children?.find((entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`));
    if (child) return child.title;
    if (item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))) return item.title;
  }
  return "Dashboard";
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/";
}

export default function DashboardLayoutShell({ children, menuItems, role, brandLabel }: DashboardLayoutShellProps) {
  const pathname = usePathname();
  const [authState, setAuthState] = useState<"checking" | "ready" | "login" | "denied">("checking");
  const [user, setUser] = useState<StoredUser | null>(null);
  const pageTitle = useMemo(() => findPageTitle(menuItems, pathname), [menuItems, pathname]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = readStoredUser();
    setUser(storedUser);

    if (!token) {
      setAuthState("login");
      return;
    }

    setAuthState(storedUser?.role === role ? "ready" : "denied");
  }, [role]);

  if (authState === "checking") {
    return <main className="page-shell"><p className="surface-card text-slate-600 dark:text-slate-300">Loading dashboard...</p></main>;
  }

  if (authState === "login") {
    return (
      <main className="page-shell">
        <div className="surface-card">
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Login required</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Please login with a {role.toLowerCase()} account to open this dashboard.</p>
          <Link href="/login" className="btn-primary mt-4">Login</Link>
        </div>
      </main>
    );
  }

  if (authState === "denied") {
    return (
      <main className="page-shell">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          <h1 className="text-2xl font-bold">Access denied</h1>
          <p className="mt-2">This area is only available to {role.toLowerCase()} accounts.</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <DashboardSidebar menuItems={menuItems} brandLabel={brandLabel} />
      <div className="lg:pl-72">
        <header className="sticky top-14 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 pl-20 sm:px-6 lg:px-8 lg:pl-8">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400">{role.toLowerCase()} dashboard</p>
              <h1 className="truncate text-xl font-bold text-slate-950 dark:text-white">{pageTitle}</h1>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <div className="hidden min-w-0 text-right sm:block">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user?.name ?? role}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email ?? ""}</p>
              </div>
              <UserCircle className="hidden h-8 w-8 shrink-0 text-slate-400 sm:block" />
              <button type="button" className="btn-secondary px-3" onClick={logout} aria-label="Logout">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
