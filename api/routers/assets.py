"""
routers/assets.py
-----------------
GET  /api/assets/search   – fuzzy ticker search
POST /api/assets/prices   – historical adjusted-close prices
"""

from __future__ import annotations

import math
from typing import Annotated

import numpy as np
import riskfolio as rp
import yfinance as yf
from fastapi import APIRouter, HTTPException, Query

from portfolio_engine.data import download_prices, compute_returns

from ..schemas.requests  import OverviewRequest, PricesRequest
from ..schemas.responses import OverviewResponse, PricesResponse, SearchResponse, TickerMatch

router = APIRouter(prefix="/api/assets", tags=["assets"])


# ── Static ticker catalogue ───────────────────────────────────────────────────
# Maps ticker → (display name, exchange, asset_type, sector)
_CATALOGUE: dict[str, tuple[str, str, str, str]] = {
    # ── US Large Cap ──────────────────────────────────────────────────────────
    "AAPL":   ("Apple Inc.",                        "NASDAQ", "Equity", "Technology"),
    "MSFT":   ("Microsoft Corp.",                   "NASDAQ", "Equity", "Technology"),
    "GOOGL":  ("Alphabet Inc. (Class A)",           "NASDAQ", "Equity", "Technology"),
    "GOOG":   ("Alphabet Inc. (Class C)",           "NASDAQ", "Equity", "Technology"),
    "AMZN":   ("Amazon.com Inc.",                   "NASDAQ", "Equity", "Consumer Discretionary"),
    "NVDA":   ("NVIDIA Corp.",                      "NASDAQ", "Equity", "Technology"),
    "TSLA":   ("Tesla Inc.",                        "NASDAQ", "Equity", "Consumer Discretionary"),
    "META":   ("Meta Platforms Inc.",               "NASDAQ", "Equity", "Communication Services"),
    "AMD":    ("Advanced Micro Devices",            "NASDAQ", "Equity", "Technology"),
    "AVGO":   ("Broadcom Inc.",                     "NASDAQ", "Equity", "Technology"),
    "ASML":   ("ASML Holding NV (ADR)",             "NASDAQ", "Equity", "Technology"),
    "TSM":    ("Taiwan Semiconductor (ADR)",        "NYSE",   "Equity", "Technology"),
    "V":      ("Visa Inc.",                         "NYSE",   "Equity", "Financials"),
    "MA":     ("Mastercard Inc.",                   "NYSE",   "Equity", "Financials"),
    "JNJ":    ("Johnson & Johnson",                 "NYSE",   "Equity", "Healthcare"),
    "PG":     ("Procter & Gamble",                  "NYSE",   "Equity", "Consumer Staples"),
    "XOM":    ("Exxon Mobil Corp.",                 "NYSE",   "Equity", "Energy"),
    "CVX":    ("Chevron Corp.",                     "NYSE",   "Equity", "Energy"),
    "CAT":    ("Caterpillar Inc.",                  "NYSE",   "Equity", "Industrials"),
    "LIN":    ("Linde plc",                         "NYSE",   "Equity", "Materials"),
    "PEP":    ("PepsiCo Inc.",                      "NASDAQ", "Equity", "Consumer Staples"),
    "KO":     ("Coca-Cola Co.",                     "NYSE",   "Equity", "Consumer Staples"),
    "BMY":    ("Bristol-Myers Squibb",              "NYSE",   "Equity", "Healthcare"),
    "PFE":    ("Pfizer Inc.",                       "NYSE",   "Equity", "Healthcare"),
    "MRK":    ("Merck & Co.",                       "NYSE",   "Equity", "Healthcare"),
    "ABBV":   ("AbbVie Inc.",                       "NYSE",   "Equity", "Healthcare"),
    "UNH":    ("UnitedHealth Group",                "NYSE",   "Equity", "Healthcare"),
    "LLY":    ("Eli Lilly and Co.",                 "NYSE",   "Equity", "Healthcare"),
    "AMGN":   ("Amgen Inc.",                        "NASDAQ", "Equity", "Healthcare"),
    "GILD":   ("Gilead Sciences",                   "NASDAQ", "Equity", "Healthcare"),
    "NFLX":   ("Netflix Inc.",                      "NASDAQ", "Equity", "Communication Services"),
    "DIS":    ("Walt Disney Co.",                   "NYSE",   "Equity", "Communication Services"),
    "CMCSA":  ("Comcast Corp.",                     "NASDAQ", "Equity", "Communication Services"),
    "T":      ("AT&T Inc.",                         "NYSE",   "Equity", "Communication Services"),
    "VZ":     ("Verizon Communications",            "NYSE",   "Equity", "Communication Services"),
    "INTC":   ("Intel Corp.",                       "NASDAQ", "Equity", "Technology"),
    "QCOM":   ("Qualcomm Inc.",                     "NASDAQ", "Equity", "Technology"),
    "TXN":    ("Texas Instruments",                 "NASDAQ", "Equity", "Technology"),
    "MU":     ("Micron Technology",                 "NASDAQ", "Equity", "Technology"),
    "CRM":    ("Salesforce Inc.",                   "NYSE",   "Equity", "Technology"),
    "ORCL":   ("Oracle Corp.",                      "NYSE",   "Equity", "Technology"),
    "IBM":    ("IBM Corp.",                         "NYSE",   "Equity", "Technology"),
    "ADBE":   ("Adobe Inc.",                        "NASDAQ", "Equity", "Technology"),
    "NOW":    ("ServiceNow Inc.",                   "NYSE",   "Equity", "Technology"),
    "SNOW":   ("Snowflake Inc.",                    "NYSE",   "Equity", "Technology"),
    "PLTR":   ("Palantir Technologies",             "NYSE",   "Equity", "Technology"),
    "UBER":   ("Uber Technologies",                 "NYSE",   "Equity", "Industrials"),
    "ABNB":   ("Airbnb Inc.",                       "NASDAQ", "Equity", "Consumer Discretionary"),
    "SHOP":   ("Shopify Inc.",                      "NYSE",   "Equity", "Technology"),
    "SQ":     ("Block Inc.",                        "NYSE",   "Equity", "Financials"),
    "PYPL":   ("PayPal Holdings",                   "NASDAQ", "Equity", "Financials"),
    "BA":     ("Boeing Co.",                        "NYSE",   "Equity", "Aerospace & Defense"),
    "LMT":    ("Lockheed Martin",                   "NYSE",   "Equity", "Aerospace & Defense"),
    "RTX":    ("RTX Corp.",                         "NYSE",   "Equity", "Aerospace & Defense"),
    "GS":     ("Goldman Sachs Group",               "NYSE",   "Equity", "Financials"),
    "JPM":    ("JPMorgan Chase & Co.",              "NYSE",   "Equity", "Financials"),
    "BAC":    ("Bank of America",                   "NYSE",   "Equity", "Financials"),
    "WFC":    ("Wells Fargo & Co.",                 "NYSE",   "Equity", "Financials"),
    "MS":     ("Morgan Stanley",                    "NYSE",   "Equity", "Financials"),
    "C":      ("Citigroup Inc.",                    "NYSE",   "Equity", "Financials"),
    "BRK-B":  ("Berkshire Hathaway B",              "NYSE",   "Equity", "Financials"),
    "WMT":    ("Walmart Inc.",                      "NYSE",   "Equity", "Consumer Staples"),
    "COST":   ("Costco Wholesale",                  "NASDAQ", "Equity", "Consumer Staples"),
    "HD":     ("Home Depot Inc.",                   "NYSE",   "Equity", "Consumer Discretionary"),
    "MCD":    ("McDonald's Corp.",                  "NYSE",   "Equity", "Consumer Discretionary"),
    "SBUX":   ("Starbucks Corp.",                   "NASDAQ", "Equity", "Consumer Discretionary"),
    "NKE":    ("Nike Inc.",                         "NYSE",   "Equity", "Consumer Discretionary"),
    "PM":     ("Philip Morris Int'l",               "NYSE",   "Equity", "Consumer Staples"),
    "NEE":    ("NextEra Energy",                    "NYSE",   "Equity", "Utilities"),
    "SO":     ("Southern Co.",                      "NYSE",   "Equity", "Utilities"),
    "AMT":    ("American Tower Corp.",              "NYSE",   "Equity", "Real Estate"),
    "PLD":    ("Prologis Inc.",                     "NYSE",   "Equity", "Real Estate"),
    # ── Italian Equities (Borsa Italiana) ─────────────────────────────────────
    "LDO.MI":  ("Leonardo SpA",                     "MIL",    "Equity", "Aerospace & Defense"),
    "ISP.MI":  ("Intesa Sanpaolo",                  "MIL",    "Equity", "Financials"),
    "UCG.MI":  ("UniCredit SpA",                    "MIL",    "Equity", "Financials"),
    "ENEL.MI": ("Enel SpA",                         "MIL",    "Equity", "Utilities"),
    "ENI.MI":  ("Eni SpA",                          "MIL",    "Equity", "Energy"),
    "RACE.MI": ("Ferrari NV",                       "MIL",    "Equity", "Consumer Discretionary"),
    "STLA.MI": ("Stellantis NV",                    "MIL",    "Equity", "Consumer Discretionary"),
    "G.MI":    ("Assicurazioni Generali",           "MIL",    "Equity", "Financials"),
    "PRY.MI":  ("Prysmian SpA",                     "MIL",    "Equity", "Industrials"),
    "MONC.MI": ("Moncler SpA",                      "MIL",    "Equity", "Consumer Discretionary"),
    "MB.MI":   ("Mediobanca SpA",                   "MIL",    "Equity", "Financials"),
    "BAMI.MI": ("Banco BPM SpA",                    "MIL",    "Equity", "Financials"),
    "FBK.MI":  ("FinecoBank SpA",                   "MIL",    "Equity", "Financials"),
    "PST.MI":  ("Poste Italiane SpA",               "MIL",    "Equity", "Financials"),
    "SRG.MI":  ("Snam SpA",                         "MIL",    "Equity", "Utilities"),
    "TRN.MI":  ("Terna SpA",                        "MIL",    "Equity", "Utilities"),
    "TEN.MI":  ("Tenaris SA",                       "MIL",    "Equity", "Energy"),
    "SPM.MI":  ("Saipem SpA",                       "MIL",    "Equity", "Energy"),
    "CPR.MI":  ("Davide Campari-Milano",            "MIL",    "Equity", "Consumer Staples"),
    "REC.MI":  ("Recordati SpA",                    "MIL",    "Equity", "Healthcare"),
    "DIA.MI":  ("DiaSorin SpA",                     "MIL",    "Equity", "Healthcare"),
    "AMP.MI":  ("Amplifon SpA",                     "MIL",    "Equity", "Healthcare"),
    "A2A.MI":  ("A2A SpA",                          "MIL",    "Equity", "Utilities"),
    "AZM.MI":  ("Azimut Holding",                   "MIL",    "Equity", "Financials"),
    "PIRC.MI": ("Pirelli & C. SpA",                 "MIL",    "Equity", "Consumer Discretionary"),
    "STM.MI":  ("STMicroelectronics NV",            "MIL",    "Equity", "Technology"),
    "BMED.MI": ("Banca Mediolanum",                 "MIL",    "Equity", "Financials"),
    "CNHI.MI": ("CNH Industrial NV",                "MIL",    "Equity", "Industrials"),
    "IP.MI":   ("International Paper (MIL)",        "MIL",    "Equity", "Materials"),
    "TIT.MI":  ("Telecom Italia SpA",               "MIL",    "Equity", "Communication Services"),
    # ── French Equities (Euronext Paris) ─────────────────────────────────────
    "MC.PA":   ("LVMH Moët Hennessy",              "EPA",    "Equity", "Consumer Discretionary"),
    "OR.PA":   ("L'Oréal SA",                       "EPA",    "Equity", "Consumer Staples"),
    "TTE.PA":  ("TotalEnergies SE",                 "EPA",    "Equity", "Energy"),
    "SAN.PA":  ("Sanofi SA",                        "EPA",    "Equity", "Healthcare"),
    "AIR.PA":  ("Airbus SE",                        "EPA",    "Equity", "Aerospace & Defense"),
    "BNP.PA":  ("BNP Paribas SA",                   "EPA",    "Equity", "Financials"),
    "SU.PA":   ("Schneider Electric SE",            "EPA",    "Equity", "Industrials"),
    "RI.PA":   ("Pernod Ricard SA",                 "EPA",    "Equity", "Consumer Staples"),
    "DG.PA":   ("Vinci SA",                         "EPA",    "Equity", "Industrials"),
    "CS.PA":   ("AXA SA",                           "EPA",    "Equity", "Financials"),
    "HO.PA":   ("Thales SA",                        "EPA",    "Equity", "Aerospace & Defense"),
    "CAP.PA":  ("Capgemini SE",                     "EPA",    "Equity", "Technology"),
    "DSY.PA":  ("Dassault Systèmes SE",             "EPA",    "Equity", "Technology"),
    "ORA.PA":  ("Orange SA",                        "EPA",    "Equity", "Communication Services"),
    # ── German Equities (XETRA) ───────────────────────────────────────────────
    "SAP.DE":  ("SAP SE",                           "XETRA",  "Equity", "Technology"),
    "SIE.DE":  ("Siemens AG",                       "XETRA",  "Equity", "Industrials"),
    "ALV.DE":  ("Allianz SE",                       "XETRA",  "Equity", "Financials"),
    "MBG.DE":  ("Mercedes-Benz Group AG",           "XETRA",  "Equity", "Consumer Discretionary"),
    "BMW.DE":  ("BMW AG",                            "XETRA",  "Equity", "Consumer Discretionary"),
    "VOW3.DE": ("Volkswagen AG (Pref.)",             "XETRA",  "Equity", "Consumer Discretionary"),
    "BAYN.DE": ("Bayer AG",                         "XETRA",  "Equity", "Healthcare"),
    "ADS.DE":  ("Adidas AG",                        "XETRA",  "Equity", "Consumer Discretionary"),
    "DTE.DE":  ("Deutsche Telekom AG",              "XETRA",  "Equity", "Communication Services"),
    "MUV2.DE": ("Munich Re (Münchener Rück)",       "XETRA",  "Equity", "Financials"),
    "DB1.DE":  ("Deutsche Börse AG",                "XETRA",  "Equity", "Financials"),
    "PPFB.DE": ("Porsche AG",                       "XETRA",  "Equity", "Consumer Discretionary"),
    "RWE.DE":  ("RWE AG",                           "XETRA",  "Equity", "Utilities"),
    "BAS.DE":  ("BASF SE",                          "XETRA",  "Equity", "Materials"),
    "EOAN.DE": ("E.ON SE",                          "XETRA",  "Equity", "Utilities"),
    # ── UK Equities (London Stock Exchange) ───────────────────────────────────
    "AZN.L":   ("AstraZeneca plc",                  "LSE",    "Equity", "Healthcare"),
    "SHEL.L":  ("Shell plc",                        "LSE",    "Equity", "Energy"),
    "HSBA.L":  ("HSBC Holdings plc",                "LSE",    "Equity", "Financials"),
    "BP.L":    ("BP plc",                           "LSE",    "Equity", "Energy"),
    "GSK.L":   ("GSK plc",                          "LSE",    "Equity", "Healthcare"),
    "ULVR.L":  ("Unilever plc",                     "LSE",    "Equity", "Consumer Staples"),
    "RIO.L":   ("Rio Tinto plc",                    "LSE",    "Equity", "Materials"),
    "VOD.L":   ("Vodafone Group plc",               "LSE",    "Equity", "Communication Services"),
    "BA.L":    ("BAE Systems plc",                  "LSE",    "Equity", "Aerospace & Defense"),
    "GLEN.L":  ("Glencore plc",                     "LSE",    "Equity", "Materials"),
    "REL.L":   ("RELX plc",                         "LSE",    "Equity", "Technology"),
    "DGE.L":   ("Diageo plc",                       "LSE",    "Equity", "Consumer Staples"),
    # ── Swiss Equities ────────────────────────────────────────────────────────
    "NOVN.SW": ("Novartis AG",                      "SWX",    "Equity", "Healthcare"),
    "NESN.SW": ("Nestlé SA",                        "SWX",    "Equity", "Consumer Staples"),
    "ROG.SW":  ("Roche Holding AG",                 "SWX",    "Equity", "Healthcare"),
    "UBSG.SW": ("UBS Group AG",                     "SWX",    "Equity", "Financials"),
    "ABBN.SW": ("ABB Ltd",                          "SWX",    "Equity", "Industrials"),
    # ── Spanish Equities ──────────────────────────────────────────────────────
    "ITX.MC":  ("Inditex SA (Zara)",                "BME",    "Equity", "Consumer Discretionary"),
    "SAN.MC":  ("Banco Santander SA",               "BME",    "Equity", "Financials"),
    "BBVA.MC": ("BBVA SA",                          "BME",    "Equity", "Financials"),
    "IBE.MC":  ("Iberdrola SA",                     "BME",    "Equity", "Utilities"),
    "REP.MC":  ("Repsol SA",                        "BME",    "Equity", "Energy"),
    # ── Other International ───────────────────────────────────────────────────
    "NVO":     ("Novo Nordisk A/S (ADR)",           "NYSE",   "Equity", "Healthcare"),
    "TM":      ("Toyota Motor Corp. (ADR)",         "NYSE",   "Equity", "Consumer Discretionary"),
    "SNY":     ("Sanofi SA (ADR)",                  "NASDAQ", "Equity", "Healthcare"),
    "SONY":    ("Sony Group Corp. (ADR)",           "NYSE",   "Equity", "Consumer Discretionary"),
    "SAP":     ("SAP SE (ADR)",                     "NYSE",   "Equity", "Technology"),
    "BABA":    ("Alibaba Group (ADR)",              "NYSE",   "Equity", "Consumer Discretionary"),
    "JD":      ("JD.com Inc. (ADR)",                "NASDAQ", "Equity", "Consumer Discretionary"),
    # ── Broad Market ETFs ─────────────────────────────────────────────────────
    "SPY":     ("SPDR S&P 500 ETF",                 "NYSE",   "ETF",    "Broad Market"),
    "VOO":     ("Vanguard S&P 500 ETF",             "NYSE",   "ETF",    "Broad Market"),
    "VTI":     ("Vanguard Total Stock Market ETF",  "NYSE",   "ETF",    "Broad Market"),
    "QQQ":     ("Invesco QQQ Trust (NASDAQ 100)",   "NASDAQ", "ETF",    "Technology"),
    "IWM":     ("iShares Russell 2000 ETF",         "NYSE",   "ETF",    "Broad Market"),
    "VEA":     ("Vanguard Developed Markets ETF",   "NYSE",   "ETF",    "International Equity"),
    "VWO":     ("Vanguard Emerging Markets ETF",    "NYSE",   "ETF",    "International Equity"),
    "EFA":     ("iShares MSCI EAFE ETF",            "NYSE",   "ETF",    "International Equity"),
    "EEM":     ("iShares MSCI Emerging Markets",    "NYSE",   "ETF",    "International Equity"),
    # ── Factor ETFs ──────────────────────────────────────────────────────────
    "MTUM":    ("iShares MSCI USA Momentum",        "NASDAQ", "ETF",    "Factor ETF"),
    "QUAL":    ("iShares MSCI USA Quality",         "NASDAQ", "ETF",    "Factor ETF"),
    "USMV":    ("iShares MSCI USA Min Vol",         "NASDAQ", "ETF",    "Factor ETF"),
    "VLUE":    ("iShares MSCI USA Value",           "NASDAQ", "ETF",    "Factor ETF"),
    "SIZE":    ("iShares MSCI USA Size",            "NASDAQ", "ETF",    "Factor ETF"),
    # ── Fixed Income ETFs ─────────────────────────────────────────────────────
    "TLT":     ("iShares 20+ Year Treasury Bond",  "NASDAQ", "ETF",    "Government Bonds"),
    "IEF":     ("iShares 7-10 Year Treasury Bond", "NASDAQ", "ETF",    "Government Bonds"),
    "SHY":     ("iShares 1-3 Year Treasury Bond",  "NASDAQ", "ETF",    "Government Bonds"),
    "AGG":     ("iShares Core US Aggregate Bond",  "NYSE",   "ETF",    "Aggregate Bonds"),
    "LQD":     ("iShares iBoxx IG Corporate Bond", "NYSE",   "ETF",    "Corporate Bonds"),
    "HYG":     ("iShares iBoxx HY Corporate Bond", "NYSE",   "ETF",    "Corporate Bonds"),
    "EMB":     ("iShares JP Morgan EM Bond ETF",   "NYSE",   "ETF",    "Emerging Market Bonds"),
    # ── Commodity / Macro ETFs ────────────────────────────────────────────────
    "GLD":     ("SPDR Gold Shares",                 "NYSE",   "ETF",    "Commodities"),
    "SLV":     ("iShares Silver Trust",             "NYSE",   "ETF",    "Commodities"),
    "IAU":     ("iShares Gold Trust",               "NYSE",   "ETF",    "Commodities"),
    "USO":     ("United States Oil Fund",           "NYSE",   "ETF",    "Commodities"),
    "VNQ":     ("Vanguard Real Estate ETF",         "NYSE",   "ETF",    "Real Estate"),
    "GDX":     ("VanEck Gold Miners ETF",           "NYSE",   "ETF",    "Commodities"),
    "DBC":     ("Invesco DB Commodity Index",       "NYSE",   "ETF",    "Commodities"),
    # ── Crypto ───────────────────────────────────────────────────────────────
    "BTC-USD": ("Bitcoin USD",                      "Crypto", "Crypto", "Cryptocurrency"),
    "ETH-USD": ("Ethereum USD",                     "Crypto", "Crypto", "Cryptocurrency"),
}


