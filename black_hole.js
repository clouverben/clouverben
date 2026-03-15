// ==================== BLACK HOLE PARTICLE SYSTEM ====================
import * as THREE from 'three';

// ── Textura do disco — gradiente radial branco→laranja→vermelho escuro ─────────
function makeDiscTex() {
    const S = 512;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, S, S);

    // Anel principal
    const cx = S / 2;
    const innerR = S * 0.20;   // borda do horizonte de eventos
    const outerR = S * 0.495;  // borda exterior
    const g = ctx.createRadialGradient(cx, cx, innerR, cx, cx, outerR);
    g.addColorStop(0.00, 'rgba(255,255,240,1.00)');
    g.addColorStop(0.12, 'rgba(255,240,160,1.00)');
    g.addColorStop(0.28, 'rgba(255,180,40,0.95)');
    g.addColorStop(0.50, 'rgba(220,80,10,0.80)');
    g.addColorStop(0.75, 'rgba(120,20,5,0.45)');
    g.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cx, outerR, 0, Math.PI*2); ctx.fill();

    // Filamentos brilhantes sobrepostos
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 180; i++) {
        const a  = Math.random() * Math.PI * 2;
        const r  = innerR + Math.random() * (outerR - innerR) * 0.95;
        const x  = cx + Math.cos(a) * r;
        const y  = cx + Math.sin(a) * r;
        const rs = 2 + Math.random() * 9;
        const hotness = 1 - (r - innerR) / (outerR - innerR);
        const op = (0.08 + Math.random() * 0.22) * hotness;
        ctx.beginPath(); ctx.arc(x, y, rs, 0, Math.PI*2);
        if (hotness > 0.6) ctx.fillStyle = `rgba(255,255,200,${op})`;
        else if (hotness > 0.3) ctx.fillStyle = `rgba(255,160,30,${op})`;
        else ctx.fillStyle = `rgba(200,50,5,${op})`;
        ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Corta o buraco central: tudo dentro de innerR vira transparente
    ctx.globalCompositeOperation = 'destination-out';
    const hole = ctx.createRadialGradient(cx, cx, innerR * 0.55, cx, cx, innerR);
    hole.addColorStop(0, 'rgba(0,0,0,1)');
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hole;
    ctx.beginPath(); ctx.arc(cx, cx, innerR * 1.05, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    return new THREE.CanvasTexture(cv);
}

// ── Halo radial suave ─────────────────────────────────────────────────────────
function makeHaloTex(r, g, b) {
    const S = 256;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const gr = ctx.createRadialGradient(S/2,S/2,0, S/2,S/2,S/2);
    gr.addColorStop(0,    `rgba(${r},${g},${b},1.0)`);
    gr.addColorStop(0.20, `rgba(${r},${g},${b},0.75)`);
    gr.addColorStop(0.50, `rgba(${r},${g},${b},0.25)`);
    gr.addColorStop(0.80, `rgba(${r},${g},${b},0.06)`);
    gr.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, S, S);
    return new THREE.CanvasTexture(cv);
}

const _TX_DISC     = makeDiscTex();
const _TX_HALO_ORG = makeHaloTex(255, 130, 20);
const _TX_HALO_BLU = makeHaloTex(80, 140, 255);
const _TX_HALO_WHT = makeHaloTex(255, 240, 200);

// ================================================================================
class BlackHoleSystem extends THREE.Object3D {
    constructor() {
        super();
        this.name = 'Buraco Negro';
        this.userData.isParticle   = true;
        this.userData.particleType = 'blackHole';
        this._scene = null; this._color = new THREE.Color('#ff8820');
        this._brightness = 1.0; this._opacity = 1.0; this._time = 0; this._built = false;
        this._parts = [];
    }

    _add(geo, mat, scene) {
        const m = new THREE.Mesh(geo, mat);
        m.userData.isFXSprite = true; m.layers.enable(1); m.frustumCulled = false;
        scene.add(m); this._parts.push(m); return m;
    }

