// ============================================================
//  simulation.js — Blender-like Physics Simulations
//  Rigid Body (Rapier WASM), Soft Body/Jelly (spring-mass),
//  Cloth, Water/SPH with Rapier collision
// ============================================================

import * as THREE from 'three';
import { app, markSceneDirty } from './scene.js';

// ─── Rapier lazy loader ───────────────────────────────────────────────────────
let RAPIER = null;
async function loadRapier() {
  if (RAPIER) return RAPIER;
  const mod = await import('https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/rapier.min.js');
  await mod.init();
  RAPIER = mod;
  return RAPIER;
}

// ─── Global state ─────────────────────────────────────────────────────────────
let _world       = null;   // single Rapier world (shared by rigid + water)
let _gravity     = new THREE.Vector3(0, -9.81, 0);
let _running     = false;
let _clock       = new THREE.Clock(false);
let _rigidBodies = [];     // [{obj, body, collider}]
let _staticColls = [];     // static colliders for scene objects (water collision)
let _softBodies  = [];     // [{obj, mesh, posAttr, restPos, vel, _origGeo}]
let _clothBodies = [];     // [{obj, mesh, posAttr, vel, pinned, springs}]
let _waterSims   = [];     // [{obj, pts, pos, vel, posAttr, prm, collidersCache}]
let _forceFlds   = [];

// Jelly gizmo-drag tracking
const _prevObjPos = new THREE.Vector3();
let   _prevDragObj = null;

// ════════════════════════════════════════════════════════════
//  SIM TYPES & DEFAULTS
// ════════════════════════════════════════════════════════════
export const SIM_TYPES = {
  RIGID: 'rigid',
  JELLY: 'jelly',
  CLOTH: 'cloth',
  WATER: 'water',
  NONE:  'none',
};

export const SIM_DEFAULTS = {
  rigid: { mass: 1, friction: 0.5, restitution: 0.3, linearDamp: 0.05, angularDamp: 0.05, shape: 'box', isStatic: false },
  jelly: { stiffness: 80, damping: 6, pressure: 0.2 },
  cloth: { stiffness: 30, shear: 20, bend: 10, damping: 5, mass: 0.3, pinTop: true, wind: false },
  water: { viscosity: 0.015, count: 300, radius: 0.1, restitution: 0.05, friction: 0.1 },
};

// ════════════════════════════════════════════════════════════
//  RAPIER WORLD INIT
// ════════════════════════════════════════════════════════════
async function _ensureWorld() {
  if (_world) return;
  const R = await loadRapier();
  _world = new R.World({ x: _gravity.x, y: _gravity.y, z: _gravity.z });
  // Add static floor collider
  const floorDesc = R.ColliderDesc.cuboid(500, 0.05, 500)
    .setTranslation(0, -0.05, 0)
    .setFriction(0.5)
    .setRestitution(0.2);
  _world.createCollider(floorDesc);
}

// ════════════════════════════════════════════════════════════
//  RIGID BODY
// ════════════════════════════════════════════════════════════
async function _addRigidBody(obj) {
  const R = await loadRapier();
  await _ensureWorld();
  const p = obj.userData.simulation?.params ?? SIM_DEFAULTS.rigid;

  const box  = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(); box.getSize(size);
  const half = size.multiplyScalar(0.5);

  let shapeDesc;
  switch (p.shape) {
    case 'sphere': shapeDesc = R.ColliderDesc.ball(Math.max(half.x, half.y, half.z)); break;
    case 'hull': {
      const verts = _meshVertices(obj);
      shapeDesc = verts.length >= 12
        ? (R.ColliderDesc.convexHull(verts) ?? R.ColliderDesc.cuboid(half.x, half.y, half.z))
        : R.ColliderDesc.cuboid(half.x, half.y, half.z);
      break;
    }
    default: shapeDesc = R.ColliderDesc.cuboid(half.x, half.y, half.z);
  }
  shapeDesc.setFriction(p.friction).setRestitution(p.restitution);

  const pos = obj.getWorldPosition(new THREE.Vector3());
  const rot = obj.getWorldQuaternion(new THREE.Quaternion());

  const rbDesc = p.isStatic
    ? R.RigidBodyDesc.fixed()
    : R.RigidBodyDesc.dynamic()
        .setLinearDamping(p.linearDamp)
        .setAngularDamping(p.angularDamp)
        .setAdditionalMass(p.mass);

  rbDesc.setTranslation(pos.x, pos.y, pos.z);
  rbDesc.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });

  const body     = _world.createRigidBody(rbDesc);
  const collider = _world.createCollider(shapeDesc, body);
  _rigidBodies.push({ obj, body, collider });
}

