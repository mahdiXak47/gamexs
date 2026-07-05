import argparse
import dataclasses
import json
import sys

from .adapters import ADAPTERS


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a seller adapter and print scraped offers as JSON")
    parser.add_argument("seller", choices=sorted(ADAPTERS))
    parser.add_argument("--limit", type=int, default=None, help="Stop after N offers (for quick testing)")
    args = parser.parse_args()

    adapter = ADAPTERS[args.seller]()
    count = 0
    for offer in adapter.iter_listings():
        print(json.dumps(dataclasses.asdict(offer), ensure_ascii=False, default=str))
        count += 1
        if args.limit and count >= args.limit:
            break

    print(f"-- {count} offers --", file=sys.stderr)


if __name__ == "__main__":
    main()
