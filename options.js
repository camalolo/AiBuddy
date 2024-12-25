// Voice descriptions
const voiceDescriptions = {
    alloy: "A neutral voice suitable for general use",
    echo: "A deep and resonant voice",
    fable: "A soft and gentle voice",
    onyx: "A professional and authoritative voice",
    nova: "A warm and welcoming voice",
    shimmer: "A clear and bright voice"
  };
  
  // Update voice description when selection changes
  document.getElementById('voice').addEventListener('change', (e) => {
    const description = voiceDescriptions[e.target.value];
    document.getElementById('voiceDescription').textContent = description;
  });
  
  // Saves options to chrome.storage
  function saveOptions() {
    const apiKey = document.getElementById('apiKey').value;
    const voice = document.getElementById('voice').value;
    
    chrome.storage.sync.set(
      {
        openaiApiKey: apiKey,
        selectedVoice: voice
      },
      () => {
        // Update status to let user know options were saved.
        const status = document.getElementById('status');
        status.textContent = 'Settings saved.';
        setTimeout(() => {
          status.textContent = '';
        }, 2000);
      }
    );
  }
  
  // Restores select box and checkbox state using the preferences
  // stored in chrome.storage.
  function restoreOptions() {
    chrome.storage.sync.get(
      {
        openaiApiKey: '', // default value
        selectedVoice: 'alloy' // default value
      },
      (items) => {
        document.getElementById('apiKey').value = items.openaiApiKey;
        document.getElementById('voice').value = items.selectedVoice;
        // Update description for restored voice
        const description = voiceDescriptions[items.selectedVoice];
        document.getElementById('voiceDescription').textContent = description;
      }
    );
  }
  
  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.getElementById('save').addEventListener('click', saveOptions);