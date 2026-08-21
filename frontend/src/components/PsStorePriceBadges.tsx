import type { AriaAttributes, ReactNode } from "react";
import Image from "next/image";
import type { PsStoreInfo, PsStoreRegionInfo } from "@/lib/games-repo";


function PsPlus({ size = 40, dimmed }: { size?: number; dimmed?: boolean }) {
  return (
    <Image
      src="/icons/ps-plus-no-bg.png"
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      className={dimmed ? "opacity-40" : undefined}
    />
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      className="w-3 h-3 shrink-0 text-white/30 group-hover:text-white/70 transition-colors duration-200"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17L17 7M17 7H7M17 7v10" />
    </svg>
  );
}

function PlusTierLabel({ info }: { info: PsStoreInfo }) {
  const us = info.us;
  if (us.deluxePlus)    return <span className="text-[13px] font-bold tracking-widest uppercase text-amber-300">Deluxe</span>;
  if (us.extraPlus)     return <span className="text-[13px] font-bold tracking-widest uppercase text-amber-300">Extra</span>;
  if (us.essentialPlus) return <span className="text-[13px] font-bold tracking-widest uppercase text-amber-300">Essential</span>;
  return null;
}

function plusTooltipText(info: PsStoreInfo): string {
  const us = info.us;
  if (us.deluxePlus)    return "این بازی در اشتراک PlayStation Plus Deluxe موجود است";
  if (us.extraPlus)     return "این بازی در اشتراک PlayStation Plus Extra موجود است";
  if (us.essentialPlus) return "این بازی در اشتراک PlayStation Plus Essential موجود است";
  if (!info.hasData)    return "وضعیت این بازی در اشتراک PlayStation Plus هنوز ثبت نشده است";
  return "این بازی در هیچ اشتراک PlayStation Plus موجود نیست";
}

function Tooltip({ text }: { text: string }) {
  return (
    <div
      dir="rtl"
      className="pointer-events-none absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2
        w-max max-w-[200px] rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl
        px-3 py-2 text-center text-[11px] leading-relaxed text-white/85
        opacity-0 translate-y-1
        group-hover:opacity-100 group-hover:translate-y-0
        transition-all duration-200 ease-out z-50 shadow-2xl"
    >
      {text}
      <span className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 block h-2.5 w-2.5 rotate-45 rounded-[2px] border-b border-r border-white/10 bg-black/80" />
    </div>
  );
}

const glassCard = "group relative flex flex-col items-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl transition-all duration-200 hover:bg-white/15 hover:border-white/25 active:scale-[0.97]";
const glassCardDimmed = "group relative flex flex-col items-center rounded-2xl border border-white/8 bg-white/5 backdrop-blur-xl opacity-50";
const disabledRegionCard = "group relative flex flex-col items-center rounded-2xl border border-white/8 bg-white/5 backdrop-blur-xl";

interface Props {
  info: PsStoreInfo;
}

