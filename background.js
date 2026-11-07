// Service worker: trata atalho de teclado e menu de contexto.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "boqueador-pick",
      title: "Boquear este elemento",
      contexts: ["all"]
    });
    chrome.contextMenus.create({
      id: "boqueador-paint",
      title: "Pintar este elemento de preto",
      contexts: ["all"]
    });
    chrome.contextMenus.create({
      id: "boqueador-paint-deep",
      title: "Pintar este elemento e os internos de preto",
      contexts: ["all"]
    });
  });
});

const MENU_ACTIONS = {
  "boqueador-pick": { action: "hide", deep: false },
  "boqueador-paint": { action: "paint", deep: false },
  "boqueador-paint-deep": { action: "paint", deep: true }
};

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const msg = MENU_ACTIONS[info.menuItemId];
  if (msg && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "START_PICKER", ...msg });
  }
});

chrome.commands.onCommand.addListener((command) => {
  const actions = {
    "start-picker": { action: "hide", deep: false },
    "start-paint": { action: "paint", deep: false },
    "start-paint-deep": { action: "paint", deep: true }
  };
  const msg = actions[command];
  if (!msg) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "START_PICKER", ...msg });
  });
});
