# Scraper job image. Runs the full daily scrape-and-load pipeline
# (scrape all sellers -> load to Postgres -> IGDB enrichment -> PS Store
# prices -> S3 cover upload -> stale-listing cleanup) via scrape_all.sh.
#
# Full daily run:
#
#   docker run --rm <image> bash scrape_all.sh
#
# One-off commands (overrides the default CMD):
#
#   docker compose -f docker-compose.staging.yml run --rm scraper \
#       python -m gamexs_scraper.export_csv pspro \
#           -o /output/pspro.csv --cache /output/pspro_offers.jsonl
#
#   docker compose -f docker-compose.staging.yml run --rm scraper \
#       python -m gamexs_scraper.load_to_postgres pspro \
#           --cache /output/pspro_offers.jsonl
#
#   docker compose -f docker-compose.staging.yml run --rm scraper \
#       python -m gamexs_scraper.maintenance

FROM --platform=linux/amd64 hub.hamdocker.ir/python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY gamexs_scraper/ gamexs_scraper/
COPY crawl_uperagame.py load_uperagame_to_postgres.py .
COPY scrape_all.sh .
COPY fetch_psstore_prices.py .
COPY upload_to_s3.py .
COPY add_game.py download_artworks.py resolve_missing_psstore_concepts.py psstore_search.py .

# Output directory for CSVs, JSONL caches, and cover images.
# Mount a volume here in production so data persists across runs.
RUN mkdir -p /output
VOLUME ["/output"]

CMD ["bash", "scrape_all.sh"]
