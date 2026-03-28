// ==================== main.js ====================
// Nexus Engine — orquestra UI, objetos, input, animação.
// Importa infraestrutura de scene.js / postprocess.js / render.js

// engine.js + particle-engine.js são carregados via script module no index.html
// e expostos em window._nexusEngine e window._ParticleEngine

import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';
import { GLTFLoader }       from 'https://unpkg.com/three@0.169.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader }      from 'https://unpkg.com/three@0.169.0/examples/jsm/loaders/DRACOLoader.js';
import { OBJLoader }        from 'https://unpkg.com/three@0.169.0/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader }        from 'https://unpkg.com/three@0.169.0/examples/jsm/loaders/MTLLoader.js';
import { mergeGeometries }  from 'https://unpkg.com/three@0.169.0/examples/jsm/utils/BufferGeometryUtils.js';

// ── Módulos Nexus ─────────────────────────────────────────────────────────────
import {
    scene, camera, renderer, controls, transformControls,
    gridHelper, axesHelper, bloomLayer,
    ambientLight, dirLight, fillLight,
    isMobile, getViewW, getViewH,
} from './scene.js';

import {
    _postU, _frameBudget, bloomPass,
    bloomComposer, finalComposer, depthRT,
    invalidateBloomCache, rebuildBloomCache,
    syncBloomTexture, resizeComposers,
    smartRender, renderWithBloom, _updateVolLightScreen,
    _taa,
    _snapshotPostQuality,
    setMarkDirtyRef as _ppSetMarkDirtyRef,
    setSceneObjectsRef, setBoneHelpers as _ppSetBoneHelpers,
} from './postprocess.js';

// ── render.js
import {
    triggerDownload, downloadWithQuality, captureSceneToCanvas,
    VideoExport, _pauseRender,
    setMarkDirtyRef as _rnSetMarkDirtyRef,
    setBoneLayer as _rnSetBoneLayer,
} from './render.js';



// ==================== BAKE DE EXPLOSÃO ====================
(function() {
    const bakeBtn     = document.getElementById('explosion-bake-btn');
    const clearBakeBtn= document.getElementById('explosion-bake-clear');
    const fpsInput    = document.getElementById('bake-fps');
    const durInput    = document.getElementById('bake-duration');
    const startInput  = document.getElementById('bake-start-frame');

    if (bakeBtn) {
        bakeBtn.addEventListener('click', e => {
            e.stopPropagation();
            const obj = activeObject;
            if (!obj || obj.userData?.particleType !== 'explosion') return;

            const fps   = Math.max(12, Math.min(60,  parseInt(fpsInput?.value)   || 24));
            const dur   = Math.max(0.5, Math.min(10, parseFloat(durInput?.value)  || 2.5));
            const start = parseInt(startInput?.value) ?? (obj.userData.spawnFrame ?? 0);

            bakeBtn.disabled     = true;
            bakeBtn.textContent  = '⏳ Gravando…';

            // Dois rAFs para deixar o browser pintar antes de travar na simulação
            requestAnimationFrame(() => requestAnimationFrame(() => {
                try {
                    const count = obj.bake(fps, dur, start);
                    bakeBtn.textContent = `✅ ${count} frames gravados`;
                    markDirty(2);
                    updateParticlePanel();
                } catch(err) {
                    console.error('Bake error:', err);
                    bakeBtn.textContent = '❌ Erro no bake';
                }
                setTimeout(() => { bakeBtn.textContent = '🎬 Gravar Animação'; bakeBtn.disabled = false; }, 2000);
            }));
        });
    }

    if (clearBakeBtn) {
        clearBakeBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (!activeObject?.clearBake) return;
            activeObject.clearBake();
            activeObject.reset?.();
            markDirty(2);
            updateParticlePanel();
        });
    }
})();

const sceneObjects    = [];
const selectedObjects = new Set();
let activeObject  = null;
let objectCounter = 0;
const particleSystems = [];

// ── Wiring cross-module refs ──────────────────────────────────────────────────
// postprocess.js e render.js precisam dessas referências para funcionar.
// São injetadas aqui depois que as variáveis são declaradas.
setSceneObjectsRef(sceneObjects);

// ── Globals window.* — definidos CEDO para módulos não-module (animation.js etc.)
// scene/camera/renderer vêm de imports; funções são hoisted; arrays já declarados acima.
window._nexusScene             = scene;
window._nexusRenderer          = renderer;
window._nexusCamera            = camera;
window._nexusTransformControls = transformControls;
window._nexusOrbitControls     = controls;
window._nexusFinalComposer     = finalComposer;
window._nexusBloomComposer     = bloomComposer;
window.sceneObjects            = sceneObjects;
window._nexusParticleSystems   = particleSystems;
window._nexusGetActive         = () => activeObject;
window._nexusSetActive         = (obj) => setActiveObject(obj);
window._nexusIsParticle        = (obj) => isParticleSystem(obj);
window._nexusIsLight           = (obj) => isLight(obj);
window._nexusMarkDirty         = (n) => markDirty(n);
window._nexusRequestShadow     = () => requestShadowUpdate();
window._nexusInvalidateBloom   = () => invalidateBloomCache();

// Engine + ParticleLab init
window.addEventListener('_nexusEngineReady', () => {
    if (window._nexusEngine?.engineInit) {
        window._nexusEngine.engineInit(scene, renderer, camera);
    }
    if (window._ParticleEngine) {
        window._nexusParticleLab = new window._ParticleEngine.ParticleLab(scene);
    }
});

// markDirty precisa existir antes de ser injetado — declarada logo abaixo
// (a injeção final acontece após a declaração de markDirty)


// IDs dos grupos expandidos na arvore
const _openGroupIds = new Set();



// ── Reparent state ───────────────────────────────────────────────
let _reparentSrcId = null;

function cancelReparentMode() {
    _reparentSrcId = null;
    document.querySelectorAll('.tree-item.reparent-src').forEach(el => el.classList.remove('reparent-src'));
    document.querySelectorAll('.tree-item.reparent-hover').forEach(el => el.classList.remove('reparent-hover'));
    const hint = document.getElementById('drag-hint');
    if (hint) hint.classList.add('hidden');
}

(function injectReparentCSS() {
    if (document.getElementById('_reparent_css')) return;
    const s = document.createElement('style');
    s.id = '_reparent_css';
    s.textContent = `
        .tree-item.reparent-src {
            background: rgba(255, 200, 50, 0.14) !important;
            outline: 1px dashed rgba(255, 200, 50, 0.55);
            outline-offset: -1px;
        }
        .tree-item.reparent-hover {
            background: rgba(50, 200, 90, 0.14) !important;
            outline: 1px solid rgba(50, 200, 90, 0.55);
            outline-offset: -1px;
        }
        #drag-hint.reparent-active {
            border-color: rgba(255, 200, 50, 0.5);
            color: #ffd060;
            background: rgba(255, 200, 50, 0.07);
        }
    `;
    document.head.appendChild(s);
})();

// ==================== RAYCASTER ====================
const _raycaster = new THREE.Raycaster();
const _rayMouse  = new THREE.Vector2();
_raycaster.layers.set(1);

let _pointerDownX = 0, _pointerDownY = 0, _pointerMoved = false;
renderer.domElement.addEventListener('pointerdown', e => { _pointerDownX = e.clientX; _pointerDownY = e.clientY; _pointerMoved = false; });
renderer.domElement.addEventListener('pointermove', e => { if (Math.abs(e.clientX - _pointerDownX) > 8 || Math.abs(e.clientY - _pointerDownY) > 8) _pointerMoved = true; });
renderer.domElement.addEventListener('pointerup', e => {
    if (e.button !== 0 || !controls.enabled) return;
    if (povActive) return;
    const rect = renderer.domElement.getBoundingClientRect();

    // ── Seleção de osso — antes do filtro _pointerMoved, tolerância maior no mobile ──
    if (boneHelpers.length > 0) {
        const _boneTol = isMobile ? 20 : 10;
        const _boneOk  = Math.abs(e.clientX - _pointerDownX) <= _boneTol &&
                         Math.abs(e.clientY - _pointerDownY) <= _boneTol;
        if (_boneOk) {
            const _boneProj = new THREE.Vector3();
            let closest = null, closestDist = isMobile ? BONE_CLICK_PX * 1.8 : BONE_CLICK_PX;
            boneHelpers.forEach(({ bone }) => {
                bone.getWorldPosition(_boneProj); _boneProj.project(camera); if (_boneProj.z > 1) return;
                const sx = (_boneProj.x + 1) / 2 * rect.width + rect.left;
                const sy = (-_boneProj.y + 1) / 2 * rect.height + rect.top;
                const dist = Math.hypot(e.clientX - sx, e.clientY - sy);
                if (dist < closestDist) { closestDist = dist; closest = bone; }
            });
            if (closest) { activeObject = null; window.activeObject = null; selectedObjects.clear(); selectBone(closest); updateObjectsList(); if (!window._fxEditActive) transformControls.attach(closest); e.stopPropagation(); return; }
        }
    }

    if (_pointerMoved) return;

    _rayMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _rayMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_rayMouse, camera);

    const candidates = [];
    scene.traverse(obj => {
        if (!obj.isMesh || !obj.visible || obj.userData.isDefaultLight || obj.userData.isBoneHelper) return;
        // FIX: inclui meshes isCamInternal p/ permitir clicar na câmera; exclui apenas frustum lines
        if (obj.userData.isFrustumLines) return;
        if (obj.userData.isFXSprite) return;
        if (!obj.layers.test(_raycaster.layers)) return;
        candidates.push(obj);
    });

    const hits = _raycaster.intersectObjects(candidates, false);
    if (hits.length > 0) {
        let root = hits[0].object;
        while (root.parent && root.parent !== scene) root = root.parent;
        const target = sceneObjects.includes(root) ? root : (sceneObjects.includes(hits[0].object) ? hits[0].object : root);
        selectBone(null);
        // ── Multi-select: Ctrl/Cmd/Shift toggles objects into selectedObjects ──
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            if (selectedObjects.has(target)) {
                selectedObjects.delete(target);
                setActiveObject(selectedObjects.size > 0 ? [...selectedObjects].at(-1) : null);
            } else {
                selectedObjects.add(target);
                setActiveObject(target);
            }
        } else {
            if (!selectedObjects.has(target)) selectedObjects.clear();
            selectedObjects.add(target);
            setActiveObject(target);
        }
        updateObjectsList();
    } else {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            selectBone(null); selectedObjects.clear(); setActiveObject(null); transformControls.detach();
        }
        updateObjectsList();
    }
});

// ==================== SISTEMA DE OSSOS ====================
const boneHelpers = [];
let selectedBone  = null;
const BONE_LAYER = 2, BONE_COLOR_DEFAULT = 0xffffff, BONE_COLOR_SELECTED = 0xff8800, BONE_CLICK_PX = 20;
// Compartilha boneHelpers com postprocess.js (bloom render precisa escondê-los)
_ppSetBoneHelpers(boneHelpers);
const boneSphereGeo = new THREE.SphereGeometry(1, 6, 6);
function makeBoneMat(color) { return new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.92 }); }
function createBoneLine() {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const mat = new THREE.LineBasicMaterial({ color: 0xbbbbbb, depthTest: false, transparent: true, opacity: 0.55 });
    const line = new THREE.Line(geo, mat); line.layers.set(BONE_LAYER); line.userData.isBoneHelper = true; return line;
}
function buildBoneHelpers(model) {
    const bonesSet = new Set();
    model.traverse(obj => {
        if (obj.isBone) bonesSet.add(obj);
        if (obj.isSkinnedMesh && obj.skeleton) obj.skeleton.bones.forEach(b => bonesSet.add(b));
    });
    const bones = [...bonesSet];
    if (bones.length === 0) { return; }
    const box = new THREE.Box3().setFromObject(model), size = new THREE.Vector3();
    box.getSize(size);
    const modelHeight = Math.max(size.x, size.y, size.z) || 2;
    const sphereRadius = Math.max(0.04, modelHeight * 0.02);
    bones.forEach(bone => {
        const sphere = new THREE.Mesh(boneSphereGeo, makeBoneMat(BONE_COLOR_DEFAULT));
        sphere.scale.setScalar(sphereRadius); sphere.layers.set(BONE_LAYER); sphere.userData.isBoneHelper = true;
        sphere.userData.bone = bone; sphere.renderOrder = 999; scene.add(sphere);
        const lines = [];
        bone.children.forEach(child => { if (child.isBone) { const line = createBoneLine(); line.renderOrder = 998; scene.add(line); lines.push({ line, child }); } });
        boneHelpers.push({ sphere, bone, lines });
    });
    model.updateWorldMatrix(true, true); updateBoneHelpers(); invalidateBloomCache();
}
const _boneWPos = new THREE.Vector3(), _boneCPos = new THREE.Vector3();
function updateBoneHelpers() {
    for (let i = 0; i < boneHelpers.length; i++) {
        const h = boneHelpers[i]; h.bone.getWorldPosition(_boneWPos); h.sphere.position.copy(_boneWPos);
        for (let j = 0; j < h.lines.length; j++) {
            const { line, child } = h.lines[j]; child.getWorldPosition(_boneCPos);
            const pos = line.geometry.attributes.position;
            pos.setXYZ(0, _boneWPos.x, _boneWPos.y, _boneWPos.z); pos.setXYZ(1, _boneCPos.x, _boneCPos.y, _boneCPos.z); pos.needsUpdate = true;
        }
    }
}
function selectBone(bone) {
    if (selectedBone) { const prev = boneHelpers.find(h => h.bone === selectedBone); if (prev) prev.sphere.material.color.setHex(BONE_COLOR_DEFAULT); }
    selectedBone = bone;
    if (bone) {
        const curr = boneHelpers.find(h => h.bone === bone); if (curr) curr.sphere.material.color.setHex(BONE_COLOR_SELECTED);
        if (!window._fxEditActive) transformControls.attach(bone); window.activeObject = bone; window.selectedBone = bone;
    } else { if (!activeObject) transformControls.detach(); window.activeObject = activeObject; window.selectedBone = null; }
}
function removeBoneHelpers() {
    boneHelpers.forEach(({ sphere, lines }) => {
        scene.remove(sphere); sphere.material.dispose();
        lines.forEach(({ line }) => { scene.remove(line); line.geometry.dispose(); });
    });
    boneHelpers.length = 0; selectedBone = null; invalidateBloomCache();
}
// Remove apenas os bone helpers pertencentes a um modelo específico
function removeBoneHelpersFor(model) {
    if (!model) return;
    // Coleta todos os ossos do modelo a ser removido
    const modelBones = new Set();
    model.traverse(obj => { if (obj.isBone) modelBones.add(obj); if (obj.isSkinnedMesh && obj.skeleton) obj.skeleton.bones.forEach(b => modelBones.add(b)); });
    if (modelBones.size === 0) return;
    // Remove apenas os helpers cujo osso pertence a esse modelo
    for (let i = boneHelpers.length - 1; i >= 0; i--) {
        const h = boneHelpers[i];
        if (modelBones.has(h.bone)) {
            scene.remove(h.sphere); h.sphere.material.dispose();
            h.lines.forEach(({ line }) => { scene.remove(line); line.geometry.dispose(); });
            if (selectedBone === h.bone) selectedBone = null;
            boneHelpers.splice(i, 1);
        }
    }
    invalidateBloomCache();
}

// ==================== HISTÓRICO ====================
const historyStack = [];
let historyIndex = -1;
const maxHistorySteps = 50;

// Versão debounced de saveState — usada por sliders/inputs que disparam dezenas de eventos por segundo
let _saveStateTimer = null;
function saveStateDebounced(delay = 350) {
    clearTimeout(_saveStateTimer);
    _saveStateTimer = setTimeout(saveState, delay);
}
function saveState() {
    markDirty(3);
    if (historyIndex < historyStack.length - 1) historyStack.splice(historyIndex + 1);
    const state = sceneObjects.map(obj => ({
        uuid: obj.uuid, position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone(),
        visible: obj.visible, layers: obj.layers.mask,
        material: obj.isMesh ? { color: obj.material.color?.getHex(), emissive: obj.material.emissive?.getHex(), roughness: obj.material.roughness, metalness: obj.material.metalness, transparent: obj.material.transparent, opacity: obj.material.opacity } : null,
    }));
    historyStack.push(state);
    if (historyStack.length > maxHistorySteps) historyStack.shift();
    historyIndex = historyStack.length - 1; updateUndoRedoButtons();
}
function restoreState(index) {
    if (index < 0 || index >= historyStack.length) return;
    const state = historyStack[index];
    sceneObjects.forEach(obj => {
        const saved = state.find(s => s.uuid === obj.uuid); if (!saved) return;
        obj.position.copy(saved.position); obj.rotation.copy(saved.rotation); obj.scale.copy(saved.scale);
        obj.visible = saved.visible; obj.layers.mask = saved.layers;
        if (obj.isMesh && saved.material && obj.material.color) {
            obj.material.color.setHex(saved.material.color);
            if (obj.material.emissive) obj.material.emissive.setHex(saved.material.emissive);
            obj.material.roughness = saved.material.roughness; obj.material.metalness = saved.material.metalness;
            obj.material.transparent = saved.material.transparent; obj.material.opacity = saved.material.opacity;
            obj.material.needsUpdate = true;
        }
    });
    invalidateBloomCache(); updateObjectsList(); updateUndoRedoButtons();
}
function undo() { if (historyIndex > 0) { historyIndex--; restoreState(historyIndex); } }
function redo() { if (historyIndex < historyStack.length - 1) { historyIndex++; restoreState(historyIndex); } }
function updateUndoRedoButtons() {
    const u = document.getElementById('undo-btn'), r = document.getElementById('redo-btn');
    if (u) u.disabled = historyIndex <= 0; if (r) r.disabled = historyIndex >= historyStack.length - 1;
}

// ==================== UTILITÁRIOS ====================
function isFireParticleSystem(obj)        { return typeof window.FireParticleSystem        !== 'undefined' && obj instanceof window.FireParticleSystem; }
function isLaserParticleSystem(obj)       { return typeof window.LaserParticleSystem       !== 'undefined' && obj instanceof window.LaserParticleSystem; }
function isElectricityParticleSystem(obj) { return typeof window.ElectricityParticleSystem !== 'undefined' && obj instanceof window.ElectricityParticleSystem; }
function isElectricityArcSystem(obj) { return typeof window.ElectricityArcSystem !== 'undefined' && obj instanceof window.ElectricityArcSystem; }
function isBlackHoleSystem(obj)      { return typeof window.BlackHoleSystem      !== 'undefined' && obj instanceof window.BlackHoleSystem; }
function isTvStaticSystem(obj)       { return typeof window.TvStaticSystem       !== 'undefined' && obj instanceof window.TvStaticSystem; }
function isParticleSystem(obj) { return obj && (isFireParticleSystem(obj) || isLaserParticleSystem(obj) || isElectricityParticleSystem(obj) || isElectricityArcSystem(obj) || isBlackHoleSystem(obj) || isTvStaticSystem(obj) || (obj.userData && obj.userData.isParticle === true)); }
function isLight(obj) { return obj && (obj.isLight || (obj.userData && obj.userData.isLight === true)); }
function isCamera(obj) { return !!(obj && obj.userData && obj.userData.isCamera === true); }
function generateName(type) { objectCounter++; return `${type} ${objectCounter}`; }
function getMeshesFromObject(obj) {
    const m = []; if (!obj) return m;
    if (obj.isMesh) m.push(obj);
    else obj.children?.forEach(c => {
        if (!c.userData?.isCamInternal && !c.userData?.isFrustumLines) m.push(...getMeshesFromObject(c));
    });
    return m;
}
function safeGetElement(id) {
    const el = document.getElementById(id); return el;
}

// ==================== UI ELEMENTS ====================
const menuBtn       = safeGetElement('menu-btn');
const materialBtn   = safeGetElement('material-btn');
const particleBtn   = safeGetElement('particle-btn');
const lightBtn      = safeGetElement('light-btn');
const addPanel      = safeGetElement('add-panel');
const materialPanel = safeGetElement('material-panel');
const particlePanel = safeGetElement('particle-panel');
const lightPanel    = safeGetElement('light-panel');
const settingsBtn   = safeGetElement('settings-btn');
const animBtn       = safeGetElement('anim-btn');
const fxBtn         = safeGetElement('fx-btn');
const modelBtn      = safeGetElement('model-btn');
const renderBtn     = safeGetElement('render-btn');
const postPanel     = safeGetElement('post-panel');
const downloadRenderBtn  = safeGetElement('download-render');
const renderQualityBtn   = safeGetElement('render-quality-btn');
const renderQualityPanel = safeGetElement('render-quality-panel');
const objectsListEl  = safeGetElement('objects-list');
const objectCountEl  = document.querySelector('.object-count');
const gizmoModeBtns  = document.querySelectorAll('.gizmo-btn');
const contextMenu    = safeGetElement('context-menu');
const contextMenuBtn = safeGetElement('context-menu-btn');
let contextMenuTarget = null;

const undoBtn        = safeGetElement('undo-btn');
const redoBtn        = safeGetElement('redo-btn');
const importModelBtn = safeGetElement('import-model-btn');
const modelFileInput = safeGetElement('model-file-input');

const materialNoSelection     = safeGetElement('material-no-selection');
const materialControls        = safeGetElement('material-controls');
const matColor                = safeGetElement('mat-color');
const matDiffuse              = safeGetElement('mat-diffuse');
const clearDiffuse            = safeGetElement('clear-diffuse');
const matTransparent          = safeGetElement('mat-transparent');
const matOpacity              = safeGetElement('mat-opacity');
const matOpacityNum           = safeGetElement('mat-opacity-num');
const matRoughness            = safeGetElement('mat-roughness');
const matRoughnessNum         = safeGetElement('mat-roughness-num');
const matMetalness            = safeGetElement('mat-metalness');
const matMetalnessNum         = safeGetElement('mat-metalness-num');
const matEmissive             = safeGetElement('mat-emissive');
const matEmissiveIntensity    = safeGetElement('mat-emissive-intensity');
const matEmissiveIntensityNum = safeGetElement('mat-emissive-intensity-num');
const matBloomToggle          = safeGetElement('mat-bloom-toggle');
const matRoughnessMap         = safeGetElement('mat-roughness-map');
const clearRoughnessMap       = safeGetElement('clear-roughness-map');
const matMetalnessMap         = safeGetElement('mat-metalness-map');
const clearMetalnessMap       = safeGetElement('clear-metalness-map');
const matNormalMap            = safeGetElement('mat-normal-map');
const clearNormalMap          = safeGetElement('clear-normal-map');
const matAoMap                = safeGetElement('mat-ao-map');
const clearAoMap              = safeGetElement('clear-ao-map');
const outlineToggle           = safeGetElement('outline-toggle');
const outlineColor            = safeGetElement('outline-color');

const lightNoSelection   = safeGetElement('light-no-selection');
const lightControls      = safeGetElement('light-controls');
const lightColor         = safeGetElement('light-color');
const lightIntensity     = safeGetElement('light-intensity');
const lightIntensityNum  = safeGetElement('light-intensity-num');
const lightDistance      = safeGetElement('light-distance');
const lightDistanceNum   = safeGetElement('light-distance-num');
const lightDistanceGroup = safeGetElement('light-distance-group');

const bloomStrength     = safeGetElement('bloom-strength');
const bloomStrengthNum  = safeGetElement('bloom-strength-num');
const bloomRadius       = safeGetElement('bloom-radius');
const bloomRadiusNum    = safeGetElement('bloom-radius-num');
const bloomThreshold    = safeGetElement('bloom-threshold');
const bloomThresholdNum = safeGetElement('bloom-threshold-num');

const particleNoSelection   = safeGetElement('particle-no-selection');
const particleControls      = safeGetElement('particle-controls');
const particleColor         = safeGetElement('particle-color');
const particleBrightness    = safeGetElement('particle-brightness');
const particleBrightnessNum = safeGetElement('particle-brightness-num');
const particleOpacity       = safeGetElement('particle-opacity');
const particleOpacityNum    = safeGetElement('particle-opacity-num');

