import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Build public URL for a site based on its routing mode.
 * Mirrors backend DeployService.resolveSiteUrl logic.
 */
export function getSitePublicUrl(site: { slug: string; routingMode: string; hostname?: string }): string {
  const base = 'https://localhost'
  if (site.routingMode === 'custom-domain' && site.hostname) {
    return `https://${site.hostname}`
  }
  if (site.routingMode === 'subdomain') {
    const subdomain = site.hostname || site.slug
    return `https://${subdomain}.localhost`
  }
  // path-prefix
  const prefix = site.hostname || `/${site.slug}`
  return `${base}${prefix}`
}

/**
 * Build public URL for a specific page within a site.
 */
export function getPagePublicUrl(
  site: { slug: string; routingMode: string; hostname?: string },
  pageSlug: string
): string {
  const siteUrl = getSitePublicUrl(site)
  const pagePath = pageSlug === 'index' || pageSlug === 'home' ? '' : pageSlug
  return pagePath ? `${siteUrl}/${pagePath}` : siteUrl
}

export function combineRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (element: T) => {
    refs.forEach((ref) => {
      if (!ref) return
      if (typeof ref === 'function') {
        ref(element)
      } else {
        (ref as React.MutableRefObject<T>).current = element
      }
    })
  }
}