function _meshVertices(obj) {
  const verts = [];
  obj.traverse(child => {
    if (!child.isMesh) return;
    const pos = child.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++)
      verts.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  });
  return new Float32Array(verts);
}

function _tickRigidBodies(dt) {
  if (!_world) return;
  _world.timestep = Math.min(dt, 0.033);
  _world.step();
  for (const rb of _rigidBodies) {
    if (!rb.body || rb.body.isFixed()) continue;
    const t = rb.body.translation();
    const r = rb.body.rotation();
    rb.obj.position.set(t.x, t.y, t.z);
    rb.obj.quaternion.set(r.x, r.y, r.z, r.w);
  }
}

// ════════════════════════════════════════════════════════════
//  SOFT BODY / JELLY
// ════════════════════════════════════════════════════════════
function _buildJellyBody(obj) {
  const mesh = _firstMesh(obj);
  if (!mesh) return;
  const geo     = mesh.geometry.clone();
  mesh.geometry = geo;
  const posAttr = geo.attributes.position;
  const n       = posAttr.count;
  const restPos = new Float32Array(n * 3);
  const vel     = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    restPos[i*3]   = posAttr.getX(i);
    restPos[i*3+1] = posAttr.getY(i);
    restPos[i*3+2] = posAttr.getZ(i);
  }
  _softBodies.push({ obj, mesh, posAttr, restPos, vel, _origGeo: mesh.geometry });
}

function _tickJelly(dt) {
  for (const sb of _softBodies) {
    const prm = sb.obj.userData.simulation?.params ?? SIM_DEFAULTS.jelly;
    const k   = prm.stiffness;
    const dmp = prm.damping;
    const n   = sb.posAttr.count;
    let ix = 0, iy = 0, iz = 0;
    if (_prevDragObj === sb.obj && app.transformControls?.dragging) {
      const cur = sb.obj.position;
      ix = (_prevObjPos.x - cur.x) * 14;
      iy = (_prevObjPos.y - cur.y) * 14;
      iz = (_prevObjPos.z - cur.z) * 14;
    }
    for (let i = 0; i < n; i++) {
      const xi = sb.posAttr.getX(i), yi = sb.posAttr.getY(i), zi = sb.posAttr.getZ(i);
      const rx = sb.restPos[i*3], ry = sb.restPos[i*3+1], rz = sb.restPos[i*3+2];
      const fx = -k*(xi-rx) + ix - dmp*sb.vel[i*3];
      const fy = -k*(yi-ry) + iy - dmp*sb.vel[i*3+1];
      const fz = -k*(zi-rz) + iz - dmp*sb.vel[i*3+2];
      sb.vel[i*3]   += fx*dt;
      sb.vel[i*3+1] += fy*dt;
      sb.vel[i*3+2] += fz*dt;
      sb.posAttr.setXYZ(i,
        xi + sb.vel[i*3]*dt,
        yi + sb.vel[i*3+1]*dt,
        zi + sb.vel[i*3+2]*dt);
    }
    sb.posAttr.needsUpdate = true;
    sb.mesh.geometry.computeVertexNormals();
  }
}

// ════════════════════════════════════════════════════════════
//  CLOTH
// ════════════════════════════════════════════════════════════
function _buildClothBody(obj) {
  const mesh = _firstMesh(obj);
  if (!mesh) return;
  const geo  = mesh.geometry.clone();
  mesh.geometry = geo;
  const posAttr = geo.attributes.position;
  const n       = posAttr.count;
  const vel     = new Float32Array(n * 3);
  const pinned  = new Uint8Array(n);
  const prm     = obj.userData.simulation?.params ?? SIM_DEFAULTS.cloth;
  if (prm.pinTop) {
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) maxY = Math.max(maxY, posAttr.getY(i));
    for (let i = 0; i < n; i++) if (posAttr.getY(i) >= maxY - 0.01) pinned[i] = 1;
  }
  const springs = [];
  const idx     = geo.index ? geo.index.array : null;
  const visited = new Set();
  function addSpring(a, b) {
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    if (visited.has(key)) return; visited.add(key);
    const dx = posAttr.getX(a)-posAttr.getX(b);
    const dy = posAttr.getY(a)-posAttr.getY(b);
    const dz = posAttr.getZ(a)-posAttr.getZ(b);
    springs.push({ a, b, rest: Math.sqrt(dx*dx+dy*dy+dz*dz) });
  }
  if (idx) for (let i = 0; i < idx.length; i += 3) {
    addSpring(idx[i], idx[i+1]);
    addSpring(idx[i+1], idx[i+2]);
    addSpring(idx[i+2], idx[i]);
  }
  _clothBodies.push({ obj, mesh, posAttr, vel, pinned, springs });
}

