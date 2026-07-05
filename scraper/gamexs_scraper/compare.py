"""Diff our scraped CSV against an externally-sourced reference CSV.

Both files are expected in the `game,account capacity 1,account capacity 2,
account capacity 3,game on customer account,game disk` shape. Game names are
re-normalized on both sides so formatting differences (e.g. a trailing
"- PS5") don't cause spurious mismatches.
"""

import argparse
import csv

from .export_csv import COLUMNS
from .normalize import normalize_game_name

PRICE_COLUMNS = COLUMNS[1:]


def load(path: str) -> dict[str, dict]:
    rows: dict[str, dict] = {}
    with open(path, encoding="utf-8-sig") as f:
        for record in csv.DictReader(f):
            key = normalize_game_name(record["game"])
            if not key:
                continue
            rows[key] = {col: int(record[col]) for col in PRICE_COLUMNS}
    return rows


def diff(ours: dict[str, dict], theirs: dict[str, dict]) -> None:
    common = sorted(set(ours) & set(theirs))
    only_ours = sorted(set(ours) - set(theirs))
    only_theirs = sorted(set(theirs) - set(ours))

    mismatches = []
    for key in common:
        for col in PRICE_COLUMNS:
            a, b = ours[key][col], theirs[key][col]
            if a != b:
                mismatches.append((key, col, a, b))

    print(f"games in both files: {len(common)}")
    print(f"games only in ours:   {len(only_ours)}")
    print(f"games only in theirs: {len(only_theirs)}")
    print(f"field mismatches:     {len(mismatches)} across {len({m[0] for m in mismatches})} games")
    print()

    if mismatches:
        print("=== MISMATCHES (game, column, ours, theirs) ===")
        for key, col, a, b in mismatches:
            print(f"{key!r:45} {col:28} ours={a:>10} theirs={b:>10}")
        print()

    if only_ours:
        print(f"=== ONLY IN OURS (showing first 20 of {len(only_ours)}) ===")
        for key in only_ours[:20]:
            print(f" - {key}")
        print()

    if only_theirs:
        print("=== ONLY IN THEIRS ===")
        for key in only_theirs:
            print(f" - {key}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare our scraped CSV against a reference CSV")
    parser.add_argument("ours")
    parser.add_argument("theirs")
    args = parser.parse_args()
    diff(load(args.ours), load(args.theirs))


if __name__ == "__main__":
    main()
