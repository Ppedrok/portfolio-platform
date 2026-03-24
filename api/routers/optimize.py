"""
routers/optimize.py
-------------------
POST /api/optimize
  → single optimal portfolio  (target_return is None or a float)
  → efficient frontier        (target_return == "frontier")
"""

from __future__ import annotations

import math
import warnings
import numpy as np
import pandas as pd
import cvxpy as cp
import riskfolio as rp
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


def _download_benchmark_returns(
    benchmark_ticker: str,
    asset_returns: pd.DataFrame,
    start: str,
    end: str,
) -> np.ndarray:
    """Download benchmark returns and align to asset_returns index (inner join)."""
    try:
        bm_ticker = benchmark_ticker.upper().strip()
        prices    = download_prices([bm_ticker], start, end)
        bm_ret    = compute_returns(prices)[bm_ticker]
        # Align to the same dates as asset returns
        common    = asset_returns.index.intersection(bm_ret.index)
        if len(common) < 30:
            raise ValueError(
                f"Only {len(common)} common trading days between benchmark "
                f"'{bm_ticker}' and portfolio assets."
            )
        return bm_ret.loc[common].to_numpy().reshape(-1, 1)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Benchmark download failed for '{benchmark_ticker}': {exc}",
        )


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
                P = np.zeros((k, n))   # (k, n) — one row per view
                Q = np.zeros((k, 1))   # (k, 1) — one value per view
                for i, view in enumerate(valid_views):
                    j = tickers_list.index(view["asset"])
                    # Convert annual % to daily return
                    daily_ret = float(view.get("value", 0)) / 100.0 / 252.0
                    P[i, j] = 1.0 if view.get("sign", ">=") == ">=" else -1.0
                    Q[i, 0] = abs(daily_ret)
                mu_kwargs = {"P": P, "Q": Q}  # shapes guaranteed correct

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


def _build_risk_expr(
    method: str,
    x: "cp.Variable",
    R: np.ndarray,
    cov: np.ndarray,
) -> tuple["cp.Expression", list]:
    """
    Return (risk_expression, aux_constraints) for the given method.
    `x` is the (n,1) CVXPY weight variable.
    `R` is the (T,n) returns matrix (already capped if needed).
    """
    T, n = R.shape

    if method == "markowitz":
        return cp.quad_form(x, cov), []

    elif method == "GMD":
        D = np.empty((0, n))
        for j in range(T - 1):
            D = np.vstack([D, R[j + 1:] - R[j, :]])
        d    = cp.Variable((int(T * (T - 1) / 2), 1))
        return cp.sum(d) / ((T - 1) * T), [d >= D @ x, d >= -(D @ x)]

    elif method == "MAD":
        C_T  = np.eye(T) - np.ones((T, T)) / T
        d    = cp.Variable((T, 1))
        return cp.sum(d) / T, [d >= C_T @ R @ x, d >= -(C_T @ R @ x), d >= 0]

    elif method == "SMAD":
        C_T  = np.eye(T) - np.ones((T, T)) / T
        d    = cp.Variable((T, 1))
        return cp.sum(d) / T, [d >= -(C_T @ R @ x), d >= 0]

    elif method == "Brownian":
        ones = np.ones((T, 1))
        D    = cp.Variable((T, T), symmetric=True)
        y    = R @ x
        risk = cp.sum_squares(D) / T ** 2 + cp.sum(D) ** 2 / T ** 4
        return risk, [D >= y @ ones.T - ones @ y.T, D >= -(y @ ones.T - ones @ y.T)]

    elif method == "SemiVariance":
        C_T  = np.eye(T) - np.ones((T, T)) / T
        d    = cp.Variable((T, 1))
        return cp.sum_squares(d) / T, [d >= -(C_T @ R @ x), d >= 0]

    elif method == "LowerPartialMoments":
        tau  = 0.03 / 252
        d    = cp.Variable((T, 1))
        return cp.sum(d) / T, [d >= tau - R @ x, d >= 0]

    elif method == "CVaR":
        alpha = 0.05
        t     = cp.Variable()
        u     = cp.Variable((T, 1))
        return t + 1 / (alpha * T) * cp.sum(u), [u >= -R @ x - t, u >= 0]

    elif method == "EVaR":
        alpha = 0.05
        ones  = np.ones((T, 1))
        t     = cp.Variable((1, 1))
        z     = cp.Variable((1, 1), nonneg=True)
        u     = cp.Variable((T, 1))
        return t + z * np.log(1 / (alpha * T)), [cp.sum(u) <= z, cp.ExpCone(-R @ x - t, ones @ z, u)]

    elif method == "Ulcer":
        d    = cp.Variable((T + 1, 1))
        return cp.norm(d[1:]) / T ** 0.5, [
            d[1:] >= d[:-1] - R @ x,
            d[1:] >= 0,
            d[0]  == 0,
        ]

    else:
        raise ValueError(f"Unknown optimisation method: '{method}'")


