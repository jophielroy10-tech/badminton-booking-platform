"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { signupUser } from "@/lib/api";
import { isStrongPassword, strongPasswordMessage } from "@/lib/password";

type SignupRole = "USER" | "OWNER";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", role: "USER" as SignupRole });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");

    if (!isStrongPassword(form.password)) {
      setMessage(strongPasswordMessage);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const data = await signupUser({ name: form.name, email: form.email, password: form.password, role: form.role });
      const token = data.data?.token;
      const user = data.data?.user;

      if (!token || !user) throw new Error("Signup success but session data is missing");

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      router.push(user.role === "OWNER" ? "/owner/dashboard" : "/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-shell flex items-start justify-center">
      <div className="w-full max-w-md">
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Create account</h1>
        <div className="grid grid-cols-2 gap-2">
          {(["USER", "OWNER"] as SignupRole[]).map((role) => (
            <button key={role} type="button" onClick={() => setForm({ ...form, role })} className={form.role === role ? "btn-primary" : "btn-secondary"}>
              {role === "USER" ? "User" : "Owner"}
            </button>
          ))}
        </div>
        <input className="field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="field" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="field" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <input className="field" type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
        <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">{strongPasswordMessage}</p>
        {message && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{message}</p>}
        <button className="btn-primary w-full" disabled={loading}><UserPlus className="h-4 w-4" /> {loading ? "Creating..." : `Sign up as ${form.role === "OWNER" ? "Owner" : "User"}`}</button>
        <p className="text-center text-sm text-slate-600 dark:text-slate-300">Already registered? <Link className="font-semibold text-emerald-600 dark:text-emerald-400" href="/login">Login</Link></p>
      </form>
      </div>
    </main>
  );
}
