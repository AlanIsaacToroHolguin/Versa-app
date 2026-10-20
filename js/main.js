/* ============================================
   VERSA — main.js
   Sin librerías externas. Todo nativo.
   ============================================ */

(function () {
  'use strict';

  /* ---------- 0. Marca que el JS está vivo ----------
     El CSS solo oculta los bloques animados si existe esta clase.
     Si el JS fallara, la página se ve completa igual.            */
  document.documentElement.classList.add('js');

  /* ---------- 1. Menú móvil ---------- */
  var toggle = document.getElementById('navToggle');
  var links  = document.getElementById('navLinks');

  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });

    // Cerrar al tocar un enlace
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('is-open');
        toggle.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- 2. Borde de la barra al hacer scroll ---------- */
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('is-stuck', window.scrollY > 10);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- 3. Aparición al hacer scroll ---------- */
  var items = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window && items.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        // pequeño escalonado para que no aparezcan todas de golpe
        setTimeout(function () {
          entry.target.classList.add('is-visible');
        }, i * 90);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    items.forEach(function (el) { io.observe(el); });

    // Red de seguridad: pase lo que pase, a los 3 s todo está visible.
    setTimeout(function () {
      items.forEach(function (el) { el.classList.add('is-visible'); });
    }, 3000);
  } else {
    // Navegadores antiguos: mostrar todo sin animación
    items.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- 4. Año del pie de página ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

})();
