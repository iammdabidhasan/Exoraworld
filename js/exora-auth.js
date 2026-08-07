/* ════════════════════════════════════════════════════════════
   EXORAWORLD — SHARED AUTH MODULE
   Adapted from the original exora-auth.js (same live Firebase
   project). Include on every page that needs auth:
     <script type="module" src="exora-auth.js"></script>

   Provides window.ExoAuth (sign up / sign in / sign out / account
   management) and fires a "exoAuthChanged" event on every state
   change so other scripts (this page, account.html) can react.
   ════════════════════════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Same live project as the rest of ExoraWorld — this key is safe to be
// public; Firebase web apps are designed to ship this client-side and rely
// on Firebase Security Rules + authorized domains for actual protection.
const firebaseConfig = {
  apiKey: "AIzaSyBsTIxhaIqIQ3Hxkz3IZNAKlA-65h_7BD4",
  authDomain: "exoraworld01.firebaseapp.com",
  projectId: "exoraworld01",
  storageBucket: "exoraworld01.firebasestorage.app",
  messagingSenderId: "711731946739",
  appId: "1:711731946739:web:4b8582ea122e6546604386"
};

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const storage = getStorage(app);
const googleProvider   = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// ── Friendly error messages ──
function friendlyError(err) {
  const c = err.code || "";
  if (c.includes("email-already-in-use"))          return "That email already has an account — try signing in instead.";
  if (c.includes("invalid-email"))                  return "That email address doesn't look right.";
  if (c.includes("weak-password"))                  return "Password should be at least 6 characters.";
  if (c.includes("user-not-found") || c.includes("wrong-password") || c.includes("invalid-credential")) return "Incorrect email or password.";
  if (c.includes("popup-closed-by-user"))           return "Sign-in window was closed — please try again.";
  if (c.includes("account-exists-with-different-credential")) return "This email is linked to a different sign-in method.";
  if (c.includes("requires-recent-login"))          return "For security, please sign in again before making this change.";
  if (c.includes("email-already-exists"))           return "That email is already in use by another account.";
  return "Something went wrong: " + (err.message || "please try again.");
}

// ── Check if user signed in via Google/Facebook (no password) ──
function isProviderOnly(user) {
  return user && !user.providerData.some(p => p.providerId === "password");
}

window.ExoAuth = {
  currentUser: null,
  ready: false,

  async signUpEmail(name, email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    return cred.user;
  },
  async signInEmail(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  },
  async signInGoogle()   { const c = await signInWithPopup(auth, googleProvider);   return c.user; },
  async signInFacebook() { const c = await signInWithPopup(auth, facebookProvider); return c.user; },
  async signOutUser()    { await signOut(auth); },

  async reauth(password) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    if (isProviderOnly(user)) {
      const provider = user.providerData[0].providerId === "google.com" ? googleProvider : facebookProvider;
      await reauthenticateWithPopup(user, provider);
    } else {
      const cred = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, cred);
    }
  },

  async updateName(newName) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    await updateProfile(user, { displayName: newName });
    renderAuthUI(user);
  },

  async updateUserEmail(newEmail, password) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    await this.reauth(password);
    await updateEmail(user, newEmail);
    await sendEmailVerification(user);
  },

  async updateUserPassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    await this.reauth(currentPassword);
    await updatePassword(user, newPassword);
  },

  async sendReset(email) {
    await sendPasswordResetEmail(auth, email);
  },

  async uploadPhoto(file) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    if (!file.type.startsWith("image/")) throw new Error("Please select an image file.");
    if (file.size > 5 * 1024 * 1024)    throw new Error("Image must be under 5MB.");
    const ext     = file.name.split(".").pop();
    const path    = `profile-photos/${user.uid}/avatar.${ext}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    await updateProfile(user, { photoURL: url });
    renderAuthUI(user);
    return url;
  },

  async removePhoto() {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    try {
      const fileRef = ref(storage, `profile-photos/${user.uid}/avatar`);
      await deleteObject(fileRef);
    } catch (_) { /* might not exist, that's fine */ }
    await updateProfile(user, { photoURL: "" });
    renderAuthUI(user);
  },

  isProviderOnly,
  friendlyError
};

