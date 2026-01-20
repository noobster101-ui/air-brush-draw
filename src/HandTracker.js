/**
 * 🎯 OpenAirBrush Hand Tracker
 * Enhanced hand tracking with smooth interpolation, glowing joints, and motion visualization
 *
 * Features:
 * - Smooth landmark positions using lerp
 * - 21 glowing joint spheres per hand
 * - Skeleton lines with gradient colors
 * - Motion velocity vectors
 * - Depth-aware rendering
 *
 * @module HandTracker
 */

import * as THREE from "three";

class HandTracker {
  constructor(scene, options = {}) {
    this.scene = scene;

    // Configuration
    this.config = {
      smoothingFactor: options.smoothingFactor || 0.3, // 0-1, lower = smoother but more lag
      jointSize: options.jointSize || 0.015,
      jointGlowSize: options.jointGlowSize || 0.03,
      showSkeleton: options.showSkeleton !== false,
      showJoints: options.showJoints !== false,
      showVelocity: options.showVelocity || false,
      velocityScale: options.velocityScale || 0.5,
      maxHands: options.maxHands || 2,
      colors: {
        primary: options.primaryColor || 0x00ffff,
        secondary: options.secondaryColor || 0x0088ff,
        accent: options.accentColor || 0x00ff88,
        velocity: options.velocityColor || 0xff6600,
        error: options.errorColor || 0xff0000,
      },
    };

    // State
    this.hands = new Map(); // Map of hand meshes by hand ID
    this.prevLandmarks = new Map(); // Previous landmarks for smoothing
    this.velocities = new Map(); // Velocity tracking
    this.lastUpdateTime = Date.now();
    this.fps = 60;

    // Joint connections for skeleton
    this.jointConnections = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4], // Thumb
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8], // Index
      [0, 9],
      [9, 10],
      [10, 11],
      [11, 12], // Middle
      [0, 13],
      [13, 14],
      [14, 15],
      [15, 16], // Ring
      [0, 17],
      [17, 18],
      [18, 19],
      [19, 20], // Pinky
      [5, 9],
      [9, 13],
      [13, 17], // Palm connections
    ];

    // Special joints that get accent color
    this.accentJoints = [4, 8, 12, 16, 20]; // Fingertips

    // Materials cache
    this.materials = {};
    this._initMaterials();
  }

  /**
   * Initialize materials for joints and lines
   */
  _initMaterials() {
    // Joint material with glow
    this.materials.joint = new THREE.MeshBasicMaterial({
      color: this.config.colors.primary,
      transparent: true,
      opacity: 0.9,
    });

    // Glow effect material (larger, more transparent)
    this.materials.jointGlow = new THREE.MeshBasicMaterial({
      color: this.config.colors.primary,
      transparent: true,
      opacity: 0.4,
    });

    // Accent material for fingertips
    this.materials.accent = new THREE.MeshBasicMaterial({
      color: this.config.colors.accent,
      transparent: true,
      opacity: 1.0,
    });

    // Accent glow
    this.materials.accentGlow = new THREE.MeshBasicMaterial({
      color: this.config.colors.accent,
      transparent: true,
      opacity: 0.5,
    });

    // Skeleton line material
    this.materials.skeleton = new THREE.LineBasicMaterial({
      color: this.config.colors.primary,
      transparent: true,
      opacity: 0.7,
      linewidth: 2,
    });

    // Velocity arrow material
    this.materials.velocity = new THREE.LineBasicMaterial({
      color: this.config.colors.velocity,
      transparent: true,
      opacity: 0.8,
    });
  }

  /**
   * Process new MediaPipe landmarks and update 3D visualization
   * @param {Array} landmarksArray - Array of hand landmark arrays from MediaPipe
   */
  update(landmarksArray) {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;

    // Calculate FPS
    if (deltaTime > 0) {
      this.fps = this.fps * 0.9 + (1 / deltaTime) * 0.1;
    }

    // Clear previous hand meshes if no hands detected
    if (!landmarksArray || landmarksArray.length === 0) {
      this.clearAllHands();
      return;
    }

    // Process each hand
    landmarksArray.forEach((landmarks, handIndex) => {
      const handId = `hand_${handIndex}`;
      this._updateHand(handId, landmarks, handIndex, deltaTime);
    });

    // Remove hands that no longer exist
    for (const handId of this.hands.keys()) {
      const handIndex = parseInt(handId.split("_")[1]);
      if (handIndex >= landmarksArray.length) {
        this._removeHand(handId);
      }
    }
  }

  /**
   * Update a single hand's visualization
   * @private
   */
  _updateHand(handId, landmarks, handIndex, deltaTime) {
    // Get or create hand group
    let handGroup = this.hands.get(handId);
    if (!handGroup) {
      handGroup = this._createHandMesh(handId);
      this.hands.set(handId, handGroup);
      this.scene.add(handGroup);
    }

    // Get previous landmarks for smoothing
    const prevLandmarks = this.prevLandmarks.get(handId) || landmarks;
    const velocity = this.velocities.get(handId) || new THREE.Vector3();

    // Update each joint with smoothing
    landmarks.forEach((lm, lmIndex) => {
      const jointMesh = handGroup.joints[lmIndex];
      const glowMesh = handGroup.glows[lmIndex];

      if (!jointMesh) return;

      // Calculate target position (mirror X for camera)
      const targetX = -(lm.x - 0.5) * 5;
      const targetY = -(lm.y - 0.5) * 5;
      const targetZ = lm.z * 2 + 1;

      // Apply lerp smoothing
      const smoothing = this.config.smoothingFactor;
      jointMesh.position.x += (targetX - jointMesh.position.x) * smoothing;
      jointMesh.position.y += (targetY - jointMesh.position.y) * smoothing;
      jointMesh.position.z += (targetZ - jointMesh.position.z) * smoothing;

      // Update glow position
      if (glowMesh) {
        glowMesh.position.copy(jointMesh.position);
      }

      // Calculate velocity
      if (deltaTime > 0) {
        const dx = jointMesh.position.x - prevLandmarks[lmIndex].worldX;
        const dy = jointMesh.position.y - prevLandmarks[lmIndex].worldY;
        const dz = jointMesh.position.z - prevLandmarks[lmIndex].worldZ;

        velocity.x = velocity.x * 0.7 + (dx / deltaTime) * 0.3;
        velocity.y = velocity.y * 0.7 + (dy / deltaTime) * 0.3;
        velocity.z = velocity.z * 0.7 + (dz / deltaTime) * 0.3;
      }

      // Store world position for next frame
      landmarks[lmIndex].worldX = jointMesh.position.x;
      landmarks[lmIndex].worldY = jointMesh.position.y;
      landmarks[lmIndex].worldZ = jointMesh.position.z;
    });

    // Update skeleton lines
    if (this.config.showSkeleton && handGroup.lines) {
      this._updateSkeletonLines(handGroup, landmarks);
    }

    // Update velocity visualization
    if (this.config.showVelocity && handGroup.velocityArrow) {
      this._updateVelocityArrow(handGroup, velocity);
    }

    // Store state for next frame
    this.prevLandmarks.set(
      handId,
      landmarks.map((lm) => ({ ...lm }))
    );
    this.velocities.set(handId, velocity.clone());
  }

  /**
   * Create 3D meshes for a hand
   * @private
   */
  _createHandMesh(handId) {
    const handGroup = new THREE.Group();
    handGroup.name = handId;
    handGroup.joints = [];
    handGroup.glows = [];
    handGroup.lines = null;
    handGroup.velocityArrow = null;

    // Create joints (21 total)
    for (let i = 0; i < 21; i++) {
      const isAccent = this.accentJoints.includes(i);

      // Main joint sphere
      const jointGeometry = new THREE.SphereGeometry(this.config.jointSize, 16, 16);
      const jointMaterial = isAccent ? this.materials.accent.clone() : this.materials.joint.clone();
      const joint = new THREE.Mesh(jointGeometry, jointMaterial);
      joint.visible = true;

      // Glow sphere (larger, more transparent)
      const glowGeometry = new THREE.SphereGeometry(this.config.jointGlowSize, 16, 16);
      const glowMaterial = isAccent ? this.materials.accentGlow.clone() : this.materials.jointGlow.clone();
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.visible = true;

      handGroup.add(joint);
      handGroup.add(glow);
      handGroup.joints.push(joint);
      handGroup.glows.push(glow);
    }

    // Create skeleton lines
    if (this.config.showSkeleton) {
      const lineGeometry = new THREE.BufferGeometry();
      const linePositions = new Float32Array(this.jointConnections.length * 2 * 3);
      lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));

      const skeleton = new THREE.LineSegments(lineGeometry, this.materials.skeleton.clone());
      skeleton.visible = true;

      handGroup.add(skeleton);
      handGroup.lines = skeleton;
    }

    // Create velocity arrow
    if (this.config.showVelocity) {
      const arrowGroup = this._createVelocityArrow();
      handGroup.add(arrowGroup);
      handGroup.velocityArrow = arrowGroup;
    }

    return handGroup;
  }

  /**
   * Create velocity arrow visualization
   * @private
   */
  _createVelocityArrow() {
    const arrowGroup = new THREE.Group();

    // Arrow shaft
    const shaftGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.1, 8);
    const shaftMaterial = this.materials.velocity.clone();
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.05;

    // Arrow head
    const headGeometry = new THREE.ConeGeometry(0.025, 0.05, 8);
    const headMaterial = this.materials.velocity.clone();
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.rotation.x = Math.PI / 2;
    head.position.z = 0.15;

    arrowGroup.add(shaft);
    arrowGroup.add(head);
    arrowGroup.visible = false;

    return arrowGroup;
  }

  /**
   * Update skeleton line positions based on joint positions
   * @private
   */
  _updateSkeletonLines(handGroup, landmarks) {
    if (!handGroup.lines) return;

    const positions = handGroup.lines.geometry.attributes.position.array;
    const joints = handGroup.joints;

    this.jointConnections.forEach(([start, end], i) => {
      const startJoint = joints[start];
      const endJoint = joints[end];

      positions[i * 6] = startJoint.position.x;
      positions[i * 6 + 1] = startJoint.position.y;
      positions[i * 6 + 2] = startJoint.position.z;
      positions[i * 6 + 3] = endJoint.position.x;
      positions[i * 6 + 4] = endJoint.position.y;
      positions[i * 6 + 5] = endJoint.position.z;
    });

    handGroup.lines.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Update velocity arrow visualization
   * @private
   */
  _updateVelocityArrow(handGroup, velocity) {
    if (!handGroup.velocityArrow) return;

    const speed = velocity.length() * this.config.velocityScale;
    const arrow = handGroup.velocityArrow;

    if (speed < 0.01) {
      arrow.visible = false;
      return;
    }

    arrow.visible = true;

    // Position at wrist (joint 0)
    const wrist = handGroup.joints[0];
    arrow.position.copy(wrist.position);

    // Point in velocity direction
    if (speed > 0) {
      const direction = velocity.clone().normalize();
      const angle = Math.atan2(direction.y, direction.x);
      arrow.rotation.z = angle - Math.PI / 2;
    }

    // Scale by speed
    const scale = Math.min(speed * 0.5, 2);
    arrow.scale.setScalar(Math.max(0.5, scale));
  }

  /**
   * Remove a hand from the scene
   * @private
   */
  _removeHand(handId) {
    const handGroup = this.hands.get(handId);
    if (handGroup) {
      // Dispose geometries and materials
      handGroup.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });

      this.scene.remove(handGroup);
      this.hands.delete(handId);
      this.prevLandmarks.delete(handId);
      this.velocities.delete(handId);
    }
  }

  /**
   * Clear all hand visualizations
   */
  clearAllHands() {
    for (const handId of this.hands.keys()) {
      this._removeHand(handId);
    }
  }

  /**
   * Get smoothed hand data for gesture recognition
   * @returns {Array} Array of smoothed landmark positions
   */
  getSmoothedLandmarks() {
    const result = [];

    for (const [handId, handGroup] of this.hands) {
      const landmarks = [];
      handGroup.joints.forEach((joint, index) => {
        landmarks.push({
          x: joint.position.x,
          y: joint.position.y,
          z: joint.position.z,
          index: index,
        });
      });
      result.push(landmarks);
    }

    return result;
  }

  /**
   * Get hand velocity for physics calculations
   * @param {number} handIndex - Index of hand (0 or 1)
   * @returns {THREE.Vector3} Velocity vector
   */
  getHandVelocity(handIndex = 0) {
    return this.velocities.get(`hand_${handIndex}`) || new THREE.Vector3();
  }

  /**
   * Get fingertip position (useful for interactions)
   * @param {number} handIndex - Hand index
   * @param {number} fingerIndex - Finger index (0=thumb, 1=index, etc.)
   * @returns {THREE.Vector3} Position
   */
  getFingerTip(handIndex = 0, fingerIndex = 1) {
    const handGroup = this.hands.get(`hand_${handIndex}`);
    if (!handGroup) return new THREE.Vector3();

    // Finger tip landmark indices
    const fingerTips = [4, 8, 12, 16, 20];
    const tipIndex = fingerTips[fingerIndex] || 8;

    return handGroup.joints[tipIndex]?.position.clone() || new THREE.Vector3();
  }

  /**
   * Update configuration at runtime
   * @param {Object} config - New configuration options
   */
  updateConfig(config) {
    Object.assign(this.config, config);
  }

  /**
   * Set visibility of skeleton lines
   * @param {boolean} visible - Show/hide skeleton
   */
  setSkeletonVisible(visible) {
    this.config.showSkeleton = visible;
    for (const [, handGroup] of this.hands) {
      if (handGroup.lines) {
        handGroup.lines.visible = visible;
      }
    }
  }

  /**
   * Set visibility of joint spheres
   * @param {boolean} visible - Show/hide joints
   */
  setJointsVisible(visible) {
    for (const [, handGroup] of this.hands) {
      handGroup.joints.forEach((joint) => (joint.visible = visible));
      handGroup.glows.forEach((glow) => (glow.visible = visible));
    }
  }

  /**
   * Dispose of all resources
   */
  dispose() {
    this.clearAllHands();

    // Dispose materials
    Object.values(this.materials).forEach((mat) => mat.dispose());
  }
}

export default HandTracker;
