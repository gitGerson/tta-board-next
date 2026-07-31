"use client";

import * as Popover from "@radix-ui/react-popover";
import {
  Check,
  ChevronDown,
  Crown,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";
import {
  updateCardMembersAction,
  type KanbanActionResult,
} from "@/app/dashboard/boards/actions";
import type { UserOptionDTO } from "@/app/lib/dal/boards";
import type { AssignableUserDTO } from "@/app/lib/dal/users";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function CardMemberEditor({
  cardId,
  members,
  users,
  picId,
  onError,
  onSaved,
}: {
  cardId: string;
  members: UserOptionDTO[];
  users: AssignableUserDTO[];
  picId: string | null;
  onError: (result: KanbanActionResult | null) => void;
  onSaved: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(members.map((member) => member.id)),
  );
  const [selectedPicId, setSelectedPicId] = useState<string | null>(picId);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const memberById = new Map([
    ...members.map((member) => [member.id, member] as const),
    ...users.map((user) => [user.id, user] as const),
  ]);
  const selectedMembers = [...selectedIds]
    .map((id) => memberById.get(id))
    .filter((member): member is UserOptionDTO => Boolean(member))
    .sort((left, right) => left.name.localeCompare(right.name));
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
      setSelectedIds(new Set(members.map((member) => member.id)));
      setSelectedPicId(picId);
    } else {
      setQuery("");
    }
    setOpen(nextOpen);
  }

  function toggle(userId: string) {
    if (selectedIds.has(userId) && selectedPicId === userId) {
      setSelectedPicId(null);
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else next.add(userId);
      return next;
    });
  }

  function save() {
    onError(null);
    startTransition(async () => {
      const result = await updateCardMembersAction({
        cardId,
        memberIds: [...selectedIds],
        picId: selectedPicId,
      });
      onError(result.ok ? null : result);
      if (!result.ok) return;

      setOpen(false);
      onSaved();
    });
  }

  return (
    <div ref={rootRef}>
      <div className="mb-2 flex items-center gap-1.5">
        <Users size={14} className="text-slate-400" aria-hidden="true" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Members
        </h3>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {selectedMembers.map((member) => (
          <span
            key={member.id}
            title={member.name}
            className="inline-flex h-7 items-center gap-1.5 rounded-full bg-slate-100 pl-1 pr-2.5 text-xs font-semibold text-slate-700"
          >
            <span className="grid size-5 place-items-center rounded-full bg-[#689f38] text-[9px] font-black text-white">
              {initials(member.name)}
            </span>
            <span className="max-w-32 truncate">{member.name}</span>
            {member.id === picId && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-700">
                PIC
              </span>
            )}
          </span>
        ))}

        <Popover.Root open={open} onOpenChange={changeOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 text-xs font-bold text-slate-500 transition hover:border-[#689f38] hover:text-[#5c8f32]"
            >
              <UserPlus size={13} aria-hidden="true" />
              Manage
              <ChevronDown size={11} aria-hidden="true" />
            </button>
          </Popover.Trigger>
          <Popover.Portal container={portalContainer}>
            <Popover.Content
              sideOffset={6}
              align="start"
              className="z-[70] w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
            >
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search users…"
                  className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-sm outline-none focus:border-[#689f38]"
                />
              </div>
              <div className="thin-scrollbar mt-2 max-h-56 space-y-0.5 overflow-y-auto">
                {filteredUsers.map((user) => {
                  const selected = selectedIds.has(user.id);
                  return (
                    <div
                      key={user.id}
                      className="flex w-full items-center gap-1 rounded-lg px-1 py-0.5 hover:bg-slate-100"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(user.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left"
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
                        <span
                          className={`grid size-5 place-items-center rounded border ${
                            selected
                              ? "border-[#689f38] bg-[#689f38] text-white"
                              : "border-slate-300 text-transparent"
                          }`}
                        >
                          <Check size={12} aria-hidden="true" />
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={!selected}
                        onClick={() =>
                          setSelectedPicId((current) =>
                            current === user.id ? null : user.id,
                          )
                        }
                        title={
                          selectedPicId === user.id
                            ? "Remove PIC role"
                            : "Mark as PIC"
                        }
                        aria-label={
                          selectedPicId === user.id
                            ? `Remove ${user.name} as PIC`
                            : `Mark ${user.name} as PIC`
                        }
                        className={`grid size-7 shrink-0 place-items-center rounded-md disabled:cursor-not-allowed disabled:opacity-30 ${
                          selectedPicId === user.id
                            ? "bg-amber-100 text-amber-700"
                            : "text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                        }`}
                      >
                        <Crown size={14} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                  aria-label="Cancel"
                >
                  <X size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={isPending || selectedIds.size === 0}
                  className="h-8 rounded-lg bg-[#689f38] px-3 text-xs font-bold text-white disabled:opacity-50"
                >
                  {isPending ? "Saving…" : "Save"}
                </button>
              </div>
              <Popover.Arrow className="fill-white" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  );
}
