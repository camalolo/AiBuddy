# AI Buddy Chrome Extension

Manifest V3 extension. Context menu actions (explain, fact-check, search, translate, grammar fix, TTS) on selected text + a sidepanel chat with tool-use capability.

## Commands

- **Lint:** `npm run lint` — ESLint with `unicorn` + `security` plugins; config lives in `release/config/eslint.config.mjs`
- **Pack:** `npm run pack` — builds `.zip` + `.crx` into `dist/` via `release/scripts/pack.mjs` (requires `../Chrome-Extension-Keys/key.pem` for CRX signing)
- **Publish:** `npm run publish` — runs `bash release/scripts/tag_release.sh` (tags, builds, creates GitHub Release)
- **Install for dev:** Load unpacked from repo root in `chrome://extensions` with Developer Mode on
- **No tests** — `npm test` is a placeholder

## Release Process

1. **Bump version** in `manifest.json` `"version"` field
2. **Commit** all changes and push to `main`
3. **Run release script:** `npm run publish` (or `bash release/scripts/tag_release.sh`)
   - Compares manifest version vs latest git tag
   - If version is newer: creates annotated tag `v{version}`, builds ZIP+CRX via `npm run pack`, creates GitHub Release with both artifacts, pushes tag and branch
4. **Requirements:** `gh` CLI authenticated (`gh auth login`), private key at `../Chrome-Extension-Keys/key.pem`
5. **CRX signing key** is outside the repo — never commit `key.pem`

## Architecture

All code runs as ES modules (`"type": "module"` in manifest's service worker). No bundler — files are loaded directly by the extension runtime.

```
background.js          <- service worker entry; wires up context menus + message listeners
  |- context-menus.js  <- creates context menu items, handles clicks
  |     |- tts.js          <- TTS: debounced playback, injects CSS indicators into pages
  |     |- utilities.js    <- showAIOverlay (markdown overlay), handleFixGrammar (in-place or overlay)
  |     |- api.js          <- tavilySearch(), tinyfishSearch() for web search
  |- messaging.js      <- chrome.runtime.onMessage handler for 'chat' and 'validate_api'
  |     |- api.js           <- callChatAPI(), getSettings(), providerConfigs, tavilySearch(), tinyfishSearch()
  |     |- tools.js         <- OpenAI function-calling tool definitions + executeTool()
  |- (sidepanel.js, options.js are standalone page scripts, not imported by background)
```

**Two UI surfaces:**
- **Options page** (`options.html/js`) — API key config, provider/model selection, search API keys, voice picker. Saves to `chrome.storage.sync`.
- **Sidepanel** (`sidepanel.html/js`) — Chat interface. Sends `{action: 'chat'}` messages to background. Receives markdown-rendered replies.

**Content injected into web pages:** `utilities.js` and `tts.js` use `chrome.scripting.executeScript` to inject overlays and TTS UI directly into page DOM. No separate content scripts.

## Key Patterns

- **Provider config is centralized** in `api.js` `providerConfigs` — single source of truth for URL, errorPrefix, apiKeyField, modelField, name. Both `context-menus.js` and `messaging.js` use lookup instead of if/else chains. Adding a new provider requires: (1) add entry to `providerConfigs`, (2) add UI section in `options.html`, (3) add save/restore logic in `options.js`.
- **Web search fallback chain** in `context-menus.js`: Tavily (primary, paid credits) -> TinyFish (fallback, free) -> LLM-only (no real search). Search keys are optional — "Search for this" works without any search provider configured.
- **Two API call paths:** `callChatAPI()` in `api.js` for single-shot context menu actions (no tool-use); `handleChat()` in `messaging.js` for sidepanel chat with OpenAI function-calling and follow-up round-trips.
- **Settings keys in `chrome.storage.sync`:** `sidepanelProvider`, `openaiApiKey`, `sidepanelModel`, `sidepanelOpenrouterApiKey`, `sidepanelOpenrouterModel`, `sidepanelOpenrouterFreeOnly`, `sidepanelDeepseekApiKey`, `sidepanelDeepseekModel`, `tavilyApiKey`, `tinyfishApiKey`, `browserVoice`. Legacy grammar-specific keys are cleaned up on options restore.
- **Markdown rendering** uses `marked.min.js` (vendored). Injected into pages before overlay display; loaded via `<script>` tag in sidepanel.
- **Grammar fix has two modes:** editable fields get in-place replacement (`setRangeText` / `execCommand`); non-editable selections show the overlay.

## Gotchas

- **No bundler/transpiler** — plain JS loaded by Chrome. Don't use Node.js-only APIs in extension files. The ESLint config sets `sourceType: "module"` only for specific extension JS files; all others default to `"script"`.
- **`release/` is a git submodule** (`chrome-ext-release`) containing the shared build toolchain (eslint config, pack script, release scripts). Changes to build tooling go there.
- **Overlay CSS is injected inline** via `chrome.scripting.executeScript` `func:` callbacks — large blocks of inline styles are stringified in JS. Markdown styles are duplicated in both `showAIOverlay` and `handleFixGrammar`.
- **`tts.js` exports a module-level `let ttsTimeout`** for debounce — since the service worker can be terminated, this state is ephemeral.
- **`tools.js` tool arguments** can arrive as either string or object depending on the API provider — `executeTool` handles both.
- **`callChatAPI` in `api.js`** uses `temperature: 0.2` hardcoded; does not support tool-use (only the sidepanel path in `messaging.js` does).
- **CSP:** `script-src 'self'` — no inline scripts in HTML pages; all JS must be in separate files.
