import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function combineRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (element: T) => {
    refs.forEach((ref) => {
      if (!ref) return
      if (typeof ref === 'function') {
        ref(element)
      } else {
        ;(ref as React.MutableRefObject<T>).current = element
      }
    })
  }
}
