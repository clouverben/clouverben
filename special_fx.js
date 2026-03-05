// ==================== SPECIAL_FX.JS ====================
// Efeitos Especiais: Trail (fogo), Deformação, Glitch, Aura
// Usa window.scene, window.activeObject

import * as THREE from 'three';

// ── Textura helper ────────────────────────────────────────────────────────────
function makeSpriteTex(drawFn, w = 64, h = 64) {
    const cv  = document.createElement('canvas');
    cv.width  = w; cv.height = h;
    drawFn(cv.getContext('2d'), w, h);
    return new THREE.CanvasTexture(cv);
}

const TX_FIRE = makeSpriteTex((ctx, W, H) => {
    const g = ctx.createRadialGradient(W/2,H/2,0, W/2,H/2,W/2);
    g.addColorStop(0.00, 'rgba(255,255,255,1)');
    g.addColorStop(0.30, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.65, 'rgba(180,180,180,0.4)');
    g.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
});

const TX_GLOW = makeSpriteTex((ctx, W, H) => {
    const g = ctx.createRadialGradient(W/2,H/2,0, W/2,H/2,W/2);
    g.addColorStop(0.00, 'rgba(255,255,255,1)');
    g.addColorStop(0.50, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.85, 'rgba(255,255,255,0.1)');
    g.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
});

const TX_SCANLINE = makeSpriteTex((ctx, W, H) => {
    ctx.fillStyle = 'rgba(0,255,220,0.18)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    const g = ctx.createRadialGradient(W/2,H/2,0, W/2,H/2,W/2);
    g.addColorStop(0.00, 'rgba(0,255,220,0.65)');
    g.addColorStop(0.55, 'rgba(0,255,220,0.3)');
    g.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
}, 128, 128);

// ================================================================================
//  TRAIL EFFECT (fire-trail particles, stay in world space)
// ================================================================================
class TrailEffect {
    constructor(target) {
        this.target   = target;
        this.color    = new THREE.Color('#ff6600');
        this.enabled  = true;
        this.time     = 0;

        this.COUNT    = 80;
        this.sprites  = [];
        this.data     = [];
        this._lastPos = new THREE.Vector3();
        this._curPos  = new THREE.Vector3();

        const scene = window._nexusScene || window.scene;
        for (let i = 0; i < this.COUNT; i++) {
            const mat = new THREE.SpriteMaterial({
                map: TX_FIRE,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                color: this.color.clone(),
            });
            const sp = new THREE.Sprite(mat);
            sp.layers.enable(1);
            sp.userData.isFXSprite = true;
            scene.add(sp);
            this.sprites.push(sp);
            this.data.push({ active: false, life: 0, maxLife: 0.7, worldPos: new THREE.Vector3(), vel: new THREE.Vector3(), scale: 1 });
        }

        target.getWorldPosition(this._lastPos);
    }

    setColor(hex) {
        this.color.set(hex);
        this.sprites.forEach(sp => sp.material.color.set(hex));
    }

    _spawn(wPos, objRadius = 0.3) {
        for (let i = 0; i < this.data.length; i++) {
            const d = this.data[i];
            if (d.active && d.life < 1) continue;
            const sp = this.sprites[i];
            // Escala offset e velocidade proporcionais ao raio do objeto
            const s = objRadius / 0.3; // fator de escala normalizado pelo raio padrão
            d.active = true; d.life = 0;
            d.worldPos.copy(wPos).addScaledVector(
                new THREE.Vector3((Math.random()-.5),(Math.random()-.5),(Math.random()-.5)), 0.15 * s
            );
            d.vel.set(
                (Math.random()-.5) * 0.3 * s,
                (0.4 + Math.random() * 0.5) * s,
                (Math.random()-.5) * 0.3 * s
            );
            d.maxLife = 0.4 + Math.random()*.4;
            d.scale   = (0.3 + Math.random()*.4) * s; // tamanho escala com o objeto
            sp.material.opacity = 0;
            return;
        }
    }

    update(dt) {
        if (!this.enabled) { this.sprites.forEach(sp => { sp.material.opacity = 0; }); return; }
        this.time += dt;
        this.target.getWorldPosition(this._curPos);

        // Calcula o raio do objeto para escalar as partículas proporcionalmente
        let objRadius = 0.3;
        try {
            const box = new THREE.Box3().setFromObject(this.target);
            const sz  = new THREE.Vector3(); box.getSize(sz);
            objRadius = Math.max(sz.x, sz.y, sz.z) * 0.5;
            if (objRadius < 0.01) objRadius = 0.3;
        } catch {}

        const speed = this._curPos.distanceTo(this._lastPos) / dt;
        const emit  = Math.min(5, Math.ceil(speed * 2));
        for (let e = 0; e < emit; e++) this._spawn(this._curPos, objRadius);

        for (let i = 0; i < this.data.length; i++) {
            const d = this.data[i], sp = this.sprites[i];
            if (!d.active) { sp.material.opacity = 0; continue; }
            d.life += dt / d.maxLife;
            if (d.life >= 1) { d.active = false; sp.material.opacity = 0; continue; }

            d.worldPos.addScaledVector(d.vel, dt);
            sp.position.copy(d.worldPos);

            const env = Math.sin(d.life * Math.PI);
            const sc  = d.scale * (.6 + env*.6);
            sp.scale.set(sc, sc*1.2, 1);
            sp.material.opacity = env * .55;

            const fade = Math.max(0, 1 - d.life*.85);
            sp.material.color.setRGB(
                this.color.r * fade,
                this.color.g * fade,
                this.color.b * fade
            );
        }

        this._lastPos.copy(this._curPos);
    }

    dispose() {
        const scene = window._nexusScene || window.scene;
        this.sprites.forEach(sp => { scene.remove(sp); sp.material.dispose(); });
    }
}

