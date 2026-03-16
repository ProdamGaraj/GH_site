/**
 * add-lang-selector.js
 *
 * Добавляет <select> переключатель языков (RU / EN / UZ) в GH-Header блок
 * в секцию gh-header-right, между телефоном и кнопкой CTA.
 * Также добавляет JS-скрипт для обработки переключения.
 *
 * Запуск: docker exec visual-cms-backend-1 node /app/scripts/add-lang-selector.js
 */

const { Client } = require('pg');

const BLOCK_ID = '7441cdc0-3d58-4b18-aa3b-fd7549f8e807';
const PAGE_ID = '5f597235-130e-4f57-a0ac-1eb1f77af920';

// Новый узел — select с языками
const langSelectorNode = {
  id: 'gh-lang-selector',
  tagName: 'select',
  content: '',
  children: [
    {
      id: 'gh-lang-opt-ru',
      tagName: 'option',
      content: 'RU',
      children: [],
      metadata: { name: 'RU option' },
      attributes: { value: 'ru', selected: 'true' },
      styles: { properties: {} },
      layoutMode: 'flex',
      elementType: 'text',
    },
    {
      id: 'gh-lang-opt-en',
      tagName: 'option',
      content: 'EN',
      children: [],
      metadata: { name: 'EN option' },
      attributes: { value: 'en' },
      styles: { properties: {} },
      layoutMode: 'flex',
      elementType: 'text',
    },
    {
      id: 'gh-lang-opt-uz',
      tagName: 'option',
      content: 'UZ',
      children: [],
      metadata: { name: 'UZ option' },
      attributes: { value: 'uz' },
      styles: { properties: {} },
      layoutMode: 'flex',
      elementType: 'text',
    },
  ],
  metadata: { name: 'Language Selector' },
  attributes: {
    'data-lang-selector': 'true',
  },
  styles: {
    properties: {
      color: '#FFFFFF',
      border: '1px solid rgba(255,255,255,0.3)',
      cursor: 'pointer',
      padding: '8px 12px',
      fontSize: '14px',
      fontFamily: 'Muller, sans-serif',
      fontWeight: '500',
      borderRadius: '4px',
      backgroundColor: 'transparent',
      appearance: 'none',
      WebkitAppearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 8px center',
      paddingRight: '28px',
      outline: 'none',
    },
    states: {
      hover: {
        borderColor: '#D29F66',
      },
    },
    stateTransition: {
      easing: 'ease',
      duration: 200,
      properties: ['border-color'],
    },
  },
  layoutMode: 'flex',
  elementType: 'container',
};

// JS скрипт для обработки переключения языка на публичном сайте
const langScript = {
  id: 'lang-switch-script',
  code: `
    (function() {
      var sel = document.querySelector('[data-lang-selector]');
      if (!sel) return;
      
      // Восстановить язык из localStorage
      var saved = localStorage.getItem('gh-lang') || 'ru';
      sel.value = saved;
      
      sel.addEventListener('change', function() {
        var lang = sel.value;
        localStorage.setItem('gh-lang', lang);
        // Dispatch custom event для интеграции с CMS переводами
        document.dispatchEvent(new CustomEvent('gh-lang-change', { detail: { lang: lang } }));
        console.log('Language changed to:', lang);
      });
    })();
  `.trim(),
};

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://cms_user:cms_password@postgres:5432/visual_cms',
  });

  await client.connect();
  console.log('Connected to database');

  try {
    // === STEP 1: Обновить блок в библиотеке ===
    console.log('\n=== STEP 1: Adding lang selector to block ===');

    const blockResult = await client.query(
      'SELECT structure FROM blocks WHERE id = $1',
      [BLOCK_ID]
    );

    if (blockResult.rows.length === 0) {
      console.error('Block not found:', BLOCK_ID);
      return;
    }

    const blockStructure = blockResult.rows[0].structure;

    // Найти gh-header-right
    const headerRight = blockStructure.children.find(c => c.id === 'gh-header-right');
    if (!headerRight) {
      console.error('gh-header-right not found in block structure');
      return;
    }

    // Проверяем — не добавлен ли уже селект
    const existing = headerRight.children.find(c => c.id === 'gh-lang-selector');
    if (existing) {
      console.log('Language selector already exists in block, skipping block update');
    } else {
      // Вставить селект между телефоном и кнопкой (позиция 1)
      headerRight.children.splice(1, 0, langSelectorNode);
      console.log('Added lang selector node to gh-header-right');

      // Добавить скрипт если ещё нет
      if (!blockStructure.scripts) blockStructure.scripts = [];
      const existingScript = blockStructure.scripts.find(s => s.id === 'lang-switch-script');
      if (!existingScript) {
        blockStructure.scripts.push(langScript);
        console.log('Added lang-switch-script');
      }

      await client.query(
        'UPDATE blocks SET structure = $1, "updatedAt" = NOW() WHERE id = $2',
        [JSON.stringify(blockStructure), BLOCK_ID]
      );
      console.log('Block updated successfully');
    }

    // === STEP 2: Обновить страницу (linked instance) ===
    console.log('\n=== STEP 2: Updating page header section ===');

    const pageResult = await client.query(
      'SELECT structure FROM pages WHERE id = $1',
      [PAGE_ID]
    );

    if (pageResult.rows.length === 0) {
      console.error('Page not found:', PAGE_ID);
      return;
    }

    const pageStructure = pageResult.rows[0].structure;
    const pageHeader = pageStructure.children.find(c => c.id === 'gh-header-root');

    if (!pageHeader) {
      console.error('gh-header-root not found on page');
      return;
    }

    const pageHeaderRight = pageHeader.children.find(c => c.id === 'gh-header-right');
    if (!pageHeaderRight) {
      console.error('gh-header-right not found on page header');
      return;
    }

    const existingOnPage = pageHeaderRight.children.find(c => c.id === 'gh-lang-selector');
    if (existingOnPage) {
      console.log('Language selector already exists on page, skipping');
    } else {
      pageHeaderRight.children.splice(1, 0, langSelectorNode);
      console.log('Added lang selector to page header-right');

      if (!pageHeader.scripts) pageHeader.scripts = [];
      const existingPageScript = pageHeader.scripts.find(s => s.id === 'lang-switch-script');
      if (!existingPageScript) {
        pageHeader.scripts.push(langScript);
        console.log('Added lang-switch-script to page header');
      }

      await client.query(
        'UPDATE pages SET structure = $1, "updatedAt" = NOW() WHERE id = $2',
        [JSON.stringify(pageStructure), PAGE_ID]
      );
      console.log('Page updated successfully');
    }

    // === STEP 3: Verify ===
    console.log('\n=== STEP 3: Verification ===');

    const verifyBlock = await client.query('SELECT structure FROM blocks WHERE id = $1', [BLOCK_ID]);
    const vbRight = verifyBlock.rows[0].structure.children.find(c => c.id === 'gh-header-right');
    const vbLang = vbRight.children.find(c => c.id === 'gh-lang-selector');
    console.log('Block has lang selector:', !!vbLang);
    console.log('Block lang selector children:', vbLang ? vbLang.children.length : 0);

    const verifyPage = await client.query('SELECT structure FROM pages WHERE id = $1', [PAGE_ID]);
    const vpHeader = verifyPage.rows[0].structure.children.find(c => c.id === 'gh-header-root');
    const vpRight = vpHeader.children.find(c => c.id === 'gh-header-right');
    const vpLang = vpRight.children.find(c => c.id === 'gh-lang-selector');
    console.log('Page has lang selector:', !!vpLang);

    console.log('\n=== DONE ===');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
