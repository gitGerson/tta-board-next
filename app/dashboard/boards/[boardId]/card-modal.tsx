"use client";

import {
  ArrowRight,
  CalendarDays,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import dynamic from "next/dynamic";
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
import type { CommentDocument } from "@/app/lib/comments/content";
import type {
  AssignableUserDTO,
  MentionableUserDTO,
} from "@/app/lib/dal/users";
import { Modal } from "@/app/dashboard/_components/modal";
import { CardChecklists } from "./card-checklists";
import { CommentContent } from "./comment-content";

const CommentEditor = dynamic(
  () => import("./comment-editor").then((module) => module.CommentEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-36 animate-pulse rounded-xl bg-slate-200" />
    ),
  },
);

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

function detailDate(value: string | null): string {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function detailDateRange(startAt: string | null, dueAt: string | null): string {
  if (startAt && dueAt) {
    return `${detailDate(startAt)} – ${detailDate(dueAt)}`;
  }
  if (startAt) return `From ${detailDate(startAt)}`;
  if (dueAt) return `Until ${detailDate(dueAt)}`;
  return "Not set";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function labelTextColor(color: string): string {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness > 160 ? "#1e293b" : "#ffffff";
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
  mentionableUsers,
  createColumnId,
  details,
  currentUser,
  onClose,
}: {
  boardId: string;
  columns: BoardColumnDTO[];
  initialLabels: LabelDTO[];
  users: AssignableUserDTO[];
  mentionableUsers: MentionableUserDTO[];
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
  const [editingDetails, setEditingDetails] = useState(!editing);
  const [commentResetVersion, setCommentResetVersion] = useState(0);
  const [moveColumnId, setMoveColumnId] = useState(details?.columnId || "");
  const [startDate, setStartDate] = useState(
    dateInputValue(details?.startAt || null),
  );
  const [dueDate, setDueDate] = useState(
    dateInputValue(details?.dueAt || null),
  );
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
      startAt: utcDate(form.get("startAt")),
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
        if (details) {
          setEditingDetails(false);
        } else {
          onClose();
        }
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

  function submitComment(content: CommentDocument) {
    if (!details) return;
    setResult(null);

    startTransition(async () => {
      const actionResult = await createCommentAction({
        cardId: details.id,
        content,
      });
      setResult(actionResult);
      if (actionResult.ok) {
        setCommentResetVersion((version) => version + 1);
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

  function moveCard(targetColumnId = moveColumnId) {
    if (!details || !targetColumnId || targetColumnId === details.columnId) return;
    const target = columns.find((column) => column.id === targetColumnId);
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
          ? undefined
          : `Add a task to ${columns.find((column) => column.id === createColumnId)?.name || "this column"}.`
      }
      visuallyHideHeading={editing}
      onClose={onClose}
      // Creating a card has no comment panel, so full width would stretch a
      // single column of inputs across the whole screen.
      size={editing ? "2xl" : "lg"}
    >
      {/*
        The comment panel holds a fixed width rather than a fraction, so any
        extra room the dialog gains goes to the form rather than to empty space
        beside the comment list.
      */}
      <div
        className={
          editing
            ? "grid lg:h-[calc(90vh-3.25rem)] lg:grid-cols-[minmax(0,1fr)_26rem] lg:overflow-hidden"
            : ""
        }
      >
        <div
          className={
            editing ? "thin-scrollbar min-h-0 lg:overflow-y-auto" : ""
          }
        >
          {details && !editingDetails ? (
            <section className="p-5 sm:p-6">
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="min-w-0 truncate text-xl font-bold text-slate-900">
                    {details.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setDeleteConfirm(false);
                      setEditingDetails(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Pencil size={14} aria-hidden="true" />
                    Edit details
                  </button>
                </div>
                {details.labels.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {details.labels.map((label) => (
                      <span
                        key={label.id}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{
                          backgroundColor: label.color,
                          color: labelTextColor(label.color),
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">No labels</p>
                )}
              </div>

              <section className="border-b border-slate-100 py-5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Description
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {details.description || "No description provided."}
                </p>
              </section>

              <section className="grid gap-5 border-b border-slate-100 py-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Date range
                  </h3>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <CalendarDays size={15} className="text-slate-400" aria-hidden="true" />
                    {detailDateRange(details.startAt, details.dueAt)}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Assignee
                  </h3>
                  {details.assignee ? (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-2.5 text-sm font-semibold text-slate-700">
                      <span className="grid size-6 place-items-center rounded-full bg-[#dbecc8] text-[9px] font-bold text-[#4f772d]">
                        {initials(details.assignee.name)}
                      </span>
                      {details.assignee.name}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Unassigned</p>
                  )}
                </div>
              </section>

              <ActionError result={result} />

              <div className="pt-5">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm((value) => !value)}
                  className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Delete card
                </button>
                {deleteConfirm && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-semibold text-red-800">
                      This permanently deletes the card and all comments.
                    </p>
                    <button
                      type="button"
                      onClick={deleteCard}
                      disabled={isPending}
                      className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      Confirm permanent deletion
                    </button>
                  </div>
                )}
              </div>
            </section>
          ) : (
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

          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <fieldset>
              <legend className="inline-flex items-center gap-2 text-sm font-semibold">
                <CalendarDays size={16} aria-hidden="true" />
                Date range
              </legend>
              <div className="mt-2 flex items-center rounded-xl border border-slate-300 bg-white focus-within:border-[#689f38] focus-within:ring-3 focus-within:ring-[#8bc34a]/20">
                <label className="min-w-0 flex-1 px-3 py-1.5">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Start
                  </span>
                  <input
                    name="startAt"
                    type="date"
                    value={startDate}
                    max={dueDate || undefined}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="mt-0.5 w-full min-w-0 bg-transparent text-sm outline-none"
                  />
                </label>
                <ArrowRight
                  size={15}
                  className="shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <label className="min-w-0 flex-1 px-3 py-1.5">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    End
                  </span>
                  <input
                    name="dueAt"
                    type="date"
                    value={dueDate}
                    min={startDate || undefined}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="mt-0.5 w-full min-w-0 bg-transparent text-sm outline-none"
                  />
                </label>
              </div>
            </fieldset>
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
                    onClick={() => moveCard()}
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
                onClick={() => {
                  if (details) {
                    setResult(null);
                    setDeleteConfirm(false);
                    setEditingDetails(false);
                  } else {
                    onClose();
                  }
                }}
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
          )}

          {/*
            Outside the card form on purpose: the checklist UI has forms of its
            own, and nesting a form inside another is invalid HTML.
          */}
          {details && (
            <div className="border-t border-slate-100 p-5 sm:p-6">
              <CardChecklists
                cardId={details.id}
                groups={details.checklistGroups}
                users={users}
                onError={setResult}
              />
            </div>
          )}
        </div>

        {editing && (
          <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-slate-50 p-5 sm:p-6 lg:border-l lg:border-t-0 lg:overflow-hidden">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-[#689f38]" aria-hidden="true" />
              <h3 className="font-bold">Comments</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500">
                {details!.comments.length}
              </span>
            </div>

            <div className="thin-scrollbar mt-4 max-h-72 space-y-3 overflow-y-auto pr-1 lg:min-h-0 lg:max-h-none lg:flex-1">
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
                    <CommentContent document={comment.content} />
                  </article>
                ))
              )}
            </div>

            <div
              className="mt-4 shrink-0"
              aria-label={`Add a comment as ${currentUser.name}`}
            >
              <CommentEditor
                disabled={isPending}
                users={mentionableUsers}
                resetVersion={commentResetVersion}
                onSubmit={submitComment}
              />
            </div>
          </aside>
        )}
      </div>
    </Modal>
  );
}
