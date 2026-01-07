# План реализации визуального конструктора CMS

## 1. Подготовка проекта (Неделя 1)

### 1.1 Настройка инфраструктуры

**Frontend:**
```bash
# Создание проекта
npm create vite@latest visual-cms-frontend -- --template react-ts
cd visual-cms-frontend

# Установка основных зависимостей
npm install \
  react-redux @reduxjs/toolkit \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
  @monaco-editor/react \
  axios \
  react-router-dom \
  zustand \
  immer use-immer \
  zod \
  clsx tailwind-merge \
  lucide-react

# Dev dependencies
npm install -D \
  tailwindcss postcss autoprefixer \
  @types/react @types/react-dom \
  eslint prettier \
  vitest @testing-library/react \
  @playwright/test
```

**Backend:**
```bash
# Создание проекта
mkdir visual-cms-backend && cd visual-cms-backend
npm init -y

# Установка зависимостей
npm install \
  express \
  typescript ts-node \
  @types/express @types/node \
  pg pg-hstore \
  typeorm \
  redis \
  aws-sdk \
  dotenv \
  cors helmet \
  express-validator \
  jsonwebtoken bcrypt \
  multer

# Dev dependencies
npm install -D \
  nodemon \
  jest @types/jest \
  supertest @types/supertest
```

### 1.2 Структура проекта

```
visual-cms/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   ├── features/
│   │   ├── shared/
│   │   ├── widgets/
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
└── README.md
```

---

## 2. Фаза 1: MVP (Месяцы 1-3)

### Месяц 1: Базовая функциональность

#### Неделя 1-2: Базовый UI и роутинг

**Задачи:**
1. ✅ Настроить проект (см. выше)
2. ✅ Создать базовый UI Kit
   - Button, Input, Select, Modal, Tooltip
   - Layout компоненты (Sidebar, Panel, Header)
3. ✅ Настроить роутинг
   - Главная страница
   - Страница редактора
   - Список страниц/блоков
4. ✅ Создать Redux store
   - editorSlice - состояние редактора
   - pagesSlice - список страниц
   - blocksSlice - список блоков

**Компоненты для создания:**

```typescript
// src/shared/components/Button/Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

// src/shared/components/Input/Input.tsx
interface InputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'email';
  placeholder?: string;
  disabled?: boolean;
}

// src/widgets/Sidebar/Sidebar.tsx
interface SidebarProps {
  items: SidebarItem[];
  activeItem?: string;
  onItemClick: (id: string) => void;
}

// src/app/routes.tsx
const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/pages', element: <PagesList /> },
      { path: '/blocks', element: <BlocksList /> },
      { path: '/editor/page/:id', element: <Editor /> },
      { path: '/editor/block/:id', element: <Editor /> },
    ]
  }
]);
```

**Файлы для создания:**
1. `src/shared/components/Button/Button.tsx`
2. `src/shared/components/Input/Input.tsx`
3. `src/shared/components/Select/Select.tsx`
4. `src/shared/components/Modal/Modal.tsx`
5. `src/widgets/Sidebar/Sidebar.tsx`
6. `src/app/store.ts`
7. `src/app/routes.tsx`
8. `src/features/editor/editorSlice.ts`

---

#### Неделя 3-4: Редактор - Canvas и базовый рендеринг

**Задачи:**
1. ✅ Создать Canvas компонент
2. ✅ Реализовать рекурсивный рендеринг BlockNode
3. ✅ Добавить систему выбора элементов
4. ✅ Реализовать визуальные индикаторы (границы, hover)

**Компоненты для создания:**