def _score(ticker: str, name: str, query: str) -> int:
    """Simple priority score: exact > prefix > substring (case-insensitive)."""
    q = query.upper()
    t = ticker.upper()
    n = name.upper()
    if t == q:
        return 3
    if t.startswith(q) or n.startswith(q):
        return 2
    if q in t or q in n:
        return 1
    return 0


# ── Search endpoint ───────────────────────────────────────────────────────────

def _yf_lookup(query: str) -> TickerMatch | None:
    """
    Try to resolve an arbitrary ticker directly via yfinance.
    Returns None silently if the ticker doesn't exist or has no price.
    Used as a fallback when the query is not in _CATALOGUE.
    """
    try:
        t = yf.Ticker(query.upper())
        info = t.fast_info
        price = getattr(info, "last_price", None)
        if price is None or (isinstance(price, float) and math.isnan(price)):
            return None
        # Try to get a display name from the info dict
        full = t.info
        name     = full.get("longName") or full.get("shortName") or query.upper()
        exchange = full.get("exchange") or full.get("market") or "Unknown"
        atype    = full.get("quoteType") or "Equity"
        sector   = full.get("sector") or ""
        return TickerMatch(
            ticker=query.upper(),
            name=name,
            exchange=exchange,
            asset_type=atype.capitalize(),
            sector=sector,
        )
    except Exception:
        return None


