/**
 * Скрипт для создания шаблонной страницы проекта (ЖК)
 * Используется как template для системы Collections
 * 
 * Переиспользуемые блоки (linkedBlockId):
 *   - Header:          7441cdc0-3d58-4b18-aa3b-fd7549f8e807
 *   - Contact Section: 0c28e368-78cf-498d-9ae1-9ffbb5d702f4
 *   - Footer:          c9b03934-2822-4251-923d-e1e24bd87f7c
 *
 * Запуск: node scripts/seed-project-template.js
 */

const API_URL = 'http://localhost:5000/api'
const SITE_ID = 'a83bae31-28ed-46fa-ab7b-800d7e6396b3'

// ─── Linked Block IDs ───────────────────────────────────────
const LINKED = {
  header: '7441cdc0-3d58-4b18-aa3b-fd7549f8e807',
  contact: '0c28e368-78cf-498d-9ae1-9ffbb5d702f4',
  footer: 'c9b03934-2822-4251-923d-e1e24bd87f7c',
}

// ─── Фирменные цвета Golden House ──────────────────────────
const colors = {
  gold: '#D29F66',
  goldLight: '#E4C9A8',
  goldDark: '#B8864D',
  white: '#FFFFFF',
  black: '#403E3D',
  gray: '#B1B2B2',
  grayLight: '#F5F5F5',
  grayDark: '#2A2A2A',
  overlay: 'rgba(0,0,0,0.55)',
}

// ─── Утилиты ────────────────────────────────────────────────
let idCounter = 0
const generateId = () => `gh-tpl-${Date.now()}-${++idCounter}`

const createNode = (overrides = {}) => ({
  id: generateId(),
  elementType: 'container',
  tagName: 'div',
  styles: { properties: {} },
  layoutMode: undefined,
  children: [],
  metadata: { name: 'Element' },
  content: '',
  attributes: {},
  ...overrides,
})

const createText = (tag, content, styles, meta = {}) =>
  createNode({
    elementType: 'text',
    tagName: tag,
    content,
    styles: { properties: styles },
    metadata: { name: meta.name || 'Text' },
    attributes: meta.attributes || {},
  })

const createImage = (src, alt, styles, meta = {}) =>
  createNode({
    elementType: 'image',
    tagName: 'img',
    attributes: { src, alt, loading: 'lazy' },
    styles: { properties: styles },
    metadata: { name: meta.name || 'Image' },
  })

const createLinkedBlock = (blockId, name, tagName = 'div') =>
  createNode({
    tagName,
    metadata: { name, linkedBlockId: blockId },
  })

