import type { PsStoreInfo } from "@/lib/games-repo";

const PS_STORE_BASE = "https://store.playstation.com";

function PsPlus({ size = 40, dimmed }: { size?: number; dimmed?: boolean }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 40 40" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={dimmed ? "opacity-30" : undefined}
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
      className="w-3 h-3 shrink-0 text-white/20 group-hover:text-white/60 transition-colors duration-200"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17L17 7M17 7H7M17 7v10" />
    </svg>
  );
}

function PlusTierLabel({ info }: { info: PsStoreInfo }) {
  if (info.deluxePlus)    return <span className="text-xs font-bold tracking-widest uppercase text-amber-300">Deluxe</span>;
  if (info.extraPlus)     return <span className="text-xs font-bold tracking-widest uppercase text-amber-300">Extra</span>;
  if (info.essentialPlus) return <span className="text-xs font-bold tracking-widest uppercase text-amber-300">Essential</span>;
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
        w-max max-w-[200px] rounded-xl border border-white/10 bg-[#080c18]/95 backdrop-blur-xl
        px-3 py-2 text-center text-[11px] leading-relaxed text-white/80
        opacity-0 translate-y-1
        group-hover:opacity-100 group-hover:translate-y-0
        transition-all duration-200 ease-out z-50 shadow-2xl"
    >
      {text}
      <span className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 block h-2.5 w-2.5 rotate-45 rounded-[2px] border-b border-r border-white/10 bg-[#080c18]/95" />
    </div>
  );
}

interface Props {
  info: PsStoreInfo;
  hero?: boolean;
}

export default function PsStorePriceBadges({ info }: Props) {
  const hasAnyData =
    info.usCurrent || info.trCurrent ||
    info.essentialPlus || info.extraPlus || info.deluxePlus;

  if (!hasAnyData) return null;

  const trHref = `${PS_STORE_BASE}/tr-tr/concept/${info.conceptId}`;
  const usHref = `${PS_STORE_BASE}/en-us/concept/${info.conceptId}`;
  const hasPlus = info.essentialPlus || info.extraPlus || info.deluxePlus;

  const usTooltip = info.usCurrent
    ? `قیمت این بازی در فروشگاه رسمی PlayStation آمریکا ${info.usCurrent}${info.usDiscount ? ` (${info.usDiscount})` : ""} می‌باشد`
    : "قیمت این بازی در منطقه آمریکا یافت نشد";

  const trTooltip = info.trCurrent
    ? `قیمت این بازی در فروشگاه رسمی PlayStation ترکیه ${info.trCurrent}${info.trDiscount ? ` (${info.trDiscount})` : ""} می‌باشد`
    : "قیمت این بازی در منطقه ترکیه یافت نشد";

  const baseCard = "group relative flex flex-col gap-0 rounded-xl bg-black/50 backdrop-blur-xl transition-all duration-200 cursor-pointer touch-manipulation active:scale-[0.97]";
  const linkCard = `${baseCard} border border-white/10 [border-top:2px_solid_var(--card-accent)] hover:bg-black/65 hover:border-white/20`;

  return (
    <div className="flex flex-col gap-2">

      {/* Section label */}
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25 text-center">
        قیمت در PlayStation Store
      </p>

      <div className="grid grid-cols-3 gap-2">

        {/* Turkey */}
        <a
          href={trHref}
          target="_blank"
          rel="noopener noreferrer"
          className={linkCard}
          style={{ "--card-accent": "#E30A17" } as React.CSSProperties}
          aria-label={`قیمت در ترکیه: ${info.trCurrent ?? "نامشخص"}`}
        >
          <div className="flex flex-col gap-1.5 p-2.5">
            <div className="flex items-center gap-1.5">
              <svg width="28" height="19" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="rounded-[3px] shadow-sm shrink-0">
                <rect width="36" height="24" fill="#E30A17" />
                <circle cx="15" cy="12" r="7" fill="white" />
                <circle cx="17.5" cy="12" r="5.5" fill="#E30A17" />
                <polygon points="23,12 25.8,8.6 25.8,15.4" fill="white" transform="rotate(15 23 12)" />
              </svg>
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest flex-1 leading-none">ترکیه</span>
              <ExternalLinkIcon />
            </div>
            <p className="text-[15px] font-extrabold text-white leading-none tabular-nums">
              {info.trCurrent ?? <span className="text-white/25">—</span>}
            </p>
            <div className="flex flex-wrap items-center gap-1 min-h-[14px]">
              {info.trOriginal && info.trOriginal !== info.trCurrent && (
                <span className="text-[9px] text-white/25 line-through leading-none">{info.trOriginal}</span>
              )}
              {info.trDiscount && (
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 rounded-full px-1.5 py-0.5 leading-none">
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
          className={linkCard}
          style={{ "--card-accent": "#3C3B6E" } as React.CSSProperties}
          aria-label={`قیمت در آمریکا: ${info.usCurrent ?? "نامشخص"}`}
        >
          <div className="flex flex-col gap-1.5 p-2.5">
            <div className="flex items-center gap-1.5">
              <svg width="28" height="19" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="rounded-[3px] shadow-sm shrink-0">
                {[0,1,2,3,4,5,6,7,8,9,10,11,12].map((i) => (
                  <rect key={i} x="0" y={i * (24/13)} width="36" height={24/13} fill={i % 2 === 0 ? "#B22234" : "white"} />
                ))}
                <rect x="0" y="0" width="14.4" height="12.9" fill="#3C3B6E" />
                {[1,2,3,4,5,6].map((row) =>
                  [1,2,3,4,5,6,7,8,9].slice(0, row % 2 === 0 ? 8 : 9).map((_c, ci) => (
                    <circle key={`${row}-${ci}`} cx={row % 2 === 0 ? 0.9 + ci * 1.65 : 0.7 + ci * 1.65} cy={row * 2} r="0.55" fill="white" />
                  ))
                )}
              </svg>
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest flex-1 leading-none">آمریکا</span>
              <ExternalLinkIcon />
            </div>
            <p className="text-[15px] font-extrabold text-white leading-none tabular-nums">
              {info.usCurrent ?? <span className="text-white/25">—</span>}
            </p>
            <div className="flex flex-wrap items-center gap-1 min-h-[14px]">
              {info.usOriginal && info.usOriginal !== info.usCurrent && (
                <span className="text-[9px] text-white/25 line-through leading-none">{info.usOriginal}</span>
              )}
              {info.usDiscount && (
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 rounded-full px-1.5 py-0.5 leading-none">
                  {info.usDiscount}
                </span>
              )}
            </div>
          </div>
          <Tooltip text={usTooltip} />
        </a>

        {/* PS Plus */}
        <div
          className={`group relative flex flex-col rounded-xl backdrop-blur-xl transition-all duration-200
            ${hasPlus
              ? "bg-amber-400/5 border border-amber-400/20 [border-top:2px_solid_#003791]"
              : "bg-black/30 border border-white/5 [border-top:2px_solid_rgba(0,55,145,0.4)] opacity-55"
            }`}
        >
          <div className="flex flex-col items-center gap-1.5 p-2.5">
            <PsPlus size={30} dimmed={!hasPlus} />
            <span className="text-[9px] font-semibold text-white/35 uppercase tracking-widest leading-none">PS Plus</span>
            {hasPlus
              ? <PlusTierLabel info={info} />
              : <span className="text-[10px] text-white/25 leading-none">موجود نیست</span>
            }
          </div>
          <Tooltip text={plusTooltipText(info)} />
        </div>

      </div>
    </div>
  );
}
