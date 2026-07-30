import type {
  BoardDTO,
  CardSummaryDTO,
} from "@/app/lib/dal/boards";

export function repositionColumns(
  board: BoardDTO,
  sourceId: string,
  targetIndex: number,
): BoardDTO {
  const sourceIndex = board.columns.findIndex((column) => column.id === sourceId);
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= board.columns.length
  ) {
    return board;
  }

  const columns = [...board.columns];
  const [movedColumn] = columns.splice(sourceIndex, 1);
  columns.splice(targetIndex, 0, movedColumn);

  return {
    ...board,
    columns: columns.map((column, position) => ({ ...column, position })),
  };
}

export function repositionCard(
  board: BoardDTO,
  cardId: string,
  targetColumnId: string,
  targetIndex: number,
): BoardDTO {
  let movedCard: CardSummaryDTO | undefined;
  const targetExists = board.columns.some(
    (column) => column.id === targetColumnId,
  );

  if (!targetExists) {
    return board;
  }

  const withoutCard = board.columns.map((column) => {
    const card = column.cards.find((candidate) => candidate.id === cardId);
    if (card) movedCard = card;

    return {
      ...column,
      cards: column.cards
        .filter((candidate) => candidate.id !== cardId)
        .map((candidate, position) => ({ ...candidate, position })),
    };
  });

  if (!movedCard) {
    return board;
  }

  const cardToMove = movedCard;

  return {
    ...board,
    columns: withoutCard.map((column) => {
      if (column.id !== targetColumnId) return column;

      const cards = [...column.cards];
      const boundedIndex = Math.max(0, Math.min(targetIndex, cards.length));
      cards.splice(boundedIndex, 0, cardToMove);

      return {
        ...column,
        cards: cards.map((card, position) => ({ ...card, position })),
      };
    }),
  };
}
