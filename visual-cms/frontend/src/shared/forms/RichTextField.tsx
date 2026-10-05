import React, { useEffect } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Bold, Heading2, Heading3, Italic, Link2, Link2Off, List, ListOrdered, Quote, Redo2, Strikethrough, Undo2 } from 'lucide-react'
import { cn } from '@/shared/utils'
import { Label } from './fields'

/**
 * Форматированный текст (визуальный редактор TipTap): абзацы, жирный,
 * курсив, зачёркнутый, подзаголовки h2/h3, списки, цитаты, ссылки.
 *
 * Набор кнопок — ровно то, что пропускает чистка HTML на стороне сервиса
 * (news-service, services/html.ts): код, блоки кода и разделители выключены —
 * сервис их всё равно вырезал бы, и редактор показывал бы то, чего на сайте не
 * будет. Значение — HTML; пустой редактор отдаёт пустую строку, а не `<p></p>`.
 */
export const RICH_TEXT_EXTENSIONS = [
  StarterKit.configure({ code: false, codeBlock: false, horizontalRule: false, heading: { levels: [2, 3] } }),
  Link.configure({ openOnClick: false, autolink: true, protocols: ['mailto', 'tel'] }),
]

export function editorHtml(editor: Editor): string {
  return editor.isEmpty ? '' : editor.getHTML()
}

const ToolButton: React.FC<{
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}> = ({ label, active, disabled, onClick, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()} // фокус остаётся в тексте
    onClick={onClick}
    className={cn(
      'p-1.5 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-40',
      active && 'bg-primary-50 text-primary-700'
    )}
  >
    {children}
  </button>
)

function editLink(editor: Editor): void {
  const current = editor.getAttributes('link').href as string | undefined
  const href = window.prompt('Адрес ссылки (https://…, /ru/…, mailto:, tel:)', current ?? 'https://')
  if (href === null) return
  const trimmed = href.trim()
  if (!trimmed || trimmed === 'https://') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run()
}

export const RichTextField: React.FC<{
  label?: string
  hint?: string
  value: string
  onChange: (html: string) => void
  /** Подпись внутри пустого поля. */
  placeholder?: string
  /** Только чтение (например, оригинал рядом с переводом). */
  readOnly?: boolean
  className?: string
}> = ({ label, hint, value, onChange, placeholder, readOnly = false, className }) => {
  const editor = useEditor({
    extensions: RICH_TEXT_EXTENSIONS,
    content: value || '',
    editable: !readOnly,
    onUpdate: ({ editor: e }) => onChange(editorHtml(e)),
  })

  // Значение сменилось снаружи (другой блок, другой язык, ответ сервиса) —
  // переписываем содержимое. Свой же ввод не трогаем: каретка не прыгает.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if ((value || '') !== editorHtml(editor)) editor.commands.setContent(value || '', false)
  }, [editor, value])

  // Без события изменения: setEditable по умолчанию его шлёт, и открытие
  // формы выглядело бы как правка текста.
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEditable === readOnly) editor.setEditable(!readOnly, false)
  }, [editor, readOnly])

  return (
    <div className={className}>
      {label && <Label hint={hint}>{label}</Label>}
      <div className={cn('rounded-md border border-gray-300 bg-white', readOnly && 'bg-gray-50')}>
        {!readOnly && editor && (
          <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-1.5 py-1" role="toolbar" aria-label="Форматирование">
            <ToolButton label="Жирный" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold size={16} />
            </ToolButton>
            <ToolButton label="Курсив" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic size={16} />
            </ToolButton>
            <ToolButton label="Зачёркнутый" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
              <Strikethrough size={16} />
            </ToolButton>
            <span className="mx-1 h-5 w-px bg-gray-200" />
            <ToolButton label="Подзаголовок" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              <Heading2 size={16} />
            </ToolButton>
            <ToolButton label="Подзаголовок поменьше" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              <Heading3 size={16} />
            </ToolButton>
            <ToolButton label="Список" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <List size={16} />
            </ToolButton>
            <ToolButton label="Нумерованный список" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <ListOrdered size={16} />
            </ToolButton>
            <ToolButton label="Цитата" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              <Quote size={16} />
            </ToolButton>
            <span className="mx-1 h-5 w-px bg-gray-200" />
            <ToolButton label="Ссылка" active={editor.isActive('link')} onClick={() => editLink(editor)}>
              <Link2 size={16} />
            </ToolButton>
            <ToolButton label="Убрать ссылку" disabled={!editor.isActive('link')} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}>
              <Link2Off size={16} />
            </ToolButton>
            <span className="mx-1 h-5 w-px bg-gray-200" />
            <ToolButton label="Отменить" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
              <Undo2 size={16} />
            </ToolButton>
            <ToolButton label="Повторить" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
              <Redo2 size={16} />
            </ToolButton>
          </div>
        )}
        <div className="relative">
          {placeholder && editor?.isEmpty && (
            <span className="pointer-events-none absolute left-3 top-2 text-sm text-gray-400">{placeholder}</span>
          )}
          <EditorContent
            editor={editor}
            // Базовые стили CMS (Tailwind) снимают маркеры списков и размеры
            // заголовков — возвращаем их, иначе форматирование не видно.
            className={cn(
              'rich-text min-h-[96px] px-3 py-2 text-sm text-gray-900',
              '[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[80px] [&_p]:my-1',
              '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
              '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-2 [&_h3]:font-semibold [&_h3]:mt-2',
              '[&_blockquote]:border-l-4 [&_blockquote]:border-gray-200 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600',
              '[&_a]:text-primary-700 [&_a]:underline'
            )}
          />
        </div>
      </div>
    </div>
  )
}