// ================================================================================
//  DEFORMATION EFFECT (Lock in Deformation)
// ================================================================================
class DeformationEffect {
    constructor(target) {
        this.target  = target;
        this.enabled = true;
        this.time    = 0;
        this.amp     = 0.32;   // amplitude da deformação (fração do tamanho do vértice)
        this.freq    = 3.5;    // frequência base das ondas

        // Coleta todos os meshes com BufferGeometry do objeto
        this._meshes = [];
        target.traverse(obj => {
            if (obj.isMesh && obj.geometry?.isBufferGeometry) {
                const geo  = obj.geometry;
                const pos  = geo.attributes.position;
                if (!pos) return;

                // Guarda posições originais para restaurar depois
                const orig = new Float32Array(pos.array.length);
                orig.set(pos.array);

                // Gera offsets aleatórios por vértice para variação orgânica
                const vCount = pos.count;
                const phaseX = new Float32Array(vCount);
                const phaseY = new Float32Array(vCount);
                const phaseZ = new Float32Array(vCount);
                const freqV  = new Float32Array(vCount); // frequência individual
                for (let i = 0; i < vCount; i++) {
                    phaseX[i] = Math.random() * Math.PI * 2;
                    phaseY[i] = Math.random() * Math.PI * 2;
                    phaseZ[i] = Math.random() * Math.PI * 2;
                    freqV[i]  = 0.6 + Math.random() * 0.8;
                }

                this._meshes.push({ obj, pos, orig, phaseX, phaseY, phaseZ, freqV, vCount });
            }
        });
    }

    setColor(_hex) {}

    update(dt) {
        this.time += dt;
        const t   = this.time;
        const amp = this.enabled ? this.amp : 0;

        for (const m of this._meshes) {
            const { pos, orig, phaseX, phaseY, phaseZ, freqV, vCount } = m;
            const arr = pos.array;

            // Calcula o raio médio do objeto para escalar a amplitude
            let maxDist = 0;
            for (let i = 0; i < vCount; i++) {
                const x = orig[i*3], y = orig[i*3+1], z = orig[i*3+2];
                const d = Math.sqrt(x*x + y*y + z*z);
                if (d > maxDist) maxDist = d;
            }
            if (maxDist < 0.001) maxDist = 1;

            for (let i = 0; i < vCount; i++) {
                const ox = orig[i*3], oy = orig[i*3+1], oz = orig[i*3+2];

                // Distância do centro — vértices mais afastados deformam mais
                const dist  = Math.sqrt(ox*ox + oy*oy + oz*oz);
                const distN = dist / maxDist; // 0..1

                // Ondas independentes por eixo, com fase única por vértice
                const fv  = freqV[i] * this.freq;
                const dx  = Math.sin(t * fv        + phaseX[i] + oy * 2.1) * amp * distN * maxDist;
                const dy  = Math.sin(t * fv * 1.3  + phaseY[i] + oz * 2.3) * amp * distN * maxDist;
                const dz  = Math.sin(t * fv * 0.9  + phaseZ[i] + ox * 1.8) * amp * distN * maxDist;

                arr[i*3]   = ox + dx;
                arr[i*3+1] = oy + dy;
                arr[i*3+2] = oz + dz;
            }

            pos.needsUpdate = true;
            if (m.obj.geometry.computeVertexNormals) m.obj.geometry.computeVertexNormals();
        }
    }

    dispose() {
        // Restaura todas as posições originais dos vértices
        for (const m of this._meshes) {
            m.pos.array.set(m.orig);
            m.pos.needsUpdate = true;
            if (m.obj.geometry.computeVertexNormals) m.obj.geometry.computeVertexNormals();
        }
    }
}

// ================================================================================
//  GLITCH EFFECT
// ================================================================================
class GlitchEffect {
    constructor(target) {
        this.target  = target;
        this.enabled = true;
        this.color   = new THREE.Color('#00ffdd');
        this.time    = 0;
        this._basePos = target.position.clone();
        this._glitchTimer = 0;
        this._glitching   = false;
        this._glitchDur   = 0;

        const scene = window._nexusScene || window.scene;
        this.sprites = [];
        for (let i = 0; i < 6; i++) {
            const mat = new THREE.SpriteMaterial({
                map: TX_SCANLINE,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                color: this.color.clone(),
                opacity: 0,
            });
            const sp = new THREE.Sprite(mat);
            sp.layers.enable(1);
            sp.userData.isFXSprite = true;
            scene.add(sp);
            this.sprites.push(sp);
        }
    }

    setColor(hex) {
        this.color.set(hex);
        this.sprites.forEach(sp => sp.material.color.set(hex));
    }

    update(dt) {
        if (!this.enabled) {
            this.sprites.forEach(sp => { sp.material.opacity = 0; });
            return;
        }
        this.time += dt;
        this._glitchTimer -= dt;

        if (this._glitchTimer <= 0) {
            this._glitching   = Math.random() > 0.45;
            this._glitchDur   = 0.06 + Math.random()*.12;
            this._glitchTimer = 0.08 + Math.random()*.35;
        }

        // Pegar bounding box aproximada
        let radius = 1;
        try {
            const box = new THREE.Box3().setFromObject(this.target);
            const sz  = new THREE.Vector3();
            box.getSize(sz);
            radius = Math.max(sz.x, sz.y, sz.z) * .55;
        } catch {}

        const wPos = new THREE.Vector3();
        this.target.getWorldPosition(wPos);

        this.sprites.forEach((sp, i) => {
            if (!this._glitching) { sp.material.opacity = 0; return; }
            const angle  = (i / this.sprites.length) * Math.PI * 2 + this.time * 4.5;
            const r      = radius * (0.85 + Math.random()*.35);
            sp.position.set(
                wPos.x + Math.cos(angle) * r,
                wPos.y + (Math.random()-.5) * radius*.8,
                wPos.z + Math.sin(angle) * r
            );
            const sc = radius * (.6 + Math.random()*.5);
            sp.scale.set(sc * (0.5 + Math.random()*.8), sc * (.8 + Math.random()*.4), 1);
            sp.material.opacity = Math.random() * .55;
            sp.material.rotation = Math.random() * Math.PI * 2;
        });
    }

