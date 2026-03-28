// ==================== particle-engine.js ====================
// Nexus Engine — Roblox-inspired GPU-style particle system.
// Supports: Emit shapes, color-over-lifetime, size-over-lifetime,
//           velocity, acceleration, drag, rotation, texture sheets,
//           trails, light emission, collision, sub-emitters.
// Inspired by Roblox ParticleEmitter, Blox Fruits VFX, King Legacy, STBB.

import * as THREE from 'three';
import { makeGlowSprite, makeSparkleSprite, makeRingSprite } from './shader.js';

// ─── Texture library ─────────────────────────────────────────────────────────
const _texCache = {};

function _getTexture(name) {
    if (_texCache[name]) return _texCache[name];
    switch (name) {
        case 'glow':     _texCache[name] = makeGlowSprite(0xffffff, 64); break;
        case 'sparkle':  _texCache[name] = makeSparkleSprite(64); break;
        case 'ring':     _texCache[name] = makeRingSprite(0.4, 64); break;
        case 'soft':     _texCache[name] = _makeSoftCircle(); break;
        case 'smoke':    _texCache[name] = _makeSmokeTex(); break;
        case 'ember':    _texCache[name] = _makeEmberTex(); break;
        case 'lightning':_texCache[name] = _makeLightningTex(); break;
        case 'square':   _texCache[name] = _makeSquareTex(); break;
        case 'diamond':  _texCache[name] = _makeDiamondTex(); break;
        case 'fireball': _texCache[name] = _makeFireballTex(); break;
        case 'hex':      _texCache[name] = _makeHexTex(); break;
        case 'heart':    _texCache[name] = _makeHeartTex(); break;
        case 'flame':    _texCache[name] = _makeFlameTex(); break;
        case 'plasma':   _texCache[name] = _makePlasmaTex(); break;
        case 'starburst':_texCache[name] = _makeStarburstTex(); break;
        case 'crystal':  _texCache[name] = _makeCrystalTex(); break;
        case 'electric': _texCache[name] = _makeElectricTex(); break;
        case 'cloud':    _texCache[name] = _makeCloudTex(); break;
        case 'comet':    _texCache[name] = _makeCometTex(); break;
        case 'orb':      _texCache[name] = _makeOrbTex(); break;
        case 'cross':    _texCache[name] = _makeCrossTex(); break;
        case 'leaf':     _texCache[name] = _makeLeafTex(); break;
        default:         _texCache[name] = makeGlowSprite(0xffffff, 64);
    }
    return _texCache[name];
}

function _makeSoftCircle() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.5,'rgba(255,255,255,0.6)'); g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(c);
}
function _makeSmokeTex() {
    const c = document.createElement('canvas'); c.width=c.height=64;
    const ctx=c.getContext('2d');
    for(let i=0;i<12;i++){
        const x=20+Math.random()*24, y=20+Math.random()*24, r=8+Math.random()*12;
        const g=ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,'rgba(180,180,180,0.25)'); g.addColorStop(1,'rgba(180,180,180,0)');
        ctx.fillStyle=g; ctx.fillRect(0,0,64,64);
    }
    return new THREE.CanvasTexture(c);
}
function _makeEmberTex() {
    const c=document.createElement('canvas'); c.width=c.height=64;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,64,64);
    // Outer amber glow
    const go=ctx.createRadialGradient(32,32,0,32,32,30);
    go.addColorStop(0,'rgba(255,245,180,1)');
    go.addColorStop(0.15,'rgba(255,200,60,1)');
    go.addColorStop(0.35,'rgba(255,130,10,0.9)');
    go.addColorStop(0.55,'rgba(220,60,0,0.6)');
    go.addColorStop(0.75,'rgba(160,20,0,0.25)');
    go.addColorStop(1,'rgba(80,0,0,0)');
    ctx.fillStyle=go; ctx.fillRect(0,0,64,64);
    // Bright core white-hot center
    const gc=ctx.createRadialGradient(32,30,0,32,30,10);
    gc.addColorStop(0,'rgba(255,255,255,1)');
    gc.addColorStop(0.3,'rgba(255,250,200,0.9)');
    gc.addColorStop(0.7,'rgba(255,200,80,0.4)');
    gc.addColorStop(1,'rgba(255,140,0,0)');
    ctx.fillStyle=gc; ctx.fillRect(0,0,64,64);
    // Teardrop shape up top for flame-like ember
    ctx.save(); ctx.translate(32,18); ctx.scale(0.6,1);
    const gt=ctx.createRadialGradient(0,0,0,0,4,12);
    gt.addColorStop(0,'rgba(255,255,220,0.8)');
    gt.addColorStop(1,'rgba(255,180,0,0)');
    ctx.fillStyle=gt; ctx.beginPath();
    ctx.moveTo(0,-12); ctx.bezierCurveTo(6,-6,6,6,0,10); ctx.bezierCurveTo(-6,6,-6,-6,0,-12);
    ctx.fill(); ctx.restore();
    return new THREE.CanvasTexture(c);
}
function _makeLightningTex() {
    const c=document.createElement('canvas'); c.width=8; c.height=64;
    const ctx=c.getContext('2d');
    const g=ctx.createLinearGradient(4,0,4,64);
    g.addColorStop(0,'rgba(200,220,255,0)'); g.addColorStop(0.5,'rgba(200,220,255,1)'); g.addColorStop(1,'rgba(200,220,255,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,8,64);
    return new THREE.CanvasTexture(c);
}
function _makeSquareTex() {
    const c=document.createElement('canvas'); c.width=c.height=32;
    const ctx=c.getContext('2d');
    const g=ctx.createRadialGradient(16,16,2,16,16,16);
    g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.7,'rgba(255,255,255,0.6)'); g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.fillRect(2,2,28,28);
    return new THREE.CanvasTexture(c);
}
function _makeDiamondTex() {
    const c=document.createElement('canvas'); c.width=c.height=32;
    const ctx=c.getContext('2d');
    ctx.save(); ctx.translate(16,16); ctx.rotate(Math.PI/4);
    const g=ctx.createRadialGradient(0,0,0,0,0,12);
    g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.fillRect(-10,-10,20,20); ctx.restore();
    return new THREE.CanvasTexture(c);
}
function _makeFireballTex() {
    const c=document.createElement('canvas'); c.width=c.height=64;
    const ctx=c.getContext('2d');
    // Core
    const g=ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'rgba(255,255,220,1)');
    g.addColorStop(0.2,'rgba(255,180,20,0.95)');
    g.addColorStop(0.5,'rgba(255,60,0,0.7)');
    g.addColorStop(0.8,'rgba(180,20,0,0.3)');
    g.addColorStop(1,'rgba(80,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(c);
}
function _makeHexTex() {
    const c=document.createElement('canvas'); c.width=c.height=64;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,64,64);
    ctx.translate(32,32);
    ctx.beginPath();
    for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.lineTo(Math.cos(a)*28,Math.sin(a)*28);}
    ctx.closePath();
    const g=ctx.createRadialGradient(0,0,0,0,0,28);
    g.addColorStop(0,'rgba(255,255,255,1)');
    g.addColorStop(0.7,'rgba(200,200,255,0.5)');
    g.addColorStop(1,'rgba(100,100,255,0)');
    ctx.fillStyle=g; ctx.fill();
    return new THREE.CanvasTexture(c);
}
function _makeHeartTex() {
    const c=document.createElement('canvas'); c.width=c.height=64;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,64,64);
    ctx.translate(32,36); ctx.scale(1.1,1.1);
    ctx.beginPath();
    ctx.moveTo(0,-10);
    ctx.bezierCurveTo(-5,-20,-20,-20,-20,-10);
    ctx.bezierCurveTo(-20,0,0,15,0,22);
    ctx.bezierCurveTo(0,15,20,0,20,-10);
    ctx.bezierCurveTo(20,-20,5,-20,0,-10);
    const g=ctx.createRadialGradient(0,0,0,0,6,22);
    g.addColorStop(0,'rgba(255,200,220,1)');
    g.addColorStop(0.6,'rgba(255,80,120,0.8)');
    g.addColorStop(1,'rgba(200,0,60,0)');
    ctx.fillStyle=g; ctx.fill();
    return new THREE.CanvasTexture(c);
}


