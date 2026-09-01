"""Add one PS5 game (including editions) from IGDB URLs.

Example::

    .venv/bin/python add_game.py \
      https://www.igdb.com/games/ea-sports-fc-27 \
      https://www.igdb.com/games/ea-sports-fc-27-ultimate-edition \
      https://www.igdb.com/games/ea-sports-fc-27-ultimate-plus-edition

The command is idempotent.  It writes canonical IGDB rows and seller-title
aliases, then refreshes US/TR PS Store prices for only the imported rows.
Subsequent daily scraper and PS Store runs discover the rows normally.
"""

import argparse
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path
from urllib.parse import unquote

import psycopg
import requests
from dotenv import load_dotenv
from psycopg import sql

from gamexs_scraper.enrich_metadata import (
    _cover_url,
    _developers,
    _genre,
    _names,
    _publisher,
    _release_date,
    _igdb_by_slug,
    get_access_token,
)
from download_artworks import (
    ARTWORK_TEMPLATE,
    MAIN_BACKGROUNDS_DIR,
    choose_main_background_image_id,
    fetch_main_background_candidates,
    download as download_artwork,
    upload_file as upload_artwork,
    update_main_background_images,
)
from gamexs_scraper.download_igdb_images import (
    COVER_URL_TEMPLATE,
    SCREENSHOT_URL_TEMPLATE,
    fetch_main_covers_and_screenshots,
    fetch_na_covers,
    download_file,
)
from gamexs_scraper.game_aliases import alias_candidates
from gamexs_scraper.load_to_postgres import load_offers, url_slugify
from gamexs_scraper.adapters import ADAPTERS
from gamexs_scraper.models import ProductType, RawOffer
from gamexs_scraper.normalize import clean_title, normalize_game_name
from upload_to_s3 import (
    COVERS_DIR,
    SCREENSHOTS_DIR,
    list_existing_keys,
    make_client,
    set_bucket_public,
    update_db as update_image_db,
    upload_file as upload_image,
)


_IGDB_URL_RE = re.compile(
    r"^https?://(?:www\.)?igdb\.com/games/([^/?#]+)/?$",
    re.IGNORECASE,
)
_PS5_PLATFORM_ID = 167

# Keep the interactive seller prompt useful without making a network request
# just to discover each shop's homepage. These match db/init/02_seed.sql.
SELLER_WEBSITES = {
    "pspro": "https://pspro.ir",
    "yungcenter": "https://yungcenter.com",
    "nakhlmarket": "https://nakhlmarket.com",
    "technolife": "https://www.technolife.com",
    "persianconsole": "https://persianconsole.ir",
    "gameplayshop": "https://gameplayshop.ir",
    "digikala": "https://www.digikala.com",
    "parsconsole": "https://parsconsole.com",
    "gameonestore": "https://gameonestore.com",
    "xgamesstore": "https://xgamesstore.org",
    "gamecenter": "https://game-center.ir",
    "gamario": "https://gamario.com",
    "cdkeyshare": "https://www.cdkeyshare.ir",
    "dragonshop": "https://dragon-shop.ir",
    "doctorgame": "https://doctor-game.ir",
    "hajigame": "https://hajigame.ir",
    "gameaccess": "https://gameaccess.ir",
    "clockstore1": "https://clockstore1.ir",
    "gamepulse": "https://www.game-pulse.ir",
    "gpgaming": "https://gpgaming.ir",
    "gamestore": "https://game-store.org",
}

