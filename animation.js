// ==================== ANIMATION.JS ====================
// v3: interpolação constante/linear, duplo-clique KF c/ toolbar, spawnar em frame

const AnimState = {
    visible:      false,
    isPlaying:    false,
    currentFrame: 0,
    frameExact:   0,
    fps:          24,
    totalFrames:  100000,
    keyframes:    {},        // { uuid: { frame: { position, rotation, scale, interp? } } }
    lastTimestamp: null,
    interpMode:   'smooth',  // 'smooth' | 'linear' | 'constant'

    // seleção de KF
    selectedKF:  null,       // { uuid, frame } | null
    copiedKF:    null,       // snapshot copiado

    // sistema de layers
    layers: [],              // [{ id, name, type, visible, solo, locked, color }]
    _layerNextId: 1,
};

const FRAME_WIDTH = 14;


function injectLayerStyles() {
    if (document.getElementById('_layer_css')) return;
    const s = document.createElement('style');
    s.id = '_layer_css';
    s.textContent = `
        /* ── Botão layers ──────────────────────────────────────────── */
        .tl-layers-btn {
            color: rgba(140,200,255,0.7);
        }
        .tl-layers-btn.active {
            color: #7edfff;
            background: rgba(100,180,255,0.15);
        }

        /* ── Painel de Layers ──────────────────────────────────────── */
        #layers-panel {
            position: fixed;
            bottom: calc(100% + 8px);
            right: 14px;
            width: 280px;
            max-height: 400px;
            background: rgba(8,10,22,0.98);
            border: 1px solid rgba(100,180,255,0.2);
            border-radius: 12px;
            z-index: 2200;
            backdrop-filter: blur(16px);
            box-shadow: 0 -8px 32px rgba(0,0,0,0.7);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        #layers-panel.hidden { display: none !important; }

        .layers-header {
            padding: 10px 14px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        }
        .layers-header h3 {
            margin: 0;
            font-size: 11px;
            font-weight: 700;
            color: rgba(255,255,255,0.65);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            display: flex;
            align-items: center;
            gap: 7px;
        }
        .layers-header h3::before {
            content: '';
            width: 6px; height: 6px;
            border-radius: 50%;
            background: #7edfff;
            box-shadow: 0 0 8px rgba(126,223,255,0.6);
            flex-shrink: 0;
        }
        .layers-add-btn {
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 5px 10px;
            background: rgba(100,180,255,0.1);
            border: 1px solid rgba(100,180,255,0.25);
            border-radius: 7px;
            color: #7edfff;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            font-family: var(--font-ui, sans-serif);
            transition: background 0.15s, border-color 0.15s;
        }
        .layers-add-btn:hover {
            background: rgba(100,180,255,0.2);
            border-color: rgba(100,180,255,0.5);
        }

        /* Lista de layers */
        .layers-list {
            flex: 1;
            overflow-y: auto;
            padding: 6px;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .layers-empty {
            padding: 18px;
            text-align: center;
            font-size: 11px;
            color: rgba(255,255,255,0.22);
        }

        /* Row de cada layer */
        .layer-row {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 7px 8px;
            margin-bottom: 3px;
            border-radius: 7px;
            background: rgba(255,255,255,0.03);
            border: 1px solid transparent;
            transition: background 0.13s, border-color 0.13s;
        }
        .layer-row:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.08); }
        .layer-row.layer-locked { opacity: 0.55; }

        /* Dot colorido do tipo */
        .layer-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        /* Ícone do tipo */
        .layer-type-icon {
            width: 15px; height: 15px;
            opacity: 0.55;
            flex-shrink: 0;
        }

        /* Nome */
        .layer-name {
            flex: 1;
            font-size: 12px;
            color: rgba(255,255,255,0.75);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .layer-row.layer-solo .layer-name { color: #ffd95c; }
        .layer-row.layer-hidden .layer-name { color: rgba(255,255,255,0.28); text-decoration: line-through; }

        /* Botões de controle do layer */
        .layer-controls {
            display: flex;
            align-items: center;
            gap: 2px;
            flex-shrink: 0;
        }
        .layer-ctrl-btn {
            width: 22px; height: 22px;
            display: flex; align-items: center; justify-content: center;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 5px;
            cursor: pointer;
            color: rgba(255,255,255,0.35);
            transition: color 0.13s, background 0.13s, border-color 0.13s;
            padding: 0;
        }
        .layer-ctrl-btn:hover {
            color: rgba(255,255,255,0.8);
            background: rgba(255,255,255,0.08);
            border-color: rgba(255,255,255,0.12);
        }
        .layer-ctrl-btn.active { color: #7edfff; }
        .layer-ctrl-btn.solo-active { color: #ffd95c; }
        .layer-ctrl-btn.lock-active { color: #ff8888; }
        .layer-ctrl-btn svg { pointer-events: none; }

        /* ── Popover de tipo (Add Layer) ──────────────────────────── */
        #layer-type-picker {
            position: fixed;
            z-index: 2500;
            background: rgba(8,10,22,0.99);
            border: 1px solid rgba(100,180,255,0.25);
            border-radius: 10px;
            padding: 6px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.75);
            backdrop-filter: blur(16px);
            min-width: 190px;
        }
        #layer-type-picker.hidden { display: none !important; }
        .layer-type-option {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 10px;
            border-radius: 7px;
            cursor: pointer;
            transition: background 0.13s;
            border: none;
            background: transparent;
            width: 100%;
            color: rgba(255,255,255,0.7);
            font-size: 12px;
            font-family: var(--font-ui, sans-serif);
            text-align: left;
        }
        .layer-type-option:hover { background: rgba(100,180,255,0.12); color: #c8eaff; }
        .layer-type-dot {
            width: 9px; height: 9px;
            border-radius: 50%;
            flex-shrink: 0;
        }
    `;
    document.head.appendChild(s);
}

