/**
 * Рантайм заявок сайта: формы → POST /api/leads → MacroCRM.
 *
 * Инжектится генератором на КАЖДУЮ страницу: путь клиента по сайту («что
 * смотрел») пишется на всех страницах, а не только там, где есть форма.
 *
 * Что делает:
 *   1. Путь клиента в localStorage (`ghJourney`): страницы со временем на
 *      каждой, открытые планировки, фильтры, визиты, первый внешний переход и
 *      UTM-метки. Уходит вместе с заявкой — менеджер видит, что смотрел клиент.
 *   2. Формы заявок — любая форма с полем телефона. Вид заявки:
 *        data-lead-kind="plan"     — форма в окне планировки (ComplexOverlaysRuntime);
 *        select[name="project"]    — форма проекта («Complex lead»);
 *        иначе                     — обратный звонок.
 *      Форма без телефона (калькулятор ипотеки) — не заявка, не трогаем.
 *   3. В конце каждой формы — строка статуса («Отправляем…», ошибка,
 *      «Спасибо»), строка согласия на языке страницы и поле-ловушка для ботов.
 *      Внутри формы и во всю ширину: формы сайта — сетки, а элемент рядом с
 *      формой стал бы лишней колонкой секции (так было на главной).
 *   4. Память контакта (`ghContact`): после УСПЕШНОЙ заявки имя и телефон
 *      запоминаются на 30 дней. Во всех формах с телефоном поля имени и
 *      телефона тогда скрыты (значения в них подставлены), вместо них —
 *      «Иван, +998 90 *** 45 67 · Изменить»: следующая заявка — одним нажатием.
 *      Номер замаскирован: на общем компьютере следующий посетитель не видит
 *      чужой номер целиком. «Изменить» показывает поля.
 *      Там же — планировки, по которым заявка уже ушла (сутки): окно такой
 *      планировки вместо формы говорит «заявка отправлена». Сервер держит то
 *      же правило (LeadService, PLAN_REPEAT_WINDOW_MS) — на случай очищенного
 *      браузера. Память применяется при загрузке и после каждого сброса формы
 *      (окно планировки сбрасывает форму, открывая другую планировку).
 *
 * Превью в CMS (нет analyticsPageId — тот же признак, что у трекера
 * аналитики): заявки НЕ отправляются и путь не пишется, форма показывает
 * «предпросмотр». Иначе проверка формы в редакторе создавала бы лид в CRM.
 *
 * Кнопки «Отправить» на сайте бывают type="button" (формы «Коммерции» и
 * «Контактов»), поэтому слушаем и клик по кнопке, и submit (Enter в поле).
 * Клик с preventDefault отменяет submit — двойной отправки нет.
 */

export interface LeadLabels {
  consent: string
  /** Ссылка «Изменить» у запомненного контакта. */
  change: string
  /** Окно планировки, по которой заявка уже отправлена. */
  planSent: string
  sending: string
  sent: string
  thanks: string
  phoneError: string
  tooMany: string
  error: string
  preview: string
}

