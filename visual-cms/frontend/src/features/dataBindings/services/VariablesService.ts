import type { VariableScope, VariableDefinition } from '../components/VariablesEditor'

type VariableListener = (value: unknown) => void

interface VariableState {
  value: unknown
  definition: VariableDefinition
  listeners: Set<VariableListener>
}

/**
 * Variables Runtime Service
 * 
 * Manages page, global, and session variables with:
 * - Read/Write/Subscribe operations
 * - Reactive updates to subscribers
 * - localStorage persistence for global/session variables
 * - Type validation
 */
class VariablesService {
  private variables: Map<string, VariableState> = new Map()
  private readonly STORAGE_PREFIX = 'vcms_var_'

  /**
   * Initialize variables from definitions
   */
  initializeVariables(definitions: VariableDefinition[], scope?: VariableScope): void {
    const filtered = scope 
      ? definitions.filter(d => d.scope === scope)
      : definitions

    filtered.forEach(def => {
      const key = this.getKey(def.scope, def.name)
      
      // Load persisted value or use default
      let value = def.defaultValue
      if (def.persist && (def.scope === 'global' || def.scope === 'session')) {
        const stored = this.loadFromStorage(key)
        if (stored !== undefined) {
          value = stored
        }
      }

      this.variables.set(key, {
        value,
        definition: def,
        listeners: new Set()
      })
    })
  }