_ALIAS_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS ps5_game_aliases (
    id              SERIAL PRIMARY KEY,
    platform_id     SMALLINT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
    game_id         INTEGER NOT NULL REFERENCES ps5_games(id) ON DELETE CASCADE,
    normalized_name TEXT NOT NULL,
    source          TEXT NOT NULL DEFAULT 'igdb',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (platform_id, normalized_name)
)
"""


def parse_igdb_slug(url: str) -> str:
    """Extract and validate an IGDB game slug from a user-supplied URL."""
    match = _IGDB_URL_RE.match(url.strip())
    if not match:
        raise ValueError(f"not an IGDB game URL: {url!r}")
    return match.group(1)


def _metadata(result: dict) -> dict[str, object]:
    release_dt: date | None = _release_date(result)
    return {
        "title": clean_title(result["name"]),
        "slug": result.get("slug") or url_slugify(normalize_game_name(result["name"])),
        "genre_label": _genre(result),
        "publisher": _publisher(result),
        "release_year": release_dt.year if release_dt else None,
        "release_date": release_dt,
        "cover_url": _cover_url(result),
        "igdb_id": result["id"],
        "igdb_name": result.get("name"),
        "storyline": result.get("storyline") or None,
        "summary": result.get("summary") or None,
        "igdb_url": result.get("url") or None,
        "genres": _names(result, "genres") or None,
        "game_modes": _names(result, "game_modes") or None,
        "platforms": _names(result, "platforms") or None,
        "franchises": _names(result, "franchises") or None,
        "collections": _names(result, "collections") or None,
        "developers": _developers(result) or None,
    }


def _available_columns(cur: psycopg.Cursor, table: str) -> set[str]:
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = %s
        """,
        (table,),
    )
    return {row[0] for row in cur.fetchall()}


def _upsert_game(cur: psycopg.Cursor, platform_id: int, metadata: dict[str, object]) -> int:
    """Insert/update one IGDB game without disturbing existing listings."""
    game_id = None
    cur.execute("SELECT id FROM ps5_games WHERE igdb_id = %s", (metadata["igdb_id"],))
    row = cur.fetchone()
    if row:
        game_id = row[0]

    cur.execute(
        """
        SELECT id, igdb_id
        FROM ps5_games
        WHERE platform_id = %s AND slug = %s
        """,
        (platform_id, metadata["slug"]),
    )
    slug_row = cur.fetchone()
    if slug_row and slug_row[0] != game_id:
        raise ValueError(
            f"slug {metadata['slug']!r} already belongs to game id {slug_row[0]} "
            f"(IGDB {slug_row[1]}); refusing to merge it automatically"
        )

    columns = _available_columns(cur, "ps5_games")
    values = {"platform_id": platform_id, **metadata}
    writable = [
        column
        for column in (
            "platform_id", "slug", "title", "genre_label", "publisher", "release_year",
            "release_date", "cover_url", "igdb_id", "igdb_name", "storyline", "summary",
            "igdb_url", "genres", "game_modes", "platforms", "franchises", "collections",
            "developers",
        )
        if column in columns
    ]

    if game_id is None:
        query = sql.SQL("INSERT INTO ps5_games ({}) VALUES ({}) RETURNING id").format(
            sql.SQL(", ").join(map(sql.Identifier, writable)),
            sql.SQL(", ").join(sql.Placeholder(column) for column in writable),
        )
        cur.execute(query, {column: values[column] for column in writable})
        game_id = cur.fetchone()[0]
    else:
        update_columns = [column for column in writable if column not in {"platform_id", "igdb_id"}]
        query = sql.SQL("UPDATE ps5_games SET {} WHERE id = %s").format(
            sql.SQL(", ").join(
                sql.SQL("{} = %s").format(sql.Identifier(column)) for column in update_columns
            )
        )
        cur.execute(query, [values[column] for column in update_columns] + [game_id])

    return game_id


def _upsert_aliases(cur: psycopg.Cursor, platform_id: int, game_id: int, titles: list[str]) -> int:
    aliases = alias_candidates(*titles)
    for normalized_name in sorted(aliases):
        cur.execute(
            """
            SELECT game_id
            FROM ps5_game_aliases
            WHERE platform_id = %s AND normalized_name = %s
            """,
            (platform_id, normalized_name),
        )
        row = cur.fetchone()
        if row and row[0] != game_id:
            raise ValueError(
                f"alias {normalized_name!r} already belongs to game id {row[0]}; "
                "refusing to attach it to another game"
            )
        cur.execute(
            """
            INSERT INTO ps5_game_aliases (platform_id, game_id, normalized_name)
            VALUES (%s, %s, %s)
            ON CONFLICT (platform_id, normalized_name) DO NOTHING
            """,
            (platform_id, game_id, normalized_name),
        )
    return len(aliases)


