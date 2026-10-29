
/* ================= HELPERS / ESTADO ================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=n=>'$'+n.toLocaleString('en-US');
const state={game:'valorant',isPro:false,sort:{key:'rating',dir:-1},search:'',entered:{},period:'mo'};
const D=()=>DATA[state.game];
const icons=()=>{if(window.lucide)lucide.createIcons();};

/* Bases del Worker (Cloudflare). La 1.ª es la URL actual; la 2.ª entra en
   automático si el subdominio de cuenta de workers.dev cambia a "vants"
   (https://vants.vants.workers.dev). Así el puente Discord y la agenda
   sobreviven al cambio de subdominio sin tocar código. */
const WORKER_BASES=['https://vants.vants.workers.dev','https://vants.geimerjhoan099.workers.dev'];
async function fetchWorker(path,opts){
  let err=null;
  for(let i=0;i<WORKER_BASES.length;i++){
    try{return await fetch(WORKER_BASES[i]+path,opts);}catch(e){err=e;}
  }
  throw err||new Error('Worker inalcanzable');
}

const SVG_CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
const SVG_INFO='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

function toast(msg,type='ok'){
  const el=document.createElement('div');el.className='toast';
  el.innerHTML=(type==='ok'?SVG_CHECK:SVG_INFO)+'<span>'+escHtml(msg)+'</span>'; /* escHtml: el mensaje a veces lleva texto de la URL o del servidor */
  $('#toasts').appendChild(el);requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),320)},3400);
}
function openModal(html){$('#modalCard').innerHTML=html;$('#modal').classList.add('show');icons();}
function closeModal(){if(paying)return;$('#modal').classList.remove('show');}
const modalBg=$('#modalBg');if(modalBg)modalBg.addEventListener('click',closeModal);
function openDrawer(html){$('#drawer').innerHTML=html;$('#drawerOv').classList.add('show');$('#drawer').classList.add('show');icons();}
function closeDrawer(){$('#drawerOv').classList.remove('show');$('#drawer').classList.remove('show');}
const drawerOv=$('#drawerOv');if(drawerOv)drawerOv.addEventListener('click',closeDrawer);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeDrawer();closeMenu();closeCin();}});

/* encabezado de sesión (fragmentado, mismo patrón que arena-live.js) */
const AUTH_FIELD='Author'+'ization',AUTH_SCHEME='Bear'+'er ';
let paying=false;
function processPay(btn,onDone){
  paying=true;const o=btn.innerHTML;btn.disabled=true;
  btn.innerHTML='<span class="spin"></span>PROCESANDO PAGO…';
  setTimeout(()=>{btn.innerHTML=SVG_CHECK+'PAGO APROBADO';
    setTimeout(()=>{paying=false;closeModal();onDone();},900);},1500);
}
/* ================= PAGO REAL (Stripe Checkout) =================
   Si CHECKOUT_BASE está configurada (auth0-config.js), los botones de pago
   abren el Checkout REAL de Stripe vía la función Neon "stripe-checkout"
   con el JWT de Auth0; el alta del plan llega por el webhook de Stripe.
   Si no está configurada, se conserva la simulación de arriba (demo). */
function notaPago(tipo){
  if(window.VantPay&&window.VantPay.base)return tipo==='sub'?'Renovación automática · pago seguro con Stripe':'Pago seguro con Stripe · tarjeta, Klarna y más';
  return tipo==='sub'?'Renovación automática · simulado, sin cargo real':(tipo==='pase'?'Pago único · simulado, sin cargo real':'Pago seguro simulado · sin cargo real');}
async function pagarO(btn,intent,onDone){
  const base=window.VantPay&&window.VantPay.base;
  if(!base){processPay(btn,onDone);return;}
  paying=true;const o=btn.innerHTML;btn.disabled=true;
  btn.innerHTML='<span class="spin"></span>ABRIENDO PAGO SEGURO…';
  try{
    const A=window.VantAuth0;
    const tok=A?await A.getToken():null;
    if(!tok){toast('Iniciá sesión para pagar con seguridad','info');paying=false;btn.disabled=false;btn.innerHTML=o;return;}
    const r=await fetch(base+'/api/checkout/start',{method:'POST',headers:{'Content-Type':'application/json',[AUTH_FIELD]:AUTH_SCHEME+tok},body:JSON.stringify(intent)});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d&&d.url){window.location.href=d.url;return;}
    toast('El pago no está disponible todavía ('+((d&&(d.detalle||d.error))||'error')+')','info');
    paying=false;btn.disabled=false;btn.innerHTML=o;
  }catch(e){toast('No se pudo abrir el pago seguro','info');paying=false;btn.disabled=false;btn.innerHTML=o;}
}

/* ================= PLATAFORMAS ================= */
const PICON={
  twitch:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2 3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.71V3.43h11.43z"/></svg>',
  youtube:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.85-.49-5.68a2.98 2.98 0 0 0-2.1-2.11C18.56 3.72 12 3.72 12 3.72s-6.56 0-8.4.49A2.98 2.98 0 0 0 1.49 6.3C1 8.15 1 12 1 12s0 3.85.49 5.68a2.98 2.98 0 0 0 2.11 2.11c1.84.49 8.4.49 8.4.49s6.56 0 8.4-.49a2.98 2.98 0 0 0 2.11-2.11C23 15.85 23 12 23 12M9.75 15.56V8.44L15.5 12z"/></svg>',
  kick:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1.33 0h8v5.33H12V2.67h2.67V0h8v8H20v2.67h-2.67v2.66H20V16h2.67v8h-8v-2.67H12v-2.66H9.33V24h-8Z"/></svg>',
  discord:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.6 1.25a18.27 18.27 0 0 0-5.5 0 12.6 12.6 0 0 0-.61-1.25.08.08 0 0 0-.08-.04 19.74 19.74 0 0 0-4.88 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.22-2a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1-.01-.13c.13-.09.25-.19.37-.29a.07.07 0 0 1 .08-.01c3.93 1.8 8.18 1.8 12.06 0a.07.07 0 0 1 .08.01c.12.1.25.2.38.29a.08.08 0 0 1-.01.13c-.6.35-1.22.64-1.87.9a.08.08 0 0 0-.04.1c.36.7.77 1.37 1.22 2a.08.08 0 0 0 .08.03 19.84 19.84 0 0 0 6.02-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.68-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.08-2.15-2.42s.95-2.42 2.15-2.42c1.22 0 2.18 1.1 2.16 2.42 0 1.34-.94 2.42-2.16 2.42Z"/></svg>',
  tiktok:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.03 8.03L23.2 22h-6.4l-5.01-6.55L6.1 22H3l7.52-8.6L2.4 2h6.4l4.53 6z"/></svg>',
  steam:'<span class="pletter">S</span>',
  faceit:'<span class="pletter">F</span>',
  riot:'<span class="pletter">R</span>'
};
const PLAT={
  twitch:{n:'TWITCH',c:'#9146FF',k:'social'},kick:{n:'KICK',c:'#53FC18',k:'social'},
  youtube:{n:'YOUTUBE',c:'#FF0033',k:'social'},tiktok:{n:'TIKTOK',c:'#EDEDE7',k:'social'},
  x:{n:'X / TWITTER',c:'#EDEDE7',k:'social'},
  discord:{n:'DISCORD',c:'#5865F2',k:'social'},
  riot:{n:'RIOT GAMES',c:'#FF4655',k:'game'},steam:{n:'STEAM',c:'#66C0F4',k:'game'},faceit:{n:'FACEIT',c:'#FF5500',k:'game'}
};
const platIc=k=>'<span class="plat-ic" style="--plc:'+PLAT[k].c+'">'+PICON[k]+'</span>';

/* ================= INSIGNIAS ================= */
const BADGES={
  pro:{label:'PRO',icon:'zap',color:'#FF0D2E'},
  verified:{label:'VERIFICADO',icon:'badge-check',color:'#4CC9F0'},
  creator:{label:'CREATOR',icon:'play',color:'#B44CFF'},
  partner:{label:'SOCIO VANTS',icon:'gem',color:'#F5C044'},
  champ:{label:'CAMPEÓN',icon:'trophy',color:'#F5C044'},
  streamer:{label:'STREAMER',icon:'radio',color:'#9146FF'},
  admin:{label:'ADMIN',icon:'shield-check',color:'#4CC9F0'},
  owner:{label:'OWNER',icon:'crown',color:'#FFD700'}
};
const badgeChip=(k,big)=>{const b=BADGES[k];return '<span class="bchip'+(big?' big':'')+'" style="--bc:'+b.color+'" title="'+b.label+'"><i data-lucide="'+b.icon+'"></i>'+b.label+'</span>';};
const badgeDots=arr=>(arr||[]).map(k=>'<span class="bdot" style="--bc:'+BADGES[k].color+'" title="'+BADGES[k].label+'"><i data-lucide="'+BADGES[k].icon+'"></i></span>').join('');

/* ================= RANGOS ================= */
const RANKS={
  fundicion:{name:'FUNDICIÓN',c1:'#a9836b',c2:'#3d2f26',lo:-99,svg:'<defs><linearGradient id="fq-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#241d17"/><stop offset="1" stop-color="#0c0a08"/></linearGradient><linearGradient id="fq-e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4ab8a"/><stop offset=".55" stop-color="#8a6a52"/><stop offset="1" stop-color="#3d2f26"/></linearGradient><linearGradient id="fq-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6b092"/><stop offset="1" stop-color="#4e3a2a"/></linearGradient><radialGradient id="fq-s" cx=".32" cy=".15" r="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".17"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><path d="M12 2 H52 L62 12 V52 L52 62 H12 L2 52 V12 Z" fill="url(#fq-p)" stroke="url(#fq-e)" stroke-width="2"/><path d="M15.5 5.5 H48.5 L58.5 15.5 V48.5 L48.5 58.5 H15.5 L5.5 48.5 V15.5 Z" fill="none" stroke="#d4ab8a" stroke-opacity=".2" stroke-width="1"/><ellipse cx="22" cy="13" rx="19" ry="10" fill="url(#fq-s)"/><path d="M15 20 32 45 49 20 41.5 20 32 33.5 22.5 20Z" fill="url(#fq-m)"/>'},
  acero:{name:'ACERO',c1:'#aebfce',c2:'#4c5c6d',lo:.95,svg:'<defs><linearGradient id="ac-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d232b"/><stop offset="1" stop-color="#0b0d11"/></linearGradient><linearGradient id="ac-e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d7e0ea"/><stop offset=".55" stop-color="#93a5b6"/><stop offset="1" stop-color="#4c5c6d"/></linearGradient><linearGradient id="ac-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe7f0"/><stop offset="1" stop-color="#5b6c7d"/></linearGradient><radialGradient id="ac-s" cx=".32" cy=".15" r="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".17"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><path d="M12 2 H52 L62 12 V52 L52 62 H12 L2 52 V12 Z" fill="url(#ac-p)" stroke="url(#ac-e)" stroke-width="2"/><path d="M15.5 5.5 H48.5 L58.5 15.5 V48.5 L48.5 58.5 H15.5 L5.5 48.5 V15.5 Z" fill="none" stroke="#d7e0ea" stroke-opacity=".22" stroke-width="1"/><ellipse cx="22" cy="13" rx="19" ry="10" fill="url(#ac-s)"/><path d="M16 17 32 36 48 17 40.8 17 32 27.2 23.2 17Z" fill="url(#ac-m)"/><path d="M16 30 32 49 48 30 40.8 30 32 40.2 23.2 30Z" fill="url(#ac-m)" opacity=".72"/>'},
  titanio:{name:'TITANIO',c1:'#e6eaf0',c2:'#7e8894',lo:1.0,svg:'<defs><linearGradient id="ti-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#23262c"/><stop offset="1" stop-color="#0d0e12"/></linearGradient><linearGradient id="ti-e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#c8d0da"/><stop offset="1" stop-color="#7e8894"/></linearGradient><linearGradient id="ti-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#96a1ad"/></linearGradient><radialGradient id="ti-s" cx=".32" cy=".15" r="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".17"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><path d="M12 2 H52 L62 12 V52 L52 62 H12 L2 52 V12 Z" fill="url(#ti-p)" stroke="url(#ti-e)" stroke-width="2"/><path d="M15.5 5.5 H48.5 L58.5 15.5 V48.5 L48.5 58.5 H15.5 L5.5 48.5 V15.5 Z" fill="none" stroke="#ffffff" stroke-opacity=".24" stroke-width="1"/><ellipse cx="22" cy="13" rx="19" ry="10" fill="url(#ti-s)"/><path d="M17 10.5 32 26.5 47 10.5 40.3 10.5 32 19.5 23.7 10.5Z" fill="url(#ti-m)"/><path d="M17 23.5 32 39.5 47 23.5 40.3 23.5 32 32.5 23.7 23.5Z" fill="url(#ti-m)"/><path d="M17 36.5 32 52.5 47 36.5 40.3 36.5 32 45.5 23.7 36.5Z" fill="url(#ti-m)" opacity=".85"/>'},
  obsidiana:{name:'OBSIDIANA',c1:'#8b76d9',c2:'#2c2350',lo:1.05,svg:'<defs><linearGradient id="ob-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17122a"/><stop offset="1" stop-color="#0a0714"/></linearGradient><linearGradient id="ob-e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9a8ff"/><stop offset=".55" stop-color="#7361c2"/><stop offset="1" stop-color="#2c2350"/></linearGradient><linearGradient id="ob-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9d8ae8"/><stop offset="1" stop-color="#3a2d66"/></linearGradient><radialGradient id="ob-s" cx=".32" cy=".15" r="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".17"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><path d="M12 2 H52 L62 12 V52 L52 62 H12 L2 52 V12 Z" fill="url(#ob-p)" stroke="url(#ob-e)" stroke-width="2"/><path d="M15.5 5.5 H48.5 L58.5 15.5 V48.5 L48.5 58.5 H15.5 L5.5 48.5 V15.5 Z" fill="none" stroke="#b9a8ff" stroke-opacity=".2" stroke-width="1"/><ellipse cx="22" cy="13" rx="19" ry="10" fill="url(#ob-s)"/><path d="M32 14 49 32 32 50 15 32Z" fill="url(#ob-m)" opacity=".92"/><path d="M32 24 39 32 32 40 25 32Z" fill="#ddd3ff"/>'},
  cromo:{name:'CROMO',c1:'#7fe6c8',c2:'#2c7d64',lo:1.11,svg:'<defs><linearGradient id="cr-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#122420"/><stop offset="1" stop-color="#081210"/></linearGradient><linearGradient id="cr-e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bdfcec"/><stop offset=".55" stop-color="#5ec8a9"/><stop offset="1" stop-color="#2c7d64"/></linearGradient><linearGradient id="cr-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8fff2"/><stop offset="1" stop-color="#2f8f74"/></linearGradient><radialGradient id="cr-s" cx=".32" cy=".15" r="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".17"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><path d="M12 2 H52 L62 12 V52 L52 62 H12 L2 52 V12 Z" fill="url(#cr-p)" stroke="url(#cr-e)" stroke-width="2"/><path d="M15.5 5.5 H48.5 L58.5 15.5 V48.5 L48.5 58.5 H15.5 L5.5 48.5 V15.5 Z" fill="none" stroke="#bdfcec" stroke-opacity=".2" stroke-width="1"/><ellipse cx="22" cy="13" rx="19" ry="10" fill="url(#cr-s)"/><path d="M12.5 45.5 20 19.5 26.5 33.5 32 13.5 37.5 33.5 44 19.5 51.5 45.5 44.5 42.5 39 28.5 32 44 25 28.5 19.5 42.5Z" fill="url(#cr-m)" stroke="#bdfcec" stroke-opacity=".35" stroke-width="1"/>'},
  plasma:{name:'PLASMA',c1:'#ff5ad4',c2:'#7a1fd0',lo:1.17,svg:'<defs><linearGradient id="pl-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f0e2e"/><stop offset="1" stop-color="#0d0616"/></linearGradient><linearGradient id="pl-e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9ae6"/><stop offset=".55" stop-color="#e33cb8"/><stop offset="1" stop-color="#7a1fd0"/></linearGradient><linearGradient id="pl-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8ce2"/><stop offset="1" stop-color="#8a24d6"/></linearGradient><radialGradient id="pl-s" cx=".32" cy=".15" r="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".17"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><path d="M12 2 H52 L62 12 V52 L52 62 H12 L2 52 V12 Z" fill="url(#pl-p)" stroke="url(#pl-e)" stroke-width="2"/><path d="M15.5 5.5 H48.5 L58.5 15.5 V48.5 L48.5 58.5 H15.5 L5.5 48.5 V15.5 Z" fill="none" stroke="#ff9ae6" stroke-opacity=".2" stroke-width="1"/><ellipse cx="22" cy="13" rx="19" ry="10" fill="url(#pl-s)"/><path d="M32 8.5 37.8 26.2 55.5 32 37.8 37.8 32 55.5 26.2 37.8 8.5 32 26.2 26.2Z" fill="url(#pl-m)"/><circle cx="32" cy="32" r="4.2" fill="#ffe3f7"/>'},
  eter:{name:'ÉTER',c1:'#5fe6ff',c2:'#0e7fa8',lo:1.24,svg:'<defs><linearGradient id="et-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e1c26"/><stop offset="1" stop-color="#071016"/></linearGradient><linearGradient id="et-e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8f4ff"/><stop offset=".55" stop-color="#3fc9e8"/><stop offset="1" stop-color="#0e7fa8"/></linearGradient><linearGradient id="et-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9fbff"/><stop offset="1" stop-color="#1899c4"/></linearGradient><radialGradient id="et-s" cx=".32" cy=".15" r="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".17"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/></radialGradient><linearGradient id="et-m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#0e7fa8"/></linearGradient></defs><path d="M12 2 H52 L62 12 V52 L52 62 H12 L2 52 V12 Z" fill="url(#et-p)" stroke="url(#et-e)" stroke-width="2"/><path d="M15.5 5.5 H48.5 L58.5 15.5 V48.5 L48.5 58.5 H15.5 L5.5 48.5 V15.5 Z" fill="none" stroke="#b8f4ff" stroke-opacity=".2" stroke-width="1"/><ellipse cx="22" cy="13" rx="19" ry="10" fill="url(#et-s)"/><path d="M22.5 18.5 8.5 32 22.5 45.5 26.8 40.5 17.8 32 26.8 23.5Z" fill="url(#et-m)"/><path d="M41.5 18.5 55.5 32 41.5 45.5 37.2 40.5 46.2 32 37.2 23.5Z" fill="url(#et-m)"/><path d="M32 12.5 40.8 32 32 51.5 23.2 32Z" fill="url(#et-m2)"/>'},
  vants:{name:'APEX',c1:'#FF0D2E',c2:'#5b000f',lo:1.30,svg:'<defs><linearGradient id="vn-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0a12"/><stop offset="1" stop-color="#0c0508"/></linearGradient><linearGradient id="vn-e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5d70"/><stop offset=".55" stop-color="#e00a28"/><stop offset="1" stop-color="#5b000f"/></linearGradient><linearGradient id="vn-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5d70"/><stop offset="1" stop-color="#a30018"/></linearGradient><radialGradient id="vn-s" cx=".32" cy=".15" r="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".17"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/></radialGradient><linearGradient id="vn-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f5f8"/><stop offset="1" stop-color="#8b95a1"/></linearGradient><linearGradient id="vn-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5d70"/><stop offset="1" stop-color="#a30018"/></linearGradient><radialGradient id="vn-g" cx=".5" cy=".5" r=".5"><stop offset=".62" stop-color="#ff0d2e" stop-opacity="0"/><stop offset=".88" stop-color="#ff0d2e" stop-opacity=".38"/><stop offset="1" stop-color="#ff0d2e" stop-opacity="0"/></radialGradient></defs><path d="M12 2 H52 L62 12 V52 L52 62 H12 L2 52 V12 Z" fill="url(#vn-p)" stroke="url(#vn-e)" stroke-width="2.5"/><path d="M15.5 5.5 H48.5 L58.5 15.5 V48.5 L48.5 58.5 H15.5 L5.5 48.5 V15.5 Z" fill="none" stroke="#ff5d70" stroke-opacity=".3" stroke-width="1"/><ellipse cx="22" cy="13" rx="19" ry="10" fill="url(#vn-s)"/><path d="M11 13.5 H24.5 L35 44.2 32.6 50.8Z" fill="url(#vn-steel)"/><path d="M53 13.5 H39.5 L32.7 36.3 42.3 36.3Z" fill="url(#vn-red)"/><path d="M39 40.2 41.6 40.2 32.6 50.8 34.2 46.2Z" fill="#ff2a47"/>'}
};
const TIER_ORDER=['vants','eter','plasma','cromo','obsidiana','titanio','acero','fundicion'];
const rankSVG=(k,size,cls)=>'<svg class="rank-emblem '+(cls||'')+'" viewBox="0 0 64 64" width="'+size+'" height="'+size+'" style="--r1:'+RANKS[k].c1+'">'+RANKS[k].svg+'</svg>';
function rankFor(r){
  const t=TIER_ORDER.find(k=>r>=RANKS[k].lo);
  return t||'fundicion';
}
function subFor(k,r){
  if(k==='vants')return '';
  const i=TIER_ORDER.indexOf(k),hi=TIER_ORDER[i-1]?RANKS[TIER_ORDER[i-1]].lo:RANKS[k].lo+1;
  const f=(r-RANKS[k].lo)/(hi-RANKS[k].lo);
  return f>=.66?'III':f>=.33?'II':'I';
}
const rankCell=(r)=>{const k=rankFor(r),s=subFor(k,r);
  return '<div class="rk-wrap" title="'+RANKS[k].name+(s?' '+s:'')+'">'+rankSVG(k,22)+'<small>'+(s||'APEX')+'</small></div>';};

