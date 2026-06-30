import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from '@/app/hooks'

/**
 * Layout-route: пропускает дальше только при валидной сессии.
 * Пока сессия проверяется (idle/loading) — показывает заглушку; при anonymous
 * уводит на /login, запоминая исходный путь для возврата после входа.
 * Сама проверка (fetchMe) запускается в main.tsx при старте приложения.
 */
export const RequireAuth: React.FC = () => {
  const status = useAppSelector((s) => s.auth.status)
  const location = useLocation()

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        Загрузка…
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
