"use client";

import { useState } from "react";
import { Alert, Avatar, Card, Chip, Table } from "@heroui/react";
import { formatToman, toPersianDigits } from "@/lib/format";
import { bestOfferId, lowestPriceForOption } from "@/lib/purchase-options";
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
            <Card
              key={`${opt.type}-${opt.tier ?? "x"}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(i)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && setSelected(i)}
              className={`cursor-pointer p-4 text-right transition-colors ${
                active ? "border-2 border-warning" : "hover:border-accent"
              }`}
            >
              <div className="font-bold">{opt.label}</div>
              <div className="mt-1 text-xs text-muted">{opt.subtitle}</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-xs text-muted">از</span>
                <span className={`price-figure font-extrabold ${active ? "text-warning" : ""}`}>
                  {price === null ? "—" : formatToman(price)}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted">{toPersianDigits(stores)} فروشگاه</div>
            </Card>
          );
        })}
      </div>

      <div className="mt-6">
        {option.offers.length === 0 ? (
          <Alert status="default">
            <Alert.Indicator>ⓘ</Alert.Indicator>
            <Alert.Content>
              <Alert.Description>
                فعلاً هیچ فروشگاهی این روش خرید را برای این بازی ارائه نمی‌دهد.
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
  const best = bestOfferId(option);
  const sortedOffers = [...option.offers].sort((a, b) => {
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    return a.priceToman - b.priceToman;
  });

  return (
    <div>
      <p className="mb-4 text-sm text-muted">{option.description}</p>
      <Table>
        <Table.ScrollContainer>
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
                return (
                  <Table.Row key={offer.sellerId} id={offer.sellerId}>
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
                      <span className="price-figure font-bold">
                        {formatToman(offer.priceToman)}{" "}
                        <span className="text-xs font-normal text-muted">تومان</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${offer.inStock ? "bg-success" : "bg-muted"}`}
                        />
                        {offer.inStock ? "موجود" : "ناموجود"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <a
                        href={offer.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-3xl bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
                      >
                        خرید از فروشگاه
                      </a>
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
