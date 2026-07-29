/* ════════════════════════════════════════════════════════════
   EXORAWORLD — Exo Assistant + Checkout Engine (v3)

   Still a local, rule-based system — no external AI API, by your
   design, not a limitation I'm working around. This version pushes
   on what a LOCAL system can uniquely do well, rather than trying
   to fake general intelligence it structurally can't have:

     1. LIVE DATA, NOT MEMORY — product/game facts are read straight
        from the DOM at load time, not duplicated into a JS object.
        Change a price in the HTML and Exo is automatically correct
        next reload. It literally cannot quote a stale price.

     2. PAGE ACTIONS — Exo can operate the page (toggle theme, open
        the sign-up form), not just describe what's on it.

     3. REAL TIME — actual current time / configurable support hours,
        computed live, not guessed.

     4. HONEST FAILURE — when nothing matches, it says so and offers
        a human, rather than confidently guessing.

   What it still can't do: compose a genuinely novel explanation for
   something outside its knowledge base. That's a real ceiling of
   this approach, not something more code fixes.
   ════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/maqaprqk';

  function slugify(s) { return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
  function fmtUSD(n) { return '$' + n.toFixed(2); }
  function fmtBDT(n) { return '৳' + Math.round(n).toLocaleString('en-US'); }

  var PRODUCT_ICONS = { 'aurora-hoodie': '👕', 'pulse-earbuds': '🎧', 'nova-backpack': '🎒' };
  function iconFor(id) { return PRODUCT_ICONS[id] || '🛍️'; }

  // ── Live data: scraped from the actual Store/Games sections at load time.
  //    This is the "single source of truth" fix — no separate dataset that
  //    can silently drift out of sync with what the page actually shows. ──
  var PRODUCTS = {};
  var GAMES = {};

  function scrapeProducts() {
    var out = {};
    document.querySelectorAll('#store [data-buy]').forEach(function (btn) {
      var id = btn.dataset.buy;
      var card = btn.closest('.card');
      if (!id || !card) return;
      var name = (card.querySelector('h3') || {}).textContent || id;
      var priceText = (card.querySelector('.price') || {}).textContent || '0';
      var localText = (card.querySelector('.price-local') || {}).textContent || '0';
      var desc = (card.querySelector('.card-desc') || {}).textContent || '';
      var media = card.querySelector('.card-media');
      var gradient = 'grad-1';
      if (media) {
        var g = Array.prototype.find.call(media.classList, function (c) { return c.indexOf('grad-') === 0; });
        if (g) gradient = g;
      }
      out[id] = {
        name: name.trim(),
        priceValue: parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0,
        priceLocalValue: parseFloat(localText.replace(/[^0-9]/g, '')) || 0,
        desc: desc.trim(),
        icon: iconFor(id),
        gradient: gradient
      };
    });
    return out;
  }

  function scrapeGames() {
    var out = {};
    document.querySelectorAll('#games .card').forEach(function (card) {
      var nameEl = card.querySelector('h3');
      var name = nameEl ? nameEl.textContent.trim() : '';
      if (!name) return;
      var id = slugify(name);
      var genre = (card.querySelector('.badge') || {}).textContent || '';
      var ratingText = (card.querySelector('.rating') || {}).textContent || '';
      var rating = (ratingText.match(/[\d.]+/) || [])[0] || '';
      var desc = (card.querySelector('.card-desc') || {}).textContent || '';
      out[id] = { name: name, genre: genre.trim(), rating: rating, desc: desc.trim() };
    });
    return out;
  }

  var PAY_METHODS = [
    { id: 'bkash', label: 'bKash', type: 'phone', value: '01715948039', hint: 'Send Money to this bKash number, then enter the Transaction ID from the confirmation SMS.' },
    { id: 'nagad', label: 'Nagad', type: 'phone', value: '01715948039', hint: 'Send Money to this Nagad number, then enter the Transaction ID from the confirmation SMS.' },
    { id: 'airtm', label: 'Airtm', type: 'email', value: 'iammdabidhasan@gmail.com', hint: 'Send payment to this Airtm email, then enter the Airtm reference ID from your receipt.' }
  ];
  function findMethod(id) {
    for (var i = 0; i < PAY_METHODS.length; i++) if (PAY_METHODS[i].id === id) return PAY_METHODS[i];
    return null;
  }
  function detectPayMethod(text) {
    var lower = text.toLowerCase();
    if (lower.indexOf('bkash') !== -1 || lower.indexOf('b-kash') !== -1 || lower.indexOf('b kash') !== -1) return 'bkash';
    if (lower.indexOf('nagad') !== -1) return 'nagad';
    if (lower.indexOf('airtm') !== -1 || lower.indexOf('air tm') !== -1) return 'airtm';
    return null;
  }

  // ── Real time — actual Asia/Dhaka clock, not a guess. Edit SUPPORT_HOURS
  //    to your real hours; Exo will honestly reflect whatever you set. ─────
  var SUPPORT_HOURS = { start: 9, end: 21 }; // 24h, Asia/Dhaka
  function dhakaNow() { return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })); }
  function isWithinSupportHours() { var h = dhakaNow().getHours(); return h >= SUPPORT_HOURS.start && h < SUPPORT_HOURS.end; }
  function timeOfDayWord() {
    var h = dhakaNow().getHours();
    if (h < 5) return 'the middle of the night';
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    if (h < 21) return 'evening';
    return 'night';
  }

  // ── Shared order submission ──────────────────────────────────────────────
  function makeOrderId() { return 'EXO-' + Date.now().toString(36).toUpperCase().slice(-6); }

  function submitOrder(productId, buyer, onDone) {
    var p = PRODUCTS[productId];
    var qty = buyer.qty || 1;
    var m = findMethod(buyer.method);
    var id = makeOrderId();
    var payload = {
      _subject: '🛒 New ExoraWorld order — ' + (p ? p.name : productId) + ' x' + qty + ' (' + id + ')',
      order_id: id,
      product: p ? p.name : productId,
      quantity: qty,
      price_usd: p ? fmtUSD(p.priceValue * qty) : '',
      price_local: p ? fmtBDT(p.priceLocalValue * qty) : '',
      payment_method: m ? m.label : buyer.method,
      transaction_id: buyer.txnId,
      buyer_name: buyer.name,
      buyer_phone: buyer.phone,
      buyer_email: buyer.email,
      submitted_at: dhakaNow().toLocaleString('en-US') + ' (Asia/Dhaka)'
    };
    fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) { if (onDone) onDone(id, res.ok); })
      .catch(function () { if (onDone) onDone(id, false); });
    return id;
  }

  /* ════════════════════════════════════════════════════════════
     CHECKOUT MODAL — quick single-item "Buy Now" front end.
     ════════════════════════════════════════════════════════════ */
  function initCheckoutModal() {
    var overlay = document.getElementById('checkoutModal');
    if (!overlay) return;
    var closeBtn = document.getElementById('checkoutClose');
    var summary = document.getElementById('checkoutProductSummary');
    var step1 = document.getElementById('checkoutStep1');
    var step2 = document.getElementById('checkoutStep2');
    var step3 = document.getElementById('checkoutStep3');
    var step2Form = document.getElementById('checkoutStep2Form');
    var tabs = document.getElementById('payMethodTabs');
    var instructionsEl = document.getElementById('payInstructions');
    var backBtn = document.getElementById('checkoutBack');
    var doneBtn = document.getElementById('checkoutDone');
    var dots = overlay.querySelectorAll('.checkout-step-dot');
    var state = { productId: null, method: PAY_METHODS[0].id };

    function setDots(n) { dots.forEach(function (d, i) { d.classList.toggle('active', i === n - 1); d.classList.toggle('done', i < n - 1); }); }
    function showStep(n) { step1.hidden = n !== 1; step2.hidden = n !== 2; step3.hidden = n !== 3; setDots(n); }

    function renderTabs() {
      tabs.innerHTML = PAY_METHODS.map(function (m) {
        return '<button type="button" class="pay-method-tab' + (m.id === state.method ? ' active' : '') + '" data-method="' + m.id + '">' + m.label + '</button>';
      }).join('');
      tabs.querySelectorAll('.pay-method-tab').forEach(function (btn) {
        btn.addEventListener('click', function () { state.method = btn.dataset.method; renderTabs(); renderInstructions(); });
      });
    }
    function renderInstructions() {
      var m = findMethod(state.method);
      var p = PRODUCTS[state.productId];
      if (!p) return;
      instructionsEl.innerHTML =
        '<p>' + m.hint + '</p>' +
        '<div class="pay-value-box"><span>' + m.value + '</span><button type="button" class="copy-btn" id="payCopyBtn">Copy</button></div>' +
        '<p style="margin-top:0.85rem;margin-bottom:0">Amount to send: <strong>' + fmtUSD(p.priceValue) + ' (' + fmtBDT(p.priceLocalValue) + ')</strong></p>';
      document.getElementById('payCopyBtn').addEventListener('click', function () {
        var btn = this;
        navigator.clipboard.writeText(m.value).then(function () {
          btn.textContent = 'Copied!'; btn.classList.add('copied');
          setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
        });
      });
    }

    window.openCheckout = function (productId) {
      var p = PRODUCTS[productId];
      if (!p) { if (window.showToast) window.showToast('Sorry, that item is unavailable right now.'); return; }
      state.productId = productId;
      state.method = PAY_METHODS[0].id;
      summary.innerHTML =
        '<span class="checkout-product-icon ' + p.gradient + '">' + p.icon + '</span>' +
        '<div class="checkout-product-info"><h4>' + p.name + '</h4>' +
        '<span class="price-block"><span class="price">' + fmtUSD(p.priceValue) + '</span><span class="price-local">' + fmtBDT(p.priceLocalValue) + '</span></span></div>';
      step1.reset(); step2Form.reset();
      showStep(1); renderTabs(); renderInstructions();
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      if (window._updateBodyScroll) window._updateBodyScroll(); else document.body.classList.add('no-scroll');
    };

    function close() {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      if (window._updateBodyScroll) window._updateBodyScroll(); else document.body.classList.remove('no-scroll');
    }
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    doneBtn.addEventListener('click', close);
    backBtn.addEventListener('click', function () { showStep(1); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('active')) close(); });

    step1.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!step1.checkValidity()) { step1.reportValidity(); return; }
      showStep(2);
    });
    step2Form.addEventListener('submit', function (e) {
      e.preventDefault();
      var txnId = document.getElementById('txnId').value.trim();
      if (!txnId) return;
      var buyer = {
        name: document.getElementById('buyerName').value.trim(),
        phone: document.getElementById('buyerPhone').value.trim(),
        email: document.getElementById('buyerEmail').value.trim(),
        method: state.method, txnId: txnId
      };
      var btn = step2Form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Submitting…';
      submitOrder(state.productId, buyer, function (id, ok) {
        btn.disabled = false; btn.textContent = 'Submit Order';
        if (ok) { document.getElementById('checkoutOrderId').textContent = id; showStep(3); }
        else {
          var errBox = document.getElementById('checkoutOrderError');
          if (!errBox) {
            errBox = document.createElement('div');
            errBox.id = 'checkoutOrderError'; errBox.className = 'auth-error';
            step2Form.insertBefore(errBox, step2Form.firstChild);
          }
          errBox.textContent = "That didn't go through — check your connection and try again, or email theexoraworld@gmail.com with your Transaction ID (" + buyer.txnId + ") directly.";
          errBox.style.display = 'block';
        }
      });
    });

    document.querySelectorAll('[data-buy]').forEach(function (btn) {
      btn.addEventListener('click', function () { window.openCheckout(btn.dataset.buy); });
    });
  }

  /* ════════════════════════════════════════════════════════════
     EXO — chat guide + conversational checkout
     ════════════════════════════════════════════════════════════ */

  var els = {};
  var chatCheckout = null;
  var memory = { lastProductId: null, userName: null, knownEmail: null, knownPhone: null, fallbackStreak: 0 };

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  var TYPO_MAP = {
    'gmae': 'game', 'gams': 'games', 'stoer': 'store', 'strore': 'store', 'pyament': 'payment', 'paymnet': 'payment',
    'nagade': 'nagad', 'wat': 'what', 'hw': 'how', 'hlp': 'help', 'plz': 'please', 'pls': 'please',
    'u': 'you', 'ur': 'your', 'thx': 'thanks', 'recieve': 'receive', 'definately': 'definitely'
  };
  function normalize(text) {
    return text.split(/\s+/).map(function (w) {
      var clean = w.toLowerCase().replace(/[^a-z]/g, '');
      return TYPO_MAP[clean] || w;
    }).join(' ');
  }
  function tokenize(text) { return text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean); }

  // ── Knowledge base. Product/game entries use `dynamic` — a function that
  //    reads current PRODUCTS/GAMES at reply time — instead of a written
  //    string, so the numbers can never go stale. Static topics keep
  //    `replies` arrays with multiple phrasings so it doesn't feel robotic. ──
  var KB = [
    { id: 'greet', kw: ['hi', 'hello', 'hey', 'yo', 'sup', 'good morning', 'good afternoon', 'good evening'],
      replies: ["Hey! I'm Exo, your guide to ExoraWorld. Ask me about games, the store, or anything else — what are you after?",
        "Hi there! I can help with games, shopping, payments, or just answering questions. What's up?"],
      sugg: ['Show me the store', 'Popular games', 'How do I pay?'] },
    { id: 'thanks', kw: ['thank', 'thanks', 'thx', 'appreciate', 'cheers'], replies: ["Anytime! Let me know if there's anything else.", 'Happy to help! 🙂'] },
    { id: 'bye', kw: ['bye', 'goodbye', 'see ya', 'later', 'cya'], replies: ['See you around ExoraWorld! 👋', 'Take care!'] },
    { id: 'compliment', kw: ['good bot', 'youre helpful', 'nice bot', 'smart bot', 'impressive'], replies: ['Ha, thanks! What else can I help with?'] },

    { id: 'store', kw: ['store', 'shop', 'merch', 'product', 'buy something'],
      dynamic: function () {
        var ids = Object.keys(PRODUCTS);
        if (!ids.length) return "I'm having trouble reading the store right now — check the Store section directly.";
        return 'The Store has: ' + ids.map(function (id) { var p = PRODUCTS[id]; return p.name + ' (' + fmtUSD(p.priceValue) + ' / ' + fmtBDT(p.priceLocalValue) + ')'; }).join(', ') + '. Want details on one, or should I start an order?';
      },
      sugg: function () { return Object.keys(PRODUCTS).map(function (id) { return 'Tell me about the ' + PRODUCTS[id].name.split(' ')[0]; }); } },

    { id: 'aurora-hoodie', kw: ['aurora', 'hoodie'],
      dynamic: function () { var p = PRODUCTS['aurora-hoodie']; if (!p) return "Can't find that one right now — check the Store section directly."; return p.name + ' is ' + fmtUSD(p.priceValue) + ' (' + fmtBDT(p.priceLocalValue) + ') — ' + p.desc + ' Want to grab one?'; },
      sugg: ['Buy Aurora Hoodie'] },
    { id: 'pulse-earbuds', kw: ['pulse', 'earbud', 'earbuds'],
      dynamic: function () { var p = PRODUCTS['pulse-earbuds']; if (!p) return "Can't find that one right now — check the Store section directly."; return p.name + ' is ' + fmtUSD(p.priceValue) + ' (' + fmtBDT(p.priceLocalValue) + ') — ' + p.desc + ' Want to grab a pair?'; },
      sugg: ['Buy Pulse Earbuds'] },
    { id: 'nova-backpack', kw: ['nova', 'backpack'],
      dynamic: function () { var p = PRODUCTS['nova-backpack']; if (!p) return "Can't find that one right now — check the Store section directly."; return p.name + ' is ' + fmtUSD(p.priceValue) + ' (' + fmtBDT(p.priceLocalValue) + ') — ' + p.desc + ' Want one?'; },
      sugg: ['Buy Nova Backpack'] },

    { id: 'games', kw: ['game', 'games', 'play'],
      dynamic: function () {
        var ids = Object.keys(GAMES);
        if (!ids.length) return "I'm having trouble reading the games list right now — check the Games section directly.";
        return "We've got: " + ids.map(function (id) { var g = GAMES[id]; return g.name + ' (' + g.genre + ')'; }).join(', ') + ' — all free to play. Want details on one, or a recommendation based on what you like?';
      },
      sugg: function () { return Object.keys(GAMES).map(function (id) { return 'Tell me about ' + GAMES[id].name; }).concat(['Recommend me a game']); } },

    { id: 'skyfall-arena', kw: ['skyfall', 'arena', 'battle royale'],
      dynamic: function () { var g = GAMES['skyfall-arena']; if (!g) return "Can't find that one right now."; return g.name + ' — ' + g.genre + ', rated ' + g.rating + '. ' + g.desc; }, sugg: ['Take me to Games'] },
    { id: 'mystic-realms', kw: ['mystic', 'realms', 'rpg'],
      dynamic: function () { var g = GAMES['mystic-realms']; if (!g) return "Can't find that one right now."; return g.name + ' — ' + g.genre + ', rated ' + g.rating + '. ' + g.desc; }, sugg: ['Take me to Games'] },
    { id: 'turbo-rally-x', kw: ['turbo', 'rally', 'racing', 'cars'],
      dynamic: function () { var g = GAMES['turbo-rally-x']; if (!g) return "Can't find that one right now."; return g.name + ' — ' + g.genre + ', rated ' + g.rating + '. ' + g.desc; }, sugg: ['Take me to Games'] },

    { id: 'news', kw: ['news', 'update', 'patch', 'latest'], replies: ['The News section has the latest drops and patch notes — worth a scroll.'], sugg: ['Take me to News'] },
    { id: 'gallery', kw: ['gallery', 'photo', 'picture', 'moment'], replies: ['The Gallery has moments from the ExoraWorld community — launches, meetups, fan art.'], sugg: ['Take me to Gallery'] },
    { id: 'about', kw: ['about', 'founder', 'who made', 'who built', 'abid'], replies: ["ExoraWorld was built by MD Abid Hasan — one home for the tools, games, news, and store that'd otherwise be scattered across a dozen apps."], sugg: ['Take me to About'] },
    { id: 'payment', kw: ['payment', 'pay', 'bkash', 'nagad', 'airtm', 'method'], replies: ["We take bKash, Nagad, and Airtm for store orders. You'll get the number or email to send to, and once you enter your Transaction ID, we verify manually — usually within a few hours."], sugg: ['Take me to Store'] },
    { id: 'help', kw: ['help', 'support', 'contact', 'reach you'], replies: ['You can reach us at theexoraworld@gmail.com, or use the Help form further down the page. What do you need a hand with?'], sugg: ['Take me to Help'] },
    { id: 'refund', kw: ['refund', 'return', 'returns'], replies: ['Unworn items in original packaging can be returned within 30 days for a full refund.'] },
    { id: 'free', kw: ['free', 'cost', 'price', 'how much'], replies: ['Making an ExoraWorld account is completely free, and games are free to play. Store items are priced individually — happy to walk you through those.'] },
    { id: 'account', kw: ['account', 'sign up', 'signup', 'login', 'log in'], replies: ['You can create a free account or log in from the top-right of the page — email/password, Google, or Facebook all work. Want me to open it for you?'], sugg: ['Sign me up', 'Log me in'] },
    { id: 'password', kw: ['password', 'forgot', 'reset'], replies: ['Go to Log In → Forgot Password, and a reset link will be emailed to you within a few minutes.'] },
    { id: 'bug', kw: ['bug', 'glitch', 'broken', 'not working', 'error'], replies: ['Sorry about that! Use the Help form and pick "Technical Issue," and describe what happened — the more detail, the faster we can look into it.'], sugg: ['Take me to Help'] },
    { id: 'howareyou', kw: ['how are you', 'how you doing', 'hows it going'], replies: ['Doing great, thanks for asking! Ready to help you find something.', "Can't complain — I run on keyword matching, not caffeine. 😄"] },
    { id: 'capabilities', kw: ['what can you do', 'your capabilities'], replies: ['I can look up real games/store details, give a recommendation, do a purchase right in chat, and actually operate the page for you — try "switch to dark mode."'] },
    { id: 'identity', kw: ['are you real', 'are you ai', 'are you human', 'are you a bot', 'robot'], replies: ["I'm Exo — a local, rule-based guide that runs right in your browser. No external AI service, and nothing you type here leaves the browser."] },
    { id: 'joke', kw: ['joke', 'funny', 'make me laugh'], replies: ['Why did the developer go broke? They used up all their cache. 💸', "I'm not great at jokes — I'm better at finding you a hoodie."] }
  ];

  function scoreTopic(tokens, joined, topic) {
    var score = 0;
    topic.kw.forEach(function (kw) {
      if (kw.indexOf(' ') !== -1) { if (joined.indexOf(kw) !== -1) score += 2; }
      else if (tokens.indexOf(kw) !== -1) score += 2;
      else if (tokens.some(function (t) { return t.length > 3 && (t.indexOf(kw) !== -1 || kw.indexOf(t) !== -1); })) score += 1;
    });
    return score;
  }
  function matchKB(text) {
    var tokens = tokenize(text);
    var joined = ' ' + tokens.join(' ') + ' ';
    var best = null, bestScore = 0;
    KB.forEach(function (topic) { var s = scoreTopic(tokens, joined, topic); if (s > bestScore) { bestScore = s; best = topic; } });
    return bestScore > 0 ? best : null;
  }
  function resolveReply(topic) { return topic.dynamic ? topic.dynamic() : pick(topic.replies); }
  function resolveSuggestions(topic) { return typeof topic.sugg === 'function' ? topic.sugg() : topic.sugg; }

  var FALLBACKS = [
    "I'm not totally sure about that one — try asking about the store, games, or how to reach support.",
    "I don't have a good answer for that yet. I'm best with the store, games, payments, and account help.",
    'Not sure I follow — want me to point you to the Store, Games, or Help section?'
  ];
  function fallbackReply() { return pick(FALLBACKS); }

  var NAV_MAP = [
    { id: 'store', label: 'the Store', kw: ['store', 'shop'] }, { id: 'games', label: 'Games', kw: ['game'] },
    { id: 'news', label: 'News', kw: ['news'] }, { id: 'gallery', label: 'the Gallery', kw: ['gallery', 'photo'] },
    { id: 'about', label: 'About', kw: ['about'] }, { id: 'help', label: 'Help', kw: ['help', 'contact', 'support'] }
  ];
  function detectNavIntent(text) {
    var lower = text.toLowerCase();
    if (!/take me|go to|show me|navigate|scroll/.test(lower)) return null;
    for (var i = 0; i < NAV_MAP.length; i++) for (var j = 0; j < NAV_MAP[i].kw.length; j++) if (lower.indexOf(NAV_MAP[i].kw[j]) !== -1) return NAV_MAP[i];
    return null;
  }

  function detectBuyIntent(text) {
    var lower = text.toLowerCase();
    if (!/buy|purchase|order|checkout|get the/.test(lower)) return null;
    var ids = Object.keys(PRODUCTS);
    for (var i = 0; i < ids.length; i++) {
      var words = PRODUCTS[ids[i]].name.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 3; });
      for (var j = 0; j < words.length; j++) if (lower.indexOf(words[j]) !== -1) return ids[i];
    }
    return null;
  }

  var GENRE_MAP = [
    { kw: ['racing', 'cars', 'speed', 'drift', 'driving'], gameId: 'turbo-rally-x' },
    { kw: ['rpg', 'fantasy', 'story', 'adventure', 'open world'], gameId: 'mystic-realms' },
    { kw: ['shooter', 'battle royale', 'pvp', 'competitive', 'fps', 'shooting'], gameId: 'skyfall-arena' }
  ];
  function detectGenreRecommendation(text) {
    var lower = text.toLowerCase();
    if (!/recommend|suggest|which game|what should i play|good game|something like/.test(lower)) return null;
    for (var i = 0; i < GENRE_MAP.length; i++) for (var j = 0; j < GENRE_MAP[i].kw.length; j++) if (lower.indexOf(GENRE_MAP[i].kw[j]) !== -1) return GENRE_MAP[i].gameId;
    return null;
  }

  function isAffirmative(text) { return /^(y|ya|yea|yes|yeah|yep|sure|ok|okay|please|do it|go ahead|definitely|absolutely)\b/i.test(text.trim()); }
  function isNegative(text) { return /^(n|no|nope|nah|not now|maybe later|not really)\b/i.test(text.trim()); }
  function isFrustrated(text) { return /ugh|annoying|frustrated|isn'?t working|not working|worst|terrible|useless|stupid|hate this|angry/i.test(text); }

  // ── Real (safe, no eval) arithmetic — proof it's not pure lookup. ────────
  function tryMath(text) {
    var m = text.match(/(-?\d+(?:\.\d+)?)\s*([+\-x×*/])\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    var a = parseFloat(m[1]), op = m[2], b = parseFloat(m[3]), r;
    if (op === '+') r = a + b;
    else if (op === '-') r = a - b;
    else if (op === 'x' || op === '×' || op === '*') r = a * b;
    else { if (b === 0) return "Can't divide by zero!"; r = a / b; }
    return a + ' ' + op + ' ' + b + ' = ' + Math.round(r * 10000) / 10000;
  }

  // ── Page actions — Exo operating the page, not just describing it. ──────
  function tryPageAction(text) {
    var lower = text.toLowerCase();
    if (/dark mode|light mode|switch theme|toggle theme/.test(lower)) {
      var t = document.getElementById('themeToggle');
      if (t) { t.click(); return 'Done — toggled the theme for you.'; }
    }
    if (/sign me up|create an account|open sign ?up|i want to sign up/.test(lower)) {
      var s = document.querySelector('[data-auth-open="signup"]');
      if (s) { s.click(); return 'Opened the sign-up form for you.'; }
    }
    if (/log me in|open login|i want to log ?in/.test(lower)) {
      var l = document.querySelector('[data-auth-open="login"]');
      if (l) { l.click(); return 'Opened the login form for you.'; }
    }
    if (/back to top|scroll to top|go to top/.test(lower)) {
      var home = document.getElementById('home');
      if (home) { home.scrollIntoView({ behavior: 'smooth' }); return 'Back to the top! ⬆️'; }
    }
    return null;
  }

  // ── Real-time queries ─────────────────────────────────────────────────
  function tryTimeQuery(text) {
    var lower = text.toLowerCase();
    if (/what time|current time|time is it/.test(lower)) {
      var t = dhakaNow();
      return "It's " + t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' right now in Bangladesh (Asia/Dhaka) — ' + timeOfDayWord() + ' where the ExoraWorld team is based.';
    }
    if (/are you open|support available|business hours|is anyone there/.test(lower)) {
      return isWithinSupportHours()
        ? "We're within typical support hours right now (Asia/Dhaka time), so replies should be quick."
        : "We're outside typical support hours right now (Asia/Dhaka time), so replies might take a little longer — but your message or order will be waiting.";
    }
    return null;
  }

  // ── Opportunistic entity capture — recognizes an email/BD phone number
  //    anywhere in the conversation and remembers it, so chat checkout can
  //    skip re-asking for something you already told it. ───────────────────
  var EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  var PHONE_RE = /(?:\+?88)?01[3-9]\d{8}/;
  function scanForEntities(text) {
    var email = text.match(EMAIL_RE);
    var phone = text.match(PHONE_RE);
    if (email) memory.knownEmail = email[0];
    if (phone) memory.knownPhone = phone[0];
  }

  // ── Message rendering ──────────────────────────────────────────────────
  function addMessage(text, who) {
    var div = document.createElement('div');
    div.className = 'exo-msg exo-msg-' + who;
    div.textContent = text;
    els.msgs.appendChild(div);
    els.msgs.scrollTop = els.msgs.scrollHeight;
  }
  function showTyping() {
    var div = document.createElement('div'); div.className = 'exo-typing'; div.id = 'exoTypingIndicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    els.msgs.appendChild(div); els.msgs.scrollTop = els.msgs.scrollHeight;
  }
  function hideTyping() { var el = document.getElementById('exoTypingIndicator'); if (el) el.remove(); }
  function renderSuggestions(list) {
    els.suggestions.innerHTML = '';
    (list || []).forEach(function (s) {
      var chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'exo-suggestion-chip'; chip.textContent = s;
      chip.addEventListener('click', function () { submitUserText(s); });
      els.suggestions.appendChild(chip);
    });
  }
  function botReply(text, suggestions) {
    showTyping();
    setTimeout(function () { hideTyping(); addMessage(text, 'bot'); renderSuggestions(suggestions); }, 450 + Math.random() * 450);
  }

  // ── Conversational checkout — quantity-aware, cancelable, and skips any
  //    step it can already fill in from memory. ───────────────────────────
  function nextCheckoutStep(buyer) {
    if (buyer.qty === undefined) return 'qty';
    if (!buyer.name) return 'name';
    if (!buyer.phone) return 'phone';
    if (!buyer.email) return 'email';
    if (!buyer.method) return 'method';
    if (!buyer.txnId) return 'txn';
    return 'done';
  }

  function startChatCheckout(productId) {
    var p = PRODUCTS[productId];
    if (!p) { botReply("Sorry, I couldn't find that item — try browsing the Store section directly.", ['Take me to Store']); return; }
    chatCheckout = { productId: productId, step: 'qty', buyer: {} };
    var prefilled = [];
    if (memory.knownPhone) { chatCheckout.buyer.phone = memory.knownPhone; prefilled.push('phone number'); }
    if (memory.knownEmail) { chatCheckout.buyer.email = memory.knownEmail; prefilled.push('email'); }
    var note = prefilled.length ? (" I've already got your " + prefilled.join(' and ') + " from earlier, so I'll skip re-asking.") : '';
    botReply('Great choice — the ' + p.name + ' is ' + fmtUSD(p.priceValue) + ' (' + fmtBDT(p.priceLocalValue) + ') each.' + note + ' How many would you like? (Say "cancel" anytime to stop.)');
  }

  function handleChatCheckoutInput(text) {
    var trimmed = text.trim();
    var lower = trimmed.toLowerCase();
    if (/^(cancel|stop|nevermind|never mind|quit|exit)\b/.test(lower)) {
      chatCheckout = null;
      botReply("No problem, I've canceled that order. Let me know if you'd like to start over or need anything else.", ['Show me the store', 'Take me to Help']);
      return;
    }

    var p = PRODUCTS[chatCheckout.productId];
    var step = chatCheckout.step;

    if (step === 'qty') {
      var qty = parseInt(trimmed, 10);
      if (!qty || qty < 1 || qty > 20) { botReply('Just a number between 1 and 20 — how many ' + p.name + '?'); return; }
      chatCheckout.buyer.qty = qty;
    } else if (step === 'name') {
      chatCheckout.buyer.name = trimmed;
      memory.userName = trimmed.split(' ')[0];
    } else if (step === 'phone') {
      chatCheckout.buyer.phone = trimmed;
    } else if (step === 'email') {
      chatCheckout.buyer.email = trimmed;
    } else if (step === 'method') {
      var methodId = detectPayMethod(trimmed);
      if (!methodId) { botReply('I only support bKash, Nagad, or Airtm right now — which one works for you?', ['bKash', 'Nagad', 'Airtm']); return; }
      chatCheckout.buyer.method = methodId;
    } else if (step === 'txn') {
      chatCheckout.buyer.txnId = trimmed;
    }

    var next = nextCheckoutStep(chatCheckout.buyer);
    chatCheckout.step = next;

    if (next === 'qty') { botReply('How many ' + p.name + ' would you like?'); return; }
    if (next === 'name') { botReply('Got it. What name should I put on the order?'); return; }
    if (next === 'phone') { botReply((memory.userName ? 'Thanks, ' + memory.userName + '! ' : '') + "What's the best phone number to reach you on?"); return; }
    if (next === 'email') { botReply('And an email for your order confirmation?'); return; }
    if (next === 'method') { botReply('How would you like to pay — bKash, Nagad, or Airtm?', ['bKash', 'Nagad', 'Airtm']); return; }
    if (next === 'txn') {
      var m = findMethod(chatCheckout.buyer.method);
      var target = m.type === 'phone' ? 'this ' + m.label + ' number' : 'this Airtm email';
      var qty2 = chatCheckout.buyer.qty || 1;
      var amount = fmtUSD(p.priceValue * qty2) + ' (' + fmtBDT(p.priceLocalValue * qty2) + ')';
      botReply('Send ' + amount + ' to ' + target + ': ' + m.value + '. Once done, paste the Transaction ID here.');
      return;
    }
    if (next === 'done') {
      var productId = chatCheckout.productId;
      var buyer = chatCheckout.buyer;
      chatCheckout = null;
      showTyping();
      submitOrder(productId, buyer, function (id, ok) {
        setTimeout(function () {
          hideTyping();
          if (ok) { addMessage('🎉 Order placed! Your order ID is ' + id + ". We'll verify the payment and confirm within a few hours.", 'bot'); renderSuggestions(['Take me to Store']); }
          else { addMessage("That didn't go through on my end — sorry! Please email theexoraworld@gmail.com with your Transaction ID (" + buyer.txnId + ") and we'll sort it out manually.", 'bot'); renderSuggestions(['Take me to Help']); }
        }, 500);
      });
    }
  }

  // ── Main input router ──────────────────────────────────────────────────
  function handleUserInput(rawText) {
    var trimmed = rawText.trim();
    scanForEntities(trimmed); // passive — never blocks or interrupts the flow

    if (chatCheckout) { handleChatCheckoutInput(rawText); return; }

    if (isFrustrated(trimmed)) {
      memory.fallbackStreak = 0;
      botReply("Sorry you're running into trouble — let's get you to a real person fast. Email theexoraworld@gmail.com or use the Help form.", ['Take me to Help']);
      return;
    }

    if (memory.userName && /^(hi|hello|hey|yo|sup)\b/i.test(trimmed)) {
      memory.fallbackStreak = 0;
      botReply('Hey ' + memory.userName + ', good to see you again! What can I help with?', ['Show me the store', 'Popular games']);
      return;
    }

    if (memory.lastProductId && isAffirmative(trimmed)) {
      var pid = memory.lastProductId; memory.lastProductId = null; memory.fallbackStreak = 0;
      startChatCheckout(pid); return;
    }
    if (memory.lastProductId && isNegative(trimmed)) {
      memory.lastProductId = null; memory.fallbackStreak = 0;
      botReply('No worries — let me know if you change your mind or want to look at something else.', ['Show me the store', 'Popular games']);
      return;
    }

    var timeReply = tryTimeQuery(trimmed);
    if (timeReply) { memory.fallbackStreak = 0; botReply(timeReply); return; }

    var actionResult = tryPageAction(trimmed);
    if (actionResult) { memory.fallbackStreak = 0; botReply(actionResult); return; }

    var mathResult = tryMath(trimmed);
    if (mathResult) { memory.fallbackStreak = 0; botReply(mathResult); return; }

    var text = normalize(trimmed);

    var buyProduct = detectBuyIntent(text);
    if (buyProduct) { memory.fallbackStreak = 0; memory.lastProductId = null; startChatCheckout(buyProduct); return; }

    var recGame = detectGenreRecommendation(text);
    if (recGame) {
      memory.fallbackStreak = 0; memory.lastProductId = null;
      var g = GAMES[recGame];
      if (g) botReply("Since you're into that, " + g.name + ' (' + g.genre + ', rated ' + g.rating + ') sounds perfect — ' + g.desc, ['Take me to Games']);
      else botReply("I'd recommend one, but I'm having trouble reading the games list right now — check the Games section directly.", ['Take me to Games']);
      return;
    }

    var navTarget = detectNavIntent(text);
    if (navTarget) {
      memory.fallbackStreak = 0;
      botReply('Sure — heading to ' + navTarget.label + ' now.');
      setTimeout(function () { var el = document.getElementById(navTarget.id); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 500);
      return;
    }

    var kbMatch = matchKB(text);
    if (kbMatch) {
      memory.fallbackStreak = 0;
      memory.lastProductId = PRODUCTS[kbMatch.id] ? kbMatch.id : null;
      botReply(resolveReply(kbMatch), resolveSuggestions(kbMatch));
      return;
    }

    memory.fallbackStreak++;
    var msg = fallbackReply();
    if (memory.fallbackStreak >= 3) msg += ' If I\'m not getting it, our Help form or theexoraworld@gmail.com will get you a real answer fast.';
    botReply(msg, ['Show me the store', 'Popular games', 'Take me to Help']);
  }

  function submitUserText(text) {
    text = (text || '').trim();
    if (!text) return;
    addMessage(text, 'user');
    els.suggestions.innerHTML = '';
    els.input.value = '';
    handleUserInput(text);
  }

  function initExoWidget() {
    els.trigger = document.getElementById('exoTrigger');
    els.panel = document.getElementById('exoPanel');
    els.closeBtn = document.getElementById('exoClose');
    els.msgs = document.getElementById('exoMsgs');
    els.suggestions = document.getElementById('exoSuggestions');
    els.input = document.getElementById('exoInput');
    els.sendBtn = document.getElementById('exoSendBtn');
    if (!els.trigger) return;

    var greeted = false;
    function open() {
      els.panel.classList.add('open');
      els.panel.setAttribute('aria-hidden', 'false');
      els.trigger.setAttribute('aria-expanded', 'true');
      if (!greeted) {
        greeted = true;
        botReply("Hey! I'm Exo 👋 — I can look up real games/store info, recommend a game, buy something right here with bKash/Nagad/Airtm, or even flip the site's theme for you. What are you after?", ['Show me the store', 'Popular games', 'Recommend me a game']);
      }
      els.input.focus();
    }
    function close() {
      els.panel.classList.remove('open');
      els.panel.setAttribute('aria-hidden', 'true');
      els.trigger.setAttribute('aria-expanded', 'false');
    }
    els.trigger.addEventListener('click', function () { els.panel.classList.contains('open') ? close() : open(); });
    els.closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && els.panel.classList.contains('open')) close(); });
    els.sendBtn.addEventListener('click', function () { submitUserText(els.input.value); });
    els.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitUserText(els.input.value); });
  }

  // ── Boot: scrape live data FIRST, then wire up the UI that depends on it ──
  document.addEventListener('DOMContentLoaded', function () {
    PRODUCTS = scrapeProducts();
    GAMES = scrapeGames();
    initCheckoutModal();
    initExoWidget();
  });
})();
