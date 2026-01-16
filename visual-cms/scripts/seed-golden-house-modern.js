/**
 * Скрипт для создания современной страницы Golden House в CMS
 * Дизайн в стиле ПИК/Самолёт
 * Запуск: node scripts/seed-golden-house-modern.js
 */

const API_URL = 'http://localhost:5000/api'

// Генератор ID
let idCounter = 0
const generateId = () => `gh-modern-${Date.now()}-${++idCounter}`

// Фирменные цвета
const colors = {
  gold: '#D29F66',
  goldLight: '#E8D4BC',
  goldDark: '#B8864D',
  black: '#403E3D',
  white: '#FFFFFF',
  gray: '#B1B2B2',
  grayLight: '#F5F5F7',
  grayDark: '#6B6B6B',
}

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

// ============ HEADER ============
const createHeader = () => createNode({
  tagName: 'header',
  metadata: { name: 'Header' },
  styles: {
    properties: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '72px',
      padding: '0 48px',
      backgroundColor: colors.white,
      borderBottom: `1px solid ${colors.grayLight}`,
      position: 'sticky',
      top: '0',
      zIndex: '1000',
    },
  },
  children: [
    // Logo
    createNode({
      elementType: 'link',
      tagName: 'a',
      metadata: { name: 'Logo' },
      content: 'GOLDEN HOUSE',
      attributes: { href: '/' },
      styles: {
        properties: {
          fontSize: '24px',
          fontWeight: '700',
          color: colors.gold,
          textDecoration: 'none',
          letterSpacing: '1px',
        },
      },
    }),
    // Navigation
    createNode({
      tagName: 'nav',
      metadata: { name: 'Navigation' },
      styles: {
        properties: {
          display: 'flex',
          gap: '32px',
        },
      },
      children: ['Квартиры', 'Коммерция', 'Ипотека', 'О компании', 'Контакты'].map(text =>
        createNode({
          elementType: 'link',
          tagName: 'a',
          metadata: { name: `Nav ${text}` },
          content: text,
          attributes: { href: '#' },
          styles: {
            properties: {
              color: colors.black,
              textDecoration: 'none',
              fontSize: '15px',
              fontWeight: '500',
            },
          },
        })
      ),
    }),
    // Right side
    createNode({
      metadata: { name: 'Header Actions' },
      styles: {
        properties: {
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
        },
      },
      children: [
        createNode({
          elementType: 'link',
          tagName: 'a',
          metadata: { name: 'Phone' },
          content: '+998 78 150-11-11',
          attributes: { href: 'tel:+998781501111' },
          styles: {
            properties: {
              color: colors.black,
              textDecoration: 'none',
              fontWeight: '500',
              fontSize: '15px',
            },
          },
        }),
        createNode({
          elementType: 'button',
          tagName: 'button',
          metadata: { name: 'CTA Button' },
          content: 'Заказать звонок',
          styles: {
            properties: {
              backgroundColor: colors.gold,
              color: colors.white,
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            },
          },
        }),
      ],
    }),
  ],
})

