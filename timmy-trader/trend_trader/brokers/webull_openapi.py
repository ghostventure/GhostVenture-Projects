from __future__ import annotations

import logging
from dataclasses import asdict
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
            ("account_v2", "get_positions"),
            ("account_v2", "get_account_positions"),
            ("order_v2", "get_positions"),
        )
        snapshot["open_orders"] = self._try_sdk_call(
            ("order_v2", "get_open_orders"),
            ("order_v2", "get_order_list"),
            ("account_v2", "get_orders"),
        )
        return snapshot

    def new_order_payload(self, order: OrderPlan) -> dict:
        client_order_id = f"timmy-{order.symbol.lower()}-{uuid4().hex[:8]}"
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

    def preview_order_payload(self, order: OrderPlan) -> dict:
        return {
            "account_id": self.config.webull_account_id,
            "new_orders": [self.new_order_payload(order)],
        }

    def preview_order(self, order: OrderPlan) -> dict:
        if not self.config.webull_account_id:
            raise RuntimeError("WEBULL_ACCOUNT_ID is required for Webull order preview.")
        self._ensure_connected()
        payload = self.preview_order_payload(order)
        response = self.trade_client.order_v2.preview_order(
            self.config.webull_account_id,
            payload["new_orders"],
        )
        return {
            **self._json_response(response),
            "request_payload": self._redacted_payload(payload),
            "order_plan": asdict(order),
        }

    def submit_order(self, order: OrderPlan) -> dict:
        enforce_live_guards(self.config)
        self._ensure_connected()

        payload = self.preview_order_payload(order)
        if self.config.webull_require_preview:
            return {
                "status": "preview-required",
                "message": "Order was not placed. Run webull-preview first, then disable WEBULL_REQUIRE_PREVIEW only after validation.",
                "payload": payload,
                "order_plan": asdict(order),
            }

        try:
            response = self.trade_client.order_v2.place_order(
                self.config.webull_account_id,
                payload["new_orders"],
            )
            return {
                **self._json_response(response),
                "request_payload": self._redacted_payload(payload),
                "order_plan": asdict(order),
            }
        except Exception as exc:
            return {
                "status": "rejected",
                "error": str(exc),
                "request_payload": self._redacted_payload(payload),
                "order_plan": asdict(order),
            }

    def _ensure_connected(self) -> None:
        if self.trade_client is None:
            self.connect()

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
