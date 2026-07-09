import {
  initScene,
  addPrimitive,
  setGizmoMode,
  clearSelection,
  setRenderPreviewMode,
  markSceneDirty,
  app
} from './scene.js';

import { startRenderLoop } from './render.js';
import { initMaterialUI, syncMaterialUI } from './material.js';
import {
  initPostProcess,
  setRenderModeValue,
  setPostProcessValue,
  setBloomValue,
  setObjBloomField,
  getObjBloom,
  updateOutlineSelected,
  downloadCurrentFrame,
  setVisualizationMode,
  toggleLayer,
  setLayerConfig,
  activeLayers,
} from './posprocess.js';
import {
  setSamplesValue,
  setSubSamplesValue,
  setAccumulationValue,
  setResetOnMoveValue,
  setTargetSamplesValue,
  setNoiseModeValue,
  setPostValue,
  setBloomValue as setBloomFieldValue,
  setRayValue,
  setPathValue
} from './shader.js';
import { addLight } from './lights.js';
import { initConfig } from './config.js';
import {
  initUndoRedo, pushState, undo, redo, canUndo, canRedo,
  onHistoryChange, captureTransformState, recordTransform,
} from './undo-redo.js';
// simulation.js removed — replaced by Particle Labs

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setActiveButton(group, active) {
  group.forEach((b) => b.classList.toggle('active', b === active));
}
function bindNumber(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => fn(Number(el.value)));
}
function bindCheckbox(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', () => fn(el.checked));
}

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  initScene(document.body);
  window._app = app;  // expose globally so bottom bar + Labs stats can access scene
  initMaterialUI();
  initPostProcess();
  startRenderLoop();
  await initConfig(app);   // must be awaited — uses async import for grid functions
  initUndoRedo();
  // initSimulation removed — replaced by Particle Labs

  // ── Particle Labs bootstrap ───────────────────────────────────────────────
  // particle-engine.js exposes window._ParticleEngine (loaded as a separate
  // <script type="module"> tag in index.html, before this main.js bundle).
  if (window._ParticleEngine && app.scene) {
    window._nexusParticleLab = new window._ParticleEngine.ParticleLab(app.scene);
  }
  // Fire once render loop + scene are ready so the Labs UI controller
  // (inline script at the bottom of index.html) can build its preset grid
  // and particle list.
  setTimeout(() => window.dispatchEvent(new Event('_nexusEngineReady')), 50);

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');

  onHistoryChange((canU, canR) => {
    if (undoBtn) undoBtn.disabled = !canU;
    if (redoBtn) redoBtn.disabled = !canR;
  });

  undoBtn?.addEventListener('click', () => { undo(); markSceneDirty(); });
  redoBtn?.addEventListener('click', () => { redo(); markSceneDirty(); });

  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); markSceneDirty(); }
    if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); markSceneDirty(); }
  });

  // Record transform on gizmo drag end
  let _transformSnapshot = null;
  app.transformControls?.addEventListener('mouseDown', () => {
    if (app.selected) _transformSnapshot = captureTransformState(app.selected);
  });
  app.transformControls?.addEventListener('mouseUp', () => {
    if (app.selected && _transformSnapshot) {
      const next = captureTransformState(app.selected);
      recordTransform(app.selected, _transformSnapshot, next);
      _transformSnapshot = null;
    }
  });

  // ── Left panel ────────────────────────────────────────────────────────────
  const leftPanelBtns = {
    add:      document.getElementById('addToggle'),
    material: document.getElementById('materialToggle'),
    lights:   document.getElementById('lightsToggle'),
    render:   document.getElementById('renderToggle'),
    camera:   document.getElementById('cameraToggle'),
  };
  const leftSubPanels = {
    add:      document.getElementById('addPanel'),
    material: document.getElementById('materialPanel'),
    lights:   document.getElementById('lightsPanel'),
    render:   document.getElementById('renderPanel'),
    camera:   document.getElementById('cameraPanel'),
  };
  let activeLeftPanel = null;

  function openLeftPanel(name) {
    Object.keys(leftSubPanels).forEach((k) => {
      leftSubPanels[k].classList.add('hidden');
      leftPanelBtns[k].classList.remove('active');
    });
    if (activeLeftPanel === name) { activeLeftPanel = null; return; }
    activeLeftPanel = name;
    leftSubPanels[name].classList.remove('hidden');
    leftPanelBtns[name].classList.add('active');
    if (name === 'material') syncMaterialUI();
    if (name === 'lights') syncLightUI();
  }
  Object.keys(leftPanelBtns).forEach((name) => {
    leftPanelBtns[name].addEventListener('click', () => openLeftPanel(name));
  });

  // ── Labs-mode left panel swap ───────────────────────────────────────────
  // When Particle Labs is toggled on (via the Settings menu), the entire
  // left panel becomes the SFM-style function palette — the normal
  // Add/Material/Luzes/Render/Camera tools are hidden and replaced.
  const normalLeftPanel = document.getElementById('leftPanel');
  const labsLeftPanel   = document.getElementById('labsLeftPanel');
  window.addEventListener('_labsModeChange', (e) => {
    const labsOn = !!e.detail?.active;
    if (normalLeftPanel) normalLeftPanel.classList.toggle('hidden', labsOn);
    if (labsLeftPanel)   labsLeftPanel.classList.toggle('hidden', !labsOn);
    if (labsOn) {
      // Close whatever normal sub-panel was open so it doesn't linger
      // hidden-but-"active" underneath, and detach the transform gizmo
      // from any non-particle object so it doesn't visually persist
      // while the user works in Labs mode.
      Object.keys(leftSubPanels).forEach((k) => {
        leftSubPanels[k].classList.add('hidden');
        leftPanelBtns[k].classList.remove('active');
      });
      activeLeftPanel = null;
    }
  });

  // ── Light panel ───────────────────────────────────────────────────────────
  const lightTypeLabel      = document.getElementById('lightTypeLabel');
  const lightColor          = document.getElementById('lightColor');
  const lightIntensity      = document.getElementById('lightIntensity');
  const lightDistance       = document.getElementById('lightDistance');
  const lightDistanceRow    = document.getElementById('lightDistanceRow');
  const lightShadowMapSize  = document.getElementById('lightShadowMapSize');
  const lightShadowBias     = document.getElementById('lightShadowBias');
  const lightShadowRadius   = document.getElementById('lightShadowRadius');
  const lightShadowNear     = document.getElementById('lightShadowNear');
  const lightShadowFar      = document.getElementById('lightShadowFar');
  const selectedLightSec    = document.getElementById('selectedLightSection');
  const noLightSelected     = document.getElementById('noLightSelected');

  function syncLightUI() {
    const group = app.selected;
    if (!group || !group.userData.isLightObject) {
      selectedLightSec.classList.add('hidden');
      noLightSelected.classList.remove('hidden');
      return;
    }
    selectedLightSec.classList.remove('hidden');
    noLightSelected.classList.add('hidden');
    const light = group.userData.lightRef;
    const type  = group.userData.lightType;
    lightTypeLabel.textContent = group.name;
    lightColor.value     = '#' + light.color.getHexString();
    lightIntensity.value = light.intensity;
    const hasDist = type === 'point' || type === 'spot';
    lightDistanceRow.classList.toggle('hidden', !hasDist);
    if (hasDist) lightDistance.value = light.distance ?? 0;
    // Shadow
    const mapSize = light.castShadow ? (light.shadow?.mapSize?.width ?? 1024) : 0;
    lightShadowMapSize.value = mapSize;
    lightShadowBias.value    = light.shadow?.bias    ?? 0;
    lightShadowRadius.value  = light.shadow?.radius  ?? 1;
    lightShadowNear.value    = light.shadow?.camera?.near ?? 0.5;
    lightShadowFar.value     = light.shadow?.camera?.far  ?? 500;
  }

  lightColor.addEventListener('input', () => {
    const g = app.selected;
    if (!g?.userData.isLightObject) return;
    g.userData.lightRef.color.set(lightColor.value);
    if (g.userData.modelRef?.isSprite) {
      g.userData.modelRef.material.color.set(lightColor.value);
      g.userData.modelRef.material.needsUpdate = true;
    }
    markSceneDirty();
  });
  lightIntensity.addEventListener('input', () => {
    if (!app.selected?.userData.isLightObject) return;
    app.selected.userData.lightRef.intensity = Number(lightIntensity.value);
    markSceneDirty();
  });
  lightDistance.addEventListener('input', () => {
    if (!app.selected?.userData.isLightObject) return;
    app.selected.userData.lightRef.distance = Number(lightDistance.value);
    markSceneDirty();
  });

  // Shadow numeric controls — map size 0 = shadows off
  function _applyShadow() {
    if (!app.selected?.userData.isLightObject) return;
    const light = app.selected.userData.lightRef;
    const size  = Math.round(Number(lightShadowMapSize.value));
    if (size <= 0) {
      light.castShadow = false;
    } else {
      light.castShadow = true;
      if (light.shadow) {
        light.shadow.mapSize.width  = size;
        light.shadow.mapSize.height = size;
        light.shadow.bias           = Number(lightShadowBias.value);
        light.shadow.radius         = Number(lightShadowRadius.value);
        if (light.shadow.camera) {
          light.shadow.camera.near = Number(lightShadowNear.value);
          light.shadow.camera.far  = Number(lightShadowFar.value);
          light.shadow.camera.updateProjectionMatrix();
        }
        light.shadow.map?.dispose();
        light.shadow.map = null; // force shadow map rebuild
      }
      if (app.renderer) {
        app.renderer.shadowMap.enabled = true;
        app.renderer.shadowMap.needsUpdate = true;
      }
    }
    markSceneDirty();
  }
  lightShadowMapSize.addEventListener('input', _applyShadow);
  lightShadowBias.addEventListener('input',    _applyShadow);
  lightShadowRadius.addEventListener('input',  _applyShadow);
  lightShadowNear.addEventListener('input',    _applyShadow);
  lightShadowFar.addEventListener('input',     _applyShadow);

  // ── Model import ──────────────────────────────────────────────────────────
  const importModelBtn  = document.getElementById('importModelBtn');
  const modelFilePicker = document.getElementById('modelFilePicker');

  importModelBtn.addEventListener('click', () => modelFilePicker.click());

  modelFilePicker.addEventListener('change', async () => {
    const file = modelFilePicker.files?.[0];
    if (!file) return;
    modelFilePicker.value = '';
    await importModel(file);
  });

  async function importModel(file) {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const name = file.name.toLowerCase();
    let arrayBuffer;
    // Map of filename (basename) -> blob URL for textures from ZIP
    const blobURLs = [];
    let resourcePathBase = '';
    let manager = null;

    if (name.endsWith('.zip')) {
      const JSZip = window.JSZip;
      if (!JSZip) { alert('JSZip não carregou. Verifique conexão.'); return; }
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter((f) => !f.dir);

      const gltfEntry = entries.find((f) => /\.(glb|gltf)$/i.test(f.name));
      if (!gltfEntry) { alert('Nenhum .glb ou .gltf encontrado dentro do .zip'); return; }

      // Extract all files and build a name->blobURL map
      const fileMap = {};
      await Promise.all(entries.map(async (entry) => {
        const blob = await entry.async('blob');
        const basename = entry.name.split('/').pop();
        const url = URL.createObjectURL(blob);
        blobURLs.push(url);
        // Map both full path and basename so either reference works
        fileMap[entry.name] = url;
        fileMap[basename] = url;
      }));

      arrayBuffer = await gltfEntry.async('arraybuffer');

      // Custom LoadingManager that intercepts texture URL requests
      const { LoadingManager } = await import('three');
      manager = new LoadingManager();
      manager.setURLModifier((url) => {
        // Try exact match first, then basename match
        const basename = url.split('/').pop().split('?')[0];
        if (fileMap[url]) return fileMap[url];
        if (fileMap[basename]) return fileMap[basename];
        // Try matching any path suffix
        const found = Object.keys(fileMap).find(
          (k) => url.endsWith(k) || url.includes(k)
        );
        if (found) return fileMap[found];
        return url;
      });
    } else {
      arrayBuffer = await file.arrayBuffer();
    }

    const { GLTFLoader: GLTFLoaderClass } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = manager ? new GLTFLoaderClass(manager) : new GLTFLoaderClass();
    loader.parse(arrayBuffer, '', (gltf) => {
      // Revoke blob URLs after model loaded to free memory
      blobURLs.forEach((u) => URL.revokeObjectURL(u));
      const root = gltf.scene;
      root.name = file.name.replace(/\.[^.]+$/, '');
      // Mark as imported model so the save system serializes geometry + textures
      root.userData.isImportedModel = true;
      app.scene.add(root);
      app.objects.push(root);
      // Enable shadows on all meshes inside the model
      root.traverse((o) => {
        if (o.isMesh || o.isSkinnedMesh) {
          o.castShadow    = true;
          o.receiveShadow = true;
        }
      });
      // Center model
      import('three').then(({ Box3, Vector3 }) => {
        const box = new Box3().setFromObject(root);
        const center = new Vector3();
        box.getCenter(center);
        root.position.sub(center);
        root.position.y = 0;
      });
      markSceneDirty();
      renderObjectsList();
      checkSceneForSkeletons();
    }, (err) => {
      alert('Erro ao carregar modelo: ' + err.message);
    });
  }

  // ── Render preview ────────────────────────────────────────────────────────
  let renderPreviewActive = false;
  const renderPreviewToggle = document.getElementById('renderPreviewToggle');
  renderPreviewToggle.addEventListener('click', () => {
    renderPreviewActive = !renderPreviewActive;
    renderPreviewToggle.classList.toggle('active', renderPreviewActive);
    setRenderPreviewMode(renderPreviewActive);
  });

  // ── Add primitives / lights ───────────────────────────────────────────────
  Array.from(document.querySelectorAll('[data-add]')).forEach((btn) => {
    btn.addEventListener('click', () => {
      addPrimitive(btn.dataset.add);
      syncMaterialUI();
      renderObjectsList();
      pushState();
    });
  });
  Array.from(document.querySelectorAll('[data-add-light]')).forEach((btn) => {
    btn.addEventListener('click', () => {
      addLight(btn.dataset.addLight);
      renderObjectsList();
      pushState();
    });
  });

  // ── Gizmo ─────────────────────────────────────────────────────────────────
  const gizmoButtons = Array.from(document.querySelectorAll('[data-mode]'));
  gizmoButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setGizmoMode(btn.dataset.mode);
      setActiveButton(gizmoButtons, btn);
    });
  });

  // ── Deep-select toggle ────────────────────────────────────────────────────
  const deepSelectBtn = document.getElementById('deepSelectBtn');
  deepSelectBtn.addEventListener('click', () => {
    app.deepSelectMode = !app.deepSelectMode;
    deepSelectBtn.classList.toggle('active', app.deepSelectMode);
    deepSelectBtn.title = app.deepSelectMode
      ? 'Selecionar dentro de grupo: ATIVO (clique para desativar)'
      : 'Selecionar dentro de grupo (clique em objetos agrupados/importados)';
  });

  // ── Render tabs ───────────────────────────────────────────────────────────
  const tabButtons = Array.from(document.querySelectorAll('[data-tab]'));
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tabPanel').forEach((p) => {
        p.classList.toggle('hidden', p.id !== tab);
      });
    });
  });

  // ── Engine mode buttons (exclusive) ──────────────────────────────────────
  const renderModeButtons = Array.from(document.querySelectorAll('[data-render-mode]'));
  renderModeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.renderMode;
      setRenderModeValue(mode);
      setActiveButton(renderModeButtons, btn);
    });
  });

  // ── Layer buttons (multi-select, Blender-style) ────────────────────────
  const visModePanel       = document.getElementById('visModePanel');
  const outlineLayerPanel  = document.getElementById('outlineLayerPanel');
  const filmLayerPanel     = document.getElementById('filmLayerPanel');
  const bokehLayerPanel    = document.getElementById('bokehLayerPanel');

  const layerButtons = Array.from(document.querySelectorAll('[data-layer]'));
  layerButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const layer = btn.dataset.layer;
      const isNowActive = !btn.classList.contains('active');
      btn.classList.toggle('active', isNowActive);
      toggleLayer(layer, isNowActive);

      // Show/hide sub-panels
      visModePanel?.classList.toggle('hidden',
        !activeLayers.has('visualization'));
      outlineLayerPanel?.classList.toggle('hidden',
        !activeLayers.has('outline'));
      filmLayerPanel?.classList.toggle('hidden',
        !activeLayers.has('film'));
      bokehLayerPanel?.classList.toggle('hidden',
        !activeLayers.has('bokeh'));

      // When enabling visualization layer, apply active vis mode
      if (layer === 'visualization' && isNowActive) {
        const activeVis = document.querySelector('.visModeBtn.active');
        setVisualizationMode(activeVis?.dataset?.visMode || 'normals');
      } else if (layer === 'visualization' && !isNowActive) {
        setVisualizationMode(null);
      }
    });
  });

  // ── Visualization sub-mode buttons ────────────────────────────────────────
  const visModeButtons = Array.from(document.querySelectorAll('[data-vis-mode]'));
  visModeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveButton(visModeButtons, btn);
      setVisualizationMode(btn.dataset.visMode);
    });
  });

  // ── Layer sub-panel bindings ───────────────────────────────────────────────
  bindNumber('outlineStrength',  (v) => setLayerConfig('outline','strength',v));
  bindNumber('outlineGlow',      (v) => setLayerConfig('outline','glow',v));
  bindNumber('outlineThickness', (v) => setLayerConfig('outline','thickness',v));
  bindNumber('filmNoise',        (v) => setLayerConfig('film','noise',v));
  bindNumber('filmScanlines',    (v) => setLayerConfig('film','scanlines',v));
  bindNumber('bokehFocus',       (v) => setLayerConfig('bokeh','focus',v));
  bindNumber('bokehAperture',    (v) => setLayerConfig('bokeh','aperture',v));
  bindNumber('bokehMaxblur',     (v) => setLayerConfig('bokeh','maxblur',v));

  // ── Shader bindings ───────────────────────────────────────────────────────
  bindNumber  ('sampleCount',      setSamplesValue);
  bindNumber  ('subSamples',       setSubSamplesValue);
  bindCheckbox('sampleAccumulate', setAccumulationValue);
  bindCheckbox('sampleResetOnMove',setResetOnMoveValue);
  bindNumber  ('targetSamples',    setTargetSamplesValue);
  bindCheckbox('noiseMode',        setNoiseModeValue);
  bindCheckbox('postEnabled', (v) => { setPostProcessValue(v); setPostValue('enabled', v); });
  bindNumber('postExposure',   (v) => setPostValue('exposure', v));
  bindNumber('postContrast',   (v) => setPostValue('contrast', v));
  bindNumber('postSaturation', (v) => setPostValue('saturation', v));
  bindNumber('postVignette',   (v) => setPostValue('vignette', v));
  bindCheckbox('bloomEnabled', (v) => { setBloomValue(v); setBloomFieldValue('enabled', v); });
  bindNumber('bloomThreshold', (v) => setBloomFieldValue('threshold', v));
  bindNumber('bloomStrength',  (v) => setBloomFieldValue('strength', v));
  bindNumber('bloomRadius',    (v) => setBloomFieldValue('radius', v));

  // ── Per-object persistent bloom ──────────────────────────────────────────
  // Each object keeps its own bloom settings in userData.bloom.
  // Selecting an object loads its settings into the UI.
  // Changing a setting writes back to that specific object — persists after deselect.

  const bloomObjSection = document.getElementById('bloomObjSection');
  const bloomObjName    = document.getElementById('bloomObjName');

  let _bloomObjTarget = null; // the object currently shown in the bloom UI

  function loadBloomObjUI(obj) {
    _bloomObjTarget = obj && !obj.userData?.isLightObject ? obj : null;
    const hasObj = !!_bloomObjTarget;
    bloomObjSection.classList.toggle('hasSelection', hasObj);
    bloomObjName.textContent = hasObj ? (_bloomObjTarget.name || 'Sem nome') : '—';

    const inputs = ['bloomObjEnabled','bloomObjThreshold','bloomObjStrength','bloomObjRadius'];
    inputs.forEach((id) => { document.getElementById(id).disabled = !hasObj; });

    if (hasObj) {
      const b = getObjBloom(_bloomObjTarget);
      document.getElementById('bloomObjEnabled').checked           = b.enabled;
      document.getElementById('bloomObjThreshold').value           = b.threshold;
      document.getElementById('bloomObjStrength').value            = b.strength;
      document.getElementById('bloomObjRadius').value              = b.radius;
    }
  }

  // Bind inputs — write to _bloomObjTarget.userData.bloom
  document.getElementById('bloomObjEnabled').addEventListener('change', (e) => {
    setObjBloomField(_bloomObjTarget, 'enabled', e.target.checked);
  });
  document.getElementById('bloomObjThreshold').addEventListener('input', (e) => {
    setObjBloomField(_bloomObjTarget, 'threshold', parseFloat(e.target.value));
  });
  document.getElementById('bloomObjStrength').addEventListener('input', (e) => {
    setObjBloomField(_bloomObjTarget, 'strength', parseFloat(e.target.value));
  });
  document.getElementById('bloomObjRadius').addEventListener('input', (e) => {
    setObjBloomField(_bloomObjTarget, 'radius', parseFloat(e.target.value));
  });

  // Load UI when selection changes
  window.addEventListener('scene-selection-changed', (e) => {
    // Expose selected object globally for AnimationSystem and bottom bar
    window.activeObject = e.detail?.object ?? null;
    loadBloomObjUI(e.detail?.object ?? null);
  });
  loadBloomObjUI(null);


  bindNumber  ('rayBounces',       (v) => setRayValue('bounces', v));
  bindNumber  ('rayFilterGlossy',  (v) => setRayValue('filterGlossyFactor', v));
  bindNumber  ('rayTilesX',        (v) => setRayValue('tilesX', v));
  bindNumber  ('rayTilesY',        (v) => setRayValue('tilesY', v));
  bindNumber  ('rayRenderDelay',   (v) => setRayValue('renderDelay', v));
  bindNumber  ('rayFadeDuration',  (v) => setRayValue('fadeDuration', v));
  bindNumber  ('rayMinSamples',    (v) => setRayValue('minSamples', v));
  bindCheckbox('rayDynamicLowRes', (v) => setRayValue('dynamicLowRes', v));
  bindNumber  ('rayLowResScale',   (v) => setRayValue('lowResScale', v));
  bindNumber  ('rayRenderScale',   (v) => setRayValue('renderScale', v));
  bindNumber  ('ptBounces',          (v) => setPathValue('bounces', v));
  bindNumber  ('ptFilterGlossy',     (v) => setPathValue('filterGlossyFactor', v));
  bindNumber  ('ptTilesX',           (v) => setPathValue('tilesX', v));
  bindNumber  ('ptTilesY',           (v) => setPathValue('tilesY', v));
  bindNumber  ('ptRenderDelay',      (v) => setPathValue('renderDelay', v));
  bindNumber  ('ptFadeDuration',     (v) => setPathValue('fadeDuration', v));
  bindNumber  ('ptMinSamples',       (v) => setPathValue('minSamples', v));
  bindCheckbox('ptDynamicLowRes',    (v) => setPathValue('dynamicLowRes', v));
  bindNumber  ('ptLowResScale',      (v) => setPathValue('lowResScale', v));
  bindNumber  ('ptRenderScale',      (v) => setPathValue('renderScale', v));
  bindNumber  ('ptFocusDistance',    (v) => setPathValue('focusDistance', v));
  bindNumber  ('ptFStop',            (v) => setPathValue('fStop', v));
  bindNumber  ('ptApertureBlades',   (v) => setPathValue('apertureBlades', v));
  bindNumber  ('ptApertureRotation', (v) => setPathValue('apertureRotation', v));
  bindNumber  ('ptAnamorphicRatio',  (v) => setPathValue('anamorphicRatio', v));
  document.getElementById('downloadImageBtn').addEventListener('click', downloadCurrentFrame);

  // ──────────────────────────────────────────────────────────────────────────
  //  RIGHT PANEL — Objects List
  // ──────────────────────────────────────────────────────────────────────────
  const objectsList    = document.getElementById('objectsList');
  const objectsSection = document.getElementById('objectsSection');
  const selectedUUIDs  = new Set();
  const expandedGroups = new Set();

  const ICON = {
    light:    `<svg viewBox="0 0 24 24"><path d="M9 21h6"/><path d="M12 3a6 6 0 0 1 4.5 10.1c-.8.9-1.3 1.8-1.5 2.9H9c-.2-1.1-.7-2-1.5-2.9A6 6 0 0 1 12 3z"/></svg>`,
    mesh:     `<svg viewBox="0 0 24 24"><path d="M6 8l6-4 6 4-6 4-6-4Z"/><path d="M6 8v8l6 4 6-4V8"/><path d="M12 12v8"/></svg>`,
    group:    `<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>`,
    skinned:  `<svg viewBox="0 0 24 24"><path d="M6 8l6-4 6 4-6 4-6-4Z"/><path d="M6 8v8l6 4 6-4V8"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`,
    particle: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="5" cy="6" r="1.2" fill="currentColor" opacity=".6"/><circle cx="19" cy="6" r="1" fill="currentColor" opacity=".5"/><circle cx="7" cy="18" r="1.4" fill="currentColor" opacity=".7"/><circle cx="17" cy="17" r="1" fill="currentColor" opacity=".4"/><circle cx="12" cy="4" r=".9" fill="currentColor" opacity=".5"/></svg>`,
    camera:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7L16 12l7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
  };

  function isUserObject(obj) {
    if (!app.scene)                          return false;
    if (obj === app.gridRoot)                return false;
    if (obj === app.axesHelper)              return false;
    if (obj === app.transformControls)       return false;
    if (obj === app._tcHelper)               return false;
    if (obj.isLight)                         return false;
    if (obj.userData.isHelper)               return false;
    if (obj.userData.isLightObject)          return true;
    if (obj.userData.isLabMarker)            return true;
    if (obj.userData.isSceneCamera)          return true;   // scene cameras ✓
    if (obj.isMesh && !obj.name)             return false;
    if (obj.isGroup && !obj.userData.isLightObject && !obj.name) return false;
    return !!(obj.name && obj.name.trim().length > 0);
  }

  function getUserTopLevel() {
    return app.scene ? app.scene.children.filter(isUserObject) : [];
  }

  function getUserChildren(group) {
    return group.children.filter((c) => {
      if (c.isLight && !c.userData.isLightObject) return false;
      return c.isMesh || c.isSkinnedMesh || c.isGroup || c.userData.isLightObject;
    });
  }

  function renderObjectsList() {
    if (!app.scene) return;
    const top = getUserTopLevel();
    if (top.length === 0) {
      objectsList.innerHTML = '<div class="objectsEmpty">Cena vazia.<br>Adicione objetos pelo painel.</div>';
      return;
    }
    let html = '';
    for (const obj of top) html += buildObjectRow(obj, 0);
    objectsList.innerHTML = html;
    attachListListeners();
  }

  function buildObjectRow(obj, depth) {
    const isSel   = selectedUUIDs.has(obj.uuid);
    const isGrp   = obj.isGroup && !obj.userData.isLightObject;
    const isExp   = expandedGroups.has(obj.uuid);
    const isSkinned = obj.isSkinnedMesh;
    const pad     = 8 + depth * 14;

    const icon = obj.userData.isLightObject  ? ICON.light
               : obj.userData.isLabMarker   ? ICON.particle
               : obj.userData.isSceneCamera ? ICON.camera
               : isSkinned                  ? ICON.skinned
               : isGrp                      ? ICON.group
               : ICON.mesh;

    let html = `<div class="objectItem${isSel ? ' selected' : ''}" data-uuid="${obj.uuid}" style="padding-left:${pad}px">
      ${isGrp
        ? `<button class="groupToggleBtn" data-group-uuid="${obj.uuid}" type="button"><svg class="groupArrow${isExp?' expanded':''}" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button>`
        : `<span class="groupToggleSpacer"></span>`}
      ${icon}
      <span class="objectName">${obj.name || obj.type}</span>
    </div>`;

    if (isGrp && isExp) {
      for (const child of getUserChildren(obj)) html += buildObjectRow(child, depth + 1);
    }
    return html;
  }

  function attachListListeners() {
    objectsList.querySelectorAll('.groupToggleBtn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uuid = btn.dataset.groupUuid;
        expandedGroups.has(uuid) ? expandedGroups.delete(uuid) : expandedGroups.add(uuid);
        renderObjectsList();
      });
    });

    objectsList.querySelectorAll('.objectItem').forEach((el) => {
      el.addEventListener('click', () => {
        const uuid = el.dataset.uuid;
        if (selectedUUIDs.has(uuid)) {
          selectedUUIDs.delete(uuid);
          if (app.selected?.uuid === uuid) {
            app.transformControls?.detach();
            app.selected = null;
            window.dispatchEvent(new CustomEvent('scene-selection-changed', { detail: { object: null } }));
          }
        } else {
          selectedUUIDs.add(uuid);
          const found = findByUUID(app.scene, uuid);
          if (found && app.transformControls) {
            app.transformControls.attach(found);
            app.selected = found;
            window.dispatchEvent(new CustomEvent('scene-selection-changed', { detail: { object: found } }));
          }
        }
        renderObjectsList();
      });
    });
  }

  function findByUUID(root, uuid) {
    let found = null;
    root.traverse((o) => { if (o.uuid === uuid) found = o; });
    return found;
  }

  setTimeout(renderObjectsList, 150);

  // Refresh hierarchy when particle systems are added or removed
  window.addEventListener('labs-systems-changed', renderObjectsList);

  // ══════════════════════════════════════════════════════════════════════════
  //  FLOAT PANEL — 2.5 s segurado num objeto → portátil, arrastável, ao vivo
  // ══════════════════════════════════════════════════════════════════════════
  const floatPanel = document.getElementById('floatPanel');
  const fpHeader   = document.getElementById('fpHeader');
  const fpClose    = document.getElementById('fpClose');
  const $fp = id => document.getElementById(id);

  let _fpTicker = null;
  let _fpTarget = null;

  // ── Populate static info ─────────────────────────────────────────────────
  function _fpPopulate(obj) {
    _fpTarget = obj;
    if ($fp('fpTitle')) $fp('fpTitle').textContent = obj.name || 'Objeto';
    const type = obj.userData.isLabMarker   ? 'Particle'
               : obj.userData.isLightObject ? 'Luz'
               : obj.isSkinnedMesh          ? 'Skinned'
               : obj.isMesh                 ? 'Mesh'
               : obj.isGroup                ? 'Grupo'
               : 'Object3D';
    if ($fp('fpType')) $fp('fpType').textContent = type;
    const geoSec = $fp('fpGeoSection');
    const matSec = $fp('fpMatSection');
    if (obj.isMesh && obj.geometry) {
      const geo   = obj.geometry;
      const verts = geo.attributes?.position?.count ?? 0;
      const tris  = geo.index ? geo.index.count / 3 : verts / 3;
      if ($fp('fpVerts')) $fp('fpVerts').textContent = verts.toLocaleString();
      if ($fp('fpTris'))  $fp('fpTris').textContent  = Math.round(tris).toLocaleString();
      geo.computeBoundingBox?.();
      const bb = geo.boundingBox;
      if (bb) {
        const f2 = v => v.toFixed(2);
        if ($fp('fpBBW')) $fp('fpBBW').textContent = f2(bb.max.x - bb.min.x);
        if ($fp('fpBBH')) $fp('fpBBH').textContent = f2(bb.max.y - bb.min.y);
        if ($fp('fpBBD')) $fp('fpBBD').textContent = f2(bb.max.z - bb.min.z);
      }
      if (geoSec) geoSec.style.display = '';
      if (obj.material && matSec) {
        const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        if ($fp('fpMatName')) $fp('fpMatName').textContent = mat.name || '(sem nome)';
        if ($fp('fpMatType')) $fp('fpMatType').textContent = (mat.type || '').replace('Material', '');
        matSec.style.display = '';
      } else { if (matSec) matSec.style.display = 'none'; }
    } else {
      if (geoSec) geoSec.style.display = 'none';
      if (matSec) matSec.style.display = 'none';
    }
  }

  // ── Live tick ────────────────────────────────────────────────────────────
  function _fpTick() {
    const obj = _fpTarget; if (!obj) return;
    const f3  = v => v.toFixed(3);
    const r2d = v => (v * 180 / Math.PI).toFixed(1);
    if ($fp('fpPX')) $fp('fpPX').textContent = f3(obj.position.x);
    if ($fp('fpPY')) $fp('fpPY').textContent = f3(obj.position.y);
    if ($fp('fpPZ')) $fp('fpPZ').textContent = f3(obj.position.z);
    if ($fp('fpRX')) $fp('fpRX').textContent = r2d(obj.rotation.x) + '\u00b0';
    if ($fp('fpRY')) $fp('fpRY').textContent = r2d(obj.rotation.y) + '\u00b0';
    if ($fp('fpRZ')) $fp('fpRZ').textContent = r2d(obj.rotation.z) + '\u00b0';
    if ($fp('fpSX')) $fp('fpSX').textContent = f3(obj.scale.x);
    if ($fp('fpSY')) $fp('fpSY').textContent = f3(obj.scale.y);
    if ($fp('fpSZ')) $fp('fpSZ').textContent = f3(obj.scale.z);
  }

  // ── Show ─────────────────────────────────────────────────────────────────
  function _fpShow(screenX, screenY) {
    if (!floatPanel || !_fpTarget) return;
    const W = window.innerWidth, H = window.innerHeight;
    const panW = 234, panH = 200;
    let left = screenX + 14;
    if (left + panW > W - 8) left = screenX - panW - 14;
    let top = screenY - panH / 2;
    if (top < 62) top = 62;
    if (top + panH > H - 62) top = H - 62 - panH;
    left = Math.max(4, left);
    floatPanel.style.left = left + 'px';
    floatPanel.style.top  = top  + 'px';
    floatPanel.classList.remove('hidden', 'fp-out');
    requestAnimationFrame(() => floatPanel.classList.add('fp-in'));
    if (_fpTicker) clearInterval(_fpTicker);
    _fpTicker = setInterval(_fpTick, 100);
    _fpTick();
  }

  // ── Hide ─────────────────────────────────────────────────────────────────
  function _fpHide() {
    if (!floatPanel || floatPanel.classList.contains('hidden')) return;
    floatPanel.classList.remove('fp-in');
    floatPanel.classList.add('fp-out');
    if (_fpTicker) { clearInterval(_fpTicker); _fpTicker = null; }
    setTimeout(() => {
      floatPanel.classList.add('hidden');
      floatPanel.classList.remove('fp-out');
      _fpTarget = null;
    }, 180);
  }

  fpClose?.addEventListener('click', _fpHide);

  // ── Drag by header ───────────────────────────────────────────────────────
  if (floatPanel && fpHeader) {
    let _dragOx = 0, _dragOy = 0, _fpDrag = false;
    fpHeader.addEventListener('pointerdown', e => {
      e.stopPropagation();
      _fpDrag = true;
      _dragOx = e.clientX - parseFloat(floatPanel.style.left || 0);
      _dragOy = e.clientY - parseFloat(floatPanel.style.top  || 0);
      fpHeader.setPointerCapture(e.pointerId);
    });
    fpHeader.addEventListener('pointermove', e => {
      if (!_fpDrag) return;
      const W = window.innerWidth, H = window.innerHeight;
      floatPanel.style.left = Math.max(0, Math.min(e.clientX - _dragOx, W - 234)) + 'px';
      floatPanel.style.top  = Math.max(0, Math.min(e.clientY - _dragOy, H - 80))  + 'px';
    });
    fpHeader.addEventListener('pointerup',    () => { _fpDrag = false; });
    fpHeader.addEventListener('pointercancel',() => { _fpDrag = false; });
  }

  // ── Long press — 2.5 s, sem anel ────────────────────────────────────────
  let _pressTimer = null;
  let _pressX = 0, _pressY = 0;
  const HOLD_MS  = 2500;
  const MOVE_TOL = 14;

  function _startPress(cx, cy) {
    if (!app.selected) return;
    _pressX = cx; _pressY = cy;
    if (_pressTimer) clearTimeout(_pressTimer);
    _pressTimer = setTimeout(() => {
      _pressTimer = null;
      _fpPopulate(app.selected);
      _fpShow(cx, cy);
      if (navigator.vibrate) navigator.vibrate([12, 16, 12]);
    }, HOLD_MS);
  }
  function _cancelPress() {
    if (_pressTimer) { clearTimeout(_pressTimer); _pressTimer = null; }
  }

  const canvas = app.renderer?.domElement;
  if (canvas) {
    canvas.addEventListener('touchstart', e => {
      _fpHide();
      const t = e.touches[0];
      _startPress(t.clientX, t.clientY);
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      const t = e.touches[0];
      if (Math.hypot(t.clientX - _pressX, t.clientY - _pressY) > MOVE_TOL) _cancelPress();
    }, { passive: true });
    canvas.addEventListener('touchend',    _cancelPress, { passive: true });
    canvas.addEventListener('touchcancel', _cancelPress, { passive: true });
    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      _fpHide();
      _startPress(e.clientX, e.clientY);
    });
    canvas.addEventListener('mousemove', e => {
      if (!_pressTimer) return;
      if (Math.hypot(e.clientX - _pressX, e.clientY - _pressY) > MOVE_TOL) _cancelPress();
    });
    canvas.addEventListener('mouseup', _cancelPress);
  }

  document.addEventListener('pointerdown', e => {
    if (floatPanel && !floatPanel.classList.contains('hidden') && !floatPanel.contains(e.target))
      _fpHide();
  }, { passive: true });

  // ── Scene selection changed ──────────────────────────────────────────────
  window.addEventListener('scene-selection-changed', (e) => {
    const obj = e.detail.object;
    if (obj) { selectedUUIDs.clear(); selectedUUIDs.add(obj.uuid); }
    else selectedUUIDs.clear();
    updateOutlineSelected(obj);
    if (activeLeftPanel === 'lights') syncLightUI();
    if (obj?.userData?.isLightObject && activeLeftPanel !== 'lights') {
      openLeftPanel('lights'); syncLightUI();
    }
    if (activeLeftPanel === 'material') syncMaterialUI();
    updateBonePanel(obj);
    renderObjectsList();
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  BONE VISUALIZATION & PANEL
  // ──────────────────────────────────────────────────────────────────────────
  let currentSkeleton      = null;
  const bonePanelContainer = document.getElementById('bonePanelContainer');
  const bonePanelClose     = document.getElementById('bonePanelClose');
  const boneRevealBtn      = document.getElementById('boneRevealBtn');
  const boneTreeEl         = document.getElementById('boneTree');
  const expandedBones      = new Set();
  let   selectedBoneUUID   = null;   // uuid of the THREE.Bone object
  let   bonePanelVisible   = false;
  let   boneSphereMeshes   = [];     // sphere mesh per bone joint

  // ── Build / clear Blender-style sphere visualization ──────────────────────
  function clearBoneVisualization() {
    boneSphereMeshes.forEach((s) => {
      app.scene?.remove(s);
      s.geometry.dispose();
      s.material.dispose();
    });
    boneSphereMeshes = [];
    app.boneObjects  = [];
    app.boneUpdateFn = null;
  }

  function buildBoneVisualization(skeleton) {
    clearBoneVisualization();
    if (!skeleton || !app.scene) return;
    import('three').then(({ SphereGeometry, MeshBasicMaterial, Mesh, Vector3 }) => {
      const bones = skeleton.bones;
      // Estimate sphere radius from average world-space bone length
      let totalLen = 0, count = 0;
      bones.forEach((b) => {
        if (b.parent?.isBone) { totalLen += b.position.length(); count++; }
      });
      const avgLen = count > 0 ? totalLen / count : 0.08;
      const radius = Math.max(0.018, Math.min(avgLen * 0.38, 0.11));

      bones.forEach((bone) => {
        const geo = new SphereGeometry(radius, 10, 8);
        const mat = new MeshBasicMaterial({
          color: 0xffffff,
          depthTest: false, depthWrite: false,
          transparent: true, opacity: 1.0,
        });
        const sphere = new Mesh(geo, mat);
        sphere.renderOrder = 999;
        sphere.userData.isBoneMarker = true;
        sphere.userData.boneRef      = bone;
        app.scene.add(sphere);
        boneSphereMeshes.push(sphere);
      });

      app.boneObjects = boneSphereMeshes;
      // Sync sphere world positions every frame
      const _wp = new Vector3();
      app.boneUpdateFn = () => {
        boneSphereMeshes.forEach((s) => {
          s.userData.boneRef.getWorldPosition(_wp);
          s.position.copy(_wp);
        });
        markSceneDirty();
      };
    });
  }

  function findSkeleton(obj) {
    if (!obj) return null;
    let sk = null;
    obj.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) sk = o.skeleton; });
    if (!sk && obj.isSkinnedMesh && obj.skeleton) sk = obj.skeleton;
    return sk;
  }

  function checkSceneForSkeletons() {
    let hasSkeleton = false;
    if (app.scene) app.scene.traverse((o) => { if (o.isSkinnedMesh) hasSkeleton = true; });
    boneRevealBtn.classList.toggle('hidden', !hasSkeleton);
    if (!hasSkeleton && bonePanelVisible) closeBonePanel();
  }

  function openBonePanel() {
    bonePanelVisible = true;
    bonePanelContainer.classList.remove('hidden');
    objectsSection.classList.add('split');
    boneRevealBtn.classList.add('active');
  }

  function closeBonePanel() {
    bonePanelVisible = false;
    bonePanelContainer.classList.add('hidden');
    objectsSection.classList.remove('split');
    boneRevealBtn.classList.remove('active');
  }

  bonePanelClose.addEventListener('click', closeBonePanel);
  boneRevealBtn.addEventListener('click', () => {
    if (bonePanelVisible) closeBonePanel();
    else openBonePanel();
  });

  function updateBonePanel(obj) {
    // If a bone sphere was just selected — only sync tree highlight, no rebuild
    if (obj?.userData?.isBoneMarker) {
      selectedBoneUUID = obj.userData.boneRef.uuid;
      if (currentSkeleton) renderBoneTree(currentSkeleton);
      return;
    }
    // New mesh selected — rebuild visualization
    clearBoneVisualization();
    currentSkeleton = null;

    const sk = findSkeleton(obj);
    if (sk && app.scene) {
      currentSkeleton = sk;
      buildBoneVisualization(sk);
      renderBoneTree(sk);
      boneRevealBtn.classList.remove('hidden');
      if (!bonePanelVisible) openBonePanel();
    } else {
      boneTreeEl.innerHTML = '';
      checkSceneForSkeletons();
    }
  }

  function renderBoneTree(skeleton) {
    if (!skeleton) { boneTreeEl.innerHTML = ''; return; }
    const bones = skeleton.bones;
    const roots = bones.filter((b) => !b.parent?.isBone || !bones.includes(b.parent));

    let html = '';
    function walk(bone, depth) {
      const isExp    = expandedBones.has(bone.uuid);
      const isSel    = selectedBoneUUID === bone.uuid;
      const children = bone.children.filter((c) => c.isBone && bones.includes(c));
      const hasKids  = children.length > 0;
      const pad      = 6 + depth * 12;
      html += `<div class="boneNode${isSel ? ' selected' : ''}" data-bone-uuid="${bone.uuid}" style="padding-left:${pad}px">
        ${hasKids
          ? `<button class="boneExpandBtn" data-expand-bone="${bone.uuid}" type="button"><svg class="${isExp ? 'exp' : ''}" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button>`
          : `<span class="boneSpacer"></span>`}
        <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.5" fill="currentColor"/><circle cx="12" cy="19" r="2.5" fill="currentColor"/><line x1="12" y1="7.5" x2="12" y2="16.5"/></svg>
        <span>${bone.name || 'Bone'}</span>
      </div>`;
      if (hasKids && isExp) {
        for (const child of children) walk(child, depth + 1);
      }
    }
    for (const root of roots) walk(root, 0);
    boneTreeEl.innerHTML = html;
    attachBoneListeners();
  }

  function attachBoneListeners() {
    boneTreeEl.querySelectorAll('.boneExpandBtn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uuid = btn.dataset.expandBone;
        expandedBones.has(uuid) ? expandedBones.delete(uuid) : expandedBones.add(uuid);
        if (currentSkeleton) renderBoneTree(currentSkeleton);
      });
    });

    boneTreeEl.querySelectorAll('.boneNode').forEach((el) => {
      el.addEventListener('click', () => {
        const boneUUID = el.dataset.boneUuid;
        selectedBoneUUID = boneUUID;
        // Find the sphere for this bone and select it (triggers color + gizmo)
        const sphere = boneSphereMeshes.find((s) => s.userData.boneRef.uuid === boneUUID);
        if (sphere) {
          // Import setSelected dynamically to avoid circular issues
          import('./scene.js').then(({ setSelected }) => setSelected(sphere));
        }
        if (currentSkeleton) renderBoneTree(currentSkeleton);
      });
    });
  }

  // ── Actions menu ──────────────────────────────────────────────────────────
  const actionsBtn  = document.getElementById('actionsBtn');
  const actionsMenu = document.getElementById('actionsMenu');

  actionsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !actionsMenu.classList.contains('hidden');
    actionsMenu.classList.toggle('hidden', open);
    actionsBtn.classList.toggle('active', !open);
  });
  document.addEventListener('click', () => {
    actionsMenu.classList.add('hidden');
    actionsBtn.classList.remove('active');
  });

  function getTargets() {
    const targets = [];
    selectedUUIDs.forEach((uuid) => {
      const o = findByUUID(app.scene, uuid);
      if (o) targets.push(o);
    });
    if (!targets.length && app.selected) targets.push(app.selected);
    return targets;
  }

  document.getElementById('actionDelete').addEventListener('click', () => {
    getTargets().forEach((o) => app.scene.remove(o));
    app.transformControls?.detach(); app.selected = null;
    selectedUUIDs.clear(); markSceneDirty(); renderObjectsList();
    checkSceneForSkeletons();
    actionsMenu.classList.add('hidden'); actionsBtn.classList.remove('active');
    pushState();
  });

  document.getElementById('actionClone').addEventListener('click', () => {
    getTargets().forEach((o) => {
      const c = o.clone(); c.position.x += 1;
      c.name = (o.name || 'objeto') + '_clone';
      app.scene.add(c);
    });
    markSceneDirty(); renderObjectsList();
    actionsMenu.classList.add('hidden'); actionsBtn.classList.remove('active');
    pushState();
  });

  document.getElementById('actionRename').addEventListener('click', () => {
    const targets = getTargets();
    if (targets.length === 1) {
      const n = prompt('Novo nome:', targets[0].name || '');
      if (n?.trim()) { targets[0].name = n.trim(); renderObjectsList(); pushState(); }
    }
    actionsMenu.classList.add('hidden'); actionsBtn.classList.remove('active');
  });

  document.getElementById('actionGroup').addEventListener('click', () => {
    const targets = getTargets();
    if (!targets.length) return;
    import('three').then(({ Group, Vector3 }) => {
      const grp = new Group(); grp.name = 'Grupo';
      const avg = new Vector3();
      targets.forEach((o) => avg.add(o.position));
      avg.divideScalar(targets.length);
      grp.position.copy(avg);
      targets.forEach((o) => { o.position.sub(avg); app.scene.remove(o); grp.add(o); });
      app.scene.add(grp);
      selectedUUIDs.clear(); selectedUUIDs.add(grp.uuid);
      expandedGroups.add(grp.uuid);
      markSceneDirty(); renderObjectsList();
      pushState();
    });
    actionsMenu.classList.add('hidden'); actionsBtn.classList.remove('active');
  });

  // ── Default state ─────────────────────────────────────────────────────────
  setGizmoMode('translate');
  setActiveButton(gizmoButtons, gizmoButtons.find((b) => b.dataset.mode === 'translate'));
  setRenderModeValue('standard');
  setActiveButton(renderModeButtons, renderModeButtons.find((b) => b.dataset.renderMode === 'standard'));

  if (app.renderer) {
    app.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { clearSelection(); selectedUUIDs.clear(); renderObjectsList(); }
    if (/^[gG]$/.test(e.key)) { const b = gizmoButtons.find((x) => x.dataset.mode === 'translate'); if(b){setGizmoMode('translate');setActiveButton(gizmoButtons,b);} }
    if (/^[rR]$/.test(e.key)) { const b = gizmoButtons.find((x) => x.dataset.mode === 'rotate');    if(b){setGizmoMode('rotate');   setActiveButton(gizmoButtons,b);} }
    if (/^[sS]$/.test(e.key)) { const b = gizmoButtons.find((x) => x.dataset.mode === 'scale');     if(b){setGizmoMode('scale');    setActiveButton(gizmoButtons,b);} }
  });
});
