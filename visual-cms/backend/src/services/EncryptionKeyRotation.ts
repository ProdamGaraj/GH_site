import CredentialsManager, { EncryptedData } from './CredentialsManager'

/**
 * Перешифровка секретов источников данных при смене ENCRYPTION_KEY.
 *
 * Секреты лежат в JSONB data_sources.config / data_sources."authConfig" как
 * объекты { storageType: 'inline', encrypted, iv, authTag } на любой глубине
 * (поля, заголовки). Чистые функции здесь только обходят дерево: доступ к БД —
 * в scripts/rotate-encryption-key.ts.
 *
 * Идемпотентность: значение, которое уже расшифровывается НОВЫМ ключом,
 * не трогается — повторный прогон ничего не меняет. GCM-тег гарантирует, что
 * чужой ключ не «расшифрует» мусор, а бросит исключение.
 */

export interface TreeRotation<T> {
  value: T
  /** Перешифровано со старого ключа на новый. */
  reencrypted: number
  /** Уже было зашифровано новым ключом — оставлено как есть. */
  alreadyCurrent: number
}

export class UndecryptableSecretError extends Error {
  constructor(public readonly path: string) {
    super(`Secret at "${path}" decrypts with neither the old nor the new key`)
    this.name = 'UndecryptableSecretError'
  }
}

const tryDecrypt = (data: EncryptedData, key: Buffer): string | undefined => {
  try {
    return CredentialsManager.decrypt(data, key)
  } catch {
    return undefined
  }
}

/**
 * Обходит JSON-дерево и перешифровывает каждый inline-секрет oldKey → newKey.
 * Вход не мутируется. Секрет, который не открывается ни одним ключом, —
 * UndecryptableSecretError с путём (вызывающий откатывает всю транзакцию).
 */
export function reencryptTree<T>(value: T, oldKey: Buffer, newKey: Buffer, path = '$'): TreeRotation<T> {
  if (CredentialsManager.isEncrypted(value)) {
    if (tryDecrypt(value, newKey) !== undefined) {
      return { value, reencrypted: 0, alreadyCurrent: 1 }
    }
    const plain = tryDecrypt(value, oldKey)
    if (plain === undefined) throw new UndecryptableSecretError(path)
    return { value: CredentialsManager.encrypt(plain, newKey) as unknown as T, reencrypted: 1, alreadyCurrent: 0 }
  }

  if (Array.isArray(value)) {
    let reencrypted = 0
    let alreadyCurrent = 0
    const out = value.map((item, i) => {
      const r = reencryptTree(item, oldKey, newKey, `${path}[${i}]`)
      reencrypted += r.reencrypted
      alreadyCurrent += r.alreadyCurrent
      return r.value
    })
    return { value: out as unknown as T, reencrypted, alreadyCurrent }
  }

  if (value !== null && typeof value === 'object') {
    let reencrypted = 0
    let alreadyCurrent = 0
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const r = reencryptTree(v, oldKey, newKey, `${path}.${k}`)
      reencrypted += r.reencrypted
      alreadyCurrent += r.alreadyCurrent
      out[k] = r.value
    }
    return { value: out as unknown as T, reencrypted, alreadyCurrent }
  }

  return { value, reencrypted: 0, alreadyCurrent: 0 }
}

export interface DataSourceSecretsRow {
  id: string
  config: unknown
  authConfig: unknown
}

export interface RowUpdate {
  id: string
  config: unknown
  authConfig: unknown
}

export interface RotationPlan {
  updates: RowUpdate[]
  reencrypted: number
  alreadyCurrent: number
}

/**
 * План перешифровки по строкам data_sources: какие строки переписать и чем.
 * Строки без изменений в план не попадают. Ошибка в любой строке — исключение
 * с id источника, чтобы не записать половину.
 */
export function planRotation(rows: DataSourceSecretsRow[], oldKey: Buffer, newKey: Buffer): RotationPlan {
  const plan: RotationPlan = { updates: [], reencrypted: 0, alreadyCurrent: 0 }
  for (const row of rows) {
    let config: TreeRotation<unknown>
    let authConfig: TreeRotation<unknown>
    try {
      config = reencryptTree(row.config, oldKey, newKey, 'config')
      authConfig = reencryptTree(row.authConfig, oldKey, newKey, 'authConfig')
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      throw new Error(`data_sources ${row.id}: ${reason}`)
    }
    plan.reencrypted += config.reencrypted + authConfig.reencrypted
    plan.alreadyCurrent += config.alreadyCurrent + authConfig.alreadyCurrent
    if (config.reencrypted + authConfig.reencrypted > 0) {
      plan.updates.push({ id: row.id, config: config.value, authConfig: authConfig.value })
    }
  }
  return plan
}
