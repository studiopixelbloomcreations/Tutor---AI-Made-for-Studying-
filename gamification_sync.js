// gamification_sync.js
// Bridges existing point-award events to backend gamification endpoints.
(function(){
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

  function getSubject(){
    try {
      const dd = document.getElementById('subjectDropdown');
      if(dd && dd.value) return dd.value;
    } catch (e) {}
    return 'General';
  }

  async function addPoints(points, reason){
    if(!window.Api || !window.Api.apiFetch) return;
    const payload = {
      email: getEmail(),
      points: parseInt(points || 0, 10) || 0,
      reason: reason || null,
      subject: getSubject()
    };
    const res = await window.Api.apiFetch('/gamification/add_points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('HTTP_' + res.status);
    return res.json();
  }

  window.addEventListener('g9:marks_updated', async (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const points = parseInt(d.points || 0, 10) || 0;
    if(points <= 0) return;
    try {
      await addPoints(points, d.reason || 'ai_award');
    } catch (e) {
      // Silent failure: UI can still show local points/streak.
    }
  });

  window.GamificationSync = { addPoints };
})();
