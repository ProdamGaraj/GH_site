import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { store } from './app/store'
import { router } from './app/routes'
import { fetchMe } from './features/auth/authSlice'
import './index.css'

// Проверяем сессию по cookie сразу при старте. RequireAuth и Login реагируют на
// итоговый статус (loading → authenticated | anonymous).
store.dispatch(fetchMe())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterProvider 
        router={router} 
        future={{ v7_startTransition: true }}
      />
    </Provider>
  </React.StrictMode>,
)
