/**
 * Оверлеи страницы проекта: лайтбокс галереи и модалка планировки.
 *
 * Это служебный хром, а не контент, поэтому он не живёт блоком в структуре
 * страницы: иначе узлы видны в холсте редактора, их можно выделить, перетащить
 * или удалить — и молча сломать разворот галерей на всех страницах проектов.
 * Инжектится генератором, как рантайм карусели.
 *
 * Инжектится ТОЛЬКО когда на странице есть то, что оверлеи обслуживают:
 *   .media-card + карусель  → лайтбокс галереи
 *   .apartment-card         → модалка планировки
 * Так обычные страницы сайта не тащат лишнюю разметку.
 *
 * CSS оверлеев (.gallery-lightbox / .plan-modal и вложенные) живёт в globalCss
 * блоков страницы проекта: копия CSS дизайна в «О проекте», «Холлы», «Двор», а
 * правила, потерянные при переносе дизайна (крестики, окно и счётчик
 * лайтбокса), — в секции галерей (scripts/complexMedia.ts, OVERLAY_CHROME_RULES).
 * Отдельной копии здесь нет намеренно: стили правятся в CMS вместе с блоками.
 *
 * Публикует API для скриптов блоков:
 *   window.ghLightbox.open(images, index) / .close()
 *   window.ghPlanModal.open(card) / .close()
 */

/** Есть ли на странице галерея-карусель, которую разворачивает лайтбокс. */
function hasGallery(bodyHtml: string): boolean {
  return bodyHtml.includes('data-carousel-track') && bodyHtml.includes('media-card')
}

/** Есть ли карточки квартир, по клику на которые открывается модалка. */
function hasApartments(bodyHtml: string): boolean {
  return bodyHtml.includes('apartment-card')
}


/**
 * Подписи служебных оверлеев по языкам.
 *
 * Оверлеи инжектирует генератор, а не блок структуры, поэтому система
 * переводов их не видит: в `page.structure` этих узлов нет, и на узбекской
 * версии страницы они оставались русскими. Отсюда таблица подписей вместо
 * литералов в разметке.
 */
export interface OverlayLabels {
  close: string
  viewImage: string
  prevView: string
  nextView: string
  prevImage: string
  nextImage: string
  plan: string
  project: string
  /** Класс проекта («Комфорт+») — вместо цены: цен на сайте нет. */
  projectClass: string
  floor: string
  deadline: string
  cta: string
  floorUnknown: string
  deadlineUnknown: string
  planDescription: string
}

const OVERLAY_LABELS: Record<string, OverlayLabels> = {
  ru: {
    close: 'Закрыть', viewImage: 'Просмотр изображения', prevView: 'Предыдущий ракурс', nextView: 'Следующий ракурс',
    prevImage: 'Предыдущее изображение', nextImage: 'Следующее изображение',
    plan: 'Планировка', project: 'Проект', projectClass: 'Класс', floor: 'Этаж',
    deadline: 'Срок сдачи', cta: 'Получить консультацию',
    floorUnknown: 'Этаж уточняется',
    deadlineUnknown: 'Срок уточняется',
    planDescription: ' — планировка с продуманными жилыми зонами и доступом к инфраструктуре проекта.',
  },
  uz: {
    close: 'Yopish', viewImage: 'Rasmni ko‘rish', prevView: 'Oldingi rakurs', nextView: 'Keyingi rakurs',
    prevImage: 'Oldingi rasm', nextImage: 'Keyingi rasm',
    plan: 'Reja', project: 'Loyiha', projectClass: 'Sinf', floor: 'Qavat',
    deadline: 'Topshirish muddati', cta: 'Maslahat olish',
    floorUnknown: 'Qavat aniqlanmoqda',
    deadlineUnknown: 'Muddat aniqlanmoqda',
    planDescription: ' — puxta o‘ylangan yashash zonalari va loyiha infratuzilmasiga kirish imkoniga ega reja.',
  },
  en: {
    close: 'Close', viewImage: 'Image preview', prevView: 'Previous view', nextView: 'Next view',
    prevImage: 'Previous image', nextImage: 'Next image',
    plan: 'Floor plan', project: 'Project', projectClass: 'Class', floor: 'Floor',
    deadline: 'Completion', cta: 'Get a consultation',
    floorUnknown: 'Floor to be confirmed',
    deadlineUnknown: 'Date to be confirmed',
    planDescription: ' — a layout with well-planned living areas and access to the project infrastructure.',
  },
}

