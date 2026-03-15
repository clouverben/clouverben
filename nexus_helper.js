// ==================== NEXUS HELPER v4 ====================
import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';

// ── API KEY (salvo no localStorage) ──────────────────────
let _KEY = localStorage.getItem('nh_key') || '';

// ── helpers ──────────────────────────────────────────────
const $  = id => document.getElementById(id);
const mD = (n=4) => window.markDirty?.(n);
const gAO= () => window.activeObject || null;
const gSc= () => window._nexusScene;
function getMesh(o){if(!o)return null;if(o.isMesh)return o;let r=null;o.traverse(c=>{if(c.isMesh&&!r)r=c;});return r;}
function gWP(o){const v=new THREE.Vector3();o.getWorldPosition(v);return v;}
function getLabel(o){if(!o)return'Obj';const st=o.userData?.shapeType;const m={cube:'Cubo',sphere:'Esfera',cone:'Cone',cylinder:'Cilindro',torus:'Toro'};if(st&&m[st])return m[st];if(o.userData?.isImportedModel)return'Modelo';return'Objeto';}
function toast(msg,ms=2600){let t=$('nh-toast');if(!t){t=document.createElement('div');t.id='nh-toast';t.style.cssText='position:fixed;bottom:22px;left:50%;transform:translateX(-50%) translateY(12px);background:rgba(6,8,20,.97);border:1px solid rgba(95,127,255,.35);border-radius:9px;padding:8px 16px;color:#a5b4fc;font-size:12.5px;font-weight:600;z-index:19999;opacity:0;pointer-events:none;transition:all .22s;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.6)';document.body.appendChild(t);}t.textContent=msg;t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';clearTimeout(t._t);t._t=setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(12px)';},ms);}
function flash(c='rgba(255,255,255,.5)',ms=120){let f=$('nh-flash');if(!f){f=document.createElement('div');f.id='nh-flash';f.style.cssText='position:fixed;inset:0;z-index:19998;pointer-events:none;opacity:0;transition:opacity .06s';document.body.appendChild(f);}f.style.background=c;f.style.opacity='1';clearTimeout(f._t);f._t=setTimeout(()=>f.style.opacity='0',ms);}

// ── Claude API ────────────────────────────────────────────
async function AI(sys,usr,tok=700){
  if(!_KEY){toast('Configure a API Key — ícone chave no header.',4500);return'';}
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'x-api-key':_KEY,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-calls':'true'
      },
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:tok,system:sys,messages:[{role:'user',content:usr}]})
    });
    const d=await r.json();
    if(d.error){toast('IA: '+d.error.message,5000);console.error('[NexusAI]',d.error);return'';}
    return d.content?.[0]?.text||'';
  }catch(e){toast('Erro de conexão com IA: '+e.message,5000);console.error('[NexusAI fetch]',e);return'';}
}

// ── SVG ICONS ─────────────────────────────────────────────
const ICO={
  nexus:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/></svg>`,
  dna:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3c4 3 4 6 0 9s4 9 0 9M19 3c-4 3-4 6 0 9s-4 9 0 9M7 5h10M7 19h10M6 9h12M6 15h12"/></svg>`,
  gem:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 22,8.5 18,21 6,21 2,8.5"/><line x1="2" y1="8.5" x2="22" y2="8.5"/><line x1="12" y1="2" x2="6" y2="21"/><line x1="12" y1="2" x2="18" y2="21"/></svg>`,
  robot:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="11" width="10" height="8" rx="1"/><rect x="9" y="7" width="6" height="4" rx="1"/><circle cx="10" cy="13.5" r="1" fill="currentColor" stroke="none"/><circle cx="14" cy="13.5" r="1" fill="currentColor" stroke="none"/><path d="M9 19v2M15 19v2M7 13H5M19 13h-2M12 7V5"/></svg>`,
  merge:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="12" r="4"/><circle cx="18" cy="12" r="4"/><path d="M10 12h4" stroke-width="2.5"/></svg>`,
  brain:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3a3 3 0 0 0-5 2.46A3 3 0 0 0 2 9a3 3 0 0 0 2.88 3A3 3 0 0 0 9 18v3h6v-3a3 3 0 0 0 4.12-6A3 3 0 0 0 22 9a3 3 0 0 0-2-2.54A3 3 0 0 0 15 3z"/></svg>`,
  zap:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>`,
  shield:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L4 6v6c0 5.2 3.4 10.1 8 11.5C16.6 22.1 20 17.2 20 12V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
  dash:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M15 8l4 4-4 4"/></svg>`,
  acid:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="14" rx="7" ry="7"/><path d="M10 2l2 5 2-5"/><circle cx="9.5" cy="12.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.5" cy="15" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  wave:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="9" stroke-opacity=".4"/></svg>`,
  void:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="5" ry="2.5" stroke-opacity=".5"/><path d="M7 7c1-1 3-1 5 0s4 1 5 0M7 17c1 1 3 1 5 0s4-1 5 0"/></svg>`,
  star:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>`,
  edit:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  close:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  chev:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9,18 15,12 9,6"/></svg>`,
  planet:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"/><ellipse cx="12" cy="12" rx="11.5" ry="4.5" transform="rotate(-20 12 12)" stroke-opacity=".4"/></svg>`,
  gear:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  dice:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.4" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.4" fill="currentColor" stroke="none"/></svg>`,
  skills:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  mineral:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 18.5,6 18.5,14 12,18 5.5,14 5.5,6"/><line x1="12" y1="2" x2="12" y2="18"/><line x1="5.5" y1="6" x2="18.5" y2="14"/><line x1="18.5" y1="6" x2="5.5" y2="14"/></svg>`,
  key:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2L13 10M21 2l-4 4M17 6l-4 4"/></svg>`,
  skip:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5,4 15,12 5,20"/><line x1="19" y1="4" x2="19" y2="20"/></svg>`,
  fire:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2c0 6-6 6-6 12a6 6 0 0 0 12 0c0-4-2-7-6-12z"/><path d="M12 22v-4M9 19c-1.5-1-2-2.5-1-4"/></svg>`,
  ice:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 7l-5 5-5-5M7 17l5-5 5 5"/><path d="M2 12l5-5M22 12l-5-5M2 12l5 5M22 12l-5 5"/></svg>`,
  web:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="2" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="22" y2="12"/></svg>`,
  cosmic:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"/><path d="M12 2a10 10 0 0 1 0 20M12 2a10 10 0 0 0 0 20M2 12a10 10 0 0 1 20 0M2 12a10 10 0 0 0 20 0"/></svg>`,
  sonic:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 13a9 9 0 1 0 9-9"/><path d="M7 8a5 5 0 1 0 5 5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>`,
};
function ico(n,sz=14){const s=ICO[n]||ICO.nexus;return s.replace('<svg',`<svg width="${sz}" height="${sz}" style="flex-shrink:0;vertical-align:middle;display:inline-block"`);}

// ══════════════════════════════════════════════════════════════════
//  CSS
// ══════════════════════════════════════════════════════════════════
(function(){
if(document.getElementById('_nh4css'))return;
const s=document.createElement('style');s.id='_nh4css';s.textContent=`
@keyframes nhFd{from{opacity:0}to{opacity:1}}
@keyframes nhSl{from{opacity:0;transform:translateY(-14px) scale(.97)}to{opacity:1;transform:none}}
@keyframes nhSlL{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:none}}
@keyframes nhGl{0%,100%{box-shadow:0 0 8px rgba(95,127,255,.3)}50%{box-shadow:0 0 22px rgba(95,127,255,.75)}}
@keyframes nhSB{0%{transform:scale(1)}30%{transform:scale(1.14)}65%{transform:scale(.96)}100%{transform:scale(1)}}
@keyframes nhBr{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes nhSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}

.nh-ov{position:fixed;inset:0;background:rgba(0,0,0,.68);backdrop-filter:blur(7px);z-index:9000;display:flex;align-items:center;justify-content:center;animation:nhFd .18s}
.nh-ov.hidden{display:none!important}
#nh-panel{background:rgba(5,7,18,.98);border:1px solid rgba(95,127,255,.28);border-radius:16px;
  box-shadow:0 28px 90px rgba(0,0,0,.92),0 0 50px rgba(95,127,255,.06);
  width:440px;max-width:95vw;max-height:90vh;overflow-y:auto;padding:0 0 20px;
  animation:nhSl .24s cubic-bezier(.34,1.56,.64,1);
  scrollbar-width:thin;scrollbar-color:rgba(95,127,255,.28) transparent}
.nh-hd{display:flex;align-items:center;gap:9px;padding:15px 17px 11px;
  border-bottom:1px solid rgba(255,255,255,.05);position:sticky;top:0;
  background:rgba(5,7,18,.98);border-radius:16px 16px 0 0;z-index:2}
.nh-logo{width:31px;height:31px;border-radius:8px;background:linear-gradient(135deg,#5f7fff,#a78bfa);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 12px rgba(95,127,255,.5)}
.nh-hd h2{margin:0;font-size:14.5px;font-weight:600;background:linear-gradient(90deg,#a5b4fc,#c4b5fd);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;flex:1}
.nh-xb{width:26px;height:26px;border-radius:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);
  color:rgba(255,255,255,.45);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .13s}
.nh-xb:hover{background:rgba(255,50,50,.16);color:#ff6060;border-color:rgba(255,50,50,.3)}
.nh-kb{width:28px;height:28px;border-radius:7px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);
  color:rgba(255,255,255,.4);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .13s;flex-shrink:0}
.nh-kb:hover{background:rgba(95,127,255,.16);color:#a5b4fc;border-color:rgba(95,127,255,.38)}
.nh-kb.on{background:rgba(76,239,172,.13);border-color:rgba(76,239,172,.4);color:#4cefac;animation:nhGl 2.5s infinite}

.nh-edit{margin:13px 13px 2px;width:calc(100% - 26px);padding:10px 13px;
  background:linear-gradient(135deg,rgba(95,127,255,.13),rgba(167,139,250,.07));
  border:1px solid rgba(95,127,255,.28);border-radius:10px;color:#a5b4fc;font-size:12.5px;font-weight:600;
  cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .16s}
.nh-edit:hover{transform:translateY(-1px);box-shadow:0 0 20px rgba(95,127,255,.16);border-color:rgba(95,127,255,.55)}
.nh-ei{width:27px;height:27px;border-radius:7px;background:linear-gradient(135deg,#5f7fff,#a78bfa);display:flex;align-items:center;justify-content:center;flex-shrink:0}

.nh-cat{margin:15px 13px 0}
.nh-ct{font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.22);
  margin-bottom:6px;display:flex;align-items:center;gap:5px}
.nh-ct::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.05)}
.nh-bc{display:flex;flex-direction:column;gap:4px}
.nh-bn{width:100%;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.06);
  background:rgba(255,255,255,.04);color:rgba(255,255,255,.8);font-size:12px;font-weight:500;
  cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .14s;text-align:left}
.nh-bn:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.12);transform:translateX(2px)}
.nh-bn:active{transform:scale(.98)}
.nh-bn .ib{width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nh-bn .bt{flex:1}.nh-bn .bt small{display:block;font-size:9.5px;color:rgba(255,255,255,.28);margin-top:1px}
.cat-evo .nh-bn:hover{border-color:rgba(76,239,172,.3);color:#4cefac}.cat-evo .ib{background:rgba(76,239,172,.1)}
.cat-tx .nh-bn:hover{border-color:rgba(255,190,50,.3);color:#ffd95c}.cat-tx .ib{background:rgba(255,190,50,.1)}
.cat-mech .nh-bn:hover{border-color:rgba(255,100,80,.3);color:#ff8060}.cat-mech .ib{background:rgba(255,100,80,.1)}
.cat-fu .nh-bn:hover{border-color:rgba(200,80,255,.3);color:#cc80ff}.cat-fu .ib{background:rgba(200,80,255,.1)}

.nh-sub{position:fixed;inset:0;z-index:9200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.52);backdrop-filter:blur(4px)}
.nh-sub.hidden{display:none!important}
.nh-sb{background:rgba(5,7,18,.97);border-radius:14px;padding:0 0 14px;width:350px;max-width:92vw;max-height:88vh;overflow-y:auto;animation:nhSl .2s;box-shadow:0 20px 60px rgba(0,0,0,.8);scrollbar-width:thin;scrollbar-color:rgba(95,127,255,.22) transparent}
.nh-sh{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.05);display:flex;align-items:center;gap:7px}
.nh-sh h3{margin:0;font-size:13px;font-weight:600;flex:1}
.nh-sl{padding:9px 11px 0;display:flex;flex-direction:column;gap:4px}
.nh-sbn{padding:9px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.04);
  color:rgba(255,255,255,.78);font-size:12px;cursor:pointer;display:flex;align-items:center;gap:7px;transition:all .13s;text-align:left;width:100%}
.nh-sbn:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.13)}

/* Evolution overlay — compact */
#nh-evo{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9400;
  background:rgba(3,4,13,.98);border:1px solid rgba(95,127,255,.32);border-radius:15px;
  padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px;
  width:min(570px,94vw);box-shadow:0 30px 100px rgba(0,0,0,.96);animation:nhSl .28s cubic-bezier(.34,1.56,.64,1)}
