from __future__ import annotations

import logging
import hashlib
import json
import time
from dataclasses import asdict
from inspect import signature
from uuid import uuid4

from ..config import BotConfig
from ..models import OrderPlan
from ..risk import enforce_live_guards


class WebullOpenApiBroker:
    """Small guarded adapter around Webull's official OpenAPI Python SDK.

    The SDK handles authentication/signatures. This class intentionally defaults
    to account checks and preview-style workflows before any live placement.
    """

    def __init__(self, config: BotConfig) -> None:
        self.config = config
        self.api_client = None
        self.trade_client = None
        self._preview_receipts: dict[str, float] = {}

    def connect(self) -> None:
        if not self.config.webull_app_key or not self.config.webull_app_secret:
            raise RuntimeError("WEBULL_APP_KEY and WEBULL_APP_SECRET are required.")

        try:
            from webull.core.client import ApiClient
            from webull.trade.trade_client import TradeClient
        except Exception as exc:
            raise RuntimeError(
                "Install Webull's official SDK: pip install webull-openapi-python-sdk"
            ) from exc

        api_client = ApiClient(
            self.config.webull_app_key,
            self.config.webull_app_secret,
            self.config.webull_region,
            token_check_duration_seconds=self.config.webull_token_check_seconds,
            token_check_interval_seconds=self.config.webull_token_check_interval_seconds,
        )
        null_logger = logging.getLogger("timmy.webull")
        null_logger.addHandler(logging.NullHandler())
        null_logger.propagate = False
        api_client.set_logger(null_logger)
        api_client._stream_logger_set = True
        api_client._file_logger_set = True
        if self.config.webull_api_endpoint:
            api_client.add_endpoint(self.config.webull_region, self.config.webull_api_endpoint)

        self.api_client = api_client
        self.trade_client = TradeClient(api_client)

    def account_list(self) -> dict:
        self._ensure_connected()
        response = self.trade_client.account_v2.get_account_list()
        return self._json_response(response)

    def account_snapshot(self) -> dict:
        self._ensure_connected()
        accounts = self.account_list()
        balance = None
        if self.config.webull_account_id:
            balance = self._try_sdk_call(("account_v2", "get_account_balance"))
        snapshot = {
            "status_code": accounts.get("status_code", 0),
            "body": {
                "accounts": accounts.get("body"),
                "balance": balance.get("body") if isinstance(balance, dict) else balance,
            },
            "accounts": accounts,
            "balance": balance,
            "positions": None,
            "open_orders": None,
        }
        snapshot["positions"] = self._try_sdk_call(
            ("account_v2", "get_account_position"),
            ("account_v2", "get_positions"),
            ("account_v2", "get_account_positions"),
            ("order_v2", "get_positions"),
        )
        snapshot["open_orders"] = self._try_sdk_call(
            ("order_v3", "get_order_open"),
            ("order_v2", "get_order_open"),
            ("order_v2", "get_open_orders"),
            ("order_v2", "get_order_list"),
            ("account_v2", "get_orders"),
        )
        return snapshot

    def order_state_snapshot(self) -> dict:
        """Read open orders and positions for the guarded Auto preflight only."""
        self._ensure_connected()
        return {
            "positions": self._try_sdk_call(
                ("account_v2", "get_account_position"),
                ("account_v2", "get_positions"),
                ("account_v2", "get_account_positions"),
                ("order_v2", "get_positions"),
            ),
            "open_orders": self._try_sdk_call(
                ("order_v3", "get_order_open"),
                ("order_v2", "get_order_open"),
                ("order_v2", "get_open_orders"),
                ("order_v2", "get_order_list"),
                ("account_v2", "get_orders"),
            ),
        }

    def new_order_payload(self, order: OrderPlan, client_order_id: str | None = None) -> dict:
        # Match Webull's documented UUID client order ID shape. The caller may
        # supply the ID already previewed so preview and placement refer to the
        # same order intent.
        client_order_id = client_order_id or uuid4().hex
        payload = {
            "client_order_id": client_order_id[:32],
            "combo_type": "NORMAL",
            "symbol": order.symbol,
            "instrument_type": order.instrument_type,
            "market": order.market,
            "order_type": order.order_type,
            "quantity": _format_quantity(order.quantity),
            "side": order.side,
            "time_in_force": order.time_in_force,
            "entrust_type": order.entrust_type,
        }
        if order.support_trading_session:
            payload["support_trading_session"] = order.support_trading_session
        if order.limit_price is not None:
            payload["limit_price"] = f"{order.limit_price:.2f}"
        if order.order_type in {"STOP_LOSS", "STOP_LOSS_LIMIT"}:
            payload["stop_price"] = f"{order.stop_price:.2f}"
        if order.extra_payload:
            payload.update(order.extra_payload)
        return payload

    def preview_order_payload(self, order: OrderPlan, client_order_id: str | None = None) -> dict:
        return {
            "account_id": self.config.webull_account_id,
            "new_orders": [self.new_order_payload(order, client_order_id=client_order_id)],
        }

    def preview_order(self, order: OrderPlan, client_order_id: str | None = None) -> dict:
        if not self.config.webull_account_id:
            raise RuntimeError("WEBULL_ACCOUNT_ID is required for Webull order preview.")
        self._ensure_connected()
        payload = self.preview_order_payload(order, client_order_id=client_order_id)
        response = self._order_api().preview_order(
            self.config.webull_account_id,
            payload["new_orders"],
        )
        return {
            **self._json_response(response),
            "request_payload": self._redacted_payload(payload),
            "order_plan": asdict(order),
        }

    def submit_order(self, order: OrderPlan, client_order_id: str | None = None) -> dict:
        # Raw submit_order has no caller-visible preview receipt or exact-order
        # confirmation. Keep it fail-closed; callers must use the two-step
        # preview_order_payloads / submit_previewed_order_payloads contract.
        payload = self.preview_order_payload(order, client_order_id=client_order_id)
        return {
            "status": "preview-required",
            "message": "No order was placed. Obtain and validate an exact preview, then submit that same payload with its fresh preview receipt.",
            "request_payload": self._redacted_payload(payload),
            "order_plan": asdict(order),
        }

    @staticmethod
    def order_payload_fingerprint(account_id: str, new_orders: list[dict], client_combo_order_id: str | None = None) -> str:
        canonical = json.dumps({"account_id": account_id, "new_orders": new_orders,
                                "client_combo_order_id": client_combo_order_id}, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def preview_order_payloads(self, new_orders: list[dict], client_combo_order_id: str | None = None) -> dict:
        """Preview one simple or multi-leg strategy order and retain its exact fingerprint."""
        if not self.config.webull_account_id:
            raise RuntimeError("WEBULL_ACCOUNT_ID is required for Webull order preview.")
        if not isinstance(new_orders, list) or len(new_orders) != 1 or not isinstance(new_orders[0], dict):
            raise ValueError("The safe manual flow previews one order or one multi-leg strategy at a time.")
        client_id = str(new_orders[0].get("client_order_id") or "")
        if not client_id or len(client_id) > 32:
            raise ValueError("A unique client_order_id of 1–32 characters is required.")
        _validate_manual_order(new_orders[0], self.config)
        self._ensure_connected()
        response = self._order_api().preview_order(self.config.webull_account_id, new_orders,
                                                   client_combo_order_id=client_combo_order_id)
        result = self._json_response(response)
        fingerprint = self.order_payload_fingerprint(self.config.webull_account_id, new_orders, client_combo_order_id)
        code = result.get("status_code")
        try: status_ok = 200 <= int(code) < 300
        except (TypeError, ValueError): status_ok = False
        body = result.get("body")
        error = _response_body_has_error(body)
        if status_ok and not error:
            self._preview_receipts[fingerprint] = time.monotonic()
            if len(self._preview_receipts) > 25:
                oldest = sorted(self._preview_receipts.items(), key=lambda item: item[1])[:-25]
                for old_fingerprint, _created in oldest:
                    self._preview_receipts.pop(old_fingerprint, None)
        return {**result, "preview_ok": status_ok and not error,
                "preview_fingerprint": fingerprint if status_ok and not error else None,
                "request_payload": self._redacted_payload({"account_id": self.config.webull_account_id,
                                                           "new_orders": new_orders,
                                                           "client_combo_order_id": client_combo_order_id})}

    def submit_previewed_order_payloads(self, new_orders: list[dict], preview_fingerprint: str,
                                        client_combo_order_id: str | None = None) -> dict:
        """Submit only the exact payload successfully previewed by this adapter instance."""
        enforce_live_guards(self.config)
        account_id = self.config.webull_account_id
        fingerprint = self.order_payload_fingerprint(account_id, new_orders, client_combo_order_id)
        created = self._preview_receipts.pop(fingerprint, None)
        if not preview_fingerprint or preview_fingerprint != fingerprint or created is None or time.monotonic() - created > 600:
            return {"status": "preview-required", "message": "No fresh successful preview matches this exact order payload. No order was placed."}
        # A fresh receipt for this exact payload is the required preview. The
        # WEBULL_REQUIRE_PREVIEW setting must not veto a successful preview.
        request_payload = {"account_id": account_id, "new_orders": new_orders,
                           "client_combo_order_id": client_combo_order_id}
        submission_started = False
        try:
            self._ensure_connected()
            submission_started = True
            response = self._order_api().place_order(account_id, new_orders,
                                                     client_combo_order_id=client_combo_order_id)
            return {**self._json_response(response), "request_payload": self._redacted_payload(request_payload)}
        except Exception as exc:
            return {"status": "unknown" if submission_started else "failed",
                    "before_submit_failure": not submission_started,
                    "error": str(exc), "request_payload": self._redacted_payload(request_payload)}

    def cancel_order(self, client_order_id: str) -> dict:
        enforce_live_guards(self.config)
        self._ensure_connected()
        if not self.config.webull_account_id or not client_order_id:
            raise RuntimeError("Account and client order IDs are required to cancel an order.")
        try:
            response = self._order_api().cancel_order(self.config.webull_account_id, client_order_id)
            return {**self._json_response(response), "action": "cancel", "client_order_id": client_order_id}
        except Exception as exc:
            return {"status": "unknown", "error": str(exc), "action": "cancel", "client_order_id": client_order_id}

    def replace_order(self, client_order_id: str, changes: dict) -> dict:
        enforce_live_guards(self.config)
        self._ensure_connected()
        if not self.config.webull_account_id or not client_order_id:
            raise RuntimeError("Account and client order IDs are required to replace an order.")
        if not changes or not set(changes).issubset({"quantity", "limit_price", "time_in_force"}):
            raise ValueError("Only quantity, limit price, and time in force can be changed here.")
        request = {"client_order_id": client_order_id, **changes}
        try:
            response = self._order_api().replace_order(self.config.webull_account_id, [request])
            return {**self._json_response(response), "action": "replace", "client_order_id": client_order_id,
                    "request": request}
        except Exception as exc:
            return {"status": "unknown", "error": str(exc), "action": "replace", "client_order_id": client_order_id,
                    "request": request}

    def get_order_detail(self, client_order_id: str) -> dict:
        self._ensure_connected()
        response = self._order_api().get_order_detail(self.config.webull_account_id, client_order_id)
        return self._json_response(response)

    def order_history(self, start_time: str | None = None, end_time: str | None = None) -> dict:
        self._ensure_connected()
        api = self._order_api()
        method = getattr(api, "list_order_history", None) or getattr(api, "get_order_history", None)
        if not callable(method):
            raise RuntimeError("This Webull SDK does not expose order history.")
        response = method(self.config.webull_account_id, start_time=start_time, end_time=end_time)
        return self._json_response(response)

    def order_executions(self, start_date: str | None = None, end_date: str | None = None,
                         client_order_id: str | None = None) -> dict:
        self._ensure_connected()
        api = self._order_api()
        method = getattr(api, "list_order_executions", None) or getattr(api, "get_order_executions", None)
        if not callable(method):
            raise RuntimeError("This Webull SDK does not expose order executions.")
        response = method(self.config.webull_account_id, client_order_id=client_order_id,
                          start_date=start_date, end_date=end_date)
        return self._json_response(response)

    def market_snapshot(self, symbols: list[str], instrument_type: str = "EQUITY") -> dict:
        """Read market snapshots through the official SDK for supported instruments."""
        if not symbols or len(symbols) > 20:
            raise ValueError("Enter between one and twenty instrument symbols.")
        self._ensure_connected()
        from webull.data.common.category import Category
        from webull.data.quotes.market_data import MarketData
        from webull.data.quotes.option_market_data import OptionMarketData
        from webull.data.quotes.futures_market_data import FuturesMarketData
        from webull.data.quotes.crypto_market_data import CryptoMarketData
        from webull.data.quotes.event_market_data import EventMarketData

        kind = instrument_type.upper()
        if kind == "EQUITY":
            response = MarketData(self.api_client).get_snapshot(symbols, Category.US_STOCK.name)
        elif kind == "OPTION":
            response = OptionMarketData(self.api_client).get_option_snapshot(symbols, Category.US_OPTION.name)
        elif kind == "FUTURES":
            response = FuturesMarketData(self.api_client).get_futures_snapshot(symbols, Category.US_FUTURES.name)
        elif kind == "CRYPTO":
            response = CryptoMarketData(self.api_client).get_crypto_snapshot(symbols, Category.US_CRYPTO.name)
        elif kind == "EVENT":
            response = EventMarketData(self.api_client).get_event_snapshot(symbols, Category.US_EVENT.name)
        else:
            raise ValueError("Supported snapshot types: EQUITY, OPTION, FUTURES, CRYPTO, EVENT.")
        return self._json_response(response)

    def discover_order_instruments(self, product: str, query: str) -> dict:
        """Targeted read-only instrument discovery for the guarded order form."""
        from webull.data.common.category import Category
        from webull.data.quotes.instrument import Instrument

        value = str(query or "").strip().upper()
        if not value:
            raise ValueError("Enter a symbol, underlying, contract code, or event series.")
        self._ensure_connected()
        catalog = Instrument(self.api_client)
        kind = str(product or "").upper()
        if kind == "EQUITY":
            response = catalog.list_instruments(symbols=[value], category=Category.US_STOCK.name)
        elif kind == "OPTION":
            response = catalog.list_option_contracts(underlying_symbols=[value], category=Category.US_OPTION.name)
        elif kind == "FUTURES":
            response = catalog.get_futures_instrument(symbols=[value], category=Category.US_FUTURES.name)
        elif kind == "EVENT":
            response = catalog.list_event_instruments(series_symbol=value)
        else:
            raise ValueError("Instrument discovery is available for EQUITY, OPTION, FUTURES, and EVENT orders.")
        return self._json_response(response)

    def _ensure_connected(self) -> None:
        if self.trade_client is None:
            self.connect()

    def _order_api(self):
        """Prefer Webull's current v3 interface, retaining an older SDK fallback."""
        order_api = getattr(self.trade_client, "order_v3", None)
        if order_api is None:
            order_api = getattr(self.trade_client, "order_v2", None)
        if order_api is None:
            raise RuntimeError("This Webull SDK exposes neither order_v3 nor order_v2.")
        return order_api

    def _try_sdk_call(self, *paths: tuple[str, str]) -> dict:
        for object_name, method_name in paths:
            target = getattr(self.trade_client, object_name, None)
            method = getattr(target, method_name, None) if target is not None else None
            if not callable(method):
                continue
            try:
                try:
                    response = method(self.config.webull_account_id)
                except TypeError:
                    response = method()
                return self._json_response(response)
            except Exception as exc:
                return {"ok": False, "error": str(exc), "method": f"{object_name}.{method_name}"}
        return {"ok": False, "error": "No compatible Webull SDK endpoint found."}

    @staticmethod
    def _json_response(response) -> dict:
        try:
            body = response.json()
        except Exception:
            body = getattr(response, "text", "")
        return {"status_code": response.status_code, "body": body}

    @staticmethod
    def _redacted_payload(payload: dict) -> dict:
        redacted = dict(payload)
        if redacted.get("account_id"):
            redacted["account_id"] = "<configured>"
        return redacted


def _format_quantity(quantity: float) -> str:
    if float(quantity).is_integer():
        return str(int(quantity))
    return f"{quantity:.8f}".rstrip("0").rstrip(".")


def _response_body_has_error(body) -> bool:
    if isinstance(body, dict):
        for key, value in body.items():
            key_text = str(key).lower()
            value_text = str(value).lower() if value is not None else ""
            if key_text in {"error", "error_code", "error_msg", "error_message", "errcode"} and value not in (None, "", 0, "0", False):
                return True
            if key_text in {"success", "ok"} and value is False:
                return True
            if key_text in {"code", "status_code", "retcode"} and value not in (None, 0, "0", 200, "200", "OK", "SUCCESS"):
                return True
            if key_text in {"message", "msg", "detail", "reason"} and any(word in value_text for word in ("error", "reject", "invalid", "insufficient", "failed")):
                return True
            if isinstance(value, (dict, list)) and _response_body_has_error(value):
                return True
        return False
    if isinstance(body, list):
        return any(_response_body_has_error(item) for item in body)
    if isinstance(body, str):
        return any(word in body.lower() for word in ("error", "reject", "invalid order", "insufficient", "failed"))
    return False


def _validate_manual_order(order: dict, config: BotConfig) -> None:
    """Fail closed on product/order combinations the guarded UI does not support."""
    allowed_fields = {"client_order_id", "combo_type", "symbol", "instrument_type", "market", "order_type",
                      "limit_price", "quantity", "side", "time_in_force", "entrust_type",
                      "support_trading_session", "option_strategy", "legs", "event_trade_mode", "expire_date",
                      "position_intent"}
    if set(order) - allowed_fields:
        raise ValueError("The guarded order form contains unsupported order fields.")
    kind = str(order.get("instrument_type") or "").upper()
    if kind == "CRYPTO":
        raise ValueError("Webull does not provide Preview Order for crypto. Timmy will not submit crypto orders without an exact broker preview.")
    if kind not in {"EQUITY", "OPTION", "FUTURES", "EVENT"}:
        raise ValueError("Supported guarded live order types are EQUITY, OPTION, FUTURES, and EVENT.")
    if str(order.get("market") or "").upper() != "US":
        raise ValueError("The guarded order form currently supports the US market only.")
    if not str(order.get("symbol") or "").strip():
        raise ValueError("A discovered or verified instrument symbol is required.")
    if str(order.get("entrust_type") or "QTY").upper() != "QTY":
        raise ValueError("Only quantity-based manual orders are enabled.")
    if str(order.get("combo_type") or "NORMAL").upper() != "NORMAL":
        raise ValueError("Conditional combo orders are not enabled in the guarded manual flow.")
    if str(order.get("order_type") or "").upper() != "LIMIT":
        raise ValueError("The guarded manual flow supports limit orders only.")
    try:
        quantity = float(order.get("quantity"))
        price = float(order.get("limit_price"))
    except (TypeError, ValueError) as exc:
        raise ValueError("Positive quantity and limit price are required.") from exc
    if not (quantity > 0 and price > 0 and quantity < float("inf") and price < float("inf")):
        raise ValueError("Quantity and limit price must be positive finite numbers.")
    side = str(order.get("side") or "").upper()
    side_options = {"EQUITY": {"BUY", "SELL"}, "OPTION": {"BUY", "SELL", "SHORT"},
                    "FUTURES": {"BUY", "SELL"}, "EVENT": {"BUY", "SELL"}}
    if side not in side_options[kind]:
        raise ValueError(f"Unsupported {kind} side.")
    tif = str(order.get("time_in_force") or "").upper()
    allowed_tif = {"EQUITY": {"DAY", "GTC"}, "OPTION": {"DAY", "GTC"},
                   "FUTURES": {"DAY", "GTC"}, "EVENT": {"DAY", "GTC", "IOC", "GTD", "FOK"}}
    if tif not in allowed_tif[kind]:
        raise ValueError(f"Unsupported time in force for {kind}.")
    if kind == "OPTION" and side in {"SELL", "SHORT"} and tif != "DAY":
        raise ValueError("Webull options sell-side orders only support DAY time in force.")
    if kind == "EVENT" and order.get("event_trade_mode") != "TRADE_IN_CONTRACT":
        raise ValueError("The guarded event-order flow supports contract quantity only.")
    if kind == "EVENT" and tif == "GTD" and not order.get("expire_date"):
        raise ValueError("Event GTD orders require an expiration date.")
    if kind == "EVENT" and tif != "GTD" and order.get("expire_date"):
        raise ValueError("An expiration date is only valid for event GTD orders.")
    if kind == "EVENT" and tif == "GTD":
        try:
            from datetime import date
            expire_date = date.fromisoformat(str(order["expire_date"]))
        except (TypeError, ValueError) as exc:
            raise ValueError("Event GTD expiration must use YYYY-MM-DD.") from exc
        if expire_date < date.today():
            raise ValueError("Event GTD expiration cannot be in the past.")
    if kind == "EQUITY":
        if quantity > config.max_order_quantity or quantity * price > config.max_order_notional_usd:
            raise ValueError("Equity order exceeds Timmy's configured quantity or notional cap.")
    elif kind == "OPTION":
        if not config.enable_options_trading:
            raise ValueError("Options trading is disabled in Timmy settings.")
        if quantity != int(quantity) or quantity > config.max_options_contracts:
            raise ValueError("Option quantity must be whole contracts within Timmy's configured limit.")
        allowed_strategies = {"SINGLE", "COVERED_STOCK", "VERTICAL", "STRADDLE", "STRANGLE", "CALENDAR",
                              "BUTTERFLY", "CONDOR", "IRON_BUTTERFLY", "IRON_CONDOR", "COLLAR_WITH_STOCK", "DIAGONAL"}
        strategy = str(order.get("option_strategy") or "").upper()
        legs = order.get("legs")
        if strategy not in allowed_strategies or not isinstance(legs, list) or not 1 <= len(legs) <= 4:
            raise ValueError("Choose a supported options strategy and provide one to four option legs.")
        if strategy == "SINGLE" and len(legs) != 1:
            raise ValueError("SINGLE options strategy requires exactly one option leg.")
        if strategy in {"VERTICAL", "STRADDLE", "STRANGLE", "CALENDAR", "DIAGONAL"} and len(legs) != 2:
            raise ValueError(f"{strategy} requires exactly two option legs.")
        if strategy == "BUTTERFLY" and len(legs) != 3:
            raise ValueError(f"{strategy} requires exactly three option legs.")
        if strategy in {"CONDOR", "IRON_CONDOR", "IRON_BUTTERFLY"} and len(legs) != 4:
            raise ValueError(f"{strategy} requires exactly four option legs.")
        if strategy == "COVERED_STOCK" and len(legs) != 2:
            raise ValueError("COVERED_STOCK requires one equity leg and one option leg.")
        if strategy == "COLLAR_WITH_STOCK" and len(legs) != 3:
            raise ValueError("COLLAR_WITH_STOCK requires one equity leg and two option legs.")
        for leg in legs:
            if not isinstance(leg, dict) or str(leg.get("side", "")).upper() not in {"BUY", "SELL"}:
                raise ValueError("Every strategy leg needs a BUY or SELL side.")
            leg_fields = {"side", "quantity", "symbol", "strike_price", "option_expire_date", "instrument_type",
                          "option_type", "market", "position_id", "leg_in_or_out", "leg_in_strategy"}
            if set(leg) - leg_fields:
                raise ValueError("An option strategy leg contains unsupported fields.")
            if str(leg.get("instrument_type", "OPTION")).upper() not in {"OPTION", "EQUITY"}:
                raise ValueError("Option strategies may contain OPTION legs and supported covered-stock EQUITY legs only.")
            try: leg_qty = float(leg.get("quantity"))
            except (TypeError, ValueError) as exc: raise ValueError("Every strategy leg needs a positive whole quantity.") from exc
            if leg_qty <= 0 or leg_qty != int(leg_qty) or leg_qty > config.max_options_contracts * (100 if leg.get("instrument_type") == "EQUITY" else 1):
                raise ValueError("Every strategy leg needs a positive whole quantity within Timmy's configured limit.")
            if not leg.get("symbol") or str(leg.get("market") or "US").upper() != "US":
                raise ValueError("Every strategy leg needs a symbol and US market.")
            if str(leg.get("symbol")).upper() != str(order.get("symbol")).upper():
                raise ValueError("Every strategy leg must use the selected underlying symbol.")
            if str(leg.get("instrument_type", "OPTION")).upper() == "OPTION":
                try: strike = float(leg.get("strike_price"))
                except (TypeError, ValueError) as exc: raise ValueError("Every option leg needs a positive strike.") from exc
                if strike <= 0 or not leg.get("option_expire_date") or str(leg.get("option_type", "")).upper() not in {"CALL", "PUT"}:
                    raise ValueError("Every option leg needs strike, expiration date, and CALL/PUT type.")
        if strategy == "SINGLE" and float(legs[0].get("quantity", 0)) != quantity:
            raise ValueError("SINGLE option leg quantity must match the strategy order quantity.")
        if any(str(leg.get("instrument_type", "OPTION")).upper() == "EQUITY" for leg in legs) and strategy not in {"COVERED_STOCK", "COLLAR_WITH_STOCK"}:
            raise ValueError("Equity legs are only allowed for covered stock or collar strategies.")
    elif kind == "FUTURES":
        if not config.enable_futures_trading:
            raise ValueError("Futures trading is disabled in Timmy settings.")
        if quantity != int(quantity) or quantity > config.max_futures_contracts:
            raise ValueError("Futures quantity must be whole contracts within Timmy's configured limit.")
    elif kind == "EVENT":
        if not config.enable_event_contract_trading:
            raise ValueError("Event-contract trading is disabled in Timmy settings.")
        if quantity != int(quantity) or quantity > config.max_order_quantity or not (0.01 <= price <= 0.99):
            raise ValueError("Event orders require whole contracts within Timmy's limit and a price from $0.01 to $0.99.")
