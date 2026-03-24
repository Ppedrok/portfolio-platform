"""
backtest.py
-----------
Walk-forward portfolio backtest engine.
"""

import warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from .parameters import Portfolio
from .optimizer  import Optimizer
from .utils      import compute_metrics


class Backtest:
    """
    Walk-forward portfolio backtest.

    At each rebalancing point the last `estimation_window` days are used
    to estimate parameters (via Portfolio) and optimise weights (via Optimizer).
    The resulting weights are applied to the *next* rebalancing period
    out-of-sample.

    Parameters
    ----------
    returns : pd.DataFrame
        Full daily returns matrix (T × n_assets).
    estimation_window : int
        Look-back window in days. Default 252 (~ 1 year).
    rebalancing_freq : int
        Number of days between rebalancings. Default 21 (~ 1 month).
    """

    def __init__(
        self,
        returns: pd.DataFrame,
        estimation_window: int = 252,
        rebalancing_freq:  int = 21,
    ):
        self.returns           = returns
        self.estimation_window = estimation_window
        self.rebalancing_freq  = rebalancing_freq
        self.n_assets          = returns.shape[1]
        self.assets            = returns.columns.to_list()

        # populated after .run()
        self.weights_history        = None
        self.portfolio_returns      = None
        self.equity_curve           = None
        self.benchmark_equity_curve = None
        self._benchmark_returns     = None

    # ── Main loop ─────────────────────────────────────────────────────────────

    def run(
        self,
        mu_method:          str = "historical",
        cov_method:         str = "ledoit_wolf",
        opt_method:         str = "CVaR",
        benchmark:          pd.Series = None,
        solver:             str = "CLARABEL",
        benchmark_external: "pd.Series | None" = None,
        max_te_daily:       "float | None" = None,
        long_only:          bool = True,
        min_weight:         float = 0.0,
        max_weight:         float = 1.0,
        constraints_df=None,
        asset_classes_df=None,
    ) -> dict:
        """
        Execute the walk-forward backtest.

        At each rebalancing date:
          1. Fit Portfolio on the in-sample window (estimate μ and Σ).
          2. Optimise with Optimizer.
          3. Apply the resulting weights to the following OOS period.

        If estimation or the solver fails, weights from the previous period
        are carried forward with a warning.

        Parameters
        ----------
        mu_method  : str            Passed to Portfolio.estimate_mu().
        cov_method : str            Passed to Portfolio.estimate_cov_matrix().
        opt_method : str            Passed to Optimizer.optimize().
        benchmark  : pd.Series | None  Daily returns of a reference portfolio.
        solver     : str            CVXPY solver. Default 'CLARABEL'.

        Returns
        -------
        dict with keys:
            weights_history, portfolio_returns, equity_curve,
            benchmark_equity_curve
        """
        ret = self.returns
        T   = len(ret)
        ew  = self.estimation_window
        rf  = self.rebalancing_freq
        n   = self.n_assets

        w_prev       = np.ones(n) / n      # equal-weight fallback
        rebal_points = list(range(ew, T, rf))
        weights_rows = []                  # (date, weight array)
        oos_ret_list = []                  # list of pd.Series

        for i, t in enumerate(rebal_points):
            t_end = rebal_points[i + 1] if i + 1 < len(rebal_points) else T
            oos   = ret.iloc[t:t_end]

            window = ret.iloc[t - ew : t]

            # ── Estimate ──────────────────────────────────────────────────────
            try:
                port = Portfolio(window, factors=None)
                port.estimate_mu(method=mu_method)
                port.estimate_cov_matrix(method=cov_method)
                mu   = port.mu
                cov  = np.array(port.cov_matrix)
                R_in = window.to_numpy()
            except Exception as exc:
                warnings.warn(
                    f"[Backtest] Estimation failed at step {i} (t={t}): {exc}. "
                    "Carrying forward previous weights."
                )
                w = w_prev.copy()
                weights_rows.append((ret.index[t], w))
                oos_ret_list.append((oos * w).sum(axis=1))
                continue

            # ── Optimise ──────────────────────────────────────────────────────
            try:
                opt   = Optimizer(mu=mu, covar_matrix=cov, corr=None, dist=None,
                                  R=R_in, assets=self.assets)

                # Build R_b window slice if external benchmark provided
                R_b_window: "np.ndarray | None" = None
                if benchmark_external is not None:
                    bm_window = benchmark_external.reindex(window.index).fillna(0)
                    R_b_window = bm_window.to_numpy().reshape(-1, 1)

                w_raw = opt.optimize(
                    method=opt_method, solver=solver,
                    R_b=R_b_window, max_te_daily=max_te_daily,
                    long_only=long_only,
                    min_weight=min_weight,
                    max_weight=max_weight,
                    constraints_df=constraints_df,
                    asset_classes_df=asset_classes_df,
                )

                if w_raw is None:
                    raise ValueError("Solver returned None.")

                w     = np.array(w_raw).flatten()
                lo_clip = max(0.0, float(min_weight)) if long_only else float(min_weight)
                w     = np.clip(w, lo_clip, None)
                total = w.sum()
                w     = w / total if total > 1e-8 else w_prev.copy()

            except Exception as exc:
                warnings.warn(
                    f"[Backtest] Optimisation failed at step {i} (t={t}): {exc}. "
                    "Carrying forward previous weights."
                )
                w = w_prev.copy()

            w_prev = w.copy()
            weights_rows.append((ret.index[t], w))
            oos_ret_list.append((oos * w).sum(axis=1))

        # ── Assemble ──────────────────────────────────────────────────────────
        portfolio_returns      = pd.concat(oos_ret_list)
        portfolio_returns.name = "Portfolio"

        equity_curve      = (1 + portfolio_returns).cumprod()
        equity_curve.name = "Portfolio"

        dates_w, arrays_w = zip(*weights_rows)
        weights_history   = pd.DataFrame(
            np.vstack(arrays_w),
            index=pd.DatetimeIndex(dates_w),
            columns=self.assets,
        )

        bm_equity       = None
        bm_rets_aligned = None
        if benchmark is not None:
            bm_rets_aligned      = benchmark.reindex(portfolio_returns.index).fillna(0)
            bm_equity            = (1 + bm_rets_aligned).cumprod()
            bm_equity.name       = "Benchmark"

        self.weights_history        = weights_history
        self.portfolio_returns      = portfolio_returns
        self.equity_curve           = equity_curve
        self.benchmark_equity_curve = bm_equity
        self._benchmark_returns     = bm_rets_aligned

        return dict(
            weights_history        = weights_history,
            portfolio_returns      = portfolio_returns,
            equity_curve           = equity_curve,
            benchmark_equity_curve = bm_equity,
        )

    # ── Analytics ─────────────────────────────────────────────────────────────

    def performance_metrics(self) -> pd.DataFrame:
        """
        Compute annualised performance metrics for the portfolio (and benchmark
        if available).

        Metrics
        -------
        Annualized Return, Annualized Volatility, Sharpe Ratio, Sortino Ratio,
        Max Drawdown, Calmar Ratio, VaR 95% (Historical),
        CVaR 95% (Historical), Win Rate

        Returns
        -------
        pd.DataFrame   rows = metric names, columns = series labels.
        """
        if self.portfolio_returns is None:
            raise ValueError("Run the backtest first via .run().")

        cols = [compute_metrics(self.portfolio_returns, "Portfolio")]
        if self._benchmark_returns is not None:
            cols.append(compute_metrics(self._benchmark_returns, "Benchmark"))

        return pd.DataFrame(cols).T

    # ── Visualisation ─────────────────────────────────────────────────────────

    def plot_results(self):
        """
        Three-panel performance dashboard:

        1. Equity curve (portfolio vs benchmark) with crimson drawdown shading.
        2. Rolling 63-day Sharpe ratio with green/red area shading.
        3. Heatmap of portfolio weights at each rebalancing date.
        """
        if self.portfolio_returns is None:
            raise ValueError("Run the backtest first via .run().")

        has_bm = self.benchmark_equity_curve is not None

        sns.set_style("whitegrid")
        fig, axes = plt.subplots(3, 1, figsize=(14, 16))
        fig.suptitle(
            "Walk-Forward Backtest — Results Dashboard",
            fontsize=15, fontweight="bold", y=0.995,
        )

        # Panel 1 – Equity curve + drawdown shading
        ax1 = axes[0]
        ec  = self.equity_curve
        ax1.plot(ec.index, ec.values, color="steelblue", linewidth=1.6, label="Portfolio")

        if has_bm:
            bm = self.benchmark_equity_curve
            ax1.plot(bm.index, bm.values, color="darkorange", linewidth=1.2,
                     linestyle="--", label="Benchmark")

        roll_max = ec.cummax()
        dd       = (ec - roll_max) / roll_max
        ax1.fill_between(ec.index, ec.values, roll_max.values,
                         where=(dd.values < 0), alpha=0.20, color="crimson",
                         label="Drawdown period")
        ax1.set_title("Equity Curve", fontsize=12)
        ax1.set_ylabel("Cumulative Value (base = 1)")
        ax1.legend(loc="upper left", fontsize=9)

        # Panel 2 – Rolling Sharpe (63-day)
        ax2    = axes[1]
        win    = 63
        rs_ret = self.portfolio_returns.rolling(win).mean() * 252
        rs_vol = self.portfolio_returns.rolling(win).std()  * np.sqrt(252)
        rs     = rs_ret / rs_vol
        mean_s = float(rs.mean())

        ax2.plot(rs.index, rs.values, color="steelblue", linewidth=1.3,
                 label=f"Rolling Sharpe ({win}d)")
        ax2.axhline(0,      color="black",    linewidth=0.8, linestyle="--")
        ax2.axhline(mean_s, color="steelblue", linewidth=0.9, linestyle=":",
                    label=f"Mean = {mean_s:.2f}")
        ax2.fill_between(rs.index, 0, rs.values, where=(rs.values >  0),
                         alpha=0.15, color="seagreen")
        ax2.fill_between(rs.index, 0, rs.values, where=(rs.values <= 0),
                         alpha=0.15, color="crimson")
        ax2.set_title(f"Rolling Sharpe Ratio ({win}-day window)", fontsize=12)
        ax2.set_ylabel("Sharpe Ratio")
        ax2.legend(loc="upper left", fontsize=9)

        # Panel 3 – Weights heatmap
        ax3     = axes[2]
        wh      = self.weights_history.T
        n_ticks = max(1, len(wh.columns) // 20)
        x_labels = [
            d.strftime("%Y-%m") if j % n_ticks == 0 else ""
            for j, d in enumerate(wh.columns)
        ]
        sns.heatmap(
            wh, ax=ax3, cmap="YlOrRd",
            vmin=0, vmax=float(wh.values.max()),
            linewidths=0,
            xticklabels=x_labels, yticklabels=True,
            cbar_kws={"label": "Weight", "shrink": 0.55},
        )
        ax3.set_title("Portfolio Weights Over Time", fontsize=12)
        ax3.set_xlabel("Rebalancing Date")
        ax3.set_ylabel("Asset")
        ax3.tick_params(axis="x", labelsize=7, rotation=45)
        ax3.tick_params(axis="y", labelsize=8)

        plt.tight_layout()
        plt.show()
