"""
parameters.py
-------------
Portfolio class: mean vector and covariance matrix estimation,
factor model fitting, Black-Litterman variants, and
codependence / dissimilarity measures.
"""

import numpy as np
import pandas as pd
import riskfolio as rp
import statsmodels.api as sm
from sklearn.covariance import (
    GraphicalLassoCV,
    LedoitWolf,
    OAS,
    ShrunkCovariance,
)

try:
    from portfolio_engine.factors import download_ff_factors, factor_model_params
    _FACTORS_AVAILABLE = True
except ImportError:
    _FACTORS_AVAILABLE = False


class Portfolio:
    """
    Container for return-distribution parameter estimation.

    Attributes
    ----------
    returns : pd.DataFrame       In-sample daily returns (T × n_assets).
    factors : pd.DataFrame | None  Factor returns, used by estimate_factors().
    n_assets : int
    assets   : list[str]
    mu          : np.ndarray | pd.DataFrame  Estimated mean vector (set by estimate_mu).
    cov_matrix  : np.ndarray | pd.DataFrame  Estimated covariance (set by estimate_cov_matrix).
    corr        : pd.DataFrame   Codependence matrix (set by similarity).
    diss        : pd.DataFrame   Dissimilarity matrix (set by dissimilarity).
    """

    def __init__(self, returns: pd.DataFrame, factors=None, date_range: tuple = None):
        self.returns    = returns
        self.n_assets   = returns.shape[1]
        self.assets     = returns.columns.to_list()
        self.factors    = factors
        self.date_range = date_range   # (start_str, end_str) for FF factor downloads

        self.mu         = None
        self.cov_matrix = None
        self.weights    = None
        self.corr       = None
        self.diss       = None

    # ── Mean vector ───────────────────────────────────────────────────────────

    def estimate_mu(self, method: str = "historical", **kwargs):
        """
        Estimate the expected return vector.

        Parameters
        ----------
        method : str
            One of:
            'historical'                   – sample mean
            'JS_1' | 'JS_2' | 'JS_3'      – James-Stein (targets b1/b2/b3)
            'BS_1' | 'BS_2' | 'BS_3'      – Bayes-Stein
            'BOP_1' | 'BOP_2' | 'BOP_3'   – BOP shrinkage
            'BL_standard'                  – Black-Litterman standard
            'BL_augmented'                 – Augmented Black-Litterman
            'BL_bayes'                     – Black-Litterman Bayesian

            For BL methods all extra **kwargs are forwarded to
            estimate_black_litterman().

        Returns
        -------
        np.ndarray | pd.DataFrame
            Estimated mean vector stored in self.mu.
        """
        if method == "historical":
            self.mu = np.array(np.mean(self.returns, axis=0)).reshape(-1, 1)

        # James-Stein
        elif method == "JS_1":
            self.mu = rp.mean_vector(self.returns, method="JS", target="b1")
        elif method == "JS_2":
            self.mu = rp.mean_vector(self.returns, method="JS", target="b2")
        elif method == "JS_3":
            self.mu = rp.mean_vector(self.returns, method="JS", target="b3")

        # Bayes-Stein
        elif method == "BS_1":
            self.mu = rp.mean_vector(self.returns, method="BS", target="b1")
        elif method == "BS_2":
            self.mu = rp.mean_vector(self.returns, method="BS", target="b2")
        elif method == "BS_3":
            self.mu = rp.mean_vector(self.returns, method="BS", target="b3")

        # BOP
        elif method == "BOP_1":
            self.mu = rp.mean_vector(self.returns, method="BOP", target="b1")
        elif method == "BOP_2":
            self.mu = rp.mean_vector(self.returns, method="BOP", target="b2")
        elif method == "BOP_3":
            self.mu = rp.mean_vector(self.returns, method="BOP", target="b3")

        # Black-Litterman shortcuts
        elif method == "BL_standard":
            self.estimate_black_litterman(method="standard", **kwargs)
        elif method == "BL_augmented":
            self.estimate_black_litterman(method="augmented", **kwargs)
        elif method == "BL_bayes":
            self.estimate_black_litterman(method="bayes", **kwargs)

        # Fama-French / Carhart factor models
        elif method in ("FF3_mu", "FF5_mu", "Carhart4_mu"):
            ff_model = method.replace("_mu", "")
            self.mu, _ = self._factor_model_mu_cov(ff_model)

        else:
            raise ValueError(f"Unknown mu estimation method: '{method}'")

        return self.mu

    # ── Covariance matrix ─────────────────────────────────────────────────────

    def estimate_cov_matrix(self, method: str = "historical"):
        """
        Estimate the covariance matrix.

        Parameters
        ----------
        method : str
            One of:
            'historical'        – sample covariance
            'ledoit_wolf'       – Ledoit-Wolf analytical shrinkage
            'oas'               – Oracle Approximating Shrinkage
            'shrunk'            – fixed-shrinkage (coef 0.1)
            'denoised_fixed'    – riskfolio fixed denoising
            'spectral'          – spectral method (riskfolio)
            'targeted_shrink'   – riskfolio shrinkage
            'detoning'          – denoised + detoned (may not be PSD)
            'graph_lasso'       – GraphicalLassoCV
            'jlogo'             – J-LoGo (riskfolio)

        Returns
        -------
        np.ndarray
            Covariance matrix stored in self.cov_matrix.
        """
        if method == "historical":
            self.cov_matrix = np.cov(self.returns, rowvar=False)
        elif method == "ledoit_wolf":
            self.cov_matrix = LedoitWolf().fit(self.returns).covariance_
        elif method == "oas":
            self.cov_matrix = OAS().fit(self.returns).covariance_
        elif method == "shrunk":
            self.cov_matrix = ShrunkCovariance(shrinkage=0.1).fit(self.returns).covariance_
        elif method == "denoised_fixed":
            self.cov_matrix = rp.covar_matrix(self.returns, method="fixed")
        elif method == "spectral":
            self.cov_matrix = rp.covar_matrix(self.returns, method="spectral")
        elif method == "targeted_shrink":
            self.cov_matrix = rp.covar_matrix(self.returns, method="shrink")
        elif method == "detoning":
            self.cov_matrix = rp.covar_matrix(self.returns, method="fixed", detone=True)
        elif method == "graph_lasso":
            self.cov_matrix = GraphicalLassoCV().fit(self.returns).covariance_
        elif method == "jlogo":
            self.cov_matrix = rp.covar_matrix(self.returns, method="jlogo")

        # Fama-French / Carhart factor model covariance
        elif method in ("FF3_cov", "FF5_cov", "Carhart4_cov"):
            ff_model = method.replace("_cov", "")
            _, self.cov_matrix = self._factor_model_mu_cov(ff_model)

        else:
            raise ValueError(f"Unknown covariance estimation method: '{method}'")

        return np.array(self.cov_matrix)

    # ── Fama-French / Carhart internal helper ─────────────────────────────────

    def _factor_model_mu_cov(self, ff_model: str) -> tuple:
        """
        Download FF factors aligned with self.returns and return
        (mu_annualised, Sigma_annualised) via factor_model_params().
        """
        if not _FACTORS_AVAILABLE:
            raise ImportError(
                "pandas-datareader is required for Fama-French factor models. "
                "Install it with: pip install pandas-datareader"
            )
        if self.date_range is None:
            start = str(self.returns.index[0].date())
            end   = str(self.returns.index[-1].date())
        else:
            start, end = self.date_range

        factors = download_ff_factors(ff_model, start, end)
        mu_fm, Sigma_fm = factor_model_params(self.returns, factors)
        return mu_fm.reshape(-1, 1), Sigma_fm   # mu as (n,1) to match other methods

    # ── Factor model ──────────────────────────────────────────────────────────

    def estimate_factors(
        self,
        returns: pd.DataFrame,
        factors: pd.DataFrame,
        step: str = "Forward",
        method: str = "Explicit",
    ):
        """
        Fit a linear factor model (Explicit OLS or Implicit PCR).

        Parameters
        ----------
        returns : pd.DataFrame   Asset returns (endogenous).
        factors : pd.DataFrame   Factor returns (exogenous).
        step    : str            Stepwise direction for rp.loadings_matrix. Default 'Forward'.
        method  : str            'Explicit' (OLS) or 'Implicit' (PCR).

        Returns
        -------
        tuple : (B, mu_fm, Sigma_fm)
            B        – loadings DataFrame (from rp.loadings_matrix)
            mu_fm    – factor-implied mean vector (n_assets × 1)
            Sigma_fm – factor-implied covariance matrix (n_assets × n_assets)
        """
        feature_sel = None if method == "Explicit" else "PCR"
        B = rp.loadings_matrix(factors, returns, stepwise=step, feature_selection=feature_sel)

        L  = B.to_numpy()
        Xc = sm.add_constant(factors)
        mu_f     = Xc.mean().to_numpy().reshape(-1, 1)
        mu_fm    = L @ mu_f
        errors   = returns.to_numpy() - Xc.to_numpy() @ L.T
        Sigma_e  = np.diag(np.diag(np.cov(errors, rowvar=False)))
        Sigma_f  = Xc.cov().to_numpy()
        Sigma_fm = L @ Sigma_f @ L.T + Sigma_e

        return B, mu_fm, Sigma_fm

    # ── Black-Litterman ───────────────────────────────────────────────────────

    def estimate_black_litterman(
        self,
        method: str = "standard",
        w: pd.DataFrame = None,
        P=None,
        Q=None,
        delta: float = 2.5,
        tau: float = 0.05,
        views: pd.DataFrame = None,
        X: pd.DataFrame = None,
        B: pd.DataFrame = None,
    ):
        """
        Estimate posterior expected returns and covariance via Black-Litterman.

        Stores results in self.mu and self.cov_matrix.

        Parameters
        ----------
        method : str
            'standard'  – classic BL with asset views (P, Q).
            'augmented' – BL extended with factor views (X, B, views).
            'bayes'     – Black-Litterman-Bayesian (factor views only).
        w : pd.DataFrame, optional
            Equilibrium weights (n_assets × 1). Defaults to equal weight.
        P : np.ndarray, optional
            Asset views picking matrix (k × n_assets).
            Required for 'standard'; optional for 'augmented'.
        Q : np.ndarray, optional
            Asset views return vector (k × 1), same frequency as returns.
        delta : float
            Risk-aversion coefficient. Default 2.5.
        tau : float
            Prior uncertainty scalar. Default 0.05.
        views : pd.DataFrame, optional
            Factor views in riskfolio v7 format (5 columns:
            Disabled | Factor | Sign | Value | Relative Factor).
            Used to auto-derive P_f / Q_f for 'augmented' and 'bayes'.
        X : pd.DataFrame, optional
            Factor returns. Required for 'augmented' and 'bayes'.
        B : pd.DataFrame, optional
            Loadings matrix (from rp.loadings_matrix). Required for
            'augmented' and 'bayes'.

        Returns
        -------
        tuple : (mu_bl, Sigma_bl)
            mu_bl    – pd.DataFrame, posterior expected returns (1 × n_assets).
            Sigma_bl – pd.DataFrame, posterior covariance (n_assets × n_assets).
        """
        if w is None:
            w = pd.DataFrame(
                np.ones((self.n_assets, 1)) / self.n_assets, index=self.assets
            )

        if method == "standard":
            if P is None or Q is None:
                # Pure equilibrium prior — no views
                Sigma = np.cov(self.returns, rowvar=False)
                w_eq  = np.ones((self.n_assets, 1)) / self.n_assets
                pi    = delta * Sigma @ w_eq
                self.mu         = pd.DataFrame(pi.T, columns=self.assets)
                self.cov_matrix = pd.DataFrame(Sigma, index=self.assets, columns=self.assets)
                return self.mu, self.cov_matrix
            mu_bl, Sigma_bl, _ = rp.black_litterman(
                self.returns, w, P, Q, delta=delta, rf=0, eq=True
            )

        elif method == "augmented":
            if views is not None and B is not None:
                P_f, Q_f = rp.factors_views(views, B, const=True)
            else:
                P_f, Q_f = P, Q
            mu_bl, Sigma_bl, _ = rp.augmented_black_litterman(
                self.returns, w=w, F=X, B=B,
                P=P, Q=Q, P_f=P_f, Q_f=Q_f,
                delta=delta, rf=0, eq=True, const=True,
            )

        elif method == "bayes":
            if views is not None and B is not None:
                P_f, Q_f = rp.factors_views(views, B, const=True)
            else:
                P_f, Q_f = P, Q
            mu_bl, Sigma_bl, _ = rp.black_litterman_bayesian(
                self.returns, F=X, B=B,
                P_f=P_f, Q_f=Q_f,
                delta=delta, rf=0, const=True,
            )

        else:
            raise ValueError(
                f"Unknown Black-Litterman method '{method}'. "
                "Choose 'standard', 'augmented', or 'bayes'."
            )

        self.mu         = mu_bl
        self.cov_matrix = Sigma_bl
        return mu_bl, Sigma_bl

    # ── Codependence / dissimilarity ──────────────────────────────────────────

    def similarity(self, method: str = "pearson"):
        """
        Compute and store a codependence (correlation-like) matrix.

        Parameters
        ----------
        method : str
            'pearson' | 'spearman' | 'kendall' | 'gerber' |
            'distance' | 'mutual_info' | 'tail'
        """
        codep_map = {
            "pearson":     dict(codependence="pearson"),
            "spearman":    dict(codependence="spearman"),
            "kendall":     dict(codependence="kendall"),
            "gerber":      dict(codependence="gerber2", gs_threshold=0.5),
            "distance":    dict(codependence="distance"),
            "mutual_info": dict(codependence="mutual_info", bins_info="KN"),
            "tail":        dict(codependence="tail", alpha_tail=0.05),
        }
        if method not in codep_map:
            raise ValueError(f"Unknown similarity method: '{method}'")
        self.corr, _ = rp.codep_dist(self.returns, **codep_map[method])
        return self.corr

    def dissimilarity(self, method: str = "pearson"):
        """
        Compute and store a dissimilarity (distance) matrix.

        Parameters
        ----------
        method : str
            'pearson' | 'mutual_info' | 'tail'
        """
        codep_map = {
            "pearson":     dict(codependence="pearson"),
            "mutual_info": dict(codependence="mutual_info", bins_info="KN"),
            "tail":        dict(codependence="tail", alpha_tail=0.05),
        }
        if method not in codep_map:
            raise ValueError(f"Unknown dissimilarity method: '{method}'")
        _, self.diss = rp.codep_dist(self.returns, **codep_map[method])
        return self.diss
