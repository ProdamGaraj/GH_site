import React from 'react'
import { Outlet } from 'react-router-dom'

export const MainLayout: React.FC = () => {
  return (
    <div className="h-screen bg-gray-50">
      <Outlet />
    </div>
  )
}
