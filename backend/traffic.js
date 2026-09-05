/*
 * Traffic generation control for the demo.
 *
 * The cluster's benign endpoints always chatter; the attacker sets sit scaled
 * to zero until the operator launches them from the frontend. "Generate
 * traffic" scales an attacker deployment up (a distributed multi-node attack,
 * one pod per attacker node); "stop" scales it back to zero. That gives the
 * demo a clean before/after: capture with nothing malicious on the wire, launch
 * the attack, capture again and watch the monitor catch it.
 *
 * Host-only: it drives the live cluster through kubectl, so it advertises its
 * availability in /health and says plainly when the cluster is not reachable.
 */
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// The kubeconfig the demo cluster writes. `config-ocunet` is the pre-rename
// name; a cluster created before the rebrand still has its config under it, so
// fall back rather than losing the cluster to a rename.
function kubeconfigPath() {
  if (process.env.KUBECONFIG) return process.env.KUBECONFIG
  const dir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kube')
  const current = path.join(dir, 'config-orbisnet')
  const legacy = path.join(dir, 'config-ocunet')
  return fs.existsSync(current) || !fs.existsSync(legacy) ? current : legacy
}

const KUBECONFIG = kubeconfigPath()
const NS = 'netsim'

// The two attack profiles the brief asks for.
const PROFILES = {
  known: { deploy: 'malicious', label: 'Known — sequential port sweep + FTP/SSH brute force' },
  unknown: { deploy: 'malicious-unknown', label: 'Unknown — randomised high-port recon (unseen pattern)' }
}

function kubectl(args, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    execFile('kubectl', ['-n', NS, ...args], { timeout: timeoutMs, env: { ...process.env, KUBECONFIG } },
      (err, stdout, stderr) => resolve({ ok: !err, stdout: stdout || '', stderr: stderr || '', err }))
  })
}

/* Is the cluster reachable and does the demo namespace exist? */
export async function probe() {
  const r = await kubectl(['get', 'ns', NS, '-o', 'name'], { timeoutMs: 5000 })
  const available = r.ok && r.stdout.includes(NS)
  return {
    available,
    profiles: Object.fromEntries(Object.entries(PROFILES).map(([k, v]) => [k, v.label])),
    reason: available ? null : 'the kind cluster / netsim namespace is not reachable on this host'
  }
}

/* Live pod counts by role, plus attacker desired/ready per profile. */
export async function status() {
  const p = await probe()
  if (!p.available) return { available: false, reason: p.reason }

  const pods = await kubectl(['get', 'pods', '-o',
    'jsonpath={range .items[*]}{.metadata.labels.role}{"|"}{.status.phase}{"\\n"}{end}'])
  const counts = { benign: 0, victim: 0, malicious: 0, running: 0, total: 0 }
  for (const line of pods.stdout.split('\n')) {
    const [role, phase] = line.split('|')
    if (!role) continue
    counts.total++
    if (phase === 'Running') counts.running++
    if (counts[role] !== undefined) counts[role]++
  }

  const attackers = {}
  for (const [key, prof] of Object.entries(PROFILES)) {
    const d = await kubectl(['get', 'deploy', prof.deploy, '-o',
      'jsonpath={.spec.replicas}|{.status.readyReplicas}'])
    const [desired, ready] = d.stdout.split('|')
    attackers[key] = { label: prof.label, desired: +desired || 0, ready: +ready || 0 }
  }

  return {
    available: true,
    pods: counts,
    attackers,
    attacking: Object.values(attackers).some((a) => a.desired > 0)
  }
}

/* Launch a distributed attack: scale a profile's attacker deployment up. */
export async function generate({ profile = 'known', replicas = 10 } = {}) {
  const prof = PROFILES[profile]
  if (!prof) return { ok: false, error: `unknown profile: ${profile}` }
  const n = Math.max(0, Math.min(replicas, 20))
  const r = await kubectl(['scale', `deploy/${prof.deploy}`, `--replicas=${n}`])
  if (!r.ok) return { ok: false, error: r.stderr || String(r.err) }
  return { ok: true, profile, label: prof.label, replicas: n, status: await status() }
}

/* Stop one profile, or all attackers, back to the quiet baseline. */
export async function stop({ profile = 'all' } = {}) {
  const targets = profile === 'all' ? Object.values(PROFILES).map((p) => p.deploy) : [PROFILES[profile]?.deploy]
  for (const d of targets.filter(Boolean)) await kubectl(['scale', `deploy/${d}`, '--replicas=0'])
  return { ok: true, status: await status() }
}
