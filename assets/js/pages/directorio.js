/* ============================================
   VERSA — directorio.js
   Listado y filtros de perfiles públicos.
   ============================================ */

(function () {
  'use strict';

  var V = window.VERSA;
  var box = document.getElementById('results');
  var LIMIT = 100;

  if (!V.sb) { V.notConfiguredNotice(document.getElementById('dirMsg')); return; }

  var timer = null;
  var seq = 0;

  async function load() {
    var mine = ++seq;
    box.innerHTML = '<p class="empty">Cargando…</p>';

    var q = document.getElementById('q').value.trim();
    var role = document.getElementById('role').value;
    var genre = document.getElementById('genre').value.trim().toLowerCase();
    var onlyVerified = document.getElementById('onlyVerified').checked;

    var query = V.sb.from('profiles').select('*').eq('is_public', true)
      .order('created_at', { ascending: false }).limit(LIMIT);
    if (role) query = query.eq('role', role);
    if (genre) query = query.contains('genres', [genre]);
    if (q) query = query.ilike('display_name', '%' + q.replace(/[%_\\]/g, '\\$&') + '%');

    var r = await query;
    if (mine !== seq) return; // llegó una búsqueda más nueva
    if (r.error) {
      box.innerHTML = '<div class="notice notice--err" style="grid-column:1/-1">' + V.esc(V.friendlyError(r.error)) + '</div>';
      return;
    }

    var profiles = r.data || [];
    var stats = {};
    if (profiles.length) {
      var s = await V.sb.from('profile_stats').select('*').in('profile_id', profiles.map(function (p) { return p.id; }));
      (s.data || []).forEach(function (row) { stats[row.profile_id] = row; });
      if (mine !== seq) return;
    }

    if (onlyVerified) {
      profiles = profiles.filter(function (p) { return stats[p.id] && stats[p.id].verified_count > 0; });
    }
    // Más trabajos verificados primero
    profiles.sort(function (a, b) {
      return ((stats[b.id] || {}).verified_count || 0) - ((stats[a.id] || {}).verified_count || 0);
    });

    if (!profiles.length) {
      box.innerHTML = '<p class="empty" style="grid-column:1/-1">Todavía no hay perfiles que coincidan. ' +
        '<a href="/registro/">Crea el tuyo</a> y sé de los primeros.</p>';
      return;
    }
    box.innerHTML = profiles.map(function (p) { return V.profileCard(p, stats[p.id]); }).join('');
  }

  function debounced() {
    clearTimeout(timer);
    timer = setTimeout(load, 300);
  }

  document.getElementById('filters').addEventListener('submit', function (e) { e.preventDefault(); load(); });
  ['q', 'genre'].forEach(function (id) { document.getElementById(id).addEventListener('input', debounced); });
  ['role', 'onlyVerified'].forEach(function (id) { document.getElementById(id).addEventListener('change', load); });

  load();
})();
