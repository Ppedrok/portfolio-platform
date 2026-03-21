"""
routers/assets.py
-----------------
GET  /api/assets/search   – fuzzy ticker search
POST /api/assets/prices   – historical adjusted-close prices
"""

from __future__ import annotations

import math
from typing import Annotated

import numpy as np
import riskfolio as rp
import yfinance as yf
from fastapi import APIRouter, HTTPException, Query

from portfolio_engine.data import download_prices, compute_returns

from ..schemas.requests  import OverviewRequest, PricesRequest
from ..schemas.responses import OverviewResponse, PricesResponse, SearchResponse, TickerMatch

router = APIRouter(prefix="/api/assets", tags=["assets"])


# ── Static ticker catalogue (subset; extend as needed) ────────────────────────
# Maps ticker → (display name, exchange, asset_type)
_CATALOGUE: dict[str, tuple[str, str, str]] = {
    # US Equities
    "AAPL":    ("Apple Inc.",                        "NASDAQ", "Equity"),
    "MSFT":    ("Microsoft Corp.",                   "NASDAQ", "Equity"),
    "GOOGL":   ("Alphabet Inc.",                     "NASDAQ", "Equity"),
    "AMZN":    ("Amazon.com Inc.",                   "NASDAQ", "Equity"),
    "NVDA":    ("NVIDIA Corp.",                      "NASDAQ", "Equity"),
    "TSLA":    ("Tesla Inc.",                        "NASDAQ", "Equity"),
    "META":    ("Meta Platforms Inc.",               "NASDAQ", "Equity"),
    "AMD":     ("Advanced Micro Devices",            "NASDAQ", "Equity"),
    "AVGO":    ("Broadcom Inc.",                     "NASDAQ", "Equity"),
    "ASML":    ("ASML Holding NV",                   "NASDAQ", "Equity"),
    "TSM":     ("Taiwan Semiconductor",              "NYSE",   "Equity"),
    "V":       ("Visa Inc.",                         "NYSE",   "Equity"),
    "JNJ":     ("Johnson & Johnson",                 "NYSE",   "Equity"),
    "PG":      ("Procter & Gamble",                  "NYSE",   "Equity"),
    "XOM":     ("Exxon Mobil Corp.",                 "NYSE",   "Equity"),
    "CAT":     ("Caterpillar Inc.",                  "NYSE",   "Equity"),
    "LIN":     ("Linde plc",                         "NYSE",   "Equity"),
    "PEP":     ("PepsiCo Inc.",                      "NASDAQ", "Equity"),
    "BMY":     ("Bristol-Myers Squibb",              "NYSE",   "Equity"),
    # European Equities
    "ISP.MI":  ("Intesa Sanpaolo",                   "MIL",    "Equity"),
    "ENEL.MI": ("Enel SpA",                          "MIL",    "Equity"),
    "UCG.MI":  ("UniCredit SpA",                     "MIL",    "Equity"),
    "ENI.MI":  ("Eni SpA",                           "MIL",    "Equity"),
    "RACE.MI": ("Ferrari NV",                        "MIL",    "Equity"),
    "NOVN.SW": ("Novartis AG",                       "SWX",    "Equity"),
    "NESN.SW": ("Nestle SA",                         "SWX",    "Equity"),
    "SAP.DE":  ("SAP SE",                            "XETRA",  "Equity"),
    "SIE.DE":  ("Siemens AG",                        "XETRA",  "Equity"),
    "PPFB.DE": ("Porsche AG",                        "XETRA",  "Equity"),
    # Factor ETFs
    "MTUM":    ("iShares MSCI USA Momentum",         "NASDAQ", "ETF"),
    "QUAL":    ("iShares MSCI USA Quality",          "NASDAQ", "ETF"),
    "SIZE":    ("iShares MSCI USA Size",             "NASDAQ", "ETF"),
    "USMV":    ("iShares MSCI USA Min Vol",          "NASDAQ", "ETF"),
    "VLUE":    ("iShares MSCI USA Value",            "NASDAQ", "ETF"),
    # Fixed Income / Macro ETFs
    "TLT":     ("iShares 20+ Year Treasury",         "NASDAQ", "ETF"),
    "GLD":     ("SPDR Gold Shares",                  "NYSE",   "ETF"),
    "SPY":     ("SPDR S&P 500 ETF",                  "NYSE",   "ETF"),
    "QQQ":     ("Invesco QQQ Trust",                 "NASDAQ", "ETF"),
    "IWM":     ("iShares Russell 2000",              "NYSE",   "ETF"),
}


