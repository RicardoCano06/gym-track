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

const rootEl = document.getElementById('root')!

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
    'GymTrack no puede iniciar',
    'Faltan las variables de entorno <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>. Definilas en el entorno de build (Cloudflare → gym-track → Settings → Variables and Secrets) y volvé a desplegar.',
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
      'GymTrack no puede iniciar',
      'Ocurrió un error al cargar la aplicación: <code>' +
        (err instanceof Error ? err.message : String(err)) +
        '</code>',
    )
  }
}