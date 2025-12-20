// api.js
(function(){
  const LOCAL_DEFAULT_BASE = 'http://127.0.0.1:8000';

  function inferBaseUrl(){
    // Allow explicit override
    if(window.__API_BASE_URL__) return window.__API_BASE_URL__;

    // Allow runtime configuration without code changes
    try {
      const stored = localStorage.getItem('g9_api_base');
      if(stored) return stored;
    } catch (e) {}

    const host = window.location.hostname;

    const meta = document.querySelector('meta[name="api-base-url"]');
    if(meta && meta.content){
      // If the meta is still pointing at the old local default, ignore it and prefer same-origin.
      if(meta.content !== LOCAL_DEFAULT_BASE) return meta.content;
    }

    // If opened from file://, we must use a concrete server URL
    if(window.location.protocol === 'file:') return LOCAL_DEFAULT_BASE;

    // If served over HTTPS (Netlify/Vercel/Replit/etc), avoid mixed-content by using same-origin
    if(window.location.protocol === 'https:') return window.location.origin;

    // If served from a localhost dev server (or the API itself), use same-origin
    if(host === 'localhost' || host === '127.0.0.1'){
      // Prefer same-origin so it works regardless of which port the backend is using (e.g. 5000)
      return window.location.origin;
    }

    // Default: same origin
    return window.location.origin;
  }

  function getBaseUrl(){
    return inferBaseUrl();
  }

  async function apiFetch(path, options){
    const url = getBaseUrl() + path;
    try {
      const res = await fetch(url, options);
      return res;
    } catch (e) {
      const err = new Error('NETWORK_ERROR');
      err.cause = e;
      throw err;
    }
  }

  window.Api = {
    getBaseUrl,
    apiFetch
  };
})();
