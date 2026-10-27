/* VERSA — legal.js: pone el correo de contacto configurado en las páginas legales. */
(function () {
  'use strict';
  var mail = (window.VERSA_CONFIG || {}).contactEmail;
  var els = document.querySelectorAll('#contactMail');
  if (!mail) return;
  els.forEach(function (el) {
    var a = document.createElement('a');
    a.href = 'mailto:' + mail;
    a.textContent = mail;
    el.textContent = '';
    el.appendChild(a);
  });
})();