const textureLoader = new THREE.TextureLoader();

// ==================== PAINEL DE QUALIDADE ====================
function updateFinalSizeBadge() {
    const badge = document.getElementById('rq-final-size'); if (!badge) return;
    try {
        const { outW, outH } = getRenderOutputSize();
        const aa = parseInt(document.getElementById('rq-aa')?.value || '1');
        if (aa > 1) badge.textContent = `${outW} × ${outH} px  (render: ${outW*aa} × ${outH*aa})`;
        else badge.textContent = `${outW} × ${outH} px`;
    } catch { badge.textContent = '—'; }
}
function getRenderOutputSize() {
    const resVal = document.getElementById('rq-resolution')?.value || 'viewport';
    if (resVal === 'viewport') return { outW: getViewW(), outH: getViewH() };
    if (resVal === 'custom') {
        const w = parseInt(document.getElementById('rq-custom-w')?.value || '1920');
        const h = parseInt(document.getElementById('rq-custom-h')?.value || '1080');
        return { outW: Math.max(1, w), outH: Math.max(1, h) };
    }
    const [w, h] = resVal.split('x').map(Number); return { outW: w, outH: h };
}
function getRenderQualitySettings() {
    const { outW, outH } = getRenderOutputSize();
    return { outW, outH, aa: parseInt(document.getElementById('rq-aa')?.value || '2'), format: document.getElementById('rq-format')?.value || 'png', quality: parseInt(document.getElementById('rq-quality')?.value || '92') / 100 };
}
if (renderQualityBtn && renderQualityPanel) {
    renderQualityBtn.addEventListener('click', e => { e.stopPropagation(); renderQualityPanel.classList.toggle('hidden'); if (!renderQualityPanel.classList.contains('hidden')) updateFinalSizeBadge(); });
    document.addEventListener('click', e => { if (renderQualityPanel && !renderQualityPanel.contains(e.target) && e.target !== renderQualityBtn) renderQualityPanel.classList.add('hidden'); });
    const rqResolution = document.getElementById('rq-resolution'), rqCustomRow = document.getElementById('rq-custom-row');
    if (rqResolution) rqResolution.addEventListener('change', () => { if (rqCustomRow) rqCustomRow.style.display = rqResolution.value === 'custom' ? 'flex' : 'none'; updateFinalSizeBadge(); });
    ['rq-custom-w', 'rq-custom-h'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', updateFinalSizeBadge); });
    const rqAa = document.getElementById('rq-aa'); if (rqAa) rqAa.addEventListener('change', updateFinalSizeBadge);
    const rqFormat = document.getElementById('rq-format'), rqJpegRow = document.getElementById('rq-jpeg-row');
    if (rqFormat && rqJpegRow) rqFormat.addEventListener('change', () => { rqJpegRow.style.display = (rqFormat.value === 'jpeg' || rqFormat.value === 'webp') ? 'flex' : 'none'; });
    const rqQuality = document.getElementById('rq-quality'), rqQualityVal = document.getElementById('rq-quality-val');
    if (rqQuality && rqQualityVal) rqQuality.addEventListener('input', () => { rqQualityVal.textContent = rqQuality.value + '%'; });
}

// ==================== EVENTOS ====================
if (menuBtn)     menuBtn.addEventListener('click',     e => { e.stopPropagation(); addPanel?.classList.toggle('hidden'); });
if (materialBtn) materialBtn.addEventListener('click', e => { e.stopPropagation(); materialPanel?.classList.toggle('hidden'); });
if (particleBtn) particleBtn.addEventListener('click', e => { e.stopPropagation(); particlePanel?.classList.toggle('hidden'); });
if (lightBtn)    lightBtn.addEventListener('click',    e => { e.stopPropagation(); lightPanel?.classList.toggle('hidden'); });
if (animBtn)     animBtn.addEventListener('click',     e => { e.stopPropagation(); window.AnimationSystem?.toggle(); });
if (fxBtn)       fxBtn.addEventListener('click',       e => { e.stopPropagation(); const p = document.getElementById('special-panel'); if (p) p.classList.toggle('hidden'); fxBtn.classList.toggle('active'); });

if (renderBtn)   renderBtn.addEventListener('click',   e => { e.stopPropagation(); postPanel?.classList.toggle('hidden'); });

// ==================== PAINEL DE MODELAGEM ====================
(function () {
    const toggleBtn  = document.getElementById('modeling-toggle-btn');
    const modPanel   = document.getElementById('modeling-panel');
    if (!toggleBtn || !modPanel) return;

    // ─── STATE ────────────────────────────────────────────────────
    let editActive = false;
    let editMesh   = null;
    let selMode    = 'face'; // 'face' | 'edge' | 'vert'
    let selIdx     = -1;

    let _wireChild = null;
    let _hlFill    = null;
    let _hlLine    = null;
    let _dotGroup  = null;
    let _pivot     = null;
    let _pivotCB   = null;

    // Vertex position lookup: pos key → [all indices with that position]
    // Rebuilt when entering edit or geometry changes
    let _sharedVerts = null; // Map<string, number[]>

    const _ray   = new THREE.Raycaster();
    const _mouse = new THREE.Vector2();
    _ray.layers.enableAll();

    // ─── PANEL TOGGLE ─────────────────────────────────────────────
    toggleBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (editActive) {
            exitEdit();
            modPanel.classList.add('hidden');
            toggleBtn.classList.remove('open');
        } else {
            const mesh = _getMesh();
            if (!mesh) return;
            enterEdit(mesh);
            modPanel.classList.remove('hidden');
            toggleBtn.classList.add('open');
        }
    });

    document.addEventListener('click', e => {
        if (editActive) return;
        if (!modPanel.contains(e.target) && e.target !== toggleBtn) {
            modPanel.classList.add('hidden');
            toggleBtn.classList.remove('open');
        }
    });

    // ─── SELECTION MODE BUTTONS ───────────────────────────────────
    modPanel.querySelectorAll('.mod-btn-sel[data-sel]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            selMode = btn.dataset.sel;
            modPanel.querySelectorAll('.mod-btn-sel').forEach(b => b.classList.remove('mod-btn-on'));
            btn.classList.add('mod-btn-on');
            _clearSelection();
            _buildWire();
        });
    });

    // ─── TOOL BUTTONS ─────────────────────────────────────────────
    const extrudeBtn = document.getElementById('mod-extrude-btn');
    const exitBtn    = document.getElementById('mod-exit-btn');

    if (extrudeBtn) extrudeBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!editActive || selIdx < 0 || selMode !== 'face') {
            alert('Selecione uma face primeiro.'); return;
        }
        _extrudeSelected();
    });

    if (exitBtn) exitBtn.addEventListener('click', e => {
        e.stopPropagation();
        exitEdit();
        modPanel.classList.add('hidden');
        toggleBtn.classList.remove('open');
    });

    // ─── EXTRA MODELING TOOLS ─────────────────────────────────────
    // Subdivide
    const subdivideBtn = document.getElementById('mod-subdivide-btn');
    if (subdivideBtn) subdivideBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!editMesh) return;
        let geo = editMesh.geometry;
        if (geo.index) { geo = geo.toNonIndexed(); editMesh.geometry = geo; }
        // Simple midpoint subdivision (1 level)
        const pos = geo.attributes.position;
        const cnt = pos.count;
        const newPos = [];
        for (let i = 0; i < cnt; i += 3) {
            const ax=pos.getX(i), ay=pos.getY(i), az=pos.getZ(i);
            const bx=pos.getX(i+1), by=pos.getY(i+1), bz=pos.getZ(i+1);
            const cx=pos.getX(i+2), cy=pos.getY(i+2), cz=pos.getZ(i+2);
            const abx=(ax+bx)/2, aby=(ay+by)/2, abz=(az+bz)/2;
            const bcx=(bx+cx)/2, bcy=(by+cy)/2, bcz=(bz+cz)/2;
            const cax=(cx+ax)/2, cay=(cy+ay)/2, caz=(cz+az)/2;
            newPos.push(ax,ay,az, abx,aby,abz, cax,cay,caz);
            newPos.push(abx,aby,abz, bx,by,bz, bcx,bcy,bcz);
            newPos.push(cax,cay,caz, bcx,bcy,bcz, cx,cy,cz);
            newPos.push(abx,aby,abz, bcx,bcy,bcz, cax,cay,caz);
        }
        const newGeo = new THREE.BufferGeometry();
        newGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newPos), 3));
        newGeo.computeVertexNormals();
        editMesh.geometry.dispose();
        editMesh.geometry = newGeo;
        _buildSharedVerts();
        _buildWire();
        markDirty(3);
    });

    // Smooth normals
    const smoothBtn = document.getElementById('mod-smooth-btn');
    if (smoothBtn) smoothBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!editMesh) return;
        editMesh.geometry.computeVertexNormals();
        editMesh.geometry.attributes.normal.needsUpdate = true;
        const mats = Array.isArray(editMesh.material) ? editMesh.material : [editMesh.material];
        mats.forEach(m => { if (m) { m.flatShading = false; m.needsUpdate = true; } });
        markDirty(2);
    });

    // Flip normals of selected face
    const flipBtn = document.getElementById('mod-flip-btn');
    if (flipBtn) flipBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!editMesh || selIdx < 0 || selMode !== 'face') { alert('Selecione uma face.'); return; }
        const pos = editMesh.geometry.attributes.position;
        const b = selIdx * 3;
        // Swap vertex 0 and 2 to flip winding
        const tmp = [pos.getX(b), pos.getY(b), pos.getZ(b)];
        pos.setXYZ(b, pos.getX(b+2), pos.getY(b+2), pos.getZ(b+2));
        pos.setXYZ(b+2, tmp[0], tmp[1], tmp[2]);
        pos.needsUpdate = true;
        editMesh.geometry.computeVertexNormals();
        markDirty(2);
    });

    // Wireframe toggle
    let _wireframeOn = false;
    const wireframeBtn = document.getElementById('mod-wireframe-btn');
    if (wireframeBtn) wireframeBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!editMesh) return;
        _wireframeOn = !_wireframeOn;
        const mats = Array.isArray(editMesh.material) ? editMesh.material : [editMesh.material];
        mats.forEach(m => { if (m) { m.wireframe = _wireframeOn; m.needsUpdate = true; } });
        wireframeBtn.style.color = _wireframeOn ? 'rgba(100,200,255,0.9)' : '';
        markDirty(2);
    });

    // Dissolve (delete selected vertex/edge/face without hole)
    const dissolveBtn = document.getElementById('mod-dissolve-btn');
    if (dissolveBtn) dissolveBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!editMesh || selIdx < 0) { alert('Selecione algo primeiro.'); return; }
        const pos = editMesh.geometry.attributes.position;
        const cnt = pos.count;
        const newArr = [];
        for (let i = 0; i < cnt; i += 3) {
            const triIdx = i / 3;
            if (selMode === 'face' && triIdx === selIdx) continue;
            newArr.push(pos.getX(i),pos.getY(i),pos.getZ(i));
            newArr.push(pos.getX(i+1),pos.getY(i+1),pos.getZ(i+1));
            newArr.push(pos.getX(i+2),pos.getY(i+2),pos.getZ(i+2));
        }
        const newGeo = new THREE.BufferGeometry();
        newGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newArr), 3));
        newGeo.computeVertexNormals();
        editMesh.geometry.dispose();
        editMesh.geometry = newGeo;
        selIdx = -1;
        _clearSelection();
        _buildSharedVerts();
        _buildWire();
        markDirty(3);
    });

    // Inset (stub — selects face and scales it in)
    const insetBtn = document.getElementById('mod-inset-btn');
    if (insetBtn) insetBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!editMesh || selIdx < 0 || selMode !== 'face') { alert('Selecione uma face.'); return; }
        const pos = editMesh.geometry.attributes.position;
        const b = selIdx * 3;
        const cx = (pos.getX(b)+pos.getX(b+1)+pos.getX(b+2))/3;
        const cy = (pos.getY(b)+pos.getY(b+1)+pos.getY(b+2))/3;
        const cz = (pos.getZ(b)+pos.getZ(b+1)+pos.getZ(b+2))/3;
        const t = 0.2; // inset amount
        for (let i = b; i < b+3; i++) {
            pos.setXYZ(i,
                pos.getX(i) + (cx - pos.getX(i)) * t,
                pos.getY(i) + (cy - pos.getY(i)) * t,
                pos.getZ(i) + (cz - pos.getZ(i)) * t
            );
        }
        pos.needsUpdate = true;
        editMesh.geometry.computeVertexNormals();
        _buildWire();
        markDirty(2);
    });

    // Loop cut (stub — adds midpoint ring, basic implementation)
    const loopBtn = document.getElementById('mod-loop-btn');
    if (loopBtn) loopBtn.addEventListener('click', e => {
        e.stopPropagation();
        // For now, subdivide and inform user
        if (!editMesh) return;
        subdivideBtn?.click();
    });

    // Bevel (stub — moves edge slightly)
    const bevelBtn = document.getElementById('mod-bevel-btn');
    if (bevelBtn) bevelBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!editMesh || selIdx < 0) { alert('Selecione uma aresta.'); return; }
        alert('Bevel: Selecione uma aresta e use Extrude para criar chanfro manualmente.');
    });

    // ─── ENTER EDIT ───────────────────────────────────────────────
    function enterEdit(mesh) {
        if (mesh.geometry.index) {
            mesh.geometry = mesh.geometry.toNonIndexed();
            mesh.geometry.computeVertexNormals();
        }

        editMesh   = mesh;
        editActive = true;
        selIdx     = -1;

        window._editModeActive = true;
        // Allow camera orbit (middle mouse / right mouse) in edit mode
        // Only intercept left-click for mesh selection
        controls.enabled = true;
        controls.mouseButtons = {
            LEFT:   THREE.MOUSE.PAN,      // left drag = pan (not orbit) so click-pick works cleanly
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT:  THREE.MOUSE.ROTATE,   // right drag = orbit in edit mode
        };

        _buildSharedVerts();
        _buildWire();

        renderer.domElement.addEventListener('pointerdown', _onEditDown, true);
        renderer.domElement.addEventListener('pointerup',   _onEditUp,   true);

        invalidateBloomCache();
        markDirty(2);
    }

    function exitEdit() {
        if (!editActive) return;
        editActive   = false;
        _sharedVerts = null;

        window._editModeActive = false;
        controls.enabled = true;
        // Restore default camera mouse buttons
        controls.mouseButtons = {
            LEFT:   THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT:  THREE.MOUSE.PAN,
        };

        renderer.domElement.removeEventListener('pointerdown', _onEditDown, true);
        renderer.domElement.removeEventListener('pointerup',   _onEditUp,   true);

        _clearSelection();
        _removeWire();
        _detachPivot();

        // Nuclear cleanup: remove ANY leftover proxy children from the mesh
        if (editMesh) {
            const toRemove = [];
            editMesh.traverse(child => {
                if (child !== editMesh && child.userData.isFaceProxy) toRemove.push(child);
            });
            toRemove.forEach(c => {
                c.parent?.remove(c);
                c.geometry?.dispose();
                c.material?.dispose();
            });
        // Recompute normals so mesh renders correctly
        if (editMesh.geometry) {
            editMesh.geometry.computeVertexNormals();
            editMesh.geometry.attributes.position.needsUpdate = true;
            if (editMesh.geometry.attributes.normal) editMesh.geometry.attributes.normal.needsUpdate = true;
        }
        // Force material refresh — sem isso o renderer pode cachear o estado antigo
        const mats = Array.isArray(editMesh.material) ? editMesh.material : [editMesh.material];
        mats.forEach(m => {
            if (m) {
                m.flatShading = false;  // Corrige objeto "quadrado" ao sair do modo edição
                m.needsUpdate = true;
            }
        });
    }

        editMesh = null;
        selIdx   = -1;

        // Detach gizmo so it doesn't try to move a ghost pivot
        transformControls.detach();

        invalidateBloomCache();
        requestShadowUpdate();
        markDirty(4);
    }

    // ─── POINTER HANDLING IN EDIT MODE ───────────────────────────
    // Track whether user clicked or dragged (for gizmo drag vs selection)
    let _editDownX = 0, _editDownY = 0, _editDragging = false;

    function _onEditDown(e) {
        if (!editActive || e.button !== 0) return;
        _editDownX   = e.clientX;
        _editDownY   = e.clientY;
        _editDragging = false;
        // Don't stop - let TransformControls pointerdown through
    }

    function _onEditUp(e) {
        if (!editActive || e.button !== 0) return;

        const moved = Math.abs(e.clientX - _editDownX) > 6 || Math.abs(e.clientY - _editDownY) > 6;
        if (moved) return; // was a gizmo drag, not a click

        // Check if the click hit the transform gizmo handle
        // TransformControls exposes isPointerDown; if gizmo was being dragged, skip pick
        if (transformControls.dragging) return;

        e.stopImmediatePropagation();
        _pick(e);
    }

    function _pick(e) {
        const rect = renderer.domElement.getBoundingClientRect();
        _mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        _mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        _ray.setFromCamera(_mouse, camera);
        editMesh.updateMatrixWorld(true);

        if (selMode === 'face') {
            const hits = _ray.intersectObject(editMesh, false);
            if (!hits.length) { _clearSelection(); return; }
            const tri = hits[0].faceIndex;
            if (tri === selIdx) return;
            selIdx = tri;
            _highlightFace(tri);
            _attachPivotFace(tri);

        } else if (selMode === 'vert') {
            _pickVertex();

        } else if (selMode === 'edge') {
            const hits = _ray.intersectObject(editMesh, false);
            if (!hits.length) { _clearSelection(); return; }
            const tri = hits[0].faceIndex;
            const localPt = hits[0].point.clone().applyMatrix4(new THREE.Matrix4().copy(editMesh.matrixWorld).invert());
            const edge = _nearestEdge(tri, localPt);
            if (edge === selIdx) return;
            selIdx = edge;
            _highlightEdge(tri, edge);
            _attachPivotEdge(tri, edge);
        }
        markDirty(2);
    }

    function _pickVertex() {
        const pos  = editMesh.geometry.attributes.position;
        const rect = renderer.domElement.getBoundingClientRect();
        const mx   = _mouse.x, my = _mouse.y;
        let best = -1, bestDist = 0.008; // NDC threshold
        const p = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
            p.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(editMesh.matrixWorld).project(camera);
            const d = Math.abs(p.x - mx) + Math.abs(p.y - my);
            if (d < bestDist) { bestDist = d; best = i; }
        }
        if (best < 0) { _clearSelection(); return; }
        if (best === selIdx) return;
        selIdx = best;
        _highlightVert(best);
        _attachPivotVert(best);
    }

    function _nearestEdge(triIdx, localPt) {
        const pos  = editMesh.geometry.attributes.position;
        const base = triIdx * 3;
        const v = [
            new THREE.Vector3(pos.getX(base),   pos.getY(base),   pos.getZ(base)),
            new THREE.Vector3(pos.getX(base+1), pos.getY(base+1), pos.getZ(base+1)),
            new THREE.Vector3(pos.getX(base+2), pos.getY(base+2), pos.getZ(base+2)),
        ];
        let best = 0, bestD = Infinity;
        const seg = new THREE.Line3(), cl = new THREE.Vector3();
        for (let e = 0; e < 3; e++) {
            seg.set(v[e], v[(e+1)%3]);
            seg.closestPointToPoint(localPt, true, cl);
            const d = cl.distanceToSquared(localPt);
            if (d < bestD) { bestD = d; best = e; }
        }
        return triIdx * 3 + best;
    }

    // ─── SHARED VERTEX LOOKUP ─────────────────────────────────────
    // Build a map: posKey → list of all buffer indices at that position
    // This is the KEY fix: moving a face/edge/vert must move ALL
    // buffer entries sharing that world position so mesh stays connected.
    function _buildSharedVerts() {
        _sharedVerts = new Map();
        const pos = editMesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const k = pos.getX(i).toFixed(5)+','+pos.getY(i).toFixed(5)+','+pos.getZ(i).toFixed(5);
            if (!_sharedVerts.has(k)) _sharedVerts.set(k, []);
            _sharedVerts.get(k).push(i);
        }
    }

    // Given a set of buffer indices, return ALL buffer indices that
    // share a position with ANY of them (the connected neighbourhood).
    function _expandToShared(indices) {
        const pos = editMesh.geometry.attributes.position;
        const all = new Set();
        for (const i of indices) {
            const k = pos.getX(i).toFixed(5)+','+pos.getY(i).toFixed(5)+','+pos.getZ(i).toFixed(5);
            const grp = _sharedVerts?.get(k);
            if (grp) grp.forEach(j => all.add(j));
        }
        return [...all];
    }

    // ─── WIREFRAME ────────────────────────────────────────────────
    function _buildWire() {
        _removeWire();
        if (!editMesh) return;

        const wGeo = new THREE.WireframeGeometry(editMesh.geometry);
        // BLACK wireframe so polygons are clearly visible
        const wMat = new THREE.LineBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.65,
            depthTest: true,
        });
        _wireChild = new THREE.LineSegments(wGeo, wMat);
        _wireChild.layers.set(0);  // Layer 0 ONLY — keeps it off bloom layer to avoid render corruption
        _wireChild.renderOrder = 2;
        _wireChild.userData.isFaceProxy = true;
        editMesh.add(_wireChild); // auto-follows mesh

        if (selMode === 'vert') _buildVertDots();
    }

    function _removeWire() {
        if (_wireChild) { _wireChild.parent?.remove(_wireChild); _wireChild.geometry.dispose(); _wireChild.material.dispose(); _wireChild = null; }
        if (_dotGroup)  { _dotGroup.parent?.remove(_dotGroup);   _dotGroup.geometry.dispose();  _dotGroup.material.dispose();  _dotGroup  = null; }
    }

    function _buildVertDots() {
        if (!editMesh) return;
        const pos = editMesh.geometry.attributes.position;
        const seen = new Set(), verts = [];
        for (let i = 0; i < pos.count; i++) {
            const k = pos.getX(i).toFixed(4)+','+pos.getY(i).toFixed(4)+','+pos.getZ(i).toFixed(4);
            if (seen.has(k)) continue; seen.add(k);
            verts.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        }
        const dGeo = new THREE.BufferGeometry();
        dGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        _dotGroup = new THREE.Points(dGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 6, sizeAttenuation: false, depthTest: false }));
        _dotGroup.layers.set(0);
        _dotGroup.renderOrder = 10;
        _dotGroup.userData.isFaceProxy = true;
        editMesh.add(_dotGroup);
    }

    // ─── HIGHLIGHTS ───────────────────────────────────────────────
    function _clearHighlight() {
        if (_hlFill) { _hlFill.parent?.remove(_hlFill); _hlFill.geometry.dispose(); _hlFill.material.dispose(); _hlFill = null; }
        if (_hlLine) { _hlLine.parent?.remove(_hlLine); _hlLine.geometry.dispose(); _hlLine.material.dispose(); _hlLine = null; }
    }

    function _clearSelection() {
        _clearHighlight();
        _detachPivot();
        selIdx = -1;
        markDirty(2);
    }

    function _triVerts(triIdx) {
        const pos = editMesh.geometry.attributes.position, b = triIdx * 3;
        return [
            new THREE.Vector3(pos.getX(b),   pos.getY(b),   pos.getZ(b)),
            new THREE.Vector3(pos.getX(b+1), pos.getY(b+1), pos.getZ(b+1)),
            new THREE.Vector3(pos.getX(b+2), pos.getY(b+2), pos.getZ(b+2)),
        ];
    }

    function _faceNudge(vA, vB, vC) {
        return new THREE.Vector3().crossVectors(
            new THREE.Vector3().subVectors(vB, vA),
            new THREE.Vector3().subVectors(vC, vA)
        ).normalize().multiplyScalar(0.004);
    }

    function _highlightFace(triIdx) {
        _clearHighlight();
        const [vA, vB, vC] = _triVerts(triIdx);
        const n = _faceNudge(vA, vB, vC);
        const a = vA.clone().add(n), b = vB.clone().add(n), c = vC.clone().add(n);

        // RED filled face
        const fGeo = new THREE.BufferGeometry();
        fGeo.setAttribute('position', new THREE.Float32BufferAttribute([a.x,a.y,a.z, b.x,b.y,b.z, c.x,c.y,c.z], 3));
        _hlFill = new THREE.Mesh(fGeo, new THREE.MeshBasicMaterial({
            color: 0xee2222, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthTest: false,
        }));
        _hlFill.renderOrder = 998;
        _hlFill.layers.set(0);
        _hlFill.userData.isFaceProxy = true;
        editMesh.add(_hlFill);

        // Bright red outline
        const lGeo = new THREE.BufferGeometry();
        lGeo.setAttribute('position', new THREE.Float32BufferAttribute([a.x,a.y,a.z, b.x,b.y,b.z, c.x,c.y,c.z], 3));
        _hlLine = new THREE.LineLoop(lGeo, new THREE.LineBasicMaterial({ color: 0xff4444, depthTest: false }));
        _hlLine.renderOrder = 999;
        _hlLine.layers.set(0);
        _hlLine.userData.isFaceProxy = true;
        editMesh.add(_hlLine);
    }

    function _highlightEdge(triIdx, edgeKey) {
        _clearHighlight();
        const [vA, vB, vC] = _triVerts(triIdx);
        const eLocal = edgeKey % 3;
        const [eA, eB] = [[vA,vB],[vB,vC],[vC,vA]][eLocal];
        const n = _faceNudge(vA, vB, vC);
        const a = eA.clone().add(n), b = eB.clone().add(n);

        const lGeo = new THREE.BufferGeometry();
        lGeo.setAttribute('position', new THREE.Float32BufferAttribute([a.x,a.y,a.z, b.x,b.y,b.z], 3));
        _hlLine = new THREE.Line(lGeo, new THREE.LineBasicMaterial({ color: 0xff4444, depthTest: false }));
        _hlLine.renderOrder = 999;
        _hlLine.layers.set(0);
        _hlLine.userData.isFaceProxy = true;
        editMesh.add(_hlLine);
    }

    function _highlightVert(vertIdx) {
        _clearHighlight();
        const pos = editMesh.geometry.attributes.position;
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute('position', new THREE.Float32BufferAttribute([pos.getX(vertIdx), pos.getY(vertIdx), pos.getZ(vertIdx)], 3));
        _hlFill = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xff2222, size: 12, sizeAttenuation: false, depthTest: false }));
        _hlFill.renderOrder = 999;
        _hlFill.layers.set(0);
        _hlFill.userData.isFaceProxy = true;
        editMesh.add(_hlFill);
    }

    // ─── REFRESH HIGHLIGHTS AFTER DEFORM ─────────────────────────
    function _refreshHighlightFace(triIdx) {
        _clearHighlight();
        _highlightFace(triIdx);
    }

    // ─── TRANSFORM PIVOT ──────────────────────────────────────────
    function _detachPivot() {
        if (_pivotCB) { transformControls.removeEventListener('objectChange', _pivotCB); _pivotCB = null; }
        if (_pivot)   { transformControls.detach(); _pivot.parent?.remove(_pivot); _pivot = null; }
    }

    function _makePivot(localPos) {
        _detachPivot();
        _pivot = new THREE.Object3D();
        _pivot.position.copy(localPos);
        editMesh.add(_pivot);
        transformControls.attach(_pivot);
    }

    // ─── FACE PIVOT ──────────────────────────────────────────────
    // KEY FIX: move ALL vertices sharing positions with the 3 face verts
    function _attachPivotFace(triIdx) {
        const [vA, vB, vC] = _triVerts(triIdx);
        const cen = new THREE.Vector3().add(vA).add(vB).add(vC).divideScalar(3);
        _makePivot(cen.clone());

        const pos       = editMesh.geometry.attributes.position;
        const prevLocal = cen.clone();

        // Expand: base 3 indices → all shared indices across whole mesh
        const faceIndices   = [triIdx*3, triIdx*3+1, triIdx*3+2];
        const sharedIndices = _expandToShared(faceIndices);

        _pivotCB = () => {
            const delta = _pivot.position.clone().sub(prevLocal);
            prevLocal.copy(_pivot.position);

            for (const i of sharedIndices) {
                pos.setXYZ(i,
                    pos.getX(i) + delta.x,
                    pos.getY(i) + delta.y,
                    pos.getZ(i) + delta.z
                );
            }
            pos.needsUpdate = true;
            editMesh.geometry.computeVertexNormals();

            // Rebuild shared vert map since positions moved
            _buildSharedVerts();
            _buildWire();
            _highlightFace(triIdx);
            markDirty(4);
        };
        transformControls.addEventListener('objectChange', _pivotCB);
    }

    // ─── EDGE PIVOT ───────────────────────────────────────────────
    function _attachPivotEdge(triIdx, edgeKey) {
        const [vA, vB, vC] = _triVerts(triIdx);
        const eLocal = edgeKey % 3;
        const offsets = [[0,1],[1,2],[2,0]][eLocal];
        const [eA, eB] = [[vA,vB],[vB,vC],[vC,vA]][eLocal];
        const cen = eA.clone().add(eB).multiplyScalar(0.5);
        _makePivot(cen.clone());

        const pos       = editMesh.geometry.attributes.position;
        const prevLocal = cen.clone();

        const edgeIndices   = offsets.map(o => triIdx*3 + o);
        const sharedIndices = _expandToShared(edgeIndices);

        _pivotCB = () => {
            const delta = _pivot.position.clone().sub(prevLocal);
            prevLocal.copy(_pivot.position);
            for (const i of sharedIndices) {
                pos.setXYZ(i, pos.getX(i)+delta.x, pos.getY(i)+delta.y, pos.getZ(i)+delta.z);
            }
            pos.needsUpdate = true;
            editMesh.geometry.computeVertexNormals();
            _buildSharedVerts();
            _buildWire();
            _highlightEdge(triIdx, edgeKey);
            markDirty(4);
        };
        transformControls.addEventListener('objectChange', _pivotCB);
    }

    // ─── VERTEX PIVOT ─────────────────────────────────────────────
    function _attachPivotVert(vertIdx) {
        const pos  = editMesh.geometry.attributes.position;
        const vPos = new THREE.Vector3(pos.getX(vertIdx), pos.getY(vertIdx), pos.getZ(vertIdx));
        _makePivot(vPos.clone());

        const prevLocal     = vPos.clone();
        const sharedIndices = _expandToShared([vertIdx]);

        _pivotCB = () => {
            const delta = _pivot.position.clone().sub(prevLocal);
            prevLocal.copy(_pivot.position);
            for (const i of sharedIndices) {
                pos.setXYZ(i, pos.getX(i)+delta.x, pos.getY(i)+delta.y, pos.getZ(i)+delta.z);
            }
            pos.needsUpdate = true;
            editMesh.geometry.computeVertexNormals();
            _buildSharedVerts();
            _buildWire();
            _highlightVert(sharedIndices[0]);
            markDirty(4);
        };
        transformControls.addEventListener('objectChange', _pivotCB);
    }

    // ─── EXTRUDE ──────────────────────────────────────────────────
    function _extrudeSelected() {
        const pos  = editMesh.geometry.attributes.position;
        const [vA, vB, vC] = _triVerts(selIdx);
        const nrm  = _faceNudge(vA, vB, vC).multiplyScalar(0.3 / 0.004);
        const eA   = vA.clone().add(nrm), eB = vB.clone().add(nrm), eC = vC.clone().add(nrm);

        const origArr = [];
        for (let i = 0; i < pos.count; i++) origArr.push(pos.getX(i), pos.getY(i), pos.getZ(i));

        const newTris = [
            eA.x,eA.y,eA.z, eB.x,eB.y,eB.z, eC.x,eC.y,eC.z,
            vA.x,vA.y,vA.z, vB.x,vB.y,vB.z, eB.x,eB.y,eB.z,
            vA.x,vA.y,vA.z, eB.x,eB.y,eB.z, eA.x,eA.y,eA.z,
            vB.x,vB.y,vB.z, vC.x,vC.y,vC.z, eC.x,eC.y,eC.z,
            vB.x,vB.y,vB.z, eC.x,eC.y,eC.z, eB.x,eB.y,eB.z,
            vC.x,vC.y,vC.z, vA.x,vA.y,vA.z, eA.x,eA.y,eA.z,
            vC.x,vC.y,vC.z, eA.x,eA.y,eA.z, eC.x,eC.y,eC.z,
        ];

        const newGeo = new THREE.BufferGeometry();
        newGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array([...origArr, ...newTris]), 3));
        newGeo.computeVertexNormals();
        editMesh.geometry.dispose();
        editMesh.geometry = newGeo;

        selIdx = -1;
        _clearHighlight();
        _detachPivot();
        _buildSharedVerts();
        _buildWire();
        invalidateBloomCache(); requestShadowUpdate(); saveState(); markDirty(4);
    }

    // ─── HELPER ───────────────────────────────────────────────────
    function _getMesh() {
        const obj = activeObject;
        if (!obj) { alert('Selecione um objeto primeiro.'); return null; }
        let mesh = null;
        if (obj.isMesh && obj.geometry) mesh = obj;
        else obj.traverse(c => { if (!mesh && c.isMesh && c.geometry) mesh = c; });
        if (!mesh) { alert('Objeto sem geometria editável.'); return null; }
        return mesh;
    }

    window._modelingFrameUpdate = function () {};
})();
if (downloadRenderBtn) downloadRenderBtn.addEventListener('click', e => { e.stopPropagation(); downloadWithQuality(); });
VideoExport.init(document.querySelector('.render-header-actions'));
VideoExport.show();

