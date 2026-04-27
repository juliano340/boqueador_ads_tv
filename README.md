# Boqueador de Elementos

Extensão Chrome (MV3) para selecionar e bloquear elementos HTML em sites específicos.

## Instalar

1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. Clique **Carregar sem compactação** e selecione esta pasta

## Uso

- Clique no ícone da extensão → marque **Ativar neste site** → **Selecionar elemento**
- Passe o mouse sobre o elemento (destaque vermelho) e clique para bloquear
- `Esc` ou botão direito cancela a seleção
- Atalho: `Ctrl+Shift+B` inicia o picker
- Clique direito em qualquer elemento → **Boquear este elemento**
- Em **Configurações avançadas** (link no popup): gerenciar todos os sites e seletores manualmente

## Como funciona

- Seletores CSS são salvos por hostname em `chrome.storage.local`
- Um `<style>` é injetado em `document_start` aplicando `display:none !important`
- Funciona em SPAs (MutationObserver re-aplica o style se o head for trocado)
- Cada site tem flag `enabled` independente — a extensão só bloqueia em sites ativos