// ==================== CRIAR UI ====================
function createTimelineUI() {
    if (document.getElementById('timeline-container')) return;

    const container = document.createElement('div');
    container.id = 'timeline-container';
    container.innerHTML = `
        <!-- painel da engrenagem -->
        <div class="fps-panel hidden" id="fps-panel">
            <label style="font-size:11px;color:rgba(255,255,255,.5)">FPS</label>
            <input type="number" id="fps-input" min="1" max="120" value="24">
            <button id="fps-apply-btn">✔</button>

            <div class="fps-divider"></div>

            <label style="font-size:11px;color:rgba(255,255,255,.5)">Interpolação</label>
            <div class="interp-btns">
                <button id="interp-smooth-btn"    class="interp-btn active" title="Suave (ease cúbico)">
                    <svg viewBox="0 0 22 10" width="22" height="10"><path d="M1 9 C6 9 8 1 11 1 S16 1 21 1" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>
                    Suave
                </button>
                <button id="interp-linear-btn"    class="interp-btn" title="Linear">
                    <svg viewBox="0 0 22 10" width="22" height="10"><line x1="1" y1="9" x2="21" y2="1" stroke="currentColor" stroke-width="1.8"/></svg>
                    Linear
                </button>
                <button id="interp-constant-btn"  class="interp-btn" title="Constante (degrau)">
                    <svg viewBox="0 0 22 10" width="22" height="10"><polyline points="1,9 11,9 11,1 21,1" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>
                    Constante
                </button>
            </div>
        </div>

        <!-- toolbar KF (aparece ao dar duplo clique num keyframe) -->
        <div id="kf-toolbar" class="kf-toolbar hidden">
            <span class="kf-toolbar-label">KF <span id="kf-toolbar-frame">—</span></span>
            <button id="kf-copy-btn"   class="kf-tool-btn" title="Copiar keyframe">
                <svg viewBox="0 0 16 16" width="13" height="13"><rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M3 3h7v1H3z" stroke="none" fill="currentColor" opacity=".5"/><rect x="2" y="2" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.4" fill="none" opacity=".5"/></svg>
                Copiar
            </button>
            <button id="kf-paste-btn"  class="kf-tool-btn kf-paste-btn" title="Colar keyframe aqui" style="display:none">
                <svg viewBox="0 0 16 16" width="13" height="13"><rect x="3" y="4" width="10" height="11" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="5" y="2" width="6" height="3" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>
                Colar
            </button>
            <button id="kf-delete-btn" class="kf-tool-btn kf-delete-btn" title="Deletar keyframe">
                <svg viewBox="0 0 16 16" width="13" height="13"><polyline points="2,4 14,4" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M5 4V3h6v1" stroke="currentColor" stroke-width="1.4" fill="none"/><rect x="3" y="4" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><line x1="6" y1="7" x2="6" y2="11" stroke="currentColor" stroke-width="1.4"/><line x1="10" y1="7" x2="10" y2="11" stroke="currentColor" stroke-width="1.4"/></svg>
                Deletar
            </button>
        </div>

        <div class="timeline-bar">
            <button id="tl-play-btn" class="tl-btn tl-play" title="Play / Pause (Espaço)">
                <span id="tl-play-icon">▶</span>
            </button>

            <div class="timeline-track-wrapper">
                <div id="timeline-track" class="timeline-track">
                    <div id="timeline-frames" class="timeline-frames">
                        <div id="timeline-ruler" class="timeline-ruler"></div>
                        <div id="timeline-kf-layer" class="timeline-kf-layer"></div>
                    </div>
                    <div id="timeline-playhead" class="timeline-playhead"></div>
                </div>
            </div>

            <button id="tl-add-kf-btn" class="tl-btn tl-kf-btn" title="Adicionar Keyframe (K)">◆</button>

            <div class="tl-clock-group">
                <button id="tl-layers-btn" class="tl-gear-btn tl-layers-btn" title="Layers">
                    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5l8-3 8 3-8 3z"/><path d="M2 10l8 3 8-3"/><path d="M2 15l8 3 8-3"/></svg>
                </button>
                <button id="tl-fps-btn" class="tl-gear-btn" title="Configurações da timeline">⚙</button>
                <div id="tl-clock" class="tl-clock">
                    <span id="tl-clock-display">0000</span>
                    <span class="tl-clock-label">fr</span>
                </div>
            </div>
        </div>
    `;

    container.style.display = 'none';
    document.body.appendChild(container);

    injectStyles();
    injectLayerStyles();
    buildRuler();
    setupEvents();
    setupLayerBtn();
    console.log('🎬 Timeline v3 criada — Layers ✅');
}

