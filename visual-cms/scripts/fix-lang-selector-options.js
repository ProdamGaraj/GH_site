/**
 * fix-lang-selector-options.js
 *
 * Исправляет цвет текста в <option> элементах селектора языка:
 * option получают color: #333 чтобы быть видимыми на белом фоне dropdown.
 *
 * Запуск: docker exec visual-cms-backend-1 node /app/scripts/fix-lang-selector-options.js
 */

const { Client } = require('pg');

const BLOCK_ID = '7441cdc0-3d58-4b18-aa3b-fd7549f8e807';
const PAGE_ID = '5f597235-130e-4f57-a0ac-1eb1f77af920';

function fixOptions(structure) {
  let fixed = 0;

  function walk(node) {
    if (!node) return;
    // Ищем option-узлы внутри lang-selector
    if (node.id === 'gh-lang-selector' && node.children) {
      for (const child of node.children) {
        if (child.tagName === 'option') {
          if (!child.styles) child.styles = {};
          if (!child.styles.properties) child.styles.properties = {};
          child.styles.properties.color = '#333333';
          child.styles.properties.backgroundColor = '#FFFFFF';
          fixed++;
        }
      }
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(structure);
  return fixed;
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://cms_user:cms_password@postgres:5432/visual_cms',
  });

  await client.connect();
  console.log('Connected to database');

  try {
    // Fix block
    console.log('\n=== Fixing block ===');
    const blockRes = await client.query('SELECT structure FROM blocks WHERE id = $1', [BLOCK_ID]);
    const blockStruct = blockRes.rows[0].structure;
    const blockFixed = fixOptions(blockStruct);
    console.log(`Fixed ${blockFixed} options in block`);

    if (blockFixed > 0) {
      await client.query(
        'UPDATE blocks SET structure = $1, "updatedAt" = NOW() WHERE id = $2',
        [JSON.stringify(blockStruct), BLOCK_ID]
      );
      console.log('Block saved');
    }

    // Fix page
    console.log('\n=== Fixing page ===');
    const pageRes = await client.query('SELECT structure FROM pages WHERE id = $1', [PAGE_ID]);
    const pageStruct = pageRes.rows[0].structure;
    const pageHeader = pageStruct.children.find(c => c.id === 'gh-header-root');
    const pageFixed = fixOptions(pageHeader);
    console.log(`Fixed ${pageFixed} options on page`);

    if (pageFixed > 0) {
      await client.query(
        'UPDATE pages SET structure = $1, "updatedAt" = NOW() WHERE id = $2',
        [JSON.stringify(pageStruct), PAGE_ID]
      );
      console.log('Page saved');
    }

    console.log('\n=== DONE ===');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