```typescript
// src/features/editor/components/Canvas/Canvas.tsx
export const Canvas: React.FC = () => {
  const rootNode = useSelector(selectRootNode);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  return (
    <div className="canvas-container">
      <CanvasRenderer 
        node={rootNode}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </div>
  );
};

// src/features/editor/components/Canvas/CanvasRenderer.tsx
interface CanvasRendererProps {
  node: BlockNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  node,
  selectedId,
  onSelect,
  depth = 0
}) => {
  const isSelected = node.id === selectedId;
  const styles = useComputedStyles(node);
  
  return (
    <div
      data-element-id={node.id}
      style={styles}
      className={cn(
        'canvas-element',
        isSelected && 'canvas-element--selected'
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
    >
      {node.content && <span>{node.content}</span>}
      {node.children.map(child => (
        <CanvasRenderer
          key={child.id}
          node={child}
          selectedId={selectedId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
};

// src/features/editor/hooks/useComputedStyles.ts
export const useComputedStyles = (node: BlockNode): React.CSSProperties => {
  return useMemo(() => {
    const compiler = new StyleCompiler();
    return compiler.compile(node);
  }, [node.styles]);
};
```

**CSS стили:**

```css
/* src/features/editor/components/Canvas/Canvas.module.css */
.canvas-container {
  flex: 1;
  background: #f5f5f5;
  overflow: auto;
  padding: 20px;
}

.canvas-element {
  position: relative;
  outline: 1px dashed transparent;
  transition: outline 0.2s;
}

.canvas-element:hover {
  outline-color: #3b82f6;
  outline-width: 2px;
}

.canvas-element--selected {
  outline-color: #2563eb !important;
  outline-width: 2px !important;
  outline-style: solid !important;
}

.canvas-element--selected::after {
  content: attr(data-element-name);
  position: absolute;
  top: -20px;
  left: 0;
  background: #2563eb;
  color: white;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 3px;
}
```

**Файлы для создания:**
1. `src/features/editor/components/Canvas/Canvas.tsx`
2. `src/features/editor/components/Canvas/CanvasRenderer.tsx`
3. `src/features/editor/components/Canvas/Canvas.module.css`
4. `src/features/editor/hooks/useComputedStyles.ts`
5. `src/features/editor/utils/StyleCompiler.ts`

---

### Месяц 2: Drag & Drop и Properties Panel

#### Неделя 5-6: Drag & Drop система

**Задачи:**
1. ✅ Интегрировать @dnd-kit
2. ✅ Создать библиотеку элементов (LeftPanel)
3. ✅ Реализовать drag из библиотеки на canvas
4. ✅ Реализовать drag внутри canvas (перемещение элементов)
5. ✅ Добавить визуальные индикаторы drop зон

**Компоненты для создания:**

