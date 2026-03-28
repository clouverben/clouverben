// ==================== ANIMATION.JS v5 ====================
// Dope Sheet · Graph Editor · Onion Skin · Marcadores · Loop Region · Auto-Key

const AnimState = {
    visible: false, isPlaying: false, currentFrame: 0, frameExact: 0,
    fps: 24, totalFrames: 100000, keyframes: {}, lastTimestamp: null,
    interpMode: 'smooth', selectedKF: null, copiedKF: null,
    markers: {},          // { frame: 'label' }
};

const DopeSheetState = { visible: false };
const GraphEdState   = { visible: false, channels: new Set(['px','py','pz']) };
const OnionState     = { panelVisible: false, enabled: false, framesBefore: 2, framesAfter: 2, opacity: 0.35, ghosts: [] };
const MarkerState    = { visible: false };
const LoopState      = { visible: false, enabled: false, inFrame: 0, outFrame: 100 };
const AutoKeyState   = { enabled: false };

const FRAME_WIDTH = 14;

// ==================== UI ====================
function createTimelineUI() {
    if (document.getElementById('timeline-container')) return;
    const container = document.createElement('div');
    container.id = 'timeline-container';
    container.innerHTML = `
        <!-- ── PAINEL ENGRENAGEM ─────────────────────────── -->
        <div class="fps-panel hidden" id="fps-panel">
            <label style="font-size:11px;color:rgba(255,255,255,.5)">FPS</label>
            <input type="number" id="fps-input" min="1" max="120" value="24">
            <button id="fps-apply-btn">✔</button>
            <div class="fps-divider"></div>
            <label style="font-size:11px;color:rgba(255,255,255,.5)">Interpolação</label>
            <div class="interp-btns">
                <button id="interp-smooth-btn"   class="interp-btn active" title="Suave">
                    <svg viewBox="0 0 22 10" width="22" height="10"><path d="M1 9 C6 9 8 1 11 1 S16 1 21 1" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>Suave
                </button>
                <button id="interp-linear-btn"   class="interp-btn" title="Linear">
                    <svg viewBox="0 0 22 10" width="22" height="10"><line x1="1" y1="9" x2="21" y2="1" stroke="currentColor" stroke-width="1.8"/></svg>Linear
                </button>
                <button id="interp-constant-btn" class="interp-btn" title="Constante">
                    <svg viewBox="0 0 22 10" width="22" height="10"><polyline points="1,9 11,9 11,1 21,1" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>Constante
                </button>
            </div>
        </div>

        <!-- ── TOOLBAR KF ────────────────────────────────── -->
        <div id="kf-toolbar" class="kf-toolbar hidden">
            <span class="kf-toolbar-label">KF <span id="kf-toolbar-frame">—</span></span>
            <button id="kf-copy-btn"   class="kf-tool-btn" title="Copiar">
                <svg viewBox="0 0 16 16" width="13" height="13"><rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="2" y="2" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.4" fill="none" opacity=".5"/></svg>Copiar
            </button>
            <button id="kf-paste-btn" class="kf-tool-btn" title="Colar" style="display:none">
                <svg viewBox="0 0 16 16" width="13" height="13"><rect x="3" y="4" width="10" height="11" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="5" y="2" width="6" height="3" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>Colar
            </button>
            <button id="kf-delete-btn" class="kf-tool-btn kf-delete-btn" title="Deletar">
                <svg viewBox="0 0 16 16" width="13" height="13"><polyline points="2,4 14,4" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M5 4V3h6v1" stroke="currentColor" stroke-width="1.4" fill="none"/><rect x="3" y="4" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><line x1="6" y1="7" x2="6" y2="11" stroke="currentColor" stroke-width="1.4"/><line x1="10" y1="7" x2="10" y2="11" stroke="currentColor" stroke-width="1.4"/></svg>Deletar
            </button>
        </div>

        <!-- ── DOPE SHEET ─────────────────────────────────── -->
        <div id="dopesheet-panel" class="tool-panel hidden">
            <div class="tool-panel-header">
                <svg viewBox="0 0 16 16" width="13" height="13" style="opacity:.7;flex-shrink:0"><rect x="1" y="2" width="14" height="3" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="7" width="14" height="3" rx="1" fill="currentColor" opacity=".4"/><rect x="1" y="12" width="14" height="3" rx="1" fill="currentColor" opacity=".3"/></svg>
                Dope Sheet<span class="tool-panel-hint">Clique: seek · Duplo: selecionar KF</span>
                <button class="tool-panel-close" id="dopesheet-close">✕</button>
            </div>
            <div class="dopesheet-body" id="dopesheet-body"><div class="dopesheet-empty">Nenhum keyframe na cena ainda.</div></div>
        </div>

        <!-- ── GRAPH EDITOR ───────────────────────────────── -->
        <div id="graph-panel" class="tool-panel hidden">
            <div class="tool-panel-header">
                <svg viewBox="0 0 16 16" width="13" height="13" style="opacity:.7;flex-shrink:0"><polyline points="1,14 5,8 9,11 15,2" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>
                Graph Editor
                <div class="graph-channel-toggles" id="graph-channel-toggles">
                    <button data-ch="px" class="ch-btn active" style="--ch-color:#ff5f5f">PX</button>
                    <button data-ch="py" class="ch-btn active" style="--ch-color:#5fff8a">PY</button>
                    <button data-ch="pz" class="ch-btn active" style="--ch-color:#5faeff">PZ</button>
                    <button data-ch="rx" class="ch-btn" style="--ch-color:#ffb347">RX</button>
                    <button data-ch="ry" class="ch-btn" style="--ch-color:#e0a0ff">RY</button>
                    <button data-ch="rz" class="ch-btn" style="--ch-color:#00e5d4">RZ</button>
                    <button data-ch="sx" class="ch-btn" style="--ch-color:#ffe066">SX</button>
                    <button data-ch="sy" class="ch-btn" style="--ch-color:#ff91d4">SY</button>
                    <button data-ch="sz" class="ch-btn" style="--ch-color:#c0ff80">SZ</button>
                </div>
                <button class="tool-panel-close" id="graph-close">✕</button>
            </div>
            <div class="graph-body" id="graph-body"><canvas id="graph-canvas"></canvas></div>
        </div>

        <!-- ── ONION SKIN ─────────────────────────────────── -->
        <div id="onion-panel" class="tool-panel onion-panel hidden">
            <div class="tool-panel-header">
                <svg viewBox="0 0 16 16" width="13" height="13" style="opacity:.7;flex-shrink:0"><circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.2" fill="none" opacity=".6"/><circle cx="8" cy="8" r="1.2" fill="currentColor" opacity=".5"/></svg>
                Onion Skin<button class="tool-panel-close" id="onion-close">✕</button>
            </div>
            <div class="onion-body">
                <div class="onion-row"><label class="onion-label">Ativado</label><label class="onion-switch"><input type="checkbox" id="onion-enabled"><span class="onion-slider"></span></label></div>
                <div class="onion-row"><label class="onion-label" style="color:#6ec6ff">◀ Antes</label><input type="range" id="onion-before" min="1" max="6" value="2" class="onion-range onion-range-before"><span id="onion-before-val" class="onion-val">2</span></div>
                <div class="onion-row"><label class="onion-label" style="color:#ffb347">▶ Depois</label><input type="range" id="onion-after" min="1" max="6" value="2" class="onion-range onion-range-after"><span id="onion-after-val" class="onion-val">2</span></div>
                <div class="onion-row"><label class="onion-label">Opacidade</label><input type="range" id="onion-opacity" min="5" max="80" value="35" class="onion-range"><span id="onion-opacity-val" class="onion-val">35%</span></div>
            </div>
        </div>

        <!-- ── MARCADORES ─────────────────────────────────── -->
        <div id="marker-panel" class="tool-panel hidden">
            <div class="tool-panel-header">
                <svg viewBox="0 0 16 16" width="13" height="13" style="opacity:.7;flex-shrink:0"><path d="M4 2h8v9l-4 3-4-3z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
                Marcadores<span class="tool-panel-hint">M = adicionar · clique no marcador = ir até ele</span>
                <button class="tool-panel-close" id="marker-close">✕</button>
            </div>
            <div class="marker-body">
                <div class="marker-add-row">
                    <input type="text" id="marker-label-input" class="marker-input" placeholder="Nome do marcador…" maxlength="24">
                    <button id="marker-add-btn" class="marker-add-btn">＋ Adicionar</button>
                </div>
                <div id="marker-list" class="marker-list"><div class="dopesheet-empty">Nenhum marcador ainda.</div></div>
            </div>
        </div>

        <!-- ── LOOP REGION ────────────────────────────────── -->
        <div id="loop-panel" class="tool-panel loop-panel hidden">
            <div class="tool-panel-header">
                <svg viewBox="0 0 16 16" width="13" height="13" style="opacity:.7;flex-shrink:0"><path d="M3 8a5 5 0 1 1 2 4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><polyline points="3,4 3,8 7,8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
                Loop Region<button class="tool-panel-close" id="loop-close">✕</button>
            </div>
            <div class="loop-body">
                <div class="loop-row"><label class="loop-label">Ativado</label><label class="onion-switch"><input type="checkbox" id="loop-enabled"><span class="onion-slider"></span></label></div>
                <div class="loop-row">
                    <label class="loop-label" style="color:#6ec6ff">In</label>
                    <input type="number" id="loop-in" class="loop-num-input" value="0" min="0">
                    <button id="loop-in-set" class="loop-set-btn" title="Definir In no frame atual">◀ Atual</button>
                </div>
                <div class="loop-row">
                    <label class="loop-label" style="color:#ffb347">Out</label>
                    <input type="number" id="loop-out" class="loop-num-input" value="100" min="0">
                    <button id="loop-out-set" class="loop-set-btn" title="Definir Out no frame atual">Atual ▶</button>
                </div>
            </div>
        </div>

        <!-- ── AUTO-KEY ───────────────────────────────────── -->
        <div id="autokey-panel" class="tool-panel autokey-panel hidden">
            <div class="tool-panel-header">
                <svg viewBox="0 0 16 16" width="13" height="13" style="opacity:.7;flex-shrink:0"><path d="M9 7l-2 2-1-1" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><rect x="2" y="4" width="8" height="6" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="13" cy="7" r="2.5" stroke="currentColor" stroke-width="1.4" fill="none"/><line x1="13" y1="9.5" x2="13" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                Auto-Key<button class="tool-panel-close" id="autokey-close">✕</button>
            </div>
            <div class="autokey-body">
                <div class="onion-row">
                    <label class="onion-label">Ativado</label>
                    <label class="onion-switch"><input type="checkbox" id="autokey-enabled"><span class="onion-slider"></span></label>
                    <span id="autokey-status" class="autokey-status">OFF</span>
                </div>
                <div class="autokey-hint">Quando ativo, move/rota/escala o objeto com o gizmo e um keyframe é inserido automaticamente no frame atual — igual ao Auto Keying do Blender e SFM.</div>
            </div>
        </div>

        <!-- ── BARRA PRINCIPAL ────────────────────────────── -->
        <div class="timeline-bar">
            <button id="tl-play-btn" class="tl-btn tl-play" title="Play / Pause (Espaço)"><span id="tl-play-icon">▶</span></button>

            <div class="timeline-track-wrapper">
                <div id="timeline-track" class="timeline-track">
                    <div id="timeline-frames" class="timeline-frames">
                        <div id="timeline-ruler"   class="timeline-ruler"></div>
                        <div id="timeline-loop-overlay" class="timeline-loop-overlay" style="display:none"></div>
                        <div id="timeline-markers" class="timeline-markers"></div>
                        <div id="timeline-kf-layer" class="timeline-kf-layer"></div>
                    </div>
                    <div id="timeline-playhead" class="timeline-playhead"></div>
                </div>
            </div>

            <button id="tl-add-kf-btn" class="tl-btn tl-kf-btn" title="Adicionar Keyframe (K)">◆</button>

            <div class="tl-clock-group">
                <button id="tl-fps-btn" class="tl-gear-btn" title="Configurações">⚙</button>
                <div id="tl-clock" class="tl-clock">
                    <span id="tl-clock-display">0000</span>
                    <span class="tl-clock-label">fr</span>
                </div>
            </div>

            <!-- ── 6 BOTÕES ÍCONE (direita) ────────────────── -->
            <div class="tl-right-tools">
                <!-- 3 originais -->
                <button id="tl-dopesheet-btn" class="tl-right-btn" title="Dope Sheet — visão geral dos keyframes (D)">
                    <svg viewBox="0 0 16 16" width="15" height="15"><rect x="1" y="2" width="14" height="2.5" rx="1" fill="currentColor" opacity=".85"/><rect x="1" y="6.75" width="14" height="2.5" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="11.5" width="14" height="2.5" rx="1" fill="currentColor" opacity=".4"/></svg>
                </button>
                <button id="tl-graph-btn" class="tl-right-btn" title="Graph Editor — curvas de animação (G)">
                    <svg viewBox="0 0 16 16" width="15" height="15"><polyline points="1,14 4,8 8,11 12,4 15,2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <button id="tl-onion-btn" class="tl-right-btn" title="Onion Skin — fantasmas de frames (O)">
                    <svg viewBox="0 0 16 16" width="15" height="15"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.2" fill="none" opacity=".55"/><circle cx="8" cy="8" r="1.2" fill="currentColor" opacity=".5"/></svg>
                </button>
                <!-- separador visual -->
                <div class="tl-right-sep"></div>
                <!-- 3 novos -->
                <button id="tl-marker-btn" class="tl-right-btn" title="Marcadores — adicionar marcas na timeline (M)">
                    <svg viewBox="0 0 16 16" width="15" height="15"><path d="M4 2h8v9l-4 3-4-3z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/></svg>
                </button>
                <button id="tl-loop-btn" class="tl-right-btn" title="Loop Region — definir região de loop (L)">
                    <svg viewBox="0 0 16 16" width="15" height="15"><path d="M3 8a5 5 0 1 1 2 4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><polyline points="3,4 3,8 7,8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
                </button>
                <button id="tl-autokey-btn" class="tl-right-btn" title="Auto-Key — keyframe automático ao mover (A)">
                    <svg viewBox="0 0 16 16" width="15" height="15"><rect x="1" y="5" width="9" height="6" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="13" cy="7" r="2.2" stroke="currentColor" stroke-width="1.4" fill="none"/><line x1="13" y1="9.2" x2="13" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4 8l1.5 1.5L8 6.5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </div>
        </div>
    `;
    container.style.display = 'none';
    document.body.appendChild(container);
    injectStyles(); buildRuler(); setupEvents();
}

