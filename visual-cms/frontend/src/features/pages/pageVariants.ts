/**
 * Варианты страницы в списках: страницы с одним адресом (сайт + slug)
 * показываются группой — опубликованный вариант первым, черновики под ним.
 *
 * Опубликован у адреса всегда один (частичный уникальный индекс на сервере);
 * опубликовать черновик-вариант = заменить им опубликованный.
 */

export interface VariantPage {
  id: string
  name: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  siteId?: string | null
}

export interface AddressGroup<T extends VariantPage> {
  key: string
  slug: string
  /** Опубликованный вариант адреса, если есть. */
  published?: T
  /** Все варианты: опубликованный первым, дальше в исходном порядке. */
  pages: T[]
}

const addressKey = (page: VariantPage) => `${page.siteId ?? ''}\u0000${page.slug}`

/** Группы по адресу в порядке первого появления адреса в списке. */
export function groupByAddress<T extends VariantPage>(pages: readonly T[]): AddressGroup<T>[] {
  const groups = new Map<string, AddressGroup<T>>()
  for (const page of pages) {
    const key = addressKey(page)
    const group = groups.get(key) ?? { key, slug: page.slug, pages: [] }
    group.pages.push(page)
    if (page.status === 'published') group.published = page
    groups.set(key, group)
  }
  for (const group of groups.values()) {
    if (group.published) group.pages = [group.published, ...group.pages.filter((p) => p !== group.published)]
  }
  return [...groups.values()]
}

/** Опубликованный вариант того же адреса, который заменит публикация страницы. */
export function occupantOf<T extends VariantPage>(page: T, group: AddressGroup<T>): T | undefined {
  return group.published && group.published.id !== page.id ? group.published : undefined
}
