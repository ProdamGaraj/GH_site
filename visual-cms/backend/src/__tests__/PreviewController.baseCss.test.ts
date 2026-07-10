/**
 * GET /api/preview/base-css — контроллер отдаёт канонический base-CSS деплоя,
 * заскоупленный под контейнер канваса. Тестируем сам обработчик (без БД/app):
 *  - корректные заголовки (text/css + Cache-Control);
 *  - тело содержит scoped-форм-стили и нетронутый @keyframes;
 *  - невалидный scope безопасно откатывается к дефолту (нет CSS-инъекции).
 */
import { previewController } from '../controllers/PreviewController'

function mockRes() {
  const res: any = {}
  res.type = jest.fn(() => res)
  res.set = jest.fn(() => res)
  res.send = jest.fn(() => res)
  res.status = jest.fn(() => res)
  return res
}

describe('PreviewController.baseCss', () => {
  it('отдаёт scoped CSS с text/css и Cache-Control', async () => {
    const req: any = { query: { scope: '.canvas-viewport' } }
    const res = mockRes()
    await previewController.baseCss(req, res, jest.fn())

    expect(res.type).toHaveBeenCalledWith('text/css')
    expect(res.set).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('max-age'))
    const sent = res.send.mock.calls[0][0] as string
    expect(sent).toContain('.canvas-viewport input[type="text"]')
    expect(sent).toContain('.canvas-viewport *')
    expect(sent).toContain('@keyframes spin')
  })

  it('невалидный scope откатывается к .canvas-viewport (без инъекции)', async () => {
    const req: any = { query: { scope: 'x; }{ body{display:none} /*' } }
    const res = mockRes()
    await previewController.baseCss(req, res, jest.fn())

    const sent = res.send.mock.calls[0][0] as string
    expect(sent).toContain('.canvas-viewport input')
    expect(sent).not.toContain('display:none')
  })
})
