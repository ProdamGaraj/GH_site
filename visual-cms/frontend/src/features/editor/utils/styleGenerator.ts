import type { BlockNode, Animation, AnimationPreset, CSSProperties, StateStyles, CustomBreakpoint } from '@/shared/types'

// Animation preset keyframes
const ANIMATION_KEYFRAMES: Record<AnimationPreset, string> = {
  'fade-in': `
    from { opacity: 0; }
    to { opacity: 1; }
  `,
  'fade-out': `
    from { opacity: 1; }
    to { opacity: 0; }
  `,
  'slide-up': `
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  `,
  'slide-down': `
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  `,
  'slide-left': `
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  `,
  'slide-right': `
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
  `,
  'zoom-in': `
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1); }
  `,
  'zoom-out': `
    from { opacity: 0; transform: scale(1.2); }
    to { opacity: 1; transform: scale(1); }
  `,
  'bounce': `
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  `,
  'shake': `
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  `,
  'pulse': `
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  `,
  'spin': `
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  `,
  'flip-x': `
    from { transform: perspective(400px) rotateX(90deg); opacity: 0; }
    to { transform: perspective(400px) rotateX(0); opacity: 1; }
  `,
  'flip-y': `
    from { transform: perspective(400px) rotateY(90deg); opacity: 0; }
    to { transform: perspective(400px) rotateY(0); opacity: 1; }
  `,
  'custom': '',
}

// Convert camelCase to kebab-case
const toKebabCase = (str: string): string => 
  str.replace(/([A-Z])/g, '-$1').toLowerCase()