// ─── STBB-inspired extended textures ─────────────────────────────────────────
function _makeFlameTex() {
    // Tall teardrop flame tongue, bright core → orange edge
    const c=document.createElement('canvas'); c.width=48; c.height=80;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,48,80);
    ctx.save(); ctx.translate(24,60);
    ctx.beginPath();
    ctx.moveTo(0,-58); ctx.bezierCurveTo(18,-38,18,-10,0,4); ctx.bezierCurveTo(-18,-10,-18,-38,0,-58);
    const g=ctx.createLinearGradient(0,-58,0,4);
    g.addColorStop(0,'rgba(255,255,220,1)');
    g.addColorStop(0.25,'rgba(255,200,60,0.95)');
    g.addColorStop(0.55,'rgba(255,80,10,0.8)');
    g.addColorStop(0.85,'rgba(180,20,0,0.35)');
    g.addColorStop(1,'rgba(80,0,0,0)');
    ctx.fillStyle=g; ctx.fill();
    // inner hot core
    ctx.beginPath(); ctx.moveTo(0,-54); ctx.bezierCurveTo(7,-36,7,-14,0,-2); ctx.bezierCurveTo(-7,-14,-7,-36,0,-54);
    const gc=ctx.createLinearGradient(0,-54,0,-2);
    gc.addColorStop(0,'rgba(255,255,255,0.95)');
    gc.addColorStop(0.5,'rgba(255,240,180,0.6)');
    gc.addColorStop(1,'rgba(255,180,60,0)');
    ctx.fillStyle=gc; ctx.fill();
    ctx.restore();
    return new THREE.CanvasTexture(c);
}
function _makePlasmaTex() {
    // Pulsing electric plasma ball — bright center, colored electric rings
    const c=document.createElement('canvas'); c.width=c.height=64;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,64,64);
    const g=ctx.createRadialGradient(32,32,0,32,32,30);
    g.addColorStop(0,'rgba(255,255,255,1)');
    g.addColorStop(0.12,'rgba(200,180,255,1)');
    g.addColorStop(0.3,'rgba(120,60,255,0.9)');
    g.addColorStop(0.55,'rgba(60,0,200,0.5)');
    g.addColorStop(0.8,'rgba(20,0,120,0.2)');
    g.addColorStop(1,'rgba(0,0,60,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,64,64);
    // electric arcs
    for(let i=0;i<6;i++){
        const a=i*Math.PI/3, r1=8, r2=26+Math.random()*6;
        ctx.beginPath();
        ctx.moveTo(32+Math.cos(a)*r1,32+Math.sin(a)*r1);
        const mx=32+Math.cos(a+0.4)*(r1+r2)*0.5+(_rndS()*6), my=32+Math.sin(a+0.4)*(r1+r2)*0.5+(_rndS()*6);
        ctx.quadraticCurveTo(mx,my,32+Math.cos(a)*r2,32+Math.sin(a)*r2);
        ctx.strokeStyle='rgba(200,160,255,0.7)'; ctx.lineWidth=1; ctx.stroke();
    }
    return new THREE.CanvasTexture(c);
}
function _makeStarburstTex() {
    // 8-point starburst with glow, STBB power-up style
    const c=document.createElement('canvas'); c.width=c.height=64;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,64,64);
    // glow base
    const g=ctx.createRadialGradient(32,32,0,32,32,30);
    g.addColorStop(0,'rgba(255,255,220,1)');
    g.addColorStop(0.25,'rgba(255,220,80,0.7)');
    g.addColorStop(1,'rgba(255,160,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,64,64);
    // spikes
    const pts=8;
    ctx.save(); ctx.translate(32,32);
    ctx.beginPath();
    for(let i=0;i<pts*2;i++){
        const a=i*Math.PI/pts - Math.PI/2;
        const r=i%2===0?30:10;
        i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
    }
    ctx.closePath();
    const gs=ctx.createRadialGradient(0,0,0,0,0,30);
    gs.addColorStop(0,'rgba(255,255,255,1)');
    gs.addColorStop(0.5,'rgba(255,240,100,0.85)');
    gs.addColorStop(1,'rgba(255,180,0,0)');
    ctx.fillStyle=gs; ctx.fill();
    ctx.restore();
    return new THREE.CanvasTexture(c);
}
function _rndS() { return Math.random()*2-1; }
function _makeCrystalTex() {
    const c=document.createElement('canvas'); c.width=c.height=64;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,64,64);
    ctx.save(); ctx.translate(32,32);
    ctx.beginPath(); ctx.moveTo(0,-30); ctx.lineTo(12,-8); ctx.lineTo(16,14); ctx.lineTo(0,30); ctx.lineTo(-14,12); ctx.lineTo(-10,-8); ctx.closePath();
    const gf=ctx.createLinearGradient(-16,-30,16,30);
    gf.addColorStop(0,'rgba(200,240,255,0.95)');
    gf.addColorStop(0.4,'rgba(160,210,255,0.85)');
    gf.addColorStop(0.75,'rgba(100,180,255,0.55)');
    gf.addColorStop(1,'rgba(60,120,220,0)');
    ctx.fillStyle=gf; ctx.fill();
    // inner glint
    ctx.beginPath(); ctx.moveTo(0,-26); ctx.lineTo(5,-12); ctx.lineTo(0,0); ctx.lineTo(-5,-12); ctx.closePath();
    const gi=ctx.createLinearGradient(0,-26,0,0);
    gi.addColorStop(0,'rgba(255,255,255,0.9)'); gi.addColorStop(1,'rgba(200,230,255,0)');
    ctx.fillStyle=gi; ctx.fill();
    ctx.restore();
    return new THREE.CanvasTexture(c);
}
function _makeElectricTex() {
    // Jagged electric bolt — bright white-blue zigzag
    const c=document.createElement('canvas'); c.width=16; c.height=80;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,16,80);
    // glow halo
    const gh=ctx.createRadialGradient(8,40,0,8,40,18);
    gh.addColorStop(0,'rgba(180,200,255,0.3)'); gh.addColorStop(1,'rgba(100,140,255,0)');
    ctx.fillStyle=gh; ctx.fillRect(0,0,16,80);
    // bolt
    const pts=[[8,2],[12,18],[4,34],[12,50],[5,64],[8,78]];
    ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
    for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);
    ctx.strokeStyle='rgba(220,240,255,0.95)'; ctx.lineWidth=2.5; ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,1)'; ctx.lineWidth=1; ctx.stroke();
    // fade top/bottom
    const gv=ctx.createLinearGradient(0,0,0,80);
    gv.addColorStop(0,'rgba(0,0,0,1)'); gv.addColorStop(0.06,'rgba(0,0,0,0)');
    gv.addColorStop(0.94,'rgba(0,0,0,0)'); gv.addColorStop(1,'rgba(0,0,0,1)');
    ctx.globalCompositeOperation='destination-out'; ctx.fillStyle=gv; ctx.fillRect(0,0,16,80);
    ctx.globalCompositeOperation='source-over';
    return new THREE.CanvasTexture(c);
}
function _makeCloudTex() {
    // Soft volumetric cloud puff — multi-layered bumps
    const c=document.createElement('canvas'); c.width=c.height=80;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,80,80);
    const puffs=[[40,44,28],[28,48,18],[54,48,16],[40,36,20],[22,52,12],[58,52,12]];
    puffs.forEach(([x,y,r])=>{
        const g=ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,'rgba(230,235,245,0.55)');
        g.addColorStop(0.5,'rgba(200,210,230,0.3)');
        g.addColorStop(1,'rgba(180,190,220,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    });
    return new THREE.CanvasTexture(c);
}
function _makeCometTex() {
    // Comet — bright head with long tail fade
    const c=document.createElement('canvas'); c.width=24; c.height=80;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,24,80);
    // tail
    const gt=ctx.createLinearGradient(12,80,12,20);
    gt.addColorStop(0,'rgba(255,255,255,0)');
    gt.addColorStop(0.7,'rgba(200,220,255,0.4)');
    gt.addColorStop(1,'rgba(255,255,255,0.9)');
    ctx.fillStyle=gt;
    ctx.beginPath(); ctx.moveTo(12,80); ctx.lineTo(4,20); ctx.lineTo(20,20); ctx.closePath(); ctx.fill();
    // head
    const gh=ctx.createRadialGradient(12,12,0,12,12,12);
    gh.addColorStop(0,'rgba(255,255,255,1)');
    gh.addColorStop(0.3,'rgba(200,230,255,0.95)');
    gh.addColorStop(0.7,'rgba(120,180,255,0.5)');
    gh.addColorStop(1,'rgba(60,100,255,0)');
    ctx.fillStyle=gh; ctx.beginPath(); ctx.arc(12,12,12,0,Math.PI*2); ctx.fill();
    return new THREE.CanvasTexture(c);
}
function _makeOrbTex() {
    // Glowing energy orb with inner rings
    const c=document.createElement('canvas'); c.width=c.height=64;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,64,64);
    const g=ctx.createRadialGradient(32,32,0,32,32,30);
    g.addColorStop(0,'rgba(255,255,255,1)');
    g.addColorStop(0.15,'rgba(200,240,255,1)');
    g.addColorStop(0.35,'rgba(80,160,255,0.8)');
    g.addColorStop(0.6,'rgba(40,80,200,0.4)');
    g.addColorStop(1,'rgba(0,20,100,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,64,64);
    // rings
    [14,20,26].forEach((r,i)=>{
        ctx.beginPath(); ctx.arc(32,32,r,0,Math.PI*2);
        ctx.strokeStyle=`rgba(180,220,255,${0.35-i*0.08})`; ctx.lineWidth=1; ctx.stroke();
    });
    return new THREE.CanvasTexture(c);
}
function _makeCrossTex() {
    // Sharp cross / plus shape — good for energy hits and magic
    const c=document.createElement('canvas'); c.width=c.height=64;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,64,64);
    ctx.save(); ctx.translate(32,32);
    const w=7,h=30;
    // glow behind
    const g=ctx.createRadialGradient(0,0,0,0,0,28);
    g.addColorStop(0,'rgba(255,255,255,0.5)'); g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.fillRect(-28,-28,56,56);
    // vertical bar
    ctx.fillStyle='rgba(255,255,255,0.95)';
    ctx.fillRect(-w/2,-h,w,h*2);
    // horizontal bar
    ctx.fillRect(-h,-w/2,h*2,w);
    // center bright dot
    ctx.fillStyle='rgba(255,255,255,1)';
    ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
    ctx.restore();
    return new THREE.CanvasTexture(c);
}
function _makeLeafTex() {
    // Organic leaf — elongated with vein
    const c=document.createElement('canvas'); c.width=40; c.height=64;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,40,64);
    ctx.save(); ctx.translate(20,32);
    ctx.beginPath();
    ctx.moveTo(0,-28); ctx.bezierCurveTo(18,-20,18,20,0,30); ctx.bezierCurveTo(-18,20,-18,-20,0,-28);
    const g=ctx.createRadialGradient(0,0,0,0,0,30);
    g.addColorStop(0,'rgba(180,255,160,0.9)');
    g.addColorStop(0.5,'rgba(80,200,60,0.7)');
    g.addColorStop(1,'rgba(30,120,20,0)');
    ctx.fillStyle=g; ctx.fill();
    // vein
    ctx.beginPath(); ctx.moveTo(0,-26); ctx.lineTo(0,28);
    ctx.strokeStyle='rgba(150,255,120,0.5)'; ctx.lineWidth=1; ctx.stroke();
    ctx.restore();
    return new THREE.CanvasTexture(c);
}

