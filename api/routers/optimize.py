"""
routers/optimize.py
-------------------
POST /api/optimize
  → single optimal portfolio  (target_return is None or a float)
  → efficient frontier        (target_return == "frontier")
"""

from __future__ import annotations

import concurrent.futures
import math
import warnings
import numpy as np
import pandas as pd
import cvxpy as cp
import riskfolio as rp
from scipy.linalg import sqrtm as matrix_sqrt
from fastapi import APIRouter, HTTPException

from portfolio_engine.data       import download_prices, compute_returns
from portfolio_engine.optimizer  import Optimizer
from portfolio_engine.parameters import Portfolio
from portfolio_engine.utils      import compute_metrics

from ..schemas.requests  import OptimizeRequest
from ..schemas.responses import (
    FrontierPoint,
    FrontierResponse,
    OptimizeResponse,
    PortfolioMetrics,
)

router = APIRouter(prefix="/api", tags=["optimize"])


def _safe(v) -> float | None:
    if v is None:
        return None
    f = float(v)
    return None if (math.isnan(f) or math.isinf(f)) else f


def _download_returns(body: OptimizeRequest) -> pd.DataFrame:
    if body.start >= body.end:
        raise HTTPException(status_code=422, detail="'start' must be before 'end'")
    try:
        tickers = sorted(set(t.upper() for t in body.tickers))
        prices  = download_prices(tickers, body.start, body.end)
        returns = compute_returns(prices)
        if returns.empty or returns.shape[0] < 30:
            raise ValueError("Too few observations (<30) after computing returns.")
        return returns[tickers]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Data download failed: {exc}")


def _build_params(returns: pd.DataFrame, body: OptimizeRequest) -> tuple:
    try:
        port = Portfolio(returns, date_range=(body.start, body.end))

        # Build P/Q matrices from bl_views when a BL mu method is selected
        mu_kwargs: dict = {}
        if body.mu_method.startswith("BL") and body.bl_views:
            tickers_list = returns.columns.to_list()
            n = len(tickers_list)
            valid_views = [v for v in body.bl_views if v.get("asset", "") in tickers_list]
            if valid_views:
                k = len(valid_views)
                P = np.zeros((k, n))
                Q = np.zeros((k, 1))
                for i, view in enumerate(valid_views):
                    j = tickers_list.index(view["asset"])
                    # Convert annual % to daily return
                    daily_ret = float(view.get("value", 0)) / 100.0 / 252.0
                    P[i, j] = 1.0
                    Q[i, 0] = daily_ret
                mu_kwargs = {"P": P, "Q": Q}

        port.estimate_mu(method=body.mu_method, **mu_kwargs)
        port.estimate_cov_matrix(method=body.cov_method)
        return np.array(port.mu).flatten(), np.array(port.cov_matrix)
    except Exception as exc:
        raise HTTPException(
            status_code=422, detail=f"Parameter estimation failed: {exc}"
        )


