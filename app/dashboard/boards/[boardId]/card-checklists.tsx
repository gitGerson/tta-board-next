"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  createChecklistGroupAction,
  createChecklistItemAction,
  deleteChecklistGroupAction,
  deleteChecklistItemAction,
  moveChecklistGroupAction,
  moveChecklistItemAction,
  setChecklistItemDoneAction,
  updateChecklistGroupAction,
  type KanbanActionResult,
} from "@/app/dashboard/boards/actions";
import type {
  ChecklistGroupDTO,
  ChecklistItemDTO,
} from "@/app/lib/dal/boards";
import type { AssignableUserDTO } from "@/app/lib/dal/users";
import type { RichTextDocument } from "@/app/lib/rich-text/content";
import { ChecklistGroupDescriptionEditor } from "./checklist-group-description-editor";
import { DateRangePicker } from "./date-range-picker";
import { RichTextContent } from "./rich-text-content";
import { SingleMemberPicker } from "./single-member-picker";

function dateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function groupDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function groupDateRange(
  startAt: string | null,
  dueAt: string | null,
): string | null {
  if (startAt && dueAt) {
    return `${groupDate(startAt)} – ${groupDate(dueAt)}`;
  }
  if (startAt) return `From ${groupDate(startAt)}`;
  if (dueAt) return `Until ${groupDate(dueAt)}`;
  return null;
}

