"""
factors.py
----------
Fama-French factor model utilities:
  - Download FF3, FF5, Carhart4 factors from Ken French's data library
  - Compute OLS factor loadings (betas), R², alpha per asset
  - Factor-model implied mu and covariance matrix
"""

from __future__ import annotations

import io
import zipfile
from datetime import datetime

import numpy as np
import pandas as pd
import pandas_datareader.data as web
import statsmodels.api as sm


# ── Factor download ────────────────────────────────────────────────────────────

_FF_DATASETS = {
    "FF3":     "F-F_Research_Data_Factors_daily",
    "FF5":     "F-F_Research_Data_5_Factors_2x3_daily",
    "Carhart4":"F-F_Momentum_Factor_daily",       # MOM only; combine with FF3
}


def download_ff_factors(
    model: str,
    start: str,
    end: str,
) -> pd.DataFrame:
    """
    Download Fama-French (or Carhart) daily factors from pandas_datareader.

    Parameters
    ----------
    model : str
        'FF3' | 'FF5' | 'Carhart4'
    start : str  YYYY-MM-DD
    end   : str  YYYY-MM-DD

    Returns
    -------
    pd.DataFrame
        Daily factor returns as decimals (not percentages), DatetimeIndex.
        Columns depend on model:
          FF3:      Mkt-RF, SMB, HML
          FF5:      Mkt-RF, SMB, HML, RMW, CMA
          Carhart4: Mkt-RF, SMB, HML, MOM
    """
    start_dt = pd.Timestamp(start)
    end_dt   = pd.Timestamp(end)

    if model in ("FF3", "Carhart4"):
        ff3 = _fetch_ff("F-F_Research_Data_Factors_daily", start_dt, end_dt)
        ff3 = ff3[["Mkt-RF", "SMB", "HML"]]
        if model == "FF3":
            return ff3
        # Carhart4 = FF3 + MOM
        mom = _fetch_ff("F-F_Momentum_Factor_daily", start_dt, end_dt)
        mom.columns = ["MOM"]
        return ff3.join(mom, how="inner")

    elif model == "FF5":
        ff5 = _fetch_ff("F-F_Research_Data_5_Factors_2x3_daily", start_dt, end_dt)
        return ff5[["Mkt-RF", "SMB", "HML", "RMW", "CMA"]]

    else:
        raise ValueError(f"Unknown factor model '{model}'. Choose 'FF3', 'FF5', or 'Carhart4'.")


def _fetch_ff(dataset: str, start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    """Fetch a single Ken French dataset via pandas_datareader and return daily decimals."""
    df = web.DataReader(dataset, "famafrench", start=start, end=end)[0]
    df.index = pd.to_datetime(df.index, format="%Y%m%d", errors="coerce")
    df = df.dropna(how="all")
    df = df / 100.0  # convert from percent to decimal
    df = df[(df.index >= start) & (df.index <= end)]
    return df


# ── OLS factor regression ──────────────────────────────────────────────────────

def compute_factor_exposure(
    returns: pd.DataFrame,
    factors: pd.DataFrame,
) -> dict:
    """
    Run OLS regression of each asset's excess return on factor returns.

    Returns
    -------
    dict with keys:
      'betas'   : pd.DataFrame (n_assets × n_factors)  – factor loadings
      'alphas'  : pd.Series (n_assets)                 – annualised Jensen's alpha
      'r2'      : pd.Series (n_assets)                 – R² of each regression
      't_stats' : pd.DataFrame (n_assets × n_factors)  – t-statistics for betas
      'p_values': pd.DataFrame (n_assets × n_factors)  – p-values for betas
    """
    # Align on common dates
    common = returns.index.intersection(factors.index)
    R = returns.loc[common]
    F = factors.loc[common]
    X = sm.add_constant(F)

    betas   = {}
    alphas  = {}
    r2      = {}
    tstats  = {}
    pvals   = {}

    for ticker in R.columns:
        y    = R[ticker]
        res  = sm.OLS(y, X).fit()
        coef = res.params

        betas[ticker]  = coef[F.columns].to_dict()
        alphas[ticker] = coef.get("const", 0) * 252      # annualise
        r2[ticker]     = res.rsquared

        ts = res.tvalues
        ps = res.pvalues
        tstats[ticker] = {c: ts[c] for c in F.columns}
        pvals[ticker]  = {c: ps[c] for c in F.columns}

    return {
        "betas":    pd.DataFrame(betas).T,          # n_assets × n_factors
        "alphas":   pd.Series(alphas),
        "r2":       pd.Series(r2),
        "t_stats":  pd.DataFrame(tstats).T,
        "p_values": pd.DataFrame(pvals).T,
    }


# ── Factor-model implied mu & Sigma ───────────────────────────────────────────

def factor_model_params(
    returns: pd.DataFrame,
    factors: pd.DataFrame,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Compute factor-model implied expected return vector and covariance matrix.

    Uses the standard linear factor model:
        r_i = alpha_i + B_i * f + epsilon_i
        mu_fm   = alpha + B * mu_f
        Sigma_fm = B * Sigma_f * B' + Sigma_eps   (diagonal idiosyncratic)

    Parameters
    ----------
    returns : pd.DataFrame   T × n_assets daily returns
    factors : pd.DataFrame   T × n_factors daily factor returns

    Returns
    -------
    mu_fm    : np.ndarray  (n_assets,)  annualised expected returns
    Sigma_fm : np.ndarray  (n_assets × n_assets)  annualised covariance
    """
    common = returns.index.intersection(factors.index)
    R = returns.loc[common].values
    F = factors.loc[common].values
    n, k = R.shape[0], F.shape[1]

    # OLS in matrix form: R = X @ B_T + eps
    X  = np.column_stack([np.ones(n), F])          # (T × k+1)
    B_T = np.linalg.lstsq(X, R, rcond=None)[0]    # (k+1 × n_assets)
    alpha = B_T[0]                                  # (n_assets,)
    B     = B_T[1:]                                 # (k × n_assets)

    # Residuals
    eps       = R - X @ B_T                        # (T × n_assets)
    Sigma_eps = np.diag(np.var(eps, axis=0, ddof=1))

    # Factor moments (daily)
    mu_f    = F.mean(axis=0)                       # (k,)
    Sigma_f = np.cov(F, rowvar=False)              # (k × k)

    # Factor model mu & cov (daily)
    mu_fm_daily    = alpha + B.T @ mu_f            # (n_assets,)
    Sigma_fm_daily = B.T @ Sigma_f @ B + Sigma_eps # (n_assets × n_assets)

    # Annualise
    mu_fm    = mu_fm_daily * 252
    Sigma_fm = Sigma_fm_daily * 252

    return mu_fm, Sigma_fm
