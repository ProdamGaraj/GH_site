/**
 * Сбор фикстур из MacroCRM v2 для синхронизации квартир и планировок.
 *
 * Делает то же, что описано в macro-sync-requests.json, но сам: держит темп под
 * лимитом 100 req/min, проходит пагинацию до конца, выбирает образцы планировок
 * так, чтобы на них можно было проверить группировку, и вырезает из сохранённых
 * файлов рабочие ссылки в CRM.
 *
 * Запуск:
 *   MACRO_TOKEN=... node macro-fetch.js
 *   MACRO_TOKEN=... node macro-fetch.js --all-plans
 *
 * У ключей нового формата AppId зашит внутрь самого ключа, отдельным заголовком
 * его слать не надо. MACRO_APP_ID остаётся на случай старого ключа.
 *
 * Без --all-plans берётся выборка планировок (~20 вызовов, полминуты).
 * С --all-plans обходятся все квартиры в продаже (~339 вызовов, ~4 минуты) —
 * это даёт эталон, на котором проверяется группировщик.
 */
const fs = require('fs')
const path = require('path')

const BASE = process.env.MACRO_BASE_URL || 'https://api.macrocrm.gh.uz/v2'
const TOKEN = (process.env.MACRO_TOKEN || '').replace(/^Bearer\s+/i, '')
// Пусто у ключей нового формата — тогда заголовок AppId просто не шлётся.
const APP_ID = process.env.MACRO_APP_ID || ''
// Синк живёт в backend CMS, туда же и фикстуры.
const OUT = path.join(__dirname, '..', '..', 'backend', 'src', '__tests__', 'fixtures', 'macro')
const HOUSE_IDS = [5139395, 5622025]
const ALL_PLANS = process.argv.includes('--all-plans')

/** 90 запросов в минуту при лимите 100 — запас на случай параллельных клиентов. */
const GAP_MS = 667
/** Сколько образцов планировок брать, когда не запрошен полный обход. */
const SAMPLE_SIZE = 20

if (!TOKEN) {
  console.error('Нужен MACRO_TOKEN в переменных окружения.')
  process.exit(1)
}

/*
 * Пропуск проверки TLS-сертификата — по явному MACRO_INSECURE_TLS=1.
 *
 * Сертификат api.macrocrm.gh.uz истёк 25.09.2025, и без пропуска соединения не
 * будет вовсе. Область риска ограничена: скрипт разовый, читающий, ходит
 * только в этот один хост, а сам хост внутренний (резолвится в 172.16.0.199).
 *
 * По умолчанию выключено, и включать это в синке на стенде НЕ НАДО: там тот же
 * процесс ходит и в другие места. Настоящее решение — продлить сертификат.
 */
if (process.env.MACRO_INSECURE_TLS === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  console.warn('ВНИМАНИЕ: проверка TLS-сертификата отключена (MACRO_INSECURE_TLS=1).')
  console.warn('Сертификат api.macrocrm.gh.uz истёк 25.09.2025 — это заплатка, не решение.\n')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let calls = 0
let lastCallAt = 0

/**
 * POST с соблюдением темпа и повтором на 429/5xx.
 * Ошибки 4xx кроме 429 — это ошибка в запросе, повторять бессмысленно.
 */
async function post(pathname, body, attempt = 0) {
  const wait = GAP_MS - (Date.now() - lastCallAt)
  if (wait > 0) await sleep(wait)
  lastCallAt = Date.now()
  calls++

  const res = await fetch(BASE + pathname, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      // Ключи нового формата несут AppId внутри себя — заголовок лишний.
      ...(APP_ID ? { 'AppId': APP_ID } : {}),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 4) throw new Error(pathname + ': ' + res.status + ' после 5 попыток')
    const backoff = 5000 * Math.pow(2, attempt)
    console.log('   ' + res.status + ', пауза ' + backoff / 1000 + ' с')
    await sleep(backoff)
    return post(pathname, body, attempt + 1)
  }
  if (!res.ok) {
    throw new Error(pathname + ': ' + res.status + ' ' + (await res.text()).slice(0, 300))
  }
  return res.json()
}

/** Проходит курсорную пагинацию до конца, склеивая data всех страниц. */
async function postAll(pathname, body) {
  const out = []
  let from
  for (let page = 1; ; page++) {
    const json = await post(pathname, from === undefined ? body : { ...body, from })
    const data = Array.isArray(json.data) ? json.data : []
    out.push(...data)
    process.stdout.write('\r   страница ' + page + ', всего ' + out.length)
    const next = json.meta && json.meta.next
    if (next === null || next === undefined) break
    from = next
  }
  process.stdout.write('\n')
  return out
}

/** Ссылки с токенами внутри в фикстуре не нужны и в репозиторий им нельзя. */
function scrub(apartment) {
  const { exportUrl, specialNotes, ...rest } = apartment
  return rest
}

function save(name, data) {
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 1))
  console.log('   → ' + name)
}

/**
 * Образцы для проверки ключа группировки. Берём так, чтобы в выборку заведомо
 * попали пары квартир с одинаковой площадью (проверяем, совпадёт ли planName)
 * и соседние площади с разницей в сотые (проверяем, разойдётся ли).
 */
