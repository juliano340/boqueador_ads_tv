(() => {
  const HIDE_STYLE_ID = "__boqueador_hide_style__";
  const host = location.hostname;

  function getSiteConfig(cb) {
    chrome.storage.local.get(["sites"], (data) => {
      const sites = data.sites || {};
      cb(sites[host] || { enabled: false, selectors: [] }, sites);
    });
  }

  function applyHiding(selectors) {
    let style = document.getElementById(HIDE_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = HIDE_STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    if (!selectors.length) {
      style.textContent = "";
      return;
    }
    style.textContent = selectors.join(",") + "{display:none !important;visibility:hidden !important;}";
  }

  function clearHiding() {
    const style = document.getElementById(HIDE_STYLE_ID);
    if (style) style.textContent = "";
  }

  function init() {
    getSiteConfig((cfg) => {
      if (cfg.enabled && cfg.selectors.length) applyHiding(cfg.selectors);
    });
  }

  init();

  // Re-aplica em SPAs (mutações no DOM já são cobertas pelo CSS, mas garantimos
  // que o <style> sobreviva a navegações pushState que recriem o <head>).
  const obs = new MutationObserver(() => {
    if (!document.getElementById(HIDE_STYLE_ID)) init();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.sites) return;
    const cfg = (changes.sites.newValue || {})[host];
    if (cfg && cfg.enabled) applyHiding(cfg.selectors || []);
    else clearHiding();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "START_PICKER") {
      startPicker();
      sendResponse({ ok: true });
    } else if (msg.type === "GET_SITE") {
      getSiteConfig((cfg) => sendResponse({ host, cfg }));
      return true;
    } else if (msg.type === "TOGGLE_SITE") {
      chrome.storage.local.get(["sites"], (data) => {
        const sites = data.sites || {};
        const cur = sites[host] || { enabled: false, selectors: [] };
        cur.enabled = !!msg.enabled;
        sites[host] = cur;
        chrome.storage.local.set({ sites }, () => sendResponse({ ok: true, cfg: cur }));
      });
      return true;
    } else if (msg.type === "REMOVE_SELECTOR") {
      chrome.storage.local.get(["sites"], (data) => {
        const sites = data.sites || {};
        const cur = sites[host] || { enabled: false, selectors: [] };
        cur.selectors = cur.selectors.filter((s) => s !== msg.selector);
        sites[host] = cur;
        chrome.storage.local.set({ sites }, () => sendResponse({ ok: true, cfg: cur }));
      });
      return true;
    }
  });

  // ---------- Picker ----------
  let pickerActive = false;
  let highlightEl = null;
  let lastTarget = null;

  function startPicker() {
    if (pickerActive) return;
    pickerActive = true;
    document.body.classList.add("__boqueador_picker_cursor__");
    highlightEl = document.createElement("div");
    highlightEl.className = "__boqueador_highlight__";
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
    saveSelector(selector);
    stopPicker();
  }

  function onKey(e) {
    if (e.key === "Escape") stopPicker();
  }
  function onContext(e) {
    e.preventDefault();
    stopPicker();
  }

  function saveSelector(selector) {
    chrome.storage.local.get(["sites"], (data) => {
      const sites = data.sites || {};
      const cur = sites[host] || { enabled: true, selectors: [] };
      cur.enabled = true;
      if (!cur.selectors.includes(selector)) cur.selectors.push(selector);
      sites[host] = cur;
      chrome.storage.local.set({ sites }, () => applyHiding(cur.selectors));
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
