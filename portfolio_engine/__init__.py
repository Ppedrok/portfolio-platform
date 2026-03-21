"""
portfolio_engine
================
Quantitative portfolio construction toolkit.

Modules
-------
data        – price download and return utilities
parameters  – Portfolio class (μ / Σ estimation, factor models, Black-Litterman)
optimizer   – Optimizer and Efficient_Frontier classes
backtest    – walk-forward Backtest class
utils       – shared statistical helpers

Quick start
-----------
>>> from portfolio_engine import Portfolio, Optimizer, Backtest
>>> from portfolio_engine.data import download_prices, compute_returns, split_returns
>>> from portfolio_engine.utils import compute_metrics, format_metrics
"""

from .parameters import Portfolio
from .optimizer  import Optimizer, Efficient_Frontier
from .backtest   import Backtest
from .data       import download_prices, compute_returns, split_returns
from .utils      import compute_metrics, format_metrics

__all__ = [
    "Portfolio",
    "Optimizer",
    "Efficient_Frontier",
    "Backtest",
    "download_prices",
    "compute_returns",
    "split_returns",
    "compute_metrics",
    "format_metrics",
]
