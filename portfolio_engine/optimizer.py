"""
optimizer.py
------------
Optimizer class: single-point and frontier convex-risk optimisation.
Efficient_Frontier class: parametric mean-variance frontier sweep.
"""

import warnings
import numpy as np
import pandas as pd
import cvxpy as cp
import matplotlib.pyplot as plt
import riskfolio as rp
from scipy.linalg import sqrtm


class Optimizer:
    """
    Convex portfolio optimiser supporting multiple risk measures.

    Parameters
    ----------
    mu : np.ndarray | pd.DataFrame
        Expected return vector (n_assets × 1).
    covar_matrix : np.ndarray
        Covariance matrix (n_assets × n_assets).
    corr : pd.DataFrame | None
        Codependence matrix – stored but not used by current risk measures.
    dist : pd.DataFrame | None
        Dissimilarity matrix – stored but not used by current risk measures.
    R : np.ndarray
        In-sample returns matrix (T × n_assets).
    assets : list[str] | np.ndarray
        Asset names, used for labelling.
    """

    def __init__(
        self,
        mu,
        covar_matrix: np.ndarray,
        corr,
        dist,
        R: np.ndarray,
        assets,
    ):
        self.mu           = mu
        self.covar_matrix = covar_matrix
        self.corr         = corr
        self.dist         = dist
        self.T, self.n    = R.shape
        self.weights      = None
        self.assets       = list(assets)
        self.R            = R

    # ── Core optimiser ────────────────────────────────────────────────────────

    def optimize(
        self,
        method: str = "markowitz",
        solver: str = "CLARABEL",
        target_return=None,
    ):
        """
        Solve the portfolio optimisation problem.

        Parameters
        ----------
        method : str
            Risk measure to minimise. One of:
            'markowitz'         – minimum variance (quadratic form)
            'GMD'               – Gini Mean Difference
            'MAD'               – Mean Absolute Deviation
            'SMAD'              – Semi-MAD (downside only)
            'Brownian'          – Brownian distance variance
            'SemiVariance'      – Downside semi-variance
            'LowerPartialMoments' – LPM with threshold 3 % p.a.
            'VaR'               – Value-at-Risk 95 % (MILP, slow)
            'CVaR'              – Conditional VaR 95 %
            'EVaR'              – Entropic VaR 95 %
            'Ulcer'             – Ulcer Index

        solver : str
            CVXPY solver name. Default 'CLARABEL' (bundled, no licence required).

        target_return : None | float | 'frontier'
            - None            : pure risk minimisation (no return constraint).
            - float           : add constraint  μᵀw ≥ target_return.
            - 'frontier'      : sweep over 40 target returns between the
                                global-minimum-risk and maximum-return points
                                and return a pd.DataFrame of weights
                                (assets × frontier points).  Only meaningful
                                for method='markowitz'.

        Returns
        -------
        np.ndarray (n_assets × 1)
            Optimal weights for a single optimisation.
        pd.DataFrame (n_assets × 40)
            Weight matrix along the efficient frontier when
            target_return='frontier'.
        """
        if target_return == "frontier":
            return self._frontier(solver=solver)

        mu_vec = np.array(self.mu).flatten()

        # ── Build risk expression and constraints ─────────────────────────────
        if method == "markowitz":
            x    = cp.Variable((self.n, 1))
            risk = cp.quad_form(x, self.covar_matrix)
            constraints = [cp.sum(x) == 1, x >= 0]

        elif method == "GMD":
            D = np.empty((0, self.n))
            for j in range(self.T - 1):
                D = np.vstack([D, self.R[j + 1 :] - self.R[j, :]])
            x    = cp.Variable((self.n, 1))
            d    = cp.Variable((int(self.T * (self.T - 1) / 2), 1))
            risk = cp.sum(d) / ((self.T - 1) * self.T)
            constraints = [d >= D @ x, d >= -D @ x, cp.sum(x) == 1, x >= 0]

        elif method == "MAD":
            C_T  = np.eye(self.T) - np.ones((self.T, self.T)) / self.T
            x    = cp.Variable((self.n, 1))
            d    = cp.Variable((self.T, 1))
            risk = cp.sum(d) / self.T
            constraints = [
                d >= C_T @ self.R @ x,
                d >= -(C_T @ self.R @ x),
                cp.sum(x) == 1, x >= 0, d >= 0,
            ]

        elif method == "SMAD":
            C_T  = np.eye(self.T) - np.ones((self.T, self.T)) / self.T
            x    = cp.Variable((self.n, 1))
            d    = cp.Variable((self.T, 1))
            risk = cp.sum(d) / self.T
            constraints = [
                d >= -(C_T @ self.R @ x), d >= 0,
                cp.sum(x) == 1, x >= 0,
            ]

        elif method == "Brownian":
            ones = np.ones((self.T, 1))
            x    = cp.Variable((self.n, 1))
            D    = cp.Variable((self.T, self.T), symmetric=True)
            y    = self.R @ x
            risk = cp.sum_squares(D) / self.T ** 2 + cp.sum(D) ** 2 / self.T ** 4
            constraints = [
                D >= y @ ones.T - ones @ y.T,
                D >= -(y @ ones.T - ones @ y.T),
                x >= 0, cp.sum(x) == 1,
            ]

        elif method == "SemiVariance":
            C_T  = np.eye(self.T) - np.ones((self.T, self.T)) / self.T
            x    = cp.Variable((self.n, 1))
            d    = cp.Variable((self.T, 1))
            risk = cp.sum_squares(d) / self.T
            constraints = [
                d >= -(C_T @ self.R @ x), d >= 0,
                cp.sum(x) == 1, x >= 0,
            ]

        elif method == "LowerPartialMoments":
            tau  = 0.03 / 252
            x    = cp.Variable((self.n, 1))
            d    = cp.Variable((self.T, 1))
            risk = cp.sum(d) / self.T
            constraints = [
                d >= tau - self.R @ x,
                cp.sum(x) == 1, x >= 0, d >= 0,
            ]

        elif method == "VaR":
            alpha = 0.05
            pi    = 1e-5
            M     = 1000
            x     = cp.Variable((self.n, 1))
            t     = cp.Variable()
            z     = cp.Variable((self.T, 1), boolean=True)
            risk  = t
            constraints = [
                0 >= -self.R @ x - t - M * z,
                cp.sum(x) == 1, x >= 0,
                cp.sum(z) <= (alpha - pi) * self.T,
            ]

        elif method == "CVaR":
            alpha = 0.05
            x     = cp.Variable((self.n, 1))
            t     = cp.Variable()
            u     = cp.Variable((self.T, 1))
            risk  = t + 1 / (alpha * self.T) * cp.sum(u)
            constraints = [
                u >= -self.R @ x - t,
                cp.sum(x) == 1, x >= 0, u >= 0,
            ]

        elif method == "EVaR":
            alpha = 0.05
            ones  = np.ones((self.T, 1))
            x     = cp.Variable((self.n, 1))
            t     = cp.Variable((1, 1))
            z     = cp.Variable((1, 1), nonneg=True)
            u     = cp.Variable((self.T, 1))
            risk  = t + z * np.log(1 / (alpha * self.T))
            constraints = [
                cp.sum(u) <= z,
                cp.ExpCone(-self.R @ x - t, ones @ z, u),
                cp.sum(x) == 1, x >= 0,
            ]

        elif method == "Ulcer":
            x    = cp.Variable((self.n, 1))
            d    = cp.Variable((self.T + 1, 1))
            risk = cp.norm(d[1:]) / self.T ** 0.5
            constraints = [
                d[1:] >= d[:-1] - self.R @ x,
                d[1:] >= 0, x >= 0,
                cp.sum(x) == 1, d[0] == 0,
            ]

        else:
            raise ValueError(f"Unknown optimisation method: '{method}'")

        # ── Optional return constraint ────────────────────────────────────────
        if target_return is not None and target_return != "frontier":
            constraints.append(mu_vec @ x >= float(target_return))

        prob = cp.Problem(cp.Minimize(risk), constraints)
        prob.solve(solver=solver)
        self.weights = x.value
        return self.weights

    # ── Efficient frontier sweep ──────────────────────────────────────────────

    def _frontier(self, solver: str = "CLARABEL", n_points: int = 40) -> pd.DataFrame:
        """
        Parametric mean-variance efficient frontier via SOC programme.

        Sweeps `n_points` target returns between the minimum-variance return
        and the maximum single-asset return and solves for the minimum-risk
        portfolio at each target.

        Parameters
        ----------
        solver   : str   CVXPY solver name.
        n_points : int   Number of frontier points. Default 40.

        Returns
        -------
        pd.DataFrame
            Shape (n_assets × n_points).  Each column is the weight vector
            for one frontier portfolio.
        """
        mu_vec    = np.array(self.mu).flatten()
        Sigma_sqrt = sqrtm(self.covar_matrix)

        x      = cp.Variable((self.n, 1))
        g      = cp.Variable(nonneg=True)
        mu_bar = cp.Parameter()

        constraints = [
            cp.SOC(g, Sigma_sqrt @ x),
            (mu_vec @ x) >= mu_bar,
            cp.sum(x) == 1,
            x >= 0,
        ]
        prob = cp.Problem(cp.Minimize(g), constraints)

        frontier = np.empty((self.n, 0))
        mu_min   = float(mu_vec.min())
        mu_max   = float(mu_vec.max())

        for target in np.linspace(mu_min, mu_max, n_points):
            mu_bar.value = target
            try:
                prob.solve(solver=solver)
                if x.value is not None:
                    frontier = np.hstack([frontier, x.value])
                else:
                    frontier = np.hstack([frontier, np.full((self.n, 1), np.nan)])
            except Exception:
                frontier = np.hstack([frontier, np.full((self.n, 1), np.nan)])

        return pd.DataFrame(frontier, index=self.assets)

    # ── Visualisation ─────────────────────────────────────────────────────────

    def plot_weights(self):
        """Pie-chart of current optimised weights (requires riskfolio)."""
        if self.weights is None:
            raise ValueError("Run optimize() first.")
        w_df = pd.DataFrame(self.weights, index=self.assets)
        fig, ax = plt.subplots(figsize=(10, 6))
        rp.plot_pie(w_df, ax=ax)
        return ax

    def plot_frontier(self, frontier: pd.DataFrame, returns: pd.DataFrame):
        """
        Plot an efficient frontier DataFrame produced by optimize(target_return='frontier').

        Parameters
        ----------
        frontier : pd.DataFrame   Output of optimize(target_return='frontier').
        returns  : pd.DataFrame   Full (or in-sample) returns for the scatter overlay.
        """
        fig1, ax1 = plt.subplots(figsize=(10, 5))
        rp.plot_frontier(
            frontier,
            mu=returns.mean(),
            cov=returns.cov(),
            returns=returns,
            rm="MV",
            t_factor=1,
            ax=ax1,
        )
        fig2, ax2 = plt.subplots(figsize=(10, 5))
        rp.plot_frontier_area(frontier, ax=ax2)
        return ax1, ax2


