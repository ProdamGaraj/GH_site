import { Header } from '@/shared/components/Header'
import { NewsList } from '@/features/news'

export const NewsPage = () => (
  <div className="h-screen flex flex-col">
    <Header />
    <div className="flex-1 overflow-y-auto">
      <NewsList />
    </div>
  </div>
)
