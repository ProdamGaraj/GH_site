/**
 * Golden House - Современная главная страница
 * Дизайн в стиле ПИК/Самолёт
 * Корпоративные цвета: Gold #D29F66, Black #403E3D, White #FFFFFF, Gray #B1B2B2
 */

import React, { useState } from 'react'

// ============ ЦВЕТА ============
const colors = {
  gold: '#D29F66',
  goldLight: '#E8D4BC',
  goldDark: '#B8864D',
  black: '#403E3D',
  white: '#FFFFFF',
  gray: '#B1B2B2',
  grayLight: '#F5F5F7',
  grayDark: '#6B6B6B',
  accent: '#D29F66', // Primary accent = gold
}

// ============ ИКОНКИ (SVG) ============
const Icons = {
  Fire: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 23C16.1421 23 19.5 19.6421 19.5 15.5C19.5 11.3579 12 1 12 1C12 1 4.5 11.3579 4.5 15.5C4.5 19.6421 7.85786 23 12 23Z" fill="currentColor"/>
    </svg>
  ),
  ArrowRight: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  ArrowLeft: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Location: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="4"/>
    </svg>
  ),
  Walk: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="5" r="2"/><path d="M12 7v6l3 3m-6-3l3 3"/>
    </svg>
  ),
  Phone: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  Menu: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
}

// ============ HEADER ============
const Header: React.FC = () => {
  const navItems = ['Квартиры', 'Коммерция', 'Ипотека', 'О компании', 'Контакты']
  
  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '72px',
      backgroundColor: colors.white,
      borderBottom: `1px solid ${colors.grayLight}`,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 48px',
    }}>
      {/* Logo */}
      <a href="/" style={{
        fontSize: '24px',
        fontWeight: 700,
        color: colors.gold,
        textDecoration: 'none',
        letterSpacing: '1px',
      }}>
        GOLDEN HOUSE
      </a>
      
      {/* Navigation */}
      <nav style={{ display: 'flex', gap: '32px' }}>
        {navItems.map(item => (
          <a key={item} href="#" style={{
            color: colors.black,
            textDecoration: 'none',
            fontSize: '15px',
            fontWeight: 500,
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = colors.gold}
          onMouseLeave={e => e.currentTarget.style.color = colors.black}
          >
            {item}
          </a>
        ))}
      </nav>
      
      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <a href="tel:+998781501111" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: colors.black,
          textDecoration: 'none',
          fontWeight: 500,
        }}>
          <Icons.Phone />
          +998 78 150-11-11
        </a>
        <button style={{
          backgroundColor: colors.gold,
          color: colors.white,
          border: 'none',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.goldDark}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.gold}
        >
          Заказать звонок
        </button>
      </div>
    </header>
  )
}

// ============ HERO PROMO SECTION ============
const HeroPromoSection: React.FC = () => {
  // Slider state - currently showing first promo, TODO: implement carousel
  // const [currentSlide, setCurrentSlide] = useState(0)
  
  return (
    <section style={{
      marginTop: '72px',
      padding: '24px 48px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '24px',
      maxWidth: '1440px',
      margin: '72px auto 0',
    }}>
      {/* Main Promo Card */}
      <div style={{
        backgroundColor: colors.gold,
        borderRadius: '24px',
        padding: '40px',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <span style={{
          display: 'inline-block',
          backgroundColor: 'rgba(255,255,255,0.2)',
          color: colors.white,
          padding: '6px 16px',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '24px',
          width: 'fit-content',
        }}>
          🔥 Акция
        </span>
        
        <h2 style={{
          color: colors.white,
          fontSize: '42px',
          fontWeight: 700,
          lineHeight: 1.1,
          marginBottom: '16px',
          whiteSpace: 'pre-line',
        }}>
          – 15% на квартиры{'\n'}к Новому году!
        </h2>
        
        <p style={{
          color: 'rgba(255,255,255,0.85)',
          fontSize: '16px',
          marginBottom: '8px',
        }}>
          Исполните мечту о переезде в новом году
        </p>
        
        <p style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: '14px',
          marginBottom: '24px',
        }}>
          Осталось квартир:
        </p>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '32px',
        }}>
          <span style={{ color: colors.white }}>🔥</span>
          <span style={{
            color: colors.white,
            fontSize: '48px',
            fontWeight: 700,
          }}>847</span>
        </div>
        
        <button style={{
          backgroundColor: colors.white,
          color: colors.gold,
          border: 'none',
          padding: '16px 32px',
          borderRadius: '12px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: 'pointer',
          width: 'fit-content',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          Выбрать квартиру
        </button>
        
        {/* Arrow button */}
        <button style={{
          position: 'absolute',
          right: '40px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.2)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.white,
        }}>
          <Icons.ArrowRight />
        </button>
      </div>
      
      {/* Right Slider Card */}
      <div style={{
        borderRadius: '24px',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '400px',
        backgroundImage: 'url(https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%)',
        }} />
        
        <div style={{
          position: 'relative',
          zIndex: 1,
          padding: '40px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <h2 style={{
            color: colors.white,
            fontSize: '36px',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: '12px',
          }}>
            Готовые квартиры{'\n'}с выгодой до $50 000
          </h2>
          
          <p style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: '16px',
            marginBottom: 'auto',
          }}>
            Только до 31 января!
          </p>
          
          <button style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            color: colors.white,
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '14px 28px',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 500,
            cursor: 'pointer',
            width: 'fit-content',
          }}>
            Подробнее
          </button>
        </div>
        
        {/* Slider controls */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          gap: '16px',
          width: '100%',
          justifyContent: 'space-between',
          padding: '0 16px',
          boxSizing: 'border-box',
        }}>
          <button style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: colors.white,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.black,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>
            <Icons.ArrowLeft />
          </button>
          <button style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: colors.white,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.black,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>
            <Icons.ArrowRight />
          </button>
        </div>
      </div>
    </section>
  )
}

