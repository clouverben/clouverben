// ==================== postprocess.js ====================
// Sistema de pós-processamento do Nexus Engine.
// — Bloom, SSAO, SSR, DOF, TAA com ruído real (Blender-like)
// — FIX: renderSample() agora passa pelo pipeline completo de pós-processamento
// — FIX: noiseFrame rotaciona o kernel SSAO/SSGI por sample → ruído real visível

import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.169.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }     from 'https://unpkg.com/three@0.169.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.169.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass }     from 'https://unpkg.com/three@0.169.0/examples/jsm/postprocessing/ShaderPass.js';
import { scene, camera, renderer, gridHelper, axesHelper, bloomLayer, getViewW, getViewH, isMobile } from './scene.js';

// ── Frame Budget & Adaptive Post ─────────────────────────────────────────────
const _postQualitySnapshot = {};
export function _snapshotPostQuality() {
    ['ssaoSamples','ssrSteps','vfSteps','volSteps'].forEach(k => {
        _postQualitySnapshot[k] = _postU?.[k]?.value ?? null;
    });
}
function _restorePostQuality() {
    ['ssaoSamples','ssrSteps','vfSteps','volSteps'].forEach(k => {
        if (_postU?.[k] && _postQualitySnapshot[k] !== null && _postQualitySnapshot[k] !== undefined)
            _postU[k].value = _postQualitySnapshot[k];
    });
}

export const _frameBudget = (() => {
    const BUDGET_MS = 24, RECOVER_MS = 15, SMOOTH_FRAMES = 120;
    let _ema = 16, _heavy = false, _smoothN = 0, _lastT = 0, _f = 0, _enabled = true;

    function tick(now) {
        _f++;
        if (!_enabled) { _lastT = now; return; }
        if (_lastT) {
            const dt = now - _lastT;
            _ema = _ema * 0.90 + dt * 0.10;
            if (_ema > BUDGET_MS && !_heavy) {
                _heavy = true; _smoothN = 0;
                if (_postU.ssaoSamples) _postU.ssaoSamples.value = Math.max(8,  Math.floor((_postU.ssaoSamples.value || 16) * 0.5));
                if (_postU.ssrSteps)    _postU.ssrSteps.value    = Math.max(16, Math.floor((_postU.ssrSteps.value    || 32) * 0.5));
                if (_postU.vfSteps)     _postU.vfSteps.value     = Math.max(12, Math.floor((_postU.vfSteps.value     || 24) * 0.5));
                if (_postU.volSteps)    _postU.volSteps.value     = Math.max(16, Math.floor((_postU.volSteps.value    || 32) * 0.5));
            } else if (_ema < RECOVER_MS && _heavy) {
                _smoothN++;
                if (_smoothN > SMOOTH_FRAMES) { _heavy = false; _smoothN = 0; _restorePostQuality(); }
            } else if (_ema >= RECOVER_MS) { _smoothN = 0; }
        }
        _lastT = now;
    }

    function setEnabled(val) {
        _enabled = !!val;
        if (!_enabled && _heavy) { _heavy = false; _smoothN = 0; _restorePostQuality(); }
    }

    function getStatus() {
        return { enabled: _enabled, heavy: _heavy, frameMs: Math.round(_ema * 10) / 10, fps: Math.round(1000 / Math.max(_ema, 1)) };
    }

    return { tick, setEnabled, getStatus, isHeavy: () => _heavy, isEnabled: () => _enabled,
             shouldSkipPost: (frame) => _enabled && _heavy && (frame % (_ema > 35 ? 3 : 2) !== 0), frame: () => _f };
})();

// ── Bloom ─────────────────────────────────────────────────────────────────────
const bloomParams = { bloomStrength: 0.45, bloomRadius: 0.65, bloomThreshold: 0.28 };

export const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(new RenderPass(scene, camera));
export const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(getViewW(), getViewH()),
    bloomParams.bloomStrength, bloomParams.bloomRadius, bloomParams.bloomThreshold
);
bloomComposer.addPass(bloomPass);
bloomComposer.passes[bloomComposer.passes.length - 1].renderToScreen = false;

export const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(new RenderPass(scene, camera));

