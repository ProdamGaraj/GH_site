/**
 * Карта проекта в блоке «Complex location» (3cead26c) вместо заглушки.
 *
 * Было: фото-заглушка из CSS блока (стоковый снимок города) и метки
 * `item.locationLabels`, расставленные вручную в процентах. Ссылка
 * «Посмотреть на карте» вела на #location — на эту же секцию.
 *
 * Стало (данные — estate-service, services/projectMap.ts):
 *   - узел карты [data-map] повторяется по `item.mapHouse` (0..1): нет точки
 *     дома — нет ни карты, ни её скрипта. Рисует её рантайм
 *     services/runtime/map-runtime.js;
 *   - внутри: холст, легенда-фильтр по `item.mapLegend` и список точек по
 *     `item.mapPoints` — он же текст для экранного диктора и запасной вид,
 *     если карта не загрузилась;
 *   - кнопки поездки в отдел продаж повторяются по `item.mapOffices` (0..1):
 *     такси Яндекс Go и маршруты в Яндекс и Google Картах;
 *   - картинка карты `item.mapImages` остаётся: у проекта без координат видна
 *     она, у проекта с координатами она лежит под картой, пока та грузится.
 *     Нет ни координат, ни картинки — рамка карты скрыта.
 *
 * Чистое преобразование, запись в базу — migrate-project-map.ts.
 * Повторный вызов ничего не меняет (alreadyMigrated).
 */
import { upsertCssSection } from './complexMedia'
import {
  MigrationError,
  MigrationResult,
  StructureNode,
  findOne,
  hasClass,
  makeNode,
  withClass,
} from './choiceToPlanTypes'

const LABELS_SOURCE = 'item.locationLabels'
const IMAGES_SOURCE = 'item.mapImages'
const HOUSE_SOURCE = 'item.mapHouse'
const POINTS_SOURCE = 'item.mapPoints'
const LEGEND_SOURCE = 'item.mapLegend'
const OFFICES_SOURCE = 'item.mapOffices'

/** Класс шаблона картинки карты: по нему CSS понимает, что рамке есть что показать. */
export const MAP_IMAGE_CLASS = 'location-map-image'

/**
 * Такси Яндекс Go до отдела продаж. ref и appmetrica_tracking_id выдаёт
 * партнёрская программа Яндекс Go — с ними поездки с сайта засчитываются
 * компании. Пока их нет, стоят источник-домен и идентификатор перехода из
 * документации Яндекса: приложение открывается с точкой назначения, но без
 * учёта. Меняются потом прямо в блоке, в ссылке кнопки.
 */
export const TAXI_HREF =
  'https://3.redirect.appmetrica.yandex.com/route?end-lat={{$.lat}}&end-lon={{$.lng}}&ref=gh.uz&appmetrica_tracking_id=1178268795219780156'
/** Маршрут от места, где человек сейчас (начало пустое), до отдела продаж. */
export const YANDEX_ROUTE_HREF = 'https://yandex.uz/maps/?rtext=~{{$.lat}},{{$.lng}}&rtt=auto'
export const GOOGLE_ROUTE_HREF = 'https://www.google.com/maps/dir/?api=1&destination={{$.lat}},{{$.lng}}'

