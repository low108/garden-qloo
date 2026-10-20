import type { Metadata } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "./globals.css";

// Hinge pairs a headline serif (Tiempos) with a geometric sans (Modern Era); these are the closest free faces.
const serif = Newsreader({ subsets: ["latin"], variable: "--serif", style: ["normal", "italic"], weight: ["400", "500", "600"] });
const sans = DM_Sans({ subsets: ["latin"], variable: "--sans", weight: ["400", "500", "700"] });

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
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