def _score(ticker: str, name: str, query: str) -> int:
    """Simple priority score: exact > prefix > substring (case-insensitive)."""
    q = query.upper()
    t = ticker.upper()
    n = name.upper()
    if t == q:
        return 3
    if t.startswith(q) or n.startswith(q):
        return 2
    if q in t or q in n:
        return 1
    return 0


# ── Search endpoint ───────────────────────────────────────────────────────────

@router.get("/search", response_model=SearchResponse, summary="Search tickers")
def search_tickers(
    query: Annotated[str, Query(min_length=1, max_length=20, description="Partial ticker or name")]
) -> SearchResponse:
    """
    Return tickers from the built-in catalogue that match *query*.

    Matching is case-insensitive and checks both ticker symbol and company name.
    Results are ranked: exact match > prefix match > substring match.
    """
    matches: list[tuple[int, TickerMatch]] = []

    for ticker, (name, exchange, asset_type) in _CATALOGUE.items():
        score = _score(ticker, name, query)
        if score > 0:
            matches.append((score, TickerMatch(
                ticker=ticker, name=name,
                exchange=exchange, asset_type=asset_type,
            )))

    matches.sort(key=lambda x: -x[0])
    return SearchResponse(query=query, results=[m for _, m in matches])


# ── Overview endpoint ─────────────────────────────────────────────────────────

def _safe_f(v) -> float | None:
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 6)
    except Exception:
        return None


@router.post("/overview", summary="Asset codependence overview")
def get_overview(body: OverviewRequest):
    try:
        tickers = sorted(set(t.upper() for t in body.tickers))
        prices  = download_prices(tickers, body.start, body.end)
        returns = compute_returns(prices)[tickers]

        kwargs: dict = {"codependence": body.method}
        if body.method == "mutual_info":
            kwargs["bins_info"] = "KN"
        elif body.method == "tail":
            kwargs["alpha_tail"] = 0.05
        elif body.method in ("gerber1", "gerber2"):
            kwargs["gs_threshold"] = 0.5

        codep, dist = rp.codep_dist(returns, **kwargs)

        ann_ret, ann_vol, sharpes = {}, {}, {}
        for t in tickers:
            s = returns[t]
            r = float((1 + s).prod() ** (252 / len(s)) - 1)
            v = float(s.std() * np.sqrt(252))
            ann_ret[t] = round(r, 6)
            ann_vol[t] = round(v, 6)
            sharpes[t] = round(r / v if v > 0 else 0, 4)

        return {
            "tickers":            tickers,
            "method":             body.method,
            "codependence":       codep.round(6).to_dict(),
            "distance":           dist.round(6).to_dict(),
            "annualized_returns": ann_ret,
            "annualized_vols":    ann_vol,
            "sharpes":            sharpes,
        }
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Prices endpoint ───────────────────────────────────────────────────────────

@router.post("/prices", response_model=PricesResponse, summary="Fetch historical prices")
def get_prices(body: PricesRequest) -> PricesResponse:
    """
    Download adjusted-close prices from Yahoo Finance for the requested tickers
    and date range.

    Returns dates as ISO-8601 strings and prices as parallel lists per ticker.
    Missing values are represented as `null`.
    """
    if body.start >= body.end:
        raise HTTPException(status_code=422, detail="'start' must be before 'end'")

    try:
        tickers = sorted(set(t.upper() for t in body.tickers))
        raw = yf.download(
            tickers, start=body.start, end=body.end,
            auto_adjust=False, progress=False,
        )
        if raw.empty:
            raise HTTPException(
                status_code=422,
                detail="No price data returned. Check tickers and date range.",
            )

        prices = raw.loc[:, ("Adj Close", slice(None))].copy()
        prices.columns = tickers

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Price download failed: {exc}")

    dates = [d.strftime("%Y-%m-%d") for d in prices.index]
    price_dict: dict[str, list[float | None]] = {}
    for t in tickers:
        if t in prices.columns:
            price_dict[t] = [
                None if math.isnan(v) else round(float(v), 4)
                for v in prices[t].tolist()
            ]
        else:
            price_dict[t] = [None] * len(dates)

    return PricesResponse(tickers=tickers, dates=dates, prices=price_dict)
