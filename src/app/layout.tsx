import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matane",
  description: "Recurring events with RSVP capacity, guest counts, and waitlists.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
