import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thoorigai Ledger | Bill Collection Tracker",
  description: "A clear view of bills, collections, and follow-ups.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