// ==================== ESTILOS INJETADOS ====================
function injectStyles() {
    if (document.getElementById('_anim_extra_css')) return;
    const s = document.createElement('style');
    s.id = '_anim_extra_css';
    s.textContent = `
        /* ── Divisor na fps-panel ─────────────────────────── */
        .fps-divider {
            width: 1px; background: rgba(255,255,255,0.1);
            align-self: stretch; margin: 0 4px;
        }
        /* ── Botões de interpolação ───────────────────────── */
        .interp-btns {
            display: flex; gap: 4px;
        }
        .interp-btn {
            display: flex; align-items: center; gap: 4px;
            padding: 4px 8px; border-radius: 5px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.05);
            color: rgba(255,255,255,0.55);
            font-size: 11px; font-family: inherit;
            cursor: pointer; transition: all 0.15s;
        }
        .interp-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .interp-btn.active {
            background: rgba(76,239,172,0.15);
            border-color: rgba(76,239,172,0.45);
            color: #4cefac;
        }

        /* ── Keyframe selecionado (borda vermelha) ────────── */
        .kf-diamond.kf-selected {
            outline: 2px solid #ff3333 !important;
            outline-offset: 3px;
            box-shadow: 0 0 0 3px rgba(255,50,50,0.35),
                        0 0 8px rgba(255,217,92,0.8),
                        0 0 18px rgba(255,217,92,0.3) !important;
            z-index: 20;
        }

        /* ── Toolbar de KF ────────────────────────────────── */
        .kf-toolbar {
            position: absolute;
            top: -38px; left: 50%; transform: translateX(-50%);
            display: flex; align-items: center; gap: 4px;
            background: rgba(10,12,26,0.98);
            border: 1px solid rgba(255,255,255,0.14);
            border-radius: 8px; padding: 4px 8px;
            backdrop-filter: blur(12px);
            box-shadow: 0 4px 16px rgba(0,0,0,0.5);
            white-space: nowrap; z-index: 300;
            pointer-events: all;
        }
        .kf-toolbar.hidden { display: none !important; }
        .kf-toolbar-label {
            font-size: 11px; color: rgba(255,255,255,0.45);
            font-family: monospace; margin-right: 4px;
        }
        .kf-tool-btn {
            display: flex; align-items: center; gap: 4px;
            padding: 3px 8px; border-radius: 5px;
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(255,255,255,0.05);
            color: rgba(255,255,255,0.7);
            font-size: 11px; font-family: inherit;
            cursor: pointer; transition: all 0.15s;
        }
        .kf-tool-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
        .kf-delete-btn:hover {
            background: rgba(255,60,60,0.15);
            border-color: rgba(255,80,80,0.4); color: #ff8888;
        }
    `;
    document.head.appendChild(s);
}

// ==================== RÉGUA ====================
function buildRuler() {
    const ruler = document.getElementById('timeline-ruler');
    if (!ruler) return;
    const totalWidth = AnimState.totalFrames * FRAME_WIDTH;
    const framesEl = document.getElementById('timeline-frames');
    if (framesEl) framesEl.style.width = totalWidth + 'px';

    const fragment = document.createDocumentFragment();
    const step = 10, labelStep = 50;
    for (let f = 0; f <= Math.min(AnimState.totalFrames, 10000); f += step) {
        const tick = document.createElement('div');
        tick.className = 'ruler-tick' + (f % labelStep === 0 ? ' ruler-tick-major' : '');
        tick.style.left = (f * FRAME_WIDTH) + 'px';
        if (f % labelStep === 0) {
            const lbl = document.createElement('span');
            lbl.className = 'ruler-label';
            lbl.textContent = f;
            tick.appendChild(lbl);
        }
        fragment.appendChild(tick);
    }
    ruler.appendChild(fragment);
}

// ==================== PLAYHEAD ====================
function updatePlayhead() {
    const playhead     = document.getElementById('timeline-playhead');
    const track        = document.getElementById('timeline-track');
    const clockDisplay = document.getElementById('tl-clock-display');
    if (!playhead || !track) return;

    const x = AnimState.currentFrame * FRAME_WIDTH;
    playhead.style.left = x + 'px';

    const trackWidth = track.clientWidth;
    const scrollLeft = track.scrollLeft;
    const margin = 80;
    if      (x < scrollLeft + margin)             track.scrollLeft = Math.max(0, x - margin);
    else if (x > scrollLeft + trackWidth - margin) track.scrollLeft = x - trackWidth + margin;

    if (clockDisplay) clockDisplay.textContent = String(AnimState.currentFrame).padStart(4, '0');
}

// ==================== SELEÇÃO DE KF ====================
function selectKF(uuid, frame) {
    AnimState.selectedKF = { uuid, frame };
    refreshDiamonds();
    const toolbar = document.getElementById('kf-toolbar');
    if (toolbar) {
        toolbar.classList.remove('hidden');
        const lbl = document.getElementById('kf-toolbar-frame');
        if (lbl) lbl.textContent = frame;
        const pasteBtn = document.getElementById('kf-paste-btn');
        if (pasteBtn) pasteBtn.style.display = AnimState.copiedKF ? '' : 'none';
    }
}

function deselectKF() {
    AnimState.selectedKF = null;
    refreshDiamonds();
    document.getElementById('kf-toolbar')?.classList.add('hidden');
}