export const PARTICLE_PRESETS = {
    // ── Atmosphere / Map ────────────────────────────────────────
    fireflies: {
        label: 'Fireflies',
        icon:  '✨',
        category: 'atmosphere',
        rate: 4, lifetime: [3, 6], speed: [0.05, 0.2],
        size: [0.08, 0.12], sizeOverLife: [[0,0],[0.2,1],[0.8,1],[1,0]],
        color: { from: 0x88ffaa, to: 0xffffff },
        colorOverLife: [[0,0x88ffaa],[0.5,0xaaffcc],[1,0xffffff]],
        opacity: 0.9, opacityOverLife: [[0,0],[0.15,1],[0.85,1],[1,0]],
        texture: 'glow', blending: 'additive',
        emitShape: 'sphere', emitRadius: 2,
        drag: 0.98, gravity: 0,
        localVelocity: false,
        wanderStrength: 0.05,
    },

    magicDust: {
        label: 'Magic Dust',
        icon:  '🌟',
        category: 'magic',
        rate: 20, lifetime: [1.2, 2.4], speed: [0.3, 0.8],
        size: [0.06, 0.14], sizeOverLife: [[0,0.5],[0.3,1],[1,0]],
        color: { from: 0xcc44ff, to: 0x4488ff },
        colorOverLife: [[0,0xee44ff],[0.5,0x8844ff],[1,0x4488ff]],
        opacity: 1, opacityOverLife: [[0,0],[0.1,1],[0.7,1],[1,0]],
        texture: 'sparkle', blending: 'additive',
        emitShape: 'cone', emitAngle: 30, emitRadius: 0.3,
        drag: 0.95, gravity: -0.02,
        rotation: true, rotSpeed: [-180, 180],
    },

    sakura: {
        label: 'Sakura Petals',
        icon:  '🌸',
        category: 'atmosphere',
        rate: 6, lifetime: [4, 8], speed: [0.1, 0.3],
        size: [0.12, 0.25], sizeOverLife: [[0,0],[0.2,1],[0.9,1],[1,0]],
        color: { from: 0xffaacc, to: 0xffeeff },
        colorOverLife: [[0,0xffbbdd],[0.5,0xffccee],[1,0xfff0ff]],
        opacity: 0.85, opacityOverLife: [[0,0],[0.2,0.85],[0.8,0.85],[1,0]],
        texture: 'diamond', blending: 'normal',
        emitShape: 'sphere', emitRadius: 1.5,
        drag: 0.97, gravity: 0.04,
        rotation: true, rotSpeed: [-60, 60],
        wanderStrength: 0.08,
    },

    energyAura: {
        label: 'Energy Aura',
        icon:  '⚡',
        category: 'magic',
        rate: 30, lifetime: [0.4, 0.8], speed: [0.5, 1.5],
        size: [0.05, 0.12], sizeOverLife: [[0,1],[0.5,0.6],[1,0]],
        color: { from: 0x00ccff, to: 0xffffff },
        colorOverLife: [[0,0x00ccff],[0.4,0x88ddff],[1,0xffffff]],
        opacity: 0.9, opacityOverLife: [[0,0.5],[0.2,1],[0.8,0.6],[1,0]],
        texture: 'glow', blending: 'additive',
        emitShape: 'surface', emitRadius: 0.6,
        drag: 0.92, gravity: -0.3,
    },

    // ── Combat / Roblox game style ───────────────────────────────
    devilFruitAura: {
        label: 'Devil Fruit Aura',
        icon:  '🔥',
        category: 'combat',
        rate: 40, lifetime: [0.5, 1.2], speed: [1, 2.5],
        size: [0.08, 0.2], sizeOverLife: [[0,0.3],[0.2,1],[0.7,0.8],[1,0]],
        color: { from: 0xff4400, to: 0xffaa00 },
        colorOverLife: [[0,0xff2200],[0.3,0xff6600],[0.7,0xffaa00],[1,0xffee88]],
        opacity: 0.95, opacityOverLife: [[0,0],[0.1,1],[0.7,1],[1,0]],
        texture: 'ember', blending: 'additive',
        emitShape: 'sphere', emitRadius: 0.5,
        drag: 0.94, gravity: -0.5,
    },

    swordSlash: {
        label: 'Sword Slash',
        icon:  '⚔️',
        category: 'combat',
        burst: true, burstCount: 60,
        lifetime: [0.3, 0.6], speed: [3, 6],
        size: [0.06, 0.15], sizeOverLife: [[0,1],[0.5,0.5],[1,0]],
        color: { from: 0xffffff, to: 0x88ccff },
        colorOverLife: [[0,0xffffff],[0.3,0xaaddff],[1,0x4488cc]],
        opacity: 1, opacityOverLife: [[0,0.8],[0.3,1],[1,0]],
        texture: 'sparkle', blending: 'additive',
        emitShape: 'disc', emitRadius: 0.8,
        drag: 0.88, gravity: 0,
    },

    poisonCloud: {
        label: 'Poison Cloud',
        icon:  '☠️',
        category: 'combat',
        rate: 15, lifetime: [2, 4], speed: [0.1, 0.4],
        size: [0.3, 0.7], sizeOverLife: [[0,0],[0.3,1],[0.9,1.2],[1,0]],
        color: { from: 0x44ff44, to: 0x226622 },
        colorOverLife: [[0,0x44ff44],[0.4,0x88ff44],[0.8,0x336633],[1,0x224422]],
        opacity: 0.6, opacityOverLife: [[0,0],[0.2,0.6],[0.8,0.5],[1,0]],
        texture: 'smoke', blending: 'normal',
        emitShape: 'sphere', emitRadius: 0.4,
        drag: 0.99, gravity: -0.05,
        wanderStrength: 0.04,
    },

    lightningStrike: {
        label: 'Lightning Strike',
        icon:  '🌩️',
        category: 'combat',
        burst: true, burstCount: 80,
        lifetime: [0.15, 0.45], speed: [2, 5],
        size: [0.05, 0.1], sizeOverLife: [[0,1],[0.4,0.7],[1,0]],
        color: { from: 0xaaccff, to: 0xffffff },
        colorOverLife: [[0,0x8899ff],[0.3,0xaaddff],[1,0xffffff]],
        opacity: 1, opacityOverLife: [[0,1],[0.5,0.8],[1,0]],
        texture: 'glow', blending: 'additive',
        emitShape: 'sphere', emitRadius: 0.2,
        drag: 0.85, gravity: 0.8,
    },

    // ── Elemental ────────────────────────────────────────────────
    iceShard: {
        label: 'Ice Shards',
        icon:  '❄️',
        category: 'elemental',
        rate: 25, lifetime: [0.8, 1.6], speed: [0.5, 2],
        size: [0.07, 0.15], sizeOverLife: [[0,1],[0.6,0.8],[1,0]],
        color: { from: 0xaaeeff, to: 0xffffff },
        colorOverLife: [[0,0x88ccff],[0.5,0xcceeFF],[1,0xffffff]],
        opacity: 0.9, opacityOverLife: [[0,0.5],[0.1,1],[0.8,0.9],[1,0]],
        texture: 'diamond', blending: 'additive',
        emitShape: 'sphere', emitRadius: 0.4,
        drag: 0.93, gravity: 0.2,
        rotation: true, rotSpeed: [-90, 90],
    },

    darkEnergy: {
        label: 'Dark Energy',
        icon:  '🌑',
        category: 'elemental',
        rate: 25, lifetime: [0.8, 1.8], speed: [0.3, 1.2],
        size: [0.1, 0.22], sizeOverLife: [[0,0],[0.2,1],[0.7,0.8],[1,0]],
        color: { from: 0x440088, to: 0x000011 },
        colorOverLife: [[0,0x880088],[0.4,0x440066],[0.8,0x220033],[1,0x000011]],
        opacity: 0.85, opacityOverLife: [[0,0],[0.15,0.85],[0.8,0.7],[1,0]],
        texture: 'smoke', blending: 'normal',
        emitShape: 'sphere', emitRadius: 0.5,
        drag: 0.97, gravity: -0.1,
    },

    goldCoins: {
        label: 'Gold Coins',
        icon:  '💰',
        category: 'magic',
        burst: true, burstCount: 30,
        lifetime: [1.5, 2.5], speed: [1, 3],
        size: [0.1, 0.2], sizeOverLife: [[0,0.5],[0.2,1],[0.8,1],[1,0.3]],
        color: { from: 0xffcc00, to: 0xff8800 },
        colorOverLife: [[0,0xffdd00],[0.4,0xffaa00],[1,0xff8800]],
        opacity: 1, opacityOverLife: [[0,0],[0.1,1],[0.7,1],[1,0]],
        texture: 'ring', blending: 'additive',
        emitShape: 'sphere', emitRadius: 0.3,
        drag: 0.92, gravity: 0.4,
        rotation: true, rotSpeed: [-180, 180],
    },

    // ── Atmosphere ──────────────────────────────────────────────
    rain: {
        label: 'Rain',
        icon:  '🌧️',
        category: 'atmosphere',
        rate: 80, lifetime: [0.8, 1.6], speed: [3, 5],
        size: [0.03, 0.06], sizeOverLife: [[0,1],[1,1]],
        color: { from: 0x8899cc, to: 0xaabbdd },
        colorOverLife: [[0,0x8899cc],[1,0x99aacc]],
        opacity: 0.6, opacityOverLife: [[0,0.6],[0.8,0.6],[1,0]],
        texture: 'lightning', blending: 'normal',
        emitShape: 'plane', emitRadius: 3,
        drag: 1.0, gravity: 0.8,
        direction: new THREE.Vector3(0.1, -1, 0),
    },

    snow: {
        label: 'Snow',
        icon:  '❄️',
        category: 'atmosphere',
        rate: 30, lifetime: [4, 8], speed: [0.1, 0.4],
        size: [0.05, 0.12], sizeOverLife: [[0,0],[0.2,1],[0.8,1],[1,0]],
        color: { from: 0xeeeeff, to: 0xffffff },
        colorOverLife: [[0,0xddeeff],[0.5,0xeeeeff],[1,0xffffff]],
        opacity: 0.8, opacityOverLife: [[0,0],[0.2,0.8],[0.8,0.8],[1,0]],
        texture: 'soft', blending: 'normal',
        emitShape: 'plane', emitRadius: 4,
        drag: 0.99, gravity: 0.05,
        wanderStrength: 0.06,
    },

    bubbles: {
        label: 'Bubbles',
        icon:  '🫧',
        category: 'atmosphere',
        rate: 8, lifetime: [2, 4], speed: [0.1, 0.4],
        size: [0.1, 0.3], sizeOverLife: [[0,0],[0.2,1],[0.85,1],[1,1.2]],
        color: { from: 0x88ddff, to: 0xffffff },
        colorOverLife: [[0,0x88ccff],[0.5,0xaaddff],[1,0xffffff]],
        opacity: 0.5, opacityOverLife: [[0,0],[0.2,0.5],[0.8,0.5],[1,0]],
        texture: 'ring', blending: 'additive',
        emitShape: 'sphere', emitRadius: 0.5,
        drag: 0.99, gravity: -0.08,
    },

    // ── Fire / Smoke (custom creation) ──────────────────────────
    fire: {
        label: 'Fire',
        icon:  '🔥',
        category: 'elemental',
        rate: 50, lifetime: [0.6, 1.4], speed: [1.5, 4],
        size: [0.12, 0.32], sizeOverLife: [[0,0.5],[0.3,1],[0.7,0.9],[1,0]],
        color: { from: 0xffff80, to: 0xff2200 },
        colorOverLife: [[0,0xffff80],[0.25,0xffaa00],[0.6,0xff4400],[0.85,0xcc1100],[1,0x330000]],
        opacity: 1, opacityOverLife: [[0,0],[0.08,0.9],[0.6,0.7],[1,0]],
        texture: 'fireball', blending: 'additive',
        emitShape: 'disc', emitRadius: 0.25,
        drag: 0.95, gravity: -1.8,
        wanderStrength: 0.04,
        lightEmission: 1.0,
    },
    smoke: {
        label: 'Smoke',
        icon:  '💨',
        category: 'atmosphere',
        rate: 12, lifetime: [3, 7], speed: [0.3, 1],
        size: [0.3, 0.8], sizeOverLife: [[0,0.2],[0.3,1],[0.8,1.4],[1,1.6]],
        color: { from: 0x555566, to: 0x999aaa },
        colorOverLife: [[0,0x444455],[0.4,0x777788],[0.8,0x999aaa],[1,0xbbbbcc]],
        opacity: 0.55, opacityOverLife: [[0,0],[0.15,0.55],[0.7,0.45],[1,0]],
        texture: 'smoke', blending: 'normal',
        emitShape: 'disc', emitRadius: 0.2,
        drag: 0.99, gravity: -0.15,
        wanderStrength: 0.06,
        lightEmission: 0,
    },
    campfire: {
        label: 'Campfire',
        icon:  '🏕️',
        category: 'elemental',
        rate: 35, lifetime: [0.7, 1.8], speed: [1, 3],
        size: [0.08, 0.22], sizeOverLife: [[0,0.4],[0.3,1],[0.7,0.7],[1,0]],
        color: { from: 0xffffff, to: 0xff3300 },
        colorOverLife: [[0,0xfff0a0],[0.2,0xffcc00],[0.5,0xff6600],[0.8,0xff2200],[1,0x440000]],
        opacity: 0.9, opacityOverLife: [[0,0],[0.1,0.9],[0.6,0.7],[1,0]],
        texture: 'ember', blending: 'additive',
        emitShape: 'disc', emitRadius: 0.18,
        drag: 0.94, gravity: -2.2,
        wanderStrength: 0.05,
        lightEmission: 1.0,
    },
    waterfall: {
        label: 'Waterfall',
        icon:  '💧',
        category: 'atmosphere',
        rate: 60, lifetime: [1.2, 2.4], speed: [2, 5],
        size: [0.04, 0.1], sizeOverLife: [[0,0.6],[0.5,1],[1,0.4]],
        color: { from: 0xaaddff, to: 0x88bbff },
        colorOverLife: [[0,0xaaddff],[0.5,0x99ccff],[1,0x88bbff]],
        opacity: 0.7, opacityOverLife: [[0,0.5],[0.2,0.7],[0.8,0.6],[1,0]],
        texture: 'soft', blending: 'normal',
        emitShape: 'disc', emitRadius: 0.4,
        drag: 0.99, gravity: 0.8,
        direction: null,
        lightEmission: 0.2,
    },
    explosion: {
        label: 'Explosion',
        icon:  '💥',
        category: 'combat',
        burst: true, burstCount: 120,
        lifetime: [0.4, 1.2], speed: [3, 10],
        size: [0.1, 0.4], sizeOverLife: [[0,0.5],[0.2,1],[0.6,0.8],[1,0]],
        color: { from: 0xffffff, to: 0xff2200 },
        colorOverLife: [[0,0xffffff],[0.15,0xffff80],[0.3,0xffaa00],[0.55,0xff4400],[0.8,0xcc1100],[1,0x220000]],
        opacity: 0.95, opacityOverLife: [[0,0.95],[0.4,0.8],[0.75,0.4],[1,0]],
        texture: 'fireball', blending: 'additive',
        emitShape: 'sphere', emitRadius: 0.1,
        drag: 0.88, gravity: 0.3,
        lightEmission: 1.0,
    },
    confetti: {
        label: 'Confetti',
        icon:  '🎊',
        category: 'atmosphere',
        rate: 30, lifetime: [2.5, 5], speed: [2, 6],
        size: [0.08, 0.18], sizeOverLife: [[0,0.6],[0.4,1],[0.9,0.8],[1,0.3]],
        color: { from: 0xff4488, to: 0x44ffaa },
        colorOverLife: [[0,0xff4488],[0.25,0xffcc00],[0.5,0x44ffaa],[0.75,0x44aaff],[1,0xcc44ff]],
        opacity: 1, opacityOverLife: [[0,0],[0.1,1],[0.8,0.9],[1,0]],
        texture: 'square', blending: 'normal',
        emitShape: 'cone', emitAngle: 60, emitRadius: 0.3,
        drag: 0.97, gravity: 0.2,
        rotation: true, rotSpeed: [-360, 360],
        lightEmission: 0.2,
    },
    heartburst: {
        label: 'Hearts',
        icon:  '💕',
        category: 'magic',
        burst: true, burstCount: 25,
        lifetime: [1.5, 3], speed: [1.5, 4],
        size: [0.1, 0.22], sizeOverLife: [[0,0],[0.2,1],[0.8,0.9],[1,0.3]],
        color: { from: 0xff88aa, to: 0xff2266 },
        colorOverLife: [[0,0xff88cc],[0.4,0xff4488],[1,0xff2266]],
        opacity: 1, opacityOverLife: [[0,0],[0.15,1],[0.7,1],[1,0]],
        texture: 'heart', blending: 'additive',
        emitShape: 'sphere', emitRadius: 0.3,
        drag: 0.95, gravity: -0.3,
        rotation: true, rotSpeed: [-60, 60],
        lightEmission: 0.7,
    },
    trail: {
        label: 'Speed Trail',
        icon:  '🚀',
        category: 'magic',
        rate: 80, lifetime: [0.2, 0.5], speed: [0.1, 0.4],
        size: [0.04, 0.12], sizeOverLife: [[0,1],[0.5,0.5],[1,0]],
        color: { from: 0xffffff, to: 0x4488ff },
        colorOverLife: [[0,0xffffff],[0.3,0x88ccff],[0.7,0x4488ff],[1,0x0022aa]],
        opacity: 0.9, opacityOverLife: [[0,0.9],[0.4,0.6],[1,0]],
        texture: 'soft', blending: 'additive',
        emitShape: 'sphere', emitRadius: 0.05,
        drag: 0.9, gravity: 0,
        lightEmission: 0.8,
    },
    hexaura: {
        label: 'Hex Aura',
        icon:  '🔷',
        category: 'magic',
        rate: 25, lifetime: [1, 2.5], speed: [0.5, 1.5],
        size: [0.1, 0.25], sizeOverLife: [[0,0],[0.3,1],[0.7,0.9],[1,0]],
        color: { from: 0x00ffff, to: 0x0044ff },
        colorOverLife: [[0,0x00ffff],[0.5,0x4488ff],[1,0x0022cc]],
        opacity: 0.85, opacityOverLife: [[0,0],[0.2,0.85],[0.8,0.7],[1,0]],
        texture: 'hex', blending: 'additive',
        emitShape: 'ring', emitRadius: 0.7,
        drag: 0.97, gravity: -0.1,
        rotation: true, rotSpeed: [-90, 90],
        lightEmission: 1.0,
    },

    // ── Portal / Warp ────────────────────────────────────────────
    portalVortex: {
        label: 'Portal Vortex',
        icon:  '🌀',
        category: 'magic',
        rate: 50, lifetime: [0.6, 1.2], speed: [1, 2],
        size: [0.06, 0.14], sizeOverLife: [[0,0.3],[0.3,1],[0.8,0.5],[1,0]],
        color: { from: 0x4400cc, to: 0x00ccff },
        colorOverLife: [[0,0x4400ff],[0.3,0x8800ff],[0.6,0x00aaff],[1,0x00ffff]],
        opacity: 0.95, opacityOverLife: [[0,0],[0.1,0.95],[0.7,0.8],[1,0]],
        texture: 'glow', blending: 'additive',
        emitShape: 'ring', emitRadius: 0.8,
        drag: 0.92, gravity: 0,
        orbitSpeed: 2.5,
    },

    starfield: {
        label: 'Starfield',
        icon:  '⭐',
        category: 'atmosphere',
        rate: 3, lifetime: [3, 6], speed: [0.05, 0.2],
        size: [0.05, 0.15], sizeOverLife: [[0,0],[0.2,1],[0.8,1],[1,0]],
        color: { from: 0xffffff, to: 0xffeeaa },
        colorOverLife: [[0,0xffffff],[0.5,0xffeeaa],[1,0xff8800]],
        opacity: 1, opacityOverLife: [[0,0],[0.1,1],[0.85,1],[1,0]],
        texture: 'sparkle', blending: 'additive',
        emitShape: 'sphere', emitRadius: 3,
        drag: 1.0, gravity: 0,
    },
};