function _tickCloth(dt) {
  for (const cb of _clothBodies) {
    const prm = cb.obj.userData.simulation?.params ?? SIM_DEFAULTS.cloth;
    const n   = cb.posAttr.count;
    const fx  = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      if (!cb.pinned[i]) {
        fx[i*3]   += _gravity.x * prm.mass;
        fx[i*3+1] += _gravity.y * prm.mass;
        fx[i*3+2] += _gravity.z * prm.mass;
      }
    }
    if (prm.wind) {
      for (const f of _forceFlds) if (f.type === 'wind') {
        for (let i = 0; i < n; i++) if (!cb.pinned[i]) {
          fx[i*3] += f.dir.x*f.strength; fx[i*3+1] += f.dir.y*f.strength; fx[i*3+2] += f.dir.z*f.strength;
        }
      }
    }
    for (const sp of cb.springs) {
      const { a, b, rest } = sp;
      const dx = cb.posAttr.getX(b)-cb.posAttr.getX(a);
      const dy = cb.posAttr.getY(b)-cb.posAttr.getY(a);
      const dz = cb.posAttr.getZ(b)-cb.posAttr.getZ(a);
      const len = Math.sqrt(dx*dx+dy*dy+dz*dz) || 0.0001;
      const f   = prm.stiffness * (len - rest) / len;
      if (!cb.pinned[a]) { fx[a*3]+=f*dx; fx[a*3+1]+=f*dy; fx[a*3+2]+=f*dz; }
      if (!cb.pinned[b]) { fx[b*3]-=f*dx; fx[b*3+1]-=f*dy; fx[b*3+2]-=f*dz; }
    }
    for (let i = 0; i < n; i++) {
      if (cb.pinned[i]) continue;
      cb.vel[i*3]   = (cb.vel[i*3]  +fx[i*3]  *dt)*(1-prm.damping*dt);
      cb.vel[i*3+1] = (cb.vel[i*3+1]+fx[i*3+1]*dt)*(1-prm.damping*dt);
      cb.vel[i*3+2] = (cb.vel[i*3+2]+fx[i*3+2]*dt)*(1-prm.damping*dt);
      cb.posAttr.setXYZ(i,
        cb.posAttr.getX(i)+cb.vel[i*3]*dt,
        cb.posAttr.getY(i)+cb.vel[i*3+1]*dt,
        cb.posAttr.getZ(i)+cb.vel[i*3+2]*dt);
    }
    cb.posAttr.needsUpdate = true;
    cb.mesh.geometry.computeVertexNormals();
  }
}

// ════════════════════════════════════════════════════════════
//  WATER — SPH + Rapier collision
// ════════════════════════════════════════════════════════════

// Build static Rapier colliders for every mesh in the scene that has
// a rigid-body simulation OR is a regular user mesh (floor obstacles).
async function _buildStaticCollidersForScene() {
  const R = await loadRapier();
  await _ensureWorld();

  // Remove old static scene colliders (not the floor)
  _staticColls.forEach(c => { try { _world.removeCollider(c, false); } catch {} });
  _staticColls = [];

  app.scene.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    if (o === app.floor) return;
    if (o.userData?.isBoneMarker) return;
    if (o.userData?.isWaterParticle) return;

    const box  = new THREE.Box3().setFromObject(o);
    const size = new THREE.Vector3(); box.getSize(size);
    const ctr  = new THREE.Vector3(); box.getCenter(ctr);
    if (size.length() < 0.01) return;

    try {
      const desc = R.ColliderDesc.cuboid(size.x*0.5, size.y*0.5, size.z*0.5)
        .setTranslation(ctr.x, ctr.y, ctr.z)
        .setFriction(0.4)
        .setRestitution(0.1);
      _staticColls.push(_world.createCollider(desc));
    } catch {}
  });
}

