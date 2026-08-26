"""Catalog aliases used to map seller titles to canonical game rows.

Seller names are not reliable catalog identifiers.  This module deliberately
keeps the alias rules small and deterministic; fuzzy matching belongs in IGDB
enrichment/review, not in the price loader.
"""

import re

from .normalize import clean_title, normalize_game_name


_EDITION_WORD_RE = re.compile(r"\bedition\b", re.IGNORECASE)
_EA_SPORTS_RE = re.compile(r"\bea\s+sports\b", re.IGNORECASE)
_FC_NUMBER_RE = re.compile(r"\bfc\s+(\d{2})\b", re.IGNORECASE)


def _normalise_candidate(value: str) -> str:
    return normalize_game_name(value).strip()


def alias_candidates(*titles: str) -> set[str]:
    """Return exact normalized aliases for one or more canonical titles.

    The only abbreviation rule is the common EA Sports FC naming convention.
    It is enough for seller titles such as ``FC 27 Ultimate`` while avoiding
    broad fuzzy matching that could attach a listing to the wrong game.
    """
    aliases: set[str] = set()
    for raw_title in titles:
        if not raw_title:
            continue
        cleaned = clean_title(raw_title)
        variants = {cleaned}

        # Sellers commonly omit the redundant "Edition" suffix.
        variants.add(_EDITION_WORD_RE.sub("", cleaned))

        # Iranian sellers commonly shorten "EA Sports FC 27" to "FC 27".
        without_ea_sports = _EA_SPORTS_RE.sub("", cleaned, count=1).strip()
        variants.add(without_ea_sports)
        variants.add(_EDITION_WORD_RE.sub("", without_ea_sports))
        variants.add(_EA_SPORTS_RE.sub("EA", cleaned, count=1))

        # Also accept the compact form used by some seller URLs/titles (FC27).
        for variant in tuple(variants):
            variants.add(_FC_NUMBER_RE.sub(r"FC\1", variant))

        for variant in variants:
            normalized = _normalise_candidate(variant)
            if normalized:
                aliases.add(normalized)
    return aliases