gizmoModeBtns.forEach(btn => {
    btn.addEventListener('click', () => { gizmoModeBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); transformControls.setMode(btn.dataset.mode); });
});

if (undoBtn) undoBtn.addEventListener('click', e => { e.stopPropagation(); undo(); });
if (redoBtn) redoBtn.addEventListener('click', e => { e.stopPropagation(); redo(); });
if (contextMenuBtn) {
    contextMenuBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (activeObject) { contextMenuTarget = activeObject; const r = contextMenuBtn.getBoundingClientRect(); showContextMenu(0, 0); }
        else alert('Nenhum objeto selecionado');
    });
}

// ── Collapse / Expand objects panel list ──────────────────────────────────────
(function () {
    const collapseBtn  = document.getElementById('collapse-objects-btn');
    const objectsList  = document.getElementById('objects-list');
    const dragHint     = document.getElementById('drag-hint');
    if (!collapseBtn || !objectsList) return;

    let collapsed = false;

    collapseBtn.addEventListener('click', e => {
        e.stopPropagation();
        collapsed = !collapsed;

        if (collapsed) {
            objectsList.style.display = 'none';
            if (dragHint) dragHint.style.display = 'none';
            collapseBtn.classList.add('collapsed');
            collapseBtn.title = 'Mostrar objetos';
        } else {
            objectsList.style.display = '';
            collapseBtn.classList.remove('collapsed');
            collapseBtn.title = 'Ocultar objetos';
        }
    });
})();

document.addEventListener('keydown', e => {
    if (povActive) {
        povKeys[e.code] = true;
        if (e.code === 'Escape') { exitPOV(); return; }
        if (!e.ctrlKey && !e.metaKey) return;
    }
    if (e.key === 'Escape') {
        if (_reparentSrcId !== null) { cancelReparentMode(); return; }
        selectBone(null); if (activeObject && !window._fxEditActive) transformControls.attach(activeObject);
    }
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); undo(); }
        else if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); redo(); }
    }
});
document.addEventListener('keyup', e => { if (povActive || !e.ctrlKey) delete povKeys[e.code]; });

// ==================== IMPORTAÇÃO DE MODELOS ====================
function showImportOverlay(msg = 'Importando modelo…') {
    removeImportOverlay();
    const ov = document.createElement('div'); ov.id = '_import_ov';
    ov.innerHTML = `<div id="_import_modal"><h4>📦 ${msg}</h4><div class="_imp_bar_bg"><div class="_imp_fill" id="_imp_bar"></div></div><div class="_imp_msg" id="_imp_msg">Carregando arquivo…</div></div>`;
    document.body.appendChild(ov);
}
function setImportProgress(pct, msg) {
    const bar = document.getElementById('_imp_bar'), txt = document.getElementById('_imp_msg');
    if (bar) bar.style.width = pct + '%'; if (txt) txt.textContent = msg;
}
function removeImportOverlay() { document.getElementById('_import_ov')?.remove(); }

const yieldFrame = () => new Promise(r => requestAnimationFrame(r));

async function traverseAsync(root, callback, chunkSize = 200) {
    const queue = [root]; let processed = 0;
    while (queue.length > 0) {
        const node = queue.shift(); callback(node); node.children.forEach(c => queue.push(c));
        if (++processed % chunkSize === 0) await yieldFrame();
    }
}
function isPOT(n) { return n > 0 && (n & (n - 1)) === 0; }
function nextPOT(n) { let p = 1; while (p < n) p <<= 1; return p; }

async function fixNPOTTextures(model) {
    const textures = new Set();
    model.traverse(child => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
            if (!mat) return;
            ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap','envMap','lightMap','displacementMap','bumpMap']
                .forEach(k => { if (mat[k]?.image) textures.add(mat[k]); });
        });
    });
    let fixed = 0;
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');

    // Limite de tamanho de textura — agressivo no mobile para não travar
    const MAX_TEX = isMobile ? 512 : (renderer.capabilities.maxTextureSize ? Math.min(renderer.capabilities.maxTextureSize, 4096) : 4096);

    for (const tex of textures) {
        const img = tex.image;
        if (!img || !(img instanceof HTMLImageElement || img instanceof ImageBitmap)) continue;
        const w = img.width ?? img.naturalWidth, h = img.height ?? img.naturalHeight;
        if (!w || !h) continue;

        // Calcula target respeitando POT e limite de tamanho
        let tw = w, th = h;
        if (tw > MAX_TEX || th > MAX_TEX) {
            const scale = Math.min(MAX_TEX / tw, MAX_TEX / th);
            tw = Math.floor(tw * scale); th = Math.floor(th * scale);
        }
        // Garante POT
        if (!isPOT(tw)) tw = nextPOT(tw);
        if (!isPOT(th)) th = nextPOT(th);
        tw = Math.min(tw, MAX_TEX); th = Math.min(th, MAX_TEX);

        if (tw === w && th === h) continue; // já ok
        canvas.width = tw; canvas.height = th; ctx.drawImage(img, 0, 0, tw, th);
        const newImg = new Image(tw, th);
        newImg.src = canvas.toDataURL(isMobile ? 'image/jpeg' : 'image/png', 0.88);
        await new Promise(r => { newImg.onload = r; newImg.onerror = r; });
        tex.image = newImg; tex.needsUpdate = true; fixed++; await yieldFrame();
    }
    return textures;
}

async function prewarmModel(model) {
    const textures = await fixNPOTTextures(model);
    const arr = [...textures];
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    for (let i = 0; i < arr.length; i++) {
        try { arr[i].anisotropy = maxAniso; arr[i].needsUpdate = true; renderer.initTexture(arr[i]); } catch {}
        if (i % 3 === 2) await yieldFrame();
    }
    await yieldFrame();
    // compileAsync removido — causava crash de contexto WebGL em modelos pesados no mobile
    let pendingUploads = 0;
    model.traverse(child => {
        if (!child.isMesh || child.isSkinnedMesh || child.userData._gpuUploaded) return;
        child.frustumCulled = false; child.userData._gpuUploaded = true; pendingUploads++;
        const orig = child.onAfterRender.bind(child);
        child.onAfterRender = function (...args) { orig(...args); child.frustumCulled = true; child.onAfterRender = orig; };
    });
}

async function optimizeModel(model) {
    model.updateWorldMatrix(true, true);
    const modelWorldInv = new THREE.Matrix4().copy(model.matrixWorld).invert(), groups = new Map();
    model.traverse(child => {
        if (!child.isMesh || child.isSkinnedMesh || !child.geometry || !child.material || Array.isArray(child.material)) return;
        if (child.geometry.groups?.length > 1 || Object.keys(child.geometry.morphAttributes || {}).length > 0) return;
        const key = child.material.uuid;
        if (!groups.has(key)) groups.set(key, { material: child.material, meshes: [] });
        groups.get(key).meshes.push(child);
    });
    let savedDrawCalls = 0;
    const chunkSize = isMobile ? 1 : 3; // no mobile processa 1 grupo por vez para não travar
    for (const [, group] of groups) {
        if (group.meshes.length < 2) continue;
        const geos = [], toRemove = [];
        for (const mesh of group.meshes) {
            mesh.updateWorldMatrix(true, false);
            const rel = new THREE.Matrix4().multiplyMatrices(modelWorldInv, mesh.matrixWorld);
            const geo = mesh.geometry.clone(); geo.applyMatrix4(rel); geos.push(geo); toRemove.push(mesh);
        }
        try {
            const merged = mergeGeometries(geos, false); if (!merged) { geos.forEach(g => g.dispose()); continue; }
            const mergedMesh = new THREE.Mesh(merged, group.material);
            mergedMesh.castShadow = mergedMesh.receiveShadow = !isMobile || merged.attributes.position.count < 20000;
            mergedMesh.layers.enable(1); mergedMesh.userData.isMerged = true;
            mergedMesh.name = `merged_${group.material.name || group.material.uuid.slice(0,6)}`;
            merged.computeBoundingBox(); merged.computeBoundingSphere(); model.add(mergedMesh);
            toRemove.forEach(mesh => { mesh.parent?.remove(mesh); mesh.geometry.dispose(); });
            geos.forEach(g => g.dispose()); savedDrawCalls += toRemove.length - 1;
        } catch { geos.forEach(g => g.dispose()); }
        await yieldFrame();
    }
}

function cullSmallShadows(model, threshold = 0.05) {
    // No mobile, corta shadows em objetos menores (economia de shadow map)
    const thr = isMobile ? 0.15 : threshold;
    let culled = 0;
    model.traverse(child => {
        if (!child.isMesh || !child.castShadow) return;
        child.geometry.computeBoundingSphere(); const r = child.geometry.boundingSphere?.radius ?? Infinity;
        if (r < thr) { child.castShadow = false; culled++; }
    });
}

// Redução inteligente para mobile: remove shadow apenas das meshes menores,
// preservando sombras nas maiores (que são visualmente mais importantes).
function autoReduceForMobile(model) {
    if (!isMobile) return;
    let totalVerts = 0;
    const meshes = [];
    model.traverse(child => {
        if (!child.isMesh || !child.geometry?.attributes?.position) return;
        const verts = child.geometry.attributes.position.count;
        totalVerts += verts;
        meshes.push({ mesh: child, verts });
    });

    if (totalVerts <= 50_000) return; // modelo leve — sem restrição

    // Ordena por tamanho e mantém shadow só nas top 20% maiores meshes
    meshes.sort((a, b) => b.verts - a.verts);
    const keepShadow = Math.max(1, Math.ceil(meshes.length * 0.2));
    meshes.forEach(({ mesh }, i) => {
        if (i >= keepShadow) {
            mesh.castShadow    = false;
            mesh.receiveShadow = false;
        }
    });
}
function rebuildBoundingVolumes(model) {
    let rebuilt = 0;
    model.traverse(child => { if (!child.isMesh || !child.geometry) return; child.geometry.computeBoundingBox(); child.geometry.computeBoundingSphere(); rebuilt++; });
}
function deduplicateMaterials(model) {
    const canonical = new Map(); let deduped = 0;
    model.traverse(child => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        const newMats = mats.map(mat => {
            if (!mat) return mat;
            // Chave agora inclui todos os mapas de textura relevantes
            const key = [
                mat.type,
                mat.color?.getHexString()           ?? '',
                mat.roughness?.toFixed(3)            ?? '',
                mat.metalness?.toFixed(3)            ?? '',
                mat.map?.uuid                        ?? '',
                mat.normalMap?.uuid                  ?? '',
                mat.roughnessMap?.uuid               ?? '',
                mat.metalnessMap?.uuid               ?? '',
                mat.aoMap?.uuid                      ?? '',
                mat.emissiveMap?.uuid                ?? '',
                mat.alphaMap?.uuid                   ?? '',
                mat.emissive?.getHexString()         ?? '',
                mat.emissiveIntensity?.toFixed(3)    ?? '',
                mat.transparent ? mat.opacity?.toFixed(3) : '1',
                mat.side,
            ].join('|');
            if (canonical.has(key)) { deduped++; return canonical.get(key); }
            canonical.set(key, mat); return mat;
        });
        child.material = Array.isArray(child.material) ? newMats : newMats[0];
    });
}

// ==================== SISTEMA DE LOD AUTOMÁTICO ====================
// Gera versões simplificadas das geometrias pesadas por decimação de índices.
// Sem dependências externas — funciona com qualquer mesh importada (GLTF, OBJ, ZIP).
// Técnica usada em Blender (Decimate Modifier) e C4D (LOD Object) adaptada pro Three.js.

const _lodObjects = []; // THREE.LOD registrados — atualizados no loop de animação

// Decimação simples por stride de triângulos: mantém 1 em cada N triângulos.
// Rápido e sem artefatos visíveis a distância — preserva silhueta do objeto.
function _decimateGeometry(geo, keepRatio) {
    if (!geo) return null;
    try {
        // Garante geometria não-indexada para poder fatiar livremente
        const src = geo.index ? geo.toNonIndexed() : geo;
        const pos  = src.attributes.position;
        const totalTris = Math.floor(pos.count / 3);
        const keepEvery = Math.max(1, Math.round(1 / keepRatio));

        // Coleta os índices dos triângulos que vão sobrar
        const kept = [];
        for (let i = 0; i < totalTris; i++) {
            if (i % keepEvery !== 0) continue;
            const b = i * 3;
            kept.push(b, b + 1, b + 2);
        }
        if (kept.length === 0) return null;

        // Extrai apenas os atributos necessários dos verts mantidos
        const attrs = ['position', 'normal', 'uv', 'uv2', 'color'];
        const newGeo = new THREE.BufferGeometry();
        for (const name of attrs) {
            const attr = src.attributes[name];
            if (!attr) continue;
            const itemSize = attr.itemSize;
            const newArr   = new Float32Array(kept.length * itemSize);
            for (let j = 0; j < kept.length; j++) {
                const srcIdx = kept[j];
                for (let k = 0; k < itemSize; k++) {
                    newArr[j * itemSize + k] = attr.array[srcIdx * itemSize + k];
                }
            }
            newGeo.setAttribute(name, new THREE.Float32BufferAttribute(newArr, itemSize));
        }
        newGeo.computeVertexNormals();
        newGeo.computeBoundingBox();
        newGeo.computeBoundingSphere();
        return newGeo;
    } catch (e) {
        console.warn('[LOD] Decimação falhou:', e.message);
        return null;
    }
}