// ==================== ESTILOS ====================
function injectStyles() {
    if (document.getElementById('_anim_extra_css')) return;
    const s = document.createElement('style');
    s.id = '_anim_extra_css';
    s.textContent = `
        .fps-divider{width:1px;background:rgba(255,255,255,.1);align-self:stretch;margin:0 4px;}
        .interp-btns{display:flex;gap:4px;}
        .interp-btn{display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:5px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:rgba(255,255,255,.55);font-size:11px;font-family:inherit;cursor:pointer;transition:all .15s;}
        .interp-btn:hover{background:rgba(255,255,255,.1);color:#fff;}
        .interp-btn.active{background:rgba(76,239,172,.15);border-color:rgba(76,239,172,.45);color:#4cefac;}
        .kf-diamond.kf-selected{outline:2px solid #ff3333!important;outline-offset:3px;box-shadow:0 0 0 3px rgba(255,50,50,.35),0 0 8px rgba(255,217,92,.8),0 0 18px rgba(255,217,92,.3)!important;z-index:20;}
        .kf-toolbar{position:absolute;top:-38px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:4px;background:rgba(10,12,26,.98);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:4px 8px;backdrop-filter:blur(12px);box-shadow:0 4px 16px rgba(0,0,0,.5);white-space:nowrap;z-index:300;pointer-events:all;}
        .kf-toolbar.hidden{display:none!important;}
        .kf-toolbar-label{font-size:11px;color:rgba(255,255,255,.45);font-family:monospace;margin-right:4px;}
        .kf-tool-btn{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:5px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.7);font-size:11px;font-family:inherit;cursor:pointer;transition:all .15s;}
        .kf-tool-btn:hover{background:rgba(255,255,255,.12);color:#fff;}
        .kf-delete-btn:hover{background:rgba(255,60,60,.15);border-color:rgba(255,80,80,.4);color:#ff8888;}

        /* ── 6 BOTÕES ÍCONE ── */
        .tl-right-tools{display:flex;align-items:center;gap:3px;margin-left:4px;flex-shrink:0;}
        .tl-right-btn{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:5px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);cursor:pointer;transition:all .18s;flex-shrink:0;}
        .tl-right-btn:hover{background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.22);}
        .tl-right-btn.active{background:rgba(76,200,255,.16);border-color:rgba(76,200,255,.45);color:#4cc8ff;}
        .tl-right-btn.autokey-on{background:rgba(255,60,60,.18)!important;border-color:rgba(255,80,80,.5)!important;color:#ff7070!important;}
        .tl-right-sep{width:1px;height:18px;background:rgba(255,255,255,.1);margin:0 2px;flex-shrink:0;}

        /* ── PAINÉIS GENÉRICOS ── */
        .tool-panel{position:absolute;left:0;right:0;background:rgba(8,10,22,.97);border-top:1px solid rgba(255,255,255,.1);backdrop-filter:blur(16px);z-index:200;box-shadow:0 -4px 24px rgba(0,0,0,.6);}
        .tool-panel.hidden{display:none!important;}
        .tool-panel-header{display:flex;align-items:center;gap:7px;padding:6px 12px;background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.07);font-size:12px;font-weight:600;color:rgba(255,255,255,.75);user-select:none;}
        .tool-panel-hint{font-size:10px;color:rgba(255,255,255,.3);font-weight:400;margin-left:4px;flex:1;}
        .tool-panel-close{margin-left:auto;background:none;border:none;color:rgba(255,255,255,.35);cursor:pointer;font-size:13px;padding:2px 5px;border-radius:4px;transition:all .15s;}
        .tool-panel-close:hover{background:rgba(255,80,80,.15);color:#ff8888;}

        /* ── DOPE SHEET ── */
        #dopesheet-panel{bottom:100%;}
        .dopesheet-body{height:130px;overflow:auto;display:flex;flex-direction:column;}
        .dopesheet-empty{padding:14px 16px;font-size:11px;color:rgba(255,255,255,.25);font-style:italic;}
        .ds-row{display:flex;align-items:stretch;border-bottom:1px solid rgba(255,255,255,.05);min-height:26px;}
        .ds-row:hover{background:rgba(255,255,255,.03);}
        .ds-name{width:110px;flex-shrink:0;padding:0 10px;display:flex;align-items:center;font-size:11px;color:rgba(255,255,255,.55);border-right:1px solid rgba(255,255,255,.07);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .ds-track{flex:1;position:relative;overflow:hidden;}
        .ds-diamond{position:absolute;top:50%;transform:translate(-50%,-50%) rotate(45deg);width:8px;height:8px;background:#ffd95c;border:1px solid rgba(255,255,255,.3);cursor:pointer;transition:transform .1s;}
        .ds-diamond:hover{transform:translate(-50%,-50%) rotate(45deg) scale(1.4);background:#ffec99;}
        .ds-playhead{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,80,80,.6);pointer-events:none;}

        /* ── GRAPH EDITOR ── */
        #graph-panel{bottom:100%;}
        .graph-channel-toggles{display:flex;gap:3px;margin-left:6px;flex:1;flex-wrap:wrap;}
        .ch-btn{padding:2px 6px;border-radius:4px;font-size:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(255,255,255,.4);cursor:pointer;font-family:monospace;transition:all .15s;}
        .ch-btn.active{background:color-mix(in srgb,var(--ch-color) 18%,transparent);border-color:color-mix(in srgb,var(--ch-color) 55%,transparent);color:var(--ch-color);}
        .graph-body{height:190px;position:relative;overflow:hidden;}
        #graph-canvas{width:100%;height:100%;display:block;}

        /* ── ONION SKIN ── */
        .onion-panel{bottom:100%;left:auto!important;right:0!important;width:250px;border-radius:8px 8px 0 0;border:1px solid rgba(255,255,255,.1);}
        .onion-body{padding:10px 14px;display:flex;flex-direction:column;gap:9px;}
        .onion-row{display:flex;align-items:center;gap:8px;}
        .onion-label{font-size:11px;color:rgba(255,255,255,.55);width:72px;flex-shrink:0;}
        .onion-val{font-size:11px;font-family:monospace;color:rgba(255,255,255,.5);width:30px;text-align:right;flex-shrink:0;}
        .onion-range{flex:1;accent-color:#4cc8ff;cursor:pointer;}
        .onion-range-before{accent-color:#6ec6ff;}
        .onion-range-after{accent-color:#ffb347;}
        .onion-switch{position:relative;display:inline-block;width:36px;height:20px;}
        .onion-switch input{opacity:0;width:0;height:0;}
        .onion-slider{position:absolute;inset:0;background:rgba(255,255,255,.1);border-radius:20px;cursor:pointer;transition:.2s;}
        .onion-slider::before{content:'';position:absolute;left:3px;top:3px;width:14px;height:14px;background:rgba(255,255,255,.5);border-radius:50%;transition:.2s;}
        .onion-switch input:checked + .onion-slider{background:rgba(76,200,255,.35);}
        .onion-switch input:checked + .onion-slider::before{transform:translateX(16px);background:#4cc8ff;}

        /* ── MARCADORES ── */
        #marker-panel{bottom:100%;}
        .marker-body{padding:8px 12px;display:flex;flex-direction:column;gap:6px;}
        .marker-add-row{display:flex;gap:6px;align-items:center;}
        .marker-input{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:5px;padding:4px 8px;font-size:11px;font-family:inherit;}
        .marker-input::placeholder{color:rgba(255,255,255,.3);}
        .marker-add-btn{padding:4px 10px;border-radius:5px;border:1px solid rgba(76,200,255,.35);background:rgba(76,200,255,.12);color:#4cc8ff;font-size:11px;cursor:pointer;white-space:nowrap;transition:all .15s;}
        .marker-add-btn:hover{background:rgba(76,200,255,.22);}
        .marker-list{max-height:90px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;}
        .marker-item{display:flex;align-items:center;gap:6px;padding:3px 6px;border-radius:4px;background:rgba(255,255,255,.04);cursor:pointer;transition:background .12s;}
        .marker-item:hover{background:rgba(255,255,255,.08);}
        .marker-color{width:8px;height:8px;border-radius:50%;background:#ffdd55;flex-shrink:0;}
        .marker-frame{font-size:10px;color:rgba(255,255,255,.4);font-family:monospace;min-width:36px;}
        .marker-name{font-size:11px;color:rgba(255,255,255,.75);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .marker-del{background:none;border:none;color:rgba(255,80,80,.5);cursor:pointer;font-size:12px;padding:0 2px;transition:color .12s;}
        .marker-del:hover{color:#ff5555;}
        /* marcadores na trilha */
        .tl-marker-pin{position:absolute;top:0;bottom:0;width:1px;background:#ffdd55;cursor:pointer;pointer-events:all;}
        .tl-marker-pin::after{content:attr(data-label);position:absolute;top:2px;left:3px;font-size:9px;color:#ffdd55;white-space:nowrap;font-family:monospace;pointer-events:none;}
        .tl-marker-pin:hover{background:#ffe888;width:2px;}

        /* ── LOOP REGION ── */
        .loop-panel{bottom:100%;left:auto!important;right:0!important;width:230px;border-radius:8px 8px 0 0;border:1px solid rgba(255,255,255,.1);}
        .loop-body{padding:10px 14px;display:flex;flex-direction:column;gap:9px;}
        .loop-row{display:flex;align-items:center;gap:8px;}
        .loop-label{font-size:11px;color:rgba(255,255,255,.55);width:28px;flex-shrink:0;}
        .loop-num-input{width:60px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:5px;padding:3px 6px;font-size:11px;font-family:monospace;}
        .loop-set-btn{padding:3px 8px;border-radius:5px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);font-size:10px;cursor:pointer;transition:all .15s;}
        .loop-set-btn:hover{background:rgba(255,255,255,.12);color:#fff;}
        /* overlay na trilha */
        .timeline-loop-overlay{position:absolute;top:0;bottom:0;background:rgba(76,200,255,.08);border-left:1px solid rgba(76,200,255,.4);border-right:1px solid rgba(255,180,60,.4);pointer-events:none;z-index:1;}

        /* ── AUTO-KEY ── */
        .autokey-panel{bottom:100%;left:auto!important;right:0!important;width:220px;border-radius:8px 8px 0 0;border:1px solid rgba(255,255,255,.1);}
        .autokey-body{padding:10px 14px;display:flex;flex-direction:column;gap:8px;}
        .autokey-hint{font-size:10px;color:rgba(255,255,255,.35);line-height:1.55;}
        .autokey-status{font-size:10px;font-family:monospace;color:rgba(255,80,80,.6);margin-left:auto;}
        .autokey-on .autokey-status{color:#ff7070;}

        /* ── TIMELINE MARKERS layer ── */
        .timeline-markers{position:absolute;top:0;bottom:0;left:0;pointer-events:none;z-index:2;}
        .timeline-markers .tl-marker-pin{pointer-events:all;}
    `;
    document.head.appendChild(s);
}