class Efficient_Frontier:
    """
    Parametric mean-variance efficient frontier.

    Thin wrapper kept for backward compatibility with the notebook.
    The same functionality is available via Optimizer.optimize(target_return='frontier').
    """

    def __init__(self, mu, cov_matrix: np.ndarray, returns: pd.DataFrame, assets):
        self.mu         = np.asarray(mu).reshape(-1, 1)
        self.cov_matrix = cov_matrix
        self.returns    = returns
        self.assets     = list(assets)

    def markowitz(self, solver: str = "CLARABEL", n_points: int = 40) -> pd.DataFrame:
        """
        Compute and plot the mean-variance efficient frontier.

        Parameters
        ----------
        solver   : str   CVXPY solver. Default 'CLARABEL'.
        n_points : int   Number of frontier points. Default 40.

        Returns
        -------
        pd.DataFrame  (n_assets × n_points) weight matrix.
        """
        n          = len(self.mu)
        Sigma_sqrt = sqrtm(self.cov_matrix)

        x      = cp.Variable((n, 1))
        g      = cp.Variable(nonneg=True)
        mu_bar = cp.Parameter()

        constraints = [
            cp.SOC(g, Sigma_sqrt @ x),
            self.mu.T @ x >= mu_bar,
            cp.sum(x) == 1,
            x >= 0,
        ]
        prob = cp.Problem(cp.Minimize(g), constraints)

        frontier = np.empty((n, 0))
        for target in np.linspace(float(self.mu.min()), float(self.mu.max()), n_points):
            mu_bar.value = target
            try:
                prob.solve(solver=solver)
                col = x.value if x.value is not None else np.full((n, 1), np.nan)
            except Exception:
                col = np.full((n, 1), np.nan)
            frontier = np.hstack([frontier, col])

        frontier = pd.DataFrame(frontier, index=self.assets)

        fig1, ax1 = plt.subplots(figsize=(10, 5))
        rp.plot_frontier(
            frontier,
            mu=self.returns.mean(),
            cov=self.returns.cov(),
            returns=self.returns,
            rm="MV",
            t_factor=1,
            ax=ax1,
        )
        fig2, ax2 = plt.subplots(figsize=(10, 5))
        rp.plot_frontier_area(frontier, ax=ax2)

        return frontier
