/* ════════════════════════════════════════════════════════════
   EXORAWORLD — accountpage.js
   Extracted from account.html inline <script>.
   Loaded with defer so it runs after HTML is parsed.
   All functions are top-level globals so onclick= handlers work.
   Depends on: exora-auth.js (sets window.ExoAuth + fires exoAuthChanged)
════════════════════════════════════════════════════════════ */

/* ── Safety stubs: prevent errors on pages where these aren't defined ── */
window.openAuth = window.openAuth || function(){};
window.closeMob = window.closeMob || function(){};

/* ── Auth state handling ──
   Uses both polling and event listener because exora-auth.js is a module —
   its custom event may fire before this script's listener is registered.
   Polling is the reliable fallback. ── */

let handled = false;

function waitForAuth(cb, tries) {
  tries = tries || 0;
  if (tries > 80) {
    // Timed out after ~8s — show guard
    const guard = document.getElementById('authGuard');
    if (guard) guard.style.display = 'flex';
    return;
  }
  // ExoAuth.ready is set by exora-auth.js once onAuthStateChanged fires
  if (window.ExoAuth && window.ExoAuth.ready === true) {
    cb(window.ExoAuth.currentUser);
  } else {
    setTimeout(() => waitForAuth(cb, tries + 1), 100);
  }
}

// Listen for auth event (fires if module loads before this script)
document.addEventListener('exoAuthChanged', (e) => {
  handleUser(e.detail.user);
});

// Poll as reliable fallback
waitForAuth(handleUser);

// Redirect to home if user signs out while on this page
document.addEventListener('exoAuthChanged', (e) => {
  if (!e.detail.user && handled) {
    window.location.href = 'index.html';
  }
});

function handleUser(user) {
  if (handled) return;
  handled = true;

  const guard = document.getElementById('authGuard');
  const page  = document.getElementById('accountPage');

  if (!user) {
    if (guard) guard.style.display = 'flex';
    if (page)  page.style.display  = 'none';
    return;
  }

  if (guard) guard.style.display = 'none';
  if (page)  page.style.display  = 'block';
  populatePage(user);
}

function populatePage(user) {
  // Display name
  const nameInput = document.getElementById('displayName');
  if (nameInput) nameInput.value = user.displayName || '';

  // Profile photo
  updatePhotoPreview(user);

  // Detect provider (Google / Facebook = no password)
  const isProviderOnly = ExoAuth.isProviderOnly(user);
  const providerName   = user.providerData[0]?.providerId === 'google.com' ? 'Google' : 'Facebook';

  // Email section
  if (isProviderOnly) {
    const emailFields       = document.getElementById('emailFields');
    const providerOnlyEmail = document.getElementById('providerOnlyEmail');
    if (emailFields)       emailFields.style.display       = 'none';
    if (providerOnlyEmail) providerOnlyEmail.style.display = 'block';
    document.querySelectorAll('#emailProviderName, #emailProviderName2')
      .forEach(el => { el.textContent = providerName; });
  } else {
    const newEmailInput = document.getElementById('newEmail');
    if (newEmailInput) newEmailInput.placeholder = user.email || '';
  }

  // Password section
  if (isProviderOnly) {
    const passFields      = document.getElementById('passwordFields');
    const providerOnlyPw  = document.getElementById('providerOnlyPassword');
    if (passFields)     passFields.style.display     = 'none';
    if (providerOnlyPw) providerOnlyPw.style.display = 'block';
    document.querySelectorAll('#passProviderName, #passProviderName2')
      .forEach(el => { el.textContent = providerName; });
  }

  // Connected sign-in methods
  const providerIcons = {
    'password':    '✉️ Email / Password',
    'google.com':  '🌐 Google',
    'facebook.com':'💙 Facebook'
  };
  const list = user.providerData
    .map(p => `<div class="provider-badge" style="display:inline-flex;margin-bottom:8px;margin-right:8px">
      <span class="dot"></span>${providerIcons[p.providerId] || p.providerId}
    </div>`)
    .join('');
  const providerList = document.getElementById('providerList');
  if (providerList) {
    providerList.innerHTML = list || '<p class="field-note">No sign-in methods found.</p>';
  }
}

