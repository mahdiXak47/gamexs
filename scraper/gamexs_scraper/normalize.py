import re

# Ordered longest-phrase-first so e.g. "خرید اکانت بازی" is stripped whole
# instead of leaving stray "اکانت" behind. This is a heuristic good enough to
# group one seller's own listings; cross-seller/catalog matching should go
# through the IGDB-backed canonical catalog + admin review queue instead.
_NOISE_PATTERNS = [
    r"خرید\s+اکانت\s+بازی",
    r"خرید\s+بازی",
    r"اکانت\s+بازی",
    r"digital\s+code",
    r"game\s+key\s+card",
    r"برای\s+پلی\s+استیشن\s*5?",
    r"برای\s+ps5",
    r"ریجن\s*\d*",
    r"\bregion\s*\d*\b",
    r"\bps5\b",
    # "و ps4" / "و ps5" — multi-platform suffix used by YungCenter
    # e.g. "Call of Duty Black Ops 7 برای ps5 و ps4" → "Call of Duty Black Ops 7"
    r"\s*و\s+ps[45]\b",
    # "قانونی" — means "official/legal", used as a prefix by YungCenter
    # e.g. "خرید اکانت قانونی Forza Horizon 5" → "Forza Horizon 5"
    r"قانونی",
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
    text = raw_title
    for pattern in _COMPILED_NOISE:
        text = pattern.sub(" ", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    text = _DASH_STRIP_RE.sub("", text)
    return text.strip()


def normalize_game_name(raw_title: str) -> str:
    return clean_title(raw_title).lower()