  /**
   * Clear page-scoped variables (called on page navigation)
   */
  clearPageVariables(): void {
    const keysToDelete: string[] = []
    this.variables.forEach((state, key) => {
      if (state.definition.scope === 'page') {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => this.variables.delete(key))
  }

  /**
   * Get variable value
   */
  get<T = unknown>(scope: VariableScope, name: string): T | undefined {
    const key = this.getKey(scope, name)
    const state = this.variables.get(key)
    return state?.value as T | undefined
  }

  /**
   * Get variable by full path (e.g., "$page.selectedId")
   */
  getByPath<T = unknown>(path: string): T | undefined {
    const parsed = this.parsePath(path)
    if (!parsed) return undefined
    return this.get<T>(parsed.scope, parsed.name)
  }

  /**
   * Set variable value
   */
  set(scope: VariableScope, name: string, value: unknown): boolean {
    const key = this.getKey(scope, name)
    const state = this.variables.get(key)

    if (!state) {
      console.warn(`Variable ${key} not found`)
      return false
    }

    if (state.definition.readOnly) {
      console.warn(`Variable ${key} is read-only`)
      return false
    }

    // Type validation
    if (!this.validateType(value, state.definition.type)) {
      console.warn(`Invalid type for variable ${key}. Expected ${state.definition.type}`)
      return false
    }

    const oldValue = state.value
    state.value = value

    // Persist if needed
    if (state.definition.persist) {
      this.saveToStorage(key, value)
    }

    // Notify listeners if reactive
    if (state.definition.reactive && oldValue !== value) {
      state.listeners.forEach(listener => {
        try {
          listener(value)
        } catch (err) {
          console.error(`Variable listener error for ${key}:`, err)
        }
      })
    }

    return true
  }

  /**
   * Set variable by full path
   */
  setByPath(path: string, value: unknown): boolean {
    const parsed = this.parsePath(path)
    if (!parsed) return false
    return this.set(parsed.scope, parsed.name, value)
  }

  /**
   * Subscribe to variable changes
   */
  subscribe(scope: VariableScope, name: string, listener: VariableListener): () => void {
    const key = this.getKey(scope, name)
    const state = this.variables.get(key)

    if (!state) {
      console.warn(`Cannot subscribe to unknown variable ${key}`)
      return () => {}
    }

    state.listeners.add(listener)

    // Return unsubscribe function
    return () => {
      state.listeners.delete(listener)
    }
  }

  /**
   * Subscribe by full path
   */
  subscribeByPath(path: string, listener: VariableListener): () => void {
    const parsed = this.parsePath(path)
    if (!parsed) return () => {}
    return this.subscribe(parsed.scope, parsed.name, listener)
  }

  /**
   * Update variable (merge for objects, replace for others)
   */
  update(scope: VariableScope, name: string, updater: (current: unknown) => unknown): boolean {
    const current = this.get(scope, name)
    const newValue = updater(current)
    return this.set(scope, name, newValue)
  }

  /**
   * Increment numeric variable
   */
  increment(scope: VariableScope, name: string, delta: number = 1): boolean {
    const current = this.get<number>(scope, name) || 0
    return this.set(scope, name, current + delta)
  }

  /**
   * Toggle boolean variable
   */
  toggle(scope: VariableScope, name: string): boolean {
    const current = this.get<boolean>(scope, name) || false
    return this.set(scope, name, !current)
  }

  /**
   * Push to array variable
   */
  push(scope: VariableScope, name: string, item: unknown): boolean {
    const current = this.get<unknown[]>(scope, name) || []
    return this.set(scope, name, [...current, item])
  }

  /**
   * Remove from array variable
   */
  removeFromArray(scope: VariableScope, name: string, predicate: (item: unknown) => boolean): boolean {
    const current = this.get<unknown[]>(scope, name) || []
    return this.set(scope, name, current.filter(item => !predicate(item)))
  }

  /**
   * Get all variables for a scope
   */
  getAllForScope(scope: VariableScope): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    this.variables.forEach((state) => {
      if (state.definition.scope === scope) {
        result[state.definition.name] = state.value
      }
    })
    return result
  }

  /**
   * Get all variables as a nested object
   */
  getAll(): { page: Record<string, unknown>; global: Record<string, unknown>; session: Record<string, unknown> } {
    return {
      page: this.getAllForScope('page'),
      global: this.getAllForScope('global'),
      session: this.getAllForScope('session')
    }
  }

  /**
   * Resolve template string with variables
   * e.g., "Hello, {$page.userName}!" -> "Hello, John!"
   */
  resolveTemplate(template: string): string {
    return template.replace(/\{\$(\w+)\.(\w+)\}/g, (match, scope, name) => {
      const value = this.get(scope as VariableScope, name)
      return value !== undefined ? String(value) : match
    })
  }

  /**
   * Evaluate expression with variables
   * e.g., "$page.count > 0" -> true/false
   */
  evaluateCondition(expression: string): boolean {
    try {
      // Replace variable references with actual values
      const resolved = expression.replace(/\$(\w+)\.(\w+)/g, (_match, scope, name) => {
        const value = this.get(scope as VariableScope, name)
        if (typeof value === 'string') return JSON.stringify(value)
        if (value === undefined) return 'undefined'
        return String(value)
      })

      // Safe evaluation (basic expressions only)
      // eslint-disable-next-line no-new-func
      return Boolean(new Function(`return ${resolved}`)())
    } catch (err) {
      console.error('Failed to evaluate condition:', expression, err)
      return false
    }
  }

  // Private helpers

  private getKey(scope: VariableScope, name: string): string {
    return `${scope}.${name}`
  }

  private parsePath(path: string): { scope: VariableScope; name: string } | null {
    const match = path.match(/^\$?(page|global|session)\.(\w+)$/)
    if (!match) return null
    return { scope: match[1] as VariableScope, name: match[2] }
  }

  private validateType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
      default:
        return true
    }
  }

  private loadFromStorage(key: string): unknown | undefined {
    try {
      const stored = localStorage.getItem(this.STORAGE_PREFIX + key)
      if (stored === null) return undefined
      return JSON.parse(stored)
    } catch {
      return undefined
    }
  }

  private saveToStorage(key: string, value: unknown): void {
    try {
      localStorage.setItem(this.STORAGE_PREFIX + key, JSON.stringify(value))
    } catch (err) {
      console.error('Failed to save variable to storage:', err)
    }
  }
}

// Singleton instance
export const variablesService = new VariablesService()

export default variablesService
