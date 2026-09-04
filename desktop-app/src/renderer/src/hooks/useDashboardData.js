import { useCallback, useEffect, useMemo, useState } from 'react'
import backend from '../backend'
import { liveForecast } from '../backend/services/telemetry'

/*
 * Dashboard data.
 *
 * When the backend monitor has a live series (the cluster is up and being
 * captured), the whole dashboard runs off it: real capture windows, real
 * current timestamps, flat while quiet and reacting the moment attack traffic
 * appears. When there is no live source, it falls back to the authored
 * historical windows so the dashboard still renders on an air-gapped machine.
 */
export function useDashboardData() {
  const [windowKey, setWindowKey] = useState('1m')
  const [kSteps, setKSteps] = useState(10)
  const [seed, setSeed] = useState('sih2026')
  const [monitor, setMonitor] = useState(null)

  // Poll the live monitor series. Failure just means no live source — the
  // authored fallback below handles that.
  useEffect(() => {
    let alive = true
    const poll = () =>
      backend.monitor
        .history()
        .then((m) => alive && setMonitor(m))
        .catch(() => alive && setMonitor(null))
    poll()
    const t = setInterval(poll, 2000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  const live = monitor?.available && monitor.points && monitor.points.length > 0

  const data = useMemo(() => {
    if (live) return liveForecast(monitor.points, kSteps)
    return backend.telemetry.forecast({ windowKey, kSteps, seed })
  }, [live, monitor, windowKey, kSteps, seed])

  const resimulate = useCallback(() => setSeed('sih-' + Date.now()), [])

  return { data, windowKey, setWindowKey, kSteps, setKSteps, resimulate, live }
}