def import_games(database_url: str, results: list[dict], platform_slug: str) -> list[int]:
    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        # Keep the one-command workflow safe for existing databases. Migration
        # 026 remains the formal schema migration for fresh/deployed databases.
        cur.execute(_ALIAS_SCHEMA_SQL)
        cur.execute(
            "CREATE INDEX IF NOT EXISTS ps5_game_aliases_game_id_idx "
            "ON ps5_game_aliases (game_id)"
        )
        cur.execute("SELECT id FROM platforms WHERE slug = %s", (platform_slug,))
        platform = cur.fetchone()
        if not platform:
            raise ValueError(f"unknown platform {platform_slug!r}")
        platform_id = platform[0]

        game_ids = []
        for result in results:
            metadata = _metadata(result)
            game_id = _upsert_game(cur, platform_id, metadata)
            aliases = _upsert_aliases(
                cur,
                platform_id,
                game_id,
                [metadata["title"], result.get("name", ""), result.get("slug", "").replace("-", " ")],
            )
            print(f"{metadata['title']} → game_id={game_id}, igdb_id={metadata['igdb_id']}, aliases={aliases}")
            game_ids.append(game_id)
        conn.commit()
    return game_ids


def refresh_psstore(database_url: str, game_ids: list[int], workers: int) -> None:
    script = Path(__file__).with_name("fetch_psstore_prices.py")
    command = [sys.executable, str(script), "--db-url", database_url, "--workers", str(workers)]
    for game_id in game_ids:
        command.extend(["--game-id", str(game_id)])
    subprocess.run(command, check=True)

    # IGDB often links only the family concept for a game. Search the official
    # Store for the imported edition titles so Ultimate/Deluxe rows can receive
    # their own product IDs and prices instead of inheriting the base SKU.
    resolver = Path(__file__).with_name("resolve_missing_psstore_concepts.py")
    command = [
        sys.executable,
        str(resolver),
        "--db-url",
        database_url,
        "--search-store",
        "--apply",
        "--workers",
        str(workers),
    ]
    for game_id in game_ids:
        command.extend(["--game-id", str(game_id)])
    try:
        subprocess.run(command, check=True)
    except subprocess.CalledProcessError as exc:
        if exc.returncode == 2:
            print(
                "WARNING: PlayStation Store edition search was unavailable; "
                "continuing with imported games and S3 media sync.",
                file=sys.stderr,
            )
        else:
            raise


def _require_s3_config() -> tuple[str, str, str, str]:
    values = (
        os.environ.get("S3_ENDPOINT_URL", "").strip(),
        os.environ.get("S3_ACCESS_KEY", "").strip(),
        os.environ.get("S3_SECRET_KEY", "").strip(),
        os.environ.get("S3_BUCKET", "").strip(),
    )
    if not all(values):
        raise ValueError("S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET are required")
    return values


