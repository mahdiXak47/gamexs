import re

# Persian/Arabic-Indic digits → ASCII digits
_PERSIAN_DIGIT_TABLE = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")

# Persian transliterations of edition words → canonical English equivalents.
# Applied BEFORE noise stripping so the English word survives into the title.
# Order matters: longer/more-specific patterns first.
_EDITION_TRANSLATIONS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bکالکتور\b", re.IGNORECASE), "Collector"),
    (re.compile(r"\bلگسی\b|\bلجسی\b|\bلگاسی\b|\bلگیسی\b", re.IGNORECASE), "Legacy"),
    (re.compile(r"\bدلوکس\b", re.IGNORECASE), "Deluxe"),
    (re.compile(r"\bاولتیمیت\b|\bالتیمیت\b", re.IGNORECASE), "Ultimate"),
    (re.compile(r"\bپریمیوم\b", re.IGNORECASE), "Premium"),
    (re.compile(r"\bاستاندارد\b", re.IGNORECASE), "Standard"),
    (re.compile(r"\bگلد\b", re.IGNORECASE), "Gold"),
]

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
    # "کارکرده" = "used/second-hand" — condition prefix, never part of game identity
    # e.g. "کارکرده Alan Wake 2 نسخه Deluxe Edition" → "Alan Wake 2 Deluxe Edition"
    r"کارکرده",
    # "نسخه" = "version/edition" — redundant when English "Edition" is also present
    # e.g. "Alan Wake 2 نسخه Deluxe Edition" → "Alan Wake 2 Deluxe Edition"
    r"نسخه",
    # "قیمت" = "price" — standalone variant; compound "و قیمت" is matched above
    r"قیمت",
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
# Fix capitalize() apostrophe artifact: "Assassin'S" → "Assassin's"
_APOSTROPHE_FIX_RE = re.compile(r"([A-Z])'([A-Z])")

# Valid Roman numerals I–XXX (enough to cover any game series)
_ROMAN_NUMERAL_RE = re.compile(
    r"^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$", re.IGNORECASE
)

# Official titles the generic title-case heuristic gets wrong — e.g. a
# leading symbol before an all-caps word defeats the "uppercase word ≤3
# letters" acronym check in _apply_title_case, so "#DRIVE Rally" → "#drive
# Rally". Matched case-insensitively against the fully-cleaned title, so this
# survives both scraper re-runs and IGDB enrichment (both call clean_title()).
_TITLE_CASE_OVERRIDES = {
    "#drive rally": "#DRIVE Rally",
}


def _apply_title_case(text: str) -> str:
    """Title-case each whitespace-separated token.

    Preserved as-is (all-caps kept):
    - Tokens ≤ 3 ASCII letters: acronyms like "II", "RPG", "GTA", "IV", "DLC"
    - Valid Roman numerals: "VIII", "XII", etc.

    Everything else is word-capitalised, fixing seller noise like
    "FIRST LIGHT" → "First Light" and "first light" → "First Light".
    """
    result_words: list[str] = []
    for word in text.split():
        ascii_only = re.sub(r"[^A-Za-z]", "", word)
        is_uppercase = ascii_only and ascii_only == ascii_only.upper()
        is_short_acronym = is_uppercase and len(ascii_only) <= 3
        is_roman = is_uppercase and bool(_ROMAN_NUMERAL_RE.match(ascii_only))
        if is_short_acronym or is_roman:
            result_words.append(word)  # keep acronym / Roman numeral casing
        else:
            result_words.append(word.capitalize())
    joined = " ".join(result_words)
    # Fix capitalize() apostrophe artifact: "Assassin'S" → "Assassin's"
    joined = _APOSTROPHE_FIX_RE.sub(lambda m: m.group(1) + "'" + m.group(2).lower(), joined)
    return joined


def clean_title(raw_title: str) -> str:
    """Strip seller boilerplate, translate Persian edition words to English,
    and return a consistently Title-Cased display title."""
    # 1. Normalise Persian/Arabic-Indic digits so "۰۰۷ First Light" and
    #    "007 First Light" share the same slug.
    text = raw_title.translate(_PERSIAN_DIGIT_TABLE)
    # 2. Strip anything in parentheses (e.g. "( ارسال رایگان )" = free shipping)
    text = re.sub(r"\([^)]*\)", " ", text)
    # 3. Translate Persian edition words → English BEFORE noise stripping so
    #    "نسخه کالکتور" → "نسخه Collector" → (strip نسخه) → "Collector".
    for pattern, replacement in _EDITION_TRANSLATIONS:
        text = pattern.sub(replacement, text)
    # 4. Strip seller boilerplate noise.
    for pattern in _COMPILED_NOISE:
        text = pattern.sub(" ", text)
    # 5. Tidy whitespace and leading/trailing dashes.
    text = _WHITESPACE_RE.sub(" ", text).strip()
    text = _DASH_STRIP_RE.sub("", text)
    # 6. Insert a space between a digit and an immediately adjacent letter so
    #    "007First Light" → "007 First Light".
    text = re.sub(r"(\d)([A-Za-z])", r"\1 \2", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    # 7. Apply consistent Title Case across all seller variants.
    cased = _apply_title_case(text)
    return _TITLE_CASE_OVERRIDES.get(cased.lower(), cased)


def normalize_game_name(raw_title: str) -> str:
    return clean_title(raw_title).lower()
