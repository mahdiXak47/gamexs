const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

export function formatToman(amount: number): string {
  const grouped = amount.toLocaleString("en-US").replace(/,/g, "٬");
  return toPersianDigits(grouped);
}

/** "۳ ساعت پیش" — how long ago a scrape last confirmed an offer. */
export function formatCheckedAgo(ms: number, now = Date.now()): string {
  const hours = Math.floor((now - ms) / 3_600_000);
  if (hours < 1) return "کمتر از یک ساعت پیش";
  if (hours < 24) return `${toPersianDigits(hours)} ساعت پیش`;
  return `${toPersianDigits(Math.floor(hours / 24))} روز پیش`;
}
