// Service worker: trata atalho de teclado e menu de contexto.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "boqueador-pick",
    title: "Boquear este elemento",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "boqueador-pick" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "START_PICKER" });
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "start-picker") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "START_PICKER" });
    });
  }
});
