import { useState, useCallback } from 'react'
import { optimizePortfolio } from '../api/client'
import type { OptimizeRequest, OptimizeResponse, FrontierResponse } from '../types'

export function useOptimize() {
  const [data, setData] = useState<OptimizeResponse | FrontierResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (body: OptimizeRequest) => {
    setLoading(true)
    setError(null)
    try {
      const result = await optimizePortfolio(body)
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