// ==================== RÉGUA ====================
function buildRuler() {
    const ruler = document.getElementById('timeline-ruler'); if(!ruler) return;
    const framesEl = document.getElementById('timeline-frames');
    if(framesEl) framesEl.style.width = (AnimState.totalFrames*FRAME_WIDTH)+'px';
    const fragment = document.createDocumentFragment(), step=10, labelStep=50;
    for(let f=0;f<=Math.min(AnimState.totalFrames,10000);f+=step){
        const tick=document.createElement('div'); tick.className='ruler-tick'+(f%labelStep===0?' ruler-tick-major':''); tick.style.left=(f*FRAME_WIDTH)+'px';
        if(f%labelStep===0){const lbl=document.createElement('span');lbl.className='ruler-label';lbl.textContent=f;tick.appendChild(lbl);}
        fragment.appendChild(tick);
    }
    ruler.appendChild(fragment);
}

// ==================== PLAYHEAD ====================
function updatePlayhead() {
    const playhead=document.getElementById('timeline-playhead'), track=document.getElementById('timeline-track'), clockDisplay=document.getElementById('tl-clock-display');
    if(!playhead||!track) return;
    const x=AnimState.currentFrame*FRAME_WIDTH; playhead.style.left=x+'px';
    const tw=track.clientWidth,sl=track.scrollLeft,mg=80;
    if(x<sl+mg) track.scrollLeft=Math.max(0,x-mg); else if(x>sl+tw-mg) track.scrollLeft=x-tw+mg;
    if(clockDisplay) clockDisplay.textContent=String(AnimState.currentFrame).padStart(4,'0');
    if(DopeSheetState.visible) renderDopeSheet();
    if(GraphEdState.visible)   renderGraphEditor();
    if(OnionState.enabled)     updateOnionGhosts();
    updateLoopOverlay();
}

