import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import { faqPageJsonLd, SITE_URL, taxonomyFaqs } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "راهنمای خرید بازی و اشتراک PS5",
  description: "راهنمای فارسی GameXS برای تفاوت ظرفیت‌های اکانت، دیسک، خرید برای اکانت شخصی و اشتراک PS Plus.",
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "راهنمای خرید بازی و اشتراک PS5",
    description: "تفاوت انواع خرید بازی و اشتراک PS5 را قبل از مقایسه قیمت بشناسید.",
    url: `${SITE_URL}/guide`,
  },
};

const faqs = taxonomyFaqs();

export default function GuidePage() {
  return (
    <>
      <JsonLd data={faqPageJsonLd(faqs)} />
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6" dir="rtl">
        <Breadcrumb items={[{ label: "بازی‌های PS5", href: "/" }, { label: "راهنمای خرید" }]} />
        <article className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-sm font-bold text-ps-blue">راهنمای GameXS</p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-gray-900">راهنمای انتخاب بازی و اشتراک PS5</h1>
          <p className="mt-5 text-sm leading-8 text-gray-600">
            GameXS قیمت و شرایط پیشنهادهای فروشندگان ایرانی را کنار هم قرار می‌دهد. این راهنما کمک می‌کند قبل از باز کردن لینک فروشنده، تفاوت نوع محصول و محدودیت‌های هر گزینه را بدانید.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <section className="rounded-2xl bg-blue-50 p-5">
              <h2 className="text-lg font-extrabold text-gray-900">ظرفیت‌های اکانت بازی</h2>
              <p className="mt-3 text-sm leading-8 text-gray-600">ظرفیت ۱ معمولاً آفلاین، ظرفیت ۲ آنلاین و آفلاین، و ظرفیت ۳ آنلاین است. این نام‌گذاری بین فروشندگان ممکن است شرایط متفاوتی داشته باشد؛ توضیحات همان فروشنده ملاک نهایی است.</p>
            </section>
            <section className="rounded-2xl bg-amber-50 p-5">
              <h2 className="text-lg font-extrabold text-gray-900">دیسک بازی</h2>
              <p className="mt-3 text-sm leading-8 text-gray-600">دیسک نسخه فیزیکی بازی است و مانند اکانت اشتراکی به ورود به حساب فروشنده وابسته نیست. وضعیت ریجن و نو یا کارکرده بودن را پیش از خرید بپرسید.</p>
            </section>
            <section className="rounded-2xl bg-emerald-50 p-5">
              <h2 className="text-lg font-extrabold text-gray-900">خرید برای اکانت شخصی</h2>
              <p className="mt-3 text-sm leading-8 text-gray-600">این گزینه برای پیشنهادهایی است که فروشنده فعال‌سازی روی اکانت خود خریدار را ارائه می‌کند. ریجن، روش فعال‌سازی و امکان بازگشت وجه را بررسی کنید.</p>
            </section>
            <section className="rounded-2xl bg-violet-50 p-5">
              <h2 className="text-lg font-extrabold text-gray-900">اشتراک PlayStation Plus</h2>
              <p className="mt-3 text-sm leading-8 text-gray-600">Essential، Extra و Premium سطح‌های اصلی PS Plus هستند. مدت، ریجن، ظرفیت و روش تحویل می‌تواند بین فروشندگان متفاوت باشد.</p>
            </section>
          </div>

          <section className="mt-10 border-t border-gray-100 pt-8">
            <h2 className="text-xl font-extrabold text-gray-900">پرسش‌های متداول</h2>
            <div className="mt-5 space-y-5">
              {faqs.map((faq) => (
                <div key={faq.question}>
                  <h3 className="font-bold text-gray-900">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-8 text-gray-600">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>
        </article>
      </main>
    </>
  );
}
