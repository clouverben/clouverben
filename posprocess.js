import * as THREE from 'three';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { TAARenderPass } from 'three/addons/postprocessing/TAARenderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { HalftonePass } from 'three/addons/postprocessing/HalftonePass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';

import { app, markSceneDirty, setHelperVisibility } from './scene.js';
import { renderState, PostProcessShader, syncPostShader } from './shader.js';

const PATH_TRACER_URL =
  'https://cdn.jsdelivr.net/npm/three-gpu-pathtracer@0.0.23/build/index.module.js';

// ─────────────────────────────────────────────────────────────────────────────
// GLOBALS
// ─────────────────────────────────────────────────────────────────────────────

let composer = null;
let renderPass = null;
let bloomPass = null;
let gradePass = null;

// Per-object selective bloom
let objBloomPass = null;
let objBloomComposer = null;  // second composer: renders only selected mesh + bloom
let selectiveMixPass = null;  // final pass in main composer: adds selective bloom texture

let ssaoPass = null;
let gtaoPass = null;
let taaPass = null;
let filmPass = null;
let halftonePass = null;
let pixelatedPass = null;
let bokehPass = null;
let outlinePass = null;

let initialized = false;

let lastW = 0;
let lastH = 0;

let pathTracer = null;
let pathTracerModule = null;
let pathTracerLoadPromise = null;

export let currentSampleCount = 0;

let lastCamPos = new THREE.Vector3();
let lastCamQuat = new THREE.Quaternion();

// Visualization override
let _visOverrideMat = null;

// Layers
export const activeLayers = new Set();

