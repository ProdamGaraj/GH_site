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
 *   [data-carousel-prev]              — клик: prev
 *   [data-carousel-next]              — клик: next
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

    var state = { index: 0, slides: [], dots: [], timer: null, interacting: false };

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
      }
      // overflow:hidden на родителе track (чтобы соседние слайды не торчали)
      var parent = track.parentElement;
      if (parent && parent !== root) {
        parent.style.overflow = 'hidden';
      } else {
        root.style.overflow = 'hidden';
      }
    }

    function rebuildDots() {
      if (!dotsContainer) return;
      var existing = Array.prototype.slice.call(dotsContainer.children);
      var template = dotsContainer.querySelector('[data-carousel-dot]');

      if (template) {
        // Шаблон — клонируем по числу слайдов
        var tplClone = template.cloneNode(true);
        // Очищаем контейнер (включая шаблон)
        while (dotsContainer.firstChild) dotsContainer.removeChild(dotsContainer.firstChild);
        state.dots = [];
        for (var i = 0; i < state.slides.length; i++) {
          var dot = tplClone.cloneNode(true);
          dot.removeAttribute('data-carousel-dot');
          dot.setAttribute('data-carousel-dot-index', String(i));
          (function(idx){
            dot.addEventListener('click', function(){ goTo(idx, true); });
          })(i);
          dotsContainer.appendChild(dot);
          state.dots.push(dot);
        }
      } else if (existing.length === state.slides.length) {
        // Готовые dots — используем как есть
        state.dots = existing;
        for (var j = 0; j < existing.length; j++) {
          (function(idx, el){
            el.addEventListener('click', function(){ goTo(idx, true); });
          })(j, existing[j]);
        }
      } else {
        state.dots = [];
      }
    }

    function update() {
      var n = state.slides.length;
      if (n === 0) return;
      // translate в процентах от track (track имеет width = n*100%)
      var pct = -(state.index * (100 / n));
      track.style.transform = 'translateX(' + pct + '%)';
      for (var i = 0; i < state.dots.length; i++) {
        if (i === state.index) state.dots[i].classList.add(activeClass);
        else state.dots[i].classList.remove(activeClass);
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
