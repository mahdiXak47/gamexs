"""Telegram channel price feed adapter.

A Telegram channel that sells PS5 account games behaves like a normal seller
for the rest of the pipeline: this adapter yields one RawOffer per
(capacity tier, price) line found in each channel post. Parsing is
config-driven (`telegram_config.py`) because every channel formats its prices
differently.

First run requires interactive authentication (phone number + login code sent
to the Telegram app). Telethon persists the session under `telegram_sessions/`
(gitignored) so later runs are silent. In headless environments, copy a
pre-authenticated session file in via `TELEGRAM_SESSION_FILE`.

    python -m gamexs_scraper.adapters.telegram_channel playbox --cache output/playbox_offers.jsonl
    python -m gamexs_scraper.load_to_postgres playbox --cache output/playbox_offers.jsonl
"""

from __future__ import annotations

import argparse
import asyncio
import dataclasses
import json
import os
import re
import sys
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

from ..base import SellerAdapter
from ..models import AccessTier, RawOffer
from ..normalize import clean_title
from ..telegram_config import CHANNEL_BY_SELLER, TelegramChannelSpec

# Emoji, variation selectors, and direction marks. Stripped from the message
# before parsing; the rest of normalize.py handles the Persian boilerplate.
_EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U00002B00-\U00002BFF"
    "\U0001F1E6-\U0001F1FF\u00A9\u00AE\u2122\uFE0F]"
)
_ZERO_WIDTH_RE = re.compile(r"[\u200B-\u200F\u2060\u202A-\u202E]")
_WS_RE = re.compile(r"\s+")

_PERSIAN_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")


def _price_to_int(raw: str) -> int:
    return int(raw.translate(_PERSIAN_DIGITS).replace(",", ""))


def _parse_proxy(url: str) -> dict | None:
    """Parse a proxy URL into the dict Telethon expects.

    Accepts socks5://, socks4://, http:// (optionally with user:pass@).
    Returns None when empty.
    """
    url = url.strip()
    if not url:
        return None
    scheme, _, rest = url.partition("://")
    addr, _, port_str = rest.rpartition(":")
    port = int(port_str) if port_str else 1080
    username = password = None
    if "@" in addr:
        creds, _, addr = addr.rpartition("@")
        username, _, password = creds.partition(":")
    if scheme == "socks5":
        proxy_type = "socks5"
    elif scheme == "socks4":
        proxy_type = "socks4"
    else:
        proxy_type = "http"
    proxy = {
        "proxy_type": proxy_type,
        "addr": addr,
        "port": port,
        "rdns": True,
    }
    if username is not None:
        proxy["username"] = username
        proxy["password"] = password
    return proxy


