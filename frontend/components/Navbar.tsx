"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut, Menu, ShieldCheck } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("token"));
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    window.location.href = "/";
  };

  const links = [
    ["Home", "/"],
    ["Courts", "/courts"],
    ["Find Players", "/find-player"],
    ["My Bookings", "/my-bookings"]
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-950 dark:text-white sm:text-base">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate">Badminton Booking</span>
        </Link>
        <div className="flex items-center gap-2 sm:hidden">
          <ThemeToggle />
          <button className="btn-secondary px-3" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation" aria-expanded={open}>
            <Menu className="h-4 w-4" />
          </button>
        </div>
        <div className="hidden min-w-0 items-center gap-1 sm:flex lg:gap-2">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="rounded-md px-2 py-2 text-xs font-medium text-slate-700 transition hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 md:text-sm lg:px-3">
              {label}
            </Link>
          ))}
          <ThemeToggle />
          {token ? (
            <button onClick={logout} className="btn-secondary">
              <LogOut className="h-4 w-4" /> Logout
            </button>
          ) : (
            <Link href="/login" className="btn-primary">Login / Signup</Link>
          )}
        </div>
      </nav>
      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:hidden">
          {links.map(([label, href]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="block min-h-11 rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400">
              {label}
            </Link>
          ))}
          {token ? <button onClick={logout} className="btn-secondary mt-2 w-full"><LogOut className="h-4 w-4" /> Logout</button> : <Link href="/login" className="btn-primary mt-2 w-full">Login / Signup</Link>}
        </div>
      )}
    </header>
  );
}
