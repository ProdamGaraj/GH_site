import React from 'react'
import type { DetectedField } from '@/shared/types/template'
import { Type, Image, Link, Hash, Calendar, CheckSquare, List, Box } from 'lucide-react'

interface DetectedFieldsViewerProps {
  fields: DetectedField[]
  compact?: boolean
}

const getFieldIcon = (type: string) => {
  switch (type) {
    case 'text':
    case 'richText':
      return <Type className="w-4 h-4" />
    case 'image':
      return <Image className="w-4 h-4" />
    case 'link':
      return <Link className="w-4 h-4" />
    case 'number':
      return <Hash className="w-4 h-4" />
    case 'date':
      return <Calendar className="w-4 h-4" />
    case 'boolean':
      return <CheckSquare className="w-4 h-4" />
    case 'list':
      return <List className="w-4 h-4" />
    case 'object':
      return <Box className="w-4 h-4" />
    default:
      return <Type className="w-4 h-4" />
  }
}

const getFieldTypeColor = (type: string) => {
  switch (type) {
    case 'text':
    case 'richText':
      return 'bg-blue-100 text-blue-700'
    case 'image':
      return 'bg-green-100 text-green-700'
    case 'link':
      return 'bg-purple-100 text-purple-700'
    case 'number':
      return 'bg-orange-100 text-orange-700'
    case 'date':
      return 'bg-pink-100 text-pink-700'
    case 'boolean':
      return 'bg-indigo-100 text-indigo-700'
    case 'list':
      return 'bg-yellow-100 text-yellow-700'
    case 'object':
      return 'bg-gray-100 text-gray-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export const DetectedFieldsViewer: React.FC<DetectedFieldsViewerProps> = ({ fields, compact = false }) => {
  if (!fields || fields.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Type className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Нет обнаруженных полей</p>
        <p className="text-xs mt-1">Добавьте элементы с metadata.name для создания полей</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {fields.map((field) => (
          <div
            key={field.id}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${getFieldTypeColor(field.type)}`}
            title={field.description || field.name}
          >
            {getFieldIcon(field.type)}
            <span>{field.name}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {fields.map((field) => (
        <div
          key={field.id}
          className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${getFieldTypeColor(field.type)}`}>
                  {getFieldIcon(field.type)}
                  <span>{field.type}</span>
                </div>
                <code className="text-sm font-mono text-gray-900">{field.name}</code>
                {field.required && (
                  <span className="text-xs text-red-600 font-medium">*required</span>
                )}
              </div>
              
              {field.description && (
                <p className="text-xs text-gray-600 mb-2">{field.description}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-gray-500">
                <div>
                  <span className="font-medium">Selector:</span>{' '}
                  <code className="bg-gray-100 px-1 py-0.5 rounded">{field.selector}</code>
                </div>
                {field.attribute && (
                  <div>
                    <span className="font-medium">Attribute:</span>{' '}
                    <code className="bg-gray-100 px-1 py-0.5 rounded">{field.attribute}</code>
                  </div>
                )}
              </div>

              {field.semanticHints && field.semanticHints.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {field.semanticHints.map((hint, i) => (
                    <span
                      key={i}
                      className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded"
                    >
                      {hint}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
