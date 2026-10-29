import time
import unittest

from gamexs_scraper.http import PoliteFetcher


class _SlowSession:
    """Each response takes 0.15 s; records when each request started."""

    def __init__(self):
        self.starts = []

    def get(self, url, **kwargs):
        self.starts.append(time.monotonic())
        time.sleep(0.15)

        class Response:
            def iter_content(self, chunk_size):
                yield b"ok"
        return Response()


class PoliteFetcherTests(unittest.TestCase):
    def test_gap_runs_from_request_start_not_response_end(self):
        session = _SlowSession()
        fetcher = PoliteFetcher(session, delay_seconds=0.3)
        fetcher.get("https://a")
        fetcher.get("https://a")
        gap = session.starts[1] - session.starts[0]
        self.assertGreaterEqual(gap, 0.3)
        self.assertLess(gap, 0.4)  # was 0.45: delay added after the 0.15 s response


class ConcurrentCrawlTests(unittest.TestCase):
    def test_slow_pages_overlap_but_requests_still_start_a_delay_apart(self):
        from gamexs_scraper.base import SellerAdapter

        class Slow(_SlowSession):
            def get(self, url, **kwargs):
                response = super().get(url)
                time.sleep(0.45)  # 0.6 s per page in total
                return response

        class Shop(SellerAdapter):
            seller = "shop"
            product_workers = 3

            def iter_listings(self):
                return self.crawl(["a", "b", "c", "d"], lambda url: [self.fetcher.get(url) and url])

        session = Slow()
        shop = Shop(fetcher=PoliteFetcher(session, delay_seconds=0.2))
        started = time.monotonic()
        self.assertEqual(list(shop.iter_listings()), ["a", "b", "c", "d"])
        gaps = [b - a for a, b in zip(session.starts, session.starts[1:])]
        self.assertTrue(all(gap >= 0.19 for gap in gaps), gaps)
        self.assertLess(time.monotonic() - started, 1.5)  # 2.4 s one page at a time


if __name__ == "__main__":
    unittest.main()
