/**
 * Контент проектов, снятый с дизайна коллеги
 * (`Сайт Голден хаус/complex-detail.html` + `index.html#complexes`).
 *
 * Медиа-ссылки — реальные `/media/<uuid>` из медиатеки CMS: почти вся графика
 * дизайна туда уже загружена. Файлы, которых в медиатеке нет, перечислены в
 * `GAPS` и оставлены пустыми — пустое поле рендерится как отсутствие узла
 * (см. `optionalOne` в services/i18n), а не как битая картинка.
 *
 * Чего в дизайне нет вообще (тоже в `GAPS`): квартиры и корпуса всех проектов
 * кроме Do'stlik, тексты секций для Harizma и O'zMakon, координаты меток карты.
 * Ничего из этого не выдумано — пустое значение честнее правдоподобной выдумки
 * на витрине застройщика.
 *
 * Чистый модуль без БД: покрывается тестами, используется seed-design-projects.
 */

/** Пропуск в исходных данных: что именно и почему отсутствует. */
export interface DataGap {
  /** Slug проекта либо '*', если пропуск общий для всех. */
  slug: string
  field: string
  reason: string
}

export interface ApartmentSeed {
  order: number
  rooms: number
  areaM2: number
  price: number
  oldPrice: number | null
  entrance: number
  apartmentClass: string
  badges: string[]
  floor: string
  number: string
  deadline: string
  offerLabel: string
  planImage: string
}

export interface HouseSeed {
  order: number
  name: string
  floors: string
  deadline: string
  className: string
  entrances: number | null
  apartments: ApartmentSeed[]
}

export interface ComplexSeed {
  slug: string
  /** Числовой ID проекта в CRM. null — сопоставление неизвестно из дизайна. */
  externalId: number | null
  order: number
  status: 'active' | 'sold_out'
  name: string
  className: string
  intro: string
  about: string
  aboutTitle: string
  aboutExtra: string
  hallTitle: string
  hallText: string
  address: string
  locationTitle: string
  locationText: string
  locationLabels: Array<{ label: string; accent?: boolean; top: string; left: string }>
  yardEyebrow: string
  yardTitle: string
  yardText: string
  yardFeatures: string[]
  stats: Array<{ value: string; label: string }>
  logo: string
  logoClass: string
  media: string
  aboutVideo: string
  mapUrl: string
  mapImage: string
  panoramaUrl: string
  heroImages: string[]
  gallery: string[]
  hallGallery: string[]
  yardGallery: string[]
  houses: HouseSeed[]
}

// --- Медиатека CMS: имя файла дизайна → URL ассета ---
const M = {
  ozmakonBusinessCard: '/media/21249019-a9a9-4b90-bfef-d2f883388d77.jpg',
  ozmakonBusinessLogo: '/media/7577fdff-94aa-4cad-b071-05a4eaa38b34.png',
  ozmakonBusinessVideo: '/media/0b8fabd1-5f3e-4577-bd2d-955b12bc92c8.mp4',
  ozmakonBusinessYard1: '/media/d4112d79-9362-4256-aaa4-72988cf386d0.png',
  ozmakonBusinessYard2: '/media/60b6dcc6-546d-460a-aa39-214a1d312d48.webp',
  ozmakonBusinessHall1: '/media/656ad47d-e5be-4490-b3ca-ba75fc84c42c.webp',
  ozmakonBusinessHall2: '/media/fc561e7a-ca6f-4180-b16e-0a553d80e199.webp',
  ozmakonBusinessHall3: '/media/73a99934-6fa7-42df-bf28-7e3dd023d55f.png',
  ozmakonBusinessHall4: '/media/38477f21-6134-4fb6-9ef7-bdacea3ad031.png',
  ozmakonBusinessHall5: '/media/fd57183d-8e8d-4f2f-965d-cb99c32b135f.png',
  ozmakonBusinessMap: '/media/182d8b06-623d-4a75-9a2d-3e99f23f1d37.png',
  ozmakonCard: '/media/43278838-d571-477e-b565-ed9aebe60812.jpg',
  dostlikCard: '/media/d65851c0-0bcf-4901-87d7-4d91c77738c3.jpg',
  dostlikWide: '/media/a4eca737-ac2d-4c21-aa39-8d0b5eaa13c4.jpg',
  dostlikLogo: '/media/28f073f7-fac7-44cb-b769-f49786311d57.png',
  dostlikVideo: '/media/7cffe638-73b1-4345-a5a4-8c334107feaa.mp4',
  dostlikHall1: '/media/8bb6939d-c420-4718-b3a3-bb0926a1a6f0.jpg',
  dostlikHall2: '/media/d80c57a7-d8d8-4e65-9959-3041f665e00d.jpg',
  dostlikHall3: '/media/33bf899c-e0af-48f6-a0c0-d9bc77300399.jpg',
  dostlikHall4: '/media/aa18f784-c943-47d7-a237-540a2b676da2.jpg',
  harizmaCard: '/media/e271d545-b5d1-49fe-ab4d-5bf090b2d98e.jpg',
  harizmaWide: '/media/0422455b-6c12-42b7-9764-878fe370faac.jpg',
} as const

