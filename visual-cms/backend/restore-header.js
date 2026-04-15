const { Client } = require('pg');

async function main() {
  const ds = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/visualcms' });
  await ds.connect();
  
  // 1. Check tables
  const tablesRes = await ds.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  const tables = tablesRes.rows;
  console.log('Tables:', tables.map(t => t.tablename).join(', '));
  
  // 2. Check block_versions or similar
  const blockVersions = tables.filter(t => t.tablename.includes('version') || t.tablename.includes('block'));
  console.log('Block/version tables:', blockVersions.map(t => t.tablename));
  
  // 3. Get the current block data
  const blockRes = await ds.query("SELECT id, name, structure FROM blocks WHERE id = '7441cdc0-3d58-4b18-aa3b-fd7549f8e807'");
  const block = blockRes.rows;
  if (block.length > 0) {
    const str = block[0].structure;
    console.log('Current block structure children count:', str?.children?.length || 0);
  }
  
  // 4. Try to find header in page_versions
  const pvsRes = await ds.query(`
    SELECT pv.id, pv."pageId", pv.version, 
           jsonb_array_length(pv.structure->'children') as top_children
    FROM page_versions pv 
    ORDER BY pv.version DESC LIMIT 5
  `);
  console.log('Recent page versions:', pvsRes.rows);
  
  // 5. Search ALL page_versions for one where the first child has children > 0 and is a header
  const headerVersionsRes = await ds.query(`
    SELECT pv.id, pv."pageId", pv.version, 
           pv.structure->'children'->0->>'tagName' as first_tag,
           pv.structure->'children'->0->>'id' as first_id,
           jsonb_array_length(pv.structure->'children'->0->'children') as first_children_count
    FROM page_versions pv 
    WHERE pv.structure->'children'->0->>'tagName' = 'header'
    AND jsonb_array_length(pv.structure->'children'->0->'children') > 0
    ORDER BY pv.version DESC LIMIT 10
  `);
  console.log('Header versions with content:', headerVersionsRes.rows);
  
  // 6. Also check if header is NOT the first child
  const anyHeaderVersionsRes = await ds.query(`
    SELECT pv.id, pv."pageId", pv.version, elem->>'id' as header_id,
           jsonb_array_length(elem->'children') as children_count
    FROM page_versions pv, 
         jsonb_array_elements(pv.structure->'children') elem
    WHERE elem->>'tagName' = 'header'
    AND jsonb_array_length(elem->'children') > 0
    LIMIT 10
  `);
  console.log('Any page versions with non-empty header:', anyHeaderVersionsRes.rows);
  
  await ds.end();
}

main().catch(e => { console.error(e); process.exit(1); });
