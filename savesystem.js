// ==================== SAVE SYSTEM + SKYBOX ====================
import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';
import { RGBELoader } from 'https://unpkg.com/three@0.169.0/examples/jsm/loaders/RGBELoader.js';

// =========================================================================
//  FORMATO .NEX — Binário proprietário Nexus Engine v2
// =========================================================================
//
//  Offset  Tamanho  Campo
//  ------  -------  -----
//  0       7        Magic: 0x4E 45 58 55 53 33 44  ("NEXUS3D")
//  7       1        Versão do formato: 0x02
//  8       8        Salt aleatório (derivação de chave)
//  16      4        CRC32 do payload obfuscado (uint32 LE)
//  20      4        Comprimento do payload em bytes (uint32 LE)
//  24      N        Payload: JSON comprimido (deflate) + XOR keystream
//
//  O keystream é derivado do salt + segredo de aplicação interno.
//  Sem a lógica de derivação correta o arquivo não pode ser lido.
// =========================================================================

const _NEX_MAGIC    = [0x4E, 0x45, 0x58, 0x55, 0x53, 0x33, 0x44]; // "NEXUS3D"
const _NEX_VERSION  = 0x02;

// Segredo interno (não exposto como string legível)
const _APP_KEY = Uint8Array.from([
    0x6E,0x33,0x78,0x75,0x73,0x5F,0x73,0x63,
    0x33,0x6E,0x65,0x5F,0x73,0x65,0x63,0x72,
    0x65,0x74,0x5F,0x76,0x32,0x21,0x40,0x23,
    0x24,0x25,0x5E,0x26,0x2A,0x28,0x29,0x7E,
]);

// ── CRC32 ─────────────────────────────────────────────────────────────────
const _CRC32_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[i] = c;
    }
    return t;
})();

function _crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++)
        crc = _CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── Derivação de keystream (PRNG LCG baseado em salt + _APP_KEY) ──────────
function _deriveKeystream(salt, length) {
    let seed = 0;
    for (let i = 0; i < 8; i++) {
        seed ^= (salt[i] * _APP_KEY[i % _APP_KEY.length]);
        seed  = Math.imul(seed, 0x5851F42D) + 0x14057B7EF767814F;
        seed  = seed >>> 0;
    }
    // LCG: Numerical Recipes params
    const ks = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        ks[i] = (seed ^ _APP_KEY[i % _APP_KEY.length]) & 0xFF;
    }
    return ks;
}

// ── Compressão / Descompressão (DeflateRaw via streams API) ──────────────
async function _compress(data) {
    if (typeof CompressionStream === 'undefined') return data;
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();
    const chunks = [];
    const reader = cs.readable.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    let total = 0;
    chunks.forEach(c => total += c.length);
    const out = new Uint8Array(total);
    let off = 0;
    chunks.forEach(c => { out.set(c, off); off += c.length; });
    return out;
}

async function _decompress(data) {
    if (typeof DecompressionStream === 'undefined') return data;
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(data);
    writer.close();
    const chunks = [];
    const reader = ds.readable.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    let total = 0;
    chunks.forEach(c => total += c.length);
    const out = new Uint8Array(total);
    let off = 0;
    chunks.forEach(c => { out.set(c, off); off += c.length; });
    return out;
}

