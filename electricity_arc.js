// ==================== ELECTRICITY ARC PARTICLE SYSTEM ====================
// Estilo Skibidi Toilet: raios brancos/amarelos, bifurcações, faíscas e glow intenso
import * as THREE from 'three';

// ── Zigzag caótico entre dois pontos ─────────────────────────────────────────
function buildZigzag(geo, A, B, spread, segs, jitter = 1.0) {
    const arr = geo.attributes.position.array;
    const AB  = new THREE.Vector3().subVectors(B, A);
    const len = AB.length();
    if (len < 0.001) return;
    const up = Math.abs(AB.y / len) > 0.9
        ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const p1 = new THREE.Vector3().crossVectors(AB, up).normalize();
    const p2 = new THREE.Vector3().crossVectors(AB, p1).normalize();
    const amp = len * spread;
    for (let i = 0; i <= segs; i++) {
        const t   = i / segs;
        const env = Math.sin(t * Math.PI);
        // Caos extra: jitter adicional nos pontos intermediários
        const chaos = (i > 0 && i < segs) ? jitter : 0;
        const b   = new THREE.Vector3().lerpVectors(A, B, t);
        const d1  = (Math.random() - 0.5) * 2 * amp * env * (1 + chaos * Math.random());
        const d2  = (Math.random() - 0.5) * 2 * amp * env * (1 + chaos * Math.random());
        arr[i*3]   = b.x + p1.x*d1 + p2.x*d2;
        arr[i*3+1] = b.y + p1.y*d1 + p2.y*d2;
        arr[i*3+2] = b.z + p1.z*d1 + p2.z*d2;
    }
    geo.attributes.position.needsUpdate = true;
}

// ── Bifurcação: pega um ponto aleatório do arco pai e cria um sub-raio ────────
function buildBranch(geo, parentGeo, spread, segs) {
    const parentArr = parentGeo.attributes.position.array;
    const totalPts  = parentGeo.attributes.position.count;
    // Escolhe um ponto entre 25% e 75% do arco pai
    const startIdx = Math.floor(totalPts * (0.25 + Math.random() * 0.5));
    const A = new THREE.Vector3(
        parentArr[startIdx*3],
        parentArr[startIdx*3+1],
        parentArr[startIdx*3+2]
    );
    // Ponta da bifurcação: desvia em direção aleatória
    const dir = new THREE.Vector3(
        (Math.random()-0.5) * 2,
        (Math.random()-0.5) * 2,
        (Math.random()-0.5) * 2
    ).normalize();
    const branchLen = 0.15 + Math.random() * 0.35;
    const B = A.clone().addScaledVector(dir, branchLen);
    buildZigzag(geo, A, B, spread, segs, 0.5);
}

// ── Glow billboard (multicamadas) ─────────────────────────────────────────────
function makeGlowMesh(innerColor, outerColor, size = 64) {
    const S = size, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(S/2,S/2,0, S/2,S/2,S/2);
    g.addColorStop(0,    `rgba(255,255,255,1)`);
    g.addColorStop(0.15, innerColor);
    g.addColorStop(0.5,  outerColor);
    g.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    const mat = new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(cv),
        blending: THREE.AdditiveBlending,
        depthWrite: false, transparent: true, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.userData.isFXSprite = true; m.layers.enable(1); m.frustumCulled = false;
    return m;
}

