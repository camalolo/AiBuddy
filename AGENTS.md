# AI Buddy Chrome Extension

Manifest V3 extension. Context menu actions (explain, fact-check, translate, grammar fix, TTS) on selected text + a sidepanel chat with tool-use capability.

## Commands

- **Lint:** `npm run lint` — ESLint with `unicorn` + `security` plugins; config lives in `release/config/eslint.config.mjs`
- **Pack:** `npm run pack` — builds `.zip` + `.crx` into `dist/` via `release/scripts/pack.mjs` (requires `../Chrome-Extension-Keys/key.pem` for CRX signing)
- **Install for dev:** Load unpacked from repo root in `chrome://extensions` with Developer Mode on
- **No tests** — `npm test` is a placeholder

## Architecture

All code runs as ES modules (`"type": "module"` in manifest's service worker). No bundler — files are loaded directly by the extension runtime.

```
background.js          ← service worker entry; wires up context menus + message listeners
  ├─ context-menus.js  ← creates 9 context menu items, handles clicks
  │     ├─ tts.js          ← TTS: debounced playback, injects CSS indicators into pages
  │     └─ utilities.js    ← showAIOverlay (markdown overlay), handleFixGrammar (in-place or overlay)
  ├─ messaging.js      ← chrome.runtime.onMessage handler for 'chat' and 'validate_api'
  │     ├─ api.js           ← callChatAPI(), getSettings() — shared provider config
  │     └─ tools.js         ← OpenAI function-calling tool definitions + executeTool()
  └─ (sidepanel.js, options.js are standalone page scripts, not imported by background)
```

**Two UI surfaces:**
- **Options page** (`options.html/js`) — API key config, provider/model selection, voice picker. Saves to `chrome.storage.sync`.
- **Sidepanel** (`sidepanel.html/js`) — Chat interface. Sends `{action: 'chat'}` messages to background. Receives markdown-rendered replies.

**Content injected into web pages:** `utilities.js` and `tts.js` use `chrome.scripting.executeScript` to inject overlays and TTS UI directly into page DOM. No separate content scripts.

## Key Patterns

- **Provider logic is duplicated** between `messaging.js` (sidepanel chat with tool-use, separate fetch calls per provider) and `context-menus.js` (simple prompt→response via `callChatAPI`). The sidepanel path supports OpenAI function calling with a follow-up round-trip; the context menu path uses a single-shot `callChatAPI`.
- **Settings keys in `chrome.storage.sync`:** `sidepanelProvider`, `openaiApiKey`, `sidepanelModel`, `sidepanelOpenrouterApiKey`, `sidepanelOpenrouterModel`, `browserVoice`, `sidepanelOpenrouterFreeOnly`. Legacy grammar-specific keys are cleaned up on options restore.
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
