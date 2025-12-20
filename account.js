// account.js
(function(){
  function initAccount(ctx){
    const { toast } = ctx;

    const accountMenuItems = document.querySelectorAll('.account-menu-item');
    const editProfileBtn = document.querySelector('.edit-icon-btn');

    const accountNameEl = document.querySelector('.account-name');
    const accountGradeEl = document.querySelector('.account-grade');
    const accountAvatarBox = document.querySelector('.account-avatar-large .avatar-gradient');
    const headerProfilePills = document.querySelectorAll('.profile-options .profile-pill');
    const headerUserPill = document.querySelector('.profile-options .profile-pill.active');
    const headerUserPillText = headerUserPill ? headerUserPill.querySelector('.profile-pill-text') : null;
    const headerUserPillIcon = headerUserPill ? headerUserPill.querySelector('.profile-pill-icon') : null;
    const welcomeMessageEl = document.querySelector('.welcome-message');

    let currentUser = null;

    function setAvatarPhoto(url){
      if(!accountAvatarBox) return;
      if(url){
        accountAvatarBox.textContent = '';
        accountAvatarBox.style.backgroundImage = 'url("' + url + '")';
        accountAvatarBox.style.backgroundSize = 'cover';
        accountAvatarBox.style.backgroundPosition = 'center';
      } else {
        accountAvatarBox.style.backgroundImage = '';
      }
    }

    function updateIdentityUI(user){
      currentUser = user || null;

      const name = (user && user.name) ? user.name : 'Alex';
      const email = (user && user.email) ? user.email : '';

      if(accountNameEl) accountNameEl.textContent = name;
      if(accountGradeEl){
        accountGradeEl.textContent = email ? email : 'Grade 9';
      }
      if(welcomeMessageEl){
        welcomeMessageEl.textContent = 'Welcome back, ' + name + '! 👋';
      }

      if(headerUserPillText) headerUserPillText.textContent = name ? name.split(' ')[0] : 'Account';
      if(headerUserPillIcon){
        // keep emoji if no photo; photo is applied only on account page
        if(!user || !user.photoURL) headerUserPillIcon.textContent = '🎓';
      }

      setAvatarPhoto(user && user.photoURL);
    }

    async function goToLoginForSwitch(){
      try {
        if(window.Auth && window.Auth.redirectToLogin){
          window.Auth.redirectToLogin();
          return;
        }
      } catch (e) {}
      window.location.href = 'login.html?return=index.html';
    }

    function ensureAccountModal(){
      let overlay = document.getElementById('accountModalOverlay');
      if(overlay) return overlay;

      overlay = document.createElement('div');
      overlay.id = 'accountModalOverlay';
      overlay.className = 'modal-overlay';

      const panel = document.createElement('div');
      panel.className = 'modal-panel';

      const header = document.createElement('div');
      header.className = 'modal-header';

      const title = document.createElement('div');
      title.className = 'modal-title';
      title.textContent = 'Account';

      const close = document.createElement('button');
      close.className = 'modal-close';
      close.type = 'button';
      close.textContent = '×';

      header.appendChild(title);
      header.appendChild(close);

      const content = document.createElement('div');
      content.className = 'modal-content';

      const card = document.createElement('div');
      card.className = 'account-profile-card';

      const avatarWrap = document.createElement('div');
      avatarWrap.className = 'account-avatar-large';
      const avatar = document.createElement('div');
      avatar.className = 'avatar-gradient';
      avatar.textContent = '🎓';
      avatarWrap.appendChild(avatar);

      const info = document.createElement('div');
      info.className = 'account-info';
      const nameRow = document.createElement('div');
      nameRow.className = 'account-name-row';
      const nameEl = document.createElement('h3');
      nameEl.className = 'account-name';
      nameEl.textContent = 'Account';
      nameRow.appendChild(nameEl);
      info.appendChild(nameRow);
      const emailEl = document.createElement('div');
      emailEl.className = 'account-grade';
      emailEl.textContent = '';
      info.appendChild(emailEl);

      card.appendChild(avatarWrap);
      card.appendChild(info);

      const menu = document.createElement('div');
      menu.className = 'account-menu';

      const manageBtn = document.createElement('button');
      manageBtn.className = 'account-menu-item';
      manageBtn.type = 'button';
      manageBtn.innerHTML = '<span class="menu-item-text">Manage your Google Account</span><span class="menu-item-chevron">›</span>';

      const changeBtn = document.createElement('button');
      changeBtn.className = 'account-menu-item';
      changeBtn.type = 'button';
      changeBtn.innerHTML = '<span class="menu-item-text">Change your account</span><span class="menu-item-chevron">›</span>';

      menu.appendChild(manageBtn);
      menu.appendChild(changeBtn);

      content.appendChild(card);
      content.appendChild(menu);

      panel.appendChild(header);
      panel.appendChild(content);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      function syncModalUser(){
        const u = currentUser;
        const nm = (u && u.name) ? u.name : 'Account';
        const em = (u && u.email) ? u.email : '';
        nameEl.textContent = nm;
        emailEl.textContent = em;
        if(u && u.photoURL){
          avatar.textContent = '';
          avatar.style.backgroundImage = 'url("' + u.photoURL + '")';
          avatar.style.backgroundSize = 'cover';
          avatar.style.backgroundPosition = 'center';
        } else {
          avatar.style.backgroundImage = '';
          avatar.textContent = '🎓';
        }
      }

      close.addEventListener('click', ()=> overlay.classList.remove('active'));
      overlay.addEventListener('click', (e)=>{ if(e.target === overlay) overlay.classList.remove('active'); });

      manageBtn.addEventListener('click', ()=>{
        window.open('https://myaccount.google.com/', '_blank', 'noopener');
      });
      changeBtn.addEventListener('click', async ()=>{
        // Change account should redirect to login.html again.
        await goToLoginForSwitch();
      });

      overlay.__syncModalUser = syncModalUser;
      return overlay;
    }

    async function call(route, payload){
      try {
        const res = await window.Api.apiFetch(route,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload || {})
        });
        if(!res.ok) throw new Error('HTTP_' + res.status);
      } catch (e){
        toast('⚠️ Server not responding. Please try again later.', {duration: 5000});
      }
    }

    if(editProfileBtn){
      editProfileBtn.addEventListener('click', ()=>{
        call('/account/edit_profile', {});
      });
    }

    accountMenuItems.forEach(btn => {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      btn.addEventListener('click', ()=>{
        if(label.includes('change avatar')) return call('/account/change_avatar', {});
        if(label.includes('edit profile')) return call('/account/edit_profile', {});
        if(label.includes('study history')) return call('/account/study_history', {});
        if(label.includes('achievements')) return call('/account/achievements', {});
        if(label.includes('sign out')){
          (async ()=>{
            try {
              if(window.Auth && window.Auth.signOutAndReset){
                await window.Auth.signOutAndReset();
              } else if(window.GoogleSync && window.GoogleSync.signOut){
                await window.GoogleSync.signOut();
                await goToLoginForSwitch();
              }
            } catch (e) {
              toast('⚠️ Unable to connect to Google account. Please try again.', {duration: 5000});
            }
            try { call('/account/sign_out', {}); } catch (e) {}
          })();
          return;
        }
        return call('/account/action', {label});
      });
    });

    // Header user pill opens account modal
    if(headerUserPill){
      headerUserPill.addEventListener('click', ()=>{
        const overlay = ensureAccountModal();
        if(overlay && overlay.__syncModalUser) overlay.__syncModalUser();
        overlay.classList.add('active');
      });
    }

    // React to Auth state changes
    window.addEventListener('g9:auth_state', (ev)=>{
      const u = ev.detail && ev.detail.user;
      updateIdentityUI(u);
      try {
        if(window.GoogleSync && window.GoogleSync.setUser){
          window.GoogleSync.setUser(u);
        }
      } catch (e) {}
    });

    // If token exists but user details are missing, show required message
    try {
      if(window.Auth && window.Auth.getToken && window.Auth.getAccountDetails){
        const t = window.Auth.getToken();
        if(t){
          window.Auth.getAccountDetails().then((d)=>{
            if(!d){
              toast('⚠️ Unable to load account details. Please refresh or log in again.', {duration: 5000});
            }
          }).catch(()=>{
            toast('⚠️ Unable to load account details. Please refresh or log in again.', {duration: 5000});
          });
        }
      }
    } catch (e) {}

    // Initial paint if already signed in
    try {
      if(window.Auth && window.Auth.getUser){
        updateIdentityUI(window.Auth.getUser());
      }
    } catch (e) {}

    return { call };
  }

  window.Account = { initAccount };
})();
