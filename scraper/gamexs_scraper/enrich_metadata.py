"""Enrich the games table with metadata from IGDB.

Searches IGDB for each game that has no igdb_id yet, picks the best match
using name similarity + PS5 platform preference, and writes:
  igdb_id, igdb_name, title, slug, cover_url, genre_label, publisher,
  release_year, release_date

After a confident IGDB match the game's title and slug are replaced with the
IGDB canonical name (processed through clean_title / url_slugify) so all
display titles come from the authoritative source rather than seller-page H1s.

If the canonical slug already belongs to another game row (a duplicate scraped
under a different seller title), the current game's listings are reassigned to
that canonical row and the duplicate is deleted.

Safe to re-run: only games with igdb_id IS NULL are processed by default.
Use --all to re-enrich games that already have an igdb_id.

Usage:
    python -m gamexs_scraper.enrich_metadata [--limit N] [--dry-run] [--all]

Required env vars:
    DATABASE_URL          — Postgres connection string
    IGDB_CLIENT_ID        — Twitch app client_id
    IGDB_CLIENT_SECRET    — Twitch app client_secret
"""

import argparse
import os
import re
import sys
import time
from datetime import date, datetime, timezone
from difflib import SequenceMatcher

import psycopg
import requests
from dotenv import load_dotenv

from .load_to_postgres import url_slugify
from .normalize import clean_title, normalize_game_name

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
IGDB_GAMES_URL = "https://api.igdb.com/v4/games"
PS5_PLATFORM_ID = 167
COVER_URL_TEMPLATE = "https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg"

# Categories that represent a proper releasable game (not DLC, episode, etc.)
_MAIN_CATEGORIES = {
    0,   # main_game
    4,   # standalone_expansion
    8,   # remake
    9,   # remaster
    10,  # expanded_game
}

# Accept IGDB match only if score reaches this threshold (0–1 + bonuses).
_MIN_SCORE = 0.65

# Seconds between requests — IGDB free tier allows 4 req/s; 0.28 s ≈ 3.5/s.
_RATE_DELAY = 0.28

# IGDB fields returned per game result.
_FIELDS = (
    "name,slug,category,cover.image_id,"
    "storyline,summary,url,"
    "version_parent,version_title,"
    "genres.name,"
    "themes.name,"
    "game_modes.name,"
    "franchises.name,"
    "collections.name,"
    "platforms.id,platforms.name,"
    "involved_companies.company.name,involved_companies.publisher,involved_companies.developer,"
    "first_release_date"
)

# Fields fetched when searching for edition versions of a base game.
_VERSION_FIELDS = "id,name,version_parent,version_title"

# Strip Persian/Arabic Unicode block so only English remains for IGDB search.
_PERSIAN_RE = re.compile(r"[؀-ۿ‌‍]+")

# Strip common edition/variant suffixes that confuse IGDB search ranking.
# Includes Remake/Remastered/Director's Cut so the base-game name is found first;
# a second direct-search pass then locates the correct remake/remaster entry.
_EDITION_RE = re.compile(
    r"\s*[-–—]?\s*\b("
    r"edition|standard|deluxe|gold|platinum|ultimate|complete|"
    r"goty|premium|digital|bundle|remastered|remake|definitive|legendary|"
    r"collector[s']?|director[s']?|enhanced|anniversary|launch|cross.gen|"
    r"steel[\s-]*book|steelbook|"   # physical packaging, not a content edition
    r"day[\s-]*(?:one|1)|"          # "Day One" / "Day 1" / "Day-One" release qualifiers
    r"نسخه|ویژه|دیجیتال|کامل|اسپشیال"
    r")\b.*$",
    re.IGNORECASE,
)

# Strips only content-neutral words for the direct-search pass.
# Remake/Remastered/Director's Cut are deliberately kept so IGDB returns
# the correct independent game entry (category=remake/remaster) rather than
# the base game.
_NEUTRAL_STRIP_RE = re.compile(
    r"\s*[-–—]?\s*\b("
    r"standard|digital|bundle|cross.gen|launch|edition|"
    r"steel[\s-]*book|steelbook|"
    r"day[\s-]*(?:one|1)|"          # same Day One stripping for direct-search pass
    r"نسخه|ویژه|دیجیتال|کامل|اسپشیال"
    r")\b.*$",
    re.IGNORECASE,
)

# Edition keywords that exist as IGDB-independent game entries (category=remake/
# remaster), NOT as version_parent children.  Titles with these keywords need a
# direct full-title IGDB search rather than a version_parent lookup.
_DIRECT_SEARCH_KEYWORDS = {"director", "directors", "remastered", "remake"}

_WS_RE = re.compile(r"\s+")

