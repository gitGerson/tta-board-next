"use client";

import {
  CalendarDays,
  Check,
  MessageSquare,
  Pencil,
  Plus,
  Share2,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  createCardAction,
  createCommentAction,
  createLabelAction,
  deleteCardAction,
  updateCardAction,
  updateCardDescriptionAction,
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
import { cardPath } from "@/app/lib/kanban/card-route";
import type { RichTextDocument } from "@/app/lib/rich-text/content";
import { Modal } from "@/app/dashboard/_components/modal";
import { CardChecklists } from "./card-checklists";
import { CardLabelEditor } from "./card-label-editor";
import { CardMemberEditor } from "./card-member-editor";
import { CommentContent } from "./comment-content";
import { DateRangePicker } from "./date-range-picker";
import { RichTextContent } from "./rich-text-content";

const CommentEditor = dynamic(
  () => import("./comment-editor").then((module) => module.CommentEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-36 animate-pulse rounded-xl bg-slate-200" />
    ),
  },
);

const CardDescriptionEditor = dynamic(
  () =>
    import("./card-description-editor").then(
      (module) => module.CardDescriptionEditor,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mt-2 h-32 animate-pulse rounded-lg bg-slate-100" />
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

type EditableCardField =
  | "title"
  | "description"
  | "dates";

function FieldEditButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-3 focus-visible:outline-[#689f38]"
      aria-label={`Edit ${label}`}
      title={`Edit ${label}`}
    >
      <Pencil size={13} aria-hidden="true" />
    </button>
  );
}

function InlineEditActions({
  pending,
  onCancel,
  inline = false,
}: {
  pending: boolean;
  onCancel: () => void;
  inline?: boolean;
}) {
  return (
    <div className={inline ? "shrink-0" : "mt-2 flex justify-end"}>
      <div className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="grid size-8 place-items-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-60"
          aria-label="Cancel editing"
          title="Cancel"
        >
          <X size={13} aria-hidden="true" />
        </button>
        <button
          type="submit"
          disabled={pending}
          className="grid size-8 place-items-center border-l border-[#5c8f32] bg-[#689f38] text-white hover:bg-[#557f2f] disabled:opacity-60"
          aria-label={pending ? "Saving changes" : "Save changes"}
          title={pending ? "Saving…" : "Save"}
        >
          <Check size={13} aria-hidden="true" />
        </button>
      </div>
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
  const [holdingDelete, setHoldingDelete] = useState(false);
  const [editingField, setEditingField] =
    useState<EditableCardField | null>(null);
  const [shareStatus, setShareStatus] = useState<
    "idle" | "copied" | "error"
  >("idle");
  const [commentResetVersion, setCommentResetVersion] = useState(0);
  const [startDate, setStartDate] = useState(
    dateInputValue(details?.startAt || null),
  );
  const [dueDate, setDueDate] = useState(
    dateInputValue(details?.dueAt || null),
  );
  const [isPending, startTransition] = useTransition();
  const deleteHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labels = [
    ...initialLabels,
    ...addedLabels.filter(
      (added) => !initialLabels.some((label) => label.id === added.id),
    ),
  ];
  const memberIds = new Set(details?.members.map((member) => member.id) ?? []);
  const cardMembers = users.filter((user) => memberIds.has(user.id));

  useEffect(() => {
    return () => {
      if (deleteHoldTimer.current) {
        clearTimeout(deleteHoldTimer.current);
      }
    };
  }, []);

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
        onClose();
        router.refresh();
      }
    });
  }

  function submitDetailField(
    event: FormEvent<HTMLFormElement>,
    field: Exclude<EditableCardField, "description">,
  ) {
    event.preventDefault();
    if (!details) return;

    const form = new FormData(event.currentTarget);
    const input =
      field === "title"
        ? { title: String(form.get("title") || "") }
        : {
            startAt: utcDate(form.get("startAt")),
            dueAt: utcDate(form.get("dueAt")),
          };

    setResult(null);
    startTransition(async () => {
      const actionResult = await updateCardAction({
        cardId: details.id,
        ...input,
      });
      setResult(actionResult);
      if (actionResult.ok) {
        setEditingField(null);
        router.refresh();
      }
    });
  }

  function saveDescription(document: RichTextDocument | null) {
    if (!details) return;

    setResult(null);
    startTransition(async () => {
      const actionResult = await updateCardDescriptionAction({
        cardId: details.id,
        document,
      });
      setResult(actionResult);
      if (actionResult.ok) {
        setEditingField(null);
        router.refresh();
      }
    });
  }

  function editField(field: EditableCardField) {
    setResult(null);
    setEditingField(field);
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

  function startDeleteHold() {
    if (!details || deleteHoldTimer.current) return;

    setHoldingDelete(true);
    deleteHoldTimer.current = setTimeout(() => {
      deleteHoldTimer.current = null;
      setHoldingDelete(false);
      setResult(null);
      setDeleteConfirm(true);
    }, 2_000);
  }

  function cancelDeleteHold() {
    if (deleteHoldTimer.current) {
      clearTimeout(deleteHoldTimer.current);
      deleteHoldTimer.current = null;
    }

    setHoldingDelete(false);
  }

  function handleDeleteKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
      event.preventDefault();
      startDeleteHold();
    }
  }

  async function copyCardLink() {
    if (!details) return;

    const url = new URL(cardPath(details.id), window.location.origin);

    try {
      await navigator.clipboard.writeText(url.toString());
      setShareStatus("copied");
    } catch {
      setShareStatus("error");
    }
  }

  const selectedLabelIds = new Set(details?.labels.map((label) => label.id));

  return (
    <>
      <Modal
      title={editing ? details!.title : "Create a card"}
      description={
        editing
          ? undefined
          : `Add a task to ${columns.find((column) => column.id === createColumnId)?.name || "this column"}.`
      }
      visuallyHideHeading={editing}
      headerActions={
        details ? (
          <>
            <button
              type="button"
              onPointerDown={startDeleteHold}
              onPointerUp={cancelDeleteHold}
              onPointerCancel={cancelDeleteHold}
              onPointerLeave={cancelDeleteHold}
              onKeyDown={handleDeleteKeyDown}
              onKeyUp={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  cancelDeleteHold();
                }
              }}
              onBlur={cancelDeleteHold}
              onContextMenu={(event) => event.preventDefault()}
              className={`relative grid size-8 touch-none select-none place-items-center overflow-hidden rounded-md text-red-600 hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-red-500 ${
                holdingDelete ? "bg-red-50" : ""
              }`}
              aria-label="Hold for 2 seconds to delete card"
              title="Hold for 2 seconds to delete card"
            >
              <Trash2 size={15} aria-hidden="true" />
              <span
                aria-hidden="true"
                className={`absolute inset-x-0 bottom-0 h-0.5 origin-left bg-red-600 transition-transform duration-[2000ms] ease-linear ${
                  holdingDelete ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </button>
            <button
              type="button"
              onClick={copyCardLink}
              className="grid size-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-3 focus-visible:outline-[#689f38]"
              aria-label={
                shareStatus === "copied"
                  ? "Card link copied"
                  : shareStatus === "error"
                    ? "Copy failed. Try again"
                    : "Copy link to card"
              }
              title={
                shareStatus === "copied"
                  ? "Copied"
                  : shareStatus === "error"
                    ? "Copy failed"
                    : "Share card"
              }
            >
              {shareStatus === "copied" ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Share2 size={15} aria-hidden="true" />
              )}
            </button>
          </>
        ) : undefined
      }
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
          {details ? (
            <section className="p-5 sm:p-6">
              <div className="pb-3">
                {editingField === "title" ? (
                  <form
                    onSubmit={(event) => submitDetailField(event, "title")}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      name="title"
                      required
                      maxLength={200}
                      autoFocus
                      defaultValue={details.title}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-[#689f38] focus:ring-2 focus:ring-[#8bc34a]/20"
                    />
                    <InlineEditActions
                      pending={isPending}
                      onCancel={() => setEditingField(null)}
                      inline
                    />
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">
                      {details.title}
                    </h2>
                    <FieldEditButton
                      label="title"
                      onClick={() => editField("title")}
                    />
                  </div>
                )}
              </div>

              <section className="border-b border-slate-100 pb-2">
                <CardLabelEditor
                  boardId={boardId}
                  cardId={details.id}
                  labels={labels}
                  selectedIds={selectedLabelIds}
                  onCreated={(label) =>
                    setAddedLabels((current) => [...current, label])
                  }
                  onError={setResult}
                  onSaved={() => router.refresh()}
                />
              </section>

              <section className="border-b border-slate-100 py-2">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Date range
                  </h3>
                  <FieldEditButton
                    label="date range"
                    onClick={() => editField("dates")}
                  />
                </div>
                {editingField === "dates" ? (
                  <form
                    onSubmit={(event) => submitDetailField(event, "dates")}
                    className="mt-1.5 flex max-w-xs items-center gap-1.5"
                  >
                    <DateRangePicker
                      startDate={startDate}
                      dueDate={dueDate}
                      onStartDateChange={setStartDate}
                      onDueDateChange={setDueDate}
                      compact
                    />
                    <InlineEditActions
                      pending={isPending}
                      onCancel={() => {
                        setStartDate(dateInputValue(details.startAt));
                        setDueDate(dateInputValue(details.dueAt));
                        setEditingField(null);
                      }}
                      inline
                    />
                  </form>
                ) : (
                  <p className="mt-1.5 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <CalendarDays
                      size={15}
                      className="text-slate-400"
                      aria-hidden="true"
                    />
                    {detailDateRange(details.startAt, details.dueAt)}
                  </p>
                )}
              </section>

              <section className="border-b border-slate-100 py-2">
                <CardMemberEditor
                  key={[
                    details.assignee?.id || "",
                    ...details.members.map((member) => member.id),
                  ].join(":")}
                  cardId={details.id}
                  members={details.members}
                  users={users}
                  picId={details.assignee?.id || null}
                  onError={setResult}
                  onSaved={() => router.refresh()}
                />
              </section>

              <section className="border-b border-slate-100 pb-3 pt-2">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Description
                  </h3>
                  <FieldEditButton
                    label="description"
                    onClick={() => editField("description")}
                  />
                </div>
                {editingField === "description" ? (
                  <CardDescriptionEditor
                    cardId={details.id}
                    initialDocument={details.descriptionDocument}
                    disabled={isPending}
                    onCancel={() => setEditingField(null)}
                    onSave={saveDescription}
                  />
                ) : details.descriptionDocument ? (
                  <RichTextContent document={details.descriptionDocument} />
                ) : (
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    No description provided.
                  </p>
                )}
              </section>

              <ActionError result={result} />
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
              className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 outline-none focus:border-[#689f38] focus:ring-3 focus:ring-[#8bc34a]/20"
            />
          </label>
          <label className="block text-sm font-semibold">
            Description
            <textarea
              name="description"
              rows={4}
              maxLength={5000}
              className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3.5 py-3 outline-none focus:border-[#689f38] focus:ring-3 focus:ring-[#8bc34a]/20"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <fieldset>
              <legend className="text-sm font-semibold">Date range</legend>
              <DateRangePicker
                startDate={startDate}
                dueDate={dueDate}
                onStartDateChange={setStartDate}
                onDueDateChange={setDueDate}
              />
            </fieldset>
            <label className="block text-sm font-semibold">
              <span className="inline-flex items-center gap-2">
                <UserRound size={16} aria-hidden="true" />
                PIC
              </span>
              <select
                name="assigneeId"
                defaultValue=""
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
                {isPending ? "Creating…" : "Create card"}
              </button>
            </div>
          </footer>
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
                users={cardMembers}
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
                cardId={details!.id}
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

      {deleteConfirm && details && (
        <Modal
          title="Delete card?"
          description="This permanently deletes the card, its checklists, and all comments."
          onClose={() => setDeleteConfirm(false)}
          size="sm"
        >
          <div className="space-y-5 p-5 sm:p-6">
            <p className="text-sm text-slate-600">
              Delete <strong>{details.title}</strong>? This action cannot be
              undone.
            </p>
            <ActionError result={result} />
            <footer className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                disabled={isPending}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteCard}
                disabled={isPending}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "Deleting…" : "Delete permanently"}
              </button>
            </footer>
          </div>
        </Modal>
      )}
    </>
  );
}
