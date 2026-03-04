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

    _spawn(wPos) {
        for (let i = 0; i < this.data.length; i++) {
            const d = this.data[i];
            if (d.active && d.life < 1) continue;
            const sp = this.sprites[i];
            d.active = true; d.life = 0;
            d.worldPos.copy(wPos).addScaledVector(
                new THREE.Vector3((Math.random()-.5),(Math.random()-.5),(Math.random()-.5)), 0.15
            );
            d.vel.set((Math.random()-.5)*.3, 0.4+Math.random()*.5, (Math.random()-.5)*.3);
            d.maxLife = 0.4 + Math.random()*.4;
            d.scale   = 0.3 + Math.random()*.4;
            sp.material.opacity = 0;
            return;
        }
    }

    update(dt) {
        if (!this.enabled) { this.sprites.forEach(sp => { sp.material.opacity = 0; }); return; }
        this.time += dt;
        this.target.getWorldPosition(this._curPos);

        const speed = this._curPos.distanceTo(this._lastPos) / dt;
        const emit  = Math.min(5, Math.ceil(speed * 2));
        for (let e = 0; e < emit; e++) this._spawn(this._curPos);

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
//  AURA EFFECT — Anime power-up aura estilo Roblox
//  Camadas: glow base, raios de energia subindo, anel no chão, orbes flutuantes
// ================================================================================

// Textura de raio/energia — faixa vertical com brilho central
const TX_ENERGY = makeSpriteTex((ctx, W, H) => {
    // faixa vertical brilhante
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0.00, 'rgba(255,255,255,0)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.50, 'rgba(255,255,255,1)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.9)');
    g.addColorStop(1.00, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // fade vertical nas extremidades
    const gv = ctx.createLinearGradient(0, 0, 0, H);
    gv.addColorStop(0.00, 'rgba(0,0,0,0)');
    gv.addColorStop(0.08, 'rgba(0,0,0,0)');
    gv.addColorStop(0.55, 'rgba(0,0,0,0.0)');
    gv.addColorStop(1.00, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = gv; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
}, 32, 128);

// Textura de anel — círculo fino para o ground ring
const TX_RING = makeSpriteTex((ctx, W, H) => {
    ctx.beginPath(); ctx.arc(W/2, H/2, W/2 - 4, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.arc(W/2, H/2, W/2 - 12, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
}, 128, 128);

class AuraEffect {
    constructor(target) {
        this.target  = target;
        this.enabled = true;
        this.color   = new THREE.Color('#00aaff');
        this.time    = 0;

        const scene = window._nexusScene || window.scene;

        // ── 1. Glow base (grande sprite de fundo no centro do objeto) ──────
        this._baseGlow = this._makeSprite(TX_GLOW, scene);

        // ── 2. Ground ring (anel achatado no chão) ─────────────────────────
        this._groundRing = this._makeSprite(TX_RING, scene);

        // ── 3. Raios de energia subindo (12 faixas verticais ao redor) ─────
        this._rays = [];
        this._rayData = [];
        for (let i = 0; i < 12; i++) {
            this._rays.push(this._makeSprite(TX_ENERGY, scene));
            this._rayData.push({
                angle:    (i / 12) * Math.PI * 2 + Math.random() * 0.5,
                radius:   0,          // calculado no update
                speed:    0.6 + Math.random() * 1.2, // velocidade de subida
                life:     Math.random(),
                maxLife:  0.5 + Math.random() * 0.6,
                yBase:    0,
                height:   1.5 + Math.random() * 2.0,
                width:    0.12 + Math.random() * 0.18,
                drift:    (Math.random() - 0.5) * 0.4, // deriva angular
            });
        }

        // ── 4. Orbes flutuantes (pequenos orbs que sobem e somem) ──────────
        this._orbs = [];
        this._orbData = [];
        for (let i = 0; i < 20; i++) {
            this._orbs.push(this._makeSprite(TX_GLOW, scene));
            this._orbData.push({
                angle:   Math.random() * Math.PI * 2,
                radius:  0,
                yStart:  Math.random() * 0.5,
                ySpeed:  0.5 + Math.random() * 1.0,
                life:    Math.random(),
                maxLife: 0.8 + Math.random() * 0.7,
                size:    0.08 + Math.random() * 0.12,
                wobble:  Math.random() * Math.PI * 2,
            });
        }

        // ── 5. Inner body glow (glow colado no corpo, pulsa) ──────────────
        this._bodyGlow = this._makeSprite(TX_GLOW, scene);

        // ── 6. Segunda camada de anel que expande e some ──────────────────
        this._pulseRing = this._makeSprite(TX_RING, scene);
        this._pulseTimer = 0;
        this._pulseActive = false;
        this._pulseDur = 0;
    }

    _makeSprite(tex, scene) {
        const mat = new THREE.SpriteMaterial({
            map: tex,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            color: this.color.clone(),
        });
        const sp = new THREE.Sprite(mat);
        sp.layers.enable(1);
        sp.userData.isFXSprite = true;
        scene.add(sp);
        return sp;
    }

    setColor(hex) {
        this.color.set(hex);
        const all = [this._baseGlow, this._groundRing, this._bodyGlow, this._pulseRing,
                     ...this._rays, ...this._orbs];
        all.forEach(sp => sp.material.color.set(hex));
    }

    update(dt) {
        if (!this.enabled) {
            [this._baseGlow, this._groundRing, this._bodyGlow, this._pulseRing,
             ...this._rays, ...this._orbs].forEach(sp => { sp.material.opacity = 0; });
            return;
        }
        this.time += dt;
        const t = this.time;

        // Bounding box do objeto
        let objH = 2, objR = 0.6;
        try {
            const box = new THREE.Box3().setFromObject(this.target);
            const sz  = new THREE.Vector3();
            box.getSize(sz);
            objH = sz.y;
            objR = Math.max(sz.x, sz.z) * 0.5 + 0.15;
        } catch {}

        const wPos = new THREE.Vector3();
        this.target.getWorldPosition(wPos);
        const baseY = wPos.y - objH * 0.5; // chão do objeto

        // ── Glow base ─────────────────────────────────────────────────────
        const bgPulse = 0.85 + Math.sin(t * 3.5) * 0.15;
        const bgSc    = (objR * 2.4 + objH * 0.6) * bgPulse;
        this._baseGlow.position.set(wPos.x, wPos.y, wPos.z);
        this._baseGlow.scale.set(bgSc, bgSc * 1.4, 1);
        this._baseGlow.material.opacity = 0.22 * bgPulse;

        // ── Body glow (mais forte, bem colado) ────────────────────────────
        const bodyPulse = 0.75 + Math.sin(t * 5.2 + 1.0) * 0.25;
        const bodySc    = objR * 1.6 * bodyPulse;
        this._bodyGlow.position.set(wPos.x, wPos.y, wPos.z);
        this._bodyGlow.scale.set(bodySc, bodySc * (1.2 + objH / objR * 0.3), 1);
        this._bodyGlow.material.opacity = 0.45 * bodyPulse;

        // ── Ground ring ───────────────────────────────────────────────────
        const ringPulse = 0.7 + Math.sin(t * 4.0) * 0.3;
        const ringSc    = objR * 2.2 * ringPulse;
        this._groundRing.position.set(wPos.x, baseY + 0.02, wPos.z);
        this._groundRing.scale.set(ringSc, ringSc * 0.18, 1); // achatado
        this._groundRing.material.opacity = 0.6 * ringPulse;

        // ── Raios de energia ──────────────────────────────────────────────
        for (let i = 0; i < this._rays.length; i++) {
            const sp = this._rays[i], d = this._rayData[i];
            d.life += dt / d.maxLife;
            if (d.life >= 1) {
                d.life    = 0;
                d.angle   = Math.random() * Math.PI * 2;
                d.maxLife = 0.5 + Math.random() * 0.6;
                d.height  = objH * (0.8 + Math.random() * 0.8);
                d.width   = 0.10 + Math.random() * 0.16;
                d.speed   = 0.6 + Math.random() * 1.2;
                d.drift   = (Math.random() - 0.5) * 0.5;
            }
            d.angle += d.drift * dt;
            d.radius = objR * (0.85 + Math.sin(t * 2.0 + i) * 0.15);

            // Posição: subindo à medida que life avança
            const yRise = baseY + d.life * d.height * 1.2;
            sp.position.set(
                wPos.x + Math.cos(d.angle) * d.radius,
                yRise + d.height * 0.4,
                wPos.z + Math.sin(d.angle) * d.radius,
            );
            sp.material.rotation = d.angle + Math.PI / 2;

            // Escala: largo na base, estreita no topo, fade suave
            const env   = Math.sin(d.life * Math.PI);
            const scW   = d.width * (1.0 + env * 0.4);
            const scH   = d.height * (0.7 + env * 0.4);
            sp.scale.set(scW, scH, 1);
            sp.material.opacity = env * 0.75;
        }

        // ── Orbes flutuantes ──────────────────────────────────────────────
        for (let i = 0; i < this._orbs.length; i++) {
            const sp = this._orbs[i], d = this._orbData[i];
            d.life += dt / d.maxLife;
            if (d.life >= 1) {
                d.life   = 0;
                d.angle  = Math.random() * Math.PI * 2;
                d.yStart = Math.random() * objH * 0.3;
                d.ySpeed = 0.5 + Math.random() * 1.0;
                d.size   = 0.08 + Math.random() * 0.12;
                d.maxLife = 0.8 + Math.random() * 0.7;
                d.wobble = Math.random() * Math.PI * 2;
            }
            const wobbleR = objR * (0.7 + Math.sin(t * 3.0 + d.wobble) * 0.3);
            const y       = baseY + d.yStart + d.life * objH * 1.3 * d.ySpeed;
            sp.position.set(
                wPos.x + Math.cos(d.angle + t * 0.5) * wobbleR,
                y,
                wPos.z + Math.sin(d.angle + t * 0.5) * wobbleR,
            );
            const env = Math.sin(d.life * Math.PI);
            const sc  = d.size * (0.8 + env * 0.4);
            sp.scale.set(sc, sc, 1);
            sp.material.opacity = env * 0.85;
        }

        // ── Pulse ring (expande do centro a cada ~1.2s) ───────────────────
        this._pulseTimer -= dt;
        if (this._pulseTimer <= 0) {
            this._pulseTimer  = 0.9 + Math.random() * 0.6;
            this._pulseActive = true;
            this._pulseDur    = 0;
        }
        if (this._pulseActive) {
            this._pulseDur += dt;
            const pd = this._pulseDur / 0.5; // 0..1 em 0.5s
            if (pd >= 1) { this._pulseActive = false; this._pulseRing.material.opacity = 0; }
            else {
                const psc = objR * (1.0 + pd * 2.5);
                this._pulseRing.position.set(wPos.x, baseY + 0.03, wPos.z);
                this._pulseRing.scale.set(psc, psc * 0.15, 1);
                this._pulseRing.material.opacity = (1 - pd) * 0.8;
            }
        }
    }

    dispose() {
        const scene = window._nexusScene || window.scene;
        [this._baseGlow, this._groundRing, this._bodyGlow, this._pulseRing,
         ...this._rays, ...this._orbs].forEach(sp => {
            scene.remove(sp);
            sp.material.dispose();
        });
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
