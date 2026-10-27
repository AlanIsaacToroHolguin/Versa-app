/* ============================================
   VERSA — trayectoria.js
   Registro de trayectoria con doble confirmación.
   ============================================ */

(function () {
  'use strict';

  var V = window.VERSA;
  var $ = function (id) { return document.getElementById(id); };
  var msg = $('workMsg');

  if (!V.sb) { V.notConfiguredNotice(msg); return; }

  var session = null;

  function metaLine(w, extra) {
    return V.esc(V.KINDS[w.kind] || w.kind) + ' · ' + V.esc(V.fmtDate(w.work_date)) + (extra || '');
  }

  /* ---------- Por confirmar (soy la contraparte) ---------- */
  async function loadPending() {
    var r = await V.sb.from('works').select('*, owner:profiles!works_owner_id_fkey(display_name)')
      .eq('counterpart_id', session.user.id).eq('status', 'pendiente')
      .order('created_at', { ascending: false });
    var list = r.data || [];
    $('pendingPanel').hidden = !list.length;
    $('pendingList').innerHTML = list.map(function (w) {
      var owner = w.owner && w.owner.display_name ? w.owner.display_name : 'Alguien';
      return '<li class="work">' +
        '<p class="work__title">' + V.esc(w.title) + '</p>' +
        '<p class="work__meta">' + metaLine(w, ' · registrado por ' + V.esc(owner)) + '</p>' +
        (w.description ? '<p class="work__desc">' + V.esc(w.description) + '</p>' : '') +
        '<div class="work__actions">' +
        '<button class="btn btn--sm" type="button" data-act="yes" data-id="' + V.esc(w.id) + '">Sí, fue así</button>' +
        '<button class="btn btn--sm btn--ghost" type="button" data-act="no" data-id="' + V.esc(w.id) + '">No fue así</button>' +
        '</div></li>';
    }).join('');
  }

  $('pendingList').addEventListener('click', async function (e) {
    var b = e.target.closest('button[data-act]');
    if (!b) return;
    b.disabled = true;
    var r = await V.sb.rpc('respond_work', { p_work: b.getAttribute('data-id'), p_accept: b.getAttribute('data-act') === 'yes' });
    if (r.error) { b.disabled = false; return V.toast(V.friendlyError(r.error), 'error'); }
    V.toast(b.getAttribute('data-act') === 'yes' ? 'Confirmado. Ya cuenta como verificado.' : 'Listo, lo marcamos como no confirmado.', 'ok');
    loadPending();
  });

  /* ---------- Mis trabajos ---------- */
  async function loadMine() {
    var r = await V.sb.from('works').select('*').eq('owner_id', session.user.id)
      .order('work_date', { ascending: false });
    if (r.error) { $('myList').innerHTML = '<li class="empty">' + V.esc(V.friendlyError(r.error)) + '</li>'; return; }
    var list = r.data || [];
    if (!list.length) {
      $('myList').innerHTML = '<li class="empty">Aún no registras ningún trabajo. Empieza con el último que hiciste.</li>';
      return;
    }
    $('myList').innerHTML = list.map(function (w) {
      var who = w.counterpart_name ? ' · con ' + V.esc(w.counterpart_name) : '';
      return '<li class="work' + (w.status === 'verificado' ? ' work--ok' : '') + '">' +
        '<div class="work__top"><p class="work__title">' + V.esc(w.title) + '</p>' + V.statusBadge(w.status) + '</div>' +
        '<p class="work__meta">' + metaLine(w, who) + '</p>' +
        (w.description ? '<p class="work__desc">' + V.esc(w.description) + '</p>' : '') +
        '<div class="work__actions"><button class="link-btn" type="button" data-del="' + V.esc(w.id) + '">Retirar</button></div>' +
        '</li>';
    }).join('');
  }

  $('myList').addEventListener('click', async function (e) {
    var b = e.target.closest('button[data-del]');
    if (!b) return;
    if (!confirm('¿Retirar este trabajo de tu trayectoria?')) return;
    var r = await V.sb.from('works').delete().eq('id', b.getAttribute('data-del'));
    if (r.error) return V.toast(V.friendlyError(r.error), 'error');
    V.toast('Trabajo retirado.');
    loadMine();
  });

  /* ---------- Buscar contraparte ---------- */
  var searchTimer = null;
  $('cpSearch').addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async function () {
      var q = $('cpSearch').value.trim();
      var sel = $('cpSelect');
      sel.innerHTML = '<option value="">— Sin contraparte en VERSA —</option>';
      if (q.length < 2) return;
      var r = await V.sb.from('profiles').select('id, display_name, role, zone')
        .eq('is_public', true).neq('id', session.user.id)
        .ilike('display_name', '%' + q.replace(/[%_\\]/g, '\\$&') + '%').limit(15);
      (r.data || []).forEach(function (p) {
        var o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.display_name + ' — ' + V.ROLES[p.role].label + (p.zone ? ' · ' + p.zone : '');
        sel.appendChild(o);
      });
      if (r.data && r.data.length) sel.selectedIndex = 1;
      syncNameField();
    }, 300);
  });

  function syncNameField() {
    $('cpNameField').hidden = !!$('cpSelect').value;
  }
  $('cpSelect').addEventListener('change', syncNameField);

  /* ---------- Registrar ---------- */
  $('workForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var title = $('title').value.trim();
    var date = $('work_date').value;
    if (title.length < 2) return V.toast('Ponle un título al trabajo.', 'error');
    if (!date) return V.toast('Indica la fecha.', 'error');
    if (date > new Date().toISOString().slice(0, 10)) return V.toast('La fecha no puede ser futura.', 'error');

    var cpId = $('cpSelect').value || null;
    var btn = $('addBtn');
    btn.disabled = true;
    var r = await V.sb.from('works').insert({
      owner_id: session.user.id,
      title: title,
      kind: $('kind').value,
      work_date: date,
      description: $('description').value.trim() || null,
      counterpart_id: cpId,
      counterpart_name: cpId ? null : ($('cpName').value.trim() || null)
    });
    btn.disabled = false;
    if (r.error) return V.toast(V.friendlyError(r.error), 'error');

    V.toast(cpId ? 'Registrado. Le enviamos la solicitud de confirmación.' : 'Registrado como autodeclarado.', 'ok');
    $('workForm').reset();
    $('cpSelect').innerHTML = '<option value="">— Sin contraparte en VERSA —</option>';
    syncNameField();
    loadMine();
  });

  async function init() {
    session = await V.requireAuth();
    if (!session) return;
    $('work_date').max = new Date().toISOString().slice(0, 10);
    loadPending();
    loadMine();
  }

  init();
})();
