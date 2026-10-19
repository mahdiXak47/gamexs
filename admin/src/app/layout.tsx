import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import "./globals.css";

const firaSans = Fira_Sans({ variable: "--font-fira-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const firaCode = Fira_Code({ variable: "--font-fira-code", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "GameXS Ops", template: "%s · GameXS Ops" },
  description: "Internal scraping pipeline monitor for GameXS administrators.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" className={`dark ${firaSans.variable} ${firaCode.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