/** Подписи языка; неизвестный код падает на русский — дефолт сайта. */
export function overlayLabels(lang?: string): OverlayLabels {
  return OVERLAY_LABELS[lang || 'ru'] || OVERLAY_LABELS.ru
}

const LIGHTBOX_MARKUP = (L: OverlayLabels) => `
  <div class="gallery-lightbox" id="galleryLightbox" aria-hidden="true">
    <div class="gallery-lightbox-dialog" role="dialog" aria-modal="true" aria-label="${L.viewImage}">
      <button class="gallery-lightbox-close" type="button" aria-label="${L.close}">&times;</button>
      <button class="side-arrow left" type="button" id="galleryLightboxPrev" aria-label="${L.prevImage}">&#8249;</button>
      <img class="gallery-lightbox-image" id="galleryLightboxImage" alt="">
      <button class="side-arrow right" type="button" id="galleryLightboxNext" aria-label="${L.nextImage}">&#8250;</button>
      <div class="gallery-lightbox-counter" id="galleryLightboxCounter"></div>
    </div>
  </div>`

const PLAN_MODAL_MARKUP = (L: OverlayLabels) => `
  <div class="plan-modal" id="planModal" aria-hidden="true">
    <div class="plan-dialog" role="dialog" aria-modal="true" aria-labelledby="planModalTitle">
      <button class="plan-modal-close" type="button" aria-label="${L.close}">&times;</button>
      <div class="plan-modal-media" id="planModalMedia">
        <button class="side-arrow left" type="button" id="planModalPrev" aria-label="${L.prevView}">&#8249;</button>
        <button class="side-arrow right" type="button" id="planModalNext" aria-label="${L.nextView}">&#8250;</button>
      </div>
      <div class="plan-modal-info">
        <span class="section-eyebrow" id="planModalEyebrow">${L.plan}</span>
        <h3 id="planModalTitle"></h3>
        <p id="planModalText"></p>
        <div class="plan-modal-facts">
          <span><b id="planModalProject"></b>${L.project}</span>
          <span id="planModalClassFact"><b id="planModalClass"></b>${L.projectClass}</span>
          <span><b id="planModalFloor"></b>${L.floor}</span>
          <span><b id="planModalDeadline"></b>${L.deadline}</span>
        </div>
        <button class="plan-modal-cta" type="button">${L.cta}</button>
      </div>
    </div>
  </div>`

