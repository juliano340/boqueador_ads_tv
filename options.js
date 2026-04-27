const root = document.getElementById("sites");

function load() {
  chrome.storage.local.get(["sites"], (data) => render(data.sites || {}));
}

function save(sites, cb) {
  chrome.storage.local.set({ sites }, cb || (() => {}));
}

function render(sites) {
  root.innerHTML = "";
  const hosts = Object.keys(sites).sort();
  if (!hosts.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Nenhum site configurado ainda.";
    root.appendChild(p);
    return;
  }
  for (const host of hosts) {
    root.appendChild(renderSite(host, sites[host], sites));
  }
}

function renderSite(host, cfg, sites) {
  const wrap = document.createElement("div");
  wrap.className = "site";

  const header = document.createElement("header");
  const title = document.createElement("h2");
  title.textContent = host;
  const actions = document.createElement("div");
  actions.className = "actions";

  const toggle = document.createElement("label");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!cfg.enabled;
  cb.onchange = () => {
    cfg.enabled = cb.checked;
    sites[host] = cfg;
    save(sites);
  };
  toggle.append(cb, document.createTextNode(" ativo"));

  const del = document.createElement("button");
  del.textContent = "Remover site";
  del.className = "danger";
  del.onclick = () => {
    delete sites[host];
    save(sites, load);
  };

  actions.append(toggle, del);
  header.append(title, actions);
  wrap.append(header);

  const list = document.createElement("ul");
  if (!cfg.selectors?.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Sem seletores.";
    list.appendChild(li);
  } else {
    for (const sel of cfg.selectors) {
      const li = document.createElement("li");
      const code = document.createElement("code");
      code.textContent = sel;
      const rm = document.createElement("button");
      rm.textContent = "✕";
      rm.onclick = () => {
        cfg.selectors = cfg.selectors.filter((s) => s !== sel);
        sites[host] = cfg;
        save(sites, load);
      };
      li.append(code, rm);
      list.appendChild(li);
    }
  }
  wrap.append(list);

  const add = document.createElement("div");
  add.className = "add";
  const input = document.createElement("input");
  input.placeholder = "seletor CSS (ex: .ads, #banner)";
  const btn = document.createElement("button");
  btn.textContent = "Adicionar";
  btn.onclick = () => {
    const v = input.value.trim();
    if (!v) return;
    cfg.selectors = cfg.selectors || [];
    if (!cfg.selectors.includes(v)) cfg.selectors.push(v);
    sites[host] = cfg;
    save(sites, load);
  };
  add.append(input, btn);
  wrap.append(add);

  return wrap;
}

document.getElementById("add-host").onclick = () => {
  const input = document.getElementById("new-host");
  let v = input.value.trim().toLowerCase();
  if (!v) return;
  v = v.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  chrome.storage.local.get(["sites"], (data) => {
    const sites = data.sites || {};
    if (!sites[v]) sites[v] = { enabled: true, selectors: [] };
    save(sites, () => {
      input.value = "";
      load();
    });
  });
};

load();
