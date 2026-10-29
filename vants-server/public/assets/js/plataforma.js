/* ============================================================
   VANTS · plataforma.js — lógica de la plataforma de torneos
   ------------------------------------------------------------
   Módulo INDEPENDIENTE (no toca arena.js/Auth0/strafe-home).
   · Estados reutilizables: skeleton / empty / error(reintentar).
   · Consume la API pública del Worker:
     /api/games /api/tournaments[/slug] /api/matches /api/teams[/slug]
     /api/players /api/players/:slug /api/articles[/slug] /api/search
   · Páginas que activa (por body[data-plataforma]):
     equipos · equipo · jugador · noticias · noticia · busqueda ·
     calendario · resultados   (F9 — fases que faltaban, T53)
   · Chip DEMO visible en todo dato is_demo=true (nunca pasa por real).
   Usa window.VANTS_API (api-client.js) si está; si no, fetch directo.
   ============================================================ */
(function () {
  'use strict';
  if (window.__VANTS_PLATAFORMA__) return;
  window.__VANTS_PLATAFORMA__ = true;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var I = function () { return (window.VANTS_I18N && window.VANTS_I18N.t) ? window.VANTS_I18N : null; };

  var MES = { es: ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'], en: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'] };
  function lang() { return (window.VANTS_I18N && window.VANTS_I18N.lang) || 'es'; }
  function fechaCorta(iso) {
    try { var d = new Date(iso); if (isNaN(d.getTime())) return '—'; return d.getDate() + ' ' + MES[lang()][d.getMonth()]; } catch (e) { return '—'; }
  }
  function fechaLarga(iso) {
    try { var d = new Date(iso); if (isNaN(d.getTime())) return '—'; return d.toLocaleDateString(lang() === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return '—'; }
  }

  /* ---------------- fetch tolerante ---------------- */
  /* El WAF del endpoint de Neon Functions bloquea el egreso de Cloudflare
     Workers (403 por ASN), así que el NAVEGADOR lee del proxy vantsdata
     DIRECTO (patrón de la casa, igual que window.VantDB). La API /api/…
     del Worker queda como fallback para clientes que sí alcancen el proxy. */
  var PROXY = 'https://br-sweet-shape-b42xhogj-vantsdata.compute.c-6.us-east-2.aws.neon.tech/';

  function proxyUrl(ruta, search) {
    var q = new URLSearchParams(search || '');
    var tabla = '';
    var mT = ruta.match(/^\/api\/teams\/([a-z0-9-]+)$/);
    var mP = ruta.match(/^\/api\/players\/([a-z0-9-]+)$/);
    if (mT) tabla = 'pt_teams';
    else if (mP) tabla = 'pt_players';
    else if (ruta === '/api/games') tabla = 'pt_games';
    else if (ruta === '/api/tournaments' || /^\/api\/tournaments\//.test(ruta)) tabla = 'pt_torneos';
    else if (ruta === '/api/matches') tabla = 'pt_matches';
    else if (ruta === '/api/teams') tabla = 'pt_teams';
    else if (ruta === '/api/articles' || /^\/api\/articles\//.test(ruta)) tabla = 'pt_articulos';
    else if (ruta === '/api/search') return null; // search: varias tablas → vía Worker o vacío
    if (!tabla) return null;
    var u = new URL(PROXY);
    u.searchParams.set('table', tabla);
    if (mT) u.searchParams.set('slug.eq', mT[1]);
    if (mP) u.searchParams.set('slug.eq', mP[1]);
    var slugs = { estado: 'estado.eq', juego: 'game_slug.eq', region: 'region.ilike', pag: 'offset', porPagina: 'limit' };
    q.forEach(function (v, k) {
      if (k === 'estado') { u.searchParams.set('estado.eq', v === 'archive' ? 'finished' : v); }
      else if (k === 'juego') { u.searchParams.set('game_slug.eq', v); }
      else if (k === 'region') { u.searchParams.set('region.ilike', v); }
      else if (k === 'porPagina') { u.searchParams.set('limit', v); }
      else if (k === 'pag') { /* offset calculado al final */ u.searchParams.set('__pag', v); }
      else u.searchParams.set(k, v);
    });
    if (mT || mP) { u.searchParams.set('limit', '1'); return u.toString(); }
    var pag = parseInt(u.searchParams.get('__pag') || '1', 10);
    u.searchParams.delete('__pag');
    if (!u.searchParams.get('limit')) u.searchParams.set('limit', '12');
    u.searchParams.set('offset', String((Math.max(1, pag) - 1) * parseInt(u.searchParams.get('limit'), 10)));
    u.searchParams.set('order', ruta.indexOf('tournaments') > -1 ? 'starts_at.asc.nullslast' : 'empieza_at.asc.nullslast');
    return u.toString();
  }

  function normalizar(fila) {
    /* pt_* (snake largo) → contrato interno de plataforma */
    if (fila && fila.nombre && fila.slug && 'estado' in fila) {
      return {
        slug: fila.slug, nombre: fila.nombre, estado: fila.estado, is_demo: !!fila.is_demo,
        game: { slug: fila.game_slug, nombre: (fila.game_slug || '').toUpperCase() },
        region: fila.region, major: !!fila.major, formato: fila.formato || null,
        prize: fila.prize_value != null ? { value: Number(fila.prize_value), currency: fila.prize_currency || 'USD' } : null,
        starts_at: fila.starts_at, ends_at: fila.ends_at, equipos: fila.max_teams,
      };
    }
    return fila;
  }

  function get(url) {
    var ruta = url.split('?')[0];
    var search = url.indexOf('?') > -1 ? url.slice(url.indexOf('?') + 1) : '';
    var pUrl = proxyUrl(ruta, search);
    var viaProxy = pUrl ? fetch(pUrl, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, data: j, via: 'proxy' }; }); })
      .catch(function (e) { return { ok: false, status: 0, data: null, error: e }; }) : null;
    var viaApi = (function () {
      try {
        if (window.VANTS_API && typeof window.VANTS_API.get === 'function') return window.VANTS_API.get(url);
      } catch (e) {}
      return fetch(url, { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, data: j }; }); })
        .catch(function (e) { return { ok: false, status: 0, data: null, error: e }; });
    })();
    return Promise.resolve(viaProxy).then(function (pr) {
      if (pr && pr.ok && pr.data) {
        var arr = Array.isArray(pr.data) ? pr.data : (pr.data.items || []);
        if (ruta === '/api/search') return viaApi;
        if (Array.isArray(arr)) {
          arr = arr.map(normalizar);
          return { ok: true, status: 200, via: 'proxy', data: { ok: true, data: ruta === '/api/games' ? arr : { items: arr, total: arr.length, pag: 1 } } };
        }
      }
      return viaApi;
    });
  }

  /* ---------------- estados UI reutilizables ---------------- */
  function skeleton(host, n) {
    var filas = '';
    for (var i = 0; i < (n || 3); i++) filas += '<div class="pf-skel-row"><span class="pf-skel sk-ic"></span><span class="pf-skel sk-main"></span><span class="pf-skel sk-col"></span><span class="pf-skel sk-col"></span></div>';
    host.innerHTML = '<div class="pf-skeleton" role="status" aria-live="polite">' + filas + '</div>';
  }
  function empty(host, mensaje) {
    host.innerHTML = '<div class="pf-empty"><b>' + esc((I() && I().t('sin_datos')) || 'SIN RESULTADOS') + '</b>' + esc(mensaje || '') + '</div>';
  }
  function error(host, onRetry) {
    host.innerHTML = '<div class="pf-error"><b>' + esc((I() && I().t('error_red')) || 'No se pudieron cargar los datos.') + '</b><button class="pf-retry" type="button">' + esc((I() && I().t('reintentar')) || 'REINTENTAR') + '</button></div>';
    var b = $('.pf-retry', host);
    if (b && typeof onRetry === 'function') b.addEventListener('click', onRetry);
  }

  /* ---------------- chip DEMO ---------------- */
  function chipDemo(isDemo) {
    return isDemo ? '<span class="sf-badge demo" title="' + esc((I() && I().t('demo_title')) || 'Datos de demostración') + '">' + esc((I() && I().t('demo')) || 'DEMO') + '</span>' : '';
  }

  /* ---------------- PÁGINA: EQUIPOS ---------------- */
  function paginaEquipos() {
    var host = $('#pfEquipos');
    if (!host) return;
    skeleton(host, 4);
    get('/api/teams' + (location.search || '')).then(function (r) {
      var dd = r.ok && r.data && r.data.ok ? r.data.data : null;
      var items = Array.isArray(dd) ? dd : (dd && dd.items) || null;
      if (!items) { error(host, paginaEquipos); return; }
      if (!items.length) { empty(host, (I() && I().t('sin_datos')) || ''); return; }
      host.innerHTML = '<div class="pf-cards">' + items.map(function (t) {
        return '<a class="pf-card" href="/equipo-ficha.html?slug=' + encodeURIComponent(t.slug) + '">' +
          '<div class="pf-card-head"><span class="pf-avatar" aria-hidden="true">' + esc((t.tag || t.nombre || '?').replace(/^DEMO\s·\s/, '').slice(0, 3).toUpperCase()) + '</span>' +
          '<h3>' + esc(t.nombre) + chipDemo(t.is_demo) + '</h3></div>' +
          '<p class="pf-meta">' + esc(String(t.game || '—').toUpperCase()) + ' · ' + esc(t.region || '—') + '</p>' +
          '<p class="pf-meta dim">' + esc(t.slug) + '</p></a>';
      }).join('') + '</div>';
    }).catch(function () { error(host, paginaEquipos); });
  }

  /* ---------------- PÁGINA: NOTICIAS ---------------- */
  function paginaNoticias() {
    var host = $('#pfNoticias');
    if (!host) return;
    skeleton(host, 3);
    get('/api/articles' + (location.search || '')).then(function (r) {
      var dd = r.ok && r.data && r.data.ok ? r.data.data : null;
      if (!dd) { error(host, paginaNoticias); return; }
      var items = Array.isArray(dd) ? dd : (dd && dd.items) || [];
      if (!items.length) { empty(host, (I() && I().t('sin_datos')) || ''); return; }
      host.innerHTML = '<div class="pf-arts">' + items.map(function (a) {
        return '<article class="pf-art">' +
          '<div class="pf-art-body"><h3><a href="/noticia?slug=' + encodeURIComponent(a.slug) + '">' + esc(a.titulo) + '</a>' + chipDemo(a.is_demo) + '</h3>' +
          '<p>' + esc(a.resumen || '') + '</p>' +
          '<p class="pf-meta dim">' + esc((I() && I().t('publicado')) || 'Publicado') + ' ' + esc(fechaLarga(a.publicado_at)) + (a.autor ? ' · ' + esc((I() && I().t('autor')) || 'Por') + ' ' + esc(a.autor) : '') + '</p></div>' +
          '<a class="pf-art-go" href="/noticia?slug=' + encodeURIComponent(a.slug) + '" aria-label="' + esc(a.titulo) + '"><i data-lucide="chevron-right"></i></a></article>';
      }).join('') + '</div>';
    }).catch(function () { error(host, paginaNoticias); });
  }

  /* ---------------- PÁGINA: FICHA DE ARTÍCULO ---------------- */
  function paginaNoticia() {
    var host = $('#pfNoticia');
    if (!host) return;
    var slug = new URLSearchParams(location.search).get('slug') || '';
    if (!slug) { empty(host, ''); return; }
    skeleton(host, 2);
    get('/api/articles').then(function (r) {
      var d = r.ok && r.data && r.data.ok ? r.data.data : null;
      var items = Array.isArray(d) ? d : (d && d.items) || [];
      var a = null;
      for (var i = 0; i < items.length; i++) { if (items[i].slug === slug) { a = items[i]; break; } }
      if (!a) { empty(host, ''); return; }
      var cuerpo = String(a.cuerpo || '').split(/\n+/).filter(Boolean).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
      host.innerHTML = '<article class="pf-art-full">' +
        '<h2>' + esc(a.titulo) + chipDemo(a.is_demo) + '</h2>' +
        '<p class="pf-meta dim">' + esc((I() && I().t('publicado')) || 'Publicado') + ' ' + esc(fechaLarga(a.publicado_at)) + (a.autor ? ' · ' + esc(a.autor) : '') + '</p>' +
        (cuerpo || '<p></p>') +
        '<p><a class="pf-volver" href="/noticias">‹ ' + esc((I() && I().t('nav_noticias')) || 'Noticias') + '</a></p></article>';
      document.title = a.titulo + ' | VANTS';
      var md = document.querySelector('meta[name="description"]');
      if (md && a.resumen) md.setAttribute('content', a.resumen);
    }).catch(function () { error(host, paginaNoticia); });
  }

  /* ---------------- PÁGINA: BÚSQUEDA ---------------- */
  function paginaBusqueda() {
    var host = $('#pfBusqueda');
    var input = $('#pfBuscaInput');
    if (!host) return;
    var q = (new URLSearchParams(location.search).get('q') || '').trim();
    if (input && q && input.value !== q) input.value = q;
    if (q.length < 2) { empty(host, (I() && I().t('vacio_busqueda')) || ''); return; }
    skeleton(host, 3);
    var patron = '%' + q + '%';
    function px(tabla, sel) {
      var u = new URL(PROXY);
      u.searchParams.set('table', tabla);
      u.searchParams.set(sel, 'ilike.' + patron);
      u.searchParams.set('limit', '8');
      return fetch(u, { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
    }
    Promise.all([px('pt_torneos', 'nombre'), px('pt_teams', 'nombre'), px('pt_articulos', 'titulo')]).then(function (res) {
      var d = { torneos: res[0] || [], equipos: res[1] || [], articulos: res[2] || [], jugadores: [] };
      var hay = d.torneos.length + d.equipos.length + d.articulos.length;
      var tit = '<h2 class="pf-search-title">' + esc(((I() && I().t('resultados_para')) || 'Resultados para "{q}"').split('{q}').join(q)) + '</h2>';
      if (!hay) { host.innerHTML = tit; empty(host, ((I() && I().t('vacio_busqueda_res')) || 'Sin resultados para "{q}".').split('{q}').join(q)); return; }
      var secciones = [];
      function lista(titulo, filas, hrefFn) {
        if (!filas.length) return;
        secciones.push('<h3 class="pf-search-h">' + esc(titulo) + '</h3><ul class="pf-search-list">' +
          filas.map(function (x) { return '<li><a href="' + hrefFn(x) + '">' + esc(x.nombre || x.titulo || '') + chipDemo(x.is_demo) + '</a></li>'; }).join('') + '</ul>');
      }
      lista((I() && I().t('secciones.torneos')) || 'Torneos', d.torneos, function (x) { return '/torneo?slug=' + encodeURIComponent(x.slug); });
      lista((I() && I().t('secciones.equipos')) || 'Equipos', d.equipos, function (x) { return '/equipo-ficha.html?slug=' + encodeURIComponent(x.slug); });
      lista((I() && I().t('secciones.articulos')) || 'Artículos', d.articulos, function (x) { return '/noticia?slug=' + encodeURIComponent(x.slug); });
      host.innerHTML = tit + secciones.join('');
    }).catch(function () { error(host, function () { paginaBusqueda(); }); });
  }

  /* ---------------- fila de partido (client, misma marca que plataforma-core.filaMatch) ---------------- */
  /* El proxy serializa timestamptz con variantes que V8 a veces rechaza
     (ej. "2026-10-19T19:30:56.123456+00"): parser defensivo. */
  function fechaSegura(v) {
    if (!v) return null;
    var d = new Date(v);
    if (!isNaN(d.getTime())) return d;
    var m = String(v).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(?:\s*(Z|[+-]\d{1,2}(?::?\d{2})?))?$/);
    if (m) {
      var tz = !m[3] ? 'Z' : (m[3] === 'Z' ? 'Z' : (/^[+-]\d{2}$/.test(m[3]) ? m[3] + ':00' : m[3].replace(':', '')));
      d = new Date(m[1] + 'T' + m[2] + tz);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }
  function filaMatchCli(m, locale) {
    var juego = m.game && m.game.slug ? m.game.slug : 'valorant';
    var estado = m.estado || 'upcoming';
    var badge = '';
    if (estado === 'live') badge = '<span class="sf-badge red">' + esc((I() && I().t('en_vivo')) || 'EN VIVO') + '</span>';
    else if (estado === 'finished') badge = '<span class="sf-badge dim">' + esc((I() && I().t('finalizado')) || 'FINALIZADO') + '</span>';
    if (m.is_demo) badge += chipDemo(true);
    var score = (m.score && m.score.a != null && m.score.b != null)
      ? '<span class="sf-mscore"><b>' + Number(m.score.a) + '</b><i>:</i><b>' + Number(m.score.b) + '</b></span>'
      : '<span class="sf-mscore sin"><i>' + (estado === 'finished' ? '—' : 'vs') + '</i></span>';
    var dF = fechaSegura(m.empieza_at);
    var fecha = dF
      ? esc(fechaCorta(dF)) + ' · ' + esc(dF.toLocaleTimeString(lang() === 'en' ? 'en-GB' : 'es-ES', { hour: '2-digit', minute: '2-digit' }))
      : esc((I() && I().t('fecha_anuncio')) || 'POR ANUNCIAR');
    return '<a class="sf-row sf-mrow" href="/calendario.html" data-est="' + esc(estado) + '">' +
      '<span class="sf-rlogo" aria-hidden="true"></span>' +
      '<span class="sf-rmain"><span class="sf-rname"><b>' + esc((m.equipos && m.equipos.a) || '—') + '</b>' + score + '<b>' + esc((m.equipos && m.equipos.b) || '—') + '</b>' + badge + '</span>' +
      '<span class="sf-stage">' + esc(String(juego).toUpperCase()) + (m.best_of ? ' · Bo' + Number(m.best_of) : '') + '</span></span>' +
      '<span class="sf-rcol c-fechas">' + fecha + '</span>' +
      '<span class="sf-rgo"></span></a>';
  }
  function mapMatch(f) {
    return {
      game: { slug: f.game_slug }, equipos: { a: f.equipo_a, b: f.equipo_b },
      score: f.score_a != null && f.score_b != null ? { a: Number(f.score_a), b: Number(f.score_b) } : null,
      estado: f.estado, best_of: f.best_of, empieza_at: f.empieza_at, is_demo: !!f.is_demo,
    };
  }
  function px(tabla, params) {
    var u = new URL(PROXY);
    u.searchParams.set('table', tabla);
    Object.keys(params || {}).forEach(function (k) { u.searchParams.set(k, params[k]); });
    return fetch(u.toString(), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* ---------------- PÁGINA: FICHA DE EQUIPO (F9) ---------------- */
  function paginaEquipo() {
    var host = $('#pfEquipo');
    if (!host) return;
    var slug = new URLSearchParams(location.search).get('slug') || '';
    if (!slug || !/^[a-z0-9-]{2,64}$/.test(slug)) { empty(host, ''); return; }
    skeleton(host, 3);
    Promise.all([
      get('/api/teams/' + slug),
      px('pt_players', { 'team_slug.eq': slug, 'order': 'nombre.asc', 'limit': 30 }),
    ]).then(function (res) { return res[0].ok && res[0].data && res[0].data.ok ? res : null; })
      .then(function (res) {
        if (!res) { error(host, paginaEquipo); return; }
        var dd = res[0].data.data;
        // El proxy envuelve listas en {items:[…]} y el Worker API devuelve el objeto directo
        var ficha = Array.isArray(dd) ? dd[0] : (dd && dd.items && dd.items.length ? dd.items[0] : (dd && dd.slug ? dd : null));
        if (!ficha || !ficha.nombre) { empty(host, ''); return; }
        var roster = res[1] || [];
        // Las partidas por nombre del equipo (equipo_a guarda el NOMBRE, no el slug)
        var nombre = ficha.nombre;
        Promise.all([
          px('pt_matches', { 'equipo_a.eq': nombre, 'order': 'empieza_at.desc.nullslast', 'limit': 20 }),
          px('pt_matches', { 'equipo_b.eq': nombre, 'order': 'empieza_at.desc.nullslast', 'limit': 20 }),
        ]).then(function (ms) {
          var vistas = {}, partidas = [];
          (ms[0] || []).concat(ms[1] || []).forEach(function (f) {
            var k = String(f.external_id || f.id);
            if (vistas[k]) return; vistas[k] = 1; partidas.push(mapMatch(f));
          });
          partidas.sort(function (a, b) { return Date.parse(b.empieza_at || 0) - Date.parse(a.empieza_at || 0); });
          pintaEquipo(host, ficha, roster, partidas);
        }).catch(function () { pintaEquipo(host, ficha, roster, []); });
      }).catch(function () { error(host, paginaEquipo); });
  }
  function pintaEquipo(host, ficha, roster, partidas) {
    var rosterHtml = (roster && roster.length)
      ? '<div class="pf-roster">' + roster.map(function (p) {
          return '<a class="pf-player" href="/jugador.html?slug=' + encodeURIComponent(p.slug) + '">' +
            '<span class="pf-avatar" aria-hidden="true">' + esc(String(p.nombre || '?').replace(/^DEMO\s·\s/, '').slice(0, 2).toUpperCase()) + '</span>' +
            '<span class="pf-player-n"><b>' + esc(p.nombre) + '</b>' + chipDemo(p.is_demo) + '<i>' + esc(p.rol || '—') + (p.pais ? ' · ' + esc(p.pais) : '') + '</i></span></a>';
        }).join('') + '</div>'
      : '<div class="pf-empty"><b>' + esc((I() && I().t('roster_vacio')) || 'SIN PLANTILLA PUBLICADA') + '</b></div>';
    var partHtml = (partidas && partidas.length)
      ? '<div class="sf-table" role="list">' + partidas.slice(0, 10).map(function (m) { return filaMatchCli(m, lang()); }).join('') + '</div>'
      : '<div class="pf-empty"><b>' + esc((I() && I().t('sin_partidas')) || 'SIN PARTIDAS REGISTRADAS') + '</b></div>';
    host.innerHTML = '<article class="pf-ficha">' +
      '<div class="pf-ficha-head"><span class="pf-avatar big" aria-hidden="true">' + esc((ficha.tag || ficha.nombre || '?').replace(/^DEMO\s·\s/, '').slice(0, 3).toUpperCase()) + '</span>' +
      '<div><h2>' + esc(ficha.nombre) + chipDemo(ficha.is_demo) + '</h2>' +
      '<p class="pf-meta">' + esc(String(ficha.game && ficha.game.slug || '—').toUpperCase()) + ' · ' + esc(ficha.region || '—') + (ficha.tag ? ' · [' + esc(ficha.tag) + ']' : '') + '</p></div></div>' +
      '<h3 class="pf-ficha-h">' + esc((I() && I().t('plantilla')) || 'PLANTILLA') + '</h3>' + rosterHtml +
      '<h3 class="pf-ficha-h">' + esc((I() && I().t('partidas_equipo')) || 'PARTIDAS') + '</h3>' + partHtml +
      '<p><a class="pf-volver" href="/equipos.html">‹ ' + esc((I() && I().t('nav_equipos')) || 'Equipos') + '</a></p></article>';
    document.title = ficha.nombre + ' | VANTS';
  }

  /* ---------------- PÁGINA: FICHA DE JUGADOR (F9) ---------------- */
  function paginaJugador() {
    var host = $('#pfJugador');
    if (!host) return;
    var slug = new URLSearchParams(location.search).get('slug') || '';
    if (!slug || !/^[a-z0-9-]{2,64}$/.test(slug)) { empty(host, ''); return; }
    skeleton(host, 2);
    get('/api/players/' + slug).then(function (r) {
      var dd = r.ok && r.data && r.data.ok ? r.data.data : null;
      var jug = Array.isArray(dd) ? dd[0] : (dd && dd.items && dd.items.length ? dd.items[0] : (dd && dd.slug ? dd : null));
      if (!jug || !jug.nombre) { empty(host, ''); return; }
      host.innerHTML = '<article class="pf-ficha">' +
        '<div class="pf-ficha-head"><span class="pf-avatar big" aria-hidden="true">' + esc(String(jug.nombre).replace(/^DEMO\s·\s/, '').slice(0, 2).toUpperCase()) + '</span>' +
        '<div><h2>' + esc(jug.nombre) + chipDemo(jug.is_demo) + '</h2>' +
        '<p class="pf-meta">' + (jug.game ? esc(String(jug.game.slug).toUpperCase()) + ' · ' : '') + esc(jug.rol || '—') + (jug.pais ? ' · ' + esc(jug.pais) : '') + '</p>' +
        (jug.bio ? '<p class="pf-bio">' + esc(jug.bio) + '</p>' : '') + '</div></div>' +
        (jug.equipo && jug.equipo.slug ? '<h3 class="pf-ficha-h">' + esc((I() && I().t('equipo_del_jugador')) || 'EQUIPO') + '</h3>' +
          '<p><a class="pf-link-card" href="/equipo-ficha.html?slug=' + encodeURIComponent(jug.equipo.slug) + '"><b>' + esc(jug.equipo.nombre) + '</b>' + chipDemo(jug.equipo.is_demo) + '<i>' + esc(String(jug.equipo.game && jug.equipo.game.slug || '').toUpperCase()) + '</i></a></p>' : '') +
        '<p><a class="pf-volver" href="/jugadores.html">‹ ' + esc((I() && I().t('nav_jugadores')) || 'Jugadores') + '</a></p></article>';
      document.title = jug.nombre + ' | VANTS';
    }).catch(function () { error(host, paginaJugador); });
  }

  /* ---------------- PÁGINAS: CALENDARIO Y RESULTADOS (F9) ---------------- */
  function paginaPartidas(estado, orden) {
    var host = estado === 'upcoming' ? $('#pfCalendario') : $('#pfResultados');
    if (!host) return;
    skeleton(host, 5);
    px('pt_matches', { 'estado.eq': estado, 'order': 'empieza_at.' + orden + '.nullslast', 'limit': '24' }).then(function (filas) {
      var items = (filas || []).map(mapMatch);
      if (!items.length) { empty(host, (I() && I().t(estado === 'upcoming' ? 'vacio_partidas' : 'sin_datos')) || ''); return; }
      if (estado === 'upcoming') {
        items.sort(function (a, b) { return Date.parse(a.empieza_at || 9e15) - Date.parse(b.empieza_at || 9e15); });
        var vivas = items.filter(function (m) { return m.estado === 'live'; });
        var prox = items.filter(function (m) { return m.estado !== 'live'; });
        items = vivas.concat(prox);
      }
      host.innerHTML = '<div class="sf-table" role="list">' + items.map(function (m) { return filaMatchCli(m, lang()); }).join('') + '</div>';
    }).catch(function () { error(host, function () { paginaPartidas(estado, orden); }); });
  }
  function paginaCalendario() { paginaPartidas('upcoming', 'asc'); }
  function paginaResultados() { paginaPartidas('finished', 'desc'); }

  /* ---------------- boot por body[data-plataforma] ---------------- */
  function boot() {
    var modo = document.body.getAttribute('data-plataforma');
    if (modo === 'equipos') paginaEquipos();
    else if (modo === 'equipo') paginaEquipo();
    else if (modo === 'jugador') paginaJugador();
    else if (modo === 'calendario') paginaCalendario();
    else if (modo === 'resultados') paginaResultados();
    else if (modo === 'noticias') paginaNoticias();
    else if (modo === 'noticia') paginaNoticia();
    else if (modo === 'busqueda') paginaBusqueda();
    // Re-render al cambiar idioma (los textos de estados se regeneran)
    document.addEventListener('vants:lang', function () {
      if (modo === 'equipos') paginaEquipos();
      else if (modo === 'equipo') paginaEquipo();
      else if (modo === 'jugador') paginaJugador();
      else if (modo === 'calendario') paginaCalendario();
      else if (modo === 'resultados') paginaResultados();
      else if (modo === 'noticias') paginaNoticias();
      else if (modo === 'noticia') paginaNoticia();
      else if (modo === 'busqueda') paginaBusqueda();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.VANTS_PLAT = { skeleton: skeleton, empty: empty, error: error, chipDemo: chipDemo, get: get, fechaCorta: fechaCorta, fechaLarga: fechaLarga, fechaSegura: fechaSegura };
})();
