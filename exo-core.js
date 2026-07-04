/* ═══════════════════════════════════════════════════════════════
   EXORAWORLD — exo-core.js  (v1)
   Single shared module. Include on EVERY page:

     <script type="module" src="exo-core.js"></script>

   Add slot divs wherever you want them:
     <div id="exo-nav"></div>           ← full nav  (or data-variant="minimal")
     <div id="exo-footer"></div>        ← footer
     <div id="exo-modal"></div>         ← auth modal

   ── HOW TO ADD A NEW PAGE ────────────────────────────────────
   1. Create newpage.html with the template below.
   2. Create newpage.js for page-specific logic (optional).
   3. Add a link to NAV_PRIMARY or NAV_MORE below (ONE change,
      all pages update automatically).
   That's it. Auth, nav, footer, cursor — all automatic.

   ── HOW TO ADD A NAV LINK ────────────────────────────────────
   Edit NAV_PRIMARY or NAV_MORE arrays below.
   Every page reflects the change instantly.

   ── MINIMAL PAGE TEMPLATE ────────────────────────────────────
   <!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>Page — ExoraWorld</title>
     <link rel="preconnect" href="https://fonts.googleapis.com">
     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
     <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700;800&family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@400;500&family=Orbitron:wght@700;800&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500&family=Space+Grotesk:wght@400;500&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
     <link rel="stylesheet" href="styles.css">
     <script type="module" src="exo-core.js"></script>
   </head>
   <body>
     <div id="exo-nav"></div>
     <main>
       <!-- your page content here -->
     </main>
     <div id="exo-footer"></div>
     <div id="exo-modal"></div>
     <script defer src="newpage.js"></script>
   </body>
   </html>
═══════════════════════════════════════════════════════════════ */

import './exora-auth.js'; // Side-effect: sets up window.ExoAuth, fires exoAuthChanged

// ─────────────────────────────────────────────────────────────
//  SITE MAP — Edit these arrays to update nav/footer everywhere
// ─────────────────────────────────────────────────────────────

/** Detect current page for active-link highlighting + link prefixing */
const _page    = window.location.pathname.split('/').pop() || 'index.html';
const _onIndex = _page === 'index.html' || _page === '' || window.location.pathname.endsWith('/');
const _h       = _onIndex ? '' : 'index.html'; // prefix for section-anchor links

/**
 * PRIMARY NAV LINKS (always visible, desktop)
 * To add a link: push a new object here. Done — all pages update.
 */
const NAV_PRIMARY = [
  { label: 'Pixivault',  href: `${_h}#pixivault`  },
  { label: 'Store',      href: `${_h}#store`       },
  { label: 'Gallery',    href: 'gallery.html'       },
  { label: 'Games',      href: `${_h}#games`       },
  { label: 'News',       href: `${_h}#news`        },
];

/**
 * "MORE" NAV LINKS (expandable row below primary nav)
 * To add: push here. All pages update.
 */
const NAV_MORE = [
  { label: '✦ Services',  href: `${_h}#services`  },
  { label: '◈ Plans',     href: `${_h}#plans`     },
  { label: '⊕ Courses',   href: `${_h}#courses`   },
  { label: '⌗ Templates', href: `${_h}#templates` },
  { label: '◎ About',     href: `${_h}#about`     },
  { label: '⁉ Help',      href: `${_h}#help`      },
];

/**
 * FOOTER COLUMNS
 * Edit here to update footer on all pages.
 */
