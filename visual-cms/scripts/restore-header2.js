const { Client } = require('pg');

async function main() {
  const ds = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/visualcms' });
  await ds.connect();

  // 1. Extract header from version 51
  const headerRes = await ds.query(`
    SELECT pv.structure->'children'->0 AS header
    FROM page_versions pv
    WHERE pv.id = '39e95117-0767-4f3e-b7bc-4916ac8f7239'
  `);
  
  const header = headerRes.rows[0].header;
  console.log('Extracted header ID:', header.id);
  console.log('Extracted header tagName:', header.tagName);
  console.log('Extracted header children count:', header.children?.length);
  console.log('Children names:', header.children?.map(c => c.metadata?.name));
  
  // 2. Update root ID to match library block's expected ID
  header.id = 'gh-tpl-1776150116604-1';
  header.metadata = { ...header.metadata, name: 'Header (linked)' };
  
  // 3. Update the library block structure
  const updateRes = await ds.query(
    `UPDATE blocks SET structure = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING id, name`,
    [JSON.stringify(header), '7441cdc0-3d58-4b18-aa3b-fd7549f8e807']
  );
  console.log('Updated block:', updateRes.rows[0]);
  
  // 4. Verify
  const verifyRes = await ds.query(
    `SELECT jsonb_array_length(structure->'children') as children_count FROM blocks WHERE id = '7441cdc0-3d58-4b18-aa3b-fd7549f8e807'`
  );
  console.log('Verified children count:', verifyRes.rows[0].children_count);
  
  await ds.end();
}

main().catch(e => { console.error(e); process.exit(1); });
