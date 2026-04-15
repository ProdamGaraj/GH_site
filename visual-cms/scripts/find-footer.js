const { Client } = require('pg');

async function main() {
  const ds = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/visualcms' });
  await ds.connect();

  // 1. Find footer blocks in library
  const blocksRes = await ds.query("SELECT id, name, type, jsonb_array_length(structure->'children') as children_count FROM blocks WHERE LOWER(name) LIKE '%footer%'");
  console.log('Footer blocks:', blocksRes.rows);

  // 2. Find footer nodes in current pages
  const footerNodesRes = await ds.query(`
    SELECT p.title, p.slug, elem->>'id' as footer_id, elem->>'tagName' as tag,
           elem->'metadata'->>'linkedBlockId' as linked_block_id,
           COALESCE(jsonb_array_length(elem->'children'), 0) as children_count
    FROM pages p, jsonb_array_elements(p.structure->'children') elem
    WHERE elem->>'tagName' = 'footer' OR LOWER(elem->'metadata'->>'name') LIKE '%footer%'
  `);
  console.log('Footer nodes in pages:', footerNodesRes.rows);

  // 3. Search page_versions for footer with content
  const versionFootersRes = await ds.query(`
    SELECT pv.id, pv."pageId", pv.version, elem->>'id' as footer_id,
           elem->>'tagName' as tag,
           jsonb_array_length(elem->'children') as children_count
    FROM page_versions pv, jsonb_array_elements(pv.structure->'children') elem
    WHERE (elem->>'tagName' = 'footer' OR LOWER(elem->'metadata'->>'name') LIKE '%footer%')
    AND jsonb_array_length(elem->'children') > 0
    ORDER BY pv.version DESC
    LIMIT 10
  `);
  console.log('Page versions with non-empty footer:', versionFootersRes.rows);

  await ds.end();
}

main().catch(e => { console.error(e); process.exit(1); });
