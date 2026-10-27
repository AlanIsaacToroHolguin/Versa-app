/* ============================================
   VERSA — cuenta.js
   Edición del perfil propio, contacto, contraseña
   y derechos sobre los datos (exportar / borrar).
   ============================================ */

(function () {
  'use strict';

  var V = window.VERSA;
  var msg = document.getElementById('accMsg');
  var form = document.getElementById('profileForm');
  var $ = function (id) { return document.getElementById(id); };

  if (!V.sb) { V.notConfiguredNotice(msg); return; }

  var params = new URLSearchParams(location.search);
  var session = null;
  var profile = null;

  // Llegar desde el enlace de «olvidé mi contraseña»
  V.sb.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') {
      $('passwordPanel').hidden = false;
      $('passwordPanel').scrollIntoView({ behavior: 'smooth' });
      V.toast('Escribe tu nueva contraseña.');
    }
  });

  async function init() {
    session = await V.requireAuth();
    if (!session) return;

    var r = await V.sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    profile = r.data;
    if (!profile) {
      msg.innerHTML = '<div class="notice notice--err">No pudimos cargar tu perfil. Cierra sesión y vuelve a entrar.</div>';
      return;
    }

    var c = await V.sb.from('contacts').select('*').eq('profile_id', session.user.id).maybeSingle();
    var contact = c.data || {};

    $('accTitle').textContent = profile.display_name;
    $('accRole').textContent = V.ROLES[profile.role].label;

    if (params.get('nuevo')) {
      msg.innerHTML = '<div class="notice"><strong>¡Bienvenido a VERSA!</strong> Completa tu perfil. ' +
        'Cuando estés listo, actívalo como público para aparecer en el directorio.</div>';
    }
    if (params.get('clave')) {
      msg.innerHTML = '<div class="notice">Crea tu nueva contraseña en la sección «Contraseña», más abajo.</div>';
    }

    $('is_public').checked = !!profile.is_public;
    $('display_name').value = profile.display_name || '';
    $('bio').value = profile.bio || '';
    $('zone').value = profile.zone || '';
    $('city').value = profile.city || 'Medellín';
    $('genres').value = (profile.genres || []).join(', ');
    $('services').value = profile.services || '';
    $('price_note').value = profile.price_note || '';
    $('instagram').value = profile.instagram || '';
    $('website').value = profile.website || '';
    $('whatsapp').value = contact.whatsapp || '';
    $('contact_email').value = contact.contact_email || '';

    if (profile.role === 'estudio') $('studioFields').hidden = false;
    if (profile.role === 'manager' || profile.role === 'disquera') {
      $('genresLabel').textContent = 'Géneros que te interesan';
    }

    $('viewPublic').href = '/perfil/?id=' + encodeURIComponent(profile.id);
    $('viewPublic').hidden = false;

    form.hidden = false;
    $('passwordPanel').hidden = false;
    $('dataPanel').hidden = false;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = $('saveBtn');
    var name = $('display_name').value.trim();
    if (name.length < 2) return V.toast('El nombre necesita al menos 2 letras.', 'error');

    var whatsapp = $('whatsapp').value.trim();
    if (whatsapp && !/^[0-9+ ]{7,20}$/.test(whatsapp)) {
      return V.toast('El WhatsApp solo admite números, espacios y +.', 'error');
    }
    var website = $('website').value.trim();
    if (website && !V.safeUrl(website)) return V.toast('El enlace no parece válido.', 'error');

    btn.disabled = true;
    var upd = await V.sb.from('profiles').update({
      display_name: name,
      bio: $('bio').value.trim() || null,
      zone: $('zone').value.trim() || null,
      city: $('city').value.trim() || 'Medellín',
      genres: V.parseGenres($('genres').value),
      services: profile.role === 'estudio' ? ($('services').value.trim() || null) : null,
      price_note: profile.role === 'estudio' ? ($('price_note').value.trim() || null) : null,
      instagram: $('instagram').value.trim() || null,
      website: website ? V.safeUrl(website) : null,
      is_public: $('is_public').checked
    }).eq('id', session.user.id);

    var cEmail = $('contact_email').value.trim();
    var up2 = await V.sb.from('contacts').upsert({
      profile_id: session.user.id,
      whatsapp: whatsapp || null,
      contact_email: cEmail || null
    });
    btn.disabled = false;

    var err = upd.error || up2.error;
    if (err) return V.toast(V.friendlyError(err), 'error');

    $('accTitle').textContent = name;
    V.toast($('is_public').checked ? 'Guardado. Tu perfil es público.' : 'Guardado. Tu perfil sigue oculto.', 'ok');
  });

  $('passwordForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var pw = $('newPassword').value;
    if (pw.length < 8) return V.toast('La contraseña debe tener al menos 8 caracteres.', 'error');
    var r = await V.sb.auth.updateUser({ password: pw });
    if (r.error) return V.toast(V.friendlyError(r.error), 'error');
    $('newPassword').value = '';
    V.toast('Contraseña actualizada.', 'ok');
  });

  $('exportBtn').addEventListener('click', async function () {
    var uid = session.user.id;
    var res = await Promise.all([
      V.sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
      V.sb.from('contacts').select('*').eq('profile_id', uid).maybeSingle(),
      V.sb.from('works').select('*').or('owner_id.eq.' + uid + ',counterpart_id.eq.' + uid)
    ]);
    var dump = {
      exportado_el: new Date().toISOString(),
      correo: session.user.email,
      perfil: res[0].data,
      contacto: res[1].data,
      trabajos: res[2].data
    };
    var blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mis-datos-versa.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  $('deleteBtn').addEventListener('click', async function () {
    if (!confirm('Se borrarán tu cuenta, tu perfil y tus trabajos registrados. No se puede deshacer. ¿Continuar?')) return;
    var r = await V.sb.rpc('delete_my_account');
    if (r.error) return V.toast(V.friendlyError(r.error), 'error');
    await V.sb.auth.signOut();
    location.href = '/?cuenta=borrada';
  });

  init();
})();
