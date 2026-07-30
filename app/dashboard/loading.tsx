export default function DashboardLoading() {
  return (
    <main
      className="mx-auto w-full max-w-[1600px] flex-1 animate-pulse px-4 py-4 pb-28 sm:px-6"
      aria-label="Loading boards"
    >
      <div className="h-[3.75rem] rounded-2xl bg-white shadow-sm" />
      <div className="mt-6 h-9 w-52 rounded-lg bg-slate-200" />
      <div className="mt-3 h-5 w-80 max-w-full rounded bg-slate-200" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-48 rounded-2xl bg-white shadow-sm" />
        ))}
      </div>
    </main>
  );
}
