/**
 * gmail-loader.js — Main-world script.
 *
 * Initializes gmail.js and stores the instance on globalThis for gmail-features.js.
 * Trusted Types policy is already created by the inline script in gmail-init.js.
 */

(function () {

  let gmailInstance;

  function initGmail() {
    if (globalThis.Gmail === undefined) {
      return false;
    }
    try {
      gmailInstance = new globalThis.Gmail(globalThis.jQuery);
      globalThis._aibuddy_gmail = gmailInstance;
      return true;
    } catch (error) {
      console.warn('[AI Buddy] Failed to initialize gmail.js:', error);
      return false;
    }
  }

  // Try to init immediately (gmail.js is loaded before this script via sequential injection)
  if (!initGmail()) {
    // Poll in case gmail.js is slow to initialize
    const interval = setInterval(() => {
      if (initGmail()) {
        clearInterval(interval);
      }
    }, 50);

    setTimeout(() => clearInterval(interval), 30_000);
  }
})();
