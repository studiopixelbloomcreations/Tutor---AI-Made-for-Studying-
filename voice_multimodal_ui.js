// voice_multimodal_ui.js
(function () {
  try { window.__g9_voice_backend_enabled = true; } catch (e) {}

  function qs(id) {
    return document.getElementById(id);
  }

  const micBtn = qs('micBtn');
  const speakerBtn = qs('speakerBtn');
  const inputBox = qs('inputBox');
  const sendBtn = qs('sendBtn');
  const messagesEl = qs('messages');

  function appendBubble(role, text) {
    if (!messagesEl) return;
    const el = document.createElement('div');
    el.className = 'msg ' + (role === 'user' ? 'user' : 'ai') + ' show';
    el.textContent = text;
    messagesEl.appendChild(el);
    try {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (e) {}
  }

  function toast(msg) {
    try {
      const toasts = document.getElementById('toasts');
      if (!toasts) return;
      const d = document.createElement('div');
      d.className = 'toast';
      d.textContent = msg;
      toasts.appendChild(d);
      setTimeout(() => {
        d.style.opacity = '0';
        d.style.transform = 'translateY(10px)';
        setTimeout(() => d.remove(), 300);
      }, 4200);
    } catch (e) {}
  }

  async function apiFetch(path, options) {
    if (!window.Api || !window.Api.apiFetch) throw new Error('API_UNAVAILABLE');
    return window.Api.apiFetch(path, options);
  }

  // --------------------
  // Voice: STT recording
  // --------------------
  let recorder = null;
  let chunks = [];
  let recording = false;

  async function startRecording() {
    if (recording) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Microphone recording not supported');
      return;
    }

    const host = String(location.hostname || '').toLowerCase();
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (!window.isSecureContext && !isLocal) {
      toast('Mic requires HTTPS or localhost');
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    recorder = new MediaRecorder(stream);

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size) chunks.push(ev.data);
    };

    recorder.onstop = async () => {
      try {
        recording = false;
        micBtn && micBtn.classList.remove('recording');
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });

        const fd = new FormData();
        fd.append('audio', blob, 'speech.webm');

        const res = await apiFetch('/voice/recognize?language=en-US', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('HTTP_' + res.status);
        const data = await res.json();

        const text = (data && data.text) ? String(data.text) : '';
        if (!text.trim()) {
          toast('No speech detected');
          return;
        }

        if (inputBox) {
          inputBox.value = text;
          inputBox.focus();
          try { inputBox.dispatchEvent(new Event('input')); } catch (e) {}
        }
      } catch (e) {
        toast('Voice server not responding (STT).');
      } finally {
        try {
          const tracks = stream.getTracks();
          tracks.forEach(t => t.stop());
        } catch (e) {}
      }
    };

    recording = true;
    micBtn && micBtn.classList.add('recording');
    recorder.start();

    // Auto-stop after 8 seconds to keep UX simple
    setTimeout(() => {
      try {
        if (recorder && recording) recorder.stop();
      } catch (e) {}
    }, 8000);
  }

  function stopRecording() {
    try {
      if (recorder && recording) recorder.stop();
    } catch (e) {}
  }

  if (micBtn) {
    micBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (recording) stopRecording();
      else {
        try {
          await startRecording();
        } catch (err) {
          toast('Mic permission denied');
        }
      }
    });
  }

  // --------------------
  // Voice: TTS playback
  // --------------------
  let lastAudio = null;

  function getLastAiText() {
    if (!messagesEl) return '';
    const nodes = messagesEl.querySelectorAll('.msg.ai');
    if (!nodes.length) return '';
    return (nodes[nodes.length - 1].textContent || '').trim();
  }

  async function speakText(text) {
    const raw = String(text || '').trim();
    const cleaned = raw.replace(/\n?\s*AWARD_POINTS\s*:\s*\d+\s*$/i, '').trim();

    // Try backend TTS first (available only on the Python server)
    try {
      const payload = { text: cleaned };
      const res = await apiFetch('/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('HTTP_' + res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (lastAudio) {
        try { lastAudio.pause(); } catch (e) {}
        try { URL.revokeObjectURL(lastAudio.__url); } catch (e) {}
      }

      const audio = new Audio(url);
      audio.__url = url;
      lastAudio = audio;
      await audio.play();
      return;
    } catch (e) {
      // fall through to browser TTS
    }

    // Fallback: browser SpeechSynthesis (works on Netlify)
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      throw new Error('NO_TTS');
    }

    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.rate = 1.02;
    utter.pitch = 1.15;
    utter.volume = 1;

    // Prefer a friendly female English voice if available
    try {
      const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
      const pick = (voices || []).find(v => /female|woman|zira|susan|samantha|english/i.test(String(v.name || '')));
      if (pick) utter.voice = pick;
    } catch (e) {}

    await new Promise((resolve, reject) => {
      utter.onend = () => resolve();
      utter.onerror = (ev) => reject(ev && ev.error ? ev.error : new Error('TTS_FAILED'));
      window.speechSynthesis.speak(utter);
    });
  }

  if (speakerBtn) {
    speakerBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const text = getLastAiText();
      if (!text) {
        toast('No AI message to read yet');
        return;
      }
      try {
        await speakText(text);
      } catch (err) {
        toast('Text-to-speech not available on this device/browser.');
      }
    });
  }

  // Image OCR is handled by upload.js (to avoid duplicate bindings)
})();
