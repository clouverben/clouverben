// ==================== EXPLOSION.JS ====================
// Sistema de explosão estilo Skibidi Toilet — energético, cartoony, impactante
// Criado com: fireball, shockwave, debris, sparks, smoke, flash

import * as THREE from 'three';

// ── Helpers de textura ────────────────────────────────────────────────────────
function cv(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').clearRect(0, 0, w, h);
    return c;
}

function txFireball() {
    const S = 128, c = cv(S, S), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S/2,S/2,0, S/2,S/2,S/2);
    g.addColorStop(0.00, 'rgba(255,255,255,1)');
    g.addColorStop(0.15, 'rgba(255,255,200,1)');
    g.addColorStop(0.35, 'rgba(255,200,50,0.9)');
    g.addColorStop(0.60, 'rgba(255,100,10,0.65)');
    g.addColorStop(0.80, 'rgba(200,30,0,0.3)');
    g.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,S,S);
    return new THREE.CanvasTexture(c);
}

function txShockwave() {
    const S = 256, c = cv(S, S), ctx = c.getContext('2d');
    ctx.beginPath(); ctx.arc(S/2,S/2, S/2-6, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,200,80,0.9)'; ctx.lineWidth = 10; ctx.stroke();
    ctx.beginPath(); ctx.arc(S/2,S/2, S/2-18, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,140,30,0.5)'; ctx.lineWidth = 6; ctx.stroke();
    return new THREE.CanvasTexture(c);
}

function txDebris() {
    const S = 24, c = cv(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(220,160,60,0.9)';
    ctx.fillRect(2,2,S-4,S-4);
    ctx.fillStyle = 'rgba(255,220,100,0.6)';
    ctx.fillRect(4,4,8,8);
    return new THREE.CanvasTexture(c);
}

function txSpark() {
    const W=8,H=32, c=cv(W,H), ctx=c.getContext('2d');
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3,'rgba(255,220,60,0.9)');
    g.addColorStop(0.7,'rgba(255,80,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    return new THREE.CanvasTexture(c);
}

function txSmoke() {
    const S=128, c=cv(S,S), ctx=c.getContext('2d');
    const g = ctx.createRadialGradient(S/2,S/2,0, S/2,S/2,S/2);
    g.addColorStop(0.00, 'rgba(80,60,40,0.85)');
    g.addColorStop(0.45, 'rgba(55,42,28,0.5)');
    g.addColorStop(0.80, 'rgba(28,20,12,0.18)');
    g.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,S,S);
    // ruído
    const id = ctx.getImageData(0,0,S,S), d = id.data;
    for (let i=0;i<d.length;i+=4) {
        if (d[i+3]<5) continue;
        const n = 0.78 + Math.random()*.44;
        d[i]*=n; d[i+1]*=n; d[i+2]*=n;
    }
    ctx.putImageData(id,0,0);
    return new THREE.CanvasTexture(c);
}

