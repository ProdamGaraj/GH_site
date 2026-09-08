/**
 * Тексты проектов из «Сайт проекты.xlsx» (файл заказчика).
 *
 * СГЕНЕРИРОВАНО скриптом разбора книги — правки руками затрутся при следующем
 * импорте. Меняйте исходный xlsx и перезапускайте генератор.
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
      aboutTitle: "О проекте",
      about: "Мастер-план от голландского бюро De Architekten Cie. Разновысотная застройка и выразительные европейские фасады вдохновлены традиционной мозаикой и тёплой палитрой архитектуры Центральной Азии.",
      aboutExtra: "Геометрия фасадов сочетает различные объёмы и материалы: глазурованную плитку, высококачественную итальянскую штукатурку и композитные панели.",
      yardTitle: "Благоустройство",
      yardText: "Закрытый зеленый двор без машин создает спокойное пространство для прогулок, отдыха и ежедневной активности. Внутри предусмотрены семейные сценарии: от детских площадок с теневыми навесами до фитнеса, беседок и BBQ-зоны.",
      hallTitle: "Дизайнерские холлы",
      hallText: "Входные группы выдержаны в спокойной цветовой гамме с применением современных материалов. Холл работает как приватный переход между городом и домом.",
      locationTitle: "Территория большой жизни",
      locationText: "Проект расположен по адресу Фаргона йули, 50. До Tashkent City Mall и метро Машиностроительный около 15 минут, рядом городские маршруты, коммерция и повседневная инфраструктура.",
      stats: [
        { value: "Бизнес", label: "Класс жилья" },
        { value: "9 и 16", label: "Этажей" },
        { value: "3 м", label: "Высота потолка" },
        { value: "85+", label: "Помещения под бизнес" }
      ],
      yardFeatures: [
        "Закрытый зеленый двор",
        "BBQ-зона",
        "Детские площадки с навесами",
        "Частный детский сад",
        "Kids Room",
        "Фитнес-зал",
        "Беседки"
      ],
    },
    uz: {
      intro: "O‘ziga xos Yevropa arxitekturasi va shaxsiy shahar muhitiga ega Golden House biznes-kvartali",
      aboutTitle: "Loyiha haqida",
      about: "Gollandiyaning De Architekten Cie byurosi tomonidan ishlab chiqilgan bosh reja. Turli balandlikdagi binolar va o‘ziga xos Yevropa fasadlari an’anaviy mozaika hamda Markaziy Osiyo arxitekturasining iliq ranglar palitrasidan ilhomlangan.",
      aboutExtra: "Fasad geometriyasi turli hajmlar va materiallarni uyg‘unlashtiradi: sirlangan koshinlar, yuqori sifatli Italiya suvog‘i va kompozit panellar.",
      yardTitle: "Obodonlashtirish",
      yardText: "Avtomobillarsiz yopiq yashil hovli sayr qilish, dam olish va kundalik faoliyat uchun sokin muhit yaratadi. Ichki hududda oilaviy hordiq uchun barcha sharoitlar ko‘zda tutilgan: soyabonli bolalar maydonchalaridan tortib fitnes, suhbatgohlar va BBQ zonasigacha.",
      hallTitle: "Dizaynerlik xollari",
      hallText: "Kirish guruhlari zamonaviy materiallar qo‘llangan holda osoyishta ranglar uyg‘unligida bezatilgan. Xoll shahar va xonadon o‘rtasida shaxsiy o‘tish hududi vazifasini bajaradi.",
      locationTitle: "Katta hayot hududi",
      locationText: "Loyiha Farg‘ona yo‘li, 50 manzilida joylashgan. Tashkent City Mall va Mashinasozlar metrosigacha taxminan 15 daqiqa, yaqin atrofda shahar yo‘nalishlari, savdo va kundalik infratuzilma mavjud.",
      stats: [
        { value: "Biznes", label: "Turar joy toifasi" },
        { value: "9 va 16", label: "Qavat" },
        { value: "3 m", label: "Shift balandligi" },
        { value: "85+", label: "Biznes uchun maydonlar" }
      ],
      yardFeatures: [
        "Yopiq yashil hovli",
        "BBQ zonasi",
        "Soyabonli bolalar maydonchalari",
        "Xususiy bolalar bog‘chasi",
        "Kids Room",
        "Fitnes zali",
        "Suhbatgohlar"
      ],
    },
  },
  "assalom-dostlik": {
    ru: {
      intro: "Комплекс с закрытой территорией, прогулочными зонами, отделкой в подарок и удобным доступом к городским сервисам.",
      aboutTitle: "О проекте",
      about: "Каждая деталь в Assalom Do’stlik продумана так, чтобы обеспечить вам не только комфорт и безопасность, но и эстетическое удовольствие. Современный дизайн комплекса, состоящий из нескольких 16-этажных зданий, гармонично сочетается с окружающим пейзажем, создавая неповторимый облик и атмосферу.",
      aboutExtra: "Все квартиры в нашем комплексе спроектированы с учетом потребностей современного жителя мегаполиса. Грамотная и правильная планировка делают каждый уголок вашей квартиры не просто функциональным, но и визуально привлекательным.",
      yardTitle: "Дворовое пространство",
      yardText: "Современные спортивные зоны внутри дворов позволяют заниматься фитнесом и проводить время рядом с домом. Детские площадки и прогулочные маршруты дают разные сценарии ежедневной активности.",
      hallTitle: "Дизайнерские холлы",
      hallText: "Входные группы выдержаны в спокойной цветовой гамме с применением современных материалов. Холл работает как приватный переход между городом и домом.",
      locationTitle: "Территория большой жизни",
      locationText: "Проект расположен в городской среде с удобным доступом к транспорту, сервисам, образовательным и коммерческим объектам.",
      stats: [
        { value: "Комфорт+", label: "Класс жилья" },
        { value: "16", label: "Этажей" },
        { value: "3 м", label: "Высота потолков" },
        { value: "85+", label: "Помещения под бизнес" },
        { value: "С отделкой", label: "Ремонт в подарок" }
      ],
    },
    uz: {
      intro: "Yopiq hudud, sayr zonalari, sovg‘a tariqasidagi ta’mir va shahar xizmatlariga qulay kirish imkoniyatiga ega majmua.",
      aboutTitle: "Loyiha haqida",
      about: "Assalom Do’stlik’dagi har bir detal sizga nafaqat qulaylik va xavfsizlik, balki estetik zavq bag‘ishlash uchun ham puxta o‘ylangan. Bir nechta 16 qavatli binolardan iborat majmuaning zamonaviy dizayni atrof-muhit landshafti bilan uyg‘unlashib, betakror qiyofa va muhit yaratadi.",
      aboutExtra: "Majmuamizdagi barcha xonadonlar zamonaviy megapolis aholisining ehtiyojlarini hisobga olgan holda loyihalashtirilgan. Puxta va to‘g‘ri rejalashtirish xonadoningizning har bir burchagini nafaqat funksional, balki ko‘rinish jihatidan ham jozibador qiladi.",
      yardTitle: "Hovli maydoni",
      yardText: "Hovli ichidagi zamonaviy sport zonalari fitnes bilan shug‘ullanish va uyingiz yonida vaqt o‘tkazish imkonini beradi. Bolalar maydonchalari va sayr yo‘laklari kundalik faollik uchun turli xil ssenariylarni taqdim etadi.",
      hallTitle: "Dizaynerlik xollari",
      hallText: "Kirish guruhlari zamonaviy materiallar qo‘llangan holda osoyishta ranglar uyg‘unligida bezatilgan. Xoll shahar va xonadon o‘rtasida shaxsiy o‘tish hududi vazifasini bajaradi.",
      locationTitle: "Katta hayot hududi",
      locationText: "Loyiha transport, xizmat ko‘rsatish, ta’lim va tijorat ob’yektlariga qulay chiqish imkoniyatiga ega bo‘lgan shahar muhitida joylashgan.",
      stats: [
        { value: "Komfort+", label: "Turar joy toifasi" },
        { value: "16", label: "Qavat" },
        { value: "3 m", label: "Shift balandligi" },
        { value: "85+", label: "Biznes uchun maydonlar" },
        { value: "Pardozlangan", label: "Ta’mir sovg‘a sifatida" }
      ],
    },
  },
}

/** Листы книги без содержимого — по ним нечего заполнять. */
export const EMPTY_SHEETS: string[] = ["Harizma","O`zMahal"]
