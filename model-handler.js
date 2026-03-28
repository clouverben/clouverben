// ==================================================================================
//  model-handler.js — Nexus Engine Model Performance System v3
// ==================================================================================
//
//  Técnicas implementadas (sem draw call batching / merge geometries):
//
//  1. matrixAutoUpdate = false  — desliga recálculo de matriz em submeshes estáticos.
//     O maior ganho de CPU em cenas com muitos objetos (técnica do Troika e Roblox SLIM).
//     A matriz do root/pai continua atualizada, transform tools funcionam normal.
//
//  2. LOD em 4 níveis por distância (como Roblox SLIM + impostores)
//     L0 (0–18u)   : geometria original completa
//     L1 (18–50u)  : ~40% dos triângulos
//     L2 (50–120u) : ~15% dos triângulos
//     L3 (120–280u): ~5% dos triângulos (qualidade de impostor)
//     Invisible (280u+): frustum culled automaticamente
//
//  3. Shadow Distance Culling dinâmico por frame
//     Sombras desligadas em meshes além do raio configurado.
//     Invisível ao jogador a distância — ganho massivo no shadow map pass.
//
//  4. Shader pre-compilation assíncrona
//     Compila shaders antes do primeiro frame visível.
//     Elimina stutter/congelamento no primeiro render do modelo.
//
//  5. Texture anisotropy + mipmap garantido
//     Anisotropia máxima do hardware em todas as texturas.
//     Melhor qualidade visual a distância sem custo perceptível.
//
//  6. Progressive frame loading
//     Distribui processamento pesado em vários frames via yield.
//     O engine não trava durante importação.
//
//  7. Bounding volume accuracy
//     Recalcula bounding box/sphere após todos os processamentos.
//     Garante que frustum culling nativo do Three.js funcione correto.
//
// ==================================================================================

import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';

// ── Configuração ─────────────────────────────────────────────────────────────────
const CFG = {
    lod: {
        l1: { distance: 18,  ratio: 0.40 },
        l2: { distance: 50,  ratio: 0.15 },
        l3: { distance: 120, ratio: 0.05 },
        cull: 280,
    },
    shadow: {
        castRadius:    45,
        receiveRadius: 70,
    },
    vertexThreshold: 1500,
    anisotropy: null,
};

// Estado global
const _lodObjects          = [];
const _shadowManagedMeshes = [];
const _vec3                = new THREE.Vector3();

// ── Helpers ───────────────────────────────────────────────────────────────────────
const yield$ = () => new Promise(r => requestAnimationFrame(r));

function _waitGlobals() {
    return new Promise(resolve => {
        const t = setInterval(() => {
            if (window._nexusScene && window._nexusRenderer && window._nexusSetProgress) {
                clearInterval(t); resolve();
            }
        }, 50);
    });
}

const _getRenderer = () => window._nexusRenderer;
const _getScene    = () => window._nexusScene;
const _getCamera   = () => window._nexusCamera || window._camera;

// ── 1. MATRIX FREEZE ─────────────────────────────────────────────────────────────
// Desliga matrixAutoUpdate nos filhos estáticos do modelo.
// Root mantém matrixAutoUpdate = true — mover/rotacionar o modelo continua funcionando.
// Quando o pai é movido, Three.js recalcula worldMatrix dos filhos sem
// recompor localMatrix de cada um (já congelada). Enorme ganho de CPU.
function _freezeChildMatrices(model) {
    // Coleta todos os ancestrais de bones/SkinnedMesh — a cadeia inteira precisa
    // permanecer live para que updateMatrixWorld propague corretamente quando
    // um bone se move. Congelar um nó intermediário (ex: Armature) corta a
    // propagação e faz os filhos ficarem no lugar.
    const boneAncestors = new Set();
    model.traverse(child => {
        if (!child.isBone && !child.isSkinnedMesh) return;
        let node = child.parent;
        while (node && node !== model) {
            boneAncestors.add(node);
            node = node.parent;
        }
    });

    let frozen = 0;
    model.traverse(child => {
        if (child === model) return;
        if (child.isSkinnedMesh || child.isBone) return; // animação precisa deles ativos
        if (boneAncestors.has(child)) return;            // preserva cadeia de ancestrais de bone
        child.updateMatrix();
        child.matrixAutoUpdate       = false;
        child.matrixWorldAutoUpdate  = false;
        child.userData._matrixFrozen = true;
        frozen++;
    });
    return frozen;
}