function utcDate(value: FormDataEntryValue | null): Date | null {
  const date = String(value || "");
  return date ? new Date(`${date}T00:00:00.000Z`) : null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function donePercent(items: ChecklistItemDTO[]): number {
  if (items.length === 0) return 0;
  return Math.round(
    (items.filter((item) => item.isDone).length / items.length) * 100,
  );
}

function ChecklistItemRow({
  item,
  index,
  total,
  disabled,
  onToggle,
  onMove,
  onDelete,
}: {
  item: ChecklistItemDTO;
  index: number;
  total: number;
  disabled: boolean;
  onToggle: (isDone: boolean) => void;
  onMove: (targetIndex: number) => void;
  onDelete: () => void;
}) {
  return (
    <li className="group/item flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white">
      <input
        type="checkbox"
        checked={item.isDone}
        disabled={disabled}
        onChange={(event) => onToggle(event.currentTarget.checked)}
        aria-label={item.title}
        className="mt-0.5 size-4 shrink-0 accent-[#689f38]"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            item.isDone ? "text-slate-400 line-through" : "text-slate-700"
          }`}
        >
          {item.title}
        </p>
        {item.description && (
          <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
        )}
      </div>

      {item.assignees.length > 0 && (
        <span className="flex shrink-0 -space-x-1.5">
          {item.assignees.slice(0, 3).map((user) => (
            <span
              key={user.id}
              title={user.name}
              className="grid size-6 place-items-center rounded-full bg-indigo-500 text-[9px] font-extrabold text-white ring-2 ring-white"
            >
              {initials(user.name)}
            </span>
          ))}
          {item.assignees.length > 3 && (
            <span className="grid size-6 place-items-center rounded-full bg-slate-300 text-[9px] font-extrabold text-slate-700 ring-2 ring-white">
              +{item.assignees.length - 3}
            </span>
          )}
        </span>
      )}

      <span className="flex shrink-0 items-center opacity-0 transition group-hover/item:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onMove(index - 1)}
          disabled={disabled || index === 0}
          aria-label={`Move ${item.title} up`}
          className="grid size-7 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
        >
          <ChevronUp size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index + 1)}
          disabled={disabled || index === total - 1}
          aria-label={`Move ${item.title} down`}
          className="grid size-7 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
        >
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label={`Delete ${item.title}`}
          className="grid size-7 place-items-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </span>
    </li>
  );
}

export function CardChecklists({
  cardId,
  groups,
  users,
  onError,
}: {
  cardId: string;
  groups: ChecklistGroupDTO[];
  users: AssignableUserDTO[];
  onError: (result: KanbanActionResult) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addingGroup, setAddingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [addingItemGroupId, setAddingItemGroupId] = useState<string | null>(
    null,
  );
  const [hiddenDescriptionIds, setHiddenDescriptionIds] = useState<Set<string>>(
    () => new Set(),
  );

  function toggleGroupDescription(groupId: string) {
    setHiddenDescriptionIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  /** Every mutation reports failures upward and re-reads the card on success. */
  function run(operation: () => Promise<KanbanActionResult>, done?: () => void) {
    startTransition(async () => {
      const result = await operation();
      if (!result.ok) {
        onError(result);
        return;
      }
      done?.();
      router.refresh();
    });
  }

  function submitGroup(
    event: FormEvent<HTMLFormElement>,
    descriptionDocument: RichTextDocument | null,
    groupId?: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      name: String(form.get("name") || ""),
      descriptionDocument,
      picId: String(form.get("picId") || "") || null,
      startAt: utcDate(form.get("startAt")),
      dueAt: utcDate(form.get("dueAt")),
    };

    run(
      () =>
        groupId
          ? updateChecklistGroupAction({ groupId, ...values })
          : createChecklistGroupAction({ cardId, ...values }),
      () => {
        setAddingGroup(false);
        setEditingGroupId(null);
      },
    );
  }

  function submitItem(event: FormEvent<HTMLFormElement>, groupId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    run(
      () =>
        createChecklistItemAction({
          groupId,
          title: String(form.get("title") || ""),
          description: String(form.get("description") || "") || null,
          dueAt: utcDate(form.get("dueAt")),
          assigneeIds: form.getAll("assigneeIds").map(String),
        }),
      () => setAddingItemGroupId(null),
    );
  }

  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2">
        <ListChecks size={16} aria-hidden="true" className="text-[#689f38]" />
        <h3 className="text-sm font-semibold">Checklists</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
          {groups.length}
        </span>
        <button
          type="button"
          onClick={() => {
            setAddingGroup(true);
            setEditingGroupId(null);
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#5c8f32] hover:bg-[#edf6e5] focus-visible:outline-3 focus-visible:outline-[#689f38]"
        >
          <Plus size={14} aria-hidden="true" />
          New group
        </button>
      </header>

      {addingGroup && (
        <GroupForm
          users={users}
          disabled={isPending}
          onSubmit={(event, descriptionDocument) =>
            submitGroup(event, descriptionDocument)
          }
          onCancel={() => setAddingGroup(false)}
        />
      )}

      {groups.length === 0 && !addingGroup && (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          No checklists yet. Add a group to break this card into steps.
        </p>
      )}

      {groups.map((group, groupIndex) => {
        const percent = donePercent(group.items);
        const schedule = groupDateRange(group.startAt, group.dueAt);
        const isDescriptionHidden = hiddenDescriptionIds.has(group.id);

        return (
          <article
            key={group.id}
            className="rounded-xl border border-slate-200 bg-slate-50/70"
          >
            <header className="flex items-start gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-700">
                    {group.name}
                  </h4>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {group.items.filter((item) => item.isDone).length}/
                    {group.items.length}
                  </span>
                  {group.pic && (
                    <span
                      title={`PIC: ${group.pic.name}`}
                      className="rounded-full bg-[#e8f3dc] px-2 py-0.5 text-[10px] font-bold text-[#4f772d]"
                    >
                      PIC {group.pic.name}
                    </span>
                  )}
                  {schedule && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      <CalendarDays size={11} aria-hidden="true" />
                      {schedule}
                    </span>
                  )}
                </div>
                {group.descriptionDocument && (
                  <div
                    aria-hidden={isDescriptionHidden}
                    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                      isDescriptionHidden
                        ? "grid-rows-[0fr] opacity-0"
                        : "grid-rows-[1fr] opacity-100"
                    }`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="mt-2 border-t border-slate-200 pt-1">
                        <RichTextContent
                          document={group.descriptionDocument}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <span className="flex shrink-0 items-center">
                {group.descriptionDocument && (
                  <button
                    type="button"
                    onClick={() => toggleGroupDescription(group.id)}
                    aria-expanded={!isDescriptionHidden}
                    aria-label={`${isDescriptionHidden ? "Show" : "Hide"} ${group.name} description`}
                    title={`${isDescriptionHidden ? "Show" : "Hide"} description`}
                    className="grid size-7 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  >
                    {isDescriptionHidden ? (
                      <Eye size={14} aria-hidden="true" />
                    ) : (
                      <EyeOff size={14} aria-hidden="true" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    run(() =>
                      moveChecklistGroupAction({
                        groupId: group.id,
                        targetIndex: groupIndex - 1,
                      }),
                    )
                  }
                  disabled={isPending || groupIndex === 0}
                  aria-label={`Move ${group.name} up`}
                  className="grid size-7 place-items-center rounded text-slate-400 hover:bg-slate-200 disabled:opacity-30"
                >
                  <ChevronUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(() =>
                      moveChecklistGroupAction({
                        groupId: group.id,
                        targetIndex: groupIndex + 1,
                      }),
                    )
                  }
                  disabled={isPending || groupIndex === groups.length - 1}
                  aria-label={`Move ${group.name} down`}
                  className="grid size-7 place-items-center rounded text-slate-400 hover:bg-slate-200 disabled:opacity-30"
                >
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingGroupId(
                      editingGroupId === group.id ? null : group.id,
                    );
                    setAddingGroup(false);
                  }}
                  aria-label={`Edit ${group.name}`}
                  className="grid size-7 place-items-center rounded text-slate-400 hover:bg-slate-200"
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(() => deleteChecklistGroupAction(group.id))
                  }
                  disabled={isPending}
                  aria-label={`Delete ${group.name}`}
                  className="grid size-7 place-items-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </span>
            </header>

            {group.items.length > 0 && (
              <div
                className="mx-3 h-1 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${group.name} progress`}
              >
                <div
                  className={`h-full rounded-full transition-[width] ${
                    percent === 100 ? "bg-[#4f772d]" : "bg-[#8bc34a]"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}

            {editingGroupId === group.id && (
              <div className="px-3 pb-3 pt-2">
                <GroupForm
                  group={group}
                  users={users}
                  disabled={isPending}
                  onSubmit={(event, descriptionDocument) =>
                    submitGroup(event, descriptionDocument, group.id)
                  }
                  onCancel={() => setEditingGroupId(null)}
                />
              </div>
            )}

            <ul className="space-y-0.5 px-1.5 py-2">
              {group.items.map((item, itemIndex) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  index={itemIndex}
                  total={group.items.length}
                  disabled={isPending}
                  onToggle={(isDone) =>
                    run(() =>
                      setChecklistItemDoneAction({ itemId: item.id, isDone }),
                    )
                  }
                  onMove={(targetIndex) =>
                    run(() =>
                      moveChecklistItemAction({
                        itemId: item.id,
                        targetGroupId: group.id,
                        targetIndex: Math.max(0, targetIndex),
                      }),
                    )
                  }
                  onDelete={() =>
                    run(() => deleteChecklistItemAction(item.id))
                  }
                />
              ))}
            </ul>

            {addingItemGroupId === group.id ? (
              <form
                onSubmit={(event) => submitItem(event, group.id)}
                className="space-y-2.5 border-t border-slate-200 px-3 py-3"
              >
                <input
                  name="title"
                  required
                  maxLength={200}
                  autoFocus
                  placeholder="What needs doing?"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#689f38] focus:ring-3 focus:ring-[#8bc34a]/20"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    name="dueAt"
                    type="date"
                    aria-label="Item due date"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#689f38]"
                  />
                  <select
                    name="assigneeIds"
                    multiple
                    aria-label="Item assignees"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#689f38]"
                  >
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddingItemGroupId(null)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-[#689f38] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {isPending ? "Adding…" : "Add item"}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAddingItemGroupId(group.id)}
                className="flex w-full items-center gap-1.5 border-t border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-white hover:text-[#5c8f32] focus-visible:outline-3 focus-visible:outline-[#689f38]"
              >
                <Plus size={13} aria-hidden="true" />
                Add item
              </button>
            )}
          </article>
        );
      })}
    </section>
  );
}

function GroupForm({
  group,
  users,
  disabled,
  onSubmit,
  onCancel,
}: {
  group?: ChecklistGroupDTO;
  users: AssignableUserDTO[];
  disabled: boolean;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    descriptionDocument: RichTextDocument | null,
  ) => void;
  onCancel: () => void;
}) {
  const [descriptionDocument, setDescriptionDocument] =
    useState<RichTextDocument | null>(group?.descriptionDocument || null);
  const [startDate, setStartDate] = useState(
    dateInputValue(group?.startAt || null),
  );
  const [dueDate, setDueDate] = useState(
    dateInputValue(group?.dueAt || null),
  );
  const [picId, setPicId] = useState(group?.pic?.id || "");

  return (
    <form
      onSubmit={(event) => onSubmit(event, descriptionDocument)}
      className="space-y-2 rounded-xl border border-[#a8c98b] bg-white p-2.5"
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.65fr)]">
        <input
          name="name"
          required
          maxLength={100}
          autoFocus
          defaultValue={group?.name || ""}
          placeholder="Group name, e.g. Development"
          className="h-8 w-full rounded-lg border border-slate-300 px-2.5 text-xs outline-none focus:border-[#689f38] focus:ring-2 focus:ring-[#8bc34a]/20"
        />
        <SingleMemberPicker
          users={users}
          value={picId}
          disabled={disabled}
          onChange={setPicId}
        />
        <input type="hidden" name="picId" value={picId} />
      </div>
      <div className="max-w-sm">
        <DateRangePicker
          startDate={startDate}
          dueDate={dueDate}
          onStartDateChange={setStartDate}
          onDueDateChange={setDueDate}
          compact
        />
      </div>
      <ChecklistGroupDescriptionEditor
        initialDocument={group?.descriptionDocument || null}
        disabled={disabled}
        onChange={setDescriptionDocument}
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="h-8 rounded-lg bg-[#689f38] px-3 text-xs font-bold text-white disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </form>
  );
}