// ─── Particle class ───────────────────────────────────────────────────────────
class Particle {
    constructor() {
        this.pos      = new THREE.Vector3();
        this.vel      = new THREE.Vector3();
        this.acc      = new THREE.Vector3();
        this.color    = new THREE.Color();
        this.baseColor= new THREE.Color();  // pre-variance color
        this.size     = 1;
        this.opacity  = 1;
        this.life     = 1;
        this.maxLife  = 1;
        this.rotation = 0;
        this.rotSpeed = 0;
        this.alive    = false;
        this.orbitAngle = 0;
        this.orbitRadius= 0;
        // shape sculpt
        this.aspect       = 1;     // elongation per-particle
        this.flickerPhase = 0;     // random phase offset for flicker
        this.pulsePhase   = 0;     // random phase offset for pulse
        this.wavePhase    = 0;     // wave motion phase
        this.colorHueOff  = 0;     // per-particle hue offset
        this.brightnessOff= 0;     // per-particle brightness offset
        this.initialPos   = new THREE.Vector3(); // for force pull calculation
    }
    reset() { this.alive = false; }
}

// ─── ParticleSystem class ─────────────────────────────────────────────────────
export class ParticleSystem {
    constructor(scene, config = {}) {
        this._scene  = scene;
        this._config = Object.assign({}, PARTICLE_PRESETS.magicDust, config);
        this._particles  = [];
        this._maxParticles = Math.min(config.maxParticles || 2000, 5000);
        this._pool       = [];
        this._time       = 0;
        this._emitAccum  = 0;
        this._playing    = false;
        this._paused     = false;

        this.name = config.name || 'ParticleSystem';
        this.position = new THREE.Vector3();
        this.userData = { particleType: 'custom', isCustomParticle: true, isLab: true };

        // Build pool
        for (let i = 0; i < this._maxParticles; i++) this._pool.push(new Particle());

        // Three.js geometry + points
        this._geo       = new THREE.BufferGeometry();
        this._positions = new Float32Array(this._maxParticles * 3);
        this._colors    = new Float32Array(this._maxParticles * 3);
        this._sizes     = new Float32Array(this._maxParticles);
        this._opacities = new Float32Array(this._maxParticles);
        this._rotations = new Float32Array(this._maxParticles);
        this._aspects   = new Float32Array(this._maxParticles).fill(1);

        this._geo.setAttribute('position',  new THREE.BufferAttribute(this._positions, 3));
        this._geo.setAttribute('color',     new THREE.BufferAttribute(this._colors,    3));
        this._geo.setAttribute('aSize',     new THREE.BufferAttribute(this._sizes,     1));
        this._geo.setAttribute('aOpacity',  new THREE.BufferAttribute(this._opacities, 1));
        this._geo.setAttribute('aRotation', new THREE.BufferAttribute(this._rotations, 1));
        this._geo.setAttribute('aAspect',   new THREE.BufferAttribute(this._aspects,   1));
        this._geo.setDrawRange(0, 0);

        const cfg    = this._config;
        const texName= cfg.texture || 'glow';
        const tex    = _getTexture(texName);
        const blendMode = cfg.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending;
        const lightEm = cfg.lightEmission ?? 0.8;

        this._mat = new THREE.ShaderMaterial({
            uniforms: {
                uTexture:       { value: tex },
                uLightEmission: { value: lightEm },
                uSizeScale:     { value: 1.0 },
                uTime:          { value: 0.0 },
            },
            vertexShader: /* glsl */`
                attribute float aSize;
                attribute float aOpacity;
                attribute float aRotation;
                attribute float aAspect;
                uniform float uSizeScale;
                varying vec3  vColor;
                varying float vOpacity;
                varying float vRot;
                void main(){
                    vColor   = color;
                    vOpacity = aOpacity;
                    vRot     = aRotation;
                    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                    float dist = -mvPos.z;
                    gl_PointSize = clamp(aSize * uSizeScale * (380.0 / max(dist, 0.1)), 1.0, 512.0);
                    gl_Position  = projectionMatrix * mvPos;
                }
            `,
            fragmentShader: /* glsl */`
                uniform sampler2D uTexture;
                uniform float uLightEmission;
                varying vec3  vColor;
                varying float vOpacity;
                varying float vRot;
                void main(){
                    vec2 uv = gl_PointCoord - 0.5;
                    float s = sin(vRot), c = cos(vRot);
                    uv = vec2(c*uv.x - s*uv.y, s*uv.x + c*uv.y) + 0.5;
                    vec4 tex = texture2D(uTexture, uv);
                    if(tex.a < 0.015) discard;
                    // Black color fix: near-black (lum<0.06) adds subtle glow boost
                    // so black particles stay visible. Has zero effect on all other colors.
                    float colorLum = dot(vColor, vec3(0.299, 0.587, 0.114));
                    float blackBoost = (1.0 - smoothstep(0.0, 0.06, colorLum)) * 0.28;
                    vec3 col = mix(vColor, vColor * tex.rgb + tex.rgb * 0.08, colorLum);
                    col += tex.rgb * blackBoost;
                    col = mix(col, col * (1.0 + uLightEmission * 1.8), uLightEmission);
                    float alpha = tex.a * vOpacity;
                    gl_FragColor = vec4(col, alpha);
                }
            `,
            blending:       blendMode,
            depthWrite:     false,
            transparent:    true,
            vertexColors:   true,
        });

        this._points = new THREE.Points(this._geo, this._mat);
        this._points.frustumCulled = false;
        this._points.userData = this.userData;
        this._scene.add(this._points);

        // Sub-emitters support
        this._subEmitters = [];
    }

