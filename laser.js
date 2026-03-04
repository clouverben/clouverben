import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
//  LaserParticleSystem  —  estilo Skibidi Toilet SFM
//
//  Foco:
//    1. Núcleo branco-quente fino
//    2. Glow cyan intenso em camadas
//    3. MUITA eletricidade — arcos primários + secundários (bifurcações)
//    4. Pulso de energia subindo pelo feixe
//    5. Faíscas que disparam pra fora
// ─────────────────────────────────────────────────────────────────────────────

window.laserCounter = window.laserCounter || 0;

// Helper: ativa bloom (layer 1) em qualquer Object3D
function _bloom(obj) {
    obj.layers.enable(1);
    return obj;
}

class LaserParticleSystem extends THREE.Object3D {

    constructor() {
        super();

        this.name = '⚡ LASER ' + (++window.laserCounter);
        this.userData.isParticle = true;

        this.beamHeight = 10;
        this.laserColor = new THREE.Color(0xffdd00);   // amarelo
        this.brightness = 2.5;
        this._opacity   = 1.0;
        this.rotation.set(0, 0, 0);   // feixe vertical fixo

        this.clock = new THREE.Clock();
        this.time  = 0;

        this._arcs    = [];   // arcos primários
        this._forks   = [];   // bifurcações
        this._sparks  = {};
        this._pulses  = [];   // anéis de pulso subindo

        this._build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    _build() {
        const H  = this.beamHeight;
        const cy = H / 2;
        const c  = this.laserColor;

        // ── 1. NÚCLEO branco ─────────────────────────────────────────────────
        this._coreMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(1, 1, 1),
            transparent: true, opacity: 1.0,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        const core = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.035, H, 8),
            this._coreMat
        );
        core.position.y = cy;
        _bloom(core);
        this.add(core);

