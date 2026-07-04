/* ═════════════════════════════
   ExoraWorld — main.js
   Extracted from index.html for caching + deferred load.
   Change: stars 40 → 25 (same effect, 37% less CPU)
════════════════════════════= */

// ── CONFIG
const CFG = {
  bkash:  '01715948039',
  nagad:  '01715948039',
  airtm:  'iammdabidhasan@gmail.com',
  skrill: 'iammdabidhasan@gmail.com',
  btc:    '134WpYQ2qKSQ9hdbgVYm7JZneRnBEuchPL',
  eth:    '0x18554a980ff6445989de841a602f7cfdb897a275',
  usdt:   '0x18554a980ff6445989de841a602f7cfdb897a275',
  sol:    'AdYq6r68TbsRuygcvuHwq4hWjsfoytvdWewc1TdNSkyK',
  bnb:    '0x18554a980ff6445989de841a602f7cfdb897a275',
  formspree: 'https://formspree.io/f/maqaprqk',
  // ── TELEGRAM NOTIFICATIONS (optional but recommended!)
  // Step 1: Message @BotFather on Telegram → /newbot → copy the token below
  // Step 2: Message @userinfobot on Telegram → copy your Chat ID below
  // Once filled, you'll get instant Telegram messages + screenshots for every order!
  telegramBot:  '', // e.g. '7123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxx'
  telegramChat: '', // e.g. '123456789'

  // ── HERO BACKGROUND (optional)
  // Set ONE of these to replace the default stars background.
  // Video takes priority over image if both are set.
  // Leave both as '' to keep the default stars/dark background.
  heroVideo: '', // e.g. 'https://example.com/your-video.mp4'  → loops silently
  heroBg:    '', // e.g. 'https://example.com/your-image.jpg'  → static background

  // ── HERO FALLBACK (shown instantly while Worker photos are loading)
  // This appears immediately on page load — Worker photos fade over it once ready.
  // Great for a branded still or short loop. Leave empty to show stars instead.
  heroFallbackVideo: '', // e.g. 'https://example.com/fallback.mp4'
  heroFallbackBg:    '', // e.g. 'https://example.com/fallback.jpg'
};


// ── CURSOR (pointer devices only)
if(window.matchMedia('(pointer:fine)').matches) {
const cur=document.getElementById('cur'),trail=document.getElementById('cur-trail');
let mx=0,my=0,tx=0,ty=0;
document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY});
(function loop(){cur.style.left=mx+'px';cur.style.top=my+'px';tx+=(mx-tx)*.1;ty+=(my-ty)*.1;trail.style.left=tx+'px';trail.style.top=ty+'px';requestAnimationFrame(loop)})();
document.querySelectorAll('a,button,.prod-card,.tmpl-card,.course-card,.ai-card,.svc-row,.faq-q').forEach(el=>{
  el.addEventListener('mouseenter',()=>document.body.classList.add('hov'));
  el.addEventListener('mouseleave',()=>document.body.classList.remove('hov'));
});
document.addEventListener('mousedown',()=>document.body.classList.add('clicking'));
document.addEventListener('mouseup',()=>document.body.classList.remove('clicking'));
}

// ── STARS
(function(){
  const s=document.getElementById('stars');
  for(let i=0;i<25;i++){
    const el=document.createElement('div');
    el.classList.add('star');
    const sz=Math.random()*2.5+.5;
    el.style.cssText=`width:${sz}px;height:${sz}px;left:${Math.random()*100}%;top:${Math.random()*100}%;animation-duration:${2+Math.random()*4}s;animation-delay:${Math.random()*-6}s`;
    s.appendChild(el);
  }
})();

// ── HERO BACKGROUND (image or video from CFG)
(function(){
  const hero = document.getElementById('hero');
  const wrap = document.getElementById('hero-bg-media');
  if(CFG.heroVideo) {
    // Video background — looping, muted, autoplay
    const vid = document.createElement('video');
    vid.src = CFG.heroVideo;
    vid.autoplay = true;
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.setAttribute('playsinline','');
    wrap.appendChild(vid);
    wrap.style.display = 'block';
    hero.classList.add('has-custom-bg');
  } else if(CFG.heroBg) {
    // Image background
    const img = document.createElement('img');
    img.src = CFG.heroBg;
    img.alt = '';
    img.setAttribute('aria-hidden','true');
    wrap.appendChild(img);
    wrap.style.display = 'block';
    hero.classList.add('has-custom-bg');
  }
  // If both are empty — default stars background stays, nothing changes
})();

// ══════════════════════════════════════════════════════════════
// PIXI VAULT — Simple manual photo grid (no fetching)
// Photos are hardcoded in HTML. Edit src="" attributes to change.
// ══════════════════════════════════════════════════════════════

// ── Filter pills (photo / video / all)
document.querySelectorAll('.pv-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pv-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.pf;
    document.querySelectorAll('#pvGrid .pv-card').forEach(card => {
      const cat = card.dataset.cat || 'photo';
      card.style.display = (f === 'all' || cat === f) ? '' : 'none';
    });

  });
});

// ── Lightbox
function pvOpenLb(url, title, type) {
  const wrap = document.getElementById('pvLbWrap');
  wrap.innerHTML = '';
  if((type||'photo') === 'video') {
    const v = document.createElement('video');
    v.src = url; v.controls = true; v.autoplay = true; v.playsInline = true;
    v.style.cssText = 'max-width:100%;max-height:75vh;object-fit:contain;background:#000;outline:none;';
    wrap.appendChild(v);
  } else {
    const img = document.createElement('img');
    img.src = url; img.alt = title || '';
    img.style.cssText = 'max-width:100%;max-height:75vh;object-fit:contain;display:block;';
    wrap.appendChild(img);
  }
  document.getElementById('pvLbTitle').textContent = title || 'Untitled';
  document.getElementById('pvLbMeta').textContent = (type === 'video' ? 'Video' : 'Photo') + ' · Free Download';
  const dlBtn = document.getElementById('pvLbDl');
  dlBtn.href = url; dlBtn.download = (title || 'photo').replace(/\s+/g,'-').toLowerCase() + (type === 'video' ? '.mp4' : '.jpg');
  document.getElementById('pvLb').classList.add('open');
  document.body.style.overflow = 'hidden';

}
function pvCloseLb() {
  const v = document.querySelector('#pvLbWrap video');
  if(v) { v.pause(); v.src = ''; }
  document.getElementById('pvLb').classList.remove('open');
  document.body.style.overflow = '';

}
document.getElementById('pvLbClose').addEventListener('click', pvCloseLb);
document.getElementById('pvLb').addEventListener('click', e => {
  if(e.target === document.getElementById('pvLb')) pvCloseLb();
});
document.addEventListener('keydown', e => { if(e.key === 'Escape') pvCloseLb(); });

// ── HERO FALLBACK (shown instantly while page loads)
(function pvFallback() {
  const wrap = document.getElementById('hero-bg-fallback');
  if(!wrap) return;
  if(CFG.heroFallbackVideo) {
    const v = document.createElement('video');
    v.src = CFG.heroFallbackVideo;
    v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    v.setAttribute('playsinline','');
    wrap.appendChild(v);
    wrap.style.display = 'block';
    document.getElementById('hero').classList.add('has-custom-bg');
  } else if(CFG.heroFallbackBg) {
    const img = document.createElement('img');
    img.src = CFG.heroFallbackBg; img.alt = ''; img.setAttribute('aria-hidden','true');
    wrap.appendChild(img);
    wrap.style.display = 'block';
    document.getElementById('hero').classList.add('has-custom-bg');
  }
})();

// ══════════════════════════════════════════════════════════════
// Sound effects removed.

