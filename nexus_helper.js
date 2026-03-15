// ==================== NEXUS HELPER v4 ====================
import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';

// ══════════════════════════════════════════════════════════════════
//  API KEY (salvo no localStorage)
// ══════════════════════════════════════════════════════════════════
let CLAUDE_API_KEY = '';
try { CLAUDE_API_KEY = localStorage.getItem('nh_claude_key') || ''; } catch {}

// CORS proxy para chamadas do browser (necessário fora do claude.ai)
const PROXY = 'https://corsproxy.io/?url=';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

async function callClaude(system, user, maxTok = 600) {
  if (!CLAUDE_API_KEY) { toast('Configure sua API Key — botão cérebro no header.', 4000); return ''; }
  const body = JSON.stringify({
    model: 'claude-sonnet-4-20250514', max_tokens: maxTok, system,
    messages: [{ role: 'user', content: user }]
  });
  const hdrs = {
    'Content-Type': 'application/json',
    'x-api-key': CLAUDE_API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-calls': 'true',
  };
  // Try direct first, fall back to CORS proxy
  const tryFetch = async (url, headers) => {
    const r = await fetch(url, { method: 'POST', headers, body });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return d.content?.[0]?.text || '';
  };
  try {
    return await tryFetch(ANTHROPIC_URL, hdrs);
  } catch (e1) {
    try {
      // proxy strips x-api-key from forwarding — send it inside a custom header name
      const proxyHdrs = { 'Content-Type': 'application/json', 'x-requested-with': 'XMLHttpRequest' };
      const proxyBody = JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: maxTok, system,
        messages: [{ role: 'user', content: user }],
        _apiKey: CLAUDE_API_KEY  // won't work with proxy
      });
      // Actually: rebuild request through proxy passing key as header
      const r2 = await fetch(PROXY + encodeURIComponent(ANTHROPIC_URL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
        body
      });
      const d2 = await r2.json();
      if (d2.error) throw new Error(d2.error.message);
      return d2.content?.[0]?.text || '';
    } catch (e2) {
      toast('Erro de conexão com a IA: ' + (e1.message || e2.message), 4000);
      console.error('[NexusHelper IA] Direct:', e1, '| Proxy:', e2);
      return '';
    }
  }
}

const SVG = {
  nexus:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/></svg>`,
  dna:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3c4 3 4 6 0 9s4 9 0 9M19 3c-4 3-4 6 0 9s-4 9 0 9M7 5h10M7 19h10M6 9h12M6 15h12"/></svg>`,
  gem:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 22,8.5 18,21 6,21 2,8.5"/><polyline points="12,2 6,21"/><polyline points="12,2 18,21"/><line x1="2" y1="8.5" x2="22" y2="8.5"/></svg>`,
  robot:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="11" width="10" height="8" rx="1"/><rect x="9" y="7" width="6" height="4" rx="1"/><circle cx="10" cy="13" r="1" fill="currentColor"/><circle cx="14" cy="13" r="1" fill="currentColor"/><path d="M9 19v2M15 19v2M7 13H5M19 13h-2M12 7V5M10 5h4"/></svg>`,
  merge:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="12" r="4"/><circle cx="18" cy="12" r="4"/><path d="M10 12h4" stroke-width="2.5"/></svg>`,
  brain:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3a3 3 0 0 0-5 2.46A3 3 0 0 0 2 9a3 3 0 0 0 2.88 3A3 3 0 0 0 9 18v2h6v-2a3 3 0 0 0 4.12-5.96A3 3 0 0 0 22 9a3 3 0 0 0-2-2.54A3 3 0 0 0 15 3z"/><path d="M9 18h6M12 3v15"/></svg>`,
  lightning:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/></svg>`,
  shield:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L4 6v6c0 5.2 3.4 10.1 8 11.5C16.6 22.1 20 17.2 20 12V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
  dash:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M15 8l4 4-4 4"/></svg>`,
  acid:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="14" rx="7" ry="7"/><path d="M10 2l2 5 2-5"/><circle cx="9.5" cy="12.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.5" cy="15" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  wave:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="9" stroke-opacity=".45"/></svg>`,
  void:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="5" ry="2.5" stroke-opacity=".5"/><path d="M7 7c1-1 3-1 5 0s4 1 5 0M7 17c1 1 3 1 5 0s4-1 5 0"/></svg>`,
  star:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>`,
  edit:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  close:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  chevron:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9,18 15,12 9,6"/></svg>`,
  planet:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"/><ellipse cx="12" cy="12" rx="11.5" ry="4.5" transform="rotate(-20 12 12)" stroke-opacity=".45"/></svg>`,
  gear:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  dice:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.4" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.4" fill="currentColor" stroke="none"/></svg>`,
  skills:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/><line x1="8" y1="12" x2="8" y2="17"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="16" y1="13" x2="16" y2="17"/></svg>`,
  mineral:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 18.5,6 18.5,14 12,18 5.5,14 5.5,6"/><line x1="12" y1="2" x2="12" y2="18"/><line x1="5.5" y1="6" x2="18.5" y2="14"/><line x1="18.5" y1="6" x2="5.5" y2="14"/></svg>`,
  creature:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="10" rx="5" ry="7"/><path d="M7 16c-2 2-3 4-2 5s3 0 4-1M17 16c2 2 3 4 2 5s-3 0-4-1"/><circle cx="10" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="14" cy="8" r="1" fill="currentColor" stroke="none"/></svg>`,
  skip:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5,4 15,12 5,20"/><line x1="19" y1="4" x2="19" y2="20"/></svg>`,
  transform:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l4 4-4 4M12 7h8M4 17l4 4 4-4M8 21V13"/></svg>`,
};
function ico(name,sz=14){
  const s=SVG[name]||SVG.nexus;
  return s.replace('<svg',`<svg width="${sz}" height="${sz}" style="flex-shrink:0;display:inline-block;vertical-align:middle"`);
}

// ══════════════════════════════════════════════════════════════════
//  CSS
// ══════════════════════════════════════════════════════════════════
(function injectCSS(){
  if(document.getElementById('_nh3_css'))return;
  const s=document.createElement('style');s.id='_nh3_css';
  s.textContent=`
@keyframes nhFade{from{opacity:0}to{opacity:1}}
@keyframes nhSlide{from{opacity:0;transform:translateY(-16px) scale(.97)}to{opacity:1;transform:none}}
@keyframes nhSlideL{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:none}}
@keyframes nhGlow{0%,100%{box-shadow:0 0 10px rgba(95,127,255,.3)}50%{box-shadow:0 0 26px rgba(95,127,255,.8)}}
@keyframes nhPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes nhSkillBurst{0%{transform:scale(1)}25%{transform:scale(1.14)}60%{transform:scale(.96)}100%{transform:scale(1)}}
@keyframes nhBreathe{0%,100%{opacity:.5}50%{opacity:1}}

.nh-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);z-index:9000;display:flex;align-items:center;justify-content:center;animation:nhFade .2s}
.nh-overlay.hidden{display:none!important}

#nh-main-panel{background:rgba(6,8,18,.98);border:1px solid rgba(95,127,255,.3);border-radius:16px;
  box-shadow:0 24px 80px rgba(0,0,0,.9),0 0 60px rgba(95,127,255,.06);
  width:440px;max-width:95vw;max-height:90vh;overflow-y:auto;padding:0 0 20px;
  animation:nhSlide .25s cubic-bezier(.34,1.56,.64,1);
  scrollbar-width:thin;scrollbar-color:rgba(95,127,255,.3) transparent}
.nh-hdr{display:flex;align-items:center;gap:10px;padding:16px 18px 12px;
  border-bottom:1px solid rgba(255,255,255,.06);position:sticky;top:0;
  background:rgba(6,8,18,.98);border-radius:16px 16px 0 0;z-index:2}
.nh-hdr-logo{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#5f7fff,#a78bfa);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 14px rgba(95,127,255,.5)}
.nh-hdr h2{margin:0;font-size:15px;font-weight:600;background:linear-gradient(90deg,#a5b4fc,#c4b5fd);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;flex:1}
.nh-x{width:26px;height:26px;border-radius:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  color:rgba(255,255,255,.5);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .14s}
.nh-x:hover{background:rgba(255,60,60,.18);color:#ff6060;border-color:rgba(255,60,60,.3)}

.nh-edit-nexal{margin:14px 14px 2px;width:calc(100% - 28px);padding:11px 14px;
  background:linear-gradient(135deg,rgba(95,127,255,.15),rgba(167,139,250,.08));
  border:1px solid rgba(95,127,255,.3);border-radius:10px;color:#a5b4fc;font-size:13px;font-weight:600;
  cursor:pointer;display:flex;align-items:center;gap:9px;transition:all .17s}
.nh-edit-nexal:hover{background:linear-gradient(135deg,rgba(95,127,255,.26),rgba(167,139,250,.18));transform:translateY(-1px);box-shadow:0 0 22px rgba(95,127,255,.18)}
.nh-edit-icon{width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#5f7fff,#a78bfa);display:flex;align-items:center;justify-content:center;flex-shrink:0}

.nh-cat{margin:16px 14px 0}
.nh-cat-title{font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:rgba(255,255,255,.25);margin-bottom:7px;display:flex;align-items:center;gap:6px}
.nh-cat-title::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.05)}
.nh-btn-col{display:flex;flex-direction:column;gap:5px}
.nh-btn{width:100%;padding:10px 13px;border-radius:9px;border:1px solid rgba(255,255,255,.07);
  background:rgba(255,255,255,.04);color:rgba(255,255,255,.82);font-size:12.5px;font-weight:500;
  cursor:pointer;display:flex;align-items:center;gap:9px;transition:all .15s;text-align:left}
.nh-btn:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14);transform:translateX(2px)}
.nh-btn:active{transform:scale(.98)}
.nh-btn .ib{width:27px;height:27px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nh-btn .bt{flex:1}.nh-btn .bt small{display:block;font-size:10px;color:rgba(255,255,255,.3);margin-top:1px}
.cat-evo .nh-btn:hover{border-color:rgba(76,239,172,.3);color:#4cefac}.cat-evo .ib{background:rgba(76,239,172,.1)}
.cat-tx .nh-btn:hover{border-color:rgba(255,190,50,.3);color:#ffd95c}.cat-tx .ib{background:rgba(255,190,50,.1)}
.cat-mech .nh-btn:hover{border-color:rgba(255,100,80,.3);color:#ff8060}.cat-mech .ib{background:rgba(255,100,80,.1)}
.cat-fusion .nh-btn:hover{border-color:rgba(200,80,255,.3);color:#cc80ff}.cat-fusion .ib{background:rgba(200,80,255,.1)}

.nh-sub{position:fixed;inset:0;z-index:9200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(4px)}
.nh-sub.hidden{display:none!important}
.nh-sub-box{background:rgba(6,8,18,.97);border-radius:14px;padding:0 0 16px;width:360px;max-width:92vw;max-height:88vh;overflow-y:auto;animation:nhSlide .2s ease;box-shadow:0 20px 60px rgba(0,0,0,.8);scrollbar-width:thin;scrollbar-color:rgba(95,127,255,.25) transparent}
.nh-sub-hdr{padding:13px 15px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:8px}
.nh-sub-hdr h3{margin:0;font-size:13.5px;font-weight:600;flex:1}
.nh-sub-list{padding:10px 12px 0;display:flex;flex-direction:column;gap:5px}
.nh-sub-btn{padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.04);
  color:rgba(255,255,255,.8);font-size:12.5px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .14s;text-align:left;width:100%}
.nh-sub-btn:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.15)}

#nh-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(14px);
  background:rgba(6,8,18,.97);border:1px solid rgba(95,127,255,.3);border-radius:9px;
  padding:9px 16px;color:#a5b4fc;font-size:12.5px;font-weight:500;z-index:9999;
  opacity:0;pointer-events:none;transition:all .22s;box-shadow:0 8px 22px rgba(0,0,0,.5);white-space:nowrap}
#nh-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

#nh-prog{position:fixed;inset:0;z-index:9300;display:flex;align-items:center;justify-content:center;pointer-events:none}
#nh-prog.hidden{display:none}
.nh-prog-box{background:rgba(6,8,18,.97);border:1px solid rgba(95,127,255,.28);border-radius:13px;padding:22px 28px;text-align:center;min-width:230px;box-shadow:0 20px 56px rgba(0,0,0,.8)}
.nh-prog-title{font-size:13.5px;color:#a5b4fc;font-weight:600;margin-bottom:10px}
.nh-prog-track{width:100%;height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden}
.nh-prog-fill{height:100%;background:linear-gradient(90deg,#5f7fff,#a78bfa);border-radius:3px;transition:width .08s;box-shadow:0 0 8px rgba(95,127,255,.5)}
.nh-prog-lbl{font-size:10.5px;color:rgba(255,255,255,.36);margin-top:7px;font-family:monospace}

/* Evolution overlay - compact, não fullscreen */
#nh-evo-overlay{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9400;
  background:rgba(4,5,14,.98);border:1px solid rgba(95,127,255,.35);border-radius:16px;
  padding:14px;display:flex;flex-direction:column;align-items:center;gap:9px;
  width:min(580px,95vw);box-shadow:0 30px 100px rgba(0,0,0,.95),0 0 60px rgba(95,127,255,.1);
  animation:nhSlide .3s cubic-bezier(.34,1.56,.64,1)}
#nh-evo-overlay.hidden{display:none!important}
.nh-evo-bar{display:flex;align-items:center;gap:8px;width:100%;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.06)}
.nh-evo-bar h3{margin:0;flex:1;font-size:13px;font-weight:600;color:#a5b4fc}
#nh-evo-canvas{border:1px solid rgba(95,127,255,.2);border-radius:8px;width:100%;height:auto}
.nh-evo-stats{display:flex;gap:7px;font-size:10px;color:rgba(255,255,255,.5);font-family:monospace;width:100%;justify-content:center;flex-wrap:wrap}
.nh-evo-stats span{background:rgba(255,255,255,.05);padding:3px 9px;border-radius:5px}
.nh-evo-phase{font-size:11px;color:rgba(165,180,252,.7);font-family:monospace;text-align:center}
.nh-evo-actions{display:flex;gap:8px}
.nh-evo-btn{padding:8px 16px;border-radius:8px;border:1px solid rgba(95,127,255,.3);background:rgba(95,127,255,.08);
  color:#a5b4fc;font-size:11.5px;cursor:pointer;transition:all .14s;display:flex;align-items:center;gap:6px}
.nh-evo-btn:hover{background:rgba(95,127,255,.18);border-color:rgba(95,127,255,.55)}
.nh-evo-btn.red{border-color:rgba(255,70,70,.3);background:rgba(255,70,70,.07);color:#ff7070}
.nh-evo-btn.red:hover{background:rgba(255,70,70,.16)}
.nh-ai-lbl{font-size:10px;color:rgba(180,130,255,.8);font-family:monospace;animation:nhBreathe 1.4s infinite}

/* Skills toggle button */
#nh-sk-toggle{position:fixed;bottom:70px;left:14px;z-index:7999;
  background:rgba(6,8,18,.96);border:1px solid rgba(95,127,255,.45);border-radius:10px;
  padding:9px 14px;color:#a5b4fc;font-size:12px;cursor:pointer;font-weight:600;
  display:flex;align-items:center;gap:7px;
  animation:nhSlideL .22s ease, nhGlow 2.5s infinite;
  box-shadow:0 4px 24px rgba(0,0,0,.6);transition:all .16s}
#nh-sk-toggle:hover{background:rgba(95,127,255,.14);transform:translateX(2px)}
#nh-sk-toggle.hidden{display:none}

/* Skills panel */
#nh-skill-panel{position:fixed;left:0;top:50%;transform:translateY(-50%);
  background:rgba(6,8,18,.97);border:1px solid rgba(95,127,255,.25);border-radius:0 12px 12px 0;
  padding:10px 0 12px;width:272px;z-index:8000;box-shadow:5px 0 24px rgba(0,0,0,.6);animation:nhSlideL .2s ease}
#nh-skill-panel.hidden{display:none}
.nh-sp-hdr{padding:8px 14px 10px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:8px}
.nh-sp-icon{width:32px;height:32px;border-radius:7px;background:rgba(95,127,255,.12);border:1px solid rgba(95,127,255,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nh-sp-hdr h4{margin:0;font-size:12.5px;color:#a5b4fc;flex:1}
.nh-sk-row{display:flex;align-items:center;padding:6px 12px;gap:8px;cursor:pointer;transition:background .12s}
.nh-sk-row:hover{background:rgba(255,255,255,.05)}
.nh-sk-row.burst{animation:nhSkillBurst .4s ease}
.nh-sk-ico{width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .15s}
.nh-sk-row:hover .nh-sk-ico{transform:scale(1.12)}
.nh-sk-info{flex:1}
.nh-sk-name{font-size:11.5px;font-weight:600;color:rgba(255,255,255,.88)}
.nh-sk-desc{font-size:10px;color:rgba(255,255,255,.3)}
.nh-sk-rage{display:flex;gap:2px;margin-top:2px}
.nh-sk-rage span{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.12)}
.nh-sk-rage span.on{background:currentColor}
.nh-sk-cfg{width:20px;height:20px;border-radius:5px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  color:rgba(255,255,255,.4);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .13s;flex-shrink:0}
.nh-sk-cfg:hover{background:rgba(95,127,255,.2);color:#a5b4fc;border-color:rgba(95,127,255,.4)}
.nh-sk-special{background:rgba(255,200,50,.06);border-top:1px solid rgba(255,200,50,.1)}
.nh-sk-special .nh-sk-name{color:#ffd95c}
.nh-sk-divider{height:1px;background:rgba(255,255,255,.05);margin:6px 12px}

/* Skill config */
#nh-skill-cfg{position:fixed;left:276px;top:50%;transform:translateY(-50%);
  background:rgba(6,8,18,.97);border:1px solid rgba(95,127,255,.25);border-radius:12px;
  padding:14px;width:220px;z-index:8001;box-shadow:4px 0 24px rgba(0,0,0,.6);animation:nhSlide .18s ease}
#nh-skill-cfg.hidden{display:none}
.nh-cfg-hdr{display:flex;align-items:center;gap:7px;margin-bottom:12px}
.nh-cfg-hdr h5{margin:0;font-size:12px;color:#a5b4fc;flex:1}
.nh-cfg-lbl{font-size:10px;color:rgba(255,255,255,.35);margin-bottom:5px;text-transform:uppercase;letter-spacing:.08em}
.nh-cfg-sec{margin-bottom:10px}
.nh-cfg-rage{display:flex;gap:4px}
.nh-cfg-dot{width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,.1);cursor:pointer;transition:all .13s;border:1px solid rgba(255,255,255,.14)}
.nh-cfg-dot:hover{transform:scale(1.2)}
.nh-cfg-colors{display:flex;gap:5px;flex-wrap:wrap}
.nh-cfg-swatch{width:18px;height:18px;border-radius:4px;cursor:pointer;border:2px solid transparent;transition:all .12s}
.nh-cfg-swatch:hover,.nh-cfg-swatch.active{border-color:#fff;transform:scale(1.15)}
.nh-cfg-row{display:flex;gap:5px;align-items:center}
.nh-cfg-row input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:4px 7px;color:rgba(255,255,255,.8);font-size:11px;outline:none}
.nh-cfg-apply{width:100%;margin-top:10px;padding:7px;border-radius:7px;border:1px solid rgba(95,127,255,.3);background:rgba(95,127,255,.12);color:#a5b4fc;font-size:11.5px;cursor:pointer;transition:all .13s}
.nh-cfg-apply:hover{background:rgba(95,127,255,.22)}

/* AI Fusion */
#nh-fusion-ai{position:fixed;inset:0;z-index:9200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(5px)}
#nh-fusion-ai.hidden{display:none!important}
.nh-ai-box{background:rgba(6,8,18,.97);border:1px solid rgba(200,80,255,.3);border-radius:14px;width:400px;max-width:93vw;max-height:85vh;display:flex;flex-direction:column;animation:nhSlide .22s ease;box-shadow:0 20px 60px rgba(0,0,0,.85)}
.nh-ai-hdr{padding:13px 15px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:8px}
.nh-ai-hdr h3{margin:0;font-size:13.5px;color:#cc80ff;flex:1}
.nh-ai-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;min-height:200px;max-height:340px;scrollbar-width:thin;scrollbar-color:rgba(200,80,255,.25) transparent}
.nh-ai-msg{padding:8px 11px;border-radius:8px;font-size:12px;line-height:1.5;max-width:88%}
.nh-ai-msg.user{background:rgba(95,127,255,.15);border:1px solid rgba(95,127,255,.2);align-self:flex-end;color:rgba(255,255,255,.88)}
.nh-ai-msg.ai{background:rgba(200,80,255,.1);border:1px solid rgba(200,80,255,.2);align-self:flex-start;color:rgba(255,255,255,.82)}
.nh-ai-msg.sys{background:rgba(255,255,255,.04);align-self:center;color:rgba(255,255,255,.4);font-style:italic;font-size:11px}
.nh-ai-input-row{padding:10px 12px;border-top:1px solid rgba(255,255,255,.06);display:flex;gap:7px}
.nh-ai-inp{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:7px;padding:7px 10px;color:rgba(255,255,255,.88);font-size:12px;outline:none;resize:none}
.nh-ai-inp:focus{border-color:rgba(200,80,255,.4)}
.nh-ai-send{padding:0 13px;border-radius:7px;border:1px solid rgba(200,80,255,.3);background:rgba(200,80,255,.12);color:#cc80ff;font-size:12px;cursor:pointer;transition:all .13s;white-space:nowrap}
.nh-ai-send:hover{background:rgba(200,80,255,.22)}
.nh-ai-apply{margin:6px 12px 10px;padding:9px;border-radius:8px;border:1px solid rgba(200,80,255,.3);background:rgba(200,80,255,.1);color:#cc80ff;font-size:12.5px;cursor:pointer;width:calc(100% - 24px);transition:all .14s}
.nh-ai-apply:hover{background:rgba(200,80,255,.2)}
.nh-ai-apply.hidden{display:none}

/* Screen flash (SFM hit effect) */
#nh-flash{position:fixed;inset:0;z-index:9998;pointer-events:none;opacity:0;transition:opacity .06s}

/* API Key modal */
#nh-key-modal{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.7);backdrop-filter:blur(6px)}
#nh-key-modal.hidden{display:none!important}
.nh-key-box{background:rgba(6,8,18,.98);border:1px solid rgba(95,127,255,.4);border-radius:14px;padding:22px;width:380px;max-width:92vw;animation:nhSlide .22s ease;box-shadow:0 20px 60px rgba(0,0,0,.9)}
.nh-key-box h3{margin:0 0 6px;font-size:14px;color:#a5b4fc;display:flex;align-items:center;gap:8px}
.nh-key-box p{font-size:11px;color:rgba(255,255,255,.38);margin:0 0 14px;line-height:1.6}
.nh-key-inp{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(95,127,255,.3);border-radius:8px;padding:9px 12px;color:rgba(255,255,255,.88);font-size:12.5px;font-family:monospace;outline:none;box-sizing:border-box;margin-bottom:12px}
.nh-key-inp:focus{border-color:rgba(95,127,255,.65)}
.nh-key-status{font-size:11px;margin-bottom:12px;min-height:16px;font-family:monospace}
.nh-key-status.ok{color:#4cefac}.nh-key-status.err{color:#ff5252}
.nh-key-actions{display:flex;gap:8px}
.nh-key-save{flex:1;padding:9px;border-radius:8px;border:1px solid rgba(95,127,255,.4);background:rgba(95,127,255,.14);color:#a5b4fc;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .14s}
.nh-key-save:hover{background:rgba(95,127,255,.26)}
.nh-key-clear{padding:9px 14px;border-radius:8px;border:1px solid rgba(255,80,80,.3);background:rgba(255,80,80,.08);color:#ff7070;font-size:12px;cursor:pointer;transition:all .14s}
.nh-key-clear:hover{background:rgba(255,80,80,.18)}
.nh-key-btn{width:28px;height:28px;border-radius:7px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.5);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .14s;flex-shrink:0}
.nh-key-btn:hover{background:rgba(95,127,255,.18);color:#a5b4fc;border-color:rgba(95,127,255,.4)}
.nh-key-btn.active{background:rgba(76,239,172,.15);border-color:rgba(76,239,172,.4);color:#4cefac}`;
  document.head.appendChild(s);
})();

// ══════════════════════════════════════════════════════════════════
//  HELPERS & CLAUDE API
// ══════════════════════════════════════════════════════════════════
const $=id=>document.getElementById(id);
function toast(msg,ms=2800){let t=$('nh-toast');if(!t){t=document.createElement('div');t.id='nh-toast';document.body.appendChild(t);}t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),ms);}
function setProgress(title,pct,lbl){const el=$('nh-prog');if(!el)return;el.classList.remove('hidden');const ti=$('nh-prog-title'),fi=$('nh-prog-fill'),li=$('nh-prog-lbl');if(ti)ti.textContent=title;if(fi)fi.style.width=pct+'%';if(li)li.textContent=lbl||(pct+'%');}
function hideProgress(){$('nh-prog')?.classList.add('hidden');}
function markDirty(n=4){window.markDirty?.(n);}
function getAO(){return window.activeObject||null;}
function getScene(){return window._nexusScene;}
function getMesh(obj){if(!obj)return null;if(obj.isMesh)return obj;let r=null;obj.traverse(c=>{if(c.isMesh&&!r)r=c;});return r;}
function getShapeLabel(obj){if(!obj)return'Objeto';const st=obj.userData?.shapeType;const lbl={cube:'Cubo',sphere:'Esfera',cone:'Cone',cylinder:'Cilindro',torus:'Toro'};if(st&&lbl[st])return lbl[st];if(obj.userData?.isImportedModel)return'Modelo';const geo=getMesh(obj)?.geometry;if(!geo)return'Objeto';const n=geo.constructor.name;if(n.includes('Box'))return'Cubo';if(n.includes('Sphere'))return'Esfera';if(n.includes('Cone'))return'Cone';if(n.includes('Cylinder'))return'Cilindro';if(n.includes('Torus'))return'Toro';return'Objeto';}
function getWorldPos(obj){const v=new THREE.Vector3();obj.getWorldPosition(v);return v;}
function screenFlash(color='rgba(255,255,255,.5)',ms=120){let fl=$('nh-flash');if(!fl){fl=document.createElement('div');fl.id='nh-flash';fl.style.cssText='position:fixed;inset:0;z-index:9998;pointer-events:none;opacity:0;transition:opacity .06s';document.body.appendChild(fl);}fl.style.background=color;fl.style.opacity='1';clearTimeout(fl._t);fl._t=setTimeout(()=>{fl.style.opacity='0';},ms);}

        system:system,
        messages:[{role:"user",content:user}]
      })
    });
    if(!r.ok){
      let errMsg="HTTP "+r.status;
      try{const ed=await r.json();errMsg=ed?.error?.message||errMsg;}catch{}
      toast("Erro IA ("+r.status+"): "+errMsg,5000);
      console.error("[NexusHelper] API error",r.status,errMsg);
      return "";
    }
    const d=await r.json();
    if(d.error){toast("Erro IA: "+d.error.message,5000);return "";}
    return d.content?.[0]?.text||"";
  }catch(e){
    const msg=e?.message||String(e);
    toast("Erro: "+msg,5000);
    console.error("[NexusHelper] fetch error:",e);
    return "";
  }
}

