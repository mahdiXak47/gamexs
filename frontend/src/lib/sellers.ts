import type { Seller } from "./types";

export const SELLERS: Record<string, Seller> = {
  pspro: { id: "pspro", name: "PSPro", domain: "pspro.ir", initial: "P" },
  yungcenter: { id: "yungcenter", name: "YungCenter", domain: "yungcenter.com", initial: "Y" },
  nakhlmarket: { id: "nakhlmarket", name: "نخل مارکت", domain: "nakhlmarket.com", initial: "ن" },
  persianconsole: { id: "persianconsole", name: "پرشین کنسول", domain: "persianconsole.ir", initial: "پ" },
  gameplayshop: { id: "gameplayshop", name: "گیم‌پلی‌شاپ", domain: "gameplayshop.ir", initial: "گ" },
  digikala: { id: "digikala", name: "دیجی‌کالا", domain: "digikala.com", initial: "د" },
  parsconsole: { id: "parsconsole", name: "پارس کنسول", domain: "parsconsole.com", initial: "پ" },
  gameonestore: { id: "gameonestore", name: "گیم‌وان استور", domain: "gameonestore.com", initial: "G" },
  xgamesstore: { id: "xgamesstore", name: "XGames", domain: "xgamesstore.org", initial: "X" },
  gamecenter: { id: "gamecenter", name: "گیم سنتر", domain: "game-center.ir", initial: "گ" },
  gamario: { id: "gamario", name: "Gamario", domain: "gamario.com", initial: "G" },
  cdkeyshare: { id: "cdkeyshare", name: "سی‌دی‌کی‌شر", domain: "cdkeyshare.ir", initial: "C" },
};

export function seller(id: string): Seller {
  const s = SELLERS[id];
  if (!s) throw new Error(`unknown seller id: ${id}`);
  return s;
}
