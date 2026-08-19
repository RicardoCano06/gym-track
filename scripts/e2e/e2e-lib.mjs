import { createClient } from '@supabase/supabase-js'

export const URL = 'https://rikbdlgdbxarddfusmwg.supabase.co'
export const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpa2JkbGdkYnhhcmRkZnVzbXdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjkyNzQsImV4cCI6MjEwMjY0NTI3NH0.NckJ2_g7sf0arbJ0YV9kOcTlomR9YrU9LVxtFpSdTxE'
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173'
export const CDP_URL = process.env.CDP_URL ?? 'http://localhost:9222'
export const TEST_EMAIL = 'gymtrack.test.2026@gmail.com'
export const TEST_PASS = 'test123456'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function sb() {
  return createClient(URL, ANON)
}

export class CdpPage {
  constructor(target) {
    this.target = target
    this.ws = new WebSocket(target.webSocketDebuggerUrl)
    this.id = 0
    this.pending = new Map()
  }

  async init() {
    this.ws.onmessage = (e) => {
      const x = JSON.parse(e.data)
      if (x.id && this.pending.has(x.id)) {
        this.pending.get(x.id)(x)
        this.pending.delete(x.id)
      } else if (x.method === 'Runtime.consoleAPICalled') {
        const args = (x.params?.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ')
        console.log(`[page] ${x.params.type}: ${args}`)
      }
    }
    await new Promise((r) => (this.ws.onopen = r))
    await this.send('Runtime.enable')
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 800,
      deviceScaleFactor: 2,
      mobile: true,
    })
  }

  send(method, params = {}) {
    return new Promise((resolve) => {
      const i = ++this.id
      this.pending.set(i, resolve)
      this.ws.send(JSON.stringify({ id: i, method, params }))
    })
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails))
    return r.result?.result?.value
  }

  async nav(url) {
    await this.send('Page.navigate', { url })
    await sleep(2500)
  }

  close() {
    try {
      this.ws.close()
    } catch {
      // ya cerrado
    }
  }

  async closeTab() {
    try {
      await fetch(`${CDP_URL}/json/close/${this.target.id}`)
    } catch {
      // ya cerrado
    }
  }
}

export async function openPage(url = BASE_URL + '/') {
  const target = await (
    await fetch(`${CDP_URL}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  ).json()
  const page = new CdpPage(target)
  await page.init()
  return page
}

export async function closeStrayPages(base = BASE_URL) {
  const targets = await (await fetch(`${CDP_URL}/json`)).json()
  for (const t of targets) {
    if (t.type === 'page' && t.url.startsWith(base)) {
      await fetch(`${CDP_URL}/json/close/${t.id}`)
    }
  }
}

export async function login(page, email = TEST_EMAIL, pass = TEST_PASS) {
  await page.nav(BASE_URL + '/')
  if (await page.eval(`!!document.querySelector('input[type=email]')`)) {
    await page.eval(`(() => {
      const e = document.querySelector('input[type=email]')
      const p = document.querySelector('input[type=password]')
      const set = (el, v) => {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        s.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      set(e, ${JSON.stringify(email)})
      set(p, ${JSON.stringify(pass)})
    })()`)
    await page.eval(`(() => { document.querySelector('button[type=submit]')?.click() })()`)
    await sleep(2500)
  }
  return page.eval(`!document.querySelector('input[type=email]')`)
}

export async function countActive() {
  const client = sb()
  const { data: auth } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASS,
  })
  if (!auth.user) return -1
  const { data } = await client
    .from('sessions')
    .select('id')
    .eq('user_id', auth.user.id)
    .is('ended_at', null)
  return (data ?? []).length
}

export async function cleanupE2E() {
  const client = sb()
  const { data: auth, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASS,
  })
  if (error || !auth.user) return { deleted: 0, error: error?.message }
  const { data: routines } = await client
    .from('routines')
    .select('id, name')
    .eq('user_id', auth.user.id)
  const toDelete = (routines ?? []).filter(
    (r) => r.name.startsWith('E2E Sugg') || r.name.startsWith('E2E Edge'),
  )
  for (const r of toDelete) {
    await client.from('routine_days').delete().eq('routine_id', r.id)
    await client.from('routines').delete().eq('id', r.id)
  }
  const { data: active } = await client
    .from('sessions')
    .select('id')
    .eq('user_id', auth.user.id)
    .is('ended_at', null)
  for (const s of active ?? []) {
    await client.from('session_sets').delete().eq('session_id', s.id)
    await client.from('sessions').delete().eq('id', s.id)
  }
  return { deleted: toDelete.length, activeClosed: (active ?? []).length }
}