// Voice descriptions
const voiceDescriptions = {
    alloy: "A neutral voice suitable for general use",
    echo: "A deep and resonant voice",
    fable: "A soft and gentle voice",
    onyx: "A professional and authoritative voice",
    nova: "A warm and welcoming voice",
    shimmer: "A clear and bright voice"
  };

// Fetch available models from OpenAI API
async function fetchModels(apiKey) {
  const modelSelect = document.getElementById('model');
  const modelStatus = document.getElementById('modelStatus');

  if (!apiKey) {
    modelSelect.innerHTML = '<option value="">Enter API key first</option>';
    modelStatus.textContent = '';
    return false;
  }

  modelStatus.textContent = 'Loading models...';
  modelStatus.style.color = '#666';

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data
      .filter(model => model.id.startsWith('gpt-'))
      .sort((a, b) => a.id.localeCompare(b.id));

    modelSelect.innerHTML = '<option value="">Select a model...</option>';
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.id;
      modelSelect.appendChild(option);
    });

    modelStatus.textContent = `Loaded ${models.length} models`;
    modelStatus.style.color = '#16a34a';
    return true;
  } catch (error) {
    console.error('Error fetching models:', error);
    modelSelect.innerHTML = '<option value="">Failed to load models</option>';
    modelStatus.textContent = 'Invalid API key or network error';
    modelStatus.style.color = '#dc2626';
    return false;
  }
}
  
  // Update voice description when selection changes
  document.getElementById('voice').addEventListener('change', (e) => {
    const description = voiceDescriptions[e.target.value];
    document.getElementById('voiceDescription').textContent = description;
  });
  
  // Saves options to chrome.storage
  async function saveOptions() {
    const apiKey = document.getElementById('apiKey').value;
    const model = document.getElementById('model').value;
    const voice = document.getElementById('voice').value;
    const status = document.getElementById('status');
  
    if (!apiKey) {
      status.textContent = 'Please enter an API key.';
      status.style.color = '#dc2626';
      setTimeout(() => {
        status.textContent = '';
        status.style.color = '';
      }, 3000);
      return;
    }
  
    if (!model) {
      status.textContent = 'Please select a model.';
      status.style.color = '#dc2626';
      setTimeout(() => {
        status.textContent = '';
        status.style.color = '';
      }, 3000);
      return;
    }
  
    // Validate API key and model by fetching models
    status.textContent = 'Validating...';
    const isValid = await fetchModels(apiKey);
    if (!isValid) {
      status.textContent = 'Validation failed. Check your API key.';
      status.style.color = '#dc2626';
      setTimeout(() => {
        status.textContent = '';
        status.style.color = '';
      }, 3000);
      return;
    }
  
    // Re-select the model after validation (since fetchModels clears the dropdown)
    document.getElementById('model').value = model;
  
    chrome.storage.sync.set(
      {
        openaiApiKey: apiKey,
        selectedModel: model,
        selectedVoice: voice
      },
      () => {
        // Update status to let user know options were saved.
        status.textContent = 'Settings saved.';
        status.style.color = '#16a34a';
        setTimeout(() => {
          status.textContent = '';
          status.style.color = '';
        }, 2000);
      }
    );
  }
  
  // Restores select box and checkbox state using the preferences
  // stored in chrome.storage.
  async function restoreOptions() {
    chrome.storage.sync.get(
      {
        openaiApiKey: '', // default value
        selectedModel: '', // default value
        selectedVoice: 'alloy' // default value
      },
      async (items) => {
        document.getElementById('apiKey').value = items.openaiApiKey;
        document.getElementById('model').value = items.selectedModel;
        document.getElementById('voice').value = items.selectedVoice;
        // Update description for restored voice
        const description = voiceDescriptions[items.selectedVoice];
        document.getElementById('voiceDescription').textContent = description;
  
        // Fetch models if API key exists
        if (items.openaiApiKey) {
          await fetchModels(items.openaiApiKey);
          document.getElementById('model').value = items.selectedModel;
        }
      }
    );
  }
  
  // Fetch models when API key changes
  document.getElementById('apiKey').addEventListener('input', async (e) => {
    const apiKey = e.target.value.trim();
    if (apiKey) {
      await fetchModels(apiKey);
    } else {
      document.getElementById('model').innerHTML = '<option value="">Enter API key first</option>';
      document.getElementById('modelStatus').textContent = '';
    }
  });
  
  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.getElementById('save').addEventListener('click', saveOptions);