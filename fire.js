import * as THREE from 'three';

// =========================================================================
//  FireParticleSystem — SFM style
//  ✓ Animação 1.4× velocidade
//  ✓ Rastro: partículas ficam no espaço mundial ao mover
//  ✓ Cor padrão amarela (#ffcc00) — preset do painel
//  ✓ setColor / setBrightness / setOpacity funcionais
//  ✓ Bloom via layer 1
// =========================================================================

const _TMP = new THREE.Vector3();

class FireParticleSystem extends THREE.Object3D {
    constructor() {
        super();
        this.name = 'Fogo ' + (++window.fireCounter || 1);
        this.userData.isParticle   = true;
        this.userData.particleType = 'fire';

        // ── Parâmetros do painel ──────────────────────────────────────────
        this.flameHeight   = 4.5;
        this.baseWidth     = 1.3;
        this.particleColor = '#ffcc00';   // ← AMARELO (preset padrão)
        this.brightness    = 1.0;
        this.opacity       = 1.0;

        this._tint = new THREE.Color(this.particleColor);

        // ── Contagens ────────────────────────────────────────────────────
        this.CORE_COUNT  = 40;
        this.BODY_COUNT  = 200;
        this.WISP_COUNT  = 80;
        this.EMBER_COUNT = 50;
        this.SMOKE_COUNT = 60;
        this.TRAIL_COUNT = 120;   // rastro

        this.time     = 0;
        this._wPos    = new THREE.Vector3();   // posição mundial atual
        this._lastWPos = new THREE.Vector3();  // posição mundial anterior
        this._sysVel  = new THREE.Vector3();   // velocidade do sistema
        this.drag     = 0.08;

        // ── Texturas ─────────────────────────────────────────────────────
        this.txCore  = this._txCore();
        this.txBody  = this._txBody();
        this.txWisp  = this._txWisp();
        this.txEmber = this._txEmber();
        this.txSmoke = this._txSmoke();

        // ── Pools ────────────────────────────────────────────────────────
        this.coreP  = this._pool(this.CORE_COUNT,  this.txCore,  THREE.AdditiveBlending);
        this.bodyP  = this._pool(this.BODY_COUNT,  this.txBody,  THREE.AdditiveBlending);
        this.wispP  = this._pool(this.WISP_COUNT,  this.txWisp,  THREE.AdditiveBlending);
        this.emberP = this._pool(this.EMBER_COUNT, this.txEmber, THREE.AdditiveBlending);
        this.smokeP = this._pool(this.SMOKE_COUNT, this.txSmoke, THREE.NormalBlending);

        // Pool de rastro — posição em espaço MUNDIAL convertida para local a cada frame
        this.trailP = this._pool(this.TRAIL_COUNT, this.txBody, THREE.AdditiveBlending);

        this._staggerAll();

        // Esfera de seleção (raycaster, invisível)
        const pick = new THREE.Mesh(
            new THREE.SphereGeometry(1.8, 8, 8),
            new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
        );
        pick.position.set(0, 1.8, 0);
        pick.layers.set(31);
        this.add(pick);

        this.clock = new THREE.Clock();
    }

    // ======================================================================
    //  TEXTURAS — paleta âmbar/amarelo → laranja → vermelho, sem branco
    // ======================================================================