function _unfreezeObject(obj) {
    if (!obj) return;
    obj.traverse(child => {
        if (!child.userData._matrixFrozen) return;
        child.matrixAutoUpdate      = true;
        child.matrixWorldAutoUpdate = true;
        delete child.userData._matrixFrozen;
    });
}

// ── 2. DECIMAÇÃO DE GEOMETRIA ─────────────────────────────────────────────────────
// Seleciona 1 triângulo a cada N (stride uniforme).
// Preserva silhueta e proporções. Rápido, sem dependências externas.
function _decimateGeometry(geo, keepRatio) {
    if (!geo?.attributes?.position) return null;
    try {
        const src       = geo.index ? geo.toNonIndexed() : geo;
        const pos       = src.attributes.position;
        const totalTris = Math.floor(pos.count / 3);
        const step      = Math.max(1, Math.round(1 / keepRatio));

        const kept = [];
        for (let i = 0; i < totalTris; i++) {
            if (i % step !== 0) continue;
            const b = i * 3;
            kept.push(b, b + 1, b + 2);
        }
        if (kept.length === 0) return null;

        const out = new THREE.BufferGeometry();
        for (const name of ['position','normal','uv','uv2','color','tangent']) {
            const attr = src.attributes[name];
            if (!attr) continue;
            const is  = attr.itemSize;
            const arr = new Float32Array(kept.length * is);
            for (let j = 0; j < kept.length; j++) {
                const si = kept[j];
                for (let k = 0; k < is; k++) arr[j * is + k] = attr.array[si * is + k];
            }
            out.setAttribute(name, new THREE.Float32BufferAttribute(arr, is));
        }
        out.computeVertexNormals();
        out.computeBoundingBox();
        out.computeBoundingSphere();
        return out;
    } catch (e) {
        console.warn('[ModelHandler] Decimação falhou:', e.message);
        return null;
    }
}

// ── 3. LOD BUILDER ───────────────────────────────────────────────────────────────
// Constrói THREE.LOD com 4 níveis para meshes pesadas.
// Preserva hierarquia — mesh substituída por LOD no mesmo lugar do grafo de cena.
function _buildLOD(mesh) {
    if (!mesh?.geometry?.attributes?.position) return null;
    const verts = mesh.geometry.attributes.position.count;
    if (verts < CFG.vertexThreshold) return null;

    const { l1, l2, l3, cull } = CFG.lod;
    const lod        = new THREE.LOD();
    lod.name         = (mesh.name || 'mesh') + '_lod';
    lod.position.copy(mesh.position);
    lod.rotation.copy(mesh.rotation);
    lod.scale.copy(mesh.scale);
    lod.userData     = { ...mesh.userData, isLOD: true };
    lod.layers.mask  = mesh.layers.mask;

    // Nível 0 — geometria original completa
    const m0 = mesh.clone(false);
    m0.geometry      = mesh.geometry;
    m0.castShadow    = mesh.castShadow;
    m0.receiveShadow = mesh.receiveShadow;
    m0.position.set(0, 0, 0);
    m0.rotation.set(0, 0, 0);
    m0.scale.set(1, 1, 1);
    lod.addLevel(m0, 0);

    // Nível 1 — 40% dos triângulos
    const g1 = _decimateGeometry(mesh.geometry, l1.ratio);
    if (g1) {
        const m1 = new THREE.Mesh(g1, mesh.material);
        m1.castShadow = false; m1.receiveShadow = mesh.receiveShadow;
        m1.layers.mask = mesh.layers.mask;
        lod.addLevel(m1, l1.distance);
    }

    // Nível 2 — 15% dos triângulos
    const g2 = _decimateGeometry(mesh.geometry, l2.ratio);
    if (g2) {
        const m2 = new THREE.Mesh(g2, mesh.material);
        m2.castShadow = false; m2.receiveShadow = false;
        m2.layers.mask = mesh.layers.mask;
        lod.addLevel(m2, l2.distance);
    }

    // Nível 3 — 5% dos triângulos (impostor-like)
    const g3 = _decimateGeometry(mesh.geometry, l3.ratio);
    if (g3) {
        const m3 = new THREE.Mesh(g3, mesh.material);
        m3.castShadow = false; m3.receiveShadow = false;
        m3.layers.mask = mesh.layers.mask;
        lod.addLevel(m3, l3.distance);
    }

    // Nível 4 — invisível (culled por distância)
    const phantom   = new THREE.Object3D();
    phantom.visible = false;
    lod.addLevel(phantom, cull);

    return lod;
}

