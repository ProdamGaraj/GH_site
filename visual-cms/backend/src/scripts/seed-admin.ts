/**
 * Создаёт первого администратора Visual CMS из переменных окружения.
 *
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=secret npm run seed:admin
 *
 * Идемпотентно: если пользователь с таким username уже есть — ничего не делает.
 * Сам прогоняет миграции, поэтому работает даже до первого старта сервера.
 *
 * --reset-password: если пользователь есть — выставить ему ADMIN_PASSWORD и
 * включить (ротация пароля админа; в проде — `deploy/scripts/secrets.sh admin`):
 *   docker compose exec backend node dist/scripts/seed-admin.js --reset-password
 */
import dotenv from 'dotenv'
import { AppDataSource } from '../config/database'
import { runSafeMigrations } from '../migrations/runner'
import { User } from '../models/User'
import { authService } from '../services/AuthService'

dotenv.config()

async function main(): Promise<void> {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD

  if (!username || !password) {
    console.error('[seed-admin] ADMIN_USERNAME and ADMIN_PASSWORD env vars are required')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('[seed-admin] ADMIN_PASSWORD must be at least 8 characters')
    process.exit(1)
  }

  await AppDataSource.initialize()
  try {
    // Гарантируем, что таблица users существует (миграции идемпотентны).
    await runSafeMigrations(AppDataSource)

    const repo = AppDataSource.getRepository(User)
    const existing = await repo.findOne({ where: { username } })
    const passwordHash = await authService.hashPassword(password)

    if (existing) {
      if (!process.argv.includes('--reset-password')) {
        console.log(`[seed-admin] User '${username}' already exists — nothing to do`)
        return
      }
      existing.passwordHash = passwordHash
      existing.isActive = true
      await repo.save(existing)
      console.log(`[seed-admin] Password for '${username}' reset`)
      return
    }

    const user = repo.create({ username, passwordHash, role: 'admin', isActive: true })
    await repo.save(user)
    console.log(`[seed-admin] Admin user '${username}' created`)
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error('[seed-admin] Failed:', err)
  process.exit(1)
})