const CSS_HEAD = '/* ==== project-map'
export const PROJECT_MAP_CSS_MARKER = `${CSS_HEAD} v1 ====`
export const PROJECT_MAP_CSS = `${PROJECT_MAP_CSS_MARKER} */
/* Карта проекта вместо фото-заглушки с метками в процентах.
   Рантайм — backend/src/services/runtime/map-runtime.js, данные — estate:
   mapHouse (есть ли карта), mapPoints, mapLegend, mapOffices. Правила ниже
   перекрывают старые правила блока выше. */

.location-visual {
  background: #ece7dc;
}

/* У проекта нет ни точки дома, ни картинки карты — пустую рамку не показываем. */
.location-visual:not(:has(.${MAP_IMAGE_CLASS}, [data-map])) {
  display: none;
}

.project-map {
  position: absolute;
  inset: 0;
}

/* Специфичнее .maplibregl-map из CSS MapLibre: та ставит position: relative,
   и холст без своей высоты схлопнулся бы. */
.project-map .project-map-canvas {
  position: absolute;
  inset: 0;
}

.project-map[data-map-state="failed"] .project-map-canvas {
  display: none;
}

/* --- Легенда: фильтр по типам мест --- */

.project-map-legend {
  position: absolute;
  z-index: 2;
  top: 16px;
  left: 16px;
  right: 64px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  /* Сквозь промежутки между кнопками карту можно тащить. */
  pointer-events: none;
}

.project-map-legend:empty {
  display: none;
}

.project-map-filter {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 12px 0 5px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, .94);
  color: #15181d;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 6px 18px rgba(13, 15, 18, .14);
  cursor: pointer;
  transition: opacity .2s ease, box-shadow .2s ease;
}

.project-map-filter[aria-pressed="false"] {
  opacity: .5;
  box-shadow: none;
}

.project-map-filter-icon,
.project-map-pin-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.project-map-filter-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--map-color, #15181d);
  color: #fff;
}

.project-map-filter-icon svg {
  width: 15px;
  height: 15px;
}

.project-map-filter-count {
  color: rgba(21, 24, 29, .45);
}

/* --- Метки. Внешний элемент метки двигает MapLibre, оформление — внутри. --- */

/* Дом и отдел продаж — поверх мест: на мелком масштабе места их не закрывают. */
.project-map-marker--house,
.project-map-marker--office {
  z-index: 2;
}

.project-map-marker--house .project-map-pin,
.project-map-marker--office .project-map-pin {
  position: relative;
  /* flex, а не inline-flex: у строчного элемента под ним остаётся зазор
     под выносные элементы шрифта, и остриё не доставало бы до точки. */
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  /* Высота хвостика: метка стоит якорем bottom, остриё — ровно на точке. */
  margin-bottom: 7px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  box-shadow: 0 10px 28px rgba(13, 15, 18, .22);
}

.project-map-marker--house .project-map-pin::after,
.project-map-marker--office .project-map-pin::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  border: 7px solid transparent;
  border-bottom: 0;
  transform: translateX(-50%);
}

.project-map-marker--house .project-map-pin {
  background: #15181d;
  color: #fff;
}

.project-map-marker--house .project-map-pin::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fdb82a;
}

.project-map-marker--house .project-map-pin::after {
  border-top-color: #15181d;
}

.project-map-marker--office .project-map-pin {
  background: #fdb82a;
  color: #15181d;
}

.project-map-marker--office .project-map-pin::after {
  border-top-color: #fdb82a;
}

.project-map-marker--place .project-map-pin {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--map-color, #15181d);
  color: #fff;
  box-shadow: 0 4px 12px rgba(13, 15, 18, .28);
  cursor: pointer;
  transition: transform .15s ease;
}

.project-map-pin-icon svg {
  display: block;
  width: 16px;
  height: 16px;
}

.project-map-marker--place:hover {
  z-index: 3;
}

.project-map-marker--place:hover .project-map-pin,
.project-map-marker--place.is-open .project-map-pin,
.project-map-marker--place .project-map-pin:focus-visible {
  transform: scale(1.15);
}

.project-map-tip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  display: grid;
  gap: 3px;
  padding: 8px 12px;
  border-radius: 12px;
  background: #fff;
  color: #15181d;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  box-shadow: 0 10px 28px rgba(13, 15, 18, .18);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translate(-50%, 4px);
  transition: opacity .15s ease, transform .15s ease, visibility .15s;
}

.project-map-tip-distance {
  color: rgba(21, 24, 29, .55);
  font-size: 12px;
  font-weight: 600;
}

.project-map-marker--place:hover .project-map-tip,
.project-map-marker--place.is-open .project-map-tip,
.project-map-pin:focus-visible + .project-map-tip {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 0);
}

/* --- Список точек: для экранного диктора, а если карта не загрузилась — на виду. --- */

.project-map-points {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  list-style: none;
}

.project-map[data-map-state="failed"] .project-map-points {
  z-index: 1;
  top: 68px;
  left: 16px;
  width: min(360px, calc(100% - 32px));
  height: auto;
  max-height: calc(100% - 84px);
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 14px 16px;
  overflow: auto;
  clip-path: none;
  white-space: normal;
  border-radius: 18px;
  background: rgba(255, 255, 255, .95);
  box-shadow: 0 10px 28px rgba(13, 15, 18, .14);
}

.project-map-point {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  line-height: 1.3;
}

/* display: flex выше перебил бы атрибут hidden, которым легенда прячет строки. */
.project-map-point[hidden] {
  display: none;
}

.project-map-point[data-kind="house"] {
  font-weight: 800;
}

.project-map-point-distance {
  color: rgba(21, 24, 29, .55);
  white-space: nowrap;
}

.project-map-point-distance:empty {
  display: none;
}

/* --- Поездка в отдел продаж --- */

.location-actions {
  flex-wrap: wrap;
}

/* display: inline-flex у ссылок блока перебивал атрибут hidden: скрытая
   «Панорама 360°» (ведёт на эту же секцию) была видна. */
.location-actions a[hidden] {
  display: none;
}

.location-trip,
.location-trip-links {
  display: contents;
}

.location-office {
  flex: 1 1 100%;
  margin: 0;
  color: rgba(21, 24, 29, .62);
  font-size: 14px;
  text-align: right;
}

.location-office-address:not(:empty)::before {
  content: " · ";
}

.location-actions a.location-trip-taxi {
  border-color: #15181d;
  background: #15181d;
  color: #fff;
}

@media (max-width: 980px) {
  .location-office {
    text-align: left;
  }
}

@media (max-width: 767px) {
  /* Одна строка с прокруткой; край гаснет — видно, что дальше есть ещё. */
  .project-map-legend {
    right: 56px;
    flex-wrap: nowrap;
    overflow-x: auto;
    pointer-events: auto;
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(to right, #000 85%, transparent);
    mask-image: linear-gradient(to right, #000 85%, transparent);
  }

  .project-map-legend::-webkit-scrollbar {
    display: none;
  }

  /* Тень прокрутка обрезала бы прямоугольником — на телефоне вместо неё рамка. */
  .project-map-filter {
    flex: 0 0 auto;
    border: 1px solid rgba(21, 24, 29, .1);
    box-shadow: none;
  }
}
`