// ── Encoda payload JSON → bytes .nex ─────────────────────────────────────
async function _encodeNex(jsonObj) {
    // 1. JSON → UTF-8
    const jsonStr  = JSON.stringify(jsonObj);
    const jsonBytes = new TextEncoder().encode(jsonStr);

    // 2. Comprimir
    const compressed = await _compress(jsonBytes);

    // 3. Gerar salt aleatório
    const salt = crypto.getRandomValues(new Uint8Array(8));

    // 4. Derivar keystream e XOR
    const ks = _deriveKeystream(salt, compressed.length);
    const obfuscated = compressed.map((b, i) => b ^ ks[i]);

    // 5. CRC32 do payload obfuscado
    const crc = _crc32(obfuscated);

    // 6. Montar buffer final
    // Header: magic(7) + version(1) + salt(8) + crc32(4) + length(4) = 24 bytes
    const out = new Uint8Array(24 + obfuscated.length);
    let pos = 0;
    _NEX_MAGIC.forEach(b => { out[pos++] = b; });
    out[pos++] = _NEX_VERSION;
    salt.forEach(b => { out[pos++] = b; });
    // CRC32 little-endian
    out[pos++] = (crc)       & 0xFF;
    out[pos++] = (crc >>  8) & 0xFF;
    out[pos++] = (crc >> 16) & 0xFF;
    out[pos++] = (crc >> 24) & 0xFF;
    // Length little-endian
    const len = obfuscated.length;
    out[pos++] = (len)       & 0xFF;
    out[pos++] = (len >>  8) & 0xFF;
    out[pos++] = (len >> 16) & 0xFF;
    out[pos++] = (len >> 24) & 0xFF;
    out.set(obfuscated, pos);
    return out;
}

// ── Decodifica bytes .nex → objeto JSON ──────────────────────────────────
async function _decodeNex(buffer) {
    const data = new Uint8Array(buffer);

    // 1. Verificar magic
    for (let i = 0; i < 7; i++) {
        if (data[i] !== _NEX_MAGIC[i])
            throw new Error('Arquivo inválido: não é um projeto .nex do Nexus Engine.');
    }

    // 2. Verificar versão
    const version = data[7];
    if (version < 0x01 || version > _NEX_VERSION)
        throw new Error(`Versão de projeto .nex não suportada: ${version}`);

    // 3. Ler salt
    const salt = data.slice(8, 16);

    // 4. Ler CRC32 esperado (LE)
    const crcExpected = data[16] | (data[17] << 8) | (data[18] << 16) | (data[19] << 24);

    // 5. Ler comprimento (LE)
    const payloadLen = data[20] | (data[21] << 8) | (data[22] << 16) | (data[23] << 24);

    if (24 + payloadLen > data.length)
        throw new Error('Arquivo .nex corrompido: comprimento inválido.');

    // 6. Extrair payload
    const obfuscated = data.slice(24, 24 + payloadLen);

    // 7. Verificar CRC32
    const crcActual = _crc32(obfuscated);
    if ((crcActual >>> 0) !== (crcExpected >>> 0))
        throw new Error('Arquivo .nex corrompido: checksum inválido.');

    // 8. De-XOR
    const ks = _deriveKeystream(salt, obfuscated.length);
    const compressed = obfuscated.map((b, i) => b ^ ks[i]);

    // 9. Descomprimir
    const jsonBytes = await _decompress(compressed);

    // 10. UTF-8 → JSON
    const jsonStr = new TextDecoder().decode(jsonBytes);
    return JSON.parse(jsonStr);
}


// ==================== SKYBOX ====================
class SkyboxManager {
    constructor(scene, renderer) {
        this.scene    = scene;
        this.renderer = renderer;
        this._pmremGenerator = new THREE.PMREMGenerator(renderer);
        this._pmremGenerator.compileEquirectangularShader();
        this._currentTexture = null;
    }

    setSolidColor(hex) {
        this._clearEnv();
        this.scene.background = new THREE.Color(hex);
        this.scene.environment = null;
    }

