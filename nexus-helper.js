// ============================================================
//  NEXUS HELPER  –  nexus-helper.js
//  Não importa THREE — usa window.THREE exposto pelo main.js
// ============================================================

// THREE é atribuído quando initNexusHelper roda (main.js já carregou)
var THREE;

window.addEventListener('load', () => setTimeout(initNexusHelper, 800));

function initNexusHelper() {
  THREE = window.THREE;
  if (!THREE) { console.error('[NexusHelper] window.THREE não encontrado'); return; }
  try {
    injectStyles();
    injectPanel();
    hookModelBtn();
  } catch(e) {
    console.error('[NexusHelper] Erro na inicialização:', e);
  }
}

// ====================================================
//  STYLES
// ====================================================
function injectStyles() {
  const s = document.createElement('style');
  s.textContent = `
    #nexus-helper-overlay {
      position:fixed;inset:0;z-index:9000;
      display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,8,0.62);backdrop-filter:blur(10px);
      opacity:0;pointer-events:none;transition:opacity 0.2s ease;
    }
    #nexus-helper-overlay.nh-open{opacity:1;pointer-events:all;}
    #nexus-helper-panel {
      width:min(390px,90vw);max-height:80vh;overflow-y:auto;
      background:rgba(8,10,22,0.98);
      border:1px solid rgba(95,127,255,0.28);border-radius:13px;
      padding:16px 14px 12px;
      box-shadow:0 0 50px rgba(95,127,255,0.12),0 18px 48px rgba(0,0,0,0.7);
      transform:translateY(14px) scale(0.98);
      transition:transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
      scrollbar-width:thin;scrollbar-color:rgba(95,127,255,0.2) transparent;
    }
    #nexus-helper-overlay.nh-open #nexus-helper-panel{transform:translateY(0) scale(1);}
    .nh-header{display:flex;align-items:center;gap:9px;margin-bottom:13px;}
    .nh-logo{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#5f7fff,#a855f7);display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px rgba(95,127,255,0.4);flex-shrink:0;}
    .nh-logo svg{width:15px;height:15px;fill:none;stroke:#fff;stroke-width:2;}
    .nh-title-block{flex:1;}
    .nh-title{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;letter-spacing:0.05em;background:linear-gradient(90deg,#7fa8ff,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
    .nh-subtitle{font-size:8.5px;color:rgba(255,255,255,0.3);font-family:'JetBrains Mono',monospace;letter-spacing:0.05em;margin-top:1px;}
    .nh-close{width:24px;height:24px;border-radius:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.4);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.13s;}
    .nh-close:hover{background:rgba(255,80,80,0.14);color:#ff6b6b;}
    .nh-close svg{width:11px;height:11px;stroke:currentColor;stroke-width:2.5;fill:none;}
    .nh-edit-nexal{width:100%;padding:9px 13px;margin-bottom:14px;border-radius:8px;background:linear-gradient(135deg,rgba(95,127,255,0.12),rgba(168,85,247,0.08));border:1px solid rgba(95,127,255,0.3);color:#7fa8ff;font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:600;letter-spacing:0.05em;cursor:pointer;display:flex;align-items:center;gap:9px;transition:all 0.16s;}
    .nh-edit-nexal:hover{border-color:rgba(95,127,255,0.55);box-shadow:0 0 14px rgba(95,127,255,0.12);}
    .nh-edit-nexal.active{background:linear-gradient(135deg,rgba(95,127,255,0.22),rgba(168,85,247,0.16));border-color:#7fa8ff;color:#b4ccff;box-shadow:0 0 20px rgba(95,127,255,0.2);}
    .nh-edit-nexal svg{width:13px;height:13px;stroke:currentColor;stroke-width:2;fill:none;flex-shrink:0;}
    .nh-edit-status{margin-left:auto;font-size:8.5px;padding:2px 7px;border-radius:20px;background:rgba(95,127,255,0.15);letter-spacing:0.07em;}
    .nh-edit-nexal.active .nh-edit-status{background:rgba(76,239,172,0.18);color:#4cefac;}
    .nh-category{margin-bottom:12px;}
    .nh-cat-label{font-family:'JetBrains Mono',monospace;font-size:8.5px;font-weight:600;letter-spacing:0.11em;color:rgba(255,255,255,0.28);text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:6px;}
    .nh-cat-label::after{content:'';flex:1;height:1px;background:rgba(255,255,255,0.05);}
    .nh-btn{width:100%;display:flex;align-items:center;gap:9px;padding:8px 11px;margin-bottom:4px;border-radius:7px;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.065);color:rgba(255,255,255,0.78);font-family:'DM Sans',sans-serif;font-size:11.5px;cursor:pointer;text-align:left;transition:all 0.14s;}
    .nh-btn:hover{background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.12);transform:translateX(2px);}
    .nh-btn:active{transform:scale(0.99);}
    .nh-btn-icon{width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .nh-btn-icon svg{width:13px;height:13px;stroke:currentColor;stroke-width:1.9;fill:none;}
    .nh-btn-text{flex:1;}
    .nh-btn-title{font-weight:500;font-size:11.5px;}
    .nh-btn-desc{font-size:9.5px;color:rgba(255,255,255,0.35);margin-top:1px;}
    .nh-btn-arrow{color:rgba(255,255,255,0.18);font-size:13px;}
    .nh-btn.evolution .nh-btn-icon{background:rgba(76,239,172,0.09);color:#4cefac;}
    .nh-btn.evolution:hover{border-color:rgba(76,239,172,0.25);}
    .nh-btn.transform-gold .nh-btn-icon{background:rgba(255,217,92,0.09);color:#ffd95c;}
    .nh-btn.transform-gold:hover{border-color:rgba(255,217,92,0.25);}
    .nh-btn.transform-nano .nh-btn-icon{background:rgba(95,127,255,0.09);color:#7fa8ff;}
    .nh-btn.transform-nano:hover{border-color:rgba(95,127,255,0.25);}
    .nh-btn.mech .nh-btn-icon{background:rgba(255,140,50,0.09);color:#ff9a4a;}
    .nh-btn.mech:hover{border-color:rgba(255,140,50,0.25);}
    .nh-btn.merge .nh-btn-icon{background:rgba(192,80,255,0.09);color:#c850ff;}
    .nh-btn.merge:hover{border-color:rgba(192,80,255,0.25);}
    .nh-subpanel{display:none;margin-top:4px;padding:3px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.055);border-radius:7px;}
    .nh-subpanel.open{display:block;animation:nh-fade-in 0.16s ease;}
    .nh-sub-btn{width:100%;padding:6px 10px;background:transparent;border:none;color:rgba(255,255,255,0.6);font-family:'DM Sans',sans-serif;font-size:11px;cursor:pointer;text-align:left;border-radius:5px;display:flex;align-items:center;gap:7px;transition:background 0.1s;}
    .nh-sub-btn:hover{background:rgba(255,255,255,0.06);color:#fff;}
    .nh-sub-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
    #nh-narrative{display:none;margin-top:8px;padding:11px 12px;background:rgba(95,127,255,0.04);border:1px solid rgba(95,127,255,0.16);border-radius:7px;font-size:10.5px;color:rgba(255,255,255,0.62);line-height:1.65;font-family:'DM Sans',sans-serif;}
    #nh-narrative.visible{display:block;animation:nh-fade-in 0.28s ease;}
    .nh-narrative-title{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:0.09em;color:rgba(127,168,255,0.55);margin-bottom:5px;text-transform:uppercase;}
    .nh-merge-panel{display:none;margin-top:6px;padding:10px 11px;background:rgba(192,80,255,0.04);border:1px solid rgba(192,80,255,0.18);border-radius:7px;}
    .nh-merge-panel.open{display:block;animation:nh-fade-in 0.16s ease;}
    .nh-merge-label{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:0.09em;color:rgba(200,80,255,0.65);margin-bottom:6px;text-transform:uppercase;}
    .nh-merge-info{font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:8px;line-height:1.5;}
    .nh-merge-opt{width:100%;padding:7px 10px;margin-bottom:3px;background:rgba(255,255,255,0.03);border:1px solid rgba(192,80,255,0.15);border-radius:6px;color:rgba(255,255,255,0.65);font-family:'DM Sans',sans-serif;font-size:11px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px;transition:all 0.13s;}
    .nh-merge-opt:hover{background:rgba(192,80,255,0.1);color:#fff;border-color:rgba(192,80,255,0.35);}
    .nh-merge-opt svg{width:12px;height:12px;stroke:currentColor;stroke-width:1.8;fill:none;flex-shrink:0;opacity:0.7;}
    .nh-merge-result{display:none;margin-top:7px;padding:9px 11px;background:rgba(192,80,255,0.04);border:1px solid rgba(192,80,255,0.18);border-radius:6px;font-size:10.5px;color:rgba(255,255,255,0.6);line-height:1.6;}
    .nh-merge-result.visible{display:block;animation:nh-fade-in 0.2s ease;}
    #nh-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(14px);background:rgba(8,10,22,0.97);border:1px solid rgba(95,127,255,0.32);border-radius:9px;padding:8px 17px;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#7fa8ff;z-index:9999;opacity:0;transition:all 0.2s ease;pointer-events:none;max-width:320px;text-align:center;box-shadow:0 5px 22px rgba(0,0,0,0.5);}
    #nh-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
    #nh-toast.error{border-color:rgba(255,82,82,0.4);color:#ff8a8a;}
    #nh-toast.success{border-color:rgba(76,239,172,0.4);color:#4cefac;}
    .nh-loading{display:inline-block;width:11px;height:11px;border:2px solid rgba(255,255,255,0.1);border-top-color:currentColor;border-radius:50%;animation:nh-spin 0.6s linear infinite;flex-shrink:0;}
    @keyframes nh-spin{to{transform:rotate(360deg);}}
    @keyframes nh-fade-in{from{opacity:0;transform:translateY(3px);}to{opacity:1;transform:translateY(0);}}
  `;
  document.head.appendChild(s);
}

