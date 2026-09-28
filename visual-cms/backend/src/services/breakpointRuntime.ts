/**
 * Экран вьюпорта на опубликованной странице — общий кусок JS-рантаймов
 * (адаптивное медиа, свайп карусели).
 *
 * Экраны страницы приходят в window.__ghBreakpoints (эмитит HtmlGenerator):
 * { id, width, boundary }, где boundary — верхняя граница диапазона из
 * breakpointRanges (null — без границы сверху). Экран ширины w — тот, у
 * которого наименьшая boundary ≥ w: та же семантика, что у @media и
 * <picture>. Разойдись рантайм с CSS — на границе экранов картинка и
 * поведение не совпали бы.
 *
 * Строка вставляется внутрь IIFE рантайма как есть.
 */
export const BREAKPOINT_RUNTIME_JS = `
  function ghBoundOf(bp){
    if (bp.boundary === null) return Infinity;
    return typeof bp.boundary === 'number' ? bp.boundary : bp.width;
  }
  /** Экраны страницы с шириной — из window.__ghBreakpoints. */
  function ghBreakpoints(){
    return (window.__ghBreakpoints || []).filter(function(b){ return b && typeof b.width === 'number'; });
  }
  /** Экран ширины w среди bps; фильтр accept — учитывать только подходящие. */
  function ghBreakpointAt(bps, w, accept){
    var best = null;
    for (var i = 0; i < bps.length; i++){
      var bp = bps[i];
      if (accept && !accept(bp)) continue;
      if (w <= ghBoundOf(bp) && (best === null || ghBoundOf(bp) < ghBoundOf(best))) best = bp;
    }
    return best;
  }
  function ghViewportWidth(){
    return window.innerWidth || document.documentElement.clientWidth || 0;
  }
`
