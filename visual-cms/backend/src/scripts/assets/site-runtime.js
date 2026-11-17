/* Общий скрипт сайта Golden House (Site JS), v4.

   v4: плавающих окон больше нет — ни кнопки «Чат-бот», ни промо-окна, ни
   exit-окна «Не уходите без консультации», ни окна консультации. На сайте
   остаётся только кнопка контактов (блок Contact widget в CMS). Владелец
   убрал injectSupportWidgets из Site JS руками, но v3 вернул его из этого
   файла — теперь источник совпадает с сайтом.

   v3: формы заявок здесь больше не обрабатываются — все формы с телефоном
   отправляет рантайм заявок, который генератор вставляет в каждую страницу
   (backend/src/services/LeadRuntime.ts → POST /api/leads → MacroCRM).

   Единственная копия. Источник — backend/src/scripts/assets/site-runtime.js,
   в настройки сайта его кладёт scripts/migrate-site-script.ts. Миграция
   заменяет Site JS целиком: правки руками в CMS переносите сюда, иначе
   следующая версия их сотрёт.

   Что здесь:
   - trackEvent — события в window.dataLayer (page_view);
   - initGoldenHouseRoadmap — дорожная карта на странице «О компании».

   Чего здесь нет и почему:
   - контраст логотипа, язык, пункты меню — это делает блок Navigation;
   - SEO-теги — их генерирует CMS;
   - отправка форм — рантайм заявок (services/LeadRuntime.ts);
   - плавающие окна — см. v4; кнопка контактов — блок CMS;
   - «богатый» подвал — подвал сделан блоком Footer в CMS. */

function pageLang() {
  return (document.documentElement.getAttribute("lang") || "").toLowerCase().split("-")[0];
}

function trackEvent(eventName, payload = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    page: location.pathname,
    lang: pageLang(),
    ...payload
  });
}

function initGoldenHouseRoadmap() {
  const stage = document.querySelector(".gh-roadmap-stage");
  const path = document.querySelector("#gh-roadmap-path");
  const mobile = document.querySelector(".gh-roadmap-mobile");
  if (!stage && !mobile) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealItems = stage ? Array.from(stage.querySelectorAll("[data-roadmap-reveal]")) : [];
  const mobileItems = mobile ? Array.from(mobile.querySelectorAll("[data-roadmap-mobile-item]")) : [];
  const head = document.querySelector("#gh-roadmap-head");
  const glow = document.querySelector("#gh-roadmap-head-glow");
  let length = 0;
  let ticking = false;

  if (path && typeof path.getTotalLength === "function") {
    length = path.getTotalLength();
    path.style.strokeDasharray = length;
    path.style.strokeDashoffset = length;
  }

  const clampProgress = (value) => Math.max(0, Math.min(1, value));

  function setVisible(element, visible) {
    element.classList.toggle("is-visible", visible);
    if (element.namespaceURI === "http://www.w3.org/2000/svg") {
      element.style.opacity = visible ? "1" : "0";
    }
  }

  function drawRoadmap() {
    if (reduceMotion) {
      if (path && length) path.style.strokeDashoffset = "0";
      revealItems.forEach((element) => setVisible(element, true));
      mobileItems.forEach((item) => item.classList.add("is-visible"));
      if (mobile) mobile.style.setProperty("--roadmap-mobile-progress", "1");
      if (head && glow) {
        head.style.opacity = "0";
        glow.style.opacity = "0";
      }
      return;
    }

    if (stage && path && length) {
      const rect = stage.getBoundingClientRect();
      const drawableHeight = Math.max(rect.height * .72, 1);
      const progress = clampProgress((window.innerHeight * .78 - rect.top) / drawableHeight);
      const pathProgress = progress > .985 ? 1 : progress;
      path.style.strokeDashoffset = String(length * (1 - pathProgress));

      revealItems.forEach((element) => {
        const threshold = Number(element.dataset.roadmapReveal || 0);
        setVisible(element, progress >= threshold);
      });

      if (head && glow) {
        if (progress > .001 && typeof path.getPointAtLength === "function") {
          const point = path.getPointAtLength(length * pathProgress);
          head.setAttribute("cx", point.x);
          head.setAttribute("cy", point.y);
          glow.setAttribute("cx", point.x);
          glow.setAttribute("cy", point.y);
          head.style.opacity = "1";
          glow.style.opacity = ".58";
        } else {
          head.style.opacity = "0";
          glow.style.opacity = "0";
        }
      }
    }

    if (mobile) {
      const rect = mobile.getBoundingClientRect();
      const progress = clampProgress((window.innerHeight * .82 - rect.top) / Math.max(rect.height, 1));
      mobile.style.setProperty("--roadmap-mobile-progress", progress.toFixed(3));
      mobileItems.forEach((item, index) => {
        item.classList.toggle("is-visible", progress >= (index + .2) / (mobileItems.length + .2));
      });
    }
  }

  function requestDraw() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      ticking = false;
      drawRoadmap();
    });
  }

  window.addEventListener("scroll", requestDraw, { passive: true });
  window.addEventListener("resize", requestDraw);
  drawRoadmap();
}

function bootSiteRuntime() {
  initGoldenHouseRoadmap();
  trackEvent("page_view");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSiteRuntime);
} else {
  bootSiteRuntime();
}
