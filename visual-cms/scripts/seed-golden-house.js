/**
 * Скрипт для создания блоков Golden House
 * Запуск: node scripts/seed-golden-house.js
 */

const API_URL = 'http://localhost:5000/api'

// Генератор ID
let idCounter = 0
const generateId = () => `gh-${Date.now()}-${++idCounter}`

// Утилита для создания узла
const createNode = (overrides) => ({
  id: generateId(),
  elementType: 'container',
  tagName: 'div',
  styles: { properties: {} },
  layoutMode: 'flex',
  children: [],
  metadata: { name: 'Element' },
  content: '',
  attributes: {},
  ...overrides,
})

// Фирменные цвета Golden House
const colors = {
  gold: '#D29F66',
  goldLight: '#E4C9A8',
  goldDark: '#B8864D',
  white: '#FFFFFF',
  black: '#403E3D',
  gray: '#B1B2B2',
  grayLight: '#F5F5F5',
}

// =====================
// БЛОК 1: HEADER (responsive с бургер-меню)
// =====================

// Нам нужны стабильные ID для элементов, на которые ссылаются variations и скрипты
const headerIds = {
  root: `gh-header-root`,
  logo: `gh-header-logo`,
  nav: `gh-header-nav`,
  headerRight: `gh-header-right`,
  burger: `gh-header-burger`,
  burgerLine1: `gh-header-burger-l1`,
  burgerLine2: `gh-header-burger-l2`,
  burgerLine3: `gh-header-burger-l3`,
  overlay: `gh-header-overlay`,
  overlayContent: `gh-header-overlay-content`,
}

const navLabels = ['Квартиры', 'Коммерция', 'Ипотека', 'О компании', 'Контакты']

const headerBlock = {
  name: 'GH - Header',
  type: 'static',
  isReusable: true,
  tags: ['header', 'navigation', 'golden-house', 'responsive', 'burger-menu'],
  structure: {
    id: headerIds.root,
    elementType: 'container',
    tagName: 'header',
    layoutMode: 'flex',
    children: [],
    content: '',
    attributes: {},
    metadata: {
      name: 'Header',
      // Определяем breakpoints для responsive CSS генерации
      breakpoints: [
        { id: 'tablet', name: 'Tablet', width: 768 },
        { id: 'mobile', name: 'Mobile', width: 480 },
      ],
    },
    styles: {
      properties: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        height: '80px',
        backgroundColor: colors.black,
        position: 'sticky',
        top: '0',
        zIndex: '1000',
      },
    },
    // --- Responsive variations (только стилевые корректировки, show/hide управляется JS) ---
    variations: {
      tablet: {
        inheritedOverrides: {
          [headerIds.root]: {
            styles: {
              padding: '0 20px',
              height: '64px',
            },
          },
          [headerIds.logo]: {
            styles: {
              fontSize: '18px',
            },
          },
        },
      },
      mobile: {
        inheritedOverrides: {
          [headerIds.root]: {
            styles: {
              padding: '0 16px',
              height: '56px',
            },
          },
          [headerIds.logo]: {
            styles: {
              fontSize: '16px',
              letterSpacing: '1px',
            },
          },
        },
      },
    },
    // Скрипт адаптивного бургера — показывает/скрывает навигацию по месту
    scripts: [
      {
        id: 'adaptive-burger-script',
        name: 'Adaptive Burger (content-aware)',
        code: `
          var nav = document.querySelector('[data-element-id="${headerIds.nav}"]');
          var headerRight = document.querySelector('[data-element-id="${headerIds.headerRight}"]');
          var burger = document.querySelector('[data-element-id="${headerIds.burger}"]');
          var overlay = document.querySelector('[data-element-id="${headerIds.overlay}"]');
          var logo = document.querySelector('[data-element-id="${headerIds.logo}"]');
          var line1 = document.querySelector('[data-element-id="${headerIds.burgerLine1}"]');
          var line2 = document.querySelector('[data-element-id="${headerIds.burgerLine2}"]');
          var line3 = document.querySelector('[data-element-id="${headerIds.burgerLine3}"]');

          if (!nav || !headerRight || !burger || !logo) return;

          // Измеряем минимальную ширину контента при первой загрузке
          // (пока nav ещё видима — display не none)
          var minGap = 40; // минимальный зазор между элементами
          var navWidth = nav.scrollWidth;
          var rightWidth = headerRight.scrollWidth;
          var logoWidth = logo.scrollWidth;
          var neededWidth = logoWidth + navWidth + rightWidth + minGap * 2;

          var burgerMode = false;

          function checkFit() {
            var available = element.clientWidth;

            if (available < neededWidth && !burgerMode) {
              // Не хватает места — включаем бургер
              burgerMode = true;
              nav.style.display = 'none';
              headerRight.style.display = 'none';
              burger.style.display = 'flex';
            } else if (available >= neededWidth && burgerMode) {
              // Места хватает — возвращаем навигацию
              burgerMode = false;
              nav.style.display = 'flex';
              headerRight.style.display = 'flex';
              burger.style.display = 'none';

              // Закрываем оверлей если был открыт
              if (overlay && overlay.style.visibility === 'visible') {
                overlay.style.opacity = '0';
                setTimeout(function() { overlay.style.visibility = 'hidden'; }, 300);
                document.body.style.overflow = '';
                if (line1) line1.style.transform = 'none';
                if (line2) line2.style.opacity = '1';
                if (line3) line3.style.transform = 'none';
                burger.setAttribute('aria-expanded', 'false');
              }
            }
          }

          checkFit();
          window.addEventListener('resize', checkFit);
        `,
        trigger: 'load',
        enabled: true,
      },
    ],
  },
}

