/**
 * One-shot: deploy Hero page to public-site to verify carousel runtime end-to-end.
 * Run: docker exec visual-cms-backend-1 npx ts-node src/scripts/deploy-hero-once.ts
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { deployService } from '../services/DeployService'

const PAGE_ID = '5f597235-130e-4f57-a0ac-1eb1f77af920'

async function main(): Promise<void> {
  await AppDataSource.initialize()
  const res = await deployService.deployPage(PAGE_ID)
  console.log(JSON.stringify(res, null, 2))
  await AppDataSource.destroy()
  process.exit(res.success ? 0 : 1)
}

main().catch(err => { console.error(err); process.exit(1) })
