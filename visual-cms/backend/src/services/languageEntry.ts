/**
 * Точка входа без языкового префикса.
 *
 * Раньше язык по умолчанию лежал в корне (`/about`), а остальные — под
 * префиксом (`/uz/about`). Теперь у каждого языка свой префикс, включая
 * русский, а по корневому адресу отдаётся страница-распознаватель: она
 * выбирает язык и уводит на `/<lang>/<path>`.
 *
 * Зачем страница, а не 301 в nginx: сервер не знает выбор посетителя, а
 * `Accept-Language` не отражает нажатие кнопки на сайте. Выбор хранится в
 * localStorage и побеждает язык браузера — иначе переключение сбрасывалось бы
 * при каждом заходе по корневой ссылке.
 */

/** Ключ, под которым хранится выбранный язык. Общий с рантаймом переключателя. */
export const LANG_STORAGE_KEY = 'gh-lang'

export interface EntryStubOptions {
  /** Коды активных языков в порядке предпочтения. */
  languages: string[]
  /** Код языка, на который уводим, если ничего не подошло. */
  defaultLanguage: string
  /**
   * Путь страницы без языка и без ведущего слеша: '' для главной,
   * 'about' или 'complex/harizma' для остальных.
   */
  pagePath: string
  /** Заголовок вкладки, пока идёт переход. */
  title?: string
}

/** Путь страницы в вид '/…/' — с ведущим и замыкающим слешем. */
export function normalizeEntryPath(pagePath: string): string {
  const clean = (pagePath || '').replace(/^\/+|\/+$/g, '')
  return clean ? `/${clean}/` : '/'
}

/**
 * Выбор языка по сохранённому значению и языкам браузера.
 *
 * Вынесено отдельной чистой функцией, чтобы правило проверялось тестом: на
 * странице оно живёт тем же алгоритмом, но внутри инлайн-скрипта.
 */
export function pickLanguage(
  saved: string | null,
  navigatorLanguages: string[],
  available: string[],
  fallback: string
): string {
  if (saved && available.includes(saved)) return saved
  for (const raw of navigatorLanguages) {
    const code = String(raw || '').toLowerCase().split('-')[0]
    if (code && available.includes(code)) return code
  }
  return fallback
}

/**
 * HTML страницы-распознавателя.
 *
 * `location.replace`, а не присваивание href: иначе кнопка «Назад» возвращала
 * бы на распознаватель, тот снова уводил вперёд, и выйти из страницы было бы
 * нельзя. `noscript` уводит на язык по умолчанию — без JS выбор сделать нечем.
 */
export function generateLanguageEntryStub(options: EntryStubOptions): string {
  const { languages, defaultLanguage, pagePath, title } = options
  const target = normalizeEntryPath(pagePath)
  const fallbackUrl = `/${defaultLanguage}${target}`
  const pageTitle = title || 'Golden House'

  return `<!DOCTYPE html>
<html lang="${defaultLanguage}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${fallbackUrl}">
${languages.map((code) => `<link rel="alternate" hreflang="${code}" href="/${code}${target}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${fallbackUrl}">
<noscript><meta http-equiv="refresh" content="0; url=${fallbackUrl}"></noscript>
<script>
(function(){
  var langs = ${JSON.stringify(languages)};
  var def = ${JSON.stringify(defaultLanguage)};
  var target = ${JSON.stringify(target)};
  var saved = null;
  try { saved = localStorage.getItem(${JSON.stringify(LANG_STORAGE_KEY)}); } catch (e) {}
  var pick = null;
  if (saved && langs.indexOf(saved) !== -1) pick = saved;
  if (!pick) {
    var nav = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || ''];
    for (var i = 0; i < nav.length && !pick; i++) {
      var code = String(nav[i] || '').toLowerCase().split('-')[0];
      if (code && langs.indexOf(code) !== -1) pick = code;
    }
  }
  location.replace('/' + (pick || def) + target);
})();
</script>
</head>
<body><p><a href="${fallbackUrl}">${fallbackUrl}</a></p></body>
</html>`
}