// --- Children ---
// 1) Logo
headerBlock.structure.children.push({
  id: headerIds.logo,
  elementType: 'text',
  tagName: 'a',
  layoutMode: 'flex',
  children: [],
  attributes: { href: '/' },
  content: 'GOLDEN HOUSE',
  metadata: { name: 'Logo' },
  styles: {
    properties: {
      color: colors.gold,
      fontSize: '24px',
      fontWeight: '700',
      fontFamily: 'Muller, sans-serif',
      letterSpacing: '2px',
      textDecoration: 'none',
    },
  },
})

// 2) Desktop Navigation
headerBlock.structure.children.push({
  id: headerIds.nav,
  elementType: 'container',
  tagName: 'nav',
  layoutMode: 'flex',
  children: navLabels.map(label =>
    createNode({
      elementType: 'link',
      tagName: 'a',
      metadata: { name: `Nav - ${label}` },
      content: label,
      attributes: { href: '#' },
      styles: {
        properties: {
          color: 'rgba(255,255,255,0.9)',
          fontSize: '14px',
          fontFamily: 'Muller, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          textDecoration: 'none',
        },
        states: {
          hover: { color: colors.gold },
        },
        stateTransition: {
          duration: 200,
          easing: 'ease',
          properties: ['color'],
        },
      },
    })
  ),
  content: '',
  attributes: {},
  metadata: { name: 'Navigation' },
  styles: {
    properties: {
      display: 'flex',
      gap: '32px',
    },
  },
})

// 3) Header Right (phone + CTA) — скрывается на мобильном
headerBlock.structure.children.push({
  id: headerIds.headerRight,
  elementType: 'container',
  tagName: 'div',
  layoutMode: 'flex',
  children: [
    createNode({
      elementType: 'text',
      tagName: 'a',
      metadata: { name: 'Phone' },
      content: '+998 78 150-11-11',
      attributes: { href: 'tel:+998781501111' },
      styles: {
        properties: {
          color: colors.white,
          fontSize: '16px',
          fontFamily: 'Muller, sans-serif',
          fontWeight: '500',
          textDecoration: 'none',
        },
        states: {
          hover: { color: colors.gold },
        },
        stateTransition: {
          duration: 200,
          easing: 'ease',
          properties: ['color'],
        },
      },
    }),
    createNode({
      elementType: 'button',
      tagName: 'button',
      metadata: { name: 'CTA Button' },
      content: 'Перезвоните мне',
      styles: {
        properties: {
          backgroundColor: colors.gold,
          color: colors.white,
          padding: '12px 24px',
          borderRadius: '4px',
          border: 'none',
          fontSize: '14px',
          fontFamily: 'Muller, sans-serif',
          fontWeight: '500',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          cursor: 'pointer',
        },
        states: {
          hover: { backgroundColor: colors.goldDark },
        },
        stateTransition: {
          duration: 200,
          easing: 'ease',
          properties: ['background-color'],
        },
      },
    }),
  ],
  content: '',
  attributes: {},
  metadata: { name: 'Header Right' },
  styles: {
    properties: {
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
    },
  },
})

// 4) Burger Button — скрыт по умолчанию (display: none), показывается через responsive CSS
headerBlock.structure.children.push({
  id: headerIds.burger,
  elementType: 'button',
  tagName: 'button',
  layoutMode: 'flex',
  children: [
    // Три линии бургера
    {
      id: headerIds.burgerLine1,
      elementType: 'container',
      tagName: 'span',
      layoutMode: 'flex',
      children: [],
      content: '',
      attributes: {},
      metadata: { name: 'Burger Line 1' },
      styles: {
        properties: {
          display: 'block',
          width: '24px',
          height: '2px',
          backgroundColor: colors.white,
          borderRadius: '1px',
          transition: 'transform 0.3s ease, opacity 0.3s ease',
        },
      },
    },
    {
      id: headerIds.burgerLine2,
      elementType: 'container',
      tagName: 'span',
      layoutMode: 'flex',
      children: [],
      content: '',
      attributes: {},
      metadata: { name: 'Burger Line 2' },
      styles: {
        properties: {
          display: 'block',
          width: '24px',
          height: '2px',
          backgroundColor: colors.white,
          borderRadius: '1px',
          transition: 'transform 0.3s ease, opacity 0.3s ease',
        },
      },
    },
    {
      id: headerIds.burgerLine3,
      elementType: 'container',
      tagName: 'span',
      layoutMode: 'flex',
      children: [],
      content: '',
      attributes: {},
      metadata: { name: 'Burger Line 3' },
      styles: {
        properties: {
          display: 'block',
          width: '24px',
          height: '2px',
          backgroundColor: colors.white,
          borderRadius: '1px',
          transition: 'transform 0.3s ease, opacity 0.3s ease',
        },
      },
    },
  ],
  content: '',
  attributes: { 'aria-label': 'Меню', 'aria-expanded': 'false' },
  metadata: { name: 'Burger Button' },
  styles: {
    properties: {
      display: 'none', // Скрыт на desktop
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '5px',
      width: '40px',
      height: '40px',
      backgroundColor: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: '8px',
      zIndex: '1002',
      position: 'relative',
    },
  },
  // Скрипт для toggle бургер-меню
  scripts: [
    {
      id: 'burger-toggle-script',
      name: 'Burger Menu Toggle',
      code: `
        var overlay = document.querySelector('[data-element-id="${headerIds.overlay}"]');
        var line1 = document.querySelector('[data-element-id="${headerIds.burgerLine1}"]');
        var line2 = document.querySelector('[data-element-id="${headerIds.burgerLine2}"]');
        var line3 = document.querySelector('[data-element-id="${headerIds.burgerLine3}"]');
        var isOpen = false;

        element.addEventListener('click', function(e) {
          e.stopPropagation();
          isOpen = !isOpen;
          element.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

          if (isOpen) {
            // Анимация бургера → крестик
            line1.style.transform = 'translateY(7px) rotate(45deg)';
            line2.style.opacity = '0';
            line3.style.transform = 'translateY(-7px) rotate(-45deg)';
            // Показать оверлей
            overlay.style.visibility = 'visible';
            overlay.style.opacity = '1';
            // Заблокировать скролл
            document.body.style.overflow = 'hidden';
          } else {
            // Анимация крестик → бургер
            line1.style.transform = 'none';
            line2.style.opacity = '1';
            line3.style.transform = 'none';
            // Скрыть оверлей
            overlay.style.opacity = '0';
            setTimeout(function() { overlay.style.visibility = 'hidden'; }, 300);
            // Вернуть скролл
            document.body.style.overflow = '';
          }
        });

        // Закрытие при клике на ссылку в оверлее
        if (overlay) {
          overlay.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
              isOpen = false;
              element.setAttribute('aria-expanded', 'false');
              line1.style.transform = 'none';
              line2.style.opacity = '1';
              line3.style.transform = 'none';
              overlay.style.opacity = '0';
              setTimeout(function() { overlay.style.visibility = 'hidden'; }, 300);
              document.body.style.overflow = '';
            });
          });
        }
      `,
      trigger: 'load',
      enabled: true,
    },
  ],
})

