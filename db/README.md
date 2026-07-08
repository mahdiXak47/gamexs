# Connecting to the Postgres container

Assumes the container is running (`docker compose up -d` from the repo root;
`docker ps` to confirm `gamexs-postgres` is up).

## Exec into the container

```bash
# straight to a psql prompt (most common)
docker exec -it gamexs-postgres psql -U gamexs -d gamexs

# or a shell first, then psql from inside
docker exec -it gamexs-postgres bash
psql -U gamexs -d gamexs
```

## Listing / searching tables and entities

Once inside `psql`:

| Command | What it does |
|---|---|
| `\dt` | list tables in the current schema |
| `\dt+` | same, with sizes |
| `\d <table>` | describe a table: columns, types, indexes, constraints |
| `\d+ <table>` | same, with storage/stats info |
| `\dT` | list custom types (the `product_type`, `access_tier` enums) |
| `\dT+` | same, with each enum's values |
| `\di` | list indexes |
| `\dn` | list schemas |
| `\l` | list databases |
| `\x` | toggle expanded output (readable for wide rows) |
| `\q` | quit |

Most `\d`-family commands accept a pattern to search instead of listing
everything:

```
\dt *history*      -- tables matching "history"
\d *price*          -- describe anything matching "price"
```

## Searching by column name across all tables

When you don't remember which table something lives on, query
`information_schema` directly instead of guessing:

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE column_name ILIKE '%price%'
ORDER BY table_name;
```

```sql
-- every table in the schema, with its column count
SELECT table_name, count(*) AS columns
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
```

## One-off commands without an interactive session

Useful from scripts, or when you just want one result without opening a prompt:

```bash
docker exec -i gamexs-postgres psql -U gamexs -d gamexs -c "\dt"
docker exec -i gamexs-postgres psql -U gamexs -d gamexs -c "SELECT * FROM sellers;"
```

## This schema's entities, for reference

- `platforms`, `sellers`, `games` — catalog tables.
- `listings` — one row per (game, seller, product_type, tier) ever seen; the
  stable identity of a trackable offer.
- `price_history` — append-only, one row per scrape per listing.

Full DDL: `db/init/01_schema.sql`. Seed data: `db/init/02_seed.sql`.
