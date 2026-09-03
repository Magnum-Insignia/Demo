// Synthetic system/security log stream — swap for a real log pipeline later.
// Separate from database-access/recordsModel.js: this is operational/system
// event logging (what CERT-In's 180-day retention mandate targets), not raw
// ingested network telemetry.

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export const SEVERITIES = ['info', 'warning', 'error', 'critical']

const MESSAGES = {
  info: ['Scheduled ingestion batch completed', 'World model checkpoint saved', 'User session started', 'NTP sync OK (time.nic.in)'],
  warning: ['Elevated retry rate on flow ingestion', 'Disk usage above 75% on log volume', 'Slow query on audit datastore'],
  error: ['Failed to reach packet-capture agent on RTR-CORE', 'Authentication backend timeout', 'Model inference latency SLA breached'],
  critical: ['Infiltration probability crossed breach threshold on Server-HWA', 'Log retention job failed — CERT-In 180-day window at risk']
}
const SOURCES = ['ingestion-svc', 'world-model', 'auth-gateway', 'audit-store', 'ntp-sync']

export function generateLogs(seedTag) {
  const rnd = mulberry32((seedTag || 'logs').length * 104729 + 7)
  const rows = []
  for (let i = 0; i < 80; i++) {
    const sev = SEVERITIES[Math.min(3, Math.floor(rnd() * rnd() * 4))]
    rows.push({
      id: i,
      timestamp: new Date(Date.now() - i * 21000).toISOString().replace('T', ' ').slice(0, 19),
      severity: sev,
      source: SOURCES[Math.floor(rnd() * SOURCES.length)],
      message: MESSAGES[sev][Math.floor(rnd() * MESSAGES[sev].length)]
    })
  }
  return rows
}
