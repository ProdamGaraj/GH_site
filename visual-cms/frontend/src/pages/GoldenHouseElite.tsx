import React from 'react'

const colors = {
  black: '#0A0A0A',
  white: '#FFFFFF',
  gray: '#808080',
  grayLight: '#D0D0D0',
  grayDark: '#2A2A2A',
  accent: '#8B7355', // Muted bronze
  cream: '#F5F5F0',
}

// ============ HERO SECTION ============
const Hero: React.FC = () => (
  <section style={{
    height: '100vh',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  }}>
    {/* Background Image */}
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundImage: 'url(https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1920)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: 'brightness(0.4)',
    }} />
    
    {/* Content */}
    <div style={{
      position: 'relative',
      zIndex: 1,
      textAlign: 'center',
      maxWidth: '900px',
      padding: '0 40px',
    }}>
      <h1 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: '72px',
        fontWeight: 300,
        color: colors.white,
        letterSpacing: '2px',
        marginBottom: '32px',
        lineHeight: 1.2,
      }}>
        Golden House
      </h1>
      
      <div style={{
        width: '120px',
        height: '1px',
        backgroundColor: colors.accent,
        margin: '0 auto 48px',
      }} />
      
      <p style={{
        fontSize: '18px',
        color: 'rgba(255,255,255,0.9)',
        lineHeight: 1.8,
        fontWeight: 300,
        letterSpacing: '1px',
      }}>
        Архитектура исключительного качества.<br />
        Резиденции для избранных.
      </p>
    </div>
    
    {/* Scroll indicator */}
    <div style={{
      position: 'absolute',
      bottom: '60px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
    }}>
      <span style={{
        color: 'rgba(255,255,255,0.6)',
        fontSize: '11px',
        letterSpacing: '2px',
        textTransform: 'uppercase',
      }}>
        Листайте вниз
      </span>
      <div style={{
        width: '1px',
        height: '40px',
        backgroundColor: 'rgba(255,255,255,0.3)',
      }} />
    </div>
  </section>
)

// ============ PHILOSOPHY SECTION ============
const Philosophy: React.FC = () => (
  <section style={{
    padding: '180px 80px',
    backgroundColor: colors.white,
  }}>
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      textAlign: 'center',
    }}>
      <p style={{
        fontSize: '11px',
        letterSpacing: '3px',
        textTransform: 'uppercase',
        color: colors.accent,
        marginBottom: '48px',
      }}>
        Философия
      </p>
      
      <h2 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: '48px',
        fontWeight: 300,
        color: colors.black,
        lineHeight: 1.4,
        marginBottom: '48px',
      }}>
        Мы создаём не просто здания.<br />
        Мы создаём наследие.
      </h2>
      
      <p style={{
        fontSize: '18px',
        lineHeight: 2,
        color: colors.gray,
        fontWeight: 300,
      }}>
        С 2013 года Golden House воплощает архитектурное совершенство в самом сердце Ташкента. 
        Каждая резиденция — это синтез продуманной функциональности и безупречной эстетики, 
        созданный для тех, кто ценит подлинное качество.
      </p>
    </div>
  </section>
)

