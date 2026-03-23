/**
 * Local fallback sector map.
 * Used to enrich TickerMatch objects when the backend doesn't return a sector
 * (e.g. during a deploy transition or for dynamic yfinance lookups).
 */
export const SECTOR_MAP: Record<string, string> = {
  // ── US Large Cap ────────────────────────────────────────────────────────────
  AAPL: 'Technology', MSFT: 'Technology', GOOGL: 'Technology', GOOG: 'Technology',
  AMZN: 'Consumer Discretionary', NVDA: 'Technology', TSLA: 'Consumer Discretionary',
  META: 'Communication Services', AMD: 'Technology', AVGO: 'Technology',
  ASML: 'Technology', TSM: 'Technology',
  V: 'Financials', MA: 'Financials',
  JNJ: 'Healthcare', PG: 'Consumer Staples', XOM: 'Energy', CVX: 'Energy',
  CAT: 'Industrials', LIN: 'Materials', PEP: 'Consumer Staples', KO: 'Consumer Staples',
  BMY: 'Healthcare', PFE: 'Healthcare', MRK: 'Healthcare', ABBV: 'Healthcare',
  UNH: 'Healthcare', LLY: 'Healthcare', AMGN: 'Healthcare', GILD: 'Healthcare',
  NFLX: 'Communication Services', DIS: 'Communication Services',
  CMCSA: 'Communication Services', T: 'Communication Services', VZ: 'Communication Services',
  INTC: 'Technology', QCOM: 'Technology', TXN: 'Technology', MU: 'Technology',
  CRM: 'Technology', ORCL: 'Technology', IBM: 'Technology', ADBE: 'Technology',
  NOW: 'Technology', SNOW: 'Technology', PLTR: 'Technology',
  UBER: 'Industrials', ABNB: 'Consumer Discretionary',
  SHOP: 'Technology', SQ: 'Financials', PYPL: 'Financials',
  BA: 'Aerospace & Defense', LMT: 'Aerospace & Defense', RTX: 'Aerospace & Defense',
  GS: 'Financials', JPM: 'Financials', BAC: 'Financials', WFC: 'Financials',
  MS: 'Financials', C: 'Financials', 'BRK-B': 'Financials',
  WMT: 'Consumer Staples', COST: 'Consumer Staples',
  HD: 'Consumer Discretionary', MCD: 'Consumer Discretionary',
  SBUX: 'Consumer Discretionary', NKE: 'Consumer Discretionary',
  PM: 'Consumer Staples', NEE: 'Utilities', SO: 'Utilities',
  AMT: 'Real Estate', PLD: 'Real Estate',
  // ── Italian ────────────────────────────────────────────────────────────────
  'LDO.MI': 'Aerospace & Defense',
  'ISP.MI': 'Financials', 'UCG.MI': 'Financials', 'MB.MI': 'Financials',
  'BAMI.MI': 'Financials', 'FBK.MI': 'Financials', 'AZM.MI': 'Financials',
  'BMED.MI': 'Financials', 'PST.MI': 'Financials', 'G.MI': 'Financials',
  'ENEL.MI': 'Utilities', 'SRG.MI': 'Utilities', 'TRN.MI': 'Utilities', 'A2A.MI': 'Utilities',
  'ENI.MI': 'Energy', 'SPM.MI': 'Energy', 'TEN.MI': 'Energy',
  'RACE.MI': 'Consumer Discretionary', 'STLA.MI': 'Consumer Discretionary',
  'MONC.MI': 'Consumer Discretionary', 'PIRC.MI': 'Consumer Discretionary',
  'PRY.MI': 'Industrials', 'CNHI.MI': 'Industrials',
  'STM.MI': 'Technology', 'IP.MI': 'Materials',
  'CPR.MI': 'Consumer Staples',
  'REC.MI': 'Healthcare', 'DIA.MI': 'Healthcare', 'AMP.MI': 'Healthcare',
  'TIT.MI': 'Communication Services',
  // ── French ────────────────────────────────────────────────────────────────
  'MC.PA': 'Consumer Discretionary', 'OR.PA': 'Consumer Staples',
  'TTE.PA': 'Energy', 'SAN.PA': 'Healthcare',
  'AIR.PA': 'Aerospace & Defense', 'HO.PA': 'Aerospace & Defense',
  'BNP.PA': 'Financials', 'CS.PA': 'Financials',
  'SU.PA': 'Industrials', 'DG.PA': 'Industrials',
  'RI.PA': 'Consumer Staples',
  'CAP.PA': 'Technology', 'DSY.PA': 'Technology',
  'ORA.PA': 'Communication Services',
  // ── German ────────────────────────────────────────────────────────────────
  'SAP.DE': 'Technology', 'SAP': 'Technology',
  'SIE.DE': 'Industrials',
  'ALV.DE': 'Financials', 'MUV2.DE': 'Financials', 'DB1.DE': 'Financials',
  'MBG.DE': 'Consumer Discretionary', 'BMW.DE': 'Consumer Discretionary',
  'VOW3.DE': 'Consumer Discretionary', 'PPFB.DE': 'Consumer Discretionary',
  'ADS.DE': 'Consumer Discretionary',
  'BAYN.DE': 'Healthcare',
  'DTE.DE': 'Communication Services',
  'RWE.DE': 'Utilities', 'EOAN.DE': 'Utilities',
  'BAS.DE': 'Materials',
  // ── UK ────────────────────────────────────────────────────────────────────
  'AZN.L': 'Healthcare', 'GSK.L': 'Healthcare',
  'SHEL.L': 'Energy', 'BP.L': 'Energy',
  'HSBA.L': 'Financials',
  'ULVR.L': 'Consumer Staples', 'DGE.L': 'Consumer Staples',
  'RIO.L': 'Materials', 'GLEN.L': 'Materials',
  'VOD.L': 'Communication Services',
  'BA.L': 'Aerospace & Defense',
  'REL.L': 'Technology',
  // ── Swiss ────────────────────────────────────────────────────────────────
  'NOVN.SW': 'Healthcare', 'ROG.SW': 'Healthcare',
  'NESN.SW': 'Consumer Staples',
  'UBSG.SW': 'Financials',
  'ABBN.SW': 'Industrials',
  // ── Spanish ──────────────────────────────────────────────────────────────
  'ITX.MC': 'Consumer Discretionary',
  'SAN.MC': 'Financials', 'BBVA.MC': 'Financials',
  'IBE.MC': 'Utilities',
  'REP.MC': 'Energy',
  // ── International ADRs ───────────────────────────────────────────────────
  NVO: 'Healthcare', SNY: 'Healthcare',
  TM: 'Consumer Discretionary', SONY: 'Consumer Discretionary',
  BABA: 'Consumer Discretionary', JD: 'Consumer Discretionary',
  // ── ETFs ──────────────────────────────────────────────────────────────────
  SPY: 'Broad Market', VOO: 'Broad Market', VTI: 'Broad Market', IWM: 'Broad Market',
  QQQ: 'Technology',
  VEA: 'International Equity', VWO: 'International Equity',
  EFA: 'International Equity', EEM: 'International Equity',
  MTUM: 'Factor ETF', QUAL: 'Factor ETF', USMV: 'Factor ETF', VLUE: 'Factor ETF', SIZE: 'Factor ETF',
  TLT: 'Government Bonds', IEF: 'Government Bonds', SHY: 'Government Bonds',
  AGG: 'Aggregate Bonds', LQD: 'Corporate Bonds', HYG: 'Corporate Bonds',
  EMB: 'Emerging Market Bonds',
  GLD: 'Commodities', SLV: 'Commodities', IAU: 'Commodities',
  USO: 'Commodities', GDX: 'Commodities', DBC: 'Commodities',
  VNQ: 'Real Estate',
  // ── Crypto ───────────────────────────────────────────────────────────────
  'BTC-USD': 'Cryptocurrency', 'ETH-USD': 'Cryptocurrency',
}

/**
 * Returns the asset enriched with sector.
 * Priority: backend sector → local fallback → empty string.
 */
export function enrichWithSector<T extends { ticker: string; sector: string }>(asset: T): T {
  if (asset.sector && asset.sector.trim() !== '') return asset
  const fallback = SECTOR_MAP[asset.ticker] ?? ''
  return fallback ? { ...asset, sector: fallback } : asset
}
