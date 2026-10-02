/**
 * Universal Carousel Widget Runtime.
 *
 * Возвращает строку JS, инжектящуюся в <body> публикуемой страницы.
 * Декларативный контракт через data-атрибуты:
 *
 *   [data-carousel="true"]            — корень слайдера
 *   [data-carousel-autoplay="5000"]   — автопрокрутка, мс (0/нет = выкл)
 *   [data-carousel-loop="true"]       — зацикленность (по умолчанию true)
 *   [data-carousel-video-wait="true"] — при автоплее видео-слайды листаются только
 *                                       после окончания видео (видео не зацикливается)
 *   [data-carousel-track="true"]      — контейнер с слайдами (прямые дети = слайды)
 *   [data-carousel-slide="true"]      — атрибут на каждом слайде (для надёжной фильтрации)
 *   [data-slide-video="<url>"]        — видео-фон слайда; постер = его background-image.
 *                                       Видео muted+loop+playsinline, играет только активный слайд.
 *   [data-carousel-prev]              — клик: prev
 *   [data-carousel-next]              — клик: next
 *   [data-carousel-counter]           — элемент-счётчик; textContent = "01 / 04"
 *   [data-carousel-dots]              — контейнер пагинации
 *   [data-carousel-dot]               — точка-шаблон (внутри dots);
 *                                       если найдена — клонируется по числу слайдов;
 *                                       если в dots уже есть готовые элементы — используем их
 *   [data-carousel-active-class]      — на корне; класс активной точки (default: "active")
 *   [data-carousel-effect]            — тип перехода (default: "slide"):
 *                                       slide          — горизонтальный сдвиг трека
 *                                       slide-vertical — вертикальный сдвиг трека
 *                                       fade           — перетекание прозрачностью
 *                                       zoom           — наплыв с уменьшением масштаба
 *                                       zoom-out       — наплыв с увеличением масштаба
 *                                       none           — мгновенная смена
 *                                       Неизвестное значение трактуется как "slide".
 *   [data-carousel-duration]          — длительность перехода, мс (по умолчанию зависит
 *                                       от эффекта: 500 для сдвига, 600 для наплыва, 0 для none)
 *   [data-carousel-slide-active-class]— класс активного слайда (default: "is-active"),
 *                                       при любом эффекте; за него цепляется CSS вёрстки
 *   [data-carousel-infinite="false"]  — выключить бесконечную ленту. По умолчанию при
 *                                       эффектах сдвига и зацикливании лента бесконечна:
 *                                       с последнего слайда «вперёд» едет дальше на первый,
 *                                       с первого «назад» — на последний, без перемотки
 *                                       через все слайды. Для этого по краям трека
 *                                       стоят копии крайних слайдов (data-carousel-clone,
 *                                       без data-carousel-slide — скрипты вёрстки их не считают).
 *   [data-carousel-swipe="mobile,tablet"] — экраны (id брейкпоинтов страницы из
 *                                       window.__ghBreakpoints), где слайды листаются
 *                                       жестом: пальцем, пером, перетаскиванием мышью.
 *                                       Нет атрибута или пуст — жестом не листается.
 *                                       При одном слайде жест не перехватывается вовсе.
 *                                       Где свайп работает сейчас, на корне стоит
 *                                       data-carousel-swipe-active="true".
 *
 *   [data-header-theme="dark|light"]  — на слайде: фон под шапкой сайта (ставит редактор
 *                                       или CMS при публикации по яркости верха фото).
 *                                       У видео-слайда без метки runtime раз в секунду
 *                                       оценивает кадр (8×4) и пишет data-header-theme-live,
 *                                       пока карусель у верха экрана и вкладка видна.
 *
 * При смене слайда и темы кадра на корне всплывает событие carousel:change
 * (detail: index, slide, reason 'slide' | 'theme') — по нему шапка сайта
 * перекрашивается без опроса.
 *
 * Число слайдов runtime пишет на корень: data-carousel-count="N" — за него
 * может цепляться CSS вёрстки (например, спрятать пустую галерею). Кнопки
 * prev/next, точки и счётчик при N < 2 скрываются: листать нечего, а мёртвая
 * стрелка выглядит поломкой. Появится второй слайд — вернутся.
 *
 * Layout: track становится display:flex с width = N*100%, каждый слайд flex:0 0 100%.
 * Анимация через CSS transition на transform, либо JS scroll fallback.
 *
 * Перерисовка при mutation track.children (нужно для repeater из DataBindingGenerator).
 */
import { BREAKPOINT_RUNTIME_JS } from './breakpointRuntime'