#nh-evo.hidden{display:none!important}
.evo-bar{display:flex;align-items:center;gap:7px;width:100%;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.05)}
.evo-bar h3{margin:0;flex:1;font-size:12.5px;font-weight:600;color:#a5b4fc}
#nh-evo-cv{border:1px solid rgba(95,127,255,.18);border-radius:8px;width:100%;height:auto}
.evo-st{display:flex;gap:6px;flex-wrap:wrap;font-size:9.5px;color:rgba(255,255,255,.45);font-family:monospace;width:100%;justify-content:center}
.evo-st span{background:rgba(255,255,255,.05);padding:2px 8px;border-radius:4px}
.evo-ph{font-size:10.5px;color:rgba(165,180,252,.65);font-family:monospace;text-align:center}
.evo-ac{display:flex;gap:7px}
.evo-btn{padding:7px 15px;border-radius:7px;border:1px solid rgba(95,127,255,.28);background:rgba(95,127,255,.07);
  color:#a5b4fc;font-size:11px;cursor:pointer;transition:all .13s;display:flex;align-items:center;gap:5px}
.evo-btn:hover{background:rgba(95,127,255,.16);border-color:rgba(95,127,255,.5)}
.evo-btn.red{border-color:rgba(255,70,70,.28);background:rgba(255,70,70,.06);color:#ff7070}
.evo-btn.red:hover{background:rgba(255,70,70,.15)}
.ai-lbl{font-size:9.5px;color:rgba(180,130,255,.75);font-family:monospace;animation:nhBr 1.4s infinite;display:flex;align-items:center;gap:4px}

/* Skills toggle button */
#nh-skt{position:fixed;bottom:68px;left:12px;z-index:7999;
  background:rgba(5,7,18,.96);border:1px solid rgba(95,127,255,.42);border-radius:9px;
  padding:8px 13px;color:#a5b4fc;font-size:11.5px;cursor:pointer;font-weight:600;
  display:flex;align-items:center;gap:6px;
  animation:nhSlL .2s ease,nhGl 2.5s infinite;
  box-shadow:0 4px 22px rgba(0,0,0,.6);transition:all .15s}
#nh-skt:hover{background:rgba(95,127,255,.12);transform:translateX(2px)}
#nh-skt.hidden{display:none!important}

/* Skill panel */
#nh-skp{position:fixed;left:0;top:50%;transform:translateY(-50%);
  background:rgba(5,7,18,.97);border:1px solid rgba(95,127,255,.22);border-radius:0 12px 12px 0;
  padding:8px 0 10px;width:268px;z-index:8000;box-shadow:5px 0 22px rgba(0,0,0,.6);animation:nhSlL .18s ease}
#nh-skp.hidden{display:none}
.sk-hd{padding:7px 13px 9px;border-bottom:1px solid rgba(255,255,255,.05);display:flex;align-items:center;gap:7px}
.sk-ic{width:30px;height:30px;border-radius:7px;background:rgba(95,127,255,.1);border:1px solid rgba(95,127,255,.22);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sk-hd h4{margin:0;font-size:12px;color:#a5b4fc;flex:1}
.sk-row{display:flex;align-items:center;padding:5px 11px;gap:7px;cursor:pointer;transition:background .12s;position:relative}
.sk-row:hover{background:rgba(255,255,255,.04)}
.sk-row.burst{animation:nhSB .38s ease}
.sk-ico{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .14s}
.sk-row:hover .sk-ico{transform:scale(1.1)}
.sk-inf{flex:1}
.sk-nm{font-size:11px;font-weight:600;color:rgba(255,255,255,.85)}
.sk-ds{font-size:9.5px;color:rgba(255,255,255,.28)}
.sk-rg{display:flex;gap:2px;margin-top:1px}
.sk-rg span{width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,.1)}
.sk-rg span.on{background:currentColor}
.sk-cfg{width:18px;height:18px;border-radius:4px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.35);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .12s}
.sk-cfg:hover{background:rgba(95,127,255,.18);color:#a5b4fc}
.sk-sp{background:rgba(255,200,50,.05);border-top:1px solid rgba(255,200,50,.09)}
.sk-sp .sk-nm{color:#ffd95c}
.sk-div{height:1px;background:rgba(255,255,255,.04);margin:5px 11px}

/* Skill config */
#nh-skcf{position:fixed;left:272px;top:50%;transform:translateY(-50%);background:rgba(5,7,18,.97);border:1px solid rgba(95,127,255,.22);border-radius:11px;padding:13px;width:215px;z-index:8001;box-shadow:4px 0 22px rgba(0,0,0,.6);animation:nhSl .16s ease}
#nh-skcf.hidden{display:none}
.cf-hd{display:flex;align-items:center;gap:6px;margin-bottom:11px}
.cf-hd h5{margin:0;font-size:11.5px;color:#a5b4fc;flex:1}
.cf-lb{font-size:9.5px;color:rgba(255,255,255,.32);margin-bottom:4px;text-transform:uppercase;letter-spacing:.07em}
.cf-sc{margin-bottom:9px}
.cf-rg{display:flex;gap:3px}
.cf-dot{width:13px;height:13px;border-radius:50%;cursor:pointer;transition:all .12s;border:1px solid rgba(255,255,255,.12)}
.cf-dot:hover{transform:scale(1.2)}
.cf-cl{display:flex;gap:4px;flex-wrap:wrap}
.cf-sw{width:17px;height:17px;border-radius:4px;cursor:pointer;border:2px solid transparent;transition:all .11s}
.cf-sw:hover,.cf-sw.on{border-color:#fff;transform:scale(1.12)}
.cf-rw{display:flex;gap:4px;align-items:center}
.cf-rw input{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:5px;padding:3px 6px;color:rgba(255,255,255,.78);font-size:10.5px;outline:none}
.cf-ok{width:100%;margin-top:9px;padding:6px;border-radius:7px;border:1px solid rgba(95,127,255,.28);background:rgba(95,127,255,.1);color:#a5b4fc;font-size:11px;cursor:pointer;transition:all .12s}
.cf-ok:hover{background:rgba(95,127,255,.2)}

/* AI Fusion */
#nh-aif{position:fixed;inset:0;z-index:9200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.62);backdrop-filter:blur(5px)}
#nh-aif.hidden{display:none!important}
.aif-bx{background:rgba(5,7,18,.97);border:1px solid rgba(200,80,255,.28);border-radius:13px;width:395px;max-width:92vw;max-height:85vh;display:flex;flex-direction:column;animation:nhSl .2s;box-shadow:0 20px 60px rgba(0,0,0,.88)}
.aif-hd{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.05);display:flex;align-items:center;gap:7px}
.aif-hd h3{margin:0;font-size:13px;color:#cc80ff;flex:1}
.aif-ms{flex:1;overflow-y:auto;padding:11px;display:flex;flex-direction:column;gap:7px;min-height:180px;max-height:320px;scrollbar-width:thin;scrollbar-color:rgba(200,80,255,.22) transparent}
.aif-m{padding:7px 10px;border-radius:7px;font-size:11.5px;line-height:1.5;max-width:88%}
.aif-m.user{background:rgba(95,127,255,.13);border:1px solid rgba(95,127,255,.18);align-self:flex-end;color:rgba(255,255,255,.85)}
.aif-m.ai{background:rgba(200,80,255,.09);border:1px solid rgba(200,80,255,.18);align-self:flex-start;color:rgba(255,255,255,.8)}
.aif-m.sys{background:rgba(255,255,255,.04);align-self:center;color:rgba(255,255,255,.38);font-style:italic;font-size:10.5px}
.aif-ir{padding:9px 11px;border-top:1px solid rgba(255,255,255,.05);display:flex;gap:6px}
.aif-in{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:6px 9px;color:rgba(255,255,255,.85);font-size:11.5px;outline:none;resize:none}
.aif-in:focus{border-color:rgba(200,80,255,.38)}
.aif-sd{padding:0 12px;border-radius:7px;border:1px solid rgba(200,80,255,.28);background:rgba(200,80,255,.1);color:#cc80ff;font-size:11.5px;cursor:pointer;transition:all .12s}
.aif-ap{margin:5px 11px 9px;padding:8px;border-radius:8px;border:1px solid rgba(200,80,255,.28);background:rgba(200,80,255,.09);color:#cc80ff;font-size:12px;cursor:pointer;width:calc(100% - 22px);transition:all .13s}
.aif-ap.hidden{display:none}

/* API Key modal */
#nh-km{position:fixed;inset:0;z-index:9600;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);backdrop-filter:blur(7px)}
#nh-km.hidden{display:none!important}
.km-bx{background:rgba(5,7,18,.98);border:1px solid rgba(95,127,255,.38);border-radius:14px;padding:22px;width:370px;max-width:92vw;animation:nhSl .22s;box-shadow:0 20px 60px rgba(0,0,0,.95)}
.km-bx h3{margin:0 0 5px;font-size:13.5px;color:#a5b4fc;display:flex;align-items:center;gap:7px}
.km-bx p{font-size:10.5px;color:rgba(255,255,255,.35);margin:0 0 13px;line-height:1.65}
.km-in{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(95,127,255,.28);border-radius:8px;padding:8px 11px;color:rgba(255,255,255,.85);font-size:12px;font-family:monospace;outline:none;box-sizing:border-box;margin-bottom:10px}
.km-in:focus{border-color:rgba(95,127,255,.6)}
.km-st{font-size:10.5px;margin-bottom:10px;min-height:15px;font-family:monospace}
.km-st.ok{color:#4cefac}.km-st.err{color:#ff5252}
.km-ac{display:flex;gap:7px}
.km-sv{flex:1;padding:8px;border-radius:8px;border:1px solid rgba(95,127,255,.38);background:rgba(95,127,255,.12);color:#a5b4fc;font-size:12px;font-weight:600;cursor:pointer;transition:all .13s}
.km-sv:hover{background:rgba(95,127,255,.24)}
.km-cl{padding:8px 12px;border-radius:8px;border:1px solid rgba(255,70,70,.28);background:rgba(255,70,70,.07);color:#ff7070;font-size:11.5px;cursor:pointer;transition:all .13s}
.km-cl:hover{background:rgba(255,70,70,.16)}

/* Progress */
#nh-prg{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;pointer-events:none}
#nh-prg.hidden{display:none}
.prg-bx{background:rgba(5,7,18,.97);border:1px solid rgba(95,127,255,.26);border-radius:12px;padding:20px 26px;text-align:center;min-width:220px;box-shadow:0 20px 50px rgba(0,0,0,.8)}
.prg-tt{font-size:13px;color:#a5b4fc;font-weight:600;margin-bottom:9px}
.prg-tr{width:100%;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden}
.prg-fl{height:100%;background:linear-gradient(90deg,#5f7fff,#a78bfa);border-radius:2px;transition:width .07s;box-shadow:0 0 7px rgba(95,127,255,.5)}
.prg-lb{font-size:10px;color:rgba(255,255,255,.32);margin-top:6px;font-family:monospace}
`;
document.head.appendChild(s);
})();

// ══════════════════════════════════════════════════════════════════
//  MATERIALS
// ══════════════════════════════════════════════════════════════════
const MAT_DEFS={
  gold:{color:0xffd700,emissive:0x553300,emissiveI:.38,rough:.09,metal:1,spk:0xffd700},
  silver:{color:0xdde0ee,emissive:0x111122,emissiveI:.07,rough:.05,metal:1,spk:0xe0e8ff},
  copper:{color:0xb87333,emissive:0x2a1200,emissiveI:.2,rough:.27,metal:.85,spk:0xff8c42},
  emerald:{color:0x50c878,emissive:0x003a1a,emissiveI:.48,rough:.03,metal:0,spk:0x00ff88,tr:true,op:.82},
  obsidian:{color:0x111118,emissive:0x22003a,emissiveI:.24,rough:.02,metal:.6,spk:0x9944ff},
  ruby:{color:0xcc1020,emissive:0x440010,emissiveI:.58,rough:.02,metal:0,spk:0xff2244,tr:true,op:.85},
  diamond:{color:0xccf4ff,emissive:0x002244,emissiveI:.85,rough:0,metal:0,spk:0xaaeeff,tr:true,op:.75},
  nano:{color:0x001133,emissive:0x0055cc,emissiveI:2.2,rough:.03,metal:.9,spk:0x00aaff},
  plasma:{color:0x220044,emissive:0x8800cc,emissiveI:3.2,rough:0,metal:0,spk:0xcc44ff,tr:true,op:.9},
};
function getMaterialType(o){
  if(!o)return'organic';const m=getMesh(o)?.material;if(!m)return'organic';
  for(const[k,d]of Object.entries(MAT_DEFS))if(m.color&&Math.abs(m.color.getHex()-d.color)<0x101010)return k;
  if(m.metalness>.8)return'metal';if(m.transparent)return'crystal';return'organic';
}
const MAT_BONUS={
  gold:{armor:.6,strength:.35},silver:{speed:.35,stealth:.5},copper:{armor:.3,strength:.4},
  emerald:{stealth:.65,t:'regeneration'},obsidian:{armor:1.1,t:'void_shroud'},
  ruby:{t:'plasma_core',strength:.55},diamond:{armor:1.6,t:'crystalline_shell'},
  nano:{speed:.85,t:'neural_sync'},plasma:{t:'plasma_core',strength:.75},
  metal:{armor:.45,strength:.32},crystal:{armor:.55,t:'crystalline_shell'},organic:{t:'regeneration',speed:.22},
};

function applyMaterial(type){
  const o=gAO();if(!o){toast('Selecione um objeto.');return;}
  const d=MAT_DEFS[type];if(!d)return;
  $('nh-txs')?.classList.add('hidden');
  const wp=gWP(o);
  o.traverse(c=>{
    if(!c.isMesh)return;
    const m=c.material instanceof THREE.MeshStandardMaterial?c.material:new THREE.MeshStandardMaterial();
    m.color.setHex(d.color);m.emissive.setHex(d.emissive);m.emissiveIntensity=d.emissiveI;
    m.roughness=d.rough;m.metalness=d.metal;
    if(d.tr){m.transparent=true;m.opacity=d.op;}else{m.transparent=false;m.opacity=1;}
    m.needsUpdate=true;c.material=m;
  });
  o.userData.materialType=type;
  sfxBurst(wp,d.spk,80,5);toast(`Transformado em ${type}!`,2200);mD(4);
}

async function handleTxAI(){
  const o=gAO();if(!o){toast('Selecione um objeto.');return;}closeHelper();
  const lb=getLabel(o),m=getMesh(o)?.material;
  const ms=m?`cor:#${m.color?.getHexString()},rough:${m.roughness?.toFixed(2)},metal:${m.metalness?.toFixed(2)}`:'?';
  toast('IA analisando...',3000);
  const t=await AI('Escolha o MELHOR material para este objeto 3D de uma lista. Lista:gold,silver,copper,emerald,obsidian,ruby,diamond,nano,plasma. Responda APENAS o nome (1 palavra).',`Objeto:${lb}, material:${ms}`);
  const ch=t.trim().toLowerCase().replace(/[^a-z]/g,'');
  if(MAT_DEFS[ch]){toast(`IA: ${ch}! Aplicando...`,1800);setTimeout(()=>applyMaterial(ch),500);}
  else toast(`IA: "${t.trim()}" — não reconhecido.`,3000);
}

// ══════════════════════════════════════════════════════════════════
//  MECH
// ══════════════════════════════════════════════════════════════════
async function handleMechAI(){
  const o=gAO();if(!o){toast('Selecione um objeto.');return;}closeHelper();
  const lb=getLabel(o),mt=getMaterialType(o);
  toast('IA desenhando o mech...',3000);
  const t=await AI('Designer de mechs. Em 1-2 frases curtas em português, descreva: tipo de armas, cor dominante, estilo (pesado/ágil/stealth). Épico e direto.', `Objeto:${lb}, material:${mt}`);
  if(t)toast(`IA: ${t}`,6000);
  setTimeout(handleMech,1500);
}

function handleMech(){
  const o=gAO();if(!o){toast('Selecione um objeto.');return;}
  const mesh=getMesh(o);if(!mesh)return;
  const sc=gSc();if(!sc)return;
  const lb=getLabel(o);closeHelper();
  const wp=gWP(o);const ws=new THREE.Vector3();o.getWorldScale(ws);const S=Math.max(ws.x,ws.y,ws.z);
  o.visible=false;sfxBurst(wp,0xff6020,100,6);
  const mch=buildMech(wp,S);const all=[...mch.body,...mch.gears,...mch.lights,...mch.cannons];
  all.forEach(p=>{sc.add(p);p.visible=false;p.scale.setScalar(0);});
  const FE=55,FF=100,FR=50,TOT=FE+FF+FR;
  const frags=buildFragments(mesh,wp,S,32);frags.forEach(f=>sc.add(f));
  let fr=0;setProgress('Transformando em Mech…',0,'Desmontando…');
  const tick=()=>{
    fr++;const t=fr/TOT;
    if(fr<=FE){const lt=fr/FE;setProgress('Transformando…',~~(t*100),'Desmontando…');
      frags.forEach(f=>{f.position.addScaledVector(f.userData.vel,1);f.rotation.x+=f.userData.rv.x;f.rotation.y+=f.userData.rv.y;f.userData.vel.multiplyScalar(.91);f.material.opacity=Math.max(0,1-lt*1.4);});}
    else if(fr<=FE+FF){const lt=(fr-FE)/FF;setProgress('Transformando…',~~(t*100),'Montando…');
      frags.forEach(f=>{f.position.lerp(wp,.1);f.material.opacity=Math.max(0,.4-lt*.5);});
      mch.body.forEach((p,i)=>{const d=i/mch.body.length*.55,lt2=Math.max(0,(lt-d)/(1-d));
        const e=lt2<.5?2*lt2*lt2:1-Math.pow(-2*lt2+2,2)/2;
        p.visible=lt2>.01;p.scale.setScalar(e);
        if(p.userData.ua){p.rotation[p.userData.ua]=THREE.MathUtils.lerp(p.userData.uf,p.userData.ut,e);}
        if(p.material)p.material.emissiveIntensity=.3+Math.sin(fr*.3+i)*.3;});}
    else{setProgress('Transformando…',~~(t*100),'Sistemas online!');
      mch.body.forEach(p=>{if(p.material)p.material.emissiveIntensity=Math.max(.1,p.material.emissiveIntensity*.95);});}
    if(fr>FE){
      mch.gears.forEach((g,i)=>{const v=Math.min(1,(fr-FE)/30);g.visible=v>.05;g.scale.setScalar(v);g.rotation.z+=.06*(i%2?1:-1);});
      mch.lights.forEach((l,i)=>{const v=Math.min(1,(fr-FE)/25);l.visible=v>.05;l.scale.setScalar(v);if(l.material)l.material.emissiveIntensity=1.5+Math.sin(fr*.18+i)*.8;});
      mch.cannons.forEach(c=>{const v=Math.min(1,(fr-FE)/40);c.visible=v>.05;c.scale.setScalar(v);});}
    mD(2);if(fr<TOT){requestAnimationFrame(tick);return;}
    frags.forEach(f=>{f.removeFromParent();f.geometry?.dispose();f.material?.dispose();});hideProgress();
    const mg=new THREE.Group();mg.name=`Mech_${lb}`;mg.userData.shapeType='mech';
    sc.add(mg);all.forEach(p=>{p.removeFromParent();p.position.sub(wp);mg.add(p);});mg.position.copy(wp);
    window.sceneObjects?.push(mg);
    const ga=()=>{if(!mg.parent)return;mch.gears.forEach((g,i)=>g.rotation.z+=.025*(i%2?1:-1));mch.lights.forEach((l,i)=>{if(l.material)l.material.emissiveIntensity=1.5+Math.sin(Date.now()*.003+i)*.7;});mD(1);requestAnimationFrame(ga);};
    requestAnimationFrame(ga);sfxBurst(wp,0xff6020,80,5);toast(`${lb} → Mech Online!`,3500);mD(4);};
  requestAnimationFrame(tick);
}
function buildFragments(mesh,c,S,n){
  const bb=new THREE.Box3().setFromObject(mesh);const sz=new THREE.Vector3();bb.getSize(sz);
  const fc=mesh.material?.color?mesh.material.color.getHex():0x888888;
  return Array.from({length:n},()=>{
    const g=new THREE.BoxGeometry(sz.x/6*(Math.random()*.7+.3),sz.y/6*(Math.random()*.7+.3),sz.z/6*(Math.random()*.7+.3));
    const m=new THREE.MeshStandardMaterial({color:fc,roughness:.5,metalness:.3,emissive:0xff4400,emissiveIntensity:.5,transparent:true,opacity:1});
    const f=new THREE.Mesh(g,m);
    f.position.set(c.x+(Math.random()-.5)*sz.x,c.y+(Math.random()-.5)*sz.y,c.z+(Math.random()-.5)*sz.z);
    f.rotation.set(Math.random()*Math.PI*2,Math.random()*Math.PI*2,Math.random()*Math.PI*2);
    f.userData.vel=new THREE.Vector3((Math.random()-.5)*.35,Math.random()*.28+.06,(Math.random()-.5)*.35);
    f.userData.rv=new THREE.Vector3((Math.random()-.5)*.18,(Math.random()-.5)*.18,(Math.random()-.5)*.18);
    return f;});
}
function buildMech(c,S){
  const body=[],gears=[],lights=[],cannons=[];
  const M=(col,em=0x001133)=>new THREE.MeshStandardMaterial({color:col,roughness:.25,metalness:.82,emissive:em,emissiveIntensity:.4});
  const A=(g,m,ox,oy,oz,ua=null,uf=0,ut=0)=>{const p=new THREE.Mesh(g,m);p.position.set(c.x+ox*S,c.y+oy*S,c.z+oz*S);p.castShadow=p.receiveShadow=true;if(ua){p.userData.ua=ua;p.userData.uf=uf;p.userData.ut=ut;p.rotation[ua]=uf;}body.push(p);return p;};
  A(new THREE.BoxGeometry(S*.72,S*.82,S*.46),M(0x334466,0x001133),0,.28,0,'x',Math.PI,0);
  A(new THREE.BoxGeometry(S*.5,S*.3,S*.12),M(0x445577,0x002244),0,.42,.24,'z',-Math.PI*.5,0);
  A(new THREE.CylinderGeometry(S*.1,S*.1,S*.06,12),new THREE.MeshStandardMaterial({color:0x002266,emissive:0x0088ff,emissiveIntensity:3,roughness:0,metalness:.9}),0,.34,.24);
  A(new THREE.BoxGeometry(S*.38,S*.32,S*.36),M(0x2244aa,0x0022ff),0,.84,0,'x',-Math.PI,0);
  A(new THREE.BoxGeometry(S*.32,S*.1,S*.08),new THREE.MeshStandardMaterial({color:0x001133,emissive:0x00ffff,emissiveIntensity:2.5,roughness:0}),0,.84,.19);
  [-1,1].forEach(s=>{const e=new THREE.Mesh(new THREE.SphereGeometry(S*.04,6,6),new THREE.MeshStandardMaterial({color:0,emissive:0x00ddff,emissiveIntensity:4,roughness:0}));e.position.set(c.x+s*S*.09,c.y+S*.88,c.z+S*.19);lights.push(e);});
  [-1,1].forEach(s=>{A(new THREE.SphereGeometry(S*.22,10,10),M(0x445577,0x001144),s*.56,.5,0,'y',s*Math.PI,0);A(new THREE.CylinderGeometry(S*.1,S*.08,S*.48,8),M(0x334455),s*.62,.13,0,'z',s*Math.PI*.5,s*.22);A(new THREE.SphereGeometry(S*.1,7,7),M(0x445566),s*.66,-.18,0);A(new THREE.CylinderGeometry(S*.08,S*.1,S*.44,8),M(0x3d5060),s*.7,-.44,0,'z',s*Math.PI,s*.05);[-1,0,1].forEach(f=>A(new THREE.BoxGeometry(S*.06,S*.18,S*.05),M(0x223344),s*.7+f*S*.07,-.68,.03));});
  A(new THREE.BoxGeometry(S*.55,S*.22,S*.42),M(0x2a3a4e,0x001122),0,-.12,0,'x',Math.PI*.5,0);
  [-1,1].forEach(s=>{A(new THREE.CylinderGeometry(S*.14,S*.12,S*.54,8),M(0x334455),s*.22,-.5,0,'z',s*Math.PI*.4,0);A(new THREE.SphereGeometry(S*.13,7,7),M(0x445566),s*.22,-.78,0);A(new THREE.CylinderGeometry(S*.11,S*.13,S*.48,8),M(0x3d4f60),s*.22,-1.0,0,'x',-Math.PI*.4,0);A(new THREE.BoxGeometry(S*.22,S*.1,S*.38),M(0x223344),s*.22,-1.22,.08);});
  [-1,1].forEach(s=>{const cg=new THREE.CylinderGeometry(S*.07,S*.09,S*.5,8);const cm=new THREE.MeshStandardMaterial({color:0x112233,emissive:0xff4400,emissiveIntensity:1.5,roughness:.2,metalness:.9});const can=new THREE.Mesh(cg,cm);can.position.set(c.x+s*S*.62,c.y+S*.72,c.z+S*.1);can.rotation.x=Math.PI*.5;cannons.push(can);const tip=new THREE.Mesh(new THREE.SphereGeometry(S*.07,6,6),new THREE.MeshStandardMaterial({color:0,emissive:0xff6600,emissiveIntensity:3,roughness:0}));tip.position.set(c.x+s*S*.62,c.y+S*.72,c.z+S*.35);lights.push(tip);});
  for(let i=0;i<5;i++){const g=new THREE.Mesh(new THREE.TorusGeometry(S*(.05+i*.018),S*.012,4,10),new THREE.MeshStandardMaterial({color:0x778899,metalness:.92,roughness:.15}));g.position.set(c.x+(i-2)*S*.14,c.y+S*.1,c.z+S*.24);g.rotation.x=Math.PI*.5;gears.push(g);}
  return{body,gears,lights,cannons};
}
function setProgress(t,p,l){const el=$('nh-prg');if(!el)return;el.classList.remove('hidden');const ti=$('prg-tt'),fi=$('prg-fl'),li=$('prg-lb');if(ti)ti.textContent=t;if(fi)fi.style.width=p+'%';if(li)li.textContent=l||(p+'%');}
function hideProgress(){$('nh-prg')?.classList.add('hidden');}

// ══════════════════════════════════════════════════════════════════
//  PROCEDURAL EVOLUTION — 2M+ combinações
// ══════════════════════════════════════════════════════════════════

// Seeded random (para reprodução determinística)
function mkRng(seed){let s=seed;return()=>{s=(s*9301+49297)%233280;return s/233280;};}

// ── PLANETA PROCEDURAL (2M+ variações) ────────────────────────────
const PLANET_HAZARDS=['acid','fire','ice','pressure','storm','psionic','crystal','void','radiation','gravity','spore','sonic','magnet','nano','temporal'];
const PLANET_ADJ=['Mortal','Vivo','Antigo','Sombrio','Ardente','Gélido','Tóxico','Pulsante','Eterno','Oculto','Profundo','Cósmico','Mutante','Elétrico','Primordial'];
const PLANET_NOUN=['Nexus','Vex','Kron','Thal','Ora','Zyr','Mak','Fen','Dor','Qua','Lis','Vorn','Ekt','Phal','Urus'];
const SKY_PALETTES=[[['#000005','#050018','#0a0030'],['#000510','#001028','#002050']],[['#100000','#280800','#3a1200'],['#1a0300','#330600','#4a1000']],[['#000808','#001a1a','#003030'],['#001010','#002828','#004040']],[['#080010','#180028','#2a0040'],['#100020','#220038','#380058']],[['#050500','#121200','#202000'],['#080800','#181800','#282800']]];
const GROUND_COLS=['#0e220e','#2a0a00','#001528','#110028','#1a1400','#003028','#280000','#001832','#221400','#002010'];
const ATM_COLS=['rgba(42,90,10,.2)','rgba(255,68,0,.2)','rgba(17,51,170,.2)','rgba(136,34,255,.2)','rgba(255,204,0,.2)','rgba(0,204,255,.2)','rgba(255,34,0,.2)','rgba(68,0,204,.2)','rgba(0,255,136,.2)','rgba(255,136,0,.2)'];

function genPlanet(seed){
  const r=mkRng(seed);
  const pi=~~(r()*PLANET_ADJ.length),ni=~~(r()*PLANET_NOUN.length);
  const name=PLANET_ADJ[pi]+' '+PLANET_NOUN[ni];
  const hazardIdx=~~(r()*PLANET_HAZARDS.length);const hazard=PLANET_HAZARDS[hazardIdx];
  const palIdx=~~(r()*SKY_PALETTES.length);const pal=SKY_PALETTES[palIdx];
  const skyPal=pal[~~(r()*pal.length)];
  const ground=GROUND_COLS[~~(r()*GROUND_COLS.length)];
  const atm=ATM_COLS[~~(r()*ATM_COLS.length)];
  const moons=~~(r()*4);
  const ringProb=r()<.3;
  const starDensity=.4+r()*.6;
  const nebula=r()<.4;
  const nebulaCol=`hsl(${~~(r()*360)},${~~(40+r()*50)}%,${~~(15+r()*25)}%)`;
  const hazardDescs={acid:'Oceanos ácidos, chuva corrosiva',fire:'Magma e tempestades de fogo',ice:'Gelo eterno e ventos glaciais',pressure:'Pressão extrema das profundezas',storm:'Tempestades elétricas permanentes',psionic:'Campos psíquicos letais',crystal:'Formações cristalinas cortantes',void:'Espaço dobrado e anomalias',radiation:'Radiação letal e mutações',gravity:'Gravidade variável e colapsos',spore:'Esporos tóxicos no ar',sonic:'Frequências sonoras destrutivas',magnet:'Campos magnéticos colossal',nano:'Nanobots autônomos hostis',temporal:'Ondas de distorção temporal'};
  return{name,hazard,sky:skyPal,ground,atm,moons,ringProb,starDensity,nebula,nebulaCol,desc:hazardDescs[hazard]||'Perigo desconhecido',seed};
}

// ── PREDADOR PROCEDURAL ────────────────────────────────────────────
const PRED_PREFIXES=['Skarn','Venom','Kral','Omni','Ground','Shadow','Blaze','Nexal','Void','Storm','Cryo','Acid','Psi','Nano','Echo'];
const PRED_SUFFIXES=['ex','rak','spider','vex','borer','lurk','horn','hunter','reaver','stalker','jaw','fang','beast','lord','prime'];
function genPredator(seed){
  const r=mkRng(seed);
  return{
    name:PRED_PREFIXES[~~(r()*PRED_PREFIXES.length)]+PRED_SUFFIXES[~~(r()*PRED_SUFFIXES.length)],
    color:`hsl(${~~(r()*360)},${~~(40+r()*50)}%,${~~(20+r()*30)}%)`,
    size:8+~~(r()*14),speed:1.5+r()*3,dmg:1+~~(r()*3),sense:60+~~(r()*120),
    legs:~~([2,4,6,8][~~(r()*4)]),armored:r()>.5,venomous:r()>.4,
  };
}

// ── MUTATION POOL — 200 traits ─────────────────────────────────────
const TRAITS=[
  // Physical
  'spikes','thick_skin','camouflage','extra_limbs','bioluminescence','crystalline_shell','flight_membrane',
  'bone_armor','scale_coat','quill_burst','tail_whip','claw_blades','wing_membranes','dorsal_fin',
  'multi_head','compound_eyes','mandibles','segmented_body','exoskeleton','endoskeleton',
  // Elemental
  'acid_blood','fire_core','ice_organs','void_shroud','plasma_core','lightning_sacs','spore_glands',
  'magnet_organs','sonic_glands','radiation_gland','crystal_core','nano_swarm','temporal_gland',
  'gravity_organ','psionic_node',
  // Ability
  'regeneration','heat_vision','echo_sense','neural_sync','temporal_dodge','quantum_phase',
  'venomous_bite','poison_sac','graviton_glands','magnetic_sense','psionic_shield','void_step',
  'acid_spray','fire_breath','ice_breath','lightning_strike','spore_cloud','nano_repair',
  // Rare
  'dual_genome','omega_cell','cosmic_core','nexal_sync','prime_evolution',
];

// ── ARCHETYPE SYSTEM — 40 archetypes ──────────────────────────────
const ARCHETYPES=[
  {n:'Venom Apex',    c:'#8B3A3A',t:{speed:5,armor:3,stealth:4,strength:3,spikes:true},       plan:'biped',    icon:'acid'},
  {n:'Ferro Carapax', c:'#B09020',t:{speed:2,armor:6,stealth:1,strength:5,shell:true},         plan:'hexapod',  icon:'shield'},
  {n:'Titanorak',     c:'#3a5a2a',t:{speed:2,armor:5,stealth:1,strength:6,bulk:true},          plan:'biped',    icon:'star'},
  {n:'Echo Specter',  c:'#3388cc',t:{speed:4,armor:2,stealth:3,strength:3,sonic:true},         plan:'slender',  icon:'sonic'},
  {n:'Pyrovex',       c:'#cc4a10',t:{speed:3,armor:3,stealth:2,strength:4,fire:true},          plan:'dragon',   icon:'fire'},
  {n:'Glacius Rex',   c:'#223355',t:{speed:4,armor:3,stealth:5,strength:3,ice:true},           plan:'biped',    icon:'ice'},
  {n:'Arachna Prime', c:'#5a3a8a',t:{speed:5,armor:2,stealth:4,strength:4,web:true},           plan:'spider',   icon:'web'},
  {n:'Void Entity',   c:'#110022',t:{speed:3,armor:6,stealth:2,strength:6,cosmic:true},        plan:'floating', icon:'void'},
  {n:'Storm Hydra',   c:'#1a2a44',t:{speed:4,armor:3,stealth:2,strength:5,lightning:true},     plan:'serpent',  icon:'zap'},
  {n:'Spore Colossus',c:'#2a4a1a',t:{speed:2,armor:4,stealth:2,strength:4,spore:true},         plan:'quadruped',icon:'cosmic'},
  {n:'Psi Wraith',    c:'#2a0044',t:{speed:5,armor:2,stealth:6,strength:3,psionic:true},       plan:'slender',  icon:'cosmic'},
  {n:'Nano Fiend',    c:'#002244',t:{speed:5,armor:3,stealth:4,strength:4,nano:true},          plan:'biped',    icon:'brain'},
  {n:'Crystal Titan', c:'#445566',t:{speed:2,armor:7,stealth:1,strength:5,crystal:true},       plan:'biped',    icon:'mineral'},
  {n:'Magma Drake',   c:'#aa3300',t:{speed:3,armor:4,stealth:1,strength:5,magma:true},         plan:'dragon',   icon:'fire'},
  {n:'Temporal Shade',c:'#1a1a3a',t:{speed:6,armor:2,stealth:5,strength:3,temporal:true},      plan:'slender',  icon:'dash'},
  {n:'Acid Wyrm',     c:'#2a5a00',t:{speed:4,armor:3,stealth:3,strength:4,acid:true},          plan:'serpent',  icon:'acid'},
  {n:'Gravity Hulk',  c:'#3a3a3a',t:{speed:1,armor:6,stealth:1,strength:7,gravity:true},       plan:'biped',    icon:'star'},
  {n:'Phase Dancer',  c:'#4a1a6a',t:{speed:6,armor:1,stealth:6,strength:3,phase:true},         plan:'floating', icon:'dash'},
  {n:'Bone Reaper',   c:'#4a4040',t:{speed:4,armor:4,stealth:3,strength:5,undead:true},        plan:'biped',    icon:'zap'},
  {n:'Sea Leviathan', c:'#0a2a4a',t:{speed:3,armor:5,stealth:3,strength:6,aquatic:true},       plan:'serpent',  icon:'wave'},
];

// ── POWER POOL — 100 poderes únicos ───────────────────────────────
const POWERS=[
  {id:'nexal_strike',  n:'Nexal Strike',   ico:'zap',    desc:'Ataque energético nexal',        col:'#5f7fff',eff:'lightning',  sfx:'lightning'},
  {id:'bio_shield',    n:'Bio Shield',     ico:'shield', desc:'Barreira orgânica reflexiva',    col:'#4cefac',eff:'shield',    sfx:'shield'},
  {id:'quantum_dash',  n:'Quantum Dash',   ico:'dash',   desc:'Teleporte quântico',             col:'#c4b5fd',eff:'blink',     sfx:'blink'},
  {id:'acid_torrent',  n:'Acid Torrent',   ico:'acid',   desc:'Spray ácido corrosivo',          col:'#88ff44',eff:'acid',      sfx:'acid'},
  {id:'sonic_burst',   n:'Sonic Burst',    ico:'sonic',  desc:'Onda de choque sônica',          col:'#ffd95c',eff:'wave',      sfx:'wave'},
  {id:'void_pulse',    n:'Void Pulse',     ico:'void',   desc:'ESPECIAL: Pulso dimensional',    col:'#ff44ff',eff:'void',      sfx:'void',sp:true},
  {id:'ulti_form',     n:'Ultimate Form',  ico:'star',   desc:'ESPECIAL: Forma Suprema',        col:'#ff8800',eff:'ulti',      sfx:'ulti',sp:true},
  {id:'cryo_blast',    n:'Cryo Blast',     ico:'ice',    desc:'Congelamento instantâneo',       col:'#88ddff',eff:'cryo',      sfx:'cryo'},
  {id:'plasma_beam',   n:'Plasma Beam',    ico:'fire',   desc:'Feixe de plasma concentrado',    col:'#ff6622',eff:'beam',      sfx:'beam'},
  {id:'psi_crush',     n:'Psi Crush',      ico:'brain',  desc:'Esmagamento psíquico',           col:'#cc44ff',eff:'psi',       sfx:'psi'},
  {id:'nano_swarm',    n:'Nano Swarm',     ico:'brain',  desc:'Enxame de nanobots',             col:'#00aaff',eff:'nano',      sfx:'nano'},
  {id:'temporal_rift', n:'Temporal Rift',  ico:'dash',   desc:'Fenda no tempo',                 col:'#9966ff',eff:'temporal',  sfx:'temporal'},
  {id:'gravity_slam',  n:'Gravity Slam',   ico:'star',   desc:'Golpe gravitacional',            col:'#aaaaaa',eff:'gravity',   sfx:'gravity'},
  {id:'spore_cloud',   n:'Spore Cloud',    ico:'cosmic', desc:'Nuvem de esporos mutantes',      col:'#66ff66',eff:'spore',     sfx:'spore'},
  {id:'magnet_pull',   n:'Magnet Pull',    ico:'cosmic', desc:'Atração magnética letal',        col:'#ff8800',eff:'magnet',    sfx:'magnet'},
];

function genSkills(genome,arch){
  const reg=POWERS.filter(p=>!p.sp).sort(()=>Math.random()-.5).slice(0,5);
  const sp=POWERS.filter(p=>p.sp);
  return[...reg,...sp].map(p=>({...p,rage:1+~~(Math.random()*4),frame:~~(Math.random()*120),color:p.col}));
}

// ── EVOLUÇÃO ──────────────────────────────────────────────────────
let evoRunning=false,evoSkip=false,evoAbort=false;

function runEvolution(srcObj){
  const sc=gSc();if(!sc)return;
  srcObj.visible=false;
  const planetSeed=~~(Math.random()*2000000);
  const planet=genPlanet(planetSeed);
  const numPred=2+~~(Math.random()*4);
  const preds=Array.from({length:numPred},(_,i)=>genPredator(planetSeed+i+1));
  const arch=ARCHETYPES[~~(Math.random()*ARCHETYPES.length)];
  const matType=getMaterialType(srcObj);
  const mb=MAT_BONUS[matType]||{};

  $('nh-evo')?.classList.remove('hidden');
  const te=$('evo-title');if(te)te.textContent=`${planet.name} — ${planet.desc}`;

  const cv=$('nh-evo-cv'),ctx=cv.getContext('2d'),W=cv.width,H=cv.height;
  const IPOP=40,TY=1000000;
  let gen=0,year=0,fn=0,done=false,best=null;

  function rg(){
    const g={speed:1+Math.random()*2,armor:1+Math.random()*2,stealth:1+Math.random()*2,
      size:1+Math.random()*2,strength:1+Math.random()*2,
      color:`hsl(${~~(Math.random()*360)},${40+~~(Math.random()*40)}%,${30+~~(Math.random()*30)}%)`,
      traits:[],fitness:0};
    if(mb.armor)g.armor+=mb.armor;if(mb.speed)g.speed+=mb.speed;
    if(mb.strength)g.strength+=mb.strength;if(mb.stealth)g.stealth+=mb.stealth;
    if(mb.t&&!g.traits.includes(mb.t))g.traits.push(mb.t);
    return g;
  }
  function mutate(g){
    const n=JSON.parse(JSON.stringify(g)),mr=.3+Math.random()*.4;
    ['speed','armor','stealth','size','strength'].forEach(k=>{if(Math.random()<mr)n[k]+=(Math.random()-.5)*.6;});
    n.speed=Math.max(.3,n.speed);n.armor=Math.max(.3,n.armor);n.stealth=Math.max(.3,n.stealth);
    n.size=Math.max(.4,Math.min(5,n.size));n.strength=Math.max(.3,n.strength);
    const m=n.color.match(/hsl\((\d+),(\d+)%,(\d+)%\)/);
    if(m)n.color=`hsl(${(+m[1]+~~((Math.random()-.5)*40)+360)%360},${Math.min(90,Math.max(20,+m[2]+~~((Math.random()-.5)*10)))}%,${Math.min(70,Math.max(15,+m[3]+~~((Math.random()-.5)*8)))}%)`;
    if(Math.random()<.15&&n.traits.length<10){const t=TRAITS[~~(Math.random()*TRAITS.length)];if(!n.traits.includes(t))n.traits.push(t);}
    return n;
  }
  function cross(a,b){return{speed:(Math.random()<.5?a:b).speed,armor:(Math.random()<.5?a:b).armor,stealth:(Math.random()<.5?a:b).stealth,size:(Math.random()<.5?a:b).size,strength:(Math.random()<.5?a:b).strength,color:Math.random()<.5?a.color:b.color,traits:[...new Set([...a.traits.slice(0,5),...b.traits.slice(0,5)])],fitness:0};}
  function fit(g){
    let s=0;
    const h=planet.hazard;
    if(h==='acid')s+=g.armor*1.5+(g.traits.includes('acid_blood')?2:0)+(g.traits.includes('acid_spray')?1.5:0);
    if(h==='fire')s+=g.armor*1.2+(g.traits.includes('fire_core')?2.5:0)+(g.traits.includes('fire_breath')?1.5:0);
    if(h==='ice')s+=g.speed*1.3+(g.traits.includes('ice_organs')?2:0)+(g.traits.includes('ice_breath')?1.5:0);
    if(h==='pressure')s+=g.armor*2+(g.traits.includes('crystalline_shell')?2:0)+(g.traits.includes('exoskeleton')?1.5:0);
    if(h==='storm')s+=g.stealth*1.5+(g.traits.includes('magnet_organs')?2:0)+(g.traits.includes('lightning_strike')?1.8:0);
    if(h==='psionic')s+=g.stealth*1.8+(g.traits.includes('neural_sync')?2.5:0)+(g.traits.includes('psionic_node')?2:0);
    if(h==='crystal')s+=g.armor*1.4+(g.traits.includes('crystalline_shell')?3:0)+(g.traits.includes('crystal_core')?2:0);
    if(h==='void')s+=g.stealth*1.6+(g.traits.includes('void_shroud')?2.8:0)+(g.traits.includes('void_step')?2:0);
    if(h==='radiation')s+=g.armor*1.3+(g.traits.includes('radiation_gland')?2.5:0);
    if(h==='gravity')s+=g.strength*1.4+(g.traits.includes('gravity_organ')?2:0)+(g.traits.includes('graviton_glands')?1.8:0);
    if(h==='spore')s+=g.stealth*1.2+(g.traits.includes('spore_glands')?2.5:0)+(g.traits.includes('spore_cloud')?1.5:0);
    if(h==='sonic')s+=g.armor*1.1+(g.traits.includes('sonic_glands')?2.2:0)+(g.traits.includes('echo_sense')?1.8:0);
    if(h==='magnet')s+=g.stealth*1.3+(g.traits.includes('magnet_organs')?2.5:0);
    if(h==='nano')s+=g.speed*1.2+(g.traits.includes('nano_swarm')?2.5:0)+(g.traits.includes('nano_repair')?2:0);
    if(h==='temporal')s+=g.speed*1.5+(g.traits.includes('temporal_gland')?3:0)+(g.traits.includes('temporal_dodge')?2.2:0);
    preds.forEach(p=>{s+=g.speed*.5+g.stealth*.7-p.size/14;});
    if(g.traits.includes('thick_skin'))s+=1.5;if(g.traits.includes('camouflage'))s+=g.stealth*.8;
    if(g.traits.includes('regeneration'))s+=1.3;if(g.traits.includes('flight_membrane'))s+=g.speed*.5;
    if(g.traits.includes('plasma_core'))s+=2.1;if(g.traits.includes('void_shroud'))s+=1.9;
    if(g.traits.includes('bone_armor'))s+=1.2;if(g.traits.includes('dual_genome'))s+=2.5;
    if(g.traits.includes('omega_cell'))s+=3;if(g.traits.includes('prime_evolution'))s+=4;
    s+=Math.random()*.8;return Math.max(0,s);
  }

  let pop=Array.from({length:IPOP},rg);
  let creatures=pop.map(g=>({x:30+Math.random()*(W-60),y:40+Math.random()*(H-80),vx:(Math.random()-.5)*g.speed,vy:(Math.random()-.5)*g.speed,g,alive:true,age:0}));
  let predObjs=preds.flatMap(pt=>Array.from({length:2+~~(Math.random()*2)},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*pt.speed,vy:(Math.random()-.5)*pt.speed,pt,hunger:100})));
  best=pop[0];
  const stars=[];for(let i=0;i<140;i++)stars.push({x:Math.random()*W,y:Math.random()*H*.62,r:Math.random()*.75+.2,a:Math.random()*.7+.2,twinkle:Math.random()*Math.PI*2});

  evoRunning=true;evoSkip=false;evoAbort=false;

  function drawBg(){
    ctx.fillStyle=planet.sky[0]||'#000005';ctx.fillRect(0,0,W,H);
    const sg=ctx.createLinearGradient(0,0,0,H*.62);
    sg.addColorStop(0,planet.sky[0]||'#000010');sg.addColorStop(.5,planet.sky[1]||'#000820');sg.addColorStop(1,planet.sky[2]||'#001030');
    ctx.fillStyle=sg;ctx.fillRect(0,0,W,H*.62);
    // Nebula
    if(planet.nebula){const ng=ctx.createRadialGradient(W*.3,H*.2,0,W*.3,H*.2,W*.4);ng.addColorStop(0,planet.nebulaCol.replace('hsl(','hsla(').replace(')',',.25)'));ng.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=ng;ctx.fillRect(0,0,W,H*.62);}
    // Stars
    stars.forEach(st=>{const tw=.5+Math.sin(fn*.02+st.twinkle)*.5;ctx.fillStyle=`rgba(255,255,255,${st.a*tw})`;ctx.beginPath();ctx.arc(st.x,st.y,st.r,0,Math.PI*2);ctx.fill();});
    // Moons
    for(let i=0;i<planet.moons;i++){const mx=W*(.1+i*.22),my=H*(.06+i*.04),mr=5+i*3;ctx.fillStyle=`rgba(200,190,180,${.15+i*.05})`;ctx.beginPath();ctx.arc(mx,my,mr,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(0,0,0,.3)`;ctx.beginPath();ctx.arc(mx+mr*.3,my-mr*.1,mr*.65,0,Math.PI*2);ctx.fill();}
    // Ring
    if(planet.ringProb){ctx.strokeStyle='rgba(200,180,100,.12)';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(W*.75,H*.12,60,12,-.3,0,Math.PI*2);ctx.stroke();ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(W*.75,H*.12,70,14,-.3,0,Math.PI*2);ctx.stroke();}
    // Horizon
    const hg=ctx.createLinearGradient(0,H*.55,0,H*.7);hg.addColorStop(0,'rgba(0,0,0,0)');hg.addColorStop(1,planet.atm||'rgba(0,50,100,.2)');ctx.fillStyle=hg;ctx.fillRect(0,H*.55,W,H*.15);
    // Ground
    const gg=ctx.createLinearGradient(0,H*.68,0,H);gg.addColorStop(0,planet.ground);gg.addColorStop(1,'#000000');ctx.fillStyle=gg;ctx.fillRect(0,H*.68,W,H*.32);
    // Terrain
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.moveTo(0,H*.68);for(let x=0;x<=W;x+=22){const y=H*.68-Math.sin(x*.016+1)*13-Math.sin(x*.044+3)*7-Math.sin(x*.1+5)*4;ctx.lineTo(x,y);}ctx.lineTo(W,H*.68);ctx.closePath();ctx.fill();
    // Hazard FX
    if(planet.hazard==='fire'||planet.hazard==='magma'){for(let i=0;i<4;i++){const px=W*.1+i*W*.25+Math.sin(fn*.03+i)*8,py=H*.64+Math.sin(fn*.05+i)*5;const fg=ctx.createRadialGradient(px,py,0,px,py,20);fg.addColorStop(0,'rgba(255,160,0,.45)');fg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=fg;ctx.beginPath();ctx.arc(px,py,20,0,Math.PI*2);ctx.fill();}}
    if(planet.hazard==='ice'){ctx.strokeStyle='rgba(150,200,255,.16)';for(let i=0;i<10;i++){const ix=i*W*.12;ctx.beginPath();ctx.moveTo(ix,H*.68);ctx.lineTo(ix+4,H*.58);ctx.lineTo(ix+8,H*.68);ctx.lineWidth=1.5;ctx.stroke();}}
    if(planet.hazard==='void'){ctx.fillStyle=`rgba(80,0,150,${.04+Math.sin(fn*.03)*.03})`;ctx.fillRect(0,0,W,H*.68);}
    if(planet.hazard==='storm'){for(let i=0;i<3;i++){const lx=W*(Math.sin(fn*.01+i)*0.3+0.5);ctx.strokeStyle=`rgba(200,200,255,${.15+Math.sin(fn*.1+i)*.12})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(lx,0);ctx.lineTo(lx+20,H*.4);ctx.lineTo(lx-10,H*.6);ctx.stroke();}}
    if(planet.hazard==='psionic'){ctx.strokeStyle=`rgba(180,80,255,${.06+Math.sin(fn*.04)*.04})`;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(W*.5,H*.35,H*(.15+i*.1),0,Math.PI*2);ctx.lineWidth=1;ctx.stroke();}}
  }

  function drawCreature(cr){
    if(!cr.alive)return;const r=4+cr.g.size*2.1;ctx.save();ctx.translate(cr.x,cr.y);
    ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(0,r*.45,r*.65,r*.25,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=cr.g.color;
    if(cr.g.traits.includes('crystalline_shell')){ctx.beginPath();for(let i=0;i<6;i++){const a=i/6*Math.PI*2;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(200,230,255,.6)';ctx.lineWidth=1.2;ctx.stroke();}
    else if(cr.g.traits.includes('spikes')){ctx.beginPath();ctx.arc(0,0,r*.72,0,Math.PI*2);ctx.fill();for(let i=0;i<8;i++){const a=i/8*Math.PI*2+fn*.025;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.55,Math.sin(a)*r*.55);ctx.lineTo(Math.cos(a)*r*1.5,Math.sin(a)*r*1.5);ctx.strokeStyle=cr.g.color;ctx.lineWidth=1.8;ctx.stroke();}}
    else{ctx.beginPath();for(let i=0;i<=8;i++){const a=i/8*Math.PI*2,rr=r*(.84+Math.sin(a*2.3+fn*.04)*.16);i===0?ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();}
    const ec=cr.g.fitness>12?'#ffff44':'#ff4422';
    [-1,1].forEach(sd=>{ctx.fillStyle=ec;ctx.beginPath();ctx.arc(sd*r*.33,-r*.24,r*.14,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(0,0,0,.7)';ctx.beginPath();ctx.arc(sd*r*.33+sd*.5,-r*.24,r*.06,0,Math.PI*2);ctx.fill();});
    if(cr.g.armor>3){ctx.strokeStyle='rgba(200,210,235,.3)';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(0,0,r*.88,0,Math.PI*2);ctx.stroke();}
    if(cr.g.fitness>15){ctx.shadowColor=cr.g.color;ctx.shadowBlur=11;ctx.beginPath();ctx.arc(0,0,r*.38,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
    if(cr.g.traits.includes('flight_membrane')){ctx.strokeStyle=cr.g.color+'66';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(0,0,r*1.3,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }

  function drawPredator(p){
    ctx.save();ctx.translate(p.x,p.y);const sz=p.pt.size;
    ctx.fillStyle='rgba(255,0,0,.06)';ctx.beginPath();ctx.ellipse(0,sz*.55,sz*.65,sz*.26,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.pt.color;ctx.beginPath();ctx.moveTo(0,-sz);ctx.lineTo(sz*.5,-sz*.2);ctx.lineTo(sz*.7,sz*.55);ctx.lineTo(sz*.3,sz*.28);ctx.lineTo(0,sz*.65);ctx.lineTo(-sz*.3,sz*.28);ctx.lineTo(-sz*.7,sz*.55);ctx.lineTo(-sz*.5,-sz*.2);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(255,80,0,.36)';ctx.lineWidth=1.4;ctx.stroke();
    const ea=p.hunger<40?1:.5;ctx.fillStyle=`rgba(255,30,0,${ea})`;
    [-sz*.2,sz*.2].forEach(ex=>{ctx.beginPath();ctx.arc(ex,-sz*.28,sz*.11,0,Math.PI*2);ctx.fill();});
    ctx.fillStyle='rgba(255,120,80,.65)';ctx.font=`${Math.max(7,sz*.4)}px monospace`;ctx.textAlign='center';ctx.fillText(p.pt.name.slice(0,8),0,-sz*1.08);
    ctx.restore();
  }

  function step(){
    if(!evoRunning||done||evoAbort){
      if(evoAbort){$('nh-evo')?.classList.add('hidden');srcObj.visible=true;evoRunning=false;}return;}
    const spf=evoSkip?50:1;
    for(let s=0;s<spf;s++){
      fn++;year=~~(fn/200*TY);const g=~~(fn/200);
      creatures.forEach(cr=>{if(!cr.alive)return;cr.age++;const spd=cr.g.speed*.8*(cr.g.traits.includes('camouflage')?.68:1);cr.x+=cr.vx*spd;cr.y+=cr.vy*spd;if(cr.x<8||cr.x>W-8)cr.vx*=-1;if(cr.y<8||cr.y>H*.65)cr.vy*=-1;cr.x=Math.max(8,Math.min(W-8,cr.x));cr.y=Math.max(8,Math.min(H*.65,cr.y));if(Math.random()<.04){cr.vx=(Math.random()-.5)*spd;cr.vy=(Math.random()-.5)*spd;}});
      predObjs.forEach(p=>{let near=null,md=p.pt.sense;creatures.forEach(cr=>{if(!cr.alive)return;const d=Math.hypot(cr.x-p.x,cr.y-p.y);const dr=cr.g.traits.includes('camouflage')?md*.5:md;if(d<dr){md=d;near=cr;}});
        if(near){const dx=near.x-p.x,dy=near.y-p.y,d=Math.hypot(dx,dy);if(d>0){p.vx+=dx/d*p.pt.speed*.08;p.vy+=dy/d*p.pt.speed*.08;}if(d<p.pt.size+5){const esc=near.g.speed>p.pt.speed*.8||Math.random()<near.g.stealth*.1;if(!esc){near.alive=false;p.hunger=100;}}}
        else{p.vx+=(Math.random()-.5)*.3;p.vy+=(Math.random()-.5)*.3;}
        const sp=Math.hypot(p.vx,p.vy);if(sp>p.pt.speed){p.vx=p.vx/sp*p.pt.speed;p.vy=p.vy/sp*p.pt.speed;}
        p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H*.7)p.vy*=-1;
        p.x=Math.max(0,Math.min(W,p.x));p.y=Math.max(0,Math.min(H*.7,p.y));p.hunger-=.02;});
      if(g>gen){gen=g;
        pop=creatures.filter(c=>c.alive).map(c=>c.g);
        if(pop.length===0)pop=Array.from({length:15},rg);
        pop.forEach(gg=>{gg.fitness=fit(gg,planet,preds);});
        pop.sort((a,b)=>b.fitness-a.fitness);best=pop[0];
        const nx=[];const el=Math.min(4,pop.length);for(let i=0;i<el;i++)nx.push(JSON.parse(JSON.stringify(pop[i])));
        while(nx.length<IPOP){const pA=pop[~~(Math.random()*Math.min(8,pop.length))];const pB=pop[~~(Math.random()*Math.min(8,pop.length))];nx.push(mutate(cross(pA,pB)));}
        pop=nx;creatures=pop.map(gg=>({x:30+Math.random()*(W-60),y:40+Math.random()*(H-80),vx:(Math.random()-.5)*gg.speed,vy:(Math.random()-.5)*gg.speed,g:gg,alive:true,age:0}));}
      if(g>=200){done=true;break;}}

    const alive=creatures.filter(c=>c.alive).length;
    if(!evoSkip){
      drawBg();predObjs.forEach(drawPredator);creatures.forEach(drawCreature);
      ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,H*.77,W,H*.23);
      ctx.font='9.5px monospace';
      ctx.fillStyle='rgba(255,200,100,.75)';ctx.fillText(`Predadores: ${preds.map(p=>p.name).join(', ')}`,7,H*.78+12);
      ctx.fillStyle=alive>10?'#4cefac':alive>3?'#ffd95c':'#ff5252';
      ctx.fillText(`Vivos: ${alive}/${IPOP}`,7,H*.78+25);
      if(best){ctx.fillStyle='rgba(165,180,252,.75)';ctx.fillText(`Fitness: ${best.fitness?.toFixed(1)}  Traits: ${best.traits.slice(0,4).join(', ')||'none'}`,7,H*.78+38);}
      const conv=gen/200;
      ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(7,H*.78+47,W-14,4);
      const bg=ctx.createLinearGradient(7,0,W-14,0);bg.addColorStop(0,'#5f7fff');bg.addColorStop(1,'#a78bfa');
      ctx.fillStyle=bg;ctx.fillRect(7,H*.78+47,(W-14)*conv,4);
      ctx.fillStyle='rgba(255,255,255,.35)';ctx.font='8.5px monospace';
      ctx.fillText(`Convergência: ${~~(conv*100)}%   Alvo: ${arch.n}   Planeta: ${planet.name}`,7,H*.78+60);
      if(matType!=='organic'){ctx.fillStyle='rgba(255,210,80,.55)';ctx.fillText(`Material: ${matType} (+bônus genético)`,W*.58,H*.78+12);}
    }

    const ge=$('evo-gen'),po=$('evo-pop'),yr=$('evo-yr'),ph=$('evo-ph');
    if(ge)ge.textContent=`Gen: ${gen}`;if(po)po.textContent=`Vivos: ${alive}`;if(yr)yr.textContent=`Ano: ${year.toLocaleString()}`;
    if(ph)ph.textContent=done?'Evolução completa! Consultando IA…':`→ ${arch.n} (${arch.plan})`;
    if(!done)requestAnimationFrame(step);else finishEvolution(srcObj,best,arch,planet);
  }
  requestAnimationFrame(step);
}

// ══════════════════════════════════════════════════════════════════
//  FINISH EVOLUTION + AI NARRATIVE
// ══════════════════════════════════════════════════════════════════
async function finishEvolution(srcObj,genome,arch,planet){
  evoRunning=false;
  const al=$('evo-ailbl');if(al)al.style.display='flex';
  const narr=await AI(
    'Narrador épico de simulador de evolução alien. 2-3 frases curtas em português. Cinematográfico e épico. Mencione o planeta, os horrores e a adaptação.',
    `Criatura:${arch.n}. Planeta:${planet.name}(${planet.desc}). Traits:${genome.traits.join(',')||'nenhum'}. Fitness:${genome.fitness?.toFixed(1)}.`,350
  );
  if(al)al.style.display='none';
  $('nh-evo')?.classList.add('hidden');
  const sc=gSc();if(!sc)return;
  const wp=gWP(srcObj);
  const evolved=buildCreature(wp,genome,arch);
  sc.add(evolved);window.sceneObjects?.push(evolved);srcObj.visible=false;
  sfxExplosion(wp,0x4cefac);
  const skills=genSkills(genome,arch);
  evolved.userData.evolvedSkills=skills;evolved.userData.isEvolved=true;
  evolved.userData.archetypeName=arch.n;evolved.userData.archetypeIcon=arch.icon;
  evolved.userData.archetype=arch;evolved.userData.genome=genome;
  startIdleAnim(evolved,arch,genome);
  // Update skill toggle
  updateSkillBtn(evolved);
  toast(narr||`${arch.n} emergiu de ${planet.name}!`,7000);mD(4);
}

// ══════════════════════════════════════════════════════════════════
//  CREATURE BUILDER — modeled-cube style (like the reference images)
//  Cada parte é um cubo modelado com chanfros, painéis e detalhes
//  RIG completo com bones nomeados para animação por ataque
// ══════════════════════════════════════════════════════════════════

// ── Materiais reutilizáveis ───────────────────────────────────────
function mkMat(hex, rough=0.55, metal=0.15, emHex=null, emI=0){
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: rough,
    metalness: metal,
    emissive: emHex !== null ? emHex : hex,
    emissiveIntensity: emI,
  });
}

// ── Cubo modelado com chanfro (adiciona arestas escuras) ──────────
function modeledBox(W, H, D, mat, chamferColor=null, seg=2){
  const g = new THREE.Group();
  // Corpo principal
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D, seg, seg, seg), mat);
  g.add(body);
  // Chanfros: faixas escuras nas arestas para dar "cubo modelado"
  if(chamferColor !== null){
    const cMat = mkMat(chamferColor, 0.8, 0.0);
    const c = 0.018; // espessura do chanfro
    // top/bottom edges
    [[W+c*2,c,D+c*2, 0, H/2+c/2, 0],[W+c*2,c,D+c*2, 0,-H/2-c/2, 0]].forEach(([w,h,d,x,y,z])=>{
      const e = new THREE.Mesh(new THREE.BoxGeometry(w,h,d,1,1,1), cMat);
      e.position.set(x,y,z); g.add(e);
    });
    // front/back edges
    [[W+c*2,H+c*2,c, 0,0, D/2+c/2],[W+c*2,H+c*2,c, 0,0,-D/2-c/2]].forEach(([w,h,d,x,y,z])=>{
      const e = new THREE.Mesh(new THREE.BoxGeometry(w,h,d,1,1,1), cMat);
      e.position.set(x,y,z); g.add(e);
    });
  }
  return g;
}

// ── Peça simples com posição/rotação ─────────────────────────────
function part(geo, mat, x=0,y=0,z=0,rx=0,ry=0,rz=0){
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x,y,z); m.rotation.set(rx,ry,rz);
  m.castShadow = m.receiveShadow = true;
  return m;
}
// Cubo simples
function box(W,H,D,mat,x=0,y=0,z=0,rx=0,ry=0,rz=0){
  return part(new THREE.BoxGeometry(W,H,D,2,2,2),mat,x,y,z,rx,ry,rz);
}
// Olho glowing
function glowEye(ex,ey,ez,col,W=0.12,H=0.05,D=0.04){
  return part(new THREE.BoxGeometry(W,H,D,1,1,1),
    new THREE.MeshStandardMaterial({color:0x000000,emissive:col,emissiveIntensity:8,roughness:0}),
    ex,ey,ez);
}

// ── CONSTRUTOR PRINCIPAL ──────────────────────────────────────────
function buildCreature(center, genome, arch){
  const group = new THREE.Group();
  group.name = `Evolved_${arch.n.replace(/ /g,'_')}`;
  group.position.copy(center);

  const S = 0.82 + genome.size * 0.32;

  // Palette from archetype
  const baseHex = parseInt(arch.c.replace('#',''), 16);
  // accent = complementary dark color
  const accentHex = Math.max(0, baseHex - 0x1a1a1a);
  const brightHex = Math.min(0xffffff, baseHex + 0x282828);
  const darkHex   = Math.max(0, baseHex - 0x303030);

  // Main materials
  const mBase   = mkMat(baseHex,  0.5, 0.25);
  const mLight  = mkMat(brightHex,0.45, 0.2);
  const mDark   = mkMat(darkHex,  0.7, 0.1);
  const mBlack  = mkMat(0x0a0a0a, 0.8, 0.05);
  const mPanel  = mkMat(0xdddddd, 0.45, 0.15);  // light panel
  const mAccent = new THREE.MeshStandardMaterial({
    color: baseHex, emissive: baseHex, emissiveIntensity: 0.4,
    roughness: 0.3, metalness: 0.5
  });

  // ── RIG GROUPS (bones nomeados) ────────────────────────────────
  const rig = {
    root:   new THREE.Group(), // raiz do rig
    pelvis: new THREE.Group(),
    spine:  new THREE.Group(),
    chest:  new THREE.Group(),
    neck:   new THREE.Group(),
    head:   new THREE.Group(),
    armL:   new THREE.Group(),
    armR:   new THREE.Group(),
    foreL:  new THREE.Group(),
    foreR:  new THREE.Group(),
    handL:  new THREE.Group(),
    handR:  new THREE.Group(),
    legL:   new THREE.Group(),
    legR:   new THREE.Group(),
    shinL:  new THREE.Group(),
    shinR:  new THREE.Group(),
    tail:   new THREE.Group(),
    wingsL: new THREE.Group(),
    wingsR: new THREE.Group(),
  };
  Object.entries(rig).forEach(([k,g])=>{ g.name = k; });

  // Hierarchy
  rig.root.add(rig.pelvis);
  rig.pelvis.add(rig.spine);
  rig.spine.add(rig.chest);
  rig.chest.add(rig.neck);
  rig.neck.add(rig.head);
  rig.chest.add(rig.armL);
  rig.chest.add(rig.armR);
  rig.armL.add(rig.foreL);
  rig.armR.add(rig.foreR);
  rig.foreL.add(rig.handL);
  rig.foreR.add(rig.handR);
  rig.pelvis.add(rig.legL);
  rig.pelvis.add(rig.legR);
  rig.legL.add(rig.shinL);
  rig.legR.add(rig.shinR);
  rig.pelvis.add(rig.tail);
  rig.chest.add(rig.wingsL);
  rig.chest.add(rig.wingsR);

  group.add(rig.root);

  // Pivot offsets (tudo em coordenadas locais do pai)
  rig.root.position.set(0, 0, 0);
  rig.pelvis.position.set(0, S*0.0, 0);
  rig.spine.position.set(0, S*0.1, 0);
  rig.chest.position.set(0, S*0.42, 0);
  rig.neck.position.set(0, S*0.46, 0);
  rig.head.position.set(0, S*0.16, 0);
  rig.armL.position.set(-S*0.42, S*0.1, 0);
  rig.armR.position.set( S*0.42, S*0.1, 0);
  rig.foreL.position.set(0, -S*0.36, 0);
  rig.foreR.position.set(0, -S*0.36, 0);
  rig.handL.position.set(0, -S*0.32, 0);
  rig.handR.position.set(0, -S*0.32, 0);
  rig.legL.position.set(-S*0.2, -S*0.05, 0);
  rig.legR.position.set( S*0.2, -S*0.05, 0);
  rig.shinL.position.set(0, -S*0.42, 0);
  rig.shinR.position.set(0, -S*0.42, 0);
  rig.tail.position.set(0, 0, -S*0.2);
  rig.wingsL.position.set(-S*0.3, 0, 0);
  rig.wingsR.position.set( S*0.3, 0, 0);

  // ── BUILDER POR BODY PLAN ──────────────────────────────────────
  const plan = arch.plan || 'biped';

  // ── Pelvis / Hips
  rig.pelvis.add(box(S*.52,S*.28,S*.38,mDark));
  // hip panels
  [-1,1].forEach(s=>{
    rig.pelvis.add(box(S*.1,S*.24,S*.34,mBase,s*S*.27,0,0));
  });

  // ── Spine / abdomen
  rig.spine.add(box(S*.44,S*.22,S*.34,mDark));
  rig.spine.add(box(S*.3,S*.14,S*.1,mBase,0,0,S*.17)); // front plate

  // ── Chest
  const chestW = plan==='hexapod'? S*.72 : S*.62;
  rig.chest.add(box(chestW,S*.38,S*.44,mDark));
  // chest front armor plate
  rig.chest.add(box(S*.42,S*.28,S*.08,mLight,0,S*.04,S*.23));
  // chest accent stripe
  rig.chest.add(box(S*.08,S*.28,S*.06,mAccent,0,S*.04,S*.24));
  // shoulder blocks
  [-1,1].forEach(s=>{
    rig.chest.add(box(S*.14,S*.14,S*.4,mBase,s*S*.38,S*.1,0));
  });
  // back panel
  rig.chest.add(box(S*.44,S*.28,S*.08,mDark,0,0,-S*.22));

  // ── Neck
  rig.neck.add(box(S*.22,S*.14,S*.22,mBlack));
  rig.neck.add(box(S*.16,S*.1,S*.08,mBase,0,0,S*.12));

  // ── HEAD ── (the most important part — modeled-cube style)
  // Main head box with subdivisions
  rig.head.add(box(S*.42,S*.36,S*.4,mLight,0,0,0));
  // Forehead ridge
  rig.head.add(box(S*.44,S*.07,S*.1,mDark,0,S*.17,S*.18));
  // Chin
  rig.head.add(box(S*.32,S*.06,S*.08,mBlack,0,-S*.15,S*.2));
  // Cheek panels
  [-1,1].forEach(s=>{
    rig.head.add(box(S*.08,S*.22,S*.1,mDark,s*S*.22,0,S*.18));
  });
  // Eye visor bar
  rig.head.add(box(S*.36,S*.07,S*.06,mBlack,0,S*.06,S*.22));
  // EYES (color per archetype)
  const eyeCol = arch.t.fire?0xff4400 : arch.t.ice?0x44ddff : arch.t.sonic?0x44ffee :
                 arch.t.cosmic?0xaa44ff : arch.t.spikes?0xff2222 : 0x44ff88;
  [-1,1].forEach(s=>{
    rig.head.add(glowEye(s*S*.12, S*.06, S*.24, eyeCol, S*.1, S*.04, S*.03));
  });
  // Head top details (horns/fins by archetype)
  if(arch.t.bulk || arch.t.spikes){
    [-1,1].forEach(s=>{
      rig.head.add(box(S*.05,S*.22,S*.06,mAccent,s*S*.16,S*.27,0,-.15,0,s*.18));
    });
    rig.head.add(box(S*.05,S*.28,S*.06,mAccent,0,S*.3,-S*.05,-.1));
  }
  if(arch.t.fire){
    // dragon crest
    rig.head.add(box(S*.04,S*.34,S*.04,mAccent,0,S*.32,0));
    [-1,1].forEach(s=>{
      rig.head.add(box(S*.03,S*.2,S*.03,mDark,s*S*.1,S*.28,0,0,0,s*.3));
    });
  }
  if(arch.t.sonic){
    // large antenna ears
    [-1,1].forEach(s=>{
      rig.head.add(box(S*.04,S*.3,S*.1,mBase,s*S*.26,S*.12,0,0,0,s*.25));
    });
  }

  // ── ARMS (modeled cube segments) ─────────────────────────────
  [['armL','foreL','handL',-1],['armR','foreR','handR',1]].forEach(([arm,fore,hand,s])=>{
    // Upper arm — trapezoid-ish box
    rig[arm].add(box(S*.2,S*.34,S*.2,mDark));
    rig[arm].add(box(S*.14,S*.3,S*.14,mBase));       // inner lighter
    rig[arm].add(box(S*.18,S*.04,S*.18,mBlack,0,-S*.17,0)); // elbow seam

    // Forearm — slightly narrower, different panel
    rig[fore].add(box(S*.18,S*.32,S*.18,mDark));
    rig[fore].add(box(S*.12,S*.28,S*.12,mLight));
    rig[fore].add(box(S*.16,S*.04,S*.14,mAccent,0,0,S*.1)); // front plate

    // Hand — boxy fist
    rig[hand].add(box(S*.22,S*.2,S*.18,mBlack));
    rig[hand].add(box(S*.16,S*.16,S*.14,mDark));
    // knuckles
    for(let k=0;k<3;k++){
      rig[hand].add(box(S*.055,S*.055,S*.06,mBase,(k-1)*S*.07,S*.09,S*.1));
    }
  });

  // ── LEGS ─────────────────────────────────────────────────────
  [['legL','shinL',-1],['legR','shinR',1]].forEach(([thigh,shin,s])=>{
    // Thigh
    rig[thigh].add(box(S*.24,S*.4,S*.24,mDark));
    rig[thigh].add(box(S*.18,S*.36,S*.18,mBase));
    rig[thigh].add(box(S*.22,S*.06,S*.22,mBlack,0,-S*.2,0)); // knee seam
    // Knee cap
    rig[thigh].add(box(S*.14,S*.08,S*.1,mAccent,0,-S*.2,S*.1));

    // Shin
    rig[shin].add(box(S*.2,S*.36,S*.22,mDark));
    rig[shin].add(box(S*.14,S*.32,S*.16,mBase));
    // shin armor plate
    rig[shin].add(box(S*.12,S*.22,S*.06,mLight,0,S*.06,S*.12));
    // foot
    rig[shin].add(box(S*.24,S*.1,S*.36,mBlack,0,-S*.22,S*.06));
    rig[shin].add(box(S*.2,S*.08,S*.28,mDark,0,-S*.22,S*.06));
  });

  // ── TAIL ───────────────────────────────────────────────────────
  const tailSegs = 6;
  for(let i=0;i<tailSegs;i++){
    const t=i/(tailSegs-1);const tw=S*(.18-t*.1);const th=S*(.18-t*.08);
    rig.tail.add(box(tw,th,tw,i%2===0?mDark:mBlack,0,-i*S*.14*0.7,-(i*S*.14)));
  }
  // tail tip
  rig.tail.add(box(S*.06,S*.06,S*.14,mAccent,0,-S*.55,-S*.84));

  // ── ARCHETYPE-SPECIFIC DETAILS ─────────────────────────────────
  if(arch.t.fire || arch.plan==='dragon'){
    // Dragon wings on chest
    [-1,1].forEach(s=>{
      // Wing base bone
      const wingBone = new THREE.Group(); wingBone.name = s<0?'wingBoneL':'wingBoneR';
      wingBone.position.set(s*S*.28,0,-S*.05);
      // Wing segments
      wingBone.add(box(S*.08,S*.6,S*.04,mDark,0,-S*.3,0,0,0,s*.15));
      // Wing membrane panels
      for(let w=0;w<3;w++){
        const wMat = new THREE.MeshStandardMaterial({
          color:darkHex,emissive:baseHex,emissiveIntensity:.25,
          transparent:true,opacity:.72,roughness:.6,side:THREE.DoubleSide
        });
        wingBone.add(box(S*(0.35-w*.08),S*.04,S*(0.55-w*.1),wMat,
          s*(S*(0.22+w*.18)),S*(-0.05-w*.15),0, 0,0,s*(0.4+w*.2)));
      }
      rig.chest.add(wingBone);
    });
    // Crest spines on head
    for(let i=0;i<4;i++){
      const cMat = mkMat(baseHex,.3,.5,baseHex,.6);
      rig.head.add(box(S*.03,S*(.14+i*.04),S*.03,cMat, (i-1.5)*S*.07, S*(.3+i*.02), -S*.05));
    }
  }

  if(arch.t.shell || arch.plan==='hexapod'){
    // Shell plates on back
    for(let r=0;r<3;r++){
      const plateMat = mkMat(brightHex,.2,.7,baseHex,.2);
      for(let i=0;i<4-r;i++){
        const a=i/(3-r)*Math.PI - Math.PI/2;
        rig.chest.add(box(S*(.3-r*.04),S*.06,S*(.22-r*.03),plateMat,
          Math.cos(a)*S*(.38+r*.04), S*(-.04+r*.14), Math.sin(a)*S*(.2+r*.04)-S*.04,
          0, a+Math.PI*.5, 0));
      }
    }
  }

  if(arch.t.web || arch.plan==='spider'){
    // Extra legs
    for(let i=0;i<4;i++){
      const side=i<2?-1:1, li=i%2;
      const spiderLeg = new THREE.Group(); spiderLeg.name=`spiderLeg${i}`;
      spiderLeg.add(box(S*.1,S*.36,S*.1,mDark));
      spiderLeg.add(box(S*.07,S*.3,S*.07,mBase));
      spiderLeg.add(box(S*.08,S*.3,S*.08,mDark,0,-S*.34,0,0,0,side*.5));
      spiderLeg.add(box(S*.04,S*.08,S*.04,mBlack,side*S*.04,-S*.5,0));
      spiderLeg.position.set(side*S*.32, S*(.12-li*.2), S*(-.04+li*.15));
      spiderLeg.rotation.z = side*(.6+li*.25);
      rig.chest.add(spiderLeg);
    }
  }

  if(arch.t.ice){
    // Ice crystal spires on shoulders
    [-1,1].forEach(s=>{
      const iceMat = new THREE.MeshStandardMaterial({
        color:0xbbddff,emissive:0x44aadd,emissiveIntensity:.6,
        roughness:.02,metalness:.85,transparent:true,opacity:.85
      });
      for(let i=0;i<4;i++){
        rig.chest.add(box(S*.04,S*(.18+i*.06),S*.04,iceMat,
          s*S*(.34+i*.06), S*(.22+i*.1), 0, 0,0,s*(-.1-i*.12)));
      }
    });
    // Ice visor strip on head
    rig.head.add(box(S*.36,S*.05,S*.04,
      new THREE.MeshStandardMaterial({color:0xaaddff,emissive:0x44ccff,emissiveIntensity:2,roughness:.02,metalness:.9,transparent:true,opacity:.8}),
      0,S*.06,S*.23));
  }

  if(arch.t.cosmic){
    // Void orbs orbiting
    const orbs=[];
    const orbColors=[0x8800ff,0xcc00ff,0x4400cc,0xaa44ff];
    for(let i=0;i<8;i++){
      const ang=i/8*Math.PI*2, r=S*.65;
      const orb=new THREE.Mesh(
        new THREE.BoxGeometry(S*.07,S*.07,S*.07,2,2,2),
        new THREE.MeshStandardMaterial({color:0,emissive:orbColors[i%4],emissiveIntensity:5,roughness:0})
      );
      orb.position.set(Math.cos(ang)*r, S*.3+Math.sin(i*.8)*S*.2, Math.sin(ang)*r);
      orb.userData.orbitA=ang; orb.userData.orbitR=r; orb.userData.orbitS=.008+Math.random()*.01;
      orb.userData.orbitY=orb.position.y;
      group.add(orb);
      orbs.push(orb);
    }
    group.userData.orbitFrags=orbs;
    // Void ring around chest
    const ringMat = new THREE.MeshStandardMaterial({color:0,emissive:0x8800ff,emissiveIntensity:4,roughness:0,transparent:true,opacity:.7});
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(S*.48,S*.022,6,32),ringMat);
    ringMesh.rotation.x=Math.PI*.5; ringMesh.position.y=S*.42;
    group.add(ringMesh);
  }

  if(genome.traits.includes('plasma_core')){
    const coreMat = new THREE.MeshStandardMaterial({color:0,emissive:0xaa44ff,emissiveIntensity:6,roughness:0,transparent:true,opacity:.85});
    const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(S*.12,S*.12,S*.04,2,2,1),coreMat);
    coreMesh.position.set(0,S*.04,S*.26); rig.chest.add(coreMesh);
  }

  if(genome.traits.includes('bioluminescence')){
    const spots=[[-S*.15,S*.1,S*.22],[S*.15,S*.1,S*.22],[0,-S*.15,S*.2],[-S*.12,-S*.25,S*.18],[S*.12,-S*.25,S*.18]];
    spots.forEach(([x,y,z])=>{
      const sm=new THREE.MeshStandardMaterial({color:0,emissive:0x44ffaa,emissiveIntensity:6,roughness:0});
      rig.chest.add(part(new THREE.BoxGeometry(S*.06,S*.06,S*.04,1,1,1),sm,x,y,z));
    });
  }

  // Cast shadows on all parts
  group.traverse(c=>{ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; } });

  // Store rig reference for animation
  group.userData.shapeType  = 'evolved';
  group.userData.isEvolved  = true;
  group.userData._S         = S;
  group.userData._rig       = rig;
  group.userData._eyeCol    = eyeCol;
  group.userData._baseHex   = baseHex;

  return group;
}

// ══════════════════════════════════════════════════════════════════
//  IDLE ANIMATION
// ══════════════════════════════════════════════════════════════════
function startIdleAnim(group,arch,genome){
  const baseY = group.position.y;
  const rig   = group.userData._rig;
  const frags = group.userData.orbitFrags;
  if(!rig) return;
  let f=0;

  const {head,chest,spine,armL,armR,foreL,foreR,legL,legR,tail,wingsL,wingsR}=rig;

  const anim=()=>{
    if(!group.parent) return;
    f++;
    // Float
    group.position.y = baseY + Math.sin(f*.018)*.09;
    // Breathing
    if(chest){chest.scale.x=1+Math.sin(f*.022)*.022;chest.scale.z=1+Math.sin(f*.022)*.018;}
    // Head sway
    if(head){head.rotation.y=Math.sin(f*.014)*.1;head.rotation.x=Math.sin(f*.009)*.04;}
    // Arm idle swing
    if(armL) armL.rotation.z = -.04+Math.sin(f*.018)*.06;
    if(armR) armR.rotation.z =  .04-Math.sin(f*.018)*.06;
    if(foreL) foreL.rotation.x = Math.sin(f*.022)*.05;
    if(foreR) foreR.rotation.x = -Math.sin(f*.022)*.05;
    // Leg weight shift
    if(legL) legL.rotation.z = Math.sin(f*.015)*.03;
    if(legR) legR.rotation.z = -Math.sin(f*.015)*.03;
    // Tail sway
    if(tail){ tail.rotation.y=Math.sin(f*.025)*.22; tail.rotation.z=Math.cos(f*.018)*.08; }
    // Wings flap
    if(arch.t.fire||arch.plan==='dragon'){
      const wb=chest?.children?.filter(c=>c.name?.startsWith('wingBone'))||[];
      wb.forEach(w=>{const s=w.name.includes('L')?-1:1;w.rotation.z=s*(Math.sin(f*.12)*.12+.05);});
    }
    // Sonic membrane ripple
    if(arch.t.sonic){
      group.traverse(c=>{if(c.isMesh&&c.geometry?.type==='BoxGeometry'&&c.scale.x<.1){c.scale.y=1+Math.sin(f*.14+c.id)*.1;}});
    }
    // Eye pulse
    group.traverse(c=>{if(c.isMesh&&c.material?.emissiveIntensity>5){if(!c._ei0)c._ei0=c.material.emissiveIntensity;c.material.emissiveIntensity=c._ei0+Math.sin(f*.18)*2;}});
    // Fire glow
    if(arch.t.fire) group.traverse(c=>{if(c.isMesh&&c.material?.emissive?.getHex()===parseInt(arch.c.replace('#',''),16))c.material.emissiveIntensity=.4+Math.sin(f*.22)*.3;});
    // Ice shimmer
    if(arch.t.ice) group.traverse(c=>{if(c.isMesh&&c.material?.metalness>.8)c.material.emissiveIntensity=.5+Math.sin(f*.08+c.id*.4)*.3;});
    // Cosmic fragments orbit
    if(frags) frags.forEach(fr=>{
      fr.userData.orbitA+=fr.userData.orbitS;
      fr.position.x=Math.cos(fr.userData.orbitA)*fr.userData.orbitR;
      fr.position.z=Math.sin(fr.userData.orbitA)*fr.userData.orbitR;
      fr.position.y=fr.userData.orbitY+Math.sin(f*.026+fr.userData.orbitA)*.1;
      fr.rotation.x+=.05; fr.rotation.y+=.06;
    });
    mD(1); requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);
}

// ══════════════════════════════════════════════════════════════════
//  ATTACK ANIMATIONS — diferentes por tipo de habilidade
// ══════════════════════════════════════════════════════════════════
const ATTACK_ANIMS = {
  // Choca com ambos os braços para frente
  lightning: (rig,S)=>[
    {bone:'armL', from:{rz:-.04,rx:0}, to:{rz:-.5,rx:-1.2}, t:8},
    {bone:'armR', from:{rz: .04,rx:0}, to:{rz: .5,rx:-1.2}, t:8},
    {bone:'chest',from:{rx:0},          to:{rx:-.12},          t:6},
  ],
  // Escudo — abre os braços e empurra para frente
  shield: (rig,S)=>[
    {bone:'armL', from:{rz:-.04}, to:{rz:-1.1}, t:10},
    {bone:'armR', from:{rz: .04}, to:{rz: 1.1}, t:10},
    {bone:'foreL',from:{rx:0},    to:{rx:-.4},  t:8},
    {bone:'foreR',from:{rx:0},    to:{rx:-.4},  t:8},
  ],
  // Dash — inclina o corpo todo
  blink: (rig,S)=>[
    {bone:'spine', from:{rz:0},  to:{rz:.35},  t:5},
    {bone:'armL',  from:{rz:-.04},to:{rz:.6},  t:5},
    {bone:'armR',  from:{rz:.04}, to:{rz:.8},  t:5},
  ],
  // Acid — braço direito para baixo e para frente
  acid: (rig,S)=>[
    {bone:'armR',  from:{rz:.04,rx:0}, to:{rz:.2,rx:-1.4}, t:8},
    {bone:'foreR', from:{rx:0},         to:{rx:.3},          t:6},
    {bone:'chest', from:{ry:0},         to:{ry:-.25},         t:6},
  ],
  // Sonic — cabeça para trás depois para frente (roar)
  wave: (rig,S)=>[
    {bone:'head',  from:{rx:0},  to:{rx:-.35}, t:6},
    {bone:'neck',  from:{rx:0},  to:{rx:-.2},  t:6},
    {bone:'armL',  from:{rz:-.04},to:{rz:-.7}, t:8},
    {bone:'armR',  from:{rz:.04}, to:{rz: .7}, t:8},
  ],
  // Void — gira o tronco e estende ambos os braços
  void: (rig,S)=>[
    {bone:'spine', from:{ry:0},  to:{ry:.5},  t:8},
    {bone:'chest', from:{ry:0},  to:{ry:.5},  t:8},
    {bone:'armL',  from:{rz:-.04,rx:0},to:{rz:-1.4,rx:-.5},t:8},
    {bone:'armR',  from:{rz:.04,rx:0}, to:{rz: 1.4,rx:-.5},t:8},
  ],
  // Ulti — corpo inteiro se expande, braços abrem ao máximo
  ulti: (rig,S)=>[
    {bone:'chest', from:{rx:0},   to:{rx:-.2},   t:10},
    {bone:'armL',  from:{rz:-.04},to:{rz:-1.55}, t:10},
    {bone:'armR',  from:{rz:.04}, to:{rz: 1.55}, t:10},
    {bone:'foreL', from:{rx:0},   to:{rx:.4},    t:10},
    {bone:'foreR', from:{rx:0},   to:{rx:.4},    t:10},
    {bone:'head',  from:{rx:0},   to:{rx:-.3},   t:8},
    {bone:'legL',  from:{rz:0},   to:{rz:-.15},  t:8},
    {bone:'legR',  from:{rz:0},   to:{rz: .15},  t:8},
  ],
  // Cryo — cruza os braços na frente
  cryo: (rig,S)=>[
    {bone:'armL',  from:{rz:-.04,rx:0},to:{rz:.4,rx:-1.1},t:8},
    {bone:'armR',  from:{rz:.04,rx:0}, to:{rz:-.4,rx:-1.1},t:8},
    {bone:'chest', from:{rz:0},         to:{rz:.06},          t:6},
  ],
  // Beam — um braço estendido, corpo inclinado
  beam: (rig,S)=>[
    {bone:'armR',  from:{rz:.04,rx:0},to:{rz:.15,rx:-1.5},t:8},
    {bone:'foreR', from:{rx:0},         to:{rx:.2},          t:6},
    {bone:'spine', from:{ry:0},         to:{ry:-.3},          t:6},
    {bone:'chest', from:{ry:0},         to:{ry:-.3},          t:6},
  ],
  // Psi — levita as mãos, cabeça inclina
  psi: (rig,S)=>[
    {bone:'armL',  from:{rz:-.04,rx:0},to:{rz:-.3,rx:-.8},t:10},
    {bone:'armR',  from:{rz:.04,rx:0}, to:{rz: .3,rx:-.8},t:10},
    {bone:'head',  from:{rx:0},         to:{rx:-.25},         t:8},
    {bone:'spine', from:{rx:0},         to:{rx:-.1},           t:8},
  ],
};

function triggerAttackAnim(group, arch, effectType='lightning'){
  const rig = group.userData._rig;
  if(!rig) return;
  const S = group.userData._S || 1;

  // Get the keyframes for this effect
  const getKF = ATTACK_ANIMS[effectType] || ATTACK_ANIMS.lightning;
  const keyframes = getKF(rig, S);

  const HOLD  = 12;  // frames holding peak pose
  const TOTAL_IN  = Math.max(...keyframes.map(k=>k.t));
  const TOTAL = TOTAL_IN + HOLD + TOTAL_IN;

  // Save original rotations
  const origRots = {};
  keyframes.forEach(({bone})=>{
    if(rig[bone]) origRots[bone]={rx:rig[bone].rotation.x,ry:rig[bone].rotation.y,rz:rig[bone].rotation.z};
  });

  let f=0;
  const anim=()=>{
    f++;
    if(f <= TOTAL_IN){
      // Phase 1: wind-up to peak pose
      const t = f / TOTAL_IN;
      const ease = t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2; // easeInOut
      keyframes.forEach(({bone,from,to,t:boneT})=>{
        if(!rig[bone]) return;
        const bt = Math.min(1, (f/boneT));
        const be = bt<.5?2*bt*bt:1-Math.pow(-2*bt+2,2)/2;
        if(to.rx!==undefined) rig[bone].rotation.x = (from.rx||0)+(to.rx-(from.rx||0))*be;
        if(to.ry!==undefined) rig[bone].rotation.y = (from.ry||0)+(to.ry-(from.ry||0))*be;
        if(to.rz!==undefined) rig[bone].rotation.z = (from.rz||0)+(to.rz-(from.rz||0))*be;
      });
    } else if(f <= TOTAL_IN+HOLD){
      // Phase 2: hold pose
    } else {
      // Phase 3: return to original
      const t = (f - TOTAL_IN - HOLD) / TOTAL_IN;
      const ease = t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
      keyframes.forEach(({bone,from,to})=>{
        if(!rig[bone]||!origRots[bone]) return;
        const orig = origRots[bone];
        if(to.rx!==undefined) rig[bone].rotation.x = to.rx+(orig.rx-to.rx)*ease;
        if(to.ry!==undefined) rig[bone].rotation.y = to.ry+(orig.ry-to.ry)*ease;
        if(to.rz!==undefined) rig[bone].rotation.z = to.rz+(orig.rz-to.rz)*ease;
      });
      if(f >= TOTAL){
        // Snap back
        keyframes.forEach(({bone})=>{
          if(!rig[bone]||!origRots[bone]) return;
          Object.assign(rig[bone].rotation, origRots[bone]);
        });
        mD(2); return;
      }
    }
    mD(2); requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);

  // Flash color per effect
  const flashColors={lightning:'rgba(200,220,255,.5)',shield:'rgba(76,239,172,.4)',blink:'rgba(196,181,253,.5)',acid:'rgba(136,255,68,.4)',wave:'rgba(255,217,92,.4)',void:'rgba(255,68,255,.5)',ulti:'rgba(255,140,0,.6)',cryo:'rgba(68,220,255,.45)',beam:'rgba(255,100,0,.5)',psi:'rgba(180,80,255,.5)'};
  flash(flashColors[effectType]||'rgba(150,120,255,.4)', 110);
}


// ══════════════════════════════════════════════════════════════════
//  SKILLS PANEL
// ══════════════════════════════════════════════════════════════════
function updateSkillBtn(obj){
  const btn=$('nh-skt');if(!btn)return;
  if(obj?.userData?.isEvolved&&obj?.userData?.evolvedSkills){btn.classList.remove('hidden');btn._ev=obj;}
  else{btn.classList.add('hidden');$('nh-skp')?.classList.add('hidden');$('nh-skcf')?.classList.add('hidden');}
}

function showSkills(obj){
  const skills=obj.userData.evolvedSkills,nm=obj.userData.archetypeName||'Evolved',ic=obj.userData.archetypeIcon||'star';
  const sp=$('nh-skp');if(!sp)return;
  const RC=['#444','#ff5252','#ff8800','#ffd95c','#4cefac','#a78bfa'];
  sp.innerHTML=`
  <div class="sk-hd"><div class="sk-ic">${ico(ic,15)}</div><h4>${nm}</h4><button class="nh-xb" id="nh-sp-x">${ico('close',11)}</button></div>
  ${skills.map((sk,i)=>`
  <div class="sk-row${sk.sp?' sk-sp':''}" data-i="${i}">
    <div class="sk-ico" style="background:${sk.color}22;color:${sk.color}">${ico(sk.ico||sk.icon||'zap',13)}</div>
    <div class="sk-inf">
      <div class="sk-nm" style="color:${sk.color}">${sk.n||sk.name}</div>
      <div class="sk-ds">${sk.desc}</div>
      <div class="sk-rg" style="color:${RC[sk.rage]}">
        ${Array.from({length:5},(_,j)=>`<span class="${j<sk.rage?'on':''}" style="${j<sk.rage?'background:'+RC[sk.rage]:''}"></span>`).join('')}
      </div></div>
    <button class="sk-cfg" data-c="${i}">${ico('gear',9)}</button>
  </div>${sk.sp&&i===skills.length-2?'<div class="sk-div"></div>':''}`).join('')}`;
  sp.classList.remove('hidden');
  $('nh-sp-x')?.addEventListener('click',()=>{sp.classList.add('hidden');$('nh-skcf')?.classList.add('hidden');});
  sp.querySelectorAll('.sk-row').forEach(r=>{r.addEventListener('click',e=>{if(e.target.closest('.sk-cfg'))return;const i=+r.dataset.i;r.classList.add('burst');setTimeout(()=>r.classList.remove('burst'),380);fireSkill(obj,skills[i]);triggerAttackAnim(obj,obj.userData.archetype||{t:{}},skills[i].eff||'lightning');});});
  sp.querySelectorAll('.sk-cfg').forEach(b=>{b.addEventListener('click',e=>{e.stopPropagation();openSkillCfg(obj,skills,+b.dataset.c);});});
}

function openSkillCfg(obj,skills,idx){
  const sk=skills[idx];const cf=$('nh-skcf');if(!cf)return;
  const RC=['#444','#ff5252','#ff8800','#ffd95c','#4cefac','#a78bfa'];
  const COLS=['#5f7fff','#4cefac','#ffd95c','#ff5252','#cc80ff','#ff8060','#00ddff','#ffaa00','#88ff44','#ffffff'];
  cf.innerHTML=`<div class="cf-hd"><span style="color:${sk.color}">${ico(sk.ico||sk.icon||'zap',13)}</span><h5>${sk.n||sk.name}</h5><button class="nh-xb" id="cf-x">${ico('close',11)}</button></div>
  <div class="cf-sc"><div class="cf-lb">Rage (${sk.rage}/5)</div><div class="cf-rg" id="cf-rg">${Array.from({length:5},(_,i)=>`<div class="cf-dot" data-r="${i+1}" style="background:${i<sk.rage?RC[sk.rage]:'rgba(255,255,255,.1)'};box-shadow:${i<sk.rage?'0 0 5px '+RC[sk.rage]:'none'}"></div>`).join('')}</div></div>
  <div class="cf-sc"><div class="cf-lb">Cor</div><div class="cf-cl">${COLS.map(c=>`<div class="cf-sw${sk.color===c?' on':''}" data-c="${c}" style="background:${c}"></div>`).join('')}</div></div>
  <div class="cf-sc"><div class="cf-lb">Frame</div><div class="cf-rw"><input type="number" id="cf-fr" value="${sk.frame}" min="0" max="999"><span style="font-size:9.5px;color:rgba(255,255,255,.28)">frame</span></div></div>
  <button class="cf-ok" id="cf-ok">${ico('skills',11)} Aplicar</button>`;
  cf.classList.remove('hidden');
  $('cf-x')?.addEventListener('click',()=>cf.classList.add('hidden'));
  cf.querySelectorAll('.cf-dot').forEach(d=>{d.addEventListener('click',()=>{sk.rage=+d.dataset.r;d.closest('#cf-rg').querySelectorAll('.cf-dot').forEach((dt,i)=>{dt.style.background=i<sk.rage?RC[sk.rage]:'rgba(255,255,255,.1)';dt.style.boxShadow=i<sk.rage?`0 0 5px ${RC[sk.rage]}`:'none';});showSkills(obj);});});
  cf.querySelectorAll('.cf-sw').forEach(sw=>{sw.addEventListener('click',()=>{sk.color=sw.dataset.c;cf.querySelectorAll('.cf-sw').forEach(s=>s.classList.remove('on'));sw.classList.add('on');});});
  $('cf-ok')?.addEventListener('click',()=>{sk.frame=parseInt($('cf-fr')?.value)||0;showSkills(obj);cf.classList.add('hidden');toast(`${sk.n||sk.name} atualizada!`,1500);});
}

function fireSkill(obj,skill){
  const sc=gSc();if(!sc||!obj)return;
  const pos=gWP(obj);const col=parseInt((skill.color||'#5f7fff').replace('#',''),16);
  const eff=skill.eff||skill.sfx||'lightning';
  switch(eff){
    case'lightning':sfxLightning(sc,pos,col,skill.rage);break;
    case'shield':sfxShield(sc,pos,col,obj,skill.rage);break;
    case'blink':sfxBlink(sc,pos,col,obj);break;
    case'acid':sfxAcid(sc,pos,col,skill.rage);break;
    case'wave':sfxWave(sc,pos,col,skill.rage);break;
    case'void':sfxVoid(sc,pos,col,skill.rage);break;
    case'ulti':sfxUlti(sc,pos,obj,skill.rage);break;
    case'cryo':sfxCryo(sc,pos,col,skill.rage);break;
    case'beam':sfxBeam(sc,pos,col,skill.rage);break;
    case'psi':sfxPsi(sc,pos,col,skill.rage);break;
    case'nano':sfxNano(sc,pos,col,skill.rage);break;
    case'temporal':sfxTemporal(sc,pos,col,skill.rage);break;
    case'gravity':sfxGravity(sc,pos,col,skill.rage);break;
    case'spore':sfxSpore(sc,pos,col,skill.rage);break;
    case'magnet':sfxMagnet(sc,pos,col,skill.rage);break;
    default:sfxBurst(pos,col,50,4);
  }
  toast(`${skill.n||skill.name} (Rage ${skill.rage})`,1300);mD(4);
}

// ══════════════════════════════════════════════════════════════════
//  SFM EFFECTS — sprites billboard + multi-layer particles
//  Inspirado em Source Filmmaker: halos grandes, additive layers,
//  hit flashes, tracer rounds, volumetric rings
// ══════════════════════════════════════════════════════════════════

// ── Halo sprite (billboard quad que sempre olha câmera) ───────────
function mkHalo(sc, pos, col, size, opacity=1){
  const g = new THREE.PlaneGeometry(size, size);
  const m = new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const h = new THREE.Mesh(g, m);
  h.position.copy(pos);
  // Face camera every frame
  h.userData.isBillboard = true;
  sc.add(h);
  return { mesh: h, mat: m };
}

// ── Spark cube (small box spinning) ──────────────────────────────
function mkSpark(sc, pos, col, size=.06){
  const g = new THREE.BoxGeometry(size,size,size,1,1,1);
  const m = new THREE.MeshStandardMaterial({
    color:0, emissive:col, emissiveIntensity:4, roughness:0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const s = new THREE.Mesh(g,m); s.position.copy(pos); sc.add(s);
  return {mesh:s, mat:m};
}

// ── Billboard update hook (call in animate or per-effect) ─────────
function faceCamera(mesh){
  const cam = window._nexusScene?.userData?._cam || (window._nexusRenderer?.domElement && null);
  // Use three's lookAt camera trick via quaternion copy
  if(window._nexusRenderer){
    const c = window.camera;
    if(c) mesh.quaternion.copy(c.quaternion);
  }
}

// ── Core burst with halos + sparks (SFM style) ───────────────────
function sfxBurst(pos, color=0xffd700, n=60, spd=3){
  const sc = gSc(); if(!sc) return;

  // Layer 1: small additive point particles
  const pa = new Float32Array(n*3), vl = [];
  for(let i=0;i<n;i++){
    pa[i*3]=pos.x; pa[i*3+1]=pos.y; pa[i*3+2]=pos.z;
    vl.push(new THREE.Vector3((Math.random()-.5)*spd, Math.random()*spd*.9+.2, (Math.random()-.5)*spd));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pa, 3));
  const pMat = new THREE.PointsMaterial({color, size:.18, transparent:true, opacity:1, depthWrite:false, blending:THREE.AdditiveBlending});
  const pts = new THREE.Points(geo, pMat); sc.add(pts);

  // Layer 2: large glow halos (fake volumetric)
  const numHalos = 6;
  const halos = [];
  for(let i=0;i<numHalos;i++){
    const {mesh,mat} = mkHalo(sc, pos.clone(), color, .6+Math.random()*.8, .35+Math.random()*.3);
    mesh.position.add(new THREE.Vector3((Math.random()-.5)*spd*.2, Math.random()*spd*.15, (Math.random()-.5)*spd*.2));
    halos.push({mesh,mat, vx:(Math.random()-.5)*spd*.3, vy:Math.random()*spd*.2+.1, vz:(Math.random()-.5)*spd*.3});
  }

  // Layer 3: spinning cube sparks
  const sparks = [];
  const nSparks = Math.min(n/5, 12);
  for(let i=0;i<nSparks;i++){
    const {mesh,mat} = mkSpark(sc, pos.clone(), color, .04+Math.random()*.06);
    const v = new THREE.Vector3((Math.random()-.5)*spd*.8, Math.random()*spd*.6+.3, (Math.random()-.5)*spd*.8);
    sparks.push({mesh,mat,v,rx:Math.random()*.3,ry:Math.random()*.3});
  }

  let t = 0;
  const tick = () => {
    t += .016;
    const p = geo.attributes.position.array;
    for(let i=0;i<n;i++){
      p[i*3]   += vl[i].x*.016; p[i*3+1] += vl[i].y*.016; p[i*3+2] += vl[i].z*.016;
      vl[i].y  -= .08;
    }
    geo.attributes.position.needsUpdate = true;
    pMat.opacity = Math.max(0, 1 - t/1.6);

    halos.forEach(h => {
      h.mesh.position.x += h.vx*.016; h.mesh.position.y += h.vy*.016; h.mesh.position.z += h.vz*.016;
      h.vy -= .04;
      h.mat.opacity = Math.max(0, (1-t/1.4)*0.35);
      faceCamera(h.mesh);
    });
    sparks.forEach(s => {
      s.mesh.position.addScaledVector(s.v, .016); s.v.y -= .06;
      s.mesh.rotation.x += s.rx; s.mesh.rotation.y += s.ry;
      s.mat.opacity = Math.max(0, 1-t*.7);
    });

    mD(2);
    if(t < 1.8){ requestAnimationFrame(tick); }
    else{
      sc.remove(pts); geo.dispose(); pMat.dispose();
      halos.forEach(h=>{sc.remove(h.mesh);h.mesh.geometry.dispose();h.mat.dispose();});
      sparks.forEach(s=>{sc.remove(s.mesh);s.mesh.geometry.dispose();s.mat.dispose();});
    }
  };
  requestAnimationFrame(tick);
}

// ── SFM Explosion: concentric halos + spark shower + core blast ──
function sfxExplosion(pos, color=0x4cefac){
  const sc = gSc(); if(!sc) return;
  sfxBurst(pos, color, 180, 10);

  // Concentric shockwave rings
  for(let ring=0;ring<5;ring++){
    const g = new THREE.TorusGeometry(.05, .05, 6, 40);
    const m = new THREE.MeshBasicMaterial({color, transparent:true, opacity:.9, blending:THREE.AdditiveBlending, depthWrite:false});
    const t = new THREE.Mesh(g,m); t.position.copy(pos); t.rotation.x=Math.PI*.5; sc.add(t);
    let ti=0, dl=ring*.07;
    const a=()=>{ti+=.018;if(ti<dl){requestAnimationFrame(a);return;}
      const lt=ti-dl; t.scale.setScalar(1+lt*14); m.opacity=Math.max(0,.9-lt*1.1);
      mD(2); if(lt<.82)requestAnimationFrame(a);else{sc.remove(t);g.dispose();m.dispose();}};
    requestAnimationFrame(a);
  }

  // Core glow halo — massive
  const {mesh:cHalo, mat:cMat} = mkHalo(sc, pos.clone(), color, 3.5, .7);
  let ct=0;
  const ca=()=>{ct+=.02; cMat.opacity=Math.max(0,.7-ct*1.2); cHalo.scale.setScalar(1+ct*4); faceCamera(cHalo); mD(2);
    if(ct<.6)requestAnimationFrame(ca);else{sc.remove(cHalo);cHalo.geometry.dispose();cMat.dispose();}};
  requestAnimationFrame(ca);

  flash(`rgba(${(color>>16)&255},${(color>>8)&255},${color&255},.6)`, 200);
}

// ── LIGHTNING ─────────────────────────────────────────────────────
function sfxLightning(sc,pos,col,rage){
  // Jagged bolts
  for(let i=0;i<8+rage*3;i++){
    const dir = new THREE.Vector3((Math.random()-.5)*4,(Math.random()-.5)*3.5,(Math.random()-.5)*4).normalize();
    const pts = [pos.clone()]; let p = pos.clone();
    for(let s=0;s<7;s++){
      const n = p.clone().addScaledVector(dir,.5+Math.random()*.5)
        .add(new THREE.Vector3((Math.random()-.5)*.4,(Math.random()-.5)*.4,(Math.random()-.5)*.4));
      pts.push(n); p = n;
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineBasicMaterial({color:col,transparent:true,opacity:1,blending:THREE.AdditiveBlending});
    const l = new THREE.Line(g,m); sc.add(l);
    // Glow line (thicker, dimmer)
    const mg = new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.35,blending:THREE.AdditiveBlending});
    const lg = new THREE.Line(g.clone(),mg); sc.add(lg);
    let t=0;
    const a=()=>{t+=.04;m.opacity=1-t;mg.opacity=.35-t*.35;mD(2);
      if(t<1)requestAnimationFrame(a);else{sc.remove(l);sc.remove(lg);g.dispose();m.dispose();mg.dispose();}};
    requestAnimationFrame(a);
  }
  // Impact halos at center
  for(let h=0;h<3;h++){
    const {mesh,mat} = mkHalo(sc, pos.clone(), col, 1.2+h*.5, .55-h*.12);
    let t=0;
    const a=()=>{t+=.03;mesh.scale.setScalar(1+t*5);mat.opacity=Math.max(0,(.55-h*.12)-t*.9);faceCamera(mesh);mD(2);
      if(t<.65)requestAnimationFrame(a);else{sc.remove(mesh);mesh.geometry.dispose();mat.dispose();}};
    requestAnimationFrame(a);
  }
  sfxBurst(pos,col,50+rage*18,6);
  flash(`rgba(${(col>>16)&255},${(col>>8)&255},${col&255},.5)`, 80);
}

// ── SHIELD ────────────────────────────────────────────────────────
function sfxShield(sc,pos,col,obj,rage){
  const g=new THREE.SphereGeometry(1.2+rage*.2,18,14);
  const m=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:2,transparent:true,opacity:.24,side:THREE.DoubleSide,roughness:0,blending:THREE.AdditiveBlending});
  const s=new THREE.Mesh(g,m); s.position.copy(pos); sc.add(s);
  // Hex wireframe overlay
  const hg=new THREE.SphereGeometry(1.28+rage*.2,8,8);
  const hm=new THREE.MeshBasicMaterial({color:col,wireframe:true,transparent:true,opacity:.18,blending:THREE.AdditiveBlending});
  const hex=new THREE.Mesh(hg,hm); hex.position.copy(pos); sc.add(hex);
  // Rim glow halos
  const {mesh:rHalo,mat:rMat} = mkHalo(sc,pos.clone(),col,3.2,.38);
  let t=0;
  const a=()=>{t+=.015;
    s.scale.setScalar(1+Math.sin(t*5)*.04); s.rotation.y+=.03;
    hex.rotation.y+=.055; hex.rotation.x+=.02;
    const fade=t<.3?t/.3:t>1.5?1-(t-1.5)/.5:1;
    m.opacity=.24*fade; hm.opacity=.18*fade;
    rMat.opacity=.38*fade; rHalo.scale.setScalar(1+Math.sin(t*3)*.06); faceCamera(rHalo);
    mD(2); if(t<2)requestAnimationFrame(a);
    else{sc.remove(s);sc.remove(hex);sc.remove(rHalo);g.dispose();m.dispose();hg.dispose();hm.dispose();rHalo.geometry.dispose();rMat.dispose();}};
  requestAnimationFrame(a);
}

// ── BLINK ─────────────────────────────────────────────────────────
function sfxBlink(sc,pos,col,obj){
  // After-image halo
  const {mesh,mat} = mkHalo(sc,pos.clone(),col,2,.5);
  let t=0; const a=()=>{t+=.04;mat.opacity=Math.max(0,.5-t);mesh.scale.setScalar(1+t*3);faceCamera(mesh);mD(2);
    if(t<.55)requestAnimationFrame(a);else{sc.remove(mesh);mesh.geometry.dispose();mat.dispose();}};
  requestAnimationFrame(a);
  sfxBurst(pos,col,60,5);
  // Teleport
  if(obj && obj.position){
    const d=new THREE.Vector3((Math.random()-.5)*4,0,(Math.random()-.5)*4);
    obj.position.add(d);
    setTimeout(()=>{ sfxBurst(gWP(obj),col,60,5); mD(3); },80);
  }
}

// ── ACID ──────────────────────────────────────────────────────────
function sfxAcid(sc,pos,col,rage){
  for(let i=0;i<22+rage*8;i++){
    const g=new THREE.BoxGeometry(.05+Math.random()*.05,.05+Math.random()*.05,.05+Math.random()*.05,1,1,1);
    const m=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:2.5,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false});
    const d=new THREE.Mesh(g,m); d.position.copy(pos);
    const v=new THREE.Vector3((Math.random()-.5)*3,Math.random()*2.5+.5,(Math.random()-.5)*3);
    sc.add(d);
    let t=0;
    const a=()=>{t+=.016;d.position.addScaledVector(v,.016);v.y-=.12;
      if(d.position.y<pos.y-.5){d.position.y=pos.y-.5;v.y=Math.abs(v.y)*.25;v.x*=.4;v.z*=.4;}
      d.rotation.x+=.1;d.rotation.z+=.08;
      m.opacity=Math.max(0,.9-t*.4);mD(2);
      if(t<2.5)requestAnimationFrame(a);else{sc.remove(d);g.dispose();m.dispose();}};
    requestAnimationFrame(a);
  }
  // Acid pool halo on ground
  const {mesh:ph,mat:pm}=mkHalo(sc,new THREE.Vector3(pos.x,pos.y-.4,pos.z),col,1.8+rage*.3,.4);
  ph.rotation.x=Math.PI*.5;
  let pt=0; const pa=()=>{pt+=.01;pm.opacity=Math.max(0,.4-pt*.22);ph.scale.setScalar(1+pt*2);mD(1);
    if(pt<2)requestAnimationFrame(pa);else{sc.remove(ph);ph.geometry.dispose();pm.dispose();}};
  requestAnimationFrame(pa);
}

// ── WAVE ──────────────────────────────────────────────────────────
function sfxWave(sc,pos,col,rage){
  for(let ring=0;ring<4+rage;ring++){
    const g=new THREE.TorusGeometry(.1,.06,6,44);
    const m=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false});
    const t=new THREE.Mesh(g,m); t.position.copy(pos); t.rotation.x=Math.PI*.5; sc.add(t);
    let ti=0, dl=ring*.1;
    const a=()=>{ti+=.02;if(ti<dl){requestAnimationFrame(a);return;}
      const lt=ti-dl; t.scale.setScalar(1+lt*10); m.opacity=Math.max(0,.9-lt*.85);mD(2);
      if(lt<1.06)requestAnimationFrame(a);else{sc.remove(t);g.dispose();m.dispose();}};
    requestAnimationFrame(a);
    // Matching halo ring
    const {mesh:wh,mat:wm}=mkHalo(sc,pos.clone(),col,(.2+ring*.6)*2,.3-ring*.05);
    let wt=dl;
    const wa=()=>{wt+=.02;wh.scale.setScalar(1+wt*8);wm.opacity=Math.max(0,(.3-ring*.05)-(wt-dl)*.5);faceCamera(wh);mD(2);
      if(wt-dl<1)requestAnimationFrame(wa);else{sc.remove(wh);wh.geometry.dispose();wm.dispose();}};
    setTimeout(()=>requestAnimationFrame(wa), dl*50);
  }
}

// ── VOID ──────────────────────────────────────────────────────────
function sfxVoid(sc,pos,col,rage){
  // Imploding cube-sparks
  for(let i=0;i<10+rage*3;i++){
    const {mesh,mat}=mkSpark(sc,pos.clone(),col,.07+Math.random()*.05);
    const startPos=pos.clone().add(new THREE.Vector3((Math.random()-.5)*2,(Math.random()-.5)*2,(Math.random()-.5)*2));
    mesh.position.copy(startPos);
    let t=0;
    const a=()=>{t+=.025;mesh.position.lerp(pos,t*.18);mesh.rotation.x+=.08;mesh.rotation.y+=.1;
      mat.opacity=Math.max(0,1-Math.pow(t,2)*.4);mD(2);
      if(t<1.2)requestAnimationFrame(a);else{sc.remove(mesh);mesh.geometry.dispose();mat.dispose();}};
    requestAnimationFrame(a);
  }
  // Expanding void orb
  const og=new THREE.BoxGeometry(.3,.3,.3,2,2,2);
  const om=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:6,transparent:true,opacity:.9,roughness:0,blending:THREE.AdditiveBlending,depthWrite:false});
  const orb=new THREE.Mesh(og,om); orb.position.copy(pos); sc.add(orb);
  // Central halo
  const {mesh:vh,mat:vm}=mkHalo(sc,pos.clone(),col,0.1,.9);
  let t=0;
  const a=()=>{t+=.02;const s=1+t*(5+rage*2);
    orb.scale.setScalar(s);orb.rotation.x+=.05;orb.rotation.y+=.06;
    om.opacity=Math.max(0,.9-t*.6);om.emissiveIntensity=6-t*4;
    vh.scale.setScalar(s*2.5);vm.opacity=Math.max(0,.6-t*.5);faceCamera(vh);
    mD(2); if(t<1.5)requestAnimationFrame(a);
    else{sc.remove(orb);sc.remove(vh);og.dispose();om.dispose();vh.geometry.dispose();vm.dispose();sfxBurst(pos,0xaa00ff,90,7);}};
  requestAnimationFrame(a);
  flash(`rgba(${(col>>16)&255},0,255,.55)`,150);
}

// ── ULTIMATE ──────────────────────────────────────────────────────
function sfxUlti(sc,pos,obj,rage){
  const col=0xff8800;
  // Spiral sparks upward
  for(let i=0;i<32;i++){
    const t0=i/32; const {mesh,mat}=mkSpark(sc,pos.clone(),col,.06+Math.random()*.04);
    const an=t0*Math.PI*8, r=.3+t0*2.5;
    mesh.position.set(pos.x+Math.cos(an)*r, pos.y+t0*3, pos.z+Math.sin(an)*r);
    sc.add(mesh);
    let st=0;
    const sa=()=>{st+=.02;mesh.rotation.x+=.1;mesh.rotation.z+=.08;
      mat.opacity=Math.max(0,1-st*.65);mD(2);
      if(st<1.5)requestAnimationFrame(sa);else{sc.remove(mesh);mesh.geometry.dispose();mat.dispose();}};
    requestAnimationFrame(sa);
  }
  // Aura sphere
  const ag=new THREE.SphereGeometry(1.5+rage*.3,12,10);
  const am=new THREE.MeshStandardMaterial({color:col,emissive:0xff4400,emissiveIntensity:3,transparent:true,opacity:.35,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  const au=new THREE.Mesh(ag,am); au.position.copy(pos); sc.add(au);
  // Big halo
  const {mesh:bh,mat:bm}=mkHalo(sc,pos.clone(),col,5,.55);
  let t=0;
  const a=()=>{t+=.01;au.rotation.y+=.055;au.rotation.x+=.025;au.scale.setScalar(1+Math.sin(t*6)*.08);
    am.emissiveIntensity=2.5+Math.sin(t*10)*1.5;
    const f=t<.3?t/.3:t>2.5?1-(t-2.5)/.5:1;am.opacity=.35*f;
    bm.opacity=.55*f*0.6;bh.scale.setScalar(1+t*1.5);faceCamera(bh);mD(2);
    if(t<3)requestAnimationFrame(a);else{sc.remove(au);sc.remove(bh);ag.dispose();am.dispose();bh.geometry.dispose();bm.dispose();}};
  sfxBurst(pos,col,140,8); requestAnimationFrame(a); flash('rgba(255,140,0,.65)',220);
}

// ── CRYO ──────────────────────────────────────────────────────────
function sfxCryo(sc,pos,col,rage){
  sfxWave(sc,pos,col,rage+1);
  sfxBurst(pos,col,70+rage*14,5);
  // Ice shard cubes
  for(let i=0;i<8+rage*3;i++){
    const h=.15+Math.random()*.25;
    const g=new THREE.BoxGeometry(.04,h,.04,1,2,1);
    const m=new THREE.MeshStandardMaterial({color:0xaaddff,emissive:0x44aadd,emissiveIntensity:1.5,roughness:.02,metalness:.88,transparent:true,opacity:.82});
    const c=new THREE.Mesh(g,m);
    const an=Math.random()*Math.PI*2;
    c.position.set(pos.x+Math.cos(an)*(Math.random()*.6),pos.y-.2,pos.z+Math.sin(an)*(Math.random()*.6));
    c.rotation.x=Math.PI+Math.random()*.5-.25; c.rotation.z=Math.random()*.3-.15;
    sc.add(c);
    setTimeout(()=>{let t=0;const fa=()=>{t+=.015;m.opacity=Math.max(0,.82-t*.4);mD(1);
      if(t<2.5)requestAnimationFrame(fa);else{sc.remove(c);g.dispose();m.dispose();}};requestAnimationFrame(fa);},300+i*80);
  }
  flash('rgba(100,200,255,.42)',110);
}

// ── BEAM ──────────────────────────────────────────────────────────
function sfxBeam(sc,pos,col,rage){
  const end=pos.clone().add(new THREE.Vector3(0,0,(4+rage)*-1));
  const pts=[pos,end];
  const g=new THREE.BufferGeometry().setFromPoints(pts);
  const m=new THREE.LineBasicMaterial({color:col,transparent:true,opacity:1,blending:THREE.AdditiveBlending,linewidth:2});
  const l=new THREE.Line(g,m); sc.add(l);
  // Thick glow line
  const mg=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.4,blending:THREE.AdditiveBlending});
  const gl=new THREE.Line(g.clone(),mg); sc.add(gl);
  // Impact halos at endpoint
  for(let h=0;h<3;h++){
    const {mesh,mat}=mkHalo(sc,end.clone(),col,1+h*.5,.5-h*.12);
    let t=0; const a=()=>{t+=.03;mesh.scale.setScalar(1+t*4);mat.opacity=Math.max(0,(.5-h*.12)-t*.7);faceCamera(mesh);mD(2);
      if(t<.75)requestAnimationFrame(a);else{sc.remove(mesh);mesh.geometry.dispose();mat.dispose();}};
    requestAnimationFrame(a);
  }
  sfxBurst(end,col,55+rage*12,5);
  let t=0; const a=()=>{t+=.025;m.opacity=1-t;mg.opacity=.4-t*.4;mD(2);
    if(t<1)requestAnimationFrame(a);else{sc.remove(l);sc.remove(gl);g.dispose();m.dispose();mg.dispose();}};
  requestAnimationFrame(a);
  flash(`rgba(${(col>>16)&255},${(col>>8)&255},${col&255},.48)`,90);
}

// ── PSI ───────────────────────────────────────────────────────────
function sfxPsi(sc,pos,col,rage){
  for(let r=0;r<4+rage;r++){
    const g=new THREE.TorusGeometry(.2+r*.38,(.2+r*.38)*.12,6,36);
    const m=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false});
    const ri=new THREE.Mesh(g,m); ri.position.copy(pos); ri.rotation.x=Math.PI*.5+r*.3; sc.add(ri);
    let t=0, dl=r*.08;
    const a=()=>{t+=.02;if(t<dl){requestAnimationFrame(a);return;}const lt=t-dl;
      ri.scale.setScalar(1+lt*5.5);m.opacity=Math.max(0,.8-lt*1.1);ri.rotation.z+=.06;mD(2);
      if(lt<.75)requestAnimationFrame(a);else{sc.remove(ri);g.dispose();m.dispose();}};
    requestAnimationFrame(a);
  }
  const {mesh,mat}=mkHalo(sc,pos.clone(),col,2.5,.45);
  let t=0; const ha=()=>{t+=.02;mat.opacity=Math.max(0,.45-t*.5);mesh.scale.setScalar(1+t*4);faceCamera(mesh);mD(2);
    if(t<.9)requestAnimationFrame(ha);else{sc.remove(mesh);mesh.geometry.dispose();mat.dispose();}};
  requestAnimationFrame(ha);
  flash('rgba(180,80,255,.44)',105);
}

// ── NANO ──────────────────────────────────────────────────────────
function sfxNano(sc,pos,col,rage){
  for(let i=0;i<35+rage*14;i++){
    const g=new THREE.BoxGeometry(.04,.04,.04,1,1,1);
    const m=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:3.5,roughness:0,blending:THREE.AdditiveBlending,depthWrite:false});
    const b=new THREE.Mesh(g,m);
    const an=Math.random()*Math.PI*2, el=Math.random()*Math.PI, r=Math.random()*(1.2+rage*.25);
    b.position.set(pos.x+Math.sin(el)*Math.cos(an)*r, pos.y+Math.cos(el)*r, pos.z+Math.sin(el)*Math.sin(an)*r);
    sc.add(b);
    let t=0, sp=.04+Math.random()*.05;
    const a=()=>{t+=.016;b.rotation.x+=sp;b.rotation.y+=sp*.75;b.position.lerp(pos,t*.06);
      m.opacity=Math.max(0,1-t*.7);mD(2);
      if(t<1.8)requestAnimationFrame(a);else{sc.remove(b);g.dispose();m.dispose();}};
    requestAnimationFrame(a);
  }
}

