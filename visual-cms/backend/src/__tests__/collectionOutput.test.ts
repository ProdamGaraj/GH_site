/**
 * Папка страниц коллекции: перед генерацией удаляются только папки элементов
 * прошлой генерации (манифест), а страница списка (`/ru/news/index.html`) и
 * чужие страницы рядом остаются.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { COLLECTION_MANIFEST, pruneCollectionItems, writeCollectionManifest } from '../services/collectionOutput'

let dir: string

function write(rel: string, text = 'x'): void {
  const file = path.join(dir, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}
const exists = (rel: string) => fs.existsSync(path.join(dir, rel))

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'collection-output-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('pruneCollectionItems', () => {
  it('по манифесту: удаляются только папки элементов, список и чужие страницы остаются', () => {
    write('index.html', 'список новостей')
    write('a/index.html')
    write('b/index.html')
    write('archive/index.html', 'чужая страница')
    writeCollectionManifest(dir, ['a', 'b'])

    pruneCollectionItems(dir)

    expect(exists('index.html')).toBe(true)
    expect(exists('archive/index.html')).toBe(true)
    expect(exists('a')).toBe(false)
    expect(exists('b')).toBe(false)
    expect(exists(COLLECTION_MANIFEST)).toBe(false)
  })

  it('без манифеста (выкачено раньше): удаляются вложенные папки, файлы в корне остаются', () => {
    write('index.html', 'список')
    write('old-item/index.html')
    pruneCollectionItems(dir)
    expect(exists('index.html')).toBe(true)
    expect(exists('old-item')).toBe(false)
  })

  it('манифест не выводит за пределы папки: «..», разделители и мусор игнорируются', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'collection-outside-'))
    try {
      fs.writeFileSync(path.join(outside, 'keep.txt'), 'x')
      write('ok/index.html')
      fs.writeFileSync(
        path.join(dir, COLLECTION_MANIFEST),
        JSON.stringify({ items: ['ok', '..', `../${path.basename(outside)}`, 'a/b', '', 5] })
      )
      pruneCollectionItems(dir)
      expect(exists('ok')).toBe(false)
      expect(fs.existsSync(path.join(outside, 'keep.txt'))).toBe(true)
    } finally {
      fs.rmSync(outside, { recursive: true, force: true })
    }
  })

  it('битый манифест — ничего не удаляется, кроме самого манифеста', () => {
    write('a/index.html')
    fs.writeFileSync(path.join(dir, COLLECTION_MANIFEST), '{oops')
    pruneCollectionItems(dir)
    expect(exists('a/index.html')).toBe(true)
    expect(exists(COLLECTION_MANIFEST)).toBe(false)
  })

  it('папки нет — ничего не делает', () => {
    expect(() => pruneCollectionItems(path.join(dir, 'missing'))).not.toThrow()
  })
})

describe('writeCollectionManifest', () => {
  it('создаёт папку и пишет уникальные адреса', () => {
    const target = path.join(dir, 'ru', 'news')
    writeCollectionManifest(target, ['a', 'b', 'a'])
    expect(JSON.parse(fs.readFileSync(path.join(target, COLLECTION_MANIFEST), 'utf-8'))).toEqual({ items: ['a', 'b'] })
  })
})