// ── Faíscas (spark particles) ──────────────────────────────────────────────────
class SparkSystem {
    constructor(scene, count = 40) {
        this._scene = scene;
        this._sparks = [];
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));
        const mat = new THREE.PointsMaterial({
            color: new THREE.Color('#ffffaa'),
            size: 0.035,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
        });
        this._pts = new THREE.Points(geo, mat);
        this._pts.frustumCulled = false;
        this._pts.layers.enable(1);
        scene.add(this._pts);
        // Init spark data
        for (let i = 0; i < count; i++) {
            this._sparks.push({
                pos:  new THREE.Vector3(),
                vel:  new THREE.Vector3(),
                life: 0, maxLife: 0, active: false, idx: i
            });
        }
        this._count = count;
        this._geo = geo;
    }

    emit(origin, count = 4) {
        let emitted = 0;
        for (let i = 0; i < this._count && emitted < count; i++) {
            const s = this._sparks[i];
            if (!s.active) {
                s.pos.copy(origin);
                s.vel.set(
                    (Math.random()-0.5) * 2.5,
                    (Math.random()-0.5) * 2.5,
                    (Math.random()-0.5) * 2.5
                );
                s.maxLife = 0.04 + Math.random() * 0.12;
                s.life    = s.maxLife;
                s.active  = true;
                emitted++;
            }
        }
    }

    update(dt) {
        const pos = this._geo.attributes.position.array;
        const GRAVITY = -3.0;
        for (const s of this._sparks) {
            if (s.active) {
                s.vel.y  += GRAVITY * dt;
                s.pos.addScaledVector(s.vel, dt);
                s.life   -= dt;
                if (s.life <= 0) { s.active = false; }
            }
            const alive = s.active ? 1 : 0;
            pos[s.idx*3]   = s.active ? s.pos.x : 0;
            pos[s.idx*3+1] = s.active ? s.pos.y : 0;
            pos[s.idx*3+2] = s.active ? s.pos.z : 0;
            this._pts.material.opacity = alive;
        }
        this._geo.attributes.position.needsUpdate = true;
    }

    dispose() {
        this._scene?.remove(this._pts);
        this._geo.dispose();
        this._pts.material.dispose();
    }
}

// ================================================================================
class ElectricityArcSystem extends THREE.Object3D {
    constructor() {
        super();
        this.name = 'Eletricidade';
        this.userData.isParticle   = true;
        this.userData.particleType = 'electricityArc';
        this._scene = null;

        // Paleta estilo Skibidi Toilet: branco > amarelo > laranja
        this._colorCore   = new THREE.Color('#ffffff');
        this._colorMid    = new THREE.Color('#ffee44');
        this._colorOuter  = new THREE.Color('#ff8800');
        this._colorGlow   = new THREE.Color('#ffcc00');

        this._brightness = 1.0; this._opacity = 1.0; this._time = 0; this._built = false;
        this.SEGS       = 20;   // mais segmentos → mais detalhe
        this.ARC_COUNT  = 22;   // mais arcos
        this.BRANCH_COUNT = 16; // bifurcações por arco

        this._arcs    = [];
        this._branches = [];
        this._nodeGlows = [];
        this._coreGlow  = null;
        this._outerGlow = null;
        this._sparks    = null;
        this._sparkTimer = 0;
    }

    _makeLine(color, opacity, linewidth = 1) {
        return new THREE.LineBasicMaterial({
            color, blending: THREE.AdditiveBlending,
            depthWrite: false, transparent: true, opacity, linewidth,
        });
    }