    _txCore() {
        const S = 128, cv = this._cv(S, S), ctx = cv.getContext('2d');
        const g = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
        g.addColorStop(0.00, 'rgba(255,255,255,1.00)');
        g.addColorStop(0.20, 'rgba(255,255,255,0.92)');
        g.addColorStop(0.45, 'rgba(220,220,220,0.70)');
        g.addColorStop(0.70, 'rgba(150,150,150,0.35)');
        g.addColorStop(0.88, 'rgba( 80, 80, 80,0.10)');
        g.addColorStop(1.00, 'rgba(  0,  0,  0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
        this._noise(ctx, S, S, 0.10);
        return new THREE.CanvasTexture(cv);
    }

    _txBody() {
        const W = 160, H = 200, cv = this._cv(W, H), ctx = cv.getContext('2d');
        const cx = W/2, cy = H * 0.56;
        const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.55);
        g1.addColorStop(0.00, 'rgba(255,255,255,1.00)');
        g1.addColorStop(0.28, 'rgba(255,255,255,0.88)');
        g1.addColorStop(0.55, 'rgba(200,200,200,0.58)');
        g1.addColorStop(0.80, 'rgba(120,120,120,0.22)');
        g1.addColorStop(1.00, 'rgba(  0,  0,  0,0)');
        ctx.fillStyle = g1;
        ctx.beginPath(); ctx.ellipse(cx, cy, W*.50, H*.46, 0, 0, Math.PI*2); ctx.fill();
        const g2 = ctx.createRadialGradient(cx, cy+12, 0, cx, cy+12, W*0.26);
        g2.addColorStop(0.00, 'rgba(255,255,255,1.00)');
        g2.addColorStop(0.45, 'rgba(255,255,255,0.82)');
        g2.addColorStop(0.85, 'rgba(200,200,200,0.35)');
        g2.addColorStop(1.00, 'rgba(  0,  0,  0,0)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.ellipse(cx, cy+12, W*.23, H*.27, 0, 0, Math.PI*2); ctx.fill();
        this._noise(ctx, W, H, 0.16);
        return new THREE.CanvasTexture(cv);
    }

    _txWisp() {
        const W = 80, H = 200, cv = this._cv(W, H), ctx = cv.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(W*.50, H*.004);
        ctx.bezierCurveTo(W*.80, H*.14, W*.88, H*.42, W*.80, H*.65);
        ctx.bezierCurveTo(W*.72, H*.86, W*.62, H*.97, W*.50, H*.99);
        ctx.bezierCurveTo(W*.38, H*.97, W*.28, H*.86, W*.20, H*.65);
        ctx.bezierCurveTo(W*.12, H*.42, W*.20, H*.14, W*.50, H*.004);
        ctx.closePath();
        const g = ctx.createLinearGradient(W/2, H*.004, W/2, H*.99);
        g.addColorStop(0.00, 'rgba(255,255,255,0)');
        g.addColorStop(0.07, 'rgba(255,255,255,0.55)');
        g.addColorStop(0.30, 'rgba(220,220,220,0.88)');
        g.addColorStop(0.62, 'rgba(170,170,170,0.75)');
        g.addColorStop(0.85, 'rgba(100,100,100,0.40)');
        g.addColorStop(1.00, 'rgba(  0,  0,  0,0)');
        ctx.fillStyle = g; ctx.fill();
        this._noise(ctx, W, H, 0.14);
        return new THREE.CanvasTexture(cv);
    }

    _txEmber() {
        const S = 32, cv = this._cv(S, S), ctx = cv.getContext('2d');
        const g = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
        g.addColorStop(0.00, 'rgba(255,255,255,1.00)');
        g.addColorStop(0.30, 'rgba(255,255,255,0.88)');
        g.addColorStop(0.62, 'rgba(180,180,180,0.48)');
        g.addColorStop(0.88, 'rgba( 80, 80, 80,0.14)');
        g.addColorStop(1.00, 'rgba(  0,  0,  0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
        return new THREE.CanvasTexture(cv);
    }

    _txSmoke() {
        const S = 128, cv = this._cv(S, S), ctx = cv.getContext('2d');
        const g = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
        g.addColorStop(0.00, 'rgba(62,50,40,0.82)');
        g.addColorStop(0.40, 'rgba(48,38,30,0.58)');
        g.addColorStop(0.70, 'rgba(32,25,20,0.26)');
        g.addColorStop(0.90, 'rgba(16,12, 8,0.08)');
        g.addColorStop(1.00, 'rgba( 0, 0, 0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
        this._noise(ctx, S, S, 0.28);
        return new THREE.CanvasTexture(cv);
    }

    _cv(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').clearRect(0, 0, w, h);
        return c;
    }

    _noise(ctx, w, h, amt) {
        const id = ctx.getImageData(0, 0, w, h), d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i+3] < 5) continue;
            const n = 1 - amt*.5 + Math.random()*amt;
            d[i]   = Math.min(255, d[i]  *n);
            d[i+1] = Math.min(255, d[i+1]*n);
            d[i+2] = Math.min(255, d[i+2]*n);
        }
        ctx.putImageData(id, 0, 0);
    }

