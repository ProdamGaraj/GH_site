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

    // Process children recursively
    for (const child of node.children || []) {
      const childResult = this.generateNodeTreeStyles(child)
      css += childResult.css
      keyframes += childResult.keyframes
      scripts += childResult.scripts
    }

    return { css, keyframes, scripts }
  }
}

export const styleGenerator = new StyleGenerator()
