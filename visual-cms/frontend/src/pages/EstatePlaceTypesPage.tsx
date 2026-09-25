import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/shared/components/Header'
import { PlaceTypesPanel } from '@/features/estate'

export const EstatePlaceTypesPage = () => (
  <div className="h-screen flex flex-col">
    <Header />
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <Link to="/estate" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> К жилым комплексам
        </Link>
      </div>
      <PlaceTypesPanel />
    </div>
  </div>
)
