/* served from /signup.js (copied from repo root signup.js) */

document.addEventListener('DOMContentLoaded', () => {
   const form = document.getElementById('signupForm');
   const toast = document.getElementById('toast');
 
   function showToast(message) {
     toast.textContent = message;
     toast.hidden = false;
     toast.style.opacity = '1';
     setTimeout(() => {
       toast.style.opacity = '0';
       setTimeout(()=> (toast.hidden = true), 400);
     }, 2600);
   }
 
   function validEmail(e){ return /\S+@\S+\.\S+/.test(e); }
 
   form.addEventListener('submit', async (ev) => {
     ev.preventDefault();
     const name = form.name.value.trim();
     const email = form.email.value.trim();
     const pw = form.password.value;
     const confirm = form.confirm.value;
     const terms = form.terms.checked;
 
     if (!name) return showToast('Please enter your name.');
     if (!validEmail(email)) return showToast('Enter a valid email.');
     if (!pw || pw.length < 6) return showToast('Password must be 6+ characters.');
     if (pw !== confirm) return showToast('Passwords do not match.');
     if (!terms) return showToast('Please accept the terms.');
 
     try {
       const cred = await auth.createUserWithEmailAndPassword(email, pw);
       // update profile
       if (cred.user) {
         await cred.user.updateProfile({ displayName: name });
         // optional: send verification email
         try { await cred.user.sendEmailVerification(); showToast('Account created. Verification sent to email.'); }
         catch(e){ console.warn('Verification email failed', e); showToast('Account created. (Verify email failed)'); }
       }
       // TEMPORARY: do NOT auto-redirect to login.html so index.html won't always forward to login
       // Original line (disabled):
       // setTimeout(()=> window.location.href = 'login.html', 1200);
       // If you want to restore redirect later, uncomment the line above.
     } catch (err) {
       showToast(err.message || 'Signup failed');
     }
   });
 
   // small UX: Enter handling
   [form.name, form.email, form.password, form.confirm].forEach(el => {
     el && el.addEventListener('keydown', (e) => { if (e.key === 'Enter') form.dispatchEvent(new Event('submit', {cancelable:true})); });
   });
 });
