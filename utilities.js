import { callChatAPI } from './api.js';

export async function showAIOverlay(tabId, text, isLoading = false) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['marked.min.js']
    });
  } catch (error) {
    console.warn('Failed to inject marked library:', error);
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (responseText, isLoading) => {
      let overlay = document.querySelector('#ai-overlay');
      let container, closeButton, contentDiv;

      if (overlay) {
        container = overlay.querySelector('div');
        closeButton = container.querySelector('button');
      } else {
        // Create overlay
        overlay = document.createElement('div');
        overlay.id = 'ai-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        overlay.style.zIndex = '2147483647';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';

        // Content container
        container = document.createElement('div');
        container.style.backgroundColor = '#333';
        container.style.color = '#fff';
        container.style.padding = '20px';
        container.style.borderRadius = '8px';
        container.style.width = '90vw';
        container.style.height = '90vh';
        container.style.maxWidth = '90vw';
        container.style.maxHeight = '90vh';
        container.style.overflow = 'auto';
        container.style.position = 'relative';
        container.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
        container.style.minHeight = '100px'; // Ensure some height

        // Close button
        closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '10px';
        closeButton.style.right = '10px';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.color = '#fff';
        closeButton.style.fontSize = '24px';
        closeButton.style.cursor = 'pointer';
        closeButton.addEventListener('click', () => {
          if (overlay.escapeHandler) {
            document.removeEventListener('keydown', overlay.escapeHandler);
            delete overlay.escapeHandler;
          }
          overlay.remove();
        });

         overlay.append(container);
         document.body.append(overlay);
         overlay.tabIndex = -1;
         overlay.focus();

        // Close on overlay click
          overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
              if (overlay.escapeHandler) {
                document.removeEventListener('keydown', overlay.escapeHandler);
                delete overlay.escapeHandler;
              }
              overlay.remove();
            }
          });
       }

       overlay.focus();
       if (!overlay.escapeHandler) {
         overlay.escapeHandler = (event) => {
           if (event.key === 'Escape') {
             if (overlay.escapeHandler) {
               document.removeEventListener('keydown', overlay.escapeHandler);
               delete overlay.escapeHandler;
             }
             overlay.remove();
           }
         };
         document.addEventListener('keydown', overlay.escapeHandler);
       }

       // Clear existing content except close button
            for (let child = container.firstChild; child; ) {
         if (child === closeButton) {
           break;
         } else {
           const next = child.nextSibling;
           child.remove();
           child = next;
         }
       }

       // Add content
       contentDiv = document.createElement('div');
       if (isLoading) {
         const spinner = document.createElement('div');
         spinner.style.position = 'absolute';
         spinner.style.top = '50%';
         spinner.style.left = '50%';
         spinner.style.marginTop = '-40px';
         spinner.style.marginLeft = '-40px';
         spinner.style.display = 'flex';
         spinner.style.flexDirection = 'column';
         spinner.style.alignItems = 'center';

         const spinnerCircle = document.createElement('div');
         spinnerCircle.style.display = 'inline-block';
         spinnerCircle.style.width = '40px';
         spinnerCircle.style.height = '40px';
         spinnerCircle.style.border = '4px solid #f3f3f3';
         spinnerCircle.style.borderTop = '4px solid #3498db';
         spinnerCircle.style.borderRadius = '50%';

         const loadingText = document.createElement('div');
         loadingText.textContent = 'Loading...';
         loadingText.style.marginTop = '10px';
         loadingText.style.color = '#fff';

          spinner.append(spinnerCircle, loadingText);
          contentDiv.append(spinner);

          // Animate spinner with JavaScript
          let rotation = 0;
          const animateSpinner = () => {
            rotation += 6;
            spinnerCircle.style.transform = `rotate(${rotation}deg)`;
            requestAnimationFrame(animateSpinner);
          };
          animateSpinner();
      } else {
        if (typeof marked !== 'undefined') {
          contentDiv.innerHTML = marked.parse(responseText);
          // Add markdown styles
          const style = document.createElement('style');
          style.textContent = `
            #ai-overlay strong {
              font-weight: 700;
            }
            #ai-overlay em {
              font-style: italic;
            }
            #ai-overlay blockquote {
              border-left: 4px solid rgba(255, 255, 255, 0.5);
              padding-left: 12px;
              margin: 12px 0;
              font-style: italic;
              opacity: 0.9;
            }
            #ai-overlay code {
              background: rgba(0, 0, 0, 0.3);
              padding: 2px 6px;
              border-radius: 4px;
              font-family: 'Courier New', monospace;
              font-size: 0.9em;
            }
            #ai-overlay pre {
              background: rgba(0, 0, 0, 0.4);
              padding: 12px;
              border-radius: 8px;
              overflow-x: auto;
              margin: 12px 0;
            }
            #ai-overlay pre code {
              background: none;
              padding: 0;
            }
            #ai-overlay h1, #ai-overlay h2, #ai-overlay h3, #ai-overlay h4, #ai-overlay h5, #ai-overlay h6 {
              margin: 12px 0 8px 0;
              font-weight: 600;
            }
            #ai-overlay h1 { font-size: 1.5em; }
            #ai-overlay h2 { font-size: 1.3em; }
            #ai-overlay h3 { font-size: 1.1em; }
            #ai-overlay h4 { font-size: 1em; }
            #ai-overlay p {
              margin: 8px 0;
            }
            #ai-overlay ul, #ai-overlay ol {
              margin: 8px 0;
              padding-left: 20px;
            }
            #ai-overlay li {
              margin: 4px 0;
            }
            #ai-overlay a {
              color: #8ab4f8;
              text-decoration: underline;
            }
            #ai-overlay table {
              border-collapse: collapse;
              width: 100%;
              margin: 12px 0;
            }
            #ai-overlay th, #ai-overlay td {
              border: 1px solid rgba(255, 255, 255, 0.3);
              padding: 8px 12px;
              text-align: left;
            }
            #ai-overlay th {
              background: rgba(0, 0, 0, 0.2);
              font-weight: 600;
            }
            #ai-overlay hr {
              border: none;
              border-top: 1px solid rgba(255, 255, 255, 0.3);
              margin: 16px 0;
            }
          `;
          overlay.appendChild(style);
        } else {
          contentDiv.style.whiteSpace = 'pre-wrap';
          contentDiv.textContent = responseText;
        }
      }

      container.append(contentDiv);
    },
    args: [text, isLoading]
  });
}