// Constrói um THREE.LOD com 3 níveis de detalhe para uma mesh pesada.
// Retorna null se a mesh for leve o suficiente (sem LOD necessário).
function _buildLODForMesh(mesh) {
    if (!mesh.geometry?.attributes?.position) return null;
    const vertCount = mesh.geometry.attributes.position.count;

    // Thresholds calibrados: mobile mais agressivo, desktop mais conservador
    const THRESH = isMobile ? 1500 : 4000;
    if (vertCount < THRESH) return null;

    const lod = new THREE.LOD();
    lod.name         = (mesh.name || 'mesh') + '_lod';
    lod.position.copy(mesh.position);
    lod.rotation.copy(mesh.rotation);
    lod.scale.copy(mesh.scale);
    lod.userData     = { ...mesh.userData, isLOD: true };
    lod.layers.mask  = mesh.layers.mask;

    // — Nível 0: geometria original, perto da câmera —
    const meshL0 = mesh.clone(false); // clone sem filhos
    meshL0.geometry = mesh.geometry;  // referência, não cópia
    meshL0.position.set(0, 0, 0);
    meshL0.rotation.set(0, 0, 0);
    meshL0.scale.set(1, 1, 1);
    lod.addLevel(meshL0, 0);

    // — Nível 1: ~35% dos triângulos, distância média —
    const geoL1 = _decimateGeometry(mesh.geometry, 0.35);
    if (geoL1) {
        const meshL1 = new THREE.Mesh(geoL1, mesh.material);
        meshL1.castShadow    = false; // sombra só no nível mais próximo
        meshL1.receiveShadow = mesh.receiveShadow;
        meshL1.layers.mask   = mesh.layers.mask;
        lod.addLevel(meshL1, isMobile ? 12 : 25);
    }

    // — Nível 2: ~12% dos triângulos, longe —
    const geoL2 = _decimateGeometry(mesh.geometry, 0.12);
    if (geoL2) {
        const meshL2 = new THREE.Mesh(geoL2, mesh.material);
        meshL2.castShadow    = false;
        meshL2.receiveShadow = false;
        meshL2.layers.mask   = mesh.layers.mask;
        lod.addLevel(meshL2, isMobile ? 40 : 90);
    }

    // — Nível 3: objeto invisível — frustramente culled a grande distância —
    const phantom = new THREE.Object3D();
    phantom.visible = false;
    lod.addLevel(phantom, isMobile ? 100 : 250);

    return lod;
}

// Percorre o modelo e substitui meshes pesadas por objetos LOD.
// Preserva hierarquia — a mesh sumiu mas o LOD ocupa o mesmo lugar no grafo.
async function applyLODToModel(model) {
    // SkinnedMesh + LOD: incompatível sem reparar o skeleton — skip seguro
    let hasAnySkinned = false;
    model.traverse(c => { if (c.isSkinnedMesh) hasAnySkinned = true; });
    if (hasAnySkinned) {
        return;
    }

    const toReplace = [];
    model.traverse(child => {
        if (!child.isMesh || child.userData?.isLOD || child.userData?.isMerged) return;
        const lod = _buildLODForMesh(child);
        if (lod) toReplace.push({ mesh: child, lod, parent: child.parent });
    });

    for (const { mesh, lod, parent } of toReplace) {
        if (!parent) continue;
        parent.add(lod);
        parent.remove(mesh);
        _lodObjects.push(lod);
        if (toReplace.indexOf({ mesh, lod, parent }) % 5 === 0) await yieldFrame();
    }

    if (toReplace.length > 0)
        markDirty(3);
}

// Chamado todo frame no loop de animação — custo mínimo (só distância)
function updateAllLOD() {
    for (let i = 0; i < _lodObjects.length; i++) {
        _lodObjects[i].update(camera);
    }
}

// Remove LOD registrados pertencentes a um modelo específico (ao deletar da cena)
function removeLODForModel(model) {
    const modelLODs = new Set();
    model.traverse(c => { if (c.isLOD || c.userData?.isLOD) modelLODs.add(c); });
    for (let i = _lodObjects.length - 1; i >= 0; i--) {
        if (modelLODs.has(_lodObjects[i])) _lodObjects.splice(i, 1);
    }
}

// ==================== MEMORY MANAGEMENT ====================
// Força o GC de recursos GPU não usados após operações pesadas.
// Evita acúmulo de memória VRAM com modelos grandes.
function disposeObject(obj) {
    if (!obj) return;
    obj.traverse(child => {
        if (child.geometry) { child.geometry.dispose(); }
        if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
                if (!mat) return;
                // Dispõe todas as texturas do material
                ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap',
                 'alphaMap','envMap','lightMap','bumpMap','displacementMap'].forEach(key => {
                    if (mat[key]) { mat[key].dispose(); mat[key] = null; }
                });
                mat.dispose();
            });
        }
    });
}

// Remove um objeto da cena e libera todos os recursos GPU associados.
function removeObjectClean(obj) {
    if (!obj) return;
    scene.remove(obj);
    const idx = sceneObjects.indexOf(obj);
    if (idx > -1) sceneObjects.splice(idx, 1);
    const pi = particleSystems.indexOf(obj);
    if (pi > -1) particleSystems.splice(pi, 1);
    disposeObject(obj);
    invalidateBloomCache(); requestShadowUpdate(); saveState(); updateObjectsList();
}
window._nexusRemoveObjectClean = removeObjectClean;

// ── Expostas para model-handler.js ───────────────────────────────────────────
window._nexusSaveState          = ()    => saveState();
window._nexusUpdateObjects      = ()    => updateObjectsList();
window._nexusGenerateName       = (t)   => generateName(t);
window._nexusShowOverlay        = (msg) => showImportOverlay(msg);
window._nexusSetProgress        = (p,m) => setImportProgress(p, m);
window._nexusRemoveOverlay      = ()    => removeImportOverlay();
window._nexusBuildBoneHelpers   = (m)   => buildBoneHelpers(m);
window._nexusSnapshotPostQuality= ()    => _snapshotPostQuality();
// Array de LOD objects para que o model-handler registre LODs no loop de animação
window._nexusLODObjects         = _lodObjects;
if (importModelBtn) importModelBtn.addEventListener('click', e => { e.stopPropagation(); modelFileInput?.click(); });
if (modelFileInput) {
    modelFileInput.addEventListener('change', async e => {
        const file = e.target.files[0]; if (!file) return;
        showImportOverlay('Detectando formato…');
        try {
            await importModelAuto(file);
        } catch (err) { console.error('Importação:', err); removeImportOverlay(); alert('Erro ao importar:\n' + (err.message || err)); }
        modelFileInput.value = '';
    });
}

// ── Importação com fallback em cascata ──────────────────────────────────────
// Não confia cegamente na extensão/magic bytes: tenta cada loader e cai pro próximo
async function importModelAuto(file) {
    const ext = file.name.toLowerCase().split('.').pop();

    // Extensão explícita → vai direto sem cascata
    if (ext === 'glb' || ext === 'gltf') return loadGltfModel(file);
    if (ext === 'obj')                   return loadObjModel(file);

    // Sem extensão confiável → detecta e usa cascata em caso de erro
    const head  = await file.slice(0, 4).arrayBuffer();
    const bytes = new Uint8Array(head);
    const isGlb = bytes[0]===0x67 && bytes[1]===0x6C && bytes[2]===0x54 && bytes[3]===0x46;
    const isZip = bytes[0]===0x50 && bytes[1]===0x4B && bytes[2]===0x03 && bytes[3]===0x04;

    if (isGlb) return loadGltfModel(file);

    if (isZip) {
        // Tenta ZIP — se falhar (arquivo corrompido ou falso-positivo) tenta GLTF
        try { return await loadModelFromZip(file); }
        catch (zipErr) {
            console.warn('[importModelAuto] ZIP falhou, tentando como GLTF/GLB…', zipErr.message);
            return loadGltfModel(file);
        }
    }

    // Verifica se parece JSON GLTF lendo mais bytes
    const text = new TextDecoder('utf-8', { fatal: false }).decode(await file.slice(0, 512).arrayBuffer());
    const trimmed = text.trimStart();
    if (trimmed.startsWith('{') && (text.includes('"asset"') || text.includes('"meshes"') || text.includes('"scene"'))) {
        return loadGltfModel(file);
    }
    if (/^(v |vn |vt |f |o |g |mtllib|usemtl)/m.test(text)) return loadObjModel(file);

    // Último recurso: tenta GLTF, se falhar tenta OBJ
    try { return await loadGltfModel(file); }
    catch { return loadObjModel(file); }
}

// ── Cria GLTFLoader com DRACOLoader já injetado ─────────────────────────
// Obrigatório para modelos exportados do Blender/Maya/3ds Max com compressão Draco
function makeGLTFLoader(manager) {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.preload();
    const loader = manager ? new GLTFLoader(manager) : new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    return loader;
}

// ── Encaixa a câmera no objeto importado ─────────────────────────────────
function fitCameraToModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;
    const center = new THREE.Vector3();
    const size   = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const fovRad = THREE.MathUtils.degToRad(camera.fov);
    const dist   = Math.abs(maxDim / (2 * Math.tan(fovRad / 2))) * 1.8;
    const dir    = new THREE.Vector3(1, 0.7, 1).normalize();
    camera.position.copy(center.clone().addScaledVector(dir, dist));
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
    markDirty(4);
}

async function loadGltfModel(file) {
    const url = URL.createObjectURL(file);
    return new Promise((ok, fail) => {
        makeGLTFLoader().load(url,
            async gltf => {
                try { await finalizeModelImport(gltf.scene, file.name, file.size); ok(gltf.scene); }
                catch (e) { fail(e); } finally { URL.revokeObjectURL(url); }
            },
            xhr => { if (xhr.total) setImportProgress(Math.round(xhr.loaded / xhr.total * 60), 'Carregando…'); },
            e => { URL.revokeObjectURL(url); fail(e); }
        );
    });
}
async function loadObjModel(file) {
    const url = URL.createObjectURL(file);
    return new Promise((ok, err) => {
        new OBJLoader().load(url, async obj => {
            try { await finalizeModelImport(obj, file.name, file.size); ok(obj); }
            catch (e) { err(e); } finally { URL.revokeObjectURL(url); }
        }, xhr => { if (xhr.total) setImportProgress(Math.round(xhr.loaded/xhr.total*60), 'Carregando…'); },
        e => { URL.revokeObjectURL(url); err(e); });
    });
}
async function loadModelFromZip(zipFile) {
    setImportProgress(10, 'Descompactando…');
    const zip = new JSZip(), loaded = await zip.loadAsync(await zipFile.arrayBuffer());
    const names = Object.keys(loaded.files).filter(n => !loaded.files[n].dir);
    const gltfE = names.find(f => f.endsWith('.gltf') || f.endsWith('.glb'));
    const objE  = names.find(f => f.endsWith('.obj'));
    if (gltfE) await loadGltfFromZip(loaded, gltfE, names);
    else if (objE) await loadObjFromZip(loaded, objE, names);
    else { removeImportOverlay(); alert('Nenhum .gltf/.glb/.obj no ZIP.'); }
}
async function loadGltfFromZip(zip, fn, allNames) {
    setImportProgress(20, 'Preparando assets…');
    const bm = {};
    for (const p of allNames) { const u = URL.createObjectURL(await zip.file(p).async('blob')); bm[p] = u; const s = p.split('/').pop(); if (!bm[s]) bm[s] = u; }
    const mgr = new THREE.LoadingManager(); mgr.setURLModifier(url => { if (!url) return url; const s = url.split('/').pop().split('?')[0]; return bm[url] || bm[s] || url; });
    const main = bm[fn] || bm[fn.split('/').pop()];
    return new Promise((ok, err) => {
        makeGLTFLoader(mgr).load(main, async gltf => {
            try { await finalizeModelImport(gltf.scene, fn); ok(gltf.scene); }
            catch (e) { err(e); } finally { Object.values(bm).forEach(u => URL.revokeObjectURL(u)); }
        }, xhr => { if (xhr.total) setImportProgress(20+Math.round(xhr.loaded/xhr.total*40), 'Carregando…'); },
        e => { Object.values(bm).forEach(u => URL.revokeObjectURL(u)); err(e); });
    });
}
async function loadObjFromZip(zip, fn, allNames) {
    setImportProgress(20, 'Preparando assets…');
    const bm = {};
    for (const p of allNames) { const u = URL.createObjectURL(await zip.file(p).async('blob')); bm[p] = u; const s = p.split('/').pop(); if (!bm[s]) bm[s] = u; }
    const mgr = new THREE.LoadingManager(); mgr.setURLModifier(url => { if (!url) return url; const s = url.split('/').pop().split('?')[0]; return bm[url] || bm[s] || url; });
    const objUrl = bm[fn] || bm[fn.split('/').pop()], ol = new OBJLoader(mgr);
    const base = fn.replace(/\.obj$/i,'').split('/').pop();
    const mtlE = allNames.find(f => f.endsWith('.mtl') && f.split('/').pop().replace('.mtl','') === base);
    if (mtlE) { const mt = await zip.file(mtlE).async('string'); const mats = new MTLLoader(mgr).parse(mt,''); mats.preload(); ol.setMaterials(mats); }
    return new Promise((ok, err) => {
        ol.load(objUrl, async obj => {
            try { await finalizeModelImport(obj, fn); ok(obj); }
            catch (e) { err(e); } finally { Object.values(bm).forEach(u => URL.revokeObjectURL(u)); }
        }, xhr => { if (xhr.total) setImportProgress(20+Math.round(xhr.loaded/xhr.total*40), 'Carregando…'); },
        e => { Object.values(bm).forEach(u => URL.revokeObjectURL(u)); err(e); });
    });
}

// ==================== DIALOG: MESCLAR GEOMETRIA ====================
function showMergeGeometryDialog() {
    return new Promise(resolve => {
        const ov = document.createElement('div');
        ov.id = '_merge_ov';
        ov.innerHTML = `
            <div id="_merge_modal">
                <div class="_merge_icon">🔗</div>
                <h4>Mesclar Geometrias?</h4>
                <p class="_merge_desc">
                    Unificar malhas com mesmo material em uma única geometria.<br>
                    <span class="_merge_pro">✦ Reduz draw calls e melhora performance</span><br>
                    <span class="_merge_con">✦ Remove hierarquia individual das malhas</span>
                </p>
                <div class="_merge_btns">
                    <button id="_merge_no" class="_merge_btn _merge_btn_no">✕ Não</button>
                    <button id="_merge_yes" class="_merge_btn _merge_btn_yes">✓ Sim</button>
                </div>
            </div>`;
        document.body.appendChild(ov);
        document.getElementById('_merge_yes').addEventListener('click', () => { ov.remove(); resolve(true); });
        document.getElementById('_merge_no').addEventListener('click',  () => { ov.remove(); resolve(false); });
    });
}

async function finalizeModelImport(model, originalFileName, fileSizeBytes = 0) {
    setImportProgress(60, 'Processando malhas…');
    model.position.set(0, 0, 0);
    await traverseAsync(model, child => {
        if (child.isMesh) { child.castShadow = child.receiveShadow = true; child.layers.enable(1); if (child.isSkinnedMesh) child.frustumCulled = false; }
    });
    setImportProgress(62, 'Melhorando materiais…'); await yieldFrame();
    await traverseAsync(model, child => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        const newMats = mats.map(mat => {
            if (!mat) return mat;
            let std = mat;
            if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) {
                std = new THREE.MeshStandardMaterial({
                    color:       mat.color       || new THREE.Color(0xcccccc),
                    map:         mat.map         || null,
                    transparent: mat.transparent || false,
                    opacity:     mat.opacity     ?? 1,
                    side:        mat.side        ?? THREE.FrontSide,
                    alphaMap:    mat.alphaMap    || null,
                });
                if (mat.dispose) mat.dispose();
            }
            if (!std.roughnessMap) std.roughness = 0.78;
            if (!std.metalnessMap && (std.metalness === undefined || std.metalness === 0)) std.metalness = 0.1;
            std.needsUpdate = true;
            return std;
        });
        child.material = Array.isArray(child.material) ? newMats : newMats[0];
    });
    setImportProgress(64, 'Unificando materiais…'); await yieldFrame();
    deduplicateMaterials(model);
    setImportProgress(67, 'Verificando armadura…'); await yieldFrame();
    let hasBones = false;
    await traverseAsync(model, child => {
        if (child.isBone) hasBones = true;
        if (child.isSkinnedMesh && child.skeleton?.bones.length > 0) hasBones = true;
    });
    setImportProgress(72, 'Adicionando à cena…'); await yieldFrame();
    model.name = generateName('Modelo_' + originalFileName.replace(/\.(zip|gltf|glb|obj)$/i, ''));
    model.userData.isImportedModel    = true;
    model.userData.originalFileName   = originalFileName;
    scene.add(model); sceneObjects.push(model);
    setImportProgress(76, 'Aguardando decisão…');
    const shouldMerge = await showMergeGeometryDialog();
    if (shouldMerge) {
        setImportProgress(78, 'Mesclando geometrias…');
        await optimizeModel(model);
    }
    setImportProgress(84, 'Otimizando shadows…'); await yieldFrame();
    cullSmallShadows(model);
    autoReduceForMobile(model);
    setImportProgress(86, 'Bounding volumes…'); await yieldFrame();
    rebuildBoundingVolumes(model);
    setImportProgress(88, 'Aplicando LOD…'); await yieldFrame();
    await applyLODToModel(model);
    setImportProgress(91, 'Pré-aquecendo GPU…');
    _snapshotPostQuality();
    await prewarmModel(model);
    if (hasBones) {
        setImportProgress(95, 'Construindo rig…');
        await yieldFrame(); await yieldFrame(); await yieldFrame();
        model.updateWorldMatrix(true, true); buildBoneHelpers(model);
    }
    invalidateBloomCache(); requestShadowUpdate();
    setImportProgress(100, 'Concluído! ✅'); await yieldFrame();
    removeImportOverlay(); saveState(); updateObjectsList();
    fitCameraToModel(model);
}

// ==================== OUTLINE ====================
function updateOutline(obj, enable, colorHex = '#ffffff') {
    if (!obj || !obj.isMesh) return;
    if (obj.userData.outlineLines) { obj.remove(obj.userData.outlineLines); obj.userData.outlineLines = null; }
    if (enable) {
        const line = new THREE.LineSegments(new THREE.EdgesGeometry(obj.geometry), new THREE.LineBasicMaterial({ color: colorHex, linewidth: 3 }));
        obj.userData.outlineLines = line; obj.userData.outlineColor = colorHex; obj.add(line);
    }
}

// ==================== ÍCONES DE LUZ ====================
function createLightIcon(color, type) {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.clearRect(0,0,64,64); ctx.shadowColor='rgba(255,255,255,0.8)'; ctx.shadowBlur=10;
    if (type==='point'||type==='sun'||type==='moon') {
        ctx.fillStyle=color; ctx.beginPath(); ctx.arc(32,32,20,0,2*Math.PI); ctx.fill();
        ctx.strokeStyle='white'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(32,32,20,0,2*Math.PI); ctx.stroke();
        ctx.strokeStyle='white'; ctx.lineWidth=2;
        for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2,dx=Math.cos(a)*25,dy=Math.sin(a)*25;ctx.beginPath();ctx.moveTo(32+dx*.6,32+dy*.6);ctx.lineTo(32+dx,32+dy);ctx.stroke();}
    } else if (type==='directional') {
        ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(32,8); ctx.lineTo(48,24); ctx.lineTo(40,24); ctx.lineTo(40,48); ctx.lineTo(24,48); ctx.lineTo(24,24); ctx.lineTo(16,24); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='white'; ctx.lineWidth=3; ctx.stroke(); ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(32,16,8,0,2*Math.PI); ctx.fill();
    } else if (type==='ambient') {
        ctx.fillStyle=color; ctx.beginPath(); ctx.arc(32,32,22,0,2*Math.PI); ctx.fill();
        ctx.strokeStyle='white'; ctx.lineWidth=3; [22,14,6].forEach(r=>{ctx.beginPath();ctx.arc(32,32,r,0,2*Math.PI);ctx.stroke();});
        ctx.fillStyle='white';
        for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2,x=32+Math.cos(a)*12,y=32+Math.sin(a)*12;ctx.beginPath();ctx.arc(x,y,3,0,2*Math.PI);ctx.fill();}
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(canvas), depthTest:false, depthWrite:false, transparent:true, blending:THREE.NormalBlending }));
    sprite.scale.set(1.2,1.2,1); return sprite;
}

// ==================== CÂMERA 3D (VISUAL) ====================
function createCameraVisualMesh() {
    const root = new THREE.Group();
    root.userData.isCamInternal = true;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.6 });
    const rimMat  = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.15, metalness: 0.95 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x44aaff, roughness: 0.0, transparent: true, opacity: 0.85 });

    // ── CORPO RETANGULAR (parte de trás) ────────────────────────
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.7), bodyMat);
    body.position.set(0, 0, 0.25);
    root.add(body);

    // Placa de topo
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.7), rimMat);
    topBar.position.set(0, 0.425, 0.25);
    root.add(topBar);

    // Placa da base
    const botBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.7), rimMat);
    botBar.position.set(0, -0.425, 0.25);
    root.add(botBar);

    // ── PIRÂMIDE TRIANGULAR (frente) ─────────────────────────────
    const hw = 0.60, hh = 0.40;
    const z0 = -0.10;
    const z1 = -0.90;

    const verts = new Float32Array([
        -hw, -hh, z0,
         hw, -hh, z0,
         hw,  hh, z0,
        -hw,  hh, z0,
         0,   0,  z1,
    ]);

    const idx = new Uint16Array([
        0, 2, 1,  0, 3, 2,
        0, 1, 4,
        1, 2, 4,
        2, 3, 4,
        3, 0, 4,
    ]);

    const pyGeo = new THREE.BufferGeometry();
    pyGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    pyGeo.setIndex(new THREE.BufferAttribute(idx, 1));
    pyGeo.computeVertexNormals();

    const pyramid = new THREE.Mesh(pyGeo, new THREE.MeshStandardMaterial({
        color: 0x222222, roughness: 0.4, metalness: 0.7, side: THREE.DoubleSide,
    }));
    root.add(pyramid);

    // Aro metálico
    const mountRim = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.82, 0.04), rimMat);
    mountRim.position.set(0, 0, -0.09);
    root.add(mountRim);

    // ── LENTE ───────────────────────────────────────────────────
    const lensCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.13, 0.18, 32),
        new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.05, metalness: 1.0 })
    );
    lensCyl.rotation.x = Math.PI / 2;
    lensCyl.position.set(0, 0, -0.98);
    root.add(lensCyl);

    const lensRim = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.014, 8, 28), rimMat);
    lensRim.rotation.x = Math.PI / 2;
    lensRim.position.set(0, 0, -1.065);
    root.add(lensRim);

    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.093, 32), glassMat);
    glass.position.set(0, 0, -1.072);
    root.add(glass);

    const rfMat = new THREE.MeshBasicMaterial({ color: 0xaaeeff, transparent: true, opacity: 0.5 });
    const reflex = new THREE.Mesh(new THREE.CircleGeometry(0.030, 16), rfMat);
    reflex.position.set(-0.025, 0.025, -1.074);
    root.add(reflex);

    // ── VIEWFINDER ─────────────────────────────────────────────
    const vf = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.36),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.5 }));
    vf.position.set(0, 0.58, 0.20);
    root.add(vf);

    // ── SHUTTER ─────────────────────────────────────────────────
    const shutMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.2, metalness: 0.9 });
    const shutter = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 16), shutMat);
    shutter.position.set(-0.38, 0.46, 0.18);
    root.add(shutter);

    // ── LED VERMELHO ─────────────────────────────────────────────
    const recMat = new THREE.MeshStandardMaterial({
        color: 0xff1111, emissive: 0xcc0000, emissiveIntensity: 1.2, roughness: 0.3,
    });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.040, 12, 12), recMat);
    led.position.set(0.55, 0.28, -0.08);
    root.add(led);

    root.scale.setScalar(0.38);
    return root;
}


function buildFrustumLines(fov, aspect, near, farVis, color = 0xffff00) {
    const tanH = Math.tan((fov / 2) * Math.PI / 180);
    const nH = near * tanH, nW = nH * aspect;
    const fH = farVis * tanH, fW = fH * aspect;
    const verts = new Float32Array([
        -nW,-nH,-near,  nW,-nH,-near,  nW,-nH,-near,  nW, nH,-near,
         nW, nH,-near, -nW, nH,-near, -nW, nH,-near, -nW,-nH,-near,
        -fW,-fH,-farVis, fW,-fH,-farVis, fW,-fH,-farVis, fW, fH,-farVis,
         fW, fH,-farVis,-fW, fH,-farVis,-fW, fH,-farVis,-fW,-fH,-farVis,
        -nW,-nH,-near, -fW,-fH,-farVis, nW,-nH,-near,  fW,-fH,-farVis,
         nW, nH,-near,  fW, fH,-farVis,-nW, nH,-near, -fW, fH,-farVis,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const mat = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.65 });
    const lines = new THREE.LineSegments(geo, mat);
    lines.userData.isFrustumLines = true;
    lines.userData.isCamInternal  = true;
    lines.renderOrder = 5;
    return lines;
}

