/**
 * Стампинг data-rmedia в data-binding рантайме для адаптива repeat-слайдов.
 * Проверяем присутствие функции applyResponsiveMedia и её вызова в конвейере
 * рендера слайда (точка касания критического рантайма — под тестом).
 */
import { generateDataBindingRuntime } from '../services/DataBindingGenerator'

const runtime = generateDataBindingRuntime({
  dataSources: [],
  bindings: [],
  variables: [{ name: 'heroSlides', type: 'array', defaultValue: [] }],
})

describe('DataBindingGenerator — стампинг адаптивного медиа слайда', () => {
  it('определяет applyResponsiveMedia и вызывает её в рендере', () => {
    expect(runtime).toContain('function applyResponsiveMedia(')
    expect(runtime).toContain('applyResponsiveMedia(clone, item, fieldMappings)')
  })

  it('читает item._responsive и ставит data-rmedia / data-rmedia-kind', () => {
    expect(runtime).toContain('item && item._responsive')
    expect(runtime).toContain("setAttribute('data-rmedia'")
    expect(runtime).toContain("setAttribute('data-rmedia-kind'")
  })

  it('различает bg и src по targetProperty', () => {
    expect(runtime).toContain("kind = 'src'")
    expect(runtime).toContain("kind = 'bg'")
  })
})
