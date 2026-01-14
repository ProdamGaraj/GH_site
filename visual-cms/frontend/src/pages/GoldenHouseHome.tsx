import React, { useState } from 'react'
import { 
  Phone, 
  Menu, 
  X, 
  MapPin, 
  Clock, 
  Mail, 
  ChevronRight,
  Building2,
  Users,
  Award,
  Home,
  Shield,
  Star,
  ArrowRight,
  Facebook,
  Instagram,
  Youtube,
  Send
} from 'lucide-react'

// ========== HEADER COMPONENT ==========
const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navItems = [
    { label: 'Квартиры', href: '/projects' },
    { label: 'Коммерция', href: '/commercial' },
    { label: 'Ипотека', href: '/ipoteka' },
    { label: 'О компании', href: '/company' },
    { label: 'Новости', href: '/news' },
    { label: 'Контакты', href: '/contacts' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gh-black/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <div className="text-gh-gold font-muller font-bold text-2xl tracking-wider">
              GOLDEN HOUSE
            </div>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-white/90 hover:text-gh-gold transition-colors font-muller text-sm uppercase tracking-wide"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Phone & CTA */}
          <div className="hidden lg:flex items-center gap-6">
            <a 
              href="tel:+998781501111" 
              className="flex items-center gap-2 text-white hover:text-gh-gold transition-colors"
            >
              <Phone size={18} className="text-gh-gold" />
              <span className="font-muller font-medium">+998 78 150-11-11</span>
            </a>
            <button className="bg-gh-gold hover:bg-gh-gold-dark text-white px-6 py-2.5 rounded font-muller font-medium transition-colors uppercase text-sm tracking-wide">
              Перезвоните мне
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="lg:hidden text-white p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden bg-gh-black border-t border-white/10">
          <nav className="px-4 py-6 space-y-4">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="block text-white/90 hover:text-gh-gold transition-colors font-muller text-base py-2"
              >
                {item.label}
              </a>
            ))}
            <div className="pt-4 border-t border-white/10">
              <a href="tel:+998781501111" className="flex items-center gap-2 text-gh-gold font-muller font-medium">
                <Phone size={18} />
                +998 78 150-11-11
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