@router.get("/search", response_model=SearchResponse, summary="Search tickers")
def search_tickers(
    query: Annotated[str, Query(min_length=1, max_length=20, description="Partial ticker or name")]
) -> SearchResponse:
    """
    Return tickers matching *query* from the built-in catalogue.
    If the query looks like an exact ticker and is not found in the catalogue,
    falls back to a live yfinance lookup so any valid Yahoo Finance symbol works.
    """
    matches: list[tuple[int, TickerMatch]] = []

    for ticker, (name, exchange, asset_type, sector) in _CATALOGUE.items():
        score = _score(ticker, name, query)
        if score > 0:
            matches.append((score, TickerMatch(
                ticker=ticker, name=name,
                exchange=exchange, asset_type=asset_type,
                sector=sector,
            )))

    matches.sort(key=lambda x: -x[0])

    # ── Dynamic fallback: if the query looks like a ticker and wasn't found ───
    # Trigger when: no catalogue hits OR only low-confidence hits,
    # AND the query has no spaces (i.e. it could be a ticker symbol).
    q_upper   = query.upper().strip()
    looks_like_ticker = " " not in query and len(q_upper) >= 2
    catalogue_tickers = {m.ticker for _, m in matches}

    if looks_like_ticker and q_upper not in catalogue_tickers:
        live = _yf_lookup(q_upper)
        if live:
            # Prepend with score 4 (higher than any catalogue match)
            matches.insert(0, (4, live))

    return SearchResponse(query=query, results=[m for _, m in matches])


