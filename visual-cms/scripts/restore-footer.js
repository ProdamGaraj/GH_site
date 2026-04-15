const { Client } = require('pg');

async function main() {
  const ds = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/visualcms' });
  await ds.connect();

  // 1. Footer nodes in current pages
  const footerNodesRes = await ds.query(`
    SELECT p.name, p.slug, elem->>'id' as footer_id, elem->>'tagName' as tag,
           elem->'metadata'->>'linkedBlockId' as linked_block_id,
           COALESCE(jsonb_array_length(elem->'children'), 0) as children_count
    FROM pages p, jsonb_array_elements(p.structure->'children') elem
    WHERE elem->>'tagName' = 'footer' OR LOWER(elem->'metadata'->>'name') LIKE '%footer%'
  `);
  console.log('Footer nodes in pages:', footerNodesRes.rows);

  // 2. Search page_versions for footer with content
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

  // 3. If found, get the footer structure from the best version
  if (versionFootersRes.rows.length > 0) {
    const best = versionFootersRes.rows[0];
    const structRes = await ds.query(`
      SELECT elem AS footer_structure
      FROM page_versions pv, jsonb_array_elements(pv.structure->'children') elem
      WHERE pv.id = $1
      AND (elem->>'tagName' = 'footer' OR LOWER(elem->'metadata'->>'name') LIKE '%footer%')
      AND jsonb_array_length(elem->'children') > 0
      LIMIT 1
    `, [best.id]);
    
    const footer = structRes.rows[0].footer_structure;
    console.log('Best footer structure:');
    console.log('  id:', footer.id);
    console.log('  tagName:', footer.tagName);
    console.log('  children count:', footer.children?.length);
    console.log('  children names:', footer.children?.map(c => c.metadata?.name));
    
    // 4. Restore to library block c9b03934-...
    // Change root id to match linked block expectations
    footer.id = footer.id; // keep original
    footer.metadata = { ...footer.metadata, name: 'Footer (linked)' };
    delete footer.metadata?.linkedBlockId;
    
    await ds.query(
      `UPDATE blocks SET structure = $1, "updatedAt" = NOW() WHERE id = $2`,
      [JSON.stringify(footer), 'c9b03934-2822-4251-923d-e1e24bd87f7c']
    );
    console.log('Restored footer to library block c9b03934-...');
    
    // Verify
    const verify = await ds.query(
      `SELECT jsonb_array_length(structure->'children') as cc FROM blocks WHERE id = 'c9b03934-2822-4251-923d-e1e24bd87f7c'`
    );
    console.log('Verified children count:', verify.rows[0].cc);
  } else {
    console.log('No footer with content found in page_versions!');
  }

  await ds.end();
}

main().catch(e => { console.error(e); process.exit(1); });
