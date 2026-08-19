import {
  BASE_URL,
  cleanupE2E,
  closeStrayPages,
  countActive,
  login,
  openPage,
  sleep,
} from './e2e-lib.mjs'

const NAME = 'E2E Sugg ' + Date.now()

const run = async () => {
  await closeStrayPages()
  const page = await openPage()
  console.log('BEFORE_ALL:', JSON.stringify(await cleanupE2E()))
  console.log('LOGGED_IN:', await login(page))
  console.log('ACTIVE_AFTER_LOGIN:', await countActive())

  await page.nav(BASE_URL + '/rutinas')
  await page.eval(`(() => { const inp=document.querySelector('input[placeholder*="Nombre de la rutina"]'); const set=(el,v)=>{ const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el,v); el.dispatchEvent(new Event('input',{bubbles:true})); }; set(inp, ${JSON.stringify(NAME)}); })()`)
  await page.eval(`(() => { [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Crear')?.click() })()`)
  await sleep(2000)

  await page.eval(`(() => { [...document.querySelectorAll('a')].find(a=>a.textContent.includes(${JSON.stringify(NAME)}))?.click() })()`)
  await sleep(2000)

  await page.eval(`(() => { const inp=document.querySelector('input[placeholder*="Nombre del día"]'); if(!inp) return; const set=(el,v)=>{ const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el,v); el.dispatchEvent(new Event('input',{bubbles:true})); }; set(inp, 'Día Test'); })()`)
  await page.eval(`(() => { [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Agregar día')?.click() })()`)
  await sleep(2500)

  console.log('ACTIVE_BEFORE_DASH:', await countActive())
  await page.nav(BASE_URL + '/')
  const dash = await page.eval(`(() => { const t=document.body.innerText; return JSON.stringify({ hasEntrenar: t.includes('Entrenar ▶'), text: t.slice(0,200) }) })()`)
  console.log('DASH_HAPPY:', dash)

  page.close()
  console.log('AFTER_ALL:', JSON.stringify(await cleanupE2E()))
  process.exit(0)
}
run().catch(async (e) => {
  console.error('ERR', e.message)
  try {
    console.log('AFTER_ALL:', JSON.stringify(await cleanupE2E()))
  } catch {}
  process.exit(1)
})