"""
data.py
-------
Price download and return computation utilities.
"""

import pandas as pd
import yfinance as yf


def download_prices(
    tickers: list[str],
    start: str,
    end: str,
    auto_adjust: bool = False,
) -> pd.DataFrame:
    """
    Download adjusted close prices from Yahoo Finance.

    Parameters
    ----------
    tickers : list[str]
        List of ticker symbols (e.g. ['AAPL', 'MSFT']).
    start : str
        Start date in 'YYYY-MM-DD' format.
    end : str
        End date in 'YYYY-MM-DD' format.
    auto_adjust : bool
        Passed directly to yfinance. Default False.

    Returns
    -------
    pd.DataFrame
        DataFrame of adjusted close prices, columns = tickers (sorted).
    """
    tickers_sorted = sorted(tickers)
    raw = yf.download(tickers_sorted, start=start, end=end, auto_adjust=auto_adjust)
    prices = raw.loc[:, ("Adj Close", slice(None))].copy()
    prices.columns = tickers_sorted
    return prices


def compute_returns(prices: pd.DataFrame) -> pd.DataFrame:
    """
    Compute simple daily returns from a price DataFrame, dropping the first NaN row.

    Parameters
    ----------
    prices : pd.DataFrame
        DataFrame of prices with DatetimeIndex.

    Returns
    -------
    pd.DataFrame
        Daily returns, same columns as input, no leading NaN.
    """
    return prices.pct_change().dropna()


def split_returns(
    returns: pd.DataFrame,
    assets: list[str],
    factors: list[str],
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Split a combined returns DataFrame into asset returns (Y) and factor returns (X).

    Parameters
    ----------
    returns : pd.DataFrame
        Full returns DataFrame containing both assets and factor columns.
    assets : list[str]
        Asset ticker names (columns to select as Y).
    factors : list[str]
        Factor ticker names (columns to select as X).

    Returns
    -------
    tuple[pd.DataFrame, pd.DataFrame]
        (Y, X) where Y = asset returns, X = factor returns.
    """
    return returns[assets], returns[factors]
