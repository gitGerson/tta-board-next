import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/app/lib/dal/auth";
import {
  getBoard,
  getCardDetails,
} from "@/app/lib/dal/boards";
import { NotFoundError } from "@/app/lib/dal/errors";
import { listAssignableUsers } from "@/app/lib/dal/users";
import { GlobalHeader } from "@/app/dashboard/_components/global-header";
import { KanbanBoard } from "./kanban-board";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ boardId: string }>;
}): Promise<Metadata> {
  try {
    const board = await getBoard((await params).boardId);
    return { title: board.name };
  } catch {
    return { title: "Board" };
  }
}

async function loadBoardPageData(boardId: string) {
  try {
    const [board, users, currentUser] = await Promise.all([
      getBoard(boardId),
      listAssignableUsers(),
      requireCurrentUser(),
    ]);

    return { board, users, currentUser };
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }
}

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ card?: string }>;
}) {
  const { boardId } = await params;
  const { card: cardId } = await searchParams;
  const { board, users, currentUser } = await loadBoardPageData(boardId);

  const selectedCard = cardId
    ? await getCardDetails(board.id, cardId)
    : null;

  const totalCards = board.columns.reduce(
    (total, column) => total + column.cards.length,
    0,
  );

  return (
    <main className="flex flex-1 flex-col gap-4 overflow-hidden bg-[#8b91a0] px-4 py-4 pb-24 sm:px-6">
      <GlobalHeader
        user={currentUser}
        title={board.name}
        count={totalCards}
        subtitle={board.description}
      />
      <KanbanBoard
        initialBoard={board}
        users={users}
        currentUser={currentUser}
        selectedCard={selectedCard}
        requestedCardMissing={Boolean(cardId && !selectedCard)}
      />
    </main>
  );
}
