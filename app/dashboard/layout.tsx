import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!(await getSession())) {
    redirect("/login");
  }

  return children;
}