def _solve_tracking_error(
    method: str,
    R: np.ndarray,
    R_b: np.ndarray,
    cov: np.ndarray,
    lo: float,
    hi: float,
    solver: str,
    constraints_df: "pd.DataFrame | None" = None,
    asset_classes_df: "pd.DataFrame | None" = None,
) -> np.ndarray | None:
    """
    Solve a tracking-error minimisation problem.

    R   : (T, n) asset returns (already aligned to benchmark dates)
    R_b : (T, 1) benchmark returns (same dates as R)
    """
    T, n = R.shape

    # Trim R_b to the same T rows (should already match, but guard anyway)
    R_b = R_b[:T].reshape(-1, 1)

    x = cp.Variable((n, 1))
    base_constraints = [cp.sum(x) == 1, x >= lo]
    if hi < 1.0 - 1e-8:
        base_constraints.append(x <= hi)

    if method == "TrackingError_L2":
        objective = cp.Minimize(cp.norm(R_b - R @ x, 2) / np.sqrt(T))
        aux_constraints: list = []

    elif method == "TrackingError_L1":
        d = cp.Variable((T, 1))
        objective = cp.Minimize(cp.sum(d) / T)
        aux_constraints = [d >= R_b - R @ x, d >= R @ x - R_b]

    elif method == "TrackingError_Cov":
        x_b   = np.ones((n, 1)) / n
        diff  = x - x_b
        objective = cp.Minimize(cp.quad_form(diff, cov))
        aux_constraints = []

    else:
        raise ValueError(f"Unknown tracking error method: '{method}'")

    if constraints_df is not None:
        A, b = rp.assets_constraints(constraints_df, asset_classes_df)
        aux_constraints.append(np.array(A) @ x <= np.array(b))

    prob = cp.Problem(objective, base_constraints + aux_constraints)
    try:
        prob.solve(solver=solver, time_limit=float(_SOLVER_TIMEOUT_S))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Solver error: {exc}")

    if prob.status == "time_limit":
        raise HTTPException(
            status_code=408,
            detail=(
                f"Optimisation timed out (>{_SOLVER_TIMEOUT_S}s). "
                "Try a shorter date range."
            ),
        )

    return x.value


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
    R_b: "np.ndarray | None" = None,
    max_te_daily: "float | None" = None,
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

    # ── Decision variable + base constraints ─────────────────────────────────
    x = cp.Variable((n, 1))
    base_constraints = [cp.sum(x) == 1, x >= lo, x <= hi]

    if target_return is not None and target_return != "frontier":
        base_constraints.append(mu_vec @ x >= float(target_return))

    # ── Risk expression ───────────────────────────────────────────────────────
    risk, aux_constraints = _build_risk_expr(method, x, R, cov)

    # ── Optional riskfolio linear constraints (A @ x <= b) ───────────────────
    if constraints_df is not None:
        A, b = rp.assets_constraints(constraints_df, asset_classes_df)
        A = np.array(A)
        b = np.array(b)
        aux_constraints.append(A @ x <= b)

    # ── Optional TE constraint (‖R_b − Rx‖₂ / √T ≤ max_te_daily) ────────────
    if R_b is not None and max_te_daily is not None:
        R_b_col = R_b[:T].reshape(-1, 1)
        aux_constraints.append(cp.norm(R_b_col - R @ x, 2) / np.sqrt(T) <= max_te_daily)

    prob = cp.Problem(
        cp.Minimize(risk),
        base_constraints + aux_constraints,
    )

    # Solve — pass time_limit only (universally supported by CLARABEL)
    try:
        prob.solve(solver=solver, time_limit=float(_SOLVER_TIMEOUT_S))
    except Exception as solve_exc:
        raise HTTPException(status_code=422, detail=f"Solver error: {solve_exc}")

    if prob.status == "time_limit":
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
    is_tracking = body.opt_method.startswith("TrackingError")
    if is_tracking and not body.benchmark_ticker:
        raise HTTPException(
            status_code=422,
            detail="benchmark_ticker is required for TrackingError methods.",
        )

    returns = _download_returns(body)
    tickers = returns.columns.to_list()
    mu_vec, cov = _build_params(returns, body)
    R  = returns.to_numpy()
    lo = body.constraints.min_weight if body.long_only else -1.0
    hi = body.constraints.max_weight

    # Download and align benchmark (for TE standalone methods or TE constraint)
    needs_benchmark = is_tracking or (body.benchmark_ticker and body.max_tracking_error)
    R_b: np.ndarray | None = None
    if needs_benchmark and body.benchmark_ticker:
        R_b = _download_benchmark_returns(
            body.benchmark_ticker, returns, body.start, body.end
        )
        min_T = min(R.shape[0], R_b.shape[0])
        R   = R[-min_T:]
        R_b = R_b[-min_T:]

    # Convert annualised max_tracking_error → daily scale for the constraint
    max_te_daily: float | None = None
    if body.max_tracking_error and not is_tracking:
        max_te_daily = body.max_tracking_error / np.sqrt(252)

    constraints_df, asset_classes_df = (
        _build_rp_constraints(body.rp_constraints, tickers, body.asset_groups)
        if body.rp_constraints
        else (None, None)
    )

    # ── Efficient frontier ────────────────────────────────────────────────────
    if body.target_return == "frontier":
        method = body.opt_method

        # Cap T for heavy methods and choose number of frontier points
        T_full = R.shape[0]
        max_t  = _HEAVY_METHOD_MAX_T.get(method)
        R_fr   = R[-max_t:] if max_t and T_full > max_t else R
        # Fewer points for heavy methods to stay within Render's timeout budget
        n_pts  = 20 if method in _HEAVY_METHOD_MAX_T else 40
        # Per-point timeout: total budget ~50 s shared across all points
        pt_timeout = max(3.0, min(8.0, 50.0 / n_pts))

        T_fr, n_assets = R_fr.shape

        portfolios: list[FrontierPoint] = []
        for idx, target in enumerate(
            np.linspace(float(mu_vec.min()), float(mu_vec.max()), n_pts)
        ):
            try:
                x_var = cp.Variable((n_assets, 1))
                base_cons = [
                    cp.sum(x_var) == 1,
                    x_var >= lo,
                    x_var <= hi,
                    mu_vec @ x_var >= target,
                ]
                risk, aux = _build_risk_expr(method, x_var, R_fr, cov)

                if constraints_df is not None:
                    A_c, b_c = rp.assets_constraints(constraints_df, asset_classes_df)
                    aux.append(np.array(A_c) @ x_var <= np.array(b_c))

                prob = cp.Problem(cp.Minimize(risk), base_cons + aux)
                prob.solve(solver=body.solver, time_limit=float(pt_timeout))
                w_col = x_var.value
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
    solve_warning: str | None = None
    try:
        if is_tracking:
            w_raw = _solve_tracking_error(
                method=body.opt_method,
                R=R,
                R_b=R_b,
                cov=cov,
                lo=lo,
                hi=hi,
                solver=body.solver,
                constraints_df=constraints_df,
                asset_classes_df=asset_classes_df,
            )
        else:
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
                R_b=R_b,
                max_te_daily=max_te_daily,
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Optimisation failed: {exc}")

    if w_raw is None:
        detail = (
            "TE constraint infeasible: relax max_tracking_error or change benchmark."
            if max_te_daily is not None
            else "Solver returned no solution. Try relaxing constraints or changing the solver."
        )
        raise HTTPException(status_code=422, detail=detail)

    w_arr = np.clip(np.array(w_raw).flatten(), 0, None)
    total = w_arr.sum()
    if total < 1e-8:
        raise HTTPException(status_code=422, detail="Degenerate solution (all-zero weights).")
    w_arr /= total

    # Use the (possibly row-trimmed) R for portfolio returns
    port_rets = pd.Series(R @ w_arr, index=returns.index[-R.shape[0]:])
    m = compute_metrics(port_rets, "Portfolio")

    # Compute realized (annualised) tracking error when benchmark is available
    realized_te: float | None = None
    if R_b is not None:
        T_used   = min(R.shape[0], R_b.shape[0])
        port_vec = (R[-T_used:] @ w_arr).flatten()
        bm_vec   = R_b[-T_used:].flatten()
        realized_te = _safe(float(np.linalg.norm(bm_vec - port_vec) / np.sqrt(T_used) * np.sqrt(252)))

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
        tracking_error=realized_te,
    )
