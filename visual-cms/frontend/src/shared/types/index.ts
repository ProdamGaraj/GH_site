// Base types
export * from './transforms'

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
  | 'html-code'

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
  filter?: string
  backdropFilter?: string
  
  // Animation
  animation?: string
  animationName?: string
  animationDuration?: string
  animationTimingFunction?: string
  animationDelay?: string
  animationIterationCount?: string
  animationDirection?: string
  animationFillMode?: string
  animationPlayState?: string
  
  // Misc
  zIndex?: string
  overflow?: string
  overflowX?: string
  overflowY?: string
  cursor?: string
  pointerEvents?: string
  userSelect?: string
  
  [key: string]: string | undefined
}

// Hover/State Styles
export interface StateStyles {
  hover?: Partial<CSSProperties>
  active?: Partial<CSSProperties>
  focus?: Partial<CSSProperties>
  disabled?: Partial<CSSProperties>
}

// Animation Types
export type AnimationTrigger = 'load' | 'scroll-into-view' | 'hover' | 'click' | 'loop'
export type AnimationPreset = 
  | 'fade-in' | 'fade-out'
  | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right'
  | 'zoom-in' | 'zoom-out'
  | 'bounce' | 'shake' | 'pulse' | 'spin'
  | 'flip-x' | 'flip-y'
  | 'custom'

export interface Animation {
  id: string
  name: string
  trigger: AnimationTrigger
  preset?: AnimationPreset
  // Timing
  duration: number // ms
  delay: number // ms
  easing: string // CSS easing function
  iterationCount: number | 'infinite'
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
  fillMode: 'none' | 'forwards' | 'backwards' | 'both'
  // Custom keyframes (for preset: 'custom')
  keyframes?: AnimationKeyframe[]
  // Scroll trigger options
  scrollTrigger?: {
    threshold: number // 0-1, how much of element should be visible
    once: boolean // trigger only once or every time
    offset: number // px offset from viewport edge
  }
}

export interface AnimationKeyframe {
  offset: number // 0-100 (percentage)
  properties: Partial<CSSProperties>
}

// Script types
export interface PageScript {
  id: string
  name: string
  code: string
  position: 'head' | 'body-start' | 'body-end'
  enabled: boolean
  loadType: 'sync' | 'async' | 'defer'
}

export interface BlockScript {
  id: string
  name: string
  code: string
  trigger: 'load' | 'click' | 'hover' | 'scroll' | 'custom'
  customTrigger?: string // CSS selector or event name
  enabled: boolean
}

// Page settings for editor
export interface EditorPageSettings {
  name: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  metaTitle: string
  metaDescription: string
  keywords: string
  ogImage: string
  scripts?: PageScript[]
  globalCSS?: string
}

// Responsive breakpoints
export type Breakpoint = 'desktop' | 'tablet' | 'mobile' | string

// Browser configuration
export interface Browser {
  id: string
  name: string
  viewportHeightOffset: number // Высота панелей браузера + UI (в пикселях)
  icon?: string
  isDefault?: boolean
}

export interface CustomBreakpoint {
  id: string
  name: string
  width: number
  height?: number
  browserId?: string // ID выбранного браузера для этого breakpoint
  icon?: 'monitor' | 'tablet' | 'smartphone' | 'laptop' | 'watch'
  color?: string // Цвет выделения для viewport-специфичных элементов
}

export interface StandardMonitor {
  id: string
  name: string
  width: number
  height: number
  icon?: string
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
  /** @deprecated legacy-поле; источник истины — tagName. UI читает через `tag || 'div'`. */
  tag?: string
  id: string
  elementType: ElementType
  tagName: string
  
  styles: {
    properties: CSSProperties
    customCSS?: string
    // Responsive styles for different breakpoints (key is breakpoint id)
    responsive?: Record<string, Partial<CSSProperties>>
    // State styles (hover, active, focus, disabled)
    states?: StateStyles
    // Transition for state changes
    stateTransition?: {
      duration: number // ms
      easing: string
      properties: string[] // which properties to transition, or ['all']
    }
  }
  
  // Animations
  animations?: Animation[]
  
  // Scripts attached to this element
  scripts?: BlockScript[]
  
  layoutMode?: LayoutMode
  children: BlockNode[]
  blockReference?: string
  
  attributes: Record<string, string>
  content?: string
  
  metadata: {
    locked?: boolean
    hidden?: boolean
    name?: string
    linkedBlockId?: string
    /** Исходный tagName блока до превращения его в ссылку (tagName='a'); нужен для отката */
    originalTagName?: string
    /** Узел-обёртка <a>, созданная редактором вокруг void-элемента (img, input…); разворачивается при выключении ссылки */
    isLinkWrapper?: boolean
    /** Raw HTML to inject into <head> (scripts, styles, etc.) — only used on root node */
    customHeadHtml?: string
    /** Raw HTML to inject before </body> (scripts, etc.) — only used on root node */
    customBodyEndHtml?: string
    /** Breakpoint definitions for responsive CSS generation — only used on root node */
    breakpoints?: Array<{ id: string; name: string; width: number; height?: number }>
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
  siteId?: string | null
  site?: Site | null
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
  // Page-level scripts
  scripts?: PageScript[]
  // Global CSS for this page
  globalCSS?: string
  createdAt: string
  updatedAt: string
  status: 'draft' | 'published' | 'archived'
  version: number
}

// Site
export interface NavigationItem {
  id: string
  label: string
  pageId?: string
  url?: string
  openInNewTab?: boolean
  children?: NavigationItem[]
}

export interface SiteSettings {
  navigation?: NavigationItem[]
  defaultTitle?: string
  defaultDescription?: string
  defaultKeywords?: string[]
  ogImage?: string
  favicon?: string
  siteName?: string
  logo?: string
  googleAnalyticsId?: string
  googleTagManagerId?: string
  metaPixelId?: string
  yandexMetrikaId?: string
  customHeadHtml?: string
  customBodyEndHtml?: string
  companyName?: string
  phone?: string
  email?: string
  address?: string
  primaryFont?: string
  secondaryFont?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  defaultLanguage?: string
}

export interface Site {
  id: string
  name: string
  slug: string
  description?: string
  routingMode: 'subdomain' | 'path-prefix' | 'custom-domain'
  hostname?: string
  settings: SiteSettings
  status: 'draft' | 'active' | 'archived'
  isDefault: boolean
  homepageId?: string
  pageCount?: number
  createdAt: string
  updatedAt: string
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
  // Template functionality
  isTemplate?: boolean
  templateCategory?: import('./template').TemplateCategory
  detectedFields?: import('./template').DetectedField[]
  templateSettings?: import('./template').TemplateSettings
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

// Page Version
export interface PageVersion {
  id: string
  pageId: string
  version: number
  structure?: any
  metadata?: {
    title: string
    description: string
    keywords: string[]
    ogImage?: string
  }
  name?: string
  slug?: string
  status: 'draft' | 'published' | 'archived'
  source: 'manual' | 'auto' | 'deploy'
  label?: string
  createdAt: string
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