// ==================== DIAMANTES ====================
function refreshDiamonds() {
    const layer = document.getElementById('timeline-kf-layer');
    if (!layer) return;
    layer.innerHTML = '';

    const fragment = document.createDocumentFragment();
    Object.entries(AnimState.keyframes).forEach(([uuid, objKFs]) => {
        Object.keys(objKFs).forEach(frameStr => {
            const frame = parseInt(frameStr);
            const diamond = document.createElement('div');
            diamond.className = 'kf-diamond';
            diamond.dataset.uuid  = uuid;
            diamond.dataset.frame = frame;
            diamond.style.left    = (frame * FRAME_WIDTH + FRAME_WIDTH / 2 - 7) + 'px';
            diamond.title = `Frame ${frame}`;

            // Destaque se selecionado
            if (AnimState.selectedKF &&
                AnimState.selectedKF.uuid === uuid &&
                AnimState.selectedKF.frame === frame) {
                diamond.classList.add('kf-selected');
            }

            // Clique simples → seek
            diamond.addEventListener('click', (e) => {
                e.stopPropagation();
                seekFrame(frame);
            });

            // Duplo clique → selecionar KF + mostrar toolbar
            diamond.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                seekFrame(frame);
                selectKF(uuid, frame);
            });

            fragment.appendChild(diamond);
        });
    });
    layer.appendChild(fragment);
}

// ==================== ADICIONAR KEYFRAME ====================
function addKeyframe() {
    const obj = window.activeObject;
    if (!obj) { flashMessage('Selecione um objeto primeiro'); return; }

    const uuid  = obj.uuid;
    const frame = AnimState.currentFrame;
    if (!AnimState.keyframes[uuid]) AnimState.keyframes[uuid] = {};

    AnimState.keyframes[uuid][frame] = {
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z, order: obj.rotation.order },
        scale:    { x: obj.scale.x,    y: obj.scale.y,    z: obj.scale.z },
        interp:   AnimState.interpMode,
    };

    refreshDiamonds();
    flashKFButton();
    if (typeof window.onKeyframeAdded === 'function') window.onKeyframeAdded();
    console.log(`◆ KF: "${obj.name}" Frame ${frame} [${AnimState.interpMode}]`);
}

// ==================== COPY / PASTE / DELETE KF ====================
function copySelectedKF() {
    const sel = AnimState.selectedKF;
    if (!sel) return;
    const kfData = AnimState.keyframes[sel.uuid]?.[sel.frame];
    if (!kfData) return;
    AnimState.copiedKF = JSON.parse(JSON.stringify(kfData));
    flashMessage(`Copiado: frame ${sel.frame}`);
    const pasteBtn = document.getElementById('kf-paste-btn');
    if (pasteBtn) pasteBtn.style.display = '';
}

function pasteKF() {
    if (!AnimState.copiedKF) return;
    const obj = window.activeObject;
    if (!obj) { flashMessage('Selecione um objeto para colar'); return; }
    const uuid  = obj.uuid;
    const frame = AnimState.currentFrame;
    if (!AnimState.keyframes[uuid]) AnimState.keyframes[uuid] = {};
    AnimState.keyframes[uuid][frame] = JSON.parse(JSON.stringify(AnimState.copiedKF));
    refreshDiamonds();
    flashMessage(`Colado no frame ${frame}`);
}

function deleteSelectedKF() {
    const sel = AnimState.selectedKF;
    if (!sel) return;
    if (AnimState.keyframes[sel.uuid]) {
        delete AnimState.keyframes[sel.uuid][sel.frame];
        if (Object.keys(AnimState.keyframes[sel.uuid]).length === 0)
            delete AnimState.keyframes[sel.uuid];
    }
    deselectKF();
    flashMessage('Keyframe deletado');
}

function flashKFButton() {
    const btn = document.getElementById('tl-add-kf-btn');
    if (!btn) return;
    btn.classList.add('kf-flash');
    setTimeout(() => btn.classList.remove('kf-flash'), 400);
}

function flashMessage(msg) {
    let msgEl = document.getElementById('tl-flash-msg');
    if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.id = 'tl-flash-msg';
        msgEl.className = 'tl-flash-msg';
        document.body.appendChild(msgEl);
    }
    msgEl.textContent = msg;
    msgEl.classList.add('visible');
    clearTimeout(msgEl._timeout);
    msgEl._timeout = setTimeout(() => msgEl.classList.remove('visible'), 2000);
}

// ==================== INTERPOLAÇÃO ====================
function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function applyInterp(rawT, mode) {
    const t = Math.max(0, Math.min(1, rawT));
    if (mode === 'constant') return 0;        // retorna 0 → usa valor do frame anterior
    if (mode === 'linear')   return t;
    return easeInOutCubic(t);
}

