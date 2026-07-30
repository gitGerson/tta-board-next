import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth/session";
import { listBoards } from "@/app/lib/dal/boards";
import { FloatingNav } from "./floating-nav";

export async function AuthenticatedShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const boards = await listBoards();

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f7f1] text-slate-900">
      {children}
      <FloatingNav boards={boards} />
    </div>
  );
}
