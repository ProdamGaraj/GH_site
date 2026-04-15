const { Client } = require('pg');

async function main() {
  const ds = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/visualcms' });
  await ds.connect();

  // Get header block structure
  const res = await ds.query("SELECT structure FROM blocks WHERE id = '7441cdc0-3d58-4b18-aa3b-fd7549f8e807'");
  const header = res.rows[0].structure;
  
  console.log('Current header styles:', JSON.stringify(header.styles, null, 2));
  console.log('Current header id:', header.id);
  
  // Fix: change position from sticky to fixed
  header.styles.properties.position = 'fixed';
  // Ensure width 100% and left 0 for fixed positioning
  header.styles.properties.left = '0';
  
  // Save back
  await ds.query(
    `UPDATE blocks SET structure = $1, "updatedAt" = NOW() WHERE id = $2`,
    [JSON.stringify(header), '7441cdc0-3d58-4b18-aa3b-fd7549f8e807']
  );
  
  console.log('Updated header to position: fixed');
  
  await ds.end();
}

main().catch(e => { console.error(e); process.exit(1); });
