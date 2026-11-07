const $ = (id) => document.getElementById(id);

let currentTabId = null;
let currentHost = null;

function normalize(cfg) {
  cfg = cfg || {};
  return {
    enabled: !!cfg.enabled,
    pageDark: !!cfg.pageDark,
    selectors: Array.isArray(cfg.selectors) ? cfg.selectors : [],
    paintSelectors: Array.isArray(cfg.paintSelectors) ? cfg.paintSelectors : [],
    paintDeepSelectors: Array.isArray(cfg.paintDeepSelectors) ? cfg.paintDeepSelectors : []
  };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function send(msg) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(currentTabId, msg, (resp) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(resp);
    });
  });
}

function render(rawCfg) {
  const cfg = normalize(rawCfg);
  $("enabled").checked = cfg.enabled;
  $("pagedark").checked = cfg.pageDark;

  const list = $("list");
  list.innerHTML = "";

  const rules = [
    ...cfg.selectors.map((selector) => ({ kind: "hide", tag: "oculto", selector })),
    ...cfg.paintSelectors.map((selector) => ({ kind: "paint", tag: "preto", selector })),
    ...cfg.paintDeepSelectors.map((selector) => ({ kind: "paintDeep", tag: "preto + filhos", selector }))
  ];

  if (!rules.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Nenhum elemento ocultado ou pintado.";
    list.appendChild(li);
    return;
  }

  for (const rule of rules) {
    const li = document.createElement("li");

    const tag = document.createElement("span");
    tag.className = "tag" + (rule.kind === "hide" ? "" : " paint");
    tag.textContent = rule.tag;

    const code = document.createElement("code");
    code.textContent = rule.selector;

    const btn = document.createElement("button");
    btn.textContent = "✕";
    btn.title = "Remover";
    btn.onclick = async () => {
      const resp = await send({ type: "REMOVE_RULE", kind: rule.kind, selector: rule.selector });
      if (resp?.cfg) render(resp.cfg);
      else await refresh();
    };

    li.append(tag, code, btn);
    list.appendChild(li);
  }
}

async function refresh() {
  const resp = await send({ type: "GET_SITE" });
  if (!resp) {
    $("host").textContent = currentHost || "(página não suportada)";
    render({ enabled: false, selectors: [] });
    return;
  }
  currentHost = resp.host;
  $("host").textContent = resp.host;
  render(resp.cfg);
}

async function init() {
  const tab = await getActiveTab();
  currentTabId = tab.id;
  try {
    currentHost = new URL(tab.url).hostname;
  } catch {}
  await refresh();

  $("enabled").addEventListener("change", async (e) => {
    const resp = await send({ type: "TOGGLE_SITE", enabled: e.target.checked });
    if (resp?.cfg) render(resp.cfg);
  });

  $("pagedark").addEventListener("change", async (e) => {
    const resp = await send({ type: "SET_PAGE_DARK", enabled: e.target.checked });
    if (resp?.cfg) render(resp.cfg);
    else await refresh();
  });

  $("pick").addEventListener("click", async () => {
    await send({ type: "START_PICKER", action: "hide" });
    window.close();
  });

  $("paint").addEventListener("click", async () => {
    await send({ type: "START_PICKER", action: "paint", deep: $("deep").checked });
    window.close();
  });

  $("clear").addEventListener("click", async () => {
    chrome.storage.local.get(["sites"], (data) => {
      const sites = data.sites || {};
      if (!sites[currentHost]) return refresh();
      sites[currentHost] = normalize({ enabled: sites[currentHost].enabled });
      chrome.storage.local.set({ sites }, refresh);
    });
  });

  $("opts").addEventListener("click", () => chrome.runtime.openOptionsPage());
}

init();
