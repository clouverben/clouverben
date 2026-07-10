// ============================================================
//  config.js — Painel de Configurações + Sistema de Save .nex
//  Método .nex idêntico ao savesystem.js
// ============================================================

import * as THREE from 'three';
import { app, addPrimitive, markSceneDirty } from './scene.js';
import { addLight } from './lights.js';
import { serializeCameras, restoreCameras } from './cameras.js';

// ════════════════════════════════════════════════════════════
//  FORMATO .NEX — Binário proprietário Nexus Engine v2
// ════════════════════════════════════════════════════════════
const _NEX_MAGIC   = [0x4E, 0x45, 0x58, 0x55, 0x53, 0x33, 0x44]; // "NEXUS3D"
const _NEX_VERSION = 0x02;

const _APP_KEY = Uint8Array.from([
  0x6E,0x33,0x78,0x75,0x73,0x5F,0x73,0x63,
  0x33,0x6E,0x65,0x5F,0x73,0x65,0x63,0x72,
  0x65,0x74,0x5F,0x76,0x32,0x21,0x40,0x23,
  0x24,0x25,0x5E,0x26,0x2A,0x28,0x29,0x7E,
]);

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

function _deriveKeystream(salt, length) {
  let seed = 0;
  for (let i = 0; i < 8; i++) {
    seed ^= (salt[i] * _APP_KEY[i % _APP_KEY.length]);
    seed  = Math.imul(seed, 0x5851F42D) + 0x14057B7EF767814F;
    seed  = seed >>> 0;
  }
  const ks = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    seed  = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    ks[i] = (seed ^ _APP_KEY[i % _APP_KEY.length]) & 0xFF;
  }
  return ks;
}

async function _compress(data) {
  if (typeof CompressionStream === 'undefined') return data;
  const cs = new CompressionStream('deflate-raw');
  const w  = cs.writable.getWriter(); w.write(data); w.close();
  const chunks = []; const r = cs.readable.getReader();
  for (;;) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
  let total = 0; chunks.forEach(c => total += c.length);
  const out = new Uint8Array(total); let off = 0;
  chunks.forEach(c => { out.set(c, off); off += c.length; });
  return out;
}

async function _decompress(data) {
  if (typeof DecompressionStream === 'undefined') return data;
  const ds = new DecompressionStream('deflate-raw');
  const w  = ds.writable.getWriter(); w.write(data); w.close();
  const chunks = []; const r = ds.readable.getReader();
  for (;;) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
  let total = 0; chunks.forEach(c => total += c.length);
  const out = new Uint8Array(total); let off = 0;
  chunks.forEach(c => { out.set(c, off); off += c.length; });
  return out;
}

async function _encodeNex(jsonObj) {
  const jsonBytes  = new TextEncoder().encode(JSON.stringify(jsonObj));
  const compressed = await _compress(jsonBytes);
  const salt       = crypto.getRandomValues(new Uint8Array(8));
  const ks         = _deriveKeystream(salt, compressed.length);
  const obfuscated = compressed.map((b, i) => b ^ ks[i]);
  const crc        = _crc32(obfuscated);
  const len        = obfuscated.length;
  const out        = new Uint8Array(24 + len);
  let pos = 0;
  _NEX_MAGIC.forEach(b => { out[pos++] = b; });
  out[pos++] = _NEX_VERSION;
  salt.forEach(b => { out[pos++] = b; });
  out[pos++] = (crc)       & 0xFF; out[pos++] = (crc >>  8) & 0xFF;
  out[pos++] = (crc >> 16) & 0xFF; out[pos++] = (crc >> 24) & 0xFF;
  out[pos++] = (len)       & 0xFF; out[pos++] = (len >>  8) & 0xFF;
  out[pos++] = (len >> 16) & 0xFF; out[pos++] = (len >> 24) & 0xFF;
  out.set(obfuscated, pos);
  return out;
}

