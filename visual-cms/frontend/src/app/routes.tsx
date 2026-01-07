import { createBrowserRouter } from 'react-router-dom'
import { MainLayout } from '@/widgets/layouts/MainLayout'
import { Dashboard } from '@/pages/Dashboard'
import { PagesList } from '@/pages/PagesList'
import { BlocksList } from '@/pages/BlocksList'
import { Settings } from '@/pages/Settings'
import { Editor } from '@/pages/Editor'

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
])
