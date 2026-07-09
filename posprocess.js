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