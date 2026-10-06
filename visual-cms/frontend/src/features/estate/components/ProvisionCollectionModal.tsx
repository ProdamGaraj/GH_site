import React from 'react'
import { ProvisionCollectionModal as SharedModal } from '@/shared/components/ProvisionCollectionModal'
import { estateCmsApi } from '../api'

/** Страницы проектов: коллекция из estate-service на шаблон страницы ЖК. */
export const ProvisionCollectionModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <SharedModal
    onClose={onClose}
    title="Страницы проектов"
    description="Создаёт источник данных (estate-service) и коллекцию: одна страница на каждый ЖК из одного шаблона. Мультиязычность — через переводы страницы-шаблона."
    templateLabel="Страница-шаблон (напр. «Complex Doʼstlik»)"
    defaultBasePath="/complex"
    doneHint={
      <>
        Осталось: привязать поля шаблона к данным элемента (repeater по <code>apartments[]</code>) и задеплоить сайт.
      </>
    }
    provision={estateCmsApi.provisionCollection}
  />
)
