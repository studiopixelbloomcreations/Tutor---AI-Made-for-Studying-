// chat.js
(function(){
  function startLoadingAnimation(targetEl){
    let i = 0;
    const frames = ['Thinking…', 'Thinking…', 'Thinking…'];
    const timer = setInterval(()=>{
      i = (i + 1) % 3;
      const dots = i === 0 ? '…' : i === 1 ? '..' : '...';
      targetEl.textContent = 'Thinking' + dots;
    }, 450);
    return () => clearInterval(timer);
  }

  function initChat(ctx){
    const { state, elements, toast, appendMessage, saveChats, renderChats, renderActiveChat, createChat, generateTitle } = ctx;
    const { inputBox, sendBtn, messagesEl } = elements;

    function emit(name, detail){
      console.log('chat.js emitting event:', name, detail);
      try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) {}
    }

    async function sendMessage(){
      const text = (inputBox && inputBox.value || '').trim();
      if(!text) return;

      let chat = state.chats.find(c=>c.id===state.active);
      if(!chat){
        createChat('New Chat');
        chat = state.chats[0];
      }

      if(chat.messages.length===0){
        const t = await generateTitle(text);
        chat.title = t;
        saveChats();
        renderChats();
        renderActiveChat();
      }

      const langTag = state.language==='Sinhala' ? '[සිංහල]' : '[English]';
      const userText = langTag + ' ' + text;

      // Remember last-known email for backend progress sync
      try { localStorage.setItem('g9_email', 'guest@student.com'); } catch (e) {}

      // Points/session tracking hooks
      emit('g9:chat_context', { chatId: state.active, subject: state.subject });
      emit('g9:user_message', { chatId: state.active, subject: state.subject, text });

      chat.messages.push({role:'user',content:userText});
      appendMessage('user', userText);
      saveChats();
      inputBox.value='';

      chat.messages.push({role:'ai',content:'Thinking…'});
      appendMessage('ai','Thinking…');
      saveChats();
      renderChats();

      const lastBubble = messagesEl ? messagesEl.lastElementChild : null;
      const stopAnim = lastBubble ? startLoadingAnimation(lastBubble) : null;

      const history = (chat && Array.isArray(chat.messages))
        ? chat.messages
            .filter(m => m && (m.role === 'user' || m.role === 'ai') && m.content && m.content !== 'Thinking…')
            .slice(-20)
            .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: String(m.content).slice(0, 1200) }))
        : [];

      try {
        const res = await window.Api.apiFetch('/ask',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            subject:state.subject,
            language:state.language,
            student_question:text,
            history,
            title:chat.title,
            email:'guest@student.com'
          })
        });

        if(!res.ok){
          throw new Error('HTTP_' + res.status);
        }

        const data = await res.json();
        const lastAi = [...chat.messages].reverse().find(m=>m.role==='ai');

        if(!data || !data.answer){
          throw new Error('INVALID_RESPONSE');
        }

        if(data.off_syllabus){
          toast('Beyond Grade 9 scope — answer provided with note.', {duration: 4000});
        }

        const answer = data.answer;
        if(lastAi){
          lastAi.content = answer;
        } else {
          chat.messages.push({role:'ai',content:answer});
        }

        // Points/session tracking hooks
        emit('g9:ai_response', { chatId: state.active, subject: state.subject, text: answer });

        renderActiveChat();
        saveChats();
      } catch(e){
        const msg = '⚠️ Message failed to send. Please check your connection or try again later.';
        const lastAi = [...chat.messages].reverse().find(m=>m.role==='ai');
        if(lastAi){
          lastAi.content = msg;
        } else {
          chat.messages.push({role:'ai',content:msg});
        }
        renderActiveChat();
        saveChats();
        toast(msg, {duration: 5000});
      } finally {
        if(stopAnim) stopAnim();
      }
    }

    // Marks update confirmation (separate from AI reply, per requirements)
    window.addEventListener('g9:marks_updated', ()=>{
      try {
        const chat = state.chats.find(c=>c.id===state.active);
        if(!chat) return;
        const msg = '✅ Your marks have been successfully updated in the progress bar.';
        chat.messages.push({ role: 'ai', content: msg });
        appendMessage('ai', msg);
        saveChats();
        renderChats();
      } catch (e) {}
    });

    if(sendBtn) sendBtn.onclick = sendMessage;
    if(inputBox){
      inputBox.addEventListener('keydown',(e)=>{
        if(e.key==='Enter' && !e.shiftKey){
          e.preventDefault();
          sendMessage();
        }
      });
    }

    return { sendMessage };
  }

  window.Chat = { initChat };
})();