async function _applyLOD(model) {
    // SkinnedMesh + LOD = incompatível com skeleton binding
    let hasSkinned = false;
    model.traverse(c => { if (c.isSkinnedMesh) hasSkinned = true; });
    if (hasSkinned) return 0;

    const replacements = [];
    model.traverse(child => {
        if (!child.isMesh || child.userData?.isLOD || child.userData?.isMerged) return;
        const lod = _buildLOD(child);
        if (lod) replacements.push({ child, lod, parent: child.parent });
    });

    let i = 0;
    for (const { child, lod, parent } of replacements) {
        if (!parent) continue;
        parent.add(lod);
        parent.remove(child);
        _lodObjects.push(lod);
        if (++i % 4 === 0) await yield$();
    }
    return replacements.length;
}

// ── 4. SHADOW DISTANCE SYSTEM ────────────────────────────────────────────────────
// Registra meshes para gerenciamento dinâmico.
// updateShadowLOD() é chamado todo frame — habilita/desabilita castShadow
// com base na distância da câmera. Custo O(n) em atribuições bool simples.
function _registerShadowMeshes(model) {
    model.traverse(child => {
        if (!child.isMesh) return;
        if (_shadowManagedMeshes.find(e => e.mesh === child)) return;
        _shadowManagedMeshes.push({
            mesh:            child,
            originalCast:    child.castShadow,
            originalReceive: child.receiveShadow,
        });
    });
}

function updateShadowLOD() {
    const cam = _getCamera();
    if (!cam) return;
    const castR2 = CFG.shadow.castRadius    * CFG.shadow.castRadius;
    const rcvR2  = CFG.shadow.receiveRadius * CFG.shadow.receiveRadius;

    for (let i = _shadowManagedMeshes.length - 1; i >= 0; i--) {
        const { mesh, originalCast, originalReceive } = _shadowManagedMeshes[i];
        if (!mesh.parent) { _shadowManagedMeshes.splice(i, 1); continue; }
        mesh.getWorldPosition(_vec3);
        const d2 = cam.position.distanceToSquared(_vec3);
        if (originalCast)    mesh.castShadow    = d2 <= castR2;
        if (originalReceive) mesh.receiveShadow = d2 <= rcvR2;
    }
}

// ── 5. TEXTURE OPTIMIZER ──────────────────────────────────────────────────────────
function _optimizeTextures(model) {
    const renderer = _getRenderer();
    if (!CFG.anisotropy && renderer)
        CFG.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const maxAniso = CFG.anisotropy || 1;

    const seen     = new Set();
    const SLOTS    = ['map','normalMap','roughnessMap','metalnessMap','aoMap',
                      'emissiveMap','alphaMap','lightMap','displacementMap','bumpMap','envMap'];

    model.traverse(child => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
            if (!mat) return;
            SLOTS.forEach(slot => {
                const tex = mat[slot];
                if (!tex || seen.has(tex.uuid)) return;
                seen.add(tex.uuid);

                if (tex.anisotropy < maxAniso) {
                    tex.anisotropy  = maxAniso;
                    tex.needsUpdate = true;
                }
                if (tex.generateMipmaps === false) {
                    tex.generateMipmaps = true;
                    tex.needsUpdate     = true;
                }
                if (tex.minFilter === THREE.NearestFilter) {
                    tex.minFilter   = THREE.LinearMipmapLinearFilter;
                    tex.needsUpdate = true;
                }
            });
        });
    });
}