// ==================== KF SELECTION ====================
function selectKF(uuid,frame){
    AnimState.selectedKF={uuid,frame}; refreshDiamonds();
    const tb=document.getElementById('kf-toolbar');
    if(tb){tb.classList.remove('hidden');const lbl=document.getElementById('kf-toolbar-frame');if(lbl)lbl.textContent=frame;const pb=document.getElementById('kf-paste-btn');if(pb)pb.style.display=AnimState.copiedKF?'':'none';}
}
function deselectKF(){AnimState.selectedKF=null;refreshDiamonds();document.getElementById('kf-toolbar')?.classList.add('hidden');}

// ==================== DIAMANTES ====================
function refreshDiamonds(){
    const layer=document.getElementById('timeline-kf-layer');if(!layer)return;layer.innerHTML='';
    const frag=document.createDocumentFragment();
    Object.entries(AnimState.keyframes).forEach(([uuid,objKFs])=>{
        Object.keys(objKFs).forEach(fs=>{
            const frame=parseInt(fs);
            const d=document.createElement('div');d.className='kf-diamond';d.dataset.uuid=uuid;d.dataset.frame=frame;
            d.style.left=(frame*FRAME_WIDTH+FRAME_WIDTH/2-7)+'px';d.title=`Frame ${frame}`;
            if(AnimState.selectedKF&&AnimState.selectedKF.uuid===uuid&&AnimState.selectedKF.frame===frame)d.classList.add('kf-selected');
            d.addEventListener('click',e=>{e.stopPropagation();seekFrame(frame);});
            d.addEventListener('dblclick',e=>{e.stopPropagation();seekFrame(frame);selectKF(uuid,frame);});
            frag.appendChild(d);
        });
    });
    layer.appendChild(frag);
}

// ==================== ADD KF ====================
function addKeyframe(){
    const obj=window.activeObject;if(!obj){flashMessage('Selecione um objeto primeiro');return;}
    const uuid=obj.uuid,frame=AnimState.currentFrame;
    if(!AnimState.keyframes[uuid])AnimState.keyframes[uuid]={};
    AnimState.keyframes[uuid][frame]={
        position:{x:obj.position.x,y:obj.position.y,z:obj.position.z},
        rotation:{x:obj.rotation.x,y:obj.rotation.y,z:obj.rotation.z,order:obj.rotation.order},
        scale:{x:obj.scale.x,y:obj.scale.y,z:obj.scale.z},
        interp:AnimState.interpMode,
    };
    refreshDiamonds();flashKFButton();
    if(typeof window.onKeyframeAdded==='function')window.onKeyframeAdded();
}
function copySelectedKF(){const sel=AnimState.selectedKF;if(!sel)return;const kf=AnimState.keyframes[sel.uuid]?.[sel.frame];if(!kf)return;AnimState.copiedKF=JSON.parse(JSON.stringify(kf));flashMessage(`Copiado: frame ${sel.frame}`);const p=document.getElementById('kf-paste-btn');if(p)p.style.display='';}
function pasteKF(){if(!AnimState.copiedKF)return;const obj=window.activeObject;if(!obj){flashMessage('Selecione um objeto para colar');return;}const uuid=obj.uuid,frame=AnimState.currentFrame;if(!AnimState.keyframes[uuid])AnimState.keyframes[uuid]={};AnimState.keyframes[uuid][frame]=JSON.parse(JSON.stringify(AnimState.copiedKF));refreshDiamonds();flashMessage(`Colado no frame ${frame}`);}
function deleteSelectedKF(){const sel=AnimState.selectedKF;if(!sel)return;if(AnimState.keyframes[sel.uuid]){delete AnimState.keyframes[sel.uuid][sel.frame];if(Object.keys(AnimState.keyframes[sel.uuid]).length===0)delete AnimState.keyframes[sel.uuid];}deselectKF();flashMessage('Keyframe deletado');}
function flashKFButton(){const btn=document.getElementById('tl-add-kf-btn');if(!btn)return;btn.classList.add('kf-flash');setTimeout(()=>btn.classList.remove('kf-flash'),400);}
function flashMessage(msg){let el=document.getElementById('tl-flash-msg');if(!el){el=document.createElement('div');el.id='tl-flash-msg';el.className='tl-flash-msg';document.body.appendChild(el);}el.textContent=msg;el.classList.add('visible');clearTimeout(el._timeout);el._timeout=setTimeout(()=>el.classList.remove('visible'),2000);}

