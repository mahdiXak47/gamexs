# Scraper can run either as a one-off job container or as a long-running
# Temporal worker application.
#
# Temporal worker:
#
#   docker run --rm <image> python -m gamexs_scraper.temporal.worker
#
# One-off commands:
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
#       python -m gamexs_scraper.enrich_metadata

FROM --platform=linux/amd64 hub.hamdocker.ir/python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY gamexs_scraper/ gamexs_scraper/
COPY scrape_all.sh .
COPY fetch_psstore_prices.py .
COPY upload_to_s3.py .

# Output directory for CSVs, JSONL caches, and cover images.
# Mount a volume here in production so data persists across runs.
RUN mkdir -p /output
VOLUME ["/output"]

CMD ["python", "-m", "gamexs_scraper.temporal.worker"]
