/* Menú móvil compacto: botón hamburguesa que abre .nav-links como panel
   a pantalla completa (≤760px). En escritorio el botón no se muestra. */
(function () {
  'use strict';
  var nav = document.querySelector('.nav');
  var inner = nav && nav.querySelector('.nav-in');
  var links = nav && nav.querySelector('.nav-links');
  if (!inner || !links || nav.querySelector('.nav-burger')) return;
  if (!links.id) links.id = 'navLinks';

  var right = nav.querySelector('.nav-right');
  var memb = right && right.querySelector('a[href="membresias.html"]');
  if (memb && !links.querySelector('.nav-mob-only')) {
    var ni = document.createElement('div');
    ni.className = 'ni nav-mob-only';
    var a = document.createElement('a');
    a.href = 'membresias.html';
    a.textContent = 'MEMBRESÍAS';
    ni.appendChild(a);
    links.appendChild(ni);
  }

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-burger';
  btn.setAttribute('aria-controls', links.id);
  btn.innerHTML = '<span></span><span></span><span></span>';
  inner.appendChild(btn);

  function set(open) {
    nav.classList.toggle('nav-open', open);
    document.documentElement.classList.toggle('nav-lock', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }
  nav.classList.add('nav-js');
  set(false);

  btn.addEventListener('click', function () { set(!nav.classList.contains('nav-open')); });
  links.addEventListener('click', function (e) { if (e.target.closest('a') && !e.defaultPrevented) set(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('nav-open')) { set(false); btn.focus(); }
  });
  var mq = window.matchMedia('(min-width: 761px)');
  var onMq = function (m) { if (m.matches) set(false); };
  if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
})();
