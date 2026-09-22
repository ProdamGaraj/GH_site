/**
 * Тексты проектов из «Сайт проекты.xlsx» (файл заказчика).
 *
 * СГЕНЕРИРОВАНО скриптом `import-project-book.ts` — правки руками затрутся при
 * следующем импорте. Меняйте исходный xlsx и перезапускайте генератор:
 *   npx ts-node src/scripts/import-project-book.ts
 *
 * ru — базовые значения полей Complex, uz — оверлей для estate_translations
 * (jsonb-поля кладутся строкой JSON, как ожидает services/i18n).
 * Листы без данных сюда не попадают: пустое значение честнее выдумки.
 */

/** Поля Complex, которые ведёт заказчик в книге. Все опциональны: лист может быть неполным. */
export interface ProjectTexts {
  intro?: string
  aboutTitle?: string
  about?: string
  aboutExtra?: string
  yardTitle?: string
  yardText?: string
  hallTitle?: string
  hallText?: string
  locationTitle?: string
  locationText?: string
  stats?: Array<{ value: string; label: string }>
  yardFeatures?: string[]
}

export interface ProjectContent {
  /** Базовые значения (язык по умолчанию — ru). */
  ru: ProjectTexts
  /** Оверлей для estate_translations. */
  uz: ProjectTexts
}

