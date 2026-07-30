import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth/session";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#f4f7f1] px-5 py-10 text-[#26351c]">
      <section className="mx-auto max-w-2xl overflow-hidden bg-white shadow-xl shadow-green-950/10">
        <div className="h-2 bg-[#8bc34a]" />
        <div className="p-8 sm:p-10">
          <div className="mb-8 flex items-center gap-4">
            <Image
              src="/appicon.png"
              alt=""
              width={64}
              height={64}
              className="object-contain"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-[#689f38]">
                Authenticated
              </p>
              <h1 className="text-2xl font-bold">
                Welcome, {session.user.name}
              </h1>
            </div>
          </div>

          <dl className="grid gap-4 border-y border-green-950/10 py-6 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Username
              </dt>
              <dd className="mt-1 font-medium">{session.user.username}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Email
              </dt>
              <dd className="mt-1 font-medium">{session.user.email}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Directory ID
              </dt>
              <dd className="mt-1 break-all font-mono text-sm">
                {session.user.id}
              </dd>
            </div>
          </dl>

          <form action={logoutAction} className="mt-8">
            <button
              type="submit"
              className="bg-[#8bc34a] px-6 py-3 font-semibold text-white transition hover:bg-[#689f38] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#4a7c2a]"
            >
              Log out
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