    // ── Config ───────────────────────────────────────────────────
    setConfig(cfg) {
        Object.assign(this._config, cfg);
        if (cfg.texture !== undefined) {
            this._mat.uniforms.uTexture.value = _getTexture(cfg.texture);
        }
        if (cfg.blending !== undefined) {
            this._mat.blending = cfg.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending;
            this._mat.needsUpdate = true;
        }
        if (cfg.lightEmission !== undefined && this._mat.uniforms.uLightEmission) {
            this._mat.uniforms.uLightEmission.value = cfg.lightEmission;
        }
        // elongation is applied per-particle in update() via aAspect
    }

    // ── Render scale (compensates DPR/resolution during image capture) ───
    setRenderScale(scale) {
        if (this._mat.uniforms.uSizeScale) {
            this._mat.uniforms.uSizeScale.value = Math.max(scale, 0.01);
        }
    }

    // ── Controls ─────────────────────────────────────────────────
    play()  { this._playing = true;  this._paused = false; }
    pause() { this._paused  = true; }
    stop()  { this._playing = false; this._particles.forEach(p => p.reset()); this._emitAccum = 0; this._update_buffers(); }
    reset() { this.stop(); this._time = 0; }

    // ── Spawn single particle ─────────────────────────────────────
    _spawn() {
        if (this._pool.length === 0) return;
        const p  = this._pool.pop();
        const c  = this._config;

        p.alive   = true;
        p.maxLife = _rnd(c.lifetime[0], c.lifetime[1]);
        p.life    = p.maxLife;

        // Emit shape
        const sp  = this._emitPoint();
        p.pos.copy(this.position).add(sp);

        // Velocity
        const speed = _rnd(c.speed[0], c.speed[1]);
        if (c.direction) {
            p.vel.copy(c.direction).multiplyScalar(speed).add(
                new THREE.Vector3(_rnd(-0.3,0.3),_rnd(-0.3,0.3),_rnd(-0.3,0.3))
            );
        } else {
            // spreadAngle: 0=laser beam, 180=all directions
            const spread = ((c.spreadAngle ?? 180) * Math.PI) / 180;
            if (spread >= Math.PI) {
                p.vel.set(_rnd(-1,1),_rnd(-1,1),_rnd(-1,1)).normalize().multiplyScalar(speed);
            } else {
                // Emit in cone around +Y axis then apply spread
                const theta = _rnd(0, spread * 0.5);
                const phi   = _rnd(0, Math.PI * 2);
                p.vel.set(
                    Math.sin(theta) * Math.cos(phi),
                    Math.cos(theta),
                    Math.sin(theta) * Math.sin(phi)
                ).normalize().multiplyScalar(speed);
            }
        }

        p.rotation = _rnd(0, Math.PI*2);
        p.rotSpeed = c.rotation ? _rnd(c.rotSpeed?.[0]??-90, c.rotSpeed?.[1]??90) * Math.PI/180 : 0;

        // Orbit
        if (c.orbitSpeed) {
            p.orbitAngle  = _rnd(0, Math.PI*2);
            p.orbitRadius = _rnd(c.emitRadius * 0.8, c.emitRadius);
        }

        // Shape sculpt — per-particle random offsets
        p.flickerPhase  = Math.random() * Math.PI * 2;
        p.pulsePhase    = Math.random() * Math.PI * 2;
        p.wavePhase     = Math.random() * Math.PI * 2;
        p.colorHueOff   = _rnd(-0.5, 0.5) * (c.colorVariance ?? 0);
        p.brightnessOff = _rnd(0, 1)      * (c.brightnessVariance ?? 0);
        p.aspect        = c.elongation ?? 1;
        p.initialPos.copy(p.pos);

        // birthBurst: extra velocity kick at spawn
        if (c.birthBurst > 0) {
            const dir = p.vel.length() > 0
                ? p.vel.clone().normalize()
                : new THREE.Vector3(_rnd(-1,1),_rnd(-1,1),_rnd(-1,1)).normalize();
            p.vel.addScaledVector(dir, c.birthBurst);
        }
        // scatterBirth: extra random displacement at spawn
        if (c.scatterBirth > 0) {
            p.pos.x += _rnd(-c.scatterBirth, c.scatterBirth);
            p.pos.y += _rnd(-c.scatterBirth, c.scatterBirth);
            p.pos.z += _rnd(-c.scatterBirth, c.scatterBirth);
        }

        // Color (will be evaluated each frame via colorOverLife)
        p.color.setHex(c.color?.from ?? 0xffffff);
        p.baseColor.copy(p.color);

        this._particles.push(p);
    }

