import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { login } from '@/features/auth/authSlice'

interface LocationState {
  from?: { pathname?: string }
}

export const Login: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const status = useAppSelector((s) => s.auth.status)
  const loginError = useAppSelector((s) => s.auth.loginError)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as LocationState | null)?.from?.pathname || '/'

  // Уже авторизован (например, открыл /login напрямую) → уводим на целевой путь.
  useEffect(() => {
    if (status === 'authenticated') {
      navigate(from, { replace: true })
    }
  }, [status, from, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    const result = await dispatch(login({ username, password }))
    setSubmitting(false)
    if (login.fulfilled.match(result)) {
      navigate(from, { replace: true })
    }
  }

  // Пока идёт первичная проверка сессии (но НЕ сам процесс входа) или уже
  // авторизованы и сейчас редиректнем — показываем заглушку, не мигаем формой.
  const checkingSession = !submitting && (status === 'idle' || status === 'loading')
  if (checkingSession || status === 'authenticated') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        Загрузка…
      </div>
    )
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Visual CMS</h1>
          <p className="text-sm text-gray-500 mt-1">Вход в панель управления</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="username" className="block text-sm font-medium text-gray-700">
            Логин
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {loginError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {loginError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !username || !password}
          className="w-full py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
