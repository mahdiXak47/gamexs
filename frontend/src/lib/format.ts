const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

export function formatToman(amount: number): string {
  const grouped = amount.toLocaleString("en-US").replace(/,/g, "٬");
  return toPersianDigits(grouped);
}