        // ── 2. GLOW em 2 camadas ─────────────────────────────────────────────
        this._glowMats = [];
        [
            { r: 0.10, op: 0.95 },
            { r: 0.22, op: 0.65 },
        ].forEach(({ r, op }) => {
            const mat = new THREE.MeshBasicMaterial({
                color: c.clone(), transparent: true, opacity: op,
                blending: THREE.AdditiveBlending, depthWrite: false,
                side: THREE.BackSide
            });
            this._glowMats.push({ mat, base: op });
            const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, H, 12), mat);
            m.position.y = cy;
            _bloom(m);
            this.add(m);
        });

        // ── 3. ARCOS PRIMÁRIOS (12) ───────────────────────────────────────────
        for (let i = 0; i < 12; i++) {
            const arc = this._buildArc(0.6, 20);
            arc.material.color.set(i % 3 === 0
                ? new THREE.Color(1, 1, 1)
                : new THREE.Color(0xffee44));
            _bloom(arc);
            this._arcs.push({ mesh: arc, ttl: Math.random() * 0.08 });
            this.add(arc);
        }

        // ── 4. BIFURCAÇÕES (8) ───────────────────────────────────────────────
        for (let i = 0; i < 8; i++) {
            const fork = this._buildFork();
            _bloom(fork);
            this._forks.push({ mesh: fork, ttl: Math.random() * 0.12 });
            this.add(fork);
        }

        // ── 5. FAÍSCAS ───────────────────────────────────────────────────────
        const N   = 300;
        const pos = new Float32Array(N * 3);
        const vel = new Float32Array(N * 3);
        const age = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            this._resetSpark(pos, vel, age, i, H);
            age[i] = Math.random() * 0.6;
        }
        const spkGeo = new THREE.BufferGeometry();
        spkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this._spkMat = new THREE.PointsMaterial({
            color: new THREE.Color(1, 1, 1), size: 0.055,
            transparent: true, opacity: 0.9,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        const sparks = new THREE.Points(spkGeo, this._spkMat);
        _bloom(sparks);
        this._sparks = { mesh: sparks, vel, age, pos, n: N, maxAge: 0.55 };
        this.add(sparks);

        // ── 6. PULSOS DE ENERGIA (anéis finos subindo) ───────────────────────
        for (let i = 0; i < 4; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(1, 1, 1), transparent: true, opacity: 0,
                blending: THREE.AdditiveBlending, depthWrite: false
            });
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.08, 0.025, 4, 16),
                mat
            );
            ring.rotation.x = Math.PI / 2;
            const t0 = i / 4;
            ring.position.y = t0 * H;
            _bloom(ring);
            this._pulses.push({ mesh: ring, t: t0, speed: 6 + Math.random() * 4 });
            this.add(ring);
        }

        // ── pick para raycasting — NÃO adicionado à cena ─────────────────────
        // O SelectiveBloom substitui todos os materiais da layer 0 por preto,
        // ignorando colorWrite/depthWrite. Por isso o cilindro NÃO é adicionado
        // com this.add() — fica disponível em this._pickMesh caso precise de
        // raycasting externo (adicione-o a uma cena de picking separada).
        this._pickMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(1.2, 1.2, H + 1, 8),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        this._pickMesh.position.y = cy;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  HELPERS DE GEOMETRIA
    // ─────────────────────────────────────────────────────────────────────────

    _buildArc(spread = 0.6, segs = 22) {
        const H     = this.beamHeight;
        const verts = [];
        for (let i = 0; i <= segs; i++) {
            const t = i / segs;
            const y = t * H;
            const a = Math.random() * Math.PI * 2;
            const r = (i === 0 || i === segs) ? 0 : Math.random() * spread;
            verts.push(Math.cos(a) * r, y, Math.sin(a) * r);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
        const idx = [];
        for (let i = 0; i < segs; i++) idx.push(i, i + 1);
        geo.setIndex(idx);
        return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
            color: new THREE.Color(0xffee44), transparent: true,
            opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false
        }));
    }

    _buildFork() {
        const H      = this.beamHeight;
        const segs   = 8 + Math.floor(Math.random() * 6);
        const startY = Math.random() * H;
        const len    = 0.8 + Math.random() * 1.8;
        const dirX   = (Math.random() - 0.5) * 2;
        const dirZ   = (Math.random() - 0.5) * 2;
        const verts  = [];

        for (let i = 0; i <= segs; i++) {
            const t      = i / segs;
            const y      = startY + t * len * (Math.random() > 0.5 ? 1 : -1);
            const jitter = (1 - t) * 0.3;
            verts.push(
                dirX * t * len + (Math.random() - 0.5) * jitter,
                Math.max(0, Math.min(H, y)),
                dirZ * t * len + (Math.random() - 0.5) * jitter
            );
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
        const idx = [];
        for (let i = 0; i < segs; i++) idx.push(i, i + 1);
        geo.setIndex(idx);

        return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
            color: new THREE.Color(0xffff99), transparent: true,
            opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false
        }));
    }

    _refreshArc(obj, spread = 0.6, segs = 22) {
        const H     = this.beamHeight;
        const verts = [];
        for (let i = 0; i <= segs; i++) {
            const t = i / segs;
            const y = t * H;
            const a = Math.random() * Math.PI * 2;
            const r = (i === 0 || i === segs) ? 0 : Math.random() * spread;
            verts.push(Math.cos(a) * r, y, Math.sin(a) * r);
        }
        const idx = [];
        for (let i = 0; i < segs; i++) idx.push(i, i + 1);
        obj.mesh.geometry.setAttribute('position',
            new THREE.BufferAttribute(new Float32Array(verts), 3));
        obj.mesh.geometry.attributes.position.needsUpdate = true;
        obj.mesh.geometry.setIndex(idx);
        obj.mesh.material.opacity = 0.5 + Math.random() * 0.5;
        obj.ttl = 0.03 + Math.random() * 0.09;
    }

    _refreshFork(obj) {
        const H      = this.beamHeight;
        const segs   = 8 + Math.floor(Math.random() * 6);
        const startY = Math.random() * H;
        const len    = 0.8 + Math.random() * 1.8;
        const dirX   = (Math.random() - 0.5) * 2;
        const dirZ   = (Math.random() - 0.5) * 2;
        const verts  = [];

        for (let i = 0; i <= segs; i++) {
            const t      = i / segs;
            const y      = startY + t * len * (Math.random() > 0.5 ? 1 : -1);
            const jitter = (1 - t) * 0.3;
            verts.push(
                dirX * t * len + (Math.random() - 0.5) * jitter,
                Math.max(0, Math.min(H, y)),
                dirZ * t * len + (Math.random() - 0.5) * jitter
            );
        }

        const idx = [];
        for (let i = 0; i < segs; i++) idx.push(i, i + 1);
        obj.mesh.geometry.setAttribute('position',
            new THREE.BufferAttribute(new Float32Array(verts), 3));
        obj.mesh.geometry.attributes.position.needsUpdate = true;
        obj.mesh.geometry.setIndex(idx);
        obj.mesh.material.opacity = 0.3 + Math.random() * 0.5;
        obj.ttl = 0.06 + Math.random() * 0.14;
    }

    _resetSpark(pos, vel, age, i, H) {
        pos[i*3]   = (Math.random() - 0.5) * 0.1;
        pos[i*3+1] = Math.random() * H;
        pos[i*3+2] = (Math.random() - 0.5) * 0.1;
        const spd  = 2.5 + Math.random() * 3.5;
        const ang  = Math.random() * Math.PI * 2;
        const elev = (Math.random() - 0.5) * 1.5;
        vel[i*3]   = Math.cos(ang) * spd;
        vel[i*3+1] = elev;
        vel[i*3+2] = Math.sin(ang) * spd;
        age[i]     = 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  UPDATE
    // ─────────────────────────────────────────────────────────────────────────

    update() {
        const delta = Math.min(this.clock.getDelta(), 0.05);
        this.time  += delta;
        const t     = this.time;
        const H     = this.beamHeight;

        const pulse = 0.88 + Math.sin(t * 12) * 0.12;

        // núcleo
        this._coreMat.opacity = Math.min(1, pulse * this._opacity);

        // glow
        this._glowMats.forEach(({ mat, base }) => {
            mat.opacity = base * pulse * this._opacity;
        });

        // arcos primários
        this._arcs.forEach(obj => {
            obj.ttl -= delta;
            if (obj.ttl <= 0) this._refreshArc(obj);
            obj.mesh.material.opacity = (Math.random() > 0.15)
                ? (0.45 + Math.random() * 0.55) * this._opacity
                : 0;
        });

        // bifurcações
        this._forks.forEach(obj => {
            obj.ttl -= delta;
            if (obj.ttl <= 0) this._refreshFork(obj);
            obj.mesh.material.opacity = (Math.random() > 0.25)
                ? (0.25 + Math.random() * 0.45) * this._opacity
                : 0;
        });

        // faíscas
        const { pos, vel, age, n, maxAge } = this._sparks;
        for (let i = 0; i < n; i++) {
            age[i] += delta;
            if (age[i] >= maxAge) {
                this._resetSpark(pos, vel, age, i, H);
            } else {
                pos[i*3]   += vel[i*3]   * delta;
                pos[i*3+1] += vel[i*3+1] * delta;
                pos[i*3+2] += vel[i*3+2] * delta;
                vel[i*3+1] -= 3.5 * delta;
                vel[i*3]   *= 0.97;
                vel[i*3+2] *= 0.97;
            }
        }
        this._sparks.mesh.geometry.attributes.position.needsUpdate = true;
        this._spkMat.opacity = 0.85 * pulse * this._opacity;

        // pulsos subindo
        this._pulses.forEach(p => {
            p.t += delta * p.speed / H;
            if (p.t > 1) { p.t = 0; p.speed = 6 + Math.random() * 4; }
            p.mesh.position.y = p.t * H;
            const fade = Math.sin(p.t * Math.PI);
            p.mesh.material.opacity  = fade * 0.9 * this._opacity;
            p.mesh.scale.x = p.mesh.scale.z = 1 + p.t * 1.5;
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  API pública
    // ─────────────────────────────────────────────────────────────────────────

    setColor(hex) {
        const col = new THREE.Color(hex);
        this.laserColor = col;
        this._glowMats.forEach(({ mat }) => mat.color.set(col));
        this._arcs.forEach((obj, i) =>
            obj.mesh.material.color.set(i % 3 === 0
                ? new THREE.Color(1, 1, 1)
                : col.clone().lerp(new THREE.Color(1, 1, 1), 0.3))
        );
        this._forks.forEach(obj =>
            obj.mesh.material.color.set(col.clone().lerp(new THREE.Color(1, 1, 1), 0.5))
        );
        this._pulses.forEach(p => p.mesh.material.color.set(new THREE.Color(1, 1, 1)));
    }

    setBrightness(value) {
        this.brightness = value;
        this._opacity   = Math.min(1, value / 2.5);
    }

    setOpacity(value) {
        this._opacity = value;
    }
}

window.LaserParticleSystem = LaserParticleSystem;

window.createLaser = function () {
    return new LaserParticleSystem();
};