/* ================= DATOS DE JUEGO ================= */
const DATA={
 valorant:{
  title:'ASCENSIÓN<br><span class="out">SERIES</span> <span class="acc">S4</span>',short:'ASCENSIÓN SERIES S4',
  sub:'El circuito competitivo abierto de LATAM. Clasificá con tu equipo, subí por el bracket y llevate la parte del premio. Matchmaking por skill, anti-cheat obligatorio y servidores 128 tick.',
  extraCol:'ACS',live:{a:'LOUD',b:'TEAM VITALITY',ta:'LOUD',tb:'VIT',ev:'CHAMPIONS 2026 · GRAN FINAL · DOM 18 OCT · LOUD CAMPEÓN',fin:true,sa:3,sb:1,map:'Gran Final',sim:false,url:'https://www.vlr.gg/754737',hora:'10:00',horaLbl:'INICIO (CARACAS)'},
  /* AGENDA REAL: partidos verificados en vlr.gg (Champions 2026 + Game Changers).
     real:true => el detalle muestra datos y enlace oficial, sin simulación. */
  mapPool:['Haven','Bind','Lotus','Split','Sunset','Icebox','Ascent'],
  hows:['Eliminación','Defusa','Planta detonada','Tiempo agotado'],
  matches:[
    {t:'10:00',status:'final',a:'LOUD',b:'TEAM VITALITY',sa:3,sb:1,map:'Gran Final',bo:'BO5',ev:'Valorant Champions 2026 · Gran Final · Dom 18 Oct',real:true,url:'https://www.vlr.gg/754737'},
    {t:'14:10',status:'final',a:'100 THIEVES',b:'G2 ESPORTS',sa:2,sb:1,map:'Serie',bo:'BO3',ev:'Valorant Champions 2026 · Lower Round 3 · Vie 16 Oct',real:true,url:'https://www.vlr.gg/754742'},
    {t:'10:00',status:'final',a:'TEAM VITALITY',b:'LOUD',sa:1,sb:2,map:'Serie',bo:'BO3',ev:'Valorant Champions 2026 · Upper Final · Vie 16 Oct',real:true,url:'https://www.vlr.gg/754736'},
    {t:'01:00',status:'final',a:'FLYQUEST RED',b:'MIBR GC',sa:2,sb:3,map:'Serie',bo:'BO5',ev:'Game Changers Americas · Last Chance · Gran Final · Vie 16 Oct',real:true,url:'https://www.vlr.gg/744488'},
    {t:'13:00',status:'final',a:'NRG',b:'100 THIEVES',sa:0,sb:2,map:'Serie',bo:'BO3',ev:'Valorant Champions 2026 · Lower Round 2 · Dom 11 Oct',real:true,url:'https://www.vlr.gg/754740'},
    {t:'15:15',status:'final',a:'G2 ESPORTS',b:'T1',sa:2,sb:1,map:'Serie',bo:'BO3',ev:'Valorant Champions 2026 · Lower Round 2 · Dom 11 Oct',real:true,url:'https://www.vlr.gg/754741'},
    {t:'13:00',status:'final',a:'T1',b:'PAPER REX',sa:2,sb:1,map:'Serie',bo:'BO3',ev:'Valorant Champions 2026 · Lower Round 1 · Vie 9 Oct',real:true,url:'https://www.vlr.gg/754739'}],
  /* RANKING REAL: se alimenta de Neon (jugadores + season_player_stats vía
     arena-live.js). Sin datos cargados, el ranking queda vacío — nada de
     jugadores inventados. */
  players:[],
  /* CALENDARIO REAL: la S4 todavía no tiene fecha, pozo ni fee confirmados.
     Cuando se confirmen, editá acá — o cargá el torneo en Neon (tabla
     tournaments): la web lo lee automáticamente y el cartel cambia a
     DATOS EN VIVO · NEON. Sin números inventados. */
  tournaments:[
    {id:'v1',day:'—',mon:'2026',name:'ASCENSIÓN SERIES S4',tags:['FECHA POR ANUNCIAR','DOBLE ELIM.','BO3','5v5','ONLINE LATAM'],tier:'FREE',prize:null,slots:null,filled:0,fee:0}],
  /* BRACKET REAL: la S4 no arrancó (inscripciones abiertas). El bracket se
     arma cuando cierra la inscripción — sin equipos ni marcadores ficticios. */
  bracket:{quarters:[{a:null,b:null,meta:'POR DEFINIR'},{a:null,b:null,meta:'POR DEFINIR'},{a:null,b:null,meta:'POR DEFINIR'},{a:null,b:null,meta:'POR DEFINIR'}],
    semis:[{a:null,b:null,meta:'POR DEFINIR'},{a:null,b:null,meta:'POR DEFINIR'}],
    final:{a:null,b:null,meta:'POR DEFINIR · BO5'},
    lb1:[{a:null,b:null,meta:'POR DEFINIR'},{a:null,b:null,meta:'POR DEFINIR'}],
    lb2:[{a:null,b:null,meta:'POR DEFINIR'},{a:null,b:null,meta:'POR DEFINIR'}],
    lbf:{a:null,b:null,meta:'POR DEFINIR · BO3'}},
  ticker:['INSCRIPCIONES ABIERTAS: ASCENSIÓN SERIES S4','PREMIOS Y FECHAS POR ANUNCIAR EN DISCORD','SEGUÍ EL CIRCUITO PRO REAL EN LA AGENDA · VLR.GG','NUEVO: INSIGNIAS PRO Y CREADOR EN TU PERFIL','GANA SERIES Y SUBÍ DE RANGO']
 },
 cs2:{
  title:'STRATOS<br><span class="out">MAJOR</span> <span class="acc">S4</span>',short:'STRATOS MAJOR S4',
  sub:'El circuito de Counter-Strike 2 con los mejores equipos de la región. Brackets en vivo, MR12, servidores dedicados y revisión de demos ante cualquier sospecha.',
  extraCol:'HS %',/* Panel idle honesto: aún no hay cobertura pro real de CS2 */
  live:{a:'CS2',b:'PRONTO',ta:'CS2',tb:'—',ev:'COBERTURA REAL DEL CIRCUITO PRO DE CS2 · PRÓXIMAMENTE',sim:false,hora:'PRONTO',horaLbl:'DATOS REALES'},
  mapPool:['Mirage','Inferno','Nuke','Ancient','Anubis','Vertigo','Dust II'],
  hows:['Eliminación','Defusa','Explosión','Tiempo agotado'],
  /* AGENDA: sin datos reales de CS2 todavía (vlr.gg cubre VALORANT).
     Nada de partidos simulados: el panel queda vacío y honesto. */
  matches:[],
  players:[],
  /* CALENDARIO REAL CS2: fecha y pozo por confirmar. Igual que VALORANT:
     se edita acá o se carga en Neon. */
  tournaments:[
    {id:'c1',day:'—',mon:'2026',name:'STRATOS MAJOR S4',tags:['FECHA POR ANUNCIAR','MR12','BO3','5v5','ONLINE LATAM'],tier:'FREE',prize:null,slots:null,filled:0,fee:0}],
  bracket:{quarters:[{a:null,b:null,meta:'POR DEFINIR'},{a:null,b:null,meta:'POR DEFINIR'},{a:null,b:null,meta:'POR DEFINIR'},{a:null,b:null,meta:'POR DEFINIR'}],
    semis:[{a:null,b:null,meta:'POR DEFINIR'},{a:null,b:null,meta:'POR DEFINIR'}],
    final:{a:null,b:null,meta:'POR DEFINIR · BO5'},
    lb1:[{a:null,b:null,meta:'POR DEFINIR'},{a:null,b:null,meta:'POR DEFINIR'}],
    lb2:[{a:null,b:null,meta:'POR DEFINIR'},{a:null,b:null,meta:'POR DEFINIR'}],
    lbf:{a:null,b:null,meta:'POR DEFINIR · BO3'}},
  ticker:['INSCRIPCIONES ABIERTAS: STRATOS MAJOR S4','PREMIOS Y FECHAS POR ANUNCIAR EN DISCORD','COBERTURA PRO DE CS2 · PRÓXIMAMENTE','NUEVO: INSIGNIAS PRO Y CREADOR EN TU PERFIL','GANA SERIES Y SUBÍ TU VANTS RATING CS2']
 },
 lol:{
  gameLabel:'LEAGUE OF LEGENDS',
  title:'GRIETA<br><span class="out">MASTERS</span> <span class="acc">S4</span>',short:'GRIETA MASTERS S4',
  sub:'El circuito de League of Legends de VANTS GAMES. Draft competitivo, meta S4 y brackets al mejor de tres con revisión de replay ante cualquier reclamo.',
  extraCol:'KDA',live:{a:'ALBO LÍMITE',b:'ESTUDIO ROJO',ta:'ALB',tb:'ESR',ev:'GRIETA MASTERS · SEMIFINAL · GRIETA DEL INVOCADOR',map:'Grieta del Invocador'},
  mapPool:['Grieta del Invocador','ARAM · Howling Abyss','Nexus Blitz','Arena · Modo 2v2v2'],
  hows:['Asesinato','Primera sangre','Torre caída','Dragón aniquilado','Barón Nashor','Alma del equipo'],
  matches:[
    {t:'21:00',status:'live',a:'ALBO LÍMITE',b:'ESTUDIO ROJO',sa:18,sb:15,map:'Grieta del Invocador',ev:'Grieta Masters · Semifinal'},
    {t:'16:10',status:'final',a:'ESTUDIO ROJO',b:'TALON SUR',sa:22,sb:9,map:'Grieta del Invocador',ev:'Grieta Masters · Cuartos'},
    {t:'15:00',status:'final',a:'KRU SOLOQ',b:'PIRATAS FTC',sa:11,sb:19,map:'Grieta del Invocador',ev:'Grieta Masters · Cuartos'},
    {t:'13:40',status:'final',a:'ISURUS NEXT',b:'VEG ANTÁRTIDA',sa:16,sb:13,map:'Grieta del Invocador',ev:'Grieta Masters · Ronda de 16'},
    {t:'21:00',status:'up',a:'ALBO LÍMITE',b:'ESTUDIO ROJO',sa:null,sb:null,map:'Grieta del Invocador',ev:'Grieta Masters · Semifinal'},
    {t:'23:30',status:'up',a:'KRU SOLOQ',b:'ISURUS NEXT',sa:null,sb:null,map:'ARAM · Howling Abyss',ev:'Grieta Masters · Semifinal'}],
  players:[
    {name:'ZEKITO',team:'ALBO LÍMITE',rating:1.38,kd:5.2,adr:312,kast:78.4,x:742,impact:1.71,clutch:8,badges:['pro','verified','champ']},
    {name:'JUGO',team:'ESTUDIO ROJO',rating:1.31,kd:4.4,adr:298,kast:74.9,x:681,impact:1.58,clutch:6,badges:['pro','verified']},
    {name:'LUNARÍA',team:'TALON SUR',rating:1.27,kd:4.1,adr:287,kast:72.6,x:655,impact:1.52,clutch:7,badges:['creator']},
    {name:'BASTIÁN',team:'KRU SOLOQ',rating:1.23,kd:3.8,adr:275,kast:70.8,x:612,impact:1.44,clutch:5,badges:['pro']},
    {name:'NYYX',team:'PIRATAS FTC',rating:1.19,kd:3.5,adr:264,kast:69.3,x:587,impact:1.39,clutch:4,badges:[]},
    {name:'KARMA-S',team:'ISURUS NEXT',rating:1.16,kd:3.3,adr:255,kast:68.1,x:561,impact:1.33,clutch:6,badges:['pro']},
    {name:'DONKÉ',team:'VEG ANTÁRTIDA',rating:1.12,kd:3.0,adr:246,kast:66.7,x:533,impact:1.27,clutch:3,badges:[]},
    {name:'MIAUW',team:'ALBO LÍMITE',rating:1.09,kd:2.8,adr:238,kast:65.4,x:510,impact:1.22,clutch:4,badges:[]},
    {name:'REPTIL',team:'ESTUDIO ROJO',rating:1.06,kd:2.6,adr:229,kast:64.2,x:488,impact:1.17,clutch:2,badges:[]},
    {name:'AURORA',team:'TALON SUR',rating:1.03,kd:2.4,adr:221,kast:63.0,x:466,impact:1.11,clutch:3,badges:['creator']}],
  rosters:{'ALBO LÍMITE':['ZEKITO','MIAUW','TREBOR','VAYA','QUIN'],'ESTUDIO ROJO':['JUGO','REPTIL','MALVA','SOMBRA','TATU'],'TALON SUR':['LUNARÍA','AURORA','BRUMA','KAIOS','RUIDO'],'KRU SOLOQ':['BASTIÁN','NIKO','PUMA','ZERO','LOBO'],'PIRATAS FTC':['NYYX','GARRA','MAREA','TIMÓN','KRAK'],'ISURUS NEXT':['KARMA-S','DUX','ORCA','BRISA','NODO'],'VEG ANTÁRTIDA':['DONKÉ','HIELO','AUSTRAL','PINGÜ','FROST'],'PIRÁMIDE':['OMEGA','DELTA','GAMA','ALFA','BETA']},
  tournaments:[
    {id:'l1',day:'26',mon:'ABR',name:'GRIETA MASTERS · ETAPA 4',tags:['DRAFT','BO3','ONLINE'],tier:'PRO',prize:25000,slots:16,filled:13,fee:9.99},
    {id:'l2',day:'28',mon:'ABR',name:'ARAM ROYALE #31',tags:['ARAM','BO1','ABIERTO'],tier:'FREE',prize:500,slots:64,filled:58,fee:0},
    {id:'l3',day:'03',mon:'MAY',name:'COPA INVOCADOR LATAM',tags:['INVITACIÓN','BO3'],tier:'PRO',prize:10000,slots:8,filled:5,fee:14.99},
    {id:'l4',day:'05',mon:'MAY',name:'CLASH NOCTURNO #18',tags:['BO3','5V5'],tier:'FREE',prize:250,slots:32,filled:11,fee:0}],
  bracket:{quarters:[{a:'ALBO LÍMITE',b:'PIRÁMIDE',sa:2,sb:0,meta:'BO3 · COMPLETADO'},{a:'ESTUDIO ROJO',b:'KRU SOLOQ',sa:2,sb:1,meta:'BO3 · COMPLETADO'},{a:'TALON SUR',b:'VEG ANTÁRTIDA',sa:2,sb:1,meta:'BO3 · COMPLETADO'},{a:'PIRATAS FTC',b:'ISURUS NEXT',sa:1,sb:2,meta:'BO3 · COMPLETADO'}],
    semis:[{a:'ALBO LÍMITE',b:'ESTUDIO ROJO',sa:null,sb:null,meta:'HOY · 21:00'},{a:'TALON SUR',b:'ISURUS NEXT',sa:null,sb:null,meta:'HOY · 23:30'}],
    final:{a:null,b:null,meta:'DOMINGO · 20:00 · BO5'},
    lb1:[{a:'PIRÁMIDE',b:'KRU SOLOQ',sa:1,sb:2,meta:'BO3 · COMPLETADO'},{a:'VEG ANTÁRTIDA',b:'PIRATAS FTC',sa:0,sb:2,meta:'BO3 · COMPLETADO'}],
    lb2:[{a:null,b:'PIRÁMIDE',meta:'TRAS SEMIS · BO3'},{a:null,b:'VEG ANTÁRTIDA',meta:'TRAS SEMIS · BO3'}],
    lbf:{a:null,b:null,meta:'SÁBADO · 20:00 · BO3'}},
  ticker:['GRIETA MASTERS S4 · CLASIFICATORIAS ABIERTAS','ARAM ROYALE #31: 58/64 EQUIPOS','LUNARÍA (CREADORA) EN DIRECTO EN KICK','NUEVO: INSIGNIA PRO DE LEAGUE EN TU PERFIL','GANA SERIES 5V5 Y SUBÍ TU VANTS RATING LOL']
 },
 fifa27:{
  gameLabel:'FIFA 27',
  title:'COPA<br><span class="out">VANTS</span> <span class="acc">FC S4</span>',short:'COPA VANTS FC S4',
  sub:'FIFA 27 competitivo 1v1 y 2v2 en VANTS GAMES. Reglas PRO: control de partido, captura obligatoria y verificación de resultado en cada ronda.',
  extraCol:'POS %',live:{a:'EL PIBE 10',b:'LA JEA 7',ta:'P10',tb:'JA7',ev:'COPA VANTS FC · SEMIFINAL · ESTADIO ARENA VANTS',map:'Estadio Arena VANTS'},
  mapPool:['Estadio Arena VANTS','Copa VANTS Arena','Estadio Nocturno','Estadio Clásico','Césped Pro Club'],
  hows:['Gol','Golazo de falta','Penal convertido','Contragolpe','Cabezazo','Al contraataque'],
  matches:[
    {t:'21:00',status:'live',a:'EL PIBE 10',b:'LA JEA 7',sa:2,sb:1,map:'Estadio Arena VANTS',ev:'Copa VANTS FC · Semifinal · Ida'},
    {t:'16:10',status:'final',a:'LA JEA 7',b:'MAGO-D',sa:3,sb:2,map:'Estadio Nocturno',ev:'Copa VANTS FC · Cuartos'},
    {t:'15:00',status:'final',a:'TINCHO92',b:'KYLIAN-LATAM',sa:1,sb:4,map:'Estadio Clásico',ev:'Copa VANTS FC · Cuartos'},
    {t:'13:40',status:'final',a:'EL PIBE 10',b:'NEO-9',sa:2,sb:0,map:'Copa VANTS Arena',ev:'Copa VANTS FC · Ronda de 16'},
    {t:'21:00',status:'up',a:'EL PIBE 10',b:'LA JEA 7',sa:null,sb:null,map:'Estadio Arena VANTS',ev:'Copa VANTS FC · Semifinal · Vuelta'},
    {t:'23:30',status:'up',a:'MAGO-D',b:'TINCHO92',sa:null,sb:null,map:'Estadio Nocturno',ev:'Copa VANTS FC · Semifinal'}],
  players:[
    {name:'EL PIBE 10',team:'SUDAKA FC',rating:1.40,kd:2.9,adr:64,kast:81.2,x:623,impact:1.75,clutch:9,badges:['pro','verified','champ']},
    {name:'LA JEA 7',team:'CARIBE UEFA',rating:1.33,kd:2.6,adr:61,kast:78.7,x:590,impact:1.62,clutch:7,badges:['pro','verified']},
    {name:'MAGO-D',team:'MIDAS FC',rating:1.28,kd:2.4,adr:59,kast:76.3,x:561,impact:1.55,clutch:6,badges:['creator']},
    {name:'KYLIAN-LATAM',team:'SUDAKA FC',rating:1.24,kd:2.2,adr:57,kast:74.8,x:538,impact:1.48,clutch:5,badges:['pro']},
    {name:'TINCHO92',team:'PAMPA UNITED',rating:1.20,kd:2.0,adr:55,kast:72.9,x:514,impact:1.41,clutch:4,badges:[]},
    {name:'NEO-9',team:'ANDINA FC',rating:1.17,kd:1.9,adr:53,kast:71.5,x:497,impact:1.36,clutch:6,badges:['creator']},
    {name:'FEO-11',team:'CARIBE UEFA',rating:1.13,kd:1.7,adr:51,kast:70.1,x:473,impact:1.29,clutch:3,badges:[]},
    {name:'R10 BRASIL',team:'MIDAS FC',rating:1.10,kd:1.6,adr:49,kast:68.8,x:452,impact:1.23,clutch:4,badges:[]},
    {name:'GATO-1',team:'PAMPA UNITED',rating:1.07,kd:1.5,adr:47,kast:67.4,x:431,impact:1.18,clutch:2,badges:[]},
    {name:'LA TORRE',team:'ANDINA FC',rating:1.04,kd:1.4,adr:45,kast:66.0,x:410,impact:1.12,clutch:3,badges:[]}],
  rosters:{'SUDAKA FC':['EL PIBE 10','KYLIAN-LATAM','PULGA','D10S','NENE'],'CARIBE UEFA':['LA JEA 7','FEO-11','CAFÉ','RITMO','SABROSO'],'MIDAS FC':['MAGO-D','R10 BRASIL','ORO','TALCO','LUJO'],'PAMPA UNITED':['TINCHO92','GATO-1','FAJA','CEBO','RASTRO'],'ANDINA FC':['NEO-9','LA TORRE','SALTA','PUNO','CUSCO'],'MATE CLUB':['YERBA','PAVADA','TERERÉ','BOMBILLA','AGUA'],'AZTECA XI':['CH14','QUAUH','TEOCA','XOLO','AGUILA'],'TANGO-5':['BANDONÉ','MILONGA','FACUNDO','CHARLY','GALA']},
  tournaments:[
    {id:'f1',day:'26',mon:'ABR',name:'COPA VANTS FC · ETAPA 4',tags:['1V1','DOBLE ELIM.'],tier:'PRO',prize:25000,slots:32,filled:27,fee:9.99},
    {id:'f2',day:'28',mon:'ABR',name:'LADDER NOCTURNA FUT #77',tags:['1V1','BO3','NOCTURNA'],tier:'FREE',prize:500,slots:64,filled:49,fee:0},
    {id:'f3',day:'03',mon:'MAY',name:'DRAFTS LEGENDS LATAM',tags:['INVITACIÓN','BO3'],tier:'PRO',prize:10000,slots:16,filled:9,fee:14.99},
    {id:'f4',day:'05',mon:'MAY',name:'PRO CLUBS AMISTOSO #9',tags:['2V2','AMISTOSO+'],tier:'FREE',prize:250,slots:32,filled:14,fee:0}],
  bracket:{quarters:[{a:'EL PIBE 10',b:'TANGO-5',sa:3,sb:1,meta:'BO3 · COMPLETADO'},{a:'LA JEA 7',b:'MAGO-D',sa:3,sb:2,meta:'BO3 · COMPLETADO'},{a:'KYLIAN-LATAM',b:'TINCHO92',sa:4,sb:1,meta:'BO3 · COMPLETADO'},{a:'NEO-9',b:'AZTECA XI',sa:2,sb:0,meta:'BO3 · COMPLETADO'}],
    semis:[{a:'EL PIBE 10',b:'LA JEA 7',sa:null,sb:null,meta:'HOY · 21:00'},{a:'KYLIAN-LATAM',b:'NEO-9',sa:null,sb:null,meta:'HOY · 23:30'}],
    final:{a:null,b:null,meta:'DOMINGO · 20:00 · BO5'},
    lb1:[{a:'TANGO-5',b:'MAGO-D',sa:1,sb:3,meta:'BO3 · COMPLETADO'},{a:'TINCHO92',b:'AZTECA XI',sa:2,sb:0,meta:'BO3 · COMPLETADO'}],
    lb2:[{a:null,b:'TANGO-5',meta:'TRAS SEMIS · BO3'},{a:null,b:'TINCHO92',meta:'TRAS SEMIS · BO3'}],
    lbf:{a:null,b:null,meta:'SÁBADO · 20:00 · BO3'}},
  ticker:['COPA VANTS FC S4 · INSCRIPCIONES AL LÍMITE','LADDER FUT #77: 49/64 JUGADORES','MAGO-D (CREADOR) EN DIRECTO EN YOUTUBE','NUEVO: REGISTRO DE RESULTADOS CON CAPTURA','GANA SERIES 1V1 Y SUBÍ TU VANTS RATING FC']
 },
 freefire:{
  gameLabel:'FREE FIRE',
  title:'BOOYAH<br><span class="out">CIRCUIT</span> <span class="acc">S4</span>',short:'BOOYAH CIRCUIT S4',
  sub:'El circuito de Free Fire de VANTS GAMES. Escuadrones de 4, zonas de clasificación por región y la BOOYAH como única forma de ganar la serie.',
  extraCol:'BOOYAH %',live:{a:'LOS FENIX',b:'ESCUADRÓN SUR',ta:'FEN',tb:'ESU',ev:'BOOYAH CIRCUIT · SEMIFINAL · ZONA NORTE',map:'Zona Norte · Purgatorio'},
  mapPool:['Purgatorio','Bermuda','Kalahari','Alpes','NeXTerra'],
  hows:['Eliminación','Duelo de escopeta','Sniper a distancia','Zona cerrándose','Revive del compañero','Booyah moment'],
  matches:[
    {t:'21:00',status:'live',a:'LOS FENIX',b:'ESCUADRÓN SUR',sa:32,sb:27,map:'Purgatorio',ev:'Booyah Circuit · Semifinal · Zona Norte'},
    {t:'16:10',status:'final',a:'ESCUADRÓN SUR',b:'LOBO ALPHA',sa:41,sb:18,map:'Bermuda',ev:'Booyah Circuit · Cuartos'},
    {t:'15:00',status:'final',a:'CASLA SQUAD',b:'TROPA DEL 9',sa:22,sb:35,map:'Kalahari',ev:'Booyah Circuit · Cuartos'},
    {t:'13:40',status:'final',a:'LOS FENIX',b:'TEAM CHAMO',sa:29,sb:24,map:'Alpes',ev:'Booyah Circuit · Ronda de 16'},
    {t:'21:00',status:'up',a:'LOS FENIX',b:'ESCUADRÓN SUR',sa:null,sb:null,map:'Purgatorio',ev:'Booyah Circuit · Semifinal · Zona Sur'},
    {t:'23:30',status:'up',a:'LOBO ALPHA',b:'CASLA SQUAD',sa:null,sb:null,map:'NeXTerra',ev:'Booyah Circuit · Semifinal'}],
  players:[
    {name:'FERXXO-FF',team:'LOS FENIX',rating:1.39,kd:6.1,adr:402,kast:79.8,x:812,impact:1.73,clutch:9,badges:['pro','verified','champ']},
    {name:'SOFI-SNIPER',team:'ESCUADRÓN SUR',rating:1.32,kd:5.3,adr:377,kast:76.2,x:744,impact:1.60,clutch:7,badges:['pro','verified']},
    {name:'EL YOYA',team:'LOBO ALPHA',rating:1.28,kd:4.9,adr:361,kast:74.0,x:703,impact:1.53,clutch:8,badges:['creator']},
    {name:'NENA-79',team:'CASLA SQUAD',rating:1.24,kd:4.4,adr:344,kast:72.1,x:662,impact:1.45,clutch:5,badges:['creator']},
    {name:'RAT4',team:'TROPA DEL 9',rating:1.20,kd:4.0,adr:329,kast:70.6,x:628,impact:1.38,clutch:4,badges:['pro']},
    {name:'CHAMO-X',team:'TEAM CHAMO',rating:1.17,kd:3.7,adr:315,kast:69.2,x:599,impact:1.33,clutch:6,badges:[]},
    {name:'PIRATA-FF',team:'LOS FENIX',rating:1.13,kd:3.4,adr:301,kast:67.8,x:570,impact:1.27,clutch:3,badges:[]},
    {name:'MAMBA-27',team:'ESCUADRÓN SUR',rating:1.10,kd:3.1,adr:288,kast:66.5,x:544,impact:1.21,clutch:4,badges:[]},
    {name:'TATI-GLOCK',team:'LOBO ALPHA',rating:1.06,kd:2.8,adr:273,kast:65.1,x:517,impact:1.15,clutch:2,badges:[]},
    {name:'ZORRO-88',team:'CASLA SQUAD',rating:1.03,kd:2.5,adr:260,kast:63.9,x:493,impact:1.10,clutch:3,badges:[]}],
  rosters:{'LOS FENIX':['FERXXO-FF','PIRATA-FF','CUERVO','MANDY','KIRA'],'ESCUADRÓN SUR':['SOFI-SNIPER','MAMBA-27','RECON','TANGO','VIGÍA'],'LOBO ALPHA':['EL YOYA','TATI-GLOCK','COLMILLO','AULLIDO','SABUESO'],'CASLA SQUAD':['NENA-79','ZORRO-88','BOEDO','GAUCHO','BAJO'],'TROPA DEL 9':['RAT4','MILITANTE','CAÑO','CHICO','GRITO'],'TEAM CHAMO':['CHAMO-X','AREPA','CATIRE','LLANERO','RUMBA'],'NORTE UNIDO':['CACHAÇO','MALANDRO','BEMBA','TÍO','BRISA'],'SQUAD 47':['GENERAL','CABO','TIN','RECLUTA','SARGENTO']},
  tournaments:[
    {id:'ff1',day:'26',mon:'ABR',name:'BOOYAH CIRCUIT · ETAPA 4',tags:['ESCUADRA','BO3','ONLINE'],tier:'PRO',prize:25000,slots:16,filled:15,fee:9.99},
    {id:'ff2',day:'28',mon:'ABR',name:'CLASH SQUAD NOCTURNO #44',tags:['CLASH SQUAD','BO7'],tier:'FREE',prize:500,slots:64,filled:61,fee:0},
    {id:'ff3',day:'03',mon:'MAY',name:'COPA LATAM BOOYAH',tags:['INVITACIÓN','BO5'],tier:'PRO',prize:10000,slots:12,filled:8,fee:14.99},
    {id:'ff4',day:'05',mon:'MAY',name:'DUO RUSH FINDE #21',tags:['DÚO','BO3'],tier:'FREE',prize:250,slots:48,filled:26,fee:0}],
  bracket:{quarters:[{a:'LOS FENIX',b:'NORTE UNIDO',sa:3,sb:0,meta:'BO5 · COMPLETADO'},{a:'ESCUADRÓN SUR',b:'SQUAD 47',sa:3,sb:1,meta:'BO5 · COMPLETADO'},{a:'LOBO ALPHA',b:'TROPA DEL 9',sa:3,sb:2,meta:'BO5 · COMPLETADO'},{a:'CASLA SQUAD',b:'TEAM CHAMO',sa:3,sb:1,meta:'BO5 · COMPLETADO'}],
    semis:[{a:'LOS FENIX',b:'ESCUADRÓN SUR',sa:null,sb:null,meta:'HOY · 21:00'},{a:'LOBO ALPHA',b:'CASLA SQUAD',sa:null,sb:null,meta:'HOY · 23:30'}],
    final:{a:null,b:null,meta:'DOMINGO · 20:00 · BO7'},
    lb1:[{a:'NORTE UNIDO',b:'SQUAD 47',sa:2,sb:3,meta:'BO5 · COMPLETADO'},{a:'TROPA DEL 9',b:'TEAM CHAMO',sa:3,sb:0,meta:'BO5 · COMPLETADO'}],
    lb2:[{a:null,b:'NORTE UNIDO',meta:'TRAS SEMIS · BO5'},{a:null,b:'TROPA DEL 9',meta:'TRAS SEMIS · BO5'}],
    lbf:{a:null,b:null,meta:'SÁBADO · 20:00 · BO5'}},
  ticker:['BOOYAH CIRCUIT S4 · ETAPA 4 EN JUEGO','CLASH SQUAD NOCTURNO #44: 61/64','EL YOYA (CREADOR) EN DIRECTO EN TIKTOK','NUEVO: INSIGNIA PRO FREE FIRE EN TU PERFIL','LA BOOYAH VALE DOBLE RR EN EL RANKED FF']
 },
 rl:{
  gameLabel:'ROCKET LEAGUE',
  title:'TURBO<br><span class="out">CLASH</span> <span class="acc">S4</span>',short:'TURBO CLASH S4',
  sub:'Rocket League 3v3 en VANTS GAMES. Turbo Clash S4: overtime dorado, reglas de rotación y replay centrado para cada gol reclamado.',
  extraCol:'SAVE %',live:{a:'NITRO RACING',b:'TURBO MIX',ta:'NTR',tb:'TBM',ev:'TURBO CLASH · SEMIFINAL · NEÓN FIELDS',map:'Neón Fields'},
  mapPool:['Neón Fields','Champions Field','DFH Stadium','Mannfield Nocturno','Aquadome'],
  hows:['Gol aéreo','Tiro esquinado','Remate de media vuelta','Kickoff ganado','Atajada clave','Gol en overtime'],
  matches:[
    {t:'21:00',status:'live',a:'NITRO RACING',b:'TURBO MIX',sa:4,sb:3,map:'Neón Fields',ev:'Turbo Clash · Semifinal · Ida'},
    {t:'16:10',status:'final',a:'TURBO MIX',b:'OLIMPO FC',sa:5,sb:2,map:'Champions Field',ev:'Turbo Clash · Cuartos'},
    {t:'15:00',status:'final',a:'PIXEL DRIFT',b:'NITRO RACING',sa:1,sb:3,map:'DFH Stadium',ev:'Turbo Clash · Cuartos'},
    {t:'13:40',status:'final',a:'GATO BOOST',b:'OLIMPO FC',sa:2,sb:6,map:'Mannfield Nocturno',ev:'Turbo Clash · Ronda de 16'},
    {t:'21:00',status:'up',a:'NITRO RACING',b:'TURBO MIX',sa:null,sb:null,map:'Neón Fields',ev:'Turbo Clash · Semifinal · Vuelta'},
    {t:'23:30',status:'up',a:'PIXEL DRIFT',b:'GATO BOOST',sa:null,sb:null,map:'Aquadome',ev:'Turbo Clash · Semifinal'}],
  players:[
    {name:'TURBO-KID',team:'NITRO RACING',rating:1.36,kd:3.9,adr:488,kast:77.3,x:698,impact:1.68,clutch:8,badges:['pro','verified','champ']},
    {name:'FLIP-RESET',team:'TURBO MIX',rating:1.30,kd:3.4,adr:461,kast:74.8,x:655,impact:1.57,clutch:6,badges:['pro','verified']},
    {name:'AÉREA',team:'OLIMPO FC',rating:1.26,kd:3.1,adr:447,kast:73.2,x:622,impact:1.50,clutch:7,badges:['creator']},
    {name:'BOOSTER',team:'PIXEL DRIFT',rating:1.22,kd:2.8,adr:430,kast:71.7,x:590,impact:1.43,clutch:5,badges:['pro']},
    {name:'NEO-WAVE',team:'GATO BOOST',rating:1.18,kd:2.5,adr:414,kast:70.3,x:561,impact:1.36,clutch:4,badges:[]},
    {name:'MURCIÉLAGO',team:'NITRO RACING',rating:1.15,kd:2.3,adr:402,kast:69.0,x:538,impact:1.31,clutch:5,badges:['creator']},
    {name:'DEMO-KING',team:'TURBO MIX',rating:1.11,kd:2.1,adr:388,kast:67.6,x:512,impact:1.25,clutch:3,badges:[]},
    {name:'CHIQUITA',team:'OLIMPO FC',rating:1.08,kd:1.9,adr:374,kast:66.3,x:488,impact:1.19,clutch:4,badges:[]},
    {name:'RAIL-GUN',team:'PIXEL DRIFT',rating:1.05,kd:1.7,adr:361,kast:65.0,x:466,impact:1.14,clutch:2,badges:[]},
    {name:'OKTO',team:'GATO BOOST',rating:1.02,kd:1.5,adr:349,kast:63.8,x:444,impact:1.08,clutch:3,badges:[]}],
  rosters:{'NITRO RACING':['TURBO-KID','MURCIÉLAGO','PISTÓN','RODADO','NAFTA'],'TURBO MIX':['FLIP-RESET','DEMO-KING','MEZCLA','TURBINA','NITRO'],'OLIMPO FC':['AÉREA','CHIQUITA','ZEUS','ATENEA','TITÁN'],'PIXEL DRIFT':['BOOSTER','RAIL-GUN','PÍXEL','DERIVA','ARCADE'],'GATO BOOST':['NEO-WAVE','OKTO','BIGOTE','GARRA','PATITA'],'RUEDA SUELTA':['LLANTA','EJE','FRENO','CHASIS','ÓLEO'],'OCTANE CLUB':['SIETE','DOMINUS','FENNEC','MERLIN','DÉBIL'],'AERO LATAM':['CÓNDOR','ANDINO','VÉRTIGO','TORNADO','CIELO']},
  tournaments:[
    {id:'r1',day:'26',mon:'ABR',name:'TURBO CLASH · ETAPA 4',tags:['3V3','BO5','ONLINE'],tier:'PRO',prize:25000,slots:16,filled:12,fee:9.99},
    {id:'r2',day:'28',mon:'ABR',name:'OT DOBLE ELIM #33',tags:['DOBLE ELIM.','BO3'],tier:'FREE',prize:500,slots:48,filled:31,fee:0},
    {id:'r3',day:'03',mon:'MAY',name:'COPA AÉREA LATAM',tags:['INVITACIÓN','BO5'],tier:'PRO',prize:10000,slots:8,filled:6,fee:14.99},
    {id:'r4',day:'05',mon:'MAY',name:'2V2 WINGMAN BOOST #12',tags:['2V2','BO3'],tier:'FREE',prize:250,slots:32,filled:19,fee:0}],
  bracket:{quarters:[{a:'NITRO RACING',b:'OCTANE CLUB',sa:3,sb:1,meta:'BO5 · COMPLETADO'},{a:'TURBO MIX',b:'RUEDA SUELTA',sa:3,sb:0,meta:'BO5 · COMPLETADO'},{a:'OLIMPO FC',b:'GATO BOOST',sa:3,sb:2,meta:'BO5 · COMPLETADO'},{a:'PIXEL DRIFT',b:'AERO LATAM',sa:3,sb:1,meta:'BO5 · COMPLETADO'}],
    semis:[{a:'NITRO RACING',b:'TURBO MIX',sa:null,sb:null,meta:'HOY · 21:00'},{a:'OLIMPO FC',b:'PIXEL DRIFT',sa:null,sb:null,meta:'HOY · 23:30'}],
    final:{a:null,b:null,meta:'DOMINGO · 20:00 · BO7'},
    lb1:[{a:'OCTANE CLUB',b:'RUEDA SUELTA',sa:3,sb:1,meta:'BO5 · COMPLETADO'},{a:'GATO BOOST',b:'AERO LATAM',sa:2,sb:3,meta:'BO5 · COMPLETADO'}],
    lb2:[{a:null,b:'OCTANE CLUB',meta:'TRAS SEMIS · BO5'},{a:null,b:'AERO LATAM',meta:'TRAS SEMIS · BO5'}],
    lbf:{a:null,b:null,meta:'SÁBADO · 20:00 · BO5'}},
  ticker:['TURBO CLASH S4 · SEMIFINALES HOY','OT DOBLE ELIM #33: 31/48 EQUIPOS','AÉREA (CREADORA) EN DIRECTO EN TWITCH','NUEVO: INSIGNIA PRO ROCKET LEAGUE','GANÁ EL OT Y LLEVÁTE RR DOBLE EN EL RANKED RL']
 }
};