// Material type detection
const MAT_DEFS={
  gold:{color:0xffd700,emissive:0x553300,emissiveI:.35,rough:.10,metal:1.0,spk:0xffd700},
  silver:{color:0xdde0ee,emissive:0x111122,emissiveI:.08,rough:.06,metal:1.0,spk:0xe0e8ff},
  copper:{color:0xb87333,emissive:0x2a1200,emissiveI:.18,rough:.28,metal:.85,spk:0xff8c42},
  emerald:{color:0x50c878,emissive:0x003a1a,emissiveI:.45,rough:.04,metal:0,spk:0x00ff88,tr:true,op:.82},
  obsidian:{color:0x111118,emissive:0x22003a,emissiveI:.22,rough:.02,metal:.6,spk:0x9944ff},
  ruby:{color:0xcc1020,emissive:0x440010,emissiveI:.55,rough:.03,metal:0,spk:0xff2244,tr:true,op:.85},
  diamond:{color:0xccf4ff,emissive:0x002244,emissiveI:.8,rough:0,metal:0,spk:0xaaeeff,tr:true,op:.75},
  nano:{color:0x001133,emissive:0x0055cc,emissiveI:2,rough:.04,metal:.9,spk:0x00aaff},
  plasma:{color:0x220044,emissive:0x8800cc,emissiveI:3,rough:0,metal:0,spk:0xcc44ff,tr:true,op:.9},
};
function getMaterialType(obj){
  if(!obj)return'organic';const mat=getMesh(obj)?.material;if(!mat)return'organic';
  for(const[k,def]of Object.entries(MAT_DEFS)){if(mat.color&&Math.abs(mat.color.getHex()-def.color)<0x101010)return k;}
  if(mat.metalness>.8)return'metal';if(mat.transparent)return'crystal';return'organic';
}
const MAT_GENOME_BONUS={
  gold:{armor:.5,strength:.3},silver:{speed:.3,stealth:.5},copper:{armor:.3,strength:.4},
  emerald:{stealth:.6,_trait:'regeneration'},obsidian:{armor:1,_trait:'void_shroud'},
  ruby:{_trait:'plasma_core',strength:.5},diamond:{armor:1.5,_trait:'crystalline_shell'},
  nano:{speed:.8,_trait:'neural_sync'},plasma:{_trait:'plasma_core',strength:.7},
  metal:{armor:.4,strength:.3},crystal:{armor:.5,_trait:'crystalline_shell'},organic:{_trait:'regeneration',speed:.2},
};

// ══════════════════════════════════════════════════════════════════
//  DOM BUILD
// ══════════════════════════════════════════════════════════════════
function buildDOM(){
  if($('nh-overlay'))return;
  // Main overlay
  const ov=document.createElement('div');ov.className='nh-overlay hidden';ov.id='nh-overlay';
  ov.innerHTML=`<div id="nh-main-panel">
  <div class="nh-hdr"><div class="nh-hdr-logo">${ico('nexus',18)}</div><h2>Nexus Helper</h2>
    <span style="font-size:9px;color:rgba(255,255,255,.2);font-family:monospace">v3.0</span>
    <button class="nh-key-btn" id="nh-key-btn" title="Configurar API Key da IA">${ico('brain',13)}</button>
    <button class="nh-x" id="nh-close">${ico('close',12)}</button></div>
  <button class="nh-edit-nexal" id="nh-edit-btn">
    <div class="nh-edit-icon">${ico('edit',14)}</div>
    <div style="flex:1"><div>Edit Nexal</div><div style="font-size:10px;color:rgba(165,180,252,.45);font-weight:400;margin-top:1px">Editar malha do objeto selecionado</div></div>
    ${ico('chevron',13)}</button>
  <div class="nh-cat cat-evo"><div class="nh-cat-title">${ico('creature',11)} Evolution</div><div class="nh-btn-col">
    <button class="nh-btn" id="nh-evolve-btn"><div class="ib">${ico('dna',14)}</div>
      <div class="bt">Evoluir por 1 Milhão de Anos<small>IA + simulação: planeta, predadores, minerais</small></div></button>
  </div></div>
  <div class="nh-cat cat-tx"><div class="nh-cat-title">${ico('mineral',11)} Transform</div><div class="nh-btn-col">
    <button class="nh-btn" id="nh-tx-btn"><div class="ib">${ico('gem',14)}</div>
      <div class="bt">Transformar Material<small>Ouro, minérios, nanotecnologia…</small></div></button>
    <button class="nh-btn" id="nh-tx-ai-btn"><div class="ib">${ico('brain',14)}</div>
      <div class="bt">IA Sugere Material<small>IA analisa e aplica o melhor material</small></div></button>
  </div></div>
  <div class="nh-cat cat-mech"><div class="nh-cat-title">${ico('robot',11)} Mech</div><div class="nh-btn-col">
    <button class="nh-btn" id="nh-mech-btn"><div class="ib">${ico('gear',14)}</div>
      <div class="bt">Transformar em Mech<small>Animação estilo Transformers</small></div></button>
    <button class="nh-btn" id="nh-mech-ai-btn"><div class="ib">${ico('brain',14)}</div>
      <div class="bt">IA Design do Mech<small>IA descreve e cria o mech personalizado</small></div></button>
  </div></div>
  <div class="nh-cat cat-fusion"><div class="nh-cat-title">${ico('merge',11)} Fusion</div><div class="nh-btn-col">
    <button class="nh-btn" id="nh-fusion-dna-btn"><div class="ib">${ico('dna',14)}</div>
      <div class="bt">Fusão DNA<small>Combina geometria dos 2 objetos</small></div></button>
    <button class="nh-btn" id="nh-fusion-ai-btn"><div class="ib">${ico('brain',14)}</div>
      <div class="bt">Fusão por IA<small>IA cria — converse para refinar</small></div></button>
    <button class="nh-btn" id="nh-fusion-rand-btn"><div class="ib">${ico('dice',14)}</div>
      <div class="bt">Fusão Aleatória<small>Resultado imprevisível</small></div></button>
  </div></div></div>`;
  document.body.appendChild(ov);

  // Transform sub-panel
  const txSub=document.createElement('div');txSub.className='nh-sub hidden';txSub.id='nh-tx-sub';
  txSub.innerHTML=`<div class="nh-sub-box">
  <div class="nh-sub-hdr">${ico('gem',18)}<h3 style="color:#ffd95c">Transformar Objeto</h3><button class="nh-x" id="nh-tx-close">${ico('close',12)}</button></div>
  <div class="nh-sub-list" id="nh-tx-list">
  ${[['gold','gem','Ouro','Metal precioso dourado'],['silver','mineral','Prata','Metal reluzente frio'],
     ['copper','mineral','Cobre','Cobre oxidado alaranjado'],['emerald','gem','Esmeralda','Cristal verde translúcido'],
     ['obsidian','mineral','Obsidiana','Pedra vulcânica negra'],['ruby','gem','Rubi','Gema vermelha cristalina'],
     ['diamond','gem','Diamante','Cristal puro faiscante'],['nano','brain','Nanotecnologia','Malha de nanobots luminosa'],
     ['plasma','lightning','Plasma','Energia plasma pulsante']
  ].map(([k,ic,n,d])=>`<button class="nh-sub-btn" data-mat="${k}">${ico(ic,17)}<div><strong>${n}</strong><br><small style="color:rgba(255,255,255,.32)">${d}</small></div></button>`).join('')}
  </div></div>`;
  document.body.appendChild(txSub);

  // Evolution overlay (compact)
  const evoOv=document.createElement('div');evoOv.id='nh-evo-overlay';evoOv.className='hidden';
  evoOv.innerHTML=`
  <div class="nh-evo-bar">
    ${ico('planet',16)}<h3 id="nh-evo-title" style="margin:0">Simulação de Evolução</h3>
    <span id="nh-evo-ai-lbl" class="nh-ai-lbl" style="display:none;margin-left:auto;margin-right:8px">${ico('brain',12)} IA processando…</span>
    <button class="nh-x" id="nh-evo-close" style="margin-left:auto">${ico('close',12)}</button>
  </div>
  <canvas id="nh-evo-canvas" width="548" height="310"></canvas>
  <div class="nh-evo-stats">
    <span id="nh-evo-gen">Gen: 0</span><span id="nh-evo-pop">Vivos: 0</span><span id="nh-evo-yr">Ano: 0</span>
  </div>
  <div class="nh-evo-phase" id="nh-evo-phase">Inicializando…</div>
  <div class="nh-evo-actions">
    <button class="nh-evo-btn" id="nh-evo-skip">${ico('skip',13)} Pular</button>
    <button class="nh-evo-btn red" id="nh-evo-abort">${ico('close',12)} Cancelar</button>
  </div>`;
  document.body.appendChild(evoOv);

  // Progress overlay
  const prog=document.createElement('div');prog.id='nh-prog';prog.className='hidden';
  prog.innerHTML=`<div class="nh-prog-box"><div class="nh-prog-title" id="nh-prog-title">Processando…</div>
    <div class="nh-prog-track"><div class="nh-prog-fill" id="nh-prog-fill" style="width:0%"></div></div>
    <div class="nh-prog-lbl" id="nh-prog-lbl">0%</div></div>`;
  document.body.appendChild(prog);

  if(!$('nh-toast')){const t=document.createElement('div');t.id='nh-toast';document.body.appendChild(t);}

  // Skills toggle button
  const sktBtn=document.createElement('button');sktBtn.id='nh-sk-toggle';sktBtn.className='hidden';
  sktBtn.innerHTML=`${ico('skills',14)} Skills`;document.body.appendChild(sktBtn);

  // Skills panel & config
  const sp=document.createElement('div');sp.id='nh-skill-panel';sp.className='hidden';document.body.appendChild(sp);
  const sc=document.createElement('div');sc.id='nh-skill-cfg';sc.className='hidden';document.body.appendChild(sc);

  // AI Fusion
  const aiOv=document.createElement('div');aiOv.id='nh-fusion-ai';aiOv.className='hidden';
  aiOv.innerHTML=`<div class="nh-ai-box">
  <div class="nh-ai-hdr">${ico('brain',18)}<h3>Fusão por IA</h3><button class="nh-x" id="nh-ai-close">${ico('close',12)}</button></div>
  <div class="nh-ai-msgs" id="nh-ai-msgs"></div>
  <button class="nh-ai-apply hidden" id="nh-ai-apply">${ico('star',14)} Aplicar fusão na cena</button>
  <div class="nh-ai-input-row">
    <textarea class="nh-ai-inp" id="nh-ai-input" rows="2" placeholder="Descreva como quer a fusão…"></textarea>
    <button class="nh-ai-send" id="nh-ai-send">Enviar</button>
  </div></div>`;
  document.body.appendChild(aiOv);

  // API Key modal
  const keyModal=document.createElement('div');keyModal.id='nh-key-modal';keyModal.className='hidden';
  keyModal.innerHTML=`
  <div class="nh-key-box">
    <h3>${ico('brain',16)} IA — API Key (Anthropic)</h3>
    <p>Cole sua chave <code style="background:rgba(255,255,255,.08);padding:1px 5px;border-radius:3px;font-size:10.5px">sk-ant-api03-…</code> abaixo.<br><br>
    Obtenha em: <strong style="color:#a5b4fc">console.anthropic.com → API Keys</strong><br><br>
    <span style="color:rgba(255,180,50,.7);font-size:10px">⚠ Se aparecer "Falha na conexão": o app pode estar bloqueando chamadas externas (CSP). Abra o Console do navegador (F12) e veja o erro exato.</span></p>
    <input class="nh-key-inp" id="nh-key-inp" type="password" placeholder="sk-ant-api03-…" autocomplete="off" spellcheck="false"/>
    <div class="nh-key-status" id="nh-key-status"></div>
    <div class="nh-key-actions">
      <button class="nh-key-save" id="nh-key-save">${ico('skills',13)} Salvar &amp; Testar</button>
      <button class="nh-key-clear" id="nh-key-clear">${ico('close',12)} Limpar</button>
      <button class="nh-x" id="nh-key-close" style="margin-left:auto">${ico('close',12)}</button>
    </div>
  </div>`;
  document.body.appendChild(keyModal);
}

function openHelper(){$('nh-overlay')?.classList.remove('hidden');}
function closeHelper(){$('nh-overlay')?.classList.add('hidden');$('nh-tx-sub')?.classList.add('hidden');}
function handleEditNexal(){const obj=getAO();if(!obj){toast('Selecione um objeto primeiro.');return;}closeHelper();setTimeout(()=>document.getElementById('modeling-toggle-btn')?.click(),80);}

// ══════════════════════════════════════════════════════════════════
//  TRANSFORM MATERIALS
// ══════════════════════════════════════════════════════════════════
function applyMaterial(type){
  const obj=getAO();if(!obj){toast('Selecione um objeto.');return;}
  const def=MAT_DEFS[type];if(!def)return;
  $('nh-tx-sub')?.classList.add('hidden');
  const wPos=getWorldPos(obj);
  obj.traverse(child=>{
    if(!child.isMesh)return;
    let m=child.material;
    if(!(m instanceof THREE.MeshStandardMaterial||m instanceof THREE.MeshPhysicalMaterial))
      m=new THREE.MeshStandardMaterial();
    m.color.setHex(def.color);m.emissive.setHex(def.emissive);m.emissiveIntensity=def.emissiveI;
    m.roughness=def.rough;m.metalness=def.metal;
    if(def.tr){m.transparent=true;m.opacity=def.op;}else{m.transparent=false;m.opacity=1;}
    m.needsUpdate=true;child.material=m;
  });
  obj.userData.materialType=type;
  sfmSparkles(wPos,def.spk,80,5);
  sfmSparkles(wPos,def.spk,80,5);
  if(type==='nano')animPulse(obj,1.5,.5,1.8,.08);
  if(type==='plasma')animPulse(obj,2.5,1.2,3.5,.12);
  toast(`Transformado em ${type}!`,2200);markDirty(4);
}
function animPulse(obj,base,amp,baseEI,speed){
  let f=0;const a=()=>{if(!obj.parent)return;f++;
    obj.traverse(c=>{if(c.isMesh&&c.material?.emissive){c.material.emissiveIntensity=base+Math.sin(f*speed)*amp;}});
    markDirty(1);requestAnimationFrame(a);};requestAnimationFrame(a);}

async function handleTxAI(){
  const obj=getAO();if(!obj){toast('Selecione um objeto.');return;}closeHelper();
  const label=getShapeLabel(obj),mat=getMesh(obj)?.material;
  const matStr=mat?`cor:#${mat.color?.getHexString()},rough:${mat.roughness?.toFixed(2)},metal:${mat.metalness?.toFixed(2)}`:'?';
  toast('IA analisando...',3000);
  const text=await callClaude(
    'Você é especialista em materiais 3D. Dado um objeto, escolha o MELHOR material desta lista: gold,silver,copper,emerald,obsidian,ruby,diamond,nano,plasma. Responda SOMENTE o nome (1 palavra).',
    `Objeto:${label}, material:${matStr}`);
  const chosen=text.trim().toLowerCase().replace(/[^a-z]/g,'');
  if(MAT_DEFS[chosen]){toast(`IA: ${chosen}! Aplicando...`,2000);setTimeout(()=>applyMaterial(chosen),500);}
  else{toast(`IA sugeriu "${text.trim()}" — não reconhecido.`,3000);}
}

// ══════════════════════════════════════════════════════════════════
//  MECH TRANSFORMATION
// ══════════════════════════════════════════════════════════════════
async function handleMechAI(){
  const obj=getAO();if(!obj){toast('Selecione um objeto.');return;}closeHelper();
  const label=getShapeLabel(obj),matType=getMaterialType(obj);
  toast('IA desenhando o mech...',3000);
  const text=await callClaude(
    'Você é designer de mechs para jogos de ação. Em 1-2 frases curtas em português, descreva o estilo visual do mech: tipo de armas, cor dominante, estilo (pesado/ágil/furtivo). Seja direto e épico.',
    `Objeto:${label}, material:${matType}`);
  if(text)toast(`IA: ${text}`,6000);setTimeout(()=>handleMech(),1500);
}

function handleMech(){
  const obj=getAO();if(!obj){toast('Selecione um objeto.');return;}
  const mesh=getMesh(obj);if(!mesh)return;
  const scene=getScene();if(!scene)return;
  const label=getShapeLabel(obj);closeHelper();
  const wPos=getWorldPos(obj);const wScale=new THREE.Vector3();obj.getWorldScale(wScale);
  const S=Math.max(wScale.x,wScale.y,wScale.z);
  obj.visible=false;sfmSparkles(wPos,0xff6020,100,6);
  const mech=buildMechBody(wPos,S);
  const allParts=[...mech.body,...mech.gears,...mech.lights,...mech.cannons];
  allParts.forEach(p=>{scene.add(p);p.visible=false;p.scale.setScalar(0);});
  const FE=55,FF=100,FR=50,TOTAL=FE+FF+FR;
  const frags=buildFragments(mesh,wPos,S,32);frags.forEach(f=>scene.add(f));
  let frame=0;setProgress('Transformando em Mech…',0,'Desmontando…');
  const tick=()=>{
    frame++;const t=frame/TOTAL;
    if(frame<=FE){const lt=frame/FE;setProgress('Transformando…',Math.round(t*100),'Desmontando…');
      frags.forEach(f=>{f.position.addScaledVector(f.userData.vel,1);f.rotation.x+=f.userData.rotV.x;f.rotation.y+=f.userData.rotV.y;f.userData.vel.multiplyScalar(.91);f.material.opacity=Math.max(0,1-lt*1.4);});}
    else if(frame<=FE+FF){const lt=(frame-FE)/FF;setProgress('Transformando…',Math.round(t*100),'Montando…');
      frags.forEach(f=>{f.position.lerp(wPos,.1);f.material.opacity=Math.max(0,.4-lt*.5);});
      mech.body.forEach((p,i)=>{const d=i/mech.body.length*.55;const lt2=Math.max(0,(lt-d)/(1-d));
        const ease=lt2<.5?2*lt2*lt2:1-Math.pow(-2*lt2+2,2)/2;
        p.visible=lt2>.01;p.scale.setScalar(ease);
        if(p.userData.unfoldAxis){const ax=p.userData.unfoldAxis;p.rotation[ax]=THREE.MathUtils.lerp(p.userData.unfoldFrom,p.userData.unfoldTo,ease);}
        if(p.material)p.material.emissiveIntensity=.3+Math.sin(frame*.3+i)*.3;});}
    else{setProgress('Transformando…',Math.round(t*100),'Sistemas online!');
      mech.body.forEach(p=>{if(p.material)p.material.emissiveIntensity=Math.max(.1,p.material.emissiveIntensity*.95);});}
    if(frame>FE){
      mech.gears.forEach((g,i)=>{const v=Math.min(1,(frame-FE)/30);g.visible=v>.05;g.scale.setScalar(v);g.rotation.z+=.06*(i%2?1:-1);});
      mech.lights.forEach((l,i)=>{const v=Math.min(1,(frame-FE)/25);l.visible=v>.05;l.scale.setScalar(v);if(l.material)l.material.emissiveIntensity=1.5+Math.sin(frame*.18+i)*.8;});
      mech.cannons.forEach(c=>{const v=Math.min(1,(frame-FE)/40);c.visible=v>.05;c.scale.setScalar(v);});}
    markDirty(2);if(frame<TOTAL){requestAnimationFrame(tick);return;}
    frags.forEach(f=>{f.removeFromParent();f.geometry?.dispose();f.material?.dispose();});hideProgress();
    const mechGroup=new THREE.Group();mechGroup.name=`Mech_${label}`;mechGroup.userData.shapeType='mech';mechGroup.userData.isMech=true;
    scene.add(mechGroup);allParts.forEach(p=>{p.removeFromParent();p.position.sub(wPos);mechGroup.add(p);});
    mechGroup.position.copy(wPos);window.sceneObjects?.push(mechGroup);
    const gearAnim=()=>{if(!mechGroup.parent)return;mech.gears.forEach((g,i)=>g.rotation.z+=.025*(i%2?1:-1));
      mech.lights.forEach((l,i)=>{if(l.material)l.material.emissiveIntensity=1.5+Math.sin(Date.now()*.003+i)*.7;});markDirty(1);requestAnimationFrame(gearAnim);};
    requestAnimationFrame(gearAnim);sfmSparkles(wPos,0xff6020,80,5);toast(`${label} → Mech Online!`,3500);markDirty(4);};
  requestAnimationFrame(tick);
}

function buildFragments(mesh,center,S,count){
  const bb=new THREE.Box3().setFromObject(mesh);const sz=new THREE.Vector3();bb.getSize(sz);
  const fc=mesh.material?.color?mesh.material.color.getHex():0x888888;
  return Array.from({length:count},()=>{
    const geo=new THREE.BoxGeometry(sz.x/6*(Math.random()*.7+.3),sz.y/6*(Math.random()*.7+.3),sz.z/6*(Math.random()*.7+.3));
    const mat=new THREE.MeshStandardMaterial({color:fc,roughness:.5,metalness:.3,emissive:0xff4400,emissiveIntensity:.5,transparent:true,opacity:1});
    const f=new THREE.Mesh(geo,mat);
    f.position.set(center.x+(Math.random()-.5)*sz.x,center.y+(Math.random()-.5)*sz.y,center.z+(Math.random()-.5)*sz.z);
    f.rotation.set(Math.random()*Math.PI*2,Math.random()*Math.PI*2,Math.random()*Math.PI*2);
    f.userData.vel=new THREE.Vector3((Math.random()-.5)*.35,Math.random()*.28+.06,(Math.random()-.5)*.35);
    f.userData.rotV=new THREE.Vector3((Math.random()-.5)*.18,(Math.random()-.5)*.18,(Math.random()-.5)*.18);
    return f;});}

function buildMechBody(center,S){
  const body=[],gears=[],lights=[],cannons=[];
  const M=(c,em=0x001133)=>new THREE.MeshStandardMaterial({color:c,roughness:.25,metalness:.82,emissive:em,emissiveIntensity:.4});
  const addB=(geo,mat,ox,oy,oz,uax=null,uf=0,ut=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(center.x+ox*S,center.y+oy*S,center.z+oz*S);m.castShadow=m.receiveShadow=true;if(uax){m.userData.unfoldAxis=uax;m.userData.unfoldFrom=uf;m.userData.unfoldTo=ut;m.rotation[uax]=uf;}body.push(m);return m;};
  addB(new THREE.BoxGeometry(S*.72,S*.82,S*.46),M(0x334466,0x001133),0,.28,0,'x',Math.PI,0);
  addB(new THREE.BoxGeometry(S*.5,S*.3,S*.12),M(0x445577,0x002244),0,.42,.24,'z',-Math.PI*.5,0);
  addB(new THREE.CylinderGeometry(S*.1,S*.1,S*.06,12),new THREE.MeshStandardMaterial({color:0x002266,emissive:0x0088ff,emissiveIntensity:3,roughness:0,metalness:.9,transparent:true,opacity:.9}),0,.34,.24,null);
  addB(new THREE.BoxGeometry(S*.38,S*.32,S*.36),M(0x2244aa,0x0022ff),0,.84,0,'x',-Math.PI,0);
  addB(new THREE.BoxGeometry(S*.32,S*.1,S*.08),new THREE.MeshStandardMaterial({color:0x001133,emissive:0x00ffff,emissiveIntensity:2.5,roughness:0}),0,.84,.19);
  [-1,1].forEach(s=>{const em=new THREE.Mesh(new THREE.SphereGeometry(S*.04,6,6),new THREE.MeshStandardMaterial({color:0,emissive:0x00ddff,emissiveIntensity:4,roughness:0}));em.position.set(center.x+s*S*.09,center.y+S*.88,center.z+S*.19);lights.push(em);});
  [-1,1].forEach(s=>{
    addB(new THREE.SphereGeometry(S*.22,10,10),M(0x445577,0x001144),s*.56,.5,0,'y',s*Math.PI,0);
    addB(new THREE.CylinderGeometry(S*.1,S*.08,S*.48,8),M(0x334455),s*.62,.13,0,'z',s*Math.PI*.5,s*.22);
    addB(new THREE.SphereGeometry(S*.1,7,7),M(0x445566),s*.66,-.18,0);
    addB(new THREE.CylinderGeometry(S*.08,S*.1,S*.44,8),M(0x3d5060),s*.7,-.44,0,'z',s*Math.PI,s*.05);
    [-1,0,1].forEach(f=>addB(new THREE.BoxGeometry(S*.06,S*.18,S*.05),M(0x223344),s*.7+f*S*.07,-.68,.03));});
  addB(new THREE.BoxGeometry(S*.55,S*.22,S*.42),M(0x2a3a4e,0x001122),0,-.12,0,'x',Math.PI*.5,0);
  [-1,1].forEach(s=>{
    addB(new THREE.CylinderGeometry(S*.14,S*.12,S*.54,8),M(0x334455),s*.22,-.5,0,'z',s*Math.PI*.4,0);
    addB(new THREE.SphereGeometry(S*.13,7,7),M(0x445566),s*.22,-.78,0);
    addB(new THREE.CylinderGeometry(S*.11,S*.13,S*.48,8),M(0x3d4f60),s*.22,-1.0,0,'x',-Math.PI*.4,0);
    addB(new THREE.BoxGeometry(S*.22,S*.1,S*.38),M(0x223344),s*.22,-1.22,.08);
    addB(new THREE.BoxGeometry(S*.1,S*.22,S*.06),M(0x445577,0x001133),s*.22,-.96,.15);});
  [-1,1].forEach(s=>{const cGeo=new THREE.CylinderGeometry(S*.07,S*.09,S*.5,8);const cMat=new THREE.MeshStandardMaterial({color:0x112233,emissive:0xff4400,emissiveIntensity:1.5,roughness:.2,metalness:.9});const c=new THREE.Mesh(cGeo,cMat);c.position.set(center.x+s*S*.62,center.y+S*.72,center.z+S*.1);c.rotation.x=Math.PI*.5;cannons.push(c);const tipM=new THREE.Mesh(new THREE.SphereGeometry(S*.07,6,6),new THREE.MeshStandardMaterial({color:0,emissive:0xff6600,emissiveIntensity:3,roughness:0}));tipM.position.set(center.x+s*S*.62,center.y+S*.72,center.z+S*.35);lights.push(tipM);});
  for(let i=0;i<5;i++){const g=new THREE.Mesh(new THREE.TorusGeometry(S*(.05+i*.018),S*.012,4,10),new THREE.MeshStandardMaterial({color:0x778899,metalness:.92,roughness:.15}));g.position.set(center.x+(i-2)*S*.14,center.y+S*.1,center.z+S*.24);g.rotation.x=Math.PI*.5;gears.push(g);}
  return{body,gears,lights,cannons};
}

