(() => {
  const HIDE_STYLE_ID = "__boqueador_hide_style__";
  const RULE_KEYS = {
    hide: "selectors",
    paint: "paintSelectors",
    paintDeep: "paintDeepSelectors"
  };
  const host = location.hostname;

  // Guarda contra "Extension context invalidated": quando a extensão é
  // recarregada, abas antigas mantêm este content.js rodando, mas chrome.*
  // passa a lançar. Detectamos isso e desligamos listeners/observer.
  let contextAlive = true;
  let obs = null;
  function ctxOk() {
    try {
      return contextAlive && !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }
  function safe(fn) {
    if (!ctxOk()) return;
    try {
      fn();
    } catch (e) {
      if (String(e?.message || e).includes("Extension context invalidated")) {
        contextAlive = false;
        try { obs?.disconnect(); } catch {}
      } else {
        throw e;
      }
    }
  }

  // Normaliza a configuração do site, mantendo compatibilidade com o formato
  // antigo (que só tinha `enabled` e `selectors`).
  function normalizeSite(cfg) {
    cfg = cfg || {};
    return {
      enabled: !!cfg.enabled,
      pageDark: !!cfg.pageDark,
      selectors: Array.isArray(cfg.selectors) ? cfg.selectors : [],
      paintSelectors: Array.isArray(cfg.paintSelectors) ? cfg.paintSelectors : [],
      paintDeepSelectors: Array.isArray(cfg.paintDeepSelectors) ? cfg.paintDeepSelectors : []
    };
  }

  function getSiteConfig(cb) {
    safe(() => {
      chrome.storage.local.get(["sites"], (data) => {
        if (chrome.runtime.lastError) return;
        const sites = data.sites || {};
        cb(normalizeSite(sites[host]), sites);
      });
    });
  }

  function ensureStyle() {
    let style = document.getElementById(HIDE_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = HIDE_STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    return style;
  }

  function buildCss(cfg) {
    const rules = [];

    if (cfg.selectors.length) {
      rules.push(`${cfg.selectors.join(",")}{display:none !important;visibility:hidden !important;}`);
    }

    // Pinta apenas o elemento selecionado.
    if (cfg.paintSelectors.length) {
      rules.push(
        `${cfg.paintSelectors.join(",")}{background:#000 !important;color:#e8e8e8 !important;}`
      );
    }

    // Pinta o elemento e todos os seus descendentes (útil para "apagar" cards,
    // cabeçalhos e áreas brancas de uma vez).
    if (cfg.paintDeepSelectors.length) {
      const sels = cfg.paintDeepSelectors.flatMap((s) => [s, `${s} *`]);
      rules.push(`${sels.join(",")}{background:#000 !important;color:#e8e8e8 !important;}`);
    }

    // Modo escuro da página inteira.
    if (cfg.pageDark) {
      rules.push(
        "html,body{background:#000 !important;}html{color-scheme:dark;}"
      );
    }

    return rules.join("\n");
  }

  let lastCfg = null;

  function applyRules(cfg) {
    lastCfg = normalizeSite(cfg);
    const style = ensureStyle();
    style.textContent = lastCfg.enabled ? buildCss(lastCfg) : "";
  }

  function updateSite(mutator, sendResponse) {
    safe(() => {
      chrome.storage.local.get(["sites"], (data) => {
        if (chrome.runtime.lastError) return;
        const sites = data.sites || {};
        const cur = normalizeSite(sites[host]);
        mutator(cur);
        sites[host] = cur;
        chrome.storage.local.set({ sites }, () => {
          applyRules(cur);
          if (sendResponse) sendResponse({ ok: true, cfg: cur });
        });
      });
    });
  }

  function init() {
    getSiteConfig((cfg) => applyRules(cfg));
  }

  init();

  // Re-aplica em SPAs (mutações no DOM já são cobertas pelo CSS, mas garantimos
  // que o <style> sobreviva a navegações pushState que recriem o <head>).
  obs = new MutationObserver(() => {
    if (!ctxOk()) { try { obs.disconnect(); } catch {} return; }
    if (!document.getElementById(HIDE_STYLE_ID)) {
      ensureStyle();
      if (lastCfg) applyRules(lastCfg);
      else init();
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  safe(() => {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (!ctxOk()) return;
      if (area !== "local" || !changes.sites) return;
      applyRules((changes.sites.newValue || {})[host]);
    });
  });

  safe(() => chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!ctxOk()) return;

    if (msg.type === "START_PICKER") {
      startPicker(msg.action === "paint" ? "paint" : "hide", !!msg.deep);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "GET_SITE") {
      getSiteConfig((cfg) => sendResponse({ host, cfg }));
      return true;
    }

    if (msg.type === "TOGGLE_SITE") {
      updateSite((cur) => { cur.enabled = !!msg.enabled; }, sendResponse);
      return true;
    }

    if (msg.type === "SET_PAGE_DARK") {
      updateSite((cur) => {
        cur.pageDark = !!msg.enabled;
        if (msg.enabled) cur.enabled = true;
      }, sendResponse);
      return true;
    }

    if (msg.type === "REMOVE_RULE") {
      updateSite((cur) => {
        const key = RULE_KEYS[msg.kind];
        if (key) cur[key] = cur[key].filter((s) => s !== msg.selector);
      }, sendResponse);
      return true;
    }
  }));

  // ---------- Picker ----------
  let pickerActive = false;
  let pickerAction = "hide";
  let pickerDeep = false;
  let highlightEl = null;
  let lastTarget = null;

  function startPicker(action = "hide", deep = false) {
    if (pickerActive) return;
    pickerActive = true;
    pickerAction = action;
    pickerDeep = !!deep;
    document.body.classList.add("__boqueador_picker_cursor__");
    highlightEl = document.createElement("div");
    highlightEl.className = "__boqueador_highlight__";
    if (action === "paint") highlightEl.classList.add("__boqueador_highlight_paint__");
    if (action === "paint" && deep) highlightEl.classList.add("__boqueador_highlight_deep__");
    document.body.appendChild(highlightEl);

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("contextmenu", onContext, true);
  }

  function stopPicker() {
    pickerActive = false;
    document.body.classList.remove("__boqueador_picker_cursor__");
    if (highlightEl) highlightEl.remove();
    highlightEl = null;
    lastTarget = null;
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("contextmenu", onContext, true);
  }

  function onMove(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === highlightEl) return;
    lastTarget = el;
    const r = el.getBoundingClientRect();
    Object.assign(highlightEl.style, {
      top: r.top + window.scrollY + "px",
      left: r.left + window.scrollX + "px",
      width: r.width + "px",
      height: r.height + "px"
    });
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = lastTarget;
    if (!el) return stopPicker();
    const selector = buildSelector(el);
    if (!selector) return stopPicker();

    if (pickerAction === "paint") {
      saveRule(pickerDeep ? "paintDeep" : "paint", selector);
    } else {
      saveRule("hide", selector);
    }
    stopPicker();
  }

  function onKey(e) {
    if (e.key === "Escape") stopPicker();
  }
  function onContext(e) {
    e.preventDefault();
    stopPicker();
  }

  function saveRule(kind, selector) {
    updateSite((cur) => {
      cur.enabled = true;
      const key = RULE_KEYS[kind];
      if (key && !cur[key].includes(selector)) cur[key].push(selector);
    });
  }

  // Gera seletor CSS único e razoavelmente estável.
  function buildSelector(el) {
    if (!(el instanceof Element)) return "";
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) {
      const sel = "#" + CSS.escape(el.id);
      if (document.querySelectorAll(sel).length === 1) return sel;
    }
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      let part = cur.tagName.toLowerCase();
      if (cur.id && /^[A-Za-z][\w-]*$/.test(cur.id)) {
        part = "#" + CSS.escape(cur.id);
        parts.unshift(part);
        break;
      }
      const cls = Array.from(cur.classList)
        .filter((c) => !c.startsWith("__boqueador") && /^[A-Za-z_-][\w-]*$/.test(c))
        .slice(0, 2);
      if (cls.length) part += "." + cls.map(CSS.escape).join(".");
      const parent = cur.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
        if (sameTag.length > 1) {
          const idx = sameTag.indexOf(cur) + 1;
          part += `:nth-of-type(${idx})`;
        }
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(" > ");
  }
})();
