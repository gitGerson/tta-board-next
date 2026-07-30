import { notFound, permanentRedirect } from "next/navigation";
import { getBoard } from "@/app/lib/dal/boards";
import { boardPath } from "@/app/lib/kanban/board-route";
import { entityIdSchema } from "@/app/lib/kanban/validation";

export default async function LegacyBoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const result = entityIdSchema.safeParse((await params).boardId);

  if (!result.success) {
    notFound();
  }

  const board = await getBoard(result.data);
  permanentRedirect(boardPath(board.routeKey));
}