function rebuildCameraFrustum(camObj) {
    if (!camObj || !isCamera(camObj)) return;
    const old = camObj.children.find(c => c.userData.isFrustumLines);
    if (old) { camObj.remove(old); old.geometry.dispose(); old.material.dispose(); }
    if (camObj.userData.showFrustum === false) { invalidateBloomCache(); markDirty(2); return; }
    const fov    = camObj.userData.camFov    || 60;
    const aspect = parseFloat(camObj.userData.camAspect) || 16/9;
    const near   = camObj.userData.camNear   || 0.1;
    const farVis = Math.min(camObj.userData.camFar || 1000, 15);
    const color  = new THREE.Color(camObj.userData.frustumColor || '#ffff00');
    const frustum = buildFrustumLines(fov, aspect, near, farVis, color);
    if (povActive && povCamera === camObj) frustum.visible = false;
    camObj.add(frustum);
    invalidateBloomCache(); markDirty(2);
}

window._nexusRebuildCameraFrustum = (obj) => { if (isCamera(obj)) rebuildCameraFrustum(obj); };

function addCamera() {
    const group = new THREE.Group();
    group.name = generateName('Câmera');
    group.userData.isCamera      = true;
    group.userData.camFov        = 60;
    group.userData.camNear       = 0.1;
    group.userData.camFar        = 1000;
    group.userData.camAspect     = 16 / 9;
    group.userData.showFrustum   = true;
    group.userData.frustumColor  = '#ffff00';

    const visual = createCameraVisualMesh();
    group.add(visual);

    const frustum = buildFrustumLines(60, 16/9, 0.1, 10, 0xffff00);
    group.add(frustum);

    group.position.set(0, 2, 6);

    // FIX: câmera de cabeça pra baixo
    // lookAt(0,0,0) faz +Z apontar para a origem.
    // rotateY(PI) inverte: agora -Z aponta para a origem,
    // que é a direção correta para POV (Three.js cameras olham em -Z).
    // O eixo Y não é afetado por rotateY, então o topo (viewfinder) continua em +Y.
    group.lookAt(0, 0, 0);
    group.rotateY(Math.PI);

    group.layers.enable(1);
    scene.add(group); sceneObjects.push(group);
    invalidateBloomCache(); requestShadowUpdate(); saveState(); updateObjectsList();
    setActiveObject(group);
}

// ==================== SISTEMA POV ====================
let povActive = false;
let povCamera = null;
let povYaw    = 0;
let povPitch  = 0;
const povKeys = {};
const _povDir  = new THREE.Vector3();
const _povLocalPos = new THREE.Vector3();
const _povEuler    = new THREE.Euler(0, 0, 0, 'YXZ');
const _povQuat     = new THREE.Quaternion();
const _povParentInvQ = new THREE.Quaternion();

let _povMouseDown = false;

function _setCamVisibility(camObj, visible) {
    if (!camObj) return;
    camObj.children.forEach(c => {
        if (c.userData.isCamInternal || c.userData.isFrustumLines) c.visible = visible;
    });
}

function _syncPovGroupFromCamera() {
    if (!povCamera) return;
    if (povCamera.parent) {
        povCamera.parent.worldToLocal(_povLocalPos.copy(camera.position));
    } else {
        _povLocalPos.copy(camera.position);
    }
    povCamera.position.copy(_povLocalPos);

    _povEuler.set(povPitch, povYaw, 0, 'YXZ');
    _povQuat.setFromEuler(_povEuler);
    if (povCamera.parent) {
        povCamera.parent.getWorldQuaternion(_povParentInvQ).invert();
        _povQuat.premultiply(_povParentInvQ);
    }
    povCamera.quaternion.copy(_povQuat);
    povCamera.updateMatrix();
}

function enterPOV(camObj) {
    if (povActive || !camObj || !isCamera(camObj)) return;
    povCamera = camObj;
    povActive = true;

    _setCamVisibility(camObj, false);

    const worldPos  = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    camObj.getWorldPosition(worldPos);
    camObj.getWorldQuaternion(worldQuat);

    camera.position.copy(worldPos);
    camera.quaternion.copy(worldQuat);

    const euler = new THREE.Euler().setFromQuaternion(worldQuat, 'YXZ');
    povYaw   = euler.y;
    povPitch = euler.x;

    camera.fov  = camObj.userData.camFov  || 60;
    camera.near = camObj.userData.camNear || 0.1;
    camera.far  = camObj.userData.camFar  || 1000;
    camera.updateProjectionMatrix();

    controls.enabled = false;
    transformControls.detach();

    try { renderer.domElement.requestPointerLock(); } catch {}

    const overlay = document.getElementById('pov-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        const nameEl = document.getElementById('pov-cam-name');
        if (nameEl) nameEl.textContent = camObj.name || 'Câmera';
    }

    _setCameraHudState(true);
    markDirty(4);
}

function exitPOV() {
    if (!povActive) return;

    if (povCamera) {
        _setCamVisibility(povCamera, true);
        _syncPovGroupFromCamera();
        povCamera.updateMatrixWorld();
        rebuildCameraFrustum(povCamera);
    }
    povCamera = null;
    povActive = false;

    camera.fov  = 45;
    camera.near = 0.1;
    camera.far  = 1000;
    camera.updateProjectionMatrix();

    controls.enabled = true;
    _povMouseDown = false;

    if (document.pointerLockElement) document.exitPointerLock();

    const overlay = document.getElementById('pov-overlay');
    if (overlay) overlay.classList.add('hidden');

    _setCameraHudState(false);
    markDirty(4);
}

function _setCameraHudState(inPov) {
    const enterBtn = document.getElementById('camera-enter-pov');
    const exitBtn  = document.getElementById('camera-exit-pov');
    if (enterBtn) enterBtn.disabled =  inPov;
    if (exitBtn)  exitBtn.disabled  = !inPov;
}

function updatePOV(delta) {
    camera.rotation.order = 'YXZ';
    camera.rotation.y = povYaw;
    camera.rotation.x = povPitch;

    const speed = parseFloat(document.getElementById('cam-pov-speed')?.value || '5') * delta;
    _povDir.set(0, 0, 0);
    if (povKeys['KeyW'] || povKeys['ArrowUp'])              _povDir.z -= 1;
    if (povKeys['KeyS'] || povKeys['ArrowDown'])            _povDir.z += 1;
    if (povKeys['KeyA'] || povKeys['ArrowLeft'])            _povDir.x -= 1;
    if (povKeys['KeyD'] || povKeys['ArrowRight'])           _povDir.x += 1;
    if (povKeys['Space'])                                    _povDir.y += 1;
    if (povKeys['ShiftLeft'] || povKeys['ShiftRight'])      _povDir.y -= 1;

    if (_povDir.lengthSq() > 0) {
        _povDir.normalize().applyQuaternion(camera.quaternion);
        camera.position.addScaledVector(_povDir, speed);
        markDirty(1);
    }

    _syncPovGroupFromCamera();
}

renderer.domElement.addEventListener('mousedown', e => {
    if (povActive && e.button === 0) { _povMouseDown = true; e.preventDefault(); }
});
document.addEventListener('mouseup', () => { _povMouseDown = false; });

document.addEventListener('mousemove', e => {
    if (!povActive) return;
    const hasLock = !!document.pointerLockElement;
    if (!hasLock && !_povMouseDown) return;

    const sens = parseFloat(document.getElementById('cam-pov-sens')?.value || '1')
               * (hasLock ? 0.0018 : 0.003);
    povYaw   -= e.movementX * sens;
    povPitch -= e.movementY * sens;
    povPitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, povPitch));
    markDirty(1);
});

document.addEventListener('pointerlockchange', () => {
    markDirty(1);
});

// ==================== CÂMERA HUD — BOTÕES ====================
const cameraHud          = document.getElementById('camera-hud');
const cameraEnterPovBtn  = document.getElementById('camera-enter-pov');
const cameraExitPovBtn   = document.getElementById('camera-exit-pov');
const cameraSettingsBtn2 = document.getElementById('camera-settings-btn');
const cameraSettingsPanel= document.getElementById('camera-settings-panel');
const cameraSettingsClose= document.getElementById('camera-settings-close');

if (cameraEnterPovBtn)  cameraEnterPovBtn.addEventListener('click',  e => { e.stopPropagation(); enterPOV(activeObject); });
if (cameraExitPovBtn)   cameraExitPovBtn.addEventListener('click',   e => { e.stopPropagation(); exitPOV(); });
if (cameraSettingsBtn2) cameraSettingsBtn2.addEventListener('click', e => { e.stopPropagation(); cameraSettingsPanel?.classList.toggle('hidden'); });
if (cameraSettingsClose) cameraSettingsClose.addEventListener('click', e => { e.stopPropagation(); cameraSettingsPanel?.classList.add('hidden'); });

function showCameraHud(show) {
    if (!cameraHud) return;
    if (show) { cameraHud.classList.remove('hidden'); cameraHud.style.display = 'flex'; }
    else { cameraHud.style.display = 'none'; if (cameraSettingsPanel) cameraSettingsPanel.classList.add('hidden'); }
}

// ==================== CÂMERA SETTINGS PANEL ====================
function drawFOVArc(fov) {
    const canvas = document.getElementById('cam-fov-arc');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H + 2, r = H - 4;
    const halfAngle = (fov / 2) * Math.PI / 180;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0, false);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.stroke();
    const leftAngle  = -Math.PI / 2 - halfAngle;
    const rightAngle = -Math.PI / 2 + halfAngle;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, leftAngle, rightAngle, false);
    ctx.closePath(); ctx.fillStyle = 'rgba(80,160,255,0.10)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(leftAngle) * r, cy + Math.sin(leftAngle) * r);
    ctx.strokeStyle = '#7edfff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(rightAngle) * r, cy + Math.sin(rightAngle) * r); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, leftAngle, rightAngle, false);
    ctx.strokeStyle = 'rgba(126,223,255,0.40)'; ctx.lineWidth = 1.2; ctx.stroke();
}

function applyCameraSettings(camObj) {
    if (!camObj || !isCamera(camObj)) return;
    const fov    = parseFloat(document.getElementById('cam-fov')?.value    || '60');
    const near   = parseFloat(document.getElementById('cam-near')?.value   || '0.1');
    const far    = parseFloat(document.getElementById('cam-far')?.value    || '1000');
    const aspect = document.getElementById('cam-aspect')?.value || '1.7778';
    camObj.userData.camFov    = fov;
    camObj.userData.camNear   = near;
    camObj.userData.camFar    = far;
    camObj.userData.camAspect = aspect === 'free' ? 16/9 : parseFloat(aspect);
    camObj.userData.showFrustum  = document.getElementById('cam-show-frustum')?.checked !== false;
    camObj.userData.frustumColor = document.getElementById('cam-frustum-color')?.value || '#ffff00';
    if (povActive && povCamera === camObj) {
        camera.fov  = fov;
        camera.near = near;
        camera.far  = far;
        camera.updateProjectionMatrix();
    }
    rebuildCameraFrustum(camObj);
    markDirty(3);
}

function loadCameraSettingsIntoPanel(camObj) {
    if (!camObj || !isCamera(camObj)) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const fov = camObj.userData.camFov || 60;
    set('cam-fov', fov); set('cam-fov-num', fov);
    set('cam-near', camObj.userData.camNear || 0.1); set('cam-near-num', camObj.userData.camNear || 0.1);
    set('cam-far',  camObj.userData.camFar  || 1000); set('cam-far-num', camObj.userData.camFar  || 1000);
    set('cam-pov-speed', camObj.userData.povSpeed || 5); set('cam-pov-speed-num', camObj.userData.povSpeed || 5);
    set('cam-pov-sens',  camObj.userData.povSens  || 1); set('cam-pov-sens-num',  camObj.userData.povSens  || 1);
    const showFrustum = document.getElementById('cam-show-frustum');
    if (showFrustum) showFrustum.checked = camObj.userData.showFrustum !== false;
    const fc = document.getElementById('cam-frustum-color');
    if (fc) fc.value = camObj.userData.frustumColor || '#ffff00';
    const aspect = document.getElementById('cam-aspect');
    if (aspect) aspect.value = String(camObj.userData.camAspect || '1.7778');
    const label = document.getElementById('cam-fov-label');
    if (label) label.textContent = fov + '°';
    drawFOVArc(fov);
}

function syncCamSlider(sliderId, numId, callback) {
    const sl = document.getElementById(sliderId), nm = document.getElementById(numId);
    if (!sl || !nm) return;
    sl.addEventListener('input', () => { nm.value = sl.value; callback(parseFloat(sl.value)); });
    nm.addEventListener('input', () => { sl.value = nm.value; callback(parseFloat(nm.value)); });
}

syncCamSlider('cam-fov', 'cam-fov-num', v => {
    const label = document.getElementById('cam-fov-label');
    if (label) label.textContent = Math.round(v) + '°';
    drawFOVArc(v);
    if (activeObject && isCamera(activeObject)) applyCameraSettings(activeObject);
});
syncCamSlider('cam-near',      'cam-near-num',      () => { if (activeObject && isCamera(activeObject)) applyCameraSettings(activeObject); });
syncCamSlider('cam-far',       'cam-far-num',        () => { if (activeObject && isCamera(activeObject)) applyCameraSettings(activeObject); });
syncCamSlider('cam-pov-speed', 'cam-pov-speed-num',  v => { if (activeObject && isCamera(activeObject)) activeObject.userData.povSpeed = v; });
syncCamSlider('cam-pov-sens',  'cam-pov-sens-num',   v => { if (activeObject && isCamera(activeObject)) activeObject.userData.povSens  = v; });

const camShowFrustum = document.getElementById('cam-show-frustum');
if (camShowFrustum) camShowFrustum.addEventListener('change', () => { if (activeObject && isCamera(activeObject)) applyCameraSettings(activeObject); });
const camFrustumColor = document.getElementById('cam-frustum-color');
if (camFrustumColor) camFrustumColor.addEventListener('input', () => { if (activeObject && isCamera(activeObject)) applyCameraSettings(activeObject); });
const camAspect = document.getElementById('cam-aspect');
if (camAspect) camAspect.addEventListener('change', () => { if (activeObject && isCamera(activeObject)) applyCameraSettings(activeObject); });

// ==================== ADICIONAR OBJETOS ====================
function addShape(type) {
    const mat = new THREE.MeshStandardMaterial({
        color:     Math.random() * 0xffffff,
        roughness: 0.18,   // baixo = reflexos visíveis
        metalness: 0.05,
    });
    const geoMap  = { cube:new THREE.BoxGeometry(1,1,1), sphere:new THREE.SphereGeometry(.7,32,16), cone:new THREE.ConeGeometry(.7,1.4,32), cylinder:new THREE.CylinderGeometry(.7,.7,1.4,32), torus:new THREE.TorusGeometry(.7,.2,16,64) };
    const nameMap = { cube:'Cubo', sphere:'Esfera', cone:'Cone', cylinder:'Cilindro', torus:'Torus' };
    if (!geoMap[type]) return;
    const mesh = new THREE.Mesh(geoMap[type], mat);
    mesh.userData.shapeType = type;
    mesh.name = generateName(nameMap[type]); mesh.castShadow = mesh.receiveShadow = true;
    mesh.position.set(Math.random()*6-3, 1, Math.random()*6-3); mesh.layers.enable(1);
    scene.add(mesh); sceneObjects.push(mesh);
    invalidateBloomCache(); requestShadowUpdate(); saveState(); updateObjectsList();
}

function addLight(type) {
    let light, helper, color, colorHex;
    if (type==='sunLight') {
        color=0xffdd88;colorHex='#ffdd88';light=new THREE.DirectionalLight(color,1.5);light.castShadow=true;light.shadow.mapSize.width=light.shadow.mapSize.height=2048;
        helper=new THREE.Object3D();helper.name=generateName('Sol');helper.userData.isLight=true;helper.userData.light=light;helper.position.set(20,30,10);helper.add(light);
        const ic=createLightIcon(colorHex,'sun');ic.position.set(0,.5,0);ic.userData.isLightIcon=true;ic.layers.enable(1);helper.add(ic);
        { const sv=new THREE.Mesh(new THREE.SphereGeometry(.5,16,16),new THREE.MeshBasicMaterial({color})); sv.position.set(0,-.5,0); sv.userData.isLightIcon=true; sv.layers.enable(1); helper.add(sv); }
    } else if (type==='moonLight') {
        color=0x99aaff;colorHex='#99aaff';light=new THREE.DirectionalLight(color,.8);light.castShadow=true;light.shadow.mapSize.width=light.shadow.mapSize.height=2048;
        helper=new THREE.Object3D();helper.name=generateName('Lua');helper.userData.isLight=true;helper.userData.light=light;helper.position.set(-20,15,-20);helper.add(light);
        const ic=createLightIcon(colorHex,'moon');ic.position.set(0,.5,0);ic.userData.isLightIcon=true;ic.layers.enable(1);helper.add(ic);
        { const sv=new THREE.Mesh(new THREE.SphereGeometry(.5,16,16),new THREE.MeshBasicMaterial({color})); sv.position.set(0,-.5,0); sv.userData.isLightIcon=true; sv.layers.enable(1); helper.add(sv); }
    } else {
        color=Math.random()*0xffffff;colorHex='#'+('000000'+color.toString(16)).slice(-6);
        switch(type) {
            case 'pointLight': {
                const px1=Math.random()*6-3, pz1=Math.random()*6-3;
                light=new THREE.PointLight(color,1,20);
                helper=new THREE.Object3D(); helper.name=generateName('Luz Pontual'); helper.userData.isLight=true; helper.userData.light=light; helper.position.set(px1,3,pz1); helper.add(light);
                const ic1=createLightIcon(colorHex,'point'); ic1.position.set(0,.5,0); ic1.userData.isLightIcon=true; ic1.layers.enable(1); helper.add(ic1);
                const sv1=new THREE.Mesh(new THREE.SphereGeometry(.2,8,8),new THREE.MeshBasicMaterial({color})); sv1.position.set(0,-.3,0); sv1.userData.isLightIcon=true; sv1.layers.enable(1); helper.add(sv1);
                break;
            }
            case 'directionalLight': {
                const px2=Math.random()*6-3, pz2=Math.random()*6-3;
                light=new THREE.DirectionalLight(color,1);
                helper=new THREE.Object3D(); helper.name=generateName('Luz Direcional'); helper.userData.isLight=true; helper.userData.light=light; helper.position.set(px2,5,pz2); helper.add(light);
                const ic2=createLightIcon(colorHex,'directional'); ic2.position.set(0,.5,0); ic2.userData.isLightIcon=true; ic2.layers.enable(1); helper.add(ic2);
                helper.add(new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(0,-.3,0),.8,color));
                break;
            }
            case 'ambientLight': {
                light=new THREE.AmbientLight(color,.5); helper=new THREE.Object3D(); helper.name=generateName('Luz Ambiente'); helper.userData.isLight=true; helper.userData.light=light;
                const sv3=new THREE.Mesh(new THREE.SphereGeometry(.4,16,16),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.3})); sv3.userData.isLightIcon=true; sv3.layers.enable(1); helper.add(sv3);
                const ic3=createLightIcon(colorHex,'ambient'); ic3.position.set(0,.5,0); ic3.userData.isLightIcon=true; ic3.layers.enable(1); helper.add(ic3);
                helper.position.set(Math.random()*6-3,2,Math.random()*6-3);
                scene.add(light); scene.add(helper); sceneObjects.push(helper);
                invalidateBloomCache(); requestShadowUpdate(); saveState(); updateObjectsList(); return;
            }
        }
    }
    if (light && helper) { helper.layers.enable(1); scene.add(helper); sceneObjects.push(helper); }
    invalidateBloomCache(); requestShadowUpdate(); saveState(); updateObjectsList();
}

function addFire()        { if(typeof window.createFire==='undefined'){return;} const f=window.createFire(); f.position.set(Math.random()*6-3,0,Math.random()*6-3); f.layers.enable(1); scene.add(f); sceneObjects.push(f); particleSystems.push(f); invalidateBloomCache(); saveState(); updateObjectsList(); }
function addLaser()       { if(typeof window.createLaser==='undefined'){return;} const l=window.createLaser(); l.position.set(Math.random()*6-3,0,Math.random()*6-3); l.layers.enable(1); scene.add(l); sceneObjects.push(l); particleSystems.push(l); invalidateBloomCache(); saveState(); updateObjectsList(); }
function addElectricity() { if(typeof window.createElectricity==='undefined'){return;} const e=window.createElectricity(); e.position.set(Math.random()*6-3,0,Math.random()*6-3); e.layers.enable(1); scene.add(e); sceneObjects.push(e); particleSystems.push(e); invalidateBloomCache(); saveState(); updateObjectsList(); }
function addExplosion()   { if(typeof window.createExplosion==='undefined'){return;} const e=window.createExplosion(); e.position.set(Math.random()*6-3,0,Math.random()*6-3); scene.add(e); sceneObjects.push(e); particleSystems.push(e); invalidateBloomCache(); saveState(); updateObjectsList(); }
function addElectricityArc() { if(typeof window.createElectricityArc==='undefined'){return;} const e=window.createElectricityArc(); e.position.set(Math.random()*6-3,0,Math.random()*6-3); e.layers.enable(1); scene.add(e); sceneObjects.push(e); particleSystems.push(e); invalidateBloomCache(); saveState(); updateObjectsList(); }
function addBlackHole()      { if(typeof window.createBlackHole==='undefined'){return;} const e=window.createBlackHole(); e.position.set(Math.random()*6-3,1,Math.random()*6-3); e.layers.enable(1); scene.add(e); sceneObjects.push(e); particleSystems.push(e); invalidateBloomCache(); saveState(); updateObjectsList(); }
// Lab particle creation
window._nexusAddLabParticle = function(presetId) {
    const lab = window._nexusParticleLab;
    if (!lab) return;
    const sx = (Math.random()-0.5)*4, sz = (Math.random()-0.5)*4;
    const THREE_V = window._ParticleEngine ? (() => { const {ParticleSystem} = window._ParticleEngine; const v = new ParticleSystem.__proto__.constructor.prototype.constructor(scene, {}); return v; }) : null;
    const sys = lab.createFromPreset(presetId);
    if (!sys) return;
    sys.position.set(sx, 0.5, sz);
    if (sys._points) {
        sys._points.name = sys.name;
        sys._points.userData = Object.assign(sys._points.userData||{}, sys.userData||{}, {isLab:true, presetId, name:sys.name});
        sys._points._labSystem = sys;
        sceneObjects.push(sys._points);
        particleSystems.push(sys._points);
    }
    saveState();
    updateObjectsList();
    markDirty(3);
    invalidateBloomCache();
    return sys;
};

function addTvStatic()       { if(typeof window.createTvStatic==='undefined'){return;} const e=window.createTvStatic(); e.position.set(Math.random()*6-3,1,Math.random()*6-3); e.layers.enable(1); scene.add(e); sceneObjects.push(e); particleSystems.push(e); invalidateBloomCache(); saveState(); updateObjectsList(); }

document.querySelectorAll('#add-panel button').forEach(btn => {
    btn.addEventListener('click', e => {
        e.stopPropagation(); const type = btn.dataset.type; if (!type) return;
        if      (type.includes('Light') || type==='sunLight' || type==='moonLight') addLight(type);
        else if (type === 'fire')        addFire();
        else if (type === 'laser')       addLaser();
        else if (type === 'electricity') addElectricity();
        else if (type === 'explosion')   addExplosion();
        else if (type === 'electricityArc') addElectricityArc();
        else if (type === 'blackHole')      addBlackHole();
        else if (type === 'tvStatic')       addTvStatic();
        else if (type === 'camera')      addCamera();
        else                             addShape(type);
        addPanel?.classList.add('hidden');
    });
});