// Configs
export const layerConfig = {
  outline: { strength: 3, glow: 0.5, thickness: 2 },
  film: { noise: 0.35, scanlines: 0.5, grayscale: false },
  bokeh: { focus: 1.0, aperture: 0.0025, maxblur: 0.01 },
  pixelated: { pixelSize: 4 }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function int(v, fallback) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function patchSceneForPT(scene) {
  if (!scene) return;

  if (!scene.backgroundRotation || !(scene.backgroundRotation instanceof THREE.Euler)) {
    Object.defineProperty(scene, 'backgroundRotation', {
      value: new THREE.Euler(),
      configurable: true,
      writable: true
    });
  }

  if (!scene.environmentRotation || !(scene.environmentRotation instanceof THREE.Euler)) {
    Object.defineProperty(scene, 'environmentRotation', {
      value: new THREE.Euler(),
      configurable: true,
      writable: true
    });
  }

  if (scene.background === undefined) scene.background = null;
  if (scene.environment === undefined) scene.environment = null;
}

function cameraMoved() {
  if (!app.camera) return false;

  const moved =
    !app.camera.position.equals(lastCamPos) ||
    !app.camera.quaternion.equals(lastCamQuat);

  if (moved) {
    lastCamPos.copy(app.camera.position);
    lastCamQuat.copy(app.camera.quaternion);
  }

  return moved;
}

// ─────────────────────────────────────────────────────────────────────────────
// SELECTIVE BLOOM SHADER (additive mix of per-object bloom over main frame)
// ─────────────────────────────────────────────────────────────────────────────

const SelectiveBloomMixShader = {
  uniforms: {
    tDiffuse:     { value: null },
    bloomTexture: { value: null },
    bloomActive:  { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D bloomTexture;
    uniform float bloomActive;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      if (bloomActive > 0.5) {
        vec3 bloom = texture2D(bloomTexture, vUv).rgb;
        gl_FragColor = vec4(base.rgb + bloom, base.a);
      } else {
        gl_FragColor = base;
      }
    }
  `
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSER
// ─────────────────────────────────────────────────────────────────────────────

function ensureComposer() {
  if (!app.renderer || !app.scene || !app.camera) return false;
  if (composer) return true;

  const w = window.innerWidth;
  const h = window.innerHeight;

  composer = new EffectComposer(app.renderer);

  renderPass = new RenderPass(app.scene, app.camera);
  bloomPass  = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.3, 1.0);
  gradePass  = new ShaderPass(PostProcessShader);

  // ── Per-object selective bloom ───────────────────────────────────────────
  // objBloomComposer renders the scene with non-selected meshes hidden,
  // applies bloom, and stores the result in its read buffer.
  // selectiveMixPass in the main composer blends that result additively.
  objBloomPass     = new UnrealBloomPass(new THREE.Vector2(w, h), 1.2, 0.4, 0.5);
  objBloomPass.enabled = false;

  objBloomComposer = new EffectComposer(app.renderer);
  objBloomComposer.renderToScreen = false;
  objBloomComposer.addPass(new RenderPass(app.scene, app.camera));
  objBloomComposer.addPass(objBloomPass);

  selectiveMixPass = new ShaderPass(SelectiveBloomMixShader);
  selectiveMixPass.uniforms.bloomActive.value = 0;

  // Optional passes
  try {
    ssaoPass = new SSAOPass(app.scene, app.camera, w, h);
    ssaoPass.kernelRadius = 8;
    ssaoPass.minDistance = 0.001;
    ssaoPass.maxDistance = 0.12;
    ssaoPass.output = SSAOPass.OUTPUT.Default;
  } catch {
    ssaoPass = null;
  }

  try {
    gtaoPass = new GTAOPass(app.scene, app.camera, w, h);
    if (GTAOPass.OUTPUT?.Default !== undefined) gtaoPass.output = GTAOPass.OUTPUT.Default;
  } catch {
    gtaoPass = null;
  }

  try {
    taaPass = new TAARenderPass(app.scene, app.camera);
    taaPass.unbiased = false;
    taaPass.sampleLevel = 1;
  } catch {
    taaPass = null;
  }

  try {
    filmPass = new FilmPass();
    if (filmPass.uniforms?.nIntensity) filmPass.uniforms.nIntensity.value = layerConfig.film.noise;
    if (filmPass.uniforms?.sIntensity) filmPass.uniforms.sIntensity.value = layerConfig.film.scanlines;
    if (filmPass.uniforms?.grayscale) filmPass.uniforms.grayscale.value = 0;
  } catch {
    filmPass = null;
  }

  try {
    halftonePass = new HalftonePass(w, h, {
      shape: 1,
      radius: 4,
      rotateR: Math.PI / 12,
      rotateG: Math.PI / 6,
      rotateB: Math.PI / 4,
      scatter: 0,
      blending: 1,
      blendingMode: 1,
      greyscale: false,
      disable: false
    });
  } catch {
    halftonePass = null;
  }

  try {
    pixelatedPass = new RenderPixelatedPass(layerConfig.pixelated.pixelSize, app.scene, app.camera);
  } catch {
    pixelatedPass = null;
  }

  try {
    bokehPass = new BokehPass(app.scene, app.camera, {
      focus: layerConfig.bokeh.focus,
      aperture: layerConfig.bokeh.aperture,
      maxblur: layerConfig.bokeh.maxblur,
      width: w,
      height: h
    });
  } catch {
    bokehPass = null;
  }

  try {
    outlinePass = new OutlinePass(new THREE.Vector2(w, h), app.scene, app.camera);
    outlinePass.edgeStrength  = 6.0;
    outlinePass.edgeGlow      = 3.0;
    outlinePass.edgeThickness = 0.5;
    outlinePass.pulsePeriod   = 0;
    outlinePass.visibleEdgeColor.set('#ffffff');
    outlinePass.hiddenEdgeColor.set('#000000');
    outlinePass.overlayMaterial.blending = THREE.AdditiveBlending;
    outlinePass.selectedObjects = [];
  } catch {
    outlinePass = null;
  }

  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(gradePass);
  composer.addPass(selectiveMixPass);  // additive selective bloom (disabled until obj selected)

  return true;
}

function buildLayerPasses() {
  const passes = [];

  if (activeLayers.has('ao') && ssaoPass) passes.push(ssaoPass);
  if (activeLayers.has('gtao') && gtaoPass) passes.push(gtaoPass);
  if (activeLayers.has('outline') && outlinePass) passes.push(outlinePass);
  if (activeLayers.has('taa') && taaPass) passes.push(taaPass);
  if (activeLayers.has('bokeh') && bokehPass) passes.push(bokehPass);
  if (activeLayers.has('halftone') && halftonePass) passes.push(halftonePass);
  if (activeLayers.has('pixelated') && pixelatedPass) passes.push(pixelatedPass);
  if (activeLayers.has('film') && filmPass) passes.push(filmPass);

  return passes;
}

function setPipeline(mode) {
  if (!composer) return;

  if (renderPass) {
    renderPass.scene = app.scene;
    renderPass.camera = app.camera;
  }

  if (ssaoPass) {
    ssaoPass.scene = app.scene;
    ssaoPass.camera = app.camera;
  }

  if (taaPass) {
    taaPass.scene = app.scene;
    taaPass.camera = app.camera;
  }

  const layers = buildLayerPasses();

  if (mode === 'standard') {
    composer.passes = [renderPass, ...layers, bloomPass, outlinePass, gradePass, selectiveMixPass];
    return;
  }

  if (mode === 'visualization') {
    composer.passes = [renderPass, ...layers, gradePass];
    return;
  }

  if (mode === 'baseshot') {
    composer.passes = [renderPass, ...layers];
    return;
  }

  composer.passes = [renderPass, ...layers, bloomPass, gradePass];
}

// ─────────────────────────────────────────────────────────────────────────────
// VISUALIZATION OVERRIDE
// ─────────────────────────────────────────────────────────────────────────────

function buildVisMaterial(visMode) {
  switch (visMode) {
    case 'normals':
      return new THREE.MeshNormalMaterial({ side: THREE.FrontSide });

    case 'wireframe':
      return new THREE.MeshBasicMaterial({ color: 0x4fc3f7, wireframe: true });

    case 'clay':
      return new THREE.MeshStandardMaterial({ color: 0xccaa88, roughness: 0.85, metalness: 0 });

    case 'depth':
      return new THREE.ShaderMaterial({
        uniforms: { cameraNear: { value: 0.1 }, cameraFar: { value: 4000 } },
        vertexShader: `
          varying float vD;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vD = -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform float cameraNear, cameraFar;
          varying float vD;
          void main() {
            float d = 1.0 - clamp((vD - cameraNear) / (cameraFar - cameraNear), 0.0, 1.0);
            gl_FragColor = vec4(vec3(d), 1.0);
          }
        `
      });

    default:
      return null;
  }
}

export function setVisualizationMode(visMode) {
  if (_visOverrideMat) {
    _visOverrideMat.dispose();
    _visOverrideMat = null;
  }
  if (visMode) _visOverrideMat = buildVisMaterial(visMode);
  markSceneDirty();
}

// ─────────────────────────────────────────────────────────────────────────────
// PATH TRACER
// ─────────────────────────────────────────────────────────────────────────────

async function loadPathTracerModule() {
  if (pathTracerModule) return pathTracerModule;

  if (!pathTracerLoadPromise) {
    pathTracerLoadPromise = import(PATH_TRACER_URL).then(m => {
      pathTracerModule = m;
      return m;
    });
  }

  return pathTracerLoadPromise;
}

async function ensurePathTracer() {
  if (pathTracer) return pathTracer;
  if (!app.renderer || !app.scene || !app.camera) return null;

  try {
    const mod = await loadPathTracerModule();
    const PTClass = mod.WebGLPathTracer ?? mod.default?.WebGLPathTracer ?? mod['WebGLPathTracer'];

    if (!PTClass) return null;

    patchSceneForPT(app.scene);

    pathTracer = new PTClass(app.renderer);

    // IMPORTANT: no black screen
    pathTracer.renderToCanvas = true;

    // Blender-like preview optimization
    pathTracer.dynamicLowRes = true;
    pathTracer.lowResScale = 0.2;

    pathTracer.renderDelay = 0;
    pathTracer.fadeDuration = 160;

    pathTracer.minSamples = 1;
    pathTracer.renderScale = 1.0;

    pathTracer.rasterizeScene = true;
    pathTracer.synchronizeRenderSize = true;

    pathTracer.setScene(app.scene, app.camera);
    pathTracer.reset();

    currentSampleCount = 0;
    lastCamPos.copy(app.camera.position);
    lastCamQuat.copy(app.camera.quaternion);

    return pathTracer;
  } catch (e) {
    console.warn('[PathTracer] Failed:', e);
    return null;
  }
}

function getSamplesTarget() {
  const s = renderState.samples || {};
  return clamp(int(s.samples ?? s.targetSamples ?? 64, 64), 1, 8192);
}

function getSubSamples() {
  const s = renderState.samples || {};
  return clamp(int(s.subSamples ?? 1, 1), 1, 32);
}

// Blender preset mapping
function applyTracerPreset(mode) {
  if (!pathTracer) return;

  const baseSamples = getSamplesTarget();

  // preview (raytracing)
  if (mode === 'raytracing') {
    pathTracer.bounces = 2;
    pathTracer.filterGlossyFactor = 0.12;
    pathTracer.tiles.set(1, 1);

    pathTracer.dynamicLowRes = true;
    pathTracer.lowResScale = 0.22;

    pathTracer.minSamples = 1;
    pathTracer.renderScale = 0.9;

    // preview doesn't need 500 samples
    renderState.samples.targetSamples = Math.min(baseSamples, 64);
    return;
  }

  // final (pathtracing)
  if (mode === 'pathtracing') {
    pathTracer.bounces = clamp(int(renderState.path?.bounces ?? 10, 10), 1, 64);
    pathTracer.filterGlossyFactor = clamp(num(renderState.path?.filterGlossyFactor ?? 0.35, 0.35), 0, 1);
    pathTracer.tiles.set(2, 2);

    pathTracer.dynamicLowRes = false;
    pathTracer.lowResScale = 0.15;

    pathTracer.minSamples = clamp(int(renderState.path?.minSamples ?? 2, 2), 1, 128);
    pathTracer.renderScale = clamp(num(renderState.path?.renderScale ?? 1.0, 1.0), 0.1, 1.0);

    renderState.samples.targetSamples = baseSamples;
    return;
  }
}

function resetTracerIfNeeded() {
  if (!pathTracer) return;

  if (app.sceneDirty) {
    patchSceneForPT(app.scene);

    pathTracer.setScene(app.scene, app.camera);
    pathTracer.updateLights?.();
    pathTracer.updateEnvironment?.();
    pathTracer.updateMaterials?.();

    pathTracer.reset();
    app.sceneDirty = false;

    currentSampleCount = 0;
    lastCamPos.copy(app.camera.position);
    lastCamQuat.copy(app.camera.quaternion);
    return;
  }

  if (renderState.samples?.resetOnMove && cameraMoved()) {
    pathTracer.updateCamera?.();
    pathTracer.reset();
    currentSampleCount = 0;
    return;
  }

  pathTracer.updateCamera?.();
}

// ─────────────────────────────────────────────────────────────────────────────
// SIZE + SHADER SYNC
// ─────────────────────────────────────────────────────────────────────────────

function syncPassSizes() {
  if (!app.renderer) return;

  const w = app.renderer.domElement.clientWidth || window.innerWidth;
  const h = app.renderer.domElement.clientHeight || window.innerHeight;

  if (w !== lastW || h !== lastH) {
    lastW = w;
    lastH = h;

    composer?.setSize(w, h);
    objBloomComposer?.setSize(w, h);
    bloomPass?.setSize?.(w, h);
    objBloomPass?.setSize?.(w, h);
    ssaoPass?.setSize?.(w, h);
    gtaoPass?.setSize?.(w, h);

    if (pathTracer?.setSize) pathTracer.setSize(w, h);

    if (bokehPass?.uniforms?.aspect) bokehPass.uniforms.aspect.value = w / h;

    if (halftonePass?.uniforms?.width && halftonePass?.uniforms?.height) {
      halftonePass.uniforms.width.value = w;
      halftonePass.uniforms.height.value = h;
    }
  }

  if (gradePass) syncPostShader(gradePass);
}

function updateComposerValues() {
  if (!bloomPass || !gradePass) return;

  bloomPass.enabled = !!renderState.bloom?.enabled;
  bloomPass.threshold = num(renderState.bloom?.threshold, bloomPass.threshold);
  bloomPass.strength = num(renderState.bloom?.strength, bloomPass.strength);
  bloomPass.radius = num(renderState.bloom?.radius, bloomPass.radius);

  gradePass.enabled = !!renderState.post?.enabled;
  syncPostShader(gradePass);
}

// ─────────────────────────────────────────────────────────────────────────────
// UI SAMPLE COUNTER
// ─────────────────────────────────────────────────────────────────────────────

function updateSampleCounter() {
  const el = document.getElementById('sampleCounter');
  const wrap = document.getElementById('sampleCounterWrap');

  if (!el || !wrap) return;

  if (pathTracer && typeof pathTracer.samples === 'number') {
    currentSampleCount = pathTracer.samples;
  }

  const target = getSamplesTarget();

  const isTraced =
    renderState.mode === 'raytracing' ||
    renderState.mode === 'pathtracing';

  wrap.classList.toggle('hidden', !isTraced);
  el.textContent = `${currentSampleCount}/${target} spp`;
  el.classList.toggle('sampleDone', currentSampleCount >= target);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export function initPostProcess() {
  if (initialized) return;
  initialized = true;

  ensureComposer();
  updateComposerValues();
  syncPassSizes();
}

export function setRenderModeValue(mode) {
  renderState.mode = mode;

  if (mode !== 'visualization') {
    if (app.renderer) app.renderer.overrideMaterial = null;
    if (_visOverrideMat) {
      _visOverrideMat.dispose();
      _visOverrideMat = null;
    }
  }

  if (mode === 'raytracing' || mode === 'pathtracing') {
    ensurePathTracer().then(() => {
      if (pathTracer) {
        applyTracerPreset(mode);
        pathTracer.reset();
        currentSampleCount = 0;
      }
    });
  }

  ensureComposer();
  setPipeline(mode);
  updateSampleCounter();
}

export function setPostProcessValue(value) {
  renderState.post = renderState.post || {};
  renderState.post.enabled = !!value;
  updateComposerValues();
}

export function setBloomValue(value) {
  renderState.bloom = renderState.bloom || {};
  renderState.bloom.enabled = !!value;
  updateComposerValues();
}

// ─── Per-object bloom ────────────────────────────────────────────────────────
// ─── Per-object persistent bloom ─────────────────────────────────────────────
// Each object stores bloom in obj.userData.bloom = {enabled, threshold, strength, radius}.
// _renderSelectiveBloom() scans ALL scene objects every frame so bloom persists
// even after deselecting.

export function setObjBloomField(obj, key, value) {
  if (!obj) return;
  obj.userData.bloom = obj.userData.bloom || {};
  obj.userData.bloom[key] = value;
  markSceneDirty();
}

export function getObjBloom(obj) {
  const b = obj?.userData?.bloom || {};
  return {
    enabled:   !!b.enabled,
    threshold: b.threshold ?? 0.5,
    strength:  b.strength  ?? 1.2,
    radius:    b.radius    ?? 0.4,
  };
}

function _collectBloomedMeshes() {
  const bloomed = new Set();
  app.scene.traverse((o) => {
    if (!(o.isMesh || o.isSkinnedMesh)) return;
    let node = o;
    while (node) {
      if (node.userData?.bloom?.enabled) { bloomed.add(o); return; }
      node = node.parent;
    }
  });
  return bloomed;
}

function _renderSelectiveBloom() {
  if (!objBloomPass || !objBloomComposer || !selectiveMixPass) return;

  const bloomed = _collectBloomedMeshes();

  if (bloomed.size === 0) {
    selectiveMixPass.uniforms.bloomActive.value = 0;
    objBloomPass.enabled = false;
    return;
  }

  // Merge params: min threshold, max strength/radius across all bloomed objects
  let threshold = Infinity, strength = 0, radius = 0;
  app.scene.traverse((o) => {
    if (!o.userData?.bloom?.enabled) return;
    const b = o.userData.bloom;
    threshold = Math.min(threshold, b.threshold ?? 0.5);
    strength  = Math.max(strength,  b.strength  ?? 1.2);
    radius    = Math.max(radius,    b.radius    ?? 0.4);
  });
  objBloomPass.threshold = threshold === Infinity ? 0.5 : threshold;
  objBloomPass.strength  = strength;
  objBloomPass.radius    = radius;

  // Hide every mesh NOT in the bloomed set
  const hidden = [];
  app.scene.traverse((o) => {
    if (!(o.isMesh || o.isSkinnedMesh) || !o.visible) return;
    if (!bloomed.has(o)) { o.visible = false; hidden.push(o); }
  });

  objBloomPass.enabled = true;
  objBloomComposer.render();
  objBloomPass.enabled = false;

  for (const o of hidden) o.visible = true;

  selectiveMixPass.uniforms.bloomTexture.value = objBloomComposer.readBuffer.texture;
  selectiveMixPass.uniforms.bloomActive.value  = 1;
}

export function setSamplesValuePost(value) {
  const v = clamp(int(value, 64), 1, 8192);

  renderState.samples = renderState.samples || {};
  renderState.samples.samples = v;
  renderState.samples.targetSamples = v;

  currentSampleCount = 0;
  pathTracer?.reset();
  markSceneDirty();
  updateSampleCounter();
}

export function syncRenderTargets() {
  ensureComposer();
  syncPassSizes();
  updateComposerValues();
}

export async function renderFrame() {
  if (!app.renderer || !app.scene || !app.camera) return;

  syncRenderTargets();

  const mode = renderState.mode;

  // Visualization override
  if (activeLayers.has('visualization') && _visOverrideMat) {
    if (_visOverrideMat.uniforms?.cameraNear) {
      _visOverrideMat.uniforms.cameraNear.value = app.camera.near;
      _visOverrideMat.uniforms.cameraFar.value = app.camera.far;
    }
    app.renderer.overrideMaterial = _visOverrideMat;
  } else {
    app.renderer.overrideMaterial = null;
  }

  // STANDARD
  if (mode === 'standard') {
    setHelperVisibility(true);
    setPipeline('standard');
    _renderSelectiveBloom();
    composer.render();
    updateSampleCounter();
    return;
  }

  // VISUALIZATION
  if (mode === 'visualization') {
    setHelperVisibility(true);
    setPipeline('visualization');
    composer.render();
    updateSampleCounter();
    return;
  }

  // RAYTRACING / PATHTRACING
  if (mode === 'raytracing' || mode === 'pathtracing') {
    setHelperVisibility(false);

    const tracer = await ensurePathTracer();

    // fallback safe
    if (!tracer) {
      setHelperVisibility(true);
      setPipeline('standard');
      composer.render();
      return;
    }

    applyTracerPreset(mode);
    resetTracerIfNeeded();

    const target = getSamplesTarget();
    const sub = getSubSamples();

    // Blender-like: render N samples per frame, but clamp to avoid freezing
    const maxPerFrame = (mode === 'raytracing') ? 1 : clamp(sub, 1, 8);

    if (currentSampleCount < target) {
      for (let i = 0; i < maxPerFrame; i++) {
        tracer.renderSample();
      }
    }

    currentSampleCount = tracer.samples ?? currentSampleCount;
    updateSampleCounter();
    return;
  }

  // fallback
  setHelperVisibility(true);
  setPipeline('standard');
  composer.render();
  updateSampleCounter();
}

export function toggleLayer(layer, force) {
  const on = force !== undefined ? force : !activeLayers.has(layer);

  if (on) activeLayers.add(layer);
  else activeLayers.delete(layer);

  if (!on && layer === 'visualization') {
    if (_visOverrideMat) {
      _visOverrideMat.dispose();
      _visOverrideMat = null;
    }
    if (app.renderer) app.renderer.overrideMaterial = null;
  }

  ensureComposer();
  setPipeline(renderState.mode);
  markSceneDirty();
}

export function setLayerConfig(layer, key, value) {
  if (!layerConfig[layer]) return;
  layerConfig[layer][key] = value;

  if (layer === 'outline' && outlinePass) {
    if (key === 'strength') outlinePass.edgeStrength = value;
    if (key === 'glow') outlinePass.edgeGlow = value;
    if (key === 'thickness') outlinePass.edgeThickness = value;
  }

  if (layer === 'film' && filmPass?.uniforms) {
    if (key === 'noise' && filmPass.uniforms.nIntensity) filmPass.uniforms.nIntensity.value = value;
    if (key === 'scanlines' && filmPass.uniforms.sIntensity) filmPass.uniforms.sIntensity.value = value;
    if (key === 'grayscale' && filmPass.uniforms.grayscale) filmPass.uniforms.grayscale.value = value ? 1 : 0;
  }

  if (layer === 'bokeh' && bokehPass) {
    if (key === 'focus') bokehPass.uniforms.focus.value = value;
    if (key === 'aperture') bokehPass.uniforms.aperture.value = value;
    if (key === 'maxblur') bokehPass.uniforms.maxblur.value = value;
  }

  if (layer === 'pixelated' && pixelatedPass && key === 'pixelSize') {
    if (typeof pixelatedPass.setPixelSize === 'function') pixelatedPass.setPixelSize(value);
  }

  markSceneDirty();
}

export function updateOutlineSelected(object) {
  if (!outlinePass) return;
  if (!object) { outlinePass.selectedObjects = []; return; }
  const meshes = [];
  object.traverse(o => { if (o.isMesh || o.isSkinnedMesh) meshes.push(o); });
  outlinePass.selectedObjects = meshes.length ? meshes : [object];
  markSceneDirty();
}

// ══════════════════════════════════════════════════════════════════════════════
// ── NEXUZ ADVANCED ENGINE — Importado do Nexuz Upgraded ──────────────────────
// Inclui: Path Tracing (SSAO+SSR+SSGI), Path Tracing Blender-like (Monte Carlo),
//         Soft Shadows (PCSS), Samples & Denoising (TAA acumulador), Volumetric Fog
// ══════════════════════════════════════════════════════════════════════════════

// ── Uniforms do engine avançado (expostos como window._advU) ──────────────────
export const _advU = {
    baseTexture:    { value: null },
    tDepth:         { value: null },
    resolution:     { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    cameraNear:     { value: 0.1 },
    cameraFar:      { value: 4000 },
    time:           { value: 0.0 },
    noiseFrame:     { value: 0.0 },
    noiseScale:     { value: 1.0 },
    ptNoiseEnabled: { value: 0.0 },
    // Path Tracing SSAO+SSR+SSGI
    rtEnabled:      { value: 0.0 },
    ssaoRadius:     { value: 0.15 },
    ssaoIntensity:  { value: 1.0 },
    ssaoSamples:    { value: 16.0 },
    ssaoBias:       { value: 0.015 },
    ssrIntensity:   { value: 0.3 },
    ssrSteps:       { value: 32.0 },
    ssrRoughness:   { value: 0.5 },
    giBias:         { value: 0.5 },
    giBounce:       { value: 0.3 },
    // Soft Shadows PCSS
    ssEnabled:      { value: 0.0 },
    ssLightSize:    { value: 0.02 },
    ssSamples:      { value: 16.0 },
    ssMaxPenumbra:  { value: 0.015 },
    ssSoftness:     { value: 0.8 },
    // Volumetric Fog
    vfEnabled:      { value: 0.0 },
    vfDensity:      { value: 0.4 },
    vfScatter:      { value: 0.5 },
    vfMaxHeight:    { value: 0.6 },
    vfFalloff:      { value: 2.5 },
    vfNoiseScale:   { value: 3.0 },
    vfNoiseSpeed:   { value: 0.15 },
    vfSteps:        { value: 24.0 },
    vfAniso:        { value: 0.3 },
    vfColor:        { value: new THREE.Color(0xc8daf0) },
};
window._advU = _advU;

// ── Fragment shader avançado (nexuz engine) ───────────────────────────────────
const _advVertShader = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

const _advFragShader = `
  uniform sampler2D baseTexture;
  uniform sampler2D tDepth;
  uniform vec2  resolution;
  uniform float cameraNear, cameraFar, time;
  uniform float noiseFrame, noiseScale, ptNoiseEnabled;
  uniform float rtEnabled;
  uniform float ssaoRadius, ssaoIntensity, ssaoSamples, ssaoBias;
  uniform float ssrIntensity, ssrSteps, ssrRoughness;
  uniform float giBias, giBounce;
  uniform float ssEnabled, ssLightSize, ssSamples, ssMaxPenumbra, ssSoftness;
  uniform float vfEnabled, vfDensity, vfScatter, vfMaxHeight, vfFalloff;
  uniform float vfNoiseScale, vfNoiseSpeed, vfSteps, vfAniso;
  uniform vec3  vfColor;
  varying vec2  vUv;

  float linearizeDepth(float d){
    return (2.0*cameraNear)/(cameraFar+cameraNear - d*(cameraFar-cameraNear));
  }
  float readLinearDepth(vec2 uv){ return linearizeDepth(texture2D(tDepth,uv).x); }

  float hash21(vec2 p){
    p=fract(p*vec2(234.34,435.345)); p+=dot(p,p+34.23); return fract(p.x*p.y);
  }
  float hash21f(vec2 p, float seed){
    p=fract(p*vec2(234.34,435.345)+seed*vec2(17.31,5.17)); p+=dot(p,p+34.23); return fract(p.x*p.y);
  }
  float vnoise(vec2 p){
    vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
    float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1,1));
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
  }

  /* SSAO estocástico — rotação de kernel por noiseFrame */
  float ssao(vec2 uv, float dRaw){
    if(dRaw>0.999) return 1.0;
    float dRef=readLinearDepth(uv);
    vec2 ts=1.0/resolution;
    float occ=0.0;
    float n=max(ssaoSamples,4.0);
    float frameRot=hash21f(uv,noiseFrame)*6.2832;
    for(float i=0.0;i<64.0;i++){
      if(i>=n) break;
      float ang=6.2832*(i/n)+frameRot;
      float r=mix(0.2,1.0,sqrt((i+0.5)/n))*ssaoRadius;
      float rJit=1.0+(hash21f(uv+vec2(i*0.07),noiseFrame)-0.5)*0.4;
      vec2 s=uv+vec2(cos(ang),sin(ang))*r*rJit*ts*72.0;
      s=clamp(s,vec2(0.001),vec2(0.999));
      float sd=readLinearDepth(s);
      float rng=smoothstep(0.0,1.0,ssaoRadius/abs(dRef-sd+0.0001));
      occ+=step(sd+ssaoBias,dRef)*rng;
    }
    return 1.0-(occ/n)*ssaoIntensity;
  }

  /* SSR */
  vec3 ssr(vec2 uv, vec3 base, float dLin){
    if(dLin>0.98) return base;
    vec2 ts=1.0/resolution;
    float dx=readLinearDepth(uv+vec2(ts.x,0.0))-readLinearDepth(uv-vec2(ts.x,0.0));
    float dy=readLinearDepth(uv+vec2(0.0,ts.y))-readLinearDepth(uv-vec2(0.0,ts.y));
    vec3 nrm=normalize(vec3(-dx*resolution.x*0.25,-dy*resolution.y*0.25,1.0));
    vec3 vd=normalize(vec3((uv-0.5)*2.0,-1.5));
    float ssrJit=(hash21f(uv,noiseFrame+7.3)-0.5)*0.008;
    vec3 rd=reflect(vd+vec3(ssrJit,ssrJit,0.0),nrm);
    vec2 step2=rd.xy*0.015;
    vec2 sUV=uv;
    vec3 rfC=vec3(0.0); float rfW=0.0;
    float maxS=max(ssrSteps,8.0);
    for(float i=1.0;i<=128.0;i++){
      if(i>=maxS) break;
      sUV+=step2*(1.0+i*0.05);
      if(sUV.x<0.0||sUV.x>1.0||sUV.y<0.0||sUV.y>1.0) break;
      float sd=readLinearDepth(sUV); float cd=dLin+i*0.0012;
      if(sd<cd&&abs(sd-cd)<0.04){
        float fe=1.0-smoothstep(0.7,1.0,max(abs(sUV.x*2.0-1.0),abs(sUV.y*2.0-1.0)));
        rfC=texture2D(baseTexture,sUV).rgb*fe;
        rfW=(1.0-i/maxS)*fe; break;
      }
    }
    return mix(base,rfC,rfW*ssrIntensity*0.5);
  }

  /* SSGI */
  vec3 ssgi(vec2 uv, vec3 base, float dLin){
    if(giBounce<0.01) return vec3(0.0);
    vec3 indirect=vec3(0.0); float w=0.0;
    float frameRot=hash21f(uv+vec2(3.7),noiseFrame+13.1)*6.2832;
    for(float i=0.0;i<12.0;i++){
      float ang=6.2832*(i/12.0)+frameRot;
      float r=mix(0.05,0.25,hash21f(vec2(i*0.17,0.53),noiseFrame));
      vec2 s=clamp(uv+vec2(cos(ang),sin(ang))*r,vec2(0.001),vec2(0.999));
      float sd=readLinearDepth(s);
      float depthSim=exp(-abs(sd-dLin)*30.0);
      indirect+=texture2D(baseTexture,s).rgb*depthSim; w+=depthSim;
    }
    if(w>0.0) indirect/=w;
    return indirect*giBounce*0.35;
  }

  /* PT Noise Blender-like */
  vec3 pathTracingNoise(vec2 uv, vec3 col){
    if(ptNoiseEnabled<0.5) return col;
    float nr=hash21f(uv+vec2(0.13,0.71),noiseFrame*3.1)-0.5;
    float ng=hash21f(uv+vec2(0.37,0.19),noiseFrame*3.1+17.0)-0.5;
    float nb=hash21f(uv+vec2(0.61,0.43),noiseFrame*3.1+31.0)-0.5;
    float lum=dot(col,vec3(0.2126,0.7152,0.0722));
    float noiseAmp=(0.18+lum*0.12)*noiseScale;
    return col+vec3(nr,ng,nb)*noiseAmp;
  }

  /* PCSS Soft Shadows */
  float pcss(vec2 uv, float dLin){
    if(ssEnabled<0.5) return 1.0;
    float penumbra=0.0;
    float n=max(ssSamples,4.0);
    for(float i=0.0;i<64.0;i++){
      if(i>=n) break;
      float a=6.2832*(i/n);
      float r=ssLightSize*(0.5+hash21(vec2(i*0.13,uv.x+uv.y+dLin))*0.5);
      vec2 s=clamp(uv+vec2(cos(a),sin(a))*r,vec2(0.001),vec2(0.999));
      float sd=readLinearDepth(s);
      float blocker=step(sd+0.003,dLin);
      float dist=max(dLin-sd,0.0);
      penumbra+=blocker*min(dist*ssMaxPenumbra/max(ssLightSize,0.001),ssMaxPenumbra);
    }
    penumbra/=n;
    float softShadow=1.0-smoothstep(0.0,ssSoftness*0.5,penumbra)*0.7;
    return clamp(softShadow,0.0,1.0);
  }

  /* Volumetric Fog */
  float worley(vec2 p){
    vec2 i=floor(p); vec2 f=fract(p); float d=1.0;
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
      vec2 nb=vec2(float(x),float(y));
      vec2 pt=nb+hash21(i+nb+vec2(31.7,17.3))-f; d=min(d,dot(pt,pt));
    }
    return sqrt(d);
  }
  float fogNoise3D(vec2 uv, float depth){
    vec2 p=uv*vfNoiseScale+vec2(time*vfNoiseSpeed,time*vfNoiseSpeed*0.7);
    float n1=vnoise(p); float n2=worley(p*1.7+3.3)*0.4; float n3=vnoise(p*3.1+7.5)*0.3;
    return clamp(n1-n2+n3,0.0,1.0);
  }
  float hgPhase(float cosTheta, float g){
    float g2=g*g; return (1.0-g2)/(4.0*3.14159*pow(1.0+g2-2.0*g*cosTheta,1.5));
  }
  vec3 volumetricFog(vec2 uv, vec3 col, float dLin){
    float n=max(vfSteps,8.0);
    vec3 fogAcc=vec3(0.0); float transmit=1.0;
    for(float i=0.0;i<64.0;i++){
      if(i>=n) break;
      float t=(i+0.5)/n; if(t>dLin) break;
      float heightFactor=exp(-max(t-vfMaxHeight,0.0)*vfFalloff);
      float noise=fogNoise3D(uv,t);
      float sigma=vfDensity*noise*heightFactor*(1.0/n);
      float stepT=exp(-sigma);
      float cosT=dot(normalize(uv-0.5),normalize(vec2(0.0,1.0)));
      float phase=hgPhase(cosT,vfAniso);
      vec2 fogUV=clamp(uv+vec2((noise-0.5)*0.01),vec2(0.001),vec2(0.999));
      vec3 lightSample=texture2D(baseTexture,fogUV).rgb*0.5+vfColor*0.5;
      fogAcc+=transmit*(1.0-stepT)*lightSample*vfScatter*phase;
      transmit*=stepT; if(transmit<0.01) break;
    }
    return mix(fogAcc+col*transmit,col,1.0-vfEnabled*0.999);
  }

  void main(){
    vec2 uv=vUv;
    float dRaw=texture2D(tDepth,uv).x;
    float dLin=linearizeDepth(dRaw);
    vec3 col=texture2D(baseTexture,uv).rgb;

    // Path Tracing SSAO+SSR+SSGI
    if(rtEnabled>0.5){
      col*=ssao(uv,dRaw);
      col=ssr(uv,col,dLin);
      col+=ssgi(uv,col,dLin);
      float bounce=(1.0-dLin)*giBias*0.05;
      col+=vec3(bounce*0.1,bounce*0.07,bounce*0.03);
    }
    // Path Tracing Blender-like noise
    if(ptNoiseEnabled>0.5) col=pathTracingNoise(uv,col);
    // Soft Shadows PCSS
    if(ssEnabled>0.5) col*=pcss(uv,dLin);
    // Volumetric Fog
    if(vfEnabled>0.5) col=volumetricFog(uv,col,dLin);

    gl_FragColor=vec4(max(col,vec3(0.0)),1.0);
  }
