import React, { useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNode } from '@/features/editor/editorSlice'
import type { BlockNode, BlockScript, PageScript, EditorPageSettings } from '@/shared/types'
import { 
  ChevronDown, ChevronRight, Plus, Trash2, Code, 
  FileCode, Pause, CheckCircle
} from 'lucide-react'
import { cn } from '@/shared/utils'

interface ScriptsTabProps {
  node: BlockNode
  isPageRoot?: boolean
  pageSettings?: EditorPageSettings
  onPageSettingsChange?: (settings: EditorPageSettings) => void
}

const SCRIPT_TEMPLATES = {
  'click-handler': {
    name: 'Обработчик клика',
    code: `// Обработчик клика
element.addEventListener('click', function(e) {
  console.log('Клик по элементу', element);
  // Ваш код здесь
});`,
    trigger: 'load' as const,
  },
  'hover-handler': {
    name: 'Hover эффект',
    code: `// Hover эффект
element.addEventListener('mouseenter', function() {
  element.style.transform = 'scale(1.05)';
});
element.addEventListener('mouseleave', function() {
  element.style.transform = 'scale(1)';
});`,
    trigger: 'load' as const,
  },
  'scroll-reveal': {
    name: 'Появление при скролле',
    code: `// Появление при скролле
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      element.classList.add('visible');
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

element.style.opacity = '0';
element.style.transform = 'translateY(20px)';
element.style.transition = 'opacity 0.5s, transform 0.5s';
observer.observe(element);`,
    trigger: 'load' as const,
  },
  'counter': {
    name: 'Счётчик',
    code: `// Анимированный счётчик
const target = parseInt(element.dataset.target || '100');
const duration = 2000;
let start = 0;
const step = (timestamp) => {
  if (!start) start = timestamp;
  const progress = Math.min((timestamp - start) / duration, 1);
  element.textContent = Math.floor(progress * target);
  if (progress < 1) {
    requestAnimationFrame(step);
  }
};
requestAnimationFrame(step);`,
    trigger: 'scroll' as const,
  },
  'carousel': {
    name: 'Карусель/Слайдер',
    code: `// Простая карусель
const slides = element.querySelectorAll('.slide');
let currentSlide = 0;

function showSlide(index) {
  slides.forEach((slide, i) => {
    slide.style.display = i === index ? 'block' : 'none';
  });
}

function nextSlide() {
  currentSlide = (currentSlide + 1) % slides.length;
  showSlide(currentSlide);
}

setInterval(nextSlide, 3000);
showSlide(0);`,
    trigger: 'load' as const,
  },
}

const PAGE_SCRIPT_TEMPLATES = {
  'analytics': {
    name: 'Аналитика',
    code: `// Google Analytics или другая аналитика
console.log('Page loaded:', window.location.pathname);`,
    position: 'body-end' as const,
  },
  'smooth-scroll': {
    name: 'Плавный скролл',
    code: `// Плавный скролл для якорных ссылок
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});`,
    position: 'body-end' as const,
  },
  'lazy-images': {
    name: 'Ленивая загрузка изображений',
    code: `// Ленивая загрузка изображений
document.querySelectorAll('img[data-src]').forEach(img => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        img.src = img.dataset.src;
        observer.disconnect();
      }
    });
  });
  observer.observe(img);
});`,
    position: 'body-end' as const,
  },
  'mobile-menu': {
    name: 'Мобильное меню',
    code: `// Мобильное меню
const menuToggle = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('.mobile-menu');

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('active');
  });
}`,
    position: 'body-end' as const,
  },
}