// ══════════════════════════════════════════════════════════════════
//  EVOLUTION — Archetypes (sem copyright)
// ══════════════════════════════════════════════════════════════════
const ARCHETYPES=[
  {name:'Venom Apex',    color:'#8B3A3A',traits:{speed:5,armor:3,stealth:4,strength:3,spikes:true},icon:'acid',   desc:'Predador veloz com veneno neural'},
  {name:'Ferro Carapax', color:'#B09020',traits:{speed:2,armor:6,stealth:1,strength:5,shell:true}, icon:'shield', desc:'Fortaleza viva blindada'},
  {name:'Titanorak',     color:'#3a5a2a',traits:{speed:2,armor:5,stealth:1,strength:6,bulk:true},  icon:'star',   desc:'Colosso de força bruta'},
  {name:'Echo Specter',  color:'#3388cc',traits:{speed:4,armor:2,stealth:3,strength:3,sonic:true}, icon:'wave',   desc:'Caçador de ondas sônicas'},
  {name:'Pyrovex',       color:'#cc4a10',traits:{speed:3,armor:3,stealth:2,strength:4,fire:true},  icon:'lightning',desc:'Dragão de plasma vivo'},
  {name:'Glacius Rex',   color:'#223355',traits:{speed:4,armor:3,stealth:5,strength:3,ice:true},   icon:'dash',   desc:'Senhor do gelo eterno'},
  {name:'Arachna Prime', color:'#5a3a8a',traits:{speed:5,armor:2,stealth:4,strength:4,web:true},  icon:'skills', desc:'Aranha-predadora de 8 membros'},
  {name:'Void Entity',   color:'#110022',traits:{speed:3,armor:6,stealth:2,strength:6,cosmic:true},icon:'void',   desc:'Entidade do vazio dimensional'},
];

const PLANETS=[
  {name:'Toxis',      bg:'#030e03',ground:'#0e220e',sky:'#162a05',atm:'#2a5a0a',hazard:'acid',     desc:'Oceanos ácidos, chuva corrosiva',  color:'#44ff44'},
  {name:'Pyros',      bg:'#110300',ground:'#2a0a00',sky:'#3a1400',atm:'#ff4400',hazard:'fire',     desc:'Magma e tempestades de fogo',      color:'#ff6622'},
  {name:'Kylmyys',    bg:'#020508',ground:'#061222',sky:'#030810',atm:'#1133aa',hazard:'ice',      desc:'Gelo eterno e ventos glaciais',    color:'#88bbff'},
  {name:'Piscciss',   bg:'#000810',ground:'#000e28',sky:'#000c1e',atm:'#0033aa',hazard:'pressure', desc:'Profundezas de pressão extrema',   color:'#2244ff'},
  {name:'Khoros',     bg:'#0a0800',ground:'#1a1400',sky:'#282000',atm:'#ffcc00',hazard:'storm',    desc:'Tempestades elétricas permanentes',color:'#ffee44'},
  {name:'Encephalonus',bg:'#060010',ground:'#110028',sky:'#0a0020',atm:'#8822ff',hazard:'psionic',  desc:'Campos psíquicos letais',          color:'#cc44ff'},
  {name:'Quartzion',  bg:'#070810',ground:'#12161e',sky:'#0d1018',atm:'#aabbcc',hazard:'crystal',  desc:'Formações cristalinas cortantes',  color:'#ccddee'},
  {name:'Volcarion',  bg:'#0c0300',ground:'#200600',sky:'#300c00',atm:'#ff6600',hazard:'volcano',  desc:'Vulcões ativos e lava fervente',   color:'#ff4400'},
];

const PREDATORS=[
  {name:'Skarnex',     color:'#8B0000',size:16,speed:2.2,dmg:2,sense:90},
  {name:'Venorak',     color:'#4a7a00',size:10,speed:3.1,dmg:1,sense:120},
  {name:'Krallspider', color:'#3a003a',size:12,speed:2.8,dmg:2,sense:80},
  {name:'Omnivex',     color:'#cc4400',size:14,speed:3.5,dmg:3,sense:140},
  {name:'Groundborer', color:'#6a4a00',size:18,speed:1.8,dmg:3,sense:60},
  {name:'Shadowlurk',  color:'#220044',size:8, speed:4.0,dmg:2,sense:160},
  {name:'Blazehorn',   color:'#cc3300',size:15,speed:2.5,dmg:3,sense:100},
];

const MUTATION_POOL=['spikes','thick_skin','camouflage','poison_sac','extra_limbs','bioluminescence','acid_blood','echo_sense','heat_vision','magnetic_organs','crystalline_shell','venomous_bite','regeneration','flight_membrane','graviton_glands','quantum_phase','temporal_dodge','plasma_core','void_shroud','neural_sync'];

let evoRunning=false,evoSkip=false,evoAbort=false;

