/**
 * Переключатель языка на страницах элементов коллекции.
 *
 * Страницы не-дефолтных языков список языков получали, а дефолтные — нет.
 * Генератор печатает рантайм переключения только когда языков минимум два,
 * поэтому с русской страницы проекта кнопка UZ не работала, хотя
 * `/uz/complex/<slug>/` уже существовала.
 */
import { DeployService } from '../services/DeployService'

const svc = new DeployService() as unknown as {
  collectionSwitcherLanguages(templatePageId: string): Promise<unknown[] | undefined>
}

jest.mock('../services/TranslationService', () => ({
  translationService: { getPageLocales: jest.fn() },
}))
jest.mock('../services/LanguageService', () => ({
  languageService: { getActive: jest.fn() },
}))

const { translationService } = jest.requireMock('../services/TranslationService')
const { languageService } = jest.requireMock('../services/LanguageService')

const LANGS = [
  { code: 'ru', nativeName: 'Русский', flag: '🇷🇺', isDefault: true, isActive: true, direction: 'ltr' },
  { code: 'uz', nativeName: 'Uzbek', flag: 'uz', isDefault: false, isActive: true, direction: 'ltr' },
  { code: 'en', nativeName: 'English', flag: 'en', isDefault: false, isActive: true, direction: 'ltr' },
]

beforeEach(() => {
  jest.clearAllMocks()
  languageService.getActive.mockResolvedValue(LANGS)
})

describe('collectionSwitcherLanguages', () => {
  it('без переводов шаблона возвращает undefined — переключать не на что', async () => {
    translationService.getPageLocales.mockResolvedValue([])
    await expect(svc.collectionSwitcherLanguages('tpl')).resolves.toBeUndefined()
  })

  it('с переводами отдаёт дефолтный язык и переведённые', async () => {
    translationService.getPageLocales.mockResolvedValue(['uz'])
    const out = (await svc.collectionSwitcherLanguages('tpl')) as Array<{ code: string }>
    expect(out.map((l) => l.code)).toEqual(['ru', 'uz'])
  })

  it('язык без переводов в список не попадает — иначе кнопка вела бы в 404', async () => {
    translationService.getPageLocales.mockResolvedValue(['uz'])
    const out = (await svc.collectionSwitcherLanguages('tpl')) as Array<{ code: string }>
    expect(out.map((l) => l.code)).not.toContain('en')
  })

  it('дефолтный язык присутствует всегда, даже без собственных переводов', async () => {
    translationService.getPageLocales.mockResolvedValue(['uz', 'en'])
    const out = (await svc.collectionSwitcherLanguages('tpl')) as Array<{ code: string; isDefault: boolean }>
    expect(out.find((l) => l.isDefault)!.code).toBe('ru')
    expect(out).toHaveLength(3)
  })

  it('выключенный язык не предлагается', async () => {
    languageService.getActive.mockResolvedValue([
      LANGS[0],
      { ...LANGS[1], isActive: false },
    ])
    translationService.getPageLocales.mockResolvedValue(['uz'])
    const out = (await svc.collectionSwitcherLanguages('tpl')) as Array<{ code: string }>
    expect(out.map((l) => l.code)).toEqual(['ru'])
  })

  it('форма записи совпадает с той, что ждёт генератор', async () => {
    translationService.getPageLocales.mockResolvedValue(['uz'])
    const out = (await svc.collectionSwitcherLanguages('tpl')) as Array<Record<string, unknown>>
    expect(Object.keys(out[1]).sort()).toEqual(['code', 'direction', 'flag', 'isDefault', 'name'])
    expect(out[1].name).toBe('Uzbek')
  })
})