// ── 6. SHADER PRE-COMPILATION ─────────────────────────────────────────────────────
// Compila shaders antes do primeiro frame visível para eliminar stutter.
async function _prewarmShaders(model) {
    const renderer = _getRenderer();
    const scene    = _getScene();
    if (!renderer || !scene) return;
    try {
        if (typeof renderer.compile === 'function') {
            // Compila usando a cena real em vez de clonar o modelo.
            // model.clone() quebra SkinnedMesh: o clone aponta para o skeleton
            // original mas sem rebind — renderer.compile() crasha ao tentar
            // acessar boneTexture de um skeleton não inicializado na cena temp.
            const cam = _getCamera() || new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
            renderer.compile(scene, cam);
            return;
        }
        // Fallback: render offscreen 1×1
        const rt = new THREE.WebGLRenderTarget(1, 1);
        const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 10000);
        cam.position.set(0, 0, 10);
        model.traverse(c => { if (c.isMesh) c.frustumCulled = false; });
        renderer.setRenderTarget(rt);
        renderer.render(scene, cam);
        renderer.setRenderTarget(null);
        model.traverse(c => { if (c.isMesh && !c.isSkinnedMesh) c.frustumCulled = true; });
        rt.dispose();
    } catch (e) {
        console.warn('[ModelHandler] Shader prewarm falhou:', e.message);
    }
}

// ── 7. MATERIAL UPGRADE ───────────────────────────────────────────────────────────
async function _upgradeMaterials(model) {
    const chunks = [];
    model.traverse(child => { if (child.isMesh) chunks.push(child); });

    const disposedUUIDs = new Set(); // Evita dispose duplo em materiais compartilhados
    for (let i = 0; i < chunks.length; i++) {
        const child = chunks[i];
        const mats  = Array.isArray(child.material) ? child.material : [child.material];
        const out   = mats.map(mat => {
            if (!mat) return mat;
            if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
                if (!mat.roughnessMap && mat.roughness === undefined) mat.roughness = 0.75;
                if (!mat.metalnessMap && !mat.metalness)              mat.metalness = 0.08;
                mat.needsUpdate = true;
                return mat;
            }
            const std = new THREE.MeshStandardMaterial({
                color:       mat.color       || new THREE.Color(0xcccccc),
                map:         mat.map         || null,
                alphaMap:    mat.alphaMap    || null,
                transparent: mat.transparent || false,
                opacity:     mat.opacity     ?? 1,
                side:        mat.side        ?? THREE.FrontSide,
                roughness:   0.75,
                metalness:   0.08,
            });
            // Só descarta se não foi descartado antes — material pode ser compartilhado
            // por múltiplas meshes; dispose duplo quebra todas as outras
            if (mat.dispose && !disposedUUIDs.has(mat.uuid)) {
                disposedUUIDs.add(mat.uuid);
                mat.dispose();
            }
            return std;
        });
        child.material = Array.isArray(child.material) ? out : out[0];
        if (i % 8 === 7) await yield$();
    }
}

