"""Discover PlayStation Store products and conservatively match game editions."""

from __future__ import annotations

import re
import time
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher

import requests


GRAPHQL_URL = "https://web.np.playstation.com/api/graphql/v1/"
SEARCH_QUERY = """
query getSearchResults(
  $countryCode: String,
  $languageCode: String,
  $pageOffset: Float,
  $pageSize: Float,
  $searchTerm: String!
) {
  universalSearch(
    countryCode: $countryCode,
    languageCode: $languageCode,
    pageOffset: $pageOffset,
    pageSize: $pageSize,
    searchTerm: $searchTerm
  ) {
    results {
      __typename
      ... on Concept {
        id
        name
        products {
          id
          name
          localizedStoreDisplayClassification
          storeDisplayClassification
          platforms
        }
      }
      ... on Product {
        id
        name
        localizedStoreDisplayClassification
        storeDisplayClassification
        platforms
      }
    }
  }
}
"""

EDITION_MARKERS = {
    "deluxe", "ultimate", "gold", "complete", "collector",
    "collectors", "royal", "special", "premium", "anthology", "bundle",
    "collection", "remake", "remastered", "directors", "definitive",
    "game of the year", "goty", "year 1", "year 2", "phantom",
}
PLATFORM_NOISE = {"ps4", "ps5", "playstation", "edition", "version", "digital", "standard"}
NON_GAME_CLASSIFICATIONS = {"ADD_ON", "AVATAR", "CURRENCY", "DEMO", "THEME"}


@dataclass(frozen=True)
class SearchProduct:
    product_id: str
    name: str
    concept_id: str = ""
    classification: str = ""
    platforms: tuple[str, ...] = ()


@dataclass(frozen=True)
class MatchResult:
    product: SearchProduct | None
    score: float
    reason: str


class SearchUnavailable(RuntimeError):
    pass


def normalize_title(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return " ".join(value.split())


def edition_markers(value: str) -> frozenset[str]:
    normalized = normalize_title(value)
    found = {marker for marker in EDITION_MARKERS if marker in normalized}
    if "collector" in found or "collectors" in found:
        found.discard("collector")
        found.discard("collectors")
        found.add("collector")
    return frozenset(found)


def core_title(value: str) -> str:
    normalized = normalize_title(value)
    for marker in sorted(EDITION_MARKERS | PLATFORM_NOISE, key=len, reverse=True):
        normalized = re.sub(rf"\b{re.escape(marker)}\b", " ", normalized)
    return " ".join(normalized.split())


def search_products(
    session: requests.Session,
    title: str,
    *,
    timeout: int = 20,
    page_size: int = 24,
    retries: int = 3,
) -> list[SearchProduct]:
    payload = {
        "operationName": "getSearchResults",
        "variables": {
            "countryCode": "US",
            "languageCode": "en",
            "pageOffset": 0,
            "pageSize": page_size,
            "searchTerm": title,
        },
        "query": SEARCH_QUERY,
    }
    headers = {
        "Content-Type": "application/json",
        "Origin": "https://store.playstation.com",
        "Referer": "https://store.playstation.com/en-us/",
        "X-Apollo-Operation-Name": "getSearchResults",
    }

    response: requests.Response | None = None
    for attempt in range(retries):
        try:
            response = session.post(GRAPHQL_URL, json=payload, headers=headers, timeout=timeout)
            if response.status_code == 200:
                break
            if response.status_code not in {403, 429, 500, 502, 503, 504}:
                response.raise_for_status()
        except requests.RequestException as exc:
            if attempt == retries - 1:
                raise SearchUnavailable(str(exc)) from exc
        if attempt < retries - 1:
            time.sleep(2 ** attempt)

    if response is None or response.status_code != 200:
        status = response.status_code if response is not None else "no response"
        raise SearchUnavailable(f"PS Store search returned {status}")

    try:
        body = response.json()
        if body.get("errors"):
            raise SearchUnavailable(f"PS Store GraphQL error: {body['errors'][0].get('message', 'unknown')}")
        results = body["data"]["universalSearch"]["results"]
    except (KeyError, TypeError, ValueError) as exc:
        raise SearchUnavailable("PS Store search response shape changed") from exc

    products: dict[str, SearchProduct] = {}
    for item in results:
        if item.get("__typename") == "Product" and item.get("id"):
            classification = item.get("storeDisplayClassification") or ""
            if classification.upper() in NON_GAME_CLASSIFICATIONS:
                continue
            products[item["id"]] = SearchProduct(
                product_id=item["id"],
                name=item.get("name") or "",
                classification=classification,
                platforms=tuple(item.get("platforms") or ()),
            )
        elif item.get("__typename") == "Concept":
            for product in item.get("products") or ():
                product_id = product.get("id")
                if product_id and product_id not in products:
                    classification = product.get("storeDisplayClassification") or ""
                    if classification.upper() in NON_GAME_CLASSIFICATIONS:
                        continue
                    products[product_id] = SearchProduct(
                        product_id=product_id,
                        name=product.get("name") or item.get("name") or "",
                        concept_id=str(item.get("id") or ""),
                        classification=classification,
                        platforms=tuple(product.get("platforms") or ()),
                    )
    return list(products.values())


def choose_product(title: str, products: list[SearchProduct]) -> MatchResult:
    target_core = core_title(title)
    target_markers = edition_markers(title)
    ranked: list[tuple[float, SearchProduct]] = []

    for product in products:
        if product.platforms and not any(p.upper() in {"PS4", "PS5"} for p in product.platforms):
            continue
        product_markers = edition_markers(product.name)
        if target_markers != product_markers:
            continue
        similarity = SequenceMatcher(None, target_core, core_title(product.name)).ratio()
        if target_core and target_core == core_title(product.name):
            similarity = 1.0
        ranked.append((similarity, product))

    if not ranked:
        return MatchResult(None, 0.0, "no candidate with matching title, edition, and platform")

    ranked.sort(key=lambda item: item[0], reverse=True)
    best_score, best = ranked[0]
    if best_score < 0.90:
        return MatchResult(None, best_score, "best title score is below 0.90")
    if len(ranked) > 1 and best_score - ranked[1][0] < 0.08:
        return MatchResult(None, best_score, "top product candidates are ambiguous")
    return MatchResult(best, best_score, "exact edition and high-confidence title match")