def _build_rp_constraints(
    rp_constraints_list: list[dict],
    tickers: list[str],
    asset_groups: "list[dict] | None" = None,
) -> tuple["pd.DataFrame | None", "pd.DataFrame | None"]:
    """Convert the API list[dict] into the DataFrame expected by rp.assets_constraints."""
    rows = []
    for c in rp_constraints_list:
        w = c.get("weight", "")
        f = c.get("factor", "")
        rows.append({
            "Disabled":      c.get("disabled", False),
            "Type":          c.get("type", "Assets"),
            "Set":           c.get("set", ""),
            "Position":      c.get("position", ""),
            "Sign":          c.get("sign", ">="),
            "Weight":        float(w) if w not in ("", None) else "",
            "Type Relative": c.get("type_relative", ""),
            "Relative Set":  c.get("relative_set", ""),
            "Relative":      c.get("relative", ""),
            "Factor":        float(f) if f not in ("", None) else "",
        })
    if not rows:
        return None, None
    constraints_df   = pd.DataFrame(rows)
    constraints_df   = constraints_df[constraints_df["Disabled"] == False].reset_index(drop=True)
    if constraints_df.empty:
        return None, None
    mask_assets = constraints_df["Type"] == "Assets"
    invalid     = constraints_df.loc[mask_assets, "Position"].isin(["", None])
    if invalid.any():
        raise HTTPException(
            status_code=422,
            detail="Constraint error: 'Assets' type requires a valid ticker in Position.",
        )

    # Collect all unique Set values used in 'Classes' constraints
    class_sets = set(
        constraints_df.loc[constraints_df["Type"] == "Classes", "Set"].dropna().unique()
    )

    # Build asset_classes_df: always start with Assets column
    asset_classes_df = pd.DataFrame({"Assets": tickers})

    # Add a 'Group' column whenever it's referenced OR when asset_groups are provided
    groups_provided = asset_groups and len(asset_groups) > 0
    if groups_provided or "Group" in class_sets:
        asset_classes_df["Group"] = [
            next(
                (g["name"] for g in (asset_groups or []) if t in g.get("tickers", [])),
                "Other"
            )
            for t in tickers
        ]

    # Validate: every Class constraint Set must exist as a column
    missing_cols = class_sets - set(asset_classes_df.columns)
    if missing_cols:
        raise HTTPException(
            status_code=422,
            detail=f"Constraint error: group column(s) {missing_cols} not found in asset_classes. "
                   "Make sure you have defined asset groups for every class constraint.",
        )

    # Validate: every Class constraint Position must match a value in the referenced column
    for _, row in constraints_df[constraints_df["Type"] == "Classes"].iterrows():
        col = row["Set"]
        pos = row["Position"]
        if col and col in asset_classes_df.columns:
            valid_values = set(asset_classes_df[col].unique())
            if pos not in valid_values:
                raise HTTPException(
                    status_code=422,
                    detail=f"Constraint error: group '{pos}' not found in column '{col}'. "
                           f"Available values: {sorted(valid_values)}",
                )

    return constraints_df, asset_classes_df


_HEAVY_METHOD_MAX_T: dict[str, int] = {
    "GMD":      63,
    "Brownian": 63,
}
_SOLVER_TIMEOUT_S = 25