// ── TEMPORAL ──────────────────────────────────────────────────────
function sfxTemporal(sc,pos,col,rage){
  for(let i=0;i<3+rage;i++){
    const g=new THREE.TorusGeometry(.3+i*.42,.04,6,42);
    const m=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.82,blending:THREE.AdditiveBlending,depthWrite:false});
    const t=new THREE.Mesh(g,m); t.position.copy(pos); t.rotation.x=i*.45; sc.add(t);
    let ti=0, dl=i*.1;
    const a=()=>{ti+=.018;if(ti<dl){requestAnimationFrame(a);return;}const lt=ti-dl;
      t.scale.setScalar(1+lt*6.5);t.rotation.z+=.1;m.opacity=Math.max(0,.82-lt*.88);mD(2);
      if(lt<.95)requestAnimationFrame(a);else{sc.remove(t);g.dispose();m.dispose();}};
    requestAnimationFrame(a);
  }
  sfxBlink(sc,pos,col,{position:pos.clone()});
  flash('rgba(153,102,255,.45)',125);
}

// ── GRAVITY ───────────────────────────────────────────────────────
function sfxGravity(sc,pos,col,rage){
  sfxBurst(pos,col,55,3);
  const g=new THREE.SphereGeometry(.55+rage*.12,14,10);
  const m=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:4.5,transparent:true,opacity:.42,roughness:0,blending:THREE.AdditiveBlending,depthWrite:false});
  const s=new THREE.Mesh(g,m); s.position.copy(pos); sc.add(s);
  const {mesh,mat}=mkHalo(sc,pos.clone(),col,3.5,.38);
  let t=0;
  const a=()=>{t+=.022;s.scale.setScalar(1+t*2.2);m.opacity=Math.max(0,.42-t*.4);
    mesh.scale.setScalar(1+t*3);mat.opacity=Math.max(0,.38-t*.38);faceCamera(mesh);mD(2);
    if(t<1.1)requestAnimationFrame(a);else{sc.remove(s);sc.remove(mesh);g.dispose();m.dispose();mesh.geometry.dispose();mat.dispose();}};
  requestAnimationFrame(a);
  flash('rgba(180,180,180,.38)',85);
}