    // ======================================================================
    //  POOL
    // ======================================================================

    _pool(count, tex, blending) {
        const sprites = [], data = [];
        for (let i = 0; i < count; i++) {
            const mat = new THREE.SpriteMaterial({
                map: tex, blending,
                depthWrite: false, transparent: true,
                color: new THREE.Color(1, 1, 1),
            });
            const sp = new THREE.Sprite(mat);
            sp.layers.enable(1); // bloom
            this.add(sp);
            sprites.push(sp);
            data.push({
                life: 0, maxLife: 1,
                vel: new THREE.Vector3(),
                baseScale: 1, rot: 0, rotSpeed: 0,
                // rastro
                worldPos: new THREE.Vector3(),
                isTrail: false,
                active: true,
            });
        }
        return { sprites, data };
    }

    _staggerAll() {
        const stagger = p => p.data.forEach((d, i) => { d.life = i / p.data.length; });
        stagger(this.coreP);
        stagger(this.bodyP);
        stagger(this.wispP);
        stagger(this.emberP);
        stagger(this.smokeP);
        // Trail começa inativo
        this.trailP.data.forEach(d => { d.life = 1.0; d.active = false; });
    }

    // ======================================================================
    //  SPAWN
    // ======================================================================

    _coneXZ(hFrac, coneK = 0.85) {
        const r = this.baseWidth * Math.max(0.04, 1 - hFrac * coneK) * Math.sqrt(Math.random());
        const a = Math.random() * Math.PI * 2;
        return { x: Math.cos(a)*r, z: Math.sin(a)*r };
    }

    _spawnCore(sp, d) {
        const { x, z } = this._coneXZ(0, 0.4);
        sp.position.set(x, Math.random()*.4, z);
        d.vel.set((Math.random()-.5)*.3, 0.8+Math.random()*1.0, (Math.random()-.5)*.3);
        d.baseScale = (2.8 + Math.random()*2.2) * this.baseWidth;
        d.maxLife   = 0.8 + Math.random()*.5;
        sp.scale.set(d.baseScale, d.baseScale*.90, 1);
    }

    _spawnBody(sp, d) {
        const hf = Math.random() * 0.52;
        const { x, z } = this._coneXZ(hf);
        sp.position.set(x, hf * this.flameHeight * (0.88 + Math.random()*.24), z);
        d.vel.set((Math.random()-.5)*.8, 2.0+Math.random()*2.5, (Math.random()-.5)*.8);
        d.baseScale = (1.6 + Math.random()*1.8) * this.baseWidth;
        d.maxLife   = 0.6 + Math.random()*.5;
        d.rotSpeed  = (Math.random()-.5)*.5;
        d.rot       = (Math.random()-.5)*.5;
        sp.material.rotation = d.rot;
    }

    _spawnWisp(sp, d) {
        const hf = 0.40 + Math.random()*0.55;
        const { x, z } = this._coneXZ(hf, 0.92);
        sp.position.set(x, hf * this.flameHeight * (0.85 + Math.random()*.20), z);
        d.vel.set((Math.random()-.5)*.5, 1.5+Math.random()*2.0, (Math.random()-.5)*.5);
        d.baseScale = (0.8 + Math.random()*1.0) * this.baseWidth;
        d.maxLife   = 0.5 + Math.random()*.4;
        d.rotSpeed  = (Math.random()-.5)*.35;
        d.rot       = (Math.random()-.5)*.4;
        sp.material.rotation = d.rot;
    }

    _spawnEmber(sp, d) {
        const hf = Math.random() * 0.45;
        const { x, z } = this._coneXZ(hf, 0.7);
        sp.position.set(x, hf * this.flameHeight, z);
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 4.0;
        d.vel.set(Math.cos(angle)*speed*.85, 2.0+Math.random()*4.5, Math.sin(angle)*speed*.85);
        d.baseScale = 0.07 + Math.random()*.16;
        d.maxLife   = 0.5 + Math.random()*.4;
        d.gravity   = 4.0 + Math.random()*2.5;
        d.twinkle   = Math.random() * Math.PI * 2;
    }

