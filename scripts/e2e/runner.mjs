import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CDP_URL = process.env.CDP_URL ?? 'http://localhost:9222'
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173'
const PORT = String(process.env.E2E_PORT ?? 4173)
const isWin = process.platform === 'win32'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function reachable(url) {
  try {
    const r = await fetch(url, { method: 'GET' })
    return r.ok || r.status < 500
  } catch {
    return false
  }
}

async function waitFor(url, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await reachable(url)) return true
    await sleep(500)
  }
  return false
}

function npmBin() {
  return isWin ? 'npm.cmd' : 'npm'
}

async function ensurePreview() {
  if (await reachable(BASE_URL)) return null
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    const build = spawnSync(npmBin(), ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })
    if (build.status !== 0) {
      console.error('build fallo antes del preview')
      process.exit(1)
    }
  }
  const child = spawn(
    npmBin(),
    ['run', 'preview', '--', '--port', PORT, '--strictPort'],
    { cwd: ROOT, stdio: 'inherit' },
  )
  const ok = await waitFor(BASE_URL)
  if (!ok) {
    console.error(`el preview no levanto en ${BASE_URL}`)
    process.exit(1)
  }
  return child
}

async function ensureBrowser() {
  if (await reachable(`${CDP_URL}/json`)) return null
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean)
  const bin = candidates.find((p) => existsSync(p))
  if (!bin) {
    console.error(
      'No se encontro Chrome/Edge. Configura CHROME_PATH o levanta un navegador con --remote-debugging-port=9222.',
    )
    process.exit(1)
  }
  const userData = mkdtempSync(join(tmpdir(), 'gymtrack-e2e-'))
  const child = spawn(
    bin,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      `--remote-debugging-port=${new URL(CDP_URL).port || '9222'}`,
      `--user-data-dir=${userData}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  const ok = await waitFor(`${CDP_URL}/json`)
  if (!ok) {
    console.error('el navegador no expuso el puerto de depuracion')
    process.exit(1)
  }
  return child
}

const suites = ['sugg-e2e.mjs', 'resid-e2e.mjs', 'edge-a-e2e.mjs', 'edge-b-e2e.mjs', 'auth-e2e.mjs']
let failed = false
const started = []

const main = async () => {
  const preview = await ensurePreview()
  if (preview) started.push(preview)
  const browser = await ensureBrowser()
  if (browser) started.push(browser)

  const env = { ...process.env, BASE_URL, CDP_URL }
  for (const suite of suites) {
    const file = fileURLToPath(new URL(suite, import.meta.url))
    const res = spawnSync(process.execPath, [file], { cwd: ROOT, stdio: 'inherit', env })
    if (res.status === 0) {
      console.log(`OK ${suite}`)
    } else {
      console.error(`FAIL ${suite}`)
      failed = true
    }
  }

  for (const child of started) {
    try {
      child.kill()
    } catch {
      // ya terminado
    }
  }
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error('RUNNER ERR', e.message)
  process.exit(1)
})