// ═════════════════════════════════════════════════════════════
//  СЕКЦИЯ 1: HERO — Полноэкранное фото проекта
// ═════════════════════════════════════════════════════════════
const createHero = () =>
  createNode({
    tagName: 'section',
    metadata: { name: 'Project Hero' },
    styles: {
      properties: {
        position: 'relative',
        minHeight: '85vh',
        display: 'flex',
        alignItems: 'flex-end',
        overflow: 'hidden',
      },
    },
    children: [
      // Фоновое изображение
      createNode({
        metadata: { name: 'Hero Background' },
        styles: {
          properties: {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundImage:
              'url({{item.image}})',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: '0',
          },
        },
      }),
      // Градиент поверх фото
      createNode({
        metadata: { name: 'Hero Overlay' },
        styles: {
          properties: {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background:
              'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.3) 100%)',
            zIndex: '1',
          },
        },
      }),
      // Контент hero
      createNode({
        metadata: { name: 'Hero Content' },
        styles: {
          properties: {
            position: 'relative',
            zIndex: '2',
            width: '100%',
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 40px 80px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          },
        },
        children: [
          // Бейдж статуса
          createNode({
            metadata: { name: 'Status Badge' },
            styles: {
              properties: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                alignSelf: 'flex-start',
              },
            },
            children: [
              createNode({
                metadata: { name: 'Badge Dot' },
                styles: {
                  properties: {
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#4CAF50',
                  },
                },
              }),
              createText('span', '{{item.status}}', {
                fontSize: '14px',
                fontWeight: '500',
                color: colors.white,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                fontFamily: "'Muller', sans-serif",
              }, { name: 'Status Text' }),
            ],
          }),
          // Название проекта
          createText('h1', '{{item.title}}', {
            fontSize: '64px',
            fontWeight: '700',
            color: colors.white,
            fontFamily: "'Muller', sans-serif",
            lineHeight: '1.1',
            letterSpacing: '1px',
            margin: '0',
          }, { name: 'Project Title' }),
          // Подзаголовок с локацией
          createText('p', '{{item.location}}', {
            fontSize: '20px',
            fontWeight: '300',
            color: 'rgba(255,255,255,0.85)',
            fontFamily: "'Muller', sans-serif",
            margin: '0',
          }, { name: 'Project Location' }),
          // Цена
          createNode({
            metadata: { name: 'Price Block' },
            styles: {
              properties: {
                display: 'flex',
                alignItems: 'baseline',
                gap: '12px',
                marginTop: '8px',
              },
            },
            children: [
              createText('span', '{{item.pricePerSqm}}', {
                fontSize: '36px',
                fontWeight: '600',
                color: colors.gold,
                fontFamily: "'Muller', sans-serif",
              }, { name: 'Price Value' }),
              createText('span', 'за м²', {
                fontSize: '18px',
                fontWeight: '300',
                color: 'rgba(255,255,255,0.7)',
                fontFamily: "'Muller', sans-serif",
              }, { name: 'Price Unit' }),
            ],
          }),
        ],
      }),
    ],
  })

// ═════════════════════════════════════════════════════════════
//  СЕКЦИЯ 2: КЛЮЧЕВЫЕ ЦИФРЫ
// ═════════════════════════════════════════════════════════════
const createKeyStats = () => {
  const stats = [
    { value: '{{item.rooms}}', label: 'комнат', icon: '🏠' },
    { value: '{{item.area}}', label: 'м² площадь', icon: '📐' },
    { value: '{{item.price}}', label: 'цена', icon: '💰' },
    { value: '{{item.completion}}', label: 'срок сдачи', icon: '📅' },
  ]

  return createNode({
    tagName: 'section',
    metadata: { name: 'Key Stats Section' },
    styles: {
      properties: {
        padding: '80px 40px',
        backgroundColor: colors.black,
      },
    },
    children: [
      createNode({
        metadata: { name: 'Stats Container' },
        styles: {
          properties: {
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '40px',
          },
        },
        layoutMode: 'grid',
        children: stats.map(({ value, label, icon }) =>
          createNode({
            metadata: { name: `Stat: ${label}` },
            styles: {
              properties: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '32px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(210,159,102,0.15)',
              },
            },
            children: [
              createText('span', icon, {
                fontSize: '32px',
                marginBottom: '16px',
              }, { name: 'Stat Icon' }),
              createText('span', value, {
                fontSize: '40px',
                fontWeight: '700',
                color: colors.gold,
                fontFamily: "'Muller', sans-serif",
                lineHeight: '1',
                marginBottom: '8px',
              }, { name: 'Stat Value' }),
              createText('span', label, {
                fontSize: '14px',
                fontWeight: '400',
                color: colors.gray,
                fontFamily: "'Muller', sans-serif",
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }, { name: 'Stat Label' }),
            ],
          })
        ),
      }),
    ],
  })
}

