/**
 * 🎯 Jarvis Physics Engine
 * Inertia-based physics system for smooth object interactions
 *
 * Features:
 * - Velocity tracking with damping
 * - Spring physics for Z-axis depth
 * - Momentum-based rotation
 * - Magnetic snap to grid
 * - Smooth easing functions
 * - Bounce effects
 *
 * @module PhysicsEngine
 */

import * as THREE from "three";

class PhysicsEngine {
  constructor(options = {}) {
    // Configuration
    this.config = {
      // Damping factors (0-1, lower = more slippery)
      positionDamping: options.positionDamping || 0.85,
      rotationDamping: options.rotationDamping || 0.9,
      scaleDamping: options.scaleDamping || 0.8,

      // Spring settings for depth (Z-axis)
      springStiffness: options.springStiffness || 0.15,
      springDamping: options.springDamping || 0.8,
      springRestLength: options.springRestLength || 0,

      // Magnetic snap settings
      enableSnap: options.enableSnap !== false,
      snapStrength: options.snapStrength || 0.1,
      snapGridSize: options.snapGridSize || 0.1,

      // Movement limits
      maxVelocity: options.maxVelocity || 5,
      maxRotationSpeed: options.maxRotationSpeed || Math.PI,
      minScale: options.minScale || 0.1,
      maxScale: options.maxScale || 10,

      // Easing
      easingType: options.easingType || "smoothstep",

      // Interaction zones
      interactionRadius: options.interactionRadius || 0.3,
    };

    // State
    this.objects = new Map(); // Physics objects
    this.globalVelocity = new THREE.Vector3();
    this.globalRotationVelocity = new THREE.Euler();
    this.globalScaleVelocity = new THREE.Vector3();

    // Time tracking
    this.lastTime = performance.now();
    this.deltaTime = 0.016;

    // Easing functions cache
    this._initEasingFunctions();
  }

  /**
   * Initialize easing functions
   * @private
   */
  _initEasingFunctions() {
    this.easingFunctions = {
      // Smoothstep (ease in-out)
      smoothstep: (t) => t * t * (3 - 2 * t),

      // Smootherstep (even smoother)
      smootherstep: (t) => t * t * t * (t * (t * 6 - 15) + 10),

      // Ease out bounce
      easeOutBounce: (t) => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
      },

      // Ease out elastic
      easeOutElastic: (t) => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
      },

