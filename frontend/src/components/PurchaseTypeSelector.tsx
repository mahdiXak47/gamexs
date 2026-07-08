"use client";

import { useState } from "react";
import { formatToman, toPersianDigits } from "@/lib/format";
import { bestOfferId, lowestPriceForOption } from "@/lib/purchase-options";
import { seller } from "@/lib/sellers";
import type { PurchaseOption } from "@/lib/types";

export default function PurchaseTypeSelector({ options }: { options: PurchaseOption[] }) {
  const defaultIndex = Math.max(0, options.findIndex((o) => o.offers.length > 0));
  const [selected, setSelected] = useState(defaultIndex);
  const option = options[selected];

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">نوع خرید را انتخاب کنید</h2>
      <p className="mt-1 text-sm text-muted">
        یک بازی می‌تواند به چند روش عرضه شود؛ هر روش قیمت و شرایط متفاوتی دارد.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {options.map((opt, i) => {
          const price = lowestPriceForOption(opt);
          const stores = new Set(opt.offers.map((o) => o.sellerId)).size;
          const active = i === selected;
          return (
            <button
              key={`${opt.type}-${opt.tier ?? "x"}`}
              onClick={() => setSelected(i)}
              className={`rounded-xl border p-4 text-right transition-colors ${
                active ? "border-cta bg-surface-strong" : "border-border bg-surface hover:border-accent"
              }`}
            >
              <div className="font-bold">{opt.label}</div>
              <div className="mt-1 text-xs text-muted">{opt.subtitle}</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-xs text-muted">از</span>
                <span className={`font-extrabold ${active ? "text-cta" : ""}`}>
                  {price === null ? "—" : formatToman(price)}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted">{toPersianDigits(stores)} فروشگاه</div>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {option.offers.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
            فعلاً هیچ فروشگاهی این روش خرید را برای این بازی ارائه نمی‌دهد.
          </div>
        ) : (
          <SellerTable option={option} />
        )}
      </div>
    </section>
  );
}

function SellerTable({ option }: { option: PurchaseOption }) {
  const best = bestOfferId(option);
  const sorted = [...option.offers].sort((a, b) => a.priceToman - b.priceToman);

  return (
    <div>
      <p className="mb-4 text-sm text-muted">{option.description}</p>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-right text-xs text-muted">
              <th className="px-4 py-3 font-normal">#</th>
              <th className="px-4 py-3 font-normal">فروشگاه</th>
              <th className="px-4 py-3 font-normal">قیمت</th>
              <th className="px-4 py-3 font-normal">وضعیت</th>
              <th className="px-4 py-3 font-normal" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((offer, i) => {
              const s = seller(offer.sellerId);
              const isBest = offer.sellerId === best;
              return (
                <tr
                  key={offer.sellerId}
                  className={`border-b border-border last:border-b-0 ${
                    isBest ? "bg-success/[0.08]" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-muted">{toPersianDigits(i + 1)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-strong text-xs font-bold">
                        {s.initial}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 font-bold">
                          {s.name}
                          {isBest && (
                            <span className="rounded-md bg-success/[0.16] px-1.5 py-0.5 text-[10px] font-bold text-success">
                              بهترین قیمت
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted">{s.domain}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold">
                    {formatToman(offer.priceToman)} <span className="text-xs font-normal text-muted">تومان</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className={`h-1.5 w-1.5 rounded-full ${offer.inStock ? "bg-success" : "bg-muted"}`} />
                      {offer.inStock ? "موجود" : "ناموجود"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://${s.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-cta px-3 py-2 text-xs font-bold text-white"
                    >
                      خرید از فروشگاه ↗
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