// ── SPORE ─────────────────────────────────────────────────────────
function sfxSpore(sc,pos,col,rage){
  sfxBurst(pos,col,90+rage*18,4.5);
  const g=new THREE.SphereGeometry(1.6+rage*.22,10,8);
  const m=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:1.5,transparent:true,opacity:.18,roughness:.8,blending:THREE.AdditiveBlending,depthWrite:false});
  const s=new THREE.Mesh(g,m); s.position.copy(pos); sc.add(s);
  let t=0;const a=()=>{t+=.01;s.scale.setScalar(1+t*3.5);m.opacity=Math.max(0,.18-t*.13);mD(2);
    if(t<1.6)requestAnimationFrame(a);else{sc.remove(s);g.dispose();m.dispose();}};requestAnimationFrame(a);
}

// ── MAGNET ────────────────────────────────────────────────────────
function sfxMagnet(sc,pos,col,rage){
  for(let i=0;i<8+rage*2;i++){
    const a=i/(8+rage*2)*Math.PI*2;
    const {mesh,mat}=mkSpark(sc,pos.clone(),col,.06+Math.random()*.04);
    let t=0;
    const fa=()=>{t+=.022;
      mesh.position.x=pos.x+Math.cos(a+t)*t*2.2;mesh.position.y=pos.y+Math.sin(t*3)*.6;
      mesh.position.z=pos.z+Math.sin(a+t)*t*2.2;mesh.rotation.x+=.1;mesh.rotation.z+=.08;
      mat.opacity=Math.max(0,.85-t*.6);mD(2);
      if(t<1.4)requestAnimationFrame(fa);else{sc.remove(mesh);mesh.geometry.dispose();mat.dispose();}};
    requestAnimationFrame(fa);
  }
  const {mesh:mh,mat:mm}=mkHalo(sc,pos.clone(),col,2.2,.4);
  let t=0; const a=()=>{t+=.025;mh.scale.setScalar(1+t*2);mm.opacity=Math.max(0,.4-t*.4);faceCamera(mh);mD(2);
    if(t<1)requestAnimationFrame(a);else{sc.remove(mh);mh.geometry.dispose();mm.dispose();}};
  requestAnimationFrame(a);
  flash('rgba(255,140,0,.33)',82);
}


