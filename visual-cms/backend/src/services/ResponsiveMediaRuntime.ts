/**
 * Рантайм адаптивного медиа для ДИНАМИЧЕСКИХ слайдов (repeater из page-переменных).
 *
 * Статические узлы дерева получают адаптив через <picture>/@media на деплое
 * (ResponsiveMediaResolver). Но слайды repeat-карусели штампует JS-рантайм
 * data-bindings уже в браузере, поэтому для них используем свап по вьюпорту.
 *
 * Контракт (проставляет DataBindingGenerator при наличии item._responsive):
 *   data-rmedia="{"tablet":"/t.jpg","mobile":"/m.jpg"}"  — карта bpId→URL
 *   data-rmedia-kind="bg" | "src"                          — как применять
 * Базовое значение (для вьюпорта шире всех брейкпоинтов) берётся с самого
 * элемента при первом проходе (background-image / атрибут src).
 *
 * Ширины брейкпоинтов — из window.__ghBreakpoints (эмитит HtmlGenerator).
 * Выбор: наименьший brейкпоинт, чей max-width ≥ вьюпорта (самый точный экран),
 * среди присутствующих в карте; иначе — база. Совпадает с семантикой @media/<picture>.
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

  function pick(map, w){
    var best = null;
    for (var i = 0; i < BPS.length; i++){
      var bp = BPS[i];
      if (map[bp.id] == null || map[bp.id] === '') continue;
      if (w <= bp.width && (best === null || bp.width < best.width)) best = bp;
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
      if (v) el.setAttribute('src', v);
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