function applyKeyframesAtFrame(frame) {
    Object.entries(AnimState.keyframes).forEach(([uuid, objKFs]) => {
        const obj = findObjectByUUID(uuid);
        if (!obj) return;

        const frames = Object.keys(objKFs).map(Number).sort((a, b) => a - b);
        if (frames.length === 0) return;

        let prevFrame = null, nextFrame = null;
        for (const f of frames) {
            if (f <= frame) prevFrame = f;
            if (f >= frame && nextFrame === null) nextFrame = f;
        }

        if (prevFrame === null) {
            applyKFData(obj, objKFs[frames[0]]);
        } else if (nextFrame === null || prevFrame === nextFrame) {
            applyKFData(obj, objKFs[prevFrame]);
        } else {
            const A   = objKFs[prevFrame];
            const B   = objKFs[nextFrame];
            const mode = (A.interp || AnimState.interpMode);

            if (mode === 'constant') {
                // Constante: mantém o valor do KF anterior
                applyKFData(obj, A);
            } else {
                const rawT = (frame - prevFrame) / (nextFrame - prevFrame);
                const t    = applyInterp(rawT, mode);
                obj.position.set(
                    lerp(A.position.x, B.position.x, t),
                    lerp(A.position.y, B.position.y, t),
                    lerp(A.position.z, B.position.z, t)
                );
                obj.rotation.set(
                    lerp(A.rotation.x, B.rotation.x, t),
                    lerp(A.rotation.y, B.rotation.y, t),
                    lerp(A.rotation.z, B.rotation.z, t),
                    A.rotation.order
                );
                obj.scale.set(
                    lerp(A.scale.x, B.scale.x, t),
                    lerp(A.scale.y, B.scale.y, t),
                    lerp(A.scale.z, B.scale.z, t)
                );
            }
        }

        if (obj.userData && obj.userData.isCamera) {
            if (typeof window._nexusRebuildCameraFrustum === 'function')
                window._nexusRebuildCameraFrustum(obj);
        }
    });
}

function applyKFData(obj, kf) {
    obj.position.set(kf.position.x, kf.position.y, kf.position.z);
    obj.rotation.set(kf.rotation.x, kf.rotation.y, kf.rotation.z, kf.rotation.order);
    obj.scale.set(kf.scale.x, kf.scale.y, kf.scale.z);
}

// ==================== BUSCAR OBJETO ====================
function findObjectByUUID(uuid) {
    if (!window.sceneObjects) return null;
    for (const obj of window.sceneObjects) { if (obj.uuid === uuid) return obj; }
    for (const obj of window.sceneObjects) {
        if (typeof obj.getObjectByProperty === 'function') {
            const found = obj.getObjectByProperty('uuid', uuid);
            if (found) return found;
        }
    }
    if (window._nexusScene) {
        const found = window._nexusScene.getObjectByProperty('uuid', uuid);
        if (found) return found;
    }
    return null;
}

function getMaxKeyframe() {
    let max = 0;
    Object.values(AnimState.keyframes).forEach(objKFs => {
        Object.keys(objKFs).forEach(f => { const n = parseInt(f); if (n > max) max = n; });
    });
    return max;
}

// ==================== SEEK ====================
function seekFrame(frame) {
    AnimState.frameExact   = frame;
    AnimState.currentFrame = Math.round(frame);
    applyKeyframesAtFrame(frame);
    updatePlayhead();
}

// ==================== PLAYBACK ====================
function play() {
    AnimState.isPlaying    = true;
    AnimState.lastTimestamp = null;
    const icon = document.getElementById('tl-play-icon');
    if (icon) icon.textContent = '⏸';
    document.getElementById('tl-play-btn')?.classList.add('playing');
}

function pause() {
    AnimState.isPlaying = false;
    const icon = document.getElementById('tl-play-icon');
    if (icon) icon.textContent = '▶';
    document.getElementById('tl-play-btn')?.classList.remove('playing');
}

function updatePlayback(nowMs) {
    if (!AnimState.isPlaying) return;
    if (AnimState.lastTimestamp === null) { AnimState.lastTimestamp = nowMs; return; }
    const deltaMs = nowMs - AnimState.lastTimestamp;
    AnimState.lastTimestamp = nowMs;
    const msPerFrame = 1000 / AnimState.fps;
    AnimState.frameExact += deltaMs / msPerFrame;
    const maxKF  = getMaxKeyframe();
    const loopEnd = maxKF > 0 ? maxKF + AnimState.fps : AnimState.totalFrames;
    if (AnimState.frameExact > loopEnd) AnimState.frameExact -= loopEnd;
    AnimState.currentFrame = Math.floor(AnimState.frameExact);
    applyKeyframesAtFrame(AnimState.frameExact);
    updatePlayhead();
}

