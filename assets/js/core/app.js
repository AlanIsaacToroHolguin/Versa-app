/* ============================================
   VERSA — app.js
   Núcleo compartido: cliente Supabase, sesión,
   navegación y utilidades. Cargar después de
   config.js y de la librería supabase-js.
   ============================================ */

(function () {
  'use strict';

  var cfg = window.VERSA_CONFIG || {};
  var configured = !!(cfg.url && cfg.anonKey && !/TU-PROYECTO|TU-ANON/.test(cfg.url + cfg.anonKey));
  var sb = null;

  if (configured && window.supabase) {
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  var ROLES = {
    musico:   { label: 'Músico emergente',         plural: 'Músicos' },
    estudio:  { label: 'Estudio o sala de ensayo', plural: 'Estudios y salas' },
    manager:  { label: 'Manager',                  plural: 'Managers' },
    disquera: { label: 'Disquera o sello',         plural: 'Disqueras y sellos' }
  };

  var KINDS = {
    grabacion: 'Grabación', ensayo: 'Ensayo', concierto: 'Concierto',
    produccion: 'Producción', colaboracion: 'Colaboración', otro: 'Otro'
  };

  var STATUS = {
    verificado:    { label: 'Verificado',              cls: 'badge--ok' },
    pendiente:     { label: 'Esperando confirmación',  cls: 'badge--wait' },
    autodeclarado: { label: 'Autodeclarado',           cls: '' },
    rechazado:     { label: 'No confirmado',           cls: 'badge--no' }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function $(sel, root) { return (root || document).querySelector(sel); }

  /* ---------- Avisos ---------- */
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast--' + type : '');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('is-in'); }, 10);
    setTimeout(function () {
      el.classList.remove('is-in');
      setTimeout(function () { el.remove(); }, 400);
    }, 4200);
  }

  function friendlyError(err) {
    var m = (err && err.message) || String(err || '');
    if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/Email not confirmed/i.test(m)) return 'Primero confirma tu correo: te enviamos un enlace.';
    if (/Password should be at least/i.test(m)) return 'La contraseña debe tener al menos 8 caracteres.';
    if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera un momento y vuelve a probar.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
    return m || 'Algo salió mal. Inténtalo de nuevo.';
  }

  /* ---------- Sesión ---------- */
  async function getSession() {
    if (!sb) return null;
    var r = await sb.auth.getSession();
    return (r.data && r.data.session) || null;
  }

  async function requireAuth() {
    var s = await getSession();
    if (!s) {
      var here = location.pathname + location.search;
      location.replace('/ingresar/?next=' + encodeURIComponent(here));
      return null;
    }
    return s;
  }

  async function myProfile() {
    var s = await getSession();
    if (!s) return null;
    var r = await sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    return r.data || null;
  }

  // Solo permite volver a páginas internas simples (evita redirecciones abiertas)
  function safeNext(raw, fallback) {
    return /^\/[a-z]+(\/[a-z]+)*\/?(\?[\w=&%-]*)?$/i.test(raw || '') ? raw : fallback;
  }

  /* ---------- Utilidades de presentación ---------- */
  function waLink(num) {
    var d = String(num || '').replace(/\D/g, '');
    if (d.length === 10) d = '57' + d; // celular colombiano sin indicativo
    return d ? 'https://wa.me/' + d : '';
  }

  function instaLink(handle) {
    var h = String(handle || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
    return /^[\w.]{1,30}$/.test(h) ? 'https://instagram.com/' + h : '';
  }

  function safeUrl(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { var p = new URL(u); return /^https?:$/.test(p.protocol) ? p.href : ''; } catch (e) { return ''; }
  }

  function parseGenres(text) {
    var seen = {}, out = [];
    String(text || '').split(',').forEach(function (g) {
      g = g.trim().toLowerCase().slice(0, 30);
      if (g && !seen[g]) { seen[g] = 1; out.push(g); }
    });
    return out.slice(0, 8);
  }

  function fmtDate(d) {
    if (!d) return '';
    var p = String(d).split('-');
    var m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return p.length === 3 ? (+p[2]) + ' ' + m[+p[1] - 1] + ' ' + p[0] : d;
  }

  function statusBadge(status) {
    var s = STATUS[status] || STATUS.autodeclarado;
    return '<span class="badge ' + s.cls + '">' + (status === 'verificado' ? '✓ ' : '') + esc(s.label) + '</span>';
  }

  function profileCard(p, stats) {
    var v = stats ? stats.verified_count : 0;
    var chips = (p.genres || []).slice(0, 4).map(function (g) { return '<span class="chip">' + esc(g) + '</span>'; }).join('');
    return '<a class="pcard" href="/perfil/?id=' + encodeURIComponent(p.id) + '">' +
      '<div class="pcard__top"><span class="tag">' + esc(ROLES[p.role] ? ROLES[p.role].label : p.role) + '</span>' +
      (v > 0 ? '<span class="badge badge--ok">✓ ' + v + ' verificado' + (v === 1 ? '' : 's') + '</span>' : '') + '</div>' +
      '<h3 class="pcard__name">' + esc(p.display_name) + '</h3>' +
      '<p class="pcard__meta">' + esc([p.zone, p.city].filter(Boolean).join(' · ')) + '</p>' +
      (p.bio ? '<p class="pcard__bio">' + esc(p.bio.length > 120 ? p.bio.slice(0, 117) + '…' : p.bio) + '</p>' : '') +
      (chips ? '<div class="chips">' + chips + '</div>' : '') +
      '</a>';
  }

  function notConfiguredNotice(container) {
    if (container) {
      container.innerHTML = '<div class="notice notice--warn"><strong>Falta conectar la base de datos.</strong> ' +
        'Completa <code>js/config.js</code> con la URL y la anon key de tu proyecto de Supabase (ver SETUP.md).</div>';
    }
  }

  /* ---------- Navegación y pie compartidos ---------- */
  function navLinksHtml(session) {
    if (session) {
      return '<a href="/directorio/">Directorio</a>' +
        '<a href="/trayectoria/">Mi trayectoria</a>' +
        '<a href="/cuenta/">Mi cuenta</a>' +
        '<a href="#" id="signOut" class="btn btn--sm btn--ghost">Salir</a>';
    }
    return '<a href="/#como">Cómo funciona</a>' +
      '<a href="/directorio/">Directorio</a>' +
      '<a href="/ingresar/">Ingresar</a>' +
      '<a href="/registro/" class="btn btn--sm">Crear cuenta</a>';
  }

  function bindSignOut() {
    var so = document.getElementById('signOut');
    if (so && sb) {
      so.addEventListener('click', async function (e) {
        e.preventDefault();
        await sb.auth.signOut();
        location.href = '/';
      });
    }
  }

  function renderChrome() {
    var navHost = document.getElementById('siteNav');
    if (navHost) {
      navHost.innerHTML =
        '<header class="nav" id="nav"><div class="wrap nav__inner">' +
        '<a href="/" class="nav__logo">VERSA</a>' +
        '<nav class="nav__links" id="navLinks">' + navLinksHtml(null) + '</nav>' +
        '<button class="nav__toggle" id="navToggle" aria-label="Abrir menú" aria-expanded="false"><span></span><span></span><span></span></button>' +
        '</div></header>';
    }
    var foot = document.getElementById('siteFooter');
    if (foot) {
      foot.innerHTML =
        '<footer class="footer"><div class="wrap footer__inner"><div>' +
        '<p class="footer__logo">VERSA</p><p class="footer__tag">Conectamos el ecosistema musical de Medellín.</p></div>' +
        '<div class="footer__meta"><p><a href="/legal/privacidad/">Privacidad y datos</a> · <a href="/legal/terminos/">Términos de uso</a></p>' +
        '<p>Tecnológico de Artes Débora Arango · ' + new Date().getFullYear() + '</p></div></div></footer>';
    }
  }

  async function refreshNav() {
    var links = document.getElementById('navLinks');
    if (!links || !sb) return;
    var s = await getSession();
    links.innerHTML = navLinksHtml(s);
    bindSignOut();
  }

  renderChrome();

  var ready = (async function () {
    await refreshNav();
    if (sb) sb.auth.onAuthStateChange(function () { refreshNav(); });
  })();

  window.VERSA = {
    sb: sb, configured: configured, cfg: cfg, ready: ready,
    ROLES: ROLES, KINDS: KINDS, STATUS: STATUS,
    esc: esc, $: $, toast: toast, friendlyError: friendlyError,
    getSession: getSession, requireAuth: requireAuth, myProfile: myProfile, safeNext: safeNext,
    waLink: waLink, instaLink: instaLink, safeUrl: safeUrl, parseGenres: parseGenres,
    fmtDate: fmtDate, statusBadge: statusBadge, profileCard: profileCard,
    notConfiguredNotice: notConfiguredNotice
  };
})();
