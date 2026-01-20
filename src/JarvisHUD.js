/**
 * 🎯 Jarvis HUD System
 * Futuristic HUD elements and visual feedback
 *
 * Features:
 * - Particle trail following hand
 * - Gesture confidence circular progress
 * - Landmark index debug overlay
 * - Pulsing rings at interaction point
 * - Scanning line animation
 * - Status indicators
 * - FPS counter
 *
 * @module JarvisHUD
 */

import * as THREE from "three";

class JarvisHUD {
  constructor(scene, camera, options = {}) {
    this.scene = scene;
    this.camera = camera;

    // Configuration
    this.config = {
      // Colors
      primaryColor: new THREE.Color(options.primaryColor || 0x00ffff),
      secondaryColor: new THREE.Color(options.secondaryColor || 0x0088ff),
      accentColor: new THREE.Color(options.accentColor || 0x00ff88),
      warningColor: new THREE.Color(options.warningColor || 0xff6600),
      errorColor: new THREE.Color(options.errorColor || 0xff0000),

      // Particle trail
      particleCount: options.particleCount || 50,
      particleSize: options.particleSize || 0.02,
      particleLifetime: options.particleLifetime || 500,
      particleDecay: options.particleDecay || 0.95,

      // Confidence ring
      ringRadius: options.ringRadius || 0.15,
      ringThickness: options.ringThickness || 0.008,
      ringSegments: options.ringSegments || 64,

      // Debug mode
      showDebug: options.showDebug || false,
      showFPS: options.showFPS !== false,
      showLandmarkIndices: options.showLandmarkIndices || false,
      showVelocityVectors: options.showVelocityVectors || false,
    };

    // State
    this.particles = [];
    this.confidenceRing = null;
    this.debugOverlay = null;
    this.interactionRing = null;
    this.scanningLine = null;
    this.fpsCounter = { frames: 0, lastTime: performance.now(), fps: 60 };
    this.gestureConfidence = 0;
    this.currentGesture = null;
    this.isScanning = false;
    this.scanProgress = 0;

    // Materials cache
    this.materials = {};
    this._initMaterials();

    // Create HUD elements
    this._createConfidenceRing();
    this._createInteractionRing();
    this._createScanningLine();
    this._createFPSDisplay();
  }