    setGradient(topColor = '#0a0a2a', bottomColor = '#1a3a5c') {
        this._clearEnv();
        const size   = 512;
        const canvas = document.createElement('canvas');
        canvas.width = 1; canvas.height = size;
        const ctx  = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, size);
        grad.addColorStop(0, topColor);
        grad.addColorStop(1, bottomColor);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1, size);
        const tex = new THREE.CanvasTexture(canvas);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.background = tex;
        this._currentTexture  = tex;
    }

    async setFromFile(file) {
        const url  = URL.createObjectURL(file);
        const name = file.name.toLowerCase();
        try {
            let tex;
            if (name.endsWith('.hdr') || name.endsWith('.exr')) {
                tex = await this._loadHDR(url);
            } else {
                tex = await this._loadImage(url);
            }
            this._applyEquirect(tex);
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    _loadHDR(url) {
        return new Promise((res, rej) => new RGBELoader().load(url, tex => res(tex), undefined, rej));
    }

    _loadImage(url) {
        return new Promise((res, rej) => new THREE.TextureLoader().load(url, tex => res(tex), undefined, rej));
    }

    _applyEquirect(tex) {
        this._clearEnv();
        tex.mapping = THREE.EquirectangularReflectionMapping;
        const envTex = this._pmremGenerator.fromEquirectangular(tex).texture;
        this.scene.background  = tex;
        this.scene.environment = envTex;
        this._currentTexture   = tex;
        this._pmremGenerator.dispose();
    }

    remove() {
        this._clearEnv();
        this.scene.background = new THREE.Color(0x111122);
        this.scene.environment = null;
    }

    _clearEnv() {
        if (this._currentTexture) { this._currentTexture.dispose(); this._currentTexture = null; }
    }
}


// ==================== SAVE SYSTEM ====================
class SaveSystem {
    constructor(scene, sceneObjects) {
        this.scene        = scene;
        this.sceneObjects = sceneObjects;
        this._storageKey  = 'nexusEngine_project_v2';
    }

    _triggerDownload(url, filename) {
        const a = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    }

    // ── Extrai textura para DataURL (JPEG comprimido) ────────────────────
    _textureToDataURL(texture, maxSize = 512) {
        if (!texture?.image) return null;
        const img = texture.image;
        try {
            const w = Math.min(img.width  || img.naturalWidth  || 0, maxSize);
            const h = Math.min(img.height || img.naturalHeight || 0, maxSize);
            if (!w || !h) return null;
            const canvas = document.createElement('canvas');
            canvas.width  = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            try { return canvas.toDataURL('image/jpeg', 0.80); }
            catch (secErr) { console.warn('[SaveSystem] Canvas tainted:', secErr.message); return null; }
        } catch (e) {
            console.warn('[SaveSystem] Falha ao extrair textura:', e.message);
            return null;
        }
    }

    // ── Serializa modelo 3D importado (com texturas embutidas) ───────────
    _serializeModel(obj) {
        const texByUUID = new Map();
        obj.traverse(child => {
            if (!child.isMesh || !child.material) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
                ['map','normalMap','roughnessMap','metalnessMap','aoMap',
                 'emissiveMap','alphaMap','lightMap','displacementMap','bumpMap'].forEach(prop => {
                    const tex = mat[prop];
                    if (tex?.image) texByUUID.set(tex.uuid, tex);
                });
            });
        });

        let json;
        try {
            json = obj.toJSON();
        } catch (e) {
            console.warn('[SaveSystem] toJSON falhou, serialização parcial:', e.message);
            const fallback = new THREE.Group();
            fallback.name = obj.name;
            obj.traverse(child => {
                if (child.isMesh && !child.isSkinnedMesh) {
                    const clone = child.clone();
                    clone.skeleton = undefined;
                    fallback.add(clone);
                }
            });
            try { json = fallback.toJSON(); }
            catch (e2) { console.error('[SaveSystem] Serialização parcial falhou:', e2.message); return null; }
        }

        if (json.images && json.textures) {
            const imgUUIDtoTex = new Map();
            json.textures.forEach(texData => {
                const tex = texByUUID.get(texData.uuid);
                if (tex && texData.image) imgUUIDtoTex.set(texData.image, tex);
            });
            json.images.forEach(imgData => {
                const isBlobOrExternal = !imgData.url
                    || imgData.url.startsWith('blob:')
                    || imgData.url.startsWith('http');
                if (isBlobOrExternal) {
                    const tex = imgUUIDtoTex.get(imgData.uuid);
                    if (tex) {
                        const dataURL = this._textureToDataURL(tex);
                        if (dataURL) imgData.url = dataURL;
                        else delete imgData.url;
                    }
                }
            });
        }
        return json;
    }

    // ── Captura estado de animações do AnimationSystem ───────────────────
    _serializeAnimations() {
        try {
            if (typeof window.AnimationSystem === 'undefined') return null;
            const state = window.AnimationSystem.getState?.();
            if (!state) return null;
            // Serializa keyframes e configurações da timeline
            return {
                keyframes:    state.keyframes    ?? {},
                duration:     state.duration     ?? 120,
                fps:          state.fps          ?? 30,
                currentFrame: state.currentFrame ?? 0,
            };
        } catch (e) {
            console.warn('[SaveSystem] Falha ao serializar animações:', e.message);
            return null;
        }
    }

    // ── Captura config dos sistemas de partículas ────────────────────────
    _serializeParticles() {
        try {
            const particleSystems = window.particleSystems || [];
            return particleSystems.map(ps => {
                const base = {
                    uuid:     ps.uuid,
                    type:     ps.userData?.particleType || 'unknown',
                    position: ps.position?.toArray() ?? [0,0,0],
                };
                if (typeof ps.getConfig === 'function') base.config = ps.getConfig();
                return base;
            });
        } catch (e) {
            console.warn('[SaveSystem] Falha ao serializar partículas:', e.message);
            return [];
        }
    }

    // ── Serializa a cena completa ────────────────────────────────────────
    _serialize() {
        const objects = [];

        this.sceneObjects.forEach(obj => {
            try {
                const entry = {
                    uuid:     obj.uuid,
                    name:     obj.name,
                    type:     obj.type,
                    position: obj.position.toArray(),
                    rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z, obj.rotation.order],
                    scale:    obj.scale.toArray(),
                    visible:  obj.visible,
                    userData: { ...obj.userData },
                };

                // Material
                const mesh = this._firstMesh(obj);
                if (mesh?.material) {
                    const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
                    entry.material = {
                        type:              m.type,
                        color:             m.color?.getHex(),
                        emissive:          m.emissive?.getHex(),
                        emissiveIntensity: m.emissiveIntensity,
                        roughness:         m.roughness,
                        metalness:         m.metalness,
                        transparent:       m.transparent,
                        opacity:           m.opacity,
                        wireframe:         m.wireframe,
                        side:              m.side,
                    };
                }

                // Luz
                if (obj.userData?.isLight && obj.userData?.light) {
                    const l = obj.userData.light;
                    entry.light = {
                        lightType:  l.type,
                        color:      l.color.getHex(),
                        intensity:  l.intensity,
                        distance:   l.distance,
                        castShadow: l.castShadow,
                    };
                }

                // Física
                if (obj.userData?.hasPhysics) {
                    entry.physics = {
                        type:        obj.userData.physicsType,
                        shape:       obj.userData.physicsShape,
                        mass:        obj.userData.physicsMass,
                        friction:    obj.userData.physicsFriction,
                        restitution: obj.userData.physicsRestitution,
                    };
                }

                // Modelo 3D importado — serializa geometria + texturas
                if (obj.userData?.isImportedModel) {
                    try {
                        console.log(`[SaveSystem] Serializando modelo 3D: ${obj.name}…`);
                        const modelData = this._serializeModel(obj);
                        if (modelData) {
                            entry.modelData = modelData;
                            console.log(`[SaveSystem] ✅ Modelo serializado: ${obj.name}`);
                        } else {
                            console.warn(`[SaveSystem] ⚠️ Serialização retornou null: ${obj.name}`);
                        }
                    } catch (err) {
                        console.warn(`[SaveSystem] ⚠️ Não foi possível serializar ${obj.name}:`, err);
                    }
                }

                objects.push(entry);
            } catch (objErr) {
                console.warn(`[SaveSystem] Erro ao serializar ${obj.name}:`, objErr);
            }
        });

        // Skybox
        let skybox = null;
        if (this.scene.background instanceof THREE.Color) {
            skybox = { type: 'color', value: '#' + this.scene.background.getHexString() };
        }

        return {
            version:    '2.0',
            format:     'nex',
            timestamp:  new Date().toISOString(),
            skybox,
            objects,
            animations: this._serializeAnimations(),
            particles:  this._serializeParticles(),
        };
    }

    _firstMesh(obj) {
        if (obj?.isMesh) return obj;
        for (const c of (obj?.children || [])) { const m = this._firstMesh(c); if (m) return m; }
        return null;
    }

    // ── Salvar no localStorage (formato interno rápido) ──────────────────
    save() {
        try {
            const data = JSON.stringify(this._serialize());
            try { localStorage.setItem(this._storageKey, data); } catch(e) { throw e; }
            this._toast('✅ Projeto salvo!');
        } catch (err) {
            console.error('[SaveSystem] Erro ao salvar:', err);
            if (err.name === 'QuotaExceededError') {
                this._toast('❌ Projeto grande demais para localStorage. Use Exportar.', 'error');
            } else {
                this._toast('❌ Erro ao salvar: ' + (err.message || err), 'error');
            }
        }
    }

    hasSaved() {
        try { return !!localStorage.getItem(this._storageKey); } catch(e) { return false; }
    }

    // ── Exportar como .nex (binário proprietário) ────────────────────────
    export() {
        this._toast('⏳ Preparando exportação .nex…');

        setTimeout(async () => {
            try {
                this.sceneObjects = window.sceneObjects || this.sceneObjects;
                const payload = this._serialize();

                this._toast('⏳ Codificando…');
                await new Promise(r => setTimeout(r, 50)); // deixa toast aparecer

                const nexBytes = await _encodeNex(payload);
                const sizeKB   = (nexBytes.length / 1024).toFixed(0);
                console.log(`[SaveSystem] .nex size: ${sizeKB} KB`);

                const blob = new Blob([nexBytes], { type: 'application/octet-stream' });
                const url  = URL.createObjectURL(blob);
                const ts   = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                this._triggerDownload(url, `nexus_project_${ts}.nex`);

                this._toast(`📦 Exportado! (${sizeKB} KB) — nexus_project_${ts}.nex`);

            } catch (err) {
                console.error('[SaveSystem] Erro ao exportar .nex:', err);
                this._toast('❌ Erro ao exportar: ' + (err.message || err), 'error');
            }
        }, 100);
    }

    // ── Importar arquivo .nex (ou .json legado) ──────────────────────────
    async importFromFile(file) {
        const name = file.name.toLowerCase();

        // ── Suporte legado: arquivos .json antigos ──────────────────────
        if (name.endsWith('.json')) {
            try {
                this._toast('⏳ Carregando projeto legado (.json)…');
                const text = await file.text();
                let data;
                try { data = JSON.parse(text); }
                catch { this._toast('❌ Arquivo JSON inválido ou corrompido', 'error'); return; }
                if (!data?.objects || !Array.isArray(data.objects)) {
                    this._toast('❌ Estrutura do arquivo inválida', 'error'); return;
                }
                await this._applyProjectData(data);
                this._toast(`✅ Projeto legado importado! (${data.objects.length} objeto(s))`);
            } catch (err) {
                console.error('[SaveSystem] Erro ao importar .json:', err);
                this._toast('❌ Erro ao importar: ' + (err.message || err), 'error');
            }
            return;
        }

        // ── Formato .nex ─────────────────────────────────────────────────
        if (!name.endsWith('.nex')) {
            this._toast('❌ Formato não suportado. Use arquivos .nex', 'error');
            return;
        }

        try {
            this._toast('⏳ Carregando projeto .nex…');
            const buffer = await file.arrayBuffer();

            let data;
            try {
                data = await _decodeNex(buffer);
            } catch (decodeErr) {
                console.error('[SaveSystem] Falha ao decodificar .nex:', decodeErr);
                this._toast('❌ ' + (decodeErr.message || 'Arquivo .nex inválido'), 'error');
                return;
            }

            if (!data?.objects || !Array.isArray(data.objects)) {
                this._toast('❌ Estrutura do arquivo .nex inválida', 'error');
                return;
            }

            await this._applyProjectData(data);
            const count = data.objects.length;
            const hasAnim = data.animations?.keyframes
                ? Object.keys(data.animations.keyframes).length > 0
                : false;
            this._toast(`✅ Projeto importado! (${count} objeto(s)${hasAnim ? ', animações ✓' : ''})`);

        } catch (err) {
            console.error('[SaveSystem] Erro ao importar .nex:', err);
            this._toast('❌ Erro ao importar: ' + (err.message || err), 'error');
        }
    }

    // ── Aplica dados de projeto na cena ──────────────────────────────────
    async _applyProjectData(data) {
        // 1. Importa cena (objetos, luzes, câmeras, modelos)
        if (typeof window.importNexusProject === 'function') {
            await window.importNexusProject(data);
        } else {
            throw new Error('Motor não pronto. Tente novamente em instantes.');
        }

        // 2. Restaura animações
        if (data.animations && typeof window.AnimationSystem !== 'undefined') {
            try {
                if (typeof window.AnimationSystem.loadState === 'function') {
                    window.AnimationSystem.loadState(data.animations);
                    console.log('[SaveSystem] ✅ Animações restauradas');
                } else if (data.animations.keyframes) {
                    // Fallback: restaura keyframes diretamente via API pública
                    const state = window.AnimationSystem.getState?.();
                    if (state) {
                        Object.assign(state, {
                            keyframes:    data.animations.keyframes,
                            duration:     data.animations.duration     ?? state.duration,
                            fps:          data.animations.fps          ?? state.fps,
                            currentFrame: data.animations.currentFrame ?? 0,
                        });
                    }
                }
            } catch (animErr) {
                console.warn('[SaveSystem] Falha ao restaurar animações:', animErr.message);
            }
        }

        // 3. Restaura partículas
        if (data.particles?.length > 0) {
            console.log(`[SaveSystem] ${data.particles.length} sistema(s) de partículas no arquivo.`);
            // Partículas já são recriadas via importNexusProject ao processar sceneObjects.
            // Configs extras podem ser aplicadas aqui se necessário.
        }
    }

    // ── Toast ────────────────────────────────────────────────────────────
    _toast(msg, type = 'success') {
        const existing = document.getElementById('_nexus_toast');
        if (existing) existing.remove();
        const t = document.createElement('div');
        t.id = '_nexus_toast';
        t.textContent = msg;
        t.style.cssText = `
            position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
            background:${type === 'error' ? 'rgba(200,50,50,.95)' : 'rgba(20,180,80,.95)'};
            color:#fff;padding:10px 22px;border-radius:8px;font-size:13px;
            font-weight:600;z-index:99999;pointer-events:none;
            box-shadow:0 4px 20px rgba(0,0,0,.4);
        `;
        document.body.appendChild(t);
        setTimeout(() => { if (t.parentNode) { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; } }, 2500);
        setTimeout(() => t.remove(), 2800);
    }
}