function runEvolutionSimulation(srcObj){
  const scene=getScene();if(!scene)return;
  srcObj.visible=false;
  const planet=PLANETS[Math.floor(Math.random()*PLANETS.length)];
  const numPT=2+Math.floor(Math.random()*3);
  const activePreds=Array.from({length:numPT},()=>PREDATORS[Math.floor(Math.random()*PREDATORS.length)]);
  const archetype=ARCHETYPES[Math.floor(Math.random()*ARCHETYPES.length)];
  const matType=getMaterialType(srcObj);
  const matBonus=MAT_GENOME_BONUS[matType]||{};

  $('nh-evo-overlay')?.classList.remove('hidden');
  const titleEl=$('nh-evo-title');if(titleEl)titleEl.textContent=`${planet.name} — ${planet.desc}`;

  const canvas=$('nh-evo-canvas');const ctx=canvas.getContext('2d');const W=canvas.width,H=canvas.height;
  const INIT_POP=40,TARGET_YEAR=1000000;
  let generation=0,year=0,frameN=0,simDone=false,bestGenome=null;

  function rg(){
    const g={speed:1+Math.random()*2,armor:1+Math.random()*2,stealth:1+Math.random()*2,
      size:1+Math.random()*2,strength:1+Math.random()*2,
      color:`hsl(${Math.floor(Math.random()*360)},${40+Math.floor(Math.random()*40)}%,${30+Math.floor(Math.random()*30)}%)`,
      traits:[],fitness:0};
    if(matBonus.armor)g.armor+=matBonus.armor;if(matBonus.speed)g.speed+=matBonus.speed;
    if(matBonus.strength)g.strength+=matBonus.strength;if(matBonus.stealth)g.stealth+=matBonus.stealth;
    if(matBonus._trait&&!g.traits.includes(matBonus._trait))g.traits.push(matBonus._trait);
    return g;}

  function mutate(genome){const g=JSON.parse(JSON.stringify(genome));const mr=.3+Math.random()*.4;
    if(Math.random()<mr)g.speed+=(Math.random()-.5)*.6;if(Math.random()<mr)g.armor+=(Math.random()-.5)*.6;
    if(Math.random()<mr)g.stealth+=(Math.random()-.5)*.6;if(Math.random()<mr)g.size+=(Math.random()-.5)*.4;
    if(Math.random()<mr)g.strength+=(Math.random()-.5)*.6;
    g.speed=Math.max(.3,g.speed);g.armor=Math.max(.3,g.armor);g.stealth=Math.max(.3,g.stealth);
    g.size=Math.max(.4,Math.min(5,g.size));g.strength=Math.max(.3,g.strength);
    const m=g.color.match(/hsl\((\d+),(\d+)%,(\d+)%\)/);
    if(m)g.color=`hsl(${(+m[1]+Math.floor((Math.random()-.5)*40)+360)%360},${Math.min(90,Math.max(20,+m[2]+Math.floor((Math.random()-.5)*10)))}%,${Math.min(70,Math.max(15,+m[3]+Math.floor((Math.random()-.5)*8)))}%)`;
    if(Math.random()<.15&&g.traits.length<8){const nt=MUTATION_POOL[Math.floor(Math.random()*MUTATION_POOL.length)];if(!g.traits.includes(nt))g.traits.push(nt);}
    return g;}

  function crossover(a,b){return{speed:(Math.random()<.5?a:b).speed,armor:(Math.random()<.5?a:b).armor,stealth:(Math.random()<.5?a:b).stealth,size:(Math.random()<.5?a:b).size,strength:(Math.random()<.5?a:b).strength,color:Math.random()<.5?a.color:b.color,traits:[...new Set([...a.traits.slice(0,4),...b.traits.slice(0,4)])],fitness:0};}

  function fitness(g,planet,preds){let sc=0;
    if(planet.hazard==='acid')sc+=g.armor*1.5+(g.traits.includes('acid_blood')?2:0);
    if(planet.hazard==='fire')sc+=g.armor*1.2+(g.traits.includes('plasma_core')?2.5:0);
    if(planet.hazard==='ice')sc+=g.speed*1.3+(g.traits.includes('heat_vision')?1:0);
    if(planet.hazard==='pressure')sc+=g.armor*2+(g.traits.includes('crystalline_shell')?2:0);
    if(planet.hazard==='storm')sc+=g.stealth*1.5+(g.traits.includes('magnetic_organs')?1.5:0);
    if(planet.hazard==='psionic')sc+=g.stealth*1.8+(g.traits.includes('neural_sync')?2.5:0);
    if(planet.hazard==='crystal')sc+=g.armor*1.4+(g.traits.includes('crystalline_shell')?3:0);
    if(planet.hazard==='volcano')sc+=g.armor*1.6+(g.traits.includes('plasma_core')?2:0);
    preds.forEach(p=>{sc+=g.speed*.6+g.stealth*.8-p.size/12;});
    if(g.traits.includes('thick_skin'))sc+=1.5;if(g.traits.includes('camouflage'))sc+=g.stealth*.8;
    if(g.traits.includes('regeneration'))sc+=1.2;if(g.traits.includes('flight_membrane'))sc+=g.speed*.5;
    if(g.traits.includes('plasma_core'))sc+=2;if(g.traits.includes('void_shroud'))sc+=1.8;
    sc+=Math.random()*.8;return Math.max(0,sc);}

  let population=Array.from({length:INIT_POP},rg);
  let creatures=population.map(g=>({x:30+Math.random()*(W-60),y:40+Math.random()*(H-80),vx:(Math.random()-.5)*g.speed,vy:(Math.random()-.5)*g.speed,g,alive:true,age:0}));
  let predObjs=activePreds.flatMap(pt=>Array.from({length:2+Math.floor(Math.random()*2)},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*pt.speed,vy:(Math.random()-.5)*pt.speed,pt,hunger:100})));
  bestGenome=population[0];

  // Stars precomputed
  const stars=[];for(let i=0;i<120;i++)stars.push({x:Math.random()*W,y:Math.random()*H*.6,r:Math.random()*.8+.2,a:Math.random()*.7+.2});

  evoRunning=true;evoSkip=false;evoAbort=false;

  function drawBg(){
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'#000005');grad.addColorStop(.35,planet.sky);grad.addColorStop(.7,planet.bg);
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    stars.forEach(st=>{ctx.fillStyle=`rgba(255,255,255,${st.a})`;ctx.beginPath();ctx.arc(st.x,st.y,st.r,0,Math.PI*2);ctx.fill();});
    // distant bodies
    ctx.fillStyle='rgba(150,130,200,.14)';ctx.beginPath();ctx.arc(W*.82,H*.11,16,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(200,120,80,.09)';ctx.beginPath();ctx.arc(W*.14,H*.08,9,0,Math.PI*2);ctx.fill();
    // horizon atm glow
    const ag=ctx.createLinearGradient(0,H*.52,0,H*.7);ag.addColorStop(0,'rgba(0,0,0,0)');ag.addColorStop(1,planet.atm+'2a');
    ctx.fillStyle=ag;ctx.fillRect(0,H*.52,W,H*.18);
    // ground
    const gg=ctx.createLinearGradient(0,H*.68,0,H);gg.addColorStop(0,planet.ground);gg.addColorStop(1,planet.bg);
    ctx.fillStyle=gg;ctx.fillRect(0,H*.68,W,H*.32);
    // terrain silhouette
    ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.moveTo(0,H*.68);
    for(let x=0;x<=W;x+=24)ctx.lineTo(x,H*.68-Math.sin(x*.016+1)*13-Math.sin(x*.042+3)*7);
    ctx.lineTo(W,H*.68);ctx.closePath();ctx.fill();
    // hazard fx
    if(planet.hazard==='fire'||planet.hazard==='volcano'){for(let i=0;i<4;i++){const px=W*.1+i*W*.25+Math.sin(frameN*.03+i)*8,py=H*.63+Math.sin(frameN*.05+i)*5;const fg=ctx.createRadialGradient(px,py,0,px,py,20);fg.addColorStop(0,'rgba(255,160,0,.42)');fg.addColorStop(1,'transparent');ctx.fillStyle=fg;ctx.beginPath();ctx.arc(px,py,20,0,Math.PI*2);ctx.fill();}}
    if(planet.hazard==='ice'){ctx.strokeStyle='rgba(150,200,255,.14)';for(let i=0;i<8;i++){const ix=i*W*.14+5;ctx.beginPath();ctx.moveTo(ix,H*.68);ctx.lineTo(ix+5,H*.58);ctx.lineTo(ix+10,H*.68);ctx.lineWidth=1.5;ctx.stroke();}}
    if(planet.hazard==='psionic'){ctx.strokeStyle=`rgba(180,80,255,${.06+Math.sin(frameN*.04)*.04})`;ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(W*.5,H*.5,H*(.2+i*.12),0,Math.PI*2);ctx.stroke();}}}

  function drawCreature(cr){if(!cr.alive)return;const r=4+cr.g.size*2.2;ctx.save();ctx.translate(cr.x,cr.y);
    ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(0,r*.5,r*.7,r*.28,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=cr.g.color;
    if(cr.g.traits.includes('crystalline_shell')){ctx.beginPath();for(let i=0;i<6;i++){const a=i/6*Math.PI*2;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(200,230,255,.6)';ctx.lineWidth=1.2;ctx.stroke();}
    else if(cr.g.traits.includes('spikes')){ctx.beginPath();ctx.arc(0,0,r*.75,0,Math.PI*2);ctx.fill();for(let i=0;i<8;i++){const a=i/8*Math.PI*2+frameN*.025;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.6,Math.sin(a)*r*.6);ctx.lineTo(Math.cos(a)*r*1.55,Math.sin(a)*r*1.55);ctx.strokeStyle=cr.g.color;ctx.lineWidth=1.8;ctx.stroke();}}
    else{ctx.beginPath();const segs=8;for(let i=0;i<=segs;i++){const a=i/segs*Math.PI*2,rr=r*(.85+Math.sin(a*2.3+frameN*.04)*.15);i===0?ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();}
    const ec=cr.g.fitness>12?'#ffff44':'#ff4400';
    [-1,1].forEach(side=>{ctx.fillStyle=ec;ctx.beginPath();ctx.arc(side*r*.35,-r*.25,r*.15,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(0,0,0,.7)';ctx.beginPath();ctx.arc(side*r*.35+side*.6,-r*.25,r*.07,0,Math.PI*2);ctx.fill();});
    if(cr.g.armor>3){ctx.strokeStyle='rgba(200,210,230,.3)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,r*.9,0,Math.PI*2);ctx.stroke();}
    if(cr.g.fitness>15){ctx.shadowColor=cr.g.color;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(0,0,r*.4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
    ctx.restore();}

  function drawPredator(p){ctx.save();ctx.translate(p.x,p.y);const sz=p.pt.size;
    ctx.fillStyle='rgba(255,0,0,.06)';ctx.beginPath();ctx.ellipse(0,sz*.6,sz*.7,sz*.28,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.pt.color;ctx.beginPath();ctx.moveTo(0,-sz);ctx.lineTo(sz*.5,-sz*.2);ctx.lineTo(sz*.7,sz*.6);ctx.lineTo(sz*.3,sz*.3);ctx.lineTo(0,sz*.7);ctx.lineTo(-sz*.3,sz*.3);ctx.lineTo(-sz*.7,sz*.6);ctx.lineTo(-sz*.5,-sz*.2);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(255,80,0,.35)';ctx.lineWidth=1.5;ctx.stroke();
    const ea=p.hunger<40?1:.5;ctx.fillStyle=`rgba(255,30,0,${ea})`;
    [-sz*.2,sz*.2].forEach(ex=>{ctx.beginPath();ctx.arc(ex,-sz*.3,sz*.12,0,Math.PI*2);ctx.fill();});
    ctx.fillStyle='rgba(255,120,80,.65)';ctx.font=`${Math.max(8,sz*.42)}px monospace`;ctx.textAlign='center';ctx.fillText(p.pt.name.split(' ')[0],0,-sz*1.1);ctx.restore();}

  function simStep(){
    if(!evoRunning||simDone||evoAbort){if(evoAbort){$('nh-evo-overlay')?.classList.add('hidden');srcObj.visible=true;evoRunning=false;}return;}
    const spf=evoSkip?50:1;
    for(let s=0;s<spf;s++){
      frameN++;year=Math.floor(frameN/200*TARGET_YEAR);const gen=Math.floor(frameN/200);
      creatures.forEach(cr=>{if(!cr.alive)return;cr.age++;const spd=cr.g.speed*.8*(cr.g.traits.includes('camouflage')?.7:1);cr.x+=cr.vx*spd;cr.y+=cr.vy*spd;if(cr.x<10||cr.x>W-10)cr.vx*=-1;if(cr.y<10||cr.y>H*.66)cr.vy*=-1;cr.x=Math.max(10,Math.min(W-10,cr.x));cr.y=Math.max(10,Math.min(H*.66,cr.y));if(Math.random()<.04){cr.vx=(Math.random()-.5)*spd;cr.vy=(Math.random()-.5)*spd;}});
      predObjs.forEach(p=>{let nearest=null,minD=p.pt.sense;creatures.forEach(cr=>{if(!cr.alive)return;const d=Math.hypot(cr.x-p.x,cr.y-p.y);const dr=cr.g.traits.includes('camouflage')?minD*.5:minD;if(d<dr){minD=d;nearest=cr;}});
        if(nearest){const dx=nearest.x-p.x,dy=nearest.y-p.y,d=Math.hypot(dx,dy);if(d>0){p.vx+=dx/d*p.pt.speed*.08;p.vy+=dy/d*p.pt.speed*.08;}if(d<p.pt.size+6){const esc=nearest.g.speed>p.pt.speed*.8||Math.random()<nearest.g.stealth*.1;if(!esc){nearest.alive=false;p.hunger=100;}}}
        else{p.vx+=(Math.random()-.5)*.3;p.vy+=(Math.random()-.5)*.3;}
        const sp=Math.hypot(p.vx,p.vy);if(sp>p.pt.speed){p.vx=p.vx/sp*p.pt.speed;p.vy=p.vy/sp*p.pt.speed;}
        p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H*.7)p.vy*=-1;p.x=Math.max(0,Math.min(W,p.x));p.y=Math.max(0,Math.min(H*.7,p.y));p.hunger-=.02;});
      if(gen>generation){generation=gen;
        population=creatures.filter(c=>c.alive).map(c=>c.g);
        if(population.length===0)population=Array.from({length:15},rg);
        population.forEach(g=>{g.fitness=fitness(g,planet,activePreds);});
        population.sort((a,b)=>b.fitness-a.fitness);bestGenome=population[0];
        const next=[];const elite=Math.min(4,population.length);for(let i=0;i<elite;i++)next.push(JSON.parse(JSON.stringify(population[i])));
        while(next.length<INIT_POP){const pA=population[Math.floor(Math.random()*Math.min(8,population.length))];const pB=population[Math.floor(Math.random()*Math.min(8,population.length))];next.push(mutate(crossover(pA,pB)));}
        population=next;creatures=population.map(g=>({x:30+Math.random()*(W-60),y:40+Math.random()*(H-80),vx:(Math.random()-.5)*g.speed,vy:(Math.random()-.5)*g.speed,g,alive:true,age:0}));}
      if(gen>=200){simDone=true;break;}}
    if(!evoSkip){
      drawBg();predObjs.forEach(drawPredator);creatures.forEach(drawCreature);
      ctx.fillStyle='rgba(0,0,0,.52)';ctx.fillRect(0,H*.77,W,H*.23);
      ctx.font='10px monospace';
      ctx.fillStyle='rgba(255,200,100,.75)';ctx.fillText(`Predadores: ${activePreds.map(p=>p.name).join(', ')}`,8,H*.78+12);
      const alive=creatures.filter(c=>c.alive).length;ctx.fillStyle=alive>10?'#4cefac':alive>3?'#ffd95c':'#ff5252';ctx.fillText(`Vivos: ${alive}/${INIT_POP}`,8,H*.78+25);
      if(bestGenome){ctx.fillStyle='rgba(165,180,252,.75)';ctx.fillText(`Fitness: ${bestGenome.fitness?.toFixed(1)}  Traits: ${bestGenome.traits.slice(0,4).join(', ')||'none'}`,8,H*.78+38);}
      const conv=generation/200;ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(8,H*.78+48,W-16,5);
      const bg2=ctx.createLinearGradient(8,0,W-16,0);bg2.addColorStop(0,planet.atm);bg2.addColorStop(1,'#a5b4fc');
      ctx.fillStyle=bg2;ctx.fillRect(8,H*.78+48,(W-16)*conv,5);
      ctx.fillStyle='rgba(255,255,255,.38)';ctx.font='9px monospace';
      ctx.fillText(`Convergência: ${(conv*100).toFixed(0)}%  Alvo: ${archetype.name}`,8,H*.78+62);
      if(matType!=='organic'){ctx.fillStyle='rgba(255,210,80,.55)';ctx.fillText(`Material: ${matType} (+bônus genético)`,W*.58,H*.78+12);}
    }
    $('nh-evo-gen').textContent=`Gen: ${generation}`;$('nh-evo-pop').textContent=`Vivos: ${creatures.filter(c=>c.alive).length}`;$('nh-evo-yr').textContent=`Ano: ${year.toLocaleString()}`;
    const ph=$('nh-evo-phase');if(ph)ph.textContent=simDone?'Evolução completa! Consultando IA…':`Convergindo → ${archetype.name} (${archetype.desc})`;
    if(!simDone)requestAnimationFrame(simStep);else finishEvolution(srcObj,bestGenome,archetype,planet);
  }
  requestAnimationFrame(simStep);
}

async function finishEvolution(srcObj,bestGenome,archetype,planet){
  evoRunning=false;const aiLbl=$('nh-evo-ai-lbl');if(aiLbl)aiLbl.style.display='flex';
  const narr=await callClaude('Você é narrador épico de simulador de evolução alienígena. Em 2 frases curtas em português, narre dramaticamente como essa criatura evoluiu. Seja cinematográfico.',
    `Criatura:${archetype.name}. Planeta:${planet.name}(${planet.desc}). Traits:${bestGenome.traits.join(',')||'none'}. Fitness:${bestGenome.fitness?.toFixed(1)}.`,400);
  if(aiLbl)aiLbl.style.display='none';
  $('nh-evo-overlay')?.classList.add('hidden');
  const scene=getScene();if(!scene)return;
  const wPos=getWorldPos(srcObj);
  const evolved=buildEvolvedForm(wPos,bestGenome,archetype);
  scene.add(evolved);window.sceneObjects?.push(evolved);srcObj.visible=false;
  sfmExplosion(wPos,0x4cefac);
  const skills=generateSkills(bestGenome,archetype);
  evolved.userData.evolvedSkills=skills;evolved.userData.isEvolved=true;
  evolved.userData.archetypeName=archetype.name;evolved.userData.archetypeIcon=archetype.icon;evolved.userData.archetype=archetype;
  startIdleAnim(evolved,archetype);
  toast(narr||`${archetype.name} emergiu de ${planet.name}!`,7000);markDirty(4);
}

// ══════════════════════════════════════════════════════════════════
//  EVOLVED FORM BUILDERS (modelos complexos por arquétipo)
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
//  EVOLVED FORM — Sistema de Animação Skeletal v4
//  Cada criatura tem hierarquia articulada + loop de animação único
// ══════════════════════════════════════════════════════════════════

// Registro global de animações ativas
const _evoAnims = [];

function buildEvolvedForm(center, genome, archetype) {
  const root = new THREE.Group();
  root.name = `Evolved_${archetype.name.replace(/ /g, '_')}`;
  root.position.copy(center);

  const S = 0.78 + genome.size * 0.35;
  const col = parseInt(archetype.color.replace('#', ''), 16);

  // Criador de material reutilizável
  const mat = (c, ei = 0.3, em = null, rough = 0.35, metal = 0.4, tr = false, op = 1) =>
    new THREE.MeshStandardMaterial({
      color: c, emissive: em !== null ? em : c,
      emissiveIntensity: ei, roughness: rough, metalness: metal,
      transparent: tr, opacity: op, side: tr ? THREE.DoubleSide : THREE.FrontSide
    });

  // Esqueleto articulado — cada sub-grupo é um "osso" animável
  const skeleton = {};

  if (archetype.traits.bulk)   _buildTitanorak(root, skeleton, S, col, genome, mat);
  else if (archetype.traits.shell) _buildFerro(root, skeleton, S, col, genome, mat);
  else if (archetype.traits.sonic) _buildEcho(root, skeleton, S, col, genome, mat);
  else if (archetype.traits.fire)  _buildPyrovex(root, skeleton, S, col, genome, mat);
  else if (archetype.traits.ice)   _buildGlacius(root, skeleton, S, col, genome, mat);
  else if (archetype.traits.web)   _buildArachna(root, skeleton, S, col, genome, mat);
  else if (archetype.traits.cosmic)_buildVoid(root, skeleton, S, col, genome, mat);
  else                             _buildVenom(root, skeleton, S, col, genome, mat);

  // Adicionar trait extras
  if (genome.traits.includes('bioluminescence')) {
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, r = S * 0.45;
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(S * 0.035, 6, 6),
        mat(0, 5, 0x44ffaa, 0, 0, true, 0.85)
      );
      orb.position.set(Math.cos(a) * r, S * 0.3 + Math.sin(a * 2) * S * 0.15, Math.sin(a) * r);
      root.add(orb);
      skeleton[`bio_${i}`] = orb;
    }
  }

  root.userData.shapeType  = 'evolved';
  root.userData.isEvolved  = true;
  root.userData._S         = S;
  root.userData._skeleton  = skeleton;
  root.userData._archetype = archetype;
  root.userData._genome    = genome;
  root.userData._baseY     = center.y;

  // Inicia o loop de animação desta criatura
  _startCreatureAnim(root, skeleton, archetype, genome, S);

  return root;
}

// ── Helpers de geometria ──────────────────────────────────────────
function _mesh(geo, material, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
function _bone(parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.set(rx, ry, rz);
  parent.add(g);
  return g;
}

// ── VENOM APEX — Bípede veloz com cauda e espinhos ───────────────
function _buildVenom(root, sk, S, col, genome, mat) {
  const dark = Math.max(0, col - 0x222222);
  const accent = 0xcc4422;

  // TORSO
  const torso = _bone(root, 0, S * 0.3, 0);
  sk.torso = torso;
  _mesh(new THREE.CylinderGeometry(S * 0.2, S * 0.26, S * 0.72, 10), mat(col, 0.4, col, 0.3, 0.4), torso);
  // Placas peitorais
  _mesh(new THREE.BoxGeometry(S * 0.42, S * 0.18, S * 0.1),  mat(dark, 0.2, dark, 0.4, 0.6), torso, 0, S * 0.12, S * 0.24);
  _mesh(new THREE.BoxGeometry(S * 0.32, S * 0.14, S * 0.08), mat(dark, 0.2, dark, 0.4, 0.6), torso, 0, -S * 0.08, S * 0.26);
  // Escamas dorsais
  for (let i = 0; i < 6; i++) {
    _mesh(new THREE.ConeGeometry(S * 0.04, S * (0.14 + i * 0.015), 5),
      mat(accent, 1.2, 0x551100, 0.15, 0.7),
      torso, 0, S * (0.18 - i * 0.1), -S * 0.23, Math.PI, 0, 0);
  }

  // PESCOÇO + CABEÇA
  const neck = _bone(torso, 0, S * 0.38, 0);
  sk.neck = neck;
  _mesh(new THREE.CylinderGeometry(S * 0.12, S * 0.16, S * 0.28, 8), mat(col, 0.35, dark, 0.3, 0.35), neck);
  const head = _bone(neck, 0, S * 0.22, -S * 0.03);
  sk.head = head;
  _mesh(new THREE.BoxGeometry(S * 0.3, S * 0.23, S * 0.36), mat(col, 0.45, dark, 0.28, 0.4), head);
  // Focinho
  _mesh(new THREE.BoxGeometry(S * 0.2, S * 0.14, S * 0.22), mat(dark, 0.25, dark, 0.3, 0.4), head, 0, -S * 0.03, S * 0.26);
  // Mandíbula
  const jaw = _bone(head, 0, -S * 0.07, S * 0.1);
  sk.jaw = jaw;
  _mesh(new THREE.BoxGeometry(S * 0.18, S * 0.07, S * 0.18), mat(dark, 0.15, dark, 0.35, 0.3), jaw);
  // Dentes
  for (let i = -1; i <= 1; i++) {
    _mesh(new THREE.ConeGeometry(S * 0.018, S * 0.07, 4), mat(0xeeeecc, 0.5, 0x888866, 0.1, 0.8), jaw, i * S * 0.05, -S * 0.04, S * 0.07, Math.PI, 0, 0);
  }
  // 4 olhos compostos
  [[-0.1, 0.04], [0.1, 0.04], [-0.06, 0.1], [0.06, 0.1]].forEach(([ex, ey]) => {
    _mesh(new THREE.SphereGeometry(S * 0.042, 8, 8),
      mat(0, 6, 0x88ff44, 0, 0, true, 0.9),
      head, ex * S, ey * S, S * 0.19);
  });
  // Chifres da cabeça
  [-1, 1].forEach(s => {
    const horn = _bone(head, s * S * 0.12, S * 0.1, -S * 0.04);
    sk[`horn_${s}`] = horn;
    _mesh(new THREE.ConeGeometry(S * 0.04, S * 0.22, 5), mat(dark, 0.3, dark, 0.4, 0.6), horn, 0, S * 0.11, 0, -0.3, 0, s * 0.35);
  });

  // BRAÇOS articulados
  [-1, 1].forEach(s => {
    const shoulder = _bone(torso, s * S * 0.28, S * 0.22, 0);
    sk[`shoulder_${s}`] = shoulder;
    _mesh(new THREE.SphereGeometry(S * 0.13, 9, 9), mat(col, 0.3, dark, 0.35, 0.45), shoulder);
    const upperArm = _bone(shoulder, s * S * 0.14, -S * 0.05, 0);
    sk[`upperArm_${s}`] = upperArm;
    _mesh(new THREE.CylinderGeometry(S * 0.075, S * 0.065, S * 0.42, 8), mat(col, 0.3, dark, 0.35, 0.4), upperArm, 0, -S * 0.21, 0);
    const elbow = _bone(upperArm, 0, -S * 0.44, 0);
    sk[`elbow_${s}`] = elbow;
    _mesh(new THREE.SphereGeometry(S * 0.08, 7, 7), mat(col, 0.35, dark, 0.4, 0.5), elbow);
    const forearm = _bone(elbow, 0, -S * 0.04, 0);
    sk[`forearm_${s}`] = forearm;
    _mesh(new THREE.CylinderGeometry(S * 0.058, S * 0.075, S * 0.38, 8), mat(col, 0.3, dark, 0.35, 0.4), forearm, 0, -S * 0.19, 0);
    // Lâminas no antebraço
    _mesh(new THREE.BoxGeometry(S * 0.014, S * 0.22, S * 0.03), mat(0x888888, 1.5, 0x446677, 0.05, 0.95), forearm, s * S * 0.08, -S * 0.12, S * 0.06);
    // Garras
    const hand = _bone(forearm, 0, -S * 0.4, 0);
    sk[`hand_${s}`] = hand;
    for (let f = 0; f < 3; f++) {
      const fa = (f - 1) * 0.35;
      _mesh(new THREE.ConeGeometry(S * 0.022, S * 0.13, 5), mat(0xdddddd, 0.8, 0x666666, 0.12, 0.9),
        hand, s * S * 0.04 * (f - 1), -S * 0.06, S * 0.04, fa * 0.5, 0, fa);
    }
  });

  // PERNAS articuladas
  [-1, 1].forEach(s => {
    const hip = _bone(torso, s * S * 0.2, -S * 0.3, 0);
    sk[`hip_${s}`] = hip;
    _mesh(new THREE.SphereGeometry(S * 0.11, 8, 8), mat(col, 0.3, dark, 0.35, 0.45), hip);
    const thigh = _bone(hip, s * S * 0.04, -S * 0.05, 0);
    sk[`thigh_${s}`] = thigh;
    _mesh(new THREE.CylinderGeometry(S * 0.1, S * 0.085, S * 0.46, 8), mat(col, 0.3, dark, 0.35, 0.4), thigh, 0, -S * 0.23, 0);
    const knee = _bone(thigh, 0, -S * 0.48, 0);
    sk[`knee_${s}`] = knee;
    _mesh(new THREE.SphereGeometry(S * 0.095, 7, 7), mat(col, 0.35, dark, 0.38, 0.5), knee);
    // Shin spur
    _mesh(new THREE.ConeGeometry(S * 0.04, S * 0.16, 5), mat(accent, 1.2, 0x441100, 0.1, 0.8), knee, s * S * 0.1, 0, S * 0.08, 0, 0, s * 0.5);
    const shin = _bone(knee, 0, -S * 0.04, S * 0.04);
    sk[`shin_${s}`] = shin;
    _mesh(new THREE.CylinderGeometry(S * 0.073, S * 0.09, S * 0.42, 8), mat(col, 0.3, dark, 0.35, 0.4), shin, 0, -S * 0.21, 0);
    const foot = _bone(shin, 0, -S * 0.44, S * 0.08);
    sk[`foot_${s}`] = foot;
    _mesh(new THREE.BoxGeometry(S * 0.1, S * 0.05, S * 0.3), mat(col, 0.2, dark, 0.4, 0.45), foot, 0, 0, S * 0.06);
    for (let f = 0; f < 3; f++) {
      _mesh(new THREE.ConeGeometry(S * 0.022, S * 0.1, 5), mat(0xdddddd, 0.8, 0x666666, 0.1, 0.9),
        foot, (f - 1) * S * 0.06, -S * 0.04, S * 0.2, -0.35, 0, (f - 1) * 0.25);
    }
  });

  // CAUDA segmentada
  const tailBase = _bone(torso, 0, -S * 0.28, -S * 0.18);
  sk.tailBase = tailBase;
  let prev = tailBase;
  for (let i = 0; i < 8; i++) {
    const seg = _bone(prev, 0, 0, -S * (0.16 - i * 0.008));
    sk[`tail_${i}`] = seg;
    const r = S * (0.11 - i * 0.011);
    _mesh(new THREE.SphereGeometry(Math.max(r, S * 0.03), 7, 6), mat(col, 0.3, dark, 0.35, 0.4), seg);
    if (i > 2 && i % 2 === 0) {
      _mesh(new THREE.ConeGeometry(S * 0.03, S * 0.1, 5), mat(accent, 1.0, 0x441100, 0.15, 0.8), seg, 0, 0, -r * 1.2, Math.PI, 0, 0);
    }
    prev = seg;
  }
  // Ferrão
  _mesh(new THREE.ConeGeometry(S * 0.05, S * 0.25, 6), mat(accent, 2, 0x441100, 0.06, 0.9), prev, 0, 0, -S * 0.14, Math.PI * 0.7, 0, 0);
}

// ── TITANORAK — Colosso bípede blindado ──────────────────────────
function _buildTitanorak(root, sk, S, col, genome, mat) {
  const dark = Math.max(0, col - 0x181818);
  const glow = 0x0088ff;

  const torso = _bone(root, 0, S * 0.28, 0);
  sk.torso = torso;
  _mesh(new THREE.BoxGeometry(S * 0.88, S * 0.82, S * 0.54), mat(col, 0.45, col, 0.25, 0.55), torso);
  // Placas peitorais em camadas
  _mesh(new THREE.BoxGeometry(S * 0.65, S * 0.28, S * 0.1), mat(dark, 0.25, dark, 0.2, 0.7), torso, 0, S * 0.2, S * 0.27);
  _mesh(new THREE.BoxGeometry(S * 0.5, S * 0.22, S * 0.08), mat(dark, 0.2, dark, 0.2, 0.7), torso, 0, -S * 0.04, S * 0.28);
  // Canal de energia nas costas
  _mesh(new THREE.BoxGeometry(S * 0.1, S * 0.65, S * 0.06),
    mat(0x002244, 3, glow, 0, 0.9, true, 0.85), torso, 0, S * 0.04, -S * 0.28);
  for (let i = 0; i < 4; i++) {
    _mesh(new THREE.SphereGeometry(S * 0.055, 7, 7),
      mat(0, 5, glow, 0, 0), torso, 0, S * (0.22 - i * 0.18), -S * 0.32);
  }

  // PESCOÇO + CABEÇA maciça
  const neck = _bone(torso, 0, S * 0.44, 0);
  sk.neck = neck;
  _mesh(new THREE.CylinderGeometry(S * 0.22, S * 0.27, S * 0.3, 10), mat(col, 0.4, dark, 0.28, 0.5), neck);
  const head = _bone(neck, 0, S * 0.22, 0);
  sk.head = head;
  _mesh(new THREE.BoxGeometry(S * 0.46, S * 0.38, S * 0.44), mat(dark, 0.3, dark, 0.32, 0.52), head);
  // Sobrancelha blindada
  _mesh(new THREE.BoxGeometry(S * 0.46, S * 0.07, S * 0.08), mat(col, 0.22, dark, 0.38, 0.6), head, 0, S * 0.2, S * 0.22);
  // 4 chifres
  [[-0.16, 0.17], [0.16, 0.17], [-0.1, 0.18], [0.1, 0.18]].forEach(([hx, hy], i) => {
    _mesh(new THREE.ConeGeometry(S * (0.055 - i * 0.005), S * (0.26 - i * 0.03), 6),
      mat(dark, 0.4, dark, 0.38, 0.65), head, hx * S, hy * S, 0, -(0.2 + i * 0.08), 0, hx * 1.5);
  });
  // Olhos (brilhantes, vermelhos)
  [-1, 1].forEach(s => {
    _mesh(new THREE.SphereGeometry(S * 0.065, 9, 9), mat(0, 7, 0xff2200, 0, 0, true, 0.9), head, s * S * 0.14, S * 0.05, S * 0.23);
    // Anel ao redor do olho
    _mesh(new THREE.TorusGeometry(S * 0.08, S * 0.012, 5, 14), mat(dark, 0.3, dark, 0.35, 0.7), head, s * S * 0.14, S * 0.05, S * 0.22, Math.PI * 0.5, 0, 0);
  });
  // Boca / grelha
  for (let i = 0; i < 4; i++) {
    _mesh(new THREE.BoxGeometry(S * 0.3, S * 0.018, S * 0.04), mat(dark, 0.1, dark, 0.5, 0.4), head, 0, S * (-0.06 + i * 0.028), S * 0.23);
  }

  // BRAÇOS colosais
  [-1, 1].forEach(s => {
    const shoulder = _bone(torso, s * S * 0.52, S * 0.28, 0);
    sk[`shoulder_${s}`] = shoulder;
    _mesh(new THREE.SphereGeometry(S * 0.22, 10, 10), mat(col, 0.35, dark, 0.3, 0.5), shoulder);
    // Espinhos no ombro
    for (let i = 0; i < 3; i++) {
      _mesh(new THREE.ConeGeometry(S * 0.045, S * 0.18, 6), mat(dark, 0.3, dark, 0.4, 0.65), shoulder, s * S * (0.06 + i * 0.08), S * (0.12 - i * 0.08), 0, 0, 0, s * (0.3 + i * 0.25));
    }
    const upperArm = _bone(shoulder, s * S * 0.12, -S * 0.06, 0);
    sk[`upperArm_${s}`] = upperArm;
    _mesh(new THREE.CylinderGeometry(S * 0.17, S * 0.14, S * 0.52, 9), mat(col, 0.32, dark, 0.3, 0.5), upperArm, 0, -S * 0.26, 0);
    const elbow = _bone(upperArm, 0, -S * 0.54, 0);
    sk[`elbow_${s}`] = elbow;
    _mesh(new THREE.SphereGeometry(S * 0.17, 8, 8), mat(col, 0.35, dark, 0.35, 0.5), elbow);
    const forearm = _bone(elbow, s * S * 0.03, -S * 0.04, 0);
    sk[`forearm_${s}`] = forearm;
    _mesh(new THREE.CylinderGeometry(S * 0.15, S * 0.17, S * 0.48, 9), mat(col, 0.3, dark, 0.3, 0.5), forearm, 0, -S * 0.24, 0);
    // Punho maciço
    const fist = _bone(forearm, 0, -S * 0.5, 0);
    sk[`fist_${s}`] = fist;
    _mesh(new THREE.BoxGeometry(S * 0.3, S * 0.28, S * 0.24), mat(col, 0.32, dark, 0.3, 0.55), fist);
    for (let k = 0; k < 4; k++) {
      _mesh(new THREE.BoxGeometry(S * 0.055, S * 0.045, S * 0.14), mat(dark, 0.3, dark, 0.4, 0.65), fist, (k - 1.5) * S * 0.07, S * 0.13, S * 0.1);
    }
  });

  // PERNAS tipo coluna
  [-1, 1].forEach(s => {
    const hip = _bone(torso, s * S * 0.28, -S * 0.42, 0);
    sk[`hip_${s}`] = hip;
    const thigh = _bone(hip, 0, -S * 0.02, 0);
    sk[`thigh_${s}`] = thigh;
    _mesh(new THREE.CylinderGeometry(S * 0.19, S * 0.16, S * 0.54, 9), mat(col, 0.3, dark, 0.32, 0.5), thigh, 0, -S * 0.27, 0);
    const knee = _bone(thigh, 0, -S * 0.56, 0);
    sk[`knee_${s}`] = knee;
    _mesh(new THREE.SphereGeometry(S * 0.18, 8, 8), mat(col, 0.32, dark, 0.35, 0.5), knee);
    _mesh(new THREE.ConeGeometry(S * 0.06, S * 0.2, 6), mat(dark, 0.3, dark, 0.4, 0.65), knee, s * S * 0.18, 0, S * 0.1, 0, 0, s * 0.5);
    const shin = _bone(knee, 0, -S * 0.04, 0);
    sk[`shin_${s}`] = shin;
    _mesh(new THREE.CylinderGeometry(S * 0.15, S * 0.19, S * 0.5, 9), mat(col, 0.3, dark, 0.32, 0.5), shin, 0, -S * 0.25, 0);
    const foot = _bone(shin, s * S * 0.02, -S * 0.52, S * 0.06);
    sk[`foot_${s}`] = foot;
    _mesh(new THREE.BoxGeometry(S * 0.3, S * 0.1, S * 0.44), mat(col, 0.22, dark, 0.38, 0.5), foot);
  });
}

// ── PYROVEX — Dragão alado com pescoço longo ─────────────────────
function _buildPyrovex(root, sk, S, col, genome, mat) {
  const dark = Math.max(0, col - 0x181818);

  // Corpo principal
  const torso = _bone(root, 0, S * 0.2, S * 0.06);
  sk.torso = torso;
  _mesh(new THREE.CylinderGeometry(S * 0.24, S * 0.36, S * 0.85, 10), mat(col, 0.5, col, 0.3, 0.35), torso);
  // Costelas / nervuras
  for (let i = 0; i < 5; i++) {
    _mesh(new THREE.TorusGeometry(S * (0.26 + i * 0.01), S * 0.016, 4, 14),
      mat(col, 0.22, dark, 0.4, 0.55), torso, 0, S * (0.2 - i * 0.14), 0, Math.PI * 0.5, 0, 0);
  }
  // Ventos de fogo no peito
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    _mesh(new THREE.CylinderGeometry(S * 0.058, S * 0.075, S * 0.04, 8),
      mat(0, 6, 0xff4400, 0, 0, true, 0.9), torso,
      Math.cos(a) * S * 0.28, S * 0.1, Math.sin(a) * S * 0.28);
  }

  // PESCOÇO em segmentos curvos
  let prevNeck = torso;
  const neckSegments = 5;
  for (let i = 0; i < neckSegments; i++) {
    const t = i / (neckSegments - 1);
    const seg = _bone(prevNeck, 0, S * 0.17, S * (0.04 - i * 0.02));
    sk[`neck_${i}`] = seg;
    _mesh(new THREE.CylinderGeometry(S * (0.16 - t * 0.04), S * (0.18 - t * 0.03), S * 0.2, 8),
      mat(col, 0.4, col, 0.3, 0.35), seg, 0, S * 0.1, 0);
    prevNeck = seg;
  }
  // CABEÇA de dragão
  const head = _bone(prevNeck, 0, S * 0.12, S * 0.06);
  sk.head = head;
  _mesh(new THREE.BoxGeometry(S * 0.36, S * 0.27, S * 0.46), mat(col, 0.5, col, 0.28, 0.38), head);
  // Focinho
  _mesh(new THREE.BoxGeometry(S * 0.24, S * 0.17, S * 0.28), mat(dark, 0.3, dark, 0.3, 0.4), head, 0, -S * 0.04, S * 0.35);
  // Coroa de fogo (chifres que pulsam)
  for (let i = 0; i < 5; i++) {
    const a = (i / 4 - 0.5) * 1.0;
    const cr = _bone(head, Math.sin(a) * S * 0.15, S * 0.17, 0);
    sk[`crown_${i}`] = cr;
    _mesh(new THREE.ConeGeometry(S * 0.048, S * (0.2 + i * 0.04), 6),
      mat(0xff4400, 3, 0xff2200, 0.06, 0.6, true, 0.9), cr, 0, S * 0.12, 0, a * 0.5, 0, 0);
  }
  // Olhos
  [-1, 1].forEach(s => {
    _mesh(new THREE.SphereGeometry(S * 0.062, 8, 8), mat(0, 8, 0xff6600, 0, 0, true, 0.9), head, s * S * 0.14, S * 0.04, S * 0.24);
  });
  // Boca aberta com dentes
  const mouth = _bone(head, 0, -S * 0.08, S * 0.32);
  sk.mouth = mouth;
  for (let i = -2; i <= 2; i++) {
    _mesh(new THREE.ConeGeometry(S * 0.025, S * 0.09, 5), mat(0xeeeecc, 0.6, 0x888866, 0.1, 0.8), mouth, i * S * 0.05, -S * 0.04, S * 0.02, Math.PI, 0, 0);
  }

  // ASAS
  [-1, 1].forEach(s => {
    const wing = _bone(torso, s * S * 0.3, S * 0.2, 0);
    sk[`wing_${s}`] = wing;
    // Osso da asa
    _mesh(new THREE.CylinderGeometry(S * 0.04, S * 0.06, S * 0.85, 6),
      mat(dark, 0.2, dark, 0.4, 0.55), wing, s * S * 0.42, S * 0.06, 0, 0, 0, s * 0.72);
    // Membranas (3 seções)
    for (let f = 0; f < 3; f++) {
      const wSeg = _bone(wing, s * S * (0.22 + f * 0.22), S * (0.08 - f * 0.06), 0);
      sk[`wingMem_${s}_${f}`] = wSeg;
      _mesh(new THREE.PlaneGeometry(S * (0.55 - f * 0.06), S * (0.68 - f * 0.08)),
        mat(col, 0.6 + f * 0.3, 0xff2200, 0.35, 0.1, true, 0.55 - f * 0.05),
        wSeg, 0, -S * 0.12, 0, 0, 0, s * (0.52 + f * 0.18));
    }
  });

  // 4 PERNAS de dragão
  [-1, 1].forEach(s => [-1, 1].forEach(fwd => {
    const hip = _bone(torso, s * S * 0.3, -S * 0.1, fwd * S * 0.24);
    sk[`hip_${s}_${fwd}`] = hip;
    const thigh = _bone(hip, s * S * 0.06, -S * 0.04, 0);
    sk[`thigh_${s}_${fwd}`] = thigh;
    _mesh(new THREE.CylinderGeometry(S * 0.09, S * 0.08, S * 0.38, 8), mat(col, 0.3, dark, 0.35, 0.4), thigh, 0, -S * 0.19, 0);
    const knee = _bone(thigh, 0, -S * 0.4, S * 0.04 * fwd);
    sk[`knee_${s}_${fwd}`] = knee;
    const shin = _bone(knee, 0, -S * 0.03, 0);
    _mesh(new THREE.CylinderGeometry(S * 0.07, S * 0.09, S * 0.33, 8), mat(col, 0.3, dark, 0.35, 0.4), shin, 0, -S * 0.165, 0);
    const foot = _bone(shin, 0, -S * 0.34, S * 0.06 * fwd);
    _mesh(new THREE.BoxGeometry(S * 0.1, S * 0.05, S * 0.28), mat(col, 0.2, dark, 0.4, 0.45), foot, 0, 0, S * 0.06);
  }));

  // CAUDA
  let prevT = torso;
  for (let i = 0; i < 9; i++) {
    const seg = _bone(prevT, 0, 0, -S * (0.15 - i * 0.008));
    sk[`tail_${i}`] = seg;
    const r = S * (0.18 - i * 0.016);
    _mesh(new THREE.SphereGeometry(Math.max(r, S * 0.04), 8, 6), mat(col, 0.35, col, 0.32, 0.38), seg);
    prevT = seg;
  }
  _mesh(new THREE.ConeGeometry(S * 0.06, S * 0.28, 6), mat(0xff4400, 2.5, 0xff2200, 0.06, 0.8), prevT, 0, 0, -S * 0.15, Math.PI * 0.65, 0, 0);
}

// ── GLACIUS REX — Bípede coberto de cristal ──────────────────────
function _buildGlacius(root, sk, S, col, genome, mat) {
  const iceMat = (ei = 0.6) => mat(0xbbddff, ei, 0x88ccff, 0.02, 0.88, true, 0.68);

  const torso = _bone(root, 0, S * 0.28, 0);
  sk.torso = torso;
  _mesh(new THREE.BoxGeometry(S * 0.56, S * 0.78, S * 0.46), mat(col, 0.35, col, 0.18, 0.7), torso);
  // Armadura de gelo — lajes laterais
  for (let i = 0; i < 4; i++) {
    _mesh(new THREE.BoxGeometry(S * 0.18, S * 0.52, S * 0.08),
      iceMat(0.55 + i * 0.05), torso, [-S * 0.3, S * 0.3, -S * 0.28, S * 0.28][i], S * 0.04, S * (0.26 - i * 0.04));
  }
  // Espículas no topo
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 1.3;
    const sp = _bone(torso, Math.sin(a) * S * 0.2, S * 0.42, 0);
    sk[`spike_${i}`] = sp;
    _mesh(new THREE.ConeGeometry(S * 0.038, S * (0.28 + i * 0.02), 6), iceMat(1.0), sp, 0, S * 0.17, 0, a * 0.5, 0, 0);
  }

  // PESCOÇO + CABEÇA
  const neck = _bone(torso, 0, S * 0.42, 0);
  sk.neck = neck;
  _mesh(new THREE.CylinderGeometry(S * 0.14, S * 0.18, S * 0.28, 9), mat(col, 0.38, col, 0.22, 0.65), neck);
  const head = _bone(neck, 0, S * 0.2, 0);
  sk.head = head;
  _mesh(new THREE.BoxGeometry(S * 0.42, S * 0.34, S * 0.4), mat(col, 0.42, col, 0.2, 0.65), head);
  // Coroa de gelo
  for (let i = 0; i < 5; i++) {
    const a = (i / 4 - 0.5) * 1.2;
    _mesh(new THREE.ConeGeometry(S * 0.038, S * (0.3 + i * 0.04), 6), iceMat(1.2),
      head, Math.sin(a) * S * 0.16, S * 0.21, 0, a * 0.45, 0, 0);
  }
  // Respiração de gelo (anel)
  _mesh(new THREE.TorusGeometry(S * 0.09, S * 0.022, 6, 14),
    mat(0, 4, 0x88eeff, 0, 0, true, 0.85), head, 0, 0, S * 0.22, Math.PI * 0.5, 0, 0);
  // Olhos
  [-1, 1].forEach(s => {
    _mesh(new THREE.SphereGeometry(S * 0.056, 8, 8), mat(0, 9, 0x44ddff, 0, 0, true, 0.9), head, s * S * 0.13, S * 0.06, S * 0.21);
  });

  // BRAÇOS com manoplas de gelo
  [-1, 1].forEach(s => {
    const shoulder = _bone(torso, s * S * 0.36, S * 0.28, 0);
    sk[`shoulder_${s}`] = shoulder;
    _mesh(new THREE.SphereGeometry(S * 0.14, 9, 9), mat(col, 0.3, col, 0.22, 0.65), shoulder);
    const upperArm = _bone(shoulder, s * S * 0.1, -S * 0.05, 0);
    sk[`upperArm_${s}`] = upperArm;
    _mesh(new THREE.CylinderGeometry(S * 0.1, S * 0.085, S * 0.44, 8), mat(col, 0.3, col, 0.22, 0.65), upperArm, 0, -S * 0.22, 0);
    const elbow = _bone(upperArm, 0, -S * 0.46, 0);
    sk[`elbow_${s}`] = elbow;
    _mesh(new THREE.SphereGeometry(S * 0.1, 7, 7), mat(col, 0.32, col, 0.24, 0.65), elbow);
    const forearm = _bone(elbow, 0, -S * 0.03, 0);
    sk[`forearm_${s}`] = forearm;
    _mesh(new THREE.CylinderGeometry(S * 0.09, S * 0.1, S * 0.42, 8), mat(col, 0.3, col, 0.22, 0.65), forearm, 0, -S * 0.21, 0);
    // Manopla de gelo
    _mesh(new THREE.BoxGeometry(S * 0.22, S * 0.2, S * 0.18), iceMat(0.75), forearm, 0, -S * 0.44, 0);
    // Estalactites da manopla
    for (let k = 0; k < 4; k++) {
      _mesh(new THREE.ConeGeometry(S * 0.03, S * (0.12 + k * 0.02), 5), iceMat(1.0),
        forearm, (k - 1.5) * S * 0.06, -S * 0.56, S * 0.04, -0.25, 0, 0);
    }
  });

  // PERNAS
  [-1, 1].forEach(s => {
    const hip = _bone(torso, s * S * 0.22, -S * 0.4, 0);
    sk[`hip_${s}`] = hip;
    const thigh = _bone(hip, 0, -S * 0.02, 0);
    sk[`thigh_${s}`] = thigh;
    _mesh(new THREE.CylinderGeometry(S * 0.13, S * 0.11, S * 0.5, 8), mat(col, 0.3, col, 0.22, 0.65), thigh, 0, -S * 0.25, 0);
    const knee = _bone(thigh, 0, -S * 0.52, 0);
    sk[`knee_${s}`] = knee;
    _mesh(new THREE.SphereGeometry(S * 0.12, 7, 7), mat(col, 0.32, col, 0.25, 0.65), knee);
    // Espora do joelho em gelo
    _mesh(new THREE.ConeGeometry(S * 0.04, S * 0.16, 5), iceMat(0.9), knee, s * S * 0.12, 0, S * 0.08, 0, 0, s * 0.5);
    const shin = _bone(knee, 0, -S * 0.04, 0);
    sk[`shin_${s}`] = shin;
    _mesh(new THREE.CylinderGeometry(S * 0.1, S * 0.13, S * 0.46, 8), mat(col, 0.3, col, 0.22, 0.65), shin, 0, -S * 0.23, 0);
    // Caneleira de gelo
    _mesh(new THREE.BoxGeometry(S * 0.14, S * 0.32, S * 0.08), iceMat(0.65), shin, 0, -S * 0.2, S * 0.12);
    const foot = _bone(shin, s * S * 0.02, -S * 0.48, S * 0.05);
    sk[`foot_${s}`] = foot;
    _mesh(new THREE.BoxGeometry(S * 0.28, S * 0.08, S * 0.4), mat(col, 0.22, col, 0.25, 0.65), foot, 0, 0, S * 0.06);
  });
}

// ── ARACHNA PRIME — 8 patas articuladas ──────────────────────────
function _buildArachna(root, sk, S, col, genome, mat) {
  const dark = Math.max(0, col - 0x181818);

  // Abdômen
  const abdomen = _bone(root, 0, S * 0.08, -S * 0.3);
  sk.abdomen = abdomen;
  _mesh(new THREE.SphereGeometry(S * 0.44, 12, 10), mat(col, 0.48, col, 0.28, 0.42), abdomen);
  // Padrão teia no abdômen
  for (let i = 0; i < 4; i++) {
    _mesh(new THREE.TorusGeometry(S * (0.1 + i * 0.08), S * 0.01, 4, 20),
      mat(0xdddddd, 0.5, 0x888888, 0.4, 0.3), abdomen, 0, 0, 0, Math.PI * 0.5, 0, 0);
  }
  // Fiandeiras
  for (let i = 0; i < 3; i++) {
    _mesh(new THREE.CylinderGeometry(S * 0.04, S * 0.055, S * 0.12, 6),
      mat(col, 0.3, dark), abdomen, (i - 1) * S * 0.08, -S * 0.15, -S * 0.42, 0.6, 0, 0);
  }

  // Cefalotórax
  const ceph = _bone(root, 0, S * 0.26, S * 0.14);
  sk.ceph = ceph;
  _mesh(new THREE.SphereGeometry(S * 0.32, 10, 8), mat(col, 0.44, dark, 0.32, 0.45), ceph);
  // 8 olhos
  [[-0.2, 0.12], [0.2, 0.12], [-0.1, 0.22], [0.1, 0.22],
   [-0.22, 0.02], [0.22, 0.02], [-0.06, 0.06], [0.06, 0.06]
  ].forEach(([ex, ey]) => {
    _mesh(new THREE.SphereGeometry(S * 0.038, 6, 6), mat(0, 6, 0x22ff88, 0, 0, true, 0.9),
      ceph, ex * S, ey * S, S * 0.31);
  });
  // Quelíceras (presas)
  [-1, 1].forEach(s => {
    const chel = _bone(ceph, s * S * 0.1, -S * 0.06, S * 0.3);
    sk[`chel_${s}`] = chel;
    _mesh(new THREE.CylinderGeometry(S * 0.05, S * 0.07, S * 0.22, 6), mat(dark, 0.2, dark, 0.4, 0.5), chel, 0, -S * 0.11, 0, 0.5, 0, 0);
    _mesh(new THREE.ConeGeometry(S * 0.055, S * 0.2, 6), mat(0xaaaaaa, 1.5, 0x444444, 0.06, 0.92),
      chel, 0, -S * 0.22, S * 0.06, -0.3, 0, 0);
  });

  // 8 PATAS articuladas
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const li = i % 4;
    const baseAngle = (li / 4 - 0.5) * 1.7 + side * 0.08;
    const coxa = _bone(ceph, side * S * 0.3, S * (0.04 - li * 0.04), li * S * 0.06 - S * 0.08);
    sk[`coxa_${i}`] = coxa;
    _mesh(new THREE.CylinderGeometry(S * 0.04, S * 0.055, S * 0.42, 6), mat(col, 0.28, dark),
      coxa, side * S * 0.16, 0, 0, 0, 0, side * (0.8 + li * 0.18));
    const trochanter = _bone(coxa, side * S * (0.32 + li * 0.04), S * (0.04 - li * 0.04), 0);
    sk[`troch_${i}`] = trochanter;
    _mesh(new THREE.SphereGeometry(S * 0.055, 6, 6), mat(col, 0.3, dark), trochanter);
    const femur = _bone(trochanter, 0, 0, 0);
    sk[`femur_${i}`] = femur;
    _mesh(new THREE.CylinderGeometry(S * 0.033, S * 0.042, S * 0.5, 6), mat(col, 0.25, dark),
      femur, side * S * 0.16, -S * (0.06 + li * 0.04), 0, 0, 0, side * (1.15 + li * 0.1));
    const tibia = _bone(femur, side * S * (0.3 + li * 0.04), -S * (0.1 + li * 0.06), 0);
    sk[`tibia_${i}`] = tibia;
    _mesh(new THREE.CylinderGeometry(S * 0.026, S * 0.033, S * 0.52, 6), mat(col, 0.22, dark),
      tibia, side * S * 0.14, -S * (0.12 + li * 0.04), 0, 0, 0, side * (1.35 + li * 0.1));
    // Tarso (ponta)
    const tarsus = _bone(tibia, side * S * (0.24 + li * 0.04), -S * (0.22 + li * 0.04), 0);
    sk[`tarsus_${i}`] = tarsus;
    _mesh(new THREE.ConeGeometry(S * 0.024, S * 0.1, 5), mat(0xcccccc, 1.5, 0x555555, 0.06, 0.92),
      tarsus, 0, -S * 0.04, 0, 0, 0, side * Math.PI * 0.5);
  }
}

// ── VOID ENTITY — Entidade cósmica com fragmentos orbitando ──────
function _buildVoid(root, sk, S, col, genome, mat) {
  // Core semi-transparente
  _mesh(new THREE.SphereGeometry(S * 0.44, 16, 14),
    mat(0x000022, 1.5, 0x2200aa, 0, 0, true, 0.55), root, 0, S * 0.3, 0);
  _mesh(new THREE.SphereGeometry(S * 0.25, 12, 10),
    mat(0, 3.5, 0x5500cc, 0, 0, true, 0.8), root, 0, S * 0.3, 0);

  // Anel principal
  _mesh(new THREE.TorusGeometry(S * 0.38, S * 0.04, 8, 40),
    mat(0, 5, 0x8800ff, 0, 0, true, 0.9), root, 0, S * 0.3, 0);
  // Anel secundário inclinado
  _mesh(new THREE.TorusGeometry(S * 0.3, S * 0.025, 6, 32),
    mat(0, 3.5, 0xaa44ff, 0, 0, true, 0.75), root, 0, S * 0.3, 0, Math.PI * 0.5, 0, 0.8);

  // Tentáculos do vazio
  for (let t = 0; t < 6; t++) {
    const ta = t / 6 * Math.PI * 2;
    const tentacle = _bone(root, Math.cos(ta) * S * 0.15, S * 0.3, Math.sin(ta) * S * 0.15);
    sk[`tentacle_${t}`] = tentacle;
    for (let s = 0; s < 6; s++) {
      const st = s / 5;
      const seg = _bone(tentacle, Math.cos(ta) * S * st * 0.38, -st * S * 0.22 + Math.sin(st * 3) * S * 0.08, Math.sin(ta) * S * st * 0.38);
      sk[`tentSeg_${t}_${s}`] = seg;
      _mesh(new THREE.SphereGeometry(S * (0.06 - st * 0.042), 5, 5),
        mat(0, 2 + st * 2, 0x6600cc, 0, 0, true, 0.75 - st * 0.12), seg);
    }
  }

  // 12 Fragmentos orbitantes
  const orbColors = [0x8800ff, 0x4400cc, 0xaa44ff, 0x660099, 0x9933ff, 0x5500aa];
  const orbitFrags = [];
  for (let i = 0; i < 12; i++) {
    const orbAngle = i / 12 * Math.PI * 2;
    const orbR = S * (0.52 + (i % 3) * 0.12);
    const frag = new THREE.Mesh(
      new THREE.TetrahedronGeometry(S * (0.04 + (i % 4) * 0.016)),
      mat(0, 4 + (i % 3), orbColors[i % 6], 0, 0, true, 0.88)
    );
    frag.position.set(Math.cos(orbAngle) * orbR, S * 0.3 + Math.sin(i * 0.8) * S * 0.18, Math.sin(orbAngle) * orbR);
    frag.userData.orbitR = orbR;
    frag.userData.orbitA = orbAngle;
    frag.userData.orbitSpeed = 0.008 + (i % 5) * 0.003;
    frag.userData.orbitY = S * 0.3 + Math.sin(i * 0.8) * S * 0.18;
    frag.userData.orbitPhase = i * 0.6;
    root.add(frag);
    orbitFrags.push(frag);
    sk[`orbFrag_${i}`] = frag;
  }
  root.userData.orbitFrags = orbitFrags;

  // 3 "Olhos" estelares
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    _mesh(new THREE.SphereGeometry(S * 0.042, 7, 7),
      mat(0, 10, 0xffffff, 0, 0, true, 0.95), root,
      Math.cos(a) * S * 0.28, S * 0.33, Math.sin(a) * S * 0.28);
  }
}

// ── ECHO SPECTER — Bípede sonoro com membranas ───────────────────
function _buildEcho(root, sk, S, col, genome, mat) {
  const dark = Math.max(0, col - 0x181818);

  const torso = _bone(root, 0, S * 0.28, 0);
  sk.torso = torso;
  _mesh(new THREE.CylinderGeometry(S * 0.11, S * 0.14, S * 0.85, 8), mat(col, 0.42, col, 0.42, 0.22), torso);
  // Câmaras de ressonância (visíveis através do corpo translúcido)
  for (let i = 0; i < 5; i++) {
    _mesh(new THREE.TorusGeometry(S * 0.13, S * 0.014, 5, 14),
      mat(0, 5, col, 0, 0, true, 0.85), torso, 0, S * (0.2 - i * 0.14), 0, Math.PI * 0.5, 0, 0);
  }
  // Core sonoro brilhante
  _mesh(new THREE.SphereGeometry(S * 0.09, 8, 8),
    mat(0, 6.5, col, 0, 0, true, 0.75), torso, 0, S * 0.05, 0);

  // Pescoço longo
  const neck = _bone(torso, 0, S * 0.45, 0);
  sk.neck = neck;
  _mesh(new THREE.CylinderGeometry(S * 0.07, S * 0.1, S * 0.32, 7), mat(col, 0.38, dark, 0.4, 0.2), neck);
  const head = _bone(neck, 0, S * 0.2, 0);
  sk.head = head;
  _mesh(new THREE.SphereGeometry(S * 0.21, 10, 8), mat(col, 0.42, dark, 0.38, 0.22), head);
  // Orelhas/membranas enormes
  [-1, 1].forEach(s => {
    const ear = _bone(head, s * S * 0.22, S * 0.08, 0);
    sk[`ear_${s}`] = ear;
    // Cartilagem da orelha
    _mesh(new THREE.ConeGeometry(S * 0.06, S * 0.52, 6), mat(col, 0.3, dark, 0.4, 0.22), ear, 0, S * 0.26, 0, 0, 0, s * 0.55);
    // Membrana
    _mesh(new THREE.PlaneGeometry(S * 0.3, S * 0.45),
      mat(col, 0.4, col, 0.4, 0.1, true, 0.5), ear, s * S * 0.06, 0.04, 0, 0, 0, s * 0.5);
    // Veias na membrana
    for (let v = 0; v < 3; v++) {
      _mesh(new THREE.CylinderGeometry(S * 0.005, S * 0.005, S * 0.3, 3),
        mat(col, 1.5, col, 0.5, 0.1), ear, s * S * (0.04 + v * 0.04), S * 0.06, 0.01, 0, 0, s * (0.4 + v * 0.2));
    }
  });
  // Olhos grandes
  [-1, 1].forEach(s => {
    _mesh(new THREE.SphereGeometry(S * 0.057, 8, 8), mat(0, 8.5, 0x00ffff, 0, 0, true, 0.9), head, s * S * 0.12, S * 0.02, S * 0.21);
  });
  // Emissores sônicos (boca múltipla)
  for (let i = 0; i < 3; i++) {
    _mesh(new THREE.TorusGeometry(S * 0.055, S * 0.018, 5, 12),
      mat(0, 4.5, 0x4488ff, 0, 0, true, 0.88), head, 0, S * (-0.02 + i * 0.06), S * 0.21, Math.PI * 0.5, 0, 0);
  }

  // BRAÇOS ultrafinos com fins de eco
  [-1, 1].forEach(s => {
    const shoulder = _bone(torso, s * S * 0.2, S * 0.26, 0);
    sk[`shoulder_${s}`] = shoulder;
    const upperArm = _bone(shoulder, s * S * 0.04, 0, 0);
    sk[`upperArm_${s}`] = upperArm;
    _mesh(new THREE.CylinderGeometry(S * 0.035, S * 0.05, S * 0.5, 6), mat(col, 0.3, dark), upperArm, 0, -S * 0.25, 0);
    const elbow = _bone(upperArm, 0, -S * 0.52, 0);
    sk[`elbow_${s}`] = elbow;
    const forearm = _bone(elbow, 0, -S * 0.02, 0);
    sk[`forearm_${s}`] = forearm;
    _mesh(new THREE.CylinderGeometry(S * 0.028, S * 0.035, S * 0.46, 6), mat(col, 0.28, dark), forearm, 0, -S * 0.23, 0);
    // Fins de eco no antebraço
    for (let f = 0; f < 3; f++) {
      const fin = _bone(forearm, s * S * 0.06, -S * (0.08 + f * 0.12), 0);
      sk[`fin_${s}_${f}`] = fin;
      _mesh(new THREE.PlaneGeometry(S * 0.16, S * 0.28),
        mat(col, 0.55, col, 0.42, 0.1, true, 0.45), fin, 0, 0, 0, 0, f * 0.2, s * 0.48);
    }
    // Dedos compridos
    const hand = _bone(forearm, 0, -S * 0.48, 0);
    for (let f = 0; f < 4; f++) {
      _mesh(new THREE.CylinderGeometry(S * 0.016, S * 0.022, S * 0.18, 5), mat(col, 0.25, dark),
        hand, (f - 1.5) * S * 0.04, -S * 0.09, 0);
    }
  });

  // PERNAS de palafita
  [-1, 1].forEach(s => {
    const hip = _bone(torso, s * S * 0.13, -S * 0.44, 0);
    sk[`hip_${s}`] = hip;
    const thigh = _bone(hip, 0, -S * 0.02, 0);
    sk[`thigh_${s}`] = thigh;
    _mesh(new THREE.CylinderGeometry(S * 0.047, S * 0.037, S * 0.56, 6), mat(col, 0.24, dark), thigh, 0, -S * 0.28, 0);
    const knee = _bone(thigh, 0, -S * 0.58, 0);
    sk[`knee_${s}`] = knee;
    _mesh(new THREE.SphereGeometry(S * 0.055, 6, 6), mat(col, 0.28, dark), knee);
    const shin = _bone(knee, 0, -S * 0.03, 0);
    sk[`shin_${s}`] = shin;
    _mesh(new THREE.CylinderGeometry(S * 0.036, S * 0.047, S * 0.42, 6), mat(col, 0.22, dark), shin, 0, -S * 0.21, 0);
    const foot = _bone(shin, 0, -S * 0.44, 0);
    sk[`foot_${s}`] = foot;
    _mesh(new THREE.CylinderGeometry(S * 0.11, S * 0.09, S * 0.04, 8), mat(col, 0.2, dark), foot);
  });
}

// ── FERRO CARAPAX — Tanque com 6 patas e pinças ──────────────────
function _buildFerro(root, sk, S, col, genome, mat) {
  const dark = Math.max(0, col - 0x181818);

  const body = _bone(root, 0, S * 0.28, 0);
  sk.body = body;
  _mesh(new THREE.SphereGeometry(S * 0.52, 14, 12), mat(col, 0.38, col, 0.22, 0.68), body);
  // Carapaça segmentada (hexágonos simulados)
  for (let ring = 0; ring < 3; ring++) {
    const cnt = 6 + ring * 2, r = S * (0.54 + ring * 0.07);
    for (let i = 0; i < cnt; i++) {
      const a = i / cnt * Math.PI * 2;
      _mesh(new THREE.BoxGeometry(S * (0.26 - ring * 0.02), S * 0.08, S * (0.2 - ring * 0.02)),
        mat(col + 0x0a0a0a, 0.3, dark, 0.2, 0.72),
        body, Math.cos(a) * r, S * (0.18 - ring * 0.1), Math.sin(a) * r, 0, a, 0);
    }
  }
  // Cúpula dorsal
  _mesh(new THREE.SphereGeometry(S * 0.35, 10, 8), mat(col + 0x080808, 0.3, dark, 0.18, 0.75), body, 0, S * 0.32, 0);

  // Cabeça
  const head = _bone(body, 0, S * 0.24, S * 0.42);
  sk.head = head;
  _mesh(new THREE.SphereGeometry(S * 0.27, 10, 8), mat(dark, 0.28, dark, 0.3, 0.62), head);
  _mesh(new THREE.BoxGeometry(S * 0.34, S * 0.1, S * 0.06), mat(col, 0.18, dark, 0.35, 0.68), head, 0, S * 0.12, S * 0.28, -0.28, 0, 0);
  [-1, 1].forEach(s => {
    _mesh(new THREE.BoxGeometry(S * 0.076, S * 0.04, S * 0.04),
      mat(0, 5, 0xff8800, 0, 0, true, 0.9), head, s * S * 0.11, S * 0.05, S * 0.28);
  });

  // 6 PATAS articuladas (3 de cada lado)
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const li = i % 3;
    const baseZ = S * (0.22 - li * 0.22);
    const hip = _bone(body, side * S * 0.54, S * (-0.04 - li * 0.12), baseZ);
    sk[`legHip_${i}`] = hip;
    _mesh(new THREE.SphereGeometry(S * 0.1, 7, 7), mat(col, 0.28, dark, 0.3, 0.62), hip);
    const femur = _bone(hip, side * S * 0.04, -S * 0.02, 0);
    sk[`legFemur_${i}`] = femur;
    _mesh(new THREE.CylinderGeometry(S * 0.085, S * 0.075, S * 0.36, 7), mat(dark, 0.22, dark, 0.38, 0.58), femur, 0, -S * 0.18, 0);
    const tibia = _bone(femur, 0, -S * 0.38, 0);
    sk[`legTibia_${i}`] = tibia;
    _mesh(new THREE.SphereGeometry(S * 0.09, 6, 6), mat(col, 0.28, dark, 0.32, 0.62), tibia);
    const shin = _bone(tibia, side * S * 0.04, -S * 0.02, 0);
    _mesh(new THREE.CylinderGeometry(S * 0.07, S * 0.085, S * 0.3, 7), mat(dark, 0.2, dark, 0.4, 0.58), shin, 0, -S * 0.15, 0);
    // Ponta
    _mesh(new THREE.ConeGeometry(S * 0.06, S * 0.16, 6), mat(0xaaaaaa, 1.0, 0x555555, 0.1, 0.9),
      shin, side * S * 0.04, -S * 0.38, 0, 0, 0, side * Math.PI * 0.5);
  }

  // PINÇAS frontais
  [-1, 1].forEach(s => {
    const clawBase = _bone(body, s * S * 0.42, S * 0.12, S * 0.48);
    sk[`clawBase_${s}`] = clawBase;
    _mesh(new THREE.CylinderGeometry(S * 0.1, S * 0.08, S * 0.46, 8), mat(col, 0.32, dark, 0.26, 0.65), clawBase, 0, -S * 0.23, 0, 0, 0, -s * 0.55);
    const clawJoint = _bone(clawBase, s * S * 0.32, -S * 0.38, S * 0.06);
    sk[`clawJoint_${s}`] = clawJoint;
    _mesh(new THREE.SphereGeometry(S * 0.1, 7, 7), mat(col, 0.3, dark, 0.28, 0.65), clawJoint);
    // Garra superior
    const clawUpper = _bone(clawJoint, s * S * 0.06, S * 0.04, S * 0.08);
    sk[`clawUpper_${s}`] = clawUpper;
    _mesh(new THREE.ConeGeometry(S * 0.09, S * 0.34, 6), mat(0xbbbbbb, 1.2, 0x444444, 0.06, 0.92),
      clawUpper, 0, 0, S * 0.17, s * 0.25, 0, -s * 0.32);
    // Garra inferior (abre/fecha)
    const clawLower = _bone(clawJoint, s * S * 0.04, -S * 0.04, S * 0.06);
    sk[`clawLower_${s}`] = clawLower;
    _mesh(new THREE.ConeGeometry(S * 0.09, S * 0.34, 6), mat(0xbbbbbb, 1.2, 0x444444, 0.06, 0.92),
      clawLower, 0, 0, S * 0.17, -s * 0.28, 0, s * 0.35);
  });
}

// ══════════════════════════════════════════════════════════════════
//  ANIMAÇÃO SKELETAL — Loop por criatura
// ══════════════════════════════════════════════════════════════════
function _startCreatureAnim(root, sk, archetype, genome, S) {
  const baseY = root.userData._baseY || root.position.y;
  let f = 0;

  const anim = () => {
    if (!root.parent) return;
    f++;

    // ── Respiração / flutuação universal ──
    root.position.y = baseY + Math.sin(f * 0.018) * 0.14;

    // ── Piscar dos olhos (pulso emissivo) ──
    root.traverse(child => {
      if (child.isMesh && child.material?.emissiveIntensity > 3 && child.material?.color?.r < 0.05) {
        if (!child._ei0) child._ei0 = child.material.emissiveIntensity;
        child.material.emissiveIntensity = child._ei0 + Math.sin(f * 0.15 + child.id * 0.3) * 2.2;
      }
    });

    // ── Fragmentos orbitantes (Void) ──
    const frags = root.userData.orbitFrags;
    if (frags) frags.forEach(frag => {
      frag.userData.orbitA += frag.userData.orbitSpeed;
      frag.position.x = Math.cos(frag.userData.orbitA) * frag.userData.orbitR;
      frag.position.z = Math.sin(frag.userData.orbitA) * frag.userData.orbitR;
      frag.position.y = frag.userData.orbitY + Math.sin(f * 0.028 + frag.userData.orbitPhase) * S * 0.14;
      frag.rotation.x += 0.04; frag.rotation.y += 0.06;
    });

    // ── Animações específicas por arquétipo ──
    if (archetype.traits.spikes || archetype.name === 'Venom Apex') {
      // Caminhar: oscilação das pernas e braços
      [1, -1].forEach(s => {
        const phase = s * Math.PI;
        if (sk[`thigh_${s}`])   sk[`thigh_${s}`].rotation.x   = Math.sin(f * 0.04 + phase) * 0.22;
        if (sk[`shin_${s}`])    sk[`shin_${s}`].rotation.x    = Math.abs(Math.sin(f * 0.04 + phase)) * 0.35;
        if (sk[`upperArm_${s}`]) sk[`upperArm_${s}`].rotation.x = Math.sin(f * 0.04 - phase) * 0.25;
        if (sk[`forearm_${s}`]) sk[`forearm_${s}`].rotation.x  = Math.sin(f * 0.04 - phase) * 0.18;
      });
      // Cauda serpentina
      for (let i = 0; i < 8; i++) {
        if (sk[`tail_${i}`]) {
          sk[`tail_${i}`].rotation.y = Math.sin(f * 0.05 + i * 0.55) * (0.18 + i * 0.02);
          sk[`tail_${i}`].rotation.x = Math.sin(f * 0.04 + i * 0.4) * 0.1;
        }
      }
      // Mandíbula
      if (sk.jaw) sk.jaw.rotation.x = Math.max(0, Math.sin(f * 0.03) * 0.25);
      // Pescoço balança
      if (sk.neck) sk.neck.rotation.z = Math.sin(f * 0.025) * 0.06;
      if (sk.head) sk.head.rotation.y = Math.sin(f * 0.02) * 0.1;
    }

    if (archetype.traits.bulk) {
      // Respiração pesada
      if (sk.torso) sk.torso.scale.x = 1 + Math.sin(f * 0.02) * 0.025;
      if (sk.torso) sk.torso.scale.z = 1 + Math.sin(f * 0.02) * 0.025;
      // Caminhar lento colossal
      [1, -1].forEach(s => {
        const phase = s * Math.PI;
        if (sk[`thigh_${s}`])  sk[`thigh_${s}`].rotation.x  = Math.sin(f * 0.025 + phase) * 0.16;
        if (sk[`shin_${s}`])   sk[`shin_${s}`].rotation.x   = Math.abs(Math.sin(f * 0.025 + phase)) * 0.22;
        if (sk[`upperArm_${s}`]) sk[`upperArm_${s}`].rotation.x = Math.sin(f * 0.025 - phase) * 0.14;
        if (sk[`forearm_${s}`])  sk[`forearm_${s}`].rotation.x  = Math.sin(f * 0.025 - phase) * 0.1;
      });
      if (sk.neck) sk.neck.rotation.z = Math.sin(f * 0.02) * 0.04;
      if (sk.head) sk.head.rotation.y = Math.sin(f * 0.015) * 0.06;
    }

    if (archetype.traits.fire) {
      // Asas batem lentamente
      [1, -1].forEach(s => {
        if (sk[`wing_${s}`]) {
          sk[`wing_${s}`].rotation.z = s * (0.3 + Math.sin(f * 0.05) * 0.25);
          sk[`wing_${s}`].rotation.x = Math.sin(f * 0.05 + s) * 0.12;
        }
      });
      // Chama da coroa
      if (sk.crown_0) for (let i = 0; i < 5; i++) {
        if (sk[`crown_${i}`]) {
          sk[`crown_${i}`].rotation.z = Math.sin(f * 0.08 + i * 0.8) * 0.12;
          sk[`crown_${i}`].scale.y = 0.9 + Math.sin(f * 0.1 + i) * 0.15;
        }
      }
      // Pescoço ondulante (cobra)
      for (let i = 0; i < 5; i++) {
        if (sk[`neck_${i}`]) {
          sk[`neck_${i}`].rotation.y = Math.sin(f * 0.03 + i * 0.7) * 0.12;
          sk[`neck_${i}`].rotation.x = Math.sin(f * 0.025 + i * 0.5) * 0.08;
        }
      }
      // Cauda
      for (let i = 0; i < 9; i++) {
        if (sk[`tail_${i}`]) sk[`tail_${i}`].rotation.y = Math.sin(f * 0.045 + i * 0.6) * (0.14 + i * 0.018);
      }
      // Boca abre ao rugir
      if (sk.mouth) sk.mouth.rotation.x = Math.max(0, Math.sin(f * 0.02) * 0.3);
      // 4 pernas
      [1, -1].forEach(s => [1, -1].forEach(fwd => {
        const k = `${s}_${fwd}`;
        if (sk[`thigh_${k}`]) sk[`thigh_${k}`].rotation.x = Math.sin(f * 0.04 + (s + fwd) * 0.8) * 0.2;
      }));
    }

    if (archetype.traits.ice) {
      // Espículas pulsam
      for (let i = 0; i < 7; i++) {
        if (sk[`spike_${i}`]) {
          sk[`spike_${i}`].scale.y = 0.88 + Math.sin(f * 0.07 + i * 0.6) * 0.14;
        }
      }
      // Caminhar
      [1, -1].forEach(s => {
        const phase = s * Math.PI;
        if (sk[`thigh_${s}`])  sk[`thigh_${s}`].rotation.x  = Math.sin(f * 0.035 + phase) * 0.2;
        if (sk[`shin_${s}`])   sk[`shin_${s}`].rotation.x   = Math.abs(Math.sin(f * 0.035 + phase)) * 0.3;
        if (sk[`upperArm_${s}`]) sk[`upperArm_${s}`].rotation.x = Math.sin(f * 0.035 - phase) * 0.22;
      });
    }

    if (archetype.traits.web) {
      // 8 patas ondulam
      for (let i = 0; i < 8; i++) {
        const ph = i / 8 * Math.PI * 2;
        const side = i < 4 ? 1 : -1;
        if (sk[`femur_${i}`])   sk[`femur_${i}`].rotation.z   = Math.sin(f * 0.06 + ph) * 0.2 * side;
        if (sk[`tibia_${i}`])   sk[`tibia_${i}`].rotation.z   = Math.sin(f * 0.06 + ph + 0.5) * 0.28 * side;
        if (sk[`tarsus_${i}`])  sk[`tarsus_${i}`].rotation.z  = Math.sin(f * 0.06 + ph + 1.0) * 0.18 * side;
      }
      // Quelíceras mastigando
      [1, -1].forEach(s => {
        if (sk[`chel_${s}`]) sk[`chel_${s}`].rotation.x = Math.sin(f * 0.08) * 0.2;
      });
      // Abdômen pulsa
      if (sk.abdomen) {
        sk.abdomen.scale.x = 1 + Math.sin(f * 0.03) * 0.04;
        sk.abdomen.scale.z = 1 + Math.sin(f * 0.03) * 0.04;
      }
    }

    if (archetype.traits.sonic) {
      // Membranas ondulam
      for (let s of [1, -1]) {
        if (sk[`ear_${s}`]) sk[`ear_${s}`].rotation.z = s * (0.4 + Math.sin(f * 0.06) * 0.12);
        for (let f2 = 0; f2 < 3; f2++) {
          if (sk[`fin_${s}_${f2}`]) {
            sk[`fin_${s}_${f2}`].scale.y = 1 + Math.sin(f * 0.1 + f2 * 1.2) * 0.1;
            sk[`fin_${s}_${f2}`].rotation.y = Math.sin(f * 0.08 + f2 * 0.8) * 0.12;
          }
        }
      }
      // Caminhar em palafitas
      [1, -1].forEach(s => {
        const phase = s * Math.PI;
        if (sk[`thigh_${s}`]) sk[`thigh_${s}`].rotation.x = Math.sin(f * 0.045 + phase) * 0.25;
        if (sk[`shin_${s}`])  sk[`shin_${s}`].rotation.x  = Math.abs(Math.sin(f * 0.045 + phase)) * 0.3;
        if (sk[`upperArm_${s}`]) sk[`upperArm_${s}`].rotation.x = Math.sin(f * 0.045 - phase) * 0.3;
        if (sk[`forearm_${s}`])  sk[`forearm_${s}`].rotation.x  = Math.sin(f * 0.045 - phase) * 0.2;
      });
    }

    if (archetype.traits.shell) {
      // Pinças abrem e fecham
      [1, -1].forEach(s => {
        if (sk[`clawUpper_${s}`]) sk[`clawUpper_${s}`].rotation.y  =  s * (0.3 + Math.abs(Math.sin(f * 0.04)) * 0.5);
        if (sk[`clawLower_${s}`]) sk[`clawLower_${s}`].rotation.y  = -s * (0.3 + Math.abs(Math.sin(f * 0.04)) * 0.5);
        if (sk[`clawBase_${s}`]) {
          sk[`clawBase_${s}`].rotation.x = Math.sin(f * 0.03 + s) * 0.12;
          sk[`clawBase_${s}`].rotation.z = Math.sin(f * 0.025 - s) * 0.08;
        }
      });
      // 6 patas ondulam
      for (let i = 0; i < 6; i++) {
        const ph = i / 6 * Math.PI * 2;
        if (sk[`legFemur_${i}`]) sk[`legFemur_${i}`].rotation.z = Math.sin(f * 0.05 + ph) * 0.2;
        if (sk[`legTibia_${i}`]) sk[`legTibia_${i}`].rotation.z = Math.sin(f * 0.05 + ph + 0.7) * 0.25;
      }
    }

    if (archetype.traits.cosmic) {
      // Tentáculos ondulantes
      for (let t = 0; t < 6; t++) {
        for (let s = 0; s < 6; s++) {
          if (sk[`tentSeg_${t}_${s}`]) {
            sk[`tentSeg_${t}_${s}`].position.x += Math.sin(f * 0.04 + t * 1.1 + s * 0.7) * 0.004;
            sk[`tentSeg_${t}_${s}`].position.z += Math.cos(f * 0.04 + t * 1.1 + s * 0.7) * 0.004;
          }
        }
        if (sk[`tentacle_${t}`]) {
          sk[`tentacle_${t}`].rotation.y = Math.sin(f * 0.02 + t * 1.2) * 0.18;
          sk[`tentacle_${t}`].rotation.x = Math.sin(f * 0.018 + t * 0.9) * 0.12;
        }
      }
    }

    markDirty(1);
    requestAnimationFrame(anim);
  };

  requestAnimationFrame(anim);
}

function triggerSkillAnim(obj) {
  const orig = obj.scale.clone(); let f = 0;
  const a = () => {
    f++;
    if (f < 8)       obj.scale.setScalar(orig.x * (1 + f * 0.026));
    else if (f < 18) obj.scale.setScalar(orig.x * (1.18 - (f - 8) * 0.022));
    else { obj.scale.copy(orig); markDirty(2); return; }
    markDirty(2); requestAnimationFrame(a);
  }; requestAnimationFrame(a);
  const arch = obj.userData._archetype;
  screenFlash(
    arch?.traits?.fire ? 'rgba(255,100,0,.5)' :
    arch?.traits?.ice  ? 'rgba(100,200,255,.35)' :
    arch?.traits?.cosmic ? 'rgba(180,0,255,.45)' : 'rgba(150,120,255,.35)', 110);
}

  // kept for backward compat — actual animation is started inside each builder
  // Only add extra per-frame tweaks if mixer already running
  if(group.userData._mixer) return;
  _startMixer(group, archetype, group.userData._S || 1);
}
  {id:'dash',   name:'Quantum Dash',  icon:'dash',     desc:'Teleporte curta distância',   color:'#c4b5fd',eff:'blink'},
  {id:'poison', name:'Acid Spray',    icon:'acid',     desc:'Spray ácido corrosivo',       color:'#88ff44',eff:'acid'},
  {id:'roar',   name:'Sonic Burst',   icon:'wave',     desc:'Onda de choque sônica',       color:'#ffd95c',eff:'wave'},
  {id:'cosmos', name:'Void Pulse',    icon:'void',     desc:'ESPECIAL: Pulso dimensional', color:'#ff44ff',eff:'void',   special:true},
  {id:'ulti',   name:'Ultimate Form', icon:'star',     desc:'ESPECIAL: Forma Suprema',     color:'#ff8800',eff:'ulti',   special:true},
];