```typescript
// src/features/editor/components/LeftPanel/LibraryPanel.tsx
export const LibraryPanel: React.FC = () => {
  const categories = [
    {
      name: 'Контейнеры',
      items: [
        { type: 'container', label: 'Div', icon: 'Box', tagName: 'div' },
        { type: 'container', label: 'Section', icon: 'Layout', tagName: 'section' },
      ]
    },
    {
      name: 'Ввод данных',
      items: [
        { type: 'input', label: 'Text Input', icon: 'Type', tagName: 'input' },
        { type: 'input', label: 'Button', icon: 'Square', tagName: 'button' },
      ]
    },
    {
      name: 'Вывод данных',
      items: [
        { type: 'output', label: 'Text', icon: 'Text', tagName: 'p' },
        { type: 'output', label: 'Image', icon: 'Image', tagName: 'img' },
      ]
    },
  ];
  
  return (
    <div className="library-panel">
      <h3>Библиотека элементов</h3>
      {categories.map(category => (
        <CategorySection key={category.name} {...category} />
      ))}
    </div>
  );
};

// src/features/editor/components/LeftPanel/CategorySection.tsx
interface CategorySectionProps {
  name: string;
  items: LibraryItem[];
}

export const CategorySection: React.FC<CategorySectionProps> = ({ name, items }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  return (
    <div className="category-section">
      <button 
        className="category-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {name}
        <ChevronIcon direction={isExpanded ? 'down' : 'right'} />
      </button>
      
      {isExpanded && (
        <div className="category-items">
          {items.map(item => (
            <LibraryItem key={item.label} {...item} />
          ))}
        </div>
      )}
    </div>
  );
};

// src/features/editor/components/LeftPanel/LibraryItem.tsx
export const LibraryItem: React.FC<LibraryItemProps> = ({ type, label, icon, tagName }) => {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `library-${type}-${label}`,
    data: {
      type: 'library-item',
      elementType: type,
      tagName
    }
  });
  
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="library-item"
    >
      <Icon name={icon} />
      <span>{label}</span>
    </div>
  );
};

// src/features/editor/components/Canvas/Canvas.tsx (обновленный)
export const Canvas: React.FC = () => {
  const dispatch = useDispatch();
  const rootNode = useSelector(selectRootNode);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const draggedData = active.data.current;
    const dropTarget = over.data.current;
    
    // Валидация
    const validation = validateDrop(draggedData, dropTarget);
    
    if (!validation.isValid) {
      // Показать меню конфликтов
      dispatch(showConflictMenu(validation.conflicts));
      return;
    }
    
    // Добавить элемент
    if (draggedData.type === 'library-item') {
      dispatch(addNodeToCanvas({
        elementType: draggedData.elementType,
        tagName: draggedData.tagName,
        targetId: dropTarget.id
      }));
    } else {
      // Переместить существующий элемент
      dispatch(moveNode({
        nodeId: draggedData.id,
        targetId: dropTarget.id
      }));
    }
  };
  
  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      collisionDetection={closestCenter}
    >
      <div className="canvas-container">
        <CanvasRenderer node={rootNode} />
      </div>
      <DragOverlay>
        <DragPreview />
      </DragOverlay>
    </DndContext>
  );
};

// src/features/editor/components/Canvas/CanvasRenderer.tsx (обновленный)
export const CanvasRenderer: React.FC<CanvasRendererProps> = ({ node }) => {
  const { setNodeRef: dragRef } = useDraggable({
    id: node.id,
    data: { type: 'canvas-element', ...node }
  });
  
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: node.id,
    data: { type: 'drop-zone', ...node }
  });
  
  const setRefs = useMemo(
    () => combineRefs(dragRef, dropRef),
    [dragRef, dropRef]
  );
  
  return (
    <div
      ref={setRefs}
      className={cn(
        'canvas-element',
        isOver && 'canvas-element--drop-target'
      )}
      style={useComputedStyles(node)}
    >
      {node.children.map(child => (
        <CanvasRenderer key={child.id} node={child} />
      ))}
    </div>
  );
};
```

**Файлы для создания:**
1. `src/features/editor/components/LeftPanel/LibraryPanel.tsx`
2. `src/features/editor/components/LeftPanel/CategorySection.tsx`
3. `src/features/editor/components/LeftPanel/LibraryItem.tsx`
4. `src/features/editor/components/DragPreview/DragPreview.tsx`
5. `src/features/editor/utils/validateDrop.ts`
6. `src/features/editor/utils/combineRefs.ts`

---

#### Неделя 7-8: Properties Panel

**Задачи:**
1. ✅ Создать RightPanel компонент
2. ✅ Реализовать редакторы для разных типов свойств
3. ✅ Добавить специфичные контролы для layout режимов
4. ✅ Интегрировать Monaco Editor для CSS

**Компоненты для создания:**

