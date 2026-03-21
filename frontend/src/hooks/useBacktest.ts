import { useState, useCallback } from 'react'
import { runBacktest } from '../api/client'
import type { BacktestRequest, BacktestResponse } from '../types'

export function useBacktest() {
  const [data, setData] = useState<BacktestResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (body: BacktestRequest) => {
    setLoading(true)
    setError(null)
    try {
      const result = await runBacktest(body)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, run }
}