// ================================================================================
//  ExplosionSystem
// ================================================================================
class ExplosionSystem extends THREE.Object3D {
    constructor(opts = {}) {
        super();
        this.name             = 'Explosão ' + (++window.explosionCounter);
        this.userData.isParticle   = true;
        this.userData.particleType = 'explosion';

        this.color   = opts.color   || '#ff6600';
        this._tint   = new THREE.Color(this.color);
        this.scale2  = opts.scale   || 1;

        // Durações e estado
        this._time   = 0;
        this._done   = false;
        this._flashT = 0;

        // Texturas
        const TFB = txFireball();
        const TSW = txShockwave();
        const TDB = txDebris();
        const TSP = txSpark();
        const TSM = txSmoke();

        // ── Flash inicial (sprite único gigante) ──────────────────────
        const flashMat = new THREE.SpriteMaterial({
            map: TFB, blending: THREE.AdditiveBlending,
            depthWrite: false, transparent: true,
            color: new THREE.Color(1,1,1),
        });
        this._flash = new THREE.Sprite(flashMat);
        this._flash.layers.enable(1);
        this.add(this._flash);

        // ── Fireball pool ────────────────────────────────────────────
        this._fbP  = this._makePool(18, TFB, THREE.AdditiveBlending);

        // ── Shockwave (sprite anel que expande) ───────────────────────
        const swMat = new THREE.SpriteMaterial({
            map: TSW, blending: THREE.AdditiveBlending,
            depthWrite: false, transparent: true,
            color: new THREE.Color(1,.7,.2),
        });
        this._shockwave = new THREE.Sprite(swMat);
        this._shockwave.layers.enable(1);
        this.add(this._shockwave);

        // ── Debris pool ───────────────────────────────────────────────
        this._dbP  = this._makePool(25, TDB, THREE.AdditiveBlending);

        // ── Spark pool ────────────────────────────────────────────────
        this._spkP = this._makePool(40, TSP, THREE.AdditiveBlending);

        // ── Smoke pool ────────────────────────────────────────────────
        this._smkP = this._makePool(16, TSM, THREE.NormalBlending);

        // Esfera de seleção
        const pick = new THREE.Mesh(
            new THREE.SphereGeometry(1.5,8,8),
            new THREE.MeshBasicMaterial({ colorWrite:false, depthWrite:false })
        );
        pick.position.y = 1; pick.layers.set(31); this.add(pick);

        this._lastMs = null;  // tempo manual — evita clock bugado ao re-entrar na cena
        this._spawn();
    }

    _makePool(count, tex, blending) {
        const sprites = [], data = [];
        for (let i = 0; i < count; i++) {
            const mat = new THREE.SpriteMaterial({
                map: tex, blending,
                depthWrite: false, transparent: true,
                color: new THREE.Color(1,1,1),
            });
            const sp = new THREE.Sprite(mat);
            sp.layers.enable(1);
            this.add(sp);
            sprites.push(sp);
            data.push({
                life:0, maxLife:1,
                vel: new THREE.Vector3(),
                rot:0, rotSpeed:0,
                active:false, scale:1,
                gravity:0,
            });
        }
        return { sprites, data };
    }