  /**
   * Initialize materials
   * @private
   */
  _initMaterials() {
    // Particle material
    this.materials.particle = new THREE.PointsMaterial({
      color: this.config.primaryColor,
      size: this.config.particleSize,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Confidence ring material
    this.materials.confidenceRing = new THREE.MeshBasicMaterial({
      color: this.config.primaryColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    // Interaction ring material
    this.materials.interactionRing = new THREE.MeshBasicMaterial({
      color: this.config.accentColor,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });

    // Scanning line material
    this.materials.scanningLine = new THREE.LineBasicMaterial({
      color: this.config.secondaryColor,
      transparent: true,
      opacity: 0.6,
    });

    // Debug text sprite
    this.materials.debugText = new THREE.SpriteMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
  }

  /**
   * Create confidence ring (circular progress)
   * @private
   */
  _createConfidenceRing() {
    // Create ring geometry
    const geometry = new THREE.RingGeometry(
      this.config.ringRadius - this.config.ringThickness,
      this.config.ringRadius,
      this.config.ringSegments
    );

    this.confidenceRing = new THREE.Mesh(geometry, this.materials.confidenceRing.clone());
    this.confidenceRing.visible = false;
    this.scene.add(this.confidenceRing);

    // Create arc segments for progress display
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

  /**
   * Create interaction ring
   * @private
   */
  _createInteractionRing() {
    const geometry = new THREE.RingGeometry(0.15, 0.18, 32);
    this.interactionRing = new THREE.Mesh(geometry, this.materials.interactionRing.clone());
    this.interactionRing.visible = false;
    this.scene.add(this.interactionRing);

    // Add outer glow ring
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

  /**
   * Create scanning line effect
   * @private
   */
  _createScanningLine() {
    const points = [new THREE.Vector3(-10, 0, 0), new THREE.Vector3(10, 0, 0)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.scanningLine = new THREE.Line(geometry, this.materials.scanningLine);
    this.scanningLine.visible = false;
    this.scene.add(this.scanningLine);
  }

  /**
   * Create FPS display (using canvas)
   * @private
   */
  _createFPSDisplay() {
    if (!this.config.showFPS) return;

    // Create canvas for FPS text
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

  /**
   * Add particle trail at position
   * @param {THREE.Vector3} position - Position to add particle
   * @param {string} gestureType - Type of gesture (optional, affects color)
   */
  addParticle(position, gestureType = null) {
    const particle = {
      position: position.clone(),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02),
      lifetime: this.config.particleLifetime,
      maxLifetime: this.config.particleLifetime,
      size: this.config.particleSize * (0.5 + Math.random() * 0.5),
    };

    // Color based on gesture
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

  /**
   * Add multiple particles in a burst
   * @param {THREE.Vector3} position - Center position
   * @param {number} count - Number of particles
   * @param {string} gestureType - Gesture type for color
   */
  addParticleBurst(position, count = 10, gestureType = null) {
    for (let i = 0; i < count; i++) {
      const offset = new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.1);
      this.addParticle(position.clone().add(offset), gestureType);
    }
  }

  /**
   * Update confidence ring display
   * @param {number} confidence - Confidence value (0-1)
   * @param {THREE.Vector3} position - Position to display
   * @param {string} gesture - Gesture name
   */
  updateConfidenceRing(confidence, position, gesture = null) {
    this.confidence = confidence;
    this.confidencePosition = position;
    this.currentGesture = gesture;

    // Update ring segments based on confidence
    const numVisible = Math.floor(confidence * this.arcMeshes.length);
    this.arcMeshes.forEach((mesh, index) => {
      mesh.visible = index < numVisible;
      if (mesh.visible && position) {
        mesh.position.copy(position);
        mesh.lookAt(this.camera.position);
      }
    });

    // Update ring color based on confidence
    const color = confidence > 0.7 ? this.config.accentColor : confidence > 0.4 ? this.config.secondaryColor : this.config.primaryColor;

    this.arcMeshes.forEach((mesh) => {
      mesh.material.color = color;
    });
  }

  /**
   * Show interaction ring at position
   * @param {THREE.Vector3} position - Position to show ring
   * @param {number} scale - Scale factor (0-1)
   */
  showInteractionRing(position, scale = 1) {
    this.interactionRing.position.copy(position);
    this.interactionRing.visible = true;
    this.interactionRing.scale.setScalar(scale);
    this.interactionRing.lookAt(this.camera.position);
  }

  /**
   * Hide interaction ring
   */
  hideInteractionRing() {
    this.interactionRing.visible = false;
  }

  /**
   * Start scanning animation
   */
  startScan() {
    this.isScanning = true;
    this.scanProgress = 0;
    this.scanningLine.visible = true;
  }

  /**
   * Stop scanning animation
   */
  stopScan() {
    this.isScanning = false;
    this.scanningLine.visible = false;
  }

  /**
   * Update FPS counter
   */
  _updateFPS() {
    if (!this.config.showFPS) return;

    this.fpsCounter.frames++;
    const now = performance.now();
    const elapsed = now - this.fpsCounter.lastTime;

    if (elapsed >= 1000) {
      this.fpsCounter.fps = Math.round((this.fpsCounter.frames * 1000) / elapsed);
      this.fpsCounter.frames = 0;
      this.fpsCounter.lastTime = now;

      // Update canvas
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

  /**
   * Update HUD elements
   * @param {number} deltaTime - Time delta
   */
  update(deltaTime = 0.016) {
    const now = performance.now();
    const time = now * 0.001;

    // Update particles
    this._updateParticles(deltaTime, time);

    // Update interaction ring animation
    if (this.interactionRing.visible) {
      this.interactionRing.rotation.z = time * 2;
      this.interactionRing.material.opacity = 0.3 + Math.sin(time * 4) * 0.2;
      this.interactionGlow.rotation.z = -time * 1.5;
      this.interactionGlow.material.opacity = 0.2 + Math.sin(time * 3) * 0.1;
    }

    // Update scanning line
    if (this.isScanning) {
      this.scanProgress += deltaTime * 2;
      if (this.scanProgress > 1) {
        this.scanProgress = 0;
      }
      this.scanningLine.position.z = (this.scanProgress - 0.5) * 10;
      this.scanningLine.material.opacity = 0.3 + Math.sin(time * 10) * 0.2;
    }

    // Update confidence ring pulsing
    if (this.confidenceRing.visible) {
      const pulse = Math.sin(time * 3) * 0.1 + 0.9;
      this.confidenceRing.scale.setScalar(pulse);
    }

    // Update FPS
    this._updateFPS();
  }

  /**
   * Update particle system
   * @private
   */
  _updateParticles(deltaTime, time) {
    // Remove dead particles
    this.particles = this.particles.filter((p) => {
      p.lifetime -= deltaTime * 1000;
      return p.lifetime > 0;
    });

    // Update particle positions and render
    if (this.particles.length > 0) {
      // Create/update particle geometry
      const positions = new Float32Array(this.particles.length * 3);
      const colors = new Float32Array(this.particles.length * 3);
      const sizes = new Float32Array(this.particles.length);

      this.particles.forEach((particle, i) => {
        // Update position
        particle.position.add(particle.velocity);
        particle.velocity.multiplyScalar(this.config.particleDecay);

        // Add to buffers
        positions[i * 3] = particle.position.x;
        positions[i * 3 + 1] = particle.position.y;
        positions[i * 3 + 2] = particle.position.z;

        // Color
        const color = particle.color || this.config.primaryColor;
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        // Size based on lifetime
        sizes[i] = particle.size * (particle.lifetime / particle.maxLifetime);
      });

      // Create/update particle system mesh
      if (!this.particleSystem) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

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

  /**
   * Show debug overlay for hand landmarks
   * @param {Array} hands - Hand landmarks
   * @param {THREE.Vector3} handPosition - Hand position in 3D
   */
  showDebugOverlay(hands, handPosition) {
    if (!this.config.showDebug) return;

    // Create debug sprites for landmark indices
    if (!this.debugSprites) {
      this.debugSprites = [];

      // Create 21 sprites for each hand
      for (let h = 0; h < 2; h++) {
        for (let i = 0; i < 21; i++) {
          const sprite = new THREE.Sprite(this.materials.debugText.clone());
          sprite.visible = false;
          this.scene.add(sprite);
          this.debugSprites.push({ sprite, handIndex: h, landmarkIndex: i });
        }
      }
    }

    // Update sprite positions
    this.debugSprites.forEach(({ sprite, handIndex, landmarkIndex }) => {
      if (hands[handIndex] && hands[handIndex][landmarkIndex]) {
        const lm = hands[handIndex][landmarkIndex];
        const x = -(lm.x - 0.5) * 5;
        const y = -(lm.y - 0.5) * 5;
        const z = lm.z * 2 + 1;

        sprite.position.set(x, y, z);
        sprite.visible = this.config.showLandmarkIndices && handIndex < hands.length;

        // Update text
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgba(0, 255, 255, 0.8)";
        ctx.font = "bold 48px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(landmarkIndex.toString(), 32, 32);

        sprite.material.map = new THREE.CanvasTexture(canvas);
      } else {
        sprite.visible = false;
      }
    });
  }

  /**
   * Hide debug overlay
   */
  hideDebugOverlay() {
    if (this.debugSprites) {
      this.debugSprites.forEach(({ sprite }) => {
        sprite.visible = false;
      });
    }
  }

  /**
   * Show success animation
   * @param {THREE.Vector3} position - Position to show animation
   */
  showSuccess(position) {
    this.addParticleBurst(position, 20, "openPalm");
    this.startScan();
    setTimeout(() => this.stopScan(), 500);
  }

  /**
   * Show error feedback
   * @param {THREE.Vector3} position - Position to show error
   */
  showError(position) {
    this.addParticleBurst(position, 15, "pinch");
  }

  /**
   * Update gesture status display
   * @param {string} status - Status text
   * @param {string} type - Status type ('success', 'warning', 'error', 'info')
   */
  updateStatus(status, type = "info") {
    // This would update an HTML overlay
    // For now, just update the particle color
    const colorMap = {
      success: this.config.accentColor,
      warning: this.config.warningColor,
      error: this.config.errorColor,
      info: this.config.primaryColor,
    };

    this.materials.particle.color = colorMap[type] || this.config.primaryColor;
  }

  /**
   * Set visible state
   * @param {boolean} visible - Visibility state
   */
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

  /**
   * Update configuration
   * @param {Object} config - New configuration options
   */
  updateConfig(config) {
    Object.assign(this.config, config);
  }

  /**
   * Dispose of all resources
   */
  dispose() {
    // Dispose particles
    this.particles = [];

    // Dispose geometries
    if (this.particleSystem) {
      this.particleSystem.geometry.dispose();
      this.particleSystem.material.dispose();
      this.scene.remove(this.particleSystem);
    }

    // Dispose HUD elements
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

    // Dispose debug sprites
    if (this.debugSprites) {
      this.debugSprites.forEach(({ sprite }) => {
        if (sprite.material.map) sprite.material.map.dispose();
        sprite.material.dispose();
      });
    }

    // Dispose FPS display
    if (this.fpsSprite) {
      if (this.fpsSprite.material.map) this.fpsSprite.material.map.dispose();
      this.fpsSprite.material.dispose();
    }
  }
}

export default JarvisHUD;
