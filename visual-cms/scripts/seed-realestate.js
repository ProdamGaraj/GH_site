/**
 * Скрипт для создания главной страницы сайта недвижимости
 * Запуск: node scripts/seed-realestate.js
 */

const API_URL = 'http://localhost:5000/api'

// Генератор уникальных ID
let idCounter = 0
const generateId = () => `node-${Date.now()}-${++idCounter}`

// Утилита для создания узла
const createNode = (overrides) => ({
  id: generateId(),
  elementType: 'container',
  tagName: 'div',
  styles: {
    properties: {},
  },
  layoutMode: 'flex',
  children: [],
  metadata: {
    name: 'Element',
  },
  content: '',
  attributes: {},
  ...overrides,
})

// =====================
// БЛОКИ
// =====================

// 1. Hero Section Block
const heroBlock = {
  name: 'Hero Section - Недвижимость',
  type: 'static',
  isReusable: true,
  tags: ['hero', 'banner', 'недвижимость'],
  structure: createNode({
    metadata: { name: 'Hero Section' },
    styles: {
      properties: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '600px',
        padding: '60px 20px',
        backgroundImage: 'linear-gradient(135deg, rgba(30, 58, 138, 0.9), rgba(59, 130, 246, 0.8)), url(https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1920)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: '#ffffff',
        textAlign: 'center',
      },
    },
    children: [
      createNode({
        elementType: 'text',
        tagName: 'h1',
        metadata: { name: 'Заголовок' },
        content: 'Найдите дом своей мечты',
        styles: {
          properties: {
            fontSize: '48px',
            fontWeight: '700',
            marginBottom: '20px',
            maxWidth: '800px',
            lineHeight: '1.2',
          },
        },
      }),
      createNode({
        elementType: 'text',
        tagName: 'p',
        metadata: { name: 'Подзаголовок' },
        content: 'Более 500 квартир в лучших жилых комплексах города. Ипотека от 0.1%, рассрочка до 36 месяцев.',
        styles: {
          properties: {
            fontSize: '20px',
            marginBottom: '40px',
            maxWidth: '600px',
            opacity: '0.9',
          },
        },
      }),
      createNode({
        metadata: { name: 'Кнопки' },
        styles: {
          properties: {
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          },
        },
        children: [
          createNode({
            elementType: 'button',
            tagName: 'button',
            metadata: { name: 'Кнопка - Выбрать квартиру' },
            content: 'Выбрать квартиру',
            styles: {
              properties: {
                padding: '16px 32px',
                fontSize: '16px',
                fontWeight: '600',
                backgroundColor: '#f59e0b',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              },
            },
          }),
          createNode({
            elementType: 'button',
            tagName: 'button',
            metadata: { name: 'Кнопка - Консультация' },
            content: 'Получить консультацию',
            styles: {
              properties: {
                padding: '16px 32px',
                fontSize: '16px',
                fontWeight: '600',
                backgroundColor: 'transparent',
                color: '#ffffff',
                border: '2px solid #ffffff',
                borderRadius: '8px',
                cursor: 'pointer',
              },
            },
          }),
        ],
      }),
      // Статистика
      createNode({
        metadata: { name: 'Статистика' },
        styles: {
          properties: {
            display: 'flex',
            gap: '60px',
            marginTop: '60px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          },
        },
        children: [
          createNode({
            metadata: { name: 'Стат - Проекты' },
            styles: { properties: { textAlign: 'center' } },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'span',
                content: '12+',
                styles: { properties: { fontSize: '36px', fontWeight: '700', display: 'block' } },
              }),
              createNode({
                elementType: 'text',
                tagName: 'span',
                content: 'Жилых комплексов',
                styles: { properties: { fontSize: '14px', opacity: '0.8' } },
              }),
            ],
          }),
          createNode({
            metadata: { name: 'Стат - Квартиры' },
            styles: { properties: { textAlign: 'center' } },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'span',
                content: '500+',
                styles: { properties: { fontSize: '36px', fontWeight: '700', display: 'block' } },
              }),
              createNode({
                elementType: 'text',
                tagName: 'span',
                content: 'Квартир в продаже',
                styles: { properties: { fontSize: '14px', opacity: '0.8' } },
              }),
            ],
          }),
          createNode({
            metadata: { name: 'Стат - Опыт' },
            styles: { properties: { textAlign: 'center' } },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'span',
                content: '15',
                styles: { properties: { fontSize: '36px', fontWeight: '700', display: 'block' } },
              }),
              createNode({
                elementType: 'text',
                tagName: 'span',
                content: 'Лет на рынке',
                styles: { properties: { fontSize: '14px', opacity: '0.8' } },
              }),
            ],
          }),
        ],
      }),
    ],
  }),
}