    _spawn() {
        const s = this.scale2;

        // Flash
        const fc = this._flash.scale;
        fc.set(s*7, s*7, 1);
        this._flash.material.opacity = 1;
        this._flashT = 0;

        // Shockwave
        this._shockwave.scale.set(0.1,0.1,1);
        this._shockwave.material.opacity = 0.9;
        this._shockwave.position.set(0,0.1,0);

        // Fireball
        for (let i=0;i<this._fbP.data.length;i++) {
            const d  = this._fbP.data[i], sp = this._fbP.sprites[i];
            const a  = Math.random()*Math.PI*2;
            const el = (Math.random()-.5)*Math.PI*.8;
            const spd = (2+Math.random()*4.5)*s;
            d.vel.set(Math.cos(el)*Math.cos(a)*spd, Math.sin(el)*spd*0.9, Math.cos(el)*Math.sin(a)*spd);
            d.scale   = (1.2+Math.random()*2.0)*s;
            d.maxLife = 0.5+Math.random()*.55;
            d.life    = 0; d.active = true;
            sp.position.set(0, s*.3, 0);
        }

        // Debris
        for (let i=0;i<this._dbP.data.length;i++) {
            const d  = this._dbP.data[i], sp = this._dbP.sprites[i];
            const a  = Math.random()*Math.PI*2;
            const spd = (3+Math.random()*9)*s;
            d.vel.set(Math.cos(a)*spd, (1+Math.random()*4)*s, Math.sin(a)*spd);
            d.gravity  = (6+Math.random()*4)*s;
            d.scale    = (0.15+Math.random()*.25)*s;
            d.maxLife  = 0.9+Math.random()*.5;
            d.rotSpeed = (Math.random()-.5)*12;
            d.rot      = Math.random()*Math.PI*2;
            d.life = 0; d.active = true;
            sp.position.set((Math.random()-.5)*s*.4, s*.1, (Math.random()-.5)*s*.4);
        }

        // Sparks
        for (let i=0;i<this._spkP.data.length;i++) {
            const d  = this._spkP.data[i], sp = this._spkP.sprites[i];
            const a  = Math.random()*Math.PI*2;
            const el = -Math.PI*.15 + Math.random()*Math.PI*.5;
            const spd = (5+Math.random()*12)*s;
            d.vel.set(Math.cos(el)*Math.cos(a)*spd, Math.sin(el)*spd+2*s, Math.cos(el)*Math.sin(a)*spd);
            d.gravity  = (9+Math.random()*5)*s;
            d.scale    = (0.12+Math.random()*.18)*s;
            d.maxLife  = 0.4+Math.random()*.4;
            d.rotSpeed = (Math.random()-.5)*8;
            d.rot      = Math.random()*Math.PI*2;
            d.life = 0; d.active = true;
            sp.position.set(0,0.1*s,0);
        }

        // Smoke
        for (let i=0;i<this._smkP.data.length;i++) {
            const d  = this._smkP.data[i], sp = this._smkP.sprites[i];
            const a  = Math.random()*Math.PI*2, r = (Math.random()*.5)*s;
            d.vel.set(Math.cos(a)*r*0.8, (0.5+Math.random()*1.5)*s, Math.sin(a)*r*0.8);
            d.scale   = (0.6+Math.random()*1.0)*s;
            d.maxLife = 1.2+Math.random()*.8;
            d.rotSpeed= (Math.random()-.5)*.6;
            d.rot     = Math.random()*Math.PI*2;
            d.life    = 0; d.active = true;
            sp.position.set(Math.cos(a)*r*0.3, s*.2, Math.sin(a)*r*0.3);
        }
    }

