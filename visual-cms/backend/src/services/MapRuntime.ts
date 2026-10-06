/**
 * Рантайм карты проекта: вставка в страницу.
 *
 * Сам рантайм — обычный JS-файл runtime/map-runtime.js, а не строка в TS, как
 * у карусели: его удобно править и проверять, и экранировать в нём нечего.
 * Здесь он читается с диска и вставляется, только если на странице есть
 * [data-map]: обычные страницы лишний скрипт не тащат.
 *
 * В проде файл должен лежать рядом со скомпилированным кодом — его копирует
 * Dockerfile.prod (tsc переносит только .ts).
 */
import { runtimeScript } from './runtimeFile'

/** Атрибут корня карты. data-map-point, data-map-filter и прочие — не он. */
const MAP_ROOT = /\sdata-map(?=[\s=>/])/

/** Есть ли на странице то, что этот рантайм обслуживает. */
export function hasProjectMap(bodyHtml: string): boolean {
  return MAP_ROOT.test(bodyHtml)
}

export function generateMapRuntime(bodyHtml: string): string {
  return hasProjectMap(bodyHtml) ? runtimeScript('map-runtime.js') : ''
}
