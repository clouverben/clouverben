// ==================== ANIMATION.JS ====================
// Sistema de animação com timeline, keyframes e interpolação suave
// Compatível com main.js do Nexus Engine

const AnimState = {
    visible:      false,
    isPlaying:    false,
    currentFrame: 0,
    frameExact:   0,
    fps:          24,
    totalFrames:  100000,
    keyframes:    {},         // { uuid: { frame: { position, rotation, scale } } }
    lastTimestamp: null,
};

const FRAME_WIDTH = 14; // px por frame na timeline

// ==================== CRIAR UI ====================
function createTimelineUI() {
    if (document.getElementById('timeline-container')) return;

    const container = document.createElement('div');
    container.id = 'timeline-container';
    container.innerHTML = `
        <div class="fps-panel hidden" id="fps-panel">
            <span>FPS:</span>
            <input type="number" id="fps-input" min="1" max="120" value="24">
            <button id="fps-apply-btn">✔</button>
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
                <button id="tl-fps-btn" class="tl-gear-btn" title="Configurar FPS">⚙</button>
                <div id="tl-clock" class="tl-clock">
                    <span id="tl-clock-display">0000</span>
                    <span class="tl-clock-label">fr</span>
                </div>
            </div>
        </div>
    `;

    container.style.display = 'none';
    document.body.appendChild(container);

    buildRuler();
    setupEvents();

    console.log('🎬 Timeline criada');
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
            diamond.style.left = (frame * FRAME_WIDTH + FRAME_WIDTH / 2 - 7) + 'px';
            diamond.title = `Frame ${frame}`;
            diamond.addEventListener('click', (e) => { e.stopPropagation(); seekFrame(frame); });
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
    };

    refreshDiamonds();
    flashKFButton();

    if (typeof window.onKeyframeAdded === 'function') window.onKeyframeAdded();

    console.log(`◆ KF: "${obj.name}" (${uuid.slice(0,8)}) | Frame ${frame} | pos=(${obj.position.x.toFixed(2)},${obj.position.y.toFixed(2)},${obj.position.z.toFixed(2)})`);
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
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Interpola posição de todos os objetos com keyframes.
 * Após mover câmeras, notifica main.js para reconstruir frustum.
 */
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
            const rawT = (frame - prevFrame) / (nextFrame - prevFrame);
            const t    = easeInOutCubic(Math.max(0, Math.min(1, rawT)));
            const A    = objKFs[prevFrame];
            const B    = objKFs[nextFrame];

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

        // ── FIX: recstrói frustum da câmera após animação mover o grupo ──
        // Sem isso o frustum ficava deslocado visualmente
        if (obj.userData && obj.userData.isCamera) {
            if (typeof window._nexusRebuildCameraFrustum === 'function') {
                window._nexusRebuildCameraFrustum(obj);
            }
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

    // Busca direta no array de cena (cobre cameras, luzes, formas)
    for (const obj of window.sceneObjects) {
        if (obj.uuid === uuid) return obj;
    }

    // Busca em descendentes (cobre ossos e meshes filhos)
    for (const obj of window.sceneObjects) {
        if (typeof obj.getObjectByProperty === 'function') {
            const found = obj.getObjectByProperty('uuid', uuid);
            if (found) return found;
        }
    }

    // Fallback: busca na cena Three.js completa
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

/**
 * Avança o playback com precisão sub-frame.
 * Chamado a cada frame no loop principal (60fps+).
 */
function updatePlayback(nowMs) {
    if (!AnimState.isPlaying) return;

    if (AnimState.lastTimestamp === null) {
        AnimState.lastTimestamp = nowMs;
        return;
    }

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

    document.getElementById('tl-add-kf-btn')?.addEventListener('click', () => { addKeyframe(); });

    document.getElementById('tl-fps-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('fps-panel')?.classList.toggle('hidden');
    });

    document.getElementById('fps-apply-btn')?.addEventListener('click', () => {
        const input = document.getElementById('fps-input');
        if (input) {
            const val = parseInt(input.value);
            if (val >= 1 && val <= 120) { AnimState.fps = val; console.log(`⚙ FPS: ${val}`); }
        }
        document.getElementById('fps-panel')?.classList.add('hidden');
    });

    document.getElementById('timeline-track')?.addEventListener('click', (e) => {
        const track  = document.getElementById('timeline-track');
        const rect   = track.getBoundingClientRect();
        const clickX = e.clientX - rect.left + track.scrollLeft;
        const frame  = Math.max(0, clickX / FRAME_WIDTH);
        seekFrame(frame);
    });

    document.addEventListener('click', (e) => {
        const panel   = document.getElementById('fps-panel');
        const gearBtn = document.getElementById('tl-fps-btn');
        if (panel && gearBtn && !panel.contains(e.target) && e.target !== gearBtn) {
            panel.classList.add('hidden');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!AnimState.visible) return;
        if (e.target.tagName === 'INPUT') return;

        if (e.code === 'Space') {
            e.preventDefault();
            if (AnimState.isPlaying) pause(); else play();
        }
        if (e.key === 'k' || e.key === 'K') { addKeyframe(); }
        if (e.code === 'ArrowRight') seekFrame(Math.min(AnimState.currentFrame + 1, AnimState.totalFrames - 1));
        if (e.code === 'ArrowLeft')  seekFrame(Math.max(0, AnimState.currentFrame - 1));
    });
}

// ==================== INIT ====================
function init() {
    createTimelineUI();
    updatePlayhead();
}

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

    /** Chamado no loop de animação do main.js a cada frame */
    update(nowMs) { updatePlayback(nowMs); },

    /** Vai para um frame específico (usado pela exportação de vídeo) */
    seekFrame(frame) { seekFrame(frame); },

    addKeyframe() { addKeyframe(); },

    isVisible()  { return AnimState.visible; },
    isPlaying()  { return AnimState.isPlaying; },
    getFrame()   { return AnimState.currentFrame; },
    getState()   { return AnimState; },
};

console.log('🎬 animation.js – interpolação sub-frame, ease cúbico, seekFrame, CameraFrustumFix ✅');
