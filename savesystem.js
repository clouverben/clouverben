// ==================== SAVE SYSTEM + SKYBOX ====================
import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';
import { RGBELoader } from 'https://unpkg.com/three@0.169.0/examples/jsm/loaders/RGBELoader.js';

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
        this._storageKey  = 'nexusEngine_project_v1';
    }

    // ── FIX: Download dispara corretamente em todos os browsers ──────────────
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

    // ── FIX: _textureToDataURL com proteção contra SecurityError (tainted canvas) ──
    _textureToDataURL(texture, maxSize = 512) {
        if (!texture?.image) return null;
        const img = texture.image;
        try {
            const w = Math.min(img.width  || img.naturalWidth  || 0, maxSize);
            const h = Math.min(img.height || img.naturalHeight || 0, maxSize);
            if (!w || !h) return null;

            const canvas = document.createElement('canvas');
            canvas.width  = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);

            // FIX: toDataURL pode lançar SecurityError em canvas tainted
            try {
                return canvas.toDataURL('image/jpeg', 0.80);
            } catch (secErr) {
                console.warn('[SaveSystem] Canvas tainted, ignorando textura:', secErr.message);
                return null;
            }
        } catch (e) {
            console.warn('[SaveSystem] Falha ao extrair textura:', e.message);
            return null;
        }
    }

    // ── FIX: _serializeModel mais robusto — trata bones e SkinnedMesh ────────
    _serializeModel(obj) {
        // Coleta texturas antes do toJSON
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

        // FIX: toJSON em SkinnedMesh pode falhar — serializa apenas parte segura
        let json;
        try {
            json = obj.toJSON();
        } catch (e) {
            console.warn('[SaveSystem] toJSON falhou, tentando serialização parcial:', e.message);
            // Fallback: serializa só os meshes não-skinned
            const fallback = new THREE.Group();
            fallback.name = obj.name;
            obj.traverse(child => {
                if (child.isMesh && !child.isSkinnedMesh) {
                    const clone = child.clone();
                    clone.skeleton = undefined;
                    fallback.add(clone);
                }
            });
            try {
                json = fallback.toJSON();
            } catch (e2) {
                console.error('[SaveSystem] Serialização parcial também falhou:', e2.message);
                return null;
            }
        }

        // Substitui blob/http URLs por data URLs nas imagens
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
                        else delete imgData.url; // evita blob inválido
                    }
                }
            });
        }

        return json;
    }

    // ── Serializa a cena inteira ─────────────────────────────────────────────
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

                // Material do primeiro mesh
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

                // Modelo 3D importado
                if (obj.userData?.isImportedModel) {
                    try {
                        console.log(`[SaveSystem] Serializando modelo 3D: ${obj.name}…`);
                        const modelData = this._serializeModel(obj);
                        if (modelData) {
                            entry.modelData = modelData;
                            console.log(`[SaveSystem] ✅ Modelo serializado: ${obj.name}`);
                        } else {
                            console.warn(`[SaveSystem] ⚠️ Serialização retornou null para: ${obj.name}`);
                        }
                    } catch (err) {
                        console.warn(`[SaveSystem] ⚠️ Não foi possível serializar ${obj.name}:`, err);
                    }
                }

                objects.push(entry);
            } catch (objErr) {
                console.warn(`[SaveSystem] Erro ao serializar objeto ${obj.name}:`, objErr);
            }
        });

        // Skybox
        let skybox = null;
        if (this.scene.background instanceof THREE.Color) {
            skybox = { type: 'color', value: '#' + this.scene.background.getHexString() };
        }

        return { version: '1.1', timestamp: new Date().toISOString(), skybox, objects };
    }

    _firstMesh(obj) {
        if (obj?.isMesh) return obj;
        for (const c of (obj?.children || [])) { const m = this._firstMesh(c); if (m) return m; }
        return null;
    }

    // ── Salvar no localStorage ───────────────────────────────────────────────
    save() {
        try {
            const data = JSON.stringify(this._serialize());
            try { localStorage.setItem(this._storageKey, data); } catch(e) { throw e; }
            this._toast('✅ Projeto salvo!');
        } catch (err) {
            console.error('[SaveSystem] Erro ao salvar:', err);
            // FIX: QuotaExceededError é comum com modelos grandes
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

    // ── FIX: Export assíncrono com download correto ───────────────────────────
    export() {
        this._toast('⏳ Preparando exportação…');

        // FIX: usa setTimeout para o toast aparecer, depois processa
        setTimeout(async () => {
            try {
                let data;

                // FIX: JSON.stringify pode travar com modelos muito grandes — tenta com yield
                try {
                    data = JSON.stringify(this._serialize(), null, 2);
                } catch (jsonErr) {
                    console.error('[SaveSystem] JSON.stringify falhou:', jsonErr);
                    this._toast('❌ Erro ao serializar: ' + (jsonErr.message || jsonErr), 'error');
                    return;
                }

                const sizeKB = (data.length / 1024).toFixed(0);
                console.log(`[SaveSystem] Export size: ${sizeKB} KB`);

                const blob = new Blob([data], { type: 'application/json' });
                const url  = URL.createObjectURL(blob);
                const ts   = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

                // FIX: usa _triggerDownload em vez de a.click() sem append
                this._triggerDownload(url, `nexus_project_${ts}.json`);

                this._toast(`📤 Exportado! (${sizeKB} KB)`);

            } catch (err) {
                console.error('[SaveSystem] Erro ao exportar:', err);
                this._toast('❌ Erro ao exportar: ' + (err.message || err), 'error');
            }
        }, 100);
    }

    // ── Importar de arquivo .json ────────────────────────────────────────────
    async importFromFile(file) {
        try {
            this._toast('⏳ Carregando projeto…');
            const text = await file.text();

            let data;
            try {
                data = JSON.parse(text);
            } catch (parseErr) {
                this._toast('❌ Arquivo JSON inválido ou corrompido', 'error');
                return;
            }

            if (!data?.objects || !Array.isArray(data.objects)) {
                this._toast('❌ Estrutura do arquivo inválida', 'error');
                return;
            }

            if (typeof window.importNexusProject === 'function') {
                await window.importNexusProject(data);
                this._toast(`✅ Projeto importado! (${data.objects.length} objeto(s))`);
            } else {
                this._toast('❌ Motor não pronto, tente novamente', 'error');
            }
        } catch (err) {
            console.error('[SaveSystem] Erro ao importar:', err);
            this._toast('❌ Erro ao importar: ' + (err.message || err), 'error');
        }
    }

    // ── Toast ────────────────────────────────────────────────────────────────
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

    // FIX: usa getter dinâmico para sempre apontar ao array atual de sceneObjects
    const save = new SaveSystem(scene, window.sceneObjects || []);

    // FIX: re-aponta sceneObjects sempre que save.export/save é chamado,
    // garantindo que o array mais recente seja usado
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

    const importProjectBtn = document.getElementById('import-project-btn');
    const projectFileInput = document.getElementById('project-file-input');
    if (importProjectBtn && projectFileInput) {
        importProjectBtn.addEventListener('click', e => { e.stopPropagation(); projectFileInput.click(); });
        projectFileInput.addEventListener('change', async e => {
            const file = e.target.files[0]; if (!file) return;
            await save.importFromFile(file);
            projectFileInput.value = '';
        });
    }

    console.log('[SaveSystem + Skybox] ✅ Inicializado');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettingsSystem);
} else {
    initSettingsSystem();
}

export { SaveSystem, SkyboxManager };
