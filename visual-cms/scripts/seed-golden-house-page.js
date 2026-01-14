/**
 * Скрипт для создания главной страницы Golden House
 * Запуск: node scripts/seed-golden-house-page.js
 */

const API_URL = 'http://localhost:5000/api'

// Генератор ID
let idCounter = 0
const generateId = () => `gh-page-${Date.now()}-${++idCounter}`

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
// ПОЛНАЯ СТРУКТУРА СТРАНИЦЫ
// =====================

const pageStructure = createNode({
  tagName: 'div',
  metadata: { name: 'Golden House Homepage' },
  layoutMode: 'flex',
  styles: {
    properties: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      width: '100%',
      fontFamily: 'Muller, sans-serif',
    },
  },
  children: [
    // ========== HEADER ==========
    createNode({
      tagName: 'header',
      metadata: { name: 'Header' },
      styles: {
        properties: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          height: '80px',
          width: '100%',
          backgroundColor: colors.black,
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          zIndex: '1000',
        },
      },
      children: [
        createNode({
          elementType: 'text',
          tagName: 'a',
          metadata: { name: 'Logo' },
          content: 'GOLDEN HOUSE',
          attributes: { href: '/' },
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
        }),
        createNode({
          tagName: 'nav',
          metadata: { name: 'Navigation' },
          styles: {
            properties: {
              display: 'flex',
              gap: '32px',
            },
          },
          children: ['Квартиры', 'Коммерция', 'Ипотека', 'О компании', 'Контакты'].map(label =>
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
              },
            })
          ),
        }),
        createNode({
          metadata: { name: 'Header Right' },
          styles: {
            properties: {
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
            },
          },
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
              },
            }),
          ],
        }),
      ],
    }),

    // ========== HERO SECTION ==========
    createNode({
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
          layoutMode: 'flex',
          styles: {
            properties: {
              display: 'flex',
              flexDirection: 'column',
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

    // ========== STATS SECTION ==========
    createNode({
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

    // ========== ABOUT SECTION ==========
    createNode({
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

    // ========== PROJECTS SECTION ==========
    createNode({
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

    // ========== ADVANTAGES SECTION ==========
    createNode({
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

    // ========== CTA SECTION ==========
    createNode({
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

    // ========== CONTACT SECTION ==========
    createNode({
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
                    { label: 'Адрес', value: 'Яшнабадский район, бизнес-центр «Infinity»' },
                    { label: 'Телефон', value: '+998 78 150-11-11' },
                    { label: 'Время работы', value: 'Пн-Пт: с 9:00 до 18:00' },
                    { label: 'Email', value: 'info@gh.uz' },
                  ].map((item, i) =>
                    createNode({
                      metadata: { name: `Contact Item ${i + 1}` },
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

    // ========== FOOTER ==========
    createNode({
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
  ],
})

// =====================
// API
// =====================
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
  console.log('📄 Создание страницы Golden House...\n')

  try {
    const page = await createPageApi({
      name: 'Главная - Golden House v2',
      slug: 'golden-house-home-v2',
      structure: pageStructure,
      metadata: {
        title: 'Golden House - Национальный лидер рынка недвижимости Узбекистана',
        description: 'Golden House — национальный лидер и первопроходец рынка новостроек Узбекистана, создающий знаковые жилые комплексы комфорт-плюс и бизнес-класса.',
        keywords: ['Golden House', 'недвижимость', 'Ташкент', 'квартиры', 'жилые комплексы', 'новостройки'],
      },
      status: 'published',
    })

    console.log(`✅ Страница создана: ${page.name}`)
    console.log(`   ID: ${page.id}`)
    console.log(`   Slug: /${page.slug}`)
    console.log(`\n🎉 Готово! Откройте редактор:`)
    console.log(`   http://localhost:3001/editor/page/${page.id}`)

  } catch (error) {
    console.error('❌ Ошибка:', error.message)
    console.log('\n💡 Убедитесь, что backend запущен на порту 5000')
  }
}

main()
