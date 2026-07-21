from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict

from .asset_classes import enabled_asset_classes
from .backtest import run_backtest
from .brokers.paper import PaperBroker
from .brokers.webull_openapi import WebullOpenApiBroker
from .config import load_config
from .data import load_csv_bars, write_csv_bars
from .knowledge import list_topics, search_knowledge
from .market_data import fetch_daily_bars
from .readiness import readiness_flags
from .risk import create_order_plan
from .sample_data import write_sample_bars
from .strategy import rank_signals
from .watchlist import WATCHLIST_TEMPLATES, load_watchlist, write_watchlist_template


def main() -> int:
    parser = argparse.ArgumentParser(description="Timmy: guarded trend/pattern trading engine.")
    sub = parser.add_subparsers(dest="command", required=True)

    scan = sub.add_parser("scan", help="Score symbols from CSV bars.")
    scan.add_argument("--data", required=True)

    plan = sub.add_parser("plan", help="Create risk-capped order plans from CSV bars.")
    plan.add_argument("--data", required=True)

    paper = sub.add_parser("paper-trade", help="Submit eligible plans to the paper journal.")
    paper.add_argument("--data", required=True)

    sub.add_parser("webull-check", help="Verify Webull SDK credentials and list accounts.")
    sub.add_parser("webull-sync", help="Fetch a guarded Webull account/position/order snapshot when SDK endpoints are available.")
    sub.add_parser("readiness", help="Show red/green runtime readiness flags.")
    sub.add_parser("asset-classes", help="Show configured instrument classes and live enablement switches.")

    webull_preview = sub.add_parser("webull-preview", help="Preview eligible plans through Webull OpenAPI.")
    webull_preview.add_argument("--data", required=True)

    sample = sub.add_parser("sample-data", help="Write synthetic bars for a local scanner demo.")
    sample.add_argument("--out", default="examples/sample_bars.csv")

    fetch = sub.add_parser("fetch-data", help="Fetch delayed daily bars into Timmy's CSV format.")
    fetch.add_argument("--out", default="examples/sample_bars.csv")
    fetch.add_argument("--watchlist", default=None)
    fetch.add_argument("--days", default=90, type=int)
    fetch.add_argument("--provider", default=None, choices=["stooq", "yahoo"])

    watchlist = sub.add_parser("watchlist-init", help="Create a default watchlist file.")
    watchlist.add_argument("--out", default="watchlist.txt")
    watchlist.add_argument("--template", default="equity", choices=sorted(WATCHLIST_TEMPLATES))

    backtest = sub.add_parser("backtest", help="Backtest Timmy strategy against CSV bars.")
    backtest.add_argument("--data", required=True)
    backtest.add_argument("--hold-bars", default=10, type=int)

    knowledge = sub.add_parser("knowledge", help="Search Timmy's local trading guidance repository.")
    knowledge.add_argument("query", nargs="*", help="Search terms. Omit to list topics.")
    knowledge.add_argument("--limit", default=8, type=int)

    args = parser.parse_args()
    config = load_config()

    if args.command == "sample-data":
        write_sample_bars(args.out)
        print(json.dumps({"ok": True, "path": args.out}, indent=2))
        return 0

    if args.command == "watchlist-init":
        write_watchlist_template(args.out, args.template)
        print(json.dumps({"ok": True, "path": args.out, "template": args.template}, indent=2))
        return 0

    if args.command == "fetch-data":
        symbols = load_watchlist(args.watchlist, config.symbol_whitelist)
        bars = fetch_daily_bars(args.provider or config.market_data_provider, symbols, days=args.days)
        write_csv_bars(args.out, bars)
        print(json.dumps({"ok": True, "path": args.out, "symbols": sorted(bars)}, indent=2))
        return 0

    if args.command == "knowledge":
        if args.query:
            print(json.dumps(search_knowledge(" ".join(args.query), limit=args.limit), indent=2))
        else:
            print(json.dumps(list_topics(), indent=2))
        return 0

    if args.command == "webull-check":
        broker = WebullOpenApiBroker(config)
        return _print_broker_result(lambda: broker.account_list())

    if args.command == "webull-sync":
        broker = WebullOpenApiBroker(config)
        return _print_broker_result(lambda: broker.account_snapshot())

    if args.command == "readiness":
        print(json.dumps(readiness_flags(config), indent=2))
        return 0

    if args.command == "asset-classes":
        print(json.dumps({
            "enabled": enabled_asset_classes(config),
            "configured_symbols": {
                "crypto": sorted(config.crypto_symbols),
                "futures": sorted(config.futures_symbols),
                "options": sorted(config.options_symbols),
                "event_contracts": sorted(config.event_contract_symbols),
            },
            "switches": {
                "crypto": config.enable_crypto_trading,
                "futures": config.enable_futures_trading,
                "options": config.enable_options_trading,
                "event_contracts": config.enable_event_contract_trading,
            },
            "limits": {
                "equity_order_notional_usd": config.max_order_notional_usd,
                "crypto_order_notional_usd": config.max_crypto_order_notional_usd,
                "futures_contracts": config.max_futures_contracts,
                "options_contracts": config.max_options_contracts,
            },
        }, indent=2))
        return 0

    bars = load_csv_bars(args.data)
    signals = rank_signals(bars, config)

    if args.command == "scan":
        print(json.dumps([asdict(signal) for signal in signals], indent=2))
        return 0

    if args.command == "backtest":
        print(json.dumps(run_backtest(bars, config, hold_bars=args.hold_bars), indent=2))
        return 0

    plans = [plan for signal in signals if (plan := create_order_plan(signal, config))]
    if args.command == "plan":
        print(json.dumps([asdict(plan) for plan in plans], indent=2))
        return 0

    if args.command == "paper-trade":
        broker = PaperBroker()
        results = [broker.submit(plan) for plan in plans[: config.max_positions]]
        print(json.dumps(results, indent=2, sort_keys=True))
        return 0

    if args.command == "webull-preview":
        broker = WebullOpenApiBroker(config)
        return _print_broker_result(
            lambda: [broker.preview_order(plan) for plan in plans[: config.max_positions]]
        )

    return 2


def _print_broker_result(action) -> int:
    try:
        print(json.dumps(action(), indent=2, sort_keys=True))
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