// ══════════════════════════════════════════════════════════════════
//  FUSION
// ══════════════════════════════════════════════════════════════════
function getPair(){const sel=window.selectedObjects?[...window.selectedObjects]:[];const ao=gAO();return[...new Set([...sel,...(ao?[ao]:[])])].filter(o=>o&&window.sceneObjects?.includes(o)).slice(0,2);}
function handleFusionDNA(){const p=getPair();if(p.length<2){toast('Selecione 2 objetos (Ctrl+clique ou duplo-toque mobile).');return;}closeHelper();const[a,b]=p;const sc=gSc();if(!sc)return;const pA=gWP(a),pB=gWP(b),mid=pA.clone().lerp(pB,.5);sfxBurst(pA,0x4cefac,50,4);sfxBurst(pB,0x5f7fff,50,4);const mA=getMesh(a),mB=getMesh(b);const cA=mA?.material?.color?.getHex()||0x888888,cB=mB?.material?.color?.getHex()||0x444444;const sA=new THREE.Vector3();a.getWorldScale(sA);const sB=new THREE.Vector3();b.getWorldScale(sB);const gA=mA?.geometry?.clone?.()?.toNonIndexed()||new THREE.BoxGeometry(1,1,1);const gB=mB?.geometry?.clone?.()?.toNonIndexed()||new THREE.SphereGeometry(.7,12,8);const pAr=gA.attributes.position.array,pBr=gB.attributes.position.array;const n=Math.min(pAr.length,pBr.length);const bl=new Float32Array(n);const td=.5+(Math.random()-.5)*.3;for(let i=0;i<n;i++)bl[i]=pAr[i]*td+(i<pBr.length?pBr[i]:0)*(1-td);const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.BufferAttribute(bl.slice(0,n-n%3),3));fg.computeVertexNormals();const ac=new THREE.Color(cA).lerp(new THREE.Color(cB),.5);const fm=new THREE.MeshStandardMaterial({color:ac,roughness:.4,metalness:.3,emissive:ac,emissiveIntensity:.15});const f=new THREE.Mesh(fg,fm);f.position.copy(mid);f.scale.setScalar((sA.length()+sB.length())/2/Math.sqrt(3));f.name=`DNA_${a.name}_${b.name}`;f.userData.shapeType='fusion_dna';sc.add(f);window.sceneObjects?.push(f);a.visible=false;b.visible=false;sfxBurst(mid,parseInt(ac.getHexString(),16),80,5);toast('Fusão DNA completa!',2600);mD(4);}
function handleFusionRand(){const p=getPair();if(p.length<2){toast('Selecione 2 objetos.');return;}closeHelper();const[a,b]=p;const sc=gSc();if(!sc)return;const mid=gWP(a).lerp(gWP(b),.5);sfxBurst(mid,0xff44ff,80,5);const sA=new THREE.Vector3();a.getWorldScale(sA);const sB=new THREE.Vector3();b.getWorldScale(sB);const geos=[()=>new THREE.BoxGeometry(1,1,1),()=>new THREE.SphereGeometry(.7,12,8),()=>new THREE.ConeGeometry(.7,1.4,8),()=>new THREE.CylinderGeometry(.5,.7,1.4,8),()=>new THREE.TorusGeometry(.7,.2,8,20),()=>new THREE.IcosahedronGeometry(.8,1),()=>new THREE.OctahedronGeometry(.8,0)];const geo=geos[~~(Math.random()*geos.length)]();const h=Math.random();const c=new THREE.Color().setHSL(h,.8,.45);const m=new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.5+Math.random()*.8,roughness:Math.random()*.6,metalness:Math.random()*.8,transparent:Math.random()>.6,opacity:.6+Math.random()*.4});const f=new THREE.Mesh(geo,m);f.position.copy(mid);f.name=`Rand_${a.name}_${b.name}`;f.userData.shapeType='fusion_rand';f.scale.setScalar((sA.length()+sB.length())/2/Math.sqrt(3)*(.6+Math.random()*.8));const sc2=gSc();sc2.add(f);window.sceneObjects?.push(f);a.visible=false;b.visible=false;toast('Fusão aleatória!',2000);mD(4);}
let _aifRes=null,_aifPair=[];
function handleFusionAI(){const p=getPair();if(p.length<2){toast('Selecione 2 objetos.');return;}_aifPair=p;closeHelper();const[a,b]=p;const desc=o=>{const m=getMesh(o);const c=m?.material?.color;const sc=new THREE.Vector3();o.getWorldScale(sc);return`${getLabel(o)} (cor:#${c?c.getHexString():'888888'},escala:${sc.length().toFixed(2)},mat:${getMaterialType(o)})`;};const ai=$('nh-aif');if(!ai)return;ai.classList.remove('hidden');_aifRes=null;$('nh-ai-ap')?.classList.add('hidden');const msgs=$('nh-ai-ms');if(!msgs)return;msgs.innerHTML='';addMsg('sys',`• ${desc(a)}\n• ${desc(b)}`);addMsg('ai','Vou criar a fusão. Descreva como quer, ou posso sugerir.');}
function addMsg(role,text){const msgs=$('nh-ai-ms');if(!msgs)return;const d=document.createElement('div');d.className=`aif-m ${role}`;d.textContent=text;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;}
async function sendAIFusion(msg){const[a,b]=_aifPair;if(!a||!b)return;addMsg('user',msg);const sb=$('nh-ai-sd');if(sb){sb.disabled=true;sb.textContent='…';}const mA=getMesh(a),mB=getMesh(b);const cA=mA?.material?.color?.getHexString?.()||'888888',cB=mB?.material?.color?.getHexString?.()||'444444';const sys=`Você é motor de fusão 3D THREE.js. Objetos: A:${getLabel(a)},cor:#${cA},mat:${getMaterialType(a)},rough:${mA?.material?.roughness?.toFixed(2)},metal:${mA?.material?.metalness?.toFixed(2)} B:${getLabel(b)},cor:#${cB},mat:${getMaterialType(b)},rough:${mB?.material?.roughness?.toFixed(2)},metal:${mB?.material?.metalness?.toFixed(2)}. Responda em português com descrição criativa e ao final JSON:\n\`\`\`fusion\n{"geometry":"box|sphere|cone|cylinder|torus|icosahedron|octahedron","color":"#RRGGBB","emissive":"#RRGGBB","emissiveIntensity":0.5,"roughness":0.4,"metalness":0.5,"transparent":false,"opacity":1.0,"scale":1.0,"name":"Nome"}\n\`\`\``;const t=await AI(sys,msg,600);if(t){addMsg('ai',t.replace(/```fusion[\s\S]*?```/g,'').trim());const m=t.match(/```fusion\s*([\s\S]*?)```/);if(m){try{_aifRes=JSON.parse(m[1]);$('nh-ai-ap')?.classList.remove('hidden');}catch{}}}else addMsg('ai','Erro ao conectar com a IA.');if(sb){sb.disabled=false;sb.textContent='Enviar';}}
function applyAIFusion(){if(!_aifRes)return;const[a,b]=_aifPair;if(!a||!b)return;const sc=gSc();if(!sc)return;const mid=gWP(a).lerp(gWP(b),.5);const gF={box:()=>new THREE.BoxGeometry(1,1,1),sphere:()=>new THREE.SphereGeometry(.7,18,12),cone:()=>new THREE.ConeGeometry(.7,1.4,10),cylinder:()=>new THREE.CylinderGeometry(.5,.7,1.4,10),torus:()=>new THREE.TorusGeometry(.7,.2,9,36),icosahedron:()=>new THREE.IcosahedronGeometry(.8,1),octahedron:()=>new THREE.OctahedronGeometry(.8,0)};const geoF=gF[_aifRes.geometry]||gF.sphere;const col=new THREE.Color(_aifRes.color||'#888888');const emm=new THREE.Color(_aifRes.emissive||'#111122');const m=new THREE.MeshStandardMaterial({color:col,emissive:emm,emissiveIntensity:_aifRes.emissiveIntensity??.5,roughness:_aifRes.roughness??.4,metalness:_aifRes.metalness??.5,transparent:_aifRes.transparent??false,opacity:_aifRes.opacity??1});const f=new THREE.Mesh(geoF(),m);f.position.copy(mid);f.scale.setScalar(_aifRes.scale??1);f.name=_aifRes.name||'AI_Fusion';f.userData.shapeType='fusion_ai';sc.add(f);window.sceneObjects?.push(f);a.visible=false;b.visible=false;sfxExplosion(mid,parseInt((_aifRes.emissive||'#8844ff').replace('#',''),16));$('nh-aif')?.classList.add('hidden');toast(`"${f.name}" criada!`,3200);mD(4);}