// ============ CURRENT PROJECT SECTION ============
const CurrentProject: React.FC = () => (
  <section style={{
    backgroundColor: colors.grayDark,
    color: colors.white,
  }}>
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      minHeight: '700px',
    }}>
      {/* Image */}
      <div style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />
      
      {/* Content */}
      <div style={{
        padding: '120px 80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        <p style={{
          fontSize: '11px',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          color: colors.accent,
          marginBottom: '32px',
        }}>
          Текущий проект
        </p>
        
        <h3 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '56px',
          fontWeight: 300,
          marginBottom: '32px',
          lineHeight: 1.2,
        }}>
          Golden Heights
        </h3>
        
        <p style={{
          fontSize: '16px',
          lineHeight: 2,
          color: 'rgba(255,255,255,0.7)',
          marginBottom: '48px',
        }}>
          26 эксклюзивных резиденций в центре Ташкента. Панорамные виды, 
          высота потолков 3.6 метра, индивидуальная планировка. 
          Ограниченная коллекция для взыскательных владельцев.
        </p>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '48px',
          marginBottom: '64px',
        }}>
          <div>
            <p style={{
              fontSize: '11px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '12px',
            }}>
              Площадь от
            </p>
            <p style={{
              fontSize: '32px',
              fontWeight: 300,
            }}>
              180 м²
            </p>
          </div>
          <div>
            <p style={{
              fontSize: '11px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '12px',
            }}>
              Сдача
            </p>
            <p style={{
              fontSize: '32px',
              fontWeight: 300,
            }}>
              Q2 2027
            </p>
          </div>
        </div>
        
        <div>
          <a href="#contact" style={{
            display: 'inline-block',
            color: colors.white,
            textDecoration: 'none',
            fontSize: '12px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            borderBottom: `1px solid ${colors.accent}`,
            paddingBottom: '8px',
            transition: 'opacity 0.3s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.6'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Запросить презентацию
          </a>
        </div>
      </div>
    </div>
  </section>
)

// ============ PROJECTS CAROUSEL SECTION ============
const ProjectsCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = React.useState(0)
  
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
  ]
  
  const currentProject = projects[currentIndex]
  
  const nextProject = () => {
    setCurrentIndex((prev) => (prev + 1) % projects.length)
  }
  
  const prevProject = () => {
    setCurrentIndex((prev) => (prev - 1 + projects.length) % projects.length)
  }
  
  return (
    <section style={{
      backgroundColor: colors.white,
      padding: '160px 80px',
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
        <div style={{
          marginBottom: '80px',
        }}>
          <p style={{
            fontSize: '11px',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: colors.accent,
            marginBottom: '32px',
          }}>
            Портфолио
          </p>
          
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '48px',
            fontWeight: 300,
            color: colors.black,
            maxWidth: '600px',
          }}>
            Наши проекты
          </h2>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '80px',
          alignItems: 'center',
        }}>
          {/* Left - Current Project Card */}
          <div style={{
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'relative',
              height: '600px',
              backgroundImage: `url(${currentProject.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}>
              {/* Overlay */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
                padding: '80px 48px 48px',
                color: colors.white,
              }}>
                <h3 style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '42px',
                  fontWeight: 300,
                  marginBottom: '16px',
                  lineHeight: 1.2,
                }}>
                  {currentProject.name}
                </h3>
                
                <p style={{
                  fontSize: '16px',
                  color: 'rgba(255,255,255,0.8)',
                  marginBottom: '32px',
                  lineHeight: 1.6,
                }}>
                  {currentProject.description}
                </p>
                
                <div style={{
                  display: 'flex',
                  gap: '48px',
                  marginBottom: '32px',
                }}>
                  <div>
                    <p style={{
                      fontSize: '10px',
                      letterSpacing: '2px',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.5)',
                      marginBottom: '8px',
                    }}>
                      Локация
                    </p>
                    <p style={{
                      fontSize: '16px',
                      fontWeight: 300,
                    }}>
                      {currentProject.location}
                    </p>
                  </div>
                  
                  <div>
                    <p style={{
                      fontSize: '10px',
                      letterSpacing: '2px',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.5)',
                      marginBottom: '8px',
                    }}>
                      Площадь
                    </p>
                    <p style={{
                      fontSize: '16px',
                      fontWeight: 300,
                    }}>
                      {currentProject.area}
                    </p>
                  </div>
                  
                  <div>
                    <p style={{
                      fontSize: '10px',
                      letterSpacing: '2px',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.5)',
                      marginBottom: '8px',
                    }}>
                      Сдача
                    </p>
                    <p style={{
                      fontSize: '16px',
                      fontWeight: 300,
                    }}>
                      {currentProject.year}
                    </p>
                  </div>
                </div>
                
                <a href="#contact" style={{
                  display: 'inline-block',
                  color: colors.white,
                  textDecoration: 'none',
                  fontSize: '11px',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  borderBottom: `1px solid ${colors.accent}`,
                  paddingBottom: '6px',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.6'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Подробнее
                </a>
              </div>
            </div>
          </div>
          
          {/* Right - Vertical Slider */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
          }}>
            {/* Project List */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              {projects.map((project, index) => (
                <div
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  style={{
                    padding: '24px',
                    borderLeft: `2px solid ${index === currentIndex ? colors.accent : colors.grayLight}`,
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    opacity: index === currentIndex ? 1 : 0.5,
                  }}
                  onMouseEnter={e => {
                    if (index !== currentIndex) {
                      e.currentTarget.style.opacity = '0.8'
                    }
                  }}
                  onMouseLeave={e => {
                    if (index !== currentIndex) {
                      e.currentTarget.style.opacity = '0.5'
                    }
                  }}
                >
                  <p style={{
                    fontSize: '20px',
                    fontWeight: 300,
                    color: colors.black,
                    marginBottom: '8px',
                  }}>
                    {project.name}
                  </p>
                  <p style={{
                    fontSize: '13px',
                    color: colors.gray,
                  }}>
                    {project.location}
                  </p>
                </div>
              ))}
            </div>
            
            {/* Navigation */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              marginTop: '32px',
            }}>
              <button
                onClick={prevProject}
                style={{
                  padding: '16px',
                  border: `1px solid ${colors.grayLight}`,
                  backgroundColor: 'transparent',
                  color: colors.black,
                  fontSize: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = colors.accent
                  e.currentTarget.style.backgroundColor = 'rgba(139,115,85,0.05)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = colors.grayLight
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                ↑
              </button>
              
              <button
                onClick={nextProject}
                style={{
                  padding: '16px',
                  border: `1px solid ${colors.grayLight}`,
                  backgroundColor: 'transparent',
                  color: colors.black,
                  fontSize: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = colors.accent
                  e.currentTarget.style.backgroundColor = 'rgba(139,115,85,0.05)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = colors.grayLight
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                ↓
              </button>
            </div>
            
            {/* Counter */}
            <div style={{
              textAlign: 'center',
              fontSize: '12px',
              color: colors.gray,
              letterSpacing: '2px',
            }}>
              {String(currentIndex + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ============ ARCHITECTURE SECTION ============
const Architecture: React.FC = () => {
  const features = [
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
  ]
  
  return (
    <section style={{
      padding: '160px 80px',
      backgroundColor: colors.cream,
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
        <div style={{
          maxWidth: '600px',
          marginBottom: '80px',
        }}>
          <p style={{
            fontSize: '11px',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: colors.accent,
            marginBottom: '32px',
          }}>
            Внимание к деталям
          </p>
          
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '48px',
            fontWeight: 300,
            color: colors.black,
            lineHeight: 1.3,
          }}>
            Каждый элемент продуман до мелочей
          </h2>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '80px',
        }}>
          {features.map((feature, index) => (
            <div key={index}>
              <div style={{
                width: '40px',
                height: '1px',
                backgroundColor: colors.accent,
                marginBottom: '32px',
              }} />
              
              <h3 style={{
                fontSize: '24px',
                fontWeight: 300,
                color: colors.black,
                marginBottom: '24px',
                letterSpacing: '0.5px',
              }}>
                {feature.title}
              </h3>
              
              <p style={{
                fontSize: '15px',
                lineHeight: 1.9,
                color: colors.gray,
              }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============ LOCATION SECTION ============
const Location: React.FC = () => (
  <section style={{
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    minHeight: '700px',
  }}>
    {/* Content */}
    <div style={{
      padding: '120px 80px',
      backgroundColor: colors.white,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <p style={{
        fontSize: '11px',
        letterSpacing: '3px',
        textTransform: 'uppercase',
        color: colors.accent,
        marginBottom: '32px',
      }}>
        Локация
      </p>
      
      <h3 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: '48px',
        fontWeight: 300,
        color: colors.black,
        marginBottom: '40px',
        lineHeight: 1.3,
      }}>
        В центре жизни города
      </h3>
      
      <p style={{
        fontSize: '16px',
        lineHeight: 2,
        color: colors.gray,
        marginBottom: '48px',
      }}>
        Район Юнусабад — престижная локация с развитой инфраструктурой. 
        5 минут до дипломатического квартала, парки, рестораны высокой кухни, 
        международные школы в шаговой доступности.
      </p>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}>
        {[
          'Посольства и консульства — 5 мин',
          'Парк Алишера Навои — 7 мин',
          'Tashkent City — 12 мин',
          'Международный аэропорт — 25 мин',
        ].map((item, index) => (
          <div key={index} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{
              width: '4px',
              height: '4px',
              backgroundColor: colors.accent,
            }} />
            <span style={{
              fontSize: '15px',
              color: colors.gray,
            }}>
              {item}
            </span>
          </div>
        ))}
      </div>
    </div>
    
    {/* Map/Image */}
    <div style={{
      backgroundImage: 'url(https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }} />
  </section>
)

// ============ EXCLUSIVITY SECTION ============
const Exclusivity: React.FC = () => (
  <section style={{
    padding: '200px 80px',
    backgroundColor: colors.black,
    color: colors.white,
    textAlign: 'center',
  }}>
    <div style={{
      maxWidth: '700px',
      margin: '0 auto',
    }}>
      <div style={{
        width: '60px',
        height: '1px',
        backgroundColor: colors.accent,
        margin: '0 auto 48px',
      }} />
      
      <h2 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: '56px',
        fontWeight: 300,
        lineHeight: 1.3,
        marginBottom: '48px',
      }}>
        Доступно только 26 резиденций
      </h2>
      
      <p style={{
        fontSize: '16px',
        lineHeight: 2,
        color: 'rgba(255,255,255,0.6)',
      }}>
        Эксклюзивность — не маркетинговый приём, а принцип. 
        Мы создаём ограниченное количество резиденций, чтобы гарантировать 
        безупречное качество каждой детали.
      </p>
    </div>
  </section>
)

// ============ CONTACT SECTION ============
const ContactSection: React.FC = () => (
  <section id="contact" style={{
    padding: '160px 80px',
    backgroundColor: colors.cream,
  }}>
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '64px',
      }}>
        <p style={{
          fontSize: '11px',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          color: colors.accent,
          marginBottom: '32px',
        }}>
          Свяжитесь с нами
        </p>
        
        <h2 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '48px',
          fontWeight: 300,
          color: colors.black,
          marginBottom: '32px',
        }}>
          Приватная консультация
        </h2>
        
        <p style={{
          fontSize: '16px',
          lineHeight: 2,
          color: colors.gray,
        }}>
          Оставьте контакт, и наш консультант свяжется с вами 
          для персональной презентации проекта.
        </p>
      </div>
      
      <form style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
      }}>
        <div>
          <input 
            type="text"
            placeholder="Имя"
            style={{
              width: '100%',
              padding: '20px 0',
              border: 'none',
              borderBottom: `1px solid ${colors.grayLight}`,
              fontSize: '16px',
              fontWeight: 300,
              backgroundColor: 'transparent',
              outline: 'none',
            }}
          />
        </div>
        
        <div>
          <input 
            type="tel"
            placeholder="Телефон"
            style={{
              width: '100%',
              padding: '20px 0',
              border: 'none',
              borderBottom: `1px solid ${colors.grayLight}`,
              fontSize: '16px',
              fontWeight: 300,
              backgroundColor: 'transparent',
              outline: 'none',
            }}
          />
        </div>
        
        <div>
          <input 
            type="email"
            placeholder="Email"
            style={{
              width: '100%',
              padding: '20px 0',
              border: 'none',
              borderBottom: `1px solid ${colors.grayLight}`,
              fontSize: '16px',
              fontWeight: 300,
              backgroundColor: 'transparent',
              outline: 'none',
            }}
          />
        </div>
        
        <button type="submit" style={{
          marginTop: '32px',
          padding: '20px 48px',
          backgroundColor: colors.black,
          color: colors.white,
          border: 'none',
          fontSize: '11px',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'background-color 0.3s',
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.grayDark}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.black}
        >
          Отправить запрос
        </button>
        
        <p style={{
          fontSize: '12px',
          color: colors.gray,
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
        </p>
      </form>
      
      <div style={{
        marginTop: '80px',
        paddingTop: '48px',
        borderTop: `1px solid ${colors.grayLight}`,
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: '11px',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: colors.gray,
          marginBottom: '16px',
        }}>
          Офис продаж
        </p>
        <p style={{
          fontSize: '16px',
          color: colors.black,
          marginBottom: '8px',
        }}>
          г. Ташкент, ул. Амира Темура, 108
        </p>
        <p style={{
          fontSize: '16px',
          color: colors.black,
        }}>
          +998 78 150 11 11
        </p>
      </div>
    </div>
  </section>
)

// ============ FOOTER ============
const Footer: React.FC = () => (
  <footer style={{
    padding: '80px',
    backgroundColor: colors.black,
    color: colors.white,
    textAlign: 'center',
  }}>
    <div style={{
      fontFamily: "'Playfair Display', Georgia, serif",
      fontSize: '24px',
      fontWeight: 300,
      letterSpacing: '3px',
      marginBottom: '48px',
    }}>
      GOLDEN HOUSE
    </div>
    
    <div style={{
      width: '60px',
      height: '1px',
      backgroundColor: colors.accent,
      margin: '0 auto 48px',
    }} />
    
    <p style={{
      fontSize: '12px',
      color: 'rgba(255,255,255,0.4)',
      letterSpacing: '1px',
    }}>
      © 2026 Golden House. Архитектура исключительного качества.
    </p>
  </footer>
)

// ============ MAIN COMPONENT ============
const GoldenHouseElite: React.FC = () => {
  return (
    <div style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif",
      color: colors.black,
      backgroundColor: colors.white,
    }}>
      <Hero />
      <Philosophy />
      <CurrentProject />
      <ProjectsCarousel />
      <Architecture />
      <Location />
      <Exclusivity />
      <ContactSection />
      <Footer />
    </div>
  )
}

export default GoldenHouseElite
