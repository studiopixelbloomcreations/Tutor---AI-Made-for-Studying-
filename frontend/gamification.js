// gamification.js
(function(){
  function qs(id){ return document.getElementById(id); }

  const elPoints = qs('gamiPoints');
  const elStreak = qs('gamiStreak');
  const elLabel = qs('gamiProgressLabel');
  const elFill = qs('gamiProgressFill');
  const elBadges = qs('gamiBadges');
  const elLeaderboard = qs('gamiLeaderboard');
  const btnRefresh = qs('gamiRefreshBtn');

  function toast(msg){
    try { if(window.AppToast) return window.AppToast(msg, {duration: 4500}); } catch (e) {}
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

  function setText(el, txt){ if(el) el.textContent = txt; }

  function nextMilestone(points){
    const p = parseInt(points || 0, 10) || 0;
    if(p < 100) return 100;
    if(p < 500) return 500;
    if(p < 1500) return 1500;
    return Math.ceil(p / 500) * 500;
  }

  function maskEmail(email){
    const e = String(email || '');
    if(!e.includes('@')) return e;
    const parts = e.split('@');
    const name = parts[0];
    const domain = parts[1];
    const safe = name.length <= 2 ? name : (name.slice(0,2) + '***');
    return safe + '@' + domain;
  }

  function badgeEmoji(key){
    const k = String(key || '');
    if(k.includes('streak')) return '🔥';
    if(k.includes('quiz')) return '🏆';
    if(k.includes('points')) return '⭐';
    if(k.includes('lessons')) return '📘';
    return '🎖️';
  }

  async function apiGet(path){
    if(!window.Api || !window.Api.apiFetch) throw new Error('API_UNAVAILABLE');
    const res = await window.Api.apiFetch(path, { method: 'GET' });
    if(!res.ok) throw new Error('HTTP_' + res.status);
    return res.json();
  }

  async function loadPoints(){
    const email = getEmail();
    const data = await apiGet('/gamification/get_points?email=' + encodeURIComponent(email));
    return data && data.data;
  }

  async function loadBadges(){
    const email = getEmail();
    const data = await apiGet('/gamification/get_badges?email=' + encodeURIComponent(email));
    return data && data.data;
  }

  async function loadLeaderboard(){
    const data = await apiGet('/gamification/get_leaderboard?limit=10');
    return data && data.data;
  }

  function renderPoints(p){
    if(!p) return;
    const points = p.points || 0;
    const streak = p.streak_days || 1;

    setText(elPoints, String(points));
    setText(elStreak, String(streak) + (streak === 1 ? ' day' : ' days'));

    const next = nextMilestone(points);
    const prev = next === 100 ? 0 : (next === 500 ? 100 : (next === 1500 ? 500 : next - 500));
    const denom = Math.max(1, next - prev);
    const pct = Math.max(0, Math.min(100, Math.round(((points - prev) / denom) * 100)));

    if(elLabel) elLabel.textContent = 'Next milestone at ' + next;
    if(elFill) elFill.style.width = pct + '%';
    try {
      const bar = elFill && elFill.parentElement;
      if(bar) bar.setAttribute('aria-valuenow', String(pct));
    } catch (e) {}
  }

  function renderBadges(b){
    if(!elBadges) return;
    const badges = (b && b.badges) ? b.badges : [];
    elBadges.innerHTML = '';

    if(!badges.length){
      const empty = document.createElement('div');
      empty.className = 'gami-badge';
      empty.innerHTML = '<div class="gami-badge-name">No badges yet</div><div class="gami-badge-desc">Earn points and keep your streak to unlock badges.</div>';
      elBadges.appendChild(empty);
      return;
    }

    badges.slice().reverse().slice(0, 9).forEach(bd => {
      const card = document.createElement('div');
      card.className = 'gami-badge';

      const icon = document.createElement('div');
      icon.className = 'gami-badge-icon';
      icon.textContent = badgeEmoji(bd.key);

      const name = document.createElement('div');
      name.className = 'gami-badge-name';
      name.textContent = bd.name || bd.key;

      const desc = document.createElement('div');
      desc.className = 'gami-badge-desc';
      desc.textContent = bd.description || '';

      card.appendChild(icon);
      card.appendChild(name);
      card.appendChild(desc);
      elBadges.appendChild(card);
    });
  }

  function renderLeaderboard(rows){
    if(!elLeaderboard) return;
    const r = Array.isArray(rows) ? rows : [];
    elLeaderboard.innerHTML = '';

    if(!r.length){
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4">No data yet</td>';
      elLeaderboard.appendChild(tr);
      return;
    }

    r.slice(0,10).forEach(row => {
      const tr = document.createElement('tr');
      const email = maskEmail(row.email);
      tr.innerHTML = '<td>' + (row.rank || '') + '</td><td>' + email + '</td><td>' + (row.points || 0) + '</td><td>' + (row.streak_days || 1) + '</td>';
      elLeaderboard.appendChild(tr);
    });
  }

  function fallbackLocal(){
    // Fallback: show local points/streak if backend endpoints not enabled.
    let local = null;
    try { local = (window.Progress && window.Progress.getState) ? window.Progress.getState() : null; } catch (e) {}
    const points = local ? (local.totalPoints || 0) : 0;
    const streak = local ? (local.streakDays || 1) : 1;

    setText(elPoints, String(points));
    setText(elStreak, String(streak) + (streak === 1 ? ' day' : ' days'));
    if(elLabel) elLabel.textContent = 'Enable backend gamification to see badges and leaderboard';
    if(elFill) elFill.style.width = '0%';

    if(elBadges){
      elBadges.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'gami-badge';
      empty.innerHTML = '<div class="gami-badge-name">Server gamification not active</div><div class="gami-badge-desc">Add the gamification router to the backend to unlock badges + leaderboard.</div>';
      elBadges.appendChild(empty);
    }

    if(elLeaderboard){
      elLeaderboard.innerHTML = '';
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4">Server gamification not active</td>';
      elLeaderboard.appendChild(tr);
    }
  }

  async function refresh(){
    try {
      const [p, b, lb] = await Promise.all([loadPoints(), loadBadges(), loadLeaderboard()]);
      renderPoints(p);
      renderBadges(b);
      renderLeaderboard(lb);
    } catch (e) {
      fallbackLocal();
    }
  }

  if(btnRefresh) btnRefresh.addEventListener('click', refresh);

  // Auto refresh after auth init
  window.addEventListener('DOMContentLoaded', ()=>{
    (async ()=>{
      try { if(window.Auth && window.Auth.init) await window.Auth.init(); } catch (e) {}
      refresh();
    })();
  });

  window.GamificationUI = { refresh };
})();
