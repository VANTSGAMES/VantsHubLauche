
/* ============================================================
   VANTS SHOP DE IDENTIDAD — v1
   · Catálogo de Tarjetas de Perfil y Marcos de Avatar
   · Inventario (equipar/quitar) con persistencia local
   · Desbloqueo por Plan PRO / CREATOR (motiva la membresía)
   · Feed "RECIÉN INSCRITOS" + hook en la inscripción de equipos
   Compatible con arena.js / arena-live.js (no pisa globals).
   ============================================================ */
(function(){
'use strict';
var qs=function(s){return document.querySelector(s)};
var qsa=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var t=function(msg){try{if(window.toast)window.toast(msg,'ok');else console.log('[shop]',msg)}catch(e){}};
var refreshIcons=function(){try{if(window.lucide)lucide.createIcons()}catch(e){}};

var K_INV='vants_inv_v1',K_FEED='vants_feed_v1',K_PLAN='vants_plan_tienda';
var DEFAULT_CARD='card-origen',DEFAULT_FRAME='frame-ninguno';

/* ================= CATÁLOGO (diseños propios VANTS) ================= */
function vArt(c1,c2,scale,x,y){return '<svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice"><g transform="translate('+(x||286)+','+(y||62)+') scale('+(scale||1.85)+')"><path d="M9 14H23L34.5 44.5L32 52Z" fill="'+c1+'"/><path d="M55 14H41L32.4 37L42.2 37Z" fill="'+c2+'"/></g></svg>'}
var LAUREL='<svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#F5C044" stroke-width="3" opacity=".8"><path d="M52 40 A118 118 0 0 0 52 212"/><path d="M348 40 A118 118 0 0 1 348 212"/></g><g fill="#F5C044" opacity=".9"><circle cx="52" cy="58" r="4"/><circle cx="48" cy="92" r="3.4"/><circle cx="46" cy="126" r="3"/><circle cx="48" cy="160" r="3.4"/><circle cx="52" cy="194" r="4"/><circle cx="348" cy="58" r="4"/><circle cx="352" cy="92" r="3.4"/><circle cx="354" cy="126" r="3"/><circle cx="352" cy="160" r="3.4"/><circle cx="348" cy="194" r="4"/></g></svg>';
var EMBERS='<svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice"><g fill="#ffb35c" opacity=".85"><circle cx="60" cy="190" r="2.4"/><circle cx="120" cy="150" r="1.8"/><circle cx="330" cy="180" r="2.2"/><circle cx="290" cy="120" r="1.6"/><circle cx="200" cy="60" r="1.8"/><circle cx="96" cy="80" r="1.4"/><circle cx="360" cy="70" r="1.6"/></g></svg>';
var SHARDS='<svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="rgba(140,220,255,.5)" stroke-width="2"><path d="M300 34 340 20 330 62 306 54Z"/><path d="M330 120 372 106 358 158 334 148Z"/><path d="M270 176 306 166 296 204 276 196Z"/></g><g fill="rgba(76,201,240,.22)"><path d="M300 34 340 20 330 62 306 54Z"/><path d="M330 120 372 106 358 158 334 148Z"/></g></svg>';
var GLITCHBARS='<svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice"><g opacity=".8"><rect x="0" y="58" width="400" height="7" fill="rgba(180,76,255,.28)"/><rect x="0" y="120" width="400" height="4" fill="rgba(76,201,240,.30)"/><rect x="0" y="178" width="400" height="9" fill="rgba(180,76,255,.18)"/><rect x="46" y="30" width="120" height="4" fill="rgba(255,255,255,.10)"/><rect x="250" y="210" width="110" height="4" fill="rgba(255,255,255,.10)"/></g></svg>';
var STARS='<svg viewBox="0 0 104 104"><g fill="#f8e08e"><path d="M52 0 54.2 6.8 61 7 55.6 11.2 57.6 18 52 13.8 46.4 18 48.4 11.2 43 7 49.8 6.8Z"/><path d="M52 86 54.2 92.8 61 93 55.6 97.2 57.6 104 52 99.8 46.4 104 48.4 97.2 43 93 49.8 92.8Z" transform="translate(0 -0)"/><path d="M0 52 6.8 49.8 7 43 11.2 48.4 18 46.4 13.8 52 18 57.6 11.2 55.6 7 61 6.8 54.2Z"/><path d="M86 52 92.8 49.8 93 43 97.2 48.4 104 46.4 99.8 52 104 57.6 97.2 55.6 93 61 92.8 54.2Z"/></g></svg>';

var ITEMS=[
 {id:'card-origen',tipo:'card',name:'ORIGEN',rar:'COMÚN',rc:'r-c',tier:'FREE',valor:0,useMark:true,cls:'ic-origen',desc:'La placa de acero de casa. El punto de partida de todo jugador VANTS.'},
 {id:'card-ascenso',tipo:'card',name:'ASCENSO',rar:'RARO',rc:'r-r',tier:'PRO',valor:3.99,useMark:true,cls:'ic-ascenso',desc:'Franjas rojas cortando el negro: tu subida se ve desde cualquier bracket.'},
 {id:'card-hielo',tipo:'card',name:'HIELO ETERNO',rar:'RARO',rc:'r-r',tier:'PRO',valor:3.99,useMark:true,art:SHARDS,cls:'ic-hielo',desc:'Cristales afilados para mentales de acero. Frío bajo presión en el clutch.'},
 {id:'card-oro',tipo:'card',name:'ORO MAESTRO',rar:'ÉPICO',rc:'r-e',tier:'PRO',valor:4.99,useMark:true,art:LAUREL,cls:'ic-oro',desc:'Brillo de campeonato con laureles forjados. Para lo más alto del ranking.'},
 {id:'card-neon',tipo:'card',name:'NEÓN VERDE',rar:'RARO',rc:'r-r',tier:'PRO',valor:4.99,useMark:false,art:vArt('#0e1f16','#3EE6A0',1.9,282,58),cls:'ic-neon',desc:'Rejilla de server room a toda luz. Energía pura de scrim nocturna.'},
 {id:'card-glitch',tipo:'card',name:'GLITCH',rar:'ÉPICO',rc:'r-e',tier:'CREATOR',valor:5.99,useMark:false,art:GLITCHBARS+vArt('#d9b3ff','#7fe6ff',1.9,282,58),cls:'ic-glitch',desc:'Señal interferida en RGB puro. Para quienes rompen el feed del rival.'},
 {id:'card-inferno',tipo:'card',name:'INFERNO',rar:'LEGENDARIO',rc:'r-l',tier:'CREATOR',valor:6.99,useMark:false,art:EMBERS+vArt('#ffd9a8','#ff4d00',1.9,282,58),cls:'ic-inferno',desc:'Brasas flotando sobre fuego real. La tarjeta más caliente del catálogo.'},
 {id:'card-corazon',tipo:'card',name:'CORAZÓN VANTS',rar:'LEGENDARIO',rc:'r-l',tier:'CREATOR',valor:7.99,useMark:true,cls:'ic-corazon',desc:'Meta a cuadros, V en acero y rojo, y una promesa: donde nace la ventaja.'},
 {id:'frame-ninguno',tipo:'frame',name:'NINGUNO',rar:'COMÚN',rc:'r-c',tier:'FREE',valor:0,cls:'if-ninguno',desc:'Tu avatar limpio, sin adornos. Clásico de casa.'},
 {id:'frame-arco',tipo:'frame',name:'ARCO ROJO',rar:'RARO',rc:'r-r',tier:'PRO',valor:2.99,cls:'if-arco',desc:'Anillo de acero con arco rojo. Marca registrada de la arena.'},
 {id:'frame-oro',tipo:'frame',name:'ANILLO DE ORO',rar:'ÉPICO',rc:'r-e',tier:'PRO',valor:3.99,cls:'if-oro',desc:'Oro macizo girando lento. Silueta de campeón.'},
 {id:'frame-neon',tipo:'frame',name:'NEÓN PULSANTE',rar:'ÉPICO',rc:'r-e',tier:'CREATOR',valor:4.99,cls:'if-neon',desc:'Latido verde neón que late contigo en cada ronda.'},
 {id:'frame-campeon',tipo:'frame',name:'CAMPEÓN',rar:'LEGENDARIO',rc:'r-l',tier:'CREATOR',valor:5.99,art:STARS,cls:'if-campeon',desc:'Laureles dorados y cuatro estrellas. Solo para vitrinas.'}
];
var ITEM_BY={};ITEMS.forEach(function(i){ITEM_BY[i.id]=i});
var FRAME_CLASSES=ITEMS.filter(function(i){return i.tipo==='frame'}).map(function(i){return i.cls});

/* ================= ESTADO LOCAL ================= */
function invLoad(){try{var s=JSON.parse(localStorage.getItem(K_INV)||'null');if(s&&s.equipped)return s}catch(e){}
 return {equipped:{card:DEFAULT_CARD,frame:DEFAULT_FRAME},extra:[]}}
function invSave(i){try{localStorage.setItem(K_INV,JSON.stringify(i))}catch(e){}}
var INV=invLoad();

function meInfo(){var m=null;try{m=JSON.parse(localStorage.getItem('vants_me')||'null')}catch(e){}
 var badges=(m&&m.badges)||[],plan=(m&&m.plan)||'';
 var owner=badges.indexOf('owner')>=0||badges.indexOf('partner')>=0;
 try{if(typeof window.vantsEsOwner==='function'&&window.vantsEsOwner())owner=true}catch(e){}
 var creator=owner||badges.indexOf('creator')>=0||/creator/i.test(plan);
 var pro=creator||badges.indexOf('pro')>=0||/\bpro\b/i.test(plan);
 var name=(m&&m.name)||'RETADOR';
 var logged=!!(m&&m.name&&m.name!=='RETADOR');
 return {name:name,pro:pro,creator:creator,owner:owner,logged:logged}}
function planShop(){var u=meInfo();if(u.owner||u.creator)return 'creator';if(u.pro)return 'pro';
 var p=null;try{p=localStorage.getItem(K_PLAN)}catch(e){}return p||'free'}
function tierOK(tier){var p=planShop();if(tier==='FREE')return true;if(tier==='PRO')return p==='pro'||p==='creator';return p==='creator'}
function isOwned(it){return it.tier==='FREE'||tierOK(it.tier)||(INV.extra||[]).indexOf(it.id)>=0}
function planDeTier(tier){return tier==='CREATOR'?'creator':'pro'}
function setPlanShop(p){try{var rank={free:0,pro:1,creator:2};var cur=localStorage.getItem(K_PLAN)||'free';
 if((rank[p]||0)>(rank[cur]||0))localStorage.setItem(K_PLAN,p)}catch(e){}}

/* ================= PREVISTAS ================= */
function cardHTML(it,small){var mark=it.useMark?'<svg class="mark ic-mark" viewBox="0 0 64 64" aria-hidden="true"><use href="#vmark"/></svg>':'';
 return '<div class="icard '+it.cls+(small?' small':'')+'" role="img" aria-label="Tarjeta '+esc(it.name)+'">'
  +(it.art?'<span class="ic-art">'+it.art+'</span>':'')
  +mark+'<span class="ic-strip"></span>'
  +(it.cls==='ic-corazon'?'<span class="ic-checkbot"></span>':'')
  +'<span class="ic-name">'+esc(it.name)+'</span><span class="ic-sub">VANTS GAMES · TARJETA DE PERFIL</span></div>'}
function frameHTML(it){return '<div class="aframe '+it.cls+'" role="img" aria-label="Marco '+esc(it.name)+'">'
  +(it.art?'<span class="fr-art">'+it.art+'</span>':'')+'<span>V</span></div>'}
function previewHTML(it){return it.tipo==='card'?cardHTML(it):frameHTML(it)}
function chipTier(it){if(it.tier==='FREE')return '<span class="chip-tier tier-free"><i data-lucide="check"></i>GRATIS</span>';
 return '<span class="chip-tier tier-'+it.tier.toLowerCase()+'"><i data-lucide="'+(it.tier==='PRO'?'zap':'play')+'"></i>PLAN '+it.tier+'</span>'}

/* ================= RENDER · TIENDA (index) ================= */
function tileHTML(it){
 var owned=isOwned(it),equipped=INV.equipped[it.tipo]===it.id;
 var action;
 if(equipped)action='<button class="btn btn-ghost btn-sm" disabled><i data-lucide="badge-check"></i>EQUIPADA</button>';
 else if(owned)action='<button class="btn btn-cut btn-sm" data-eq="'+it.id+'"><i data-lucide="check"></i>EQUIPAR</button>';
 else action='<button class="btn btn-cut btn-sm" data-buy="'+it.id+'"><i data-lucide="lock"></i>DESBLOQUEAR CON '+planDeTier(it.tier).toUpperCase()+'</button>';
 return '<div class="sx-tile'+(owned?' is-owned':'')+'" data-item="'+it.id+'">'
  +'<div class="sx-prev">'+previewHTML(it)+(owned?'':'<span class="lock-note"><i data-lucide="lock"></i>CON PLAN '+it.tier+'</span>')+(equipped?'<span class="equipada-note"><i data-lucide="badge-check"></i>EQUIPADA</span>':'')+'</div>'
  +'<div class="sx-meta"><div class="sx-names"><b>'+esc(it.name)+'</b><span class="chip-rar '+it.rc+'">'+esc(it.rar)+'</span></div>'
  +'<p class="sx-desc">'+esc(it.desc)+'</p>'
  +'<div class="sx-foot">'+chipTier(it)+'<span class="sx-val mono">'+(it.valor?'VALOR $'+it.valor.toFixed(2):'INCLUIDA DE BASE')+'</span></div>'
  +'<div class="sx-actions">'+action+'</div></div></div>'}
function renderShop(){
 var c=qs('#shopxCards'),f=qs('#shopxFrames');
 if(c)c.innerHTML=ITEMS.filter(function(i){return i.tipo==='card'}).map(tileHTML).join('');
 if(f)f.innerHTML=ITEMS.filter(function(i){return i.tipo==='frame'}).map(tileHTML).join('');
 refreshIcons()}
function wireShop(){
 var root=qs('#identidad');if(!root)return;
 root.addEventListener('click',function(e){
  var eq=e.target.closest('[data-eq]'),by=e.target.closest('[data-buy]');
  if(eq){equipar(eq.getAttribute('data-eq'));return}
  if(by){var it=ITEM_BY[by.getAttribute('data-buy')];if(!it)return;
   if(typeof window.openPlanCheckout==='function'){window.openPlanCheckout(planDeTier(it.tier))}
   else{location.hash='#pro'}
  }})}
function equipar(id){var it=ITEM_BY[id];if(!it||!isOwned(it))return;
 INV.equipped[it.tipo]=id;invSave(INV);refreshAll();t('Equipado: '+it.name);refreshIcons()}
function quitar(tipo){INV.equipped[tipo]=tipo==='card'?DEFAULT_CARD:DEFAULT_FRAME;invSave(INV);refreshAll();t(tipo==='card'?'Volviste a la tarjeta ORIGEN':'Marco quitado');refreshIcons()}

/* ================= AVATAR DE CUENTA (nav index) ================= */
function applyFrameToAccount(){var ava=qs('#accAva');if(!ava)return;
 if(ava.dataset.frame)ava.removeAttribute('data-frame');
 var f=ITEM_BY[INV.equipped.frame];
 if(f&&f.id!==DEFAULT_FRAME)ava.setAttribute('data-frame',f.id)}

/* ================= FEED · RECIÉN INSCRITOS ================= */
function feedLoad(){try{var a=JSON.parse(localStorage.getItem(K_FEED)||'null');if(Array.isArray(a))return a}catch(e){}return[]}
function hace(ts){var s=Math.max(0,(Date.now()-ts)/1000);
 if(s<60)return 'hace instantes';if(s<3600)return 'hace '+Math.floor(s/60)+' min';
 if(s<86400)return 'hace '+Math.floor(s/3600)+' h';return 'hace '+Math.floor(s/86400)+' d'}
function pushFeed(team,tag,tourn){var a=feedLoad();
 a.unshift({t:String(team||'EQUIPO').slice(0,26),g:String(tag||'VNTS').slice(0,4),to:String(tourn||'ASCENSIÓN SERIES S4').slice(0,60),ts:Date.now()});
 a=a.slice(0,8);try{localStorage.setItem(K_FEED,JSON.stringify(a))}catch(e){}
 renderFeed()}
function renderFeed(){var el=qs('#rfGrid');if(!el)return;var a=feedLoad();
 if(!a.length){el.innerHTML='<div class="rf-empty"><b>Todavía no hay inscripciones confirmadas.</b><span>Cuando inscribes tu equipo, aparece acá al instante y se anuncia automáticamente en el Discord de la arena.</span><button class="btn btn-cut btn-sm" id="rfJoin" type="button"><i data-lucide="swords"></i>INSCRIBIR MI EQUIPO</button></div>';
  var b=qs('#rfJoin');if(b)b.addEventListener('click',function(){var h=qs('#heroJoin');if(h)h.click()});
  refreshIcons();return}
 el.innerHTML=a.map(function(r){return '<div class="rf-card"><span class="rf-tag">'+esc(r.g)+'</span><div class="rf-info"><b>'+esc(r.t)+'</b><span>'+esc(r.to)+'</span></div><span class="rf-time">'+hace(r.ts)+'</span><i data-lucide="badge-check" class="rf-ok"></i></div>'}).join('');
 refreshIcons()}

/* ================= HOOKS: inscripción y planes ================= */
function wireHooks(){
 if(typeof window.finishEnroll==='function'&&!window.finishEnroll.__shopHook){
  var orig=window.finishEnroll;
  var wrapped=function(tn,team,tag){var r=orig.apply(this,arguments);
   try{pushFeed(team,tag,(tn&&tn.name)||'ASCENSIÓN SERIES S4')}catch(e){}return r};
  wrapped.__shopHook=true;window.finishEnroll=wrapped}
 if(typeof window.activatePlan==='function'&&!window.activatePlan.__shopHook){
  var oap=window.activatePlan;
  var wrapped2=function(p){var antes=ITEMS.filter(function(i){return isOwned(i)}).length;
   var r=oap.apply(this,arguments);
   try{if(p==='pro'||p==='creator')setPlanShop(p)}catch(e){}
   try{var ahora=ITEMS.filter(function(i){return isOwned(i)}).length;
    if(ahora>antes){INV.extra=INV.extra||[];invSave(INV);refreshAll();
     t('+'+(ahora-antes)+' objetos nuevos desbloqueados en tu INVENTARIO')}}catch(e){}
   return r};
  wrapped2.__shopHook=true;window.activatePlan=wrapped2}}

/* ================= PÁGINA INVENTARIO ================= */
var invFilter='all';
function itemRow(it,mode){
 var equipped=INV.equipped[it.tipo]===it.id;
 var actions;
 if(mode==='locked'){actions='<a class="btn btn-ghost btn-sm" href="index.html#identidad"><i data-lucide="crown"></i>VER EN LA TIENDA</a>'}
 else if(equipped)actions='<button class="btn btn-ghost btn-sm" data-un="'+it.tipo+'" type="button"><i data-lucide="x"></i>QUITAR</button>';
 else actions='<button class="btn btn-cut btn-sm" data-eq="'+it.id+'" type="button"><i data-lucide="check"></i>EQUIPAR</button>';
 return '<div class="inv-item'+(equipped?' is-equipped':'')+(mode==='locked'?' locked':'')+'" data-tipo="'+it.tipo+'">'
  +'<div class="inv-prev">'+previewHTML(it)+(mode==='locked'?'<span class="lock-note"><i data-lucide="lock"></i>PLAN '+it.tier+'</span>':'')+(equipped?'<span class="equipada-note"><i data-lucide="badge-check"></i>EQUIPADA</span>':'')+'</div>'
  +'<div class="inv-meta"><div class="row1"><b>'+esc(it.name)+'</b><span class="chip-rar '+it.rc+'">'+esc(it.rar)+'</span></div>'
  +'<p class="desc">'+esc(it.desc)+'</p><div class="sx-actions">'+actions+'</div></div></div>'}
function renderInvPage(){
 var u=meInfo(),ps=planShop();
 var chip=qs('#invUser');if(chip){chip.innerHTML='<span class="ava" id="invAva">'+esc(u.name.slice(0,2).toUpperCase())+'</span><div><b>'+esc(u.name)+'</b><span>'+(ps==='creator'?'PLAN CREATOR':ps==='pro'?'PLAN PRO':'PLAN FREE')+' · INVENTARIO</span></div>';
  var ava=qs('#invAva');var f=ITEM_BY[INV.equipped.frame];if(ava&&f&&f.id!==DEFAULT_FRAME)ava.setAttribute('data-frame',f.id)}
 var ban=qs('#invBanner');
 if(ban){ban.style.display=u.logged?'none':'flex'}
 var slots=qs('#invSlots');
 if(slots){var c=ITEM_BY[INV.equipped.card],fr=ITEM_BY[INV.equipped.frame];
  slots.innerHTML=
   '<div class="slot-card">'+cardHTML(c,true)+'<span class="slot-kind">TARJETA DE PERFIL · EQUIPADA</span><b class="slot-name">'+esc(c.name)+'</b><div class="sx-foot"><span class="chip-rar '+c.rc+'">'+esc(c.rar)+'</span>'+chipTier(c)+'</div><div class="slot-actions"><button class="btn btn-ghost btn-sm" data-un="card" type="button"><i data-lucide="rotate-ccw"></i>VOLVER A ORIGEN</button><a class="btn btn-ghost btn-sm" href="index.html#identidad"><i data-lucide="store"></i>MÁS TARJETAS</a></div></div>'
  +'<div class="slot-card"><div style="display:grid;place-items:center;background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:20px">'+frameHTML(fr)+'</div><span class="slot-kind">MARCO DE AVATAR · EQUIPADO</span><b class="slot-name">'+esc(fr.name)+'</b><div class="sx-foot"><span class="chip-rar '+fr.rc+'">'+esc(fr.rar)+'</span>'+chipTier(fr)+'</div><div class="slot-actions"><button class="btn btn-ghost btn-sm" data-un="frame" type="button"><i data-lucide="rotate-ccw"></i>SIN MARCO</button><a class="btn btn-ghost btn-sm" href="index.html#identidad"><i data-lucide="store"></i>MÁS MARCOS</a></div></div>'}
 var owned=ITEMS.filter(function(i){return isOwned(i)&&(invFilter==='all'||i.tipo===invFilter)});
 var locked=ITEMS.filter(function(i){return !isOwned(i)&&(invFilter==='all'||i.tipo===invFilter)});
 var go=qs('#invOwned'),lo=qs('#invLocked'),gosec=qs('#secOwned'),losec=qs('#secLocked');
 if(go)go.innerHTML=owned.map(function(i){return itemRow(i,'owned')}).join('')||'<p class="desc" style="font:500 11px/1.7 var(--mono);color:var(--dim)">Nada acá con este filtro.</p>';
 if(lo)lo.innerHTML=locked.map(function(i){return itemRow(i,'locked')}).join('');
 if(gosec)gosec.style.display=owned.length?'':'none';
 if(losec)losec.style.display=locked.length?'':'none';
 var cnt=qs('#invCount');if(cnt)cnt.textContent=owned.length+' OBJETOS · '+locked.length+' BLOQUEADOS';
 refreshIcons()}
function wireInvPage(){
 qsa('.inv-tabs button').forEach(function(b){b.addEventListener('click',function(){
  invFilter=b.getAttribute('data-f');
  qsa('.inv-tabs button').forEach(function(x){x.classList.toggle('on',x===b)});
  renderInvPage()})});
 var root=qs('#invRoot')||document;
 root.addEventListener('click',function(e){
  var eq=e.target.closest('[data-eq]'),un=e.target.closest('[data-un]');
  if(eq)equipar(eq.getAttribute('data-eq'));
  if(un)quitar(un.getAttribute('data-un'))})}

/* ================= REFRESCO GENERAL ================= */
function refreshAll(){
 if(qs('#shopxCards')||qs('#shopxFrames'))renderShop();
 if(qs('#invSlots'))renderInvPage();
 renderFeed();applyFrameToAccount();refreshIcons()}

/* ================= ARRANQUE ================= */
function boot(){
 var isInv=(document.body&&document.body.getAttribute('data-page')==='inventario');
 if(isInv)wireInvPage();else wireShop();
 wireHooks();refreshAll();
 /* la inscripción puede llegar antes del hook: re-render diferido */
 setTimeout(function(){renderFeed();refreshIcons()},1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();

/* API pública mínima (debug / integración futura) */
window.VANTS_SHOP={ITEMS:ITEMS,equipar:equipar,quitar:quitar,refresh:refreshAll,tierOK:tierOK};
})();
