import re
from abc import ABC, abstractmethod
from collections.abc import Iterator
from urllib.parse import unquote

from .http import PoliteFetcher, make_session
from .models import AccessTier, ProductType, RawOffer


class SellerAdapter(ABC):
    """One implementation per seller site. Adapters are read-only scrapers:
    they yield RawOffer records and never mutate seller-side state."""

    seller: str

    def __init__(self, fetcher: PoliteFetcher | None = None):
        self.fetcher = fetcher or PoliteFetcher(make_session())

    @abstractmethod
    def iter_listings(self) -> Iterator[RawOffer]:
        """Crawl the seller's catalog and yield every offer found."""
        raise NotImplementedError


_EDITION_WORDS = {"دیلاکس": "Deluxe", "دلوکس": "Deluxe", "آلتیمیت": "Ultimate", "التیمیت": "Ultimate",
                  "گلد": "Gold", "کالکتور": "Collector", "پریمیوم": "Premium", "استاندارد": "Standard"}


def title_with_edition(raw_title: str, attrs: dict[str, str]) -> str:
    """Append a variation's non-standard edition ("Ultimate Edition") to the title.

    WooCommerce pages often sell Standard and Ultimate/Deluxe side by side
    (cdkeyshare GTA VI). Without the edition every variant landed on the base
    game and the loader kept the cheapest, so an Ultimate price could replace a
    sold-out Standard one. With it, the variant resolves to its own catalog row
    (or stays unresolved if the catalog has none) — never to the wrong game.
    """
    for key, value in attrs.items():
        key = unquote(key).lower()
        if not ("ادیشن" in key or "edition" in key or "نسخه" in key):
            continue
        edition = unquote(value).replace("-", " ")
        for fa, en in _EDITION_WORDS.items():
            edition = edition.replace(fa, en)
        edition = re.sub(r"(?:ریجن|region)\s*\S*|[^A-Za-z0-9' ]+", " ", edition, flags=re.I)
        edition = " ".join(edition.split())
        if not edition or edition.lower().startswith("standard"):
            return raw_title
        if not edition.lower().endswith("edition"):
            edition += " Edition"
        return f"{raw_title} {edition}"
    return raw_title


# «ظرفیت کامل» (full capacity: the whole account, all three capacities) is its
# own purchase type, not capacity 1 — some shops sell it, some don't, and it
# costs far more. Tier maps use this marker; account_offer_type() turns it into
# OWN_ACCOUNT_GAME (shown as «ظرفیت کامل») with no tier.
FULL_CAPACITY = "full_capacity"


def account_offer_type(tier):
    """(product_type, tier) for an account offer whose tier may be FULL_CAPACITY."""
    if tier == FULL_CAPACITY:
        return ProductType.OWN_ACCOUNT_GAME, None
    return ProductType.ACCOUNT_GAME, tier
