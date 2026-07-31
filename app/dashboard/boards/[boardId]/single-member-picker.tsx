"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import type { AssignableUserDTO } from "@/app/lib/dal/users";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function SingleMemberPicker({
  users,
  value,
  disabled,
  onChange,
}: {
  users: AssignableUserDTO[];
  value: string;
  disabled: boolean;
  onChange: (userId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const selected = users.find((user) => user.id === value);
  const filteredUsers = users.filter((user) => {
    const search = query.trim().toLocaleLowerCase();
    return (
      !search ||
      user.name.toLocaleLowerCase().includes(search) ||
      user.username.toLocaleLowerCase().includes(search)
    );
  });

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      setPortalContainer(rootRef.current?.closest("dialog") ?? null);
    } else {
      setQuery("");
    }
    setOpen(nextOpen);
  }

  function select(userId: string) {
    onChange(userId);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="min-w-0">
      <Popover.Root open={open} onOpenChange={changeOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="inline-flex h-9 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 text-left text-xs outline-none hover:bg-slate-50 focus:border-[#689f38] focus:ring-2 focus:ring-[#8bc34a]/20 disabled:opacity-60"
            aria-label="Select PIC"
          >
            {selected ? (
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#689f38] text-[9px] font-black text-white">
                {initials(selected.name)}
              </span>
            ) : (
              <UserRound size={14} className="shrink-0 text-slate-400" />
            )}
            <span
              className={`min-w-0 flex-1 truncate ${
                selected ? "font-semibold text-slate-700" : "text-slate-400"
              }`}
            >
              {selected?.name || "No PIC"}
            </span>
            <ChevronDown size={12} className="shrink-0 text-slate-400" />
          </button>
        </Popover.Trigger>

        <Popover.Portal container={portalContainer ?? undefined}>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className="z-[70] w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl outline-none"
          >
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search card members…"
                className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-sm outline-none focus:border-[#689f38]"
              />
            </div>
            <div className="thin-scrollbar mt-2 max-h-52 space-y-0.5 overflow-y-auto">
              <button
                type="button"
                onClick={() => select("")}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100"
              >
                <span className="grid size-7 place-items-center rounded-full bg-slate-100 text-slate-400">
                  <UserRound size={13} />
                </span>
                <span className="flex-1 text-xs font-semibold text-slate-600">
                  No PIC
                </span>
                {!value && <Check size={14} className="text-[#689f38]" />}
              </button>
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => select(user.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-black text-slate-600">
                    {initials(user.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-slate-700">
                      {user.name}
                    </span>
                    <span className="block truncate text-[10px] text-slate-400">
                      @{user.username}
                    </span>
                  </span>
                  {value === user.id && (
                    <Check size={14} className="text-[#689f38]" />
                  )}
                </button>
              ))}
            </div>
            <Popover.Arrow className="fill-white" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
