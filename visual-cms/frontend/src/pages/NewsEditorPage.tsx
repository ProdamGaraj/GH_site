import { Header } from '@/shared/components/Header'
import { NewsEditor } from '@/features/news'

export const NewsEditorPage = () => (
  <div className="h-screen flex flex-col">
    <Header />
    <div className="flex-1 overflow-y-auto">
      <NewsEditor />
    </div>
  </div>
)