// Convert CSS properties object to string
const cssPropertiesToString = (props: Partial<CSSProperties>, important: boolean = false): string => {
  return Object.entries(props)
    .filter(([_, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${toKebabCase(key)}: ${value}${important ? ' !important' : ''}`)
    .join('; ')
}

// Generate unique animation name
const generateAnimationName = (nodeId: string, animationId: string): string => {
  return `anim-${nodeId.replace(/[^a-zA-Z0-9]/g, '')}-${animationId.replace(/[^a-zA-Z0-9]/g, '')}`
}

// Generate CSS for a single node's state styles (hover, active, etc.)
export const generateStateStyles = (nodeId: string, states?: StateStyles, transition?: { duration: number; easing: string; properties: string[] }): string => {
  if (!states) return ''
  
  const selector = `[data-element-id="${nodeId}"]`
  let css = ''
  
  // Generate transition property
  if (transition) {
    const transitionProps = transition.properties.join(', ')
    css += `${selector} { transition: ${transitionProps} ${transition.duration}ms ${transition.easing}; }\n`
  }
  
  // Generate state styles with !important to override inline styles
  if (states.hover && Object.keys(states.hover).length > 0) {
    css += `${selector}:hover { ${cssPropertiesToString(states.hover, true)} }\n`
  }
  
  if (states.active && Object.keys(states.active).length > 0) {
    css += `${selector}:active { ${cssPropertiesToString(states.active, true)} }\n`
  }
  
  if (states.focus && Object.keys(states.focus).length > 0) {
    css += `${selector}:focus { ${cssPropertiesToString(states.focus, true)} }\n`
  }
  
  if (states.disabled && Object.keys(states.disabled).length > 0) {
    css += `${selector}:disabled, ${selector}[disabled] { ${cssPropertiesToString(states.disabled, true)} }\n`
  }
  
  return css
}

// Generate CSS keyframes and animation styles for a node
export const generateAnimationStyles = (nodeId: string, animations?: Animation[]): { keyframes: string; styles: string } => {
  if (!animations || animations.length === 0) {
    return { keyframes: '', styles: '' }
  }
  
  const selector = `[data-element-id="${nodeId}"]`
  let keyframes = ''
  let styles = ''
  
  // Process load and loop animations (applied via CSS)
  const cssAnimations = animations.filter(a => 
    a.trigger === 'load' || a.trigger === 'loop'
  )
  
  if (cssAnimations.length > 0) {
    const animationValues: string[] = []
    
    cssAnimations.forEach(animation => {
      const animName = generateAnimationName(nodeId, animation.id)
      
      // Get keyframes
      let kf = ''
      if (animation.preset && animation.preset !== 'custom') {
        kf = ANIMATION_KEYFRAMES[animation.preset]
      } else if (animation.keyframes && animation.keyframes.length > 0) {
        kf = animation.keyframes
          .map(kf => `${kf.offset}% { ${cssPropertiesToString(kf.properties)} }`)
          .join('\n')
      }
      
      if (kf) {
        keyframes += `@keyframes ${animName} {\n${kf}\n}\n`
      }
      
      // Build animation value
      const iterationCount = animation.iterationCount === 'infinite' 
        ? 'infinite' 
        : animation.iterationCount
      
      animationValues.push(
        `${animName} ${animation.duration}ms ${animation.easing} ${animation.delay}ms ${iterationCount} ${animation.direction} ${animation.fillMode}`
      )
    })
    
    if (animationValues.length > 0) {
      styles += `${selector} { animation: ${animationValues.join(', ')}; }\n`
    }
  }
  
  // Process hover-triggered animations
  const hoverAnimations = animations.filter(a => a.trigger === 'hover')
  if (hoverAnimations.length > 0) {
    const hoverAnimValues: string[] = []
    
    hoverAnimations.forEach(animation => {
      const animName = generateAnimationName(nodeId, animation.id) + '-hover'
      
      let kf = ''
      if (animation.preset && animation.preset !== 'custom') {
        kf = ANIMATION_KEYFRAMES[animation.preset]
      } else if (animation.keyframes && animation.keyframes.length > 0) {
        kf = animation.keyframes
          .map(kf => `${kf.offset}% { ${cssPropertiesToString(kf.properties)} }`)
          .join('\n')
      }
      
      if (kf) {
        keyframes += `@keyframes ${animName} {\n${kf}\n}\n`
      }
      
      const iterationCount = animation.iterationCount === 'infinite' 
        ? 'infinite' 
        : animation.iterationCount
      
      hoverAnimValues.push(
        `${animName} ${animation.duration}ms ${animation.easing} ${animation.delay}ms ${iterationCount} ${animation.direction} ${animation.fillMode}`
      )
    })
    
    if (hoverAnimValues.length > 0) {
      styles += `${selector}:hover { animation: ${hoverAnimValues.join(', ')}; }\n`
    }
  }
  
  return { keyframes, styles }
}

// Generate JavaScript for scroll-triggered and click-triggered animations
export const generateAnimationScript = (nodeId: string, animations?: Animation[]): string => {
  if (!animations || animations.length === 0) return ''
  
  const scripts: string[] = []
  
  // Scroll-into-view animations
  const scrollAnimations = animations.filter(a => a.trigger === 'scroll-into-view')
  if (scrollAnimations.length > 0) {
    scrollAnimations.forEach(animation => {
      const animName = generateAnimationName(nodeId, animation.id)
      const threshold = animation.scrollTrigger?.threshold || 0.2
      const once = animation.scrollTrigger?.once !== false
      
      scripts.push(`
(function() {
  const el = document.querySelector('[data-element-id="${nodeId}"]');
  if (!el) return;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        el.style.animation = '${animName} ${animation.duration}ms ${animation.easing} ${animation.delay}ms ${animation.iterationCount === 'infinite' ? 'infinite' : animation.iterationCount} ${animation.direction} ${animation.fillMode}';
        ${once ? 'observer.disconnect();' : ''}
      }${!once ? ` else {
        el.style.animation = 'none';
      }` : ''}
    });
  }, { threshold: ${threshold} });
  
  observer.observe(el);
})();`)
    })
  }
  
  // Click-triggered animations
  const clickAnimations = animations.filter(a => a.trigger === 'click')
  if (clickAnimations.length > 0) {
    clickAnimations.forEach(animation => {
      const animName = generateAnimationName(nodeId, animation.id)
      
      scripts.push(`
(function() {
  const el = document.querySelector('[data-element-id="${nodeId}"]');
  if (!el) return;
  
  el.addEventListener('click', () => {
    el.style.animation = 'none';
    el.offsetHeight; // Trigger reflow
    el.style.animation = '${animName} ${animation.duration}ms ${animation.easing} ${animation.delay}ms ${animation.iterationCount === 'infinite' ? 'infinite' : animation.iterationCount} ${animation.direction} ${animation.fillMode}';
  });
})();`)
    })
  }
  
  return scripts.join('\n')
}

// Generate all CSS for a node tree (recursive)
export const generateNodeTreeCSS = (node: BlockNode): { css: string; keyframes: string; scripts: string } => {
  let css = ''
  let keyframes = ''
  let scripts = ''
  
  // Generate state styles
  if (node.styles.states) {
    css += generateStateStyles(node.id, node.styles.states, node.styles.stateTransition)
  }
  
  // Generate element scripts
  if (node.scripts && node.scripts.length > 0) {
    node.scripts.forEach(script => {
      if (!script.enabled) return
      
      const scriptCode = `