// ══════════════════════════════════════════════════════════════
// GAMES SECTION — Fetch previews from games.html
// ══════════════════════════════════════════════════════════════
(async function initGames() {
  const grid = document.getElementById('gamesGrid');
  if(!grid) return;

  // Fallback game cards (shown if fetch fails or games.html has no parseable cards)
  const fallbackGames = [
    { title:'Space Dodge', desc:'Navigate your ship through endless asteroid fields. How long can you survive the void?', tag:'Arcade · Action', icon:'🚀', color:'gt-violet', link:'games.html' },
    { title:'Pixel Quest', desc:'A retro pixel adventure across ExoraWorld dungeons. Explore, fight and collect loot.', tag:'RPG · Adventure', icon:'⚔️', color:'gt-cyan', link:'games.html' },
    { title:'Mind Match', desc:'Test your memory and pattern recognition. Beat your own high score every round.', tag:'Puzzle · Memory', icon:'🧠', color:'gt-gold', link:'games.html' },
  ];

  function buildGameCard(g, delay=0) {
    const card = document.createElement('div');
    card.className = 'game-card reveal';
    card.style.animationDelay = delay + 'ms';
    card.innerHTML = `
      <div class="game-thumb ${g.color||'gt-violet'}">
        ${g.img ? `<img src="${g.img}" alt="${g.title}" loading="lazy">` : `<div class="game-thumb-placeholder">${g.icon||'🎮'}</div>`}
        <div class="game-thumb-orb game-thumb-orb-v" style="top:20%;left:15%"></div>
        <span class="game-badge">FREE</span>
        <div class="game-play-icon"><svg width="14" height="14" fill="#fff" viewBox="0 0 16 16"><path d="M6 3.5l7 4.5-7 4.5V3.5z"/></svg></div>
      </div>
      <div class="game-body">
        <div class="game-tag">${g.tag||'Browser Game'}</div>
        <div class="game-name">${g.title||'Untitled Game'}</div>
        <div class="game-desc">${g.desc||'A fun browser game by ExoraWorld.'}</div>
      </div>
      <div class="game-foot">
        <div class="game-meta">🌐 Browser &nbsp;·&nbsp; Free</div>
        <a href="${g.link||'games.html'}" class="game-play-btn">▶ Play Now</a>
      </div>`;

    return card;
  }

  try {
    const res = await fetch('games.html');
    if(!res.ok) throw new Error('fetch fail');
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Try to extract game cards from various common selectors
    const selectors = ['.game-card','.game-item','[data-game]','.card[data-type="game"]','.game','.game-box'];
    let gameEls = [];
    for(const sel of selectors) {
      gameEls = [...doc.querySelectorAll(sel)];
      if(gameEls.length) break;
    }

    if(gameEls.length >= 2) {
      grid.innerHTML = '';
      gameEls.slice(0,6).forEach((el,i) => {
        const titleEl = el.querySelector('h1,h2,h3,h4,.game-name,.game-title,.title');
        const descEl = el.querySelector('p,.game-desc,.description,.desc');
        const tagEl = el.querySelector('.tag,.badge,.category,.game-tag,.game-cat');
        const imgEl = el.querySelector('img');
        const linkEl = el.querySelector('a[href]');
        const g = {
          title: titleEl?.textContent?.trim() || 'Game',
          desc: descEl?.textContent?.trim() || 'Play now on ExoraWorld.',
          tag: tagEl?.textContent?.trim() || 'Browser Game',
          img: imgEl?.src || '',
          icon: '🎮',
          color: ['gt-violet','gt-cyan','gt-gold','gt-pink','gt-blue','gt-green'][i%6],
          link: linkEl?.getAttribute('href') || 'games.html',
        };
        grid.appendChild(buildGameCard(g, i*80));
      });
    } else {
      // Fallback
      grid.innerHTML = '';
      fallbackGames.forEach((g,i) => grid.appendChild(buildGameCard(g, i*80)));
    }
  } catch(e) {
    grid.innerHTML = '';
    fallbackGames.forEach((g,i) => grid.appendChild(buildGameCard(g, i*80)));
  }
  // Re-observe new elements for scroll reveal
  document.querySelectorAll('#gamesGrid .reveal').forEach(el => ro.observe(el));
})();

// ══════════════════════════════════════════════════════════════
// NEWS SECTION — Fetch previews from news.html
// ══════════════════════════════════════════════════════════════
(async function initNews() {
  const grid = document.getElementById('newsGrid');
  if(!grid) return;

  const fallbackNews = [
    { title:'ExoraWorld Launches New Game Zone', excerpt:'A brand new interactive gaming section is now live — featuring browser games built with pure HTML, CSS and JavaScript.', date:'May 2025', cat:'Launch', color:'ni-purple', featured:true, link:'news.html' },
    { title:'PixiVault Gallery Updated', excerpt:'New high-resolution photos from Bangladesh added to the free gallery. Download and use freely.', date:'Apr 2025', cat:'Update', color:'ni-dark', link:'news.html' },
    { title:'New AI Pack Released', excerpt:'The Ultimate Prompt Bible v2 drops with 200 new prompts for visual storytelling and code generation.', date:'Mar 2025', cat:'Release', color:'ni-pink', link:'news.html' },
  ];

  function buildNewsCard(n, delay=0) {
    const card = document.createElement('div');
    card.className = 'news-card' + (n.featured ? ' news-card-featured' : '') + ' reveal';
    card.style.animationDelay = delay + 'ms';
    card.innerHTML = `
      <div class="news-img ${n.color||'ni-dark'}">
        ${n.img ? `<img src="${n.img}" alt="${n.title}" loading="lazy">` : `<div class="news-img-placeholder">${n.icon||'📰'}</div>`}
        <span class="news-cat-chip">${n.cat||'News'}</span>
      </div>
      <div class="news-body">
        <div class="news-date">${n.date||'2025'}</div>
        <div class="news-title">${n.title||'ExoraWorld News'}</div>
        <div class="news-excerpt">${n.excerpt||'Read the latest from ExoraWorld.'}</div>
        <div class="news-foot">
          <a href="${n.link||'news.html'}" class="news-read-btn">Read more</a>
          <span class="news-author">ExoraWorld</span>
        </div>
      </div>`;

    card.addEventListener('click', () => { window.location.href = n.link||'news.html'; });
    return card;
  }

  try {
    const res = await fetch('news.html');
    if(!res.ok) throw new Error('fetch fail');
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const selectors = ['.news-card','.news-item','article','.post','.article','[data-news]','.news-box'];
    let newsEls = [];
    for(const sel of selectors) {
      newsEls = [...doc.querySelectorAll(sel)];
      if(newsEls.length) break;
    }

    if(newsEls.length >= 2) {
      grid.innerHTML = '';
      newsEls.slice(0,4).forEach((el,i) => {
        const titleEl = el.querySelector('h1,h2,h3,h4,.news-title,.title');
        const excerptEl = el.querySelector('p,.news-excerpt,.excerpt,.desc,.summary');
        const dateEl = el.querySelector('time,.date,.news-date');
        const catEl = el.querySelector('.category,.cat,.badge,.news-cat');
        const imgEl = el.querySelector('img');
        const linkEl = el.querySelector('a[href]');
        const n = {
          title: titleEl?.textContent?.trim() || 'News',
          excerpt: excerptEl?.textContent?.trim()?.slice(0,140) || 'Read on ExoraWorld.',
          date: dateEl?.textContent?.trim() || '2025',
          cat: catEl?.textContent?.trim() || 'News',
          img: imgEl?.src || '',
          icon: '📰',
          color: ['ni-dark','ni-purple','ni-pink','ni-blue'][i%4],
          featured: i === 0,
          link: linkEl?.getAttribute('href') || 'news.html',
        };
        grid.appendChild(buildNewsCard(n, i*90));
      });
    } else {
      grid.innerHTML = '';
      fallbackNews.forEach((n,i) => grid.appendChild(buildNewsCard(n, i*90)));
    }
  } catch(e) {
    grid.innerHTML = '';
    fallbackNews.forEach((n,i) => grid.appendChild(buildNewsCard(n, i*90)));
  }
  document.querySelectorAll('#newsGrid .reveal').forEach(el => ro.observe(el));
})();
// ── DEBOUNCED SCROLL HANDLER (prevents excessive reflows/repaints)
let scrollTimeout, lastScrollY = 0;
window.addEventListener('scroll',()=>{
  if(scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const isScrolled = window.scrollY > 60;
    const nav = document.getElementById('nav');
    if(isScrolled) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }, 10); // Debounce for 10ms
}, {passive: true}); // Use passive flag for better scroll performance

// ── MORE ROW TOGGLE
let moreOpen=false;
/* toggleMore → exo-core.js */

// Close more row when clicking outside
document.addEventListener('click',function(e){
  if(moreOpen && !e.target.closest('#moreBtn') && !e.target.closest('#moreRow')){
    moreOpen=false;
    document.getElementById('moreBtn').classList.remove('open');
    document.getElementById('moreRow').classList.remove('open');
  }
});