const generateScriptId = () => `script-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

export const ScriptsTab: React.FC<ScriptsTabProps> = ({ node, isPageRoot, pageSettings, onPageSettingsChange }) => {
  const dispatch = useAppDispatch()
  const [expandedScripts, setExpandedScripts] = useState<string[]>([])
  const [showPageScripts, setShowPageScripts] = useState(false)
  
  const elementScripts = node.scripts || []
  const pageScripts = pageSettings?.scripts || []

  const toggleScript = (id: string) => {
    setExpandedScripts(prev => 
      prev.includes(id) 
        ? prev.filter(s => s !== id)
        : [...prev, id]
    )
  }

  // Element Scripts
  const addElementScript = (template?: keyof typeof SCRIPT_TEMPLATES) => {
    const templateData = template ? SCRIPT_TEMPLATES[template] : null
    
    const newScript: BlockScript = {
      id: generateScriptId(),
      name: templateData?.name || 'Новый скрипт',
      code: templateData?.code || '// Ваш JavaScript код\nconsole.log(element);',
      trigger: templateData?.trigger || 'load',
      enabled: true,
    }
    
    dispatch(updateNode({
      id: node.id,
      updates: {
        scripts: [...elementScripts, newScript],
      },
    }))
    
    setExpandedScripts(prev => [...prev, newScript.id])
  }

  const updateElementScript = (scriptId: string, updates: Partial<BlockScript>) => {
    dispatch(updateNode({
      id: node.id,
      updates: {
        scripts: elementScripts.map(s => 
          s.id === scriptId ? { ...s, ...updates } : s
        ),
      },
    }))
  }

  const deleteElementScript = (scriptId: string) => {
    dispatch(updateNode({
      id: node.id,
      updates: {
        scripts: elementScripts.filter(s => s.id !== scriptId),
      },
    }))
  }

  // Page Scripts
  const addPageScript = (template?: keyof typeof PAGE_SCRIPT_TEMPLATES) => {
    if (!onPageSettingsChange) return
    
    const templateData = template ? PAGE_SCRIPT_TEMPLATES[template] : null
    
    const newScript: PageScript = {
      id: generateScriptId(),
      name: templateData?.name || 'Новый скрипт',
      code: templateData?.code || '// Ваш JavaScript код',
      position: templateData?.position || 'body-end',
      enabled: true,
      loadType: 'defer',
    }
    
    onPageSettingsChange({
      name: pageSettings?.name || '',
      slug: pageSettings?.slug || '',
      status: pageSettings?.status || 'draft',
      metaTitle: pageSettings?.metaTitle || '',
      metaDescription: pageSettings?.metaDescription || '',
      keywords: pageSettings?.keywords || '',
      ogImage: pageSettings?.ogImage || '',
      scripts: [...pageScripts, newScript],
    })
    
    setExpandedScripts(prev => [...prev, newScript.id])
  }

  const updatePageScript = (scriptId: string, updates: Partial<PageScript>) => {
    if (!onPageSettingsChange || !pageSettings) return
    
    onPageSettingsChange({
      ...pageSettings,
      scripts: pageScripts.map(s => 
        s.id === scriptId ? { ...s, ...updates } : s
      ),
    })
  }

  const deletePageScript = (scriptId: string) => {
    if (!onPageSettingsChange || !pageSettings) return
    
    onPageSettingsChange({
      ...pageSettings,
      scripts: pageScripts.filter(s => s.id !== scriptId),
    })
  }

  return (
    <div className="space-y-4">
      {/* Element Scripts Section */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <FileCode size={14} />
          Скрипты элемента
        </h4>
        <p className="text-xs text-gray-500 mb-3">
          Эти скрипты выполняются в контексте элемента (доступна переменная <code className="bg-gray-100 px-1 rounded">element</code>)
        </p>
        
        {/* Quick Add Templates */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {Object.entries(SCRIPT_TEMPLATES).slice(0, 4).map(([key, template]) => (
            <button
              key={key}
              onClick={() => addElementScript(key as keyof typeof SCRIPT_TEMPLATES)}
              className="px-2 py-2 text-xs text-left text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
            >
              <Code size={12} className="inline mr-1 text-gray-500" />
              {template.name}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => addElementScript()}
          className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={14} />
          Пустой скрипт
        </button>
        
        {/* Element Scripts List */}
        {elementScripts.length > 0 && (
          <div className="mt-3 space-y-2">
            {elementScripts.map((script) => (
              <ScriptItem
                key={script.id}
                script={script}
                isExpanded={expandedScripts.includes(script.id)}
                onToggle={() => toggleScript(script.id)}
                onUpdate={(updates) => updateElementScript(script.id, updates)}
                onDelete={() => deleteElementScript(script.id)}
                type="element"
              />
            ))}
          </div>
        )}
      </div>

      {/* Page Scripts Section (only for root element) */}
      {isPageRoot && (
        <div className="border-t pt-4">
          <button
            onClick={() => setShowPageScripts(!showPageScripts)}
            className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2"
          >
            <span className="flex items-center gap-2">
              <Code size={14} />
              Скрипты страницы
              {pageScripts.length > 0 && (
                <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded">
                  {pageScripts.length}
                </span>
              )}
            </span>
            {showPageScripts ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          
          {showPageScripts && (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Глобальные скрипты страницы, выполняются в разных местах HTML
              </p>
              
              {/* Quick Add Page Templates */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {Object.entries(PAGE_SCRIPT_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => addPageScript(key as keyof typeof PAGE_SCRIPT_TEMPLATES)}
                    className="px-2 py-2 text-xs text-left text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                  >
                    <Code size={12} className="inline mr-1 text-gray-500" />
                    {template.name}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => addPageScript()}
                className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={14} />
                Пустой скрипт страницы
              </button>
              
              {/* Page Scripts List */}
              {pageScripts.length > 0 && (
                <div className="mt-3 space-y-2">
                  {pageScripts.map((script) => (
                    <ScriptItem
                      key={script.id}
                      script={script}
                      isExpanded={expandedScripts.includes(script.id)}
                      onToggle={() => toggleScript(script.id)}
                      onUpdate={(updates) => updatePageScript(script.id, updates)}
                      onDelete={() => deletePageScript(script.id)}
                      type="page"
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Reusable Script Item Component
interface ScriptItemProps {
  script: BlockScript | PageScript
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (updates: Partial<BlockScript | PageScript>) => void
  onDelete: () => void
  type: 'element' | 'page'
}

const ScriptItem: React.FC<ScriptItemProps> = ({
  script,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  type,
}) => {
  const isPageScript = type === 'page'
  const pageScript = script as PageScript
  const elementScript = script as BlockScript

  return (
    <div className={cn(
      "border rounded-lg overflow-hidden",
      script.enabled ? "border-gray-200" : "border-gray-200 opacity-60"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Code size={14} className={script.enabled ? "text-green-600" : "text-gray-400"} />
          <span className="text-sm font-medium text-gray-700">{script.name}</span>
        </button>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdate({ enabled: !script.enabled })}
            className={cn(
              "p-1 rounded transition-colors",
              script.enabled ? "hover:bg-green-100" : "hover:bg-gray-200"
            )}
            title={script.enabled ? "Отключить" : "Включить"}
          >
            {script.enabled ? (
              <CheckCircle size={14} className="text-green-600" />
            ) : (
              <Pause size={14} className="text-gray-400" />
            )}
          </button>
          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-100 rounded transition-colors"
            title="Удалить"
          >
            <Trash2 size={12} className="text-red-500" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      {isExpanded && (
        <div className="p-3 space-y-3 bg-white border-t border-gray-200">
          {/* Name */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Название</label>
            <input
              type="text"
              value={script.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          
          {/* Trigger/Position */}
          {isPageScript ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Позиция</label>
                <select
                  value={pageScript.position}
                  onChange={(e) => onUpdate({ position: e.target.value as PageScript['position'] })}
                  className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="head">В &lt;head&gt;</option>
                  <option value="body-start">Начало &lt;body&gt;</option>
                  <option value="body-end">Конец &lt;body&gt;</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Загрузка</label>
                <select
                  value={pageScript.loadType}
                  onChange={(e) => onUpdate({ loadType: e.target.value as PageScript['loadType'] })}
                  className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="sync">Синхронно</option>
                  <option value="async">Async</option>
                  <option value="defer">Defer</option>
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Триггер</label>
              <select
                value={elementScript.trigger}
                onChange={(e) => onUpdate({ trigger: e.target.value as BlockScript['trigger'] })}
                className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="load">При загрузке</option>
                <option value="click">При клике</option>
                <option value="hover">При наведении</option>
                <option value="scroll">При появлении в viewport</option>
                <option value="custom">Свой триггер</option>
              </select>
            </div>
          )}
          
          {/* Custom Trigger */}
          {!isPageScript && elementScript.trigger === 'custom' && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Свой триггер (событие)</label>
              <input
                type="text"
                value={elementScript.customTrigger || ''}
                onChange={(e) => onUpdate({ customTrigger: e.target.value })}
                placeholder="например: dblclick, contextmenu"
                className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          )}
          
          {/* Code Editor */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Код</label>
            <textarea
              value={script.code}
              onChange={(e) => onUpdate({ code: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono bg-gray-50 text-gray-800"
              rows={10}
              spellCheck={false}
            />
            <p className="text-xs text-gray-500 mt-1">
              {isPageScript 
                ? 'Код выполняется глобально на странице'
                : 'Переменная element содержит DOM элемент'
              }
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