async function _buildWater(obj) {
  const R   = await loadRapier();
  await _ensureWorld();
  await _buildStaticCollidersForScene();

  const prm = obj.userData.simulation?.params ?? SIM_DEFAULTS.water;
  const cnt = prm.count;

  // Seed particles inside object bounding box
  const box  = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(); box.getSize(size);
  const ctr  = new THREE.Vector3(); box.getCenter(ctr);

  const pos = new Float32Array(cnt * 3);
  const vel = new Float32Array(cnt * 3);

  for (let i = 0; i < cnt; i++) {
    pos[i*3]   = ctr.x + (Math.random()-0.5)*size.x*0.9;
    pos[i*3+1] = ctr.y + (Math.random()-0.5)*size.y*0.9;
    pos[i*3+2] = ctr.z + (Math.random()-0.5)*size.z*0.9;
    vel[i*3+1] = -0.1; // initial downward nudge
  }

  // Create Rapier kinematic bodies for each water particle
  const rapierBodies = [];
  for (let i = 0; i < cnt; i++) {
    const rbDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(pos[i*3], pos[i*3+1], pos[i*3+2])
      .setLinearDamping(prm.viscosity * 30)
      .setAdditionalMass(0.001);
    const body = _world.createRigidBody(rbDesc);
    const coll = _world.createCollider(
      R.ColliderDesc.ball(prm.radius)
        .setFriction(prm.friction)
        .setRestitution(prm.restitution),
      body
    );
    rapierBodies.push({ body, coll });
  }

  // THREE.js visual — instanced sphere mesh for performance
  const sphereGeo = new THREE.SphereGeometry(prm.radius, 6, 4);
  const sphereMat = new THREE.MeshPhysicalMaterial({
    color: 0x2299ee,
    roughness: 0.05,
    metalness: 0.0,
    transmission: 0.92,
    thickness: 0.3,
    ior: 1.33,
    transparent: true,
    opacity: 0.82,
  });
  const mesh = new THREE.InstancedMesh(sphereGeo, sphereMat, cnt);
  mesh.userData.isWaterParticle = true;
  mesh.castShadow = false;
  app.scene.add(mesh);

  _waterSims.push({ obj, mesh, pos, vel, rapierBodies, prm, cnt });
}

const _dummy = new THREE.Object3D();

function _tickWater(dt, ws) {
  const prm = ws.prm;
  const cnt = ws.cnt;
  const h   = prm.radius * 4;  // SPH kernel radius
  const G   = _gravity;
  const pos = ws.pos;
  const vel = ws.vel;

  // ── SPH pressure pass (O(n²) — acceptable for ≤500 particles) ─────────
  const pres = new Float32Array(cnt);
  for (let i = 0; i < cnt; i++) {
    let dens = 0;
    for (let j = 0; j < cnt; j++) {
      const dx = pos[i*3]-pos[j*3], dy = pos[i*3+1]-pos[j*3+1], dz = pos[i*3+2]-pos[j*3+2];
      const r2 = dx*dx+dy*dy+dz*dz;
      if (r2 < h*h) dens += Math.pow(1 - r2/(h*h), 3);
    }
    pres[i] = Math.max(0, dens - 6.0); // rest density
  }

  const fx = new Float32Array(cnt * 3);

  // Gravity
  for (let i = 0; i < cnt; i++) {
    fx[i*3]   = G.x;
    fx[i*3+1] = G.y;
    fx[i*3+2] = G.z;
  }

  // Pressure + viscosity
  for (let i = 0; i < cnt; i++) {
    for (let j = i+1; j < cnt; j++) {
      const dx = pos[i*3]-pos[j*3], dy = pos[i*3+1]-pos[j*3+1], dz = pos[i*3+2]-pos[j*3+2];
      const r2 = dx*dx+dy*dy+dz*dz;
      if (r2 < h*h && r2 > 1e-6) {
        const r = Math.sqrt(r2);
        const w = (1 - r/h);
        // Pressure repulsion
        const p = (pres[i]+pres[j]) * 0.5 * w * w / r;
        fx[i*3]   += p*dx; fx[i*3+1] += p*dy; fx[i*3+2] += p*dz;
        fx[j*3]   -= p*dx; fx[j*3+1] -= p*dy; fx[j*3+2] -= p*dz;
        // Viscosity
        const vx = vel[j*3]-vel[i*3], vy = vel[j*3+1]-vel[i*3+1], vz = vel[j*3+2]-vel[i*3+2];
        const visc = prm.viscosity * w;
        fx[i*3]   += vx*visc; fx[i*3+1] += vy*visc; fx[i*3+2] += vz*visc;
        fx[j*3]   -= vx*visc; fx[j*3+1] -= vy*visc; fx[j*3+2] -= vz*visc;
      }
    }
  }

  // ── Apply SPH forces to Rapier bodies, then step world ────────────────
  for (let i = 0; i < cnt; i++) {
    const body = ws.rapierBodies[i].body;
    // Apply accumulated SPH force (as impulse scaled by dt)
    body.applyImpulse({ x: fx[i*3]*dt, y: fx[i*3+1]*dt, z: fx[i*3+2]*dt }, true);
  }

  // Step is driven by _tickRigidBodies → _world.step() already called
  // Sync position/vel back from Rapier
  for (let i = 0; i < cnt; i++) {
    const t = ws.rapierBodies[i].body.translation();
    const v = ws.rapierBodies[i].body.linvel();
    pos[i*3] = t.x; pos[i*3+1] = t.y; pos[i*3+2] = t.z;
    vel[i*3] = v.x; vel[i*3+1] = v.y; vel[i*3+2] = v.z;

    // Update instanced mesh
    _dummy.position.set(t.x, t.y, t.z);
    _dummy.updateMatrix();
    ws.mesh.setMatrixAt(i, _dummy.matrix);
  }
  ws.mesh.instanceMatrix.needsUpdate = true;
}

