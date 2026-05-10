"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "@/lib/api";

type LoginRole = "USER" | "OWNER" | "ADMIN";

const roleConfig = {
  USER: {
    label: "User",
    title: "User Login",
    description: "Book courts, manage bookings, and view your wallet.",
    redirect: "/"
  },
  OWNER: {
    label: "Owner",
    title: "Owner Login",
    description: "Manage courts, slots, bookings, and revenue.",
    redirect: "/owner/dashboard"
  },
  ADMIN: {
    label: "Admin",
    title: "Admin Login",
    description: "Manage users, courts, approvals, and platform settings.",
    redirect: "/admin/dashboard"
  }
} satisfies Record<
  LoginRole,
  {
    label: string;
    title: string;
    description: string;
    redirect: string;
  }
>;

export default function LoginPage() {
  const router = useRouter();

  const [selectedRole, setSelectedRole] = useState<LoginRole>("USER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const currentRole = roleConfig[selectedRole];

  useEffect(() => {
    setError("");
  }, [selectedRole]);

  function selectRole(role: LoginRole) {
    setSelectedRole(role);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      if (!email.trim()) {
        throw new Error("Email is required");
      }

      if (!password.trim()) {
        throw new Error("Password is required");
      }

      const data = await loginUser({
        email: email.trim(),
        password,
        expectedRole: selectedRole
      });

      const token = data.data?.token;
      const user = data.data?.user;

      if (!token) {
        throw new Error("Login success but token missing from backend response");
      }

      if (!user) {
        throw new Error("Login success but user data missing from backend response");
      }

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      router.push(currentRole.redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">
            Login
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
            Login to Badminton Court Booking Platform
          </h1>

          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Choose your login type to continue
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
          {(Object.keys(roleConfig) as LoginRole[]).map((role) => {
            const item = roleConfig[role];
            const active = selectedRole === role;

            return (
              <button
                key={role}
                type="button"
                onClick={() => selectRole(role)}
                className={`min-h-24 rounded-lg border p-4 text-left transition hover:shadow-lg sm:p-5 ${
                  active
                    ? "border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-500/20 dark:bg-emerald-950/30"
                    : "border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700"
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-bold">{item.label}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      active
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {active ? "Selected" : "Choose"}
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mx-auto mt-8 w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <h2 className="text-2xl font-bold">{currentRole.title}</h2>

          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {currentRole.description}
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Enter email"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Logging in..." : `Login as ${currentRole.label}`}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-600 dark:text-slate-300">
            New here? <a className="font-semibold text-emerald-600 dark:text-emerald-400" href="/signup">Create an account</a>
          </p>
        </div>
      </div>
    </section>
  );
}
