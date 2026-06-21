/* ════════════════════════════════════════════════════════════
   EXORAWORLD — SHARED AUTH SCRIPT
   Include this on EVERY page (existing or future) with:
   <script type="module" src="exora-auth.js"></script>
   It handles: Firebase init, Google sign-in, Facebook sign-in,
   Email/Password sign-in + sign-up, sign-out, and keeps the
   nav bar in sync with login state across the whole site.
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
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ── Your Firebase project config ──
const firebaseConfig = {
  apiKey: "AIzaSyBsTIxhaIqIQ3Hxkz3IZNAKlA-65h_7BD4",
  authDomain: "exoraworld01.firebaseapp.com",
  projectId: "exoraworld01",
  storageBucket: "exoraworld01.firebasestorage.app",
  messagingSenderId: "711731946739",
  appId: "1:711731946739:web:4b8582ea122e6546604386"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// ── Helper: friendly error messages ──
function friendlyError(err) {
  const code = err.code || "";
  if (code.includes("email-already-in-use")) return "That email already has an account — try signing in instead.";
  if (code.includes("invalid-email")) return "That email address doesn't look right.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) return "Incorrect email or password.";
  if (code.includes("popup-closed-by-user")) return "Sign-in window was closed before finishing.";
  if (code.includes("account-exists-with-different-credential")) return "This email is already linked to a different sign-in method (try Google or Email instead).";
  return "Something went wrong: " + (err.message || "please try again.");
}

// ── EXO global object — what the rest of the site (and other pages) call ──
window.ExoAuth = {
  currentUser: null,

  async signUpEmail(name, email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    return cred.user;
  },

  async signInEmail(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  },

  async signInGoogle() {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  },

  async signInFacebook() {
    const cred = await signInWithPopup(auth, facebookProvider);
    return cred.user;
  },

  async signOutUser() {
    await signOut(auth);
  },

  friendlyError
};

// ── Keep every page's nav bar in sync automatically ──
function renderAuthUI(user) {
  window.ExoAuth.currentUser = user;

  const navActions = document.querySelector(".nav-actions");
  const mobCtas = document.querySelector(".mob-ctas");

  if (user) {
    const name = (user.displayName || user.email || "Explorer").split(" ")[0];
    const photo = user.photoURL;

    if (navActions) {
      navActions.innerHTML = `
        <div class="exo-user-chip" onclick="ExoAuth.signOutUser()" title="Sign out">
          ${photo ? `<img src="${photo}" alt="${name}" referrerpolicy="no-referrer">` : `<span class="exo-user-initial">${name[0].toUpperCase()}</span>`}
          <span class="exo-user-name">${name}</span>
        </div>`;
    }
    if (mobCtas) {
      mobCtas.innerHTML = `
        <div class="exo-user-chip exo-user-chip-mob" onclick="ExoAuth.signOutUser()">
          ${photo ? `<img src="${photo}" alt="${name}" referrerpolicy="no-referrer">` : `<span class="exo-user-initial">${name[0].toUpperCase()}</span>`}
          <span class="exo-user-name">Signed in as ${name} · Tap to sign out</span>
        </div>`;
    }
  } else {
    if (navActions) {
      navActions.innerHTML = `
        <button class="btn-ghost-sm" onclick="openAuth('login')">Sign In</button>
        <button class="btn-ghost-sm btn-ghost-accent" onclick="openAuth('register')">Get Started</button>`;
    }
    if (mobCtas) {
      mobCtas.innerHTML = `
        <button class="btn-ghost-sm" onclick="closeMob();openAuth('login')" style="width:100%;text-align:center;padding:10px">Sign In</button>
        <button class="btn-fill-sm" onclick="closeMob();openAuth('register')" style="width:100%;text-align:center;padding:10px;clip-path:none">Get Started</button>`;
    }
  }
}

onAuthStateChanged(auth, (user) => {
  renderAuthUI(user);
  document.dispatchEvent(new CustomEvent("exoAuthChanged", { detail: { user } }));
});
