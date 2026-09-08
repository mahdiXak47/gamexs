"""Read-only checks for the canonical GameXS catalog.

The audit intentionally never mutates the database.  It is useful before a
production merge, after an enrichment run, and as a smoke check for a newly
restored database.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Iterable, Sequence

import psycopg
from dotenv import load_dotenv

from gamexs_scraper.normalize import normalize_game_name


_SPECIAL_EDITION_RE = re.compile(
    r"\b(?:collector|legacy|deluxe|ultimate|premium|gold|platinum|standard|"
    r"complete|definitive|legendary|enhanced|anniversary|launch|digital|"
    r"remastered|remake|bundle|director(?:'s)?|special|goty|day[ -]?one|"
    r"cross[ -]?gen)\b",
    re.IGNORECASE,
)

GameRow = tuple[int, int | None, str, str]
Candidate = tuple[str, tuple[GameRow, ...]]


@dataclass(frozen=True)
class CatalogAudit:
    total_games: int
    null_igdb_ids: int
    non_ascii_titles: int
    duplicate_igdb_groups: int
    special_without_igdb: int
    cross_igdb_title_collisions: int
    special_edition_candidates: tuple[GameRow, ...] = ()
    collision_candidates: tuple[Candidate, ...] = ()

    @property
    def is_clean(self) -> bool:
        return not any(
            (
                self.null_igdb_ids,
                self.non_ascii_titles,
                self.duplicate_igdb_groups,
                self.special_without_igdb,
            )
        )


def audit_games(games: Iterable[GameRow], max_candidates: int = 20) -> CatalogAudit:
    """Summarize catalog invariants and possible cross-seller collisions."""
    rows = tuple(games)
    igdb_counts = Counter(igdb_id for _, igdb_id, _, _ in rows if igdb_id is not None)
    title_groups: defaultdict[str, list[GameRow]] = defaultdict(list)

    for row in rows:
        game_id, igdb_id, title, _ = row
        if igdb_id is None:
            continue
        normalized_title = normalize_game_name(title)
        if normalized_title:
            title_groups[normalized_title].append(row)

    collisions: list[Candidate] = []
    for normalized_title, grouped_rows in sorted(title_groups.items()):
        igdb_ids = {igdb_id for _, igdb_id, _, _ in grouped_rows}
        if len(igdb_ids) > 1:
            collisions.append((normalized_title, tuple(grouped_rows)))

    special_edition_candidates = tuple(
        row
        for row in rows
        if row[1] is None and _SPECIAL_EDITION_RE.search(row[2]) is not None
    )

    return CatalogAudit(
        total_games=len(rows),
        null_igdb_ids=sum(igdb_id is None for _, igdb_id, _, _ in rows),
        non_ascii_titles=sum(
            any(ord(character) > 127 for character in title) for _, _, title, _ in rows
        ),
        duplicate_igdb_groups=sum(count > 1 for count in igdb_counts.values()),
        special_without_igdb=len(special_edition_candidates),
        cross_igdb_title_collisions=len(collisions),
        special_edition_candidates=special_edition_candidates[:max_candidates],
        collision_candidates=tuple(collisions[:max_candidates]),
    )


def _load_games(cur: psycopg.Cursor) -> Sequence[GameRow]:
    cur.execute(
        """
        SELECT id, igdb_id, title, slug
        FROM ps5_games
        ORDER BY id
        """
    )
    return cur.fetchall()


def format_report(report: CatalogAudit) -> str:
    lines = [
        "GameXS catalog audit (read-only)",
        f"games: {report.total_games}",
        f"null_igdb_ids: {report.null_igdb_ids}",
        f"non_ascii_titles: {report.non_ascii_titles}",
        f"duplicate_igdb_groups: {report.duplicate_igdb_groups}",
        f"special_without_igdb: {report.special_without_igdb}",
        f"cross_igdb_title_collisions: {report.cross_igdb_title_collisions}",
        f"status: {'clean' if report.is_clean else 'violations found'}",
    ]
    if report.special_edition_candidates:
        lines.append("special-edition rows requiring review:")
        for game_id, igdb_id, title, slug in report.special_edition_candidates:
            lines.append(
                f"  game#{game_id} igdb={igdb_id} title={title!r} slug={slug!r}"
            )
    if report.collision_candidates:
        lines.append("review candidates:")
        for normalized_title, rows in report.collision_candidates:
            details = ", ".join(
                f"game#{game_id} igdb={igdb_id} title={title!r} slug={slug!r}"
                for game_id, igdb_id, title, slug in rows
            )
            lines.append(f"  {normalized_title!r}: {details}")
    return "\n".join(lines)


def main(argv: Sequence[str] | None = None) -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument(
        "--max-candidates",
        type=int,
        default=20,
        help="maximum possible title-collision groups to print (default: 20)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="exit 1 when a catalog invariant is violated",
    )
    args = parser.parse_args(argv)
    if not args.db_url:
        parser.error("provide --db-url or set DATABASE_URL")
    if args.max_candidates < 0:
        parser.error("--max-candidates must be non-negative")

    with psycopg.connect(args.db_url) as conn, conn.cursor() as cur:
        report = audit_games(_load_games(cur), max_candidates=args.max_candidates)

    print(format_report(report))
    return 1 if args.strict and not report.is_clean else 0


if __name__ == "__main__":
    sys.exit(main())