// ── Depth Render Target ───────────────────────────────────────────────────────
export const depthRT = new THREE.WebGLRenderTarget(getViewW(), getViewH(), {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthTexture: new THREE.DepthTexture(getViewW(), getViewH()),
    depthBuffer: true,
});

// ── Post-processing Uniforms ──────────────────────────────────────────────────
export const _postU = {
    baseTexture:        { value: null },
    bloomTexture:       { value: bloomComposer.renderTarget2.texture },
    tDepth:             { value: depthRT.depthTexture },
    resolution:         { value: new THREE.Vector2(getViewW(), getViewH()) },
    cameraNear:         { value: camera.near },
    cameraFar:          { value: camera.far },
    time:               { value: 0.0 },
    // ── Noise / TAA stochastic seed ──
    noiseFrame:         { value: 0.0 },   // rotaciona kernel por sample → ruído real
    noiseScale:         { value: 1.0 },   // escala do ruído de path tracing
    ptNoiseEnabled:     { value: 0.0 },   // liga ruído PT puro visível
    // RT
    rtEnabled:          { value: 0.0 },
    ssaoRadius:         { value: 0.15 },
    ssaoIntensity:      { value: 1.0 },
    ssrIntensity:       { value: 0.3 },
    giBias:             { value: 0.5 },
    // DOF
    dofEnabled:         { value: 0.0 },
    dofFocus:           { value: 0.5 },
    dofRange:           { value: 0.2 },
    dofBokeh:           { value: 8.0 },
    dofBlades:          { value: 6.0 },
    // Chromatic Aberration
    chromaEnabled:      { value: 0.0 },
    chromaIntensity:    { value: 0.008 },
    chromaEdge:         { value: 0.8 },
    // Film Grain
    grainEnabled:       { value: 0.0 },
    grainIntensity:     { value: 0.08 },
    grainSize:          { value: 1.5 },
    grainAnimated:      { value: 1.0 },
    // Vignette
    vignetteEnabled:    { value: 0.0 },
    vignetteOffset:     { value: 1.0 },
    vignetteDarkness:   { value: 1.0 },
    vignetteColor:      { value: new THREE.Color(0x000000) },
    // Color Grading
    cgEnabled:          { value: 0.0 },
    cgTonemap:          { value: 1.0 },
    cgExposure:         { value: 1.0 },
    cgContrast:         { value: 1.06 },
    cgSaturation:       { value: 1.10 },
    cgTemperature:      { value: 0.0 },
    cgTint:             { value: 0.0 },
    // Volumetric Light
    volEnabled:         { value: 0.0 },
    volLightPosScreen:  { value: new THREE.Vector3(0.5, 0.9, 0.0) },
    volDensity:         { value: 0.3 },
    volScatter:         { value: 0.5 },
    volSteps:           { value: 32.0 },
    volColor:           { value: new THREE.Color(0xffffff) },
    // SSAO
    ssaoSamples:        { value: 16.0 },
    ssaoBias:           { value: 0.015 },
    // SSR
    ssrSteps:           { value: 32.0 },
    ssrRoughness:       { value: 0.5 },
    // GI
    giBounce:           { value: 0.3 },
    // Soft Shadows (PCSS)
    ssEnabled:          { value: 0.0 },
    ssLightSize:        { value: 0.02 },
    ssSamples:          { value: 16.0 },
    ssMaxPenumbra:      { value: 0.015 },
    ssSoftness:         { value: 0.8 },
    // Volumetric Fog
    vfEnabled:          { value: 0.0 },
    vfDensity:          { value: 0.4 },
    vfScatter:          { value: 0.5 },
    vfMaxHeight:        { value: 0.6 },
    vfFalloff:          { value: 2.5 },
    vfNoiseScale:       { value: 3.0 },
    vfNoiseSpeed:       { value: 0.15 },
    vfSteps:            { value: 24.0 },
    vfAniso:            { value: 0.3 },
    vfColor:            { value: new THREE.Color(0xc8daf0) },
    // Advanced Engine
    aeEnabled:          { value: 0.0 },
    aeTAA:              { value: 0.9 },
    aeGI:               { value: 0.6 },
    aeIBL:              { value: 1.0 },
    aeCaustics:         { value: 0.0 },
    aeSSS:              { value: 0.0 },
    aeContact:          { value: 0.5 },
};