// ==================== INICIALIZAÇÃO ====================
function initSettingsSystem() {
    const waitForGlobals = () => {
        if (!window._nexusScene || !window._nexusRenderer) {
            setTimeout(waitForGlobals, 100);
            return;
        }
        boot(window._nexusScene, window._nexusRenderer);
    };
    waitForGlobals();
}

function boot(scene, renderer) {
    const skybox = new SkyboxManager(scene, renderer);
    const save   = new SaveSystem(scene, window.sceneObjects || []);

    // Garante que sempre usa o array mais recente de sceneObjects
    const _wrapSerialize = save._serialize.bind(save);
    save._serialize = function() {
        this.sceneObjects = window.sceneObjects || this.sceneObjects;
        return _wrapSerialize();
    };

    window.NexusSkybox = skybox;
    window.NexusSave   = save;

    // Settings panel toggle
    const settingsBtn   = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsBtn && settingsPanel) {
        settingsBtn.addEventListener('click', e => {
            e.stopPropagation();
            settingsPanel.classList.toggle('hidden');
        });
        document.addEventListener('click', e => {
            if (!settingsPanel.contains(e.target) && e.target !== settingsBtn)
                settingsPanel.classList.add('hidden');
        });
    }

    // Skybox controls
    const skyColorPicker = document.getElementById('skybox-color');
    if (skyColorPicker) skyColorPicker.addEventListener('input', e => skybox.setSolidColor(e.target.value));

    const skyColorBtn   = document.getElementById('skybox-color-btn');
    const skyColorGroup = document.getElementById('skybox-color-group');
    if (skyColorBtn && skyColorGroup)
        skyColorBtn.addEventListener('click', e => { e.stopPropagation(); skyColorGroup.classList.toggle('hidden'); });

    const skyUploadBtn = document.getElementById('skybox-upload-btn');
    const skyFileInput = document.getElementById('skybox-file-input');
    if (skyUploadBtn && skyFileInput) {
        skyUploadBtn.addEventListener('click', e => { e.stopPropagation(); skyFileInput.click(); });
        skyFileInput.addEventListener('change', async e => {
            const file = e.target.files[0]; if (!file) return;
            try {
                skyUploadBtn.textContent = '⏳ Carregando…';
                skyUploadBtn.disabled = true;
                await skybox.setFromFile(file);
                skyUploadBtn.innerHTML = '<i data-lucide="image"></i> Carregar Imagem';
                if (window.lucide) window.lucide.createIcons();
            } catch (err) {
                alert('Erro ao carregar skybox: ' + (err.message || err));
            } finally {
                skyUploadBtn.disabled = false;
                skyFileInput.value = '';
            }
        });
    }

    const skyGradBtn = document.getElementById('skybox-gradient-btn');
    if (skyGradBtn) skyGradBtn.addEventListener('click', e => { e.stopPropagation(); skybox.setGradient('#0a0a2a', '#1a3a6c'); });

    const skyRemoveBtn = document.getElementById('skybox-remove-btn');
    if (skyRemoveBtn) skyRemoveBtn.addEventListener('click', e => { e.stopPropagation(); skybox.remove(); });

    // Project controls
    const saveBtn = document.getElementById('save-project-btn');
    if (saveBtn) saveBtn.addEventListener('click', e => { e.stopPropagation(); save.save(); });

    const exportBtn = document.getElementById('export-project-btn');
    if (exportBtn) exportBtn.addEventListener('click', e => { e.stopPropagation(); save.export(); });

    // ── FIX: aceita .nex e .json no mesmo input ──────────────────────────
    const importProjectBtn = document.getElementById('import-project-btn');
    const projectFileInput = document.getElementById('project-file-input');
    if (importProjectBtn && projectFileInput) {
        // Atualiza o accept para .nex (e .json por compatibilidade)
        projectFileInput.accept = '.nex,.json';

        importProjectBtn.addEventListener('click', e => { e.stopPropagation(); projectFileInput.click(); });
        projectFileInput.addEventListener('change', async e => {
            const file = e.target.files[0]; if (!file) return;
            await save.importFromFile(file);
            projectFileInput.value = '';
        });
    }

    console.log('[SaveSystem + Skybox] ✅ Inicializado — Formato .nex v2');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettingsSystem);
} else {
    initSettingsSystem();
}

export { SaveSystem, SkyboxManager };
