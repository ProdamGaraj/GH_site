/**
 * Скрипт для унификации хедера на всех страницах сайта.
 * 
 * Берёт хедер с Главной (responsive: burger, overlay, variations)
 * и обновляет навигацию по образцу новых страниц (полный набор ссылок).
 * Затем обновляет блок в библиотеке и привязывает ко всем страницам.
 */
const { Client } = require('/app/node_modules/pg');

const SITE_ID = 'a83bae31-28ed-46fa-ab7b-800d7e6396b3';
const HOME_PAGE_ID = '5f597235-130e-4f57-a0ac-1eb1f77af920';
const HEADER_BLOCK_ID = '7441cdc0-3d58-4b18-aa3b-fd7549f8e807';

// Полный набор навигационных ссылок (контент с новых страниц)
const NAV_ITEMS = [
  { text: 'Главная', name: 'Nav - Главная', href: '/', mobileName: 'Mobile Nav - Главная' },
  { text: 'О компании', name: 'Nav - О компании', href: '/about', mobileName: 'Mobile Nav - О компании' },
  { text: 'Квартиры', name: 'Nav - Квартиры', href: '/residential', mobileName: 'Mobile Nav - Квартиры' },
  { text: 'Коммерция', name: 'Nav - Коммерция', href: '/commercial', mobileName: 'Mobile Nav - Коммерция' },
  { text: 'Новости', name: 'Nav - Новости', href: '/news', mobileName: 'Mobile Nav - Новости' },
  { text: 'Карьера', name: 'Nav - Карьера', href: '/career', mobileName: 'Mobile Nav - Карьера' },
  { text: 'Контакты', name: 'Nav - Контакты', href: '/contacts', mobileName: 'Mobile Nav - Контакты' },
];

// Стиль десктопных навигационных ссылок (из home header)
const desktopNavStyle = {
  states: { hover: { color: '#D29F66' } },
  properties: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: '13px',
    fontFamily: "'Muller', 'Inter', Arial, sans-serif",
    letterSpacing: '1px',
    textTransform: 'uppercase',
    textDecoration: 'none'
  },
  stateTransition: { easing: 'ease', duration: 200, properties: ['color'] }
};

// Стиль мобильных навигационных ссылок
const mobileNavStyle = {
  states: { hover: { color: '#D29F66' } },
  properties: {
    color: '#FFFFFF',
    width: '100%',
    padding: '12px 0',
    fontSize: '20px',
    textAlign: 'center',
    fontFamily: "'Muller', 'Inter', Arial, sans-serif",
    fontWeight: '500',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    textDecoration: 'none'
  },
  stateTransition: { easing: 'ease', duration: 200, properties: ['color'] }
};

function makeDesktopNavLink(item, idx) {
  return {
    id: `gh-header-nav-${idx}`,
    styles: desktopNavStyle,
    content: item.text,
    tagName: 'a',
    children: [],
    metadata: { name: item.name },
    attributes: { href: item.href },
    layoutMode: 'flex',
    elementType: 'link'
  };
}

function makeMobileNavLink(item, idx) {
  return {
    id: `gh-header-mobile-nav-${idx}`,
    styles: mobileNavStyle,
    content: item.text,
    tagName: 'a',
    children: [],
    metadata: { name: item.mobileName },
    attributes: { href: item.href },
    layoutMode: 'flex',
    elementType: 'link'
  };
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'postgres',
    port: 5432,
    database: 'visual_cms',
    user: 'cms_user',
    password: 'cms_password',
  });
  await client.connect();

  try {
    // 1. Получаем хедер с Главной страницы
    const homeRes = await client.query(
      `SELECT structure->'children'->0 AS header FROM pages WHERE id = $1`,
      [HOME_PAGE_ID]
    );
    const homeHeader = homeRes.rows[0].header;
    console.log('Home header children:', homeHeader.children.map(c => c.metadata?.name));

    // 2. Заменяем навигационные ссылки в desktop nav (gh-header-nav)
    const navContainer = homeHeader.children.find(c => c.id === 'gh-header-nav');
    if (navContainer) {
      navContainer.children = NAV_ITEMS.map((item, idx) => makeDesktopNavLink(item, idx));
      console.log('Updated desktop nav:', navContainer.children.length, 'items');
    }

    // 3. Заменяем навигационные ссылки в mobile overlay
    const overlay = homeHeader.children.find(c => c.id === 'gh-header-overlay');
    if (overlay) {
      const overlayContent = overlay.children.find(c => c.id === 'gh-header-overlay-content');
      if (overlayContent) {
        // Сохраняем divider, phone и CTA от старого overlay
        const divider = overlayContent.children.find(c => c.metadata?.name === 'Divider');
        const phone = overlayContent.children.find(c => c.metadata?.name === 'Mobile Phone');
        const cta = overlayContent.children.find(c => c.metadata?.name === 'Mobile CTA');

        const mobileLinks = NAV_ITEMS.map((item, idx) => makeMobileNavLink(item, idx));
        overlayContent.children = [
          ...mobileLinks,
          ...(divider ? [divider] : []),
          ...(phone ? [phone] : []),
          ...(cta ? [cta] : []),
        ];
        console.log('Updated mobile nav:', mobileLinks.length, 'items + extras');
      }
    }

    // 4. Обновляем блок в библиотеке (GH - Header)
    const blockHeader = JSON.parse(JSON.stringify(homeHeader));
    // Убираем linkedBlockId из самого блока (он не должен ссылаться на себя)
    delete blockHeader.metadata.linkedBlockId;

    await client.query(
      `UPDATE blocks SET structure = $1, "updatedAt" = NOW() WHERE id = $2`,
      [JSON.stringify(blockHeader), HEADER_BLOCK_ID]
    );
    console.log('Updated GH - Header block in library');

    // 5. Обновляем хедер на Главной странице (с linkedBlockId)
    homeHeader.metadata.linkedBlockId = HEADER_BLOCK_ID;
    await client.query(
      `UPDATE pages SET structure = jsonb_set(structure, '{children,0}', $1::jsonb) WHERE id = $2`,
      [JSON.stringify(homeHeader), HOME_PAGE_ID]
    );
    console.log('Updated home page header');

    // 6. Все остальные страницы сайта — заменяем хедер на linked version
    const pagesRes = await client.query(
      `SELECT id, name, structure->'children'->0->>'id' AS header_id FROM pages WHERE "siteId" = $1 AND id != $2`,
      [SITE_ID, HOME_PAGE_ID]
    );

    for (const page of pagesRes.rows) {
      // Создаём linked header для этой страницы
      const linkedHeader = JSON.parse(JSON.stringify(homeHeader));
      // Сохраняем linkedBlockId
      linkedHeader.metadata.linkedBlockId = HEADER_BLOCK_ID;

      await client.query(
        `UPDATE pages SET structure = jsonb_set(structure, '{children,0}', $1::jsonb) WHERE id = $2`,
        [JSON.stringify(linkedHeader), page.id]
      );
      console.log(`Updated page: ${page.name} (${page.id})`);
    }

    console.log('\n✅ All pages updated with unified header!');

  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
