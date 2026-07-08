from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


class ProductType(str, Enum):
    ACCOUNT_GAME = "account_game"
    OWN_ACCOUNT_GAME = "own_account_game" #this is equal to full_capacity
    DISC = "disc"
    SUBSCRIPTION = "subscription"
    GIFT_CARD = "gift_card"
    UNKNOWN = "unknown"


class AccessTier(str, Enum):
    CAPACITY_1 = "capacity_1"
    CAPACITY_2 = "capacity_2"
    CAPACITY_3 = "capacity_3"
    FULL_CAPACITY = "full_capacity"


@dataclass
class RawOffer:
    """One scraped, seller-priced offer for a single tier/variant of a listing."""

    seller: str
    source_url: str
    raw_title: str
    product_type: ProductType
    price_toman: int
    tier: AccessTier | None = None
    in_stock: bool = True
    image_url: str | None = None
    scraped_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