# Title corrections applied before every IGDB search to fix known abbreviations
# and typos that break string-similarity matching.  Each entry is a compiled
# regex → replacement string.  Add a new entry whenever a game title fails to
# match IGDB and a simple text substitution would fix it.  Replacements are
# applied in order; backreference syntax (\1) works for capturing-group subs.
_SEARCH_CORRECTIONS: list[tuple[re.Pattern, str]] = [
    # Strip trademark symbols first so later corrections see clean text
    # (e.g. "UFC® 6" → "UFC 6" before the "UFC → EA Sports UFC" rule fires).
    (re.compile(r"[®™©ǝ]"), ""),
    # Strip platform-mode suffixes appended by Iranian sellers (not part of the IGDB title).
    # Must run early so subsequent corrections don't see "PS VR2" tokens.
    (re.compile(r"[_\s]*(PS\s*VR\s*2?|PSVR\s*2?|VR\s*2)[\s]*$", re.IGNORECASE), ""),
    # Strip "Capcom" or "Square Enix" publisher prefixes sellers mistakenly prepend.
    (re.compile(r"^(?:Capcom|Square\s+Enix)\s+", re.IGNORECASE), ""),
    # "Collector <game>" → "<game>"  (sellers label their bundle as "Collector" version)
    (re.compile(r"^Collector\s+", re.IGNORECASE), ""),
    # "Destiny Epic Mickey" → "Disney Epic Mickey"  (Destiny ≠ Disney, common seller OCR error)
    (re.compile(r"\bDestiny\s+Epic\s+Mickey\b", re.IGNORECASE), "Disney Epic Mickey"),
    # "Disney Illusion Island Starring Mickey And/& Friends" → "Disney Illusion Island"
    (re.compile(r"\bStarring\s+Mickey\b.*$", re.IGNORECASE), ""),
    # GTA → Grand Theft Auto  (GTA 6, GTA VI, GTA V, GTA IV, …)
    (re.compile(r"\bGTA\b", re.IGNORECASE), "Grand Theft Auto"),
    # "Farcry" → "Far Cry"  (written as one word by some sellers)
    (re.compile(r"\bFarcry\b", re.IGNORECASE), "Far Cry"),
    # "Ghost Runner" → "Ghostrunner"
    (re.compile(r"\bGhost\s+Runner\b", re.IGNORECASE), "Ghostrunner"),
    # "Pay Day" → "PayDay"
    (re.compile(r"\bPay\s+Day\b", re.IGNORECASE), "PayDay"),
    # "Formula 1" / "Formula1" → "F1"  (IGDB uses "F1 24" etc.)
    (re.compile(r"\bFormula\s*1\b", re.IGNORECASE), "F1"),
    # HTML-entity artifact "& Amp " → "&"  (e.g. "Ratchet & Amp Clank")
    (re.compile(r"&\s*Amp\b\s*", re.IGNORECASE), "& "),
    # Common letter-level typos found in seller catalogue data
    (re.compile(r"\bResidnet\b", re.IGNORECASE), "Resident"),
    (re.compile(r"\bEnhaced\b",  re.IGNORECASE), "Enhanced"),
    (re.compile(r"\bEdtion\b",   re.IGNORECASE), "Edition"),
    (re.compile(r"\bEditon\b",   re.IGNORECASE), "Edition"),
    (re.compile(r"\bAtelier\s+Yumis\b", re.IGNORECASE), "Atelier Yumia"),
    (re.compile(r"\bHunt\s+Show\s*Down\b", re.IGNORECASE), "Hunt Showdown"),
    # "Metal Gear Solid Delta 3 Snake Eater" → "Metal Gear Solid Delta Snake Eater"
    # Sellers add "3" (as in "MGS3") but IGDB uses the Greek letter name "Delta".
    (re.compile(r"\bMetal\s+Gear\s+Solid\s+(?:Delta|Δ)\s+3\b", re.IGNORECASE),
     "Metal Gear Solid Delta"),
    # "Mortal Kombat Elder God Bundle/Edition" → "Mortal Kombat 1"
    # "Bundle"/"Edition" may be stripped by _EDITION_RE before corrections run, so
    # also match the bare "Elder God" form.
    (re.compile(r"\bMortal\s+Kombat\s+Elder\s+God\b", re.IGNORECASE), "Mortal Kombat 1"),
    # "The Crew Motorsport" → "The Crew Motorfest"  (seller confuses with Forza Motorsport)
    (re.compile(r"\bThe\s+Crew\s+Motorsport\b", re.IGNORECASE), "The Crew Motorfest"),
    # "Tomb Raider 1 2 3 Remastered" → "Tomb Raider I-III Remastered"
    (re.compile(r"\bTomb\s+Raider\s+1\s+2\s+3\b", re.IGNORECASE), "Tomb Raider I-III"),
    # "W2 K24" / "W2 K26" → "WWE 2K24" / "WWE 2K26"
    # "W" is a shorthand for "WWE" used by some sellers (W is the old WWE logo letter).
    (re.compile(r"\bW2\s+K(\d{2})\b", re.IGNORECASE), r"WWE 2K\1"),
    # FC24 / FC26 / FC27 → EA Sports FC 24 / 26 / 27
    # Matches "FC" followed by exactly 2 digits — negative lookbehind avoids
    # double-expanding "EA Sports FC 24" (already correct).
    (re.compile(r"(?<!sports )\bFC\s*(\d{2})\b", re.IGNORECASE), r"EA Sports FC \1"),
    # "NBA 2 K21" / "WWE 2 K 25" → "NBA 2K21" / "WWE 2K25"
    # Sellers insert a space between "2" and "K"; IGDB has no space.
    # Also handles "NBA2 K26" / "WWE2 K25" where the brand has no space before 2.
    (re.compile(r"\b(NBA|WWE)2\s+K(\d)", re.IGNORECASE), r"\1 2K\2"),
    (re.compile(r"\b2\s+K\s*(\d)", re.IGNORECASE), r"2K\1"),
    # "UFC 5" → "EA Sports UFC 5"  (IGDB canonical title includes the EA Sports prefix)
    (re.compile(r"(?<!sports )\bUFC\s+(\d)", re.IGNORECASE), r"EA Sports UFC \1"),
    # "Lego 2 K Drive" → "Lego 2K Drive"  (IGDB: "LEGO 2K Drive")
    (re.compile(r"\bLego\s+(\d+)\s+K\b", re.IGNORECASE), r"Lego \1K"),
    # "Moto GP" → "MotoGP"  (IGDB uses no space)
    (re.compile(r"\bMoto\s+GP\b", re.IGNORECASE), "MotoGP"),
    # "F1 2022" / "F1 2025" → "F1 22" / "F1 25"
    # IGDB switched from 4-digit to 2-digit years starting with F1 22.
    (re.compile(r"\bF1\s+20(2[2-9])\b", re.IGNORECASE), r"F1 \1"),
    # "2 D" → "2D"  (Dragon Quest III HD-2D Remake, etc.)
    (re.compile(r"\b2\s+D\b", re.IGNORECASE), "2D"),
    # "1 St" → "1st"  (Front Mission 1st: Remake)
    (re.compile(r"\b1\s+St\b", re.IGNORECASE), "1st"),
    # Typos
    (re.compile(r"\bMutent\b", re.IGNORECASE), "Mutant"),
    (re.compile(r"\bRemasterd\b", re.IGNORECASE), "Remastered"),
    (re.compile(r"\bSupper\b", re.IGNORECASE), "Super"),
    (re.compile(r"\bPatrik\b", re.IGNORECASE), "Patrick"),
    # "Dark Souls Ll" → "Dark Souls II"  (L/I confusion in OCR/seller data)
    (re.compile(r"\bDark\s+Souls\s+Ll\b", re.IGNORECASE), "Dark Souls II"),
    # "Witcher 3" → "The Witcher 3"  (sellers drop the leading article)
    (re.compile(r"(?<![Tt]he )\bWitcher\s+3\b", re.IGNORECASE), "The Witcher 3"),
    # "Cricket22" / "Fifa21" / "Devil May Cry5" / "Dead Island2" / "Hunting Simulator2"
    # / "Layers Of Fear2023" — sellers omit the space between title word and number.
    # Only fires when a lowercase letter is immediately followed by digits (uppercase
    # acronyms like "PS5", "UFC6", "2K21" are unaffected).
    (re.compile(r"([a-z])(\d+)\b"), r"\1 \2"),
    # "Football Manager 2024 Console" / "Football Manager Console 2024"
    # → "Football Manager 2024"  (IGDB title omits the console qualifier)
    (re.compile(r"\bFootball\s+Manager\s+(\d{4})\s+Console\b", re.IGNORECASE), r"Football Manager \1"),
    (re.compile(r"\bFootball\s+Manager\s+Console\s+(\d{4})\b", re.IGNORECASE), r"Football Manager \1"),
    # Strip trailing ordinal number left over after _EDITION_RE removes "Anniversary".
    # e.g. "Hitman World Of Assassination 25 Th Anniversary"
    #   → _EDITION_RE strips " Anniversary" → "... 25 Th"
    #   → this correction strips " 25 Th" → "Hitman World Of Assassination"
    (re.compile(r"\s+\d+\s*(?:st|nd|rd|th)\s*$", re.IGNORECASE), ""),
]


