// ==================== scene.js ====================
// Configuração core do Three.js: renderer, cena, câmera, controles, luzes, IBL
// Exporta tudo que os outros módulos precisam.

import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';
import { OrbitControls }    from 'https://unpkg.com/three@0.169.0/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'https://unpkg.com/three@0.169.0/examples/jsm/controls/TransformControls.js';
import { RoomEnvironment }   from 'https://unpkg.com/three@0.169.0/examples/jsm/environments/RoomEnvironment.js';

// ── Detecção de dispositivo ──────────────────────────────────────────────────
export const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || (window.innerWidth < 768 && window.innerHeight < 1024);

// ── Full-screen canvas ───────────────────────────────────────────────────────
document.documentElement.style.cssText = 'margin:0;padding:0;width:100%;height:100%;overflow:hidden;';
document.body.style.cssText            = 'margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;';

export function getViewW() { return window.innerWidth; }
export function getViewH() { return window.innerHeight; }

// ── Cena ─────────────────────────────────────────────────────────────────────
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);

// ── Câmera ───────────────────────────────────────────────────────────────────
export const camera = new THREE.PerspectiveCamera(45, getViewW() / getViewH(), 0.1, 1000);
camera.position.set(10, 10, 10);
camera.lookAt(0, 0, 0);
camera.layers.enable(2);

// ── Renderer ─────────────────────────────────────────────────────────────────
export const renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
});
renderer.setSize(getViewW(), getViewH());
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.shadowMap.enabled    = true;
renderer.shadowMap.type       = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace     = THREE.LinearSRGBColorSpace;
renderer.toneMapping          = THREE.ReinhardToneMapping;
renderer.toneMappingExposure  = 1.2;
renderer.sortObjects          = true;

Object.assign(renderer.domElement.style, {
    display: 'block', position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
});
document.body.appendChild(renderer.domElement);

// ── IBL (Image-Based Lighting) ───────────────────────────────────────────────
const _pmremGen = new THREE.PMREMGenerator(renderer);
_pmremGen.compileEquirectangularShader();
export const iblTexture = _pmremGen.fromScene(new RoomEnvironment(), 0.04).texture;
_pmremGen.dispose();
scene.environment          = iblTexture;
scene.environmentIntensity = 0.30;
window._iblTexture         = iblTexture;

// ── OrbitControls ────────────────────────────────────────────────────────────
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping      = true;
controls.dampingFactor      = isMobile ? 0.12 : 0.08;
controls.screenSpacePanning = true;
controls.zoomSpeed          = 1.2;
controls.panSpeed           = 0.9;
controls.rotateSpeed        = 0.9;
controls.minDistance        = 0.1;
controls.maxDistance        = 2000;
if (isMobile) controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

// DPR adaptativo durante interação
const MAX_DPR = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
const LOW_DPR = isMobile ? 0.85 : 1.0;
let _interacting = false, _restoreTimer = null;
function setDPR(dpr) { renderer.setPixelRatio(dpr); }
controls.addEventListener('start', () => { _interacting = true; clearTimeout(_restoreTimer); setDPR(LOW_DPR); });
controls.addEventListener('end',   () => {
    _interacting = false; clearTimeout(_restoreTimer);
    _restoreTimer = setTimeout(() => { if (!_interacting) setDPR(MAX_DPR); }, 350);
});

// ── Grid & Eixos ─────────────────────────────────────────────────────────────
export const gridHelper = new THREE.GridHelper(2000, 200, 0x8888aa, 0x444466);
gridHelper.position.y = -0.01;
scene.add(gridHelper);

export const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// ── Luzes padrão ─────────────────────────────────────────────────────────────
export const SHADOW_MAP_SIZE = isMobile ? 512 : 4096;

export const ambientLight = new THREE.AmbientLight(0x111828, 0.8);
ambientLight.userData.isDefaultLight = true;
scene.add(ambientLight);

export const dirLight = new THREE.DirectionalLight(0xffe8c0, 1.8);
dirLight.position.set(8, 12, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width  = SHADOW_MAP_SIZE;
dirLight.shadow.mapSize.height = SHADOW_MAP_SIZE;
dirLight.shadow.camera.near    = 1;   dirLight.shadow.camera.far    = 200;
dirLight.shadow.camera.left    = -30; dirLight.shadow.camera.right   = 30;
dirLight.shadow.camera.top     = 30;  dirLight.shadow.camera.bottom  = -30;
dirLight.shadow.normalBias = 0.012; dirLight.shadow.bias = -0.0005; dirLight.shadow.radius = 3;
dirLight.userData.isDefaultLight = true;
scene.add(dirLight);

export const fillLight = new THREE.PointLight(0x2244aa, 0.4);
fillLight.position.set(-8, 4, -6);
fillLight.userData.isDefaultLight = true;
scene.add(fillLight);

// ── TransformControls (Gizmo) ─────────────────────────────────────────────────
export const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls.getHelper());

// ── Bloom layer ───────────────────────────────────────────────────────────────
export const bloomLayer = new THREE.Layers();
bloomLayer.set(1);

console.log('[scene.js] ✅ Cena Three.js inicializada');