    _spawnSmoke(sp, d) {
        const y = this.flameHeight * (0.55 + Math.random()*.38);
        const { x, z } = this._coneXZ(0.65, 0.38);
        sp.position.set(x, y, z);
        d.vel.set((Math.random()-.5)*.6, 0.7+Math.random()*1.2, (Math.random()-.5)*.6);
        d.baseScale = 0.7 + Math.random()*1.2;
        d.maxLife   = 1.2 + Math.random()*.8;
        d.rotSpeed  = (Math.random()-.5)*.38;
        sp.material.rotation = Math.random() * Math.PI * 2;
    }

    // Rastro: nasce em posição mundial → fica no espaço ao mover
    _spawnTrail(sp, d, wPos) {
        // Guarda posição mundial de nascimento
        d.worldPos.copy(wPos);
        // Sobe devagar em espaço local (drift residual)
        d.vel.set((Math.random()-.5)*.2, 0.3+Math.random()*.6, (Math.random()-.5)*.2);
        d.baseScale = (1.2 + Math.random()*1.5) * this.baseWidth;
        d.maxLife   = 0.5 + Math.random()*.5;
        d.life      = 0;
        d.rotSpeed  = (Math.random()-.5)*.3;
        d.rot       = (Math.random()-.5)*.6;
        d.active    = true;
        sp.material.rotation = d.rot;
        // Posição local = worldPos - currentWorldPos (calculada no update)
        this.getWorldPosition(_TMP);
        sp.position.copy(d.worldPos).sub(_TMP);
    }

    // ======================================================================
    //  UPDATE
    // ======================================================================

    update() {
        const raw   = this.clock.getDelta();
        const delta = Math.min(raw, 0.05);
        this.time  += delta;
        const dt    = Math.max(delta, 0.008);

        // Velocidade do sistema (espaço mundial)
        this.getWorldPosition(this._wPos);
        this._sysVel.copy(this._wPos).sub(this._lastWPos).divideScalar(dt);
        if (this._sysVel.length() > 20) this._sysVel.normalize().multiplyScalar(20);

        this._updateCore(delta);
        this._updateBody(delta);
        this._updateWisps(delta);
        this._updateEmbers(delta);
        this._updateSmoke(delta);
        this._updateTrail(delta);

        // ── Emitir rastro proporcional à velocidade ──────────────────────
        const speed = this._sysVel.length();
        if (speed > 0.3) {
            // Quantas partículas emitir este frame (max 4)
            const emit = Math.min(4, Math.floor(speed * dt * 12));
            let emitted = 0;
            for (let i = 0; i < this.trailP.data.length && emitted < emit; i++) {
                const d = this.trailP.data[i];
                if (!d.active || d.life >= 1.0) {
                    this._spawnTrail(this.trailP.sprites[i], d, this._wPos);
                    emitted++;
                }
            }
        }

        this._lastWPos.copy(this._wPos);
    }

    _turb(i, f1, f2, a1=.30, a2=.15) {
        const t = this.time;
        return Math.sin(t*f1 + i*.53)*a1
             + Math.sin(t*f2 + i*1.19)*a2
             + Math.sin(t*(f1+f2)*.5 + i*.81)*.08;
    }

    _applyDrag(v) {
        v.x -= this._sysVel.x * this.drag;
        v.z -= this._sysVel.z * this.drag;
    }

    // ── Core ─────────────────────────────────────────────────────────────
    _updateCore(dt) {
        const { sprites, data } = this.coreP;
        for (let i = 0; i < sprites.length; i++) {
            const sp = sprites[i], d = data[i];
            d.life += dt * (0.7 / d.maxLife);   // 1.4× mais rápido
            if (d.life >= 1.0) { d.life = 0; this._spawnCore(sp, d); }

            this._applyDrag(d.vel);
            sp.position.x += (d.vel.x + this._turb(i, 3.0, 6.5, .12, .06)*dt)*dt;
            sp.position.y +=  d.vel.y * dt;
            sp.position.z += (d.vel.z + this._turb(i+10, 4.0, 8.0, .10, .05)*dt)*dt;

            const env = Math.sin(d.life * Math.PI);
            const sc  = d.baseScale * (.78 + env*.32);
            sp.scale.set(sc, sc*.88, 1);
            sp.material.opacity = this.opacity * env * .075;

            const p = d.life, br = this.brightness;
            { const fd=Math.max(0,1-p*.7);
              sp.material.color.setRGB(this._tint.r*fd*br,this._tint.g*fd*br,this._tint.b*fd*br); }
        }
    }

