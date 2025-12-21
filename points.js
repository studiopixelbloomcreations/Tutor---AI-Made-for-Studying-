// points.js
(function(){
  const SESSION_POINTS = 50;
  const QUIZ_POINTS = 30;
  const STORAGE_KEY = 'g9_points';

  function emit(name, detail){
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) {}
  }

  function toast(msg){
    try {
      if(window.AppToast) return window.AppToast(msg, {duration: 4500});
    } catch (e) {}
    const toasts = document.getElementById('toasts');
    if(!toasts) return;
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    toasts.appendChild(d);
    setTimeout(()=>{
      d.style.opacity = '0';
      d.style.transform = 'translateY(10px)';
      setTimeout(()=>d.remove(), 300);
    }, 4500);
  }

  function load(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      activeChatId: null,
      activeSubject: null,
      hasAiResponse: false,
      pendingQuiz: null, // {question, correct_answer}
      lastAiText: ''
    };
  }

  function save(s){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  async function checkAnswer(payload){
    if(!window.Api) return { correct: false, error: 'NO_API' };

    // 3 retry attempts
    for(let i=0;i<3;i++){
      try {
        const res = await window.Api.apiFetch('/check_answer',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        if(!res.ok) throw new Error('HTTP_' + res.status);
        const data = await res.json();
        return data;
      } catch (e){
        if(i < 2) toast('⚠️ Progress update failed. Retrying…');
        else return { correct: false, error: 'CHECK_FAILED' };
      }
    }
    return { correct: false, error: 'CHECK_FAILED' };
  }

  function extractQuiz(aiText){
    // Optional convention: AI includes lines like:
    // "Quiz: <question>" and "Correct answer: <answer>"
    const text = String(aiText || '');
    const q = text.match(/\bQuiz\s*:\s*(.+)/i);
    const a = text.match(/\bCorrect\s*answer\s*:\s*(.+)/i);
    if(q && a){
      return { question: q[1].trim(), correct_answer: a[1].trim() };
    }
    return null;
  }

  function extractAwardPoints(aiText){
    const text = String(aiText || '');
    const m = text.match(/\bAWARD_POINTS\s*:\s*(\d+)\b/i);
    if(!m) return 0;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function init(){
    if(!window.Progress) return;

    const s = load();

    function prevAiLooksLikeQuestion(){
      const t = String(s.lastAiText || '').trim();
      if(!t) return false;
      // Heuristic: question mark or explicit quiz prompt
      if(/\?\s*$/.test(t) || t.includes('?')) return true;
      if(/\bquiz\b\s*:/i.test(t)) return true;
      if(/\b(correct answer|your answer)\b/i.test(t)) return true;
      return false;
    }

    function resetSession(){
      s.hasAiResponse = false;
      s.pendingQuiz = null;
      s.lastAiText = '';
      save(s);
    }

    function onChatContext(chatId, subject){
      // Session completion logic: when chat/subject changes, finalize previous session
      console.log('points.js onChatContext called:', {chatId, subject, current: {activeChatId: s.activeChatId, activeSubject: s.activeSubject, hasAiResponse: s.hasAiResponse}});
      if(s.activeChatId && (chatId !== s.activeChatId || subject !== s.activeSubject)){
        // Reset for new session, but don't award points here anymore since they're awarded immediately on AI response
        s.hasAiResponse = false;
        s.pendingQuiz = null;
        s.lastAiText = '';
      }
      s.activeChatId = chatId;
      s.activeSubject = subject;
      save(s);
    }

    window.addEventListener('g9:chat_context', (ev)=>{
      const d = ev.detail || {};
      onChatContext(d.chatId || null, d.subject || null);
    });

    window.addEventListener('g9:ai_response', (ev)=>{
      console.log('points.js received g9:ai_response event:', ev.detail);
      const d = ev.detail || {};
      if(d.chatId) onChatContext(d.chatId, d.subject);
      
      // Track that we've received an AI response (for session tracking)
      if(!s.hasAiResponse) {
        s.hasAiResponse = true;
        save(s);
      }

      const allowAward = prevAiLooksLikeQuestion();
      const award = allowAward ? extractAwardPoints(d.text) : 0;
      if(award > 0){
        window.Progress.addPoints(award);
        emit('g9:marks_updated', { reason: 'ai_award', points: award });
      }

      // Always update last AI text after handling, so the next response can be gated.
      s.lastAiText = String(d.text || '');
      save(s);

      const quiz = extractQuiz(d.text);
      if(quiz){
        s.pendingQuiz = quiz;
        save(s);
      }
    });

    window.addEventListener('g9:user_message', async (ev)=>{
      const d = ev.detail || {};
      if(d.chatId) onChatContext(d.chatId, d.subject);

      if(!s.pendingQuiz) return;
      const payload = {
        question: s.pendingQuiz.question,
        correct_answer: s.pendingQuiz.correct_answer,
        user_answer: d.text || ''
      };

      const result = await checkAnswer(payload);
      if(result && result.correct){
        window.Progress.addPoints(QUIZ_POINTS);
        emit('g9:marks_updated', { reason: 'quiz_correct', points: QUIZ_POINTS });
        s.pendingQuiz = null;
        save(s);
      } else if(result && result.error === 'CHECK_FAILED'){
        toast('⚠️ Progress update failed. Please try again.');
      }
    });

    // boot with any known context
    const active = (window.__APP_STATE__ && window.__APP_STATE__.activeChatId) || null;
    if(active){
      onChatContext(active, (window.__APP_STATE__ && window.__APP_STATE__.subject) || null);
    }

    window.Points.resetSession = resetSession;
  }

  window.Points = { init };
})();