const finalPass = new ShaderPass(
    new THREE.ShaderMaterial({
        uniforms: _postU,
        vertexShader:   document.getElementById('vertexshader').textContent,
        fragmentShader: document.getElementById('fragmentshader').textContent,
    }), 'baseTexture'
);
finalPass.needsSwap = true;
finalComposer.addPass(finalPass);
finalComposer.passes[finalComposer.passes.length - 1].renderToScreen = true;

export function syncBloomTexture() { _postU['bloomTexture'].value = bloomComposer.renderTarget2.texture; }
export function resizeComposers(w, h) {
    bloomComposer.setSize(w, h); finalComposer.setSize(w, h);
    depthRT.setSize(w, h);
    _postU.resolution.value.set(w, h);
    syncBloomTexture();
}

// ── Bloom cache ───────────────────────────────────────────────────────────────
export let _bloomCacheDirty = true;
export let _hasBloomObjects = false;
let _bloomMeshCache = [];
const darkMaterial      = new THREE.MeshBasicMaterial({ color: 'black' });
const originalMaterials = {};

export function invalidateBloomCache() { _bloomCacheDirty = true; _markDirtyRef?.(2); }
export function rebuildBloomCache() {
    _bloomMeshCache = []; _hasBloomObjects = false;
    scene.traverse(obj => {
        if (!obj.isMesh) return;
        let p = obj; while (p) { if (p.userData?.isLight || p.userData?.isLightIcon) return; p = p.parent; }
        if (bloomLayer.test(obj.layers)) _hasBloomObjects = true;
        else _bloomMeshCache.push(obj);
    });
    _bloomCacheDirty = false;
}

// Referência a boneHelpers — set por main.js após construir os helpers
let _boneHelpers = [];
export function setBoneHelpers(arr) { _boneHelpers = arr; }

function darkenNonBloomedCached() {
    for (let i = 0; i < _bloomMeshCache.length; i++) {
        const obj = _bloomMeshCache[i]; originalMaterials[obj.uuid] = obj.material; obj.material = darkMaterial;
    }
}
function restoreMaterialsCached() {
    for (let i = 0; i < _bloomMeshCache.length; i++) {
        const obj = _bloomMeshCache[i];
        if (originalMaterials[obj.uuid]) { obj.material = originalMaterials[obj.uuid]; delete originalMaterials[obj.uuid]; }
    }
}

// ── Volumetric light screen-space ─────────────────────────────────────────────
let _sceneObjectsRef = [];
export function setSceneObjectsRef(arr) { _sceneObjectsRef = arr; }
const _volLightWP = new THREE.Vector3();
export function _updateVolLightScreen() {
    if (_postU.volEnabled.value < 0.5) return;
    for (let i = 0; i < _sceneObjectsRef.length; i++) {
        const obj = _sceneObjectsRef[i];
        if (obj.userData?.isLight && obj.userData?.volumetric?.enabled) {
            obj.getWorldPosition(_volLightWP);
            _volLightWP.project(camera);
            _postU.volLightPosScreen.value.set(
                _volLightWP.x * 0.5 + 0.5, _volLightWP.y * 0.5 + 0.5, _volLightWP.z
            );
            return;
        }
    }
}

export function renderWithBloom() {
    if (_bloomCacheDirty) rebuildBloomCache();
    gridHelper.visible = false; axesHelper.visible = false;
    _boneHelpers.forEach(h => h.lines.forEach(({ line }) => { line.visible = false; }));
    darkenNonBloomedCached(); bloomComposer.render(); syncBloomTexture(); restoreMaterialsCached();
    gridHelper.visible = true; axesHelper.visible = true;
    _boneHelpers.forEach(h => h.lines.forEach(({ line }) => { line.visible = true; }));
    finalComposer.render();
}

export function smartRender(skipExpensive = false) {
    if (_bloomCacheDirty) rebuildBloomCache();
    if (!skipExpensive) {
        renderer.setRenderTarget(depthRT);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
    }
    _postU.cameraNear.value = camera.near;
    _postU.cameraFar.value  = camera.far;
    _updateVolLightScreen();
    if (_hasBloomObjects) renderWithBloom(); else finalComposer.render();
}

