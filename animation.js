// ==================== ANIMATION.JS (animacao_app port) ====================
// Per-object timeline: showing only selected object's keyframes
// Dope Sheet · Graph Editor · Onion Skin · Marcadores · Loop Region · Auto-Key

import * as THREE from 'three';
import { helperRegistry } from './scene.js';

export const AnimState = {
    visible: false, isPlaying: false, currentFrame: 0, frameExact: 0,
    fps: 24, keyframes: {}, lastTimestamp: null,
    interpMode: 'smooth', selectedKF: null, copiedKF: null,
    markers: {},
    clips: {},              // { [objUUID]: [ {id,name,duration}, ... ] }  ★ múltiplos clipes por objeto
    activeClip: {},         // { [objUUID]: clipId }  — clipe sendo editado/exibido
    playbackSpeed: 1,       // multiplicador de velocidade do preview (não afeta export/fps real)
};

const DopeSheetState = { visible: false };
const GraphEdState   = { visible: false, channels: new Set(['px','py','pz']) };
const OnionState     = { panelVisible: false, enabled: false, framesBefore: 2, framesAfter: 2, opacity: 0.35, ghosts: [] };
const MarkerState    = { visible: false };
const LoopState      = { visible: false, enabled: false, inFrame: 0, outFrame: 100 };
const AutoKeyState   = { enabled: false };
const PathState      = { enabled: false, lineObj: null, dots: [] };
const MoreMenuState  = { visible: false };

const FRAME_WIDTH = 11;

// ── Scene helpers (use animacao_app's app global) ──────────────────────────
function _scene()  { return window._app?.scene; }
function _camera() { return window._app?.camera; }

function findObjectByUUID(uuid) {
    const s = _scene(); if (!s) return null;
    return s.getObjectByProperty('uuid', uuid) ?? null;
}

// ── Active object (set by main.js via scene-selection-changed) ─────────────
function getActiveObject() { return window.activeObject ?? null; }

// ==================== CLIPS — dados (múltiplas faixas por objeto) ====================
function _clipId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Leitura pura (não cria nada) — segura pra usar em loops/renders
function peekClips(uuid)          { return (uuid && AnimState.clips[uuid]) || []; }
function peekActiveClipId(uuid)   { return uuid ? (AnimState.activeClip[uuid] || null) : null; }
function peekActiveClip(uuid) {
    const id = peekActiveClipId(uuid);
    return id ? peekClips(uuid).find(c => c.id === id) || null : null;
}
function peekClipKFs(uuid, clipId) { return (uuid && clipId && AnimState.keyframes[uuid]?.[clipId]) || {}; }
function peekActiveClipKFs(uuid)   { return peekClipKFs(uuid, peekActiveClipId(uuid)); }
function getClipMaxFrame(uuid, clipId) {
    const kfs = peekClipKFs(uuid, clipId);
    return Object.keys(kfs).reduce((m, f) => Math.max(m, parseInt(f)), 0);
}

// Cria um clipe NOVO (usado pelo botão "+ Add Clip") — some mesmo sem keyframes
function createNewClip(uuid) {
    if (!AnimState.clips[uuid]) AnimState.clips[uuid] = [];
    const id = _clipId();
    const n  = AnimState.clips[uuid].length + 1;
    AnimState.clips[uuid].push({ id, name: `Clip ${n}`, duration: Math.max(1, Math.round(AnimState.fps * 2)) });
    if (!AnimState.keyframes[uuid]) AnimState.keyframes[uuid] = {};
    AnimState.keyframes[uuid][id] = {};
    AnimState.activeClip[uuid] = id;
    return id;
}
// Garante que exista (e retorna) um clipe ativo — cria um default SÓ quando necessário (ex: Add KF sem clipe nenhum ainda)
function ensureActiveClipId(uuid) {
    if (!AnimState.clips[uuid] || !AnimState.clips[uuid].length) return createNewClip(uuid);
    if (!AnimState.activeClip[uuid]) AnimState.activeClip[uuid] = AnimState.clips[uuid][0].id;
    return AnimState.activeClip[uuid];
}
function setActiveClip(uuid, clipId) {
    AnimState.activeClip[uuid] = clipId;
    refreshDiamonds(); renderClipsSection(); buildRuler();
    if (DopeSheetState.visible) renderDopeSheet();
    if (GraphEdState.visible)   renderGraphEditor();
    if (PathState.enabled)      updateMotionPath();
}

