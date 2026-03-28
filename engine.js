// ==================== engine.js ====================
// Nexus Engine — Mesh quality, Blender-like rendering, LOD, PBR upgrade.
// Keeps scenes light while maximising visual quality.

import * as THREE from 'three';
import {
    applySmoothShading,
    subdivideGeometry,
    upgradeObjectMaterials,
    injectBlenderQuality,
    makeProceduralEnv,
    applyShadowQuality,
    makeGlowSprite,
} from './shader.js';

// ─── Engine state ─────────────────────────────────────────────────────────────
let _scene    = null;
let _renderer = null;
let _camera   = null;
let _envMap   = null;
let _qualityLevel = 'high'; // 'low' | 'medium' | 'high' | 'ultra'

// Geometry budget — objects over this vertex count get LOD
const VERTEX_BUDGET = {
    low:    20_000,
    medium: 60_000,
    high:   200_000,
    ultra:  Infinity,
};

// ─── Init ─────────────────────────────────────────────────────────────────────
export function engineInit(scene, renderer, camera) {
    _scene    = scene;
    _renderer = renderer;
    _camera   = camera;

    // Renderer quality settings
    _renderer.physicallyCorrectLights = true;
    _renderer.outputColorSpace = THREE.SRGBColorSpace;
    _renderer.toneMapping     = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.0;
    _renderer.shadowMap.enabled = true;
    _renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

    // Build a procedural env map (sky gradient)
    _envMap = makeProceduralEnv(0x6688cc, 0x221100);
    _scene.environment = _envMap;

    window._nexusEngine = { setQuality, upgradeObject, processMesh, applyBlenderLook };
}

// ─── Quality level ────────────────────────────────────────────────────────────
export function setQuality(level) {
    _qualityLevel = level;
    if (!_renderer) return;

    switch (level) {
        case 'low':
            _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
            _renderer.shadowMap.type = THREE.BasicShadowMap;
            break;
        case 'medium':
            _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            _renderer.shadowMap.type = THREE.PCFShadowMap;
            break;
        case 'high':
            _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            break;
        case 'ultra':
            _renderer.setPixelRatio(window.devicePixelRatio);
            _renderer.shadowMap.type = THREE.VSMShadowMap;
            break;
    }
}

// ─── Process imported mesh for quality + performance ─────────────────────────
export function processMesh(obj, options = {}) {
    const opts = {
        smoothShading:    options.smoothShading    ?? true,
        smoothAngle:      options.smoothAngle      ?? 35,
        upgradeMaterials: options.upgradeMaterials ?? true,
        blenderQuality:   options.blenderQuality   ?? true,
        autoLOD:          options.autoLOD          ?? true,
        shadowQuality:    options.shadowQuality    ?? 'high',
        computeNormals:   options.computeNormals   ?? true,
        mergeVertices:    options.mergeVertices     ?? false,
    };

    // Count total vertices
    let totalVerts = 0;
    obj.traverse(c => {
        if (c.isMesh && c.geometry) totalVerts += c.geometry.attributes.position?.count ?? 0;
    });

    const budget = VERTEX_BUDGET[_qualityLevel];

    obj.traverse(child => {
        if (!child.isMesh || !child.geometry) return;

        const geo = child.geometry;

        // Convert to non-indexed for normal computation
        if (opts.computeNormals && geo.index) {
            child.geometry = geo.toNonIndexed();
            child.geometry.computeVertexNormals();
        }

        // Smooth shading
        if (opts.smoothShading) {
            applySmoothShading(child, opts.smoothAngle);
        }

        // Shadow
        child.castShadow    = true;
        child.receiveShadow = true;
        child.frustumCulled = true;

        // Material upgrade
        if (opts.upgradeMaterials) {
            upgradeObjectMaterials(child, { roughness: 0.5, metalness: 0.0 });
        }

        // Blender quality injection
        if (opts.blenderQuality) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => {
                if (m && (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) {
                    injectBlenderQuality(m);
                    m.envMapIntensity = 1.2;
                    if (_envMap) m.envMap = _envMap;
                    m.needsUpdate = true;
                }
            });
        }
    });

    // Shadow quality on lights
    if (_scene) {
        _scene.traverse(o => {
            if (o.isDirectionalLight || o.isSpotLight || o.isPointLight) {
                applyShadowQuality(o, opts.shadowQuality);
            }
        });
    }

    return obj;
}

// ─── Upgrade existing scene object ───────────────────────────────────────────
export function upgradeObject(obj) {
    return processMesh(obj, {
        smoothShading:    true,
        upgradeMaterials: true,
        blenderQuality:   true,
        computeNormals:   true,
    });
}