async function _decodeNex(buffer) {
  const data = new Uint8Array(buffer);
  for (let i = 0; i < 7; i++)
    if (data[i] !== _NEX_MAGIC[i])
      throw new Error('Arquivo inválido: não é um projeto .nex do Nexus Engine.');
  const version = data[7];
  if (version < 0x01 || version > _NEX_VERSION)
    throw new Error(`Versão de projeto .nex não suportada: ${version}`);
  const salt        = data.slice(8, 16);
  const crcExpected = data[16] | (data[17] << 8) | (data[18] << 16) | (data[19] << 24);
  const payloadLen  = data[20] | (data[21] << 8) | (data[22] << 16) | (data[23] << 24);
  if (24 + payloadLen > data.length)
    throw new Error('Arquivo .nex corrompido: comprimento inválido.');
  const obfuscated = data.slice(24, 24 + payloadLen);
  if ((_crc32(obfuscated) >>> 0) !== (crcExpected >>> 0))
    throw new Error('Arquivo .nex corrompido: checksum inválido.');
  const ks        = _deriveKeystream(salt, obfuscated.length);
  const compressed = obfuscated.map((b, i) => b ^ ks[i]);
  const jsonBytes  = await _decompress(compressed);
  return JSON.parse(new TextDecoder().decode(jsonBytes));
}