class TelegramChannelAdapter(SellerAdapter):
    """Yield RawOffers parsed from a Telegram channel's posts."""

    seller = "playbox"

    def __init__(
        self,
        spec: TelegramChannelSpec | None = None,
        lookback_hours: int | None = None,
        limit_messages: int | None = None,
    ):
        self.spec = spec or CHANNEL_BY_SELLER[self.seller]
        self.lookback_hours = lookback_hours if lookback_hours is not None else self.spec.lookback_hours
        self.limit_messages = limit_messages

    # -- SellerAdapter interface ------------------------------------------
    def iter_listings(self) -> Iterator[RawOffer]:
        offers = asyncio.run(self._collect_offers())
        yield from offers

    # -- Telethon (MTProto) ------------------------------------------------
    async def _collect_offers(self) -> list[RawOffer]:
        from telethon import TelegramClient  # lazy so the parser is importable/testable standalone
        from telethon.errors import FloodWaitError

        api_id = os.environ.get("TELEGRAM_API_ID", "").strip()
        api_hash = os.environ.get("TELEGRAM_API_HASH", "").strip()
        if not api_id or not api_hash:
            raise RuntimeError(
                "TELEGRAM_API_ID and TELEGRAM_API_HASH must be set (see .env.example)"
            )

        session_file = os.environ.get("TELEGRAM_SESSION_FILE", self.spec.session_file)
        session_path = Path(session_file)
        session_path.parent.mkdir(parents=True, exist_ok=True)

        # Optional SOCKS5/HTTP proxy for reaching Telegram from restricted
        # networks (e.g. the repo's xray-proxy at socks5://localhost:10808).
        # Telethon accepts a dict (see connection._parse_proxy).
        proxy = _parse_proxy(os.environ.get("TELEGRAM_PROXY", "").strip())

        client = TelegramClient(str(session_path), int(api_id), api_hash, proxy=proxy)
        offers: list[RawOffer] = []
        try:
            await client.start()
            entity = await client.get_entity(self.spec.username)
            print(
                f"telegram: connected to {entity.title} (id={entity.id})",
                file=sys.stderr,
            )

            since = None
            if self.lookback_hours:
                since = datetime.now(timezone.utc) - timedelta(hours=self.lookback_hours)

            # Newest-first; full history by default (the channel IS the catalog).
            async for message in client.iter_messages(entity, limit=self.limit_messages):
                if since is not None and message.date and message.date < since:
                    break
                if not message.text:
                    continue
                message_offers = self._offers_from_message(message.text, message.id)
                if message_offers:
                    print(
                        f"telegram: msg {message.id} -> {len(message_offers)} offer(s): "
                        f"{message_offers[0].raw_title!r}",
                        file=sys.stderr,
                    )
                offers.extend(message_offers)
        except FloodWaitError as exc:
            print(f"telegram: flood wait {exc.seconds}s", file=sys.stderr)
            await asyncio.sleep(exc.seconds)
            raise
        finally:
            await client.disconnect()
        return offers

    # -- Parser (the per-channel filter) -----------------------------------
    def _offers_from_message(self, text: str, message_id: int) -> list[RawOffer]:
        lines = [
            _WS_RE.sub(" ", _ZERO_WIDTH_RE.sub("", _EMOJI_RE.sub("", line))).strip()
            for line in text.splitlines()
        ]
        lines = [line for line in lines if line]
        if not lines:
            return []

        raw_title = lines[0]
        title = clean_title(raw_title)
        if not title:
            return []

        lowered = text.lower()
        if any(keyword in lowered for keyword in self.spec.skip_keywords):
            return []

        price_re = re.compile(self.spec.price_re)
        best_price: dict[AccessTier, int] = {}
        for line in lines:
            match = price_re.search(line)
            if not match:
                continue
            tier = self.spec.tier_map.get(match.group(1))
            if tier is None:
                continue
            price = _price_to_int(match.group(2)) * self.spec.price_multiplier
            # A post can price the same tier in several regions (SE/ES/US...).
            # The site shows one "cheapest" price per (game, tier, seller), so
            # keep the lowest price across regions for each tier.
            if tier not in best_price or price < best_price[tier]:
                best_price[tier] = price

        return [
            RawOffer(
                seller=self.spec.seller_slug,
                source_url=f"https://t.me/{self.spec.username}/{message_id}",
                raw_title=raw_title,
                product_type=self.spec.product_type,
                price_toman=price,
                tier=tier,
                in_stock=True,
            )
            for tier, price in best_price.items()
        ]


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(
        description="Scrape a Telegram channel price feed into a JSONL cache for load_to_postgres"
    )
    parser.add_argument("seller", choices=sorted(CHANNEL_BY_SELLER))
    parser.add_argument(
        "--cache", required=True,
        help="JSONL cache of raw offers (pass to load_to_postgres --cache)",
    )
    parser.add_argument(
        "--lookback-hours", type=int, default=None,
        help="Only parse posts newer than this many hours (default: full history)",
    )
    parser.add_argument(
        "--limit-messages", type=int, default=None,
        help="Cap the number of messages fetched (for testing)",
    )
    args = parser.parse_args()

    spec = CHANNEL_BY_SELLER[args.seller]
    adapter = TelegramChannelAdapter(spec, lookback_hours=args.lookback_hours, limit_messages=args.limit_messages)
    offers = list(adapter.iter_listings())

    cache_path = Path(args.cache)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with cache_path.open("w", encoding="utf-8") as f:
        for offer in offers:
            f.write(json.dumps(dataclasses.asdict(offer), ensure_ascii=False, default=str) + "\n")
    print(f"telegram: wrote {len(offers)} offers to {cache_path}", file=sys.stderr)


if __name__ == "__main__":
    main()