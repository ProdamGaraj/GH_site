/**
 * fix-linked-blocks.js
 * 
 * 1) Проставляет linkedBlockId на секциях страницы Golden House Premium
 * 2) Удаляет дубликаты блоков (оставляет самый новый набор 11:57)
 * 
 * Запуск: docker exec visual-cms-backend-1 node /app/scripts/fix-linked-blocks.js
 */

const { Client } = require('pg');

const PAGE_ID = '5f597235-130e-4f57-a0ac-1eb1f77af920';

// Маппинг секций страницы → ID самого свежего блока (11:57)
const SECTION_BLOCK_MAP = [
  { sectionId: 'gh-header-root',               blockId: '7441cdc0-3d58-4b18-aa3b-fd7549f8e807', name: 'GH - Header' },
  { sectionId: 'gh-premium-1771840286936-16',   blockId: '4c953131-c8e5-4023-a71b-e35ef52925dd', name: 'GH - Hero Section' },
  { sectionId: 'gh-premium-1771840286937-36',   blockId: 'ee753b82-b2fa-4864-aa8a-c057f1a43343', name: 'GH - About Section' },
  { sectionId: 'gh-premium-1771840286937-102',  blockId: '9ecbeb27-de48-4c6d-966a-1138933fee3d', name: 'GH - Projects Section' },
  { sectionId: 'gh-premium-1771840286938-116',  blockId: '38bd3acf-c656-48c7-8990-535da61e8853', name: 'GH - Advantages Section' },
  { sectionId: 'gh-premium-1771840286938-140',  blockId: '0c28e368-78cf-498d-9ae1-9ffbb5d702f4', name: 'GH - Contact Section' },
  { sectionId: 'gh-premium-1771840286938-154',  blockId: 'c9b03934-2822-4251-923d-e1e24bd87f7c', name: 'GH - Footer' },
];

// Блоки-дубликаты для удаления (старые наборы: 09:42 и 11:46)
const DUPLICATE_BLOCK_IDS = [
  // 09:42 set
  '44de400a-c697-4498-a542-dcd3f37a6f4a', // GH - Header
  'a0a2da07-2e5d-468b-9f7f-4bc67e12f181', // GH - Hero Section
  '9b8679ee-0e44-4fa8-be21-c8287da7f6be', // GH - Statistics
  '49fb55cc-f5b0-44ad-8ef1-830e14dd0abe', // GH - About Section
  'bc5b7b49-dd55-4406-8a64-4114014f7e65', // GH - Projects Section
  '3520e79e-bb67-47da-8745-3a824660a527', // GH - Advantages Section
  'e7454317-313c-4393-ad03-8e69acf2ee90', // GH - CTA Section
  '5374e598-8f95-4bcd-98c1-eccd43d26226', // GH - Contact Section
  '66bcd9a9-96c2-4896-9adc-2eab57b33683', // GH - Footer
  // 11:46 set
  'fc2836fe-a915-45e0-a8e2-cc67d1c38e6c', // GH - Header
  '6f564e0c-1c29-4157-9f31-5ed6a95ef1f4', // GH - Hero Section
  'a1ecaab0-1dbc-444e-80d0-bec05ad328dd', // GH - Statistics
  '0bbce98f-1c72-4460-95d3-2291ead11ff2', // GH - About Section
  '110bf8f8-6bb5-49ac-997b-35f189b751da', // GH - Projects Section
  'd2adeaf1-3e74-4626-8146-33d09b5f7967', // GH - Advantages Section
  '13bb0e38-bfe3-44c7-9933-8e483576c2cd', // GH - CTA Section
  '0049398f-4256-4e41-bd46-7cab334a4d51', // GH - Contact Section
  'a1170530-b2a9-4233-b0bc-1fd6d15a40ef', // GH - Footer
];

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://cms_user:cms_password@postgres:5432/visual_cms',
  });

  await client.connect();
  console.log('Connected to database');

  try {
    // ============================================================
    // STEP 1: Add linkedBlockId to page sections
    // ============================================================
    console.log('\n=== STEP 1: Patching linkedBlockId on page sections ===');

    const pageResult = await client.query(
      'SELECT structure FROM pages WHERE id = $1',
      [PAGE_ID]
    );

    if (pageResult.rows.length === 0) {
      console.error('Page not found:', PAGE_ID);
      return;
    }

    const structure = pageResult.rows[0].structure;
    let patchCount = 0;

    for (const mapping of SECTION_BLOCK_MAP) {
      const section = structure.children.find(c => c.id === mapping.sectionId);
      if (!section) {
        console.warn(`  Section not found: ${mapping.sectionId} (${mapping.name})`);
        continue;
      }

      if (!section.metadata) {
        section.metadata = {};
      }

      if (section.metadata.linkedBlockId === mapping.blockId) {
        console.log(`  ✓ Already linked: ${mapping.sectionId} → ${mapping.name}`);
        continue;
      }

      section.metadata.linkedBlockId = mapping.blockId;
      patchCount++;
      console.log(`  + Linked: ${mapping.sectionId} → ${mapping.name} (${mapping.blockId})`);
    }

    if (patchCount > 0) {
      await client.query(
        'UPDATE pages SET structure = $1, "updatedAt" = NOW() WHERE id = $2',
        [JSON.stringify(structure), PAGE_ID]
      );
      console.log(`\n  Patched ${patchCount} sections on page ${PAGE_ID}`);
    } else {
      console.log('\n  No sections needed patching');
    }

    // ============================================================
    // STEP 2: Delete duplicate blocks
    // ============================================================
    console.log('\n=== STEP 2: Deleting duplicate blocks ===');

    // Проверяем, что блоки существуют перед удалением
    const existCheck = await client.query(
      'SELECT id, name FROM blocks WHERE id = ANY($1::uuid[])',
      [DUPLICATE_BLOCK_IDS]
    );

    console.log(`  Found ${existCheck.rows.length} duplicates to delete:`);
    for (const row of existCheck.rows) {
      console.log(`    - ${row.name} (${row.id})`);
    }

    if (existCheck.rows.length > 0) {
      const deleteResult = await client.query(
        'DELETE FROM blocks WHERE id = ANY($1::uuid[])',
        [DUPLICATE_BLOCK_IDS]
      );
      console.log(`\n  Deleted ${deleteResult.rowCount} duplicate blocks`);
    }

    // ============================================================
    // STEP 3: Verify
    // ============================================================
    console.log('\n=== STEP 3: Verification ===');

    const verifyPage = await client.query(
      'SELECT structure FROM pages WHERE id = $1',
      [PAGE_ID]
    );

    const verifiedStructure = verifyPage.rows[0].structure;
    let allLinked = true;
    for (const mapping of SECTION_BLOCK_MAP) {
      const section = verifiedStructure.children.find(c => c.id === mapping.sectionId);
      const linked = section?.metadata?.linkedBlockId;
      if (linked === mapping.blockId) {
        console.log(`  ✓ ${mapping.name}: ${linked}`);
      } else {
        console.log(`  ✗ ${mapping.name}: expected ${mapping.blockId}, got ${linked}`);
        allLinked = false;
      }
    }

    const remainingBlocks = await client.query(
      "SELECT id, name FROM blocks WHERE name LIKE 'GH -%' ORDER BY name"
    );
    console.log(`\n  Remaining GH blocks: ${remainingBlocks.rows.length}`);
    for (const row of remainingBlocks.rows) {
      console.log(`    - ${row.name} (${row.id})`);
    }

    console.log(`\n=== DONE. All linked: ${allLinked} ===\n`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
