import { describe, it, expect } from 'vitest'
import { formatPoint, movePlace, newPlace, parseCoordinates, removePlace, updatePlace } from './projectMap'
import type { MapPlace } from './types'

const place = (id: string, name = id): MapPlace => ({ id, type: 'school', name, lat: 41.3, lng: 69.2 })

describe('parseCoordinates', () => {
  it('как копируют из Яндекс и Google Карт', () => {
    expect(parseCoordinates('41.311081, 69.240562')).toEqual({ lat: 41.311081, lng: 69.240562 })
    expect(parseCoordinates(' 41.31;69.28 ')).toEqual({ lat: 41.31, lng: 69.28 })
    expect(parseCoordinates('41.31 69.28')).toEqual({ lat: 41.31, lng: 69.28 })
    expect(parseCoordinates('41,31; 69,28')).toEqual({ lat: 41.31, lng: 69.28 })
  })

  it('неоднозначное, вне пределов и мусор — null', () => {
    expect(parseCoordinates('41,31, 69,28')).toBeNull()
    expect(parseCoordinates('91, 10')).toBeNull()
    expect(parseCoordinates('41.3, 181')).toBeNull()
    expect(parseCoordinates('Ташкент')).toBeNull()
    expect(parseCoordinates('')).toBeNull()
  })

  it('formatPoint — обратно в строку; разбор и формат обратимы', () => {
    expect(formatPoint({ lat: 41.31, lng: 69.28 })).toBe('41.31, 69.28')
    expect(formatPoint(null)).toBe('')
    expect(parseCoordinates(formatPoint({ lat: -12.5, lng: 130.25 }))).toEqual({ lat: -12.5, lng: 130.25 })
  })
})

describe('правка мест', () => {
  it('новое место: uuid, название без пробелов по краям, координаты', () => {
    expect(newPlace('park', '  Парк  ', { lat: 1, lng: 2 }, () => 'id-1')).toEqual({ id: 'id-1', type: 'park', name: 'Парк', lat: 1, lng: 2 })
  })

  it('updatePlace меняет только своё место; пустое название не принимается', () => {
    const list = [place('a'), place('b')]
    expect(updatePlace(list, 'b', { name: 'Школа №2', lat: 41.4 })[1]).toMatchObject({ name: 'Школа №2', lat: 41.4 })
    expect(updatePlace(list, 'b', { name: '  ' })).toEqual(list)
  })

  it('removePlace и movePlace; сдвиг за край — без изменений', () => {
    const list = [place('a'), place('b'), place('c')]
    expect(removePlace(list, 'b').map((p) => p.id)).toEqual(['a', 'c'])
    expect(movePlace(list, 'c', -1).map((p) => p.id)).toEqual(['a', 'c', 'b'])
    expect(movePlace(list, 'a', -1).map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(movePlace(list, 'c', 1).map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(movePlace(list, 'nope', 1)).toEqual(list)
  })
})
