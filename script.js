// script.js - UI logic: theme, subjects, chats, accessibility
(function(){
  const root=document.documentElement;
  const themeSelect=document.getElementById('themeSelect');
  const subjectDropdown=document.getElementById('subjectDropdown');
  const langToggle=document.getElementById('langToggle');
  const historyList=document.getElementById('historyList');
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

  // Device detection and responsive defaults
  function isMobileViewport(){ return window.matchMedia('(max-width: 900px)').matches; }
  function applyDeviceClass(){ const root = document.documentElement; if(isMobileViewport()){ root.classList.add('device-mobile'); root.classList.remove('device-desktop'); } else { root.classList.remove('device-mobile'); root.classList.add('device-desktop'); } }
  applyDeviceClass();
  window.addEventListener('resize', applyDeviceClass);

  // Backend base per start.sh: backend runs on port 8000; frontend runs on a different port (e.g., 5000)
  // Build API base from current host, pinning port 8000. Use current protocol to avoid mixed-content blocks.
  const API_PROTOCOL = window.location.protocol; // 'http:' or 'https:'
  const API_HOST = window.location.hostname;     // host only
  const API_BASE = `${API_PROTOCOL}//${API_HOST}:8000`;

  // restore state
  let state={
    theme: localStorage.getItem('g9_theme') || 'system',
    subject: localStorage.getItem('g9_subject') || 'General',
    language: localStorage.getItem('g9_language') || 'English',
    chats: JSON.parse(localStorage.getItem('g9_chats') || '[]'),
    active: localStorage.getItem('g9_active') || null
  };

  // Theme handling
  function setTheme(pref){ state.theme = pref; localStorage.setItem('g9_theme', pref); if(pref==='system'){ const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; root.setAttribute('data-theme', prefersDark ? 'dark':'light'); } else { root.setAttribute('data-theme', pref); } themeSelect.value = pref; }
  // init theme
  setTheme(state.theme);
  // respond to system changes
  const mq = window.matchMedia('(prefers-color-scheme: dark)'); if(mq.addEventListener) mq.addEventListener('change', ()=>{ if(state.theme==='system') setTheme('system'); });
  themeSelect.addEventListener('change',(e)=>{ root.classList.add('theme-transition'); setTheme(e.target.value); setTimeout(()=>root.classList.remove('theme-transition'),520); });

  // Subjects
  subjectDropdown.value = state.subject;
  subjectDropdown.addEventListener('change',(e)=>{ state.subject = e.target.value; localStorage.setItem('g9_subject', state.subject); currentSubject.textContent = 'Subject: '+state.subject; toast('Subject set to '+state.subject); });

  // Language toggle
  const langButtons = langToggle.querySelectorAll('button');
  langButtons.forEach(b=>{ if(b.dataset.lang === state.language) b.setAttribute('aria-selected','true'); b.addEventListener('click', ()=>{ langButtons.forEach(x=>x.setAttribute('aria-selected','false')); b.setAttribute('aria-selected','true'); state.language=b.dataset.lang; localStorage.setItem('g9_language', state.language); toast('Language: '+state.language); }); });

  // Toast helper
  function toast(msg,opts={duration:4200}){ const d=document.createElement('div'); d.className='toast'; d.textContent=msg; toasts.appendChild(d); setTimeout(()=>{ d.style.opacity='0'; d.style.transform='translateY(10px)'; setTimeout(()=>d.remove(),300); }, opts.duration); }

  // Chat persistence
  function saveChats(){ localStorage.setItem('g9_chats', JSON.stringify(state.chats)); localStorage.setItem('g9_active', state.active); }
  function createChat(title){ const id='c_'+Date.now(); const chat={id,title:title||'',messages:[],subject:state.subject,language:state.language,created:Date.now()}; state.chats.unshift(chat); state.active=chat.id; saveChats(); renderHistory(); renderActiveChat(); }
  function clearAll(){ state.chats=[]; state.active=null; saveChats(); renderHistory(); renderActiveChat(); }

  function renderHistory(){ historyList.innerHTML=''; if(state.chats.length===0){ const p=document.createElement('div'); p.className='history-item'; p.textContent='No conversations yet.'; historyList.appendChild(p); return; } state.chats.forEach(c=>{ const el=document.createElement('div'); el.className='history-item'; el.tabIndex=0; el.textContent=c.title; el.onclick=()=>{ state.active=c.id; saveChats(); renderHistory(); renderActiveChat(); }; if(state.active===c.id) el.setAttribute('aria-selected','true'); historyList.appendChild(el); }); }

  function renderActiveChat(){ messagesEl.innerHTML=''; const chat=state.chats.find(x=>x.id===state.active); if(!chat){ chatTitle.textContent='Welcome'; chatSubtitle.textContent='Start a new conversation'; return; } chatTitle.textContent=chat.title; chatSubtitle.textContent=new Date(chat.created).toLocaleString(); chat.messages.forEach(m=>appendMessage(m.role,m.content,false)); messagesEl.scrollTop=messagesEl.scrollHeight; }

  // improved appendMessage with enter/show animation
  function appendMessage(role,content,animate=true){
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
  }

  async function generateTitle(text){ try{ const res=await fetch(`${API_BASE}/generate_title`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:text})}); const data=await res.json(); if(data && data.title) return data.title.replace(/["'`\n\r]+/g,'').slice(0,48); }catch(e){} return text.slice(0,40); }

  async function sendMessage(){ const text=inputBox.value.trim(); if(!text) return; let chat=state.chats.find(c=>c.id===state.active); if(!chat){ createChat(); chat=state.chats[0]; }
    if(chat.messages.length===0){ const t=await generateTitle(text); chat.title=t; saveChats(); renderHistory(); renderActiveChat(); }
    const langTag = state.language==='Sinhala' ? '[සිංහල]' : '[English]'; chat.messages.push({role:'user',content:langTag+' '+text}); appendMessage('user',langTag+' '+text); saveChats(); inputBox.value=''; chat.messages.push({role:'ai',content:'Thinking…'}); appendMessage('ai','Thinking…'); saveChats(); renderHistory();

    try{ const res=await fetch(`${API_BASE}/ask`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:state.subject,language:state.language,student_question:text,title:chat.title,email:'guest@student.com'})}); const data=await res.json(); const lastAi=[...chat.messages].reverse().find(m=>m.role==='ai'); if(data){ if(data.off_syllabus) toast('Beyond Grade 9 scope — answer provided with note.'); const answer=data.answer||data.error||'No response'; if(lastAi) lastAi.content=answer; else chat.messages.push({role:'ai',content:answer}); renderActiveChat(); saveChats(); } }catch(e){ const lastAi=[...chat.messages].reverse().find(m=>m.role==='ai'); if(lastAi) lastAi.content='Error contacting backend'; renderActiveChat(); saveChats(); toast('Network error — could not contact backend', {duration:5000}); }
  }

  // Speech
  let recognition=null; if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){ const Rec = window.SpeechRecognition || window.webkitSpeechRecognition; recognition = new Rec(); recognition.continuous=false; recognition.interimResults=false; recognition.onresult=(ev)=>{ const t=ev.results[0][0].transcript||''; inputBox.value=t; inputBox.focus(); }; recognition.onerror=()=>{ toast('Speech recognition error'); }; }
  micBtn.onclick=()=>{ if(!recognition) return toast('Speech recognition not supported'); recognition.lang = state.language==='Sinhala' ? 'si-LK' : 'en-US'; recognition.start(); };

  // Sidebar toggle wiring: ensure button toggles .app.sidebar-hidden and persists
  let sidebarVisible = localStorage.getItem('g9_sidebar_visible');
  if(sidebarVisible===null){
    // Default: hide sidebar on mobile, show on desktop
    sidebarVisible = isMobileViewport() ? 'false' : 'true';
  }
  sidebarVisible = sidebarVisible === 'true';
  function applySidebar(){ if(sidebarVisible){ appEl.classList.remove('sidebar-hidden'); if(sidebar) sidebar.classList.remove('hidden'); toggleSidebarBtn && toggleSidebarBtn.setAttribute('aria-expanded','true'); } else { appEl.classList.add('sidebar-hidden'); if(sidebar) sidebar.classList.add('hidden'); toggleSidebarBtn && toggleSidebarBtn.setAttribute('aria-expanded','false'); } localStorage.setItem('g9_sidebar_visible', sidebarVisible); }
  if(toggleSidebarBtn){ toggleSidebarBtn.addEventListener('click', ()=>{ sidebarVisible = !sidebarVisible; applySidebar(); }); }
  applySidebar();

  // Events
  sendBtn.onclick=sendMessage; inputBox.addEventListener('keydown',(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); } }); newChatBtn.onclick=()=>{ state.active=null; saveChats(); renderActiveChat(); inputBox.focus(); toast('New conversation started - ask your first question!'); }; clearAllBtn.onclick=()=>{ if(confirm('Clear all conversations?')){ clearAll(); toast('All conversations cleared'); } };

  // init
  renderHistory(); renderActiveChat();
})();
