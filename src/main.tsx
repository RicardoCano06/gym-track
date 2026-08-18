import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

let theme = 'dark'
try {
  theme = localStorage.getItem('gymtrack-theme') ?? 'dark'
} catch {
  // almacenamiento no disponible: se usa el tema oscuro
}
if (theme === 'light') {
  document.documentElement.classList.add('light')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)