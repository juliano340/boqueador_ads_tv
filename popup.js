const $ = (id) => document.getElementById(id);

let currentTabId = null;
let currentHost = null;

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

function render(cfg) {
  $("enabled").checked = !!cfg.enabled;
  const list = $("list");
  list.innerHTML = "";
  if (!cfg.selectors || !cfg.selectors.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Nenhum elemento bloqueado.";
    list.appendChild(li);
    return;
  }
  for (const sel of cfg.selectors) {
    const li = document.createElement("li");
    const code = document.createElement("code");
    code.textContent = sel;
    const btn = document.createElement("button");
    btn.textContent = "✕";
    btn.title = "Remover";
    btn.onclick = async () => {
      const resp = await send({ type: "REMOVE_SELECTOR", selector: sel });
      if (resp?.cfg) render(resp.cfg);
      else await refresh();
    };
    li.append(code, btn);
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

  $("pick").addEventListener("click", async () => {
    await send({ type: "START_PICKER" });
    window.close();
  });

  $("clear").addEventListener("click", async () => {
    chrome.storage.local.get(["sites"], (data) => {
      const sites = data.sites || {};
      if (sites[currentHost]) {
        sites[currentHost].selectors = [];
        chrome.storage.local.set({ sites }, refresh);
      }
    });
  });

  $("opts").addEventListener("click", () => chrome.runtime.openOptionsPage());
}

init();
