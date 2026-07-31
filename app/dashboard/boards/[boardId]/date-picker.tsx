"use client";

import * as Popover from "@radix-ui/react-popover";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useRef, useState } from "react";
import { DayPicker } from "react-day-picker";

function inputDate(value: string): Date | undefined {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
}

export function DatePicker({
  name,
  value,
  onChange,
  placeholder = "Pick a date",
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const selected = inputDate(value);

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      setPortalContainer(rootRef.current?.closest("dialog") ?? null);
    }
    setOpen(nextOpen);
  }

  return (
    <div ref={rootRef} className="min-w-0">
      <input type="hidden" name={name} value={value} />

      <Popover.Root open={open} onOpenChange={changeOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`inline-flex h-9 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-xs outline-none transition hover:bg-slate-50 focus:border-[#689f38] focus:ring-2 focus:ring-[#8bc34a]/20 ${
              selected ? "text-slate-800" : "text-slate-400"
            }`}
          >
            <CalendarDays size={16} className="shrink-0" aria-hidden="true" />
            <span className="truncate">
              {selected ? format(selected, "MMM dd, yyyy") : placeholder}
            </span>
          </button>
        </Popover.Trigger>

        <Popover.Portal container={portalContainer ?? undefined}>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={16}
            className="z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl outline-none"
          >
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={(date) => {
                onChange(date ? format(date, "yyyy-MM-dd") : "");
                if (date) setOpen(false);
              }}
              defaultMonth={selected}
              showOutsideDays
              className="card-date-range-calendar"
            />
            {selected && (
              <div className="mt-2 flex justify-end border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  Clear date
                </button>
              </div>
            )}
            <Popover.Arrow className="fill-white" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