// ==================== UI ====================
function createTimelineUI() {
    if (document.getElementById('timeline-container')) return;
    const container = document.createElement('div');
    container.id = 'timeline-container';
    container.innerHTML = `
        <!-- FPS / Interp panel -->
        <div class="fps-panel hidden" id="fps-panel">
            <label class="fps-label">FPS</label>
            <input type="number" id="fps-input" min="1" max="120" value="24">
            <button id="fps-apply-btn"><svg viewBox="0 0 16 16" width="11" height="11"><path d="M2.5 8.3l3.5 3.5 7-8.2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <div class="fps-divider"></div>
            <label class="fps-label">Interpolação</label>
            <div class="interp-btns">
                <button id="interp-smooth-btn"   class="interp-btn active">
                    <svg viewBox="0 0 22 10" width="22" height="10"><path d="M1 9 C6 9 8 1 11 1 S16 1 21 1" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>Suave
                </button>
                <button id="interp-linear-btn"   class="interp-btn">
                    <svg viewBox="0 0 22 10" width="22" height="10"><line x1="1" y1="9" x2="21" y2="1" stroke="currentColor" stroke-width="1.8"/></svg>Linear
                </button>
                <button id="interp-constant-btn" class="interp-btn">
                    <svg viewBox="0 0 22 10" width="22" height="10"><polyline points="1,9 11,9 11,1 21,1" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>Constante
                </button>
            </div>
        </div>

        <!-- KF Toolbar -->
        <div id="kf-toolbar" class="kf-toolbar hidden">
            <span class="kf-toolbar-label">KF <span id="kf-toolbar-frame">—</span></span>
            <button id="kf-copy-btn"   class="kf-tool-btn">Copiar</button>
            <button id="kf-paste-btn"  class="kf-tool-btn" style="display:none">Colar</button>
            <button id="kf-delete-btn" class="kf-tool-btn kf-delete-btn">Deletar</button>
        </div>

        <!-- Dope Sheet -->
        <div id="dopesheet-panel" class="tl-tool-panel hidden">
            <div class="tl-tool-header">
                <svg viewBox="0 0 16 16" width="13" height="13"><rect x="1" y="2" width="14" height="3" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="7" width="14" height="3" rx="1" fill="currentColor" opacity=".4"/><rect x="1" y="12" width="14" height="3" rx="1" fill="currentColor" opacity=".3"/></svg>
                TRACK <span style="opacity:.45;font-weight:500">· Dope Sheet</span>
                <span class="tl-tool-hint">Clique = seek · Duplo = selecionar KF</span>
                <button class="tl-tool-close" id="dopesheet-close"><svg viewBox="0 0 16 16" width="10" height="10"><path d="M2 2l12 12M14 2 2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
            </div>
            <div class="dopesheet-body" id="dopesheet-body">
                <div class="dopesheet-empty">Nenhum keyframe ainda.</div>
            </div>
        </div>

        <!-- Graph Editor -->
        <div id="graph-panel" class="tl-tool-panel hidden">
            <div class="tl-tool-header">
                <svg viewBox="0 0 16 16" width="13" height="13"><polyline points="1,14 5,8 9,11 15,2" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>
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
                <button class="tl-tool-close" id="graph-close"><svg viewBox="0 0 16 16" width="10" height="10"><path d="M2 2l12 12M14 2 2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
            </div>
            <div class="graph-body" id="graph-body"><canvas id="graph-canvas"></canvas></div>
        </div>

        <!-- Onion Skin -->
        <div id="onion-panel" class="tl-tool-panel tl-panel-small hidden">
            <div class="tl-tool-header">
                <svg viewBox="0 0 16 16" width="13" height="13"><circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.2" fill="none" opacity=".6"/><circle cx="8" cy="8" r="1.2" fill="currentColor" opacity=".5"/></svg>
                Onion Skin
                <button class="tl-tool-close" id="onion-close"><svg viewBox="0 0 16 16" width="10" height="10"><path d="M2 2l12 12M14 2 2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
            </div>
            <div class="onion-body">
                <div class="onion-row"><label class="onion-label">Ativado</label><label class="onion-switch"><input type="checkbox" id="onion-enabled"><span class="onion-slider"></span></label></div>
                <div class="onion-row"><label class="onion-label" style="color:#6ec6ff">Antes</label><input type="range" id="onion-before" min="1" max="6" value="2" class="onion-range"><span id="onion-before-val" class="onion-val">2</span></div>
                <div class="onion-row"><label class="onion-label" style="color:#ffb347">Depois</label><input type="range" id="onion-after"  min="1" max="6" value="2" class="onion-range"><span id="onion-after-val"  class="onion-val">2</span></div>
                <div class="onion-row"><label class="onion-label">Opacidade</label><input type="range" id="onion-opacity" min="5" max="80" value="35" class="onion-range"><span id="onion-opacity-val" class="onion-val">35%</span></div>
            </div>
        </div>

        <!-- Marcadores -->
        <div id="marker-panel" class="tl-tool-panel hidden">
            <div class="tl-tool-header">
                <svg viewBox="0 0 16 16" width="13" height="13"><path d="M4 2h8v9l-4 3-4-3z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
                Marcadores
                <span class="tl-tool-hint">M = adicionar no frame atual</span>
                <button class="tl-tool-close" id="marker-close"><svg viewBox="0 0 16 16" width="10" height="10"><path d="M2 2l12 12M14 2 2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
            </div>
            <div class="marker-body">
                <div class="marker-add-row">
                    <input type="text" id="marker-label-input" class="marker-input" placeholder="Nome do marcador…" maxlength="24">
                    <button id="marker-add-btn" class="marker-add-btn"><svg viewBox="0 0 16 16" width="11" height="11"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
                </div>
                <div id="marker-list" class="marker-list"><div class="dopesheet-empty">Nenhum marcador.</div></div>
            </div>
        </div>

        <!-- Loop Region -->
        <div id="loop-panel" class="tl-tool-panel tl-panel-small hidden">
            <div class="tl-tool-header">
                <svg viewBox="0 0 16 16" width="13" height="13"><path d="M3 8a5 5 0 1 1 2 4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><polyline points="3,4 3,8 7,8" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
                Loop Region
                <button class="tl-tool-close" id="loop-close"><svg viewBox="0 0 16 16" width="10" height="10"><path d="M2 2l12 12M14 2 2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
            </div>
            <div class="loop-body">
                <div class="loop-row"><label class="loop-label">Ativado</label><label class="onion-switch"><input type="checkbox" id="loop-enabled"><span class="onion-slider"></span></label></div>
                <div class="loop-row"><label class="loop-label" style="color:#6ec6ff">In</label><input type="number" id="loop-in" class="loop-num-input" value="0" min="0"><button id="loop-in-set" class="loop-set-btn">Usar atual</button></div>
                <div class="loop-row"><label class="loop-label" style="color:#ffb347">Out</label><input type="number" id="loop-out" class="loop-num-input" value="100" min="0"><button id="loop-out-set" class="loop-set-btn">Usar atual</button></div>
            </div>
        </div>

        <!-- Auto-Key -->
        <div id="autokey-panel" class="tl-tool-panel tl-panel-small hidden">
            <div class="tl-tool-header">
                <svg viewBox="0 0 16 16" width="13" height="13"><rect x="2" y="4" width="8" height="6" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="13" cy="7" r="2.5" stroke="currentColor" stroke-width="1.4" fill="none"/><line x1="13" y1="9.5" x2="13" y2="12" stroke="currentColor" stroke-width="1.5"/></svg>
                Auto-Key
                <button class="tl-tool-close" id="autokey-close"><svg viewBox="0 0 16 16" width="10" height="10"><path d="M2 2l12 12M14 2 2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
            </div>
            <div class="autokey-body">
                <div class="onion-row">
                    <label class="onion-label">Ativado</label>
                    <label class="onion-switch"><input type="checkbox" id="autokey-enabled"><span class="onion-slider"></span></label>
                    <span id="autokey-status" class="autokey-status">OFF</span>
                </div>
                <div class="autokey-hint">Ao mover/rotar/escalar com o gizmo, um KF é inserido automaticamente.</div>
            </div>
        </div>

        <!-- ═══ TOOLBAR ROW — timecode/frame, transporte, TRACK/KF/Tipo, Auto-Key/Path ═══ -->
        <div class="tl-toolbar-row">
            <div class="tl-timebox" title="Tempo atual">
                <span id="tl-timecode">00:00.000</span>
            </div>
            <div class="tl-framebox" title="Frame atual / duração do clipe">
                <span id="tl-frame-current">0</span><span class="tl-frame-sep">/</span><span id="tl-frame-total">48</span>
            </div>

            <div class="tl-sep"></div>

            <button id="tl-tostart-btn" class="tl-btn" title="Ir para o início">
                <svg viewBox="0 0 16 16" width="11" height="11"><path d="M3.4 2.5v11M13 2.5 5 8l8 5.5z" fill="currentColor"/></svg>
            </button>
            <button id="tl-play-btn" class="tl-btn tl-play" title="Play / Pause (Espaço)">
                <span id="tl-play-icon"><svg viewBox="0 0 16 16" width="11" height="11"><path d="M4 2.3v11.4L13.5 8z" fill="currentColor"/></svg></span>
            </button>
            <button id="tl-toend-btn" class="tl-btn" title="Ir para o fim">
                <svg viewBox="0 0 16 16" width="11" height="11"><path d="M12.6 2.5v11M3 2.5l8 5.5-8 5.5z" fill="currentColor"/></svg>
            </button>

            <div class="tl-sep"></div>

            <button id="tl-track-btn" class="tl-pill tl-pill-track" title="Track / Dope Sheet (D)">
                <svg viewBox="0 0 16 16" width="11" height="11"><rect x="1" y="2.5" width="14" height="2.4" rx="1" fill="currentColor" opacity=".9"/><rect x="1" y="6.8" width="14" height="2.4" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="11.1" width="14" height="2.4" rx="1" fill="currentColor" opacity=".4"/></svg>
                <span>TRACK</span>
            </button>
            <button id="tl-add-kf-btn" class="tl-pill tl-pill-kf" title="Adicionar Keyframe (K)">
                <svg viewBox="0 0 16 16" width="8" height="8"><rect x="3.4" y="3.4" width="9.2" height="9.2" rx="1.6" transform="rotate(45 8 8)" fill="currentColor"/></svg>
                <span>Add KF</span>
            </button>
            <button id="tl-tipo-btn" class="tl-pill" title="Tipo de interpolação e FPS">
                <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><line x1="2" y1="4.5" x2="14" y2="4.5"/><circle cx="6.5" cy="4.5" r="1.7" fill="currentColor" stroke="none"/><line x1="2" y1="8" x2="14" y2="8"/><circle cx="10" cy="8" r="1.7" fill="currentColor" stroke="none"/><line x1="2" y1="11.5" x2="14" y2="11.5"/><circle cx="5" cy="11.5" r="1.7" fill="currentColor" stroke="none"/></svg>
                <span>Tipo</span>
            </button>

            <div class="tl-sep"></div>

            <button id="tl-autokey-btn" class="tl-pill tl-pill-autokey" title="Auto-Key (A)">
                <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none"/></svg>
                <span>AUTO-KEY</span>
            </button>
            <button id="tl-path-btn" class="tl-pill tl-pill-path" title="Mostrar caminho de movimento do objeto selecionado">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 13c2-1 2-4.5 4-5.5s2 3.5 4 2.5 2-5.5 4-5.5"/><circle cx="2" cy="13" r="1.3" fill="currentColor" stroke="none"/><circle cx="14" cy="4.5" r="1.3" fill="currentColor" stroke="none"/></svg>
                <span>PATH</span>
            </button>

            <div class="tl-sep"></div>

            <button id="tl-speed-btn" class="tl-pill tl-pill-speed" title="Velocidade de reprodução (preview)">1x</button>
            <button id="tl-more-btn" class="tl-btn" title="Mais ferramentas">
                <svg viewBox="0 0 16 16" width="13" height="13"><circle cx="3" cy="8" r="1.4" fill="currentColor"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="13" cy="8" r="1.4" fill="currentColor"/></svg>
            </button>

            <!-- Menu "mais" — ferramentas secundárias (mesmas de sempre, só reorganizadas) -->
            <div id="more-menu-panel" class="tl-more-menu hidden">
                <button id="tl-graph-btn" class="tl-more-item" title="Graph Editor (G)">
                    <svg viewBox="0 0 16 16" width="14" height="14"><polyline points="1,14 4,8 8,11 12,4 15,2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>
                    <span>Graph Editor</span>
                </button>
                <button id="tl-onion-btn" class="tl-more-item" title="Onion Skin (O)">
                    <svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.2" fill="none" opacity=".55"/></svg>
                    <span>Onion Skin</span>
                </button>
                <button id="tl-marker-btn" class="tl-more-item" title="Marcadores (M)">
                    <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 2h8v9l-4 3-4-3z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
                    <span>Marcadores</span>
                </button>
                <button id="tl-loop-btn" class="tl-more-item" title="Loop Region (L)">
                    <svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 8a5 5 0 1 1 2 4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><polyline points="3,4 3,8 7,8" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
                    <span>Loop Region</span>
                </button>
            </div>
        </div>

        <!-- ═══ RÉGUA (ruler) ═══ -->
        <div class="tl-ruler-row">
            <div class="tl-ruler-spacer"></div>
            <div class="timeline-track-wrapper">
                <div id="timeline-track" class="timeline-track">
                    <div id="timeline-frames" class="timeline-frames">
                        <div id="timeline-ruler"        class="timeline-ruler"></div>
                        <div id="timeline-loop-overlay" class="timeline-loop-overlay" style="display:none"></div>
                        <div id="timeline-markers"      class="timeline-markers"></div>
                        <div id="timeline-kf-layer"     class="timeline-kf-layer"></div>
                    </div>
                    <div id="timeline-playhead" class="timeline-playhead"><div class="tl-playhead-flag"></div></div>
                </div>
            </div>
        </div>

        <!-- ═══ CLIPS (múltiplas faixas por objeto) ═══ -->
        <div class="tl-clips-section">
            <div class="tl-clips-header">CLIPS</div>
            <div class="tl-clips-body">
                <div class="tl-clips-sidebar">
                    <button id="tl-addclip-btn" class="tl-clips-sidebtn" title="Criar um novo clipe no objeto selecionado">+ Add Clip</button>
                    <div id="tl-clips-list" class="tl-clips-list"></div>
                </div>
                <div class="tl-clips-track-wrapper">
                    <div id="tl-clips-track" class="tl-clips-track">
                        <div id="tl-clips-playhead" class="tl-clips-playhead"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    container.style.display = 'none';
    document.body.appendChild(container);
    buildRuler();
    setupEvents();
    injectStyles();
}

// ==================== ESTILOS ====================
function injectStyles() {
    if (document.getElementById('_anim_css')) return;
    const s = document.createElement('style');
    s.id = '_anim_css';
    s.textContent = `
#timeline-container {
    --tl-clips-sidebar-w: 96px;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 200;
    background: rgba(6,8,20,.98);
    border-top: 1px solid rgba(255,255,255,.1);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    user-select: none;
    overflow: visible;               /* panels pop ABOVE without growing the bar */
    display: flex;
    flex-direction: column;
}
/* ★ Sem flash azul de toque (Android WebView / Chrome) em nenhum elemento da timeline */
#timeline-container, #timeline-container * {
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
}
#timeline-container button,
#timeline-container input,
#timeline-container [tabindex] {
    outline: none;
    -webkit-user-select: none;
}
#timeline-container button:focus,
#timeline-container button:focus-visible,
#timeline-container input:focus { outline: none; box-shadow: none; }

/* ══ Linha 1 — barra de ferramentas ══ */
.tl-toolbar-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
    height: 32px;
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
}
.tl-toolbar-row::-webkit-scrollbar { display: none; }

.tl-sep { width: 1px; height: 16px; background: rgba(255,255,255,.1); margin: 0 1px; flex-shrink: 0; }

.tl-timebox, .tl-framebox {
    flex-shrink: 0;
    display: flex; align-items: center;
    height: 21px; padding: 0 7px;
    border-radius: 5px;
    border: 1px solid var(--btn-border, rgba(255,255,255,.11));
    background: var(--btn-bg, rgba(18,21,30,.82));
    font-family: 'Courier New', monospace;
    font-size: 10.5px; font-weight: 700;
    color: rgba(255,255,255,.85);
    white-space: nowrap;
}
.tl-framebox { color: rgba(255,255,255,.55); font-weight: 600; }
.tl-frame-sep { margin: 0 2px; color: rgba(255,255,255,.25); }
#tl-frame-current { color: rgba(255,255,255,.85); }