function generateSkills(genome,archetype){
  const reg=SKILL_TMPLS.filter(s=>!s.special).sort(()=>Math.random()-.5).slice(0,5);
  const sp=SKILL_TMPLS.filter(s=>s.special);
  return[...reg,...sp].map(t=>({...t,rage:1+Math.floor(Math.random()*4),frame:Math.floor(Math.random()*120)}));
}

function updateSkillToggle(obj){
  const btn=$('nh-sk-toggle');if(!btn)return;
  if(obj?.userData?.isEvolved&&obj?.userData?.evolvedSkills){btn.classList.remove('hidden');btn._obj=obj;}
  else{btn.classList.add('hidden');$('nh-skill-panel')?.classList.add('hidden');$('nh-skill-cfg')?.classList.add('hidden');}
}

function showSkillPanel(obj){
  const skills=obj.userData.evolvedSkills,arcName=obj.userData.archetypeName||'Evolved',arcIcon=obj.userData.archetypeIcon||'star';
  const sp=$('nh-skill-panel');if(!sp)return;
  const RC=['#444','#ff5252','#ff8800','#ffd95c','#4cefac','#a78bfa'];
  sp.innerHTML=`
  <div class="nh-sp-hdr"><div class="nh-sp-icon">${ico(arcIcon,16)}</div><h4>${arcName}</h4>
    <button class="nh-x" id="nh-sp-close">${ico('close',12)}</button></div>
  ${skills.map((sk,idx)=>`
  <div class="nh-sk-row${sk.special?' nh-sk-special':''}" data-i="${idx}">
    <div class="nh-sk-ico" style="background:${sk.color}22;color:${sk.color}">${ico(sk.icon,14)}</div>
    <div class="nh-sk-info"><div class="nh-sk-name" style="color:${sk.color}">${sk.name}</div>
      <div class="nh-sk-desc">${sk.desc}</div>
      <div class="nh-sk-rage" style="color:${RC[sk.rage]}">
        ${Array.from({length:5},(_,i)=>`<span class="${i<sk.rage?'on':''}" style="${i<sk.rage?'background:'+RC[sk.rage]:''}"></span>`).join('')}
      </div></div>
    <button class="nh-sk-cfg" data-c="${idx}">${ico('gear',10)}</button>
  </div>${sk.special&&idx===skills.length-2?'<div class="nh-sk-divider"></div>':''}`).join('')}`;
  sp.classList.remove('hidden');
  $('nh-sp-close')?.addEventListener('click',()=>{sp.classList.add('hidden');$('nh-skill-cfg')?.classList.add('hidden');});
  sp.querySelectorAll('.nh-sk-row').forEach(row=>{
    row.addEventListener('click',e=>{if(e.target.closest('.nh-sk-cfg'))return;
      const idx=+row.dataset.i;row.classList.add('burst');setTimeout(()=>row.classList.remove('burst'),400);
      triggerSkillAnim(obj);fireSkill(obj,skills[idx]);});});
  sp.querySelectorAll('.nh-sk-cfg').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();openSkillCfg(obj,skills,+btn.dataset.c);});});
}

