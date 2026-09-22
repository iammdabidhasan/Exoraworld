/* ════════════════════════════════════════════════════════════
   EXORAWORLD — Exo Assistant v4.0  (merged local model)

   What changed from v3 → v4:
     • NLP engine replaced: weighted intent scoring (22 intents),
       synonym expansion, Levenshtein fuzzy matching.
       Simple keyword lookup removed.
     • ExoContext: live IntersectionObserver tracks which section
       is visible — greeting and suggestions adapt in real time.
     • ExoMemory: full 40-turn conversation history persisted in
       sessionStorage (survives soft navigation).
     • ExoOwner: passphrase-gated admin mode. Type
       "exo:setadmin [pass]" once, then "exo:admin [pass]"
       to unlock site health reports, guard flags, analytics.
     • HTML responses: links, <strong>, <code> now render in
       bot bubbles (CSS injected automatically).
     • Proactive triggers: Exo pulse lights up after 45 s idle
       and when visitor enters the Store section.
     • Context-aware greeting adapts to visible section.

   What's kept from v3 (unchanged):
     • Live DOM scraping — product names and prices are read from
       the page at boot, so editing the HTML is the only update
       you ever need to make. Exo literally cannot quote stale data.
     • Full 3-step checkout modal (tab UI, copy button, Formspree).
     • Conversational chat checkout with phone/email memory.
     • Real payment details (bKash/Nagad number, Airtm email).
     • Page actions: toggle theme, open sign-up/login, scroll top.
     • Asia/Dhaka real-time clock + support hours.
     • Arithmetic calculator.
     • Entity capture (email/BD phone anywhere in conversation).
     • Genre-based game recommendation.
     • Frustration detection → escalate to human support.
   ════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────
     CONFIG — edit these without touching anything else
     ───────────────────────────────────────────────────────── */
  var FORMSPREE    = 'https://formspree.io/f/maqaprqk';
  var SUPPORT_HOURS = { start: 9, end: 21 };   // 24h, Asia/Dhaka

  /* ─────────────────────────────────────────────────────────
     UTILITIES
     ───────────────────────────────────────────────────────── */
  function slugify(s) { return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
  function fmtUSD(n)  { return '$' + Number(n).toFixed(2); }
  function fmtBDT(n)  { return '৳' + Math.round(n).toLocaleString('en-US'); }
  function makeOrderId() { return 'EXO-' + Date.now().toString(36).toUpperCase().slice(-6); }
  function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }
  // (esc removed — user messages escaped via textContent; bot messages use controlled innerHTML)
  function lnk(href, label, ext) {
    return '<a href="' + href + '" style="color:var(--color-secondary);text-decoration:underline"' +
           (ext ? ' target="_blank" rel="noopener"' : '') + '>' + label + '</a>';
  }

  var PRODUCT_ICONS = { 'aurora-hoodie': '📥', 'pulse-earbuds': '🌐', 'nova-backpack': '💻' };
  function iconFor(id) { return PRODUCT_ICONS[id] || '🛍️'; }

  /* ─────────────────────────────────────────────────────────
     CURRENCY CONVERSION  (Feature 2)
     Approximate static rates vs USD. Shows visitor's local
     currency alongside USD/BDT when ExoGeo has their location.
     ───────────────────────────────────────────────────────── */
  var CURRENCY_RATES = {
    'EUR':0.92,'GBP':0.79,'INR':83.5,'PKR':278,'LKR':305,'SAR':3.75,'AED':3.67,
    'MYR':4.72,'SGD':1.35,'IDR':15700,'PHP':56.5,'THB':35.5,'NPR':133,'MMK':2100,
    'CAD':1.36,'AUD':1.53,'NZD':1.63,'JPY':149,'KRW':1330,'CNY':7.24,'BRL':4.97,
    'MXN':17.2,'ZAR':18.6,'NGN':1580,'KES':130,'TRY':32.5,'SEK':10.5,'NOK':10.6,
    'DKK':6.9,'CHF':0.88,'PLN':4.0,'RUB':91,'UAH':39.5,'BDT':110,'USD':1
  };
  function getLocalPrice(usdPrice) {
    var geo = ExoContext.getGeo();
    if (!geo || !geo.currency || geo.currency==='USD' || geo.currency==='BDT') return null;
    var rate = CURRENCY_RATES[geo.currency]; if (!rate) return null;
    var local = usdPrice * rate;
    return geo.currency + '\u00a0' + (local < 100 ? local.toFixed(2) : Math.round(local).toLocaleString('en-US'));
  }
  // Drop-in price formatter — appends local currency when available
  function fmtPrice(usdVal, bdtVal) {
    var base = fmtUSD(usdVal) + ' (' + fmtBDT(bdtVal) + ')';
    var local = getLocalPrice(usdVal);
    return local ? base + ' · ~' + local : base;
  }

  /* ── Clipboard helper — module-level so all copy buttons can use it ── */
  function execCmdCopy(text){
    var ta=document.createElement('textarea'); ta.value=text;
    ta.style.cssText='position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(ta); ta.select();
    try{document.execCommand('copy');}catch(e){}
    document.body.removeChild(ta);
  }

  /* ─────────────────────────────────────────────────────────
     LIVE DOM SCRAPING
     Reads actual prices / names / descriptions from the page
     at boot time. Edit the HTML and Exo is automatically
     correct on next reload — no separate data file to maintain.
     ───────────────────────────────────────────────────────── */
  var PRODUCTS = {};
  var GAMES    = {};

  function scrapeProducts() {
    var out = {};
    document.querySelectorAll('#store [data-buy]').forEach(function (btn) {
      var id   = btn.dataset.buy;
      var card = btn.closest('.card');
      if (!id || !card) return;
      var name       = (card.querySelector('h3') || {}).textContent || id;
      var priceText  = (card.querySelector('.price') || {}).textContent || '0';
      var localText  = (card.querySelector('.price-local') || {}).textContent || '0';
      var desc       = (card.querySelector('.card-desc') || {}).textContent || '';
      var media      = card.querySelector('.card-media');
      var gradient   = 'grad-1';
      if (media) {
        var g = Array.prototype.slice.call(media.classList).find(function (c) { return c.indexOf('grad-') === 0; });
        if (g) gradient = g;
      }
      out[id] = {
        name:           name.trim(),
        priceValue:     parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0,
        priceLocalValue:parseFloat(localText.replace(/[^0-9]/g, ''))  || 0,
        desc:           desc.trim(),
        icon:           iconFor(id),
        gradient:       gradient
      };
    });
    return out;
  }

  function scrapeGames() {
    var out = {};
    document.querySelectorAll('#games .card').forEach(function (card) {
      var nameEl = card.querySelector('h3');
      var name   = nameEl ? nameEl.textContent.trim() : '';
      if (!name) return;
      var id     = slugify(name);
      var genre  = (card.querySelector('.badge') || {}).textContent || '';
      var rating = ((card.querySelector('.rating') || {}).textContent || '').match(/[\d.]+/);
      var desc   = (card.querySelector('.card-desc') || {}).textContent || '';
      out[id] = { name: name, genre: genre.trim(), rating: rating ? rating[0] : '', desc: desc.trim() };
    });
    return out;
  }

  /* ─────────────────────────────────────────────────────────
     PAYMENT METHODS
     ───────────────────────────────────────────────────────── */
  var PAY_METHODS = [
    { id: 'bkash',  label: 'bKash',  type: 'phone', value: '01715948039',
      hint: 'Send Money to this bKash number, then enter the Transaction ID from your confirmation SMS.' },
    { id: 'nagad',  label: 'Nagad',  type: 'phone', value: '01715948039',
      hint: 'Send Money to this Nagad number, then enter the Transaction ID from your confirmation SMS.' },
    { id: 'airtm',  label: 'Airtm',  type: 'email', value: 'iammdabidhasan@gmail.com',
      hint: 'Send payment to this Airtm email, then enter the reference ID from your receipt.' }
  ];
  function findMethod(id)    { return PAY_METHODS.filter(function (m) { return m.id === id; })[0] || null; }
  function detectPayMethod(text) {
    var l = text.toLowerCase();
    if (/b[- ]?kash/.test(l))   return 'bkash';
    if (/nagad/.test(l))        return 'nagad';
    if (/air[- ]?tm/.test(l))   return 'airtm';
    return null;
  }

  /* ─────────────────────────────────────────────────────────
     REAL-TIME  (Asia/Dhaka)
     ───────────────────────────────────────────────────────── */
  function dhakaNow() { return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })); }
  function isWithinSupport() { var h = dhakaNow().getHours(); return h >= SUPPORT_HOURS.start && h < SUPPORT_HOURS.end; }
  function timeOfDay() {
    var h = dhakaNow().getHours();
    if (h < 5)  return 'the middle of the night';
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    if (h < 21) return 'evening';
    return 'night';
  }

  /* ─────────────────────────────────────────────────────────
     ORDER SUBMISSION
     ───────────────────────────────────────────────────────── */
  function submitOrder(productId, buyer, onDone) {
    var p   = PRODUCTS[productId];
    var qty = buyer.qty || 1;
    var m   = findMethod(buyer.method);
    var id  = makeOrderId();
    fetch(FORMSPREE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject:        '🛒 New ExoraWorld order — ' + (p ? p.name : productId) + ' x' + qty + ' (' + id + ')',
        order_id:        id,
        product:         p ? p.name : productId,
        quantity:        qty,
        price_usd:       p ? fmtUSD(p.priceValue  * qty) : '',
        price_local:     p ? fmtBDT(p.priceLocalValue * qty) : '',
        payment_method:  m ? m.label : buyer.method,
        transaction_id:  buyer.txnId,
        buyer_name:      buyer.name,
        buyer_phone:     buyer.phone,
        buyer_email:     buyer.email,
        submitted_at:    dhakaNow().toLocaleString('en-US') + ' (Asia/Dhaka)'
      })
    }).then(function (r) { if (onDone) onDone(id, r.ok); })
      .catch(function ()  { if (onDone) onDone(id, false); });
    return id;
  }

  /* ═══════════════════════════════════════════════════════════
     CHECKOUT MODAL  (3-step: details → payment → confirmation)
     ═══════════════════════════════════════════════════════════ */
  function initCheckoutModal() {
    var overlay  = document.getElementById('checkoutModal'); if (!overlay) return;
    var summary  = document.getElementById('checkoutProductSummary');
    var step1    = document.getElementById('checkoutStep1');
    var step2    = document.getElementById('checkoutStep2');
    var step3    = document.getElementById('checkoutStep3');
    var step2Form= document.getElementById('checkoutStep2Form');
    var tabs     = document.getElementById('payMethodTabs');
    var instrEl  = document.getElementById('payInstructions');
    var backBtn  = document.getElementById('checkoutBack');
    var doneBtn  = document.getElementById('checkoutDone');
    var closeBtn = document.getElementById('checkoutClose');
    var dots     = overlay.querySelectorAll('.checkout-step-dot');
    var state    = { productId: null, method: PAY_METHODS[0].id };

    function setDots(n) { dots.forEach(function (d, i) { d.classList.toggle('active', i === n - 1); d.classList.toggle('done', i < n - 1); }); }
    function showStep(n) { step1.hidden = n !== 1; step2.hidden = n !== 2; step3.hidden = n !== 3; setDots(n); }

    function renderTabs() {
      tabs.innerHTML = PAY_METHODS.map(function (m) {
        return '<button type="button" class="pay-method-tab' + (m.id === state.method ? ' active' : '') +
               '" data-method="' + m.id + '">' + m.label + '</button>';
      }).join('');
      tabs.querySelectorAll('.pay-method-tab').forEach(function (btn) {
        btn.addEventListener('click', function () { state.method = btn.dataset.method; renderTabs(); renderInstr(); });
      });
    }
    function renderInstr() {
      var m = findMethod(state.method);
      var p = PRODUCTS[state.productId]; if (!p) return;
      instrEl.innerHTML =
        '<p>' + m.hint + '</p>' +
        '<div class="pay-value-box"><span>' + m.value + '</span>' +
        '<button type="button" class="copy-btn" id="payCopyBtn">Copy</button></div>' +
        '<p style="margin-top:.85rem;margin-bottom:0">Amount: <strong>' + fmtUSD(p.priceValue) + ' (' + fmtBDT(p.priceLocalValue) + ')</strong></p>';
      document.getElementById('payCopyBtn').addEventListener('click', function () {
        var btn = this;
        function onCopied() { btn.textContent = 'Copied!'; btn.classList.add('copied'); setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500); }
        // Clipboard API requires HTTPS; fall back to execCommand for HTTP
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(m.value).then(onCopied).catch(function () {
            execCmdCopy(m.value); onCopied();
          });
        } else { execCmdCopy(m.value); onCopied(); }
      });
      // execCmdCopy is module-level — accessible here
    }

    window.openCheckout = function (productId) {
      var p = PRODUCTS[productId];
      if (!p) { if (window.showToast) window.showToast('Sorry, that item is unavailable right now.'); return; }
      state.productId = productId; state.method = PAY_METHODS[0].id;
      summary.innerHTML =
        '<span class="checkout-product-icon ' + p.gradient + '">' + p.icon + '</span>' +
        '<div class="checkout-product-info"><h4>' + p.name + '</h4>' +
        '<span class="price-block"><span class="price">' + fmtUSD(p.priceValue) + '</span>' +
        '<span class="price-local">' + fmtBDT(p.priceLocalValue) + '</span></span></div>';
      step1.reset(); step2Form.reset();
      showStep(1); renderTabs(); renderInstr();
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      if (window._updateBodyScroll) window._updateBodyScroll(); else document.body.classList.add('no-scroll');
    };

    function closeModal() {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      if (window._updateBodyScroll) window._updateBodyScroll(); else document.body.classList.remove('no-scroll');
    }
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    doneBtn.addEventListener('click', closeModal);
    backBtn.addEventListener('click', function () { showStep(1); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('active')) closeModal(); });

    step1.addEventListener('submit', function (e) { e.preventDefault(); if (!step1.checkValidity()) { step1.reportValidity(); return; } showStep(2); });
    step2Form.addEventListener('submit', function (e) {
      e.preventDefault();
      var txnId = document.getElementById('txnId').value.trim(); if (!txnId) return;
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
          if (!errBox) { errBox = document.createElement('div'); errBox.id = 'checkoutOrderError'; errBox.className = 'auth-error'; step2Form.insertBefore(errBox, step2Form.firstChild); }
          errBox.textContent = "That didn't go through — check your connection and try again, or email theexoraworld@gmail.com with your Transaction ID (" + buyer.txnId + ") directly.";
          errBox.style.display = 'block';
        }
      });
    });
    document.querySelectorAll('[data-buy]').forEach(function (btn) {
      btn.addEventListener('click', function () { window.openCheckout(btn.dataset.buy); });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     ExoNLP — weighted intent scoring (replaces v3 scoreTopic)
     22 intent categories · synonym expansion · fuzzy matching
     ═══════════════════════════════════════════════════════════ */
  var ExoNLP = (function () {
    var INTENTS = {
      greet:      { w:1.0, words:['hi','hello','hey','yo','sup','salaam','good morning','good afternoon','good evening','howdy'] },
      store:      { w:1.2, words:['store','shop','buy','purchase','product','price','cost','how much','order','checkout','tool'] },
      games:      { w:1.2, words:['game','games','play','playing','gaming','free game','gamer','skyfall','mystic','turbo','rally','void runner','void runnner'] },
      news:       { w:1.0, words:['news','article','update','latest','announcement','blog','patch'] },
      gallery:    { w:1.0, words:['gallery','photo','picture','community photo','meetup','event','moment','exoracon'] },
      content:    { w:1.0, words:['content','tutorial','guide','learn','how to','creator','tips','resource'] },
      about:      { w:1.0, words:['about','who','founder','team','abid','history','mission','company','story','who made','who built'] },
      payment:    { w:1.3, words:['payment','pay','bkash','nagad','airtm','method','transaction','txn','mobile banking','send money'] },
      refund:     { w:1.2, words:['refund','return','money back','cancel','cancellation','refundable'] },
      account:    { w:1.2, words:['account','login','log in','sign in','signup','sign up','register','password','forgot','reset','profile'] },
      social:     { w:1.0, words:['discord','facebook','twitter','instagram','youtube','social','join','server','follow'] },
      help:       { w:1.2, words:['help','support','problem','issue','error','not working','broken','bug','stuck','can\'t','cannot','fix'] },
      contact:    { w:1.0, words:['contact','email','reach','message','talk','get in touch'] },
      privacy:    { w:1.0, words:['privacy','data','cookies','consent','gdpr','tracking','collect','personal'] },
      navigate:   { w:1.1, words:['go to','take me','show me','navigate','where is','scroll to','direct me'] },
      small_talk: { w:0.8, words:['how are you','how r u','what are you','who are you','are you ai','are you bot','are you real','what can you do','your capabilities'] },
      time:       { w:1.3, words:['what time','current time','time is it','are you open','support hours','business hours','is anyone there','open right now'] },
      action:     { w:1.3, words:['dark mode','light mode','switch theme','toggle theme','sign me up','open signup','open login','log me in','back to top','scroll to top'] },
      math:       { w:1.2, words:['calculate','plus','minus','multiply','divide','what is','equals','sum','times'] },
      recommend:  { w:1.2, words:['recommend','suggest','which game','what should i play','good game','something like','similar to','like racing','like rpg','like shooter'] },
      compliment: { w:0.8, words:['great','awesome','cool','nice','love','amazing','good job','excellent','brilliant','fantastic'] },
      thanks:     { w:1.0, words:['thank','thanks','cheers','appreciate','grateful','thx','ty'] },
      bye:        { w:1.0, words:['bye','goodbye','see you','later','cya','take care','farewell','good night','ok thanks'] },
      admin:      { w:2.0, words:['exo:admin','exo:status','exo:threats','exo:analytics','exo:logout','exo:help','exo:setadmin','exo:report','exo:guard','exo:clearchat','exo:stats'] }
    };

    var SYNS = { 'r':'are','u':'you','ur':'your','pls':'please','plz':'please','thx':'thanks','thnx':'thanks','ty':'thanks',
                 'info':'information','acc':'account','pw':'password','msg':'message','wanna':'want to','gonna':'going to',
                 'lol':'','ok':'','okay':'','yeah':'','yep':'','hmm':'' };

    function norm(t)   { return String(t).toLowerCase().replace(/[^\w\s']/g,' ').replace(/\s+/g,' ').trim(); }
    function expand(t) { return t.split(' ').map(function(w){ return Object.prototype.hasOwnProperty.call(SYNS,w)?SYNS[w]:w; }).filter(Boolean).join(' '); }

    function lev(a,b) {
      if (a===b) return 0; if (a.length>10||b.length>10) return 99;
      var dp=[];
      for(var i=0;i<=b.length;i++){dp[i]=[i];for(var j=1;j<=a.length;j++)dp[i][j]=i===0?j:Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[j-1]!==b[i-1]?1:0));}
      return dp[b.length][a.length];
    }

    function matchWord(mw,sw){
      if(mw===sw) return 1.0;
      if(sw.length>4&&mw.indexOf(sw)>-1) return 0.85;
      if(sw.length>4&&sw.indexOf(mw)>-1) return 0.7;
      if(sw.length>4&&lev(mw,sw)===1) return 0.6;
      return 0;
    }

    function classify(raw, section) {
      var txt=expand(norm(raw)), words=txt.split(' ').filter(Boolean), scores={};
      Object.keys(INTENTS).forEach(function(intent){
        var def=INTENTS[intent], s=0;
        def.words.forEach(function(signal){
          if(signal.indexOf(' ')>-1){ if(txt.indexOf(signal)>-1) s+=2.5*def.w; }
          else words.forEach(function(w){ var m=matchWord(w,signal); if(m>0) s+=m*def.w; });
        });
        scores[intent]=s;
      });
      // context boost
      var boosts={store:{store:.4,payment:.2},games:{games:.4},help:{help:.3},faq:{help:.25},about:{about:.3},contact:{contact:.35}};
      if(boosts[section]) Object.keys(boosts[section]).forEach(function(k){ scores[k]=(scores[k]||0)+boosts[section][k]; });
      var sorted=Object.keys(scores).sort(function(a,b){return scores[b]-scores[a];});
      return { top:sorted[0], score:scores[sorted[0]], all:scores };
    }

    function extractProduct(raw){
      var t=raw.toLowerCase();
      var ids=Object.keys(PRODUCTS);
      for(var i=0;i<ids.length;i++){
        var p=PRODUCTS[ids[i]];
        if(t.indexOf(p.name.toLowerCase())>-1||t.indexOf(ids[i])>-1) return ids[i];
        if(ids[i]==='aurora-hoodie'&&/media|harvester|download/.test(t)) return ids[i];
        if(ids[i]==='pulse-earbuds'&&/template|web|bootstrap|tailwind/.test(t)) return ids[i];
        if(ids[i]==='nova-backpack'&&/custom|code|dev(elop)?/.test(t)) return ids[i];
      }
      return null;
    }

    function extractGame(raw){
      var t=raw.toLowerCase(), ids=Object.keys(GAMES);
      for(var i=0;i<ids.length;i++){
        var g=GAMES[ids[i]];
        if(t.indexOf(g.name.toLowerCase())>-1||t.indexOf(ids[i])>-1) return ids[i];
      }
      return null;
    }

    function matchFaq(raw){
      var t=norm(raw);
      var FAQ=[
        {q:'how do i pay',a:'We accept bKash, Nagad, and Airtm. Send the payment, copy the Transaction ID, then paste it in checkout. We confirm within a few hours.'},
        {q:'are you open support hours',a:isWithinSupport()?'Yes — the team is within support hours right now (9am–9pm Dhaka time). Replies should be quick!':'We\'re outside support hours right now (9am–9pm Dhaka time), but your message or order will be waiting when the team is back.'},
        {q:'is it free account',a:'Creating an ExoraWorld account is completely free. Games are free to play. Store items are priced individually.'},
        {q:'how do i contact',a:'Email theexoraworld@gmail.com or join the Discord server — Discord is usually faster.'},
        {q:'what is refund policy',a:'7-day refund on digital products. Email theexoraworld@gmail.com within 7 days of purchase.'},
        {q:'forgot password reset',a:'Use the "Forgot Password" link on the login screen. The reset email arrives within a few minutes — check spam too.'},
        {q:'how long confirm order',a:'Orders are typically confirmed within a few hours after we verify your Transaction ID.'}
      ];
      var best=null, bestScore=0;
      FAQ.forEach(function(item){
        var ws=item.q.split(' '), score=0;
        ws.forEach(function(w){ if(w.length>2&&t.indexOf(w)>-1) score++; });
        if(score>bestScore){bestScore=score;best=item;}
      });
      return (best&&bestScore>=2)?best.a:null;
    }

    return { classify:classify, extractProduct:extractProduct, extractGame:extractGame, matchFaq:matchFaq, norm:norm };
  }());

  /* ═══════════════════════════════════════════════════════════
     ExoContext — live page awareness
     ═══════════════════════════════════════════════════════════ */
  var ExoContext = (function(){
    var _sec='home';
    if(window.IntersectionObserver){
      var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting&&e.target.id)_sec=e.target.id;});},{threshold:.35});
      document.querySelectorAll('section[id]').forEach(function(s){io.observe(s);});
    }
    function getUserName(){ try{var u=window.ExoAuth&&window.ExoAuth.currentUser;return u?(u.displayName||'').split(' ')[0]||null:null;}catch(e){return null;} }
    function isLoggedIn(){ try{return !!(window.ExoAuth&&window.ExoAuth.currentUser);}catch(e){return false;} }
    function getGuardScore(){ try{return window.ExoGuard?window.ExoGuard.getScore():0;}catch(e){return 0;} }
    function getGuardFlags(){ try{return JSON.parse(sessionStorage.getItem('exo_guard')||'[]');}catch(e){return[];} }
    function getAnalytics(){ try{return window.ExoAnalytics?window.ExoAnalytics.getSummary():null;}catch(e){return null;} }
    function getGeo(){ try{return window.ExoGeo?window.ExoGeo.get():null;}catch(e){return null;} }
    function getDeviceId(){ try{return window.ExoDevice?window.ExoDevice.getDeviceId().slice(0,14):'?';}catch(e){return'?';} }
    function getConsent(){ try{return window.ExoConsent?window.ExoConsent.level():null;}catch(e){return null;} }
    function getRateLimit(){ try{var b=Math.floor(Date.now()/300000);return parseInt(localStorage.getItem('exo_rl_'+b)||'0');}catch(e){return 0;} }
    return { get:function(){return _sec;}, getUserName:getUserName, isLoggedIn:isLoggedIn,
             getGuardScore:getGuardScore, getGuardFlags:getGuardFlags, getAnalytics:getAnalytics,
             getGeo:getGeo, getDeviceId:getDeviceId, getConsent:getConsent, getRateLimit:getRateLimit };
  }());

  /* ═══════════════════════════════════════════════════════════
     ExoMemory — conversation state + sessionStorage persistence
     ═══════════════════════════════════════════════════════════ */
  var ExoMemory = (function(){
    var SS='exo_chat_v4';
    var _s={ userName:null, knownEmail:null, knownPhone:null, fallbackStreak:0, lastProductId:null, greeted:false, frustration:0 };
    var _h=[];
    try{ var stored=JSON.parse(sessionStorage.getItem(SS)||'null'); if(stored){_h=stored.h||[];_s=Object.assign(_s,stored.s||{});} }catch(e){}
    function save(){ try{sessionStorage.setItem(SS,JSON.stringify({h:_h.slice(-40),s:_s}));}catch(e){} }
    function add(role,text){ _h.push({role:role,text:text,ts:Date.now()}); if(_h.length>40)_h=_h.slice(-40); save(); }
    function get(){ return _h; }
    function state(){ return _s; }
    function set(k,v){ _s[k]=v; save(); }
    function clear(){ _h=[]; _s={ userName:null, knownEmail:null, knownPhone:null, fallbackStreak:0, lastProductId:null, greeted:false, frustration:0 }; save(); }
    return { add:add, get:get, state:state, set:set, clear:clear };
  }());

  /* ═══════════════════════════════════════════════════════════
     ExoOwner — passphrase-gated admin mode
     Setup: type "exo:setadmin yourpassphrase"  (once, privately)
     Login: type "exo:admin yourpassphrase"
     ═══════════════════════════════════════════════════════════ */
  var ExoOwner = (function(){
    var KEY='exo_adm_h', _auth=false;
    function hash(s){ var h=5381; for(var i=0;i<s.length;i++){h=((h<<5)+h)^s.charCodeAt(i);h=h>>>0;} return h.toString(16); }
    function hasKey(){ try{return !!localStorage.getItem(KEY);}catch(e){return false;} }
    function isAuthed(){ return _auth; }
    function setKey(p){ try{localStorage.setItem(KEY,hash(p.trim()));return true;}catch(e){return false;} }
    function auth(p){ try{var stored=localStorage.getItem(KEY); if(!stored)return'nokey'; if(hash(p.trim())===stored){_auth=true;return'ok';} return'fail';}catch(e){return'fail';} }
    function deauth(){ _auth=false; }

    function _row(l,v){ return '<tr><td style="opacity:.6;padding-right:.9em;vertical-align:top">'+l+'</td><td><strong>'+v+'</strong></td></tr>'; }

    function siteReport(){
      var gs=ExoContext.getGuardScore(), flags=ExoContext.getGuardFlags(), geo=ExoContext.getGeo();
      var status=gs>=5?'🔴 THREAT':gs>=2?'🟡 Elevated':'🟢 Clean';
      var html='<strong>🛡️ Site Health Report</strong><br><table style="border-collapse:collapse;margin-top:.5em;font-size:.84em">';
      html+=_row('Bot score',gs+'/5 &nbsp;'+status);
      html+=_row('Guard flags',flags.length?flags.map(function(f){return'<code>'+f.r+'</code>';}).join(' '):'none');
      html+=_row('Requests/5min',ExoContext.getRateLimit()+' / 150');
      html+=_row('Device','<code>'+ExoContext.getDeviceId()+'…</code>');
      html+=_row('Consent',ExoContext.getConsent()||'none');
      if(geo) html+=_row('Visitor geo',(geo.city||'?')+', '+(geo.country||'?')+(geo.currency?' ('+geo.currency+')':''));
      html+='</table>';
      var a=ExoContext.getAnalytics();
      if(a&&a.sessions>0){
        html+='<br><strong>📊 Analytics</strong><table style="border-collapse:collapse;margin-top:.4em;font-size:.84em">';
        html+=_row('Sessions',a.sessions); html+=_row('Avg duration',a.avgDuration+'s');
        if(a.countries.length) html+=_row('Countries',a.countries.map(function(c){return c[0]+'('+c[1]+')';}).join(', '));
        if(a.events.length)    html+=_row('Top events',a.events.map(function(e){return e[0]+'×'+e[1];}).join(', '));
        html+='</table>';
      } else { html+='<br><em style="opacity:.5;font-size:.82em">Analytics: no data yet</em>'; }
      html+='<br><small style="opacity:.4">exo:threats · exo:analytics · exo:logout</small>';
      return html;
    }
    function threatReport(){
      var flags=ExoContext.getGuardFlags();
      if(!flags.length) return '🟢 No threats this session. All guard checks passed cleanly.';
      var html='<strong>🛡️ Threat Log</strong> ('+flags.length+')<br>';
      flags.forEach(function(f,i){ html+=(i+1)+'. <code>'+f.r+'</code> <span style="opacity:.5">'+Math.round((Date.now()-f.t)/1000)+'s ago</span><br>'; });
      return html;
    }
    function analyticsReport(){
      var s=ExoContext.getAnalytics();
      if(!s||s.sessions===0) return '📊 No analytics data yet. Needs visitor analytics consent.';
      var html='<strong>📊 Analytics</strong><br>Sessions: <strong>'+s.sessions+'</strong> · Avg: <strong>'+s.avgDuration+'s</strong><br>';
      if(s.countries.length) html+='🌍 '+s.countries.map(function(c){return c[0]+' ('+c[1]+')';}).join(', ')+'<br>';
      if(s.events.length)    html+='🖱 '+s.events.map(function(e){return e[0]+'×'+e[1];}).join(', ');
      return html;
    }
    // Feature 3 — order history report
    function ordersReport(){
      try{
        var hist=JSON.parse(localStorage.getItem('exo_orders')||'[]');
        if(!hist.length) return '📦 No orders recorded on this device yet.';
        var html='<strong>📦 Order History ('+hist.length+')</strong><br>';
        hist.slice(-10).reverse().forEach(function(o){
          var ago=Math.round((Date.now()-o.ts)/60000);
          var when=ago<60?ago+'m ago':Math.round(ago/60)+'h ago';
          html+='<code>'+o.id+'</code> — '+o.product+' — '+o.amount+' via '+o.method+' <span style="opacity:.5">'+when+'</span><br>';
        });
        return html;
      }catch(e){ return '📦 Could not read order history.'; }
    }
    return { hasKey:hasKey, isAuthed:isAuthed, setKey:setKey, auth:auth, deauth:deauth,
             siteReport:siteReport, threatReport:threatReport, analyticsReport:analyticsReport, ordersReport:ordersReport };
  }());

  /* ═══════════════════════════════════════════════════════════
     PAGE ACTIONS  — Exo operating the page (from v3, unchanged)
     ═══════════════════════════════════════════════════════════ */
  function tryPageAction(text) {
    var l=text.toLowerCase();
    if(/dark mode|light mode|switch theme|toggle theme/.test(l)){ var t=document.getElementById('themeToggle'); if(t){t.click();return'Done — toggled the theme for you ☀️🌙';} }
    if(/sign me up|create an account|open sign ?up|i want to sign up/.test(l)){ var s=document.querySelector('[data-auth-open="signup"]'); if(s){s.click();return'Opened the sign-up form for you.';} }
    if(/log me in|open login|i want to log ?in/.test(l)){ var lg=document.querySelector('[data-auth-open="login"]'); if(lg){lg.click();return'Opened the login form for you.';} }
    if(/back to top|scroll to top|go to top/.test(l)){ var h=document.getElementById('home'); if(h){h.scrollIntoView({behavior:'smooth'});return'Back to the top! ⬆️';} }
    return null;
  }

  /* ═══════════════════════════════════════════════════════════
     REAL-TIME QUERIES  (from v3, unchanged)
     ═══════════════════════════════════════════════════════════ */
  function tryTimeQuery(text) {
    var l=text.toLowerCase();
    if(/what time|current time|time is it/.test(l)){
      var t=dhakaNow();
      return "It's "+t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})+" right now in Bangladesh (Asia/Dhaka) — "+timeOfDay()+" where the ExoraWorld team is based.";
    }
    if(/are you open|support available|business hours|is anyone there/.test(l)){
      return isWithinSupport()
        ?"We're within typical support hours right now (9am–9pm Dhaka time), so replies should be quick."
        :"We're outside support hours right now (9am–9pm Dhaka time) — your message will be waiting when the team is back.";
    }
    return null;
  }

  /* ═══════════════════════════════════════════════════════════
     MATH  (from v3, unchanged)
     ═══════════════════════════════════════════════════════════ */
  function tryMath(text) {
    var m=text.match(/(-?\d+(?:\.\d+)?)\s*([+\-x×*/÷])\s*(-?\d+(?:\.\d+)?)/);
    if(!m) return null;
    var a=parseFloat(m[1]),op=m[2],b=parseFloat(m[3]),r;
    if(op==='+'||op==='plus') r=a+b;
    else if(op==='-') r=a-b;
    else if(op==='x'||op==='×'||op==='*') r=a*b;
    else { if(b===0) return "Can't divide by zero!"; r=a/b; }
    return a+' '+op+' '+b+' = '+(Math.round(r*10000)/10000);
  }

  /* ═══════════════════════════════════════════════════════════
     ENTITY CAPTURE  (from v3 — remembers phone/email mid-chat)
     ═══════════════════════════════════════════════════════════ */
  var EMAIL_RE=/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  var PHONE_RE=/(?:\+?88)?01[3-9]\d{8}/;
  function scanEntities(text){
    var email=text.match(EMAIL_RE), phone=text.match(PHONE_RE);
    if(email) ExoMemory.set('knownEmail',email[0]);
    if(phone) ExoMemory.set('knownPhone',phone[0]);
  }

  /* ═══════════════════════════════════════════════════════════
     GENRE RECOMMENDATION  (from v3, updated for live GAMES)
     ═══════════════════════════════════════════════════════════ */
  var GENRE_MAP=[
    {kw:['racing','cars','speed','drift','driving'],id:'turbo-rally-x'},
    {kw:['rpg','fantasy','story','adventure','open world'],id:'mystic-realms'},
    {kw:['shooter','battle royale','pvp','competitive','fps'],id:'skyfall-arena'},
    {kw:['runner','obstacle','run','endless','casual'],id:'void-runner-x'}
  ];
  function tryRecommend(text){
    var l=text.toLowerCase();
    if(!/recommend|suggest|which game|what should i play|good game|something like/.test(l)) return null;
    for(var i=0;i<GENRE_MAP.length;i++) for(var j=0;j<GENRE_MAP[i].kw.length;j++) if(l.indexOf(GENRE_MAP[i].kw[j])>-1){
      var g=GAMES[GENRE_MAP[i].id];
      return g?"Based on that, "+g.name+" ("+g.genre+", rated "+g.rating+") sounds like your thing — "+g.desc+' '+lnk('pages/games.html','Play now →')
              :"Sounds like you'd enjoy something in that genre — "+lnk('pages/games.html','check the Games page')+" for what's available.";
    }
    return null;
  }

  /* ═══════════════════════════════════════════════════════════
     INTENT helpers  (from v3)
     ═══════════════════════════════════════════════════════════ */
  function isAffirmative(t){ return /^(y|ya|yea|yes|yeah|yep|sure|ok|okay|please|do it|go ahead|definitely|absolutely)\b/i.test(t.trim()); }
  function isNegative(t)   { return /^(n|no|nope|nah|not now|maybe later|not really)\b/i.test(t.trim()); }
  function isFrustrated(t) { return /ugh|annoying|frustrated|isn'?t working|not working|worst|terrible|useless|stupid|hate this|angry/i.test(t); }

  function detectBuyIntent(text){
    var l=text.toLowerCase();
    if(!/buy|purchase|order|checkout|get the/.test(l)) return null;
    var ids=Object.keys(PRODUCTS);
    for(var i=0;i<ids.length;i++){
      var ws=PRODUCTS[ids[i]].name.toLowerCase().split(/\s+/).filter(function(w){return w.length>3;});
      for(var j=0;j<ws.length;j++) if(l.indexOf(ws[j])>-1) return ids[i];
    }
    return null;
  }

  var NAV_MAP=[
    {id:'store',  label:'the Store',  kw:['store','shop']},
    {id:'games',  label:'Games',       kw:['game']},
    {id:'news',   label:'News',         kw:['news']},
    {id:'gallery',label:'the Gallery',  kw:['gallery','photo']},
    {id:'about',  label:'About',        kw:['about']},
    {id:'help',   label:'Help',         kw:['help','contact','support']}
  ];
  function detectNavIntent(text){
    var l=text.toLowerCase();
    if(!/take me|go to|show me|navigate|scroll/.test(l)) return null;
    for(var i=0;i<NAV_MAP.length;i++) for(var j=0;j<NAV_MAP[i].kw.length;j++) if(l.indexOf(NAV_MAP[i].kw[j])>-1) return NAV_MAP[i];
    return null;
  }

  /* ═══════════════════════════════════════════════════════════
     EXO WIDGET — message rendering + chat UI
     ═══════════════════════════════════════════════════════════ */
  var els={};
  var chatCheckout=null;

  // Feature 1 — checkout persistence
  var _checkoutIdleTimer=null;
  // Feature 5 — placeholder rotation
  var _placeholderIdx=0, _placeholderTimer=null;
  // Feature 7 — rate limiting
  var _msgCount=0, _msgWindow=Date.now();
  // Feature 11 — vibration
  var _vibrateEnabled=(typeof navigator.vibrate==='function');

  /* ── Feature 1: Checkout state persistence ─────────────────── */
  function saveCheckoutState(){
    try{ if(chatCheckout) sessionStorage.setItem('exo_co',JSON.stringify(chatCheckout)); else sessionStorage.removeItem('exo_co'); }catch(e){}
  }
  function restoreCheckoutState(){
    try{ var s=JSON.parse(sessionStorage.getItem('exo_co')||'null'); if(s&&s.productId&&PRODUCTS[s.productId]){chatCheckout=s;return true;} }catch(e){}
    return false;
  }

  /* ── Feature 3: Order history ──────────────────────────────── */
  function saveOrderHistory(orderId,productId,buyer){
    try{
      var p=PRODUCTS[productId];
      var hist=JSON.parse(localStorage.getItem('exo_orders')||'[]');
      hist.push({id:orderId,product:p?p.name:productId,amount:p?fmtUSD(p.priceValue*(buyer.qty||1)):'?',method:buyer.method||'?',name:buyer.name||'',ts:Date.now()});
      if(hist.length>50) hist=hist.slice(-50);
      localStorage.setItem('exo_orders',JSON.stringify(hist));
    }catch(e){}
  }

  /* ── Feature 7: Rate limiting ──────────────────────────────── */
  function checkRateLimit(){
    var now=Date.now();
    if(now-_msgWindow>60000){_msgCount=0;_msgWindow=now;}
    _msgCount++;
    if(_msgCount>15){
      botReply("You're sending messages really fast! Give me a moment to catch up 😅");
      return false;
    }
    return true;
  }

  /* ── Feature 8: Checkout idle reminder ────────────────────── */
  function resetCheckoutIdleTimer(){
    clearTimeout(_checkoutIdleTimer);
    if(!chatCheckout) return;
    _checkoutIdleTimer=setTimeout(function(){
      if(chatCheckout&&PRODUCTS[chatCheckout.productId]){
        botReply('👋 Still there? You were ordering <strong>'+PRODUCTS[chatCheckout.productId].name+'</strong>. Want to continue or cancel?',['Continue','Cancel order']);
      }
    },180000); // 3 minutes
  }

  /* ── Feature 13: Multi-language greeting ──────────────────── */
  var LANG_GREET={
    'bn':'আস-সালামু আলাইকুম! আমি Exo ⚡ — ExoraWorld-এর গাইড। ',
    'ar':'مرحباً! أنا Exo ⚡ — دليلك في ExoraWorld. ',
    'hi':'नमस्ते! मैं Exo ⚡ हूँ — ExoraWorld का गाइड। ',
    'fr':'Bonjour! Je suis Exo ⚡ — votre guide ExoraWorld. ',
    'es':'¡Hola! Soy Exo ⚡ — tu guía de ExoraWorld. ',
    'de':'Hallo! Ich bin Exo ⚡ — dein ExoraWorld-Guide. ',
    'pt':'Olá! Sou Exo ⚡ — seu guia ExoraWorld. ',
    'id':'Halo! Saya Exo ⚡ — panduan ExoraWorld Anda. ',
    'tr':'Merhaba! Ben Exo ⚡ — ExoraWorld rehberiniz. ',
    'ms':'Hai! Saya Exo ⚡ — panduan ExoraWorld anda. '
  };
  function localGreeting(){
    var lang=(navigator.language||'en').slice(0,2).toLowerCase();
    return LANG_GREET[lang]||null;
  }

  // Inject CSS for HTML in bot bubbles (links, code, bold)
  (function(){
    var style=document.createElement('style');
    style.textContent=[
      '.exo-msg.exo-msg-bot { white-space:normal; }',
      '.exo-msg-bot a { color:var(--color-secondary); text-decoration:underline; }',
      '.exo-msg-bot code { font-family:monospace; background:rgba(0,0,0,.1); padding:.1em .3em; border-radius:3px; font-size:.88em; }',
      '.exo-msg-bot table { font-size:.84em; }',
      '[data-theme="dark"] .exo-msg-bot code { background:rgba(255,255,255,.1); }',
      /* Feature 10 — timestamps */
      '.exo-ts { display:block; font-size:.67em; opacity:.4; margin-top:.2em; letter-spacing:.01em; }',
      '.exo-msg-user .exo-ts { text-align:right; }',
      '.exo-msg-bot  .exo-ts { text-align:left; }',
      /* Feature 4 — copy order ID button */
      '.exo-copy-id { background:none; border:1px solid currentColor; border-radius:4px; cursor:pointer; font-size:.72em; opacity:.6; padding:.1em .4em; margin-left:.4em; vertical-align:middle; transition:opacity .15s; }',
      '.exo-copy-id:hover { opacity:1; }',
      /* Feature 12 — clear chat button in header */
      '.exo-clear-btn { background:none; border:none; cursor:pointer; font-size:.8rem; opacity:.45; padding:.25rem .4rem; border-radius:6px; transition:opacity .15s,background .15s; line-height:1; }',
      '.exo-clear-btn:hover { opacity:.9; background:rgba(128,128,128,.12); }',
      /* Feature 9 — broadcast banner inside chat */
      '.exo-broadcast { display:flex; align-items:center; gap:.5em; font-size:.8em; font-weight:600; padding:.55rem .8rem; background:rgba(232,164,48,.1); border-bottom:1px solid rgba(232,164,48,.2); color:var(--color-primary); }'
    ].join('\n');
    document.head.appendChild(style);
  }());

  function addMessage(text,who){
    var div=document.createElement('div');
    div.className='exo-msg exo-msg-'+who;
    var ts=dhakaNow().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    if(who==='bot'){
      div.innerHTML=text+'<time class="exo-ts">'+ts+'</time>';
      div.style.opacity='0'; div.style.transform='translateY(5px)';
      div.style.transition='opacity .25s ease, transform .25s ease';
      els.msgs.appendChild(div);
      requestAnimationFrame(function(){requestAnimationFrame(function(){
        div.style.opacity='1'; div.style.transform='translateY(0)';
        els.msgs.scrollTop=els.msgs.scrollHeight;
        // Feature 11 — haptic feedback on mobile
        if(_vibrateEnabled && navigator.vibrate) try{navigator.vibrate(28);}catch(e){}
      });});
    } else {
      div.textContent=text;
      var tsEl=document.createElement('time'); tsEl.className='exo-ts'; tsEl.textContent=ts;
      div.appendChild(tsEl);
      els.msgs.appendChild(div); els.msgs.scrollTop=els.msgs.scrollHeight;
    }
  }
  function showTyping(){
    var d=document.createElement('div'); d.className='exo-typing'; d.id='exoTypingIndicator';
    d.innerHTML='<span></span><span></span><span></span>';
    els.msgs.appendChild(d); els.msgs.scrollTop=els.msgs.scrollHeight;
  }
  function hideTyping(){ var el=document.getElementById('exoTypingIndicator'); if(el) el.remove(); }
  function renderSuggestions(list){
    els.suggestions.innerHTML='';
    (list||[]).slice(0,4).forEach(function(s){
      var btn=document.createElement('button');
      btn.type='button'; btn.className='exo-suggestion-chip'; btn.textContent=s;
      btn.addEventListener('click',function(){ submitUserText(s); });
      els.suggestions.appendChild(btn);
    });
  }
  function botReply(html,suggs){
    showTyping();
    var delay=450+Math.min((html||'').length*4,750);
    setTimeout(function(){ hideTyping(); addMessage(html,'bot'); renderSuggestions(suggs); ExoMemory.add('exo',html); },delay);
  }

  /* ─── Conversational checkout (from v3, unchanged) ─── */
  function nextCheckoutStep(buyer){
    if(buyer.qty===undefined) return 'qty';
    if(!buyer.name)  return 'name';
    if(!buyer.phone) return 'phone';
    if(!buyer.email) return 'email';
    if(!buyer.method) return 'method';
    if(!buyer.txnId) return 'txn';
    return 'done';
  }
  function startChatCheckout(productId){
    var p=PRODUCTS[productId];
    if(!p){ botReply("Sorry, I couldn't find that item — try browsing the Store directly.",['Take me to Store']); return; }
    chatCheckout={productId:productId,step:'qty',buyer:{}};
    var mem=ExoMemory.state(), prefilled=[];
    if(mem.knownPhone){ chatCheckout.buyer.phone=mem.knownPhone; prefilled.push('phone'); }
    if(mem.knownEmail){ chatCheckout.buyer.email=mem.knownEmail; prefilled.push('email'); }
    saveCheckoutState();
    resetCheckoutIdleTimer();
    var note=prefilled.length?' I\'ve already got your '+prefilled.join(' and ')+' from earlier, so I\'ll skip re-asking.':'';
    botReply('Great choice — <strong>'+p.name+'</strong> is '+fmtPrice(p.priceValue,p.priceLocalValue)+' each.'+note+' How many would you like? (Say "cancel" anytime to stop.)');
  }
  function handleChatCheckoutInput(text){
    resetCheckoutIdleTimer();
    var trimmed=text.trim(), lower=trimmed.toLowerCase();

    // Fix 2 — expanded cancel: catches "cancel", "no, cancel", "no cancel", "nope" etc.
    if(/^(cancel|stop|nevermind|never mind|quit|exit|no,?\s*cancel|nope)\b/i.test(lower)){
      chatCheckout=null; saveCheckoutState(); clearTimeout(_checkoutIdleTimer);
      botReply("No problem — order cancelled. Let me know if you'd like to try again.",['Show me the store','Take me to Help']);
      return;
    }

    // Fix 3 — "yes/continue" after resume prompt: re-prompt the current step
    if(isAffirmative(trimmed)){
      var p0=PRODUCTS[chatCheckout.productId], s0=chatCheckout.step;
      if(s0==='qty')   { botReply('Sure! How many <strong>'+p0.name+'</strong> would you like?'); return; }
      if(s0==='name')  { botReply('What name should I put on the order?'); return; }
      if(s0==='phone') { botReply('What\'s the best phone number to reach you on?'); return; }
      if(s0==='email') { botReply('And your email address for the confirmation?'); return; }
      if(s0==='method'){ botReply('How would you like to pay — bKash, Nagad, or Airtm?',['bKash','Nagad','Airtm']); return; }
      if(s0==='txn'){
        var m0=findMethod(chatCheckout.buyer.method);
        botReply('Send payment to <strong>'+m0.value+'</strong> ('+m0.label+'), then paste the Transaction ID here.');
        return;
      }
    }

    var p=PRODUCTS[chatCheckout.productId], step=chatCheckout.step;
    if(step==='qty'){
      var qty=parseInt(trimmed,10);
      if(!qty||qty<1||qty>20){ botReply('Just a number 1–20 — how many '+p.name+'?'); return; }
      chatCheckout.buyer.qty=qty;
    } else if(step==='name'){
      if(trimmed.length<2){ botReply('Please enter your name so I can put it on the order.'); return; }
      chatCheckout.buyer.name=trimmed; ExoMemory.set('userName',trimmed.split(' ')[0]);
    } else if(step==='phone'){
      if(trimmed.replace(/[\s\-+]/g,'').length<6){ botReply('Please enter a valid phone number — e.g. 01XXXXXXXXX for Bangladesh.'); return; }
      chatCheckout.buyer.phone=trimmed;
    } else if(step==='email'){
      if(!EMAIL_RE.test(trimmed)){ botReply("That doesn't look like a valid email address — please double-check."); return; }
      chatCheckout.buyer.email=trimmed;
    } else if(step==='method'){
      var mid=detectPayMethod(trimmed);
      if(!mid){ botReply('I only support bKash, Nagad, or Airtm — which works for you?',['bKash','Nagad','Airtm']); return; }
      chatCheckout.buyer.method=mid;
    } else if(step==='txn'){ chatCheckout.buyer.txnId=trimmed; }

    saveCheckoutState(); // Feature 1 — persist after each step update
    var next=nextCheckoutStep(chatCheckout.buyer);
    chatCheckout.step=next; saveCheckoutState();
    var mem=ExoMemory.state();
    if(next==='qty')   { botReply('How many '+p.name+' would you like?'); return; }
    if(next==='name')  { botReply('Got it. What name should I put on the order?'); return; }
    if(next==='phone') { botReply((mem.userName?'Thanks, '+mem.userName+'! ':'')+' What\'s the best phone number to reach you on?'); return; }
    if(next==='email') { botReply('And an email address for your order confirmation?'); return; }
    if(next==='method'){ botReply('How would you like to pay — bKash, Nagad, or Airtm?',['bKash','Nagad','Airtm']); return; }
    if(next==='txn'){
      var m=findMethod(chatCheckout.buyer.method);
      var target=m.type==='phone'?'this '+m.label+' number':'this Airtm email';
      var qty2=chatCheckout.buyer.qty||1;
      var amount=fmtPrice(p.priceValue*qty2,p.priceLocalValue*qty2); // Feature 2 — local currency
      botReply('Send <strong>'+amount+'</strong> to '+target+': <strong>'+m.value+'</strong><br>Once done, paste the Transaction ID here.');
      return;
    }
    if(next==='done'){
      var pid=chatCheckout.productId, buyer=chatCheckout.buyer;
      chatCheckout=null; saveCheckoutState(); clearTimeout(_checkoutIdleTimer);
      showTyping();
      submitOrder(pid,buyer,function(id,ok){
        if(ok) saveOrderHistory(id,pid,buyer); // Feature 3 — save to local history
        setTimeout(function(){
          hideTyping();
          // Feature 4 — copy-ID button in confirmation
          var confirmMsg = ok
            ? '🎉 Order placed! ID: <strong>'+id+'</strong><button class="exo-copy-id" data-copy="'+id+'" title="Copy order ID">📋 Copy</button><br>We\'ll verify payment and confirm within a few hours.'
            : "That didn't go through — sorry! Email theexoraworld@gmail.com with your Transaction ID (<strong>"+buyer.txnId+"</strong>) directly.";
          addMessage(confirmMsg,'bot');
          ExoMemory.add('exo',confirmMsg);
          renderSuggestions(ok?['Track my order','Take me to Store']:['Take me to Help']);
        },500);
      });
    }
  }

  /* ─── Admin command handler ─── */
  function handleAdminCmd(raw){
    var t=raw.trim().toLowerCase();
    if(t.startsWith('exo:setadmin ')){
      var p=raw.slice(13).trim();
      if(p.length<6){ botReply('⚠️ Passphrase must be at least 6 characters.'); return; }
      ExoOwner.setKey(p);
      botReply('✅ Admin passphrase set. Use <code>exo:admin [passphrase]</code> to unlock owner mode.');
      return;
    }
    if(t.startsWith('exo:admin ')){
      var attempt=raw.slice(10).trim();
      if(!ExoOwner.hasKey()){ botReply('⚠️ No key set yet. Type <code>exo:setadmin [passphrase]</code> first.'); return; }
      var r=ExoOwner.auth(attempt);
      if(r==='ok') botReply('🔐 <strong>Admin mode unlocked.</strong><br><small>Commands: <code>exo:status</code> · <code>exo:threats</code> · <code>exo:analytics</code> · <code>exo:logout</code> · <code>exo:clearchat</code></small>');
      else botReply('❌ Wrong passphrase.');
      return;
    }
    if(ExoOwner.isAuthed()){
      if(t==='exo:status'||t==='exo:report')   { botReply(ExoOwner.siteReport()); return; }
      if(t==='exo:threats'||t==='exo:guard')   { botReply(ExoOwner.threatReport()); return; }
      if(t==='exo:analytics'||t==='exo:stats') { botReply(ExoOwner.analyticsReport()); return; }
      if(t==='exo:logout') { ExoOwner.deauth(); botReply('🔒 Logged out of admin mode.'); return; }
      if(t==='exo:clearchat') { ExoMemory.clear(); els.msgs.innerHTML=''; els.suggestions.innerHTML=''; botReply('🗑️ Conversation cleared.'); return; }
      if(t==='exo:orders') { botReply(ExoOwner.ordersReport()); return; } // Feature 3
      if(t.startsWith('exo:broadcast')){ // Feature 9
        var bcast=raw.slice(13).trim();
        if(!bcast||bcast==='clear'){ localStorage.removeItem('exo_bcast'); botReply('📢 Broadcast cleared.'); }
        else { localStorage.setItem('exo_bcast',JSON.stringify({msg:bcast,ts:Date.now()})); botReply('📢 Broadcast set — new visitors will see: <em>'+bcast+'</em><br><small>Use <code>exo:broadcast clear</code> to remove it.</small>'); }
        return;
      }
      if(t==='exo:products'){
        var pids2=Object.keys(PRODUCTS);
        if(!pids2.length){ botReply('📦 No products scraped yet — check that the #store section is on the page.'); return; }
        var phtml='<strong>📦 Scraped Products ('+pids2.length+')</strong><br>';
        pids2.forEach(function(id){ var p=PRODUCTS[id]; phtml+='<code>'+id+'</code> — '+p.name+' — '+fmtUSD(p.priceValue)+' / '+fmtBDT(p.priceLocalValue)+'<br>'; });
        botReply(phtml); return;
      }
      if(t==='exo:games'){
        var gids2=Object.keys(GAMES);
        if(!gids2.length){ botReply('🎮 No games scraped yet — check that the #games section is on the page.'); return; }
        var ghtml='<strong>🎮 Scraped Games ('+gids2.length+')</strong><br>';
        gids2.forEach(function(id){ var g=GAMES[id]; ghtml+='<code>'+id+'</code> — '+g.name+' ('+g.genre+')'+(g.rating?' · ★'+g.rating:'')+'<br>'; });
        botReply(ghtml); return;
      }
      if(t==='exo:help'){ botReply('<strong>Admin commands:</strong><br><code>exo:status</code> — site health report<br><code>exo:threats</code> — guard flag log<br><code>exo:analytics</code> — session summary<br><code>exo:orders</code> — local order history<br><code>exo:products</code> — scraped product list<br><code>exo:games</code> — scraped game list<br><code>exo:broadcast [msg]</code> — set visitor announcement<br><code>exo:broadcast clear</code> — remove announcement<br><code>exo:clearchat</code> — clear this conversation<br><code>exo:logout</code> — exit admin mode'); return; }
      botReply('Unknown admin command. Type <code>exo:help</code> for the list.');
      return;
    }
    botReply('🔒 Admin mode required. Type <code>exo:admin [passphrase]</code> to unlock.');
  }

  /* ─── Main input router ─── */
  function handleUserInput(rawText){
    var trimmed=rawText.trim();
    scanEntities(trimmed);
    var mem=ExoMemory.state();

    // Admin commands take priority
    if(trimmed.toLowerCase().startsWith('exo:')){ handleAdminCmd(trimmed); return; }

    // Active checkout flow
    if(chatCheckout){ handleChatCheckoutInput(trimmed); return; }

    // Frustration → escalate
    if(isFrustrated(trimmed)){
      ExoMemory.set('fallbackStreak',0);
      botReply("Sorry you're running into trouble — let's get you to a real person fast. Email theexoraworld@gmail.com or use the Help form.",['Take me to Help']);
      return;
    }

    // Re-greet returning user by name
    if(mem.userName&&/^(hi|hello|hey|yo|sup)\b/i.test(trimmed)){
      ExoMemory.set('fallbackStreak',0);
      botReply('Hey '+mem.userName+', good to see you again! What can I help with?',['Show me the store','Popular games']);
      return;
    }

    // Affirmative/negative after product mention
    if(mem.lastProductId&&isAffirmative(trimmed)){
      var pid=mem.lastProductId; ExoMemory.set('lastProductId',null); ExoMemory.set('fallbackStreak',0);
      startChatCheckout(pid); return;
    }
    if(mem.lastProductId&&isNegative(trimmed)){
      ExoMemory.set('lastProductId',null); ExoMemory.set('fallbackStreak',0);
      botReply("No worries — let me know if you change your mind.",['Show me the store','Popular games']);
      return;
    }

    // Real-time queries
    var timeR=tryTimeQuery(trimmed);
    if(timeR){ ExoMemory.set('fallbackStreak',0); botReply(timeR); return; }

    // Page actions (theme toggle, open login/signup, scroll to top)
    var actionR=tryPageAction(trimmed);
    if(actionR){ ExoMemory.set('fallbackStreak',0); botReply(actionR); return; }

    // Arithmetic
    var mathR=tryMath(trimmed);
    if(mathR){ ExoMemory.set('fallbackStreak',0); botReply(mathR); return; }

    // Game recommendation
    var recR=tryRecommend(trimmed);
    if(recR){ ExoMemory.set('fallbackStreak',0); ExoMemory.set('lastProductId',null); botReply(recR,['Take me to Games']); return; }

    // Navigation intent ("take me to the store")
    var nav=detectNavIntent(trimmed);
    if(nav){
      ExoMemory.set('fallbackStreak',0);
      botReply('Sure — heading to '+nav.label+' now.');
      setTimeout(function(){ var el=document.getElementById(nav.id); if(el) el.scrollIntoView({behavior:'smooth'}); },500);
      return;
    }

    // Buy intent
    var buyId=detectBuyIntent(ExoNLP.norm(trimmed));
    if(buyId){ ExoMemory.set('fallbackStreak',0); ExoMemory.set('lastProductId',null); startChatCheckout(buyId); return; }

    // Weighted NLP classification
    // Track order intent — "Track my order" chip + natural language
    if(/track.*order|order.*status|where.*order|check.*order|my order/i.test(trimmed)){
      ExoMemory.set('fallbackStreak',0);
      botReply('📦 To track your order, check the email you provided at checkout — we send a confirmation once payment is verified. No email after 24 hours? Email '+lnk('mailto:theexoraworld@gmail.com','theexoraworld@gmail.com')+' with your order ID and we\'ll look it up immediately.',['Contact us','Take me to Help']);
      return;
    }

    var section=ExoContext.get();
    var clf=ExoNLP.classify(trimmed,section);

    ExoMemory.set('fallbackStreak',0);

    // Low confidence
    if(clf.score<0.45){
      var faqAns=ExoNLP.matchFaq(trimmed);
      if(faqAns){ botReply(faqAns); return; }
      ExoMemory.set('fallbackStreak',(mem.fallbackStreak||0)+1);
      var msg=pick(["I'm not totally sure about that one — try asking about the store, games, payments, or account.",
                    "I don't have a great answer for that yet. I'm best with ExoraWorld-specific questions.",
                    'Not sure I follow — want me to point you to the Store, Games, or Help section?']);
      if((mem.fallbackStreak||0)>=2) msg+=' If I\'m not getting it, email theexoraworld@gmail.com for a real answer.';
      botReply(msg,['Show me the store','Popular games','Take me to Help']);
      return;
    }

    // Route to intent responses
    var intent=clf.top;
    var productId=ExoNLP.extractProduct(trimmed);
    var gameId=ExoNLP.extractGame(trimmed);

    switch(intent){
      case 'greet':
        if(mem.greeted){ botReply(pick(['Hey again! What else can I help with?','Still here 😄 What do you need?','What\'s up? Ask me anything.']),['Show me the store','Popular games']); break; }
        ExoMemory.set('greeted',true);
        var name=ExoContext.getUserName(), g=pick(['Hey','Hello','Hi there']);
        var base=g+(name?', '+name:'')+"! I'm Exo ⚡ ";
        var sectionHints={store:'Looks like you\'re checking out the store — need help with a product or payment?',games:'Browsing games? I can tell you what\'s available and help you buy.',help:'Got a question? That\'s what I\'m here for.',faq:'Got a question? That\'s what I\'m here for.'};
        botReply(base+(sectionHints[section]||"Your guide to ExoraWorld. Ask me about the store, games, payments, account — anything!"),CHIPS[section]||CHIPS.default);
        break;

      case 'store':
        if(productId && PRODUCTS[productId]){
          var p2=PRODUCTS[productId];
          ExoMemory.set('lastProductId',productId);
          botReply('<strong>'+p2.name+'</strong><br>'+p2.desc+'<br>💰 <strong>'+fmtUSD(p2.priceValue)+' ('+fmtBDT(p2.priceLocalValue)+')</strong><br>Want to order it?',['Yes, let\'s order','No thanks','Browse the full store']);
          break;
        }
        var pids=Object.keys(PRODUCTS);
        if(!pids.length){ botReply("I'm having trouble reading the store right now — "+lnk('pages/store.html','check it directly →')); break; }
        botReply('🛒 The ExoraWorld Store has:<br><br>'+pids.map(function(id){var p=PRODUCTS[id];return'• <strong>'+p.name+'</strong> — '+fmtUSD(p.priceValue)+' ('+fmtBDT(p.priceLocalValue)+') — '+p.desc;}).join('<br>')+'<br><br>Want details on one, or should I start an order?',pids.map(function(id){return 'Tell me about '+PRODUCTS[id].name.split(' ')[0];}));
        break;

      case 'games':
        if(gameId && GAMES[gameId]){
          var g2=GAMES[gameId];
          botReply('🎮 <strong>'+g2.name+'</strong> ('+g2.genre+')<br>'+g2.desc+(g2.rating?' · Rated '+g2.rating:''),['Take me to Games','Recommend me a game']);
          break;
        }
        var gids=Object.keys(GAMES);
        if(!gids.length){ botReply("I'm having trouble reading the games list — "+lnk('pages/games.html','check the Games page directly →')); break; }
        botReply("🎮 We've got: "+gids.map(function(id){var g=GAMES[id];return'<strong>'+g.name+'</strong> ('+g.genre+')';}).join(', ')+" — all free to play. Want details on one, or a recommendation?",gids.map(function(id){return'Tell me about '+GAMES[id].name;}).concat(['Recommend me a game']));
        break;

      case 'payment':
        botReply('💳 We accept:<br><br>• <strong>bKash</strong> — 01715948039<br>• <strong>Nagad</strong> — 01715948039<br>• <strong>Airtm</strong> — iammdabidhasan@gmail.com<br><br>Send the payment, copy the Transaction ID, paste it in checkout. We confirm within a few hours.',['Start an order','How long to confirm?']);
        break;

      case 'refund':
        botReply('↩️ <strong>7-day refund</strong> on digital products. Email '+lnk('mailto:theexoraworld@gmail.com','theexoraworld@gmail.com')+' within 7 days of purchase and we\'ll sort it out.');
        break;

      case 'account': {
        var t2=ExoNLP.norm(trimmed);
        if(/forgot|reset/.test(t2)) botReply('🔑 Use the "Forgot Password" link on the login screen. Reset email arrives in a few minutes — check spam too.');
        else if(/sign up|signup|register|create/.test(t2)) botReply('👤 Sign up is free — click <strong>Sign Up</strong> in the navbar. Email/password, Google, and Facebook all work.',['Sign me up']);
        else if(ExoContext.isLoggedIn()) botReply(pick(['You\'re already logged in! 👍 Is there something specific about your account I can help with?','Your account is active. What do you need?']));
        else botReply('👤 Log in or create a free account using the button in the top navbar.',['Sign me up','Log me in']);
        break;
      }

      case 'social':
        botReply('🌐 Find ExoraWorld everywhere:<br><br>💬 Discord: '+lnk('https://discord.gg/f84dEvu2q','Join our server',true)+'<br>📘 Facebook: '+lnk('https://facebook.com/exoraworld','facebook.com/exoraworld',true)+'<br>🐦 X/Twitter: '+lnk('https://x.com/Exoraworld','@Exoraworld',true)+'<br>📸 Instagram: '+lnk('https://instagram.com/theexoraworld','@theexoraworld',true)+'<br>▶️ YouTube: '+lnk('https://youtube.com/@ExoraWorld','@ExoraWorld',true));
        break;

      case 'help':
        if((mem.frustration||0)>=2) botReply("I hear you — that's frustrating. Tell me what's wrong and I'll fix it or get you straight to the team.");
        else botReply(pick(['🛠 Tell me what\'s going on. For account or payment issues, '+lnk('mailto:theexoraworld@gmail.com','email the team')+' for replies within 24 hours.','What\'s the problem? Also, you can use the Help form at the bottom of the page or hit us on Discord for faster replies.']),['Take me to Help']);
        break;

      case 'contact':
        botReply('📬 Best ways to reach us:<br><br>• Email: '+lnk('mailto:theexoraworld@gmail.com','theexoraworld@gmail.com')+' — 24h replies<br>• Discord: '+lnk('https://discord.gg/f84dEvu2q','Join our server',true)+' — usually faster<br><br>Or use the Contact form at the bottom of this page.');
        break;

      case 'about':
        if(/founder|who made|who built|abid/.test(ExoNLP.norm(trimmed))) botReply('👤 ExoraWorld was founded by <strong>MD Abid Hasan</strong> — one home for tools, games, news, and community. '+lnk('pages/about.html','Full story →'));
        else botReply('ExoraWorld is an all-in-one digital platform — tools, games, news, gallery, and store. Founded by MD Abid Hasan. '+lnk('pages/about.html','Learn more →'));
        break;

      case 'news':    botReply('📰 Latest news: ExoraWorld v2.0 launched, Skyfall Arena Season 4 is live, and July\'s top creators were spotlighted. '+lnk('pages/news.html','Read all news →')); break;
      case 'gallery': botReply('🖼️ The Gallery shows moments from the ExoraWorld community — meetups, events, screenshots. '+lnk('pages/gallery.html','Browse →')); break;
      case 'content': botReply('📚 Tutorials, guides, and creator resources. '+lnk('content/contents.html','Explore Content →')); break;
      case 'privacy': botReply('🔒 Only what\'s needed to run the platform. You set your consent level on first visit. Data is stored locally, never sold. '+lnk('pages/privacy.html','Privacy Policy →')); break;

      case 'small_talk':
        if(/who are you|what are you/.test(ExoNLP.norm(trimmed))) botReply("I'm Exo ⚡ — ExoraWorld's built-in AI guide. I know everything about this platform and can even place orders for you right here in chat.");
        else if(/how are you/.test(ExoNLP.norm(trimmed))) botReply(pick(['All systems green ⚡ What do you need?','Running great — what can I help with?']));
        else if(/what can you do|capabilities/.test(ExoNLP.norm(trimmed))) botReply("I can answer questions, recommend games, <strong>place orders right here in chat</strong> with bKash/Nagad/Airtm, toggle the site theme, open login/signup for you, do quick math, and tell you the current time in Dhaka. What do you need?");
        else botReply(pick(['Happy to chat! Though I\'m best at ExoraWorld questions 😄','Ask me about products, games, or payments!']));
        break;

      case 'thanks':    botReply(pick(['Happy to help! 👍','Anytime!','No problem at all 😊'])); break;
      case 'compliment':botReply(pick(['Thanks so much 🙏 That means a lot!','Really appreciate that! We work hard 💪','😊 That made my day!'])); break;
      case 'bye':       botReply(pick(['See you'+(ExoContext.getUserName()?', '+ExoContext.getUserName():'')+'! 👋 Come back anytime.','Take care! ExoraWorld will be here when you need it.','Bye for now! 👋'])); break;
      case 'action':
        var ar=tryPageAction(trimmed);
        if(ar) botReply(ar);
        else botReply("I can toggle the theme, open the sign-up or login form, or scroll to the top. Try: <em>\"switch to dark mode\"</em>, <em>\"sign me up\"</em>, or <em>\"back to top\"</em>.");
        break;
      case 'time':
        var tr=tryTimeQuery(trimmed);
        if(tr) botReply(tr);
        else botReply("It's "+dhakaNow().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})+" in Dhaka right now ("+timeOfDay()+"). Support hours are 9am–9pm Dhaka time.");
        break;
      case 'math':
        var mr=tryMath(trimmed);
        if(mr) botReply(mr);
        else botReply("I can do basic arithmetic — try something like <em>\"25 * 4\"</em> or <em>\"100 / 7\"</em>.");
        break;
      case 'recommend':
        var rr=tryRecommend(trimmed);
        if(rr) botReply(rr,['Take me to Games']);
        else botReply("Tell me what kind of game you enjoy — racing, RPG, shooter, or runner — and I'll find the best match in our lineup.",['Recommend me a game','Take me to Games']);
        break;

      default: {
        var faq2=ExoNLP.matchFaq(trimmed);
        if(faq2){ botReply(faq2); break; }
        ExoMemory.set('fallbackStreak',(mem.fallbackStreak||0)+1);
        var fb=pick(["I'm not totally sure about that — try asking about the store, games, payments, or account.",
                     "I don't have a great answer for that yet. I'm best with ExoraWorld-specific questions.",
                     'Not sure I follow — want me to point you to the Store, Games, or Help section?']);
        if((mem.fallbackStreak||0)>=2) fb+=' Email theexoraworld@gmail.com for a real answer fast.';
        botReply(fb,['Show me the store','Popular games','Take me to Help']);
      }
    }
  }

  var CHIPS={
    home:   ['Show me the store','Popular games','How do I pay?','About ExoraWorld'],
    store:  ['Tell me about the products','How do I pay?','Refund policy','Start an order'],
    games:  ['What games are there?','Recommend me a game','Take me to Games'],
    help:   ['Account problem','Payment issue','Contact the team'],
    faq:    ['How do I pay?','Refund policy','Account help'],
    about:  ["Who's the founder?",'Discord community','Contact us'],
    default:['Show me the store','How to pay?','Discord server','Contact us']
  };

  function submitUserText(text){
    text=(text||'').trim(); if(!text) return;
    if(!checkRateLimit()) return; // Feature 7 — rate limit
    addMessage(text,'user'); ExoMemory.add('user',text);
    els.suggestions.innerHTML=''; els.input.value='';
    handleUserInput(text);
  }

  /* ─────────────────────────────────────────────────────────
     WIDGET INIT
     ───────────────────────────────────────────────────────── */
  function initExoWidget(){
    els.trigger     = document.getElementById('exoTrigger');
    els.panel       = document.getElementById('exoPanel');
    els.closeBtn    = document.getElementById('exoClose');
    els.msgs        = document.getElementById('exoMsgs');
    els.suggestions = document.getElementById('exoSuggestions');
    els.input       = document.getElementById('exoInput');
    els.sendBtn     = document.getElementById('exoSendBtn');
    if(!els.trigger) return;

    /* ── Feature 12: Inject clear-chat button into header ─── */
    var headerEl = els.panel.querySelector('.exo-header, .exo-panel-header, [class*="header"]');
    if(headerEl){
      var clearBtn=document.createElement('button');
      clearBtn.className='exo-clear-btn'; clearBtn.title='Clear chat'; clearBtn.setAttribute('aria-label','Clear chat');
      clearBtn.innerHTML='🗑️';
      clearBtn.addEventListener('click',function(){
        if(!confirm('Clear this conversation?')) return;
        ExoMemory.clear(); els.msgs.innerHTML=''; els.suggestions.innerHTML='';
        sessionStorage.removeItem('exo_co');
        botReply(pick(['Fresh start! How can I help?','Chat cleared ✨ What do you need?']));
      });
      // Insert before the existing close button
      headerEl.insertBefore(clearBtn, els.closeBtn);
    }

    /* ── Feature 4: Delegated click handler for copy-ID buttons ─ */
    els.msgs.addEventListener('click',function(e){
      var btn=e.target.closest('.exo-copy-id');
      if(!btn) return;
      var val=btn.getAttribute('data-copy');
      function onCopied(){ btn.textContent='✓ Copied!'; setTimeout(function(){btn.innerHTML='📋 Copy';},1500); }
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(val).then(onCopied).catch(function(){ execCmdCopy(val); onCopied(); });
      } else { execCmdCopy(val); onCopied(); }
    });

    function setPulse(show){ var p=els.trigger.querySelector('.exo-trigger-pulse'); if(p) p.style.display=show?'block':'none'; }

    /* ── Feature 5: Placeholder rotation ────────────────────── */
    var PLACEHOLDERS=['Ask me anything…','How do I pay?','Tell me about the products','Recommend me a game','What time is it in Dhaka?','Switch to dark mode','Who is the founder?','How do refunds work?','Start an order','Join the Discord?'];
    function startPlaceholders(){
      if(_placeholderTimer) return;
      els.input.placeholder=PLACEHOLDERS[0];
      _placeholderTimer=setInterval(function(){
        if(document.activeElement!==els.input&&!els.input.value){
          _placeholderIdx=(_placeholderIdx+1)%PLACEHOLDERS.length;
          els.input.placeholder=PLACEHOLDERS[_placeholderIdx];
        }
      },3500);
    }
    function stopPlaceholders(){ clearInterval(_placeholderTimer); _placeholderTimer=null; }

    /* ── Feature 6: Typing-to-search suggestions ─────────────── */
    var ALL_SEARCH_CHIPS=['Show me the store','How do I pay?','Refund policy','Popular games','About ExoraWorld','Discord server','Contact us','Toggle dark mode','Recommend me a game','Account help','What time is it?','Who is the founder?','Start an order','Switch to dark mode'];
    els.input.addEventListener('input',function(){
      var val=els.input.value.trim().toLowerCase();
      if(val.length<2){ renderSuggestions(CHIPS[ExoContext.get()]||CHIPS.default); return; }
      var matches=ALL_SEARCH_CHIPS.filter(function(c){ return c.toLowerCase().indexOf(val)>-1; });
      renderSuggestions(matches.length?matches.slice(0,4):[]);
    });

    function open(){
      els.panel.classList.add('open');
      els.panel.setAttribute('aria-hidden','false');
      els.trigger.setAttribute('aria-expanded','true');
      setPulse(false);
      startPlaceholders(); // Feature 5

      /* ── Feature 9: Show broadcast banner if set ──────────── */
      var bcast=null;
      try{ bcast=JSON.parse(localStorage.getItem('exo_bcast')||'null'); }catch(e){}
      var bcastBar=els.panel.querySelector('.exo-broadcast');
      if(bcast&&bcast.msg){
        if(!bcastBar){
          bcastBar=document.createElement('div'); bcastBar.className='exo-broadcast';
          bcastBar.innerHTML='📢 <span>'+bcast.msg+'</span>';
          els.msgs.parentNode.insertBefore(bcastBar,els.msgs);
        }
      } else { if(bcastBar) bcastBar.remove(); }

      /* ── Feature 1: Resume in-progress checkout ───────────── */
      var hadCheckout=restoreCheckoutState();

      var history=ExoMemory.get();
      if(history.length===0){
        /* ── Feature 13: Language-aware greeting ──────────── */
        var section=ExoContext.get(), uname=ExoContext.getUserName();
        var localG=localGreeting();
        var base=localG||(uname?'Hey, '+uname:pick(['Hey','Hello','Hi']))+"! I'm Exo ⚡ ";
        var hint={store:'Checking out the store? Need help with a product or payment?',games:'Browsing games? I can tell you what\'s available or place an order.',help:'Got a problem? That\'s exactly what I\'m here for.',faq:'Questions? That\'s what I\'m here for.'};
        botReply(base+(hint[section]||"Your guide to ExoraWorld. Ask me about the store, games, payments, account — anything!"),CHIPS[section]||CHIPS.default);
        ExoMemory.set('greeted',true);
        if(hadCheckout&&chatCheckout&&PRODUCTS[chatCheckout.productId]){
          setTimeout(function(){ botReply('👋 By the way — you were in the middle of ordering <strong>'+PRODUCTS[chatCheckout.productId].name+'</strong>. Want to pick up where you left off?',['Yes, continue','No, cancel']); },1200);
        }
      } else if(els.msgs.children.length===0){
        history.slice(-10).forEach(function(m){ addMessage(m.text,m.role==='user'?'user':'bot'); });
      }
      els.input.focus();
    }

    function close(){
      els.panel.classList.remove('open');
      els.panel.setAttribute('aria-hidden','true');
      els.trigger.setAttribute('aria-expanded','false');
      stopPlaceholders(); // Feature 5
    }

    els.trigger.addEventListener('click',function(){ els.panel.classList.contains('open')?close():open(); });
    els.closeBtn.addEventListener('click',close);
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&els.panel.classList.contains('open')) close(); });
    els.sendBtn.addEventListener('click',function(){ submitUserText(els.input.value); });
    els.input.addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); submitUserText(els.input.value); } });

    // Close on outside click
    document.addEventListener('click',function(e){ if(els.panel.classList.contains('open')&&!els.panel.contains(e.target)&&!els.trigger.contains(e.target)) close(); });

    // Proactive: pulse after 45s idle if not opened
    setTimeout(function(){ if(!els.panel.classList.contains('open')) setPulse(true); },45000);

    // Proactive: pulse when user enters Store section
    if(window.IntersectionObserver){
      var storeEl=document.getElementById('store');
      if(storeEl){
        var sio=new IntersectionObserver(function(entries){
          if(entries[0].isIntersecting&&!els.panel.classList.contains('open')) setPulse(true);
        },{threshold:.5});
        sio.observe(storeEl);
      }
    }
  }

  /* ─────────────────────────────────────────────────────────
     BOOT — scrape live data FIRST, then wire up everything
     ───────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded',function(){
    PRODUCTS = scrapeProducts();
    GAMES    = scrapeGames();
    initCheckoutModal();
    initExoWidget();
  });

}());
