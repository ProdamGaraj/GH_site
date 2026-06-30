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
import { CollectionsPage } from '@/pages/CollectionsPage'
import { CollectionEditor } from '@/pages/CollectionEditor'
import { MediaLibraryPage } from '@/pages/MediaLibraryPage'
import { Login } from '@/pages/Login'
import { RequireAuth } from '@/widgets/auth/RequireAuth'


export const router = createBrowserRouter([
  // Публичный маршрут логина — вне RequireAuth.
  {
    path: '/login',
    element: <Login />,
  },
  // Всё остальное — только при валидной сессии.
  {
    element: <RequireAuth />,
    children: [
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
        path: 'collections',
        element: <CollectionsPage />,
      },
      {
        path: 'collections/:id',
        element: <CollectionEditor />,
      },
      {
        path: 'media',
        element: <MediaLibraryPage />,
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
    ],
  },
], {
  // Must match Vite's `base` so routes resolve when the app is served under the
  // /visual_cms/ path prefix (import.meta.env.BASE_URL === '/visual_cms/').
  basename: import.meta.env.BASE_URL,
})