// Close more row on nav link click
document.querySelectorAll('.nav-more-inner a').forEach(a=>{
  a.addEventListener('click',()=>{
    moreOpen=false;
    document.getElementById('moreBtn').classList.remove('open');
    document.getElementById('moreRow').classList.remove('open');
  });
});

// ── MOBILE NAV
/* openMob → exo-core.js */
document.getElementById('mobToggle').onclick=openMob;
document.getElementById('mobClose').onclick=()=>closeMob();
/* closeMob → exo-core.js */

// ── CLOCK
function tick(){
  const now=new Date(),tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('hc-time').textContent=now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  document.getElementById('hc-date').textContent=now.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'});
  document.getElementById('hc-tz').textContent=tz.split('/').pop().replace(/_/g,' ');
}
tick();setInterval(tick,1000);

// ── REVEAL ON SCROLL
const ro=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('vis');e.target.classList.add('revealed');ro.unobserve(e.target);}}),{threshold:.08,rootMargin:'0px 0px -50px 0px'});
document.querySelectorAll('.reveal').forEach(el=>ro.observe(el));

// ── COUNT UP
const co=new IntersectionObserver(es=>es.forEach(e=>{
  if(!e.isIntersecting)return;
  const el=e.target,t=+el.dataset.target;
  let c=0,s=t/60;
  const ti=setInterval(()=>{c=Math.min(c+s,t);el.textContent=Math.floor(c)+'+';if(c>=t)clearInterval(ti)},25);
  co.unobserve(el);
}),{threshold:.5});
document.querySelectorAll('[data-target]').forEach(el=>co.observe(el));

// ── AUTH MODAL
/* openAuth → exo-core.js */
/* closeAuth → exo-core.js */
document.getElementById('authModal').addEventListener('click',function(e){if(e.target===this)closeAuth()});
/* switchAuth → exo-core.js */
async function handleAuth(type){
  const btn=document.querySelector('#panel-'+type+' .modal-submit');
  const errBox=document.getElementById('auth-error-'+type);
  if(errBox){errBox.style.display='none';errBox.textContent='';}
  btn.dataset.label=btn.textContent;
  btn.textContent='Loading...';btn.disabled=true;
  try{
    if(type==='login'){
      const email=document.getElementById('login-email').value.trim();
      const password=document.getElementById('login-password').value;
      await ExoAuth.signInEmail(email,password);
    }else{
      const name=document.getElementById('reg-name').value.trim();
      const email=document.getElementById('reg-email').value.trim();
      const password=document.getElementById('reg-password').value;
      await ExoAuth.signUpEmail(name,email,password);
    }
    closeAuth();
  }catch(err){
    if(errBox){errBox.textContent=ExoAuth.friendlyError(err);errBox.style.display='block';}
    else alert(ExoAuth.friendlyError(err));
  }finally{
    btn.textContent=btn.dataset.label;
    btn.disabled=false;
  }
}
async function handleSocialAuth(provider){
  try{
    if(provider==='google') await ExoAuth.signInGoogle();
    else if(provider==='facebook') await ExoAuth.signInFacebook();
    closeAuth();
  }catch(err){
    alert(ExoAuth.friendlyError(err));
  }
}

// ── PAYMENT MODAL
let curProd=null;
function openPay(prod){
  curProd=prod;
  document.getElementById('pm-icon').textContent=prod.icon;
  document.getElementById('pm-name').textContent=prod.name;
  document.getElementById('pm-price').textContent=prod.price;
  document.getElementById('bkash-num').textContent=CFG.bkash;
  document.getElementById('nagad-num').textContent=CFG.nagad;
  document.getElementById('airtm-acc').textContent=CFG.airtm;
  document.getElementById('skrill-acc').textContent=CFG.skrill;
  document.getElementById('btc-addr').textContent=CFG.btc||'YOUR_BTC_WALLET_ADDRESS';
  document.getElementById('eth-addr').textContent=CFG.eth||'YOUR_ETH_WALLET_ADDRESS';
  document.getElementById('usdt-addr').textContent=CFG.usdt||'YOUR_USDT_TRC20_ADDRESS';
  document.getElementById('sol-addr').textContent=CFG.sol||'YOUR_SOL_WALLET_ADDRESS';
  document.getElementById('bnb-addr').textContent=CFG.bnb||'YOUR_BNB_BSC_ADDRESS';
  document.getElementById('pm-buyer').style.display='flex';
  document.getElementById('pm-payment').style.display='none';
  document.getElementById('pm-success').style.display='none';
  document.getElementById('pm-bname').value='';
  document.getElementById('pm-bemail').value='';
  document.getElementById('pm-bphone').value='';
  ['bkash','nagad','airtm','skrill','btc','eth','usdt','sol','bnb'].forEach(m=>{
    const el=document.getElementById('txn-'+m);if(el)el.value='';
  });
  switchPay('bkash');
  document.getElementById('pay-modal').classList.add('open');
  document.body.style.overflow='hidden';
}
function closePay(){document.getElementById('pay-modal').classList.remove('open');document.body.style.overflow='';}
document.getElementById('pay-modal').addEventListener('click',function(e){if(e.target===this)closePay()});

function toPayStep(){
  const name=document.getElementById('pm-bname').value.trim();
  const email=document.getElementById('pm-bemail').value.trim();
  if(!name||!email){alert('Please enter your name and email address.');return;}
  if(!/\S+@\S+\.\S+/.test(email)){alert('Please enter a valid email address — your product will be sent here.');return;}
  document.getElementById('pm-buyer').style.display='none';
  document.getElementById('pm-payment').style.display='block';
}

const allPayMethods=['bkash','nagad','airtm','skrill','btc','eth','usdt','sol','bnb'];
function switchPay(m){
  document.querySelectorAll('.ptab').forEach((t,i)=>t.classList.toggle('on',allPayMethods[i]===m));
  document.querySelectorAll('.ppanel').forEach(p=>p.classList.remove('on'));
  const panel=document.getElementById('pp-'+m);
  if(panel)panel.classList.add('on');
}

function copyN(id,btn){
  const el=document.getElementById(id);
  if(!el)return;
  navigator.clipboard.writeText(el.textContent).then(()=>{
    btn.textContent='Copied!';btn.classList.add('copied');
    setTimeout(()=>{btn.textContent='Copy';btn.classList.remove('copied')},2000);
  }).catch(()=>{
    // Fallback for older browsers
    const ta=document.createElement('textarea');
    ta.value=el.textContent;document.body.appendChild(ta);ta.select();
    document.execCommand('copy');document.body.removeChild(ta);
    btn.textContent='Copied!';btn.classList.add('copied');
    setTimeout(()=>{btn.textContent='Copy';btn.classList.remove('copied')},2000);
  });
}

async function submitOrder(method, ev){
  const txnMap={bKash:'txn-bkash',Nagad:'txn-nagad',Airtm:'txn-airtm',Skrill:'txn-skrill',Bitcoin:'txn-btc',Ethereum:'txn-eth',USDT:'txn-usdt',Solana:'txn-sol',BNB:'txn-bnb'};
  const txnEl=document.getElementById(txnMap[method]);
  const txn=txnEl?txnEl.value.trim():'';
  if(!txn){alert('Please enter your Transaction ID / Hash.');return;}
  const orderId='EW-'+Date.now().toString(36).toUpperCase();
  const email=document.getElementById('pm-bemail').value.trim();
  const body={
    _subject:`🛒 Order [${orderId}] — ${curProd.name}`,
    order_id:orderId,product:curProd.name,price:curProd.price,
    method,txn,name:document.getElementById('pm-bname').value,
    email,phone:document.getElementById('pm-bphone').value,
    time:new Date().toLocaleString('en-BD',{timeZone:'Asia/Dhaka'})
  };
  const btn=ev.currentTarget;btn.disabled=true;btn.textContent='Submitting...';
  try{
    await fetch(CFG.formspree,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});
  }catch(e){}
  document.getElementById('pm-payment').style.display='none';
  document.getElementById('success-email').textContent=email;
  document.getElementById('success-oid').textContent='Order ID: '+orderId;
  document.getElementById('pm-success').style.display='block';
  btn.disabled=false;btn.textContent='Submit →';
}

