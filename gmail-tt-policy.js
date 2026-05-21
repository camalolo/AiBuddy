/**
 * gmail-tt-policy.js — Main-world script, loaded FIRST before all others.
 *
 * Creates the 'default' Trusted Types policy. This is the ONLY policy name
 * that automatically intercepts ALL innerHTML/outerHTML assignments in the
 * page, including those made by third-party libraries (jQuery, gmail.js)
 * that have no awareness of Trusted Types.
 *
 * Must load before jQuery and gmail.js since both use innerHTML during init.
 */

(function () {
  if (!globalThis.trustedTypes) return;

  // Only create if Gmail hasn't already registered one
  if (globalThis.trustedTypes.defaultPolicy) return;

  try {
    globalThis.trustedTypes.createPolicy('default', {
      createHTML(input) { return input; },
      createScriptURL(input) { return input; },
      createScript(input) { return input; }
    });
  } catch {
    console.error('[AI Buddy] Could not create Trusted Types default policy');
  }
})();
