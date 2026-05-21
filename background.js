import { setupContextMenus, handleMenuClick } from './context-menus.js';
import { setupMessageListeners, handleGmailAiMessage } from './messaging.js';

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
});

// Handle commands
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-side-panel') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.sidePanel.open({ tabId: tabs[0].id });
        // Store the tabId for the side panel
        chrome.storage.session.set({ sidePanelTabId: tabs[0].id });
      }
    });
  }
});

// Setup message listeners
setupMessageListeners();

// Setup context menu click listener
chrome.contextMenus.onClicked.addListener(handleMenuClick);

// Handle Gmail AI messages (from content script relay)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'gmail_ai') {
    handleGmailAiMessage(request.gmailAction, request.payload)
      .then((reply) => sendResponse({ reply }))
      .catch((error) => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }
});
