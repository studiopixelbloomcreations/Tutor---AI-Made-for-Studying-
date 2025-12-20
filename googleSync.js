// googleSync.js
(function(){
  const CONFIG = {
    apiKey: "AIzaSyAcsiGSQdTK4IokTpphDkphvQ7QbcndvZA",
    authDomain: "g9-tutor.firebaseapp.com",
    projectId: "g9-tutor",
    storageBucket: "g9-tutor.firebasestorage.app",
    messagingSenderId: "141457677515",
    appId: "1:141457677515:web:62d2b0e50899fc218f0f4e",
    measurementId: "G-BNLE95KJF8"
  };

  function toast(msg){
    if(window.AppToast) return window.AppToast(msg);
  }

  function getUserEmail(){
    try {
      if(state.user && state.user.email) return state.user.email;
    } catch (e) {}
    try {
      const stored = localStorage.getItem('g9_email');
      if(stored) return stored;
    } catch (e) {}
    return 'guest@student.com';
  }

  function ensureFirebase(){
    if(!window.firebase) return null;
    try {
      if(!firebase.apps || !firebase.apps.length){
        firebase.initializeApp(CONFIG);
      }
    } catch (e) {}
    return firebase;
  }

  function getRefs(){
    const fb = ensureFirebase();
    if(!fb) return null;
    const auth = fb.auth();
    const db = fb.firestore ? fb.firestore() : null;
    return { auth, db };
  }

  function sleep(ms){
    return new Promise(r => setTimeout(r, ms));
  }

  async function withRetries(fn, opts){
    const max = (opts && opts.retries) || 3;
    let lastErr = null;
    for(let i=0;i<max;i++){
      try {
        return await fn(i);
      } catch (e){
        lastErr = e;
        if(i < max-1){
          toast('⚠️ Progress could not be saved. Retrying…');
          await sleep(400 * Math.pow(2, i));
        }
      }
    }
    throw lastErr;
  }

  const state = {
    user: null,
    pendingTimer: null,
    pendingPayload: null,
    firestoreDisabled: false,
    firestoreDisabledNotified: false
  };

  function isFirestoreDisabledError(e){
    const msg = (e && (e.message || e.toString && e.toString())) || '';
    const code = e && e.code;
    if(code === 'permission-denied') return true;
    if(msg.includes('permission-denied')) return true;
    if(msg.includes('firestore.googleapis.com')) return true;
    if(msg.includes('Cloud Firestore API has not been used')) return true;
    if(msg.includes('it is disabled')) return true;
    return false;
  }

  function disableFirestoreOnce(){
    state.firestoreDisabled = true;
    if(state.firestoreDisabledNotified) return;
    state.firestoreDisabledNotified = true;
    // Keep toast minimal and non-blocking.
    toast('⚠️ Unable to connect to Google account. Please sign in again.');
  }

  function setUser(user){
    state.user = user || null;
  }

  async function loadRemoteForUser(uid){
    const refs = getRefs();
    if(!refs || !refs.db) return;
    if(state.firestoreDisabled) return;

    const docRef = refs.db.collection('users').doc(uid).collection('tutor').doc('progress');
    try {
      const snap = await docRef.get();
      if(snap.exists){
        const data = snap.data();
        if(window.Progress && window.Progress.applyRemote){
          window.Progress.applyRemote(data);
        }
      }
    } catch (e){
      if(isFirestoreDisabledError(e)){
        disableFirestoreOnce();
        return;
      }
      toast('⚠️ Unable to connect to Google account. Please sign in again.');
    }
  }

  async function saveRemote(uid, payload){
    const refs = getRefs();
    if(!refs || !refs.db) throw new Error('FIRESTORE_UNAVAILABLE');
    if(state.firestoreDisabled) return;
    const docRef = refs.db.collection('users').doc(uid).collection('tutor').doc('progress');
    await docRef.set(payload, { merge: true });
  }

  async function saveBackend(payload){
    if(!window.Api || !window.Api.apiFetch) throw new Error('API_UNAVAILABLE');
    const res = await window.Api.apiFetch('/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('HTTP_' + res.status);
    return true;
  }

  async function loadBackend(email){
    if(!window.Api || !window.Api.apiFetch) return;
    try {
      const url = '/progress?email=' + encodeURIComponent(email);
      const res = await window.Api.apiFetch(url, { method: 'GET' });
      if(!res.ok) return;
      const data = await res.json();
      if(data && data.progress && window.Progress && window.Progress.applyRemote){
        window.Progress.applyRemote(data.progress);
      }
    } catch (e) {
      // ignore load failures to keep UI responsive
    }
  }

  function queueSave(payload){
    state.pendingPayload = payload;
    if(state.pendingTimer) clearTimeout(state.pendingTimer);

    state.pendingTimer = setTimeout(async ()=>{
      state.pendingTimer = null;
      const toSave = state.pendingPayload;
      state.pendingPayload = null;

      const email = getUserEmail();

      // Always try backend persistence (even when not signed in)
      try {
        await withRetries(() => saveBackend({ email, progress: toSave }), { retries: 3 });
      } catch (e){
        toast('⚠️ Progress could not be saved. Retrying…');
      }

      // If signed in, also sync to Google (Firestore)
      if(!state.user || !state.user.uid){
        return;
      }
      const uid = state.user.uid;

      try {
        await withRetries(() => saveRemote(uid, toSave), { retries: 3 });
      } catch (e){
        if(isFirestoreDisabledError(e)){
          disableFirestoreOnce();
          return;
        }
        toast('⚠️ Progress could not be saved. Retrying…');
        toast('⚠️ Unable to connect to Google account. Please sign in again.');
      }
    }, 500);
  }

  function initAuthListener(){
    const refs = getRefs();
    // Backend load should happen even without Firebase available
    try { loadBackend(getUserEmail()); } catch (e) {}

    if(!refs || !refs.auth) return;

    // If Auth module exists, ensure it's initialized so the redirect flow completes
    try {
      if(window.Auth && window.Auth.init){
        window.Auth.init();
      }
    } catch (e) {}

    refs.auth.onAuthStateChanged(async (user)=>{
      setUser(user || null);
      if(user && user.uid){
        // Prefer Google data when signed in
        await loadRemoteForUser(user.uid);
        // Also load backend (authoritative for non-google logins)
        await loadBackend(getUserEmail());
      }
    }, ()=>{
      toast('⚠️ Unable to connect to Google account. Please sign in again.');
    });
  }

  function signOut(){
    const refs = getRefs();
    if(!refs || !refs.auth) return Promise.resolve();
    return refs.auth.signOut();
  }

  window.GoogleSync = {
    init: initAuthListener,
    queueSave,
    signOut,
    setUser
  };
})();