// ══════════════════════════════════════════════════════════════════
//  MOBILE MULTI-SELECT (duplo-toque)
// ══════════════════════════════════════════════════════════════════
(function(){
  if(!(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)))return;
  let lastTap=0,lastObj=null;
  document.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    const now=Date.now(),obj=window.activeObject;if(!obj)return;
    if(now-lastTap<360&&obj!==lastObj&&lastObj){
      if(!window.selectedObjects)window.selectedObjects=new Set();
      window.selectedObjects.add(lastObj);window.selectedObjects.add(obj);
      toast(`${window.selectedObjects.size} objetos selecionados`,1400);}
    lastTap=now;lastObj=obj;},{passive:true});
})();

// ══════════════════════════════════════════════════════════════════
//  API KEY MODAL
// ══════════════════════════════════════════════════════════════════
function openKeyModal(){
  const m=$('nh-km');if(!m)return;
  const i=$('km-in');if(i)i.value=_KEY||'';
  const s=$('km-st');if(s){if(_KEY){s.className='km-st ok';s.textContent='✔ Chave salva — IA ativa';}else{s.className='km-st';s.textContent='Nenhuma chave configurada.';}}
  const b=$('nh-kb-btn');if(b)b.classList.toggle('on',!!_KEY);
  m.classList.remove('hidden');}

