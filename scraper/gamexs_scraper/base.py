from abc import ABC, abstractmethod
from collections.abc import Iterator

from .http import PoliteFetcher, make_session
from .models import RawOffer


class SellerAdapter(ABC):
    """One implementation per seller site. Adapters are read-only scrapers:
    they yield RawOffer records and never mutate seller-side state."""

    seller: str

    def __init__(self, fetcher: PoliteFetcher | None = None):
        self.fetcher = fetcher or PoliteFetcher(make_session())

    @abstractmethod
    def iter_listings(self) -> Iterator[RawOffer]:
        """Crawl the seller's catalog and yield every offer found."""
        raise NotImplementedError
