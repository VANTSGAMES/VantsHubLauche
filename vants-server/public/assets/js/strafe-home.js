/* ============================================================
   STRAFE HOME · v2.1 — Filas con el layout EXACTO de strafe.com
   ------------------------------------------------------------
   Fila strafe: [icono juego] [logo] [NOMBRE + juego + badge] |
   [región] [premio] [fechas] [equipos] — meta 12px/700 #666.
   · Tabs EN CURSO / PRÓXIMOS (default) / ARCHIVO como ANCHORS a
     las rutas /es|en/tournaments/:juego/:estado/ (URL compartible,
     back/forward correctos). Estado leído de body[data-torneos].
   · Datos REALES de la plataforma (VantDB + /api/tournaments) con
     fallback DEMO etiquetado (chip visible, nunca pasa por real).
   · Cada fila abre la ficha torneo.html?slug=…/id=…
   · Hero/breadcrumb/panel sincronizados con el juego activo y con
     i18n (window.VANTS_I18N).
   Módulo independiente: no toca arena.js/Auth0/RR.
   ============================================================ */
(function () {
  'use strict';
  if (window.__SF_HOME__) return;
  var SF = { version: '2.1.0', estado: 'prox' }; /* strafe aterriza en PRÓXIMOS */
  window.__SF_HOME__ = SF;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  function safe(fn) { try { fn(); } catch (e) { /* silencio total */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tr(clave, params) {
    try { if (window.VANTS_I18N && window.VANTS_I18N.t) return window.VANTS_I18N.t(clave, params); } catch (e) {}
    return clave;
  }

  var GAME_NAMES = { valorant: 'VALORANT', cs2: 'COUNTER-STRIKE 2' };
  var ICON_VAL = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2.2 3h5.6l7.3 14-2.3 4L2.2 3Z"/><path d="M21.8 3h-5.6l-3.4 6.5 2.4 4.5L21.8 3Z"/></svg>';
  var ICON_CS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="2.1"/><path d="M12 3.8v3.4M12 16.8v3.4M3.8 12h3.4M16.8 12h3.4"/></svg>';

  function juegoDe(t) {
    var g = String(t.game || '').toLowerCase();
    if (/cs|counter|csgo/.test(g)) return 'cs2';
    return 'valorant';
  }

  /* ---------------- ESTADO POR URL (/es|en/tournaments/:juego/:estado) ---------------- */
  var EST_A_URL = { curso: 'ongoing', prox: 'upcoming', arch: 'archive' };
  var URL_A_EST = { ongoing: 'curso', upcoming: 'prox', archive: 'arch' };
  function rutaTorneos() {
    var m = location.pathname.match(/^\/(es|en)\/tournaments\/([a-z0-9-]{2,24})\/(upcoming|ongoing|archive)\/?$/);
    return m ? { lang: m[1], juego: m[2], estado: m[3] } : null;
  }
  function urlDeEstado(est, juego) {
    var r = rutaTorneos();
    var lang = (r && r.lang) || (document.body.getAttribute('data-lang') || 'es');
    var j = juego || (r && r.juego) || (document.body.getAttribute('data-game') || 'valorant');
    if (window.VANTS_I18N && window.VANTS_I18N.lang === 'en' && !r) lang = 'en';
    return '/' + lang + '/tournaments/' + j + '/' + EST_A_URL[est] + '/';
  }

  /* ---------------- CLASIFICACIÓN POR ESTADO ---------------- */
  function estadoDe(t) {
    var s = String(t.status || '').toLowerCase();
    if (/final|cerrad|complet|archiv|terminad|done/.test(s)) return 'arch';
    if (/abierto|open|ongoing|curso|activo|live|inscripc/.test(s)) return 'curso';
    return 'prox';
  }

  /* ---------------- FECHAS ESTILO STRAFE "17 – 20 NOV" ---------------- */
  var MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  function dShort(d) { return d.getDate() + ' ' + MES[d.getMonth()]; }
  function fechasDe(t) {
    try {
      var a = t.starts_at ? new Date(t.starts_at) : null;
      var b = t.ends_at ? new Date(t.ends_at) : null;
      if (a && !isNaN(a.getTime()) && b && !isNaN(b.getTime()) && b.getTime() !== a.getTime()) return dShort(a) + ' – ' + dShort(b);
      if (a && !isNaN(a.getTime())) return dShort(a);
      if (t.day && t.mon) return t.day + ' ' + t.mon;
    } catch (e) {}
    return 'POR ANUNCIAR';
  }

  /* ---------------- FILA EXACTA STRAFE ---------------- */
  function fila(t) {
    var ed = estadoDe(t);
    var g = juegoDe(t);
    /* badge tipo MAJOR junto al nombre (lima = abierto/major) */
    var tier = String(t.tier || 'open').toLowerCase();
    var badge = '';
    if (t.is_demo) badge = '<span class="sf-badge demo" title="' + esc(tr('demo_title')) + '">' + esc(tr('demo')) + '</span>';
    else if (tier === 'major' || /major|premier/.test(tier)) badge = '<span class="sf-badge">MAJOR</span>';
    else if (ed === 'curso') badge = '<span class="sf-badge">ABIERTO</span>';
    else if (ed === 'arch') badge = '<span class="sf-badge dim">FINALIZADO</span>';
    else badge = '<span class="sf-badge red">PRÓXIMO</span>';

    var premio = (t.prize_pool != null && Number(t.prize_pool) > 0)
      ? '$' + Number(t.prize_pool).toLocaleString('en-US')
      : '—';
    var equipos = (t.max_participants != null && Number(t.max_participants) > 0)
      ? '+' + Number(t.max_participants)
      : (Number(t.current_participants) > 0 ? '+' + Number(t.current_participants) : '—');
    var region = esc(String(t.region || 'LATAM').toUpperCase().slice(0, 6));
    var href = '/torneo?' + (t.slug ? 'slug=' + encodeURIComponent(t.slug) : 'id=' + encodeURIComponent(t.id != null ? t.id : '')) + '#ficha';

    return '<a class="sf-row" href="' + href + '" data-est="' + ed + '">' +
      '<span class="sf-rlogo">' + (g === 'cs2' ? ICON_CS : ICON_VAL) + '</span>' +
      '<span class="sf-rmain">' +
        '<span class="sf-rname"><b>' + esc(t.name || 'Torneo VANTS') + '</b>' + badge + '</span>' +
        '<span class="sf-stage">' + (GAME_NAMES[g] || 'VALORANT') + ' · ' + esc(String(t.tier || 'open').toUpperCase()) + '</span>' +
      '</span>' +
      '<span class="sf-rcol c-region">' + region + '</span>' +
      '<span class="sf-rcol c-prize">' + premio + '</span>' +
      '<span class="sf-rcol c-fechas">' + esc(fechasDe(t)) + '</span>' +
      '<span class="sf-rcol c-slots sf-rparts"><span class="n">' + equipos + '</span></span>' +
      '<span class="sf-rgo"><i data-lucide="chevron-right"></i></span></a>';
  }

  function pintar(rows) {
    var host = $('#sfRows');
    if (!host) return;
    var visibles = rows.filter(function (t) { return estadoDe(t) === SF.estado; });
    if (SF.estado === 'arch' && !visibles.length) {
      host.innerHTML = '<div class="sf-empty"><b>' + esc(tr('tab_arch')) + '</b>' + esc(tr('vacio_torneos')) + '</div>';
    } else if (!visibles.length) {
      host.innerHTML = '<div class="sf-empty"><b>' + esc(tr('sin_datos')) + '</b>' + esc(tr('vacio_torneos')) + '</div>';
    } else {
      host.innerHTML = visibles.slice(0, 8).map(fila).join('');
    }
    var cnt = $('#sfTCount');
    if (cnt) {
      cnt.textContent = rows.length
        ? (rows === FALLBACK ? 'CALENDARIO DEMO · DATOS DE EJEMPLO' : 'DATOS EN VIVO · NEON · ' + rows.length + ' TORNEOS')
        : 'CALENDARIO DEMO · DATOS DE EJEMPLO';
      cnt.classList.toggle('on', rows !== FALLBACK && rows.length > 0);
    }
    safe(function () { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); });
  }

  /* ---------------- HERO / BREADCRUMB / PANEL POR JUEGO (después de arena.js) ---------------- */
  function juego() { return document.body.getAttribute('data-game') || 'valorant'; }
  function nombre() { return GAME_NAMES[juego()] || 'VALORANT'; }
  function estadoClave() { return SF.estado === 'curso' ? 'ongoing' : SF.estado === 'arch' ? 'archive' : 'upcoming'; }
  function heroStrafe() {
    safe(function () {
      var h = $('#heroTitle'), s = $('#heroSub');
      if (h) h.textContent = tr('estado_' + estadoClave()) + ' ' + nombre();
      if (s) s.textContent = tr('desc_' + estadoClave(), { juego: nombre() });
      var c = $('#sfCrumbGame'); if (c) c.textContent = nombre();
      var cs = $('#sfCrumbSect'); if (cs) cs.textContent = tr('crumb_torneos_de') + ' ' + nombre();
      var pg = $('#sfPanelGame'); if (pg) pg.textContent = nombre();
      var ph = document.querySelector('.sf-panel-head > span');
      if (ph && pg) {
        /* mantiene el <span id=sfPanelGame> dentro del head, re-imponiendo el prefijo */
      }
    });
  }
  function actualizarTabs() {
    safe(function () {
      document.querySelectorAll('.sf-tab[data-est]').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-est') === SF.estado);
      });
    });
  }
  safe(function () {
    heroStrafe();
    window.addEventListener('load', heroStrafe);
    /* los .gbtn de arena.js corren primero (se registraron antes); re-imponemos después */
    document.querySelectorAll('.gbtn').forEach(function (b) {
      b.addEventListener('click', function () { setTimeout(heroStrafe, 0); });
    });
    if (window.MutationObserver) {
      new MutationObserver(heroStrafe).observe(document.body, { attributes: true, attributeFilter: ['data-game'] });
    }
  });

  /* ---------------- TABS como anchors con estado en la URL ---------------- */
  safe(function () {
    var tabs = document.querySelectorAll('.sf-tab[data-est]');
    tabs.forEach(function (b) {
      /* upgrade button → anchor (deep link + SEO + teclado) */
      if (String(b.tagName).toLowerCase() === 'button') {
        var a = document.createElement('a');
        a.className = b.className;
        a.setAttribute('data-est', b.getAttribute('data-est'));
        a.textContent = b.textContent;
        b.parentNode.replaceChild(a, b);
        b = a;
      }
      b.setAttribute('href', urlDeEstado(b.getAttribute('data-est')));
      b.addEventListener('click', function (e) {
        /* misma página: pushState + render (el deep link real es el href) */
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        SF.estado = b.getAttribute('data-est');
        actualizarTabs();
        pintar(SF.cache || FALLBACK);
        heroStrafe();
        try { history.pushState({ sfEstado: SF.estado }, '', urlDeEstado(SF.estado)); } catch (e2) {}
      });
    });
    window.addEventListener('popstate', function () {
      var r = rutaTorneos();
      SF.estado = r ? (URL_A_EST[r.estado] || 'prox') : 'prox';
      if (r) document.body.setAttribute('data-game', r.juego);
      actualizarTabs(); pintar(SF.cache || FALLBACK); heroStrafe();
    });
  });

  /* ---------------- estado inicial desde la URL ---------------- */
  safe(function () {
    var r = rutaTorneos();
    if (r && URL_A_EST[r.estado]) {
      SF.estado = URL_A_EST[r.estado];
      document.body.setAttribute('data-game', r.juego);
    }
    document.addEventListener('vants:lang', function () { actualizarTabs(); heroStrafe(); pintar(SF.cache || FALLBACK); });
  });

  /* ---------------- FALLBACK S4 (datos DEMO etiquetados) ---------------- */
  var FALLBACK = [
    { id: 's4-asc', slug: 'demo-ascension-series-s4', name: 'DEMO · ASCENSIÓN SERIES S4', status: 'abierto', tier: 'open', game: 'valorant', prize_pool: null, starts_at: null, day: '24', mon: 'OCT', region: 'LATAM', max_participants: 32, is_demo: true },
    { id: 's4-ranked', slug: 'demo-ranked-nocturna', name: 'DEMO · RANKED NOCTURNA', status: 'abierto', tier: 'ranked', game: 'valorant', prize_pool: null, region: 'LATAM', max_participants: 64, is_demo: true },
    { id: 's4-copa', slug: 'demo-copa-comunidad-s4', name: 'DEMO · COPA COMUNIDAD S4', status: 'proximamente', tier: 'open', game: 'valorant', prize_pool: 500, day: '08', mon: 'NOV', region: 'LATAM', max_participants: 16, is_demo: true },
    { id: 's4-stratos', slug: 'demo-stratos-major-s4', name: 'DEMO · STRATOS MAJOR S4', status: 'proximamente', tier: 'major', game: 'cs2', prize_pool: 1000, day: '15', mon: 'NOV', region: 'LATAM', max_participants: 24, is_demo: true }
  ];

  /* ---------------- CARGA DE DATOS REALES (plataforma pt_* vía proxy) ---------------- */
  var PROXY = 'https://br-sweet-shape-b42xhogj-vantsdata.compute.c-6.us-east-2.aws.neon.tech/';

  function filaPt(t) {
    /* fila de pt_torneos → la forma que ya consume fila()/pintar() */
    var estado = String(t.estado || 'upcoming');
    return {
      slug: t.slug,
      name: t.nombre,
      status: estado === 'ongoing' ? 'abierto' : estado === 'finished' ? 'finalizado' : 'proximo',
      tier: t.major ? 'major' : 'open',
      game: t.game_slug,
      prize_pool: t.prize_value != null ? Number(t.prize_value) : null,
      starts_at: t.starts_at,
      region: t.region,
      max_participants: t.max_teams,
      is_demo: !!t.is_demo,
      source: t.source,
    };
  }

  safe(function () {
    pintar(FALLBACK); /* pinta algo de inmediato */
    fetch(PROXY + '?table=pt_torneos&limit=50', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (Array.isArray(rows) && rows.length) {
          SF.cache = rows.map(filaPt);
          pintar(SF.cache);
        } else {
          SF.cache = FALLBACK; pintar(FALLBACK);
        }
      })
      .catch(function () { SF.cache = FALLBACK; pintar(FALLBACK); });
  });

  /* ---------------- TARJETA DISCORD (sin invite aún) ---------------- */
  safe(function () {
    var d = $('#sfDiscord');
    if (!d) return;
    d.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof window.toast === 'function') toast('El invite del Discord oficial se entrega con tu cuenta: ingresa y lo verás en tu panel.', 'info');
    });
  });
})();