.tl-btn {
    flex-shrink: 0;
    width: 24px; height: 24px;
    border-radius: 5px;
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(255,255,255,.05);
    color: rgba(255,255,255,.7);
    cursor: pointer;
    font-size: 12px;
    display: flex; align-items: center; justify-content: center;
    transition: background .15s, color .15s;
}
.tl-btn:hover { background: rgba(255,255,255,.12); color: #fff; }
.tl-btn.active { background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.3); color: #fff; }
.tl-btn.playing { background: rgba(76,239,172,.15); border-color: rgba(76,239,172,.4); color: #4cefac; }

/* Botões "pill" (ícone + texto) — TRACK, Add KF, Tipo, AUTO-KEY, PATH, 1x */
.tl-pill {
    flex-shrink: 0;
    display: flex; align-items: center; gap: 3px;
    height: 21px; padding: 0 7px;
    border-radius: 5px;
    border: 1px solid rgba(255,255,255,.11);
    background: rgba(255,255,255,.05);
    color: rgba(255,255,255,.6);
    font-size: 9.5px; font-weight: 700; letter-spacing: .2px;
    white-space: nowrap;
    cursor: pointer;
    transition: background .15s, color .15s;
}
.tl-pill:hover { background: rgba(255,255,255,.11); color: #fff; }
.tl-pill.active { background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.3); color: #fff; }

.tl-pill-track { color: #7fd4ff; border-color: rgba(76,200,255,.3); }
.tl-pill-track:hover, .tl-pill-track.active { background: rgba(76,200,255,.16); border-color: rgba(76,200,255,.5); color: #4cc8ff; }

.tl-pill-kf { color: #ffd95c; border-color: rgba(255,217,92,.3); }
.tl-pill-kf:hover { background: rgba(255,217,92,.12); border-color: rgba(255,217,92,.5); }

.tl-pill-autokey { color: var(--accent-amber, #ffd032); border-color: rgba(255,208,50,.4); background: rgba(255,208,50,.06); }
.tl-pill-autokey:hover { background: rgba(255,208,50,.14); }
.tl-pill-autokey.autokey-on { background: rgba(255,60,60,.18) !important; border-color: rgba(255,80,80,.55) !important; color: #ff7070 !important; }

/* PATH — laranja (mesmo tom das CLIPS, era roxo) */
.tl-pill-path { color: #ffb14a; border-color: rgba(255,177,74,.35); }
.tl-pill-path:hover { background: rgba(255,177,74,.14); border-color: rgba(255,177,74,.55); }
.tl-pill-path.active { background: rgba(255,177,74,.2); border-color: rgba(255,177,74,.6); color: #ffd6a3; }

.tl-pill-speed { min-width: 26px; justify-content: center; color: rgba(255,255,255,.55); }

/* Menu "mais" (…) */
.tl-more-menu {
    position: absolute; top: calc(100% + 4px); right: 8px;
    display: flex; flex-direction: column; gap: 2px;
    background: rgba(8,10,22,.98);
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 8px;
    padding: 5px;
    box-shadow: 0 8px 24px rgba(0,0,0,.5);
    z-index: 300;
    min-width: 140px;
}
.tl-more-menu.hidden { display: none !important; }
.tl-more-item {
    display: flex; align-items: center; gap: 7px;
    padding: 6px 8px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: rgba(255,255,255,.65);
    font-size: 11px; font-weight: 600;
    cursor: pointer; text-align: left;
    transition: background .15s, color .15s;
}
.tl-more-item:hover { background: rgba(255,255,255,.08); color: #fff; }
.tl-more-item.active { background: rgba(76,200,255,.14); color: #4cc8ff; }
.tl-more-item.autokey-on { background: rgba(255,60,60,.16); color: #ff7070; }

.kf-flash { animation: _kfFlash .35s ease-out; }
@keyframes _kfFlash { 0%,100%{transform:scale(1)} 50%{transform:scale(1.35);color:#fff;} }

/* ══ Linha 2 — régua ══ */
.tl-ruler-row { display: flex; align-items: stretch; padding: 0 8px 4px; gap: 6px; height: 28px; flex-shrink: 0; }
.tl-ruler-spacer { width: var(--tl-clips-sidebar-w, 96px); flex-shrink: 0; }
.timeline-track-wrapper { flex: 1; min-width: 0; overflow: hidden; }
.timeline-track {
    position: relative;
    height: 100%;
    overflow-x: auto; overflow-y: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,.12) transparent;
    cursor: pointer;
    background: rgba(0,0,0,.35);
    border-radius: 5px;
    border: 1px solid rgba(255,255,255,.07);
}
.timeline-track::-webkit-scrollbar { height: 3px; }
.timeline-track::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 2px; }
.timeline-frames { position: absolute; top: 0; bottom: 0; min-width: 100%; }
.timeline-ruler { position: absolute; top: 0; left: 0; height: 13px; pointer-events: none; }
.ruler-tick { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,.07); }
.ruler-tick-major { background: rgba(255,255,255,.2); }
.ruler-label { position: absolute; top: 1px; left: 3px; font-size: 8px; color: rgba(255,255,255,.32); font-family: monospace; white-space: nowrap; }
.timeline-playhead {
    position: absolute; top: 0; bottom: 0; width: 2px;
    background: rgba(255,80,80,.9);
    box-shadow: 0 0 6px rgba(255,80,80,.6);
    pointer-events: none; z-index: 10;
}
.tl-playhead-flag {
    position: absolute; top: -1px; left: -4px;
    width: 0; height: 0;
    border-left: 5px solid rgba(255,80,80,.95);
    border-top: 5px solid rgba(255,80,80,.95);
    border-bottom: 5px solid transparent;
    border-radius: 0 2px 2px 0;
}
.timeline-kf-layer { position: absolute; top: 0; bottom: 0; left: 0; pointer-events: all; }
.kf-diamond {
    position: absolute; top: 50%;
    transform: translate(-50%,-50%) rotate(45deg);
    width: 9px; height: 9px;
    background: #ffd95c;
    border: 1px solid rgba(255,255,255,.3);
    cursor: pointer;
    transition: transform .1s;
    pointer-events: all;
}
.kf-diamond:hover { transform: translate(-50%,-50%) rotate(45deg) scale(1.4); background: #ffec99; }
.kf-diamond.kf-selected {
    outline: 2px solid #ff3333;
    outline-offset: 3px;
    box-shadow: 0 0 0 3px rgba(255,50,50,.35), 0 0 8px rgba(255,217,92,.8);
    z-index: 20;
}
.timeline-markers { position: absolute; top: 0; bottom: 0; left: 0; pointer-events: none; z-index: 2; }
.timeline-markers .tl-marker-pin { pointer-events: all; }
.tl-marker-pin { position: absolute; top: 0; bottom: 0; width: 1px; background: #ffdd55; cursor: pointer; }
.tl-marker-pin::after { content: attr(data-label); position: absolute; top: 2px; left: 3px; font-size: 8px; color: #ffdd55; white-space: nowrap; font-family: monospace; pointer-events: none; }
.timeline-loop-overlay { position: absolute; top: 0; bottom: 0; background: rgba(76,200,255,.08); border-left: 1px solid rgba(76,200,255,.4); border-right: 1px solid rgba(255,180,60,.4); pointer-events: none; z-index: 1; }

/* ══ Linha 3 — CLIPS (laranja — era roxo — múltiplas faixas por objeto) ══ */
.tl-clips-section { flex-shrink: 0; padding: 0 8px 8px; }
.tl-clips-header {
    height: 16px; display: flex; align-items: center;
    padding: 0 8px;
    border-radius: 5px 5px 0 0;
    background: rgba(230,150,60,.28);
    color: #ffe4c2;
    font-size: 9.5px; font-weight: 800; letter-spacing: .7px;
}
.tl-clips-body { display: flex; align-items: stretch; gap: 6px; height: 58px; }
.tl-clips-sidebar {
    width: var(--tl-clips-sidebar-w, 96px); flex-shrink: 0;
    display: flex; flex-direction: column; gap: 3px;
    padding-top: 4px;
    border-radius: 0 0 0 5px;
    background: rgba(255,255,255,.03);
    overflow: hidden;
}
.tl-clips-sidebtn {
    flex-shrink: 0;
    height: 18px; margin: 0 5px;
    border-radius: 4px;
    border: 1px solid rgba(255,177,74,.3);
    background: rgba(255,177,74,.08);
    color: #ffb14a;
    font-size: 9px; font-weight: 700;
    cursor: pointer; transition: background .15s;
}
.tl-clips-sidebtn:hover { background: rgba(255,177,74,.18); }
.tl-clips-list { flex: 1; min-height: 0; overflow-y: auto; margin-top: 2px; }
.tl-clips-list .dopesheet-empty { padding: 6px 8px; font-size: 9px; }
.tl-clip-entry {
    display: flex; align-items: center; gap: 4px;
    padding: 2.5px 7px;
    font-size: 9px; color: rgba(255,255,255,.5);
    cursor: pointer;
    border-left: 2px solid transparent;
}
.tl-clip-entry:hover { background: rgba(255,255,255,.05); color: #fff; }
.tl-clip-entry.active { background: rgba(255,177,74,.12); border-left-color: #ffb14a; color: #ffe4c2; }
.tl-clip-entry .tl-clip-dot { width: 5px; height: 5px; border-radius: 50%; background: #ffb14a; flex-shrink: 0; }
.tl-clip-entry .tl-clip-entry-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tl-clip-entry .tl-clip-entry-dur { color: rgba(255,255,255,.3); flex-shrink: 0; }

.tl-clips-track-wrapper { flex: 1; min-width: 0; overflow: hidden; border-radius: 0 5px 5px 0; }
.tl-clips-track {
    position: relative;
    height: 100%;
    overflow: auto;
    scrollbar-width: none;
    cursor: pointer;
    background: rgba(0,0,0,.35);
    border: 1px solid rgba(255,255,255,.07);
    border-left: none;
    padding: 3px 0;
}
.tl-clips-track::-webkit-scrollbar { display: none; }
.tl-clip-row { position: relative; height: 17px; margin-bottom: 3px; }
.tl-clip-row:last-child { margin-bottom: 0; }
/* Bloco do clipe — visual simples e chapado (era hachurado/roxo) */
.tl-clip-block {
    position: absolute; top: 1px; bottom: 1px; left: 0;
    border-radius: 4px;
    background: rgba(255,177,74,.28);
    border: 1px solid rgba(255,177,74,.45);
    display: flex; align-items: center;
    padding: 0 6px;
    overflow: hidden;
    min-width: 3px;
}
.tl-clip-block.active { background: rgba(255,177,74,.42); border-color: #ffb14a; }
.tl-clip-block-label { font-size: 9px; font-weight: 700; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.5); white-space: nowrap; }
/* Pontinhos = keyframes reais dentro do clipe — sempre visíveis */
.tl-clip-kf-dot {
    position: absolute; top: 50%; width: 5px; height: 5px;
    transform: translate(-50%,-50%) rotate(45deg);
    background: #fff2d6;
    border: 1px solid rgba(120,70,10,.5);
    pointer-events: none;
}
.tl-clip-resize-handle {
    position: absolute; right: 0; top: 0; bottom: 0; width: 7px;
    cursor: ew-resize;
    background: repeating-linear-gradient(180deg, rgba(255,255,255,.5) 0 2px, transparent 2px 5px);
    border-left: 1px solid rgba(255,255,255,.3);
}
.tl-clips-playhead {
    position: absolute; top: 0; bottom: 0; width: 2px;
    background: rgba(255,80,80,.9);
    pointer-events: none; z-index: 10;
}
.fps-panel {
    position: absolute; bottom: 100%; left: 10px;
    background: rgba(8,10,22,.98);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 8px;
    padding: 10px 12px;
    display: flex; align-items: center; gap: 8px;
    flex-wrap: wrap;
    backdrop-filter: blur(16px);
    box-shadow: 0 -4px 20px rgba(0,0,0,.5);
    z-index: 300;
}
.fps-panel.hidden { display: none !important; }
.fps-label { font-size: 11px; color: rgba(255,255,255,.5); }
.fps-panel input[type=number] {
    width: 54px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12);
    color: #ddd; border-radius: 5px; padding: 4px 7px; font-size: 12px;
}
.fps-panel button { padding: 4px 8px; border-radius: 5px; border: 1px solid rgba(76,239,172,.3); background: rgba(76,239,172,.1); color: #4cefac; cursor: pointer; font-size: 11px; }
.fps-divider { width: 1px; background: rgba(255,255,255,.1); align-self: stretch; margin: 0 4px; }
.interp-btns { display: flex; gap: 4px; }
.interp-btn { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 5px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05); color: rgba(255,255,255,.55); font-size: 11px; cursor: pointer; transition: all .15s; }
.interp-btn:hover { background: rgba(255,255,255,.1); color: #fff; }
.interp-btn.active { background: rgba(76,239,172,.15); border-color: rgba(76,239,172,.45); color: #4cefac; }

/* ── KF Toolbar ── */
.kf-toolbar { position: absolute; top: -40px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 4px; background: rgba(10,12,26,.98); border: 1px solid rgba(255,255,255,.14); border-radius: 8px; padding: 4px 8px; backdrop-filter: blur(12px); box-shadow: 0 4px 16px rgba(0,0,0,.5); white-space: nowrap; z-index: 300; pointer-events: all; }
.kf-toolbar.hidden { display: none !important; }
.kf-toolbar-label { font-size: 11px; color: rgba(255,255,255,.45); font-family: monospace; margin-right: 4px; }
.kf-tool-btn { display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 5px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); color: rgba(255,255,255,.7); font-size: 11px; cursor: pointer; transition: all .15s; }
.kf-tool-btn:hover { background: rgba(255,255,255,.12); color: #fff; }
.kf-delete-btn:hover { background: rgba(255,60,60,.15); border-color: rgba(255,80,80,.4); color: #ff8888; }

/* ── Tool panels (Dope Sheet, Graph, etc.) ── */
.tl-tool-panel { position: absolute; left: 0; right: 0; bottom: 100%; background: rgba(8,10,22,.97); border-top: 1px solid rgba(255,255,255,.1); backdrop-filter: blur(16px); z-index: 200; box-shadow: 0 -4px 24px rgba(0,0,0,.6); }
.tl-tool-panel.hidden { display: none !important; }
.tl-panel-small { left: auto; right: 0; width: 250px; border-radius: 8px 8px 0 0; border: 1px solid rgba(255,255,255,.1); }
.tl-tool-header { display: flex; align-items: center; gap: 7px; padding: 6px 12px; background: rgba(255,255,255,.03); border-bottom: 1px solid rgba(255,255,255,.07); font-size: 12px; font-weight: 600; color: rgba(255,255,255,.75); }
.tl-tool-hint { font-size: 10px; color: rgba(255,255,255,.3); font-weight: 400; margin-left: 4px; flex: 1; }
.tl-tool-close { margin-left: auto; background: none; border: none; color: rgba(255,255,255,.35); cursor: pointer; font-size: 13px; padding: 2px 5px; border-radius: 4px; transition: all .15s; }
.tl-tool-close:hover { background: rgba(255,80,80,.15); color: #ff8888; }

/* ── Dope Sheet ── */
.dopesheet-body { height: 120px; overflow: auto; display: flex; flex-direction: column; }
.dopesheet-empty { padding: 14px 16px; font-size: 11px; color: rgba(255,255,255,.25); font-style: italic; }
.ds-row { display: flex; align-items: stretch; border-bottom: 1px solid rgba(255,255,255,.05); min-height: 24px; }
.ds-row:hover { background: rgba(255,255,255,.03); }
.ds-name { width: 100px; flex-shrink: 0; padding: 0 10px; display: flex; align-items: center; font-size: 11px; color: rgba(255,255,255,.55); border-right: 1px solid rgba(255,255,255,.07); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-track { flex: 1; position: relative; overflow: hidden; }
.ds-diamond { position: absolute; top: 50%; transform: translate(-50%,-50%) rotate(45deg); width: 8px; height: 8px; background: #ffd95c; border: 1px solid rgba(255,255,255,.3); cursor: pointer; transition: transform .1s; }
.ds-diamond:hover { transform: translate(-50%,-50%) rotate(45deg) scale(1.4); }
.ds-playhead { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,80,80,.6); pointer-events: none; }

/* ── Graph Editor ── */
.graph-channel-toggles { display: flex; gap: 3px; margin-left: 6px; flex: 1; flex-wrap: wrap; }
.ch-btn { padding: 2px 6px; border-radius: 4px; font-size: 10px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); color: rgba(255,255,255,.4); cursor: pointer; font-family: monospace; transition: all .15s; }
.ch-btn.active { background: color-mix(in srgb, var(--ch-color) 18%, transparent); border-color: color-mix(in srgb, var(--ch-color) 55%, transparent); color: var(--ch-color); }
.graph-body { height: 180px; position: relative; overflow: hidden; }
#graph-canvas { width: 100%; height: 100%; display: block; }

/* ── Onion Skin ── */
.onion-body { padding: 10px 14px; display: flex; flex-direction: column; gap: 9px; }
.onion-row  { display: flex; align-items: center; gap: 8px; }
.onion-label{ font-size: 11px; color: rgba(255,255,255,.55); width: 72px; flex-shrink: 0; }
.onion-val  { font-size: 11px; font-family: monospace; color: rgba(255,255,255,.5); width: 30px; text-align: right; flex-shrink: 0; }
.onion-range{ flex: 1; accent-color: #4cc8ff; cursor: pointer; }
.onion-switch { position: relative; display: inline-block; width: 36px; height: 20px; }
.onion-switch input { opacity: 0; width: 0; height: 0; }
.onion-slider { position: absolute; inset: 0; background: rgba(255,255,255,.1); border-radius: 20px; cursor: pointer; transition: .2s; }
.onion-slider::before { content: ''; position: absolute; left: 3px; top: 3px; width: 14px; height: 14px; background: rgba(255,255,255,.5); border-radius: 50%; transition: .2s; }
.onion-switch input:checked + .onion-slider { background: rgba(76,200,255,.35); }
.onion-switch input:checked + .onion-slider::before { transform: translateX(16px); background: #4cc8ff; }

/* ── Markers ── */
.marker-body { padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; }
.marker-add-row { display: flex; gap: 6px; align-items: center; }
.marker-input { flex: 1; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); color: #fff; border-radius: 5px; padding: 4px 8px; font-size: 11px; }
.marker-input::placeholder { color: rgba(255,255,255,.3); }
.marker-add-btn { padding: 4px 10px; border-radius: 5px; border: 1px solid rgba(76,200,255,.35); background: rgba(76,200,255,.12); color: #4cc8ff; font-size: 14px; cursor: pointer; }
.marker-list { max-height: 90px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
.marker-item { display: flex; align-items: center; gap: 6px; padding: 3px 6px; border-radius: 4px; background: rgba(255,255,255,.04); cursor: pointer; }
.marker-item:hover { background: rgba(255,255,255,.08); }
.marker-color { width: 8px; height: 8px; border-radius: 50%; background: #ffdd55; flex-shrink: 0; }
.marker-frame { font-size: 10px; color: rgba(255,255,255,.4); font-family: monospace; min-width: 36px; }
.marker-name  { font-size: 11px; color: rgba(255,255,255,.75); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.marker-del   { background: none; border: none; color: rgba(255,80,80,.5); cursor: pointer; font-size: 12px; padding: 0 2px; }
.marker-del:hover { color: #ff5555; }

/* ── Loop Region ── */
.loop-body { padding: 10px 14px; display: flex; flex-direction: column; gap: 9px; }
.loop-row   { display: flex; align-items: center; gap: 8px; }
.loop-label { font-size: 11px; color: rgba(255,255,255,.55); width: 28px; flex-shrink: 0; }
.loop-num-input { width: 60px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); color: #fff; border-radius: 5px; padding: 3px 6px; font-size: 11px; font-family: monospace; }
.loop-set-btn { padding: 3px 8px; border-radius: 5px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: rgba(255,255,255,.6); font-size: 10px; cursor: pointer; }
.loop-set-btn:hover { background: rgba(255,255,255,.12); color: #fff; }

/* ── Auto-Key ── */
.autokey-body { padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
.autokey-hint { font-size: 10px; color: rgba(255,255,255,.35); line-height: 1.55; }
.autokey-status { font-size: 10px; font-family: monospace; color: rgba(255,80,80,.6); margin-left: auto; }

/* ── Flash message ── */
.tl-flash-msg { position: fixed; bottom: 64px; left: 50%; transform: translateX(-50%); background: rgba(8,10,22,.97); border: 1px solid rgba(255,255,255,.14); color: rgba(255,255,255,.75); padding: 6px 16px; border-radius: 7px; font-size: 12px; font-weight: 600; z-index: 9999; pointer-events: none; opacity: 0; transition: opacity .2s; }
.tl-flash-msg.visible { opacity: 1; }
    `;
    document.head.appendChild(s);
}

// ==================== RÉGUA ====================
function formatTimecode(frame) {
    const fps = Math.max(1, AnimState.fps || 24);
    const totalMs = Math.max(0, (frame / fps) * 1000);
    const mm = Math.floor(totalMs / 60000);
    const ss = Math.floor((totalMs % 60000) / 1000);
    const ms = Math.floor(totalMs % 1000);
    return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
}

function buildRuler() {
    const ruler = document.getElementById('timeline-ruler'); if (!ruler) return;
    ruler.innerHTML = '';
    const framesEl = document.getElementById('timeline-frames');
    const fps   = Math.max(1, AnimState.fps || 24);
    const end   = Math.max(currentRulerEnd(), fps);   // régua nunca menor que 1s
    const total = end + fps;                          // pequena margem depois do fim
    if (framesEl) framesEl.style.width = (total * FRAME_WIDTH) + 'px';

    const frag = document.createDocumentFragment();
    const addTick = (f, major, label) => {
        const tick = document.createElement('div');
        tick.className = 'ruler-tick' + (major ? ' ruler-tick-major' : '');
        tick.style.left = (f * FRAME_WIDTH) + 'px';
        if (label != null) {
            const lbl = document.createElement('span');
            lbl.className = 'ruler-label';
            lbl.textContent = label;
            tick.appendChild(lbl);
        }
        frag.appendChild(tick);
    };
    // ★ Ticks alinhados em segundos (independente do fps ser par/ímpar)
    for (let s = 0; s * fps <= total; s++) {
        addTick(s * fps, true, s + 's');
        const half = s * fps + fps / 2;
        if (half <= total) addTick(half, false, null);
    }
    ruler.appendChild(frag);

    const totalEl = document.getElementById('tl-frame-total');
    if (totalEl) totalEl.textContent = Math.round(end);
}

// ==================== PLAYHEAD ====================
function updatePlayhead() {
    const playhead   = document.getElementById('timeline-playhead');
    const track      = document.getElementById('timeline-track');
    const timecodeEl = document.getElementById('tl-timecode');
    const frameCurEl = document.getElementById('tl-frame-current');
    const clipsPh    = document.getElementById('tl-clips-playhead');
    if (!playhead || !track) return;
    const x = AnimState.currentFrame * FRAME_WIDTH;
    playhead.style.left = x + 'px';
    if (clipsPh) clipsPh.style.left = x + 'px';
    const tw = track.clientWidth, sl = track.scrollLeft, mg = 80;
    if (x < sl + mg) track.scrollLeft = Math.max(0, x - mg);
    else if (x > sl + tw - mg) track.scrollLeft = x - tw + mg;
    if (timecodeEl) timecodeEl.textContent = formatTimecode(AnimState.currentFrame);
    if (frameCurEl) frameCurEl.textContent = AnimState.currentFrame;
    if (DopeSheetState.visible) renderDopeSheet();
    if (GraphEdState.visible)   renderGraphEditor();
    if (OnionState.enabled)     updateOnionGhosts();
    updateLoopOverlay();
}

// ==================== KF SELECTION ====================
function selectKF(uuid, clipId, frame) {
    AnimState.selectedKF = { uuid, clipId, frame };
    refreshDiamonds();
    const tb = document.getElementById('kf-toolbar');
    if (tb) {
        tb.classList.remove('hidden');
        const lbl = document.getElementById('kf-toolbar-frame');
        if (lbl) lbl.textContent = frame;
        const pb = document.getElementById('kf-paste-btn');
        if (pb) pb.style.display = AnimState.copiedKF ? '' : 'none';
    }
}
function deselectKF() {
    AnimState.selectedKF = null;
    refreshDiamonds();
    document.getElementById('kf-toolbar')?.classList.add('hidden');
}

// ==================== DIAMANTES ====================
// ★ PER-OBJECT: só mostra os KFs do objeto ativo
function refreshDiamonds() {
    const layer = document.getElementById('timeline-kf-layer');
    if (!layer) return;
    layer.innerHTML = '';

    const activeObj = resolveAnimTarget(getActiveObject());
    const frag = document.createDocumentFragment();

    // Objeto selecionado → mostra os KFs do clipe ATIVO dele.
    // Sem seleção → mostra o clipe ativo de cada objeto que já tenha algum clipe (modo global).
    const uuidsToShow = activeObj
        ? (peekClips(activeObj.uuid).length ? [activeObj.uuid] : [])
        : Object.keys(AnimState.clips);

    uuidsToShow.forEach(uuid => {
        const clipId = peekActiveClipId(uuid); if (!clipId) return;
        const objKFs = peekClipKFs(uuid, clipId);
        Object.keys(objKFs).forEach(fs => {
            const frame = parseInt(fs);
            const d = document.createElement('div');
            d.className = 'kf-diamond';
            d.dataset.uuid = uuid; d.dataset.clip = clipId; d.dataset.frame = frame;
            d.style.left = (frame * FRAME_WIDTH + FRAME_WIDTH / 2 - 5) + 'px';
            d.title = `Frame ${frame}`;
            if (AnimState.selectedKF && AnimState.selectedKF.uuid === uuid && AnimState.selectedKF.clipId === clipId && AnimState.selectedKF.frame === frame)
                d.classList.add('kf-selected');
            d.addEventListener('click',    e => { e.stopPropagation(); seekFrame(frame); });
            d.addEventListener('dblclick', e => { e.stopPropagation(); seekFrame(frame); selectKF(uuid, clipId, frame); });
            frag.appendChild(d);
        });
    });
    layer.appendChild(frag);
}

// ==================== ADD KF ====================
// ── Resolve the real animatable object from window.activeObject ─────────────
// If a bone marker sphere is selected, the actual THREE.Bone (boneRef) is
// what we must animate — it has a stable uuid and LOCAL position/rotation.
function resolveAnimTarget(obj) {
    if (!obj) return null;
    if (obj.userData?.isBoneMarker && obj.userData?.boneRef) {
        return obj.userData.boneRef;  // the actual THREE.Bone
    }
    return obj;
}

function addKeyframe() {
    const raw = getActiveObject();
    if (!raw) { flashMessage('Selecione um objeto primeiro'); return; }
    const obj    = resolveAnimTarget(raw);
    const uuid   = obj.uuid;
    const clipId = ensureActiveClipId(uuid);   // cria um clipe padrão se ainda não existir nenhum
    const frame  = AnimState.currentFrame;
    const isBone = obj.isBone;

    const kfs = peekClipKFs(uuid, clipId);
    kfs[frame] = {
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z, order: obj.rotation.order },
        scale:    { x: obj.scale.x,    y: obj.scale.y,    z: obj.scale.z },
        interp:   AnimState.interpMode,
        isBone,
        // store parent uuid so we can call skeleton.update() on apply
        parentSkinnedMeshUUID: isBone ? _findSkinnedMeshForBone(obj) : null,
    };
    // ★ Estende a duração DESTE clipe automaticamente se o KF passar do fim atual dele
    const clip = AnimState.clips[uuid]?.find(c => c.id === clipId);
    if (clip && frame > clip.duration) clip.duration = frame + Math.round(AnimState.fps);
    buildRuler();
    refreshDiamonds();
    flashKFButton();
    renderClipsSection();
    if (PathState.enabled) updateMotionPath();
}
function copySelectedKF() {
    const sel = AnimState.selectedKF; if (!sel) return;
    const kf = AnimState.keyframes[sel.uuid]?.[sel.clipId]?.[sel.frame]; if (!kf) return;
    AnimState.copiedKF = JSON.parse(JSON.stringify(kf));
    flashMessage(`Copiado: frame ${sel.frame}`);
    const p = document.getElementById('kf-paste-btn'); if (p) p.style.display = '';
}
function pasteKF() {
    if (!AnimState.copiedKF) return;
    const raw = getActiveObject();
    if (!raw) { flashMessage('Selecione um objeto para colar'); return; }
    const obj    = resolveAnimTarget(raw);
    const uuid   = obj.uuid;
    const clipId = ensureActiveClipId(uuid);
    const frame  = AnimState.currentFrame;
    peekClipKFs(uuid, clipId)[frame] = JSON.parse(JSON.stringify(AnimState.copiedKF));
    const clip = AnimState.clips[uuid]?.find(c => c.id === clipId);
    if (clip && frame > clip.duration) clip.duration = frame + Math.round(AnimState.fps);
    buildRuler();
    refreshDiamonds();
    flashMessage(`Colado no frame ${frame}`);
    renderClipsSection();
}
// ── Deletar keyframe selecionado (duplo-clique no losango) ──────────────────
function deleteSelectedKF() {
    const sel = AnimState.selectedKF; if (!sel) return;
    const clipKFs = AnimState.keyframes[sel.uuid]?.[sel.clipId];
    if (clipKFs) delete clipKFs[sel.frame];
    deselectKF();
    flashMessage('Keyframe deletado');
    renderClipsSection();
    if (PathState.enabled) updateMotionPath();
}
function flashKFButton() {
    const btn = document.getElementById('tl-add-kf-btn'); if (!btn) return;
    btn.classList.add('kf-flash');
    setTimeout(() => btn.classList.remove('kf-flash'), 400);
}
function flashMessage(msg) {
    let el = document.getElementById('tl-flash-msg');
    if (!el) { el = document.createElement('div'); el.id = 'tl-flash-msg'; el.className = 'tl-flash-msg'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('visible'), 2000);
}

// ==================== INTERPOLAÇÃO ====================
function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }
function applyInterp(rawT, mode) {
    const t = Math.max(0, Math.min(1, rawT));
    if (mode === 'constant') return 0;
    if (mode === 'linear')   return t;
    return easeInOutCubic(t);
}
function getInterpolatedKF(uuid, clipId, frame) {
    const objKFs = AnimState.keyframes[uuid]?.[clipId]; if (!objKFs) return null;
    const frames = Object.keys(objKFs).map(Number).sort((a,b) => a-b);
    if (!frames.length) return null;
    let prev = null, next = null;
    for (const f of frames) { if (f <= frame) prev = f; if (f >= frame && next === null) next = f; }
    if (prev === null) return { ...objKFs[frames[0]] };
    if (next === null || prev === next) return { ...objKFs[prev] };
    const A = objKFs[prev], B = objKFs[next], mode = A.interp || AnimState.interpMode;
    if (mode === 'constant') return { ...A };
    const t = applyInterp((frame - prev) / (next - prev), mode);
    return {
        position: { x: lerp(A.position.x,B.position.x,t), y: lerp(A.position.y,B.position.y,t), z: lerp(A.position.z,B.position.z,t) },
        rotation: { x: lerp(A.rotation.x,B.rotation.x,t), y: lerp(A.rotation.y,B.rotation.y,t), z: lerp(A.rotation.z,B.rotation.z,t), order: A.rotation.order },
        scale:    { x: lerp(A.scale.x,B.scale.x,t),    y: lerp(A.scale.y,B.scale.y,t),    z: lerp(A.scale.z,B.scale.z,t) },
        interp: A.interp,
    };
}
// ── Bone helpers ─────────────────────────────────────────────────────────────
function _findSkinnedMeshForBone(bone) {
    const scene = _scene(); if (!scene) return null;
    let uuid = null;
    scene.traverse(o => { if (o.isSkinnedMesh && o.skeleton?.bones.includes(bone)) uuid = o.uuid; });
    return uuid;
}
function _getSkinnedMeshByUUID(uuid) {
    if (!uuid) return null;
    const s = _scene(); if (!s) return null;
    return s.getObjectByProperty('uuid', uuid) ?? null;
}
function _needsSkeletonUpdate(kf, obj) {
    return kf?.isBone || obj?.isBone;
}

function applyKFData(obj, kf) {
    obj.position.set(kf.position.x, kf.position.y, kf.position.z);
    obj.rotation.set(kf.rotation.x, kf.rotation.y, kf.rotation.z, kf.rotation.order ?? 'XYZ');
    obj.scale.set(kf.scale.x, kf.scale.y, kf.scale.z);
    if (_needsSkeletonUpdate(kf, obj)) {
        const sm = _getSkinnedMeshByUUID(kf.parentSkinnedMeshUUID);
        if (sm?.skeleton) sm.skeleton.update();
    }
}

function applyKeyframesAtFrame(frame) {
    // Track which SkinnedMeshes need skeleton.update() after all bones are moved
    const skinnedMeshesToUpdate = new Set();

    // ★ Cada objeto é animado pelo seu próprio CLIPE ATIVO (não por todos os clipes de uma vez)
    Object.keys(AnimState.clips).forEach(uuid => {
        const clipId = AnimState.activeClip[uuid]; if (!clipId) return;
        const objKFs = AnimState.keyframes[uuid]?.[clipId]; if (!objKFs) return;
        const obj = findObjectByUUID(uuid); if (!obj) return;
        const frames = Object.keys(objKFs).map(Number).sort((a,b) => a-b);
        if (!frames.length) return;
        let prev = null, next = null;
        for (const f of frames) { if (f <= frame) prev = f; if (f >= frame && next === null) next = f; }

        let kfApplied = null;
        if (prev === null) {
            applyKFData(obj, objKFs[frames[0]]); kfApplied = objKFs[frames[0]];
        } else if (next === null || prev === next) {
            applyKFData(obj, objKFs[prev]); kfApplied = objKFs[prev];
        } else {
            const A = objKFs[prev], B = objKFs[next], mode = A.interp || AnimState.interpMode;
            if (mode === 'constant') {
                applyKFData(obj, A); kfApplied = A;
            } else {
                const t = applyInterp((frame-prev)/(next-prev), mode);
                obj.position.set(lerp(A.position.x,B.position.x,t),lerp(A.position.y,B.position.y,t),lerp(A.position.z,B.position.z,t));
                obj.rotation.set(lerp(A.rotation.x,B.rotation.x,t),lerp(A.rotation.y,B.rotation.y,t),lerp(A.rotation.z,B.rotation.z,t),A.rotation.order ?? 'XYZ');
                obj.scale.set(lerp(A.scale.x,B.scale.x,t),lerp(A.scale.y,B.scale.y,t),lerp(A.scale.z,B.scale.z,t));
                kfApplied = A;
            }
        }
        // Queue SkinnedMesh update for bones
        if (kfApplied?.isBone || obj?.isBone) {
            const smUUID = kfApplied?.parentSkinnedMeshUUID;
            if (smUUID) skinnedMeshesToUpdate.add(smUUID);
        }
    });

    // Update all affected skeletons once after all bones moved
    skinnedMeshesToUpdate.forEach(smUUID => {
        const sm = _getSkinnedMeshByUUID(smUUID);
        if (sm?.skeleton) sm.skeleton.update();
    });
}
// ★ Duração relevante "agora" pra régua/loop: a do clipe ativo do objeto selecionado (ou um padrão)
function currentRulerEnd() {
    const obj = resolveAnimTarget(getActiveObject());
    if (obj) { const c = peekActiveClip(obj.uuid); if (c) return Math.max(c.duration, Math.round(AnimState.fps)); }
    return Math.round(AnimState.fps * 4);
}

// ==================== SEEK / PLAY ====================
function seekFrame(frame) {
    AnimState.frameExact = Math.max(0, frame);
    AnimState.currentFrame = Math.round(AnimState.frameExact);
    applyKeyframesAtFrame(AnimState.frameExact);
    updatePlayhead();
}
function jumpToStart() { seekFrame(0); }
function jumpToEnd()   { seekFrame(currentRulerEnd()); }

const _PLAY_ICON  = '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 2.3v11.4L13.5 8z" fill="currentColor"/></svg>';
const _PAUSE_ICON = '<svg viewBox="0 0 16 16" width="12" height="12"><rect x="3.2" y="2.3" width="3.2" height="11.4" rx="1" fill="currentColor"/><rect x="9.6" y="2.3" width="3.2" height="11.4" rx="1" fill="currentColor"/></svg>';
function play()  { AnimState.isPlaying = true;  AnimState.lastTimestamp = null; const i = document.getElementById('tl-play-icon'); if (i) i.innerHTML = _PAUSE_ICON; document.getElementById('tl-play-btn')?.classList.add('playing'); }
function pause() { AnimState.isPlaying = false; const i = document.getElementById('tl-play-icon'); if (i) i.innerHTML = _PLAY_ICON;  document.getElementById('tl-play-btn')?.classList.remove('playing'); }

const SPEED_STEPS = [0.5, 1, 1.5, 2];
function cyclePlaybackSpeed() {
    const i = SPEED_STEPS.indexOf(AnimState.playbackSpeed);
    AnimState.playbackSpeed = SPEED_STEPS[(i + 1) % SPEED_STEPS.length];
    const btn = document.getElementById('tl-speed-btn');
    if (btn) btn.textContent = AnimState.playbackSpeed + 'x';
    flashMessage(`Velocidade: ${AnimState.playbackSpeed}x`);
}

function updatePlayback(nowMs) {
    if (!AnimState.isPlaying) return;
    if (AnimState.lastTimestamp === null) { AnimState.lastTimestamp = nowMs; return; }
    AnimState.frameExact += ((nowMs - AnimState.lastTimestamp) / (1000 / AnimState.fps)) * (AnimState.playbackSpeed || 1);
    AnimState.lastTimestamp = nowMs;
    const loopEnd   = LoopState.enabled ? LoopState.outFrame  : currentRulerEnd();
    const loopStart = LoopState.enabled ? LoopState.inFrame : 0;
    if (AnimState.frameExact > loopEnd) AnimState.frameExact = loopStart + (AnimState.frameExact - loopEnd);
    AnimState.currentFrame = Math.floor(AnimState.frameExact);
    applyKeyframesAtFrame(AnimState.frameExact);
    updatePlayhead();
}

// ══ Dope Sheet ═══════════════════════════════════════
function toggleDopeSheet()  { const p = document.getElementById('dopesheet-panel'), b = document.getElementById('tl-track-btn'); if (!p||!b) return; if (!DopeSheetState.visible) closeAllPanels('dopesheet'); DopeSheetState.visible = !DopeSheetState.visible; p.classList.toggle('hidden', !DopeSheetState.visible); b.classList.toggle('active', DopeSheetState.visible); if (DopeSheetState.visible) renderDopeSheet(); }
function closeDopeSheet()   { DopeSheetState.visible = false; document.getElementById('dopesheet-panel')?.classList.add('hidden'); document.getElementById('tl-track-btn')?.classList.remove('active'); }
function renderDopeSheet() {
    const body = document.getElementById('dopesheet-body'); if (!body) return;
    body.innerHTML = '';
    const uuids = Object.keys(AnimState.clips).filter(u => peekClips(u).length);
    if (!uuids.length) { body.innerHTML = '<div class="dopesheet-empty">Nenhum clipe na cena ainda.</div>'; return; }
    uuids.forEach(uuid => {
        const clipId = peekActiveClipId(uuid); if (!clipId) return;
        const objKFs = peekClipKFs(uuid, clipId);
        const obj = findObjectByUUID(uuid), clip = peekActiveClip(uuid);
        const name = (obj ? (obj.name || 'Objeto') : uuid.slice(0,8)) + (clip ? ` · ${clip.name}` : '');
        const row = document.createElement('div'); row.className = 'ds-row';
        const nameEl = document.createElement('div'); nameEl.className = 'ds-name'; nameEl.textContent = name; nameEl.title = name;
        const trackEl = document.createElement('div'); trackEl.className = 'ds-track';
        const ph = document.createElement('div'); ph.className = 'ds-playhead'; ph.style.left = (AnimState.currentFrame * FRAME_WIDTH) + 'px'; trackEl.appendChild(ph);
        Object.keys(objKFs).forEach(fs => {
            const frame = parseInt(fs);
            const d = document.createElement('div'); d.className = 'ds-diamond'; d.style.left = (frame*FRAME_WIDTH+FRAME_WIDTH/2)+'px'; d.title = `Frame ${frame}`;
            d.addEventListener('click', () => seekFrame(frame));
            d.addEventListener('dblclick', () => { seekFrame(frame); selectKF(uuid, clipId, frame); });
            trackEl.appendChild(d);
        });
        row.appendChild(nameEl); row.appendChild(trackEl); body.appendChild(row);
    });
}

// ══ Graph Editor ═══════════════════════════════════════
const CH_META = {
    px:{color:'#ff5f5f',get:k=>k.position.x}, py:{color:'#5fff8a',get:k=>k.position.y}, pz:{color:'#5faeff',get:k=>k.position.z},
    rx:{color:'#ffb347',get:k=>k.rotation.x}, ry:{color:'#e0a0ff',get:k=>k.rotation.y}, rz:{color:'#00e5d4',get:k=>k.rotation.z},
    sx:{color:'#ffe066',get:k=>k.scale.x},    sy:{color:'#ff91d4',get:k=>k.scale.y},    sz:{color:'#c0ff80',get:k=>k.scale.z},
};
function toggleGraphEditor() { const p=document.getElementById('graph-panel'),b=document.getElementById('tl-graph-btn'); if(!p||!b) return; if(!GraphEdState.visible) closeAllPanels('graph'); GraphEdState.visible=!GraphEdState.visible; p.classList.toggle('hidden',!GraphEdState.visible); b.classList.toggle('active',GraphEdState.visible); if(GraphEdState.visible) renderGraphEditor(); }
function closeGraphEditor()  { GraphEdState.visible=false; document.getElementById('graph-panel')?.classList.add('hidden'); document.getElementById('tl-graph-btn')?.classList.remove('active'); }
function renderGraphEditor() {
    const canvas = document.getElementById('graph-canvas'); if (!canvas) return;
    const body = document.getElementById('graph-body');
    canvas.width = body.clientWidth||800; canvas.height = body.clientHeight||200;
    const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,
          PAD={left:48,right:16,top:12,bottom:20},
          plotW=W-PAD.left-PAD.right, plotH=H-PAD.top-PAD.bottom;
    ctx.clearRect(0,0,W,H); ctx.fillStyle='rgba(6,8,20,1)'; ctx.fillRect(0,0,W,H);
    const activeObj=resolveAnimTarget(getActiveObject()), au=activeObj?.uuid;
    const auHasKFs = au && Object.keys(peekActiveClipKFs(au)).length;
    const uuidList = auHasKFs ? [au] : Object.keys(AnimState.clips);
    const tracks = uuidList.map(u=>({uuid:u,clipId:peekActiveClipId(u),kfs:peekActiveClipKFs(u)})).filter(t=>t.clipId&&Object.keys(t.kfs).length);
    if(!tracks.length){ctx.fillStyle='rgba(255,255,255,.2)';ctx.font='12px monospace';ctx.textAlign='center';ctx.fillText('Selecione um objeto com keyframes',W/2,H/2);return;}
    let minV=Infinity,maxV=-Infinity,minF=Infinity,maxF=-Infinity;
    tracks.forEach(({kfs})=>Object.keys(kfs).forEach(fs=>{const f=parseInt(fs),kf=kfs[fs];if(f<minF)minF=f;if(f>maxF)maxF=f;GraphEdState.channels.forEach(ch=>{const v=CH_META[ch].get(kf);if(v<minV)minV=v;if(v>maxV)maxV=v;});}));
    if(!isFinite(minF)){minF=0;maxF=100;} if(minF===maxF){minF=Math.max(0,minF-10);maxF+=10;}
    const yr=maxV-minV||1,yp=yr*.15; minV-=yp; maxV+=yp;
    const fx=f=>PAD.left+((f-minF)/(maxF-minF))*plotW, vy=v=>PAD.top+(1-(v-minV)/(maxV-minV))*plotH;
    ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;
    for(let i=0;i<=5;i++){const y=PAD.top+(i/5)*plotH;ctx.beginPath();ctx.moveTo(PAD.left,y);ctx.lineTo(W-PAD.right,y);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.25)';ctx.font='9px monospace';ctx.textAlign='right';ctx.fillText((minV+(1-i/5)*(maxV-minV)).toFixed(2),PAD.left-4,y+3);}
    const S=Math.max(plotW,200);
    tracks.forEach(({uuid,clipId,kfs})=>{
        GraphEdState.channels.forEach(ch=>{const meta=CH_META[ch];ctx.strokeStyle=meta.color;ctx.lineWidth=1.5;ctx.shadowColor=meta.color;ctx.shadowBlur=4;ctx.beginPath();let ok=false;
        for(let i=0;i<=S;i++){const frame=minF+(i/S)*(maxF-minF);const kf=getInterpolatedKF(uuid,clipId,frame);if(!kf)continue;const x=fx(frame),y=vy(meta.get(kf));if(!ok){ctx.moveTo(x,y);ok=true;}else ctx.lineTo(x,y);}
        ctx.stroke();ctx.shadowBlur=0;
        Object.keys(kfs).forEach(fs=>{const frame=parseInt(fs),kf=kfs[fs],x=fx(frame),y=vy(meta.get(kf));ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fillStyle=meta.color;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();});
    });});
    if(AnimState.currentFrame>=minF&&AnimState.currentFrame<=maxF){const cx=fx(AnimState.currentFrame);ctx.strokeStyle='rgba(255,80,80,.8)';ctx.lineWidth=1.5;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(cx,PAD.top);ctx.lineTo(cx,PAD.top+plotH);ctx.stroke();ctx.setLineDash([]);}
}

// ══ Onion Skin ════════════════════════════════════════
function toggleOnionPanel() { const p=document.getElementById('onion-panel'),b=document.getElementById('tl-onion-btn');if(!p||!b)return;if(!OnionState.panelVisible)closeAllPanels('onion');OnionState.panelVisible=!OnionState.panelVisible;p.classList.toggle('hidden',!OnionState.panelVisible);b.classList.toggle('active',OnionState.panelVisible||OnionState.enabled); }
function closeOnionPanel()  { OnionState.panelVisible=false; document.getElementById('onion-panel')?.classList.add('hidden'); if(!OnionState.enabled) document.getElementById('tl-onion-btn')?.classList.remove('active'); }
function updateOnionGhosts() {
    removeOnionGhosts(); if(!OnionState.enabled)return;
    const raw=getActiveObject(); const obj=resolveAnimTarget(raw); if(!obj)return;
    const clipId=peekActiveClipId(obj.uuid); if(!clipId||!Object.keys(peekClipKFs(obj.uuid,clipId)).length)return;
    const scene=_scene(); if(!scene)return;
    const cf=AnimState.currentFrame;
    for(let i=1;i<=OnionState.framesBefore;i++) _spawnGhost(obj,obj.uuid,clipId,cf-i,'#6ec6ff',i,OnionState.framesBefore);
    for(let i=1;i<=OnionState.framesAfter; i++) _spawnGhost(obj,obj.uuid,clipId,cf+i,'#ffb347',i,OnionState.framesAfter);
}
function _spawnGhost(obj,uuid,clipId,frame,colorHex,step,total) {
    if(frame<0)return;const scene=_scene();if(!scene)return;
    const kf=getInterpolatedKF(uuid,clipId,frame);if(!kf)return;
    try {
        const ghost=obj.clone(); ghost.userData={_isOnionGhost:true};
        ghost.position.set(kf.position.x,kf.position.y,kf.position.z);
        ghost.rotation.set(kf.rotation.x,kf.rotation.y,kf.rotation.z,kf.rotation.order||'XYZ');
        ghost.scale.set(kf.scale.x,kf.scale.y,kf.scale.z);
        const alpha=OnionState.opacity*(1-(step-1)/total);
        ghost.traverse(child=>{child.userData={...child.userData,_isOnionGhost:true};if(child.isMesh&&child.material){const mat=child.material.clone();mat.transparent=true;mat.opacity=alpha;mat.depthWrite=false;if(mat.color?.set)mat.color.set(colorHex);child.material=mat;}});
        scene.add(ghost); OnionState.ghosts.push(ghost);
    } catch(e){}
}
function removeOnionGhosts() { const s=_scene();if(!s)return;OnionState.ghosts.forEach(g=>s.remove(g));OnionState.ghosts=[]; }

// ══ Marcadores ═══════════════════════════════════════
function toggleMarkerPanel(){ const p=document.getElementById('marker-panel'),b=document.getElementById('tl-marker-btn');if(!p||!b)return;if(!MarkerState.visible)closeAllPanels('marker');MarkerState.visible=!MarkerState.visible;p.classList.toggle('hidden',!MarkerState.visible);b.classList.toggle('active',MarkerState.visible);if(MarkerState.visible)renderMarkerList(); }
function closeMarkerPanel() { MarkerState.visible=false;document.getElementById('marker-panel')?.classList.add('hidden');document.getElementById('tl-marker-btn')?.classList.remove('active'); }
function addMarker(label)   { const frame=AnimState.currentFrame;AnimState.markers[frame]=label||`F${frame}`;renderMarkerList();renderMarkerPins();flashMessage(`Marcador "${AnimState.markers[frame]}" no frame ${frame}`); }
function deleteMarker(frame){ delete AnimState.markers[frame];renderMarkerList();renderMarkerPins(); }
function renderMarkerList() {
    const list=document.getElementById('marker-list');if(!list)return;
    const keys=Object.keys(AnimState.markers).map(Number).sort((a,b)=>a-b);
    if(!keys.length){list.innerHTML='<div class="dopesheet-empty">Nenhum marcador.</div>';return;}
    list.innerHTML='';
    keys.forEach(frame=>{const item=document.createElement('div');item.className='marker-item';item.innerHTML=`<div class="marker-color"></div><span class="marker-frame">${frame}</span><span class="marker-name">${AnimState.markers[frame]}</span><button class="marker-del"><svg viewBox="0 0 16 16" width="9" height="9"><path d="M2 2l12 12M14 2 2 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`;item.querySelector('.marker-name').addEventListener('click',()=>seekFrame(frame));item.querySelector('.marker-frame').addEventListener('click',()=>seekFrame(frame));item.querySelector('.marker-del').addEventListener('click',e=>{e.stopPropagation();deleteMarker(frame);});list.appendChild(item);});
}
function renderMarkerPins() {
    const layer=document.getElementById('timeline-markers');if(!layer)return;layer.innerHTML='';
    Object.entries(AnimState.markers).forEach(([frameStr,label])=>{const frame=parseInt(frameStr);const pin=document.createElement('div');pin.className='tl-marker-pin';pin.style.left=(frame*FRAME_WIDTH)+'px';pin.dataset.label=label;pin.title=`${label} (frame ${frame})`;pin.addEventListener('click',()=>seekFrame(frame));layer.appendChild(pin);});
}

// ══ Loop Region ═══════════════════════════════════════
function toggleLoopPanel(){ const p=document.getElementById('loop-panel'),b=document.getElementById('tl-loop-btn');if(!p||!b)return;if(!LoopState.visible)closeAllPanels('loop');LoopState.visible=!LoopState.visible;p.classList.toggle('hidden',!LoopState.visible);b.classList.toggle('active',LoopState.visible||LoopState.enabled); }
function closeLoopPanel() { LoopState.visible=false;document.getElementById('loop-panel')?.classList.add('hidden');if(!LoopState.enabled)document.getElementById('tl-loop-btn')?.classList.remove('active'); }
function updateLoopOverlay() { const ov=document.getElementById('timeline-loop-overlay');if(!ov)return;if(!LoopState.enabled){ov.style.display='none';return;}const inX=LoopState.inFrame*FRAME_WIDTH,outX=LoopState.outFrame*FRAME_WIDTH;ov.style.display='block';ov.style.left=inX+'px';ov.style.width=(outX-inX)+'px'; }

// ══ Auto-Key ══════════════════════════════════════════
function toggleAutoKeyPanel(){ const p=document.getElementById('autokey-panel'),b=document.getElementById('tl-autokey-btn');if(!p||!b)return;if(!p._akv)closeAllPanels('autokey');p._akv=!p._akv;p.classList.toggle('hidden',!p._akv);b.classList.toggle('active',p._akv||AutoKeyState.enabled); }
function closeAutoKeyPanel() { const p=document.getElementById('autokey-panel');if(p)p._akv=false;p?.classList.add('hidden');if(!AutoKeyState.enabled)document.getElementById('tl-autokey-btn')?.classList.remove('active'); }
function setAutoKey(enabled) {
    AutoKeyState.enabled=enabled;
    const btn=document.getElementById('tl-autokey-btn'),status=document.getElementById('autokey-status');
    if(btn)btn.classList.toggle('autokey-on',enabled);
    if(status)status.textContent=enabled?'ON':'OFF';
    // Hook TransformControls
    const tc=window._app?.transformControls;
    if(enabled&&tc&&!tc._autoKeyBound){
        tc._autoKeyBound=true;
        tc.addEventListener('objectChange',()=>{ if(AutoKeyState.enabled&&getActiveObject()) addKeyframe(); });
    }
    flashMessage(enabled?'Auto-Key ativado':'Auto-Key desativado');
}

// ══ Path — trilha de movimento do objeto selecionado (posições dos KFs) ═════
function removeMotionPath() {
    const scene = _scene();
    if (scene && PathState.lineObj) {
        scene.remove(PathState.lineObj);
        const i = helperRegistry.objects.indexOf(PathState.lineObj); if (i >= 0) helperRegistry.objects.splice(i, 1);
    }
    if (scene) PathState.dots.forEach(d => {
        scene.remove(d);
        const i = helperRegistry.objects.indexOf(d); if (i >= 0) helperRegistry.objects.splice(i, 1);
    });
    PathState.lineObj = null;
    PathState.dots = [];
}
function updateMotionPath() {
    removeMotionPath();
    if (!PathState.enabled) return;
    const obj = resolveAnimTarget(getActiveObject());
    const scene = _scene();
    if (!obj || !scene) return;
    const objKFs = peekActiveClipKFs(obj.uuid);
    if (!objKFs) return;
    const frames = Object.keys(objKFs).map(Number).sort((a,b) => a-b);
    if (frames.length < 2) return;
    try {
        const pts = frames.map(f => { const p = objKFs[f].position; return new THREE.Vector3(p.x, p.y, p.z); });
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffb14a, transparent: true, opacity: .9, depthTest: false }));
        line.renderOrder = 999; line.userData._isPathHelper = true;
        scene.add(line);
        PathState.lineObj = line;
        helperRegistry.objects.push(line);
        const dotGeo = new THREE.SphereGeometry(0.035, 8, 8);
        PathState.dots = frames.map(f => {
            const p = objKFs[f].position;
            const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffb14a, depthTest: false }));
            dot.position.set(p.x, p.y, p.z);
            dot.renderOrder = 999; dot.userData._isPathHelper = true;
            scene.add(dot);
            helperRegistry.objects.push(dot);
            return dot;
        });
    } catch (e) { /* geometria/objeto pode ter mudado no meio do caminho — ignora com segurança */ }
}
function togglePathMode() {
    PathState.enabled = !PathState.enabled;
    document.getElementById('tl-path-btn')?.classList.toggle('active', PathState.enabled);
    if (PathState.enabled) updateMotionPath(); else removeMotionPath();
    flashMessage(PathState.enabled ? 'Caminho de movimento ativado' : 'Caminho de movimento desativado');
}

// ══ Menu "mais" ══════════════════════════════════════════════════════════
function toggleMoreMenu() {
    const p = document.getElementById('more-menu-panel'), b = document.getElementById('tl-more-btn');
    if (!p || !b) return;
    if (!MoreMenuState.visible) closeAllPanels('more');
    MoreMenuState.visible = !MoreMenuState.visible;
    p.classList.toggle('hidden', !MoreMenuState.visible);
    b.classList.toggle('active', MoreMenuState.visible);
}
function closeMoreMenu() {
    MoreMenuState.visible = false;
    document.getElementById('more-menu-panel')?.classList.add('hidden');
    document.getElementById('tl-more-btn')?.classList.remove('active');
}

// ══ CLIPS ════════════════════════════════════════════════════════════════
// Redimensiona UM clipe específico arrastando a alcinha da sua própria faixa
function _wireClipResizeHandle(handle, block, uuid, clip) {
    let dragging = false, startX = 0, startDur = 0;
    handle.addEventListener('pointerdown', e => {
        e.stopPropagation(); e.preventDefault();
        dragging = true; startX = e.clientX; startDur = clip.duration;
        try { handle.setPointerCapture(e.pointerId); } catch (err) {}
    });
    handle.addEventListener('pointermove', e => {
        if (!dragging) return;
        const deltaFrames = (e.clientX - startX) / FRAME_WIDTH;
        const floor = Math.max(getClipMaxFrame(uuid, clip.id), 1);
        clip.duration = Math.max(floor, Math.round(startDur + deltaFrames));
        block.style.width = Math.max(clip.duration * FRAME_WIDTH, 3) + 'px';   // leve — sem recriar DOM em cada frame
        if (peekActiveClipId(uuid) === clip.id) buildRuler();                   // régua acompanha se for o clipe ativo
    });
    const endDrag = e => {
        if (!dragging) return; dragging = false;
        try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
        renderClipsSection();   // re-render completo só ao soltar
    };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
}

function renderClipsSection() {
    const listEl  = document.getElementById('tl-clips-list');
    const trackEl = document.getElementById('tl-clips-track');
    if (!listEl || !trackEl) return;

    const obj  = resolveAnimTarget(getActiveObject());
    const uuid = obj?.uuid;
    const clips    = uuid ? peekClips(uuid) : [];
    const activeId = uuid ? peekActiveClipId(uuid) : null;

    listEl.innerHTML = '';
    trackEl.querySelectorAll('.tl-clip-row').forEach(r => r.remove());

    if (!obj)          { const e=document.createElement('div'); e.className='dopesheet-empty'; e.textContent='Selecione um objeto';  listEl.appendChild(e); return; }
    if (!clips.length) { const e=document.createElement('div'); e.className='dopesheet-empty'; e.textContent='Nenhum clipe ainda.';  listEl.appendChild(e); return; }

    const fps = Math.max(1, AnimState.fps || 24);
    clips.forEach(clip => {
        const isActive = clip.id === activeId;
        const kfs = peekClipKFs(uuid, clip.id);

        // sidebar
        const entry = document.createElement('div');
        entry.className = 'tl-clip-entry' + (isActive ? ' active' : '');
        entry.title = `${(clip.duration / fps).toFixed(1)}s`;
        const dot = document.createElement('span'); dot.className = 'tl-clip-dot';
        const nm  = document.createElement('span'); nm.className  = 'tl-clip-entry-name'; nm.textContent = clip.name;
        entry.append(dot, nm);
        entry.addEventListener('click', () => setActiveClip(uuid, clip.id));
        listEl.appendChild(entry);

        // faixa (bloco simples + pontinhos de keyframe, sempre visíveis)
        const row   = document.createElement('div'); row.className = 'tl-clip-row';
        const block = document.createElement('div'); block.className = 'tl-clip-block' + (isActive ? ' active' : '');
        block.style.width = Math.max(clip.duration * FRAME_WIDTH, 3) + 'px';
        const label = document.createElement('span'); label.className = 'tl-clip-block-label'; label.textContent = clip.name;
        block.appendChild(label);
        Object.keys(kfs).forEach(fs => {
            const f = parseInt(fs);
            const d = document.createElement('div'); d.className = 'tl-clip-kf-dot'; d.style.left = (f * FRAME_WIDTH) + 'px';
            block.appendChild(d);
        });
        const handle = document.createElement('div'); handle.className = 'tl-clip-resize-handle'; handle.title = 'Arraste para redimensionar o clipe';
        block.appendChild(handle);
        _wireClipResizeHandle(handle, block, uuid, clip);
        block.addEventListener('click', e => { if (!e.target.closest('.tl-clip-resize-handle')) setActiveClip(uuid, clip.id); });

        row.appendChild(block);
        trackEl.appendChild(row);
    });
}

function linkScroll(a, b) {
    if (!a || !b) return;
    let syncing = false;
    a.addEventListener('scroll', () => { if (syncing) return; syncing = true; b.scrollLeft = a.scrollLeft; syncing = false; });
    b.addEventListener('scroll', () => { if (syncing) return; syncing = true; a.scrollLeft = b.scrollLeft; syncing = false; });
}

function closeAllPanels(except) {
    if(except!=='dopesheet') closeDopeSheet();
    if(except!=='graph')     closeGraphEditor();
    if(except!=='onion')     closeOnionPanel();
    if(except!=='marker')    closeMarkerPanel();
    if(except!=='loop')      closeLoopPanel();
    if(except!=='autokey')   closeAutoKeyPanel();
    if(except!=='more')      closeMoreMenu();
}

// ==================== EVENTOS ====================
function setupEvents() {
    document.getElementById('tl-play-btn')?.addEventListener('click',()=>{if(AnimState.isPlaying)pause();else play();});
    document.getElementById('tl-tostart-btn')?.addEventListener('click', jumpToStart);
    document.getElementById('tl-toend-btn')?.addEventListener('click', jumpToEnd);
    document.getElementById('tl-speed-btn')?.addEventListener('click', cyclePlaybackSpeed);
    document.getElementById('tl-add-kf-btn')?.addEventListener('click',()=>addKeyframe());
    document.getElementById('tl-path-btn')?.addEventListener('click', togglePathMode);
    document.getElementById('tl-more-btn')?.addEventListener('click', e=>{e.stopPropagation();toggleMoreMenu();});
    document.getElementById('tl-tipo-btn')?.addEventListener('click',e=>{e.stopPropagation();closeAllPanels('tipo');document.getElementById('fps-panel')?.classList.toggle('hidden');});
    document.getElementById('fps-apply-btn')?.addEventListener('click',()=>{const inp=document.getElementById('fps-input');if(inp){const v=parseInt(inp.value);if(v>=1&&v<=120){AnimState.fps=v;buildRuler();renderClipsSection();}}document.getElementById('fps-panel')?.classList.add('hidden');});
    ['smooth','linear','constant'].forEach(m=>{document.getElementById(`interp-${m}-btn`)?.addEventListener('click',()=>{AnimState.interpMode=m;['smooth','linear','constant'].forEach(mm=>document.getElementById(`interp-${mm}-btn`)?.classList.toggle('active',mm===m));flashMessage(`Interpolação: ${m}`);});});
    document.getElementById('kf-copy-btn')?.addEventListener('click',  e=>{e.stopPropagation();copySelectedKF();});
    document.getElementById('kf-paste-btn')?.addEventListener('click', e=>{e.stopPropagation();pasteKF();});
    document.getElementById('kf-delete-btn')?.addEventListener('click',e=>{e.stopPropagation();deleteSelectedKF();});
    document.getElementById('timeline-track')?.addEventListener('click',e=>{const track=document.getElementById('timeline-track');const rect=track.getBoundingClientRect();seekFrame(Math.max(0,(e.clientX-rect.left+track.scrollLeft)/FRAME_WIDTH));if(AnimState.selectedKF)deselectKF();});
    document.getElementById('tl-track-btn')?.addEventListener('click',e=>{e.stopPropagation();toggleDopeSheet();});
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
    document.getElementById('graph-channel-toggles')?.addEventListener('click',e=>{const btn=e.target.closest('.ch-btn');if(!btn)return;const ch=btn.dataset.ch;if(GraphEdState.channels.has(ch))GraphEdState.channels.delete(ch);else GraphEdState.channels.add(ch);btn.classList.toggle('active',GraphEdState.channels.has(ch));if(GraphEdState.visible)renderGraphEditor();});
    document.getElementById('onion-enabled')?.addEventListener('change', e=>{OnionState.enabled=e.target.checked;document.getElementById('tl-onion-btn')?.classList.toggle('active',OnionState.enabled||OnionState.panelVisible);if(OnionState.enabled)updateOnionGhosts();else removeOnionGhosts();flashMessage(OnionState.enabled?'Onion Skin ativado':'Onion Skin desativado');});
    document.getElementById('onion-before')?.addEventListener('input',  e=>{OnionState.framesBefore=parseInt(e.target.value);document.getElementById('onion-before-val').textContent=OnionState.framesBefore;if(OnionState.enabled)updateOnionGhosts();});
    document.getElementById('onion-after')?.addEventListener('input',   e=>{OnionState.framesAfter=parseInt(e.target.value);document.getElementById('onion-after-val').textContent=OnionState.framesAfter;if(OnionState.enabled)updateOnionGhosts();});
    document.getElementById('onion-opacity')?.addEventListener('input', e=>{OnionState.opacity=parseInt(e.target.value)/100;document.getElementById('onion-opacity-val').textContent=e.target.value+'%';if(OnionState.enabled)updateOnionGhosts();});
    document.getElementById('marker-add-btn')?.addEventListener('click', ()=>{const inp=document.getElementById('marker-label-input');addMarker(inp?.value.trim()||'');if(inp)inp.value='';});
    document.getElementById('marker-label-input')?.addEventListener('keydown',e=>{if(e.key==='Enter'){const inp=e.target;addMarker(inp.value.trim()||'');inp.value='';}});
    document.getElementById('loop-enabled')?.addEventListener('change',e=>{LoopState.enabled=e.target.checked;document.getElementById('tl-loop-btn')?.classList.toggle('active',LoopState.enabled||LoopState.visible);updateLoopOverlay();flashMessage(LoopState.enabled?`Loop: ${LoopState.inFrame} a ${LoopState.outFrame}`:'Loop desativado');});
    document.getElementById('loop-in')?.addEventListener('change',  e=>{LoopState.inFrame=Math.max(0,parseInt(e.target.value)||0);updateLoopOverlay();});
    document.getElementById('loop-out')?.addEventListener('change', e=>{LoopState.outFrame=Math.max(LoopState.inFrame+1,parseInt(e.target.value)||100);updateLoopOverlay();});
    document.getElementById('loop-in-set')?.addEventListener('click', ()=>{LoopState.inFrame=AnimState.currentFrame;const inp=document.getElementById('loop-in');if(inp)inp.value=LoopState.inFrame;updateLoopOverlay();});
    document.getElementById('loop-out-set')?.addEventListener('click',()=>{LoopState.outFrame=AnimState.currentFrame;const inp=document.getElementById('loop-out');if(inp)inp.value=LoopState.outFrame;updateLoopOverlay();});
    document.getElementById('autokey-enabled')?.addEventListener('change',e=>setAutoKey(e.target.checked));

    // ── CLIPS ── "+ Add Clip" cria mesmo um clipe novo no objeto — não depende de já existir keyframe
    document.getElementById('tl-addclip-btn')?.addEventListener('click', () => {
        const obj = resolveAnimTarget(getActiveObject());
        if (!obj) { flashMessage('Selecione um objeto primeiro'); return; }
        createNewClip(obj.uuid);
        buildRuler();
        refreshDiamonds();
        renderClipsSection();
        flashMessage('Clip criado');
    });
    document.getElementById('tl-clips-track')?.addEventListener('click', e=>{
        if(e.target.closest('.tl-clip-resize-handle')||e.target.closest('.tl-clip-block')) return;
        const track=document.getElementById('tl-clips-track'); const rect=track.getBoundingClientRect();
        seekFrame(Math.max(0,(e.clientX-rect.left+track.scrollLeft)/FRAME_WIDTH));
    });
    linkScroll(document.getElementById('timeline-track'), document.getElementById('tl-clips-track'));

    document.addEventListener('click',e=>{
        const panel=document.getElementById('fps-panel'),anchor=document.getElementById('tl-tipo-btn');
        if(panel&&anchor&&!panel.contains(e.target)&&!anchor.contains(e.target))panel.classList.add('hidden');
        const moreMenu=document.getElementById('more-menu-panel'),moreBtn=document.getElementById('tl-more-btn');
        if(moreMenu&&moreBtn&&MoreMenuState.visible&&!moreMenu.contains(e.target)&&!moreBtn.contains(e.target))closeMoreMenu();
        const toolbar=document.getElementById('kf-toolbar');
        if(toolbar&&AnimState.selectedKF&&!toolbar.contains(e.target)&&!e.target.classList.contains('kf-diamond'))deselectKF();
    });
    document.addEventListener('keydown',e=>{
        if(!AnimState.visible)return;
        if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
        if(e.code==='Space'){e.preventDefault();if(AnimState.isPlaying)pause();else play();}
        if(e.key==='k'||e.key==='K') addKeyframe();
        if(e.code==='ArrowRight') seekFrame(Math.min(AnimState.currentFrame+1, currentRulerEnd()));
        if(e.code==='ArrowLeft')  seekFrame(Math.max(0, AnimState.currentFrame-1));
        if((e.key==='Delete'||e.key==='Backspace')&&AnimState.selectedKF){e.preventDefault();deleteSelectedKF();}
        if(e.key==='d'||e.key==='D') toggleDopeSheet();
        if(e.key==='g'||e.key==='G') toggleGraphEditor();
        if(e.key==='o'||e.key==='O') toggleOnionPanel();
        if(e.key==='m'||e.key==='M') addMarker('');
        if(e.key==='l'||e.key==='L') toggleLoopPanel();
    });
    window.addEventListener('resize',()=>{if(GraphEdState.visible)renderGraphEditor();});

    // ★ Troca de seleção → cada objeto mostra seu próprio clipe ativo
    window.addEventListener('scene-selection-changed', () => {
        buildRuler();
        refreshDiamonds();
        renderClipsSection();
        if(GraphEdState.visible) renderGraphEditor();
        if(OnionState.enabled)   updateOnionGhosts();
        if(PathState.enabled)    updateMotionPath();
    });
}

// ==================== INIT ====================
function init() { createTimelineUI(); updatePlayhead(); renderClipsSection(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

// ==================== API PÚBLICA ====================
export const AnimationSystem = {
    toggle() {
        const c = document.getElementById('timeline-container'); if (!c) return;
        AnimState.visible = !AnimState.visible;
        c.style.display = AnimState.visible ? 'flex' : 'none';
        // Mostrar/esconder bottomBar (a timeline ocupa o espaço do bottom bar)
        const bb = document.getElementById('bottomBar');
        if (bb) bb.style.display = AnimState.visible ? 'none' : '';
        const animBtn = document.getElementById('animBtn');
        animBtn?.classList.toggle('active', AnimState.visible);
        if (AnimState.visible) { buildRuler(); updatePlayhead(); refreshDiamonds(); renderClipsSection(); }
    },
    update(nowMs) { updatePlayback(nowMs); },
    seekFrame,
    addKeyframe,
    isVisible()  { return AnimState.visible; },
    isPlaying()  { return AnimState.isPlaying; },
    getFrame()   { return AnimState.currentFrame; },
    getState()   { return AnimState; },
    goToFrame(f) { seekFrame(f); },
    refreshUI()  { buildRuler(); refreshDiamonds(); renderClipsSection(); },
};
window.AnimationSystem = AnimationSystem;
