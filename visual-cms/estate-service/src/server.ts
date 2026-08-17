import 'dotenv/config'
import { AppDataSource } from './config/database'
import { ensureDatabase } from './config/ensureDatabase'
import { runSafeMigrations } from './migrations/runner'
import { logger } from './services/Logger'
import app from './app'

const PORT = process.env.PORT || 5100

ensureDatabase(process.env.DATABASE_URL)
  .then(() => AppDataSource.initialize())
  .then(async () => {
    logger.info('Database connected (estate)')
    await runSafeMigrations(AppDataSource)

    app.listen(PORT, () => {
      logger.info(`estate-service running on port ${PORT}`, {
        api: `http://localhost:${PORT}/api/complexes`,
        health: `http://localhost:${PORT}/health`,
      })
    })
  })
  .catch((error) => {
    logger.error('Database connection failed', error instanceof Error ? error : undefined)
    process.exit(1)
  })