// 5) Mobile Overlay — скрыт по умолчанию, переключается JS-скриптом бургера
headerBlock.structure.children.push({
  id: headerIds.overlay,
  elementType: 'container',
  tagName: 'div',
  layoutMode: 'flex',
  children: [
    // Overlay Content wrapper
    {
      id: headerIds.overlayContent,
      elementType: 'container',
      tagName: 'nav',
      layoutMode: 'flex',
      children: [
        // Мобильные навигационные ссылки
        ...navLabels.map(label =>
          createNode({
            elementType: 'link',
            tagName: 'a',
            metadata: { name: `Mobile Nav - ${label}` },
            content: label,
            attributes: { href: '#' },
            styles: {
              properties: {
                color: colors.white,
                fontSize: '20px',
                fontFamily: 'Muller, sans-serif',
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                textDecoration: 'none',
                padding: '12px 0',
                borderBottom: `1px solid rgba(255,255,255,0.1)`,
                width: '100%',
                textAlign: 'center',
              },
              states: {
                hover: { color: colors.gold },
              },
              stateTransition: {
                duration: 200,
                easing: 'ease',
                properties: ['color'],
              },
            },
          })
        ),
        // Разделитель
        createNode({
          elementType: 'container',
          tagName: 'div',
          metadata: { name: 'Divider' },
          styles: {
            properties: {
              width: '60px',
              height: '2px',
              backgroundColor: colors.gold,
              margin: '16px auto',
              borderRadius: '1px',
            },
          },
        }),
        // Телефон
        createNode({
          elementType: 'text',
          tagName: 'a',
          metadata: { name: 'Mobile Phone' },
          content: '+998 78 150-11-11',
          attributes: { href: 'tel:+998781501111' },
          styles: {
            properties: {
              color: colors.white,
              fontSize: '20px',
              fontFamily: 'Muller, sans-serif',
              fontWeight: '500',
              textDecoration: 'none',
              marginBottom: '24px',
            },
            states: {
              hover: { color: colors.gold },
            },
            stateTransition: {
              duration: 200,
              easing: 'ease',
              properties: ['color'],
            },
          },
        }),
        // CTA кнопка
        createNode({
          elementType: 'button',
          tagName: 'a',
          metadata: { name: 'Mobile CTA' },
          content: 'Перезвоните мне',
          attributes: { href: '#callback' },
          styles: {
            properties: {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.gold,
              color: colors.white,
              padding: '16px 40px',
              borderRadius: '4px',
              fontSize: '14px',
              fontFamily: 'Muller, sans-serif',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              textDecoration: 'none',
              cursor: 'pointer',
            },
            states: {
              hover: { backgroundColor: colors.goldDark },
            },
            stateTransition: {
              duration: 200,
              easing: 'ease',
              properties: ['background-color'],
            },
          },
        }),
      ],
      content: '',
      attributes: {},
      metadata: { name: 'Overlay Content' },
      styles: {
        properties: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          width: '100%',
          maxWidth: '400px',
          padding: '0 24px',
        },
      },
    },
  ],
  content: '',
  attributes: {},
  metadata: { name: 'Mobile Overlay' },
  styles: {
    properties: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100vh',
      backgroundColor: 'rgba(64, 62, 61, 0.97)',
      zIndex: '1001',
      visibility: 'hidden',
      opacity: '0',
      transition: 'opacity 0.3s ease, visibility 0.3s ease',
    },
  },
})