def _apply_corrections(text: str) -> str:
    """Apply _SEARCH_CORRECTIONS in sequence to *text*."""
    for pattern, replacement in _SEARCH_CORRECTIONS:
        text = pattern.sub(replacement, text)
    return text


def _search_title(raw: str) -> str:
    """Derive a clean English search term from a potentially mixed-language title."""
    text = _PERSIAN_RE.sub(" ", raw)
    text = _EDITION_RE.sub("", text)
    text = _apply_corrections(text)
    text = _WS_RE.sub(" ", text).strip()
    # Escape double-quotes so the IGDB query string doesn't break.
    return text.replace('"', '\\"')


def _search_title_direct(raw: str) -> str:
    """Search term that keeps Remake/Remastered/Director's Cut for direct IGDB lookup."""
    text = _PERSIAN_RE.sub(" ", raw)
    text = _NEUTRAL_STRIP_RE.sub("", text)
    text = _apply_corrections(text)
    text = _WS_RE.sub(" ", text).strip()
    return text.replace('"', '\\"')


# ---------------------------------------------------------------------------
# Twitch OAuth
# ---------------------------------------------------------------------------
def get_access_token(client_id: str, client_secret: str) -> str:
    resp = requests.post(
        TWITCH_TOKEN_URL,
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "client_credentials",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# IGDB query
# ---------------------------------------------------------------------------
def _igdb_search(session: requests.Session, title: str) -> list[dict]:
    """Return up to 10 IGDB results for *title*.

    No category filter — IGDB stores many base games with category=null, so
    filtering by category = (0,4,8,9,10) incorrectly drops them.  DLC results
    are naturally rejected by _pick_best because their longer ": subtitle" names
    score below the 0.65 similarity threshold.
    """
    if not title:
        return []
    query = f'search "{title}"; fields {_FIELDS}; limit 10;'
    resp = session.post(IGDB_GAMES_URL, data=query, timeout=15)
    resp.raise_for_status()
    return resp.json()


def _igdb_by_slug(session: requests.Session, slug: str) -> dict | None:
    """Direct slug lookup — single authoritative match, no ranking ambiguity."""
    if not slug:
        return None
    query = f'fields {_FIELDS}; where slug = "{slug}"; limit 1;'
    resp = session.post(IGDB_GAMES_URL, data=query, timeout=15)
    resp.raise_for_status()
    results = resp.json()
    return results[0] if results else None


# Edition keywords that represent a distinct purchasable variant.
# "standard" is intentionally absent — it IS the base game and should keep
# the base igdb_id rather than mapping to an unrelated IGDB version entry.
_DISTINCT_EDITION_KEYWORDS = {
    "ultimate", "deluxe", "gold", "platinum", "complete", "goty",
    "premium", "collector", "collectors", "director", "directors",
    "enhanced", "anniversary", "legendary", "definitive",
    "remastered", "remake",
}


def _edition_keywords(title: str) -> set[str]:
    """Return lowercase edition keywords present in *title* (e.g. {'ultimate'})."""
    match = _EDITION_RE.search(title)
    if not match:
        return set()
    edition_text = match.group(0).lower()
    return {kw for kw in _DISTINCT_EDITION_KEYWORDS if kw in edition_text}


def _igdb_find_version(
    session: requests.Session, parent_id: int, our_title: str
) -> dict | None:
    """Return the IGDB version entry (child of *parent_id*) whose edition
    keywords match *our_title*, or None if no confident match exists.

    IGDB stores edition variants (Ultimate, Deluxe, etc.) as separate game
    entries linked to their base game via version_parent.  The base game's
    IGDB search result never surfaces these children, so we query explicitly.

    "Standard" editions are NOT looked up here — standard == the base game,
    so they correctly keep the parent's igdb_id.
    """
    our_keywords = _edition_keywords(our_title)
    # No distinct edition keyword → this is a base/standard game; skip lookup.
    if not our_keywords:
        return None

    query = (
        f"fields {_VERSION_FIELDS};"
        f" where version_parent = {parent_id};"
        " limit 20;"
    )
    try:
        resp = session.post(IGDB_GAMES_URL, data=query, timeout=15)
        resp.raise_for_status()
        versions = resp.json()
    except requests.RequestException:
        return None

    if not versions:
        return None

    # Only consider versions whose name or version_title contains at least one
    # of our edition keywords — prevents "Deluxe" from matching "Standard".
    candidates = []
    for v in versions:
        v_text = (v.get("name", "") + " " + v.get("version_title", "")).lower()
        if our_keywords & {kw for kw in _DISTINCT_EDITION_KEYWORDS if kw in v_text}:
            candidates.append(v)

    if not candidates:
        return None

    # Among keyword-matched candidates, pick the one with highest name similarity.
    return max(candidates, key=lambda v: _similarity(v.get("name", ""), our_title))


# ---------------------------------------------------------------------------
# Match scoring and selection
# ---------------------------------------------------------------------------
def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _score(result: dict, query: str) -> float:
    """Score 0..~1.2. Higher = better match for *query*."""
    name = result.get("name", "")
    name_sim = _similarity(name, query)

    # Word-coverage penalty: when the IGDB name's significant words (3+ chars) are a
    # *strict subset* of the query's words, the query refers to a more specific title
    # than this IGDB entry covers.  Penalise proportionally to the uncovered query words.
    # e.g. "Tomb Raider" (2 words) matching "Tomb Raider I-ii-iii Remastered" (4 words)
    # scores 0.79 via common prefix but should be rejected for the specific collection.
    name_words  = set(re.findall(r'\b\w{3,}\b', name.lower()))
    query_words = set(re.findall(r'\b\w{3,}\b', query.lower()))
    if name_words and query_words and name_words < query_words:  # strict subset
        extra = query_words - name_words
        name_sim -= 0.5 * len(extra) / len(query_words)

    ps5_bonus = 0.08 if PS5_PLATFORM_ID in [p["id"] for p in result.get("platforms", [])] else 0.0
    cat_bonus = 0.05 if result.get("category", -1) in _MAIN_CATEGORIES else 0.0
    return name_sim + ps5_bonus + cat_bonus


def _colon_subtitle_matches_query(name: str, query: str) -> bool:
    """True when a "Game: Subtitle" IGDB entry is a relevant match for *query*.

    Two ways to pass:
    1. The subtitle shares a NEW word with the query (one not already in the main title):
       "FIFA 21: NXT LVL Edition" vs "Fifa 21 LVL" → "lvl" is in query & subtitle → True
    2. The main title (before ":") alone is very similar to the query:
       "Uncharted 4: A Thief's End" vs "Uncharted 4" → main sim = 1.0 → True

    Drops pure DLC/mod entries whose subtitle has zero unique overlap with the query:
       "Persona 3 Reload: FeMC Mod" vs "Persona 3 Reload" → "femc/mod" not in query → False
    """
    if ": " not in name:
        return True
    main_title, subtitle = name.split(": ", 1)
    # Check 1: main title similarity (covers "Uncharted 4: A Thief's End" case)
    if _similarity(main_title, query) >= 0.90:
        return True
    # Check 2: subtitle has a word that's (a) in the query AND (b) not in the main title
    main_words = set(re.findall(r'\b\w{3,}\b', main_title.lower()))
    q_words = set(re.findall(r'\b\w{3,}\b', query.lower()))
    sub_words = set(re.findall(r'\b\w{3,}\b', subtitle.lower()))
    unique_sub = sub_words - main_words  # words that add new info vs the main title
    return bool(q_words & unique_sub)


def _pick_best(results: list[dict], query: str) -> dict | None:
    if not results:
        return None
    # When the query has no colon, keep only results that either (a) have no ": "
    # in their name (base-game entries) or (b) have a subtitle that shares at least
    # one word with the query (relevant edition, e.g. "FIFA 21: NXT LVL Edition").
    # This drops pure DLC/mod entries ("Persona 3 Reload: FeMC Mod") that IGDB
    # surfaces above the base game, while keeping legit variant titles.
    if ":" not in query:
        candidates = [
            r for r in results
            if _colon_subtitle_matches_query(r.get("name", ""), query)
        ]
    else:
        candidates = results
    if not candidates:
        return None  # let slug fallback handle all-DLC result pages
    best = max(candidates, key=lambda r: _score(r, query))
    best_score = _score(best, query)
    if best_score >= _MIN_SCORE:
        return best
    # Main-title shortcut: if this is a "Game: Subtitle" entry whose title before ":"
    # very closely matches the query, accept it regardless of subtitle length penalty.
    # e.g. "Uncharted 4: A Thief's End" (full score 0.59) for query "Uncharted 4".
    # e.g. "MXGP 2020: The Official Motocross Videogame" (score 0.31) for "Mxgp 2020".
    # The slug fallback still runs after and will override with a cleaner entry if one
    # exists (e.g. base game slug when search returned only DLC variations).
    if ": " in best.get("name", "") and ":" not in query:
        main = best["name"].split(": ")[0]
        if _similarity(main, query) >= 0.90:
            return best
    return None


# ---------------------------------------------------------------------------
# Data extraction from a matched IGDB result
# ---------------------------------------------------------------------------
def _cover_url(result: dict) -> str | None:
    image_id = (result.get("cover") or {}).get("image_id")
    return COVER_URL_TEMPLATE.format(image_id=image_id) if image_id else None


def _publisher(result: dict) -> str | None:
    companies = result.get("involved_companies") or []
    for ic in companies:
        if ic.get("publisher"):
            return (ic.get("company") or {}).get("name")
    for ic in companies:
        name = (ic.get("company") or {}).get("name")
        if name:
            return name
    return None


def _developers(result: dict) -> list[str]:
    return [
        ic["company"]["name"]
        for ic in (result.get("involved_companies") or [])
        if ic.get("developer") and ic.get("company", {}).get("name")
    ]


def _genre(result: dict) -> str | None:
    genres = result.get("genres") or []
    return genres[0]["name"] if genres else None


def _names(result: dict, key: str) -> list[str]:
    return [item["name"] for item in (result.get(key) or []) if item.get("name")]


def _release_date(result: dict) -> date | None:
    ts = result.get("first_release_date")
    return datetime.fromtimestamp(ts, tz=timezone.utc).date() if ts else None


# ---------------------------------------------------------------------------
# DB write with reconnect-on-failure (survives kubectl port-forward drops)
# ---------------------------------------------------------------------------
_RECONNECT_DELAY = 20  # seconds between reconnect attempts (infinite retries)


def _db_connect(database_url: str) -> psycopg.Connection:
    """Connect with infinite retries — waits for port-forward to come back."""
    attempt = 0
    while True:
        try:
            return psycopg.connect(database_url, connect_timeout=10)
        except psycopg.OperationalError as exc:
            attempt += 1
            print(
                f"\n  DB unavailable (attempt {attempt}): {exc}\n"
                f"  Waiting {_RECONNECT_DELAY}s — restart port-forward if needed …",
                file=sys.stderr,
            )
            time.sleep(_RECONNECT_DELAY)


def _write_game(
    database_url: str,
    game_id: int,
    platform_id: int,
    igdb_id: int,
    igdb_name: str,
    new_title: str,
    new_slug: str,
    genre: str | None,
    publisher: str | None,
    release_dt: date | None,
    cover: str | None,
    storyline: str | None,
    summary: str | None,
    igdb_url: str | None,
    genres: list[str],
    game_modes: list[str],
    platforms: list[str],
    franchises: list[str],
    collections: list[str],
    developers: list[str],
) -> str:
    """Write IGDB metadata to the game row and return a status string.

    Status values:
      "updated"  — game row updated in place
      "merged"   — current game was a duplicate; its listings were reassigned
                   to the canonical row and it was deleted
    """
    year = release_dt.year if release_dt else None
    while True:
        try:
            with _db_connect(database_url) as conn:
                with conn.cursor() as cur:
                    # Check whether another game already owns the canonical slug.
                    cur.execute(
                        "SELECT id FROM ps5_games WHERE platform_id = %s AND slug = %s AND id != %s",
                        (platform_id, new_slug, game_id),
                    )
                    conflict = cur.fetchone()

                    # Also merge rows that resolved to the same igdb_id without a slug
                    # collision — this handles the same game sold under different seller
                    # names (e.g. "Resident Evil 4" and "Resident Evil 4 Remake" both
                    # resolving to the 2023 remake's IGDB entry).
                    if not conflict:
                        cur.execute(
                            "SELECT id FROM ps5_games WHERE platform_id = %s AND igdb_id = %s AND id != %s",
                            (platform_id, igdb_id, game_id),
                        )
                        conflict = cur.fetchone()

                    _detail_params = (
                        storyline or None,
                        summary or None,
                        igdb_url or None,
                        genres or None,
                        game_modes or None,
                        platforms or None,
                        franchises or None,
                        collections or None,
                        developers or None,
                    )

                    if conflict:
                        primary_id = conflict[0]
                        cur.execute(
                            "UPDATE listings SET game_id = %s WHERE game_id = %s",
                            (primary_id, game_id),
                        )
                        cur.execute("DELETE FROM ps5_games WHERE id = %s", (game_id,))
                        cur.execute(
                            """
                            UPDATE ps5_games SET
                                igdb_id      = %s,
                                igdb_name    = %s,
                                title        = %s,
                                genre_label  = COALESCE(%s, genre_label),
                                publisher    = COALESCE(%s, publisher),
                                release_year = COALESCE(%s::smallint, release_year),
                                release_date = COALESCE(%s, release_date),
                                cover_url    = COALESCE(%s, cover_url),
                                storyline    = COALESCE(%s, storyline),
                                summary      = COALESCE(%s, summary),
                                igdb_url     = COALESCE(%s, igdb_url),
                                genres       = COALESCE(%s, genres),
                                game_modes   = COALESCE(%s, game_modes),
                                platforms    = COALESCE(%s, platforms),
                                franchises   = COALESCE(%s, franchises),
                                collections  = COALESCE(%s, collections),
                                developers   = COALESCE(%s, developers)
                            WHERE id = %s
                            """,
                            (igdb_id, igdb_name, new_title, genre, publisher, year, release_dt, cover,
                             *_detail_params, primary_id),
                        )
                        conn.commit()
                        return "merged"

                    # No conflict — update this game row with IGDB data.
                    cur.execute(
                        """
                        UPDATE ps5_games SET
                            igdb_id      = %s,
                            igdb_name    = %s,
                            title        = %s,
                            slug         = %s,
                            genre_label  = COALESCE(%s, genre_label),
                            publisher    = COALESCE(%s, publisher),
                            release_year = COALESCE(%s::smallint, release_year),
                            release_date = COALESCE(%s, release_date),
                            cover_url    = COALESCE(%s, cover_url),
                            storyline    = %s,
                            summary      = %s,
                            igdb_url     = %s,
                            genres       = %s,
                            game_modes   = %s,
                            platforms    = %s,
                            franchises   = %s,
                            collections  = %s,
                            developers   = %s
                        WHERE id = %s
                        """,
                        (igdb_id, igdb_name, new_title, new_slug, genre, publisher, year, release_dt, cover,
                         *_detail_params, game_id),
                    )
                conn.commit()
            return "updated"
        except psycopg.OperationalError as exc:
            print(f"\n  Write failed mid-connection: {exc}; retrying …", file=sys.stderr)
            time.sleep(_RECONNECT_DELAY)


def _fetch_games(database_url: str, all_games: bool) -> list[tuple[int, int, str]]:
    with _db_connect(database_url) as conn:
        with conn.cursor() as cur:
            # Exclude games whose title mentions PS4 but not PS5 — these are
            # PS4-only listings that the scraper stored under the PS5 platform
            # because load_to_postgres always uses --platform ps5.
            ps5_only = (
                "(g.title NOT ILIKE '%ps4%' OR g.title ILIKE '%ps5%')"
            )
            base = (
                "SELECT g.id, g.platform_id, g.title FROM ps5_games g "
                f"JOIN platforms p ON p.id = g.platform_id AND p.slug = 'ps5' "
                f"WHERE {ps5_only}"
            )
            if all_games:
                cur.execute(base + " ORDER BY g.title")
            else:
                cur.execute(base + " AND g.igdb_id IS NULL ORDER BY g.title")
            return cur.fetchall()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Enrich game rows with IGDB metadata")
    parser.add_argument("--limit", type=int, default=0, help="Max games to process (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Print results without writing to DB")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Re-enrich games that already have an igdb_id (full refresh)",
    )
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    client_id = os.environ.get("IGDB_CLIENT_ID")
    client_secret = os.environ.get("IGDB_CLIENT_SECRET")

    if not database_url:
        sys.exit("DATABASE_URL is not set — check .env at the repo root")
    if not client_id or not client_secret:
        sys.exit("IGDB_CLIENT_ID and IGDB_CLIENT_SECRET must be set in .env")

    print("obtaining IGDB access token …", file=sys.stderr)
    token = get_access_token(client_id, client_secret)

    session = requests.Session()
    session.headers.update({
        "Client-ID": client_id,
        "Authorization": f"Bearer {token}",
        "Content-Type": "text/plain",
    })

    games = _fetch_games(database_url, args.all)

    if args.limit:
        games = games[: args.limit]

    total = len(games)
    print(f"{total} games to enrich", file=sys.stderr)

    matched = merged = skipped = errors = 0

    for i, (game_id, platform_id, title) in enumerate(games, start=1):
        print(f"\r[{i:>4}/{total}] {title[:55]:<55}", end="", file=sys.stderr)

        search_term = _search_title(title)
        if not search_term:
            skipped += 1
            continue

        try:
            results = _igdb_search(session, search_term)
            time.sleep(_RATE_DELAY)
        except requests.RequestException as exc:
            print(f"\n  request error for {title!r}: {exc}", file=sys.stderr)
            errors += 1
            continue

        best = _pick_best(results, search_term)

        # Slug fallback: try a direct slug lookup and prefer the slug result when
        # (a) search returned nothing / below threshold, OR (b) search returned a
        # colon-named DLC/mod entry and the slug points to a clean base game.
        # This handles "Persona 3 Reload" where all 10 search results are "P3R: <DLC>"
        # while slug "persona-3-reload" returns the base game directly.
        search_has_colon = best is not None and ": " in best.get("name", "") and ":" not in search_term
        if not best or search_has_colon:
            try:
                slug_candidate = url_slugify(normalize_game_name(search_term.replace("'", "")))
                fallback = _igdb_by_slug(session, slug_candidate)
                time.sleep(_RATE_DELAY)
                if fallback and _score(fallback, search_term) >= _MIN_SCORE:
                    # Prefer slug when it provides a cleaner (non-colon) result
                    if not best or (": " in best.get("name", "") and ": " not in fallback.get("name", "")):
                        best = fallback
            except requests.RequestException:
                pass

        # Truncation fallback: search returned zero results (seller appended a word
        # IGDB doesn't know, e.g. "Dead Island 2 Hella", "Layers of Fear 2023").
        # Drop the last word and retry once.
        if not best and not results:
            shorter = " ".join(search_term.split()[:-1])
            if shorter:
                try:
                    shorter_results = _igdb_search(session, shorter)
                    time.sleep(_RATE_DELAY)
                    best = _pick_best(shorter_results, shorter)
                except requests.RequestException:
                    pass

        if not best:
            skipped += 1
            continue

        igdb_id   = best["id"]
        igdb_name = best["name"]

        # Decide whether to adopt IGDB's canonical name as the display title.
        # _search_title strips edition words before querying IGDB, so IGDB
        # may return the BASE game even when our DB row is for a specific
        # edition (e.g. "Collector"). In that case, keep our normalized title
        # so edition variants stay as separate rows with correct pricing.
        our_clean_title  = clean_title(title)
        our_has_edition  = bool(_EDITION_RE.search(our_clean_title))
        igdb_has_edition = bool(_EDITION_RE.search(igdb_name))

        # When our title is an edition variant but IGDB returned the base game,
        # try to find the correct edition-specific IGDB entry.
        our_distinct_edition = bool(_edition_keywords(our_clean_title))
        if our_has_edition and not igdb_has_edition and our_distinct_edition:
            our_kw = _edition_keywords(our_clean_title)

            # Step 1 — version_parent child lookup (works for Ultimate/Deluxe/Gold/etc.)
            version = None
            if our_kw - _DIRECT_SEARCH_KEYWORDS:
                try:
                    version = _igdb_find_version(session, igdb_id, our_clean_title)
                    time.sleep(_RATE_DELAY)
                except requests.RequestException as exc:
                    print(f"\n  version lookup error for {title!r}: {exc}", file=sys.stderr)

            if version:
                igdb_id   = version["id"]
                igdb_name = version.get("name", igdb_name)
                print(
                    f"\n  edition match: {title!r} → igdb:{igdb_id} {igdb_name!r}",
                    file=sys.stderr,
                )
            elif our_kw & _DIRECT_SEARCH_KEYWORDS:
                # Step 2 — direct full-title search for Remake/Remastered/Director's Cut.
                # IGDB stores these as independent game entries (category=remake/remaster),
                # not as version_parent children, so a separate search is required.
                direct_term = _search_title_direct(our_clean_title)
                try:
                    direct_results = _igdb_search(session, direct_term)
                    time.sleep(_RATE_DELAY)
                    direct_best = _pick_best(direct_results, our_clean_title)
                    if direct_best and direct_best["id"] != igdb_id:
                        igdb_id   = direct_best["id"]
                        igdb_name = direct_best["name"]
                        best = direct_best  # use remake's metadata (cover, genres, etc.)
                        print(
                            f"\n  direct match: {title!r} → igdb:{igdb_id} {igdb_name!r}",
                            file=sys.stderr,
                        )
                except requests.RequestException as exc:
                    print(f"\n  direct lookup error for {title!r}: {exc}", file=sys.stderr)

            # Re-check after igdb_name may have been updated by version/direct lookup.
            igdb_has_edition = bool(_EDITION_RE.search(igdb_name))

        # Title/slug: use IGDB canonical unless this is a distinct edition variant
        # (Ultimate, Deluxe, Director's Cut, etc.) that needs its own separate row.
        # Standard/Launch/generic editions resolve to the base game's canonical name,
        # which triggers a slug conflict → merge with the base game row.
        if not our_has_edition or igdb_has_edition or not our_distinct_edition:
            new_title = clean_title(igdb_name)
            if igdb_has_edition:
                # igdb_name was updated to an edition-specific name, but best still
                # points to the base game — best.get("slug") would return the base
                # game's slug and merge the edition into it. Compute from igdb_name.
                # Strip apostrophes first: url_slugify doesn't strip them and IGDB
                # names like "Assassin's Creed" would produce slugs with apostrophes.
                new_slug = url_slugify(normalize_game_name(igdb_name.replace("'", "")))
            else:
                # No edition: best.get("slug") is the correct canonical base slug.
                new_slug = best.get("slug") or url_slugify(normalize_game_name(igdb_name))
        else:
            new_title = our_clean_title
            new_slug  = url_slugify(normalize_game_name(title))

        cover       = _cover_url(best)
        genre       = _genre(best)
        publisher   = _publisher(best)
        release_dt  = _release_date(best)
        storyline   = best.get("storyline") or None
        summary     = best.get("summary") or None
        igdb_url    = best.get("url") or None
        genres      = _names(best, "genres")
        game_modes  = _names(best, "game_modes")
        platforms   = _names(best, "platforms")
        franchises  = _names(best, "franchises")
        collections = _names(best, "collections")
        developers  = _developers(best)

        if args.dry_run:
            edition_note = " [edition kept]" if (our_has_edition and not igdb_has_edition and our_distinct_edition) else ""
            print(
                f"\n  → igdb:{igdb_id} {igdb_name!r} -> title={new_title!r} slug={new_slug!r}{edition_note}\n"
                f"     genre={genre} pub={publisher} date={release_dt} cover={'yes' if cover else 'no'}\n"
                f"     genres={genres} modes={game_modes} platforms={platforms[:3]}\n"
                f"     franchises={franchises} collections={collections} devs={developers}",
                file=sys.stderr,
            )
            matched += 1
            continue

        status = _write_game(
            database_url, game_id, platform_id,
            igdb_id, igdb_name, new_title, new_slug,
            genre, publisher, release_dt, cover,
            storyline, summary, igdb_url,
            genres, game_modes, platforms, franchises, collections, developers,
        )
        if status == "merged":
            merged += 1
        else:
            matched += 1

    print(file=sys.stderr)
    print(
        f"done — {matched} updated, {merged} merged into canonical row, "
        f"{skipped} no confident match, {errors} request errors",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