# ── Overview endpoint ─────────────────────────────────────────────────────────

def _safe_f(v) -> float | None:
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 6)
    except Exception:
        return None


@router.post("/overview", summary="Asset codependence overview")
def get_overview(body: OverviewRequest):
    try:
        tickers = sorted(set(t.upper() for t in body.tickers))
        prices  = download_prices(tickers, body.start, body.end)
        returns = compute_returns(prices)[tickers]

        kwargs: dict = {"codependence": body.method}
        if body.method == "mutual_info":
            kwargs["bins_info"] = "KN"
        elif body.method == "tail":
            kwargs["alpha_tail"] = 0.05
        elif body.method in ("gerber1", "gerber2"):
            kwargs["gs_threshold"] = 0.5

        codep, dist = rp.codep_dist(returns, **kwargs)

        ann_ret, ann_vol, sharpes = {}, {}, {}
        for t in tickers:
            s = returns[t]
            r = float((1 + s).prod() ** (252 / len(s)) - 1)
            v = float(s.std() * np.sqrt(252))
            ann_ret[t] = round(r, 6)
            ann_vol[t] = round(v, 6)
            sharpes[t] = round(r / v if v > 0 else 0, 4)

        return {
            "tickers":            tickers,
            "method":             body.method,
            "codependence":       codep.round(6).to_dict(),
            "distance":           dist.round(6).to_dict(),
            "annualized_returns": ann_ret,
            "annualized_vols":    ann_vol,
            "sharpes":            sharpes,
        }
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Prices endpoint ───────────────────────────────────────────────────────────