// ── STORE FILTER
document.querySelectorAll('.filter-btn').forEach(btn=>{
  btn.addEventListener('click',function(){
    document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('on'));
    this.classList.add('on');
    const f=this.dataset.filter;
    document.querySelectorAll('.prod-card').forEach(c=>{
      c.style.display=(f==='all'||c.dataset.cat===f)?'block':'none';
    });
  });
});

// ── FAQ
function toggleFaq(el){el.parentElement.classList.toggle('open')}

// ── HELP FORM
document.getElementById('helpForm').addEventListener('submit',async function(e){
  e.preventDefault();
  const btn=document.getElementById('hfBtn'),status=document.getElementById('hf-status');
  const name=document.getElementById('hf-name').value.trim(),contact=document.getElementById('hf-contact').value.trim();
  if(!name||!contact)return;
  btn.disabled=true;btn.textContent='Sending...';
  try{
    const res=await fetch(CFG.formspree,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({
      _subject:`💬 [${document.getElementById('hf-topic').value||'Enquiry'}] from ${name}`,
      name,contact,topic:document.getElementById('hf-topic').value,msg:document.getElementById('hf-msg').value
    })});
    if(res.ok){
      status.style.cssText='display:block;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);color:rgba(16,185,129,.8);padding:10px 12px;font-family:var(--f-mono);font-size:.6rem;letter-spacing:.1em;margin-top:8px';
      status.textContent='✓ Message sent! Abid will reply soon.';
      this.reset();
    }else throw new Error();
  }catch{
    status.style.cssText='display:block;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:rgba(239,68,68,.75);padding:10px 12px;font-family:var(--f-mono);font-size:.6rem;letter-spacing:.1em;margin-top:8px';
    status.textContent='✗ Error. Please email directly.';
  }
  btn.disabled=false;btn.textContent='Send Message →';
});

// ══════════════════════════════════════════════════════════════
// EXO AI ENGINE v4.0 — Smart · Conversational Checkout · Screenshot Proof
// ══════════════════════════════════════════════════════════════

// ── SITE MAP
const EXO_SITEMAP = {
  home:        { url:'index.html',    label:'Home',           keys:['home','main','start','index','front'] },
  store:       { url:'store.html',    label:'Store',          keys:['store','shop','buy','purchase','product','item','marketplace'] },
  gallery:     { url:'gallery.html',  label:'Gallery',        keys:['gallery','portfolio','art','artwork','showcase','photo'] },
  games:       { url:'games.html',    label:'Games',          keys:['game','play','gaming','fun','snake','tetris','void runner','gravity','memory','arcade'] },
  ai:          { url:'ai.html',       label:'AI & Dev',       keys:['ai','artificial intelligence','dev','developer','tools','automation'] },
  news:        { url:'news.html',     label:'News',           keys:['news','blog','update','latest','announcement'] },
  services:    { url:'services.html', label:'Services',       keys:['service','hire','commission','freelance','work with','design service'] },
  courses:     { url:'courses.html',  label:'Courses',        keys:['course','learn','academy','class','tutorial','lesson','education','enroll'] },
  vlog:        { url:'vlog.html',     label:'Vlog',           keys:['vlog','video','youtube','watch','behind the scenes'] },
  stories:     { url:'stories.html',  label:'Short Stories',  keys:['story','stories','short story','fiction','read'] },
  songs:       { url:'songs.html',    label:'Songs',          keys:['song','music','track','listen','audio'] },
  anime:       { url:'anime.html',    label:'Anime',          keys:['anime','animation','manga','otaku','japanese'] },
  help:        { url:'help.html',     label:'Help Center',    keys:['help','support','contact','faq','question','assist'] },
  terms:       { url:'terms.html',    label:'Terms',          keys:['terms','tos','legal'] },
  privacy:     { url:'privacy.html',  label:'Privacy Policy', keys:['privacy','gdpr','data policy'] },
  features:    { url:'#features',     label:'Features',       keys:['feature','overview','what is','inside'] },
  about:       { url:'#about',        label:'About Abid',     keys:['about','abid','founder','creator','who made'] },
  plans_sec:   { url:'#plans',        label:'Plans & Pricing',keys:['plan','pricing','tier','subscription','voyager','pioneer','explorer','how much'] },
};

// ── PRODUCT CATALOGUE (for AI-initiated purchases)
const EXO_PRODUCTS = [
  {id:'prompt-bible',   name:'Ultimate Prompt Bible',         price:'$17',  priceLocal:'৳1,900', icon:'🧠'},
  {id:'ui-kit',         name:'Dark UI Component Kit',         price:'$26',  priceLocal:'৳2,900', icon:'✦'},
  {id:'mj-pack',        name:'Midjourney Style Pack',         price:'$13',  priceLocal:'৳1,500', icon:'⚡'},
  {id:'brand-kit',      name:'Creator Brand Starter',         price:'$32',  priceLocal:'৳3,500', icon:'🔥'},
  {id:'lut-bundle',     name:'Cinematic LUT Bundle',          price:'$11',  priceLocal:'৳1,200', icon:'🎞️'},
  {id:'everything',     name:'Everything Pack',               price:'$72',  priceLocal:'৳7,900', icon:'📦'},
  {id:'course-ai-art',  name:'AI Art Mastery Course',         price:'$22',  priceLocal:'৳2,500', icon:'🎨'},
  {id:'course-prompt',  name:'Prompt Engineering Course',     price:'$18',  priceLocal:'৳2,000', icon:'⚡'},
  {id:'course-ui',      name:'Dark UI Design Course',         price:'$28',  priceLocal:'৳3,200', icon:'🖥️'},
  {id:'course-sell',    name:'Selling Digital Products',      price:'$25',  priceLocal:'৳2,800', icon:'💰'},
  {id:'course-brand',   name:'Brand Identity Design',         price:'$34',  priceLocal:'৳3,800', icon:'✦'},
  {id:'course-web',     name:'Web Dev for Creatives',         price:'$38',  priceLocal:'৳4,200', icon:'🌐'},
  {id:'ai-prompts',     name:'Custom Prompt Pack',            price:'$15',  priceLocal:'৳1,650', icon:'📝'},
  {id:'ai-chatbot',     name:'AI Chatbot Integration',        price:'$80',  priceLocal:'৳8,800', icon:'🤖'},
  {id:'ai-code',        name:'Custom Code & Automation',      price:'$40',  priceLocal:'৳4,400', icon:'💻'},
  {id:'ai-consult',     name:'Private AI Consultation (1hr)', price:'$20',  priceLocal:'৳2,200', icon:'🔮'},
  {id:'svc-design',     name:'Creative Design Service',       price:'$30',  priceLocal:'৳3,300', icon:'🎨'},
  {id:'svc-web',        name:'Web Development Service',       price:'$50',  priceLocal:'৳5,500', icon:'🌐'},
  {id:'svc-brand',      name:'Branding Service',              price:'$45',  priceLocal:'৳4,950', icon:'✦'},
];

// ── PAYMENT METHODS CONFIG
const EXO_PAY_METHODS = [
  { id:'bkash',   label:'bKash 🟣',   info:'Send to: '+CFG.bkash,        local:true  },
  { id:'nagad',   label:'Nagad 🟠',   info:'Send to: '+CFG.nagad,        local:true  },
  { id:'airtm',   label:'Airtm 🌍',   info:'Send to: '+CFG.airtm,        local:false },
  { id:'skrill',  label:'Skrill 💜',  info:'Send to: '+CFG.skrill,       local:false },
  { id:'usdt',    label:'USDT 💲',    info:'ERC-20: '+CFG.usdt,          local:false },
  { id:'btc',     label:'Bitcoin ₿',  info:'BTC: '+CFG.btc,              local:false },
  { id:'eth',     label:'ETH Ξ',      info:'ERC-20: '+CFG.eth,           local:false },
  { id:'sol',     label:'Solana ◎',   info:'SOL: '+CFG.sol,              local:false },
  { id:'bnb',     label:'BNB ⬡',      info:'BSC: '+CFG.bnb,              local:false },
];

