# Contributing to GameXS

GameXS is a PS5 game price-comparison service for Iranian retailers.
The monorepo has three independent pieces — **scraper** (Python), **db** (Postgres 16), and **frontend** (Next.js 16).
They are not yet wired together end-to-end; the frontend reads from Postgres, the scraper writes to Postgres, but the ingestion pipeline is still manual.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker Desktop | any recent | runs Postgres 16 locally |
| Node.js | 20+ | frontend dev server |
| Python | 3.11+ | scraper |
| `psql` client | **16** | dump/restore DB — version must match server (see note below) |
| `kubectl` | any | prod DB access (optional) |

> **psql version mismatch** — the DB container runs Postgres 16. If your local `psql`/`pg_dump` is an older version (e.g. Homebrew installs 14 by default on older Macs) you will get a "server version mismatch" error. Fix:
> ```bash
> brew install postgresql@16
> export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"  # add to your shell rc
> ```

---

## 1 — Clone & first-time setup

```bash
git clone <repo-url>
cd gamexs
cp .env.example .env          # edit POSTGRES_PORT if 5432 is already taken on your machine
```

Check whether port 5432 is in use before starting:

```bash
lsof -iTCP:5432 -sTCP:LISTEN
```

If it is, set `POSTGRES_PORT=5434` (or any free port) in `.env`.

---

## 2 — Database

```bash
docker compose up -d          # starts postgres:16, applies db/init/*.sql on first boot
```

Verify it is running:

```bash
docker exec -it gamexs-postgres psql -U gamexs -d gamexs -c "\dt"
```

**Schema changes** only apply on first container init with an empty data volume.
To pick up a schema change against an existing volume:

```bash
docker compose down -v && docker compose up -d   # data loss is fine pre-launch
```

---

## 3 — Sync the database from a teammate

The database contains scraped game data that is not committed to git.
A teammate who has already populated their DB can share a snapshot.

### Pull the latest snapshot (you)

```bash
# Make sure postgresql@16 bin is on PATH first (see Prerequisites)
pg_dump -U gamexs -h localhost -p 5434 -Fc gamexs > gamexs_$(date +%Y%m%d).dump
```

Share the `.dump` file (upload to S3, send via Drive, etc.).

### Restore the snapshot (contributor)

```bash
# 1. Wipe and recreate the volume so schema is clean
docker compose down -v && docker compose up -d

# 2. Wait a few seconds for postgres to finish init, then restore
sleep 5
pg_restore -U gamexs -h localhost -p 5434 -d gamexs --no-owner gamexs_20260721.dump
```

### Via S3 bucket (if access has been granted)

```bash
# Pull
aws s3 cp s3://gamexs/db-snapshots/latest.dump /tmp/gamexs_latest.dump \
  --endpoint-url http://gs3.gamexs.ir

# Restore (same as above)
docker compose down -v && docker compose up -d && sleep 5
pg_restore -U gamexs -h localhost -p 5434 -d gamexs \
  --no-owner /tmp/gamexs_latest.dump
```

---

## 4 — Frontend

```bash
cd frontend
npm install

# Create local env file
cat > .env.local <<'EOF'
DATABASE_URL=postgresql://gamexs:gamexs@localhost:5434/gamexs
S3_ENDPOINT_URL=http://gs3.gamexs.ir
S3_BUCKET=gamexs
EOF

npm run dev        # http://localhost:3000
npm run build      # production build + type-check
npm run lint       # eslint
```

### Key conventions

- **RTL Persian only** — `<html dir="rtl" lang="fa">` is set in `app/layout.tsx`. All UI text is Persian.
- **Numbers** — always pass through `toPersianDigits()` from `lib/format.ts`. Never use `toLocaleString` or raw JS numbers in the UI.
- **Prices** — use `formatToman()` from `lib/format.ts`.
- **UI library** — HeroUI v3. Valid Chip/Button variants: `"soft"`, `"solid"`, `"bordered"`, `"ghost"`. There is no `"flat"` variant.
- **Colors** — extend via CSS variables in `app/globals.css` under `@theme inline`. Do not add a `tailwind.config`.
- **Server/Client boundary** — `lib/covers.ts` and `lib/game-details.ts` use `node:fs` and must only be imported from Server Components. Never import them from `"use client"` files.
- **Cover images** — served from S3 (`gs3.gamexs.ir/gamexs/covers/`). Do not copy images into `public/`.

---

## 5 — Migrate cover images to S3 (one-time, after restoring DB)

The database stores IGDB CDN URLs for ~1,500 game cover images.
Because `images.igdb.com` is blocked in Iran, all covers must be migrated to the project's own S3 bucket (`gs3.gamexs.ir`) before images will load.