// ====================================================
//  PANEL
// ====================================================
function injectPanel() {
  const overlay = document.createElement('div');
  overlay.id = 'nexus-helper-overlay';
  overlay.innerHTML = `
    <div id="nexus-helper-panel">
      <div class="nh-header">
        <div class="nh-logo"><svg viewBox="0 0 24 24"><polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/><circle cx="12" cy="12" r="3"/></svg></div>
        <div class="nh-title-block">
          <div class="nh-title">NEXUS HELPER</div>
          <div class="nh-subtitle">AI-POWERED TRANSFORMATIONS</div>
        </div>
        <button class="nh-close" id="nh-close-btn"><svg viewBox="0 0 14 14"><line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/></svg></button>
      </div>

      <button class="nh-edit-nexal" id="nh-edit-nexal-btn">
        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span style="flex:1">Ativar Edit Nexal</span>
        <span class="nh-edit-status" id="nh-edit-status">INATIVO</span>
      </button>

      <div class="nh-category">
        <div class="nh-cat-label">🌿 Evolution</div>
        <button class="nh-btn evolution" id="nh-evolve-btn">
          <div class="nh-btn-icon"><svg viewBox="0 0 24 24"><path d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z"/><path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4"/></svg></div>
          <div class="nh-btn-text">
            <div class="nh-btn-title">Evoluir por 1 Milhão de Anos</div>
            <div class="nh-btn-desc">IA narra evolução em planeta com predadores</div>
          </div><span class="nh-btn-arrow">›</span>
        </button>
        <div id="nh-narrative"><div class="nh-narrative-title">⟡ Nexus Evolution Log</div><div id="nh-narrative-text"></div></div>
      </div>

      <div class="nh-category">
        <div class="nh-cat-label">⚗️ Transform</div>
        <button class="nh-btn transform-gold" id="nh-gold-btn">
          <div class="nh-btn-icon"><svg viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg></div>
          <div class="nh-btn-text"><div class="nh-btn-title">Transformar em Minério</div><div class="nh-btn-desc">Ouro, Prata, Esmeralda e outros</div></div>
          <span class="nh-btn-arrow">›</span>
        </button>
        <div id="nh-metal-subpanel" class="nh-subpanel">
          <button class="nh-sub-btn" data-metal="gold"><div class="nh-sub-dot" style="background:#ffd700"></div>Ouro</button>
          <button class="nh-sub-btn" data-metal="silver"><div class="nh-sub-dot" style="background:#c0c0c0"></div>Prata</button>
          <button class="nh-sub-btn" data-metal="copper"><div class="nh-sub-dot" style="background:#b87333"></div>Cobre</button>
          <button class="nh-sub-btn" data-metal="iron"><div class="nh-sub-dot" style="background:#6c7a89"></div>Ferro</button>
          <button class="nh-sub-btn" data-metal="obsidian"><div class="nh-sub-dot" style="background:#1a1a2e;border:1px solid #555"></div>Obsidiana</button>
          <button class="nh-sub-btn" data-metal="emerald"><div class="nh-sub-dot" style="background:#50c878"></div>Esmeralda</button>
          <button class="nh-sub-btn" data-metal="ruby"><div class="nh-sub-dot" style="background:#e0115f"></div>Rubi</button>
          <button class="nh-sub-btn" data-metal="amethyst"><div class="nh-sub-dot" style="background:#9966cc"></div>Ametista</button>
        </div>
        <button class="nh-btn transform-nano" id="nh-nano-btn">
          <div class="nh-btn-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 2"/><path d="M12 4V2M12 22v-2M4 12H2M22 12h-2"/></svg></div>
          <div class="nh-btn-text"><div class="nh-btn-title">Nanotecnologia</div><div class="nh-btn-desc">Wireframe quântico · Campo de energia pulsante</div></div>
          <span class="nh-btn-arrow">›</span>
        </button>
      </div>

      <div class="nh-category">
        <div class="nh-cat-label">🤖 Mech</div>
        <button class="nh-btn mech" id="nh-mech-btn">
          <div class="nh-btn-icon"><svg viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="5" rx="1"/><rect x="6" y="7" width="12" height="8" rx="1"/><rect x="3" y="8" width="4" height="5" rx="1"/><rect x="17" y="8" width="4" height="5" rx="1"/><rect x="8" y="15" width="3" height="7" rx="1"/><rect x="13" y="15" width="3" height="7" rx="1"/></svg></div>
          <div class="nh-btn-text"><div class="nh-btn-title">Mecanizar Objeto</div><div class="nh-btn-desc">Peças mecânicas emergem do objeto · estilo Transformers</div></div>
          <span class="nh-btn-arrow">›</span>
        </button>
      </div>

      <div class="nh-category">
        <div class="nh-cat-label">🔗 Fusion</div>
        <button class="nh-btn merge" id="nh-merge-btn">
          <div class="nh-btn-icon"><svg viewBox="0 0 24 24"><circle cx="7" cy="12" r="4"/><circle cx="17" cy="12" r="4"/><line x1="11" y1="12" x2="13" y2="12" stroke-dasharray="1.5 1.5"/></svg></div>
          <div class="nh-btn-text"><div class="nh-btn-title">Fundir Objetos</div><div class="nh-btn-desc">Geométrica · DNA · IA criativa</div></div>
          <span class="nh-btn-arrow">›</span>
        </button>
        <div id="nh-merge-panel" class="nh-merge-panel">
          <div class="nh-merge-label">⬡ Fusion Mode</div>
          <div class="nh-merge-info">Selecione 2+ objetos na cena antes de fundir.</div>
          <button class="nh-merge-opt" id="nh-merge-geo">
            <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            Fusão Geométrica — une as malhas em um só objeto
          </button>
          <button class="nh-merge-opt" id="nh-merge-dna">
            <svg viewBox="0 0 24 24"><path d="M12 2c0 4-4 6-4 10s4 6 4 10M12 2c0 4 4 6 4 10s-4 6-4 10M8 7h8M8 17h8"/></svg>
            Fusão DNA — mistura materiais e propriedades
          </button>
          <button class="nh-merge-opt" id="nh-merge-ai">
            <svg viewBox="0 0 24 24"><polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/><circle cx="12" cy="12" r="3"/></svg>
            Fusão IA — Nexus decide o resultado
          </button>
          <div id="nh-merge-result" class="nh-merge-result">
            <div class="nh-narrative-title" id="nh-merge-result-title">⟡ Resultado</div>
            <div id="nh-merge-result-text"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const toast = document.createElement('div');
  toast.id = 'nh-toast';
  document.body.appendChild(toast);

  overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });
  document.getElementById('nh-close-btn').addEventListener('click', closePanel);
  document.getElementById('nh-edit-nexal-btn').addEventListener('click', activateEditNexal);
  document.getElementById('nh-evolve-btn').addEventListener('click', runEvolution);
  document.getElementById('nh-gold-btn').addEventListener('click', () =>
    document.getElementById('nh-metal-subpanel').classList.toggle('open'));
  document.querySelectorAll('.nh-sub-btn[data-metal]').forEach(btn =>
    btn.addEventListener('click', () => transformMetal(btn.dataset.metal)));
  document.getElementById('nh-nano-btn').addEventListener('click', transformNano);
  document.getElementById('nh-mech-btn').addEventListener('click', transformMech);
  document.getElementById('nh-merge-btn').addEventListener('click', () =>
    document.getElementById('nh-merge-panel').classList.toggle('open'));
  document.getElementById('nh-merge-geo').addEventListener('click', () => runMerge('geo'));
  document.getElementById('nh-merge-dna').addEventListener('click', () => runMerge('dna'));
  document.getElementById('nh-merge-ai').addEventListener('click',  () => runMerge('ai'));
}

// ====================================================
//  ROUTING
// ====================================================
function hookModelBtn() {
  const btn = document.getElementById('model-btn');
  if (!btn) return;
  const fresh = btn.cloneNode(true);
  btn.parentNode.replaceChild(fresh, btn);
  fresh.addEventListener('click', e => { e.stopPropagation(); openPanel(); });
}
function openPanel()  { document.getElementById('nexus-helper-overlay').classList.add('nh-open'); }
function closePanel() { document.getElementById('nexus-helper-overlay').classList.remove('nh-open'); }

let _toastTimer = null;
function showToast(msg, type = 'info', dur = 4000) {
  const t = document.getElementById('nh-toast');
  t.textContent = msg;
  t.className = 'show' + (type==='error'?' error':type==='success'?' success':'');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className=''; }, dur);
}

// ====================================================
//  OBJECT HELPERS
// ====================================================
function getSelected() {
  const sel = window._nexusSelectedObjects;
  if (sel && sel.size > 0) return sel.values().next().value;
  const tc = window._nexusTransformControls;
  if (tc && tc.object) return tc.object;
  return null;
}

function getAllMeshes() {
  const scene = window._nexusScene;
  if (!scene) return [];
  const list = [];
  scene.traverse(o => {
    if (o.isMesh && !o.userData.isHelper && !o.userData.isNexusHelper
        && !o.userData.isParticle && !o.userData.isDefaultLight) list.push(o);
  });
  return list;
}

function getSelectedMeshes() {
  // main.js expõe o Set de seleção em window._nexusSelectedObjects
  const sel = window._nexusSelectedObjects;
  if (sel && sel.size > 0) {
    const list = Array.from(sel).filter(o => o.isMesh && !o.userData.isNexusHelper);
    if (list.length > 0) return list;
  }
  // fallback: objeto único no TransformControls
  const tc = window._nexusTransformControls;
  if (tc && tc.object && tc.object.isMesh) return [tc.object];
  return [];
}

function identifyShape(mesh) {
  const type = mesh?.geometry?.type || '';
  let shape = 'objeto';
  if (/Box|Cube/i.test(type))       shape = 'cubo';
  else if (/Sphere/i.test(type))    shape = 'esfera';
  else if (/Cone/i.test(type))      shape = 'cone';
  else if (/Cylinder/i.test(type))  shape = 'cilindro';
  else if (/Torus/i.test(type))     shape = 'torus';

  let mineral = 'granito';
  const hex = mesh?.material?.color?.getHex?.() ?? 0xaaaaaa;
  const r=(hex>>16)&255, g=(hex>>8)&255, b=hex&255;
  if (r>200&&g>170&&b<80)       mineral='ouro';
  else if (r>170&&g>170&&b>170) mineral='prata';
  else if (r>160&&g<110&&b<80)  mineral='cobre';
  else if (r<80&&g<80&&b<80)    mineral='obsidiana';
  else if (g>150&&r<100)        mineral='esmeralda';
  else if (r>180&&g<60)         mineral='rubi';
  else if (b>150&&r>100)        mineral='ametista';
  return { shape, mineral };
}

// ====================================================
//  EDIT NEXAL
// ====================================================
function activateEditNexal() {
  const btn    = document.getElementById('nh-edit-nexal-btn');
  const status = document.getElementById('nh-edit-status');
  const isOn   = btn.classList.toggle('active');
  status.textContent = isOn ? 'ATIVO' : 'INATIVO';
  if (isOn) {
    document.getElementById('modeling-toggle-btn')?.click();
    showToast('✦ Edit Nexal ativado', 'success');
    closePanel();
  } else {
    document.getElementById('mod-exit-btn')?.click();
    showToast('Edit Nexal desativado');
  }
}

// ====================================================
//  EVOLUTION
// ====================================================
async function runEvolution() {
  const mesh = getSelected();
  if (!mesh) { showToast('⚠ Selecione um objeto primeiro', 'error'); return; }
  const { shape, mineral } = identifyShape(mesh);
  const evBtn = document.getElementById('nh-evolve-btn');
  const narEl = document.getElementById('nh-narrative');
  const narTx = document.getElementById('nh-narrative-text');

  evBtn.innerHTML = `<div class="nh-btn-icon evolution"><div class="nh-loading" style="color:#4cefac"></div></div><div class="nh-btn-text"><div class="nh-btn-title">Simulando…</div><div class="nh-btn-desc">Nexus IA · 1.000.000 anos</div></div>`;
  narEl.classList.add('visible');
  narTx.textContent = '⟳ Calculando trajetória evolutiva…';

  try {
    const res  = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514', max_tokens:1000,
        messages:[{ role:'user', content:`Você é o NEXUS, IA de simulação evolutiva. Um ${shape} feito de ${mineral} foi colocado em um planeta alienígena hostil com predadores mortais. Simule em 5 etapas (200.000 anos cada) como ele evolui em 1 MILHÃO DE ANOS. Seja dramático e científico-ficcional. Descreva mutações, adaptações e batalhas épicas. Máximo 200 palavras. Escreva em Português.` }]
      })
    });
    const data = await res.json();
    narTx.innerHTML = (data.content?.[0]?.text || 'Falha.').replace(/\n/g,'<br>');
    animateEvolution(mesh);
    showToast('✦ Evolução concluída!', 'success');
  } catch {
    narTx.textContent = '⚠ Falha ao conectar com Nexus IA.';
    showToast('Erro na simulação', 'error');
  }

  evBtn.innerHTML = `<div class="nh-btn-icon"><svg viewBox="0 0 24 24"><path d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z"/><path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4"/></svg></div><div class="nh-btn-text"><div class="nh-btn-title">Evoluir por 1 Milhão de Anos</div><div class="nh-btn-desc">IA narra evolução em planeta com predadores</div></div><span class="nh-btn-arrow">›</span>`;
}

function animateEvolution(mesh) {
  if (!mesh?.material?.color) return;
  const steps = [0x22e866,0x1a9aff,0xb44aff,0xffaa22,0x14e87a];
  let i = 0;
  const iv = setInterval(() => {
    mesh.material.color.lerp(new THREE.Color(steps[i%steps.length]), 0.45);
    mesh.material.needsUpdate = true;
    if (++i >= steps.length*2) {
      clearInterval(iv);
      mesh.material.color.set(0x14e87a);
      if ('emissive'          in mesh.material) mesh.material.emissive.set(0x04401a);
      if ('emissiveIntensity' in mesh.material) mesh.material.emissiveIntensity = 0.4;
      if ('roughness'         in mesh.material) mesh.material.roughness = 0.3;
      mesh.material.needsUpdate = true;
    }
  }, 200);
}

// ====================================================
//  TRANSFORM METAL
// ====================================================
const METALS = {
  gold:     {color:0xffd700,emissive:0x3a2800,metalness:1.0, roughness:0.1,  name:'Ouro'},
  silver:   {color:0xd0d0d8,emissive:0x0a0a10,metalness:1.0, roughness:0.08, name:'Prata'},
  copper:   {color:0xb87333,emissive:0x180600,metalness:0.9, roughness:0.2,  name:'Cobre'},
  iron:     {color:0x6c7a89,emissive:0x040404,metalness:0.95,roughness:0.35, name:'Ferro'},
  obsidian: {color:0x1a1a2e,emissive:0x100028,metalness:0.0, roughness:0.04, name:'Obsidiana'},
  emerald:  {color:0x0a9e3c,emissive:0x022510,metalness:0.2, roughness:0.1,  name:'Esmeralda'},
  ruby:     {color:0xcc0033,emissive:0x280008,metalness:0.2, roughness:0.07, name:'Rubi'},
  amethyst: {color:0x7b2fbe,emissive:0x160028,metalness:0.3, roughness:0.1,  name:'Ametista'},
};

function transformMetal(key) {
  const mesh = getSelected();
  if (!mesh) { showToast('⚠ Selecione um objeto primeiro','error'); return; }
  const cfg = METALS[key];
  if (!cfg||!mesh.material) return;
  document.getElementById('nh-metal-subpanel').classList.remove('open');
  const orig = mesh.material.color?.clone() ?? new THREE.Color(1,1,1);
  const tgt  = new THREE.Color(cfg.color);
  let f=0;
  const iv = setInterval(() => {
    f++;
    mesh.material.color?.lerpColors(orig, tgt, f/20);
    mesh.material.needsUpdate = true;
    if (f>=20) {
      clearInterval(iv);
      mesh.material.color?.setHex(cfg.color);
      if ('emissive'          in mesh.material) mesh.material.emissive.setHex(cfg.emissive);
      if ('emissiveIntensity' in mesh.material) mesh.material.emissiveIntensity = 0.25;
      if ('metalness'         in mesh.material) mesh.material.metalness = cfg.metalness;
      if ('roughness'         in mesh.material) mesh.material.roughness = cfg.roughness;
      mesh.material.needsUpdate = true;
      spawnBurst(mesh, new THREE.Color(cfg.color));
      showToast(`✦ Transformado em ${cfg.name}!`, 'success');
    }
  }, 30);
}

// ====================================================
//  NANO
// ====================================================
function transformNano() {
  const mesh = getSelected();
  if (!mesh) { showToast('⚠ Selecione um objeto primeiro','error'); return; }
  if (mesh.material) {
    mesh.material.color?.setHex(0x00ddff);
    if ('emissive'          in mesh.material) mesh.material.emissive.setHex(0x003a4a);
    if ('emissiveIntensity' in mesh.material) mesh.material.emissiveIntensity = 1.2;
    if ('metalness'         in mesh.material) mesh.material.metalness = 0.9;
    if ('roughness'         in mesh.material) mesh.material.roughness = 0.0;
    if ('transparent'       in mesh.material) mesh.material.transparent = true;
    if ('opacity'           in mesh.material) mesh.material.opacity = 0.72;
    mesh.material.needsUpdate = true;
  }
  mesh.children.filter(c=>c.userData.isNanoWire).forEach(c => {
    clearInterval(c.userData._pulseId); mesh.remove(c);
  });
  const wireMat = new THREE.MeshBasicMaterial({color:0x00ffff,wireframe:true,transparent:true,opacity:0.22});
  const wireMesh = new THREE.Mesh(mesh.geometry.clone(), wireMat);
  wireMesh.userData.isNanoWire = true;
  wireMesh.userData.isNexusHelper = true;
  mesh.add(wireMesh);
  let t=0;
  wireMesh.userData._pulseId = setInterval(() => { t+=0.06; wireMat.opacity=0.12+Math.sin(t)*0.12; }, 30);
  spawnBurst(mesh, new THREE.Color(0x00ddff));
  showToast('✦ Nanotecnologia ativada!', 'success');
}

// ====================================================
//  MECH — peças emergem do objeto
// ====================================================
function transformMech() {
  const mesh = getSelected();
  if (!mesh) { showToast('⚠ Selecione um objeto primeiro','error'); return; }
  if (mesh.userData.isMechanized) { showToast('⚠ Objeto já foi mecanizado','error'); return; }
  mesh.userData.isMechanized = true;

  const scene  = window._nexusScene;
  const bbox   = new THREE.Box3().setFromObject(mesh);
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  const size   = new THREE.Vector3();
  bbox.getSize(size);
  const u = Math.max(size.x, size.y, size.z) * 0.18;

  const { shape, mineral } = identifyShape(mesh);

  const accentHex = mineral==='ouro'?0xffd700:mineral==='cobre'?0xb87333:
                    mineral==='ferro'?0x8899aa:mineral==='esmeralda'?0x22ee66:0x44aaff;
  const bodyHex   = 0x777e8a;

  // Stylize the base object as metal chassis
  if (mesh.material) {
    mesh.material.color?.setHex(bodyHex);
    if ('metalness'         in mesh.material) mesh.material.metalness = 0.95;
    if ('roughness'         in mesh.material) mesh.material.roughness = 0.25;
    if ('emissive'          in mesh.material) mesh.material.emissive.setHex(accentHex);
    if ('emissiveIntensity' in mesh.material) mesh.material.emissiveIntensity = 0.06;
    mesh.material.needsUpdate = true;
  }

  const bodyMat = new THREE.MeshStandardMaterial({color:bodyHex, metalness:0.95, roughness:0.25});
  const accMat  = new THREE.MeshStandardMaterial({color:accentHex, metalness:1.0, roughness:0.05,
    emissive:new THREE.Color(accentHex), emissiveIntensity:0.55});
  const glowMat = new THREE.MeshStandardMaterial({color:accentHex,
    emissive:new THREE.Color(accentHex), emissiveIntensity:2.5, transparent:true, opacity:0.85});

  // Attachment definitions — all start at center, scale 0, emerge outward
  const C = center;
  const attachments = [
    // Shoulder plates
    {geo:new THREE.BoxGeometry(u*1.6,u*0.7,u*1.2), mat:bodyMat,
     fin:new THREE.Vector3(C.x-size.x*.5-u*.8, C.y+size.y*.28, C.z), label:'sL'},
    {geo:new THREE.BoxGeometry(u*1.6,u*0.7,u*1.2), mat:bodyMat,
     fin:new THREE.Vector3(C.x+size.x*.5+u*.8, C.y+size.y*.28, C.z), label:'sR'},
    // Arm cannons
    {geo:new THREE.CylinderGeometry(u*.22,u*.28,u*2.2,8), mat:bodyMat,
     fin:new THREE.Vector3(C.x-size.x*.5-u*.7, C.y-size.y*.08, C.z),
     rot:new THREE.Euler(0,0,Math.PI/2), label:'cL'},
    {geo:new THREE.CylinderGeometry(u*.22,u*.28,u*2.2,8), mat:bodyMat,
     fin:new THREE.Vector3(C.x+size.x*.5+u*.7, C.y-size.y*.08, C.z),
     rot:new THREE.Euler(0,0,-Math.PI/2), label:'cR'},
    // Cannon barrels (accent)
    {geo:new THREE.CylinderGeometry(u*.12,u*.12,u*.85,8), mat:accMat,
     fin:new THREE.Vector3(C.x-size.x*.5-u*1.75, C.y-size.y*.08, C.z),
     rot:new THREE.Euler(0,0,Math.PI/2), label:'bL'},
    {geo:new THREE.CylinderGeometry(u*.12,u*.12,u*.85,8), mat:accMat,
     fin:new THREE.Vector3(C.x+size.x*.5+u*1.75, C.y-size.y*.08, C.z),
     rot:new THREE.Euler(0,0,-Math.PI/2), label:'bR'},
    // Legs
    {geo:new THREE.BoxGeometry(u*.7,u*1.8,u*.7), mat:bodyMat,
     fin:new THREE.Vector3(C.x-size.x*.22, C.y-size.y*.5-u*.9, C.z), label:'lL'},
    {geo:new THREE.BoxGeometry(u*.7,u*1.8,u*.7), mat:bodyMat,
     fin:new THREE.Vector3(C.x+size.x*.22, C.y-size.y*.5-u*.9, C.z), label:'lR'},
    // Feet (accent)
    {geo:new THREE.BoxGeometry(u*.9,u*.28,u*1.1), mat:accMat,
     fin:new THREE.Vector3(C.x-size.x*.22, C.y-size.y*.5-u*1.9, C.z+u*.18), label:'fL'},
    {geo:new THREE.BoxGeometry(u*.9,u*.28,u*1.1), mat:accMat,
     fin:new THREE.Vector3(C.x+size.x*.22, C.y-size.y*.5-u*1.9, C.z+u*.18), label:'fR'},
    // Head
    {geo:new THREE.BoxGeometry(u*1.1,u*.9,u*.9), mat:bodyMat,
     fin:new THREE.Vector3(C.x, C.y+size.y*.5+u*.6, C.z), label:'head'},
    // Eyes
    {geo:new THREE.SphereGeometry(u*.13,8,8), mat:glowMat,
     fin:new THREE.Vector3(C.x-u*.26, C.y+size.y*.5+u*.65, C.z+u*.42), label:'eL'},
    {geo:new THREE.SphereGeometry(u*.13,8,8), mat:glowMat,
     fin:new THREE.Vector3(C.x+u*.26, C.y+size.y*.5+u*.65, C.z+u*.42), label:'eR'},
    // Spine
    {geo:new THREE.BoxGeometry(u*.38,u*2.4,u*.28), mat:bodyMat,
     fin:new THREE.Vector3(C.x, C.y+size.y*.04, C.z-size.z*.5-u*.18), label:'spine'},
    // Chest glow
    {geo:new THREE.BoxGeometry(u*.92,u*.62,u*.1), mat:accMat,
     fin:new THREE.Vector3(C.x, C.y+size.y*.1, C.z+size.z*.5+u*.06), label:'chest'},
  ];

  // Partes são adicionadas DIRETAMENTE na cena (não como filhos do objeto)
  // Todas as posições são em espaço-mundo
  const parts = attachments.map(a => {
    const m = new THREE.Mesh(a.geo, a.mat);
    // Começa no centro-mundo do objeto, escala zero (parece sair de dentro)
    m.position.copy(center);
    m.scale.set(0.01, 0.01, 0.01);
    if (a.rot) m.rotation.copy(a.rot);
    m.castShadow = true;
    m.userData.isNexusHelper = true;
    m.userData.mechLabel = a.label;
    scene.add(m);   // na cena, não no mesh
    return { mesh: m, fin: a.fin, initRot: a.rot || new THREE.Euler(), label: a.label };
  });

  mesh.userData.mechParts = parts;

  // Phase 1: shake → burst → parts emerge staggered
  shakeObject(mesh, 0.55).then(() => {
    spawnBurst(mesh, new THREE.Color(accentHex));
    parts.forEach((p, i) => {
      setTimeout(() => emergePart(p), i * 55);
    });
    setTimeout(() => {
      startMechIdle(parts, center, size, mesh);
      showToast(`✦ ${shape.toUpperCase()} mecanizado! (${mineral})`, 'success', 5000);
    }, parts.length * 55 + 850);
  });

  showToast(`⟳ Mecanizando ${shape}…`, 'info', 4000);
}

function emergePart(part) {
  const startPos = part.mesh.position.clone(); // at center
  const dur   = 680;
  const start = performance.now();
  function f(now) {
    const t    = Math.min((now-start)/dur, 1);
    // Spring ease
    const ease = t===1 ? 1 : 1-Math.pow(2,-10*t)*Math.cos((t*10-0.75)*(2*Math.PI)/3);
    part.mesh.position.lerpVectors(startPos, part.fin, ease);
    const s = Math.min(ease*1.06, 1);
    part.mesh.scale.set(s,s,s);
    if (t<1) {
      requestAnimationFrame(f);
    } else {
      part.mesh.position.copy(part.fin);
      part.mesh.scale.set(1,1,1);
    }
  }
  requestAnimationFrame(f);
}

function startMechIdle(parts, center, size, baseMesh) {
  // Parts são filhos diretos da cena — posições em espaço-mundo
  const legL = parts.find(p => p.label === 'lL');
  const legR = parts.find(p => p.label === 'lR');
  let t = 0;
  function tick() {
    if (!baseMesh.parent) return; // mesh removido da cena — para tudo
    t += 0.02;
    parts.forEach(p => {
      if (p.label === 'cL') p.mesh.rotation.z = Math.PI / 2 + Math.sin(t * 1.3) * 0.07;
      if (p.label === 'cR') p.mesh.rotation.z = -Math.PI / 2 + Math.sin(t * 1.3 + 0.6) * 0.07;
      if (p.label === 'sL') p.mesh.rotation.z = Math.sin(t * 0.9) * 0.05;
      if (p.label === 'sR') p.mesh.rotation.z = -Math.sin(t * 0.9) * 0.05;
    });
    // Pernas alternam em espaço-mundo
    if (legL) legL.mesh.position.y = legL.fin.y + Math.sin(t * 1.6) * 0.014 * (size.y || 1);
    if (legR) legR.mesh.position.y = legR.fin.y + Math.sin(t * 1.6 + Math.PI) * 0.014 * (size.y || 1);
    requestAnimationFrame(tick);
  }
  tick();
}

function shakeObject(mesh, dur) {
  return new Promise(res => {
    const orig = mesh.position.clone();
    const end  = performance.now() + dur*1000;
    function f(now) {
      if (now>end) { mesh.position.copy(orig); return res(); }
      const s = (end-now)/(dur*1000);
      mesh.position.x = orig.x+(Math.random()-.5)*.09*s;
      mesh.position.y = orig.y+(Math.random()-.5)*.09*s;
      mesh.position.z = orig.z+(Math.random()-.5)*.09*s;
      requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  });
}

// ====================================================
//  MERGE
// ====================================================
async function runMerge(mode) {
  const scene   = window._nexusScene;
  let meshes    = getSelectedMeshes();
  if (meshes.length < 2) {
    const all = getAllMeshes();
    if (all.length < 2) { showToast('⚠ Adicione pelo menos 2 objetos à cena','error'); return; }
    meshes = all.slice(0,2);
    showToast('Nenhuma seleção — usando os 2 primeiros objetos','info',2500);
  }

  const resultEl    = document.getElementById('nh-merge-result');
  const resultTitle = document.getElementById('nh-merge-result-title');
  const resultText  = document.getElementById('nh-merge-result-text');
  resultEl.classList.remove('visible');

  // ── GEO ────────────────────────────────────────────────────────
  if (mode === 'geo') {
    try {
      const geos = meshes.map(m => { const g=m.geometry.clone(); g.applyMatrix4(m.matrixWorld); return g; });
      const merged  = window._mergeGeometries(geos, false);
      const newMesh = new THREE.Mesh(merged, meshes[0].material.clone());
      newMesh.castShadow = true;
      newMesh.userData.isMerged = true;
      meshes.forEach(m => scene.remove(m));
      scene.add(newMesh);
      spawnBurst(newMesh, new THREE.Color(0xc850ff));
      showToast('✦ Fusão Geométrica completa!','success');
      resultTitle.textContent = '⟡ Fusão Geométrica';
      resultText.textContent  = `${meshes.length} objetos fundidos em uma única malha. Material herdado do primeiro objeto.`;
      resultEl.classList.add('visible');
    } catch(e) {
      showToast('⚠ Erro ao fundir geometrias','error');
      console.error('[NexusHelper] merge-geo:',e);
    }

  // ── DNA ────────────────────────────────────────────────────────
  } else if (mode === 'dna') {
    const m1=meshes[0], m2=meshes[1];
    const {shape:s1,mineral:min1}=identifyShape(m1);
    const {shape:s2,mineral:min2}=identifyShape(m2);

    // ── Fase 1: os dois objetos se movem em direção ao centro com rotação ──
    const midPoint = new THREE.Vector3().addVectors(m1.position, m2.position).multiplyScalar(0.5);
    const p1s=m1.position.clone(), p2s=m2.position.clone();
    const startT = performance.now();
    await new Promise(res => {
      function f(now) {
        const t = Math.min((now-startT)/700, 1);
        const ease = 1 - Math.pow(1-t, 3);
        m1.position.lerpVectors(p1s, midPoint, ease);
        m2.position.lerpVectors(p2s, midPoint, ease);
        m1.rotation.z += 0.04;
        m2.rotation.z -= 0.04;
        if (t<1) requestAnimationFrame(f); else res();
      }
      requestAnimationFrame(f);
    });

    // ── Fase 2: flash de fusão ──
    const flashDummy = { getWorldPosition: (v) => v.copy(midPoint) };
    spawnBurst(flashDummy, new THREE.Color(0xc850ff));
    await new Promise(res => setTimeout(res, 120));

    // ── Fase 3: cria objeto híbrido ──
    // Geometria: mistura os vértices das duas geometrias numa nova usando mergeGeometries
    // mas com cada geo escalada por 0.5 e deslocada para simular fusão DNA
    const g1 = m1.geometry.clone();
    const g2 = m2.geometry.clone();

    // Escala g1 para 60% do tamanho, g2 para 60%, depois posiciona g2 ligeiramente offset
    const halfSize1 = new THREE.Vector3();
    new THREE.Box3().setFromObject(m1).getSize(halfSize1);
    const halfSize2 = new THREE.Vector3();
    new THREE.Box3().setFromObject(m2).getSize(halfSize2);

    // Aplica a matrix world de cada um para trazer para espaço-mundo, depois centraliza
    g1.applyMatrix4(m1.matrixWorld);
    g2.applyMatrix4(m2.matrixWorld);

    // Escala as geometrias para 60% em relação ao midPoint
    const scaleAroundPoint = (geo, pivot, s) => {
      const mat = new THREE.Matrix4();
      mat.makeTranslation(-pivot.x, -pivot.y, -pivot.z);
      geo.applyMatrix4(mat);
      mat.makeScale(s, s, s);
      geo.applyMatrix4(mat);
      mat.makeTranslation(pivot.x, pivot.y, pivot.z);
      geo.applyMatrix4(mat);
    };
    scaleAroundPoint(g1, midPoint, 0.62);
    scaleAroundPoint(g2, midPoint, 0.62);

    // Desloca g2 levemente em espiral para o efeito DNA
    const offset = new THREE.Matrix4().makeTranslation(
      halfSize1.x * 0.18,
      halfSize1.y * 0.18,
      halfSize1.z * 0.12
    );
    g2.applyMatrix4(offset);

    // Funde as duas geometrias em um único mesh híbrido
    const mergedGeo = window._mergeGeometries([g1, g2], false);

    // Material híbrido: mistura cor, metalness, roughness e emissive
    const c1 = m1.material?.color?.clone() ?? new THREE.Color(1,1,1);
    const c2 = m2.material?.color?.clone() ?? new THREE.Color(1,1,1);
    const blended = c1.clone().lerp(c2, 0.5);
    const avgM = ((m1.material?.metalness ?? 0.5) + (m2.material?.metalness ?? 0.5)) / 2;
    const avgR = ((m1.material?.roughness ?? 0.5) + (m2.material?.roughness ?? 0.5)) / 2;
    const avgE = ((m1.material?.emissiveIntensity ?? 0) + (m2.material?.emissiveIntensity ?? 0)) / 2;

    const hybridMat = new THREE.MeshStandardMaterial({
      color: blended,
      metalness: Math.min(avgM * 1.15, 1),   // híbrido é levemente mais metálico
      roughness: Math.max(avgR * 0.85, 0),    // e levemente mais polido
      emissive: blended.clone().multiplyScalar(0.18),
      emissiveIntensity: Math.max(avgE, 0.2),
    });

    const hybrid = new THREE.Mesh(mergedGeo, hybridMat);
    hybrid.castShadow = true;
    hybrid.receiveShadow = true;
    hybrid.userData.isDNAHybrid = true;
    hybrid.userData.dnaParents = [s1, s2];

    // ── Fase 4: remove os pais e adiciona o híbrido ──
    scene.remove(m1);
    scene.remove(m2);
    // Remove do sceneObjects se existir
    if (window.sceneObjects) {
      const sc = window.sceneObjects;
      const i1 = sc.indexOf(m1), i2 = sc.indexOf(m2);
      if (i1 !== -1) sc.splice(i1, 1);
      const i2b = sc.indexOf(m2);
      if (i2b !== -1) sc.splice(i2b, 1);
      sc.push(hybrid);
    }
    scene.add(hybrid);

    // Seleciona o híbrido
    if (window._nexusSelectedObjects) {
      window._nexusSelectedObjects.clear();
      window._nexusSelectedObjects.add(hybrid);
    }
    if (window._nexusTransformControls) window._nexusTransformControls.attach(hybrid);

    // Animação de entrada: o híbrido cresce de 0 a 1
    hybrid.scale.set(0.01, 0.01, 0.01);
    spawnBurst(hybrid, blended.clone().lerp(new THREE.Color(0xffffff), 0.3));
    const growStart = performance.now();
    await new Promise(res => {
      function grow(now) {
        const t = Math.min((now-growStart)/500, 1);
        const s = 1 - Math.pow(1-t, 3);
        hybrid.scale.set(s, s, s);
        if (t < 1) requestAnimationFrame(grow); else { hybrid.scale.set(1,1,1); res(); }
      }
      requestAnimationFrame(grow);
    });

    showToast('✦ Fusão DNA completa! Híbrido criado.', 'success');
    resultTitle.textContent = '⟡ Fusão DNA';
    resultText.textContent = `${s1} (${min1}) ✕ ${s2} (${min2}) — novo objeto híbrido criado com geometria e material misturados dos dois originais.`;
    resultEl.classList.add('visible');

  // ── AI ────────────────────────────────────────────────────────
  } else if (mode === 'ai') {
    resultTitle.textContent='⟡ Nexus IA Fusion';
    resultText.innerHTML='<span style="color:rgba(200,80,255,0.6)">⟳ Calculando fusão…</span>';
    resultEl.classList.add('visible');
    const descs=meshes.map(m=>{ const {shape,mineral}=identifyShape(m); return `${shape} de ${mineral}`; });
    try {
      const res=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514',max_tokens:500,
          messages:[{role:'user',content:`Você é o NEXUS, IA de fusão. Os objetos fundidos: ${descs.join(' + ')}. Descreva criativamente o híbrido resultante: nome único, aparência, propriedades especiais e poderes. Máximo 120 palavras. Português.`}]
        })
      });
      const data=await res.json();
      resultText.innerHTML=(data.content?.[0]?.text??'Falha.').replace(/\n/g,'<br>');
      meshes.forEach(m => {
        if (m.material?.color) m.material.color.lerp(new THREE.Color(0xc850ff),0.5);
        if ('emissive'          in (m.material??{})) m.material.emissive.setHex(0x3a0055);
        if ('emissiveIntensity' in (m.material??{})) m.material.emissiveIntensity=0.4;
        if ('metalness'         in (m.material??{})) m.material.metalness=0.8;
        if ('roughness'         in (m.material??{})) m.material.roughness=0.12;
        m.material.needsUpdate=true;
      });
      spawnBurst(meshes[0], new THREE.Color(0xc850ff));
      showToast('✦ Fusão IA concluída!','success');
    } catch {
      resultText.textContent='⚠ Falha ao contatar Nexus IA.';
      showToast('Erro na fusão IA','error');
    }
  }
}

// ====================================================
//  PARTICLE BURST
// ====================================================
function spawnBurst(mesh, color) {
  const scene=window._nexusScene; if(!scene) return;
  const pos=new THREE.Vector3(); mesh.getWorldPosition(pos);
  const count=55, geo=new THREE.BufferGeometry();
  const arr=new Float32Array(count*3), vels=[];
  for (let i=0;i<count;i++) {
    arr[i*3]=pos.x; arr[i*3+1]=pos.y; arr[i*3+2]=pos.z;
    vels.push(new THREE.Vector3((Math.random()-.5)*.18,Math.random()*.22+.04,(Math.random()-.5)*.18));
  }
  geo.setAttribute('position',new THREE.BufferAttribute(arr,3));
  const mat=new THREE.PointsMaterial({color,size:0.07,transparent:true,opacity:1});
  const pts=new THREE.Points(geo,mat); scene.add(pts);
  let f=0;
  function tick() {
    f++;
    const a=geo.attributes.position.array;
    for (let i=0;i<count;i++) { a[i*3]+=vels[i].x; a[i*3+1]+=vels[i].y; a[i*3+2]+=vels[i].z; vels[i].y-=0.009; }
    geo.attributes.position.needsUpdate=true;
    mat.opacity=Math.max(0,1-f/42);
    if (f<42) requestAnimationFrame(tick); else scene.remove(pts);
  }
  requestAnimationFrame(tick);
}