const FOOTER_COLS = [
  {
    title: 'Explore',
    links: [
      { label: 'Pixivault',  href: `${_h}#pixivault`  },
      { label: 'Store',      href: `${_h}#store`       },
      { label: 'Gallery',    href: 'gallery.html'       },
      { label: 'Games',      href: `${_h}#games`       },
      { label: 'News',       href: `${_h}#news`        },
    ],
  },
  {
    title: 'Services',
    links: [
      { label: 'AI Tools',   href: `${_h}#ai`          },
      { label: 'Design',     href: `${_h}#services`    },
      { label: 'Courses',    href: `${_h}#courses`     },
      { label: 'Templates',  href: `${_h}#templates`   },
      { label: 'Plans',      href: `${_h}#plans`       },
    ],
  },
  {
    title: 'ExoraWorld',
    links: [
      { label: 'About Abid', href: `${_h}#about`       },
      { label: 'Help Center',href: `${_h}#help`        },
      { label: 'Account',    href: 'account.html'       },
      { label: 'Contact',    href: `${_h}#help`        },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
//  HTML TEMPLATES
// ─────────────────────────────────────────────────────────────

function _navHTML(variant) {
  /* Minimal nav — for pages like account, settings etc.
     data-variant="minimal" on the #exo-nav slot triggers this. */
  if (variant === 'minimal') {
    return `
<nav id="nav">
  <div class="nav-primary">
    <a href="index.html" class="nav-logo">[<span>ExoraWorld</span>]</a>
    <div style="flex:1"></div>
    <div class="nav-actions" id="nav-actions"></div>
    <a href="index.html" class="nav-back" style="margin-left:8px">← Back</a>
  </div>
</nav>`;
  }

  /* Full nav — standard ExoraWorld nav with primary links + more row */
  const currentHref = window.location.pathname + window.location.hash;

  const primaryItems = NAV_PRIMARY.map(l => {
    const active = window.location.href.includes(l.href.replace(/^index\.html/, '')) ? ' class="active"' : '';
    return `<li><a href="${l.href}"${active}>${l.label}</a></li>`;
  }).join('\n      ');

  const moreItems = NAV_MORE.map((l, i) =>
    `<a href="${l.href}">${l.label}</a>` +
    (i < NAV_MORE.length - 1 ? '<span class="more-sep"></span>' : '')
  ).join('\n      ');

  return `
<div id="scroll-progress"></div>
<div id="cur"></div>
<div id="cur-trail"></div>
<div class="orbs" aria-hidden="true">
  <div class="orb orb-a"></div>
  <div class="orb orb-b"></div>
  <div class="orb orb-c"></div>
</div>
<div class="mob-backdrop" id="mob-backdrop"></div>
<div class="mob-menu" id="mob-menu">
  <button class="mob-close" onclick="closeMob()" aria-label="Close menu">&times;</button>
  <span class="mob-brand">[<span>ExoraWorld</span>]</span>
  <span class="mob-section-label">Navigate</span>
  ${NAV_PRIMARY.map(l => `<a href="${l.href}">${l.label}</a>`).join('\n  ')}
  <div class="mob-sep"></div>
  <span class="mob-section-label">More</span>
  ${NAV_MORE.map(l => `<a href="${l.href}" class="mob-sub">${l.label}</a>`).join('\n  ')}
  <div class="mob-sep"></div>
  <div class="mob-ctas" id="mob-ctas"></div>
</div>
<nav id="nav">
  <div class="nav-primary">
    <button class="nav-mob-toggle" onclick="openMob()" aria-label="Open menu">
      <span></span><span></span><span></span>
    </button>
    <a href="index.html" class="nav-logo">[<span>ExoraWorld</span>]</a>
    <ul class="nav-links-primary">
      ${primaryItems}
      <button class="nav-more-btn" id="nav-more-btn" onclick="toggleMore()" aria-expanded="false">
        More <span class="more-arrow">▾</span>
      </button>
    </ul>
    <div class="nav-actions" id="nav-actions"></div>
  </div>
  <div class="nav-more-row" id="nav-more-row">
    <div class="nav-more-inner">
      ${moreItems}
    </div>
  </div>
</nav>`;
}

function _footerHTML() {
  const cols = FOOTER_COLS.map(col => `
    <div class="ft-col">
      <h4>${col.title}</h4>
      ${col.links.map(l => `<a href="${l.href}">${l.label}</a>`).join('\n      ')}
    </div>`).join('');

  return `
<footer>
  <div class="footer-top">
    <div class="ft-brand">
      <a href="index.html" class="logo">[<span>ExoraWorld</span>]</a>
      <p>One world, infinite possibilities. Digital art, games, AI tools, courses, and more — by Abid.</p>
      <div class="ft-social">
        <a href="#" class="ft-social-btn" aria-label="Instagram" title="Instagram">
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
        </a>
        <a href="#" class="ft-social-btn" aria-label="Twitter/X" title="Twitter/X">
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </a>
        <a href="#" class="ft-social-btn" aria-label="YouTube" title="YouTube">
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        </a>
      </div>
      <div class="ft-payment-icons">
        <span class="fpi">Bkash</span>
        <span class="fpi">Nagad</span>
        <span class="fpi">Rocket</span>
        <span class="fpi">Card</span>
      </div>
    </div>
    ${cols}
  </div>
  <div class="footer-bottom">
    <span class="fb-copy">© ${new Date().getFullYear()} ExoraWorld — MD Abid Hasan. All rights reserved.</span>
    <div class="fb-links">
      <a href="#">Privacy Policy</a>
      <a href="#">Terms of Service</a>
      <a href="#">DMCA</a>
    </div>
  </div>
</footer>`;
}

function _modalHTML() {
  return `
<div class="modal-bg" id="auth-modal" role="dialog" aria-modal="true" aria-label="Sign in">
  <div class="modal-box">
    <button class="modal-close" onclick="closeAuth()" aria-label="Close">&times;</button>
    <div class="modal-tabs">
      <button class="modal-tab active" data-tab="login"  onclick="switchAuth('login')">Sign In</button>
      <button class="modal-tab"        data-tab="register" onclick="switchAuth('register')">Create Account</button>
    </div>

    <!-- LOGIN -->
    <div class="modal-body">
      <div class="m-panel active" id="panel-login">
        <div class="modal-title">Welcome back</div>
        <div class="modal-sub">Sign in to your ExoraWorld account</div>
        <div class="auth-error" id="login-error" style="display:none"></div>
        <div class="field"><label for="login-email">Email</label>
          <input type="email" id="login-email" placeholder="your@email.com" autocomplete="email"></div>
        <div class="field"><label for="login-pass">Password</label>
          <input type="password" id="login-pass" placeholder="••••••••" autocomplete="current-password"></div>
        <button class="modal-submit" onclick="handleAuth(event,'login')">Sign In</button>
        <div class="modal-divider">or</div>
        <div class="social-btns">
          <button class="social-btn" onclick="handleSocialAuth('google')">🌐 Google</button>
          <button class="social-btn" onclick="handleSocialAuth('facebook')">💙 Facebook</button>
        </div>
      </div>

      <!-- REGISTER -->
      <div class="m-panel" id="panel-register">
        <div class="modal-title">Join ExoraWorld</div>
        <div class="modal-sub">Create your free account today</div>
        <div class="auth-error" id="register-error" style="display:none"></div>
        <div class="field"><label for="reg-name">Full Name</label>
          <input type="text" id="reg-name" placeholder="Your name" autocomplete="name"></div>
        <div class="field"><label for="reg-email">Email</label>
          <input type="email" id="reg-email" placeholder="your@email.com" autocomplete="email"></div>
        <div class="field"><label for="reg-pass">Password</label>
          <input type="password" id="reg-pass" placeholder="Min. 6 characters" autocomplete="new-password"></div>
        <button class="modal-submit" onclick="handleAuth(event,'register')">Create Account</button>
        <div class="modal-divider">or</div>
        <div class="social-btns">
          <button class="social-btn" onclick="handleSocialAuth('google')">🌐 Google</button>
          <button class="social-btn" onclick="handleSocialAuth('facebook')">💙 Facebook</button>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────
//  INJECT INTO SLOT DIVS
// ─────────────────────────────────────────────────────────────

function _inject() {
  // Nav slot
  const navSlot = document.getElementById('exo-nav');
  if (navSlot) {
    const variant = navSlot.dataset.variant || 'full';
    navSlot.outerHTML = _navHTML(variant); // Replace slot with real HTML
  }

  // Footer slot
  const footSlot = document.getElementById('exo-footer');
  if (footSlot) footSlot.outerHTML = _footerHTML();

  // Auth modal slot
  const modalSlot = document.getElementById('exo-modal');
  if (modalSlot) modalSlot.outerHTML = _modalHTML();
}

// ─────────────────────────────────────────────────────────────
//  SHARED JS SETUP
// ─────────────────────────────────────────────────────────────

function _setupScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
    bar.style.width = Math.min(pct * 100, 100) + '%';
  }, { passive: true });
}

function _setupNavScroll() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 60);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

function _setupCursor() {
  // Skip on touch devices
  if (!window.matchMedia('(pointer:fine)').matches) return;
  const cur   = document.getElementById('cur');
  const trail = document.getElementById('cur-trail');
  if (!cur || !trail) return;

  let mx = 0, my = 0, tx = 0, ty = 0, ltx, lty;

  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  document.querySelectorAll('a,button,[role="button"],[onclick]').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('hov'),   { passive: true });
    el.addEventListener('mouseleave', () => document.body.classList.remove('hov'),{ passive: true });
  });
  document.addEventListener('mousedown', () => document.body.classList.add('clicking'));
  document.addEventListener('mouseup',   () => document.body.classList.remove('clicking'));

  (function loop() {
    tx += (mx - tx) * 0.14;
    ty += (my - ty) * 0.14;
    const itx = tx | 0, ity = ty | 0;
    cur.style.left   = mx + 'px';
    cur.style.top    = my + 'px';
    if (itx !== ltx || ity !== lty) {
      trail.style.left = tx + 'px';
      trail.style.top  = ty + 'px';
      ltx = itx; lty = ity;
    }
    requestAnimationFrame(loop);
  })();
}

function _setupReveal() {
  // Global reveal observer — pages can call window.exoAttachReveal() after adding elements
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('vis', 'revealed'); io.unobserve(e.target); }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  window.exoAttachReveal = () => {
    document.querySelectorAll('.reveal:not(.vis)').forEach(el => io.observe(el));
  };
  window.exoAttachReveal();
}

// ─────────────────────────────────────────────────────────────
//  GLOBALLY AVAILABLE FUNCTIONS (onclick= handlers in HTML)
// ─────────────────────────────────────────────────────────────

/** Open mobile menu */
window.openMob = function() {
  document.getElementById('mob-menu')?.classList.add('open');
  document.getElementById('mob-backdrop')?.classList.add('show');
  document.body.style.overflow = 'hidden';
};

/** Close mobile menu */
window.closeMob = function() {
  document.getElementById('mob-menu')?.classList.remove('open');
  document.getElementById('mob-backdrop')?.classList.remove('show');
  document.body.style.overflow = '';
};

/** Toggle "More" nav row */
window.toggleMore = function() {
  const row = document.getElementById('nav-more-row');
  const btn = document.getElementById('nav-more-btn');
  if (!row || !btn) return;
  const open = row.classList.toggle('open');
  btn.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', String(open));
};

/** Close more row when clicking outside */
document.addEventListener('click', e => {
  const row = document.getElementById('nav-more-row');
  const btn = document.getElementById('nav-more-btn');
  if (row && btn && !row.contains(e.target) && !btn.contains(e.target)) {
    row.classList.remove('open');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
});

/**
 * Open auth modal.
 * If the auth modal exists on this page (injected by exo-core.js) → open it.
 * If not (e.g. gallery page without #exo-modal slot) → redirect to index.html.
 */
window.openAuth = function(tab) {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    switchAuth(tab || 'login');
  } else {
    const back = encodeURIComponent(window.location.href);
    window.location.href = 'index.html?auth=' + (tab || 'login') + '&from=' + back;
  }
};

/** Close auth modal */
window.closeAuth = function() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
  document.querySelectorAll('.auth-error').forEach(el => { el.style.display = 'none'; });
};

/** Switch between login/register tabs */
window.switchAuth = function(name) {
  document.querySelectorAll('.modal-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.m-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'panel-' + name));
};

/** Handle auth form submit (email/password) */
window.handleAuth = async function(e, type) {
  const btn = e.currentTarget;
  const errEl = document.getElementById(type + '-error');
  if (errEl) errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = type === 'login' ? 'Signing in…' : 'Creating account…';

  try {
    if (!window.ExoAuth) throw new Error('Auth not ready. Please wait a moment.');
    if (type === 'login') {
      const email = document.getElementById('login-email')?.value.trim();
      const pass  = document.getElementById('login-pass')?.value;
      if (!email || !pass) throw new Error('Please enter your email and password.');
      await ExoAuth.signInEmail(email, pass);
    } else {
      const name  = document.getElementById('reg-name')?.value.trim();
      const email = document.getElementById('reg-email')?.value.trim();
      const pass  = document.getElementById('reg-pass')?.value;
      if (!name || !email || !pass) throw new Error('Please fill in all fields.');
      if (pass.length < 6) throw new Error('Password must be at least 6 characters.');
      await ExoAuth.signUpEmail(name, email, pass);
    }
    closeAuth();
  } catch (err) {
    const msg = ExoAuth?.friendlyError(err) || err.message || 'Something went wrong.';
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  }

  btn.disabled = false;
  btn.textContent = type === 'login' ? 'Sign In' : 'Create Account';
};

/** Handle Google / Facebook social auth */
window.handleSocialAuth = async function(provider) {
  try {
    if (!window.ExoAuth) throw new Error('Auth not ready.');
    if (provider === 'google')   await ExoAuth.signInGoogle();
    if (provider === 'facebook') await ExoAuth.signInFacebook();
    closeAuth();
  } catch (err) {
    const msg = ExoAuth?.friendlyError(err) || err.message;
    const errEl = document.querySelector('.auth-error:not([style*="none"])') ||
                  document.getElementById('login-error');
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  }
};

// Close auth modal on backdrop click
document.addEventListener('click', e => {
  const modal = document.getElementById('auth-modal');
  if (modal && e.target === modal) closeAuth();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeAuth();
    closeMob();
  }
});

// ─────────────────────────────────────────────────────────────
//  HANDLE ?auth= QUERY PARAM  (e.g. redirect from gallery page)
// ─────────────────────────────────────────────────────────────
function _checkAuthParam() {
  const params = new URLSearchParams(window.location.search);
  const tab    = params.get('auth');
  if (tab) {
    setTimeout(() => openAuth(tab), 400);
  }
}

// ─────────────────────────────────────────────────────────────
//  INIT — runs immediately (modules are deferred, DOM is ready)
// ─────────────────────────────────────────────────────────────
_inject();
_setupScrollProgress();
_setupNavScroll();
_setupCursor();
_setupReveal();
_checkAuthParam();

// Re-attach hover states for cursor after DOM injection
setTimeout(() => {
  document.querySelectorAll('a,button,[role="button"]').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('hov'),    { passive: true });
    el.addEventListener('mouseleave', () => document.body.classList.remove('hov'), { passive: true });
  });
}, 50);
