import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import { breadcrumbJsonLd, faqPageJsonLd, SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const PAGE_PATH = "/guide/ps5-capacity-accounts";
const PAGE_TITLE = "تفاوت اکانت‌های ظرفیتی PS5؛ ظرفیت ۱، ۲ و ۳ چه فرقی دارند؟";
const PAGE_DESCRIPTION =
  "تفاوت اکانت‌های ظرفیتی PS5 را بخوانید؛ ظرفیت ۱، ۲ و ۳، بازی آنلاین و آفلاین، استفاده با اکانت شخصی و نکات انتخاب قبل از خرید.";

const faqs = [
  {
    question: "تفاوت اکانت‌های ظرفیتی PS5 چیست؟",
    answer:
      "ظرفیت به نوع دسترسی و روش فعال‌سازی بازی روی اکانت اشاره دارد، نه حجم بازی. ظرفیت ۱، ۲ و ۳ هرکدام محدودیت‌های متفاوتی برای استفاده با اکانت شخصی، بازی آنلاین و آفلاین دارند.",
  },
  {
    question: "ظرفیت ۲ بهتر است یا ظرفیت ۳؟",
    answer:
      "اگر استفاده با اکانت شخصی و امکان بازی آفلاین برایتان مهم است، ظرفیت ۲ معمولاً انعطاف بیشتری دارد. اگر بیشتر آنلاین بازی می‌کنید و قیمت پایین‌تر مهم است، ظرفیت ۳ می‌تواند مناسب‌تر باشد؛ شرایط دقیق فروشنده را بررسی کنید.",
  },
  {
    question: "ارزان‌ترین ظرفیت PS5 کدام است؟",
    answer:
      "قیمت به بازی، فروشنده و وضعیت موجودی بستگی دارد. ظرفیت ۱ و ظرفیت ۳ اغلب قیمت پایین‌تری از ظرفیت ۲ دارند، اما برای انتخاب فقط به قیمت نگاه نکنید و محدودیت استفاده را هم بررسی کنید.",
  },
  {
    question: "ظرفیت ۳ بدون اینترنت کار می‌کند؟",
    answer:
      "ظرفیت ۳ معمولاً برای استفاده آنلاین و با اتصال اینترنت ارائه می‌شود. پیش از خرید، شرایط همان پیشنهاد و دستورالعمل فروشنده را بخوانید.",
  },
  {
    question: "برای بازی آفلاین کدام ظرفیت مناسب‌تر است؟",
    answer:
      "ظرفیت ۲ معمولاً برای کاربرانی که بازی آفلاین و استفاده با اکانت شخصی می‌خواهند انتخاب مناسب‌تری است. ظرفیت ۱ و ۳ ممکن است محدودیت بیشتری داشته باشند.",
  },
];

const breadcrumbSchema = breadcrumbJsonLd([
  { name: SITE_NAME, path: "/" },
  { name: "راهنمای خرید", path: "/guide" },
  { name: PAGE_TITLE, path: PAGE_PATH },
]);

const pageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  url: `${SITE_URL}${PAGE_PATH}`,
  inLanguage: "fa-IR",
  isPartOf: {
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  },
};

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: [
    "اکانت های ظرفیتی",
    "تفاوت ظرفیت ۱ ۲ ۳ PS5",
    "اکانت ظرفیتی PS5",
    "خرید اکانت ظرفیتی PS5",
    "ظرفیت ۱ PS5",
    "ظرفیت ۲ PS5",
    "ظرفیت ۳ PS5",
  ],
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}${PAGE_PATH}`,
    type: "article",
    locale: "fa_IR",
  },
};

function GuideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-bold text-ps-blue underline decoration-blue-200 underline-offset-4 transition-colors hover:text-blue-700"
    >
      {children}
    </Link>
  );
}

export default function Ps5CapacityAccountsGuide() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={pageSchema} />
      <JsonLd data={faqPageJsonLd(faqs)} />
      <Header />

      <main id="main-content" className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6" dir="rtl">
        <Breadcrumb
          items={[
            { label: "بازی‌های PS5", href: "/" },
            { label: "راهنمای خرید", href: "/guide" },
            { label: "تفاوت اکانت‌های ظرفیتی" },
          ]}
        />

        <article className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
          <header>
            <p className="text-sm font-bold text-ps-blue">راهنمای GameXS</p>
            <h1 className="mt-3 text-3xl font-black leading-tight text-gray-900 sm:text-4xl">
              {PAGE_TITLE}
            </h1>
            <p className="mt-5 max-w-4xl text-base leading-8 text-gray-600">
              اگر برای خرید بازی دیجیتال PS5 بین ظرفیت‌های ۱، ۲ و ۳ مردد هستید، این راهنما تفاوت روش دسترسی، امکان بازی آنلاین و آفلاین، استفاده با اکانت شخصی و نکات مهم قبل از خرید را توضیح می‌دهد.
            </p>
          </header>

          <section className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-5" aria-labelledby="quick-answer-heading">
            <h2 id="quick-answer-heading" className="text-lg font-extrabold text-gray-900">
              پاسخ کوتاه
            </h2>
            <p className="mt-3 text-sm leading-8 text-gray-700">
              ظرفیت ۱ معمولاً اقتصادی‌تر اما محدودتر است، ظرفیت ۲ برای بسیاری از کاربران انعطاف بیشتری دارد و ظرفیت ۳ معمولاً برای بازی آنلاین و کاربران همیشه متصل مناسب‌تر است. این توضیح کلی است؛ شرایط درج‌شده در صفحه هر فروشنده ملاک نهایی خرید است.
            </p>
          </section>

          <section className="mt-10" aria-labelledby="comparison-heading">
            <h2 id="comparison-heading" className="text-2xl font-extrabold text-gray-900">
              تفاوت ظرفیت‌های PS5 در یک نگاه
            </h2>
            <p className="mt-3 text-sm leading-8 text-gray-600">
              ظرفیت به نوع دسترسی کاربر به اکانت و بازی اشاره دارد، نه حجم بازی یا تعداد دفعات اجرای آن. جزئیات ممکن است بین فروشندگان متفاوت باشد.
            </p>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full min-w-[680px] border-collapse text-right text-sm">
                <caption className="sr-only">مقایسه ویژگی‌های اکانت ظرفیت ۱، ۲ و ۳ PS5</caption>
                <thead className="bg-gray-50 text-gray-900">
                  <tr>
                    <th scope="col" className="border-b border-gray-200 px-4 py-4 font-extrabold">ویژگی</th>
                    <th scope="col" className="border-b border-gray-200 px-4 py-4 font-extrabold">ظرفیت ۱</th>
                    <th scope="col" className="border-b border-gray-200 px-4 py-4 font-extrabold">ظرفیت ۲</th>
                    <th scope="col" className="border-b border-gray-200 px-4 py-4 font-extrabold">ظرفیت ۳</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600">
                  <tr><th scope="row" className="px-4 py-4 font-bold text-gray-900">استفاده با اکانت شخصی</th><td className="px-4 py-4">معمولاً محدود یا غیرقابل‌استفاده</td><td className="px-4 py-4">معمولاً امکان‌پذیر</td><td className="px-4 py-4">وابسته به شرایط فروشنده</td></tr>
                  <tr><th scope="row" className="px-4 py-4 font-bold text-gray-900">بازی آفلاین</th><td className="px-4 py-4">معمولاً محدود</td><td className="px-4 py-4">معمولاً امکان‌پذیر</td><td className="px-4 py-4">معمولاً امکان‌پذیر نیست</td></tr>
                  <tr><th scope="row" className="px-4 py-4 font-bold text-gray-900">بازی آنلاین</th><td className="px-4 py-4">محدود</td><td className="px-4 py-4">معمولاً امکان‌پذیر</td><td className="px-4 py-4">کاربرد اصلی</td></tr>
                  <tr><th scope="row" className="px-4 py-4 font-bold text-gray-900">نیاز به اینترنت</th><td className="px-4 py-4">وابسته به روش ارائه</td><td className="px-4 py-4">معمولاً کمتر</td><td className="px-4 py-4">معمولاً زیاد</td></tr>
                  <tr><th scope="row" className="px-4 py-4 font-bold text-gray-900">مناسب برای</th><td className="px-4 py-4">کاربرانی که قیمت پایین‌تر می‌خواهند</td><td className="px-4 py-4">کاربرانی که انعطاف بیشتری می‌خواهند</td><td className="px-4 py-4">بازی‌های آنلاین و کاربران همیشه متصل</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-10 grid gap-5 md:grid-cols-3" aria-label="توضیح ظرفیت‌ها">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <h2 className="text-xl font-extrabold text-gray-900">ظرفیت ۱ PS5 چیست؟</h2>
              <p className="mt-3 text-sm leading-8 text-gray-600">
                ظرفیت ۱ معمولاً گزینه‌ای اقتصادی‌تر با محدودیت بیشتر در نحوه استفاده است. پیش از خرید بررسی کنید بازی به چه اکانتی وابسته است و آیا شرایط فروشنده با شیوه استفاده شما سازگار است.
              </p>
              <GuideLink href="/capacity-1">مشاهده بازی‌های ظرفیت ۱</GuideLink>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <h2 className="text-xl font-extrabold text-gray-900">ظرفیت ۲ PS5 چیست؟</h2>
              <p className="mt-3 text-sm leading-8 text-gray-600">
                ظرفیت ۲ معمولاً برای کسانی جذاب است که می‌خواهند بازی را با اکانت شخصی خود اجرا کنند و امکان بازی آنلاین و آفلاین داشته باشند. فعال‌سازی صحیح و شرایط فروشنده را حتماً بخوانید.
              </p>
              <GuideLink href="/capacity-2">مشاهده بازی‌های ظرفیت ۲</GuideLink>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5">
              <h2 className="text-xl font-extrabold text-gray-900">ظرفیت ۳ PS5 چیست؟</h2>
              <p className="mt-3 text-sm leading-8 text-gray-600">
                ظرفیت ۳ معمولاً برای بازی آنلاین و کاربرانی ارائه می‌شود که اتصال اینترنت دائمی دارند. محدودیت‌های ورود، فعال‌سازی و استفاده را قبل از پرداخت با توضیحات فروشنده تطبیق دهید.
              </p>
              <GuideLink href="/capacity-3">مشاهده بازی‌های ظرفیت ۳</GuideLink>
            </div>
          </section>

          <section className="mt-10" aria-labelledby="choose-heading">
            <h2 id="choose-heading" className="text-2xl font-extrabold text-gray-900">کدام ظرفیت را انتخاب کنم؟</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 p-5"><p className="text-lg font-extrabold text-gray-900">کمترین هزینه</p><p className="mt-2 text-sm leading-7 text-gray-600">اگر محدودیت‌های استفاده برایتان قابل‌قبول است، ظرفیت ۱ را بررسی کنید.</p></div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><p className="text-lg font-extrabold text-gray-900">اکانت شخصی و آفلاین</p><p className="mt-2 text-sm leading-7 text-gray-600">برای انعطاف بیشتر، معمولاً ظرفیت ۲ گزینه مناسب‌تری است.</p></div>
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5"><p className="text-lg font-extrabold text-gray-900">بازی آنلاین</p><p className="mt-2 text-sm leading-7 text-gray-600">اگر همیشه آنلاین هستید، قیمت و شرایط ظرفیت ۳ را مقایسه کنید.</p></div>
            </div>
          </section>

          <section className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-5" aria-labelledby="checklist-heading">
            <h2 id="checklist-heading" className="text-xl font-extrabold text-gray-900">قبل از خرید اکانت ظرفیتی چه چیزهایی را بررسی کنیم؟</h2>
            <ul className="mt-4 grid gap-3 text-sm leading-7 text-gray-700 sm:grid-cols-2">
              <li>✓ ظرفیت دقیق پیشنهاد را بررسی کنید.</li>
              <li>✓ شرایط بازی آنلاین و آفلاین را بخوانید.</li>
              <li>✓ امکان استفاده با اکانت شخصی را بررسی کنید.</li>
              <li>✓ دستورالعمل فعال‌سازی فروشنده را مطالعه کنید.</li>
              <li>✓ ضمانت، پشتیبانی و شرایط بازگشت را بپرسید.</li>
              <li>✓ ریجن و موجودی را پیش از پرداخت تطبیق دهید.</li>
            </ul>
          </section>

          <section className="mt-10 border-t border-gray-100 pt-8" aria-labelledby="gamexs-role-heading">
            <h2 id="gamexs-role-heading" className="text-xl font-extrabold text-gray-900">نقش GameXS در خرید چیست؟</h2>
            <p className="mt-3 text-sm leading-8 text-gray-600">
              GameXS فروشگاه نیست و پرداخت یا تحویل اکانت انجام نمی‌دهد. ما قیمت، نوع ظرفیت، فروشنده، موجودی و لینک منبع را کنار هم نمایش می‌دهیم تا قبل از رفتن به سایت فروشنده مقایسه دقیق‌تری داشته باشید. برای مشاهده پیشنهادها، به صفحه <GuideLink href="/account-games">مقایسه اکانت بازی‌های PS5</GuideLink> بروید.
            </p>
          </section>

          <section className="mt-10 border-t border-gray-100 pt-8" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-2xl font-extrabold text-gray-900">سؤالات متداول درباره اکانت‌های ظرفیتی PS5</h2>
            <div className="mt-5 divide-y divide-gray-100 rounded-2xl border border-gray-200">
              {faqs.map((faq) => (
                <details key={faq.question} className="group px-5 py-4">
                  <summary className="cursor-pointer list-none text-sm font-bold text-gray-900 marker:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {faq.question}
                      <span className="shrink-0 text-lg leading-none text-ps-blue transition-transform group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-8 text-gray-600">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <footer className="mt-10 rounded-2xl bg-gray-900 p-6 text-center text-white">
            <h2 className="text-xl font-extrabold">هنوز نمی‌دانید کدام ظرفیت مناسب شماست؟</h2>
            <p className="mt-2 text-sm leading-7 text-white/70">قیمت و شرایط ظرفیت‌های مختلف را برای بازی‌های PS5 مقایسه کنید.</p>
            <Link href="/account-games" className="mt-5 inline-flex rounded-xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-gray-950 transition-colors hover:bg-amber-300">
              مشاهده اکانت‌های ظرفیتی PS5
            </Link>
          </footer>
        </article>
      </main>
    </>
  );
}
