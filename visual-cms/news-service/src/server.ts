import 'dotenv/config'
import { AppDataSource } from './config/database'
import { ensureDatabase } from './config/ensureDatabase'
import { runSafeMigrations } from './migrations/runner'
import { logger } from './services/Logger'
import app from './app'

const PORT = process.env.PORT || 5200

ensureDatabase(process.env.DATABASE_URL)
  .then(() => AppDataSource.initialize())
  .then(async () => {
    logger.info('Database connected (news)')
    await runSafeMigrations(AppDataSource)

    app.listen(PORT, () => {
      logger.info(`news-service running on port ${PORT}`, {
        api: `http://localhost:${PORT}/api/news`,
        health: `http://localhost:${PORT}/health`,
      })
    })
  })
  .catch((error) => {
    logger.error('Database connection failed', error instanceof Error ? error : undefined)
    process.exit(1)
  })
