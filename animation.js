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
};

const FRAME_WIDTH = 14;

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
    buildRuler();
    setupEvents();
    console.log('🎬 Timeline v3 criada');
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
};

console.log('🎬 animation.js v3 — interp constante/linear/suave, duplo clique KF c/ toolbar copy/paste/delete ✅');