// ════════════════════════════════════════════════════════════
//  FORCE FIELDS
// ════════════════════════════════════════════════════════════
export function addForceField(type, params = {}) {
  const defaults = {
    wind:       { dir: new THREE.Vector3(1,0,0), strength: 2.0 },
    turbulence: { strength: 1.5, position: new THREE.Vector3(0,2,0), radius: 5 },
    vortex:     { strength: 2.0, axis: new THREE.Vector3(0,1,0), position: new THREE.Vector3() },
    drag:       { strength: 0.5 },
  };
  _forceFlds.push({ type, ...(defaults[type]||{}), ...params });
}
export function clearForceFields() { _forceFlds = []; }

function _applyForceFieldsToRigid() {
  if (!_world || !_forceFlds.length) return;
  for (const rb of _rigidBodies) {
    if (rb.body.isFixed()) continue;
    const vel = rb.body.linvel();
    let fx=0,fy=0,fz=0;
    for (const f of _forceFlds) {
      if (f.type==='wind')      { fx+=f.dir.x*f.strength; fy+=f.dir.y*f.strength; fz+=f.dir.z*f.strength; }
      else if (f.type==='drag') { fx-=vel.x*f.strength; fy-=vel.y*f.strength; fz-=vel.z*f.strength; }
      else if (f.type==='vortex') {
        const p = rb.body.translation();
        fx += -(p.z-f.position.z)*f.strength;
        fz +=  (p.x-f.position.x)*f.strength;
      }
    }
    rb.body.addForce({x:fx,y:fy,z:fz}, true);
  }
}

// ════════════════════════════════════════════════════════════
//  SIMULATION MANAGEMENT
// ════════════════════════════════════════════════════════════
export async function enableSimulation(obj) {
  const ud = obj.userData.simulation;
  if (!ud || ud.type === SIM_TYPES.NONE) return;
  removeSimulation(obj);
  const t = ud.type;
  if      (t === SIM_TYPES.RIGID) await _addRigidBody(obj);
  else if (t === SIM_TYPES.JELLY) _buildJellyBody(obj);
  else if (t === SIM_TYPES.CLOTH) _buildClothBody(obj);
  else if (t === SIM_TYPES.WATER) await _buildWater(obj);
}

export function removeSimulation(obj) {
  // Rigid
  const ri = _rigidBodies.findIndex(r => r.obj === obj);
  if (ri !== -1) {
    const rb = _rigidBodies[ri];
    try { _world?.removeCollider(rb.collider, false); _world?.removeRigidBody(rb.body); } catch {}
    _rigidBodies.splice(ri, 1);
  }
  // Jelly
  const si = _softBodies.findIndex(s => s.obj === obj);
  if (si !== -1) {
    const sb = _softBodies[si];
    sb.mesh.geometry.dispose();
    sb.mesh.geometry = sb._origGeo;
    _softBodies.splice(si, 1);
  }
  // Cloth
  const ci = _clothBodies.findIndex(c => c.obj === obj);
  if (ci !== -1) _clothBodies.splice(ci, 1);
  // Water
  const wi = _waterSims.findIndex(w => w.obj === obj);
  if (wi !== -1) {
    const ws = _waterSims[wi];
    ws.rapierBodies.forEach(rb => {
      try { _world?.removeCollider(rb.coll, false); _world?.removeRigidBody(rb.body); } catch {}
    });
    app.scene.remove(ws.mesh);
    ws.mesh.geometry.dispose();
    _waterSims.splice(wi, 1);
  }
}

export function resetSimulation(obj) { removeSimulation(obj); enableSimulation(obj); }

