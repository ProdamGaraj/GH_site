import { describe, it, expect } from 'vitest'
import { visibleRightPanelSections } from './rightPanelSections'

describe('visibleRightPanelSections', () => {
  it('в редакторе блока есть история версий, но нет настроек страницы и переводов', () => {
    const ids = visibleRightPanelSections('block').map((s) => s.id)
    expect(ids).toContain('versionHistory')
    expect(ids).not.toContain('pageSettings')
    expect(ids).not.toContain('translations')
  })

  it('в редакторе страницы — всё', () => {
    expect(visibleRightPanelSections('page').map((s) => s.id)).toEqual(expect.arrayContaining(['pageSettings', 'translations', 'versionHistory']))
  })
})