**What `scraper/migrate_covers_to_s3.py` does:**

1. Reads every row in `games` where `cover_url` still points to `images.igdb.com`.
2. Downloads each image directly from the stored IGDB URL (no IGDB API key needed).
3. Uploads the image to S3 under `covers/<slug>-main-cover.webp`.
4. Updates `cover_url` in the DB to the new S3 URL.

It is **resumable** — it lists existing S3 keys first and skips anything already uploaded.
It runs **6 workers in parallel** so all ~1,500 images finish in a few minutes.

```bash
cd scraper
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # first-time only

# Local DB + S3 (IGDB is usually accessible on non-Iranian networks without a proxy)
DATABASE_URL=postgresql://gamexs:gamexs@localhost:5434/gamexs \
  S3_ENDPOINT_URL=http://gs3.gamexs.ir \
  S3_ACCESS_KEY=<key> \
  S3_SECRET_KEY=<secret> \
  S3_BUCKET=gamexs \
  .venv/bin/python migrate_covers_to_s3.py

# If IGDB CDN is blocked on your network, route through the project proxy
HTTPS_PROXY=http://127.0.0.1:10809 \
  DATABASE_URL=postgresql://gamexs:gamexs@localhost:5434/gamexs \
  ... (same env vars) \
  .venv/bin/python migrate_covers_to_s3.py

# Against prod DB (requires kubectl port-forward 5436 to be active)
.venv/bin/python migrate_covers_to_s3.py \
  --db-url postgresql://gamexs:gamexs@localhost:5436/gamexs
```

> You only need to run this once after first restoring the DB dump. Once all covers are on S3, the script finds nothing to do and exits immediately.

---

## 6 — Scraper

```bash
cd scraper
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Run a quick test (prints JSON, no file output)
.venv/bin/python -m gamexs_scraper.cli pspro --limit 5

# Full export with cache
.venv/bin/python -m gamexs_scraper.export_csv pspro \
  -o output/pspro.csv \
  --cache output/pspro_offers.jsonl

# Enrich game metadata from IGDB (requires OPENROUTER_API_KEY in env)
DATABASE_URL=postgresql://gamexs:gamexs@localhost:5434/gamexs \
  .venv/bin/python -m gamexs_scraper.enrich_metadata
```

`scraper/output/` is gitignored — CSVs, JSONL caches, and cover images are always regenerable.

Currently active adapters (one per seller):
`pspro`, `cdkeyshare`, `digikala`, `gamario`, `gamecenter`, `gameonestore`,
`gameplayshop`, `nakhlmarket`, `parsconsole`, `persianconsole`, `technolife`,
`xgamesstore`, `yungcenter`, `yungcenter`

---

## 6 — Production DB access (optional)

Production runs on Kubernetes. To access the prod DB locally:

```bash
# Authenticate first (session expires after ~1 hour)
kubectl get pods -n mahdixak-gamexs

# Port-forward the DB pod
kubectl port-forward pod/<gamexs-db-pod-name> 5436:5432 -n mahdixak-gamexs

# Connect
psql postgresql://gamexs:gamexs@localhost:5436/gamexs
```

Find the current pod name with:
```bash
kubectl get pods -n mahdixak-gamexs | grep gamexs-db
```

> Do not run destructive queries (DROP, DELETE without WHERE, TRUNCATE) against prod.

---

## 7 — Commit conventions

- One feature or fix per commit.
- Commit title: `type: short description` — e.g. `feat: add countdown to game page`, `fix: normalize Persian noise words`.
- Never commit `.env`, `.env.local`, `scraper/output/`, or any secrets.
- Do not push directly to `main` without review.

---

## 8 — Project structure

```
gamexs/
├── db/
│   └── init/          # SQL schema + seed data (01_schema.sql, 02_seed.sql)
├── docs/              # PROJECT_CONTEXT.md — full domain model and seller list
├── frontend/
│   └── src/
│       ├── app/       # Next.js App Router pages
│       ├── components/
│       └── lib/       # DB client, formatting, types, game-details
├── k8s/               # Kubernetes manifests
├── scraper/
│   └── gamexs_scraper/
│       ├── adapters/  # one file per seller
│       ├── models.py  # ProductType / AccessTier enums
│       ├── normalize.py
│       └── enrich_metadata.py
├── TODO.md            # current build status and known gaps
└── CLAUDE.md          # AI assistant instructions (read before using Claude Code)
```

Full domain model, seller list, and product taxonomy: **`docs/PROJECT_CONTEXT.md`**.
Current outstanding work: **`TODO.md`**.
