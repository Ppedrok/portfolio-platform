"""
utils.py
--------
Shared statistical helpers used across the package.
"""

import numpy as np
import pandas as pd


def compute_metrics(rets: pd.Series, name: str = "Portfolio") -> pd.Series:
    """
    Compute annualised performance metrics for a daily return series.

    Metrics
    -------
    - Annualized Return
    - Annualized Volatility
    - Sharpe Ratio (rf = 0)
    - Sortino Ratio
    - Max Drawdown
    - Calmar Ratio
    - VaR 95% (Historical)
    - CVaR 95% (Historical)
    - Win Rate

    Parameters
    ----------
    rets : pd.Series
        Daily return series.
    name : str
        Label used as the Series name.

    Returns
    -------
    pd.Series
        Named series of scalar metrics.
    """
    ann_ret = rets.mean() * 252
    ann_vol = rets.std() * np.sqrt(252)
    sharpe  = ann_ret / ann_vol if ann_vol > 1e-10 else np.nan

    neg      = rets[rets < 0]
    downside = neg.std() * np.sqrt(252) if len(neg) > 1 else np.nan
    sortino  = ann_ret / downside if (downside and downside > 1e-10) else np.nan

    cum      = (1 + rets).cumprod()
    roll_max = cum.cummax()
    dd       = (cum - roll_max) / roll_max
    max_dd   = dd.min()
    calmar   = ann_ret / abs(max_dd) if max_dd < -1e-10 else np.nan

    var_95  = float(np.percentile(rets, 5))
    cvar_95 = float(rets[rets <= var_95].mean())
    win_rate = (rets > 0).mean()

    return pd.Series(
        {
            "Annualized Return":     ann_ret,
            "Annualized Volatility": ann_vol,
            "Sharpe Ratio":          sharpe,
            "Sortino Ratio":         sortino,
            "Max Drawdown":          max_dd,
            "Calmar Ratio":          calmar,
            "VaR 95% (Historical)":  var_95,
            "CVaR 95% (Historical)": cvar_95,
            "Win Rate":              win_rate,
        },
        name=name,
    )


def format_metrics(metrics: pd.DataFrame) -> pd.DataFrame:
    """
    Format a metrics DataFrame (output of Backtest.performance_metrics) for display.

    Percentage rows are shown as '12.34%', scalar rows as '1.234'.

    Parameters
    ----------
    metrics : pd.DataFrame
        Raw float metrics DataFrame (rows = metric names, cols = series names).

    Returns
    -------
    pd.DataFrame
        Object-typed DataFrame with human-readable strings.
    """
    pct_rows = [
        "Annualized Return",
        "Annualized Volatility",
        "Max Drawdown",
        "VaR 95% (Historical)",
        "CVaR 95% (Historical)",
        "Win Rate",
    ]
    flt_rows = ["Sharpe Ratio", "Sortino Ratio", "Calmar Ratio"]

    fmt = metrics.copy().astype(object)
    for row in pct_rows:
        if row in fmt.index:
            fmt.loc[row] = metrics.loc[row].map(lambda x: f"{x:.2%}")
    for row in flt_rows:
        if row in fmt.index:
            fmt.loc[row] = metrics.loc[row].map(lambda x: f"{x:.3f}")
    return fmt