export function generateCarouselRuntime(): string {
  return `<script>
(function(){
  'use strict';
${BREAKPOINT_RUNTIME_JS}
  var ACTIVE_CLASS_DEFAULT = 'active';
  /** Жест короче — не листает (случайное касание, дрожание мыши). */
  var SWIPE_MIN_PX = 40;
  /** После такого сдвига ясно, куда жест: вбок — карусели, вверх-вниз — странице. */
  var SWIPE_LOCK_PX = 10;
  /** Столько после перетаскивания мышью гасим click: он пришёл бы по ссылке под курсором. */
  var SWIPE_CLICK_GUARD_MS = 400;
  var SLIDE_ACTIVE_CLASS_DEFAULT = 'is-active';
  var EFFECT_DEFAULT = 'slide';

  // Реестр типов перехода. stacked = слайды лежат друг на друге (переход рисуется
  // прозрачностью/трансформом), иначе двигается сам трек.
  // hidden/shown — стили неактивного и активного слайда, между ними и идёт анимация.
  var EFFECTS = {
    'slide':          { stacked: false, duration: 500 },
    'slide-vertical': { stacked: false, duration: 500 },
    'fade':           { stacked: true,  duration: 600,
                        hidden: { opacity: '0' }, shown: { opacity: '1' } },
    'zoom':           { stacked: true,  duration: 600,
                        hidden: { opacity: '0', transform: 'scale(1.06)' },
                        shown:  { opacity: '1', transform: 'scale(1)' } },
    'zoom-out':       { stacked: true,  duration: 600,
                        hidden: { opacity: '0', transform: 'scale(0.94)' },
                        shown:  { opacity: '1', transform: 'scale(1)' } },
    'none':           { stacked: true,  duration: 0,
                        hidden: { opacity: '0' }, shown: { opacity: '1' } }
  };

  function init(root) {
    if (root.__carouselInit) return;
    root.__carouselInit = true;

    var track = root.querySelector('[data-carousel-track="true"]');
    if (!track) return;

    var autoplay = parseInt(root.getAttribute('data-carousel-autoplay') || '0', 10);
    var loop = root.getAttribute('data-carousel-loop') !== 'false';
    // «Смотреть видео до конца»: при автоплее видео-слайд листается не по таймеру, а по 'ended'.
    var videoWait = root.getAttribute('data-carousel-video-wait') === 'true';
    var activeClass = root.getAttribute('data-carousel-active-class') || ACTIVE_CLASS_DEFAULT;

    // Тип перехода. 'slide'/'slide-vertical' двигают трек; остальные кладут слайды
    // друг на друга и меняют прозрачность/масштаб. Неизвестное значение — как 'slide':
    // опечатка в атрибуте не должна ронять карусель.
    var effect = root.getAttribute('data-carousel-effect') || EFFECT_DEFAULT;
    if (!EFFECTS[effect]) effect = EFFECT_DEFAULT;
    var stacked = EFFECTS[effect].stacked;
    var vertical = effect === 'slide-vertical';
    var slideActiveClass = root.getAttribute('data-carousel-slide-active-class') || SLIDE_ACTIVE_CLASS_DEFAULT;
    var duration = parseInt(root.getAttribute('data-carousel-duration') || '', 10);
    if (!isFinite(duration) || duration < 0) duration = EFFECTS[effect].duration;

    // Бесконечная лента — только у сдвига: у перетекания и наплыва направления нет.
    var infinite = root.getAttribute('data-carousel-infinite') !== 'false' && !stacked && loop;
    /** [копия последнего слайда — перед первым, копия первого — после последнего]. */
    var clones = [];
    /** Лента стоит на копии за краем и ждёт перескока на настоящий слайд. */
    var wrapTimer = null;

    var prevBtn = root.querySelector('[data-carousel-prev]');
    var nextBtn = root.querySelector('[data-carousel-next]');
    var dotsContainer = root.querySelector('[data-carousel-dots]');
    var counterEl = root.querySelector('[data-carousel-counter]');

    var state = { index: 0, slides: [], dots: [], timer: null, interacting: false, swiping: false, dotActiveStyle: '', dotInactiveStyle: '' };

    function getSlides() {
      // Только прямые дети track. Фильтруем по data-carousel-slide если есть, иначе все children.
      // Исключаем скрытые (display:none) — это template-слайд для repeater'а.
      var children = Array.prototype.slice.call(track.children);
      var visible = children.filter(function(c){ return c.style && c.style.display !== 'none' && !isClone(c); });
      var marked = visible.filter(function(c){ return c.getAttribute && c.getAttribute('data-carousel-slide') === 'true'; });
      return marked.length ? marked : visible;
    }

    // Раскладка для stacked-эффектов: слайды друг на друге, трек не двигается.
    // Если вёрстка уже позиционирует слайды абсолютно (так сделан герой в дизайне),
    // не трогаем позиционирование — иначе сломаем чужой CSS. Если слайды в потоке,
    // первый оставляем в потоке (он держит габарит), остальные накладываем поверх.
    // Ширину трека не трогаем: stacked её не задаёт, а стереть авторскую width:100%
    // у абсолютного трека — значит схлопнуть его и все слайды в 0 (галереи холлов
    // и двора показывали только обложку карточки, стрелки «листали» невидимое).
    function applyStackedLayout(n) {
      track.style.display = 'block';
      track.style.transform = '';
      track.style.transition = '';
      var already = window.getComputedStyle(state.slides[0]).position === 'absolute';
      if (!already && window.getComputedStyle(track).position === 'static') {
        track.style.position = 'relative';
      }
      for (var i = 0; i < n; i++) {
        var s = state.slides[i];
        s.style.flex = '';
        s.style.minWidth = '';
        s.style.maxWidth = '';
        if (!already) {
          s.style.position = i === 0 ? 'relative' : 'absolute';
          if (i > 0) { s.style.top = '0'; s.style.left = '0'; s.style.width = '100%'; s.style.height = '100%'; }
        }
        s.style.transition = duration > 0
          ? ('opacity ' + duration + 'ms ease, transform ' + duration + 'ms ease')
          : 'none';
      }
      var holder = track.parentElement && track.parentElement !== root ? track.parentElement : root;
      holder.style.overflow = 'hidden';
    }

    // --- Бесконечная лента: копии крайних слайдов ---
    function isClone(el) {
      return !!(el && el.getAttribute && el.getAttribute('data-carousel-clone') === 'true');
    }

    // Копия нужна только глазу: лента задерживается на ней на время перехода.
    // С клавиатуры и для диктора её нет, id не дублируются, скрипты вёрстки
    // слайдом её не считают. Видео копии заводится заново и только на время
    // перехода через край (edgeVideo) — скопированное играло бы всегда.
    function makeClone(slide) {
      var c = slide.cloneNode(true);
      c.removeAttribute('data-carousel-slide');
      c.setAttribute('data-carousel-clone', 'true');
      c.setAttribute('aria-hidden', 'true');
      c.setAttribute('inert', '');
      c.removeAttribute('id');
      var inner = c.querySelectorAll('[id]');
      for (var i = 0; i < inner.length; i++) inner[i].removeAttribute('id');
      var videos = c.querySelectorAll('video[data-carousel-video="true"]');
      for (var j = 0; j < videos.length; j++) videos[j].parentNode.removeChild(videos[j]);
      return c;
    }

    function syncClones() {
      for (var i = 0; i < clones.length; i++) {
        if (clones[i].parentNode) clones[i].parentNode.removeChild(clones[i]);
      }
      clones = [];
      var n = state.slides.length;
      if (!infinite || n < 2) return;
      var first = state.slides[0];
      var last = state.slides[n - 1];
      var head = makeClone(last);
      var tail = makeClone(first);
      // Обе копии — в DOM после слайдов, копия последнего встаёт перед первым
      // только на экране (order). Так querySelector по data-element-id находит
      // настоящий слайд, а не его копию: у копий те же data-element-id, чтобы
      // на них действовали те же стили, что у слайда.
      head.style.order = '-1';
      track.insertBefore(tail, last.nextSibling);
      track.insertBefore(head, tail.nextSibling);
      clones = [head, tail];
    }

    /** Клетки трека: слайды и, у бесконечной ленты, копии по краям. */
    function cellCount() {
      return state.slides.length + clones.length;
    }

    /** Клетка трека, где стоит слайд с индексом i. */
    function cellOf(i) {
      return clones.length ? i + 1 : i;
    }

    function moveTrackTo(cell) {
      var pct = -(cell * (100 / cellCount()));
      track.style.transform = (vertical ? 'translateY(' : 'translateX(') + pct + '%)';
    }

    // Лента доехала до копии за краем — без анимации встаёт на настоящий слайд:
    // картинка та же, подмены не видно.
    function finishWrap() {
      if (wrapTimer === null) return;
      clearTimeout(wrapTimer);
      wrapTimer = null;
      track.style.transition = 'none';
      moveTrackTo(cellOf(state.index));
      void track.offsetWidth; // браузер фиксирует положение до возврата анимации
      track.style.transition = 'transform ' + duration + 'ms ease';
      for (var i = 0; i < clones.length; i++) pauseSlideVideo(clones[i]);
    }

    function applyTrackLayout() {
      var n = state.slides.length;
      if (n === 0) return;
      if (stacked) { applyStackedLayout(n); return; }
      var cells = clones.length ? [clones[0]].concat(state.slides, [clones[1]]) : state.slides;
      track.style.display = 'flex';
      if (vertical) track.style.flexDirection = 'column';
      track.style[vertical ? 'height' : 'width'] = (cells.length * 100) + '%';
      track.style.transition = 'transform ' + duration + 'ms ease';
      for (var i = 0; i < cells.length; i++) {
        var s = cells[i];
        s.style.flex = '0 0 ' + (100 / cells.length) + '%';
        s.style[vertical ? 'height' : 'width'] = (100 / cells.length) + '%';
        // Очищаем конкурирующие inline-свойства, которые могли прийти из БД
        // (особенно у hybrid-static-слайдов): min-width/max-width в flex-item
        // резолвятся ОТ track-width (= n*100% viewport), что растягивает слайд
        // на N viewports и ломает transform всей карусели.
        // ВАЖНО: flex-basis НЕ трогаем — его уже задал shorthand "flex" выше,
        // его сброс пересобирает shorthand и обнуляет basis.
        s.style.minWidth = '';
        s.style.maxWidth = '';
      }
      // overflow:hidden на родителе track (чтобы соседние слайды не торчали)
      var parent = track.parentElement;
      if (parent && parent !== root) {
        parent.style.overflow = 'hidden';
      } else {
        root.style.overflow = 'hidden';
      }
    }

    function snapshotDotStyles() {
      // Запоминаем cssText первой и второй точки как 'активный' и 'неактивный' стайл.
      // Это нужно когда дизайнер задаёт активность через inline-стили (а не через .active класс).
      if (state.dots.length >= 2) {
        if (!state.dotActiveStyle) state.dotActiveStyle = state.dots[0].style.cssText;
        if (!state.dotInactiveStyle) state.dotInactiveStyle = state.dots[1].style.cssText;
      }
    }

    function readProp(cssText, prop) {
      if (!cssText) return '';
      var t = document.createElement('div');
      t.style.cssText = cssText;
      return t.style.getPropertyValue(prop);
    }

    // Постоянный transition точек: из снимка стиля (если дизайнер задал) либо дефолт.
    function dotTransition() {
      return readProp(state.dotActiveStyle, 'transition')
          || readProp(state.dotInactiveStyle, 'transition')
          || 'all 0.35s ease';
    }

    // Применяет снимок стиля точки ПО-СВОЙСТВАМ (не через cssText) и БЕЗ transition.
    // Так смена значений (width/background/…) надёжно запускает переход, а постоянный
    // transition не сбрасывается заменой cssText (это и давало «рваный» своп).
    function applyDotStyle(dot, snapshot) {
      if (!snapshot) return;
      var t = document.createElement('div');
      t.style.cssText = snapshot;
      for (var k = 0; k < t.style.length; k++) {
        var prop = t.style[k];
        if (prop.indexOf('transition') === 0) continue;
        dot.style.setProperty(prop, t.style.getPropertyValue(prop), t.style.getPropertyPriority(prop));
      }
    }

    function rebuildDots() {
      if (!dotsContainer) return;
      var existing = Array.prototype.slice.call(dotsContainer.children);
      var marked = existing.filter(function(el){ return el.getAttribute && el.getAttribute('data-carousel-dot') === 'true'; });
      var template = dotsContainer.querySelector('[data-carousel-dot]');

      // Pre-snapshot inline-стилей ДО любого изменения DOM. Иначе при N != existing.length
      // мы попадаем в Case 2 (clone template) и теряем шанс снять inactive-стиль с
      // существующих dots — все клоны остаются с активным стилем (bug pre-Stage6c).
      // Условие state.dots.length>=2 сохраняется только в snapshotDotStyles() — здесь
      // снимаем напрямую с existing для надёжности.
      if (existing.length >= 1 && !state.dotActiveStyle) {
        state.dotActiveStyle = existing[0].style.cssText;
      }
      if (existing.length >= 2 && !state.dotInactiveStyle) {
        state.dotInactiveStyle = existing[1].style.cssText;
      }

      // Случай 1: есть готовые dots в нужном количестве — используем как есть.
      if (existing.length === state.slides.length && existing.length > 0) {
        state.dots = existing;
        snapshotDotStyles();
        for (var k = 0; k < existing.length; k++) {
          existing[k].classList.remove(activeClass);
          if (!existing[k].style.transition) existing[k].style.transition = dotTransition();
          (function(idx, el){
            el.addEventListener('click', function(){ goTo(idx, true); });
          })(k, existing[k]);
        }
        return;
      }

      // Случай 2: один шаблон-точка — клонируем по числу слайдов
      if (template) {
        var tplClone = template.cloneNode(true);
        // Очищаем контейнер
        while (dotsContainer.firstChild) dotsContainer.removeChild(dotsContainer.firstChild);
        state.dots = [];
        for (var i = 0; i < state.slides.length; i++) {
          var dot = tplClone.cloneNode(true);
          dot.removeAttribute('data-carousel-dot');
          dot.classList.remove(activeClass);
          dot.setAttribute('data-carousel-dot-index', String(i));
          // Начальное (неактивное) состояние без анимации: transition:none + reflow,
          // затем включаем постоянный transition — чтобы стартовая раскладка не «прыгала»,
          // а последующие свопы активной/неактивной анимировались плавно.
          dot.style.transition = 'none';
          applyDotStyle(dot, state.dotInactiveStyle);
          void dot.offsetWidth;
          dot.style.transition = dotTransition();
          (function(idx){
            dot.addEventListener('click', function(){ goTo(idx, true); });
          })(i);
          dotsContainer.appendChild(dot);
          state.dots.push(dot);
        }
        return;
      }

      // Случай 3: ничего не подошло — без точек
      state.dots = [];
    }

    // --- Видео-фоны слайдов: data-slide-video="<url>" ---
    // Постером служит background-image слайда (виден, пока видео не проиграется).
    // Видео создаётся лениво при первом показе слайда; muted+loop+playsinline —
    // браузеры разрешают autoplay только без звука.
    function ensureSlideVideo(slide) {
      var url = slide.getAttribute && slide.getAttribute('data-slide-video');
      if (!url) return null;
      var v = slide.querySelector('video[data-carousel-video="true"]');
      if (!v) {
        if (window.getComputedStyle(slide).position === 'static') slide.style.position = 'relative';
        v = document.createElement('video');
        v.setAttribute('data-carousel-video', 'true');
        v.muted = true; v.defaultMuted = true; v.autoplay = true;
        // «Смотреть видео до конца» + автоплей: НЕ зацикливаем, иначе 'ended' не сработает.
        // В обычном режиме видео крутится бесконечно как фон. Единственный слайд
        // листать некуда — его видео тоже крутится по кругу.
        var oneShot = videoWait && autoplay > 0 && state.slides.length > 1;
        v.loop = !oneShot;
        v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
        v.playsInline = true; v.preload = 'none';
        // Вписывание видео = вписыванию постера слайда: data-slide-fit (cover|contain).
        var fit = slide.getAttribute('data-slide-fit') || 'cover';
        // Точка фокуса видео = фокусу постера: background-position из вёрстки слайда.
        // Берём инлайн, а не computed: у слайда без фона computed даёт «0% 0%»
        // и прижал бы видео к углу вместо центра.
        var focus = slide.style.backgroundPosition || 'center';
        v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:' + fit +
          ';object-position:' + focus + ';pointer-events:none;z-index:0;';
        var s = document.createElement('source');
        s.src = url; v.appendChild(s);
        slide.insertBefore(v, slide.firstChild);
        if (oneShot) {
          // Видео доиграло (или сломалось) → листаем дальше, если слайд ещё активен и нет hover.
          var advanceAfterVideo = function(){
            if (state.slides[state.index] !== slide) return;
            if (state.interacting) return;
            next(); restartAutoplay();
          };
          v.addEventListener('ended', advanceAfterVideo);
          v.addEventListener('error', advanceAfterVideo);
        }
      }
      return v;
    }
    function playSlideVideo(slide) {
      var v = ensureSlideVideo(slide);
      if (v) { try { v.currentTime = 0; var p = v.play(); if (p && p.catch) p.catch(function(){}); } catch(e){} }
    }
    function pauseSlideVideo(slide) {
      var v = slide.querySelector && slide.querySelector('video[data-carousel-video="true"]');
      if (v) { try { v.pause(); } catch(e){} }
    }

    // Показ активного слайда для stacked-эффектов: активному снимаем hidden-стиль,
    // остальным ставим. Класс на слайде выставляем всегда — за него цепляется CSS
    // вёрстки (в дизайне это .complex-hero-slide.is-active).
    function renderStacked() {
      var spec = EFFECTS[effect];
      for (var i = 0; i < state.slides.length; i++) {
        var s = state.slides[i];
        var isActive = i === state.index;
        var style = isActive ? (spec.shown || {}) : (spec.hidden || {});
        s.classList.toggle(slideActiveClass, isActive);
        for (var prop in style) {
          if (!Object.prototype.hasOwnProperty.call(style, prop)) continue;
          s.style[prop] = style[prop];
        }
        s.style.zIndex = isActive ? '1' : '0';
      }
    }

    // --- Тема шапки над каруселью ---
    // Шапка сайта (скрипт блока «Navigation») красит текст по фону под собой.
    // Над каруселью этот фон — активный слайд: его метку data-header-theme
    // ставит редактор вручную или CMS при публикации (по яркости верха фото).
    // Кадр видео CMS разобрать нечем — его оценивает runtime и пишет
    // data-header-theme-live. О смене слайда и темы кадра карусель сообщает
    // событием carousel:change (всплывает до document).
    var THEME_SAMPLE_MS = 1000;
    /** Гистерезис: между порогами тема не меняется — шапка не мигает на полутонах. */
    var THEME_DARK_BELOW = 130;
    var THEME_LIGHT_ABOVE = 150;
    var THEME_SPLIT = 140;
    /** Карусель под шапкой, только если её верх выше этой линии экрана. */
    var THEME_ZONE_PX = 240;
    var themeCanvas = null, themeCtx = null, themeTimer = null, themePending = null, themeBroken = false;

    function announce(reason) {
      var detail = { index: state.index, slide: state.slides[state.index] || null, reason: reason };
      var ev;
      try {
        ev = new CustomEvent('carousel:change', { bubbles: true, detail: detail });
      } catch (e) {
        ev = document.createEvent('CustomEvent');
        ev.initCustomEvent('carousel:change', true, false, detail);
      }
      root.dispatchEvent(ev);
    }

    function stopVideoTheme() {
      if (themeTimer) { clearInterval(themeTimer); themeTimer = null; }
      themePending = null;
    }

    /** Яркость (YIQ, 0..255) верхней четверти кадра по центральным 70% ширины — то, над чем шапка. */
    function frameBrightness(v) {
      var w = v.videoWidth, h = v.videoHeight;
      if (!w || !h) return null;
      try {
        if (!themeCanvas) {
          themeCanvas = document.createElement('canvas');
          themeCanvas.width = 8; themeCanvas.height = 4;
          themeCtx = themeCanvas.getContext('2d', { willReadFrequently: true });
        }
        if (!themeCtx) { themeBroken = true; stopVideoTheme(); return null; }
        themeCtx.drawImage(v, w * 0.15, 0, w * 0.7, h * 0.25, 0, 0, 8, 4);
        var d = themeCtx.getImageData(0, 0, 8, 4).data;
        var sum = 0;
        for (var i = 0; i < d.length; i += 4) sum += (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
        return sum / (d.length / 4);
      } catch (e) {
        // Видео с чужого сервера без CORS «портит» canvas — следить за ним нельзя.
        themeBroken = true;
        stopVideoTheme();
        return null;
      }
    }

    /** Ручная тема слайда — только dark | light (auto и прочее — решают кадры). */
    function hasManualTheme(slide) {
      var t = slide.getAttribute('data-header-theme');
      return t === 'dark' || t === 'light';
    }

    function sampleVideoTheme() {
      var slide = state.slides[state.index];
      if (!slide || hasManualTheme(slide) || document.hidden) return;
      var v = slide.querySelector('video[data-carousel-video="true"]');
      if (!v || v.paused || v.readyState < 2) return;
      var box = root.getBoundingClientRect();
      if (box.top > THEME_ZONE_PX || box.bottom <= 0) return;
      var b = frameBrightness(v);
      if (b === null) return;
      var current = slide.getAttribute('data-header-theme-live');
      var next = b < THEME_DARK_BELOW ? 'dark'
        : b > THEME_LIGHT_ABOVE ? 'light'
        : (current || (b < THEME_SPLIT ? 'dark' : 'light'));
      if (next === current) { themePending = null; return; }
      // Первая оценка кадра — сразу; смена — после двух одинаковых оценок подряд.
      if (current && themePending !== next) { themePending = next; return; }
      themePending = null;
      slide.setAttribute('data-header-theme-live', next);
      announce('theme');
    }

    /** Следить за кадрами — только у видео-слайда без своей метки. Раз в секунду, дёшево. */
    function syncVideoTheme() {
      stopVideoTheme();
      var slide = state.slides[state.index];
      if (themeBroken || !slide || hasManualTheme(slide) || !slide.getAttribute('data-slide-video')) return;
      themeTimer = setInterval(sampleVideoTheme, THEME_SAMPLE_MS);
      var v = slide.querySelector('video[data-carousel-video="true"]');
      if (!v) return;
      if (v.readyState >= 2) setTimeout(sampleVideoTheme, 0);
      else v.addEventListener('loadeddata', sampleVideoTheme, { once: true });
    }

    /** cell — клетка трека, куда ехать; по умолчанию — клетка активного слайда. */
    function update(cell) {
      var n = state.slides.length;
      if (n === 0) return;
      if (stacked) {
        renderStacked();
      } else {
        // translate в процентах от трека (его размер — число клеток × 100%)
        moveTrackTo(cell === undefined ? cellOf(state.index) : cell);
        // Класс активного слайда нужен и при сдвиге: по нему скрипты вёрстки
        // (лайтбокс галереи) и CSS находят текущий кадр. Раньше его ставил
        // только renderStacked, и смена эффекта в редакторе их ломала.
        for (var ai = 0; ai < n; ai++) {
          state.slides[ai].classList.toggle(slideActiveClass, ai === state.index);
        }
        // Копия выглядит как свой слайд и во время перехода: класс — вслед за ним.
        if (clones.length) {
          clones[0].classList.toggle(slideActiveClass, state.index === n - 1);
          clones[1].classList.toggle(slideActiveClass, state.index === 0);
        }
      }
      for (var i = 0; i < state.dots.length; i++) {
        var dot = state.dots[i];
        if (i === state.index) {
          dot.classList.add(activeClass);
          applyDotStyle(dot, state.dotActiveStyle);
        } else {
          dot.classList.remove(activeClass);
          applyDotStyle(dot, state.dotInactiveStyle);
        }
      }
      // Счётчик "01 / 04" (zero-pad), если задан data-carousel-counter
      if (counterEl) {
        var pad = function(x){ return (x < 10 ? '0' : '') + x; };
        counterEl.textContent = pad(state.index + 1) + ' / ' + pad(n);
      }
      // Видео-фоны: проигрываем активный слайд, остальные ставим на паузу.
      for (var vi = 0; vi < state.slides.length; vi++) {
        if (vi === state.index) playSlideVideo(state.slides[vi]);
        else pauseSlideVideo(state.slides[vi]);
      }
      // Шапка над каруселью перекрашивается по активному слайду.
      announce('slide');
      syncVideoTheme();
    }

    function goTo(i, userInteraction) {
      var n = state.slides.length;
      if (n === 0) return;
      // Прошлый переход ещё стоит на копии за краем — сначала на настоящий слайд.
      finishWrap();
      var target = loop ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
      // Тот же слайд — ничего не делаем: update() начал бы его видео с начала.
      // Так свайп по «О проекте» с одним видео перезапускал ролик, а нажатие на
      // точку открытого слайда — его.
      if (target === state.index) return;
      state.index = target;
      // Шаг за край бесконечной ленты: едем на копию за краем, а по окончании
      // перехода — без анимации на настоящий слайд.
      var edge = null;
      if (clones.length && i >= n) edge = n + 1;
      else if (clones.length && i < 0) edge = 0;
      if (edge === null) {
        update();
      } else {
        update(edge);
        // Видео-слайд без постера на копии был бы пустым кадром. Видео копии
        // стартует вместе с видео настоящего слайда — после перескока подмены не видно.
        playSlideVideo(edge === 0 ? clones[0] : clones[1]);
        wrapTimer = setTimeout(finishWrap, duration);
      }
      if (userInteraction) restartAutoplay();
    }

    function next() { goTo(state.index + 1, false); }
    function prev() { goTo(state.index - 1, false); }

    function startAutoplay() {
      stopAutoplay();
      if (autoplay > 0 && state.slides.length > 1) {
        state.timer = setInterval(function(){
          if (state.interacting || state.swiping) return;
          // «Смотреть видео до конца»: пока активное видео не доиграло — не листаем по
          // таймеру (уход обеспечит 'ended'-обработчик). Так длинное видео не обрежется.
          if (videoWait) {
            var cur = state.slides[state.index];
            var vv = cur && cur.querySelector && cur.querySelector('video[data-carousel-video="true"]');
            if (vv && !vv.ended && !vv.error) return;
          }
          next();
        }, autoplay);
      }
    }
    function stopAutoplay() {
      if (state.timer) { clearInterval(state.timer); state.timer = null; }
    }
    function restartAutoplay() { startAutoplay(); }

    // Прячет элемент управления, запомнив его собственный inline display, и
    // возвращает ровно его: вёрстка могла задать кнопке display прямо в style.
    function setControlShown(el, shown) {
      if (!el) return;
      var hiddenByUs = el.getAttribute('data-carousel-hidden') === 'true';
      if (!shown && !hiddenByUs) {
        el.setAttribute('data-carousel-display', el.style.display || '');
        el.setAttribute('data-carousel-hidden', 'true');
        el.style.display = 'none';
      } else if (shown && hiddenByUs) {
        el.style.display = el.getAttribute('data-carousel-display') || '';
        el.removeAttribute('data-carousel-display');
        el.removeAttribute('data-carousel-hidden');
      }
    }

    function syncControls(n) {
      root.setAttribute('data-carousel-count', String(n));
      var many = n > 1;
      setControlShown(prevBtn, many);
      setControlShown(nextBtn, many);
      setControlShown(dotsContainer, many);
      setControlShown(counterEl, many);
    }

    function rebuild() {
      if (wrapTimer !== null) { clearTimeout(wrapTimer); wrapTimer = null; }
      state.slides = getSlides();
      syncControls(state.slides.length);
      syncSwipe();
      syncClones();
      if (state.slides.length === 0) return;
      applyTrackLayout();
      rebuildDots();
      if (state.index >= state.slides.length) state.index = 0;
      update();
      startAutoplay();
    }

    if (prevBtn) prevBtn.addEventListener('click', function(e){ e.preventDefault(); prev(); restartAutoplay(); });
    if (nextBtn) nextBtn.addEventListener('click', function(e){ e.preventDefault(); next(); restartAutoplay(); });

    // Pause on hover
    root.addEventListener('mouseenter', function(){ state.interacting = true; });
    root.addEventListener('mouseleave', function(){ state.interacting = false; });

    // --- Свайп: data-carousel-swipe = экраны, где слайды листаются жестом ---
    // Жест ловим на всём корне, а не на треке: трек обычно перекрыт оформлением
    // карточки, стрелками, подписями — палец попадает в них, а не в слайд.
    var swipeScreens = (root.getAttribute('data-carousel-swipe') || '')
      .split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    var ownTouchAction = root.style.touchAction;
    var gesture = null;
    var swallowClickUntil = 0;

    function swipeEnabled() {
      if (state.slides.length < 2 || swipeScreens.length === 0) return false;
      var bp = ghBreakpointAt(ghBreakpoints(), ghViewportWidth());
      return !!bp && swipeScreens.indexOf(bp.id) !== -1;
    }

    // Пока свайп включён, вертикальную прокрутку пальцем ведёт браузер, а движение
    // вбок достаётся карусели. Без pan-y браузер забрал бы себе весь жест.
    // Метка на корне — для вёрстки (курсор и т.п.) и проверок.
    function syncSwipe() {
      var on = swipeEnabled();
      root.style.touchAction = on ? 'pan-y' : ownTouchAction;
      if (on) root.setAttribute('data-carousel-swipe-active', 'true');
      else root.removeAttribute('data-carousel-swipe-active');
    }

    function endGesture() {
      if (!gesture) return;
      if (gesture.mouse) root.style.userSelect = gesture.userSelect;
      gesture = null;
      state.swiping = false;
    }

    root.addEventListener('pointerdown', function(e){
      if (gesture || e.isPrimary === false) return;
      // Карусель внутри карусели: жест достаётся той, что ближе к пальцу.
      if (e.target && e.target.closest && e.target.closest('[data-carousel="true"]') !== root) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!swipeEnabled()) return;
      gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, mouse: e.pointerType === 'mouse', horizontal: false, userSelect: root.style.userSelect };
      state.swiping = true;
    });

    root.addEventListener('pointermove', function(e){
      if (!gesture || e.pointerId !== gesture.id) return;
      var dx = e.clientX - gesture.x;
      var dy = e.clientY - gesture.y;
      if (!gesture.horizontal) {
        // Вверх-вниз — прокрутка страницы, карусель отпускает жест.
        if (Math.abs(dy) > SWIPE_LOCK_PX && Math.abs(dy) >= Math.abs(dx)) { endGesture(); return; }
        if (Math.abs(dx) <= SWIPE_LOCK_PX || Math.abs(dx) <= Math.abs(dy)) return;
        gesture.horizontal = true;
        // Мышь, ушедшая за край карусели, не должна терять жест.
        try { root.setPointerCapture(e.pointerId); } catch (err) {}
        if (gesture.mouse) {
          root.style.userSelect = 'none';
          var sel = window.getSelection && window.getSelection();
          if (sel && sel.removeAllRanges) sel.removeAllRanges();
        }
      }
      if (gesture.mouse) e.preventDefault();
    });

    root.addEventListener('pointerup', function(e){
      if (!gesture || e.pointerId !== gesture.id) return;
      var dx = e.clientX - gesture.x;
      var horizontal = gesture.horizontal;
      var mouse = gesture.mouse;
      endGesture();
      if (!horizontal) return;
      // Касание со сдвигом click не порождает, а мышь — да, по элементу под курсором.
      if (mouse) swallowClickUntil = Date.now() + SWIPE_CLICK_GUARD_MS;
      if (Math.abs(dx) >= SWIPE_MIN_PX) { dx < 0 ? next() : prev(); restartAutoplay(); }
    });

    root.addEventListener('pointercancel', endGesture);

    root.addEventListener('click', function(e){
      if (Date.now() >= swallowClickUntil) return;
      swallowClickUntil = 0;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    // Картинку внутри слайда браузер иначе потащил бы мышью как файл.
    root.addEventListener('dragstart', function(e){ if (swipeEnabled()) e.preventDefault(); });

    // Экран меняется при повороте телефона и изменении окна.
    window.addEventListener('resize', syncSwipe);

    rebuild();

    // Перерисовка при появлении/изменении слайдов (repeater из DataBindingGenerator).
    // Свои копии крайних слайдов рантайм переставляет сам — на них не реагируем,
    // иначе rebuild вызывал бы сам себя.
    function onlyClones(records) {
      for (var i = 0; i < records.length; i++) {
        var nodes = Array.prototype.slice.call(records[i].addedNodes).concat(Array.prototype.slice.call(records[i].removedNodes));
        for (var j = 0; j < nodes.length; j++) if (!isClone(nodes[j])) return false;
      }
      return true;
    }
    var mo = new MutationObserver(function(records){ if (!onlyClones(records)) rebuild(); });
    mo.observe(track, { childList: true });
  }

  function bootAll() {
    var nodes = document.querySelectorAll('[data-carousel="true"]');
    for (var i = 0; i < nodes.length; i++) init(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAll);
  } else {
    bootAll();
  }
})();
</script>`;
}
