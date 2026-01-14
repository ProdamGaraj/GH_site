/**
 * Скрипт для исправления структуры страницы Golden House
 * Обновляет существующую страницу, добавляя корректные flex-direction
 * Запуск: node scripts/fix-page-structure.js
 */

const API_URL = 'http://localhost:5000/api'

// Функция для рекурсивного исправления структуры
function fixNodeStructure(node, depth = 0) {
  if (!node) return node
  
  const name = node.metadata?.name || ''
  const indent = '  '.repeat(depth)
  
  // Контейнеры, которые должны быть вертикальными (колонками)
  const verticalContainers = [
    'Golden House Homepage',
    'Hero Content',
    'Stat 1', 'Stat 2', 'Stat 3', 'Stat 4',
    'Stat Number',
    'About Text',
    'Projects Header',
    'Project 1', 'Project 2', 'Project 3',
    'Project Info',
    'Advantages Section',
    'Advantages Header',
    'Advantage 1', 'Advantage 2', 'Advantage 3', 'Advantage 4',
    'Advantage Content',
    'CTA Section',
    'CTA Text',
    'Contact Section',
    'Contact Info',
    'Footer Column 1', 'Footer Column 2', 'Footer Column 3', 'Footer Column 4',
  ]
  
  // Контейнеры, которые должны быть горизонтальными (строками)
  const horizontalContainers = [
    'Navigation',
    'Header Right',
    'Buttons',
    'Footer Content',
    'Footer Nav',
  ]
  
  // Контейнеры с grid layout
  const gridContainers = [
    'Stats Grid',
    'Projects Grid', 
    'Advantages Grid',
  ]
  
  // === СПЕЦИАЛЬНАЯ ОБРАБОТКА HEADER ===
  if (name === 'Header') {
    node.styles = node.styles || { properties: {} }
    const existingProps = node.styles.properties || {}
    node.styles.properties = {
      ...existingProps,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'nowrap',
      // Убираем position: fixed для редактора - это мешает отображению
      position: 'relative',
      width: '100%',
      minWidth: '1200px',
    }
    node.layoutMode = 'flex'
    console.log(`${indent}🏠 ${name} -> header fixed`)
    
    // Рекурсивно обрабатываем детей
    if (node.children && Array.isArray(node.children)) {
      node.children = node.children.map(child => fixNodeStructure(child, depth + 1))
    }
    return node
  }
  
  // === СПЕЦИАЛЬНАЯ ОБРАБОТКА NAVIGATION ===
  if (name === 'Navigation') {
    node.styles = node.styles || { properties: {} }
    const existingProps = node.styles.properties || {}
    node.styles.properties = {
      ...existingProps,
      display: 'flex',
      flexDirection: 'row',
      gap: '32px',
      flexWrap: 'nowrap',
      whiteSpace: 'nowrap',
    }
    node.layoutMode = 'flex'
    console.log(`${indent}🧭 ${name} -> nav fixed`)
    
    // Исправляем nav items
    if (node.children && Array.isArray(node.children)) {
      node.children = node.children.map(child => {
        child.styles = child.styles || { properties: {} }
        child.styles.properties = {
          ...child.styles.properties,
          whiteSpace: 'nowrap',
        }
        return fixNodeStructure(child, depth + 1)
      })
    }
    return node
  }
  
  // === СПЕЦИАЛЬНАЯ ОБРАБОТКА HEADER RIGHT ===
  if (name === 'Header Right') {
    node.styles = node.styles || { properties: {} }
    const existingProps = node.styles.properties || {}
    node.styles.properties = {
      ...existingProps,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '24px',
      flexWrap: 'nowrap',
      whiteSpace: 'nowrap',
    }
    node.layoutMode = 'flex'
    console.log(`${indent}➡️ ${name} -> header-right fixed`)
    
    if (node.children && Array.isArray(node.children)) {
      node.children = node.children.map(child => {
        child.styles = child.styles || { properties: {} }
        child.styles.properties = {
          ...child.styles.properties,
          whiteSpace: 'nowrap',
          flexShrink: '0',
        }
        return fixNodeStructure(child, depth + 1)
      })
    }
    return node
  }
  
  // Если это контейнер и он должен быть вертикальным
  if (verticalContainers.some(v => name === v || name.startsWith(v))) {
    node.styles = node.styles || { properties: {} }
    const existingProps = node.styles.properties || {}
    node.styles.properties = {
      ...existingProps,
      display: 'flex',
      flexDirection: 'column',
    }
    node.layoutMode = 'flex'
    console.log(`${indent}📦 ${name} -> column`)
  }
  // Если это контейнер и он должен быть горизонтальным  
  else if (horizontalContainers.some(v => name === v || name.startsWith(v))) {
    node.styles = node.styles || { properties: {} }
    const existingProps = node.styles.properties || {}
    node.styles.properties = {
      ...existingProps,
      display: 'flex',
      flexDirection: 'row',
    }
    node.layoutMode = 'flex'
    console.log(`${indent}📐 ${name} -> row`)
  }
  // Grid контейнеры - не трогаем их display, только убеждаемся что grid установлен
  else if (gridContainers.some(v => name === v || name.startsWith(v))) {
    node.styles = node.styles || { properties: {} }
    const existingProps = node.styles.properties || {}
    // Сохраняем существующие grid настройки
    if (existingProps.display !== 'grid') {
      node.styles.properties = {
        ...existingProps,
        display: 'grid',
      }
    }
    node.layoutMode = 'grid'
    console.log(`${indent}🔲 ${name} -> grid`)
  }
  // Для секций - по умолчанию column если есть несколько детей
  else if (node.tagName === 'section' && node.children?.length > 0) {
    node.styles = node.styles || { properties: {} }
    const existingProps = node.styles.properties || {}
    if (!existingProps.flexDirection) {
      node.styles.properties = {
        ...existingProps,
        display: 'flex',
        flexDirection: 'column',
      }
      console.log(`${indent}📄 ${name} (section) -> column`)
    }
  }
  
  // Рекурсивно обрабатываем детей
  if (node.children && Array.isArray(node.children)) {
    node.children = node.children.map(child => fixNodeStructure(child, depth + 1))
  }
  
  return node
}

