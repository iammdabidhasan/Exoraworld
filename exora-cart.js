/* ════════════════════════════════════════════════════════════
   EXORAWORLD — Cart module (Firestore-backed)

   Adds Firestore to the same Firebase project exora-auth.js already
   uses for Auth + Storage. Load AFTER exora-auth.js:
     <script type="module" src="exora-auth.js"></script>
     <script type="module" src="exora-cart.js"></script>

   Behavior:
   - Signed out: cart lives in memory only, for this page session.
   - Signed in: cart is read from/written to Firestore at carts/{uid},
     so it follows the account across devices and visits.
   - Sign in while a guest cart has items: merges them into whatever
     was already saved for that account (quantities add together).

   Requires a Firestore security rule limiting each cart to its own
   owner, e.g.:
     match /carts/{uid} {
       allow read, write: if request.auth != null && request.auth.uid == uid;
     }
   Without that rule (or with Firestore not yet enabled on the
   project), writes will fail — this module logs that to the console
   and keeps the in-memory cart working regardless, rather than
   breaking the page.
   ════════════════════════════════════════════════════════════ */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsTIxhaIqIQ3Hxkz3IZNAKlA-65h_7BD4",
  authDomain: "exoraworld01.firebaseapp.com",
  projectId: "exoraworld01",
  storageBucket: "exoraworld01.firebasestorage.app",
  messagingSenderId: "711731946739",
  appId: "1:711731946739:web:4b8582ea122e6546604386"
};

// Reuse the app exora-auth.js already initialized if it ran first (it
// should — load order matters here); otherwise initialize fresh so this
// module still works if ever used on a page without exora-auth.js.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

let items = [];          // in-memory source of truth, always kept current
let currentUid = null;   // null = signed out (memory-only mode)
const listeners = [];

function notify() { listeners.forEach(fn => { try { fn(items.slice()); } catch (e) {} }); }
function findIndex(productId) { return items.findIndex(i => i.productId === productId); }

async function saveToFirestore() {
  if (!currentUid) return; // guest — nothing to persist server-side yet
  try {
    await setDoc(doc(db, 'carts', currentUid), { items, updatedAt: serverTimestamp() });
  } catch (err) {
    // Common cause: Firestore not enabled yet, or security rules not set —
    // fails loudly in console but never breaks the cart itself.
    console.error('ExoCart: could not save cart to Firestore —', err.message || err);
  }
}

async function loadFromFirestore(uid) {
  try {
    const snap = await getDoc(doc(db, 'carts', uid));
    return snap.exists() ? (snap.data().items || []) : [];
  } catch (err) {
    console.error('ExoCart: could not load cart from Firestore —', err.message || err);
    return [];
  }
}

function mergeItems(base, extra) {
  const merged = base.map(i => ({ ...i }));
  extra.forEach(e => {
    const idx = merged.findIndex(m => m.productId === e.productId);
    if (idx === -1) merged.push({ ...e });
    else merged[idx].qty += e.qty;
  });
  return merged;
}

window.ExoCart = {
  getItems() { return items.slice(); },
  getCount() { return items.reduce((n, i) => n + i.qty, 0); },
  getTotal() { return items.reduce((sum, i) => sum + (Number(i.price) || 0) * i.qty, 0); },
  isSignedIn() { return !!currentUid; },

  async addItem(product, qty) {
    qty = qty || 1;
    const idx = findIndex(product.id);
    if (idx > -1) items[idx].qty += qty;
    else items.push({ productId: product.id, name: product.name, price: Number(product.price) || 0, currency: product.currency || 'USD', qty });
    notify();
    await saveToFirestore();
  },

  async removeItem(productId) {
    items = items.filter(i => i.productId !== productId);
    notify();
    await saveToFirestore();
  },

  async updateQty(productId, qty) {
    const idx = findIndex(productId);
    if (idx === -1) return;
    if (qty <= 0) items.splice(idx, 1);
    else items[idx].qty = qty;
    notify();
    await saveToFirestore();
  },

  async clear() {
    items = [];
    notify();
    await saveToFirestore();
  },

  // Subscribe to cart changes: fn(itemsArray) called on every add/remove/
  // update/clear and whenever sign-in state resolves a stored cart.
  onChange(fn) { listeners.push(fn); },

  // Called from the page whenever exoAuthChanged fires. uid is null for
  // signed-out. Merges any items added as a guest into the account's saved
  // cart, rather than discarding either one.
  async setUser(uid) {
    if (uid === currentUid) return;
    if (uid) {
      const guestItems = items;
      const remoteItems = await loadFromFirestore(uid);
      items = guestItems.length ? mergeItems(remoteItems, guestItems) : remoteItems;
      currentUid = uid;
      notify();
      if (guestItems.length) await saveToFirestore();
    } else {
      currentUid = null;
      // Items stay in memory for the rest of this session after sign-out —
      // only the Firestore sync stops, nothing is deleted.
    }
  }
};

document.dispatchEvent(new CustomEvent('exoCartReady'));
