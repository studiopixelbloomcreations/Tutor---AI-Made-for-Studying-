// progress.js
(function(){
  const DAY_MS = 24 * 60 * 60 * 1000;

  function todayKey(){
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function parseMinutesText(text){
    const m = String(text || '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function formatMinutes(m){
    return String(m) + 'm';
  }

  function safeText(el, value){
    if(el) el.textContent = value;
  }

  function updateBySelectors(state){
    // Sidebar progress cards
    const streakEls = document.querySelectorAll('.progress-card.streak-card .progress-card-value');
    const timeEls = document.querySelectorAll('.progress-card.time-card .progress-card-value');
    const pointsEls = document.querySelectorAll('.progress-card.points-card .progress-card-value');

    streakEls.forEach(el => safeText(el, String(state.streakDays)));
    timeEls.forEach(el => safeText(el, formatMinutes(state.minutesToday)));
    pointsEls.forEach(el => safeText(el, String(state.totalPoints)));

    // Welcome panel summary cards (same data, different classes)
    const summaryVals = document.querySelectorAll('.study-summary-cards .summary-value');
    if(summaryVals && summaryVals.length >= 3){
      safeText(summaryVals[0], String(state.streakDays));
      safeText(summaryVals[1], formatMinutes(state.minutesToday));
      safeText(summaryVals[2], String(state.totalPoints));
    }

    // Account page
    const streakValue = document.querySelector('.streak-value');
    const pointsValue = document.querySelector('.points-value');
    if(streakValue) safeText(streakValue, String(state.streakDays) + ' days 🔥');
    if(pointsValue) safeText(pointsValue, String(state.totalPoints) + ' 🏆');

    // Account study goal text
    const goalRow = Array.from(document.querySelectorAll('.account-stat-row')).find(r => {
      const label = r.querySelector('.stat-label');
      return label && label.textContent && label.textContent.toLowerCase().includes('study goal');
    });
    if(goalRow){
      const val = goalRow.querySelector('.stat-value');
      if(val){
        const g = state.studyGoalMinutes;
        if(g){
          if(g === 60) safeText(val, 'Study 1 hour daily');
          else safeText(val, 'Study ' + g + ' minutes daily');
        }
      }
    }
  }

  function defaultState(){
    return {
      streakDays: 1,
      minutesToday: 0,
      totalPoints: 0,
      studyGoalMinutes: 60,
      lastActiveDay: null,
      lastStreakDay: null
    };
  }

  function normalizeOnLoad(s){
    const key = todayKey();
    if(!s.lastActiveDay) s.lastActiveDay = key;
    if(!s.lastStreakDay) s.lastStreakDay = key;

    // First-time initialization: ensure Day 1 (not 0)
    if(!Number.isFinite(s.streakDays) || s.streakDays <= 0){
      s.streakDays = 1;
    }

    if(s.lastActiveDay !== key){
      // New day: reset minutesToday
      s.minutesToday = 0;
      s.lastActiveDay = key;
    }

    return s;
  }

  function calcDayDiff(aKey, bKey){
    const a = new Date(aKey + 'T00:00:00');
    const b = new Date(bKey + 'T00:00:00');
    return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
  }

  function applyStreakForActivity(s){
    const key = todayKey();
    if(!s.lastStreakDay){
      s.lastStreakDay = key;
      s.streakDays = Math.max(1, s.streakDays || 0);
      return;
    }

    const diff = calcDayDiff(s.lastStreakDay, key);
    if(diff === 0){
      return;
    }
    if(diff === 1){
      s.streakDays = (s.streakDays || 0) + 1;
    } else {
      s.streakDays = 1;
    }
    s.lastStreakDay = key;
  }

  function createProgress(){
    let state = defaultState();

    function loadLocal(){
      try {
        const raw = localStorage.getItem('g9_progress');
        if(raw){
          const parsed = JSON.parse(raw);
          state = Object.assign(defaultState(), parsed);
        }
      } catch (e) {}

      // Prefer existing settings value if present
      try {
        const goal = localStorage.getItem('g9_study_goal');
        if(goal){
          const m = parseInt(goal, 10);
          if(Number.isFinite(m) && m > 0) state.studyGoalMinutes = m;
        }
      } catch (e) {}
      state = normalizeOnLoad(state);
      saveLocal();
      updateBySelectors(state);
      return state;
    }

    function saveLocal(){
      try { localStorage.setItem('g9_progress', JSON.stringify(state)); } catch (e) {}
    }

    function setState(next, opts){
      state = Object.assign(defaultState(), state, next);
      state = normalizeOnLoad(state);
      saveLocal();
      updateBySelectors(state);
      if(window.GoogleSync && window.GoogleSync.queueSave){
        window.GoogleSync.queueSave(state, opts);
      }
    }

    function setStudyGoal(minutes){
      const m = parseInt(minutes, 10);
      if(!Number.isFinite(m) || m <= 0) return;
      setState({ studyGoalMinutes: m });
    }

    function touchActivity(next){
      const key = todayKey();
      if(next.lastActiveDay !== key){
        next.minutesToday = 0;
        next.lastActiveDay = key;
      }
      applyStreakForActivity(next);
    }

    function touch(opts){
      const next = Object.assign({}, state);
      touchActivity(next);
      setState(next, opts);
    }

    function setMinutesToday(minutes, opts){
      const m = parseInt(minutes, 10);
      if(!Number.isFinite(m) || m < 0) return;
      console.log('Progress.setMinutesToday called with:', m, 'current minutesToday:', state.minutesToday);
      const next = Object.assign({}, state);
      touchActivity(next);
      next.minutesToday = m;
      setState(next, opts);
    }

    function addMinutes(mins){
      const m = parseInt(mins, 10);
      if(!Number.isFinite(m) || m <= 0) return;
      const next = Object.assign({}, state);
      touchActivity(next);
      next.minutesToday = (next.minutesToday || 0) + m;
      setState(next);
    }

    function addPoints(points){
      const p = parseInt(points, 10);
      if(!Number.isFinite(p) || p <= 0) return;
      console.log('Progress.addPoints called with:', p, 'current totalPoints:', state.totalPoints);
      const next = Object.assign({}, state);
      touchActivity(next);
      next.totalPoints = (next.totalPoints || 0) + p;
      console.log('Progress.addPoints new totalPoints:', next.totalPoints);
      setState(next);
    }

    function applyRemote(remoteState){
      // remoteState should be authoritative
      if(!remoteState) return;
      const merged = Object.assign(defaultState(), remoteState);
      state = normalizeOnLoad(merged);
      saveLocal();
      updateBySelectors(state);
    }

    function getState(){
      return Object.assign({}, state);
    }

    function resetSession(opts){
      setState({ minutesToday: 0, totalPoints: 0 }, opts);
    }

    return {
      loadLocal,
      setStudyGoal,
      addMinutes,
      setMinutesToday,
      addPoints,
      applyRemote,
      getState,
      resetSession,
      setState,
      touch
    };
  }

  window.Progress = createProgress();

  // Auto-init so the UI always shows live values (not placeholder text)
  window.addEventListener('DOMContentLoaded', ()=>{
    try {
      const boot = async ()=>{
        console.log('Progress boot: starting initialization...');
        
        // Login routing is handled by loginRedirect.js; here we only initialize once authenticated.
        if(window.Auth && window.Auth.init){
          await window.Auth.init();
        }

        const user = (window.Auth && window.Auth.getUser) ? window.Auth.getUser() : null;
        console.log('Progress boot: user authenticated?', !!user, user?.uid);
        
        // TEMPORARILY allow progress initialization even without auth for testing
        if(!user || !user.uid){
          console.log('Progress boot: no authenticated user, but initializing anyway for testing...');
          // Initialize progress modules for testing even without auth
          if(window.Progress && window.Progress.loadLocal){
            console.log('Progress boot: calling Progress.loadLocal()');
            window.Progress.loadLocal();
          }
          if(window.Points && window.Points.init){
            console.log('Progress boot: calling Points.init()');
            window.Points.init();
          }
          if(window.Timer && window.Timer.init){
            console.log('Progress boot: calling Timer.init()');
            window.Timer.init();
          }
          console.log('Progress boot: testing initialization complete');
          return;
        }

        console.log('Progress boot: initializing progress modules...');
        if(window.Progress && window.Progress.loadLocal){
          console.log('Progress boot: calling Progress.loadLocal()');
          window.Progress.loadLocal();
        }
        if(window.GoogleSync && window.GoogleSync.init){
          window.GoogleSync.init();
        }
        if(window.Points && window.Points.init){
          console.log('Progress boot: calling Points.init()');
          window.Points.init();
        }
        if(window.Timer && window.Timer.init){
          console.log('Progress boot: calling Timer.init()');
          window.Timer.init();
        }
        console.log('Progress boot: initialization complete');
      };
      boot();
    } catch (e) {
      console.error('Progress boot error:', e);
    }
  });
})();
