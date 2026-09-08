import { formatToman } from "@/lib/format";
import { purchasePathLabel } from "@/lib/purchase-options";
import type { AccessTier, GamePriceHistoryPoint, ProductType } from "@/lib/types";

const WIDTH = 760;
const HEIGHT = 320;
const PADDING = { top: 24, right: 20, bottom: 52, left: 86 };
const INNER_WIDTH = WIDTH - PADDING.left - PADDING.right;
const INNER_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

const SERIES_ORDER: Array<{ type: ProductType; tier: AccessTier | null; color: string }> = [
  { type: "ACCOUNT_GAME", tier: "CAPACITY_1", color: "#2563eb" },
  { type: "ACCOUNT_GAME", tier: "CAPACITY_2", color: "#16a34a" },
  { type: "ACCOUNT_GAME", tier: "CAPACITY_3", color: "#d97706" },
  { type: "OWN_ACCOUNT_GAME", tier: null, color: "#7c3aed" },
  { type: "DISC", tier: null, color: "#dc2626" },
];

interface Series {
  key: string;
  label: string;
  color: string;
  points: GamePriceHistoryPoint[];
}

function seriesKey(type: ProductType, tier: AccessTier | null): string {
  return `${type}:${tier ?? "none"}`;
}

function formatDay(day: string): string {
  return new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`)
  );
}

function linePoints(points: GamePriceHistoryPoint[], days: string[], min: number, max: number): string {
  return points
    .map((point) => {
      const index = days.indexOf(point.day);
      const x = days.length === 1 ? INNER_WIDTH / 2 : (index / (days.length - 1)) * INNER_WIDTH;
      const y = ((max - point.priceToman) / (max - min)) * INNER_HEIGHT;
      return `${(PADDING.left + x).toFixed(2)},${(PADDING.top + y).toFixed(2)}`;
    })
    .join(" ");
}

function buildSeries(points: GamePriceHistoryPoint[]): Series[] {
  return SERIES_ORDER.flatMap((meta) => {
    const seriesPoints = points.filter(
      (point) => point.productType === meta.type && point.tier === meta.tier
    );
    if (seriesPoints.length === 0) return [];
    return [{
      key: seriesKey(meta.type, meta.tier),
      label: purchasePathLabel(meta.type, meta.tier),
      color: meta.color,
      points: seriesPoints,
    }];
  });
}

export default function GamePriceHistory({ points }: { points: GamePriceHistoryPoint[] }) {
  const series = buildSeries(points);
  const days = Array.from(new Set(points.map((point) => point.day))).sort();
  const prices = points.map((point) => point.priceToman);
  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const range = rawMax - rawMin;
  const min = range === 0 ? Math.max(0, rawMin - Math.max(rawMin * 0.1, 1)) : rawMin;
  const max = range === 0 ? rawMax + Math.max(rawMax * 0.1, 1) : rawMax;
  const yTicks = [max, min + (max - min) / 2, min];

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6" dir="rtl" aria-labelledby="price-history-heading">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="price-history-heading" className="text-xl font-extrabold text-gray-900">
              روند قیمت
            </h2>
            <p className="mt-1 text-sm text-gray-500">حداقل قیمت ثبت‌شده در ۳۶۵ روز اخیر</p>
          </div>
          {series.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600" aria-label="راهنمای نمودار">
              {series.map((item) => (
                <span key={item.key} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {points.length === 0 ? (
          <p className="mt-8 rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            هنوز سابقهٔ قیمتی کافی برای نمایش وجود ندارد.
          </p>
        ) : (
          <>
            <div className="mt-6 overflow-x-auto" dir="ltr">
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="h-auto min-w-[620px] w-full"
                role="img"
                aria-label="نمودار روند حداقل قیمت بازی در ۳۶۵ روز اخیر"
              >
                <title>روند حداقل قیمت بازی در ۳۶۵ روز اخیر</title>
                {yTicks.map((tick, index) => {
                  const y = PADDING.top + (index / (yTicks.length - 1)) * INNER_HEIGHT;
                  return (
                    <g key={index}>
                      <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="3 4" />
                      <text x={PADDING.left - 10} y={y + 4} textAnchor="end" className="fill-gray-500 text-[11px]">
                        {formatToman(Math.round(tick))}
                      </text>
                    </g>
                  );
                })}
                {days.length > 0 && (
                  <>
                    <text x={PADDING.left} y={HEIGHT - 16} textAnchor="start" className="fill-gray-500 text-[11px]">
                      {formatDay(days[0])}
                    </text>
                    <text x={WIDTH - PADDING.right} y={HEIGHT - 16} textAnchor="end" className="fill-gray-500 text-[11px]">
                      {formatDay(days[days.length - 1])}
                    </text>
                  </>
                )}
                {series.map((item) => (
                  <g key={item.key}>
                    {item.points.length > 1 && (
                      <polyline
                        points={linePoints(item.points, days, min, max)}
                        fill="none"
                        stroke={item.color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {item.points.map((point) => {
                      const index = days.indexOf(point.day);
                      const x = days.length === 1 ? PADDING.left + INNER_WIDTH / 2 : PADDING.left + (index / (days.length - 1)) * INNER_WIDTH;
                      const y = PADDING.top + ((max - point.priceToman) / (max - min)) * INNER_HEIGHT;
                      return (
                        <circle key={`${item.key}:${point.day}`} cx={x} cy={y} r="4" fill="white" stroke={item.color} strokeWidth="2">
                          <title>{`${item.label} — ${formatDay(point.day)}: ${formatToman(point.priceToman)} تومان`}</title>
                        </circle>
                      );
                    })}
                  </g>
                ))}
              </svg>
            </div>

            <details className="mt-4 text-sm text-gray-600">
              <summary className="cursor-pointer font-semibold text-ps-blue">مشاهدهٔ داده‌های نمودار</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-right text-xs">
                  <thead className="border-b border-gray-200 text-gray-500">
                    <tr>
                      <th className="px-2 py-2 font-semibold">تاریخ</th>
                      <th className="px-2 py-2 font-semibold">نوع خرید</th>
                      <th className="px-2 py-2 font-semibold">حداقل قیمت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...points].reverse().map((point) => (
                      <tr key={`${point.day}:${seriesKey(point.productType, point.tier)}`}>
                        <td className="px-2 py-2">{formatDay(point.day)}</td>
                        <td className="px-2 py-2">{purchasePathLabel(point.productType, point.tier)}</td>
                        <td className="px-2 py-2 font-semibold">{formatToman(point.priceToman)} تومان</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
