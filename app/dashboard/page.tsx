import type { Metadata } from "next";
import { listBoards } from "@/app/lib/dal/boards";
import { BoardOverview } from "./_components/board-overview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boards",
};

export default async function DashboardPage() {
  const boards = await listBoards();

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10">
      <BoardOverview initialBoards={boards} />
    </main>
  );
}
