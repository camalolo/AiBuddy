/**
 * gmail-init.js — Content script (runs in Chrome's isolated world).
 *
 * Injects scripts into Gmail's main world sequentially so each can depend
 * on the previous one being fully loaded. Declared in manifest.json as a
 * content_script with run_at: document_start.
 *
 * Load order:
 *   1. gmail-tt-policy.js — Trusted Types policy (must be before gmail.js)
 *   2. vendor/jquery.min.js — jQuery (gmail.js dependency)
 *   3. vendor/gmail.min.js  — gmail.js DOM library
 *   4. gmail-loader.js      — Initializes gmail.js instance
 *   5. gmail-features.js    — AI buttons, modals, thread extraction
 */

const SCRIPTS = [
  'gmail-tt-policy.js',
  'vendor/jquery.min.js',
  'vendor/gmail.min.js',
  'gmail-loader.js',
  'gmail-features.js'
];

function injectScript(source) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = chrome.runtime.getURL(source);
    script.addEventListener('load', () => {
      script.remove();
      resolve();
    });
    script.addEventListener('error', (event) => {
      console.error(`[AI Buddy] Failed to load script: ${source}`, event);
      script.remove();
      reject(new Error(`Failed to load: ${source}`));
    });
    (document.head || document.documentElement).append(script);
  });
}

async function injectAll() {
  for (const scriptSource of SCRIPTS) {
    try {
      await injectScript(scriptSource);
    } catch {
      // Stop loading if any script fails
      return;
    }
  }
}

injectAll();

// Relay messages from main-world scripts to the extension background.
// gmail-features.js sends via globalThis.postMessage; we forward via
// chrome.runtime.sendMessage and log any errors to the page console.
globalThis.addEventListener('message', (event) => {
  if (event.source !== globalThis) return;
  if (event.data && event.data.type === 'AIBUDDY_GMAIL_REQUEST') {
    const { action, requestId, payload } = event.data;

    chrome.runtime.sendMessage(
      { action: 'gmail_ai', gmailAction: action, payload },
      (response) => {
        const result = response || { error: 'No response from background' };

        // Forward background errors to the page console for easier debugging
        if (result.error) {
          console.error(`[AI Buddy] Background error (${action}):`, result.error);
        }

        globalThis.postMessage({
          type: 'AIBUDDY_GMAIL_RESPONSE',
          requestId,
          result
        }, '*');
      }
    );
  }
});
