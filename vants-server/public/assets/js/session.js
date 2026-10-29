// ============================================
// VANTS — session.js · Fase 2 (Frontend modular)
// --------------------------------------------
// Capa de sesión de SOLO LECTURA sobre el Auth0 existente.
// REGLA DE LA CASA (docs/ARCHITECTURE.md): no inicia su propio cliente Auth0,
// no hace login/logout, no escribe nada. Solo OBSERVA y AVISA:
//  · window.VANTS_SESSION.state()  → { authed, user, sub, token } | null
//  · window.VANTS_SESSION.me()     → perfil local (localStorage 'vants_me', solo lectura)
//  · window.VANTS_SESSION.onChange(cb) → suscripción a cambios de sesión
// Eventos document: 'vants:session:change' { authed, sub }
// Si VantAuth0 no está listo, state() devuelve { authed:false, ready:false }.
// ============================================
(function () {
  if (window.__VANTS_SESSION__) return; // guarda anti-doble-carga
  window.__VANTS_SESSION__ = true;

  var listeners = new Set();
  var last = null;      // última firma de sesión { authed, sub }
  var lastFull = null;  // último snapshot completo (cache corto)
  var lastFullAt = 0;
  var POLL = 30000;     // sondeo suave: no interfiere con el SDK Auth0

  function emit(name, detail) {
    try { document.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {}
  }

  function getVantAuth0() {
    try { return window.VantAuth0 || null; } catch (e) { return null; }
  }

  async function state(force) {
    var v = getVantAuth0();
    if (!v || !v.client) return { authed: false, ready: false, user: null, sub: null, token: null };
    if (!force && lastFull && Date.now() - lastFullAt < 5000) return lastFull;
    var authed = false, user = null, token = null;
    try { authed = !!(await v.client.isAuthenticated()); } catch (e) { authed = false; }
    try { if (authed) user = (await v.client.getUser()) || null; } catch (e) { user = null; }
    try { if (authed && typeof v.getToken === 'function') token = await v.getToken(); } catch (e) { token = null; }
    var snap = {
      authed: authed,
      ready: true,
      user: user,
      sub: (user && user.sub) || null,
      token: token,
    };
    lastFull = snap; lastFullAt = Date.now();
    var sig = { authed: snap.authed, sub: snap.sub };
    if (!last || last.authed !== sig.authed || last.sub !== sig.sub) {
      last = sig;
      emit('vants:session:change', { authed: snap.authed, sub: snap.sub });
      listeners.forEach(function (cb) {
        try { cb({ authed: snap.authed, sub: snap.sub, user: snap.user }); } catch (e) {}
      });
    }
    return snap;
  }

  // Perfil local que arena.js mantiene en localStorage — SOLO LECTURA.
  function me() {
    try { return JSON.parse(localStorage.getItem('vants_me') || 'null'); }
    catch (e) { return null; }
  }

  function onChange(cb) {
    if (typeof cb !== 'function') return function () {};
    listeners.add(cb);
    // Estado inicial inmediato (async, sin bloquear)
    state().catch(function () {});
    return function () { listeners.delete(cb); };
  }

  // Sondeo suave + reanudación de pestaña (barato: isAuthenticated/getUser del SDK ya cargado)
  var timer = null;
  function start() {
    if (timer) return;
    timer = setInterval(function () { state(true).catch(function () {}); }, POLL);
  }
  try {
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) state(true).catch(function () {});
    });
    // El flujo Auth0 existente a veces vuelve de redirect: re-chequear al foco
    window.addEventListener('focus', function () { state(true).catch(function () {}); });
  } catch (e) {}
  start();

  window.VANTS_SESSION = {
    state: state,
    me: me,
    onChange: onChange,
    refresh: function () { return state(true); },
    version: '1.0.0',
  };
})();
