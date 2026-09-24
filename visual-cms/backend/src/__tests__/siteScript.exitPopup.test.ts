/**
 * @jest-environment jsdom
 *
 * Exit-окно Site JS. Отдельный файл: обработчик mouseleave вешается на
 * document, и в общем jsdom обработчики прошлых тестов срабатывали бы тоже.
 * Порядок тестов здесь важен: сначала страница с выключателем, потом без.
 */
import * as fs from 'fs'
import * as path from 'path'

const RUNTIME = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'assets', 'site-runtime.js'), 'utf8')

function boot(head = ''): void {
  document.head.innerHTML = head
  document.body.innerHTML = ''
  new Function(RUNTIME)()
}

const leave = () => document.dispatchEvent(new MouseEvent('mouseleave', { clientY: 0 }))
const exitPopups = () => document.querySelectorAll('.exit-popup').length

it('с выключателем страницы exit-окна нет', () => {
  boot('<meta name="gh-widgets" content="off">')
  leave()
  expect(exitPopups()).toBe(0)
})

it('без выключателя — появляется при уходе курсора вверх, один раз', () => {
  boot()
  leave()
  leave()
  expect(exitPopups()).toBe(1)
})