/**
 * Демо-квартиры из дизайна. В исходнике это четыре захардкоженные карточки
 * на странице Do'stlik — единственные значения цен, которые вообще есть.
 * Другим проектам не присваиваются: чужие цены хуже, чем их отсутствие.
 */
const DOSTLIK_APARTMENTS: ApartmentSeed[] = [
  { order: 0, rooms: 4, areaM2: 114, price: 1354320000, oldPrice: 1539000000, entrance: 2,
    apartmentClass: 'Бизнес', badges: ['Акция'], floor: '8/9', number: '102',
    deadline: '1 кв. 2028', offerLabel: 'Акция', planImage: '' },
  { order: 1, rooms: 3, areaM2: 78.81, price: 936748269, oldPrice: 1064486670, entrance: 3,
    apartmentClass: 'Бизнес', badges: ['Ипотека'], floor: '2/16', number: '116',
    deadline: '1 кв. 2028', offerLabel: '', planImage: '' },
  { order: 2, rooms: 3, areaM2: 65.41, price: 871240268, oldPrice: 990045760, entrance: 3,
    apartmentClass: 'Бизнес', badges: ['Рассрочка'], floor: '4/16', number: '139',
    deadline: '1 кв. 2028', offerLabel: 'Последняя планировка', planImage: '' },
  { order: 3, rooms: 4, areaM2: 114.54, price: 1441371360, oldPrice: 1637922000, entrance: 2,
    apartmentClass: 'Бизнес', badges: ['Ипотека'], floor: '2/9', number: '66',
    deadline: '1 кв. 2028', offerLabel: '', planImage: '' },
]