// ============ HERO PROMO SECTION ============
const createHeroPromo = () => createNode({
  tagName: 'section',
  metadata: { name: 'Hero Promo Section' },
  styles: {
    properties: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '24px',
      padding: '24px 48px',
      maxWidth: '1440px',
      margin: '0 auto',
    },
  },
  layoutMode: 'grid',
  children: [
    // Main Promo Card
    createNode({
      metadata: { name: 'Main Promo Card' },
      styles: {
        properties: {
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: colors.gold,
          borderRadius: '24px',
          padding: '40px',
          minHeight: '400px',
          position: 'relative',
        },
      },
      children: [
        // Badge
        createNode({
          elementType: 'text',
          tagName: 'span',
          metadata: { name: 'Badge' },
          content: '🔥 Акция',
          styles: {
            properties: {
              display: 'inline-block',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: colors.white,
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '24px',
              width: 'fit-content',
            },
          },
        }),
        // Title
        createNode({
          elementType: 'text',
          tagName: 'h2',
          metadata: { name: 'Promo Title' },
          content: '– 15% на квартиры к Новому году!',
          styles: {
            properties: {
              color: colors.white,
              fontSize: '42px',
              fontWeight: '700',
              lineHeight: '1.1',
              marginBottom: '16px',
            },
          },
        }),
        // Subtitle
        createNode({
          elementType: 'text',
          tagName: 'p',
          metadata: { name: 'Promo Subtitle' },
          content: 'Исполните мечту о переезде в новом году',
          styles: {
            properties: {
              color: 'rgba(255,255,255,0.85)',
              fontSize: '16px',
              marginBottom: '24px',
            },
          },
        }),
        // Counter
        createNode({
          metadata: { name: 'Counter' },
          styles: {
            properties: {
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginBottom: '32px',
            },
          },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'span',
              metadata: { name: 'Counter Label' },
              content: 'Осталось квартир:',
              styles: {
                properties: {
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '14px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'span',
              metadata: { name: 'Counter Value' },
              content: '🔥 847',
              styles: {
                properties: {
                  color: colors.white,
                  fontSize: '48px',
                  fontWeight: '700',
                },
              },
            }),
          ],
        }),
        // CTA Button
        createNode({
          elementType: 'button',
          tagName: 'button',
          metadata: { name: 'Promo CTA' },
          content: 'Выбрать квартиру',
          styles: {
            properties: {
              backgroundColor: colors.white,
              color: colors.gold,
              border: 'none',
              padding: '16px 32px',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              width: 'fit-content',
            },
          },
        }),
      ],
    }),
    // Slider Card
    createNode({
      metadata: { name: 'Slider Card' },
      styles: {
        properties: {
          borderRadius: '24px',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '400px',
          backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6)), url(https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          padding: '40px',
        },
      },
      children: [
        createNode({
          elementType: 'text',
          tagName: 'h2',
          metadata: { name: 'Slider Title' },
          content: 'Готовые квартиры с выгодой до $50 000',
          styles: {
            properties: {
              color: colors.white,
              fontSize: '36px',
              fontWeight: '700',
              lineHeight: '1.2',
              marginBottom: '12px',
            },
          },
        }),
        createNode({
          elementType: 'text',
          tagName: 'p',
          metadata: { name: 'Slider Subtitle' },
          content: 'Только до 31 января!',
          styles: {
            properties: {
              color: 'rgba(255,255,255,0.8)',
              fontSize: '16px',
              marginBottom: 'auto',
            },
          },
        }),
        createNode({
          elementType: 'button',
          tagName: 'button',
          metadata: { name: 'Slider CTA' },
          content: 'Подробнее',
          styles: {
            properties: {
              backgroundColor: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              color: colors.white,
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '14px 28px',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer',
              width: 'fit-content',
            },
          },
        }),
      ],
    }),
  ],
})