// 2. Navigation Block
const navigationBlock = {
  name: 'Навигация - Недвижимость',
  type: 'static',
  isReusable: true,
  tags: ['navigation', 'header', 'меню'],
  structure: createNode({
    tagName: 'header',
    metadata: { name: 'Header' },
    styles: {
      properties: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 40px',
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        position: 'sticky',
        top: '0',
        zIndex: '1000',
      },
    },
    children: [
      createNode({
        elementType: 'text',
        tagName: 'a',
        metadata: { name: 'Логотип' },
        content: 'GoldenHouse',
        styles: {
          properties: {
            fontSize: '24px',
            fontWeight: '700',
            color: '#1e3a8a',
            textDecoration: 'none',
          },
        },
      }),
      createNode({
        tagName: 'nav',
        metadata: { name: 'Навигация' },
        styles: {
          properties: {
            display: 'flex',
            gap: '32px',
            alignItems: 'center',
          },
        },
        children: [
          { ...createNode({ elementType: 'link', tagName: 'a', content: 'Жилые комплексы', metadata: { name: 'Ссылка - ЖК' }, styles: { properties: { color: '#374151', textDecoration: 'none', fontSize: '15px', fontWeight: '500' } } }) },
          { ...createNode({ elementType: 'link', tagName: 'a', content: 'Коммерция', metadata: { name: 'Ссылка - Коммерция' }, styles: { properties: { color: '#374151', textDecoration: 'none', fontSize: '15px', fontWeight: '500' } } }) },
          { ...createNode({ elementType: 'link', tagName: 'a', content: 'О компании', metadata: { name: 'Ссылка - О компании' }, styles: { properties: { color: '#374151', textDecoration: 'none', fontSize: '15px', fontWeight: '500' } } }) },
          { ...createNode({ elementType: 'link', tagName: 'a', content: 'Новости', metadata: { name: 'Ссылка - Новости' }, styles: { properties: { color: '#374151', textDecoration: 'none', fontSize: '15px', fontWeight: '500' } } }) },
          { ...createNode({ elementType: 'link', tagName: 'a', content: 'Контакты', metadata: { name: 'Ссылка - Контакты' }, styles: { properties: { color: '#374151', textDecoration: 'none', fontSize: '15px', fontWeight: '500' } } }) },
        ],
      }),
      createNode({
        metadata: { name: 'Контакт хедер' },
        styles: {
          properties: {
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          },
        },
        children: [
          createNode({
            elementType: 'text',
            tagName: 'a',
            content: '+7 (777) 123-45-67',
            metadata: { name: 'Телефон' },
            styles: {
              properties: {
                color: '#1e3a8a',
                fontWeight: '600',
                fontSize: '16px',
                textDecoration: 'none',
              },
            },
          }),
          createNode({
            elementType: 'button',
            tagName: 'button',
            content: 'Заказать звонок',
            metadata: { name: 'Кнопка звонок' },
            styles: {
              properties: {
                padding: '10px 20px',
                backgroundColor: '#1e3a8a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              },
            },
          }),
        ],
      }),
    ],
  }),
}

