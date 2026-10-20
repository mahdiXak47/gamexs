#!/usr/bin/env python3
"""Detect which installment (خرید اقساطی / BNPL) options each seller offers (migration 038).

For every seller this fetches the homepage and its most recently scraped
product page (provider widgets such as Digipay's badge are often only on
product pages) and looks for each provider's own footprint: its widget/plugin
markup, script hosts, logo or Persian name. Verified 2026-10-20 against all
sellers, e.g. nakhlmarket's snapp-pay-widget, yungcenter's wp-digipay plugin,
gamario's cpg.torobpay.com, psnacctm's «ترب‌پی» post.

`own` means the shop advertises installments (اقساط/قسطی) but none of the
three providers shows up: its own plan (technolife, parsconsole).
ponytail: text heuristic per seller; per-product BNPL flags (digikala's
bnpl_active) are ignored. A seller whose pages fail keeps its last result.

    python detect_installments.py            # daily pipeline step
    python detect_installments.py --dry-run  # print, do not write
"""

from __future__ import annotations

import argparse
import os
import re
import sys

import psycopg
import requests

from gamexs_scraper.pipeline import report_progress

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"}
ZWNJ = "‌"
_FA = rf"\s*{ZWNJ}?\s*"

PROVIDERS = {
    "snapppay": re.compile(rf"snapp-?pay-widget|snapppay|snappay|snapp-pay|اسنپ{_FA}پی", re.I),
    "digipay": re.compile(rf"mydigipay\.com|digipay-badge|wp-digipay|digipay\.(?:png|svg|webp)|دیجی{_FA}پی(?![نك])", re.I),
    "torobpay": re.compile(rf"torobpay|ترب{_FA}پی", re.I),
}
OWN = re.compile(r"اقساط|قسطی")
# Noise that names a provider without meaning the shop uses it: CSS (theme colour
# variables like --color-digipay) and Sazito's platform-wide feature flags.
_NOISE = re.compile(r"<style\b.*?</style>|\"activate_[a-z_]+\":\{[^}]*\}|--color-[\w-]+:[^;]*;", re.S | re.I)


def detect(pages: list[str]) -> list[str]:
    """Installment options visible on a seller's pages, in a stable order."""
    text = _NOISE.sub(" ", "\n".join(pages))
    found = [name for name, pattern in PROVIDERS.items() if pattern.search(text)]
    if not found and OWN.search(text):
        found.append("own")
    return found


def fetch(url: str) -> str:
    # Iranian shops are reachable directly; the env proxy is for foreign APIs.
    direct = requests.Session()
    direct.trust_env = False
    try:
        response = direct.get(url, headers=HEADERS, timeout=30)
    except requests.exceptions.RequestException:
        response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    # Some shops send no charset and requests then falls back to Latin-1.
    return response.content.decode("utf-8", "replace")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="print the result, do not write it")
    args = parser.parse_args()
    db_url = os.environ.get("DATABASE_URL") or sys.exit("DATABASE_URL is required")

    failed = 0
    with psycopg.connect(db_url, autocommit=True) as conn:
        sellers = conn.execute(
            """
            SELECT s.id, s.slug, s.domain,
                   (SELECT l.source_url FROM listings l WHERE l.seller_id = s.id AND l.is_active
                    ORDER BY l.last_seen_at DESC NULLS LAST, l.id DESC LIMIT 1)
            FROM sellers s ORDER BY s.id
            """
        ).fetchall()
        for i, (seller_id, slug, domain, product_url) in enumerate(sellers):
            report_progress(i, len(sellers), f"installments for {slug}")
            try:
                pages = [fetch(f"https://{domain}/")] + ([fetch(product_url)] if product_url else [])
            except Exception as exc:  # keep the last known result
                failed += 1
                print(f"{slug}: failed: {exc}", file=sys.stderr, flush=True)
                continue
            options = detect(pages)
            print(f"{slug}: {', '.join(options) or '-'}", flush=True)
            if not args.dry_run:
                conn.execute(
                    "UPDATE sellers SET installment_options = %s, installment_checked_at = now() WHERE id = %s",
                    (options, seller_id),
                )
    report_progress(len(sellers), len(sellers), f"{len(sellers) - failed} checked, {failed} failed", force=True)
    return 1 if failed == len(sellers) else 0


if __name__ == "__main__":
    sys.exit(main())