export const COMPLEXES: ComplexSeed[] = [
  {
    slug: 'ozmakon-business',
    externalId: null,
    order: 0,
    status: 'active',
    name: "O'zMakon Business",
    className: 'Бизнес',
    intro: 'Бизнес-квартал Golden House с выразительной европейской архитектурой и приватной городской средой.',
    about: 'Мастер-план от голландского бюро De Architekten Cie. Разновысотная застройка и выразительные европейские фасады вдохновлены традиционной мозаикой и тёплой палитрой архитектуры Центральной Азии.',
    aboutTitle: 'О проекте',
    aboutExtra: 'Геометрия фасадов сочетает различные объёмы и материалы: глазурованную плитку, высококачественную итальянскую штукатурку и композитные панели.',
    hallTitle: 'Дизайнерские холлы',
    hallText: '',
    address: 'г. Ташкент, Фаргона йули, 50',
    locationTitle: 'Территория большой жизни',
    locationText: 'Проект расположен по адресу Фаргона йули, 50. До Tashkent City Mall и метро Машиностроительный около 15 минут, рядом городские маршруты, коммерция и повседневная инфраструктура.',
    // Дизайн при наличии mapImage удаляет метки — карта уже размечена сама.
    locationLabels: [],
    yardEyebrow: 'Двор без машин',
    yardTitle: 'Благоустройство',
    yardText: 'Закрытый зеленый двор без машин создает спокойное пространство для прогулок, отдыха и ежедневной активности. Внутри предусмотрены семейные сценарии: от детских площадок с теневыми навесами до фитнеса, беседок и BBQ-зоны.',
    yardFeatures: ['Закрытый зеленый двор', 'BBQ-зона', 'Детские площадки с навесами', 'Частный детский сад', 'Kids Room', 'Фитнес-зал', 'Беседки'],
    stats: [],
    logo: M.ozmakonBusinessLogo,
    logoClass: '',
    media: M.ozmakonBusinessCard,
    aboutVideo: M.ozmakonBusinessVideo,
    mapUrl: 'https://yandex.uz/maps/10335/tashkent/house/farg_ona_yo_li_50/YkAYdA5pS0YHQFprfX54cXVqYw==/?ll=69.300287%2C41.290709&z=18',
    mapImage: M.ozmakonBusinessMap,
    panoramaUrl: '',
    // heroImages дизайна (ozmakon-business-hero-1/2.jpg) в медиатеку не загружены —
    // до загрузки герой берёт карточку каталога, чтобы секция не осталась пустой.
    heroImages: [M.ozmakonBusinessCard],
    gallery: [],
    hallGallery: [M.ozmakonBusinessHall1, M.ozmakonBusinessHall2, M.ozmakonBusinessHall3, M.ozmakonBusinessHall4, M.ozmakonBusinessHall5],
    // yard-3.jpg отсутствует в медиатеке — в галерее два кадра из трёх.
    yardGallery: [M.ozmakonBusinessYard1, M.ozmakonBusinessYard2],
    houses: [],
  },
  {
    slug: 'assalom-dostlik',
    externalId: null,
    order: 1,
    status: 'active',
    name: "Assalom Do'stlik",
    className: 'Комфорт+',
    intro: 'Комплекс с закрытой территорией, прогулочными зонами, отделкой в подарок и удобным доступом к городским сервисам.',
    about: 'Каждая деталь в Assalom Do’stlik продумана так, чтобы обеспечить вам не только комфорт и безопасность, но и эстетическое удовольствие. Современный дизайн комплекса, состоящий из нескольких 16-этажных зданий, гармонично сочетается с окружающим пейзажем, создавая неповторимый облик и атмосферу.',
    aboutTitle: 'О проекте',
    aboutExtra: 'Все квартиры в нашем комплексе спроектированы с учетом потребностей современного жителя мегаполиса. Грамотная и правильная планировка делают каждый уголок вашей квартиры не просто функциональным, но и визуально привлекательным.',
    hallTitle: 'Дизайнерские холлы',
    hallText: 'Входные группы выдержаны в спокойной цветовой гамме с применением современных материалов. Холл работает как приватный переход между городом и домом.',
    address: 'г. Ташкент, современный жилой квартал Golden House',
    locationTitle: 'Территория большой жизни',
    locationText: 'Проект расположен в городской среде с удобным доступом к транспорту, сервисам, образовательным и коммерческим объектам.',
    locationLabels: [
      { label: 'Golden House', accent: true, top: '46%', left: '58%' },
      { label: 'Парк', top: '31%', left: '17%' },
      { label: 'Школа', top: '22%', left: '42%' },
      { label: 'Бизнес-центр', top: '64%', left: '70%' },
      { label: 'Метро', top: '70%', left: '32%' },
    ],
    yardEyebrow: 'Дворовое пространство',
    yardTitle: 'Дворовое пространство',
    yardText: 'Современные спортивные зоны внутри дворов позволяют заниматься фитнесом и проводить время рядом с домом. Детские площадки и прогулочные маршруты дают разные сценарии ежедневной активности.',
    yardFeatures: [],
    stats: [
      { value: 'Комфорт+', label: 'Класс жилья' },
      { value: '16', label: 'Этажей' },
      { value: '3 м', label: 'Высота потолков' },
      { value: '85+', label: 'Помещения под бизнес' },
      { value: 'С отделкой', label: 'Ремонт в подарок' },
    ],
    logo: M.dostlikLogo,
    logoClass: 'logo-dostlik',
    media: M.dostlikWide,
    aboutVideo: M.dostlikVideo,
    mapUrl: '',
    mapImage: '',
    panoramaUrl: '',
    heroImages: [M.dostlikCard, M.dostlikWide],
    gallery: [],
    hallGallery: [M.dostlikHall1, M.dostlikHall2, M.dostlikHall3, M.dostlikHall4],
    yardGallery: [],
    houses: [
      { order: 0, name: 'Корпус 9 этажей', floors: '9', deadline: '1 кв. 2028', className: 'Бизнес', entrances: 2,
        apartments: DOSTLIK_APARTMENTS.filter((a) => a.floor.endsWith('/9')) },
      { order: 1, name: 'Корпус 16 этажей', floors: '16', deadline: '1 кв. 2028', className: 'Бизнес', entrances: 3,
        apartments: DOSTLIK_APARTMENTS.filter((a) => a.floor.endsWith('/16')) },
    ],
  },
  {
    slug: 'harizma',
    externalId: null,
    order: 2,
    status: 'active',
    name: 'Harizma',
    className: 'Бизнес',
    intro: 'Выразительный бизнес-класс с современной архитектурой, приватными зонами и удобной локацией.',
    about: 'Harizma представляет бизнес-сегмент Golden House: продуманные планировки, благоустроенные дворы, надежные инженерные решения и сценарии для комфортной городской жизни.',
    aboutTitle: 'О проекте',
    aboutExtra: '',
    hallTitle: '',
    hallText: '',
    address: '',
    locationTitle: 'Территория большой жизни',
    locationText: 'Проект расположен в городской среде с удобным доступом к транспорту, сервисам, образовательным и коммерческим объектам.',
    locationLabels: [],
    yardEyebrow: '',
    yardTitle: '',
    yardText: '',
    yardFeatures: [],
    stats: [],
    logo: '',
    logoClass: '',
    media: M.harizmaWide,
    aboutVideo: '',
    mapUrl: '',
    mapImage: '',
    panoramaUrl: '',
    heroImages: [M.harizmaCard, M.harizmaWide],
    gallery: [],
    hallGallery: [],
    yardGallery: [],
    houses: [],
  },
  {
    slug: 'ozmakon',
    externalId: null,
    order: 3,
    status: 'sold_out',
    name: "O'zMakon",
    className: 'Бизнес',
    intro: 'Городской проект с продуманными дворами, удобными сценариями жизни и надежной инфраструктурой.',
    about: "O'zMakon представляет бизнес-сегмент Golden House: продуманные планировки, благоустроенные дворы, надежные инженерные решения и сценарии для комфортной городской жизни.",
    aboutTitle: 'О проекте',
    aboutExtra: '',
    hallTitle: '',
    hallText: '',
    address: '',
    locationTitle: 'Территория большой жизни',
    locationText: 'Проект расположен в городской среде с удобным доступом к транспорту, сервисам, образовательным и коммерческим объектам.',
    locationLabels: [],
    yardEyebrow: '',
    yardTitle: '',
    yardText: '',
    yardFeatures: [],
    stats: [],
    logo: '',
    logoClass: '',
    media: M.ozmakonCard,
    aboutVideo: '',
    mapUrl: '',
    mapImage: '',
    panoramaUrl: '',
    heroImages: [M.ozmakonCard],
    gallery: [],
    hallGallery: [],
    yardGallery: [],
    houses: [],
  },
]