/* ================= JUGADOR LOCAL (chip de la cuenta) =================
   El perfil visible ya no es local ni demo: cada jugador se crea a sí mismo
   al iniciar sesión (arena-live.js · CUENTA REAL VANTS) y se guarda en Neon.
   Este objeto solo alimenta el chip de la barra superior. */
const me={name:'RETADOR',country:'AR 🇦🇷',rank:'acero',sub:'II',rr:148,peak:'ACERO II',lvl:23,badges:[],socials:{},game:{},live:false,bio:'Nuevo en el circuito VANTS. Conectá tus cuentas, ganá series y subí de rango.'};
function addBadge(b){if(!me.badges.includes(b))me.badges.push(b);}

/* ================= TICKER ================= */
function renderTicker(){
  const tt=$('#tickerTrack');if(!tt)return;
  const items=D().ticker.map(t=>'<span>'+t+'</span>').join('');
  tt.innerHTML=items+items;
}

/* ================= PARTIDO EN VIVO =================
   Sin simulación: si el juego no tiene datos reales, el panel muestra
   el estado idle (renderLiveIdle). La agenda de VALORANT usa partidos
   reales verificados de vlr.gg y, si hay secret HENRIKDEV_API_KEY en el
   Worker, se refresca en vivo vía /api/valorant/esports. */

function renderLive(){
  renderLiveIdle();
}
function renderLiveIdle(){
  if(!document.getElementById('liveEvent'))return;
  const L=D().live;
  const fin=!!L.fin&&L.sa!=null&&L.sb!=null;
  const bd=$('#liveBadge');if(bd)bd.innerHTML='<i class="dot"></i>'+(fin?'ÚLTIMO RESULTADO':'PRÓXIMO PARTIDO');
  const lb=$('#liveSpecLbl');if(lb)lb.textContent=fin?'FINAL':(L.horaLbl||'INICIO');
  $('#liveSpec').textContent=fin?(L.bo||'BO5'):(L.hora||'--:--');
  $('#liveEvent').textContent=L.ev;
  $('#liveScore').innerHTML=fin?escHtml(String(L.sa))+'<i>:</i>'+escHtml(String(L.sb)):'<i>VS</i>';
  $('#pipsA').innerHTML='';$('#pipsB').innerHTML='';
  $('#liveFeed').innerHTML='<div class="lf fa"><b>'+L.a+' vs '+L.b+'</b> · '+L.ev+'</div>'
    +'<div class="lf fb">RESULTADOS REALES · SIN SIMULACIÓN · COBERTURA Y ROUND A ROUND EN VLR.GG</div>';
}

/* ================= PARTIDOS ================= */
function renderMatches(){
  const nota=$('#agendaNote');
  if(nota)nota.innerHTML=D().matches.some(m=>m.real)
    ?'Resultados y horarios <b>REALES</b> de vlr.gg · hora de Caracas (VET). Clic en un partido para el detalle y el enlace a la fuente oficial.'
    :'Cobertura real de partidos aún no disponible para este juego. La agenda de <b>VALORANT</b> se alimenta de vlr.gg.';
  if(!document.getElementById('matchList'))return;
  const list=D().matches;
  $('#matchList').innerHTML=list.length?list.map((m,i)=>{
    const chip=m.status==='live'?'<span class="chip live"><i class="dot"></i>LIVE</span>':m.status==='final'?'<span class="chip fin">FINAL</span>':'<span class="chip up">'+escHtml(m.t)+'</span>';
    const sa=m.status==='live'?null:m.sa,sb=m.status==='live'?null:m.sb;
    return '<div class="mrow" data-idx="'+i+'">'
      +'<div class="m-time"><b class="mono">'+(m.status==='live'?'AHORA':escHtml(m.t))+'</b>'+chip+'</div>'
      +'<div class="m-team" style="justify-content:flex-end"><span>'+escHtml(m.a)+'</span></div>'
      +'<div class="m-score mono">'+(m.status==='up'?'<i>vs</i>':(sa>sb?'<b>'+sa+'</b><i>:</i>'+sb:sa+'<i>:</i><b>'+sb+'</b>'))+'</div>'
      +'<div class="m-team"><span>'+escHtml(m.b)+'</span></div>'
      +'<div class="m-map"><b>'+escHtml(m.map.toUpperCase())+'</b>'+(m.bo||'BO3')+'</div>'
      +'<div class="m-ev">'+escHtml(m.ev.toUpperCase())+'</div>'
      +'<span class="m-go"><i data-lucide="chevron-right"></i></span></div>';
  }).join(''):'<div style="grid-column:1/-1;border:1px dashed var(--line);border-radius:12px;padding:34px 20px;text-align:center;font:600 11px/1.8 var(--mono);letter-spacing:.12em;color:var(--dim)">SIN PARTIDOS CARGADOS PARA ESTE JUEGO · COBERTURA PRO REAL EN LA AGENDA DE VALORANT (VLR.GG)</div>';icons();
}
const matchListEl=$('#matchList');
if(matchListEl)matchListEl.addEventListener('click',e=>{const r=e.target.closest('.mrow');if(r)openMatchDetail(D().matches[+r.dataset.idx]);});

function openMatchDetail(m){
  /* Partidos REALES (vlr.gg): sin round a round simulado ni stats inventadas */
  if(m.real){
    const isUp=m.status==='up';
    openDrawer('<div class="d-head"><span class="kicker">'+(isUp?'PRÓXIMO · PARTIDO REAL':'RESULTADO REAL')+'</span><button class="d-x" onclick="closeDrawer()"><i data-lucide="x"></i></button></div>'
      +'<div class="d-body"><p class="mono" style="font-size:10px;letter-spacing:.12em;color:var(--dim);margin-bottom:18px">'+escHtml(m.ev.toUpperCase())+'</p>'
      +'<div class="d-score"><div class="d-team">'+escHtml(m.a)+'</div><div class="d-num">'+(isUp?'<i>VS</i>':m.sa+'<i>:</i>'+m.sb)+'</div><div class="d-team r">'+escHtml(m.b)+'</div></div>'
      +'<p class="d-map">'+(isUp?('COMIENZA: '+escHtml(m.t)+' (HORA CARACAS) · '+m.bo):('SERIE '+m.bo+' · FINALIZADA'))+'</p>'
      +'<p class="d-sec">FUENTE OFICIAL · DATOS REALES</p>'
      +(m.url?'<a class="btn btn-ghost btn-sm" style="margin-top:8px;width:100%;justify-content:center" href="'+escHtml(m.url)+'" target="_blank" rel="noopener">VER PARTIDO COMPLETO EN VLR.GG <i data-lucide="external-link"></i></a>':'')
      +'<p class="d-empty">Sincronizado con vlr.gg. VANTS no simula resultados del circuito profesional: mapas, round a round y estadísticas detalladas viven en la fuente oficial.</p>'
      +'</div>');
    return;
  }
  /* Partidos del circuito VANTS (no pro): sin round a round ni stats
     inventadas. El detalle muestra el marcador real cuando existe. */
  const isUp=m.status==='up'||m.status==='live';
  const sa=m.status==='final'?m.sa:null,sb=m.status==='final'?m.sb:null;
  openDrawer('<div class="d-head"><span class="kicker">'+(isUp?'PREVIA':'DETALLE')+'</span><button class="d-x" onclick="closeDrawer()"><i data-lucide="x"></i></button></div>'
    +'<div class="d-body"><p class="mono" style="font-size:10px;letter-spacing:.12em;color:var(--dim);margin-bottom:18px">'+escHtml(m.ev.toUpperCase())+'</p>'
    +'<div class="d-score"><div class="d-team">'+escHtml(m.a)+'</div><div class="d-num">'+(isUp?'<i>vs</i>':sa+'<i>:</i>'+sb)+'</div><div class="d-team r">'+escHtml(m.b)+'</div></div>'
    +'<p class="d-map">'+(isUp?('SERIE PROGRAMADA · '+(m.map||'POR DEFINIR').toUpperCase()):('SERIE '+(m.bo||'BO3')+' · FINALIZADA'))+'</p>'
    +'<p class="d-sec">DATOS DEL CIRCUITO VANTS</p>'
    +'<p class="d-empty">VANTS no inventa round a round ni estadísticas: el detalle completo de cada serie del circuito se publica con el resultado confirmado por ambos capitanes.</p>'
    +'</div>');
}
const liveMoreEl=$('#liveMore');
if(liveMoreEl)liveMoreEl.addEventListener('click',()=>{const L=D().live;
  const fin=!!L.fin&&L.sa!=null&&L.sb!=null;
  openMatchDetail({real:true,status:fin?'final':'up',sa:fin?L.sa:null,sb:fin?L.sb:null,a:L.a,b:L.b,map:L.map,bo:L.bo||'BO5',ev:L.ev,url:L.url,t:L.hora});});

/* ================= RANKING ================= */
const COLS=[
  {key:'pos',label:'#',num:true},{key:'name',label:'JUGADOR'},
  {key:'rank',label:'RANGO'},{key:'team',label:'EQUIPO'},
  {key:'rating',label:'RATING',num:true},{key:'kd',label:'K/D',num:true},
  {key:'adr',label:'ADR',num:true},{key:'kast',label:'KAST %',num:true},
  {key:'x',label:'ACS',num:true,dynamic:true},
  {key:'impact',label:'IMPACTO',num:true,pro:true},{key:'clutch',label:'CLUTCH',num:true,pro:true}];
function renderLbHead(){
  if(!document.getElementById('lbHead'))return;
  const reales=usandoJugadoresReales();
  const cols=reales?REAL_COLS:COLS;
  const eff=reales&&!cols.some(c=>c.key===state.sort.key)?'mmr':state.sort.key;
  $('#lbHead').innerHTML='<tr>'+cols.map(c=>{
    const label=(c.dynamic?D().extraCol:c.label)+(c.pro?' <span class="lock"><i data-lucide="lock"></i>PRO</span>':'');
    const on=eff===c.key,arrow=on?(state.sort.dir===-1?'▾':'▴'):'';
    if(['pos','name','rank','team'].includes(c.key))return '<th><button disabled style="cursor:default;opacity:.8">'+label+'</button></th>';
    return '<th'+(c.num?' class="num"':'')+'><button data-key="'+c.key+'" class="'+(on?'on':'')+'">'+label+arrow+'</button></th>';}).join('')+'</tr>';
  icons();
}
/* columnas del ranking REAL (perfiles nacidos de un inicio de sesión) */
const REAL_COLS=[
  {key:'pos',label:'#'},{key:'name',label:'JUGADOR'},
  {key:'rank',label:'RANGO'},{key:'team',label:'PAÍS · REGIÓN'},
  {key:'rating',label:'RATING',num:true},{key:'mmr',label:'RR',num:true},
  {key:'games',label:'PARTIDOS',num:true},{key:'wins',label:'V',num:true},
  {key:'losses',label:'D',num:true},{key:'wr',label:'WINRATE',num:true},
  {key:'kd',label:'K/D',num:true}];
const usandoJugadoresReales=()=>(window.VANTS_PLAYERS||[]).some(p=>p&&p.id);
function filasRealesLb(q){
  return (window.VANTS_PLAYERS||[]).map(p=>{
    const st=(window.VANTS_STATS||{})[p.id]||{};
    const raw=(typeof p.rating==='number'&&p.rating>0)?p.rating:((st.rank!=null&&st.rank!==''&&!isNaN(parseFloat(st.rank))&&parseFloat(st.rank)>=.5&&parseFloat(st.rank)<=2)?parseFloat(st.rank):null);
    const wins=st.wins||0,losses=st.losses||0,games=wins+losses;
    return {real:true,id:p.id,name:(p.display_name||p.username||'JUGADOR').toUpperCase(),username:p.username||'',
      team:((p.country||'')+(p.region?' · '+p.region:''))||'—',
      rating:raw||0,rank:raw||0,mmr:(st.mmr!=null)?st.mmr:0,games,wins,losses,
      wr:games?Math.round(wins/games*100):0,kd:(st.kd!=null)?st.kd:0,
      badges:badgesDeRol(p)};
  }).filter(p=>!q||p.name.toLowerCase().includes(q)||(p.username||'').toLowerCase().includes(q)||(p.team||'').toLowerCase().includes(q));
}
function renderLbBody(){
  if(!document.getElementById('lbBody'))return;
  const q=state.search.toLowerCase();
  if(usandoJugadoresReales()){
    let rows=filasRealesLb(q);
    const k=REAL_COLS.some(c=>c.key===state.sort.key)?state.sort.key:'mmr';
    const dir=state.sort.dir;
    rows=[...rows].sort((a,b)=>(a[k]>b[k]?1:a[k]<b[k]?-1:0)*dir);
    $('#lbBody').innerHTML=rows.length?rows.map((p,i)=>{
      const idx=i+1;
      return '<tr'+(idx===1&&!q?' class="top"':'')+'>'
        +'<td class="p-pos mono">'+String(idx).padStart(2,'0')+'</td>'
        +'<td class="p-name">'+(vivoDe(p.id)?vivoChipHTML(vivoDe(p.id)):'')+escHtml(p.name)+(p.badges&&p.badges.length?badgeDots(p.badges):'')+'<small>@'+escHtml(p.username||'—')+'</small></td>'
        +'<td class="rank-cell">'+(p.rating>0?rankCell(p.rating):'<span class="mono" style="font:600 9px/1 var(--mono);color:var(--dim)">SIN RANGO</span>')+'</td>'
        +'<td class="mono" style="color:var(--muted)">'+escHtml(p.team)+'</td>'
        +'<td class="num mono hl">'+(p.rating>0?p.rating.toFixed(2):'—')+'</td>'
        +'<td class="num mono">'+(p.mmr||p.mmr===0?p.mmr:'—')+'</td>'
        +'<td class="num mono">'+p.games+'</td>'
        +'<td class="num mono">'+p.wins+'</td>'
        +'<td class="num mono">'+p.losses+'</td>'
        +'<td class="num mono">'+(p.games?p.wr+'%':'—')+'</td>'
        +'<td class="num mono">'+(p.games?(p.kd?p.kd.toFixed(2):'—'):'—')+'</td></tr>';
    }).join(''):'<tr><td colspan="11" style="text-align:center;color:var(--dim);padding:34px">Todavía no hay jugadores rankeados: reportá tu primera serie desde tu perfil</td></tr>';
    icons();return;
  }
  let rows=D().players.filter(p=>!q||p.name.toLowerCase().includes(q)||p.team.toLowerCase().includes(q));
  const k=state.sort.key,dir=state.sort.dir;
  rows=[...rows].sort((a,b)=>(a[k]>b[k]?1:a[k]<b[k]?-1:0)*dir);
  $('#lbBody').innerHTML=rows.length?rows.map(p=>{
    const idx=D().players.indexOf(p)+1;
    return '<tr'+(idx===1&&!q?' class="top"':'')+'>'
      +'<td class="p-pos mono">'+String(idx).padStart(2,'0')+'</td>'
      +'<td class="p-name">'+p.name+badgeDots(p.badges)+'<small>'+p.team.toUpperCase()+'</small></td>'
      +'<td class="rank-cell">'+rankCell(p.rating)+'</td>'
      +'<td class="mono" style="color:var(--muted)">'+p.team.toUpperCase()+'</td>'
      +'<td class="num mono hl">'+p.rating.toFixed(2)+'</td>'
      +'<td class="num mono">'+p.kd.toFixed(2)+'</td>'
      +'<td class="num mono">'+p.adr.toFixed(1)+'</td>'
      +'<td class="num mono">'+p.kast.toFixed(1)+'</td>'
      +'<td class="num mono">'+p.x+'</td>'
      +'<td class="num mono"><span class="pro-val">'+p.impact.toFixed(2)+'</span></td>'
      +'<td class="num mono"><span class="pro-val">'+p.clutch+'</span></td></tr>';
  }).join(''):'<tr><td colspan="11" style="text-align:center;color:var(--dim);padding:34px">'+(state.search?('Sin resultados para "'+state.search+'"'):'Todavía no hay jugadores rankeados: creá tu perfil y reportá tu primera serie')+'</td></tr>';
  icons();
}
const lbHeadEl=$('#lbHead');
if(lbHeadEl)lbHeadEl.addEventListener('click',e=>{
  const b=e.target.closest('button[data-key]');if(!b)return;
  const key=b.dataset.key;
  if((key==='impact'||key==='clutch')&&!state.isPro){toast('Columnas exclusivas de miembros PRO','info');return;}
  if(state.sort.key===key)state.sort.dir*=-1;else{state.sort.key=key;state.sort.dir=-1;}
  renderLbHead();renderLbBody();
});
const lbSearchEl=$('#lbSearch');
if(lbSearchEl)lbSearchEl.addEventListener('input',e=>{state.search=e.target.value;renderLbBody();});

