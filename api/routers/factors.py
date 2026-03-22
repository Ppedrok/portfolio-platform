"""
routers/factors.py
------------------
Factor exposure endpoint:
  POST /api/factors/exposure  →  betas, alphas, R², t-stats per asset
"""

from __future__ import annotations

import traceback
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from portfolio_engine.data import download_prices, compute_returns

try:
    from portfolio_engine.factors import download_ff_factors, compute_factor_exposure
    _FACTORS_AVAILABLE = True
except ImportError:
    _FACTORS_AVAILABLE = False

router = APIRouter(prefix="/api/factors", tags=["factors"])


# ── Request / Response schemas ─────────────────────────────────────────────────

class FactorExposureRequest(BaseModel):
    tickers: list[str] = Field(..., min_length=1)
    start:   str       = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    end:     str       = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    model:   Literal["FF3", "FF5", "Carhart4"] = "FF3"


class AssetFactorRow(BaseModel):
    ticker:   str
    alpha:    float         # annualised Jensen's alpha
    r2:       float
    betas:    dict[str, float]
    t_stats:  dict[str, float]
    p_values: dict[str, float]


class FactorExposureResponse(BaseModel):
    model:   str
    factors: list[str]
    assets:  list[AssetFactorRow]


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/exposure", response_model=FactorExposureResponse)
def factor_exposure(body: FactorExposureRequest):
    if not _FACTORS_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Factor analysis unavailable: pandas-datareader not installed on this server.",
        )
    try:
        # 1. Download prices → returns
        prices = download_prices(body.tickers, body.start, body.end)
        if prices.empty:
            raise HTTPException(status_code=422, detail="No price data found for given tickers/dates.")
        returns = compute_returns(prices)

        # 2. Download factor returns
        try:
            factors = download_ff_factors(body.model, body.start, body.end)
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"Failed to download Fama-French factors: {e}. "
                       "Check internet connection or try a different date range.",
            )

        if factors.empty:
            raise HTTPException(status_code=422, detail="No factor data for the given date range.")

        # 3. Compute exposures
        exposure = compute_factor_exposure(returns, factors)
        betas    = exposure["betas"]
        alphas   = exposure["alphas"]
        r2       = exposure["r2"]
        tstats   = exposure["t_stats"]
        pvals    = exposure["p_values"]

        factor_names = list(betas.columns)

        assets_out = []
        for ticker in returns.columns:
            if ticker not in betas.index:
                continue
            assets_out.append(AssetFactorRow(
                ticker   = ticker,
                alpha    = float(alphas.get(ticker, 0.0)),
                r2       = float(r2.get(ticker, 0.0)),
                betas    = {f: float(betas.loc[ticker, f]) for f in factor_names},
                t_stats  = {f: float(tstats.loc[ticker, f]) for f in factor_names},
                p_values = {f: float(pvals.loc[ticker, f]) for f in factor_names},
            ))

        return FactorExposureResponse(
            model   = body.model,
            factors = factor_names,
            assets  = assets_out,
        )

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Factor exposure error: {e}")
