/**
 * Рантайм адаптивного медиа для ДИНАМИЧЕСКИХ слайдов (repeater из page-переменных).
 *
 * Статические узлы дерева получают адаптив через <picture>/@media на деплое
 * (ResponsiveMediaResolver). Но слайды repeat-карусели штампует JS-рантайм
 * data-bindings уже в браузере, поэтому для них используем свап по вьюпорту.
 * Тем же механизмом свапается src статических <video> (HtmlGenerator ставит
 * data-rmedia): media-атрибут на <video><source> браузеры игнорируют.
 *
 * Контракт (проставляет DataBindingGenerator при наличии item._responsive):
 *   data-rmedia="{"tablet":"/t.jpg","mobile":"/m.jpg"}"  — карта bpId→URL
 *   data-rmedia-kind="bg" | "src"                          — как применять
 * Базовое значение (для вьюпорта шире всех брейкпоинтов) берётся с самого
 * элемента при первом проходе (background-image / атрибут src).
 *
 * Ширины брейкпоинтов — из window.__ghBreakpoints (эмитит HtmlGenerator,
 * boundary = верхняя граница диапазона из breakpointRanges; null = без границы).
 * Выбор: брейкпоинт с наименьшей boundary ≥ вьюпорта среди присутствующих в
 * карте; иначе — база. Совпадает с семантикой @media/<picture>.
 */
export function generateResponsiveMediaRuntime(): string {
  return `<script>
(function(){
  'use strict';
  var BPS = (window.__ghBreakpoints || []).filter(function(b){ return b && typeof b.width === 'number'; });
  var tracked = [];

  function baseOf(el, kind){
    if (el.__rmBase != null) return el.__rmBase;
    el.__rmBase = kind === 'src' ? (el.getAttribute('src') || '') : (el.style.backgroundImage || '');
    return el.__rmBase;
  }

  function boundOf(bp){
    if (bp.boundary === null) return Infinity;
    return typeof bp.boundary === 'number' ? bp.boundary : bp.width;
  }

  function pick(map, w){
    var best = null;
    for (var i = 0; i < BPS.length; i++){
      var bp = BPS[i];
      if (map[bp.id] == null || map[bp.id] === '') continue;
      if (w <= boundOf(bp) && (best === null || boundOf(bp) < boundOf(best))) best = bp;
    }
    return best ? map[best.id] : null;
  }

  function apply(el){
    var map;
    try { map = JSON.parse(el.getAttribute('data-rmedia') || '{}'); } catch(e){ return; }
    var kind = el.getAttribute('data-rmedia-kind') === 'src' ? 'src' : 'bg';
    var base = baseOf(el, kind);
    var chosen = pick(map, window.innerWidth || document.documentElement.clientWidth || 0);
    if (kind === 'src'){
      var v = chosen != null ? chosen : base;
      // Меняем только при реальной смене: лишний setAttribute на <video>
      // перезапускал бы воспроизведение при каждом resize.
      if (v && el.getAttribute('src') !== v){
        el.setAttribute('src', v);
        if (el.tagName === 'VIDEO' && typeof el.load === 'function') el.load();
      }
    } else {
      el.style.backgroundImage = chosen != null
        ? 'url("' + String(chosen).replace(/"/g, '\\\\"') + '")'
        : base;
    }
  }

  function track(el){
    if (el.__rmInit) return;
    el.__rmInit = true;
    tracked.push(el);
    apply(el);
  }

  function scan(root){
    var nodes = (root || document).querySelectorAll('[data-rmedia]');
    for (var i = 0; i < nodes.length; i++) track(nodes[i]);
  }

  function applyAll(){ for (var i = 0; i < tracked.length; i++) apply(tracked[i]); }

  var timer;
  window.addEventListener('resize', function(){ clearTimeout(timer); timer = setTimeout(applyAll, 120); });
  window.__ghRMedia = { scan: scan, applyAll: applyAll };

  function boot(){
    scan(document);
    if (!document.body) return;
    var mo = new MutationObserver(function(muts){
      for (var i = 0; i < muts.length; i++){
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++){
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.getAttribute && n.getAttribute('data-rmedia')) track(n);
          if (n.querySelectorAll) scan(n);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script>`;
}
