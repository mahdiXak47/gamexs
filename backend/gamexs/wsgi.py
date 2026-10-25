"""
WSGI config for gamexs project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gamexs.settings.production')

_django = get_wsgi_application()


def application(environ, start_response):
    # Readiness probe: answered before Django, so it needs neither the DB nor a
    # Host in ALLOWED_HOSTS (the probe calls the pod's own address).
    if environ.get("PATH_INFO") == "/healthz":
        start_response("200 OK", [("Content-Type", "text/plain"), ("Content-Length", "2")])
        return [b"ok"]
    return _django(environ, start_response)
