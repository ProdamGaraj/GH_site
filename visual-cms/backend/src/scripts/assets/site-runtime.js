/* Общий скрипт сайта Golden House (Site JS), v1.

   Единственная копия. Раньше этот код лежал в JS 14 блоков и страницы news:
   на страницах проектов выполнялся дважды (два промо-окна), на главной не
   выполнялся вовсе. Источник — backend/src/scripts/assets/site-runtime.js,
   в настройки сайта его кладёт scripts/migrate-site-script.ts.

   Что здесь:
   - trackEvent — события в window.dataLayer;
   - setupCrmForms — формы заявок. ВРЕМЕННО, как и до сведения: заявка
     сохраняется в localStorage браузера и на сервер не уходит. Подключение
     к формам CMS — отдельная задача;
   - injectSupportWidgets — чат, окно консультации, промо- и exit-окна.
     Выключить плавающие окна на странице: <meta name="gh-widgets"
     content="off"> в своём HTML head страницы (настройки страницы в CMS);
   - initGoldenHouseRoadmap — дорожная карта на странице «О компании».

   Чего здесь нет и почему:
   - контраст логотипа, язык, пункты меню — это делает блок Navigation (его
     версия новее; две копии перетирали друг друга на прокрутке);
   - SEO-теги — их генерирует CMS;
   - «богатый» подвал — подвал сделан блоком Footer в CMS. */

function widgetsDisabled() {
  const meta = document.querySelector('meta[name="gh-widgets"]');
  return Boolean(meta) && (meta.getAttribute("content") || "").trim().toLowerCase() === "off";
}

function trackEvent(eventName, payload = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    page: location.pathname.split("/").pop() || "index.html",
    ...payload
  });
}

function setupCrmForms() {
  document.querySelectorAll("form").forEach((form) => {
    const sendButtons = form.querySelectorAll("button, .submit, .commerce-submit");

    const sendLead = () => {
      const lead = {
        id: `GH-${Date.now()}`,
        page: document.title,
        createdAt: new Date().toISOString(),
        fields: Object.fromEntries(new FormData(form).entries())
      };

      const leads = JSON.parse(localStorage.getItem("goldenHouseLeads") || "[]");
      leads.push(lead);
      localStorage.setItem("goldenHouseLeads", JSON.stringify(leads));
      trackEvent("crm_lead_created", lead);

      const original = sendButtons[0]?.textContent;
      sendButtons.forEach((button) => {
        button.textContent = "Заявка отправлена";
      });

      window.setTimeout(() => {
        sendButtons.forEach((button) => {
          button.textContent = original || "Отправить";
        });
      }, 2400);
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      sendLead();
    });

    sendButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        sendLead();
      });
    });
  });
}

