import * as THREE from 'three';

window.electricityCounter = window.electricityCounter || 0;

class ElectricityParticleSystem extends THREE.Object3D {

    constructor() {
        super();
        this.name = '⚡ Electricity ' + (++window.electricityCounter);
        this.userData.isParticle = true;

        this.particleColor = '#00ccff';
        this.brightness    = 2.5;
        this._opacity      = 1.0;

        this.beamHeight = 4.0; // comprimento de cada arco (igual ao laser, só menor)

        this.clock = new THREE.Clock();
        this.time  = 0;
        this._arcs  = [];
        this._forks = [];

        this._build();
    }

    // ── copia EXATA do laser, mas aplicada a cada arco rotacionado ────────────
    _buildArc(spread, segs) {
        const H     = this.beamHeight;
        const verts = [];
        for (let i = 0; i <= segs; i++) {
            const t = i / segs;
            const y = t * H - H / 2; // centrado na origem
            const a = Math.random() * Math.PI * 2;
            const r = (i === 0 || i === segs) ? 0 : Math.random() * spread;
            verts.push(Math.cos(a) * r, y, Math.sin(a) * r);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
        const idx = [];
        for (let i = 0; i < segs; i++) idx.push(i, i + 1);
        geo.setIndex(idx);

        const mesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
            color:       new THREE.Color(this.particleColor),
            transparent: true,
            opacity:     0.8,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        }));

        // rotação aleatória em 3D — transforma arco vertical em direção aleatória
        mesh.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        return mesh;
    }

    _buildFork() {
        const H      = this.beamHeight * 0.6;
        const segs   = 8 + Math.floor(Math.random() * 6);
        const startY = (Math.random() - 0.5) * H;
        const len    = 0.5 + Math.random() * 1.2;
        const dirX   = (Math.random() - 0.5) * 2;
        const dirZ   = (Math.random() - 0.5) * 2;
        const verts  = [];

        for (let i = 0; i <= segs; i++) {
            const t      = i / segs;
            const y      = startY + t * len * (Math.random() > 0.5 ? 1 : -1);
            const jitter = (1 - t) * 0.25;
            verts.push(
                dirX * t * len + (Math.random() - 0.5) * jitter,
                y,
                dirZ * t * len + (Math.random() - 0.5) * jitter
            );
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
        const idx = [];
        for (let i = 0; i < segs; i++) idx.push(i, i + 1);
        geo.setIndex(idx);

        const mesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
            color:       new THREE.Color(this.particleColor).lerp(new THREE.Color(1,1,1), 0.5),
            transparent: true,
            opacity:     0.5,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        }));

        mesh.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        return mesh;
    }

    _refreshArc(obj) {
        const old = obj.mesh;
        const rx = old.rotation.x, ry = old.rotation.y, rz = old.rotation.z;
        this.remove(old);
        old.geometry.dispose();
        old.material.dispose();

        const mesh = this._buildArc(0.55, 22);
        // mantém a mesma rotação para evitar pulos visuais
        mesh.rotation.set(rx, ry, rz);
        mesh.material.opacity = 0.5 + Math.random() * 0.5;
        obj.mesh = mesh;
        obj.ttl  = 0.03 + Math.random() * 0.09;
        this.add(mesh);
    }

    _refreshFork(obj) {
        const old = obj.mesh;
        this.remove(old);
        old.geometry.dispose();
        old.material.dispose();

        const mesh = this._buildFork();
        mesh.material.opacity = 0.3 + Math.random() * 0.4;
        obj.mesh = mesh;
        obj.ttl  = 0.06 + Math.random() * 0.14;
        this.add(mesh);
    }

    _build() {
        const white = new THREE.Color(1, 1, 1);

        // core branco mínimo no centro
        this._coreMat = new THREE.MeshBasicMaterial({
            color: white, transparent: true, opacity: 1.0,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.add(new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), this._coreMat));

        // 16 arcos primários — como o laser mas em todas as direções
        for (let i = 0; i < 16; i++) {
            const mesh = this._buildArc(0.55, 22);
            if (i % 4 === 0) mesh.material.color.set(white);
            this._arcs.push({ mesh, ttl: Math.random() * 0.08 });
            this.add(mesh);
        }

        // 10 bifurcações
        for (let i = 0; i < 10; i++) {
            const mesh = this._buildFork();
            this._forks.push({ mesh, ttl: Math.random() * 0.12 });
            this.add(mesh);
        }

        // pick invisível
        this.add(new THREE.Mesh(
            new THREE.SphereGeometry(this.beamHeight / 2 + 0.5, 8, 8),
            new THREE.MeshBasicMaterial({ visible: false })
        ));
    }

    update() {
        const delta = Math.min(this.clock.getDelta(), 0.05);
        this.time  += delta;
        const pulse = 0.88 + Math.sin(this.time * 12) * 0.12;

        this._coreMat.opacity = Math.min(1, pulse * this._opacity);

        this._arcs.forEach(obj => {
            obj.ttl -= delta;
            if (obj.ttl <= 0) this._refreshArc(obj);
            obj.mesh.material.opacity = Math.random() > 0.15
                ? (0.45 + Math.random() * 0.55) * this._opacity : 0;
        });

        this._forks.forEach(obj => {
            obj.ttl -= delta;
            if (obj.ttl <= 0) this._refreshFork(obj);
            obj.mesh.material.opacity = Math.random() > 0.25
                ? (0.25 + Math.random() * 0.45) * this._opacity : 0;
        });
    }

    setColor(hex) {
        this.particleColor = hex;
        const col = new THREE.Color(hex), white = new THREE.Color(1, 1, 1);
        this._arcs.forEach((obj, i)  => obj.mesh.material.color.set(i % 4 === 0 ? white : col));
        this._forks.forEach(obj      => obj.mesh.material.color.set(col.clone().lerp(white, 0.5)));
    }

    setBrightness(v) { this.brightness = v; this._opacity = Math.min(1, v / 2.5); }
    setOpacity(v)    { this._opacity = v; }
}

window.ElectricityParticleSystem = ElectricityParticleSystem;
window.createElectricity = function () { return new ElectricityParticleSystem(); };