    dispose() {
        const scene = window._nexusScene || window.scene;
        this.sprites.forEach(sp => { scene.remove(sp); sp.material.dispose(); });
    }
}

// ================================================================================
//  MANAGER — gerencia efeitos por objeto UUID
// ================================================================================
const effectMap = new Map(); // uuid → { trail, deform, glitch, aura }

function getOrCreate(uuid) {
    if (!effectMap.has(uuid)) effectMap.set(uuid, { trail: null, deform: null, glitch: null, aura: null });
    return effectMap.get(uuid);
}

function toggleEffect(type, target) {
    const uuid  = target.uuid;
    const entry = getOrCreate(uuid);

    if (entry[type]) {
        entry[type].dispose();
        entry[type] = null;
        return false; // desligado
    } else {
        switch (type) {
            case 'trail':  entry[type] = new TrailEffect(target);      break;
            case 'deform': entry[type] = new DeformationEffect(target); break;
            case 'glitch': entry[type] = new GlitchEffect(target);      break;
            case 'aura':   entry[type] = new AuraEffect(target);         break;
        }
        return true; // ligado
    }
}

function hasEffect(type, uuid) {
    return !!(effectMap.get(uuid)?.[type]);
}

function setEffectColor(hex, uuid) {
    const entry = effectMap.get(uuid);
    if (!entry) return;
    if (entry.trail)  entry.trail.setColor(hex);
    if (entry.glitch) entry.glitch.setColor(hex);
    if (entry.aura)   entry.aura.setColor(hex);
}

function removeAllEffects(uuid) {
    const entry = effectMap.get(uuid);
    if (!entry) return;
    Object.values(entry).forEach(e => { if (e) e.dispose(); });
    effectMap.delete(uuid);
}

function updateAll(dt) {
    effectMap.forEach(entry => {
        if (entry.trail)  entry.trail.update(dt);
        if (entry.deform) entry.deform.update(dt);
        if (entry.glitch) entry.glitch.update(dt);
        if (entry.aura)   entry.aura.update(dt);
    });
}
// ================================================================================
//  SUBSTITUA APENAS O BLOCO DA AuraEffect no special_fx.js
// ================================================================================

const TX_FLAME = makeSpriteTex((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.moveTo(W * 0.5, 0);
    ctx.bezierCurveTo(W*0.80, H*0.30, W*0.92, H*0.65, W*0.76, H);
    ctx.lineTo(W * 0.24, H);
    ctx.bezierCurveTo(W*0.08, H*0.65, W*0.20, H*0.30, W*0.5, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, H, 0, 0);
    g.addColorStop(0.00, 'rgba(255,255,255,1.00)');
    g.addColorStop(0.15, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.12)');
    g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = g; ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const gc = ctx.createLinearGradient(W*0.5, H*0.7, W*0.5, 0);
    gc.addColorStop(0, 'rgba(255,255,255,0.55)');
    gc.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = gc; ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
}, 56, 192);

const TX_SPARK_FLAME = makeSpriteTex((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.moveTo(W * 0.5, 0);
    ctx.bezierCurveTo(W*0.63, H*0.32, W*0.66, H*0.68, W*0.59, H);
    ctx.lineTo(W * 0.41, H);
    ctx.bezierCurveTo(W*0.34, H*0.68, W*0.37, H*0.32, W*0.5, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, H, 0, 0);
    g.addColorStop(0.00, 'rgba(255,255,255,1.00)');
    g.addColorStop(0.30, 'rgba(255,255,255,0.80)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.20)');
    g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = g; ctx.fill();
}, 28, 160);

