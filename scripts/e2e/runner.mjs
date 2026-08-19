import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const suites = ['sugg-e2e.mjs', 'resid-e2e.mjs', 'edge-a-e2e.mjs', 'edge-b-e2e.mjs']
let failed = false

for (const suite of suites) {
  const file = fileURLToPath(new URL(suite, import.meta.url))
  const res = spawnSync(process.execPath, [file], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
  if (res.status === 0) {
    console.log(`OK ${suite}`)
  } else {
    console.error(`FAIL ${suite}`)
    failed = true
  }
}

process.exit(failed ? 1 : 0)