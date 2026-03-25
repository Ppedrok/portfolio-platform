"""
routers/backtest.py
-------------------
POST /api/backtest
  → walk-forward backtest with optional equal-weight benchmark
"""

from __future__ import annotations

import math
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException

import numpy as np
from portfolio_engine.data       import download_prices, compute_returns
from portfolio_engine.backtest   import Backtest

from ..schemas.requests  import BacktestRequest
from .optimize           import _build_rp_constraints
from ..schemas.responses import (
    BacktestResponse,
    EquityCurvePoint,
    WeightsRecord,
)

router = APIRouter(prefix="/api", tags=["backtest"])


def _safe(v) -> float | None:
    if v is None:
        return None
    f = float(v)
    return None if (math.isnan(f) or math.isinf(f)) else f


@router.post(
    "/backtest",
    response_model=BacktestResponse,
    summary="Walk-forward portfolio backtest",
)
def run_backtest(body: BacktestRequest):
    """
    Run a walk-forward backtest.

    At each rebalancing point the last `estimation_window` trading days are used
    to estimate μ and Σ and optimise weights; those weights are then applied
    to the next `rebalancing_freq` days out-of-sample.

    An equal-weight portfolio is used as a benchmark.
    """
    if body.start >= body.end:
        raise HTTPException(status_code=422, detail="'start' must be before 'end'")

    # ── Download & validate data ───────────────────────────────────────────────
    try:
        tickers = sorted(set(t.upper() for t in body.tickers))
        prices  = download_prices(tickers, body.start, body.end)
        returns = compute_returns(prices)
        if returns.empty or returns.shape[0] < body.estimation_window + body.rebalancing_freq:
            raise ValueError(
                f"Too few observations ({returns.shape[0]}) for the requested "
                f"estimation_window={body.estimation_window} + rebalancing_freq={body.rebalancing_freq}."
            )
        returns = returns[tickers]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Data download failed: {exc}")

    # ── Equal-weight benchmark ─────────────────────────────────────────────────
    ew_benchmark = returns.mean(axis=1)
    ew_benchmark.name = "Benchmark"

    # ── Optional external benchmark for TE constraint ─────────────────────────
    benchmark_external = None
    max_te_daily: float | None = None
    if body.benchmark_ticker:
        try:
            bm_ticker = body.benchmark_ticker.upper().strip()
            bm_prices  = download_prices([bm_ticker], body.start, body.end)
            bm_returns = compute_returns(bm_prices)[bm_ticker]
            benchmark_external = bm_returns.reindex(returns.index).fillna(0)
            if body.max_tracking_error:
                max_te_daily = float(body.max_tracking_error) / np.sqrt(252)
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Benchmark download failed for '{body.benchmark_ticker}': {exc}",
            )

    # ── Build rp / group constraints ──────────────────────────────────────────
    constraints_df   = None
    asset_classes_df = None
    if body.rp_constraints:
        try:
            constraints_df, asset_classes_df = _build_rp_constraints(
                body.rp_constraints, tickers, body.asset_groups
            )
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid rp_constraints: {exc}",
            )

    # ── Run backtest ───────────────────────────────────────────────────────────
    try:
        bt = Backtest(
            returns=returns,
            estimation_window=body.estimation_window,
            rebalancing_freq=body.rebalancing_freq,
        )
        result = bt.run(
            mu_method=body.mu_method,
            cov_method=body.cov_method,
            opt_method=body.opt_method,
            benchmark=ew_benchmark,
            solver=body.solver,
            benchmark_external=benchmark_external,
            max_te_daily=max_te_daily,
            long_only=body.long_only,
            min_weight=body.constraints.min_weight,
            max_weight=body.constraints.max_weight,
            constraints_df=constraints_df,
            asset_classes_df=asset_classes_df,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Backtest failed: {exc}")

    # ── Build equity curve ─────────────────────────────────────────────────────
    port_eq:       pd.Series       = result["equity_curve"]
    bm_eq:         pd.Series | None = result["benchmark_equity_curve"]
    wh:            pd.DataFrame     = result["weights_history"]
    failed_steps:  int               = result.get("failed_steps", 0)
    step_warnings: list[str]         = result.get("step_warnings", [])

    equity_points: list[EquityCurvePoint] = []
    for date, pv in port_eq.items():
        bv = _safe(float(bm_eq.loc[date])) if (bm_eq is not None and date in bm_eq.index) else None
        equity_points.append(EquityCurvePoint(
            date=date.strftime("%Y-%m-%d"),
            portfolio_value=round(float(pv), 6),
            benchmark_value=bv,
        ))

    # ── Build weights history ──────────────────────────────────────────────────
    weights_records: list[WeightsRecord] = []
    for date, row in wh.iterrows():
        weights_records.append(WeightsRecord(
            date=date.strftime("%Y-%m-%d"),
            weights={t: round(float(w), 6) for t, w in row.items()},
        ))

    # ── Performance metrics ────────────────────────────────────────────────────
    try:
        metrics_df = bt.performance_metrics()
        metrics_out: dict = {}
        for metric_name, series in metrics_df.iterrows():
            metrics_out[str(metric_name)] = {
                col: _safe(v) for col, v in series.items()
            }
    except Exception:
        metrics_out = {}

    oos_start = port_eq.index[0].strftime("%Y-%m-%d")
    oos_end   = port_eq.index[-1].strftime("%Y-%m-%d")

    return BacktestResponse(
        tickers=tickers,
        oos_start=oos_start,
        oos_end=oos_end,
        rebalancing_steps=len(wh),
        equity_curve=equity_points,
        weights_history=weights_records,
        metrics=metrics_out,
        failed_steps=failed_steps,
        opt_warnings=step_warnings[:20],   # cap at 20 to avoid huge payloads
    )