// ==================== INTERPOLAÇÃO ====================
function lerp(a,b,t){return a+(b-a)*t;}
function easeInOutCubic(t){return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
function applyInterp(rawT,mode){const t=Math.max(0,Math.min(1,rawT));if(mode==='constant')return 0;if(mode==='linear')return t;return easeInOutCubic(t);}
function getInterpolatedKF(uuid,frame){
    const objKFs=AnimState.keyframes[uuid];if(!objKFs)return null;
    const frames=Object.keys(objKFs).map(Number).sort((a,b)=>a-b);if(frames.length===0)return null;
    let prev=null,next=null;
    for(const f of frames){if(f<=frame)prev=f;if(f>=frame&&next===null)next=f;}
    if(prev===null)return{...objKFs[frames[0]]};
    if(next===null||prev===next)return{...objKFs[prev]};
    const A=objKFs[prev],B=objKFs[next],mode=A.interp||AnimState.interpMode;
    if(mode==='constant')return{...A};
    const t=applyInterp((frame-prev)/(next-prev),mode);
    return{position:{x:lerp(A.position.x,B.position.x,t),y:lerp(A.position.y,B.position.y,t),z:lerp(A.position.z,B.position.z,t)},rotation:{x:lerp(A.rotation.x,B.rotation.x,t),y:lerp(A.rotation.y,B.rotation.y,t),z:lerp(A.rotation.z,B.rotation.z,t),order:A.rotation.order},scale:{x:lerp(A.scale.x,B.scale.x,t),y:lerp(A.scale.y,B.scale.y,t),z:lerp(A.scale.z,B.scale.z,t)},interp:A.interp};
}
function applyKeyframesAtFrame(frame){
    Object.entries(AnimState.keyframes).forEach(([uuid,objKFs])=>{
        const obj=findObjectByUUID(uuid);if(!obj)return;
        const frames=Object.keys(objKFs).map(Number).sort((a,b)=>a-b);if(!frames.length)return;
        let prev=null,next=null;
        for(const f of frames){if(f<=frame)prev=f;if(f>=frame&&next===null)next=f;}
        if(prev===null){applyKFData(obj,objKFs[frames[0]]);}
        else if(next===null||prev===next){applyKFData(obj,objKFs[prev]);}
        else{const A=objKFs[prev],B=objKFs[next],mode=A.interp||AnimState.interpMode;
            if(mode==='constant'){applyKFData(obj,A);}
            else{const t=applyInterp((frame-prev)/(next-prev),mode);obj.position.set(lerp(A.position.x,B.position.x,t),lerp(A.position.y,B.position.y,t),lerp(A.position.z,B.position.z,t));obj.rotation.set(lerp(A.rotation.x,B.rotation.x,t),lerp(A.rotation.y,B.rotation.y,t),lerp(A.rotation.z,B.rotation.z,t),A.rotation.order);obj.scale.set(lerp(A.scale.x,B.scale.x,t),lerp(A.scale.y,B.scale.y,t),lerp(A.scale.z,B.scale.z,t));}}
        if(obj.userData?.isCamera&&typeof window._nexusRebuildCameraFrustum==='function')window._nexusRebuildCameraFrustum(obj);
    });
}
function applyKFData(obj,kf){obj.position.set(kf.position.x,kf.position.y,kf.position.z);obj.rotation.set(kf.rotation.x,kf.rotation.y,kf.rotation.z,kf.rotation.order);obj.scale.set(kf.scale.x,kf.scale.y,kf.scale.z);}
function findObjectByUUID(uuid){if(!window.sceneObjects)return null;for(const o of window.sceneObjects){if(o.uuid===uuid)return o;}for(const o of window.sceneObjects){if(typeof o.getObjectByProperty==='function'){const f=o.getObjectByProperty('uuid',uuid);if(f)return f;}}if(window._nexusScene){const f=window._nexusScene.getObjectByProperty('uuid',uuid);if(f)return f;}return null;}
function getMaxKeyframe(){let max=0;Object.values(AnimState.keyframes).forEach(o=>Object.keys(o).forEach(f=>{const n=parseInt(f);if(n>max)max=n;}));return max;}

// ==================== SEEK / PLAY ====================
function seekFrame(frame){AnimState.frameExact=frame;AnimState.currentFrame=Math.round(frame);applyKeyframesAtFrame(frame);updatePlayhead();}
function play(){AnimState.isPlaying=true;AnimState.lastTimestamp=null;const i=document.getElementById('tl-play-icon');if(i)i.textContent='⏸';document.getElementById('tl-play-btn')?.classList.add('playing');}
function pause(){AnimState.isPlaying=false;const i=document.getElementById('tl-play-icon');if(i)i.textContent='▶';document.getElementById('tl-play-btn')?.classList.remove('playing');}
function updatePlayback(nowMs){
    if(!AnimState.isPlaying)return;
    if(AnimState.lastTimestamp===null){AnimState.lastTimestamp=nowMs;return;}
    AnimState.frameExact+=(nowMs-AnimState.lastTimestamp)/(1000/AnimState.fps);
    AnimState.lastTimestamp=nowMs;
    const loopEnd=LoopState.enabled?LoopState.outFrame:(getMaxKeyframe()>0?getMaxKeyframe()+AnimState.fps:AnimState.totalFrames);
    const loopStart=LoopState.enabled?LoopState.inFrame:0;
    if(AnimState.frameExact>loopEnd)AnimState.frameExact=loopStart+(AnimState.frameExact-loopEnd);
    AnimState.currentFrame=Math.floor(AnimState.frameExact);
    applyKeyframesAtFrame(AnimState.frameExact);updatePlayhead();
}

// ══════════════════════════════════════════════════════
//  ① DOPE SHEET
// ══════════════════════════════════════════════════════
function toggleDopeSheet(){const p=document.getElementById('dopesheet-panel'),b=document.getElementById('tl-dopesheet-btn');if(!p||!b)return;if(!DopeSheetState.visible)closeAllPanels('dopesheet');DopeSheetState.visible=!DopeSheetState.visible;p.classList.toggle('hidden',!DopeSheetState.visible);b.classList.toggle('active',DopeSheetState.visible);if(DopeSheetState.visible)renderDopeSheet();}
function closeDopeSheet(){DopeSheetState.visible=false;document.getElementById('dopesheet-panel')?.classList.add('hidden');document.getElementById('tl-dopesheet-btn')?.classList.remove('active');}
function renderDopeSheet(){
    const body=document.getElementById('dopesheet-body');if(!body)return;body.innerHTML='';
    const entries=Object.entries(AnimState.keyframes);
    if(!entries.length){body.innerHTML='<div class="dopesheet-empty">Nenhum keyframe na cena ainda.</div>';return;}
    entries.forEach(([uuid,objKFs])=>{
        const obj=findObjectByUUID(uuid),name=obj?(obj.name||'Objeto'):uuid.slice(0,8);
        const row=document.createElement('div');row.className='ds-row';
        const nameEl=document.createElement('div');nameEl.className='ds-name';nameEl.textContent=name;nameEl.title=name;
        const trackEl=document.createElement('div');trackEl.className='ds-track';
        const ph=document.createElement('div');ph.className='ds-playhead';ph.style.left=(AnimState.currentFrame*FRAME_WIDTH)+'px';trackEl.appendChild(ph);
        Object.keys(objKFs).forEach(fs=>{const frame=parseInt(fs);const d=document.createElement('div');d.className='ds-diamond';d.style.left=(frame*FRAME_WIDTH+FRAME_WIDTH/2)+'px';d.title=`Frame ${frame}`;d.addEventListener('click',()=>seekFrame(frame));d.addEventListener('dblclick',()=>{seekFrame(frame);selectKF(uuid,frame);});trackEl.appendChild(d);});
        row.appendChild(nameEl);row.appendChild(trackEl);body.appendChild(row);
    });
}

// ══════════════════════════════════════════════════════
//  ② GRAPH EDITOR
// ══════════════════════════════════════════════════════
const CH_META={px:{color:'#ff5f5f',get:k=>k.position.x},py:{color:'#5fff8a',get:k=>k.position.y},pz:{color:'#5faeff',get:k=>k.position.z},rx:{color:'#ffb347',get:k=>k.rotation.x},ry:{color:'#e0a0ff',get:k=>k.rotation.y},rz:{color:'#00e5d4',get:k=>k.rotation.z},sx:{color:'#ffe066',get:k=>k.scale.x},sy:{color:'#ff91d4',get:k=>k.scale.y},sz:{color:'#c0ff80',get:k=>k.scale.z}};
function toggleGraphEditor(){const p=document.getElementById('graph-panel'),b=document.getElementById('tl-graph-btn');if(!p||!b)return;if(!GraphEdState.visible)closeAllPanels('graph');GraphEdState.visible=!GraphEdState.visible;p.classList.toggle('hidden',!GraphEdState.visible);b.classList.toggle('active',GraphEdState.visible);if(GraphEdState.visible)renderGraphEditor();}
function closeGraphEditor(){GraphEdState.visible=false;document.getElementById('graph-panel')?.classList.add('hidden');document.getElementById('tl-graph-btn')?.classList.remove('active');}
function renderGraphEditor(){
    const canvas=document.getElementById('graph-canvas');if(!canvas)return;
    const body=document.getElementById('graph-body');canvas.width=body.clientWidth||800;canvas.height=body.clientHeight||200;
    const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,PAD={left:48,right:16,top:12,bottom:20},plotW=W-PAD.left-PAD.right,plotH=H-PAD.top-PAD.bottom;
    ctx.clearRect(0,0,W,H);ctx.fillStyle='rgba(6,8,20,1)';ctx.fillRect(0,0,W,H);
    const au=window.activeObject?.uuid,uuids=au&&AnimState.keyframes[au]?[au]:Object.keys(AnimState.keyframes);
    if(!uuids.length){ctx.fillStyle='rgba(255,255,255,.2)';ctx.font='12px monospace';ctx.textAlign='center';ctx.fillText('Selecione um objeto com keyframes',W/2,H/2);return;}
    let minV=Infinity,maxV=-Infinity,minF=Infinity,maxF=-Infinity;
    uuids.forEach(u=>{const o=AnimState.keyframes[u];if(!o)return;Object.keys(o).forEach(fs=>{const f=parseInt(fs),kf=o[fs];if(f<minF)minF=f;if(f>maxF)maxF=f;GraphEdState.channels.forEach(ch=>{const v=CH_META[ch].get(kf);if(v<minV)minV=v;if(v>maxV)maxV=v;});});});
    if(!isFinite(minF)){minF=0;maxF=100;}if(minF===maxF){minF=Math.max(0,minF-10);maxF+=10;}
    const yr=maxV-minV||1,yp=yr*.15;minV-=yp;maxV+=yp;
    const fx=f=>PAD.left+((f-minF)/(maxF-minF))*plotW,vy=v=>PAD.top+(1-(v-minV)/(maxV-minV))*plotH;
    ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;
    for(let i=0;i<=5;i++){const y=PAD.top+(i/5)*plotH;ctx.beginPath();ctx.moveTo(PAD.left,y);ctx.lineTo(W-PAD.right,y);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.25)';ctx.font='9px monospace';ctx.textAlign='right';ctx.fillText((minV+(1-i/5)*(maxV-minV)).toFixed(2),PAD.left-4,y+3);}
    const fs=Math.ceil((maxF-minF)/10/10)*10||1;
    for(let f=minF;f<=maxF;f+=fs){const x=fx(f);ctx.strokeStyle='rgba(255,255,255,.05)';ctx.beginPath();ctx.moveTo(x,PAD.top);ctx.lineTo(x,PAD.top+plotH);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.25)';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText(f,x,H-5);}
    const S=Math.max(plotW,200);
    uuids.forEach(uuid=>{const o=AnimState.keyframes[uuid];if(!o)return;
        GraphEdState.channels.forEach(ch=>{const meta=CH_META[ch];ctx.strokeStyle=meta.color;ctx.lineWidth=1.5;ctx.shadowColor=meta.color;ctx.shadowBlur=4;ctx.beginPath();let ok=false;
        for(let i=0;i<=S;i++){const frame=minF+(i/S)*(maxF-minF);const kf=getInterpolatedKF(uuid,frame);if(!kf)continue;const x=fx(frame),y=vy(meta.get(kf));if(!ok){ctx.moveTo(x,y);ok=true;}else ctx.lineTo(x,y);}
        ctx.stroke();ctx.shadowBlur=0;
        Object.keys(o).forEach(fs=>{const frame=parseInt(fs),kf=o[fs],x=fx(frame),y=vy(meta.get(kf));ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fillStyle=meta.color;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();});
    });});
    if(AnimState.currentFrame>=minF&&AnimState.currentFrame<=maxF){const cx=fx(AnimState.currentFrame);ctx.strokeStyle='rgba(255,80,80,.8)';ctx.lineWidth=1.5;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(cx,PAD.top);ctx.lineTo(cx,PAD.top+plotH);ctx.stroke();ctx.setLineDash([]);}
}

// ══════════════════════════════════════════════════════
//  ③ ONION SKIN
// ══════════════════════════════════════════════════════
function toggleOnionPanel(){const p=document.getElementById('onion-panel'),b=document.getElementById('tl-onion-btn');if(!p||!b)return;if(!OnionState.panelVisible)closeAllPanels('onion');OnionState.panelVisible=!OnionState.panelVisible;p.classList.toggle('hidden',!OnionState.panelVisible);b.classList.toggle('active',OnionState.panelVisible||OnionState.enabled);}
function closeOnionPanel(){OnionState.panelVisible=false;document.getElementById('onion-panel')?.classList.add('hidden');if(!OnionState.enabled)document.getElementById('tl-onion-btn')?.classList.remove('active');}
function updateOnionGhosts(){
    removeOnionGhosts();if(!OnionState.enabled)return;
    const obj=window.activeObject;if(!obj||!AnimState.keyframes[obj.uuid])return;
    const scene=window._nexusScene;if(!scene)return;
    const cf=AnimState.currentFrame;
    for(let i=1;i<=OnionState.framesBefore;i++)_spawnGhost(obj,obj.uuid,cf-i,'#6ec6ff',i,OnionState.framesBefore);
    for(let i=1;i<=OnionState.framesAfter; i++)_spawnGhost(obj,obj.uuid,cf+i,'#ffb347',i,OnionState.framesAfter);
}
function _spawnGhost(obj,uuid,frame,colorHex,step,total){
    if(frame<0)return;const scene=window._nexusScene;if(!scene)return;
    const kf=getInterpolatedKF(uuid,frame);if(!kf)return;
    try{
        const ghost=obj.clone();
        ghost.userData={_isOnionGhost:true};  // override para filtrar da lista
        ghost.position.set(kf.position.x,kf.position.y,kf.position.z);
        ghost.rotation.set(kf.rotation.x,kf.rotation.y,kf.rotation.z,kf.rotation.order||'XYZ');
        ghost.scale.set(kf.scale.x,kf.scale.y,kf.scale.z);
        const alpha=OnionState.opacity*(1-(step-1)/total);
        ghost.traverse(child=>{
            child.userData={...child.userData,_isOnionGhost:true};
            if(child.isMesh&&child.material){const mat=child.material.clone();mat.transparent=true;mat.opacity=alpha;mat.depthWrite=false;if(mat.color&&mat.color.set)mat.color.set(colorHex);child.material=mat;}
        });
        scene.add(ghost);OnionState.ghosts.push(ghost);
    }catch(e){}
}
function removeOnionGhosts(){const scene=window._nexusScene;if(!scene)return;OnionState.ghosts.forEach(g=>scene.remove(g));OnionState.ghosts=[];}

// ══════════════════════════════════════════════════════
//  ④ MARCADORES (Markers)
// ══════════════════════════════════════════════════════
function toggleMarkerPanel(){const p=document.getElementById('marker-panel'),b=document.getElementById('tl-marker-btn');if(!p||!b)return;if(!MarkerState.visible)closeAllPanels('marker');MarkerState.visible=!MarkerState.visible;p.classList.toggle('hidden',!MarkerState.visible);b.classList.toggle('active',MarkerState.visible);if(MarkerState.visible)renderMarkerList();}
function closeMarkerPanel(){MarkerState.visible=false;document.getElementById('marker-panel')?.classList.add('hidden');document.getElementById('tl-marker-btn')?.classList.remove('active');}
function addMarker(label){
    const frame=AnimState.currentFrame;
    AnimState.markers[frame]=label||`F${frame}`;
    renderMarkerList();renderMarkerPins();
    flashMessage(`Marcador "${AnimState.markers[frame]}" no frame ${frame}`);
}
function deleteMarker(frame){delete AnimState.markers[frame];renderMarkerList();renderMarkerPins();}
function renderMarkerList(){
    const list=document.getElementById('marker-list');if(!list)return;
    const keys=Object.keys(AnimState.markers).map(Number).sort((a,b)=>a-b);
    if(!keys.length){list.innerHTML='<div class="dopesheet-empty">Nenhum marcador ainda.</div>';return;}
    list.innerHTML='';
    keys.forEach(frame=>{
        const item=document.createElement('div');item.className='marker-item';
        item.innerHTML=`<div class="marker-color"></div><span class="marker-frame">${frame}</span><span class="marker-name">${AnimState.markers[frame]}</span><button class="marker-del" title="Deletar">✕</button>`;
        item.querySelector('.marker-name').addEventListener('click',()=>seekFrame(frame));
        item.querySelector('.marker-frame').addEventListener('click',()=>seekFrame(frame));
        item.querySelector('.marker-del').addEventListener('click',e=>{e.stopPropagation();deleteMarker(frame);});
        list.appendChild(item);
    });
}
function renderMarkerPins(){
    const layer=document.getElementById('timeline-markers');if(!layer)return;layer.innerHTML='';
    Object.entries(AnimState.markers).forEach(([frameStr,label])=>{
        const frame=parseInt(frameStr);
        const pin=document.createElement('div');pin.className='tl-marker-pin';pin.style.left=(frame*FRAME_WIDTH)+'px';pin.dataset.label=label;pin.title=`${label} (frame ${frame})`;
        pin.addEventListener('click',()=>seekFrame(frame));
        layer.appendChild(pin);
    });
}

// ══════════════════════════════════════════════════════
//  ⑤ LOOP REGION
// ══════════════════════════════════════════════════════
function toggleLoopPanel(){const p=document.getElementById('loop-panel'),b=document.getElementById('tl-loop-btn');if(!p||!b)return;if(!LoopState.visible)closeAllPanels('loop');LoopState.visible=!LoopState.visible;p.classList.toggle('hidden',!LoopState.visible);b.classList.toggle('active',LoopState.visible||LoopState.enabled);}
function closeLoopPanel(){LoopState.visible=false;document.getElementById('loop-panel')?.classList.add('hidden');if(!LoopState.enabled)document.getElementById('tl-loop-btn')?.classList.remove('active');}
function updateLoopOverlay(){
    const ov=document.getElementById('timeline-loop-overlay');if(!ov)return;
    if(!LoopState.enabled){ov.style.display='none';return;}
    const inX=LoopState.inFrame*FRAME_WIDTH, outX=LoopState.outFrame*FRAME_WIDTH;
    ov.style.display='block';ov.style.left=inX+'px';ov.style.width=(outX-inX)+'px';
}

// ══════════════════════════════════════════════════════
//  ⑥ AUTO-KEY
// ══════════════════════════════════════════════════════
function toggleAutoKeyPanel(){const p=document.getElementById('autokey-panel'),b=document.getElementById('tl-autokey-btn');if(!p||!b)return;if(!p._akVisible)closeAllPanels('autokey');p._akVisible=!p._akVisible;p.classList.toggle('hidden',!p._akVisible);b.classList.toggle('active',p._akVisible||AutoKeyState.enabled);}
function closeAutoKeyPanel(){const p=document.getElementById('autokey-panel');if(p)p._akVisible=false;document.getElementById('autokey-panel')?.classList.add('hidden');if(!AutoKeyState.enabled)document.getElementById('tl-autokey-btn')?.classList.remove('active');}
function setAutoKey(enabled){
    AutoKeyState.enabled=enabled;
    const btn=document.getElementById('tl-autokey-btn'),status=document.getElementById('autokey-status');
    if(btn)btn.classList.toggle('autokey-on',enabled);
    if(status)status.textContent=enabled?'ON':'OFF';
    if(enabled){
        // Intercepta mudanças do TransformControls do Three.js
        if(window._nexusTransformControls&&!window._nexusTransformControls._autoKeyBound){
            window._nexusTransformControls._autoKeyBound=true;
            window._nexusTransformControls.addEventListener('objectChange',()=>{
                if(AutoKeyState.enabled&&window.activeObject)addKeyframe();
            });
        }
        flashMessage('🔴 Auto-Key ativado');
    } else {
        flashMessage('Auto-Key desativado');
    }
}

// ── Helper para fechar todos menos o painel ativo ────
function closeAllPanels(except){
    if(except!=='dopesheet')closeDopeSheet();
    if(except!=='graph')    closeGraphEditor();
    if(except!=='onion')    closeOnionPanel();
    if(except!=='marker')   closeMarkerPanel();
    if(except!=='loop')     closeLoopPanel();
    if(except!=='autokey')  closeAutoKeyPanel();
}

// ==================== EVENTOS ====================
function setupEvents(){
    document.getElementById('tl-play-btn')?.addEventListener('click',()=>{if(AnimState.isPlaying)pause();else play();});
    document.getElementById('tl-add-kf-btn')?.addEventListener('click',()=>addKeyframe());
    document.getElementById('tl-fps-btn')?.addEventListener('click',e=>{e.stopPropagation();document.getElementById('fps-panel')?.classList.toggle('hidden');});
    document.getElementById('fps-apply-btn')?.addEventListener('click',()=>{const inp=document.getElementById('fps-input');if(inp){const v=parseInt(inp.value);if(v>=1&&v<=120)AnimState.fps=v;}document.getElementById('fps-panel')?.classList.add('hidden');});
    ['smooth','linear','constant'].forEach(m=>{document.getElementById(`interp-${m}-btn`)?.addEventListener('click',()=>{AnimState.interpMode=m;['smooth','linear','constant'].forEach(mm=>document.getElementById(`interp-${mm}-btn`)?.classList.toggle('active',mm===m));flashMessage(`Interpolação: ${m}`);});});
    document.getElementById('kf-copy-btn')?.addEventListener('click',  e=>{e.stopPropagation();copySelectedKF();});
    document.getElementById('kf-paste-btn')?.addEventListener('click', e=>{e.stopPropagation();pasteKF();});
    document.getElementById('kf-delete-btn')?.addEventListener('click',e=>{e.stopPropagation();deleteSelectedKF();});
    document.getElementById('timeline-track')?.addEventListener('click',e=>{const track=document.getElementById('timeline-track');const rect=track.getBoundingClientRect();seekFrame(Math.max(0,(e.clientX-rect.left+track.scrollLeft)/FRAME_WIDTH));if(AnimState.selectedKF)deselectKF();});

    // Botões dos 6 painéis
    document.getElementById('tl-dopesheet-btn')?.addEventListener('click',e=>{e.stopPropagation();toggleDopeSheet();});
    document.getElementById('tl-graph-btn')?.addEventListener('click',    e=>{e.stopPropagation();toggleGraphEditor();});
    document.getElementById('tl-onion-btn')?.addEventListener('click',    e=>{e.stopPropagation();toggleOnionPanel();});
    document.getElementById('tl-marker-btn')?.addEventListener('click',   e=>{e.stopPropagation();toggleMarkerPanel();});
    document.getElementById('tl-loop-btn')?.addEventListener('click',     e=>{e.stopPropagation();toggleLoopPanel();});
    document.getElementById('tl-autokey-btn')?.addEventListener('click',  e=>{e.stopPropagation();toggleAutoKeyPanel();});

    document.getElementById('dopesheet-close')?.addEventListener('click',closeDopeSheet);
    document.getElementById('graph-close')?.addEventListener('click',    closeGraphEditor);
    document.getElementById('onion-close')?.addEventListener('click',    closeOnionPanel);
    document.getElementById('marker-close')?.addEventListener('click',   closeMarkerPanel);
    document.getElementById('loop-close')?.addEventListener('click',     closeLoopPanel);
    document.getElementById('autokey-close')?.addEventListener('click',  closeAutoKeyPanel);

    // Graph channels
    document.getElementById('graph-channel-toggles')?.addEventListener('click',e=>{const btn=e.target.closest('.ch-btn');if(!btn)return;const ch=btn.dataset.ch;if(GraphEdState.channels.has(ch))GraphEdState.channels.delete(ch);else GraphEdState.channels.add(ch);btn.classList.toggle('active',GraphEdState.channels.has(ch));if(GraphEdState.visible)renderGraphEditor();});

    // Onion skin
    document.getElementById('onion-enabled')?.addEventListener('change',e=>{OnionState.enabled=e.target.checked;document.getElementById('tl-onion-btn')?.classList.toggle('active',OnionState.enabled||OnionState.panelVisible);if(OnionState.enabled)updateOnionGhosts();else removeOnionGhosts();flashMessage(OnionState.enabled?'👻 Onion Skin ativado':'Onion Skin desativado');});
    document.getElementById('onion-before')?.addEventListener('input',e=>{OnionState.framesBefore=parseInt(e.target.value);document.getElementById('onion-before-val').textContent=OnionState.framesBefore;if(OnionState.enabled)updateOnionGhosts();});
    document.getElementById('onion-after')?.addEventListener('input', e=>{OnionState.framesAfter=parseInt(e.target.value);document.getElementById('onion-after-val').textContent=OnionState.framesAfter;if(OnionState.enabled)updateOnionGhosts();});
    document.getElementById('onion-opacity')?.addEventListener('input',e=>{OnionState.opacity=parseInt(e.target.value)/100;document.getElementById('onion-opacity-val').textContent=e.target.value+'%';if(OnionState.enabled)updateOnionGhosts();});

    // Markers
    document.getElementById('marker-add-btn')?.addEventListener('click',()=>{const inp=document.getElementById('marker-label-input');addMarker(inp?.value.trim()||'');if(inp)inp.value='';});
    document.getElementById('marker-label-input')?.addEventListener('keydown',e=>{if(e.key==='Enter'){const inp=e.target;addMarker(inp.value.trim()||'');inp.value='';}});

    // Loop region
    document.getElementById('loop-enabled')?.addEventListener('change',e=>{LoopState.enabled=e.target.checked;document.getElementById('tl-loop-btn')?.classList.toggle('active',LoopState.enabled||LoopState.visible);updateLoopOverlay();flashMessage(LoopState.enabled?`🔁 Loop: ${LoopState.inFrame} → ${LoopState.outFrame}`:'Loop desativado');});
    document.getElementById('loop-in')?.addEventListener('change',e=>{LoopState.inFrame=Math.max(0,parseInt(e.target.value)||0);updateLoopOverlay();});
    document.getElementById('loop-out')?.addEventListener('change',e=>{LoopState.outFrame=Math.max(LoopState.inFrame+1,parseInt(e.target.value)||100);updateLoopOverlay();});
    document.getElementById('loop-in-set')?.addEventListener('click',()=>{LoopState.inFrame=AnimState.currentFrame;const inp=document.getElementById('loop-in');if(inp)inp.value=LoopState.inFrame;updateLoopOverlay();});
    document.getElementById('loop-out-set')?.addEventListener('click',()=>{LoopState.outFrame=AnimState.currentFrame;const inp=document.getElementById('loop-out');if(inp)inp.value=LoopState.outFrame;updateLoopOverlay();});

    // Auto-key
    document.getElementById('autokey-enabled')?.addEventListener('change',e=>setAutoKey(e.target.checked));

    // Fechar fps-panel e toolbar ao clicar fora
    document.addEventListener('click',e=>{
        const panel=document.getElementById('fps-panel'),gear=document.getElementById('tl-fps-btn');
        if(panel&&gear&&!panel.contains(e.target)&&e.target!==gear)panel.classList.add('hidden');
        const toolbar=document.getElementById('kf-toolbar');
        if(toolbar&&AnimState.selectedKF&&!toolbar.contains(e.target)&&!e.target.classList.contains('kf-diamond'))deselectKF();
    });

    // Atalhos de teclado
    document.addEventListener('keydown',e=>{
        if(!AnimState.visible)return;if(e.target.tagName==='INPUT')return;
        if(e.code==='Space'){e.preventDefault();if(AnimState.isPlaying)pause();else play();}
        if(e.key==='k'||e.key==='K')addKeyframe();
        if(e.code==='ArrowRight')seekFrame(Math.min(AnimState.currentFrame+1,AnimState.totalFrames-1));
        if(e.code==='ArrowLeft') seekFrame(Math.max(0,AnimState.currentFrame-1));
        if((e.key==='Delete'||e.key==='Backspace')&&AnimState.selectedKF){e.preventDefault();deleteSelectedKF();}
        if(e.key==='d'||e.key==='D')toggleDopeSheet();
        if(e.key==='g'||e.key==='G')toggleGraphEditor();
        if(e.key==='o'||e.key==='O')toggleOnionPanel();
        if(e.key==='m'||e.key==='M')addMarker('');
        if(e.key==='l'||e.key==='L')toggleLoopPanel();
    });

    window.addEventListener('resize',()=>{if(GraphEdState.visible)renderGraphEditor();});
}

// ==================== INIT ====================
function init(){createTimelineUI();updatePlayhead();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();

// ==================== API PÚBLICA ====================
window.AnimationSystem={
    toggle(){const c=document.getElementById('timeline-container');if(!c)return;AnimState.visible=!AnimState.visible;c.style.display=AnimState.visible?'block':'none';document.getElementById('anim-btn')?.classList.toggle('active',AnimState.visible);if(AnimState.visible)updatePlayhead();},
    update(nowMs){updatePlayback(nowMs);},
    seekFrame(frame){seekFrame(frame);},
    addKeyframe(){addKeyframe();},
    isVisible(){return AnimState.visible;},
    isPlaying(){return AnimState.isPlaying;},
    getFrame(){return AnimState.currentFrame;},
    getState(){return AnimState;},
    toggleDopeSheet(){toggleDopeSheet();},
    toggleGraphEditor(){toggleGraphEditor();},
    toggleOnionSkin(){OnionState.enabled=!OnionState.enabled;updateOnionGhosts();},
    isOnionEnabled(){return OnionState.enabled;},
    addMarker(label){addMarker(label);},
    setLoopRegion(inF,outF,enabled){LoopState.inFrame=inF;LoopState.outFrame=outF;if(enabled!==undefined)LoopState.enabled=enabled;updateLoopOverlay();},
    setAutoKey(v){setAutoKey(v);},
};

// Hook para main.js chamar quando o objeto ativo muda (resolve onion skin no select)
window._nexusOnionUpdate = function() {
    if (OnionState.enabled) updateOnionGhosts();
};