function openSkillCfg(obj,skills,idx){
  const sk=skills[idx];const cfg=$('nh-skill-cfg');if(!cfg)return;
  const RC=['#444','#ff5252','#ff8800','#ffd95c','#4cefac','#a78bfa'];
  const COLS=['#5f7fff','#4cefac','#ffd95c','#ff5252','#cc80ff','#ff8060','#00ddff','#ffaa00','#88ff44','#ffffff'];
  cfg.innerHTML=`
  <div class="nh-cfg-hdr"><span style="color:${sk.color}">${ico(sk.icon,14)}</span><h5>${sk.name}</h5><button class="nh-x" id="nh-cfg-x">${ico('close',11)}</button></div>
  <div class="nh-cfg-sec"><div class="nh-cfg-lbl">Rage (${sk.rage}/5)</div>
    <div class="nh-cfg-rage" id="nh-cfg-rage">${Array.from({length:5},(_,i)=>`<div class="nh-cfg-dot" data-r="${i+1}" style="background:${i<sk.rage?RC[sk.rage]:'rgba(255,255,255,.1)'};box-shadow:${i<sk.rage?'0 0 6px '+RC[sk.rage]:'none'}"></div>`).join('')}</div></div>
  <div class="nh-cfg-sec"><div class="nh-cfg-lbl">Cor</div>
    <div class="nh-cfg-colors">${COLS.map(c=>`<div class="nh-cfg-swatch${sk.color===c?' active':''}" data-c="${c}" style="background:${c}"></div>`).join('')}</div></div>
  <div class="nh-cfg-sec"><div class="nh-cfg-lbl">Frame</div>
    <div class="nh-cfg-row"><input type="number" id="nh-cfg-frame" value="${sk.frame}" min="0" max="999"><span style="font-size:10px;color:rgba(255,255,255,.3)">frame</span></div></div>
  <button class="nh-cfg-apply" id="nh-cfg-ok">${ico('skills',12)} Aplicar</button>`;
  cfg.classList.remove('hidden');
  $('nh-cfg-x')?.addEventListener('click',()=>cfg.classList.add('hidden'));
  cfg.querySelectorAll('.nh-cfg-dot').forEach(d=>{d.addEventListener('click',()=>{sk.rage=+d.dataset.r;d.closest('#nh-cfg-rage').querySelectorAll('.nh-cfg-dot').forEach((dot,i)=>{dot.style.background=i<sk.rage?RC[sk.rage]:'rgba(255,255,255,.1)';dot.style.boxShadow=i<sk.rage?`0 0 6px ${RC[sk.rage]}`:'none';});showSkillPanel(obj);});});
  cfg.querySelectorAll('.nh-cfg-swatch').forEach(sw=>{sw.addEventListener('click',()=>{sk.color=sw.dataset.c;cfg.querySelectorAll('.nh-cfg-swatch').forEach(s=>s.classList.remove('active'));sw.classList.add('active');});});
  $('nh-cfg-ok')?.addEventListener('click',()=>{sk.frame=parseInt($('nh-cfg-frame')?.value)||0;showSkillPanel(obj);cfg.classList.add('hidden');toast(`${sk.name} atualizada!`,1600);});
}

function fireSkill(obj,skill){
  const scene=getScene();if(!scene||!obj)return;
  const pos=getWorldPos(obj);const col=parseInt(skill.color.replace('#',''),16);
  switch(skill.eff){
    case'lightning':sfmLightning(scene,pos,col,skill.rage);break;
    case'shield':sfmShield(scene,pos,col,obj,skill.rage);break;
    case'blink':sfmBlink(scene,pos,col,obj);break;
    case'acid':sfmAcid(scene,pos,col,skill.rage);break;
    case'wave':sfmWave(scene,pos,col,skill.rage);break;
    case'void':sfmVoid(scene,pos,col,skill.rage);break;
    case'ulti':sfmUlti(scene,pos,obj,skill.rage);break;}
  toast(`${skill.name} (Rage ${skill.rage})`,1400);markDirty(4);
}

// ══════════════════════════════════════════════════════════════════
//  SFM-STYLE PARTICLE EFFECTS
// ══════════════════════════════════════════════════════════════════
function sfmSparkles(pos,color=0xffd700,count=60,spd=3){
  const scene=getScene();if(!scene)return;
  const n=count;const pa=new Float32Array(n*3);const vels=[];
  for(let i=0;i<n;i++){pa[i*3]=pos.x;pa[i*3+1]=pos.y;pa[i*3+2]=pos.z;vels.push(new THREE.Vector3((Math.random()-.5)*spd,Math.random()*spd*.9+spd*.1,(Math.random()-.5)*spd));}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pa,3));
  const mat=new THREE.PointsMaterial({color,size:.22,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending});
  const pts=new THREE.Points(geo,mat);scene.add(pts);
  // Glow halo spawner
  const hpa=new Float32Array(Math.ceil(n/4)*3);for(let i=0;i<hpa.length/3;i++){hpa[i*3]=pos.x;hpa[i*3+1]=pos.y;hpa[i*3+2]=pos.z;}
  const hgeo=new THREE.BufferGeometry();hgeo.setAttribute('position',new THREE.BufferAttribute(hpa,3));
  const hmat=new THREE.PointsMaterial({color,size:.65,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending});
  const hpts=new THREE.Points(hgeo,hmat);scene.add(hpts);
  let t=0;
  const tick=()=>{t+=.016;const p=geo.attributes.position.array,hp=hgeo.attributes.position.array;
    for(let i=0;i<n;i++){p[i*3]+=vels[i].x*.016;p[i*3+1]+=vels[i].y*.016;p[i*3+2]+=vels[i].z*.016;vels[i].y-=.06;}
    for(let i=0;i<hp.length/3;i++){hp[i*3]=p[i*4*3]||pos.x;hp[i*3+1]=p[i*4*3+1]||pos.y;hp[i*3+2]=p[i*4*3+2]||pos.z;}
    geo.attributes.position.needsUpdate=true;hgeo.attributes.position.needsUpdate=true;
    mat.opacity=Math.max(0,1-t/1.8);hmat.opacity=Math.max(0,.55-t/1.5);
    if(t<1.8){requestAnimationFrame(tick);markDirty(2);}
    else{scene.remove(pts);scene.remove(hpts);geo.dispose();mat.dispose();hgeo.dispose();hmat.dispose();}};
  requestAnimationFrame(tick);}

function sfmExplosion(pos,color=0x4cefac){
  const scene=getScene();if(!scene)return;
  sfmSparkles(pos,color,140,8);
  // Ring shockwave
  for(let ring=0;ring<3;ring++){
    const geo=new THREE.TorusGeometry(.05,S*.04||.04,6,40);
    const mat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:4,transparent:true,opacity:.9,roughness:0,blending:THREE.AdditiveBlending});
    const torus=new THREE.Mesh(geo,mat);torus.position.copy(pos);torus.rotation.x=Math.PI*.5;scene.add(torus);
    let t=0,delay=ring*.1;
    const a=()=>{t+=.018;if(t<delay){requestAnimationFrame(a);return;}const lt=t-delay;torus.scale.setScalar(1+lt*12);mat.opacity=Math.max(0,.9-lt*1.2);markDirty(2);
      if(lt<.75)requestAnimationFrame(a);else{scene.remove(torus);geo.dispose();mat.dispose();}};requestAnimationFrame(a);}
  // Core burst sphere
  const bgeo=new THREE.SphereGeometry(.08,10,10);const bmat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:6,roughness:0,transparent:true,opacity:1,blending:THREE.AdditiveBlending});
  const burst=new THREE.Mesh(bgeo,bmat);burst.position.copy(pos);scene.add(burst);
  let bt=0;const ba=()=>{bt+=.02;burst.scale.setScalar(1+bt*18);bmat.opacity=Math.max(0,1-bt*2.2);markDirty(2);if(bt<.5)requestAnimationFrame(ba);else{scene.remove(burst);bgeo.dispose();bmat.dispose();}};requestAnimationFrame(ba);
  screenFlash(`rgba(${(color>>16)&255},${(color>>8)&255},${color&255},.6)`,180);}

function sfmLightning(scene,pos,col,rage){
  for(let i=0;i<8+rage*2;i++){
    const dir=new THREE.Vector3((Math.random()-.5)*4,(Math.random()-.5)*4,(Math.random()-.5)*4).normalize();
    const pts=[pos.clone()];let p=pos.clone();
    for(let s=0;s<6;s++){const nx=p.clone().addScaledVector(dir,.5+Math.random()*.5).add(new THREE.Vector3((Math.random()-.5)*.3,(Math.random()-.5)*.3,(Math.random()-.5)*.3));pts.push(nx);p=nx;}
    const geo=new THREE.BufferGeometry().setFromPoints(pts);
    const mat=new THREE.LineBasicMaterial({color:col,transparent:true,opacity:1,blending:THREE.AdditiveBlending});
    const line=new THREE.Line(geo,mat);scene.add(line);
    let t=0;const a=()=>{t+=.04;mat.opacity=1-t;markDirty(2);if(t<1)requestAnimationFrame(a);else{scene.remove(line);geo.dispose();mat.dispose();}};requestAnimationFrame(a);}
  sfmSparkles(pos,col,40+rage*15,5);screenFlash(`rgba(${(col>>16)&255},${(col>>8)&255},${col&255},.4)`,80);}

function sfmShield(scene,pos,col,obj,rage){
  const geo=new THREE.SphereGeometry(1.2+rage*.2,20,16);
  const mat=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:2,transparent:true,opacity:.28,side:THREE.DoubleSide,roughness:0,blending:THREE.AdditiveBlending});
  const shield=new THREE.Mesh(geo,mat);shield.position.copy(pos);scene.add(shield);
  // Hex pattern overlay
  const hgeo=new THREE.SphereGeometry(1.25+rage*.2,8,8);
  const hmat=new THREE.MeshBasicMaterial({color:col,wireframe:true,transparent:true,opacity:.15,blending:THREE.AdditiveBlending});
  const hex=new THREE.Mesh(hgeo,hmat);hex.position.copy(pos);scene.add(hex);
  let t=0;
  const a=()=>{t+=.015;shield.scale.setScalar(1+Math.sin(t*4)*.05);shield.rotation.y+=.03;hex.rotation.y+=.05;hex.rotation.x+=.02;
    const fade=t<.3?t/.3:t>1.5?1-(t-1.5)/.5:1;mat.opacity=.28*fade;hmat.opacity=.15*fade;markDirty(2);
    if(t<2)requestAnimationFrame(a);else{scene.remove(shield);scene.remove(hex);geo.dispose();mat.dispose();hgeo.dispose();hmat.dispose();}};requestAnimationFrame(a);}

function sfmBlink(scene,pos,col,obj){
  sfmSparkles(pos,col,50,4);
  const delta=new THREE.Vector3((Math.random()-.5)*4,0,(Math.random()-.5)*4);obj.position.add(delta);
  setTimeout(()=>{sfmSparkles(getWorldPos(obj),col,50,4);markDirty(3);},80);}

function sfmAcid(scene,pos,col,rage){
  for(let i=0;i<15+rage*6;i++){
    const geo=new THREE.SphereGeometry(.06+Math.random()*.06,5,5);
    const mat=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:2,transparent:true,opacity:.85,blending:THREE.AdditiveBlending});
    const drop=new THREE.Mesh(geo,mat);drop.position.copy(pos);
    const vel=new THREE.Vector3((Math.random()-.5)*3,Math.random()*2+.5,(Math.random()-.5)*3);scene.add(drop);
    let t=0;const a=()=>{t+=.016;drop.position.addScaledVector(vel,.016);vel.y-=.1;
      // Splat when hitting ground
      if(drop.position.y<pos.y-.5){drop.position.y=pos.y-.5;vel.y=0;vel.x*=.3;vel.z*=.3;}
      mat.opacity=Math.max(0,.85-t*.45);markDirty(2);if(t<2)requestAnimationFrame(a);else{scene.remove(drop);geo.dispose();mat.dispose();}};requestAnimationFrame(a);}
  sfmSparkles(pos,col,20+rage*8,2);}

function sfmWave(scene,pos,col,rage){
  for(let ring=0;ring<3+rage;ring++){
    const geo=new THREE.TorusGeometry(.1,.04,6,40);
    const mat=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:2.5,transparent:true,opacity:.9,roughness:0,blending:THREE.AdditiveBlending});
    const torus=new THREE.Mesh(geo,mat);torus.position.copy(pos);torus.rotation.x=Math.PI*.5;scene.add(torus);
    let t=0,delay=ring*.12;
    const a=()=>{t+=.02;if(t<delay){requestAnimationFrame(a);return;}const lt=t-delay;torus.scale.setScalar(1+lt*9);mat.opacity=Math.max(0,.9-lt);markDirty(2);
      if(lt<1)requestAnimationFrame(a);else{scene.remove(torus);geo.dispose();mat.dispose();}};requestAnimationFrame(a);}}

function sfmVoid(scene,pos,col,rage){
  const geo=new THREE.SphereGeometry(.3,16,14);
  const mat=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:6,transparent:true,opacity:.9,roughness:0,blending:THREE.AdditiveBlending});
  const orb=new THREE.Mesh(geo,mat);orb.position.copy(pos);scene.add(orb);
  // Orbiting shards
  for(let i=0;i<6;i++){const ga=new THREE.TetrahedronGeometry(.08);const ma=new THREE.MeshStandardMaterial({color:0,emissive:col,emissiveIntensity:4,roughness:0,blending:THREE.AdditiveBlending});const sh=new THREE.Mesh(ga,ma);sh.userData.ang=i/6*Math.PI*2;sh.userData.r=.4+rage*.1;sh.position.copy(pos);scene.add(sh);
    let t2=0;const a2=()=>{t2+=.025;sh.userData.ang+=.08;sh.position.x=pos.x+Math.cos(sh.userData.ang)*sh.userData.r;sh.position.z=pos.z+Math.sin(sh.userData.ang)*sh.userData.r;sh.position.y=pos.y+Math.sin(t2)*sh.userData.r*.4;sh.rotation.x+=.05;sh.rotation.y+=.07;ma.opacity=Math.max(0,.9-t2*.7);markDirty(2);if(t2<1.3)requestAnimationFrame(a2);else{scene.remove(sh);ga.dispose();ma.dispose();}};requestAnimationFrame(a2);}
  let t=0;const a=()=>{t+=.018;const s=1+t*(5+rage*2);orb.scale.setScalar(s);mat.opacity=Math.max(0,.9-t*.6);mat.emissiveIntensity=6-t*4;markDirty(2);
    if(t<1.5)requestAnimationFrame(a);else{scene.remove(orb);geo.dispose();mat.dispose();sfmSparkles(pos,0xaa00ff,80,6);}};requestAnimationFrame(a);
  screenFlash(`rgba(${(col>>16)&255},0,255,.5)`,150);}

