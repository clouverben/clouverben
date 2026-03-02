import * as THREE from 'three';

class FireParticleSystem extends THREE.Object3D {
    constructor() {
        super();
        this.name = 'Fogo ' + (++window.fireCounter || 1);
        
        // ========== CONFIGURAÇÕES ==========
        this.flameHeight = 3.5;
        this.baseWidth = 1.3;
        this.particleCount = 400;
        this.sparkCount = 300;
        this.smokeCount = 400;
        
        // ========== CORES E BRILHO ==========
        this.particleColor = '#ffaa33';
        this.brightness = 1.0;
        this.opacity = 0.9;
        
        // ========== CONTROLE DE MOVIMENTO ==========
        this.lastPosition = new THREE.Vector3();
        this.lastPosition.copy(this.position);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.dragFactor = 0.15;
        
        // ========== TEXTURAS ==========
        this.flameTexture = this.createFlameTexture();
        this.sparkTexture = this.createSparkTexture();
        this.smokeTexture = this.createSmokeTexture();
        
        // ========== ARRAYS ==========
        this.flameSprites = [];
        this.flameData = [];
        this.sparkSprites = [];
        this.sparkData = [];
        this.smokeSprites = [];
        this.smokeData = [];
        
        // ========== INICIALIZAR PARTÍCULAS ==========
        this.initFlames();
        this.initSparks();
        this.initSmoke();
        
        // ========== ESFERA DE SELEÇÃO ==========
        // Layer 31: câmera nunca renderiza, mas o Raycaster acerta normalmente
        const pickSphere = new THREE.Mesh(
            new THREE.SphereGeometry(1.5, 8, 8),
            new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
        );
        pickSphere.position.set(0, 1.5, 0);
        pickSphere.layers.set(31); // ← invisível para câmera e bloom, visível para raycast
        this.add(pickSphere);
        
        this.clock = new THREE.Clock();
    }

    createFlameTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const gradient = ctx.createLinearGradient(32, 0, 32, 128);
        gradient.addColorStop(0,   'rgba(255, 220, 100, 0)');
        gradient.addColorStop(0.3, 'rgba(255, 180, 0, 1)');
        gradient.addColorStop(0.6, 'rgba(255, 100, 0, 1)');
        gradient.addColorStop(0.9, 'rgba(180, 40, 0, 1)');
        gradient.addColorStop(1,   'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(32, 70, 22, 45, 0, 0, Math.PI * 2);
        ctx.fill();
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i+3] > 0) {
                const r = Math.random() * 0.3 + 0.85;
                data[i] = Math.min(255, data[i] * r);
                data[i+1] = Math.min(255, data[i+1] * r * 0.9);
            }
        }
        ctx.putImageData(imageData, 0, 0);
        
        return new THREE.CanvasTexture(canvas);
    }

    createSparkTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
        gradient.addColorStop(0, 'rgba(255, 200, 100, 1)');
        gradient.addColorStop(0.6, 'rgba(255, 80, 0, 0.9)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 24, 24);
        
        return new THREE.CanvasTexture(canvas);
    }

    createSmokeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
        gradient.addColorStop(0, 'rgba(220, 140, 70, 0.9)');
        gradient.addColorStop(0.5, 'rgba(140, 80, 40, 0.7)');
        gradient.addColorStop(0.9, 'rgba(80, 50, 30, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 48, 48);
        
        return new THREE.CanvasTexture(canvas);
    }

    initFlames() {
        for (let i = 0; i < this.particleCount; i++) {
            const material = new THREE.SpriteMaterial({
                map: this.flameTexture,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                opacity: this.opacity * 0.9,
                color: new THREE.Color(this.particleColor).multiplyScalar(this.brightness)
            });
            const sprite = new THREE.Sprite(material);
            
            const r = Math.random() * this.baseWidth;
            const a = Math.random() * Math.PI * 2;
            sprite.position.set(
                Math.cos(a) * r,
                Math.random() * 0.5,
                Math.sin(a) * r
            );
            
            const scale = 0.8 + Math.random() * 1.2;
            sprite.scale.set(scale * 0.8, scale * 1.3, 1);
            
            this.flameData.push({
                life: Math.random(),
                vel: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.6,
                    1.5 + Math.random() * 2.0,
                    (Math.random() - 0.5) * 0.6
                ),
                baseScale: scale
            });
            
            this.flameSprites.push(sprite);
            this.add(sprite);
        }
    }

    initSparks() {
        for (let i = 0; i < this.sparkCount; i++) {
            const material = new THREE.SpriteMaterial({
                map: this.sparkTexture,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                color: new THREE.Color(this.particleColor).multiplyScalar(this.brightness),
                opacity: this.opacity * 0.9
            });
            const sprite = new THREE.Sprite(material);
            
            const r = Math.random() * this.baseWidth;
            const a = Math.random() * Math.PI * 2;
            const y = Math.random() * this.flameHeight;
            sprite.position.set(
                Math.cos(a) * r,
                y,
                Math.sin(a) * r
            );
            
            const scale = 0.4 + Math.random() * 0.6;
            sprite.scale.set(scale, scale, 1);
            
            const vy = Math.random() < 0.4 ? -1.0 - Math.random() * 2.0 : 0.8 + Math.random() * 1.5;
            
            this.sparkData.push({
                life: Math.random(),
                vel: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.8,
                    vy,
                    (Math.random() - 0.5) * 0.8
                ),
                baseScale: scale
            });
            
            this.sparkSprites.push(sprite);
            this.add(sprite);
        }
    }

    initSmoke() {
        for (let i = 0; i < this.smokeCount; i++) {
            const material = new THREE.SpriteMaterial({
                map: this.smokeTexture,
                blending: THREE.NormalBlending,
                depthWrite: false,
                transparent: true,
                color: new THREE.Color(this.particleColor).multiplyScalar(this.brightness),
                opacity: this.opacity * 0.7
            });
            const sprite = new THREE.Sprite(material);
            
            const r = Math.random() * this.baseWidth * 0.7;
            const a = Math.random() * Math.PI * 2;
            const y = 0.5 + Math.random() * 1.5;
            sprite.position.set(
                Math.cos(a) * r,
                y,
                Math.sin(a) * r
            );
            
            const scale = 0.7 + Math.random() * 0.9;
            sprite.scale.set(scale, scale, 1);
            
            const vy = Math.random() < 0.3 ? -0.3 - Math.random() * 1.0 : 0.2 + Math.random() * 0.5;
            
            this.smokeData.push({
                life: Math.random(),
                vel: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    vy,
                    (Math.random() - 0.5) * 0.3
                ),
                baseScale: scale
            });
            
            this.smokeSprites.push(sprite);
            this.add(sprite);
        }
    }

    update() {
        const delta = Math.min(this.clock.getDelta(), 0.1);
        this.time += delta;
        
        this.velocity.copy(this.position).sub(this.lastPosition).divideScalar(delta);
        if (this.velocity.length() > 10) this.velocity.normalize().multiplyScalar(10);
        
        this.updateFlames(delta);
        this.updateSparks(delta);
        this.updateSmoke(delta);
        
        this.lastPosition.copy(this.position);
    }

    applyMotionToParticle(vel) {
        vel.x -= this.velocity.x * this.dragFactor;
        vel.z -= this.velocity.z * this.dragFactor;
    }

    isWithinLimits(pos) {
        const dx = pos.x;
        const dz = pos.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        return dist <= this.baseWidth * 2.5 && pos.y >= 0 && pos.y <= this.flameHeight * 1.2;
    }

    updateFlames(delta) {
        for (let i = 0; i < this.particleCount; i++) {
            const sprite = this.flameSprites[i];
            const data = this.flameData[i];
            
            this.applyMotionToParticle(data.vel);
            data.life += delta * 0.5;
            
            if (data.life >= 1.0 || !this.isWithinLimits(sprite.position)) {
                data.life = 0;
                const r = Math.random() * this.baseWidth;
                const a = Math.random() * Math.PI * 2;
                sprite.position.set(
                    Math.cos(a) * r,
                    0,
                    Math.sin(a) * r
                );
                
                data.vel.set(
                    (Math.random() - 0.5) * 0.8,
                    1.5 + Math.random() * 2.0,
                    (Math.random() - 0.5) * 0.8
                );
                
                data.baseScale = 0.8 + Math.random() * 1.2;
            } else {
                data.vel.x += Math.sin(this.time * 3 + i) * delta * 0.3;
                data.vel.z += Math.cos(this.time * 2.5 + i) * delta * 0.3;
                
                sprite.position.x += data.vel.x * delta * 1.8;
                sprite.position.y += data.vel.y * delta;
                sprite.position.z += data.vel.z * delta * 1.8;
                
                const progress = data.life;
                const scaleFactor = Math.sin(progress * Math.PI) * 0.8 + 0.4;
                const scale = data.baseScale * scaleFactor;
                sprite.scale.set(scale * 0.8, scale * 1.3, 1);
                
                sprite.material.opacity = this.opacity * 0.9 * (1 - progress * 0.4);
                
                const r = 1.0;
                const g = 0.8 - progress * 0.3;
                const b = 0.3 - progress * 0.2;
                sprite.material.color.setRGB(r, g, b);
                
                if (sprite.position.y > this.flameHeight) {
                    data.life = 1.0;
                }
            }
        }
    }

    updateSparks(delta) {
        for (let i = 0; i < this.sparkCount; i++) {
            const sprite = this.sparkSprites[i];
            const data = this.sparkData[i];
            
            this.applyMotionToParticle(data.vel);
            data.life += delta * 0.6;
            
            if (data.life >= 1.0 || !this.isWithinLimits(sprite.position)) {
                data.life = 0;
                const r = Math.random() * this.baseWidth;
                const a = Math.random() * Math.PI * 2;
                const y = Math.random() * this.flameHeight;
                sprite.position.set(
                    Math.cos(a) * r,
                    y,
                    Math.sin(a) * r
                );
                
                const vy = Math.random() < 0.4 ? -1.0 - Math.random() * 2.0 : 0.8 + Math.random() * 1.5;
                data.vel.set(
                    (Math.random() - 0.5) * 0.8,
                    vy,
                    (Math.random() - 0.5) * 0.8
                );
                
                data.baseScale = 0.4 + Math.random() * 0.6;
                sprite.scale.set(data.baseScale, data.baseScale, 1);
            } else {
                sprite.position.x += data.vel.x * delta;
                sprite.position.y += data.vel.y * delta;
                sprite.position.z += data.vel.z * delta;
                
                sprite.material.opacity = this.opacity * 0.9 * (1 - data.life * 0.5);
                
                if (sprite.position.y < 0 || sprite.position.y > this.flameHeight) {
                    data.life = 1.0;
                }
            }
        }
    }

    updateSmoke(delta) {
        for (let i = 0; i < this.smokeCount; i++) {
            const sprite = this.smokeSprites[i];
            const data = this.smokeData[i];
            
            this.applyMotionToParticle(data.vel);
            data.life += delta * 0.4;
            
            if (data.life >= 1.0 || !this.isWithinLimits(sprite.position)) {
                data.life = 0;
                const r = Math.random() * this.baseWidth * 0.7;
                const a = Math.random() * Math.PI * 2;
                const y = 0.5 + Math.random() * 1.5;
                sprite.position.set(
                    Math.cos(a) * r,
                    y,
                    Math.sin(a) * r
                );
                
                const vy = Math.random() < 0.3 ? -0.3 - Math.random() * 1.0 : 0.2 + Math.random() * 0.5;
                data.vel.set(
                    (Math.random() - 0.5) * 0.3,
                    vy,
                    (Math.random() - 0.5) * 0.3
                );
                
                data.baseScale = 0.7 + Math.random() * 0.9;
                sprite.scale.set(data.baseScale, data.baseScale, 1);
            } else {
                sprite.position.x += data.vel.x * delta;
                sprite.position.y += data.vel.y * delta;
                sprite.position.z += data.vel.z * delta;
                
                const scale = data.baseScale * (1.0 + data.life * 0.5);
                sprite.scale.set(scale, scale, 1);
                
                sprite.material.opacity = this.opacity * 0.7 * (1 - data.life * 0.5);
                
                if (sprite.position.y < 0 || sprite.position.y > this.flameHeight) {
                    data.life = 1.0;
                }
            }
        }
    }

    // ========== MÉTODOS DE CONTROLE ==========
    setColor(colorHex) {
        this.particleColor = colorHex;
        const color = new THREE.Color(colorHex).multiplyScalar(this.brightness);
        this.flameSprites.forEach(sprite => sprite.material.color.set(color));
        this.sparkSprites.forEach(sprite => sprite.material.color.set(color));
        this.smokeSprites.forEach(sprite => sprite.material.color.set(color));
    }

    setBrightness(value) {
        this.brightness = value;
        this.setColor(this.particleColor);
    }

    setOpacity(value) {
        this.opacity = value;
    }
}

// Tornando acessível globalmente
window.fireCounter = 0;
window.FireParticleSystem = FireParticleSystem;
window.createFire = function() { return new FireParticleSystem(); };
