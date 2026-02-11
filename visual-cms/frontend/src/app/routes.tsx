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
import { DataSourcesList } from '@/pages/DataSourcesList'
import { DataSourceWizard } from '@/features/data-sources/components/DataSourceWizard'
import { DataBindingDemo } from '@/pages/DataBindingDemo'
import TemplatesPage from '@/pages/TemplatesPage'
import TemplateBlocksPage from '@/pages/TemplateBlocksPage'
import { FormsPage } from '@/pages/FormsPage'
import { FormBuilderPage } from '@/pages/FormBuilderPage'

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
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'forms',
        element: <FormsPage />,
      },
      {
        path: 'forms/:id',
        element: <FormBuilderPage />,
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
    element: <DataSourceWizard />,
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