// ============ SMALL PROMO CARDS ============
const createSmallPromoCards = () => createNode({
  tagName: 'section',
  metadata: { name: 'Small Promo Section' },
  styles: {
    properties: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '24px',
      padding: '0 48px 24px',
      maxWidth: '1440px',
      margin: '0 auto',
    },
  },
  layoutMode: 'grid',
  children: [
    // Card 1
    createNode({
      metadata: { name: 'Promo Card 1' },
      styles: {
        properties: {
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: colors.white,
          borderRadius: '20px',
          padding: '28px',
          border: `1px solid ${colors.grayLight}`,
          minHeight: '280px',
        },
      },
      children: [
        createNode({
          elementType: 'text',
          tagName: 'h3',
          metadata: { name: 'Card Title' },
          content: 'Акции и спецпредложения',
          styles: {
            properties: {
              fontSize: '22px',
              fontWeight: '600',
              color: colors.black,
              lineHeight: '1.3',
              marginBottom: '12px',
            },
          },
        }),
        createNode({
          elementType: 'text',
          tagName: 'p',
          metadata: { name: 'Card Text' },
          content: 'Ваши выгодные возможности: недвижимость, скидки, бонусы',
          styles: {
            properties: {
              fontSize: '14px',
              color: colors.grayDark,
            },
          },
        }),
      ],
    }),
    // Card 2
    createNode({
      metadata: { name: 'Promo Card 2' },
      styles: {
        properties: {
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: colors.white,
          borderRadius: '20px',
          padding: '28px',
          border: `1px solid ${colors.grayLight}`,
          minHeight: '280px',
        },
      },
      children: [
        createNode({
          elementType: 'text',
          tagName: 'h3',
          metadata: { name: 'Card Title' },
          content: 'Повышение цен с 19 января',
          styles: {
            properties: {
              fontSize: '22px',
              fontWeight: '600',
              color: colors.black,
              lineHeight: '1.3',
              marginBottom: '12px',
            },
          },
        }),
        createNode({
          elementType: 'text',
          tagName: 'p',
          metadata: { name: 'Card Text' },
          content: 'Бронируйте квартиру на выгодных условиях',
          styles: {
            properties: {
              fontSize: '14px',
              color: colors.grayDark,
            },
          },
        }),
      ],
    }),
    // Quarters Card (spans 2 columns)
    createNode({
      metadata: { name: 'Quarters Card' },
      styles: {
        properties: {
          gridColumn: 'span 2',
          display: 'flex',
          flexDirection: 'row',
          gap: '24px',
          backgroundColor: colors.goldLight,
          borderRadius: '20px',
          padding: '28px',
        },
      },
      children: [
        createNode({
          elementType: 'image',
          tagName: 'img',
          metadata: { name: 'Quarters Image' },
          attributes: {
            src: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=300',
            alt: 'Кварталы',
          },
          styles: {
            properties: {
              width: '200px',
              height: '200px',
              objectFit: 'cover',
              borderRadius: '16px',
            },
          },
        }),
        createNode({
          metadata: { name: 'Quarters Content' },
          styles: {
            properties: {
              display: 'flex',
              flexDirection: 'column',
              flex: '1',
            },
          },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'h3',
              metadata: { name: 'Quarters Title' },
              content: 'Кварталы для жизни',
              styles: {
                properties: {
                  fontSize: '28px',
                  fontWeight: '700',
                  color: colors.black,
                  marginBottom: '12px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              metadata: { name: 'Quarters Text' },
              content: '13 лет создаем комфортную инфраструктуру',
              styles: {
                properties: {
                  fontSize: '15px',
                  color: colors.grayDark,
                  marginBottom: '24px',
                },
              },
            }),
            createNode({
              elementType: 'button',
              tagName: 'button',
              metadata: { name: 'Quarters CTA' },
              content: 'Узнать подробнее',
              styles: {
                properties: {
                  backgroundColor: colors.gold,
                  color: colors.white,
                  border: 'none',
                  padding: '14px 28px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  width: 'fit-content',
                },
              },
            }),
          ],
        }),
      ],
    }),
  ],
})

