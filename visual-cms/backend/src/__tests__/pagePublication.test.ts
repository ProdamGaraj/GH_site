/**
 * Публикация и снятие страниц: файлы страницы, безопасное удаление, план
 * «Опубликовать сайт» и правила смены статуса.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  allowedStatusChange,
  initialStatus,
  planSiteSync,
  publishedFiles,
  removePublishedFiles,
} from '../services/pagePublication'

const LANGS = ['ru', 'uz', 'en']

function tmpSite(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pub-'))
}

function put(root: string, rel: string): void {
  const file = path.join(root, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '<html></html>')
}

function exists(root: string, rel: string): boolean {
  return fs.existsSync(path.join(root, rel))
}

describe('publishedFiles', () => {
  it('страница: распознаватель в корне, копия в каждом языке, старый плоский файл', () => {
    const files = publishedFiles('/site', 'harizma', false, ['ru', 'uz'])
    expect(files.map((f) => path.relative('/site', f).split(path.sep).join('/'))).toEqual([
      'harizma/index.html',
      'ru/harizma/index.html',
      'uz/harizma/index.html',
      'harizma.html',
    ])
  })

  it('главная: index.html в корне и в каждом языке, без плоского файла', () => {
    const files = publishedFiles('/site', 'mainpage', true, ['ru'])
    expect(files.map((f) => path.relative('/site', f).split(path.sep).join('/'))).toEqual([
      'index.html',
      'ru/index.html',
    ])
  })
})

describe('removePublishedFiles', () => {
  it('убирает страницу во всех языках и её опустевшие папки', () => {
    const root = tmpSite()
    for (const rel of ['harizma-old/index.html', 'ru/harizma-old/index.html', 'uz/harizma-old/index.html']) put(root, rel)
    const removed = removePublishedFiles(root, publishedFiles(root, 'harizma-old', false, LANGS), LANGS)
    expect(removed).toHaveLength(3)
    expect(exists(root, 'harizma-old')).toBe(false)
    expect(exists(root, 'ru/harizma-old')).toBe(false)
    expect(exists(root, 'uz/harizma-old')).toBe(false)
  })

  it('папки языков остаются, даже опустев', () => {
    const root = tmpSite()
    put(root, 'uz/solo/index.html')
    removePublishedFiles(root, publishedFiles(root, 'solo', false, LANGS), LANGS)
    expect(exists(root, 'uz')).toBe(true)
  })

  it('вложенные адреса под страницей не трогаются — например, коллекция под /complex', () => {
    const root = tmpSite()
    put(root, 'ru/complex/index.html')
    put(root, 'ru/complex/harizma/index.html')
    removePublishedFiles(root, publishedFiles(root, 'complex', false, LANGS), LANGS)
    expect(exists(root, 'ru/complex/index.html')).toBe(false)
    expect(exists(root, 'ru/complex/harizma/index.html')).toBe(true)
  })

  it('отсутствующие файлы — не ошибка, удалять нечего', () => {
    const root = tmpSite()
    expect(removePublishedFiles(root, publishedFiles(root, 'nope', false, LANGS), LANGS)).toEqual([])
  })

  it('соседние страницы и корень сайта не задеты', () => {
    const root = tmpSite()
    put(root, 'index.html')
    put(root, 'ru/about/index.html')
    put(root, 'ru/harizma-old/index.html')
    removePublishedFiles(root, publishedFiles(root, 'harizma-old', false, LANGS), LANGS)
    expect(exists(root, 'index.html')).toBe(true)
    expect(exists(root, 'ru/about/index.html')).toBe(true)
  })
})

describe('planSiteSync', () => {
  const page = (id: string, slug: string, status: string) => ({ id, slug, status })
  const notHome = () => false

  it('выкладываются только опубликованные', () => {
    const plan = planSiteSync(
      [page('1', 'about', 'published'), page('2', 'harizma-old', 'draft'), page('3', 'x', 'archived')],
      notHome
    )
    expect(plan.deploy.map((p) => p.id)).toEqual(['1'])
  })

  it('файлы черновиков и архива убираются', () => {
    const plan = planSiteSync([page('1', 'about', 'published'), page('2', 'old', 'draft'), page('3', 'x', 'archived')], notHome)
    expect(plan.cleanup.map((p) => p.id)).toEqual(['2', '3'])
  })

  it('черновик с адресом опубликованной страницы не чистится — иначе снесли бы её файлы', () => {
    const plan = planSiteSync([page('1', 'harizma', 'published'), page('2', 'harizma', 'draft')], notHome)
    expect(plan.cleanup).toEqual([])
  })

  it('главная не чистится никогда: корень сайта без неё отдаёт 404', () => {
    const plan = planSiteSync([page('home', 'mainpage', 'draft')], (p) => p.id === 'home')
    expect(plan.cleanup).toEqual([])
  })
})

describe('allowedStatusChange', () => {
  it('опубликовать сохранением настроек нельзя', () => {
    expect(allowedStatusChange('draft', 'published')).toBeUndefined()
  })

  it('снять сохранением настроек нельзя — только кнопкой, которая убирает файлы', () => {
    expect(allowedStatusChange('published', 'draft')).toBeUndefined()
    expect(allowedStatusChange('published', 'archived')).toBeUndefined()
  })

  it('черновик ↔ архив можно', () => {
    expect(allowedStatusChange('draft', 'archived')).toBe('archived')
    expect(allowedStatusChange('archived', 'draft')).toBe('draft')
  })

  it('тот же статус, пусто и мусор — не трогать', () => {
    expect(allowedStatusChange('draft', 'draft')).toBeUndefined()
    expect(allowedStatusChange('draft', undefined)).toBeUndefined()
    expect(allowedStatusChange('draft', 'live')).toBeUndefined()
  })
})

describe('initialStatus', () => {
  it('новая страница опубликованной не создаётся', () => {
    expect(initialStatus('published')).toBe('draft')
    expect(initialStatus(undefined)).toBe('draft')
    expect(initialStatus('archived')).toBe('archived')
  })
})
