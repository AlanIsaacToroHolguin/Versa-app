/* ============================================
   VERSA — auth.js
   Registro e inicio de sesión.
   ============================================ */

(function () {
  'use strict';

  var V = window.VERSA;
  var page = document.body.getAttribute('data-page');
  var msg = document.getElementById('authMsg');

  function show(html, cls) {
    msg.innerHTML = '<div class="notice ' + (cls || '') + '" role="status">' + html + '</div>';
    msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (!V.sb) {
    V.notConfiguredNotice(msg);
    return;
  }

  // Si ya hay sesión, no tiene sentido estar aquí
  V.getSession().then(function (s) {
    if (s) location.replace('/cuenta/');
  });

  var params = new URLSearchParams(location.search);

  /* ---------- Registro ---------- */
  if (page === 'registro') {
    var rol = params.get('rol');
    if (rol) {
      var radio = document.querySelector('input[name="role"][value="' + rol.replace(/[^a-z]/g, '') + '"]');
      if (radio) radio.checked = true;
    }

    document.getElementById('registerForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var f = e.target;
      var btn = document.getElementById('submitBtn');
      var name = f.elements.dname.value.trim();
      var email = f.email.value.trim();
      var password = f.password.value;
      var role = f.role.value;

      if (name.length < 2) return show('Escribe tu nombre (mínimo 2 letras).', 'notice--err');
      if (!/^\S+@\S+\.\S+$/.test(email)) return show('Revisa el correo: no parece válido.', 'notice--err');
      if (password.length < 8) return show('La contraseña debe tener al menos 8 caracteres.', 'notice--err');
      if (!f.consent.checked) return show('Para crear tu cuenta debes aceptar los términos y la política de datos.', 'notice--err');

      btn.disabled = true;
      var r = await V.sb.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { role: role, display_name: name },
          emailRedirectTo: location.origin + '/cuenta/?nuevo=1'
        }
      });
      btn.disabled = false;

      if (r.error) return show(V.esc(V.friendlyError(r.error)), 'notice--err');

      if (r.data.session) {
        location.href = '/cuenta/?nuevo=1';
      } else {
        f.hidden = true;
        show('<strong>Casi listo.</strong> Te enviamos un enlace a <strong>' + V.esc(email) +
          '</strong>. Ábrelo para confirmar tu correo y entrar. Si no llega, revisa spam.');
      }
    });
  }

  /* ---------- Ingreso ---------- */
  if (page === 'ingresar') {
    var next = V.safeNext(params.get('next'), '/cuenta/');

    document.getElementById('loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var f = e.target;
      var btn = document.getElementById('submitBtn');
      if (!f.email.value.trim() || !f.password.value) {
        return show('Escribe tu correo y tu contraseña.', 'notice--err');
      }
      btn.disabled = true;
      var r = await V.sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
      btn.disabled = false;
      if (r.error) return show(V.esc(V.friendlyError(r.error)), 'notice--err');
      location.href = next;
    });

    document.getElementById('forgotBtn').addEventListener('click', async function () {
      var email = document.getElementById('email').value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return show('Escribe tu correo arriba y vuelve a pulsar «Olvidé mi contraseña».', 'notice--err');
      }
      var r = await V.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/cuenta/?clave=1' });
      if (r.error) return show(V.esc(V.friendlyError(r.error)), 'notice--err');
      show('Si ese correo tiene cuenta, te enviamos un enlace para crear una contraseña nueva.');
    });
  }
})();