const TX_RING_AURA = makeSpriteTex((ctx, W, H) => {
    ctx.beginPath(); ctx.arc(W/2, H/2, W/2-3, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.arc(W/2, H/2, W/2-11, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
}, 128, 128);

// ================================================================================
//  LIGHTNING 3D
// ================================================================================
class Lightning3D {
    constructor(scene, color = 0x4499ff) {
        this._scene = scene;
        this.visible = true;
        this._mat = new THREE.LineBasicMaterial({
            color, blending: THREE.AdditiveBlending,
            depthWrite: false, transparent: true, opacity: 1.0,
        });
        this._matGlow = new THREE.LineBasicMaterial({
            color, blending: THREE.AdditiveBlending,
            depthWrite: false, transparent: true, opacity: 0.25,
        });
        this.SEGS = 8;
        const pts = new Float32Array((this.SEGS + 1) * 3);
        this._geo     = new THREE.BufferGeometry();
        this._geoGlow = new THREE.BufferGeometry();
        this._geo.setAttribute('position',     new THREE.BufferAttribute(pts.slice(), 3));
        this._geoGlow.setAttribute('position', new THREE.BufferAttribute(pts.slice(), 3));
        this._line     = new THREE.Line(this._geo,     this._mat);
        this._lineGlow = new THREE.Line(this._geoGlow, this._matGlow);
        this._line.userData.isFXSprite     = true;
        this._lineGlow.userData.isFXSprite = true;
        this._line.layers.enable(1);
        this._lineGlow.layers.enable(1);
        this._line.frustumCulled     = false;
        this._lineGlow.frustumCulled = false;
        scene.add(this._line);
        scene.add(this._lineGlow);
        this._flickerTimer = 0;
        this._opacity      = 1;
    }
    setColor(hex) { this._mat.color.set(hex); this._matGlow.color.set(hex); }
    update(A, B, dt) {
        this._flickerTimer -= dt;
        if (this._flickerTimer <= 0) {
            this._opacity      = 0.4 + Math.random() * 0.6;
            this._flickerTimer = 0.02 + Math.random() * 0.05;
        }
        this._mat.opacity     = this.visible ? this._opacity : 0;
        this._matGlow.opacity = this.visible ? this._opacity * 0.3 : 0;
        if (!this.visible) return;
        this._buildZigzag(this._geo,     A, B, 0.0);
        this._buildZigzag(this._geoGlow, A, B, 0.04);
    }
    _buildZigzag(geo, A, B, offsetScale) {
        const arr = geo.attributes.position.array;
        const N   = this.SEGS;
        const AB  = new THREE.Vector3().subVectors(B, A);
        const len = AB.length();
        const up  = Math.abs(AB.y / Math.max(len, 0.001)) > 0.9
            ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const perp1 = new THREE.Vector3().crossVectors(AB, up).normalize();
        const perp2 = new THREE.Vector3().crossVectors(AB, perp1).normalize();
        const amp   = len * 0.14 + 0.03;
        for (let i = 0; i <= N; i++) {
            const tt   = i / N;
            const base = new THREE.Vector3().lerpVectors(A, B, tt);
            const env  = Math.sin(tt * Math.PI);
            const d1   = (Math.random() - 0.5) * 2 * amp * env;
            const d2   = (Math.random() - 0.5) * 2 * amp * env;
            const od   = (Math.random() - 0.5) * offsetScale * amp;
            arr[i*3]   = base.x + perp1.x*d1 + perp2.x*d2 + perp1.x*od;
            arr[i*3+1] = base.y + perp1.y*d1 + perp2.y*d2 + perp1.y*od;
            arr[i*3+2] = base.z + perp1.z*d1 + perp2.z*d2 + perp1.z*od;
        }
        geo.attributes.position.needsUpdate = true;
    }
    dispose() {
        this._scene.remove(this._line);
        this._scene.remove(this._lineGlow);
        this._geo.dispose(); this._geoGlow.dispose();
        this._mat.dispose(); this._matGlow.dispose();
    }
}

// ================================================================================
//  AURA EFFECT
// ================================================================================
class AuraEffect {
    constructor(target) {
        this.target  = target;
        this.enabled = true;
        this.color   = new THREE.Color('#ff4400');
        this.time    = 0;

        const scene = window._nexusScene || window.scene;
        this._scene = scene;

        // Lê o tamanho real do objeto já na construção
        let initH = 2, initR = 0.6;
        try {
            const box = new THREE.Box3().setFromObject(target);
            const sz  = new THREE.Vector3(); box.getSize(sz);
            initH = sz.y || 2;
            initR = Math.max(sz.x, sz.z) * 0.5 + 0.08;
            if (initH < 0.01) initH = 2;
            if (initR < 0.01) initR = 0.6;
        } catch {}

        this.FLAME_COUNT = 40;
        this._flames = []; this._flameData = [];
        for (let i = 0; i < this.FLAME_COUNT; i++) {
            this._flames.push(this._makeSpr(TX_FLAME, scene));
            this._flameData.push(this._newFlame(initH, initR));
        }

        this.SPARK_COUNT = 24;
        this._sparks = []; this._sparkData = [];
        for (let i = 0; i < this.SPARK_COUNT; i++) {
            this._sparks.push(this._makeSpr(TX_SPARK_FLAME, scene));
            this._sparkData.push(this._newSpark(initH, initR));
        }

        this.ORB_COUNT = 20;
        this._orbs = []; this._orbData = [];
        for (let i = 0; i < this.ORB_COUNT; i++) {
            this._orbs.push(this._makeSpr(TX_GLOW, scene));
            this._orbData.push(this._newOrb(initH, initR));
        }

        this.SIDE_COUNT = 6;
        this._sides = []; this._sideData = [];
        for (let i = 0; i < this.SIDE_COUNT; i++) {
            this._sides.push(this._makeSpr(TX_FLAME, scene));
            this._sideData.push(this._newSide(initH, initR));
        }

        this._core  = this._makeSpr(TX_GLOW, scene);
        this._outer = this._makeSpr(TX_GLOW, scene);

        this._rings = [
            this._makeSpr(TX_RING_AURA, scene),
            this._makeSpr(TX_RING_AURA, scene),
            this._makeSpr(TX_RING_AURA, scene),
        ];

        this.LIGHTNING_COUNT = 14;
        this._lightnings = []; this._lightningData = [];
        for (let i = 0; i < this.LIGHTNING_COUNT; i++) {
            this._lightnings.push(new Lightning3D(scene, 0x55bbff));
            this._lightningData.push(this._newLightningArc(initH, initR));
        }

        // ── Tracking de movimento ──────────────────────────────────────────
        this._prevPos      = new THREE.Vector3();
        this._velocity     = new THREE.Vector3();
        // Lean suavizado (low-pass filter pra não tremer)
        this._smoothLean   = new THREE.Vector3();
        this._firstFrame   = true;
        this._fallingCount = 0;
    }

    // ── Factories ─────────────────────────────────────────────────────────────

    _newFlame(objH = 2, objR = 0.6) {
        // Fatores de escala normalizados pelos valores padrão
        const sR = objR / 0.6;
        const sH = objH / 2.0;
        return {
            angle: Math.random() * Math.PI * 2,
            r: objR * (0.55 + Math.random() * 0.55),
            yOff: Math.random() * objH * 0.6,
            vy: (1.8 + Math.random() * 3.5) * sH,
            vr: (Math.random() - 0.5) * 0.4 * sR,
            vAngle: (Math.random() - 0.5) * 2.0,
            life: Math.random(),
            maxLife: 0.25 + Math.random() * 0.40,
            width: (0.18 + Math.random() * 0.28) * sR,
            height: (0.55 + Math.random() * 0.90) * sH,
            falling: false,
            fallX: 0, fallY: 0, fallZ: 0,
            fallVX: 0, fallVY: 0, fallVZ: 0,
            fallAge: 0, fallMaxLife: 0.6,
        };
    }

    _newSpark(objH = 2, objR = 0.6) {
        const sR = objR / 0.6;
        const sH = objH / 2.0;
        return {
            angle: Math.random() * Math.PI * 2,
            r: objR * (0.4 + Math.random() * 0.8),
            yOff: Math.random() * objH * 0.8,
            vy: (3.0 + Math.random() * 5.0) * sH,
            vr: (Math.random() - 0.5) * 0.8 * sR,
            vAngle: (Math.random() - 0.5) * 4.0,
            life: Math.random(),
            maxLife: 0.10 + Math.random() * 0.18,
            width: (0.06 + Math.random() * 0.10) * sR,
            height: (0.30 + Math.random() * 0.50) * sH,
            falling: false,
            fallX: 0, fallY: 0, fallZ: 0,
            fallVX: 0, fallVY: 0, fallVZ: 0,
            fallAge: 0, fallMaxLife: 0.6,
        };
    }

    _newOrb(objH = 2, objR = 0.6) {
        const sR = objR / 0.6;
        const sH = objH / 2.0;
        return {
            angle: Math.random() * Math.PI * 2,
            r: objR * (0.3 + Math.random() * 0.9),
            yOff: Math.random() * objH * 0.3,
            vy: (1.0 + Math.random() * 2.0) * sH,
            vAngle: (Math.random() - 0.5) * 1.5,
            life: Math.random(),
            maxLife: 0.35 + Math.random() * 0.55,
            size: (0.06 + Math.random() * 0.11) * sR,
            falling: false,
            fallX: 0, fallY: 0, fallZ: 0,
            fallVX: 0, fallVY: 0, fallVZ: 0,
            fallAge: 0, fallMaxLife: 0.6,
        };
    }

    _newSide(objH = 2, objR = 0.6) {
        const sR = objR / 0.6;
        const sH = objH / 2.0;
        const side = Math.random() < 0.5 ? 1 : -1;
        return {
            angle: Math.random() * Math.PI * 2,
            r: objR * 0.7,
            yOff: objH * (0.15 + Math.random() * 0.60),
            vRadial: (1.2 + Math.random() * 1.8) * sR,
            vy: (0.6 + Math.random() * 1.2) * sH,
            vAngle: side * (1.8 + Math.random() * 2.0),
            life: Math.random(),
            maxLife: 0.30 + Math.random() * 0.40,
            width: (0.18 + Math.random() * 0.28) * sR,
            height: (0.55 + Math.random() * 0.90) * sH,
            falling: false,
            fallX: 0, fallY: 0, fallZ: 0,
            fallVX: 0, fallVY: 0, fallVZ: 0,
            fallAge: 0, fallMaxLife: 0.6,
        };
    }

    _newLightningArc(objH = 2, objR = 0.6) {
        const angA = Math.random() * Math.PI * 2;
        const angB = angA + Math.PI * (0.25 + Math.random() * 0.9);
        const rA   = objR * (0.85 + Math.random() * 0.15);
        const rB   = objR * (0.85 + Math.random() * 0.15);
        const ySpan = objH * 0.5;
        const yMid  = objH * (0.25 + Math.random() * 0.5);
        return {
            angA, angB, rA, rB,
            yA: yMid + (Math.random() - 0.5) * ySpan,
            yB: yMid + (Math.random() - 0.5) * ySpan,
            reshuffleTimer: Math.random() * 0.20,
            reshuffleTime:  0.08 + Math.random() * 0.18,
        };
    }

    _makeSpr(tex, scene) {
        const mat = new THREE.SpriteMaterial({
            map: tex, blending: THREE.AdditiveBlending,
            depthWrite: false, transparent: true, color: this.color.clone(),
        });
        const sp = new THREE.Sprite(mat);
        sp.userData.isFXSprite = true;
        sp.layers.enable(1);
        scene.add(sp); return sp;
    }

    setColor(hex) {
        this.color.set(hex);
        const sprites = [
            ...this._flames, ...this._sparks, ...this._orbs, ...this._sides,
            ...this._rings, this._core, this._outer,
        ];
        sprites.forEach(sp => sp.material.color.set(hex));
    }

    _tryDetach(dataArr, spritesArr, oppDir) {
        const candidates = [];
        for (let i = 0; i < dataArr.length; i++)
            if (!dataArr[i].falling) candidates.push(i);
        if (candidates.length === 0) return false;
        const idx = candidates[Math.floor(Math.random() * candidates.length)];
        const d = dataArr[idx], sp = spritesArr[idx];
        d.falling     = true;
        d.fallX       = sp.position.x;
        d.fallY       = sp.position.y;
        d.fallZ       = sp.position.z;
        d.fallAge     = 0;
        d.fallMaxLife = 0.45 + Math.random() * 0.35;
        d.fallVY = -(1.2 + Math.random() * 1.8);
        d.fallVX = oppDir.x * (0.3 + Math.random() * 0.5) + (Math.random()-0.5)*0.2;
        d.fallVZ = oppDir.z * (0.3 + Math.random() * 0.5) + (Math.random()-0.5)*0.2;
        return true;
    }

    update(dt) {
        const allSprites = [
            ...this._flames, ...this._sparks, ...this._orbs, ...this._sides,
            ...this._rings, this._core, this._outer,
        ];
        if (!this.enabled) {
            allSprites.forEach(sp => { sp.material.opacity = 0; });
            const zero = new THREE.Vector3();
            this._lightnings.forEach(l => { l.visible = false; l.update(zero, zero, dt); });
            return;
        }

        this.time += dt;
        const t = this.time;

        let objH = 2, objR = 0.6;
        try {
            const box = new THREE.Box3().setFromObject(this.target);
            const sz  = new THREE.Vector3(); box.getSize(sz);
            objH = sz.y;
            objR = Math.max(sz.x, sz.z) * 0.5 + 0.08;
        } catch {}

        const wPos = new THREE.Vector3();
        this.target.getWorldPosition(wPos);
        const baseY = wPos.y - objH * 0.5;

        // ── Velocidade + lean suavizado ────────────────────────────────────
        if (this._firstFrame) { this._prevPos.copy(wPos); this._firstFrame = false; }
        this._velocity.subVectors(wPos, this._prevPos).divideScalar(Math.max(dt, 0.001));
        this._prevPos.copy(wPos);
        const speed = this._velocity.length();

        // Low-pass filter: lean responde suave, não instantâneo
        // leanTarget = -velocity * strength (oposto ao movimento)
        const LEAN_STRENGTH = 0.10; // quão longe as partículas inclinam (unidades world)
        const LEAN_SMOOTH   = 8.0;  // velocidade do filtro (maior = mais rápido)
        const leanTargetX   = -this._velocity.x * LEAN_STRENGTH;
        const leanTargetZ   = -this._velocity.z * LEAN_STRENGTH;
        // Y: movimento horizontal rápido faz partículas inclinarem levemente pra cima
        const leanTargetY   = speed * LEAN_STRENGTH * 0.4;

        this._smoothLean.x += (leanTargetX - this._smoothLean.x) * Math.min(1, LEAN_SMOOTH * dt);
        this._smoothLean.y += (leanTargetY - this._smoothLean.y) * Math.min(1, LEAN_SMOOTH * dt);
        this._smoothLean.z += (leanTargetZ - this._smoothLean.z) * Math.min(1, LEAN_SMOOTH * dt);

        const lx = this._smoothLean.x;
        const ly = this._smoothLean.y;
        const lz = this._smoothLean.z;

        // ── Detach de partículas ao mover ──────────────────────────────────
        const MAX_FALLING  = 5;
        const SPAWN_THRESH = 0.8;

        this._fallingCount = 0;
        for (const d of [...this._flameData, ...this._sparkData, ...this._orbData, ...this._sideData])
            if (d.falling) this._fallingCount++;

        if (speed > SPAWN_THRESH && this._fallingCount < MAX_FALLING) {
            const oppDir = new THREE.Vector3(-this._velocity.x, 0, -this._velocity.z).normalize();
            const pools  = [
                [this._flameData, this._flames],
                [this._sparkData, this._sparks],
                [this._orbData,   this._orbs],
                [this._sideData,  this._sides],
            ];
            for (let i = pools.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pools[i], pools[j]] = [pools[j], pools[i]];
            }
            for (const [dArr, sArr] of pools) {
                if (this._tryDetach(dArr, sArr, oppDir)) break;
            }
        }

        // ── Core glow ──────────────────────────────────────────────────────
        const cf = 0.70
            + Math.sin(t * 19.3) * 0.10 + Math.sin(t * 31.7) * 0.07
            + Math.sin(t *  7.1) * 0.09 + Math.sin(t *  2.8) * 0.04;
        const cSc = objR * 1.7 * cf;
        // O core também inclina levemente
        this._core.position.set(wPos.x + lx * 0.3, wPos.y + ly * 0.3, wPos.z + lz * 0.3);
        this._core.scale.set(cSc, cSc * (1.3 + objH / Math.max(objR, 0.1) * 0.15), 1);
        this._core.material.opacity = Math.min(1, 0.82 * cf);

        // ── Outer glow ─────────────────────────────────────────────────────
        const of2 = 0.80 + Math.sin(t * 4.4) * 0.20;
        const oSc = (objR * 2.8 + objH * 0.35) * of2;
        this._outer.position.set(wPos.x + lx * 0.2, wPos.y + ly * 0.2, wPos.z + lz * 0.2);
        this._outer.scale.set(oSc, oSc * 1.8, 1);
        this._outer.material.opacity = 0.18 * of2;

        const GRAVITY = 2.2;

        const updateFalling = (sp, d) => {
            d.fallAge += dt;
            if (d.fallAge >= d.fallMaxLife) { d.falling = false; return false; }
            const p  = d.fallAge / d.fallMaxLife;
            const el = d.fallAge;
            sp.position.set(
                d.fallX + d.fallVX * el,
                d.fallY + d.fallVY * el - 0.5 * GRAVITY * el * el,
                d.fallZ + d.fallVZ * el,
            );
            return 1.0 - p;
        };

        // ── Chamas ─────────────────────────────────────────────────────────
        for (let i = 0; i < this.FLAME_COUNT; i++) {
            const sp = this._flames[i], d = this._flameData[i];
            if (d.falling) {
                const env = updateFalling(sp, d);
                if (env === false) { sp.material.opacity = 0; continue; }
                sp.scale.set(d.width * 0.6, d.height * (0.4 + env * 0.4), 1);
                sp.material.opacity = env * 0.80;
                continue;
            }
            d.life += dt / d.maxLife;
            if (d.life >= 1) { Object.assign(d, this._newFlame(objH, objR)); d.life = 0; }
            const p = d.life, env = Math.sin(p * Math.PI);
            const ang = d.angle + d.vAngle * p * d.maxLife;
            const r   = Math.max(0, d.r + d.vr * p * d.maxLife);
            // Lean: altura escalada pela life (ponta inclina mais que a base)
            const leanScale = p; // quanto mais avançada na vida, mais longe está → mais lean
            sp.position.set(
                wPos.x + Math.cos(ang)*r + lx * leanScale,
                baseY + d.yOff + d.vy * p * d.maxLife + ly * leanScale,
                wPos.z + Math.sin(ang)*r + lz * leanScale,
            );
            sp.scale.set(d.width*(1.0-p*0.6)*(0.6+env*0.7), d.height*(0.5+env*0.7), 1);
            sp.material.opacity = env * 0.90;
        }

        // ── Sparks ─────────────────────────────────────────────────────────
        for (let i = 0; i < this.SPARK_COUNT; i++) {
            const sp = this._sparks[i], d = this._sparkData[i];
            if (d.falling) {
                const env = updateFalling(sp, d);
                if (env === false) { sp.material.opacity = 0; continue; }
                sp.scale.set(d.width * 0.7, d.height * (0.3 + env * 0.5), 1);
                sp.material.opacity = env * 0.75;
                continue;
            }
            d.life += dt / d.maxLife;
            if (d.life >= 1) { Object.assign(d, this._newSpark(objH, objR)); d.life = 0; }
            const p = d.life, env = Math.sin(p * Math.PI);
            const ang = d.angle + d.vAngle * p * d.maxLife;
            const r   = Math.max(0, d.r + d.vr * p * d.maxLife);
            const leanScale = p;
            sp.position.set(
                wPos.x + Math.cos(ang)*r + lx * leanScale,
                baseY + d.yOff + d.vy * p * d.maxLife + ly * leanScale,
                wPos.z + Math.sin(ang)*r + lz * leanScale,
            );
            sp.scale.set(d.width*(1.0-p*0.5), d.height*(0.4+env*0.8), 1);
            sp.material.opacity = env * 0.85;
        }

        // ── Orbs ───────────────────────────────────────────────────────────
        for (let i = 0; i < this.ORB_COUNT; i++) {
            const sp = this._orbs[i], d = this._orbData[i];
            if (d.falling) {
                const env = updateFalling(sp, d);
                if (env === false) { sp.material.opacity = 0; continue; }
                const sc = d.size * (0.5 + env * 0.5);
                sp.scale.set(sc, sc, 1);
                sp.material.opacity = env * 0.90;
                continue;
            }
            d.life += dt / d.maxLife;
            if (d.life >= 1) { Object.assign(d, this._newOrb(objH, objR)); d.life = 0; }
            const p = d.life, env = Math.sin(p * Math.PI);
            const ang = d.angle + d.vAngle * p * d.maxLife;
            const leanScale = p;
            sp.position.set(
                wPos.x + Math.cos(ang)*d.r + lx * leanScale,
                baseY + d.yOff + d.vy * p * d.maxLife + ly * leanScale,
                wPos.z + Math.sin(ang)*d.r + lz * leanScale,
            );
            const sc = d.size * (0.5 + env * 0.8);
            sp.scale.set(sc, sc, 1);
            sp.material.opacity = env * 0.95;
        }

        // ── Side flames ────────────────────────────────────────────────────
        for (let i = 0; i < this.SIDE_COUNT; i++) {
            const sp = this._sides[i], d = this._sideData[i];
            if (d.falling) {
                const env = updateFalling(sp, d);
                if (env === false) { sp.material.opacity = 0; continue; }
                sp.scale.set(d.width * 0.6, d.height * (0.4 + env * 0.4), 1);
                sp.material.opacity = env * 0.75;
                continue;
            }
            d.life += dt / d.maxLife;
            if (d.life >= 1) { Object.assign(d, this._newSide(objH, objR)); d.life = 0; }
            const p = d.life, env = Math.sin(p * Math.PI);
            const ang = d.angle + d.vAngle * p * d.maxLife;
            const r   = d.r + d.vRadial * p * d.maxLife;
            const leanScale = p;
            sp.position.set(
                wPos.x + Math.cos(ang)*r + lx * leanScale,
                baseY + d.yOff + d.vy * p * d.maxLife + ly * leanScale,
                wPos.z + Math.sin(ang)*r + lz * leanScale,
            );
            sp.scale.set(d.width*(1.0-p*0.6)*(0.6+env*0.7), d.height*(0.5+env*0.7), 1);
            sp.material.opacity = env * 0.80;
        }

        // ── Ground rings ───────────────────────────────────────────────────
        const RING_SPEED = 0.50;
        for (let i = 0; i < 3; i++) {
            const phase = ((t / RING_SPEED) + i / 3) % 1;
            const rSc   = objR * (0.9 + phase * 3.2);
            const rOp   = Math.pow(1 - phase, 1.8) * 0.95;
            const sp    = this._rings[i];
            sp.position.set(wPos.x, baseY + 0.02, wPos.z);
            sp.scale.set(rSc, rSc * 0.12, 1);
            sp.material.opacity = rOp;
        }

        // ── Eletricidade 3D ────────────────────────────────────────────────
        const A = new THREE.Vector3();
        const B = new THREE.Vector3();
        for (let i = 0; i < this.LIGHTNING_COUNT; i++) {
            const l = this._lightnings[i], d = this._lightningData[i];
            l.visible = true;
            d.reshuffleTimer -= dt;
            if (d.reshuffleTimer <= 0) Object.assign(d, this._newLightningArc(objH, objR));
            // Lightning também inclina com o lean
            A.set(
                wPos.x + Math.cos(d.angA)*d.rA + lx * 0.5,
                baseY + d.yA,
                wPos.z + Math.sin(d.angA)*d.rA + lz * 0.5,
            );
            B.set(
                wPos.x + Math.cos(d.angB)*d.rB + lx * 0.5,
                baseY + d.yB,
                wPos.z + Math.sin(d.angB)*d.rB + lz * 0.5,
            );
            l.update(A, B, dt);
        }
    }

    dispose() {
        const scene = window._nexusScene || window.scene;
        const sprites = [
            ...this._flames, ...this._sparks, ...this._orbs, ...this._sides,
            ...this._rings, this._core, this._outer,
        ];
        sprites.forEach(sp => { scene.remove(sp); sp.material.dispose(); });
        this._lightnings.forEach(l => l.dispose());
    }
}

// ==================== PAINEL UI ====================
function createSpecialPanel() {
    if (document.getElementById('special-panel')) return;

    const panel = document.createElement('div');
    panel.id        = 'special-panel';
    panel.className = 'panel special-panel hidden';
    panel.innerHTML = `
        <div class="panel-header">
            <h3>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Efeitos Especiais
            </h3>
        </div>

        <div class="special-color-row">
            <label>Cor do efeito</label>
            <input type="color" id="fx-color-picker" value="#ff4400">
        </div>

        <div class="special-fx-grid">
            <button id="fx-trail-btn"  class="special-fx-btn" data-fx="trail">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                <span>Trail</span>
            </button>
            <button id="fx-deform-btn" class="special-fx-btn" data-fx="deform">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                <span>Deformação</span>
            </button>
            <button id="fx-glitch-btn" class="special-fx-btn" data-fx="glitch">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                <span>Glitch</span>
            </button>
            <button id="fx-aura-btn"   class="special-fx-btn" data-fx="aura">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                <span>Aura</span>
            </button>
        </div>

        <div id="special-no-sel" class="no-selection" style="display:none;">Selecione um objeto</div>
    `;
    document.body.appendChild(panel);

    injectSpecialCSS();
    setupSpecialPanelEvents(panel);
}

function injectSpecialCSS() {
    if (document.getElementById('_special_css')) return;
    const s = document.createElement('style');
    s.id = '_special_css';
    s.textContent = `
        .special-panel {
            position: fixed;
            top: 62px;
            right: 16px;
            width: 200px;
            background: rgba(10,12,30,0.97);
            border: 1px solid rgba(160,80,255,0.25);
            border-radius: 12px;
            padding: 12px;
            z-index: 200;
            box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 18px rgba(120,60,255,0.1);
            backdrop-filter: blur(10px);
        }
        @media (max-width: 600px), (orientation: landscape) and (max-height: 500px) {
            .special-panel {
                position: fixed !important;
                top: 50% !important; left: 50% !important;
                right: auto !important; bottom: auto !important;
                transform: translate(-50%,-50%) !important;
                z-index: 2500 !important;
            }
        }
        .special-panel .panel-header h3 {
            color: #c084ff;
            font-size: 12px;
            font-weight: 700;
        }
        .special-color-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 10px 0 8px;
            padding: 7px 10px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 7px;
        }
        .special-color-row label {
            font-size: 11px;
            color: rgba(255,255,255,0.55);
        }
        .special-color-row input[type="color"] {
            width: 36px; height: 22px;
            border: none; background: none; cursor: pointer;
            border-radius: 4px; padding: 0;
        }
        .special-fx-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
        }
        .special-fx-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
            padding: 10px 6px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            color: rgba(255,255,255,0.6);
            cursor: pointer;
            font-size: 10px;
            font-family: var(--font-ui, sans-serif);
            transition: background 0.15s, border-color 0.15s, color 0.15s;
        }
        .special-fx-btn:hover {
            background: rgba(160,80,255,0.12);
            border-color: rgba(160,80,255,0.4);
            color: #d0a0ff;
        }
        .special-fx-btn.active {
            background: rgba(160,80,255,0.2);
            border-color: rgba(160,80,255,0.7);
            color: #e0b8ff;
            box-shadow: 0 0 10px rgba(160,80,255,0.25);
        }
        .special-fx-btn[data-fx="trail"].active  { border-color: rgba(255,120,20,0.7);  background: rgba(255,100,0,.18);  color:#ffa060; box-shadow:0 0 10px rgba(255,100,0,.3); }
        .special-fx-btn[data-fx="deform"].active { border-color: rgba(80,200,255,0.7);  background: rgba(60,180,255,.18); color:#80d8ff; box-shadow:0 0 10px rgba(80,200,255,.3); }
        .special-fx-btn[data-fx="glitch"].active { border-color: rgba(0,255,200,0.7);   background: rgba(0,220,180,.18);  color:#60ffe8; box-shadow:0 0 10px rgba(0,220,180,.3); }
        .special-fx-btn[data-fx="aura"].active   { border-color: rgba(255,220,0,0.7);   background: rgba(255,200,0,.18);  color:#ffe060; box-shadow:0 0 10px rgba(255,200,0,.3); }
    `;
    document.head.appendChild(s);
}

function setupSpecialPanelEvents(panel) {
    panel.querySelectorAll('.special-fx-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fxType = btn.dataset.fx;
            const target = window.activeObject;
            if (!target) { flashSpecial('Selecione um objeto primeiro'); return; }

            const active = toggleEffect(fxType, target);
            btn.classList.toggle('active', active);

            // Aplica cor atual
            if (active) {
                const colorVal = document.getElementById('fx-color-picker')?.value || '#ff4400';
                setEffectColor(colorVal, target.uuid);
            }
        });
    });

    document.getElementById('fx-color-picker')?.addEventListener('input', (e) => {
        const target = window.activeObject;
        if (!target) return;
        setEffectColor(e.target.value, target.uuid);
    });
}

