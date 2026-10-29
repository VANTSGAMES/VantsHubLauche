// ============================================
// VANTS — api-client.js · Fase 2 (Frontend modular)
// --------------------------------------------
// Cliente de red unificado. REGLA DE LA CASA (docs/ARCHITECTURE.md):
// módulo independiente, no modifica a los módulos antiguos.
//  · Si window.VantAuth0 existe (auth0-config.js) usa su token para peticiones
//    autenticadas. Si no existe, funciona igual (fetch puro).
//  · Si window.VantDB existe, `rpc()` e `invalidate()` son fachadas hacia él.
//  · Nunca lanza excepciones hacia fuera: devuelve { ok, status, data, error }.
//  · Sin localStorage; solo memoria y eventos document 'vants:api:*'.
// ============================================
(function () {
  if (window.__VANTS_API_CLIENT__) return; // guarda anti-doble-carga
  window.__VANTS_API_CLIENT__ = true;

  var DEFAULTS = {
    timeout: 15000,   // ms antes de abortar
    retries: 1,       // reintentos extra SOLO para GET/HEAD idempotentes
    backoff: 500,     // ms base entre reintentos
  };

  function emit(name, detail) {
    try { document.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {}
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // Token Auth0 del sistema existente (silencioso, nunca lanza)
  async function authToken() {
    try {
      if (window.VantAuth0 && typeof window.VantAuth0.getToken === 'function') {
        return await window.VantAuth0.getToken();
      }
    } catch (e) {}
    return null;
  }

  /**
   * request(url, opts) → Promise<{ ok, status, data, error }>
   *  opts: { method, body, headers, auth, timeout, retries, signal }
   *  · auth:true  → añade Bearer del Auth0 existente si hay sesión.
   *  · body objeto → JSON.stringify + Content-Type automático.
   *  · Reintenta solo GET/HEAD ante fallos de red/5xx/429.
   */
  async function request(url, opts) {
    opts = opts || {};
    var method = String(opts.method || 'GET').toUpperCase();
    var cfg = Object.assign({}, DEFAULTS, opts);
    var attempts = (method === 'GET' || method === 'HEAD') ? 1 + (cfg.retries || 0) : 1;
    var lastErr = null;

    for (var attempt = 0; attempt < attempts; attempt++) {
      if (attempt) await sleep(cfg.backoff * attempt);
      var ctrl = null;
      var timer = null;
      try {
        var headers = Object.assign({}, opts.headers);
        var body;
        if (opts.body !== undefined && opts.body !== null) {
          if (typeof opts.body === 'string' || opts.body instanceof FormData ||
              opts.body instanceof Blob || opts.body instanceof ArrayBuffer) {
            body = opts.body;
            if (!(opts.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'text/plain;charset=UTF-8';
          } else {
            body = JSON.stringify(opts.body);
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
          }
        }
        if (opts.auth) {
          var t = await authToken();
          if (t) headers['Authorization'] = 'Bearer ' + t;
        }
        ctrl = new AbortController();
        timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, cfg.timeout || DEFAULTS.timeout);
        var signal = opts.signal
          ? opts.signal // respetar señal externa si la hay
          : ctrl.signal;

        var res = await fetch(url, { method: method, headers: headers, body: body, signal: signal, credentials: opts.credentials || 'same-origin' });
        var raw = await res.text();
        var data = null;
        if (raw) { try { data = JSON.parse(raw); } catch (e) { data = raw; } }

        if (res.ok) {
          return { ok: true, status: res.status, data: data, error: null };
        }
        // 429/5xx → cuenta como fallo reintentable
        var retriable = res.status === 429 || res.status >= 500;
        lastErr = { message: (data && data.message) || res.statusText || ('HTTP ' + res.status), status: res.status };
        if (!retriable) break;
      } catch (e) {
        lastErr = { message: (e && e.name === 'AbortError') ? 'timeout' : (e && e.message) || 'network', status: 0 };
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    emit('vants:api:error', { url: url, method: method, error: lastErr });
    return { ok: false, status: (lastErr && lastErr.status) || 0, data: null, error: lastErr };
  }

  var api = {
    request: request,
    get: function (url, opts) { return request(url, Object.assign({}, opts, { method: 'GET' })); },
    post: function (url, body, opts) { return request(url, Object.assign({}, opts, { method: 'POST', body: body })); },
    patch: function (url, body, opts) { return request(url, Object.assign({}, opts, { method: 'PATCH', body: body })); },
    del: function (url, opts) { return request(url, Object.assign({}, opts, { method: 'DELETE' })); },
    // Fachadas al sistema existente (no duplican lógica):
    rpc: async function (fnName, params) {
      try {
        if (window.VantDB && typeof window.VantDB.rpc === 'function') return await window.VantDB.rpc(fnName, params || {});
      } catch (e) { return { data: null, error: e }; }
      return { data: null, error: { message: 'VantDB no disponible' } };
    },
    invalidate: function (prefix) { try { window.VantDB && window.VantDB.invalidate && window.VantDB.invalidate(prefix); } catch (e) {} },
    // Versión por si algo quiere comprobar la carga del módulo
    version: '1.0.0',
  };

  window.VANTS_API = api;
})();