// ══════════════════════════════════════════════════════════════════════════════
// ── TAA (Progressive Rendering / Path Tracing Accumulation) ──────────────────
// ══════════════════════════════════════════════════════════════════════════════
// FIX PRINCIPAL: renderSample() agora usa o pipeline completo de pós-processamento.
// Antes: renderer.render(scene,camera) → frame flat sem SSAO/SSR/bloom.
// Depois: smartRender() → frame com todos os efeitos → acumula com ruído real.
//
// FIX SECUNDÁRIO: noiseFrame rotaciona o kernel SSAO/SSGI por sample.
// Cada amostra tem um padrão diferente → ruído stocástico real visível.
// O acumulador promedia os padrões → ruído some como no Blender Cycles.
// ══════════════════════════════════════════════════════════════════════════════
export const _taa = (() => {
    let _running = false, _paused = false, _frame = 0, _maxFrames = 64;
    let _accumRT = null, _sampleRT = null, _origProj = null, _weight = 0;

    function halton(i, base) {
        let r = 0, f = 1;
        while (i > 0) { f /= base; r += f * (i % base); i = Math.floor(i / base); }
        return r;
    }

    let _quadScene = null, _quadCam = null, _blendMat = null;
    function _ensureQuad() {
        if (_quadScene) return;
        _quadCam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        _quadScene = new THREE.Scene();
        _blendMat  = new THREE.ShaderMaterial({
            uniforms: { tAccum:{value:null}, tNew:{value:null}, uAlpha:{value:1.0} },
            vertexShader:   `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }`,
            fragmentShader: `uniform sampler2D tAccum; uniform sampler2D tNew; uniform float uAlpha;
                varying vec2 vUv;
                void main(){ gl_FragColor = mix(texture2D(tAccum,vUv), texture2D(tNew,vUv), uAlpha); }`,
            depthTest: false, depthWrite: false,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), _blendMat);
        mesh.frustumCulled = false;
        _quadScene.add(mesh);
    }

    function _ensureRTs(w, h) {
        if (_accumRT && _accumRT.width === w && _accumRT.height === h) return;
        _accumRT?.dispose(); _sampleRT?.dispose();
        const base = { minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter };
        _accumRT  = new THREE.WebGLRenderTarget(w, h, { ...base, type:THREE.HalfFloatType, depthBuffer:false });
        _sampleRT = new THREE.WebGLRenderTarget(w, h, { ...base, type:THREE.HalfFloatType, depthBuffer:true  });
    }

    function _applyJitter(f) {
        if (!_origProj) return;
        const w = renderer.domElement.width || getViewW();
        const h = renderer.domElement.height || getViewH();
        camera.projectionMatrix.copy(_origProj);
        camera.projectionMatrix.elements[8] += (halton(f+1,2)-0.5)*2.0/w;
        camera.projectionMatrix.elements[9] += (halton(f+1,3)-0.5)*2.0/h;
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
    function _removeJitter() {
        if (!_origProj) return;
        camera.projectionMatrix.copy(_origProj);
        camera.projectionMatrixInverse.copy(_origProj).invert();
    }

    function start(maxSamples) {
        _maxFrames = maxSamples || 64;
        _frame = 0; _weight = 0; _running = true; _paused = false;
        _origProj = camera.projectionMatrix.clone();
        const w = renderer.domElement.width || getViewW();
        const h = renderer.domElement.height || getViewH();
        _ensureRTs(w, h); _ensureQuad();

        // Frame limpo sem ruído para _accumRT — cena visível imediatamente
        renderer.setRenderTarget(_accumRT);
        renderer.clear(true, true, false);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);

        _markDirtyRef?.(2);
        console.log(`[TAA] ▶ ${_maxFrames} samples`);
        _syncUI();
    }

    function stop() {
        if (!_running) return;
        _running = false; _paused = false;
        _removeJitter();
        _postU.noiseFrame.value     = 0.0;
        _postU.ptNoiseEnabled.value = 0.0;
        _markDirtyRef?.(4);
        _syncUI();
    }

    function togglePause() {
        if (!_running) return;
        _paused = !_paused;
        if (!_paused) _markDirtyRef?.(2);
        _syncUI();
    }

    function renderSample() {
        if (!_running || _paused || _frame >= _maxFrames) return false;
        const w = renderer.domElement.width || getViewW();
        const h = renderer.domElement.height || getViewH();
        _ensureRTs(w, h); _ensureQuad();

        // 1. Jitter sub-pixel
        _applyJitter(_frame);

        // 2. Depth pass + seed estocástico
        if (_bloomCacheDirty) rebuildBloomCache();
        renderer.setRenderTarget(depthRT);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);

        _postU.cameraNear.value     = camera.near;
        _postU.cameraFar.value      = camera.far;
        _postU.noiseFrame.value     = _frame;  // kernel SSAO/SSGI diferente por sample
        _postU.ptNoiseEnabled.value = 1.0;     // grain Monte Carlo visível
        _updateVolLightScreen();

        // 3. Renderiza pipeline completo → TELA (finalComposer normal, com todos os efeitos)
        if (_hasBloomObjects) renderWithBloom(); else finalComposer.render();

        // 4. Copia tela → _sampleRT  (args r163+: texture, position)
        renderer.copyFramebufferToTexture(_sampleRT.texture, new THREE.Vector2(0, 0));

        // 5. Remove jitter antes do blend
        _removeJitter();

        // 6. Blend: mix(_accumRT, _sampleRT, 1/N) → tela
        //    alpha = 1/N  → média incremental (sample 1=100%, 2=50%, 3=33%...)
        _weight++;
        renderer.autoClear = true;
        _blendMat.uniforms.tAccum.value = _accumRT.texture;
        _blendMat.uniforms.tNew.value   = _sampleRT.texture;
        _blendMat.uniforms.uAlpha.value = 1.0 / _weight;
        renderer.render(_quadScene, _quadCam);

        // 7. Copia resultado blendado → _accumRT  (base para o próximo sample)
        renderer.copyFramebufferToTexture(_accumRT.texture, new THREE.Vector2(0, 0));

        _frame++;
        _syncUI();
        if (_frame >= _maxFrames) {
            _running = false;
            _postU.ptNoiseEnabled.value = 0.0;
            console.log(`[TAA] ✅ ${_maxFrames} samples concluídos`);
            _syncUI();
        }
        return true;
    }

    function _syncUI() {
        const fill = document.getElementById('acc-progress-fill');
        const text = document.getElementById('acc-progress-text');
        const pct  = Math.min(_frame / Math.max(_maxFrames, 1) * 100, 100);
        if (fill) fill.style.width = pct + '%';
        if (text) {
            if (!_running && _frame >= _maxFrames)
                text.textContent = `✅ ${_maxFrames} samples concluídos`;
            else if (_paused)
                text.textContent = `⏸ Pausado — ${_frame}/${_maxFrames}`;
            else if (_running)
                text.textContent = `${_frame}/${_maxFrames} samples — ${Math.round(pct)}%`;
        }
        const ptFill = document.getElementById('pt-noise-fill');
        const ptText = document.getElementById('pt-noise-text');
        if (ptFill) ptFill.style.width = pct + '%';
        if (ptText) ptText.textContent = _running
            ? `${_frame}/${_maxFrames} samples…`
            : _frame >= _maxFrames ? `✅ Ruído convergido` : `Aguardando...`;
    }

    function getProgress() {
        return { frame:_frame, total:_maxFrames, running:_running, paused:_paused,
                 pct: _frame / Math.max(_maxFrames, 1) };
    }

    return {
        start, stop, togglePause, renderSample, getProgress,
        isRunning: () => _running && !_paused,
        isActive:  () => _running,
    };
})();




// ── Wiring do Samples toggle (conecta o TAA ao toggle da UI) ─────────────────
let _accSamples = 64;
let _markDirtyRef = null;
export function setMarkDirtyRef(fn) { _markDirtyRef = fn; }

// initSamplesUI removido — wiring feito em main.js

export function getBloomState() {
    return { dirty: _bloomCacheDirty, hasBloom: _hasBloomObjects };
}

console.log('[postprocess.js] ✅ Pipeline de pós-processamento inicializado');