function flashSpecial(msg) {
    let el = document.getElementById('tl-flash-msg');
    if (!el) {
        el = document.createElement('div'); el.id = 'tl-flash-msg'; el.className = 'tl-flash-msg';
        document.body.appendChild(el);
    }
    el.textContent = msg; el.classList.add('visible');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('visible'), 2000);
}

// Atualiza estado visual dos botões quando muda objeto selecionado
function refreshFXButtons(uuid) {
    const types = ['trail', 'deform', 'glitch', 'aura'];
    types.forEach(t => {
        const btn = document.getElementById(`fx-${t}-btn`);
        if (btn) btn.classList.toggle('active', hasEffect(t, uuid));
    });
}

// ==================== API PÚBLICA ====================
window.SpecialFX = {
    update(dt)              { updateAll(dt); },
    toggle(panel)           {
        const el = document.getElementById('special-panel');
        if (el) el.classList.toggle('hidden');
    },
    removeAllFor(uuid)      { removeAllEffects(uuid); },
    refreshButtons(uuid)    { refreshFXButtons(uuid); },
    createPanel()           { createSpecialPanel(); },
};

// Cria o painel assim que o DOM estiver pronto
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createSpecialPanel);
else createSpecialPanel();

console.log('✨ special_fx.js — Trail, Deformação, Glitch, Aura ✅');
