/*
 * Desktop-application run.
 *
 * Launches the packaged Electron build — the primary interface — against the
 * running backend host, and walks it the way an operator would. The web
 * fallback is covered by e2e.mjs; this proves the same behaviour in the shell
 * that actually ships.
 */
import { _electron as electron } from 'playwright-core'

const FRAMES = [
  'Dashboard', 'Network Topology', 'Brain Control', 'Simulation', 'Alerts',
  'Action Plan', 'Ingest', 'Database Access', 'Logs', 'CLI Access', 'NL Explainability'
]

const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// Electron must NOT inherit ELECTRON_RUN_AS_NODE — with it set the main
// process starts as plain Node and `require('electron').app` is undefined.
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const app = await electron.launch({ args: ['.'], env })
const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(2500)

const errors = []
page.on('pageerror', (e) => errors.push(e.message))

ok('desktop window opens', !!page)
ok('window title', (await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle())).includes('OcuNet'))

// sign in
await page.getByRole('button', { name: /SOC Director/i }).first().click()
await page.getByPlaceholder('e.g. analyst.01').fill('director.01')
await page.locator('input[type=password]').fill('demo')
await page.getByRole('button', { name: /Continue to Stage 2/ }).click()
await page.waitForTimeout(300)
await page.locator('button.relative.w-28').click()
await page.waitForTimeout(2500)

const badge = await page.locator('header div[title*="Backend host"]').innerText()
ok('desktop app reaches the backend host', badge.includes('BACKEND LIVE'), badge.trim())

let rendered = 0
for (const f of FRAMES) {
  await page.getByRole('button', { name: f, exact: true }).first().click()
  await page.waitForTimeout(550)
  if ((await page.locator('main').innerText()).length > 100) rendered++
}
ok('all 11 modules render in the desktop app', rendered === FRAMES.length, `${rendered}/${FRAMES.length}`)

await page.getByRole('button', { name: 'Dashboard', exact: true }).first().click()
await page.waitForTimeout(800)
await page.screenshot({ path: 'desktop-dashboard.png' })
await page.getByRole('button', { name: 'Simulation', exact: true }).first().click()
await page.waitForTimeout(900)
await page.screenshot({ path: 'desktop-simulation.png' })

ok('no page errors in the desktop app', errors.length === 0, errors.slice(0, 2).join(' | '))

await app.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