async function testKey(key){
  const s=$('km-st');if(!key){if(s){s.className='km-st err';s.textContent='Cole a chave antes de salvar.';}return;}
  if(s){s.className='km-st';s.textContent='Testando conexão com Claude...';}
  try{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-calls':'true'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:10,messages:[{role:'user',content:'ping'}]})});const d=await r.json();
    if(d.error){if(s){s.className='km-st err';s.textContent='Erro: '+d.error.message;}return;}
    _KEY=key;localStorage.setItem('nh_key',key);
    if(s){s.className='km-st ok';s.textContent='✔ Chave válida! IA ativada com sucesso.';}
    const b=$('nh-kb-btn');if(b)b.classList.add('on');
    setTimeout(()=>$('nh-km')?.classList.add('hidden'),1200);toast('IA ativada!',2200);
  }catch(e){if(s){s.className='km-st err';s.textContent='Erro de rede: '+e.message;}}}

// ══════════════════════════════════════════════════════════════════
//  DOM BUILD
// ══════════════════════════════════════════════════════════════════
function buildDOM(){
  if($('nh-ov'))return;
  // Main overlay
  const ov=document.createElement('div');ov.className='nh-ov hidden';ov.id='nh-ov';
  ov.innerHTML=`<div id="nh-panel">
  <div class="nh-hd"><div class="nh-logo">${ico('nexus',17)}</div><h2>Nexus Helper</h2>
    <span style="font-size:8.5px;color:rgba(255,255,255,.18);font-family:monospace">v4.0</span>
    <button class="nh-kb" id="nh-kb-btn" title="API Key da IA">${ico('key',13)}</button>
    <button class="nh-xb" id="nh-cls">${ico('close',12)}</button></div>
  <button class="nh-edit" id="nh-edit-btn">
    <div class="nh-ei">${ico('edit',13)}</div>
    <div style="flex:1"><div>Edit Nexal</div><div style="font-size:9.5px;color:rgba(165,180,252,.4);font-weight:400;margin-top:1px">Editar malha do objeto selecionado</div></div>
    ${ico('chev',12)}</button>
  <div class="nh-cat cat-evo"><div class="nh-ct">${ico('dna',10)} Evolution</div><div class="nh-bc">
    <button class="nh-bn" id="nh-evo-btn"><div class="ib">${ico('creature',13)}</div>
      <div class="bt">Evoluir 1 Milhão de Anos<small>IA + simulação: 2M+ planetas, predadores, mutações</small></div></button>
  </div></div>
  <div class="nh-cat cat-tx"><div class="nh-ct">${ico('mineral',10)} Transform</div><div class="nh-bc">
    <button class="nh-bn" id="nh-tx-btn"><div class="ib">${ico('gem',13)}</div>
      <div class="bt">Transformar Material<small>Ouro, minérios, nanotecnologia…</small></div></button>
    <button class="nh-bn" id="nh-tx-ai-btn"><div class="ib">${ico('brain',13)}</div>
      <div class="bt">IA Sugere Material<small>IA analisa o objeto e aplica</small></div></button>
  </div></div>
  <div class="nh-cat cat-mech"><div class="nh-ct">${ico('robot',10)} Mech</div><div class="nh-bc">
    <button class="nh-bn" id="nh-mech-btn"><div class="ib">${ico('gear',13)}</div>
      <div class="bt">Transformar em Mech<small>Animação estilo Transformers</small></div></button>
    <button class="nh-bn" id="nh-mech-ai-btn"><div class="ib">${ico('brain',13)}</div>
      <div class="bt">IA Design do Mech<small>IA descreve e cria o mech</small></div></button>
  </div></div>
  <div class="nh-cat cat-fu"><div class="nh-ct">${ico('merge',10)} Fusion</div><div class="nh-bc">
    <button class="nh-bn" id="nh-fu-dna"><div class="ib">${ico('dna',13)}</div>
      <div class="bt">Fusão DNA<small>Combina a geometria dos 2 objetos</small></div></button>
    <button class="nh-bn" id="nh-fu-ai"><div class="ib">${ico('brain',13)}</div>
      <div class="bt">Fusão por IA<small>IA cria — converse para refinar</small></div></button>
    <button class="nh-bn" id="nh-fu-rand"><div class="ib">${ico('dice',13)}</div>
      <div class="bt">Fusão Aleatória<small>Resultado imprevisível</small></div></button>
  </div></div></div>`;
  document.body.appendChild(ov);

  // Transform sub
  const txs=document.createElement('div');txs.className='nh-sub hidden';txs.id='nh-txs';
  txs.innerHTML=`<div class="nh-sb"><div class="nh-sh">${ico('gem',17)}<h3 style="color:#ffd95c">Transformar</h3><button class="nh-xb" id="nh-txs-x">${ico('close',11)}</button></div>
  <div class="nh-sl" id="nh-tx-list">
  ${[['gold','gem','Ouro','Metal precioso dourado'],['silver','mineral','Prata','Metal reluzente frio'],['copper','mineral','Cobre','Cobre oxidado alaranjado'],['emerald','gem','Esmeralda','Cristal verde translúcido'],['obsidian','mineral','Obsidiana','Pedra vulcânica negra'],['ruby','gem','Rubi','Gema vermelha cristalina'],['diamond','gem','Diamante','Cristal puro faiscante'],['nano','brain','Nanotecnologia','Malha de nanobots luminosa'],['plasma','zap','Plasma','Energia plasma pulsante']]
  .map(([k,ic,n,d])=>`<button class="nh-sbn" data-mat="${k}">${ico(ic,16)}<div><strong>${n}</strong><br><small style="color:rgba(255,255,255,.3)">${d}</small></div></button>`).join('')}
  </div></div>`;
  document.body.appendChild(txs);

  // Evolution overlay
  const evo=document.createElement('div');evo.id='nh-evo';evo.className='hidden';
  evo.innerHTML=`<div class="evo-bar">${ico('planet',15)}<h3 id="evo-title">Simulação</h3>
    <span id="evo-ailbl" class="ai-lbl" style="display:none;margin-left:auto;margin-right:7px">${ico('brain',11)} IA…</span>
    <button class="nh-xb" id="evo-cls" style="margin-left:auto">${ico('close',11)}</button></div>
  <canvas id="nh-evo-cv" width="542" height="305"></canvas>
  <div class="evo-st"><span id="evo-gen">Gen:0</span><span id="evo-pop">Vivos:0</span><span id="evo-yr">Ano:0</span></div>
  <div class="evo-ph" id="evo-ph">Inicializando…</div>
  <div class="evo-ac">
    <button class="evo-btn" id="evo-skip">${ico('skip',12)} Pular</button>
    <button class="evo-btn red" id="evo-abort">${ico('close',11)} Cancelar</button>
  </div>`;
  document.body.appendChild(evo);

  // Progress
  const prg=document.createElement('div');prg.id='nh-prg';prg.className='hidden';
  prg.innerHTML=`<div class="prg-bx"><div class="prg-tt" id="prg-tt">Processando…</div><div class="prg-tr"><div class="prg-fl" id="prg-fl" style="width:0%"></div></div><div class="prg-lb" id="prg-lb">0%</div></div>`;
  document.body.appendChild(prg);

  // Toast
  if(!$('nh-toast')){const t=document.createElement('div');t.id='nh-toast';document.body.appendChild(t);}

  // Skills toggle button
  const skt=document.createElement('button');skt.id='nh-skt';skt.className='hidden';skt.innerHTML=`${ico('skills',13)} Skills`;document.body.appendChild(skt);

  // Skills panel & config
  const skp=document.createElement('div');skp.id='nh-skp';skp.className='hidden';document.body.appendChild(skp);
  const skcf=document.createElement('div');skcf.id='nh-skcf';skcf.className='hidden';document.body.appendChild(skcf);

  // AI Fusion
  const aif=document.createElement('div');aif.id='nh-aif';aif.className='hidden';
  aif.innerHTML=`<div class="aif-bx"><div class="aif-hd">${ico('brain',17)}<h3>Fusão por IA</h3><button class="nh-xb" id="nh-aif-x">${ico('close',11)}</button></div>
  <div class="aif-ms" id="nh-ai-ms"></div>
  <button class="aif-ap hidden" id="nh-ai-ap">${ico('star',13)} Aplicar fusão na cena</button>
  <div class="aif-ir"><textarea class="aif-in" id="nh-ai-in" rows="2" placeholder="Descreva como quer a fusão…"></textarea><button class="aif-sd" id="nh-ai-sd">Enviar</button></div></div>`;
  document.body.appendChild(aif);

  // API Key modal
  const km=document.createElement('div');km.id='nh-km';km.className='hidden';
  km.innerHTML=`<div class="km-bx"><h3>${ico('key',15)} API Key — Claude (Anthropic)</h3>
  <p>Cole sua chave abaixo. Salva no navegador (localStorage). Usada para evolução, transform, mech e fusão com IA.<br><strong style="color:#a5b4fc">Obtenha em: console.anthropic.com → API Keys</strong></p>
  <input class="km-in" id="km-in" type="password" placeholder="sk-ant-api03-…" autocomplete="off" spellcheck="false"/>
  <div class="km-st" id="km-st"></div>
  <div class="km-ac">
    <button class="km-sv" id="km-sv">${ico('skills',12)} Salvar &amp; Testar</button>
    <button class="km-cl" id="km-cl">${ico('close',11)} Limpar</button>
    <button class="nh-xb" id="km-x" style="margin-left:auto">${ico('close',11)}</button>
  </div></div>`;
  document.body.appendChild(km);
}

