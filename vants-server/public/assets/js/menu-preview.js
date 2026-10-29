/* ============================================================
   VANTS · VISTA PREVIA DE CATEGORÍAS
   ------------------------------------------------------------
   · Nav superior: los items con submenú despliegan su panel .dd
     (hover/foco/click — D24: el click NO navega, abre el panel).
     El preview #navPv vive SOLO en los links de adentro (.dd) y en
     los tabs sin submenú (TIENDA): antes se montaba sobre el tab y
     tapaba el panel (v10).
   · La sección EXPLORAR de la portada (isla React y modo clásico) fue
     retirada por el dueño (decisión D20): este módulo queda SOLO
     para el preview del nav.
   · El cajón MENÚ fue eliminado: todo vive en la portada.
   Módulo independiente: no toca arena.js ni Auth0.
   ============================================================ */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ACC = '#FF0D2E';

  var DATA = {
    perfil: { k: 'IDENTIDAD', t: 'PERFIL DE JUGADOR', i: 'user', c: ACC,
      d: 'Tu ficha única en el circuito: rango APEX, insignias verificadas, estadísticas reales y todo lo editable en un solo lugar.',
      li: ['Banner, datos y equipo editables', 'Partidas FACEIT y progreso APEX', 'Cuentas conectadas, ajustes y sesión'] },
    partidos: { k: 'AGENDA', t: 'PARTIDOS', i: 'swords', c: ACC,
      d: 'Los partidos del día con horarios y resultados reales, hora de Caracas. Cobertura de vlr.gg, sin simulación.',
      li: ['Partidos y resultados en vivo', 'Cara a cara con detalle de la serie', 'Enlace a la fuente oficial'] },
    ranking: { k: 'LÍDERES', t: 'RANKING', i: 'bar-chart-3', c: '#4CC9F0',
      d: 'La tabla real del circuito: rating, RR, partidos y winrate de cada jugador registrado en Neon.',
      li: ['Datos reales de la base', 'Ordená por cualquier columna', 'Buscador de jugadores y equipos'] },
    /* SIN tarjeta de LLAVES en las vistas previas: la pidió fuera el dueño
       (decisión D18). LLAVES ya vive en el submenú de torneo.html → el tab no
       despliega preview. keyFor cae en DATA[llaves] que no existe →
       showNavPv corta; el tab sigue navegable. */
    torneos: { k: 'CALENDARIO', t: 'TORNEOS', i: 'trophy', c: '#F5C044',
      d: 'Torneos abiertos con inscripción por equipo: los PRO tienen fee y los FREE son entrada libre.',
      li: ['Calendario y premios', 'Inscripción con tu equipo', 'Cupos y fee por torneo'] },
    rangos: { k: 'APEX', t: 'RANGOS', i: 'medal', c: ACC,
      d: 'Ocho tiers, un solo destino: de FUNDICIÓN a APEX. Conocé los tiers y qué rango te espera.',
      li: ['Los 8 emblemas por tier', 'Sub-niveles I · II · III', 'Cómo subir y cómo se pierde RR'] },
    /* SIN tarjeta de SALA DE JUGADORES en los submenús: la pidió fuera el
       dueño (decisión D17). keyFor('jugadores.html') cae en DATA[jugadores]
       que no existe → showNavPv corta y el tab SALA no despliega preview. */
    equipo: { k: 'VANTS DE 5', t: 'EQUIPO', i: 'shield', c: '#F5C044',
      d: 'Tu equipo del circuito: nombre, tag y foto; inscripciones en vivo y campeones de la temporada.',
      li: ['Inscripciones en vivo', 'Mosaico de equipos asociados', 'Campeones con corona'] },
    clips: { k: 'MOMENTOS', t: 'CLIPS', i: 'clapperboard', c: '#B44CFF',
      d: 'Los mejores momentos de la comunidad, subidos desde la app VANTS CLIPS y destacados por sus autores.',
      li: ['Vitrina pública de clips', 'Reproductor integrado', 'Cada clip atado a su cuenta'] },
    historia: { k: 'LA MARCA', t: 'HISTORIA', i: 'book-open', c: '#93939D',
      d: 'De dónde viene VANTS: la ventaja que se gana, el logo y el circuito que creció desde 2019.',
      li: ['Origen y fundación', 'El sistema de insignias', 'Línea de tiempo del circuito'] },
    guia: { k: 'CÓMO FUNCIONA', t: 'GUÍA', i: 'compass', c: '#3EE6A0',
      d: 'Todo lo que necesitás saber para competir: cuenta, perfil, torneos, rangos, pase y pagos.',
      li: ['Paso a paso para arrancar', 'Reglas y verificaciones', 'Preguntas frecuentes'] },
    membresias: { k: 'VANTS PRO', t: 'MEMBRESÍAS', i: 'crown', c: '#F5C044',
      d: 'Elegí tu nivel: FREE para competir hoy, PRO para subir con stats avanzadas y CREATOR para streamers.',
      li: ['FREE · PRO · CREATOR', 'Insignias verificables', 'Pase de temporada y patrocinios'] },
    tienda: { k: 'OFICIAL', t: 'TIENDA', i: 'shopping-bag', c: '#F5C044',
      d: 'La tienda oficial VANTS × VegaStore: indumentaria y gear del circuito, con envíos a toda LATAM.',
      li: ['Colección oficial', 'Gear y accesorios', 'Envíos y soporte'] }
    /* SIN tarjeta de DESCARGAR en las vistas previas (decisión D18, misma
       petición del dueño): keyFor('descargar.html') cae en DATA[descargar]
       que no existe → showNavPv corta y el tab no despliega preview. */
  };

  function keyFor(href) {
    if (!href || href === '#' || href.indexOf('hcPerfil') >= 0 || href.indexOf('mdPerfil') >= 0) return 'perfil';
    var m = String(href).match(/([a-z\-]+)\.html/);
    return m ? m[1] : 'perfil';
  }

  var touchMode = !window.matchMedia || !window.matchMedia('(hover: hover)').matches;

  /* ---------------- estilos ---------------- */
  var css = ''
    + '.pv-media{position:relative;flex:none;height:200px;border-bottom:1px solid var(--line2);background:radial-gradient(90% 120% at 20% 0%,color-mix(in srgb,var(--pvc) 22%,transparent),transparent 60%),linear-gradient(160deg,#101014,#0A0A0D 70%);overflow:hidden}'
    + '.pv-media:after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(255,255,255,.015) 3px 4px);pointer-events:none}'
    + '.pv-kick{position:absolute;top:18px;left:22px;font:700 9px var(--mono);letter-spacing:.3em;color:var(--pvc)}'
    + '.pv-ic{position:absolute;left:22px;bottom:20px;width:66px;height:66px;display:flex;align-items:center;justify-content:center;border:1px solid color-mix(in srgb,var(--pvc) 55%,transparent);background:color-mix(in srgb,var(--pvc) 10%,#0B0B0E);clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}'
    + '.pv-ic svg{width:28px;height:28px;color:var(--pvc)}'
    + '.pv-mark{position:absolute;right:-28px;bottom:-36px;width:200px;height:200px;opacity:.07;filter:grayscale(1)}'
    + '.pv-body{padding:20px 22px 12px;overflow-y:auto;flex:1;min-height:0}'
    + '.pv-title{font:800 24px/1.05 var(--sans);letter-spacing:.02em;text-transform:uppercase;color:var(--text);margin:0 0 10px}'
    + '.pv-desc{font:500 11.5px/1.75 var(--mono);color:var(--muted);margin:0 0 16px}'
    + '.pv-foot{flex:none;padding:14px 22px 20px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:10px}'
    + '.pv-cta{display:flex;align-items:center;justify-content:center;gap:8px;background:var(--pvc);color:#fff;font:800 11px var(--mono);letter-spacing:.1em;padding:13px;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);text-decoration:none}'
    + '.pv-cta svg{width:14px;height:14px}'
    + '.pv-hint{font:500 9px var(--mono);letter-spacing:.12em;color:var(--dim);text-align:center}'
    /* nav dropdown */
    + '#navPv{position:fixed;z-index:130;width:370px;max-width:calc(100vw - 24px);background:linear-gradient(180deg,#0C0C11,#09090C);border:1px solid var(--line2,#303039);box-shadow:0 30px 70px rgba(0,0,0,.65);clip-path:polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px);opacity:0;transform:translateY(-6px);pointer-events:none;transition:opacity .16s ease,transform .16s ease;--pvc:' + ACC + ';display:flex;flex-direction:column;overflow:hidden}'
    + '#navPv.on{opacity:1;transform:none;pointer-events:auto}'
    + '#navPv .pv-media{height:128px}'
    + '#navPv .pv-kick{top:14px;left:18px}'
    + '#navPv .pv-ic{left:18px;bottom:14px;width:52px;height:52px}'
    + '#navPv .pv-ic svg{width:22px;height:22px}'
    + '#navPv .pv-mark{width:150px;height:150px;right:-24px;bottom:-30px}'
    + '#navPv .pv-body{padding:16px 18px 8px}'
    + '#navPv .pv-title{font-size:19px;margin-bottom:8px}'
    + '#navPv .pv-desc{font-size:10.5px;margin-bottom:12px}'
    + '#navPv .pv-foot{padding:12px 18px 14px}'
    + '#navPv .pv-hint{display:none}'
    + '@media (max-width:980px),(hover:none){#navPv{display:none}}';
    /* Las reglas .hc-* del EXPLORAR clásico se retiraron con la sección
       (D20): la portada ya no tiene categorías ni panel de preview. */
  var st = document.createElement('style');
  st.id = 'pv-style';
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------------- relleno genérico ---------------- */
  function buildHTML() {
    return '<div class="pv-media"><span class="pv-kick" data-pv-kick></span>'
      + '<span class="pv-ic" data-pv-ic><i data-lucide="crosshair"></i></span>'
      + '<svg class="pv-mark" viewBox="0 0 64 64" aria-hidden="true"><use href="#vmark"/></svg></div>'
      + '<div class="pv-body"><p class="pv-title" data-pv-title></p><p class="pv-desc" data-pv-desc></p></div>'
      + '<div class="pv-foot"><a class="pv-cta" data-pv-cta href="#"><i data-lucide="arrow-up-right"></i>ABRIR SECCIÓN</a>'
      + '<span class="pv-hint" data-pv-hint></span></div>';
  }
  function fill(root, key, href) {
    var x = DATA[key] || DATA.perfil;
    root.style.setProperty('--pvc', x.c || ACC);
    var k = $('[data-pv-kick]', root); if (k) k.textContent = '/// ' + x.k;
    var ic = $('[data-pv-ic]', root); if (ic) ic.innerHTML = '<i data-lucide="' + x.i + '"></i>';
    var tt = $('[data-pv-title]', root); if (tt) tt.textContent = x.t;
    var ds = $('[data-pv-desc]', root); if (ds) ds.textContent = x.d;
    var ct = $('[data-pv-cta]', root); if (ct) ct.setAttribute('href', href || '#');
    var hn = $('[data-pv-hint]', root); if (hn) hn.textContent = touchMode ? 'Tocá ABRIR SECCIÓN para entrar' : 'Pasá el mouse por una opción · clic para abrir';
    if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) {} }
  }

  /* ---------------- 1) NAV SUPERIOR ---------------- */
  var navPv = document.createElement('div');
  navPv.id = 'navPv';
  navPv.setAttribute('aria-live', 'polite');
  navPv.innerHTML = buildHTML();
  document.body.appendChild(navPv);

  var hideTimer = null;
  function showNavPv(link) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    var href = link.getAttribute('href') || '';
    var key = keyFor(href);
    if (!DATA[key]) return;
    fill(navPv, key, href);
    var r = link.getBoundingClientRect();
    var w = 370;
    var left = Math.min(Math.max(12, r.left), Math.max(12, window.innerWidth - w - 12));
    navPv.style.left = left + 'px';
    navPv.style.top = (r.bottom + 10) + 'px';
    navPv.classList.add('on');
  }
  function hideNavPv(delay) {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { navPv.classList.remove('on'); }, delay || 160);
  }
  /* D24: el preview se ancla a los links INTERIORES (.dd) y a los tabs sin
     submenú. Los tabs has-sub ya no lo disparan: su panel .dd es el que
     abre (el card tapaba al panel y confundía el click con navegación). */
  $$('.nav-links .dd a, .nav-links .ni:not(.has-sub) > a').forEach(function (a) {
    var key = keyFor(a.getAttribute('href') || '');
    if (!DATA[key]) return;
    a.setAttribute('data-pv', key);
    if (touchMode) return;
    a.addEventListener('mouseenter', function () { showNavPv(a); });
    a.addEventListener('focus', function () { showNavPv(a); });
    a.addEventListener('mouseleave', function () { hideNavPv(160); });
  });
  navPv.addEventListener('mouseenter', function () { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } });
  navPv.addEventListener('mouseleave', function () { hideNavPv(120); });
  window.addEventListener('scroll', function () { navPv.classList.remove('on'); }, { passive: true });
  window.addEventListener('resize', function () { navPv.classList.remove('on'); });

  /* ---------------- 2) INICIO · EXPLORAR: RETIRADO (D20) ----------------
     La sección de categorías de la portada salió del sitio (isla React y
     modo clásico). El preview de categorías vive solo en el nav de arriba. */
})();