(function() {
  const element = document.querySelector('[data-element-id="${node.id}"]');
  if (!element) return;
  
  ${script.trigger === 'load' ? `
  // Execute on load
  ${script.code}
  ` : script.trigger === 'click' ? `
  // Execute on click
  element.addEventListener('click', function(e) {
    ${script.code}
  });
  ` : script.trigger === 'hover' ? `
  // Execute on hover
  element.addEventListener('mouseenter', function() {
    ${script.code}
  });
  ` : script.trigger === 'scroll' ? `
  // Execute on scroll into view
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        ${script.code}
        observer.disconnect();
      }
    });
  });
  observer.observe(element);
  ` : script.trigger === 'custom' && script.customTrigger ? `
  // Execute on custom trigger
  element.addEventListener('${script.customTrigger}', function(e) {
    ${script.code}
  });
  ` : ''}
})();`
      
      scripts += scriptCode + '\n'
    })
  }
  
  // Generate animation styles
  if (node.animations && node.animations.length > 0) {
    const animStyles = generateAnimationStyles(node.id, node.animations)
    keyframes += animStyles.keyframes
    css += animStyles.styles
    
    // Generate animation scripts for scroll/click triggers
    const animScript = generateAnimationScript(node.id, node.animations)
    if (animScript) {
      scripts += animScript
    }
    
    // Generate keyframes for scroll/click animations too
    const scrollClickAnims = node.animations.filter(a => 
      a.trigger === 'scroll-into-view' || a.trigger === 'click'
    )
    scrollClickAnims.forEach(animation => {
      const animName = generateAnimationName(node.id, animation.id)
      let kf = ''
      if (animation.preset && animation.preset !== 'custom') {
        kf = ANIMATION_KEYFRAMES[animation.preset]
      } else if (animation.keyframes && animation.keyframes.length > 0) {
        kf = animation.keyframes
          .map(kf => `${kf.offset}% { ${cssPropertiesToString(kf.properties)} }`)
          .join('\n')
      }
      if (kf) {
        keyframes += `@keyframes ${animName} {\n${kf}\n}\n`
      }
    })
  }
  
  // Process children recursively
  for (const child of node.children) {
    const childResult = generateNodeTreeCSS(child)
    css += childResult.css
    keyframes += childResult.keyframes
    scripts += childResult.scripts
  }
  
  return { css, keyframes, scripts }
}

// Generate full CSS and scripts for export
export const generateExportStyles = (rootNode: BlockNode, pageScripts?: { code: string; position: string }[]): {
  headCSS: string
  bodyEndScripts: string
  headScripts: string
  bodyStartScripts: string
} => {
  const { css, keyframes, scripts } = generateNodeTreeCSS(rootNode)
  
  // Combine keyframes and CSS
  const headCSS = keyframes + '\n' + css
  
  // Element scripts
  let bodyEndScripts = scripts ? `<script>\n${scripts}\n</script>` : ''
  let headScripts = ''
  let bodyStartScripts = ''
  
  // Page scripts
  if (pageScripts) {
    pageScripts.forEach(script => {
      const scriptTag = `<script>${script.code}</script>`
      switch (script.position) {
        case 'head':
          headScripts += scriptTag + '\n'
          break
        case 'body-start':
          bodyStartScripts += scriptTag + '\n'
          break
        case 'body-end':
        default:
          bodyEndScripts += scriptTag + '\n'
          break
      }
    })
  }
  
  return { headCSS, bodyEndScripts, headScripts, bodyStartScripts }
}

// =====================
// Responsive CSS Generation
// =====================

/**
 * Генерирует responsive CSS (@media queries) из variations дерева узлов.
 * Используется в Preview для отображения адаптивной вёрстки.
 */
export const generateResponsiveCSS = (
  rootNode: BlockNode,
  breakpoints: CustomBreakpoint[]
): string => {
  if (breakpoints.length === 0) return ''

  // Сортируем от большего к меньшему для правильного каскадирования
  const sortedBreakpoints = [...breakpoints].sort((a, b) => b.width - a.width)

  const breakpointRules: Record<string, string[]> = {}
  for (const bp of sortedBreakpoints) {
    breakpointRules[bp.id] = []
  }

  collectResponsiveRules(rootNode, breakpointRules)

  let css = ''
  for (const bp of sortedBreakpoints) {
    const rules = breakpointRules[bp.id]
    if (!rules || rules.length === 0) continue
    css += `@media (max-width: ${bp.width}px) {\n`
    css += rules.map(r => `  ${r}`).join('\n')
    css += '\n}\n'
  }

  return css
}

function collectResponsiveRules(
  node: BlockNode,
  breakpointRules: Record<string, string[]>
): void {
  if (node.variations) {
    for (const [bpId, variation] of Object.entries(node.variations)) {
      if (!breakpointRules[bpId]) continue

      if (variation.inheritedOverrides) {
        for (const [nodeId, override] of Object.entries(variation.inheritedOverrides)) {
          const selector = `[data-element-id="${nodeId}"]`
          if (override.hidden) {
            breakpointRules[bpId].push(`${selector} { display: none !important; }`)
          } else if (override.styles && Object.keys(override.styles).length > 0) {
            const propsStr = Object.entries(override.styles)
              .filter(([_, value]) => value !== undefined && value !== '')
              .map(([key, value]) => `${toKebabCase(key)}: ${value} !important`)
              .join('; ')
            if (propsStr) {
              breakpointRules[bpId].push(`${selector} { ${propsStr} }`)
            }
          }
        }
      }

      if (variation.specificChildren) {
        for (const child of variation.specificChildren) {
          const selector = `[data-element-id="${child.id}"]`
          breakpointRules[bpId].push(`${selector} { display: ${child.styles?.properties?.display || 'block'} !important; }`)
          collectResponsiveRules(child, breakpointRules)
        }
      }
    }
  }

  for (const child of node.children || []) {
    collectResponsiveRules(child, breakpointRules)
  }
}

/**
 * Собирает все ID specificChildren из всех breakpoints, рекурсивно
 */
export const collectSpecificChildrenIds = (node: BlockNode): Set<string> => {
  const ids = new Set<string>()
  collectSpecificIdsRecursive(node, ids)
  return ids
}

function collectSpecificIdsRecursive(node: BlockNode, ids: Set<string>): void {
  if (node.variations) {
    for (const variation of Object.values(node.variations)) {
      if (variation.specificChildren) {
        for (const child of variation.specificChildren) {
          addAllIds(child, ids)
        }
      }
    }
  }
  for (const child of node.children || []) {
    collectSpecificIdsRecursive(child, ids)
  }
}

function addAllIds(node: BlockNode, ids: Set<string>): void {
  ids.add(node.id)
  for (const child of node.children || []) {
    addAllIds(child, ids)
  }
}

/**
 * Генерирует HTML из BlockNode, включая specificChildren из variations.
 * Рендерит базовое дерево + viewport-specific элементы (они скрыты через CSS).
 */
export const generateFullHTML = (node: BlockNode): string => {
  const styleString = Object.entries(node.styles.properties)
    .filter(([_, value]) => value)
    .map(([key, value]) => {
      const cssKey = toKebabCase(key)
      return `${cssKey}: ${value}`
    })
    .join('; ')

  const attrs = Object.entries(node.attributes || {})
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')

  const dataAttr = `data-element-id="${node.id}"`

  // Рендерим базовые дочерние элементы
  const childrenHTML = (node.children || []).map(child => generateFullHTML(child)).join('')

  // Рендерим specificChildren из всех variations
  let specificHTML = ''
  if (node.variations) {
    for (const variation of Object.values(node.variations)) {
      if (variation.specificChildren) {
        specificHTML += variation.specificChildren.map(child => generateFullHTML(child)).join('')
      }
    }
  }

  const content = node.content || ''

  return `<${node.tagName} style="${styleString}" ${dataAttr} ${attrs}>${content}${childrenHTML}${specificHTML}</${node.tagName}>`
}