    update() {
        // ── Modo baked: aplica frame da timeline diretamente ──────────
        if (this._bakedFrames?.length) {
            const tlFrame    = window.AnimationSystem?.getFrame() ?? 0;
            const localFrame = Math.floor((tlFrame - (this._bakedTLStart || 0)) * (this._bakedFPS || 24) / (window.AnimationSystem?.getFPS?.() || 24));
            this._applyBakedFrame(localFrame);
            return; // NÃO simula — apenas exibe
        }

        if (this._done) return;
        const nowMs = performance.now();
        if (this._lastMs === null) { this._lastMs = nowMs; return; } // primeiro frame após (re)spawn — ignora
        const raw = (nowMs - this._lastMs) / 1000;
        this._lastMs = nowMs;
        const dt  = Math.min(raw, 0.06);
        this._time += dt;

        // ── Flash ──────────────────────────────────────────────────
        this._flashT += dt;
        const flashDur = 0.12;
        if (this._flashT < flashDur) {
            this._flash.material.opacity = 1 - this._flashT/flashDur;
            const fs = this.scale2 * (7 + this._flashT/flashDur*6);
            this._flash.scale.set(fs, fs, 1);
        } else {
            this._flash.material.opacity = 0;
        }

        // ── Shockwave ─────────────────────────────────────────────
        const swT = this._time, swDur = 0.55;
        if (swT < swDur) {
            const prog = swT/swDur;
            const sw   = this.scale2 * (0.5 + prog*18);
            this._shockwave.scale.set(sw, sw*.18, 1);
            this._shockwave.material.opacity = (1-prog)*.75;
        } else {
            this._shockwave.material.opacity = 0;
        }

        // ── Fireball ──────────────────────────────────────────────
        this._updatePool(this._fbP, dt, (sp,d) => {
            d.vel.y -= dt * 1.5 * this.scale2;
            sp.position.addScaledVector(d.vel, dt);
            const env = Math.sin(d.life * Math.PI);
            const sc  = d.scale * (.55 + env*.75);
            sp.scale.set(sc, sc, 1);
            sp.material.opacity = env * .7;
            const fd = Math.max(0, 1-d.life*.75);
            const t  = this._tint;
            sp.material.color.setRGB(t.r*(1+.3*(1-d.life)),t.g*fd,t.b*fd*0.5);
        });

        // ── Debris ────────────────────────────────────────────────
        this._updatePool(this._dbP, dt, (sp,d) => {
            d.vel.y -= d.gravity * dt;
            sp.position.addScaledVector(d.vel, dt);
            if (sp.position.y < 0) { sp.position.y = 0; d.vel.y *= -0.28; d.vel.x *= .65; d.vel.z *= .65; }
            d.rot += d.rotSpeed * dt;
            sp.material.rotation = d.rot;
            const sc = d.scale;
            sp.scale.set(sc, sc, 1);
            sp.material.opacity = (1-d.life) * .85;
            const fd = Math.max(0, 1-d.life*.6);
            const t  = this._tint;
            sp.material.color.setRGB(t.r*fd+.2, t.g*fd*.6+.05, t.b*fd*.1);
        });

        // ── Sparks ────────────────────────────────────────────────
        this._updatePool(this._spkP, dt, (sp,d) => {
            d.vel.y -= d.gravity * dt;
            sp.position.addScaledVector(d.vel, dt);
            if (sp.position.y < 0) { sp.position.y = 0; d.vel.multiplyScalar(.12); }
            d.rot += d.rotSpeed * dt;
            sp.material.rotation = d.rot;
            const sc = d.scale * (1-d.life*.3);
            sp.scale.set(sc, sc*2.5, 1);
            sp.material.opacity = (1-d.life)*.9;
            const heat = Math.max(0, 1-d.life*.9);
            sp.material.color.setRGB(1, heat*.85+.05, heat*.2);
        });

        // ── Smoke ─────────────────────────────────────────────────
        this._updatePool(this._smkP, dt, (sp,d) => {
            sp.position.addScaledVector(d.vel, dt);
            d.vel.x += (Math.random()-.5)*.04*dt;
            d.vel.z += (Math.random()-.5)*.04*dt;
            d.rot += d.rotSpeed * dt;
            sp.material.rotation = d.rot;
            const sc = d.scale * (1 + d.life*2.8);
            sp.scale.set(sc, sc, 1);
            const alpha = d.life < .12 ? (d.life/.12)*.38 : (1-(d.life-.12)/.88)*.38;
            sp.material.opacity = alpha;
            const heat = Math.max(0, 1-d.life*2); 
            const fd = heat*.4;
            const t  = this._tint;
            sp.material.color.setRGB(t.r*fd, t.g*fd*.5, t.b*fd*.1);
        });

        // Checa se tudo morreu
        const allDead = [this._fbP, this._dbP, this._spkP, this._smkP]
            .every(p => p.data.every(d => !d.active));
        if (allDead && this._time > 2.0) this._done = true;
    }

    _updatePool(pool, dt, fn) {
        for (let i=0; i<pool.data.length; i++) {
            const d = pool.data[i], sp = pool.sprites[i];
            if (!d.active) { sp.material.opacity = 0; continue; }
            d.life += dt / d.maxLife;
            if (d.life >= 1) { d.active = false; sp.material.opacity = 0; continue; }
            fn(sp, d);
        }
    }

    // Reinicia a explosão completamente do zero — usado pelo sistema de frame spawn
    reset() {
        this._time   = 0;
        this._flashT = 0;
        this._done   = false;
        this._lastMs = null; // faz o update() descartar o primeiro delta gigante

        // Reseta posições de todos os sprites filhos para a origem do objeto
        // (sem isso ficam espalhados de onde pararam na última jogada)
        [this._fbP, this._dbP, this._spkP, this._smkP].forEach(pool => {
            pool.sprites.forEach(sp => {
                sp.position.set(0, 0, 0);
                sp.scale.set(0.001, 0.001, 1);
                sp.material.opacity = 0;
            });
            pool.data.forEach(d => {
                d.life   = 0;
                d.active = false;
            });
        });

        // Flash e shockwave invisíveis
        this._flash.material.opacity     = 0;
        this._shockwave.material.opacity  = 0;

        // Re-spawna tudo
        this._spawn();
    }

