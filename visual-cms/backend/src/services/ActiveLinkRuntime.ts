/**
 * Рантайм подсветки текущей страницы в навигации (хедер/меню).
 *
 * На деплое находит ссылки в header/nav-областях, чей путь совпадает с
 * location.pathname, вешает класс `vcms-active-link` + `aria-current="page"`.
 * Дефолтный стиль — жирное начертание; сайт может переопределить в
 * Site.settings.globalCss, например:
 *   .gnav a.vcms-active-link { color: #FDB82A !important; }
 *
 * Матчинг устойчив к форматам ссылок: "/contacts", "/contacts/",
 * "contacts.html" (легаси), "/index.html#top" и к языковым префиксам
 * (/en/contacts тоже подсвечивает «Контакты»). Секционные якоря
 * (например "#complexes") страницей не считаются — кроме "#top".
 */
export function generateActiveLinkRuntime(): string {
  return `<style>.vcms-active-link{font-weight:700 !important;}</style>
<script>
(function(){
  'use strict';

  // Нормализация пути: без хвостового слэша, без .html, index → корень
  function norm(p){
    p = (p || '').replace(/\\/+$/, '').replace(/\\.html?$/i, '');
    if (p === '' || p === '/index') return '/';
    if (/\\/index$/.test(p)) p = p.slice(0, -6);
    return p || '/';
  }

  var here = norm(location.pathname);
  var LANG_HOME = /^\\/[a-z]{2}(-[a-z]{2})?$/i; // /en, /uz — корень языковой версии

  function isActive(u){
    if (u.host !== location.host) return false;
    // Секционные якоря (#complexes) — не страницы; #top/# — считаем страницей
    if (u.hash && u.hash !== '#top' && u.hash !== '#') return false;
    var target = norm(u.pathname);
    if (target === '/') return here === '/' || LANG_HOME.test(here);
    // Точное совпадение либо языковой префикс: /en/contacts ~ /contacts
    // (target начинается с '/', поэтому граница сегмента гарантирована)
    return here === target || (here.length > target.length && here.slice(-target.length) === target);
  }

  var selector = 'header a, nav a, .gnav a, .gmenu a, ' +
    '[data-element-name*="Header" i] a, [data-element-name*="Nav" i] a, ' +
    '[data-element-name*="хедер" i] a, [data-element-name*="шапка" i] a, [data-element-name*="меню" i] a';

  function apply(){
    var links;
    try { links = document.querySelectorAll(selector); } catch(e) { return; }
    for (var i = 0; i < links.length; i++){
      var a = links[i];
      var href = a.getAttribute('href');
      if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) continue;
      var u;
      try { u = new URL(href, location.href); } catch(e) { continue; }
      if (isActive(u)){
        a.classList.add('vcms-active-link');
        a.setAttribute('aria-current', 'page');
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
</script>`
}
