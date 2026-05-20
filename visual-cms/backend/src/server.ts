import { AppDataSource } from './config/database'
import { runSafeMigrations } from './migrations/runner'
import { logger } from './services/Logger'
import app from './app'

const PORT = process.env.PORT || 5000

AppDataSource.initialize()
  .then(async () => {
    logger.info('Database connected')

    // Применяем идемпотентные миграции (IF NOT EXISTS)
    await runSafeMigrations(AppDataSource)

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
