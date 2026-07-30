import { AuthenticatedShell } from "./_components/authenticated-shell";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