export default function PsStorePriceBadges({ info }: Props) {
  const trHref = psStoreHref(info.tr);
  const usHref = psStoreHref(info.us);
  const us = info.us;
  const tr = info.tr;
  const hasPlus = !!(us.essentialPlus || us.extraPlus || us.deluxePlus);

  const usTooltip = us.current
    ? `قیمت این بازی در فروشگاه رسمی PlayStation آمریکا ${us.current}${us.discount ? ` (${us.discount})` : ""} می‌باشد`
    : "قیمت این بازی در منطقه آمریکا ثبت نشده است";

  // ⁦ / ⁩ = LTR isolate marks — prevent RTL bidi from reversing the price inside Persian tooltip text
  const trTooltip = tr.current
    ? `قیمت این بازی در فروشگاه رسمی PlayStation ترکیه ⁦${tr.current}${tr.discount ? ` (${tr.discount})` : ""}⁩ می‌باشد`
    : "قیمت این بازی در منطقه ترکیه ثبت نشده است";

  return (
    <div className="flex flex-col gap-2">

      {/* Section label */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35 text-center">
        قیمت در PlayStation Store
      </p>

      <div className="grid grid-cols-3 gap-2.5">

        {/* Turkey */}
        <PriceCard
          href={trHref}
          className={trHref ? `${glassCard} cursor-pointer touch-manipulation` : disabledRegionCard}
          aria-label={`قیمت در ترکیه: ${tr.current ?? "نامشخص"}`}
        >
          <div className="flex flex-col items-center gap-2 px-3 py-4 w-full">
            <div className="flex items-center justify-center gap-1.5 w-full">
              <svg width="32" height="21" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="rounded-[3px] shadow-sm shrink-0">
                <rect width="36" height="24" fill="#E30A17" />
                <circle cx="15" cy="12" r="7" fill="white" />
                <circle cx="17.5" cy="12" r="5.5" fill="#E30A17" />
                <polygon points="23,12 25.8,8.6 25.8,15.4" fill="white" transform="rotate(15 23 12)" />
              </svg>
              <span className="text-[12px] font-semibold text-white/60 uppercase tracking-widest leading-none">ترکیه</span>
              {trHref && <ExternalLinkIcon />}
            </div>
            <p dir="ltr" className="text-[17px] font-extrabold text-white leading-none tabular-nums text-center">
              {tr.current ?? <span className="text-white/30">—</span>}
            </p>
            <div className="flex flex-col items-center gap-0.5 min-h-[18px]">
              {tr.original && tr.original !== tr.current && (
                <span dir="ltr" className="text-[11px] text-white/30 line-through leading-none">{tr.original}</span>
              )}
              {tr.discount && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5 leading-none">
                  {tr.discount}
                </span>
              )}
            </div>
          </div>
          {trHref && <Tooltip text={trTooltip} />}
        </PriceCard>

        {/* US */}
        <PriceCard
          href={usHref}
          className={usHref ? `${glassCard} cursor-pointer touch-manipulation` : disabledRegionCard}
          aria-label={`قیمت در آمریکا: ${us.current ?? "نامشخص"}`}
        >
          <div className="flex flex-col items-center gap-2 px-3 py-4 w-full">
            <div className="flex items-center justify-center gap-1.5 w-full">
              <svg width="32" height="21" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="rounded-[3px] shadow-sm shrink-0">
                {[0,1,2,3,4,5,6,7,8,9,10,11,12].map((i) => (
                  <rect key={i} x="0" y={i*(24/13)} width="36" height={24/13} fill={i%2===0 ? "#B22234" : "white"} />
                ))}
                <rect x="0" y="0" width="14.4" height="12.9" fill="#3C3B6E" />
                {[1,2,3,4,5,6].map((row) =>
                  [0,1,2,3,4,5,6,7,8].slice(0, row%2===0 ? 8 : 9).map((_c, ci) => (
                    <circle key={`${row}-${ci}`} cx={row%2===0 ? 0.9+ci*1.65 : 0.7+ci*1.65} cy={row*2} r="0.55" fill="white" />
                  ))
                )}
              </svg>
              <span className="text-[12px] font-semibold text-white/60 uppercase tracking-widest leading-none">آمریکا</span>
              {usHref && <ExternalLinkIcon />}
            </div>
            <p className="text-[17px] font-extrabold text-white leading-none tabular-nums text-center">
              {us.current ?? <span className="text-white/30">—</span>}
            </p>
            <div className="flex flex-col items-center gap-0.5 min-h-[18px]">
              {us.original && us.original !== us.current && (
                <span className="text-[11px] text-white/30 line-through leading-none">{us.original}</span>
              )}
              {us.discount && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5 leading-none">
                  {us.discount}
                </span>
              )}
            </div>
          </div>
          {usHref && <Tooltip text={usTooltip} />}
        </PriceCard>

        {/* PS Plus */}
        <div className={hasPlus ? `${glassCard} border-amber-400/25 bg-amber-400/5 hover:bg-amber-400/10` : glassCardDimmed}>
          <div className="flex flex-col items-center gap-2 px-3 py-4 w-full">
            <PsPlus size={35} dimmed={!hasPlus} />
            <span className="text-[12px] font-semibold text-white/50 uppercase tracking-widest leading-none">PS Plus</span>
            {hasPlus
              ? <PlusTierLabel info={info} />
              : (
                <span className="text-[12px] text-white/30 leading-none">
                  {info.hasData ? "موجود نیست" : "ثبت نشده"}
                </span>
              )
            }
          </div>
          <Tooltip text={plusTooltipText(info)} />
        </div>

      </div>
    </div>
  );
}

function psStoreHref(region: PsStoreRegionInfo) {
  if (region.storeUrl) return region.storeUrl;
  return null;
}

function PriceCard({
  href,
  className,
  children,
  ...props
}: {
  href: string | null;
  className: string;
  children: ReactNode;
} & AriaAttributes) {
  if (!href) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} {...props}>
      {children}
    </a>
  );
}
