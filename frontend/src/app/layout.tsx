import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "GameXS — مقایسه قیمت بازی‌های PS5",
  description: "مقایسه قیمت بازی، اکانت و اشتراک PS5 بین فروشندگان ایرانی",
  openGraph: {
    title: "GameXS — مقایسه قیمت بازی‌های PS5",
    description: "مقایسه قیمت بازی، اکانت و اشتراک PS5 بین فروشندگان ایرانی",
    type: "website",
    locale: "fa_IR",
    siteName: "GameXS",
  },
  twitter: {
    card: "summary",
    title: "GameXS — مقایسه قیمت بازی‌های PS5",
    description: "مقایسه قیمت بازی، اکانت و اشتراک PS5 بین فروشندگان ایرانی",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} h-full antialiased dark`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
