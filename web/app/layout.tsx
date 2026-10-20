import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rehearse your first dinner · The Garden",
  description: "You matched. Your AI twins have dinner at every restaurant Qloo picks for both of you, and you get the top three, with proof.",
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
