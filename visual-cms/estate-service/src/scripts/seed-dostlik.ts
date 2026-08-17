/**
 * Seed «Assalom Doʼstlik» — контент извлечён из живой страницы /adostlik
 * (test_analytics.gh.uz) и статического complex-detail.html.
 *
 * Идемпотентно: по slug удаляет прежний ЖК (каскад домов/квартир по FK) и его
 * переводы, затем создаёт заново. ru — базовые поля; uz/en — оверлей-строки
 * (частично, чтобы продемонстрировать фолбэк на ru для непереведённых полей).
 *
 * Запуск: npm run seed:dostlik
 */
import 'dotenv/config'
import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { runSafeMigrations } from '../migrations/runner'
import { Complex } from '../models/Complex'
import { House } from '../models/House'
import { Apartment } from '../models/Apartment'
import { EstateTranslation } from '../models/EstateTranslation'
import { logger } from '../services/Logger'

const SLUG = 'assalom-dostlik'

async function seed(): Promise<void> {
  await AppDataSource.initialize()
  await runSafeMigrations(AppDataSource)

  await AppDataSource.transaction(async (m) => {
    // --- Идемпотентность: снести прежний ЖК + переводы ---
    const prev = await m.getRepository(Complex).findOne({
      where: { slug: SLUG },
      relations: { houses: { apartments: true } },
    })
    if (prev) {
      const ids = [
        prev.id,
        ...prev.houses.map((h) => h.id),
        ...prev.houses.flatMap((h) => h.apartments.map((a) => a.id)),
      ]
      await m.getRepository(EstateTranslation).delete({ entityId: In(ids) })
      await m.getRepository(Complex).delete({ id: prev.id }) // FK ON DELETE CASCADE
      logger.info('Removed previous Doʼstlik', { houses: prev.houses.length })
    }

    // --- Complex (ru = база) ---
    const complex = await m.getRepository(Complex).save(
      m.getRepository(Complex).create({
        slug: SLUG,
        order: 0,
        status: 'active',
        name: "Assalom Doʼstlik",
        className: 'Бизнес',
        intro:
          'Современный жилой комплекс с закрытой территорией, прогулочными зонами и удобным доступом к городским сервисам.',
        about:
          'Жилой комплекс объединяет приватные дворы, спокойную архитектуру и удобную инфраструктуру для ежедневной жизни. Здесь продуманы маршруты, парковка, коммерческие помещения на первых этажах и безопасные входные группы.',
        aboutExtra:
          'Проект создан для тех, кто хочет жить рядом с городскими сервисами, но сохранять ощущение личного пространства.',
        locationText:
          'Комплекс расположен рядом с основными городскими маршрутами, школами, парками и повседневными сервисами. До центра легко добраться на автомобиле или общественном транспорте.',
        yardEyebrow: 'Дворовое пространство',
        yardTitle: 'Дворовое пространство',
        yardText:
          'Современные спортивные зоны внутри дворов позволяют заниматься фитнесом и проводить время рядом с домом. Детские площадки и прогулочные маршруты дают разные сценарии ежедневной активности.',
        yardFeatures: [],
        stats: [
          { value: 'Бизнес', label: 'Класс жилья' },
          { value: '9 и 16', label: 'Этажей' },
          { value: '3 м', label: 'Высота потолка' },
          { value: '85+', label: 'Помещения под бизнес' },
        ],
        logo: '',
        logoClass: '',
        media: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=84',
        aboutVideo: '/media/7cffe638-73b1-4345-a5a4-8c334107feaa.mp4',
        mapUrl: '',
        mapImage: '',
        heroImages: [
          'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1900&q=84',
          '/media/d65851c0-0bcf-4901-87d7-4d91c77738c3.jpg',
        ],
        gallery: [],
        hallGallery: [
          'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=84',
        ],
        yardGallery: [
          'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=84',
        ],
      })
    )

    // --- Houses (2 корпуса: 9-эт и 16-эт) ---
    const house9 = await m.getRepository(House).save(
      m.getRepository(House).create({
        complexId: complex.id,
        order: 0,
        name: 'Корпус 9 этажей',
        floors: '9',
        deadline: '1 кв. 2028',
        className: 'Бизнес',
        entrances: 2,
      })
    )
    const house16 = await m.getRepository(House).save(
      m.getRepository(House).create({
        complexId: complex.id,
        order: 1,
        name: 'Корпус 16 этажей',
        floors: '16',
        deadline: '1 кв. 2028',
        className: 'Бизнес',
        entrances: 3,
      })
    )

    // --- Apartments (глобальный order = порядок карточек в живом гриде) ---
    const apartments = await m.getRepository(Apartment).save([
      m.getRepository(Apartment).create({
        houseId: house9.id, order: 0, rooms: 4, areaM2: 114, price: 1354320000, oldPrice: 1539000000,
        entrance: 2, apartmentClass: 'Бизнес', badges: ['Акция'], floor: '8/9', number: '102',
        deadline: '1 кв. 2028', offerLabel: 'Акция', status: 'available', planImage: '',
      }),
      m.getRepository(Apartment).create({
        houseId: house16.id, order: 1, rooms: 3, areaM2: 78.81, price: 936748269, oldPrice: 1064486670,
        entrance: 3, apartmentClass: 'Бизнес', badges: ['Ипотека'], floor: '2/16', number: '116',
        deadline: '1 кв. 2028', offerLabel: '', status: 'available', planImage: '',
      }),
      m.getRepository(Apartment).create({
        houseId: house16.id, order: 2, rooms: 3, areaM2: 65.41, price: 871240268, oldPrice: 990045760,
        entrance: 3, apartmentClass: 'Бизнес', badges: ['Рассрочка'], floor: '4/16', number: '139',
        deadline: '1 кв. 2028', offerLabel: 'Последняя планировка', status: 'available', planImage: '',
      }),
      m.getRepository(Apartment).create({
        houseId: house9.id, order: 3, rooms: 4, areaM2: 114.54, price: 1441371360, oldPrice: 1637922000,
        entrance: 2, apartmentClass: 'Бизнес', badges: ['Ипотека'], floor: '2/9', number: '66',
        deadline: '1 кв. 2028', offerLabel: '', status: 'available', planImage: '',
      }),
    ])

    // --- Переводы (uz/en). Длинные about/aboutExtra намеренно НЕ переводим на uz,
    //     чтобы наглядно показать фолбэк на ru. ---
    const tr: Array<Partial<EstateTranslation>> = []
    const add = (
      entityType: string,
      entityId: string,
      locale: string,
      field: string,
      value: string
    ) => tr.push({ entityType, entityId, locale, field, value })
    const j = (v: unknown) => JSON.stringify(v)

    // Complex — en
    add('complex', complex.id, 'en', 'className', 'Business')
    add('complex', complex.id, 'en', 'intro',
      'A modern residential complex with a gated territory, walking areas and easy access to city services.')
    add('complex', complex.id, 'en', 'about',
      'The complex combines private courtyards, calm architecture and convenient everyday infrastructure: thought-out routes, parking, retail on the ground floors and safe entrance groups.')
    add('complex', complex.id, 'en', 'aboutExtra',
      'Designed for those who want to live close to city services while keeping a sense of personal space.')
    add('complex', complex.id, 'en', 'locationText',
      'The complex sits next to the main city routes, schools, parks and everyday services. The center is easy to reach by car or public transport.')
    add('complex', complex.id, 'en', 'yardEyebrow', 'Courtyard space')
    add('complex', complex.id, 'en', 'yardTitle', 'Courtyard space')
    add('complex', complex.id, 'en', 'yardText',
      'Modern sports zones inside the courtyards let you keep fit and spend time near home. Playgrounds and walking routes offer different daily activity scenarios.')
    add('complex', complex.id, 'en', 'stats', j([
      { value: 'Business', label: 'Housing class' },
      { value: '9 and 16', label: 'Floors' },
      { value: '3 m', label: 'Ceiling height' },
      { value: '85+', label: 'Business premises' },
    ]))

    // Complex — uz (без about/aboutExtra → фолбэк на ru)
    add('complex', complex.id, 'uz', 'className', 'Biznes')
    add('complex', complex.id, 'uz', 'intro',
      "Yopiq hududi, sayr zonalari va shahar xizmatlariga qulay yo'li bo'lgan zamonaviy turar-joy majmuasi.")
    add('complex', complex.id, 'uz', 'locationText',
      "Majmua asosiy shahar yo'nalishlari, maktablar, bog'lar va kundalik xizmatlar yonida joylashgan. Markazga avtomobil yoki jamoat transportida oson yetib borish mumkin.")
    add('complex', complex.id, 'uz', 'yardEyebrow', 'Hovli maydoni')
    add('complex', complex.id, 'uz', 'yardTitle', 'Hovli maydoni')
    add('complex', complex.id, 'uz', 'yardText',
      "Hovlilardagi zamonaviy sport zonalari uy yonida fitnes bilan shug'ullanish va vaqt o'tkazish imkonini beradi. Bolalar maydonchalari va sayr yo'llari turli kunlik faoliyat ssenariylarini beradi.")
    add('complex', complex.id, 'uz', 'stats', j([
      { value: 'Biznes', label: 'Uy-joy sinfi' },
      { value: '9 va 16', label: 'Qavatlar' },
      { value: '3 m', label: 'Shift balandligi' },
      { value: '85+', label: 'Biznes uchun xonalar' },
    ]))

    // Houses
    for (const h of [house9, house16]) {
      add('house', h.id, 'en', 'className', 'Business')
      add('house', h.id, 'en', 'deadline', 'Q1 2028')
      add('house', h.id, 'uz', 'className', 'Biznes')
      add('house', h.id, 'uz', 'deadline', '2028 1-chorak')
    }
    add('house', house9.id, 'en', 'name', 'Building, 9 floors')
    add('house', house16.id, 'en', 'name', 'Building, 16 floors')
    add('house', house9.id, 'uz', 'name', '9 qavatli bino')
    add('house', house16.id, 'uz', 'name', '16 qavatli bino')

    // Apartments
    const badgeEn: Record<string, string> = { Акция: 'Promo', Ипотека: 'Mortgage', Рассрочка: 'Installment' }
    const badgeUz: Record<string, string> = { Акция: 'Aksiya', Ипотека: 'Ipoteka', Рассрочка: "Bo'lib to'lash" }
    const offerEn: Record<string, string> = { Акция: 'Promo', 'Последняя планировка': 'Last layout' }
    const offerUz: Record<string, string> = { Акция: 'Aksiya', 'Последняя планировка': "So'nggi planirovka" }
    for (const a of apartments) {
      add('apartment', a.id, 'en', 'apartmentClass', 'Business')
      add('apartment', a.id, 'uz', 'apartmentClass', 'Biznes')
      add('apartment', a.id, 'en', 'deadline', 'Q1 2028')
      add('apartment', a.id, 'uz', 'deadline', '2028 1-chorak')
      add('apartment', a.id, 'en', 'badges', j(a.badges.map((b) => badgeEn[b] || b)))
      add('apartment', a.id, 'uz', 'badges', j(a.badges.map((b) => badgeUz[b] || b)))
      if (a.offerLabel) {
        add('apartment', a.id, 'en', 'offerLabel', offerEn[a.offerLabel] || a.offerLabel)
        add('apartment', a.id, 'uz', 'offerLabel', offerUz[a.offerLabel] || a.offerLabel)
      }
    }

    await m.getRepository(EstateTranslation).save(tr)
    logger.info('Seeded Doʼstlik', {
      complex: complex.slug,
      houses: 2,
      apartments: apartments.length,
      translations: tr.length,
    })
  })

  await AppDataSource.destroy()
}

seed()
  .then(() => {
    logger.info('Seed complete')
    process.exit(0)
  })
  .catch((err) => {
    logger.error('Seed failed', err instanceof Error ? err : undefined)
    process.exit(1)
  })
