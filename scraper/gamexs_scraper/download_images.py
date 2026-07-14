"""Download seller-scraped cover images to local files, one per game.

For local/dev use only. In production these should live in object storage
(S3/R2/etc.) with the DB storing a reference URL instead of a local path —
this script is the localhost stand-in for that until the platform exists.
"""

import argparse
import os
import re
import sys
from urllib.parse import urlparse

from .export_csv import load_cached_offers
from .http import PoliteFetcher, make_session
from .models import RawOffer
from .normalize import normalize_game_name

# Modern filesystems (APFS, ext4) handle UTF-8 filenames fine, so Persian
# titles are kept as-is rather than stripped to ASCII — stripping them
# collapsed Persian-only titles (e.g. "زورو") to an empty string and caused
# unrelated games to silently overwrite each other's cover file.
_UNSAFE_CHARS_RE = re.compile(r'[/\\:*?"<>|&]+')
_WHITESPACE_RE = re.compile(r"\s+")


def slugify(name: str) -> str:
    safe = _UNSAFE_CHARS_RE.sub("-", name)
    return _WHITESPACE_RE.sub("-", safe).strip("-")


def _extension(url: str) -> str:
    path = urlparse(url).path
    ext = os.path.splitext(path)[1].lower()
    return ext if ext in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"


def cover_image_by_game(offers: list[RawOffer]) -> dict[str, str]:
    covers: dict[str, str] = {}
    for offer in offers:
        if not offer.image_url:
            continue
        game = normalize_game_name(offer.raw_title)
        if game and game not in covers:
            covers[game] = offer.image_url
    return covers


def download_covers(covers: dict[str, str], out_dir: str, fetcher: PoliteFetcher) -> None:
    os.makedirs(out_dir, exist_ok=True)
    for i, (game, url) in enumerate(sorted(covers.items()), start=1):
        dest = os.path.join(out_dir, slugify(game) + _extension(url))
        if os.path.exists(dest):
            print(f"\r[{i}/{len(covers)}] cached {game}", end="", file=sys.stderr)
            continue
        try:
            response = fetcher.get(url)
            response.raise_for_status()
        except Exception as exc:
            print(f"\nskipping {game!r} ({url}): {exc}", file=sys.stderr)
            continue
        with open(dest, "wb") as f:
            f.write(response.content)
        print(f"\r[{i}/{len(covers)}] downloaded {game}", end="", file=sys.stderr)
    print(file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description="Download seller-scraped cover images, one file per game")
    parser.add_argument("seller")
    parser.add_argument("--cache", required=True, help="JSONL file of raw offers (from export_csv --cache)")
    parser.add_argument("-o", "--output", default=None, help="Output directory (default: output/images/<seller>)")
    args = parser.parse_args()

    offers = load_cached_offers(args.cache)
    covers = cover_image_by_game(offers)
    out_dir = args.output or os.path.join("output", "images", args.seller)
    print(f"{len(covers)} games with a cover image found in cache", file=sys.stderr)
    download_covers(covers, out_dir, PoliteFetcher(make_session()))


if __name__ == "__main__":
    main()
