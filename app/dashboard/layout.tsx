import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth/session";
import { logoutAction } from "./actions";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const initials = session.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f4f7f1] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-green-950/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#689f38]"
          >
            <Image
              src="/appicon.png"
              alt=""
              width={38}
              height={38}
              className="shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#35581f]">
                TTA Board
              </p>
              <p className="hidden text-xs text-slate-500 sm:block">
                Team workspace
              </p>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-48 truncate text-sm font-semibold">
                {session.user.name}
              </p>
              <p className="max-w-48 truncate text-xs text-slate-500">
                {session.user.email}
              </p>
            </div>
            <span
              className="grid size-9 place-items-center rounded-full bg-[#e8f3dc] text-xs font-bold text-[#4f772d]"
              aria-label={`Signed in as ${session.user.name}`}
            >
              {initials}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#8bc34a] hover:text-[#4f772d] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#689f38]"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
