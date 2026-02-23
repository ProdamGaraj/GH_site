/**
 * Сервис генерации CSS для hover, анимаций и других динамических стилей
 */

interface CSSProperties {
  [key: string]: string | undefined
}

interface StateStyles {
  hover?: CSSProperties
  active?: CSSProperties
  focus?: CSSProperties
  disabled?: CSSProperties
}

interface StateTransition {
  duration: number
  easing: string
  properties: string[]
}

interface AnimationKeyframe {
  offset: number
  properties: CSSProperties
}

interface Animation {
  id: string
  preset?: string
  trigger: 'load' | 'scroll-into-view' | 'click' | 'loop'
  duration: number
  delay: number
  easing: string
  iterationCount: number | 'infinite'
  keyframes?: AnimationKeyframe[]
}

interface BlockScript {
  id: string
  name: string
  code: string
  trigger: 'load' | 'click' | 'hover' | 'scroll' | 'custom'
  enabled: boolean
}

interface BlockNodeVariation {
  inheritedOverrides?: {
    [nodeId: string]: {
      hidden?: boolean
      styles?: CSSProperties
      attributes?: Record<string, string>
      content?: string
    }
  }
  specificChildren?: BlockNode[]
}

interface BreakpointDef {
  id: string
  name: string
  width: number
  height?: number
}

interface BlockNode {
  id: string
  tagName: string
  children: BlockNode[]
  styles: {
    properties: CSSProperties
    states?: StateStyles
    stateTransition?: StateTransition
  }
  animations?: Animation[]
  scripts?: BlockScript[]
  variations?: {
    [breakpointId: string]: BlockNodeVariation
  }
  metadata?: {
    name?: string
    customHeadHtml?: string
    customBodyEndHtml?: string
    breakpoints?: BreakpointDef[]
  }
}

// Animation preset keyframes
const ANIMATION_KEYFRAMES: Record<string, string> = {
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
}

// Convert camelCase to kebab-case
const toKebabCase = (str: string): string =>
  str.replace(/([A-Z])/g, '-$1').toLowerCase()