```typescript
// src/features/editor/components/RightPanel/PropertiesPanel.tsx
export const PropertiesPanel: React.FC = () => {
  const selectedNode = useSelector(selectSelectedNode);
  
  if (!selectedNode) {
    return <EmptyState message="Выберите элемент для редактирования" />;
  }
  
  return (
    <div className="properties-panel">
      <PanelSection title="Основные">
        <PropertyField
          label="ID"
          value={selectedNode.id}
          disabled
        />
        <PropertyField
          label="Тип элемента"
          value={selectedNode.elementType}
          disabled
        />
        <PropertyField
          label="Имя"
          value={selectedNode.metadata.name || ''}
          onChange={(value) => dispatch(updateNodeMetadata({ 
            id: selectedNode.id, 
            name: value 
          }))}
        />
      </PanelSection>
      
      {selectedNode.elementType === 'container' && (
        <PanelSection title="Режим отображения">
          <LayoutModeSelector
            value={selectedNode.layoutMode}
            onChange={(mode) => dispatch(updateLayoutMode({
              id: selectedNode.id,
              mode
            }))}
          />
        </PanelSection>
      )}
      
      <StylesSection node={selectedNode} />
      
      <PanelSection title="Custom CSS" collapsible>
        <CSSEditor
          value={selectedNode.styles.customCSS || ''}
          onChange={(css) => dispatch(updateCustomCSS({
            id: selectedNode.id,
            css
          }))}
        />
      </PanelSection>
    </div>
  );
};

// src/features/editor/components/RightPanel/StylesSection.tsx
export const StylesSection: React.FC<{ node: BlockNode }> = ({ node }) => {
  const layoutMode = node.layoutMode;
  
  return (
    <>
      <PanelSection title="Размеры">
        <DimensionInput
          label="Width"
          value={node.styles.properties.width}
          onChange={(v) => updateStyle('width', v)}
        />
        <DimensionInput
          label="Height"
          value={node.styles.properties.height}
          onChange={(v) => updateStyle('height', v)}
        />
        <DimensionInput
          label="Min Width"
          value={node.styles.properties.minWidth}
          onChange={(v) => updateStyle('minWidth', v)}
        />
        <DimensionInput
          label="Max Width"
          value={node.styles.properties.maxWidth}
          onChange={(v) => updateStyle('maxWidth', v)}
        />
      </PanelSection>
      
      {layoutMode === 'flex' && <FlexboxSection node={node} />}
      {layoutMode === 'grid' && <GridSection node={node} />}
      {layoutMode === 'absolute' && <AbsoluteSection node={node} />}
      
      <SpacingSection node={node} />
      <TypographySection node={node} />
      <BackgroundSection node={node} />
      <BorderSection node={node} />
    </>
  );
};

// src/features/editor/components/RightPanel/FlexboxSection.tsx
export const FlexboxSection: React.FC<{ node: BlockNode }> = ({ node }) => {
  return (
    <PanelSection title="Flexbox">
      <Select
        label="Direction"
        value={node.styles.properties.flexDirection || 'row'}
        options={[
          { value: 'row', label: 'Row' },
          { value: 'column', label: 'Column' },
          { value: 'row-reverse', label: 'Row Reverse' },
          { value: 'column-reverse', label: 'Column Reverse' },
        ]}
        onChange={(v) => updateStyle('flexDirection', v)}
      />
      
      <Select
        label="Justify Content"
        value={node.styles.properties.justifyContent || 'flex-start'}
        options={[
          { value: 'flex-start', label: 'Flex Start' },
          { value: 'center', label: 'Center' },
          { value: 'flex-end', label: 'Flex End' },
          { value: 'space-between', label: 'Space Between' },
          { value: 'space-around', label: 'Space Around' },
        ]}
        onChange={(v) => updateStyle('justifyContent', v)}
      />
      
      <Select
        label="Align Items"
        value={node.styles.properties.alignItems || 'stretch'}
        options={[
          { value: 'flex-start', label: 'Flex Start' },
          { value: 'center', label: 'Center' },
          { value: 'flex-end', label: 'Flex End' },
          { value: 'stretch', label: 'Stretch' },
        ]}
        onChange={(v) => updateStyle('alignItems', v)}
      />
      
      <DimensionInput
        label="Gap"
        value={node.styles.properties.gap}
        onChange={(v) => updateStyle('gap', v)}
      />
    </PanelSection>
  );
};

// src/features/editor/components/RightPanel/CSSEditor.tsx
import Editor from '@monaco-editor/react';

export const CSSEditor: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  return (
    <Editor
      height="300px"
      language="css"
      value={value}
      onChange={(value) => onChange(value || '')}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
      }}
    />
  );
};

// src/shared/components/DimensionInput/DimensionInput.tsx
export const DimensionInput: React.FC<{
  label: string;
  value?: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => {
  const [numValue, unit] = parseDimension(value);
  
  return (
    <div className="dimension-input">
      <label>{label}</label>
      <div className="dimension-input-group">
        <Input
          type="number"
          value={numValue}
          onChange={(v) => onChange(`${v}${unit}`)}
        />
        <Select
          value={unit}
          options={[
            { value: 'px', label: 'px' },
            { value: '%', label: '%' },
            { value: 'em', label: 'em' },
            { value: 'rem', label: 'rem' },
            { value: 'vh', label: 'vh' },
            { value: 'vw', label: 'vw' },
            { value: 'auto', label: 'auto' },
          ]}
          onChange={(u) => onChange(`${numValue}${u}`)}
        />
      </div>
    </div>
  );
};
```

