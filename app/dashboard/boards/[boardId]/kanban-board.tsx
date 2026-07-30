"use client";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  GripVertical,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DragDropProvider,
  PointerSensor,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/react";
import { useSortable, isSortable } from "@dnd-kit/react/sortable";
import {
  PointerActivationConstraints,
} from "@dnd-kit/dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import {
  createColumnAction,
  deleteColumnAction,
  moveCardAction,
  moveColumnAction,
  renameColumnAction,
  type KanbanActionResult,
} from "@/app/dashboard/boards/actions";
import { Modal } from "@/app/dashboard/_components/modal";
import type { CurrentUser } from "@/app/lib/dal/auth";
import type {
  BoardColumnDTO,
  BoardDTO,
  CardDetailsDTO,
  CardSummaryDTO,
} from "@/app/lib/dal/boards";
import type { AssignableUserDTO } from "@/app/lib/dal/users";
import { repositionCard, repositionColumns } from "./board-ordering";
import { CardModal } from "./card-modal";

type DragData =
  | { kind: "column"; columnId: string }
  | { kind: "card"; cardId: string; columnId: string }
  | { kind: "column-drop"; columnId: string };

const AVATAR_TONES = [
  "bg-indigo-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-amber-500",
];

const DAY_MS = 86_400_000;

function dueDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function avatarTone(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** Today at UTC midnight, so due-date maths ignores the time of day. */
function utcStartOfDay(value: number | string): number {
  const date = new Date(value);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

const neverResubscribe = () => () => {};
const todaySnapshot = () => utcStartOfDay(Date.now());
const noTodayOnServer = () => null;

/**
 * Due-date badges depend on "now", which the server cannot know for the
 * viewer, so the first paint renders without them and hydration fills in.
 */
function useTodayMs(): number | null {
  return useSyncExternalStore(
    neverResubscribe,
    todaySnapshot,
    noTodayOnServer,
  );
}

function dueStatus(
  dueAt: string | null,
  todayMs: number | null,
): { label: string; tone: string } | null {
  if (!dueAt || todayMs === null) return null;
  const days = Math.round((utcStartOfDay(dueAt) - todayMs) / DAY_MS);
  if (days < 0) return { label: "Overdue", tone: "bg-red-100 text-red-600" };
  if (days === 0)
    return { label: "Today", tone: "bg-amber-100 text-amber-700" };
  if (days <= 3)
    return { label: `H-${days}`, tone: "bg-sky-100 text-sky-700" };
  return null;
}

function KanbanCard({
  card,
  columnId,
  index,
  todayMs,
  onOpen,
}: {
  card: CardSummaryDTO;
  columnId: string;
  index: number;
  todayMs: number | null;
  onOpen: () => void;
}) {
  const { ref, handleRef, isDragging } = useSortable<DragData>({
    id: card.id,
    index,
    group: columnId,
    type: "card",
    accept: "card",
    data: { kind: "card", cardId: card.id, columnId },
  });

  const status = dueStatus(card.dueAt, todayMs);

  return (
    <article
      ref={ref}
      className={`group relative rounded-lg border bg-white px-3.5 py-3 transition ${
        isDragging
          ? "z-20 border-[#8bc34a] opacity-60 shadow-xl"
          : "border-slate-200/90 shadow-[0_1px_2px_rgb(15_23_42/0.06)] hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <button
        ref={handleRef}
        type="button"
        className="absolute right-1.5 top-1.5 grid size-7 cursor-grab place-items-center rounded-lg text-slate-300 opacity-100 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing focus-visible:opacity-100 focus-visible:outline-3 focus-visible:outline-[#689f38] sm:opacity-0 sm:group-hover:opacity-100"
        aria-label={`Drag ${card.title}`}
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        data-no-drag
        onClick={onOpen}
        className="block w-full text-left focus-visible:rounded focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#689f38]"
      >
        {card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 pr-7" aria-label="Labels">
            {card.labels.map((label) => (
              <span
                key={label.id}
                title={label.name}
                className="h-1.5 w-6 rounded-full"
                style={{ backgroundColor: label.color }}
              >
                <span className="sr-only">{label.name}</span>
              </span>
            ))}
          </div>
        )}

        <h3 className="mt-2 pr-7 text-[13px] font-extrabold uppercase leading-snug tracking-wide text-slate-800">
          {card.title}
        </h3>

        {(card.dueAt || status) && (
          <div className="mt-2 flex items-center gap-2">
            {card.dueAt && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Clock3 size={13} aria-hidden="true" />
                {dueDate(card.dueAt)}
              </span>
            )}
            {status && (
              <span
                className={`ml-auto rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${status.tone}`}
              >
                {status.label}
              </span>
            )}
          </div>
        )}

        {card.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
            {card.description}
          </p>
        )}

        <div className="mt-3 flex min-h-7 items-center gap-2 border-t border-slate-100 pt-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Assigned to
          </span>
          <span className="ml-auto flex items-center gap-2">
            {card.commentCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                <MessageSquare size={12} aria-hidden="true" />
                {card.commentCount}
              </span>
            )}
            {card.assignee ? (
              <span
                className={`grid size-7 place-items-center rounded-full text-[10px] font-extrabold text-white ring-2 ring-white ${avatarTone(card.assignee.id)}`}
                title={card.assignee.name}
                aria-label={`Assigned to ${card.assignee.name}`}
              >
                {initials(card.assignee.name)}
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-slate-300">
                Unassigned
              </span>
            )}
          </span>
        </div>
      </button>
    </article>
  );
}

function KanbanColumn({
  column,
  index,
  totalColumns,
  todayMs,
  onAddCard,
  onOpenCard,
  onRename,
  onDelete,
  onMove,
}: {
  column: BoardColumnDTO;
  index: number;
  totalColumns: number;
  todayMs: number | null;
  onAddCard: () => void;
  onOpenCard: (cardId: string) => void;
  onRename: () => void;
  onDelete: () => void;
  onMove: (targetIndex: number) => void;
}) {
  const { ref, handleRef, isDragging } = useSortable<DragData>({
    id: column.id,
    index,
    group: "board-columns",
    type: "column",
    accept: "column",
    data: { kind: "column", columnId: column.id },
  });
  const { ref: dropRef, isDropTarget } = useDroppable<DragData>({
    id: `column-drop:${column.id}`,
    type: "column-drop",
    accept: "card",
    data: { kind: "column-drop", columnId: column.id },
  });

  return (
    <section
      ref={ref}
      className={`flex max-h-[calc(100vh-12.5rem)] w-[min(84vw,19rem)] shrink-0 flex-col rounded-2xl border bg-white shadow-[0_10px_24px_rgb(15_23_42/0.12)] transition sm:w-80 ${
        isDragging ? "border-[#8bc34a] opacity-60" : "border-slate-200/70"
      }`}
      aria-labelledby={`column-${column.id}`}
    >
      <header className="flex items-center gap-1.5 px-3 py-3">
        <button
          ref={handleRef}
          type="button"
          className="grid size-8 cursor-grab place-items-center rounded-lg text-slate-300 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing focus-visible:outline-3 focus-visible:outline-[#689f38]"
          aria-label={`Drag column ${column.name}`}
        >
          <GripVertical size={17} aria-hidden="true" />
        </button>
        <h2
          id={`column-${column.id}`}
          className="min-w-0 truncate text-sm font-extrabold uppercase tracking-[0.12em] text-slate-600"
        >
          {column.name}
        </h2>
        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
          {column.cards.length}
        </span>
        <details data-no-drag className="group/menu relative">
          <summary className="grid size-8 cursor-pointer list-none place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-3 focus-visible:outline-[#689f38]">
            <MoreHorizontal size={18} aria-label={`Manage ${column.name}`} />
          </summary>
          <div className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1.5 text-sm shadow-xl">
            <button
              type="button"
              onClick={onRename}
              className="w-full rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-50"
            >
              Rename column
            </button>
            <button
              type="button"
              onClick={() => onMove(index - 1)}
              disabled={index === 0}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={15} aria-hidden="true" />
              Move left
            </button>
            <button
              type="button"
              onClick={() => onMove(index + 1)}
              disabled={index === totalColumns - 1}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight size={15} aria-hidden="true" />
              Move right
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 size={15} aria-hidden="true" />
              Delete empty column
            </button>
          </div>
        </details>
      </header>

      <div
        ref={dropRef}
        className={`kanban-scroll min-h-24 flex-1 space-y-2.5 overflow-y-auto px-3 pb-3 transition ${
          isDropTarget ? "rounded-xl bg-slate-100" : ""
        }`}
      >
        {column.cards.map((card, cardIndex) => (
          <KanbanCard
            key={card.id}
            card={card}
            columnId={column.id}
            index={cardIndex}
            todayMs={todayMs}
            onOpen={() => onOpenCard(card.id)}
          />
        ))}
        {column.cards.length === 0 && (
          <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-slate-300 px-4 text-center text-xs font-semibold text-slate-400">
            Drop a card here
          </div>
        )}
      </div>

      <footer className="border-t border-slate-100 px-3 py-1">
        <button
          type="button"
          data-no-drag
          onClick={onAddCard}
          className="flex w-full items-center justify-center gap-1 rounded-md px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] text-slate-400 hover:bg-slate-50 hover:text-[#5c8f32] focus-visible:outline-3 focus-visible:outline-[#689f38]"
        >
          <Plus size={11} aria-hidden="true" />
          Add card
        </button>
      </footer>
    </section>
  );
}

export function KanbanBoard({
  initialBoard,
  users,
  currentUser,
  selectedCard,
  requestedCardMissing,
}: {
  initialBoard: BoardDTO;
  users: AssignableUserDTO[];
  currentUser: CurrentUser;
  selectedCard: CardDetailsDTO | null;
  requestedCardMissing: boolean;
}) {
  const router = useRouter();
  const [boardState, setBoardState] = useState({
    source: initialBoard,
    value: initialBoard,
  });
  const board =
    boardState.source === initialBoard ? boardState.value : initialBoard;
  const [createCardColumnId, setCreateCardColumnId] = useState<string | null>(null);
  const [columnDialog, setColumnDialog] = useState<
    | { type: "create" }
    | { type: "rename"; column: BoardColumnDTO }
    | { type: "delete"; column: BoardColumnDTO }
    | null
  >(null);
  const [toast, setToast] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<KanbanActionResult | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const todayMs = useTodayMs();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function setBoard(value: BoardDTO) {
    setBoardState({ source: initialBoard, value });
  }

  function openCard(cardId: string) {
    router.push(`/dashboard/boards/${board.id}?card=${cardId}`, {
      scroll: false,
    });
  }

  function closeCard() {
    setCreateCardColumnId(null);
    if (selectedCard || requestedCardMissing) {
      router.replace(`/dashboard/boards/${board.id}`, { scroll: false });
    }
  }

  function persistColumnMove(columnId: string, targetIndex: number) {
    if (targetIndex < 0 || targetIndex >= board.columns.length) return;
    const snapshot = board;
    setBoard(repositionColumns(board, columnId, targetIndex));
    startTransition(async () => {
      const result = await moveColumnAction({ columnId, targetIndex });
      if (!result.ok) {
        setBoard(snapshot);
        setToast(result.message);
      } else {
        router.refresh();
      }
    });
  }

  function onDragEnd(event: DragEndEvent) {
    if (event.canceled) return;
    const { source, target } = event.operation;
    if (!source || !target) return;
    const sourceData = source.data as DragData | undefined;
    const targetData = target.data as DragData | undefined;

    if (sourceData?.kind === "column") {
      const targetIndex = isSortable(target)
        ? target.index
        : board.columns.findIndex(
            (column) => column.id === targetData?.columnId,
          );
      if (targetIndex >= 0) {
        persistColumnMove(sourceData.columnId, targetIndex);
      }
      return;
    }

    if (sourceData?.kind !== "card") return;
    const targetColumnId =
      targetData?.columnId ||
      (isSortable(target) ? String(target.group || "") : "");
    if (!targetColumnId) return;
    const targetColumn = board.columns.find(
      (column) => column.id === targetColumnId,
    );
    if (!targetColumn) return;
    const targetIndex = isSortable(target)
      ? target.index
      : targetColumn.cards.length;
    const snapshot = board;
    setBoard(
      repositionCard(board, sourceData.cardId, targetColumnId, targetIndex),
    );

    startTransition(async () => {
      const result = await moveCardAction({
        cardId: sourceData.cardId,
        targetColumnId,
        targetIndex,
      });
      if (!result.ok) {
        setBoard(snapshot);
        setToast(result.message);
      } else {
        router.refresh();
      }
    });
  }

  function submitColumn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!columnDialog) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "");
    setActionResult(null);

    startTransition(async () => {
      const result =
        columnDialog.type === "create"
          ? await createColumnAction({ boardId: board.id, name })
          : columnDialog.type === "rename"
            ? await renameColumnAction({
                columnId: columnDialog.column.id,
                name,
              })
            : null;
      if (!result) return;
      setActionResult(result);
      if (result.ok) {
        setColumnDialog(null);
        router.refresh();
      }
    });
  }

  function deleteColumn() {
    if (columnDialog?.type !== "delete") return;
    setActionResult(null);
    startTransition(async () => {
      const result = await deleteColumnAction(columnDialog.column.id);
      setActionResult(result);
      if (result.ok) {
        setColumnDialog(null);
        router.refresh();
      }
    });
  }

  const totalCards = board.columns.reduce(
    (total, column) => total + column.cards.length,
    0,
  );

  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col gap-5 overflow-hidden bg-[#8b91a0] px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_10px_24px_rgb(15_23_42/0.14)]">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-bold text-[#5c8f32] hover:bg-[#edf6e5] hover:text-[#456f26] focus-visible:outline-3 focus-visible:outline-[#689f38]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="hidden sm:inline">All boards</span>
        </Link>

        <div className="mx-auto min-w-0 text-center">
          <div className="flex min-w-0 items-center justify-center gap-2.5">
            <h1 className="truncate text-lg font-extrabold uppercase tracking-[0.08em] text-slate-700 sm:text-xl">
              {board.name}
            </h1>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-500">
              {totalCards}
            </span>
          </div>
          {board.description && (
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {board.description}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setActionResult(null);
            setColumnDialog({ type: "create" });
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#a8c98b] bg-white px-4 py-2.5 text-sm font-bold text-[#4f772d] hover:bg-[#edf6e5] focus-visible:outline-3 focus-visible:outline-[#689f38]"
        >
          <Plus size={17} aria-hidden="true" />
          <span className="hidden sm:inline">Add column</span>
        </button>
      </header>

      <p id="kanban-drag-instructions" className="sr-only">
        Use a drag handle, then press Space or Enter to pick up an item. Use
        arrow keys to move it, Space or Enter to drop it, and Escape to cancel.
      </p>

      <DragDropProvider
        sensors={(defaults) => [
          ...defaults.filter((sensor) => sensor !== PointerSensor),
          PointerSensor.configure({
            activationConstraints: (event) =>
              event.pointerType === "touch"
                ? [
                    new PointerActivationConstraints.Delay({
                      value: 250,
                      tolerance: 5,
                    }),
                  ]
                : [new PointerActivationConstraints.Distance({ value: 8 })],
            preventActivation: (event) =>
              event.target instanceof Element &&
              event.target.closest("[data-no-drag]") !== null,
          }),
        ]}
        onDragEnd={onDragEnd}
      >
        <div
          className="kanban-scroll flex flex-1 items-start gap-4 overflow-x-auto pb-2"
          aria-describedby="kanban-drag-instructions"
          aria-busy={isPending}
        >
          {board.columns.map((column, index) => (
            <KanbanColumn
              key={column.id}
              column={column}
              index={index}
              totalColumns={board.columns.length}
              todayMs={todayMs}
              onAddCard={() => setCreateCardColumnId(column.id)}
              onOpenCard={openCard}
              onRename={() => {
                setActionResult(null);
                setColumnDialog({ type: "rename", column });
              }}
              onDelete={() => {
                setActionResult(null);
                setColumnDialog({ type: "delete", column });
              }}
              onMove={(targetIndex) =>
                persistColumnMove(column.id, targetIndex)
              }
            />
          ))}
          {board.columns.length === 0 && (
            <section className="grid min-h-80 min-w-full place-items-center rounded-2xl border border-dashed border-white/60 bg-white/80 p-8 text-center">
              <div>
                <CircleAlert
                  className="mx-auto text-[#689f38]"
                  aria-hidden="true"
                />
                <h2 className="mt-3 font-bold">This board has no columns</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add a column to start organizing cards.
                </p>
              </div>
            </section>
          )}
        </div>
      </DragDropProvider>

      {toast && (
        <div
          className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}

      {createCardColumnId && (
        <CardModal
          boardId={board.id}
          columns={board.columns}
          initialLabels={board.labels}
          users={users}
          currentUser={currentUser}
          createColumnId={createCardColumnId}
          onClose={closeCard}
        />
      )}

      {selectedCard && (
        <CardModal
          boardId={board.id}
          columns={board.columns}
          initialLabels={board.labels}
          users={users}
          currentUser={currentUser}
          details={selectedCard}
          onClose={closeCard}
        />
      )}

      {requestedCardMissing && (
        <Modal
          title="Card not found"
          description="The card may have been deleted or belongs to another board."
          onClose={closeCard}
          size="sm"
        >
          <div className="p-6 text-right">
            <button
              type="button"
              onClick={closeCard}
              className="rounded-xl bg-[#689f38] px-4 py-2.5 text-sm font-bold text-white"
            >
              Return to board
            </button>
          </div>
        </Modal>
      )}

      {columnDialog && (
        <Modal
          title={
            columnDialog.type === "create"
              ? "Add a column"
              : columnDialog.type === "rename"
                ? "Rename column"
                : "Delete column?"
          }
          description={
            columnDialog.type === "delete"
              ? "Only empty columns can be permanently deleted."
              : undefined
          }
          onClose={() => setColumnDialog(null)}
          size="sm"
        >
          {columnDialog.type === "delete" ? (
            <div className="space-y-4 p-5 sm:p-6">
              <p className="text-sm text-slate-600">
                Delete <strong>{columnDialog.column.name}</strong>? This cannot
                be undone.
              </p>
              {actionResult && !actionResult.ok && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
                  {actionResult.message}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setColumnDialog(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deleteColumn}
                  disabled={isPending}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {isPending ? "Deleting…" : "Delete column"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submitColumn} className="space-y-5 p-5 sm:p-6">
              <label className="block text-sm font-semibold">
                Column name
                <input
                  name="name"
                  required
                  maxLength={100}
                  autoFocus
                  defaultValue={
                    columnDialog.type === "rename"
                      ? columnDialog.column.name
                      : ""
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 outline-none focus:border-[#689f38] focus:ring-3 focus:ring-[#8bc34a]/20"
                />
              </label>
              {actionResult && !actionResult.ok && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
                  {actionResult.message}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setColumnDialog(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-[#689f38] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {isPending
                    ? "Saving…"
                    : columnDialog.type === "create"
                      ? "Add column"
                      : "Save name"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </main>
  );
}
