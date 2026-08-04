import type { SeoFaq } from "@/lib/seo";

export default function FaqSection({
  title = "سؤال‌های متداول",
  faqs,
}: {
  title?: string;
  faqs: SeoFaq[];
}) {
  if (faqs.length === 0) return null;

  return (
    <section dir="rtl" className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-xl font-extrabold text-gray-900 mb-5">
        {title}
      </h2>
      <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white shadow-sm">
        {faqs.map((faq) => (
          <details key={faq.question} className="group px-5 py-4">
            <summary className="cursor-pointer list-none text-sm font-bold text-gray-900 marker:hidden">
              <span className="inline-flex w-full items-center justify-between gap-4">
                {faq.question}
                <span className="shrink-0 text-lg leading-none text-ps-blue transition-transform group-open:rotate-45">
                  +
                </span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
