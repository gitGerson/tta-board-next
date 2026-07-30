"use server";

import { redirect } from "next/navigation";
import { deleteSession } from "@/app/lib/auth/session";

export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