def _solve_single(
    method: str,
    mu_vec: np.ndarray,
    cov: np.ndarray,
    R: np.ndarray,
    lo: float,
    hi: float,
    target_return,
    solver: str,
    constraints_df: "pd.DataFrame | None" = None,
    asset_classes_df: "pd.DataFrame | None" = None,
) -> tuple[np.ndarray | None, str | None]:
    """
    Build and solve the full CVXPY problem for the given method.
    Box constraints [lo, hi] and an optional return floor are added to every
    problem uniformly.

    Returns (weights, warning) where warning is set if T was capped.
    """
    T, n = R.shape

    # ── Cap sample size for compute-heavy methods ─────────────────────────────
    solve_warning: str | None = None
    max_t = _HEAVY_METHOD_MAX_T.get(method)
    if max_t and T > max_t:
        R = R[-max_t:]
        T = max_t
        solve_warning = (
            f"{method} was run on the last {max_t} observations to limit compute time. "
            "For full-sample results, run the platform locally."
        )

    # ── Define the decision variable ─────────────────────────────────────────
    x = cp.Variable((n, 1))
    base_constraints = [cp.sum(x) == 1, x >= lo, x <= hi]

    if target_return is not None and target_return != "frontier":
        base_constraints.append(mu_vec @ x >= float(target_return))

    # ── Risk expression + auxiliary variables per method ─────────────────────
    aux_constraints: list = []

    if method == "markowitz":
        risk = cp.quad_form(x, cov)

    elif method == "GMD":
        D = np.empty((0, n))
        for j in range(T - 1):
            D = np.vstack([D, R[j + 1:] - R[j, :]])
        d    = cp.Variable((int(T * (T - 1) / 2), 1))
        risk = cp.sum(d) / ((T - 1) * T)
        aux_constraints = [d >= D @ x, d >= -(D @ x)]

    elif method == "MAD":
        C_T  = np.eye(T) - np.ones((T, T)) / T
        d    = cp.Variable((T, 1))
        risk = cp.sum(d) / T
        aux_constraints = [d >= C_T @ R @ x, d >= -(C_T @ R @ x), d >= 0]

    elif method == "SMAD":
        C_T  = np.eye(T) - np.ones((T, T)) / T
        d    = cp.Variable((T, 1))
        risk = cp.sum(d) / T
        aux_constraints = [d >= -(C_T @ R @ x), d >= 0]

    elif method == "Brownian":
        ones = np.ones((T, 1))
        D    = cp.Variable((T, T), symmetric=True)
        y    = R @ x
        risk = cp.sum_squares(D) / T ** 2 + cp.sum(D) ** 2 / T ** 4
        aux_constraints = [
            D >= y @ ones.T - ones @ y.T,
            D >= -(y @ ones.T - ones @ y.T),
        ]

    elif method == "SemiVariance":
        C_T  = np.eye(T) - np.ones((T, T)) / T
        d    = cp.Variable((T, 1))
        risk = cp.sum_squares(d) / T
        aux_constraints = [d >= -(C_T @ R @ x), d >= 0]

    elif method == "LowerPartialMoments":
        tau  = 0.03 / 252
        d    = cp.Variable((T, 1))
        risk = cp.sum(d) / T
        aux_constraints = [d >= tau - R @ x, d >= 0]

    elif method == "CVaR":
        alpha = 0.05
        t     = cp.Variable()
        u     = cp.Variable((T, 1))
        risk  = t + 1 / (alpha * T) * cp.sum(u)
        aux_constraints = [u >= -R @ x - t, u >= 0]

    elif method == "EVaR":
        alpha = 0.05
        ones  = np.ones((T, 1))
        t     = cp.Variable((1, 1))
        z     = cp.Variable((1, 1), nonneg=True)
        u     = cp.Variable((T, 1))
        risk  = t + z * np.log(1 / (alpha * T))
        aux_constraints = [cp.sum(u) <= z, cp.ExpCone(-R @ x - t, ones @ z, u)]

    elif method == "Ulcer":
        d    = cp.Variable((T + 1, 1))
        risk = cp.norm(d[1:]) / T ** 0.5
        aux_constraints = [
            d[1:] >= d[:-1] - R @ x,
            d[1:] >= 0,
            d[0]  == 0,
        ]

    else:
        raise ValueError(f"Unknown optimisation method: '{method}'")

    # ── Optional riskfolio linear constraints (A @ x <= b) ───────────────────
    if constraints_df is not None:
        A, b = rp.assets_constraints(constraints_df, asset_classes_df)
        A = np.array(A)
        b = np.array(b)
        aux_constraints.append(A @ x <= b)

    prob = cp.Problem(
        cp.Minimize(risk),
        base_constraints + aux_constraints,
    )

    def _run_solve():
        prob.solve(solver=solver, max_iters=2000, eps_abs=1e-5, eps_rel=1e-5)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        future = ex.submit(_run_solve)
        try:
            future.result(timeout=_SOLVER_TIMEOUT_S)
        except concurrent.futures.TimeoutError:
            raise HTTPException(
                status_code=408,
                detail=(
                    f"Optimisation timed out (>{_SOLVER_TIMEOUT_S}s). "
                    "Try a shorter date range or a lighter method such as CVaR."
                ),
            )

    return x.value, solve_warning


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post(
    "/optimize",
    summary="Optimise portfolio weights",
)
def optimize(body: OptimizeRequest):
    """
    Optimise portfolio weights for the requested risk measure.

    **Single portfolio** (`target_return` is `null` or a `float`):
    Returns optimal weights and in-sample performance metrics.

    **Efficient frontier** (`target_return == "frontier"`):
    Returns 40 portfolios spanning from minimum risk to maximum expected return.

    Box constraints (`min_weight` / `max_weight`) are enforced in both modes.
    """
    returns = _download_returns(body)
    tickers = returns.columns.to_list()
    mu_vec, cov = _build_params(returns, body)
    R  = returns.to_numpy()
    lo = body.constraints.min_weight if body.long_only else -1.0
    hi = body.constraints.max_weight

    constraints_df, asset_classes_df = (
        _build_rp_constraints(body.rp_constraints, tickers, body.asset_groups)
        if body.rp_constraints
        else (None, None)
    )

    # ── Efficient frontier ────────────────────────────────────────────────────
    if body.target_return == "frontier":
        Sigma_sqrt = matrix_sqrt(cov)
        x      = cp.Variable((len(tickers), 1))
        g      = cp.Variable(nonneg=True)
        mu_bar = cp.Parameter()

        constraints = [
            cp.SOC(g, Sigma_sqrt @ x),
            mu_vec @ x >= mu_bar,
            cp.sum(x) == 1,
            x >= lo,
            x <= hi,
        ]
        prob = cp.Problem(cp.Minimize(g), constraints)

        portfolios: list[FrontierPoint] = []
        for idx, target in enumerate(
            np.linspace(float(mu_vec.min()), float(mu_vec.max()), 40)
        ):
            mu_bar.value = target
            try:
                prob.solve(solver=body.solver)
                w_col = x.value
            except Exception:
                w_col = None

            if w_col is None or np.any(np.isnan(w_col)):
                continue

            w_arr   = np.clip(w_col.flatten(), 0, None)
            w_arr  /= max(w_arr.sum(), 1e-8)
            exp_ret = _safe(float(mu_vec @ w_arr) * 252)
            exp_vol = _safe(float(np.sqrt(w_arr @ cov @ w_arr)) * np.sqrt(252))

            portfolios.append(FrontierPoint(
                portfolio_id=idx,
                weights={t: round(float(w), 6) for t, w in zip(tickers, w_arr)},
                expected_return=exp_ret,
                expected_volatility=exp_vol,
            ))

        if not portfolios:
            raise HTTPException(
                status_code=422,
                detail="Could not compute any frontier portfolio. "
                "Try relaxing constraints or switching solver.",
            )
        return FrontierResponse(tickers=tickers, portfolios=portfolios)

    # ── Single portfolio ──────────────────────────────────────────────────────
    try:
        w_raw, solve_warning = _solve_single(
            method=body.opt_method,
            mu_vec=mu_vec,
            cov=cov,
            R=R,
            lo=lo,
            hi=hi,
            target_return=body.target_return,
            solver=body.solver,
            constraints_df=constraints_df,
            asset_classes_df=asset_classes_df,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Optimisation failed: {exc}")

    if w_raw is None:
        raise HTTPException(
            status_code=422,
            detail="Solver returned no solution. Try relaxing constraints or changing the solver.",
        )

    w_arr = np.clip(np.array(w_raw).flatten(), 0, None)
    total = w_arr.sum()
    if total < 1e-8:
        raise HTTPException(status_code=422, detail="Degenerate solution (all-zero weights).")
    w_arr /= total

    port_rets = pd.Series(R @ w_arr, index=returns.index)
    m = compute_metrics(port_rets, "Portfolio")

    opt = Optimizer(mu=mu_vec, covar_matrix=cov, corr=None, dist=None, R=R, assets=tickers)
    try:
        risk_decomp = opt.risk_decomposition(w_arr, R)
    except Exception:
        risk_decomp = None

    return OptimizeResponse(
        tickers=tickers,
        weights={t: round(float(w), 6) for t, w in zip(tickers, w_arr)},
        metrics=PortfolioMetrics(
            annualized_return     = _safe(m["Annualized Return"]),
            annualized_volatility = _safe(m["Annualized Volatility"]),
            sharpe_ratio          = _safe(m["Sharpe Ratio"]),
            sortino_ratio         = _safe(m["Sortino Ratio"]),
            max_drawdown          = _safe(m["Max Drawdown"]),
            calmar_ratio          = _safe(m["Calmar Ratio"]),
            var_95                = _safe(m["VaR 95% (Historical)"]),
            cvar_95               = _safe(m["CVaR 95% (Historical)"]),
            win_rate              = _safe(m["Win Rate"]),
        ),
        risk_decomposition=risk_decomp,
        warning=solve_warning,
    )