const LEAD_LABELS: Record<string, LeadLabels> = {
  ru: {
    consent: 'Нажимая кнопку, вы соглашаетесь на обработку персональных данных и звонок менеджера.',
    change: 'Изменить',
    planSent: 'Заявка по этой планировке отправлена. Менеджер свяжется с вами в ближайшее время.',
    sending: 'Отправляем…',
    sent: 'Заявка отправлена',
    thanks: 'Спасибо! Менеджер свяжется с вами в ближайшее время.',
    phoneError: 'Проверьте номер телефона.',
    tooMany: 'Слишком много заявок. Попробуйте позже или позвоните нам.',
    error: 'Не удалось отправить. Попробуйте ещё раз или позвоните нам.',
    preview: 'Предпросмотр: заявка не отправляется.',
  },
  uz: {
    consent: 'Tugmani bosish orqali siz shaxsiy maʼlumotlaringiz qayta ishlanishiga va menejer qo‘ng‘irog‘iga rozilik bildirasiz.',
    change: 'O‘zgartirish',
    planSent: 'Ushbu reja bo‘yicha ariza yuborildi. Menejer tez orada siz bilan bog‘lanadi.',
    sending: 'Yuborilmoqda…',
    sent: 'Ariza yuborildi',
    thanks: 'Rahmat! Menejer tez orada siz bilan bog‘lanadi.',
    phoneError: 'Telefon raqamini tekshiring.',
    tooMany: 'Arizalar juda ko‘p. Keyinroq urinib ko‘ring yoki bizga qo‘ng‘iroq qiling.',
    error: 'Yuborib bo‘lmadi. Qayta urinib ko‘ring yoki bizga qo‘ng‘iroq qiling.',
    preview: 'Oldindan ko‘rish: ariza yuborilmaydi.',
  },
  en: {
    consent: 'By clicking the button, you agree to the processing of your personal data and a call from our manager.',
    change: 'Change',
    planSent: 'Your request for this floor plan has been sent. Our manager will contact you shortly.',
    sending: 'Sending…',
    sent: 'Request sent',
    thanks: 'Thank you! Our manager will contact you shortly.',
    phoneError: 'Please check the phone number.',
    tooMany: 'Too many requests. Please try again later or call us.',
    error: 'Could not send. Please try again or call us.',
    preview: 'Preview: the request is not sent.',
  },
}

/** Подписи языка; неизвестный код — русский (основной язык сайта). */
export function leadLabels(lang?: string): LeadLabels {
  const code = (lang || 'ru').toLowerCase().split('-')[0]
  return LEAD_LABELS[code] || LEAD_LABELS.ru
}

/** Ключ пути клиента в localStorage. */
export const JOURNEY_KEY = 'ghJourney'
/** Ключ памяти контакта (имя, телефон, отправленные планировки). */
export const CONTACT_KEY = 'ghContact'
/** Сколько помнить имя и телефон. */
export const CONTACT_TTL_DAYS = 30
/** Сколько помнить отправленную планировку — как PLAN_REPEAT_WINDOW_MS сервера. */
export const PLAN_SENT_TTL_HOURS = 24

const LEAD_CSS = `<style data-gh-leads>
.gh-lead-extra{grid-column:1/-1;flex:1 0 100%;width:100%;box-sizing:border-box;text-align:left}
.gh-lead-consent{margin:2px 0 0;font-size:12px;line-height:1.45;opacity:.7}
.gh-lead-status{margin:2px 0 0;font-size:14px;font-weight:700;line-height:1.4}
.gh-lead-status:empty{display:none}
.gh-lead-status.is-error{color:#d93025}
.gh-lead-field-hidden{display:none!important}
.gh-lead-known{margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;min-height:48px;box-sizing:border-box;font-size:15px;font-weight:700;line-height:1.4}
.gh-lead-known .gh-lead-change{all:unset;display:inline!important;width:auto!important;height:auto!important;min-height:0!important;padding:0!important;margin:0!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;animation:none!important;color:inherit!important;font-size:13px!important;font-weight:700!important;line-height:1.4!important;text-decoration:underline!important;opacity:.75;cursor:pointer}
.gh-lead-known .gh-lead-change::before,.gh-lead-known .gh-lead-change::after{content:none!important;display:none!important}
.gh-lead-known .gh-lead-change:hover,.gh-lead-known .gh-lead-change:focus-visible{opacity:1}
.gh-lead-known .gh-lead-change:focus-visible{outline:2px solid currentColor!important;outline-offset:2px}
form.gh-lead-done>:not(.gh-lead-status){display:none!important}
.gh-lead-hp{position:absolute!important;left:-10000px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important}
</style>`

