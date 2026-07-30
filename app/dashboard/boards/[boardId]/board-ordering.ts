import type {
  BoardDTO,
  CardSummaryDTO,
} from "@/app/lib/dal/boards";

/** Card ids per column, the flat shape dnd-kit's `move` helper understands. */
export type CardOrder = Record<string, string[]>;

export function cardOrder(board: BoardDTO): CardOrder {
  return Object.fromEntries(
    board.columns.map((column) => [
      column.id,
      column.cards.map((card) => card.id),
    ]),
  );
}

/** Rebuild the board so its cards follow `order`, dropping unknown ids. */
export function applyCardOrder(board: BoardDTO, order: CardOrder): BoardDTO {
  const cards = new Map<string, CardSummaryDTO>();
  for (const column of board.columns) {
    for (const card of column.cards) cards.set(card.id, card);
  }

  const columns = board.columns.map((column) => {
    const ids = order[column.id];
    if (!ids) return column;

    return {
      ...column,
      cards: ids
        .map((id) => cards.get(id))
        .filter((card): card is CardSummaryDTO => card !== undefined)
        .map((card, position) => ({ ...card, position })),
    };
  });

  const moved = columns.reduce((total, column) => total + column.cards.length, 0);
  return moved === cards.size ? { ...board, columns } : board;
}

/** Rebuild the board so its columns follow `order`, ignoring incomplete input. */
export function applyColumnOrder(board: BoardDTO, order: string[]): BoardDTO {
  const byId = new Map(board.columns.map((column) => [column.id, column]));
  const columns = order
    .map((id) => byId.get(id))
    .filter((column): column is BoardDTO["columns"][number] => column !== undefined);

  if (columns.length !== board.columns.length) return board;

  return {
    ...board,
    columns: columns.map((column, position) => ({ ...column, position })),
  };
}

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
