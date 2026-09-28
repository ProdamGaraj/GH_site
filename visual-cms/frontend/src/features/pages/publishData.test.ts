import { describe, it, expect } from 'vitest'
import { cleanPublishData, publishDataErrors } from './publishData'

const DS = '1ddf808d-77ee-4f07-aed7-0c21c82d1356'

describe('publishDataErrors', () => {
  it('корректные строки — без ошибок', () => {
    expect(publishDataErrors([{ name: 'complexes', dataSourceId: DS, arrayPath: 'items' }, { name: '_news2', dataSourceId: DS }])).toEqual({})
  })

  it('пустое имя, не-идентификатор, повтор, нет источника — по строке', () => {
    const errors = publishDataErrors([
      { name: '', dataSourceId: DS },
      { name: 'my-data', dataSourceId: DS },
      { name: 'complexes', dataSourceId: DS },
      { name: 'complexes', dataSourceId: DS },
      { name: 'news', dataSourceId: '' },
    ])
    expect(errors).toEqual({
      0: 'Укажите имя',
      1: 'Имя — латиница, цифры и _, с буквы',
      3: 'Имя уже занято',
      4: 'Выберите источник',
    })
  })

  it('пробелы по краям имени не делают его другим', () => {
    expect(publishDataErrors([{ name: 'complexes', dataSourceId: DS }, { name: ' complexes ', dataSourceId: DS }])).toEqual({
      1: 'Имя уже занято',
    })
  })

  it('имя с цифры отклоняется, как на сервере', () => {
    expect(publishDataErrors([{ name: '1st', dataSourceId: DS }])[0]).toBeDefined()
  })
})

describe('cleanPublishData', () => {
  it('обрезает пробелы и убирает пустой путь', () => {
    expect(
      cleanPublishData([
        { name: ' complexes ', dataSourceId: DS, arrayPath: ' items ' },
        { name: 'all', dataSourceId: DS, arrayPath: '  ' },
        { name: 'raw', dataSourceId: DS },
      ]),
    ).toEqual([
      { name: 'complexes', dataSourceId: DS, arrayPath: 'items' },
      { name: 'all', dataSourceId: DS },
      { name: 'raw', dataSourceId: DS },
    ])
  })
})