    // ── Emit shape helpers ────────────────────────────────────────
    _emitPoint() {
        const c   = this._config;
        const r   = c.emitRadius || 0.5;
        const v   = new THREE.Vector3();
        switch (c.emitShape) {
            case 'sphere':
                v.set(_rnd(-1,1),_rnd(-1,1),_rnd(-1,1)).normalize().multiplyScalar(_rnd(0,r));
                break;
            case 'surface':
                v.set(_rnd(-1,1),_rnd(-1,1),_rnd(-1,1)).normalize().multiplyScalar(r);
                break;
            case 'cone': {
                const ang = _rnd(0, Math.PI*2);
                const rad = _rnd(0, r);
                const h   = _rnd(0, r*2);
                v.set(Math.cos(ang)*rad, h, Math.sin(ang)*rad);
                break;
            }
            case 'disc': {
                const ang = _rnd(0, Math.PI*2);
                const rad = _rnd(0, r);
                v.set(Math.cos(ang)*rad, 0, Math.sin(ang)*rad);
                break;
            }
            case 'ring': {
                const ang = _rnd(0, Math.PI*2);
                v.set(Math.cos(ang)*r, 0, Math.sin(ang)*r);
                break;
            }
            case 'plane':
                v.set(_rnd(-r,r), 0, _rnd(-r,r));
                break;
            case 'point':
            default:
                break;
        }
        return v;
    }

