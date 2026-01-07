# Архитектура визуального конструктора веб-страниц

## 1. Общая архитектура проекта

### 1.1 Технологический стек

**Frontend:**
- **React 18+** - основной фреймворк UI
- **TypeScript** - типизация и безопасность кода
- **Redux Toolkit** - управление состоянием
- **React DnD** или **dnd-kit** - drag and drop функциональность
- **Monaco Editor** - редактор CSS кода
- **TailwindCSS** + **CSS Modules** - стилизация
- **Vite** - сборщик проекта

**Backend:**
- **Node.js + Express** или **NestJS** - API сервер
- **PostgreSQL** - основная база данных
- **MongoDB** - хранение JSON структур блоков (опционально)
- **Redis** - кэширование
- **AWS S3 / MinIO** - хранение медиа файлов

**Дополнительно:**
- **WebSocket** - реал-тайм коллаборация (опционально)
- **Docker** - контейнеризация
- **Jest + React Testing Library** - тестирование

---

## 2. Структура данных

### 2.1 Модель страницы (Page)

```typescript
interface Page {
  id: string;
  name: string;
  slug: string;
  groupId: string;
  metadata: {
    title: string;
    description: string;
    keywords: string[];
    ogImage?: string;
  };
  rootBlockId: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'published' | 'archived';
  version: number;
}
```

### 2.2 Модель блока (Block)

```typescript
interface Block {
  id: string;
  name: string;
  type: BlockType;
  groupId: string;
  isReusable: boolean; // Может ли использоваться в других блоках
  structure: BlockNode;
  thumbnail?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

type BlockType = 
  | 'container'
  | 'input'
  | 'output'
  | 'static'
  | 'composite'; // Сохраненный блок из других блоков
```

### 2.3 Модель узла блока (BlockNode)

```typescript
interface BlockNode {
  id: string;
  elementType: ElementType;
  tagName: string; // div, section, article, input, etc.
  
  // Стили
  styles: {
    properties: CSSProperties; // Из drag-drop и property editor
    customCSS?: string; // Plain CSS (высший приоритет)
  };
  
  // Для контейнеров
  layoutMode?: 'absolute' | 'flex' | 'grid' | 'table';
  
  // Дочерние элементы
  children: BlockNode[];
  
  // Ссылка на переиспользуемый блок
  blockReference?: string;
  
  // Атрибуты
  attributes: Record<string, string>;
  
  // Контент для текстовых элементов
  content?: string;
  
  // Условный рендеринг и привязка данных (для будущего)
  bindings?: DataBinding[];
  
  // Метаданные для редактора
  metadata: {
    locked?: boolean;
    hidden?: boolean;
    name?: string; // Пользовательское имя для элемента
  };
}

type ElementType = 
  | 'container'
  | 'text'
  | 'image'
  | 'input'
  | 'button'
  | 'link'
  | 'video'
  | 'block-reference';

interface CSSProperties {
  // Позиционирование
  position?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  
  // Размеры
  width?: string;
  height?: string;
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;
  
  // Flexbox
  display?: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
  flex?: string;
  
  // Grid
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridColumn?: string;
  gridRow?: string;
  
  // Отступы
  margin?: string;
  padding?: string;
  
  // Цвета и фоны
  backgroundColor?: string;
  color?: string;
  backgroundImage?: string;
  
  // Типография
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  
  // Границы
  border?: string;
  borderRadius?: string;
  
  // Прочее
  opacity?: string;
  zIndex?: string;
  overflow?: string;
  
  [key: string]: string | undefined;
}
```

### 2.4 Модель группы (Group)