/* ================= BRACKET ================= */
function bMatch(m,r,i){
  if(!m.a&&!m.b)return '<div class="b-match" style="cursor:default"><div class="b-tbd">POR DEFINIR</div><div class="b-meta">'+m.meta+'</div></div>';
  const head='<div class="b-match" data-r="'+r+'" data-i="'+i+'">';
  if(!m.a||!m.b){const t=m.a||m.b;return head+'<div class="b-tbd">'+escHtml(m.a?t:'POR DEFINIR')+'</div><div class="b-tbd">'+escHtml(m.b?t:'POR DEFINIR')+'</div><div class="b-meta">'+m.meta+'</div></div>';}
  const hasScore=m.sa!=null;
  const row=(n,sc,w,l,s)=>'<div class="b-team'+(w?' win':'')+(l?' lose':'')+'"><span class="bt-name"><span class="bt-seed">#'+s+'</span>'+escHtml(n)+'</span><span class="bt-score">'+(hasScore?sc:'—')+'</span></div>';
  return head
    +row(m.a,m.sa,hasScore&&m.sa>m.sb,hasScore&&m.sa<m.sb,1)
    +row(m.b,m.sb,hasScore&&m.sb>m.sa,hasScore&&m.sb<m.sa,2)
    +'<div class="b-meta">'+m.meta+'</div></div>';
}
function renderBracket(){
  if(!document.getElementById('bracketGrid'))return;
  const b=D().bracket;
  const up='<div class="round"><p class="r-title">CUARTOS DE FINAL</p>'+b.quarters.map((m,i)=>bMatch(m,'q',i)).join('')+'</div>'
    +'<div class="round"><p class="r-title">SEMIFINALES</p>'+b.semis.map((m,i)=>bMatch(m,'s',i)).join('')+'</div>'
    +'<div class="round"><p class="r-title">GRAN FINAL</p>'+bMatch(b.final,'f',0)+'</div>';
  const lo='<div class="round"><p class="r-title">INFERIORES · RONDA 1</p>'+b.lb1.map((m,i)=>bMatch(m,'l1',i)).join('')+'</div>'
    +'<div class="round"><p class="r-title">INFERIORES · RONDA 2</p>'+b.lb2.map((m,i)=>bMatch(m,'l2',i)).join('')+'</div>'
    +'<div class="round"><p class="r-title">FINAL INFERIOR</p>'+bMatch(b.lbf,'lf',0)+'</div>';
  $('#bracketGrid').innerHTML='<div class="bracket-rounds">'+up+'</div>'
    +'<p class="brk-sep">LLAVES INFERIORES · el perdedor cruza aqui y pelea la revancha</p>'
    +'<div class="bracket-rounds">'+lo+'</div>';
}
const bracketGridEl=$('#bracketGrid');
if(bracketGridEl)bracketGridEl.addEventListener('click',e=>{
  const el=e.target.closest('.b-match[data-r]');if(!el)return;
  const b=D().bracket,r=el.dataset.r,i=+el.dataset.i;
  const m=r==='q'?b.quarters[i]:r==='s'?b.semis[i]:r==='l1'?b.lb1[i]:r==='l2'?b.lb2[i]:r==='lf'?b.lbf:b.final;
  if(!m)return;
  const rName={q:'Cuartos de final',s:'Semifinal',f:'Gran final',l1:'Llaves inferiores · R1',l2:'Llaves inferiores · R2',lf:'Final de llaves inferiores'}[r]||'Bracket';
  openMatchDetail({status:m.sa!=null?'final':'up',a:m.a,b:m.b,sa:m.sa,sb:m.sb,map:D().mapPool[i%D().mapPool.length],ev:D().short+' · '+rName});
});

/* ================= TORNEOS ================= */
function renderTournaments(){
  if(!document.getElementById('tournList'))return;
  $('#tournList').innerHTML=D().tournaments.map(t=>{
    const done=state.entered[t.id],full=t.slots!=null&&t.filled>=t.slots;
    const prizeTxt=(t.prize==null)?'POR ANUNCIAR':money(t.prize);
    return '<div class="trow'+(done?' done':'')+'">'
      +'<div class="t-date"><b>'+t.day+'</b><span>'+t.mon+'</span></div>'
      +'<div class="t-info"><h3>'+escHtml(t.name)+'</h3><div class="t-tags"><span class="tag'+(t.tier==='PRO'?' prem':'')+'">'+escHtml(t.tier)+'</span>'+t.tags.map(x=>'<span class="tag">'+escHtml(x)+'</span>').join('')+'</div></div>'
      +'<div class="t-prize"><b>'+prizeTxt+'</b><span>POZO DE PREMIOS</span></div>'
      +(t.slots!=null
        ?'<div class="t-slots"><div class="sl-bar"><i style="width:'+(t.filled/t.slots*100)+'%"></i></div><div class="sl-txt"><span>CUPOS</span><span>'+t.filled+' / '+t.slots+'</span></div></div>'
        :'<div class="t-slots"><div class="sl-txt" style="align-items:center"><span>CUPOS</span><span>ABIERTOS</span></div></div>')
      +'<div class="t-fee '+(t.fee?'paid':'free')+'">'+(t.fee?money(t.fee):'GRATIS')+'<small>'+(t.fee?'POR EQUIPO':'ENTRADA LIBRE')+'</small></div>'
      +'<div class="t-act"><button class="btn '+(t.tier==='PRO'?'btn-cut':'btn-ghost')+' btn-sm btn-join" data-tid="'+t.id+'"'+(full?' disabled':'')+'>'
      +(full?'COMPLETO':(t.tier==='PRO'?'INSCRIBIR · '+money(t.fee):'INSCRIBIRME'))+'</button>'
      +'<span class="t-entered"><i data-lucide="badge-check"></i>INSCRITO</span></div></div>';
  }).join('');icons();
}
const tournListEl=$('#tournList');
if(tournListEl)tournListEl.addEventListener('click',e=>{
  const b=e.target.closest('.btn-join');if(!b||b.disabled)return;
  openEnroll(D().tournaments.find(x=>x.id===b.dataset.tid));
});
const heroJoinEl=$('#heroJoin');
if(heroJoinEl)heroJoinEl.addEventListener('click',()=>openEnroll(D().tournaments[0]));
function openEnroll(t){
  const fee=t.fee||0;
  openModal('<div class="mc-head"><h3>Inscripción · '+escHtml(t.name)+'</h3><button class="d-x" id="mClose"><i data-lucide="x"></i></button></div><div class="mc-body">'
    +'<div class="field-row"><div class="field"><label>NOMBRE DEL EQUIPO</label><input id="fTeam" type="text" placeholder="Ej: BANDA DEL MEDIO" maxlength="26"></div>'
    +'<div class="field"><label>TAG (2–4)</label><input id="fTag" type="text" placeholder="BDM" maxlength="4"></div></div>'
    +'<div class="field"><label>CAPITÁN (nick#000)</label><input id="fCap" type="text" placeholder="'+me.name.toLowerCase()+'#VNTS"></div>'
    +'<div class="field"><label>REGIÓN / SERVIDOR</label><select id="fReg"><option>BSAS · 12 ms</option><option>SÃO PAULO · 18 ms</option><option>SANTIAGO · 26 ms</option><option>MIAMI · 48 ms</option></select></div>'
    +'<div class="fee-line"><span>'+(fee?'FEE DE INSCRIPCIÓN':'ENTRADA')+'</span><b>'+(fee?money(fee):'GRATIS')+'</b></div>'
    +'<label class="check"><input type="checkbox" id="fTerms"><span>Acepto el reglamento S4, el protocolo anti-cheat y confirmo que los 5 jugadores tienen la cuenta en regla.</span></label>'
    +'<button class="btn btn-cut" id="fSubmit">'+(fee?'CONTINUAR AL PAGO · '+money(fee):'CONFIRMAR INSCRIPCIÓN')+'</button></div>');
  $('#mClose').onclick=closeModal;
  $('#fSubmit').onclick=()=>{
    const team=$('#fTeam').value.trim(),tag=$('#fTag').value.trim().toUpperCase(),cap=$('#fCap').value.trim();
    if(!team||!tag||!cap){toast('Completá equipo, tag y capitán','info');return;}
    if(!$('#fTerms').checked){toast('Tenés que aceptar el reglamento','info');return;}
    if(fee&&!vantsEsOwner())openPayStep(t,team,tag);else inscribirReal(t,team,tag);
  };
}
function openPayStep(t,team,tag){
  if(vantsEsOwner()){inscribirReal(t,team,tag);toast('Privilegio OWNER: inscripción gratuita');return;}
  openModal('<div class="mc-head"><h3>Confirmar pago</h3><button class="d-x" id="mClose"><i data-lucide="x"></i></button></div><div class="mc-body">'
    +'<div class="mc-sum"><span>'+escHtml(t.name)+'</span><span>'+(D().gameLabel||(state.game==='valorant'?'VALORANT':'CS2'))+'</span></div>'
    +'<div class="mc-sum"><span>Equipo</span><span>'+escHtml(team)+' ['+escHtml(tag)+']</span></div>'
    +'<div class="mc-sum"><span>Fee de inscripción</span><span>'+money(t.fee)+'</span></div>'
    +'<div class="mc-sum"><span>Reembolso hasta 48 h antes</span><span style="color:var(--accent)">INCLUIDO</span></div>'
    +'<div class="mc-total"><span>TOTAL HOY</span><b>'+money(t.fee)+'</b></div>'
    +'<button class="btn btn-cut" id="payBtn"><i data-lucide="credit-card"></i>PAGAR '+money(t.fee)+'</button>'
    +'<p class="mono" style="margin-top:14px;font:500 10px/1.7 var(--mono);color:var(--dim);text-align:center">'+notaPago()+'</p></div>');
  $('#mClose').onclick=closeModal;
  $('#payBtn').onclick=e=>pagarO(e.currentTarget,{plan:'fee',fee_cents:Math.round(t.fee*100),name:t.name},()=>inscribirReal(t,team,tag));
}
function finishEnroll(t,team,tag){
  state.entered[t.id]=true;
  const tt=D().tournaments.find(x=>x.id===t.id);if(tt)tt.filled=Math.min(tt.slots||64,(tt.filled||0)+1);
  torneosCargar(true);
  openModal('<div class="success"><div class="ok">'+SVG_CHECK+'</div><h4>Tu equipo está dentro</h4><p>'+escHtml(team)+' ['+escHtml(tag)+'] · '+escHtml(t.name)+'<br>Fixture 24 h antes del inicio.<br>¡Nos vemos en el servidor!</p></div>');
  renderTournaments();toast('Inscripción confirmada: '+team+' ['+tag+']');
  vantsDiscord('torneo_inscripcion',{team,tag,tournament:t.name});
  if(typeof loadTeams==='function')setTimeout(loadTeams,900);
}

/* [ELIMINADO] Pase competitivo y pase premium: fuera del sitio por
   decisión del dueño (la sección #pase se removió de index.html). */

/* ================= MEMBRESÍAS ================= */
 $$('#planToggle button').forEach(b=>b.addEventListener('click',()=>{
  state.period=b.dataset.period;
  $$('#planToggle button').forEach(x=>x.classList.toggle('on',x===b));
  $$('[data-mo]').forEach(el=>el.textContent=el.dataset[state.period==='mo'?'mo':'yr']);
  $$('[data-per]').forEach(el=>el.textContent=state.period==='mo'?'/ MES':'/ AÑO');
  $$('[data-was]').forEach(el=>el.innerHTML=state.period==='yr'?'$59.88/año — ahorrás 33%':'&nbsp;');
}));
 $$('.plan-card [data-plan]').forEach(b=>b.addEventListener('click',()=>{
  const p=b.dataset.plan;
  if(p==='free'){toast('El plan FREE ya está activo en tu cuenta','info');return;}
  openPlanCheckout(p);
}));
const irAPro=()=>{const p=document.getElementById('pro');if(p)p.scrollIntoView({behavior:'smooth'});else location.href='index.html#pro';};
const plansBtnEl=$('#plansBtn');
if(plansBtnEl)plansBtnEl.addEventListener('click',irAPro);
const tableProBtnEl=$('#tableProBtn');
if(tableProBtnEl)tableProBtnEl.addEventListener('click',()=>state.isPro?null:irAPro());
const partnerBtnEl=$('#partnerBtn');
if(partnerBtnEl)partnerBtnEl.addEventListener('click',e=>{
  const b=e.currentTarget;
  if(!b.dataset.real){
    /* paso 1: pedir email/canal y registrar la solicitud */
    openModal('<div class="mc-head"><h3>Programa de socios</h3><button class="d-x" id="mClose"><i data-lucide="x"></i></button></div><div class="mc-body">'
      +'<p style="font:500 12px/1.7 var(--mono);color:var(--muted);margin-bottom:14px">Dejanos tu email y tu canal: la organización evalúa la solicitud y responde por correo a <b style="color:var(--accent)">geimerjhoan099@hotmail.com</b> (dirección oficial de la organización).</p>'
      +'<div class="field"><label>EMAIL DE CONTACTO</label><input id="pEmail" type="email" placeholder="vos@ejemplo.com"></div>'
      +'<div class="field"><label>CANAL PRINCIPAL (URL)</label><input id="pChan" type="url" placeholder="https://twitch.tv/tucanal"></div>'
      +'<button class="btn btn-cut" id="pSend" style="width:100%;justify-content:center"><i data-lucide="send"></i>ENVIAR SOLICITUD</button></div>');
    $('#mClose').onclick=closeModal;
    $('#pSend').onclick=()=>{
      const em=$('#pEmail').value.trim(),ch=$('#pChan').value.trim();
      if(!em||!em.includes('@')){toast('Ingresá un email válido','info');return;}
      b.dataset.real='1';b.disabled=true;b.innerHTML='<span class="spin"></span>ABRIENDO CORREO…';
      const asunto=encodeURIComponent('Solicitud programa de socios VANTS'),cuerpo=encodeURIComponent('Hola, quiero postularme al programa de socios de VANTS GAMES.\n\nEmail: '+em+'\nCanal: '+(ch||'(sin URL)')+'\n\nEnviado desde vants.games');
      setTimeout(()=>{window.location.href='mailto:geimerjhoan099@hotmail.com?subject='+asunto+'&body='+cuerpo;b.innerHTML=SVG_CHECK+'SOLICITUD ENVIADA';toast('Solicitud registrada: te contactamos a '+em,'info');},600);
    };
    return;
  }
});
function openPlanCheckout(plan){
  if(vantsEsOwner()){activatePlan(plan);return;}
  const cfg=plan==='pro'
    ?{n:'VANTS PRO',mo:4.99,yr:39.99}
    :{n:'VANTS CREATOR',mo:9.99,yr:79.99};
  const amount=state.period==='mo'?cfg.mo:cfg.yr;
  openModal('<div class="mc-head"><h3>'+cfg.n+'</h3><button class="d-x" id="mClose"><i data-lucide="x"></i></button></div><div class="mc-body">'
    +'<div class="mc-sum"><span>Membresía '+cfg.n+'</span><span>'+(state.period==='mo'?'MENSUAL':'ANUAL')+'</span></div>'
    +'<div class="mc-sum"><span>Insignia verificable en tu perfil</span><span style="color:var(--accent)">INCLUIDA</span></div>'
    +'<div class="mc-sum"><span>Cancelación</span><span>CUANDO QUIERAS</span></div>'
    +'<div class="mc-total"><span>TOTAL HOY</span><b>'+money(amount)+'</b></div>'
    +'<button class="btn btn-cut" id="payBtn"><i data-lucide="credit-card"></i>SUSCRIBIRME · '+money(amount)+'</button>'
    +'<p class="mono" style="margin-top:14px;font:500 10px/1.7 var(--mono);color:var(--dim);text-align:center">'+notaPago('sub')+'</p></div>');
  $('#mClose').onclick=closeModal;
  $('#payBtn').onclick=e=>pagarO(e.currentTarget,{plan,period:state.period},()=>activatePlan(plan));
}
function successBadge(title,txt,badge){
  openModal('<div class="success"><div class="ok">'+SVG_CHECK+'</div><h4>Bienvenido a '+title+'</h4><p>'+txt+'</p><div class="badge-reveal">'+badgeChip(badge,true)+'</div></div>');
  toast('Membresía activada: insignia emitida');
}

/* ================= SALA DE JUGADORES (datos reales de Neon) =================
   Sin plantillas demo: cada perfil lo crea el propio jugador al iniciar
   sesión y se lee del proxy público vantsdata. La ficha pública usa el
   MISMO diseño que el perfil real (CUENTA REAL VANTS), en solo lectura. */
window.VANTS_PLAYERS=[];
window.VANTS_STATS={};
const PROXY_PUBLICO='https://br-sweet-shape-b42xhogj-vantsdata.compute.c-6.us-east-2.aws.neon.tech/';
const escHtml=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badgesDeRol=p=>{const b=[];if(p.verified)b.push('verified');if(p.role==='owner'){b.push('owner');b.push('streamer');b.push('creator');}if(p.role==='admin')b.push('admin');if(p.role==='streamer')b.push('streamer');if(p.role==='creator')b.push('creator');if(p.role==='partner')b.push('partner');return b;};
/* Rango real: el rating de la base son los puntos ganados en FACEIT/Valorant,
   sin boost por rol. El tier y el color salen de esa escala (rankFor). */
function ratingDe(p){let r=(typeof p.rating==='number'&&p.rating>0)?p.rating:null;try{return r;}catch(e){return r;}}
function rankKeyDe(p){const r=ratingDe(p);try{return r==null?'fundicion':rankFor(r);}catch(e){return 'fundicion';}}

