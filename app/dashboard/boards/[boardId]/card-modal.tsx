"use client";

import {
  CalendarDays,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  createCardAction,
  createCommentAction,
  createLabelAction,
  deleteCardAction,
  moveCardAction,
  updateCardAction,
  type KanbanActionResult,
} from "@/app/dashboard/boards/actions";
import type {
  BoardColumnDTO,
  CardDetailsDTO,
  LabelDTO,
} from "@/app/lib/dal/boards";
import type { AssignableUserDTO } from "@/app/lib/dal/users";
import { Modal } from "@/app/dashboard/_components/modal";

function dateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function utcDate(value: FormDataEntryValue | null): Date | null {
  const date = String(value || "");
  return date ? new Date(`${date}T00:00:00.000Z`) : null;
}

function commentDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
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

function ActionError({ result }: { result: KanbanActionResult | null }) {
  if (!result || result.ok) return null;

  return (
    <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
      <p>{result.message}</p>
      {result.fieldErrors &&
        Object.entries(result.fieldErrors).map(([field, errors]) => (
          <p key={field} className="mt-1">
            {errors?.[0]}
          </p>
        ))}
    </div>
  );
}

export function CardModal({
  boardId,
  columns,
  initialLabels,
  users,
  createColumnId,
  details,
  currentUser,
  onClose,
}: {
  boardId: string;
  columns: BoardColumnDTO[];
  initialLabels: LabelDTO[];
  users: AssignableUserDTO[];
  createColumnId?: string;
  details?: CardDetailsDTO;
  currentUser: { id: string; name: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const editing = Boolean(details);
  const [result, setResult] = useState<KanbanActionResult | null>(null);
  const [addedLabels, setAddedLabels] = useState<LabelDTO[]>([]);
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState("#689f38");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [moveColumnId, setMoveColumnId] = useState(details?.columnId || "");
  const [isPending, startTransition] = useTransition();
  const labels = [
    ...initialLabels,
    ...addedLabels.filter(
      (added) => !initialLabels.some((label) => label.id === added.id),
    ),
  ];

  function submitCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      title: String(form.get("title") || ""),
      description: String(form.get("description") || "") || null,
      dueAt: utcDate(form.get("dueAt")),
      assigneeId: String(form.get("assigneeId") || "") || null,
      labelIds: form.getAll("labelIds").map(String),
    };
    setResult(null);

    startTransition(async () => {
      const actionResult = details
        ? await updateCardAction({ cardId: details.id, ...input })
        : await createCardAction({
            columnId: createColumnId || "",
            ...input,
          });
      setResult(actionResult);
      if (actionResult.ok) {
        onClose();
        router.refresh();
      }
    });
  }

  function submitLabel() {
    const name = labelName;
    const color = labelColor;
    if (!name.trim()) return;
    setResult(null);

    startTransition(async () => {
      const actionResult = await createLabelAction({ boardId, name, color });
      setResult(actionResult);
      if (actionResult.ok && actionResult.id) {
        setAddedLabels((current) => [
          ...current,
          { id: actionResult.id!, name: name.trim(), color },
        ]);
        setShowLabelForm(false);
        setLabelName("");
        setLabelColor("#689f38");
        router.refresh();
      }
    });
  }

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details || !commentBody.trim()) return;
    setResult(null);

    startTransition(async () => {
      const actionResult = await createCommentAction({
        cardId: details.id,
        body: commentBody,
      });
      setResult(actionResult);
      if (actionResult.ok) {
        setCommentBody("");
        router.refresh();
      }
    });
  }

  function deleteCard() {
    if (!details) return;
    setResult(null);
    startTransition(async () => {
      const actionResult = await deleteCardAction(details.id);
      setResult(actionResult);
      if (actionResult.ok) {
        onClose();
        router.refresh();
      }
    });
  }

  function moveCard() {
    if (!details || !moveColumnId || moveColumnId === details.columnId) return;
    const target = columns.find((column) => column.id === moveColumnId);
    if (!target) return;
    setResult(null);
    startTransition(async () => {
      const actionResult = await moveCardAction({
        cardId: details.id,
        targetColumnId: target.id,
        targetIndex: target.cards.length,
      });
      setResult(actionResult);
      if (actionResult.ok) {
        onClose();
        router.refresh();
      }
    });
  }

  const selectedLabelIds = new Set(details?.labels.map((label) => label.id));

  return (
    <Modal
      title={editing ? details!.title : "Create a card"}
      description={
        editing
          ? "Update the task details or continue the discussion."
          : `Add a task to ${columns.find((column) => column.id === createColumnId)?.name || "this column"}.`
      }
      onClose={onClose}
      size="lg"
    >
      <div className={editing ? "grid lg:grid-cols-[1fr_0.8fr]" : ""}>
        <form onSubmit={submitCard} className="space-y-5 p-5 sm:p-6">
          <label className="block text-sm font-semibold">
            Title
            <input
              name="title"
              required
              maxLength={200}
              autoFocus={!editing}
              defaultValue={details?.title}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 outline-none focus:border-[#689f38] focus:ring-3 focus:ring-[#8bc34a]/20"
            />
          </label>
          <label className="block text-sm font-semibold">
            Description
            <textarea
              name="description"
              rows={4}
              maxLength={5000}
              defaultValue={details?.description || ""}
              className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3.5 py-3 outline-none focus:border-[#689f38] focus:ring-3 focus:ring-[#8bc34a]/20"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={16} aria-hidden="true" />
                Due date
              </span>
              <input
                name="dueAt"
                type="date"
                defaultValue={dateInputValue(details?.dueAt || null)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 outline-none focus:border-[#689f38] focus:ring-3 focus:ring-[#8bc34a]/20"
              />
            </label>
            <label className="block text-sm font-semibold">
              <span className="inline-flex items-center gap-2">
                <UserRound size={16} aria-hidden="true" />
                Assignee
              </span>
              <select
                name="assigneeId"
                defaultValue={details?.assignee?.id || ""}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 outline-none focus:border-[#689f38] focus:ring-3 focus:ring-[#8bc34a]/20"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.username})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset>
            <div className="flex items-center justify-between gap-3">
              <legend className="text-sm font-semibold">Labels</legend>
              <button
                type="button"
                onClick={() => setShowLabelForm((value) => !value)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#5c8f32]"
              >
                <Plus size={14} aria-hidden="true" />
                New label
              </button>
            </div>
            {labels.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No labels yet.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {labels.map((label) => (
                  <label
                    key={label.id}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold has-checked:border-[#8bc34a] has-checked:bg-[#edf6e5]"
                  >
                    <input
                      type="checkbox"
                      name="labelIds"
                      value={label.id}
                      defaultChecked={selectedLabelIds.has(label.id)}
                      className="accent-[#689f38]"
                    />
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    {label.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          {editing && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="text-sm font-semibold">
                Move to another column
                <div className="mt-2 flex gap-2">
                  <select
                    value={moveColumnId}
                    onChange={(event) => setMoveColumnId(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
                  >
                    {columns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={moveCard}
                    disabled={
                      isPending || !moveColumnId || moveColumnId === details!.columnId
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    Move
                  </button>
                </div>
              </label>
            </div>
          )}

          {showLabelForm && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-bold">Create label</p>
              <div className="mt-2 flex gap-2">
                <input
                  required
                  maxLength={50}
                  placeholder="Label name"
                  value={labelName}
                  onChange={(event) => setLabelName(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  type="color"
                  value={labelColor}
                  onChange={(event) => setLabelColor(event.target.value)}
                  className="h-10 w-12 rounded-lg border border-slate-300 bg-white p-1"
                  aria-label="Label color"
                />
                <button
                  type="button"
                  onClick={submitLabel}
                  disabled={isPending || !labelName.trim()}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <ActionError result={result} />

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            {editing ? (
              <button
                type="button"
                onClick={() => setDeleteConfirm((value) => !value)}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50"
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="ml-auto flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-[#689f38] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#557f2f] disabled:opacity-60"
              >
                {isPending ? "Saving…" : editing ? "Save changes" : "Create card"}
              </button>
            </div>
          </footer>

          {deleteConfirm && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">
                This permanently deletes the card and all comments.
              </p>
              <button
                type="button"
                onClick={deleteCard}
                disabled={isPending}
                className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white"
              >
                Confirm permanent deletion
              </button>
            </div>
          )}
        </form>

        {editing && (
          <aside className="border-t border-slate-200 bg-slate-50 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-[#689f38]" aria-hidden="true" />
              <h3 className="font-bold">Comments</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500">
                {details!.comments.length}
              </span>
            </div>

            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
              {details!.comments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                  No comments yet.
                </p>
              ) : (
                details!.comments.map((comment) => (
                  <article key={comment.id} className="rounded-xl bg-white p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="grid size-7 place-items-center rounded-full bg-[#edf6e5] text-[10px] font-bold text-[#4f772d]">
                        {initials(comment.author.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">{comment.author.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {commentDate(comment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {comment.body}
                    </p>
                  </article>
                ))
              )}
            </div>

            <form onSubmit={submitComment} className="mt-4">
              <label className="sr-only" htmlFor="new-comment">
                Add a comment as {currentUser.name}
              </label>
              <textarea
                id="new-comment"
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="Write a comment…"
                className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#689f38] focus:ring-3 focus:ring-[#8bc34a]/20"
              />
              <button
                type="submit"
                disabled={isPending || !commentBody.trim()}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                <Send size={15} aria-hidden="true" />
                Add comment
              </button>
            </form>
          </aside>
        )}
      </div>
    </Modal>
  );
}
