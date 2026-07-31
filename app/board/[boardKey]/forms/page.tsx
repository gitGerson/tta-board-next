import Link from "next/link";
import { GlobalHeader } from "@/app/dashboard/_components/global-header";
import { requireCurrentUser } from "@/app/lib/dal/auth";
import { boardPath } from "@/app/lib/kanban/board-route";
import { listBoardForms } from "@/app/lib/forms/form-dal";
import { FormManager } from "./form-manager";

export const dynamic = "force-dynamic";

export default async function BoardFormsPage({
  params,
}: {
  params: Promise<{ boardKey: string }>;
}) {
  const { boardKey } = await params;
  const [{ board, forms }, user] = await Promise.all([
    listBoardForms(boardKey),
    requireCurrentUser(),
  ]);

  return (
    <main className="min-h-full bg-slate-100 px-4 py-4 pb-24 sm:px-6">
      <GlobalHeader user={user} title={`${board.name} Forms`} count={forms.length} />
      <div className="mx-auto mt-4 max-w-6xl">
        <Link
          href={boardPath(board.routeKey)}
          className="mb-3 inline-flex text-sm font-bold text-[#5c8f32] hover:underline"
        >
          ← Back to board
        </Link>
        <FormManager boardId={board.id} forms={forms} />
      </div>
    </main>
  );
}