// ── 8. PIPELINE PRINCIPAL ─────────────────────────────────────────────────────────
async function finalizeModelHandler(model, originalFileName, fileSizeBytes = 0) {
    const set          = window._nexusSetProgress || (() => {});
    const scene        = _getScene();
    const sceneObjects = window.sceneObjects || [];

    set(55, 'Preparando meshes…');
    model.position.set(0, 0, 0);

    let hasBones = false;
    model.traverse(child => {
        if (child.isSkinnedMesh) { child.frustumCulled = false; hasBones = true; }
        if (child.isBone)        { hasBones = true; }
        if (child.isMesh)        { child.layers.enable(1); }
    });
    await yield$();

    set(60, 'Atualizando materiais…');
    await _upgradeMaterials(model);
    await yield$();

    set(65, 'Unificando materiais…');
    if (typeof window._nexusDeduplicateMaterials === 'function')
        window._nexusDeduplicateMaterials(model);
    await yield$();

    set(68, 'Otimizando texturas…');
    _optimizeTextures(model);
    await yield$();

    set(72, 'Adicionando à cena…');
    model.name = (window._nexusGenerateName || (t => t))(
        'Modelo_' + originalFileName.replace(/\.(zip|gltf|glb|obj)$/i, '')
    );
    model.userData.isImportedModel  = true;
    model.userData.originalFileName = originalFileName;
    if (scene) scene.add(model);
    sceneObjects.push(model);
    await yield$();

    set(75, 'Configurando sombras…');
    if (typeof window._nexusCullSmallShadows === 'function')
        window._nexusCullSmallShadows(model);
    model.traverse(child => {
        if (!child.isMesh) return;
        child.castShadow    = true;
        child.receiveShadow = true;
    });
    _registerShadowMeshes(model);
    await yield$();

    set(80, 'Aplicando LOD por distância…');
    const lodCount = await _applyLOD(model);
    await yield$();

    set(86, 'Congelando matrizes estáticas…');
    const frozenCount = _freezeChildMatrices(model);
    if (scene) model.updateMatrixWorld(true);
    await yield$();

    set(89, 'Recalculando volumes…');
    if (typeof window._nexusRebuildBounds === 'function')
        window._nexusRebuildBounds(model);
    await yield$();

    set(93, 'Compilando shaders…');
    await _prewarmShaders(model);
    await yield$();

    if (hasBones) {
        set(96, 'Construindo rig…');
        await yield$(); await yield$();
        model.updateMatrixWorld(true, true);
        if (typeof window._nexusBuildBoneHelpers === 'function')
            window._nexusBuildBoneHelpers(model);
    }

    set(99, 'Finalizando…');
    if (typeof window._nexusInvalidateBloom    === 'function') window._nexusInvalidateBloom();
    if (typeof window._nexusRequestShadow      === 'function') window._nexusRequestShadow();
    if (typeof window._nexusSnapshotPostQuality === 'function') window._nexusSnapshotPostQuality();
    await yield$();

    set(100, `✅ Pronto! (${lodCount} LODs · ${frozenCount} matrizes congeladas)`);
    await yield$();

    if (typeof window._nexusRemoveOverlay === 'function') window._nexusRemoveOverlay();
    if (typeof window._nexusSaveState     === 'function') window._nexusSaveState();
    if (typeof window._nexusUpdateObjects === 'function') window._nexusUpdateObjects();
    if (typeof window._nexusFitCamera     === 'function') window._nexusFitCamera(model);

    console.info(
        `[ModelHandler] ✅ ${originalFileName} — ` +
        `LODs: ${lodCount} | matrizes: ${frozenCount} | shadow meshes: ${_shadowManagedMeshes.length}`
    );
}

// ── LOD + SHADOW UPDATER ──────────────────────────────────────────────────────────
function updateAllLOD() {
    const cam = _getCamera();
    if (!cam) return;
    for (let i = 0; i < _lodObjects.length; i++) _lodObjects[i].update(cam);
}

function removeLODForModel(model) {
    const set = new Set();
    model.traverse(c => { if (c.isLOD || c.userData?.isLOD) set.add(c); });
    for (let i = _lodObjects.length - 1; i >= 0; i--)
        if (set.has(_lodObjects[i])) _lodObjects.splice(i, 1);

    // Remove do shadow manager
    for (let i = _shadowManagedMeshes.length - 1; i >= 0; i--) {
        const m = _shadowManagedMeshes[i].mesh;
        let belongs = false;
        model.traverse(c => { if (c === m) belongs = true; });
        if (belongs) _shadowManagedMeshes.splice(i, 1);
    }
}

// ── LOOP DE ATUALIZAÇÃO ───────────────────────────────────────────────────────────
// RAF próprio, paralelo ao loop do engine.
let _rafRunning = false;
function _startUpdateLoop() {
    if (_rafRunning) return;
    _rafRunning = true;
    function tick() {
        updateAllLOD();
        updateShadowLOD();
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ── INICIALIZAÇÃO ─────────────────────────────────────────────────────────────────
async function init() {
    await _waitGlobals();

    // Substitui o pipeline do main.js
    window._nexusFinalizeModel = finalizeModelHandler;

    // Compartilha array de LOD com main.js
    if (window._nexusLODObjects) {
        _lodObjects.push(...window._nexusLODObjects.splice(0));
    }
    window._nexusLODObjects        = _lodObjects;
    window._nexusUpdateAllLOD      = updateAllLOD;
    window._nexusUpdateShadowLOD   = updateShadowLOD;
    window._nexusRemoveLODForModel = removeLODForModel;
    window._nexusUnfreezeObject    = _unfreezeObject;

    _startUpdateLoop();
    console.info('[ModelHandler] ✅ Iniciado — LOD 4 níveis · Shadow LOD · Matrix Freeze · Shader Prewarm');
}

init().catch(e => console.error('[ModelHandler] Erro na inicialização:', e));
