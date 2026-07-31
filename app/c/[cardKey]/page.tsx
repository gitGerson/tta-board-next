import { notFound, redirect } from "next/navigation";
import { getCardRoute } from "@/app/lib/dal/boards";
import { boardPath } from "@/app/lib/kanban/board-route";
import { cardIdFromKey } from "@/app/lib/kanban/card-route";

export const dynamic = "force-dynamic";

export default async function CardShortLinkPage({
  params,
}: {
  params: Promise<{ cardKey: string }>;
}) {
  const cardId = cardIdFromKey((await params).cardKey);

  if (!cardId) {
    notFound();
  }

  const card = await getCardRoute(cardId);

  if (!card) {
    notFound();
  }

  redirect(`${boardPath(card.boardRouteKey)}?card=${card.id}`);
}