      // Ease in out cubic
      easeInOutCubic: (t) => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      },

      // Linear
      linear: (t) => t,
    };
  }

  /**
   * Register a 3D object for physics
   * @param {THREE.Object3D} object - Object to register
   * @param {Object} options - Physics options for this object
   */
  registerObject(object, options = {}) {
    const physicsData = {
      object,
      velocity: new THREE.Vector3(),
      rotationVelocity: new THREE.Euler(),
      scaleVelocity: new THREE.Vector3(),
      mass: options.mass || 1,
      isDragging: false,
      isLocked: false,
      spring: {
        currentZ: 0,
        velocityZ: 0,
        targetZ: 0,
      },
      originalPosition: object.position.clone(),
      originalRotation: object.rotation.clone(),
      originalScale: object.scale.clone(),
      bounds: null,
    };

    this.objects.set(object.uuid, physicsData);
    return physicsData;
  }

  /**
   * Unregister an object from physics
   * @param {THREE.Object3D} object - Object to unregister
   */
  unregisterObject(object) {
    this.objects.delete(object.uuid);
  }

  /**
   * Apply impulse force to object
   * @param {THREE.Object3D} object - Target object
   * @param {THREE.Vector3} force - Force vector
   * @param {THREE.Vector3} point - Point of application (optional, defaults to center)
   */
  applyImpulse(object, force, point = null) {
    const physicsData = this.objects.get(object.uuid);
    if (!physicsData || physicsData.isLocked) return;

    // Apply force divided by mass
    const impulse = force.clone().divideScalar(physicsData.mass);
    physicsData.velocity.add(impulse);

    // Clamp velocity
    physicsData.velocity.clampLength(0, this.config.maxVelocity);
  }

  /**
   * Apply rotation impulse
   * @param {THREE.Object3D} object - Target object
   * @param {THREE.Euler} torque - Rotation torque
   */
  applyRotationImpulse(object, torque) {
    const physicsData = this.objects.get(object.uuid);
    if (!physicsData || physicsData.isLocked) return;

    physicsData.rotationVelocity.x += torque.x;
    physicsData.rotationVelocity.y += torque.y;
    physicsData.rotationVelocity.z += torque.z;

    // Clamp rotation velocity
    physicsData.rotationVelocity.x = Math.max(
      -this.config.maxRotationSpeed,
      Math.min(this.config.maxRotationSpeed, physicsData.rotationVelocity.x)
    );
    physicsData.rotationVelocity.y = Math.max(
      -this.config.maxRotationSpeed,
      Math.min(this.config.maxRotationSpeed, physicsData.rotationVelocity.y)
    );
    physicsData.rotationVelocity.z = Math.max(
      -this.config.maxRotationSpeed,
      Math.min(this.config.maxRotationSpeed, physicsData.rotationVelocity.z)
    );
  }

  /**
   * Start dragging an object
   * @param {THREE.Object3D} object - Object to drag
   * @param {THREE.Vector3} position - Current hand position
   */
  startDrag(object, position) {
    const physicsData = this.objects.get(object.uuid);
    if (!physicsData) return;

    physicsData.isDragging = true;
    physicsData.dragStartPosition = position.clone();
    physicsData.dragStartObjectPosition = object.position.clone();
    physicsData.velocity.set(0, 0, 0);
    physicsData.rotationVelocity.set(0, 0, 0);
  }

  /**
   * Update drag position
   * @param {THREE.Object3D} object - Object being dragged
   * @param {THREE.Vector3} position - Current hand position
   */
  updateDrag(object, position) {
    const physicsData = this.objects.get(object.uuid);
    if (!physicsData || !physicsData.isDragging) return;

    // Calculate velocity from drag movement
    const delta = new THREE.Vector3().subVectors(position, physicsData.dragStartPosition);

    // Apply position with magnetic snap
    if (this.config.enableSnap) {
      delta.x = this._snapToGrid(delta.x + physicsData.dragStartObjectPosition.x) - physicsData.dragStartObjectPosition.x;
      delta.y = this._snapToGrid(delta.y + physicsData.dragStartObjectPosition.y) - physicsData.dragStartObjectPosition.y;
    }

    object.position.copy(physicsData.dragStartObjectPosition).add(delta);

    // Store velocity for when drag ends
    physicsData.velocity.copy(delta).divideScalar(this.deltaTime || 0.016);
  }

  /**
   * End drag with momentum
   * @param {THREE.Object3D} object - Object being dragged
   */
  endDrag(object) {
    const physicsData = this.objects.get(object.uuid);
    if (!physicsData) return;

    physicsData.isDragging = false;
  }

  /**
   * Set Z-depth target for spring physics
   * @param {THREE.Object3D} object - Target object
   * @param {number} z - Target Z position
   */
  setDepthTarget(object, z) {
    const physicsData = this.objects.get(object.uuid);
    if (!physicsData) return;

    physicsData.spring.targetZ = z;
    physicsData.spring.currentZ = object.position.z;
  }

  /**
   * Lock/unlock object physics
   * @param {THREE.Object3D} object - Target object
   * @param {boolean} locked - Lock state
   */
  setLocked(object, locked) {
    const physicsData = this.objects.get(object.uuid);
    if (!physicsData) return;

    physicsData.isLocked = locked;
    if (locked) {
      physicsData.velocity.set(0, 0, 0);
      physicsData.rotationVelocity.set(0, 0, 0);
    }
  }

  /**
   * Snap value to grid
   * @private
   */
  _snapToGrid(value) {
    if (!this.config.enableSnap) return value;
    const gridSize = this.config.snapGridSize;
    return Math.round(value / gridSize) * gridSize;
  }

  /**
   * Update physics simulation
   * @param {number} deltaTime - Time step (optional, auto-calculated if not provided)
   */
  update(deltaTime = null) {
    // Calculate delta time
    const now = performance.now();
    this.deltaTime = deltaTime || (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Clamp delta time to avoid explosions
    this.deltaTime = Math.min(this.deltaTime, 0.1);

    // Update each registered object
    for (const [, physicsData] of this.objects) {
      if (physicsData.isLocked) continue;

      const object = physicsData.object;

      // Apply position damping (inertia)
      if (!physicsData.isDragging) {
        object.position.add(physicsData.velocity.clone().multiplyScalar(this.deltaTime));
        physicsData.velocity.multiplyScalar(this.config.positionDamping);

        // Stop if velocity is very small
        if (physicsData.velocity.length() < 0.0001) {
          physicsData.velocity.set(0, 0, 0);
        }
      }

      // Apply rotation damping
      object.rotation.x += physicsData.rotationVelocity.x * this.deltaTime;
      object.rotation.y += physicsData.rotationVelocity.y * this.deltaTime;
      object.rotation.z += physicsData.rotationVelocity.z * this.deltaTime;
      physicsData.rotationVelocity.x *= this.config.rotationDamping;
      physicsData.rotationVelocity.y *= this.config.rotationDamping;
      physicsData.rotationVelocity.z *= this.config.rotationDamping;

      // Stop rotation if very slow
      if (Math.abs(physicsData.rotationVelocity.x) < 0.0001) physicsData.rotationVelocity.x = 0;
      if (Math.abs(physicsData.rotationVelocity.y) < 0.0001) physicsData.rotationVelocity.y = 0;
      if (Math.abs(physicsData.rotationVelocity.z) < 0.0001) physicsData.rotationVelocity.z = 0;

      // Spring physics for Z-axis depth
      if (object.position.z !== physicsData.spring.targetZ) {
        const displacement = object.position.z - physicsData.spring.targetZ;
        const springForce = -this.config.springStiffness * displacement;
        const dampingForce = -this.config.springDamping * physicsData.spring.velocityZ;
        const acceleration = springForce + dampingForce;

        physicsData.spring.velocityZ += acceleration * this.deltaTime;
        object.position.z += physicsData.spring.velocityZ * this.deltaTime;

        // Stop if near equilibrium
        if (Math.abs(displacement) < 0.001 && Math.abs(physicsData.spring.velocityZ) < 0.001) {
          object.position.z = physicsData.spring.targetZ;
          physicsData.spring.velocityZ = 0;
        }
      }

      // Magnetic snap for X and Y
      if (this.config.enableSnap && !physicsData.isDragging) {
        object.position.x = this._snapToGrid(object.position.x);
        object.position.y = this._snapToGrid(object.position.y);
      }
    }

    // Update global velocities
    this.globalVelocity.multiplyScalar(this.config.positionDamping);
    this.globalRotationVelocity.x *= this.config.rotationDamping;
    this.globalRotationVelocity.y *= this.config.rotationDamping;
    this.globalRotationVelocity.z *= this.config.rotationDamping;
  }

  /**
   * Animate object to target transform with easing
   * @param {THREE.Object3D} object - Object to animate
   * @param {Object} target - Target transform {position, rotation, scale}
   * @param {number} duration - Animation duration in ms
   * @param {string} easing - Easing function name
   * @returns {Promise} Promise that resolves when animation completes
   */
  animateTo(object, target, duration = 1000, easing = "smoothstep") {
    return new Promise((resolve) => {
      const physicsData = this.objects.get(object.uuid);
      if (!physicsData) {
        resolve();
        return;
      }

      const startPosition = object.position.clone();
      const startRotation = object.rotation.clone();
      const startScale = object.scale.clone();

      const endPosition = target.position || startPosition.clone();
      const endRotation = target.rotation || startRotation.clone();
      const endScale = target.scale || startScale.clone();

      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = this.easingFunctions[easing]
          ? this.easingFunctions[easing](progress)
          : this.easingFunctions.smoothstep(progress);

        // Interpolate position
        object.position.lerpVectors(startPosition, endPosition, easedProgress);

        // Interpolate rotation
        object.rotation.x = startRotation.x + (endRotation.x - startRotation.x) * easedProgress;
        object.rotation.y = startRotation.y + (endRotation.y - startRotation.y) * easedProgress;
        object.rotation.z = startRotation.z + (endRotation.z - startRotation.z) * easedProgress;

        // Interpolate scale
        object.scale.lerpVectors(startScale, endScale, easedProgress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      animate();
    });
  }

  /**
   * Apply bounce effect
   * @param {THREE.Object3D} object - Object to bounce
   * @param {number} amplitude - Bounce amplitude
   * @param {number} duration - Bounce duration in ms
   */
  bounce(object, amplitude = 0.2, duration = 500) {
    const physicsData = this.objects.get(object.uuid);
    if (!physicsData) return;

    const startZ = object.position.z;
    const bounceUp = () => {
      const startTime = performance.now();
      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const bounce = this.easingFunctions.easeOutBounce(progress);

        object.position.z = startZ + amplitude * bounce * (1 - progress);

        if (progress < 1) {
          requestAnimationFrame(bounceUp);
        } else {
          object.position.z = startZ;
        }
      };
      animate();
    };

    bounceUp();
  }

  /**
   * Apply wobble effect
   * @param {THREE.Object3D} object - Object to wobble
   * @param {number} amplitude - Wobble amplitude
   * @param {number} frequency - Wobble frequency
   * @param {number} duration - Wobble duration in ms
   */
  wobble(object, amplitude = 0.1, frequency = 10, duration = 1000) {
    const startRotation = object.rotation.clone();
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress >= 1) {
        object.rotation.copy(startRotation);
        return;
      }

      const wobbleAmount = Math.sin(elapsed * 0.001 * frequency * Math.PI * 2) * amplitude * (1 - progress);
      object.rotation.x = startRotation.x + wobbleAmount;
      object.rotation.y = startRotation.y + wobbleAmount * 0.5;
      object.rotation.z = startRotation.z + wobbleAmount * 0.3;

      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Check if point is within interaction radius of object
   * @param {THREE.Object3D} object - Target object
   * @param {THREE.Vector3} point - Point to check
   * @returns {boolean} Whether point is within interaction zone
   */
  isInInteractionZone(object, point) {
    const physicsData = this.objects.get(object.uuid);
    if (!physicsData) return false;

    const distance = object.position.distanceTo(point);
    return distance < this.config.interactionRadius;
  }

  /**
   * Get physics state of object
   * @param {THREE.Object3D} object - Target object
   * @returns {Object} Physics state
   */
  getState(object) {
    const physicsData = this.objects.get(object.uuid);
    if (!physicsData) return null;

    return {
      velocity: physicsData.velocity.clone(),
      rotationVelocity: physicsData.rotationVelocity.clone(),
      isDragging: physicsData.isDragging,
      isLocked: physicsData.isLocked,
      kineticEnergy: physicsData.velocity.lengthSq() * physicsData.mass,
      angularMomentum:
        (Math.abs(physicsData.rotationVelocity.x) + Math.abs(physicsData.rotationVelocity.y) + Math.abs(physicsData.rotationVelocity.z)) *
        physicsData.mass,
    };
  }

  /**
   * Reset object to original transform
   * @param {THREE.Object3D} object - Object to reset
   * @param {boolean} animate - Whether to animate the reset
   * @param {number} duration - Animation duration
   */
  resetObject(object, animate = true, duration = 500) {
    const physicsData = this.objects.get(object.uuid);
    if (!physicsData) return;

    if (animate) {
      this.animateTo(
        object,
        {
          position: physicsData.originalPosition.clone(),
          rotation: physicsData.originalRotation.clone(),
          scale: physicsData.originalScale.clone(),
        },
        duration,
        "easeOutElastic"
      );
    } else {
      object.position.copy(physicsData.originalPosition);
      object.rotation.copy(physicsData.originalRotation);
      object.scale.copy(physicsData.originalScale);
    }

    physicsData.velocity.set(0, 0, 0);
    physicsData.rotationVelocity.set(0, 0, 0);
    physicsData.spring.velocityZ = 0;
    physicsData.spring.currentZ = 0;
    physicsData.spring.targetZ = 0;
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
    this.objects.clear();
  }
}

export default PhysicsEngine;
