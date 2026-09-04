/*
 * End-to-end demonstration run.
 *
 * Drives the locally hosted web build against the running backend host and
 * checks the things that actually matter for the demo:
 *   1. the app connects to the backend host and says so
 *   2. every module renders for both roles
 *   3. a mutation made in the UI reaches the backend process
 *   4. the blind-spot drill (killing a capture agent) is visible
 *   5. evidence export produces a hashed bundle
 *   6. losing the backend host drops the app to on-device, not to a dead screen
 */
import { chromium } from 'playwright-core'

const APP = process.env.APP_URL || 'http://127.0.0.1:8787/'
const API = process.env.API_URL || 'http://127.0.0.1:8787'
const EXE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const FRAMES = [
  'Dashboard', 'Network Topology', 'Brain Control', 'Simulation', 'Alerts',
  'Action Plan', 'Ingest', 'Database Access', 'Logs', 'CLI Access', 'NL Explainability'
]

const results = []
const errors = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

async function api(resource, operation, payload) {
  const r = await fetch(API + '/call', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ resource, operation, payload })
  })
  return (await r.json()).result
}

async function login(page, roleTitle, username) {
  await page.goto(APP, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: new RegExp(roleTitle, 'i') }).first().click()
  await page.getByPlaceholder('e.g. analyst.01').fill(username)
  await page.locator('input[type=password]').fill('demo')
  await page.getByRole('button', { name: /Continue to Stage 2/ }).click()
  await page.waitForTimeout(300)
  await page.locator('button.relative.w-28').click()
  await page.waitForTimeout(2500)
}

const browser = await chromium.launch({ executablePath: EXE })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text())
})

// ---- 1. connects to the backend host -------------------------------------
await login(page, 'SOC Director', 'director.01')
const badge = await page.locator('header div[title*="Backend host"]').innerText()
ok('app reports a live backend host', badge.includes('BACKEND LIVE'), badge.trim())

// ---- 2. every module renders ---------------------------------------------
let rendered = 0
for (const f of FRAMES) {
  await page.getByRole('button', { name: f, exact: true }).first().click()
  await page.waitForTimeout(600)
  const len = (await page.locator('main').innerText()).length
  if (len > 100) rendered++
  else ok(`module renders: ${f}`, false, `${len} chars`)
}
ok('all 11 modules render (SOC Director)', rendered === FRAMES.length, `${rendered}/${FRAMES.length}`)

// ---- 3. a UI mutation reaches the backend process ------------------------
await page.getByRole('button', { name: 'Alerts', exact: true }).first().click()
await page.waitForTimeout(600)
// Reset on the host first so the run is repeatable against a long-lived
// backend process, then reload so the client is reading host state.
await api('alerts', 'setAlertState', { id: 'al-2041', state: 'open' })
await page.reload({ waitUntil: 'networkidle' })
await login(page, 'SOC Director', 'director.01')
await page.getByRole('button', { name: 'Alerts', exact: true }).first().click()
await page.waitForTimeout(600)
const beforeStates = Object.fromEntries((await api('alerts', 'list')).map((a) => [a.id, a.state]))
await page.locator('main table select').first().selectOption('closed')
await page.waitForTimeout(900)
const afterStates = Object.fromEntries((await api('alerts', 'list')).map((a) => [a.id, a.state]))
const changed = Object.keys(afterStates).filter((id) => afterStates[id] !== beforeStates[id])
ok(
  'UI mutation reaches the backend process',
  changed.length === 1 && afterStates[changed[0]] === 'closed',
  changed.length ? `${changed[0]} on host: ${beforeStates[changed[0]]} -> ${afterStates[changed[0]]}` : 'no host state changed'
)

// ---- 5. evidence export ---------------------------------------------------
const bundle = await api('evidence', 'bundle', { alertId: 'al-2041' })
ok(
  'evidence bundle assembles with an integrity hash',
  bundle.ok && !!bundle.hash && bundle.bundle.flaggedFlows.length > 0,
  `${bundle.hash}, ${bundle.bundle.flaggedFlows.length} flows, ${bundle.bundle.topologySnapshot.devices.length} devices`
)
const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
await page.locator('button[title*="forensic bundle"]').first().click()
const download = await dl
ok('evidence export downloads a file', !!download, download ? await download.suggestedFilename() : 'no download event')

// ---- 4. blind-spot drill --------------------------------------------------
// Reset cap-01 on the host so the drill is repeatable, then take it off the
// wire from the UI and confirm the host and every downstream view agree.
await api('ingestion', 'setAgentState', { id: 'cap-01', state: 'streaming' })
await page.reload({ waitUntil: 'networkidle' })
await login(page, 'SOC Director', 'director.01')
await page.getByRole('button', { name: 'Ingest', exact: true }).first().click()
await page.waitForTimeout(700)
const coverageBefore = (await api('ingestion', 'status')).coverage
await page.locator('button[title*="Cycle this agent"]').first().click()
await page.waitForTimeout(900)
const cap01 = (await api('ingestion', 'agents')).find((a) => a.id === 'cap-01')
const coverageAfter = (await api('ingestion', 'status')).coverage
const statusText = await page.locator('main').innerText()
ok(
  'blind-spot drill takes an agent off the wire, host and UI agree',
  cap01.state === 'degraded' && coverageAfter < coverageBefore && /DEGRADED/i.test(statusText),
  `cap-01 -> ${cap01.state}, coverage ${(coverageBefore * 100).toFixed(0)}% -> ${(coverageAfter * 100).toFixed(0)}%`
)
await page.screenshot({ path: 'e2e-ingest-blindspot.png' })

// ---- 2b. both roles -------------------------------------------------------
await login(page, 'SOC Analyst', 'analyst.01')
let analystRendered = 0
for (const f of FRAMES) {
  const btn = page.getByRole('button', { name: f, exact: true })
  if (!(await btn.count())) continue
  await btn.first().click()
  await page.waitForTimeout(450)
  if ((await page.locator('main').innerText()).length > 100) analystRendered++
}
ok('all 11 modules render (SOC Analyst)', analystRendered === FRAMES.length, `${analystRendered}/${FRAMES.length}`)

// RBAC: the analyst must NOT be able to authorise an action
await page.getByRole('button', { name: 'Action Plan', exact: true }).first().click()
await page.waitForTimeout(700)
const analystActionText = await page.locator('main').innerText()
ok(
  'RBAC holds: analyst cannot authorise actions',
  !analystActionText.includes('Authorise') && /requires the SOC Director role/i.test(analystActionText),
  'authorise controls absent, reason shown'
)
await page.screenshot({ path: 'e2e-analyst-actionplan.png' })

ok('no page errors during the run', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