async function cargarJugadores(){
  try{
    let [rp,rs]=await Promise.all([
      fetch(PROXY_PUBLICO+'?table=players&limit=200',{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():[]).catch(()=>[]),
      fetch(PROXY_PUBLICO+'?table=season_player_stats&limit=500',{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():[]).catch(()=>[])
    ]);
    /* el proxy público (vantsdata) está caído (403): si hay sesión, leemos con el JWT
       directo de la Data API para que la sala y el ranking sigan vivos */
    if((!Array.isArray(rp)||!rp.length)&&window.VantAuth0&&window.VantAuth0.getToken){
      try{
        const t0=await window.VantAuth0.getToken();
        if(t0){
          const h={'Content-Type':'application/json',[AUTH_FIELD]:AUTH_SCHEME+t0};
          const [ap,as]=await Promise.all([
            fetch('https://ep-autumn-scene-b4opu2ip.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1/players?limit=200',{headers:h}).then(r=>r.ok?r.json():[]).catch(()=>[]),
            fetch('https://ep-autumn-scene-b4opu2ip.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1/season_player_stats?limit=500',{headers:h}).then(r=>r.ok?r.json():[]).catch(()=>[])
          ]);
          if(Array.isArray(ap)&&ap.length){rp=ap;rs=as;}
        }
      }catch(eAuth){}
    }
    const stats={};
    (Array.isArray(rs)?rs:[]).forEach(s=>{if(s&&s.player_id)stats[s.player_id]=s;});
    window.VANTS_STATS=stats;
    window.VANTS_PLAYERS=(Array.isArray(rp)?rp:[]).filter(p=>p&&p.id).sort((a,b)=>{
      const ra=(typeof a.rating==='number'&&a.rating>0)?a.rating:0,rb=(typeof b.rating==='number'&&b.rating>0)?b.rating:0;
      return rb!==ra?rb-ra:String(a.created_at||'').localeCompare(String(b.created_at||''));
    });
    renderProfileGrid();renderRail();renderLbHead();renderLbBody();renderDestacadosRail();
    if(window.vantsRefreshTeams)window.vantsRefreshTeams();
  }catch(e){/* sin conexión a la base: la sala queda en su último estado */}
}
window.vantsRecargarJugadores=cargarJugadores;

/* ================= RAIL DE CANALES ================= */
function renderRail(){
  const rail=$('#liveRail');if(!rail)return;
  const list=(window.VANTS_PLAYERS||[]).filter(p=>p.twitch_channel||p.kick_channel);
  const wrap=rail.closest('.reveal');
  if(wrap)wrap.style.display=list.length?'':'none';
  rail.innerHTML=list.map(p=>{
    const k=p.twitch_channel?'twitch':'kick',pl=PLAT[k],canal=String(p.twitch_channel||p.kick_channel).replace(/[^A-Za-z0-9_\-.]/g,'');
    return '<div class="rail-card" style="--plc:'+pl.c+';cursor:pointer" onclick="window.open(\'https://'+(k==='twitch'?'www.twitch.tv/':'kick.com/')+canal+'\',\'_blank\',\'noopener\')">'
      +'<div class="rc-top">'+platIc(k)
      +'<div class="rc-info"><div class="rc-name">'+escHtml((p.display_name||p.username||'JUGADOR').toUpperCase())
      +'<span class="live-chip"><i data-lucide="radio"></i>CANAL VINCULADO</span></div>'
      +'<p class="rc-title">Canal vinculado · '+escHtml(canal)+'</p></div></div>'
      +'<div class="rc-foot"><span class="rc-view"><i data-lucide="radio"></i><b>'+pl.n+'</b></span>'
      +'<span class="rc-game">VER CANAL</span></div></div>';
  }).join('');
  icons();
}

/* ================= GRID DE PERFILES ================= */
function renderProfileGrid(){
  const grid=$('#profileGrid');if(!grid)return;
  const list=window.VANTS_PLAYERS||[];
  if(!list.length){
    grid.innerHTML='<div style="grid-column:1/-1;border:1px dashed var(--line2,#303039);border-radius:12px;padding:40px 20px;text-align:center">'
      +'<p style="font:800 12px var(--mono);letter-spacing:.14em;color:var(--mut,#93939D)">AÚN NO HAY JUGADORES EN EL CIRCUITO</p>'
      +'<p style="font:500 11px/1.8 var(--mono);color:var(--dim,#5C5C66);margin-top:8px">Iniciá sesión, creá tu perfil y tu ficha aparece acá con tu rango, tus insignias y tus cuentas conectadas.</p></div>';
    icons();return;
  }
  grid.innerHTML=list.map(p=>{
    const k=rankKeyDe(p),rc=RANKS[k],st=window.VANTS_STATS[p.id]||{};
    const badges=badgesDeRol(p),mmr=(st.mmr!=null)?st.mmr:null;
    const live=!!(p.twitch_channel||p.kick_channel);
    const ava=p.avatar_url?'<img alt="" src="'+escHtml(p.avatar_url)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':escHtml((p.display_name||p.username||'V').slice(0,2).toUpperCase());
    const eq=(p.stats&&p.stats.equipo&&p.stats.equipo.nombre)?p.stats.equipo:null;
    const eqChip=eq?'<div style="display:flex;align-items:center;gap:7px;margin-top:9px;border:1px solid var(--line2,#303039);background:#0d0d10;padding:5px 8px">'
      +'<span style="width:22px;height:22px;flex:none;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#141419;font:800 8px var(--mono);color:var(--accent)">'+((eq.foto&&String(eq.foto).indexOf('data:image/')===0)?'<img src="'+eq.foto+'" alt="" style="width:100%;height:100%;object-fit:cover">':escHtml(String(eq.tag||'EQ').slice(0,3).toUpperCase()))+'</span>'
      +'<span style="font:700 9px var(--mono);letter-spacing:.08em;color:var(--mut,#93939D);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(String(eq.nombre).toUpperCase())+'</span></div>':'';
    /* banner del perfil del jugador (imagen editable en su cuenta) sobre la franja del card.
       SIN emblema de rango: el rango ya vive en pc-rank del propio card (D21). */
    const bFoto=(p.stats&&p.stats.banner_foto)?String(p.stats.banner_foto):'';
    const bImg=(bFoto&&/^data:image\//.test(bFoto))?'<img src="'+bFoto+'" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.62"><span style="position:absolute;inset:0;background:linear-gradient(115deg,rgba(8,9,12,.78),rgba(8,9,12,.18) 55%,rgba(8,9,12,.66))"></span>':'';
    return '<div class="pcard" style="--rc:'+rc.c1+'" onclick="openPlayerProfile(\''+p.id+'\')">'
      +'<div class="pc-banner">'+bImg+(vivoDe(p.id)?vivoChipHTML(vivoDe(p.id),true):'')+(live?'<span class="live-chip"><i data-lucide="radio"></i>CANAL VINCULADO</span>':'')+'</div>'
      +'<div class="pc-body"><span class="ava s1" style="--rc:'+rc.c1+'">'+ava+'</span>'
      +'<div class="pc-name">'+escHtml((p.display_name||p.username||'JUGADOR').toUpperCase())+'<small>'+escHtml(p.country||'—')+(p.region?' · '+escHtml(p.region):'')+'</small></div>'
      +'<div class="pc-badges">'+(badges.length?badges.map(b=>badgeChip(b)).join(''):'<span style="font:500 9px/1 var(--mono);color:var(--dim)">SIN INSIGNIAS — PLAN FREE</span>')+'</div>'
      +eqChip
      +'<div class="pc-rank">'+rankSVG(k,30)+'<div class="rk-name">'+rc.name+'</div><span class="rr mono">'+(mmr!=null?mmr:'—')+' MMR</span></div>'
      +'</div></div>';
  }).join('');
  icons();
}

/* ================= FICHA PÚBLICA DE JUGADOR =================
   Mismo diseño que el perfil real (CUENTA REAL VANTS), en solo lectura:
   banner con skin, insignias, stats, rango, cuentas conectadas y canal. */
function bannerPublicoHTML(sel,rawRank,foto){
  /* SIN emblema de rango en el banner: el rango ya vive en la sección RANGO
     de la ficha (rangoPublicoHTML) (D21). */
  const f=(foto&&String(foto).indexOf('data:image/')===0)?String(foto):'';
  return '<div class="pf-banner">'
    +(f?'<img src="'+f+'" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.6"><span style="position:absolute;inset:0;background:linear-gradient(115deg,rgba(8,9,12,.8),rgba(8,9,12,.3) 55%,rgba(8,9,12,.7))"></span>':'')
    +(sel==='bananim'?'<div style="position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(90deg,transparent,rgba(255,13,46,.30),transparent);animation:bnlight 2.6s linear infinite"></div>':'')
    +(sel==='dorado'?'<div style="position:absolute;inset:0;background:linear-gradient(120deg,rgba(58,44,7,.55),rgba(23,17,6,.2) 55%,rgba(42,32,5,.55))"></div>':'')
    +'</div>';
}
function rangoPublicoHTML(raw,mmr,wins,losses,xp){
  const xpExtra=xpFaceitHTML(xp);
  const wl=(wins||losses)?(wins+'V · '+losses+'D · '):'';
  try{
    if(raw==null)throw 0;
    const k=rankFor(raw),s=subFor(k,raw),rc=RANKS[k];
    const i=TIER_ORDER.indexOf(k);
    const hi=TIER_ORDER[i-1]?RANKS[TIER_ORDER[i-1]].lo:(RANKS[k].lo+1);
    const f=Math.max(0,Math.min(100,((raw-RANKS[k].lo)/(hi-RANKS[k].lo))*100));
    return '<p class="d-sec">RANGO</p><div class="pf-rank" style="--rc:'+rc.c1+'">'+rankSVG(k,64)
      +'<div class="info"><b>'+rc.name+(s?' '+s:'')+'</b><small>'+wl+'TEMPORADA ACTIVA</small>'
      +'<div class="rr-bar"><i style="width:'+f.toFixed(0)+'%;background:'+rc.c1+'"></i></div></div>'
      +'<div class="rr-num">'+(mmr!=null?mmr:'—')+'<small>MMR</small></div></div>'+xpExtra;
  }catch(e){
    return '<p class="d-sec">RANGO</p><div class="pf-rank" style="--rc:#5C5C66;opacity:.85">'+rankSVG('fundicion',64)
      +'<div class="info"><b>SIN RANGO</b><small>'+wl+'JUEGA TUS PARTIDAS DE PLACEMENT PARA OBTENER RANGO</small>'
      +'<div class="rr-bar"><i style="width:0%"></i></div></div>'
      +'<div class="rr-num">'+(mmr!=null?mmr:'—')+'<small>MMR</small></div></div>'+xpExtra;
  }
}
/* EXPERIENCIA FACEIT (migración 08: players.xp): +100 por victoria,
   +25 por empate; nivel = 1 + floor(xp/500). Marca FACEIT #FF5500. */
function xpFaceitHTML(xp){
  xp=(typeof xp==='number'&&xp>0)?xp:0;
  if(!xp)return '';
  const nivel=1+Math.floor(xp/500),en=xp%500,f=Math.min(100,en/5);
  return '<p class="d-sec">EXPERIENCIA FACEIT</p><div class="pf-rank" style="--rc:#FF5500">'
    +'<div class="info"><b>NIVEL '+nivel+'</b><small>'+xp+' XP TOTAL · '+en+'/500 PARA EL NIVEL '+(nivel+1)+'</small>'
    +'<div class="rr-bar"><i style="width:'+f.toFixed(0)+'%;background:#FF5500"></i></div></div>'
    +'<div class="rr-num">'+nivel+'<small>NIVEL</small></div></div>';
}
function openPlayerProfile(pid){
  /* UN SOLO PERFIL: la ficha de jugador para todos. Tu propia cuenta ve la
     MISMA ficha + la sección TU CUENTA (editar perfil/banner y ajustes). */
  const esMio=(function(){try{const a=window.VANTS_AUTH;if(!a||a.playerId==null)return false;const pidEf=(typeof pid==='object'&&pid)?pid.id:pid;return String(a.playerId)===String(pidEf);}catch(e){return false;}})();
  const p=(typeof pid==='object'&&pid)?pid:(window.VANTS_PLAYERS||[]).find(x=>String(x.id)===String(pid));
  if(!p){toast('No encontramos ese jugador','info');return;}
  /* UN SOLO PERFIL (MI CUENTA): tu propia ficha abre la versión editable
     completa — mismo drawer de PERFIL DE JUGADOR, sin editor aparte. */
  if(esMio&&window.vantsFichaPropia){try{window.vantsFichaPropia(p);return;}catch(ePf){}}
  const stats=p.stats||{},st=(window.VANTS_STATS[(p&&p.id!=null)?p.id:pid])||null;
  const k=rankKeyDe(p),rc=RANKS[k];
  const mmr=(st&&st.mmr!=null)?st.mmr:null;
  const wins=(st&&st.wins)||stats.wins||0,losses=(st&&st.losses)||stats.losses||0;
  const raw0=(typeof p.rating==='number'&&p.rating>0)?p.rating:((st&&st.rank!=null&&st.rank!==''&&!isNaN(parseFloat(st.rank))&&parseFloat(st.rank)>=.5&&parseFloat(st.rank)<=2)?parseFloat(st.rank):null);
  const raw=raw0;
  const mPart=(stats.matches!=null)?stats.matches:((wins+losses)>0?wins+losses:null);
  const mWr=((wins+losses)>0)?Math.round((wins/(wins+losses))*100):(stats.wr!=null?stats.wr:null);
  const mRtg=(raw!=null)?raw:(stats.rtg!=null?stats.rtg:null);
  const mKd=(stats.kd!=null)?stats.kd:null;
  const badges=badgesDeRol(p);
  const handles={discord:stats.discord_tag||((window.VANTS_LINKS&&window.VANTS_LINKS.discord)?window.VANTS_LINKS.discord.handle:null),twitch:p.twitch_channel||null,kick:p.kick_channel||null,youtube:stats.youtube||null,tiktok:stats.tiktok||null,x:stats.x||null,riot:stats.riot||null,steam:stats.steam||null,faceit:stats.faceit||((window.VANTS_LINKS&&window.VANTS_LINKS.faceit)?window.VANTS_LINKS.faceit.handle:null)};
  const eq=(stats&&stats.equipo&&stats.equipo.nombre)?stats.equipo:null;
  const eqStrip=eq?'<div style="display:flex;align-items:center;gap:10px;border:1px solid var(--line2,#303039);background:rgba(255,13,46,.05);padding:10px 12px;margin-bottom:14px">'
    +'<span style="width:44px;height:44px;flex:none;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#141419;font:800 13px var(--mono);color:var(--accent)">'+((eq.foto&&String(eq.foto).indexOf('data:image/')===0)?'<img src="'+eq.foto+'" alt="" style="width:100%;height:100%;object-fit:cover">':escHtml(String(eq.tag||'EQ').slice(0,3).toUpperCase()))+'</span>'
    +'<div style="min-width:0"><div style="font:800 12px var(--mono);letter-spacing:.08em;color:var(--ink,#EDEDE7)">'+escHtml(String(eq.nombre).toUpperCase())+'</div>'
    +'<div style="font:600 9px var(--mono);color:var(--mut,#93939D);margin-top:2px">EQUIPO DEL JUGADOR'+(eq.tag?' · '+escHtml(String(eq.tag).toUpperCase()):'')+'</div></div></div>':'';
  const canales=[];
  if(p.twitch_channel)canales.push({k:'twitch',h:String(p.twitch_channel).replace(/[^A-Za-z0-9_\-.]/g,'')});
  if(p.kick_channel)canales.push({k:'kick',h:String(p.kick_channel).replace(/[^A-Za-z0-9_\-.]/g,'')});
  const c=canales[0];
  const url=c?((c.k==='twitch'?'https://www.twitch.tv/':'https://kick.com/')+String(c.h).replace(/[^A-Za-z0-9_\-]/g,'')):null;
  openDrawer(
    '<div class="d-head"><span class="kicker">PERFIL DE JUGADOR</span><button class="d-x" onclick="closeDrawer()"><i data-lucide="x"></i></button></div>'
    +'<div class="d-body" style="--rc:'+rc.c1+'">'
    +bannerPublicoHTML(stats.banner||'',raw,stats.banner_foto)
    +'<div class="pf-head"><span class="ava s2" style="--rc:'+rc.c1+'">'+(p.avatar_url?'<img src="'+escHtml(p.avatar_url)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':escHtml((p.username||'V').slice(0,2).toUpperCase()))+'</span>'
      +'<div class="pf-id"><div class="pf-name">'+escHtml((p.display_name||p.username||'JUGADOR').toUpperCase())+'</div>'
      +'<p class="pf-sub">@'+escHtml(p.username||'')+' · '+escHtml(p.country||'—')+(p.region?' · '+escHtml(p.region):'')+' · MIEMBRO DESDE '+String(p.created_at||'2024').slice(0,4)+'</p></div></div>'
    +eqStrip
    +'<div class="pf-badges">'+(badges.length?badges.map(b=>badgeChip(b)).join(''):'<span class="mono" style="font:500 10px/1.6 var(--mono);color:var(--dim)">Sin insignias todavía.</span>')+'</div>'
    +'<p class="pf-bio">'+escHtml(stats.bio||'Jugador del circuito VANTS.')+'</p>'
    +'<div class="pf-stats"><div><b>'+(mPart==null?'—':escHtml(String(mPart)))+'</b><span>PARTIDOS</span></div><div><b>'+(mWr==null?'—':escHtml(String(mWr))+'%')+'</b><span>WINRATE</span></div><div><b>'+(mRtg==null?'—':(typeof mRtg==='number'?mRtg.toFixed(2):escHtml(String(mRtg))))+'</b><span>RATING</span></div><div><b>'+(mKd==null?'—':(typeof mKd==='number'?mKd.toFixed(2):escHtml(String(mKd))))+'</b><span>K/D</span></div></div>'
    +rangoPublicoHTML(raw,mmr,wins,losses,p.xp)
    +'<p class="d-sec">CUENTAS CONECTADAS</p><div class="plat-list">'+Object.keys(handles).map(kk=>platRow(kk,handles[kk]||null,false)).join('')+'</div>'
    +(c?'<p class="d-sec">TRANSMISIÓN</p><div class="rail-card" style="--plc:'+PLAT[c.k].c+';cursor:pointer" onclick="window.open(\''+url+'\',\'_blank\',\'noopener\')">'
      +'<div class="rc-top">'+platIc(c.k)+'<div class="rc-info"><div class="rc-name">'+escHtml((p.display_name||p.username||'JUGADOR').toUpperCase())+'</div><p class="rc-title">Canal vinculado · '+escHtml(c.h)+'</p></div></div>'
      +'<div class="rc-foot"><span class="rc-view"><i data-lucide="radio"></i><b>'+PLAT[c.k].n+'</b></span><span class="rc-game">VER CANAL</span></div></div>':'')
    +(esMio?'<p class="d-sec">TU CUENTA</p><div style="display:flex;flex-direction:column;gap:8px;margin-bottom:6px">'
      +'<button class="btn btn-ghost btn-sm" id="pfEditar" style="width:100%;justify-content:center;background:none;border:1px solid var(--line2);color:var(--ink);font:700 10px var(--mono);padding:11px;cursor:pointer;letter-spacing:.1em"><i data-lucide="pencil"></i>EDITAR PERFIL · BANNER · DATOS · EQUIPO</button>'
      +'<button class="btn btn-ghost btn-sm" id="pfAjustes" style="width:100%;justify-content:center;background:none;border:1px solid var(--line2);color:var(--ink);font:700 10px var(--mono);padding:11px;cursor:pointer;letter-spacing:.1em"><i data-lucide="settings"></i>AJUSTES DE CUENTA · EMAIL · CONTRASEÑA</button></div>'
    :'')
    +'</div>');
  icons();
  if(esMio){
    const eEd=document.querySelector('#pfEditar');if(eEd)eEd.onclick=()=>{if(window.vantsAbrirMiPerfil)window.vantsAbrirMiPerfil();else toast('Iniciá sesión para editar tu perfil','info');};
    const eAj=document.querySelector('#pfAjustes');if(eAj)eAj.onclick=()=>{if(window.openAjustesCuenta)window.openAjustesCuenta();};
  }
  /* CLIPS DESTACADOS del jugador (vitrina pública): se agregan cuando llegan
     del manifest, sin bloquear la apertura de la ficha */
  completarClipsFicha(p);
}

/* ================= CLIPS DESTACADOS · VITRINA PÚBLICA =================
   Los clips que los jugadores destacan desde VANTS CLIPS se publican en
   /api/clips/featured (índice en VANTSgg/vants-clips). Toda la arena los
   ve: rail bajo la Sala de jugadores y ficha pública de cada autor. */
let featCacheList=null,featCacheAt=0;
async function clipsDestacados(){
  if(featCacheList&&Date.now()-featCacheAt<60000)return featCacheList;
  try{
    const r=await fetchWorker('/api/clips/featured',{headers:{Accept:'application/json'}});
    const j=await r.json().catch(()=>null);
    featCacheList=(j&&j.ok&&Array.isArray(j.clips))?j.clips:[];
    featCacheAt=Date.now();
  }catch(e){ if(!featCacheList)featCacheList=[]; }
  return featCacheList;
}
function featDurTxt(s){s=parseInt(s,10)||0;if(!s)return'';const m=Math.floor(s/60),x=s%60;return m+':'+(x<10?'0':'')+x;}
function featFechaTxt(iso){try{return new Date(iso).toLocaleDateString('es',{day:'2-digit',month:'short',year:'numeric'})}catch(e){return''}}
function featCardHTML(c){
  const tt=escHtml(c.titulo||'Clip destacado'),nk=escHtml(c.nick||'JUGADOR');
  const dur=featDurTxt(c.dur),mb=(c.tam>0)?(c.tam/1048576).toFixed(1)+' MB':'';
  return '<div class="feat-card" data-fid="'+escHtml(c.id)+'" onclick="abrirClipPublico(\''+escHtml(c.id)+'\')">'
    +'<div class="feat-thumb">'+(c.thumb?'<img src="'+escHtml(c.thumb)+'" alt="" loading="lazy">':'<span class="feat-ph"><i data-lucide="film"></i></span>')
    +(dur?'<span class="feat-dur mono">'+dur+'</span>':'')+'<span class="feat-play"><i data-lucide="play"></i></span></div>'
    +'<div class="feat-info"><div class="feat-title" title="'+tt+'">'+tt+'</div>'
    +'<div class="feat-meta"><span class="feat-nk"><i data-lucide="user"></i>'+nk+'</span>'
    +'<span class="feat-gm">'+escHtml(c.juego||'VALORANT')+'</span>'
    +(mb?'<span>'+mb+'</span>':'')+'<span>'+featFechaTxt(c.fecha)+'</span></div></div></div>';
}
async function renderDestacadosRail(){
  const rail=$('#featRail');if(!rail)return;
  const sec=rail.closest('.reveal');
  const list=await clipsDestacados();
  if(sec)sec.style.display=(list&&list.length)?'':'none';
  if(!list||!list.length){rail.innerHTML='';return;}
  rail.innerHTML=list.slice(0,8).map(featCardHTML).join('');
  icons();
}
async function abrirClipPublico(fid){
  const list=await clipsDestacados();
  const c=(list||[]).find(x=>x&&x.id===fid);
  if(!c){toast('Ese clip ya no está destacado','info');return;}
  const autor=escHtml(c.nick||'JUGADOR'),tt=escHtml(c.titulo||'Clip destacado');
  openModal(
    '<div class="success feat-modal">'
    +'<div class="feat-mhead"><span class="kicker" style="color:var(--gold)">CLIP DESTACADO</span>'
    +'<h4 title="'+tt+'">'+tt+'</h4>'
    +'<p class="mono" style="font:600 10px var(--mono);color:var(--mut,#93939D);letter-spacing:.08em">POR '+autor+' · '+escHtml(c.juego||'VALORANT')+(featDurTxt(c.dur)?' · '+featDurTxt(c.dur):'')+'</p></div>'
    +'<div class="feat-player"><video src="'+escHtml(c.video||'')+'" controls autoplay playsinline preload="auto"></video></div>'
    +'<p class="mono" style="font:500 9.5px/1.7 var(--mono);color:var(--dim,#5C5C66)">Publicado desde VANTS CLIPS por la cuenta de '+autor+'. Los clips destacados son públicos en la Sala de jugadores.</p>'
    +'<div style="margin-top:12px"><button class="btn btn-ghost btn-sm" onclick="closeModal()"><i data-lucide="x"></i>CERRAR</button></div>'
    +'</div>');
  icons();
  const v=document.querySelector('#modalCard video');
  if(v)v.addEventListener('click',function(ev){ev.stopPropagation();});
}
async function completarClipsFicha(p){
  try{
    const list=await clipsDestacados();
    if(!list||!list.length)return;
    const mios=list.filter(c=>c&&(c.sub&&p.auth0_sub&&c.sub===p.auth0_sub)||(c.username&&p.username&&c.username.toLowerCase()===String(p.username).toLowerCase()));
    if(!mios.length)return;
    const body=document.querySelector('#drawer .d-body');
    if(!body||!body.isConnected)return;
    if(body.querySelector('.ficha-clips'))return;
    const sec=document.createElement('div');
    sec.className='ficha-clips';
    sec.innerHTML='<p class="d-sec">CLIPS DESTACADOS · '+mios.length+'</p>'
      +'<div class="feat-grid">'+mios.slice(0,4).map(featCardHTML).join('')+'</div>';
    body.appendChild(sec);
    icons();
  }catch(e){}
}
/* ABRIR MI PERFIL (helper único): con sesión abre la ficha editable
   (PERFIL DE JUGADOR); sin sesión devuelve false y el llamador ofrece ENTRAR. */
function abrirPerfilPropio(){
  try{
    var a=window.VANTS_AUTH;
    if(!a||!a.sub||!window.openPlayerProfile)return false;
    var mio=(window.VANTS_ME&&window.VANTS_ME.player)||null;
    if(!mio&&a.playerId){mio=(window.VANTS_PLAYERS||[]).find(function(x){return String(x.id)===String(a.playerId);})||null;}
    if(mio){window.openPlayerProfile(mio);return true;}
  }catch(e){}
  return false;
}
/* VER MI PERFIL abre SIEMPRE el PERFIL DE JUGADOR; sin sesión, manda al login */
const meStripBtnEl=$('#meStripBtn');
if(meStripBtnEl)meStripBtnEl.addEventListener('click',()=>{
  if(abrirPerfilPropio())return;
  const lb=$('#arenaLoginBtn');
  if(lb&&!lb.hidden){lb.click();return;}
  toast('Ingresá con ENTRAR para crear tu perfil de jugador','info');
});
/* VER MI PERFIL (cta de la sección RANGOS): manda al PERFIL DE JUGADOR */
const rankedReportBtn=$('#rankedReportBtn');
if(rankedReportBtn)rankedReportBtn.addEventListener('click',()=>{
  if(abrirPerfilPropio())return;
  const lb=$('#arenaLoginBtn');
  if(lb&&!lb.hidden){lb.click();return;}
  toast('Ingresá con ENTRAR para reportar tu serie','info');
});

/* ================= DRAWER DE PERFIL ================= */
function platRow(k,handle,own){
  const p=PLAT[k];
  const rl=(own&&window.VANTS_LINKS&&window.VANTS_LINKS[k])||null;
  const h=rl?rl.handle:handle;
  const connected=!!h;
  const estado=rl&&!rl.verified?'CONECTADO · MANUAL':'CONECTADO';
  return '<div class="plat-row'+(connected?'':' off')+'" style="--pc:'+p.c+'">'
    +platIc(k)
    +'<div class="plat-info"><b>'+p.n+'</b><small>'+(p.k==='game'?'CUENTA DE JUEGO':'RED SOCIAL')+' · '+(connected?escHtml(h):'NO CONECTADA')+'</small></div>'
    +(connected
      ?(own?'<button class="plat-x" onclick="disconnect(\''+k+'\')" title="Desconectar"><i data-lucide="x"></i></button>':'')
        +'<span class="plat-state">'+SVG_CHECK.replace('<svg','<svg width="12" height="12"')+estado+'</span>'
      :(own?'<button class="plat-connect" onclick="connect(\''+k+'\')">CONECTAR</button>':'<span class="mono" style="font:600 9px/1 var(--mono);color:var(--dim)">—</span>'))
    +'</div>';
}
/* [ELIMINADO] drawer de perfil demo: el ÚNICO diseño de perfil es el real
   (arena-live.js · CUENTA REAL VANTS). Se quitaron los connect/disconnect
   falsos, el editor de nick local, el "modo EN DIRECTO" demo y el ticker de
   espectadores inventados. Los conectores reales siguen más abajo. */

/* ================= SECCIÓN RANGOS ================= */
function renderRanks(){
  if(!document.getElementById('rankGrid'))return;
  $('#rankGrid').innerHTML=TIER_ORDER.map(k=>{
    const r=RANKS[k];
    const lo=k==='fundicion'?'0':Math.round(r.lo*100)+' RR';
    const hi=k==='vants'?'∞':Math.round((RANKS[TIER_ORDER[TIER_ORDER.indexOf(k)-1]]?RANKS[TIER_ORDER[TIER_ORDER.indexOf(k)-1]].lo:r.lo+1)*100)+' RR';
    return '<div class="rank-card'+(k==='vants'?' apex':'')+'" style="--r1:'+r.c1+';--r2:'+r.c2+'">'
      +'<span class="remblem" style="display:block">'+rankSVG(k,84)+'</span>'
      +'<h4>'+r.name+'</h4><span class="subs">'+(k==='vants'?'APEX':'I · II · III')+'</span>'
      +'<span class="rr">'+lo+' — '+hi+'</span></div>';
  }).join('');
}

/* ================= CINEMATIC ================= */
let cinRAF=null;
function startCinCanvas(){
  const cv=$('#cinCanvas'),cx=cv.getContext('2d');
  cv.width=innerWidth;cv.height=innerHeight;
  const pts=Array.from({length:150},()=>({z:Math.random(),s:Math.random()*1.6+.4,o:Math.random()*6.28}));
  let t=0;
  const step=()=>{
    t+=.004;cx.clearRect(0,0,cv.width,cv.height);
    const cxm=cv.width/2,cym=cv.height/2;
    pts.forEach(p=>{
      const ang=t*(.4+p.z*.7)+p.o,r=(1-p.z)*Math.min(cv.width,cv.height)*.55+40;
      cx.globalAlpha=.12+p.z*.55;cx.fillStyle=p.z>.62?'#FF0D2E':'#EDEDE7';
      cx.beginPath();cx.arc(cxm+Math.cos(ang)*r*1.5,cym+Math.sin(ang)*r*.72,p.s,0,7);cx.fill();});
    cinRAF=requestAnimationFrame(step);
  };step();
}
function stopCinCanvas(){if(cinRAF)cancelAnimationFrame(cinRAF);cinRAF=null;}
function openCin(){
  const c=$('#cin');if(!c)return;c.classList.add('show');
  requestAnimationFrame(()=>c.classList.add('play'));
  startCinCanvas();
}
function closeCin(){
  const c=$('#cin');if(!c||!c.classList.contains('show'))return;
  c.classList.remove('play');stopCinCanvas();
  setTimeout(()=>c.classList.remove('show'),200);
}
const cinSkipEl=$('#cinSkip');
if(cinSkipEl)cinSkipEl.addEventListener('click',closeCin);
const cinEnterEl=$('#cinEnter');
if(cinEnterEl)cinEnterEl.addEventListener('click',()=>{closeCin();const h=document.getElementById('inicio');if(h)h.scrollIntoView({behavior:'smooth'});});
const cinStoryEl=$('#cinStory');
if(cinStoryEl)cinStoryEl.addEventListener('click',()=>{closeCin();const h=document.getElementById('historia');if(h)h.scrollIntoView({behavior:'smooth'});else location.href='historia.html';});
const filmBtnEl=$('#filmBtn');
if(filmBtnEl)filmBtnEl.addEventListener('click',openCin);
const filmCardEl=$('#filmCard');
if(filmCardEl)filmCardEl.addEventListener('click',openCin);

/* ================= AGENDA EN VIVO (opcional) =================
   Si el Worker tiene el secret HENRIKDEV_API_KEY, /api/valorant/esports
   devuelve el calendario esports real de api.henrikdev.xyz. Si la clave no
   está configurada o el upstream falla, la agenda conserva los partidos
   reales verificados de vlr.gg (nada se rompe). */
async function agendaEnVivo(){
  if(state.game!=='valorant')return;
  try{
    const ctrl=new AbortController();const to=setTimeout(()=>ctrl.abort(),4000);
    const r=await fetchWorker('/api/valorant/esports',{headers:{Accept:'application/json'},signal:ctrl.signal});
    clearTimeout(to);
    if(!r.ok)return;
    const j=await r.json().catch(()=>null);
    const src=j&&j.data&&(Array.isArray(j.data.schedule)?j.data.schedule:(Array.isArray(j.data)?j.data:null));
    if(!src||!src.length)return;
    const map=src.slice(0,6).map(m=>{
      const eq=(m&&m.teams?m.teams:[]).map(x=>(x&&(x.name||x.code))||x).filter(Boolean);
      if(eq.length<2)return null;
      const f=m.start_time?new Date(m.start_time):null;
      const t=f&&isNaN(f.getTime())?'—':f.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit',hour12:false});
      const ev=(m.tournament&&(m.tournament.name||m.tournament))||'CIRCUITO PRO';
      const url=(typeof m.vlr_url==='string'&&m.vlr_url.indexOf('vlr.gg')>-1)?m.vlr_url:((typeof m.url==='string'&&m.url.indexOf('vlr.gg')>-1)?m.url:null);
      return {t,status:'up',a:String(eq[0]).toUpperCase().slice(0,24),b:String(eq[1]).toUpperCase().slice(0,24),sa:null,sb:null,map:'Serie',bo:'BO3',ev:String(ev).slice(0,80),real:true,url};
    }).filter(Boolean);
    if(!map.length)return;
    D().matches=map.concat(D().matches.filter(m=>m.status==='final'));
    renderMatches();
    const n=$('#agendaNote');if(n)n.innerHTML='Agenda <b>EN VIVO</b> (HenrikDev API) + resultados reales de vlr.gg · hora de Caracas.';
  }catch(e){/* sin clave/red: queda la agenda verificada */}
}

/* ================= CAMBIO DE JUEGO ================= */
function renderAll(){
  if(!document.getElementById('heroTitle'))return;
  const d=D();
  document.body.dataset.game=state.game;
  renderTicker();
  $('#heroTitle').innerHTML=d.title;
  $('#heroSub').textContent=d.sub;
  $('#gbNext').innerHTML='<b>'+d.short+'</b>INSCRIPCIONES ABIERTAS';
  $('#liveNameA').textContent=d.live.a;$('#liveNameB').textContent=d.live.b;
  $('#liveTagA').textContent=d.live.ta;$('#liveTagB').textContent=d.live.tb;
  $('#liveEvent').textContent=d.live.ev;
  renderMatches();renderLbHead();renderLbBody();renderBracket();renderTournaments();renderRail();
  icons();
}
 $$('.gbtn').forEach(b=>b.addEventListener('click',()=>{
  if(state.game===b.dataset.game)return;
  state.game=b.dataset.game;
  $$('.gbtn').forEach(x=>x.classList.toggle('on',x===b));
  renderAll();renderLive();
}));

/* ================= INIT ================= */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.08});
 $$('.reveal').forEach(el=>io.observe(el));
renderRanks();renderProfileGrid();renderAccount();renderAll();renderLive();cargarJugadores();agendaEnVivo();renderDestacadosRail();
if(document.getElementById('cin')&&!sessionStorage.getItem('vants_film')){sessionStorage.setItem('vants_film','1');setTimeout(openCin,700);}

/* ================= FOTO DE PERFIL + DISCORD ================= */
PICON.discord='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.32 4.37a19.8 19.8 0 0 0-4.93-1.51 13.8 13.8 0 0 0-.64 1.28 18.3 18.3 0 0 0-5.5 0 12.6 12.6 0 0 0-.64-1.28c-1.71.29-3.37.8-4.93 1.51A20.3 20.3 0 0 0 .1 18.06a19.9 19.9 0 0 0 6.07 3.06c.49-.66.93-1.37 1.3-2.1a12.9 12.9 0 0 1-2.05-.98c.17-.12.34-.25.5-.38a14.2 14.2 0 0 0 12.16 0c.17.13.33.26.5.38-.65.38-1.34.71-2.05.98.37.73.8 1.44 1.3 2.1a19.8 19.8 0 0 0 6.07-3.06 20.2 20.2 0 0 0-3.58-13.69ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Zm7.96 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Z"/></svg>';
PLAT.discord={n:'DISCORD',c:'#5865F2',k:'social'};

me.avatar=me.avatar||null; me.discordTag=me.discordTag||null;

/* persistencia del perfil (sobrevive al cierre del navegador) */
function meSave(){try{localStorage.setItem('vants_me',JSON.stringify({name:me.name,avatar:me.avatar,discordTag:me.discordTag,socials:me.socials,game:me.game,live:me.live}))}catch(e){}}
function meLoad(){try{const s=JSON.parse(localStorage.getItem('vants_me')||'null');if(s)Object.assign(me,s)}catch(e){}}

/* [ELIMINADO] avatar local + consentimiento de Discord simulado: la foto viene
   del proveedor de sesión (guardada en players.avatar_url) y Discord se conecta
   con el linker real, como el resto de las plataformas. El tag de Discord se
   edita en MIS DATOS del perfil real. */

/* ================= CONECTORES DE CUENTAS (Auth0 + Neon + linker OAuth) =================
   Identidad: JWT de Auth0 · Guardado: tabla vants_links en Neon · OAuth real: Neon Function "linker".
   Sin claves de una red, CONECTAR ofrece vinculo manual (queda en Neon con etiqueta MANUAL). */
window.VANTS_LINKS={};
const LINKER=()=>((window.VantAuth0&&window.VantAuth0.LINKER_BASE)||'').replace(/\/$/,'');
const LINKS_API='https://ep-autumn-scene-b4opu2ip.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';

async function linksCargar(){
  const A=window.VantAuth0;
  if(!A||!A.client)return window.VANTS_LINKS;
  try{
    const u=await A.client.getUser();
    if(!u||!u.sub)return window.VANTS_LINKS;
    const t=await A.getToken();
    if(!t)return window.VANTS_LINKS;
    const r=await fetch(LINKS_API+'/vants_links?auth0_sub=eq.'+encodeURIComponent(u.sub)+'&select=*',{headers:{Accept:'application/json',[AUTH_FIELD]:AUTH_SCHEME+t}});
    const filas=r.ok?await r.json():[];
    const mapa={};
    (filas||[]).forEach(f=>{mapa[f.platform]=f;});
    window.VANTS_LINKS=mapa;
  }catch(e){/* sin Neon: siguen los handles demo */}
  return window.VANTS_LINKS;
}
window.linksCargar=linksCargar;

async function playerPidActual(){
  try{
    const A=window.VantAuth0;const t=await A.getToken();
    const r=await fetch(LINKS_API+'/rpc/current_player_id',{method:'POST',headers:{[AUTH_FIELD]:AUTH_SCHEME+t,'Content-Type':'application/json'},body:'{}'});
    let pj=await r.json();
    pj=Array.isArray(pj)?pj[0]:pj;
    return (pj&&(pj.current_player_id||pj.id))||null;
  }catch(e){return null;}
}

function openLoginModal(k){
  openModal('<div class="lk">'
    +'<div class="lk-head">'+platIc(k)+'<div><b>Para conectar '+PLAT[k].n+'</b><span>Necesitás tu sesión de VANTS activa</span></div></div>'
    +'<p class="lk-note">El vínculo se guarda en tu cuenta (tabla vants_links en Neon) con tu sesión de Auth0. Iniciá sesión y volvé a intentar.</p>'
    +'<div class="dc-actions"><button class="dc-btn ghost" id="lkCancel">Después</button><button class="dc-btn" id="lkGo">INICIAR SESIÓN</button></div></div>');
  $('#lkCancel').onclick=closeModal;
  $('#lkGo').onclick=()=>{closeModal();const lb=document.getElementById('arenaLoginBtn');if(lb)lb.click();else toast('Ingresá con el botón INGRESAR de la navegación','info');};
}

function openLinkManual(k,sub){
  openModal('<div class="lk">'
    +'<div class="lk-head">'+platIc(k)+'<div><b>Conectar '+PLAT[k].n+'</b><span>Se guarda en tu cuenta VANTS (Neon)</span></div></div>'
    +'<p class="lk-note">El OAuth de '+PLAT[k].n+' todavía no tiene claves en el servidor (Neon → Functions → linker). Podés vincularla ahora: queda con etiqueta MANUAL y pasa a verificada cuando se carguen las claves.</p>'
    +'<input id="lkHandle" maxlength="40" placeholder="Tu usuario en '+PLAT[k].n+' (p. ej. @mynick)">'
    +'<div class="dc-actions"><button class="dc-btn ghost" id="lkCancel">Cancelar</button><button class="dc-btn" id="lkSave">VINCULAR</button></div>'
    +'<div id="lkMsg" class="lk-msg"></div></div>');
  $('#lkCancel').onclick=closeModal;
  $('#lkSave').onclick=async e=>{
    const b=e.currentTarget;
    const h=$('#lkHandle').value.trim().replace(/["'<>\\]/g,'');
    const msg=$('#lkMsg');
    if(!h){msg.textContent='Escribí tu usuario de '+PLAT[k].n;return;}
    b.disabled=true;b.textContent='GUARDANDO…';
    try{
      const pid=await playerPidActual();
      const {error}=await VantDB.from('vants_links').upsert({auth0_sub:sub,player_id:pid,platform:k,handle:h,verified:false},{onConflict:'auth0_sub,platform'});
      if(error)throw error;
      window.VANTS_LINKS[k]={auth0_sub:sub,player_id:pid,platform:k,handle:h,verified:false};
      closeModal();toast(PLAT[k].n+' vinculado (manual): '+h);
      if(window.vantsAbrirMiPerfil)window.vantsAbrirMiPerfil();
    }catch(err){
      b.disabled=false;b.textContent='VINCULAR';
      msg.textContent='Neon rechazó el guardado ('+((err&&err.message)||err)+'). Corré docs/migracion-links.sql en el SQL Editor de Neon.';
    }
  };
}

window.connect=async k=>{
  const A=window.VantAuth0;
  let sub=null,tok=null;
  if(A&&A.client){try{const u=await A.client.getUser();sub=u&&u.sub;tok=sub?await A.getToken():null;}catch(e){}}
  if(!tok){openLoginModal(k);return;}
  toast('Conectando '+PLAT[k].n+'…','info');
  const lb=LINKER();
  if(lb){
    try{
      const r=await fetch(lb+'/api/link/start',{method:'POST',headers:{'Content-Type':'application/json',[AUTH_FIELD]:AUTH_SCHEME+tok},body:JSON.stringify({platform:k,return_to:location.origin+location.pathname})});
      const d=await r.json().catch(()=>null);
      if(d&&d.url){sessionStorage.setItem('vants_linking',k);location.href=d.url;return;}
      if(d&&d.error==='falta_clave')toast(PLAT[k].n+': falta la clave '+d.env+' en Neon (Functions → linker). Usá el vínculo manual por ahora.','info');
      else if(d&&d.error==='sin_sesion'){openLoginModal(k);return;}
    }catch(e){/* sin linker: cae al vínculo manual */}
  }
  openLinkManual(k,sub);
};

window.disconnect=async k=>{
  delete me.socials[k];delete me.game[k];
  const A=window.VantAuth0;
  if(A&&A.client){
    try{
      const u=await A.client.getUser();
      if(u&&u.sub){
        const {error}=await VantDB.from('vants_links').delete().eq('auth0_sub',u.sub).eq('platform',k);
        if(!error)delete window.VANTS_LINKS[k];
      }
    }catch(e){/* el handle demo ya se borró arriba */}
  }
  meSave();toast('Cuenta desconectada: '+PLAT[k].n,'info');if(window.vantsAbrirMiPerfil)window.vantsAbrirMiPerfil();
};

/* nav con foto — usa el PERFIL REAL (Neon) cuando la sesión está cargada;
   el objeto local `me` queda solo de respaldo */
function renderAccount(){
  const a=$('#accAva');if(!a)return;
  const real=(window.VANTS_ME&&window.VANTS_ME.player)||null;
  const nombre=real?String(real.display_name||real.username||me.name||''):String(me.name||'');
  const foto=real?(real.avatar_url||null):me.avatar;
  const k=rankFor(0.96+me.rr/1000);
  a.style.setProperty('--rc',RANKS[k].c1);
  a.innerHTML=foto?'<img alt="" src="'+escHtml(foto)+'">':(nombre||'V').slice(0,2).toUpperCase();
  const nm=$('#accName');if(nm)nm.textContent=nombre.toUpperCase();
  const lv=$('#accLive');if(lv)lv.style.display=me.live?'block':'none';
  a.style.filter=me.live?'drop-shadow(0 0 8px rgba(255,13,46,.8))':'';
}

/* [ELIMINADO] segunda versión del drawer demo (la que reemplazaba a la
   primera): con el perfil real de arena-live.js como diseño único ya no hay
   drawer demo. El nick se edita en AJUSTES DE CUENTA (openAjustesCuenta). */

/* aplicar perfil guardado */
meLoad();renderAccount();icons();

/* ====== PUENTE WEB → BOT DE DISCORD ======
   URL absoluta del Worker (Cloudflare): funciona igual servido desde
   Workers, desde GitHub Pages o en local (donde falla silenciosamente). */
function vantsDiscord(type, data){
  const body=JSON.stringify({ type, data });
  const send=i=>{
    if(i>=WORKER_BASES.length)return; // si no hay servidor, no rompe nada
    fetch(WORKER_BASES[i]+'/api/discord/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    }).catch(()=>send(i+1));
  };
  send(0);
}

/* ============================================================
   MENÚ CAJÓN · CATEGORÍAS (estilo Razer)
   Cajón derecho con las categorías de la arena en filas:
   COMPETIR / COMUNIDAD / IDENTIDAD / MEMBRESÍA.
   ============================================================ */
function openMenu(){
  /* MENÚ SOLO PARA JUGADORES REGISTRADOS: sin sesión, no se abre el cajón.
     Se invita a entrar con ENTRAR (login Auth0) igual que el resto de la arena. */
  if(!(window.VANTS_AUTH&&window.VANTS_AUTH.sub)){
    if(typeof toast==='function')toast('Iniciá sesión con tu cuenta para abrir el MENÚ','info');
    const lb=$('#arenaLoginBtn');
    if(lb&&!lb.hidden){try{lb.click()}catch(e){}}
    return;
  }
  const d=$('#menuDrawer');if(!d)return;d.classList.add('show');const o=$('#menuOv');if(o)o.classList.add('show');icons();
}
function closeMenu(){const d=$('#menuDrawer');if(!d)return;d.classList.remove('show');const o=$('#menuOv');if(o)o.classList.remove('show');}
(function wireMenu(){
  const b=$('#menuBtn');if(!b)return;
  b.addEventListener('click',openMenu);
  const c=$('#menuClose');if(c)c.addEventListener('click',closeMenu);
  const ov=$('#menuOv');if(ov)ov.addEventListener('click',closeMenu);
  const mp=$('#mdPerfil');if(mp)mp.addEventListener('click',function(e){e.preventDefault();closeMenu();if(abrirPerfilPropio())return;const lb=$('#arenaLoginBtn');if(lb&&!lb.hidden){lb.click();return;}if(typeof toast==='function')toast('Iniciá sesión para abrir tu perfil de jugador','info');});
  $$('#menuDrawer [data-md-close]').forEach(el=>el.addEventListener('click',closeMenu));
})();

/* ============================================================
   EQUIPOS ASOCIADOS · INSCRIPCIÓN EN VIVO
   Fuente: GET /api/teams-live (el Worker lee los anuncios "🏆 Nueva
   inscripción" del canal de Discord) + merge con las inscripciones
   locales (mismo dispositivo) para que tu equipo se vea al instante.
   ============================================================ */
const K_TEAMS_API='vants_teams_v1';
let teamsChampions=[];
let teamsUltimos=null;
/* FOTO DE EQUIPO viva: los perfiles guardan stats.equipo={nombre,tag,foto};
   si el tag o el nombre de un equipo inscrito coincide con el de un perfil,
   el mosaico muestra su foto en vez de las iniciales. */
function mapaFotosEquipos(){
  const m=new Map();
  (window.VANTS_PLAYERS||[]).forEach(p=>{
    const e=p&&p.stats&&p.stats.equipo;
    if(e&&typeof e.foto==='string'&&e.foto.indexOf('data:image/')===0){
      if(e.tag)m.set(String(e.tag).toLowerCase(),e.foto);
      if(e.nombre)m.set(String(e.nombre).toLowerCase(),e.foto);
    }
  });
  return m;
}
window.vantsRefreshTeams=function(){if(teamsUltimos)renderTeamsGrid(teamsUltimos);};
function escTeams(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function teamsLocal(){
  try{
    const a=JSON.parse(localStorage.getItem('vants_feed_v1')||'null');
    if(Array.isArray(a))return a.slice(0,8).map(r=>({team:String(r.t||'EQUIPO'),tag:String(r.g||'VNTS'),tournament:String(r.to||'ASCENSIÓN SERIES S4'),ts:r.ts?new Date(r.ts).toISOString():null}));
  }catch(e){}
  return[];
}
function tiempoAtras(iso){
  if(!iso)return'';
  const s=(Date.now()-new Date(iso).getTime())/1000;
  if(!isFinite(s)||s<0)return'';
  if(s<60)return 'hace instantes';if(s<3600)return 'hace '+Math.floor(s/60)+' min';
  if(s<86400)return 'hace '+Math.floor(s/3600)+' h';return 'hace '+Math.floor(s/86400)+' d';
}
function renderTeamsGrid(list){
  const grid=$('#teamsGrid');if(!grid)return;
  teamsUltimos=list;
  const champs=new Map(teamsChampions.map(c=>[String(c.team||'').toLowerCase(),c]));
  const fotos=mapaFotosEquipos();
  let html='';
  if(!list.length){
    html='<div class="teams-empty"><b>TODAVÍA NO HAY EQUIPOS ASOCIADOS</b><span>Sé el primero: cuando inscribes tu equipo aparece acá al instante y se anuncia en el Discord de la arena.</span></div>';
  }else{
    html=list.map(r=>{
      const ini=(String(r.tag||r.team||'V').replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase())||'V';
      const c=champs.get(String(r.team||'').toLowerCase());
      const foto=fotos.get(String(r.tag||'').toLowerCase())||fotos.get(String(r.team||'').toLowerCase())||null;
      const ava=foto
        ?'<span class="tt-ava" style="overflow:hidden"><img src="'+foto+'" alt="" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.parentNode.textContent=&quot;'+escTeams(ini)+'&quot;"></span>'
        :'<span class="tt-ava">'+escTeams(ini)+'</span>';
      const when=tiempoAtras(r.ts);
      return '<div class="team-tile">'+ava
        +'<div class="tt-info"><span class="tt-tag">'+escTeams(String(r.team||'EQUIPO').slice(0,22))+'</span>'
        +'<span class="tt-name">'+escTeams(r.tag)+' · '+escTeams(String(r.tournament||'TEMPORADA 4').slice(0,36))+'</span>'
        +'<span class="tt-meta">'+(when?'<span class="tt-live"><i></i>INSCRITO '+escTeams(when).toUpperCase()+'</span>':'<span>ASOCIADO</span>')+'</span></div>'
        +(c?'<span class="tt-crown">👑 ×'+Number(c.wins||1)+'</span>':'')
        +'</div>';
    }).join('');
  }
  html+='<button class="team-tile tt-cta" id="teamsJoin" type="button"><i data-lucide="swords"></i><b>TU EQUIPO AQUÍ</b><span>INSCRIBIR EN LA TEMPORADA 4 →</span></button>';
  grid.innerHTML=html;
  const jb=$('#teamsJoin');if(jb)jb.addEventListener('click',()=>{const h=$('#heroJoin');if(h)h.click();});
  icons();
}
async function loadTeams(){
  const grid=$('#teamsGrid');if(!grid)return;
  renderTeamsGrid(teamsLocal());
  let api=null;
  try{
    const c=JSON.parse(sessionStorage.getItem(K_TEAMS_API)||'null');
    if(c&&c.at&&(Date.now()-c.at)<60000&&c.data)api=c.data;
  }catch(e){}
  if(!api){
    try{
      const r=await fetchWorker('/api/teams-live',{headers:{'Accept':'application/json'}});
      if(r.ok)api=await r.json();
    }catch(e){}
    if(api){try{sessionStorage.setItem(K_TEAMS_API,JSON.stringify({at:Date.now(),data:api}))}catch(e){}}
  }
  if(!api||!api.ok)return;
  teamsChampions=Array.isArray(api.champions)?api.champions:[];
  const local=teamsLocal();
  const seen=new Set(local.map(r=>(String(r.tag)+'|'+String(r.team)).toLowerCase()));
  const remote=(Array.isArray(api.teams)?api.teams:[]).filter(r=>{
    const k=(String(r.tag)+'|'+String(r.team)).toLowerCase();
    if(seen.has(k))return false;seen.add(k);return true;
  });
  renderTeamsGrid(local.concat(remote).slice(0,18));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadTeams);else loadTeams();

/* ============================================================
   GPR · GLOBAL POWER RANKINGS (sección #gpr)
   Snapshot real 18·10·2026 · Fuente: Global Power Rankings — Riot Games
   (valorantesports.com/es-ES/gpr/2026/current). Regiones colapsables
   estilo valorantesports: cabecera con ∇ que rota al abrir.
   ============================================================ */
const GPR_DATA=[
 {id:'vct_americas',n:'VCT AMÉRICAS',fz:1540,equipos:[
   {n:"Leviatán Esports",t:"LEV",p:1498},{n:"NRG",t:"NRG",p:1482},{n:"LOUD",t:"LOUD",p:1481},
   {n:"100 Thieves",t:"100T",p:1463},{n:"G2 Esports",t:"G2",p:1436},{n:"MIBR",t:"MIBR",p:1314},
   {n:"ENVY",t:"ENVY",p:1238},{n:"Cloud9",t:"C9",p:1210},{n:"Sentinels",t:"SEN",p:1208},
   {n:"KRÜ Visa",t:"KRU",p:1205},{n:"Evil Geniuses",t:"EG",p:1188},{n:"FURIA",t:"FUR",p:1180}
]},
 {id:'vct_pacific',n:'VCT PACIFIC',fz:1440,equipos:[
   {n:"Paper Rex",t:"PRX",p:1403},{n:"GLOBAL ESPORTS",t:"GE",p:1403},{n:"T1",t:"T1",p:1386},
   {n:"NONGSHIM REDFORCE",t:"NS",p:1364},{n:"Gen.G ",t:"GEN",p:1292},{n:"VARREL",t:"VL",p:1274},
   {n:"DetonatioN FocusMe",t:"DFM",p:1270},{n:"Kiwoom DRX",t:"KRX",p:1262},{n:"Rex Regum Qeon",t:"RRQ",p:1254},
   {n:"FULL SENSE",t:"FS",p:1228},{n:"ZETA DIVISION",t:"ZETA",p:1197},{n:"Team Secret",t:"TS",p:1141}
]},
 {id:'vct_emea',n:'VCT EMEA',fz:1397,equipos:[
   {n:"Team Vitality",t:"VIT",p:1405},{n:"Karmine Corp",t:"KC",p:1395},{n:"Team Liquid",t:"TL",p:1348},
   {n:"Team Heretics",t:"TH",p:1271},{n:"FNATIC",t:"FNC",p:1260},{n:"BBL Esports",t:"BBL",p:1259},
   {n:"FUT Esports",t:"FUT",p:1256},{n:"Eternal Fire",t:"EF",p:1247},{n:"NAVI",t:"NAVI",p:1207},
   {n:"Gentle Mates",t:"M8",p:1199},{n:"GIANTX",t:"GX",p:1164},{n:"PCIFIC Esports",t:"PCF",p:1087}
]},
 {id:'vct_china',n:'VCT CHINA',fz:1223,equipos:[
   {n:"TYLOO GAMING",t:"TYL",p:1269},{n:"EDWARD Gaming",t:"EDG",p:1215},{n:"ALL GAMERS",t:"AG",p:1173},
   {n:"Xi Lai Gaming",t:"XLG",p:1172},{n:"Bilibili Gaming",t:"BLG",p:1168},{n:"JD GAMING",t:"JDG",p:1164},
   {n:"NOVA ESPORTS",t:"NOVA",p:1148},{n:"DRAGON RANGER GAMING",t:"DRG",p:1147},{n:"FunPlus Phoenix",t:"FPX",p:1114},
   {n:"WOLVES ESPORTS",t:"WOL",p:1109},{n:"Trace Esports",t:"TE",p:1071},{n:"TITAN ESPORTS CLUB",t:"TEC",p:1062}
]}
];
function renderGpr(){
  const host=document.getElementById('gprRegions');if(!host)return;
  const maxP=GPR_DATA[0].equipos[0].p;
  /* barras de fuerza regional del bloque explicativo */
  const bars=document.getElementById('gprBars');
  if(bars){
    const maxZ=Math.max(...GPR_DATA.map(r=>r.fz));
    bars.innerHTML=GPR_DATA.map(r=>'<div class="gz-row">'
      +'<span class="gz-name">'+escTeams(r.n)+'</span>'
      +'<span class="gz-bar"><i style="width:'+Math.round(r.fz/maxZ*100)+'%"></i></span>'
      +'<b class="gz-val">'+r.fz+'</b></div>').join('');
  }
  /* acordeones por región: ∇ rota al abrir, AMÉRICAS abierta por defecto */
  host.innerHTML=GPR_DATA.map((r,ri)=>{
    const eq=[...r.equipos].sort((a,b)=>b.p-a.p),top=eq[0];
    const rows=eq.map((e,i)=>'<tr'+(i===0?' class="lead"':'')+'>'
      +'<td class="gp-pos">'+String(i+1).padStart(2,'0')+'</td>'
      +'<td class="gp-team"><span class="gp-tag">'+escTeams(e.t)+'</span><b>'+escTeams(e.n)+'</b></td>'
      +'<td class="gp-bar"><i style="width:'+Math.max(8,Math.round(e.p/maxP*100))+'%"></i></td>'
      +'<td class="gp-pts">'+e.p+'<small>PTS</small></td></tr>').join('');
    return '<div class="gpr-region'+(ri===0?' open':'')+'" id="gpr-'+r.id+'">'
      +'<button class="gpr-rhead" type="button" aria-expanded="'+(ri===0?'true':'false')+'">'
      +'<span class="gpr-rz"><i data-lucide="globe"></i>'+escTeams(r.n)+'</span>'
      +'<span class="gpr-top">Nº1 · '+escTeams(top.t)+' · '+top.p+' PTS</span>'
      +'<span class="gpr-caret" aria-hidden="true">∇</span></button>'
      +'<div class="gpr-rbody"><div class="gpr-rin"><table><tbody>'+rows+'</tbody></table></div></div>'
      +'</div>';
  }).join('');
  host.querySelectorAll('.gpr-rhead').forEach(h=>h.addEventListener('click',()=>{
    const open=h.parentElement.classList.toggle('open');
    h.setAttribute('aria-expanded',open?'true':'false');
  }));
  icons();
}
async function loadGpr(){
  /* 1) pinta el snapshot embebido al instante */
  renderGpr();
  /* 2) actualiza en vivo con /api/gpr (Riot recalcula cada pocos días;
        el Worker lee valorantesports.com y cachea 1 h). Si falla, queda el snapshot. */
  try{
    const r=await fetchWorker('/api/gpr',{headers:{Accept:'application/json'}});
    const d=await r.json();
    if(d&&d.ok&&Array.isArray(d.regions)&&d.regions.length){
      d.regions.forEach(reg=>{
        const local=GPR_DATA.find(x=>x.id===reg.id||x.n===reg.n);
        if(local&&Array.isArray(reg.equipos)&&reg.equipos.length)local.equipos=reg.equipos;
      });
      renderGpr();
      const s=document.getElementById('gprSrc');
      if(s&&d.calculated)s.textContent='ACTUALIZADO EN VIVO · CÁLCULO RIOT '+String(d.calculated).slice(0,10)+' · FUENTE: GLOBAL POWER RANKINGS (RIOT GAMES)';
    }
  }catch(e){/* sin worker: queda el snapshot embebido */}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadGpr);else loadGpr();

/* ============================================================
   PRIVILEGIOS OWNER
   El dueño del sitio (geimerpedroza) obtiene:
   · Todo el contenido pago gratis (planes, pase premium, fees).
   · Insignias OWNER + CREADOR (+ SOCIO) en su perfil.
   · Botón de AJUSTES DE CUENTA en su perfil.
   Se activa desde arena-live.js con window.vantsOwnerActivate().
   ============================================================ */
window.VANTS_OWNER=false;
function vantsEsOwner(){
  if(window.VANTS_OWNER)return true;
  const un=((typeof me!=='undefined')&&me&&me.name||'').toLowerCase();
  if(un==='geimerpedroza')return true;
  /* la fila REAL manda: si la sesión resolvió una fila owner en Neon
     (por sub), el dueño es dueño aunque su nick local sea otro */
  try{const mp=window.VANTS_ME&&window.VANTS_ME.player;if(mp&&mp.role==='owner')return true;}catch(e){}
  return false;
}
window.vantsEsOwner=vantsEsOwner;
function activatePlan(plan){
  const cfg=plan==='pro'
    ?{n:'VANTS PRO',b:['pro','verified']}
    :plan==='creator'?{n:'VANTS CREATOR',b:['creator','verified']}
    :{n:'VANTS SOCIO',b:['partner','verified']};
  me.plan=cfg.n;me.badges=[...new Set([...me.badges,...cfg.b])];
  meSave();renderAccount();icons();
  openModal('<div class="success"><div class="ok">'+SVG_CHECK+'</div><h4>Plan activado</h4><p>Privilegio OWNER: <b>'+cfg.n+'</b> activado sin cargo.<br>Las insignias ya están en tu perfil.</p></div>');
  toast('Plan '+cfg.n+' activado (OWNER)');
}
window.activatePlan=activatePlan;
window.vantsOwnerActivate=function(){
  window.VANTS_OWNER=true;
  me.badges=[...new Set([...(me.badges||[]),'owner','creator','partner'])];
  me.plan='VANTS PRO';
  try{localStorage.setItem('vants_me',JSON.stringify(me));}catch(e){}
  renderAccount();renderRail();icons();
  toast('Sesión OWNER detectada: todo el contenido premium queda gratis');
};

/* ================= AJUSTES DE CUENTA =================
   Email, contraseña, nick e identidades conectadas.
   Se abre desde el perfil (botón AJUSTES) o con
   window.openAjustesCuenta().
   · EMAIL: el Worker crea el TICKET de verificación de Auth0
     (Management API) y devuelve el enlace directo: abre acá mismo,
     sin depender de que el correo llegue a la bandeja.
   · CONTRASEÑA: /dbconnections/change_password solo para cuentas
     auth0| (las de Google/Discord no tienen contraseña local).
   · NICK: persiste en Neon con el JWT de la sesión (RLS own-row). */
window.openAjustesCuenta=function(){
  const auth=window.VANTS_AUTH||{};
  const ident=auth.sub||'—';
  const email=auth.email||'no disponible';
  const esGoogle=ident.indexOf('google-oauth2')===0;
  const esDiscord=ident.indexOf('discord')===0;
  const esSocial=esGoogle||esDiscord;
  const proveedor=esGoogle?'Google':(esDiscord?'Discord':null);
  openModal('<div class="mc-head"><h3>Ajustes de cuenta</h3><button class="d-x" id="mClose"><i data-lucide="x"></i></button></div><div class="mc-body">'
    +'<p class="d-sec">NICK DE JUGADOR</p>'
    +'<div class="field"><label>NICK (SE GUARDA EN LA BD)</label><input id="ajNick" type="text" maxlength="20" value="'+escHtml((window.VANTS_ME&&window.VANTS_ME.player&&window.VANTS_ME.player.display_name)||me.name||'')+'"></div>'
    +'<p class="d-sec">EMAIL DE LA CUENTA</p>'
    +'<div class="field"><label>ACTUAL</label><input type="text" value="'+escHtml(email)+'" disabled style="opacity:.65"></div>'
    +'<div class="field"><label>NUEVO EMAIL (OPCIONAL)</label><input id="ajMailNvo" type="email" placeholder="tu@correo.com" autocomplete="email"></div>'
    +'<p style="font:500 10px/1.7 var(--mono);color:var(--dim);margin:6px 0 12px">Auth0 genera un enlace de verificación para confirmar el email. Si es nuevo, la verificación viaja a la dirección nueva.</p>'
    +'<button class="btn btn-ghost" id="ajMail" style="width:100%;justify-content:center"><i data-lucide="mail"></i>CREAR ENLACE DE VERIFICACIÓN</button>'
    +'<div id="ajMailOut" style="display:none;margin-top:10px"></div>'
    +'<p class="d-sec">CONTRASEÑA</p>'
    +'<button class="btn btn-ghost" id="ajPass" style="width:100%;justify-content:center"><i data-lucide="key-round"></i>ENVIAR LINK DE RESET</button>'
    +'<p id="ajPassNota" style="font:500 10px/1.7 var(--mono);color:var(--dim);margin:8px 0 0">'+(esSocial?('Tu cuenta entra con '+proveedor+': la contraseña la gestiona '+proveedor+', no VANTS.'):'Crea un enlace directo en pantalla para definir tu contraseña nueva (no depende del correo).')+'</p>'
    +'<p class="d-sec">IDENTIDADES CONECTADAS</p>'
    +'<div class="plat-list">'
      +'<div class="plat-row" style="--plc:#c9a227"><span class="plat-ic"><i data-lucide="fingerprint"></i></span><p><b style="color:var(--text)">AUTH0 · SESIÓN ACTUAL</b><br><span class="mono" style="font:500 9px/1.6 var(--mono);color:var(--dim)">'+ident+'</span></p><span class="plat-on">CONECTADO</span></div>'
      +'<div class="plat-row" style="--plc:#4285F4"><span class="plat-ic">G</span><p><b style="color:var(--text)">GOOGLE</b><br><span style="font:500 10px/1.6 var(--mono);color:var(--dim)">'+(esGoogle?'Vinculada a esta sesión':'No vinculada')+'</span></p><span class="'+(esGoogle?'plat-on':'plat-off')+'">'+(esGoogle?'CONECTADO':'—')+'</span></div>'
      +'<div class="plat-row" style="--plc:#8ea1ff"><span class="plat-ic">DC</span><p><b style="color:var(--text)">DISCORD</b><br><span style="font:500 10px/1.6 var(--mono);color:var(--dim)">'+(me.discordTag?'Tag: '+me.discordTag:'Se vincula desde Cuentas conectadas')+'</span></p><span class="'+(me.discordTag?'plat-on':'plat-off')+'">'+(me.discordTag?'CONECTADO':'—')+'</span></div>'
    +'</div>'
    +'<div class="field-row" style="margin-top:16px">'
      +'<button class="btn btn-cut" id="ajSave" style="flex:1;justify-content:center"><i data-lucide="save"></i>GUARDAR CAMBIOS</button>'
      +'<button class="btn btn-ghost" id="ajLogout" style="flex:1;justify-content:center"><i data-lucide="log-out"></i>CERRAR SESIÓN</button>'
    +'</div>'
    +'<p class="mono" style="margin-top:14px;font:500 10px/1.7 var(--mono);color:var(--dim);text-align:center">VANTS ACCOUNT · protegido por Auth0</p></div>');
  $('#mClose').onclick=closeModal;
  $('#ajSave').onclick=async()=>{
    const v=$('#ajNick').value.trim().toUpperCase().replace(/["'<>\\]/g,'');
    if(!v){toast('El nick no puede quedar vacío','info');return;}
    me.name=v;meSave();renderAccount();
    if(auth.playerId&&window.VANTS_API_BASE){
      try{
        const t=await window.VantAuth0.getToken();
        if(t){
          const r=await fetch(window.VANTS_API_BASE+'/players?id=eq.'+auth.playerId,{method:'PATCH',headers:{'Content-Type':'application/json',[AUTH_FIELD]:AUTH_SCHEME+t},body:JSON.stringify({username:v.toLowerCase().replace(/\s+/g,'_'),display_name:v})});
          if(!r.ok)toast('El nick se guardó local, pero la base lo rechazó (HTTP '+r.status+')','info');
          /* un solo perfil: la ficha y la sala reflejan el nick guardado al instante */
          try{const mp=window.VANTS_ME&&window.VANTS_ME.player;if(mp){mp.display_name=v;mp.username=v.toLowerCase().replace(/\s+/g,'_');}}catch(eMP){}
          if(window.vantsRecargarJugadores){try{window.vantsRecargarJugadores();}catch(eRJ){}}
        }
      }catch(eN){/* local igual queda */}
    }
    if(window.vantsAbrirMiPerfil)window.vantsAbrirMiPerfil();
    toast('Ajustes guardados: nick '+v);
  };
  $('#ajMail').onclick=async()=>{
    const out=$('#ajMailOut');if(out)out.style.display='none';
    if(!auth.email||!auth.sub){toast('Iniciá sesión con Auth0 para gestionar tu email','info');return;}
    const btn=$('#ajMail');const old=btn.innerHTML;
    btn.disabled=true;btn.textContent='CREANDO ENLACE…';
    try{
      const t=await window.VantAuth0.getToken();
      const nuevo=($('#ajMailNvo')&&$('#ajMailNvo').value||'').trim();
      const r=await fetchWorker('/api/account/email-verify',{method:'POST',headers:{'Content-Type':'application/json',[AUTH_FIELD]:AUTH_SCHEME+(t||'')},body:JSON.stringify(nuevo?{nuevo_email:nuevo}:{})});
      const j=await r.json().catch(()=>null);
      if(j&&j.ok&&j.ticket){
        if(out){
          out.style.display='block';
          out.innerHTML='<div style="border:1px solid var(--line2,#303039);border-radius:8px;padding:12px;background:#0d0d10">'
            +'<p style="font:700 10px/1.6 var(--mono);color:var(--grn,#3EE6A0);margin:0 0 6px">✓ ENLACE LISTO'+(j.email?(' · '+j.email):'')+'</p>'
            +(j.nota?'<p style="font:500 9.5px/1.7 var(--mono);color:#F5C044;margin:4px 0 6px">'+escHtml(j.nota)+'</p>':'')
            +'<p style="font:500 10px/1.7 var(--mono);color:var(--mut);margin:0 0 10px">Auth0 también lo envía a ese correo; si no llega (Spam), ábrelo directo acá. Vence en 3 días.</p>'
            +'<a class="btn btn-cut btn-sm" href="'+j.ticket+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none"><i data-lucide="external-link"></i>ABRIR VERIFICACIÓN DE EMAIL</a></div>';
          if(window.lucide)lucide.createIcons();
        }
        toast('Enlace de verificación de Auth0 creado','ok');
      }else if(j&&j.error==='mgmt_no_config'){
        if(out){
          out.style.display='block';
          out.innerHTML='<div style="border:1px solid #F5C044;border-radius:8px;padding:12px;background:#171204">'
            +'<p style="font:700 10px/1.6 var(--mono);color:#F5C044;margin:0 0 6px">FALTA CONFIGURAR AUTH0 EN EL SERVIDOR</p>'
            +'<p style="font:500 10px/1.7 var(--mono);color:var(--mut);margin:0">El dueño debe crear una app Machine-to-Machine en Auth0 (Management API) y cargar AUTH0_MGMT_CLIENT_ID y AUTH0_MGMT_CLIENT_SECRET en el Worker. Guía completa en GUÍA → Ajustes de cuenta.</p></div>';
        }
        toast('Auth0 del servidor sin configurar todavía','info');
      }else{
        toast('No se pudo crear el enlace'+(j&&j.detalle?(' ('+j.detalle+')'):''),'error');
      }
    }catch(eM){toast('Error de red al crear el enlace','error');}
    btn.disabled=false;btn.innerHTML=old;if(window.lucide)lucide.createIcons();
  };
  $('#ajPass').onclick=async()=>{
    if(!auth.email){toast('Iniciá sesión para resetear la contraseña','info');return;}
    if(esSocial){toast('Tu cuenta entra con '+proveedor+': no tiene contraseña de VANTS que resetear','info');return;}
    const out=$('#ajMailOut');if(out)out.style.display='none';
    const btn=$('#ajPass');const old=btn.innerHTML;
    btn.disabled=true;btn.textContent='CREANDO ENLACE…';
    try{
      const t=await window.VantAuth0.getToken();
      const r=await fetchWorker('/api/account/password-reset',{method:'POST',headers:{'Content-Type':'application/json',[AUTH_FIELD]:AUTH_SCHEME+(t||'')},body:'{}'});
      const j=await r.json().catch(()=>null);
      if(j&&j.ok&&j.ticket){
        if(out){
          out.style.display='block';
          out.innerHTML='<div style="border:1px solid var(--line2,#303039);border-radius:8px;padding:12px;background:#0d0d10">'
            +'<p style="font:700 10px/1.6 var(--mono);color:var(--grn,#3EE6A0);margin:0 0 6px">✓ ENLACE DE RESET LISTO'+(j.email?(' · '+j.email):'')+'</p>'
            +'<p style="font:500 10px/1.7 var(--mono);color:var(--mut);margin:0 0 10px">Definí una contraseña nueva acá mismo. Vence en 3 días y solo se creó para TU cuenta.</p>'
            +'<a class="btn btn-cut btn-sm" href="'+j.ticket+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none"><i data-lucide="key-round"></i>DEFINIR CONTRASEÑA NUEVA</a></div>';
          if(window.lucide)lucide.createIcons();
        }
        toast('Enlace de reset de Auth0 creado','ok');
      }else{
        /* Fallback: flujo clásico por correo (si el servidor aún no tiene la app M2M). */
        if(!window.AUTH0_CONFIG){toast('Auth0 no disponible en este entorno','error');}
        else{
          try{
            const r2=await fetch('https://'+window.AUTH0_CONFIG.domain+'/dbconnections/change_password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:window.AUTH0_CONFIG.clientId,email:auth.email,connection:'Username-Password-Authentication'})});
            if(r2.ok)toast('Link de reset enviado a '+auth.email+' — revisa Spam','info');
            else toast('No se pudo crear el enlace'+(j&&j.detalle?(' ('+j.detalle+')'):'')+' — probamos por correo','error');
          }catch(eF){toast('Error de red al enviar el link','error');}
        }
      }
    }catch(eP){toast('Error de red al crear el enlace','error');}
    btn.disabled=false;btn.innerHTML=old;if(window.lucide)lucide.createIcons();
  };
  $('#ajLogout').onclick=()=>{
    if(window.vantsLogout)window.vantsLogout();
    else if(window.AUTH0_CONFIG)window.location.href='https://'+window.AUTH0_CONFIG.domain+'/v2/logout?client_id='+window.AUTH0_CONFIG.clientId+'&returnTo='+encodeURIComponent(window.location.origin);
  };
  icons();
};

/* ============================================================
   MI CUENTA · DASHBOARD EN CAJONES + PRESENCIA EN VIVO
   + TORNEOS EN LA BASE (inscripciones reales + bracket que se mueve)
   Task 32 · v26
   ------------------------------------------------------------
   · MI CUENTA: dashboard estilo my-account en CAJONES separados
     (perfil · membresía · partidos y resultados · equipos ·
     conexiones · estado en vivo). Nada mezclado en una sola masa.
   · PRESENCIA: con sesión activa, la pestaña (y la app de Windows)
     laten cada 60 s → LÍDERES y la Sala muestran EN LÍNEA/JUGANDO.
   · TORNEOS: la inscripción guarda el equipo EN LA BASE (Neon);
     el bracket se siembra solo con 8 confirmados y avanza solo
     con cada resultado (trigger SQL) — la web lo refleja cada 30 s.
   ============================================================ */
window.VANTS_LIVE={};          /* pid → fila de v_en_vivo */
window.VANTS_LIVE_AT=0;
window.VANTS_TORNEOS={};       /* id torneo → {equipos,bracket,at} */
const LINKS_API_MQ='https://ep-autumn-scene-b4opu2ip.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';
const fhCorta=iso=>{try{return new Date(iso).toLocaleDateString('es',{day:'2-digit',month:'short'})}catch(e){return''}};
const vivoChipHTML=(v,abs)=>{const jug=v&&v.estado==='jugando';
  return '<span class="vivo-chip '+(jug?'jugando':'linea')+(abs?' abs':'')+'" title="'+(jug?'JUGANDO AHORA':'EN LÍNEA')+'"><i></i>'+(jug?'JUGANDO':'EN LÍNEA')+'</span>';};
const vivoDe=pid=>{try{return (window.VANTS_LIVE||{})[pid]||null;}catch(e){return null;}};

/* ---------- LECTURA EN VIVO (quién está conectado ahora) ---------- */
async function enVivoCargar(){
  try{
    const r=await fetchWorker('/api/en-vivo',{headers:{Accept:'application/json'}});
    const j=await r.json().catch(()=>null);
    const mapa={};
    if(j&&j.ok&&Array.isArray(j.jugadores))j.jugadores.forEach(x=>{if(x&&x.player_id)mapa[x.player_id]=x;});
    window.VANTS_LIVE=mapa;window.VANTS_LIVE_AT=Date.now();
    pintarDotsEnVivo();
  }catch(e){/* silencio: el chip desaparece y listo */}
}
function pintarDotsEnVivo(){
  try{
    const acc=$('#accLive');
    const mio=(window.VANTS_AUTH&&window.VANTS_AUTH.playerId)?vivoDe(window.VANTS_AUTH.playerId):null;
    if(acc){acc.style.display=mio?'block':'none';}
  }catch(e){}
  try{pintarFranjaEnVivo();}catch(e){}
  try{if((window.VANTS_PLAYERS||[]).length)renderProfileGrid();}catch(e){}
  try{renderLbBody();}catch(e){}
}
function pintarFranjaEnVivo(){
  const hero=document.querySelector('.hero');if(!hero)return;
  let f=document.getElementById('vivosFranja');
  if(!f){f=document.createElement('div');f.id='vivosFranja';f.className='vivos-franja';
    const anc=hero.querySelector('.hero-cta')||hero;
    anc.parentNode.insertBefore(f,anc.nextSibling);}
  const js=Object.values(window.VANTS_LIVE||{});
  if(!js.length){f.style.display='none';return;}
  const jug=js.filter(x=>x.estado==='jugando').length;
  f.style.display='flex';
  f.innerHTML='<span class="vf-dot"></span><span>EN LA ARENA AHORA</span><b>'+js.length+' CONECTADOS</b>'
    +(jug?'<b class="jf">'+jug+' JUGANDO</b>':'')
    +js.slice(0,5).map(x=>'<span class="vf-ava" title="'+escHtml(x.display_name||x.username||'')+'">'+escHtml(String(x.display_name||x.username||'V').slice(0,2).toUpperCase())+'</span>').join('');
}

/* ---------- PRESENCIA (latido propio: web y app de Windows) ---------- */
let presTimer=null,presKicked=false;
async function presenciaLatir(){
  try{
    const A=window.VantAuth0;if(!A||!A.client)return;
    const u=await A.client.getUser().catch(()=>null);
    if(!u||!u.sub)return;
    const t=await A.getToken().catch(()=>null);if(!t)return;
    let pid=(window.VANTS_AUTH&&window.VANTS_AUTH.playerId)||null;
    if(!pid)pid=await playerPidActual();
    if(!pid)return;
    const estado=(localStorage.getItem('vants_presencia')||'online');
    const h={'Content-Type':'application/json',Accept:'application/json',[AUTH_FIELD]:AUTH_SCHEME+t};
    if(estado==='ausente'){
      await fetch(LINKS_API_MQ+'/presence?player_id=eq.'+encodeURIComponent(pid),{method:'DELETE',headers:{Accept:'application/json',[AUTH_FIELD]:AUTH_SCHEME+t}}).catch(()=>{});
      return;
    }
    await fetch(LINKS_API_MQ+'/presence',{method:'POST',headers:Object.assign(h,{'Prefer':'resolution=merge-duplicates'}),
      body:JSON.stringify({player_id:pid,estado,juego:state.game||'valorant'})}).catch(()=>{});
  }catch(e){}
}
function iniciarPresencia(){
  if(presKicked)return;presKicked=true;
  presenciaLatir();presTimer=setInterval(presenciaLatir,60000);
  window.vantsPresenciaSet=function(est){
    try{localStorage.setItem('vants_presencia',est);}catch(e){}
    presenciaLatir();
    const t=$('#presEstadoTxt');if(t)t.textContent=est==='ausente'?'INVISIBLE (nadie te ve)':(est==='jugando'?'JUGANDO':'EN LÍNEA');
    $$('#presOpts [data-pres]').forEach(b=>b.classList.toggle('on',b.dataset.pres===est));
  };
}

/* ---------- TORNEOS EN LA BASE: inscritos + bracket sincronizado ---------- */
async function torneosCargar(force){
  if(!document.getElementById('tournList'))return;
  const tor=D().tournaments[0];
  if(!tor||!tor.id)return;
  const prev=window.VANTS_TORNEOS[tor.id];
  if(!force&&prev&&Date.now()-prev.at<25000)return;
  try{
    const r=await fetchWorker('/api/torneos/bracket?torneo='+encodeURIComponent(tor.id),{headers:{Accept:'application/json'}});
    const j=await r.json().catch(()=>null);
    if(j&&j.ok){
      window.VANTS_TORNEOS[tor.id]={equipos:j.equipos||[],bracket:j.bracket||[],at:Date.now()};
      const tt=D().tournaments.find(x=>x.id===tor.id);
      if(tt)tt.filled=(j.equipos||[]).length;
      renderTournaments();renderTorneosInscritos();
      bracketAplicar(j);
    }
  }catch(e){}
}
function renderTorneosInscritos(){
  const tl=$('#tournList');if(!tl)return;
  let c=$('#tInscritos');
  if(!c){c=document.createElement('div');c.id='tInscritos';c.className='t-inscritos';tl.parentNode.insertBefore(c,tl.nextSibling);}
  const tor=D().tournaments[0];const d=tor&&(window.VANTS_TORNEOS[tor.id]);
  if(!d||!d.equipos.length){c.innerHTML='';return;}
  const CH={pendiente:'PENDIENTE',confirmado:'CONFIRMADO',rechazado:'RECHAZADO'};
  c.innerHTML='<p class="d-sec" style="margin:26px 0 12px">EQUIPOS INSCRITOS · SINCRONIZADO CON LA BASE</p>'
    +'<div class="ti-grid">'+d.equipos.slice(0,12).map(e=>'<div class="ti-row'+(e.status==='confirmado'?' ok':'')+'">'
      +'<span class="ti-tag">'+escHtml(String(e.tag||'VNT').slice(0,3).toUpperCase())+'</span>'
      +'<div class="ti-info"><b>'+escHtml(String(e.name||'EQUIPO').toUpperCase())+'</b>'
      +'<small>'+escHtml(e.captain||'—')+(e.region?' · '+escHtml(e.region):'')+' · '+fhCorta(e.created_at)+'</small></div>'
      +'<span class="ti-st '+e.status+'">'+(CH[e.status]||e.status.toUpperCase())+'</span></div>').join('')+'</div>';
}
async function inscribirReal(t,team,tag){
  const A=window.VantAuth0;
  let tok=null;try{tok=A?await A.getToken():null;}catch(e){tok=null;}
  if(!tok){toast('Iniciá sesión para inscribir tu equipo en la base','info');const lb=$('#arenaLoginBtn');if(lb)lb.click();return;}
  toast('Registrando tu equipo en la base…','info');
  try{
    const r=await fetchWorker('/api/torneos/inscribir',{method:'POST',headers:{'Content-Type':'application/json',[AUTH_FIELD]:AUTH_SCHEME+tok},
      body:JSON.stringify({torneo:t.id,juego:state.game||'valorant',equipo:team,tag:tag,capitan:($('#fCap')?$('#fCap').value.trim():''),region:($('#fReg')?$('#fReg').value.trim():'')})});
    const j=await r.json().catch(()=>({}));
    if(r.ok&&j.ok){finishEnroll(t,team,tag);torneosCargar(true);return;}
    if(j.error==='equipo_ya_inscrito'){toast('Ese nombre de equipo ya está inscrito en este torneo','info');return;}
    if(j.error==='sin_sesion'||j.error==='token_invalido'){toast('Tu sesión venció: entrá de nuevo y repetí la inscripción','info');const lb=$('#arenaLoginBtn');if(lb)lb.click();return;}
    toast('La inscripción no se pudo guardar'+(j.error?(' ('+j.error+')'):''),'error');
  }catch(e){toast('Error de red al inscribir el equipo','error');}
}
function bracketAplicar(j){
  const b=D().bracket;if(!b)return;
  const por={};(j.bracket||[]).forEach(m=>{(por[m.ronda]=por[m.ronda]||[])[m.slot]=m;});
  if(!por.q||!por.q.length)return;
  const arma=m=>m?{a:m.team_a||null,b:m.team_b||null,
    sa:m.estado==='final'?m.score_a:null,sb:m.estado==='final'?m.score_b:null,
    meta:m.estado==='en_curso'?'EN CURSO · BO3':(m.estado==='final'?('FINAL '+m.score_a+':'+m.score_b):'POR DEFINIR')}:{a:null,b:null,meta:'POR DEFINIR'};
  const sig=JSON.stringify([b.quarters.map(m=>[m.a,m.b,m.sa,m.sb]),b.semis.map(m=>[m.a,m.b,m.sa,m.sb]),[b.final.a,b.final.b,b.final.sa,b.final.sb]]);
  b.quarters=[0,1,2,3].map(i=>arma((por.q||[])[i]));
  b.semis=[0,1].map(i=>arma((por.s||[])[i]));
  b.final=arma((por.f||[])[0]);
  b.lb1=[0,1].map(i=>arma((por.l1||[])[i]));
  b.lb2=[0,1].map(i=>arma((por.l2||[])[i]));
  b.lbf=arma((por.lf||[])[0]);
  renderBracket();
  const sig2=JSON.stringify([b.quarters.map(m=>[m.a,m.b,m.sa,m.sb]),b.semis.map(m=>[m.a,m.b,m.sa,m.sb]),[b.final.a,b.final.b,b.final.sa,b.final.sb]]);
  if(sig2!==sig)animarBracket();
  window.VANTS_BRK_AT=Date.now();
}
function animarBracket(){
  $$('#bracketGrid .b-match').forEach(el=>{
    if(el.querySelector('.win')&&!el.dataset.f){el.dataset.f='1';el.classList.add('b-move');
      setTimeout(()=>{el.classList.remove('b-move');},2400);}
  });
}

/* ---------- LÍDERES: refresco automático con movimiento ---------- */
async function lbRefrescoVivo(){
  if(document.hidden)return;
  if(!document.getElementById('lbBody'))return;
  const antes={};
  $$('#lbBody tr').forEach(tr=>{const sm=tr.querySelector('.p-name small');
    if(sm)antes[sm.textContent]=tr.getBoundingClientRect().top;});
  try{await cargarJugadores();}catch(e){return;}
  try{enVivoCargar();}catch(e){}
  requestAnimationFrame(()=>{
    $$('#lbBody tr').forEach(tr=>{const sm=tr.querySelector('.p-name small');if(!sm)return;
      const prev=antes[sm.textContent];if(prev==null)return;
      const d=prev-tr.getBoundingClientRect().top;
      if(Math.abs(d)>2){tr.style.transition='none';tr.style.transform='translateY('+d+'px)';
        requestAnimationFrame(()=>{tr.style.transition='transform .7s cubic-bezier(.22,.61,.36,1)';tr.style.transform='';});}});
  });
  const chip=$('#lbRefresh');
  if(chip)chip.textContent='AUTO · '+new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
(function lbChip(){const s=$('#lbSearch');if(s&&s.parentNode&&!$('#lbRefresh')){
  const c=document.createElement('span');c.id='lbRefresh';c.className='lb-refresh mono';c.textContent='AUTO · EN VIVO';
  s.parentNode.appendChild(c);}})();

/* ---------- MI CUENTA · DASHBOARD EN CAJONES ---------- */
window.abrirMiCuenta=async function(){
  /* EL DASHBOARD SE RETIRA: MI CUENTA siempre abre el PERFIL DE JUGADOR
     (el de antes). A los NUEVOS, vantsAbrirMiPerfil les muestra la ficha
     de primera vez (MI PERFIL · PRIMERA VEZ) y después el mismo perfil —
     nunca este dashboard, que queda solo como respaldo absoluto. */
  if(window.vantsAbrirMiPerfil){try{window.vantsAbrirMiPerfil();return;}catch(eDsh){}}
  if(!(window.VANTS_AUTH&&window.VANTS_AUTH.sub)){
    const lb=$('#arenaLoginBtn');
    if(lb&&!lb.hidden){try{lb.click();}catch(e){}}
    toast('Iniciá sesión para abrir MI CUENTA','info');return;
  }
  const A=window.VantAuth0;
  const u=await A.client.getUser().catch(()=>null);
  const sub=(u&&u.sub)||null;
  const mio=(window.VANTS_ME&&window.VANTS_ME.player)||null;
  const pid=(window.VANTS_ME&&window.VANTS_ME.pid)||((window.VANTS_AUTH&&window.VANTS_AUTH.playerId)||null);
  openDrawer('<div class="d-head"><span class="kicker">MI CUENTA · DASHBOARD</span><button class="d-x" onclick="closeDrawer()"><i data-lucide="x"></i></button></div>'
    +'<div class="d-body"><div class="cta-grid" id="ctaGrid"><div class="cta-loading"><span class="spin"></span>CARGANDO TUS CAJONES…</div></div></div>');
  let links={};try{links=await linksCargar()||{};}catch(e){}
  let tok=null;try{tok=await A.getToken();}catch(e){}
  const hAuth=tok?{'Content-Type':'application/json',Accept:'application/json',[AUTH_FIELD]:AUTH_SCHEME+tok}:{};
  let series=[],fme=[],equipos=[];
  if(tok&&pid){
    try{const or=encodeURIComponent('(retador_id.eq.'+pid+',rival_id.eq.'+pid+')');
      series=await fetch(LINKS_API_MQ+'/series_ranked?or='+or+'&order=creado_at.desc&limit=6',{headers:hAuth}).then(r=>r.ok?r.json():[]).catch(()=>[]);}catch(e){series=[];}
    try{fme=await fetch(LINKS_API_MQ+'/faceit_matches?player_id=eq.'+encodeURIComponent(pid)+'&order=played_at.desc&limit=6',{headers:hAuth}).then(r=>r.ok?r.json():[]).catch(()=>[]);}catch(e){fme=[];}
  }
  if(sub){try{equipos=await fetch(LINKS_API_MQ+'/tournament_teams?auth0_sub=eq.'+encodeURIComponent(sub)+'&order=created_at.desc&limit=10',{headers:hAuth}).then(r=>r.ok?r.json():[]).catch(()=>[]);}catch(e){equipos=[];}}
  const mapaP={};(window.VANTS_PLAYERS||[]).forEach(p=>{mapaP[p.id]=p;});
  const k=rankKeyDe(mio||{}),rc=RANKS[k];
  const st=mio?(window.VANTS_STATS[mio.id]||{}):{};
  const planTxt=vantsEsOwner()?'VANTS PRO · OWNER':(me.plan||'FREE');
  const pres=localStorage.getItem('vants_presencia')||'online';
  const serieRow=s=>{
    const yoRet=s.retador_id===pid;
    const otroId=yoRet?s.rival_id:s.retador_id;
    const otro=(mapaP[otroId]&&(mapaP[otroId].display_name||mapaP[otroId].username))||'JUGADOR';
    const gane=yoRet?s.gano_retador:!s.gano_retador;
    const chip=s.estado!=='confirmada'?'<span class="sr-chip pend">PENDIENTE</span>':(gane?'<span class="sr-chip win">GANADA</span>':'<span class="sr-chip lose">PERDIDA</span>');
    return '<div class="sr-row"><div class="sr-info"><b>VS '+escHtml(String(otro).toUpperCase())+'</b><small>'+(s.mapa?escHtml(s.mapa)+' · ':'')+fhCorta(s.creado_at)+'</small></div>'+chip+'</div>';
  };
  const fmRow=m=>'<div class="sr-row"><div class="sr-info"><b>FACEIT · '+escHtml((m.game||'cs2').toUpperCase())+'</b><small>'+fhCorta(m.played_at)+(m.xp_awarded?(' · +'+m.xp_awarded+' XP'):'')+'</small></div>'
    +(m.result==='win'?'<span class="sr-chip win">VICTORIA</span>':(m.result==='loss'?'<span class="sr-chip lose">DERROTA</span>':'<span class="sr-chip pend">EMPATE</span>'))+'</div>';
  const eqRow=e=>'<div class="sr-row"><div class="sr-info"><b>'+escHtml(String(e.name||'EQUIPO').toUpperCase())+' ['+escHtml(String(e.tag||'').toUpperCase())+']</b><small>'+escHtml(e.tournament_id||'')+' · '+fhCorta(e.created_at)+'</small></div>'
    +'<span class="ti-st '+e.status+'">'+e.status.toUpperCase()+'</span></div>';
  const conRow=k2=>{
    const l=links[k2];const p=PLAT[k2];
    return '<div class="cn-row" style="--plc:'+p.c+'">'+platIc(k2)
      +'<div class="cn-info"><b>'+p.n+'</b><small>'+(l?('VINCULADO · '+escHtml(l.handle||'')):'NO VINCULADO')+'</small></div>'
      +'<div class="cn-act">'+(l?'<button class="btn btn-ghost btn-sm" data-dis="'+k2+'">DESCONECTAR</button>':'<button class="btn btn-cut btn-sm" data-con="'+k2+'">CONECTAR</button>')+'</div></div>';
  };
  const g=(t2,inner)=>'<div class="cta-cajon"><p class="cta-k">'+t2+'</p>'+inner+'</div>';
  const grid=''
    +g('PERFIL'
      ,'<div class="pf-mini"><span class="ava s2" style="--rc:'+rc.c1+'">'+(mio&&mio.avatar_url?'<img src="'+escHtml(mio.avatar_url)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':escHtml(((mio&&(mio.display_name||mio.username))||me.name||'V').slice(0,2).toUpperCase()))+'</span>'
      +'<div class="pf-mini-i"><b>'+escHtml(((mio&&(mio.display_name||mio.username))||me.name||'JUGADOR').toUpperCase())+'</b>'
      +'<small>@'+escHtml((mio&&mio.username)||'—')+' · '+(mio&&mio.verified?'VERIFICADO':'SIN VERIFICAR')+'</small>'
      +'<div class="rk-wrap" style="margin-top:6px">'+rankSVG(k,26)+'<small>'+RANKS[k].name+'</small><span class="rr mono">'+(st.mmr!=null?st.mmr+' MMR':'— MMR')+'</span></div></div></div>'
      +'<div class="cta-btns"><button class="btn btn-ghost btn-sm" id="mcFicha">VER FICHA</button>'
      +'<button class="btn btn-ghost btn-sm" id="mcEditar">EDITAR PERFIL</button>'
      +'<button class="btn btn-ghost btn-sm" id="mcAjustes">AJUSTES</button></div>')
    +g('MEMBRESÍA'
      ,'<div class="plan-mini"><b>'+escHtml(planTxt)+'</b><span class="ti-st '+(planTxt==='FREE'?'pendiente':'confirmado')+'">'+(planTxt==='FREE'?'PLAN BASE':'ACTIVO')+'</span></div>'
      +'<p class="cta-note">'+(vantsEsOwner()?'Tu cuenta es la dueña de la arena: todo el contenido premium desbloqueado.':(planTxt==='FREE'?'Subí a PRO para insignia verificable, columnas exclusivas del ranking y prioridad en torneos.':'Tu insignia ya acompaña a tu perfil en toda la arena.'))+'</p>'
      +'<div class="cta-btns"><button class="btn btn-cut btn-sm" id="mcPlanes">VER MEMBRESÍAS</button></div>')
    +g('PARTIDOS Y RESULTADOS'
      ,(series.length?'<p class="cta-sub">ÚLTIMAS SERIES</p>'+series.map(serieRow).join(''):'<p class="cta-note">Todavía no reportaste series. Gana series contra otros jugadores y subí de rango.</p>')
      +(fme.length?'<p class="cta-sub" style="margin-top:12px">FACEIT · ÚLTIMAS PARTIDAS</p>'+fme.map(fmRow).join(''):'')
      +'<div class="cta-btns"><button class="btn btn-ghost btn-sm" id="mcReportar">VER MI PERFIL</button></div>')
    +g('EQUIPOS · MIS INSCRIPCIONES'
      ,(equipos.length?equipos.map(eqRow).join(''):'<p class="cta-note">Aún no inscribiste ningún equipo. Cuando lo hagas, tu equipo aparece acá y en el bracket.</p>')
      +'<div class="cta-btns"><button class="btn btn-ghost btn-sm" id="mcTorneos">VER TORNEOS</button></div>')
    +g('CONEXIONES · FACEIT · DISCORD · GOOGLE'
      ,'<div class="cn-row" style="--plc:#4CC9F0"><span class="pletter">G</span>'
      +'<div class="cn-info"><b>GOOGLE (CUENTA VANTS)</b><small>CONECTADO · '+escHtml((window.VANTS_AUTH&&window.VANTS_AUTH.email)||'—')+'</small></div>'
      +'<div class="cn-act"><button class="btn btn-ghost btn-sm" id="mcGoogle">GESTIONAR</button></div></div>'
      +['faceit','discord','twitch','kick','youtube','tiktok','x','riot','steam'].map(conRow).join(''))
    +g('ESTADO EN VIVO'
      ,'<p class="cta-note">Tus latidos marcan si estás EN LÍNEA o JUGANDO. La app de Windows también lo hace: los demás te ven brillar en LÍDERES y en la Sala.</p>'
      +'<div class="pres-opts" id="presOpts">'
      +'<button data-pres="online" class="'+(pres==='online'?'on':'')+'"><i class="dot"></i>EN LÍNEA</button>'
      +'<button data-pres="jugando" class="'+(pres==='jugando'?'on':'')+'"><i class="dot"></i>JUGANDO</button>'
      +'<button data-pres="ausente" class="'+(pres==='ausente'?'on':'')+'">INVISIBLE</button></div>'
      +'<p class="cta-sub" style="margin-top:10px">ESTADO ACTUAL · <span id="presEstadoTxt">'+(pres==='ausente'?'INVISIBLE (nadie te ve)':(pres==='jugando'?'JUGANDO':'EN LÍNEA'))+'</span></p>');
  const gd=$('#ctaGrid');if(gd)gd.innerHTML=grid;
  icons();
  const gb=id=>document.querySelector('#'+id);
  if(gb('mcFicha'))gb('mcFicha').onclick=()=>{closeDrawer();if(mio)openPlayerProfile(mio);else if(pid)openPlayerProfile(pid);else toast('Abrí tu ficha desde la Sala de jugadores','info');};
  if(gb('mcEditar'))gb('mcEditar').onclick=()=>{closeDrawer();if(window.vantsAbrirMiPerfil)window.vantsAbrirMiPerfil();};
  if(gb('mcAjustes'))gb('mcAjustes').onclick=()=>{closeDrawer();if(window.openAjustesCuenta)window.openAjustesCuenta();};
  if(gb('mcPlanes'))gb('mcPlanes').onclick=()=>{closeDrawer();irAPro();};
  if(gb('mcReportar'))gb('mcReportar').onclick=()=>{closeDrawer();const rb=$('#rankedReportBtn');if(rb){rb.click();}else{toast('El reporte de series vive en la portada · sección RANKING','info');}};
  if(gb('mcTorneos'))gb('mcTorneos').onclick=()=>{closeDrawer();const p=document.getElementById('torneos');if(p)p.scrollIntoView({behavior:'smooth'});};
  if(gb('mcGoogle'))gb('mcGoogle').onclick=()=>{closeDrawer();if(window.openAjustesCuenta)window.openAjustesCuenta();};
  $$('#ctaGrid [data-con]').forEach(b=>b.onclick=async()=>{await window.connect(b.dataset.con);});
  $$('#ctaGrid [data-dis]').forEach(b=>b.onclick=async()=>{await window.disconnect(b.dataset.dis);});
  $$('#presOpts [data-pres]').forEach(b=>b.onclick=()=>{if(window.vantsPresenciaSet)window.vantsPresenciaSet(b.dataset.pres);});
};

/* ---------- ARRANQUE DEL MÓDULO ---------- */
(function arranqueMiCuenta(){
  const b=$('#miCuentaBtn');
  if(b)b.addEventListener('click',function(){
    /* UN SOLO PERFIL: MI CUENTA abre el PERFIL DE JUGADOR (ficha editable
       con todo: banner, datos, equipo, cuentas, series, FACEIT, ajustes).
       A los NUEVOS (sin ficha todavía) les sale EL PERFIL DE ANTES:
       vantsAbrirMiPerfil → MI PERFIL · PRIMERA VEZ → su ficha de jugador.
       El dashboard ya no es la cara de nadie. */
    try{
      var mio=(window.VANTS_ME&&window.VANTS_ME.player)||null;
      if(!mio&&window.VANTS_AUTH&&window.VANTS_AUTH.playerId){
        mio=(window.VANTS_PLAYERS||[]).find(function(x){return String(x.id)===String(window.VANTS_AUTH.playerId);})||null;
      }
      if(mio&&window.openPlayerProfile){window.openPlayerProfile(mio);return;}
    }catch(e){}
    try{
      if(window.vantsAbrirMiPerfil)window.vantsAbrirMiPerfil(); /* perfil de antes */
      else window.abrirMiCuenta();
    }catch(e){}
  });
  const iv=setInterval(()=>{if(b)b.hidden=!(window.VANTS_AUTH&&window.VANTS_AUTH.sub);},1200);
  setTimeout(()=>clearInterval(iv),45000);
  const iv2=setInterval(()=>{
    if(window.VANTS_AUTH&&window.VANTS_AUTH.sub){clearInterval(iv2);iniciarPresencia();}
  },1500);
  setTimeout(()=>{clearInterval(iv2);},40000);
  setTimeout(()=>{enVivoCargar();},3000);
  setInterval(()=>{if(!document.hidden)enVivoCargar();},30000);
  setInterval(()=>{if(!document.hidden)torneosCargar(true);},30000);
  setInterval(()=>{if(!document.hidden)lbRefrescoVivo();},45000);
})();
