# GameXS Scraper

Python scraper that collects PS5 game prices from Iranian retailer websites.

## Setup (first time)

```bash
cd scraper
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Copy `.env.example` at the repo root and fill in `DATABASE_URL` before running any load command.

### Proxy

Some `.ir` and `.com` domains require the proxy for DNS resolution:

```bash
export HTTPS_PROXY=http://ai:G9ZHH6QpC9nzcA@conn.hamravesh.ir:8080
```

Set this in your shell before running any scraper command.

---

## Available sellers

| Seller key | Website | Product types | Notes |
|---|---|---|---|
| `pspro` | pspro.ir | Account + Disc | |
| `yungcenter` | yungcenter.com | Account | |
| `nakhlmarket` | nakhlmarket.com | Account + Disc | |
| `technolife` | technolife.com | Disc | |
| `persianconsole` | persianconsole.ir | Account + Disc | Requires proxy |
| `gameplayshop` | gameplayshop.ir | Account + Disc | Requires proxy |
| `gamecenter` | game-center.ir | Account | Requires proxy |
| `gamario` | gamario.com | Account | Requires proxy |
| `gameonestore` | gameonestore.com | Disc | Requires proxy |
| `xgamesstore` | xgamesstore.org | Account | Requires proxy |
| `parsconsole` | parsconsole.com | Account | Requires proxy |
| `cdkeyshare` | cdkeyshare.ir | Account + Disc | Requires proxy |

---

## Commands

### 1. Quick test — print a few offers to stdout

Scrapes live and prints raw JSON. No files written. Good for verifying an adapter works.

```bash
.venv/bin/python -m gamexs_scraper.cli pspro --limit 5
.venv/bin/python -m gamexs_scraper.cli gamario --limit 3
.venv/bin/python -m gamexs_scraper.cli cdkeyshare --limit 5
```

### 2. Full scrape — write CSV + JSONL cache

Scrapes the entire seller catalogue and writes a CSV and a JSONL cache. If the cache file already exists the network scrape is skipped and data is rebuilt from cache — safe to re-run after fixing parsing logic without re-hitting the site.

```bash
SELLER=gamario   # replace with any seller key

.venv/bin/python -m gamexs_scraper.export_csv $SELLER \
    -o output/${SELLER}.csv \
    --cache output/${SELLER}_offers.jsonl
```

#### Scrape all sellers in parallel

Each process hits only its own domain, so running them simultaneously is safe:

```bash
for SELLER in pspro yungcenter nakhlmarket technolife persianconsole \
              gameplayshop gamecenter gamario gameonestore xgamesstore \
              parsconsole cdkeyshare; do
  .venv/bin/python -m gamexs_scraper.export_csv $SELLER \
      -o output/${SELLER}.csv \
      --cache output/${SELLER}_offers.jsonl \
      > /tmp/${SELLER}_scrape.log 2>&1 &
done
wait
echo "All scrapers finished"
```

### 3. Load into the database

Reads the JSONL cache and upserts games, listings, and price history into Postgres. Safe to re-run — games and listings are upserted; price history rows are deduplicated by `(listing_id, scraped_at)`.

Requires `DATABASE_URL` in the environment (loaded automatically from the repo root's `.env`).

```bash
SELLER=gamario   # replace with any seller key

.venv/bin/python -m gamexs_scraper.load_to_postgres $SELLER \
    --cache output/${SELLER}_offers.jsonl
```

#### Load all sellers sequentially

```bash
for SELLER in pspro yungcenter nakhlmarket technolife persianconsole \
              gameplayshop gamecenter gamario gameonestore xgamesstore \
              parsconsole cdkeyshare; do
  echo "=== Loading $SELLER ==="
  .venv/bin/python -m gamexs_scraper.load_to_postgres $SELLER \
      --cache output/${SELLER}_offers.jsonl
done
```

### 4. Download cover images

Downloads product cover images into `output/images/<seller>/`. Reads from the JSONL cache — no network calls to the seller site.

```bash
SELLER=gamario

.venv/bin/python -m gamexs_scraper.download_images $SELLER \
    --cache output/${SELLER}_offers.jsonl
```

---

## Full pipeline for one seller (end-to-end)

```bash
SELLER=gamario

# 1. Verify the adapter works
.venv/bin/python -m gamexs_scraper.cli $SELLER --limit 5

# 2. Full scrape → CSV + JSONL cache
.venv/bin/python -m gamexs_scraper.export_csv $SELLER \
    -o output/${SELLER}.csv \
    --cache output/${SELLER}_offers.jsonl

# 3. Review the CSV
open output/${SELLER}.csv   # macOS; or: column -t -s, output/${SELLER}.csv | less

# 4. Load into Postgres
.venv/bin/python -m gamexs_scraper.load_to_postgres $SELLER \
    --cache output/${SELLER}_offers.jsonl

# 5. Download cover images
.venv/bin/python -m gamexs_scraper.download_images $SELLER \
    --cache output/${SELLER}_offers.jsonl
```

---

## Output files

All output is written to `output/` (gitignored — always regenerable from cache or a fresh scrape).

| File | Description |
|---|---|
| `output/<seller>.csv` | Human-readable price table |
| `output/<seller>_offers.jsonl` | Raw offer cache, one JSON object per line |
| `output/images/<seller>/` | Downloaded cover images |

---

## Adding a new seller

1. Create `gamexs_scraper/adapters/<seller>.py` implementing `SellerAdapter.iter_listings()`
2. Register it in `gamexs_scraper/adapters/__init__.py`
3. Add a row to `db/init/02_seed.sql`
4. Run the full pipeline above

See `adapters/gamario.py` (WooCommerce `data-product_variations`, account tiers) or `adapters/gameonestore.py` (simple product, DOM price) for reference implementations.