    // ── Main update ───────────────────────────────────────────────
    update(dt) {
        if (!this._playing || this._paused) return;
        this._time += dt;
        const c = this._config;
        const T = this._time;
        if (this._mat.uniforms.uTime) this._mat.uniforms.uTime.value = T;

        if (!c.burst) {
            this._emitAccum += (c.rate || 10) * dt;
            while (this._emitAccum >= 1 && this._particles.length < this._maxParticles) {
                this._emitAccum -= 1;
                this._spawn();
            }
        }

        const drag        = c.drag              ?? 0.96;
        const gravity     = c.gravity           ?? 0;
        const wander      = c.wanderStrength    ?? 0;
        const orbit       = c.orbitSpeed        ?? 0;
        const flickerAmt  = c.flickerAmt        ?? 0;
        const flickerFreq = c.flickerFreq       ?? 8;
        const pulseAmt    = c.pulseAmt          ?? 0;
        const pulseFreq   = c.pulseFreq         ?? 4;
        const spiralStr   = c.spiralStrength    ?? 0;
        const forcePull   = c.forcePull         ?? 0;
        const waveAmt     = c.waveAmt           ?? 0;
        const waveFreq    = c.waveFreq          ?? 2;
        const elongation  = c.elongation        ?? 1;
        const velStretch  = c.velStretch        ?? 0;
        const colorVar    = c.colorVariance     ?? 0;
        const brightVar   = c.brightnessVariance?? 0;
        const noiseScale  = c.noiseScale        ?? 0;
        const bounceY     = c.bounceY           ?? 0;
        const sizeJitter  = c.sizeJitter        ?? 0;
        const spinTorque  = c.spinTorque        ?? 0;
        // ── 10 new shape params ───────────────────────────────────────
        const windX         = c.windX           ?? 0;   // constant lateral force X
        const windZ         = c.windZ           ?? 0;   // constant lateral force Z
        const gravityX      = c.gravityX        ?? 0;   // horizontal gravity (sideways)
        const radialForce   = c.radialForce     ?? 0;   // +expand / -collapse from spawn
        const heatShimmer   = c.heatShimmer     ?? 0;   // per-frame pos jitter (fire shimmer)
        const maxSpeed      = c.maxSpeed        ?? 0;   // velocity cap (0 = off)
        const sparkIntensity= c.sparkIntensity  ?? 0;   // random vel kick each frame
        const damping       = c.damping         ?? 0;   // velocity^2 drag (heavier slowdown)
        const colorTemp     = c.colorTemp       ?? 0;   // -1=cool blue, +1=warm orange tint
        const opacityErosion= c.opacityErosion  ?? 0;   // opacity *= 1 - speed * factor
        // ── 10 more new shape params ─────────────────────────────────
        const curlStrength  = c.curlStrength    ?? 0;   // curl noise rotation
        const curlFreq      = c.curlFreq        ?? 1;   // frequency of curl noise
        const vortexHeight  = c.vortexHeight    ?? 0;   // vertical spiral component
        const taperByAge    = c.taperByAge      ?? 0;   // size *= (1 - t * taper)
        const scaleByDist   = c.scaleByDist     ?? 0;   // size *= 1 + dist * factor
        const wallBounce    = c.wallBounce      ?? 0;   // elasticity on wall bounce
        const wallSize      = c.wallSize        ?? 3;   // bounding box half-size
        const birthBurst    = c.birthBurst      ?? 0;   // extra speed on spawn
        const fadeInTime    = c.fadeInTime      ?? 0;   // seconds to fade in from 0
        const scatterBirth  = c.scatterBirth    ?? 0;   // extra spawn scatter radius

        const dead = [];
        for (let i = this._particles.length - 1; i >= 0; i--) {
            const p = this._particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                p.reset();
                this._pool.push(p);
                dead.push(i);
                continue;
            }

            const t = 1 - p.life / p.maxLife;

            if (orbit > 0) {
                p.orbitAngle += orbit * dt;
                p.pos.x = this.position.x + Math.cos(p.orbitAngle) * p.orbitRadius;
                p.pos.z = this.position.z + Math.sin(p.orbitAngle) * p.orbitRadius;
                p.pos.y += p.vel.y * dt;
            } else {
                if (wander > 0) {
                    p.vel.x += _rnd(-wander, wander);
                    p.vel.y += _rnd(-wander, wander);
                    p.vel.z += _rnd(-wander, wander);
                }
                if (noiseScale > 0) {
                    const ns = noiseScale * 0.4;
                    p.vel.x += Math.sin(T * 3.1 + p.flickerPhase) * ns;
                    p.vel.y += Math.cos(T * 2.7 + p.pulsePhase)   * ns * 0.5;
                    p.vel.z += Math.sin(T * 2.3 + p.wavePhase)    * ns;
                }
                if (spiralStr !== 0) {
                    const dx = p.pos.x - this.position.x;
                    const dz = p.pos.z - this.position.z;
                    p.vel.x += -dz * spiralStr * dt;
                    p.vel.z +=  dx * spiralStr * dt;
                }
                if (forcePull !== 0) {
                    p.vel.x += (this.position.x - p.pos.x) * forcePull * dt;
                    p.vel.y += (this.position.y - p.pos.y) * forcePull * dt;
                    p.vel.z += (this.position.z - p.pos.z) * forcePull * dt;
                }
                if (waveAmt > 0) {
                    p.wavePhase += waveFreq * dt;
                    p.pos.x += Math.sin(p.wavePhase) * waveAmt * dt;
                }
                p.vel.multiplyScalar(drag);
                p.vel.y -= gravity * dt;
                // New forces
                if (windX    !== 0) p.vel.x += windX  * dt;
                if (windZ    !== 0) p.vel.z += windZ  * dt;
                if (gravityX !== 0) p.vel.x -= gravityX * dt;
                if (radialForce !== 0) {
                    const rx = p.pos.x - p.initialPos.x;
                    const ry = p.pos.y - p.initialPos.y;
                    const rz = p.pos.z - p.initialPos.z;
                    const rd = Math.sqrt(rx*rx+ry*ry+rz*rz) || 0.001;
                    p.vel.x += (rx/rd) * radialForce * dt;
                    p.vel.y += (ry/rd) * radialForce * dt;
                    p.vel.z += (rz/rd) * radialForce * dt;
                }
                if (sparkIntensity > 0 && Math.random() < sparkIntensity * dt * 10) {
                    p.vel.x += _rnd(-sparkIntensity, sparkIntensity);
                    p.vel.y += _rnd(-sparkIntensity, sparkIntensity);
                    p.vel.z += _rnd(-sparkIntensity, sparkIntensity);
                }
                if (damping > 0) {
                    const spd2 = p.vel.lengthSq();
                    if (spd2 > 0) p.vel.multiplyScalar(1 / (1 + spd2 * damping * dt));
                }
                if (maxSpeed > 0) {
                    const spd = p.vel.length();
                    if (spd > maxSpeed) p.vel.multiplyScalar(maxSpeed / spd);
                }
                if (heatShimmer > 0) {
                    p.pos.x += _rnd(-heatShimmer, heatShimmer) * dt;
                    p.pos.z += _rnd(-heatShimmer, heatShimmer) * dt;
                }
                p.pos.addScaledVector(p.vel, dt);
                if (bounceY > 0 && p.pos.y < 0 && p.vel.y < 0) {
                    p.pos.y = 0;
                    p.vel.y = -p.vel.y * bounceY;
                }
                // Wall bounce (cube boundary)
                if (wallBounce > 0 && wallSize > 0) {
                    const ox = this.position.x, oy = this.position.y, oz = this.position.z;
                    if (p.pos.x >  ox + wallSize) { p.pos.x =  ox + wallSize; p.vel.x = -Math.abs(p.vel.x) * wallBounce; }
                    if (p.pos.x <  ox - wallSize) { p.pos.x =  ox - wallSize; p.vel.x =  Math.abs(p.vel.x) * wallBounce; }
                    if (p.pos.y >  oy + wallSize) { p.pos.y =  oy + wallSize; p.vel.y = -Math.abs(p.vel.y) * wallBounce; }
                    if (p.pos.y <  oy - wallSize) { p.pos.y =  oy - wallSize; p.vel.y =  Math.abs(p.vel.y) * wallBounce; }
                    if (p.pos.z >  oz + wallSize) { p.pos.z =  oz + wallSize; p.vel.z = -Math.abs(p.vel.z) * wallBounce; }
                    if (p.pos.z <  oz - wallSize) { p.pos.z =  oz - wallSize; p.vel.z =  Math.abs(p.vel.z) * wallBounce; }
                }
                // Curl noise (rotation field around Y axis)
                if (curlStrength !== 0) {
                    const cx = p.pos.x - this.position.x;
                    const cz = p.pos.z - this.position.z;
                    const ang = Math.atan2(cz, cx) + T * curlFreq;
                    p.vel.x += Math.cos(ang + Math.PI * 0.5) * curlStrength * dt;
                    p.vel.z += Math.sin(ang + Math.PI * 0.5) * curlStrength * dt;
                }
                // Vortex vertical spiral
                if (vortexHeight !== 0) {
                    const dx = p.pos.x - this.position.x;
                    const dz = p.pos.z - this.position.z;
                    const r  = Math.sqrt(dx*dx + dz*dz);
                    if (r > 0.01) p.vel.y += (vortexHeight - (p.pos.y - this.position.y)) * 0.3 * dt;
                }
            }

            if (spinTorque !== 0) p.rotSpeed += spinTorque * dt;
            p.rotation += p.rotSpeed * dt;

            let sz = this._evalCurve(c.sizeOverLife, t) * _rnd(c.size[0], c.size[1]);
            let op = this._evalCurve(c.opacityOverLife, t) * (c.opacity ?? 1);
            this._evalColor(p, t);

            if (pulseAmt > 0)
                sz *= 1 + Math.sin(T * pulseFreq * Math.PI * 2 + p.pulsePhase) * pulseAmt;
            if (sizeJitter > 0)
                sz *= 1 + _rnd(-sizeJitter, sizeJitter);
            if (flickerAmt > 0) {
                const flick = 0.5 + 0.5 * Math.sin(T * flickerFreq * Math.PI * 2 + p.flickerPhase);
                op *= 1 - flickerAmt + flickerAmt * flick;
            }

            let asp = elongation;
            if (velStretch > 0) {
                const spd = p.vel.length();
                asp = elongation + spd * velStretch;
                if (spd > 0.001) p.rotation = Math.atan2(p.vel.x, p.vel.y);
            }
            p.aspect = Math.max(0.1, asp);

            if (colorVar > 0 || brightVar > 0) {
                const hsl = { h: 0, s: 0, l: 0 };
                p.color.getHSL(hsl);
                p.color.setHSL(
                    (hsl.h + p.colorHueOff * colorVar + 1) % 1,
                    Math.min(1, hsl.s),
                    Math.min(1, hsl.l + p.brightnessOff * brightVar)
                );
            }
            // Color temperature shift
            if (colorTemp !== 0) {
                if (colorTemp > 0) {
                    // warm: boost R, reduce B
                    p.color.r = Math.min(1, p.color.r + colorTemp * 0.25);
                    p.color.b = Math.max(0, p.color.b - colorTemp * 0.18);
                } else {
                    // cool: boost B, reduce R
                    p.color.b = Math.min(1, p.color.b - colorTemp * 0.25);
                    p.color.r = Math.max(0, p.color.r + colorTemp * 0.18);
                }
            }
            // Opacity erosion by speed
            if (opacityErosion > 0) {
                const spd = p.vel.length();
                op *= Math.max(0, 1 - spd * opacityErosion);
            }
            // Taper by age: size shrinks toward end of life
            if (taperByAge > 0) sz *= Math.max(0.01, 1 - t * taperByAge);
            // Scale by distance from emitter
            if (scaleByDist !== 0) {
                const dist = p.pos.distanceTo(this.position);
                sz *= Math.max(0.01, 1 + dist * scaleByDist * 0.1);
            }
            // Fade-in: opacity ramps from 0 during first fadeInTime seconds
            if (fadeInTime > 0) {
                const age = p.maxLife - p.life;
                if (age < fadeInTime) op *= age / fadeInTime;
            }

            p.size    = sz;
            p.opacity = Math.max(0, Math.min(1, op));
        }

