export const SITE_URL = "https://gamexs.ir";
export const SITE_NAME = "GameXS";

// Structured data requires an ISO 4217 currency code — Toman (the unit shown
// throughout the UI) isn't one, so schema.org prices are expressed in Rial
// (Toman × 10), the actual ISO currency. This only affects the invisible
// JSON-LD payload, never anything rendered on the page.
export function tomanToRial(toman: number): number {
  return toman * 10;
}
