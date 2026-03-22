"""
schemas/requests.py
-------------------
Pydantic v2 request models for every API endpoint.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

CodependenceMethod = Literal[
    "pearson", "spearman", "kendall", "gerber2",
    "distance", "mutual_info", "tail",
]
from pydantic import BaseModel, Field, field_validator


# ── /api/assets/prices ────────────────────────────────────────────────────────

class PricesRequest(BaseModel):
    tickers: list[str] = Field(..., min_length=1, description="List of ticker symbols")
    start:   str       = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Start date YYYY-MM-DD")
    end:     str       = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="End date YYYY-MM-DD")

    model_config = {"json_schema_extra": {
        "example": {
            "tickers": ["AAPL", "MSFT", "GOOGL"],
            "start": "2022-01-01",
            "end": "2024-01-01",
        }
    }}


# ── /api/optimize ─────────────────────────────────────────────────────────────

MuMethod = Literal[
    "historical",
    "JS_1", "JS_2", "JS_3",
    "BS_1", "BS_2", "BS_3",
    "BOP_1", "BOP_2", "BOP_3",
    "BL_standard", "BL_augmented", "BL_bayes",
    # Fama-French / Carhart factor models
    "FF3_mu", "FF5_mu", "Carhart4_mu",
]

CovMethod = Literal[
    "historical",
    "ledoit_wolf",
    "oas",
    "shrunk",
    "denoised_fixed",
    "spectral",
    "targeted_shrink",
    "detoning",
    "graph_lasso",
    "jlogo",
    # Fama-French / Carhart factor models
    "FF3_cov", "FF5_cov", "Carhart4_cov",
]

OptMethod = Literal[
    "markowitz",
    "GMD", "MAD", "SMAD",
    "Brownian",
    "SemiVariance",
    "LowerPartialMoments",
    "CVaR", "EVaR",
    "Ulcer",
]


class WeightConstraints(BaseModel):
    max_weight: Annotated[float, Field(ge=0.0, le=1.0)] = 1.0
    min_weight: Annotated[float, Field(ge=0.0, le=1.0)] = 0.0

    @field_validator("min_weight")
    @classmethod
    def min_le_max(cls, v: float, info) -> float:
        max_w = info.data.get("max_weight", 1.0)
        if v > max_w:
            raise ValueError("min_weight must be <= max_weight")
        return v


class OptimizeRequest(BaseModel):
    tickers:        list[str]              = Field(..., min_length=2)
    start:          str                    = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    end:            str                    = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    mu_method:      MuMethod               = "historical"
    cov_method:     CovMethod              = "ledoit_wolf"
    opt_method:     OptMethod              = "CVaR"
    target_return:  Union[float, Literal["frontier"], None] = None
    constraints:    WeightConstraints      = Field(default_factory=WeightConstraints)
    rp_constraints: Union[list[dict], None] = None
    asset_groups:   Union[list[dict], None] = None
    long_only:      bool                   = True
    solver:         str                    = "CLARABEL"

    model_config = {"json_schema_extra": {
        "example": {
            "tickers": ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"],
            "start": "2021-01-01",
            "end": "2024-01-01",
            "mu_method": "historical",
            "cov_method": "ledoit_wolf",
            "opt_method": "CVaR",
            "target_return": None,
            "constraints": {"max_weight": 0.4, "min_weight": 0.0},
        }
    }}


# ── /api/assets/overview ──────────────────────────────────────────────────────

class OverviewRequest(BaseModel):
    tickers: list[str] = Field(..., min_length=2)
    start:   str       = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    end:     str       = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    method:  str       = "pearson"


# ── /api/backtest ─────────────────────────────────────────────────────────────

class BacktestRequest(BaseModel):
    tickers:           list[str]  = Field(..., min_length=2)
    start:             str        = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    end:               str        = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    mu_method:         MuMethod   = "historical"
    cov_method:        CovMethod  = "ledoit_wolf"
    opt_method:        OptMethod  = "CVaR"
    estimation_window: Annotated[int, Field(ge=30, le=1260)] = 252
    rebalancing_freq:  Annotated[int, Field(ge=1,  le=252)]  = 21
    solver:            str        = "CLARABEL"

    model_config = {"json_schema_extra": {
        "example": {
            "tickers": ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"],
            "start": "2020-01-01",
            "end": "2024-01-01",
            "mu_method": "historical",
            "cov_method": "ledoit_wolf",
            "opt_method": "CVaR",
            "estimation_window": 252,
            "rebalancing_freq": 21,
        }
    }}