function openHelper(){$('nh-ov')?.classList.remove('hidden');}
function closeHelper(){$('nh-ov')?.classList.add('hidden');$('nh-txs')?.classList.add('hidden');}

// ══════════════════════════════════════════════════════════════════
//  WIRE EVENTS
// ══════════════════════════════════════════════════════════════════
function wireEvents(){
  $('nh-cls')?.addEventListener('click',closeHelper);
  $('nh-ov')?.addEventListener('click',e=>{if(e.target.id==='nh-ov')closeHelper();});
  $('nh-edit-btn')?.addEventListener('click',()=>{const o=gAO();if(!o){toast('Selecione um objeto.');return;}closeHelper();setTimeout(()=>document.getElementById('modeling-toggle-btn')?.click(),80);});
  // Evolution
  $('nh-evo-btn')?.addEventListener('click',()=>{const o=gAO();if(!o){toast('Selecione um objeto.');return;}closeHelper();runEvolution(o);});
  $('evo-cls')?.addEventListener('click',()=>{evoAbort=true;});
  $('evo-abort')?.addEventListener('click',()=>{evoAbort=true;});
  $('evo-skip')?.addEventListener('click',()=>{evoSkip=true;});
  // Transform
  $('nh-tx-btn')?.addEventListener('click',e=>{e.stopPropagation();$('nh-txs')?.classList.remove('hidden');});
  $('nh-txs-x')?.addEventListener('click',()=>$('nh-txs')?.classList.add('hidden'));
  $('nh-txs')?.addEventListener('click',e=>{if(e.target.id==='nh-txs')$('nh-txs')?.classList.add('hidden');});
  document.querySelectorAll('#nh-tx-list .nh-sbn').forEach(b=>b.addEventListener('click',()=>applyMaterial(b.dataset.mat)));
  $('nh-tx-ai-btn')?.addEventListener('click',handleTxAI);
  // Mech
  $('nh-mech-btn')?.addEventListener('click',()=>{handleMech();closeHelper();});
  $('nh-mech-ai-btn')?.addEventListener('click',handleMechAI);
  // Fusion
  $('nh-fu-dna')?.addEventListener('click',handleFusionDNA);
  $('nh-fu-ai')?.addEventListener('click',handleFusionAI);
  $('nh-fu-rand')?.addEventListener('click',handleFusionRand);
  $('nh-aif-x')?.addEventListener('click',()=>$('nh-aif')?.classList.add('hidden'));
  $('nh-aif')?.addEventListener('click',e=>{if(e.target.id==='nh-aif')$('nh-aif')?.classList.add('hidden');});
  $('nh-ai-sd')?.addEventListener('click',()=>{const v=$('nh-ai-in')?.value.trim();if(!v)return;$('nh-ai-in').value='';sendAIFusion(v);});
  $('nh-ai-in')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('nh-ai-sd')?.click();}});
  $('nh-ai-ap')?.addEventListener('click',applyAIFusion);
  // Skills toggle
  $('nh-skt')?.addEventListener('click',()=>{const o=$('nh-skt')._ev;if(!o)return;const sp=$('nh-skp');if(!sp)return;sp.classList.contains('hidden')?showSkills(o):(sp.classList.add('hidden'),$('nh-skcf')?.classList.add('hidden'));});
  // API Key modal
  $('nh-kb-btn')?.addEventListener('click',e=>{e.stopPropagation();openKeyModal();});
  $('km-x')?.addEventListener('click',()=>$('nh-km')?.classList.add('hidden'));
  $('nh-km')?.addEventListener('click',e=>{if(e.target.id==='nh-km')$('nh-km')?.classList.add('hidden');});
  $('km-sv')?.addEventListener('click',()=>testKey($('km-in')?.value.trim()));
  $('km-in')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('km-sv')?.click();});
  $('km-cl')?.addEventListener('click',()=>{_KEY='';localStorage.removeItem('nh_key');const i=$('km-in');if(i)i.value='';const s=$('km-st');if(s){s.className='km-st';s.textContent='Chave removida.';}$('nh-kb-btn')?.classList.remove('on');toast('Chave removida.',1800);});
  // model-btn → open helper
  const mb=document.getElementById('model-btn');if(mb){const nb=mb.cloneNode(true);mb.parentNode.replaceChild(nb,mb);nb.addEventListener('click',e=>{e.stopPropagation();openHelper();});}
}

// ══════════════════════════════════════════════════════════════════
//  INIT — with polling fallback for activeObject
// ══════════════════════════════════════════════════════════════════
function init(){
  buildDOM();wireEvents();
  document.querySelectorAll('#nh-tx-list .nh-sbn').forEach(b=>b.addEventListener('click',()=>applyMaterial(b.dataset.mat)));

  // Key status indicator
  if(_KEY){const b=$('nh-kb-btn');if(b)b.classList.add('on');}
  else setTimeout(()=>toast('Configure a API Key — ícone chave no header do Nexus Helper.',5500),2000);

  // Hook onActiveObjectChanged
  const prev=window.onActiveObjectChanged;
  window.onActiveObjectChanged=obj=>{if(typeof prev==='function')prev(obj);updateSkillBtn(obj);};

  // POLLING FALLBACK — garante que o botão skills aparece mesmo se callback não for chamado
  let lastObj=null;
  setInterval(()=>{
    const cur=window.activeObject||null;
    if(cur!==lastObj){lastObj=cur;updateSkillBtn(cur);}
  },300);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.NexusHelper={open:openHelper,close:closeHelper};
// add creature label for missing ICO reference
ICO.creature=ICO.dna;
