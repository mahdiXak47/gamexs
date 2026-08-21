"""Per-channel parsing specs for Telegram price feeds.

Every channel formats its prices differently, so each channel gets its own
spec: a regex to find price lines, a mapping of capacity labels to tiers, and
a multiplier to convert the channel's abbreviated price to full Toman. Add a
new channel here (and a sellers row in db/init/02_seed.sql + a numbered
migration) rather than special-casing it in the adapter.
"""

from dataclasses import dataclass

from .models import AccessTier, ProductType


@dataclass(frozen=True)
class TelegramChannelSpec:
    username: str
    seller_slug: str
    display_name: str
    # Captures (tier_label, price). The tier_label keys must match tier_map.
    price_re: str
    tier_map: dict[str, AccessTier]
    product_type: ProductType = ProductType.ACCOUNT_GAME
    # Channel prices are abbreviated, e.g. "4500" == 4,500,000 Toman.
    price_multiplier: int = 1000
    # Terms (lowercased) that mark a post as a non-account-game offer.
    skip_keywords: tuple[str, ...] = ()
    # If set, only posts newer than this many hours are parsed (full history otherwise).
    lookback_hours: int | None = None
    session_file: str = "telegram_sessions/playbox.session"


def _labels(*labels: str, tier: AccessTier) -> dict[str, AccessTier]:
    return {label: tier for label in labels}


PLAYBOX = TelegramChannelSpec(
    username="PlayBox_Account",
    seller_slug="playbox",
    display_name="پلی باکس",
    price_re=r"ظرفیت\s*(اول|دوم|سوم|یک|دو|سه|کامل|۱|۲|۳|1|2|3)\s*[:：]\s*([\d۰-۹,]+)",
    tier_map={
        **_labels("اول", "یک", "کامل", "۱", "1", tier=AccessTier.CAPACITY_1),
        **_labels("دوم", "دو", "۲", "2", tier=AccessTier.CAPACITY_2),
        **_labels("سوم", "سه", "۳", "3", tier=AccessTier.CAPACITY_3),
    },
    price_multiplier=1000,
    # Specific phrases (matched against the whole lowercased post) that mark a
    # post as a non-account-game offer. Keep them multi-word to avoid matching
    # a game whose body happens to mention "console"/"top-up".
    skip_keywords=("گیفت کارت", "کارت شارژ", "شارژ حساب"),
    lookback_hours=None,
    session_file="telegram_sessions/playbox.session",
)

CHANNELS: dict[str, TelegramChannelSpec] = {"PlayBox_Account": PLAYBOX}
CHANNEL_BY_SELLER: dict[str, TelegramChannelSpec] = {PLAYBOX.seller_slug: PLAYBOX}