// ════════════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════════════
function _toast(msg, type = 'success') {
  const ex = document.getElementById('_cfg_toast');
  if (ex) ex.remove();
  const t = document.createElement('div');
  t.id = '_cfg_toast';
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:${type === 'error' ? 'rgba(200,50,50,.95)' : 'rgba(20,180,80,.95)'};
    color:#fff;padding:10px 22px;border-radius:8px;font-size:13px;
    font-weight:600;z-index:99999;pointer-events:none;
    box-shadow:0 4px 20px rgba(0,0,0,.4);transition:opacity .3s;
  `;
  document.body.appendChild(t);
  setTimeout(() => { if (t.parentNode) t.style.opacity = '0'; }, 2500);
  setTimeout(() => t.remove(), 2800);
}

// ════════════════════════════════════════════════════════════
//  SERIALIZAÇÃO (idêntica ao SaveSystem do savesystem.js)
// ════════════════════════════════════════════════════════════

function _textureToDataURL(texture, maxSize = 512) {
  if (!texture?.image) return null;
  const img = texture.image;
  try {
    const w = Math.min(img.width || img.naturalWidth  || 0, maxSize);
    const h = Math.min(img.height|| img.naturalHeight || 0, maxSize);
    if (!w || !h) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    try { return canvas.toDataURL('image/jpeg', 0.80); } catch { return null; }
  } catch { return null; }
}

function _serializeModel(obj) {
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
    // Use a timeout-guarded serialize — deep models can be huge
    json = obj.toJSON();
  } catch (e) {
    console.warn('[config] toJSON falhou, serialização parcial:', e.message);
    // Fallback: clone without skeleton/skinning to avoid stack overflow
    try {
      const fallback = new THREE.Group();
      fallback.name = obj.name;
      obj.traverse(child => {
        if (child.isMesh && !child.isSkinnedMesh) {
          try {
            const clone = child.clone();
            clone.skeleton = undefined;
            fallback.add(clone);
          } catch {}
        }
      });
      json = fallback.toJSON();
    } catch (e2) {
      console.error('[config] Serialização parcial falhou:', e2.message);
      return null;
    }
  }

  // Guard: if JSON is too large (> 50 MB stringified), skip model data to avoid crash
  try {
    const rough = JSON.stringify(json);
    if (rough.length > 52_428_800) { // 50 MB
      console.warn('[config] Modelo muito grande para serializar no .nex, omitindo geometry data. Nome:', obj.name);
      // Save only the skeleton bone transforms for animation
      const bonesSnapshot = [];
      obj.traverse(child => {
        if (child.isBone) {
          bonesSnapshot.push({
            uuid: child.uuid, name: child.name,
            position: child.position.toArray(),
            rotation: [child.rotation.x, child.rotation.y, child.rotation.z, child.rotation.order],
            scale: child.scale.toArray(),
          });
        }
      });
      return { _oversized: true, name: obj.name, bonesSnapshot };
    }
  } catch {}

  // Embed blob/external textures as data URLs
  if (json.images && json.textures) {
    const imgUUIDtoTex = new Map();
    json.textures.forEach(td => {
      const tex = texByUUID.get(td.uuid);
      if (tex && td.image) imgUUIDtoTex.set(td.image, tex);
    });
    json.images.forEach(imgData => {
      const isBlobOrExternal = !imgData.url || imgData.url.startsWith('blob:') || imgData.url.startsWith('http');
      if (isBlobOrExternal) {
        const tex = imgUUIDtoTex.get(imgData.uuid);
        if (tex) {
          const dataURL = _textureToDataURL(tex);
          if (dataURL) imgData.url = dataURL;
          else delete imgData.url;
        }
      }
    });
  }
  return json;
}

function _firstMesh(obj) {
  if (obj?.isMesh) return obj;
  for (const c of (obj?.children || [])) { const m = _firstMesh(c); if (m) return m; }
  return null;
}

function _isUserObject(obj) {
  if (obj === app.gridRoot)          return false;
  if (obj === app.axesHelper)        return false;
  if (obj === app.floor)             return false;
  if (obj === app.transformControls) return false;
  if (obj.isLight && !obj.userData?.isLightObject) return false;
  if (obj.userData?.isBoneMarker)     return false;
  if (obj.userData?.isSceneCamera)    return false; // saved separately via serializeCameras()
  if (obj.userData?.isLabMarker)      return false; // particle emitters — not part of this save format
  if (obj.isMesh && !obj.name)       return false;
  if (obj.isGroup && !obj.userData?.isLightObject && !obj.name) return false;
  return !!(obj.name?.trim()) || !!obj.userData?.isLightObject;
}

function _serialize() {
  const scene = app.scene;
  const serializedObjects = [];

  scene.children.filter(_isUserObject).forEach(obj => {
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

      const mesh = _firstMesh(obj);
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

      if (obj.userData?.isLightObject && obj.userData?.lightRef) {
        const l = obj.userData.lightRef;
        entry.light = {
          lightType:  l.type,
          color:      l.color.getHex(),
          intensity:  l.intensity,
          distance:   l.distance ?? 0,
          castShadow: l.castShadow,
        };
      }

      if (obj.userData?.isImportedModel) {
        try {
          const modelData = _serializeModel(obj);
          if (modelData) entry.modelData = modelData;
          else console.warn('[config] ⚠️ Serialização retornou null:', obj.name);
        } catch (err) {
          console.warn('[config] ⚠️ Não foi possível serializar', obj.name, err);
        }
      }

      serializedObjects.push(entry);
    } catch (e) {
      console.warn('[config] Erro ao serializar:', obj.name, e);
    }
  });

  let skybox = null;
  if (scene.background instanceof THREE.Color)
    skybox = { type: 'color', value: '#' + scene.background.getHexString() };

  // ── Collect bone UUIDs → name map for re-linking after load ─────────────
  const boneRegistry = {};
  scene.traverse(o => {
    if (o.isBone) boneRegistry[o.uuid] = { name: o.name, parentName: o.parent?.name ?? null };
  });

  // ── Animation keyframes from AnimationSystem ─────────────────────────────
  const animKeyframes = window.AnimationSystem?.getState?.()?.keyframes ?? {};
  const animFps       = window.AnimationSystem?.getState?.()?.fps ?? 24;
  const animInterp    = window.AnimationSystem?.getState?.()?.interpMode ?? 'smooth';

  // ── Scene cameras (position, rotation, FOV, near/far) ────────────────────
  let cameras = [];
  try { cameras = serializeCameras(); }
  catch (e) { console.warn('[config] Erro ao serializar câmeras:', e); }

  return {
    version:    '2.0',
    format:     'nex',
    timestamp:  new Date().toISOString(),
    skybox,
    objects:    serializedObjects,
    boneRegistry,
    cameras,
    animation: {
      fps:       animFps,
      interp:    animInterp,
      keyframes: animKeyframes,
    },
  };
}

// ════════════════════════════════════════════════════════════
//  EXPORTAR .nex (igual ao SaveSystem.export())
// ════════════════════════════════════════════════════════════
function _triggerDownload(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/x-nexus-project' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 10000);
}

async function _exportNex() {
  _toast('⏳ Preparando exportação .nex…');
  setTimeout(async () => {
    try {
      const payload  = _serialize();
      _toast('⏳ Codificando…');
      await new Promise(r => setTimeout(r, 50));
      const nexBytes = await _encodeNex(payload);
      _triggerDownload(nexBytes, 'project.nex');
      _toast(`📦 Exportado! (${(nexBytes.length / 1024).toFixed(0)} KB) — project.nex`);
    } catch (err) {
      console.error('[config] Erro ao exportar .nex:', err);
      _toast('❌ Erro ao exportar: ' + (err.message || err), 'error');
    }
  }, 100);
}

// ════════════════════════════════════════════════════════════
//  IMPORTAR .nex (igual ao SaveSystem.importFromFile())
// ════════════════════════════════════════════════════════════
async function _importNex(file) {
  if (!file.name.toLowerCase().endsWith('.nex')) {
    _toast('❌ Formato não suportado. Use arquivos .nex', 'error'); return;
  }
  try {
    _toast('⏳ Carregando projeto .nex…');
    const buffer = await file.arrayBuffer();
    let data;
    try { data = await _decodeNex(buffer); }
    catch (e) { _toast('❌ ' + (e.message || 'Arquivo .nex inválido'), 'error'); return; }

    if (!data?.objects || !Array.isArray(data.objects)) {
      _toast('❌ Estrutura do arquivo .nex inválida', 'error'); return;
    }

    await _applyProjectData(data);
    const count = data.objects.length;
    _toast(`✅ Projeto importado! (${count} objeto(s))`);
  } catch (err) {
    console.error('[config] Erro ao importar .nex:', err);
    _toast('❌ Erro ao importar: ' + (err.message || err), 'error');
  }
}

async function _applyProjectData(data) {
  const scene = app.scene;

  // 1. Limpar cena — remove todos os objetos do utilizador
  const toRemove = scene.children.filter(_isUserObject);
  toRemove.forEach(o => { scene.remove(o); });
  app.objects.length = 0;
  if (app.transformControls) app.transformControls.detach();
  app.selected = null;
  window.dispatchEvent(new CustomEvent('scene-selection-changed', { detail: { object: null } }));

  // 2. Restaurar skybox
  if (data.skybox?.type === 'color') {
    scene.background  = new THREE.Color(data.skybox.value);
    scene.environment = null;
    const bgPicker = document.getElementById('cfgBgColor');
    if (bgPicker) bgPicker.value = data.skybox.value;
  }

  // 3. Restaurar cada objecto em sequência
  for (const entry of data.objects) {
    try { await _restoreObject(entry, scene); }
    catch (e) { console.warn('[config] Erro ao restaurar:', entry.name, e); }
  }

  // 3b. Restaurar câmeras da cena (posição, rotação, FOV, near/far)
  try { restoreCameras(data.cameras || []); }
  catch (e) { console.warn('[config] Erro ao restaurar câmeras:', e); }

  markSceneDirty();
  // Força o painel de objectos a actualizar
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('scene-selection-changed', { detail: { object: null } }));
  }, 100);

  // ── Restaurar animação ───────────────────────────────────────────────────
  // Bone UUIDs change when a model is reloaded (THREE re-generates them).
  // We match bones by name using the boneRegistry saved alongside the keyframes.
  setTimeout(() => {
    const animData = data.animation;
    if (!animData?.keyframes || !window.AnimationSystem) return;

    const AS = window.AnimationSystem.getState();

    // Build a name→current-uuid map for all bones in the newly restored scene
    const boneNameToUUID = {};
    scene.traverse(o => { if (o.isBone && o.name) boneNameToUUID[o.name] = o.uuid; });

    // Remap saved keyframe UUIDs
    const remappedKFs = {};
    const boneReg = data.boneRegistry || {};
    Object.entries(animData.keyframes).forEach(([savedUUID, frames]) => {
      // Check if this UUID directly exists (regular objects keep their UUIDs)
      const directObj = scene.getObjectByProperty('uuid', savedUUID);
      if (directObj) {
        remappedKFs[savedUUID] = frames;
        return;
      }
      // Try to remap via bone name from registry
      const boneName = boneReg[savedUUID]?.name;
      if (boneName && boneNameToUUID[boneName]) {
        remappedKFs[boneNameToUUID[boneName]] = frames;
      } else {
        // Keep as-is (might resolve later if object loads async)
        remappedKFs[savedUUID] = frames;
      }
    });

    // Apply to AnimState
    AS.keyframes = remappedKFs;
    if (animData.fps)    AS.fps = animData.fps;
    if (animData.interp) AS.interpMode = animData.interp;

    // Refresh timeline UI if open
    if (window.AnimationSystem.isVisible?.()) {
      window.AnimationSystem.seekFrame(0);
    }
    _toast(`🎬 Animação restaurada (${Object.keys(remappedKFs).length} trilha(s))`);
  }, 400); // after models finish loading
}

async function _restoreObject(entry, scene) {
  // ── Luz ────────────────────────────────────────────────────────
  if (entry.userData?.isLightObject && entry.light) {
    const typeMap = {
      DirectionalLight: 'sun',
      PointLight:       'point',
      SpotLight:        'spot',
      RectAreaLight:    'area',
    };
    const lightKind = typeMap[entry.light.lightType] || 'point';
    const group = addLight(lightKind);
    if (!group) return;
    group.name = entry.name;
    group.position.fromArray(entry.position);
    _setRotation(group, entry.rotation);
    group.scale.fromArray(entry.scale);
    group.visible = entry.visible ?? true;
    const light = group.userData.lightRef;
    if (light) {
      light.color.setHex(entry.light.color ?? 0xffffff);
      light.intensity  = entry.light.intensity  ?? light.intensity;
      light.castShadow = entry.light.castShadow ?? false;
      if ('distance' in light && entry.light.distance !== undefined)
        light.distance = entry.light.distance;
    }
    return;
  }

  // ── Modelo importado (GLTF/GLB serializado com ObjectLoader) ───
  if (entry.userData?.isImportedModel && entry.modelData) {
    try {
      const loader    = new THREE.ObjectLoader();
      const restored  = loader.parse(entry.modelData);
      restored.name   = entry.name;
      restored.position.fromArray(entry.position);
      _setRotation(restored, entry.rotation);
      restored.scale.fromArray(entry.scale);
      restored.visible = entry.visible ?? true;
      // Preserva userData original mas garante flag isImportedModel
      const ud = { ...entry.userData };
      delete ud.__hl; // remove highlight state temporário
      Object.assign(restored.userData, ud);
      scene.add(restored);
      app.objects.push(restored);
    } catch (e) {
      console.warn('[config] Falha ao restaurar modelo via ObjectLoader:', e.message);
    }
    return;
  }

  // ── Primitiva conhecida (box, sphere, cylinder, cone, torus…) ──
  const PRIMITIVES = ['box','sphere','cylinder','cone','torus','plane','capsule'];
  const primName   = entry.userData?.primitiveType
    || (PRIMITIVES.includes(entry.name) ? entry.name : null);

  if (primName) {
    const mesh = addPrimitive(primName);
    if (!mesh) return;
    mesh.name = entry.name;
    mesh.position.fromArray(entry.position);
    _setRotation(mesh, entry.rotation);
    mesh.scale.fromArray(entry.scale);
    mesh.visible = entry.visible ?? true;
    const ud = { ...entry.userData }; delete ud.__hl;
    Object.assign(mesh.userData, ud);
    _applyMaterial(mesh, entry.material);
    return;
  }

  // ── Mesh genérico ──────────────────────────────────────────────
  if (entry.type === 'Mesh' || entry.type === 'SkinnedMesh') {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshPhysicalMaterial()
    );
    mesh.name = entry.name;
    mesh.position.fromArray(entry.position);
    _setRotation(mesh, entry.rotation);
    mesh.scale.fromArray(entry.scale);
    mesh.visible = entry.visible ?? true;
    const ud = { ...entry.userData }; delete ud.__hl;
    Object.assign(mesh.userData, ud);
    _applyMaterial(mesh, entry.material);
    scene.add(mesh);
    app.objects.push(mesh);
    return;
  }

  // ── Group genérico ─────────────────────────────────────────────
  if (entry.type === 'Group') {
    const grp = new THREE.Group();
    grp.name = entry.name;
    grp.position.fromArray(entry.position);
    _setRotation(grp, entry.rotation);
    grp.scale.fromArray(entry.scale);
    grp.visible = entry.visible ?? true;
    const ud = { ...entry.userData }; delete ud.__hl;
    Object.assign(grp.userData, ud);
    scene.add(grp);
    app.objects.push(grp);
  }
}

function _setRotation(obj, rot) {
  if (!rot) return;
  obj.rotation.set(rot[0] ?? 0, rot[1] ?? 0, rot[2] ?? 0, rot[3] || 'XYZ');
}

function _applyMaterial(mesh, matData) {
  if (!matData || !mesh.material) return;
  const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (matData.color             !== undefined) m.color?.setHex(matData.color);
  if (matData.emissive          !== undefined) m.emissive?.setHex(matData.emissive);
  if (matData.emissiveIntensity !== undefined) m.emissiveIntensity = matData.emissiveIntensity;
  if (matData.roughness         !== undefined) m.roughness   = matData.roughness;
  if (matData.metalness         !== undefined) m.metalness   = matData.metalness;
  if (matData.opacity           !== undefined) m.opacity     = matData.opacity;
  if (matData.transparent       !== undefined) m.transparent = matData.transparent;
  if (matData.wireframe         !== undefined) m.wireframe   = matData.wireframe;
  if (matData.side              !== undefined) m.side        = matData.side;
  m.needsUpdate = true;
}

// ════════════════════════════════════════════════════════════
//  SKYBOX MANAGER (idêntico ao SkyboxManager do savesystem.js)
// ════════════════════════════════════════════════════════════
class SkyboxManager {
  constructor(scene, renderer) {
    this.scene    = scene;
    this.renderer = renderer;
    this._pmrem   = new THREE.PMREMGenerator(renderer);
    this._pmrem.compileEquirectangularShader();
    this._current = null;
  }
  setSolidColor(hex) {
    this._clear();
    this.scene.background  = new THREE.Color(hex);
    this.scene.environment = null;
    markSceneDirty();
  }
  setGradient(topColor = '#0a0a2a', bottomColor = '#1a3a5c') {
    this._clear();
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const g   = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, topColor); g.addColorStop(1, bottomColor);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1, 512);
    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    this.scene.background = tex;
    this._current = tex;
    markSceneDirty();
  }
  async setFromFile(file) {
    const url  = URL.createObjectURL(file);
    const name = file.name.toLowerCase();
    try {
      let tex;
      if (name.endsWith('.hdr') || name.endsWith('.exr')) {
        const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
        tex = await new Promise((res, rej) => new RGBELoader().load(url, res, undefined, rej));
      } else {
        tex = await new Promise((res, rej) => new THREE.TextureLoader().load(url, res, undefined, rej));
      }
      this._applyEquirect(tex);
    } finally { URL.revokeObjectURL(url); }
  }
  _applyEquirect(tex) {
    this._clear();
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const env   = this._pmrem.fromEquirectangular(tex).texture;
    this.scene.background  = tex;
    this.scene.environment = env;
    this._current = tex;
    markSceneDirty();
  }
  remove() {
    this._clear();
    this.scene.background  = new THREE.Color(0x0b0f14);
    this.scene.environment = null;
    markSceneDirty();
  }
  _clear() {
    if (this._current) { this._current.dispose(); this._current = null; }
  }
}

// ════════════════════════════════════════════════════════════
//  PAINEL DE CONFIGURAÇÕES — toggle 1/4→ / 2/4→ / 3/4→
// ════════════════════════════════════════════════════════════
export async function initConfig(_app) {
  const scene    = app.scene;
  const renderer = app.renderer;
  const skybox   = new SkyboxManager(scene, renderer);

  const objectsSection  = document.getElementById('objectsSection');
  const configSection   = document.getElementById('configSection');
  const infoSection     = document.getElementById('infoSection');
  const rightPanelTitle = document.querySelector('.rightPanelTitle');
  const labsSection     = document.getElementById('labsSection');

  // Config section stays permanently hidden as a right-panel entry — it's
  // now edited through the Settings menu (gear icon) instead.
  if (configSection) configSection.classList.add('hidden');

  let _labsActive = false;
  let _infoOpen   = false;

  function setLabsActive(on) {
    _labsActive = !!on;
    _infoOpen   = false;
    if (infoSection) infoSection.classList.add('hidden');
    objectsSection.classList.toggle('hidden', _labsActive);
    labsSection.classList.toggle('hidden', !_labsActive);
    if (rightPanelTitle) rightPanelTitle.textContent = _labsActive ? 'Particle Labs' : 'Objetos';
    window.dispatchEvent(new CustomEvent('_labsPanelChange', { detail: { active: _labsActive } }));
    window.dispatchEvent(new CustomEvent('_labsModeChange',  { detail: { active: _labsActive } }));
  }

  // Exposed globally — the Settings menu's "Particle Labs" toggle calls this.
  window._setLabsActive     = setLabsActive;
  window._toggleLabsActive  = () => setLabsActive(!_labsActive);
  window._isLabsActive      = () => _labsActive;
  window._openInfoSection = function() {
    _infoOpen = true;
    objectsSection.classList.add('hidden');
    labsSection.classList.add('hidden');
    if (infoSection) infoSection.classList.remove('hidden');
    if (rightPanelTitle) rightPanelTitle.textContent = 'Informações';
  };

  // Back button inside info section
  document.getElementById('infoBtnBack')?.addEventListener('click', () => setLabsActive(_labsActive));

  setLabsActive(false);

  // Cor de fundo
  const bgColorInput = document.getElementById('cfgBgColor');
  if (bgColorInput) {
    if (scene.background instanceof THREE.Color)
      bgColorInput.value = '#' + scene.background.getHexString();
    bgColorInput.addEventListener('input', (e) => {
      scene.background  = new THREE.Color(e.target.value);
      scene.environment = null;
      markSceneDirty();
    });
  }

  // Grid / Axes Helper — wired directly to app.gridRoot / app.axesHelper,
  // the same live references setHelperVisibility()/setRenderPreviewMode()
  // already use internally, so this reuses a path that's proven to work.
  const gridToggle = document.getElementById('cfgGridVisible');
  if (gridToggle) {
    gridToggle.checked = app.gridRoot?.visible ?? true;
    gridToggle.addEventListener('change', (e) => {
      if (app.gridRoot) app.gridRoot.visible = e.target.checked;
      markSceneDirty();
    });
  }
  const axesToggle = document.getElementById('cfgAxesVisible');
  if (axesToggle) {
    axesToggle.checked = app.axesHelper?.visible ?? true;
    axesToggle.addEventListener('change', (e) => {
      if (app.axesHelper) app.axesHelper.visible = e.target.checked;
      markSceneDirty();
    });
  }

  // Skybox
  const skyFileInput = document.getElementById('cfgSkyFile');
  const skyUploadBtn = document.getElementById('cfgSkyUpload');
  if (skyUploadBtn && skyFileInput) {
    skyUploadBtn.addEventListener('click', () => skyFileInput.click());
    skyFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      skyUploadBtn.textContent = '⏳ Carregando…';
      skyUploadBtn.disabled    = true;
      try {
        await skybox.setFromFile(file);
        _toast('🌅 Skybox carregado!');
      } catch (err) {
        _toast('❌ Erro ao carregar skybox: ' + (err.message || err), 'error');
      } finally {
        skyUploadBtn.disabled    = false;
        skyUploadBtn.textContent = 'Carregar HDR / Imagem';
        skyFileInput.value       = '';
      }
    });
  }

  const skyGradBtn = document.getElementById('cfgSkyGradient');
  if (skyGradBtn) skyGradBtn.addEventListener('click', () => {
    skybox.setGradient('#0a0a2a', '#1a3a6c');
    _toast('🌌 Gradiente aplicado!');
  });

  const skyRemoveBtn = document.getElementById('cfgSkyRemove');
  if (skyRemoveBtn) skyRemoveBtn.addEventListener('click', () => {
    skybox.remove();
    if (bgColorInput) bgColorInput.value = '#0b0f14';
    _toast('Skybox removido.');
  });

  // Exportar .nex
  const exportBtn = document.getElementById('cfgExportNex');
  if (exportBtn) exportBtn.addEventListener('click', () => _exportNex());

  // Importar .nex
  const importBtn       = document.getElementById('cfgImportNex');
  const importFileInput = document.getElementById('cfgImportFile');
  if (importBtn && importFileInput) {
    importFileInput.accept = '.nex';
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      await _importNex(file);
      importFileInput.value = '';
    });
  }

  // ── Bottom Bar toggles ──────────────────────────────────────────────────────
  function _syncBbVisibility() {
    const bbLeft   = document.getElementById('bbLeft');
    const bbCenter = document.getElementById('bbCenter');
    const bbRight  = document.getElementById('bbRight');
    const coords   = document.getElementById('cfgBbCoords')?.checked ?? false;
    const stats    = document.getElementById('cfgBbStats')?.checked  ?? false;
    const fps      = document.getElementById('cfgBbFps')?.checked    ?? false;
    if (bbLeft)   bbLeft.classList.toggle('bb-hidden', !coords);
    if (bbCenter) bbCenter.classList.toggle('bb-hidden', !stats);
    if (bbRight)  bbRight.classList.toggle('bb-hidden', !fps);
  }

  ['cfgBbCoords', 'cfgBbStats', 'cfgBbFps'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', _syncBbVisibility);
  });
  _syncBbVisibility(); // apply on load (all off by default)
}