// ==================== LISTA DE OBJETOS ====================
function _visibleChildren(obj) {
    return (obj.children || []).filter(c =>
        !c.userData?.isCamInternal && !c.userData?.isFrustumLines &&
        !c.userData?.isBoneHelper  && !c.userData?.isDefaultLight &&
        !c.userData?._isOnionGhost  // fantasmas do Onion Skin não aparecem na lista
    );
}

function buildObjectTreeHTML(obj) {
    if (!obj || obj === gridHelper || obj === axesHelper) return '';
    if (obj.userData?.isDefaultLight || obj.userData?.isBoneHelper)  return '';
    if (obj.userData?.isCamInternal  || obj.userData?.isFrustumLines) return '';
    if (obj.userData?.isFXSprite) return '';
    if (obj.userData?._isOnionGhost) return ''; // ← Fantasmas do Onion Skin não aparecem na lista
    const vChildren = _visibleChildren(obj);
    const hasVis = vChildren.length > 0;
    let icon = '📦';
    if (isLight(obj))           icon = '💡';
    else if (isParticleSystem(obj)) icon = '✨';
    else if (isCamera(obj))     icon = '🎥';
    const _isActiveItem = activeObject && obj.id === activeObject.id;
    let html = `<div class="tree-item${_isActiveItem ? " active-item" : ""}" data-object-id="${obj.id}">`;
    html += `<span class="tree-toggle ${hasVis ? 'has-children' : ''}">${hasVis ? '▼' : '○'}</span>`;
    html += `<input type="checkbox" class="tree-checkbox" ${selectedObjects.has(obj) ? 'checked' : ''}>`;
    html += `<span class="tree-label">${icon} ${obj.name || obj.type || 'Objeto'}</span>`;
    if (_isActiveItem) html += `<button class="tree-transform-btn" title="Transform" data-object-id="${obj.id}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#003E8F" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></button>`;
    if (hasVis) {
        const _groupOpen = _openGroupIds.has(obj.id);
        html += `<div class="tree-children" style="display:${_groupOpen ? 'block' : 'none'};">`;
        vChildren.forEach(c => { html += buildObjectTreeHTML(c); });
        html += '</div>';
    }
    html += '</div>';
    return html;
}

function findObjectById(id, parent = scene) {
    if (parent.id === id) return parent;
    for (const c of parent.children) { const f = findObjectById(id, c); if (f) return f; }
    return null;
}

function doReparent(srcObj, tgtObj) {
    if (!srcObj || !tgtObj || srcObj === tgtObj) return;
    let check = tgtObj;
    while (check) { if (check === srcObj) return; check = check.parent; }
    const wPos = new THREE.Vector3(), wQuat = new THREE.Quaternion(), wScale = new THREE.Vector3();
    srcObj.getWorldPosition(wPos); srcObj.getWorldQuaternion(wQuat); srcObj.getWorldScale(wScale);
    srcObj.removeFromParent(); tgtObj.add(srcObj);
    tgtObj.updateMatrixWorld(true);
    const parentInv = new THREE.Matrix4().copy(tgtObj.matrixWorld).invert();
    const worldMat  = new THREE.Matrix4().compose(wPos, wQuat, wScale);
    const localMat  = new THREE.Matrix4().multiplyMatrices(parentInv, worldMat);
    localMat.decompose(srcObj.position, srcObj.quaternion, srcObj.scale);
    srcObj.updateMatrix();
    saveState(); updateObjectsList();
}

// ── Event delegation para a lista de objetos (setup único, sem reattach) ──────
let _listDelegationReady = false;
function _setupListDelegation() {
    if (_listDelegationReady || !objectsListEl) return;
    _listDelegationReady = true;

    // Cliques gerais: toggle, label, reparent, transform btn
    objectsListEl.addEventListener('click', e => {
        const toggle = e.target.closest('.tree-toggle.has-children');
        if (toggle) {
            e.stopPropagation();
            const ch = toggle.parentElement.querySelector('.tree-children');
            if (ch) { const open = ch.style.display !== 'none'; ch.style.display = open ? 'none' : 'block'; toggle.textContent = open ? '►' : '▼'; const oid = parseInt(toggle.parentElement.dataset.objectId); if (open) _openGroupIds.delete(oid); else _openGroupIds.add(oid); }
            return;
        }
        const transformBtn = e.target.closest('.tree-transform-btn');
        if (transformBtn) { e.stopPropagation(); showTransformPanel(transformBtn); return; }
        const item = e.target.closest('.tree-item');
        if (!item) return;
        const itemId = parseInt(item.dataset.objectId);
        e.stopPropagation();
        if (_reparentSrcId !== null) {
            if (itemId === _reparentSrcId) { cancelReparentMode(); return; }
            const srcObj = findObjectById(_reparentSrcId), tgtObj = findObjectById(itemId);
            cancelReparentMode();
            if (srcObj && tgtObj) doReparent(srcObj, tgtObj);
            return;
        }
        const label = e.target.closest('.tree-label');
        if (label) {
            const obj = findObjectById(itemId);
            if (obj) {
                selectBone(null);
                if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    if (selectedObjects.has(obj)) { selectedObjects.delete(obj); setActiveObject(selectedObjects.size > 0 ? [...selectedObjects].at(-1) : null); }
                    else { selectedObjects.add(obj); setActiveObject(obj); }
                } else {
                    selectedObjects.clear(); selectedObjects.add(obj); setActiveObject(obj);
                }
                _updateActiveItemCSS();
            }
        }
    });

    // Duplo clique: ativa modo reparent
    objectsListEl.addEventListener('dblclick', e => {
        e.stopPropagation();
        const item = e.target.closest('.tree-item');
        if (!item) return;
        const itemId = parseInt(item.dataset.objectId);
        if (_reparentSrcId !== null) { cancelReparentMode(); return; }
        _reparentSrcId = itemId;
        document.querySelectorAll('.tree-item.reparent-src').forEach(el => el.classList.remove('reparent-src'));
        item.classList.add('reparent-src');
        const dragHint = document.getElementById('drag-hint');
        if (dragHint) { dragHint.textContent = '🔗 Clique em outro objeto para torná-lo pai  •  Esc para cancelar'; dragHint.classList.remove('hidden'); dragHint.classList.add('reparent-active'); }
    });

    // mouseover/out para highlight de reparent (bubbles, ao contrário de mouseenter)
    objectsListEl.addEventListener('mouseover', e => {
        const item = e.target.closest('.tree-item');
        if (item && _reparentSrcId !== null && parseInt(item.dataset.objectId) !== _reparentSrcId) item.classList.add('reparent-hover');
    });
    objectsListEl.addEventListener('mouseout', e => {
        const item = e.target.closest('.tree-item');
        if (item) item.classList.remove('reparent-hover');
    });

    // Checkbox de seleção múltipla
    objectsListEl.addEventListener('change', e => {
        const cb = e.target.closest('.tree-checkbox');
        if (!cb) return;
        e.stopPropagation();
        const item = cb.closest('.tree-item');
        if (!item) return;
        const obj = findObjectById(parseInt(item.dataset.objectId));
        if (obj) { if (cb.checked) selectedObjects.add(obj); else selectedObjects.delete(obj); setActiveObject(obj); _updateActiveItemCSS(); }
    });
}

// Atualiza só a classe active-item sem reconstruir o DOM inteiro
function _updateActiveItemCSS() {
    if (!objectsListEl) return;
    objectsListEl.querySelectorAll('.tree-item.active-item').forEach(el => el.classList.remove('active-item'));
    if (activeObject) {
        const el = objectsListEl.querySelector(`[data-object-id="${activeObject.id}"]`);
        if (el) el.classList.add('active-item');
    }
}

function updateObjectsList() {
    if (!objectsListEl) return;
    _setupListDelegation(); // idempotente — só roda na primeira chamada
    let html = '';
    scene.children.forEach(c => { html += buildObjectTreeHTML(c); });
    objectsListEl.innerHTML = html;
    const dragHint = document.getElementById('drag-hint');

    if (objectCountEl) objectCountEl.textContent = sceneObjects.length;
    if (!window._fxEditActive) {
        if (selectedBone) transformControls.attach(selectedBone);
        else if (activeObject) transformControls.attach(activeObject);
        else transformControls.detach();
    }

    if (_reparentSrcId !== null) {
        const srcItem = objectsListEl.querySelector(`[data-object-id="${_reparentSrcId}"]`);
        if (srcItem) srcItem.classList.add('reparent-src');
        if (dragHint) { dragHint.classList.remove('hidden'); dragHint.classList.add('reparent-active'); }
    }

    updateMaterialPanel(); updateLightPanel(); updateParticlePanel(); updateContextButtons();
}

function setActiveObject(obj) {
    activeObject = obj; window.activeObject = obj; window.sceneObjects = sceneObjects;
    if (obj) {
        selectBone(null); if (!window._fxEditActive) transformControls.attach(obj);
        let _p = obj.parent;
        while (_p && _p !== scene) { _openGroupIds.add(_p.id); _p = _p.parent; }
    }
    else if (!selectedBone) transformControls.detach();
    showCameraHud(isCamera(obj));
    if (isCamera(obj)) { loadCameraSettingsIntoPanel(obj); _setCameraHudState(povActive && povCamera === obj); }
    // Não chama saveState aqui — selecionar um objeto não é uma ação desfeita pelo undo
    updateMaterialPanel(); updateLightPanel(); updateParticlePanel(); updateContextButtons();
    if (typeof window.onActiveObjectChanged === 'function') window.onActiveObjectChanged(obj);
    // Atualiza fantasmas do Onion Skin sempre que o objeto ativo muda
    if (window._nexusOnionUpdate) window._nexusOnionUpdate();
}

function updateContextButtons() {
    if (particleBtn) particleBtn.classList.toggle('hidden', !isParticleSystem(activeObject));
    if (lightBtn)    lightBtn.classList.toggle('hidden',    !isLight(activeObject));
}

// ==================== PAINEL DE TRANSFORM ====================
const R2D = 180 / Math.PI, D2R = Math.PI / 180;
let _tpOutsideHandler = null;

