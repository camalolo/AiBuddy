import { callChatAPI, getSettings, providerConfigs } from './api.js';
import { tools, executeTool } from './tools.js';

const SYSTEM_MESSAGE = {
  role: 'system',
  content: 'You are a helpful assistant running in a Chrome extension sidepanel. You have access to tools that allow you to interact with the current web page: get_page_contents (to extract page information and find interactive elements), click_element (to click elements using CSS selectors), and send_text (to input text into elements using CSS selectors). When interacting with a web page, always start by using get_page_contents to discover available elements and construct appropriate CSS selectors (e.g. ".class", "[attribute]", "#id") before attempting to click or send text. Always provide valid JSON arguments for tool calls.'
};

export function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'chat') {
      handleChat(request.messages, sender).then(reply => sendResponse({ reply })).catch(error => sendResponse({ error: error.message }));
      return true; // Keep channel open
    }
    if (request.action === 'validate_api') {
      (async () => {
        try {
          await callChatAPI(request.provider, request.apiKey, request.model, "Hello");
          sendResponse({ valid: true });
        } catch (error) {
          sendResponse({ valid: false, error: error.message });
        }
      })();
      return true; // Keep channel open
    }
  });
}

export async function handleChat(messages, sender) {
  const settings = await getSettings();
  const { sidepanelProvider } = settings;

  const config = providerConfigs[sidepanelProvider];
  if (!config) throw new Error('No AI provider configured. Please configure in options.');

  const apiKey = settings[config.apiKeyField];
  const model = settings[config.modelField];
  if (!apiKey || !model) throw new Error(`${config.name} API key or model not set. Please configure in options.`);

  const apiHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(config.url, {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify({
      model: model,
      messages: [SYSTEM_MESSAGE, ...messages],
      tools: tools,
      tool_choice: 'auto'
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `${config.name} API error`);

  const assistantMessage = data.choices[0].message;
  if (assistantMessage.tool_calls) {
    const toolResults = await Promise.all(assistantMessage.tool_calls.map(call => executeTool(call, sender)));
    // Follow-up call with tool results
    const followUpResponse = await fetch(config.url, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        model: model,
        messages: [
          ...messages,
          assistantMessage,
          ...toolResults.map(r => ({ role: 'tool', tool_call_id: r.tool_call_id, content: r.content }))
        ]
      })
    });
    const followUpData = await followUpResponse.json();
    if (!followUpResponse.ok) throw new Error(followUpData.error?.message || `${config.name} API error`);
    return followUpData.choices[0].message.content;
  } else {
    return assistantMessage.content;
  }
}