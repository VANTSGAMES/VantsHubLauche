/* ============================================================
   VANTS CINEMATIC · v1 — Fase 1 de la arquitectura VANTS GAMES
   ------------------------------------------------------------
   Módulo 100% INDEPENDIENTE (mismo patrón que vants-cinematic.css):
   · NO toca arena.js, Auth0, RR, torneos ni base de datos.
   · NO hace fetch, NO escribe localStorage (solo sessionStorage
     para recordar la intro dentro de la sesión).
   · Si algo falla, queda en silencio: la web funciona igual.
   Capas: intro cinematográfica, brasas de fondo, ambiente, tilt 3D.
   ============================================================ */
(function () {
  'use strict';
  if (window.__VANTS_CINEMATIC__) return;
  var CIN = { version: '1.0.0' };
  window.__VANTS_CINEMATIC__ = CIN;

  function boolMQ(q) { try { return window.matchMedia(q).matches; } catch (e) { return false; } }
  var REDUCED = boolMQ('(prefers-reduced-motion: reduce)');
  var TOUCH = boolMQ('(pointer: coarse)');
  var SAVE = false;
  try { SAVE = !!(navigator.connection && navigator.connection.saveData); } catch (e) {}

  function safe(fn) { try { fn(); } catch (e) { /* silencio total */ } }

  /* ------------------------------------------------------------
     1 · INTRO — una vez por sesión, saltable con clic o Escape.
     Si el JS se congela, el CSS autodestruye el nodo a los 4.5s.
     ------------------------------------------------------------ */
  function intro() {
    try { if (sessionStorage.getItem('vantsCinIntro')) return; } catch (e) { return; }
    var el = document.createElement('div');
    el.id = 'cinIntro';
    el.innerHTML =
      '<div class="cin-i-bg"></div>' +
      '<div class="cin-i-core">' +
        '<svg class="cin-i-mark" viewBox="0 0 64 64" aria-hidden="true"><use href="#vmark"/></svg>' +
        '<div class="cin-i-word" aria-label="VANTS GAMES">' +
          '<span class="cin-i-vants"><b>V</b><b>A</b><b>N</b><b>T</b><b>S</b></span>' +
          '<span class="cin-i-games">GAMES</span>' +
        '</div>' +
        '<div class="cin-i-bar"></div>' +
      '</div>' +
      '<div class="cin-i-skip">CLIC PARA ENTRAR</div>';
    document.body.appendChild(el);
    document.documentElement.classList.add('cin-lock');

    var t1 = 0, closed = false;
    function out(fast) {
      if (closed) return;
      closed = true;
      clearTimeout(t1);
      el.classList.add('cin-out');
      document.documentElement.classList.remove('cin-lock');
      try { sessionStorage.setItem('vantsCinIntro', 'done'); } catch (e) {}
      var life = fast ? 300 : 720;
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, life);
    }
    t1 = setTimeout(function () { out(false); }, 2050);
    el.addEventListener('click', function () { out(true); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') out(true); }, { once: true });
  }

  /* ------------------------------------------------------------
     2 · BRASAS — canvas fijo detrás del contenido (z 0, sin input).
     Pausa con la pestaña oculta; se adapta al resize; DPR ≤ 2.
     ------------------------------------------------------------ */
  function particles() {
    var cv = document.createElement('canvas');
    cv.id = 'cinFx';
    cv.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(cv, document.body.firstChild);
    var ctx = cv.getContext('2d');
    if (!ctx) { if (cv.parentNode) cv.parentNode.removeChild(cv); return; }

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, list = [], raf = 0, visible = true;
    var MOBILE = (document.documentElement.clientWidth < 760) || TOUCH;
    var N = MOBILE ? 26 : 56;

    function size() {
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function mk(seed) {
      return {
        x: Math.random() * W,
        y: seed ? Math.random() * H : H + 12,
        r: 0.8 + Math.random() * 1.8,
        vy: 0.12 + Math.random() * 0.5,
        vx: (Math.random() - 0.5) * 0.12,
        a: 0.12 + Math.random() * 0.4,
        tw: Math.random() * Math.PI * 2,
        ts: 0.008 + Math.random() * 0.02,
        red: Math.random() < 0.78
      };
    }
    function fill() { list.length = 0; for (var i = 0; i < N; i++) list.push(mk(true)); }
    function step() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        p.y -= p.vy; p.x += p.vx; p.tw += p.ts;
        if (p.y < -14 || p.x < -20 || p.x > W + 20) list[i] = mk(false);
        var a = p.a * (0.72 + 0.28 * Math.sin(p.tw));
        ctx.beginPath();
        ctx.fillStyle = p.red ? 'rgba(255,13,46,' + a.toFixed(3) + ')' : 'rgba(232,236,239,' + (a * 0.75).toFixed(3) + ')';
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      if (visible) raf = requestAnimationFrame(step);
    }
    function start() { if (!raf && visible) raf = requestAnimationFrame(step); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    size(); fill(); start();

    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden;
      if (visible) start(); else stop();
    });
    var rz = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rz);
      rz = setTimeout(function () { size(); }, 160);
    });
  }

  /* ------------------------------------------------------------
     3 · AMBIENTE — capa de brillos fijos (puro DOM + CSS).
     ------------------------------------------------------------ */
  function ambient() {
    var d = document.createElement('div');
    d.className = 'cin-ambient';
    d.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(d, document.body.firstChild);
  }

  /* ------------------------------------------------------------
     4 · TILT 3D — solo elementos marcados con data-tilt.
     El ángulo máx. va en el atributo (data-tilt="2.2" → 2.2°).
     ------------------------------------------------------------ */
  function tilt() {
    var els = document.querySelectorAll('[data-tilt]');
    for (var i = 0; i < els.length; i++) (function (el) {
      var MAX = parseFloat(el.getAttribute('data-tilt')) || 2;
      var raf = 0, rx = 0, ry = 0;
      el.classList.add('cin-tilt');
      function apply() {
        raf = 0;
        el.style.setProperty('--cin-rx', rx.toFixed(2) + 'deg');
        el.style.setProperty('--cin-ry', ry.toFixed(2) + 'deg');
      }
      el.addEventListener('pointermove', function (e) {
        var b = el.getBoundingClientRect();
        if (!b.width || !b.height) return;
        var px = (e.clientX - b.left) / b.width - 0.5;
        var py = (e.clientY - b.top) / b.height - 0.5;
        ry = px * MAX * 2; rx = -py * MAX * 2;
        if (!raf) raf = requestAnimationFrame(apply);
      });
      el.addEventListener('pointerleave', function () {
        rx = 0; ry = 0;
        if (!raf) raf = requestAnimationFrame(apply);
      });
    })(els[i]);
  }

  /* ------------------------- BOOT ---------------------------- */
  function boot() {
    safe(ambient);
    if (!REDUCED && !SAVE) {
      safe(particles);
      safe(intro);
    }
    if (!REDUCED && !TOUCH) safe(tilt);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
