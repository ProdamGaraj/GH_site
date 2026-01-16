const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

const colors = {
  black: '#0A0A0A',
  white: '#FFFFFF',
  gray: '#808080',
  grayLight: '#D0D0D0',
  grayDark: '#2A2A2A',
  accent: '#8B7355', // Muted bronze
  cream: '#F5F5F0',
};

let idCounter = Date.now();
const generateId = () => `gh-elite-${idCounter++}`;

const createNode = ({
  elementType = 'container',
  tagName = 'div',
  content = '',
  styles = { properties: {} },
  children = [],
  metadata = {},
  attributes = {},
} = {}) => ({
  id: generateId(),
  elementType,
  tagName,
  content,
  styles,
  children,
  metadata,
  attributes,
});

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
      overflow: 'hidden',
    },
  },
  children: [
    // Background
    createNode({
      metadata: { name: 'Hero Background' },
      styles: {
        properties: {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          backgroundImage: 'url(https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1920)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.4)',
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
          maxWidth: '900px',
          padding: '0 40px',
        },
      },
      children: [
        createNode({
          elementType: 'text',
          tagName: 'h1',
          content: 'Golden House',
          metadata: { name: 'Hero Title' },
          styles: {
            properties: {
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '72px',
              fontWeight: '300',
              color: colors.white,
              letterSpacing: '2px',
              marginBottom: '32px',
              lineHeight: '1.2',
            },
          },
        }),
        createNode({
          metadata: { name: 'Hero Divider' },
          styles: {
            properties: {
              width: '120px',
              height: '1px',
              backgroundColor: colors.accent,
              margin: '0 auto 48px',
            },
          },
        }),
        createNode({
          elementType: 'text',
          tagName: 'p',
          content: 'Архитектура исключительного качества.\nРезиденции для избранных.',
          metadata: { name: 'Hero Subtitle' },
          styles: {
            properties: {
              fontSize: '18px',
              color: 'rgba(255,255,255,0.9)',
              lineHeight: '1.8',
              fontWeight: '300',
              letterSpacing: '1px',
            },
          },
        }),
      ],
    }),
    // Scroll indicator
    createNode({
      metadata: { name: 'Scroll Indicator' },
      styles: {
        properties: {
          position: 'absolute',
          bottom: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        },
      },
      children: [
        createNode({
          elementType: 'text',
          tagName: 'span',
          content: 'Листайте вниз',
          metadata: { name: 'Scroll Text' },
          styles: {
            properties: {
              color: 'rgba(255,255,255,0.6)',
              fontSize: '11px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
            },
          },
        }),
        createNode({
          metadata: { name: 'Scroll Line' },
          styles: {
            properties: {
              width: '1px',
              height: '40px',
              backgroundColor: 'rgba(255,255,255,0.3)',
            },
          },
        }),
      ],
    }),
  ],
});

// ============ PHILOSOPHY SECTION ============
const createPhilosophy = () => createNode({
  tagName: 'section',
  metadata: { name: 'Philosophy Section' },
  styles: {
    properties: {
      padding: '180px 80px',
      backgroundColor: colors.white,
    },
  },
  children: [
    createNode({
      metadata: { name: 'Philosophy Container' },
      styles: {
        properties: {
          maxWidth: '800px',
          margin: '0 auto',
          textAlign: 'center',
        },
      },
      children: [
        createNode({
          elementType: 'text',
          tagName: 'p',
          content: 'Философия',
          metadata: { name: 'Philosophy Label' },
          styles: {
            properties: {
              fontSize: '11px',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: colors.accent,
              marginBottom: '48px',
            },
          },
        }),
        createNode({
          elementType: 'text',
          tagName: 'h2',
          content: 'Мы создаём не просто здания.\nМы создаём наследие.',
          metadata: { name: 'Philosophy Title' },
          styles: {
            properties: {
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '48px',
              fontWeight: '300',
              color: colors.black,
              lineHeight: '1.4',
              marginBottom: '48px',
            },
          },
        }),
        createNode({
          elementType: 'text',
          tagName: 'p',
          content: 'С 2013 года Golden House воплощает архитектурное совершенство в самом сердце Ташкента. Каждая резиденция — это синтез продуманной функциональности и безупречной эстетики, созданный для тех, кто ценит подлинное качество.',
          metadata: { name: 'Philosophy Text' },
          styles: {
            properties: {
              fontSize: '18px',
              lineHeight: '2',
              color: colors.gray,
              fontWeight: '300',
            },
          },
        }),
      ],
    }),
  ],
});

