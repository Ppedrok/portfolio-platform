import type {
  SearchResponse,
  OptimizeRequest,
  OptimizeResponse,
  FrontierResponse,
  BacktestRequest,
  BacktestResponse,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const data = await res.json()
      msg = data?.detail ?? JSON.stringify(data)
    } catch {
      msg = await res.text()
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function searchAssets(query: string): Promise<SearchResponse> {
  const res = await fetch(`${BASE_URL}/api/assets/search?query=${encodeURIComponent(query)}`)
  return handleResponse<SearchResponse>(res)
}

export async function optimizePortfolio(
  body: OptimizeRequest,
): Promise<OptimizeResponse | FrontierResponse> {
  const res = await fetch(`${BASE_URL}/api/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse<OptimizeResponse | FrontierResponse>(res)
}

export async function runBacktest(body: BacktestRequest): Promise<BacktestResponse> {
  const res = await fetch(`${BASE_URL}/api/backtest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse<BacktestResponse>(res)
}