def _download_game_assets(results: list[dict], session: requests.Session) -> list[tuple[Path, str]]:
    """Download covers, screenshots, and one main artwork per imported IGDB row."""
    igdb_ids = [result["id"] for result in results]
    covers = fetch_na_covers(session, igdb_ids)
    details = fetch_main_covers_and_screenshots(session, igdb_ids)
    artworks = fetch_main_background_candidates(session, igdb_ids)

    assets: list[tuple[Path, str]] = []
    for result in results:
        igdb_id = result["id"]
        slug = result.get("slug") or url_slugify(normalize_game_name(result["name"]))
        detail = details.get(igdb_id, {})

        cover_id = covers.get(igdb_id) or detail.get("cover_image_id")
        if cover_id:
            path = COVERS_DIR / f"{slug}-main-cover.webp"
            if download_file(COVER_URL_TEMPLATE.format(image_id=cover_id), str(path), session):
                assets.append((path, f"covers/{path.name}"))

        for index, screenshot_id in enumerate(detail.get("screenshot_ids", [])[:10], start=1):
            path = SCREENSHOTS_DIR / f"{slug}-catalog-pic-{index}.webp"
            if download_file(SCREENSHOT_URL_TEMPLATE.format(image_id=screenshot_id), str(path), session):
                assets.append((path, f"screenshots/{path.name}"))

        background_id = choose_main_background_image_id(igdb_id, artworks.get(igdb_id, []))
        if background_id:
            path = MAIN_BACKGROUNDS_DIR / f"{slug}-main-background-image.webp"
            if download_artwork(ARTWORK_TEMPLATE.format(image_id=background_id), path, session):
                assets.append((path, f"main-background-images/{path.name}"))

    return assets


def sync_assets(
    results: list[dict],
    session: requests.Session,
    database_targets: list[tuple[str, list[int]]],
) -> None:
    """Upload imported game media once and write S3 URLs to every DB target."""
    endpoint, access_key, secret_key, bucket = _require_s3_config()
    assets = _download_game_assets(results, session)
    if not assets:
        raise RuntimeError("IGDB returned no downloadable cover, screenshot, or artwork assets")

    client = make_client(endpoint, access_key, secret_key)
    set_bucket_public(client, bucket)
    existing = list_existing_keys(client, bucket)
    selected_keys: set[str] = set()
    for local_path, key in assets:
        selected_keys.add(key)
        if key in existing:
            continue
        if key.startswith("main-background-images/"):
            upload_artwork(client, bucket, local_path, key)
        else:
            upload_image(client, bucket, local_path, key)
        print(f"uploaded s3://{bucket}/{key}")

    for database_url, game_ids in database_targets:
        update_image_db(database_url, endpoint, bucket, selected_keys)
        background_updates = [
            (
                f"{endpoint.rstrip('/')}/{bucket}/main-background-images/{result['slug']}-main-background-image.webp",
                game_id,
            )
            for result, game_id in zip(results, game_ids)
            if f"main-background-images/{result['slug']}-main-background-image.webp" in selected_keys
        ]
        if background_updates:
            update_main_background_images(database_url, background_updates)


def filter_target_offers(offers: list[RawOffer], target_aliases: set[str]) -> list[RawOffer]:
    """Keep only offers whose normalized title is a new-game alias."""
    return [
        offer
        for offer in offers
        if normalize_game_name(offer.raw_title) in target_aliases
        or target_aliases.intersection(alias_candidates(offer.raw_title))
    ]


def parse_seller_url(adapter, seller: str, url: str) -> list[RawOffer]:
    """Parse one product URL using the seller adapter's site-specific parser."""
    if seller == "cdkeyshare":
        return list(adapter._parse_account(url))
    if seller == "persianconsole":
        decoded = unquote(url).lower()
        parser = adapter._parse_account if ("اکانت" in decoded or "account" in decoded) else adapter._parse_disc
        return list(parser(url))
    if seller == "nakhlmarket":
        decoded = unquote(url).lower()
        expected_type = ProductType.ACCOUNT_GAME if ("اکانت" in decoded or "account" in decoded) else ProductType.DISC
        return list(adapter._parse_product(url, expected_type))

    parser = getattr(adapter, "_parse_product", None)
    if parser is None:
        raise ValueError(f"{seller} does not expose a direct product-page parser")

    # Most WooCommerce/OpenCart adapters expose _parse_product(url). Some
    # adapters (for example gamestore/digikala) need category metadata and
    # therefore cannot safely parse an arbitrary URL directly.
    try:
        return list(parser(url))
    except TypeError as exc:
        raise ValueError(f"{seller} requires catalog metadata; direct URL parsing is not supported") from exc