    _build(scene) {
        if (this._built) return;
        this._built = true; this._scene = scene;

        const pts     = new Float32Array((this.SEGS + 1) * 3);
        const ptsBr   = new Float32Array(9); // 3 pontos para bifurcação curta

        // ── Arcos principais (3 camadas: core, mid, glow) ──────────────────────
        for (let i = 0; i < this.ARC_COUNT; i++) {
            const geo  = new THREE.BufferGeometry(); // core branco
            const geoM = new THREE.BufferGeometry(); // mid amarelo
            const geoG = new THREE.BufferGeometry(); // glow laranja
            geo.setAttribute( 'position', new THREE.BufferAttribute(pts.slice(), 3));
            geoM.setAttribute('position', new THREE.BufferAttribute(pts.slice(), 3));
            geoG.setAttribute('position', new THREE.BufferAttribute(pts.slice(), 3));

            const mat  = this._makeLine(this._colorCore.clone(),  1.0);
            const matM = this._makeLine(this._colorMid.clone(),   0.7);
            const matG = this._makeLine(this._colorOuter.clone(), 0.18);

            const line  = new THREE.Line(geo,  mat);
            const lineM = new THREE.Line(geoM, matM);
            const lineG = new THREE.Line(geoG, matG);

            [line, lineM, lineG].forEach(l => {
                l.frustumCulled = false;
                l.userData.isFXSprite = true;
                l.layers.enable(1);
                scene.add(l);
            });

            this._arcs.push({
                line, lineM, lineG, geo, geoM, geoG, mat, matM, matG,
                timer:    Math.random() * 0.04,
                interval: 0.018 + Math.random() * 0.04, // muito mais rápido
                visible:  true,
                opacity:  0.65 + Math.random() * 0.35,
                spread:   0.18 + Math.random() * 0.28,
                jitter:   0.5 + Math.random() * 1.0,    // caos extra
                yBias:    (Math.random() - 0.5) * 0.8,
                zBias:    (Math.random() - 0.5) * 0.5,
                A: new THREE.Vector3(),
                B: new THREE.Vector3(),
            });
        }

        // ── Bifurcações (sub-raios que saem dos arcos principais) ───────────────
        for (let i = 0; i < this.BRANCH_COUNT; i++) {
            const geo  = new THREE.BufferGeometry();
            const geoG = new THREE.BufferGeometry();
            geo.setAttribute( 'position', new THREE.BufferAttribute(ptsBr.slice(), 3));
            geoG.setAttribute('position', new THREE.BufferAttribute(ptsBr.slice(), 3));

            const mat  = this._makeLine(this._colorMid.clone(),   0.85);
            const matG = this._makeLine(this._colorOuter.clone(), 0.15);
            const line  = new THREE.Line(geo,  mat);
            const lineG = new THREE.Line(geoG, matG);

            [line, lineG].forEach(l => {
                l.frustumCulled = false;
                l.userData.isFXSprite = true;
                l.layers.enable(1);
                scene.add(l);
            });

            this._branches.push({
                line, lineG, geo, geoG, mat, matG,
                timer:    Math.random() * 0.03,
                interval: 0.015 + Math.random() * 0.035,
                visible:  true,
                opacity:  0.4 + Math.random() * 0.5,
                // índice do arco pai
                parentIdx: Math.floor(Math.random() * this.ARC_COUNT),
            });
        }

        // ── Glows nos polos (branco + amarelo + laranja) ────────────────────────
        for (let i = 0; i < 9; i++) {
            const inner = i < 3
                ? 'rgba(255,255,200,0.9)'
                : i < 6
                    ? 'rgba(255,220,50,0.7)'
                    : 'rgba(255,100,0,0.4)';
            const outer = i < 3
                ? 'rgba(255,200,0,0.3)'
                : i < 6
                    ? 'rgba(255,100,0,0.2)'
                    : 'rgba(200,50,0,0.1)';
            const m = makeGlowMesh(inner, outer);
            scene.add(m);
            this._nodeGlows.push({ mesh: m, side: i % 2 === 0 ? -1 : 1, timer: 0, opacity: 0 });
        }

        // ── Core glow central (amarelo intenso) ────────────────────────────────
        this._coreGlow = makeGlowMesh('rgba(255,230,80,0.95)', 'rgba(255,100,0,0.3)', 128);
        scene.add(this._coreGlow);

        // ── Outer glow gigante (laranja difuso) ────────────────────────────────
        this._outerGlow = makeGlowMesh('rgba(255,160,0,0.4)', 'rgba(255,50,0,0.05)', 128);
        scene.add(this._outerGlow);

        // ── Sistema de faíscas ─────────────────────────────────────────────────
        this._sparks = new SparkSystem(scene, 60);
    }

    setColor(hex) {
        this._colorGlow.set(hex);
        // Mantém a paleta de raio, mas tinge o glow com a cor escolhida
        this._arcs.forEach(a => { a.matG.color.set(hex); });
        this._nodeGlows.forEach(g => g.mesh.material.color.set(hex));
        if (this._coreGlow)  this._coreGlow.material.color.set(hex);
        if (this._outerGlow) this._outerGlow.material.color.set(hex);
    }
    setBrightness(v) { this._brightness = v; }
    setOpacity(v)    { this._opacity = v; }
    getConfig()      { return { color: '#'+this._colorGlow.getHexString(), brightness: this._brightness, opacity: this._opacity }; }

