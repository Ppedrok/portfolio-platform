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


@router.post("/overview", response_model=OverviewResponse, summary="Asset codependence overview")
def get_overview(body: OverviewRequest) -> OverviewResponse:
    """
    Compute pairwise codependence/distance matrices plus per-asset statistics
    (annualised return, volatility, Sharpe) for the requested ticker universe.
    """
    if body.start >= body.end:
        raise HTTPException(status_code=422, detail="'start' must be before 'end'")

    try:
        tickers = sorted(set(t.upper() for t in body.tickers))
        prices  = download_prices(tickers, body.start, body.end)
        returns = compute_returns(prices)
        if returns.empty or returns.shape[0] < 30:
            raise ValueError("Too few observations (<30) after computing returns.")
        returns = returns[tickers]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Data download failed: {exc}")

    try:
        codep_df, dist_df = rp.codep_dist(
            returns=returns,
            codependence=body.method,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Codependence computation failed ({body.method}): {exc}",
        )

    def _df_to_dict(df) -> dict[str, dict[str, float]]:
        out: dict[str, dict[str, float]] = {}
        for row in df.index:
            out[str(row)] = {
                str(col): (_safe_f(df.loc[row, col]) or 0.0)
                for col in df.columns
            }
        return out

    # ── Per-asset stats ───────────────────────────────────────────────────────
    ann_returns: dict[str, float | None] = {}
    ann_vols:    dict[str, float | None] = {}
    sharpes:     dict[str, float | None] = {}

    for t in tickers:
        r       = returns[t].dropna()
        ann_ret = _safe_f((1 + r.mean()) ** 252 - 1)
        ann_vol = _safe_f(r.std() * np.sqrt(252))
        ann_returns[t] = ann_ret
        ann_vols[t]    = ann_vol
        if ann_ret is not None and ann_vol is not None and ann_vol > 0:
            sharpes[t] = _safe_f(ann_ret / ann_vol)
        else:
            sharpes[t] = None

    return OverviewResponse(
        tickers=tickers,
        method=body.method,
        codependence=_df_to_dict(codep_df),
        distance=_df_to_dict(dist_df),
        annualized_returns=ann_returns,
        annualized_vols=ann_vols,
        sharpes=sharpes,
    )


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
