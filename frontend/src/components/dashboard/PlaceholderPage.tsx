type PlaceholderPageProps = {
  title: string;
  description: string;
};

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <main className="page-shell">
      <section className="surface-card">
        <p className="text-sm font-semibold uppercase text-emerald-600 dark:text-emerald-400">Coming soon</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{title}</h1>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">{description}</p>
        <p className="mt-6 rounded-md border border-dashed border-slate-300 p-4 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
          This dashboard section is ready in the navigation and will be connected to detailed data screens soon.
        </p>
      </section>
    </main>
  );
}