export async function isSelectionEditable(tabId) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // First check if there's an active element that's editable
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.isContentEditable ||
            ((activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') &&
             !activeElement.readOnly && !activeElement.disabled))) {
          return true;
        }

        // Fallback to selection-based detection
        const selection = globalThis.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const commonAncestor = range.commonAncestorContainer;

          if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
            if (commonAncestor && (commonAncestor.isContentEditable || (commonAncestor.tagName === 'INPUT' || commonAncestor.tagName === 'TEXTAREA') && !commonAncestor.readOnly && !commonAncestor.disabled)) {
              return true;
            }
          } else if (commonAncestor.nodeType === Node.TEXT_NODE && commonAncestor.parentElement) {
            if (commonAncestor.parentElement.isContentEditable || (commonAncestor.parentElement.tagName === 'INPUT' || commonAncestor.parentElement.tagName === 'TEXTAREA') && !commonAncestor.parentElement.readOnly && !commonAncestor.parentElement.disabled) {
              return true;
            }
          }
        }
        return false;
      }
    });
    return result[0]?.result || false;
  } catch (error) {
    console.error('Error checking if selection is editable:', error);
    return false;
  }
}

export async function handleFixGrammar(tabId, selectionText) {
  try {
    // Set cursor to wait before starting
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => { document.body.style.cursor = 'wait'; }
    });

    const settings = await chrome.storage.sync.get([
      'sidepanelProvider',
      'openaiApiKey',
      'sidepanelModel',
      'sidepanelOpenrouterApiKey',
      'sidepanelOpenrouterModel'
    ]);

    console.log('Fix Grammar settings:', settings);
    console.log('Selected text length:', selectionText.length);

    const { sidepanelProvider } = settings;
    let correctedText;

    // Limit selected text to prevent token limit issues
    const limitedText = selectionText.slice(0, 1000);
    if (selectionText.length > 1000) {
      console.log('Selected text truncated to 1000 characters');
    }

    const prompt = `Fix the grammar and syntax of the following text so it is proper, respectful, and understandable by a third party. Keep it in the original language and formatting. Just return the corrected text and nothing else : ${limitedText}`;

    // Check if selection is editable
    const editable = await isSelectionEditable(tabId);

    if (sidepanelProvider === 'openai') {
      const { openaiApiKey, sidepanelModel } = settings;
      if (!openaiApiKey || !sidepanelModel) {
        console.log('Missing OpenAI settings, opening options page');
        chrome.runtime.openOptionsPage();
        return;
      }
      if (!editable) {
        // Show loading overlay only if not editable
        showAIOverlay(tabId, '', true);
      }
      correctedText = await callChatAPI('openai', openaiApiKey, sidepanelModel, prompt);
    } else {
      const { sidepanelOpenrouterApiKey, sidepanelOpenrouterModel } = settings;
      if (!sidepanelOpenrouterApiKey || !sidepanelOpenrouterModel) {
        console.log('Missing OpenRouter settings, opening options page');
        chrome.runtime.openOptionsPage();
        return;
      }
      if (!editable) {
        // Show loading overlay only if not editable
        showAIOverlay(tabId, '', true);
      }
      correctedText = await callChatAPI('openrouter', sidepanelOpenrouterApiKey, sidepanelOpenrouterModel, prompt);
    }

    if (editable) {
      // Directly replace text without overlay
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (corrected) => {
          const selection = globalThis.getSelection();
          let editableElement;

          // First try to get editable element from active element
          const activeElement = document.activeElement;
          if (activeElement && (activeElement.isContentEditable ||
              ((activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') &&
               !activeElement.readOnly && !activeElement.disabled))) {
            editableElement = activeElement;
          } else if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const commonAncestor = range.commonAncestorContainer;

            if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
              if (commonAncestor && (commonAncestor.isContentEditable || (commonAncestor.tagName === 'INPUT' || commonAncestor.tagName === 'TEXTAREA') && !commonAncestor.readOnly && !commonAncestor.disabled)) {
                editableElement = commonAncestor;
              }
            } else if (commonAncestor.nodeType === Node.TEXT_NODE && commonAncestor.parentElement && (commonAncestor.parentElement.isContentEditable || (commonAncestor.parentElement.tagName === 'INPUT' || commonAncestor.parentElement.tagName === 'TEXTAREA') && !commonAncestor.parentElement.readOnly && !commonAncestor.parentElement.disabled)) {
              editableElement = commonAncestor.parentElement;
            }
          }

          if (editableElement) {
            const start = editableElement.selectionStart;
            const end = editableElement.selectionEnd;
            if (typeof start === 'number' && typeof end === 'number') {
              // Use setRangeText to preserve undo functionality
              editableElement.setRangeText(corrected, start, end, 'select');
            } else {
              // Fallback: replace selection with document.execCommand
              document.execCommand('insertText', false, corrected);
            }
          }
        },
        args: [correctedText]
      });
    } else {
      // Inject marked library and update overlay with corrected text
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['marked.min.js']
        });
      } catch (error) {
        console.warn('Failed to inject marked library:', error);
      }

      await chrome.scripting.executeScript({
        target: { tabId },
        func: (corrected) => {
          const overlay = document.querySelector('#ai-overlay');
          if (overlay) {
            overlay.focus();
            const container = overlay.querySelector('div');
            const closeButton = container.querySelector('button');
            // Clear existing content except close button
            for (let child = container.firstChild; child; ) {
              if (child === closeButton) {
                break;
              } else {
                const next = child.nextSibling;
                child.remove();
                child = next;
              }
            }
            // Add response content
            const contentDiv = document.createElement('div');
            if (typeof marked !== 'undefined') {
              contentDiv.innerHTML = marked.parse(corrected);
              // Add markdown styles if not already present
              if (!overlay.querySelector('style[data-markdown-styles]')) {
                const style = document.createElement('style');
                style.setAttribute('data-markdown-styles', 'true');
                style.textContent = `
                  #ai-overlay strong {
                    font-weight: 700;
                  }
                  #ai-overlay em {
                    font-style: italic;
                  }
                  #ai-overlay blockquote {
                    border-left: 4px solid rgba(255, 255, 255, 0.5);
                    padding-left: 12px;
                    margin: 12px 0;
                    font-style: italic;
                    opacity: 0.9;
                  }
                  #ai-overlay code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: 'Courier New', monospace;
                    font-size: 0.9em;
                  }
                  #ai-overlay pre {
                    background: rgba(0, 0, 0, 0.4);
                    padding: 12px;
                    border-radius: 8px;
                    overflow-x: auto;
                    margin: 12px 0;
                  }
                  #ai-overlay pre code {
                    background: none;
                    padding: 0;
                  }
                  #ai-overlay h1, #ai-overlay h2, #ai-overlay h3, #ai-overlay h4, #ai-overlay h5, #ai-overlay h6 {
                    margin: 12px 0 8px 0;
                    font-weight: 600;
                  }
                  #ai-overlay h1 { font-size: 1.5em; }
                  #ai-overlay h2 { font-size: 1.3em; }
                  #ai-overlay h3 { font-size: 1.1em; }
                  #ai-overlay h4 { font-size: 1em; }
                  #ai-overlay p {
                    margin: 8px 0;
                  }
                  #ai-overlay ul, #ai-overlay ol {
                    margin: 8px 0;
                    padding-left: 20px;
                  }
                  #ai-overlay li {
                    margin: 4px 0;
                  }
                  #ai-overlay a {
                    color: #8ab4f8;
                    text-decoration: underline;
                  }
                  #ai-overlay table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 12px 0;
                  }
                  #ai-overlay th, #ai-overlay td {
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    padding: 8px 12px;
                    text-align: left;
                  }
                  #ai-overlay th {
                    background: rgba(0, 0, 0, 0.2);
                    font-weight: 600;
                  }
                  #ai-overlay hr {
                    border: none;
                    border-top: 1px solid rgba(255, 255, 255, 0.3);
                    margin: 16px 0;
                  }
                `;
                overlay.appendChild(style);
              }
            } else {
              contentDiv.style.whiteSpace = 'pre-wrap';
              contentDiv.textContent = corrected;
            }
            container.append(contentDiv);
          }
        },
        args: [correctedText]
      });
    }
  } catch (error) {
    console.error('Error fixing grammar:', error);
    chrome.runtime.openOptionsPage();
  } finally {
    // Always reset cursor to default
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => { document.body.style.cursor = 'default'; }
    });
  }
}