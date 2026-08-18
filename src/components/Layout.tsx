import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import SyncStatus from '@/components/SyncStatus'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

const links = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/ejercicios', label: 'Ejercicios' },
  { to: '/rutinas', label: 'Rutinas' },
  { to: '/historial', label: 'Historial' },
  { to: '/estadisticas', label: 'Stats' },
  { to: '/perfil', label: 'Perfil' },
]

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
    isActive ? 'text-emerald-400' : 'text-dim'
  }`

function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    try {
      return (localStorage.getItem('gymtrack-theme') ?? 'dark') !== 'light'
    } catch {
      return true
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('light', !dark)
    try {
      localStorage.setItem('gymtrack-theme', dark ? 'dark' : 'light')
    } catch {
      // almacenamiento no disponible: el tema vive solo en la sesión
    }
  }, [dark])

  return (
    <button
      onClick={() => setDark((d) => !d)}
      title={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      className="min-h-12 rounded-lg border border-edge2 px-2.5 py-1.5 text-xs font-medium text-dim2 transition-colors hover:bg-surface2 hover:text-soft"
    >
      {dark ? 'Claro' : 'Oscuro'}
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

export default function Layout() {
  const { user } = useAuth()

  return (
    <div className="min-h-dvh md:flex">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-edge bg-bg/90 px-4 backdrop-blur md:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 font-black text-neutral-950">
          G
        </span>
        <span className="text-lg font-bold tracking-tight">GymTrack</span>
        <span className="ml-auto">
          <ThemeToggle />
        </span>
      </header>

      <nav className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-edge md:px-4 md:py-6">
        <div className="flex items-center gap-2 px-2 pb-6 text-lg font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 font-black text-neutral-950">
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
                `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-surface2 text-strong'
                    : 'text-dim hover:bg-surface2 hover:text-high'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
        {user && (
          <div className="mt-auto border-t border-edge px-2 pt-4">
            <p className="truncate px-3 pb-2 text-xs text-dim2">{user.email}</p>
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-dim transition-colors hover:bg-surface2 hover:text-red-400"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 md:px-8 md:py-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-bg/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-6 pb-[env(safe-area-inset-bottom)]">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClass}>
              {icons[link.to]}
              <span className="text-[10px] font-medium">{link.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="fixed bottom-20 left-3 z-40 md:bottom-8 md:left-auto md:right-4">
        <SyncStatus />
      </div>
    </div>
  )
}