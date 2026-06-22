/* ════════════════════════════════════════════════════════════
   EXORAWORLD — SHARED AUTH SCRIPT v2
   Include on EVERY page with:
   <script type="module" src="exora-auth.js"></script>
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

// ── Firebase config ──
const firebaseConfig = {
  apiKey: "AIzaSyBsTIxhaIqIQ3Hxkz3IZNAKlA-65h_7BD4",
  authDomain: "exoraworld01.firebaseapp.com",
  projectId: "exoraworld01",
  storageBucket: "exoraworld01.firebasestorage.app",
  messagingSenderId: "711731946739",
  appId: "1:711731946739:web:4b8582ea122e6546604386"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
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

// ── Global ExoAuth object ──
window.ExoAuth = {
  currentUser: null,

  // ── Auth: sign up / sign in / social ──
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

  // ── Re-authenticate before sensitive changes ──
  async reauth(password) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    if (isProviderOnly(user)) {
      // Google/Facebook user — re-auth with their provider
      const provider = user.providerData[0].providerId === "google.com"
        ? googleProvider : facebookProvider;
      await reauthenticateWithPopup(user, provider);
    } else {
      const cred = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, cred);
    }
  },

  // ── Update display name ──
  async updateName(newName) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    await updateProfile(user, { displayName: newName });
    renderAuthUI(user);
  },

  // ── Update email (requires re-auth + sends verification) ──
  async updateUserEmail(newEmail, password) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    await this.reauth(password);
    await updateEmail(user, newEmail);
    await sendEmailVerification(user);
  },

  // ── Update password (requires re-auth) ──
  async updateUserPassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    await this.reauth(currentPassword);
    await updatePassword(user, newPassword);
  },

  // ── Send password reset email ──
  async sendReset(email) {
    await sendPasswordResetEmail(auth, email);
  },

  // ── Upload profile photo to Firebase Storage ──
  async uploadPhoto(file) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    if (!file.type.startsWith("image/")) throw new Error("Please select an image file.");
    if (file.size > 5 * 1024 * 1024)    throw new Error("Image must be under 5MB.");

    const ext      = file.name.split(".").pop();
    const path     = `profile-photos/${user.uid}/avatar.${ext}`;
    const fileRef  = ref(storage, path);

    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    await updateProfile(user, { photoURL: url });
    renderAuthUI(user);
    return url;
  },

  // ── Remove profile photo (revert to initials) ──
  async removePhoto() {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    try {
      const fileRef = ref(storage, `profile-photos/${user.uid}/avatar`);
      await deleteObject(fileRef);
    } catch(_) { /* might not exist, that's fine */ }
    await updateProfile(user, { photoURL: "" });
    renderAuthUI(user);
  },

  // ── Nav dropdown toggle ──
  toggleMenu(e) {
    if (e) e.stopPropagation();
    const dd = document.getElementById("exoUserDropdown");
    if (dd) dd.classList.toggle("open");
  },

  isProviderOnly,
  friendlyError
};

// Close dropdown on outside click
document.addEventListener("click", (e) => {
  const dd = document.getElementById("exoUserDropdown");
  if (dd && !e.target.closest(".exo-user-wrap")) dd.classList.remove("open");
});

// ── Nav bar UI ──
function renderAuthUI(user) {
  window.ExoAuth.currentUser = user;
  const navActions = document.querySelector(".nav-actions");
  const mobCtas    = document.querySelector(".mob-ctas");

  if (user) {
    const name = (user.displayName || user.email || "Explorer").split(" ")[0];
    const photo = user.photoURL;
    const avatarHTML = photo
      ? `<img src="${photo}" alt="${name}" referrerpolicy="no-referrer">`
      : `<span class="exo-user-initial">${name[0].toUpperCase()}</span>`;

    if (navActions) {
      navActions.innerHTML = `
        <div class="exo-user-wrap">
          <div class="exo-user-chip" onclick="ExoAuth.toggleMenu(event)">
            ${avatarHTML}
            <span class="exo-user-name">${name}</span>
            <span class="exo-user-caret">▾</span>
          </div>
          <div class="exo-user-dropdown" id="exoUserDropdown">
            <div class="exo-dropdown-info">
              <div class="exo-dropdown-avatar">${avatarHTML}</div>
              <div>
                <div class="exo-dropdown-name">${user.displayName || name}</div>
                <div class="exo-dropdown-email">${user.email || ""}</div>
              </div>
            </div>
            <div class="exo-dropdown-divider"></div>
            <a class="exo-dropdown-item" href="account.html">⚙ Account Settings</a>
            <div class="exo-dropdown-divider"></div>
            <button class="exo-dropdown-signout" onclick="ExoAuth.signOutUser()">Sign Out</button>
          </div>
        </div>`;
    }
    if (mobCtas) {
      mobCtas.innerHTML = `
        <div class="exo-user-chip exo-user-chip-mob">
          ${avatarHTML}
          <span class="exo-user-name">Signed in as ${name}</span>
        </div>
        <a href="account.html" style="display:block;width:100%;text-align:center;padding:10px;font-family:var(--f-mono,monospace);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:#4fd8ff;border:1px solid rgba(79,216,255,.3);background:rgba(79,216,255,.05);text-decoration:none;margin-top:6px">Account Settings</a>
        <button class="btn-ghost-sm" onclick="ExoAuth.signOutUser()" style="width:100%;text-align:center;padding:10px;margin-top:6px">Sign Out</button>`;
    }
  } else {
    if (navActions) {
      navActions.innerHTML = `
        <button class="btn-ghost-sm" onclick="openAuth('login')">Sign In</button>
        <button class="btn-ghost-sm btn-ghost-accent" onclick="openAuth('register')">Get Started</button>`;
    }
    if (mobCtas) {
      mobCtas.innerHTML = `
        <button class="btn-ghost-sm" onclick="closeMob&&closeMob();openAuth('login')" style="width:100%;text-align:center;padding:10px">Sign In</button>
        <button class="btn-fill-sm" onclick="closeMob&&closeMob();openAuth('register')" style="width:100%;text-align:center;padding:10px;clip-path:none">Get Started</button>`;
    }
  }
}

onAuthStateChanged(auth, (user) => {
  renderAuthUI(user);
  window.ExoAuth.currentUser = user;
  window.ExoAuth.ready = true;
  document.dispatchEvent(new CustomEvent("exoAuthChanged", { detail: { user } }));
});
