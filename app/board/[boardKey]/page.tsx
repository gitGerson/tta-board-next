import type { Metadata } from "next";
import { FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/app/lib/dal/auth";
import { getBoardByRouteKey, getCardDetails } from "@/app/lib/dal/boards";
import { NotFoundError } from "@/app/lib/dal/errors";
import { listPublishedFormOptions } from "@/app/lib/forms/form-dal";
import {
  listAssignableUsers,
  listMentionableUsers,
} from "@/app/lib/dal/users";
import { GlobalHeader } from "@/app/dashboard/_components/global-header";
import { KanbanBoard } from "@/app/dashboard/boards/[boardId]/kanban-board";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ boardKey: string }>;
}): Promise<Metadata> {
  try {
    const board = await getBoardByRouteKey((await params).boardKey);
    return { title: board.name };
  } catch {
    return { title: "Board" };
  }
}

async function loadBoardPageData(boardKey: string) {
  try {
    const [board, users, mentionableUsers, currentUser] = await Promise.all([
      getBoardByRouteKey(boardKey),
      listAssignableUsers(),
      listMentionableUsers(),
      requireCurrentUser(),
    ]);

    return { board, users, mentionableUsers, currentUser };
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
  params: Promise<{ boardKey: string }>;
  searchParams: Promise<{ card?: string }>;
}) {
  const { boardKey } = await params;
  const { card: cardId } = await searchParams;
  const { board, users, mentionableUsers, currentUser } =
    await loadBoardPageData(boardKey);
  const publishedForms = await listPublishedFormOptions(board.id);

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
        actions={
          board.canManageForms ? (
            <Link
              href={`/board/${board.routeKey}/forms`}
              className="hidden h-10 items-center gap-1.5 rounded-full bg-[#e8f3dc] px-3 text-xs font-bold text-[#4f772d] hover:bg-[#dbecc8] sm:inline-flex"
            >
              <FileText size={15} />
              Forms
            </Link>
          ) : null
        }
      />
      <KanbanBoard
        initialBoard={board}
        users={users}
        mentionableUsers={mentionableUsers}
        currentUser={currentUser}
        publishedForms={publishedForms}
        selectedCard={selectedCard}
        requestedCardMissing={Boolean(cardId && !selectedCard)}
      />
    </main>
  );
}