def scrape_seller_url(
    seller: str,
    url: str,
    target_aliases: set[str],
) -> tuple[str, str, list[RawOffer], str | None]:
    """Fetch one supplied URL and return only offers for imported games."""
    try:
        offers = parse_seller_url(ADAPTERS[seller](), seller, url)
        return seller, url, filter_target_offers(offers, target_aliases), None
    except Exception as exc:
        return seller, url, [], str(exc)


def scan_seller_urls(
    seller_urls: list[tuple[str, str]],
    target_aliases: set[str],
    workers: int,
) -> dict[str, list[RawOffer]]:
    """Fetch only the explicitly supplied seller product URLs."""
    matches: dict[str, list[RawOffer]] = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(scrape_seller_url, seller, url, target_aliases): (seller, url)
            for seller, url in seller_urls
        }
        for future in as_completed(futures):
            seller, url, offers, error = future.result()
            matches.setdefault(seller, []).extend(offers)
            if error:
                print(f"WARNING: {seller} URL failed ({url}): {error}", file=sys.stderr)
            elif not offers:
                print(f"WARNING: {seller} URL returned no matching offers: {url}", file=sys.stderr)
            else:
                print(f"{seller}: {len(offers)} matching offers from {url}")
    return matches


def load_seller_offers(
    database_url: str,
    seller: str,
    offers: list[RawOffer],
    platform_slug: str,
) -> tuple[int, int]:
    """Load one seller's newly found offers into one database."""
    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM platforms WHERE slug = %s", (platform_slug,))
        platform = cur.fetchone()
        if not platform:
            raise ValueError(f"unknown platform {platform_slug!r}")
        cur.execute("SELECT id FROM sellers WHERE slug = %s", (seller,))
        seller_row = cur.fetchone()
        if not seller_row:
            raise ValueError(f"unknown seller {seller!r}")
        result = load_offers(cur, platform[0], seller_row[0], seller, offers)
        conn.commit()
        return result


def scan_and_load_sellers(
    database_targets: list[tuple[str, list[int]]],
    results: list[dict],
    platform_slug: str,
    seller_urls: list[tuple[str, str]],
    workers: int,
) -> None:
    target_aliases = alias_candidates(*(result.get("name", "") for result in results))
    seller_matches = scan_seller_urls(seller_urls, target_aliases, workers)
    for seller, offers in sorted(seller_matches.items()):
        if not offers:
            continue
        for database_url, _ in database_targets:
            try:
                games_count, listings_count = load_seller_offers(
                    database_url, seller, offers, platform_slug
                )
                print(
                    f"loaded {seller} into {database_url.rsplit('@', 1)[-1]}: "
                    f"{games_count} games, {listings_count} listings"
                )
            except (OSError, psycopg.Error, ValueError) as exc:
                print(f"WARNING: could not load {seller} offers into a database: {exc}", file=sys.stderr)


def parse_seller_url_specs(values: list[str]) -> list[tuple[str, str]]:
    """Parse repeatable SELLER=URL command-line values."""
    seller_urls = []
    for value in values:
        seller, separator, url = value.partition("=")
        if not separator or seller not in ADAPTERS or not url:
            raise ValueError(
                f"invalid --seller-url {value!r}; use SELLER=URL with a registered seller"
            )
        seller_urls.append((seller, url))
    return seller_urls


