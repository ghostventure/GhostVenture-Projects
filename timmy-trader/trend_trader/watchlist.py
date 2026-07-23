from __future__ import annotations

from pathlib import Path

from .models import Signal

DEFAULT_WATCHLIST = ("SPY", "QQQ", "IWM", "DIA", "AAPL", "MSFT", "NVDA", "AMD", "TSLA")
DEFAULT_ROTATION_CANDIDATES = (
    "SPY", "QQQ", "IWM", "DIA", "AAPL", "MSFT", "NVDA", "AMD", "TSLA",
    "META", "GOOGL", "AMZN", "AVGO", "NFLX", "COST", "JPM", "XOM", "UNH", "LLY",
    "ORCL", "CRM", "ADBE", "INTC", "MU", "SMH", "XLK", "XLF", "XLE", "VTI",
)
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


def write_watchlist(path: str | Path, symbols: list[str] | tuple[str, ...]) -> None:
    target = Path(path).expanduser()
    target.parent.mkdir(parents=True, exist_ok=True)
    clean = sorted(dict.fromkeys(symbol.strip().upper() for symbol in symbols if symbol.strip()))
    target.write_text("\n".join(clean) + "\n", encoding="utf-8")


def write_watchlist_template(path: str | Path, template: str = "equity") -> None:
    symbols = WATCHLIST_TEMPLATES.get(template)
    if symbols is None:
        raise ValueError(f"Unknown watchlist template: {template}")
    target = Path(path).expanduser()
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        return
    target.write_text("\n".join(symbols) + "\n", encoding="utf-8")


def rotate_watchlist(
    current_symbols: list[str],
    signals: list[Signal],
    candidate_symbols: set[str] | None = None,
    max_symbols: int = 12,
    min_scout_score: int = 42,
    quiet_scout_score: int = 30,
) -> list[str]:
    current = [symbol.upper() for symbol in current_symbols]
    candidates = {symbol.upper() for symbol in (candidate_symbols or set())}
    score_by_symbol = {signal.symbol.upper(): signal for signal in signals}
    keep: list[str] = []
    for symbol in current:
        signal = score_by_symbol.get(symbol)
        if signal is None or signal.scout_score >= quiet_scout_score or signal.sensible_action == "trade":
            keep.append(symbol)

    ranked_candidates = sorted(
        (
            signal
            for signal in signals
            if signal.symbol.upper() in candidates | set(current)
            and signal.scout_score >= min_scout_score
        ),
        key=lambda signal: (signal.scout_score, signal.sensible_score, signal.score),
        reverse=True,
    )
    for signal in ranked_candidates:
        symbol = signal.symbol.upper()
        if symbol not in keep:
            keep.append(symbol)
        if len(keep) >= max(1, max_symbols):
            break

    if not keep:
        keep = current[: max(1, max_symbols)]
    return sorted(dict.fromkeys(keep[: max(1, max_symbols)]))