const RUNTIME_JS = (L: OverlayLabels) => `<script>
(function () {
  'use strict';

  var lightbox = document.getElementById('galleryLightbox');
  var image = document.getElementById('galleryLightboxImage');
  var counter = document.getElementById('galleryLightboxCounter');
  var shots = [];
  var at = 0;

  function drawShot() {
    if (!image || !shots.length) return;
    image.src = shots[at];
    if (counter) counter.textContent = (at + 1) + ' / ' + shots.length;
  }
  function openLightbox(images, index) {
    if (!lightbox || !image || !images || !images.length) return;
    closePlan();
    shots = images;
    at = ((index || 0) % images.length + images.length) % images.length;
    drawShot();
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    // Снимаем src: большой рендер не должен висеть в памяти после закрытия.
    if (image) image.removeAttribute('src');
  }
  function moveLightbox(step) {
    if (!shots.length) return;
    at = (at + step + shots.length) % shots.length;
    drawShot();
  }

  var modal = document.getElementById('planModal');
  var media = document.getElementById('planModalMedia');
  var plans = [];
  var planAt = 0;

  function drawPlan() {
    if (!media || !plans.length) return;
    media.style.setProperty('--modal-image', 'url("' + plans[planAt] + '")');
  }
  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value || '';
  }
  function textIn(card, selector) {
    var node = card.querySelector(selector);
    return node ? node.textContent.replace(/\\s+/g, ' ').trim() : '';
  }
  // Распроданный проект: «Распродано» на языке страницы — в надзаголовке окна.
  // Подпись приходит из данных проекта атрибутом секции; пусто — продаётся.
  function soldLabelOf(card) {
    var section = card.closest('[data-sold-label]');
    return section ? (section.getAttribute('data-sold-label') || '').trim() : '';
  }
  function openPlan(card) {
    if (!modal || !card) return;
    closeLightbox();
    // Содержимое берём из самой карточки: она уже отрисована на деплое,
    // второго источника данных для модалки заводить не нужно. Каждое поле —
    // из своего помеченного узла или атрибута карточки, а не разбором текста:
    // текст карточки меняется вместе с вёрсткой.
    var titleText = textIn(card, 'h3');
    var projectClass = textIn(card, '[data-apartment-class]');
    var sold = soldLabelOf(card);

    setText('planModalEyebrow', sold ? ${JSON.stringify(L.plan)} + ' · ' + sold : ${JSON.stringify(L.plan)});
    setText('planModalTitle', titleText || ${JSON.stringify(L.plan)});
    setText('planModalProject', textIn(card, '[data-card-project]'));
    setText('planModalClass', projectClass);
    // Класса у проекта может не быть — пустой пункт выглядел бы поломкой.
    // display, а не hidden: правило вида .plan-modal-facts span { display: … }
    // перебило бы скрытие из браузерной таблицы стилей.
    var classFact = document.getElementById('planModalClassFact');
    if (classFact) classFact.style.display = projectClass ? '' : 'none';
    setText('planModalFloor', textIn(card, '[data-card-floors]') || ${JSON.stringify(L.floorUnknown)});
    setText('planModalDeadline', (card.getAttribute('data-deadline') || '').trim() || ${JSON.stringify(L.deadlineUnknown)});
    setText('planModalText', titleText
      ? titleText + ${JSON.stringify(L.planDescription)}
      : '');

    var raw = card.getAttribute('data-plan-images') || '';
    plans = raw.split('|').filter(Boolean);
    planAt = 0;
    if (media) {
      if (plans.length) { drawPlan(); media.classList.add('has-image'); }
      else media.classList.remove('has-image');
    }
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }
  function closePlan() {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }
  function movePlan(step) {
    if (!plans.length) return;
    planAt = (planAt + step + plans.length) % plans.length;
    drawPlan();
  }

  function on(node, handler) {
    if (node) node.addEventListener('click', function (e) { e.stopPropagation(); handler(); });
  }
  if (lightbox) {
    on(lightbox.querySelector('.gallery-lightbox-close'), closeLightbox);
    on(document.getElementById('galleryLightboxPrev'), function () { moveLightbox(-1); });
    on(document.getElementById('galleryLightboxNext'), function () { moveLightbox(1); });
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });
  }
  if (modal) {
    on(modal.querySelector('.plan-modal-close'), closePlan);
    on(document.getElementById('planModalPrev'), function () { movePlan(-1); });
    on(document.getElementById('planModalNext'), function () { movePlan(1); });
    modal.addEventListener('click', function (e) { if (e.target === modal) closePlan(); });
    var cta = modal.querySelector('.plan-modal-cta');
    if (cta) cta.addEventListener('click', function () {
      closePlan();
      var lead = document.getElementById('lead');
      if (lead && lead.scrollIntoView) lead.scrollIntoView({ behavior: 'smooth' });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (lightbox && lightbox.classList.contains('is-open')) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') moveLightbox(-1);
      if (e.key === 'ArrowRight') moveLightbox(1);
      return;
    }
    if (modal && modal.classList.contains('is-open')) {
      if (e.key === 'Escape') closePlan();
      if (e.key === 'ArrowLeft') movePlan(-1);
      if (e.key === 'ArrowRight') movePlan(1);
    }
  });

  // Клик по карточке квартиры открывает модалку. Слушаем на документе, чтобы
  // работали и карточки, дорисованные репитером после загрузки.
  if (modal) {
    document.addEventListener('click', function (event) {
      var card = event.target.closest && event.target.closest('.apartment-card');
      if (card) openPlan(card);
    });
  }

  window.ghLightbox = { open: openLightbox, close: closeLightbox };
  window.ghPlanModal = { open: openPlan, close: closePlan };
})();
</script>`

/**
 * Разметка и скрипт оверлеев для страницы. Пустая строка, если на странице нет
 * ни галерей, ни карточек квартир.
 */
export function generateComplexOverlays(bodyHtml: string, lang?: string): string {
  const gallery = hasGallery(bodyHtml)
  const apartments = hasApartments(bodyHtml)
  if (!gallery && !apartments) return ''

  const L = overlayLabels(lang)
  const parts: string[] = []
  if (gallery) parts.push(LIGHTBOX_MARKUP(L))
  if (apartments) parts.push(PLAN_MODAL_MARKUP(L))
  parts.push(RUNTIME_JS(L))
  return parts.join('\n')
}
