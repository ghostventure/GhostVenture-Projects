from __future__ import annotations

import argparse
import json
import os
from dataclasses import asdict
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .brokers.paper import PaperBroker
from .brokers.webull_openapi import WebullOpenApiBroker
from .config import BotConfig, load_config
from .data import load_csv_bars
from .risk import create_order_plan
from .sample_data import write_sample_bars
from .strategy import rank_signals

ROOT = Path(os.getenv("TIMMY_HOME", Path.cwd())).resolve()
STATIC_DIR = Path(__file__).resolve().parent / "static"
DEFAULT_DATA = ROOT / "examples" / "sample_bars.csv"
JOURNAL_PATH = ROOT / "trade-journal.jsonl"


def create_app() -> FastAPI:
    app = FastAPI(title="Timmy Dashboard", docs_url=None, redoc_url=None)
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/", response_class=HTMLResponse)
    def index() -> str:
        return (STATIC_DIR / "dashboard.html").read_text(encoding="utf-8")

    @app.get("/api/status")
    def status() -> dict:
        config = load_config()
        return {
            "robot": "Timmy",
            "data_file": str(DEFAULT_DATA),
            "data_ready": DEFAULT_DATA.exists(),
            "journal_count": len(_journal_events()),
            "config": _safe_config(config),
        }

    @app.post("/api/sample-data")
    def sample_data() -> dict:
        write_sample_bars(DEFAULT_DATA)
        return {"ok": True, "path": str(DEFAULT_DATA)}

    @app.get("/api/scan")
    def scan() -> dict:
        return _scan_payload()

    @app.get("/api/plans")
    def plans() -> dict:
        return _plan_payload()

    @app.post("/api/paper-trade")
    def paper_trade() -> JSONResponse:
        try:
            config = load_config()
            orders = _plans(config)
            broker = PaperBroker(str(JOURNAL_PATH))
            results = [broker.submit(order) for order in orders[: config.max_positions]]
            return JSONResponse({"ok": True, "results": results, "journal_count": len(_journal_events())})
        except Exception as exc:
            return _error(exc)

    @app.post("/api/webull-check")
    def webull_check() -> JSONResponse:
        try:
            result = WebullOpenApiBroker(load_config()).account_list()
            return JSONResponse({"ok": True, "result": _redact_accounts(result)})
        except Exception as exc:
            return _error(exc)

    @app.post("/api/webull-preview")
    def webull_preview() -> JSONResponse:
        try:
            config = load_config()
            broker = WebullOpenApiBroker(config)
            results = [broker.preview_order(order) for order in _plans(config)[: config.max_positions]]
            return JSONResponse({"ok": True, "results": results})
        except Exception as exc:
            return _error(exc)

    @app.get("/api/journal")
    def journal() -> dict:
        return {"events": _journal_events()}

    return app


def _scan_payload() -> dict:
    if not DEFAULT_DATA.exists():
        write_sample_bars(DEFAULT_DATA)
    config = load_config()
    bars = load_csv_bars(DEFAULT_DATA)
    signals = rank_signals(bars, config)
    return {"signals": [asdict(signal) for signal in signals]}


def _plans(config: BotConfig) -> list:
    if not DEFAULT_DATA.exists():
        write_sample_bars(DEFAULT_DATA)
    bars = load_csv_bars(DEFAULT_DATA)
    signals = rank_signals(bars, config)
    return [plan for signal in signals if (plan := create_order_plan(signal, config))]


def _plan_payload() -> dict:
    config = load_config()
    return {"plans": [asdict(plan) for plan in _plans(config)]}


def _safe_config(config: BotConfig) -> dict:
    return {
        "trader_mode": config.trader_mode,
        "trader_live": config.trader_live,
        "webull_account_configured": bool(config.webull_account_id),
        "webull_endpoint": config.webull_api_endpoint,
        "webull_live_orders": config.webull_enable_live_orders,
        "webull_require_preview": config.webull_require_preview,
        "symbol_whitelist": sorted(config.symbol_whitelist),
        "max_order_notional_usd": config.max_order_notional_usd,
        "max_order_quantity": config.max_order_quantity,
        "max_positions": config.max_positions,
        "max_daily_loss_usd": config.max_daily_loss_usd,
        "risk_per_trade_usd": config.risk_per_trade_usd,
        "min_score_to_trade": config.min_score_to_trade,
    }


def _redact_accounts(result: dict) -> dict:
    safe = dict(result)
    body = safe.get("body")
    if isinstance(body, list):
        safe["body"] = [
            {
                "account_class": item.get("account_class"),
                "account_label": item.get("account_label"),
                "account_type": item.get("account_type"),
            }
            for item in body
            if isinstance(item, dict)
        ]
    return safe


def _journal_events() -> list[dict]:
    if not JOURNAL_PATH.exists():
        return []
    events = []
    for line in JOURNAL_PATH.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events[-50:]


def _error(exc: Exception) -> JSONResponse:
    return JSONResponse({"ok": False, "error": str(exc)}, status_code=400)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Timmy's local dashboard.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    args = parser.parse_args()

    import uvicorn

    uvicorn.run(create_app(), host=args.host, port=args.port, log_level="info")
    return 0


app = create_app()


if __name__ == "__main__":
    raise SystemExit(main())