export function setGravity(x, y, z) {
  _gravity.set(x, y, z);
  if (_world) _world.gravity = { x, y, z };
}

// ─── Main tick ────────────────────────────────────────────────────────────────
export function tickSimulation() {
  if (!_running) return;
  const dt = Math.min(_clock.getDelta(), 0.05);

  // Jelly drag tracking
  if (app.transformControls?.dragging && app.selected) {
    if (_prevDragObj !== app.selected) { _prevDragObj = app.selected; _prevObjPos.copy(app.selected.position); }
  } else { _prevDragObj = null; }

  // Apply SPH forces before world step
  for (const ws of _waterSims) _tickWaterSPH(dt, ws);

  _applyForceFieldsToRigid();

  // Single world step (covers rigid + water Rapier bodies)
  if (_world) {
    _world.timestep = Math.min(dt, 0.033);
    _world.step();
  }

  // Sync rigid body objects
  for (const rb of _rigidBodies) {
    if (!rb.body || rb.body.isFixed()) continue;
    const t = rb.body.translation(); const r = rb.body.rotation();
    rb.obj.position.set(t.x,t.y,t.z);
    rb.obj.quaternion.set(r.x,r.y,r.z,r.w);
  }

  // Sync water visual
  for (const ws of _waterSims) _syncWaterMesh(ws);

  _tickJelly(dt);
  _tickCloth(dt);

  if (_prevDragObj) _prevObjPos.copy(_prevDragObj.position);

  markSceneDirty();
}

// SPH force application (before world step)
function _tickWaterSPH(dt, ws) {
  const prm = ws.prm;
  const cnt = ws.cnt;
  const h   = prm.radius * 4;
  const pos = ws.pos;
  const vel = ws.vel;

  // Sync pos/vel from Rapier first
  for (let i = 0; i < cnt; i++) {
    const t = ws.rapierBodies[i].body.translation();
    const v = ws.rapierBodies[i].body.linvel();
    pos[i*3]=t.x; pos[i*3+1]=t.y; pos[i*3+2]=t.z;
    vel[i*3]=v.x; vel[i*3+1]=v.y; vel[i*3+2]=v.z;
  }

  // SPH density
  const pres = new Float32Array(cnt);
  for (let i = 0; i < cnt; i++) {
    let d = 0;
    for (let j = 0; j < cnt; j++) {
      const dx=pos[i*3]-pos[j*3], dy=pos[i*3+1]-pos[j*3+1], dz=pos[i*3+2]-pos[j*3+2];
      const r2=dx*dx+dy*dy+dz*dz;
      if (r2<h*h) d+=Math.pow(1-r2/(h*h),3);
    }
    pres[i] = Math.max(0, d - 6.0);
  }

  // Apply SPH impulses
  for (let i = 0; i < cnt; i++) {
    let ifx=0,ify=0,ifz=0;
    for (let j = i+1; j < cnt; j++) {
      const dx=pos[i*3]-pos[j*3], dy=pos[i*3+1]-pos[j*3+1], dz=pos[i*3+2]-pos[j*3+2];
      const r2=dx*dx+dy*dy+dz*dz;
      if (r2<h*h && r2>1e-6) {
        const r=Math.sqrt(r2), w=1-r/h;
        const p=(pres[i]+pres[j])*0.5*w*w/r;
        const vx=vel[j*3]-vel[i*3], vy=vel[j*3+1]-vel[i*3+1], vz=vel[j*3+2]-vel[i*3+2];
        const visc=prm.viscosity*w;
        ifx+=p*dx+vx*visc; ify+=p*dy+vy*visc; ifz+=p*dz+vz*visc;
        ws.rapierBodies[j].body.applyImpulse({x:-p*dx*dt,y:-p*dy*dt,z:-p*dz*dt}, false);
      }
    }
    ws.rapierBodies[i].body.applyImpulse({x:ifx*dt,y:ify*dt,z:ifz*dt}, false);
    // Force fields on water
    for (const f of _forceFlds) if (f.type==='wind') {
      ws.rapierBodies[i].body.applyImpulse({x:f.dir.x*f.strength*dt*0.1,y:f.dir.y*f.strength*dt*0.1,z:f.dir.z*f.strength*dt*0.1},false);
    }
  }
}

function _syncWaterMesh(ws) {
  for (let i = 0; i < ws.cnt; i++) {
    const t = ws.rapierBodies[i].body.translation();
    ws.pos[i*3]=t.x; ws.pos[i*3+1]=t.y; ws.pos[i*3+2]=t.z;
    _dummy.position.set(t.x,t.y,t.z);
    _dummy.updateMatrix();
    ws.mesh.setMatrixAt(i, _dummy.matrix);
  }
  ws.mesh.instanceMatrix.needsUpdate = true;
}

