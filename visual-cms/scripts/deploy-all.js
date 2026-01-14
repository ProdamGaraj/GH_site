/**
 * Скрипт для деплоя всех опубликованных страниц
 * Запуск: npm run deploy:all или node scripts/deploy-all.js
 */

const API_URL = 'http://localhost:5000/api'

async function main() {
  console.log('🚀 Запуск деплоя всех страниц...\n')

  try {
    const response = await fetch(`${API_URL}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    const result = await response.json()

    if (result.success) {
      console.log('✅ Деплой завершён успешно!')
      console.log(`📄 Опубликовано страниц: ${result.deployedPages.length}`)
      result.deployedPages.forEach(page => {
        console.log(`   - ${page}`)
      })
      console.log(`\n🌐 Сайт доступен по адресу: ${result.publicUrl}`)
      console.log('\n💡 Для запуска сервера выполните: npm run serve:public')
    } else {
      console.log('⚠️ Деплой завершён с ошибками:')
      console.log(`   ${result.message}`)
      if (result.errors?.length) {
        result.errors.forEach(err => console.log(`   - ${err}`))
      }
    }

  } catch (error) {
    console.error('❌ Ошибка при деплое:', error.message)
    console.log('\n💡 Убедитесь, что backend запущен: npm run dev:backend')
  }
}

main()
