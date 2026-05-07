/**
 * Smoke-тест Phase 5a/5b: проверяет, что generateDataBindingRuntime
 * корректно обрабатывает DataSource type='page-variable' и target style.backgroundImage.
 *
 * Запуск из контейнера:
 *   docker exec visual-cms-backend-1 npx ts-node src/scripts/smoke-page-variable-binding.ts
 */
import { generateDataBindingRuntime, PageDataConfig } from '../services/DataBindingGenerator'

const config: PageDataConfig = {
  dataSources: [
    {
      alias: 'heroSlides',
      dataSourceId: '00000000-0000-0000-0000-000000000001',
      loadStrategy: 'pageLoad',
      cacheEnabled: false,
      type: 'page-variable',
      variableName: 'heroSlides',
    },
  ],
  bindings: [
    {
      blockId: 'track-1',
      bindingId: 'binding-1',
      type: 'repeater',
      sourceAlias: 'heroSlides',
      fieldMappings: [
        { sourceField: 'image', targetProperty: 'style.backgroundImage' },
        { sourceField: 'title', targetProperty: 'textContent' },
        { sourceField: 'ctaHref', targetProperty: 'attr.href' },
      ],
      repeaterConfig: {
        itemTemplate: 'slide-template-1',
        containerSelector: '[data-element-id="track-1"]',
      },
    } as any,
  ],
  variables: [
    {
      name: 'heroSlides',
      type: 'array',
      defaultValue: [
        { image: '/media/abc.jpg', title: 'Slide A', ctaHref: '/projects/a.html' },
        { image: '/media/def.jpg', title: 'Slide B', ctaHref: '/projects/b.html' },
      ],
    },
  ],
}

const runtime = generateDataBindingRuntime(config)

const checks: Array<[string, boolean]> = [
  ['variables injected', runtime.includes('"heroSlides":[') && runtime.includes('"image":"/media/abc.jpg"')],
  ['page-variable source flag', runtime.includes('"type":"page-variable"')],
  ['variableName in source', runtime.includes('"variableName":"heroSlides"')],
  ['runtime: page-variable preload branch', runtime.includes("source.type === 'page-variable'") && runtime.includes('_dataStore[source.alias] = _variables[source.variableName]')],
  ['runtime: skip fetch for page-variable', runtime.includes('// page-variable')],
  ['runtime: immediate updateBindings for page-variable', runtime.includes('hasPageVarSources')],
  ['applyValue: backgroundImage url() wrap', runtime.includes('background-image') && runtime.includes("'url(\"'")],
  ['applyValue: attr. prefix', runtime.includes("property.startsWith('attr.')")],
  ['repeater template id present', runtime.includes('"itemTemplate":"slide-template-1"')],
  ['fieldMapping image -> style.backgroundImage', runtime.includes('"sourceField":"image"') && runtime.includes('"targetProperty":"style.backgroundImage"')],
  ['runtime: self.* shortcut handler', runtime.includes("mapping.targetProperty.indexOf('self.') === 0")],
  ['runtime: [data-bind=X].prop selector handler', runtime.includes('selectorMatch = mapping.targetProperty.match')],
]

let passed = 0
let failed = 0
console.log('\n=== Phase 5a/5b smoke checks ===')
for (const [name, ok] of checks) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name)
  if (ok) passed++
  else failed++
}
console.log(`\nResult: ${passed} passed, ${failed} failed (${checks.length} total)`)

if (failed > 0) {
  console.log('\n--- Runtime preview (first 1500 chars) ---')
  console.log(runtime.slice(0, 1500))
  process.exit(1)
}
process.exit(0)
