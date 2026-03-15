// ==================== PHYSICS SYSTEM ====================
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const _wPos  = new THREE.Vector3();
const _wQuat = new THREE.Quaternion();
const _bboxC = new THREE.Vector3();
const _bboxS = new THREE.Vector3();

class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -20, 0);   // mais pesado = cai mais natural
        this.world.broadphase  = new CANNON.SAPBroadphase(this.world);
        this.world.allowSleep  = true;
        this.world.solver.iterations = 10;

        // Contato padrão simples — sem stiffness exagerada
        this.world.defaultContactMaterial.friction    = 0.4;
        this.world.defaultContactMaterial.restitution = 0.2;

        // Chão (y = 0)
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(new CANNON.Plane());
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(groundBody);

        this.bodies       = new Map();
        this.isSimulating = false;

        // Passo simples: 60 Hz, até 3 substeps
        this._fixedStep = 1 / 60;
        this._maxSubs   = 3;
    }

    // ── Shape a partir do bbox do mesh ────────────────────────────────────
    _createShape(mesh, shapeType) {
        const bbox = new THREE.Box3().setFromObject(mesh);
        bbox.getSize(_bboxS);
        bbox.getCenter(_bboxC);

        _bboxS.x = Math.max(_bboxS.x, 0.05);
        _bboxS.y = Math.max(_bboxS.y, 0.05);
        _bboxS.z = Math.max(_bboxS.z, 0.05);

        mesh.getWorldPosition(_wPos);
        const offset = new CANNON.Vec3(
            _bboxC.x - _wPos.x,
            _bboxC.y - _wPos.y,
            _bboxC.z - _wPos.z,
        );

        let shape;
        if (shapeType === 'sphere') {
            shape = new CANNON.Sphere(Math.max(_bboxS.x, _bboxS.y, _bboxS.z) / 2);
        } else if (shapeType === 'cylinder') {
            shape = new CANNON.Cylinder(_bboxS.x / 2, _bboxS.x / 2, _bboxS.y, 12);
        } else {
            shape = new CANNON.Box(new CANNON.Vec3(_bboxS.x / 2, _bboxS.y / 2, _bboxS.z / 2));
        }

        return { shape, offset };
    }

    // ── Adiciona corpo físico ─────────────────────────────────────────────
    addBody(mesh, options = {}) {
        const {
            type        = 'dynamic',
            shape       = 'auto',
            mass        = 1,
            friction    = 0.4,
            restitution = 0.2,
        } = options;

        this.removeBody(mesh);

        const { shape: cannonShape, offset } = this._createShape(
            mesh, shape === 'auto' ? 'box' : shape
        );

        const bodyMass = (type === 'static' || type === 'kinematic') ? 0 : mass;

        const body = new CANNON.Body({ mass: bodyMass });
        body.addShape(cannonShape, offset);

        // Amortecimento mínimo — não atrapalha a queda
        body.linearDamping  = 0.01;
        body.angularDamping = 0.05;

        // CCD: evita tunelamento em objetos rápidos
        body.ccdSpeedThreshold = 0.5;
        body.ccdIterations     = 8;

        // Posição inicial em espaço mundial (corrige bug com objetos filhos)
        mesh.getWorldPosition(_wPos);
        mesh.getWorldQuaternion(_wQuat);
        body.position.set(_wPos.x, _wPos.y, _wPos.z);
        body.quaternion.set(_wQuat.x, _wQuat.y, _wQuat.z, _wQuat.w);

        if (type === 'kinematic') body.type = CANNON.Body.KINEMATIC;

        this.world.addBody(body);

        this.bodies.set(mesh.uuid, {
            body, mesh, type,
            originalPosition:   mesh.position.clone(),
            originalQuaternion: mesh.quaternion.clone(),
        });

        mesh.userData.hasPhysics         = true;
        mesh.userData.physicsType        = type;
        mesh.userData.physicsMass        = mass;
        mesh.userData.physicsShape       = shape;
        mesh.userData.physicsFriction    = friction;
        mesh.userData.physicsRestitution = restitution;

        return body;
    }

    // ── Remove corpo físico ───────────────────────────────────────────────
    removeBody(mesh) {
        if (!mesh) return;
        const entry = this.bodies.get(mesh.uuid);
        if (entry) {
            this.world.removeBody(entry.body);
            this.bodies.delete(mesh.uuid);
        }
        mesh.userData.hasPhysics = false;
    }

    // ── Simular ───────────────────────────────────────────────────────────
    start() {
        this.isSimulating = true;
        this.bodies.forEach(({ body }) => body.wakeUp());
        console.log('[Physics] ▶', this.bodies.size, 'corpos');
    }

    stop() {
        this.isSimulating = false;
        console.log('[Physics] ⏹');
    }

    reset() {
        this.bodies.forEach(({ body, mesh, originalPosition, originalQuaternion }) => {
            mesh.position.copy(originalPosition);
            mesh.quaternion.copy(originalQuaternion);

            mesh.getWorldPosition(_wPos);
            mesh.getWorldQuaternion(_wQuat);

            body.position.set(_wPos.x, _wPos.y, _wPos.z);
            body.quaternion.set(_wQuat.x, _wQuat.y, _wQuat.z, _wQuat.w);
            body.velocity.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);
            body.force.set(0, 0, 0);
            body.torque.set(0, 0, 0);
            body.wakeUp();
        });
        console.log('[Physics] ↺ Reset');
    }

    // ── Teletransporta o corpo Cannon para a posição atual da mesh ────────
    // Chame ao finalizar um movimento de gizmo sobre um objeto com física.
    // No main.js: window.PhysicsSystem.teleportBody(mesh)
    teleportBody(mesh) {
        const entry = this.bodies.get(mesh.uuid);
        if (!entry) return;
        mesh.getWorldPosition(_wPos);
        mesh.getWorldQuaternion(_wQuat);
        entry.body.position.set(_wPos.x, _wPos.y, _wPos.z);
        entry.body.quaternion.set(_wQuat.x, _wQuat.y, _wQuat.z, _wQuat.w);
        entry.body.velocity.set(0, 0, 0);
        entry.body.angularVelocity.set(0, 0, 0);
        entry.body.wakeUp();
        // Atualiza posição de reset para o novo local
        entry.originalPosition.copy(mesh.position);
        entry.originalQuaternion.copy(mesh.quaternion);
    }

    // ── Update (chamar no loop de animação) ───────────────────────────────
    update(deltaMs) {
        if (!this.isSimulating || this.bodies.size === 0) return;

        const delta = Math.min(deltaMs / 1000, 0.05);
        this.world.step(this._fixedStep, delta, this._maxSubs);

        this.bodies.forEach(({ body, mesh, type }) => {
            if (type === 'static') return;

            // Se o gizmo está arrastando este objeto, sincroniza o corpo
            // Cannon com a mesh (e não o contrário) para não cancelar o movimento.
            if (mesh.userData._gizmoMoving) {
                mesh.getWorldPosition(_wPos);
                mesh.getWorldQuaternion(_wQuat);
                body.position.set(_wPos.x, _wPos.y, _wPos.z);
                body.quaternion.set(_wQuat.x, _wQuat.y, _wQuat.z, _wQuat.w);
                body.velocity.set(0, 0, 0);
                body.angularVelocity.set(0, 0, 0);
                return; // não sobrescreve a mesh
            }

            const parent = mesh.parent;
            if (parent && parent.type !== 'Scene') {
                _wPos.set(body.position.x, body.position.y, body.position.z);
                _wQuat.set(
                    body.quaternion.x, body.quaternion.y,
                    body.quaternion.z, body.quaternion.w
                );
                parent.worldToLocal(_wPos);
                mesh.position.copy(_wPos);

                const pq = new THREE.Quaternion();
                parent.getWorldQuaternion(pq);
                mesh.quaternion.copy(pq.invert().multiply(_wQuat));
            } else {
                mesh.position.set(body.position.x, body.position.y, body.position.z);
                mesh.quaternion.set(
                    body.quaternion.x, body.quaternion.y,
                    body.quaternion.z, body.quaternion.w
                );
            }
        });
    }

    // ── Extras ────────────────────────────────────────────────────────────
    applyImpulse(mesh, forceVec, pointVec = null) {
        const entry = this.bodies.get(mesh.uuid);
        if (!entry) return;
        const f = new CANNON.Vec3(forceVec.x, forceVec.y, forceVec.z);
        const p = pointVec
            ? new CANNON.Vec3(pointVec.x, pointVec.y, pointVec.z)
            : entry.body.position;
        entry.body.applyImpulse(f, p);
        entry.body.wakeUp();
    }

    setGravity(x, y, z) { this.world.gravity.set(x, y, z); }

    getBodyOptions(mesh) {
        if (!mesh?.userData.hasPhysics) return null;
        return {
            type:        mesh.userData.physicsType        || 'dynamic',
            shape:       mesh.userData.physicsShape       || 'auto',
            mass:        mesh.userData.physicsMass        ?? 1,
            friction:    mesh.userData.physicsFriction    ?? 0.4,
            restitution: mesh.userData.physicsRestitution ?? 0.2,
        };
    }

    get bodyCount() { return this.bodies.size; }
}

