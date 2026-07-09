import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export const app = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  transformControls: null,
  gridRoot: null,
  axesHelper: null,
  floor: null,
  raycaster: new THREE.Raycaster(),
  pointer: new THREE.Vector2(),
  objects: [],
  boneObjects: [],      // bone sphere meshes for raycasting
  boneUpdateFn: null,   // called every frame to sync bone sphere positions
  selected: null,
  initialized: false,
  mode: 'translate',
  deepSelectMode: false,
  sceneDirty: true,
  helpersVisible: true,
  renderPreviewActive: false
};

export const helperRegistry = { objects: [] };

function physicalMaterialDefaults() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xd7dde7,
    roughness: 0.55,
    metalness: 0.08,
    clearcoat: 0,
    clearcoatRoughness: 0,
    transmission: 0,
    thickness: 0,
    ior: 1.5,
    sheen: 0,
    sheenRoughness: 1,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [100, 400],
    specularIntensity: 1,
    specularColor: new THREE.Color(1, 1, 1),
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
    transparent: false,
    opacity: 1
  });
}

function makeGeometry(kind) {
  switch (kind) {
    case 'box':      return new THREE.BoxGeometry(1, 1, 1);
    case 'sphere':   return new THREE.SphereGeometry(0.5, 32, 16);
    case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
    case 'cone':     return new THREE.ConeGeometry(0.55, 1, 24);
    case 'torus':    return new THREE.TorusGeometry(0.45, 0.16, 14, 28);
    default:         return new THREE.BoxGeometry(1, 1, 1);
  }
}

function geometryHeight(kind) {
  if (kind === 'sphere') return 0.5;
  if (kind === 'torus')  return 0.55;
  return 0.5;
}

function isUiTarget(target) {
  return !!(target && target.closest && target.closest('#ui'));
}

function dispatchSelectionChanged() {
  window.dispatchEvent(new CustomEvent('scene-selection-changed', {
    detail: { object: app.selected }
  }));
}

export function markSceneDirty() {
  app.sceneDirty = true;
}

function clearHighlight(object) {
  if (!object || !object.userData.__hl) return;
  const hl = object.userData.__hl;
  object.remove(hl);
  hl.geometry?.dispose?.();
  hl.material?.dispose?.();
  delete object.userData.__hl;
}

function addHighlight(object) {
  // No-op — selection glow is handled by OutlinePass via scene-selection-changed
  void object;
}

export function setSelected(object) {
  if (app.selected === object) return;

  // Clear old selection visuals
  if (app.selected) {
    if (app.selected.userData.isBoneMarker) {
      app.selected.material.color.setHex(0xffffff);
      app.selected.material.opacity = 1.0;
    } else {
      clearHighlight(app.selected);
    }
  }

  app.selected = object || null;

  if (app.selected) {
    if (app.selected.userData.isBoneMarker) {
      // Highlight bone sphere with orange and attach TC to the bone
      app.selected.material.color.setHex(0xff8a00);
      app.selected.material.opacity = 1.0;
      app.transformControls.attach(app.selected.userData.boneRef);
    } else {
      addHighlight(app.selected);
      app.transformControls.attach(app.selected);
    }
    if(app._tcHelper) app._tcHelper.visible = !app.renderPreviewActive;
  } else {
    app.transformControls.detach();
    if(app._tcHelper) app._tcHelper.visible = false;
  }

  dispatchSelectionChanged();
}

