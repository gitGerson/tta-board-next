"use client";

import { ChevronUp, LayoutGrid, Pin, PinOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { BoardSummaryDTO } from "@/app/lib/dal/boards";

type Tab = "all" | "pinned";

/**
 * Pins are a per-browser preference: the schema has no place for them, so the
 * list lives in localStorage and is exposed as an external store, which keeps
 * the server render empty and stays in sync across tabs.
 */
const PINNED_KEY = "tta-board:pinned-boards";
const NO_PINS: string[] = [];

let snapshot: string[] | null = null;
const listeners = new Set<() => void>();

function readPinned(): string[] {
  try {
    const raw = window.localStorage.getItem(PINNED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return NO_PINS;
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return NO_PINS;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== PINNED_KEY) return;
  snapshot = null;
  emit();
}

function subscribePinned(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function pinnedSnapshot(): string[] {
  snapshot ??= readPinned();
  return snapshot;
}

function noPinsOnServer(): string[] {
  return NO_PINS;
}

function writePinned(next: string[]): void {
  snapshot = next;
  try {
    window.localStorage.setItem(PINNED_KEY, JSON.stringify(next));
  } catch {
    // A blocked storage quota should not break navigation.
  }
  emit();
}

export function FloatingNav({ boards }: { boards: BoardSummaryDTO[] }) {
  const pathname = usePathname();
  const pinned = useSyncExternalStore(
    subscribePinned,
    pinnedSnapshot,
    noPinsOnServer,
  );
  /**
   * Remembering where the panel was opened closes it as soon as the route
   * changes, so it never hangs over the board the user just navigated to.
   */
  const [panel, setPanel] = useState<{ tab: Tab; pathname: string } | null>(
    null,
  );
  const openTab = panel?.pathname === pathname ? panel.tab : null;

  useEffect(() => {
    if (!openTab) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPanel(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openTab]);

  function togglePin(boardId: string) {
    writePinned(
      pinned.includes(boardId)
        ? pinned.filter((id) => id !== boardId)
        : [...pinned, boardId],
    );
  }

  function toggleTab(tab: Tab) {
    setPanel(openTab === tab ? null : { tab, pathname });
  }

  const visible =
    openTab === "pinned"
      ? boards.filter((board) => pinned.includes(board.id))
      : boards;

  const tabClass = (tab: Tab) =>
    `inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#689f38] ${
      openTab === tab
        ? "bg-[#689f38] text-white"
        : "bg-[#e8f3dc] text-[#4f772d] hover:bg-[#dbecc8]"
    }`;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-sm">
        {openTab && (
          <div className="mb-2 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_16px_40px_rgb(15_23_42/0.24)]">
            <p className="border-b border-slate-100 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
              {openTab === "pinned" ? "Pinned boards" : "All boards"}
            </p>
            {visible.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                {openTab === "pinned"
                  ? "Pin a board to keep it here."
                  : "No boards yet."}
              </p>
            ) : (
              <ul className="kanban-scroll max-h-72 overflow-y-auto p-1.5">
                {visible.map((board) => {
                  const href = `/dashboard/boards/${board.id}`;
                  const isPinned = pinned.includes(board.id);
                  return (
                    <li key={board.id} className="flex items-center gap-1">
                      <Link
                        href={href}
                        onClick={() => setPanel(null)}
                        className={`min-w-0 flex-1 rounded-lg px-2.5 py-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#689f38] ${
                          pathname === href
                            ? "bg-[#edf6e5] text-[#4f772d]"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="block truncate text-sm font-semibold">
                          {board.name}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {board.cardCount} cards · {board.columnCount} columns
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => togglePin(board.id)}
                        aria-pressed={isPinned}
                        aria-label={
                          isPinned ? `Unpin ${board.name}` : `Pin ${board.name}`
                        }
                        className={`grid size-9 shrink-0 place-items-center rounded-lg transition hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-[#689f38] ${
                          isPinned ? "text-[#5c8f32]" : "text-slate-300"
                        }`}
                      >
                        {isPinned ? (
                          <PinOff size={16} aria-hidden="true" />
                        ) : (
                          <Pin size={16} aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <nav
          aria-label="Board navigation"
          className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white p-2 shadow-[0_10px_30px_rgb(15_23_42/0.22)]"
        >
          <button
            type="button"
            onClick={() => toggleTab("all")}
            aria-expanded={openTab === "all"}
            className={tabClass("all")}
          >
            <LayoutGrid size={16} aria-hidden="true" />
            Boards
          </button>
          <button
            type="button"
            onClick={() => toggleTab("pinned")}
            aria-expanded={openTab === "pinned"}
            className={tabClass("pinned")}
          >
            <Pin size={16} aria-hidden="true" />
            Pinned Board
          </button>
          <button
            type="button"
            onClick={() => setPanel(openTab ? null : { tab: "all", pathname })}
            aria-expanded={openTab !== null}
            aria-label={openTab ? "Collapse board list" : "Expand board list"}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-3 focus-visible:outline-[#689f38]"
          >
            <ChevronUp
              size={18}
              aria-hidden="true"
              className={`transition-transform ${openTab ? "rotate-180" : ""}`}
            />
          </button>
        </nav>
      </div>
    </div>
  );
}
