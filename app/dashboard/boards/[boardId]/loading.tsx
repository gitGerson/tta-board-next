export default function BoardLoading() {
  return (
    <main className="animate-pulse px-4 py-6 sm:px-6">
      <div className="h-8 w-64 rounded bg-slate-200" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-slate-200" />
      <div className="mt-7 flex gap-4 overflow-hidden">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-[36rem] w-72 shrink-0 rounded-2xl bg-slate-200" />
        ))}
      </div>
    </main>
  );
}
