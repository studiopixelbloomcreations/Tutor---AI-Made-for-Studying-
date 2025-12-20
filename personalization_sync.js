// personalization_sync.js
// Bridges existing point-award events to the new /user/save_progress endpoint.
(function(){
  function toast(msg){
    try { if(window.AppToast) return window.AppToast(msg, {duration: 4000}); } catch (e) {}
  }

  function getEmail(){
    try {
      const u = (window.Auth && window.Auth.getUser) ? window.Auth.getUser() : null;
      if(u && u.email) return u.email;
    } catch (e) {}
    try {
      const stored = localStorage.getItem('g9_email');
      if(stored) return stored;
    } catch (e) {}
    return 'guest@student.com';
  }

  function getLanguage(){
    try { return localStorage.getItem('g9_language') || 'English'; } catch (e) {}
    return 'English';
  }

  function getTopic(){
    // Use the current subject dropdown as the best available proxy for "topic".
    try {
      const dd = document.getElementById('subjectDropdown');
      if(dd && dd.value) return dd.value;
    } catch (e) {}
    return 'General';
  }

  async function saveAttempt(opts){
    if(!window.Api || !window.Api.apiFetch) return;

    const payload = {
      email: getEmail(),
      topic: opts.topic || getTopic(),
      correct: !!opts.correct,
      score: Number.isFinite(opts.score) ? opts.score : 0,
      question: (opts.question || '').slice(0, 500),
      profile: {
        preferred_language: getLanguage()
      }
    };

    const res = await window.Api.apiFetch('/user/save_progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // If the router isn't included yet, this will likely be 404.
    if(!res.ok) throw new Error('HTTP_' + res.status);
    return res.json();
  }

  // Listen for awarded points events.
  window.addEventListener('g9:marks_updated', async (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const reason = d.reason || '';
    const points = parseInt(d.points || 0, 10);

    // We only treat awards as "correct" attempts.
    // This gives us a simple performance signal that is already available in the app.
    if(points <= 0) return;

    const subject = getTopic();
    const question = reason === 'quiz_correct' ? 'Quiz correct' : 'AI awarded points';

    try {
      await saveAttempt({
        topic: subject,
        correct: true,
        score: points,
        question
      });
    } catch (e) {
      // Silent fallback; profile page will show a hint if server personalization isn't active.
    }
  });

  // Also save a baseline profile on load (best-effort).
  window.addEventListener('DOMContentLoaded', ()=>{
    try {
      if(window.Api && window.Api.apiFetch){
        window.Api.apiFetch('/user/set_profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: getEmail(), preferred_language: getLanguage() })
        }).catch(()=>{});
      }
    } catch (e) {}
  });

  window.PersonalizationSync = {
    saveAttempt
  };
})();