// --- Узлы ---

function text(id: string, tagName: string, className: string, content: string, attributes: Record<string, string> = {}): StructureNode {
  return makeNode({ id, tagName, elementType: 'text', content, attributes: { class: className, ...attributes } })
}

function link(id: string, className: string, href: string, content: string): StructureNode {
  const attributes: Record<string, string> = { href, target: '_blank', rel: 'noopener' }
  if (className) attributes.class = className
  return makeNode({ id, tagName: 'a', elementType: 'text', content, attributes })
}

function mapNode(): StructureNode {
  const legend = makeNode({
    id: 'project-map-legend',
    tagName: 'div',
    elementType: 'container',
    _repeat: { source: LEGEND_SOURCE },
    attributes: { class: 'project-map-legend', 'data-map-legend': '', role: 'group', 'aria-label': 'Что рядом' },
    metadata: { name: 'Легенда (повтор по mapLegend)' },
    children: [
      makeNode({
        id: 'project-map-filter',
        tagName: 'button',
        elementType: 'container',
        attributes: { type: 'button', class: 'project-map-filter', 'data-map-filter': '{{$.type}}' },
        styles: { properties: { '--map-color': '{{$.color}}' } },
        metadata: { name: 'Тип места' },
        children: [
          // html-code: генератор выводит содержимое как есть — это готовый <svg>
          // из встроенного набора estate-service (services/mapIcons.ts).
          makeNode({
            id: 'project-map-filter-icon',
            tagName: 'span',
            elementType: 'html-code',
            content: '{{$.icon}}',
            attributes: { class: 'project-map-filter-icon', 'data-map-icon': '', 'aria-hidden': 'true' },
          }),
          text('project-map-filter-name', 'span', 'project-map-filter-name', '{{$.name}}'),
          text('project-map-filter-count', 'span', 'project-map-filter-count', '{{$.count}}'),
        ],
      }),
    ],
  })

  const points = makeNode({
    id: 'project-map-points',
    tagName: 'ul',
    elementType: 'container',
    _repeat: { source: POINTS_SOURCE },
    attributes: { class: 'project-map-points', 'data-map-points': '' },
    metadata: { name: 'Точки (повтор по mapPoints): для диктора и если карта не загрузилась' },
    children: [
      makeNode({
        id: 'project-map-point',
        tagName: 'li',
        elementType: 'container',
        attributes: {
          class: 'project-map-point',
          'data-map-point': '',
          'data-id': '{{$.id}}',
          'data-kind': '{{$.kind}}',
          'data-type': '{{$.type}}',
          'data-lat': '{{$.lat}}',
          'data-lng': '{{$.lng}}',
          'data-color': '{{$.color}}',
          'data-distance': '{{$.distance}}',
        },
        children: [
          text('project-map-point-name', 'span', 'project-map-point-name', '{{$.name}}', { 'data-map-point-name': '' }),
          text('project-map-point-distance', 'span', 'project-map-point-distance', '{{$.distance}}'),
        ],
      }),
    ],
  })

  return makeNode({
    id: 'project-map-repeat',
    tagName: 'div',
    elementType: 'container',
    _repeat: { source: HOUSE_SOURCE },
    metadata: { name: 'Карта проекта (повтор по mapHouse: без точки дома карты нет)' },
    children: [
      makeNode({
        id: 'project-map',
        tagName: 'div',
        elementType: 'container',
        attributes: { class: 'project-map', 'data-map': '' },
        metadata: { name: 'Карта проекта' },
        children: [
          makeNode({
            id: 'project-map-canvas',
            tagName: 'div',
            elementType: 'container',
            attributes: { class: 'project-map-canvas', 'data-map-canvas': '' },
            metadata: { name: 'Холст карты' },
          }),
          legend,
          points,
        ],
      }),
    ],
  })
}

