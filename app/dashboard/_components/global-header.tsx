import { Bell, Filter, LogOut, Moon, Share2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/dashboard/actions";

/**
 * Buttons for features that are not built yet ship disabled rather than
 * silently doing nothing, but keep their full-colour look so the bar still
 * reads as the design intends.
 */
const ICON_BUTTON =
  "grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#689f38] disabled:cursor-not-allowed";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function GlobalHeader({
  user,
  title,
  count,
  subtitle,
  notificationCount = 0,
}: {
  user: { name: string; email: string };
  title: string;
  count?: number;
  subtitle?: string | null;
  notificationCount?: number;
}) {
  return (
    <header className="flex shrink-0 items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-[0_10px_24px_rgb(15_23_42/0.14)] sm:px-4">
      <div className="flex flex-1 items-center">
        <Link
          href="/"
          className="rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#689f38]"
        >
          <Image
            src="/appicon.png"
            alt="All boards"
            width={40}
            height={40}
            className="size-10 shrink-0 object-contain"
          />
        </Link>
      </div>

      <div className="min-w-0 px-1 text-center">
        <div className="flex min-w-0 items-center justify-center gap-2.5">
          <h1 className="truncate text-base font-extrabold uppercase tracking-[0.08em] text-slate-600 sm:text-xl">
            {title}
          </h1>
          {count !== undefined && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-500">
              {count}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-slate-400">{subtitle}</p>
        )}
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <button
          type="button"
          disabled
          title="Dark mode is not available yet"
          aria-label="Toggle dark mode"
          className={ICON_BUTTON}
        >
          <Moon size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled
          title="Sharing is not available yet"
          aria-label="Share board"
          className={`${ICON_BUTTON} hidden sm:grid`}
        >
          <Share2 size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled
          title="Filters are not available yet"
          aria-label="Filter cards"
          className={`${ICON_BUTTON} hidden sm:grid`}
        >
          <Filter size={18} aria-hidden="true" />
        </button>

        <div className="relative shrink-0">
          <button
            type="button"
            disabled
            title="Notifications are not available yet"
            aria-label="Notifications"
            className={ICON_BUTTON}
          >
            <Bell size={18} aria-hidden="true" />
          </button>
          {notificationCount > 0 && (
            <span className="pointer-events-none absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white ring-2 ring-white">
              {notificationCount > 99 ? "99+" : notificationCount}
            </span>
          )}
        </div>

        <details className="relative shrink-0">
          <summary
            className="relative grid size-10 cursor-pointer list-none place-items-center rounded-full bg-indigo-600 text-xs font-extrabold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#689f38]"
            aria-label={`Account menu for ${user.name}`}
          >
            {initials(user.name)}
            <span
              className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white bg-[#8bc34a]"
              aria-hidden="true"
            />
          </summary>
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <form action={logoutAction} className="pt-1.5">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-[#4f772d]"
              >
                <LogOut size={15} aria-hidden="true" />
                Log out
              </button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