**Файлы для создания:**
1. `src/features/editor/components/RightPanel/PropertiesPanel.tsx`
2. `src/features/editor/components/RightPanel/StylesSection.tsx`
3. `src/features/editor/components/RightPanel/FlexboxSection.tsx`
4. `src/features/editor/components/RightPanel/GridSection.tsx`
5. `src/features/editor/components/RightPanel/AbsoluteSection.tsx`
6. `src/features/editor/components/RightPanel/SpacingSection.tsx`
7. `src/features/editor/components/RightPanel/CSSEditor.tsx`
8. `src/shared/components/DimensionInput/DimensionInput.tsx`

---

### Месяц 3: Layout режимы и Backend интеграция

#### Неделя 9-10: 4 режима Layout

**Задачи:**
1. ✅ Реализовать переключение между режимами
2. ✅ Flexbox - контролы и логика
3. ✅ Grid - контролы и логика
4. ✅ Absolute - контролы и логика
5. ✅ Table - контролы и логика

**Специфичные компоненты:**

```typescript
// src/features/editor/components/RightPanel/GridSection.tsx
export const GridSection: React.FC<{ node: BlockNode }> = ({ node }) => {
  return (
    <PanelSection title="Grid">
      <Input
        label="Template Columns"
        value={node.styles.properties.gridTemplateColumns || ''}
        onChange={(v) => updateStyle('gridTemplateColumns', v)}
        placeholder="e.g., 1fr 1fr 1fr"
      />
      
      <Input
        label="Template Rows"
        value={node.styles.properties.gridTemplateRows || ''}
        onChange={(v) => updateStyle('gridTemplateRows', v)}
        placeholder="e.g., auto 1fr auto"
      />
      
      <DimensionInput
        label="Gap"
        value={node.styles.properties.gap}
        onChange={(v) => updateStyle('gap', v)}
      />
      
      {/* Для child элементов */}
      <Input
        label="Grid Column"
        value={node.styles.properties.gridColumn}
        onChange={(v) => updateStyle('gridColumn', v)}
        placeholder="e.g., 1 / 3"
      />
      
      <Input
        label="Grid Row"
        value={node.styles.properties.gridRow}
        onChange={(v) => updateStyle('gridRow', v)}
        placeholder="e.g., 1 / 2"
      />
    </PanelSection>
  );
};

// src/features/editor/components/RightPanel/AbsoluteSection.tsx
export const AbsoluteSection: React.FC<{ node: BlockNode }> = ({ node }) => {
  return (
    <PanelSection title="Позиционирование">
      <DimensionInput
        label="Top"
        value={node.styles.properties.top}
        onChange={(v) => updateStyle('top', v)}
      />
      <DimensionInput
        label="Right"
        value={node.styles.properties.right}
        onChange={(v) => updateStyle('right', v)}
      />
      <DimensionInput
        label="Bottom"
        value={node.styles.properties.bottom}
        onChange={(v) => updateStyle('bottom', v)}
      />
      <DimensionInput
        label="Left"
        value={node.styles.properties.left}
        onChange={(v) => updateStyle('left', v)}
      />
      <Input
        label="Z-Index"
        type="number"
        value={node.styles.properties.zIndex}
        onChange={(v) => updateStyle('zIndex', v)}
      />
    </PanelSection>
  );
};

// src/features/editor/components/Canvas/LayoutModeRenderer.tsx
export const LayoutModeRenderer: React.FC<{
  node: BlockNode;
  children: React.ReactNode;
}> = ({ node, children }) => {
  const computedStyles = useComputedStyles(node);
  
  // Добавляем display на основе layoutMode
  const layoutStyles: React.CSSProperties = {
    ...computedStyles,
    display: getDisplayValue(node.layoutMode)
  };
  
  return (
    <div style={layoutStyles} data-layout-mode={node.layoutMode}>
      {children}
    </div>
  );
};

function getDisplayValue(mode?: LayoutMode): string {
  switch (mode) {
    case 'flex': return 'flex';
    case 'grid': return 'grid';
    case 'table': return 'table';
    case 'absolute': return 'block'; // С position: relative для детей
    default: return 'block';
  }
}
```

