#!/bin/sh
set -e

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Starting gunicorn..."
exec gunicorn gamexs.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-3}" \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
