# Boqueador de Elementos

Extensão Chrome (MV3) para selecionar e **ocultar** ou **pintar de preto** elementos HTML em sites específicos.

## Instalar

1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. Clique **Carregar sem compactação** e selecione esta pasta

## Uso

- Clique no ícone da extensão → marque **Ativar neste site**
- **Ocultar elemento**: destaque vermelho, clique para esconder
- **Pintar de preto**: destaque escuro, clique para deixar o fundo do elemento preto
- Marque **Incluir elementos internos ao pintar** para pintar também tudo que estiver dentro do elemento (útil para escurecer cards, cabeçalhos e áreas brancas de uma vez)
- **Fundo preto na página inteira**: modo escuro básico por site (fundo da página + `color-scheme: dark`)
- `Esc` ou botão direito cancela a seleção
- Atalhos: `Ctrl+Shift+B` (ocultar) e `Alt+Shift+P` (pintar)
- Clique direito em qualquer elemento → **Boquear este elemento** / **Pintar este elemento de preto** / **Pintar este elemento e os internos de preto**
- Em **Configurações avançadas** (link no popup): gerenciar todos os sites e regras manualmente

## Como funciona

- Regras são salvas por hostname em `chrome.storage.local`, em três listas:
  - `selectors` — elementos ocultados (`display:none`)
  - `paintSelectors` — elementos pintados de preto
  - `paintDeepSelectors` — elemento + descendentes pintados de preto
- Um `<style>` é injetado em `document_start` aplicando as regras com `!important`
- Regras antigas (só `selectors`) continuam funcionando sem migração
- Funciona em SPAs (MutationObserver re-aplica o style se o head for trocado)
- Cada site tem flags `enabled` e `pageDark` independentes
