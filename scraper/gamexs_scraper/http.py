import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
}


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(DEFAULT_HEADERS)
    retry = Retry(total=3, backoff_factor=1.5, status_forcelist=[429, 500, 502, 503, 504])
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.mount("http://", HTTPAdapter(max_retries=retry))
    return session


class PoliteFetcher:
    """Wraps a session with a minimum delay between requests to the same seller."""

    def __init__(self, session: requests.Session, delay_seconds: float = 1.0, timeout: float = 20.0):
        self.session = session
        self.delay_seconds = delay_seconds
        self.timeout = timeout
        self._last_request_at: float | None = None

    def _polite_wait(self) -> None:
        if self._last_request_at is not None:
            elapsed = time.monotonic() - self._last_request_at
            remaining = self.delay_seconds - elapsed
            if remaining > 0:
                time.sleep(remaining)

    def get(self, url: str, **kwargs) -> requests.Response:
        self._polite_wait()
        # stream=True + read with deadline guards against drip-feed anti-scraping
        # (servers that send 1 byte/sec to keep the per-chunk read timeout alive).
        deadline = time.monotonic() + self.timeout * 3
        resp = self.session.get(url, timeout=self.timeout, stream=True, **kwargs)
        chunks = []
        for chunk in resp.iter_content(chunk_size=65536):
            if time.monotonic() > deadline:
                resp.close()
                raise requests.exceptions.Timeout(f"total response time exceeded for {url}")
            chunks.append(chunk)
        resp._content = b"".join(chunks)
        resp._content_consumed = True
        self._last_request_at = time.monotonic()
        return resp

    def post(self, url: str, **kwargs) -> requests.Response:
        self._polite_wait()
        response = self.session.post(url, timeout=self.timeout, **kwargs)
        self._last_request_at = time.monotonic()
        return response
