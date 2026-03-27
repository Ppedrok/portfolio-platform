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
    sector:      str        = ""


class SearchResponse(BaseModel):
    query:   str
    results: list[TickerMatch]


# ── /api/assets/prices ────────────────────────────────────────────────────────

class PricesResponse(BaseModel):
    tickers:  list[str]
    dates:    list[str]                        = Field(description="ISO-8601 dates")
    prices:   dict[str, list[float | None]]    = Field(description="ticker → price series")


# ── /api/assets/overview ──────────────────────────────────────────────────────

class OverviewResponse(BaseModel):
    tickers:            list[str]
    method:             str
    codependence:       dict[str, dict[str, float]]
    distance:           dict[str, dict[str, float]]
    annualized_returns: dict[str, float | None]
    annualized_vols:    dict[str, float | None]
    sharpes:            dict[str, float | None]
    sortinos:           dict[str, float | None]  = {}
    calmars:            dict[str, float | None]  = {}
    max_drawdowns:      dict[str, float | None]  = {}
    vars_95:            dict[str, float | None]  = {}
    cvars_95:           dict[str, float | None]  = {}
    skews:              dict[str, float | None]  = {}
    kurts:              dict[str, float | None]  = {}
    win_rates:          dict[str, float | None]  = {}
    period_returns:     dict[str, dict[str, float | None]] = {}
    dendrogram:         dict                               = Field(default_factory=dict)


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
    tickers:            list[str]
    weights:            dict[str, float]   = Field(description="ticker → optimal weight")
    metrics:            PortfolioMetrics
    risk_decomposition: dict | None        = None
    warning:            str | None         = None
    tracking_error:     float | None       = None


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
    failed_steps:     int                     = 0
    opt_warnings:     list[str]               = Field(default_factory=list)
    benchmark_label:  str                     = "Equal Weight"
