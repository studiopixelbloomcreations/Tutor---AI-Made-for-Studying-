// script.js - UI logic: theme, subjects, chats, accessibility
(function(){
  const root=document.documentElement;
  const themeSelect=document.getElementById('themeSelect');
  const subjectDropdown=document.getElementById('subjectDropdown');
  const historyList=document.getElementById('chatList');
  const newChatBtn=document.getElementById('newChat');
  const clearAllBtn=document.getElementById('clearAll');
  const messagesEl=document.getElementById('messages');
  const inputBox=document.getElementById('inputBox');
  const sendBtn=document.getElementById('sendBtn');
  const micBtn=document.getElementById('micBtn');
  const currentSubject=document.getElementById('currentSubject');
  const chatTitle=document.getElementById('chatTitle');
  const chatSubtitle=document.getElementById('chatSubtitle');
  const toasts=document.getElementById('toasts');
  const toggleSidebarBtn = document.getElementById('toggleSidebar');
  const sidebar = document.querySelector('.sidebar');
  const appEl = document.querySelector('.app');
  const composerEl = document.querySelector('.composer');
  const settingsLanguage = document.getElementById('settingsLanguage');
  const defaultSubject = document.getElementById('defaultSubject');
  const themeOptions = document.querySelectorAll('.theme-option');
  const themeToggleBtn = document.querySelector('.theme-toggle-btn');
  const studyGoalBtns = document.querySelectorAll('.study-goal-btn');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const welcomePanel = document.getElementById('welcomePanel');
  const badgesTab = document.getElementById('badgesTab');
  const badgesContent = document.getElementById('badges-content');
  

  // restore state
  let state={
    theme: localStorage.getItem('g9_theme') || 'system',
    subject: localStorage.getItem('g9_subject') || 'General',
    language: localStorage.getItem('g9_language') || 'English',
    studyGoal: localStorage.getItem('g9_study_goal') || '60',
    chats: JSON.parse(localStorage.getItem('g9_chats') || '[]'),
    active: localStorage.getItem('g9_active') || null
  };

  // Theme handling
  function updateThemeToggleUI(){
    if(!themeToggleBtn) return;
    const iconEl = themeToggleBtn.querySelector('.theme-icon');
    const textEl = themeToggleBtn.querySelector('.theme-text');
    const mode = state.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light') : state.theme;
    if(iconEl){
      iconEl.innerHTML = mode === 'dark' ? '<i data-lucide="moon"></i>' : '<i data-lucide="sun"></i>';
      try { if(window.lucide && window.lucide.createIcons) window.lucide.createIcons(); } catch (e) {}
    }
    if(textEl) textEl.textContent = state.theme.charAt(0).toUpperCase()+state.theme.slice(1)+' Mode';
  }

  function setTheme(pref){
    state.theme = pref;
    localStorage.setItem('g9_theme', pref);
    if(pref==='system'){
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark':'light');
    } else {
      root.setAttribute('data-theme', pref);
    }
    if(themeSelect) themeSelect.value = pref;
    updateThemeToggleUI();
  }
  // init theme
  setTheme(state.theme);
  // respond to system changes
  const mq = window.matchMedia('(prefers-color-scheme: dark)'); if(mq.addEventListener) mq.addEventListener('change', ()=>{ if(state.theme==='system') setTheme('system'); });
  if(themeSelect) themeSelect.addEventListener('change',(e)=>{ root.classList.add('theme-transition'); setTheme(e.target.value); setTimeout(()=>root.classList.remove('theme-transition'),520); });
  if(themeToggleBtn){
    themeToggleBtn.addEventListener('click', ()=>{
      const order = ['light','dark','system'];
      const idx = order.indexOf(state.theme);
      const next = order[(idx+1)%order.length];
      root.classList.add('theme-transition');
      setTheme(next);
      setTimeout(()=>root.classList.remove('theme-transition'),520);
    });
    updateThemeToggleUI();
  }

  // Subjects
  if(subjectDropdown){
    subjectDropdown.value = state.subject;
    subjectDropdown.addEventListener('change',(e)=>{ state.subject = e.target.value; localStorage.setItem('g9_subject', state.subject); if(defaultSubject) defaultSubject.value = state.subject; if(currentSubject) currentSubject.textContent = 'Subject: '+state.subject; toast('Subject set to '+state.subject); });
  }

  // Settings Language
  if(settingsLanguage){
    settingsLanguage.value = state.language;
    settingsLanguage.addEventListener('change', (e) => {
      state.language = e.target.value;
      localStorage.setItem('g9_language', state.language);
      toast('Language: ' + state.language);
    });
  }

  // Default Subject
  if(defaultSubject){
    defaultSubject.value = state.subject;
    defaultSubject.addEventListener('change', (e) => {
      state.subject = e.target.value;
      localStorage.setItem('g9_subject', state.subject);
      if(subjectDropdown) subjectDropdown.value = state.subject;
      if(currentSubject) currentSubject.textContent = 'Subject: ' + state.subject;
      toast('Default Subject set to ' + state.subject);
    });
  }

  // Theme Options
  const currentTheme = root.getAttribute('data-theme');
  themeOptions.forEach(btn => {
    if (btn.dataset.theme === currentTheme) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => {
      themeOptions.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const theme = btn.dataset.theme;
      root.classList.add('theme-transition');
      setTheme(theme);
      setTimeout(() => root.classList.remove('theme-transition'), 520);
    });
  });

  // Study Goal Buttons
  studyGoalBtns.forEach(btn => {
    if (btn.dataset.goal === state.studyGoal) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => {
      studyGoalBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.studyGoal = btn.dataset.goal;
      localStorage.setItem('g9_study_goal', state.studyGoal);
      toast('Study Goal set to ' + btn.textContent);
    });
  });

  // Tab Switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active'); btn.setAttribute('aria-selected', 'true');
      tabContents.forEach(c => {
        if (c.id === tab + '-tab') {
          c.style.display = 'block';
          setTimeout(() => c.classList.add('active'), 10);
        } else {
          c.classList.remove('active');
          setTimeout(() => c.style.display = 'none', 300);
        }
      });
      // Hide badges content when switching sidebar tabs
      if (badgesContent) {
        badgesContent.style.display = 'none';
      }
      if (badgesTab) {
        badgesTab.classList.remove('active');
      }
      if (composerEl) {
        composerEl.style.display = '';
      }
      // Show welcome panel and messages appropriately
      if (tab === 'chats') {
        checkWelcomePanel();
      } else {
        if (welcomePanel) welcomePanel.style.display = 'none';
        if (messagesEl) messagesEl.style.display = 'none';
      }
    });
  });

  // Badges header tab switching
  let badgesPrevState = null;
  function captureBadgesPrevState(){
    try {
      const activeSidebarTab = document.querySelector('.tab-btn.active');
      return {
        sidebarTab: activeSidebarTab ? activeSidebarTab.dataset.tab : null,
        welcomeDisplay: welcomePanel ? welcomePanel.style.display : '',
        messagesDisplay: messagesEl ? messagesEl.style.display : '',
        messagesScrollTop: messagesEl ? messagesEl.scrollTop : 0,
        composerDisplay: composerEl ? composerEl.style.display : ''
      };
    } catch (e) {
      return {
        sidebarTab: null,
        welcomeDisplay: '',
        messagesDisplay: '',
        messagesScrollTop: 0,
        composerDisplay: ''
      };
    }
  }

  function restoreBadgesPrevState(){
    const s = badgesPrevState;
    badgesPrevState = null;
    if(!s) {
      // safest fallback
      if (composerEl) composerEl.style.display = '';
      checkWelcomePanel();
      return;
    }

    // restore sidebar tab selection
    if(s.sidebarTab){
      tabBtns.forEach(b => {
        const isActive = b.dataset.tab === s.sidebarTab;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      tabContents.forEach(c => {
        if (c.id === s.sidebarTab + '-tab') {
          c.style.display = 'block';
          c.classList.add('active');
        } else {
          c.classList.remove('active');
          c.style.display = 'none';
        }
      });
    }

    // restore chat area state
    if (welcomePanel) welcomePanel.style.display = s.welcomeDisplay;
    if (messagesEl) {
      messagesEl.style.display = s.messagesDisplay;
      try { messagesEl.scrollTop = s.messagesScrollTop; } catch (e) {}
    }
    if (composerEl) composerEl.style.display = s.composerDisplay || '';
  }

  if (badgesTab) {
    badgesTab.addEventListener('click', () => {
      // Toggle badges tab active state
      const isActive = badgesTab.classList.contains('active');
      
      if (isActive) {
        // If already active, deactivate and show chat
        badgesTab.classList.remove('active');
        if (badgesContent) badgesContent.style.display = 'none';
        restoreBadgesPrevState();
      } else {
        // Activate badges tab
        badgesPrevState = captureBadgesPrevState();
        badgesTab.classList.add('active');
        if (badgesContent) badgesContent.style.display = 'block';
        if (welcomePanel) welcomePanel.style.display = 'none';
        if (messagesEl) messagesEl.style.display = 'none';
        if (composerEl) composerEl.style.display = 'none';

        try {
          if (window.BadgesUI && window.BadgesUI.refresh) window.BadgesUI.refresh();
        } catch (e) {}
        
        // Deactivate all sidebar tabs
        tabBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
        tabContents.forEach(c => {
          c.classList.remove('active');
          setTimeout(() => c.style.display = 'none', 300);
        });
      }
    });

    try { window.__g9_badges_handler_bound = true; } catch (e) {}
  }

  // Progress tracking events helper
  function emitProgressEvent(name, detail){
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) {}
  }

  // Toast helper
  function toast(msg,opts={duration:4200}){ if(!toasts) return; const d=document.createElement('div'); d.className='toast'; d.textContent=msg; toasts.appendChild(d); setTimeout(()=>{ d.style.opacity='0'; d.style.transform='translateY(10px)'; setTimeout(()=>d.remove(),300); }, opts.duration); }

  // Account wiring (Google identity + logout)
  try {
    if(window.Account && window.Account.initAccount){
      window.Account.initAccount({ toast });
    }
  } catch (e) {}

  // Debug function for testing progress (remove in production)
  window.testProgress = function() {
    console.log('Testing progress system...');
    console.log('window.Progress exists:', !!window.Progress);
    console.log('window.Progress.addPoints exists:', !!(window.Progress && window.Progress.addPoints));
    console.log('window.Progress.setMinutesToday exists:', !!(window.Progress && window.Progress.setMinutesToday));
    
    if(window.Progress && window.Progress.addPoints){
      console.log('Adding 10 test points');
      window.Progress.addPoints(10);
    }
    if(window.Progress && window.Progress.setMinutesToday){
      console.log('Setting 5 test minutes');
      window.Progress.setMinutesToday(5);
    }
    
    // Also test points module
    console.log('window.Points exists:', !!window.Points);
    console.log('window.Timer exists:', !!window.Timer);
  };

  // Chat persistence
  function saveChats(){ localStorage.setItem('g9_chats', JSON.stringify(state.chats)); localStorage.setItem('g9_active', state.active); }
  function createChat(title){ const id='c_'+Date.now(); const chat={id,title:title||'New Chat',messages:[],subject:state.subject,language:state.language,created:Date.now()}; state.chats.unshift(chat); state.active=chat.id; saveChats(); renderChats(); renderActiveChat(); }
  function clearAll(){ state.chats=[]; state.active=null; saveChats(); renderChats(); renderActiveChat(); }

  function formatTimestamp(ts){
    const now = new Date();
    const date = new Date(ts);
    const diff = now - date;
    const days = Math.floor(diff / (1000*60*60*24));
    if(days === 0) return 'Today, ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    if(days === 1) return 'Yesterday';
    return days + ' days ago';
  }

  function renderChats(){ if(!historyList) return; historyList.innerHTML=''; state.chats.forEach(chat=>{ const item=document.createElement('div'); item.className='recent-chat-item'; item.setAttribute('role','listitem'); item.setAttribute('tabindex','0'); if(chat.id===state.active) item.classList.add('active'); const title=document.createElement('div'); title.className='recent-chat-title'; title.textContent=chat.title||'New Chat'; const preview=document.createElement('div'); preview.className='recent-chat-preview'; const lastMsg=[...chat.messages].reverse().find(m=>m.role==='user'); preview.textContent=lastMsg?lastMsg.content.slice(0,34):'No messages yet'; const time=document.createElement('div'); time.className='recent-chat-time'; time.textContent=formatTimestamp(chat.created||Date.now()); item.append(title,preview,time); item.addEventListener('click',()=>{ state.active=chat.id; saveChats(); renderChats(); renderActiveChat(); }); item.addEventListener('keydown',(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); state.active=chat.id; saveChats(); renderChats(); renderActiveChat(); } }); historyList.appendChild(item); }); }

  function renderActiveChat(){ if(!messagesEl) return; messagesEl.innerHTML=''; const chat=state.chats.find(x=>x.id===state.active); if(!chat){ if(chatTitle) chatTitle.textContent='Welcome'; if(chatSubtitle) chatSubtitle.textContent='Start a new conversation'; checkWelcomePanel(); return; } if(chatTitle) chatTitle.textContent=chat.title; if(chatSubtitle) chatSubtitle.textContent=new Date(chat.created).toLocaleString(); chat.messages.forEach(m=>appendMessage(m.role,m.content,false)); messagesEl.scrollTop=messagesEl.scrollHeight; checkWelcomePanel(); }

  // improved appendMessage with enter/show animation
  function appendMessage(role,content,animate=true){
    if(!messagesEl) return;
    const m=document.createElement('div');
    m.className='msg '+(role==='user'?'user':'ai')+' enter';
    m.textContent=content;
    messagesEl.appendChild(m);
    messagesEl.scrollTop=messagesEl.scrollHeight;
    // trigger CSS entry animation
    if(animate){ requestAnimationFrame(()=>{ m.classList.add('show'); }); }
    else { m.classList.add('show'); }
    // remove enter class after animation to keep DOM clean
    setTimeout(()=>{ m.classList.remove('enter'); }, 700);
    checkWelcomePanel();
  }

  async function generateTitle(text){
    try {
      if(window.Api && window.Api.apiFetch){
        const res = await window.Api.apiFetch('/generate_title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: text })
        });
        if(res.ok){
          const data = await res.json();
          if(data && data.title) return data.title.replace(/["'`\n\r]+/g,'').slice(0,48);
        }
      }
    } catch (e) {}
    return text.slice(0,40);
  }

  async function sendMessage(){ const text=inputBox.value.trim(); if(!text) return; let chat=state.chats.find(c=>c.id===state.active); if(!chat){ createChat('New Chat'); chat=state.chats[0]; }
    if(chat.messages.length===0){ const t=await generateTitle(text); chat.title=t; saveChats(); renderChats(); renderActiveChat(); }
    const langTag = state.language==='Sinhala' ? '[සිංහල]' : '[English]'; chat.messages.push({role:'user',content:langTag+' '+text}); appendMessage('user',langTag+' '+text); saveChats(); inputBox.value=''; if(micBtn) micBtn.classList.remove('hidden'); if(sendBtn) sendBtn.classList.remove('show'); chat.messages.push({role:'ai',content:'Thinking…'}); appendMessage('ai','Thinking…'); saveChats(); renderChats(); emitProgressEvent('g9:chat_context', { chatId: state.active, subject: state.subject });
    emitProgressEvent('g9:user_message', { chatId: state.active, subject: state.subject, text });

    try{ 
      const res= await (window.Api && window.Api.apiFetch ? window.Api.apiFetch('/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:state.subject,language:state.language,student_question:text,title:chat.title,email:'guest@student.com'})}) : fetch('/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:state.subject,language:state.language,student_question:text,title:chat.title,email:'guest@student.com'})}));
      const data=await res.json();
      const lastAi=[...chat.messages].reverse().find(m=>m.role==='ai');
      if(lastAi) lastAi.content=data.answer||'No answer'; emitProgressEvent('g9:ai_response', { chatId: state.active, subject: state.subject, text: data.answer });
      renderActiveChat(); saveChats(); 
    }
    catch(e){ const msg='⚠️ Message failed to send. Please check your connection or try again later.'; const lastAi=[...chat.messages].reverse().find(m=>m.role==='ai'); if(lastAi) lastAi.content=msg; renderActiveChat(); saveChats(); toast(msg,{duration:5000}); }
  }

  // Speech
  let recognition=null; 
  if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new Rec();
    recognition.continuous=false;
    recognition.interimResults=false;
    recognition.onresult=(ev)=>{ 
      const t=ev.results[0][0].transcript||''; 
      inputBox.value=t; 
      inputBox.focus(); 
      // Trigger input event to show send button
      try { inputBox.dispatchEvent(new Event('input')); } catch (e) {}
    };
    recognition.onstart=()=>{ toast('Listening…'); };
    recognition.onend=()=>{ /* no-op */ };
    recognition.onerror=(e)=>{ 
      const code = (e && (e.error || e.name)) ? String(e.error || e.name) : 'unknown';
      if(code === 'not-allowed' || code === 'service-not-allowed') toast('Microphone permission denied');
      else if(code === 'no-speech') toast('No speech detected');
      else toast('Speech recognition error: ' + code);
    };
  }
  if(micBtn && !window.__g9_voice_backend_enabled) micBtn.onclick=()=>{
    if(!recognition) return toast('Speech recognition not supported');
    // SpeechRecognition usually requires a secure context (HTTPS) except localhost.
    const host = String(location.hostname || '').toLowerCase();
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if(!window.isSecureContext && !isLocal){
      return toast('Mic requires HTTPS or localhost');
    }
    recognition.lang = state.language==='Sinhala' ? 'si-LK' : 'en-US';
    try {
      // If already running, restart cleanly
      if(recognition.abort) recognition.abort();
      recognition.start();
    } catch (e) {
      toast('Speech recognition failed to start');
    }
  };

  // Sidebar toggle wiring: ensure button toggles .app.sidebar-hidden and persists
  let sidebarVisible = localStorage.getItem('g9_sidebar_visible');
  if(sidebarVisible===null) sidebarVisible = 'true';
  sidebarVisible = sidebarVisible === 'true';
  function applySidebar(){ if(sidebarVisible){ appEl.classList.remove('sidebar-hidden'); if(sidebar) sidebar.classList.remove('hidden'); toggleSidebarBtn && toggleSidebarBtn.setAttribute('aria-expanded','true'); } else { appEl.classList.add('sidebar-hidden'); if(sidebar) sidebar.classList.add('hidden'); toggleSidebarBtn && toggleSidebarBtn.setAttribute('aria-expanded','false'); } localStorage.setItem('g9_sidebar_visible', sidebarVisible); }
  if(toggleSidebarBtn){ toggleSidebarBtn.addEventListener('click', ()=>{ sidebarVisible = !sidebarVisible; applySidebar(); }); }
  applySidebar();

  // Input box mic/send toggle
  if (inputBox && micBtn && sendBtn) {
    inputBox.addEventListener('input', () => {
      if (inputBox.value.trim()) {
        micBtn.classList.add('hidden');
        sendBtn.classList.add('show');
      } else {
        micBtn.classList.remove('hidden');
        sendBtn.classList.remove('show');
      }
    });
  }

  // Action buttons
  const actionButtons = document.querySelectorAll('.action-button');
  actionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.querySelector('.action-text').textContent;
      if (inputBox) {
        inputBox.value = text;
        inputBox.focus();
        // Trigger input event to show send button
        inputBox.dispatchEvent(new Event('input'));
        // Hide welcome panel and show messages
        if (welcomePanel) welcomePanel.style.display = 'none';
        if (messagesEl) messagesEl.style.display = 'flex';
      }
    });
  });

  // Show welcome panel when no messages
  function checkWelcomePanel() {
    if (messagesEl && welcomePanel) {
      if (messagesEl.children.length === 0) {
        welcomePanel.style.display = 'flex';
        messagesEl.style.display = 'none';
      } else {
        welcomePanel.style.display = 'none';
        messagesEl.style.display = 'flex';
      }
    }
  }


  // Settings functionality
  // Language selector
  if (settingsLanguage) {
    settingsLanguage.value = state.language;
    settingsLanguage.addEventListener('change', (e) => {
      state.language = e.target.value;
      localStorage.setItem('g9_language', state.language);
      toast('Language changed to ' + state.language);
    });
  }

  // Default subject selector
  if (defaultSubject) {
    defaultSubject.value = state.subject;
    defaultSubject.addEventListener('change', (e) => {
      state.subject = e.target.value;
      localStorage.setItem('g9_subject', state.subject);
      if(currentSubject) currentSubject.textContent = 'Subject: ' + state.subject;
      toast('Default subject set to ' + state.subject);
    });
  }

  // Theme toggle
  themeOptions.forEach(option => {
    if (option.dataset.theme === state.theme) {
      option.classList.add('active');
    }
    option.addEventListener('click', () => {
      themeOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      setTheme(option.dataset.theme);
    });
  });

  // Study goal buttons
  studyGoalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      studyGoalBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const goal = btn.getAttribute('data-goal');
      toast('Study goal set to ' + goal + ' minutes');
    });
  });

  // Events
  if(sendBtn) sendBtn.onclick=sendMessage;
  if(inputBox) inputBox.addEventListener('keydown',(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); } });
  if(newChatBtn) newChatBtn.onclick=()=>{ createChat('New Chat'); if(inputBox) inputBox.focus(); };
  if(clearAllBtn) clearAllBtn.onclick=()=>{
    if(confirm('Clear all conversations?')){
      clearAll();
      try { if(window.Points && window.Points.resetSession) window.Points.resetSession(); } catch (e) {}
      try { if(window.Timer && window.Timer.resetSession) window.Timer.resetSession(); } catch (e) {}
      try { if(window.Progress && window.Progress.resetSession) window.Progress.resetSession(); } catch (e) {}
      toast('All conversations cleared');
    }
  };

  // init
  renderChats(); renderActiveChat(); if(!state.active && state.chats.length===0) createChat('New Chat');
  
  // Initial welcome panel check
  checkWelcomePanel();

  try { if(window.lucide && window.lucide.createIcons) window.lucide.createIcons(); } catch (e) {}
})();
