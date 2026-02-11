/**
 * Mock Data Controller
 * Предоставляет тестовые данные для Template блоков
 */

import { Request, Response } from 'express'

export class MockDataController {
  /**
   * GET /api/mock/projects
   * Возвращает список проектов Golden House
   */
  async getProjects(req: Request, res: Response) {
    try {
      const projects = [
        {
          id: 1,
          title: 'Golden Residence',
          subtitle: 'Премиальный жилой комплекс',
          description: 'Современный жилой комплекс с развитой инфраструктурой в престижном районе Ташкента',
          price: 'от $150,000',
          pricePerSqm: '$1,200/м²',
          location: 'Ташкент, район Мирзо-Улугбек',
          area: '65-180 м²',
          rooms: '1-4 комнаты',
          completion: '2024 Q4',
          image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600',
          features: ['Паркинг', 'Детская площадка', 'Фитнес-центр', 'Консьерж'],
          status: 'available'
        },
        {
          id: 2,
          title: 'Golden Park',
          subtitle: 'Современные апартаменты',
          description: 'Уютный комплекс с зелеными зонами и европейской планировкой',
          price: 'от $120,000',
          pricePerSqm: '$1,000/м²',
          location: 'Ташкент, Юнусабадский район',
          area: '45-120 м²',
          rooms: '1-3 комнаты',
          completion: '2025 Q2',
          image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600',
          features: ['Парковая зона', 'Охрана 24/7', 'Торговый центр', 'Школа'],
          status: 'available'
        },
        {
          id: 3,
          title: 'Golden Tower',
          subtitle: 'Элитная высотка в центре',
          description: 'Премиальные апартаменты с панорамным видом на город',
          price: 'от $200,000',
          pricePerSqm: '$1,500/м²',
          location: 'Ташкент, центр города',
          area: '80-250 м²',
          rooms: '2-5 комнат',
          completion: '2024 Q3',
          image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600',
          features: ['Панорамные окна', 'SPA-центр', 'Ресторан', 'Бассейн на крыше'],
          status: 'selling-fast'
        },
        {
          id: 4,
          title: 'Golden Plaza',
          subtitle: 'Бизнес-класс у метро',
          description: 'Выгодное расположение с отличной транспортной доступностью',
          price: 'от $100,000',
          pricePerSqm: '$900/м²',
          location: 'Ташкент, станция метро "Буюк Ипак Йули"',
          area: '40-100 м²',
          rooms: '1-2 комнаты',
          completion: '2025 Q4',
          image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600',
          features: ['Метро 2 минуты', 'Офисы', 'Кафе', 'Магазины'],
          status: 'pre-sale'
        },
        {
          id: 5,
          title: 'Golden Gardens',
          subtitle: 'Жизнь за городом',
          description: 'Таунхаусы и виллы в экологически чистом районе',
          price: 'от $180,000',
          pricePerSqm: '$1,100/м²',
          location: 'Ташкентская область, Зангиатинский район',
          area: '120-300 м²',
          rooms: '3-6 комнат',
          completion: '2025 Q3',
          image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600',
          features: ['Собственный двор', 'Бассейн', 'Барбекю зона', 'Сад'],
          status: 'available'
        }
      ]

      res.json({
        success: true,
        data: projects,
        total: projects.length
      })
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * GET /api/mock/projects/:id
   * Возвращает один проект по ID
   */
  async getProjectById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const projects = await this.getAllProjectsData()
      const project = projects.find(p => p.id === parseInt(id))

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        })
      }

      res.json({
        success: true,
        data: project
      })
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * GET /api/mock/news
   * Возвращает список новостей
   */
  async getNews(req: Request, res: Response) {
    try {
      const news = [
        {
          id: 1,
          title: 'Открытие нового жилого комплекса Golden Residence',
          excerpt: 'Компания Golden House рада объявить об официальном открытии продаж в новом премиальном комплексе',
          content: 'Полный текст новости...',
          date: '2024-01-15',
          image: '/images/news/news-1.jpg',
          category: 'Новости компании'
        },
        {
          id: 2,
          title: 'Успешная сдача первой очереди Golden Tower',
          excerpt: 'Все квартиры первой очереди переданы новым владельцам с опережением графика',
          content: 'Полный текст новости...',
          date: '2024-01-10',
          image: '/images/news/news-2.jpg',
          category: 'Сдача объектов'
        },
        {
          id: 3,
          title: 'Старт продаж таунхаусов Golden Gardens',
          excerpt: 'Открыт прием бронирований на эксклюзивные таунхаусы с собственным садом',
          content: 'Полный текст новости...',
          date: '2024-01-05',
          image: '/images/news/news-3.jpg',
          category: 'Новости компании'
        }
      ]

      res.json({
        success: true,
        data: news,
        total: news.length
      })
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * GET /api/mock/team
   * Возвращает список команды
   */
  async getTeam(req: Request, res: Response) {
    try {
      const team = [
        {
          id: 1,
          name: 'Алексей Иванов',
          position: 'Генеральный директор',
          bio: 'Опыт в девелопменте более 15 лет',
          photo: '/images/team/ceo.jpg',
          email: 'ivanov@goldenhouse.uz',
          phone: '+998 71 123-45-67'
        },
        {
          id: 2,
          name: 'Мария Петрова',
          position: 'Коммерческий директор',
          bio: 'Специалист по продажам премиальной недвижимости',
          photo: '/images/team/commercial.jpg',
          email: 'petrova@goldenhouse.uz',
          phone: '+998 71 123-45-68'
        },
        {
          id: 3,
          name: 'Сергей Козлов',
          position: 'Технический директор',
          bio: 'Более 20 лет в строительстве',
          photo: '/images/team/technical.jpg',
          email: 'kozlov@goldenhouse.uz',
          phone: '+998 71 123-45-69'
        }
      ]

      res.json({
        success: true,
        data: team,
        total: team.length
      })
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Вспомогательный метод для получения всех проектов
   */
  private async getAllProjectsData() {
    return [
      {
        id: 1,
        title: 'Golden Residence',
        subtitle: 'Премиальный жилой комплекс',
        description: 'Современный жилой комплекс с развитой инфраструктурой',
        price: 'от $150,000',
        location: 'Ташкент, район Мирзо-Улугбек',
        image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600'
      },
      {
        id: 2,
        title: 'Golden Park',
        subtitle: 'Современные апартаменты',
        description: 'Уютный комплекс с зелеными зонами',
        price: 'от $120,000',
        location: 'Ташкент, Юнусабадский район',
        image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600'
      }
    ]
  }
}

export const mockDataController = new MockDataController()