function tripNode(): StructureNode {
  return makeNode({
    id: 'location-trip',
    tagName: 'div',
    elementType: 'container',
    _repeat: { source: OFFICES_SOURCE },
    attributes: { class: 'location-trip' },
    metadata: { name: 'Поездка в отдел продаж (повтор по mapOffices)' },
    children: [
      makeNode({
        id: 'location-trip-links',
        tagName: 'div',
        elementType: 'container',
        attributes: { class: 'location-trip-links' },
        children: [
          makeNode({
            id: 'location-office',
            tagName: 'p',
            elementType: 'container',
            attributes: { class: 'location-office' },
            children: [
              text('location-office-name', 'span', 'location-office-name', '{{$.name}}'),
              text('location-office-address', 'span', 'location-office-address', '{{$.address}}'),
            ],
          }),
          link('location-trip-taxi', 'location-trip-taxi', TAXI_HREF, 'Вызвать такси в отдел продаж'),
          link('location-trip-yandex', '', YANDEX_ROUTE_HREF, 'Маршрут в Яндекс Картах'),
          link('location-trip-google', '', GOOGLE_ROUTE_HREF, 'Маршрут в Google Maps'),
        ],
      }),
    ],
  })
}

// --- Миграция ---

function repeatOf(parent: StructureNode, source: string): StructureNode | undefined {
  return (parent.children ?? []).find((c) => c._repeat?.source === source)
}

function without(parent: StructureNode, child: StructureNode): void {
  parent.children = (parent.children ?? []).filter((c) => c !== child)
}

export function migrateLocationBlock(input: StructureNode): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []

  const visual = findOne(structure, (n) => hasClass(n, 'location-visual'), 'Локация: рамка карты .location-visual')

  const labels = repeatOf(visual, LABELS_SOURCE)
  if (labels) {
    without(visual, labels)
    changes.push('Локация: метки-заглушки в процентах (item.locationLabels) убраны')
  }

  const images = repeatOf(visual, IMAGES_SOURCE)
  const image = images?.children?.[0]
  if (!image) throw new MigrationError('Локация: нет повтора картинки карты item.mapImages с шаблоном')
  if (withClass(image, MAP_IMAGE_CLASS)) changes.push(`Локация: картинке карты добавлен класс ${MAP_IMAGE_CLASS}`)

  if (!repeatOf(visual, HOUSE_SOURCE)) {
    visual.children = [...(visual.children ?? []), mapNode()]
    changes.push('Локация: добавлена карта проекта (mapHouse, mapPoints, mapLegend)')
  }

  const actions = findOne(structure, (n) => hasClass(n, 'location-actions'), 'Локация: кнопки .location-actions')
  const mapLink = (actions.children ?? []).find((c) => c.attributes?.id === 'mapLink')
  if (mapLink) {
    without(actions, mapLink)
    changes.push('Локация: ссылка «Посмотреть на карте» (вела на эту же секцию) убрана')
  }
  if (!repeatOf(actions, OFFICES_SOURCE)) {
    actions.children = [...(actions.children ?? []), tripNode()]
    changes.push('Локация: кнопки такси и маршрутов до отдела продаж (mapOffices)')
  }

  if (upsertCssSection((structure.metadata ??= {}), CSS_HEAD, PROJECT_MAP_CSS_MARKER, PROJECT_MAP_CSS)) {
    changes.push('Локация: CSS карты проекта')
  }

  if (changes.length === 0) return { structure: input, changes, alreadyMigrated: true }
  return { structure, changes, alreadyMigrated: false }
}