async function main() {
  try {
    console.log('🔍 Загрузка страниц...')
    
    const pagesRes = await fetch(`${API_URL}/pages`)
    const pages = await pagesRes.json()
    
    // Ищем страницу Golden House
    const ghPage = pages.find(p => 
      p.slug?.includes('golden-house') || 
      p.title?.toLowerCase().includes('golden house')
    )
    
    if (!ghPage) {
      console.log('❌ Страница Golden House не найдена')
      console.log('Доступные страницы:', pages.map(p => `${p.title} (${p.slug})`).join(', '))
      return
    }
    
    console.log(`📄 Найдена страница: ${ghPage.title || 'Без названия'} (${ghPage.slug})`)
    
    // Получаем полную страницу
    const pageRes = await fetch(`${API_URL}/pages/${ghPage.id}`)
    const page = await pageRes.json()
    
    console.log('\n🔧 Исправление структуры...\n')
    
    // Исправляем структуру
    const fixedStructure = fixNodeStructure(JSON.parse(JSON.stringify(page.structure)))
    
    // Обновляем страницу
    const updateRes = await fetch(`${API_URL}/pages/${ghPage.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...page,
        structure: fixedStructure,
      }),
    })
    
    if (updateRes.ok) {
      console.log('\n✅ Страница успешно обновлена!')
      console.log('🔄 Обновите страницу редактора (Ctrl+F5)')
    } else {
      const error = await updateRes.text()
      console.log('❌ Ошибка обновления:', error)
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message)
  }
}

main()
