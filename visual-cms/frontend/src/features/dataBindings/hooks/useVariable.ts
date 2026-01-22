import { useState, useEffect, useCallback } from 'react'
import { variablesService } from '../services/VariablesService'
import type { VariableScope } from '../components/VariablesEditor'

/**
 * Hook for reading and writing a single variable
 * 
 * @example
 * const [count, setCount] = useVariable('page', 'counter')
 * // or with path
 * const [name, setName] = useVariable('$page.userName')
 */
export function useVariable<T = unknown>(
  scopeOrPath: VariableScope | string,
  name?: string
): [T | undefined, (value: T) => void, { loading: boolean }] {
  
  const [value, setValue] = useState<T | undefined>(() => {
    if (name) {
      return variablesService.get<T>(scopeOrPath as VariableScope, name)
    }
    return variablesService.getByPath<T>(scopeOrPath)
  })
  const [loading, setLoading] = useState(false)

  // Subscribe to changes
  useEffect(() => {
    let unsubscribe: () => void

    if (name) {
      // Get initial value
      setValue(variablesService.get<T>(scopeOrPath as VariableScope, name))
      
      unsubscribe = variablesService.subscribe(
        scopeOrPath as VariableScope, 
        name, 
        (newValue) => setValue(newValue as T)
      )
    } else {
      // Path-based
      setValue(variablesService.getByPath<T>(scopeOrPath))
      
      unsubscribe = variablesService.subscribeByPath(
        scopeOrPath, 
        (newValue) => setValue(newValue as T)
      )
    }

    return unsubscribe
  }, [scopeOrPath, name])

  // Setter function
  const setVariable = useCallback((newValue: T) => {
    setLoading(true)
    try {
      if (name) {
        variablesService.set(scopeOrPath as VariableScope, name, newValue)
      } else {
        variablesService.setByPath(scopeOrPath, newValue)
      }
    } finally {
      setLoading(false)
    }
  }, [scopeOrPath, name])

  return [value, setVariable, { loading }]
}

/**
 * Hook for reading all variables of a specific scope
 * 
 * @example
 * const pageVars = useVariables('page')
 * console.log(pageVars.counter, pageVars.selectedId)
 */
export function useVariables(scope: VariableScope): Record<string, unknown> {
  const [variables, setVariables] = useState<Record<string, unknown>>(() => 
    variablesService.getAllForScope(scope)
  )

  useEffect(() => {
    // Re-fetch when scope changes
    setVariables(variablesService.getAllForScope(scope))
    
    // Note: This is a simplified implementation
    // For full reactivity, we'd need to subscribe to all variables in scope
    const interval = setInterval(() => {
      setVariables(variablesService.getAllForScope(scope))
    }, 100)

    return () => clearInterval(interval)
  }, [scope])

  return variables
}

/**
 * Hook for boolean toggle variable
 * 
 * @example
 * const [isOpen, toggle, setIsOpen] = useToggle('page', 'modalOpen')
 */
export function useToggle(
  scope: VariableScope, 
  name: string
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useVariable<boolean>(scope, name)

  const toggle = useCallback(() => {
    variablesService.toggle(scope, name)
  }, [scope, name])

  return [value ?? false, toggle, setValue]
}

/**
 * Hook for numeric counter variable
 * 
 * @example
 * const [count, increment, decrement, reset] = useCounter('page', 'itemCount')
 */
export function useCounter(
  scope: VariableScope, 
  name: string,
  options?: { min?: number; max?: number; step?: number }
): [number, () => void, () => void, (value: number) => void] {
  const [value, setValue] = useVariable<number>(scope, name)
  const { min = -Infinity, max = Infinity, step = 1 } = options || {}

  const increment = useCallback(() => {
    const current = variablesService.get<number>(scope, name) || 0
    const newValue = Math.min(max, current + step)
    variablesService.set(scope, name, newValue)
  }, [scope, name, max, step])

  const decrement = useCallback(() => {
    const current = variablesService.get<number>(scope, name) || 0
    const newValue = Math.max(min, current - step)
    variablesService.set(scope, name, newValue)
  }, [scope, name, min, step])

  return [value ?? 0, increment, decrement, setValue]
}

/**
 * Hook for array variable
 * 
 * @example
 * const [items, { push, remove, clear }] = useArrayVariable('page', 'selectedItems')
 */
export function useArrayVariable<T = unknown>(
  scope: VariableScope, 
  name: string
): [T[], { push: (item: T) => void; remove: (index: number) => void; clear: () => void; set: (items: T[]) => void }] {
  const [value, setValue] = useVariable<T[]>(scope, name)

  const push = useCallback((item: T) => {
    variablesService.push(scope, name, item)
  }, [scope, name])

  const remove = useCallback((index: number) => {
    const current = variablesService.get<T[]>(scope, name) || []
    variablesService.set(scope, name, current.filter((_, i) => i !== index))
  }, [scope, name])

  const clear = useCallback(() => {
    variablesService.set(scope, name, [])
  }, [scope, name])

  return [value ?? [], { push, remove, clear, set: setValue }]
}

/**
 * Hook for resolving template strings with variables
 * 
 * @example
 * const greeting = useTemplate('Hello, {$page.userName}!')
 * // Returns "Hello, John!" if $page.userName is "John"
 */
export function useTemplate(template: string): string {
  const [resolved, setResolved] = useState(() => 
    variablesService.resolveTemplate(template)
  )

  useEffect(() => {
    // Extract variable references from template
    const matches = template.matchAll(/\{\$(\w+)\.(\w+)\}/g)
    const unsubscribes: (() => void)[] = []

    for (const match of matches) {
      const [, scope, name] = match
      const unsub = variablesService.subscribe(
        scope as VariableScope, 
        name, 
        () => setResolved(variablesService.resolveTemplate(template))
      )
      unsubscribes.push(unsub)
    }

    // Initial resolve
    setResolved(variablesService.resolveTemplate(template))

    return () => unsubscribes.forEach(unsub => unsub())
  }, [template])

  return resolved
}

/**
 * Hook for conditional rendering based on variable expression
 * 
 * @example
 * const shouldShow = useCondition('$page.count > 0 && $page.isActive')
 */
export function useCondition(expression: string): boolean {
  const [result, setResult] = useState(() => 
    variablesService.evaluateCondition(expression)
  )

  useEffect(() => {
    // Extract variable references from expression
    const matches = expression.matchAll(/\$(\w+)\.(\w+)/g)
    const unsubscribes: (() => void)[] = []

    for (const match of matches) {
      const [, scope, name] = match
      const unsub = variablesService.subscribe(
        scope as VariableScope, 
        name, 
        () => setResult(variablesService.evaluateCondition(expression))
      )
      unsubscribes.push(unsub)
    }

    // Initial evaluation
    setResult(variablesService.evaluateCondition(expression))

    return () => unsubscribes.forEach(unsub => unsub())
  }, [expression])

  return result
}

export default useVariable
