// Base types

export type LayoutMode = 'absolute' | 'flex' | 'grid' | 'table'

export type ElementType = 
  | 'container'
  | 'text'
  | 'image'
  | 'input'
  | 'button'
  | 'link'
  | 'video'
  | 'block-reference'

export type BlockType = 
  | 'container'
  | 'input'
  | 'output'
  | 'static'
  | 'composite'

// CSS Properties
export interface CSSProperties {
  // Positioning
  position?: string
  top?: string
  right?: string
  bottom?: string
  left?: string
  
  // Dimensions
  width?: string
  height?: string
  minWidth?: string
  maxWidth?: string
  minHeight?: string
  maxHeight?: string
  
  // Display
  display?: string
  
  // Flexbox
  flexDirection?: string
  justifyContent?: string
  alignItems?: string
  gap?: string
  flex?: string
  flexWrap?: string
  
  // Grid
  gridTemplateColumns?: string
  gridTemplateRows?: string
  gridColumn?: string
  gridRow?: string
  gridGap?: string
  
  // Spacing
  margin?: string
  marginTop?: string
  marginRight?: string
  marginBottom?: string
  marginLeft?: string
  padding?: string
  paddingTop?: string
  paddingRight?: string
  paddingBottom?: string
  paddingLeft?: string
  
  // Colors & Backgrounds
  backgroundColor?: string
  color?: string
  backgroundImage?: string
  backgroundSize?: string
  backgroundPosition?: string
  backgroundRepeat?: string
  
  // Typography
  fontSize?: string
  fontWeight?: string
  lineHeight?: string
  textAlign?: string
  fontFamily?: string
  letterSpacing?: string
  
  // Borders
  border?: string
  borderRadius?: string
  borderTop?: string
  borderRight?: string
  borderBottom?: string
  borderLeft?: string
  
  // Effects
  opacity?: string
  boxShadow?: string
  transform?: string
  transition?: string
  
  // Misc
  zIndex?: string
  overflow?: string
  overflowX?: string
  overflowY?: string
  cursor?: string
  
  [key: string]: string | undefined
}

// Responsive breakpoints
export type Breakpoint = 'desktop' | 'tablet' | 'mobile' | string

export interface CustomBreakpoint {
  id: string
  name: string
  width: number
  height?: number
  icon?: 'monitor' | 'tablet' | 'smartphone' | 'laptop' | 'watch'
  color?: string // Цвет выделения для viewport-специфичных элементов
}

// Variation for responsive breakpoints
export interface BlockNodeVariation {
  // Переопределения для унаследованных элементов
  inheritedOverrides?: {
    [nodeId: string]: {
      hidden?: boolean  // Скрыть унаследованный элемент
      styles?: Partial<CSSProperties>
      attributes?: Record<string, string>
      content?: string
    }
  }
  
  // Специфичные дочерние элементы (только для этого брейкпоинта)
  specificChildren?: BlockNode[]
}

// Block Node structure
export interface BlockNode {
  id: string
  elementType: ElementType
  tagName: string
  
  styles: {
    properties: CSSProperties
    customCSS?: string
    // Responsive styles for different breakpoints (key is breakpoint id)
    responsive?: Record<string, Partial<CSSProperties>>
  }
  
  layoutMode?: LayoutMode
  children: BlockNode[]
  blockReference?: string
  
  attributes: Record<string, string>
  content?: string
  
  metadata: {
    locked?: boolean
    hidden?: boolean
    name?: string
  }
  
  // Вариации для разных брейкпоинтов (независимые DOM деревья)
  variations?: {
    [breakpointId: string]: BlockNodeVariation
  }
}

// Page
export interface Page {
  id: string
  name: string
  slug: string
  groupId: string | null
  metadata: {
    title: string
    description: string
    keywords: string[]
    ogImage?: string
  }
  rootBlockId: string
  rootBlock?: BlockNode
  structure: BlockNode  // Added for compatibility with API
  createdAt: string
  updatedAt: string
  status: 'draft' | 'published' | 'archived'
  version: number
}

// Block
export interface Block {
  id: string
  name: string
  type: BlockType
  groupId: string | null
  isReusable: boolean
  structure: BlockNode
  thumbnail?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

// Group
export interface Group {
  id: string
  name: string
  type: 'pages' | 'blocks'
  parentId?: string
  order: number
  createdAt: string
  updatedAt: string
}

// Library Items
export interface LibraryItem {
  type: ElementType
  label: string
  icon: string
  tagName: string
  defaultProps?: Partial<BlockNode>
}

export interface LibraryCategory {
  name: string
  items: LibraryItem[]
}

// Drag & Drop
export interface DragItem {
  type: 'library-item' | 'canvas-element'
  elementType?: ElementType
  tagName?: string
  label?: string
  id?: string
  node?: BlockNode
}

export interface DropValidation {
  isValid: boolean
  conflicts: Conflict[]
}

export interface Conflict {
  type: 'layout-mismatch' | 'nesting-depth' | 'circular-reference' | 'invalid-parent'
  message: string
  suggestions: ConflictResolution[]
}

export interface ConflictResolution {
  action: 'wrap' | 'change-layout' | 'move-to-sibling' | 'cancel'
  label: string
  description: string
}