    // =========================================================================
    //  BAKE — grava toda a animação frame a frame em memória
    //  Permite pausar, scrubbar e renderizar a explosão com qualidade
    // =========================================================================

    /**
     * Simula a explosão com dt fixo e grava o estado visual de cada sprite.
     * Depois disso, update() apenas aplica o frame baked correspondente
     * ao frame atual da timeline — nunca simula em tempo real de novo.
     *
     * @param {number} fps          — taxa de captura (ex: 24)
     * @param {number} duration     — duração em segundos (ex: 2.5)
     * @param {number} tlStartFrame — frame da timeline onde a explosão começa
     */
    bake(fps = 24, duration = 2.5, tlStartFrame = 0) {
        const dt          = 1 / fps;
        const totalFrames = Math.ceil(duration * fps);

        // Reseta e spawna para a simulação começar do zero
        this._time   = 0;
        this._flashT = 0;
        this._done   = false;
        this._lastMs = null;
        this._bakedFrames = null; // desativa bake durante a simulação

        this._spawn();

        const allSprites = [
            this._flash,
            this._shockwave,
            ...this._fbP.sprites,
            ...this._dbP.sprites,
            ...this._spkP.sprites,
            ...this._smkP.sprites,
        ];

        const frames = [];
        for (let f = 0; f < totalFrames; f++) {
            this._stepSim(dt);
            // Captura estado compacto de cada sprite
            frames.push(allSprites.map(sp => [
                sp.position.x, sp.position.y, sp.position.z,
                sp.scale.x, sp.scale.y,
                sp.material.opacity,
                sp.material.rotation || 0,
                sp.material.color.r, sp.material.color.g, sp.material.color.b,
            ]));
        }

        this._bakedFrames    = frames;
        this._bakedFPS       = fps;
        this._bakedDuration  = duration;
        this._bakedTLStart   = tlStartFrame;

        // Exibe o primeiro frame imediatamente
        this._applyBakedFrame(0);

        console.log(`💥 Bake OK: ${frames.length} frames @ ${fps}fps (${duration}s) — início no frame ${tlStartFrame}`);
        return frames.length;
    }

