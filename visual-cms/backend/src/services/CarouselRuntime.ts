/**
 * Universal Carousel Widget Runtime.
 *
 * Возвращает строку JS, инжектящуюся в <body> публикуемой страницы.
 * Декларативный контракт через data-атрибуты:
 *
 *   [data-carousel="true"]            — корень слайдера
 *   [data-carousel-autoplay="5000"]   — автопрокрутка, мс (0/нет = выкл)
 *   [data-carousel-loop="true"]       — зацикленность (по умолчанию true)
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
 *
 * Layout: track становится display:flex с width = N*100%, каждый слайд flex:0 0 100%.
 * Анимация через CSS transition на transform, либо JS scroll fallback.
 *
 * Перерисовка при mutation track.children (нужно для repeater из DataBindingGenerator).
 */
export function generateCarouselRuntime(): string {
  return `<script>
(function(){
  'use strict';
  var ACTIVE_CLASS_DEFAULT = 'active';

  function init(root) {
    if (root.__carouselInit) return;
    root.__carouselInit = true;

    var track = root.querySelector('[data-carousel-track="true"]');
    if (!track) return;

    var autoplay = parseInt(root.getAttribute('data-carousel-autoplay') || '0', 10);
    var loop = root.getAttribute('data-carousel-loop') !== 'false';
    var activeClass = root.getAttribute('data-carousel-active-class') || ACTIVE_CLASS_DEFAULT;

    var prevBtn = root.querySelector('[data-carousel-prev]');
    var nextBtn = root.querySelector('[data-carousel-next]');
    var dotsContainer = root.querySelector('[data-carousel-dots]');
    var counterEl = root.querySelector('[data-carousel-counter]');

    var state = { index: 0, slides: [], dots: [], timer: null, interacting: false, dotActiveStyle: '', dotInactiveStyle: '' };

    function getSlides() {
      // Только прямые дети track. Фильтруем по data-carousel-slide если есть, иначе все children.
      // Исключаем скрытые (display:none) — это template-слайд для repeater'а.
      var children = Array.prototype.slice.call(track.children);
      var visible = children.filter(function(c){ return c.style && c.style.display !== 'none'; });
      var marked = visible.filter(function(c){ return c.getAttribute && c.getAttribute('data-carousel-slide') === 'true'; });
      return marked.length ? marked : visible;
    }

    function applyTrackLayout() {
      var n = state.slides.length;
      if (n === 0) return;
      track.style.display = 'flex';
      track.style.width = (n * 100) + '%';
      track.style.transition = 'transform 0.5s ease';
      for (var i = 0; i < n; i++) {
        var s = state.slides[i];
        s.style.flex = '0 0 ' + (100 / n) + '%';
        s.style.width = (100 / n) + '%';
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
          // Если у нас уже есть запомненный inactive-стиль — применяем его
          // СРАЗУ ко всем клонам. update() потом перепишет активный.
          if (state.dotInactiveStyle) dot.style.cssText = state.dotInactiveStyle;
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
        v.muted = true; v.defaultMuted = true; v.loop = true; v.autoplay = true;
        v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
        v.playsInline = true; v.preload = 'none';
        v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:0;';
        var s = document.createElement('source');
        s.src = url; v.appendChild(s);
        slide.insertBefore(v, slide.firstChild);
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

    function update() {
      var n = state.slides.length;
      if (n === 0) return;
      // translate в процентах от track (track имеет width = n*100%)
      var pct = -(state.index * (100 / n));
      track.style.transform = 'translateX(' + pct + '%)';
      for (var i = 0; i < state.dots.length; i++) {
        var dot = state.dots[i];
        if (i === state.index) {
          dot.classList.add(activeClass);
          if (state.dotActiveStyle) dot.style.cssText = state.dotActiveStyle;
        } else {
          dot.classList.remove(activeClass);
          if (state.dotInactiveStyle) dot.style.cssText = state.dotInactiveStyle;
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
    }

    function goTo(i, userInteraction) {
      var n = state.slides.length;
      if (n === 0) return;
      if (loop) {
        state.index = ((i % n) + n) % n;
      } else {
        state.index = Math.max(0, Math.min(n - 1, i));
      }
      update();
      if (userInteraction) restartAutoplay();
    }

    function next() { goTo(state.index + 1, false); }
    function prev() { goTo(state.index - 1, false); }

    function startAutoplay() {
      stopAutoplay();
      if (autoplay > 0 && state.slides.length > 1) {
        state.timer = setInterval(function(){
          if (!state.interacting) next();
        }, autoplay);
      }
    }
    function stopAutoplay() {
      if (state.timer) { clearInterval(state.timer); state.timer = null; }
    }
    function restartAutoplay() { startAutoplay(); }

    function rebuild() {
      state.slides = getSlides();
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

    // Touch swipe
    var touchX = null;
    track.addEventListener('touchstart', function(e){ touchX = e.touches[0].clientX; state.interacting = true; }, { passive: true });
    track.addEventListener('touchend', function(e){
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); restartAutoplay(); }
      touchX = null;
      state.interacting = false;
    }, { passive: true });

    rebuild();

    // Перерисовка при появлении/изменении слайдов (repeater из DataBindingGenerator)
    var mo = new MutationObserver(function(){ rebuild(); });
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