// ─── Blender-style grid ────────────────────────────────────────────────────
// ─── Blender-style infinite adaptive grid (shader-based) ──────────────────
// Real Blender draws its floor grid as a single flat analytic surface that
// fades with camera distance and never "pops" between LOD levels — a fixed
// set of discrete line segments (what we had before) always looks choppy
// and finite by comparison. This uses the well-known fwidth()-based
// procedural-grid technique so lines stay crisp (anti-aliased) at any zoom
// level, purely computed in the fragment shader from world-space position.
function createInfiniteGridMesh() {
  const uniforms = {
    uColorMinor:    { value: new THREE.Color(0x3a3a3a) },
    uColorMajor:    { value: new THREE.Color(0x4d4d4d) },
    uColorAxisX:    { value: new THREE.Color(0xaa3b3b) }, // world X line — red   (Blender convention)
    uColorAxisZ:    { value: new THREE.Color(0x3ba05c) }, // world Z line — green (Blender convention: Y on the ground plane)
    uMinorSize:     { value: 1.0 },
    uMajorSize:     { value: 10.0 },
    uFadeDistance:  { value: 110.0 },
    uCameraPos:     { value: new THREE.Vector3() },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vWorldPos;
      uniform vec3  uColorMinor;
      uniform vec3  uColorMajor;
      uniform vec3  uColorAxisX;
      uniform vec3  uColorAxisZ;
      uniform float uMinorSize;
      uniform float uMajorSize;
      uniform float uFadeDistance;
      uniform vec3  uCameraPos;

      float gridLine(vec2 coord, float size) {
        vec2 r = coord / size;
        vec2 g = abs(fract(r - 0.5) - 0.5) / fwidth(r);
        return 1.0 - min(min(g.x, g.y), 1.0);
      }

      void main() {
        vec2 p = vWorldPos.xz; // p.x = world X, p.y = world Z

        float minor = gridLine(p, uMinorSize);
        float major = gridLine(p, uMajorSize);

        vec3  color = mix(uColorMinor, uColorMajor, step(0.001, major));
        float alpha = max(minor * 0.28, major * 0.55);

        // Colored world-origin axis lines, anti-aliased via screen-space derivative width
        float axW   = max(fwidth(p.x), fwidth(p.y)) * 1.6 + 0.02;
        float xAxis = 1.0 - smoothstep(0.0, axW, abs(p.y)); // world Z≈0 → the X axis line
        float zAxis = 1.0 - smoothstep(0.0, axW, abs(p.x)); // world X≈0 → the Z axis line

        color = mix(color, uColorAxisX, xAxis);
        alpha = max(alpha, xAxis * 0.9);
        color = mix(color, uColorAxisZ, zAxis);
        alpha = max(alpha, zAxis * 0.9);

        float dist = distance(uCameraPos.xz, p);
        float fade = 1.0 - smoothstep(uFadeDistance * 0.55, uFadeDistance, dist);

        gl_FragColor = vec4(color, alpha * fade);
        if (gl_FragColor.a < 0.003) discard;
      }
    `,
  });
  material.extensions = { derivatives: true }; // enables fwidth() on WebGL1 contexts

  const geo  = new THREE.PlaneGeometry(2000, 2000);
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  mesh.userData.isHelper = true;
  mesh.userData._gridMaterial = material; // exposed so render.js can update uCameraPos per-frame
  return mesh;
}

// ─── Blender-style axis triad at origin ────────────────────────────────────
// Blender convention: X=red, Y=green (both lie on the ground plane, Z-up),
// Z=blue (the vertical "up" axis). This app is Y-up, so our ground plane is
// X/Z and our vertical axis is Y — the mapping is: X→red, Z→green (ground,
// matches Blender's Y), Y→blue (vertical, matches Blender's Z).
function createBlenderAxes() {
  const root = new THREE.Group();
  root.frustumCulled = false;

  const axes = [
    { dir: [1,0,0],  color: 0xcc4444 }, // X — red   (ground)
    { dir: [0,1,0],  color: 0x4477dd }, // Y — blue  (vertical / up)
    { dir: [0,0,-1], color: 0x44bb66 }, // Z — green (ground depth, ≈ Blender Y)
  ];
  const R = 1.6;
  axes.forEach(({ dir, color }) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(
      [0, 0, 0, dir[0]*R, dir[1]*R, dir[2]*R], 3));
    root.add(new THREE.LineSegments(geo,
      new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 })));
    // Arrow head
    const headGeo = new THREE.ConeGeometry(0.045, 0.22, 7);
    const headMat = new THREE.MeshBasicMaterial({ color });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(dir[0]*R, dir[1]*R, dir[2]*R);
    if      (dir[0]) head.rotation.z = -Math.PI/2;
    else if (dir[2]) head.rotation.x =  Math.PI/2;
    head.renderOrder = 2;
    root.add(head);
  });
  root.traverse(c => { if (c !== root) c.userData.isHelper = true; });
  return root;
}

export function initScene(container = document.body) {
  if (app.initialized) return app;
  app.initialized = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2b2b);   // Blender 4.x flat viewport gray
  scene.fog = new THREE.Fog(0x2b2b2b, 70, 260);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 4000);
  camera.position.set(8, 7, 10);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.minDistance = 1.5;
  controls.maxDistance = 500;
  controls.target.set(0, 0.5, 0);

  const transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setSize(0.9);
  transformControls.addEventListener('dragging-changed', (e) => {
    controls.enabled = !e.value;
  });
  // r169+: TransformControls is no longer an Object3D — add its helper instead
  const tcHelper = typeof transformControls.getHelper === 'function'
    ? transformControls.getHelper()
    : transformControls;           // fallback for older versions
  tcHelper.visible = false;
  scene.add(tcHelper);
  app._tcHelper = tcHelper;        // store so we can toggle visibility

  scene.add(new THREE.AmbientLight(0xffffff, 1.7));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(6, 10, 5);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x8eb1ff, 0.95);
  fillLight.position.set(-8, 6, -6);
  scene.add(fillLight);

  const gridRoot = createInfiniteGridMesh();
  scene.add(gridRoot);

  // Blender-style colour-coded world axes at origin
  const blenderAxes = createBlenderAxes();
  blenderAxes.userData.isHelper = true;
  scene.add(blenderAxes);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({
      color:       0x0b0f14,
      roughness:   1,
      metalness:   0,
      transparent: true,
      opacity:     0.0,         // fully invisible by default
      depthWrite:  false,       // never blocks particles / transparent objects
      colorWrite:  false,       // no visual contribution — exists for raycasting only
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.userData.isHelper = true;   // excluded from selection / hierarchy
  scene.add(floor);
  app.floor = floor;

  const axesHelper = blenderAxes;  // Blender-style axes (built above)

  // Track pointer down position to distinguish click vs drag (orbit)
  let _downX = 0, _downY = 0;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    _downX = event.clientX; _downY = event.clientY;
  });

  renderer.domElement.addEventListener('pointerup', (event) => {
    if (isUiTarget(event.target)) return;
    if (app.transformControls.dragging) return;
    // Ignore if the pointer moved > 5px (it was an orbit/pan drag)
    const dx = event.clientX - _downX, dy = event.clientY - _downY;
    if (dx * dx + dy * dy > 25) return;

    const rect = renderer.domElement.getBoundingClientRect();
    app.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    app.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    app.raycaster.setFromCamera(app.pointer, camera);

    // 1. Check bone spheres first (they render on top)
    if (app.boneObjects.length > 0) {
      const boneHits = app.raycaster.intersectObjects(app.boneObjects, false);
      if (boneHits.length > 0) { setSelected(boneHits[0].object); return; }
    }

    // 2. Check regular user objects
    if (app.deepSelectMode) {
      // Deep-select: raycast recursively through all scene children,
      // find the first real mesh (skip floor, helpers, bone markers, gizmo)
      const deepHits = app.raycaster.intersectObjects(app.scene.children, true);
      const validHit = deepHits.find((h) => {
        const o = h.object;
        return o !== floor &&
               !o.userData.isHelper &&
               !o.userData.isBoneMarker &&
               o !== app.transformControls?.getHelper?.() &&
               o.visible;
      });
      if (validHit) {
        setSelected(validHit.object);
      } else {
        const floorHits = app.raycaster.intersectObjects([floor], false);
        if (floorHits.length === 0) setSelected(null);
      }
    } else {
      const hits = app.raycaster.intersectObjects(app.objects, false);
      if (hits.length > 0) {
        const target = hits[0].object.userData.selectTarget ?? hits[0].object;
        setSelected(target);
      } else {
        // 3. If we hit the floor/grid, keep selection — only clear on true void
        const floorHits = app.raycaster.intersectObjects([floor], false);
        if (floorHits.length === 0) setSelected(null);
      }
    }
  });

  window.addEventListener('resize', onResize);

  app.scene = scene;
  app.camera = camera;
  app.renderer = renderer;
  app.controls = controls;
  app.transformControls = transformControls;
  app.gridRoot = gridRoot;
  app.axesHelper = axesHelper;

  addPrimitive('box');

  return app;
}

export function onResize() {
  if (!app.renderer || !app.camera) return;
  app.camera.aspect = window.innerWidth / window.innerHeight;
  app.camera.updateProjectionMatrix();
  app.renderer.setSize(window.innerWidth, window.innerHeight);
  markSceneDirty();
}

export function updateInfiniteGrid() {
  if (!app.gridRoot || !app.camera) return;
  // Feed live camera position into the grid shader so the distance-based
  // fade (uFadeDistance) is always centered on wherever the user is looking
  // from. The grid mesh itself never needs to move — it's a large flat
  // plane and the fade makes it read as effectively infinite.
  const mat = app.gridRoot.userData?._gridMaterial;
  if (mat?.uniforms?.uCameraPos) {
    mat.uniforms.uCameraPos.value.copy(app.camera.position);
  }
}

export function setHelperVisibility(visible) {
  app.helpersVisible = visible;
  const show = visible && !app.renderPreviewActive;
  if (app.gridRoot) app.gridRoot.visible = show;
  if (app.axesHelper) app.axesHelper.visible = show;
  helperRegistry.objects.forEach(obj => { obj.visible = show; });
  if (app.transformControls) {
    if(app._tcHelper) app._tcHelper.visible = show ? !!app.selected : false;
  }
}

export function setRenderPreviewMode(active) {
  app.renderPreviewActive = active;
  const show = !active;
  if (app.gridRoot) app.gridRoot.visible = show;
  if (app.axesHelper) app.axesHelper.visible = show;
  helperRegistry.objects.forEach(obj => { obj.visible = show; });
  if (app.transformControls) {
    if(app._tcHelper) app._tcHelper.visible = show && !!app.selected;
  }
  // Hide particle emitter crosshair markers in render mode
  if (app.scene) {
    app.scene.traverse(obj => {
      if (obj.userData.isLabMarker) obj.visible = show;
    });
  }
  markSceneDirty();
}

export function renderScene() {
  if (!app.renderer || !app.scene || !app.camera) return;
  app.renderer.render(app.scene, app.camera);
}

export function setGizmoMode(mode) {
  app.mode = mode;
  if (app.transformControls) {
    app.transformControls.setMode(mode);
  }
}

export function addPrimitive(kind) {
  if (!app.scene) return null;

  const mesh = new THREE.Mesh(makeGeometry(kind), physicalMaterialDefaults());
  mesh.name = kind;
  mesh.position.set(app.controls.target.x, geometryHeight(kind), app.controls.target.z);
  mesh.castShadow    = true;
  mesh.receiveShadow = true;

  app.scene.add(mesh);
  app.objects.push(mesh);
  setSelected(mesh);
  markSceneDirty();
  return mesh;
}

export function clearSelection() {
  setSelected(null);
}

export function getSelected() {
  return app.selected;
}

export function ensurePhysicalMaterial(mesh) {
  if (!mesh) return null;
  if (mesh.material?.isMeshPhysicalMaterial) return mesh.material;

  const old = mesh.material;
  const mat = physicalMaterialDefaults();

  if (old) {
    if (old.color) mat.color.copy(old.color);
    if (old.map) mat.map = old.map;
    if (old.normalMap) mat.normalMap = old.normalMap;
    if (old.roughnessMap) mat.roughnessMap = old.roughnessMap;
    if (old.metalnessMap) mat.metalnessMap = old.metalnessMap;
    if (old.aoMap) mat.aoMap = old.aoMap;
    if (old.emissiveMap) mat.emissiveMap = old.emissiveMap;
    if (old.alphaMap) mat.alphaMap = old.alphaMap;
    if (old.clearcoatMap) mat.clearcoatMap = old.clearcoatMap;
    if (old.clearcoatNormalMap) mat.clearcoatNormalMap = old.clearcoatNormalMap;
    if (old.clearcoatRoughnessMap) mat.clearcoatRoughnessMap = old.clearcoatRoughnessMap;
    if (old.specularColorMap) mat.specularColorMap = old.specularColorMap;
    if (old.specularIntensityMap) mat.specularIntensityMap = old.specularIntensityMap;
    if (old.sheenColorMap) mat.sheenColorMap = old.sheenColorMap;
    if (old.sheenRoughnessMap) mat.sheenRoughnessMap = old.sheenRoughnessMap;
    if (old.transmissionMap) mat.transmissionMap = old.transmissionMap;
    if (old.thicknessMap) mat.thicknessMap = old.thicknessMap;
    if (old.iridescenceMap) mat.iridescenceMap = old.iridescenceMap;
    if (old.iridescenceThicknessMap) mat.iridescenceThicknessMap = old.iridescenceThicknessMap;
    if (old.envMap) mat.envMap = old.envMap;

    if (typeof old.opacity === 'number') mat.opacity = old.opacity;
    if (typeof old.transparent === 'boolean') mat.transparent = old.transparent;
    if (typeof old.roughness === 'number') mat.roughness = old.roughness;
    if (typeof old.metalness === 'number') mat.metalness = old.metalness;
    if (typeof old.clearcoat === 'number') mat.clearcoat = old.clearcoat;
    if (typeof old.clearcoatRoughness === 'number') mat.clearcoatRoughness = old.clearcoatRoughness;
    if (typeof old.transmission === 'number') mat.transmission = old.transmission;
    if (typeof old.thickness === 'number') mat.thickness = old.thickness;
    if (typeof old.ior === 'number') mat.ior = old.ior;
    if (typeof old.sheen === 'number') mat.sheen = old.sheen;
    if (typeof old.sheenRoughness === 'number') mat.sheenRoughness = old.sheenRoughness;
    if (typeof old.iridescence === 'number') mat.iridescence = old.iridescence;
    if (typeof old.iridescenceIOR === 'number') mat.iridescenceIOR = old.iridescenceIOR;
    if (typeof old.emissiveIntensity === 'number') mat.emissiveIntensity = old.emissiveIntensity;
    if (old.emissive) mat.emissive.copy(old.emissive);
    if (old.specularColor) mat.specularColor.copy(old.specularColor);
    if (typeof old.specularIntensity === 'number') mat.specularIntensity = old.specularIntensity;
  }

  mesh.material = mat;
  markSceneDirty();
  return mat;
}
