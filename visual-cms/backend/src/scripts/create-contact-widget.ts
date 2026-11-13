/**
 * Создаёт в библиотеке блок «Contact widget» — плавающую кнопку связи
 * (см. contactWidgetBlock.ts).
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/create-contact-widget.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/create-contact-widget.ts
 *
 * Флаги:
 *   --dry-run      показать, что будет сделано, ничего не писать
 *   --update       блок уже есть — заменить его структуру заново собранной
 *                  (правки, сделанные в редакторе, пропадут; копия кладётся в --out)
 *   --out=<dir>    куда положить резервную копию при --update
 *
 * После создания блок появляется в библиотеке: его добавляют на страницу
 * (или в блок «Footer», чтобы он был на всех страницах), затем — передеплой.
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { CONTACT_WIDGET_NAME, buildContactWidgetBlock } from './contactWidgetBlock'
import { flag, hasFlag, writeBackup } from './migrationIo'

export type ContactWidgetOutcome = 'created' | 'updated' | 'exists' | 'dry-run'

interface BlockRepo {
  findOne(options: { where: { name: string } }): Promise<Block | null>
  create(data: Partial<Block>): Block
  save(block: Block): Promise<Block>
}

export interface CreateContactWidgetOptions {
  dryRun?: boolean
  update?: boolean
  /** Копия блока перед заменой; возвращает путь к файлу. */
  backup?: (block: Block) => string
  log?: (line: string) => void
}

/** Создаёт блок, если его нет; с `update` — пересобирает существующий. */
export async function createContactWidget(
  repo: BlockRepo,
  options: CreateContactWidgetOptions = {},
): Promise<ContactWidgetOutcome> {
  const log = options.log ?? ((line: string) => console.log(line))
  const structure = buildContactWidgetBlock()
  const existing = await repo.findOne({ where: { name: CONTACT_WIDGET_NAME } })

  if (existing && !options.update) {
    log(`Блок «${CONTACT_WIDGET_NAME}» уже есть (${existing.id}) — ничего не сделано. Пересобрать: --update.`)
    return 'exists'
  }
  if (options.dryRun) {
    log(`--dry-run: блок «${CONTACT_WIDGET_NAME}» был бы ${existing ? 'пересобран' : 'создан'}. В базу ничего не записано.`)
    return 'dry-run'
  }

  if (existing) {
    if (options.backup) log(`Копия блока: ${options.backup(existing)}`)
    existing.structure = structure
    await repo.save(existing)
    log(`Блок «${CONTACT_WIDGET_NAME}» (${existing.id}) пересобран. Нужен передеплой страниц, где он стоит.`)
    return 'updated'
  }

  const saved = await repo.save(
    repo.create({ name: CONTACT_WIDGET_NAME, type: 'section', isReusable: true, tags: [], structure }),
  )
  log(`Блок «${CONTACT_WIDGET_NAME}» создан (${saved.id}). Добавьте его на страницу в редакторе и передеплойте её.`)
  return 'created'
}

async function main(): Promise<void> {
  const outDir = flag('out') ?? '/app/backups'
  await AppDataSource.initialize()
  try {
    await createContactWidget(AppDataSource.getRepository(Block) as unknown as BlockRepo, {
      dryRun: hasFlag('dry-run'),
      update: hasFlag('update'),
      backup: (block) => writeBackup(outDir, 'contact-widget', { id: block.id, name: block.name, structure: block.structure }),
    })
  } finally {
    await AppDataSource.destroy()
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
