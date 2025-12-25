(function(){
  function createToggleEl(){
    const wrap = document.createElement('div');
    wrap.className = 'exam-mode-toggle';

    const label = document.createElement('span');
    label.className = 'exam-mode-toggle-label';
    label.textContent = 'Exam Mode';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'exam-mode-switch';
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-label', 'Exam Mode');
    button.setAttribute('aria-checked', 'false');

    const knob = document.createElement('span');
    knob.className = 'exam-mode-switch-knob';
    button.appendChild(knob);

    wrap.appendChild(label);
    wrap.appendChild(button);

    return { wrap, button };
  }

  function mount(mountEl){
    if(!mountEl) return;
    if(!window.ExamModeContext) return;

    const { wrap, button } = createToggleEl();
    mountEl.appendChild(wrap);

    function apply(enabled){
      button.setAttribute('aria-checked', enabled ? 'true' : 'false');
      if(enabled) button.classList.add('on');
      else button.classList.remove('on');
    }

    window.ExamModeContext.subscribe(apply);

    button.addEventListener('click', ()=>{
      const next = !window.ExamModeContext.getEnabled();
      window.ExamModeContext.setEnabled(next);
    });

    button.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        const next = !window.ExamModeContext.getEnabled();
        window.ExamModeContext.setEnabled(next);
      }
    });
  }

  window.ExamModeToggle = { mount };
})();