    /** Um passo da simulação determinística com dt fixo — espelha a lógica do update() */
    _stepSim(dt) {
        this._time   += dt;
        this._flashT += dt;

        const flashDur = 0.12;
        if (this._flashT < flashDur) {
            const p = this._flashT / flashDur;
            this._flash.material.opacity = 1 - p;
            const fs = this.scale2 * (7 + p * 6);
            this._flash.scale.set(fs, fs, 1);
        } else {
            this._flash.material.opacity = 0;
        }

        const swT = this._time, swDur = 0.55;
        if (swT < swDur) {
            const prog = swT / swDur;
            const sw   = this.scale2 * (0.5 + prog * 18);
            this._shockwave.scale.set(sw, sw * .18, 1);
            this._shockwave.material.opacity = (1 - prog) * .75;
        } else {
            this._shockwave.material.opacity = 0;
        }

        this._updatePool(this._fbP, dt, (sp, d) => {
            d.vel.y -= dt * 1.5 * this.scale2;
            sp.position.addScaledVector(d.vel, dt);
            const env = Math.sin(d.life * Math.PI);
            const sc  = d.scale * (.55 + env * .75);
            sp.scale.set(sc, sc, 1);
            sp.material.opacity = env * .7;
            const fd = Math.max(0, 1 - d.life * .75);
            const t  = this._tint;
            sp.material.color.setRGB(t.r * (1 + .3 * (1 - d.life)), t.g * fd, t.b * fd * 0.5);
        });
        this._updatePool(this._dbP, dt, (sp, d) => {
            d.vel.y -= d.gravity * dt;
            sp.position.addScaledVector(d.vel, dt);
            if (sp.position.y < 0) { sp.position.y = 0; d.vel.y *= -0.28; d.vel.x *= .65; d.vel.z *= .65; }
            d.rot += d.rotSpeed * dt;
            sp.material.rotation = d.rot;
            sp.scale.set(d.scale, d.scale, 1);
            sp.material.opacity = (1 - d.life) * .85;
            const fd = Math.max(0, 1 - d.life * .6);
            const t  = this._tint;
            sp.material.color.setRGB(t.r * fd + .2, t.g * fd * .6 + .05, t.b * fd * .1);
        });
        this._updatePool(this._spkP, dt, (sp, d) => {
            d.vel.y -= d.gravity * dt;
            sp.position.addScaledVector(d.vel, dt);
            if (sp.position.y < 0) { sp.position.y = 0; d.vel.multiplyScalar(.12); }
            d.rot += d.rotSpeed * dt;
            sp.material.rotation = d.rot;
            const sc = d.scale * (1 - d.life * .3);
            sp.scale.set(sc, sc * 2.5, 1);
            sp.material.opacity = (1 - d.life) * .9;
            const heat = Math.max(0, 1 - d.life * .9);
            sp.material.color.setRGB(1, heat * .85 + .05, heat * .2);
        });
        this._updatePool(this._smkP, dt, (sp, d) => {
            sp.position.addScaledVector(d.vel, dt);
            d.vel.x += (Math.random() - .5) * .04 * dt;
            d.vel.z += (Math.random() - .5) * .04 * dt;
            d.rot += d.rotSpeed * dt;
            sp.material.rotation = d.rot;
            const sc = d.scale * (1 + d.life * 2.8);
            sp.scale.set(sc, sc, 1);
            const alpha = d.life < .12 ? (d.life / .12) * .38 : (1 - (d.life - .12) / .88) * .38;
            sp.material.opacity = alpha;
            const heat = Math.max(0, 1 - d.life * 2);
            const fd   = heat * .4;
            const t    = this._tint;
            sp.material.color.setRGB(t.r * fd, t.g * fd * .5, t.b * fd * .1);
        });
    }

    /** Aplica um frame gravado diretamente nos sprites sem simulação */
    _applyBakedFrame(localFrame) {
        if (!this._bakedFrames) return;
        const fi = Math.max(0, Math.min(localFrame, this._bakedFrames.length - 1));
        const snap = this._bakedFrames[fi];
        if (!snap) return;

        const allSprites = [
            this._flash, this._shockwave,
            ...this._fbP.sprites,
            ...this._dbP.sprites,
            ...this._spkP.sprites,
            ...this._smkP.sprites,
        ];
        snap.forEach((s, i) => {
            const sp = allSprites[i];
            if (!sp) return;
            sp.position.set(s[0], s[1], s[2]);
            sp.scale.set(s[3], s[4], 1);
            sp.material.opacity  = s[5];
            sp.material.rotation = s[6];
            sp.material.color.setRGB(s[7], s[8], s[9]);
        });
    }

    clearBake() {
        this._bakedFrames  = null;
        this._bakedFPS     = 24;
        this._bakedDuration = 2.5;
        this._bakedTLStart = 0;
    }

    get isBaked() { return !!(this._bakedFrames?.length); }

    isDone() { return this._done; }

    // API pública de cor
    setColor(hex) { this.color = hex; this._tint.set(hex); }
}

// ── Registro global ──────────────────────────────────────────────────────────
window.explosionCounter  = window.explosionCounter || 0;
window.ExplosionSystem   = ExplosionSystem;
window.createExplosion   = (opts) => new ExplosionSystem(opts);

console.log('💥 explosion.js — Skibidi Toilet style, com fireball, shockwave, debris, sparks, smoke ✅');