function sfmUlti(scene,pos,obj,rage){
  const col=0xff8800;
  const ageo=new THREE.SphereGeometry(1.5+rage*.3,16,14);
  const amat=new THREE.MeshStandardMaterial({color:col,emissive:0xff4400,emissiveIntensity:3,transparent:true,opacity:.35,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  const aura=new THREE.Mesh(ageo,amat);aura.position.copy(pos);scene.add(aura);
  // Spiral sparks
  for(let i=0;i<24;i++){const t0=i/24;const sp=new THREE.Mesh(new THREE.SphereGeometry(.06,4,4),new THREE.MeshStandardMaterial({color:0,emissive:0xff8800,emissiveIntensity:5,roughness:0,blending:THREE.AdditiveBlending}));sp.position.copy(pos);const ang=t0*Math.PI*6,r=.3+t0*1.8;sp.position.x+=Math.cos(ang)*r;sp.position.z+=Math.sin(ang)*r;sp.position.y+=t0*2;scene.add(sp);let st=0;const sa=()=>{st+=.02;sp.material.opacity=Math.max(0,1-st*.8);markDirty(2);if(st<1.3)requestAnimationFrame(sa);else{scene.remove(sp);sp.geometry.dispose();sp.material.dispose();}};requestAnimationFrame(sa);}
  let t=0;const a=()=>{t+=.01;aura.rotation.y+=.06;aura.rotation.x+=.025;aura.scale.setScalar(1+Math.sin(t*6)*.08);amat.emissiveIntensity=2.5+Math.sin(t*10)*1.5;const fade=t<.3?t/.3:t>2.5?1-(t-2.5)/.5:1;amat.opacity=.35*fade;markDirty(2);
    if(t<3)requestAnimationFrame(a);else{scene.remove(aura);ageo.dispose();amat.dispose();}};
  sfmSparkles(pos,col,120,7);requestAnimationFrame(a);screenFlash('rgba(255,140,0,.6)',200);}

// ══════════════════════════════════════════════════════════════════
//  FUSION
// ══════════════════════════════════════════════════════════════════
function getSelectedPair(){const sel=window.selectedObjects?[...window.selectedObjects]:[];const ao=getAO();return[...new Set([...sel,...(ao?[ao]:[])])].filter(o=>o&&window.sceneObjects?.includes(o)).slice(0,2);}

function handleFusionDNA(){
  const pair=getSelectedPair();if(pair.length<2){toast('Selecione 2 objetos (Ctrl+clique ou duplo-toque no mobile).');return;}
  closeHelper();const[a,b]=pair;const scene=getScene();if(!scene)return;
  const posA=getWorldPos(a),posB=getWorldPos(b),mid=posA.clone().lerp(posB,.5);
  sfmSparkles(posA,0x4cefac,50,4);sfmSparkles(posB,0x5f7fff,50,4);
  const mA=getMesh(a),mB=getMesh(b);
  const colA=mA?.material?.color?.getHex()||0x888888;const colB=mB?.material?.color?.getHex()||0x444444;
  const scA=new THREE.Vector3();a.getWorldScale(scA);const scB=new THREE.Vector3();b.getWorldScale(scB);
  const geoA=mA?.geometry?.clone?.()?.toNonIndexed()||new THREE.BoxGeometry(1,1,1);
  const geoB=mB?.geometry?.clone?.()?.toNonIndexed()||new THREE.SphereGeometry(.7,12,8);
  const posAArr=geoA.attributes.position.array,posBArr=geoB.attributes.position.array;
  const n=Math.min(posAArr.length,posBArr.length);const blended=new Float32Array(n);const td=.5+(Math.random()-.5)*.3;
  for(let i=0;i<n;i++)blended[i]=posAArr[i]*td+(i<posBArr.length?posBArr[i]:0)*(1-td);
  const fusedGeo=new THREE.BufferGeometry();fusedGeo.setAttribute('position',new THREE.BufferAttribute(blended.slice(0,n-n%3),3));fusedGeo.computeVertexNormals();
  const avgColor=new THREE.Color(colA).lerp(new THREE.Color(colB),.5);
  const fusedMat=new THREE.MeshStandardMaterial({color:avgColor,roughness:.4,metalness:.3,emissive:avgColor,emissiveIntensity:.15});
  const fused=new THREE.Mesh(fusedGeo,fusedMat);fused.position.copy(mid);fused.scale.setScalar((scA.length()+scB.length())/2/Math.sqrt(3));fused.name=`DNA_${a.name}_${b.name}`;fused.userData.shapeType='fusion_dna';
  scene.add(fused);window.sceneObjects?.push(fused);a.visible=false;b.visible=false;
  sfmSparkles(mid,parseInt(avgColor.getHexString(),16),80,5);toast('Fusão DNA completa!',2800);markDirty(4);}

function handleFusionRandom(){
  const pair=getSelectedPair();if(pair.length<2){toast('Selecione 2 objetos.');return;}
  closeHelper();const[a,b]=pair;const scene=getScene();if(!scene)return;
  const posA=getWorldPos(a),posB=getWorldPos(b),mid=posA.clone().lerp(posB,.5);
  sfmSparkles(mid,0xff44ff,80,5);
  const scaleA=new THREE.Vector3();a.getWorldScale(scaleA);const scaleB=new THREE.Vector3();b.getWorldScale(scaleB);
  const geoTypes=[()=>new THREE.BoxGeometry(1,1,1),()=>new THREE.SphereGeometry(.7,12,8),()=>new THREE.ConeGeometry(.7,1.4,8),()=>new THREE.CylinderGeometry(.5,.7,1.4,8),()=>new THREE.TorusGeometry(.7,.2,8,20),()=>new THREE.IcosahedronGeometry(.8,1),()=>new THREE.OctahedronGeometry(.8,0)];
  const geo=geoTypes[Math.floor(Math.random()*geoTypes.length)]();const hue=Math.random();const col=new THREE.Color().setHSL(hue,.8,.45);
  const mat=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.5+Math.random()*.8,roughness:Math.random()*.6,metalness:Math.random()*.8,transparent:Math.random()>.6,opacity:.6+Math.random()*.4,wireframe:Math.random()>.85});
  const fused=new THREE.Mesh(geo,mat);fused.position.copy(mid);fused.name=`Random_${a.name}_${b.name}`;fused.userData.shapeType='fusion_random';
  fused.scale.setScalar((scaleA.length()+scaleB.length())/2/Math.sqrt(3)*(.6+Math.random()*.8));
  scene.add(fused);window.sceneObjects?.push(fused);a.visible=false;b.visible=false;toast('Fusão aleatória!',2200);markDirty(4);}

// AI Fusion
let aiFusionResult=null,aiFusionPair=[];
function handleFusionAI(){
  const pair=getSelectedPair();if(pair.length<2){toast('Selecione 2 objetos.');return;}
  aiFusionPair=pair;closeHelper();
  const[a,b]=pair;
  const desc=o=>{const m=getMesh(o);const c=m?.material?.color;const sc=new THREE.Vector3();o.getWorldScale(sc);return`${getShapeLabel(o)} (cor:#${c?c.getHexString():'888888'}, escala:${sc.length().toFixed(2)}, mat:${getMaterialType(o)})`;};
  const ai=$('nh-fusion-ai');if(!ai)return;ai.classList.remove('hidden');aiFusionResult=null;$('nh-ai-apply')?.classList.add('hidden');
  const msgs=$('nh-ai-msgs');if(!msgs)return;msgs.innerHTML='';
  addAIMsg('sys',`Objetos:\n• ${desc(a)}\n• ${desc(b)}`);addAIMsg('ai','Olá! Vou criar uma fusão 3D. Descreva como quer, ou posso sugerir automaticamente.');}

function addAIMsg(role,text){const msgs=$('nh-ai-msgs');if(!msgs)return;const d=document.createElement('div');d.className=`nh-ai-msg ${role}`;d.textContent=text;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;}

async function sendAIFusion(userMsg){
  const[a,b]=aiFusionPair;if(!a||!b)return;
  addAIMsg('user',userMsg);const sendBtn=$('nh-ai-send');if(sendBtn){sendBtn.disabled=true;sendBtn.textContent='…';}
  const mA=getMesh(a),mB=getMesh(b);
  const colA=mA?.material?.color?.getHexString?.()||'888888';const colB=mB?.material?.color?.getHexString?.()||'444444';
  const scA=new THREE.Vector3();a.getWorldScale(scA);const scB=new THREE.Vector3();b.getWorldScale(scB);
  const sys=`Você é um motor de fusão 3D para THREE.js. O usuário quer fundir dois objetos.
Objeto A: ${getShapeLabel(a)}, cor #${colA}, mat:${getMaterialType(a)}, roughness:${mA?.material?.roughness?.toFixed(2)}, metalness:${mA?.material?.metalness?.toFixed(2)}
Objeto B: ${getShapeLabel(b)}, cor #${colB}, mat:${getMaterialType(b)}, roughness:${mB?.material?.roughness?.toFixed(2)}, metalness:${mB?.material?.metalness?.toFixed(2)}
Responda em português com uma descrição criativa e ao final inclua JSON:
\`\`\`fusion
{"geometry":"box|sphere|cone|cylinder|torus|icosahedron|octahedron","color":"#RRGGBB","emissive":"#RRGGBB","emissiveIntensity":0.5,"roughness":0.4,"metalness":0.5,"transparent":false,"opacity":1.0,"scale":1.0,"name":"Nome"}
\`\`\``;
  const text=await callClaude(sys,userMsg,700);
  if(text){addAIMsg('ai',text.replace(/```fusion[\s\S]*?```/g,'').trim());const match=text.match(/```fusion\s*([\s\S]*?)```/);if(match){try{aiFusionResult=JSON.parse(match[1]);$('nh-ai-apply')?.classList.remove('hidden');}catch{}}}
  else addAIMsg('ai','Erro ao conectar com a IA.');
  if(sendBtn){sendBtn.disabled=false;sendBtn.textContent='Enviar';}}

function applyAIFusion(){
  if(!aiFusionResult)return;const[a,b]=aiFusionPair;if(!a||!b)return;
  const scene=getScene();if(!scene)return;
  const posA=getWorldPos(a),posB=getWorldPos(b),mid=posA.clone().lerp(posB,.5);
  const gF={box:()=>new THREE.BoxGeometry(1,1,1),sphere:()=>new THREE.SphereGeometry(.7,20,14),cone:()=>new THREE.ConeGeometry(.7,1.4,12),cylinder:()=>new THREE.CylinderGeometry(.5,.7,1.4,12),torus:()=>new THREE.TorusGeometry(.7,.2,10,40),icosahedron:()=>new THREE.IcosahedronGeometry(.8,1),octahedron:()=>new THREE.OctahedronGeometry(.8,0)};
  const geoFn=gF[aiFusionResult.geometry]||gF.sphere;const col=new THREE.Color(aiFusionResult.color||'#888888');const emm=new THREE.Color(aiFusionResult.emissive||'#111122');
  const mat=new THREE.MeshStandardMaterial({color:col,emissive:emm,emissiveIntensity:aiFusionResult.emissiveIntensity??.5,roughness:aiFusionResult.roughness??.4,metalness:aiFusionResult.metalness??.5,transparent:aiFusionResult.transparent??false,opacity:aiFusionResult.opacity??1});
  const fused=new THREE.Mesh(geoFn(),mat);fused.position.copy(mid);fused.scale.setScalar(aiFusionResult.scale??1);fused.name=aiFusionResult.name||'AI_Fusion';fused.userData.shapeType='fusion_ai';
  scene.add(fused);window.sceneObjects?.push(fused);a.visible=false;b.visible=false;
  sfmExplosion(mid,parseInt((aiFusionResult.emissive||'#8844ff').replace('#',''),16));
  $('nh-fusion-ai')?.classList.add('hidden');toast(`"${fused.name}" criada!`,3500);markDirty(4);}

// ══════════════════════════════════════════════════════════════════
//  MOBILE MULTI-SELECT (duplo-toque em objeto diferente)
// ══════════════════════════════════════════════════════════════════
(function setupMobileMultiSelect(){
  if(!(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)))return;
  let lastTap=0,lastObj=null;
  document.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    const now=Date.now();const obj=window.activeObject;
    if(!obj)return;
    // Se duplo-toque rápido num objeto diferente do ativo → adiciona à seleção
    if(now-lastTap<350&&obj!==lastObj&&lastObj){
      if(!window.selectedObjects)window.selectedObjects=new Set();
      window.selectedObjects.add(lastObj);window.selectedObjects.add(obj);
      toast(`${window.selectedObjects.size} objetos selecionados`,1500);}
    lastTap=now;lastObj=obj;},{passive:true});
})();

// ══════════════════════════════════════════════════════════════════
//  WIRE EVENTS & INIT
// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
//  API KEY MODAL
// ══════════════════════════════════════════════════════════════════
function openKeyModal(){
  const modal=$('nh-key-modal');if(!modal)return;
  const inp=$('nh-key-inp');if(inp)inp.value=CLAUDE_API_KEY||'';
  const st=$('nh-key-status');
  if(st){if(CLAUDE_API_KEY){st.className='nh-key-status ok';st.textContent='✔ Chave salva — pronta para uso';}
         else{st.className='nh-key-status';st.textContent='Nenhuma chave configurada ainda.';}}
  const btn=$('nh-key-btn');if(btn)btn.classList.toggle('active',!!CLAUDE_API_KEY);
  modal.classList.remove('hidden');}

async function testAndSaveKey(key){
  const st=$('nh-key-status');
  if(!key){if(st){st.className='nh-key-status err';st.textContent='Cole a chave antes de salvar.';}return;}
  const setStatus=(ok,msg)=>{if(!st)return;st.className='nh-key-status '+(ok?'ok':'err');st.textContent=msg;};
  setStatus(false,'Testando conexão com Anthropic…');
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':key,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-calls':'true'
      },
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:5,
        messages:[{role:'user',content:'ping'}]
      })
    });
    let errMsg='';
    if(!r.ok){
      try{const ed=await r.json();errMsg=ed?.error?.message||('HTTP '+r.status);}catch{errMsg='HTTP '+r.status;}
      setStatus(false,'Erro '+r.status+': '+errMsg);
      console.error('[NexusHelper] testKey:',r.status,errMsg);
      return;
    }
    const d=await r.json();
    if(d.error){setStatus(false,'Erro API: '+d.error.message);return;}
    CLAUDE_API_KEY=key;
    try{localStorage.setItem('nh_claude_key',key);}catch{}
    setStatus(true,'✔ Chave válida! IA ativada com sucesso.');
    const btn=$('nh-key-btn');if(btn)btn.classList.add('active');
    setTimeout(()=>$('nh-key-modal')?.classList.add('hidden'),1400);
    toast('IA ativada!',2500);
  }catch(e){
    const msg=e?.message||String(e);
    setStatus(false,'Falha: '+msg);
    console.error('[NexusHelper] testAndSaveKey exception:',e);
  }
}

function wireEvents(){
  $('nh-close')?.addEventListener('click',closeHelper);
  $('nh-overlay')?.addEventListener('click',e=>{if(e.target.id==='nh-overlay')closeHelper();});
  $('nh-edit-btn')?.addEventListener('click',handleEditNexal);

  // API Key modal
  $('nh-key-btn')?.addEventListener('click',e=>{e.stopPropagation();openKeyModal();});
  $('nh-key-close')?.addEventListener('click',()=>$('nh-key-modal')?.classList.add('hidden'));
  $('nh-key-modal')?.addEventListener('click',e=>{if(e.target.id==='nh-key-modal')$('nh-key-modal')?.classList.add('hidden');});
  $('nh-key-save')?.addEventListener('click',()=>{const v=$('nh-key-inp')?.value.trim();testAndSaveKey(v);});
  $('nh-key-inp')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('nh-key-save')?.click();});
  $('nh-key-clear')?.addEventListener('click',()=>{CLAUDE_API_KEY='';localStorage.removeItem('nh_claude_key');const inp=$('nh-key-inp');if(inp)inp.value='';const st=$('nh-key-status');if(st){st.className='nh-key-status';st.textContent='Chave removida.';}const btn=$('nh-key-btn');if(btn)btn.classList.remove('active');toast('Chave removida.',2000);});

  // Evolution
  $('nh-evolve-btn')?.addEventListener('click',()=>{const obj=getAO();if(!obj){toast('Selecione um objeto.');return;}closeHelper();runEvolutionSimulation(obj);});
  $('nh-evo-close')?.addEventListener('click',()=>{evoAbort=true;});
  $('nh-evo-abort')?.addEventListener('click',()=>{evoAbort=true;});
  $('nh-evo-skip')?.addEventListener('click',()=>{evoSkip=true;});

  // Transform
  $('nh-tx-btn')?.addEventListener('click',e=>{e.stopPropagation();$('nh-tx-sub')?.classList.remove('hidden');});
  $('nh-tx-close')?.addEventListener('click',()=>$('nh-tx-sub')?.classList.add('hidden'));
  $('nh-tx-sub')?.addEventListener('click',e=>{if(e.target.id==='nh-tx-sub')$('nh-tx-sub')?.classList.add('hidden');});
  document.querySelectorAll('#nh-tx-list .nh-sub-btn').forEach(btn=>btn.addEventListener('click',()=>applyMaterial(btn.dataset.mat)));
  $('nh-tx-ai-btn')?.addEventListener('click',handleTxAI);

  // Mech
  $('nh-mech-btn')?.addEventListener('click',()=>{handleMech();closeHelper();});
  $('nh-mech-ai-btn')?.addEventListener('click',handleMechAI);

  // Fusion
  $('nh-fusion-dna-btn')?.addEventListener('click',handleFusionDNA);
  $('nh-fusion-ai-btn')?.addEventListener('click',handleFusionAI);
  $('nh-fusion-rand-btn')?.addEventListener('click',handleFusionRandom);
  $('nh-ai-close')?.addEventListener('click',()=>$('nh-fusion-ai')?.classList.add('hidden'));
  $('nh-fusion-ai')?.addEventListener('click',e=>{if(e.target.id==='nh-fusion-ai')$('nh-fusion-ai')?.classList.add('hidden');});
  $('nh-ai-send')?.addEventListener('click',()=>{const inp=$('nh-ai-input');const val=inp?.value.trim();if(!val)return;inp.value='';sendAIFusion(val);});
  $('nh-ai-input')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('nh-ai-send')?.click();}});
  $('nh-ai-apply')?.addEventListener('click',applyAIFusion);

  // Skills toggle
  $('nh-sk-toggle')?.addEventListener('click',()=>{const obj=$('nh-sk-toggle')._obj;if(!obj)return;const sp=$('nh-skill-panel');if(!sp)return;if(sp.classList.contains('hidden'))showSkillPanel(obj);else{sp.classList.add('hidden');$('nh-skill-cfg')?.classList.add('hidden');}});

  // Re-wire tx-list after DOM built
  document.querySelectorAll('#nh-tx-list .nh-sub-btn').forEach(btn=>btn.addEventListener('click',()=>applyMaterial(btn.dataset.mat)));

  // Hook model-btn to open helper
  const modelBtn=document.getElementById('model-btn');
  if(modelBtn){const nb=modelBtn.cloneNode(true);modelBtn.parentNode.replaceChild(nb,modelBtn);nb.addEventListener('click',e=>{e.stopPropagation();openHelper();});}
}

