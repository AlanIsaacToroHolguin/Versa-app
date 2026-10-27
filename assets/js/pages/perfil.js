/* ============================================
   VERSA — perfil.js
   Perfil público: datos, trayectoria y contacto.
   ============================================ */

(function () {
  'use strict';

  var V = window.VERSA;
  var msg = document.getElementById('profileMsg');
  var body = document.getElementById('profileBody');

  if (!V.sb) { V.notConfiguredNotice(msg); return; }

  var id = new URLSearchParams(location.search).get('id');
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) {
    msg.innerHTML = '<div class="notice notice--err">Perfil no encontrado.</div>';
    return;
  }

  function workHtml(w) {
    var who = w.counterpart_name ? ' · con ' + V.esc(w.counterpart_name) : '';
    return '<li class="work' + (w.status === 'verificado' ? ' work--ok' : '') + '">' +
      '<div class="work__top"><p class="work__title">' + V.esc(w.title) + '</p>' + V.statusBadge(w.status) + '</div>' +
      '<p class="work__meta">' + V.esc(V.KINDS[w.kind] || w.kind) + ' · ' + V.esc(V.fmtDate(w.work_date)) + who + '</p>' +
      (w.description ? '<p class="work__desc">' + V.esc(w.description) + '</p>' : '') +
      '</li>';
  }

  async function init() {
    var session = await V.getSession();
    var isMe = !!session && session.user.id === id;

    var pr = await V.sb.from('profiles').select('*').eq('id', id).maybeSingle();
    var p = pr.data;
    if (!p) {
      msg.innerHTML = '<div class="notice notice--err">Este perfil no existe o no es público.</div>';
      return;
    }
    document.title = p.display_name + ' — VERSA';

    var wq = V.sb.from('works').select('*').eq('owner_id', id).order('work_date', { ascending: false });
    if (!isMe) wq = wq.neq('status', 'rechazado');
    var wr = await wq;
    var works = wr.data || [];
    var verified = works.filter(function (w) { return w.status === 'verificado'; });
    var declared = works.filter(function (w) { return w.status !== 'verificado'; });

    var contact = null;
    if (session) {
      var cr = await V.sb.from('contacts').select('*').eq('profile_id', id).maybeSingle();
      contact = cr.data;
    }

    var actions = '';
    if (contact && contact.whatsapp) {
      actions += '<a class="btn" href="' + V.esc(V.waLink(contact.whatsapp)) + '" target="_blank" rel="noopener">Escribir por WhatsApp</a>';
    }
    if (contact && contact.contact_email) {
      actions += '<a class="btn btn--ghost" href="mailto:' + V.esc(contact.contact_email) + '">Enviar correo</a>';
    }
    if (!session) {
      actions += '<a class="btn" href="/ingresar/?next=' + encodeURIComponent('/perfil/?id=' + id) + '">Ingresa para ver el contacto</a>';
    } else if (!actions && !isMe) {
      actions = '<span class="work__meta">Esta persona no dejó datos de contacto.</span>';
    }
    if (isMe) actions += '<a class="btn btn--ghost" href="/cuenta/">Editar mi perfil</a>';

    var ig = V.instaLink(p.instagram);
    var web = V.safeUrl(p.website);
    var details = '';
    if (p.bio) details += '<dl class="kv"><dt>Presentación</dt><dd>' + V.esc(p.bio).replace(/\n/g, '<br>') + '</dd></dl>';
    if (p.services) details += '<dl class="kv"><dt>Servicios</dt><dd>' + V.esc(p.services).replace(/\n/g, '<br>') + '</dd></dl>';
    if (p.price_note) details += '<dl class="kv"><dt>Precios de referencia</dt><dd>' + V.esc(p.price_note) + '</dd></dl>';
    if (ig || web) {
      details += '<dl class="kv"><dt>Enlaces</dt><dd>' +
        (ig ? '<a href="' + V.esc(ig) + '" target="_blank" rel="noopener">Instagram</a>' : '') +
        (ig && web ? ' · ' : '') +
        (web ? '<a href="' + V.esc(web) + '" target="_blank" rel="noopener">Sitio web</a>' : '') +
        '</dd></dl>';
    }

    var chips = (p.genres || []).map(function (g) { return '<span class="chip">' + V.esc(g) + '</span>'; }).join('');

    body.innerHTML =
      '<div class="profile-head">' +
        '<span class="tag" style="justify-self:start">' + V.esc(V.ROLES[p.role].label) + '</span>' +
        '<h1>' + V.esc(p.display_name) + '</h1>' +
        '<p class="profile-head__meta">' + V.esc([p.zone, p.city].filter(Boolean).join(' · ')) + '</p>' +
        (chips ? '<div class="chips" style="margin-top:0">' + chips + '</div>' : '') +
        (!p.is_public ? '<div class="notice notice--warn" style="margin:8px 0 0">Tu perfil está oculto: solo tú lo ves.</div>' : '') +
        '<div class="profile-actions">' + actions + '</div>' +
      '</div>' +
      (details ? '<section class="panel">' + details + '</section>' : '') +
      '<section class="panel">' +
        '<h2 class="panel__title">Trayectoria verificada</h2>' +
        '<p class="panel__hint">Trabajos que la otra parte confirmó en VERSA.</p>' +
        (verified.length
          ? '<ul class="works">' + verified.map(workHtml).join('') + '</ul>'
          : '<p class="empty" style="padding:10px 0">Aún no tiene trabajos verificados.</p>') +
      '</section>' +
      (declared.length
        ? '<section class="panel"><h2 class="panel__title">Otros trabajos</h2>' +
          '<p class="panel__hint">Declarados por la persona; aún sin confirmación de la otra parte.</p>' +
          '<ul class="works">' + declared.map(workHtml).join('') + '</ul></section>'
        : '') +
      (session && !isMe
        ? '<p style="text-align:center"><button class="link-btn" id="reportBtn" type="button">Reportar este perfil</button></p>'
        : '');

    var rb = document.getElementById('reportBtn');
    if (rb) {
      rb.addEventListener('click', async function () {
        var reason = prompt('¿Qué pasa con este perfil? Cuéntanos en pocas palabras (mínimo 5 caracteres).');
        if (!reason || reason.trim().length < 5) return;
        var r = await V.sb.from('reports').insert({
          reporter_id: session.user.id, target_id: id, reason: reason.trim().slice(0, 500)
        });
        if (r.error) return V.toast(V.friendlyError(r.error), 'error');
        V.toast('Gracias. Revisaremos el reporte.', 'ok');
      });
    }
  }

  init();
})();