// ============ SMALL PROMO CARDS ============
const SmallPromoCards: React.FC = () => {
  const cards = [
    {
      title: 'Акции\nи спецпредложения',
      subtitle: 'Ваши выгодные возможности: недвижимость, скидки, бонусы',
      image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400',
      bgColor: colors.white,
    },
    {
      title: 'Повышение цен\nс 19 января',
      subtitle: 'Бронируйте квартиру на выгодных условиях',
      image: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400',
      bgColor: colors.white,
    },
  ]
  
  return (
    <section style={{
      padding: '0 48px 24px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr 1fr',
      gap: '24px',
      maxWidth: '1440px',
      margin: '0 auto',
    }}>
      {/* Small promo cards */}
      {cards.map((card, index) => (
        <div key={index} style={{
          backgroundColor: colors.white,
          borderRadius: '20px',
          padding: '28px',
          border: `1px solid ${colors.grayLight}`,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '280px',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s, transform 0.2s',
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
          <h3 style={{
            fontSize: '22px',
            fontWeight: 600,
            color: colors.black,
            lineHeight: 1.3,
            marginBottom: '12px',
            whiteSpace: 'pre-line',
          }}>
            {card.title}
          </h3>
          <p style={{
            fontSize: '14px',
            color: colors.grayDark,
            marginBottom: 'auto',
          }}>
            {card.subtitle}
          </p>
          <img 
            src={card.image} 
            alt="" 
            style={{
              width: '120px',
              height: '120px',
              objectFit: 'cover',
              borderRadius: '16px',
              alignSelf: 'flex-end',
            }}
          />
        </div>
      ))}
      
      {/* Quarters promo */}
      <div style={{
        gridColumn: 'span 2',
        backgroundColor: colors.goldLight,
        borderRadius: '20px',
        padding: '28px',
        display: 'flex',
        gap: '24px',
        cursor: 'pointer',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.01)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <img 
          src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=300"
          alt=""
          style={{
            width: '200px',
            height: '200px',
            objectFit: 'cover',
            borderRadius: '16px',
          }}
        />
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: colors.black,
            marginBottom: '12px',
          }}>
            Кварталы для жизни
          </h3>
          <p style={{
            fontSize: '15px',
            color: colors.grayDark,
            marginBottom: '24px',
          }}>
            13 лет создаем комфортную инфраструктуру
          </p>
          <button style={{
            backgroundColor: colors.gold,
            color: colors.white,
            border: 'none',
            padding: '14px 28px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Узнать подробнее
          </button>
        </div>
      </div>
    </section>
  )
}

// ============ CATALOG SECTION ============
const CatalogSection: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('Все')
  const filters = ['Все', 'С ключами', 'Со скидкой', 'Бизнес-класс', 'Премиум']
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
      badgeColor: colors.black,
    },
    {
      name: 'Golden Plaza',
      location: 'Чиланзар',
      metro: '3 мин',
      price: 'от $65 000',
      image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600',
      badge: 'Скидка 10%',
      badgeColor: '#E53935',
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
    <section style={{
      padding: '64px 48px',
      maxWidth: '1440px',
      margin: '0 auto',
    }}>
      {/* Filter Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '32px',
        gap: '32px',
      }}>
        {/* Location filter */}
        <div>
          <label style={{ fontSize: '13px', color: colors.grayDark, marginBottom: '8px', display: 'block' }}>
            Выберите локацию
          </label>
          <select style={{
            padding: '14px 48px 14px 16px',
            border: `1px solid ${colors.grayLight}`,
            borderRadius: '12px',
            fontSize: '15px',
            minWidth: '280px',
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
          <label style={{ fontSize: '13px', color: colors.grayDark, marginBottom: '8px', display: 'block' }}>
            Задайте стоимость, $
          </label>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <input type="text" placeholder="от 50 000" style={{
              padding: '14px 16px',
              border: `1px solid ${colors.grayLight}`,
              borderRadius: '12px',
              fontSize: '15px',
              width: '120px',
            }} />
            <span style={{ color: colors.gray }}>—</span>
            <input type="text" placeholder="до 500 000" style={{
              padding: '14px 16px',
              border: `1px solid ${colors.grayLight}`,
              borderRadius: '12px',
              fontSize: '15px',
              width: '120px',
            }} />
          </div>
        </div>
        
        {/* Year filters */}
        <div>
          <label style={{ fontSize: '13px', color: colors.grayDark, marginBottom: '8px', display: 'block' }}>
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
                  borderRadius: '10px',
                  backgroundColor: activeYear === year ? colors.goldLight : colors.white,
                  color: colors.black,
                  fontSize: '14px',
                  fontWeight: 500,
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
        marginBottom: '32px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {filters.map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              padding: '10px 20px',
              border: `2px solid ${activeFilter === filter ? colors.gold : colors.grayLight}`,
              borderRadius: '24px',
              backgroundColor: activeFilter === filter ? colors.gold : colors.white,
              color: activeFilter === filter ? colors.white : colors.black,
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {filter}
          </button>
        ))}
        
        <span style={{
          color: colors.gold,
          fontSize: '14px',
          fontWeight: 500,
          marginLeft: '16px',
        }}>
          Найдено 12 проектов
        </span>
      </div>
      
      {/* Projects Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '24px',
      }}>
        {projects.map((project, index) => (
          <article key={index} style={{
            borderRadius: '20px',
            overflow: 'hidden',
            backgroundColor: colors.white,
            border: `1px solid ${colors.grayLight}`,
            cursor: 'pointer',
            transition: 'box-shadow 0.3s, transform 0.3s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.1)'
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
              height: '280px',
              overflow: 'hidden',
            }}>
              <img 
                src={project.image}
                alt={project.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              {project.badge && (
                <span style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  backgroundColor: project.badgeColor,
                  color: colors.white,
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}>
                  {project.badge}
                </span>
              )}
            </div>
            
            {/* Info */}
            <div style={{ padding: '24px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px',
              }}>
                <h3 style={{
                  fontSize: '22px',
                  fontWeight: 600,
                  color: colors.black,
                }}>
                  {project.name}
                </h3>
                <button style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.gray,
                  fontSize: '20px',
                }}>
                  •••
                </button>
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                color: colors.grayDark,
                fontSize: '14px',
                marginBottom: '16px',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: colors.gold }}>●</span>
                  {project.location}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🚶 {project.metro}
                </span>
              </div>
              
              <p style={{
                fontSize: '20px',
                fontWeight: 600,
                color: colors.black,
              }}>
                {project.price}
              </p>
            </div>
          </article>
        ))}
      </div>
      
      {/* Show more button */}
      <div style={{ textAlign: 'center', marginTop: '48px' }}>
        <button style={{
          backgroundColor: colors.grayLight,
          color: colors.black,
          border: 'none',
          padding: '16px 48px',
          borderRadius: '12px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.goldLight}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.grayLight}
        >
          Показать ещё
        </button>
      </div>
    </section>
  )
}

