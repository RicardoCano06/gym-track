import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

let theme = 'dark'
try {
  theme = localStorage.getItem('gymtrack-theme') ?? 'dark'
} catch {
  // almacenamiento no disponible: se usa el tema oscuro
}
if (theme === 'light') {
  document.documentElement.classList.add('light')
}

let lang = 'es'
try {
  lang = localStorage.getItem('gymtrack-lang') ?? 'es'
} catch {
  // almacenamiento no disponible: se usa el español
}
document.documentElement.lang = lang

const rootEl = document.getElementById('root')!

const isEn = lang === 'en'

function renderSetupError(title: string, detail: string) {
  rootEl.innerHTML = `
    <div style="display:flex;min-height:100dvh;align-items:center;justify-content:center;padding:24px;background:#0a0a0a;color:#e7e5e4;font-family:system-ui,sans-serif">
      <div style="max-width:420px;text-align:center">
        <h1 style="font-size:20px;font-weight:700;margin:0 0 10px">${title}</h1>
        <p style="font-size:14px;color:#a8a29e;line-height:1.6;margin:0">${detail}</p>
      </div>
    </div>`
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  renderSetupError(
    isEn ? 'Vekt cannot start' : 'Vekt no puede iniciar',
    isEn
      ? 'The environment variables <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> are missing. Define them in the build environment (Cloudflare → gym-track → Settings → Variables and Secrets) and redeploy.'
      : 'Faltan las variables de entorno <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>. Definilas en el entorno de build (Cloudflare → gym-track → Settings → Variables and Secrets) y volvé a desplegar.',
  )
} else {
  try {
    const { default: App } = await import('./App.tsx')
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch (err) {
    renderSetupError(
      isEn ? 'Vekt cannot start' : 'Vekt no puede iniciar',
      (isEn ? 'An error occurred while loading the app: <code>' : 'Ocurrió un error al cargar la aplicación: <code>') +
        (err instanceof Error ? err.message : String(err)) +
        '</code>',
    )
  }
}