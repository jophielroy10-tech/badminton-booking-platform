export default function FindPlayerPage() {
  return (
    <main className="page-shell">
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Find Players</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Discover nearby players and build your next badminton match.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {["Morning doubles", "Weekend rally", "Beginner friendly"].map((title) => (
          <article key={title} className="surface-card">
            <h2 className="font-semibold text-slate-950 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Open group · Bengaluru · 2 spots available</p>
          </article>
        ))}
      </div>
    </main>
  );
}