// ── CHECKOUT STATE MACHINE
const EXO_PAY = {
  active: false,
  step: null, // 'product'|'name'|'phone'|'email'|'method'|'waiting'|'proof'|'done'
  product: null,
  name: null,
  phone: null,
  email: null,
  method: null,
  screenshotB64: null,
  screenshotName: null,
  orderId: null,
};

// Steps in order
const PAY_STEPS = ['product','name','phone','email','method','waiting','proof','done'];

function exoPayReset() {
  Object.assign(EXO_PAY, {active:false,step:null,product:null,name:null,phone:null,email:null,method:null,screenshotB64:null,screenshotName:null,orderId:null});
  // Restore normal input
  const inputRow = document.getElementById('exoInputRow');
  const uploadRow = document.getElementById('exoUploadRow');
  if(inputRow) inputRow.style.display = 'flex';
  if(uploadRow) uploadRow.style.display = 'none';
  document.getElementById('exoChatInput').placeholder = 'Ask Exo anything...';
  document.getElementById('exoStatusLabel').innerHTML = '<div class="exo-status-dot"></div>Online';
  document.getElementById('exoBubble').classList.remove('exo-pay-mode');
}

function exoPayStart(product) {
  EXO_PAY.active = true;
  EXO_PAY.product = product;
  EXO_PAY.orderId = 'EW-' + Date.now().toString(36).toUpperCase();
  EXO_PAY.step = 'name';
  document.getElementById('exoBubble').classList.add('exo-pay-mode');
  document.getElementById('exoStatusLabel').innerHTML = '<div class="exo-status-dot" style="background:#f59e0b;box-shadow:0 0 6px #f59e0b"></div>Checkout';
}

function exoPayHandleInput(text) {
  const t = text.trim();
  const msgs = document.getElementById('exoChatMsgs');

  // Allow escape at any point
  if (/^(cancel|stop|exit|quit|nevermind|never mind|abort)/i.test(t)) {
    exoPayReset();
    return exoBotMsg(msgs, "No problem! Checkout cancelled. 😊 Let me know if you want to try again or need help with anything else.");
  }

  switch(EXO_PAY.step) {

    case 'name':
      if(t.length < 2) return exoBotMsg(msgs, "Please enter your full name so I know who to address the order to 😊");
      EXO_PAY.name = t;
      EXO_PAY.step = 'phone';
      return exoBotMsg(msgs, `Nice to meet you, ${EXO_PAY.name}! 👋\n\nWhat's your phone number? (so Abid can reach you if needed)`);

    case 'phone':
      if(t.length < 6) return exoBotMsg(msgs, "Please enter a valid phone number.");
      EXO_PAY.phone = t;
      EXO_PAY.step = 'email';
      return exoBotMsg(msgs, `Got it! 📱\n\nNow, what's your email address? Your product will be delivered here after payment is verified.`);

    case 'email':
      if(!/\S+@\S+\.\S+/.test(t)) return exoBotMsg(msgs, "Hmm, that doesn't look like a valid email. Please try again — this is where your product gets sent! 📧");
      EXO_PAY.email = t;
      EXO_PAY.step = 'method';
      // Show payment method chips
      setTimeout(() => {
        exoBotMsg(msgs, `Perfect! ✅\n\nHere's your order summary:\n\n${EXO_PAY.product.icon} ${EXO_PAY.product.name}\n💰 ${EXO_PAY.product.price} · ${EXO_PAY.product.priceLocal}\n📧 ${EXO_PAY.email}\n\nNow choose your payment method:`);
        setTimeout(() => showPayMethodChips(msgs), 400);
      }, 200);
      return;

    case 'method': {
      // handled via chip buttons, but also accept typed
      const matchedMethod = EXO_PAY_METHODS.find(m => t.toLowerCase().includes(m.id) || t.toLowerCase().includes(m.label.toLowerCase().split(' ')[0].toLowerCase()));
      if(!matchedMethod) return exoBotMsg(msgs, "Please select a payment method from the options above, or type the name (e.g. 'bkash', 'usdt', 'bitcoin').");
      selectPayMethod(matchedMethod, msgs);
      return;
    }

    case 'waiting': {
      // They typed a transaction ID manually instead of uploading
      const txnPattern = /^[a-zA-Z0-9]{6,}/;
      if(txnPattern.test(t)) {
        EXO_PAY.txnId = t;
        EXO_PAY.step = 'proof';
        document.getElementById('exoInputRow').style.display = 'none';
        document.getElementById('exoUploadRow').style.display = 'flex';
        return exoBotMsg(msgs, `Got transaction ID: ${t} ✅\n\nNow please attach your payment screenshot as proof. Click "📎 Attach Screenshot" below, then hit Submit ✓`);
      }
      return exoBotMsg(msgs, "Please enter your transaction ID or hash, or upload a screenshot using the button below 📎");
    }

    default:
      return;
  }
}

function showPayMethodChips(msgs) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;padding:4px 0 6px';
  EXO_PAY_METHODS.forEach(m => {
    const btn = document.createElement('button');
    btn.textContent = m.label;
    btn.style.cssText = 'font-family:var(--f-mono);font-size:.48rem;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.25);color:var(--v3);cursor:pointer;border-radius:2px;transition:all .2s';
    btn.onmouseenter = () => btn.style.background = 'rgba(139,92,246,.22)';
    btn.onmouseleave = () => btn.style.background = 'rgba(139,92,246,.1)';
    btn.onclick = () => { wrap.remove(); selectPayMethod(m, msgs); };
    wrap.appendChild(btn);
  });
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}

function selectPayMethod(method, msgs) {
  EXO_PAY.method = method;
  EXO_PAY.step = 'waiting';
  // Show upload row
  document.getElementById('exoInputRow').style.display = 'flex';
  document.getElementById('exoChatInput').placeholder = 'Enter TX ID / hash...';
  document.getElementById('exoUploadRow').style.display = 'flex';

  const info = method.info;
  const msg = `Great choice! ${method.label} selected. 💳\n\n📋 Payment details:\n${info}\n\nAmount: ${EXO_PAY.product.price} · ${EXO_PAY.product.priceLocal}\n\n✅ After paying:\n• Enter your Transaction ID in the box below, OR\n• Upload a screenshot using 📎 Attach Screenshot\n\nType "cancel" anytime to stop.`;
  exoBotMsg(msgs, msg);
}

function handleExoScreenshot(input) {
  const file = input.files[0];
  if(!file) return;
  EXO_PAY.screenshotName = file.name;
  document.getElementById('exoUploadName').textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    EXO_PAY.screenshotB64 = e.target.result; // full data URL
    const msgs = document.getElementById('exoChatMsgs');
    const preview = document.createElement('div');
    preview.style.cssText = 'margin:4px 0;max-width:180px;border-radius:4px;overflow:hidden;border:1px solid rgba(139,92,246,.3)';
    const img = document.createElement('img');
    img.src = e.target.result;
    img.style.cssText = 'width:100%;display:block';
    preview.appendChild(img);
    msgs.appendChild(preview);
    msgs.scrollTop = msgs.scrollHeight;
    exoBotMsg(msgs, "Screenshot attached! ✅ Looking good. Hit **Submit ✓** to send your order to Abid for verification!");
  };
  reader.readAsDataURL(file);
}