export const PROJECT_CONTENT: Record<string, ProjectContent> = {
  "ozmakon-business": {
    ru: {
      intro: "Бизнес-квартал Golden House с выразительной европейской архитектурой и приватной городской средой",
      stats: [
        {
          value: "Бизнес",
          label: "Класс жилья"
        },
        {
          value: "9 и 16",
          label: "Этажей"
        },
        {
          value: "3 м",
          label: "Высота потолка"
        },
        {
          value: "85+",
          label: "Помещения под бизнес"
        }
      ],
      aboutTitle: "О проекте",
      about: "Мастер-план от голландского бюро De Architekten Cie. Разновысотная застройка и выразительные европейские фасады вдохновлены традиционной мозаикой и тёплой палитрой архитектуры Центральной Азии.",
      aboutExtra: "Геометрия фасадов сочетает различные объёмы и материалы: глазурованную плитку, высококачественную итальянскую штукатурку и композитные панели.",
      yardTitle: "Благоустройство",
      yardText: "Закрытый зеленый двор без машин создает спокойное пространство для прогулок, отдыха и ежедневной активности. Внутри предусмотрены семейные сценарии: от детских площадок с теневыми навесами до фитнеса, беседок и BBQ-зоны.",
      yardFeatures: [
        "Закрытый зеленый двор",
        "BBQ-зона",
        "Детские площадки с навесами",
        "Частный детский сад",
        "Kids Room",
        "Фитнес-зал",
        "Беседки"
      ],
      hallTitle: "Дизайнерские холлы",
      hallText: "Входные группы выдержаны в спокойной цветовой гамме с применением современных материалов. Холл работает как приватный переход между городом и домом.",
      locationTitle: "Территория большой жизни",
      locationText: "Проект расположен по адресу Фаргона йули, 50. До Tashkent City Mall и метро Машиностроительный около 15 минут, рядом городские маршруты, коммерция и повседневная инфраструктура.",
    },
    uz: {
      intro: "O‘ziga xos Yevropa arxitekturasi va shaxsiy shahar muhitiga ega Golden House biznes-kvartali",
      stats: [
        {
          value: "Biznes",
          label: "Turar joy toifasi"
        },
        {
          value: "9 va 16",
          label: "Qavat"
        },
        {
          value: "3 m",
          label: "Shift balandligi"
        },
        {
          value: "85+",
          label: "Biznes uchun maydonlar"
        }
      ],
      aboutTitle: "Loyiha haqida",
      about: "Gollandiyaning De Architekten Cie byurosi tomonidan ishlab chiqilgan bosh reja. Turli balandlikdagi binolar va o‘ziga xos Yevropa fasadlari an’anaviy mozaika hamda Markaziy Osiyo arxitekturasining iliq ranglar palitrasidan ilhomlangan.",
      aboutExtra: "Fasad geometriyasi turli hajmlar va materiallarni uyg‘unlashtiradi: sirlangan koshinlar, yuqori sifatli Italiya suvog‘i va kompozit panellar.",
      yardTitle: "Obodonlashtirish",
      yardText: "Avtomobillarsiz yopiq yashil hovli sayr qilish, dam olish va kundalik faoliyat uchun sokin muhit yaratadi. Ichki hududda oilaviy hordiq uchun barcha sharoitlar ko‘zda tutilgan: soyabonli bolalar maydonchalaridan tortib fitnes, suhbatgohlar va BBQ zonasigacha.",
      yardFeatures: [
        "Yopiq yashil hovli",
        "BBQ zonasi",
        "Soyabonli bolalar maydonchalari",
        "Xususiy bolalar bog‘chasi",
        "Kids Room",
        "Fitnes zali",
        "Suhbatgohlar"
      ],
      hallTitle: "Dizaynerlik xollari",
      hallText: "Kirish guruhlari zamonaviy materiallar qo‘llangan holda osoyishta ranglar uyg‘unligida bezatilgan. Xoll shahar va xonadon o‘rtasida shaxsiy o‘tish hududi vazifasini bajaradi.",
      locationTitle: "Katta hayot hududi",
      locationText: "Loyiha Farg‘ona yo‘li, 50 manzilida joylashgan. Tashkent City Mall va Mashinasozlar metrosigacha taxminan 15 daqiqa, yaqin atrofda shahar yo‘nalishlari, savdo va kundalik infratuzilma mavjud.",
    },
  },
  "assalom-dostlik": {
    ru: {
      intro: "Комплекс с закрытой территорией, прогулочными зонами, отделкой в подарок и удобным доступом к городским сервисам.",
      stats: [
        {
          value: "Комфорт+",
          label: "Класс жилья"
        },
        {
          value: "16",
          label: "Этажей"
        },
        {
          value: "3 м",
          label: "Высота потолков"
        },
        {
          value: "85+",
          label: "Помещения под бизнес"
        },
        {
          value: "С отделкой",
          label: "Ремонт в подарок"
        }
      ],
      aboutTitle: "О проекте",
      about: "Каждая деталь в Assalom Do’stlik продумана так, чтобы обеспечить вам не только комфорт и безопасность, но и эстетическое удовольствие. Современный дизайн комплекса, состоящий из нескольких 16-этажных зданий, гармонично сочетается с окружающим пейзажем, создавая неповторимый облик и атмосферу.",
      aboutExtra: "Все квартиры в нашем комплексе спроектированы с учетом потребностей современного жителя мегаполиса. Грамотная и правильная планировка делают каждый уголок вашей квартиры не просто функциональным, но и визуально привлекательным.",
      yardTitle: "Дворовое пространство",
      yardText: "Современные спортивные зоны внутри дворов позволяют заниматься фитнесом и проводить время рядом с домом. Детские площадки и прогулочные маршруты дают разные сценарии ежедневной активности.",
      hallTitle: "Дизайнерские холлы",
      hallText: "Входные группы выдержаны в спокойной цветовой гамме с применением современных материалов. Холл работает как приватный переход между городом и домом.",
      locationTitle: "Территория большой жизни",
      locationText: "Проект расположен в городской среде с удобным доступом к транспорту, сервисам, образовательным и коммерческим объектам.",
    },
    uz: {
      intro: "Yopiq hudud, sayr zonalari, sovg‘a tariqasidagi ta’mir va shahar xizmatlariga qulay kirish imkoniyatiga ega majmua.",
      stats: [
        {
          value: "Komfort+",
          label: "Turar joy toifasi"
        },
        {
          value: "16",
          label: "Qavat"
        },
        {
          value: "3 m",
          label: "Shift balandligi"
        },
        {
          value: "85+",
          label: "Biznes uchun maydonlar"
        },
        {
          value: "Pardozlangan",
          label: "Ta’mir sovg‘a sifatida"
        }
      ],
      aboutTitle: "Loyiha haqida",
      about: "Assalom Do’stlik’dagi har bir detal sizga nafaqat qulaylik va xavfsizlik, balki estetik zavq bag‘ishlash uchun ham puxta o‘ylangan. Bir nechta 16 qavatli binolardan iborat majmuaning zamonaviy dizayni atrof-muhit landshafti bilan uyg‘unlashib, betakror qiyofa va muhit yaratadi.",
      aboutExtra: "Majmuamizdagi barcha xonadonlar zamonaviy megapolis aholisining ehtiyojlarini hisobga olgan holda loyihalashtirilgan. Puxta va to‘g‘ri rejalashtirish xonadoningizning har bir burchagini nafaqat funksional, balki ko‘rinish jihatidan ham jozibador qiladi.",
      yardTitle: "Hovli maydoni",
      yardText: "Hovli ichidagi zamonaviy sport zonalari fitnes bilan shug‘ullanish va uyingiz yonida vaqt o‘tkazish imkonini beradi. Bolalar maydonchalari va sayr yo‘laklari kundalik faollik uchun turli xil ssenariylarni taqdim etadi.",
      hallTitle: "Dizaynerlik xollari",
      hallText: "Kirish guruhlari zamonaviy materiallar qo‘llangan holda osoyishta ranglar uyg‘unligida bezatilgan. Xoll shahar va xonadon o‘rtasida shaxsiy o‘tish hududi vazifasini bajaradi.",
      locationTitle: "Katta hayot hududi",
      locationText: "Loyiha transport, xizmat ko‘rsatish, ta’lim va tijorat ob’yektlariga qulay chiqish imkoniyatiga ega bo‘lgan shahar muhitida joylashgan.",
    },
  },
  "harizma": {
    ru: {
      intro: "Жилой квартал бизнес-класса Golden House с зелёной территорией без машин и квартирами с готовой отделкой",
      stats: [
        {
          value: "Бизнес",
          label: "Класс жилья"
        },
        {
          value: "12–16",
          label: "Этажей"
        },
        {
          value: "3 м",
          label: "Высота потолков"
        },
        {
          value: "Готовая отделка",
          label: "Квартиры с ремонтом"
        }
      ],
      aboutTitle: "О проекте",
      about: "Harizma — жилой квартал бизнес-класса от Golden House, созданный как зелёное пространство внутри динамичного города. Разновысотная архитектура от 12 до 16 этажей формирует современный городской силуэт, а территория комплекса спроектирована с акцентом на комфорт пешеходов и приватность жителей.",
      aboutExtra: "Квартиры передаются с готовой отделкой: при сдаче предусмотрены отделка, двери и сантехника.",
      yardTitle: "Дворовое пространство",
      yardText: "Harizma создан как жилой квартал без машин. Внутри предусмотрены прогулочный бульвар, зелёные лужайки, детские и спортивные площадки, спокойные зоны отдыха и пространства для BBQ. Такое решение позволяет отдать территорию квартала людям, а не автомобилям.",
      yardFeatures: [
        "Территория без машин",
        "Прогулочный бульвар",
        "Зелёные зоны",
        "Детские площадки",
        "Спортивные площадки",
        "BBQ-зоны",
        "Готовая отделка"
      ],
      hallTitle: "Дизайнерские холлы",
      hallText: "Современные входные группы продолжают архитектурную концепцию Harizma. Спокойная цветовая гамма и продуманное пространство формируют комфортный переход от общественной территории квартала к приватному пространству дома.",
      locationTitle: "В центре активной жизни",
      locationText: "Harizma расположен в Яшнабадском районе Ташкента, рядом с парком Ашхабад и Central Park. Расположение обеспечивает удобный доступ к основным городским маршрутам, местам отдыха и повседневной инфраструктуре.",
    },
    uz: {
      intro: "Golden House’ning avtomobillarsiz yashil hududi va tayyor ta’mirlangan xonadonlariga ega biznes-klass turar joy kvartali",
      stats: [
        {
          value: "Biznes",
          label: "Turar joy toifasi"
        },
        {
          value: "12–16",
          label: "Qavat"
        },
        {
          value: "3 m",
          label: "Shift balandligi"
        },
        {
          value: "Tayyor ta’mir",
          label: "Ta’mirlangan xonadonlar"
        }
      ],
      about: "Harizma — Golden House tomonidan yaratilgan biznes-klass turar joy kvartali bo‘lib, dinamik shahar ichidagi yashil makon konsepsiyasiga asoslangan. 12 dan 16 qavatgacha bo‘lgan turli balandlikdagi arxitektura zamonaviy shahar qiyofasini shakllantiradi, majmua hududida esa piyodalar qulayligi va aholining shaxsiy makoniga alohida e’tibor qaratilgan.",
      aboutExtra: "Xonadonlar tayyor ta’mirlangan holda topshiriladi: ta’mir, eshiklar va santexnika tayyor bo‘ladi.",
      yardTitle: "Hovli maydoni",
      yardText: "Harizma avtomobillarsiz turar joy kvartali sifatida yaratilgan. Ichki hududda sayr xiyoboni, yashil maysazorlar, bolalar va sport maydonchalari, sokin dam olish hamda BBQ zonalari ko‘zda tutilgan. Bunday yechim kvartal hududini avtomobillarga emas, insonlarga bag‘ishlash imkonini beradi.",
      yardFeatures: [
        "Avtomobillarsiz hudud",
        "Sayr xiyoboni",
        "Yashil hududlar",
        "Bolalar maydonchalari",
        "Sport maydonchalari",
        "BBQ zonalari",
        "Tayyor ta’mir"
      ],
      hallTitle: "Dizaynerlik xollari",
      hallText: "Zamonaviy kirish guruhlari Harizma arxitektura konsepsiyasini davom ettiradi. Osoyishta ranglar uyg‘unligi va puxta o‘ylangan makon kvartalning umumiy hududidan uyning shaxsiy muhitiga qulay o‘tishni yaratadi.",
      locationTitle: "Faol hayot markazida",
      locationText: "Harizma Toshkentning Yashnobod tumanida, Ashxobod bog‘i va Central Park yaqinida joylashgan. Joylashuv asosiy shahar yo‘nalishlari, dam olish maskanlari va kundalik infratuzilmaga qulay chiqish imkonini beradi.",
    },
  },
  "ozmahal": {
    ru: {
      intro: "Бизнес-класс Golden House с авторской архитектурой, приватным двором без машин и продуманной городской средой",
      stats: [
        {
          value: "Бизнес",
          label: "Класс жилья"
        },
        {
          value: "14–16",
          label: "Этажей"
        },
        {
          value: "3,3 м",
          label: "Высота потолков"
        },
        {
          value: "White Box",
          label: "Отделка"
        }
      ],
      aboutTitle: "О проекте",
      about: "O‘z Mahal — жилой комплекс бизнес-класса Golden House, в котором современная авторская архитектура сочетается с приватной атмосферой одного из востребованных районов Ташкента.",
      aboutExtra: "Натуральные материалы, вентилируемые фасады и архитектурная подсветка формируют выразительный облик комплекса, а продуманная внутренняя территория создаёт спокойную среду для повседневной жизни.",
      yardTitle: "Дворовое пространство",
      yardText: "Закрытый двор без машин создаёт безопасное и спокойное пространство для жителей. Внутри предусмотрены зоны отдыха, прогулочные аллеи, детские и спортивные пространства. Концепция позволяет отделить повседневную жизнь жителей от автомобильного движения и создать приватную атмосферу внутри комплекса.",
      yardFeatures: [
        "Двор без машин",
        "Авторская архитектура",
        "Натуральные материалы",
        "Вентилируемые фасады",
        "Архитектурная подсветка",
        "Прогулочные аллеи",
        "Детские площадки",
        "Workout-зоны",
        "Собственная школа"
      ],
      hallTitle: "Дизайнерские холлы",
      hallText: "Интерьеры входных групп продолжают эстетику O‘z Mahal: современная архитектура, спокойные оттенки и внимание к деталям создают ощущение приватности уже с момента входа в дом.",
      locationTitle: "В престижной части города",
      locationText: "O‘z Mahal расположен в Мирзо-Улугбекском районе по адресу Катта Дархон, 15. Рядом находятся образовательные учреждения, рестораны, магазины, городские сервисы и основные транспортные маршруты.",
    },
    uz: {
      intro: "Golden House’ning mualliflik arxitekturasi, avtomobillarsiz shaxsiy hovlisi va puxta o‘ylangan shahar muhitiga ega biznes-klass loyihasi",
      stats: [
        {
          value: "Biznes",
          label: "Turar joy toifasi"
        },
        {
          value: "14–16",
          label: "Qavat"
        },
        {
          value: "3,3 m",
          label: "Shift balandligi"
        },
        {
          value: "White Box",
          label: "Pardozlash"
        }
      ],
      aboutTitle: "Loyiha haqida",
      about: "O‘z Mahal — Golden House’ning biznes-klass turar joy majmuasi bo‘lib, unda zamonaviy mualliflik arxitekturasi Toshkentning talab yuqori bo‘lgan hududlaridan biridagi shaxsiy muhit bilan uyg‘unlashadi.",
      aboutExtra: "Tabiiy materiallar, ventilyatsiyali fasadlar va me’moriy yoritish majmuaning o‘ziga xos qiyofasini yaratadi, puxta o‘ylangan ichki hudud esa kundalik hayot uchun osoyishta muhitni ta’minlaydi.",
      yardTitle: "Hovli maydoni",
      yardText: "Avtomobillarsiz yopiq hovli aholi uchun xavfsiz va osoyishta makon yaratadi. Ichki hududda dam olish zonalari, sayr xiyobonlari, bolalar va sport maydonlari ko‘zda tutilgan. Konsepsiya aholining kundalik hayotini avtomobil harakatidan ajratib, majmua ichida shaxsiy muhit yaratadi.",
      yardFeatures: [
        "Avtomobillarsiz hovli",
        "Mualliflik arxitekturasi",
        "Tabiiy materiallar",
        "Ventilyatsiyali fasadlar",
        "Me’moriy yoritish",
        "Sayr xiyobonlari",
        "Bolalar maydonchalari",
        "Workout zonalari",
        "Shaxsiy maktab"
      ],
      hallTitle: "Dizaynerlik xollari",
      hallText: "Kirish guruhlari interyeri O‘z Mahal estetikasini davom ettiradi: zamonaviy arxitektura, osoyishta ranglar va detallarga e’tibor uyga kirishdanoq shaxsiy muhit hissini yaratadi.",
      locationTitle: "Shaharning nufuzli hududida",
      locationText: "O‘z Mahal Mirzo Ulug‘bek tumanida, Katta Darxon ko‘chasi, 15-uy manzilida joylashgan. Yaqin atrofda ta’lim muassasalari, restoranlar, do‘konlar, shahar xizmatlari va asosiy transport yo‘nalishlari mavjud.",
    },
  },
}

/** Листы книги без содержимого — по ним нечего заполнять. */
export const EMPTY_SHEETS: string[] = []