function injectSupportWidgets() {
  if (!document.querySelector("#gh-widget-style")) {
    const style = document.createElement("style");
    style.id = "gh-widget-style";
    style.textContent = `
      .chat-widget{position:fixed;right:22px;bottom:22px;z-index:9998;display:grid;gap:10px;justify-items:end}
      .chat-panel{width:min(330px,calc(100vw - 32px));padding:18px;border-radius:22px;background:rgba(17,20,25,.9);color:#fff;box-shadow:0 18px 44px rgba(0,0,0,.28);backdrop-filter:blur(18px);display:none}
      .chat-panel.is-open{display:block}
      .chat-panel h3{font-size:18px;margin-bottom:8px}.chat-panel p{color:rgba(255,255,255,.72);font-size:14px;line-height:1.5}
      .chat-button{position:relative;min-height:48px;overflow:hidden;border:0;border-radius:999px;background:linear-gradient(115deg,#fdb82a 0%,#ffe08a 24%,#c98715 46%,#fdb82a 68%,#fff2b8 100%);background-size:240% 240%;color:#fff;padding:0 18px;font-weight:900;cursor:pointer;text-shadow:0 1px 10px rgba(88,54,0,.3);box-shadow:0 14px 34px rgba(253,184,42,.34),0 0 0 1px rgba(255,255,255,.26) inset;animation:chatGoldFlow 3.2s ease-in-out infinite,chatGoldPulse 2.4s ease-in-out infinite}
      .chat-button::before{content:"";position:absolute;inset:-45%;background:linear-gradient(110deg,transparent 38%,rgba(255,255,255,.58) 50%,transparent 62%);transform:translateX(-70%) rotate(8deg);animation:chatGoldShine 3.8s ease-in-out infinite;pointer-events:none}
      .chat-button:hover{box-shadow:0 18px 42px rgba(253,184,42,.46),0 0 0 1px rgba(255,255,255,.34) inset}
      @keyframes chatGoldFlow{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
      @keyframes chatGoldPulse{0%,100%{filter:saturate(1);transform:translateY(0)}50%{filter:saturate(1.15);transform:translateY(-1px)}}
      @keyframes chatGoldShine{0%{transform:translateX(-80%) rotate(8deg);opacity:0}28%{opacity:.9}54%,100%{transform:translateX(80%) rotate(8deg);opacity:0}}
      @media(prefers-reduced-motion:reduce){.chat-button,.chat-button::before{animation:none}}
      .popup-button{min-height:50px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:10px;border:0;border-radius:999px;background:#fdb82a;color:#fff;padding:0 14px 0 20px;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 14px 32px rgba(253,184,42,.32)}
      .popup-arrow{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;border-radius:50%;background:#15181d;color:#fff;font-size:16px;line-height:1}
      .promo-popup,.exit-popup{position:fixed;right:22px;bottom:92px;z-index:9997;width:min(406px,calc(100vw - 44px));padding:25px;border:1px solid rgba(255,255,255,.28);border-radius:24px;background:linear-gradient(135deg,rgba(84,90,102,.72),rgba(43,50,56,.78));color:#fff;box-shadow:0 22px 58px rgba(0,0,0,.32),inset 0 0 0 1px rgba(255,255,255,.1);transform:translateY(calc(100% + 92px));transition:transform .35s ease;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)}
      .promo-popup.is-visible,.exit-popup.is-visible{transform:translateY(0)}
      .popup-trust-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .popup-avatars{display:flex;align-items:center}
      .popup-avatars span{width:35px;height:35px;margin-right:-10px;border:2px solid rgba(255,255,255,.78);border-radius:50%;background:center/cover no-repeat;box-shadow:0 7px 16px rgba(0,0,0,.18)}
      .popup-stat{min-height:28px;display:inline-flex;align-items:center;padding:0 11px;border-radius:999px;background:rgba(255,255,255,.2);color:#fff;font-size:16px;font-weight:900}
      .popup-label{color:#fff;font-size:16px;font-weight:900}
      .popup-message{margin-top:20px;color:rgba(255,255,255,.86);font-size:clamp(15px,2.1vw,17px);font-weight:800;line-height:1.38}
      .popup-message b{display:block;margin-bottom:4px;color:#fff;font-size:clamp(18px,2.8vw,22px);line-height:1.08}
      .popup-actions{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;margin-top:21px}.popup-close{min-height:38px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(255,255,255,.12);color:#fff;padding:0 13px;font-size:14px;font-weight:900;cursor:pointer;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
      .consult-backdrop{position:fixed;inset:0;z-index:10000;display:none;place-items:center;padding:18px;background:rgba(13,15,18,.38);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
      .consult-backdrop.is-open{display:grid}
      .consult-modal{position:relative;width:min(434px,calc(100vw - 32px));padding:clamp(18px,2.8vw,27px);border:1px solid rgba(255,255,255,.44);border-radius:24px;background:rgba(255,255,255,.76);color:#15181d;box-shadow:0 22px 62px rgba(0,0,0,.24),inset 0 0 0 1px rgba(255,255,255,.28);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)}
      .consult-modal h3{max-width:322px;font-size:clamp(22px,3.3vw,32px);line-height:1.02}
      .consult-modal p{margin-top:9px;color:rgba(21,24,29,.62);font-size:14px;line-height:1.45}
      .consult-close{position:absolute;top:13px;right:13px;width:34px;height:34px;border:1px solid rgba(21,24,29,.12);border-radius:50%;background:rgba(255,255,255,.64);color:#15181d;font-size:18px;font-weight:800;cursor:pointer}
      .consult-form{display:grid;gap:9px;margin-top:18px}
      .consult-form input{width:100%;min-height:46px;border:1px solid rgba(21,24,29,.12);border-radius:13px;background:rgba(255,255,255,.86);color:#15181d;padding:0 13px;font-weight:700;outline:0}
      .consult-form input:focus{border-color:rgba(253,184,42,.8);box-shadow:0 0 0 4px rgba(253,184,42,.16)}
      .consult-submit{min-height:48px;border:0;border-radius:13px;background:#fdb82a;color:#fff;font-size:15px;font-weight:900;cursor:pointer;box-shadow:0 14px 28px rgba(253,184,42,.34)}
      .consult-submit:disabled{cursor:default;opacity:.86}
      @media(max-width:680px){.chat-widget{right:12px;bottom:12px}.promo-popup,.exit-popup{right:12px;bottom:78px;width:min(406px,calc(100vw - 24px));padding:20px;border-radius:22px;transform:translateY(calc(100% + 78px))}.promo-popup.is-visible,.exit-popup.is-visible{transform:translateY(0)}.popup-actions{grid-template-columns:1fr}.popup-button,.popup-close{width:100%}.popup-button{min-height:52px;font-size:16px}.popup-label{font-size:15px}.popup-stat{font-size:15px}.popup-avatars span{width:34px;height:34px}.consult-modal{width:calc(100vw - 24px);padding:18px;border-radius:22px}.consult-close{top:12px;right:12px}.consult-form input,.consult-submit{min-height:48px}}
      @media(max-width:420px){.promo-popup,.exit-popup{right:8px;bottom:76px;width:calc(100vw - 16px);padding:18px;border-radius:22px;transform:translateY(calc(100% + 76px))}.promo-popup.is-visible,.exit-popup.is-visible{transform:translateY(0)}.popup-trust-row{gap:8px}.popup-message{margin-top:18px;font-size:16px}.popup-message b{font-size:22px}.popup-button{padding:0 14px;font-size:15px}.popup-arrow{width:32px;height:32px}.consult-modal h3{font-size:24px}.consult-modal p{font-size:14px}}
    `;
    document.head.appendChild(style);
  }

  // Выключатель страницы: <meta name="gh-widgets" content="off"> в head.
  // Плавающие окна (чат, промо, exit) не создаются; окно консультации
  // остаётся — его открывают кнопки [data-consult-trigger] на странице.
  const floating = !widgetsDisabled();

  const closeFloatingPopups = ({ keepConsult = false, keepChat = false } = {}) => {
    document.querySelectorAll(".promo-popup.is-visible, .exit-popup.is-visible").forEach((popup) => {
      popup.classList.remove("is-visible");
    });
    if (!keepChat) {
      document.querySelector(".chat-panel.is-open")?.classList.remove("is-open");
    }
    if (!keepConsult) {
      document.querySelector(".consult-backdrop.is-open")?.classList.remove("is-open");
    }
  };

  const hasOpenModal = () => Boolean(document.querySelector(
    ".consult-backdrop.is-open, .plan-modal.is-open, .gallery-lightbox.is-open"
  ));

  window.closeGoldenHousePopups = closeFloatingPopups;
  window.hasGoldenHouseModalOpen = hasOpenModal;

  if (floating && !document.querySelector(".chat-widget")) {
    const chat = document.createElement("div");
    chat.className = "chat-widget";
    chat.innerHTML = `
      <div class="chat-panel" id="chatPanel">
        <h3>Онлайн-консультация</h3>
        <p>Напишите вопрос по проектам, условиям покупки или документам. Менеджер Golden House свяжется с вами.</p>
      </div>
      <button class="chat-button" type="button">Чат-бот</button>
    `;
    document.body.appendChild(chat);
    chat.querySelector(".chat-button").addEventListener("click", () => {
      const panel = chat.querySelector(".chat-panel");
      const shouldOpen = !panel.classList.contains("is-open");
      closeFloatingPopups({ keepChat: true, keepConsult: true });
      panel.classList.toggle("is-open", shouldOpen);
      trackEvent("chatbot_toggle");
    });
  }

  if (!document.querySelector(".consult-backdrop")) {
    const consult = document.createElement("div");
    consult.className = "consult-backdrop";
    consult.innerHTML = `
      <div class="consult-modal" role="dialog" aria-modal="true" aria-labelledby="consultTitle">
        <button class="consult-close" type="button" aria-label="Закрыть">×</button>
        <h3 id="consultTitle">Получить консультацию</h3>
        <p>Оставьте имя и телефон. Менеджер Golden House свяжется с вами и подберет подходящий проект.</p>
        <form class="consult-form">
          <input type="text" name="name" placeholder="Имя" aria-label="Имя" required>
          <input type="tel" name="phone" placeholder="Телефон" aria-label="Телефон" required>
          <button class="consult-submit" type="submit">Отправить</button>
        </form>
      </div>
    `;
    document.body.appendChild(consult);

    const consultForm = consult.querySelector(".consult-form");
    const consultSubmit = consult.querySelector(".consult-submit");
    const closeConsult = () => consult.classList.remove("is-open");

    consult.querySelector(".consult-close").addEventListener("click", closeConsult);
    consult.addEventListener("click", (event) => {
      if (event.target === consult) closeConsult();
    });

    consultForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const lead = {
        id: `GH-${Date.now()}`,
        page: document.title,
        createdAt: new Date().toISOString(),
        fields: Object.fromEntries(new FormData(consultForm).entries())
      };

      const leads = JSON.parse(localStorage.getItem("goldenHouseLeads") || "[]");
      leads.push(lead);
      localStorage.setItem("goldenHouseLeads", JSON.stringify(leads));
      trackEvent("crm_lead_created", lead);

      consultSubmit.textContent = "Заявка отправлено";
      consultSubmit.disabled = true;
    });
  }

  const openConsultModal = () => {
    const consult = document.querySelector(".consult-backdrop");
    if (!consult) return;
    closeFloatingPopups({ keepConsult: true });
    const consultForm = consult.querySelector(".consult-form");
    const consultSubmit = consult.querySelector(".consult-submit");
    consultForm?.reset();
    if (consultSubmit) {
      consultSubmit.textContent = "Отправить";
      consultSubmit.disabled = false;
    }
    consult.classList.add("is-open");
    window.setTimeout(() => consult.querySelector("input")?.focus(), 80);
    trackEvent("consult_modal_open");
  };

  document.querySelectorAll("[data-consult-trigger]").forEach((button) => {
    button.addEventListener("click", openConsultModal);
  });

  if (floating && !sessionStorage.getItem("promoPopupShown")) {
    const popup = document.createElement("div");
    popup.className = "promo-popup";
    popup.innerHTML = `
      <div class="popup-trust-row">
        <div class="popup-avatars" aria-hidden="true">
          <span style="background-image:url('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80')"></span>
          <span style="background-image:url('https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=100&q=80')"></span>
          <span style="background-image:url('https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80')"></span>
        </div>
        <span class="popup-stat">30 000+</span>
        <span class="popup-label">семей с нами</span>
      </div>
      <p class="popup-message">Golden House подберет квартиру с рассрочкой, актуальными акциями и удобной локацией в Ташкенте.</p>
      <div class="popup-actions"><button class="popup-button" type="button">Получить подборку <span class="popup-arrow" aria-hidden="true">&#8599;</span></button><button class="popup-close" type="button">Позже</button></div>
    `;
    document.body.appendChild(popup);
    window.setTimeout(() => {
      if (hasOpenModal()) return;
      closeFloatingPopups();
      popup.classList.add("is-visible");
    }, 1200);
    popup.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        popup.classList.remove("is-visible");
        sessionStorage.setItem("promoPopupShown", "true");
        if (button.classList.contains("popup-button")) {
          openConsultModal();
        }
        trackEvent("promo_popup_click", { action: button.textContent.trim() });
      });
    });
  }

  let exitShown = false;
  document.addEventListener("mouseleave", (event) => {
    if (!floating || exitShown || event.clientY > 8 || hasOpenModal()) return;
    exitShown = true;
    closeFloatingPopups();
    const popup = document.createElement("div");
    popup.className = "exit-popup is-visible";
    popup.innerHTML = `
      <div class="popup-trust-row">
        <div class="popup-avatars" aria-hidden="true">
          <span style="background-image:url('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80')"></span>
          <span style="background-image:url('https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=100&q=80')"></span>
          <span style="background-image:url('https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80')"></span>
        </div>
        <span class="popup-stat">30 000+</span>
        <span class="popup-label">семей с нами</span>
      </div>
      <p class="popup-message"><b>Не уходите без консультации</b>Оставьте заявку, и мы подберем проект под ваш бюджет и сроки.</p>
      <div class="popup-actions"><button class="popup-button" type="button">Получить консультацию <span class="popup-arrow" aria-hidden="true">&#8599;</span></button><button class="popup-close" type="button">Закрыть</button></div>
    `;
    document.body.appendChild(popup);
    popup.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        popup.classList.remove("is-visible");
        if (button.classList.contains("popup-button")) {
          openConsultModal();
        }
        trackEvent("exit_popup_click", { action: button.textContent.trim() });
      });
    });
    trackEvent("exit_popup_show");
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
  setupCrmForms();
  injectSupportWidgets();
  initGoldenHouseRoadmap();
  trackEvent("page_view");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSiteRuntime);
} else {
  bootSiteRuntime();
}
