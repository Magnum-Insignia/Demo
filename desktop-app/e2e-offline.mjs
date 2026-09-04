/*
 * Backend-loss drill.
 *
 * Loads the app against a running backend host, then kills the host and
 * confirms the product keeps working from the on-device engine and says so —
 * the failure mode a live demo actually has to survive.
 *
 * Runs against the Vite dev server (the app), not the backend's own web build,
 * because the backend has to be killable without taking the page's origin with
 * it. On the demo machines the desktop app plays the same role.
 */
import { chromium } from 'playwright-core'
import { execSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const APP = process.env.APP_URL || 'http://localhost:5199/'
const EXE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

async function login(page) {
  await page.goto(APP, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /SOC Director/i }).first().click()
  await page.getByPlaceholder('e.g. analyst.01').fill('director.01')
  await page.locator('input[type=password]').fill('demo')
  await page.getByRole('button', { name: /Continue to Stage 2/ }).click()
  await page.waitForTimeout(300)
  await page.locator('button.relative.w-28').click()
  await page.waitForTimeout(2500)
}

const badgeText = (page) => page.locator('header div[title*="Backend host"]').innerText()

const browser = await chromium.launch({ executablePath: EXE })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })

// --- connected -------------------------------------------------------------
await login(page)
ok('starts connected to the backend host', (await badgeText(page)).includes('BACKEND LIVE'))

// --- kill the host ---------------------------------------------------------
console.log('  killing the backend host…')
// Kill ONLY the process listening on the backend port — the dev server serving
// this page is also Node, and taking that down would prove nothing.
const listener = execSync('netstat -ano -p tcp', { encoding: 'utf8' })
  .split('\n')
  .find((l) => l.includes(':8787') && l.includes('LISTENING'))
const pid = listener && listener.trim().split(/\s+/).pop()
if (pid) execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
else console.log('  (nothing listening on 8787)')
await sleep(3000)

// The already-loaded session has to keep working. Navigate around and check
// the views still render off the on-device engine.
let stillRendering = 0
for (const f of ['Dashboard', 'Alerts', 'Simulation', 'Action Plan', 'Ingest']) {
  await page.getByRole('button', { name: f, exact: true }).first().click()
  await page.waitForTimeout(500)
  if ((await page.locator('main').innerText()).length > 100) stillRendering++
}
ok('modules keep rendering with the host gone', stillRendering === 5, `${stillRendering}/5`)

// A mutation should still work locally.
await page.getByRole('button', { name: 'Alerts', exact: true }).first().click()
await page.waitForTimeout(500)
await page.locator('main table select').first().selectOption('acknowledged')
await page.waitForTimeout(600)
const acked = await page.locator('main').innerText()
ok('mutations still apply on-device', /ACKNOWLEDGED/i.test(acked))

// --- cold start with no host ----------------------------------------------
await page.reload({ waitUntil: 'networkidle' })
await login(page)
const coldBadge = await badgeText(page)
ok('cold start with no host reaches the dashboard', (await page.locator('main').innerText()).length > 100)
ok('and reports on-device mode rather than failing', coldBadge.includes('ON-DEVICE'), coldBadge.trim())
await page.screenshot({ path: 'e2e-offline-mode.png' })

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
