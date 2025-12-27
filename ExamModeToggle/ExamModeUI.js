(function(){
  let rootEl = null;
  let setupRendered = false;
  let step = 0;
  let answers = { intent: '', term: '', subject: '' };
  const questions = [
    'Are you preparing for a real exam or just practicing?',
    'Which term test are you getting ready for? (First, Second, Third)',
    'Which subject are you planning to study? (Maths, Science, English, etc.)'
  ];
  let convo = [];

  function ensureRoot(){
    rootEl = document.getElementById('messages');
    return rootEl;
  }

  function renderSetupQuestions(){
    const root = ensureRoot();
    if(!root) return;

    if(!setupRendered){
      setupRendered = true;
      step = 0;
      answers = { intent: '', term: '', subject: '' };
      convo = [];
      pushAi(
        'Exam Mode helps you practice like a real test. I will ask a few quick setup questions, then I\'ll start giving you exam-style questions and feedback.'
      );
      pushAi(questions[0]);
    }

    render();
  }

  function render(){
    const root = ensureRoot();
    if(!root) return;

    root.innerHTML = '';

    convo.forEach((m) => {
      const el = document.createElement('div');
      el.className = 'msg ' + (m.role === 'user' ? 'user' : 'ai') + ' show';
      el.textContent = m.text;
      root.appendChild(el);
    });

    try { root.scrollTop = root.scrollHeight; } catch (e) {}
  }

  function pushAi(text){
    convo.push({ role: 'ai', text: String(text || '') });
  }

  function pushUser(text){
    convo.push({ role: 'user', text: String(text || '') });
  }

  function isSetupComplete(){
    return step >= questions.length;
  }

  function appendUserMessage(text){
    pushUser(text);
    render();
  }

  function appendAiMessage(text){
    pushAi(text);
    const idx = convo.length - 1;
    render();
    return idx;
  }

  function updateMessage(index, newText){
    if(typeof index !== 'number') return;
    if(index < 0 || index >= convo.length) return;
    convo[index].text = String(newText || '');
    render();
  }

  function getAnswers(){
    return { ...answers };
  }

  function getHistoryForBackend(limit){
    const n = typeof limit === 'number' ? limit : 20;
    return convo
      .filter(m => m && (m.role === 'user' || m.role === 'ai') && m.text && m.text !== 'Thinking…')
      .slice(-n)
      .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: String(m.text).slice(0, 1200) }));
  }

  function handleUserInput(text){
    const t = String(text || '').trim();
    if(!t) return;

    const wasComplete = isSetupComplete();

    pushUser(t);

    if(step === 0) answers.intent = t;
    else if(step === 1) answers.term = t;
    else if(step === 2) answers.subject = t;

    if(step < questions.length) step += 1;

    if(step < questions.length){
      pushAi(questions[step]);
    } else {
      pushAi('Okay — give me a moment to scan past papers for your term and subject.');
    }

    render();

    const nowComplete = isSetupComplete();
    return { wasComplete, nowComplete, justCompleted: (!wasComplete && nowComplete) };
  }

  function reset(){
    setupRendered = false;
    step = 0;
    answers = { intent: '', term: '', subject: '' };
    convo = [];
    rootEl = null;
    const root = ensureRoot();
    if(root) root.innerHTML = '';
  }

  window.ExamModeUI = {
    renderSetupQuestions,
    handleUserInput,
    isSetupComplete,
    appendUserMessage,
    appendAiMessage,
    updateMessage,
    getHistoryForBackend,
    getAnswers,
    reset
  };
})();
