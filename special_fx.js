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

// TX_HEAT: labaredas brancas/amarelas intensas
const TX_HEAT = makeSpriteTex((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    // Corpo da chama
    ctx.beginPath();
    ctx.moveTo(W*0.5, 0);
    ctx.bezierCurveTo(W*0.82, H*0.22, W*0.90, H*0.60, W*0.72, H);
    ctx.lineTo(W*0.28, H);
    ctx.bezierCurveTo(W*0.10, H*0.60, W*0.18, H*0.22, W*0.5, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, H, 0, 0);
    g.addColorStop(0.00, 'rgba(255,255,255,1.00)');
    g.addColorStop(0.12, 'rgba(255,255,220,1.00)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.60, 'rgba(255,240,200,0.50)');
    g.addColorStop(0.80, 'rgba(255,200,100,0.20)');
    g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = g; ctx.fill();
    // Inner core branco puro
    ctx.globalCompositeOperation = 'lighter';
    const gc = ctx.createLinearGradient(W*0.5, H*0.6, W*0.5, 0);
    gc.addColorStop(0, 'rgba(255,255,255,0.8)');
    gc.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = gc; ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
}, 56, 192);

// TX_HEAT_EMBER: pontos incandescentes voando
const TX_HEAT_EMBER = makeSpriteTex((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W/2,H/2,0, W/2,H/2,W/2);
    g.addColorStop(0,   'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,220,100,0.9)');
    g.addColorStop(0.7, 'rgba(255,100,0,0.4)');
    g.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
}, 32, 32);

// TX_HEAT_SMOKE: fumaça escura acima
const TX_HEAT_SMOKE = makeSpriteTex((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W/2,H/2,0, W/2,H/2,W*0.46);
    g.addColorStop(0,   'rgba(80,60,40,0.7)');
    g.addColorStop(0.5, 'rgba(60,50,40,0.3)');
    g.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
}, 96, 96);

// TX_HEAT_GLOW: halo laranja incandescente
const TX_HEAT_GLOW = makeSpriteTex((ctx, W, H) => {
    const g = ctx.createRadialGradient(W/2,H/2,0, W/2,H/2,W/2);
    g.addColorStop(0,   'rgba(255,200,50,1)');
    g.addColorStop(0.3, 'rgba(255,100,0,0.7)');
    g.addColorStop(0.65,'rgba(200,40,0,0.25)');
    g.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
}, 64, 64);

const TX_ICE = makeSpriteTex((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const cx = W/2, cy = H/2, r = W*0.42;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = (i/6)*Math.PI*2 - Math.PI/6;
        i === 0 ? ctx.moveTo(cx+r*Math.cos(a), cy+r*Math.sin(a)) : ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a));
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0.00, 'rgba(220,245,255,1.00)');
    g.addColorStop(0.40, 'rgba(160,220,255,0.80)');
    g.addColorStop(0.75, 'rgba(100,190,255,0.40)');
    g.addColorStop(1.00, 'rgba(80,160,255,0.00)');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(200,240,255,0.6)'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        const a = (i/6)*Math.PI*2;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a)); ctx.stroke();
    }
}, 64, 64);

const TX_SNOWFLAKE = makeSpriteTex((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const cx = W/2, cy = H/2, r = W*0.44;
    ctx.strokeStyle = 'rgba(220,245,255,1)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
        const a = (i/6)*Math.PI*2;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a)); ctx.stroke();
        const mid = r*0.55, bA = a+Math.PI/2, bLen = r*0.22;
        ctx.beginPath();
        ctx.moveTo(cx+mid*Math.cos(a)-bLen*Math.cos(bA), cy+mid*Math.sin(a)-bLen*Math.sin(bA));
        ctx.lineTo(cx+mid*Math.cos(a)+bLen*Math.cos(bA), cy+mid*Math.sin(a)+bLen*Math.sin(bA));
        ctx.stroke();
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W*0.18);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(180,230,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, W*0.18, 0, Math.PI*2); ctx.fill();
}, 64, 64);