// ═════════════════════════════════════════════════════════════
//  СЕКЦИЯ 3: О ПРОЕКТЕ
// ═════════════════════════════════════════════════════════════
const createAbout = () =>
  createNode({
    tagName: 'section',
    metadata: { name: 'About Project Section' },
    styles: {
      properties: {
        padding: '100px 40px',
        backgroundColor: colors.white,
      },
    },
    children: [
      createNode({
        metadata: { name: 'About Container' },
        styles: {
          properties: {
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '80px',
            alignItems: 'center',
          },
        },
        layoutMode: 'grid',
        children: [
          // Левая колонка — текст
          createNode({
            metadata: { name: 'About Text' },
            styles: {
              properties: {
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              },
            },
            children: [
              createText('span', 'О проекте', {
                fontSize: '13px',
                fontWeight: '600',
                color: colors.gold,
                textTransform: 'uppercase',
                letterSpacing: '3px',
                fontFamily: "'Muller', sans-serif",
              }, { name: 'Section Label' }),
              createText('h2', '{{item.subtitle}}', {
                fontSize: '40px',
                fontWeight: '700',
                color: colors.black,
                fontFamily: "'Muller', sans-serif",
                lineHeight: '1.2',
                margin: '0',
              }, { name: 'About Title' }),
              createText(
                'p',
                '{{item.description}}',
                {
                  fontSize: '16px',
                  fontWeight: '400',
                  color: '#666',
                  fontFamily: "'Muller', sans-serif",
                  lineHeight: '1.8',
                  margin: '0',
                },
                { name: 'About Description' }
              ),
              createText(
                'p',
                '{{item.features}}',
                {
                  fontSize: '16px',
                  fontWeight: '400',
                  color: '#666',
                  fontFamily: "'Muller', sans-serif",
                  lineHeight: '1.8',
                  margin: '0',
                },
                { name: 'About Details' }
              ),
              // Список преимуществ
              createNode({
                metadata: { name: 'About Features List' },
                styles: {
                  properties: {
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                    marginTop: '8px',
                  },
                },
                layoutMode: 'grid',
                children: [
                  'Закрытая территория',
                  'Подземный паркинг',
                  'Панорамные окна',
                  'Умный дом',
                  'Детские площадки',
                  'Коммерция на 1 этаже',
                ].map((text) =>
                  createNode({
                    metadata: { name: `Feature: ${text}` },
                    styles: {
                      properties: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      },
                    },
                    children: [
                      createNode({
                        metadata: { name: 'Check Icon' },
                        styles: {
                          properties: {
                            width: '20px',
                            height: '20px',
                            minWidth: '20px',
                            borderRadius: '50%',
                            backgroundColor: colors.gold,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          },
                        },
                        children: [
                          createText('span', '✓', {
                            fontSize: '11px',
                            color: colors.white,
                            fontWeight: '700',
                          }, { name: 'Check Mark' }),
                        ],
                      }),
                      createText('span', text, {
                        fontSize: '14px',
                        color: colors.black,
                        fontFamily: "'Muller', sans-serif",
                      }, { name: 'Feature Text' }),
                    ],
                  })
                ),
              }),
            ],
          }),
          // Правая колонка — изображение
          createNode({
            metadata: { name: 'About Image Wrapper' },
            styles: {
              properties: {
                position: 'relative',
                borderRadius: '16px',
                overflow: 'hidden',
                aspectRatio: '4/5',
              },
            },
            children: [
              createImage(
                '{{item.image}}',
                '{{item.title}} — фасад здания',
                {
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                },
                { name: 'About Image' }
              ),
              // Плашка на изображении
              createNode({
                metadata: { name: 'Image Badge' },
                styles: {
                  properties: {
                    position: 'absolute',
                    bottom: '24px',
                    left: '24px',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(10px)',
                    padding: '16px 24px',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  },
                },
                children: [
                  createText('span', 'Класс жилья', {
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.6)',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontFamily: "'Muller', sans-serif",
                  }, { name: 'Badge Label' }),
                  createText('span', 'Бизнес', {
                    fontSize: '20px',
                    fontWeight: '600',
                    color: colors.gold,
                    fontFamily: "'Muller', sans-serif",
                  }, { name: 'Badge Value' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })

// ═════════════════════════════════════════════════════════════
//  СЕКЦИЯ 4: ГАЛЕРЕЯ
// ═════════════════════════════════════════════════════════════
const createGallery = () => {
  const images = [
    {
      src: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
      alt: 'Фасад комплекса',
      span: 'span 2',
    },
    {
      src: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=600',
      alt: 'Холл и лобби',
      span: 'span 1',
    },
    {
      src: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=600',
      alt: 'Интерьер квартиры',
      span: 'span 1',
    },
    {
      src: 'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=600',
      alt: 'Ландшафтный двор',
      span: 'span 1',
    },
    {
      src: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800',
      alt: 'Панорамный вид',
      span: 'span 2',
    },
  ]

  return createNode({
    tagName: 'section',
    metadata: { name: 'Gallery Section' },
    styles: {
      properties: {
        padding: '100px 40px',
        backgroundColor: colors.grayLight,
      },
    },
    children: [
      createNode({
        metadata: { name: 'Gallery Container' },
        styles: {
          properties: {
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '48px',
          },
        },
        children: [
          // Заголовок секции
          createNode({
            metadata: { name: 'Gallery Header' },
            styles: {
              properties: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
              },
            },
            children: [
              createNode({
                metadata: { name: 'Gallery Title Block' },
                styles: {
                  properties: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  },
                },
                children: [
                  createText('span', 'Галерея', {
                    fontSize: '13px',
                    fontWeight: '600',
                    color: colors.gold,
                    textTransform: 'uppercase',
                    letterSpacing: '3px',
                    fontFamily: "'Muller', sans-serif",
                  }, { name: 'Section Label' }),
                  createText('h2', 'Как выглядит ваш будущий дом', {
                    fontSize: '36px',
                    fontWeight: '700',
                    color: colors.black,
                    fontFamily: "'Muller', sans-serif",
                    margin: '0',
                  }, { name: 'Gallery Title' }),
                ],
              }),
            ],
          }),
          // Сетка изображений
          createNode({
            metadata: { name: 'Gallery Grid' },
            styles: {
              properties: {
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
              },
            },
            layoutMode: 'grid',
            children: images.map(({ src, alt, span }) =>
              createNode({
                metadata: { name: `Gallery: ${alt}` },
                styles: {
                  properties: {
                    gridColumn: span,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    aspectRatio: span === 'span 2' ? '16/9' : '4/3',
                    cursor: 'pointer',
                  },
                },
                children: [
                  createImage(src, alt, {
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.4s ease',
                  }, { name: `Photo: ${alt}` }),
                ],
              })
            ),
          }),
        ],
      }),
    ],
  })
}

// ═════════════════════════════════════════════════════════════
//  СЕКЦИЯ 5: ПЛАНИРОВКИ
// ═════════════════════════════════════════════════════════════
const createLayouts = () => {
  const layouts = [
    {
      type: 'Студия',
      area: 'от 32 м²',
      price: 'от $38 400',
      rooms: '1',
      image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600',
    },
    {
      type: '1-комнатная',
      area: 'от 45 м²',
      price: 'от $54 000',
      rooms: '2',
      image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600',
    },
    {
      type: '2-комнатная',
      area: 'от 68 м²',
      price: 'от $81 600',
      rooms: '3',
      image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600',
    },
    {
      type: '3-комнатная',
      area: 'от 95 м²',
      price: 'от $114 000',
      rooms: '4-5',
      image: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=600',
    },
  ]

  return createNode({
    tagName: 'section',
    metadata: { name: 'Layouts Section' },
    styles: {
      properties: {
        padding: '100px 40px',
        backgroundColor: colors.white,
      },
    },
    children: [
      createNode({
        metadata: { name: 'Layouts Container' },
        styles: {
          properties: {
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '48px',
          },
        },
        children: [
          // Заголовок
          createNode({
            metadata: { name: 'Layouts Header' },
            styles: {
              properties: {
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              },
            },
            children: [
              createText('span', 'Планировки', {
                fontSize: '13px',
                fontWeight: '600',
                color: colors.gold,
                textTransform: 'uppercase',
                letterSpacing: '3px',
                fontFamily: "'Muller', sans-serif",
              }, { name: 'Section Label' }),
              createText('h2', 'Выберите свою планировку', {
                fontSize: '36px',
                fontWeight: '700',
                color: colors.black,
                fontFamily: "'Muller', sans-serif",
                margin: '0',
              }, { name: 'Layouts Title' }),
            ],
          }),
          // Карточки планировок
          createNode({
            metadata: { name: 'Layouts Grid' },
            styles: {
              properties: {
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '24px',
              },
            },
            layoutMode: 'grid',
            children: layouts.map(({ type, area, price, rooms, image }) =>
              createNode({
                metadata: { name: `Layout: ${type}` },
                styles: {
                  properties: {
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '1px solid #E8E8E8',
                    backgroundColor: colors.white,
                    transition: 'box-shadow 0.3s ease, transform 0.3s ease',
                    cursor: 'pointer',
                  },
                },
                children: [
                  // Изображение планировки
                  createNode({
                    metadata: { name: 'Layout Image Wrapper' },
                    styles: {
                      properties: {
                        aspectRatio: '4/3',
                        overflow: 'hidden',
                        backgroundColor: colors.grayLight,
                      },
                    },
                    children: [
                      createImage(image, `Планировка ${type}`, {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }, { name: 'Layout Image' }),
                    ],
                  }),
                  // Информация
                  createNode({
                    metadata: { name: 'Layout Info' },
                    styles: {
                      properties: {
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      },
                    },
                    children: [
                      createText('h3', type, {
                        fontSize: '20px',
                        fontWeight: '600',
                        color: colors.black,
                        fontFamily: "'Muller', sans-serif",
                        margin: '0',
                      }, { name: 'Layout Type' }),
                      // Характеристики
                      createNode({
                        metadata: { name: 'Layout Details' },
                        styles: {
                          properties: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          },
                        },
                        children: [
                          createNode({
                            metadata: { name: 'Layout Area Row' },
                            styles: {
                              properties: {
                                display: 'flex',
                                justifyContent: 'space-between',
                              },
                            },
                            children: [
                              createText('span', 'Площадь', {
                                fontSize: '14px',
                                color: colors.gray,
                                fontFamily: "'Muller', sans-serif",
                              }, { name: 'Area Label' }),
                              createText('span', area, {
                                fontSize: '14px',
                                fontWeight: '500',
                                color: colors.black,
                                fontFamily: "'Muller', sans-serif",
                              }, { name: 'Area Value' }),
                            ],
                          }),
                          createNode({
                            metadata: { name: 'Layout Rooms Row' },
                            styles: {
                              properties: {
                                display: 'flex',
                                justifyContent: 'space-between',
                              },
                            },
                            children: [
                              createText('span', 'Комнат', {
                                fontSize: '14px',
                                color: colors.gray,
                                fontFamily: "'Muller', sans-serif",
                              }, { name: 'Rooms Label' }),
                              createText('span', rooms, {
                                fontSize: '14px',
                                fontWeight: '500',
                                color: colors.black,
                                fontFamily: "'Muller', sans-serif",
                              }, { name: 'Rooms Value' }),
                            ],
                          }),
                        ],
                      }),
                      // Разделитель
                      createNode({
                        metadata: { name: 'Divider' },
                        styles: {
                          properties: {
                            height: '1px',
                            backgroundColor: '#E8E8E8',
                            margin: '4px 0',
                          },
                        },
                      }),
                      // Цена
                      createText('span', price, {
                        fontSize: '22px',
                        fontWeight: '700',
                        color: colors.gold,
                        fontFamily: "'Muller', sans-serif",
                      }, { name: 'Layout Price' }),
                    ],
                  }),
                ],
              })
            ),
          }),
        ],
      }),
    ],
  })
}

// ═════════════════════════════════════════════════════════════
//  СЕКЦИЯ 6: РАСПОЛОЖЕНИЕ
// ═════════════════════════════════════════════════════════════
const createLocation = () => {
  const infrastructure = [
    { icon: '🚇', name: 'Метро', distance: '5 мин пешком' },
    { icon: '🏫', name: 'Школы', distance: '3 мин' },
    { icon: '🏥', name: 'Клиники', distance: '7 мин' },
    { icon: '🛒', name: 'ТЦ / Магазины', distance: '2 мин' },
    { icon: '🌳', name: 'Парк', distance: '10 мин' },
    { icon: '🏢', name: 'Бизнес-центры', distance: '8 мин' },
  ]

  return createNode({
    tagName: 'section',
    metadata: { name: 'Location Section' },
    styles: {
      properties: {
        padding: '100px 40px',
        backgroundColor: colors.grayLight,
      },
    },
    children: [
      createNode({
        metadata: { name: 'Location Container' },
        styles: {
          properties: {
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '80px',
            alignItems: 'start',
          },
        },
        layoutMode: 'grid',
        children: [
          // Левая колонка — информация
          createNode({
            metadata: { name: 'Location Info' },
            styles: {
              properties: {
                display: 'flex',
                flexDirection: 'column',
                gap: '32px',
              },
            },
            children: [
              createNode({
                metadata: { name: 'Location Header' },
                styles: {
                  properties: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  },
                },
                children: [
                  createText('span', 'Расположение', {
                    fontSize: '13px',
                    fontWeight: '600',
                    color: colors.gold,
                    textTransform: 'uppercase',
                    letterSpacing: '3px',
                    fontFamily: "'Muller', sans-serif",
                  }, { name: 'Section Label' }),
                  createText('h2', 'Всё необходимое рядом', {
                    fontSize: '36px',
                    fontWeight: '700',
                    color: colors.black,
                    fontFamily: "'Muller', sans-serif",
                    margin: '0',
                  }, { name: 'Location Title' }),
                ],
              }),
              // Адрес
              createNode({
                metadata: { name: 'Address Block' },
                styles: {
                  properties: {
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '20px 24px',
                    backgroundColor: colors.white,
                    borderRadius: '12px',
                    border: `1px solid rgba(210,159,102,0.2)`,
                  },
                },
                children: [
                  createText('span', '📍', {
                    fontSize: '24px',
                  }, { name: 'Address Icon' }),
                  createNode({
                    metadata: { name: 'Address Text' },
                    styles: {
                      properties: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      },
                    },
                    children: [
                      createText('span', 'Адрес', {
                        fontSize: '12px',
                        color: colors.gray,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        fontFamily: "'Muller', sans-serif",
                      }, { name: 'Address Label' }),
                      createText('span', 'ул. Юнусабад, д. 15, Ташкент', {
                        fontSize: '16px',
                        fontWeight: '500',
                        color: colors.black,
                        fontFamily: "'Muller', sans-serif",
                      }, { name: 'Address Value' }),
                    ],
                  }),
                ],
              }),
              // Инфраструктура
              createNode({
                metadata: { name: 'Infrastructure Grid' },
                styles: {
                  properties: {
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                  },
                },
                layoutMode: 'grid',
                children: infrastructure.map(({ icon, name, distance }) =>
                  createNode({
                    metadata: { name: `Infra: ${name}` },
                    styles: {
                      properties: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '16px 20px',
                        backgroundColor: colors.white,
                        borderRadius: '12px',
                      },
                    },
                    children: [
                      createText('span', icon, {
                        fontSize: '24px',
                      }, { name: 'Infra Icon' }),
                      createNode({
                        metadata: { name: 'Infra Text' },
                        styles: {
                          properties: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          },
                        },
                        children: [
                          createText('span', name, {
                            fontSize: '14px',
                            fontWeight: '500',
                            color: colors.black,
                            fontFamily: "'Muller', sans-serif",
                          }, { name: 'Infra Name' }),
                          createText('span', distance, {
                            fontSize: '12px',
                            color: colors.gray,
                            fontFamily: "'Muller', sans-serif",
                          }, { name: 'Infra Distance' }),
                        ],
                      }),
                    ],
                  })
                ),
              }),
            ],
          }),
          // Правая колонка — карта (плейсхолдер)
          createNode({
            metadata: { name: 'Map Placeholder' },
            styles: {
              properties: {
                aspectRatio: '1/1',
                borderRadius: '16px',
                overflow: 'hidden',
                backgroundColor: '#E0E0E0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              },
            },
            children: [
              createImage(
                'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800',
                'Расположение на карте',
                {
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  opacity: '0.6',
                },
                { name: 'Map Image' }
              ),
              // Маркер
              createNode({
                metadata: { name: 'Map Pin' },
                styles: {
                  properties: {
                    position: 'relative',
                    zIndex: '1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  },
                },
                children: [
                  createNode({
                    metadata: { name: 'Pin Icon' },
                    styles: {
                      properties: {
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: colors.gold,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 20px rgba(210,159,102,0.4)',
                      },
                    },
                    children: [
                      createText('span', '📍', {
                        fontSize: '22px',
                      }, { name: 'Pin Emoji' }),
                    ],
                  }),
                  createText('span', 'Golden House Premium', {
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.black,
                    fontFamily: "'Muller', sans-serif",
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    padding: '6px 16px',
                    borderRadius: '20px',
                  }, { name: 'Pin Label' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

// ═════════════════════════════════════════════════════════════
//  СЕКЦИЯ 7: CTA — Запись на просмотр
// ═════════════════════════════════════════════════════════════
const createCTA = () =>
  createNode({
    tagName: 'section',
    metadata: { name: 'CTA Section' },
    styles: {
      properties: {
        padding: '100px 40px',
        backgroundColor: colors.black,
        position: 'relative',
        overflow: 'hidden',
      },
    },
    children: [
      // Декоративный фон
      createNode({
        metadata: { name: 'CTA Background Accent' },
        styles: {
          properties: {
            position: 'absolute',
            top: '-50%',
            right: '-20%',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(210,159,102,0.1) 0%, transparent 70%)`,
            pointerEvents: 'none',
          },
        },
      }),
      createNode({
        metadata: { name: 'CTA Container' },
        styles: {
          properties: {
            maxWidth: '800px',
            margin: '0 auto',
            position: 'relative',
            zIndex: '1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '32px',
          },
        },
        children: [
          createText('span', 'Не упустите свою квартиру', {
            fontSize: '13px',
            fontWeight: '600',
            color: colors.gold,
            textTransform: 'uppercase',
            letterSpacing: '3px',
            fontFamily: "'Muller', sans-serif",
          }, { name: 'CTA Label' }),
          createText('h2', 'Запишитесь на просмотр\nвашей будущей квартиры', {
            fontSize: '40px',
            fontWeight: '700',
            color: colors.white,
            fontFamily: "'Muller', sans-serif",
            lineHeight: '1.2',
            margin: '0',
          }, { name: 'CTA Title' }),
          createText(
            'p',
            'Наш менеджер свяжется с вами в течение 15 минут, подберёт квартиру под ваши требования и организует экскурсию.',
            {
              fontSize: '16px',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: "'Muller', sans-serif",
              lineHeight: '1.6',
              maxWidth: '600px',
              margin: '0',
            },
            { name: 'CTA Description' }
          ),
          // Форма
          createNode({
            tagName: 'form',
            metadata: { name: 'CTA Form' },
            styles: {
              properties: {
                display: 'flex',
                gap: '16px',
                marginTop: '16px',
                width: '100%',
                maxWidth: '560px',
              },
            },
            children: [
              createNode({
                elementType: 'input',
                tagName: 'input',
                metadata: { name: 'Phone Input' },
                attributes: {
                  type: 'tel',
                  placeholder: '+998 (__) ___-__-__',
                  required: 'true',
                },
                styles: {
                  properties: {
                    flex: '1',
                    padding: '16px 20px',
                    fontSize: '16px',
                    fontFamily: "'Muller', sans-serif",
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    color: colors.white,
                    outline: 'none',
                  },
                },
              }),
              createNode({
                elementType: 'button',
                tagName: 'button',
                metadata: { name: 'Submit Button' },
                content: 'Записаться',
                attributes: { type: 'submit' },
                styles: {
                  properties: {
                    padding: '16px 32px',
                    fontSize: '16px',
                    fontWeight: '600',
                    fontFamily: "'Muller', sans-serif",
                    backgroundColor: colors.gold,
                    color: colors.white,
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s ease',
                    whiteSpace: 'nowrap',
                  },
                },
              }),
            ],
          }),
          createText('span', 'Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности', {
            fontSize: '12px',
            color: 'rgba(255,255,255,0.4)',
            fontFamily: "'Muller', sans-serif",
          }, { name: 'CTA Disclaimer' }),
        ],
      }),
    ],
  })

// ═════════════════════════════════════════════════════════════
//  СОБИРАЕМ СТРАНИЦУ
// ═════════════════════════════════════════════════════════════
const createPageStructure = () =>
  createNode({
    metadata: { name: 'Project Template Page' },
    styles: {
      properties: {
        fontFamily: "'Muller', sans-serif",
        color: colors.black,
        backgroundColor: colors.white,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      },
    },
    children: [
      // 1. Header — linked block
      createLinkedBlock(LINKED.header, 'Header (linked)', 'header'),
      // 2. Hero
      createHero(),
      // 3. Ключевые цифры
      createKeyStats(),
      // 4. О проекте
      createAbout(),
      // 5. Галерея
      createGallery(),
      // 6. Планировки
      createLayouts(),
      // 7. Расположение
      createLocation(),
      // 8. CTA — запись на просмотр
      createCTA(),
      // 9. Footer — linked block
      createLinkedBlock(LINKED.footer, 'Footer (linked)', 'footer'),
    ],
  })

// ═════════════════════════════════════════════════════════════
//  SEED СКРИПТ
// ═════════════════════════════════════════════════════════════
async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function apiDelete(path) {
  const res = await fetch(`${API_URL}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function apiPut(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function seedProjectTemplate() {
  console.log('🚀 Создание шаблонной страницы проекта...\n')

  try {
    // Удалить или обновить старую версию если есть
    let existingPage = null
    try {
      const existing = await apiGet('/pages')
      existingPage = existing.find((p) => p.slug === 'project-template')
    } catch (_) {
      // Нет старой страницы — ок
    }

    const pageData = {
      name: 'Шаблон страницы проекта',
      slug: 'project-template',
      siteId: SITE_ID,
      metadata: {
        title: '{{item.title}} — Жилой комплекс',
        description:
          '{{item.description}}',
        keywords: [
          'golden house',
          'жилой комплекс',
          'квартиры',
          'ташкент',
          'новостройка',
          'бизнес-класс',
        ],
      },
      structure: createPageStructure(),
      status: 'draft',
      isTemplate: true,
    }

    let page
    if (existingPage) {
      // Обновляем существующую (может быть привязана к коллекции через FK)
      page = await apiPut(`/pages/${existingPage.id}`, {
        structure: pageData.structure,
        metadata: pageData.metadata,
        isTemplate: true,
      })
      console.log('♻️  Шаблон страницы проекта обновлён!')
    } else {
      page = await apiPost('/pages', pageData)
      console.log('✅ Шаблон страницы проекта создан!')
    }
    console.log(`   📄 ID:       ${page.id}`)
    console.log(`   🔗 Slug:     /${page.slug}`)
    console.log(`   📌 Template: ${page.isTemplate}`)
    console.log(`   📊 Status:   ${page.status}`)
    console.log(`\n🎨 Откройте в редакторе:`)
    console.log(`   http://localhost:3001/editor/page/${page.id}`)
    console.log(`\n📋 Секции:`)
    console.log('   1. Header (linked block)')
    console.log('   2. Hero — фото + название + цена')
    console.log('   3. Ключевые цифры — 4 карточки')
    console.log('   4. О проекте — текст + фото + фичи')
    console.log('   5. Галерея — 5 фото (masonry grid)')
    console.log('   6. Планировки — 4 карточки')
    console.log('   7. Расположение — инфраструктура + карта')
    console.log('   8. CTA — форма записи на просмотр')
    console.log('   9. Footer (linked block)')
  } catch (error) {
    console.error('❌ Ошибка:', error.message)
    console.log('\n💡 Убедитесь, что backend запущен: docker compose up -d')
    process.exit(1)
  }
}

seedProjectTemplate()