function pickSamples(flats) {
  const byArea = new Map()
  for (const f of flats) {
    const key = f.rooms + ':' + f.areaTotal
    if (!byArea.has(key)) byArea.set(key, [])
    byArea.get(key).push(f)
  }

  const picked = []
  const seen = new Set()
  const take = (f) => {
    if (f && !seen.has(f.id)) {
      seen.add(f.id)
      picked.push(f)
    }
  }

  // Бюджет делим, иначе пары с одинаковой площадью съедают всю выборку:
  // их в доме сотни, а проверить надо три разные вещи.
  const PAIRS_BUDGET = Math.floor(SAMPLE_SIZE * 0.5)
  const NEIGHBOURS_BUDGET = Math.floor(SAMPLE_SIZE * 0.8)

  // Пары с одинаковой площадью: совпадёт ли planName у разных квартир.
  for (const group of byArea.values()) {
    if (picked.length >= PAIRS_BUDGET) break
    if (group.length >= 2) {
      take(group[0])
      take(group[1])
    }
  }

  // Соседние площади: разойдётся ли planName при разнице в сотые доли.
  const sorted = [...flats].sort((a, b) => a.areaTotal - b.areaTotal)
  for (let i = 1; i < sorted.length && picked.length < NEIGHBOURS_BUDGET; i++) {
    const delta = sorted[i].areaTotal - sorted[i - 1].areaTotal
    if (delta > 0 && delta < 0.5) {
      take(sorted[i - 1])
      take(sorted[i])
    }
  }

  // По одной квартире каждой комнатности — чтобы увидеть разброс planName.
  for (const rooms of [...new Set(flats.map((f) => f.rooms))].sort((a, b) => a - b)) {
    if (picked.length >= SAMPLE_SIZE) break
    take(flats.find((f) => f.rooms === rooms))
  }

  return picked.slice(0, SAMPLE_SIZE)
}

async function main() {
  const started = Date.now()

  console.log('01 дома')
  const houses = await post('/estateHouses/list', { houseIds: HOUSE_IDS })
  save('01-houses.json', houses)
  for (const h of houses.data || []) {
    console.log('   ' + h.id + '  ' + JSON.stringify(h.name) + '  этажей ' + h.floorsCount)
  }

  console.log('02 квартиры в продаже')
  const flats = await postAll('/estateSell/list', {
    houseIds: HOUSE_IDS,
    categories: ['flat'],
    statuses: [20],
    includeMaxDiscountPrice: true,
  })
  save('02-apartments.json', flats.map(scrub))

  const perHouse = {}
  for (const f of flats) perHouse[f.houseId] = (perHouse[f.houseId] || 0) + 1
  console.log('   по домам: ' + JSON.stringify(perHouse))

  console.log('03 все статусы и категории')
  const everything = await postAll('/estateSell/list', { houseIds: HOUSE_IDS })
  save('03-apartments-all.json', everything.map(scrub))

  const targets = ALL_PLANS ? flats : pickSamples(flats)
  console.log('04 планировки: ' + targets.length + ' запросов'
    + (ALL_PLANS ? ' (полный обход)' : ' (выборка)'))

  const plans = []
  const failed = []
  for (let i = 0; i < targets.length; i++) {
    const estateId = targets[i].id
    process.stdout.write('\r   ' + (i + 1) + '/' + targets.length)
    try {
      const json = await post('/estateSell/getFlatPlans', { estateId })
      plans.push({ estateId, data: json.data })
    } catch (err) {
      failed.push({ estateId, error: String(err.message || err) })
    }
  }
  process.stdout.write('\n')
  save(ALL_PLANS ? '05-flatplans-full.json' : '04-flatplans-sample.json', plans)
  if (failed.length) {
    save('flatplans-failed.json', failed)
    console.log('   не отдались: ' + failed.length)
  }

  console.log('06 поэтажные планы')
  for (const houseId of HOUSE_IDS) {
    try {
      save('06-floorplans-' + houseId + '.json', await post('/estateHouses/getFloorPlans', { houseId }))
    } catch (err) {
      console.log('   ' + houseId + ': ' + err.message)
    }
  }

  console.log('07 статистика домов')
  save('07-house-stats.json', await post('/estateHouses/listStats', { houseIds: HOUSE_IDS }))

  // Сводка по группировке — ради неё всё и затевалось.
  const byPlanName = new Map()
  for (const p of plans) {
    const name = (p.data && p.data.planName) || '(без имени)'
    if (!byPlanName.has(name)) byPlanName.set(name, new Set())
    const flat = flats.find((f) => f.id === p.estateId)
    if (flat) byPlanName.get(name).add(flat.areaTotal)
  }

  console.log('\nИТОГО')
  console.log('  запросов к API: ' + calls)
  console.log('  времени: ' + Math.round((Date.now() - started) / 1000) + ' с')
  console.log('  квартир в продаже: ' + flats.length)
  console.log('  различных planName в выборке: ' + byPlanName.size)
  const multi = [...byPlanName.entries()].filter(([, areas]) => areas.size > 1)
  console.log('  planName, накрывающих несколько площадей: ' + multi.length)
  for (const [name, areas] of multi.slice(0, 10)) {
    console.log('    ' + name + ' → ' + [...areas].sort((a, b) => a - b).join(', '))
  }
}

main().catch((err) => {
  console.error('\nОШИБКА: ' + (err.message || err))
  // «fetch failed» само по себе не говорит ничего: настоящая причина —
  // отказ DNS, отказ соединения или просроченный сертификат — лежит в cause.
  let cause = err.cause
  while (cause) {
    console.error('  причина: ' + [cause.code, cause.syscall, cause.hostname, cause.message]
      .filter(Boolean).join(' '))
    cause = cause.cause
  }
  process.exit(1)
})
