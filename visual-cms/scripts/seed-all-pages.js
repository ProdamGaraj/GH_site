/**
 * Скрипт для создания всех страниц Golden House
 * Запуск: node scripts/seed-all-pages.js
 *
 * Страницы:
 *  1. Главная (home)
 *  2. О компании (about)
 *  3. Жилые комплексы (residential)
 *  4. Коммерческие объекты (commercial)
 *  5. Новости и акции (news)
 *  6. Карьера (career)
 *  7. Контакты (contacts)
 *  8. Публичная оферта (legal)
 */

const API_URL = 'http://localhost:5000/api'

// ──────────────────── UTILITIES ────────────────────

let idCounter = 0
const generateId = (prefix = 'gh') => `${prefix}-${Date.now()}-${++idCounter}`

const createNode = (overrides) => ({
  id: generateId(),
  elementType: 'container',
  tagName: 'div',
  tag: 'div',
  styles: { properties: {} },
  layoutMode: undefined,
  children: [],
  metadata: { name: 'Element' },
  content: '',
  attributes: {},
  ...overrides,
})

// ──────────────────── BRAND TOKENS ────────────────────

const colors = {
  gold: '#D29F66',
  goldMuted: '#C4A77D',
  goldDark: '#B8864D',
  goldLight: '#E4C9A8',
  black: '#1A1A1A',
  charcoal: '#2D2D2D',
  darkBrown: '#403E3D',
  white: '#FFFFFF',
  cream: '#FAFAF8',
  gray: '#8A8A8A',
  grayLight: '#E8E8E8',
  grayLighter: '#F5F5F5',
  grayDark: '#4A4A4A',
}

const font = "'Muller', 'Inter', Arial, sans-serif"

// ──────────────────── SHARED COMPONENTS ────────────────────

const navLinks = [
  { label: 'О компании', href: '/about' },
  { label: 'Жилые комплексы', href: '/residential' },
  { label: 'Коммерция', href: '/commercial' },
  { label: 'Новости', href: '/news' },
  { label: 'Контакты', href: '/contacts' },
]

function createHeader() {
  return createNode({
    tagName: 'header',
    tag: 'header',
    metadata: { name: 'Header' },
    styles: {
      properties: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '80px',
        padding: '0 60px',
        backgroundColor: colors.darkBrown,
        position: 'sticky',
        top: '0',
        zIndex: '1000',
      },
    },
    children: [
      // LEFT: Logo
      createNode({
        metadata: { name: 'Header Left' },
        layoutMode: 'flex',
        styles: { properties: { display: 'flex', alignItems: 'center', minWidth: '200px' } },
        children: [
          createNode({
            elementType: 'text',
            tagName: 'a',
            tag: 'a',
            metadata: { name: 'Logo' },
            content: 'GOLDEN HOUSE',
            attributes: { href: '/' },
            styles: {
              properties: {
                color: colors.gold,
                fontSize: '22px',
                fontWeight: '700',
                fontFamily: font,
                letterSpacing: '3px',
                textDecoration: 'none',
              },
            },
          }),
        ],
      }),
      // Divider left
      createNode({
        metadata: { name: 'Header Divider L' },
        styles: { properties: { width: '1px', height: '32px', backgroundColor: 'rgba(255,255,255,0.15)', margin: '0 24px' } },
      }),
      // CENTER: Navigation
      createNode({
        tagName: 'nav',
        tag: 'nav',
        metadata: { name: 'Navigation' },
        layoutMode: 'flex',
        styles: {
          properties: {
            display: 'flex',
            gap: '28px',
            flex: '1',
            justifyContent: 'center',
          },
        },
        children: navLinks.map(link =>
          createNode({
            elementType: 'text',
            tagName: 'a',
            tag: 'a',
            metadata: { name: `Nav - ${link.label}` },
            content: link.label,
            attributes: { href: link.href },
            styles: {
              properties: {
                color: 'rgba(255,255,255,0.85)',
                fontSize: '13px',
                fontFamily: font,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                textDecoration: 'none',
              },
              states: {
                hover: { color: colors.gold },
              },
              stateTransition: { duration: 200, easing: 'ease', properties: ['color'] },
            },
          })
        ),
      }),
      // Divider right
      createNode({
        metadata: { name: 'Header Divider R' },
        styles: { properties: { width: '1px', height: '32px', backgroundColor: 'rgba(255,255,255,0.15)', margin: '0 24px' } },
      }),
      // RIGHT: Contacts
      createNode({
        metadata: { name: 'Header Right' },
        layoutMode: 'flex',
        styles: { properties: { display: 'flex', alignItems: 'center', gap: '20px', minWidth: '200px', justifyContent: 'flex-end' } },
        children: [
          createNode({
            elementType: 'text',
            tagName: 'a',
            tag: 'a',
            metadata: { name: 'Phone' },
            content: '+998 78 150 11 11',
            attributes: { href: 'tel:+998781501111' },
            styles: {
              properties: {
                color: colors.white,
                fontSize: '14px',
                fontFamily: font,
                fontWeight: '500',
                letterSpacing: '0.5px',
                textDecoration: 'none',
              },
            },
          }),
          createNode({
            elementType: 'button',
            tagName: 'button',
            tag: 'button',
            metadata: { name: 'Callback Button' },
            content: 'Перезвоните мне',
            styles: {
              properties: {
                padding: '10px 20px',
                backgroundColor: colors.gold,
                color: colors.white,
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                fontFamily: font,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: 'pointer',
              },
              states: { hover: { backgroundColor: colors.goldDark } },
              stateTransition: { duration: 200, easing: 'ease', properties: ['background-color'] },
            },
          }),
        ],
      }),
    ],
  })
}

