export const providerConfigs = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    errorPrefix: 'OpenAI API error:',
    apiKeyField: 'openaiApiKey',
    modelField: 'sidepanelModel',
    name: 'OpenAI'
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    errorPrefix: 'OpenRouter API error:',
    apiKeyField: 'sidepanelOpenrouterApiKey',
    modelField: 'sidepanelOpenrouterModel',
    name: 'OpenRouter'
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    errorPrefix: 'DeepSeek API error:',
    apiKeyField: 'sidepanelDeepseekApiKey',
    modelField: 'sidepanelDeepseekModel',
    name: 'DeepSeek'
  }
};

export async function getSettings() {
  return await chrome.storage.sync.get([
    'sidepanelProvider',
    'openaiApiKey',
    'sidepanelModel',
    'sidepanelOpenrouterApiKey',
    'sidepanelOpenrouterModel',
    'sidepanelDeepseekApiKey',
    'sidepanelDeepseekModel',
    'tavilyApiKey',
    'tinyfishApiKey'
  ]);
}

export async function callChatAPI(provider, apiKey, model, prompt) {
  let config;
  if (provider === 'openai') {
    config = providerConfigs.openai;
  } else if (provider === 'openrouter') {
    config = providerConfigs.openrouter;
  } else if (provider === 'deepseek') {
    config = providerConfigs.deepseek;
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${config.errorPrefix} ${response.status} ${errorText}`);
  }
  const data = await response.json();
  return data.choices[0].message.content.trim();
}

export async function tavilySearch(query, apiKey) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: false
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  return data.results.map(r => `[${r.title}](${r.url})\n${r.content}`).join('\n\n');
}

export async function tinyfishSearch(query, apiKey) {
  const url = `https://api.search.tinyfish.ai?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey
    }
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TinyFish API error: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  return data.results.map(r => `[${r.title}](${r.url})\n${r.snippet}`).join('\n\n');
}