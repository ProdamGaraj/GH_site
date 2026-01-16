/**
 * Golden House - Премиальная версия главной страницы
 * Сдержанный, элегантный дизайн без агрессивного маркетинга
 * Стиль: Capital Group, MR Group, Донстрой
 */

import React, { useState } from 'react'

// ============ ЦВЕТА ============
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

// ============ HEADER ============
const Header: React.FC = () => {
  const navItems = ['Проекты', 'О компании', 'Покупателям', 'Коммерция', 'Контакты']
  
  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '80px',
      backgroundColor: 'rgba(255,255,255,0.98)',
      backdropFilter: 'blur(20px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 80px',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
    }}>
      <a href="/" style={{
        fontSize: '18px',
        fontWeight: 600,
        color: colors.black,
        textDecoration: 'none',
        letterSpacing: '3px',
        textTransform: 'uppercase',
      }}>
        Golden House
      </a>
      
      <nav style={{ display: 'flex', gap: '48px' }}>
        {navItems.map(item => (
          <a key={item} href="#" style={{
            color: colors.grayDark,
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 400,
            letterSpacing: '0.5px',
            transition: 'color 0.3s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = colors.black}
          onMouseLeave={e => e.currentTarget.style.color = colors.grayDark}
          >
            {item}
          </a>
        ))}
      </nav>
      
      <a href="tel:+998781501111" style={{
        color: colors.black,
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: 500,
        letterSpacing: '1px',
      }}>
        +998 78 150 11 11
      </a>
    </header>
  )
}