// ============ CURRENT PROJECT SECTION ============
const createCurrentProject = () => createNode({
  tagName: 'section',
  metadata: { name: 'Current Project Section' },
  styles: {
    properties: {
      backgroundColor: colors.grayDark,
      color: colors.white,
    },
  },
  children: [
    createNode({
      metadata: { name: 'Project Grid' },
      styles: {
        properties: {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          minHeight: '700px',
        },
      },
      children: [
        // Image
        createNode({
          metadata: { name: 'Project Image' },
          styles: {
            properties: {
              backgroundImage: 'url(https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            },
          },
        }),
        // Content
        createNode({
          metadata: { name: 'Project Content' },
          styles: {
            properties: {
              padding: '120px 80px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            },
          },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: 'Текущий проект',
              metadata: { name: 'Project Label' },
              styles: {
                properties: {
                  fontSize: '11px',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  color: colors.accent,
                  marginBottom: '32px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'h3',
              content: 'Golden Heights',
              metadata: { name: 'Project Title' },
              styles: {
                properties: {
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '56px',
                  fontWeight: '300',
                  marginBottom: '32px',
                  lineHeight: '1.2',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: '26 эксклюзивных резиденций в центре Ташкента. Панорамные виды, высота потолков 3.6 метра, индивидуальная планировка. Ограниченная коллекция для взыскательных владельцев.',
              metadata: { name: 'Project Description' },
              styles: {
                properties: {
                  fontSize: '16px',
                  lineHeight: '2',
                  color: 'rgba(255,255,255,0.7)',
                  marginBottom: '48px',
                },
              },
            }),
            // Stats
            createNode({
              metadata: { name: 'Project Stats' },
              styles: {
                properties: {
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '48px',
                  marginBottom: '64px',
                },
              },
              children: [
                createNode({
                  metadata: { name: 'Stat Area' },
                  styles: { properties: {} },
                  children: [
                    createNode({
                      elementType: 'text',
                      tagName: 'p',
                      content: 'Площадь от',
                      metadata: { name: 'Stat Label' },
                      styles: {
                        properties: {
                          fontSize: '11px',
                          letterSpacing: '2px',
                          textTransform: 'uppercase',
                          color: 'rgba(255,255,255,0.5)',
                          marginBottom: '12px',
                        },
                      },
                    }),
                    createNode({
                      elementType: 'text',
                      tagName: 'p',
                      content: '180 м²',
                      metadata: { name: 'Stat Value' },
                      styles: {
                        properties: {
                          fontSize: '32px',
                          fontWeight: '300',
                        },
                      },
                    }),
                  ],
                }),
                createNode({
                  metadata: { name: 'Stat Completion' },
                  styles: { properties: {} },
                  children: [
                    createNode({
                      elementType: 'text',
                      tagName: 'p',
                      content: 'Сдача',
                      metadata: { name: 'Stat Label' },
                      styles: {
                        properties: {
                          fontSize: '11px',
                          letterSpacing: '2px',
                          textTransform: 'uppercase',
                          color: 'rgba(255,255,255,0.5)',
                          marginBottom: '12px',
                        },
                      },
                    }),
                    createNode({
                      elementType: 'text',
                      tagName: 'p',
                      content: 'Q2 2027',
                      metadata: { name: 'Stat Value' },
                      styles: {
                        properties: {
                          fontSize: '32px',
                          fontWeight: '300',
                        },
                      },
                    }),
                  ],
                }),
              ],
            }),
            // CTA
            createNode({
              elementType: 'link',
              tagName: 'a',
              content: 'Запросить презентацию',
              metadata: { name: 'Project CTA' },
              attributes: { href: '#contact' },
              styles: {
                properties: {
                  display: 'inline-block',
                  color: colors.white,
                  textDecoration: 'none',
                  fontSize: '12px',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  borderBottom: `1px solid ${colors.accent}`,
                  paddingBottom: '8px',
                },
              },
            }),
          ],
        }),
      ],
    }),
  ],
});

// ============ ARCHITECTURE SECTION ============
const createArchitecture = () => createNode({
  tagName: 'section',
  metadata: { name: 'Architecture Section' },
  styles: {
    properties: {
      padding: '160px 80px',
      backgroundColor: colors.cream,
    },
  },
  children: [
    createNode({
      metadata: { name: 'Architecture Container' },
      styles: {
        properties: {
          maxWidth: '1400px',
          margin: '0 auto',
        },
      },
      children: [
        createNode({
          metadata: { name: 'Architecture Header' },
          styles: {
            properties: {
              maxWidth: '600px',
              marginBottom: '80px',
            },
          },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: 'Внимание к деталям',
              metadata: { name: 'Architecture Label' },
              styles: {
                properties: {
                  fontSize: '11px',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  color: colors.accent,
                  marginBottom: '32px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'h2',
              content: 'Каждый элемент продуман до мелочей',
              metadata: { name: 'Architecture Title' },
              styles: {
                properties: {
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '48px',
                  fontWeight: '300',
                  color: colors.black,
                  lineHeight: '1.3',
                },
              },
            }),
          ],
        }),
        createNode({
          metadata: { name: 'Features Grid' },
          styles: {
            properties: {
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '80px',
            },
          },
          children: [
            {
              title: 'Архитектура',
              description: 'Минималистичная эстетика, вдохновлённая европейским брутализмом и японской философией пространства.',
            },
            {
              title: 'Материалы',
              description: 'Натуральный камень, дерево редких пород, итальянская керамика. Отделка премиум-класса.',
            },
            {
              title: 'Инженерия',
              description: 'Системы климат-контроля, умный дом, звукоизоляция 62 дБ. Технологии на десятилетия вперёд.',
            },
          ].map(feature => createNode({
            metadata: { name: `Feature ${feature.title}` },
            styles: { properties: {} },
            children: [
              createNode({
                metadata: { name: 'Feature Line' },
                styles: {
                  properties: {
                    width: '40px',
                    height: '1px',
                    backgroundColor: colors.accent,
                    marginBottom: '32px',
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'h3',
                content: feature.title,
                metadata: { name: 'Feature Title' },
                styles: {
                  properties: {
                    fontSize: '24px',
                    fontWeight: '300',
                    color: colors.black,
                    marginBottom: '24px',
                    letterSpacing: '0.5px',
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'p',
                content: feature.description,
                metadata: { name: 'Feature Description' },
                styles: {
                  properties: {
                    fontSize: '15px',
                    lineHeight: '1.9',
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
});

// ============ PROJECTS CAROUSEL SECTION ============
const createProjectsCarousel = () => {
  const projects = [
    {
      name: 'Golden Heights',
      location: 'Юнусабад',
      area: '180-350 м²',
      year: '2027',
      image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800',
      description: '26 эксклюзивных резиденций с панорамными видами',
    },
    {
      name: 'Golden Residences',
      location: 'Мирзо Улугбек',
      area: '220-400 м²',
      year: '2026',
      image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800',
      description: 'Премиальные апартаменты в центре города',
    },
    {
      name: 'Golden Plaza',
      location: 'Чиланзар',
      area: '150-280 м²',
      year: 'Сдан',
      image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
      description: 'Бизнес-класс с развитой инфраструктурой',
    },
    {
      name: 'Golden Tower',
      location: 'Сергели',
      area: '120-250 м²',
      year: '2028',
      image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
      description: 'Современная архитектура для комфортной жизни',
    },
  ];

  return createNode({
    tagName: 'section',
    metadata: { name: 'Projects Carousel Section' },
    styles: {
      properties: {
        backgroundColor: colors.white,
        padding: '160px 80px',
      },
    },
    children: [
      createNode({
        metadata: { name: 'Carousel Container' },
        styles: {
          properties: {
            maxWidth: '1400px',
            margin: '0 auto',
          },
        },
        children: [
          // Header
          createNode({
            metadata: { name: 'Carousel Header' },
            styles: {
              properties: {
                marginBottom: '80px',
              },
            },
            children: [
              createNode({
                elementType: 'text',
                tagName: 'p',
                content: 'Портфолио',
                metadata: { name: 'Carousel Label' },
                styles: {
                  properties: {
                    fontSize: '11px',
                    letterSpacing: '3px',
                    textTransform: 'uppercase',
                    color: colors.accent,
                    marginBottom: '32px',
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'h2',
                content: 'Наши проекты',
                metadata: { name: 'Carousel Title' },
                styles: {
                  properties: {
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: '48px',
                    fontWeight: '300',
                    color: colors.black,
                    maxWidth: '600px',
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
                gridTemplateColumns: '2fr 1fr',
                gap: '80px',
                alignItems: 'center',
              },
            },
            children: [
              // Featured Project (first one)
              createNode({
                metadata: { name: 'Featured Project' },
                styles: {
                  properties: {
                    position: 'relative',
                    overflow: 'hidden',
                  },
                },
                children: [
                  createNode({
                    metadata: { name: 'Project Image Container' },
                    styles: {
                      properties: {
                        position: 'relative',
                        height: '600px',
                        backgroundImage: `url(${projects[0].image})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      },
                    },
                    children: [
                      createNode({
                        metadata: { name: 'Project Overlay' },
                        styles: {
                          properties: {
                            position: 'absolute',
                            bottom: '0',
                            left: '0',
                            right: '0',
                            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
                            padding: '80px 48px 48px',
                            color: colors.white,
                          },
                        },
                        children: [
                          createNode({
                            elementType: 'text',
                            tagName: 'h3',
                            content: projects[0].name,
                            metadata: { name: 'Project Name' },
                            styles: {
                              properties: {
                                fontFamily: "'Playfair Display', Georgia, serif",
                                fontSize: '42px',
                                fontWeight: '300',
                                marginBottom: '16px',
                                lineHeight: '1.2',
                              },
                            },
                          }),
                          createNode({
                            elementType: 'text',
                            tagName: 'p',
                            content: projects[0].description,
                            metadata: { name: 'Project Description' },
                            styles: {
                              properties: {
                                fontSize: '16px',
                                color: 'rgba(255,255,255,0.8)',
                                marginBottom: '32px',
                                lineHeight: '1.6',
                              },
                            },
                          }),
                          createNode({
                            metadata: { name: 'Project Stats' },
                            styles: {
                              properties: {
                                display: 'flex',
                                gap: '48px',
                                marginBottom: '32px',
                              },
                            },
                            children: [
                              createNode({
                                metadata: { name: 'Stat Location' },
                                styles: { properties: {} },
                                children: [
                                  createNode({
                                    elementType: 'text',
                                    tagName: 'p',
                                    content: 'Локация',
                                    metadata: { name: 'Stat Label' },
                                    styles: {
                                      properties: {
                                        fontSize: '10px',
                                        letterSpacing: '2px',
                                        textTransform: 'uppercase',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: '8px',
                                      },
                                    },
                                  }),
                                  createNode({
                                    elementType: 'text',
                                    tagName: 'p',
                                    content: projects[0].location,
                                    metadata: { name: 'Stat Value' },
                                    styles: {
                                      properties: {
                                        fontSize: '16px',
                                        fontWeight: '300',
                                      },
                                    },
                                  }),
                                ],
                              }),
                              createNode({
                                metadata: { name: 'Stat Area' },
                                styles: { properties: {} },
                                children: [
                                  createNode({
                                    elementType: 'text',
                                    tagName: 'p',
                                    content: 'Площадь',
                                    metadata: { name: 'Stat Label' },
                                    styles: {
                                      properties: {
                                        fontSize: '10px',
                                        letterSpacing: '2px',
                                        textTransform: 'uppercase',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: '8px',
                                      },
                                    },
                                  }),
                                  createNode({
                                    elementType: 'text',
                                    tagName: 'p',
                                    content: projects[0].area,
                                    metadata: { name: 'Stat Value' },
                                    styles: {
                                      properties: {
                                        fontSize: '16px',
                                        fontWeight: '300',
                                      },
                                    },
                                  }),
                                ],
                              }),
                              createNode({
                                metadata: { name: 'Stat Year' },
                                styles: { properties: {} },
                                children: [
                                  createNode({
                                    elementType: 'text',
                                    tagName: 'p',
                                    content: 'Сдача',
                                    metadata: { name: 'Stat Label' },
                                    styles: {
                                      properties: {
                                        fontSize: '10px',
                                        letterSpacing: '2px',
                                        textTransform: 'uppercase',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: '8px',
                                      },
                                    },
                                  }),
                                  createNode({
                                    elementType: 'text',
                                    tagName: 'p',
                                    content: projects[0].year,
                                    metadata: { name: 'Stat Value' },
                                    styles: {
                                      properties: {
                                        fontSize: '16px',
                                        fontWeight: '300',
                                      },
                                    },
                                  }),
                                ],
                              }),
                            ],
                          }),
                          createNode({
                            elementType: 'link',
                            tagName: 'a',
                            content: 'Подробнее',
                            metadata: { name: 'Project CTA' },
                            attributes: { href: '#contact' },
                            styles: {
                              properties: {
                                display: 'inline-block',
                                color: colors.white,
                                textDecoration: 'none',
                                fontSize: '11px',
                                letterSpacing: '2px',
                                textTransform: 'uppercase',
                                borderBottom: `1px solid ${colors.accent}`,
                                paddingBottom: '6px',
                              },
                            },
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              // Right Side - Project List
              createNode({
                metadata: { name: 'Projects Sidebar' },
                styles: {
                  properties: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '32px',
                  },
                },
                children: [
                  createNode({
                    metadata: { name: 'Project List' },
                    styles: {
                      properties: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                      },
                    },
                    children: projects.map((project, index) => createNode({
                      metadata: { name: `Project Item ${project.name}` },
                      styles: {
                        properties: {
                          padding: '24px',
                          borderLeft: `2px solid ${index === 0 ? colors.accent : colors.grayLight}`,
                          cursor: 'pointer',
                          opacity: index === 0 ? '1' : '0.5',
                        },
                      },
                      children: [
                        createNode({
                          elementType: 'text',
                          tagName: 'p',
                          content: project.name,
                          metadata: { name: 'Item Name' },
                          styles: {
                            properties: {
                              fontSize: '20px',
                              fontWeight: '300',
                              color: colors.black,
                              marginBottom: '8px',
                            },
                          },
                        }),
                        createNode({
                          elementType: 'text',
                          tagName: 'p',
                          content: project.location,
                          metadata: { name: 'Item Location' },
                          styles: {
                            properties: {
                              fontSize: '13px',
                              color: colors.gray,
                            },
                          },
                        }),
                      ],
                    })),
                  }),
                  createNode({
                    metadata: { name: 'Navigation Controls' },
                    styles: {
                      properties: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        marginTop: '32px',
                      },
                    },
                    children: [
                      createNode({
                        elementType: 'button',
                        tagName: 'button',
                        content: '↑',
                        metadata: { name: 'Prev Button' },
                        styles: {
                          properties: {
                            padding: '16px',
                            border: `1px solid ${colors.grayLight}`,
                            backgroundColor: 'transparent',
                            color: colors.black,
                            fontSize: '20px',
                            cursor: 'pointer',
                          },
                        },
                      }),
                      createNode({
                        elementType: 'button',
                        tagName: 'button',
                        content: '↓',
                        metadata: { name: 'Next Button' },
                        styles: {
                          properties: {
                            padding: '16px',
                            border: `1px solid ${colors.grayLight}`,
                            backgroundColor: 'transparent',
                            color: colors.black,
                            fontSize: '20px',
                            cursor: 'pointer',
                          },
                        },
                      }),
                    ],
                  }),
                  createNode({
                    elementType: 'text',
                    tagName: 'div',
                    content: '01 / 04',
                    metadata: { name: 'Counter' },
                    styles: {
                      properties: {
                        textAlign: 'center',
                        fontSize: '12px',
                        color: colors.gray,
                        letterSpacing: '2px',
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
  });
};

// ============ LOCATION SECTION ============
const createLocation = () => createNode({
  tagName: 'section',
  metadata: { name: 'Location Section' },
  styles: {
    properties: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      minHeight: '700px',
    },
  },
  children: [
    // Content
    createNode({
      metadata: { name: 'Location Content' },
      styles: {
        properties: {
          padding: '120px 80px',
          backgroundColor: colors.white,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        },
      },
      children: [
        createNode({
          elementType: 'text',
          tagName: 'p',
          content: 'Локация',
          metadata: { name: 'Location Label' },
          styles: {
            properties: {
              fontSize: '11px',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: colors.accent,
              marginBottom: '32px',
            },
          },
        }),
        createNode({
          elementType: 'text',
          tagName: 'h3',
          content: 'В центре жизни города',
          metadata: { name: 'Location Title' },
          styles: {
            properties: {
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '48px',
              fontWeight: '300',
              color: colors.black,
              marginBottom: '40px',
              lineHeight: '1.3',
            },
          },
        }),
        createNode({
          elementType: 'text',
          tagName: 'p',
          content: 'Район Юнусабад — престижная локация с развитой инфраструктурой. 5 минут до дипломатического квартала, парки, рестораны высокой кухни, международные школы в шаговой доступности.',
          metadata: { name: 'Location Description' },
          styles: {
            properties: {
              fontSize: '16px',
              lineHeight: '2',
              color: colors.gray,
              marginBottom: '48px',
            },
          },
        }),
        createNode({
          metadata: { name: 'Location Points' },
          styles: {
            properties: {
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            },
          },
          children: [
            'Посольства и консульства — 5 мин',
            'Парк Алишера Навои — 7 мин',
            'Tashkent City — 12 мин',
            'Международный аэропорт — 25 мин',
          ].map(point => createNode({
            metadata: { name: 'Location Point' },
            styles: {
              properties: {
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              },
            },
            children: [
              createNode({
                metadata: { name: 'Point Bullet' },
                styles: {
                  properties: {
                    width: '4px',
                    height: '4px',
                    backgroundColor: colors.accent,
                  },
                },
              }),
              createNode({
                elementType: 'text',
                tagName: 'span',
                content: point,
                metadata: { name: 'Point Text' },
                styles: {
                  properties: {
                    fontSize: '15px',
                    color: colors.gray,
                  },
                },
              }),
            ],
          })),
        }),
      ],
    }),
    // Map
    createNode({
      metadata: { name: 'Location Map' },
      styles: {
        properties: {
          backgroundImage: 'url(https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        },
      },
    }),
  ],
});

// ============ EXCLUSIVITY SECTION ============
const createExclusivity = () => createNode({
  tagName: 'section',
  metadata: { name: 'Exclusivity Section' },
  styles: {
    properties: {
      padding: '200px 80px',
      backgroundColor: colors.black,
      color: colors.white,
      textAlign: 'center',
    },
  },
  children: [
    createNode({
      metadata: { name: 'Exclusivity Container' },
      styles: {
        properties: {
          maxWidth: '700px',
          margin: '0 auto',
        },
      },
      children: [
        createNode({
          metadata: { name: 'Exclusivity Line' },
          styles: {
            properties: {
              width: '60px',
              height: '1px',
              backgroundColor: colors.accent,
              margin: '0 auto 48px',
            },
          },
        }),
        createNode({
          elementType: 'text',
          tagName: 'h2',
          content: 'Доступно только 26 резиденций',
          metadata: { name: 'Exclusivity Title' },
          styles: {
            properties: {
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '56px',
              fontWeight: '300',
              lineHeight: '1.3',
              marginBottom: '48px',
            },
          },
        }),
        createNode({
          elementType: 'text',
          tagName: 'p',
          content: 'Эксклюзивность — не маркетинговый приём, а принцип. Мы создаём ограниченное количество резиденций, чтобы гарантировать безупречное качество каждой детали.',
          metadata: { name: 'Exclusivity Text' },
          styles: {
            properties: {
              fontSize: '16px',
              lineHeight: '2',
              color: 'rgba(255,255,255,0.6)',
            },
          },
        }),
      ],
    }),
  ],
});

// ============ CONTACT SECTION ============
const createContact = () => createNode({
  tagName: 'section',
  metadata: { name: 'Contact Section' },
  attributes: { id: 'contact' },
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
          maxWidth: '600px',
          margin: '0 auto',
        },
      },
      children: [
        createNode({
          metadata: { name: 'Contact Header' },
          styles: {
            properties: {
              textAlign: 'center',
              marginBottom: '64px',
            },
          },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: 'Свяжитесь с нами',
              metadata: { name: 'Contact Label' },
              styles: {
                properties: {
                  fontSize: '11px',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  color: colors.accent,
                  marginBottom: '32px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'h2',
              content: 'Приватная консультация',
              metadata: { name: 'Contact Title' },
              styles: {
                properties: {
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '48px',
                  fontWeight: '300',
                  color: colors.black,
                  marginBottom: '32px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: 'Оставьте контакт, и наш консультант свяжется с вами для персональной презентации проекта.',
              metadata: { name: 'Contact Description' },
              styles: {
                properties: {
                  fontSize: '16px',
                  lineHeight: '2',
                  color: colors.gray,
                },
              },
            }),
          ],
        }),
        createNode({
          tagName: 'form',
          metadata: { name: 'Contact Form' },
          styles: {
            properties: {
              display: 'flex',
              flexDirection: 'column',
              gap: '32px',
            },
          },
          children: [
            createNode({
              metadata: { name: 'Name Input Container' },
              styles: { properties: {} },
              children: [
                createNode({
                  elementType: 'input',
                  tagName: 'input',
                  metadata: { name: 'Name Input' },
                  attributes: { type: 'text', placeholder: 'Имя' },
                  styles: {
                    properties: {
                      width: '100%',
                      padding: '20px 0',
                      border: 'none',
                      borderBottom: `1px solid ${colors.grayLight}`,
                      fontSize: '16px',
                      fontWeight: '300',
                      backgroundColor: 'transparent',
                      outline: 'none',
                    },
                  },
                }),
              ],
            }),
            createNode({
              metadata: { name: 'Phone Input Container' },
              styles: { properties: {} },
              children: [
                createNode({
                  elementType: 'input',
                  tagName: 'input',
                  metadata: { name: 'Phone Input' },
                  attributes: { type: 'tel', placeholder: 'Телефон' },
                  styles: {
                    properties: {
                      width: '100%',
                      padding: '20px 0',
                      border: 'none',
                      borderBottom: `1px solid ${colors.grayLight}`,
                      fontSize: '16px',
                      fontWeight: '300',
                      backgroundColor: 'transparent',
                      outline: 'none',
                    },
                  },
                }),
              ],
            }),
            createNode({
              metadata: { name: 'Email Input Container' },
              styles: { properties: {} },
              children: [
                createNode({
                  elementType: 'input',
                  tagName: 'input',
                  metadata: { name: 'Email Input' },
                  attributes: { type: 'email', placeholder: 'Email' },
                  styles: {
                    properties: {
                      width: '100%',
                      padding: '20px 0',
                      border: 'none',
                      borderBottom: `1px solid ${colors.grayLight}`,
                      fontSize: '16px',
                      fontWeight: '300',
                      backgroundColor: 'transparent',
                      outline: 'none',
                    },
                  },
                }),
              ],
            }),
            createNode({
              elementType: 'button',
              tagName: 'button',
              content: 'Отправить запрос',
              metadata: { name: 'Submit Button' },
              attributes: { type: 'submit' },
              styles: {
                properties: {
                  marginTop: '32px',
                  padding: '20px 48px',
                  backgroundColor: colors.black,
                  color: colors.white,
                  border: 'none',
                  fontSize: '11px',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: 'Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности',
              metadata: { name: 'Privacy Text' },
              styles: {
                properties: {
                  fontSize: '12px',
                  color: colors.gray,
                  textAlign: 'center',
                  lineHeight: '1.6',
                },
              },
            }),
          ],
        }),
        createNode({
          metadata: { name: 'Office Info' },
          styles: {
            properties: {
              marginTop: '80px',
              paddingTop: '48px',
              borderTop: `1px solid ${colors.grayLight}`,
              textAlign: 'center',
            },
          },
          children: [
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: 'Офис продаж',
              metadata: { name: 'Office Label' },
              styles: {
                properties: {
                  fontSize: '11px',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  color: colors.gray,
                  marginBottom: '16px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: 'г. Ташкент, ул. Амира Темура, 108',
              metadata: { name: 'Office Address' },
              styles: {
                properties: {
                  fontSize: '16px',
                  color: colors.black,
                  marginBottom: '8px',
                },
              },
            }),
            createNode({
              elementType: 'text',
              tagName: 'p',
              content: '+998 78 150 11 11',
              metadata: { name: 'Office Phone' },
              styles: {
                properties: {
                  fontSize: '16px',
                  color: colors.black,
                },
              },
            }),
          ],
        }),
      ],
    }),
  ],
});

// ============ FOOTER ============
const createFooter = () => createNode({
  tagName: 'footer',
  metadata: { name: 'Footer' },
  styles: {
    properties: {
      padding: '80px',
      backgroundColor: colors.black,
      color: colors.white,
      textAlign: 'center',
    },
  },
  children: [
    createNode({
      elementType: 'text',
      tagName: 'div',
      content: 'GOLDEN HOUSE',
      metadata: { name: 'Footer Logo' },
      styles: {
        properties: {
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '24px',
          fontWeight: '300',
          letterSpacing: '3px',
          marginBottom: '48px',
        },
      },
    }),
    createNode({
      metadata: { name: 'Footer Line' },
      styles: {
        properties: {
          width: '60px',
          height: '1px',
          backgroundColor: colors.accent,
          margin: '0 auto 48px',
        },
      },
    }),
    createNode({
      elementType: 'text',
      tagName: 'p',
      content: '© 2026 Golden House. Архитектура исключительного качества.',
      metadata: { name: 'Footer Copyright' },
      styles: {
        properties: {
          fontSize: '12px',
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '1px',
        },
      },
    }),
  ],
});

// ============ MAIN STRUCTURE ============
const createPageStructure = () => createNode({
  metadata: { name: 'Golden House Elite Page' },
  styles: {
    properties: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif",
      color: colors.black,
      backgroundColor: colors.white,
    },
  },
  children: [
    createHero(),
    createPhilosophy(),
    createCurrentProject(),
    createProjectsCarousel(),
    createArchitecture(),
    createLocation(),
    createExclusivity(),
    createContact(),
    createFooter(),
  ],
});

// ============ SEED SCRIPT ============
async function seedGoldenHouseElite() {
  try {
    console.log('🚀 Создание элитной страницы Golden House...');

    // Delete old version if exists
    try {
      const existingPages = await axios.get(`${API_URL}/pages`);
      const existingPage = existingPages.data.find(p => p.slug === 'golden-house-elite');
      if (existingPage) {
        await axios.delete(`${API_URL}/pages/${existingPage.id}`);
        console.log('🗑️ Удалена старая версия страницы');
      }
    } catch (err) {
      // Page doesn't exist, continue
    }

    const pageData = {
      name: 'Golden House Elite',
      slug: 'golden-house-elite',
      metadata: {
        title: 'Golden House — Архитектура исключительного качества',
        description: 'Резиденции для избранных. Эксклюзивная недвижимость премиум-класса в Ташкенте.',
        keywords: ['golden house', 'элитная недвижимость', 'премиум', 'ташкент', 'архитектура'],
      },
      structure: createPageStructure(),
      status: 'draft',
    };

    const response = await axios.post(`${API_URL}/pages`, pageData);

    console.log('✅ Страница создана!');
    console.log('📄 ID:', response.data.id);
    console.log('🔗 Slug:', response.data.slug);
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
    process.exit(1);
  }
}

seedGoldenHouseElite();
