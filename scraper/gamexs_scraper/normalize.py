import re

# Persian/Arabic-Indic digits → ASCII digits
_PERSIAN_DIGIT_TABLE = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")

# Ordered longest-phrase-first so e.g. "خرید اکانت بازی" is stripped whole
# instead of leaving stray "اکانت" behind. This is a heuristic good enough to
# group one seller's own listings; cross-seller/catalog matching should go
# through the IGDB-backed canonical catalog + admin review queue instead.
_NOISE_PATTERNS = [
    # "و قیمت" = "and price" — seller prefix e.g. "و قیمت Red Dead Redemption"
    r"و\s+قیمت",
    r"خرید\s+اکانت\s+بازی",
    r"خرید\s+بازی",
    r"اکانت\s+ظرفیتی",
    r"اکانت\s+بازی",
    r"ظرفیتی",
    # "ویدیویی" = "video [game]" — Digikala product-type prefix
    r"ویدیویی",
    r"digital\s+code",
    r"game\s+key\s+card",
    r"برای\s+پلی\s+استیشن\s*5?",
    r"برای\s+ps5",
    # "مخصوص ps5 / مخصوص پلی استیشن" — TechnoLife suffix; must come before \bps5\b
    # so the compound is matched whole before ps5 is stripped on its own.
    r"مخصوص\s+ps5",
    r"مخصوص\s+پلی\s+استیشن\s*5?",
    r"مخصوص",
    r"ریجن\s*\d*",
    r"\bregion\s*\d*\b",
    r"\bps5\b",
    # "و ps4" / "و ps5" — multi-platform suffix used by YungCenter
    # e.g. "Call of Duty Black Ops 7 برای ps5 و ps4" → "Call of Duty Black Ops 7"
    r"\s*و\s+ps[45]\b",
    # Colon title-subtitle separator — PSPro includes it, other sellers omit it.
    # Replacing with a space prevents "007: First Light" → "007--first-light" (double dash)
    # while "007 First Light" → "007-first-light", causing a phantom duplicate.
    r"\s*:\s*",
    # "قانونی" — means "official/legal", used as a prefix by YungCenter
    # e.g. "خرید اکانت قانونی Forza Horizon 5" → "Forza Horizon 5"
    r"قانونی",
    # "دیسک" — means "disc", used as a prefix by NakhlMarket for physical games
    # e.g. "دیسک Assassin's Creed Shadows" → "Assassin's Creed Shadows"
    r"دیسک",
    r"خرید",
    r"اکانت",
    r"بازی",
    r"برای",
]
_COMPILED_NOISE = [re.compile(p, re.IGNORECASE) for p in _NOISE_PATTERNS]
_DASH_STRIP_RE = re.compile(r"^[\s\-–—]+|[\s\-–—]+$")
_WHITESPACE_RE = re.compile(r"\s+")


def clean_title(raw_title: str) -> str:
    """Same boilerplate-stripping as normalize_game_name, but keeps original
    casing — for a display title rather than a grouping/matching key."""
    # Normalise Persian/Arabic-Indic digits before any other processing so
    # titles like "۰۰۷ First Light" slug-match "007 First Light".
    text = raw_title.translate(_PERSIAN_DIGIT_TABLE)
    # Strip anything in parentheses (e.g. "( ارسال رایگان )" = free shipping notes)
    text = re.sub(r"\([^)]*\)", " ", text)
    for pattern in _COMPILED_NOISE:
        text = pattern.sub(" ", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    text = _DASH_STRIP_RE.sub("", text)
    # Insert a space between a digit and an immediately adjacent letter so
    # "007First Light" → "007 First Light" and all sellers share one slug.
    text = re.sub(r"(\d)([A-Za-z])", r"\1 \2", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    return text


def normalize_game_name(raw_title: str) -> str:
    return clean_title(raw_title).lower()
