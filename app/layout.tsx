import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { getSections } from "@/lib/vault";

export const metadata: Metadata = {
  title: {
    default: "Kyrylo",
    template: "%s · Kyrylo",
  },
  description:
    "Kyrylo's writing, projects, notes, and the occasional strong opinion.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sidebar navigation is generated from vault folders at build time.
  const items = getSections().map(({ slug, title, icon }) => ({
    slug,
    title,
    icon,
  }));

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar items={items} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
