import { Header } from '@/shared/components/Header'
import { EstateEditor } from '@/features/estate'

export const EstateEditorPage = () => (
  <div className="h-screen flex flex-col">
    <Header />
    <div className="flex-1 overflow-y-auto">
      <EstateEditor />
    </div>
  </div>
)