    update(dt) {
        const scene = window._nexusScene || window.scene;
        if (!this._built) this._build(scene);
        this._time += dt;
        const cam = window._nexusCamera || { quaternion: new THREE.Quaternion() };
        const br  = this._brightness * this._opacity;

        const wPos = new THREE.Vector3();
        this.getWorldPosition(wPos);

        // Tamanho do objeto
        let objR = 0.65, objH = 2.0;
        try {
            const box = new THREE.Box3().setFromObject(this);
            const sz  = new THREE.Vector3(); box.getSize(sz);
            objR = Math.max(sz.x, sz.z) * 0.5 + 0.15;
            objH = sz.y || 2.0;
        } catch {}

        const halfSpan = objR * 1.15;

        // ── Atualiza arcos principais ──────────────────────────────────────────
        this._arcs.forEach(arc => {
            arc.timer -= dt;
            if (arc.timer <= 0) {
                arc.timer   = arc.interval * (0.4 + Math.random() * 0.8);
                arc.visible = Math.random() > 0.04; // quase sempre visível
                arc.opacity = 0.6 + Math.random() * 0.4;
                arc.spread  = 0.15 + Math.random() * 0.30;
                arc.jitter  = 0.3 + Math.random() * 1.2;
                arc.yBias   = (Math.random() - 0.5) * objH * 0.75;
                arc.zBias   = (Math.random() - 0.5) * objR * 0.6;

                if (arc.visible) {
                    arc.A.set(
                        wPos.x - halfSpan,
                        wPos.y + arc.yBias,
                        wPos.z + arc.zBias
                    );
                    arc.B.set(
                        wPos.x + halfSpan,
                        wPos.y + arc.yBias + (Math.random()-0.5)*0.35,
                        wPos.z + arc.zBias + (Math.random()-0.5)*0.35
                    );
                    buildZigzag(arc.geo,  arc.A, arc.B, arc.spread,       this.SEGS, arc.jitter);
                    buildZigzag(arc.geoM, arc.A, arc.B, arc.spread*1.1,   this.SEGS, arc.jitter * 0.6);
                    buildZigzag(arc.geoG, arc.A, arc.B, arc.spread + 0.08, this.SEGS, arc.jitter * 0.3);
                }
            }

            // Pulso de opacidade: flickering intenso estilo raio
            const flicker = 0.7 + Math.sin(this._time * 180 + arc.yBias * 10) * 0.3;
            const vis = arc.visible ? arc.opacity * br * flicker : 0;
            arc.mat.opacity  = vis;
            arc.matM.opacity = vis * 0.75;
            arc.matG.opacity = vis * 0.2;
        });

        // ── Atualiza bifurcações ───────────────────────────────────────────────
        this._branches.forEach(br_ => {
            br_.timer -= dt;
            if (br_.timer <= 0) {
                br_.timer    = br_.interval * (0.3 + Math.random() * 1.2);
                br_.visible  = Math.random() > 0.2;
                br_.opacity  = 0.35 + Math.random() * 0.55;
                br_.parentIdx = Math.floor(Math.random() * this.ARC_COUNT);

                if (br_.visible) {
                    const parent = this._arcs[br_.parentIdx];
                    if (parent && parent.visible) {
                        buildBranch(br_.geo,  parent.geo, 0.20 + Math.random()*0.15, 4);
                        buildBranch(br_.geoG, parent.geo, 0.25 + Math.random()*0.15, 4);
                    } else {
                        br_.visible = false;
                    }
                }
            }
            const fBr = 0.6 + Math.sin(this._time * 220 + br_.parentIdx) * 0.4;
            const vis = br_.visible ? br_.opacity * br * fBr : 0;
            br_.mat.opacity  = vis;
            br_.matG.opacity = vis * 0.2;
        });

        // ── Glows nos polos ────────────────────────────────────────────────────
        this._nodeGlows.forEach((g, i) => {
            g.timer -= dt;
            if (g.timer <= 0) {
                g.timer   = 0.02 + Math.random() * 0.06; // pisca mais rápido
                g.opacity = Math.random() < 0.65 ? 0.5 + Math.random() * 0.5 : 0;
            }
            g.mesh.position.set(
                wPos.x + g.side * halfSpan,
                wPos.y + (Math.random()-0.5)*objH*0.45,
                wPos.z + (Math.random()-0.5)*objR*0.3
            );
            g.mesh.quaternion.copy(cam.quaternion);
            // Camadas internas menores, externas maiores
            const layerScale = i < 3 ? 0.12 : i < 6 ? 0.22 : 0.40;
            const sc = (layerScale + Math.random()*0.06) * br;
            g.mesh.scale.setScalar(sc * g.opacity);
            g.mesh.material.opacity = g.opacity * br;
        });

        // ── Core glow central ──────────────────────────────────────────────────
        // Pulso rápido com dois senos para imitar flickering de raio
        const cf = 0.55
            + Math.sin(this._time * 35) * 0.20
            + Math.sin(this._time * 17) * 0.12
            + Math.sin(this._time * 73) * 0.07;
        this._coreGlow.position.copy(wPos);
        this._coreGlow.quaternion.copy(cam.quaternion);
        this._coreGlow.scale.setScalar(objR * 2.2 * cf * br);
        this._coreGlow.material.opacity = 0.50 * cf * br;

        // ── Outer glow difuso ──────────────────────────────────────────────────
        const of_ = 0.4 + Math.sin(this._time * 12) * 0.12;
        this._outerGlow.position.copy(wPos);
        this._outerGlow.quaternion.copy(cam.quaternion);
        this._outerGlow.scale.setScalar(objR * 3.5 * of_ * br);
        this._outerGlow.material.opacity = 0.18 * of_ * br;

        // ── Faíscas ────────────────────────────────────────────────────────────
        this._sparkTimer -= dt;
        if (this._sparkTimer <= 0) {
            this._sparkTimer = 0.015 + Math.random() * 0.04;
            // Emite faíscas nos polos e ao longo dos arcos
            const poleL = new THREE.Vector3(wPos.x - halfSpan, wPos.y, wPos.z);
            const poleR = new THREE.Vector3(wPos.x + halfSpan, wPos.y, wPos.z);
            this._sparks.emit(poleL, 2 + Math.floor(Math.random() * 3));
            this._sparks.emit(poleR, 2 + Math.floor(Math.random() * 3));
            // Faíscas ao longo de um arco aleatório
            const rArc = this._arcs[Math.floor(Math.random() * this.ARC_COUNT)];
            if (rArc && rArc.visible) {
                const mid = new THREE.Vector3().lerpVectors(rArc.A, rArc.B, Math.random());
                this._sparks.emit(mid, 1 + Math.floor(Math.random() * 2));
            }
        }
        this._sparks?.update(dt);
    }

    dispose() {
        this._arcs.forEach(a => {
            this._scene?.remove(a.line);
            this._scene?.remove(a.lineM);
            this._scene?.remove(a.lineG);
            a.geo.dispose(); a.geoM.dispose(); a.geoG.dispose();
            a.mat.dispose(); a.matM.dispose(); a.matG.dispose();
        });
        this._branches.forEach(b => {
            this._scene?.remove(b.line);
            this._scene?.remove(b.lineG);
            b.geo.dispose(); b.geoG.dispose();
            b.mat.dispose(); b.matG.dispose();
        });
        this._nodeGlows.forEach(g => {
            this._scene?.remove(g.mesh);
            g.mesh.geometry.dispose(); g.mesh.material.dispose();
        });
        [this._coreGlow, this._outerGlow].forEach(g => {
            if (g) { this._scene?.remove(g); g.geometry.dispose(); g.material.dispose(); }
        });
        this._sparks?.dispose();
    }
}

window.ElectricityArcSystem = ElectricityArcSystem;
window.createElectricityArc = () => { const s = new ElectricityArcSystem(); s.name = 'Eletricidade'; return s; };
console.log('electricity_arc.js ✅ [Skibidi Edition]');
