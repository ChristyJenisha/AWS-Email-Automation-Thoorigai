import type { Metadata } from "next";
import "./globals.css";
import { DataProvider } from "../lib/DataContext";
import { AppShell } from "../components/layout/AppShell";

export const metadata: Metadata = {
  title: "Thoorigai Ledger | Bill Collection Tracker",
  description: "A clear view of bills, collections, and follow-ups.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <DataProvider>
          <AppShell>{children}</AppShell>
        </DataProvider>
      </body>
    </html>
  );
}
