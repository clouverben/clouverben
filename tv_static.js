// ==================== TV STATIC PARTICLE SYSTEM ====================
// Tela de TV branca animada num plano 3D — estilo Skibidi Toilet (Astro Polycephaly)
// Sem moldura, sem modelo 3D, só o plano com textura animada.
import * as THREE from 'three';

// ── Desenha estática branca no canvas ─────────────────────────────────────────
function drawStatic(ctx, W, H, t) {
    const id = ctx.createImageData(W, H);
    const d  = id.data;

    // Scanlines: linhas pares ligeiramente mais claras
    for (let y = 0; y < H; y++) {
        const scanFactor = y % 2 === 0 ? 1.0 : 0.72;
        for (let x = 0; x < W; x++) {
            const idx = (y * W + x) * 4;
            const noise = Math.random();
            let v;
            if (noise > 0.55) {
                v = Math.floor(180 + Math.random() * 75);
            } else if (noise > 0.25) {
                v = Math.floor(60 + Math.random() * 100);
            } else {
                v = Math.floor(Math.random() * 50);
            }
            v = Math.floor(v * scanFactor);
            d[idx] = d[idx+1] = d[idx+2] = v;
            d[idx+3] = 255;
        }
    }

    ctx.putImageData(id, 0, 0);
}

// ================================================================================
class TvStaticSystem extends THREE.Object3D {
    constructor() {
        super();
        this.name = 'Tela de TV';
        this.userData.isParticle   = true;
        this.userData.particleType = 'tvStatic';

        this._scene      = null;
        this._color      = new THREE.Color('#ffffff');
        this._brightness = 1.0;
        this._opacity    = 1.0;
        this._time       = 0;
        this._built      = false;

        this._screen     = null;
        this._tex        = null;
        this._canvas     = null;
        this._ctx        = null;
        this._lastFrame  = -1;
    }

    _build(scene) {
        if (this._built) return;
        this._built = true;
        this._scene = scene;

        // Canvas 256×192 (proporção 4:3 de TV)
        const W = 256, H = 192;
        this._canvas = document.createElement('canvas');
        this._canvas.width  = W;
        this._canvas.height = H;
        this._ctx = this._canvas.getContext('2d');

        // Primeiro frame
        drawStatic(this._ctx, W, H, 0);

        this._tex = new THREE.CanvasTexture(this._canvas);
        this._tex.minFilter = THREE.LinearFilter;
        this._tex.magFilter = THREE.LinearFilter;

        // PlaneGeometry 4:3, tamanho razoável no mundo
        const geo = new THREE.PlaneGeometry(2.667, 2.0);
        const mat = new THREE.MeshBasicMaterial({
            map: this._tex,
            side: THREE.DoubleSide,
            transparent: false,
            depthWrite: true,
        });

        this._screen = new THREE.Mesh(geo, mat);
        this._screen.userData.isFXSprite = true;
        this._screen.layers.enable(1);
        this._screen.frustumCulled = false;
        scene.add(this._screen);
    }

    setColor(hex)    { this._color.set(hex); }
    setBrightness(v) { this._brightness = v; }
    setOpacity(v)    { this._opacity = v; if (this._screen) this._screen.material.opacity = v; }
    getConfig()      { return { color: '#' + this._color.getHexString(), brightness: this._brightness, opacity: this._opacity }; }

    update(dt) {
        const scene = window._nexusScene || window.scene;
        if (!this._built) this._build(scene);
        this._time += dt;

        const cam = window._nexusCamera || { quaternion: new THREE.Quaternion() };
        const wPos = new THREE.Vector3();
        this.getWorldPosition(wPos);

        // Plano sempre enfrenta a câmera, mas FICA no mundo (não é HUD)
        this._screen.position.copy(wPos);
        this._screen.quaternion.copy(cam.quaternion);

        // Redraw a 30fps
        const frame = Math.floor(this._time * 30);
        if (frame !== this._lastFrame) {
            this._lastFrame = frame;
            drawStatic(this._ctx, 256, 192, this._time);
            this._tex.needsUpdate = true;
        }
    }

    dispose() {
        if (this._screen) {
            this._scene?.remove(this._screen);
            this._screen.geometry.dispose();
            this._screen.material.dispose();
        }
        this._tex?.dispose();
    }
}

window.TvStaticSystem = TvStaticSystem;
window.createTvStatic = () => { const s = new TvStaticSystem(); s.name = 'Tela de TV'; return s; };
console.log('tv_static.js ✅');
