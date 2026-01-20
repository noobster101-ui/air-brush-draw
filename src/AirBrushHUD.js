/**
 * AirBrush HUD System
 * HUD elements and visual feedback for hand gesture 3D drawing
 */
import * as THREE from "three";

class AirBrushHUD {
  constructor(scene, camera, options = {}) {
    this.scene = scene;
    this.camera = camera;

    this.config = {
      primaryColor: new THREE.Color(options.primaryColor || 0x00ffff),
      secondaryColor: new THREE.Color(options.secondaryColor || 0x0088ff),
      accentColor: new THREE.Color(options.accentColor || 0x00ff88),
      warningColor: new THREE.Color(options.warningColor || 0xff6600),
      errorColor: new THREE.Color(options.errorColor || 0xff0000),
      particleCount: options.particleCount || 50,
      particleSize: options.particleSize || 0.02,
      particleLifetime: options.particleLifetime || 500,
      particleDecay: options.particleDecay || 0.95,
      ringRadius: options.ringRadius || 0.15,
      ringThickness: options.ringThickness || 0.008,
      ringSegments: options.ringSegments || 64,
      showFPS: options.showFPS !== false,
    };

    this.particles = [];
    this.confidenceRing = null;
    this.interactionRing = null;
    this.scanningLine = null;
    this.fpsCounter = { frames: 0, lastTime: performance.now(), fps: 60 };
    this.isScanning = false;
    this.scanProgress = 0;

    this.materials = {};
    this._initMaterials();
    this._createConfidenceRing();
    this._createInteractionRing();
    this._createScanningLine();
    this._createFPSDisplay();
  }