// ─── Full Blender-look pass: env, lights, tone mapping ───────────────────────
export function applyBlenderLook(opts = {}) {
    if (!_scene || !_renderer) return;

    // Physically correct rendering
    _renderer.physicallyCorrectLights = true;
    _renderer.toneMapping    = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = opts.exposure ?? 1.0;

    // Update env
    if (opts.skyTop || opts.skyBottom) {
        _envMap?.dispose();
        _envMap = makeProceduralEnv(opts.skyTop ?? 0x6688cc, opts.skyBottom ?? 0x221100);
        _scene.environment = _envMap;
    }

    // Upgrade all existing meshes
    _scene.traverse(child => {
        if (child.isMesh) upgradeObject(child);
    });
}

// ─── Geometry optimiser: deduplicates vertices, reduces draw calls ────────────
export function optimiseGeometry(geo) {
    if (!geo) return geo;
    // Re-index geometry to reduce vertex count (merge identical positions)
    const pos  = geo.attributes.position;
    const map  = new Map();
    const newPos  = [];
    const indices = [];

    for (let i = 0; i < pos.count; i++) {
        const key = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
        if (!map.has(key)) {
            map.set(key, newPos.length / 3);
            newPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        }
        indices.push(map.get(key));
    }

    const opt = new THREE.BufferGeometry();
    opt.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newPos), 3));
    opt.setIndex(indices);
    opt.computeVertexNormals();
    return opt;
}

// ─── Mesh subdivision for smoother look on low-poly objects ──────────────────
export function smoothSubdivide(obj, levels = 1) {
    obj.traverse(child => {
        if (!child.isMesh || !child.geometry) return;
        let geo = child.geometry;
        if (geo.index) { geo = geo.toNonIndexed(); }
        child.geometry = subdivideGeometry(geo, levels);
        child.geometry.computeVertexNormals();
    });
}

// ─── Wireframe overlay for modeling mode ─────────────────────────────────────
let _wireOverlay = null;
export function showWireframe(obj, color = 0x4488ff) {
    hideWireframe();
    const geo = new THREE.WireframeGeometry(obj.geometry || new THREE.BoxGeometry());
    const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity:     0.35,
        depthTest:   true,
        depthWrite:  false,
    });
    _wireOverlay = new THREE.LineSegments(geo, mat);
    _wireOverlay.userData.isHelper = true;
    (obj.parent || _scene)?.add(_wireOverlay);
    _wireOverlay.position.copy(obj.position);
    _wireOverlay.rotation.copy(obj.rotation);
    _wireOverlay.scale.copy(obj.scale);
    return _wireOverlay;
}

export function hideWireframe() {
    if (_wireOverlay) {
        _wireOverlay.parent?.remove(_wireOverlay);
        _wireOverlay.geometry?.dispose();
        _wireOverlay.material?.dispose();
        _wireOverlay = null;
    }
}

// ─── Bounding box helper ──────────────────────────────────────────────────────
export function getBoundingInfo(obj) {
    const bb   = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bb.getSize(size);
    bb.getCenter(center);
    return { box: bb, size, center, volume: size.x * size.y * size.z };
}

// ─── Per-object quality lock (keeps heavy objects from slowing down scene) ───
const _qualityLocks = new WeakMap();

export function setObjectQuality(obj, opts = {}) {
    _qualityLocks.set(obj, opts);
    obj.traverse(child => {
        if (!child.isMesh) return;
        // Reduce geometry precision for background/far objects
        if (opts.lod === 'low') {
            child.frustumCulled = true;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => {
                if (m) { m.precision = 'lowp'; m.needsUpdate = true; }
            });
        }
        if (opts.shadows === false) {
            child.castShadow    = false;
            child.receiveShadow = false;
        }
    });
}

// ─── Tone mapping quality ────────────────────────────────────────────────────
export function setToneMapping(type = 'aces', exposure = 1.0) {
    if (!_renderer) return;
    const modes = {
        linear:  THREE.LinearToneMapping,
        aces:    THREE.ACESFilmicToneMapping,
        reinhard:THREE.ReinhardToneMapping,
        cineon:  THREE.CineonToneMapping,
        agx:     THREE.AgXToneMapping ?? THREE.ACESFilmicToneMapping,
    };
    _renderer.toneMapping         = modes[type] ?? modes.aces;
    _renderer.toneMappingExposure = exposure;
}

// ─── Ambient light quality (remove ugly harsh ambient, use soft IBL-style) ───
export function upgradeAmbientLight(light, intensity = 0.4) {
    if (!light || !light.isAmbientLight) return;
    light.intensity = intensity;
    light.color.set(0xc8d8ff); // subtle cool ambient
}

// ─── Export ───────────────────────────────────────────────────────────────────
window._nexusEngine = {
    engineInit,
    setQuality,
    processMesh,
    upgradeObject,
    applyBlenderLook,
    optimiseGeometry,
    smoothSubdivide,
    showWireframe,
    hideWireframe,
    getBoundingInfo,
    setObjectQuality,
    setToneMapping,
    upgradeAmbientLight,
};