function updatePhotoPreview(user) {
  const preview   = document.getElementById('photoPreview');
  const removeBtn = document.getElementById('removePhotoBtn');
  if (!preview) return;

  if (user.photoURL) {
    const initial = (user.displayName || '?')[0].toUpperCase();
    preview.innerHTML = `<img src="${user.photoURL}" alt="Profile photo" referrerpolicy="no-referrer"
      onerror="this.style.display='none';this.parentElement.innerHTML='${initial}'">`;
    if (removeBtn) removeBtn.style.display = 'block';
  } else {
    const initial = (user.displayName || user.email || '?')[0].toUpperCase();
    preview.innerHTML = `<div class="photo-initial">${initial}</div>`;
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

/* ── Photo upload ── */
async function handlePhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const fb       = document.getElementById('photoFeedback');
  const progress = document.getElementById('photoProgress');
  const bar      = document.getElementById('photoProgressBar');

  if (fb) { fb.style.display = 'none'; fb.className = 'feedback'; }
  if (progress) progress.style.display = 'block';
  if (bar) bar.style.width = '30%';

  try {
    if (bar) bar.style.width = '60%';
    await ExoAuth.uploadPhoto(file);
    if (bar) bar.style.width = '100%';
    updatePhotoPreview(ExoAuth.currentUser);
    showFeedback(fb, 'success', 'Profile photo updated.');
    setTimeout(() => {
      if (progress) progress.style.display = 'none';
      if (bar) bar.style.width = '0';
    }, 800);
  } catch (err) {
    showFeedback(fb, 'error', ExoAuth.friendlyError(err));
    if (progress) progress.style.display = 'none';
    if (bar) bar.style.width = '0';
  }
  input.value = '';
}

/* ── Remove photo ── */
async function handleRemovePhoto() {
  const fb = document.getElementById('photoFeedback');
  if (fb) fb.style.display = 'none';
  try {
    await ExoAuth.removePhoto();
    updatePhotoPreview(ExoAuth.currentUser);
    showFeedback(fb, 'success', 'Profile photo removed.');
  } catch (err) {
    showFeedback(fb, 'error', ExoAuth.friendlyError(err));
  }
}

/* ── Update display name ── */
async function handleUpdateName(e) {
  const fb  = document.getElementById('nameFeedback');
  const btn = e ? e.target : document.querySelector('#accountPage .save-btn');
  if (fb) fb.style.display = 'none';

  const name = (document.getElementById('displayName')?.value || '').trim();
  if (!name) { showFeedback(fb, 'error', 'Please enter a name.'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    await ExoAuth.updateName(name);
    showFeedback(fb, 'success', 'Name updated successfully.');
  } catch (err) {
    showFeedback(fb, 'error', ExoAuth.friendlyError(err));
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Save Name'; }
}

/* ── Update email ── */
async function handleUpdateEmail(e) {
  const fb  = document.getElementById('emailFeedback');
  const btn = e ? e.target : null;
  if (fb) fb.style.display = 'none';

  const email = (document.getElementById('newEmail')?.value || '').trim();
  const pass  =  document.getElementById('emailCurrentPassword')?.value || '';
  if (!email) { showFeedback(fb, 'error', 'Please enter a new email.'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }
  try {
    await ExoAuth.updateUserEmail(email, pass);
    showFeedback(fb, 'success', 'Email updated. Check your new inbox for a verification link.');
    const newEmailEl = document.getElementById('newEmail');
    const passEl     = document.getElementById('emailCurrentPassword');
    if (newEmailEl) newEmailEl.value = '';
    if (passEl)     passEl.value     = '';
  } catch (err) {
    showFeedback(fb, 'error', ExoAuth.friendlyError(err));
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Update Email'; }
}

/* ── Update password ── */
async function handleUpdatePassword(e) {
  const fb  = document.getElementById('passwordFeedback');
  const btn = e ? e.target : null;
  if (fb) fb.style.display = 'none';

  const current = document.getElementById('currentPassword')?.value  || '';
  const next    = document.getElementById('newPassword')?.value      || '';
  const confirm = document.getElementById('confirmPassword')?.value  || '';

  if (!current || !next || !confirm) { showFeedback(fb, 'error', 'Please fill in all fields.'); return; }
  if (next !== confirm)              { showFeedback(fb, 'error', "New passwords don't match."); return; }
  if (next.length < 6)              { showFeedback(fb, 'error', 'Password must be at least 6 characters.'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }
  try {
    await ExoAuth.updateUserPassword(current, next);
    showFeedback(fb, 'success', 'Password changed successfully.');
    ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  } catch (err) {
    showFeedback(fb, 'error', ExoAuth.friendlyError(err));
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Change Password'; }
}

/* ── Helper: show feedback message ── */
function showFeedback(el, type, msg) {
  if (!el) return;
  el.textContent  = msg;
  el.className    = 'feedback ' + type;
  el.style.display = 'block';
}
