import Link from "next/link";
import { CalendarCheck, Search, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const features: Array<{ title: string; text: string; Icon: LucideIcon }> = [
  { title: "OTP verified", text: "Every booking flow includes a development-friendly OTP check.", Icon: ShieldCheck },
  { title: "Conflict safe", text: "The backend blocks overlapping court slots before confirmation.", Icon: CalendarCheck },
  { title: "Role aware", text: "Users, owners, and admins each get focused dashboards.", Icon: Search }
];

export default function HomePage() {
  return (
    <main>
      <section className="bg-[linear-gradient(rgba(21,32,29,.62),rgba(21,32,29,.55)),url('https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center">
        <div className="mx-auto flex min-h-[460px] max-w-7xl flex-col justify-center px-4 py-12 text-white sm:min-h-[560px] sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-2xl space-y-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-shuttle">Badminton Court Booking Platform</p>
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl lg:text-6xl">Book clean, verified badminton courts in minutes.</h1>
            <p className="max-w-xl text-base text-white/90 sm:text-lg">Search courts, verify with OTP, pay through a mock checkout, and keep every booking organized in one place.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/courts" className="btn-primary w-full bg-emerald-500 text-white hover:bg-emerald-600 sm:w-auto"><Search className="h-4 w-4" /> Find courts</Link>
              <Link href="/signup" className="btn-secondary w-full border-white/60 bg-white/10 text-white hover:bg-white hover:text-slate-950 dark:bg-white/10 dark:text-white dark:hover:bg-white dark:hover:text-slate-950 sm:w-auto">Create account</Link>
            </div>
          </div>
        </div>
      </section>
      <section className="page-shell grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ title, text, Icon }) => (
          <div key={title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-5">
            <Icon className="mb-3 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-semibold text-slate-950 dark:text-white sm:text-lg">{title}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
