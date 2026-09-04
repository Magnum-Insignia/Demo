import { useCallback, useMemo, useState } from 'react'
import backend from '../backend'

export function useDashboardData() {
  const [windowKey, setWindowKey] = useState('1m')
  const [kSteps, setKSteps] = useState(10)
  const [seed, setSeed] = useState('sih2026')

  const data = useMemo(() => backend.telemetry.forecast({ windowKey, kSteps, seed }), [windowKey, kSteps, seed])

  const resimulate = useCallback(() => setSeed('sih-' + Date.now()), [])

  return { data, windowKey, setWindowKey, kSteps, setKSteps, resimulate }
}