---

#### Неделя 11-12: Backend и API

**Задачи:**
1. ✅ Настроить Express сервер
2. ✅ Настроить TypeORM + PostgreSQL
3. ✅ Создать модели (Page, Block, Group)
4. ✅ Реализовать CRUD API для всех сущностей
5. ✅ Добавить валидацию данных

**Backend структура:**

```typescript
// backend/src/models/Page.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Group } from './Group';

@Entity('pages')
export class Page {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @ManyToOne(() => Group, { nullable: true })
  group: Group;

  @Column('jsonb')
  metadata: {
    title: string;
    description: string;
    keywords: string[];
  };

  @Column('uuid', { nullable: true })
  rootBlockId: string;

  @Column({ default: 'draft' })
  status: 'draft' | 'published' | 'archived';

  @Column({ default: 1 })
  version: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}

// backend/src/models/Block.ts
@Entity('blocks')
export class Block {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string;

  @ManyToOne(() => Group, { nullable: true })
  group: Group;

  @Column({ default: false })
  isReusable: boolean;

  @Column('jsonb')
  structure: any; // BlockNode

  @Column({ nullable: true })
  thumbnail: string;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}

// backend/src/controllers/PageController.ts
export class PageController {
  async getAll(req: Request, res: Response) {
    try {
      const pages = await pageRepository.find({
        relations: ['group']
      });
      res.json(pages);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const page = await pageRepository.findOne({
        where: { id },
        relations: ['group']
      });
      
      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }
      
      res.json(page);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const pageData = req.body;
      
      // Валидация
      const validatedData = PageSchema.parse(pageData);
      
      const page = pageRepository.create(validatedData);
      await pageRepository.save(page);
      
      res.status(201).json(page);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const page = await pageRepository.findOne({ where: { id } });
      
      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }
      
      Object.assign(page, updates);
      page.updatedAt = new Date();
      page.version += 1;
      
      await pageRepository.save(page);
      
      res.json(page);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const result = await pageRepository.delete(id);
      
      if (result.affected === 0) {
        return res.status(404).json({ error: 'Page not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

// backend/src/routes/pages.ts
const router = express.Router();
const pageController = new PageController();

router.get('/', pageController.getAll);
router.get('/:id', pageController.getById);
router.post('/', pageController.create);
router.put('/:id', pageController.update);
router.delete('/:id', pageController.delete);

export default router;

// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createConnection } from 'typeorm';
import pagesRouter from './routes/pages';
import blocksRouter from './routes/blocks';
import groupsRouter from './routes/groups';

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.use('/api/pages', pagesRouter);
app.use('/api/blocks', blocksRouter);
app.use('/api/groups', groupsRouter);

const PORT = process.env.PORT || 5000;

createConnection().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
```

**Файлы для создания:**
1. `backend/src/models/Page.ts`
2. `backend/src/models/Block.ts`
3. `backend/src/models/Group.ts`
4. `backend/src/controllers/PageController.ts`
5. `backend/src/controllers/BlockController.ts`
6. `backend/src/controllers/GroupController.ts`
7. `backend/src/routes/pages.ts`
8. `backend/src/routes/blocks.ts`
9. `backend/src/routes/groups.ts`
10. `backend/src/server.ts`
11. `backend/ormconfig.json`

---

## 3. Интеграция Frontend с Backend

### API клиент