    // ── Body ─────────────────────────────────────────────────────────────
    _updateBody(dt) {
        const { sprites, data } = this.bodyP;
        for (let i = 0; i < sprites.length; i++) {
            const sp = sprites[i], d = data[i];
            d.life += dt * (0.7 / d.maxLife);   // 1.4× mais rápido
            if (d.life >= 1.0) { d.life = 0; this._spawnBody(sp, d); }

            this._applyDrag(d.vel);
            d.vel.x += this._turb(i,    3.5, 8.0, .30, .14)*dt*.5;
            d.vel.z += this._turb(i+80, 4.2, 9.5, .26, .12)*dt*.5;
            const hr = sp.position.y / this.flameHeight;
            d.vel.y  = Math.max(.25, d.vel.y - dt*1.2*hr);

            sp.position.x += d.vel.x * dt * 1.2;
            sp.position.y += d.vel.y * dt;
            sp.position.z += d.vel.z * dt * 1.2;
            d.rot += d.rotSpeed * dt;
            sp.material.rotation = d.rot;

            const p = d.life, env = Math.sin(p * Math.PI);
            const sc = d.baseScale * (.68 + env*.45);
            sp.scale.set(sc*.90, sc*1.08, 1);
            sp.material.opacity = this.opacity * Math.pow(env, .55) * .095;

            const br = this.brightness;
            { const fd=Math.max(0,1-p*.8);
              sp.material.color.setRGB(this._tint.r*fd*br,this._tint.g*fd*br,this._tint.b*fd*br); }
        }
    }

    // ── Wisps ─────────────────────────────────────────────────────────────
    _updateWisps(dt) {
        const { sprites, data } = this.wispP;
        for (let i = 0; i < sprites.length; i++) {
            const sp = sprites[i], d = data[i];
            d.life += dt * (0.7 / d.maxLife);   // 1.4× mais rápido
            if (d.life >= 1.0) { d.life = 0; this._spawnWisp(sp, d); }

            this._applyDrag(d.vel);
            d.vel.x += this._turb(i+160, 4.0, 9.0, .25, .12)*dt*.4;
            d.vel.z += this._turb(i+200, 5.0,10.5, .22, .10)*dt*.4;

            sp.position.x += d.vel.x * dt;
            sp.position.y += d.vel.y * dt;
            sp.position.z += d.vel.z * dt;
            d.rot += d.rotSpeed * dt;
            sp.material.rotation = d.rot;

            const p = d.life, env = Math.sin(p * Math.PI);
            const sc = d.baseScale * (.58 + env*.55);
            sp.scale.set(sc*.72, sc*1.48, 1);
            sp.material.opacity = this.opacity * Math.pow(env, .65) * .12;

            const br = this.brightness;
            { const fd=Math.max(0,1-p*.6);
              sp.material.color.setRGB(this._tint.r*fd*br,this._tint.g*fd*br,this._tint.b*fd*br); }
        }
    }

    // ── Embers ────────────────────────────────────────────────────────────
    _updateEmbers(dt) {
        const { sprites, data } = this.emberP;
        for (let i = 0; i < sprites.length; i++) {
            const sp = sprites[i], d = data[i];
            d.life    += dt * (1.0 / d.maxLife);
            d.twinkle += dt * 18;

            if (d.life >= 1.0 || sp.position.y < -.2 || sp.position.y > this.flameHeight*1.6) {
                d.life = 0; this._spawnEmber(sp, d);
            }

            d.vel.y -= d.gravity * dt;
            d.vel.x *= 1 - dt*.9;
            d.vel.z *= 1 - dt*.9;
            sp.position.x += d.vel.x * dt;
            sp.position.y += d.vel.y * dt;
            sp.position.z += d.vel.z * dt;

            const tw    = .50 + .50*Math.sin(d.twinkle);
            const alpha = (1 - d.life) * .88 * tw;
            const sc    = d.baseScale * (.85 + .15*tw);
            sp.scale.set(sc, sc, 1);
            sp.material.opacity = this.opacity * alpha;

            const heat = 1 - d.life, br = this.brightness;
            { const fd=Math.max(0,heat*.85);
              sp.material.color.setRGB(this._tint.r*fd*br,this._tint.g*fd*br,this._tint.b*fd*br); }
        }
    }

