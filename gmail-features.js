/**
 * gmail-features.js — Main-world script.
 *
 * Uses gmail.js to observe Gmail's UI, inject AI action buttons into
 * the email toolbar, and handle summarize/explain/draft-reply actions.
 *
 * Communication with the extension background happens via globalThis.postMessage
 * (relayed by gmail-init.js content script).
 */

(function () {

  // ------------------------------------------------------------------ //
  //  Constants                                                          //
  // ------------------------------------------------------------------ //

  const BUTTON_STYLES = `
    .aibuddy-toolbar-btn {
      background: #1a73e8;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      margin-right: 6px;
      white-space: nowrap;
      transition: background 0.2s, opacity 0.2s;
      vertical-align: middle;
      line-height: 20px;
    }
    .aibuddy-toolbar-btn:hover { background: #1557b0; }
    .aibuddy-toolbar-btn:disabled { opacity: 0.6; cursor: wait; }
    .aibuddy-btn-group { display: inline-flex; align-items: center; margin-left: 8px; position: relative; z-index: 1; }
  `;

  const MODAL_STYLES = `
    .aibuddy-modal-backdrop {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); z-index: 2_147_483_647;
      display: flex; align-items: center; justify-content: center;
    }
    .aibuddy-modal {
      background: #fff; border-radius: 8px; width: 90vw; max-width: 720px;
      max-height: 85vh; display: flex; flex-direction: column;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3); font-family: Arial, sans-serif;
    }
    .aibuddy-modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid #e0e0e0;
    }
    .aibuddy-modal-header h3 { margin: 0; font-size: 16px; color: #202124; }
    .aibuddy-modal-close {
      background: none; border: none; font-size: 20px; cursor: pointer;
      color: #5f6368; padding: 4px 8px; border-radius: 4px;
    }
    .aibuddy-modal-close:hover { background: #f1f3f4; }
    .aibuddy-modal-body {
      padding: 20px; overflow-y: auto; flex: 1;
      color: #202124; font-size: 14px; line-height: 1.6;
    }
    .aibuddy-modal-body h1, .aibuddy-modal-body h2,
    .aibuddy-modal-body h3 { margin-top: 16px; color: #202124; }
    .aibuddy-modal-body p { margin: 8px 0; }
    .aibuddy-modal-body ul, .aibuddy-modal-body ol { padding-left: 24px; }
    .aibuddy-modal-body code {
      background: #f1f3f4; padding: 2px 6px; border-radius: 3px; font-size: 13px;
    }
    .aibuddy-modal-body pre {
      background: #f1f3f4; padding: 12px; border-radius: 4px; overflow-x: auto;
    }
    .aibuddy-modal-body blockquote {
      border-left: 3px solid #1a73e8; margin: 8px 0; padding: 4px 12px;
      color: #5f6368;
    }
    .aibuddy-modal-spinner {
      display: flex; align-items: center; justify-content: center;
      padding: 40px; color: #5f6368; font-size: 14px;
    }
    .aibuddy-modal-spinner::before {
      content: ''; display: inline-block; width: 20px; height: 20px;
      border: 2px solid #e0e0e0; border-top-color: #1a73e8;
      border-radius: 50%; margin-right: 10px;
      animation: aibuddy-spin 0.8s linear infinite;
    }
    @keyframes aibuddy-spin { to { transform: rotate(360deg); } }
    .aibuddy-draft-actions {
      display: flex; gap: 8px; padding: 12px 20px;
      border-top: 1px solid #e0e0e0; background: #f8f9fa;
      border-radius: 0 0 8px 8px;
    }
    .aibuddy-draft-actions button {
      padding: 8px 16px; border-radius: 4px; border: none;
      font-size: 13px; font-weight: 500; cursor: pointer;
    }
    .aibuddy-draft-insert {
      background: #1a73e8; color: #fff;
    }
    .aibuddy-draft-insert:hover { background: #1557b0; }
    .aibuddy-draft-dismiss {
      background: #f1f3f4; color: #5f6368;
    }
    .aibuddy-draft-dismiss:hover { background: #e8eaed; }
  `;

  const PROMPTS = {
    summarize: `You are an AI assistant integrated into Gmail. Summarize the following email thread concisely. Include:
- Key topics discussed
- Any decisions or action items
- Who is involved and their roles (if apparent)
Keep the summary brief and well-structured. Use markdown formatting.`,

    explain: `You are an AI assistant integrated into Gmail. Explain the following email thread in detail. Include:
- Context and background of the conversation
- Key points and arguments made by each participant
- Technical terms or jargon explained
- Implications and personalized next steps for {userName} ({currentUser}), the account owner
Use markdown formatting for clarity.`,

    draftReply: `You are an AI assistant integrated into Gmail. Based on the following email thread, draft a tentative reply email. The reply should:
- Be professional and appropriate in tone
- Address the key points from the latest email
- Be concise but complete
- Include a subject line if replying to a changed topic
- Match the tone and writing style of {userName}'s previous messages in the thread if any are present
- Write from the perspective of {userName} ({currentUser}), the owner of this email account
Write ONLY the email body text, ready to send. Do not include "Subject:" unless the subject changed. Do not add introductory meta-text like "Here's a draft reply:" — just write the email itself.`
  };

  // ------------------------------------------------------------------ //
  //  State                                                              //
  // ------------------------------------------------------------------ //

  let gmail;
  let requestCounter = 0;

  // ------------------------------------------------------------------ //
  //  Helpers                                                            //
  // ------------------------------------------------------------------ //

  /** Inject a <style> block into the page (idempotent by id). */
  function ensureStyles(id, css) {
    if (document.querySelector('#' + id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.append(style);
  }

  /** Send a request to the extension background via postMessage relay. */
  function sendToBackground(action, payload) {
    return new Promise((resolve, reject) => {
      const requestId = ++requestCounter;

      function handler(event) {
        if (event.source !== globalThis) return;
        if (event.data && event.data.type === 'AIBUDDY_GMAIL_RESPONSE' && event.data.requestId === requestId) {
          globalThis.removeEventListener('message', handler);
          const result = event.data.result;
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result.reply);
          }
        }
      }

      globalThis.addEventListener('message', handler);

      // Timeout after 60 seconds
      setTimeout(() => {
        globalThis.removeEventListener('message', handler);
        reject(new Error('Request timed out'));
      }, 60_000);

      globalThis.postMessage({
        type: 'AIBUDDY_GMAIL_REQUEST',
        action,
        requestId,
        payload
      }, '*');
    });
  }

  /** Extract readable text from the current email thread. */
  function getThreadContent() {
    if (!gmail) return;

    try {
      const threadId = gmail.new.get.thread_id();
      if (!threadId) return;

      // Try the DOM-based approach first (works without XHR interception)
      const threadData = gmail.new.get.thread_data();
      if (threadData && threadData.emails && threadData.emails.length > 0) {
        return formatThreadFromData(threadData);
      }

      // Fallback: extract from DOM directly
      return extractThreadFromDOM();
    } catch (error) {
      console.warn('[AI Buddy] Error extracting thread:', error);
      return extractThreadFromDOM();
    }
  }

  /** Format thread data from gmail.js cache. */
  function formatThreadFromData(threadData) {
    const parts = [];
    const subjectElement = document.querySelector('.ha h2, .hP');
    const subject = (threadData.emails[0] && threadData.emails[0].subject) || (subjectElement && subjectElement.textContent.trim());
    if (subject) parts.push(`Subject: ${subject}\n`);

    for (const email of threadData.emails) {
      const from = email.from ? (email.from.name || email.from.email || 'Unknown') : 'Unknown';
      const date = email.date || '';
      parts.push(`--- From: ${from} | Date: ${date} ---`);

      if (email.content_html) {
        // Strip HTML tags for a clean text representation
        const text = htmlToPlainText(email.content_html);
        parts.push(text);
      } else if (email.content_text) {
        parts.push(email.content_text);
      }
      parts.push('');
    }
    return parts.join('\n');
  }

  /** Fallback: extract thread content directly from the Gmail DOM. */
  function extractThreadFromDOM() {
    const parts = [];
    const subject = document.querySelector('.ha h2, .hP');
    if (subject) parts.push(`Subject: ${subject.textContent.trim()}\n`);

    // Gmail email containers
    const emails = document.querySelectorAll('.h7, .adn, [data-message-id]');
    for (const element of emails) {
      const fromElement = element.querySelector('.go, .gD, .cf, [email]');
      const from = fromElement ? (fromElement.getAttribute('email') || fromElement.textContent.trim()) : 'Unknown';
      const dateElement = element.querySelector('.g3, .gK, [title]');
      const date = dateElement ? dateElement.getAttribute('title') || dateElement.textContent.trim() : '';

      const bodyElement = element.querySelector('.ii.gt, .a3s, .gmail_quote');
      const body = bodyElement ? htmlToPlainText(bodyElement.innerHTML) : '';

      if (body.trim()) {
        parts.push(`--- From: ${from} | Date: ${date} ---`, body.trim(), '');
      }
    }

    // If DOM extraction failed, try the visible text approach
    if (parts.length <= 1) {
      return extractVisibleText();
    }

    return parts.join('\n');
  }

  /** Last resort: grab visible text from the thread panel. */
  function extractVisibleText() {
    const threadElement = document.querySelector('.nH.aqK, .nH.if, [role="main"]');
    if (!threadElement) return;

    const subject = document.querySelector('.ha h2, .hP');
    let text = subject ? `Subject: ${subject.textContent.trim()}\n\n` : '';

    text += threadElement.textContent || '';
    return text.slice(0, 15_000);
  }

  /** Strip HTML to plain text. */
  function htmlToPlainText(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    // Remove scripts and styles
    for (const element of div.querySelectorAll('script, style')) element.remove();
    let text = div.textContent || '';
    // Collapse excessive whitespace
    text = text.replaceAll(/[ \t]+/g, ' ').replaceAll(/\n\s*\n\s*\n/g, '\n\n').trim();
    // Limit size
    return text.slice(0, 15_000);
  }

  /** Simple markdown-to-HTML (enough for LLM output, no dependency needed). */
  function renderMarkdown(text) {
    if (!text) return '';
    let html = text;
    // Code blocks
    html = html.replaceAll(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    // Inline code
    html = html.replaceAll(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    html = html.replaceAll(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replaceAll(/\*(.+?)\*/g, '<em>$1</em>');
    // Headers
    html = html.replaceAll(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replaceAll(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replaceAll(/^# (.+)$/gm, '<h1>$1</h1>');
    // Unordered lists
    html = html.replaceAll(/^[*-] (.+)$/gm, '<li>$1</li>');
    html = html.replaceAll(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    // Blockquotes
    html = html.replaceAll(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    // Horizontal rules
    html = html.replaceAll(/^---$/gm, '<hr>');
    // Line breaks → paragraphs
    html = html.replaceAll('\n\n', '</p><p>');
    html = html.replaceAll('\n', '<br>');
    html = '<p>' + html + '</p>';
    // Clean up empty paragraphs
    html = html.replaceAll(/<p>\s*<\/p>/g, '');
    return html;
  }

  // ------------------------------------------------------------------ //
  //  Modal UI                                                           //
  // ------------------------------------------------------------------ //

  function showModal(title, bodyHtml) {
    // Remove existing modal
    closeModal();

    const backdrop = document.createElement('div');
    backdrop.className = 'aibuddy-modal-backdrop';
    backdrop.id = 'aibuddy-modal';

    backdrop.innerHTML = `
      <div class="aibuddy-modal">
        <div class="aibuddy-modal-header">
          <h3>${title}</h3>
          <button class="aibuddy-modal-close" title="Close">&times;</button>
        </div>
        <div class="aibuddy-modal-body">${bodyHtml}</div>
      </div>
    `;

    document.body.append(backdrop);

    // Event handlers
    backdrop.querySelector('.aibuddy-modal-close').addEventListener('click', closeModal);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) closeModal();
    });
    document.addEventListener('keydown', function escHandler(event) {
      if (event.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    });
  }

  function closeModal() {
    const modal = document.querySelector('#aibuddy-modal');
    if (modal) modal.remove();
  }

  function showLoading(title) {
    showModal(title, '<div class="aibuddy-modal-spinner">Processing...</div>');
  }

  // ------------------------------------------------------------------ //
  //  AI Actions                                                         //
  // ------------------------------------------------------------------ //

  async function handleSummarize() {
    await executeAiAction('Summarize Thread', 'summarize', false);
  }

  async function handleExplain() {
    await executeAiAction('Explain Thread', 'explain', false);
  }

  async function handleDraftReply() {
    await executeAiAction('Draft Reply', 'draftReply', false, true);
  }

  async function executeAiAction(title, actionType, isDraft = false, isReply = false) {
    const content = getThreadContent();
    if (!content) {
      showModal(title, '<p>Could not extract email content. Please make sure you are viewing an email thread.</p>');
      return;
    }

    showLoading(title);

    try {
      const currentUser = gmail.get.user_email() || '';
      const accounts = gmail.get.loggedin_accounts();
      const myAccount = accounts.find(a => a.email === currentUser);
      const userName = (myAccount && myAccount.name) || '';
      let prompt = PROMPTS[actionType];
      prompt = prompt.replace('{currentUser}', currentUser);
      prompt = prompt.replace('{userName}', userName || currentUser);
      const reply = await sendToBackground('gmail_ai_action', {
        prompt: prompt,
        threadContent: content,
        actionType
      });

      if (!reply) {
        showModal(title, '<p>No response from AI. Please check your API settings.</p>');
        return;
      }

      if (isReply) {
        // Draft reply: insert directly into Gmail's reply compose
        await insertReply(reply);
        closeModal();
      } else {
        const rendered = renderMarkdown(reply);
        showModal(title, rendered);
      }
    } catch (error) {
      showModal(title, `<p style="color: #d93025;">Error: ${error.message}</p>`);
    }
  }

  /** Open a reply compose and insert the drafted text directly. */
  async function insertReply(text) {
    try {
      // Click Gmail's reply button to open a compose area
      const replyButton = document.querySelector('[data-tooltip="Reply"], .amn [act="reply"], span.ams.bkH');
      if (replyButton) {
        replyButton.click();
      }

      // Wait for the compose editor to appear (poll for up to 3 seconds)
      const editor = await waitForElement('[contenteditable="true"][role="textbox"]', 3000);
      if (editor) {
        setComposeBody(editor, text);
      } else {
        // Fallback: show error in a brief toast-like notification
        showInlineError('Could not open reply box. Please click Reply first, then try Draft Reply again.');
      }
    } catch (error) {
      console.error('[AI Buddy] Error inserting reply:', error);
      showInlineError('Error inserting reply: ' + error.message);
    }
  }

  /** Poll for an element matching the selector to appear in the DOM. */
  function waitForElement(selector, timeout) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const startTime = Date.now();
      const interval = setInterval(() => {
        const element = document.querySelector(selector);
        if (element) {
          clearInterval(interval);
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          resolve(undefined);
        }
      }, 200);
    });
  }

  /** Show a brief error notification at the top of Gmail. */
  function showInlineError(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#d93025;color:#fff;padding:12px 24px;border-radius:8px;z-index:2147483647;font-size:14px;font-family:Arial,sans-serif;max-width:600px;';
    document.body.append(notification);
    setTimeout(() => notification.remove(), 5000);
  }

  /** Find an inline reply compose area. */
  function findReplyCompose() {
    // Gmail inline reply editor
    const editors = document.querySelectorAll('[contenteditable="true"][role="textbox"]');
    for (const editor of editors) {
      // Check if this is inside a reply container (not a standalone compose)
      const replyContainer = editor.closest('.adn, .gA, .aD, .h7');
      if (replyContainer) return editor;
    }
    // Fallback: any contenteditable in the thread area
    const threadEditors = document.querySelectorAll('.nH [contenteditable="true"][role="textbox"]');
    if (threadEditors.length > 0) return threadEditors.at(-1);
  }

  /** Set text in a compose editor. */
  function setComposeBody(editor, text) {
    // Convert plain text to HTML paragraphs
    const html = text.split('\n').map(line => `<div>${line || '<br>'}</div>`).join('');
    editor.innerHTML = html;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.focus();
  }

  // ------------------------------------------------------------------ //
  //  Button Injection                                                   //
  // ------------------------------------------------------------------ //

  function injectButtons() {
    if (!gmail) return;

    // Only inject when viewing an email
    if (!gmail.new.get.email_id()) return;

    // Avoid duplicate injection
    if (document.querySelector('#aibuddy-btn-group')) return;

    // Find Gmail's toolbar button container
    // Each .G-Ni is a button wrapper; find the parent that contains them all
    const firstBtn = document.querySelector('.aDh .G-Ni, .aqL .G-Ni, [gh="mtb"] .G-Ni, .iH .G-Ni, .G-atb .G-Ni');
    if (!firstBtn) return;
    const btnContainer = firstBtn.parentElement;

    const group = document.createElement('div');
    group.className = 'aibuddy-btn-group G-Ni J-J5-Ji';
    group.id = 'aibuddy-btn-group';

    const buttons = [
      { label: '\u{1F4CB} Summarize', handler: handleSummarize },
      { label: '\u{1F4A1} Explain', handler: handleExplain },
      { label: '\u{270D}\u{FE0F} Draft Reply', handler: handleDraftReply }
    ];

    for (const { label, handler } of buttons) {
      const button = document.createElement('button');
      button.className = 'aibuddy-toolbar-btn';
      button.textContent = label;
      button.addEventListener('click', handler);
      group.append(button);
    }

    btnContainer.append(group);
  }

  // ------------------------------------------------------------------ //
  //  Initialization                                                     //
  // ------------------------------------------------------------------ //

  function start() {
    ensureStyles('aibuddy-gmail-styles', BUTTON_STYLES + MODAL_STYLES);

    // Observe thread views to inject buttons
    gmail.observe.on('view_thread', () => {
      // Small delay to let Gmail render the toolbar
      setTimeout(injectButtons, 500);
    });

    // Also try on DOM mutations for SPA navigation
    const observer = new MutationObserver(() => {
      if (gmail.new.get.email_id()) {
        setTimeout(injectButtons, 300);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial attempt in case we loaded on an email page
    setTimeout(injectButtons, 1500);
  }

  // ------------------------------------------------------------------ //
  //  Bootstrap                                                          //
  // ------------------------------------------------------------------ //

  function waitForGmail() {
    if (globalThis._aibuddy_gmail) {
      gmail = globalThis._aibuddy_gmail;
      start();
      return true;
    }
    return false;
  }

  if (!waitForGmail()) {
    const interval = setInterval(() => {
      if (waitForGmail()) {
        clearInterval(interval);
      }
    }, 100);

    setTimeout(() => clearInterval(interval), 30_000);
  }
})();