// ========== HERO SECTION ==========
const HeroSection: React.FC = () => {
  return (
    <section className="relative min-h-screen flex items-center bg-gh-black pt-20">
      {/* Background Image Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-gh-black via-gh-black/80 to-gh-black/40"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-2xl">
          <p className="text-gh-gold font-muller uppercase tracking-widest mb-4 text-sm">
            Национальный лидер рынка недвижимости
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-muller font-bold text-white leading-tight mb-6">
            Golden House — <br />
            <span className="text-gh-gold">искусство создавать</span>
          </h1>
          <p className="text-lg text-white/80 font-muller mb-8 leading-relaxed">
            Вся наша команда работает для того, чтобы отразить вашу индивидуальность 
            в месте, где вы проводите половину своего времени
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <a 
              href="/projects" 
              className="inline-flex items-center justify-center gap-2 bg-gh-gold hover:bg-gh-gold-dark text-white px-8 py-4 rounded font-muller font-medium transition-colors uppercase tracking-wide"
            >
              Смотреть проекты
              <ArrowRight size={20} />
            </a>
            <a 
              href="/company" 
              className="inline-flex items-center justify-center gap-2 border-2 border-white/30 hover:border-gh-gold text-white px-8 py-4 rounded font-muller font-medium transition-colors uppercase tracking-wide"
            >
              О компании
            </a>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-8 h-12 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
          <div className="w-1.5 h-3 bg-gh-gold rounded-full"></div>
        </div>
      </div>
    </section>
  )
}

// ========== STATS SECTION ==========
const StatsSection: React.FC = () => {
  const stats = [
    { number: '13+', label: 'лет', description: 'на рынке недвижимости Узбекистана' },
    { number: '2', label: 'млн м²', description: 'недвижимости в продаже' },
    { number: '25', label: 'объектов', description: 'в реализации в Ташкентской области' },
    { number: '30', label: 'тысяч', description: 'человек проживает в наших домах' },
  ]

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-4xl lg:text-5xl font-muller font-bold text-gh-gold">
                  {stat.number}
                </span>
                <span className="text-lg font-muller text-gh-gray">
                  {stat.label}
                </span>
              </div>
              <p className="text-gh-black/70 font-muller text-sm">
                {stat.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ========== ABOUT SECTION ==========
const AboutSection: React.FC = () => {
  return (
    <section className="py-20 bg-gh-gray-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-gh-gold font-muller uppercase tracking-widest mb-4 text-sm">
              О компании
            </p>
            <h2 className="text-3xl lg:text-4xl font-muller font-bold text-gh-black mb-6">
              Уже более 13 лет <br />на рынке Узбекистана
            </h2>
            <div className="space-y-4 text-gh-black/70 font-muller leading-relaxed">
              <p>
                За годы работы компания приобрела огромный опыт в девелопменте, 
                что позволило занять одну из лидирующих позиций на рынке недвижимости.
              </p>
              <p>
                На сегодняшний день компания осуществляет весь цикл девелопмента, 
                реализовывая строительство во всех сегментах рынка — жильё класса комфорт, 
                проекты классов бизнес и премиум, а также коммерческая недвижимость.
              </p>
              <p>
                Развивая регион, Golden House стремится не только сохранить лидирующие 
                позиции на рынке недвижимости Узбекистана, но и быть главным новатором.
              </p>
            </div>
            <a 
              href="/company" 
              className="inline-flex items-center gap-2 text-gh-gold font-muller font-medium mt-6 hover:gap-3 transition-all"
            >
              Подробнее о компании
              <ChevronRight size={20} />
            </a>
          </div>
          
          <div className="relative">
            <img 
              src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?ixlib=rb-4.0.3&auto=format&fit=crop&w=735&q=80"
              alt="Golden House Building"
              className="w-full h-[500px] object-cover rounded-lg shadow-2xl"
            />
            <div className="absolute -bottom-6 -left-6 bg-gh-gold p-6 rounded-lg shadow-xl">
              <Award size={48} className="text-white mb-2" />
              <p className="text-white font-muller font-bold text-lg">9 наград</p>
              <p className="text-white/80 font-muller text-sm">Asia Pacific Property Awards</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ========== PROJECTS SECTION ==========
const ProjectsSection: React.FC = () => {
  const projects = [
    {
      name: 'INFINITY Клубный дом',
      class: 'Премиум класс',
      image: 'https://images.unsplash.com/photo-1515263487990-61b07816b324?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
      href: '/infinity',
    },
    {
      name: "O'Z Mahal",
      class: 'Бизнес класс',
      image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
      href: '/oz-mahal',
    },
    {
      name: "O'Z Zamin",
      class: 'Комфорт+ класс',
      image: 'https://images.unsplash.com/photo-1567684014761-b65e2e59b9eb?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
      href: '/oz-zamin',
    },
    {
      name: "Assalom Sohil",
      class: 'Комфорт класс',
      image: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1484&q=80',
      href: '/assalom-sohil',
    },
  ]

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-12">
          <div>
            <p className="text-gh-gold font-muller uppercase tracking-widest mb-2 text-sm">
              Жилые комплексы
            </p>
            <h2 className="text-3xl lg:text-4xl font-muller font-bold text-gh-black">
              Наши проекты
            </h2>
          </div>
          <a 
            href="/projects" 
            className="inline-flex items-center gap-2 bg-gh-black hover:bg-gh-gold text-white px-6 py-3 rounded font-muller font-medium transition-colors uppercase text-sm tracking-wide"
          >
            Все проекты
            <ArrowRight size={18} />
          </a>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {projects.map((project, index) => (
            <a 
              key={index} 
              href={project.href}
              className="group relative overflow-hidden rounded-lg aspect-[3/4]"
            >
              <img 
                src={project.image}
                alt={project.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gh-black via-gh-black/20 to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-gh-gold font-muller text-sm mb-1">{project.class}</p>
                <h3 className="text-white font-muller font-bold text-xl">{project.name}</h3>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

// ========== ADVANTAGES SECTION ==========
const AdvantagesSection: React.FC = () => {
  const advantages = [
    {
      icon: Shield,
      title: 'Надёжность',
      description: '15 лет безупречной репутации и доверия клиентов',
    },
    {
      icon: Star,
      title: 'Качество',
      description: 'Международные стандарты строительства и материалов',
    },
    {
      icon: Users,
      title: 'Прозрачность',
      description: 'Открытые отношения с клиентами и партнёрами',
    },
    {
      icon: Building2,
      title: 'Опыт',
      description: 'Сотрудничество с международными архитекторами',
    },
    {
      icon: Home,
      title: 'Комфорт',
      description: 'Жилые комплексы от комфорт до премиум класса',
    },
    {
      icon: Award,
      title: 'Признание',
      description: '9 наград Asia Pacific Property Awards',
    },
  ]

  return (
    <section className="py-20 bg-gh-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-gh-gold font-muller uppercase tracking-widest mb-4 text-sm">
            Почему выбирают нас
          </p>
          <h2 className="text-3xl lg:text-4xl font-muller font-bold text-white">
            Наши преимущества
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {advantages.map((item, index) => (
            <div 
              key={index}
              className="bg-white/5 border border-white/10 rounded-lg p-8 hover:bg-white/10 transition-colors"
            >
              <item.icon size={48} className="text-gh-gold mb-4" />
              <h3 className="text-white font-muller font-bold text-xl mb-2">{item.title}</h3>
              <p className="text-white/60 font-muller">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ========== CTA SECTION ==========
const CTASection: React.FC = () => {
  return (
    <section className="py-20 bg-gh-gold">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl lg:text-4xl font-muller font-bold text-white mb-4">
              Готовы выбрать свой идеальный дом?
            </h2>
            <p className="text-white/80 font-muller text-lg">
              Свяжитесь с нами для консультации и подбора квартиры
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <a 
              href="tel:+998781501111" 
              className="inline-flex items-center justify-center gap-2 bg-white text-gh-black px-8 py-4 rounded font-muller font-bold transition-colors hover:bg-gh-gray-light uppercase tracking-wide"
            >
              <Phone size={20} />
              +998 78 150-11-11
            </a>
            <button className="inline-flex items-center justify-center gap-2 bg-gh-black text-white px-8 py-4 rounded font-muller font-medium transition-colors hover:bg-gh-black/80 uppercase tracking-wide">
              Оставить заявку
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ========== CONTACT FORM SECTION ==========
const ContactFormSection: React.FC = () => {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div>
            <p className="text-gh-gold font-muller uppercase tracking-widest mb-4 text-sm">
              Контакты
            </p>
            <h2 className="text-3xl lg:text-4xl font-muller font-bold text-gh-black mb-8">
              Свяжитесь с нами
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gh-gold/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="text-gh-gold" size={24} />
                </div>
                <div>
                  <h3 className="font-muller font-bold text-gh-black mb-1">Адрес</h3>
                  <p className="text-gh-black/70 font-muller">
                    Яшнабадский район, 5-й пр-д Садыка Азимова, <br />
                    бизнес-центр «Infinity»
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gh-gold/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone className="text-gh-gold" size={24} />
                </div>
                <div>
                  <h3 className="font-muller font-bold text-gh-black mb-1">Телефон</h3>
                  <a href="tel:+998781501111" className="text-gh-gold font-muller font-medium hover:underline">
                    +998 78 150-11-11
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gh-gold/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="text-gh-gold" size={24} />
                </div>
                <div>
                  <h3 className="font-muller font-bold text-gh-black mb-1">Время работы</h3>
                  <p className="text-gh-black/70 font-muller">
                    Пн-Пт: с 9:00 до 18:00<br />
                    Сб-Вс: Выходные
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gh-gold/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="text-gh-gold" size={24} />
                </div>
                <div>
                  <h3 className="font-muller font-bold text-gh-black mb-1">Email</h3>
                  <a href="mailto:info@gh.uz" className="text-gh-gold font-muller font-medium hover:underline">
                    info@gh.uz
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-gh-gray-light rounded-lg p-8">
            <h3 className="text-2xl font-muller font-bold text-gh-black mb-6">
              Оставить заявку
            </h3>
            <form className="space-y-4">
              <div>
                <label className="block text-gh-black/70 font-muller text-sm mb-2">
                  Ваше имя
                </label>
                <input 
                  type="text"
                  className="w-full px-4 py-3 rounded border border-gh-gray/30 focus:border-gh-gold focus:outline-none font-muller"
                  placeholder="Введите ваше имя"
                />
              </div>
              <div>
                <label className="block text-gh-black/70 font-muller text-sm mb-2">
                  Номер телефона
                </label>
                <input 
                  type="tel"
                  className="w-full px-4 py-3 rounded border border-gh-gray/30 focus:border-gh-gold focus:outline-none font-muller"
                  placeholder="+998"
                />
              </div>
              <div>
                <label className="block text-gh-black/70 font-muller text-sm mb-2">
                  Интересующий проект
                </label>
                <select className="w-full px-4 py-3 rounded border border-gh-gray/30 focus:border-gh-gold focus:outline-none font-muller bg-white">
                  <option>Выберите проект</option>
                  <option>INFINITY Клубный дом</option>
                  <option>O'Z Mahal</option>
                  <option>O'Z Zamin</option>
                  <option>Assalom Sohil</option>
                  <option>Assalom Havo</option>
                </select>
              </div>
              <div>
                <label className="block text-gh-black/70 font-muller text-sm mb-2">
                  Сообщение
                </label>
                <textarea 
                  rows={4}
                  className="w-full px-4 py-3 rounded border border-gh-gray/30 focus:border-gh-gold focus:outline-none font-muller resize-none"
                  placeholder="Ваше сообщение"
                ></textarea>
              </div>
              <button 
                type="submit"
                className="w-full bg-gh-gold hover:bg-gh-gold-dark text-white py-4 rounded font-muller font-medium transition-colors uppercase tracking-wide"
              >
                Отправить заявку
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}

// ========== FOOTER ==========
const Footer: React.FC = () => {
  const complexes = [
    'INFINITY Клубный дом',
    "O'Z Zamin",
    "O'Z Mahal",
    "O'Z Makon Business",
    "Assalom Bog'lar",
    "Assalom Sohil",
    "Assalom Havo",
  ]

  const links = [
    { label: 'Квартиры', href: '/projects' },
    { label: 'Коммерция', href: '/commercial' },
    { label: 'Ипотека', href: '/ipoteka' },
    { label: 'О компании', href: '/company' },
    { label: 'Вакансии', href: '/vacancies' },
    { label: 'Новости', href: '/news' },
    { label: 'Контакты', href: '/contacts' },
  ]

  return (
    <footer className="bg-gh-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Logo & Description */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="text-gh-gold font-muller font-bold text-2xl tracking-wider mb-4">
              GOLDEN HOUSE
            </div>
            <p className="text-white/60 font-muller mb-6">
              Национальный лидер и первопроходец рынка новостроек Узбекистана
            </p>
            <div className="flex gap-4">
              <a href="https://facebook.com/goldenhouseuz" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-gh-gold transition-colors">
                <Facebook size={20} />
              </a>
              <a href="https://instagram.com/goldenhouseuz" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-gh-gold transition-colors">
                <Instagram size={20} />
              </a>
              <a href="https://youtube.com/goldenhouseuz" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-gh-gold transition-colors">
                <Youtube size={20} />
              </a>
              <a href="https://t.me/goldenhouseuz" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-gh-gold transition-colors">
                <Send size={20} />
              </a>
            </div>
          </div>

          {/* Projects */}
          <div>
            <h4 className="font-muller font-bold text-lg mb-4">Жилые комплексы</h4>
            <ul className="space-y-2">
              {complexes.map((name) => (
                <li key={name}>
                  <a href="#" className="text-white/60 hover:text-gh-gold font-muller text-sm transition-colors">
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-muller font-bold text-lg mb-4">Навигация</h4>
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-white/60 hover:text-gh-gold font-muller text-sm transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-muller font-bold text-lg mb-4">Контакты</h4>
            <div className="space-y-4">
              <div>
                <p className="text-white/60 font-muller text-sm mb-1">Телефон</p>
                <a href="tel:+998781501111" className="text-gh-gold font-muller font-medium">
                  +998 78 150-11-11
                </a>
              </div>
              <div>
                <p className="text-white/60 font-muller text-sm mb-1">Адрес</p>
                <p className="text-white/80 font-muller text-sm">
                  Яшнабадский район, 5-й пр-д Садыка Азимова, бизнес-центр «Infinity»
                </p>
              </div>
              <div>
                <p className="text-white/60 font-muller text-sm mb-1">Время работы</p>
                <p className="text-white/80 font-muller text-sm">
                  Пн-Пт: с 9:00 до 18:00
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-white/40 font-muller text-sm text-center">
              © 2024 ООО «Golden House Development». Все права защищены.
            </p>
            <div className="flex gap-6">
              <a href="/privacy" className="text-white/40 hover:text-white/60 font-muller text-sm transition-colors">
                Политика конфиденциальности
              </a>
              <a href="/terms" className="text-white/40 hover:text-white/60 font-muller text-sm transition-colors">
                Пользовательское соглашение
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ========== MAIN PAGE COMPONENT ==========
export const GoldenHouseHome: React.FC = () => {
  return (
    <div className="min-h-screen bg-white font-muller">
      <Header />
      <main>
        <HeroSection />
        <StatsSection />
        <AboutSection />
        <ProjectsSection />
        <AdvantagesSection />
        <CTASection />
        <ContactFormSection />
      </main>
      <Footer />
    </div>
  )
}

export default GoldenHouseHome