def prompt_for_seller_urls(
    input_fn=input,
) -> list[tuple[str, str]]:
    """Ask for URLs for every registered seller; blank input skips a seller."""
    seller_urls: list[tuple[str, str]] = []
    print(
        "Enter one or more product URLs for each seller, separated by commas. "
        "Press Enter to skip a seller."
    )
    for seller in sorted(ADAPTERS):
        try:
            website = SELLER_WEBSITES.get(seller, "website unavailable")
            answer = input_fn(f"{seller} ({website}) URL(s) [Enter to skip]: ").strip()
        except EOFError:
            print("\nNo interactive input available; skipping remaining sellers.", file=sys.stderr)
            break
        if not answer:
            continue
        seller_urls.extend((seller, url.strip()) for url in answer.split(",") if url.strip())
    return seller_urls


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Add/update PS5 games from IGDB edition URLs")
    parser.add_argument("igdb_urls", nargs="+", help="One or more https://www.igdb.com/games/<slug> URLs")
    parser.add_argument(
        "--local-db-url",
        default=None,
        help="Local Postgres URL (fallback: LOCAL_DATABASE_URL, then DATABASE_URL)",
    )
    parser.add_argument(
        "--production-db-url",
        default=None,
        help="Production Postgres URL (fallback: PRODUCTION_DATABASE_URL)",
    )
    parser.add_argument("--platform", default="ps5")
    parser.add_argument("--workers", type=int, default=4, help="PS Store workers")
    parser.add_argument(
        "--seller-workers",
        type=int,
        default=2,
        help="Concurrent seller adapters (default: 2)",
    )
    parser.add_argument(
        "--skip-sellers",
        action="store_true",
        help="Skip fetching supplied seller product URLs",
    )
    parser.add_argument(
        "--seller-url",
        action="append",
        default=[],
        metavar="SELLER=URL",
        help="Product URL to parse with a registered seller adapter (repeatable)",
    )
    parser.add_argument("--skip-psstore", action="store_true", help="Only import catalog rows and aliases")
    args = parser.parse_args()

    local_db_url = args.local_db_url or os.environ.get("LOCAL_DATABASE_URL") or os.environ.get("DATABASE_URL")
    production_db_url = args.production_db_url or os.environ.get("PRODUCTION_DATABASE_URL")
    client_id = os.environ.get("IGDB_CLIENT_ID")
    client_secret = os.environ.get("IGDB_CLIENT_SECRET")
    if not local_db_url or not production_db_url:
        sys.exit(
            "Both local and production database URLs are required: pass "
            "--local-db-url/--production-db-url or set LOCAL_DATABASE_URL/PRODUCTION_DATABASE_URL"
        )
    if not client_id or not client_secret:
        sys.exit("IGDB_CLIENT_ID and IGDB_CLIENT_SECRET are required")

    try:
        slugs = [parse_igdb_slug(url) for url in args.igdb_urls]
        if len(set(slugs)) != len(slugs):
            raise ValueError("duplicate IGDB game URL supplied")

        token = get_access_token(client_id, client_secret)
        session = requests.Session()
        session.headers.update({
            "Client-ID": client_id,
            "Authorization": f"Bearer {token}",
            "Content-Type": "text/plain",
        })
        results = []
        for slug in slugs:
            result = _igdb_by_slug(session, slug)
            if not result:
                raise ValueError(f"IGDB game not found for slug {slug!r}")
            platforms = {platform.get("id") for platform in result.get("platforms", [])}
            if _PS5_PLATFORM_ID not in platforms:
                raise ValueError(f"IGDB game {slug!r} is not marked for PS5")
            results.append(result)

        seller_urls = parse_seller_url_specs(args.seller_url)
        if not args.skip_sellers and not seller_urls and not args.seller_url:
            seller_urls = prompt_for_seller_urls()

        database_targets = [
            (local_db_url, import_games(local_db_url, results, args.platform)),
            (production_db_url, import_games(production_db_url, results, args.platform)),
        ]
        if not args.skip_sellers:
            if seller_urls:
                scan_and_load_sellers(
                    database_targets, results, args.platform, seller_urls, args.seller_workers
                )
            else:
                print("No seller URLs supplied; seller price scan skipped.", file=sys.stderr)
        for database_url, game_ids in database_targets:
            if not args.skip_psstore:
                refresh_psstore(database_url, game_ids, args.workers)
        sync_assets(results, session, database_targets)
    except (ValueError, OSError, requests.RequestException, psycopg.Error) as exc:
        sys.exit(f"ERROR: {exc}")


if __name__ == "__main__":
    main()
