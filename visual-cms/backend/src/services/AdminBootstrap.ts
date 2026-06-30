import { DataSource } from 'typeorm'
import { User } from '../models/User'
import { authService } from './AuthService'
import { logger } from './Logger'

/**
 * Создаёт первого администратора из ADMIN_USERNAME/ADMIN_PASSWORD, если в БД
 * ещё НЕТ ни одного пользователя. Вызывается на старте сервера после миграций —
 * чтобы свежее окружение сразу имело учётку и не требовало ручного seed:admin.
 *
 * Идемпотентно: при наличии хотя бы одного пользователя ничего не делает
 * (пароль существующих не трогаем).
 */
export async function ensureAdminUser(dataSource: DataSource): Promise<void> {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD

  if (!username || !password) {
    logger.warn('Admin bootstrap skipped: ADMIN_USERNAME/ADMIN_PASSWORD are not set')
    return
  }

  const repo = dataSource.getRepository(User)
  const count = await repo.count()
  if (count > 0) {
    return
  }

  const passwordHash = await authService.hashPassword(password)
  await repo.save(repo.create({ username, passwordHash, role: 'admin', isActive: true }))
  logger.info(`Bootstrapped initial admin user '${username}'`)
}
