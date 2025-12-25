(function(){
  let rootEl = null;
  let setupRendered = false;

  function ensureRoot(){
    if(rootEl) return rootEl;
    rootEl = document.getElementById('examModeRoot');
    return rootEl;
  }

  function renderSetupQuestions(){
    const root = ensureRoot();
    if(!root) return;
    if(setupRendered) return;
    setupRendered = true;

    root.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'exam-mode-card';

    const title = document.createElement('div');
    title.className = 'exam-mode-title';
    title.textContent = 'Exam Mode';

    const subtitle = document.createElement('div');
    subtitle.className = 'exam-mode-subtitle';
    subtitle.textContent = 'Answer these to set up your exam practice.';

    const list = document.createElement('ol');
    list.className = 'exam-mode-questions';

    const q1 = document.createElement('li');
    q1.textContent = 'Are you preparing for a real exam or just practicing?';

    const q2 = document.createElement('li');
    q2.textContent = 'Which term test are you getting ready for? (First, Second, Third)';

    const q3 = document.createElement('li');
    q3.textContent = 'Which subject are you planning to study? (Maths, Science, English, etc.)';

    list.appendChild(q1);
    list.appendChild(q2);
    list.appendChild(q3);

    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(list);

    root.appendChild(card);
  }

  function reset(){
    setupRendered = false;
    const root = ensureRoot();
    if(root) root.innerHTML = '';
  }

  window.ExamModeUI = {
    renderSetupQuestions,
    reset
  };
})();
