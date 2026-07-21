from __future__ import annotations

from pathlib import Path

DEFAULT_WATCHLIST = ("SPY", "QQQ", "IWM", "DIA", "AAPL", "MSFT", "NVDA", "AMD", "TSLA")
WATCHLIST_TEMPLATES = {
    "equity": DEFAULT_WATCHLIST,
    "crypto": ("BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD", "LTCUSD"),
    "commodity-etf": ("GLD", "SLV", "USO", "UNG", "DBA", "DBC", "COPX", "URA"),
    "index-proxy": ("SPY", "QQQ", "IWM", "DIA", "VTI", "VOO", "XLK", "XLF", "XLE"),
    "futures-watch": ("ES=F", "NQ=F", "YM=F", "RTY=F", "GC=F", "SI=F", "CL=F", "NG=F", "ZC=F", "ZS=F"),
}


def load_watchlist(path: str | Path | None = None, fallback: set[str] | None = None) -> list[str]:
    symbols: list[str] = []
    if path:
        source = Path(path).expanduser()
        if source.exists():
            for line in source.read_text(encoding="utf-8", errors="replace").splitlines():
                symbol = line.split("#", 1)[0].strip().upper()
                if symbol:
                    symbols.append(symbol)
    if not symbols and fallback:
        symbols = sorted(fallback)
    if not symbols:
        symbols = list(DEFAULT_WATCHLIST)
    return sorted(dict.fromkeys(symbols))


def write_default_watchlist(path: str | Path) -> None:
    write_watchlist_template(path, "equity")


def write_watchlist_template(path: str | Path, template: str = "equity") -> None:
    symbols = WATCHLIST_TEMPLATES.get(template)
    if symbols is None:
        raise ValueError(f"Unknown watchlist template: {template}")
    target = Path(path).expanduser()
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        return
    target.write_text("\n".join(symbols) + "\n", encoding="utf-8")