`;

// ── ShaderPass avançado — adicionado ao composer após os passes existentes ────
let _advPass = null;
let _advDepthRT = null;

export function initAdvancedPass() {
    if (_advPass || !composer) return;
    const w = window.innerWidth, h = window.innerHeight;

    // Depth render target para SSAO/SSR/PCSS
    _advDepthRT = new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthTexture: new THREE.DepthTexture(w, h),
        depthBuffer: true,
    });
    _advU.tDepth.value = _advDepthRT.depthTexture;
    _advU.resolution.value.set(w, h);

    _advPass = new ShaderPass(new THREE.ShaderMaterial({
        uniforms: _advU,
        vertexShader:   _advVertShader,
        fragmentShader: _advFragShader,
    }), 'baseTexture');
    _advPass.enabled = false;  // só ativa quando alguma feature for ligada
    composer.addPass(_advPass);
}

function _syncAdvPass() {
    if (!_advPass) return;
    const any = _advU.rtEnabled.value > 0.5 || _advU.ptNoiseEnabled.value > 0.5
             || _advU.ssEnabled.value > 0.5  || _advU.vfEnabled.value > 0.5;
    _advPass.enabled = any;
}

export function renderAdvDepth() {
    if (!_advPass?.enabled || !app.renderer || !app.scene || !app.camera || !_advDepthRT) return;
    app.renderer.setRenderTarget(_advDepthRT);
    app.renderer.render(app.scene, app.camera);
    app.renderer.setRenderTarget(null);
    _advU.cameraNear.value = app.camera.near;
    _advU.cameraFar.value  = app.camera.far;
    _advU.time.value       = performance.now() / 1000;
}

export function resizeAdvPass(w, h) {
    if (!_advDepthRT) return;
    _advDepthRT.setSize(w, h);
    _advU.resolution.value.set(w, h);
}

// ── TAA Accumulator (Nexuz) ───────────────────────────────────────────────────
export const _taa = (() => {
    let _running = false, _paused = false, _frame = 0, _maxFrames = 64;
    let _accumRT = null, _sampleRT = null, _origProj = null, _weight = 0;

    function halton(i, base) {
        let r = 0, f = 1;
        while (i > 0) { f /= base; r += f * (i % base); i = Math.floor(i / base); }
        return r;
    }

    let _qScene = null, _qCam = null, _blendMat = null;
    function _ensureQuad() {
        if (_qScene) return;
        _qCam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        _qScene = new THREE.Scene();
        _blendMat = new THREE.ShaderMaterial({
            uniforms: { tAccum:{value:null}, tNew:{value:null}, uAlpha:{value:1.0} },
            vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }`,
            fragmentShader: `uniform sampler2D tAccum,tNew; uniform float uAlpha; varying vec2 vUv;
                void main(){ gl_FragColor=mix(texture2D(tAccum,vUv),texture2D(tNew,vUv),uAlpha); }`,
            depthTest: false, depthWrite: false,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), _blendMat);
        mesh.frustumCulled = false;
        _qScene.add(mesh);
    }

    function _ensureRTs(w, h) {
        if (_accumRT && _accumRT.width === w && _accumRT.height === h) return;
        _accumRT?.dispose(); _sampleRT?.dispose();
        const base = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
        _accumRT  = new THREE.WebGLRenderTarget(w, h, { ...base, type: THREE.HalfFloatType, depthBuffer: false });
        _sampleRT = new THREE.WebGLRenderTarget(w, h, { ...base, type: THREE.HalfFloatType, depthBuffer: false });
    }

    function _applyJitter(f) {
        if (!_origProj || !app.camera) return;
        const w = app.renderer.domElement.width || window.innerWidth;
        const h = app.renderer.domElement.height || window.innerHeight;
        app.camera.projectionMatrix.copy(_origProj);
        app.camera.projectionMatrix.elements[8] += (halton(f+1,2)-0.5)*2.0/w;
        app.camera.projectionMatrix.elements[9] += (halton(f+1,3)-0.5)*2.0/h;
        app.camera.projectionMatrixInverse.copy(app.camera.projectionMatrix).invert();
    }
    function _removeJitter() {
        if (!_origProj || !app.camera) return;
        app.camera.projectionMatrix.copy(_origProj);
        app.camera.projectionMatrixInverse.copy(_origProj).invert();
    }

    function start(maxSamples) {
        if (!app.renderer || !composer) return;
        _maxFrames = maxSamples || 64;
        _frame = 0; _weight = 0; _running = true; _paused = false;
        _origProj = app.camera.projectionMatrix.clone();
        const w = app.renderer.domElement.width || window.innerWidth;
        const h = app.renderer.domElement.height || window.innerHeight;
        _ensureRTs(w, h); _ensureQuad();
        app.renderer.setRenderTarget(_accumRT); app.renderer.clear(true, true, false);
        app.renderer.render(app.scene, app.camera); app.renderer.setRenderTarget(null);
        markSceneDirty(); _syncUI();
    }

    function stop() {
        if (!_running) return;
        _running = false; _paused = false;
        _removeJitter();
        _advU.noiseFrame.value = 0.0;
        _advU.ptNoiseEnabled.value = 0.0;
        markSceneDirty(); _syncUI();
    }

    function togglePause() {
        if (!_running) return;
        _paused = !_paused;
        if (!_paused) markSceneDirty();
        _syncUI();
    }

    function step() {
        if (!_running || _paused || _frame >= _maxFrames || !app.renderer) return false;
        const w = app.renderer.domElement.width || window.innerWidth;
        const h = app.renderer.domElement.height || window.innerHeight;
        _ensureRTs(w, h); _ensureQuad();
        _applyJitter(_frame);
        renderAdvDepth();
        _advU.noiseFrame.value     = _frame;
        _advU.ptNoiseEnabled.value = 1.0;
        composer.render();
        app.renderer.copyFramebufferToTexture(_sampleRT.texture, new THREE.Vector2(0, 0));
        _removeJitter();
        _weight++;
        _blendMat.uniforms.tAccum.value = _accumRT.texture;
        _blendMat.uniforms.tNew.value   = _sampleRT.texture;
        _blendMat.uniforms.uAlpha.value = 1.0 / _weight;
        app.renderer.autoClear = true;
        app.renderer.render(_qScene, _qCam);
        app.renderer.copyFramebufferToTexture(_accumRT.texture, new THREE.Vector2(0, 0));
        _frame++;
        _syncUI();
        if (_frame >= _maxFrames) {
            _running = false;
            _advU.ptNoiseEnabled.value = 0.0;
            _syncUI();
        }
        return true;
    }

    function _syncUI() {
        const fill = document.getElementById('adv-progress-fill');
        const text = document.getElementById('adv-progress-text');
        const pct  = Math.min(_frame / Math.max(_maxFrames, 1) * 100, 100);
        if (fill) fill.style.width = pct + '%';
        if (text) {
            if (!_running && _frame >= _maxFrames) text.textContent = `✅ ${_maxFrames} samples concluídos`;
            else if (_paused) text.textContent = `⏸ Pausado — ${_frame}/${_maxFrames}`;
            else if (_running) text.textContent = `${_frame}/${_maxFrames} samples — ${Math.round(pct)}%`;
            else text.textContent = 'Aguardando...';
        }
    }

    return {
        start, stop, togglePause, step,
        isRunning: () => _running && !_paused,
        isActive:  () => _running,
    };
})();
window._taa = _taa;

