"use client";

import * as Popover from "@radix-ui/react-popover";
import { ArrowLeft, Check, Pencil, Plus, Search, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import {
  createLabelAction,
  updateCardAction,
  updateLabelAction,
  type KanbanActionResult,
} from "@/app/dashboard/boards/actions";
import type { LabelDTO } from "@/app/lib/dal/boards";

const LABEL_COLORS = [
  "#22c55e",
  "#eab308",
  "#f97316",
  "#ef4444",
  "#a855f7",
  "#0ea5e9",
  "#14b8a6",
  "#10b981",
  "#ec4899",
  "#475569",
  "#8b5cf6",
  "#f59e0b",
  "#f43f5e",
  "#84cc16",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#6b7280",
];

type EditorMode =
  | { type: "index" }
  | { type: "create" }
  | { type: "edit"; labelId: string };

function textColor(color: string): string {
  const hex = color.slice(1);
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);

  return (red * 299 + green * 587 + blue * 114) / 1000 > 160
    ? "#1e293b"
    : "#ffffff";
}

export function CardLabelEditor({
  boardId,
  cardId,
  labels,
  selectedIds,
  onCreated,
  onError,
  onSaved,
}: {
  boardId: string;
  cardId: string;
  labels: LabelDTO[];
  selectedIds: Set<string>;
  onCreated: (label: LabelDTO) => void;
  onError: (result: KanbanActionResult | null) => void;
  onSaved: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [availableLabels, setAvailableLabels] = useState(labels);
  const [activeIds, setActiveIds] = useState(() => new Set(selectedIds));
  const [open, setOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const [mode, setMode] = useState<EditorMode>({ type: "index" });
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[0]);
  const [result, setResult] = useState<KanbanActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const filteredLabels = availableLabels.filter((label) =>
    label.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const activeLabels = availableLabels.filter((label) =>
    selectedIds.has(label.id),
  );

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      setPortalContainer(rootRef.current?.closest("dialog") ?? null);
    } else {
      setActiveIds(new Set(selectedIds));
      showIndex();
    }
    setOpen(nextOpen);
  }

  function showIndex() {
    setResult(null);
    setMode({ type: "index" });
  }

  function showCreate() {
    setResult(null);
    setName("");
    setColor(LABEL_COLORS[0]);
    setMode({ type: "create" });
  }

  function showEdit(label: LabelDTO) {
    setResult(null);
    setName(label.name);
    setColor(label.color);
    setMode({ type: "edit", labelId: label.id });
  }

  function saveLabel() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setResult(null);
    startTransition(async () => {
      const actionResult =
        mode.type === "edit"
          ? await updateLabelAction({
              boardId,
              labelId: mode.labelId,
              name: trimmedName,
              color,
            })
          : await createLabelAction({
              boardId,
              name: trimmedName,
              color,
            });

      setResult(actionResult);
      onError(actionResult.ok ? null : actionResult);
      if (!actionResult.ok) return;

      if (mode.type === "edit") {
        setAvailableLabels((current) =>
          current.map((label) =>
            label.id === mode.labelId
              ? { ...label, name: trimmedName, color }
              : label,
          ),
        );
      } else if (actionResult.id) {
        const label = { id: actionResult.id, name: trimmedName, color };
        setAvailableLabels((current) => [...current, label]);
        onCreated(label);
      }

      showIndex();
    });
  }

  function saveSelection() {
    setResult(null);
    startTransition(async () => {
      const actionResult = await updateCardAction({
        cardId,
        labelIds: [...activeIds],
      });
      setResult(actionResult);
      onError(actionResult.ok ? null : actionResult);
      if (actionResult.ok) {
        setOpen(false);
        onSaved();
      }
    });
  }

  return (
    <div ref={rootRef} className="flex flex-wrap items-center gap-2">
      {activeLabels.length > 0 ? (
        activeLabels.map((label) => (
          <span
            key={label.id}
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{
              backgroundColor: label.color,
              color: textColor(label.color),
            }}
          >
            {label.name}
          </span>
        ))
      ) : (
        <span className="text-sm text-slate-400">No labels</span>
      )}

      <Popover.Root open={open} onOpenChange={changeOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-3 focus-visible:outline-[#689f38]"
            aria-label="Edit labels"
            title="Edit labels"
          >
            <Pencil size={13} aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal container={portalContainer ?? undefined}>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className="z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl outline-none"
          >
            {mode.type === "index" ? (
              <>
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <p className="text-xs font-bold text-slate-700">Labels</p>
            <button
              type="button"
              onClick={showCreate}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
            >
              <Plus size={11} aria-hidden="true" />
              Create
            </button>
          </div>
          <label className="relative block px-3 pt-2">
            <Search
              size={13}
              className="absolute left-5 top-4.5 text-slate-400"
              aria-hidden="true"
            />
            <span className="sr-only">Search labels</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search labels…"
              className="h-8 w-full rounded-md border border-slate-300 pl-7 pr-2 text-xs outline-none focus:border-[#689f38]"
            />
          </label>
          <div className="max-h-48 space-y-1 overflow-y-auto p-2">
            {filteredLabels.length === 0 ? (
              <p className="px-1 py-3 text-center text-xs text-slate-400">
                No labels found.
              </p>
            ) : (
              filteredLabels.map((label) => {
                const inputId = `card-label-${label.id}`;
                const selected = activeIds.has(label.id);

                return (
                  <div
                    key={label.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1"
                  >
                    <label
                      htmlFor={inputId}
                      className="flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-md px-1 hover:bg-slate-50"
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        name="labelIds"
                        value={label.id}
                        checked={selected}
                        onChange={(event) => {
                          setActiveIds((current) => {
                            const next = new Set(current);
                            if (event.target.checked) {
                              next.add(label.id);
                            } else {
                              next.delete(label.id);
                            }
                            return next;
                          });
                        }}
                        className="sr-only"
                      />
                      <span
                        className="min-w-0 flex-1 truncate rounded px-2 py-1 text-[11px] font-bold"
                        style={{
                          backgroundColor: label.color,
                          color: textColor(label.color),
                        }}
                      >
                        {label.name}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          selected
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {selected ? "Active" : "Inactive"}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => showEdit(label)}
                      className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Edit ${label.name}`}
                      title={`Edit ${label.name}`}
                    >
                      <Pencil size={11} aria-hidden="true" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
                {result && !result.ok && (
                  <p className="mx-3 mb-2 rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                    {result.message}
                  </p>
                )}
                <div className="flex justify-end border-t border-slate-100 p-2">
                  <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
                    <button
                      type="button"
                      onClick={() => changeOpen(false)}
                      disabled={isPending}
                      className="grid size-8 place-items-center text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                      aria-label="Cancel label changes"
                      title="Cancel"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={saveSelection}
                      disabled={isPending}
                      className="grid size-8 place-items-center border-l border-[#5c8f32] bg-[#689f38] text-white hover:bg-[#557f2f] disabled:opacity-50"
                      aria-label={
                        isPending ? "Saving label selection" : "Save labels"
                      }
                      title={isPending ? "Saving…" : "Save"}
                    >
                      <Check size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={showIndex}
              className="grid size-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
              aria-label="Back to labels"
              title="Back"
            >
              <ArrowLeft size={13} aria-hidden="true" />
            </button>
            <p className="text-xs font-bold text-slate-700">
              {mode.type === "create" ? "Create label" : "Edit label"}
            </p>
          </div>
          <div className="space-y-3 p-3">
            <label className="block text-[11px] font-bold text-slate-600">
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={50}
                autoFocus
                className="mt-1 h-8 w-full rounded-md border border-slate-300 px-2 text-xs outline-none focus:border-[#689f38]"
              />
            </label>
            <fieldset>
              <legend className="text-[11px] font-bold text-slate-600">
                Color
              </legend>
              <div className="mt-1.5 grid grid-cols-9 gap-1.5">
                {LABEL_COLORS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setColor(option)}
                    className={`grid size-6 place-items-center rounded ${
                      color === option
                        ? "outline-2 outline-offset-1 outline-slate-500"
                        : ""
                    }`}
                    style={{ backgroundColor: option }}
                    aria-label={`Use color ${option}`}
                    title={option}
                  >
                    {color === option && (
                      <Check
                        size={11}
                        color={textColor(option)}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))}
              </div>
            </fieldset>
            {result && !result.ok && (
              <p className="rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                {result.message}
              </p>
            )}
            <div className="flex justify-end">
              <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
                <button
                  type="button"
                  onClick={showIndex}
                  disabled={isPending}
                  className="grid size-8 place-items-center text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                  aria-label="Cancel"
                  title="Cancel"
                >
                  <X size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={saveLabel}
                  disabled={isPending || !name.trim()}
                  className="grid size-8 place-items-center border-l border-[#5c8f32] bg-[#689f38] text-white hover:bg-[#557f2f] disabled:opacity-50"
                  aria-label={
                    mode.type === "create" ? "Create label" : "Save label"
                  }
                  title={mode.type === "create" ? "Create" : "Save"}
                >
                  <Check size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
              </>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
