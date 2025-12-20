document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const toast = document.getElementById('toast');

  const TOKEN_KEY = 'g9_token';
  const TOKEN_EXP_KEY = 'g9_token_exp';

  function getReturnTarget(){
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('return') || 'index.html';
    } catch (e) {
      return 'index.html';
    }
  }

  async function storeTokenFromUser(user){
    if(!user) return false;
    try {
      const res = await user.getIdTokenResult(true);
      const expMs = Date.parse(res.expirationTime);
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(TOKEN_EXP_KEY, String(expMs));
      return true;
    } catch (e) {
      return false;
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(()=> (toast.hidden = true), 400);
    }, 2400);
  }

  // Sign in with email & password
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const pass = form.password.value;

    if (!email) return showToast('Please enter your email.');
    if (!pass || pass.length < 6) return showToast('Password must be at least 6 characters.');

    try {
      // Configure auth for localhost
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        firebase.auth().settings.appVerificationDisabledForTesting = true;
      }
      
      const cred = await auth.signInWithEmailAndPassword(email, pass);
      const ok = await storeTokenFromUser(cred && cred.user);
      if(!ok){
        showToast('⚠️ Unable to connect to Google account. Please try again.');
        return;
      }
      showToast('Signed in — redirecting...');
      setTimeout(() => window.location.href = getReturnTarget(), 900);
    } catch (err) {
      console.error('Login error:', err);
      let errorMessage = 'Sign-in failed';
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'User not found. Please check your email.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      showToast(errorMessage);
    }
  });

  // Google sign-in
  document.querySelectorAll('.btn-social[data-provider="google"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        // Configure auth for localhost
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          firebase.auth().settings.appVerificationDisabledForTesting = true;
        }
        
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('email');
        const cred = await auth.signInWithPopup(provider);
        const ok = await storeTokenFromUser(cred && cred.user);
        if(!ok){
          showToast('⚠️ Unable to connect to Google account. Please try again.');
          return;
        }
        showToast('Signed in with Google — redirecting...');
        setTimeout(() => window.location.href = getReturnTarget(), 900);
      } catch (err) {
        console.error('Google sign-in error:', err);
        showToast('⚠️ Unable to connect to Google account. Please try again.');
      }
    });
  });

  // Optional: react to auth state (keeps user signed in)
  auth.onAuthStateChanged(user => {
    if (user) {
      console.log('User signed in:', user.email || user.displayName);
      // Optional: redirect if already signed in
      // setTimeout(() => window.location.href = 'index.html', 500);
    } else {
      console.log('No user signed in');
    }
  });
});