```typescript
// frontend/src/shared/api/client.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// frontend/src/shared/api/pages.ts
export const pagesApi = {
  getAll: () => apiClient.get<Page[]>('/pages'),
  getById: (id: string) => apiClient.get<Page>(`/pages/${id}`),
  create: (data: Partial<Page>) => apiClient.post<Page>('/pages', data),
  update: (id: string, data: Partial<Page>) => 
    apiClient.put<Page>(`/pages/${id}`, data),
  delete: (id: string) => apiClient.delete(`/pages/${id}`),
};

// frontend/src/features/pages/pagesSlice.ts
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { pagesApi } from '@/shared/api/pages';

export const fetchPages = createAsyncThunk(
  'pages/fetchAll',
  async () => {
    const response = await pagesApi.getAll();
    return response.data;
  }
);

export const createPage = createAsyncThunk(
  'pages/create',
  async (data: Partial<Page>) => {
    const response = await pagesApi.create(data);
    return response.data;
  }
);

const pagesSlice = createSlice({
  name: 'pages',
  initialState: {
    items: [] as Page[],
    loading: false,
    error: null as string | null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPages.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPages.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchPages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch pages';
      });
  },
});
```

---

## 4. Тестирование

### Unit тесты

```typescript
// frontend/src/features/editor/utils/__tests__/validateDrop.test.ts
import { describe, it, expect } from 'vitest';
import { validateDrop } from '../validateDrop';

describe('validateDrop', () => {
  it('should allow valid drop', () => {
    const item = createMockNode({ type: 'text' });
    const target = createMockNode({ type: 'container', layoutMode: 'flex' });
    
    const result = validateDrop(item, target, 'inside');
    
    expect(result.isValid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });
  
  it('should detect circular reference', () => {
    const parent = createMockNode({ id: 'parent' });
    const child = createMockNode({ id: 'child' });
    parent.children = [child];
    
    const result = validateDrop(parent, child, 'inside');
    
    expect(result.isValid).toBe(false);
    expect(result.conflicts[0].type).toBe('circular-reference');
  });
});
```

### E2E тесты

```typescript
// e2e/editor.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Editor', () => {
  test('should create new element via drag and drop', async ({ page }) => {
    await page.goto('/editor/new');
    
    // Drag div from library
    await page.dragAndDrop(
      '[data-library-item="div"]',
      '[data-canvas-container]'
    );
    
    // Verify element was added
    const elements = page.locator('[data-canvas-element]');
    await expect(elements).toHaveCount(1);
  });
  
  test('should update element properties', async ({ page }) => {
    await page.goto('/editor/new');
    
    // Add element
    await page.dragAndDrop(
      '[data-library-item="div"]',
      '[data-canvas-container]'
    );
    
    // Select element
    await page.click('[data-canvas-element]');
    
    // Change width
    await page.fill('[data-property="width"]', '500');
    await page.selectOption('[data-property="width-unit"]', 'px');
    
    // Verify
    const element = page.locator('[data-canvas-element]').first();
    await expect(element).toHaveCSS('width', '500px');
  });
});
```

---

## 5. Деплой

### Docker конфигурация

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

EXPOSE 5000
CMD ["node", "dist/server.js"]
```

---

## 6. Приоритеты и контрольные точки

### MVP Checklist (3 месяца)

**Месяц 1:**
- [ ] Базовый UI Kit
- [ ] Роутинг и навигация
- [ ] Canvas с рекурсивным рендерингом
- [ ] Система выбора элементов
- [ ] Базовый Redux store

**Месяц 2:**
- [ ] Drag & Drop из библиотеки
- [ ] Drag & Drop внутри canvas
- [ ] Валидация drop зон
- [ ] Properties Panel
- [ ] Monaco Editor для CSS

**Месяц 3:**
- [ ] 4 режима layout (flex, grid, absolute, table)
- [ ] Backend API (CRUD для всех сущностей)
- [ ] Интеграция Frontend-Backend
- [ ] Сохранение/загрузка страниц и блоков
- [ ] Базовое тестирование

---

## 7. Метрики успеха

### Технические метрики
- Время отклика UI < 100ms
- Загрузка страницы < 3 секунды
- Поддержка деревьев до 1000 элементов
- 80%+ покрытие тестами

### Пользовательские метрики
- Создание простой страницы < 5 минут
- Интуитивность интерфейса (не требует обучения)
- Возможность создать адаптивный макет

---

Это полный план реализации MVP за 3 месяца. Готов создать план внедрения для компании?
