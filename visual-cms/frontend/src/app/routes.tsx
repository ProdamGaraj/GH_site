import { createBrowserRouter } from 'react-router-dom'
import { MainLayout } from '@/widgets/layouts/MainLayout'
import { Dashboard } from '@/pages/Dashboard'
import { PagesList } from '@/pages/PagesList'
import { BlocksList } from '@/pages/BlocksList'
import { Settings } from '@/pages/Settings'
import { Editor } from '@/pages/Editor'
import { GoldenHouseHome } from '@/pages/GoldenHouseHome'
import { GoldenHouseModern } from '@/pages/GoldenHouseModern'
import { GoldenHousePremium } from '@/pages/GoldenHousePremium'
import GoldenHouseElite from '@/pages/GoldenHouseElite'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'pages',
        element: <PagesList />,
      },
      {
        path: 'blocks',
        element: <BlocksList />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'editor/page/new',
        element: <Editor type="page" />,
      },
      {
        path: 'editor/block/new',
        element: <Editor type="block" />,
      },
      {
        path: 'editor/page/:id',
        element: <Editor type="page" />,
      },
      {
        path: 'editor/block/:id',
        element: <Editor type="block" />,
      },
    ],
  },
  {
    path: '/golden-house',
    element: <GoldenHouseHome />,
  },
  {
    path: '/golden-house-modern',
    element: <GoldenHouseModern />,
  },
  {
    path: '/golden-house-premium',
    element: <GoldenHousePremium />,
  },
  {
    path: '/golden-house-elite',
    element: <GoldenHouseElite />,
  },
])