const RUNTIME_JS = (config: { live: boolean; labels: LeadLabels }) => `<script>
(function () {
  'use strict';
  if (window.__ghLeads) return;
  window.__ghLeads = true;

  var CONFIG = ${JSON.stringify(config).replace(/</g, '\\u003c')};
  var L = CONFIG.labels;
  var STORE = '${JOURNEY_KEY}';
  var VISIT_GAP_MS = 30 * 60 * 1000;
  var MAX_PAGES = 30;
  var MAX_PLANS = 20;
  var HP_NAME = 'website';
  var CONTACT = '${CONTACT_KEY}';
  var CONTACT_TTL_MS = ${CONTACT_TTL_DAYS} * 24 * 60 * 60 * 1000;
  var PLAN_SENT_MS = ${PLAN_SENT_TTL_HOURS} * 60 * 60 * 1000;

  /* ── Хранилище: в приватном режиме localStorage может бросать ── */
  function readJourney() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeJourney(j) {
    try { localStorage.setItem(STORE, JSON.stringify(j)); } catch (e) { /* без пути — заявка всё равно уйдёт */ }
  }
  function updateJourney(fn) {
    var j = readJourney();
    fn(j);
    writeJourney(j);
    return j;
  }
  // Site JS v2 хранил имена и телефоны в браузере открытым текстом — убираем.
  try { localStorage.removeItem('goldenHouseLeads'); } catch (e) { /* ignore */ }

  function text(node) { return node ? (node.textContent || '').replace(/\\s+/g, ' ').trim() : ''; }
  function cut(value, max) { value = String(value == null ? '' : value); return value.length > max ? value.slice(0, max) : value; }

  /* ── Путь клиента ── */
  var pageId = String(Date.now()) + Math.random().toString(36).slice(2, 8);
  var visibleSince = document.visibilityState === 'hidden' ? 0 : Date.now();
  var visibleMs = 0;

  function recordVisit() {
    var now = Date.now();
    updateJourney(function (j) {
      if (!j.firstSeen) j.firstSeen = new Date(now).toISOString().slice(0, 10);
      if (!j.lastAt || now - j.lastAt > VISIT_GAP_MS) j.visits = (j.visits || 0) + 1;
      j.lastAt = now;
      var ref = document.referrer;
      if (ref && !j.referrer) {
        try { if (new URL(ref).host !== location.host) j.referrer = cut(ref, 500); } catch (e) { /* ignore */ }
      }
      var query = new URLSearchParams(location.search);
      var utm = {};
      ['source', 'medium', 'campaign', 'content', 'term'].forEach(function (key) {
        var value = query.get('utm_' + key);
        if (value) utm[key] = cut(value, 200);
      });
      // Метки последней рекламной кампании, приведшей клиента.
      if (Object.keys(utm).length) j.utm = utm;
      j.pages = (j.pages || []).concat({ id: pageId, path: cut(location.pathname, 500), title: cut(document.title, 300), seconds: 0 });
      if (j.pages.length > MAX_PAGES) j.pages = j.pages.slice(-MAX_PAGES);
    });
  }

  /** Время на странице — только пока вкладка видна. */
  function flushTime() {
    if (visibleSince) { visibleMs += Date.now() - visibleSince; visibleSince = document.visibilityState === 'hidden' ? 0 : Date.now(); }
    var seconds = Math.round(visibleMs / 1000);
    updateJourney(function (j) {
      (j.pages || []).forEach(function (p) { if (p.id === pageId) p.seconds = seconds; });
    });
  }

  function recordPlan(card) {
    var title = text(card.querySelector('h3'));
    var project = text(card.querySelector('[data-card-project]'));
    if (!title) return;
    updateJourney(function (j) {
      var plans = j.plans || [];
      var last = plans[plans.length - 1];
      if (!last || last.title !== title || last.project !== project) plans.push({ title: cut(title, 200), project: cut(project, 200) });
      j.plans = plans.slice(-MAX_PLANS);
    });
  }

  /* ── Фильтры планировок («Выбрать планировку») ── */
  var FILTER_LABELS = { rooms: 'Комнаты', deadline: 'Срок сдачи', windowViews: 'Вид из окна', area: 'Площадь', floor: 'Этаж', price: 'Цена' };

  function readFilters() {
    var out = {};
    var chips = document.querySelectorAll('[data-filter][data-value].active');
    for (var i = 0; i < chips.length; i++) {
      var field = chips[i].getAttribute('data-filter');
      var value = (chips[i].getAttribute('data-value') || '').trim();
      if (!field || !value) continue;
      var label = FILTER_LABELS[field] || field;
      var list = out[label] ? out[label].split(', ') : [];
      if (list.indexOf(value) === -1) list.push(value);
      out[label] = cut(list.join(', '), 200);
    }
    ['area', 'floor', 'price'].forEach(function (name) {
      var lo = document.querySelector('[data-filter="' + name + 'Min"]');
      var hi = document.querySelector('[data-filter="' + name + 'Max"]');
      var min = lo ? String(lo.value || '').trim() : '';
      var max = hi ? String(hi.value || '').trim() : '';
      if (min || max) out[FILTER_LABELS[name]] = cut((min ? 'от ' + min : '') + (min && max ? ' ' : '') + (max ? 'до ' + max : ''), 200);
    });
    return out;
  }

  /* ── Формы заявок ── */
  function phoneInput(form) { return form.querySelector('input[name="phone"], input[type="tel"]'); }
  /**
   * Форма заявки: <form> с телефоном, кроме форм с HTTP-привязкой
   * (data-output-binding — их ведёт рантайм привязок данных).
   */
  function isLeadForm(form) {
    return !!(form && form.tagName === 'FORM' && !form.hasAttribute('data-output-binding') && phoneInput(form));
  }

  function kindOf(form) {
    var explicit = form.getAttribute('data-lead-kind');
    if (explicit === 'plan' || explicit === 'project' || explicit === 'callback') return explicit;
    return form.querySelector('select[name="project"]') ? 'project' : 'callback';
  }

  /** Как форму назвать менеджеру. */
  function formTitle(form, kind) {
    if (form.getAttribute('data-lead-form')) return form.getAttribute('data-lead-form');
    if (kind === 'plan') return 'Окно планировки';
    if (kind === 'project') return 'Форма на странице проекта';
    if (form.classList.contains('consult-form')) return 'Окно «Получить консультацию»';
    if (form.classList.contains('commerce-form')) return 'Форма «Коммерция»';
    if (form.querySelector('textarea')) return 'Форма с вопросом';
    return 'Обратный звонок';
  }

  function extra(form, className) {
    for (var i = 0; i < form.children.length; i++) {
      if (form.children[i].classList.contains(className)) return form.children[i];
    }
    return null;
  }

  /** Строка согласия, ловушка, статус. Идемпотентно. */
  function decorate(form) {
    if (!isLeadForm(form) || form.getAttribute('data-lead-ready') === '1') return;
    form.setAttribute('data-lead-ready', '1');

    if (!form.querySelector('[name="' + HP_NAME + '"]')) {
      var hp = document.createElement('input');
      hp.type = 'text';
      hp.name = HP_NAME;
      hp.tabIndex = -1;
      hp.autocomplete = 'off';
      hp.className = 'gh-lead-hp';
      hp.setAttribute('aria-hidden', 'true');
      form.appendChild(hp);
    }
    var status = document.createElement('p');
    status.className = 'gh-lead-extra gh-lead-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    var consent = document.createElement('p');
    consent.className = 'gh-lead-extra gh-lead-consent';
    consent.textContent = L.consent;
    form.appendChild(status);
    form.appendChild(consent);
  }

  function decorateAll() {
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i++) decorate(forms[i]);
  }

  function setStatus(form, message, isError) {
    decorate(form);
    var status = extra(form, 'gh-lead-status');
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-error', !!isError);
  }

  function submitButtons(form) {
    return form.querySelectorAll('button[type="submit"], input[type="submit"], button.submit, button.commerce-submit, button.consult-submit, button:not([type])');
  }

  function setButtons(form, label, disabled) {
    var buttons = submitButtons(form);
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (label !== null) {
        if (!b.hasAttribute('data-lead-label')) b.setAttribute('data-lead-label', b.textContent);
        b.textContent = label;
      } else if (b.hasAttribute('data-lead-label')) {
        b.textContent = b.getAttribute('data-lead-label');
        b.removeAttribute('data-lead-label');
      }
      b.disabled = !!disabled;
    }
  }

  var SKIP_FIELDS = { name: 1, phone: 1, email: 1, message: 1 };
  SKIP_FIELDS[HP_NAME] = 1;

  function planSnapshot() {
    var card = window.ghPlanModal && window.ghPlanModal.current ? window.ghPlanModal.current() : null;
    if (!card) return undefined;
    var snap = {
      id: cut(card.getAttribute('data-plan-type') || '', 64),
      title: cut(text(card.querySelector('h3')), 200),
      project: cut(text(card.querySelector('[data-card-project]')), 200),
      floors: cut(text(card.querySelector('[data-card-floors]')), 100),
      deadline: cut((card.getAttribute('data-deadline') || '').trim(), 100)
    };
    var rooms = parseInt(card.getAttribute('data-rooms') || '', 10);
    if (!isNaN(rooms) && rooms >= 0) snap.rooms = rooms;
    var areaMin = parseFloat(card.getAttribute('data-area-min') || '');
    var areaMax = parseFloat(card.getAttribute('data-area-max') || '');
    if (areaMin > 0) snap.areaMin = areaMin;
    if (areaMax > 0) snap.areaMax = areaMax;
    Object.keys(snap).forEach(function (k) { if (snap[k] === '') delete snap[k]; });
    return snap;
  }

  /* ── Память контакта ── */
  /** Живые записи: контакт моложе 30 дней, планировки моложе суток. */
  function readContact() {
    var c = null;
    try { c = JSON.parse(localStorage.getItem(CONTACT) || 'null'); } catch (e) { c = null; }
    if (!c || typeof c !== 'object') c = {};
    var now = Date.now();
    var out = { plans: {} };
    if (typeof c.phone === 'string' && phoneOk(c.phone) && c.savedAt && now - c.savedAt < CONTACT_TTL_MS) {
      out.phone = c.phone;
      out.name = typeof c.name === 'string' ? c.name : '';
      out.savedAt = c.savedAt;
    }
    var plans = c.plans && typeof c.plans === 'object' ? c.plans : {};
    Object.keys(plans).forEach(function (id) {
      if (typeof plans[id] === 'number' && now - plans[id] < PLAN_SENT_MS) out.plans[id] = plans[id];
    });
    return out;
  }
  function rememberLead(payload) {
    var c = readContact();
    c.phone = payload.phone;
    c.name = payload.name || '';
    c.savedAt = Date.now();
    if (payload.plan && payload.plan.id) c.plans[payload.plan.id] = Date.now();
    try { localStorage.setItem(CONTACT, JSON.stringify(c)); } catch (e) { /* без памяти — заполнят снова */ }
  }

  /** «+998 90 *** 45 67»: видно начало и последние 4 цифры. */
  function maskPhone(value) {
    var d = String(value || '').replace(/\\D/g, '');
    if (d.length === 9) d = '998' + d;
    if (d.length < 7) return String(value || '');
    var tail = d.slice(-4);
    var head = d.length === 12 && d.indexOf('998') === 0 ? '+998 ' + d.slice(3, 5) : '+' + d.slice(0, d.length - 7);
    return head + ' *** ' + tail.slice(0, 2) + ' ' + tail.slice(2);
  }

  function currentPlanId() {
    var card = window.ghPlanModal && window.ghPlanModal.current ? window.ghPlanModal.current() : null;
    return card ? (card.getAttribute('data-plan-type') || '').trim() : '';
  }

  function setFieldsHidden(fields, hidden) {
    fields.forEach(function (f) { if (f) f.classList.toggle('gh-lead-field-hidden', hidden); });
  }

  /**
   * Память в форме: запомненный контакт вместо полей и «уже отправлено» для
   * планировки. Только на опубликованном сайте: в превью редактора контакт
   * показывать незачем.
   */
  function applyMemory(form) {
    if (!CONFIG.live || !isLeadForm(form)) return;
    decorate(form);
    var c = readContact();

    var planId = kindOf(form) === 'plan' ? currentPlanId() : '';
    var done = !!(planId && c.plans[planId]);
    form.classList.toggle('gh-lead-done', done);
    if (done) setStatus(form, L.planSent, false);

    var name = form.querySelector('input[name="name"]');
    var phone = phoneInput(form);
    var known = form.querySelector('.gh-lead-known');
    // Посетитель уже ввёл другое — не прячем его ввод за чужой маской.
    var typedOther = (phone && phone.value && phone.value !== c.phone) || (name && name.value && name.value !== c.name);
    if (!c.phone || typedOther || form.getAttribute('data-lead-edit') === '1') {
      if (known) known.parentNode.removeChild(known);
      setFieldsHidden([name, phone], false);
      return;
    }
    if (name && !name.value) name.value = c.name;
    if (phone && !phone.value) phone.value = c.phone;
    setFieldsHidden([name, phone], true);
    if (!known) {
      known = document.createElement('p');
      known.className = 'gh-lead-known';
      var who = document.createElement('span');
      who.className = 'gh-lead-who';
      var change = document.createElement('button');
      change.type = 'button';
      change.className = 'gh-lead-change';
      change.textContent = L.change;
      known.appendChild(who);
      known.appendChild(change);
      var first = name || phone;
      first.parentNode.insertBefore(known, first);
    }
    // textContent: имя ввёл посетитель — никакого HTML.
    known.querySelector('.gh-lead-who').textContent = (c.name ? c.name + ', ' : '') + maskPhone(c.phone);
  }

  function applyMemoryAll() {
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i++) applyMemory(forms[i]);
  }

  /** «Изменить»: поля снова видны (с запомненными значениями), фокус в телефон. */
  function editContact(form) {
    form.setAttribute('data-lead-edit', '1');
    applyMemory(form);
    var phone = phoneInput(form);
    if (phone) phone.focus();
  }

  function buildPayload(form, kind) {
    var data = new FormData(form);
    var fields = {};
    data.forEach(function (value, key) {
      if (SKIP_FIELDS[key] || typeof value !== 'string' || !value.trim()) return;
      if (Object.keys(fields).length < 10) fields[cut(key, 50)] = cut(value.trim(), 200);
    });
    var j = readJourney();
    var filters = readFilters();
    if (!Object.keys(filters).length && j.filters) filters = j.filters;
    var payload = {
      kind: kind,
      name: cut(String(data.get('name') || '').trim(), 100),
      phone: cut(String(data.get('phone') || (phoneInput(form) || {}).value || '').trim(), 40),
      email: cut(String(data.get('email') || '').trim(), 200),
      message: cut(String(data.get('message') || '').trim(), 1000),
      fields: fields,
      form: formTitle(form, kind),
      page: { path: cut(location.pathname, 500), title: cut(document.title, 300), lang: cut(document.documentElement.lang || '', 10), referrer: cut(document.referrer, 500) },
      filters: filters,
      journey: {
        firstSeen: j.firstSeen,
        visits: j.visits,
        referrer: j.referrer,
        pages: (j.pages || []).map(function (p) { return { path: p.path, title: p.title, seconds: p.seconds || 0 }; }),
        plans: j.plans || []
      },
      utm: j.utm,
      consent: true,
      hp: String(data.get(HP_NAME) || '')
    };
    if (kind === 'plan') payload.plan = planSnapshot();
    ['name', 'email', 'message'].forEach(function (k) { if (!payload[k]) delete payload[k]; });
    return payload;
  }

  function phoneOk(value) {
    var digits = String(value || '').replace(/\\D/g, '');
    return digits.length >= 9 && digits.length <= 15;
  }

  function send(form) {
    if (form.getAttribute('data-lead-busy') === '1') return;
    decorate(form);
    var kind = kindOf(form);
    var phone = phoneInput(form);
    if (!phoneOk(phone && phone.value)) {
      setStatus(form, L.phoneError, true);
      if (phone) phone.focus();
      return;
    }
    if (!CONFIG.live) { setStatus(form, L.preview, false); return; }
    // Эта планировка уже отправлена (форма спрятана, но Enter/скрипт — мимо).
    if (form.classList.contains('gh-lead-done')) return;

    flushTime();
    var payload = buildPayload(form, kind);
    form.setAttribute('data-lead-busy', '1');
    setButtons(form, L.sending, true);
    setStatus(form, '', false);

    var sentPlan = kind === 'plan' ? currentPlanId() : '';
    var done = function (ok, message) {
      form.removeAttribute('data-lead-busy');
      // Пока заявка шла, в окне открыли другую планировку: итог — про прошлую.
      // Запоминаем её, а форму новой не трогаем (там уже может быть ввод).
      if (kind === 'plan' && currentPlanId() !== sentPlan) {
        if (ok) rememberLead(payload);
        setButtons(form, null, false);
        applyMemoryAll();
        return;
      }
      if (ok) {
        rememberLead(payload);
        // Сначала сброс: он стирает статус (обработчик reset), потом «Спасибо».
        // После сброса память вернёт контакт (и «отправлено» для планировки).
        form.reset();
        setButtons(form, L.sent, true);
        setStatus(form, L.thanks, false);
        // Остальные формы страницы (форма проекта под окном планировки) —
        // сразу с запомненным контактом, без перезагрузки.
        applyMemoryAll();
        window.setTimeout(function () {
          // Уже ушла следующая заявка — её «Отправляем…» не трогаем.
          if (form.getAttribute('data-lead-busy') !== '1') setButtons(form, null, false);
        }, 4000);
        try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'lead_sent', leadKind: kind, page: location.pathname }); } catch (e) { /* ignore */ }
      } else {
        setButtons(form, null, false);
        setStatus(form, message, true);
      }
    };

    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    }).then(function (res) {
      if (res.ok) return done(true);
      if (res.status === 400) return done(false, L.phoneError);
      if (res.status === 429) return done(false, L.tooMany);
      done(false, L.error);
    }, function () { done(false, L.error); });
  }

  /* ── События ── */
  // Форму сбросили (после отправки; окно планировки — открывая другую
  // планировку): старый статус и режим правки не нужны. Память — после
  // сброса: событие reset приходит ДО очистки полей.
  document.addEventListener('reset', function (event) {
    var form = event.target;
    if (!isLeadForm(form)) return;
    setStatus(form, '', false);
    // «Заявка отправлена» на кнопке — про прошлую заявку (окно планировки:
    // следующая планировка открыта раньше, чем кнопка вернулась сама).
    if (form.getAttribute('data-lead-busy') !== '1') setButtons(form, null, false);
    form.removeAttribute('data-lead-edit');
    window.setTimeout(function () { applyMemory(form); }, 0);
  });

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!isLeadForm(form)) return;
    event.preventDefault();
    send(form);
  });

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var button = target.closest('button, input[type="submit"]');
    var form = button && button.form ? button.form : button && button.closest('form');
    if (button && isLeadForm(form) && button.classList.contains('gh-lead-change')) {
      event.preventDefault();
      editContact(form);
      return;
    }
    if (button && isLeadForm(form)) {
      var type = (button.getAttribute('type') || 'submit').toLowerCase();
      var looksLikeSend = type === 'submit' || button.classList.contains('submit') || button.classList.contains('commerce-submit');
      if (looksLikeSend) {
        event.preventDefault();
        send(form);
        return;
      }
    }
    if (!CONFIG.live) return;
    var card = target.closest('.apartment-card');
    if (card) recordPlan(card);
    if (target.closest('[data-filter-action="apply"]')) {
      var filters = readFilters();
      updateJourney(function (j) { j.filters = filters; });
    }
  });

  // Формы, которые дорисовывают скрипты (окно консультации Site JS), —
  // при первом фокусе.
  document.addEventListener('focusin', function (event) {
    var form = event.target && event.target.form;
    if (form) decorate(form);
  });

  if (CONFIG.live) {
    recordVisit();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushTime();
      else visibleSince = Date.now();
    });
    window.addEventListener('pagehide', flushTime);
  }

  function boot() { decorateAll(); applyMemoryAll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script>`

/**
 * Стили и скрипт заявок. `live` — опубликованная страница (деплой); в превью
 * заявки не отправляются.
 */
export function generateLeadRuntime(lang: string | undefined, live: boolean): string {
  return `${LEAD_CSS}\n${RUNTIME_JS({ live, labels: leadLabels(lang) })}`
}
