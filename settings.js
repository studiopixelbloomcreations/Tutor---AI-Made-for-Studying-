// settings.js
(function(){
  function initSettings(ctx){
    const { state, elements, toast } = ctx;
    const { settingsLanguage, defaultSubject, studyGoalBtns } = elements;

    async function pushSettings(){
      try {
        const res = await window.Api.apiFetch('/settings',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            language: state.language,
            subject: state.subject,
            studyGoal: state.studyGoal,
            theme: state.theme
          })
        });
        if(!res.ok) throw new Error('HTTP_' + res.status);
      } catch (e){
        toast('⚠️ Server not responding. Please try again later.', {duration: 5000});
      }
    }

    if(settingsLanguage){
      settingsLanguage.value = state.language;
      settingsLanguage.addEventListener('change', (e)=>{
        state.language = e.target.value;
        localStorage.setItem('g9_language', state.language);
        toast('Language: ' + state.language);
        pushSettings();
      });
    }

    if(defaultSubject){
      defaultSubject.value = state.subject;
      defaultSubject.addEventListener('change',(e)=>{
        state.subject = e.target.value;
        localStorage.setItem('g9_subject', state.subject);
        toast('Default Subject set to ' + state.subject);
        pushSettings();
      });
    }

    if(studyGoalBtns && studyGoalBtns.length){
      studyGoalBtns.forEach(btn => {
        btn.addEventListener('click', ()=>{
          state.studyGoal = btn.dataset.goal;
          localStorage.setItem('g9_study_goal', state.studyGoal);

          if(window.Progress && window.Progress.setStudyGoal){
            window.Progress.setStudyGoal(state.studyGoal);
          }
          pushSettings();
        });
      });
    }

    return { pushSettings };
  }

  window.Settings = { initSettings };
})();
