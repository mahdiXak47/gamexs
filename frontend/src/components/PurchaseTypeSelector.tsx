"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Avatar, Card, Chip, Table } from "@heroui/react";
import { useToast } from "@/context/ToastContext";
import { formatToman, toPersianDigits } from "@/lib/format";
import { bestOfferId, lowestPriceForOption } from "@/lib/purchase-options";
import type { PurchaseOption } from "@/lib/types";

function purchaseOptionHash(option: PurchaseOption) {
  if (option.type === "ACCOUNT_GAME") {
    switch (option.tier) {
      case "CAPACITY_1":
        return "buy-capacity_1";
      case "CAPACITY_2":
        return "buy-capacity_2";
      case "CAPACITY_3":
        return "buy-capacity_3";
      default:
        return "buy-account";
    }
  }

  if (option.type === "OWN_ACCOUNT_GAME") return "buy-full_capacity";
  if (option.type === "DISC") return "buy-disc";
  return "buy-option";
}

export default function PurchaseTypeSelector({ options }: { options: PurchaseOption[] }) {
  const defaultIndex = Math.max(0, options.findIndex((o) => o.offers.length > 0));
  const [selected, setSelected] = useState(defaultIndex);
  const [openDescription, setOpenDescription] = useState<string | null>(null);
  const option = options[selected];
  const selectedKey = `${option.type}-${option.tier ?? "x"}`;
  const selectOption = useCallback((index: number, updateHash: boolean) => {
    const nextOption = options[index];
    if (!nextOption) return;

    setSelected(index);
    setOpenDescription(null);

    if (updateHash && typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${purchaseOptionHash(nextOption)}`);
    }
  }, [options]);

  useEffect(() => {
    const selectFromHash = () => {
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      const index = options.findIndex((opt) => purchaseOptionHash(opt) === hash);
      if (index >= 0) selectOption(index, false);
    };

    selectFromHash();
    window.addEventListener("hashchange", selectFromHash);
    return () => window.removeEventListener("hashchange", selectFromHash);
  }, [options, selectOption]);

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
          const availableOffers = opt.offers.filter((offer) => offer.inStock && offer.priceToman > 0).length;
          const active = i === selected;
          const isMostPopular = opt.type === "ACCOUNT_GAME" && opt.tier === "CAPACITY_2";
          const key = `${opt.type}-${opt.tier ?? "x"}`;
          const hash = purchaseOptionHash(opt);
          const descriptionOpen = openDescription === key;
          return (
            <Card
              key={key}
              id={hash}
              role="button"
              tabIndex={0}
              onClick={() => selectOption(i, true)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                selectOption(i, true);
              }}
              className={`ui-lift-card cursor-pointer overflow-visible p-4 text-right ${
                active ? "-translate-y-0.5 border-2 border-warning shadow-lg shadow-amber-500/15" : "hover:border-accent"
              }`}
            >
              {/* Label row: in RTL, label is rightmost, ? sits immediately to its left */}
              <div className="flex flex-wrap items-start gap-1.5">
                <div className="font-bold leading-snug">{opt.label}</div>
                {isMostPopular && (
                  <span className="inline-flex min-h-5 items-center rounded-md border border-emerald-200 bg-emerald-100 px-2 text-[11px] font-extrabold leading-none text-emerald-800">
                    محبوب‌ترین
                  </span>
                )}
                {/* Tooltip trigger — placed after label so it's to its left in RTL */}
                <div className="group relative shrink-0 mt-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDescription((current) => current === key ? null : key);
                    }}
                    className="flex h-[18px] w-[18px] cursor-help items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-500 transition-colors hover:bg-gray-300 focus-visible:outline-none"
                    aria-expanded={descriptionOpen}
                    aria-label={`توضیح: ${opt.label}`}
                  >
                    ؟
</button>
                  {/* Tooltip panel */}
                  <div
                    className={`pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-xl bg-gray-900/95 p-3 text-right text-xs leading-relaxed text-white shadow-xl backdrop-blur-sm transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100 ${
                      descriptionOpen ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                    }`}
                    dir="rtl"
                  >
                    {opt.description}
                    {/* Arrow */}
                    <span className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-gray-900/95" />
                  </div>
                </div>
              </div>

              <div className="mt-1 text-xs text-muted">{opt.subtitle}</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-xs text-muted">از</span>
                <span className={`price-figure font-extrabold ${active ? "text-warning" : ""}`}>
                  {price === null ? "—" : formatToman(price)}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted">
                {stores === 0
                  ? "بدون فروشنده"
                  : availableOffers === 0
                    ? `${toPersianDigits(stores)} فروشگاه · فعلاً ناموجود`
                    : `${toPersianDigits(availableOffers)} پیشنهاد موجود`}
              </div>
            </Card>
          );
        })}
      </div>

      <div key={selectedKey} className="ui-fade-panel mt-6">
        {option.offers.length === 0 ? (
          <Alert status="default">
            <Alert.Indicator>ⓘ</Alert.Indicator>
            <Alert.Content>
              <Alert.Description>
                فعلاً هیچ فروشگاهی این روش خرید را برای این بازی ارائه نمی‌دهد. روش خرید دیگری را انتخاب کنید یا بعداً دوباره بررسی کنید.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : (
          <SellerTable option={option} />
        )}
      </div>
    </section>
  );
}

function SellerTable({ option }: { option: PurchaseOption }) {
  const toast = useToast();
  const best = bestOfferId(option);
  const availableCount = option.offers.filter((offer) => offer.inStock && offer.priceToman > 0).length;
  const hasOnlyUnavailableOffers = option.offers.length > 0 && availableCount === 0;
  const sortedOffers = [...option.offers].sort((a, b) => {
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    return a.priceToman - b.priceToman;
  });

  return (
    <div>
      <p className="mb-4 text-sm text-muted">{option.description}</p>
      {hasOnlyUnavailableOffers ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800" role="status">
          فروشنده‌هایی برای این روش خرید پیدا شده‌اند، اما در آخرین بررسی هیچ پیشنهاد موجود و قابل خریدی ثبت نشده است.
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-6 text-blue-800" role="note">
          برای خرید به سایت فروشنده منتقل می‌شوید. پیش از پرداخت، موجودی و قیمت نهایی را در همان سایت بررسی کنید.
        </div>
      )}
      <Table>
        <Table.ScrollContainer dir="rtl">
          <Table.Content aria-label="مقایسه قیمت فروشگاه‌ها" selectionMode="none">
            <Table.Header>
              <Table.Column isRowHeader className="w-10">
                #
              </Table.Column>
              <Table.Column>فروشگاه</Table.Column>
              <Table.Column>قیمت</Table.Column>
              <Table.Column>وضعیت</Table.Column>
              <Table.Column>{""}</Table.Column>
            </Table.Header>
            <Table.Body>
              {sortedOffers.map((offer, i) => {
                const isBest = offer.sellerId === best;
                const initial = offer.sellerName.trim()[0]?.toUpperCase() ?? "?";
                const canBuy = offer.inStock && offer.priceToman > 0;
                return (
                  <Table.Row key={offer.sellerId} id={offer.sellerId} className={`transition-colors duration-150 ${canBuy ? "hover:bg-blue-50/50" : "bg-gray-50/60"}`}>
                    <Table.Cell className="text-muted">{toPersianDigits(i + 1)}</Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        <Avatar size="sm">
                          <Avatar.Fallback>{initial}</Avatar.Fallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2 font-bold">
                            {offer.sellerName}
                            {isBest && (
                              <Chip variant="soft" color="success" size="sm">
                                بهترین قیمت
                              </Chip>
                            )}
                          </div>
                          <div className="text-xs text-muted">{offer.sellerDomain}</div>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {offer.priceToman > 0 ? (
                        <span className={`price-figure font-bold ${canBuy ? "" : "text-muted"}`}>
                          {formatToman(offer.priceToman)}{" "}
                          <span className="text-xs font-normal text-muted">تومان</span>
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-muted">قیمت نامشخص</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <span className={`inline-flex items-center gap-1.5 text-xs ${canBuy ? "" : "text-muted"}`}>
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${canBuy ? "bg-success" : "bg-muted"}`}
                        />
                        {canBuy ? "موجود" : "ناموجود"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      {canBuy ? (
                        <a
                          href={offer.listingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => toast.info("در حال انتقال به فروشگاه", `${offer.sellerName}؛ قیمت و موجودی نهایی را پیش از پرداخت بررسی کنید.`)}
                          className="inline-flex items-center justify-center rounded-3xl bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.97]"
                          aria-label={`خرید از فروشگاه ${offer.sellerName}`}
                        >
                          خرید از فروشگاه
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex cursor-not-allowed items-center justify-center rounded-3xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-400"
                          title="این پیشنهاد در آخرین بررسی موجود نبوده است"
                        >
                          ناموجود
                        </button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}
