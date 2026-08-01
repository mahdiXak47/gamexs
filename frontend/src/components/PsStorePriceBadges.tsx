import type { PsStoreInfo } from "@/lib/games-repo";

const PS_STORE_BASE = "https://store.playstation.com";

// PlayStation Plus SVG logo — blue circle with gold "+" mark
function PsPlus({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#003791" />
      <rect x="8" y="17.5" width="24" height="5" rx="2.5" fill="#f6b829" />
      <rect x="17.5" y="8" width="5" height="24" rx="2.5" fill="#f6b829" />
    </svg>
  );
}

function PlusTierLabel({ info }: { info: PsStoreInfo }) {
  if (info.deluxePlus)    return <span className="text-xs font-bold tracking-widest uppercase text-amber-300">Deluxe</span>;
  if (info.extraPlus)     return <span className="text-xs font-bold tracking-widest uppercase text-amber-300">Extra</span>;
  if (info.essentialPlus) return <span className="text-xs font-bold tracking-widest uppercase text-amber-300">Essential</span>;
  return <span className="text-[11px] font-medium tracking-wide text-white/40">موجود نیست</span>;
}

function plusTooltipText(info: PsStoreInfo): string {
  if (info.deluxePlus)    return "این بازی در اشتراک PlayStation Plus Deluxe موجود است";
  if (info.extraPlus)     return "این بازی در اشتراک PlayStation Plus Extra موجود است";
  if (info.essentialPlus) return "این بازی در اشتراک PlayStation Plus Essential موجود است";
  return "این بازی در هیچ اشتراک PlayStation Plus موجود نیست";
}

interface CardProps {
  tooltip: string;
  hero?: boolean;
  href?: string;
  children: React.ReactNode;
}

function PriceCard({ tooltip, hero, href, children }: CardProps) {
  const cls = `group relative flex flex-col items-center select-none transition-colors ${
    hero
      ? "gap-1.5 rounded-xl border border-white/20 bg-black/35 backdrop-blur-md px-2 py-2.5 hover:bg-black/50 hover:border-white/30"
      : "gap-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-4 hover:bg-white/10 hover:border-white/20"
  } ${href ? "cursor-pointer" : "cursor-default"}`;

  const tooltip_el = (
    <div
      dir="rtl"
      className="pointer-events-none absolute bottom-full mb-2 right-0 left-0 mx-auto w-max max-w-[220px]
        rounded-xl border border-white/15 bg-[#0a0f1e]/95 backdrop-blur-md
        px-3 py-2 text-center text-xs leading-relaxed text-white/90
        opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0
        transition-all duration-200 ease-out z-50 shadow-xl"
    >
      {tooltip}
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 block h-3 w-3 rotate-45 rounded-sm border-b border-r border-white/15 bg-[#0a0f1e]/95" />
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
        {tooltip_el}
      </a>
    );
  }

  return (
    <div className={cls}>
      {children}
      {tooltip_el}
    </div>
  );
}

interface Props {
  info: PsStoreInfo;
  hero?: boolean;
}

export default function PsStorePriceBadges({ info, hero }: Props) {
  const hasAnyData =
    info.usCurrent || info.trCurrent ||
    info.essentialPlus || info.extraPlus || info.deluxePlus;

  if (!hasAnyData) return null;

  const trHref = `${PS_STORE_BASE}/en-tr/product/${info.conceptId}`;
  const usHref = `${PS_STORE_BASE}/en-us/product/${info.conceptId}`;

  const usTooltip = info.usCurrent
    ? `قیمت این بازی در فروشگاه رسمی PlayStation آمریکا ${info.usCurrent}${info.usDiscount ? ` (${info.usDiscount})` : ""} می‌باشد`
    : "قیمت این بازی در منطقه آمریکا یافت نشد";

  const trTooltip = info.trCurrent
    ? `قیمت این بازی در فروشگاه رسمی PlayStation ترکیه ${info.trCurrent}${info.trDiscount ? ` (${info.trDiscount})` : ""} می‌باشد`
    : "قیمت این بازی در منطقه ترکیه یافت نشد";

  return (
    <div className="grid grid-cols-3 gap-2">

      {/* Turkey price */}
      <PriceCard tooltip={trTooltip} hero={hero} href={trHref}>
        <svg width="32" height="21" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-label="ترکیه" className="rounded-sm overflow-hidden shadow-sm">
          <rect width="36" height="24" fill="#E30A17" />
          <circle cx="15" cy="12" r="7" fill="white" />
          <circle cx="17.5" cy="12" r="5.5" fill="#E30A17" />
          <polygon points="23,12 25.8,8.6 25.8,15.4" fill="white" transform="rotate(15 23 12)" />
        </svg>
        <div className="text-center">
          <p className="text-[11px] text-white/40 mb-0.5">ترکیه</p>
          <p className="text-sm font-bold text-white leading-none">{info.trCurrent ?? "—"}</p>
          {info.trOriginal && info.trOriginal !== info.trCurrent && (
            <p className="text-[10px] text-white/30 line-through mt-0.5">{info.trOriginal}</p>
          )}
          {info.trDiscount && (
            <p className="text-[10px] font-semibold text-emerald-400 mt-0.5">{info.trDiscount}</p>
          )}
        </div>
      </PriceCard>

      {/* US price */}
      <PriceCard tooltip={usTooltip} hero={hero} href={usHref}>
        <svg width="32" height="21" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-label="آمریکا" className="rounded-sm overflow-hidden shadow-sm">
          {[0,1,2,3,4,5,6,7,8,9,10,11,12].map((i) => (
            <rect key={i} x="0" y={i * (24/13)} width="36" height={24/13} fill={i % 2 === 0 ? "#B22234" : "white"} />
          ))}
          <rect x="0" y="0" width="14.4" height="12.9" fill="#3C3B6E" />
          {[1,2,3,4,5,6].map((row) =>
            [1,2,3,4,5,6,7,8,9].slice(0, row % 2 === 0 ? 8 : 9).map((_col, ci) => (
              <circle key={`${row}-${ci}`} cx={row % 2 === 0 ? 0.9 + ci * 1.65 : 0.7 + ci * 1.65} cy={row * 2} r="0.55" fill="white" />
            ))
          )}
        </svg>
        <div className="text-center">
          <p className="text-[11px] text-white/40 mb-0.5">آمریکا</p>
          <p className="text-sm font-bold text-white leading-none">{info.usCurrent ?? "—"}</p>
          {info.usOriginal && info.usOriginal !== info.usCurrent && (
            <p className="text-[10px] text-white/30 line-through mt-0.5">{info.usOriginal}</p>
          )}
          {info.usDiscount && (
            <p className="text-[10px] font-semibold text-emerald-400 mt-0.5">{info.usDiscount}</p>
          )}
        </div>
      </PriceCard>

      {/* PS Plus */}
      <PriceCard tooltip={plusTooltipText(info)} hero={hero}>
        <PsPlus size={32} />
        <div className="text-center">
          <p className="text-[11px] text-white/40 mb-0.5">PS Plus</p>
          <PlusTierLabel info={info} />
        </div>
      </PriceCard>

    </div>
  );
}
