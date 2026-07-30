import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: process.env.APP_NAME || "Tong Tji Starter Kit",
    template: `%s | ${process.env.APP_NAME || "Tong Tji Starter Kit"}`,
  },
  description: "Tong Tji Starter Kit LDAP authentication portal.",
  icons: {
    icon: "/appicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${publicSans.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
