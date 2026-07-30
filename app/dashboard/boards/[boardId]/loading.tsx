export default function BoardLoading() {
  return (
    <main className="flex flex-1 animate-pulse flex-col gap-4 overflow-hidden bg-[#8b91a0] px-4 py-4 pb-24 sm:px-6">
      <div className="h-[3.75rem] rounded-2xl bg-white/80" />
      <div className="flex gap-4 overflow-hidden">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-[32rem] w-[min(84vw,19rem)] shrink-0 rounded-2xl bg-white/60 sm:w-80"
          />
        ))}
      </div>
    </main>
  );
}
