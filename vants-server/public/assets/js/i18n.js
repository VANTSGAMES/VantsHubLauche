/* ============================================================
   VANTS · i18n.js — internacionalización es/en de la plataforma
   ------------------------------------------------------------
   · Diccionario con claves para el shell (nav, tabs, estados,
     búsqueda, footer) y textos dinámicos (hero, panel).
   · Aplica a elementos [data-i18n] (textContent) al cargar.
   · Locale: body[data-lang] (rutas /en/… del Worker) → ?lang= →
     localStorage('vants-lang') → 'es'.
   · Módulos usan window.VANTS_I18N.t(clave, params).
   No toca arena.js/Auth0; convive con el shell strafe.
   ============================================================ */
(function () {
  'use strict';
  if (window.__VANTS_I18N__) return;
  window.__VANTS_I18N__ = true;

  var DICT = {
    es: {
      nav_inicio: 'Inicio', nav_partidas: 'Partidas', nav_torneos: 'Torneos',
      nav_equipos: 'Equipos', nav_jugadores: 'Jugadores', nav_ranking: 'Ranking',
      nav_brackets: 'Brackets', nav_clips: 'Clips', nav_noticias: 'Noticias',
      nav_cta: 'MEMBRESÍAS',
      tab_curso: 'EN CURSO', tab_prox: 'PRÓXIMOS', tab_arch: 'ARCHIVO',
      estado_upcoming: 'Próximos torneos de', estado_ongoing: 'Torneos en curso de', estado_archive: 'Archivo de torneos de',
      panel_upcoming: 'PRÓXIMOS TORNEOS DE', panel_ongoing: 'TORNEOS EN CURSO DE', panel_archive: 'ARCHIVO DE TORNEOS DE',
      desc_upcoming: 'Calendario de próximos torneos de esports de {juego}. Inscripción abierta por equipo, premios en efectivo y VANTS RATING en juego cada partida.',
      desc_ongoing: 'Torneos de {juego} en curso ahora mismo: brackets, resultados en vivo y clasificación.',
      desc_archive: 'Historial de torneos finalizados de {juego}: campeones, brackets y resultados.',
      buscar: 'Buscar', busqueda_placeholder: 'Torneos, equipos, jugadores, artículos…',
      ver_todos: 'VER TODOS LOS TORNEOS', ver_todos_art: 'VER TODOS LOS ARTÍCULOS',
      cargando: 'CARGANDO…', sin_datos: 'SIN RESULTADOS', reintentar: 'REINTENTAR',
      vacio_torneos: 'No hay torneos en este estado ahora mismo. El calendario se anuncia por Discord y en la sección Torneos.',
      vacio_partidas: 'No hay partidas programadas ahora mismo. El calendario se anuncia por Discord y en la sección Torneos.',
      vacio_busqueda: 'Escribe al menos 2 caracteres para buscar torneos, equipos, jugadores y artículos.',
      vacio_busqueda_res: 'Sin resultados para "{q}". Prueba con otro término.',
      error_red: 'No se pudieron cargar los datos. Comprueba tu conexión y reintenta.',
      demo: 'DEMO', demo_title: 'Datos de demostración: aún no son torneos reales',
      secciones: { torneos: 'Torneos', equipos: 'Equipos', jugadores: 'Jugadores', articulos: 'Artículos' },
      prev: '‹ ANTERIOR', next: 'SIGUIENTE ›', pagina: 'Página {p} de {n}',
      fecha_anuncio: 'POR ANUNCIAR', en_vivo: 'EN VIVO', finalizado: 'FINALIZADO',
      crumb_inicio: 'INICIO', crumb_torneos_de: 'TORNEOS DE',
      inscripcion: 'INSCRIBIR MI EQUIPO', reglas: 'REGLAS RÁPIDAS', bracket: 'BRACKETS Y PARTIDAS',
      equipos_inscritos: 'EQUIPOS INSCRITOS', sin_participantes: 'Aún no hay equipos confirmados.',
      leer_articulo: 'Leer más', publicado: 'Publicado', autor: 'Por',
      resultados_para: 'Resultados para "{q}"',
      plantilla: 'PLANTILLA', partidas_equipo: 'PARTIDAS DEL EQUIPO',
      roster_vacio: 'SIN PLANTILLA PUBLICADA', sin_partidas: 'SIN PARTIDAS REGISTRADAS',
      equipo_del_jugador: 'EQUIPO', calendario_tit: 'Calendario de partidas', resultados_tit: 'Resultados de partidas',
      calendario_desc: 'Próximas partidas de los torneos de VANTS, por fecha y hora local. Los partidos en vivo se muestran primero.',
      resultados_desc: 'Resultados finales de las partidas de los torneos de VANTS: marcadores y competidores.',
      nav_calendario: 'Calendario', a_resultados: 'VER RESULTADOS', a_calendario: 'VER CALENDARIO',
    },
    en: {
      nav_inicio: 'Home', nav_partidas: 'Matches', nav_torneos: 'Tournaments',
      nav_equipos: 'Teams', nav_jugadores: 'Players', nav_ranking: 'Ranking',
      nav_brackets: 'Brackets', nav_clips: 'Clips', nav_noticias: 'News',
      nav_cta: 'MEMBERSHIPS',
      tab_curso: 'ONGOING', tab_prox: 'UPCOMING', tab_arch: 'ARCHIVE',
      estado_upcoming: 'Upcoming tournaments for', estado_ongoing: 'Ongoing tournaments for', estado_archive: 'Tournament archive for',
      panel_upcoming: 'UPCOMING TOURNAMENTS FOR', panel_ongoing: 'ONGOING TOURNAMENTS FOR', panel_archive: 'TOURNAMENT ARCHIVE FOR',
      desc_upcoming: 'Calendar of upcoming {juego} esports tournaments. Open team registration, cash prizes and VANTS RATING on every match.',
      desc_ongoing: '{juego} tournaments running right now: brackets, live results and standings.',
      desc_archive: 'History of finished {juego} tournaments: champions, brackets and results.',
      buscar: 'Search', busqueda_placeholder: 'Tournaments, teams, players, articles…',
      ver_todos: 'SEE ALL TOURNAMENTS', ver_todos_art: 'SEE ALL ARTICLES',
      cargando: 'LOADING…', sin_datos: 'NO RESULTS', reintentar: 'RETRY',
      vacio_torneos: 'There are no tournaments in this state right now. The calendar is announced on Discord and in the Tournaments section.',
      vacio_busqueda: 'Type at least 2 characters to search tournaments, teams, players and articles.',
      vacio_busqueda_res: 'No results for "{q}". Try another term.',
      error_red: 'Data could not be loaded. Check your connection and retry.',
      vacio_partidas: 'No matches scheduled right now. The calendar is announced on Discord and in the Tournaments section.',
      demo: 'DEMO', demo_title: 'Sample data: these are not real tournaments yet',
      secciones: { torneos: 'Tournaments', equipos: 'Teams', jugadores: 'Players', articulos: 'Articles' },
      prev: '‹ PREV', next: 'NEXT ›', pagina: 'Page {p} of {n}',
      fecha_anuncio: 'TBA', en_vivo: 'LIVE', finalizado: 'FINISHED',
      crumb_inicio: 'HOME', crumb_torneos_de: 'TOURNAMENTS FOR',
      inscripcion: 'REGISTER MY TEAM', reglas: 'QUICK RULES', bracket: 'BRACKETS AND MATCHES',
      equipos_inscritos: 'REGISTERED TEAMS', sin_participantes: 'No confirmed teams yet.',
      leer_articulo: 'Read more', publicado: 'Published', autor: 'By',
      resultados_para: 'Results for "{q}"',
      plantilla: 'ROSTER', partidas_equipo: 'TEAM MATCHES',
      roster_vacio: 'NO ROSTER PUBLISHED', sin_partidas: 'NO MATCHES RECORDED',
      equipo_del_jugador: 'TEAM', calendario_tit: 'Match calendar', resultados_tit: 'Match results',
      calendario_desc: 'Upcoming matches from VANTS tournaments, by date and local time. Live matches are shown first.',
      resultados_desc: 'Final results from VANTS tournament matches: scores and competitors.',
      nav_calendario: 'Calendar', a_resultados: 'VIEW RESULTS', a_calendario: 'VIEW CALENDAR',
    },
  };

  var LANG = 'es';

  function detectar() {
    try {
      var dl = document.body && document.body.getAttribute('data-lang');
      if (dl === 'en' || dl === 'es') return dl;
      var qs = new URLSearchParams(location.search).get('lang');
      if (qs === 'en' || qs === 'es') return qs;
      var ls = localStorage.getItem('vants-lang');
      if (ls === 'en' || ls === 'es') return ls;
      var ruta = location.pathname.match(/^\/(es|en)\//);
      if (ruta) return ruta[1];
    } catch (e) {}
    return 'es';
  }

  function t(clave, params) {
    var v = (DICT[LANG] && DICT[LANG][clave]);
    if (v == null) v = DICT.es[clave] != null ? DICT.es[clave] : clave;
    if (params && typeof v === 'string') {
      for (var k in params) v = v.split('{' + k + '}').join(params[k]);
    }
    return v;
  }

  function aplicar(raiz) {
    var scope = raiz || document;
    try {
      scope.querySelectorAll('[data-i18n]').forEach(function (el) {
        var clave = el.getAttribute('data-i18n');
        var val = t(clave);
        if (typeof val === 'string' && val !== clave) el.textContent = val;
      });
      scope.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
        var clave = el.getAttribute('data-i18n-ph');
        var val = t(clave);
        if (typeof val === 'string' && val !== clave) el.setAttribute('placeholder', val);
      });
      document.documentElement.setAttribute('lang', LANG);
    } catch (e) {}
  }

  function fijar(lang, persistir) {
    LANG = (lang === 'en' ? 'en' : 'es');
    if (persistir) { try { localStorage.setItem('vants-lang', LANG); } catch (e) {} }
    aplicar();
    try { document.dispatchEvent(new CustomEvent('vants:lang', { detail: { lang: LANG } })); } catch (e) {}
  }

  LANG = detectar();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { aplicar(); });
  } else {
    aplicar();
  }

  window.VANTS_I18N = { t: t, aplicar: aplicar, fijar: fijar, get lang() { return LANG; }, DICT: DICT };
})();
