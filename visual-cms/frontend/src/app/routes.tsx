import { createBrowserRouter } from 'react-router-dom'
import { MainLayout } from '@/widgets/layouts/MainLayout'
import { Dashboard } from '@/pages/Dashboard'
import { PagesList } from '@/pages/PagesList'
import { BlocksList } from '@/pages/BlocksList'
import { Settings } from '@/pages/Settings'
import { Editor } from '@/pages/Editor'
import { DataSourcesList } from '@/pages/DataSourcesList'
import { DataSourceWizard } from '@/features/data-sources/components/DataSourceWizard'
import { DataSourceEditor } from '@/features/data-sources/components/DataSourceEditor'
import { DataBindingDemo } from '@/pages/DataBindingDemo'
import TemplatesPage from '@/pages/TemplatesPage'
import TemplateBlocksPage from '@/pages/TemplateBlocksPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import { SitesList } from '@/pages/SitesList'
import { SiteSettingsPage } from '@/pages/SiteSettingsPage'
import { SitePagesPage } from '@/pages/SitePagesPage'


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
        path: 'data-sources',
        element: <DataSourcesList />,
      },
      {
        path: 'templates',
        element: <TemplateBlocksPage />,
      },
      {
        path: 'templates-old',
        element: <TemplatesPage />,
      },
      {
        path: 'sites',
        element: <SitesList />,
      },
      {
        path: 'sites/:id/settings',
        element: <SiteSettingsPage />,
      },
      {
        path: 'sites/:id/pages',
        element: <SitePagesPage />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'analytics',
        element: <AnalyticsPage />,
      },
      {
        path: 'data-binding-demo',
        element: <DataBindingDemo />,
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
  // Data Source Wizard - отдельно от layout для полноэкранного режима
  {
    path: '/data-sources/new',
    element: <DataSourceWizard />,
  },
  {
    path: '/data-sources/:id/edit',
    element: <DataSourceEditor />,
  },
])