    _build(scene) {
        if (this._built) return;
        this._built = true; this._scene = scene;

        // ── Horizonte de eventos ──────────────────────────────────────────
        this._event = this._add(
            new THREE.SphereGeometry(0.48, 48, 48),
            new THREE.MeshBasicMaterial({ color: 0x000000 }),
            scene
        );

        // ── Disco de acreção (CircleGeometry achatado) ────────────────────
        this._disc = this._add(
            new THREE.CircleGeometry(2.5, 128),
            new THREE.MeshBasicMaterial({
                map: _TX_DISC, side: THREE.DoubleSide,
                transparent: true, depthWrite: false,
                blending: THREE.AdditiveBlending,
            }),
            scene
        );

        // ── Anel de fóton — torus muito fino e brilhante ──────────────────
        this._photon = this._add(
            new THREE.TorusGeometry(0.52, 0.022, 6, 120),
            new THREE.MeshBasicMaterial({
                color: new THREE.Color('#fffde0'),
                transparent: true, opacity: 1.0,
                blending: THREE.AdditiveBlending, depthWrite: false,
                side: THREE.DoubleSide,
            }),
            scene
        );
        // Segundo anel — ligeiramente mais externo, menos brilhante
        this._photon2 = this._add(
            new THREE.TorusGeometry(0.58, 0.010, 6, 120),
            new THREE.MeshBasicMaterial({
                color: new THREE.Color('#ffcc88'),
                transparent: true, opacity: 0.65,
                blending: THREE.AdditiveBlending, depthWrite: false,
                side: THREE.DoubleSide,
            }),
            scene
        );

        // ── Halos encaram câmera ──────────────────────────────────────────
        this._haloOrg = this._add(
            new THREE.PlaneGeometry(4.0, 4.0),
            new THREE.MeshBasicMaterial({
                map: _TX_HALO_ORG, transparent: true, depthWrite: false,
                blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            }),
            scene
        );
        this._haloWht = this._add(
            new THREE.PlaneGeometry(2.2, 2.2),
            new THREE.MeshBasicMaterial({
                map: _TX_HALO_WHT, transparent: true, depthWrite: false,
                blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            }),
            scene
        );
        this._haloBlu = this._add(
            new THREE.PlaneGeometry(7.0, 7.0),
            new THREE.MeshBasicMaterial({
                map: _TX_HALO_BLU, transparent: true, depthWrite: false,
                blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            }),
            scene
        );

        // ── Jatos polares — cilindros afinados ────────────────────────────
        this._jets = [];
        for (let s = 0; s < 2; s++) {
            const j = this._add(
                new THREE.CylinderGeometry(0.015, 0.08, 4.5, 8),
                new THREE.MeshBasicMaterial({
                    color: new THREE.Color('#99ddff'),
                    transparent: true, opacity: 0.50,
                    blending: THREE.AdditiveBlending, depthWrite: false,
                    side: THREE.DoubleSide,
                }),
                scene
            );
            j.rotation.z = s === 0 ? 0 : Math.PI;
            this._jets.push(j);
        }

        // Inclinação do disco (~20°)
        this._tiltX = 0.35;
        this._tiltZ = 0.15;
    }

    setColor(hex)    { this._color.set(hex); }
    setBrightness(v) { this._brightness = v; }
    setOpacity(v)    { this._opacity = v; }
    getConfig()      { return { color:'#'+this._color.getHexString(), brightness:this._brightness, opacity:this._opacity }; }

    update(dt) {
        const scene = window._nexusScene || window.scene;
        if (!this._built) this._build(scene);
        this._time += dt;
        const t  = this._time;
        const br = this._brightness * this._opacity;
        const cam = window._nexusCamera || { quaternion: new THREE.Quaternion() };

        const wPos = new THREE.Vector3();
        this.getWorldPosition(wPos);
        const p = m => m.position.copy(wPos);

        // Horizonte imóvel
        p(this._event);

        // Disco girando
        p(this._disc);
        this._disc.rotation.set(Math.PI/2 + this._tiltX, t * 0.20, this._tiltZ);
        const df = 0.85 + Math.sin(t * 2.3) * 0.08;
        this._disc.material.opacity = df * br;

        // Anel de fóton — alinhado com o disco
        p(this._photon);
        this._photon.rotation.set(Math.PI/2 + this._tiltX, 0, this._tiltZ);
        const pf = 0.90 + Math.sin(t * 8) * 0.06;
        this._photon.material.opacity  = pf * br;

        p(this._photon2);
        this._photon2.rotation.copy(this._photon.rotation);
        this._photon2.material.opacity = 0.60 * pf * br;

        // Halos encaram câmera
        const gf = 0.80 + Math.sin(t * 4) * 0.10;
        p(this._haloOrg); this._haloOrg.quaternion.copy(cam.quaternion); this._haloOrg.material.opacity = 0.55 * gf * br;
        p(this._haloWht); this._haloWht.quaternion.copy(cam.quaternion); this._haloWht.material.opacity = 0.70 * gf * br;
        p(this._haloBlu); this._haloBlu.quaternion.copy(cam.quaternion); this._haloBlu.material.opacity = 0.09 * br;

        // Jatos
        this._jets.forEach((j, i) => {
            j.position.set(wPos.x, wPos.y + (i===0?2.4:-2.4), wPos.z);
            const jp = 0.60 + Math.sin(t * 7 + i * 1.9) * 0.20;
            j.material.opacity = 0.45 * jp * br;
        });
    }

    dispose() {
        this._parts.forEach(m => {
            this._scene?.remove(m);
            m.geometry.dispose(); m.material.dispose();
        });
        [_TX_DISC, _TX_HALO_ORG, _TX_HALO_BLU, _TX_HALO_WHT].forEach(t => t.dispose());
    }
}

window.BlackHoleSystem = BlackHoleSystem;
window.createBlackHole = () => { const s = new BlackHoleSystem(); s.name = 'Buraco Negro'; return s; };
console.log('black_hole.js ✅');