    // ── Smoke ─────────────────────────────────────────────────────────────
    _updateSmoke(dt) {
        const { sprites, data } = this.smokeP;
        for (let i = 0; i < sprites.length; i++) {
            const sp = sprites[i], d = data[i];
            d.life += dt * (1.0 / d.maxLife);
            if (d.life >= 1.0 || sp.position.y > this.flameHeight*2.6) {
                d.life = 0; this._spawnSmoke(sp, d);
            }

            this._applyDrag(d.vel);
            d.vel.x += this._turb(i+300, 1.2, 3.0, .06, .03)*dt;
            d.vel.z += this._turb(i+340, 1.8, 4.0, .05, .02)*dt;
            sp.position.x += d.vel.x * dt;
            sp.position.y += d.vel.y * dt;
            sp.position.z += d.vel.z * dt;
            sp.material.rotation += d.rotSpeed * dt;

            const sc = d.baseScale * (1 + d.life * 2.5);
            sp.scale.set(sc, sc, 1);
            const alpha = d.life < .16 ? (d.life/.16)*.42 : (1 - (d.life-.16)/.84)*.42;
            sp.material.opacity = this.opacity * alpha;

            const heat = Math.max(0, 1 - d.life*2.2); const fd = heat * 0.6;
            sp.material.color.setRGB(this._tint.r*fd, this._tint.g*fd, this._tint.b*fd);
        }
    }

    // ── Trail ─────────────────────────────────────────────────────────────
    // Partículas de rastro ficam em posição mundial (não acompanham o pai)
    _updateTrail(dt) {
        const { sprites, data } = this.trailP;
        this.getWorldPosition(_TMP);   // posição mundial atual do emitter

        for (let i = 0; i < sprites.length; i++) {
            const sp = sprites[i], d = data[i];
            if (!d.active) { sp.material.opacity = 0; continue; }

            d.life += dt * (1.0 / d.maxLife);

            if (d.life >= 1.0) {
                d.active = false;
                sp.material.opacity = 0;
                continue;
            }

            // Sobe devagar em espaço mundial
            d.worldPos.x += d.vel.x * dt;
            d.worldPos.y += d.vel.y * dt;
            d.worldPos.z += d.vel.z * dt;

            // Converte posição mundial → local (compensa movimento do pai)
            sp.position.copy(d.worldPos).sub(_TMP);

            d.rot += d.rotSpeed * dt;
            sp.material.rotation = d.rot;

            // Escala cresce levemente
            const env = Math.sin(d.life * Math.PI);
            const sc  = d.baseScale * (.65 + env*.45);
            sp.scale.set(sc*.90, sc*1.08, 1);

            // Desbota rápido — é rastro, não fica visível por muito tempo
            sp.material.opacity = this.opacity * Math.pow(env, .7) * .07;

            // Cor esfria (fica mais vermelha/escura) conforme o rastro se dissolve
            const p = d.life, br = this.brightness;
            { const fd=Math.max(0,1-p*.9);
              sp.material.color.setRGB(this._tint.r*fd*br,this._tint.g*fd*br,this._tint.b*fd*br); }
        }
    }

    // ======================================================================
    //  API PÚBLICA
    // ======================================================================

    setColor(hex) {
        this.particleColor = hex;
        this._tint.set(hex);
    }

    setBrightness(value) {
        this.brightness = Math.max(0, value);
    }

    setOpacity(value) {
        this.opacity = Math.max(0, Math.min(1, value));
    }

    getConfig() {
        return {
            flameHeight: this.flameHeight,
            baseWidth:   this.baseWidth,
            color:       this.particleColor,
            brightness:  this.brightness,
            opacity:     this.opacity,
        };
    }
}

// ── Registro global ──────────────────────────────────────────────────────
window.fireCounter        = window.fireCounter || 0;
window.FireParticleSystem = FireParticleSystem;
window.createFire         = () => new FireParticleSystem();