export function startSim()  { _running=true;  _clock.start(); }
export function stopSim()   { _running=false; _clock.stop();  }
export function pauseSim()  { _running=false; }
export function isRunning() { return _running; }

// ════════════════════════════════════════════════════════════
//  UI INIT
// ════════════════════════════════════════════════════════════
export function initSimulation() {
  app.simUpdateFn = tickSimulation;
  _bindSimUI();
}

function _bindSimUI() {
  const simTypeSelect = document.getElementById('simType');
  const simParamsDiv  = document.getElementById('simParams');
  const simAddBtn     = document.getElementById('simAddBtn');
  const simRemoveBtn  = document.getElementById('simRemoveBtn');
  const simPlayBtn    = document.getElementById('simPlayBtn');
  const simStopBtn    = document.getElementById('simStopBtn');
  const simResetBtn   = document.getElementById('simResetBtn');
  const gravityY      = document.getElementById('simGravityY');
  const ffType        = document.getElementById('simFFType');
  const ffAddBtn      = document.getElementById('simFFAdd');
  const ffClearBtn    = document.getElementById('simFFClear');

  if (!simTypeSelect) return;

  simTypeSelect.addEventListener('change', () => _renderSimParams(simTypeSelect.value, simParamsDiv));
  _renderSimParams(simTypeSelect.value, simParamsDiv);

  window.addEventListener('scene-selection-changed', (e) => {
    const obj = e.detail?.object;
    if (!obj || obj.userData?.isLightObject) return;
    const t = obj.userData?.simulation?.type || SIM_TYPES.NONE;
    simTypeSelect.value = t;
    _renderSimParams(t, simParamsDiv);
    if (obj.userData?.simulation?.params) _loadParams(obj.userData.simulation.params, simParamsDiv);
  });

  simAddBtn?.addEventListener('click', async () => {
    const obj = app.selected;
    if (!obj || obj.userData?.isLightObject) { _simToast('Selecione um objeto primeiro'); return; }
    const type   = simTypeSelect.value;
    const params = _readParams(simParamsDiv, type);
    obj.userData.simulation = { type, params, active: true };
    await enableSimulation(obj);
    _simToast(`✅ ${_typeLabel(type)} ativada`);
  });

  simRemoveBtn?.addEventListener('click', () => {
    const obj = app.selected; if (!obj) return;
    removeSimulation(obj);
    delete obj.userData.simulation;
    _simToast('Simulação removida');
  });

  simPlayBtn?.addEventListener('click',  () => { startSim(); simPlayBtn.classList.add('active'); simStopBtn.classList.remove('active'); });
  simStopBtn?.addEventListener('click',  () => { stopSim();  simPlayBtn.classList.remove('active'); simStopBtn.classList.add('active'); });
  simResetBtn?.addEventListener('click', () => {
    const obj = app.selected;
    if (obj?.userData?.simulation) { resetSimulation(obj); _simToast('Reiniciado'); }
  });

  gravityY?.addEventListener('input', () => setGravity(0, parseFloat(gravityY.value)||_gravity.y, 0));
  ffAddBtn?.addEventListener('click',   () => { addForceField(ffType?.value||'wind'); _simToast(`Campo: ${ffType?.value} adicionado`); });
  ffClearBtn?.addEventListener('click', () => { clearForceFields(); _simToast('Campos limpos'); });
}

function _typeLabel(t) {
  return { rigid:'Corpo Rígido', jelly:'Gelatina', cloth:'Tecido', water:'Água' }[t] || t;
}

