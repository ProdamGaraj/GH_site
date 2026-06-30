import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authApi, type AuthUser } from './authApi'
import { ApiError } from '@/shared/api/http'

/** Полезная нагрузка отклонённого login: текст + (для 429) секунды до повтора. */
export interface LoginRejectValue {
  message: string
  retryAfterSec?: number
}

/**
 * idle         — стартовое состояние, сессия ещё не проверена
 * loading      — идёт проверка (fetchMe) или вход (login)
 * authenticated — валидная сессия, user заполнен
 * anonymous    — сессии нет/истекла
 */
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous'

interface AuthState {
  user: AuthUser | null
  status: AuthStatus
  loginError: string | null
}

const initialState: AuthState = {
  user: null,
  status: 'idle',
  loginError: null,
}

/** Проверка текущей сессии по cookie (вызывается при старте приложения). */
export const fetchMe = createAsyncThunk('auth/fetchMe', async () => {
  const res = await authApi.me()
  return res.user
})

/** Вход. На ошибке возвращает текст + (для 429) секунды до повтора. */
export const login = createAsyncThunk<
  AuthUser,
  { username: string; password: string },
  { rejectValue: LoginRejectValue }
>('auth/login', async (creds, { rejectWithValue }) => {
  try {
    const res = await authApi.login(creds.username, creds.password)
    return res.user
  } catch (err) {
    if (err instanceof ApiError) {
      return rejectWithValue({
        message: err.message,
        retryAfterSec: err.status === 429 ? err.retryAfter : undefined,
      })
    }
    return rejectWithValue({ message: err instanceof Error ? err.message : 'Не удалось войти' })
  }
})

/** Выход. Чистим состояние локально даже если запрос не прошёл. */
export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await authApi.logout()
  } catch {
    // Игнорируем — cookie всё равно сбросим на стороне состояния.
  }
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Глобальный обработчик 401: сессия истекла/невалидна. */
    sessionExpired(state) {
      state.user = null
      state.status = 'anonymous'
    },
    clearLoginError(state) {
      state.loginError = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = 'authenticated'
      })
      .addCase(fetchMe.rejected, (state) => {
        state.user = null
        state.status = 'anonymous'
      })
      .addCase(login.pending, (state) => {
        state.status = 'loading'
        state.loginError = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = 'authenticated'
        state.loginError = null
      })
      .addCase(login.rejected, (state, action) => {
        state.user = null
        state.status = 'anonymous'
        state.loginError = action.payload?.message ?? 'Не удалось войти'
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.status = 'anonymous'
      })
  },
})

export const { sessionExpired, clearLoginError } = authSlice.actions
export default authSlice.reducer
