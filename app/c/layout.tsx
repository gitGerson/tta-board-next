import { AuthenticatedShell } from "@/app/dashboard/_components/authenticated-shell";

export default function CardShortLinkLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
