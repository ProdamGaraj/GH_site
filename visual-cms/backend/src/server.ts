import { AppDataSource } from './config/database'
import { runSafeMigrations } from './migrations/runner'
import { ensureAdminUser } from './services/AdminBootstrap'
import { logger } from './services/Logger'
import { feedPollingScheduler } from './services/FeedPollingScheduler'
import app from './app'

const PORT = process.env.PORT || 5000

AppDataSource.initialize()
  .then(async () => {
    logger.info('Database connected')

    // Применяем идемпотентные миграции (IF NOT EXISTS)
    await runSafeMigrations(AppDataSource)

    // Создаём первого админа из env, если пользователей ещё нет.
    await ensureAdminUser(AppDataSource)

    // Серверный планировщик обновления feed-источников (раз в минуту).
    feedPollingScheduler.start()

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        api: `http://localhost:${PORT}/api`,
        docs: `http://localhost:${PORT}/api/docs`,
        redoc: `http://localhost:${PORT}/api/docs/redoc`,
      })
    })
  })
  .catch((error) => {
    logger.error('Database connection failed', error instanceof Error ? error : undefined)
    process.exit(1)
  })
