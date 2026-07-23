from __future__ import annotations

import logging
from dataclasses import dataclass

from .config import BotConfig


@dataclass(frozen=True)
class WebullWatchlistSyncResult:
    name: str
    desired_count: int
    added_count: int
    removed_count: int
    status: str
    error: str | None = None


def sync_generated_watchlists(config: BotConfig, lists: dict[str, list[str]]) -> list[WebullWatchlistSyncResult]:
    if not config.webull_sync_watchlists:
        return []
    client = _watchlist_client(config)
    existing = _json_response(client.watchlist.get_watchlist())
    by_name = {str(item.get("name")): item for item in existing if isinstance(item, dict)}
    results: list[WebullWatchlistSyncResult] = []
    for name, symbols in lists.items():
        clean_symbols = sorted(dict.fromkeys(symbol.upper() for symbol in symbols if symbol.strip()))
        try:
            watchlist = by_name.get(name)
            if watchlist is None:
                created = _json_response(client.watchlist.create_watchlist(name))
                watchlist_id = created.get("watchlist_id") or created.get("id")
                if not watchlist_id:
                    existing = _json_response(client.watchlist.get_watchlist())
                    by_name = {str(item.get("name")): item for item in existing if isinstance(item, dict)}
                    watchlist_id = _watchlist_id(by_name.get(name) or {})
            else:
                watchlist_id = _watchlist_id(watchlist)
            if not watchlist_id:
                results.append(WebullWatchlistSyncResult(name, len(clean_symbols), 0, 0, "failed", "missing watchlist id"))
                continue

            current = _json_response(client.watchlist.get_instruments(watchlist_id))
            current_items = _instrument_items(current)
            current_symbols = {str(item.get("symbol", "")).upper() for item in current_items if item.get("symbol")}
            desired_symbols = set(clean_symbols)
            to_remove = sorted(current_symbols - desired_symbols)
            if to_remove:
                client.watchlist.remove_instruments(
                    watchlist_id,
                    [{"symbol": symbol, "category": "US_STOCK"} for symbol in to_remove],
                )
            if not clean_symbols:
                results.append(WebullWatchlistSyncResult(name, 0, 0, len(to_remove), "synced"))
                continue
            to_add = [symbol for symbol in clean_symbols if symbol not in current_symbols]
            if to_add:
                client.watchlist.add_instruments(
                    watchlist_id,
                    [
                        {"symbol": symbol, "category": "US_STOCK", "sort": (len(clean_symbols) - index) * 100}
                        for index, symbol in enumerate(to_add)
                    ],
                )
            results.append(WebullWatchlistSyncResult(name, len(clean_symbols), len(to_add), len(to_remove), "synced"))
        except Exception as exc:
            results.append(WebullWatchlistSyncResult(name, len(clean_symbols), 0, 0, "failed", str(exc)))
    return results


def _watchlist_client(config: BotConfig):
    if not config.webull_app_key or not config.webull_app_secret:
        raise RuntimeError("WEBULL_APP_KEY and WEBULL_APP_SECRET are required for watchlist sync.")
    from webull.core.client import ApiClient
    from webull.data.data_client import DataClient

    api_client = ApiClient(
        config.webull_app_key,
        config.webull_app_secret,
        config.webull_region,
        token_check_duration_seconds=config.webull_token_check_seconds,
        token_check_interval_seconds=config.webull_token_check_interval_seconds,
    )
    null_logger = logging.getLogger("timmy.webull.watchlists")
    null_logger.addHandler(logging.NullHandler())
    null_logger.propagate = False
    api_client.set_logger(null_logger)
    api_client._stream_logger_set = True
    api_client._file_logger_set = True
    if config.webull_api_endpoint:
        api_client.add_endpoint(config.webull_region, config.webull_api_endpoint)
    return DataClient(api_client)


def _json_response(response):
    if hasattr(response, "json"):
        return response.json()
    if hasattr(response, "body"):
        return response.body
    return response


def _watchlist_id(watchlist: dict) -> str | None:
    return watchlist.get("watchlist_id") or watchlist.get("id")


def _instrument_items(response) -> list[dict]:
    if isinstance(response, dict):
        items = response.get("instruments") or response.get("data") or response.get("items") or []
    else:
        items = response
    return [item for item in items if isinstance(item, dict)]
