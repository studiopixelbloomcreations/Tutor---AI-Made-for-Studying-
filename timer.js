// timer.js
(function(){
  const TICK_MS = 15000; // background tick, minute accounting only
  const STORAGE_KEY = 'g9_timer';

  let liveState = null;

  function todayKey(){
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function now(){ return Date.now(); }

  function loadTimerState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) return JSON.parse(raw);
    } catch (e) {}
    return { dayKey: null, startedAt: null, lastTickTs: null, lastMins: 0, msgCount: 0 };
  }

  function saveTimerState(s){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function isActive(){
    // Count time only when tab is visible
    return document.visibilityState === 'visible';
  }

  function init(){
    if(!window.Progress) return;

    const tstate = loadTimerState();
    liveState = tstate;

    function resetForToday(){
      tstate.dayKey = todayKey();
      tstate.startedAt = null;
      tstate.lastTickTs = null;
      tstate.lastMins = 0;
      tstate.msgCount = 0;
      saveTimerState(tstate);
      if(window.Progress && window.Progress.setMinutesToday){
        window.Progress.setMinutesToday(0);
      }
    }

    function ensureDay(){
      const key = todayKey();
      if(tstate.dayKey !== key){
        resetForToday();
      }
    }

    function updateMinutes(){
      if(!tstate.startedAt) return;
      const mins = Math.floor((now() - tstate.startedAt) / 60000);
      if(mins < 0) return;
      if(mins !== tstate.lastMins){
        console.log('Timer.updateMinutes:', mins, 'previous:', tstate.lastMins);
        tstate.lastMins = mins;
        saveTimerState(tstate);
        if(window.Progress && window.Progress.setMinutesToday){
          console.log('Timer calling Progress.setMinutesToday with:', mins);
          window.Progress.setMinutesToday(mins);
        }
      }
    }

    function onUserMessage(){
      console.log('Timer.onUserMessage called, msgCount:', tstate.msgCount);
      ensureDay();
      tstate.msgCount = (tstate.msgCount || 0) + 1;
      if(tstate.msgCount === 1){
        console.log('Timer starting session tracking');
        tstate.startedAt = now();
        tstate.lastTickTs = tstate.startedAt;
        tstate.lastMins = 0;
        saveTimerState(tstate);
        if(window.Progress && window.Progress.touch){
          window.Progress.touch();
        }
        return;
      }
      if(tstate.msgCount >= 2){
        updateMinutes();
      }
      saveTimerState(tstate);
    }

    window.addEventListener('g9:user_message', onUserMessage);

    function tick(){
      ensureDay();
      if(!isActive()){
        tstate.lastTickTs = now();
        saveTimerState(tstate);
        return;
      }

      if(tstate.startedAt && (tstate.msgCount || 0) >= 2){
        updateMinutes();
      }
    }

    ensureDay();

    setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', ()=>{
      tstate.lastTickTs = now();
      saveTimerState(tstate);
      if(document.visibilityState === 'visible') tick();
    });
  }

  function resetSession(){
    const tstate = liveState || loadTimerState();
    tstate.startedAt = null;
    tstate.lastTickTs = null;
    tstate.lastMins = 0;
    tstate.msgCount = 0;
    // Keep dayKey as-is so we don't accidentally advance day.
    saveTimerState(tstate);
    try {
      if(window.Progress && window.Progress.setMinutesToday){
        window.Progress.setMinutesToday(0);
      }
    } catch (e) {}
  }

  window.Timer = { init, resetSession };
})();