// ==================== INSTÂNCIA GLOBAL ====================
const physicsSystem = new PhysicsWorld();
window.PhysicsSystem = physicsSystem;

// ==================== UI ====================
function initPhysicsUI() {
    const toggle      = document.getElementById('physics-toggle');
    const subControls = document.getElementById('physics-sub-controls');
    const bodyTypeEl  = document.getElementById('physics-body-type');
    const shapeEl     = document.getElementById('physics-shape');
    const massSlider  = document.getElementById('physics-mass');
    const massNum     = document.getElementById('physics-mass-num');
    const fricSlider  = document.getElementById('physics-friction');
    const fricNum     = document.getElementById('physics-friction-num');
    const restSlider  = document.getElementById('physics-restitution');
    const restNum     = document.getElementById('physics-restitution-num');
    const simBtn      = document.getElementById('physics-simulate-btn');
    const stopBtn     = document.getElementById('physics-stop-btn');
    const resetBtn    = document.getElementById('physics-reset-btn');

    function syncUI(obj) {
        if (!toggle || !subControls) return;
        if (!obj) { toggle.checked = false; subControls.style.display = 'none'; return; }
        toggle.checked = !!obj.userData.hasPhysics;
        subControls.style.display = obj.userData.hasPhysics ? 'block' : 'none';
        if (obj.userData.hasPhysics) {
            if (bodyTypeEl) bodyTypeEl.value = obj.userData.physicsType        || 'dynamic';
            if (shapeEl)    shapeEl.value    = obj.userData.physicsShape       || 'auto';
            if (massSlider) massSlider.value = obj.userData.physicsMass        ?? 1;
            if (massNum)    massNum.value    = obj.userData.physicsMass        ?? 1;
            if (fricSlider) fricSlider.value = obj.userData.physicsFriction    ?? 0.4;
            if (fricNum)    fricNum.value    = obj.userData.physicsFriction    ?? 0.4;
            if (restSlider) restSlider.value = obj.userData.physicsRestitution ?? 0.2;
            if (restNum)    restNum.value    = obj.userData.physicsRestitution ?? 0.2;
        }
    }

    window.onActiveObjectChanged = syncUI;

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

    function currentOptions() {
        return {
            type:        bodyTypeEl?.value            || 'dynamic',
            shape:       shapeEl?.value               || 'auto',
            mass:        parseFloat(massSlider?.value ?? 1),
            friction:    parseFloat(fricSlider?.value ?? 0.4),
            restitution: parseFloat(restSlider?.value ?? 0.2),
        };
    }

    function rebuildBody(obj) {
        if (obj) physicsSystem.addBody(obj, currentOptions());
    }

    function onPropChange() {
        const obj = window.activeObject;
        if (obj?.userData.hasPhysics) rebuildBody(obj);
    }

    if (bodyTypeEl) bodyTypeEl.addEventListener('change', onPropChange);
    if (shapeEl)    shapeEl.addEventListener('change',    onPropChange);

    function linkSlider(s, n) {
        if (!s || !n) return;
        s.addEventListener('input', e => { n.value = e.target.value; onPropChange(); });
        n.addEventListener('input', e => { s.value = e.target.value; onPropChange(); });
    }
    linkSlider(massSlider, massNum);
    linkSlider(fricSlider,  fricNum);
    linkSlider(restSlider,  restNum);

    simBtn?.addEventListener('click', () => {
        physicsSystem.start();
        simBtn.classList.add('hidden');
        stopBtn?.classList.remove('hidden');
    });
    stopBtn?.addEventListener('click', () => {
        physicsSystem.stop();
        stopBtn.classList.add('hidden');
        simBtn?.classList.remove('hidden');
    });
    resetBtn?.addEventListener('click', () => physicsSystem.reset());
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPhysicsUI);
} else {
    initPhysicsUI();
}

export { physicsSystem };