async function submitExoPayment() {
  const msgs = document.getElementById('exoChatMsgs');
  const txnInput = document.getElementById('exoChatInput').value.trim();

  // Need at least txn id OR screenshot
  if(!EXO_PAY.screenshotB64 && !txnInput && !EXO_PAY.txnId) {
    return exoBotMsg(msgs, "Please attach a screenshot or enter your transaction ID first! 📎");
  }
  if(txnInput) EXO_PAY.txnId = txnInput;

  EXO_PAY.step = 'done';
  document.getElementById('exoUploadRow').style.display = 'none';
  document.getElementById('exoInputRow').style.display = 'none';
  exoBotMsg(msgs, "⏳ Sending your order to Abid... hold tight!");

  const payload = {
    _subject: `🛒 [${EXO_PAY.orderId}] NEW ORDER via Exo — ${EXO_PAY.product.name}`,
    order_id:    EXO_PAY.orderId,
    product:     EXO_PAY.product.name,
    price:       EXO_PAY.product.price + ' · ' + EXO_PAY.product.priceLocal,
    buyer_name:  EXO_PAY.name,
    buyer_email: EXO_PAY.email,
    buyer_phone: EXO_PAY.phone,
    method:      EXO_PAY.method ? EXO_PAY.method.label : 'Unknown',
    txn_id:      EXO_PAY.txnId || '(not provided)',
    screenshot:  EXO_PAY.screenshotB64 ? '[Screenshot attached — see base64 below]\n' + EXO_PAY.screenshotB64.substring(0,200)+'...' : 'None',
    time:        new Date().toLocaleString('en-BD',{timeZone:'Asia/Dhaka'}),
    source:      'Exo AI Checkout Widget'
  };

  let success = false;
  try {
    const res = await fetch(CFG.formspree, {
      method: 'POST',
      headers: {'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify(payload)
    });
    if(res.ok) success = true;
  } catch(e) {}

  // Also try Telegram if bot token is set
  if(CFG.telegramBot && CFG.telegramChat) {
    try {
      const tgText = `🛒 *NEW ORDER — Exo AI*\n\n` +
        `📦 *Product:* ${EXO_PAY.product.name}\n` +
        `💰 *Price:* ${EXO_PAY.product.price}\n` +
        `👤 *Buyer:* ${EXO_PAY.name}\n` +
        `📧 *Email:* ${EXO_PAY.email}\n` +
        `📱 *Phone:* ${EXO_PAY.phone}\n` +
        `💳 *Method:* ${EXO_PAY.method?.label}\n` +
        `🔑 *TX ID:* ${EXO_PAY.txnId||'N/A'}\n` +
        `🆔 *Order ID:* ${EXO_PAY.orderId}\n` +
        `🕐 *Time:* ${new Date().toLocaleString('en-BD',{timeZone:'Asia/Dhaka'})}`;
      await fetch(`https://api.telegram.org/bot${CFG.telegramBot}/sendMessage`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({chat_id: CFG.telegramChat, text: tgText, parse_mode:'Markdown'})
      });
      // Send screenshot as separate image if available
      if(EXO_PAY.screenshotB64 && CFG.telegramChat) {
        const blob = await (await fetch(EXO_PAY.screenshotB64)).blob();
        const fd = new FormData();
        fd.append('chat_id', CFG.telegramChat);
        fd.append('caption', `📸 Payment screenshot for Order ${EXO_PAY.orderId}`);
        fd.append('photo', blob, EXO_PAY.screenshotName || 'proof.jpg');
        await fetch(`https://api.telegram.org/bot${CFG.telegramBot}/sendPhoto`, {method:'POST', body:fd});
      }
      success = true;
    } catch(e) {}
  }

  // Restore input
  document.getElementById('exoInputRow').style.display = 'flex';
  document.getElementById('exoChatInput').value = '';
  document.getElementById('exoChatInput').placeholder = 'Ask Exo anything...';

  if(success) {
    exoBotMsg(msgs, `✅ *Order sent successfully!*\n\n🆔 Order ID: ${EXO_PAY.orderId}\n\nAbid will verify your payment and send *${EXO_PAY.product.name}* to ${EXO_PAY.email} within 1–3 hours ⚡\n\nThank you, ${EXO_PAY.name}! 🎉`);
  } else {
    exoBotMsg(msgs, `⚠️ Network hiccup! Your info was saved.\n\n📧 Please email Abid directly:\ntheexoraworld@gmail.com\n\nWith your Order ID: *${EXO_PAY.orderId}*`);
  }
  setTimeout(() => { exoPayReset(); document.getElementById('exoStatusLabel').innerHTML = '<div class="exo-status-dot"></div>Online'; }, 1000);
}

// ── KNOWLEDGE BASE
const EXO_KB = {
  greet: {
    keys:['hello','hi','hey','sup','yo','greetings','good morning','good evening','good afternoon','wassup','hiya','howdy','whats up',"what's up"],
    replies:["Hey! 👋 I'm Exo — ExoraWorld's AI guide. I can answer questions, navigate you anywhere on the site, or even help you purchase something directly through chat. What do you need?","Hello! 🌌 Welcome to ExoraWorld. Ask me anything — store, courses, services, payments — or just say 'buy [product name]' and I'll walk you through checkout right here!","Hi there! 🤖 I'm Exo. Try asking me 'what can I buy?' or 'take me to games' or just say 'I want to buy a course'!"]
  },
  thanks: { keys:['thank','thanks','thx','ty','appreciate','helpful','great','awesome','cool','nice','perfect'], replies:["Happy to help! 😊 Anything else?","Anytime! That's what I'm here for. 🌌","Glad I could help! Let me know if you need anything else. ✦"] },
  farewell: { keys:['bye','goodbye','see you','later','cya','take care','peace','gotta go'], replies:["See you around! 🌌 ExoraWorld is always here.","Take care! Come back anytime — Exo is always online. ✦","Bye! 👋 Hope to see you again soon."] },
  buy_intent: {
    keys:['buy','purchase','order','get','want to pay','checkout','i want','i need','can i get','how to buy','how do i buy','i\'d like'],
    replies:['__BUY_HANDLER__']
  },
  store: { keys:['store','shop','what do you sell','what can i buy','products','digital','marketplace'], replies:["The ExoraWorld Store has 15+ digital products! 🛒\n\n🧠 Ultimate Prompt Bible — $17\n✦ Dark UI Kit — $26\n⚡ Midjourney Style Pack — $13\n🔥 Creator Brand Starter — $32\n🎞️ Cinematic LUT Bundle — $11\n📦 Everything Pack — $72\n\nPlus courses, AI services & templates. Just say 'I want to buy [product]' and I'll handle the checkout right here! 🚀"] },
  courses: { keys:['course','learn','academy','tutorial','lesson','class','study','education'], replies:["ExoraWorld Academy has 6 courses! 📚\n\n🎨 AI Art Mastery — $22\n⚡ Prompt Engineering — $18\n🖥️ Dark UI Design — $28\n💰 Selling Digital Products — $25\n✦ Brand Identity Mastery — $34\n🌐 Web Dev for Creatives — $38\n\nSay 'I want to buy [course name]' to purchase right here through Exo!"] },
  payment: { keys:['pay','payment','bkash','nagad','airtm','skrill','how to pay','transaction','method','checkout','methods'], replies:["We accept: bKash 🟣, Nagad 🟠, Airtm 🌍, Skrill 💜, USDT 💲, Bitcoin ₿, ETH Ξ, Solana ◎, BNB ⬡\n\nYou can pay directly through me! Just say 'I want to buy [product]' and I'll walk you through it step by step — name, email, payment method, screenshot proof — everything. 🛒"] },
  crypto: { keys:['crypto','bitcoin','btc','ethereum','eth','usdt','solana','sol','bnb','binance','wallet','erc20'], replies:["Crypto wallets 🔐\n\n• BTC: "+CFG.btc+"\n• ETH/BNB/USDT: "+CFG.eth+" (ERC-20)\n• SOL: "+CFG.sol+"\n\n✦ USDT is accepted on ERC-20 (Ethereum) network.\n\nWant to make a purchase right now? Just say 'buy [product]' and I'll guide you through it! 🚀"] },
  services: { keys:['service','hire','logo','branding','web dev','consultation','consult','freelance','commission'], replies:["Abid's services 🎨\n\n🎨 Creative Design — $30\n🤖 AI & Automation — $25\n🌐 Web Development — $50\n🔮 Private Consultation — $20/hr\n✦ Branding Service — $45\n\nSay 'I want to buy [service]' to start checkout through Exo! Or message Abid directly at theexoraworld@gmail.com"] },
  games: { keys:['game','play','gaming','fun','snake','tetris','void runner','gravity bird','memory','arcade'], replies:["ExoraWorld has 5 FREE web games! 🎮\n\n🐍 Snake · 🕹️ Void Runner · 🐦 Gravity Bird · 🧱 Tetris · 🧠 Memory Orbs\n\nNo download, no sign-up needed. Want me to take you to the Games page?"] },
  plans: { keys:['plan','subscription','member','membership','tier','voyager','pioneer','explorer','upgrade','premium'], replies:["ExoraWorld Membership Tiers 🌌\n\n🆓 Explorer — Free forever\n⚡ Voyager — $9/mo (≈৳990)\n🚀 Pioneer — $22/mo (≈৳2,400)\n   Unlimited courses + 1-on-1 + 20% off everything\n\nSay 'I want Pioneer' or 'buy Voyager' to start checkout! Want to see full plan details?"] },
  about_abid: { keys:['who is abid','who made','who built','founder','creator','about exoraworld','background','story','bangladesh'], replies:["Abid (MD Abid Hasan) is the founder and sole creator of ExoraWorld 🇧🇩\n\nDesigner · AI enthusiast · Web developer · Storyteller\n\nBorn and based in Bangladesh, building for the whole world. ExoraWorld is his one-person creative universe."] },
  contact: { keys:['contact','reach','email','message','support','talk','facebook','discord','instagram','twitter'], replies:["Reach Abid here 📬\n\n✉️ theexoraworld@gmail.com\n💬 facebook.com/exoraworld\n📸 @theexoraworld\n🐦 @Exoraworld\n▶️ @ExoraWorld\n🎮 discord.gg/f84dEvu2q"] },
  delivery: { keys:['deliver','delivery','how long','receive','when will i get','wait time','how fast','instant'], replies:["All digital products delivered to your email within 1–3 hours of payment verification ⚡\n\nMost orders are processed faster! Make sure you enter a valid email. Check spam if you don't see it."] },
  refund: { keys:['refund','return','money back','cancel order','dispute','wrong product','not received','issue with order'], replies:["ExoraWorld stands behind every product 🤝\n\nIf something's wrong, contact Abid within 7 days:\n✉️ theexoraworld@gmail.com\n💬 Facebook Messenger\n\nHe'll make it right — guaranteed."] },
  what_can_you_do: { keys:['what can you do','what do you know','help me','what are you','who are you','capabilities','how smart','can you'], replies:["I'm Exo 🤖 — ExoraWorld's AI guide. Here's what I can do:\n\n🛒 Walk you through purchasing anything on the site — right here in this chat!\n🧭 Navigate you to any page (say 'take me to games')\n💬 Answer questions about products, courses, payments\n💡 Recommend what suits your needs\n\nTry: 'I want to buy the UI kit' or 'take me to courses'"] },
};

