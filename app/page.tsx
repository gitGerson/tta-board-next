import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth/session";
import { requireCurrentUser } from "@/app/lib/dal/auth";
import { listBoards } from "@/app/lib/dal/boards";
import { AuthenticatedShell } from "@/app/dashboard/_components/authenticated-shell";
import { BoardOverview } from "@/app/dashboard/_components/board-overview";
import { GlobalHeader } from "@/app/dashboard/_components/global-header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boards",
};

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [boards, user] = await Promise.all([listBoards(), requireCurrentUser()]);

  return (
    <AuthenticatedShell>
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-4 py-4 pb-28 sm:px-6">
        <GlobalHeader user={user} title="All Boards" count={boards.length} />
        <div>
          <BoardOverview initialBoards={boards} currentUserId={user.id} />
        </div>
      </main>
    </AuthenticatedShell>
  );
}
