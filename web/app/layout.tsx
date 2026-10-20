import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rehearse your first date · The Garden",
  description: "You matched. Your AI twins rehearse a whole first date at real places Qloo picks for both of you, and you get the day that went best.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