const TX_ELEC_GLOW = makeSpriteTex((ctx, W, H) => {
    const g = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W/2);
    g.addColorStop(0.00, 'rgba(180,230,255,1)');
    g.addColorStop(0.30, 'rgba(100,180,255,0.7)');
    g.addColorStop(0.65, 'rgba(60,140,255,0.2)');
    g.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}, 64, 64);

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
        this.fxOffset   = new THREE.Vector3();
        this.fxScale    = 1;
        this.fxRotation = 0;
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
            d.scale   = (0.3 + Math.random()*.4) * s * (this.fxScale || 1); // tamanho escala com o objeto
            sp.material.opacity = 0;
            return;
        }
    }

    update(dt) {
        if (!this.enabled) { this.sprites.forEach(sp => { sp.material.opacity = 0; }); return; }
        this.time += dt;
        this.target.getWorldPosition(this._curPos);
        this._curPos.add(this.fxOffset);

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
        this.fxOffset   = new THREE.Vector3();
        this.fxScale    = 1;
        this.fxRotation = 0;

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
        wPos.add(this.fxOffset);
        const fxS = this.fxScale || 1;
        const fxR = this.fxRotation || 0;

        this.sprites.forEach((sp, i) => {
            if (!this._glitching) { sp.material.opacity = 0; return; }
            const angle  = (i / this.sprites.length) * Math.PI * 2 + fxR + this.time * 4.5;
            const r      = radius * fxS * (0.85 + Math.random()*.35);
            sp.position.set(
                wPos.x + Math.cos(angle) * r,
                wPos.y + (Math.random()-.5) * radius * fxS * .8,
                wPos.z + Math.sin(angle) * r
            );
            const sc = radius * fxS * (.6 + Math.random()*.5);
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
//  HEAT EFFECT
// ================================================================================
class HeatEffect {
    constructor(target) {
        this.target  = target;
        this.color   = new THREE.Color('#ff6600');
        this.enabled = true;
        this.time    = 0;
        const scene  = window._nexusScene || window.scene;
        this._scene  = scene;

        // ── Chamas principais ──────────────────────────────────────────────
        this.FLAME_COUNT = 55;
        this._flames = []; this._flameData = [];
        for (let i = 0; i < this.FLAME_COUNT; i++) {
            const mat = new THREE.SpriteMaterial({
                map: TX_HEAT, blending: THREE.AdditiveBlending,
                depthWrite: false, transparent: true, color: this.color.clone(),
            });
            const sp = new THREE.Sprite(mat);
            sp.userData.isFXSprite = true; sp.layers.enable(1);
            scene.add(sp); this._flames.push(sp);
            this._flameData.push(this._newFlame());
        }

        // ── Brasas / embers voando ─────────────────────────────────────────
        this.EMBER_COUNT = 35;
        this._embers = []; this._emberData = [];
        for (let i = 0; i < this.EMBER_COUNT; i++) {
            const mat = new THREE.SpriteMaterial({
                map: TX_HEAT_EMBER, blending: THREE.AdditiveBlending,
                depthWrite: false, transparent: true, color: this.color.clone(),
            });
            const sp = new THREE.Sprite(mat);
            sp.userData.isFXSprite = true; sp.layers.enable(1);
            scene.add(sp); this._embers.push(sp);
            this._emberData.push(this._newEmber());
        }

        // ── Fumaça escura acima ────────────────────────────────────────────
        this.SMOKE_COUNT = 20;
        this._smokes = []; this._smokeData = [];
        for (let i = 0; i < this.SMOKE_COUNT; i++) {
            const mat = new THREE.SpriteMaterial({
                map: TX_HEAT_SMOKE, blending: THREE.NormalBlending,
                depthWrite: false, transparent: true,
                color: new THREE.Color('#1a1008'),
            });
            const sp = new THREE.Sprite(mat);
            sp.userData.isFXSprite = true; sp.layers.enable(1);
            scene.add(sp); this._smokes.push(sp);
            this._smokeData.push(this._newSmoke());
        }

        // ── Glow laranja incandescente ─────────────────────────────────────
        this._glowCore  = this._makeSpr(TX_HEAT_GLOW, scene, this.color.clone());
        this._glowOuter = this._makeSpr(TX_HEAT_GLOW, scene, this.color.clone());

        this.fxOffset   = new THREE.Vector3();
        this.fxScale    = 1;
        this.fxRotation = 0;
    }

    _makeSpr(tex, scene, color) {
        const mat = new THREE.SpriteMaterial({
            map: tex, blending: THREE.AdditiveBlending,
            depthWrite: false, transparent: true, color,
        });
        const sp = new THREE.Sprite(mat);
        sp.userData.isFXSprite = true; sp.layers.enable(1);
        scene.add(sp); return sp;
    }

    _newFlame() {
        return {
            angle:   Math.random()*Math.PI*2,
            r:       0.05 + Math.random()*0.9,
            yOff:    Math.random()*0.3,
            vy:      2.5 + Math.random()*4.5,
            vAngle:  (Math.random()-0.5)*2.5,
            vr:      (Math.random()-0.5)*0.3,
            life:    Math.random(),
            maxLife: 0.20 + Math.random()*0.35,
            w:       0.15 + Math.random()*0.30,
            h:       0.50 + Math.random()*1.00,
            lean:    (Math.random()-0.5)*0.4,
        };
    }

    _newEmber() {
        return {
            ox: (Math.random()-0.5)*0.5,
            oy: Math.random()*0.3,
            oz: (Math.random()-0.5)*0.5,
            vx: (Math.random()-0.5)*1.8,
            vy: 1.5 + Math.random()*3.5,
            vz: (Math.random()-0.5)*1.8,
            life:    Math.random(),
            maxLife: 0.4 + Math.random()*0.8,
            size:    0.03 + Math.random()*0.07,
        };
    }

    _newSmoke() {
        return {
            angle:   Math.random()*Math.PI*2,
            r:       0.1 + Math.random()*0.7,
            yOff:    0.5 + Math.random()*0.5,
            vy:      0.5 + Math.random()*1.2,
            vAngle:  (Math.random()-0.5)*0.8,
            drift:   (Math.random()-0.5)*0.3,
            life:    Math.random(),
            maxLife: 0.6 + Math.random()*1.0,
            size:    0.3 + Math.random()*0.7,
        };
    }

    setColor(hex) {
        this.color.set(hex);
        [...this._flames, ...this._embers].forEach(sp => sp.material.color.set(hex));
        [this._glowCore, this._glowOuter].forEach(sp => sp.material.color.set(hex));
        // smoke fica escuro independente da cor
    }

    update(dt) {
        this.time += dt;
        const t = this.time;
        const allSprites = [...this._flames, ...this._embers, ...this._smokes, this._glowCore, this._glowOuter];

        if (!this.enabled) {
            allSprites.forEach(sp => { sp.material.opacity = 0; });
            return;
        }

        let objH = 2, objR = 0.6;
        try {
            const box = new THREE.Box3().setFromObject(this.target);
            const sz  = new THREE.Vector3(); box.getSize(sz);
            objH = Math.max(sz.y, 0.1); objR = Math.max(sz.x, sz.z)*0.5 + 0.05;
        } catch {}

        const wPos = new THREE.Vector3();
        this.target.getWorldPosition(wPos);
        wPos.add(this.fxOffset);
        const fxS  = this.fxScale || 1;
        objR *= fxS; objH *= fxS;
        const baseY = wPos.y - objH * 0.4;

        // ── Chamas ────────────────────────────────────────────────────────
        for (let i = 0; i < this.FLAME_COUNT; i++) {
            const sp = this._flames[i], d = this._flameData[i];
            d.life += dt / d.maxLife;
            if (d.life >= 1) { Object.assign(d, this._newFlame()); d.life = 0; }
            const p   = d.life;
            const env = Math.sin(p * Math.PI);
            const ang = d.angle + d.vAngle*p*d.maxLife + this.fxRotation;
            const r   = Math.max(0, (d.r + d.vr*p*d.maxLife) * objR);
            const leanX = d.lean * p;
            sp.position.set(
                wPos.x + Math.cos(ang)*r + leanX,
                baseY + d.yOff*objH + d.vy*objH*p*d.maxLife,
                wPos.z + Math.sin(ang)*r,
            );
            const w = d.w*fxS*(1.0-p*0.5)*(0.7+env*0.5);
            const h = d.h*fxS*(0.6+env*0.7)*(0.8+objH*0.3);
            sp.scale.set(w, h, 1);
            // Mais opaco na base (branco quente) e transparente no topo
            sp.material.opacity = env*(0.80 + Math.sin(t*12+i*0.7)*0.12);
        }

        // ── Embers ────────────────────────────────────────────────────────
        for (let i = 0; i < this.EMBER_COUNT; i++) {
            const sp = this._embers[i], d = this._emberData[i];
            d.life += dt / d.maxLife;
            if (d.life >= 1) { Object.assign(d, this._newEmber()); d.life = 0; }
            const p   = d.life;
            const env = p < 0.15 ? p/0.15 : Math.max(0, 1.0-(p-0.15)/0.85);
            const el  = p * d.maxLife;
            sp.position.set(
                wPos.x + d.ox*objR + d.vx*el,
                baseY + d.oy*objH + d.vy*objH*el - 0.5*0.5*el*el, // leve gravidade
                wPos.z + d.oz*objR + d.vz*el,
            );
            const sc = d.size * fxS * env;
            sp.scale.set(sc, sc, 1);
            sp.material.opacity = env * (0.7 + Math.sin(t*20+i)*0.2);
        }

        // ── Fumaça ────────────────────────────────────────────────────────
        for (let i = 0; i < this.SMOKE_COUNT; i++) {
            const sp = this._smokes[i], d = this._smokeData[i];
            d.life += dt / d.maxLife;
            if (d.life >= 1) { Object.assign(d, this._newSmoke()); d.life = 0; }
            const p   = d.life;
            const env = p < 0.2 ? p/0.2 : Math.max(0, 1-(p-0.2)/0.8);
            const ang = d.angle + d.vAngle*p*d.maxLife + this.fxRotation;
            const r   = d.r * objR + d.drift*p;
            sp.position.set(
                wPos.x + Math.cos(ang)*r,
                baseY + (d.yOff + d.vy*p*d.maxLife) * objH * 1.2,
                wPos.z + Math.sin(ang)*r,
            );
            // Expande conforme sobe
            const sc = d.size * fxS * (0.5 + p*1.5);
            sp.scale.set(sc, sc, 1);
            sp.material.opacity = env * 0.28;
        }

        // ── Glow incandescente ────────────────────────────────────────────
        const gf  = 0.75 + Math.sin(t*9)*0.12 + Math.sin(t*17)*0.07;
        const gsc = objR * 2.5 * gf * fxS;
        this._glowCore.position.set(wPos.x, wPos.y, wPos.z);
        this._glowCore.scale.set(gsc, gsc*(1.0+objH/Math.max(objR,0.1)*0.4), 1);
        this._glowCore.material.opacity = 0.65 * gf;

        const gsc2 = objR * 5.0 * gf * fxS;
        this._glowOuter.position.set(wPos.x, wPos.y + objH*0.2, wPos.z);
        this._glowOuter.scale.set(gsc2, gsc2*1.6, 1);
        this._glowOuter.material.opacity = 0.18 * gf;
    }

    dispose() {
        [...this._flames, ...this._embers, ...this._smokes, this._glowCore, this._glowOuter]
            .forEach(sp => { this._scene.remove(sp); sp.material.dispose(); });
    }
}

// ================================================================================
//  ICE EFFECT
// ================================================================================
class IceEffect {
    constructor(target) {
        this.target  = target;
        this.color   = new THREE.Color('#88ccff');
        this.enabled = true;
        this.time    = 0;
        const scene  = window._nexusScene || window.scene;
        this._scene  = scene;
        this.CRYSTAL_COUNT = 18;
        this._crystals = []; this._crystalData = [];
        for (let i = 0; i < this.CRYSTAL_COUNT; i++) {
            const mat = new THREE.SpriteMaterial({ map: TX_ICE, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: this.color.clone() });
            const sp = new THREE.Sprite(mat);
            sp.userData.isFXSprite = true; sp.layers.enable(1); scene.add(sp); this._crystals.push(sp);
            this._crystalData.push({ angle:(i/this.CRYSTAL_COUNT)*Math.PI*2, yOff:Math.random(), orbitR:0.6+Math.random()*0.5, orbitSpd:(0.4+Math.random()*0.6)*(Math.random()<0.5?1:-1), bobSpd:1.2+Math.random()*1.5, bobPhase:Math.random()*Math.PI*2, size:0.12+Math.random()*0.22 });
        }
        this.FLAKE_COUNT = 24;
        this._flakes = []; this._flakeData = [];
        for (let i = 0; i < this.FLAKE_COUNT; i++) {
            const mat = new THREE.SpriteMaterial({ map: TX_SNOWFLAKE, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: this.color.clone() });
            const sp = new THREE.Sprite(mat);
            sp.userData.isFXSprite = true; sp.layers.enable(1); scene.add(sp); this._flakes.push(sp);
            this._flakeData.push(this._newFlake());
        }
        const matC = new THREE.SpriteMaterial({ map: TX_GLOW, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: this.color.clone() });
        this._coreGlow = new THREE.Sprite(matC);
        this._coreGlow.userData.isFXSprite = true; this._coreGlow.layers.enable(1); scene.add(this._coreGlow);
        this.fxOffset = new THREE.Vector3(); this.fxScale = 1; this.fxRotation = 0;
    }
    _newFlake() { return { angle:Math.random()*Math.PI*2, r:0.2+Math.random()*0.9, yOff:Math.random(), vy:0.3+Math.random()*0.8, vAngle:(Math.random()-0.5)*0.8, life:Math.random(), maxLife:0.8+Math.random()*1.2, size:0.05+Math.random()*0.10 }; }
    setColor(hex) { this.color.set(hex); [...this._crystals,...this._flakes,this._coreGlow].forEach(sp=>sp.material.color.set(hex)); }
    update(dt) {
        this.time += dt;
        const all = [...this._crystals,...this._flakes,this._coreGlow];
        if (!this.enabled) { all.forEach(sp=>{sp.material.opacity=0;}); return; }
        let objH=2, objR=0.6;
        try { const box=new THREE.Box3().setFromObject(this.target); const sz=new THREE.Vector3(); box.getSize(sz); objH=sz.y||2; objR=Math.max(sz.x,sz.z)*0.5+0.05; } catch {}
        const wPos=new THREE.Vector3(); this.target.getWorldPosition(wPos); wPos.add(this.fxOffset);
        const fxS=this.fxScale||1; objR*=fxS; objH*=fxS;
        const baseY=wPos.y-objH*0.5;
        for (let i=0;i<this.CRYSTAL_COUNT;i++) {
            const sp=this._crystals[i],d=this._crystalData[i];
            d.angle+=d.orbitSpd*dt;
            const bob=Math.sin(this.time*d.bobSpd+d.bobPhase)*objH*0.18;
            const r=d.orbitR*objR;
            sp.position.set(wPos.x+Math.cos(d.angle+this.fxRotation)*r, baseY+d.yOff*objH+bob, wPos.z+Math.sin(d.angle+this.fxRotation)*r);
            const sc=d.size*fxS; sp.scale.set(sc,sc,1);
            sp.material.opacity=0.55+Math.sin(this.time*2+i)*0.15;
        }
        for (let i=0;i<this.FLAKE_COUNT;i++) {
            const sp=this._flakes[i],d=this._flakeData[i];
            d.life+=dt/d.maxLife;
            if(d.life>=1){Object.assign(d,this._newFlake());d.life=0;}
            const p=d.life,env=Math.sin(p*Math.PI);
            const ang=d.angle+d.vAngle*p*d.maxLife+this.fxRotation;
            sp.position.set(wPos.x+Math.cos(ang)*d.r*objR, baseY+d.yOff*objH+d.vy*objH*p*d.maxLife, wPos.z+Math.sin(ang)*d.r*objR);
            const sc=d.size*fxS; sp.scale.set(sc,sc,1); sp.material.opacity=env*0.75;
        }
        const pulse=0.6+Math.sin(this.time*3)*0.15+Math.sin(this.time*7.5)*0.05;
        const gsc=objR*2.2*pulse;
        this._coreGlow.position.copy(wPos);
        this._coreGlow.scale.set(gsc,gsc*(1+objH/Math.max(objR,0.1)*0.3),1);
        this._coreGlow.material.opacity=0.22*pulse;
    }
    dispose() { [...this._crystals,...this._flakes,this._coreGlow].forEach(sp=>{this._scene.remove(sp);sp.material.dispose();}); }
}

// ================================================================================
//  ELECTRIC BODY EFFECT
// ================================================================================
class ElectricBodyEffect {
    constructor(target) {
        this.target  = target;
        this.color   = new THREE.Color('#44aaff');
        this.enabled = true;
        this.time    = 0;
        const scene  = window._nexusScene || window.scene;
        this._scene  = scene;
        this.ARC_COUNT = 22;
        this._arcs=[]; this._arcData=[];
        for (let i=0;i<this.ARC_COUNT;i++) { this._arcs.push(new Lightning3D(scene,0x44aaff)); this._arcData.push(this._newArc()); }
        this.GLOW_COUNT=16;
        this._glows=[]; this._glowData=[];
        for (let i=0;i<this.GLOW_COUNT;i++) {
            const mat=new THREE.SpriteMaterial({map:TX_ELEC_GLOW,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,color:this.color.clone()});
            const sp=new THREE.Sprite(mat); sp.userData.isFXSprite=true; sp.layers.enable(1); scene.add(sp); this._glows.push(sp);
            this._glowData.push({angle:(i/this.GLOW_COUNT)*Math.PI*2,yOff:Math.random(),r:0.8+Math.random()*0.2,flickerTimer:Math.random()*0.1,opacity:0});
        }
        const matC=new THREE.SpriteMaterial({map:TX_ELEC_GLOW,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,color:this.color.clone()});
        this._core=new THREE.Sprite(matC); this._core.userData.isFXSprite=true; this._core.layers.enable(1); scene.add(this._core);
        this.fxOffset=new THREE.Vector3(); this.fxScale=1; this.fxRotation=0;
    }
    _newArc() {
        const angA=Math.random()*Math.PI*2;
        return { angA, angB:angA+Math.PI*(0.15+Math.random()*1.2), rA:0.85+Math.random()*0.2, rB:0.85+Math.random()*0.2, yA:Math.random(), yB:Math.random(), timer:0.04+Math.random()*0.12, interval:0.04+Math.random()*0.10 };
    }
    setColor(hex) { this._arcs.forEach(a=>a.setColor(hex)); [...this._glows,this._core].forEach(sp=>sp.material.color.set(hex)); }
    update(dt) {
        this.time+=dt;
        if (!this.enabled) {
            [...this._glows,this._core].forEach(sp=>{sp.material.opacity=0;});
            const zero=new THREE.Vector3(); this._arcs.forEach(a=>{a.visible=false;a.update(zero,zero,dt);}); return;
        }
        let objH=2,objR=0.6;
        try { const box=new THREE.Box3().setFromObject(this.target); const sz=new THREE.Vector3(); box.getSize(sz); objH=sz.y||2; objR=Math.max(sz.x,sz.z)*0.5+0.05; } catch {}
        const wPos=new THREE.Vector3(); this.target.getWorldPosition(wPos); wPos.add(this.fxOffset);
        const fxS=this.fxScale||1; objR*=fxS; objH*=fxS;
        const baseY=wPos.y-objH*0.5;
        const A=new THREE.Vector3(),B=new THREE.Vector3();
        for (let i=0;i<this.ARC_COUNT;i++) {
            const arc=this._arcs[i],d=this._arcData[i];
            arc.visible=true; d.timer-=dt;
            if(d.timer<=0) Object.assign(d,this._newArc());
            A.set(wPos.x+Math.cos(d.angA+this.fxRotation)*d.rA*objR, baseY+d.yA*objH, wPos.z+Math.sin(d.angA+this.fxRotation)*d.rA*objR);
            B.set(wPos.x+Math.cos(d.angB+this.fxRotation)*d.rB*objR, baseY+d.yB*objH, wPos.z+Math.sin(d.angB+this.fxRotation)*d.rB*objR);
            arc.update(A,B,dt);
        }
        for (let i=0;i<this.GLOW_COUNT;i++) {
            const sp=this._glows[i],d=this._glowData[i];
            d.flickerTimer-=dt;
            if(d.flickerTimer<=0){d.flickerTimer=0.03+Math.random()*0.07;d.opacity=Math.random()<0.6?(0.3+Math.random()*0.55):0;d.angle=Math.random()*Math.PI*2;d.yOff=Math.random();}
            const r=d.r*objR;
            sp.position.set(wPos.x+Math.cos(d.angle+this.fxRotation)*r,baseY+d.yOff*objH,wPos.z+Math.sin(d.angle+this.fxRotation)*r);
            const sc=0.08*fxS; sp.scale.set(sc,sc,1); sp.material.opacity=d.opacity;
        }
        const cf=0.5+Math.sin(this.time*24)*0.2+Math.sin(this.time*11)*0.1;
        const csc=objR*1.4*cf;
        this._core.position.copy(wPos);
        this._core.scale.set(csc,csc*(1+objH/Math.max(objR,0.1)*0.2),1);
        this._core.material.opacity=0.18*cf;
    }
    dispose() {
        this._arcs.forEach(a=>a.dispose());
        [...this._glows,this._core].forEach(sp=>{this._scene.remove(sp);sp.material.dispose();});
    }
}

// ================================================================================
//  MANAGER — gerencia efeitos por objeto UUID
// ================================================================================
const effectMap = new Map(); // uuid → { trail, deform, glitch, aura }

function getOrCreate(uuid) {
    if (!effectMap.has(uuid)) effectMap.set(uuid, { trail: null, deform: null, glitch: null, aura: null, heat: null, ice: null, electricBody: null });
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
            case 'heat':   entry[type] = new HeatEffect(target);          break;
            case 'ice':    entry[type] = new IceEffect(target);           break;
            case 'electricBody': entry[type] = new ElectricBodyEffect(target); break;
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
    if (entry.heat)   entry.heat.setColor(hex);
    if (entry.ice)    entry.ice.setColor(hex);
    if (entry.electricBody) entry.electricBody.setColor(hex);
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
        if (entry.heat)   entry.heat.update(dt);
        if (entry.ice)    entry.ice.update(dt);
        if (entry.electricBody) entry.electricBody.update(dt);
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
        this._smoothLean   = new THREE.Vector3();
        this._firstFrame   = true;
        this._fallingCount = 0;
        this.fxOffset   = new THREE.Vector3();
        this.fxScale    = 1;
        this.fxRotation = 0;
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
        wPos.add(this.fxOffset);
        const fxS = this.fxScale || 1;
        const fxR = this.fxRotation || 0;
        objR *= fxS; objH *= fxS;
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
            const ang = d.angle + d.vAngle * p * d.maxLife + fxR;
            const r   = Math.max(0, d.r + d.vr * p * d.maxLife);
            const leanScale = p;
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
            const ang = d.angle + d.vAngle * p * d.maxLife + fxR;
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
            const ang = d.angle + d.vAngle * p * d.maxLife + fxR;
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
            const ang = d.angle + d.vAngle * p * d.maxLife + fxR;
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
                wPos.x + Math.cos(d.angA + fxR)*d.rA + lx * 0.5,
                baseY + d.yA,
                wPos.z + Math.sin(d.angA + fxR)*d.rA + lz * 0.5,
            );
            B.set(
                wPos.x + Math.cos(d.angB + fxR)*d.rB + lx * 0.5,
                baseY + d.yB,
                wPos.z + Math.sin(d.angB + fxR)*d.rB + lz * 0.5,
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
                <span class="fx-panel-title">Special Effects</span>
            </h3>
            <button id="fx-edit-mode-btn" class="object-menu-btn" title="Edit effects">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                <span class="fx-edit-label">Edit</span>
            </button>
        </div>

        <div class="special-color-row">
            <label class="fx-color-label">Effect Color</label>
            <input type="color" id="fx-color-picker" value="#ff4400">
        </div>

        <div class="special-fx-grid">
            <button id="fx-trail-btn"  class="special-fx-btn" data-fx="trail">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                <span class="fx-btn-label">Trail</span>
            </button>
            <button id="fx-deform-btn" class="special-fx-btn" data-fx="deform">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                <span class="fx-btn-label">Deform</span>
            </button>
            <button id="fx-glitch-btn" class="special-fx-btn" data-fx="glitch">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                <span class="fx-btn-label">Glitch</span>
            </button>
            <button id="fx-aura-btn"   class="special-fx-btn" data-fx="aura">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                <span class="fx-btn-label">Aura</span>
            </button>
            <button id="fx-heat-btn" class="special-fx-btn" data-fx="heat">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2c0 3-2 4-2 7a6 6 0 0 0 12 0c0-3-2-4-2-7"/><path d="M12 22v-3"/><path d="M8 15c0 2 1 3 4 3s4-1 4-3"/><path d="M12 2c0 3-2 4-2 7"/></svg>
                <span class="fx-btn-label">Heat</span>
            </button>
            <button id="fx-ice-btn"  class="special-fx-btn" data-fx="ice">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 7-8 5-8-5"/><path d="m20 17-8-5-8 5"/><path d="m2 12 10 5 10-5"/></svg>
                <span class="fx-btn-label">Ice</span>
            </button>
            <button id="fx-electricBody-btn" class="special-fx-btn" data-fx="electricBody">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span class="fx-btn-label">Electric</span>
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
            grid-template-columns: repeat(4, 1fr);
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
        .special-fx-btn[data-fx="heat"].active   { border-color: rgba(255,120,0,0.7);   background: rgba(255,90,0,.18);   color:#ff9940; box-shadow:0 0 10px rgba(255,100,0,.3); }
        .special-fx-btn[data-fx="ice"].active    { border-color: rgba(100,200,255,0.7); background: rgba(80,180,255,.15); color:#80d8ff; box-shadow:0 0 10px rgba(80,200,255,.3); }
        .special-fx-btn[data-fx="electricBody"].active { border-color: rgba(120,180,255,0.7); background: rgba(80,140,255,.16); color:#a0c8ff; box-shadow:0 0 10px rgba(100,160,255,.35); }
        #fx-edit-mode-btn { display:flex; align-items:center; gap:4px; font-size:11px; color:var(--text-secondary); }
        #fx-edit-mode-btn:hover { color:var(--text-primary); }
        #fx-edit-mode-btn.fx-on { color:var(--accent); }
        #fx-effects-panel {
            position:fixed; top:62px; right:16px; width:260px; max-height:340px;
            background:var(--bg-panel); color:var(--text-primary);
            border-radius:var(--radius-lg); box-shadow:var(--shadow-panel);
            backdrop-filter:var(--blur); border:1px solid var(--border);
            z-index:250; display:none; flex-direction:column; overflow:hidden;
        }
        body.fx-edit-mode #fx-effects-panel { display:flex; }
        body.fx-edit-mode #objects-panel    { display:none !important; }
        body.fx-edit-mode .special-panel    { display:none !important; }
        #fx-effects-panel .panel-header { padding:11px 14px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; }
        #fx-effects-panel .panel-header h3 { margin:0; font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.05em; }
        #fx-active-list { overflow-y:auto; padding:6px; display:flex; flex-direction:column; gap:3px; min-height:40px; }
        .fx-active-item { display:flex; align-items:center; gap:6px; padding:6px 8px; border-radius:var(--radius-sm); border:1px solid transparent; cursor:pointer; transition:background 0.12s, border-color 0.12s; background:transparent; width:100%; text-align:left; font-family:var(--font-ui); }
        .fx-active-item:hover { background:var(--bg-hover); border-color:var(--border); }
        .fx-active-item.fx-item-sel { color:#7edfff; background:rgba(100,180,255,0.1); font-weight:600; border-color:rgba(100,180,255,0.2); }
        .fx-active-icon { width:14px; height:14px; color:var(--text-dim); flex-shrink:0; }
        .fx-active-name { flex:1; font-size:12px; color:inherit; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .fx-no-active { font-size:11px; color:var(--text-dim); text-align:center; padding:12px 0; }
        body.fx-edit-mode .top-right-toolbar { opacity:0 !important; pointer-events:none !important; }
        body.fx-edit-mode #gizmo-modes       { opacity:1 !important; pointer-events:all !important; }
        #fx-edit-hint { position:fixed; top:14px; left:50%; transform:translateX(-50%); background:var(--bg-panel); border:1px solid var(--border-focus); border-radius:var(--radius-sm); padding:5px 14px; color:var(--accent); font-size:11px; font-family:var(--font-ui); z-index:9998; pointer-events:none; white-space:nowrap; display:none; }
        body.fx-edit-mode #fx-edit-hint { display:block; }
    `;
    document.head.appendChild(s);
}


var FX_I18N = {
    en:     { title:'Special Effects', edit:'Edit', color:'Effect Color', trail:'Trail', deform:'Deform', glitch:'Glitch', aura:'Aura', heat:'Heat', ice:'Ice', electricBody:'Electric', noActive:'No active effects', hint:'Edit Mode - Move, rotate and scale effects', noObj:'Select an object' },
    pt:     { title:'Efeitos Especiais', edit:'Editar', color:'Cor do efeito', trail:'Trilha', deform:'Deformacao', glitch:'Glitch', aura:'Aura', heat:'Calor', ice:'Gelo', electricBody:'Elétrico', noActive:'Nenhum efeito ativo', hint:'Modo Edicao - Mova, rotacione e escale', noObj:'Selecione um objeto' },
    'pt-br':{ title:'Efeitos Especiais', edit:'Editar', color:'Cor do efeito', trail:'Trilha', deform:'Deformacao', glitch:'Glitch', aura:'Aura', heat:'Calor', ice:'Gelo', electricBody:'Elétrico', noActive:'Nenhum efeito ativo', hint:'Modo Edicao - Mova, rotacione e escale', noObj:'Selecione um objeto' },
    es:     { title:'Efectos Especiales', edit:'Editar', color:'Color del efecto', trail:'Estela', deform:'Deformacion', glitch:'Glitch', aura:'Aura', noActive:'Sin efectos activos', hint:'Modo Edicion - Mueve, rota y escala', noObj:'Selecciona un objeto' }
};
function fxT(k) { var l=localStorage.getItem('nexus_lang')||'en'; return (FX_I18N[l]||FX_I18N.en)[k]||k; }
function fxApplyLang() {
    var p=document.getElementById('special-panel'); if(!p) return;
    var el;
    el=p.querySelector('.fx-panel-title');  if(el) el.textContent=fxT('title');
    el=p.querySelector('.fx-edit-label');   if(el) el.textContent=fxT('edit');
    el=p.querySelector('.fx-color-label');  if(el) el.textContent=fxT('color');
    ['trail','deform','glitch','aura','heat','ice','electricBody'].forEach(function(k){ el=p.querySelector('[data-fx="'+k+'"] .fx-btn-label'); if(el) el.textContent=fxT(k); });
    var fp=document.getElementById('fx-effects-panel');
    if(fp){ var th=fp.querySelector('h3 span'); if(th) th.textContent=fxT('title'); }
    var hint=document.getElementById('fx-edit-hint'); if(hint) hint.textContent=fxT('hint');
    fxRefreshActiveList();
}

var _fxEditOn=false, _fxAnchor=null, _fxSnap=null, _fxCB=null, _fxSelType=null;

function _fxActiveEffects(uuid) {
    var e=effectMap.get(uuid); if(!e) return [];
    return ['trail','glitch','aura','heat','ice','electricBody'].map(function(k){return e[k]?{type:k,fx:e[k]}:null;}).filter(Boolean);
}

function fxBuildEffectsPanel() {
    if (document.getElementById('fx-effects-panel')) { fxRefreshActiveList(); return; }
    var fp=document.createElement('div');
    fp.id='fx-effects-panel';
    fp.innerHTML=
        '<div class="panel-header">'+
            '<h3><span>'+fxT('title')+'</span></h3>'+
            '<div style="display:flex;align-items:center;gap:4px">'+
                '<button id="fx-p-cancel" class="object-menu-btn" title="Cancel" style="color:var(--red)"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'+
                '<button id="fx-p-confirm" class="object-menu-btn" title="Confirm" style="color:var(--green)"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>'+
            '</div>'+
        '</div>'+
        '<div id="fx-active-list"></div>';
    document.body.appendChild(fp);
    document.getElementById('fx-p-cancel') .addEventListener('click',function(){_fxLeave(false);});
    document.getElementById('fx-p-confirm').addEventListener('click',function(){_fxLeave(true);});
    fxRefreshActiveList();
}

function fxRefreshActiveList() {
    var c=document.getElementById('fx-active-list'); if(!c) return;
    c.innerHTML='';
    var target=window.activeObject;
    if(!target){c.innerHTML='<div class="fx-no-active">'+fxT('noObj')+'</div>';return;}
    var actives=_fxActiveEffects(target.uuid);
    if(!actives.length){c.innerHTML='<div class="fx-no-active">'+fxT('noActive')+'</div>';return;}
    actives.forEach(function(item){
        var row=document.createElement('button');
        row.className='fx-active-item'+((_fxSelType===item.type)?' fx-item-sel':'');
        row.innerHTML='<svg class="fx-active-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"/></svg><span class="fx-active-name">'+fxT(item.type)+'</span>';
        row.addEventListener('click',function(){
            _fxSelType=item.type;
            fxRefreshActiveList();
            _fxAttachToEffect(item.type);
        });
        c.appendChild(row);
    });
}

function _fxAttachToEffect(type) {
    var target=window.activeObject; if(!target) return;
    var found=_fxActiveEffects(target.uuid).find(function(x){return x.type===type;}); if(!found) return;
    var fx=found.fx;
    if(!fx.fxOffset)       fx.fxOffset=new THREE.Vector3();
    if(fx.fxScale==null)   fx.fxScale=1;
    if(fx.fxRotation==null)fx.fxRotation=0;
    var scene=window._nexusScene, tc=window._nexusTransformControls;
    if(_fxAnchor){scene.remove(_fxAnchor);_fxAnchor=null;}
    if(_fxCB&&tc){tc.removeEventListener('change',_fxCB);_fxCB=null;}
    if(tc) tc.detach();
    _fxAnchor=new THREE.Object3D();
    _fxAnchor.userData.isFXAnchor=true;
    scene.add(_fxAnchor);
    var wp=new THREE.Vector3(); target.getWorldPosition(wp);
    _fxAnchor.position.copy(wp).add(fx.fxOffset);
    _fxAnchor.scale.setScalar(fx.fxScale);
    _fxAnchor.rotation.y=fx.fxRotation;
    if(tc) tc.attach(_fxAnchor);
    _fxCB=function(){
        if(!_fxAnchor||!window.activeObject||!window._fxEditActive) return;
        var wp2=new THREE.Vector3(); window.activeObject.getWorldPosition(wp2);
        var ch=_fxActiveEffects(window.activeObject.uuid).find(function(x){return x.type===_fxSelType;}); if(!ch) return;
        ch.fx.fxOffset.copy(_fxAnchor.position.clone().sub(wp2));
        ch.fx.fxScale=Math.max(0.05,_fxAnchor.scale.x);
        ch.fx.fxRotation=_fxAnchor.rotation.y;
    };
    if(tc) tc.addEventListener('change',_fxCB);
}

function _fxEnter() {
    var target=window.activeObject;
    if(!target){flashSpecial(fxT('noObj'));return;}
    var all=_fxActiveEffects(target.uuid);
    if(!all.length){flashSpecial(fxT('noActive'));return;}
    _fxEditOn=true; window._fxEditActive=true;
    _fxSnap={};
    all.forEach(function(item){
        var fx=item.fx;
        if(!fx.fxOffset)       fx.fxOffset=new THREE.Vector3();
        if(fx.fxScale==null)   fx.fxScale=1;
        if(fx.fxRotation==null)fx.fxRotation=0;
        _fxSnap[item.type]={ox:fx.fxOffset.x,oy:fx.fxOffset.y,oz:fx.fxOffset.z,sc:fx.fxScale,ro:fx.fxRotation};
    });
    var orbit=window._nexusOrbitControls; if(orbit) orbit.enabled=false;
    if(!_fxSelType||!all.find(function(x){return x.type===_fxSelType;})) _fxSelType=all[0].type;
    fxBuildEffectsPanel();
    _fxAttachToEffect(_fxSelType);
    document.body.classList.add('fx-edit-mode');
    var btn=document.getElementById('fx-edit-mode-btn'); if(btn) btn.classList.add('fx-on');
    var hint=document.getElementById('fx-edit-hint');
    if(!hint){hint=document.createElement('div');hint.id='fx-edit-hint';document.body.appendChild(hint);}
    hint.textContent=fxT('hint');
}

function _fxLeave(save) {
    if(!_fxEditOn) return;
    var target=window.activeObject, tc=window._nexusTransformControls, orbit=window._nexusOrbitControls, scene=window._nexusScene;
    if(_fxCB&&tc){tc.removeEventListener('change',_fxCB);_fxCB=null;}
    if(_fxAnchor){scene.remove(_fxAnchor);_fxAnchor=null;}
    if(!save&&target&&_fxSnap){
        _fxActiveEffects(target.uuid).forEach(function(item){
            var s=_fxSnap[item.type]; if(!s) return;
            if(!item.fx.fxOffset) item.fx.fxOffset=new THREE.Vector3();
            item.fx.fxOffset.set(s.ox,s.oy,s.oz);
            item.fx.fxScale=s.sc; item.fx.fxRotation=s.ro;
        });
    }
    if(tc){if(target){tc.attach(target);}else{tc.detach();}}
    if(orbit) orbit.enabled=true;
    _fxEditOn=false; _fxSnap=null; window._fxEditActive=false;
    document.body.classList.remove('fx-edit-mode');
    var btn=document.getElementById('fx-edit-mode-btn'); if(btn) btn.classList.remove('fx-on');
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
            if (typeof fxRefreshActiveList === 'function') fxRefreshActiveList();
        });
    });

    document.getElementById('fx-color-picker')?.addEventListener('input', (e) => {
        const target = window.activeObject;
        if (!target) return;
        setEffectColor(e.target.value, target.uuid);
    });

    var _eb=document.getElementById('fx-edit-mode-btn');
    if(_eb) _eb.addEventListener('click',function(e){ e.stopPropagation(); _fxEditOn?_fxLeave(false):_fxEnter(); });

    setTimeout(function(){
        if(window.i18n&&window.i18n.apply){ var _o=window.i18n.apply; window.i18n.apply=function(lang){_o(lang);fxApplyLang();}; }
        fxApplyLang();
    },300);
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
    const types = ['trail', 'deform', 'glitch', 'aura', 'heat', 'ice', 'electricBody'];
    types.forEach(t => {
        const btn = document.getElementById(`fx-${t}-btn`);
        if (btn) btn.classList.toggle('active', hasEffect(t, uuid));
    });
    if (typeof fxRefreshActiveList === 'function') fxRefreshActiveList();
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

console.log('special_fx.js loaded OK');
