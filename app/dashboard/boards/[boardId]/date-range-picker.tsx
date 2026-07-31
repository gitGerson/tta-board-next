"use client";

import * as Popover from "@radix-ui/react-popover";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";

function inputDate(value: string): Date | undefined {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
}

function dateInputValue(value: Date | undefined): string {
  return value ? format(value, "yyyy-MM-dd") : "";
}

function rangeLabel(range: DateRange): string {
  if (range.from && range.to) {
    return `${format(range.from, "MMM dd, yyyy")} – ${format(range.to, "MMM dd, yyyy")}`;
  }
  if (range.from) return `${format(range.from, "MMM dd, yyyy")} – Pick end date`;
  if (range.to) return `Due ${format(range.to, "MMM dd, yyyy")}`;
  return "Pick a date range";
}

export function DateRangePicker({
  startDate,
  dueDate,
  onStartDateChange,
  onDueDateChange,
  compact = false,
}: {
  startDate: string;
  dueDate: string;
  onStartDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  compact?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const selected: DateRange = {
    from: inputDate(startDate),
    to: inputDate(dueDate),
  };

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      setPortalContainer(rootRef.current?.closest("dialog") ?? null);
      setSelectingEnd(false);
    }
    setOpen(nextOpen);
  }

  function selectRange(range: DateRange | undefined) {
    if (!range?.from) {
      onStartDateChange("");
      onDueDateChange("");
      setSelectingEnd(false);
      return;
    }

    if (!selectingEnd) {
      onStartDateChange(dateInputValue(range.from));
      onDueDateChange("");
      setSelectingEnd(true);
      return;
    }

    onStartDateChange(dateInputValue(range?.from));
    onDueDateChange(dateInputValue(range?.to));

    if (range?.from && range.to) {
      setSelectingEnd(false);
      setOpen(false);
    }
  }

  function chooseSingleDate(kind: "start" | "due") {
    if (!startDate) return;

    if (kind === "due") {
      onDueDateChange(startDate);
      onStartDateChange("");
    } else {
      onDueDateChange("");
    }

    setSelectingEnd(false);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={compact ? "min-w-0 flex-1" : undefined}>
      <input type="hidden" name="startAt" value={startDate} />
      <input type="hidden" name="dueAt" value={dueDate} />

      <Popover.Root open={open} onOpenChange={changeOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`inline-flex w-full items-center justify-start gap-2 border border-slate-300 bg-white px-3 text-left font-normal outline-none transition hover:bg-slate-50 focus:border-[#689f38] focus:ring-2 focus:ring-[#8bc34a]/20 ${
              compact
                ? "h-9 rounded-lg text-xs"
                : "mt-2 h-10 rounded-xl text-sm"
            } ${
              selected.from ? "text-slate-800" : "text-slate-400"
            }`}
          >
            <CalendarDays size={16} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{rangeLabel(selected)}</span>
          </button>
        </Popover.Trigger>

        <Popover.Portal container={portalContainer ?? undefined}>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={16}
            className="z-50 max-w-[calc(100vw-2rem)] overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 shadow-2xl outline-none"
          >
            <DayPicker
              mode="range"
              selected={selected}
              onSelect={selectRange}
              defaultMonth={selected.from ?? selected.to}
              numberOfMonths={2}
              showOutsideDays
              className="card-date-range-calendar"
            />
            {(selected.from || selected.to) && (
              <div className="mt-2 flex flex-wrap items-center justify-end gap-1 border-t border-slate-100 pt-2">
                {selectingEnd && startDate && (
                  <>
                    <button
                      type="button"
                      onClick={() => chooseSingleDate("start")}
                      className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    >
                      Start date only
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseSingleDate("due")}
                      className="rounded-md px-2 py-1 text-xs font-semibold text-[#5c8f32] hover:bg-[#edf6e5]"
                    >
                      Due date only
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => selectRange(undefined)}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  Clear dates
                </button>
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
