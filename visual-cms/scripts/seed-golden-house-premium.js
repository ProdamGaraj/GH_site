/**
 * Скрипт для создания премиальной страницы Golden House в CMS
 * Сдержанный, элегантный дизайн (Capital Group, MR Group style)
 * Запуск: node scripts/seed-golden-house-premium.js
 */

const API_URL = 'http://localhost:5000/api'

// Генератор ID
let idCounter = 0
const generateId = () => `gh-premium-${Date.now()}-${++idCounter}`

// Цвета
const colors = {
  gold: '#D29F66',
  goldMuted: '#C4A77D',
  black: '#1A1A1A',
  charcoal: '#2D2D2D',
  white: '#FFFFFF',
  cream: '#FAFAF8',
  gray: '#8A8A8A',
  grayLight: '#E8E8E8',
  grayDark: '#4A4A4A',
}

// Утилита для создания узла
const createNode = (overrides) => ({
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

// ============ HEADER ============
const createHeader = () => createNode({
  tagName: 'header',
  metadata: { name: 'Header' },
  styles: {
    properties: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '80px',
      padding: '0 80px',
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
    },
  },
  children: [
    // Logo
    createNode({
      elementType: 'text',
      tagName: 'span',
      metadata: { name: 'Logo' },
      content: 'Golden House',
      styles: {
        properties: {
          fontSize: '18px',
          fontWeight: '600',
          color: colors.black,
          letterSpacing: '3px',
          textTransform: 'uppercase',
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
          gap: '48px',
        },
      },
      children: ['Проекты', 'О компании', 'Покупателям', 'Коммерция', 'Контакты'].map(text =>
        createNode({
          elementType: 'text',
          tagName: 'span',
          metadata: { name: `Nav ${text}` },
          content: text,
          styles: {
            properties: {
              color: colors.grayDark,
              fontSize: '14px',
              fontWeight: '400',
              letterSpacing: '0.5px',
              cursor: 'pointer',
            },
          },
        })
      ),
    }),
    // Phone
    createNode({
      elementType: 'text',
      tagName: 'span',
      metadata: { name: 'Phone' },
      content: '+998 78 150 11 11',
      styles: {
        properties: {
          color: colors.black,
          fontSize: '14px',
          fontWeight: '500',
          letterSpacing: '1px',
        },
      },
    }),
  ],
})

// ============ HERO SECTION ============
const createHero = () => createNode({
  tagName: 'section',
  metadata: { name: 'Hero Section' },
  styles: {
    properties: {
      height: '100vh',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: 'url(https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1920)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    },
  },
  children: [
    // Overlay
    createNode({
      metadata: { name: 'Hero Overlay' },
      styles: {
        properties: {
          position: 'absolute',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
        },
      },
    }),
    // Content
    createNode({
      metadata: { name: 'Hero Content' },
      styles: {
        properties: {
          position: 'relative',
          zIndex: '1',
          textAlign: 'center',
          maxWidth: '800px',
          padding: '0 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        },
      },
      children: [
        createNode({
          elementType: 'text',
          tagName: 'p',
          metadata: { name: 'Hero Subtitle' },
          content: 'Девелопер премиальной недвижимости',
          styles: {
            properties: {
              color: colors.gold,
              fontSize: '13px',
              letterSpacing: '4px',
              textTransform: 'uppercase',
              marginBottom: '24px',
              fontWeight: '500',
            },
          },
        }),
        createNode({
          elementType: 'text',
          tagName: 'h1',
          metadata: { name: 'Hero Title' },
          content: 'Создаём пространства для жизни',
          styles: {
            properties: {
              color: colors.white,
              fontSize: '56px',
              fontWeight: '300',
              lineHeight: '1.2',
              marginBottom: '32px',
              letterSpacing: '-1px',
            },
          },
        }),
        createNode({
          elementType: 'text',
          tagName: 'p',
          metadata: { name: 'Hero Description' },
          content: '13 лет мы строим дома, в которых хочется жить. Архитектура, продуманная до мелочей.',
          styles: {
            properties: {
              color: 'rgba(255,255,255,0.8)',
              fontSize: '18px',
              fontWeight: '300',
              lineHeight: '1.7',
              marginBottom: '48px',
            },
          },
        }),
        createNode({
          elementType: 'button',
          tagName: 'button',
          metadata: { name: 'Hero CTA' },
          content: 'Смотреть проекты',
          styles: {
            properties: {
              color: colors.white,
              fontSize: '14px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              padding: '16px 48px',
              border: '1px solid rgba(255,255,255,0.4)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            },
          },
        }),
      ],
    }),
  ],
})

// ============ ABOUT SECTION ============
const createAbout = () => createNode({
  tagName: 'section',
  metadata: { name: 'About Section' },
  styles: {
    properties: {
      padding: '160px 80px',
      backgroundColor: colors.cream,
    },
  },
  children: [
    createNode({
      metadata: { name: 'About Container' },
      styles: {
        properties: {
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '120px',
          alignItems: 'center',
        },
      },
      children: [
        // Text column
        createNode({
          metadata: { name: 'About Text' },
          styles: { properties: { display: 'flex', flexDirection: 'column' } },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'p',
              metadata: { name: 'About Label' },
              content: 'О компании',
              styles: {
                properties: {
                  color: colors.gold,
                  fontSize: '12px',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  marginBottom: '24px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'h2',
              metadata: { name: 'About Title' },
              content: 'Мы верим, что дом — это больше, чем стены',
              styles: {
                properties: {
                  fontSize: '42px',
                  fontWeight: '300',
                  color: colors.black,
                  lineHeight: '1.3',
                  marginBottom: '32px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              metadata: { name: 'About Text 1' },
              content: 'Golden House — это команда архитекторов, инженеров и дизайнеров, объединённых общей целью: создавать жилые пространства, которые вдохновляют.',
              styles: {
                properties: {
                  fontSize: '16px',
                  color: colors.grayDark,
                  lineHeight: '1.8',
                  marginBottom: '24px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              metadata: { name: 'About Text 2' },
              content: 'Каждый наш проект — это результат глубокого анализа потребностей современного человека.',
              styles: {
                properties: {
                  fontSize: '16px',
                  color: colors.grayDark,
                  lineHeight: '1.8',
                },
              },
            }),
          ],
        }),
        // Stats column
        createNode({
          metadata: { name: 'Stats Grid' },
          styles: {
            properties: {
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '48px',
            },
          },
          children: [
            { value: '13', label: 'лет на рынке' },
            { value: '500K', label: 'м² построено' },
            { value: '12', label: 'проектов сдано' },
            { value: '8 000', label: 'семей' },
          ].map(stat => createNode({
            metadata: { name: `Stat ${stat.value}` },
            styles: {
              properties: {
                padding: '32px 0',
                borderTop: `1px solid ${colors.grayLight}`,
                display: 'flex',
                flexDirection: 'column',
              },
            },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'span',
                metadata: { name: 'Stat Value' },
                content: stat.value,
                styles: {
                  properties: {
                    fontSize: '48px',
                    fontWeight: '300',
                    color: colors.black,
                    marginBottom: '8px',
                    letterSpacing: '-2px',
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'span',
                metadata: { name: 'Stat Label' },
                content: stat.label,
                styles: {
                  properties: {
                    fontSize: '14px',
                    color: colors.gray,
                  },
                },
              }),
            ],
          })),
        }),
      ],
    }),
  ],
})

// ============ PROJECTS SECTION ============
const createProjects = () => createNode({
  tagName: 'section',
  metadata: { name: 'Projects Section' },
  styles: {
    properties: {
      padding: '100px 80px',
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
    // Header
    createNode({
      metadata: { name: 'Projects Header' },
      styles: {
        properties: {
          marginBottom: '48px',
          display: 'flex',
          flexDirection: 'column',
        },
      },
      children: [
        createNode({
          elementType: 'text',
          tagName: 'p',
          metadata: { name: 'Projects Label' },
          content: 'Каталог',
          styles: {
            properties: {
              color: colors.gold,
              fontSize: '12px',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              marginBottom: '16px',
            },
          },
        }),
        createNode({
          elementType: 'text',
          tagName: 'h2',
          metadata: { name: 'Projects Title' },
          content: 'Наши жилые комплексы',
          styles: {
            properties: {
              fontSize: '36px',
              fontWeight: '300',
              color: colors.black,
              letterSpacing: '-1px',
            },
          },
        }),
      ],
    }),
    // Filter Header (Location, Price, Year)
    createNode({
      metadata: { name: 'Filter Header' },
      styles: {
        properties: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '32px',
          gap: '32px',
          flexWrap: 'wrap',
        },
      },
      children: [
        // Location filter
        createNode({
          metadata: { name: 'Location Filter' },
          styles: { properties: {} },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'label',
              content: 'Выберите локацию',
              metadata: { name: 'Location Label' },
              styles: {
                properties: {
                  fontSize: '13px',
                  color: colors.gray,
                  marginBottom: '8px',
                  display: 'block',
                },
              },
            }),
            createNode({
              elementType: 'select',
              tagName: 'select',
              metadata: { name: 'Location Select' },
              styles: {
                properties: {
                  padding: '14px 48px 14px 16px',
                  border: `1px solid ${colors.grayLight}`,
                  borderRadius: '4px',
                  fontSize: '15px',
                  minWidth: '240px',
                  backgroundColor: colors.white,
                  cursor: 'pointer',
                },
              },
              children: [
                createNode({
                  elementType: 'option',
                  tagName: 'option',
                  content: 'Район, метро',
                  metadata: { name: 'Default Location' },
                  styles: { properties: {} },
                }),
                createNode({
                  elementType: 'option',
                  tagName: 'option',
                  content: 'Юнусабад',
                  metadata: { name: 'Location 1' },
                  styles: { properties: {} },
                }),
                createNode({
                  elementType: 'option',
                  tagName: 'option',
                  content: 'Мирзо Улугбек',
                  metadata: { name: 'Location 2' },
                  styles: { properties: {} },
                }),
                createNode({
                  elementType: 'option',
                  tagName: 'option',
                  content: 'Чиланзар',
                  metadata: { name: 'Location 3' },
                  styles: { properties: {} },
                }),
              ],
            }),
          ],
        }),
        // Price range
        createNode({
          metadata: { name: 'Price Range Filter' },
          styles: {
            properties: {
              flex: '1',
              maxWidth: '300px',
            },
          },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'label',
              content: 'Стоимость, $',
              metadata: { name: 'Price Label' },
              styles: {
                properties: {
                  fontSize: '13px',
                  color: colors.gray,
                  marginBottom: '8px',
                  display: 'block',
                },
              },
            }),
            createNode({
              metadata: { name: 'Price Inputs Container' },
              styles: {
                properties: {
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center',
                },
              },
              children: [
                createNode({
                  elementType: 'input',
                  tagName: 'input',
                  metadata: { name: 'Price From' },
                  attributes: { type: 'text', placeholder: 'от 50 000' },
                  styles: {
                    properties: {
                      padding: '14px 16px',
                      border: `1px solid ${colors.grayLight}`,
                      borderRadius: '4px',
                      fontSize: '15px',
                      width: '120px',
                    },
                  },
                }),
                createNode({
                  elementType: 'text',
                  tagName: 'span',
                  content: '—',
                  metadata: { name: 'Separator' },
                  styles: {
                    properties: {
                      color: colors.gray,
                    },
                  },
                }),
                createNode({
                  elementType: 'input',
                  tagName: 'input',
                  metadata: { name: 'Price To' },
                  attributes: { type: 'text', placeholder: 'до 500 000' },
                  styles: {
                    properties: {
                      padding: '14px 16px',
                      border: `1px solid ${colors.grayLight}`,
                      borderRadius: '4px',
                      fontSize: '15px',
                      width: '120px',
                    },
                  },
                }),
              ],
            }),
          ],
        }),
        // Year filters
        createNode({
          metadata: { name: 'Year Filter' },
          styles: { properties: {} },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'label',
              content: 'Дата сдачи до',
              metadata: { name: 'Year Label' },
              styles: {
                properties: {
                  fontSize: '13px',
                  color: colors.gray,
                  marginBottom: '8px',
                  display: 'block',
                },
              },
            }),
            createNode({
              metadata: { name: 'Year Buttons' },
              styles: {
                properties: {
                  display: 'flex',
                  gap: '8px',
                },
              },
              children: ['2026', '2027', '2028'].map((year, i) =>
                createNode({
                  elementType: 'button',
                  tagName: 'button',
                  content: year,
                  metadata: { name: `Year ${year}` },
                  styles: {
                    properties: {
                      padding: '12px 20px',
                      border: `1px solid ${i === 0 ? colors.gold : colors.grayLight}`,
                      borderRadius: '4px',
                      backgroundColor: i === 0 ? 'rgba(210,159,102,0.1)' : colors.white,
                      color: colors.black,
                      fontSize: '14px',
                      fontWeight: '400',
                      cursor: 'pointer',
                    },
                  },
                })
              ),
            }),
          ],
        }),
      ],
    }),
    // Tag Filters
    createNode({
      metadata: { name: 'Tag Filters' },
      styles: {
        properties: {
          display: 'flex',
          gap: '12px',
          marginBottom: '48px',
          flexWrap: 'wrap',
          alignItems: 'center',
        },
      },
      children: [
        ...['Все', 'С ключами', 'Бизнес-класс', 'Премиум'].map((filter, i) =>
          createNode({
            elementType: 'button',
            tagName: 'button',
            metadata: { name: `Filter ${filter}` },
            content: filter,
            styles: {
              properties: {
                padding: '10px 24px',
                border: `1px solid ${i === 0 ? colors.gold : colors.grayLight}`,
                borderRadius: '4px',
                backgroundColor: i === 0 ? colors.gold : colors.white,
                color: i === 0 ? colors.white : colors.grayDark,
                fontSize: '14px',
                fontWeight: '400',
                cursor: 'pointer',
              },
            },
          })
        ),
        createNode({
          elementType: 'text',
          tagName: 'span',
          content: 'Найдено 12 проектов',
          metadata: { name: 'Results Count' },
          styles: {
            properties: {
              color: colors.gray,
              fontSize: '14px',
              marginLeft: '24px',
            },
          },
        }),
      ],
    }),
    // Projects Grid
    createNode({
      metadata: { name: 'Projects Grid' },
      styles: {
        properties: {
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '32px',
        },
      },
      children: [
        { name: 'Golden Residence', location: 'Юнусабад · до метро 5 мин', price: 'от $85 000', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600', badge: 'Новый проект' },
        { name: 'Golden Park', location: 'Мирзо Улугбек · до метро 10 мин', price: 'от $72 000', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600', badge: 'Бизнес-класс' },
        { name: 'Golden Plaza', location: 'Чиланзар · до метро 3 мин', price: 'от $65 000', image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600', badge: 'Сдан' },
        { name: 'Golden Tower', location: 'Сергели · до метро 15 мин', price: 'от $58 000', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600' },
      ].map(project => createNode({
        metadata: { name: `Project ${project.name}` },
        styles: {
          properties: {
            overflow: 'hidden',
            backgroundColor: colors.white,
            border: `1px solid ${colors.grayLight}`,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
          },
        },
        children: [
          // Image container
          createNode({
            metadata: { name: 'Project Image Container' },
            styles: {
              properties: {
                position: 'relative',
                height: '300px',
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
                metadata: { name: 'Project Badge' },
                styles: {
                  properties: {
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    backgroundColor: colors.gold,
                    color: colors.white,
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '500',
                  },
                },
                children: [
                  createNode({
                    elementType: 'text',
                    tagName: 'span',
                    content: project.badge,
                    styles: { properties: { color: colors.white } },
                  }),
                ],
              })] : []),
            ],
          }),
          // Info
          createNode({
            metadata: { name: 'Project Info' },
            styles: {
              properties: {
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
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
                    fontWeight: '500',
                    color: colors.black,
                    marginBottom: '12px',
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'p',
                metadata: { name: 'Project Location' },
                content: project.location,
                styles: {
                  properties: {
                    fontSize: '14px',
                    color: colors.gray,
                    marginBottom: '20px',
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
                    fontWeight: '500',
                    color: colors.black,
                  },
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

// ============ SERVICES SECTION ============
const createServices = () => createNode({
  tagName: 'section',
  metadata: { name: 'Services Section' },
  styles: {
    properties: {
      padding: '120px 80px',
      backgroundColor: colors.charcoal,
    },
  },
  children: [
    createNode({
      metadata: { name: 'Services Container' },
      styles: {
        properties: {
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        },
      },
      children: [
        createNode({
          elementType: 'text',
          tagName: 'p',
          metadata: { name: 'Services Label' },
          content: 'Покупателям',
          styles: {
            properties: {
              color: colors.gold,
              fontSize: '12px',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              marginBottom: '24px',
              textAlign: 'center',
            },
          },
        }),
        createNode({
          elementType: 'text',
          tagName: 'h2',
          metadata: { name: 'Services Title' },
          content: 'Удобные способы приобретения',
          styles: {
            properties: {
              fontSize: '36px',
              fontWeight: '300',
              color: colors.white,
              textAlign: 'center',
              marginBottom: '80px',
            },
          },
        }),
        createNode({
          metadata: { name: 'Services Grid' },
          styles: {
            properties: {
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '48px',
              width: '100%',
            },
          },
          children: [
            { title: 'Ипотека', desc: 'Помогаем подобрать оптимальную программу кредитования от ведущих банков' },
            { title: 'Trade-in', desc: 'Обменяйте вашу квартиру на новую с доплатой или без' },
            { title: 'Рассрочка', desc: 'Гибкие условия оплаты без переплат на срок до 24 месяцев' },
          ].map(service => createNode({
            metadata: { name: `Service ${service.title}` },
            styles: {
              properties: {
                padding: '40px',
                borderTop: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                flexDirection: 'column',
              },
            },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'h3',
                content: service.title,
                styles: {
                  properties: {
                    fontSize: '24px',
                    fontWeight: '400',
                    color: colors.white,
                    marginBottom: '16px',
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'p',
                content: service.desc,
                styles: {
                  properties: {
                    fontSize: '15px',
                    color: 'rgba(255,255,255,0.6)',
                    lineHeight: '1.7',
                  },
                },
              }),
            ],
          })),
        }),
      ],
    }),
  ],
})

// ============ CONTACT SECTION ============
const createContact = () => createNode({
  tagName: 'section',
  metadata: { name: 'Contact Section' },
  styles: {
    properties: {
      padding: '160px 80px',
      backgroundColor: colors.cream,
    },
  },
  children: [
    createNode({
      metadata: { name: 'Contact Container' },
      styles: {
        properties: {
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '120px',
        },
      },
      children: [
        // Left - Info
        createNode({
          metadata: { name: 'Contact Info' },
          styles: { properties: { display: 'flex', flexDirection: 'column' } },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: 'Контакты',
              styles: {
                properties: {
                  color: colors.gold,
                  fontSize: '12px',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  marginBottom: '24px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'h2',
              content: 'Мы всегда готовы ответить на ваши вопросы',
              styles: {
                properties: {
                  fontSize: '36px',
                  fontWeight: '300',
                  color: colors.black,
                  marginBottom: '48px',
                  lineHeight: '1.4',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: 'Телефон',
              styles: {
                properties: {
                  fontSize: '13px',
                  color: colors.gray,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: '+998 78 150 11 11',
              styles: {
                properties: {
                  fontSize: '24px',
                  color: colors.black,
                  fontWeight: '300',
                  marginBottom: '40px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: 'Офис продаж',
              styles: {
                properties: {
                  fontSize: '13px',
                  color: colors.gray,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: 'г. Ташкент, ул. Амира Темура, 108',
              styles: {
                properties: {
                  fontSize: '16px',
                  color: colors.black,
                  lineHeight: '1.6',
                },
              },
            }),
          ],
        }),
        // Right - Form
        createNode({
          metadata: { name: 'Contact Form' },
          styles: {
            properties: {
              backgroundColor: colors.white,
              padding: '48px',
              display: 'flex',
              flexDirection: 'column',
            },
          },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'h3',
              content: 'Записаться на консультацию',
              styles: {
                properties: {
                  fontSize: '20px',
                  fontWeight: '500',
                  color: colors.black,
                  marginBottom: '32px',
                },
              },
            }),
            // Form container
            createNode({
              tagName: 'form',
              metadata: { name: 'Form' },
              styles: { properties: {} },
              children: [
                // Name input container
                createNode({
                  metadata: { name: 'Name Input Container' },
                  styles: { properties: { marginBottom: '24px' } },
                  children: [
                    createNode({
                      elementType: 'input',
                      tagName: 'input',
                      metadata: { name: 'Name Input' },
                      attributes: { type: 'text', placeholder: 'Ваше имя' },
                      styles: {
                        properties: {
                          width: '100%',
                          padding: '16px 0',
                          border: 'none',
                          borderBottom: `1px solid ${colors.grayLight}`,
                          fontSize: '15px',
                          outline: 'none',
                          backgroundColor: 'transparent',
                        },
                      },
                    }),
                  ],
                }),
                // Phone input container
                createNode({
                  metadata: { name: 'Phone Input Container' },
                  styles: { properties: { marginBottom: '24px' } },
                  children: [
                    createNode({
                      elementType: 'input',
                      tagName: 'input',
                      metadata: { name: 'Phone Input' },
                      attributes: { type: 'tel', placeholder: 'Телефон' },
                      styles: {
                        properties: {
                          width: '100%',
                          padding: '16px 0',
                          border: 'none',
                          borderBottom: `1px solid ${colors.grayLight}`,
                          fontSize: '15px',
                          outline: 'none',
                          backgroundColor: 'transparent',
                        },
                      },
                    }),
                  ],
                }),
                // Project select container
                createNode({
                  metadata: { name: 'Project Select Container' },
                  styles: { properties: { marginBottom: '32px' } },
                  children: [
                    createNode({
                      elementType: 'select',
                      tagName: 'select',
                      metadata: { name: 'Project Select' },
                      styles: {
                        properties: {
                          width: '100%',
                          padding: '16px 0',
                          border: 'none',
                          borderBottom: `1px solid ${colors.grayLight}`,
                          fontSize: '15px',
                          outline: 'none',
                          backgroundColor: 'transparent',
                          color: colors.gray,
                          cursor: 'pointer',
                        },
                      },
                      children: [
                        createNode({
                          elementType: 'option',
                          tagName: 'option',
                          content: 'Интересующий проект',
                          metadata: { name: 'Default Option' },
                          styles: { properties: {} },
                        }),
                        createNode({
                          elementType: 'option',
                          tagName: 'option',
                          content: 'Golden Residence',
                          metadata: { name: 'Option 1' },
                          styles: { properties: {} },
                        }),
                        createNode({
                          elementType: 'option',
                          tagName: 'option',
                          content: 'Golden Park',
                          metadata: { name: 'Option 2' },
                          styles: { properties: {} },
                        }),
                        createNode({
                          elementType: 'option',
                          tagName: 'option',
                          content: 'Golden Tower',
                          metadata: { name: 'Option 3' },
                          styles: { properties: {} },
                        }),
                      ],
                    }),
                  ],
                }),
                // Submit button
                createNode({
                  elementType: 'button',
                  tagName: 'button',
                  content: 'Отправить заявку',
                  metadata: { name: 'Submit Button' },
                  attributes: { type: 'submit' },
                  styles: {
                    properties: {
                      width: '100%',
                      padding: '18px',
                      backgroundColor: colors.black,
                      color: colors.white,
                      border: 'none',
                      fontSize: '14px',
                      letterSpacing: '1px',
                      cursor: 'pointer',
                    },
                  },
                }),
                // Privacy text
                createNode({
                  elementType: 'text',
                  tagName: 'p',
                  content: 'Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности',
                  metadata: { name: 'Privacy Text' },
                  styles: {
                    properties: {
                      fontSize: '12px',
                      color: colors.gray,
                      marginTop: '16px',
                      lineHeight: '1.6',
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
})

// ============ FOOTER ============
const createFooter = () => createNode({
  tagName: 'footer',
  metadata: { name: 'Footer' },
  styles: {
    properties: {
      backgroundColor: colors.black,
      padding: '80px 80px 40px',
    },
  },
  children: [
    createNode({
      metadata: { name: 'Footer Container' },
      styles: {
        properties: {
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
        },
      },
      children: [
        // Main grid
        createNode({
          metadata: { name: 'Footer Grid' },
          styles: {
            properties: {
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              gap: '64px',
              marginBottom: '64px',
            },
          },
          children: [
            // Brand
            createNode({
              metadata: { name: 'Footer Brand' },
              styles: { properties: { display: 'flex', flexDirection: 'column' } },
              children: [
                createNode({
                  elementType: 'text',
                  tagName: 'span',
                  content: 'Golden House',
                  styles: {
                    properties: {
                      fontSize: '18px',
                      fontWeight: '600',
                      color: colors.white,
                      letterSpacing: '3px',
                      textTransform: 'uppercase',
                      marginBottom: '24px',
                    },
                  },
                }),
                createNode({
                  elementType: 'text',
                  tagName: 'p',
                  content: 'Девелопер премиальной недвижимости в Узбекистане.',
                  styles: {
                    properties: {
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: '14px',
                      lineHeight: '1.7',
                    },
                  },
                }),
              ],
            }),
            // Links columns
            ...['Проекты', 'Компания', 'Покупателям'].map(title => createNode({
              metadata: { name: `Footer ${title}` },
              styles: { properties: { display: 'flex', flexDirection: 'column' } },
              children: [
                createNode({
                  elementType: 'text',
                  tagName: 'span',
                  content: title,
                  styles: {
                    properties: {
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: '12px',
                      letterSpacing: '2px',
                      textTransform: 'uppercase',
                      marginBottom: '24px',
                    },
                  },
                }),
              ],
            })),
          ],
        }),
        // Bottom
        createNode({
          metadata: { name: 'Footer Bottom' },
          styles: {
            properties: {
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: '32px',
            },
          },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: '© 2026 Golden House. Все права защищены.',
              styles: {
                properties: {
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '13px',
                },
              },
            }),
          ],
        }),
      ],
    }),
  ],
})

// ============ FULL PAGE ============
const createFullPage = () => createNode({
  tagName: 'div',
  metadata: { name: 'Golden House Premium Page' },
  styles: {
    properties: {
      fontFamily: "'Muller', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: colors.black,
      lineHeight: '1.5',
      display: 'flex',
      flexDirection: 'column',
    },
  },
  children: [
    createHeader(),
    createHero(),
    createAbout(),
    createProjects(),
    createServices(),
    createContact(),
    createFooter(),
  ],
})

// ============ CREATE PAGE ============
async function createPage() {
  console.log('🚀 Создание премиальной страницы Golden House...')
  
  // Сначала удалим старую если есть
  try {
    const checkRes = await fetch(`${API_URL}/pages`)
    const pages = await checkRes.json()
    const existing = pages.find(p => p.slug === 'golden-house-premium')
    if (existing) {
      await fetch(`${API_URL}/pages/${existing.id}`, { method: 'DELETE' })
      console.log('🗑️ Удалена старая версия страницы')
    }
  } catch (e) {}
  
  try {
    const response = await fetch(`${API_URL}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Golden House Premium',
        slug: 'golden-house-premium',
        status: 'draft',
        structure: createFullPage(),
        metadata: {
          title: 'Golden House — Премиальная недвижимость в Ташкенте',
          description: 'Девелопер премиальной недвижимости. 13 лет создаём пространства для жизни.',
          keywords: ['golden house', 'недвижимость', 'ташкент', 'квартиры', 'премиум'],
        },
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }
    
    const page = await response.json()
    console.log('✅ Страница создана!')
    console.log(`📄 ID: ${page.id}`)
    console.log(`🔗 Slug: ${page.slug}`)
    console.log(`🌐 Откройте в редакторе: http://localhost:3000/editor/page/${page.id}`)
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message)
  }
}

createPage()