function createFooter() {
  return createNode({
    tagName: 'footer',
    tag: 'footer',
    metadata: { name: 'Footer' },
    styles: {
      properties: {
        backgroundColor: colors.darkBrown,
        color: 'rgba(255,255,255,0.7)',
        padding: '80px 80px 40px',
      },
    },
    children: [
      // Top row: logo + nav columns + contacts
      createNode({
        metadata: { name: 'Footer Top' },
        styles: {
          properties: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: '48px',
            marginBottom: '60px',
          },
        },
        children: [
          // Logo + tagline
          createNode({
            metadata: { name: 'Footer Brand' },
            styles: { properties: { display: 'flex', flexDirection: 'column' } },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'span',
                tag: 'span',
                metadata: { name: 'Footer Logo' },
                content: 'GOLDEN HOUSE',
                styles: {
                  properties: {
                    color: colors.gold,
                    fontSize: '20px',
                    fontWeight: '700',
                    letterSpacing: '3px',
                    marginBottom: '16px',
                    fontFamily: font,
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'p',
                tag: 'p',
                metadata: { name: 'Footer Tagline' },
                content: 'Девелопер премиальной недвижимости в Узбекистане',
                styles: {
                  properties: {
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: 'rgba(255,255,255,0.5)',
                  },
                },
              }),
            ],
          }),
          // Nav column 1
          createNode({
            metadata: { name: 'Footer Nav 1' },
            styles: { properties: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            children: [
              createNode({
                elementType: 'text', tagName: 'span', tag: 'span',
                metadata: { name: 'Footer Nav Title' },
                content: 'Проекты',
                styles: { properties: { color: colors.white, fontSize: '14px', fontWeight: '600', marginBottom: '8px' } },
              }),
              ...['Жилые комплексы', 'Коммерция', 'На карте'].map(t =>
                createNode({
                  elementType: 'text', tagName: 'a', tag: 'a',
                  metadata: { name: `Footer Link - ${t}` },
                  content: t,
                  attributes: { href: '#' },
                  styles: { properties: { color: 'rgba(255,255,255,0.5)', fontSize: '14px', textDecoration: 'none' } },
                })
              ),
            ],
          }),
          // Nav column 2
          createNode({
            metadata: { name: 'Footer Nav 2' },
            styles: { properties: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            children: [
              createNode({
                elementType: 'text', tagName: 'span', tag: 'span',
                metadata: { name: 'Footer Nav Title 2' },
                content: 'Компания',
                styles: { properties: { color: colors.white, fontSize: '14px', fontWeight: '600', marginBottom: '8px' } },
              }),
              ...['О компании', 'Новости', 'Карьера', 'Оферта'].map(t =>
                createNode({
                  elementType: 'text', tagName: 'a', tag: 'a',
                  metadata: { name: `Footer Link - ${t}` },
                  content: t,
                  attributes: { href: '#' },
                  styles: { properties: { color: 'rgba(255,255,255,0.5)', fontSize: '14px', textDecoration: 'none' } },
                })
              ),
            ],
          }),
          // Contacts column
          createNode({
            metadata: { name: 'Footer Contacts' },
            styles: { properties: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            children: [
              createNode({
                elementType: 'text', tagName: 'span', tag: 'span',
                metadata: { name: 'Footer Contacts Title' },
                content: 'Контакты',
                styles: { properties: { color: colors.white, fontSize: '14px', fontWeight: '600', marginBottom: '8px' } },
              }),
              createNode({
                elementType: 'text', tagName: 'a', tag: 'a',
                metadata: { name: 'Footer Phone' },
                content: '+998 78 150 11 11',
                attributes: { href: 'tel:+998781501111' },
                styles: { properties: { color: colors.gold, fontSize: '14px', textDecoration: 'none' } },
              }),
              createNode({
                elementType: 'text', tagName: 'a', tag: 'a',
                metadata: { name: 'Footer Email' },
                content: 'info@goldenhouse.uz',
                attributes: { href: 'mailto:info@goldenhouse.uz' },
                styles: { properties: { color: 'rgba(255,255,255,0.5)', fontSize: '14px', textDecoration: 'none' } },
              }),
              // Social links
              createNode({
                metadata: { name: 'Social Links' },
                layoutMode: 'flex',
                styles: { properties: { display: 'flex', gap: '16px', marginTop: '8px' } },
                children: ['Telegram', 'Instagram', 'Facebook'].map(s =>
                  createNode({
                    elementType: 'text', tagName: 'a', tag: 'a',
                    metadata: { name: `Social - ${s}` },
                    content: s,
                    attributes: { href: '#' },
                    styles: { properties: { color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' } },
                  })
                ),
              }),
            ],
          }),
        ],
      }),
      // Divider
      createNode({
        metadata: { name: 'Footer Divider' },
        styles: { properties: { height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: '24px' } },
      }),
      // Bottom row
      createNode({
        metadata: { name: 'Footer Bottom' },
        layoutMode: 'flex',
        styles: {
          properties: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
        },
        children: [
          createNode({
            elementType: 'text', tagName: 'span', tag: 'span',
            metadata: { name: 'Copyright' },
            content: '© 2024 Golden House. Все права защищены.',
            styles: { properties: { fontSize: '13px', color: 'rgba(255,255,255,0.4)' } },
          }),
          createNode({
            elementType: 'text', tagName: 'a', tag: 'a',
            metadata: { name: 'Footer Legal' },
            content: 'Публичная оферта',
            attributes: { href: '/legal' },
            styles: { properties: { fontSize: '13px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' } },
          }),
        ],
      }),
    ],
  })
}

function createSectionLabel(label) {
  return createNode({
    elementType: 'text',
    tagName: 'p',
    tag: 'p',
    metadata: { name: `Label - ${label}` },
    content: label,
    styles: {
      properties: {
        color: colors.gold,
        fontSize: '12px',
        letterSpacing: '3px',
        textTransform: 'uppercase',
        marginBottom: '16px',
        fontFamily: font,
        fontWeight: '500',
      },
    },
  })
}

function createSectionTitle(title) {
  return createNode({
    elementType: 'text',
    tagName: 'h2',
    tag: 'h2',
    metadata: { name: `Title - ${title.slice(0, 30)}` },
    content: title,
    styles: {
      properties: {
        fontSize: '42px',
        fontWeight: '300',
        color: colors.black,
        lineHeight: '1.25',
        letterSpacing: '-1px',
        fontFamily: font,
      },
    },
  })
}

function createPageRoot(name, children) {
  return createNode({
    tagName: 'div',
    tag: 'div',
    metadata: {
      name,
      breakpoints: [
        { id: 'tablet', name: 'Tablet', width: 768 },
        { id: 'mobile', name: 'Mobile', width: 480 },
      ],
    },
    layoutMode: 'flex',
    styles: {
      properties: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        width: '100%',
        fontFamily: font,
        color: colors.black,
      },
    },
    children,
  })
}

function createCTAButton(text, href, variant = 'primary') {
  const isPrimary = variant === 'primary'
  return createNode({
    elementType: 'button',
    tagName: 'a',
    tag: 'a',
    metadata: { name: `CTA - ${text}` },
    content: text,
    attributes: { href },
    styles: {
      properties: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 48px',
        backgroundColor: isPrimary ? colors.gold : 'transparent',
        color: isPrimary ? colors.white : colors.white,
        border: isPrimary ? 'none' : '1px solid rgba(255,255,255,0.4)',
        borderRadius: '4px',
        fontSize: '13px',
        fontWeight: '600',
        fontFamily: font,
        textTransform: 'uppercase',
        letterSpacing: '2px',
        textDecoration: 'none',
        cursor: 'pointer',
      },
      states: {
        hover: {
          backgroundColor: isPrimary ? colors.goldDark : 'rgba(255,255,255,0.1)',
        },
      },
      stateTransition: { duration: 200, easing: 'ease', properties: ['background-color'] },
    },
  })
}

// ──────────────────────────────────────────────────────────
// PAGE 1: ГЛАВНАЯ (home)
// ──────────────────────────────────────────────────────────

function createHomePage() {

  // ====== HERO CAROUSEL (п.1, п.2, п.3, п.6) ======
  // Карусель из 3 слайдов, усиленный overlay, жирный CTA, text-shadow для читаемости

  const heroSlides = [
    {
      bg: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1920',
      label: 'Жилой комплекс премиум-класса',
      title: 'Golden House Premium',
      subtitle: 'Квартиры от 45 м² в Юнусабадском районе',
      cta: 'Выбрать квартиру',
      ctaHref: '/residential',
    },
    {
      bg: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920',
      label: 'Коммерческая недвижимость',
      title: 'Пространства для бизнеса',
      subtitle: 'Офисы и торговые помещения с отделкой под ключ',
      cta: 'Смотреть помещения',
      ctaHref: '/commercial',
    },
    {
      bg: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1920',
      label: 'Новый проект 2026',
      title: 'Golden House Elite',
      subtitle: 'Старт продаж — выгодные цены на этапе строительства',
      cta: 'Узнать подробности',
      ctaHref: '/residential',
    },
  ]

  const hero = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Hero Carousel' },
    styles: {
      properties: {
        position: 'relative',
        overflow: 'hidden',
      },
    },
    children: [
      // Slides wrapper
      createNode({
        metadata: { name: 'Carousel Slides' },
        layoutMode: 'flex',
        styles: {
          properties: {
            display: 'flex',
            width: `${heroSlides.length * 100}%`,
            transition: 'transform 0.6s ease-in-out',
          },
        },
        children: heroSlides.map((slide, i) => createNode({
          metadata: { name: `Slide ${i + 1}` },
          styles: {
            properties: {
              width: `${100 / heroSlides.length}%`,
              height: '100vh',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundImage: `url(${slide.bg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              flexShrink: '0',
            },
          },
          children: [
            // Усиленный overlay для читаемости (п.1)
            createNode({
              metadata: { name: 'Slide Overlay' },
              styles: {
                properties: {
                  position: 'absolute',
                  top: '0', left: '0', right: '0', bottom: '0',
                  background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.6) 100%)',
                },
              },
            }),
            // Содержимое слайда
            createNode({
              metadata: { name: 'Slide Content' },
              styles: {
                properties: {
                  position: 'relative',
                  zIndex: '1',
                  textAlign: 'center',
                  maxWidth: '750px',
                  padding: '0 40px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                },
              },
              children: [
                createNode({
                  elementType: 'text', tagName: 'p', tag: 'p',
                  metadata: { name: 'Slide Label' },
                  content: slide.label,
                  styles: {
                    properties: {
                      color: colors.gold,
                      fontSize: '13px',
                      letterSpacing: '4px',
                      textTransform: 'uppercase',
                      marginBottom: '20px',
                      fontWeight: '600',
                    },
                  },
                }),
                createNode({
                  elementType: 'text', tagName: 'h1', tag: 'h1',
                  metadata: { name: 'Slide Title' },
                  content: slide.title,
                  styles: {
                    properties: {
                      color: colors.white,
                      fontSize: '60px',
                      fontWeight: '700',
                      lineHeight: '1.1',
                      marginBottom: '16px',
                      letterSpacing: '-1px',
                      textShadow: '0 2px 20px rgba(0,0,0,0.5)',
                    },
                  },
                }),
                createNode({
                  elementType: 'text', tagName: 'p', tag: 'p',
                  metadata: { name: 'Slide Subtitle' },
                  content: slide.subtitle,
                  styles: {
                    properties: {
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: '20px',
                      fontWeight: '400',
                      lineHeight: '1.5',
                      marginBottom: '36px',
                      textShadow: '0 1px 8px rgba(0,0,0,0.4)',
                    },
                  },
                }),
                // Усиленный CTA (п.2) — крупная яркая кнопка
                createNode({
                  elementType: 'button', tagName: 'a', tag: 'a',
                  metadata: { name: 'Slide CTA' },
                  content: slide.cta,
                  attributes: { href: slide.ctaHref },
                  styles: {
                    properties: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '20px 56px',
                      backgroundColor: colors.gold,
                      color: colors.white,
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '16px',
                      fontWeight: '700',
                      fontFamily: font,
                      textTransform: 'uppercase',
                      letterSpacing: '2px',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 24px rgba(210,159,102,0.4)',
                    },
                    states: {
                      hover: {
                        backgroundColor: colors.goldDark,
                        boxShadow: '0 6px 32px rgba(210,159,102,0.6)',
                        transform: 'translateY(-2px)',
                      },
                    },
                    stateTransition: { duration: 250, easing: 'ease-out', properties: ['background-color', 'box-shadow', 'transform'] },
                  },
                }),
              ],
            }),
          ],
        })),
      }),
      // Carousel dots
      createNode({
        metadata: { name: 'Carousel Dots' },
        layoutMode: 'flex',
        styles: {
          properties: {
            position: 'absolute',
            bottom: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '12px',
            zIndex: '2',
          },
        },
        children: heroSlides.map((_, i) => createNode({
          metadata: { name: `Dot ${i + 1}` },
          styles: {
            properties: {
              width: i === 0 ? '32px' : '10px',
              height: '10px',
              borderRadius: '5px',
              backgroundColor: i === 0 ? colors.gold : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            },
          },
        })),
      }),
      // Left/Right arrows
      createNode({
        elementType: 'button', tagName: 'button', tag: 'button',
        metadata: { name: 'Arrow Left' },
        content: '‹',
        styles: {
          properties: {
            position: 'absolute',
            left: '24px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: colors.white,
            border: '1px solid rgba(255,255,255,0.3)',
            fontSize: '24px',
            cursor: 'pointer',
            zIndex: '2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
          states: { hover: { backgroundColor: 'rgba(255,255,255,0.3)' } },
          stateTransition: { duration: 200, easing: 'ease', properties: ['background-color'] },
        },
      }),
      createNode({
        elementType: 'button', tagName: 'button', tag: 'button',
        metadata: { name: 'Arrow Right' },
        content: '›',
        styles: {
          properties: {
            position: 'absolute',
            right: '24px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: colors.white,
            border: '1px solid rgba(255,255,255,0.3)',
            fontSize: '24px',
            cursor: 'pointer',
            zIndex: '2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
          states: { hover: { backgroundColor: 'rgba(255,255,255,0.3)' } },
          stateTransition: { duration: 200, easing: 'ease', properties: ['background-color'] },
        },
      }),
    ],
  })

  // ====== STATS SECTION (п.4 — дизайн по фото) ======
  // «Цифры говорят сами за себя» — золотые цифры, подписи мелким текстом, бежевый фон
  const stats = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Stats Section' },
    styles: {
      properties: {
        padding: '60px 60px',
        backgroundColor: colors.cream,
      },
    },
    children: [
      createNode({
        metadata: { name: 'Stats Container' },
        styles: { properties: { maxWidth: '1200px', margin: '0 auto' } },
        children: [
          // Title
          createNode({
            elementType: 'text', tagName: 'h2', tag: 'h2',
            metadata: { name: 'Stats Title' },
            content: 'Цифры говорят сами за себя:',
            styles: {
              properties: {
                fontSize: '28px',
                fontWeight: '600',
                color: colors.black,
                marginBottom: '40px',
              },
            },
          }),
          // Stats grid 2x2
          createNode({
            metadata: { name: 'Stats Grid' },
            styles: {
              properties: {
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '32px',
              },
            },
            children: [
              { prefix: '>', value: '15', unit: '', label: 'лет опыта' },
              { prefix: '>', value: '1', unit: ' МЛН М²', label: 'построено' },
              { prefix: '', value: '65', unit: '', label: 'проектов\nв портфолио' },
              { prefix: '', value: '30', unit: ' тыс.', label: 'семей живут\nв наших домах' },
            ].map(s => createNode({
              metadata: { name: `Stat - ${s.label.split('\n')[0]}` },
              styles: {
                properties: {
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '20px 0',
                },
              },
              children: [
                // Number row: prefix + value + unit
                createNode({
                  metadata: { name: 'Stat Number Row' },
                  layoutMode: 'flex',
                  styles: { properties: { display: 'flex', alignItems: 'baseline', gap: '0px' } },
                  children: [
                    ...(s.prefix ? [createNode({
                      elementType: 'text', tagName: 'span', tag: 'span',
                      metadata: { name: 'Stat Prefix' },
                      content: s.prefix,
                      styles: { properties: { fontSize: '36px', fontWeight: '700', color: colors.gold } },
                    })] : []),
                    createNode({
                      elementType: 'text', tagName: 'span', tag: 'span',
                      metadata: { name: 'Stat Value' },
                      content: s.value,
                      styles: { properties: { fontSize: '56px', fontWeight: '700', color: colors.gold, lineHeight: '1', letterSpacing: '-2px' } },
                    }),
                    ...(s.unit ? [createNode({
                      elementType: 'text', tagName: 'span', tag: 'span',
                      metadata: { name: 'Stat Unit' },
                      content: s.unit,
                      styles: { properties: { fontSize: '20px', fontWeight: '600', color: colors.gold, marginLeft: '4px' } },
                    })] : []),
                  ],
                }),
                // Label
                createNode({
                  elementType: 'text', tagName: 'span', tag: 'span',
                  metadata: { name: 'Stat Label' },
                  content: s.label.replace('\n', ' '),
                  styles: { properties: { fontSize: '14px', color: colors.grayDark, marginTop: '4px', lineHeight: '1.4' } },
                }),
              ],
            })),
          }),
        ],
      }),
    ],
  })

  // ====== HISTORY TIMELINE BLOCK (п.11 — О компании - блок ИСТОРИЯ) ======
  // Вертикальный таймлайн как на фото 2
  const historyBlock = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'History Section' },
    styles: {
      properties: {
        padding: '80px 60px',
        backgroundColor: colors.white,
      },
    },
    children: [
      createNode({
        metadata: { name: 'History Container' },
        styles: { properties: { maxWidth: '900px', margin: '0 auto' } },
        children: [
          // Section header
          createNode({
            metadata: { name: 'History Header' },
            styles: { properties: { textAlign: 'center', marginBottom: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
            children: [
              createSectionLabel('О компании'),
              createSectionTitle('С уверенностью к будущему'),
            ],
          }),
          // Vertical timeline
          createNode({
            metadata: { name: 'Timeline' },
            styles: {
              properties: {
                position: 'relative',
                paddingLeft: '60px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0px',
              },
            },
            children: [
              // Timeline vertical line
              createNode({
                metadata: { name: 'Timeline Line' },
                styles: {
                  properties: {
                    position: 'absolute',
                    left: '20px',
                    top: '0',
                    bottom: '0',
                    width: '2px',
                    backgroundColor: colors.gold,
                  },
                },
              }),
              // Timeline items
              ...[
                { year: '2009', title: 'Основание компании', desc: 'Национальный лидер рынка недвижимости Узбекистана' },
                { year: '2020', title: 'Создание единственной в стране наноструктурной лаборатории', desc: '29 жилых комплексов. ~50 коммерческих объектов' },
                { year: '2022', title: 'Производство модулей', desc: 'Запуск собственного производства строительных модулей' },
                { year: '2024', title: 'Запуск Digital CMS', desc: 'Цифровая платформа для управления проектами и продажами. GH в ТОП-3 застройщиков' },
              ].map((item, i) => createNode({
                metadata: { name: `Timeline ${item.year}` },
                styles: {
                  properties: {
                    position: 'relative',
                    paddingBottom: '48px',
                    paddingLeft: '32px',
                  },
                },
                children: [
                  // Dot on timeline
                  createNode({
                    metadata: { name: 'Timeline Dot' },
                    styles: {
                      properties: {
                        position: 'absolute',
                        left: '-52px',
                        top: '4px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: colors.gold,
                        border: `3px solid ${colors.white}`,
                        boxShadow: `0 0 0 2px ${colors.gold}`,
                      },
                    },
                  }),
                  // Year
                  createNode({
                    elementType: 'text', tagName: 'span', tag: 'span',
                    metadata: { name: 'Timeline Year' },
                    content: item.year,
                    styles: { properties: { fontSize: '32px', fontWeight: '700', color: colors.gold, display: 'block', marginBottom: '8px', letterSpacing: '-1px' } },
                  }),
                  // Title
                  createNode({
                    elementType: 'text', tagName: 'h3', tag: 'h3',
                    metadata: { name: 'Timeline Title' },
                    content: item.title,
                    styles: { properties: { fontSize: '18px', fontWeight: '600', color: colors.black, marginBottom: '6px' } },
                  }),
                  // Description
                  createNode({
                    elementType: 'text', tagName: 'p', tag: 'p',
                    metadata: { name: 'Timeline Desc' },
                    content: item.desc,
                    styles: { properties: { fontSize: '14px', color: colors.grayDark, lineHeight: '1.6' } },
                  }),
                ],
              })),
            ],
          }),
        ],
      }),
    ],
  })

  // ====== PROJECTS WITH CLASS FILTER (п.8) ======
  const projectsPreview = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Projects Preview' },
    styles: {
      properties: {
        padding: '80px 60px',
        backgroundColor: colors.grayLighter,
      },
    },
    children: [
      createNode({
        metadata: { name: 'Projects Container' },
        styles: { properties: { maxWidth: '1200px', margin: '0 auto' } },
        children: [
          createNode({
            metadata: { name: 'Projects Header' },
            layoutMode: 'flex',
            styles: { properties: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' } },
            children: [
              createNode({
                metadata: { name: 'Projects Title Group' },
                styles: { properties: { display: 'flex', flexDirection: 'column' } },
                children: [
                  createSectionLabel('Проекты'),
                  createSectionTitle('Жилые комплексы'),
                ],
              }),
              createNode({
                elementType: 'text', tagName: 'a', tag: 'a',
                metadata: { name: 'All Projects Link' },
                content: 'Все проекты →',
                attributes: { href: '/residential' },
                styles: { properties: { color: colors.gold, fontSize: '14px', textDecoration: 'none', letterSpacing: '1px' } },
              }),
            ],
          }),
          // Class filter tabs (п.8)
          createNode({
            metadata: { name: 'Class Filter' },
            layoutMode: 'flex',
            styles: { properties: { display: 'flex', gap: '8px', marginBottom: '32px' } },
            children: ['Все', 'Комфорт+', 'Бизнес'].map((t, i) =>
              createNode({
                elementType: 'button', tagName: 'button', tag: 'button',
                metadata: { name: `Filter - ${t}` },
                content: t,
                styles: {
                  properties: {
                    padding: '8px 24px',
                    backgroundColor: i === 0 ? colors.gold : 'transparent',
                    color: i === 0 ? colors.white : colors.grayDark,
                    border: i === 0 ? 'none' : `1px solid ${colors.grayLight}`,
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  },
                  states: { hover: { backgroundColor: i === 0 ? colors.goldDark : colors.grayLighter, borderColor: colors.gold } },
                  stateTransition: { duration: 200, easing: 'ease', properties: ['background-color', 'border-color'] },
                },
              })
            ),
          }),
          // Project cards
          createNode({
            metadata: { name: 'Projects Grid' },
            styles: {
              properties: {
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '24px',
              },
            },
            children: [
              { name: 'Golden House Premium', cls: 'Бизнес', area: 'Юнусабадский район', price: 'от $1 200/м²', img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600' },
              { name: 'Golden House Elite', cls: 'Бизнес', area: 'Мирзо Улугбек', price: 'от $950/м²', img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600' },
              { name: 'Golden House Modern', cls: 'Комфорт+', area: 'Чиланзарский район', price: 'от $800/м²', img: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600' },
            ].map(p => createNode({
              metadata: { name: `Project Card - ${p.name}` },
              styles: {
                properties: {
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: colors.white,
                  boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                },
                states: {
                  hover: {
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    transform: 'translateY(-4px)',
                  },
                },
                stateTransition: { duration: 300, easing: 'ease-out', properties: ['box-shadow', 'transform'] },
              },
              children: [
                // Image + class badge
                createNode({
                  metadata: { name: 'Card Image Wrap' },
                  styles: { properties: { position: 'relative' } },
                  children: [
                    createNode({
                      elementType: 'image', tagName: 'img', tag: 'img',
                      metadata: { name: 'Project Image' },
                      attributes: { src: p.img, alt: p.name },
                      styles: { properties: { width: '100%', height: '220px', objectFit: 'cover' } },
                    }),
                    // Class badge
                    createNode({
                      elementType: 'text', tagName: 'span', tag: 'span',
                      metadata: { name: 'Class Badge' },
                      content: p.cls,
                      styles: {
                        properties: {
                          position: 'absolute',
                          top: '12px', left: '12px',
                          padding: '4px 12px',
                          backgroundColor: p.cls === 'Бизнес' ? colors.gold : colors.charcoal,
                          color: colors.white,
                          fontSize: '11px',
                          fontWeight: '600',
                          borderRadius: '3px',
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                        },
                      },
                    }),
                  ],
                }),
                createNode({
                  metadata: { name: 'Project Info' },
                  styles: { properties: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' } },
                  children: [
                    createNode({
                      elementType: 'text', tagName: 'h3', tag: 'h3',
                      metadata: { name: 'Project Name' },
                      content: p.name,
                      styles: { properties: { fontSize: '18px', fontWeight: '600', color: colors.black } },
                    }),
                    createNode({
                      elementType: 'text', tagName: 'p', tag: 'p',
                      metadata: { name: 'Project Area' },
                      content: p.area,
                      styles: { properties: { fontSize: '13px', color: colors.gray } },
                    }),
                    createNode({
                      elementType: 'text', tagName: 'span', tag: 'span',
                      metadata: { name: 'Project Price' },
                      content: p.price,
                      styles: { properties: { fontSize: '16px', fontWeight: '600', color: colors.gold, marginTop: '4px' } },
                    }),
                  ],
                }),
              ],
            })),
          }),
        ],
      }),
    ],
  })

  // ====== NEWS / PROMOTIONS BLOCK (п.9) ======
  const newsPreview = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'News & Promotions' },
    styles: {
      properties: {
        padding: '80px 60px',
        backgroundColor: colors.white,
      },
    },
    children: [
      createNode({
        metadata: { name: 'News Container' },
        styles: { properties: { maxWidth: '1200px', margin: '0 auto' } },
        children: [
          createNode({
            metadata: { name: 'News Header' },
            layoutMode: 'flex',
            styles: { properties: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' } },
            children: [
              createNode({
                metadata: { name: 'News Title Group' },
                styles: { properties: { display: 'flex', flexDirection: 'column' } },
                children: [
                  createSectionLabel('Новости и акции'),
                  createSectionTitle('Последние обновления'),
                ],
              }),
              createNode({
                elementType: 'text', tagName: 'a', tag: 'a',
                metadata: { name: 'All News Link' },
                content: 'Все новости →',
                attributes: { href: '/news' },
                styles: { properties: { color: colors.gold, fontSize: '14px', textDecoration: 'none', letterSpacing: '1px' } },
              }),
            ],
          }),
          createNode({
            metadata: { name: 'News Grid' },
            styles: {
              properties: {
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '24px',
              },
            },
            children: [
              { title: 'Старт продаж Golden House Premium', date: '15 марта 2026', tag: 'Событие', img: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400' },
              { title: 'Скидка 10% на коммерческие помещения', date: '10 марта 2026', tag: 'Акция', img: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400' },
              { title: 'Новый жилой комплекс в Юнусабаде', date: '1 марта 2026', tag: 'Новость', img: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400' },
            ].map(n => createNode({
              metadata: { name: `News Card - ${n.title.slice(0, 25)}` },
              styles: {
                properties: {
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: colors.white,
                  border: `1px solid ${colors.grayLight}`,
                },
                states: {
                  hover: { boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderColor: 'transparent' },
                },
                stateTransition: { duration: 200, easing: 'ease', properties: ['box-shadow', 'border-color'] },
              },
              children: [
                createNode({
                  elementType: 'image', tagName: 'img', tag: 'img',
                  metadata: { name: 'News Image' },
                  attributes: { src: n.img, alt: n.title },
                  styles: { properties: { width: '100%', height: '180px', objectFit: 'cover' } },
                }),
                createNode({
                  metadata: { name: 'News Body' },
                  styles: { properties: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' } },
                  children: [
                    createNode({
                      metadata: { name: 'News Meta' },
                      layoutMode: 'flex',
                      styles: { properties: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                      children: [
                        createNode({
                          elementType: 'text', tagName: 'span', tag: 'span',
                          metadata: { name: 'News Tag' },
                          content: n.tag,
                          styles: { properties: { color: colors.gold, fontSize: '11px', fontWeight: '600', letterSpacing: '1.5px', textTransform: 'uppercase' } },
                        }),
                        createNode({
                          elementType: 'text', tagName: 'span', tag: 'span',
                          metadata: { name: 'News Date' },
                          content: n.date,
                          styles: { properties: { fontSize: '12px', color: colors.gray } },
                        }),
                      ],
                    }),
                    createNode({
                      elementType: 'text', tagName: 'h3', tag: 'h3',
                      metadata: { name: 'News Title' },
                      content: n.title,
                      styles: { properties: { fontSize: '17px', fontWeight: '600', color: colors.black, lineHeight: '1.4' } },
                    }),
                  ],
                }),
              ],
            })),
          }),
        ],
      }),
    ],
  })

  // ====== DKS BLOCK (п.10 — Дирекция Клиентского Сервиса) ======
  const dksBlock = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'DKS Section' },
    styles: {
      properties: {
        padding: '80px 60px',
        backgroundColor: colors.darkBrown,
      },
    },
    children: [
      createNode({
        metadata: { name: 'DKS Container' },
        styles: {
          properties: {
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '60px',
            alignItems: 'center',
          },
        },
        children: [
          // Left: description
          createNode({
            metadata: { name: 'DKS Info' },
            styles: { properties: { display: 'flex', flexDirection: 'column' } },
            children: [
              createNode({
                elementType: 'text', tagName: 'p', tag: 'p',
                metadata: { name: 'DKS Label' },
                content: 'Дирекция Клиентского Сервиса',
                styles: { properties: { color: colors.gold, fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px', fontWeight: '600' } },
              }),
              createNode({
                elementType: 'text', tagName: 'h2', tag: 'h2',
                metadata: { name: 'DKS Title' },
                content: 'Мы рядом на каждом этапе',
                styles: { properties: { fontSize: '36px', fontWeight: '300', color: colors.white, lineHeight: '1.25', marginBottom: '20px' } },
              }),
              createNode({
                elementType: 'text', tagName: 'p', tag: 'p',
                metadata: { name: 'DKS Desc' },
                content: 'Дирекция Клиентского Сервиса Golden House — это единое окно для решения всех вопросов владельцев недвижимости. Мы обеспечиваем сопровождение сделки, помощь с заселением, гарантийное обслуживание и связь с управляющей компанией.',
                styles: { properties: { fontSize: '16px', color: 'rgba(255,255,255,0.75)', lineHeight: '1.7', marginBottom: '24px' } },
              }),
              createNode({
                elementType: 'text', tagName: 'p', tag: 'p',
                metadata: { name: 'DKS Desc 2' },
                content: 'Работаем без выходных. Среднее время ответа — 15 минут.',
                styles: { properties: { fontSize: '14px', color: 'rgba(255,255,255,0.6)' } },
              }),
            ],
          }),
          // Right: contact cards
          createNode({
            metadata: { name: 'DKS Contacts' },
            styles: { properties: { display: 'flex', flexDirection: 'column', gap: '16px' } },
            children: [
              {
                icon: '📞',
                title: 'Горячая линия',
                value: '+998 78 150 11 11',
                href: 'tel:+998781501111',
              },
              {
                icon: '✉️',
                title: 'Email',
                value: 'dks@goldenhouse.uz',
                href: 'mailto:dks@goldenhouse.uz',
              },
              {
                icon: '💬',
                title: 'Telegram',
                value: '@goldenhouse_dks',
                href: 'https://t.me/goldenhouse_dks',
              },
              {
                icon: '🏢',
                title: 'Офис ДКС',
                value: 'ул. Янги Шахар, 12, каб. 105',
                href: '/contacts',
              },
            ].map(c => createNode({
              metadata: { name: `DKS Contact - ${c.title}` },
              layoutMode: 'flex',
              styles: {
                properties: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '20px 24px',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.08)',
                },
                states: { hover: { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(210,159,102,0.3)' } },
                stateTransition: { duration: 200, easing: 'ease', properties: ['background-color', 'border-color'] },
              },
              children: [
                createNode({
                  elementType: 'text', tagName: 'span', tag: 'span',
                  metadata: { name: 'DKS Icon' },
                  content: c.icon,
                  styles: { properties: { fontSize: '24px' } },
                }),
                createNode({
                  metadata: { name: 'DKS Contact Info' },
                  styles: { properties: { display: 'flex', flexDirection: 'column', gap: '2px' } },
                  children: [
                    createNode({
                      elementType: 'text', tagName: 'span', tag: 'span',
                      metadata: { name: 'DKS Contact Title' },
                      content: c.title,
                      styles: { properties: { fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' } },
                    }),
                    createNode({
                      elementType: 'text', tagName: 'a', tag: 'a',
                      metadata: { name: 'DKS Contact Value' },
                      content: c.value,
                      attributes: { href: c.href },
                      styles: { properties: { fontSize: '16px', color: colors.white, fontWeight: '500', textDecoration: 'none' } },
                    }),
                  ],
                }),
              ],
            })),
          }),
        ],
      }),
    ],
  })

  // ====== CTA section (reduced padding п.3) ======
  const ctaSection = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'CTA Section' },
    styles: {
      properties: {
        padding: '80px 60px',
        backgroundColor: colors.cream,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      },
    },
    children: [
      createNode({
        elementType: 'text', tagName: 'h2', tag: 'h2',
        metadata: { name: 'CTA Title' },
        content: 'Готовы найти свой идеальный дом?',
        styles: { properties: { fontSize: '36px', fontWeight: '600', color: colors.black, marginBottom: '12px' } },
      }),
      createNode({
        elementType: 'text', tagName: 'p', tag: 'p',
        metadata: { name: 'CTA Subtitle' },
        content: 'Оставьте заявку, и наш менеджер свяжется с вами в ближайшее время',
        styles: { properties: { fontSize: '16px', color: colors.grayDark, marginBottom: '32px' } },
      }),
      createNode({
        metadata: { name: 'CTA Buttons' },
        layoutMode: 'flex',
        styles: { properties: { display: 'flex', gap: '16px' } },
        children: [
          createNode({
            elementType: 'button', tagName: 'a', tag: 'a',
            metadata: { name: 'CTA Primary' },
            content: 'Оставить заявку',
            attributes: { href: '/contacts' },
            styles: {
              properties: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 48px',
                backgroundColor: colors.gold,
                color: colors.white,
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '600',
                fontFamily: font,
                textTransform: 'uppercase',
                letterSpacing: '2px',
                textDecoration: 'none',
                cursor: 'pointer',
              },
              states: { hover: { backgroundColor: colors.goldDark } },
              stateTransition: { duration: 200, easing: 'ease', properties: ['background-color'] },
            },
          }),
          createNode({
            elementType: 'button', tagName: 'a', tag: 'a',
            metadata: { name: 'CTA Phone' },
            content: 'Позвонить',
            attributes: { href: 'tel:+998781501111' },
            styles: {
              properties: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 48px',
                backgroundColor: 'transparent',
                color: colors.black,
                border: `1px solid ${colors.grayLight}`,
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '600',
                fontFamily: font,
                textTransform: 'uppercase',
                letterSpacing: '2px',
                textDecoration: 'none',
                cursor: 'pointer',
              },
              states: { hover: { borderColor: colors.gold, color: colors.gold } },
              stateTransition: { duration: 200, easing: 'ease', properties: ['border-color', 'color'] },
            },
          }),
        ],
      }),
    ],
  })

  return {
    name: 'Главная',
    slug: 'home',
    status: 'draft',
    metadata: {
      title: 'Golden House — Девелопер премиальной недвижимости',
      description: 'Golden House — ведущий девелопер Узбекистана. Жилые комплексы и коммерческая недвижимость премиум класса.',
      keywords: ['golden house', 'недвижимость', 'жилые комплексы', 'ташкент'],
    },
    structure: createPageRoot('Home Page', [
      createHeader(),
      hero,
      stats,
      historyBlock,
      projectsPreview,
      newsPreview,
      dksBlock,
      ctaSection,
      createFooter(),
    ]),
  }
}

// ──────────────────────────────────────────────────────────
// PAGE 2: О КОМПАНИИ (about)
// ──────────────────────────────────────────────────────────

function createAboutPage() {
  const heroAbout = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'About Hero' },
    styles: {
      properties: {
        padding: '160px 80px 120px',
        backgroundColor: colors.cream,
      },
    },
    children: [
      createNode({
        metadata: { name: 'About Hero Container' },
        styles: { properties: { maxWidth: '900px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
        children: [
          createSectionLabel('О компании'),
          createNode({
            elementType: 'text', tagName: 'h1', tag: 'h1',
            metadata: { name: 'About Page Title' },
            content: 'Мы строим будущее, в котором хочется жить',
            styles: { properties: { fontSize: '52px', fontWeight: '300', color: colors.black, lineHeight: '1.2', marginBottom: '24px', letterSpacing: '-1px' } },
          }),
          createNode({
            elementType: 'text', tagName: 'p', tag: 'p',
            metadata: { name: 'About Page Subtitle' },
            content: 'Golden House — компания-девелопер с 13-летним опытом создания премиальных жилых и коммерческих объектов в Узбекистане.',
            styles: { properties: { fontSize: '18px', color: colors.grayDark, lineHeight: '1.7', maxWidth: '700px', fontWeight: '300' } },
          }),
        ],
      }),
    ],
  })

  const missionValues = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Mission & Values' },
    styles: { properties: { padding: '120px 80px', backgroundColor: colors.white } },
    children: [
      createNode({
        metadata: { name: 'Mission Container' },
        styles: { properties: { maxWidth: '1200px', margin: '0 auto' } },
        children: [
          createNode({
            metadata: { name: 'Mission Grid' },
            styles: { properties: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', marginBottom: '100px', alignItems: 'center' } },
            children: [
              createNode({
                elementType: 'image', tagName: 'img', tag: 'img',
                metadata: { name: 'Mission Image' },
                attributes: { src: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800', alt: 'Наша миссия' },
                styles: { properties: { width: '100%', height: '450px', objectFit: 'cover', borderRadius: '8px' } },
              }),
              createNode({
                metadata: { name: 'Mission Text' },
                styles: { properties: { display: 'flex', flexDirection: 'column' } },
                children: [
                  createSectionLabel('Миссия'),
                  createSectionTitle('Делать город лучше'),
                  createNode({
                    elementType: 'text', tagName: 'p', tag: 'p',
                    metadata: { name: 'Mission Description' },
                    content: 'Мы стремимся создавать архитектуру, которая гармонично вписывается в городскую среду и улучшает качество жизни. Каждый проект — это вклад в развитие города, его инфраструктуры и комфорта жителей.',
                    styles: { properties: { fontSize: '16px', color: colors.grayDark, lineHeight: '1.8', marginTop: '24px' } },
                  }),
                ],
              }),
            ],
          }),
          // Values
          createNode({
            metadata: { name: 'Values Section' },
            styles: { properties: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
            children: [
              createSectionLabel('Наши ценности'),
              createNode({
                elementType: 'text', tagName: 'h2', tag: 'h2',
                metadata: { name: 'Values Title' },
                content: 'Принципы, которыми мы руководствуемся',
                styles: { properties: { fontSize: '36px', fontWeight: '300', color: colors.black, textAlign: 'center', marginBottom: '60px' } },
              }),
              createNode({
                metadata: { name: 'Values Grid' },
                styles: { properties: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '40px', width: '100%' } },
                children: [
                  { title: 'Качество', desc: 'Используем только премиальные материалы и передовые технологии строительства' },
                  { title: 'Инновации', desc: 'Внедряем современные архитектурные решения и умные технологии' },
                  { title: 'Честность', desc: 'Прозрачные условия сделок и честное взаимодействие с клиентами' },
                  { title: 'Забота', desc: 'Сопровождаем клиентов на каждом этапе — от выбора до заселения' },
                ].map(v => createNode({
                  metadata: { name: `Value - ${v.title}` },
                  styles: {
                    properties: {
                      padding: '40px 32px',
                      borderTop: `2px solid ${colors.gold}`,
                      display: 'flex',
                      flexDirection: 'column',
                    },
                  },
                  children: [
                    createNode({
                      elementType: 'text', tagName: 'h3', tag: 'h3',
                      metadata: { name: 'Value Title' },
                      content: v.title,
                      styles: { properties: { fontSize: '20px', fontWeight: '600', color: colors.black, marginBottom: '12px' } },
                    }),
                    createNode({
                      elementType: 'text', tagName: 'p', tag: 'p',
                      metadata: { name: 'Value Desc' },
                      content: v.desc,
                      styles: { properties: { fontSize: '15px', color: colors.grayDark, lineHeight: '1.7' } },
                    }),
                  ],
                })),
              }),
            ],
          }),
        ],
      }),
    ],
  })

  // History / Timeline
  const history = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'History Section' },
    styles: { properties: { padding: '120px 80px', backgroundColor: colors.cream } },
    children: [
      createNode({
        metadata: { name: 'History Container' },
        styles: { properties: { maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
        children: [
          createSectionLabel('История'),
          createSectionTitle('Этапы нашего развития'),
          createNode({
            metadata: { name: 'Timeline' },
            styles: { properties: { marginTop: '60px', width: '100%', display: 'flex', flexDirection: 'column', gap: '40px' } },
            children: [
              { year: '2012', text: 'Основание компании Golden House. Первый проект — жилой дом на 48 квартир в центре Ташкента.' },
              { year: '2015', text: 'Запуск первого жилого комплекса бизнес-класса. Расширение команды до 150 специалистов.' },
              { year: '2018', text: 'Выход на рынок коммерческой недвижимости. Открытие первого бизнес-центра.' },
              { year: '2021', text: 'Достижение отметки в 500 000 м² построенной недвижимости. Международные награды за архитектуру.' },
              { year: '2024', text: 'Запуск Digital CMS платформы для управления проектами и продажами. 25 проектов в активной реализации.' },
            ].map(t => createNode({
              metadata: { name: `Timeline - ${t.year}` },
              layoutMode: 'flex',
              styles: {
                properties: {
                  display: 'flex',
                  gap: '40px',
                  alignItems: 'flex-start',
                  paddingBottom: '40px',
                  borderBottom: `1px solid ${colors.grayLight}`,
                },
              },
              children: [
                createNode({
                  elementType: 'text', tagName: 'span', tag: 'span',
                  metadata: { name: 'Year' },
                  content: t.year,
                  styles: { properties: { fontSize: '36px', fontWeight: '300', color: colors.gold, minWidth: '100px', letterSpacing: '-1px' } },
                }),
                createNode({
                  elementType: 'text', tagName: 'p', tag: 'p',
                  metadata: { name: 'Year Description' },
                  content: t.text,
                  styles: { properties: { fontSize: '16px', color: colors.grayDark, lineHeight: '1.7' } },
                }),
              ],
            })),
          }),
        ],
      }),
    ],
  })

  // Team section
  const team = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Team Section' },
    styles: { properties: { padding: '120px 80px', backgroundColor: colors.white } },
    children: [
      createNode({
        metadata: { name: 'Team Container' },
        styles: { properties: { maxWidth: '1200px', margin: '0 auto' } },
        children: [
          createNode({
            metadata: { name: 'Team Header' },
            styles: { properties: { textAlign: 'center', marginBottom: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
            children: [
              createSectionLabel('Команда'),
              createSectionTitle('Руководство компании'),
            ],
          }),
          createNode({
            metadata: { name: 'Team Grid' },
            styles: { properties: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px' } },
            children: [
              { name: 'Алексей Петров', role: 'Генеральный директор', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400' },
              { name: 'Мария Иванова', role: 'Директор по развитию', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400' },
              { name: 'Дмитрий Козлов', role: 'Главный архитектор', img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400' },
            ].map(m => createNode({
              metadata: { name: `Team - ${m.name}` },
              styles: { properties: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
              children: [
                createNode({
                  elementType: 'image', tagName: 'img', tag: 'img',
                  metadata: { name: 'Team Photo' },
                  attributes: { src: m.img, alt: m.name },
                  styles: { properties: { width: '200px', height: '200px', borderRadius: '50%', objectFit: 'cover', marginBottom: '24px' } },
                }),
                createNode({
                  elementType: 'text', tagName: 'h3', tag: 'h3',
                  metadata: { name: 'Member Name' },
                  content: m.name,
                  styles: { properties: { fontSize: '20px', fontWeight: '600', color: colors.black, marginBottom: '4px' } },
                }),
                createNode({
                  elementType: 'text', tagName: 'p', tag: 'p',
                  metadata: { name: 'Member Role' },
                  content: m.role,
                  styles: { properties: { fontSize: '14px', color: colors.gray } },
                }),
              ],
            })),
          }),
        ],
      }),
    ],
  })

  return {
    name: 'О компании',
    slug: 'about',
    status: 'draft',
    metadata: {
      title: 'О компании — Golden House',
      description: 'История, миссия и ценности компании Golden House. 13 лет на рынке недвижимости Узбекистана.',
      keywords: ['golden house', 'о компании', 'девелопер', 'история'],
    },
    structure: createPageRoot('About Page', [
      createHeader(),
      heroAbout,
      missionValues,
      history,
      team,
      createFooter(),
    ]),
  }
}

// ──────────────────────────────────────────────────────────
// PAGE 3: ЖИЛЫЕ КОМПЛЕКСЫ (residential)
// ──────────────────────────────────────────────────────────

function createResidentialPage() {
  const hero = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Residential Hero' },
    styles: {
      properties: {
        padding: '140px 80px 80px',
        backgroundColor: colors.darkBrown,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      },
    },
    children: [
      createNode({
        elementType: 'text', tagName: 'p', tag: 'p',
        metadata: { name: 'Residential Label' },
        content: 'Жилые комплексы',
        styles: { properties: { color: colors.gold, fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' } },
      }),
      createNode({
        elementType: 'text', tagName: 'h1', tag: 'h1',
        metadata: { name: 'Residential Title' },
        content: 'Найдите свой идеальный дом',
        styles: { properties: { fontSize: '48px', fontWeight: '300', color: colors.white, marginBottom: '16px', letterSpacing: '-1px' } },
      }),
      createNode({
        elementType: 'text', tagName: 'p', tag: 'p',
        metadata: { name: 'Residential Subtitle' },
        content: 'Выберите из наших жилых комплексов, расположенных в лучших районах Ташкента',
        styles: { properties: { fontSize: '18px', color: 'rgba(255,255,255,0.7)', fontWeight: '300' } },
      }),
    ],
  })

  // Filters
  const filters = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Filters Section' },
    styles: {
      properties: {
        padding: '40px 80px',
        backgroundColor: colors.white,
        borderBottom: `1px solid ${colors.grayLight}`,
      },
    },
    children: [
      createNode({
        metadata: { name: 'Filters Container' },
        layoutMode: 'flex',
        styles: { properties: { maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '24px', alignItems: 'flex-end', flexWrap: 'wrap' } },
        children: [
          // Location filter
          createNode({
            metadata: { name: 'Location Filter' },
            styles: { properties: { display: 'flex', flexDirection: 'column', gap: '6px' } },
            children: [
              createNode({
                elementType: 'text', tagName: 'label', tag: 'label',
                metadata: { name: 'Location Label' },
                content: 'Район',
                styles: { properties: { fontSize: '12px', color: colors.gray, textTransform: 'uppercase', letterSpacing: '1px' } },
              }),
              createNode({
                elementType: 'input', tagName: 'select', tag: 'select',
                metadata: { name: 'Location Select' },
                styles: { properties: { padding: '12px 16px', border: `1px solid ${colors.grayLight}`, borderRadius: '4px', fontSize: '14px', minWidth: '200px' } },
              }),
            ],
          }),
          // Price filter
          createNode({
            metadata: { name: 'Price Filter' },
            styles: { properties: { display: 'flex', flexDirection: 'column', gap: '6px' } },
            children: [
              createNode({
                elementType: 'text', tagName: 'label', tag: 'label',
                metadata: { name: 'Price Label' },
                content: 'Цена, $',
                styles: { properties: { fontSize: '12px', color: colors.gray, textTransform: 'uppercase', letterSpacing: '1px' } },
              }),
              createNode({
                metadata: { name: 'Price Inputs' },
                layoutMode: 'flex',
                styles: { properties: { display: 'flex', gap: '8px', alignItems: 'center' } },
                children: [
                  createNode({
                    elementType: 'input', tagName: 'input', tag: 'input',
                    metadata: { name: 'Price From' },
                    attributes: { type: 'text', placeholder: 'от' },
                    styles: { properties: { padding: '12px 16px', border: `1px solid ${colors.grayLight}`, borderRadius: '4px', fontSize: '14px', width: '120px' } },
                  }),
                  createNode({
                    elementType: 'text', tagName: 'span', tag: 'span',
                    metadata: { name: 'Price Sep' },
                    content: '—',
                    styles: { properties: { color: colors.gray } },
                  }),
                  createNode({
                    elementType: 'input', tagName: 'input', tag: 'input',
                    metadata: { name: 'Price To' },
                    attributes: { type: 'text', placeholder: 'до' },
                    styles: { properties: { padding: '12px 16px', border: `1px solid ${colors.grayLight}`, borderRadius: '4px', fontSize: '14px', width: '120px' } },
                  }),
                ],
              }),
            ],
          }),
          // Search button
          createNode({
            elementType: 'button', tagName: 'button', tag: 'button',
            metadata: { name: 'Search Button' },
            content: 'Найти',
            styles: {
              properties: {
                padding: '12px 32px',
                backgroundColor: colors.gold,
                color: colors.white,
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              },
              states: { hover: { backgroundColor: colors.goldDark } },
              stateTransition: { duration: 200, easing: 'ease', properties: ['background-color'] },
            },
          }),
        ],
      }),
    ],
  })

  // Project cards grid
  const projects = [
    { name: 'Golden House Premium', area: 'Юнусабадский район', rooms: '1–4 комнаты', price: 'от $1 200/м²', status: 'В продаже', img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600' },
    { name: 'Golden House Elite', area: 'Мирзо Улугбек', rooms: '2–5 комнат', price: 'от $950/м²', status: 'В продаже', img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600' },
    { name: 'Golden House Modern', area: 'Чиланзарский район', rooms: '1–3 комнаты', price: 'от $800/м²', status: 'Скоро в продаже', img: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600' },
    { name: 'Golden House Classic', area: 'Яшнобадский район', rooms: '2–4 комнаты', price: 'от $750/м²', status: 'В продаже', img: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600' },
    { name: 'Golden House Park', area: 'Шайхантахурский район', rooms: '1–3 комнаты', price: 'от $850/м²', status: 'Строится', img: 'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=600' },
    { name: 'Golden House Vista', area: 'Алмазарский район', rooms: '2–4 комнаты', price: 'от $900/м²', status: 'В продаже', img: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600' },
  ]

  const projectsGrid = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Projects Grid Section' },
    styles: { properties: { padding: '80px', backgroundColor: colors.grayLighter } },
    children: [
      createNode({
        metadata: { name: 'Projects Container' },
        styles: { properties: { maxWidth: '1200px', margin: '0 auto' } },
        children: [
          createNode({
            metadata: { name: 'Projects Grid' },
            styles: { properties: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' } },
            children: projects.map(p => createNode({
              metadata: { name: `RC - ${p.name}` },
              styles: {
                properties: {
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: colors.white,
                  boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                },
                states: { hover: { boxShadow: '0 8px 40px rgba(0,0,0,0.12)', transform: 'translateY(-4px)' } },
                stateTransition: { duration: 300, easing: 'ease-out', properties: ['box-shadow', 'transform'] },
              },
              children: [
                // Image + status badge
                createNode({
                  metadata: { name: 'Card Image Wrap' },
                  styles: { properties: { position: 'relative' } },
                  children: [
                    createNode({
                      elementType: 'image', tagName: 'img', tag: 'img',
                      metadata: { name: 'Card Image' },
                      attributes: { src: p.img, alt: p.name },
                      styles: { properties: { width: '100%', height: '240px', objectFit: 'cover' } },
                    }),
                    createNode({
                      elementType: 'text', tagName: 'span', tag: 'span',
                      metadata: { name: 'Status Badge' },
                      content: p.status,
                      styles: {
                        properties: {
                          position: 'absolute',
                          top: '16px', left: '16px',
                          padding: '6px 16px',
                          backgroundColor: p.status === 'В продаже' ? colors.gold : colors.charcoal,
                          color: colors.white,
                          fontSize: '12px',
                          fontWeight: '600',
                          borderRadius: '4px',
                          letterSpacing: '0.5px',
                        },
                      },
                    }),
                  ],
                }),
                // Info
                createNode({
                  metadata: { name: 'Card Info' },
                  styles: { properties: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' } },
                  children: [
                    createNode({
                      elementType: 'text', tagName: 'h3', tag: 'h3',
                      metadata: { name: 'Card Name' },
                      content: p.name,
                      styles: { properties: { fontSize: '20px', fontWeight: '600', color: colors.black } },
                    }),
                    createNode({
                      elementType: 'text', tagName: 'p', tag: 'p',
                      metadata: { name: 'Card Area' },
                      content: `${p.area} · ${p.rooms}`,
                      styles: { properties: { fontSize: '14px', color: colors.gray } },
                    }),
                    createNode({
                      elementType: 'text', tagName: 'span', tag: 'span',
                      metadata: { name: 'Card Price' },
                      content: p.price,
                      styles: { properties: { fontSize: '18px', fontWeight: '600', color: colors.gold, marginTop: '8px' } },
                    }),
                    createNode({
                      elementType: 'button', tagName: 'a', tag: 'a',
                      metadata: { name: 'Card CTA' },
                      content: 'Подробнее',
                      attributes: { href: '#' },
                      styles: {
                        properties: {
                          marginTop: '16px',
                          padding: '10px 24px',
                          backgroundColor: 'transparent',
                          color: colors.gold,
                          border: `1px solid ${colors.gold}`,
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontWeight: '500',
                          textDecoration: 'none',
                          textAlign: 'center',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          cursor: 'pointer',
                        },
                        states: { hover: { backgroundColor: colors.gold, color: colors.white } },
                        stateTransition: { duration: 200, easing: 'ease', properties: ['background-color', 'color'] },
                      },
                    }),
                  ],
                }),
              ],
            })),
          }),
        ],
      }),
    ],
  })

  return {
    name: 'Жилые комплексы',
    slug: 'residential',
    status: 'draft',
    metadata: {
      title: 'Жилые комплексы — Golden House',
      description: 'Каталог жилых комплексов Golden House в Ташкенте. Квартиры от застройщика.',
      keywords: ['жилые комплексы', 'квартиры', 'ташкент', 'golden house'],
    },
    structure: createPageRoot('Residential Page', [
      createHeader(),
      hero,
      filters,
      projectsGrid,
      createFooter(),
    ]),
  }
}

// ──────────────────────────────────────────────────────────
// PAGE 4: КОММЕРЧЕСКИЕ ОБЪЕКТЫ (commercial)
// ──────────────────────────────────────────────────────────

function createCommercialPage() {
  const hero = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Commercial Hero' },
    styles: {
      properties: {
        padding: '140px 80px 80px',
        backgroundColor: colors.charcoal,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      },
    },
    children: [
      createNode({
        elementType: 'text', tagName: 'p', tag: 'p',
        metadata: { name: 'Commercial Label' },
        content: 'Коммерческая недвижимость',
        styles: { properties: { color: colors.gold, fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' } },
      }),
      createNode({
        elementType: 'text', tagName: 'h1', tag: 'h1',
        metadata: { name: 'Commercial Title' },
        content: 'Пространства для вашего бизнеса',
        styles: { properties: { fontSize: '48px', fontWeight: '300', color: colors.white, marginBottom: '16px', letterSpacing: '-1px' } },
      }),
      createNode({
        elementType: 'text', tagName: 'p', tag: 'p',
        metadata: { name: 'Commercial Subtitle' },
        content: 'Офисные и торговые помещения в лучших локациях Ташкента',
        styles: { properties: { fontSize: '18px', color: 'rgba(255,255,255,0.7)', fontWeight: '300' } },
      }),
    ],
  })

  // Advantages
  const advantages = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Advantages' },
    styles: { properties: { padding: '100px 80px', backgroundColor: colors.white } },
    children: [
      createNode({
        metadata: { name: 'Advantages Container' },
        styles: { properties: { maxWidth: '1200px', margin: '0 auto' } },
        children: [
          createNode({
            metadata: { name: 'Advantages Header' },
            styles: { properties: { textAlign: 'center', marginBottom: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
            children: [
              createSectionLabel('Преимущества'),
              createSectionTitle('Почему Golden House'),
            ],
          }),
          createNode({
            metadata: { name: 'Advantages Grid' },
            styles: { properties: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px' } },
            children: [
              { title: 'Премиальные локации', desc: 'Объекты расположены на первых линиях основных магистралей города с высоким трафиком' },
              { title: 'Гибкие планировки', desc: 'Возможность адаптировать помещения под любой формат бизнеса — от офиса до шоурума' },
              { title: 'Инфраструктура', desc: 'Парковка, охрана, системы кондиционирования и высокоскоростной интернет включены' },
              { title: 'Инвестиционная привлекательность', desc: 'Рост стоимости коммерческой недвижимости 12-15% в год в наших комплексах' },
              { title: 'Юридическая чистота', desc: 'Полное сопровождение сделки и оформление всех документов' },
              { title: 'Рассрочка и ипотека', desc: 'Индивидуальные условия финансирования для бизнеса' },
            ].map(a => createNode({
              metadata: { name: `Adv - ${a.title}` },
              styles: { properties: { padding: '32px', backgroundColor: colors.grayLighter, borderRadius: '8px', display: 'flex', flexDirection: 'column' } },
              children: [
                createNode({
                  elementType: 'text', tagName: 'h3', tag: 'h3',
                  metadata: { name: 'Adv Title' },
                  content: a.title,
                  styles: { properties: { fontSize: '18px', fontWeight: '600', color: colors.black, marginBottom: '12px' } },
                }),
                createNode({
                  elementType: 'text', tagName: 'p', tag: 'p',
                  metadata: { name: 'Adv Desc' },
                  content: a.desc,
                  styles: { properties: { fontSize: '15px', color: colors.grayDark, lineHeight: '1.7' } },
                }),
              ],
            })),
          }),
        ],
      }),
    ],
  })

  // Commercial objects grid
  const objects = [
    { name: 'Бизнес-центр «Голд Плаза»', type: 'Офисы', area: 'от 50 до 500 м²', price: 'от $1 500/м²', img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600' },
    { name: 'Торговая галерея «Gold Mall»', type: 'Торговля', area: 'от 30 до 300 м²', price: 'от $2 000/м²', img: 'https://images.unsplash.com/photo-1555636222-cae831e670b3?w=600' },
    { name: 'GH Business Park', type: 'Офисы', area: 'от 80 до 1000 м²', price: 'от $1 200/м²', img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600' },
    { name: 'Коммерческие помещения GH Premium', type: 'Ритейл', area: 'от 40 до 200 м²', price: 'от $1 800/м²', img: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=600' },
  ]

  const objectsSection = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Objects Section' },
    styles: { properties: { padding: '80px', backgroundColor: colors.grayLighter } },
    children: [
      createNode({
        metadata: { name: 'Objects Container' },
        styles: { properties: { maxWidth: '1200px', margin: '0 auto' } },
        children: [
          createNode({
            metadata: { name: 'Objects Header' },
            styles: { properties: { marginBottom: '48px', display: 'flex', flexDirection: 'column' } },
            children: [
              createSectionLabel('Объекты'),
              createSectionTitle('Доступные помещения'),
            ],
          }),
          createNode({
            metadata: { name: 'Objects Grid' },
            styles: { properties: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px' } },
            children: objects.map(o => createNode({
              metadata: { name: `Commercial - ${o.name}` },
              styles: {
                properties: {
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: colors.white,
                  boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                },
                states: { hover: { boxShadow: '0 8px 30px rgba(0,0,0,0.1)' } },
                stateTransition: { duration: 200, easing: 'ease', properties: ['box-shadow'] },
              },
              children: [
                createNode({
                  elementType: 'image', tagName: 'img', tag: 'img',
                  metadata: { name: 'Object Image' },
                  attributes: { src: o.img, alt: o.name },
                  styles: { properties: { width: '100%', height: '100%', minHeight: '250px', objectFit: 'cover' } },
                }),
                createNode({
                  metadata: { name: 'Object Details' },
                  styles: { properties: { padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' } },
                  children: [
                    createNode({
                      elementType: 'text', tagName: 'span', tag: 'span',
                      metadata: { name: 'Object Type' },
                      content: o.type,
                      styles: { properties: { color: colors.gold, fontSize: '12px', fontWeight: '600', letterSpacing: '2px', textTransform: 'uppercase' } },
                    }),
                    createNode({
                      elementType: 'text', tagName: 'h3', tag: 'h3',
                      metadata: { name: 'Object Name' },
                      content: o.name,
                      styles: { properties: { fontSize: '22px', fontWeight: '600', color: colors.black } },
                    }),
                    createNode({
                      elementType: 'text', tagName: 'p', tag: 'p',
                      metadata: { name: 'Object Area' },
                      content: `Площадь: ${o.area}`,
                      styles: { properties: { fontSize: '14px', color: colors.gray } },
                    }),
                    createNode({
                      elementType: 'text', tagName: 'span', tag: 'span',
                      metadata: { name: 'Object Price' },
                      content: o.price,
                      styles: { properties: { fontSize: '20px', fontWeight: '600', color: colors.gold } },
                    }),
                    createNode({
                      elementType: 'button', tagName: 'a', tag: 'a',
                      metadata: { name: 'Object CTA' },
                      content: 'Узнать подробности',
                      attributes: { href: '/contacts' },
                      styles: {
                        properties: {
                          marginTop: '8px',
                          padding: '10px 24px',
                          backgroundColor: colors.gold,
                          color: colors.white,
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontWeight: '500',
                          textDecoration: 'none',
                          textAlign: 'center',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          cursor: 'pointer',
                        },
                        states: { hover: { backgroundColor: colors.goldDark } },
                        stateTransition: { duration: 200, easing: 'ease', properties: ['background-color'] },
                      },
                    }),
                  ],
                }),
              ],
            })),
          }),
        ],
      }),
    ],
  })

  return {
    name: 'Коммерческие объекты',
    slug: 'commercial',
    status: 'draft',
    metadata: {
      title: 'Коммерческая недвижимость — Golden House',
      description: 'Офисные и торговые помещения от Golden House. Лучшие локации Ташкента.',
      keywords: ['коммерческая недвижимость', 'офисы', 'golden house', 'бизнес'],
    },
    structure: createPageRoot('Commercial Page', [
      createHeader(),
      hero,
      advantages,
      objectsSection,
      createFooter(),
    ]),
  }
}

// ──────────────────────────────────────────────────────────
// PAGE 5: НОВОСТИ И АКЦИИ (news)
// ──────────────────────────────────────────────────────────

function createNewsPage() {
  const hero = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'News Hero' },
    styles: {
      properties: {
        padding: '140px 80px 60px',
        backgroundColor: colors.cream,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      },
    },
    children: [
      createSectionLabel('Новости и акции'),
      createNode({
        elementType: 'text', tagName: 'h1', tag: 'h1',
        metadata: { name: 'News Title' },
        content: 'Будьте в курсе событий',
        styles: { properties: { fontSize: '48px', fontWeight: '300', color: colors.black, marginBottom: '16px', letterSpacing: '-1px' } },
      }),
      createNode({
        elementType: 'text', tagName: 'p', tag: 'p',
        metadata: { name: 'News Subtitle' },
        content: 'Актуальные новости, специальные предложения и события компании Golden House',
        styles: { properties: { fontSize: '18px', color: colors.grayDark, fontWeight: '300', maxWidth: '600px' } },
      }),
    ],
  })

  // Category tabs
  const tabs = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Category Tabs' },
    styles: { properties: { padding: '0 80px', backgroundColor: colors.cream, paddingBottom: '40px' } },
    children: [
      createNode({
        metadata: { name: 'Tabs Container' },
        layoutMode: 'flex',
        styles: { properties: { display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '40px' } },
        children: ['Все', 'Новости', 'Акции', 'События'].map((t, i) =>
          createNode({
            elementType: 'button', tagName: 'button', tag: 'button',
            metadata: { name: `Tab - ${t}` },
            content: t,
            styles: {
              properties: {
                padding: '10px 24px',
                backgroundColor: i === 0 ? colors.gold : 'transparent',
                color: i === 0 ? colors.white : colors.grayDark,
                border: i === 0 ? 'none' : `1px solid ${colors.grayLight}`,
                borderRadius: '24px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              },
              states: { hover: { backgroundColor: i === 0 ? colors.goldDark : colors.grayLighter } },
              stateTransition: { duration: 200, easing: 'ease', properties: ['background-color'] },
            },
          })
        ),
      }),
    ],
  })

  // News cards
  const newsItems = [
    { title: 'Старт продаж Golden House Premium', date: '15 марта 2026', tag: 'Событие', desc: 'Мы рады объявить о начале продаж квартир в нашем новом премиальном жилом комплексе в Юнусабадском районе.', img: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600' },
    { title: 'Скидка 10% на коммерческие помещения', date: '10 марта 2026', tag: 'Акция', desc: 'Специальное предложение на коммерческие помещения в ЖК Golden House Elite до конца месяца.', img: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=600' },
    { title: 'Golden House получил награду за архитектуру', date: '1 марта 2026', tag: 'Новость', desc: 'Наш жилой комплекс получил престижную международную награду за инновационный архитектурный дизайн.', img: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600' },
    { title: 'День открытых дверей в GH Modern', date: '20 февраля 2026', tag: 'Событие', desc: 'Приглашаем посетить шоу-рум и познакомиться с планировками квартир Golden House Modern.', img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600' },
    { title: 'Ипотека от 12% годовых', date: '15 февраля 2026', tag: 'Акция', desc: 'Мы расширили партнёрство с банками — теперь доступны ещё более выгодные ставки по ипотеке.', img: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600' },
    { title: 'Квартальный отчёт по строительству', date: '1 февраля 2026', tag: 'Новость', desc: 'Публикуем прогресс строительства по всем активным объектам за четвёртый квартал 2025 года.', img: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600' },
  ]

  const newsList = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'News List' },
    styles: { properties: { padding: '60px 80px 100px', backgroundColor: colors.white } },
    children: [
      createNode({
        metadata: { name: 'News Grid' },
        styles: { properties: { maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px' } },
        children: newsItems.map(n => createNode({
          metadata: { name: `News - ${n.title.slice(0, 25)}` },
          styles: {
            properties: {
              display: 'grid',
              gridTemplateColumns: '240px 1fr',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: colors.white,
              border: `1px solid ${colors.grayLight}`,
            },
            states: { hover: { boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderColor: 'transparent' } },
            stateTransition: { duration: 200, easing: 'ease', properties: ['box-shadow', 'border-color'] },
          },
          children: [
            createNode({
              elementType: 'image', tagName: 'img', tag: 'img',
              metadata: { name: 'News Image' },
              attributes: { src: n.img, alt: n.title },
              styles: { properties: { width: '100%', height: '100%', minHeight: '200px', objectFit: 'cover' } },
            }),
            createNode({
              metadata: { name: 'News Content' },
              styles: { properties: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' } },
              children: [
                createNode({
                  metadata: { name: 'News Meta' },
                  layoutMode: 'flex',
                  styles: { properties: { display: 'flex', gap: '12px', alignItems: 'center' } },
                  children: [
                    createNode({
                      elementType: 'text', tagName: 'span', tag: 'span',
                      metadata: { name: 'News Tag' },
                      content: n.tag,
                      styles: { properties: { color: colors.gold, fontSize: '12px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' } },
                    }),
                    createNode({
                      elementType: 'text', tagName: 'span', tag: 'span',
                      metadata: { name: 'News Date' },
                      content: n.date,
                      styles: { properties: { fontSize: '13px', color: colors.gray } },
                    }),
                  ],
                }),
                createNode({
                  elementType: 'text', tagName: 'h3', tag: 'h3',
                  metadata: { name: 'News Title' },
                  content: n.title,
                  styles: { properties: { fontSize: '18px', fontWeight: '600', color: colors.black, lineHeight: '1.4' } },
                }),
                createNode({
                  elementType: 'text', tagName: 'p', tag: 'p',
                  metadata: { name: 'News Desc' },
                  content: n.desc,
                  styles: { properties: { fontSize: '14px', color: colors.grayDark, lineHeight: '1.6' } },
                }),
              ],
            }),
          ],
        })),
      }),
    ],
  })

  return {
    name: 'Новости и акции',
    slug: 'news',
    status: 'draft',
    metadata: {
      title: 'Новости и акции — Golden House',
      description: 'Последние новости, специальные предложения и события компании Golden House.',
      keywords: ['новости', 'акции', 'golden house', 'события'],
    },
    structure: createPageRoot('News Page', [
      createHeader(),
      hero,
      tabs,
      newsList,
      createFooter(),
    ]),
  }
}

// ──────────────────────────────────────────────────────────
// PAGE 6: КАРЬЕРА (career)
// ──────────────────────────────────────────────────────────

function createCareerPage() {
  const hero = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Career Hero' },
    styles: {
      properties: {
        padding: '160px 80px 100px',
        backgroundImage: 'url(https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1920)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
      },
    },
    children: [
      createNode({
        metadata: { name: 'Career Overlay' },
        styles: { properties: { position: 'absolute', top: '0', left: '0', right: '0', bottom: '0', backgroundColor: 'rgba(0,0,0,0.6)' } },
      }),
      createNode({
        metadata: { name: 'Career Hero Content' },
        styles: { properties: { position: 'relative', zIndex: '1', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '700px' } },
        children: [
          createNode({
            elementType: 'text', tagName: 'p', tag: 'p',
            metadata: { name: 'Career Label' },
            content: 'Карьера в Golden House',
            styles: { properties: { color: colors.gold, fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' } },
          }),
          createNode({
            elementType: 'text', tagName: 'h1', tag: 'h1',
            metadata: { name: 'Career Title' },
            content: 'Стройте карьеру вместе с нами',
            styles: { properties: { fontSize: '48px', fontWeight: '300', color: colors.white, marginBottom: '16px', letterSpacing: '-1px' } },
          }),
          createNode({
            elementType: 'text', tagName: 'p', tag: 'p',
            metadata: { name: 'Career Subtitle' },
            content: 'Присоединяйтесь к команде профессионалов, которая создаёт архитектуру будущего',
            styles: { properties: { fontSize: '18px', color: 'rgba(255,255,255,0.8)', fontWeight: '300', lineHeight: '1.6' } },
          }),
        ],
      }),
    ],
  })

  // Why work with us
  const whyUs = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Why Us Section' },
    styles: { properties: { padding: '100px 80px', backgroundColor: colors.white } },
    children: [
      createNode({
        metadata: { name: 'Why Us Container' },
        styles: { properties: { maxWidth: '1200px', margin: '0 auto' } },
        children: [
          createNode({
            metadata: { name: 'Why Us Header' },
            styles: { properties: { textAlign: 'center', marginBottom: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
            children: [
              createSectionLabel('Преимущества'),
              createSectionTitle('Почему стоит работать у нас'),
            ],
          }),
          createNode({
            metadata: { name: 'Benefits Grid' },
            styles: { properties: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px' } },
            children: [
              { title: 'Стабильность', desc: 'Крупная компания с 13-летней историей и амбициозными планами развития' },
              { title: 'Рост', desc: 'Программы обучения, менторство и карьерный рост внутри компании' },
              { title: 'Команда', desc: 'Дружный коллектив профессионалов, объединённых общей целью' },
              { title: 'Комфорт', desc: 'Современный офис, гибкий график и забота о сотрудниках' },
              { title: 'Проекты', desc: 'Работа над масштабными и амбициозными проектами города' },
              { title: 'Вознаграждение', desc: 'Конкурентная заработная плата и система бонусов' },
            ].map(b => createNode({
              metadata: { name: `Benefit - ${b.title}` },
              styles: { properties: { padding: '32px', borderLeft: `3px solid ${colors.gold}`, backgroundColor: colors.grayLighter } },
              children: [
                createNode({
                  elementType: 'text', tagName: 'h3', tag: 'h3',
                  metadata: { name: 'Benefit Title' },
                  content: b.title,
                  styles: { properties: { fontSize: '18px', fontWeight: '600', color: colors.black, marginBottom: '8px' } },
                }),
                createNode({
                  elementType: 'text', tagName: 'p', tag: 'p',
                  metadata: { name: 'Benefit Desc' },
                  content: b.desc,
                  styles: { properties: { fontSize: '15px', color: colors.grayDark, lineHeight: '1.6' } },
                }),
              ],
            })),
          }),
        ],
      }),
    ],
  })

  // Vacancies
  const vacancies = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Vacancies Section' },
    styles: { properties: { padding: '100px 80px', backgroundColor: colors.cream } },
    children: [
      createNode({
        metadata: { name: 'Vacancies Container' },
        styles: { properties: { maxWidth: '900px', margin: '0 auto' } },
        children: [
          createNode({
            metadata: { name: 'Vacancies Header' },
            styles: { properties: { textAlign: 'center', marginBottom: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
            children: [
              createSectionLabel('Вакансии'),
              createSectionTitle('Открытые позиции'),
            ],
          }),
          createNode({
            metadata: { name: 'Vacancies List' },
            styles: { properties: { display: 'flex', flexDirection: 'column', gap: '16px' } },
            children: [
              { title: 'Архитектор', dept: 'Проектирование', type: 'Полный день' },
              { title: 'Менеджер по продажам', dept: 'Коммерческий отдел', type: 'Полный день' },
              { title: 'Frontend-разработчик', dept: 'IT-отдел', type: 'Гибкий график' },
              { title: 'Дизайнер интерьеров', dept: 'Проектирование', type: 'Полный день' },
              { title: 'SMM-менеджер', dept: 'Маркетинг', type: 'Гибкий график' },
            ].map(v => createNode({
              metadata: { name: `Vacancy - ${v.title}` },
              layoutMode: 'flex',
              styles: {
                properties: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '24px 32px',
                  backgroundColor: colors.white,
                  borderRadius: '8px',
                  border: `1px solid ${colors.grayLight}`,
                },
                states: { hover: { borderColor: colors.gold, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' } },
                stateTransition: { duration: 200, easing: 'ease', properties: ['border-color', 'box-shadow'] },
              },
              children: [
                createNode({
                  metadata: { name: 'Vacancy Info' },
                  styles: { properties: { display: 'flex', flexDirection: 'column', gap: '4px' } },
                  children: [
                    createNode({
                      elementType: 'text', tagName: 'h3', tag: 'h3',
                      metadata: { name: 'Vacancy Title' },
                      content: v.title,
                      styles: { properties: { fontSize: '18px', fontWeight: '600', color: colors.black } },
                    }),
                    createNode({
                      elementType: 'text', tagName: 'span', tag: 'span',
                      metadata: { name: 'Vacancy Meta' },
                      content: `${v.dept} · ${v.type}`,
                      styles: { properties: { fontSize: '14px', color: colors.gray } },
                    }),
                  ],
                }),
                createNode({
                  elementType: 'button', tagName: 'a', tag: 'a',
                  metadata: { name: 'Vacancy CTA' },
                  content: 'Откликнуться',
                  attributes: { href: '#apply' },
                  styles: {
                    properties: {
                      padding: '10px 24px',
                      backgroundColor: 'transparent',
                      color: colors.gold,
                      border: `1px solid ${colors.gold}`,
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: '500',
                      textDecoration: 'none',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      cursor: 'pointer',
                    },
                    states: { hover: { backgroundColor: colors.gold, color: colors.white } },
                    stateTransition: { duration: 200, easing: 'ease', properties: ['background-color', 'color'] },
                  },
                }),
              ],
            })),
          }),
        ],
      }),
    ],
  })

  // Application form
  const applyForm = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Apply Section' },
    styles: { properties: { padding: '100px 80px', backgroundColor: colors.white } },
    children: [
      createNode({
        metadata: { name: 'Apply Container' },
        styles: { properties: { maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
        children: [
          createSectionLabel('Отклик'),
          createSectionTitle('Отправьте резюме'),
          createNode({
            elementType: 'text', tagName: 'p', tag: 'p',
            metadata: { name: 'Apply Desc' },
            content: 'Заполните форму, и мы свяжемся с вами в ближайшее время',
            styles: { properties: { fontSize: '16px', color: colors.grayDark, marginTop: '16px', marginBottom: '40px', textAlign: 'center' } },
          }),
          createNode({
            tagName: 'form',
            tag: 'form',
            metadata: { name: 'Apply Form' },
            styles: { properties: { width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' } },
            children: [
              createNode({
                elementType: 'input', tagName: 'input', tag: 'input',
                metadata: { name: 'Name Input' },
                attributes: { type: 'text', placeholder: 'Ваше имя', name: 'name' },
                styles: { properties: { padding: '14px 16px', border: `1px solid ${colors.grayLight}`, borderRadius: '4px', fontSize: '15px', width: '100%' } },
              }),
              createNode({
                elementType: 'input', tagName: 'input', tag: 'input',
                metadata: { name: 'Email Input' },
                attributes: { type: 'email', placeholder: 'Email', name: 'email' },
                styles: { properties: { padding: '14px 16px', border: `1px solid ${colors.grayLight}`, borderRadius: '4px', fontSize: '15px', width: '100%' } },
              }),
              createNode({
                elementType: 'input', tagName: 'input', tag: 'input',
                metadata: { name: 'Phone Input' },
                attributes: { type: 'tel', placeholder: 'Телефон', name: 'phone' },
                styles: { properties: { padding: '14px 16px', border: `1px solid ${colors.grayLight}`, borderRadius: '4px', fontSize: '15px', width: '100%' } },
              }),
              createNode({
                elementType: 'input', tagName: 'input', tag: 'input',
                metadata: { name: 'Position Input' },
                attributes: { type: 'text', placeholder: 'Желаемая должность', name: 'position' },
                styles: { properties: { padding: '14px 16px', border: `1px solid ${colors.grayLight}`, borderRadius: '4px', fontSize: '15px', width: '100%' } },
              }),
              createNode({
                elementType: 'button', tagName: 'button', tag: 'button',
                metadata: { name: 'Submit Button' },
                content: 'Отправить',
                styles: {
                  properties: {
                    padding: '16px 48px',
                    backgroundColor: colors.gold,
                    color: colors.white,
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    cursor: 'pointer',
                    alignSelf: 'center',
                  },
                  states: { hover: { backgroundColor: colors.goldDark } },
                  stateTransition: { duration: 200, easing: 'ease', properties: ['background-color'] },
                },
              }),
            ],
          }),
        ],
      }),
    ],
  })

  return {
    name: 'Карьера',
    slug: 'career',
    status: 'draft',
    metadata: {
      title: 'Карьера — Golden House',
      description: 'Вакансии и карьерные возможности в компании Golden House.',
      keywords: ['карьера', 'вакансии', 'работа', 'golden house'],
    },
    structure: createPageRoot('Career Page', [
      createHeader(),
      hero,
      whyUs,
      vacancies,
      applyForm,
      createFooter(),
    ]),
  }
}

// ──────────────────────────────────────────────────────────
// PAGE 7: КОНТАКТЫ (contacts)
// ──────────────────────────────────────────────────────────

function createContactsPage() {
  const hero = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Contacts Hero' },
    styles: {
      properties: {
        padding: '140px 80px 60px',
        backgroundColor: colors.cream,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      },
    },
    children: [
      createSectionLabel('Контакты'),
      createNode({
        elementType: 'text', tagName: 'h1', tag: 'h1',
        metadata: { name: 'Contacts Title' },
        content: 'Свяжитесь с нами',
        styles: { properties: { fontSize: '48px', fontWeight: '300', color: colors.black, marginBottom: '16px', letterSpacing: '-1px' } },
      }),
      createNode({
        elementType: 'text', tagName: 'p', tag: 'p',
        metadata: { name: 'Contacts Subtitle' },
        content: 'Мы всегда готовы ответить на ваши вопросы и помочь с выбором недвижимости',
        styles: { properties: { fontSize: '18px', color: colors.grayDark, fontWeight: '300', maxWidth: '600px' } },
      }),
    ],
  })

  // Contact info + form
  const contactSection = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Contact Details' },
    styles: { properties: { padding: '80px', backgroundColor: colors.white } },
    children: [
      createNode({
        metadata: { name: 'Contact Grid' },
        styles: { properties: { maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px' } },
        children: [
          // Left: contact info
          createNode({
            metadata: { name: 'Contact Info' },
            styles: { properties: { display: 'flex', flexDirection: 'column', gap: '40px' } },
            children: [
              // Offices
              createNode({
                metadata: { name: 'Office 1' },
                styles: { properties: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                children: [
                  createNode({
                    elementType: 'text', tagName: 'h3', tag: 'h3',
                    metadata: { name: 'Office Title' },
                    content: 'Головной офис',
                    styles: { properties: { fontSize: '20px', fontWeight: '600', color: colors.black } },
                  }),
                  createNode({
                    elementType: 'text', tagName: 'p', tag: 'p',
                    metadata: { name: 'Office Address' },
                    content: 'г. Ташкент, Юнусабадский район, ул. Янги Шахар, 12',
                    styles: { properties: { fontSize: '15px', color: colors.grayDark, lineHeight: '1.6' } },
                  }),
                  createNode({
                    elementType: 'text', tagName: 'p', tag: 'p',
                    metadata: { name: 'Office Hours' },
                    content: 'Пн-Пт: 9:00 – 18:00, Сб: 10:00 – 15:00',
                    styles: { properties: { fontSize: '14px', color: colors.gray } },
                  }),
                ],
              }),
              createNode({
                metadata: { name: 'Office 2' },
                styles: { properties: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                children: [
                  createNode({
                    elementType: 'text', tagName: 'h3', tag: 'h3',
                    metadata: { name: 'Office 2 Title' },
                    content: 'Офис продаж',
                    styles: { properties: { fontSize: '20px', fontWeight: '600', color: colors.black } },
                  }),
                  createNode({
                    elementType: 'text', tagName: 'p', tag: 'p',
                    metadata: { name: 'Office 2 Address' },
                    content: 'г. Ташкент, Мирзо Улугбекский район, ул. Буюк Ипак Йули, 78',
                    styles: { properties: { fontSize: '15px', color: colors.grayDark, lineHeight: '1.6' } },
                  }),
                  createNode({
                    elementType: 'text', tagName: 'p', tag: 'p',
                    metadata: { name: 'Office 2 Hours' },
                    content: 'Пн-Вс: 9:00 – 20:00',
                    styles: { properties: { fontSize: '14px', color: colors.gray } },
                  }),
                ],
              }),
              // Phone & email
              createNode({
                metadata: { name: 'Contact Methods' },
                styles: { properties: { display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '16px', borderTop: `1px solid ${colors.grayLight}` } },
                children: [
                  createNode({
                    elementType: 'text', tagName: 'a', tag: 'a',
                    metadata: { name: 'Contact Phone' },
                    content: '+998 78 150 11 11',
                    attributes: { href: 'tel:+998781501111' },
                    styles: { properties: { fontSize: '24px', fontWeight: '600', color: colors.gold, textDecoration: 'none' } },
                  }),
                  createNode({
                    elementType: 'text', tagName: 'a', tag: 'a',
                    metadata: { name: 'Contact Email' },
                    content: 'info@goldenhouse.uz',
                    attributes: { href: 'mailto:info@goldenhouse.uz' },
                    styles: { properties: { fontSize: '16px', color: colors.grayDark, textDecoration: 'none' } },
                  }),
                ],
              }),
              // Social media
              createNode({
                metadata: { name: 'Social Media' },
                styles: { properties: { display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '16px', borderTop: `1px solid ${colors.grayLight}` } },
                children: [
                  createNode({
                    elementType: 'text', tagName: 'h3', tag: 'h3',
                    metadata: { name: 'Social Title' },
                    content: 'Мы в социальных сетях',
                    styles: { properties: { fontSize: '18px', fontWeight: '600', color: colors.black, marginBottom: '4px' } },
                  }),
                  createNode({
                    metadata: { name: 'Social Links' },
                    layoutMode: 'flex',
                    styles: { properties: { display: 'flex', gap: '16px', flexWrap: 'wrap' } },
                    children: [
                      { name: 'Telegram', url: 'https://t.me/goldenhouse' },
                      { name: 'Instagram', url: 'https://instagram.com/goldenhouse' },
                      { name: 'Facebook', url: 'https://facebook.com/goldenhouse' },
                      { name: 'YouTube', url: 'https://youtube.com/goldenhouse' },
                    ].map(s => createNode({
                      elementType: 'text', tagName: 'a', tag: 'a',
                      metadata: { name: `Social - ${s.name}` },
                      content: s.name,
                      attributes: { href: s.url },
                      styles: {
                        properties: {
                          padding: '10px 20px',
                          border: `1px solid ${colors.grayLight}`,
                          borderRadius: '24px',
                          fontSize: '14px',
                          color: colors.grayDark,
                          textDecoration: 'none',
                        },
                        states: { hover: { borderColor: colors.gold, color: colors.gold } },
                        stateTransition: { duration: 200, easing: 'ease', properties: ['border-color', 'color'] },
                      },
                    })),
                  }),
                ],
              }),
            ],
          }),
          // Right: contact form
          createNode({
            tagName: 'form',
            tag: 'form',
            metadata: { name: 'Contact Form' },
            styles: {
              properties: {
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                padding: '40px',
                backgroundColor: colors.grayLighter,
                borderRadius: '12px',
              },
            },
            children: [
              createNode({
                elementType: 'text', tagName: 'h3', tag: 'h3',
                metadata: { name: 'Form Title' },
                content: 'Оставить заявку',
                styles: { properties: { fontSize: '24px', fontWeight: '600', color: colors.black, marginBottom: '8px' } },
              }),
              createNode({
                elementType: 'text', tagName: 'p', tag: 'p',
                metadata: { name: 'Form Desc' },
                content: 'Заполните форму, и мы перезвоним вам',
                styles: { properties: { fontSize: '14px', color: colors.gray, marginBottom: '8px' } },
              }),
              createNode({
                elementType: 'input', tagName: 'input', tag: 'input',
                metadata: { name: 'Form Name' },
                attributes: { type: 'text', placeholder: 'Ваше имя', name: 'name' },
                styles: { properties: { padding: '14px 16px', border: `1px solid ${colors.grayLight}`, borderRadius: '4px', fontSize: '15px', backgroundColor: colors.white } },
              }),
              createNode({
                elementType: 'input', tagName: 'input', tag: 'input',
                metadata: { name: 'Form Phone' },
                attributes: { type: 'tel', placeholder: 'Телефон', name: 'phone' },
                styles: { properties: { padding: '14px 16px', border: `1px solid ${colors.grayLight}`, borderRadius: '4px', fontSize: '15px', backgroundColor: colors.white } },
              }),
              createNode({
                elementType: 'input', tagName: 'input', tag: 'input',
                metadata: { name: 'Form Email' },
                attributes: { type: 'email', placeholder: 'Email', name: 'email' },
                styles: { properties: { padding: '14px 16px', border: `1px solid ${colors.grayLight}`, borderRadius: '4px', fontSize: '15px', backgroundColor: colors.white } },
              }),
              createNode({
                elementType: 'input', tagName: 'input', tag: 'input',
                metadata: { name: 'Form Message' },
                attributes: { type: 'text', placeholder: 'Ваш вопрос', name: 'message' },
                styles: { properties: { padding: '14px 16px', border: `1px solid ${colors.grayLight}`, borderRadius: '4px', fontSize: '15px', backgroundColor: colors.white, minHeight: '100px' } },
              }),
              createNode({
                elementType: 'button', tagName: 'button', tag: 'button',
                metadata: { name: 'Form Submit' },
                content: 'Отправить',
                styles: {
                  properties: {
                    padding: '16px 48px',
                    backgroundColor: colors.gold,
                    color: colors.white,
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    cursor: 'pointer',
                  },
                  states: { hover: { backgroundColor: colors.goldDark } },
                  stateTransition: { duration: 200, easing: 'ease', properties: ['background-color'] },
                },
              }),
            ],
          }),
        ],
      }),
    ],
  })

  // Map placeholder
  const mapSection = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Map Section' },
    styles: {
      properties: {
        height: '480px',
        backgroundColor: colors.grayLight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      },
    },
    children: [
      createNode({
        elementType: 'text', tagName: 'p', tag: 'p',
        metadata: { name: 'Map Placeholder' },
        content: 'Карта — интерактивная карта с расположением офисов',
        styles: { properties: { fontSize: '16px', color: colors.gray, textAlign: 'center' } },
      }),
    ],
  })

  // Chatbot section
  const chatbot = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Chatbot Section' },
    styles: {
      properties: {
        padding: '80px',
        backgroundColor: colors.darkBrown,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      },
    },
    children: [
      createNode({
        elementType: 'text', tagName: 'h2', tag: 'h2',
        metadata: { name: 'Chatbot Title' },
        content: 'Нужна быстрая консультация?',
        styles: { properties: { fontSize: '36px', fontWeight: '300', color: colors.white, marginBottom: '16px' } },
      }),
      createNode({
        elementType: 'text', tagName: 'p', tag: 'p',
        metadata: { name: 'Chatbot Desc' },
        content: 'Наш чат-бот в Telegram ответит на ваши вопросы 24/7',
        styles: { properties: { fontSize: '18px', color: 'rgba(255,255,255,0.7)', marginBottom: '32px', fontWeight: '300' } },
      }),
      createNode({
        elementType: 'button', tagName: 'a', tag: 'a',
        metadata: { name: 'Chatbot CTA' },
        content: 'Открыть чат в Telegram',
        attributes: { href: 'https://t.me/goldenhouse_bot' },
        styles: {
          properties: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '16px 48px',
            backgroundColor: '#2AABEE',
            color: colors.white,
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            textDecoration: 'none',
            cursor: 'pointer',
          },
          states: { hover: { backgroundColor: '#229ED9' } },
          stateTransition: { duration: 200, easing: 'ease', properties: ['background-color'] },
        },
      }),
    ],
  })

  return {
    name: 'Контакты',
    slug: 'contacts',
    status: 'draft',
    metadata: {
      title: 'Контакты — Golden House',
      description: 'Контакты Golden House. Офисы, телефоны, карта и социальные сети.',
      keywords: ['контакты', 'golden house', 'адрес', 'телефон'],
    },
    structure: createPageRoot('Contacts Page', [
      createHeader(),
      hero,
      contactSection,
      mapSection,
      chatbot,
      createFooter(),
    ]),
  }
}

// ──────────────────────────────────────────────────────────
// PAGE 8: ПУБЛИЧНАЯ ОФЕРТА (legal)
// ──────────────────────────────────────────────────────────

function createLegalPage() {
  const hero = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Legal Hero' },
    styles: {
      properties: {
        padding: '140px 80px 60px',
        backgroundColor: colors.grayLighter,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      },
    },
    children: [
      createNode({
        elementType: 'text', tagName: 'h1', tag: 'h1',
        metadata: { name: 'Legal Title' },
        content: 'Публичная оферта',
        styles: { properties: { fontSize: '42px', fontWeight: '300', color: colors.black, marginBottom: '8px' } },
      }),
      createNode({
        elementType: 'text', tagName: 'p', tag: 'p',
        metadata: { name: 'Legal Date' },
        content: 'Действует с 1 января 2024 г.',
        styles: { properties: { fontSize: '14px', color: colors.gray } },
      }),
    ],
  })

  const content = createNode({
    tagName: 'section',
    tag: 'section',
    metadata: { name: 'Legal Content' },
    styles: { properties: { padding: '80px', backgroundColor: colors.white } },
    children: [
      createNode({
        metadata: { name: 'Legal Container' },
        styles: { properties: { maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '48px' } },
        children: [
          { title: '1. Общие положения', text: 'Настоящий документ является официальным предложением (публичной офертой) компании Golden House Development (далее — «Компания») и содержит все существенные условия по оказанию услуг по продаже объектов недвижимости.' },
          { title: '2. Предмет оферты', text: 'Компания предоставляет Заказчику услуги по подбору и продаже объектов жилой и коммерческой недвижимости, расположенных в жилых комплексах Golden House, на условиях, изложенных в настоящей оферте.' },
          { title: '3. Условия оказания услуг', text: 'Заказчик оставляет заявку на сайте, по телефону или в офисе продаж. Менеджер связывается с Заказчиком для уточнения параметров и организации просмотра. После выбора объекта оформляется договор купли-продажи.' },
          { title: '4. Стоимость и порядок оплаты', text: 'Стоимость объектов недвижимости указана на сайте и в офисе продаж. Оплата производится в соответствии с условиями договора. Компания предоставляет возможность рассрочки и ипотечного финансирования.' },
          { title: '5. Права и обязанности сторон', text: 'Компания обязуется: предоставить полную и достоверную информацию об объектах; обеспечить юридическую чистоту сделки; передать объект в согласованные сроки. Заказчик обязуется: предоставить корректные контактные данные; своевременно вносить оплату.' },
          { title: '6. Ответственность сторон', text: 'Стороны несут ответственность за неисполнение или ненадлежащее исполнение обязательств в соответствии с законодательством Республики Узбекистан.' },
          { title: '7. Конфиденциальность', text: 'Персональные данные Заказчика обрабатываются в соответствии с Законом Республики Узбекистан «О персональных данных». Компания не передаёт данные третьим лицам без согласия Заказчика.' },
          { title: '8. Контактная информация', text: 'Golden House Development. Адрес: г. Ташкент, Юнусабадский район, ул. Янги Шахар, 12. Телефон: +998 78 150 11 11. Email: info@goldenhouse.uz' },
        ].map(s => createNode({
          metadata: { name: `Section - ${s.title}` },
          styles: { properties: { display: 'flex', flexDirection: 'column', gap: '12px' } },
          children: [
            createNode({
              elementType: 'text', tagName: 'h2', tag: 'h2',
              metadata: { name: 'Section Title' },
              content: s.title,
              styles: { properties: { fontSize: '24px', fontWeight: '600', color: colors.black } },
            }),
            createNode({
              elementType: 'text', tagName: 'p', tag: 'p',
              metadata: { name: 'Section Text' },
              content: s.text,
              styles: { properties: { fontSize: '16px', color: colors.grayDark, lineHeight: '1.8' } },
            }),
          ],
        })),
      }),
    ],
  })

  return {
    name: 'Публичная оферта',
    slug: 'legal',
    status: 'draft',
    metadata: {
      title: 'Публичная оферта — Golden House',
      description: 'Публичная оферта компании Golden House Development.',
      keywords: ['оферта', 'golden house', 'юридическая информация'],
    },
    structure: createPageRoot('Legal Page', [
      createHeader(),
      hero,
      content,
      createFooter(),
    ]),
  }
}

// ──────────────────── MAIN ────────────────────

async function findPageBySlug(slug) {
  const response = await fetch(`${API_URL}/pages`)
  if (!response.ok) return null
  const pages = await response.json()
  return pages.find(p => p.slug === slug) || null
}

async function upsertPage(pageData) {
  const existing = await findPageBySlug(pageData.slug)

  if (existing) {
    // Update existing page
    const response = await fetch(`${API_URL}/pages/${existing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pageData),
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Failed to update "${pageData.name}": ${response.status} ${err}`)
    }
    const result = await response.json()
    return { ...result, _action: 'updated' }
  } else {
    // Create new page
    const response = await fetch(`${API_URL}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pageData),
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Failed to create "${pageData.name}": ${response.status} ${err}`)
    }
    const result = await response.json()
    return { ...result, _action: 'created' }
  }
}

async function main() {
  const pages = [
    createHomePage(),
    createAboutPage(),
    createResidentialPage(),
    createCommercialPage(),
    createNewsPage(),
    createCareerPage(),
    createContactsPage(),
    createLegalPage(),
  ]

  console.log(`\n🏗  Создание/обновление ${pages.length} страниц Golden House...\n`)

  for (const page of pages) {
    try {
      const result = await upsertPage(page)
      const icon = result._action === 'updated' ? '🔄' : '✅'
      const verb = result._action === 'updated' ? 'обновлена' : 'создана'
      console.log(`${icon}  ${page.name} (/${page.slug}) — ${verb} [ID: ${result.id}]`)
    } catch (err) {
      console.error(`❌  ${page.name} (/${page.slug}) — ошибка: ${err.message}`)
    }
  }

  console.log(`\n✨ Готово!\n`)
}

main()
