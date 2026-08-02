import type { PsStoreInfo } from "@/lib/games-repo";

const PS_STORE_BASE = "https://store.playstation.com";


function PsPlus({ size = 40, dimmed }: { size?: number; dimmed?: boolean }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 40 40" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={dimmed ? "opacity-40" : undefined}
    >
      <circle cx="20" cy="20" r="20" fill="#003791" />
      <rect x="8" y="17.5" width="24" height="5" rx="2.5" fill="#f6b829" />
      <rect x="17.5" y="8" width="5" height="24" rx="2.5" fill="#f6b829" />
    </svg>
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
  if (info.deluxePlus)    return <span className="text-[13px] font-bold tracking-widest uppercase text-amber-300">Deluxe</span>;
  if (info.extraPlus)     return <span className="text-[13px] font-bold tracking-widest uppercase text-amber-300">Extra</span>;
  if (info.essentialPlus) return <span className="text-[13px] font-bold tracking-widest uppercase text-amber-300">Essential</span>;
  return null;
}

function plusTooltipText(info: PsStoreInfo): string {
  if (info.deluxePlus)    return "این بازی در اشتراک PlayStation Plus Deluxe موجود است";
  if (info.extraPlus)     return "این بازی در اشتراک PlayStation Plus Extra موجود است";
  if (info.essentialPlus) return "این بازی در اشتراک PlayStation Plus Essential موجود است";
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

interface Props {
  info: PsStoreInfo;
}

export default function PsStorePriceBadges({ info }: Props) {
  const hasAnyData =
    info.usCurrent || info.trCurrent ||
    info.essentialPlus || info.extraPlus || info.deluxePlus;

  if (!hasAnyData) return null;

  const trHref  = `${PS_STORE_BASE}/tr-tr/concept/${info.conceptId}`;
  const usHref  = `${PS_STORE_BASE}/en-us/concept/${info.conceptId}`;
  const hasPlus = info.essentialPlus || info.extraPlus || info.deluxePlus;

  const usTooltip = info.usCurrent
    ? `قیمت این بازی در فروشگاه رسمی PlayStation آمریکا ${info.usCurrent}${info.usDiscount ? ` (${info.usDiscount})` : ""} می‌باشد`
    : "قیمت این بازی در منطقه آمریکا یافت نشد";

  // ⁦ / ⁩ = LTR isolate marks — prevent RTL bidi from reversing the price inside Persian tooltip text
  const trTooltip = info.trCurrent
    ? `قیمت این بازی در فروشگاه رسمی PlayStation ترکیه ⁦${info.trCurrent}${info.trDiscount ? ` (${info.trDiscount})` : ""}⁩ می‌باشد`
    : "قیمت این بازی در منطقه ترکیه یافت نشد";

  return (
    <div className="flex flex-col gap-2">

      {/* Section label */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35 text-center">
        قیمت در PlayStation Store
      </p>

      <div className="grid grid-cols-3 gap-2.5">

        {/* Turkey */}
        <a
          href={trHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${glassCard} cursor-pointer touch-manipulation`}
          aria-label={`قیمت در ترکیه: ${info.trCurrent ?? "نامشخص"}`}
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
              <ExternalLinkIcon />
            </div>
            <p dir="ltr" className="text-[17px] font-extrabold text-white leading-none tabular-nums text-center">
              {info.trCurrent ?? <span className="text-white/30">—</span>}
            </p>
            <div className="flex flex-col items-center gap-0.5 min-h-[18px]">
              {info.trOriginal && info.trOriginal !== info.trCurrent && (
                <span dir="ltr" className="text-[11px] text-white/30 line-through leading-none">{info.trOriginal}</span>
              )}
              {info.trDiscount && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5 leading-none">
                  {info.trDiscount}
                </span>
              )}
            </div>
          </div>
          <Tooltip text={trTooltip} />
        </a>

        {/* US */}
        <a
          href={usHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${glassCard} cursor-pointer touch-manipulation`}
          aria-label={`قیمت در آمریکا: ${info.usCurrent ?? "نامشخص"}`}
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
              <ExternalLinkIcon />
            </div>
            <p className="text-[17px] font-extrabold text-white leading-none tabular-nums text-center">
              {info.usCurrent ?? <span className="text-white/30">—</span>}
            </p>
            <div className="flex flex-col items-center gap-0.5 min-h-[18px]">
              {info.usOriginal && info.usOriginal !== info.usCurrent && (
                <span className="text-[11px] text-white/30 line-through leading-none">{info.usOriginal}</span>
              )}
              {info.usDiscount && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5 leading-none">
                  {info.usDiscount}
                </span>
              )}
            </div>
          </div>
          <Tooltip text={usTooltip} />
        </a>

        {/* PS Plus */}
        <div className={hasPlus ? `${glassCard} border-amber-400/25 bg-amber-400/5 hover:bg-amber-400/10` : glassCardDimmed}>
          <div className="flex flex-col items-center gap-2 px-3 py-4 w-full">
            <PsPlus size={35} dimmed={!hasPlus} />
            <span className="text-[12px] font-semibold text-white/50 uppercase tracking-widest leading-none">PS Plus</span>
            {hasPlus
              ? <PlusTierLabel info={info} />
              : <span className="text-[12px] text-white/30 leading-none">موجود نیست</span>
            }
          </div>
          <Tooltip text={plusTooltipText(info)} />
        </div>

      </div>
    </div>
  );
}