```typescript
interface Group {
  id: string;
  name: string;
  type: 'pages' | 'blocks';
  parentId?: string; // Для вложенных групп
  order: number;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 3. Архитектура компонентов Frontend

### 3.1 Структура проекта

```
src/
├── app/
│   ├── store.ts                 # Redux store
│   └── routes.tsx               # Роутинг
├── features/
│   ├── editor/
│   │   ├── components/
│   │   │   ├── Canvas/          # Рабочая область
│   │   │   ├── Toolbar/         # Верхняя панель инструментов
│   │   │   ├── LeftPanel/       # Библиотека элементов
│   │   │   ├── RightPanel/      # Панель свойств
│   │   │   ├── LayersPanel/     # Дерево элементов
│   │   │   └── DragPreview/     # Превью при drag
│   │   ├── hooks/
│   │   │   ├── useDragDrop.ts
│   │   │   ├── useSelection.ts
│   │   │   └── useHistory.ts    # Undo/Redo
│   │   ├── utils/
│   │   │   ├── cssCompiler.ts   # Компиляция стилей
│   │   │   ├── validator.ts     # Валидация drop зон
│   │   │   └── serializer.ts    # Сериализация/десериализация
│   │   └── editorSlice.ts       # Redux slice
│   ├── pages/
│   │   ├── components/
│   │   │   ├── PageList/
│   │   │   └── PageManager/
│   │   └── pagesSlice.ts
│   ├── blocks/
│   │   ├── components/
│   │   │   ├── BlockLibrary/
│   │   │   └── BlockManager/
│   │   └── blocksSlice.ts
│   └── groups/
│       ├── components/
│       │   └── GroupManager/
│       └── groupsSlice.ts
├── shared/
│   ├── components/
│   │   ├── Button/
│   │   ├── Input/
│   │   └── Modal/
│   ├── ui/                      # UI kit компоненты
│   └── utils/
├── widgets/                     # Составные компоненты
│   ├── Sidebar/
│   └── PropertyEditor/
└── main.tsx
```

### 3.2 Ключевые компоненты

#### Canvas (Рабочая область)

```typescript
// Основной компонент редактора
const Canvas: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  
  const handleDrop = (item, dropTarget, position) => {
    // Валидация возможности drop
    const validation = validateDrop(item, dropTarget);
    
    if (!validation.isValid) {
      // Показать меню разрешения конфликта
      showConflictResolutionMenu(validation.conflicts);
      return;
    }
    
    // Выполнить drop
    dispatch(addNode({ item, dropTarget, position }));
  };
  
  return (
    <DndContext onDragEnd={handleDrop}>
      <CanvasRenderer 
        rootNode={rootNode}
        onSelect={setSelectedNode}
        selectedId={selectedNode}
      />
    </DndContext>
  );
};
```

#### CanvasRenderer

```typescript
// Рекурсивный рендеринг дерева элементов
const CanvasRenderer: React.FC<{
  node: BlockNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
}> = ({ node, isSelected, onSelect }) => {
  const computedStyles = useMemo(() => {
    // Приоритет: customCSS > properties
    return {
      ...node.styles.properties,
      ...(node.styles.customCSS ? parseCSSString(node.styles.customCSS) : {})
    };
  }, [node.styles]);
  
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: node.id,
    data: node
  });
  
  const { setNodeRef: setDropRef } = useDroppable({
    id: node.id,
    data: node
  });
  
  return (
    <div
      ref={combineRefs(setNodeRef, setDropRef)}
      style={computedStyles}
      className={cn(
        isSelected && 'editor-selected',
        'editor-element'
      )}
      onClick={() => onSelect(node.id)}
      {...attributes}
      {...listeners}
    >
      {node.children.map(child => (
        <CanvasRenderer
          key={child.id}
          node={child}
          isSelected={selectedId === child.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};
```

#### LeftPanel - Библиотека элементов

```typescript
const LibraryPanel: React.FC = () => {
  const categories = [
    {
      name: 'Контейнеры',
      items: [
        { type: 'container', label: 'Div', icon: <BoxIcon /> },
        { type: 'container', label: 'Section', icon: <SectionIcon /> },
        { type: 'container', label: 'Article', icon: <ArticleIcon /> },
      ]
    },
    {
      name: 'Ввод данных',
      items: [
        { type: 'input', label: 'Text Input', icon: <InputIcon /> },
        { type: 'input', label: 'Textarea', icon: <TextareaIcon /> },
        { type: 'input', label: 'Checkbox', icon: <CheckboxIcon /> },
      ]
    },
    // ... другие категории
  ];
  
  const savedBlocks = useSelector(selectReusableBlocks);
  
  return (
    <div className="library-panel">
      {categories.map(category => (
        <CategorySection key={category.name} {...category} />
      ))}
      
      <CategorySection
        name="Блоки"
        items={savedBlocks.map(block => ({
          type: 'block-reference',
          label: block.name,
          blockId: block.id
        }))}
      />
    </div>
  );
};
```

#### RightPanel - Панель свойств

```typescript
const PropertiesPanel: React.FC = () => {
  const selectedNode = useSelector(selectSelectedNode);
  
  if (!selectedNode) {
    return <EmptyState />;
  }
  
  return (
    <div className="properties-panel">
      {/* Общие свойства */}
      <Section title="Основные">
        <Input
          label="ID"
          value={selectedNode.id}
          disabled
        />
        <Input
          label="Имя"
          value={selectedNode.metadata.name}
          onChange={handleNameChange}
        />
      </Section>
      
      {/* Свойства контейнера */}
      {selectedNode.elementType === 'container' && (
        <Section title="Режим отображения">
          <Select
            value={selectedNode.layoutMode}
            onChange={handleLayoutModeChange}
            options={[
              { value: 'absolute', label: 'Absolute' },
              { value: 'flex', label: 'Flexbox' },
              { value: 'grid', label: 'Grid' },
              { value: 'table', label: 'Table' },
            ]}
          />
        </Section>
      )}
      
      {/* Стили */}
      <StyleEditor
        node={selectedNode}
        layoutMode={selectedNode.layoutMode}
      />
      
      {/* CSS редактор */}
      <Section title="Custom CSS" collapsible>
        <MonacoEditor
          language="css"
          value={selectedNode.styles.customCSS || ''}
          onChange={handleCSSChange}
          height="200px"
        />
      </Section>
    </div>
  );
};
```

#### StyleEditor

```typescript
const StyleEditor: React.FC<{
  node: BlockNode;
  layoutMode?: LayoutMode;
}> = ({ node, layoutMode }) => {
  return (
    <>
      {/* Размеры */}
      <Section title="Размеры">
        <DimensionInput
          label="Width"
          value={node.styles.properties.width}
          onChange={v => updateStyle('width', v)}
        />
        <DimensionInput
          label="Height"
          value={node.styles.properties.height}
          onChange={v => updateStyle('height', v)}
        />
      </Section>
      
      {/* Специфичные для режима */}
      {layoutMode === 'flex' && (
        <FlexboxControls styles={node.styles.properties} />
      )}
      
      {layoutMode === 'grid' && (
        <GridControls styles={node.styles.properties} />
      )}
      
      {layoutMode === 'absolute' && (
        <AbsoluteControls styles={node.styles.properties} />
      )}
      
      {/* Отступы и границы */}
      <SpacingControls styles={node.styles.properties} />
      <BorderControls styles={node.styles.properties} />
      <TypographyControls styles={node.styles.properties} />
      <BackgroundControls styles={node.styles.properties} />
    </>
  );
};
```

### 3.3 Drag & Drop система

#### Валидация Drop зоны

```typescript
interface DropValidation {
  isValid: boolean;
  conflicts: Conflict[];
}

interface Conflict {
  type: 'layout-mismatch' | 'nesting-depth' | 'circular-reference' | 'invalid-parent';
  message: string;
  suggestions: ConflictResolution[];
}

interface ConflictResolution {
  action: 'wrap' | 'change-layout' | 'move-to-sibling' | 'cancel';
  label: string;
  description: string;
}

function validateDrop(
  draggedItem: BlockNode,
  dropTarget: BlockNode,
  position: 'before' | 'after' | 'inside'
): DropValidation {
  const conflicts: Conflict[] = [];
  
  // 1. Проверка циклических ссылок
  if (isDescendant(dropTarget, draggedItem)) {
    conflicts.push({
      type: 'circular-reference',
      message: 'Невозможно переместить элемент внутрь самого себя',
      suggestions: [{ action: 'cancel', label: 'Отменить', description: '' }]
    });
  }
  
  // 2. Проверка совместимости layout режимов
  if (position === 'inside') {
    if (dropTarget.layoutMode === 'table' && !isTableCompatible(draggedItem)) {
      conflicts.push({
        type: 'layout-mismatch',
        message: 'Элемент несовместим с Table layout',
        suggestions: [
          {
            action: 'wrap',
            label: 'Обернуть в <td>',
            description: 'Создать ячейку таблицы и поместить элемент в неё'
          },
          { action: 'cancel', label: 'Отменить', description: '' }
        ]
      });
    }
    
    if (dropTarget.layoutMode === 'absolute') {
      // Для absolute позиционирования нужны координаты
      conflicts.push({
        type: 'layout-mismatch',
        message: 'Требуется указать позицию для absolute layout',
        suggestions: [
          {
            action: 'change-layout',
            label: 'Изменить на Flex',
            description: 'Изменить режим контейнера на Flexbox'
          },
          { action: 'cancel', label: 'Отменить', description: '' }
        ]
      });
    }
  }
  
  // 3. Проверка глубины вложенности
  if (getDepth(dropTarget) > MAX_NESTING_DEPTH) {
    conflicts.push({
      type: 'nesting-depth',
      message: `Превышена максимальная глубина вложенности (${MAX_NESTING_DEPTH})`,
      suggestions: [{ action: 'cancel', label: 'Отменить', description: '' }]
    });
  }
  
  return {
    isValid: conflicts.length === 0,
    conflicts
  };
}
```

#### Меню разрешения конфликтов

```typescript
const ConflictResolutionMenu: React.FC<{
  conflicts: Conflict[];
  onResolve: (resolution: ConflictResolution) => void;
  onCancel: () => void;
}> = ({ conflicts, onResolve, onCancel }) => {
  return (
    <Modal title="Невозможно выполнить действие" onClose={onCancel}>
      {conflicts.map((conflict, index) => (
        <div key={index} className="conflict-item">
          <div className="conflict-message">{conflict.message}</div>
          <div className="conflict-suggestions">
            {conflict.suggestions.map((suggestion, sIndex) => (
              <Button
                key={sIndex}
                onClick={() => onResolve(suggestion)}
                variant={suggestion.action === 'cancel' ? 'secondary' : 'primary'}
              >
                {suggestion.label}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
};
```

---

## 4. Система стилей с приоритетами

### 4.1 Компиляция стилей

```typescript
class StyleCompiler {
  /**
   * Компилирует финальные стили с учетом приоритетов:
   * customCSS > properties
   */
  compile(node: BlockNode): React.CSSProperties {
    const baseStyles = this.convertPropertiesToCSS(node.styles.properties);
    
    if (!node.styles.customCSS) {
      return baseStyles;
    }
    
    const customStyles = this.parseCustomCSS(node.styles.customCSS);
    
    return {
      ...baseStyles,
      ...customStyles
    };
  }
  
  private convertPropertiesToCSS(
    properties: CSSProperties
  ): React.CSSProperties {
    // Конвертация из нашего формата в React.CSSProperties
    return properties as React.CSSProperties;
  }
  
  private parseCustomCSS(cssString: string): React.CSSProperties {
    // Парсинг CSS строки в объект стилей
    // Можно использовать css-tree или postcss
    const ast = postcss.parse(cssString);
    const styles: Record<string, string> = {};
    
    ast.walkDecls(decl => {
      const camelCaseProp = this.kebabToCamel(decl.prop);
      styles[camelCaseProp] = decl.value;
    });
    
    return styles as React.CSSProperties;
  }
  
  private kebabToCamel(str: string): string {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }
}
```

### 4.2 Визуальная индикация источника стилей

```typescript
// В панели свойств показываем откуда берется значение
const StyleProperty: React.FC<{
  property: string;
  value: string;
  source: 'properties' | 'customCSS';
}> = ({ property, value, source }) => {
  return (
    <div className="style-property">
      <label>{property}</label>
      <Input
        value={value}
        disabled={source === 'customCSS'}
        className={cn(source === 'customCSS' && 'overridden')}
      />
      {source === 'customCSS' && (
        <Tooltip content="Значение переопределено в Custom CSS">
          <InfoIcon />
        </Tooltip>
      )}
    </div>
  );
};
```

---

## 5. Backend API

### 5.1 RESTful API эндпоинты

```
# Страницы
GET    /api/pages                    # Список всех страниц
GET    /api/pages/:id                # Получить страницу
POST   /api/pages                    # Создать страницу
PUT    /api/pages/:id                # Обновить страницу
DELETE /api/pages/:id                # Удалить страницу
POST   /api/pages/:id/publish        # Опубликовать страницу

# Блоки
GET    /api/blocks                   # Список всех блоков
GET    /api/blocks/:id               # Получить блок
POST   /api/blocks                   # Создать блок
PUT    /api/blocks/:id               # Обновить блок
DELETE /api/blocks/:id               # Удалить блок
GET    /api/blocks/reusable          # Только переиспользуемые блоки

# Группы
GET    /api/groups                   # Список всех групп
POST   /api/groups                   # Создать группу
PUT    /api/groups/:id               # Обновить группу
DELETE /api/groups/:id               # Удалить группу

# Медиа
POST   /api/media/upload             # Загрузка файлов
GET    /api/media/:id                # Получить файл
DELETE /api/media/:id                # Удалить файл

# Экспорт
GET    /api/export/page/:id          # Экспорт страницы в HTML/CSS
POST   /api/import/page              # Импорт страницы
```

### 5.2 Database Schema (PostgreSQL)

```sql
-- Группы
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('pages', 'blocks')),
  parent_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Страницы
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  metadata JSONB,
  root_block_id UUID,
  status VARCHAR(50) DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Блоки
CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  is_reusable BOOLEAN DEFAULT FALSE,
  structure JSONB NOT NULL, -- Полное дерево BlockNode
  thumbnail VARCHAR(500),
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Медиа файлы
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Версии страниц (для истории изменений)
CREATE TABLE page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  structure JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_pages_group ON pages(group_id);
CREATE INDEX idx_pages_slug ON pages(slug);
CREATE INDEX idx_blocks_group ON blocks(group_id);
CREATE INDEX idx_blocks_reusable ON blocks(is_reusable) WHERE is_reusable = TRUE;
```

---

## 6. Продвинутые функции

### 6.1 Undo/Redo

```typescript
// Используем immer для иммутабельности и history библиотеку
import { useImmer } from 'use-immer';

const useEditorHistory = () => {
  const [history, setHistory] = useState<BlockNode[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  const pushState = (state: BlockNode) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndex + 1);
      return [...newHistory, state];
    });
    setCurrentIndex(i => i + 1);
  };
  
  const undo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      return history[currentIndex - 1];
    }
  };
  
  const redo = () => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(i => i + 1);
      return history[currentIndex + 1];
    }
  };
  
  return { pushState, undo, redo, canUndo: currentIndex > 0, canRedo: currentIndex < history.length - 1 };
};
```

### 6.2 Адаптивность (Responsive Design)

```typescript
interface ResponsiveStyles {
  base: CSSProperties;
  tablet?: CSSProperties;
  mobile?: CSSProperties;
}

interface BlockNodeWithResponsive extends BlockNode {
  styles: {
    properties: ResponsiveStyles;
    customCSS?: {
      base: string;
      tablet?: string;
      mobile?: string;
    };
  };
}

// В редакторе добавить переключатель viewport
const ViewportSelector: React.FC = () => {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  
  return (
    <div className="viewport-selector">
      <Button onClick={() => setViewport('desktop')}>Desktop</Button>
      <Button onClick={() => setViewport('tablet')}>Tablet</Button>
      <Button onClick={() => setViewport('mobile')}>Mobile</Button>
    </div>
  );
};
```

### 6.3 Компоненты с данными (Data Binding)

```typescript
interface DataBinding {
  type: 'static' | 'dynamic';
  source?: string; // API endpoint или переменная
  transform?: string; // JavaScript функция для трансформации
  fallback?: string;
}

// Пример использования
const DataBoundText: React.FC<{
  node: BlockNode;
}> = ({ node }) => {
  const { data, loading, error } = useDataBinding(node.bindings?.[0]);
  
  if (loading) return <Skeleton />;
  if (error) return <span>{node.bindings?.[0].fallback}</span>;
  
  return <span>{data}</span>;
};
```

---

## 7. Оптимизация и производительность

### 7.1 Виртуализация для больших деревьев

```typescript
import { FixedSizeTree } from 'react-vtree';

// Для отображения дерева элементов в LayersPanel
const VirtualizedLayersTree: React.FC = () => {
  // Используем виртуализацию для больших деревьев
  return (
    <FixedSizeTree
      treeWalker={treeWalker}
      itemSize={30}
      height={600}
    >
      {Node}
    </FixedSizeTree>
  );
};
```

### 7.2 Мемоизация компонентов

```typescript
// Мемоизация рендереров элементов
const MemoizedCanvasRenderer = React.memo(CanvasRenderer, (prev, next) => {
  return (
    prev.node.id === next.node.id &&
    prev.isSelected === next.isSelected &&
    isEqual(prev.node.styles, next.node.styles)
  );
});
```

### 7.3 Code Splitting

```typescript
// Lazy loading редактора
const Editor = lazy(() => import('./features/editor/Editor'));
const PageManager = lazy(() => import('./features/pages/PageManager'));

// В роутинге
<Route path="/editor" element={
  <Suspense fallback={<LoadingScreen />}>
    <Editor />
  </Suspense>
} />
```

---

## 8. Экспорт и генерация кода

### 8.1 Генератор HTML/CSS

```typescript
class CodeGenerator {
  generateHTML(rootNode: BlockNode): string {
    return this.renderNode(rootNode);
  }
  
  private renderNode(node: BlockNode, depth = 0): string {
    const indent = '  '.repeat(depth);
    const tag = node.tagName || 'div';
    const attrs = this.generateAttributes(node);
    const styles = this.generateInlineStyles(node);
    
    let html = `${indent}<${tag}${attrs}${styles}>`;
    
    if (node.content) {
      html += node.content;
    }
    
    if (node.children.length > 0) {
      html += '\n';
      node.children.forEach(child => {
        html += this.renderNode(child, depth + 1);
      });
      html += indent;
    }
    
    html += `</${tag}>\n`;
    
    return html;
  }
  
  private generateAttributes(node: BlockNode): string {
    const attrs = Object.entries(node.attributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');
    
    return attrs ? ` ${attrs}` : '';
  }
  
  private generateInlineStyles(node: BlockNode): string {
    const compiler = new StyleCompiler();
    const styles = compiler.compile(node);
    
    const styleString = Object.entries(styles)
      .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
      .join('; ');
    
    return styleString ? ` style="${styleString}"` : '';
  }
  
  generateCSS(rootNode: BlockNode): string {
    // Генерация CSS классов вместо inline styles
    let css = '';
    let classCounter = 0;
    
    const processNode = (node: BlockNode): string => {
      const className = `element-${classCounter++}`;
      const styles = new StyleCompiler().compile(node);
      
      css += `.${className} {\n`;
      Object.entries(styles).forEach(([key, value]) => {
        css += `  ${this.camelToKebab(key)}: ${value};\n`;
      });
      css += '}\n\n';
      
      node.children.forEach(processNode);
      
      return className;
    };
    
    processNode(rootNode);
    return css;
  }
  
  private camelToKebab(str: string): string {
    return str.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
  }
}
```

---

## 9. Безопасность

### 9.1 Санитизация пользовательского CSS

```typescript
import postcss from 'postcss';
import safe from 'postcss-safe-parser';

class CSSSanitizer {
  sanitize(cssString: string): string {
    // Парсим CSS безопасным парсером
    const root = postcss.parse(cssString, { parser: safe });
    
    // Удаляем опасные свойства
    root.walkDecls(decl => {
      if (this.isDangerous(decl.prop)) {
        decl.remove();
      }
      
      // Проверяем значения на наличие JavaScript
      if (this.containsJS(decl.value)) {
        decl.remove();
      }
    });
    
    return root.toString();
  }
  
  private isDangerous(prop: string): boolean {
    const dangerous = ['behavior', 'binding', '-moz-binding'];
    return dangerous.includes(prop.toLowerCase());
  }
  
  private containsJS(value: string): boolean {
    const jsPatterns = [
      /javascript:/i,
      /expression\(/i,
      /<script/i,
      /on\w+\s*=/i
    ];
    
    return jsPatterns.some(pattern => pattern.test(value));
  }
}
```

### 9.2 Валидация данных

```typescript
import { z } from 'zod';

const BlockNodeSchema = z.object({
  id: z.string().uuid(),
  elementType: z.enum(['container', 'text', 'image', 'input', 'button', 'link', 'video', 'block-reference']),
  tagName: z.string(),
  styles: z.object({
    properties: z.record(z.string()),
    customCSS: z.string().optional()
  }),
  layoutMode: z.enum(['absolute', 'flex', 'grid', 'table']).optional(),
  children: z.lazy(() => z.array(BlockNodeSchema)),
  attributes: z.record(z.string()),
  content: z.string().optional(),
  metadata: z.object({
    locked: z.boolean().optional(),
    hidden: z.boolean().optional(),
    name: z.string().optional()
  })
});

// Использование
function validateBlockNode(data: unknown): BlockNode {
  return BlockNodeSchema.parse(data);
}
```

---

## 10. Тестирование

### 10.1 Unit тесты

```typescript
// StyleCompiler.test.ts
describe('StyleCompiler', () => {
  it('should merge properties and customCSS correctly', () => {
    const node: BlockNode = {
      styles: {
        properties: { width: '100px', height: '200px' },
        customCSS: 'width: 150px; color: red;'
      }
    };
    
    const compiler = new StyleCompiler();
    const result = compiler.compile(node);
    
    expect(result.width).toBe('150px'); // customCSS wins
    expect(result.height).toBe('200px'); // from properties
    expect(result.color).toBe('red'); // from customCSS
  });
});

// validateDrop.test.ts
describe('validateDrop', () => {
  it('should detect circular reference', () => {
    const parent = createNode({ id: 'parent' });
    const child = createNode({ id: 'child' });
    parent.children.push(child);
    
    const result = validateDrop(parent, child, 'inside');
    
    expect(result.isValid).toBe(false);
    expect(result.conflicts[0].type).toBe('circular-reference');
  });
});
```

### 10.2 E2E тесты с Playwright

```typescript
import { test, expect } from '@playwright/test';

test('should create a new block', async ({ page }) => {
  await page.goto('/editor');
  
  // Drag element from library
  await page.dragAndDrop(
    '[data-library-item="container"]',
    '[data-canvas-drop-zone]'
  );
  
  // Verify element was added
  await expect(page.locator('[data-canvas-element]')).toHaveCount(1);
  
  // Select element
  await page.click('[data-canvas-element]');
  
  // Change property
  await page.fill('[data-property="width"]', '500px');
  
  // Verify style was applied
  const element = page.locator('[data-canvas-element]');
  await expect(element).toHaveCSS('width', '500px');
});
```

---

## 11. Deployment

### 11.1 Docker Compose

```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://backend:5000
    depends_on:
      - backend
  
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/cms
      - REDIS_URL=redis://redis:6379
      - S3_BUCKET=cms-media
    depends_on:
      - postgres
      - redis
  
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=cms
    volumes:
      - postgres-data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
  
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=admin
      - MINIO_ROOT_PASSWORD=password
    volumes:
      - minio-data:/data

volumes:
  postgres-data:
  redis-data:
  minio-data:
```

---

## 12. Roadmap развития

### Фаза 1 (MVP) - 3 месяца
- ✅ Базовый редактор с drag & drop
- ✅ Библиотека основных элементов
- ✅ 4 режима layout (absolute, flex, grid, table)
- ✅ Панель свойств
- ✅ Custom CSS редактор
- ✅ Сохранение/загрузка страниц

### Фаза 2 - 2 месяца
- ⬜ Система переиспользуемых блоков
- ⬜ Группы и организация
- ⬜ Экспорт в HTML/CSS
- ⬜ История изменений (undo/redo)
- ⬜ Медиа библиотека

### Фаза 3 - 2 месяца
- ⬜ Responsive дизайн (tablet, mobile)
- ⬜ Компоненты с привязкой данных
- ⬜ Шаблоны страниц
- ⬜ Темы и стили сайта

### Фаза 4 - 3 месяца
- ⬜ Коллаборация (многопользовательское редактирование)
- ⬜ Комментарии и ревью
- ⬜ A/B тестирование
- ⬜ Аналитика и метрики

### Фаза 5
- ⬜ Плагины и расширения
- ⬜ Marketplace блоков
- ⬜ Интеграции (CRM, аналитика и т.д.)
- ⬜ Headless CMS режим

---

Это базовая архитектура системы. Готов перейти к детальному плану реализации?
