import type { Metadata } from "next";
import { requireCurrentUser } from "@/app/lib/dal/auth";
import { listBoards } from "@/app/lib/dal/boards";
import { BoardOverview } from "./_components/board-overview";
import { GlobalHeader } from "./_components/global-header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boards",
};

export default async function DashboardPage() {
  const [boards, user] = await Promise.all([listBoards(), requireCurrentUser()]);

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-4 py-4 pb-28 sm:px-6">
      <GlobalHeader
        user={user}
        title="All Boards"
        count={boards.length}
      />
      {/* Wrapped so the overview keeps its own internal spacing under the
          header rather than inheriting the flex gap between every section. */}
      <div>
        <BoardOverview initialBoards={boards} />
      </div>
    </main>
  );
}
