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
# Maps ticker → (display name, exchange, asset_type)
_CATALOGUE: dict[str, tuple[str, str, str]] = {
    # ── US Large Cap ──────────────────────────────────────────────────────────
    "AAPL":   ("Apple Inc.",                        "NASDAQ", "Equity"),
    "MSFT":   ("Microsoft Corp.",                   "NASDAQ", "Equity"),
    "GOOGL":  ("Alphabet Inc. (Class A)",           "NASDAQ", "Equity"),
    "GOOG":   ("Alphabet Inc. (Class C)",           "NASDAQ", "Equity"),
    "AMZN":   ("Amazon.com Inc.",                   "NASDAQ", "Equity"),
    "NVDA":   ("NVIDIA Corp.",                      "NASDAQ", "Equity"),
    "TSLA":   ("Tesla Inc.",                        "NASDAQ", "Equity"),
    "META":   ("Meta Platforms Inc.",               "NASDAQ", "Equity"),
    "AMD":    ("Advanced Micro Devices",            "NASDAQ", "Equity"),
    "AVGO":   ("Broadcom Inc.",                     "NASDAQ", "Equity"),
    "ASML":   ("ASML Holding NV (ADR)",             "NASDAQ", "Equity"),
    "TSM":    ("Taiwan Semiconductor (ADR)",        "NYSE",   "Equity"),
    "V":      ("Visa Inc.",                         "NYSE",   "Equity"),
    "MA":     ("Mastercard Inc.",                   "NYSE",   "Equity"),
    "JNJ":    ("Johnson & Johnson",                 "NYSE",   "Equity"),
    "PG":     ("Procter & Gamble",                  "NYSE",   "Equity"),
    "XOM":    ("Exxon Mobil Corp.",                 "NYSE",   "Equity"),
    "CVX":    ("Chevron Corp.",                     "NYSE",   "Equity"),
    "CAT":    ("Caterpillar Inc.",                  "NYSE",   "Equity"),
    "LIN":    ("Linde plc",                         "NYSE",   "Equity"),
    "PEP":    ("PepsiCo Inc.",                      "NASDAQ", "Equity"),
    "KO":     ("Coca-Cola Co.",                     "NYSE",   "Equity"),
    "BMY":    ("Bristol-Myers Squibb",              "NYSE",   "Equity"),
    "PFE":    ("Pfizer Inc.",                       "NYSE",   "Equity"),
    "MRK":    ("Merck & Co.",                       "NYSE",   "Equity"),
    "ABBV":   ("AbbVie Inc.",                       "NYSE",   "Equity"),
    "UNH":    ("UnitedHealth Group",                "NYSE",   "Equity"),
    "LLY":    ("Eli Lilly and Co.",                 "NYSE",   "Equity"),
    "AMGN":   ("Amgen Inc.",                        "NASDAQ", "Equity"),
    "GILD":   ("Gilead Sciences",                   "NASDAQ", "Equity"),
    "NFLX":   ("Netflix Inc.",                      "NASDAQ", "Equity"),
    "DIS":    ("Walt Disney Co.",                   "NYSE",   "Equity"),
    "CMCSA":  ("Comcast Corp.",                     "NASDAQ", "Equity"),
    "T":      ("AT&T Inc.",                         "NYSE",   "Equity"),
    "VZ":     ("Verizon Communications",            "NYSE",   "Equity"),
    "INTC":   ("Intel Corp.",                       "NASDAQ", "Equity"),
    "QCOM":   ("Qualcomm Inc.",                     "NASDAQ", "Equity"),
    "TXN":    ("Texas Instruments",                 "NASDAQ", "Equity"),
    "MU":     ("Micron Technology",                 "NASDAQ", "Equity"),
    "CRM":    ("Salesforce Inc.",                   "NYSE",   "Equity"),
    "ORCL":   ("Oracle Corp.",                      "NYSE",   "Equity"),
    "IBM":    ("IBM Corp.",                         "NYSE",   "Equity"),
    "ADBE":   ("Adobe Inc.",                        "NASDAQ", "Equity"),
    "NOW":    ("ServiceNow Inc.",                   "NYSE",   "Equity"),
    "SNOW":   ("Snowflake Inc.",                    "NYSE",   "Equity"),
    "PLTR":   ("Palantir Technologies",             "NYSE",   "Equity"),
    "UBER":   ("Uber Technologies",                 "NYSE",   "Equity"),
    "ABNB":   ("Airbnb Inc.",                       "NASDAQ", "Equity"),
    "SHOP":   ("Shopify Inc.",                      "NYSE",   "Equity"),
    "SQ":     ("Block Inc.",                        "NYSE",   "Equity"),
    "PYPL":   ("PayPal Holdings",                   "NASDAQ", "Equity"),
    "BA":     ("Boeing Co.",                        "NYSE",   "Equity"),
    "LMT":    ("Lockheed Martin",                   "NYSE",   "Equity"),
    "RTX":    ("RTX Corp.",                         "NYSE",   "Equity"),
    "GS":     ("Goldman Sachs Group",               "NYSE",   "Equity"),
    "JPM":    ("JPMorgan Chase & Co.",              "NYSE",   "Equity"),
    "BAC":    ("Bank of America",                   "NYSE",   "Equity"),
    "WFC":    ("Wells Fargo & Co.",                 "NYSE",   "Equity"),
    "MS":     ("Morgan Stanley",                    "NYSE",   "Equity"),
    "C":      ("Citigroup Inc.",                    "NYSE",   "Equity"),
    "BRK-B":  ("Berkshire Hathaway B",              "NYSE",   "Equity"),
    "WMT":    ("Walmart Inc.",                      "NYSE",   "Equity"),
    "COST":   ("Costco Wholesale",                  "NASDAQ", "Equity"),
    "HD":     ("Home Depot Inc.",                   "NYSE",   "Equity"),
    "MCD":    ("McDonald's Corp.",                  "NYSE",   "Equity"),
    "SBUX":   ("Starbucks Corp.",                   "NASDAQ", "Equity"),
    "NKE":    ("Nike Inc.",                         "NYSE",   "Equity"),
    "PM":     ("Philip Morris Int'l",               "NYSE",   "Equity"),
    "NEE":    ("NextEra Energy",                    "NYSE",   "Equity"),
    "SO":     ("Southern Co.",                      "NYSE",   "Equity"),
    "AMT":    ("American Tower Corp.",              "NYSE",   "Equity"),
    "PLD":    ("Prologis Inc.",                     "NYSE",   "Equity"),
    # ── Italian Equities (Borsa Italiana) ─────────────────────────────────────
    "LDO.MI":  ("Leonardo SpA",                     "MIL",    "Equity"),
    "ISP.MI":  ("Intesa Sanpaolo",                  "MIL",    "Equity"),
    "UCG.MI":  ("UniCredit SpA",                    "MIL",    "Equity"),
    "ENEL.MI": ("Enel SpA",                         "MIL",    "Equity"),
    "ENI.MI":  ("Eni SpA",                          "MIL",    "Equity"),
    "RACE.MI": ("Ferrari NV",                       "MIL",    "Equity"),
    "STLA.MI": ("Stellantis NV",                    "MIL",    "Equity"),
    "G.MI":    ("Assicurazioni Generali",           "MIL",    "Equity"),
    "PRY.MI":  ("Prysmian SpA",                     "MIL",    "Equity"),
    "MONC.MI": ("Moncler SpA",                      "MIL",    "Equity"),
    "MB.MI":   ("Mediobanca SpA",                   "MIL",    "Equity"),
    "BAMI.MI": ("Banco BPM SpA",                    "MIL",    "Equity"),
    "FBK.MI":  ("FinecoBank SpA",                   "MIL",    "Equity"),
    "PST.MI":  ("Poste Italiane SpA",               "MIL",    "Equity"),
    "SRG.MI":  ("Snam SpA",                         "MIL",    "Equity"),
    "TRN.MI":  ("Terna SpA",                        "MIL",    "Equity"),
    "TEN.MI":  ("Tenaris SA",                       "MIL",    "Equity"),
    "SPM.MI":  ("Saipem SpA",                       "MIL",    "Equity"),
    "CPR.MI":  ("Davide Campari-Milano",            "MIL",    "Equity"),
    "REC.MI":  ("Recordati SpA",                    "MIL",    "Equity"),
    "DIA.MI":  ("DiaSorin SpA",                     "MIL",    "Equity"),
    "AMP.MI":  ("Amplifon SpA",                     "MIL",    "Equity"),
    "A2A.MI":  ("A2A SpA",                          "MIL",    "Equity"),
    "AZM.MI":  ("Azimut Holding",                   "MIL",    "Equity"),
    "PIRC.MI": ("Pirelli & C. SpA",                 "MIL",    "Equity"),
    "STM.MI":  ("STMicroelectronics NV",            "MIL",    "Equity"),
    "BMED.MI": ("Banca Mediolanum",                 "MIL",    "Equity"),
    "CNHI.MI": ("CNH Industrial NV",                "MIL",    "Equity"),
    "IP.MI":   ("International Paper (MIL)",        "MIL",    "Equity"),
    "TIT.MI":  ("Telecom Italia SpA",               "MIL",    "Equity"),
    # ── French Equities (Euronext Paris) ─────────────────────────────────────
    "MC.PA":   ("LVMH Moët Hennessy",              "EPA",    "Equity"),
    "OR.PA":   ("L'Oréal SA",                       "EPA",    "Equity"),
    "TTE.PA":  ("TotalEnergies SE",                 "EPA",    "Equity"),
    "SAN.PA":  ("Sanofi SA",                        "EPA",    "Equity"),
    "AIR.PA":  ("Airbus SE",                        "EPA",    "Equity"),
    "BNP.PA":  ("BNP Paribas SA",                   "EPA",    "Equity"),
    "SU.PA":   ("Schneider Electric SE",            "EPA",    "Equity"),
    "RI.PA":   ("Pernod Ricard SA",                 "EPA",    "Equity"),
    "DG.PA":   ("Vinci SA",                         "EPA",    "Equity"),
    "CS.PA":   ("AXA SA",                           "EPA",    "Equity"),
    "HO.PA":   ("Thales SA",                        "EPA",    "Equity"),
    "CAP.PA":  ("Capgemini SE",                     "EPA",    "Equity"),
    "DSY.PA":  ("Dassault Systèmes SE",             "EPA",    "Equity"),
    "ORA.PA":  ("Orange SA",                        "EPA",    "Equity"),
    # ── German Equities (XETRA) ───────────────────────────────────────────────
    "SAP.DE":  ("SAP SE",                           "XETRA",  "Equity"),
    "SIE.DE":  ("Siemens AG",                       "XETRA",  "Equity"),
    "ALV.DE":  ("Allianz SE",                       "XETRA",  "Equity"),
    "MBG.DE":  ("Mercedes-Benz Group AG",           "XETRA",  "Equity"),
    "BMW.DE":  ("BMW AG",                            "XETRA",  "Equity"),
    "VOW3.DE": ("Volkswagen AG (Pref.)",             "XETRA",  "Equity"),
    "BAYN.DE": ("Bayer AG",                         "XETRA",  "Equity"),
    "ADS.DE":  ("Adidas AG",                        "XETRA",  "Equity"),
    "DTE.DE":  ("Deutsche Telekom AG",              "XETRA",  "Equity"),
    "MUV2.DE": ("Munich Re (Münchener Rück)",       "XETRA",  "Equity"),
    "DB1.DE":  ("Deutsche Börse AG",                "XETRA",  "Equity"),
    "PPFB.DE": ("Porsche AG",                       "XETRA",  "Equity"),
    "RWE.DE":  ("RWE AG",                           "XETRA",  "Equity"),
    "BAS.DE":  ("BASF SE",                          "XETRA",  "Equity"),
    "EOAN.DE": ("E.ON SE",                          "XETRA",  "Equity"),
    # ── UK Equities (London Stock Exchange) ───────────────────────────────────
    "AZN.L":   ("AstraZeneca plc",                  "LSE",    "Equity"),
    "SHEL.L":  ("Shell plc",                        "LSE",    "Equity"),
    "HSBA.L":  ("HSBC Holdings plc",                "LSE",    "Equity"),
    "BP.L":    ("BP plc",                           "LSE",    "Equity"),
    "GSK.L":   ("GSK plc",                          "LSE",    "Equity"),
    "ULVR.L":  ("Unilever plc",                     "LSE",    "Equity"),
    "RIO.L":   ("Rio Tinto plc",                    "LSE",    "Equity"),
    "VOD.L":   ("Vodafone Group plc",               "LSE",    "Equity"),
    "BA.L":    ("BAE Systems plc",                  "LSE",    "Equity"),
    "GLEN.L":  ("Glencore plc",                     "LSE",    "Equity"),
    "REL.L":   ("RELX plc",                         "LSE",    "Equity"),
    "DGE.L":   ("Diageo plc",                       "LSE",    "Equity"),
    # ── Swiss Equities ────────────────────────────────────────────────────────
    "NOVN.SW": ("Novartis AG",                      "SWX",    "Equity"),
    "NESN.SW": ("Nestlé SA",                        "SWX",    "Equity"),
    "ROG.SW":  ("Roche Holding AG",                 "SWX",    "Equity"),
    "UBSG.SW": ("UBS Group AG",                     "SWX",    "Equity"),
    "ABBN.SW": ("ABB Ltd",                          "SWX",    "Equity"),
    # ── Spanish Equities ──────────────────────────────────────────────────────
    "ITX.MC":  ("Inditex SA (Zara)",                "BME",    "Equity"),
    "SAN.MC":  ("Banco Santander SA",               "BME",    "Equity"),
    "BBVA.MC": ("BBVA SA",                          "BME",    "Equity"),
    "IBE.MC":  ("Iberdrola SA",                     "BME",    "Equity"),
    "REP.MC":  ("Repsol SA",                        "BME",    "Equity"),
    # ── Other International ───────────────────────────────────────────────────
    "ASML":    ("ASML Holding NV (ADR)",            "NASDAQ", "Equity"),
    "NVO":     ("Novo Nordisk A/S (ADR)",           "NYSE",   "Equity"),
    "TM":      ("Toyota Motor Corp. (ADR)",         "NYSE",   "Equity"),
    "SNY":     ("Sanofi SA (ADR)",                  "NASDAQ", "Equity"),
    "SONY":    ("Sony Group Corp. (ADR)",           "NYSE",   "Equity"),
    "SAP":     ("SAP SE (ADR)",                     "NYSE",   "Equity"),
    "BABA":    ("Alibaba Group (ADR)",              "NYSE",   "Equity"),
    "JD":      ("JD.com Inc. (ADR)",                "NASDAQ", "Equity"),
    # ── Broad Market ETFs ─────────────────────────────────────────────────────
    "SPY":     ("SPDR S&P 500 ETF",                 "NYSE",   "ETF"),
    "VOO":     ("Vanguard S&P 500 ETF",             "NYSE",   "ETF"),
    "VTI":     ("Vanguard Total Stock Market ETF",  "NYSE",   "ETF"),
    "QQQ":     ("Invesco QQQ Trust (NASDAQ 100)",   "NASDAQ", "ETF"),
    "IWM":     ("iShares Russell 2000 ETF",         "NYSE",   "ETF"),
    "VEA":     ("Vanguard Developed Markets ETF",   "NYSE",   "ETF"),
    "VWO":     ("Vanguard Emerging Markets ETF",    "NYSE",   "ETF"),
    "EFA":     ("iShares MSCI EAFE ETF",            "NYSE",   "ETF"),
    "EEM":     ("iShares MSCI Emerging Markets",    "NYSE",   "ETF"),
    # ── Factor ETFs ──────────────────────────────────────────────────────────
    "MTUM":    ("iShares MSCI USA Momentum",        "NASDAQ", "ETF"),
    "QUAL":    ("iShares MSCI USA Quality",         "NASDAQ", "ETF"),
    "USMV":    ("iShares MSCI USA Min Vol",         "NASDAQ", "ETF"),
    "VLUE":    ("iShares MSCI USA Value",           "NASDAQ", "ETF"),
    "SIZE":    ("iShares MSCI USA Size",            "NASDAQ", "ETF"),
    # ── Fixed Income ETFs ─────────────────────────────────────────────────────
    "TLT":     ("iShares 20+ Year Treasury Bond",  "NASDAQ", "ETF"),
    "IEF":     ("iShares 7-10 Year Treasury Bond", "NASDAQ", "ETF"),
    "SHY":     ("iShares 1-3 Year Treasury Bond",  "NASDAQ", "ETF"),
    "AGG":     ("iShares Core US Aggregate Bond",  "NYSE",   "ETF"),
    "LQD":     ("iShares iBoxx IG Corporate Bond", "NYSE",   "ETF"),
    "HYG":     ("iShares iBoxx HY Corporate Bond", "NYSE",   "ETF"),
    "EMB":     ("iShares JP Morgan EM Bond ETF",   "NYSE",   "ETF"),
    # ── Commodity / Macro ETFs ────────────────────────────────────────────────
    "GLD":     ("SPDR Gold Shares",                 "NYSE",   "ETF"),
    "SLV":     ("iShares Silver Trust",             "NYSE",   "ETF"),
    "IAU":     ("iShares Gold Trust",               "NYSE",   "ETF"),
    "USO":     ("United States Oil Fund",           "NYSE",   "ETF"),
    "VNQ":     ("Vanguard Real Estate ETF",         "NYSE",   "ETF"),
    "GDX":     ("VanEck Gold Miners ETF",           "NYSE",   "ETF"),
    "DBC":     ("Invesco DB Commodity Index",       "NYSE",   "ETF"),
    # ── Crypto ───────────────────────────────────────────────────────────────
    "BTC-USD": ("Bitcoin USD",                      "Crypto", "Crypto"),
    "ETH-USD": ("Ethereum USD",                     "Crypto", "Crypto"),
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
        return TickerMatch(
            ticker=query.upper(),
            name=name,
            exchange=exchange,
            asset_type=atype.capitalize(),
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

    for ticker, (name, exchange, asset_type) in _CATALOGUE.items():
        score = _score(ticker, name, query)
        if score > 0:
            matches.append((score, TickerMatch(
                ticker=ticker, name=name,
                exchange=exchange, asset_type=asset_type,
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
