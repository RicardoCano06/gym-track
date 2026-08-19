import { cleanupE2E } from './e2e-lib.mjs'

const res = await cleanupE2E()
console.log('TEARDOWN:', JSON.stringify(res))
process.exit(0)
