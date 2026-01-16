const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

// Категории блоков
const CATEGORIES = {
  HERO: 'Hero Sections',
  NAVIGATION: 'Navigation',
  CONTENT: 'Content Sections',
  FEATURES: 'Features',
  PROJECTS: 'Projects',
  CONTACT: 'Contact Forms',
  FOOTER: 'Footers',
  STATS: 'Statistics',
  CTA: 'Call to Action',
};

// Маппинг имён блоков на категории
const blockCategoryMap = {
  'Hero': CATEGORIES.HERO,
  'Header': CATEGORIES.NAVIGATION,
  'Navigation': CATEGORIES.NAVIGATION,
  'Footer': CATEGORIES.FOOTER,
  'Contact': CATEGORIES.CONTACT,
  'Philosophy': CATEGORIES.CONTENT,
  'About': CATEGORIES.CONTENT,
  'Projects': CATEGORIES.PROJECTS,
  'Services': CATEGORIES.FEATURES,
  'Stats': CATEGORIES.STATS,
  'Features': CATEGORIES.FEATURES,
  'Architecture': CATEGORIES.FEATURES,
  'Location': CATEGORIES.CONTENT,
  'Exclusivity': CATEGORIES.CTA,
  'Current Project': CATEGORIES.PROJECTS,
  'Carousel': CATEGORIES.PROJECTS,
  'Form': CATEGORIES.CONTACT,
};

function getCategoryForBlock(blockName) {
  for (const [key, category] of Object.entries(blockCategoryMap)) {
    if (blockName.includes(key)) {
      return category;
    }
  }
  return CATEGORIES.CONTENT;
}

function extractBlocksFromStructure(structure, pageName, blocks = new Map()) {
  if (!structure || !structure.children) return blocks;

  structure.children.forEach(child => {
    if (child.metadata?.name) {
      const blockName = child.metadata.name;
      
      // Извлекаем только секции верхнего уровня (Hero, About, Projects и т.д.)
      const isTopLevelSection = 
        blockName.endsWith('Section') ||
        (blockName === 'Header' && child.tagName === 'header') ||
        (blockName === 'Footer' && child.tagName === 'footer');

      if (isTopLevelSection) {
        const uniqueKey = `${pageName}_${blockName}`;
        
        if (!blocks.has(uniqueKey)) {
          blocks.set(uniqueKey, {
            name: `${blockName.replace(' Section', '')} (${pageName})`,
            category: getCategoryForBlock(blockName),
            structure: child,
            source: pageName,
          });
        }
      }
    }
  });

  return blocks;
}

async function seedBlocksFromPages() {
  try {
    console.log('🔍 Извлечение блоков из страниц...\n');

    // Получаем все страницы Golden House
    const pagesResponse = await axios.get(`${API_URL}/pages`);
    const pages = pagesResponse.data.filter(p => 
      p.slug?.includes('golden-house')
    );

    console.log(`Найдено ${pages.length} страниц Golden House\n`);

    // Извлекаем блоки из каждой страницы
    const allBlocks = new Map();
    
    for (const page of pages) {
      console.log(`📄 Обработка: ${page.name}`);
      
      if (page.structure) {
        const pageBlocks = extractBlocksFromStructure(
          page.structure,
          page.name
        );
        
        pageBlocks.forEach((block, key) => {
          allBlocks.set(key, block);
        });
        
        console.log(`   ✓ Извлечено блоков: ${pageBlocks.size}`);
      }
    }

    console.log(`\n📦 Всего уникальных блоков: ${allBlocks.size}\n`);

    // Удаляем существующие блоки Golden House
    console.log('🗑️  Удаление старых блоков...');
    try {
      const existingBlocks = await axios.get(`${API_URL}/blocks`);
      for (const block of existingBlocks.data) {
        if (block.name?.includes('Golden House')) {
          await axios.delete(`${API_URL}/blocks/${block.id}`);
        }
      }
      console.log('   ✓ Старые блоки удалены\n');
    } catch (err) {
      console.log('   ⚠ Нет старых блоков для удаления\n');
    }

    // Создаём новые блоки
    console.log('💾 Создание блоков в библиотеке...\n');
    
    let successCount = 0;
    let errorCount = 0;

    for (const [key, block] of allBlocks.entries()) {
      try {
        await axios.post(`${API_URL}/blocks`, {
          name: block.name,
          type: 'section', // Добавляем обязательное поле type
          category: block.category,
          structure: block.structure,
          isReusable: true,
          tags: [block.source, block.category],
          metadata: {
            source: block.source,
            extractedFrom: 'page',
          },
        });
        
        console.log(`   ✓ ${block.name} → ${block.category}`);
        successCount++;
      } catch (error) {
        console.error(`   ✗ Ошибка при создании: ${block.name}`);
        console.error(`     ${error.response?.data?.message || error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Создано блоков: ${successCount}`);
    if (errorCount > 0) {
      console.log(`❌ Ошибок: ${errorCount}`);
    }
    console.log('='.repeat(60));

    // Группировка по категориям
    console.log('\n📊 Блоки по категориям:\n');
    const categoryCounts = {};
    allBlocks.forEach(block => {
      categoryCounts[block.category] = (categoryCounts[block.category] || 0) + 1;
    });

    Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count} блок(ов)`);
      });

  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error.message);
    if (error.response?.data) {
      console.error('Детали:', error.response.data);
    }
    process.exit(1);
  }
}

seedBlocksFromPages();