// =====================
// БЛОК 2: HERO
// =====================
const heroBlock = {
  name: 'GH - Hero Section',
  type: 'static',
  isReusable: true,
  tags: ['hero', 'banner', 'golden-house'],
  structure: createNode({
    tagName: 'section',
    metadata: { name: 'Hero Section' },
    styles: {
      properties: {
        display: 'flex',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '120px 40px 80px',
        backgroundColor: colors.black,
        backgroundImage: 'linear-gradient(to right, rgba(64,62,61,1) 0%, rgba(64,62,61,0.8) 50%, rgba(64,62,61,0.4) 100%), url(https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      },
    },
    children: [
      createNode({
        metadata: { name: 'Hero Content' },
        styles: {
          properties: {
            maxWidth: '600px',
          },
        },
        children: [
          createNode({
            elementType: 'text',
            tagName: 'p',
            metadata: { name: 'Subtitle' },
            content: 'Национальный лидер рынка недвижимости',
            styles: {
              properties: {
                color: colors.gold,
                fontSize: '14px',
                fontFamily: 'Muller, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '3px',
                marginBottom: '16px',
              },
            },
          }),
          createNode({
            elementType: 'text',
            tagName: 'h1',
            metadata: { name: 'Title' },
            content: 'Golden House — искусство создавать',
            styles: {
              properties: {
                color: colors.white,
                fontSize: '56px',
                fontFamily: 'Muller, sans-serif',
                fontWeight: '700',
                lineHeight: '1.2',
                marginBottom: '24px',
              },
            },
          }),
          createNode({
            elementType: 'text',
            tagName: 'p',
            metadata: { name: 'Description' },
            content: 'Вся наша команда работает для того, чтобы отразить вашу индивидуальность в месте, где вы проводите половину своего времени',
            styles: {
              properties: {
                color: 'rgba(255,255,255,0.8)',
                fontSize: '18px',
                fontFamily: 'Muller, sans-serif',
                lineHeight: '1.6',
                marginBottom: '32px',
              },
            },
          }),
          createNode({
            metadata: { name: 'Buttons' },
            styles: {
              properties: {
                display: 'flex',
                gap: '16px',
              },
            },
            children: [
              createNode({
                elementType: 'button',
                tagName: 'a',
                metadata: { name: 'Primary CTA' },
                content: 'Смотреть проекты',
                attributes: { href: '/projects' },
                styles: {
                  properties: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: colors.gold,
                    color: colors.white,
                    padding: '16px 32px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    textDecoration: 'none',
                  },
                },
              }),
              createNode({
                elementType: 'button',
                tagName: 'a',
                metadata: { name: 'Secondary CTA' },
                content: 'О компании',
                attributes: { href: '/company' },
                styles: {
                  properties: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    backgroundColor: 'transparent',
                    color: colors.white,
                    padding: '16px 32px',
                    borderRadius: '4px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    fontSize: '14px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    textDecoration: 'none',
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

// =====================
// БЛОК 3: STATS
// =====================
const statsBlock = {
  name: 'GH - Statistics',
  type: 'static',
  isReusable: true,
  tags: ['stats', 'numbers', 'golden-house'],
  structure: createNode({
    tagName: 'section',
    metadata: { name: 'Stats Section' },
    styles: {
      properties: {
        display: 'flex',
        justifyContent: 'center',
        padding: '80px 40px',
        backgroundColor: colors.white,
      },
    },
    children: [
      createNode({
        metadata: { name: 'Stats Grid' },
        layoutMode: 'grid',
        styles: {
          properties: {
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '48px',
            maxWidth: '1200px',
            width: '100%',
          },
        },
        children: [
          { number: '13+', label: 'лет', desc: 'на рынке недвижимости Узбекистана' },
          { number: '2', label: 'млн м²', desc: 'недвижимости в продаже' },
          { number: '25', label: 'объектов', desc: 'в реализации в Ташкентской области' },
          { number: '30', label: 'тысяч', desc: 'человек проживает в наших домах' },
        ].map((stat, i) =>
          createNode({
            metadata: { name: `Stat ${i + 1}` },
            styles: {
              properties: {
                textAlign: 'center',
              },
            },
            children: [
              createNode({
                metadata: { name: 'Stat Number' },
                styles: {
                  properties: {
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'center',
                    gap: '4px',
                    marginBottom: '8px',
                  },
                },
                children: [
                  createNode({
                    elementType: 'text',
                    tagName: 'span',
                    metadata: { name: 'Number' },
                    content: stat.number,
                    styles: {
                      properties: {
                        color: colors.gold,
                        fontSize: '48px',
                        fontFamily: 'Muller, sans-serif',
                        fontWeight: '700',
                      },
                    },
                  }),
                  createNode({
                    elementType: 'text',
                    tagName: 'span',
                    metadata: { name: 'Label' },
                    content: stat.label,
                    styles: {
                      properties: {
                        color: colors.gray,
                        fontSize: '18px',
                        fontFamily: 'Muller, sans-serif',
                      },
                    },
                  }),
                ],
              }),
              createNode({
                elementType: 'text',
                tagName: 'p',
                metadata: { name: 'Description' },
                content: stat.desc,
                styles: {
                  properties: {
                    color: 'rgba(64,62,61,0.7)',
                    fontSize: '14px',
                    fontFamily: 'Muller, sans-serif',
                  },
                },
              }),
            ],
          })
        ),
      }),
    ],
  }),
}

// =====================
// БЛОК 4: ABOUT
// =====================
const aboutBlock = {
  name: 'GH - About Section',
  type: 'static',
  isReusable: true,
  tags: ['about', 'company', 'golden-house'],
  structure: createNode({
    tagName: 'section',
    metadata: { name: 'About Section' },
    styles: {
      properties: {
        display: 'flex',
        justifyContent: 'center',
        padding: '80px 40px',
        backgroundColor: colors.grayLight,
      },
    },
    children: [
      createNode({
        metadata: { name: 'About Container' },
        layoutMode: 'grid',
        styles: {
          properties: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '64px',
            maxWidth: '1200px',
            alignItems: 'center',
          },
        },
        children: [
          createNode({
            metadata: { name: 'About Text' },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'p',
                metadata: { name: 'Label' },
                content: 'О компании',
                styles: {
                  properties: {
                    color: colors.gold,
                    fontSize: '14px',
                    fontFamily: 'Muller, sans-serif',
                    textTransform: 'uppercase',
                    letterSpacing: '3px',
                    marginBottom: '16px',
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'h2',
                metadata: { name: 'Title' },
                content: 'Уже более 13 лет на рынке Узбекистана',
                styles: {
                  properties: {
                    color: colors.black,
                    fontSize: '40px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '700',
                    lineHeight: '1.2',
                    marginBottom: '24px',
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'p',
                metadata: { name: 'Text 1' },
                content: 'За годы работы компания приобрела огромный опыт в девелопменте, что позволило занять одну из лидирующих позиций на рынке недвижимости.',
                styles: {
                  properties: {
                    color: 'rgba(64,62,61,0.7)',
                    fontSize: '16px',
                    fontFamily: 'Muller, sans-serif',
                    lineHeight: '1.7',
                    marginBottom: '16px',
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'p',
                metadata: { name: 'Text 2' },
                content: 'На сегодняшний день компания осуществляет весь цикл девелопмента, реализовывая строительство во всех сегментах рынка.',
                styles: {
                  properties: {
                    color: 'rgba(64,62,61,0.7)',
                    fontSize: '16px',
                    fontFamily: 'Muller, sans-serif',
                    lineHeight: '1.7',
                    marginBottom: '24px',
                  },
                },
              }),
              createNode({
                elementType: 'link',
                tagName: 'a',
                metadata: { name: 'Link' },
                content: 'Подробнее о компании →',
                attributes: { href: '/company' },
                styles: {
                  properties: {
                    color: colors.gold,
                    fontSize: '16px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '500',
                    textDecoration: 'none',
                  },
                },
              }),
            ],
          }),
          createNode({
            metadata: { name: 'About Image' },
            styles: { properties: { position: 'relative' } },
            children: [
              createNode({
                elementType: 'image',
                tagName: 'img',
                metadata: { name: 'Image' },
                attributes: {
                  src: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800',
                  alt: 'Golden House Building',
                },
                styles: {
                  properties: {
                    width: '100%',
                    height: '500px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                  },
                },
              }),
              createNode({
                metadata: { name: 'Award Badge' },
                styles: {
                  properties: {
                    position: 'absolute',
                    bottom: '-24px',
                    left: '-24px',
                    backgroundColor: colors.gold,
                    padding: '24px',
                    borderRadius: '8px',
                  },
                },
                children: [
                  createNode({
                    elementType: 'text',
                    tagName: 'p',
                    metadata: { name: 'Award Number' },
                    content: '9 наград',
                    styles: {
                      properties: {
                        color: colors.white,
                        fontSize: '20px',
                        fontFamily: 'Muller, sans-serif',
                        fontWeight: '700',
                      },
                    },
                  }),
                  createNode({
                    elementType: 'text',
                    tagName: 'p',
                    metadata: { name: 'Award Text' },
                    content: 'Asia Pacific Property Awards',
                    styles: {
                      properties: {
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: '14px',
                        fontFamily: 'Muller, sans-serif',
                      },
                    },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  }),
}

// =====================
// БЛОК 5: PROJECTS
// =====================
const projectsBlock = {
  name: 'GH - Projects Section',
  type: 'static',
  isReusable: true,
  tags: ['projects', 'portfolio', 'golden-house'],
  structure: createNode({
    tagName: 'section',
    metadata: { name: 'Projects Section' },
    styles: {
      properties: {
        padding: '80px 40px',
        backgroundColor: colors.white,
      },
    },
    children: [
      createNode({
        metadata: { name: 'Projects Container' },
        styles: {
          properties: {
            maxWidth: '1200px',
            margin: '0 auto',
          },
        },
        children: [
          createNode({
            metadata: { name: 'Projects Header' },
            styles: {
              properties: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '48px',
              },
            },
            children: [
              createNode({
                metadata: { name: 'Header Text' },
                children: [
                  createNode({
                    elementType: 'text',
                    tagName: 'p',
                    metadata: { name: 'Label' },
                    content: 'Жилые комплексы',
                    styles: {
                      properties: {
                        color: colors.gold,
                        fontSize: '14px',
                        fontFamily: 'Muller, sans-serif',
                        textTransform: 'uppercase',
                        letterSpacing: '3px',
                        marginBottom: '8px',
                      },
                    },
                  }),
                  createNode({
                    elementType: 'text',
                    tagName: 'h2',
                    metadata: { name: 'Title' },
                    content: 'Наши проекты',
                    styles: {
                      properties: {
                        color: colors.black,
                        fontSize: '40px',
                        fontFamily: 'Muller, sans-serif',
                        fontWeight: '700',
                      },
                    },
                  }),
                ],
              }),
              createNode({
                elementType: 'button',
                tagName: 'a',
                metadata: { name: 'View All Button' },
                content: 'Все проекты →',
                attributes: { href: '/projects' },
                styles: {
                  properties: {
                    backgroundColor: colors.black,
                    color: colors.white,
                    padding: '14px 28px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    textDecoration: 'none',
                  },
                },
              }),
            ],
          }),
          createNode({
            metadata: { name: 'Projects Grid' },
            layoutMode: 'grid',
            styles: {
              properties: {
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '24px',
              },
            },
            children: [
              { name: 'INFINITY Клубный дом', class: 'Премиум класс', img: 'https://images.unsplash.com/photo-1515263487990-61b07816b324?w=600' },
              { name: "O'Z Mahal", class: 'Бизнес класс', img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600' },
              { name: "O'Z Zamin", class: 'Комфорт+ класс', img: 'https://images.unsplash.com/photo-1567684014761-b65e2e59b9eb?w=600' },
              { name: 'Assalom Sohil', class: 'Комфорт класс', img: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=600' },
            ].map((project, i) =>
              createNode({
                elementType: 'link',
                tagName: 'a',
                metadata: { name: `Project ${i + 1}` },
                attributes: { href: '#' },
                styles: {
                  properties: {
                    position: 'relative',
                    display: 'block',
                    aspectRatio: '3/4',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    textDecoration: 'none',
                  },
                },
                children: [
                  createNode({
                    elementType: 'image',
                    tagName: 'img',
                    metadata: { name: 'Project Image' },
                    attributes: { src: project.img, alt: project.name },
                    styles: {
                      properties: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      },
                    },
                  }),
                  createNode({
                    metadata: { name: 'Project Overlay' },
                    styles: {
                      properties: {
                        position: 'absolute',
                        inset: '0',
                        background: 'linear-gradient(to top, rgba(64,62,61,0.9) 0%, transparent 50%)',
                      },
                    },
                  }),
                  createNode({
                    metadata: { name: 'Project Info' },
                    styles: {
                      properties: {
                        position: 'absolute',
                        bottom: '24px',
                        left: '24px',
                        right: '24px',
                      },
                    },
                    children: [
                      createNode({
                        elementType: 'text',
                        tagName: 'p',
                        metadata: { name: 'Project Class' },
                        content: project.class,
                        styles: {
                          properties: {
                            color: colors.gold,
                            fontSize: '14px',
                            fontFamily: 'Muller, sans-serif',
                            marginBottom: '4px',
                          },
                        },
                      }),
                      createNode({
                        elementType: 'text',
                        tagName: 'h3',
                        metadata: { name: 'Project Name' },
                        content: project.name,
                        styles: {
                          properties: {
                            color: colors.white,
                            fontSize: '20px',
                            fontFamily: 'Muller, sans-serif',
                            fontWeight: '700',
                          },
                        },
                      }),
                    ],
                  }),
                ],
              })
            ),
          }),
        ],
      }),
    ],
  }),
}

// =====================
// БЛОК 6: ADVANTAGES
// =====================
const advantagesBlock = {
  name: 'GH - Advantages Section',
  type: 'static',
  isReusable: true,
  tags: ['advantages', 'features', 'golden-house'],
  structure: createNode({
    tagName: 'section',
    metadata: { name: 'Advantages Section' },
    styles: {
      properties: {
        padding: '80px 40px',
        backgroundColor: colors.black,
      },
    },
    children: [
      createNode({
        metadata: { name: 'Advantages Container' },
        styles: {
          properties: {
            maxWidth: '1200px',
            margin: '0 auto',
          },
        },
        children: [
          createNode({
            metadata: { name: 'Section Header' },
            styles: {
              properties: {
                textAlign: 'center',
                marginBottom: '48px',
              },
            },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'p',
                metadata: { name: 'Label' },
                content: 'Почему выбирают нас',
                styles: {
                  properties: {
                    color: colors.gold,
                    fontSize: '14px',
                    fontFamily: 'Muller, sans-serif',
                    textTransform: 'uppercase',
                    letterSpacing: '3px',
                    marginBottom: '16px',
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'h2',
                metadata: { name: 'Title' },
                content: 'Наши преимущества',
                styles: {
                  properties: {
                    color: colors.white,
                    fontSize: '40px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '700',
                  },
                },
              }),
            ],
          }),
          createNode({
            metadata: { name: 'Advantages Grid' },
            layoutMode: 'grid',
            styles: {
              properties: {
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '24px',
              },
            },
            children: [
              { title: 'Надёжность', desc: '15 лет безупречной репутации и доверия клиентов' },
              { title: 'Качество', desc: 'Международные стандарты строительства и материалов' },
              { title: 'Прозрачность', desc: 'Открытые отношения с клиентами и партнёрами' },
              { title: 'Опыт', desc: 'Сотрудничество с международными архитекторами' },
              { title: 'Комфорт', desc: 'Жилые комплексы от комфорт до премиум класса' },
              { title: 'Признание', desc: '9 наград Asia Pacific Property Awards' },
            ].map((adv, i) =>
              createNode({
                metadata: { name: `Advantage ${i + 1}` },
                styles: {
                  properties: {
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '32px',
                  },
                },
                children: [
                  createNode({
                    elementType: 'text',
                    tagName: 'h3',
                    metadata: { name: 'Title' },
                    content: adv.title,
                    styles: {
                      properties: {
                        color: colors.white,
                        fontSize: '20px',
                        fontFamily: 'Muller, sans-serif',
                        fontWeight: '700',
                        marginBottom: '8px',
                      },
                    },
                  }),
                  createNode({
                    elementType: 'text',
                    tagName: 'p',
                    metadata: { name: 'Description' },
                    content: adv.desc,
                    styles: {
                      properties: {
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '16px',
                        fontFamily: 'Muller, sans-serif',
                        lineHeight: '1.5',
                      },
                    },
                  }),
                ],
              })
            ),
          }),
        ],
      }),
    ],
  }),
}

// =====================
// БЛОК 7: CTA
// =====================
const ctaBlock = {
  name: 'GH - CTA Section',
  type: 'static',
  isReusable: true,
  tags: ['cta', 'call-to-action', 'golden-house'],
  structure: createNode({
    tagName: 'section',
    metadata: { name: 'CTA Section' },
    styles: {
      properties: {
        padding: '80px 40px',
        backgroundColor: colors.gold,
      },
    },
    children: [
      createNode({
        metadata: { name: 'CTA Container' },
        styles: {
          properties: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            maxWidth: '1200px',
            margin: '0 auto',
          },
        },
        children: [
          createNode({
            metadata: { name: 'CTA Text' },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'h2',
                metadata: { name: 'Title' },
                content: 'Готовы выбрать свой идеальный дом?',
                styles: {
                  properties: {
                    color: colors.white,
                    fontSize: '40px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '700',
                    marginBottom: '8px',
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'p',
                metadata: { name: 'Subtitle' },
                content: 'Свяжитесь с нами для консультации и подбора квартиры',
                styles: {
                  properties: {
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '18px',
                    fontFamily: 'Muller, sans-serif',
                  },
                },
              }),
            ],
          }),
          createNode({
            metadata: { name: 'CTA Buttons' },
            styles: {
              properties: {
                display: 'flex',
                gap: '16px',
              },
            },
            children: [
              createNode({
                elementType: 'button',
                tagName: 'a',
                metadata: { name: 'Phone Button' },
                content: '+998 78 150-11-11',
                attributes: { href: 'tel:+998781501111' },
                styles: {
                  properties: {
                    backgroundColor: colors.white,
                    color: colors.black,
                    padding: '16px 32px',
                    borderRadius: '4px',
                    fontSize: '16px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '700',
                    textDecoration: 'none',
                  },
                },
              }),
              createNode({
                elementType: 'button',
                tagName: 'button',
                metadata: { name: 'Submit Button' },
                content: 'Оставить заявку',
                styles: {
                  properties: {
                    backgroundColor: colors.black,
                    color: colors.white,
                    padding: '16px 32px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '14px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
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

// =====================
// БЛОК 8: CONTACT FORM
// =====================
const contactBlock = {
  name: 'GH - Contact Section',
  type: 'static',
  isReusable: true,
  tags: ['contact', 'form', 'golden-house'],
  structure: createNode({
    tagName: 'section',
    metadata: { name: 'Contact Section' },
    styles: {
      properties: {
        padding: '80px 40px',
        backgroundColor: colors.white,
      },
    },
    children: [
      createNode({
        metadata: { name: 'Contact Container' },
        layoutMode: 'grid',
        styles: {
          properties: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '64px',
            maxWidth: '1200px',
            margin: '0 auto',
          },
        },
        children: [
          createNode({
            metadata: { name: 'Contact Info' },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'p',
                metadata: { name: 'Label' },
                content: 'Контакты',
                styles: {
                  properties: {
                    color: colors.gold,
                    fontSize: '14px',
                    fontFamily: 'Muller, sans-serif',
                    textTransform: 'uppercase',
                    letterSpacing: '3px',
                    marginBottom: '16px',
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'h2',
                metadata: { name: 'Title' },
                content: 'Свяжитесь с нами',
                styles: {
                  properties: {
                    color: colors.black,
                    fontSize: '40px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '700',
                    marginBottom: '32px',
                  },
                },
              }),
              createNode({
                metadata: { name: 'Contact Items' },
                styles: {
                  properties: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                  },
                },
                children: [
                  { label: 'Адрес', value: 'Яшнабадский район, 5-й пр-д Садыка Азимова, бизнес-центр «Infinity»' },
                  { label: 'Телефон', value: '+998 78 150-11-11' },
                  { label: 'Время работы', value: 'Пн-Пт: с 9:00 до 18:00' },
                  { label: 'Email', value: 'info@gh.uz' },
                ].map((item, i) =>
                  createNode({
                    metadata: { name: `Contact Item ${i + 1}` },
                    styles: {
                      properties: {
                        display: 'flex',
                        gap: '16px',
                      },
                    },
                    children: [
                      createNode({
                        metadata: { name: 'Icon Box' },
                        styles: {
                          properties: {
                            width: '48px',
                            height: '48px',
                            backgroundColor: 'rgba(210,159,102,0.1)',
                            borderRadius: '8px',
                            flexShrink: '0',
                          },
                        },
                      }),
                      createNode({
                        metadata: { name: 'Text' },
                        children: [
                          createNode({
                            elementType: 'text',
                            tagName: 'p',
                            metadata: { name: 'Label' },
                            content: item.label,
                            styles: {
                              properties: {
                                color: colors.black,
                                fontSize: '16px',
                                fontFamily: 'Muller, sans-serif',
                                fontWeight: '700',
                                marginBottom: '4px',
                              },
                            },
                          }),
                          createNode({
                            elementType: 'text',
                            tagName: 'p',
                            metadata: { name: 'Value' },
                            content: item.value,
                            styles: {
                              properties: {
                                color: item.label === 'Телефон' || item.label === 'Email' ? colors.gold : 'rgba(64,62,61,0.7)',
                                fontSize: '14px',
                                fontFamily: 'Muller, sans-serif',
                              },
                            },
                          }),
                        ],
                      }),
                    ],
                  })
                ),
              }),
            ],
          }),
          createNode({
            metadata: { name: 'Contact Form' },
            styles: {
              properties: {
                backgroundColor: colors.grayLight,
                borderRadius: '8px',
                padding: '32px',
              },
            },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'h3',
                metadata: { name: 'Form Title' },
                content: 'Оставить заявку',
                styles: {
                  properties: {
                    color: colors.black,
                    fontSize: '24px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '700',
                    marginBottom: '24px',
                  },
                },
              }),
              createNode({
                tagName: 'form',
                metadata: { name: 'Form' },
                styles: {
                  properties: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  },
                },
                children: [
                  createNode({
                    elementType: 'input',
                    tagName: 'input',
                    metadata: { name: 'Name Input' },
                    attributes: { type: 'text', placeholder: 'Ваше имя' },
                    styles: {
                      properties: {
                        width: '100%',
                        padding: '16px',
                        borderRadius: '4px',
                        border: '1px solid rgba(177,178,178,0.3)',
                        fontSize: '16px',
                        fontFamily: 'Muller, sans-serif',
                      },
                    },
                  }),
                  createNode({
                    elementType: 'input',
                    tagName: 'input',
                    metadata: { name: 'Phone Input' },
                    attributes: { type: 'tel', placeholder: '+998' },
                    styles: {
                      properties: {
                        width: '100%',
                        padding: '16px',
                        borderRadius: '4px',
                        border: '1px solid rgba(177,178,178,0.3)',
                        fontSize: '16px',
                        fontFamily: 'Muller, sans-serif',
                      },
                    },
                  }),
                  createNode({
                    elementType: 'button',
                    tagName: 'button',
                    metadata: { name: 'Submit' },
                    content: 'Отправить заявку',
                    styles: {
                      properties: {
                        width: '100%',
                        backgroundColor: colors.gold,
                        color: colors.white,
                        padding: '16px',
                        borderRadius: '4px',
                        border: 'none',
                        fontSize: '14px',
                        fontFamily: 'Muller, sans-serif',
                        fontWeight: '500',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
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
    ],
  }),
}

// =====================
// БЛОК 9: FOOTER
// =====================
const footerBlock = {
  name: 'GH - Footer',
  type: 'static',
  isReusable: true,
  tags: ['footer', 'golden-house'],
  structure: createNode({
    tagName: 'footer',
    metadata: { name: 'Footer' },
    styles: {
      properties: {
        backgroundColor: colors.black,
        padding: '64px 40px 24px',
      },
    },
    children: [
      createNode({
        metadata: { name: 'Footer Container' },
        layoutMode: 'grid',
        styles: {
          properties: {
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '48px',
            maxWidth: '1200px',
            margin: '0 auto',
          },
        },
        children: [
          createNode({
            metadata: { name: 'Footer Logo Column' },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'div',
                metadata: { name: 'Logo' },
                content: 'GOLDEN HOUSE',
                styles: {
                  properties: {
                    color: colors.gold,
                    fontSize: '24px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '700',
                    letterSpacing: '2px',
                    marginBottom: '16px',
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'p',
                metadata: { name: 'Description' },
                content: 'Национальный лидер и первопроходец рынка новостроек Узбекистана',
                styles: {
                  properties: {
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '14px',
                    fontFamily: 'Muller, sans-serif',
                    lineHeight: '1.6',
                  },
                },
              }),
            ],
          }),
          createNode({
            metadata: { name: 'Footer Projects' },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'h4',
                metadata: { name: 'Title' },
                content: 'Жилые комплексы',
                styles: {
                  properties: {
                    color: colors.white,
                    fontSize: '18px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '700',
                    marginBottom: '16px',
                  },
                },
              }),
              createNode({
                metadata: { name: 'Projects List' },
                styles: {
                  properties: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  },
                },
                children: ['INFINITY', "O'Z Zamin", "O'Z Mahal", 'Assalom Sohil'].map(name =>
                  createNode({
                    elementType: 'link',
                    tagName: 'a',
                    metadata: { name: name },
                    content: name,
                    attributes: { href: '#' },
                    styles: {
                      properties: {
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '14px',
                        fontFamily: 'Muller, sans-serif',
                        textDecoration: 'none',
                      },
                    },
                  })
                ),
              }),
            ],
          }),
          createNode({
            metadata: { name: 'Footer Nav' },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'h4',
                metadata: { name: 'Title' },
                content: 'Навигация',
                styles: {
                  properties: {
                    color: colors.white,
                    fontSize: '18px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '700',
                    marginBottom: '16px',
                  },
                },
              }),
              createNode({
                metadata: { name: 'Nav List' },
                styles: {
                  properties: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  },
                },
                children: ['Квартиры', 'О компании', 'Новости', 'Контакты'].map(name =>
                  createNode({
                    elementType: 'link',
                    tagName: 'a',
                    metadata: { name: name },
                    content: name,
                    attributes: { href: '#' },
                    styles: {
                      properties: {
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '14px',
                        fontFamily: 'Muller, sans-serif',
                        textDecoration: 'none',
                      },
                    },
                  })
                ),
              }),
            ],
          }),
          createNode({
            metadata: { name: 'Footer Contact' },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'h4',
                metadata: { name: 'Title' },
                content: 'Контакты',
                styles: {
                  properties: {
                    color: colors.white,
                    fontSize: '18px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '700',
                    marginBottom: '16px',
                  },
                },
              }),
              createNode({
                elementType: 'link',
                tagName: 'a',
                metadata: { name: 'Phone' },
                content: '+998 78 150-11-11',
                attributes: { href: 'tel:+998781501111' },
                styles: {
                  properties: {
                    display: 'block',
                    color: colors.gold,
                    fontSize: '16px',
                    fontFamily: 'Muller, sans-serif',
                    fontWeight: '500',
                    marginBottom: '8px',
                    textDecoration: 'none',
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'p',
                metadata: { name: 'Address' },
                content: 'Яшнабадский район, бизнес-центр «Infinity»',
                styles: {
                  properties: {
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '14px',
                    fontFamily: 'Muller, sans-serif',
                    lineHeight: '1.6',
                  },
                },
              }),
            ],
          }),
        ],
      }),
      createNode({
        metadata: { name: 'Footer Copyright' },
        styles: {
          properties: {
            borderTop: '1px solid rgba(255,255,255,0.1)',
            marginTop: '48px',
            paddingTop: '24px',
            textAlign: 'center',
          },
        },
        children: [
          createNode({
            elementType: 'text',
            tagName: 'p',
            metadata: { name: 'Copyright' },
            content: '© 2024 ООО «Golden House Development». Все права защищены.',
            styles: {
              properties: {
                color: 'rgba(255,255,255,0.4)',
                fontSize: '14px',
                fontFamily: 'Muller, sans-serif',
              },
            },
          }),
        ],
      }),
    ],
  }),
}

// =====================
// API
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

async function main() {
  console.log('🏗️  Создание блоков Golden House...\n')

  try {
    const blocks = [
      headerBlock,
      heroBlock,
      statsBlock,
      aboutBlock,
      projectsBlock,
      advantagesBlock,
      ctaBlock,
      contactBlock,
      footerBlock,
    ]

    for (const block of blocks) {
      const created = await createBlockApi(block)
      console.log(`✅ Блок создан: ${created.name} (ID: ${created.id})`)
    }

    console.log('\n🎉 Готово! Откройте редактор чтобы увидеть созданные блоки.')
    console.log('   URL: http://localhost:3001/blocks')

  } catch (error) {
    console.error('❌ Ошибка:', error.message)
    console.log('\n💡 Убедитесь, что backend запущен: npm run dev (в папке backend)')
  }
}

main()