function _renderSimParams(type, container) {
  if (!container) return;
  const defs = SIM_DEFAULTS[type] || {};
  const fields = {
    rigid: [
      { id:'mass',        label:'Massa',          val:defs.mass,        min:0,   max:1000, step:0.1  },
      { id:'friction',    label:'Fricção',         val:defs.friction,    min:0,   max:1,    step:0.01 },
      { id:'restitution', label:'Elasticidade',    val:defs.restitution, min:0,   max:1,    step:0.01 },
      { id:'linearDamp',  label:'Amort. Linear',   val:defs.linearDamp,  min:0,   max:1,    step:0.01 },
      { id:'angularDamp', label:'Amort. Angular',  val:defs.angularDamp, min:0,   max:1,    step:0.01 },
    ],
    jelly: [
      { id:'stiffness', label:'Rigidez',        val:defs.stiffness, min:1,  max:500, step:1   },
      { id:'damping',   label:'Amortecimento',  val:defs.damping,   min:0,  max:30,  step:0.1 },
      { id:'pressure',  label:'Pressão',        val:defs.pressure,  min:0,  max:1,   step:0.01},
    ],
    cloth: [
      { id:'stiffness', label:'Rigidez Estrut.',val:defs.stiffness, min:1,  max:200, step:1   },
      { id:'shear',     label:'Cisalhamento',   val:defs.shear,     min:0,  max:100, step:1   },
      { id:'bend',      label:'Flexão',         val:defs.bend,      min:0,  max:100, step:1   },
      { id:'damping',   label:'Amortecimento',  val:defs.damping,   min:0,  max:20,  step:0.1 },
      { id:'mass',      label:'Massa',          val:defs.mass,      min:0.01,max:10, step:0.01},
    ],
    water: [
      { id:'count',      label:'Nº Partículas', val:defs.count,      min:10,  max:500, step:10   },
      { id:'radius',     label:'Raio Partícula',val:defs.radius,     min:0.02,max:0.5, step:0.01 },
      { id:'viscosity',  label:'Viscosidade',   val:defs.viscosity,  min:0,   max:0.5, step:0.001},
      { id:'restitution',label:'Elasticidade',  val:defs.restitution,min:0,   max:1,   step:0.01 },
      { id:'friction',   label:'Fricção',       val:defs.friction,   min:0,   max:1,   step:0.01 },
    ],
  };
  const flds = fields[type] || [];
  container.innerHTML = flds.length
    ? flds.map(f=>`
        <label class="simParamRow">
          <span>${f.label}</span>
          <input type="number" id="sp_${f.id}" data-param="${f.id}"
            value="${f.val}" min="${f.min}" max="${f.max}" step="${f.step}">
        </label>`).join('')
    : '<p class="simNoParams">Sem parâmetros.</p>';

  if (type==='rigid') container.innerHTML += `
    <label class="simParamRow">
      <span>Forma Colisão</span>
      <select id="sp_shape" data-param="shape">
        <option value="box">Caixa</option>
        <option value="sphere">Esfera</option>
        <option value="hull">Convex Hull</option>
      </select>
    </label>
    <label class="simParamRow simCheckRow">
      <span>Estático</span>
      <input type="checkbox" id="sp_isStatic" data-param="isStatic">
    </label>`;

  if (type==='cloth') container.innerHTML += `
    <label class="simParamRow simCheckRow">
      <span>Prender Topo</span>
      <input type="checkbox" id="sp_pinTop" data-param="pinTop" ${defs.pinTop?'checked':''}>
    </label>
    <label class="simParamRow simCheckRow">
      <span>Vento</span>
      <input type="checkbox" id="sp_wind" data-param="wind">
    </label>`;
}

function _readParams(container, type) {
  if (!container) return { ...(SIM_DEFAULTS[type]||{}) };
  const params = { ...(SIM_DEFAULTS[type]||{}) };
  container.querySelectorAll('[data-param]').forEach(el => {
    const key = el.dataset.param;
    if (el.type==='checkbox') params[key]=el.checked;
    else if (el.tagName==='SELECT') params[key]=el.value;
    else params[key]=parseFloat(el.value);
  });
  return params;
}

function _loadParams(data, container) {
  if (!container) return;
  container.querySelectorAll('[data-param]').forEach(el => {
    const v = data[el.dataset.param];
    if (v===undefined) return;
    if (el.type==='checkbox') el.checked=!!v;
    else el.value=v;
  });
}

function _simToast(msg) {
  const ex=document.getElementById('_sim_toast'); if(ex) ex.remove();
  const t=document.createElement('div'); t.id='_sim_toast'; t.textContent=msg;
  t.style.cssText=`position:fixed;bottom:60px;left:50%;transform:translateX(-50%);
    background:rgba(20,20,35,.97);color:#eef2ff;padding:8px 18px;border-radius:8px;
    font-size:12px;font-weight:600;z-index:99999;pointer-events:none;
    border:1px solid rgba(120,180,255,0.3);box-shadow:0 4px 20px rgba(0,0,0,.5);`;
  document.body.appendChild(t);
  setTimeout(()=>{ if(t.parentNode){t.style.opacity='0';t.style.transition='opacity .3s';} },2200);
  setTimeout(()=>t.remove(),2500);
}

function _firstMesh(obj) {
  if (obj?.isMesh) return obj;
  for (const c of (obj?.children||[])) { const m=_firstMesh(c); if(m) return m; }
  return null;
}
