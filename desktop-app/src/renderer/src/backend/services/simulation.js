/*
 * Backend service: NAGA-Net's simulator / renderer.
 *
 * The transition operator in ./model.js gives P(S_t+1 | S_t) for a single
 * step. A world model earns the name by ITERATING that operator: sampling
 * many trajectories forward from the current state so the spread of the
 * ensemble — narrow near t=0, fanning out as uncertainty compounds — is the
 * forecast, not one averaged line through the middle of it.
 *
 * `rollout()` returns the full ensemble plus the derived envelope, the
 * convergence basins the trajectories settle into, and the step at which the
 * ensemble stops agreeing (the divergence point).
 */
import { TRANSITION_MATRIX, STAGES } from './model.js'

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashStr(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return (h ^ (h >>> 16)) >>> 0
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

// Risk midpoint each stage pulls its trajectory toward.
const STAGE_RISK = [12, 38, 58, 76, 92]

// Width of the ensemble's central 80% (in risk points) past which the rollout
// stops being summarisable as a single line — see `divergenceStep` below.
const DIVERGENCE_SPREAD = 25

function sampleNextStage(rnd, stageIdx) {
  const row = TRANSITION_MATRIX[stageIdx]
  let acc = 0
  const roll = rnd()
  for (let j = 0; j < row.length; j++) {
    acc += row[j]
    if (roll <= acc) return j
  }
  return row.length - 1
}

/*
 * Roll the transition operator forward.
 *   startRisk  — current observed risk (0-100)
 *   kSteps     — horizon
 *   pathCount  — trajectories to sample
 *   seedTag    — makes a given configuration reproducible until re-run
 */
export function rollout({ startRisk = 45, kSteps = 20, pathCount = 40, seedTag = 'naga' } = {}) {
  const rnd = mulberry32(hashStr(`${seedTag}|${kSteps}|${pathCount}|${Math.round(startRisk)}`))
  const startStage = STAGE_RISK.reduce((best, r, i) => (Math.abs(r - startRisk) < Math.abs(STAGE_RISK[best] - startRisk) ? i : best), 0)

  const paths = []
  for (let p = 0; p < pathCount; p++) {
    const risk = [startRisk]
    const stages = [startStage]
    let stage = startStage
    for (let s = 1; s <= kSteps; s++) {
      stage = sampleNextStage(rnd, stage)
      stages.push(stage)
      // Pull toward the stage's risk midpoint, with per-step noise that grows
      // slowly — this is what makes the ensemble fan out with horizon.
      const target = STAGE_RISK[stage]
      const prev = risk[risk.length - 1]
      const pull = 0.24 + rnd() * 0.12
      const noise = (rnd() - 0.5) * (1.6 + s * 0.22)
      risk.push(clamp(prev + (target - prev) * pull + noise, 1, 99.5))
    }
    paths.push({ id: `path-${p}`, risk, stages, terminalStage: stage })
  }

  // Envelope + median across the ensemble at each step.
  const envelope = []
  for (let s = 0; s <= kSteps; s++) {
    const column = paths.map((p) => p.risk[s]).sort((a, b) => a - b)
    const q = (f) => column[Math.min(column.length - 1, Math.floor(f * (column.length - 1)))]
    envelope.push({ step: s, min: column[0], p10: q(0.1), median: q(0.5), p90: q(0.9), max: column[column.length - 1] })
  }

  // Convergence basins: where the ensemble actually ends up.
  const basinCounts = new Array(STAGES.length).fill(0)
  paths.forEach((p) => basinCounts[p.terminalStage]++)
  const basins = STAGES.map((label, i) => ({
    stage: label,
    stageIdx: i,
    paths: basinCounts[i],
    share: basinCounts[i] / paths.length,
    meanTerminalRisk:
      basinCounts[i] === 0
        ? 0
        : paths.filter((p) => p.terminalStage === i).reduce((s, p) => s + p.risk[kSteps], 0) / basinCounts[i]
  })).filter((b) => b.paths > 0)

  // Per-step stage agreement: the share of trajectories predicting the modal
  // stage. Useful on its own, and it is what makes the basins interpretable.
  const agreementByStep = []
  for (let s = 0; s <= kSteps; s++) {
    const counts = new Array(STAGES.length).fill(0)
    paths.forEach((p) => counts[p.stages[s]]++)
    agreementByStep.push(Math.max(...counts) / paths.length)
  }

  // Divergence point: the first step at which the ensemble's central 80%
  // spans more than DIVERGENCE_SPREAD risk points. Up to it the rollout is a
  // line with error bars; past it the futures have separated far enough that
  // the forecast has to be read as a distribution.
  let divergenceStep = null
  for (let s = 1; s <= kSteps; s++) {
    if (envelope[s].p90 - envelope[s].p10 > DIVERGENCE_SPREAD) {
      divergenceStep = s
      break
    }
  }

  const breachPaths = paths.filter((p) => p.risk.some((r) => r >= 80)).length

  return {
    kSteps,
    pathCount,
    startRisk,
    startStage,
    startStageLabel: STAGES[startStage],
    paths,
    envelope,
    basins: basins.sort((a, b) => b.paths - a.paths),
    divergenceStep,
    agreementByStep,
    breachShare: breachPaths / paths.length,
    spreadAtHorizon: envelope[kSteps].p90 - envelope[kSteps].p10
  }
}

export { STAGES as SIMULATION_STAGES }