// ============ NEWS SECTION ============
const NewsSection: React.FC = () => {
  const news = [
    {
      title: 'Golden House открывает новый жилой комплекс в Юнусабаде',
      excerpt: 'Старт продаж нового проекта Golden Residence запланирован на февраль 2026 года.',
      date: '13 января 2026',
      featured: true,
    },
    {
      title: 'Итоги 2025 года: рекордные продажи и новые проекты',
      excerpt: 'В 2025 году компания ввела в эксплуатацию более 200 000 кв.м. жилой недвижимости.',
      date: '30 декабря 2025',
    },
    {
      title: 'Праздничный график работы офисов продаж',
      excerpt: 'С 31 декабря по 10 января офисы продаж работают по особому графику.',
      date: '26 декабря 2025',
    },
  ]
  
  return (
    <section style={{
      padding: '64px 48px',
      maxWidth: '1440px',
      margin: '0 auto',
    }}>
      <h2 style={{
        fontSize: '36px',
        fontWeight: 700,
        color: colors.black,
        marginBottom: '40px',
      }}>
        Новости
      </h2>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px',
      }}>
        {/* Featured news */}
        <div style={{
          backgroundColor: colors.gold,
          borderRadius: '24px',
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '320px',
          cursor: 'pointer',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.01)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <h3 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: colors.white,
            lineHeight: 1.3,
            marginBottom: '16px',
          }}>
            {news[0].title}
          </h3>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.8)',
            marginBottom: 'auto',
          }}>
            {news[0].excerpt}
          </p>
          <span style={{
            color: colors.goldLight,
            fontSize: '14px',
          }}>
            {news[0].date}
          </span>
        </div>
        
        {/* News sidebar */}
        <div style={{
          backgroundColor: colors.grayLight,
          borderRadius: '24px',
          padding: '32px',
        }}>
          <h3 style={{
            fontSize: '22px',
            fontWeight: 600,
            color: colors.black,
            marginBottom: '12px',
          }}>
            Новости компании
          </h3>
          <p style={{
            fontSize: '14px',
            color: colors.grayDark,
            marginBottom: '24px',
          }}>
            Главные события Golden House – читайте и будьте в курсе
          </p>
          <button style={{
            backgroundColor: colors.black,
            color: colors.white,
            border: 'none',
            padding: '14px 28px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Все новости
          </button>
        </div>
        
        {/* Other news */}
        {news.slice(1).map((item, index) => (
          <div key={index} style={{
            backgroundColor: colors.white,
            borderRadius: '20px',
            padding: '32px',
            border: `1px solid ${colors.grayLight}`,
            cursor: 'pointer',
            transition: 'box-shadow 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <h4 style={{
              fontSize: '20px',
              fontWeight: 600,
              color: colors.black,
              marginBottom: '12px',
              lineHeight: 1.4,
            }}>
              {item.title}
            </h4>
            <p style={{
              fontSize: '14px',
              color: colors.grayDark,
              marginBottom: '16px',
            }}>
              {item.excerpt}
            </p>
            <span style={{
              color: colors.gray,
              fontSize: '13px',
            }}>
              {item.date}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ============ FOOTER ============
const Footer: React.FC = () => (
  <footer style={{
    backgroundColor: colors.black,
    color: colors.white,
    padding: '64px 48px 32px',
  }}>
    <div style={{
      maxWidth: '1440px',
      margin: '0 auto',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '48px',
        marginBottom: '48px',
      }}>
        {/* Logo & Contact */}
        <div>
          <div style={{
            fontSize: '24px',
            fontWeight: 700,
            color: colors.gold,
            marginBottom: '24px',
          }}>
            GOLDEN HOUSE
          </div>
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '14px',
            lineHeight: 1.6,
            marginBottom: '16px',
          }}>
            Строим качественное жильё с 2012 года. Более 500 000 м² сданной недвижимости.
          </p>
          <a href="tel:+998781501111" style={{
            color: colors.white,
            fontSize: '20px',
            fontWeight: 600,
            textDecoration: 'none',
          }}>
            +998 78 150-11-11
          </a>
        </div>
        
        {/* Navigation columns */}
        {[
          { title: 'Покупателям', links: ['Квартиры', 'Коммерция', 'Ипотека', 'Акции'] },
          { title: 'Компания', links: ['О нас', 'Проекты', 'Новости', 'Контакты'] },
          { title: 'Документы', links: ['Политика конфиденциальности', 'Договор оферты', 'Реквизиты'] },
        ].map((col, index) => (
          <div key={index}>
            <h4 style={{
              color: colors.white,
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '20px',
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
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = colors.gold}
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
        paddingTop: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <p style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '13px',
        }}>
          © 2026 Golden House. Все права защищены.
        </p>
        <div style={{ display: 'flex', gap: '16px' }}>
          {['Instagram', 'Telegram', 'Facebook'].map(social => (
            <a key={social} href="#" style={{
              color: 'rgba(255,255,255,0.5)',
              textDecoration: 'none',
              fontSize: '13px',
            }}>
              {social}
            </a>
          ))}
        </div>
      </div>
    </div>
  </footer>
)

// ============ MAIN PAGE ============
export const GoldenHouseModern: React.FC = () => {
  return (
    <div style={{
      fontFamily: "'Muller', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      backgroundColor: colors.grayLight,
      minHeight: '100vh',
    }}>
      <Header />
      <main>
        <HeroPromoSection />
        <SmallPromoCards />
        <CatalogSection />
        <NewsSection />
      </main>
      <Footer />
    </div>
  )
}

export default GoldenHouseModern