// ── BUY INTENT HANDLER — matches user text to a product
function handleBuyIntent(text, msgs) {
  const t = text.toLowerCase();
  // Try to match a specific product
  let matched = null;
  for(const prod of EXO_PRODUCTS) {
    const words = prod.name.toLowerCase().split(' ');
    const matchCount = words.filter(w => w.length > 3 && t.includes(w)).length;
    if(matchCount >= 2) { matched = prod; break; }
  }
  // Fallback: partial match
  if(!matched) {
    for(const prod of EXO_PRODUCTS) {
      if(t.includes(prod.id) || prod.name.toLowerCase().split(' ').some(w => w.length>4 && t.includes(w))) {
        matched = prod; break;
      }
    }
  }
  if(matched) {
    exoBotMsg(msgs, `Great choice! 🎉 Let's get you *${matched.name}* (${matched.price} · ${matched.priceLocal}).\n\nI'll walk you through checkout right here — takes less than 2 minutes. Let's start!\n\nFirst — what's your full name?`);
    exoPayStart(matched);
  } else {
    // Show product picker chips
    exoBotMsg(msgs, "Sure! Which product would you like to buy? Here are some popular ones — pick one or type the name:");
    setTimeout(() => showProductChips(msgs), 300);
  }
}

function showProductChips(msgs) {
  const popular = EXO_PRODUCTS.slice(0, 8); // show top 8
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;padding:4px 0 6px';
  popular.forEach(prod => {
    const btn = document.createElement('button');
    btn.textContent = prod.icon + ' ' + prod.name + ' — ' + prod.price;
    btn.style.cssText = 'font-family:var(--f-mono);font-size:.44rem;letter-spacing:.05em;padding:5px 9px;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.22);color:var(--ivory);cursor:pointer;border-radius:2px;transition:all .2s;text-align:left';
    btn.onmouseenter = () => btn.style.background = 'rgba(139,92,246,.22)';
    btn.onmouseleave = () => btn.style.background = 'rgba(139,92,246,.1)';
    btn.onclick = () => {
      wrap.remove();
      exoBotMsg(msgs, `Great choice! 🎉 Let's get you *${prod.name}* (${prod.price} · ${prod.priceLocal}).\n\nI'll walk you through checkout right here!\n\nFirst — what's your full name?`);
      exoPayStart(prod);
    };
    wrap.appendChild(btn);
  });
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}

// ── NAVIGATION DETECTOR
function detectNavIntent(t) {
  const navPhrases = ['take me','go to','open','show me','navigate','visit','i want to see','bring me','where is','find','jump to','switch to','head to'];
  const hasNavPhrase = navPhrases.some(p => t.includes(p));
  for (const [key, page] of Object.entries(EXO_SITEMAP)) {
    if (page.keys.some(k => t.includes(k)) && (hasNavPhrase || t.includes(key))) return page;
  }
  if (hasNavPhrase) {
    for (const [key, page] of Object.entries(EXO_SITEMAP)) {
      if (page.keys.some(k => t.includes(k))) return page;
    }
  }
  return null;
}

// ── TOPIC MATCHER
function matchTopic(t) {
  let best = null, bestScore = 0;
  for (const [topic, data] of Object.entries(EXO_KB)) {
    if (!data.keys) continue;
    let score = 0;
    for (const key of data.keys) { if (t.includes(key)) score += key.split(' ').length; }
    if (score > bestScore) { bestScore = score; best = { topic, data }; }
  }
  return bestScore > 0 ? best : null;
}

// ── MEMORY
const _isNewVisit = !sessionStorage.getItem('exo_session');
if(_isNewVisit) {
  sessionStorage.setItem('exo_session','1');
  localStorage.setItem('exo_visits', parseInt(localStorage.getItem('exo_visits')||'0')+1);
}
const exoMemory = { msgs:[], lastTopic:null, userName:null, visitCount: parseInt(localStorage.getItem('exo_visits')||'1') };

function detectName(t) {
  const m = t.match(/(?:i'm|i am|my name is|call me|name's)\s+([a-zA-Z]+)/i);
  if (m) { exoMemory.userName = m[1]; return true; }
  return false;
}

// ── SMART FALLBACK
function smartFallback(t) {
  if (t.match(/^(how|what|why|when|where|who|which|can|is|are|do|does|will|should)/)) {
    return `Hmm, not sure about that one 🤔\n\nI can help with:\n• 🛒 Buying anything on the site — just say 'buy [product]'\n• 🧭 Navigation — say 'take me to [page]'\n• 💬 Store, courses, services, payments\n\nOr contact Abid: theexoraworld@gmail.com`;
  }
  if (t.length < 5) return `Could you say a bit more? I want to give you the best answer! 😊`;
  return `I'm not quite sure what you mean — but I'm learning! 🌌\n\nTry: 'I want to buy the UI kit', 'take me to games', or 'what courses exist?'`;
}

// ── SUGGESTIONS
function getSuggestions(topic) {
  const map = {
    store:    ['Buy Prompt Bible','Buy UI Kit','Take me to store'],
    courses:  ['Buy AI Art course','Course prices?','Take me to courses'],
    payment:  ['I want to pay with bKash','Crypto wallets?','How fast is delivery?'],
    games:    ['Take me to games','Tell me about plans','What\'s in the store?'],
    plans:    ['Buy Pioneer plan','Buy Voyager plan','What\'s the difference?'],
    buy_intent: ['Buy Prompt Bible','Buy Dark UI Kit','Buy AI Art Course'],
    null:     ['What can I buy?','Take me to games','How do I pay?','Show me courses'],
  };
  return map[topic] || map[null];
}

function addSuggestions(container, suggestions) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;padding:0 0 4px';
  suggestions.forEach(s => {
    const btn = document.createElement('button');
    btn.textContent = s;
    btn.style.cssText = 'font-family:var(--f-mono);font-size:.44rem;letter-spacing:.07em;text-transform:uppercase;padding:4px 8px;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.22);color:var(--v3);cursor:pointer;border-radius:2px;transition:all .2s;white-space:nowrap';
    btn.onmouseenter = () => btn.style.background='rgba(139,92,246,.22)';
    btn.onmouseleave = () => btn.style.background='rgba(139,92,246,.1)';
    btn.onclick = () => { wrap.remove(); document.getElementById('exoChatInput').value=s; sendExoChat(); };
    wrap.appendChild(btn);
  });
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

