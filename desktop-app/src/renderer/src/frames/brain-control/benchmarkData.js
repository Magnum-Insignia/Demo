// Synthetic benchmark fixtures for the Brain Control frame — swap for real
// evaluation output once the world model / baseline are actually trained.
// The confusion matrix is the single source of truth for the world model's
// headline metrics (computed below) so the numbers stay internally
// consistent rather than being independently made up.

// MITRE-aligned stage taxonomy the world model classifies each window into
// — shared with the transition-probability heatmap below so every table in
// Brain Control uses the same 5-stage vocabulary.
export const STAGES = ['Nominal', 'Recon', 'Access', 'Lateral', 'C2 / Exfil']

export const CONFUSION_MATRIX = {
  labels: STAGES,
  // rows = true stage, cols = predicted stage
  values: [
    [1682, 38, 9, 3, 1],
    [52, 289, 22, 6, 2],
    [11, 24, 212, 14, 4],
    [4, 9, 19, 156, 11],
    [1, 3, 7, 16, 118]
  ]
}

// Macro-averaged one-vs-rest precision/recall/F1/FPR across every class —
// generalizes the old binary formulas to the NxN case so these headline
// numbers stay derived from the matrix above rather than independently
// made up.
function metricsFromMatrix(m) {
  const n = m.length
  const total = m.flat().reduce((a, b) => a + b, 0)
  const perClass = m.map((row, i) => {
    const tp = m[i][i]
    const rowSum = row.reduce((a, b) => a + b, 0)
    const colSum = m.reduce((s, r) => s + r[i], 0)
    const fn = rowSum - tp
    const fp = colSum - tp
    const tn = total - tp - fn - fp
    const precision = tp + fp ? tp / (tp + fp) : 0
    const recall = tp + fn ? tp / (tp + fn) : 0
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
    const fpr = fp + tn ? fp / (fp + tn) : 0
    return { precision, recall, f1, fpr }
  })
  const avg = (key) => perClass.reduce((s, c) => s + c[key], 0) / n
  return { f1: avg('f1'), precision: avg('precision'), recall: avg('recall'), fpr: avg('fpr') }
}

export const WORLD_MODEL_METRICS = metricsFromMatrix(CONFUSION_MATRIX.values)

// Row-stochastic P(next stage | current stage) — diagonal-dominant (stages
// mostly persist) with rising probability of progressing as severity climbs.
export const TRANSITION_MATRIX = [
  [0.92, 0.06, 0.01, 0.01, 0.0],
  [0.15, 0.55, 0.25, 0.04, 0.01],
  [0.05, 0.1, 0.5, 0.3, 0.05],
  [0.02, 0.03, 0.1, 0.55, 0.3],
  [0.01, 0.01, 0.03, 0.1, 0.85]
]