  _initMaterials() {
    this.materials.particle = new THREE.PointsMaterial({
      color: this.config.primaryColor,
      size: this.config.particleSize,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.materials.confidenceRing = new THREE.MeshBasicMaterial({
      color: this.config.primaryColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    this.materials.interactionRing = new THREE.MeshBasicMaterial({
      color: this.config.accentColor,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });

    this.materials.scanningLine = new THREE.LineBasicMaterial({
      color: this.config.secondaryColor,
      transparent: true,
      opacity: 0.6,
    });
  }

  _createConfidenceRing() {
    const geometry = new THREE.RingGeometry(
      this.config.ringRadius - this.config.ringThickness,
      this.config.ringRadius,
      this.config.ringSegments
    );

    this.confidenceRing = new THREE.Mesh(geometry, this.materials.confidenceRing.clone());
    this.confidenceRing.visible = false;
    this.scene.add(this.confidenceRing);

    this.arcMeshes = [];
    const numSegments = 8;
    for (let i = 0; i < numSegments; i++) {
      const arcGeometry = new THREE.RingGeometry(
        this.config.ringRadius - this.config.ringThickness,
        this.config.ringRadius,
        8,
        1,
        (i / numSegments) * Math.PI * 2,
        (i / numSegments + 0.125) * Math.PI * 2
      );
      const arcMesh = new THREE.Mesh(arcGeometry, this.materials.confidenceRing.clone());
      arcMesh.visible = false;
      this.scene.add(arcMesh);
      this.arcMeshes.push(arcMesh);
    }
  }

  _createInteractionRing() {
    const geometry = new THREE.RingGeometry(0.15, 0.18, 32);
    this.interactionRing = new THREE.Mesh(geometry, this.materials.interactionRing.clone());
    this.interactionRing.visible = false;
    this.scene.add(this.interactionRing);

    const glowGeometry = new THREE.RingGeometry(0.18, 0.22, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: this.config.accentColor,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    this.interactionGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.interactionRing.add(this.interactionGlow);
  }

  _createScanningLine() {
    const points = [new THREE.Vector3(-10, 0, 0), new THREE.Vector3(10, 0, 0)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.scanningLine = new THREE.Line(geometry, this.materials.scanningLine);
    this.scanningLine.visible = false;
    this.scene.add(this.scanningLine);
  }

  _createFPSDisplay() {
    if (!this.config.showFPS) return;

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    this.fpsCanvas = canvas;
    this.fpsContext = canvas.getContext("2d");

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    this.fpsSprite = new THREE.Sprite(material);
    this.fpsSprite.position.set(-8, 4, 0);
    this.fpsSprite.scale.set(2, 1, 1);
    this.scene.add(this.fpsSprite);
  }

  addParticle(position, gestureType = null) {
    const particle = {
      position: position.clone(),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02),
      lifetime: this.config.particleLifetime,
      maxLifetime: this.config.particleLifetime,
      size: this.config.particleSize * (0.5 + Math.random() * 0.5),
    };

    if (gestureType === "pinch") {
      particle.color = this.config.warningColor;
    } else if (gestureType === "openPalm") {
      particle.color = this.config.accentColor;
    } else if (gestureType === "rotation") {
      particle.color = this.config.secondaryColor;
    } else {
      particle.color = this.config.primaryColor;
    }

    this.particles.push(particle);
  }

  addParticleBurst(position, count = 10, gestureType = null) {
    for (let i = 0; i < count; i++) {
      const offset = new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.1);
      this.addParticle(position.clone().add(offset), gestureType);
    }
  }

  updateConfidenceRing(confidence, position, gesture = null) {
    const numVisible = Math.floor(confidence * this.arcMeshes.length);
    this.arcMeshes.forEach((mesh, index) => {
      mesh.visible = index < numVisible;
      if (mesh.visible && position) {
        mesh.position.copy(position);
        mesh.lookAt(this.camera.position);
      }
    });

    const color = confidence > 0.7 ? this.config.accentColor : confidence > 0.4 ? this.config.secondaryColor : this.config.primaryColor;
    this.arcMeshes.forEach((mesh) => {
      mesh.material.color = color;
    });
  }

  showInteractionRing(position, scale = 1) {
    this.interactionRing.position.copy(position);
    this.interactionRing.visible = true;
    this.interactionRing.scale.setScalar(scale);
    this.interactionRing.lookAt(this.camera.position);
  }

  hideInteractionRing() {
    this.interactionRing.visible = false;
  }

  startScan() {
    this.isScanning = true;
    this.scanProgress = 0;
    this.scanningLine.visible = true;
  }

  stopScan() {
    this.isScanning = false;
    this.scanningLine.visible = false;
  }

  _updateFPS() {
    if (!this.config.showFPS) return;

    this.fpsCounter.frames++;
    const now = performance.now();
    const elapsed = now - this.fpsCounter.lastTime;

    if (elapsed >= 1000) {
      this.fpsCounter.fps = Math.round((this.fpsCounter.frames * 1000) / elapsed);
      this.fpsCounter.frames = 0;
      this.fpsCounter.lastTime = now;

      const ctx = this.fpsContext;
      ctx.clearRect(0, 0, 128, 64);
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, 128, 64);
      ctx.font = "bold 24px monospace";
      ctx.fillStyle = this.fpsCounter.fps >= 50 ? "#00ff88" : this.fpsCounter.fps >= 30 ? "#ffff00" : "#ff0000";
      ctx.textAlign = "center";
      ctx.fillText(`${this.fpsCounter.fps} FPS`, 64, 40);

      this.fpsSprite.material.map.needsUpdate = true;
    }
  }

  update(deltaTime = 0.016) {
    const now = performance.now();
    const time = now * 0.001;

    this._updateParticles(deltaTime, time);

    if (this.interactionRing.visible) {
      this.interactionRing.rotation.z = time * 2;
      this.interactionRing.material.opacity = 0.3 + Math.sin(time * 4) * 0.2;
      this.interactionGlow.rotation.z = -time * 1.5;
      this.interactionGlow.material.opacity = 0.2 + Math.sin(time * 3) * 0.1;
    }

    if (this.isScanning) {
      this.scanProgress += deltaTime * 2;
      if (this.scanProgress > 1) {
        this.scanProgress = 0;
      }
      this.scanningLine.position.z = (this.scanProgress - 0.5) * 10;
      this.scanningLine.material.opacity = 0.3 + Math.sin(time * 10) * 0.2;
    }

    this._updateFPS();
  }

  _updateParticles(deltaTime, time) {
    this.particles = this.particles.filter((p) => {
      p.lifetime -= deltaTime * 1000;
      return p.lifetime > 0;
    });

    if (this.particles.length > 0) {
      const positions = new Float32Array(this.particles.length * 3);
      const colors = new Float32Array(this.particles.length * 3);
      const sizes = new Float32Array(this.particles.length);

      this.particles.forEach((particle, i) => {
        particle.position.add(particle.velocity);
        particle.velocity.multiplyScalar(this.config.particleDecay);

        positions[i * 3] = particle.position.x;
        positions[i * 3 + 1] = particle.position.y;
        positions[i * 3 + 2] = particle.position.z;

        const color = particle.color || this.config.primaryColor;
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        sizes[i] = particle.size * (particle.lifetime / particle.maxLifetime);
      });

      if (!this.particleSystem) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.particles.length * 3), 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.particles.length * 3), 3));
        geometry.setAttribute("size", new THREE.BufferAttribute(new Float32Array(this.particles.length), 1));

        const material = new THREE.PointsMaterial({
          size: this.config.particleSize,
          vertexColors: true,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });

        this.particleSystem = new THREE.Points(geometry, material);
        this.scene.add(this.particleSystem);
      } else {
        // Check if we need to resize the buffers
        const currentPositionAttr = this.particleSystem.geometry.attributes.position;
        const currentColorAttr = this.particleSystem.geometry.attributes.color;
        const currentSizeAttr = this.particleSystem.geometry.attributes.size;

        const needsResize = this.particles.length > currentPositionAttr.count;

        if (needsResize) {
          // Create new geometry with larger buffers
          const newGeometry = new THREE.BufferGeometry();
          newGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.particles.length * 3), 3));
          newGeometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.particles.length * 3), 3));
          newGeometry.setAttribute("size", new THREE.BufferAttribute(new Float32Array(this.particles.length), 1));

          // Copy old data
          const oldPositions = currentPositionAttr.array;
          const oldColors = currentColorAttr.array;
          const oldSizes = currentSizeAttr.array;

          newGeometry.attributes.position.array.set(oldPositions);
          newGeometry.attributes.color.array.set(oldColors);
          newGeometry.attributes.size.array.set(oldSizes);

          // Dispose old geometry and replace
          this.particleSystem.geometry.dispose();
          this.particleSystem.geometry = newGeometry;
        }

        // Update buffers with safe copy
        const copyLength = Math.min(positions.length, this.particleSystem.geometry.attributes.position.array.length);
        this.particleSystem.geometry.attributes.position.array.set(positions.subarray(0, copyLength));
        this.particleSystem.geometry.attributes.position.needsUpdate = true;

        this.particleSystem.geometry.attributes.color.array.set(colors.subarray(0, copyLength));
        this.particleSystem.geometry.attributes.color.needsUpdate = true;

        this.particleSystem.geometry.attributes.size.array.set(sizes.subarray(0, copyLength));
        this.particleSystem.geometry.attributes.size.needsUpdate = true;

        // Update draw range
        this.particleSystem.geometry.setDrawRange(0, copyLength);
      }
    } else if (this.particleSystem) {
      this.particleSystem.geometry.setDrawRange(0, 0);
    }
  }

  showSuccess(position) {
    this.addParticleBurst(position, 20, "openPalm");
    this.startScan();
    setTimeout(() => this.stopScan(), 500);
  }

  showError(position) {
    this.addParticleBurst(position, 15, "pinch");
  }

  setVisible(visible) {
    this.confidenceRing.visible = visible;
    this.interactionRing.visible = visible && this.interactionRing.visible;
    this.scanningLine.visible = visible && this.isScanning;

    if (this.particleSystem) {
      this.particleSystem.visible = visible;
    }
    if (this.fpsSprite) {
      this.fpsSprite.visible = visible && this.config.showFPS;
    }
  }

  dispose() {
    this.particles = [];

    if (this.particleSystem) {
      this.particleSystem.geometry.dispose();
      this.particleSystem.material.dispose();
      this.scene.remove(this.particleSystem);
    }

    this.arcMeshes.forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });

    this.confidenceRing.geometry.dispose();
    this.confidenceRing.material.dispose();
    this.interactionRing.geometry.dispose();
    this.interactionRing.material.dispose();
    this.interactionGlow.geometry.dispose();
    this.interactionGlow.material.dispose();
    this.scanningLine.geometry.dispose();
    this.scanningLine.material.dispose();

    if (this.fpsSprite) {
      if (this.fpsSprite.material.map) this.fpsSprite.material.map.dispose();
      this.fpsSprite.material.dispose();
    }
  }
}

export default AirBrushHUD;