// ============ HERO SECTION ============
const HeroSection: React.FC = () => {
  return (
    <section style={{
      height: '100vh',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: 'url(https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1920)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      {/* Subtle overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
      }} />
      
      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        maxWidth: '800px',
        padding: '0 40px',
      }}>
        <p style={{
          color: colors.gold,
          fontSize: '13px',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          marginBottom: '24px',
          fontWeight: 500,
        }}>
          Девелопер премиальной недвижимости
        </p>
        
        <h1 style={{
          color: colors.white,
          fontSize: '56px',
          fontWeight: 300,
          lineHeight: 1.2,
          marginBottom: '32px',
          letterSpacing: '-1px',
        }}>
          Создаём пространства<br />для жизни
        </h1>
        
        <p style={{
          color: 'rgba(255,255,255,0.8)',
          fontSize: '18px',
          fontWeight: 300,
          lineHeight: 1.7,
          marginBottom: '48px',
        }}>
          13 лет мы строим дома, в которых хочется жить.<br />
          Архитектура, продуманная до мелочей.
        </p>
        
        <a href="#projects" style={{
          display: 'inline-block',
          color: colors.white,
          textDecoration: 'none',
          fontSize: '14px',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          padding: '16px 48px',
          border: '1px solid rgba(255,255,255,0.4)',
          transition: 'all 0.3s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = colors.white
          e.currentTarget.style.color = colors.black
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = colors.white
        }}
        >
          Смотреть проекты
        </a>
      </div>
      
      {/* Scroll indicator */}
      <div style={{
        position: 'absolute',
        bottom: '48px',
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
}

// ============ ABOUT SECTION ============
const AboutSection: React.FC = () => {
  const stats = [
    { value: '13', label: 'лет на рынке' },
    { value: '500K', label: 'м² построено' },
    { value: '12', label: 'проектов сдано' },
    { value: '8 000', label: 'семей живут в наших домах' },
  ]
  
  return (
    <section style={{
      padding: '160px 80px',
      backgroundColor: colors.cream,
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '120px',
        alignItems: 'center',
      }}>
        {/* Text */}
        <div>
          <p style={{
            color: colors.gold,
            fontSize: '12px',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            marginBottom: '24px',
          }}>
            О компании
          </p>
          
          <h2 style={{
            fontSize: '42px',
            fontWeight: 300,
            color: colors.black,
            lineHeight: 1.3,
            marginBottom: '32px',
          }}>
            Мы верим, что дом — это больше, чем стены
          </h2>
          
          <p style={{
            fontSize: '16px',
            color: colors.grayDark,
            lineHeight: 1.8,
            marginBottom: '24px',
          }}>
            Golden House — это команда архитекторов, инженеров и дизайнеров, 
            объединённых общей целью: создавать жилые пространства, 
            которые вдохновляют и становятся настоящим домом для наших клиентов.
          </p>
          
          <p style={{
            fontSize: '16px',
            color: colors.grayDark,
            lineHeight: 1.8,
            marginBottom: '48px',
          }}>
            Каждый наш проект — это результат глубокого анализа потребностей 
            современного человека и внимательного отношения к деталям.
          </p>
          
          <a href="/about" style={{
            color: colors.black,
            textDecoration: 'none',
            fontSize: '14px',
            letterSpacing: '1px',
            borderBottom: `1px solid ${colors.black}`,
            paddingBottom: '4px',
            transition: 'color 0.3s, border-color 0.3s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = colors.gold
            e.currentTarget.style.borderColor = colors.gold
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = colors.black
            e.currentTarget.style.borderColor = colors.black
          }}
          >
            Узнать больше о компании
          </a>
        </div>
        
        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '48px',
        }}>
          {stats.map((stat, index) => (
            <div key={index} style={{
              padding: '32px 0',
              borderTop: `1px solid ${colors.grayLight}`,
            }}>
              <div style={{
                fontSize: '48px',
                fontWeight: 300,
                color: colors.black,
                marginBottom: '8px',
                letterSpacing: '-2px',
              }}>
                {stat.value}
              </div>
              <div style={{
                fontSize: '14px',
                color: colors.gray,
                letterSpacing: '0.5px',
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============ PROJECTS SECTION (from Modern) ============
const ProjectsSection: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('Все')
  const filters = ['Все', 'С ключами', 'Бизнес-класс', 'Премиум']
  const years = ['Сдан', '2025', '2026', '2027', '2028+']
  const [activeYear, setActiveYear] = useState('Все')
  
  const projects = [
    {
      name: 'Golden Residence',
      location: 'Юнусабад',
      metro: '5 мин',
      price: 'от $85 000',
      image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600',
      badge: 'Новый проект',
      badgeColor: colors.gold,
    },
    {
      name: 'Golden Park',
      location: 'Мирзо Улугбек',
      metro: '10 мин',
      price: 'от $72 000',
      image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600',
      badge: 'Бизнес-класс',
      badgeColor: colors.charcoal,
    },
    {
      name: 'Golden Plaza',
      location: 'Чиланзар',
      metro: '3 мин',
      price: 'от $65 000',
      image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600',
      badge: 'Сдан',
      badgeColor: colors.grayDark,
    },
    {
      name: 'Golden Tower',
      location: 'Сергели',
      metro: '15 мин',
      price: 'от $58 000',
      image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600',
    },
  ]
  
  return (
    <section id="projects" style={{
      padding: '100px 80px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
      {/* Section Header */}
      <div style={{ marginBottom: '48px' }}>
        <p style={{
          color: colors.gold,
          fontSize: '12px',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          marginBottom: '16px',
        }}>
          Каталог
        </p>
        <h2 style={{
          fontSize: '36px',
          fontWeight: 300,
          color: colors.black,
          letterSpacing: '-1px',
        }}>
          Наши жилые комплексы
        </h2>
      </div>
      
      {/* Filter Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '32px',
        gap: '32px',
        flexWrap: 'wrap',
      }}>
        {/* Location filter */}
        <div>
          <label style={{ fontSize: '13px', color: colors.gray, marginBottom: '8px', display: 'block' }}>
            Выберите локацию
          </label>
          <select style={{
            padding: '14px 48px 14px 16px',
            border: `1px solid ${colors.grayLight}`,
            borderRadius: '4px',
            fontSize: '15px',
            minWidth: '240px',
            appearance: 'none',
            backgroundColor: colors.white,
            cursor: 'pointer',
          }}>
            <option>Район, метро</option>
            <option>Юнусабад</option>
            <option>Мирзо Улугбек</option>
            <option>Чиланзар</option>
          </select>
        </div>
        
        {/* Price range */}
        <div style={{ flex: 1, maxWidth: '300px' }}>
          <label style={{ fontSize: '13px', color: colors.gray, marginBottom: '8px', display: 'block' }}>
            Стоимость, $
          </label>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <input type="text" placeholder="от 50 000" style={{
              padding: '14px 16px',
              border: `1px solid ${colors.grayLight}`,
              borderRadius: '4px',
              fontSize: '15px',
              width: '120px',
            }} />
            <span style={{ color: colors.gray }}>—</span>
            <input type="text" placeholder="до 500 000" style={{
              padding: '14px 16px',
              border: `1px solid ${colors.grayLight}`,
              borderRadius: '4px',
              fontSize: '15px',
              width: '120px',
            }} />
          </div>
        </div>
        
        {/* Year filters */}
        <div>
          <label style={{ fontSize: '13px', color: colors.gray, marginBottom: '8px', display: 'block' }}>
            Дата сдачи до
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {years.map(year => (
              <button
                key={year}
                onClick={() => setActiveYear(year)}
                style={{
                  padding: '12px 20px',
                  border: `1px solid ${activeYear === year ? colors.gold : colors.grayLight}`,
                  borderRadius: '4px',
                  backgroundColor: activeYear === year ? 'rgba(210,159,102,0.1)' : colors.white,
                  color: colors.black,
                  fontSize: '14px',
                  fontWeight: 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Tag filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '48px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {filters.map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              padding: '10px 24px',
              border: `1px solid ${activeFilter === filter ? colors.gold : colors.grayLight}`,
              borderRadius: '4px',
              backgroundColor: activeFilter === filter ? colors.gold : colors.white,
              color: activeFilter === filter ? colors.white : colors.grayDark,
              fontSize: '14px',
              fontWeight: 400,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {filter}
          </button>
        ))}
        
        <span style={{
          color: colors.gray,
          fontSize: '14px',
          marginLeft: '24px',
        }}>
          Найдено 12 проектов
        </span>
      </div>
      
      {/* Projects Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '32px',
      }}>
        {projects.map((project, index) => (
          <article key={index} style={{
            overflow: 'hidden',
            backgroundColor: colors.white,
            border: `1px solid ${colors.grayLight}`,
            cursor: 'pointer',
            transition: 'box-shadow 0.3s, transform 0.3s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)'
            e.currentTarget.style.transform = 'translateY(-4px)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = 'none'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
          >
            {/* Image */}
            <div style={{
              position: 'relative',
              height: '300px',
              overflow: 'hidden',
            }}>
              <img 
                src={project.image}
                alt={project.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transition: 'transform 0.5s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              />
              {project.badge && (
                <span style={{
                  position: 'absolute',
                  top: '20px',
                  left: '20px',
                  backgroundColor: project.badgeColor,
                  color: colors.white,
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.5px',
                }}>
                  {project.badge}
                </span>
              )}
            </div>
            
            {/* Info */}
            <div style={{ padding: '28px' }}>
              <h3 style={{
                fontSize: '22px',
                fontWeight: 500,
                color: colors.black,
                marginBottom: '12px',
              }}>
                {project.name}
              </h3>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                color: colors.gray,
                fontSize: '14px',
                marginBottom: '20px',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: colors.gold, fontSize: '8px' }}>●</span>
                  {project.location}
                </span>
                <span>
                  до метро {project.metro}
                </span>
              </div>
              
              <p style={{
                fontSize: '20px',
                fontWeight: 500,
                color: colors.black,
              }}>
                {project.price}
              </p>
            </div>
          </article>
        ))}
      </div>
      
      {/* Show more button */}
      <div style={{ textAlign: 'center', marginTop: '64px' }}>
        <a href="/projects" style={{
          display: 'inline-block',
          color: colors.black,
          textDecoration: 'none',
          fontSize: '14px',
          letterSpacing: '1px',
          padding: '16px 48px',
          border: `1px solid ${colors.grayLight}`,
          transition: 'all 0.3s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = colors.gold
          e.currentTarget.style.backgroundColor = 'rgba(210,159,102,0.05)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = colors.grayLight
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
        >
          Смотреть все проекты
        </a>
      </div>
      </div>
    </section>
  )
}

// ============ SERVICES SECTION ============
const ServicesSection: React.FC = () => {
  const services = [
    {
      title: 'Ипотека',
      description: 'Помогаем подобрать оптимальную программу кредитования от ведущих банков',
      link: '/mortgage',
    },
    {
      title: 'Trade-in',
      description: 'Обменяйте вашу квартиру на новую с доплатой или без',
      link: '/trade-in',
    },
    {
      title: 'Рассрочка',
      description: 'Гибкие условия оплаты без переплат на срок до 24 месяцев',
      link: '/installment',
    },
  ]
  
  return (
    <section style={{
      padding: '120px 80px',
      backgroundColor: colors.charcoal,
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <p style={{
          color: colors.gold,
          fontSize: '12px',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          marginBottom: '24px',
          textAlign: 'center',
        }}>
          Покупателям
        </p>
        
        <h2 style={{
          fontSize: '36px',
          fontWeight: 300,
          color: colors.white,
          textAlign: 'center',
          marginBottom: '80px',
          letterSpacing: '-0.5px',
        }}>
          Удобные способы приобретения
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '48px',
        }}>
          {services.map((service, index) => (
            <div key={index} style={{
              padding: '40px',
              borderTop: `1px solid rgba(255,255,255,0.15)`,
              transition: 'border-color 0.3s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = colors.gold}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
            >
              <h3 style={{
                fontSize: '24px',
                fontWeight: 400,
                color: colors.white,
                marginBottom: '16px',
              }}>
                {service.title}
              </h3>
              
              <p style={{
                fontSize: '15px',
                color: 'rgba(255,255,255,0.6)',
                lineHeight: 1.7,
                marginBottom: '24px',
              }}>
                {service.description}
              </p>
              
              <a href={service.link} style={{
                color: colors.gold,
                textDecoration: 'none',
                fontSize: '13px',
                letterSpacing: '1px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                Подробнее
                <span>→</span>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============ CONTACT SECTION ============
const ContactSection: React.FC = () => {
  return (
    <section style={{
      padding: '160px 80px',
      backgroundColor: colors.cream,
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '120px',
      }}>
        {/* Left */}
        <div>
          <p style={{
            color: colors.gold,
            fontSize: '12px',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            marginBottom: '24px',
          }}>
            Контакты
          </p>
          
          <h2 style={{
            fontSize: '36px',
            fontWeight: 300,
            color: colors.black,
            marginBottom: '48px',
            lineHeight: 1.4,
          }}>
            Мы всегда готовы ответить на ваши вопросы
          </h2>
          
          <div style={{ marginBottom: '40px' }}>
            <p style={{
              fontSize: '13px',
              color: colors.gray,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}>
              Телефон
            </p>
            <a href="tel:+998781501111" style={{
              fontSize: '24px',
              color: colors.black,
              textDecoration: 'none',
              fontWeight: 300,
            }}>
              +998 78 150 11 11
            </a>
          </div>
          
          <div style={{ marginBottom: '40px' }}>
            <p style={{
              fontSize: '13px',
              color: colors.gray,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}>
              Email
            </p>
            <a href="mailto:info@goldenhouse.uz" style={{
              fontSize: '18px',
              color: colors.black,
              textDecoration: 'none',
            }}>
              info@goldenhouse.uz
            </a>
          </div>
          
          <div>
            <p style={{
              fontSize: '13px',
              color: colors.gray,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}>
              Офис продаж
            </p>
            <p style={{
              fontSize: '16px',
              color: colors.black,
              lineHeight: 1.6,
            }}>
              г. Ташкент, ул. Амира Темура, 108<br />
              Пн–Пт: 9:00–19:00, Сб: 10:00–17:00
            </p>
          </div>
        </div>
        
        {/* Right - Contact Form */}
        <div style={{
          backgroundColor: colors.white,
          padding: '48px',
        }}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: 500,
            color: colors.black,
            marginBottom: '32px',
          }}>
            Записаться на консультацию
          </h3>
          
          <form>
            <div style={{ marginBottom: '24px' }}>
              <input 
                type="text"
                placeholder="Ваше имя"
                style={{
                  width: '100%',
                  padding: '16px 0',
                  border: 'none',
                  borderBottom: `1px solid ${colors.grayLight}`,
                  fontSize: '15px',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  transition: 'border-color 0.3s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = colors.gold}
                onBlur={e => e.currentTarget.style.borderColor = colors.grayLight}
              />
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <input 
                type="tel"
                placeholder="Телефон"
                style={{
                  width: '100%',
                  padding: '16px 0',
                  border: 'none',
                  borderBottom: `1px solid ${colors.grayLight}`,
                  fontSize: '15px',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  transition: 'border-color 0.3s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = colors.gold}
                onBlur={e => e.currentTarget.style.borderColor = colors.grayLight}
              />
            </div>
            
            <div style={{ marginBottom: '32px' }}>
              <select 
                style={{
                  width: '100%',
                  padding: '16px 0',
                  border: 'none',
                  borderBottom: `1px solid ${colors.grayLight}`,
                  fontSize: '15px',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  color: colors.gray,
                  cursor: 'pointer',
                }}
              >
                <option>Интересующий проект</option>
                <option>Golden Residence</option>
                <option>Golden Park</option>
                <option>Golden Tower</option>
              </select>
            </div>
            
            <button type="submit" style={{
              width: '100%',
              padding: '18px',
              backgroundColor: colors.black,
              color: colors.white,
              border: 'none',
              fontSize: '14px',
              letterSpacing: '1px',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.gold}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.black}
            >
              Отправить заявку
            </button>
            
            <p style={{
              fontSize: '12px',
              color: colors.gray,
              marginTop: '16px',
              lineHeight: 1.6,
            }}>
              Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
            </p>
          </form>
        </div>
      </div>
    </section>
  )
}

// ============ FOOTER ============
const Footer: React.FC = () => (
  <footer style={{
    backgroundColor: colors.black,
    padding: '80px 80px 40px',
  }}>
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      {/* Main */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr',
        gap: '64px',
        marginBottom: '64px',
      }}>
        {/* Brand */}
        <div>
          <div style={{
            fontSize: '18px',
            fontWeight: 600,
            color: colors.white,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            marginBottom: '24px',
          }}>
            Golden House
          </div>
          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '14px',
            lineHeight: 1.7,
          }}>
            Девелопер премиальной недвижимости в Узбекистане. 
            Создаём жилые пространства, которые вдохновляют.
          </p>
        </div>
        
        {/* Links */}
        {[
          { title: 'Проекты', links: ['Golden Residence', 'Golden Park', 'Golden Tower'] },
          { title: 'Компания', links: ['О нас', 'Новости', 'Карьера'] },
          { title: 'Покупателям', links: ['Ипотека', 'Trade-in', 'Рассрочка'] },
        ].map((col, index) => (
          <div key={index}>
            <h4 style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: '12px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginBottom: '24px',
            }}>
              {col.title}
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {col.links.map(link => (
                <li key={link} style={{ marginBottom: '12px' }}>
                  <a href="#" style={{
                    color: 'rgba(255,255,255,0.7)',
                    textDecoration: 'none',
                    fontSize: '14px',
                    transition: 'color 0.3s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = colors.white}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      
      {/* Bottom */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.1)',
        paddingTop: '32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <p style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: '13px',
        }}>
          © 2026 Golden House. Все права защищены.
        </p>
        
        <div style={{ display: 'flex', gap: '32px' }}>
          <a href="#" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: '13px' }}>
            Политика конфиденциальности
          </a>
          <a href="#" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: '13px' }}>
            Карта сайта
          </a>
        </div>
      </div>
    </div>
  </footer>
)

// ============ MAIN PAGE ============
export const GoldenHousePremium: React.FC = () => {
  return (
    <div style={{
      fontFamily: "'Muller', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: colors.black,
      lineHeight: 1.5,
    }}>
      <Header />
      <main>
        <HeroSection />
        <AboutSection />
        <ProjectsSection />
        <ServicesSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  )
}

export default GoldenHousePremium