        dead.sort((a,b) => b-a).forEach(i => this._particles.splice(i, 1));
        this._update_buffers();
    }

    _evalCurve(curve, t) {
        if (!curve || curve.length === 0) return 1;
        if (t <= curve[0][0]) return curve[0][1];
        if (t >= curve[curve.length-1][0]) return curve[curve.length-1][1];
        for (let i = 0; i < curve.length-1; i++) {
            if (t >= curve[i][0] && t <= curve[i+1][0]) {
                const alpha = (t - curve[i][0]) / (curve[i+1][0] - curve[i][0]);
                return curve[i][1] + alpha * (curve[i+1][1] - curve[i][1]);
            }
        }
        return 1;
    }

    _evalColor(p, t) {
        const col = this._config.colorOverLife;
        if (!col || col.length === 0) { p.color.setHex(this._config.color?.from ?? 0xffffff); return; }
        if (t <= col[0][0])            { p.color.setHex(col[0][1]); return; }
        if (t >= col[col.length-1][0]) { p.color.setHex(col[col.length-1][1]); return; }
        for (let i = 0; i < col.length-1; i++) {
            if (t >= col[i][0] && t <= col[i+1][0]) {
                const alpha = (t - col[i][0]) / (col[i+1][0] - col[i][0]);
                const ca = new THREE.Color(col[i][1]), cb = new THREE.Color(col[i+1][1]);
                p.color.lerpColors(ca, cb, alpha);
                return;
            }
        }
    }

    _update_buffers() {
        const n = this._particles.length;
        for (let i = 0; i < n; i++) {
            const p = this._particles[i];
            this._positions[i*3]   = p.pos.x;
            this._positions[i*3+1] = p.pos.y;
            this._positions[i*3+2] = p.pos.z;
            this._colors[i*3]   = p.color.r;
            this._colors[i*3+1] = p.color.g;
            this._colors[i*3+2] = p.color.b;
            this._sizes[i]      = Math.max(p.size * 80, 0.5);
            this._opacities[i]  = Math.max(0, Math.min(1, p.opacity));
            this._rotations[i]  = p.rotation || 0;
            this._aspects[i]    = p.aspect   || 1;
        }
        this._geo.attributes.position.needsUpdate  = true;
        this._geo.attributes.color.needsUpdate     = true;
        this._geo.attributes.aSize.needsUpdate     = true;
        this._geo.attributes.aOpacity.needsUpdate  = true;
        this._geo.attributes.aRotation.needsUpdate = true;
        this._geo.attributes.aAspect.needsUpdate   = true;
        this._geo.setDrawRange(0, n);
    }

    // ── Burst emit ────────────────────────────────────────────────
    burst(count) {
        const n = Math.min(count ?? this._config.burstCount ?? 50, this._maxParticles - this._particles.length);
        for (let i = 0; i < n; i++) this._spawn();
    }

    // ── Serialise / Deserialise ───────────────────────────────────
    toJSON() {
        return {
            name:   this.name,
            config: JSON.parse(JSON.stringify(this._config, (k,v) => v instanceof THREE.Vector3 ? {x:v.x,y:v.y,z:v.z} : v)),
            position: { x: this.position.x, y: this.position.y, z: this.position.z },
            maxParticles: this._maxParticles,
        };
    }

    static fromJSON(scene, json) {
        const cfg = json.config;
        if (cfg.direction) {
            cfg.direction = new THREE.Vector3(cfg.direction.x, cfg.direction.y, cfg.direction.z);
        }
        const sys = new ParticleSystem(scene, { ...cfg, maxParticles: json.maxParticles, name: json.name });
        sys.position.set(json.position.x, json.position.y, json.position.z);
        return sys;
    }

    // ── Destroy ───────────────────────────────────────────────────
    destroy() {
        this._scene.remove(this._points);
        this._geo.dispose();
        this._mat.dispose();
        this._particles = [];
        this._pool = [];
    }
}

// ─── ParticleLab manager ──────────────────────────────────────────────────────
export class ParticleLab {
    constructor(scene) {
        this._scene   = scene;
        this._systems = [];
        this._active  = null;
        this._running = false;
    }

    // Create from preset
    createFromPreset(presetId, position = new THREE.Vector3()) {
        const preset = PARTICLE_PRESETS[presetId];
        if (!preset) return null;
        const sys = new ParticleSystem(this._scene, { ...preset, name: preset.label });
        sys.position.copy(position);
        this._systems.push(sys);
        this._active = sys;
        if (preset.burst) { sys.play(); sys.burst(); } else sys.play();
        return sys;
    }

    // Create blank
    createBlank(name = 'New Particle', position = new THREE.Vector3()) {
        const sys = new ParticleSystem(this._scene, { name });
        sys.position.copy(position);
        this._systems.push(sys);
        this._active = sys;
        return sys;
    }

    setActive(sys) { this._active = sys; }
    getActive()    { return this._active; }
    getSystems()   { return this._systems; }

    removeSystem(sys) {
        const idx = this._systems.indexOf(sys);
        if (idx >= 0) this._systems.splice(idx, 1);
        if (this._active === sys) this._active = this._systems[0] ?? null;
        sys.destroy();
    }

    clearAll() {
        this._systems.forEach(s => s.destroy());
        this._systems = [];
        this._active  = null;
    }

    update(dt) {
        this._systems.forEach(s => s.update(dt));
    }

    // ── Set render scale on all systems (used by image capture) ─────────
    setRenderScale(scale) {
        this._systems.forEach(s => s.setRenderScale(scale));
    }

    // ── .nex payload builder ─────────────────────────────────────────────
    _buildPayload() {
        return {
            version:   '1.0',
            format:    'nex',
            type:      'particle_lab',
            timestamp: new Date().toISOString(),
            systems:   this._systems.map(s => s.toJSON()),
        };
    }

    // ── Save to localStorage as .nex (base64) ────────────────────────────
    async save(key = 'nexus_particle_lab') {
        try {
            if (!window._nexEncodeNex) throw new Error('_nexEncodeNex não disponível');
            const bytes = await window._nexEncodeNex(this._buildPayload());
            // Converte Uint8Array para base64 para armazenar no localStorage
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            localStorage.setItem(key, btoa(bin));
            return true;
        } catch (e) {
            // Fallback: salva como JSON simples se .nex falhar
            try {
                localStorage.setItem(key + '_fb', JSON.stringify(this._buildPayload()));
                return true;
            } catch (_) { return false; }
        }
    }

    // ── Load from localStorage (.nex base64 or JSON fallback) ────────────
    async load(key = 'nexus_particle_lab') {
        try {
            let data = null;
            const raw = localStorage.getItem(key);
            if (raw) {
                if (window._nexDecodeNex) {
                    try {
                        const bin   = atob(raw);
                        const bytes = new Uint8Array(bin.length);
                        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                        data = await window._nexDecodeNex(bytes.buffer);
                    } catch (_) { data = null; }
                }
            }
            // Fallback JSON
            if (!data) {
                const fb = localStorage.getItem(key + '_fb');
                if (fb) data = JSON.parse(fb);
            }
            if (!data?.systems?.length) return false;

            this.clearAll();
            data.systems.forEach(json => {
                const sys = ParticleSystem.fromJSON(this._scene, json);
                this._systems.push(sys);
                sys.play();
            });
            this._active = this._systems[0] ?? null;
            return true;
        } catch (e) { return false; }
    }

    // ── Export as downloadable .nex file ─────────────────────────────────
    async exportNex(filename = 'particles.nex') {
        try {
            if (!window._nexEncodeNex) throw new Error('_nexEncodeNex não disponível');
            const bytes = await window._nexEncodeNex(this._buildPayload());
            const blob  = new Blob([bytes], { type: 'application/x-nexus-project' });
            const url   = URL.createObjectURL(blob);
            const a     = document.createElement('a');
            a.href      = url;
            a.download  = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 10000);
            return true;
        } catch (e) { return false; }
    }

    // ── Import from .nex File object ─────────────────────────────────────
    async importNex(file) {
        try {
            if (!window._nexDecodeNex) throw new Error('_nexDecodeNex não disponível');
            const buffer = await file.arrayBuffer();
            const data   = await window._nexDecodeNex(buffer);
            if (!data?.systems?.length) throw new Error('Arquivo .nex não contém partículas');

            this.clearAll();
            data.systems.forEach(json => {
                const sys = ParticleSystem.fromJSON(this._scene, json);
                this._systems.push(sys);
                sys.play();
            });
            this._active = this._systems[0] ?? null;
            return true;
        } catch (e) {
            return { error: e.message };
        }
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function _rnd(a, b) { return a + Math.random() * (b - a); }

// ─── Expose globally ─────────────────────────────────────────────────────────
window._ParticleEngine = { ParticleSystem, ParticleLab, PARTICLE_PRESETS, _getTexture };