// ── TYPING EFFECT
function renderMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function typeMessage(el, text, speed=15) {
  el.innerHTML = '';
  const lines = text.split('\n');
  let lineIdx = 0, charIdx = 0;
  function next() {
    if(lineIdx >= lines.length) return;
    const line = lines[lineIdx];
    if(charIdx < line.length) {
      let html = '';
      for(let i=0;i<lineIdx;i++) html += renderMarkdown(lines[i])+'<br>';
      html += renderMarkdown(line.substring(0, charIdx+1));
      el.innerHTML = html;
      const sc = el.closest('.exo-msgs,.ai-msgs');
      if(sc) sc.scrollTop = sc.scrollHeight;
      charIdx++; setTimeout(next, speed);
    } else {
      lineIdx++; charIdx = 0;
      if(lineIdx < lines.length) { el.innerHTML += '<br>'; setTimeout(next, speed*2); }
    }
  }
  next();
}

// ── BOT MESSAGE HELPER
function exoBotMsg(msgs, text) {
  const el = document.createElement('div');
  el.className = 'exo-msg';
  typeMessage(el, text, 13);
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
  return el;
}

// ── MAIN REPLY LOGIC
function exoReply(text, container) {
  const t = text.toLowerCase().trim();
  const msgs = container || document.getElementById('exoChatMsgs');
  exoMemory.msgs.push({role:'user', text:text.substring(0,100)});
  if(exoMemory.msgs.length > 8) exoMemory.msgs.shift();

  // If in payment flow — route to pay handler
  if(EXO_PAY.active) { exoPayHandleInput(text); return null; }

  // Name detection
  if(detectName(t)) return `Nice to meet you, ${exoMemory.userName}! 😊 How can I help? Say 'buy [product]' to purchase something, or ask me anything!`;

  // Navigation intent
  const navTarget = detectNavIntent(t);
  if(navTarget) {
    exoMemory.lastTopic = 'nav';
    const isSection = navTarget.url.startsWith('#');
    if(isSection) {
      const id = navTarget.url.substring(1); // Remove # prefix
      const el = document.getElementById(id); // Use getElementById for safety
      if(el) setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),600);
      return `Taking you to the ${navTarget.label} section! ⬇️`;
    } else {
      setTimeout(()=>{window.location.href=navTarget.url;},1200);
      return `Opening ${navTarget.label} now... 🚀`;
    }
  }

  // Knowledge base match
  const match = matchTopic(t);
  if(match) {
    exoMemory.lastTopic = match.topic;
    if(match.topic === 'buy_intent') { handleBuyIntent(text, msgs); return null; }
    const replies = match.data.replies;
    return replies[Math.floor(Math.random()*replies.length)];
  }

  // Contextual follow-up
  if(exoMemory.lastTopic && (t.includes('more')||t.includes('tell me')||t.includes('what else')||t.length<12)) {
    const prev = EXO_KB[exoMemory.lastTopic];
    if(prev && prev.replies.length > 1) return prev.replies[1];
  }

  return smartFallback(t);
}

// ── HOMEPAGE CHAT (for the big on-page AI section)
function appendMsg(container, text, isUser) {
  const div = document.createElement('div');
  div.className = isUser ? 'msg user' : 'msg bot';
  if(isUser) div.textContent = text;
  else typeMessage(div, text, 14);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const msgs = document.getElementById('chatMsgs');
  const text = input.value.trim();
  if(!text) return;
  appendMsg(msgs, text, true);
  input.value = '';
  const typing = document.createElement('div');
  typing.className = 'msg bot';
  typing.innerHTML = '<span style="opacity:.5;letter-spacing:.15em">· · ·</span>';
  typing.id='typing-indicator';
  msgs.appendChild(typing);
  msgs.scrollTop = msgs.scrollHeight;
  const delay = 600 + Math.min(text.length*8, 800);
  setTimeout(()=>{
    typing.remove();
    const reply = exoReply(text, msgs);
    if(reply) {
      const el = appendMsg(msgs, reply, false);
      setTimeout(()=>addSuggestions(msgs, getSuggestions(exoMemory.lastTopic)), 350+reply.length*14);
    }
  }, delay);
}

// ── FLOATING WIDGET CHAT
function sendExoChat() {
  const input = document.getElementById('exoChatInput');
  const msgs = document.getElementById('exoChatMsgs');
  const text = input.value.trim();
  if(!text) return;
  const uMsg = document.createElement('div');
  uMsg.className = 'exo-msg user-msg';
  uMsg.textContent = text;
  msgs.appendChild(uMsg);
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;
  const typing = document.createElement('div');
  typing.className = 'exo-msg';
  typing.innerHTML = '<span style="opacity:.4;letter-spacing:.2em">· · ·</span>';
  msgs.appendChild(typing);
  msgs.scrollTop = msgs.scrollHeight;
  const delay = 450 + Math.min(text.length*7,700);
  setTimeout(()=>{
    typing.remove();
    const reply = exoReply(text, msgs);
    if(reply) {
      exoBotMsg(msgs, reply);
      setTimeout(()=>addSuggestions(msgs, getSuggestions(exoMemory.lastTopic)), 300+reply.length*13);
    }
  }, delay);
}

// ── TOGGLE
let exoOpen = false;
function toggleExo() {
  exoOpen = !exoOpen;
  const b = document.getElementById('exoBubble');
  b.classList.toggle('show', exoOpen);
  document.getElementById('exoPing').style.display = exoOpen ? 'none' : 'block';
  if(exoOpen) {
    const msgs = document.getElementById('exoChatMsgs');
    msgs.scrollTop = 99999;
    if(msgs.children.length <= 1) {
      const greeting = exoMemory.visitCount > 2
        ? `Welcome back! 🌌 Visit #${exoMemory.visitCount}. Ask me anything or say 'buy [product]' to shop right here!`
        : `Hey! 👋 I'm Exo. I can answer questions AND process your purchase right here in this chat. Try saying 'I want to buy a course'!`;
      setTimeout(()=>{ exoBotMsg(msgs, greeting); addSuggestions(msgs, ["What can I buy?","Take me to games","How do I pay?","Show me courses"]); }, 500);
    }
  }
}
function closeExo() { exoOpen=false; document.getElementById('exoBubble').classList.remove('show'); }
// Auto-toggle disabled - user must manually open chat
// setTimeout(()=>{if(!exoOpen)toggleExo();},3500);

// ── SCROLL PROGRESS INDICATOR ──
let scrollProgressTimeout;
window.addEventListener('scroll', () => {
  clearTimeout(scrollProgressTimeout);
  const progressBar = document.getElementById('scroll-progress');
  if (progressBar) {
    const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    progressBar.style.width = scrollPercent + '%';
  }
}, { passive: true });

// (Reveal animations now handled by the single merged observer above.)

// ── ENHANCED FOCUS & BLUR EFFECTS ──
document.querySelectorAll('input, textarea').forEach(el => {
  el.addEventListener('focus', function() {
    this.style.boxShadow = '0 0 20px rgba(167, 139, 250, 0.4)';
  });
  el.addEventListener('blur', function() {
    this.style.boxShadow = '';
  });
});

// ── SMOOTH SCROLL BEHAVIOR ──
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href !== '#') {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
});
document.querySelectorAll('.cta-main,.cta-sec,.modal-submit,.pay-submit,.hf-submit').forEach(btn=>{
  let mouseX = 0, mouseY = 0, lastX = 0, lastY = 0, isMoving = false, rafId;
  
  btn.addEventListener('mousemove',e=>{
    mouseX = e.clientX;
    mouseY = e.clientY;
    isMoving = true;
    
    if(rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const r = btn.getBoundingClientRect();
      const x = (mouseX - r.left - r.width/2) * 0.1;
      const y = (mouseY - r.top - r.height/2) * 0.1;
      if(Math.abs(x - lastX) > 0.1 || Math.abs(y - lastY) > 0.1) {
        btn.style.transform = 'translateY(-3px) translate('+x+'px,'+y+'px)';
        lastX = x;
        lastY = y;
      }
    });
  });
  
  btn.addEventListener('mouseleave',()=>{
    if(rafId) cancelAnimationFrame(rafId);
    btn.style.transform = '';
    isMoving = false;
  });
});
