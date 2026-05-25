/**
 * Canonical BlockNode types for the backend.
 *
 * Mirror of frontend/src/shared/types/index.ts.
 * If BlockNode changes on the frontend, update this file to match.
 */

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

export type LayoutMode = 'absolute' | 'flex' | 'grid' | 'table'

export interface CSSProperties {
  position?: string
  top?: string
  right?: string
  bottom?: string
  left?: string
  width?: string
  height?: string
  minWidth?: string
  maxWidth?: string
  minHeight?: string
  maxHeight?: string
  display?: string
  flexDirection?: string
  justifyContent?: string
  alignItems?: string
  gap?: string
  flex?: string
  flexWrap?: string
  gridTemplateColumns?: string
  gridTemplateRows?: string
  gridColumn?: string
  gridRow?: string
  gridGap?: string
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
  backgroundColor?: string
  color?: string
  backgroundImage?: string
  backgroundSize?: string
  backgroundPosition?: string
  backgroundRepeat?: string
  fontSize?: string
  fontWeight?: string
  lineHeight?: string
  textAlign?: string
  fontFamily?: string
  letterSpacing?: string
  border?: string
  borderRadius?: string
  borderTop?: string
  borderRight?: string
  borderBottom?: string
  borderLeft?: string
  opacity?: string
  boxShadow?: string
  transform?: string
  transition?: string
  filter?: string
  backdropFilter?: string
  animation?: string
  animationName?: string
  animationDuration?: string
  animationTimingFunction?: string
  animationDelay?: string
  animationIterationCount?: string
  animationDirection?: string
  animationFillMode?: string
  animationPlayState?: string
  zIndex?: string
  overflow?: string
  overflowX?: string
  overflowY?: string
  cursor?: string
  pointerEvents?: string
  userSelect?: string
  [key: string]: string | undefined
}

export interface StateStyles {
  hover?: Partial<CSSProperties>
  active?: Partial<CSSProperties>
  focus?: Partial<CSSProperties>
  disabled?: Partial<CSSProperties>
}

export interface StateTransition {
  duration: number
  easing: string
  properties: string[]
}

export interface BreakpointDef {
  id: string
  name: string
  width: number
  height?: number
}

export type AnimationTrigger = 'load' | 'scroll-into-view' | 'hover' | 'click' | 'loop'

export type AnimationPreset =
  | 'fade-in'
  | 'fade-out'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'bounce'
  | 'shake'
  | 'pulse'
  | 'spin'
  | 'flip-x'
  | 'flip-y'
  | 'custom'

export interface AnimationKeyframe {
  offset: number // 0–100 (percentage)
  properties: Partial<CSSProperties>
}

export interface Animation {
  id: string
  name: string
  trigger: AnimationTrigger
  preset?: AnimationPreset
  duration: number // ms
  delay: number // ms
  easing: string
  iterationCount: number | 'infinite'
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
  fillMode: 'none' | 'forwards' | 'backwards' | 'both'
  keyframes?: AnimationKeyframe[]
  scrollTrigger?: {
    threshold: number
    once: boolean
    offset: number
  }
}

export interface BlockScript {
  id: string
  name: string
  code: string
  trigger: 'load' | 'click' | 'hover' | 'scroll' | 'custom'
  customTrigger?: string
  enabled: boolean
}

export interface BlockNodeVariation {
  inheritedOverrides?: {
    [nodeId: string]: {
      hidden?: boolean
      styles?: Partial<CSSProperties>
      attributes?: Record<string, string>
      content?: string
    }
  }
  specificChildren?: BlockNode[]
}

export interface BlockNode {
  /** @deprecated legacy field; source of truth is tagName */
  tag?: string
  id: string
  elementType: ElementType
  tagName: string

  styles: {
    properties: CSSProperties
    customCSS?: string
    responsive?: Record<string, Partial<CSSProperties>>
    states?: StateStyles
    stateTransition?: StateTransition
  }

  animations?: Animation[]
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
    customHeadHtml?: string
    customBodyEndHtml?: string
    breakpoints?: BreakpointDef[]
  }

  variations?: {
    [breakpointId: string]: BlockNodeVariation
  }
}
