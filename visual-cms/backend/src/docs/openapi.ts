/**
 * OpenAPI/Swagger Documentation
 * 
 * Полная спецификация API для Visual CMS
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Visual CMS API',
    description: `
# Visual CMS API Documentation

REST API для визуального конструктора сайтов.

## Основные возможности

- **Pages** - Управление страницами сайта
- **Blocks** - Управление блоками и компонентами
- **Groups** - Группировка блоков
- **Variables** - Реактивные переменные страниц
- **Data Sources** - Источники данных для биндинга
- **Data Bindings** - Привязка данных к элементам
- **Deploy** - Публикация и деплой страниц

## Аутентификация

API поддерживает JWT аутентификацию. Получите токен через \`/api/auth/login\` 
и передавайте его в заголовке \`Authorization: Bearer <token>\`.

## Rate Limiting

API имеет ограничение 100 запросов в минуту на IP адрес.
    `,
    version: '1.0.0',
    contact: {
      name: 'API Support',
      email: 'support@visualcms.dev',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:5000/api',
      description: 'Development server',
    },
    {
      url: 'https://api.visualcms.dev/api',
      description: 'Production server',
    },
  ],
  tags: [
    { name: 'Pages', description: 'Управление страницами' },
    { name: 'Blocks', description: 'Управление блоками' },
    { name: 'Groups', description: 'Управление группами' },
    { name: 'Variables', description: 'Реактивные переменные' },
    { name: 'Data Sources', description: 'Источники данных' },
    { name: 'Data Bindings', description: 'Привязка данных' },
    { name: 'Deploy', description: 'Публикация страниц' },
    { name: 'Health', description: 'Статус сервера' },
  ],
  paths: {
    // ==================== PAGES ====================
    '/pages': {
      get: {
        tags: ['Pages'],
        summary: 'Получить список страниц',
        description: 'Возвращает список всех страниц с пагинацией',
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['draft', 'published', 'archived'] },
            description: 'Фильтр по статусу',
          },
        ],
        responses: {
          200: {
            description: 'Список страниц',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Page' },
                },
              },
            },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      post: {
        tags: ['Pages'],
        summary: 'Создать страницу',
        description: 'Создает новую страницу',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PageCreate' },
            },
          },
        },
        responses: {
          201: {
            description: 'Страница создана',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Page' },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          409: { $ref: '#/components/responses/ConflictError' },
        },
      },
    },
    '/pages/{id}': {
      get: {
        tags: ['Pages'],
        summary: 'Получить страницу',
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          200: {
            description: 'Данные страницы',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Page' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFoundError' },
        },
      },
      put: {
        tags: ['Pages'],
        summary: 'Обновить страницу',
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PageUpdate' },
            },
          },
        },
        responses: {
          200: {
            description: 'Страница обновлена',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Page' },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          404: { $ref: '#/components/responses/NotFoundError' },
        },
      },
      delete: {
        tags: ['Pages'],
        summary: 'Удалить страницу',
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          200: { description: 'Страница удалена' },
          404: { $ref: '#/components/responses/NotFoundError' },
        },
      },
    },

    // ==================== BLOCKS ====================
    '/blocks': {
      get: {
        tags: ['Blocks'],
        summary: 'Получить список блоков',
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          {
            name: 'isReusable',
            in: 'query',
            schema: { type: 'boolean' },
            description: 'Фильтр по переиспользуемости',
          },
        ],
        responses: {
          200: {
            description: 'Список блоков',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Block' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Blocks'],
        summary: 'Создать блок',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BlockCreate' },
            },
          },
        },
        responses: {
          201: {
            description: 'Блок создан',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Block' },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/blocks/{id}': {
      get: {
        tags: ['Blocks'],
        summary: 'Получить блок',
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          200: {
            description: 'Данные блока',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Block' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFoundError' },
        },
      },
      put: {
        tags: ['Blocks'],
        summary: 'Обновить блок',
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BlockUpdate' },
            },
          },
        },
        responses: {
          200: {
            description: 'Блок обновлен',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Block' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFoundError' },
        },
      },
      delete: {
        tags: ['Blocks'],
        summary: 'Удалить блок',
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          200: { description: 'Блок удален' },
          404: { $ref: '#/components/responses/NotFoundError' },
        },
      },
    },

    // ==================== VARIABLES ====================
    '/variables': {
      get: {
        tags: ['Variables'],
        summary: 'Получить все переменные',
        description: 'Возвращает переменные сгруппированные по scope',
        parameters: [
          {
            name: 'scope',
            in: 'query',
            schema: { type: 'string', enum: ['page', 'session', 'global'] },
            description: 'Фильтр по scope',
          },
        ],
        responses: {
          200: {
            description: 'Список переменных',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        page: { type: 'array', items: { $ref: '#/components/schemas/Variable' } },
                        session: { type: 'array', items: { $ref: '#/components/schemas/Variable' } },
                        global: { type: 'array', items: { $ref: '#/components/schemas/Variable' } },
                      },
                    },
                    count: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Variables'],
        summary: 'Создать переменную',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/VariableCreate' },
            },
          },
        },
        responses: {
          201: {
            description: 'Переменная создана',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Variable' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/variables/page/{pageId}': {
      get: {
        tags: ['Variables'],
        summary: 'Получить переменные страницы',
        parameters: [
          {
            name: 'pageId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'includeGlobal',
            in: 'query',
            schema: { type: 'boolean' },
            description: 'Включить глобальные переменные',
          },
        ],
        responses: {
          200: {
            description: 'Переменные страницы',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Variable' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/variables/{id}': {
      get: {
        tags: ['Variables'],
        summary: 'Получить переменную',
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          200: {
            description: 'Данные переменной',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Variable' },
                  },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFoundError' },
        },
      },
      put: {
        tags: ['Variables'],
        summary: 'Обновить переменную',
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/VariableUpdate' },
            },
          },
        },
        responses: {
          200: { description: 'Переменная обновлена' },
          404: { $ref: '#/components/responses/NotFoundError' },
        },
      },
      delete: {
        tags: ['Variables'],
        summary: 'Удалить переменную',
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          200: { description: 'Переменная удалена' },
          404: { $ref: '#/components/responses/NotFoundError' },
        },
      },
    },
    '/variables/bulk': {
      post: {
        tags: ['Variables'],
        summary: 'Создать несколько переменных',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  variables: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/VariableCreate' },
                  },
                },
                required: ['variables'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Переменные созданы' },
          400: { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/variables/{id}/validate': {
      post: {
        tags: ['Variables'],
        summary: 'Валидировать значение переменной',
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  value: {},
                },
                required: ['value'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Результат валидации',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    valid: { type: 'boolean' },
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ==================== DATA SOURCES ====================
    '/data-sources': {
      get: {
        tags: ['Data Sources'],
        summary: 'Получить источники данных',
        responses: {
          200: {
            description: 'Список источников данных',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/DataSource' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Data Sources'],
        summary: 'Создать источник данных',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DataSourceCreate' },
            },
          },
        },
        responses: {
          201: { description: 'Источник создан' },
          400: { $ref: '#/components/responses/ValidationError' },
        },
      },
    },

    // ==================== DEPLOY ====================
    '/deploy/page/{pageId}': {
      post: {
        tags: ['Deploy'],
        summary: 'Опубликовать страницу',
        parameters: [
          {
            name: 'pageId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Страница опубликована',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    url: { type: 'string' },
                    publishedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFoundError' },
        },
      },
    },

    // ==================== HEALTH ====================
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Проверка статуса сервера',
        responses: {
          200: {
            description: 'Сервер работает',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    uptime: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      // ==================== PAGE SCHEMAS ====================
      Page: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'published', 'archived'] },
          content: { type: 'object' },
          seoMeta: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      PageCreate: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          slug: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          content: { type: 'object' },
        },
      },
      PageUpdate: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'published', 'archived'] },
          content: { type: 'object' },
          seoMeta: { type: 'object' },
        },
      },

      // ==================== BLOCK SCHEMAS ====================
      Block: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          type: { type: 'string' },
          content: { type: 'object' },
          isReusable: { type: 'boolean' },
          groupId: { type: 'string', format: 'uuid', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      BlockCreate: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string' },
          content: { type: 'object' },
          isReusable: { type: 'boolean', default: false },
          groupId: { type: 'string', format: 'uuid' },
        },
      },
      BlockUpdate: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          content: { type: 'object' },
          isReusable: { type: 'boolean' },
          groupId: { type: 'string', format: 'uuid' },
        },
      },

      // ==================== VARIABLE SCHEMAS ====================
      Variable: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['string', 'number', 'boolean', 'array', 'object', 'any'] },
          scope: { type: 'string', enum: ['page', 'session', 'global'] },
          defaultValue: {},
          description: { type: 'string' },
          pageId: { type: 'string', format: 'uuid', nullable: true },
          config: { type: 'object' },
          order: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      VariableCreate: {
        type: 'object',
        required: ['name', 'type', 'scope'],
        properties: {
          name: { type: 'string', pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' },
          type: { type: 'string', enum: ['string', 'number', 'boolean', 'array', 'object', 'any'] },
          scope: { type: 'string', enum: ['page', 'session', 'global'] },
          defaultValue: {},
          description: { type: 'string' },
          pageId: { type: 'string', format: 'uuid' },
          config: { type: 'object' },
        },
      },
      VariableUpdate: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['string', 'number', 'boolean', 'array', 'object', 'any'] },
          defaultValue: {},
          description: { type: 'string' },
          config: { type: 'object' },
        },
      },

      // ==================== DATA SOURCE SCHEMAS ====================
      DataSource: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['api', 'static', 'database', 'graphql'] },
          config: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      DataSourceCreate: {
        type: 'object',
        required: ['name', 'type', 'config'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['api', 'static', 'database', 'graphql'] },
          config: { type: 'object' },
        },
      },

      // ==================== ERROR SCHEMAS ====================
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
              timestamp: { type: 'string', format: 'date-time' },
              path: { type: 'string' },
            },
          },
        },
      },
    },
    parameters: {
      IdParam: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'ID ресурса',
      },
      PageParam: {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, default: 1 },
        description: 'Номер страницы',
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        description: 'Количество элементов на странице',
      },
    },
    responses: {
      ValidationError: {
        description: 'Ошибка валидации',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Missing required fields: name',
                details: { missingFields: ['name'] },
              },
            },
          },
        },
      },
      NotFoundError: {
        description: 'Ресурс не найден',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: "Resource with id 'xxx' not found",
              },
            },
          },
        },
      },
      ConflictError: {
        description: 'Конфликт данных',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'CONFLICT',
                message: 'Resource already exists',
              },
            },
          },
        },
      },
      InternalError: {
        description: 'Внутренняя ошибка сервера',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
              },
            },
          },
        },
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
}

export default openApiSpec
