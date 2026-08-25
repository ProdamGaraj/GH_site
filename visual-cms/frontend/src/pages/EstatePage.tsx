import { Header } from '@/shared/components/Header'
import { EstateList } from '@/features/estate'

export const EstatePage = () => (
  <div className="h-screen flex flex-col">
    <Header />
    <div className="flex-1 overflow-y-auto">
      <EstateList />
    </div>
  </div>
)