// Convert CSS properties object to string with !important for state styles
const cssPropertiesToString = (props: CSSProperties, important: boolean = false): string => {
  return Object.entries(props)
    .filter(([_, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${toKebabCase(key)}: ${value}${important ? ' !important' : ''}`)
    .join('; ')
}

// Generate unique animation name
const generateAnimationName = (nodeId: string, animationId: string): string => {
  return `anim-${nodeId.replace(/[^a-zA-Z0-9]/g, '')}-${animationId.replace(/[^a-zA-Z0-9]/g, '')}`
}

export class StyleGenerator {
  /**
   * Генерирует CSS для hover/active/focus/disabled состояний
   */
  generateStateStyles(nodeId: string, states?: StateStyles, transition?: StateTransition): string {
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

  /**
   * Генерирует CSS keyframes и стили анимации
   */
  generateAnimationStyles(nodeId: string, animations?: Animation[]): { keyframes: string; styles: string } {
    if (!animations || animations.length === 0) {
      return { keyframes: '', styles: '' }
    }

    const selector = `[data-element-id="${nodeId}"]`
    let keyframes = ''
    let styles = ''

    // Process load and loop animations
    const cssAnimations = animations.filter(a =>
      a.trigger === 'load' || a.trigger === 'loop'
    )

    if (cssAnimations.length > 0) {
      const animationValues: string[] = []

      cssAnimations.forEach(animation => {
        const animName = generateAnimationName(nodeId, animation.id)

        // Get keyframes
        let kf = ''
        if (animation.preset && animation.preset !== 'custom' && ANIMATION_KEYFRAMES[animation.preset]) {
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
        const iterCount = animation.trigger === 'loop' ? 'infinite' : animation.iterationCount || 1
        const animValue = `${animName} ${animation.duration}ms ${animation.easing} ${animation.delay}ms ${iterCount}`
        animationValues.push(animValue)
      })

      if (animationValues.length > 0) {
        styles += `${selector} { animation: ${animationValues.join(', ')}; }\n`
      }
    }

    return { keyframes, styles }
  }

  /**
   * Генерирует JavaScript для scroll/click анимаций
   */
  generateAnimationScript(nodeId: string, animations?: Animation[]): string {
    if (!animations || animations.length === 0) return ''

    let script = ''

    // Scroll-into-view animations
    const scrollAnims = animations.filter(a => a.trigger === 'scroll-into-view')
    if (scrollAnims.length > 0) {
      scrollAnims.forEach(anim => {
        const animName = generateAnimationName(nodeId, anim.id)
        const iterCount = anim.iterationCount || 1
        script += `
(function() {
  const el = document.querySelector('[data-element-id="${nodeId}"]');
  if (!el) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        el.style.animation = '${animName} ${anim.duration}ms ${anim.easing} ${anim.delay}ms ${iterCount}';
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.1 });
  observer.observe(el);
})();
`
      })
    }

    // Click animations
    const clickAnims = animations.filter(a => a.trigger === 'click')
    if (clickAnims.length > 0) {
      clickAnims.forEach(anim => {
        const animName = generateAnimationName(nodeId, anim.id)
        const iterCount = anim.iterationCount || 1
        script += `
(function() {
  const el = document.querySelector('[data-element-id="${nodeId}"]');
  if (!el) return;
  el.addEventListener('click', function() {
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = '${animName} ${anim.duration}ms ${anim.easing} 0ms ${iterCount}';
  });
})();
`
      })
    }

    return script
  }

  /**
   * Генерирует все стили для дерева узлов
   */
  generateNodeTreeStyles(node: BlockNode): { css: string; keyframes: string; scripts: string } {
    let css = ''
    let keyframes = ''
    let scripts = ''

    // Generate state styles (hover, etc.)
    if (node.styles?.states) {
      css += this.generateStateStyles(node.id, node.styles.states, node.styles.stateTransition)
    }

    // Generate animation styles
    if (node.animations && node.animations.length > 0) {
      const animStyles = this.generateAnimationStyles(node.id, node.animations)
      keyframes += animStyles.keyframes
      css += animStyles.styles

      // Generate animation scripts for scroll/click triggers
      const animScript = this.generateAnimationScript(node.id, node.animations)
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
        if (animation.preset && animation.preset !== 'custom' && ANIMATION_KEYFRAMES[animation.preset]) {
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

    // Generate element scripts
    if (node.scripts && node.scripts.length > 0) {
      node.scripts.forEach(script => {
        if (!script.enabled) return

        let scriptCode = ''
        switch (script.trigger) {
          case 'load':
            scriptCode = `(function() {
  const element = document.querySelector('[data-element-id="${node.id}"]');
  if (!element) return;
  ${script.code}
})();`
            break
          case 'click':
            scriptCode = `(function() {
  const element = document.querySelector('[data-element-id="${node.id}"]');
  if (!element) return;
  element.addEventListener('click', function(e) {
    ${script.code}
  });
})();`
            break
          case 'hover':
            scriptCode = `(function() {
  const element = document.querySelector('[data-element-id="${node.id}"]');
  if (!element) return;
  element.addEventListener('mouseenter', function(e) {
    ${script.code}
  });
})();`
            break
          case 'scroll':
            scriptCode = `(function() {
  const element = document.querySelector('[data-element-id="${node.id}"]');
  if (!element) return;
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        ${script.code}
        observer.disconnect();
      }
    });
  });
  observer.observe(element);
})();`
            break
          case 'custom':
            scriptCode = `(function() {
  const element = document.querySelector('[data-element-id="${node.id}"]');
  if (!element) return;
  ${script.code}
})();`
            break
        }
        scripts += scriptCode + '\n'
      })
    }

    // Process children recursively
    for (const child of node.children || []) {
      const childResult = this.generateNodeTreeStyles(child)
      css += childResult.css
      keyframes += childResult.keyframes
      scripts += childResult.scripts
    }

    return { css, keyframes, scripts }
  }

  /**
   * Генерирует responsive CSS (@media queries) из variations дерева узлов.
   * Обходит дерево рекурсивно, собирает все inheritedOverrides и specificChildren,
   * группирует по breakpoint и генерирует @media (max-width) блоки.
   */
  generateResponsiveCSS(rootNode: BlockNode): string {
    // Извлекаем breakpoints из metadata root-узла, с fallback на стандартные
    let breakpoints: BreakpointDef[] = rootNode.metadata?.breakpoints || []
    if (breakpoints.length === 0) {
      // Fallback: default breakpoints matching frontend editorSlice defaults
      breakpoints = [
        { id: 'desktop-fhd', name: 'Desktop FHD', width: 1920 },
        { id: 'desktop-hd', name: 'Desktop HD', width: 1440 },
        { id: 'tablet', name: 'Tablet', width: 768 },
        { id: 'mobile', name: 'Mobile', width: 375 },
      ]
    }

    // Сортируем breakpoints от большего к меньшему для правильного каскада CSS
    const sortedBreakpoints = [...breakpoints].sort((a, b) => b.width - a.width)

    // Собираем CSS-правила для каждого breakpoint
    const breakpointRules: Record<string, string[]> = {}
    for (const bp of sortedBreakpoints) {
      breakpointRules[bp.id] = []
    }

    // Рекурсивно собираем overrides из всего дерева
    this.collectResponsiveRules(rootNode, breakpointRules)

    // Генерируем итоговый CSS
    let css = '\n    /* Responsive styles */\n'
    for (const bp of sortedBreakpoints) {
      const rules = breakpointRules[bp.id]
      if (!rules || rules.length === 0) continue
      css += `    @media (max-width: ${bp.width}px) {\n`
      css += rules.map(r => `      ${r}`).join('\n')
      css += '\n    }\n'
    }

    return css
  }

  /**
   * Рекурсивно собирает CSS-правила из variations для каждого breakpoint
   */
  private collectResponsiveRules(
    node: BlockNode,
    breakpointRules: Record<string, string[]>
  ): void {
    if (node.variations) {
      for (const [bpId, variation] of Object.entries(node.variations)) {
        if (!breakpointRules[bpId]) continue

        // Обрабатываем inheritedOverrides
        if (variation.inheritedOverrides) {
          for (const [nodeId, override] of Object.entries(variation.inheritedOverrides)) {
            const selector = `[data-element-id="${nodeId}"]`
            if (override.hidden) {
              breakpointRules[bpId].push(`${selector} { display: none !important; }`)
            } else if (override.styles && Object.keys(override.styles).length > 0) {
              const propsStr = cssPropertiesToString(override.styles, true)
              if (propsStr) {
                breakpointRules[bpId].push(`${selector} { ${propsStr} }`)
              }
            }
          }
        }

        // Обрабатываем specificChildren — показываем их только в этом breakpoint
        if (variation.specificChildren) {
          for (const child of variation.specificChildren) {
            const selector = `[data-element-id="${child.id}"]`
            breakpointRules[bpId].push(`${selector} { display: ${child.styles?.properties?.display || 'block'} !important; }`)
            // Рекурсивно обходим specificChildren (у них тоже могут быть variations)
            this.collectResponsiveRules(child, breakpointRules)
          }
        }
      }
    }

    // Рекурсивно обрабатываем children
    for (const child of node.children || []) {
      this.collectResponsiveRules(child, breakpointRules)
    }
  }

  /**
   * Собирает все ID specificChildren из всех breakpoints, рекурсивно
   */
  collectSpecificChildrenIds(node: BlockNode): Set<string> {
    const ids = new Set<string>()
    this.collectSpecificIdsRecursive(node, ids)
    return ids
  }

  private collectSpecificIdsRecursive(node: BlockNode, ids: Set<string>): void {
    if (node.variations) {
      for (const variation of Object.values(node.variations)) {
        if (variation.specificChildren) {
          for (const child of variation.specificChildren) {
            this.addAllIds(child, ids)
          }
        }
      }
    }
    for (const child of node.children || []) {
      this.collectSpecificIdsRecursive(child, ids)
    }
  }

  private addAllIds(node: BlockNode, ids: Set<string>): void {
    ids.add(node.id)
    for (const child of node.children || []) {
      this.addAllIds(child, ids)
    }
  }

  /**
   * Генерирует CSS для форм и OUTPUT bindings
   */
  generateFormStyles(): string {
    return `
/* Visual CMS Form Styles */

/* Базовые стили формы */
form {
  width: 100%;
}

/* Поля ввода */
input[type="text"],
input[type="email"],
input[type="password"],
input[type="tel"],
input[type="number"],
input[type="url"],
textarea,
select {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: #fff;
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Состояния ошибки */
input.border-red-500,
textarea.border-red-500,
select.border-red-500 {
  border-color: #ef4444;
}

input.border-red-500:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

/* Сообщения об ошибках */
.validation-error {
  color: #ef4444;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

/* Кнопки */
button[type="submit"],
.submit-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  border-radius: 0.5rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  background: #3b82f6;
  color: #fff;
}

button[type="submit"]:hover,
.submit-button:hover {
  background: #2563eb;
}

button[type="submit"]:disabled,
.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Состояние загрузки */
button.loading {
  background: #6b7280;
  cursor: wait;
}

button.loading .spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid #fff;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;
}

/* Состояние успеха */
button.success {
  background: #10b981;
}

/* Состояние ошибки */
button.error {
  background: #ef4444;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Лейблы */
label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
}

/* Группы полей */
.form-group {
  margin-bottom: 1rem;
}

/* Плейсхолдеры */
::placeholder {
  color: #9ca3af;
}
`
  }
}

export const styleGenerator = new StyleGenerator()