/* ── Nav UI: renders into #navAuthDesktop/#navUserDesktop and
   #navAuthMobile/#navUserMobile (see index.html). Falls back to no-op
   if a page doesn't have those slots (e.g. a future minimal page). ── */
function renderAuthUI(user) {
  window.ExoAuth.currentUser = user;

  const authDesktop = document.getElementById('navAuthDesktop');
  const userDesktop = document.getElementById('navUserDesktop');
  const authMobile  = document.getElementById('navAuthMobile');
  const userMobile  = document.getElementById('navUserMobile');
  if (!authDesktop && !authMobile) return; // page has no nav auth slots

  if (user) {
    const name  = (user.displayName || user.email || 'Explorer').split(' ')[0];
    const photo = user.photoURL;
    const avatarHTML = photo
      ? `<img src="${photo}" alt="${name}" referrerpolicy="no-referrer">`
      : `<span class="nav-user-initial">${name[0].toUpperCase()}</span>`;

    if (userDesktop) {
      userDesktop.innerHTML = `
        <button class="nav-user-chip" id="navUserChipBtn" type="button" aria-expanded="false">
          <span class="nav-user-avatar">${avatarHTML}</span>
          <span class="nav-user-name">${name}</span>
          <svg class="icon nav-user-caret" aria-hidden="true"><use href="#icon-chevron-down"/></svg>
        </button>
        <div class="nav-user-dropdown" id="navUserDropdown">
          <div class="nav-user-dropdown-info">
            <span class="nav-user-avatar">${avatarHTML}</span>
            <span>
              <span class="nav-user-dropdown-name">${user.displayName || name}</span>
              <span class="nav-user-dropdown-email">${user.email || ''}</span>
            </span>
          </div>
          <div class="nav-user-dropdown-sep"></div>
          <a class="nav-user-dropdown-item" href="/pages/account.html">Account Settings</a>
          <button class="nav-user-dropdown-signout" id="navSignOutBtn" type="button">Sign Out</button>
        </div>`;
      userDesktop.style.display = 'block';
      document.getElementById('navUserChipBtn').addEventListener('click', function (e) {
        e.stopPropagation();
        const dd = document.getElementById('navUserDropdown');
        const isOpen = dd.classList.toggle('open');
        this.setAttribute('aria-expanded', String(isOpen));
      });
      document.getElementById('navSignOutBtn').addEventListener('click', () => window.ExoAuth.signOutUser());
    }
    if (authDesktop) authDesktop.style.display = 'none';

    if (userMobile) {
      userMobile.innerHTML = `
        <div class="nav-user-chip-mob">
          <span class="nav-user-avatar">${avatarHTML}</span>
          <span class="nav-user-name">Signed in as ${name}</span>
        </div>
        <a href="/pages/account.html" class="btn btn-secondary btn-block">Account Settings</a>
        <button class="btn btn-secondary btn-block" id="navSignOutBtnMob" type="button">Sign Out</button>`;
      userMobile.style.display = 'flex';
      document.getElementById('navSignOutBtnMob').addEventListener('click', () => window.ExoAuth.signOutUser());
    }
    if (authMobile) authMobile.style.display = 'none';

  } else {
    if (authDesktop) authDesktop.style.display = 'flex';
    if (userDesktop) { userDesktop.style.display = 'none'; userDesktop.innerHTML = ''; }
    if (authMobile) authMobile.style.display = 'flex';
    if (userMobile) { userMobile.style.display = 'none'; userMobile.innerHTML = ''; }
  }
}

// Close user dropdown on outside click / Escape
document.addEventListener('click', (e) => {
  if (!e.target.closest('#navUserDesktop')) {
    document.getElementById('navUserDropdown')?.classList.remove('open');
    document.getElementById('navUserChipBtn')?.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('navUserDropdown')?.classList.remove('open');
    document.getElementById('navUserChipBtn')?.setAttribute('aria-expanded', 'false');
  }
});

onAuthStateChanged(auth, (user) => {
  renderAuthUI(user);
  window.ExoAuth.currentUser = user;
  window.ExoAuth.ready = true;
  document.dispatchEvent(new CustomEvent('exoAuthChanged', { detail: { user } }));
});
