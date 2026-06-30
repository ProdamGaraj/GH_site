import React from 'react'
import { LogOut } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { logout } from './authSlice'

/**
 * Кнопка выхода + текущий логин. После logout статус становится anonymous и
 * RequireAuth сам уводит на /login — навигация здесь не нужна.
 */
export const LogoutButton: React.FC = () => {
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)

  return (
    <div className="flex items-center gap-2">
      {user && <span className="text-sm text-gray-500 hidden sm:inline">{user.username}</span>}
      <button
        onClick={() => dispatch(logout())}
        title="Выйти"
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
      >
        <LogOut size={18} />
        <span className="hidden sm:inline">Выйти</span>
      </button>
    </div>
  )
}