// ==================== EVENTOS ====================
function setupEvents() {
    document.getElementById('tl-play-btn')?.addEventListener('click', () => {
        if (AnimState.isPlaying) pause(); else play();
    });

    document.getElementById('tl-add-kf-btn')?.addEventListener('click', () => addKeyframe());

    // Engrenagem
    document.getElementById('tl-fps-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('fps-panel')?.classList.toggle('hidden');
    });

    document.getElementById('fps-apply-btn')?.addEventListener('click', () => {
        const input = document.getElementById('fps-input');
        if (input) {
            const val = parseInt(input.value);
            if (val >= 1 && val <= 120) AnimState.fps = val;
        }
        document.getElementById('fps-panel')?.classList.add('hidden');
    });

    // Botões de interpolação
    ['smooth','linear','constant'].forEach(mode => {
        document.getElementById(`interp-${mode}-btn`)?.addEventListener('click', () => {
            AnimState.interpMode = mode;
            ['smooth','linear','constant'].forEach(m => {
                document.getElementById(`interp-${m}-btn`)?.classList.toggle('active', m === mode);
            });
            flashMessage(`Interpolação: ${mode}`);
        });
    });

    // Toolbar de KF
    document.getElementById('kf-copy-btn')?.addEventListener('click',   (e) => { e.stopPropagation(); copySelectedKF(); });
    document.getElementById('kf-paste-btn')?.addEventListener('click',  (e) => { e.stopPropagation(); pasteKF(); });
    document.getElementById('kf-delete-btn')?.addEventListener('click', (e) => { e.stopPropagation(); deleteSelectedKF(); });

    document.getElementById('timeline-track')?.addEventListener('click', (e) => {
        const track  = document.getElementById('timeline-track');
        const rect   = track.getBoundingClientRect();
        const clickX = e.clientX - rect.left + track.scrollLeft;
        seekFrame(Math.max(0, clickX / FRAME_WIDTH));
        // Clicou na trilha → deseleciona KF
        if (AnimState.selectedKF) deselectKF();
    });

    // Fechar fps-panel e toolbar ao clicar fora
    document.addEventListener('click', (e) => {
        const panel   = document.getElementById('fps-panel');
        const gearBtn = document.getElementById('tl-fps-btn');
        if (panel && gearBtn && !panel.contains(e.target) && e.target !== gearBtn)
            panel.classList.add('hidden');

        // Deselecionar KF ao clicar fora da toolbar
        const toolbar = document.getElementById('kf-toolbar');
        if (toolbar && AnimState.selectedKF &&
            !toolbar.contains(e.target) &&
            !e.target.classList.contains('kf-diamond')) {
            deselectKF();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!AnimState.visible) return;
        if (e.target.tagName === 'INPUT') return;
        if (e.code === 'Space') { e.preventDefault(); if (AnimState.isPlaying) pause(); else play(); }
        if (e.key === 'k' || e.key === 'K') addKeyframe();
        if (e.code === 'ArrowRight') seekFrame(Math.min(AnimState.currentFrame + 1, AnimState.totalFrames - 1));
        if (e.code === 'ArrowLeft')  seekFrame(Math.max(0, AnimState.currentFrame - 1));
        if ((e.key === 'Delete' || e.key === 'Backspace') && AnimState.selectedKF) {
            e.preventDefault(); deleteSelectedKF();
        }
    });
}

