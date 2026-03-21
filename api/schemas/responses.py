"""
schemas/responses.py
--------------------
Pydantic v2 response models for every API endpoint.
"""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


# ── /health ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status:  str = "ok"
    version: str


# ── /api/assets/search ────────────────────────────────────────────────────────

class TickerMatch(BaseModel):
    ticker:      str
    name:        str        = ""
    exchange:    str        = ""
    asset_type:  str        = ""


class SearchResponse(BaseModel):
    query:   str
    results: list[TickerMatch]


# ── /api/assets/prices ────────────────────────────────────────────────────────

class PricesResponse(BaseModel):
    tickers:  list[str]
    dates:    list[str]                        = Field(description="ISO-8601 dates")
    prices:   dict[str, list[float | None]]    = Field(description="ticker → price series")


# ── /api/optimize (single portfolio) ─────────────────────────────────────────

class PortfolioMetrics(BaseModel):
    annualized_return:     float | None
    annualized_volatility: float | None
    sharpe_ratio:          float | None
    sortino_ratio:         float | None
    max_drawdown:          float | None
    calmar_ratio:          float | None
    var_95:                float | None
    cvar_95:               float | None
    win_rate:              float | None


class OptimizeResponse(BaseModel):
    tickers:   list[str]
    weights:   dict[str, float]          = Field(description="ticker → optimal weight")
    metrics:   PortfolioMetrics


# ── /api/optimize (efficient frontier) ───────────────────────────────────────

class FrontierPoint(BaseModel):
    portfolio_id:          int
    weights:               dict[str, float]
    expected_return:       float | None
    expected_volatility:   float | None


class FrontierResponse(BaseModel):
    tickers:   list[str]
    portfolios: list[FrontierPoint]


# ── /api/backtest ─────────────────────────────────────────────────────────────

class EquityCurvePoint(BaseModel):
    date:             str
    portfolio_value:  float
    benchmark_value:  float | None = None


class WeightsRecord(BaseModel):
    date:    str
    weights: dict[str, float]


class BacktestResponse(BaseModel):
    tickers:          list[str]
    oos_start:        str
    oos_end:          str
    rebalancing_steps: int
    equity_curve:     list[EquityCurvePoint]
    weights_history:  list[WeightsRecord]
    metrics:          dict[str, Any]          = Field(
        description="Performance metrics dict; keys = metric names, values = Portfolio/Benchmark"
    )
