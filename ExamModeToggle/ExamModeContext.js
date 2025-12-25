(function(){
  const STORAGE_KEY = 'g9_exam_mode';

  function readInitial(){
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if(v === null) return false;
      return v === 'true';
    } catch (e) {
      return false;
    }
  }

  let examModeEnabled = readInitial();
  const listeners = new Set();

  function notify(){
    listeners.forEach((fn)=>{
      try { fn(examModeEnabled); } catch (e) {}
    });
    try {
      window.dispatchEvent(new CustomEvent('g9:exam_mode_changed', { detail: { enabled: examModeEnabled } }));
    } catch (e) {}
  }

  function setEnabled(next){
    const val = !!next;
    if(val === examModeEnabled) return;
    examModeEnabled = val;
    try { localStorage.setItem(STORAGE_KEY, String(examModeEnabled)); } catch (e) {}
    notify();
  }

  function getEnabled(){
    return examModeEnabled;
  }

  function subscribe(fn){
    if(typeof fn !== 'function') return function(){};
    listeners.add(fn);
    try { fn(examModeEnabled); } catch (e) {}
    return function(){ listeners.delete(fn); };
  }

  window.ExamModeContext = {
    getEnabled,
    setEnabled,
    subscribe
  };
})();
