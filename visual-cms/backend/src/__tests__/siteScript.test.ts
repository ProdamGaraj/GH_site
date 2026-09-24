/**
 * Сведение общего скрипта сайта в один Site JS: вырезание копий и план.
 *
 * Поведение самого Site JS в браузере — в siteScript.runtime.test.ts.
 */
import * as fs from 'fs'
import * as path from 'path'
import { MigrationError } from '../scripts/choiceToPlanTypes'
import { SITE_JS_MARKER, hasHeaderScript, planSiteScript, stripHeaderScript } from '../scripts/siteScript'

const RUNTIME = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'assets', 'site-runtime.js'), 'utf8')

/** Упрощённая копия скрипта шапки с тем же началом и концом, что у настоящей. */
const HEADER = `function syncLogoContrast() {
  const nav = document.querySelector(".gnav");
}

function bootTechnicalFeatures() {
  syncLogoContrast();
}

window.addEventListener("scroll", syncLogoContrast, { passive: true });
window.addEventListener("DOMContentLoaded", () => {
  syncLogoContrast();
  bootTechnicalFeatures();
});
syncLogoContrast();`

const FILTERS = `/* Фильтры квартир (#choice), v5. */
(function () {
  var section = document.getElementById('choice');
})();`

describe('stripHeaderScript', () => {
  it('JS целиком из копии — после вырезания пусто', () => {
    expect(stripHeaderScript('\n' + HEADER + '\n', 'x')).toEqual({ js: '', removed: true })
  })

  it('CRLF в копии (как в части блоков) не мешает найти конец', () => {
    expect(stripHeaderScript(HEADER.replace(/\n/g, '\r\n'), 'x').removed).toBe(true)
  })

  it('код после копии (скрипт фильтров «Выбрать») сохраняется', () => {
    const out = stripHeaderScript(HEADER + '\n\n' + FILTERS + '\n', 'x')
    expect(out).toEqual({ js: FILTERS, removed: true })
  })

  it('код до копии тоже сохраняется', () => {
    const out = stripHeaderScript('var before = 1;\n\n' + HEADER, 'x')
    expect(out.js).toBe('var before = 1;')
  })

  it('JS без копии не трогается', () => {
    expect(stripHeaderScript(FILTERS, 'x')).toEqual({ js: FILTERS, removed: false })
  })

  it('начало есть, конца нет — другая версия: ошибка, а не порча JS', () => {
    const broken = HEADER.replace('bootTechnicalFeatures();\n});', '});')
    expect(() => stripHeaderScript(broken, 'блок')).toThrow(MigrationError)
  })

  it('две копии подряд — ошибка: вырезана бы только первая', () => {
    expect(() => stripHeaderScript(HEADER + '\n' + HEADER, 'блок')).toThrow(MigrationError)
  })

  it('обычный syncLogoContrast без bootTechnicalFeatures (блок Navigation) — не копия', () => {
    const nav = '(function () {\n  function syncLogoContrast() {}\n  window.syncLogoContrast = syncLogoContrast;\n})();'
    expect(stripHeaderScript(nav, 'Navigation')).toEqual({ js: nav, removed: false })
  })
})

describe('planSiteScript', () => {
  const owners = [
    { id: 'block:a', label: 'блок «Buyer hero»', js: HEADER },
    { id: 'block:choice', label: 'блок «Complex choice»', js: HEADER + '\n\n' + FILTERS },
    { id: 'block:nav', label: 'блок «Navigation»', js: '(function(){ function syncLogoContrast(){} })();' },
    { id: 'page:news', label: 'страница news', js: '\n' + HEADER },
  ]

  it('пустой Site JS получает общий скрипт, копии вырезаются, чужой JS не трогается', () => {
    const plan = planSiteScript('', RUNTIME, owners)
    expect(plan.siteJs).toBe(RUNTIME)
    expect(plan.updates).toEqual([
      { id: 'block:a', label: 'блок «Buyer hero»', js: '' },
      { id: 'block:choice', label: 'блок «Complex choice»', js: FILTERS },
      { id: 'page:news', label: 'страница news', js: '' },
    ])
    expect(plan.changes).toHaveLength(4)
  })

  it('повторный запуск (Site JS уже стоит, копий нет) ничего не меняет', () => {
    const first = planSiteScript('', RUNTIME, owners)
    const after = owners.map((o) => ({ ...o, js: first.updates.find((u) => u.id === o.id)?.js ?? o.js }))
    const again = planSiteScript(first.siteJs, RUNTIME, after)
    expect(again.changes).toEqual([])
    expect(again.siteJs).toBe(first.siteJs)
  })

  it('чужой код в Site JS не затирается молча', () => {
    expect(() => planSiteScript('console.log("кто-то написал")', RUNTIME, [])).toThrow(MigrationError)
  })

  it('битый файл скрипта (без маркера) не уходит в базу', () => {
    expect(() => planSiteScript('', 'var x;', [])).toThrow(MigrationError)
  })
})

describe('site-runtime.js', () => {
  it('начинается с маркера и не содержит копии скрипта шапки', () => {
    expect(RUNTIME.startsWith(SITE_JS_MARKER)).toBe(true)
    expect(hasHeaderScript(RUNTIME)).toBe(false)
  })

  it('без частей, которыми владеют блок Navigation и CMS', () => {
    for (const gone of ['function syncLogoContrast', 'function ensureLanguageOptions', 'function normalizeNavigation',
      'function setupActiveNavigation', 'function setupSeo', 'function renderRichFooter']) {
      expect(RUNTIME).not.toContain(gone)
    }
  })

  it('синтаксически корректен', () => {
    expect(() => new Function(RUNTIME)).not.toThrow()
  })
})
