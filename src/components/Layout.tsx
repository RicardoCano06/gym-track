import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import SyncStatus from '@/components/SyncStatus'
import ScrollToTop from '@/components/ScrollToTop'
import { useTheme } from '@/lib/theme-context'

const links = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/ejercicios', label: 'Ejercicios' },
  { to: '/rutinas', label: 'Rutinas' },
  { to: '/historial', label: 'Historial' },
  { to: '/estadisticas', label: 'Stats' },
  { to: '/perfil', label: 'Perfil' },
]

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `relative z-10 flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 transition-colors duration-200 ${
    isActive ? 'text-emerald-400' : 'text-dim hover:text-high'
  }`

function ThemeToggle() {
  const { dark, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      title={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge2 text-dim2 transition-all duration-200 hover:bg-surface2 hover:text-soft"
    >
      {dark ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-6 w-6"
    >
      {children}
    </svg>
  )
}

const HomeIcon = (
  <Icon>
    <path d="M3 10.5 12 3l9 7.5V21h-5.5v-6h-7v6H3z" />
  </Icon>
)
const DumbbellIcon = (
  <Icon>
    <path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />
  </Icon>
)
const ListIcon = (
  <Icon>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </Icon>
)
const ClockIcon = (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)
const ChartIcon = (
  <Icon>
    <path d="M3 20h18M5 20v-6M11 20V8M17 20v-10" />
  </Icon>
)
const UserIcon = (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-3.9 3.6-6 8-6s8 2.1 8 6" />
  </Icon>
)

const icons: Record<string, ReactNode> = {
  '/': HomeIcon,
  '/ejercicios': DumbbellIcon,
  '/rutinas': ListIcon,
  '/historial': ClockIcon,
  '/estadisticas': ChartIcon,
  '/perfil': UserIcon,
}

function BottomNav() {
  const location = useLocation()
  const navRef = useRef<HTMLElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const [kbOpen, setKbOpen] = useState(false)

  // La medición solo se dispara al cambiar de ruta o de tamaño (ResizeObserver
  // + rAF), nunca en cada render: evita layout thrashing al rotar/redimensionar.
  useLayoutEffect(() => {
    const measure = () => {
      const nav = navRef.current
      if (!nav) return
      const active = nav.querySelector<HTMLAnchorElement>('a[aria-current="page"]')
      if (!active) return
      const c = nav.getBoundingClientRect()
      const el = active.getBoundingClientRect()
      setIndicator((prev) =>
        prev.left === el.left - c.left && prev.width === el.width
          ? prev
          : { left: el.left - c.left, width: el.width },
      )
    }
    measure()
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    const ro = new ResizeObserver(onResize)
    if (navRef.current) ro.observe(navRef.current)
    window.addEventListener('orientationchange', onResize)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('orientationchange', onResize)
    }
  }, [location.pathname])

  // Ocultar la barra cuando se despliega el teclado virtual: en iOS Safari un
  // elemento fixed queda flotando sobre el teclado y tapa los campos en foco.
  useEffect(() => {
    const isEditable = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest('input, textarea, select')
    const onFocusIn = (e: FocusEvent) => setKbOpen(isEditable(e.target))
    const onFocusOut = (e: FocusEvent) => setKbOpen(isEditable(e.relatedTarget))
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  return (
    <nav
      ref={navRef}
      className={`glass-strong fixed inset-x-4 bottom-[max(0.625rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg rounded-2xl pb-[max(env(safe-area-inset-bottom),0.25rem)] shadow-[0_16px_40px_-16px_rgba(0,0,0,0.7)] transition-all duration-300 ease-out md:hidden ${
        kbOpen ? 'pointer-events-none translate-y-28 opacity-0' : ''
      }`}
    >
      <div
        aria-hidden
        className="absolute top-1.5 h-9 rounded-xl bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/20 transition-all duration-300 ease-out"
        style={{ left: indicator.left + 8, width: Math.max(0, indicator.width - 16) }}
      />
      <div className="relative mx-auto grid max-w-lg grid-cols-6">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClass}>
            {icons[link.to]}
            <span className="w-full truncate text-center text-[10px] font-medium leading-none">
              {link.label}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function Layout() {
  const location = useLocation()

  return (
    <div className="radial-top min-h-dvh md:flex">
      <ScrollToTop />
      <header className="glass-strong sticky top-0 z-30 flex h-14 items-center gap-2 px-4 md:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 font-black text-neutral-950 shadow-[0_0_18px_rgba(16,185,129,0.45)]">
          G
        </span>
        <span className="text-lg font-bold tracking-tight">GymTrack</span>
        <span className="ml-auto">
          <ThemeToggle />
        </span>
      </header>

      <nav className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-edge md:px-4 md:py-6">
        <div className="flex items-center gap-2 px-2 pb-6 text-lg font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 font-black text-neutral-950 shadow-[0_0_18px_rgba(16,185,129,0.45)]">
            G
          </span>
          <span>GymTrack</span>
          <span className="ml-auto">
            <ThemeToggle />
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `relative rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/15 to-transparent text-emerald-400'
                    : 'text-dim hover:bg-surface2 hover:text-high'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
                  )}
                  {link.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
        </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-6 md:px-8 md:py-10">
        <div key={location.pathname} className="animate-rise">
          <Outlet />
        </div>
      </main>

      <BottomNav />

      <div className="fixed bottom-24 left-3 z-40 md:bottom-8 md:left-auto md:right-4">
        <SyncStatus />
      </div>
    </div>
  )
}