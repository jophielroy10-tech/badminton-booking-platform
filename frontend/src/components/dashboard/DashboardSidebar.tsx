"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DashboardMenuItem } from "@/src/config/dashboardMenuTypes";

type DashboardSidebarProps = {
  menuItems: DashboardMenuItem[];
  brandLabel: string;
};

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function hasActiveChild(pathname: string, item: DashboardMenuItem) {
  return Boolean(item.href && isRouteActive(pathname, item.href)) || Boolean(item.children?.some((child) => isRouteActive(pathname, child.href)));
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/";
}

export default function DashboardSidebar({ menuItems, brandLabel }: DashboardSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const activeGroups = useMemo(
    () => menuItems.filter((item) => hasActiveChild(pathname, item)).map((item) => item.title),
    [menuItems, pathname]
  );

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      activeGroups.forEach((title) => {
        next[title] = true;
      });
      return next;
    });
  }, [activeGroups]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex min-h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-950 dark:text-white">{brandLabel}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Dashboard</p>
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-white lg:hidden"
          aria-label="Close dashboard menu"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const groupOpen = openGroups[item.title] ?? hasActiveChild(pathname, item);
            const groupActive = hasActiveChild(pathname, item);

            return (
              <div key={item.title}>
                <button
                  type="button"
                  className={`flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold ${
                    groupActive
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                  }`}
                  aria-expanded={groupOpen}
                  onClick={() => setOpenGroups((current) => ({ ...current, [item.title]: !groupOpen }))}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${groupOpen ? "rotate-180" : ""}`} />
                </button>

                {groupOpen && item.children && (
                  <div className="mt-1 space-y-1 pl-7">
                    {item.children.map((child) => {
                      const active = isRouteActive(pathname, child.href);
                      const isLogout = child.href === "/logout";

                      if (isLogout) {
                        return (
                          <button
                            key={child.href}
                            type="button"
                            onClick={logout}
                            className="block min-h-10 w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                          >
                            {child.title}
                          </button>
                        );
                      }

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`block min-h-10 rounded-md px-3 py-2 text-sm font-medium ${
                            active
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                          }`}
                        >
                          {child.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </aside>
  );

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-20 z-40 inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 lg:hidden"
        aria-label="Open dashboard menu"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block">{sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Close dashboard menu overlay"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full">{sidebar}</div>
        </div>
      )}
    </>
  );
}
