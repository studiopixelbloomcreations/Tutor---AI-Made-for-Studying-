document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const toast = document.getElementById('toast');

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
      
      await auth.signInWithEmailAndPassword(email, pass);
      showToast('Signed in — redirecting...');
      // redirect to main app (adjust if needed)
      setTimeout(() => window.location.href = 'index.html', 900);
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
        await auth.signInWithPopup(provider);
        showToast('Signed in with Google — redirecting...');
        setTimeout(() => window.location.href = 'index.html', 900);
      } catch (err) {
        console.error('Google sign-in error:', err);
        showToast(err.message || 'Google sign-in failed');
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
