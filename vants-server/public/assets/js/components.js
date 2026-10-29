// ============================================
// VANTS — components.js · Fase 2 (Frontend modular)
// --------------------------------------------
// Primitivas de UI compartidas, OPT-IN (no renderiza nada al cargar).
// Clases con prefijo vui- para NO chocar con arena.css/arena.js.
//  · VANTS_UI.toast(msg, {type:'info|ok|warn|error', timeout}) → elemento
//  · VANTS_UI.confirm({title, message, okText, cancelText}) → Promise<bool>
//  · VANTS_UI.badge(text, tone) → span
//  · VANTS_UI.reportErrors(on) → red de seguridad global: captura
//    window.onerror / unhandledrejection y avisa con toast genérico
//    (dedupe 15s; el detalle técnico solo en consola). arena.js sigue
//    manejando sus propios errores; esto solo recoge lo que se escapa.
// Respeta prefers-reduced-motion. Sin fetch, sin storage. Falla silencioso.
// ============================================
(function () {
  if (window.__VANTS_UI__) return; // guarda anti-doble-carga
  window.__VANTS_UI__ = true;

  var REDUCED = false;
  try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var CSS = [
    '#vui-toasts{position:fixed;z-index:99990;bottom:18px;right:18px;display:flex;flex-direction:column;gap:8px;max-width:min(92vw,360px);pointer-events:none}',
    '.vui-toast{pointer-events:auto;display:flex;align-items:flex-start;gap:10px;background:#101318;color:#f3f5f7;border:1px solid #2a2f3a;border-left:3px solid #ff0d2e;border-radius:10px;padding:10px 14px;font:14px/1.45 "Archivo",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.45);opacity:0;transform:translateY(8px);transition:opacity .22s ease,transform .22s ease}',
    '.vui-toast.vui-show{opacity:1;transform:none}',
    '.vui-toast .vui-ico{flex:0 0 auto;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:13px;line-height:1.45;color:#ff0d2e}',
    '.vui-toast.vui-ok{border-left-color:#25c26a}.vui-toast.vui-ok .vui-ico{color:#25c26a}',
    '.vui-toast.vui-warn{border-left-color:#f5a524}.vui-toast.vui-warn .vui-ico{color:#f5a524}',
    '.vui-toast.vui-error{border-left-color:#ff0d2e}',
    '.vui-badge{display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;border:1px solid #2a2f3a;color:#d6dae1;background:#12151b}',
    '.vui-badge.vui-ok{border-color:#25c26a55;color:#7fe0a8}.vui-badge.vui-warn{border-color:#f5a52455;color:#ffd58a}.vui-badge.vui-live{border-color:#ff0d2e66;color:#ff6b81}',
    '.vui-overlay{position:fixed;inset:0;z-index:99991;background:rgba(5,6,9,.72);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .18s ease}',
    '.vui-overlay.vui-show{opacity:1}',
    '.vui-modal{width:min(94vw,430px);background:#101318;border:1px solid #2a2f3a;border-radius:14px;padding:22px;color:#f3f5f7;font:15px/1.5 "Archivo",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 24px 64px rgba(0,0,0,.55);transform:translateY(6px);transition:transform .18s ease}',
    '.vui-overlay.vui-show .vui-modal{transform:none}',
    '.vui-modal h4{margin:0 0 8px;font-size:17px;letter-spacing:.02em}',
    '.vui-modal p{margin:0 0 16px;color:#b9bfc9}',
    '.vui-modal .vui-row{display:flex;gap:10px;justify-content:flex-end}',
    '.vui-btn{appearance:none;border:1px solid #2a2f3a;background:#161a21;color:#eef1f5;border-radius:9px;padding:9px 16px;font:600 13px/1 "Archivo",system-ui,sans-serif;letter-spacing:.02em;cursor:pointer}',
    '.vui-btn:hover{border-color:#3a4150}',
    '.vui-btn.vui-primary{background:#ff0d2e;border-color:#ff0d2e;color:#fff}',
    '.vui-btn.vui-primary:hover{background:#e40b28}',
    '@media (prefers-reduced-motion: reduce){.vui-toast,.vui-overlay,.vui-modal{transition:none;transform:none}}',
    '@media (max-width:640px){#vui-toasts{left:14px;right:14px;bottom:14px;max-width:none}}',
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('vants-ui-styles')) return;
    var st = document.createElement('style');
    st.id = 'vants-ui-styles';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function ensureToasts() {
    var box = document.getElementById('vui-toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'vui-toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      (document.body || document.documentElement).appendChild(box);
    }
    return box;
  }

  var ICONS = { info: '◈', ok: '✔', warn: '!', error: '✕' };

  function toast(msg, opts) {
    try {
      injectCSS();
      opts = opts || {};
      var type = ICONS[opts.type] ? opts.type : 'info';
      var el = document.createElement('div');
      el.className = 'vui-toast vui-' + type;
      var ico = document.createElement('span');
      ico.className = 'vui-ico';
      ico.textContent = ICONS[type];
      var txt = document.createElement('span');
      txt.textContent = String(msg == null ? '' : msg); // textContent: sin HTML inyectado
      el.appendChild(ico); el.appendChild(txt);
      ensureToasts().appendChild(el);
      requestAnimationFrame(function () { el.classList.add('vui-show'); });
      var ms = typeof opts.timeout === 'number' ? opts.timeout : 3200;
      var gone = false;
      function remove() {
        if (gone) return; gone = true;
        el.classList.remove('vui-show');
        setTimeout(function () { try { el.remove(); } catch (e) {} }, REDUCED ? 0 : 240);
      }
      setTimeout(remove, Math.max(800, ms));
      el.addEventListener('click', remove);
      return el;
    } catch (e) { return null; }
  }

  function confirm(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var done = false;
      var overlay, modal;
      function finish(v) {
        if (done) return; done = true;
        try {
          document.removeEventListener('keydown', onKey, true);
          overlay.classList.remove('vui-show');
          setTimeout(function () { try { overlay.remove(); } catch (e) {} }, REDUCED ? 0 : 200);
        } catch (e) {}
        resolve(!!v);
      }
      function onKey(e) { if (e.key === 'Escape') finish(false); }
      try {
        injectCSS();
        overlay = document.createElement('div');
        overlay.className = 'vui-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        modal = document.createElement('div');
        modal.className = 'vui-modal';
        var h = document.createElement('h4');
        h.textContent = String(opts.title || '¿Confirmar?');
        var p = document.createElement('p');
        p.textContent = String(opts.message || '');
        var row = document.createElement('div');
        row.className = 'vui-row';
        var no = document.createElement('button');
        no.className = 'vui-btn';
        no.textContent = String(opts.cancelText || 'Cancelar');
        var yes = document.createElement('button');
        yes.className = 'vui-btn vui-primary';
        yes.textContent = String(opts.okText || 'Confirmar');
        no.addEventListener('click', function () { finish(false); });
        yes.addEventListener('click', function () { finish(true); });
        row.appendChild(no); row.appendChild(yes);
        modal.appendChild(h); modal.appendChild(p); modal.appendChild(row);
        overlay.appendChild(modal);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) finish(false); });
        document.addEventListener('keydown', onKey, true);
        (document.body || document.documentElement).appendChild(overlay);
        requestAnimationFrame(function () { overlay.classList.add('vui-show'); try { yes.focus(); } catch (e) {} });
      } catch (e) { finish(false); }
    });
  }

  function badge(text, tone) {
    try {
      injectCSS();
      var el = document.createElement('span');
      el.className = 'vui-badge' + (tone ? ' vui-' + tone : '');
      el.textContent = String(text == null ? '' : text);
      return el;
    } catch (e) { return null; }
  }

  // --- Red de seguridad de errores (Fase 2: manejo de errores unificado) ---
  // Solo avisa de lo que OTROS módulos no capturaron. Con dedupe para no
  // spamear y mensaje genérico para el usuario (el detalle va a consola).
  var errInstalled = false;
  var lastErrMsg = '';
  var lastErrAt = 0;
  function onEscapee(msg) {
    try {
      var key = String(msg).slice(0, 80);
      var now = Date.now();
      if (key === lastErrMsg && now - lastErrAt < 15000) return;
      lastErrMsg = key; lastErrAt = now;
      toast('Algo salió temporalmente. Recarga si persiste.', { type: 'error', timeout: 4200 });
    } catch (e) {}
  }
  function reportErrors(on) {
    try {
      if (on && !errInstalled) {
        errInstalled = true;
        window.addEventListener('error', function (e) {
          if (e && e.message) { console.warn('[VANTS] error escapado:', e.message); onEscapee(e.message); }
        });
        window.addEventListener('unhandledrejection', function (e) {
          var r = e && e.reason;
          var m = (r && (r.message || String(r))) || 'promesa rechazada';
          console.warn('[VANTS] promesa sin manejar:', m);
          onEscapee(m);
        });
      }
    } catch (e) {}
  }

  window.VANTS_UI = { toast: toast, confirm: confirm, badge: badge, reportErrors: reportErrors, version: '1.1.0' };
  // Activada por defecto: red de seguridad (dedupe 15s, mensaje genérico).
  try { reportErrors(true); } catch (e) {}
})();
