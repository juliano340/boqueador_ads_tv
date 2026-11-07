const root = document.getElementById("sites");

const RULE_KEYS = {
  hide: "selectors",
  paint: "paintSelectors",
  paintDeep: "paintDeepSelectors"
};

function normalize(cfg) {
  cfg = cfg || {};
  return {
    enabled: !!cfg.enabled,
    pageDark: !!cfg.pageDark,
    selectors: Array.isArray(cfg.selectors) ? cfg.selectors.slice() : [],
    paintSelectors: Array.isArray(cfg.paintSelectors) ? cfg.paintSelectors.slice() : [],
    paintDeepSelectors: Array.isArray(cfg.paintDeepSelectors) ? cfg.paintDeepSelectors.slice() : []
  };
}

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

function makeRuleLi(host, cfg, sites, rule) {
  const li = document.createElement("li");

  const tag = document.createElement("span");
  tag.className = "tag" + (rule.kind === "hide" ? "" : " paint");
  tag.textContent = rule.tag;

  const code = document.createElement("code");
  code.textContent = rule.selector;

  const rm = document.createElement("button");
  rm.textContent = "✕";
  rm.title = "Remover";
  rm.onclick = () => {
    const key = RULE_KEYS[rule.kind];
    cfg[key] = cfg[key].filter((s) => s !== rule.selector);
    sites[host] = cfg;
    save(sites, load);
  };

  li.append(tag, code, rm);
  return li;
}

function renderSite(host, rawCfg, sites) {
  const cfg = normalize(rawCfg);
  sites[host] = cfg;

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
  cb.checked = cfg.enabled;
  cb.onchange = () => {
    cfg.enabled = cb.checked;
    sites[host] = cfg;
    save(sites);
  };
  toggle.append(cb, document.createTextNode("ativo"));

  const darkToggle = document.createElement("label");
  const dcb = document.createElement("input");
  dcb.type = "checkbox";
  dcb.checked = cfg.pageDark;
  dcb.onchange = () => {
    cfg.pageDark = dcb.checked;
    if (dcb.checked) cfg.enabled = true;
    sites[host] = cfg;
    save(sites, load);
  };
  darkToggle.append(dcb, document.createTextNode("fundo preto"));

  const del = document.createElement("button");
  del.textContent = "Remover site";
  del.className = "danger";
  del.onclick = () => {
    delete sites[host];
    save(sites, load);
  };

  actions.append(toggle, darkToggle, del);
  header.append(title, actions);
  wrap.append(header);

  const list = document.createElement("ul");
  const rules = [
    ...cfg.selectors.map((selector) => ({ kind: "hide", tag: "oculto", selector })),
    ...cfg.paintSelectors.map((selector) => ({ kind: "paint", tag: "preto", selector })),
    ...cfg.paintDeepSelectors.map((selector) => ({ kind: "paintDeep", tag: "preto + filhos", selector }))
  ];

  if (!rules.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Sem regras.";
    list.appendChild(li);
  } else {
    for (const rule of rules) {
      list.appendChild(makeRuleLi(host, cfg, sites, rule));
    }
  }
  wrap.append(list);

  const add = document.createElement("div");
  add.className = "add";

  const kindSel = document.createElement("select");
  const kinds = [
    { value: "hide", label: "Ocultar" },
    { value: "paint", label: "Pintar preto" },
    { value: "paintDeep", label: "Pintar preto + filhos" }
  ];
  for (const k of kinds) {
    const opt = document.createElement("option");
    opt.value = k.value;
    opt.textContent = k.label;
    kindSel.appendChild(opt);
  }

  const input = document.createElement("input");
  input.placeholder = "seletor CSS (ex: .ads, #banner)";

  const btn = document.createElement("button");
  btn.textContent = "Adicionar";
  btn.onclick = () => {
    const v = input.value.trim();
    const key = RULE_KEYS[kindSel.value];
    if (!v || !key) return;
    if (!cfg[key].includes(v)) cfg[key].push(v);
    sites[host] = cfg;
    save(sites, load);
  };

  add.append(kindSel, input, btn);
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
    if (!sites[v]) {
      sites[v] = {
        enabled: true,
        pageDark: false,
        selectors: [],
        paintSelectors: [],
        paintDeepSelectors: []
      };
    }
    save(sites, () => {
      input.value = "";
      load();
    });
  });
};

load();