// ============ CATALOG SECTION ============
const createCatalogSection = () => createNode({
  tagName: 'section',
  metadata: { name: 'Catalog Section' },
  styles: {
    properties: {
      padding: '64px 48px',
      maxWidth: '1440px',
      margin: '0 auto',
    },
  },
  children: [
    // Filters
    createNode({
      metadata: { name: 'Filters Row' },
      styles: {
        properties: {
          display: 'flex',
          gap: '12px',
          marginBottom: '32px',
          flexWrap: 'wrap',
        },
      },
      children: ['Все', 'С ключами', 'Со скидкой', 'Бизнес-класс', 'Премиум'].map((filter, i) =>
        createNode({
          elementType: 'button',
          tagName: 'button',
          metadata: { name: `Filter ${filter}` },
          content: filter,
          styles: {
            properties: {
              padding: '10px 20px',
              border: i === 0 ? `2px solid ${colors.gold}` : `2px solid ${colors.grayLight}`,
              borderRadius: '24px',
              backgroundColor: i === 0 ? colors.gold : colors.white,
              color: i === 0 ? colors.white : colors.black,
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            },
          },
        })
      ),
    }),
    // Projects Grid
    createNode({
      metadata: { name: 'Projects Grid' },
      styles: {
        properties: {
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '24px',
        },
      },
      layoutMode: 'grid',
      children: [
        { name: 'Golden Residence', location: 'Юнусабад', price: 'от $85 000', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600', badge: 'Новый проект' },
        { name: 'Golden Park', location: 'Мирзо Улугбек', price: 'от $72 000', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600', badge: 'Бизнес-класс' },
        { name: 'Golden Plaza', location: 'Чиланзар', price: 'от $65 000', image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600', badge: 'Скидка 10%' },
        { name: 'Golden Tower', location: 'Сергели', price: 'от $58 000', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600' },
      ].map(project =>
        createNode({
          tagName: 'article',
          metadata: { name: `Project ${project.name}` },
          styles: {
            properties: {
              borderRadius: '20px',
              overflow: 'hidden',
              backgroundColor: colors.white,
              border: `1px solid ${colors.grayLight}`,
            },
          },
          children: [
            // Image container
            createNode({
              metadata: { name: 'Project Image Container' },
              styles: {
                properties: {
                  position: 'relative',
                  height: '280px',
                  overflow: 'hidden',
                },
              },
              children: [
                createNode({
                  elementType: 'image',
                  tagName: 'img',
                  metadata: { name: 'Project Image' },
                  attributes: { src: project.image, alt: project.name },
                  styles: {
                    properties: {
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    },
                  },
                }),
                ...(project.badge ? [createNode({
                  elementType: 'text',
                  tagName: 'span',
                  metadata: { name: 'Project Badge' },
                  content: project.badge,
                  styles: {
                    properties: {
                      position: 'absolute',
                      top: '16px',
                      left: '16px',
                      backgroundColor: project.badge.includes('Скидка') ? '#E53935' : colors.gold,
                      color: colors.white,
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                    },
                  },
                })] : []),
              ],
            }),
            // Info
            createNode({
              metadata: { name: 'Project Info' },
              styles: {
                properties: {
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                },
              },
              children: [
                createNode({
                  elementType: 'text',
                  tagName: 'h3',
                  metadata: { name: 'Project Name' },
                  content: project.name,
                  styles: {
                    properties: {
                      fontSize: '22px',
                      fontWeight: '600',
                      color: colors.black,
                    },
                  },
                }),
                createNode({
                  elementType: 'text',
                  tagName: 'p',
                  metadata: { name: 'Project Location' },
                  content: `📍 ${project.location}`,
                  styles: {
                    properties: {
                      fontSize: '14px',
                      color: colors.grayDark,
                    },
                  },
                }),
                createNode({
                  elementType: 'text',
                  tagName: 'p',
                  metadata: { name: 'Project Price' },
                  content: project.price,
                  styles: {
                    properties: {
                      fontSize: '20px',
                      fontWeight: '600',
                      color: colors.black,
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
})

// ============ NEWS SECTION ============
const createNewsSection = () => createNode({
  tagName: 'section',
  metadata: { name: 'News Section' },
  styles: {
    properties: {
      padding: '64px 48px',
      maxWidth: '1440px',
      margin: '0 auto',
    },
  },
  children: [
    // Title
    createNode({
      elementType: 'text',
      tagName: 'h2',
      metadata: { name: 'News Title' },
      content: 'Новости',
      styles: {
        properties: {
          fontSize: '36px',
          fontWeight: '700',
          color: colors.black,
          marginBottom: '40px',
        },
      },
    }),
    // News Grid
    createNode({
      metadata: { name: 'News Grid' },
      styles: {
        properties: {
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '24px',
        },
      },
      layoutMode: 'grid',
      children: [
        // Featured
        createNode({
          metadata: { name: 'Featured News' },
          styles: {
            properties: {
              backgroundColor: colors.gold,
              borderRadius: '24px',
              padding: '40px',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '320px',
            },
          },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'h3',
              metadata: { name: 'Featured Title' },
              content: 'Golden House открывает новый жилой комплекс в Юнусабаде',
              styles: {
                properties: {
                  fontSize: '28px',
                  fontWeight: '700',
                  color: colors.white,
                  lineHeight: '1.3',
                  marginBottom: '16px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              metadata: { name: 'Featured Text' },
              content: 'Старт продаж нового проекта Golden Residence запланирован на февраль 2026 года.',
              styles: {
                properties: {
                  fontSize: '16px',
                  color: 'rgba(255,255,255,0.8)',
                  marginBottom: 'auto',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'span',
              metadata: { name: 'Featured Date' },
              content: '13 января 2026',
              styles: {
                properties: {
                  color: colors.goldLight,
                  fontSize: '14px',
                },
              },
            }),
          ],
        }),
        // Sidebar
        createNode({
          metadata: { name: 'News Sidebar' },
          styles: {
            properties: {
              backgroundColor: colors.grayLight,
              borderRadius: '24px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
            },
          },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'h3',
              metadata: { name: 'Sidebar Title' },
              content: 'Новости компании',
              styles: {
                properties: {
                  fontSize: '22px',
                  fontWeight: '600',
                  color: colors.black,
                  marginBottom: '12px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              metadata: { name: 'Sidebar Text' },
              content: 'Главные события Golden House – читайте и будьте в курсе',
              styles: {
                properties: {
                  fontSize: '14px',
                  color: colors.grayDark,
                  marginBottom: '24px',
                },
              },
            }),
            createNode({
              elementType: 'button',
              tagName: 'button',
              metadata: { name: 'All News Button' },
              content: 'Все новости',
              styles: {
                properties: {
                  backgroundColor: colors.black,
                  color: colors.white,
                  border: 'none',
                  padding: '14px 28px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  width: 'fit-content',
                },
              },
            }),
          ],
        }),
      ],
    }),
  ],
})

// ============ FOOTER ============
const createFooter = () => createNode({
  tagName: 'footer',
  metadata: { name: 'Footer' },
  styles: {
    properties: {
      backgroundColor: colors.black,
      padding: '64px 48px 32px',
    },
  },
  children: [
    createNode({
      metadata: { name: 'Footer Content' },
      styles: {
        properties: {
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '48px',
          maxWidth: '1440px',
          margin: '0 auto',
        },
      },
      layoutMode: 'grid',
      children: [
        // Logo column
        createNode({
          metadata: { name: 'Footer Logo Column' },
          styles: {
            properties: {
              display: 'flex',
              flexDirection: 'column',
            },
          },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'div',
              metadata: { name: 'Footer Logo' },
              content: 'GOLDEN HOUSE',
              styles: {
                properties: {
                  fontSize: '24px',
                  fontWeight: '700',
                  color: colors.gold,
                  marginBottom: '24px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              metadata: { name: 'Footer Description' },
              content: 'Строим качественное жильё с 2012 года. Более 500 000 м² сданной недвижимости.',
              styles: {
                properties: {
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  marginBottom: '16px',
                },
              },
            }),
            createNode({
              elementType: 'link',
              tagName: 'a',
              metadata: { name: 'Footer Phone' },
              content: '+998 78 150-11-11',
              attributes: { href: 'tel:+998781501111' },
              styles: {
                properties: {
                  color: colors.white,
                  fontSize: '20px',
                  fontWeight: '600',
                  textDecoration: 'none',
                },
              },
            }),
          ],
        }),
        // Navigation columns
        ...['Покупателям', 'Компания', 'Документы'].map((title, colIndex) =>
          createNode({
            metadata: { name: `Footer Column ${title}` },
            styles: {
              properties: {
                display: 'flex',
                flexDirection: 'column',
              },
            },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'h4',
                metadata: { name: `Footer Title ${title}` },
                content: title,
                styles: {
                  properties: {
                    color: colors.white,
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '20px',
                  },
                },
              }),
              ...([
                ['Квартиры', 'Коммерция', 'Ипотека', 'Акции'],
                ['О нас', 'Проекты', 'Новости', 'Контакты'],
                ['Политика', 'Оферта', 'Реквизиты'],
              ][colIndex] || []).map(link =>
                createNode({
                  elementType: 'link',
                  tagName: 'a',
                  metadata: { name: `Footer Link ${link}` },
                  content: link,
                  attributes: { href: '#' },
                  styles: {
                    properties: {
                      color: 'rgba(255,255,255,0.7)',
                      textDecoration: 'none',
                      fontSize: '14px',
                      marginBottom: '12px',
                    },
                  },
                })
              ),
            ],
          })
        ),
      ],
    }),
    // Copyright
    createNode({
      metadata: { name: 'Footer Copyright' },
      styles: {
        properties: {
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '24px',
          marginTop: '48px',
          maxWidth: '1440px',
          margin: '48px auto 0',
        },
      },
      children: [
        createNode({
          elementType: 'text',
          tagName: 'p',
          metadata: { name: 'Copyright Text' },
          content: '© 2026 Golden House. Все права защищены.',
          styles: {
            properties: {
              color: 'rgba(255,255,255,0.5)',
              fontSize: '13px',
            },
          },
        }),
      ],
    }),
  ],
})

// ============ ПОЛНАЯ СТРУКТУРА СТРАНИЦЫ ============
const pageStructure = createNode({
  tagName: 'div',
  metadata: { name: 'Golden House Modern' },
  styles: {
    properties: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      fontFamily: "'Muller', -apple-system, BlinkMacSystemFont, sans-serif",
      backgroundColor: colors.grayLight,
    },
  },
  children: [
    createHeader(),
    createNode({
      tagName: 'main',
      metadata: { name: 'Main Content' },
      styles: {
        properties: {
          display: 'flex',
          flexDirection: 'column',
        },
      },
      children: [
        createHeroPromo(),
        createSmallPromoCards(),
        createCatalogSection(),
        createNewsSection(),
      ],
    }),
    createFooter(),
  ],
})

// ============ API ============
async function createPage() {
  try {
    console.log('🚀 Создание современной страницы Golden House...\n')

    const pageData = {
      name: 'Golden House Modern',
      slug: 'golden-house-modern',
      structure: pageStructure,
      status: 'published',
      metadata: {
        title: 'Golden House — Элитная недвижимость в Узбекистане',
        description: 'Квартиры и коммерческая недвижимость от застройщика Golden House. Акции, ипотека, выгодные условия.',
        keywords: ['недвижимость', 'квартиры', 'Golden House', 'застройщик', 'Ташкент'],
      },
    }

    const response = await fetch(`${API_URL}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pageData),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error)
    }

    const page = await response.json()
    console.log('✅ Страница создана!')
    console.log(`📄 ID: ${page.id}`)
    console.log(`🔗 Slug: ${page.slug}`)
    console.log(`\n🌐 Откройте в редакторе: http://localhost:3000/editor/page/${page.id}`)
    console.log(`👀 Превью React: http://localhost:3000/golden-house-modern`)

  } catch (error) {
    console.error('❌ Ошибка:', error.message)
  }
}

createPage()