// 3. Projects Section
const projectsBlock = {
  name: 'Проекты - Карточки ЖК',
  type: 'static',
  isReusable: true,
  tags: ['projects', 'cards', 'жк'],
  structure: createNode({
    tagName: 'section',
    metadata: { name: 'Секция проектов' },
    styles: {
      properties: {
        padding: '80px 40px',
        backgroundColor: '#f8fafc',
      },
    },
    children: [
      createNode({
        metadata: { name: 'Заголовок секции' },
        styles: {
          properties: {
            textAlign: 'center',
            marginBottom: '50px',
          },
        },
        children: [
          createNode({
            elementType: 'text',
            tagName: 'h2',
            content: 'Наши жилые комплексы',
            styles: { properties: { fontSize: '36px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' } },
          }),
          createNode({
            elementType: 'text',
            tagName: 'p',
            content: 'Выберите идеальный дом из нашей коллекции премиальных проектов',
            styles: { properties: { fontSize: '18px', color: '#64748b' } },
          }),
        ],
      }),
      createNode({
        metadata: { name: 'Сетка проектов' },
        styles: {
          properties: {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '30px',
            maxWidth: '1200px',
            margin: '0 auto',
          },
        },
        children: [
          // Проект 1
          createProjectCard('ЖК "Небесный"', 'Комфорт+', 'от 28 500 000 ₸', 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600'),
          // Проект 2
          createProjectCard('ЖК "Аврора"', 'Бизнес', 'от 42 000 000 ₸', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600'),
          // Проект 3
          createProjectCard('ЖК "Парк Резиденс"', 'Премиум', 'от 65 000 000 ₸', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600'),
        ],
      }),
      createNode({
        metadata: { name: 'Кнопка все проекты' },
        styles: {
          properties: {
            textAlign: 'center',
            marginTop: '50px',
          },
        },
        children: [
          createNode({
            elementType: 'button',
            tagName: 'button',
            content: 'Смотреть все проекты →',
            styles: {
              properties: {
                padding: '14px 32px',
                backgroundColor: '#1e3a8a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
              },
            },
          }),
        ],
      }),
    ],
  }),
}

function createProjectCard(name, classType, price, imageUrl) {
  return createNode({
    metadata: { name: `Карточка - ${name}` },
    styles: {
      properties: {
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      },
    },
    children: [
      createNode({
        elementType: 'image',
        tagName: 'img',
        metadata: { name: 'Фото проекта' },
        attributes: { src: imageUrl, alt: name },
        styles: {
          properties: {
            width: '100%',
            height: '200px',
            objectFit: 'cover',
          },
        },
      }),
      createNode({
        metadata: { name: 'Контент карточки' },
        styles: { properties: { padding: '24px' } },
        children: [
          createNode({
            elementType: 'text',
            tagName: 'span',
            content: classType,
            styles: { properties: { fontSize: '12px', color: '#1e3a8a', fontWeight: '600', backgroundColor: '#dbeafe', padding: '4px 12px', borderRadius: '20px' } },
          }),
          createNode({
            elementType: 'text',
            tagName: 'h3',
            content: name,
            styles: { properties: { fontSize: '20px', fontWeight: '600', color: '#1e293b', marginTop: '12px', marginBottom: '8px' } },
          }),
          createNode({
            elementType: 'text',
            tagName: 'p',
            content: price,
            styles: { properties: { fontSize: '18px', fontWeight: '700', color: '#f59e0b' } },
          }),
          createNode({
            elementType: 'button',
            tagName: 'button',
            content: 'Подробнее',
            styles: {
              properties: {
                width: '100%',
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#f1f5f9',
                color: '#1e3a8a',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '500',
                cursor: 'pointer',
              },
            },
          }),
        ],
      }),
    ],
  })
}

// 4. Advantages Section
const advantagesBlock = {
  name: 'Преимущества компании',
  type: 'static',
  isReusable: true,
  tags: ['advantages', 'features', 'преимущества'],
  structure: createNode({
    tagName: 'section',
    metadata: { name: 'Секция преимуществ' },
    styles: {
      properties: {
        padding: '80px 40px',
        backgroundColor: '#ffffff',
      },
    },
    children: [
      createNode({
        metadata: { name: 'Контейнер' },
        styles: {
          properties: {
            maxWidth: '1200px',
            margin: '0 auto',
          },
        },
        children: [
          createNode({
            elementType: 'text',
            tagName: 'h2',
            content: 'Почему выбирают нас',
            styles: {
              properties: {
                fontSize: '36px',
                fontWeight: '700',
                color: '#1e293b',
                textAlign: 'center',
                marginBottom: '50px',
              },
            },
          }),
          createNode({
            metadata: { name: 'Сетка преимуществ' },
            styles: {
              properties: {
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '30px',
              },
            },
            children: [
              createAdvantageCard('🏗️', 'Надежный застройщик', '15 лет безупречной репутации'),
              createAdvantageCard('💰', 'Выгодные условия', 'Ипотека от 0.1% и рассрочка'),
              createAdvantageCard('📍', 'Лучшие локации', 'Развитая инфраструктура'),
              createAdvantageCard('✅', 'Гарантия качества', 'Сдача точно в срок'),
            ],
          }),
        ],
      }),
    ],
  }),
}

function createAdvantageCard(emoji, title, desc) {
  return createNode({
    metadata: { name: `Преимущество - ${title}` },
    styles: {
      properties: {
        textAlign: 'center',
        padding: '30px 20px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
      },
    },
    children: [
      createNode({
        elementType: 'text',
        tagName: 'span',
        content: emoji,
        styles: { properties: { fontSize: '48px', display: 'block', marginBottom: '16px' } },
      }),
      createNode({
        elementType: 'text',
        tagName: 'h3',
        content: title,
        styles: { properties: { fontSize: '18px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' } },
      }),
      createNode({
        elementType: 'text',
        tagName: 'p',
        content: desc,
        styles: { properties: { fontSize: '14px', color: '#64748b' } },
      }),
    ],
  })
}

// 5. Payment Options Block
const paymentBlock = {
  name: 'Способы оплаты',
  type: 'static',
  isReusable: true,
  tags: ['payment', 'mortgage', 'ипотека'],
  structure: createNode({
    tagName: 'section',
    metadata: { name: 'Секция оплаты' },
    styles: {
      properties: {
        padding: '80px 40px',
        backgroundColor: '#1e3a8a',
        color: '#ffffff',
      },
    },
    children: [
      createNode({
        metadata: { name: 'Контейнер' },
        styles: { properties: { maxWidth: '1200px', margin: '0 auto' } },
        children: [
          createNode({
            elementType: 'text',
            tagName: 'h2',
            content: 'Удобные способы оплаты',
            styles: { properties: { fontSize: '36px', fontWeight: '700', textAlign: 'center', marginBottom: '50px' } },
          }),
          createNode({
            metadata: { name: 'Варианты оплаты' },
            styles: { properties: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px' } },
            children: [
              createPaymentCard('Ипотека', 'от 0.1%', 'Одобрение за 1 день. Работаем с 15+ банками.'),
              createPaymentCard('Рассрочка', 'до 36 мес', 'Без процентов и переплат. Первый взнос от 30%.'),
              createPaymentCard('100% оплата', 'Скидка 5%', 'Максимальная выгода при полной оплате.'),
            ],
          }),
        ],
      }),
    ],
  }),
}

function createPaymentCard(title, highlight, desc) {
  return createNode({
    metadata: { name: `Оплата - ${title}` },
    styles: {
      properties: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: '16px',
        padding: '32px',
        textAlign: 'center',
      },
    },
    children: [
      createNode({
        elementType: 'text',
        tagName: 'h3',
        content: title,
        styles: { properties: { fontSize: '24px', fontWeight: '600', marginBottom: '8px' } },
      }),
      createNode({
        elementType: 'text',
        tagName: 'span',
        content: highlight,
        styles: { properties: { fontSize: '36px', fontWeight: '700', color: '#fbbf24', display: 'block', marginBottom: '16px' } },
      }),
      createNode({
        elementType: 'text',
        tagName: 'p',
        content: desc,
        styles: { properties: { fontSize: '14px', opacity: '0.9' } },
      }),
    ],
  })
}

// 6. CTA Section
const ctaBlock = {
  name: 'CTA - Запись на просмотр',
  type: 'static',
  isReusable: true,
  tags: ['cta', 'form', 'заявка'],
  structure: createNode({
    tagName: 'section',
    metadata: { name: 'CTA Секция' },
    styles: {
      properties: {
        padding: '80px 40px',
        backgroundImage: 'linear-gradient(135deg, #f59e0b, #d97706)',
        color: '#ffffff',
        textAlign: 'center',
      },
    },
    children: [
      createNode({
        metadata: { name: 'Контейнер' },
        styles: { properties: { maxWidth: '700px', margin: '0 auto' } },
        children: [
          createNode({
            elementType: 'text',
            tagName: 'h2',
            content: 'Запишитесь на бесплатный просмотр',
            styles: { properties: { fontSize: '36px', fontWeight: '700', marginBottom: '16px' } },
          }),
          createNode({
            elementType: 'text',
            tagName: 'p',
            content: 'Наш менеджер свяжется с вами в течение 15 минут',
            styles: { properties: { fontSize: '18px', marginBottom: '32px', opacity: '0.95' } },
          }),
          createNode({
            metadata: { name: 'Форма' },
            styles: {
              properties: {
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap',
              },
            },
            children: [
              createNode({
                elementType: 'input',
                tagName: 'input',
                metadata: { name: 'Поле телефона' },
                attributes: { type: 'tel', placeholder: '+7 (___) ___-__-__' },
                styles: {
                  properties: {
                    padding: '16px 24px',
                    fontSize: '16px',
                    border: 'none',
                    borderRadius: '8px',
                    width: '280px',
                  },
                },
              }),
              createNode({
                elementType: 'button',
                tagName: 'button',
                content: 'Записаться',
                metadata: { name: 'Кнопка записи' },
                styles: {
                  properties: {
                    padding: '16px 40px',
                    backgroundColor: '#1e3a8a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  },
                },
              }),
            ],
          }),
        ],
      }),
    ],
  }),
}

// 7. Footer Block
const footerBlock = {
  name: 'Footer - Недвижимость',
  type: 'static',
  isReusable: true,
  tags: ['footer', 'контакты'],
  structure: createNode({
    tagName: 'footer',
    metadata: { name: 'Footer' },
    styles: {
      properties: {
        padding: '60px 40px 30px',
        backgroundColor: '#0f172a',
        color: '#ffffff',
      },
    },
    children: [
      createNode({
        metadata: { name: 'Контейнер' },
        styles: { properties: { maxWidth: '1200px', margin: '0 auto' } },
        children: [
          createNode({
            metadata: { name: 'Колонки' },
            styles: { properties: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '40px', marginBottom: '40px' } },
            children: [
              // Колонка 1
              createNode({
                metadata: { name: 'О компании' },
                children: [
                  createNode({ elementType: 'text', tagName: 'h4', content: 'GoldenHouse', styles: { properties: { fontSize: '20px', fontWeight: '700', marginBottom: '16px' } } }),
                  createNode({ elementType: 'text', tagName: 'p', content: 'Надежный застройщик с 15-летним опытом. Строим дома, в которых хочется жить.', styles: { properties: { fontSize: '14px', opacity: '0.7', lineHeight: '1.6' } } }),
                ],
              }),
              // Колонка 2
              createNode({
                metadata: { name: 'Навигация' },
                children: [
                  createNode({ elementType: 'text', tagName: 'h4', content: 'Навигация', styles: { properties: { fontSize: '16px', fontWeight: '600', marginBottom: '16px' } } }),
                  createNode({ elementType: 'link', tagName: 'a', content: 'Жилые комплексы', styles: { properties: { display: 'block', fontSize: '14px', opacity: '0.7', marginBottom: '8px', textDecoration: 'none', color: '#ffffff' } } }),
                  createNode({ elementType: 'link', tagName: 'a', content: 'Коммерческие объекты', styles: { properties: { display: 'block', fontSize: '14px', opacity: '0.7', marginBottom: '8px', textDecoration: 'none', color: '#ffffff' } } }),
                  createNode({ elementType: 'link', tagName: 'a', content: 'О компании', styles: { properties: { display: 'block', fontSize: '14px', opacity: '0.7', marginBottom: '8px', textDecoration: 'none', color: '#ffffff' } } }),
                  createNode({ elementType: 'link', tagName: 'a', content: 'Новости', styles: { properties: { display: 'block', fontSize: '14px', opacity: '0.7', marginBottom: '8px', textDecoration: 'none', color: '#ffffff' } } }),
                ],
              }),
              // Колонка 3
              createNode({
                metadata: { name: 'Покупателям' },
                children: [
                  createNode({ elementType: 'text', tagName: 'h4', content: 'Покупателям', styles: { properties: { fontSize: '16px', fontWeight: '600', marginBottom: '16px' } } }),
                  createNode({ elementType: 'link', tagName: 'a', content: 'Ипотека', styles: { properties: { display: 'block', fontSize: '14px', opacity: '0.7', marginBottom: '8px', textDecoration: 'none', color: '#ffffff' } } }),
                  createNode({ elementType: 'link', tagName: 'a', content: 'Рассрочка', styles: { properties: { display: 'block', fontSize: '14px', opacity: '0.7', marginBottom: '8px', textDecoration: 'none', color: '#ffffff' } } }),
                  createNode({ elementType: 'link', tagName: 'a', content: 'Публичная оферта', styles: { properties: { display: 'block', fontSize: '14px', opacity: '0.7', marginBottom: '8px', textDecoration: 'none', color: '#ffffff' } } }),
                  createNode({ elementType: 'link', tagName: 'a', content: 'Карьера', styles: { properties: { display: 'block', fontSize: '14px', opacity: '0.7', marginBottom: '8px', textDecoration: 'none', color: '#ffffff' } } }),
                ],
              }),
              // Колонка 4
              createNode({
                metadata: { name: 'Контакты' },
                children: [
                  createNode({ elementType: 'text', tagName: 'h4', content: 'Контакты', styles: { properties: { fontSize: '16px', fontWeight: '600', marginBottom: '16px' } } }),
                  createNode({ elementType: 'text', tagName: 'p', content: '+7 (777) 123-45-67', styles: { properties: { fontSize: '18px', fontWeight: '600', marginBottom: '8px' } } }),
                  createNode({ elementType: 'text', tagName: 'p', content: 'info@goldenhouse.kz', styles: { properties: { fontSize: '14px', opacity: '0.7', marginBottom: '8px' } } }),
                  createNode({ elementType: 'text', tagName: 'p', content: 'г. Алматы, пр. Аль-Фараби, 77', styles: { properties: { fontSize: '14px', opacity: '0.7' } } }),
                ],
              }),
            ],
          }),
          createNode({
            metadata: { name: 'Copyright' },
            styles: { properties: { borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px', textAlign: 'center' } },
            children: [
              createNode({ elementType: 'text', tagName: 'p', content: '© 2024 GoldenHouse. Все права защищены.', styles: { properties: { fontSize: '14px', opacity: '0.5' } } }),
            ],
          }),
        ],
      }),
    ],
  }),
}

// =====================
// MAIN PAGE STRUCTURE
// =====================

const mainPageStructure = createNode({
  metadata: { name: 'Главная страница', locked: true },
  styles: {
    properties: {
      minHeight: '100vh',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  children: [
    // Navigation будет block-reference
    navigationBlock.structure,
    heroBlock.structure,
    advantagesBlock.structure,
    projectsBlock.structure,
    paymentBlock.structure,
    ctaBlock.structure,
    footerBlock.structure,
  ],
})

// =====================
// API CALLS
// =====================

async function createBlockApi(blockData) {
  const response = await fetch(`${API_URL}/blocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(blockData),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create block: ${error}`)
  }
  return response.json()
}

async function createPageApi(pageData) {
  const response = await fetch(`${API_URL}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pageData),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create page: ${error}`)
  }
  return response.json()
}

async function main() {
  console.log('🏗️  Создание блоков для сайта недвижимости...\n')

  try {
    // Создаем блоки
    const blocks = [
      navigationBlock,
      heroBlock,
      advantagesBlock,
      projectsBlock,
      paymentBlock,
      ctaBlock,
      footerBlock,
    ]

    for (const block of blocks) {
      const created = await createBlockApi(block)
      console.log(`✅ Блок создан: ${created.name} (ID: ${created.id})`)
    }

    console.log('\n📄 Создание главной страницы...\n')

    // Создаем главную страницу
    const page = await createPageApi({
      name: 'Главная - GoldenHouse',
      slug: 'home',
      structure: mainPageStructure,
      metadata: {
        title: 'GoldenHouse - Надежный застройщик недвижимости',
        description: 'Более 500 квартир в лучших жилых комплексах города. Ипотека от 0.1%, рассрочка до 36 месяцев.',
        keywords: ['недвижимость', 'квартиры', 'жилые комплексы', 'ипотека'],
      },
      status: 'published',
    })

    console.log(`✅ Страница создана: ${page.name} (ID: ${page.id})`)
    console.log(`   URL: /${page.slug}`)

    console.log('\n🎉 Готово! Откройте редактор чтобы увидеть созданные блоки и страницу.')

  } catch (error) {
    console.error('❌ Ошибка:', error.message)
  }
}

main()
