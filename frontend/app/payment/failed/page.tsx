import Link from "next/link";
import BackButton from "@/components/ui/BackButton";

export default function PaymentFailedPage() {
  return (
    <main className="page-shell">
      <BackButton fallback="/courts" />
      <div className="surface-card">
        <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Payment Failed</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">The payment could not be completed. Please try again.</p>
        <Link href="/courts" className="btn-primary mt-4">Find Another Slot</Link>
      </div>
    </main>
  );
}