/**
 * Пропуски в исходных данных. Печатается сидом после записи, чтобы список
 * «что дозаполнить руками» не терялся в коде.
 */
export const GAPS: DataGap[] = [
  { slug: '*', field: 'externalId',
    reason: 'числовые ID в CRM в дизайне отсутствуют — проставить вручную, без них запрос квартир уйдёт без фильтра' },
  { slug: 'ozmakon-business', field: 'heroImages',
    reason: 'hero-1.jpg и hero-2.jpg (12 и 13 МБ) не загружены в медиатеку CMS — временно карточка каталога' },
  { slug: 'ozmakon-business', field: 'yardGallery',
    reason: 'yard-3.jpg (13 МБ) не загружен в медиатеку — 2 кадра из 3' },
  { slug: 'ozmakon-business', field: 'stats',
    reason: 'в дизайне нет — страница падала на дефолтные «9 и 16 / 3 м / 85+»' },
  { slug: 'ozmakon-business', field: 'hallText',
    reason: 'в дизайне нет текста секции холлов, только галерея' },
  { slug: 'ozmakon-business', field: 'houses / apartments',
    reason: 'квартир и корпусов в дизайне нет; демо-карточки принадлежат Do’stlik' },
  { slug: 'assalom-dostlik', field: 'yardGallery / yardFeatures',
    reason: 'в дизайне нет — секция двора остаётся без фото и чипсов' },
  { slug: 'assalom-dostlik', field: 'mapImage / mapUrl',
    reason: 'в дизайне нет — карта остаётся схематичной с метками' },
  { slug: 'assalom-dostlik', field: 'apartments[].planImage',
    reason: 'планировок в дизайне нет — карточки показывают CSS-заглушку' },
  { slug: 'harizma', field: 'весь контент секций',
    reason: 'в дизайне только карточка каталога: имя, класс, интро. Тексты about/hall/yard/адрес отсутствуют' },
  { slug: 'harizma', field: 'медиа',
    reason: 'есть только project-harizma-card.jpg и project-harizma.jpg' },
  { slug: 'harizma', field: 'houses / apartments', reason: 'в дизайне нет' },
  { slug: 'ozmakon', field: 'весь контент секций',
    reason: 'то же, что Harizma: только карточка каталога. В каталоге помечен Sold out' },
  { slug: 'ozmakon', field: 'медиа', reason: 'есть только project-ozmakon-card.jpg' },
  { slug: 'ozmakon', field: 'houses / apartments', reason: 'в дизайне нет' },
]
