// badges.js
(function () {
  function qs(id) {
    return document.getElementById(id);
  }

  const badgesGrid = qs('badgesGrid');
  const badgesEmpty = qs('badgesEmpty');
  const btnRefresh = qs('badgesRefreshBtn');
  const badgesTab = qs('badgesTab');
  const badgesContent = qs('badges-content');
  const welcomePanel = qs('welcomePanel');
  const messagesEl = qs('messages');
  const composerEl = document.querySelector('.composer');

  function getEmail() {
    try {
      const u = (window.Auth && window.Auth.getUser) ? window.Auth.getUser() : null;
      if (u && u.email) return u.email;
    } catch (e) {}

    try {
      const stored = localStorage.getItem('g9_email');
      if (stored) return stored;
    } catch (e) {}

    return 'guest@student.com';
  }

  function badgeEmoji(key) {
    const k = String(key || '').toLowerCase();
    if (k.includes('streak')) return '🔥';
    if (k.includes('quiz')) return '🏆';
    if (k.includes('points')) return '⭐';
    if (k.includes('lessons')) return '📘';
    return '🎖️';
  }

  async function apiGet(path) {
    if (!window.Api || !window.Api.apiFetch) throw new Error('API_UNAVAILABLE');
    const res = await window.Api.apiFetch(path, { method: 'GET' });
    if (!res.ok) throw new Error('HTTP_' + res.status);
    return res.json();
  }

  function renderBadges(data) {
    if (!badgesGrid) return;

    const badges = (data && data.badges) ? data.badges : [];
    badgesGrid.innerHTML = '';

    if (!badges.length) {
      if (badgesEmpty) badgesEmpty.style.display = 'block';
      return;
    }

    if (badgesEmpty) badgesEmpty.style.display = 'none';

    badges.slice().reverse().forEach((bd) => {
      const card = document.createElement('div');
      card.className = 'gami-badge';

      const icon = document.createElement('div');
      icon.className = 'gami-badge-icon';
      icon.textContent = badgeEmoji(bd.key);

      const name = document.createElement('div');
      name.className = 'gami-badge-name';
      name.textContent = bd.name || bd.key || 'Badge';

      const desc = document.createElement('div');
      desc.className = 'gami-badge-desc';
      desc.textContent = bd.description || '';

      card.appendChild(icon);
      card.appendChild(name);
      card.appendChild(desc);
      badgesGrid.appendChild(card);
    });
  }

  async function refreshBadges() {
    try {
      const email = getEmail();
      const uid = (window.GoogleSync && window.GoogleSync.getUid) ? window.GoogleSync.getUid() : null;
      if(uid && window.GoogleSync && window.GoogleSync.loadGamification){
        const g = await window.GoogleSync.loadGamification(uid);
        renderBadges({ badges: (g && g.badges) ? g.badges : [] });
        return;
      }
      const payload = await apiGet('/gamification/get_badges?email=' + encodeURIComponent(email));
      renderBadges(payload && payload.data);
    } catch (e) {
      if (badgesGrid) badgesGrid.innerHTML = '';
      if (badgesEmpty) badgesEmpty.style.display = 'block';
    }
  }

  if (btnRefresh) btnRefresh.addEventListener('click', refreshBadges);

  // Fallback toggle handler (only if script.js failed to bind its handler)
  let prevState = null;
  function capturePrev(){
    return {
      welcomeDisplay: welcomePanel ? welcomePanel.style.display : '',
      messagesDisplay: messagesEl ? messagesEl.style.display : '',
      messagesScrollTop: messagesEl ? messagesEl.scrollTop : 0,
      composerDisplay: composerEl ? composerEl.style.display : ''
    };
  }
  function restorePrev(){
    if(!prevState){
      if(composerEl) composerEl.style.display = '';
      // best-effort: if there are messages show them, else show welcome
      if(messagesEl && messagesEl.children && messagesEl.children.length){
        if(welcomePanel) welcomePanel.style.display = 'none';
        messagesEl.style.display = 'flex';
      } else {
        if(welcomePanel) welcomePanel.style.display = 'flex';
        if(messagesEl) messagesEl.style.display = 'none';
      }
      return;
    }
    if(welcomePanel) welcomePanel.style.display = prevState.welcomeDisplay;
    if(messagesEl){
      messagesEl.style.display = prevState.messagesDisplay;
      try { messagesEl.scrollTop = prevState.messagesScrollTop; } catch(e) {}
    }
    if(composerEl) composerEl.style.display = prevState.composerDisplay || '';
    prevState = null;
  }
  function toggleBadges(){
    if(!badgesContent) return;
    const open = badgesContent.style.display === 'block' || badgesContent.style.display === 'flex';
    if(open){
      badgesContent.style.display = 'none';
      if(badgesTab) badgesTab.classList.remove('active');
      restorePrev();
      return;
    }
    prevState = capturePrev();
    badgesContent.style.display = 'flex';
    if(badgesTab) badgesTab.classList.add('active');
    if(welcomePanel) welcomePanel.style.display = 'none';
    if(messagesEl) messagesEl.style.display = 'none';
    if(composerEl) composerEl.style.display = 'none';
    refreshBadges();
  }

  window.addEventListener('DOMContentLoaded', () => {
    // Bind fallback toggle only after the main UI script had a chance to bind.
    try {
      if(badgesTab && !window.__g9_badges_handler_bound){
        badgesTab.addEventListener('click', toggleBadges);
      }
    } catch (e) {
      try { if(badgesTab) badgesTab.addEventListener('click', toggleBadges); } catch (e2) {}
    }
    refreshBadges();
  });

  window.BadgesUI = { refresh: refreshBadges };
})();