@router.post("/prices", response_model=PricesResponse, summary="Fetch historical prices")
def get_prices(body: PricesRequest) -> PricesResponse:
    """
    Download adjusted-close prices from Yahoo Finance for the requested tickers
    and date range.

    Returns dates as ISO-8601 strings and prices as parallel lists per ticker.
    Missing values are represented as `null`.
    """
    if body.start >= body.end:
        raise HTTPException(status_code=422, detail="'start' must be before 'end'")

    try:
        tickers = sorted(set(t.upper() for t in body.tickers))
        raw = yf.download(
            tickers, start=body.start, end=body.end,
            auto_adjust=False, progress=False,
        )
        if raw.empty:
            raise HTTPException(
                status_code=422,
                detail="No price data returned. Check tickers and date range.",
            )

        prices = raw.loc[:, ("Adj Close", slice(None))].copy()
        prices.columns = tickers

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Price download failed: {exc}")

    dates = [d.strftime("%Y-%m-%d") for d in prices.index]
    price_dict: dict[str, list[float | None]] = {}
    for t in tickers:
        if t in prices.columns:
            price_dict[t] = [
                None if math.isnan(v) else round(float(v), 4)
                for v in prices[t].tolist()
            ]
        else:
            price_dict[t] = [None] * len(dates)

    return PricesResponse(tickers=tickers, dates=dates, prices=price_dict)
