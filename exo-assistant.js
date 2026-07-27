/* ════════════════════════════════════════════════════════════
   EXORAWORLD — Exo Assistant + Checkout Engine (v2)
   Still no external AI API, by design — this is a deliberately
   local, rule-based system: tokenized keyword scoring against a
   knowledge base, conversation memory, and a scripted checkout
   state machine. "Smarter" here means better matching and a much
   larger knowledge base, not a call to a cloud LLM.

   One checkout engine (submitOrder + product/payment data) is
   shared by two front ends:
     1. The "Buy Now" modal (#checkoutModal) — quick, single item
     2. Exo's in-chat conversational checkout — supports quantity,
        cancel-anytime, and remembers context between messages

   Local payment methods only: bKash, Nagad, Airtm.
   Orders post to the same Formspree endpoint as the contact form.
   ════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/maqaprqk';

  // ── Products (mirrors the Store section cards). Numeric values so chat
  //    checkout can do real quantity math; fmtUSD/fmtBDT format for display. ──
  var PRODUCTS = {
    'aurora-hoodie': { name: 'Aurora Hoodie', priceValue: 58, priceLocalValue: 6500, icon: '👕', gradient: 'grad-1', desc: 'Soft fleece-lined hoodie with reflective ExoraWorld branding, built for late-night sessions.' },
    'pulse-earbuds': { name: 'Pulse Earbuds X2', priceValue: 89, priceLocalValue: 9950, icon: '🎧', gradient: 'grad-2', desc: 'Low-latency wireless earbuds tuned for gaming, with 30-hour total battery life.' },
    'nova-backpack': { name: 'Nova Backpack Pro', priceValue: 74, priceLocalValue: 8300, icon: '🎒', gradient: 'grad-3', desc: 'Weatherproof backpack with a padded laptop sleeve and reflective accent strip.' }
  };
  function fmtUSD(n) { return '$' + n.toFixed(2); }
  function fmtBDT(n) { return '৳' + Math.round(n).toLocaleString('en-US'); }

  // ── Games — not purchasable, but Exo can talk about them individually now. ──
  var GAMES = {
    'skyfall-arena': { name: 'Skyfall Arena', genre: 'Battle Royale', rating: '4.8', desc: 'Drop into a shrinking sky-island battlefield with up to 60 players.' },
    'mystic-realms': { name: 'Mystic Realms', genre: 'Fantasy RPG', rating: '4.9', desc: 'Forge your legend across five realms in this sprawling open-world RPG.' },
    'turbo-rally-x': { name: 'Turbo Rally X', genre: 'Racing', rating: '4.6', desc: 'High-octane rally racing across fully destructible tracks.' }
  };

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

  // ── Shared order submission ──────────────────────────────────────────────
  function makeOrderId() {
    return 'EXO-' + Date.now().toString(36).toUpperCase().slice(-6);
  }

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
      submitted_at: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }) + ' (Asia/Dhaka)'
    };
    fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (onDone) onDone(id, res.ok);
    }).catch(function () {
      if (onDone) onDone(id, false);
    });
    return id;
  }

  /* ════════════════════════════════════════════════════════════
     CHECKOUT MODAL — the quick, single-item "Buy Now" front end.
     Chat checkout (below) is the fuller experience with quantity
     and cancel support; the modal stays intentionally simple.
     ════════════════════════════════════════════════════════════ */
  function initCheckoutModal() {
    var overlay  = document.getElementById('checkoutModal');
    if (!overlay) return;
    var closeBtn  = document.getElementById('checkoutClose');
    var summary   = document.getElementById('checkoutProductSummary');
    var step1     = document.getElementById('checkoutStep1');
    var step2     = document.getElementById('checkoutStep2');
    var step3     = document.getElementById('checkoutStep3');
    var step2Form = document.getElementById('checkoutStep2Form');
    var tabs      = document.getElementById('payMethodTabs');
    var instructionsEl = document.getElementById('payInstructions');
    var backBtn   = document.getElementById('checkoutBack');
    var doneBtn   = document.getElementById('checkoutDone');
    var dots      = overlay.querySelectorAll('.checkout-step-dot');

    var state = { productId: null, method: PAY_METHODS[0].id };

    function setDots(n) {
      dots.forEach(function (d, i) {
        d.classList.toggle('active', i === n - 1);
        d.classList.toggle('done', i < n - 1);
      });
    }
    function showStep(n) {
      step1.hidden = n !== 1;
      step2.hidden = n !== 2;
      step3.hidden = n !== 3;
      setDots(n);
    }

    function renderTabs() {
      tabs.innerHTML = PAY_METHODS.map(function (m) {
        return '<button type="button" class="pay-method-tab' + (m.id === state.method ? ' active' : '') + '" data-method="' + m.id + '">' + m.label + '</button>';
      }).join('');
      tabs.querySelectorAll('.pay-method-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.method = btn.dataset.method;
          renderTabs();
          renderInstructions();
        });
      });
    }

    function renderInstructions() {
      var m = findMethod(state.method);
      var p = PRODUCTS[state.productId];
      instructionsEl.innerHTML =
        '<p>' + m.hint + '</p>' +
        '<div class="pay-value-box"><span>' + m.value + '</span><button type="button" class="copy-btn" id="payCopyBtn">Copy</button></div>' +
        '<p style="margin-top:0.85rem;margin-bottom:0">Amount to send: <strong>' + fmtUSD(p.priceValue) + ' (' + fmtBDT(p.priceLocalValue) + ')</strong></p>';
      document.getElementById('payCopyBtn').addEventListener('click', function () {
        var btn = this;
        navigator.clipboard.writeText(m.value).then(function () {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
        });
      });
    }

    window.openCheckout = function (productId) {
      var p = PRODUCTS[productId];
      if (!p) return;
      state.productId = productId;
      state.method = PAY_METHODS[0].id;
      summary.innerHTML =
        '<span class="checkout-product-icon ' + p.gradient + '">' + p.icon + '</span>' +
        '<div class="checkout-product-info"><h4>' + p.name + '</h4>' +
        '<span class="price-block"><span class="price">' + fmtUSD(p.priceValue) + '</span><span class="price-local">' + fmtBDT(p.priceLocalValue) + '</span></span></div>';
      step1.reset();
      step2Form.reset();
      showStep(1);
      renderTabs();
      renderInstructions();
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
        method: state.method,
        txnId: txnId
      };
      var btn = step2Form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Submitting…';
      submitOrder(state.productId, buyer, function (id, ok) {
        btn.disabled = false; btn.textContent = 'Submit Order';
        if (ok) {
          document.getElementById('checkoutOrderId').textContent = id;
          showStep(3);
        } else {
          var errBox = document.getElementById('checkoutOrderError');
          if (!errBox) {
            errBox = document.createElement('div');
            errBox.id = 'checkoutOrderError';
            errBox.className = 'auth-error';
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
  var chatCheckout = null; // null, or { productId, step, buyer:{} }
  var memory = { lastTopicId: null, lastProductId: null, userName: null, fallbackStreak: 0 };

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ── Light typo/slang normalization — applied before matching, never to
  //    free-text answers like names during checkout. ──────────────────────
  var TYPO_MAP = {
    'gmae': 'game', 'gams': 'games', 'stoer': 'store', 'strore': 'store',
    'pyament': 'payment', 'paymnet': 'payment', 'nagade': 'nagad',
    'wat': 'what', 'hw': 'how', 'hlp': 'help', 'plz': 'please', 'pls': 'please',
    'u': 'you', 'ur': 'your', 'thx': 'thanks', 'recieve': 'receive', 'definately': 'definitely'
  };
  function normalize(text) {
    return text.split(/\s+/).map(function (w) {
      var clean = w.toLowerCase().replace(/[^a-z]/g, '');
      return TYPO_MAP[clean] || w;
    }).join(' ');
  }

  function tokenize(text) {
    return text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  }

  // ── Knowledge base — each topic scores against the message; best score
  //    wins. Multi-word keywords (e.g. "how much") match as phrases. Every
  //    topic has multiple reply variants so repeat questions don't feel
  //    robotic. ──────────────────────────────────────────────────────────
  var KB = [
    { id: 'greet', kw: ['hi', 'hello', 'hey', 'yo', 'sup', 'good morning', 'good afternoon', 'good evening'],
      replies: ["Hey! I'm Exo, your guide to ExoraWorld. Ask me about games, the store, or anything else — what are you after?",
        "Hi there! I can help with games, shopping, payments, or just answering questions. What's up?",
        "Hey, welcome! Tell me what you're looking for and I'll point you the right way."],
      sugg: ['Show me the store', 'Popular games', 'How do I pay?'] },

    { id: 'thanks', kw: ['thank', 'thanks', 'thx', 'appreciate', 'cheers'],
      replies: ["Anytime! Let me know if there's anything else.", 'Happy to help! 🙂', 'Of course — that\'s what I\'m here for.'] },

    { id: 'bye', kw: ['bye', 'goodbye', 'see ya', 'later', 'cya'],
      replies: ['See you around ExoraWorld! 👋', 'Take care!', 'Catch you later!'] },

    { id: 'compliment', kw: ['good bot', 'youre helpful', 'nice bot', 'smart bot', 'impressive', 'cool bot'],
      replies: ['Ha, thanks! I try. What else can I help with?', 'Appreciate that — what else do you need?'] },

    { id: 'store', kw: ['store', 'shop', 'merch', 'product', 'buy something'],
      replies: ["The Store has three things right now: Aurora Hoodie ($58 / ৳6,500), Pulse Earbuds X2 ($89 / ৳9,950), and Nova Backpack Pro ($74 / ৳8,300). Want details on one, or should I start an order?"],
      sugg: ['Tell me about the hoodie', 'Tell me about the earbuds', 'Tell me about the backpack'] },

    { id: 'aurora-hoodie', kw: ['aurora', 'hoodie'],
      replies: ['The Aurora Hoodie is $58 (৳6,500) — soft fleece-lined, with reflective ExoraWorld branding for late-night sessions. Want to grab one?'],
      sugg: ['Buy Aurora Hoodie'] },

    { id: 'pulse-earbuds', kw: ['pulse', 'earbud', 'earbuds'],
      replies: ['Pulse Earbuds X2 are $89 (৳9,950) — low-latency, gaming-tuned, 30-hour total battery life. Want to grab a pair?'],
      sugg: ['Buy Pulse Earbuds'] },

    { id: 'nova-backpack', kw: ['nova', 'backpack'],
      replies: ['Nova Backpack Pro is $74 (৳8,300) — weatherproof, padded laptop sleeve, reflective accent strip. Want one?'],
      sugg: ['Buy Nova Backpack'] },

    { id: 'games', kw: ['game', 'games', 'play'],
      replies: ["We've got three: Skyfall Arena (battle royale), Mystic Realms (fantasy RPG), and Turbo Rally X (racing) — all free to play. Want details on one, or a recommendation based on what you like?"],
      sugg: ['Tell me about Skyfall Arena', 'Tell me about Mystic Realms', 'Recommend me a game'] },

    { id: 'skyfall-arena', kw: ['skyfall', 'arena', 'battle royale'],
      replies: ['Skyfall Arena — battle royale, rated 4.8. Drop into a shrinking sky-island battlefield with up to 60 players.'],
      sugg: ['Take me to Games'] },

    { id: 'mystic-realms', kw: ['mystic', 'realms', 'rpg'],
      replies: ['Mystic Realms — fantasy RPG, rated 4.9. Forge your legend across five realms in a sprawling open world.'],
      sugg: ['Take me to Games'] },

    { id: 'turbo-rally-x', kw: ['turbo', 'rally', 'racing', 'cars'],
      replies: ['Turbo Rally X — racing, rated 4.6. High-octane rally racing across fully destructible tracks.'],
      sugg: ['Take me to Games'] },

    { id: 'news', kw: ['news', 'update', 'patch', 'latest'], replies: ['The News section has the latest drops and patch notes — worth a scroll.'], sugg: ['Take me to News'] },

    { id: 'gallery', kw: ['gallery', 'photo', 'picture', 'moment'], replies: ['The Gallery has moments from the ExoraWorld community — launches, meetups, fan art.'], sugg: ['Take me to Gallery'] },

    { id: 'about', kw: ['about', 'founder', 'who made', 'who built', 'abid'],
      replies: ["ExoraWorld was built by MD Abid Hasan — one home for the tools, games, news, and store that'd otherwise be scattered across a dozen apps."],
      sugg: ['Take me to About'] },

    { id: 'payment', kw: ['payment', 'pay', 'bkash', 'nagad', 'airtm', 'method'],
      replies: ["We take bKash, Nagad, and Airtm for store orders. You'll get the number or email to send to, and once you enter your Transaction ID, we verify manually — usually within a few hours."],
      sugg: ['Take me to Store'] },

    { id: 'order-status', kw: ['verify', 'verification', 'confirm my order', 'waiting for my order'],
      replies: ["Orders are verified manually, typically within a few hours of you submitting your Transaction ID. If it's been longer than that, email theexoraworld@gmail.com with your order ID."] },

    { id: 'help', kw: ['help', 'support', 'contact', 'reach you'],
      replies: ['You can reach us at theexoraworld@gmail.com, or use the Help form further down the page. What do you need a hand with?'],
      sugg: ['Take me to Help'] },

    { id: 'refund', kw: ['refund', 'return', 'returns'], replies: ['Unworn items in original packaging can be returned within 30 days for a full refund.'] },

    { id: 'free', kw: ['free', 'cost', 'price', 'how much'],
      replies: ['Making an ExoraWorld account is completely free, and games are free to play. Store items are priced individually — happy to walk you through those.'] },

    { id: 'account', kw: ['account', 'sign up', 'signup', 'login', 'log in'],
      replies: ['You can create a free account or log in from the top-right of the page — email/password, Google, or Facebook all work.'] },

    { id: 'password', kw: ['password', 'forgot', 'reset'],
      replies: ['Go to Log In → Forgot Password, and a reset link will be emailed to you within a few minutes.'] },

    { id: 'bug', kw: ['bug', 'glitch', 'broken', 'not working', 'error'],
      replies: ['Sorry about that! Use the Help form and pick "Technical Issue," and describe what happened — the more detail, the faster we can look into it.'],
      sugg: ['Take me to Help'] },

    { id: 'howareyou', kw: ['how are you', 'how you doing', 'hows it going'],
      replies: ['Doing great, thanks for asking! Ready to help you find something — games, gear, or answers.',
        "Can't complain — I run on keyword matching, not caffeine. 😄 What can I help with?"] },

    { id: 'capabilities', kw: ['what can you do', 'your capabilities', 'help me with what'],
      replies: ["I can point you to games or store items, give a recommendation, answer questions about ExoraWorld, and walk you through a purchase right here in chat — quantity, payment method, transaction ID, all of it."] },

    { id: 'identity', kw: ['are you real', 'are you ai', 'are you human', 'are you a bot', 'robot'],
      replies: ["I'm Exo — a built-in guide that runs right here in your browser. I'm not a large language model, just careful keyword matching with a bit of personality. Nothing you type here gets sent to an external AI service."] },

    { id: 'joke', kw: ['joke', 'funny', 'make me laugh'],
      replies: ['Why did the developer go broke? They used up all their cache. 💸',
        "I'd tell you a networking joke, but 3 out of 4 people don't get it.",
        "I'm not great at jokes — I'm better at finding you a hoodie."] }
  ];

  function scoreTopic(tokens, joined, topic) {
    var score = 0;
    topic.kw.forEach(function (kw) {
      if (kw.indexOf(' ') !== -1) {
        if (joined.indexOf(kw) !== -1) score += 2;
      } else if (tokens.indexOf(kw) !== -1) {
        score += 2;
      } else if (tokens.some(function (t) { return t.length > 3 && (t.indexOf(kw) !== -1 || kw.indexOf(t) !== -1); })) {
        score += 1;
      }
    });
    return score;
  }
  function matchKB(text) {
    var tokens = tokenize(text);
    var joined = ' ' + tokens.join(' ') + ' ';
    var best = null, bestScore = 0;
    KB.forEach(function (topic) {
      var s = scoreTopic(tokens, joined, topic);
      if (s > bestScore) { bestScore = s; best = topic; }
    });
    return bestScore > 0 ? best : null;
  }

  var FALLBACKS = [
    "I'm not totally sure about that one — try asking about the store, games, or how to reach support.",
    "I don't have a good answer for that yet. I'm best with questions about ExoraWorld's store, games, payments, and account help.",
    'Not sure I follow — want me to point you to the Store, Games, or Help section?'
  ];
  function fallbackReply() { return pick(FALLBACKS); }

  var NAV_MAP = [
    { id: 'store', label: 'the Store', kw: ['store', 'shop'] },
    { id: 'games', label: 'Games', kw: ['game'] },
    { id: 'news', label: 'News', kw: ['news'] },
    { id: 'gallery', label: 'the Gallery', kw: ['gallery', 'photo'] },
    { id: 'about', label: 'About', kw: ['about'] },
    { id: 'help', label: 'Help', kw: ['help', 'contact', 'support'] }
  ];
  function detectNavIntent(text) {
    var lower = text.toLowerCase();
    if (!/take me|go to|show me|navigate|scroll/.test(lower)) return null;
    for (var i = 0; i < NAV_MAP.length; i++) {
      for (var j = 0; j < NAV_MAP[i].kw.length; j++) {
        if (lower.indexOf(NAV_MAP[i].kw[j]) !== -1) return NAV_MAP[i];
      }
    }
    return null;
  }

  var BUY_MAP = [
    { id: 'aurora-hoodie', kw: ['hoodie', 'aurora'] },
    { id: 'pulse-earbuds', kw: ['earbud', 'pulse'] },
    { id: 'nova-backpack', kw: ['backpack', 'nova'] }
  ];
  function detectBuyIntent(text) {
    var lower = text.toLowerCase();
    if (!/buy|purchase|order|checkout|get the/.test(lower)) return null;
    for (var i = 0; i < BUY_MAP.length; i++) {
      for (var j = 0; j < BUY_MAP[i].kw.length; j++) {
        if (lower.indexOf(BUY_MAP[i].kw[j]) !== -1) return BUY_MAP[i].id;
      }
    }
    return null;
  }

  // ── Genre-based recommendation — a small step toward "reasoning" rather
  //    than pure lookup: maps a stated preference to a specific game. ──────
  var GENRE_MAP = [
    { kw: ['racing', 'cars', 'speed', 'drift', 'driving'], gameId: 'turbo-rally-x' },
    { kw: ['rpg', 'fantasy', 'story', 'adventure', 'open world'], gameId: 'mystic-realms' },
    { kw: ['shooter', 'battle royale', 'pvp', 'competitive', 'fps', 'shooting'], gameId: 'skyfall-arena' }
  ];
  function detectGenreRecommendation(text) {
    var lower = text.toLowerCase();
    if (!/recommend|suggest|which game|what should i play|good game|something like/.test(lower)) return null;
    for (var i = 0; i < GENRE_MAP.length; i++) {
      for (var j = 0; j < GENRE_MAP[i].kw.length; j++) {
        if (lower.indexOf(GENRE_MAP[i].kw[j]) !== -1) return GENRE_MAP[i].gameId;
      }
    }
    return null;
  }

  function isAffirmative(text) { return /^(y|ya|yea|yes|yeah|yep|sure|ok|okay|please|do it|go ahead|definitely|absolutely)\b/i.test(text.trim()); }
  function isNegative(text) { return /^(n|no|nope|nah|not now|maybe later|not really)\b/i.test(text.trim()); }

  // ── Message rendering ──────────────────────────────────────────────────
  function addMessage(text, who) {
    var div = document.createElement('div');
    div.className = 'exo-msg exo-msg-' + who;
    div.textContent = text;
    els.msgs.appendChild(div);
    els.msgs.scrollTop = els.msgs.scrollHeight;
  }
  function showTyping() {
    var div = document.createElement('div');
    div.className = 'exo-typing';
    div.id = 'exoTypingIndicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    els.msgs.appendChild(div);
    els.msgs.scrollTop = els.msgs.scrollHeight;
  }
  function hideTyping() {
    var el = document.getElementById('exoTypingIndicator');
    if (el) el.remove();
  }
  function renderSuggestions(list) {
    els.suggestions.innerHTML = '';
    (list || []).forEach(function (s) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'exo-suggestion-chip';
      chip.textContent = s;
      chip.addEventListener('click', function () { submitUserText(s); });
      els.suggestions.appendChild(chip);
    });
  }
  function botReply(text, suggestions) {
    showTyping();
    setTimeout(function () {
      hideTyping();
      addMessage(text, 'bot');
      renderSuggestions(suggestions);
    }, 450 + Math.random() * 450);
  }

  // ── Conversational checkout — quantity-aware, cancelable at any step ─────
  function startChatCheckout(productId) {
    var p = PRODUCTS[productId];
    chatCheckout = { productId: productId, step: 'qty', buyer: {} };
    botReply('Great choice — the ' + p.name + ' is ' + fmtUSD(p.priceValue) + ' (' + fmtBDT(p.priceLocalValue) + ') each. How many would you like?');
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
    switch (chatCheckout.step) {
      case 'qty': {
        var qty = parseInt(trimmed, 10);
        if (!qty || qty < 1 || qty > 20) { botReply('Just a number between 1 and 20 — how many ' + p.name + ' would you like? (Or type "cancel" to stop.)'); return; }
        chatCheckout.buyer.qty = qty;
        chatCheckout.step = 'name';
        var total = fmtUSD(p.priceValue * qty) + ' (' + fmtBDT(p.priceLocalValue * qty) + ')';
        botReply(qty + '× ' + p.name + ' comes to ' + total + '. What name should I put on the order?');
        break;
      }
      case 'name':
        chatCheckout.buyer.name = trimmed;
        memory.userName = trimmed.split(' ')[0];
        chatCheckout.step = 'phone';
        botReply('Thanks, ' + memory.userName + "! What's the best phone number to reach you on?");
        break;
      case 'phone':
        chatCheckout.buyer.phone = trimmed;
        chatCheckout.step = 'email';
        botReply('And an email for your order confirmation?');
        break;
      case 'email':
        chatCheckout.buyer.email = trimmed;
        chatCheckout.step = 'method';
        botReply('How would you like to pay — bKash, Nagad, or Airtm?', ['bKash', 'Nagad', 'Airtm']);
        break;
      case 'method': {
        var methodId = detectPayMethod(trimmed);
        if (!methodId) { botReply('I only support bKash, Nagad, or Airtm right now — which one works for you?', ['bKash', 'Nagad', 'Airtm']); return; }
        chatCheckout.buyer.method = methodId;
        chatCheckout.step = 'txn';
        var m = findMethod(methodId);
        var target = m.type === 'phone' ? 'this ' + m.label + ' number' : 'this Airtm email';
        var qty2 = chatCheckout.buyer.qty || 1;
        var amount = fmtUSD(p.priceValue * qty2) + ' (' + fmtBDT(p.priceLocalValue * qty2) + ')';
        botReply('Send ' + amount + ' to ' + target + ': ' + m.value + '. Once done, paste the Transaction ID here.');
        break;
      }
      case 'txn': {
        chatCheckout.buyer.txnId = trimmed;
        var productId = chatCheckout.productId;
        var buyer = chatCheckout.buyer;
        chatCheckout = null;
        showTyping();
        submitOrder(productId, buyer, function (id, ok) {
          setTimeout(function () {
            hideTyping();
            if (ok) {
              addMessage('🎉 Order placed! Your order ID is ' + id + ". We'll verify the payment and confirm within a few hours.", 'bot');
              renderSuggestions(['Take me to Store']);
            } else {
              addMessage("That didn't go through on my end — sorry! Please email theexoraworld@gmail.com with your Transaction ID (" + buyer.txnId + ") and we'll sort it out manually.", 'bot');
              renderSuggestions(['Take me to Help']);
            }
          }, 500);
        });
        break;
      }
    }
  }

  // ── Main input router ──────────────────────────────────────────────────
  function handleUserInput(rawText) {
    if (chatCheckout) { handleChatCheckoutInput(rawText); return; }

    var trimmed = rawText.trim();

    // Remembers your first name once given during checkout, for a
    // personalized greeting if you chat again later in the session.
    if (memory.userName && /^(hi|hello|hey|yo|sup)\b/i.test(trimmed)) {
      memory.fallbackStreak = 0;
      botReply('Hey ' + memory.userName + ', good to see you again! What can I help with?', ['Show me the store', 'Popular games']);
      return;
    }

    // Contextual yes/no — only fires right after Exo itself offered to
    // start an order for a specific product.
    if (memory.lastProductId && isAffirmative(trimmed)) {
      var pid = memory.lastProductId;
      memory.lastProductId = null;
      memory.fallbackStreak = 0;
      startChatCheckout(pid);
      return;
    }
    if (memory.lastProductId && isNegative(trimmed)) {
      memory.lastProductId = null;
      memory.fallbackStreak = 0;
      botReply('No worries — let me know if you change your mind or want to look at something else.', ['Show me the store', 'Popular games']);
      return;
    }

    var text = normalize(trimmed);

    var buyProduct = detectBuyIntent(text);
    if (buyProduct) { memory.fallbackStreak = 0; memory.lastProductId = null; startChatCheckout(buyProduct); return; }

    var recGame = detectGenreRecommendation(text);
    if (recGame) {
      memory.fallbackStreak = 0;
      memory.lastTopicId = recGame; memory.lastProductId = null;
      var g = GAMES[recGame];
      botReply('Since you\'re into that, ' + g.name + ' (' + g.genre + ', rated ' + g.rating + ') sounds perfect — ' + g.desc, ['Take me to Games']);
      return;
    }

    var navTarget = detectNavIntent(text);
    if (navTarget) {
      memory.fallbackStreak = 0;
      botReply('Sure — heading to ' + navTarget.label + ' now.');
      setTimeout(function () {
        var el = document.getElementById(navTarget.id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 500);
      return;
    }

    var kbMatch = matchKB(text);
    if (kbMatch) {
      memory.fallbackStreak = 0;
      memory.lastTopicId = kbMatch.id;
      memory.lastProductId = PRODUCTS[kbMatch.id] ? kbMatch.id : null;
      botReply(pick(kbMatch.replies), kbMatch.sugg);
      return;
    }

    memory.fallbackStreak++;
    var msg = fallbackReply();
    if (memory.fallbackStreak >= 3) {
      msg += " If I'm not getting it, our Help form or theexoraworld@gmail.com will get you a real answer fast.";
    }
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
    els.trigger     = document.getElementById('exoTrigger');
    els.panel       = document.getElementById('exoPanel');
    els.closeBtn    = document.getElementById('exoClose');
    els.msgs        = document.getElementById('exoMsgs');
    els.suggestions = document.getElementById('exoSuggestions');
    els.input       = document.getElementById('exoInput');
    els.sendBtn     = document.getElementById('exoSendBtn');
    if (!els.trigger) return;

    var greeted = false;
    function open() {
      els.panel.classList.add('open');
      els.panel.setAttribute('aria-hidden', 'false');
      els.trigger.setAttribute('aria-expanded', 'true');
      if (!greeted) {
        greeted = true;
        botReply("Hey! I'm Exo 👋 — I can help you explore games, shop the store, get a recommendation, or buy something right here in chat with bKash, Nagad, or Airtm. What are you after?", ['Show me the store', 'Popular games', 'Recommend me a game']);
      }
      els.input.focus();
    }
    function close() {
      els.panel.classList.remove('open');
      els.panel.setAttribute('aria-hidden', 'true');
      els.trigger.setAttribute('aria-expanded', 'false');
    }
    els.trigger.addEventListener('click', function () {
      els.panel.classList.contains('open') ? close() : open();
    });
    els.closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && els.panel.classList.contains('open')) close(); });

    els.sendBtn.addEventListener('click', function () { submitUserText(els.input.value); });
    els.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitUserText(els.input.value); });
  }

  // ── Boot ──────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    initCheckoutModal();
    initExoWidget();
  });
})();