function init(){
  buildDOM();wireEvents();
  document.querySelectorAll('#nh-tx-list .nh-sub-btn').forEach(btn=>btn.addEventListener('click',()=>applyMaterial(btn.dataset.mat)));

  // Show key button as active if key already saved
  if(CLAUDE_API_KEY){
    const btn=$('nh-key-btn');if(btn)btn.classList.add('active');
  } else {
    // First time: auto-prompt user to set key
    setTimeout(()=>{toast('Configure sua API Key da IA — clique no botão cerebro no header.',5000);},1500);
  }

  // Hook active object changed — multiple strategies for reliability
  const prevCb = window.onActiveObjectChanged;
  window.onActiveObjectChanged = obj => {
    if (typeof prevCb === 'function') prevCb(obj);
    updateSkillToggle(obj);
  };

  // Strategy 2: poll window.activeObject every 400ms (fallback if callback not called)
  let _lastAO = null;
  setInterval(() => {
    const ao = window.activeObject || null;
    if (ao !== _lastAO) { _lastAO = ao; updateSkillToggle(ao); }
  }, 400);

  // Strategy 3: listen for renderer canvas clicks — re-check after click
  setTimeout(() => {
    const canvas = window._nexusRenderer?.domElement;
    if (canvas) {
      canvas.addEventListener('pointerup', () => {
        setTimeout(() => updateSkillToggle(window.activeObject || null), 120);
      });
    }
  }, 1000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.NexusHelper={open:openHelper,close:closeHelper};

// ── CSS ───────────────────────────────────────────────────
(function injectCSS(){
  if(document.getElementById('_nh4_css'))return;
  const s=document.createElement('style');s.id='_nh4_css';s.textContent=`
@keyframes nhFade{from{opacity:0}to{opacity:1}}
@keyframes nhSlide{from{opacity:0;transform:translateY(-16px) scale(.97)}to{opacity:1;transform:none}}
@keyframes nhSlideL{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:none}}
@keyframes nhGlow{0%,100%{box-shadow:0 0 8px rgba(95,127,255,.3)}50%{box-shadow:0 0 22px rgba(95,127,255,.8)}}
@keyframes nhSkillBurst{0%{transform:scale(1)}30%{transform:scale(1.14)}70%{transform:scale(.96)}100%{transform:scale(1)}}
@keyframes nhBreathe{0%,100%{opacity:.4}50%{opacity:1}}
@keyframes nhFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}

.nh-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);z-index:9000;display:flex;align-items:center;justify-content:center;animation:nhFade .2s}
.nh-overlay.hidden{display:none!important}

#nh-main-panel{background:rgba(6,8,18,.98);border:1px solid rgba(95,127,255,.3);border-radius:16px;
  box-shadow:0 24px 80px rgba(0,0,0,.9),0 0 60px rgba(95,127,255,.06);
  width:440px;max-width:95vw;max-height:90vh;overflow-y:auto;padding:0 0 20px;
  animation:nhSlide .25s cubic-bezier(.34,1.56,.64,1);scrollbar-width:thin;scrollbar-color:rgba(95,127,255,.3) transparent}
.nh-hdr{display:flex;align-items:center;gap:8px;padding:14px 16px 12px;border-bottom:1px solid rgba(255,255,255,.06);
  position:sticky;top:0;background:rgba(6,8,18,.98);border-radius:16px 16px 0 0;z-index:2}
.nh-hdr-logo{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#5f7fff,#a78bfa);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 12px rgba(95,127,255,.5)}
.nh-hdr h2{margin:0;font-size:14px;font-weight:600;background:linear-gradient(90deg,#a5b4fc,#c4b5fd);-webkit-background-clip:text;-webkit-text-fill-color:transparent;flex:1}
.nh-x{width:26px;height:26px;border-radius:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  color:rgba(255,255,255,.5);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .14s}
.nh-x:hover{background:rgba(255,60,60,.18);color:#ff6060;border-color:rgba(255,60,60,.3)}
.nh-hdr-btn{width:28px;height:28px;border-radius:7px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  color:rgba(255,255,255,.45);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .14s;flex-shrink:0}
.nh-hdr-btn:hover{background:rgba(95,127,255,.18);color:#a5b4fc;border-color:rgba(95,127,255,.4)}
.nh-hdr-btn.ok{background:rgba(76,239,172,.15);border-color:rgba(76,239,172,.4);color:#4cefac}
.nh-hdr-btn.err{background:rgba(255,80,80,.12);border-color:rgba(255,80,80,.4);color:#ff6060;animation:nhGlow 1.5s infinite}

.nh-edit-nexal{margin:12px 14px 2px;width:calc(100% - 28px);padding:10px 14px;
  background:linear-gradient(135deg,rgba(95,127,255,.14),rgba(167,139,250,.07));
  border:1px solid rgba(95,127,255,.28);border-radius:10px;color:#a5b4fc;font-size:12.5px;font-weight:600;
  cursor:pointer;display:flex;align-items:center;gap:9px;transition:all .17s}
.nh-edit-nexal:hover{transform:translateY(-1px);box-shadow:0 0 20px rgba(95,127,255,.16)}
.nh-edit-icon{width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,#5f7fff,#a78bfa);display:flex;align-items:center;justify-content:center;flex-shrink:0}

.nh-cat{margin:14px 14px 0}
.nh-cat-title{font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.22);margin-bottom:6px;display:flex;align-items:center;gap:6px}
.nh-cat-title::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.05)}
.nh-btn-col{display:flex;flex-direction:column;gap:4px}
.nh-btn{width:100%;padding:9px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.07);
  background:rgba(255,255,255,.04);color:rgba(255,255,255,.8);font-size:12px;font-weight:500;
  cursor:pointer;display:flex;align-items:center;gap:9px;transition:all .15s;text-align:left}
.nh-btn:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.13);transform:translateX(2px)}
.nh-btn:active{transform:scale(.98)}
.nh-btn .ib{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nh-btn .bt{flex:1}.nh-btn .bt small{display:block;font-size:10px;color:rgba(255,255,255,.28);margin-top:1px}
.cat-evo .nh-btn:hover{border-color:rgba(76,239,172,.3);color:#4cefac}.cat-evo .ib{background:rgba(76,239,172,.1)}
.cat-tx .nh-btn:hover{border-color:rgba(255,190,50,.3);color:#ffd95c}.cat-tx .ib{background:rgba(255,190,50,.1)}
.cat-mech .nh-btn:hover{border-color:rgba(255,100,80,.3);color:#ff8060}.cat-mech .ib{background:rgba(255,100,80,.1)}
.cat-fusion .nh-btn:hover{border-color:rgba(200,80,255,.3);color:#cc80ff}.cat-fusion .ib{background:rgba(200,80,255,.1)}

.nh-sub{position:fixed;inset:0;z-index:9200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(4px)}
.nh-sub.hidden{display:none!important}
.nh-sub-box{background:rgba(6,8,18,.97);border-radius:14px;padding:0 0 14px;width:360px;max-width:92vw;max-height:88vh;overflow-y:auto;animation:nhSlide .2s ease;box-shadow:0 20px 60px rgba(0,0,0,.8);scrollbar-width:thin}
.nh-sub-hdr{padding:12px 15px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:8px}
.nh-sub-hdr h3{margin:0;font-size:13px;font-weight:600;flex:1}
.nh-sub-list{padding:10px 12px 0;display:flex;flex-direction:column;gap:4px}
.nh-sub-btn{padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.04);
  color:rgba(255,255,255,.8);font-size:12px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .14s;text-align:left;width:100%}
.nh-sub-btn:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.14)}

#nh-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(12px);
  background:rgba(6,8,18,.97);border:1px solid rgba(95,127,255,.3);border-radius:9px;
  padding:9px 16px;color:#a5b4fc;font-size:12.5px;font-weight:500;z-index:9999;
  opacity:0;pointer-events:none;transition:all .22s;box-shadow:0 8px 22px rgba(0,0,0,.5);white-space:nowrap;max-width:90vw;text-align:center}
#nh-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

#nh-prog{position:fixed;inset:0;z-index:9300;display:flex;align-items:center;justify-content:center;pointer-events:none}
#nh-prog.hidden{display:none}
.nh-prog-box{background:rgba(6,8,18,.97);border:1px solid rgba(95,127,255,.28);border-radius:13px;padding:22px 28px;text-align:center;min-width:230px;box-shadow:0 20px 56px rgba(0,0,0,.8)}
.nh-prog-title{font-size:13px;color:#a5b4fc;font-weight:600;margin-bottom:10px}
.nh-prog-track{width:100%;height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden}
.nh-prog-fill{height:100%;background:linear-gradient(90deg,#5f7fff,#a78bfa);border-radius:3px;transition:width .08s;box-shadow:0 0 8px rgba(95,127,255,.5)}
.nh-prog-lbl{font-size:10px;color:rgba(255,255,255,.35);margin-top:7px;font-family:monospace}

/* Evo overlay - compact window */
#nh-evo-overlay{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9400;
  background:rgba(4,5,14,.98);border:1px solid rgba(95,127,255,.35);border-radius:16px;
  padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px;
  width:min(580px,95vw);box-shadow:0 30px 100px rgba(0,0,0,.95);animation:nhSlide .3s cubic-bezier(.34,1.56,.64,1)}
#nh-evo-overlay.hidden{display:none!important}
.nh-evo-bar{display:flex;align-items:center;gap:8px;width:100%;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.06)}
.nh-evo-bar h3{margin:0;flex:1;font-size:12.5px;font-weight:600;color:#a5b4fc}
#nh-evo-canvas{border:1px solid rgba(95,127,255,.2);border-radius:8px;width:100%;height:auto}
.nh-evo-stats{display:flex;gap:6px;font-size:10px;color:rgba(255,255,255,.5);font-family:monospace;width:100%;justify-content:center;flex-wrap:wrap}
.nh-evo-stats span{background:rgba(255,255,255,.05);padding:3px 9px;border-radius:5px}
.nh-evo-phase{font-size:11px;color:rgba(165,180,252,.65);font-family:monospace;text-align:center}
.nh-evo-actions{display:flex;gap:8px}
.nh-evo-btn{padding:7px 15px;border-radius:8px;border:1px solid rgba(95,127,255,.3);background:rgba(95,127,255,.08);
  color:#a5b4fc;font-size:11.5px;cursor:pointer;transition:all .14s;display:flex;align-items:center;gap:6px}
.nh-evo-btn:hover{background:rgba(95,127,255,.18)}
.nh-evo-btn.red{border-color:rgba(255,70,70,.3);background:rgba(255,70,70,.07);color:#ff7070}
.nh-ai-lbl{font-size:10px;color:rgba(180,130,255,.8);font-family:monospace;animation:nhBreathe 1.4s infinite;display:flex;align-items:center;gap:5px}

/* Skills toggle */
#nh-sk-toggle{position:fixed;bottom:70px;left:14px;z-index:7999;
  background:rgba(6,8,18,.97);border:1px solid rgba(95,127,255,.5);border-radius:10px;
  padding:9px 14px;color:#a5b4fc;font-size:12px;cursor:pointer;font-weight:600;
  display:flex;align-items:center;gap:7px;animation:nhSlideL .22s ease;
  box-shadow:0 4px 24px rgba(0,0,0,.7),0 0 16px rgba(95,127,255,.25);transition:all .16s}
#nh-sk-toggle:hover{background:rgba(95,127,255,.14);transform:translateX(3px)}
#nh-sk-toggle.hidden{display:none}

/* Skills panel */
#nh-skill-panel{position:fixed;left:0;top:50%;transform:translateY(-50%);
  background:rgba(6,8,18,.97);border:1px solid rgba(95,127,255,.25);border-radius:0 12px 12px 0;
  padding:10px 0 12px;width:272px;z-index:8000;box-shadow:5px 0 24px rgba(0,0,0,.7);animation:nhSlideL .2s ease}
#nh-skill-panel.hidden{display:none}
.nh-sp-hdr{padding:8px 14px 10px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:8px}
.nh-sp-icon{width:32px;height:32px;border-radius:7px;background:rgba(95,127,255,.12);border:1px solid rgba(95,127,255,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nh-sp-hdr h4{margin:0;font-size:12px;color:#a5b4fc;flex:1}
.nh-sk-row{display:flex;align-items:center;padding:6px 12px;gap:8px;cursor:pointer;transition:background .12s}
.nh-sk-row:hover{background:rgba(255,255,255,.05)}
.nh-sk-row.burst{animation:nhSkillBurst .4s ease}
.nh-sk-ico{width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .15s}
.nh-sk-row:hover .nh-sk-ico{transform:scale(1.12)}
.nh-sk-info{flex:1}.nh-sk-name{font-size:11.5px;font-weight:600}.nh-sk-desc{font-size:10px;color:rgba(255,255,255,.3)}
.nh-sk-rage{display:flex;gap:2px;margin-top:2px}
.nh-sk-rage span{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.12)}
.nh-sk-rage span.on{background:currentColor}
.nh-sk-cfg{width:20px;height:20px;border-radius:5px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  color:rgba(255,255,255,.4);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .13s;flex-shrink:0}
.nh-sk-cfg:hover{background:rgba(95,127,255,.2);color:#a5b4fc;border-color:rgba(95,127,255,.4)}
.nh-sk-special{background:rgba(255,200,50,.06);border-top:1px solid rgba(255,200,50,.1)}
.nh-sk-special .nh-sk-name{color:#ffd95c}
.nh-sk-divider{height:1px;background:rgba(255,255,255,.05);margin:5px 12px}

#nh-skill-cfg{position:fixed;left:276px;top:50%;transform:translateY(-50%);
  background:rgba(6,8,18,.97);border:1px solid rgba(95,127,255,.25);border-radius:12px;
  padding:14px;width:215px;z-index:8001;box-shadow:4px 0 24px rgba(0,0,0,.6);animation:nhSlide .18s ease}
#nh-skill-cfg.hidden{display:none}
.nh-cfg-hdr{display:flex;align-items:center;gap:7px;margin-bottom:12px}
.nh-cfg-hdr h5{margin:0;font-size:12px;color:#a5b4fc;flex:1}
.nh-cfg-lbl{font-size:10px;color:rgba(255,255,255,.35);margin-bottom:5px;text-transform:uppercase;letter-spacing:.08em}
.nh-cfg-sec{margin-bottom:10px}
.nh-cfg-rage{display:flex;gap:4px}
.nh-cfg-dot{width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,.1);cursor:pointer;transition:all .13s;border:1px solid rgba(255,255,255,.14)}
.nh-cfg-dot:hover{transform:scale(1.2)}
.nh-cfg-colors{display:flex;gap:5px;flex-wrap:wrap}
.nh-cfg-swatch{width:18px;height:18px;border-radius:4px;cursor:pointer;border:2px solid transparent;transition:all .12s}
.nh-cfg-swatch:hover,.nh-cfg-swatch.active{border-color:#fff;transform:scale(1.15)}
.nh-cfg-row{display:flex;gap:5px;align-items:center}
.nh-cfg-row input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:4px 7px;color:rgba(255,255,255,.8);font-size:11px;outline:none}
.nh-cfg-apply{width:100%;margin-top:10px;padding:7px;border-radius:7px;border:1px solid rgba(95,127,255,.3);background:rgba(95,127,255,.12);color:#a5b4fc;font-size:11.5px;cursor:pointer;transition:all .13s}
.nh-cfg-apply:hover{background:rgba(95,127,255,.22)}

/* AI Fusion */
#nh-fusion-ai{position:fixed;inset:0;z-index:9200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(5px)}
#nh-fusion-ai.hidden{display:none!important}
.nh-ai-box{background:rgba(6,8,18,.97);border:1px solid rgba(200,80,255,.3);border-radius:14px;width:400px;max-width:93vw;max-height:85vh;display:flex;flex-direction:column;animation:nhSlide .22s ease;box-shadow:0 20px 60px rgba(0,0,0,.85)}
.nh-ai-hdr{padding:12px 15px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:8px}
.nh-ai-hdr h3{margin:0;font-size:13px;color:#cc80ff;flex:1}
.nh-ai-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;min-height:180px;max-height:320px;scrollbar-width:thin}
.nh-ai-msg{padding:8px 11px;border-radius:8px;font-size:12px;line-height:1.5;max-width:88%}
.nh-ai-msg.user{background:rgba(95,127,255,.15);border:1px solid rgba(95,127,255,.2);align-self:flex-end;color:rgba(255,255,255,.88)}
.nh-ai-msg.ai{background:rgba(200,80,255,.1);border:1px solid rgba(200,80,255,.2);align-self:flex-start;color:rgba(255,255,255,.82)}
.nh-ai-msg.sys{background:rgba(255,255,255,.04);align-self:center;color:rgba(255,255,255,.4);font-style:italic;font-size:11px}
.nh-ai-input-row{padding:10px 12px;border-top:1px solid rgba(255,255,255,.06);display:flex;gap:7px}
.nh-ai-inp{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:7px;padding:7px 10px;color:rgba(255,255,255,.88);font-size:12px;outline:none;resize:none}
.nh-ai-inp:focus{border-color:rgba(200,80,255,.4)}
.nh-ai-send{padding:0 13px;border-radius:7px;border:1px solid rgba(200,80,255,.3);background:rgba(200,80,255,.12);color:#cc80ff;font-size:12px;cursor:pointer;transition:all .13s;white-space:nowrap}
.nh-ai-send:hover{background:rgba(200,80,255,.22)}
.nh-ai-apply{margin:6px 12px 10px;padding:9px;border-radius:8px;border:1px solid rgba(200,80,255,.3);background:rgba(200,80,255,.1);color:#cc80ff;font-size:12px;cursor:pointer;width:calc(100% - 24px);transition:all .14s}
.nh-ai-apply.hidden{display:none}

/* API Key modal */
#nh-key-modal{position:fixed;inset:0;z-index:9600;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);backdrop-filter:blur(8px)}
#nh-key-modal.hidden{display:none!important}
.nh-km-box{background:rgba(6,8,18,.99);border:1px solid rgba(95,127,255,.45);border-radius:16px;padding:24px;width:380px;max-width:92vw;animation:nhSlide .25s ease;box-shadow:0 24px 80px rgba(0,0,0,.95)}
.nh-km-box h3{margin:0 0 4px;font-size:15px;color:#a5b4fc;display:flex;align-items:center;gap:9px}
.nh-km-box p{font-size:11px;color:rgba(255,255,255,.35);margin:0 0 14px;line-height:1.7}
.nh-km-inp{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(95,127,255,.35);border-radius:9px;padding:10px 13px;color:rgba(255,255,255,.9);font-size:13px;font-family:monospace;outline:none;box-sizing:border-box;margin-bottom:10px;letter-spacing:.02em}
.nh-km-inp:focus{border-color:rgba(95,127,255,.7)}
.nh-km-status{font-size:11.5px;margin-bottom:12px;min-height:18px;font-family:monospace;display:flex;align-items:center;gap:7px}
.nh-km-status.ok{color:#4cefac}.nh-km-status.err{color:#ff5252}.nh-km-status.testing{color:rgba(165,180,252,.7);animation:nhBreathe 1s infinite}
.nh-km-actions{display:flex;gap:8px}
.nh-km-save{flex:1;padding:10px;border-radius:9px;border:1px solid rgba(95,127,255,.45);background:rgba(95,127,255,.16);color:#a5b4fc;font-size:13px;font-weight:600;cursor:pointer;transition:all .14s}
.nh-km-save:hover{background:rgba(95,127,255,.28)}
.nh-km-clear{padding:10px 14px;border-radius:9px;border:1px solid rgba(255,80,80,.3);background:rgba(255,80,80,.08);color:#ff7070;font-size:12px;cursor:pointer;transition:all .14s}
.nh-km-clear:hover{background:rgba(255,80,80,.18)}

/* Screen flash */
#nh-flash{position:fixed;inset:0;z-index:9998;pointer-events:none;opacity:0;transition:opacity .06s}
`;
  document.head.appendChild(s);
})();

// ── HELPERS ───────────────────────────────────────────────
const $=id=>document.getElementById(id);
function toast(msg,ms=2800){let t=$('nh-toast');if(!t){t=document.createElement('div');t.id='nh-toast';document.body.appendChild(t);}t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),ms);}
function setProgress(title,pct,lbl){const el=$('nh-prog');if(!el)return;el.classList.remove('hidden');const ti=$('nh-prog-title'),fi=$('nh-prog-fill'),li=$('nh-prog-lbl');if(ti)ti.textContent=title;if(fi)fi.style.width=pct+'%';if(li)li.textContent=lbl||(pct+'%');}
function hideProgress(){$('nh-prog')?.classList.add('hidden');}
function markDirty(n=4){window.markDirty?.(n);}
function getAO(){return window.activeObject||null;}
function getScene(){return window._nexusScene;}
function getMesh(obj){if(!obj)return null;if(obj.isMesh)return obj;let r=null;obj.traverse(c=>{if(c.isMesh&&!r)r=c;});return r;}
function getShapeLabel(obj){if(!obj)return'Objeto';const st=obj.userData?.shapeType;const lbl={cube:'Cubo',sphere:'Esfera',cone:'Cone',cylinder:'Cilindro',torus:'Toro'};if(st&&lbl[st])return lbl[st];if(obj.userData?.isImportedModel)return'Modelo';const geo=getMesh(obj)?.geometry;if(!geo)return'Objeto';const n=geo.constructor.name;if(n.includes('Box'))return'Cubo';if(n.includes('Sphere'))return'Esfera';if(n.includes('Cone'))return'Cone';if(n.includes('Cylinder'))return'Cilindro';if(n.includes('Torus'))return'Toro';return'Objeto';}
function getWorldPos(obj){const v=new THREE.Vector3();obj.getWorldPosition(v);return v;}
function screenFlash(color='rgba(255,255,255,.45)',ms=110){let fl=$('nh-flash');if(!fl){fl=document.createElement('div');fl.id='nh-flash';fl.style.cssText='position:fixed;inset:0;z-index:9998;pointer-events:none;opacity:0;transition:opacity .06s';document.body.appendChild(fl);}fl.style.background=color;fl.style.opacity='1';clearTimeout(fl._t);fl._t=setTimeout(()=>{fl.style.opacity='0';},ms);}

// ── FIX: callClaude usa proxy CORS + key nos headers corretos ──
async function callClaude(system,user,maxTok=600){
  if(!CLAUDE_KEY){toast('Configure sua chave da Anthropic — clique no ícone de chave no header.',4500);return'';}
  try{
    // Tenta direto com header browser-calls
    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':CLAUDE_KEY,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-calls':'true',
      },
      body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:maxTok,system,messages:[{role:'user',content:user}]})
    });
    const data=await resp.json();
    if(data.error){
      const msg=data.error.message||JSON.stringify(data.error);
      toast('Erro IA: '+msg.slice(0,80),5000);
      console.error('[NexusAI] Erro Anthropic:',data.error);
      return'';
    }
    return data.content?.[0]?.text||'';
  }catch(err){
    toast('Erro de conexão: '+err.message.slice(0,60),5000);
    console.error('[NexusAI] Fetch error:',err);
    return'';
  }
}

// ── MATERIAL DEFS ─────────────────────────────────────────
const MAT_DEFS={
  gold:{color:0xffd700,emissive:0x553300,emissiveI:.35,rough:.10,metal:1.0,spk:0xffd700},
  silver:{color:0xdde0ee,emissive:0x111122,emissiveI:.08,rough:.06,metal:1.0,spk:0xe0e8ff},
  copper:{color:0xb87333,emissive:0x2a1200,emissiveI:.18,rough:.28,metal:.85,spk:0xff8c42},
  emerald:{color:0x50c878,emissive:0x003a1a,emissiveI:.45,rough:.04,metal:0,spk:0x00ff88,tr:true,op:.82},
  obsidian:{color:0x111118,emissive:0x22003a,emissiveI:.22,rough:.02,metal:.6,spk:0x9944ff},
  ruby:{color:0xcc1020,emissive:0x440010,emissiveI:.55,rough:.03,metal:0,spk:0xff2244,tr:true,op:.85},
  diamond:{color:0xccf4ff,emissive:0x002244,emissiveI:.8,rough:0,metal:0,spk:0xaaeeff,tr:true,op:.75},
  nano:{color:0x001133,emissive:0x0055cc,emissiveI:2,rough:.04,metal:.9,spk:0x00aaff},
  plasma:{color:0x220044,emissive:0x8800cc,emissiveI:3,rough:0,metal:0,spk:0xcc44ff,tr:true,op:.9},
};
function getMaterialType(obj){if(!obj)return'organic';const mat=getMesh(obj)?.material;if(!mat)return'organic';for(const[k,d]of Object.entries(MAT_DEFS)){if(mat.color&&Math.abs(mat.color.getHex()-d.color)<0x101010)return k;}if(mat.metalness>.8)return'metal';if(mat.transparent)return'crystal';return'organic';}
const MAT_GENOME_BONUS={
  gold:{armor:.5,strength:.3},silver:{speed:.3,stealth:.5},copper:{armor:.3,strength:.4},
  emerald:{stealth:.6,_trait:'regeneration'},obsidian:{armor:1,_trait:'void_shroud'},
  ruby:{_trait:'plasma_core',strength:.5},diamond:{armor:1.5,_trait:'crystalline_shell'},
  nano:{speed:.8,_trait:'neural_sync'},plasma:{_trait:'plasma_core',strength:.7},
  metal:{armor:.4,strength:.3},crystal:{armor:.5,_trait:'crystalline_shell'},organic:{_trait:'regeneration',speed:.2},
};
function applyMaterial(type){
  const obj=getAO();if(!obj){toast('Selecione um objeto.');return;}
  const def=MAT_DEFS[type];if(!def)return;
  $('nh-tx-sub')?.classList.add('hidden');
  obj.traverse(c=>{if(!c.isMesh)return;
    let m=c.material;if(!(m instanceof THREE.MeshStandardMaterial||m instanceof THREE.MeshPhysicalMaterial))m=new THREE.MeshStandardMaterial();
    m.color.setHex(def.color);m.emissive.setHex(def.emissive);m.emissiveIntensity=def.emissiveI;
    m.roughness=def.rough;m.metalness=def.metal;
    if(def.tr){m.transparent=true;m.opacity=def.op;}else{m.transparent=false;m.opacity=1;}
    m.needsUpdate=true;c.material=m;});
  obj.userData.materialType=type;
  sfmSparkles(getWorldPos(obj),def.spk,80,5);
  if(type==='nano'||type==='plasma')animPulse(obj,type==='plasma'?2.5:1.5,1.2,.12);
  toast(`Material: ${type}!`,2000);markDirty(4);}
function animPulse(obj,base,amp,speed){let f=0;const a=()=>{if(!obj.parent)return;f++;obj.traverse(c=>{if(c.isMesh&&c.material?.emissive)c.material.emissiveIntensity=base+Math.sin(f*speed)*amp;});markDirty(1);requestAnimationFrame(a);};requestAnimationFrame(a);}
async function handleTxAI(){
  const obj=getAO();if(!obj){toast('Selecione um objeto.');return;}closeHelper();
  const label=getShapeLabel(obj),mat=getMesh(obj)?.material;
  const info=mat?`cor:#${mat.color?.getHexString()},rough:${mat.roughness?.toFixed(2)},metal:${mat.metalness?.toFixed(2)}`:'?';
  toast('IA analisando...',3000);
  const text=await callClaude('Você escolhe o melhor material 3D. Responda SOMENTE o nome de um: gold,silver,copper,emerald,obsidian,ruby,diamond,nano,plasma. Sem explicação.',`Objeto:${label} (${info})`);
  const chosen=text.trim().toLowerCase().replace(/[^a-z]/g,'');
  if(MAT_DEFS[chosen]){toast(`IA: ${chosen}! Aplicando...`,2000);setTimeout(()=>applyMaterial(chosen),600);}
  else toast(`IA retornou "${text.trim()}" — inválido.`,3000);}

// ── EVOLVED FORM — Real 3D Models with Skeleton Animation ──
// Each archetype uses a proper bone hierarchy + ShaderMaterial

const ARCHETYPES=[
  {name:'Venom Apex',    color:'#8B2A2A',traits:{speed:5,armor:3,stealth:4,strength:3,spikes:true}, icon:'acid',    desc:'Predador veloz com veneno neural'},
  {name:'Ferro Carapax', color:'#B08010',traits:{speed:2,armor:6,stealth:1,strength:5,shell:true},  icon:'shield',  desc:'Fortaleza viva blindada'},
  {name:'Titanorak',     color:'#2a4a1a',traits:{speed:2,armor:5,stealth:1,strength:6,bulk:true},   icon:'star',    desc:'Colosso de força bruta'},
  {name:'Echo Specter',  color:'#1a6abb',traits:{speed:4,armor:2,stealth:3,strength:3,sonic:true},  icon:'wave',    desc:'Caçador de ondas sônicas'},
  {name:'Pyrovex',       color:'#cc3a08',traits:{speed:3,armor:3,stealth:2,strength:4,fire:true},   icon:'lightning',desc:'Dragão de plasma vivo'},
  {name:'Glacius Rex',   color:'#1a2a44',traits:{speed:4,armor:3,stealth:5,strength:3,ice:true},    icon:'dash',    desc:'Senhor do gelo eterno'},
  {name:'Arachna Prime', color:'#4a2a7a',traits:{speed:5,armor:2,stealth:4,strength:4,web:true},   icon:'skills',  desc:'Aranha-predadora de 8 membros'},
  {name:'Void Entity',   color:'#0a0018',traits:{speed:3,armor:6,stealth:2,strength:6,cosmic:true}, icon:'void',    desc:'Entidade do vazio dimensional'},
];

// ── Shared material factory ────────────────────────────────
function mkMat(col,ei=0.4,em=null,rough=0.3,metal=0.5,extra={}){
  return new THREE.MeshStandardMaterial({color:col,emissive:em!==null?em:col,emissiveIntensity:ei,roughness:rough,metalness:metal,...extra});}
function mkGlow(col,ei=5){return new THREE.MeshStandardMaterial({color:0,emissive:col,emissiveIntensity:ei,roughness:0,metalness:0});}

// ── buildEvolvedForm — creates real 3D creature via bones ──

function startIdleAnim(G,archetype,genome,S){
  const B=G.userData.bones;const baseY=G.position.y;const frags=G.userData.orbitFrags;let f=0;
  const anim=()=>{
    if(!G.parent)return;f++;const t=f*.016;

    // ── Universal: floating bob ──
    G.position.y=baseY+Math.sin(t*1.15)*.1;

    // ── Universal: spine/chest breathe ──
    if(B.spine){B.spine.rotation.z=Math.sin(t*.9)*.022;B.spine.rotation.x=Math.sin(t*.7)*.015;}
    if(B.chest){B.chest.rotation.z=Math.sin(t*.9+.4)*.018;}

    // ── Head look-around ──
    if(B.head){B.head.rotation.y=Math.sin(t*.55)*.22;B.head.rotation.x=Math.sin(t*.38)*.08;}
    if(B.neck){B.neck.rotation.y=Math.sin(t*.55)*.1;}

    // ── Arm swing ──
    if(B.armL){B.armL.rotation.z=-.18+Math.sin(t*.9)*.12;B.armL.rotation.x=Math.sin(t*.9)*.08;}
    if(B.armR){B.armR.rotation.z=.18-Math.sin(t*.9)*.12;B.armR.rotation.x=-Math.sin(t*.9)*.08;}
    if(B.foreL){B.foreL.rotation.z=Math.sin(t*.9)*.08;}
    if(B.foreR){B.foreR.rotation.z=-Math.sin(t*.9)*.08;}

    // ── Leg sway ──
    if(B.thighL){B.thighL.rotation.x=Math.sin(t*.9)*.06;}
    if(B.thighR){B.thighR.rotation.x=-Math.sin(t*.9)*.06;}
    if(B.shinL){B.shinL.rotation.x=Math.abs(Math.sin(t*.9))*.04;}
    if(B.shinR){B.shinR.rotation.x=Math.abs(Math.sin(t*.9+Math.PI))*.04;}

    // ── Tail wave ──
    if(B.tail){B.tail.forEach((b,i)=>{b.rotation.z=Math.sin(t*1.4+i*.5)*.14*(i*.25+.6);b.rotation.y=Math.sin(t*.9+i*.4)*.1*(i*.2+.5);});}

    // ── Archetype-specific ──
    if(archetype.traits.cosmic&&frags){
      frags.forEach(frag=>{frag.userData.orbitA+=frag.userData.orbitS;frag.position.x=Math.cos(frag.userData.orbitA)*frag.userData.orbitR;frag.position.z=Math.sin(frag.userData.orbitA)*frag.userData.orbitR;frag.position.y=frag.userData.orbitY+Math.sin(t*1.8+frag.userData.orbitA)*S*.12;frag.rotation.x+=.04;frag.rotation.y+=.06;});}

    if(archetype.traits.fire){G.traverse(c=>{if(c.isMesh&&c.material?.emissive?.getHex()===0xff4400)c.material.emissiveIntensity=5.5+Math.sin(t*5.5)*2.5;});}
    if(archetype.traits.sonic){G.children.forEach((c,idx)=>{if(c.geometry?.type==='PlaneGeometry'){c.scale.y=1+Math.sin(t*3.5+idx)*.09;c.scale.x=1+Math.sin(t*2.8+idx*.5)*.06;}});}
    if(archetype.traits.ice){G.traverse(c=>{if(c.isMesh&&c.material?.metalness>.8)c.material.emissiveIntensity=Math.max(.3,.55+Math.sin(t*2.2+c.id*.4)*.3);});}

    // ── Eye pulse (all archetypes) ──
    G.traverse(c=>{if(c.isMesh&&c.material?.emissiveIntensity>3&&c.material?.color?.r<.05){if(!c._ei0)c._ei0=c.material.emissiveIntensity;c.material.emissiveIntensity=c._ei0+Math.sin(t*3.8+c.id*.6)*2.2;}});

    markDirty(1);requestAnimationFrame(anim);};
  requestAnimationFrame(anim);}

function triggerSkillAnim(obj){
  const orig=obj.scale.clone();let f=0;
  const B=obj.userData.bones;
  const a=()=>{f++;
    if(f<10)obj.scale.setScalar(orig.x*(1+f*.022));
    else if(f<20)obj.scale.setScalar(orig.x*(1.2-(f-10)*.022));
    else{obj.scale.copy(orig);
      // Recoil on spine
      if(B?.spine){B.spine.rotation.x=-.25;setTimeout(()=>{if(B.spine)B.spine.rotation.x=0;},300);}
      markDirty(2);return;}
    markDirty(2);requestAnimationFrame(a);};
  requestAnimationFrame(a);
  const arch=obj.userData.archetype;
  screenFlash(arch?.traits?.fire?'rgba(255,100,0,.5)':arch?.traits?.ice?'rgba(100,200,255,.35)':arch?.traits?.cosmic?'rgba(150,0,255,.4)':'rgba(150,120,255,.35)',120);}
