// ==================== PHYSICS SYSTEM ====================
// Usa cannon-es para simulação de física
// Importado via importmap (adicione ao index.html)

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0),
        });
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.allowSleep = true;
        this.world.defaultContactMaterial.friction    = 0.3;
        this.world.defaultContactMaterial.restitution = 0.3;

        // Plano de chão invisível em y = 0
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(new CANNON.Plane());
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(groundBody);
        this._groundBody = groundBody;

        // Map: mesh.uuid -> { body, mesh, originalPosition, originalQuaternion }
        this.bodies      = new Map();
        this.isSimulating = false;
        this._fixedStep   = 1 / 60;
        this._maxSubs     = 3;
        this._lastTime    = null;
    }

    // ── Criar shape automático baseado no bbox do mesh ───────────────────────
    _createShape(mesh, shapeType) {
        const bbox = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3();
        bbox.getSize(size);

        // garante tamanho mínimo para evitar corpo degenerado
        size.x = Math.max(size.x, 0.05);
        size.y = Math.max(size.y, 0.05);
        size.z = Math.max(size.z, 0.05);

        if (shapeType === 'sphere') {
            return new CANNON.Sphere(Math.max(size.x, size.y, size.z) / 2);
        }
        if (shapeType === 'cylinder') {
            return new CANNON.Cylinder(size.x / 2, size.x / 2, size.y, 16);
        }
        // default: box / auto
        return new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
    }

    // ── Adiciona corpo físico a um mesh ──────────────────────────────────────
    addBody(mesh, options = {}) {
        const {
            type        = 'dynamic',
            shape       = 'auto',
            mass        = 1,
            friction    = 0.3,
            restitution = 0.3,
        } = options;

        this.removeBody(mesh); // remove anterior se existir

        const cannonShape = this._createShape(mesh, shape === 'auto' ? 'box' : shape);
        const bodyMass    = type === 'static' ? 0 : (type === 'kinematic' ? 0 : mass);

        const mat = new CANNON.Material();
        mat.friction    = friction;
        mat.restitution = restitution;

        const body = new CANNON.Body({ mass: bodyMass, material: mat });
        body.addShape(cannonShape);
        body.linearDamping  = 0.1;
        body.angularDamping = 0.1;

        // Posição / rotação iniciais do mesh
        body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
        body.quaternion.set(
            mesh.quaternion.x, mesh.quaternion.y,
            mesh.quaternion.z, mesh.quaternion.w
        );

        if (type === 'kinematic') body.type = CANNON.Body.KINEMATIC;

        this.world.addBody(body);
        this.bodies.set(mesh.uuid, {
            body,
            mesh,
            type,
            originalPosition: mesh.position.clone(),
            originalQuaternion: mesh.quaternion.clone(),
        });

        mesh.userData.hasPhysics  = true;
        mesh.userData.physicsType = type;
        mesh.userData.physicsMass = mass;
        mesh.userData.physicsShape = shape;
        mesh.userData.physicsFriction    = friction;
        mesh.userData.physicsRestitution = restitution;

        return body;
    }

    // ── Remove corpo físico de um mesh ───────────────────────────────────────
    removeBody(mesh) {
        if (!mesh) return;
        const entry = this.bodies.get(mesh.uuid);
        if (entry) {
            this.world.removeBody(entry.body);
            this.bodies.delete(mesh.uuid);
        }
        mesh.userData.hasPhysics = false;
    }

    // ── Iniciar simulação ────────────────────────────────────────────────────
    start() {
        this.isSimulating = true;
        this._lastTime    = null;
        console.log('[Physics] ▶ Simulação iniciada —', this.bodies.size, 'corpos ativos');
    }

    // ── Parar simulação ──────────────────────────────────────────────────────
    stop() {
        this.isSimulating = false;
        console.log('[Physics] ⏹ Simulação parada');
    }

    // ── Resetar posições para o estado original ──────────────────────────────
    reset() {
        this.bodies.forEach(({ body, mesh, originalPosition, originalQuaternion }) => {
            // Reseta mesh
            mesh.position.copy(originalPosition);
            mesh.quaternion.copy(originalQuaternion);
            // Reseta corpo cannon
            body.position.set(originalPosition.x, originalPosition.y, originalPosition.z);
            body.quaternion.set(
                originalQuaternion.x, originalQuaternion.y,
                originalQuaternion.z, originalQuaternion.w
            );
            body.velocity.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);
            body.wakeUp();
        });
        console.log('[Physics] ↺ Posições resetadas');
    }

    // ── Atualizar mundo físico (chamar no loop de animação) ──────────────────
    update(deltaMs) {
        if (!this.isSimulating || this.bodies.size === 0) return;
        const delta = Math.min(deltaMs / 1000, 0.05); // cap 50ms
        this.world.step(this._fixedStep, delta, this._maxSubs);

        this.bodies.forEach(({ body, mesh, type }) => {
            if (type === 'static') return;
            mesh.position.set(body.position.x, body.position.y, body.position.z);
            mesh.quaternion.set(
                body.quaternion.x, body.quaternion.y,
                body.quaternion.z, body.quaternion.w
            );
        });
    }

    // ── Retorna opções salvas de um mesh ─────────────────────────────────────
    getBodyOptions(mesh) {
        if (!mesh || !mesh.userData.hasPhysics) return null;
        return {
            type:        mesh.userData.physicsType        || 'dynamic',
            shape:       mesh.userData.physicsShape       || 'auto',
            mass:        mesh.userData.physicsMass        ?? 1,
            friction:    mesh.userData.physicsFriction    ?? 0.3,
            restitution: mesh.userData.physicsRestitution ?? 0.3,
        };
    }
}