// ── Wiring dos toggles da UI Avançada ──────────────────────────────────────────
export function initAdvancedUI() {
    // toggle collapse das seções
    function _bindToggle(toggleId, bodyId, uniformKey) {
        const tog = document.getElementById(toggleId);
        const body = document.getElementById(bodyId);
        if (!tog || !body) return;
        tog.addEventListener('change', () => {
            body.classList.toggle('hidden', !tog.checked);
            if (uniformKey && _advU[uniformKey]) _advU[uniformKey].value = tog.checked ? 1.0 : 0.0;
            _syncAdvPass();
            markSceneDirty();
        });
    }
    _bindToggle('adv-rt-toggle',      'adv-rt-body',      'rtEnabled');
    _bindToggle('adv-pt-toggle',      'adv-pt-body',      null);  // PT noise is via TAA
    _bindToggle('adv-ss-toggle',      'adv-ss-body',      'ssEnabled');
    _bindToggle('adv-vf-toggle',      'adv-vf-body',      'vfEnabled');
    _bindToggle('adv-samples-toggle', 'adv-samples-body', null);

    // PT Blender-like — liga ptNoiseEnabled quando toggle ativo
    document.getElementById('adv-pt-toggle')?.addEventListener('change', (e) => {
        _advU.ptNoiseEnabled.value = e.target.checked ? 1.0 : 0.0;
        _syncAdvPass(); markSceneDirty();
    });

    // Samples start/pause
    document.getElementById('adv-samples-start')?.addEventListener('click', () => {
        const n = parseInt(document.getElementById('adv-sampleCount')?.value ?? '64');
        initAdvancedPass();
        _taa.start(n);
        const loop = () => {
            if (_taa.isActive()) { _taa.step(); requestAnimationFrame(loop); }
        };
        requestAnimationFrame(loop);
    });
    document.getElementById('adv-samples-pause')?.addEventListener('click', () => _taa.togglePause());

    // Render mode buttons (Padrão / PT Cycles / PT Blender-like)
    document.querySelectorAll('[data-render-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-render-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.renderMode;
            if (mode === 'pt-cycles') {
                _advU.rtEnabled.value = 1.0;
                _advU.ptNoiseEnabled.value = 0.0;
            } else if (mode === 'pt-blender') {
                _advU.rtEnabled.value = 0.0;
                _advU.ptNoiseEnabled.value = 1.0;
            } else {
                _advU.rtEnabled.value = 0.0;
                _advU.ptNoiseEnabled.value = 0.0;
            }
            _syncAdvPass();
            markSceneDirty();
        });
    });
}


export function downloadCurrentFrame() {
  if (!app.renderer) return;
  const url = app.renderer.domElement.toDataURL('image/png');
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: `render-${Date.now()}.png`
  });
  document.body.appendChild(link);
  link.click();
  link.remove();
}