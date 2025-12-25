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
    if(rootEl) return rootEl;
    rootEl = document.getElementById('examModeRoot');
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

    const header = document.createElement('div');
    header.className = 'exam-mode-header';

    const title = document.createElement('div');
    title.className = 'exam-mode-title';
    title.textContent = 'Exam Mode';

    const subtitle = document.createElement('div');
    subtitle.className = 'exam-mode-subtitle';
    subtitle.textContent = step < questions.length
      ? ('Setup: question ' + (step + 1) + ' of ' + questions.length)
      : 'Setup complete.';

    header.appendChild(title);
    header.appendChild(subtitle);

    const msgs = document.createElement('div');
    msgs.className = 'messages exam-mode-messages';
    msgs.setAttribute('role', 'log');
    msgs.setAttribute('aria-live', 'polite');

    convo.forEach((m) => {
      const el = document.createElement('div');
      el.className = 'msg ' + (m.role === 'user' ? 'user' : 'ai') + ' show';
      el.textContent = m.text;
      msgs.appendChild(el);
    });

    root.appendChild(header);
    root.appendChild(msgs);
    try { msgs.scrollTop = msgs.scrollHeight; } catch (e) {}
  }

  function pushAi(text){
    convo.push({ role: 'ai', text: String(text || '') });
  }

  function pushUser(text){
    convo.push({ role: 'user', text: String(text || '') });
  }

  function handleUserInput(text){
    const t = String(text || '').trim();
    if(!t) return;

    pushUser(t);

    if(step === 0) answers.intent = t;
    else if(step === 1) answers.term = t;
    else if(step === 2) answers.subject = t;

    if(step < questions.length) step += 1;

    if(step < questions.length){
      pushAi(questions[step]);
    } else {
      pushAi('Great — you\'re all set. (Next step: I\'ll generate exam questions once the backend is connected.)');
    }

    render();
  }

  function reset(){
    setupRendered = false;
    step = 0;
    answers = { intent: '', term: '', subject: '' };
    convo = [];
    const root = ensureRoot();
    if(root) root.innerHTML = '';
  }

  window.ExamModeUI = {
    renderSetupQuestions,
    handleUserInput,
    reset
  };
})();