// ==================== INSTÂNCIA GLOBAL ====================
const physicsSystem = new PhysicsWorld();
window.PhysicsSystem = physicsSystem;

// ==================== UI HANDLERS ====================
function initPhysicsUI() {
    const toggle       = document.getElementById('physics-toggle');
    const subControls  = document.getElementById('physics-sub-controls');
    const bodyTypeEl   = document.getElementById('physics-body-type');
    const shapeEl      = document.getElementById('physics-shape');
    const massSlider   = document.getElementById('physics-mass');
    const massNum      = document.getElementById('physics-mass-num');
    const fricSlider   = document.getElementById('physics-friction');
    const fricNum      = document.getElementById('physics-friction-num');
    const restSlider   = document.getElementById('physics-restitution');
    const restNum      = document.getElementById('physics-restitution-num');
    const simBtn       = document.getElementById('physics-simulate-btn');
    const stopBtn      = document.getElementById('physics-stop-btn');
    const resetBtn     = document.getElementById('physics-reset-btn');

    // Atualiza visual do painel para o objeto ativo
    function syncUI(obj) {
        if (!toggle || !subControls) return;
        if (!obj) { toggle.checked = false; subControls.style.display = 'none'; return; }
        toggle.checked = !!obj.userData.hasPhysics;
        subControls.style.display = obj.userData.hasPhysics ? 'block' : 'none';
        if (obj.userData.hasPhysics) {
            if (bodyTypeEl)  bodyTypeEl.value  = obj.userData.physicsType        || 'dynamic';
            if (shapeEl)     shapeEl.value     = obj.userData.physicsShape       || 'auto';
            if (massSlider)  massSlider.value  = obj.userData.physicsMass        ?? 1;
            if (massNum)     massNum.value     = obj.userData.physicsMass        ?? 1;
            if (fricSlider)  fricSlider.value  = obj.userData.physicsFriction    ?? 0.3;
            if (fricNum)     fricNum.value     = obj.userData.physicsFriction    ?? 0.3;
            if (restSlider)  restSlider.value  = obj.userData.physicsRestitution ?? 0.3;
            if (restNum)     restNum.value     = obj.userData.physicsRestitution ?? 0.3;
        }
    }

    // Hook: main.js chama window.onActiveObjectChanged ao trocar seleção
    window.onActiveObjectChanged = syncUI;

    // ── Toggle física ────────────────────────────────────────────────────────
    if (toggle) {
        toggle.addEventListener('change', e => {
            const obj = window.activeObject;
            if (!obj) { toggle.checked = false; return; }
            if (e.target.checked) {
                subControls.style.display = 'block';
                rebuildBody(obj);
            } else {
                subControls.style.display = 'none';
                physicsSystem.removeBody(obj);
            }
        });
    }

    // ── Recria corpo com as opções atuais da UI ──────────────────────────────
    function rebuildBody(obj) {
        if (!obj) return;
        physicsSystem.addBody(obj, currentOptions());
    }

    function currentOptions() {
        return {
            type:        bodyTypeEl?.value           || 'dynamic',
            shape:       shapeEl?.value              || 'auto',
            mass:        parseFloat(massSlider?.value  ?? 1),
            friction:    parseFloat(fricSlider?.value  ?? 0.3),
            restitution: parseFloat(restSlider?.value  ?? 0.3),
        };
    }

    // Ao mudar qualquer propriedade → recria o corpo
    function onPropChange() {
        const obj = window.activeObject;
        if (obj && obj.userData.hasPhysics) rebuildBody(obj);
    }

    if (bodyTypeEl) bodyTypeEl.addEventListener('change', onPropChange);
    if (shapeEl)    shapeEl.addEventListener('change', onPropChange);

    function linkSlider(slider, num) {
        if (!slider || !num) return;
        slider.addEventListener('input', e => { num.value = e.target.value; onPropChange(); });
        num.addEventListener('input',   e => { slider.value = e.target.value; onPropChange(); });
    }
    linkSlider(massSlider, massNum);
    linkSlider(fricSlider, fricNum);
    linkSlider(restSlider, restNum);

    // ── Simular / Parar / Resetar ────────────────────────────────────────────
    if (simBtn) {
        simBtn.addEventListener('click', () => {
            physicsSystem.start();
            simBtn.classList.add('hidden');
            stopBtn?.classList.remove('hidden');
        });
    }
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            physicsSystem.stop();
            stopBtn.classList.add('hidden');
            simBtn?.classList.remove('hidden');
        });
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            physicsSystem.reset();
        });
    }
}

// Inicializa após DOM estar pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPhysicsUI);
} else {
    initPhysicsUI();
}

export { physicsSystem };
