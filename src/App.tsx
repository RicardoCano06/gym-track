import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom'
import Layout from '@/components/Layout'
import { AuthProvider } from '@/components/AuthProvider'
import { ToastProvider } from '@/components/Toast'
import { ThemeProvider } from '@/lib/theme-context'
import { useAuth } from '@/lib/auth-context'
import Dashboard from '@/pages/Dashboard'
import Catalog from '@/pages/Catalog'
import ExerciseDetail from '@/pages/ExerciseDetail'
import Routines from '@/pages/Routines'
import RoutineDetail from '@/pages/RoutineDetail'
import Train from '@/pages/Train'
import History from '@/pages/History'
import Stats from '@/pages/Stats'
import Profile from '@/pages/Profile'
import Login from '@/pages/Login'

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge2 border-t-emerald-500" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/ejercicios', element: <Catalog /> },
          { path: '/ejercicios/:id', element: <ExerciseDetail /> },
          { path: '/rutinas', element: <Routines /> },
          { path: '/rutinas/:id', element: <RoutineDetail /> },
          { path: '/entrenar/:dayId', element: <Train /> },
          { path: '/historial', element: <History /> },
          { path: '/estadisticas', element: <Stats /> },
          { path: '/perfil', element: <Profile /> },
        ],
      },
    ],
  },
  { path: '/login', element: <Login /> },
])

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}