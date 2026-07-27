import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import AuthModal from "@/components/AuthModal";
import Footer from "@/components/Footer";

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
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} h-full antialiased`}>
      <body suppressHydrationWarning>
        <a href="#main-content" className="skip-link">رفتن به محتوای اصلی</a>
        <AuthProvider>
          <AuthModal />
          {children}
          <Footer />
        </AuthProvider>
        <Script
          id="goftino-widget"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function(){var i="LAkQac",a=window,d=document;function g(){var g=d.createElement("script"),s="https://www.goftino.com/widget/"+i,l=localStorage.getItem("goftino_"+i);g.async=!0,g.src=l?s+"?o="+l:s;d.getElementsByTagName("head")[0].appendChild(g);}"complete"===d.readyState?g():a.attachEvent?a.attachEvent("onload",g):a.addEventListener("load",g,!1);}();`,
          }}
        />
      </body>
    </html>
  );
}