function _ensureTransformPanel() {
    if (document.getElementById('transform-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'transform-panel';
    panel.className = 'transform-panel hidden';
    panel.innerHTML = `
        <div class="tp-header">
            <span class="tp-title">⚙️ Transform</span>
            <button class="tp-close" id="tp-close-btn">✕</button>
        </div>
        <div class="tp-section">
            <div class="tp-label">📍 Posição</div>
            <div class="tp-row">
                <label class="tp-field"><span class="tp-axis tp-x">X</span><input type="number" id="tp-pos-x" step="0.01"></label>
                <label class="tp-field"><span class="tp-axis tp-y">Y</span><input type="number" id="tp-pos-y" step="0.01"></label>
                <label class="tp-field"><span class="tp-axis tp-z">Z</span><input type="number" id="tp-pos-z" step="0.01"></label>
            </div>
        </div>
        <div class="tp-section">
            <div class="tp-label">🔄 Rotação (°)</div>
            <div class="tp-row">
                <label class="tp-field"><span class="tp-axis tp-x">X</span><input type="number" id="tp-rot-x" step="0.1"></label>
                <label class="tp-field"><span class="tp-axis tp-y">Y</span><input type="number" id="tp-rot-y" step="0.1"></label>
                <label class="tp-field"><span class="tp-axis tp-z">Z</span><input type="number" id="tp-rot-z" step="0.1"></label>
            </div>
        </div>
        <div class="tp-section">
            <div class="tp-label">📐 Escala</div>
            <div class="tp-row">
                <label class="tp-field"><span class="tp-axis tp-x">X</span><input type="number" id="tp-scale-x" step="0.01" min="0.001"></label>
                <label class="tp-field"><span class="tp-axis tp-y">Y</span><input type="number" id="tp-scale-y" step="0.01" min="0.001"></label>
                <label class="tp-field"><span class="tp-axis tp-z">Z</span><input type="number" id="tp-scale-z" step="0.01" min="0.001"></label>
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    document.getElementById('tp-close-btn').addEventListener('click', () => panel.classList.add('hidden'));

    function applyTransform() {
        if (!activeObject) return;
        activeObject.position.set(
            parseFloat(document.getElementById('tp-pos-x').value) || 0,
            parseFloat(document.getElementById('tp-pos-y').value) || 0,
            parseFloat(document.getElementById('tp-pos-z').value) || 0
        );
        activeObject.rotation.set(
            (parseFloat(document.getElementById('tp-rot-x').value) || 0) * D2R,
            (parseFloat(document.getElementById('tp-rot-y').value) || 0) * D2R,
            (parseFloat(document.getElementById('tp-rot-z').value) || 0) * D2R
        );
        activeObject.scale.set(
            parseFloat(document.getElementById('tp-scale-x').value) || 1,
            parseFloat(document.getElementById('tp-scale-y').value) || 1,
            parseFloat(document.getElementById('tp-scale-z').value) || 1
        );
        markDirty(3); requestShadowUpdate();
    }
    ['tp-pos-x','tp-pos-y','tp-pos-z','tp-rot-x','tp-rot-y','tp-rot-z','tp-scale-x','tp-scale-y','tp-scale-z']
        .forEach(id => document.getElementById(id).addEventListener('input', applyTransform));
}

function _fillTransformPanel() {
    if (!activeObject) return;
    const px = document.getElementById('tp-pos-x'); if (!px) return;
    document.getElementById('tp-pos-x').value = activeObject.position.x.toFixed(3);
    document.getElementById('tp-pos-y').value = activeObject.position.y.toFixed(3);
    document.getElementById('tp-pos-z').value = activeObject.position.z.toFixed(3);
    document.getElementById('tp-rot-x').value = (activeObject.rotation.x * R2D).toFixed(2);
    document.getElementById('tp-rot-y').value = (activeObject.rotation.y * R2D).toFixed(2);
    document.getElementById('tp-rot-z').value = (activeObject.rotation.z * R2D).toFixed(2);
    document.getElementById('tp-scale-x').value = activeObject.scale.x.toFixed(3);
    document.getElementById('tp-scale-y').value = activeObject.scale.y.toFixed(3);
    document.getElementById('tp-scale-z').value = activeObject.scale.z.toFixed(3);
}

function showTransformPanel(triggerBtn) {
    _ensureTransformPanel();
    const panel = document.getElementById('transform-panel');
    const alreadyOpen = !panel.classList.contains('hidden');
    if (alreadyOpen) { panel.classList.add('hidden'); return; }

    const objPanel = document.querySelector('.compact-panel');
    if (objPanel) {
        const r = objPanel.getBoundingClientRect();
        panel.style.left  = r.left + 'px';
        panel.style.top   = (r.bottom + 6) + 'px';
        panel.style.width = r.width + 'px';
    }

    _fillTransformPanel();
    panel.classList.remove('hidden');

    if (_tpOutsideHandler) document.removeEventListener('click', _tpOutsideHandler);
    _tpOutsideHandler = e => {
        if (!panel.contains(e.target) && !e.target.classList.contains('tree-transform-btn')) {
            panel.classList.add('hidden');
            document.removeEventListener('click', _tpOutsideHandler);
            _tpOutsideHandler = null;
        }
    };
    setTimeout(() => document.addEventListener('click', _tpOutsideHandler), 10);
}

// Atualiza painel de transform em tempo real ao mover o gizmo
// ── Gizmo: bloqueia OrbitControls durante o drag ─────────────────────────────
transformControls.addEventListener('dragging-changed', (event) => {
    if (!window._editModeActive) { controls.enabled = !event.value && !povActive; } else { /* In edit mode: keep controls enabled but left-drag handled by edit system */ }
    if (!event.value) saveState();
    if (activeObject?.userData?.hasPhysics) {
        activeObject.userData._gizmoMoving = !!event.value;
        if (!event.value) window.PhysicsSystem?.teleportBody(activeObject);
    }
});
transformControls.addEventListener('change', () => {
    markDirty(4);
    requestShadowUpdate();
    if (activeObject && isCamera(activeObject)) rebuildCameraFrustum(activeObject);
    // Quando um bone está selecionado, força atualização imediata dos helpers
    // sem esperar o throttle de (_frameCount & 1) === 0 no render loop
    if (selectedBone && boneHelpers.length > 0) updateBoneHelpers();
    const panel = document.getElementById('transform-panel');
    if (panel && !panel.classList.contains('hidden') && activeObject) _fillTransformPanel();
});

// ==================== MENU DE CONTEXTO ====================
function showContextMenu(x, y) {
    if (!contextMenu) return;
    const panel = document.querySelector('.compact-panel');
    try {
    contextMenu.style.left = '-9999px'; contextMenu.style.top = '-9999px'; contextMenu.classList.remove('hidden');
    const _objPanel = document.querySelector('.compact-panel'), _objPr = _objPanel.getBoundingClientRect();
    const _cmLeft = _objPr.left + _objPr.width / 2 - contextMenu.offsetWidth / 2;
    const _cmTop = _objPr.bottom + 8;
    contextMenu.style.left = (_cmLeft < 4 ? 4 : _cmLeft) + 'px'; contextMenu.style.top = _cmTop + 'px';
} catch(e) {}
    
    ['delete-option','clone-option','rename-option','group-option'].forEach(id => {
        const el = document.getElementById(id); if (!el) return;
        const ne = el.cloneNode(true); el.parentNode.replaceChild(ne, el);
        ne.addEventListener('click', e => {
            e.stopPropagation();
            if (id === 'delete-option' && contextMenuTarget) {
                if (isCamera(contextMenuTarget) && povActive && povCamera === contextMenuTarget) exitPOV();
                // Remove apenas os bone helpers do objeto sendo deletado (preserva os demais modelos)
                removeBoneHelpersFor(contextMenuTarget);
                scene.remove(contextMenuTarget);
                if (contextMenuTarget.userData?.light) scene.remove(contextMenuTarget.userData.light);
                [particleSystems, sceneObjects].forEach(arr => { const i = arr.indexOf(contextMenuTarget); if (i > -1) arr.splice(i, 1); });
                selectedObjects.delete(contextMenuTarget);
                if (activeObject === contextMenuTarget) setActiveObject(null);
                if (window.SpecialFX) window.SpecialFX.removeAllFor(contextMenuTarget.uuid);
                requestShadowUpdate(); invalidateBloomCache(); saveState(); updateObjectsList();
            } else if (id === 'clone-option' && contextMenuTarget) {
                let clone;
                if (isFireParticleSystem(contextMenuTarget)){clone=window.createFire();clone.position.copy(contextMenuTarget.position);clone.name=contextMenuTarget.name+' (cópia)';particleSystems.push(clone);}
                else if (isLaserParticleSystem(contextMenuTarget)){clone=window.createLaser();clone.position.copy(contextMenuTarget.position);clone.name=contextMenuTarget.name+' (cópia)';particleSystems.push(clone);}
                else if (isElectricityParticleSystem(contextMenuTarget)){clone=window.createElectricity();clone.position.copy(contextMenuTarget.position);clone.name=contextMenuTarget.name+' (cópia)';particleSystems.push(clone);}
                else if (isElectricityArcSystem(contextMenuTarget)){clone=window.createElectricityArc();clone.position.copy(contextMenuTarget.position);clone.name=contextMenuTarget.name+' (cópia)';particleSystems.push(clone);}
                else if (isBlackHoleSystem(contextMenuTarget)){clone=window.createBlackHole();clone.position.copy(contextMenuTarget.position);clone.name=contextMenuTarget.name+' (cópia)';particleSystems.push(clone);}
                else if (isTvStaticSystem(contextMenuTarget)){clone=window.createTvStatic();clone.position.copy(contextMenuTarget.position);clone.name=contextMenuTarget.name+' (cópia)';particleSystems.push(clone);}
                else { clone = contextMenuTarget.clone(); clone.position.x += 1; clone.name = contextMenuTarget.name + ' (cópia)'; }
                if (isCamera(clone)) { clone.userData.isCamera = true; rebuildCameraFrustum(clone); }
                scene.add(clone); sceneObjects.push(clone); requestShadowUpdate(); invalidateBloomCache(); saveState(); updateObjectsList();
            } else if (id === 'rename-option' && contextMenuTarget) {
                const n = prompt('Novo nome:', contextMenuTarget.name);
                if (n) { contextMenuTarget.name = n; updateObjectsList(); }
            } else if (id === 'group-option' && selectedObjects.size >= 2) {
                const g = new THREE.Group(); g.name = 'Grupo ' + (objectCounter++);
                selectedObjects.forEach(o => { g.add(o); [sceneObjects, particleSystems].forEach(a => { const i = a.indexOf(o); if (i > -1) a.splice(i, 1); }); });
                scene.add(g); sceneObjects.push(g); selectedObjects.clear(); selectedObjects.add(g); setActiveObject(g); invalidateBloomCache(); saveState(); updateObjectsList();
            }
            contextMenu.classList.add('hidden');
        });
        if (id === 'group-option') ne.classList.toggle('disabled', selectedObjects.size < 2);
    });
}
if (contextMenu) {
    document.addEventListener('click', e => { if (!contextMenu.contains(e.target)) contextMenu.classList.add('hidden'); });
    contextMenu.addEventListener('click', e => e.stopPropagation());
}

// ==================== PAINEL DE LUZ ====================
function updateLightPanel() {
    if (!lightNoSelection || !lightControls) return;
    const isLightObj = activeObject && isLight(activeObject);
    if (isLightObj) {
        lightNoSelection.style.display = 'none'; lightControls.style.display = 'block';
        const light = activeObject.userData.light || activeObject;
        if (lightColor) lightColor.value = '#' + light.color.getHexString();
        if (lightIntensity) lightIntensity.value = light.intensity; if (lightIntensityNum) lightIntensityNum.value = light.intensity;
        if (lightDistanceGroup) {
            if (light.isPointLight || light.isSpotLight) {
                lightDistanceGroup.style.display = 'block';
                if (lightDistance) lightDistance.value = light.distance;
                if (lightDistanceNum) lightDistanceNum.value = light.distance;
            } else lightDistanceGroup.style.display = 'none';
        }
        // Atualiza apenas o label do botão — NÃO toca em child.visible aqui
        const rvBtn = document.getElementById('light-render-visible-btn');
        if (rvBtn) {
            const isOn = activeObject.userData.lightIconVisible !== false;
            rvBtn.className = 'light-render-toggle ' + (isOn ? 'on' : 'off');
            rvBtn.innerHTML = isOn
                ? '<span class="lrv-label">👁 Visível</span>'
                : '<span class="lrv-label">🚫 Oculto</span>';
        }
    } else { lightNoSelection.style.display = 'block'; lightControls.style.display = 'none'; }
}
if (lightColor) lightColor.addEventListener('input', e => {
    if (activeObject && isLight(activeObject)) {
        const hex = e.target.value;
        (activeObject.userData.light||activeObject).color.set(hex);
        // Atualiza a cor visual do helper (esfera/sprite)
        const c = new THREE.Color(hex);
        activeObject.traverse(child => {
            if (child.userData?.isLightIcon && child.material) {
                if (child.isSprite) child.material.color.set(hex);
                else if (child.isMesh && child.material.color) child.material.color.set(hex);
            }
        });
        requestShadowUpdate(); markDirty(2); saveStateDebounced();
    }
});
// Botão visível/oculto — só esconde os filhos visuais (ícone/sprite), preserva a THREE.Light
const _lrvBtn = document.getElementById('light-render-visible-btn');
if (_lrvBtn) _lrvBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (!activeObject || !isLight(activeObject)) return;
    const isCurrentlyVisible = activeObject.userData.lightIconVisible !== false;
    const newVisible = !isCurrentlyVisible;
    activeObject.userData.lightIconVisible = newVisible;
    activeObject.userData.renderVisible    = newVisible; // sincroniza com export
    // Só esconde os filhos visuais (Sprites/Meshes de ícone) — NUNCA a THREE.Light
    activeObject.traverse(child => {
        if (child === activeObject) return;           // não toca no helper root
        if (child.isLight) return;                    // nunca esconde a luz real
        if (child.userData?.isLightIcon || child.isSprite || child.isMesh) child.visible = newVisible;
    });
    const rvBtn = document.getElementById('light-render-visible-btn');
    if (rvBtn) {
        rvBtn.className = 'light-render-toggle ' + (newVisible ? 'on' : 'off');
        rvBtn.innerHTML = newVisible
            ? '<span class="lrv-label">👁 Visível</span>'
            : '<span class="lrv-label">🚫 Oculto</span>';
    }
    saveState(); markDirty(4);
});
if (lightIntensity && lightIntensityNum) {
    lightIntensity.addEventListener('input', e => { const v=parseFloat(e.target.value); lightIntensityNum.value=v; if(activeObject&&isLight(activeObject)){(activeObject.userData.light||activeObject).intensity=v;saveStateDebounced();} });
    lightIntensityNum.addEventListener('input', e => { const v=parseFloat(e.target.value); lightIntensity.value=v; if(activeObject&&isLight(activeObject)){(activeObject.userData.light||activeObject).intensity=v;saveStateDebounced();} });
}
if (lightDistance && lightDistanceNum) {
    lightDistance.addEventListener('input', e => { const v=parseFloat(e.target.value); lightDistanceNum.value=v; if(activeObject&&isLight(activeObject)){const l=activeObject.userData.light||activeObject;if(l.distance!==undefined){l.distance=v;saveStateDebounced();}} });
    lightDistanceNum.addEventListener('input', e => { const v=parseFloat(e.target.value); lightDistance.value=v; if(activeObject&&isLight(activeObject)){const l=activeObject.userData.light||activeObject;if(l.distance!==undefined){l.distance=v;saveStateDebounced();}} });
}

// ==================== MATERIAL ====================
function updateMaterialPanel() {
    if (!materialNoSelection || !materialControls) return;
    const meshes = activeObject ? getMeshesFromObject(activeObject) : [];
    if (meshes.length > 0) {
        materialNoSelection.style.display = 'none'; materialControls.style.display = 'block';
        const mat = meshes[0].material; const m = Array.isArray(mat) ? mat[0] : mat;
        if (matColor) matColor.value = '#' + (m.color?.getHexString() ?? 'ffffff');
        if (matRoughness) { matRoughness.value = m.roughness ?? 0.5; if (matRoughnessNum) matRoughnessNum.value = m.roughness ?? 0.5; }
        if (matMetalness) { matMetalness.value = m.metalness ?? 0; if (matMetalnessNum) matMetalnessNum.value = m.metalness ?? 0; }
        if (matEmissive) matEmissive.value = '#' + (m.emissive?.getHexString() ?? '000000');
        if (matEmissiveIntensity) { matEmissiveIntensity.value = m.emissiveIntensity ?? 1; if (matEmissiveIntensityNum) matEmissiveIntensityNum.value = m.emissiveIntensity ?? 1; }
        if (matBloomToggle) matBloomToggle.checked = activeObject.layers.test(bloomLayer);
        if (m.transparent) { if (matTransparent) matTransparent.checked = true; if (matOpacity) { matOpacity.disabled = false; matOpacity.value = m.opacity; } if (matOpacityNum) { matOpacityNum.disabled = false; matOpacityNum.value = m.opacity; } }
        else { if (matTransparent) matTransparent.checked = false; if (matOpacity) matOpacity.disabled = true; if (matOpacityNum) matOpacityNum.disabled = true; }
        if (outlineToggle) outlineToggle.checked = !!activeObject.userData.outlineLines;
        if (outlineColor) outlineColor.value = activeObject.userData.outlineColor || '#ffffff';
    } else { materialNoSelection.style.display = 'block'; materialControls.style.display = 'none'; }
}
function applyMaterialChange(prop, val) { if (!activeObject) return; getMeshesFromObject(activeObject).forEach(mesh => { if (!mesh.material) return; const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; mats.forEach(m => { m[prop] = val; m.needsUpdate = true; }); }); saveStateDebounced(); }
if (matColor) matColor.addEventListener('input', e => applyMaterialChange('color', new THREE.Color(e.target.value)));
if (matTransparent) matTransparent.addEventListener('change', e => { const c=e.target.checked; if(matOpacity)matOpacity.disabled=!c; if(matOpacityNum)matOpacityNum.disabled=!c; applyMaterialChange('transparent',c); if(!c){applyMaterialChange('opacity',1);if(matOpacity)matOpacity.value=1;if(matOpacityNum)matOpacityNum.value=1;} });
if (matOpacity && matOpacityNum) { matOpacity.addEventListener('input', e => { const v=parseFloat(e.target.value); matOpacityNum.value=v; applyMaterialChange('opacity',v); }); matOpacityNum.addEventListener('input', e => { const v=parseFloat(e.target.value); matOpacity.value=v; applyMaterialChange('opacity',v); }); }
if (matRoughness && matRoughnessNum) { matRoughness.addEventListener('input', e => { const v=parseFloat(e.target.value); matRoughnessNum.value=v; applyMaterialChange('roughness',v); }); matRoughnessNum.addEventListener('input', e => { const v=parseFloat(e.target.value); matRoughness.value=v; applyMaterialChange('roughness',v); }); }
if (matMetalness && matMetalnessNum) { matMetalness.addEventListener('input', e => { const v=parseFloat(e.target.value); matMetalnessNum.value=v; applyMaterialChange('metalness',v); }); matMetalnessNum.addEventListener('input', e => { const v=parseFloat(e.target.value); matMetalness.value=v; applyMaterialChange('metalness',v); }); }
if (matEmissive) matEmissive.addEventListener('input', e => applyMaterialChange('emissive', new THREE.Color(e.target.value)));
if (matEmissiveIntensity && matEmissiveIntensityNum) { matEmissiveIntensity.addEventListener('input', e => { const v=parseFloat(e.target.value); matEmissiveIntensityNum.value=v; applyMaterialChange('emissiveIntensity',v); }); matEmissiveIntensityNum.addEventListener('input', e => { const v=parseFloat(e.target.value); matEmissiveIntensity.value=v; applyMaterialChange('emissiveIntensity',v); }); }
if (matBloomToggle) matBloomToggle.addEventListener('change', e => { if (activeObject) { getMeshesFromObject(activeObject).forEach(m => { if (e.target.checked) m.layers.enable(1); else m.layers.disable(1); }); invalidateBloomCache(); saveState(); } });
if (outlineToggle) outlineToggle.addEventListener('change', e => { if (activeObject) { getMeshesFromObject(activeObject).forEach(m => updateOutline(m, e.target.checked, outlineColor ? outlineColor.value : '#ffffff')); saveState(); } });
if (outlineColor) outlineColor.addEventListener('input', e => { if (activeObject && activeObject.userData.outlineLines) { getMeshesFromObject(activeObject).forEach(m => { if (m.userData.outlineLines) updateOutline(m, true, e.target.value); }); saveStateDebounced(); } });
function loadTextureFromInput(input, prop) { if (!activeObject) return; const meshes = getMeshesFromObject(activeObject); if (!meshes.length || !input.files[0]) return; const reader = new FileReader(); reader.onload = e => { textureLoader.load(e.target.result, tex => { tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); tex.needsUpdate = true; meshes.forEach(m => { if (!m.material) return; const mats = Array.isArray(m.material) ? m.material : [m.material]; mats.forEach(mat => { mat[prop] = tex; mat.needsUpdate = true; }); }); saveState(); }); }; reader.readAsDataURL(input.files[0]); }
if (matDiffuse && clearDiffuse) {
    matDiffuse.addEventListener('change', e => loadTextureFromInput(e.target, 'map'));
    clearDiffuse.addEventListener('click', () => { if (!activeObject) return; getMeshesFromObject(activeObject).forEach(m => { if (!m.material) return; const mats = Array.isArray(m.material) ? m.material : [m.material]; mats.forEach(mat => { mat.map = null; mat.needsUpdate = true; }); }); matDiffuse.value = ''; saveState(); });
}

// ==================== PARTÍCULAS ====================
function updateParticlePanel() {
    if (!particleNoSelection || !particleControls) return;
    const isP = activeObject && isParticleSystem(activeObject);
    if (isP) {
        particleNoSelection.style.display = 'none';
        particleControls.style.display    = 'block';
        if (particleColor && activeObject.particleColor) particleColor.value = activeObject.particleColor;
        if (particleBrightness && activeObject.brightness !== undefined) {
            particleBrightness.value = activeObject.brightness;
            if (particleBrightnessNum) particleBrightnessNum.value = activeObject.brightness;
        }
        if (particleOpacity && activeObject.opacity !== undefined) {
            particleOpacity.value = activeObject.opacity;
            if (particleOpacityNum) particleOpacityNum.value = activeObject.opacity;
        }
        const _sf = document.getElementById('particle-spawn-frame');
        const _hf = document.getElementById('particle-hide-frame');
        if (_sf) _sf.value = activeObject.userData.spawnFrame ?? '';
        if (_hf) _hf.value = activeObject.userData.hideFrame  ?? '';

        // Seção bake — só para explosões
        const bakeSection = document.getElementById('explosion-bake-section');
        if (bakeSection) {
            const isExp = activeObject.userData?.particleType === 'explosion';
            bakeSection.style.display = isExp ? 'block' : 'none';
            if (isExp) {
                const startEl = document.getElementById('bake-start-frame');
                if (startEl && activeObject._bakedTLStart !== undefined)
                    startEl.value = activeObject._bakedTLStart;
                else if (startEl)
                    startEl.value = activeObject.userData.spawnFrame ?? 0;

                const statusEl = document.getElementById('bake-status');
                if (statusEl) {
                    if (activeObject.isBaked) {
                        statusEl.textContent = `✅ ${activeObject._bakedFrames.length} frames @ ${activeObject._bakedFPS}fps`;
                        statusEl.style.color = '#88ff88';
                    } else {
                        statusEl.textContent = '— Sem bake';
                        statusEl.style.color = 'rgba(255,255,255,0.4)';
                    }
                }
            }
        }
    } else {
        particleNoSelection.style.display = 'block';
        particleControls.style.display    = 'none';
    }
}
if(particleColor) particleColor.addEventListener('input',e=>{if(activeObject&&typeof activeObject.setColor==='function')activeObject.setColor(e.target.value);saveStateDebounced();});
if(particleBrightness&&particleBrightnessNum){particleBrightness.addEventListener('input',e=>{const v=parseFloat(e.target.value);particleBrightnessNum.value=v;if(activeObject&&typeof activeObject.setBrightness==='function')activeObject.setBrightness(v);saveStateDebounced();});particleBrightnessNum.addEventListener('input',e=>{const v=parseFloat(e.target.value);particleBrightness.value=v;if(activeObject&&typeof activeObject.setBrightness==='function')activeObject.setBrightness(v);saveStateDebounced();});}
if(particleOpacity&&particleOpacityNum){particleOpacity.addEventListener('input',e=>{const v=parseFloat(e.target.value);particleOpacityNum.value=v;if(activeObject&&typeof activeObject.setOpacity==='function')activeObject.setOpacity(v);saveStateDebounced();});particleOpacityNum.addEventListener('input',e=>{const v=parseFloat(e.target.value);particleOpacity.value=v;if(activeObject&&typeof activeObject.setOpacity==='function')activeObject.setOpacity(v);saveStateDebounced();});}

// ── Spawnar / sumir partícula em frame específico ──────────────────────────
(function() {
    const spawnBtn   = document.getElementById('particle-spawn-btn');
    const spawnInput = document.getElementById('particle-spawn-frame');
    const hideBtn    = document.getElementById('particle-hide-btn');
    const hideInput  = document.getElementById('particle-hide-frame');
    const clearSpawn = document.getElementById('particle-spawn-clear');
    const clearHide  = document.getElementById('particle-hide-clear');

    function flash(btn) { btn.innerHTML = '✔'; setTimeout(() => { btn.textContent = '▶ Definir'; }, 900); }

    if (spawnBtn && spawnInput) {
        spawnBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (!activeObject || !isParticleSystem(activeObject)) return;
            const frame = parseInt(spawnInput.value);
            if (isNaN(frame) || frame < 0) return;
            activeObject.userData.spawnFrame = frame;
            // Se o frame atual já passou do spawnFrame, re-adiciona imediatamente
            _syncParticleToFrame(activeObject, window.AnimationSystem ? window.AnimationSystem.getFrame() : 0, true);
            flash(spawnBtn);
        });
    }
    if (clearSpawn) {
        clearSpawn.addEventListener('click', e => {
            e.stopPropagation();
            if (!activeObject) return;
            delete activeObject.userData.spawnFrame;
            // Garante que está na cena
            if (!activeObject.parent) { scene.add(activeObject); if (!particleSystems.includes(activeObject)) particleSystems.push(activeObject); }
            if (spawnInput) spawnInput.value = '';
        });
    }
    if (hideBtn && hideInput) {
        hideBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (!activeObject || !isParticleSystem(activeObject)) return;
            const frame = parseInt(hideInput.value);
            if (isNaN(frame) || frame < 0) return;
            activeObject.userData.hideFrame = frame;
            _syncParticleToFrame(activeObject, window.AnimationSystem ? window.AnimationSystem.getFrame() : 0, false);
            flash(hideBtn);
        });
    }
    if (clearHide) {
        clearHide.addEventListener('click', e => {
            e.stopPropagation();
            if (!activeObject) return;
            delete activeObject.userData.hideFrame;
            if (!activeObject.parent) { scene.add(activeObject); if (!particleSystems.includes(activeObject)) particleSystems.push(activeObject); }
            if (hideInput) hideInput.value = '';
        });
    }
})();

// ── Reset interno da partícula para nascer do zero ────────────────────────────
function _resetParticleState(obj) {
    // Explosão tem reset() próprio que cuida de tudo corretamente
    if (typeof obj.reset === 'function') {
        obj.reset();
        return;
    }
    // Fire — tem _staggerAll
    if (typeof obj._staggerAll === 'function') {
        obj.time = 0;
        obj._staggerAll();
    }
    // Laser / Electricity — têm time
    if (obj.time !== undefined) obj.time = 0;
    // Reinicia clock
    ['_clock','clock'].forEach(k => { if (obj[k] && typeof obj[k].start === 'function') obj[k].start(); });
    // Zera todos os pools genéricos
    ['coreP','bodyP','wispP','emberP','smokeP','trailP'].forEach(key => {
        const pool = obj[key];
        if (!pool || !pool.data) return;
        pool.data.forEach(d => { d.life = 1.0; d.active = false; });
        if (pool.sprites) pool.sprites.forEach(sp => { if (sp.material) sp.material.opacity = 0; });
    });
}

// ── Sincroniza um objeto de partícula com o frame atual ───────────────────────
function _syncParticleToFrame(obj, frame, forceReset) {
    const sf = obj.userData.spawnFrame;
    const hf = obj.userData.hideFrame;
    const shouldBeActive =
        (sf === undefined || frame >= sf) &&
        (hf === undefined || frame <  hf);

    const isActive = !!obj.parent; // está na cena?

    if (shouldBeActive && !isActive) {
        // Entra na cena e reseta (nasce do zero)
        scene.add(obj);
        if (!particleSystems.includes(obj)) particleSystems.push(obj);
        _resetParticleState(obj);
        markDirty(2);
    } else if (!shouldBeActive && isActive) {
        // Sai da cena e para de atualizar
        scene.remove(obj);
        const pi = particleSystems.indexOf(obj);
        if (pi > -1) particleSystems.splice(pi, 1);
        markDirty(2);
    } else if (shouldBeActive && forceReset) {
        // Já está na cena mas pediu reset explícito (ao definir spawnFrame)
        _resetParticleState(obj);
        markDirty(2);
    }
}

// Cache dos objetos que precisam de visibilidade por frame (evita iterar sceneObjects inteiro todo frame)
const _framedParticles = new Set();
function _registerFramedParticle(obj)   { _framedParticles.add(obj); }
function _unregisterFramedParticle(obj) { _framedParticles.delete(obj); }

// ── Roda a cada frame pela animate loop ──────────────────────────────────────
function applyParticleFrameVisibility(frame) {
    // Usa o cache — só processa partículas que têm spawnFrame ou hideFrame definidos
    _framedParticles.forEach(obj => {
        if (obj.userData.spawnFrame === undefined && obj.userData.hideFrame === undefined) {
            _framedParticles.delete(obj); return; // saiu de cena — limpa do cache
        }
        _syncParticleToFrame(obj, frame, false);
    });
    // Fallback: garante que novos objetos sejam registrados se ainda não estão no cache
    sceneObjects.forEach(obj => {
        if (!isParticleSystem(obj)) return;
        if ((obj.userData.spawnFrame !== undefined || obj.userData.hideFrame !== undefined) && !_framedParticles.has(obj)) {
            _framedParticles.add(obj);
        }
    });
}

// ==================== BLOOM ====================
const params = { bloomStrength: 0.45, bloomRadius: 0.65, bloomThreshold: 0.28 };
function setupPostControl(inp, num, key) { if(!inp||!num)return; const upd=v=>{params[key]=v;if(bloomPass){bloomPass.strength=params.bloomStrength;bloomPass.radius=params.bloomRadius;bloomPass.threshold=params.bloomThreshold;}markDirty(2);}; inp.addEventListener('input',e=>{const v=parseFloat(e.target.value);num.value=v;upd(v);}); num.addEventListener('input',e=>{const v=parseFloat(e.target.value);inp.value=v;upd(v);}); }
setupPostControl(bloomStrength, bloomStrengthNum, 'bloomStrength');
setupPostControl(bloomRadius,   bloomRadiusNum,   'bloomRadius');
setupPostControl(bloomThreshold,bloomThresholdNum,'bloomThreshold');

// ==================== POST-EFFECTS WIRING ====================
// helpers
function _pCtrl(id, uKey) {
    const upd = v => { _postU[uKey].value = parseFloat(v); markDirty(2); };
    const rEl = document.getElementById(id);
    const nEl = document.getElementById(id + '-num');
    if (rEl) rEl.addEventListener('input', e => { upd(e.target.value); if (nEl) nEl.value = e.target.value; });
    if (nEl) nEl.addEventListener('input', e => { upd(e.target.value); if (rEl) rEl.value = e.target.value; });
}
function _pToggle(id, uKey, ctrlId) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', e => {
        _postU[uKey].value = e.target.checked ? 1.0 : 0.0;
        if (ctrlId) { const c = document.getElementById(ctrlId); if (c) c.style.display = e.target.checked ? '' : 'none'; }
        // Toggle active style on parent row
        const row = document.getElementById(id.replace('-toggle', '-effect-row'));
        if (row) row.classList.toggle('effect-active', e.target.checked);
        markDirty(2);
    });
}
function _pColor(id, uKey) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', e => { _postU[uKey].value.set(e.target.value); markDirty(2); });
}
function _pSeg(id, uKey) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', e => {
        const btn = e.target.closest('.seg-btn'); if (!btn) return;
        _postU[uKey].value = parseFloat(btn.dataset.val);
        el.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('seg-active', b === btn));
        markDirty(2);
    });
}

// RT / SSAO / SSR (originais)
_pToggle('raytracing-toggle', 'rtEnabled', 'raytracing-controls');
_pCtrl('ssao-radius',    'ssaoRadius');
_pCtrl('ssao-intensity', 'ssaoIntensity');
_pCtrl('ssr-intensity',  'ssrIntensity');
_pCtrl('gi-bias',        'giBias');
if (document.getElementById('ssao-samples'))   _pCtrl('ssao-samples',  'ssaoSamples');
if (document.getElementById('ssao-bias'))       _pCtrl('ssao-bias',     'ssaoBias');
if (document.getElementById('ssr-steps'))       _pCtrl('ssr-steps',     'ssrSteps');
if (document.getElementById('gi-bounce'))       _pCtrl('gi-bounce',     'giBounce');
if (document.getElementById('ssr-roughness'))   _pCtrl('ssr-roughness', 'ssrRoughness');
// RT Quality preset (novo)
const _rtQualSeg = document.getElementById('rt-quality-seg');
if (_rtQualSeg) _rtQualSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn'); if (!btn) return;
    _rtQualSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('seg-active', b === btn));
    const presets = { fast:{ssaoSamples:4,ssrSteps:8,ssaoBias:0.02}, medium:{ssaoSamples:16,ssrSteps:32,ssaoBias:0.015}, high:{ssaoSamples:32,ssrSteps:64,ssaoBias:0.01}, ultra:{ssaoSamples:64,ssrSteps:128,ssaoBias:0.005} };
    const p = presets[btn.dataset.val]; if (!p) return;
    Object.entries(p).forEach(([k,v]) => { if(_postU[k]) _postU[k].value = v; });
    setTimeout(() => _snapshotPostQuality(), 50); // atualiza snapshot quando usuário muda preset
    markDirty(2);
});

// ── Snapshot inicial de qualidade (após 1s para garantir que todos os controles estejam prontos) ──
// O sistema adaptativo usa esse snapshot para restaurar os valores quando a cena estabiliza.
setTimeout(() => _snapshotPostQuality(), 1000);
['ssao-samples','ssr-steps','vf-steps','vol-steps-num'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => setTimeout(_snapshotPostQuality, 50));
});

// DOF Bokeh
_pToggle('dof-toggle', 'dofEnabled', 'dof-controls');
_pCtrl('dof-focus',   'dofFocus');
_pCtrl('dof-range',   'dofRange');
_pCtrl('dof-bokeh',   'dofBokeh');
_pCtrl('dof-blades',  'dofBlades');

// Chromatic Aberration
_pToggle('chroma-toggle', 'chromaEnabled', 'chroma-controls');
_pCtrl('chroma-intensity', 'chromaIntensity');
_pCtrl('chroma-edge',      'chromaEdge');

// Film Grain
_pToggle('grain-toggle', 'grainEnabled', 'grain-controls');
_pCtrl('grain-intensity', 'grainIntensity');
_pCtrl('grain-size',      'grainSize');
const _grainAnim = document.getElementById('grain-animated');
if (_grainAnim) _grainAnim.addEventListener('change', e => { _postU.grainAnimated.value = e.target.checked ? 1.0 : 0.0; markDirty(2); });

// Vignette
_pToggle('vignette-toggle', 'vignetteEnabled', 'vignette-controls');
_pCtrl('vignette-offset',   'vignetteOffset');
_pCtrl('vignette-darkness', 'vignetteDarkness');
_pColor('vignette-color',   'vignetteColor');

// Color Grading
_pToggle('colorgrade-toggle', 'cgEnabled', 'colorgrade-controls');
_pSeg('cg-tonemap',      'cgTonemap');
_pCtrl('cg-exposure',    'cgExposure');
_pCtrl('cg-contrast',    'cgContrast');
_pCtrl('cg-saturation',  'cgSaturation');
_pCtrl('cg-temperature', 'cgTemperature');
_pCtrl('cg-tint',        'cgTint');

// ==================== PROGRESSIVE RENDERING (TAA REAL) ====================
// Funciona igual ao Blender Cycles: cena sempre visível, ruído some sample a sample.
// Cada frame aplica jitter sub-pixel (Halton) e mistura no buffer acumulado.
let _accSamples=64, _accSubSamples=1, _accDenoisePasses=2, _accDenoiseRadius=2;
let _accFilter='box', _accJitter='halton', _accFrame=0, _accRunning=false, _accPaused=false;

function _syncAccProgress() {
    const prog = _taa.getProgress();
    const fill = document.getElementById('acc-progress-fill');
    const text = document.getElementById('acc-progress-text');
    if (fill) fill.style.width = (prog.pct * 100) + '%';
    if (text) text.textContent = prog.running
        ? `${prog.frame}/${prog.total} samples · renderizando…`
        : prog.frame >= prog.total ? `✅ ${prog.total} samples concluídos` : 'Pausado';
}
function _startAcc() {
    _taa.start(_accSamples);
    _syncAccProgress();
    markDirty(2);
}

const _sampToggle = document.getElementById('samples-toggle');
if (_sampToggle) _sampToggle.addEventListener('change', e => {
    const on = e.target.checked;
    const body = document.getElementById('samples-controls');
    if (body) body.style.display = on ? '' : 'none';
    if (on) _startAcc(); else { _taa.stop(); _syncAccProgress(); }
    markDirty(2);
});

_pCtrl('acc-samples', 'ssaoSamples');
document.getElementById('acc-samples')?.addEventListener('input', e => {
    _accSamples = parseInt(e.target.value); _syncAccProgress();
});
document.getElementById('acc-samples-num')?.addEventListener('input', e => {
    _accSamples = parseInt(e.target.value);
    const el = document.getElementById('acc-samples'); if (el) el.value = e.target.value;
    _syncAccProgress();
});
document.getElementById('acc-subsamples')?.addEventListener('input', e => { _accSubSamples = parseInt(e.target.value); });
document.getElementById('acc-subsamples-num')?.addEventListener('input', e => { _accSubSamples = parseInt(e.target.value); });
document.getElementById('acc-denoise-passes')?.addEventListener('input', e => { _accDenoisePasses = parseInt(e.target.value); });
document.getElementById('acc-denoise-radius')?.addEventListener('input', e => { _accDenoiseRadius = parseFloat(e.target.value); });

document.getElementById('acc-reset-btn')?.addEventListener('click', () => {
    _taa.stop();
    setTimeout(() => _startAcc(), 50); // pequeno delay pra garantir cleanup
});
document.getElementById('acc-pause-btn')?.addEventListener('click', () => {
    _taa.togglePause();
    const btn = document.getElementById('acc-pause-btn');
    const prog = _taa.getProgress();
    if (btn) btn.textContent = prog.paused ? '▶ Retomar' : '⏸ Pausar';
    _syncAccProgress();
});
const _accFilterSeg = document.getElementById('acc-filter-seg');
if (_accFilterSeg) _accFilterSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn'); if (!btn) return;
    _accFilterSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('seg-active', b === btn));
    _accFilter = btn.dataset.val; markDirty(2);
});
const _accJitterSeg = document.getElementById('acc-jitter-seg');
if (_accJitterSeg) _accJitterSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn'); if (!btn) return;
    _accJitterSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('seg-active', b === btn));
    _accJitter = btn.dataset.val; markDirty(2);
});

// Soft Shadows
_pToggle('softshadow-toggle', 'ssEnabled', 'softshadow-controls');
_pCtrl('ss-lightsize',   'ssLightSize');
_pCtrl('ss-samples',     'ssSamples');
_pCtrl('ss-maxpenumbra', 'ssMaxPenumbra');
_pCtrl('ss-softness',    'ssSoftness');
const _ssKernelSeg = document.getElementById('ss-kernel-seg');
if (_ssKernelSeg) _ssKernelSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn'); if (!btn) return;
    _ssKernelSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('seg-active', b === btn));
    markDirty(2);
});

// Volumetric Fog avançado
_pToggle('volfog-toggle', 'vfEnabled', 'volfog-controls');
_pCtrl('vf-density',    'vfDensity');
_pCtrl('vf-scatter',    'vfScatter');
_pCtrl('vf-maxheight',  'vfMaxHeight');
_pCtrl('vf-falloff',    'vfFalloff');
_pCtrl('vf-noisescale', 'vfNoiseScale');
_pCtrl('vf-noisespeed', 'vfNoiseSpeed');
_pCtrl('vf-steps',      'vfSteps');
_pCtrl('vf-aniso',      'vfAniso');
_pColor('vf-color',     'vfColor');

// Advanced Engine
_pToggle('advengine-toggle', 'aeEnabled', 'advengine-controls');
_pCtrl('ae-taa',      'aeTAA');
_pCtrl('ae-gi',       'aeGI');
_pCtrl('ae-ibl',      'aeIBL');
_pCtrl('ae-caustics', 'aeCaustics');
_pCtrl('ae-sss',      'aeSSS');
_pCtrl('ae-contact',  'aeContact');
// Pipeline seg
const _aePipelineSeg = document.getElementById('ae-pipeline-seg');
if (_aePipelineSeg) _aePipelineSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn'); if (!btn) return;
    _aePipelineSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('seg-active', b === btn));
    const stats = document.getElementById('ae-stats');
    if (stats) stats.textContent = `Pipeline: ${btn.dataset.val} · TAA: ON · GI: ${_postU.aeGI?.value > 0.1 ? 'ON' : 'OFF'}`;
    markDirty(2);
});
const _aeQualSeg = document.getElementById('ae-quality-seg');
if (_aeQualSeg) _aeQualSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn'); if (!btn) return;
    _aeQualSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('seg-active', b === btn));
    const presets = {
        low:       { aeTAA:0.5, aeGI:0.0,  aeIBL:0.5, aeCaustics:0.0, aeSSS:0.0, aeContact:0.2 },
        medium:    { aeTAA:0.9, aeGI:0.6,  aeIBL:1.0, aeCaustics:0.0, aeSSS:0.0, aeContact:0.5 },
        high:      { aeTAA:0.95,aeGI:1.0,  aeIBL:1.5, aeCaustics:0.3, aeSSS:0.2, aeContact:0.7 },
        cinematic: { aeTAA:0.98,aeGI:1.5,  aeIBL:2.0, aeCaustics:0.6, aeSSS:0.5, aeContact:1.0 },
    };
    const p = presets[btn.dataset.val]; if (!p) return;
    Object.entries(p).forEach(([k, v]) => {
        if (_postU[k]) { _postU[k].value = v; }
        const el = document.getElementById(`ae-${k.replace('ae','').toLowerCase()}-num`);
        if (el) el.value = v;
    });
    markDirty(2);
});
// Volumetric Light
const _volToggle = document.getElementById('volumetric-toggle');
if (_volToggle) {
    _volToggle.addEventListener('change', e => {
        const on = e.target.checked;
        if (activeObject?.userData?.isLight) {
            if (!activeObject.userData.volumetric) activeObject.userData.volumetric = {};
            activeObject.userData.volumetric.enabled = on;
        }
        _postU.volEnabled.value = on ? 1.0 : 0.0;
        const vc = document.getElementById('volumetric-controls');
        if (vc) vc.style.display = on ? '' : 'none';
        markDirty(2);
    });
}
_pCtrl('vol-density', 'volDensity');
_pCtrl('vol-scatter', 'volScatter');
_pColor('vol-color',  'volColor');
// vol-steps via seg-control
const _volStepsSeg = document.getElementById('vol-steps-seg');
if (_volStepsSeg) {
    _volStepsSeg.addEventListener('click', e => {
        const btn = e.target.closest('.seg-btn'); if (!btn) return;
        _postU.volSteps.value = parseFloat(btn.dataset.val);
        _volStepsSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('seg-active', b === btn));
        const vn = document.getElementById('vol-steps-num'); if (vn) vn.value = btn.dataset.val;
        markDirty(2);
    });
}

// ==================== NIGHT / DAY MODE ====================
const _modeNightLights = [];

function _removeNightLights() {
    _modeNightLights.forEach(l => scene.remove(l));
    _modeNightLights.length = 0;
}

function _makeSunLight(px, py, pz, tx, ty, tz) {
    const l = new THREE.DirectionalLight(0xffffff, 0.5);
    l.position.set(px, py, pz);
    l.target.position.set(tx, ty, tz);
    l.userData.isDefaultLight = true;
    l.target.userData.isDefaultLight = true;
    scene.add(l);
    scene.add(l.target);
    _modeNightLights.push(l, l.target);
    return l;
}

function applyNightMode() {
    // Desliga luzes padrão
    ambientLight.intensity = 0.15;
    dirLight.intensity     = 0;
    fillLight.intensity    = 0;
    scene.background       = new THREE.Color(0x111122);
    // IBL baixo no night mode — reflexos sutis sem clarear a cena
    if (scene.environmentIntensity !== undefined) scene.environmentIntensity = 0.12;

    _removeNightLights();

    // 6 luzes sol brancas 0.5 — uma por direção (estilo ilhm doodles)
    const d = 30;
    _makeSunLight(  0,  d,  0,  0, 0,  0);
    _makeSunLight(  0, -d,  0,  0, 0,  0);
    _makeSunLight( -d,  0,  0,  0, 0,  0);
    _makeSunLight(  d,  0,  0,  0, 0,  0);
    _makeSunLight(  0,  0,  d,  0, 0,  0);
    _makeSunLight(  0,  0, -d,  0, 0,  0);

    const nb = document.getElementById('night-mode-btn');
    const db = document.getElementById('day-mode-btn');
    if (nb) nb.classList.add('night-active');
    if (db) db.classList.remove('night-active');

    invalidateBloomCache(); requestShadowUpdate(); markDirty(4);
}

function applyDayMode() {
    ambientLight.intensity = 0.8;
    dirLight.intensity     = 1.8;
    fillLight.intensity    = 0.4;
    scene.background       = new THREE.Color(0x111122);
    // IBL moderado no day mode
    if (scene.environmentIntensity !== undefined) scene.environmentIntensity = 0.30;

    _removeNightLights();

    const nb = document.getElementById('night-mode-btn');
    const db = document.getElementById('day-mode-btn');
    if (nb) nb.classList.remove('night-active');
    if (db) db.classList.add('night-active');

    invalidateBloomCache(); requestShadowUpdate(); markDirty(4);
}

const _nightBtn = document.getElementById('night-mode-btn');
const _dayBtn   = document.getElementById('day-mode-btn');
if (_nightBtn) _nightBtn.addEventListener('click', e => { e.stopPropagation(); applyNightMode(); });
if (_dayBtn)   _dayBtn.addEventListener('click',   e => { e.stopPropagation(); applyDayMode();  });


// ==================== LOOP PRINCIPAL ====================
// _interacting: usado pelo PerfMon para não reduzir DPR durante interação
let _interacting = false;
controls.addEventListener('start', () => { _interacting = true; });
controls.addEventListener('end',   () => { setTimeout(() => { _interacting = false; }, 350); });

// ==================== MONITOR DE PERFORMANCE ADAPTATIVA ====================
// Reduz DPR automaticamente se o FPS cair abaixo do limite — salva frames em mobile pesado
const _perfMon = (() => {
    const TARGET_FPS = 30;
    const CHECK_INTERVAL = 3000; // ms entre checks
    const MIN_DPR = isMobile ? 0.65 : 0.75;
    let _lastCheck = 0, _frames = 0, _lastFPS = 60;
    let _currentDPR = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
    let _reduced = false;

    function tick(now) {
        _frames++;
        if (now - _lastCheck > CHECK_INTERVAL) {
            _lastFPS = _frames / ((now - _lastCheck) / 1000);
            _frames = 0; _lastCheck = now;
            if (_lastFPS < TARGET_FPS && _currentDPR > MIN_DPR && !_interacting) {
                _currentDPR = Math.max(MIN_DPR, _currentDPR - 0.25);
                renderer.setPixelRatio(_currentDPR);
                _reduced = true;
            } else if (_reduced && _lastFPS > 50 && !_interacting) {
                const maxDPR = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
                _currentDPR = Math.min(maxDPR, _currentDPR + 0.15);
                renderer.setPixelRatio(_currentDPR);
                if (_currentDPR >= maxDPR) _reduced = false;
            }
        }
    }
    return { tick };
})();

const PARTICLE_DELTA_MS = 1000 / 60;
let _frameCount = 0, _dirty = true, _dirtyFrames = 2;
function markDirty(extraFrames = 2) {
    _dirty = true;
    _dirtyFrames = Math.max(_dirtyFrames, extraFrames);
}
// Injeta markDirty nos módulos dependentes
_ppSetMarkDirtyRef(markDirty);
_rnSetMarkDirtyRef(markDirty);
_rnSetBoneLayer(2);
controls.addEventListener('change', () => {
    markDirty(4);
    // Se TAA estiver rodando e a câmera mexeu, reseta — senão fica com ghost
    if (_taa.isActive()) { _taa.stop(); setTimeout(() => _startAcc(), 100); }
});

let _shadowPending = false;
function requestShadowUpdate() { _shadowPending = true; }
controls.addEventListener('change', requestShadowUpdate);

// ── Shadow throttling ────────────────────────────────────────────────────────
// Atualiza o shadow map no máximo 1x a cada 3 frames quando a câmera está parada.
// Quando a câmera se move ou há mudança na cena, atualiza imediatamente.
let _shadowThrottleFrame = 0;
const SHADOW_THROTTLE = 3; // frames entre updates quando parado

// ── FPS cap (30fps mode) ─────────────────────────────────────────────────────
// Controlado pelo toggle no painel Settings. Quando ativo, pula frames alternados
// para manter ~30fps e liberar CPU/GPU para cenas pesadas.
let _fpsCap30 = false;
window._setFpsCap30 = v => { _fpsCap30 = !!v; };

const _animCamWPos  = new THREE.Vector3();
const _animCamWQuat = new THREE.Quaternion();
const _animCamEuler = new THREE.Euler(0, 0, 0, 'YXZ');

let _lastTimestamp = 0;

function animate(timestamp = 0) {
    requestAnimationFrame(animate);
    _frameCount++;
    _perfMon.tick(timestamp);
    _frameBudget.tick(timestamp);
    if (_pauseRender || window._nexusPauseRender) return;
    _postU.time.value = timestamp * 0.001;

    // ── FPS cap 30: pula frames pares quando ativo ──
    if (_fpsCap30 && (_frameCount & 1) === 0) return;

    const delta = Math.min((timestamp - _lastTimestamp) / 1000, 0.1);
    _lastTimestamp = timestamp;

    if (!povActive) {
        const cameraMoved = controls.update();
        if (cameraMoved) markDirty(4);
    } else {
        updatePOV(delta);
        markDirty(1);
    }

    if (particleSystems.length > 0) {
        for (let i = 0; i < particleSystems.length; i++) { if (particleSystems[i].update) particleSystems[i].update(PARTICLE_DELTA_MS); }
        markDirty(1);
    }
    if (window.PhysicsSystem?.isSimulating) { window.PhysicsSystem.update(PARTICLE_DELTA_MS); markDirty(1); }
    // Particle Lab systems
    if (window._nexusParticleLab) { window._nexusParticleLab.update(PARTICLE_DELTA_MS / 1000); markDirty(1); }

    if (window.SpecialFX) { window.SpecialFX.update(delta); markDirty(1); }
    if (window._modelingFrameUpdate) window._modelingFrameUpdate();
    if (window.AnimationSystem) {
        window.AnimationSystem.update(timestamp);

        // Só suja o frame se a animação estiver tocando — evita render desnecessário quando parado
        if (window.AnimationSystem.isPlaying()) {
            if (povActive && povCamera) {
                const kfs = window.AnimationSystem.getState().keyframes;
                if (kfs[povCamera.uuid]) {
                    povCamera.getWorldPosition(_animCamWPos);
                    povCamera.getWorldQuaternion(_animCamWQuat);
                    camera.position.copy(_animCamWPos);
                    camera.quaternion.copy(_animCamWQuat);
                    _animCamEuler.setFromQuaternion(_animCamWQuat, 'YXZ');
                    povYaw   = _animCamEuler.y;
                    povPitch = _animCamEuler.x;
                }
            }
            markDirty(1);
        }
    }

    // Aparecimento/sumida de partícula por frame — roda depois do AnimationSystem para ter o frame correto
    applyParticleFrameVisibility(
        window.AnimationSystem ? window.AnimationSystem.getFrame() : 0
    );

    // Atualiza LOD — troca nível de detalhe por distância da câmera (custo mínimo)
    if (_lodObjects.length > 0) updateAllLOD();

    // Atualiza bone helpers apenas quando a cena está mudando (evita trabalho extra em idle)
    const _bonesNeedUpdate = boneHelpers.length > 0 && (_dirty || _dirtyFrames > 0 || (window.AnimationSystem?.isPlaying())) && (_frameCount & 1) === 0;
    if (_bonesNeedUpdate) { updateBoneHelpers(); markDirty(1); }

    // ── Shadow throttling ─────────────────────────────────────────────────────
    // Câmera movendo ou mudança explícita → atualiza imediatamente.
    // Câmera parada → atualiza 1x a cada SHADOW_THROTTLE frames (economiza GPU).
    if (_shadowPending && sceneObjects.length > 0) {
        const camMoving = _dirty && _dirtyFrames > 2; // heurística: dirty com frames altos = câmera mexendo
        _shadowThrottleFrame++;
        if (camMoving || _shadowThrottleFrame >= SHADOW_THROTTLE) {
            renderer.shadowMap.needsUpdate = true;
            _shadowPending = false;
            _shadowThrottleFrame = 0;
        }
    }

    if (_dirty || _dirtyFrames > 0) {
        // Quando TAA está renderizando, ele cuida do display — não chama smartRender
        if (!_taa.isActive()) {
            const _skipExpensive = _frameBudget.shouldSkipPost(_frameCount);
            smartRender(_skipExpensive);
        }
        if (_dirtyFrames > 0) _dirtyFrames--; else _dirty = false;
    }
    // TAA progressive rendering — 1 sample por frame quando ativo
    // Sempre roda (independente de _dirty) para acumular continuamente
    // TAA: 1 sample por frame. Quando activo, renderSample() cuida do display.
    // Quando termina, para de sujar — smartRender() não sobrescreve o resultado.
    if (_taa.isRunning()) {
        _taa.renderSample();
        if (_taa.isRunning()) markDirty(1);
        else { _dirty = false; _dirtyFrames = 0; }
    }
}
animate();

// Modo de iluminação inicial
applyNightMode();

// ==================== RESIZE ====================
window.addEventListener('resize', () => {
    const w = getViewW(), h = getViewH(); camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h); renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    resizeComposers(w, h); markDirty(4);
});

// (window globals definidos no topo do arquivo, logo após as declarações de variáveis)

// ==================== IMPORTAR PROJETO ====================
window.importNexusProject = async function(data) {
    [...sceneObjects].forEach(obj => {
        if (obj.userData?.light) scene.remove(obj.userData.light);
        scene.remove(obj);
    });
    sceneObjects.length = 0; particleSystems.length = 0;
    removeBoneHelpers(); setActiveObject(null); selectedObjects.clear();

    if (data.skybox?.type === 'color' && window.NexusSkybox) window.NexusSkybox.setSolidColor(data.skybox.value);

    const geoFactory = {
        cube:     () => new THREE.BoxGeometry(1, 1, 1),
        sphere:   () => new THREE.SphereGeometry(.7, 32, 16),
        cone:     () => new THREE.ConeGeometry(.7, 1.4, 32),
        cylinder: () => new THREE.CylinderGeometry(.7, .7, 1.4, 32),
        torus:    () => new THREE.TorusGeometry(.7, .2, 16, 64),
    };
    const lightFactory = {
        PointLight:       d => new THREE.PointLight(d.color ?? 0xffffff, d.intensity ?? 1, d.distance ?? 20),
        DirectionalLight: d => { const l = new THREE.DirectionalLight(d.color ?? 0xffffff, d.intensity ?? 1); l.castShadow = !!d.castShadow; return l; },
        AmbientLight:     d => new THREE.AmbientLight(d.color ?? 0xffffff, d.intensity ?? 0.5),
        SpotLight:        d => new THREE.SpotLight(d.color ?? 0xffffff, d.intensity ?? 1),
    };

    for (const entry of data.objects) {
        let obj = null;
        if (entry.userData?.isImportedModel && entry.modelData) {
            try {
                const loader = new THREE.ObjectLoader();
                const loadedObj = loader.parse(entry.modelData);
                loadedObj.traverse(child => {
                    if (!child.isMesh) return;
                    child.castShadow = true; child.receiveShadow = true; child.layers.enable(1);
                    if (child.isSkinnedMesh) child.frustumCulled = false;
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    const upgraded = mats.map(mat => {
                        if (!mat || mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) return mat;
                        const std = new THREE.MeshStandardMaterial({
                            color: mat.color || new THREE.Color(0xcccccc),
                            map: mat.map || null, normalMap: mat.normalMap || null,
                            alphaMap: mat.alphaMap || null, transparent: mat.transparent || false,
                            opacity: mat.opacity ?? 1, side: mat.side ?? THREE.FrontSide,
                            roughness: 0.78, metalness: 0.1,
                        });
                        if (mat.emissive) std.emissive.copy(mat.emissive);
                        std.needsUpdate = true; if (mat.dispose) mat.dispose(); return std;
                    });
                    child.material = Array.isArray(child.material) ? upgraded : upgraded[0];
                });
                obj = loadedObj; obj.userData.isImportedModel = true; obj.userData.originalFileName = entry.userData?.originalFileName || '';
                let hasBones = false;
                obj.traverse(child => { if (child.isBone) hasBones = true; if (child.isSkinnedMesh && child.skeleton?.bones.length > 0) hasBones = true; });
                if (entry.position) obj.position.fromArray(entry.position);
                if (entry.rotation) obj.rotation.set(entry.rotation[0], entry.rotation[1], entry.rotation[2], entry.rotation[3] || 'XYZ');
                if (entry.scale)    obj.scale.fromArray(entry.scale);
                if (entry.visible !== undefined) obj.visible = entry.visible;
                obj.name = entry.name || 'Modelo';
                scene.add(obj); sceneObjects.push(obj);
                if (hasBones) { await new Promise(r => requestAnimationFrame(r)); obj.updateWorldMatrix(true, true); buildBoneHelpers(obj); }
                continue;
            } catch (err) { console.error(`[Import] ❌ Falha ao reconstruir modelo ${entry.name}:`, err); }
        }
        if (entry.userData?.isCamera) {
            const group = new THREE.Group(); group.userData = { ...entry.userData }; group.name = entry.name || 'Câmera';
            if (entry.position) group.position.fromArray(entry.position);
            if (entry.rotation) group.rotation.set(entry.rotation[0], entry.rotation[1], entry.rotation[2], entry.rotation[3] || 'XYZ');
            if (entry.scale)    group.scale.fromArray(entry.scale);
            const visual = createCameraVisualMesh(); group.add(visual);
            scene.add(group); sceneObjects.push(group); rebuildCameraFrustum(group); continue;
        }
        const shapeType = entry.userData?.shapeType;
        if (shapeType && geoFactory[shapeType]) {
            const geo = geoFactory[shapeType](), mat = new THREE.MeshStandardMaterial();
            if (entry.material) {
                if (entry.material.color !== undefined) mat.color.setHex(entry.material.color);
                if (entry.material.emissive !== undefined) mat.emissive.setHex(entry.material.emissive);
                if (entry.material.emissiveIntensity !== undefined) mat.emissiveIntensity = entry.material.emissiveIntensity;
                if (entry.material.roughness !== undefined) mat.roughness = entry.material.roughness;
                if (entry.material.metalness !== undefined) mat.metalness = entry.material.metalness;
                if (entry.material.transparent !== undefined) mat.transparent = entry.material.transparent;
                if (entry.material.opacity !== undefined) mat.opacity = entry.material.opacity;
                mat.needsUpdate = true;
            }
            obj = new THREE.Mesh(geo, mat); obj.castShadow = obj.receiveShadow = true; obj.layers.enable(1);
        } else if (entry.light) {
            const ld = entry.light, mkFn = lightFactory[ld.lightType];
            if (mkFn) { const light = mkFn(ld), helper = new THREE.Object3D(); helper.userData.isLight = true; helper.userData.light = light; helper.add(light); scene.add(light); obj = helper; obj.layers.enable(1); }
        }
        if (!obj) continue;
        obj.name = entry.name || 'Objeto'; obj.userData = { ...obj.userData, ...(entry.userData || {}) };
        if (entry.position) obj.position.fromArray(entry.position);
        if (entry.rotation) obj.rotation.set(entry.rotation[0], entry.rotation[1], entry.rotation[2], entry.rotation[3] || 'XYZ');
        if (entry.scale)    obj.scale.fromArray(entry.scale);
        if (entry.visible !== undefined) obj.visible = entry.visible;
        scene.add(obj); sceneObjects.push(obj);
    }

    invalidateBloomCache(); requestShadowUpdate(); saveState(); updateObjectsList();
};