// ==================== INIT ====================
function init() { createTimelineUI(); updatePlayhead(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

// ==================== API PÚBLICA ====================

// ================================================================================
//  SISTEMA DE LAYERS
// ================================================================================

const LAYER_TYPES = [
    { id: 'objects',       label: 'Objects',        color: '#5f7fff', icon: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="12" height="9" rx="1.5"/><path d="M5 5V3.5a3 3 0 0 1 6 0V5"/></svg>' },
    { id: 'models',        label: '3D Models',      color: '#4cefac', icon: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2l6 3.5v5L8 14l-6-3.5v-5z"/><path d="M8 2v12M2 5.5l6 3.5 6-3.5"/></svg>' },
    { id: 'particles',     label: 'Particles',      color: '#ffd95c', icon: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="1.5"/><circle cx="3" cy="4" r="1"/><circle cx="13" cy="4" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="13" cy="12" r="1"/><circle cx="8" cy="2" r="0.8"/><circle cx="8" cy="14" r="0.8"/></svg>' },
    { id: 'postprocessing',label: 'Post-Processing', color: '#ff80aa', icon: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="5"/><path d="M8 3v10M3 8h10"/><circle cx="8" cy="8" r="2"/></svg>' },
];

// ── Core ─────────────────────────────────────────────────────────────────────────
function layerAdd(typeId) {
    const def   = LAYER_TYPES.find(t => t.id === typeId) || LAYER_TYPES[0];
    const id    = AnimState._layerNextId++;
    const layer = {
        id,
        name:    def.label + ' ' + id,
        type:    typeId,
        visible: true,
        solo:    false,
        locked:  false,
        color:   def.color,
    };
    AnimState.layers.push(layer);
    layerRenderList();
    return layer;
}

function layerDelete(id) {
    AnimState.layers = AnimState.layers.filter(l => l.id !== id);
    if (AnimState.layers.length === 0) {
        _restoreAllLayerVisibility();
    } else {
        _applyAllLayersToScene();
    }
    layerRenderList();
}

// ── Classifica um objeto da cena pelo tipo de layer ──────────────────────────
function _objMatchesLayerType(obj, typeId) {
    if (!obj) return false;
    const isParticle = !!(
        (window._nexusIsParticle && window._nexusIsParticle(obj)) ||
        obj.userData?.isParticle ||
        obj.userData?.particleType
    );
    const isLight = !!(
        (window._nexusIsLight && window._nexusIsLight(obj)) ||
        obj.userData?.isLight
    );
    const isModel = !!obj.userData?.isImportedModel;

    if (typeId === 'particles')      return isParticle;
    if (typeId === 'models')         return isModel;
    if (typeId === 'postprocessing') return false; // sem objetos de cena
    // 'objects' = shapes normais (não luz, não partícula, não modelo)
    return !isLight && !isParticle && !isModel;
}

// ── Aplica visibilidade de todos os layers sobre a cena ────────────────────────
function _applyAllLayersToScene() {
    const sceneObjects = window.sceneObjects;
    if (!sceneObjects?.length) return;

    const anySolo = AnimState.layers.some(l => l.solo);

    sceneObjects.forEach(obj => {
        // Salva o estado original de visibilidade na primeira passagem
        if (obj.userData._layerOrigVisible === undefined) {
            obj.userData._layerOrigVisible = obj.visible;
        }

        const matchingLayers = AnimState.layers.filter(l => _objMatchesLayerType(obj, l.type));
        if (!matchingLayers.length) return; // sem layer correspondente → não toca

        let show;
        if (anySolo) {
            show = matchingLayers.some(l => l.solo && l.visible);
        } else {
            show = matchingLayers.every(l => l.visible);
        }

        obj.visible = show ? obj.userData._layerOrigVisible : false;

        // Propagate para filhos (luzes dentro de helpers, etc.)
        obj.traverse(child => {
            if (child === obj) return;
            if (child.userData._layerOrigVisible === undefined)
                child.userData._layerOrigVisible = child.visible;
            child.visible = show ? child.userData._layerOrigVisible : false;
        });
    });
}

// ── Restaura visibilidade original de todos os objetos ────────────────────────
function _restoreAllLayerVisibility() {
    const sceneObjects = window.sceneObjects;
    if (!sceneObjects) return;
    sceneObjects.forEach(obj => {
        if (obj.userData._layerOrigVisible !== undefined) {
            obj.visible = obj.userData._layerOrigVisible;
            delete obj.userData._layerOrigVisible;
        }
        obj.traverse(child => {
            if (child === obj) return;
            if (child.userData._layerOrigVisible !== undefined) {
                child.visible = child.userData._layerOrigVisible;
                delete child.userData._layerOrigVisible;
            }
        });
    });
}

function layerToggleVisible(id) {
    const l = AnimState.layers.find(l => l.id === id);
    if (!l) return;
    l.visible = !l.visible;
    _applyAllLayersToScene();
    layerRenderList();
}

function layerToggleSolo(id) {
    const l = AnimState.layers.find(l => l.id === id);
    if (!l) return;
    const wasSolo = l.solo;
    AnimState.layers.forEach(x => { x.solo = false; });
    if (!wasSolo) l.solo = true;
    _applyAllLayersToScene();
    layerRenderList();
}

function layerToggleLock(id) {
    const l = AnimState.layers.find(l => l.id === id);
    if (l) { l.locked = !l.locked; layerRenderList(); }
}

function layerDuplicate(id) {
    const orig = AnimState.layers.find(l => l.id === id);
    if (!orig) return;
    const copy = { ...orig, id: AnimState._layerNextId++, name: orig.name + ' (copy)' };
    AnimState.layers.push(copy);
    layerRenderList();
}

// ── Render da lista ───────────────────────────────────────────────────────────────
function layerRenderList() {
    const list = document.getElementById('layers-list');
    if (!list) return;

    if (AnimState.layers.length === 0) {
        list.innerHTML = '<div class="layers-empty">Nenhum layer. Clique em + para adicionar.</div>';
        return;
    }

    list.innerHTML = '';
    // renderiza de baixo pra cima (como SFM/Premiere — último adicionado aparece no topo)
    [...AnimState.layers].reverse().forEach(layer => {
        const def  = LAYER_TYPES.find(t => t.id === layer.type) || LAYER_TYPES[0];
        const row  = document.createElement('div');
        row.className = 'layer-row'
            + (layer.solo   ? ' layer-solo'   : '')
            + (!layer.visible ? ' layer-hidden' : '')
            + (layer.locked ? ' layer-locked' : '');
        row.dataset.layerId = layer.id;

        // SVG de visibilidade
        const eyeOn  = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>';
        const eyeOff = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 2l12 12M6.5 6.7A2 2 0 0 0 9.3 9.5M4.2 4.5C2.8 5.6 1.8 7 1 8c1.5 2.5 4 5 7 5 1.4 0 2.7-.5 3.8-1.2M7 3.1C7.3 3 7.7 3 8 3c3 0 5.5 2.5 7 5-.4.7-.9 1.4-1.5 2"/></svg>';
        // SVG de solo (S)
        const soloSvg = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 3v10M4 7l4-4 4 4M4 12h8"/></svg>';
        // SVG de cadeado
        const lockOn  = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/><circle cx="8" cy="10.5" r="1"/></svg>';
        const lockOff = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0"/><circle cx="8" cy="10.5" r="1"/></svg>';
        // SVG de duplicar
        const dupSvg  = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 3h7v1M3 3v7h1" opacity=".5"/></svg>';
        // SVG de deletar
        const delSvg  = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="2,4 14,4"/><path d="M5 4V3h6v1"/><rect x="3" y="4" width="10" height="9" rx="1"/></svg>';

        row.innerHTML = `
            <span class="layer-dot" style="background:${layer.color};box-shadow:0 0 5px ${layer.color}66;"></span>
            <span class="layer-type-icon">${def.icon}</span>
            <span class="layer-name" title="${layer.name}">${layer.name}</span>
            <div class="layer-controls">
                <button class="layer-ctrl-btn lc-eye  ${layer.visible?'active':''}"  title="Visibilidade">${layer.visible ? eyeOn : eyeOff}</button>
                <button class="layer-ctrl-btn lc-solo ${layer.solo?'solo-active':''}" title="Solo">${soloSvg}</button>
                <button class="layer-ctrl-btn lc-lock ${layer.locked?'lock-active':''}" title="Travar">${layer.locked ? lockOn : lockOff}</button>
                <button class="layer-ctrl-btn lc-dup"  title="Duplicar">${dupSvg}</button>
                <button class="layer-ctrl-btn lc-del"  title="Deletar" style="color:rgba(255,100,100,.5)">${delSvg}</button>
            </div>
        `;

        // Eventos dos botões
        row.querySelector('.lc-eye') .addEventListener('click', e => { e.stopPropagation(); layerToggleVisible(layer.id); });
        row.querySelector('.lc-solo').addEventListener('click', e => { e.stopPropagation(); layerToggleSolo(layer.id);    });
        row.querySelector('.lc-lock').addEventListener('click', e => { e.stopPropagation(); layerToggleLock(layer.id);    });
        row.querySelector('.lc-dup') .addEventListener('click', e => { e.stopPropagation(); layerDuplicate(layer.id);     });
        row.querySelector('.lc-del') .addEventListener('click', e => {
            e.stopPropagation();
            layerDelete(layer.id);
        });

        list.appendChild(row);
    });
}

// ── Painel principal (criado uma vez) ────────────────────────────────────────────
function layerBuildPanel() {
    if (document.getElementById('layers-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'layers-panel';
    panel.className = 'hidden';
    panel.innerHTML = `
        <div class="layers-header">
            <h3>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" style="flex-shrink:0"><path d="M1 4l7-2.5L15 4l-7 2.5z"/><path d="M1 8.5l7 2.5 7-2.5"/><path d="M1 13l7 2.5 7-2.5"/></svg>
                Layers
            </h3>
            <button id="layers-add-btn" class="layers-add-btn" title="Adicionar layer">
                <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/></svg>
                Add Layer
            </button>
        </div>
        <div class="layers-list" id="layers-list">
            <div class="layers-empty">Nenhum layer. Clique em + para adicionar.</div>
        </div>
    `;

    // Posicionar na timeline container
    const container = document.getElementById('timeline-container');
    if (container) container.appendChild(panel);
    else document.body.appendChild(panel);

    // Botão Add → abre type picker
    document.getElementById('layers-add-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        layerShowTypePicker(e.currentTarget);
    });
}

// ── Type Picker (dropdown de tipos) ─────────────────────────────────────────────
function layerShowTypePicker(anchorEl) {
    // Remove picker anterior se houver
    document.getElementById('layer-type-picker')?.remove();

    const picker = document.createElement('div');
    picker.id = 'layer-type-picker';

    LAYER_TYPES.forEach(def => {
        const btn = document.createElement('button');
        btn.className = 'layer-type-option';
        btn.innerHTML = `
            <span class="layer-type-dot" style="background:${def.color};box-shadow:0 0 5px ${def.color}66;"></span>
            ${def.icon}
            ${def.label}
        `;
        btn.addEventListener('click', e => {
            e.stopPropagation();
            layerAdd(def.id);
            picker.remove();
        });
        picker.appendChild(btn);
    });

    document.body.appendChild(picker);

    // Posiciona acima do botão
    const rect = anchorEl.getBoundingClientRect();
    picker.style.left = rect.left + 'px';
    picker.style.bottom = (window.innerHeight - rect.top + 6) + 'px';

    // Fecha ao clicar fora
    setTimeout(() => {
        document.addEventListener('click', function close(e) {
            if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', close); }
        });
    }, 10);
}

// ── Toggle do painel ────────────────────────────────────────────────────────────
function layerTogglePanel() {
    layerBuildPanel();
    const panel = document.getElementById('layers-panel');
    if (!panel) return;
    const isHidden = panel.classList.toggle('hidden');
    document.getElementById('tl-layers-btn')?.classList.toggle('active', !isHidden);
    layerRenderList();
}

// ── Wiring do botão na timeline ─────────────────────────────────────────────────
function setupLayerBtn() {
    document.getElementById('tl-layers-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        layerTogglePanel();
    });

    // Fecha ao clicar fora
    document.addEventListener('click', e => {
        const panel = document.getElementById('layers-panel');
        const btn   = document.getElementById('tl-layers-btn');
        const picker = document.getElementById('layer-type-picker');
        if (!panel || panel.classList.contains('hidden')) return;
        if (panel.contains(e.target) || e.target === btn || picker?.contains(e.target)) return;
        panel.classList.add('hidden');
        btn?.classList.remove('active');
    });
}

window.AnimationSystem = {
    toggle() {
        const container = document.getElementById('timeline-container');
        if (!container) return;
        AnimState.visible = !AnimState.visible;
        container.style.display = AnimState.visible ? 'block' : 'none';
        document.getElementById('anim-btn')?.classList.toggle('active', AnimState.visible);
        if (AnimState.visible) updatePlayhead();
    },
    update(nowMs)    { updatePlayback(nowMs); },
    seekFrame(frame) { seekFrame(frame); },
    addKeyframe()    { addKeyframe(); },
    isVisible()      { return AnimState.visible; },
    isPlaying()      { return AnimState.isPlaying; },
    getFrame()       { return AnimState.currentFrame; },
    getState()       { return AnimState; },
    // API de Layers
    addLayer(type)         { return layerAdd(type); },
    deleteLayer(id)        { layerDelete(id); },
    getLayers()            { return AnimState.layers; },
    toggleLayerVisible(id) { layerToggleVisible(id); },
    toggleLayerSolo(id)    { layerToggleSolo(id); },
    toggleLayerLock(id)    { layerToggleLock(id); },
};

console.log('🎬 animation.js v3 — interp constante/linear/suave, duplo clique KF c/ toolbar copy/paste/delete ✅');
