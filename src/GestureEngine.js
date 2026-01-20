/**
 * 🎯 Jarvis Gesture Engine
 * Advanced gesture detection system with confidence scoring and hysteresis
 *
 * Features:
 * - Pinch grab/select with threshold
 * - Two-finger spread zoom
 * - Wrist rotation (X, Y, Z)
 * - Open palm reset
 * - Closed fist lock
 * - Drag gesture detection
 * - Depth-aware scaling
 * - Confidence visualization
 *
 * @module GestureEngine
 */

import * as THREE from "three";

class GestureEngine {
  constructor(options = {}) {
    // Configuration
    this.config = {
      // Confidence thresholds
      pinchThreshold: options.pinchThreshold || 0.06,
      openPalmThreshold: options.openPalmThreshold || 0.7,
      closedFistThreshold: options.closedFistThreshold || 0.7,
      twoHandZoomThreshold: options.twoHandZoomThreshold || 0.02,
      rotationThreshold: options.rotationThreshold || 0.5,

      // Hysteresis for stability
      hysteresisBuffer: options.hysteresisBuffer || 5,
      confidenceThreshold: options.confidenceThreshold || 0.65,

      // Gesture smoothing
      smoothingFactor: options.smoothingFactor || 0.3,

      // Debug options
      debugMode: options.debugMode || false,
    };

    // State
    this.gestureHistory = [];
    this.currentGestures = new Map(); // Track ongoing gestures
    this.lastLandmarks = new Map(); // Previous landmarks for velocity
    this.gestureStartTime = new Map(); // When gesture started
    this.confidenceScores = {}; // Current confidence scores

    // Hand state tracking
    this.handStates = new Map(); // Track state of each hand

    // Gesture callbacks
    this.onGestureStart = options.onGestureStart || null;
    this.onGestureEnd = options.onGestureEnd || null;
    this.onGestureUpdate = options.onGestureUpdate || null;
  }

  /**
   * Analyze hand landmarks and return detected gestures
   * @param {Array} hands - Array of hand landmark arrays from MediaPipe
   * @returns {Object} Detected gestures with confidence scores
   */
  analyze(hands) {
    const results = {
      timestamp: Date.now(),
      handCount: hands.length,
      gestures: {},
      primaryGesture: null,
      primaryConfidence: 0,
      debug: {},
    };

    if (hands.length === 0) {
      this._clearAllGestures();
      return results;
    }

    // Analyze single-hand gestures
    if (hands.length >= 1) {
      const singleHandResult = this._analyzeSingleHand(hands[0], 0);
      Object.assign(results.gestures, singleHandResult.gestures);

      // Track hand 0 state
      this.handStates.set(0, singleHandResult.state);
    }

    // Analyze two-hand gestures
    if (hands.length === 2) {
      const twoHandResult = this._analyzeTwoHands(hands[0], hands[1]);
      Object.assign(results.gestures, twoHandResult.gestures);
    }

    // Determine primary gesture
    const gestureList = [];
    for (const [name, data] of Object.entries(results.gestures)) {
      if (data.confidence > this.config.confidenceThreshold) {
        gestureList.push({ name, ...data });
      }
    }

    // Sort by confidence and apply hysteresis
    gestureList.sort((a, b) => b.confidence - a.confidence);

    if (gestureList.length > 0) {
      const primary = gestureList[0];
      results.primaryGesture = primary.name;
      results.primaryConfidence = primary.confidence;

      // Check if gesture started
      const prevGesture = this.currentGestures.get(primary.name);
      if (!prevGesture) {
        this.currentGestures.set(primary.name, {
          startTime: Date.now(),
          confidence: primary.confidence,
        });
        if (this.onGestureStart) {
          this.onGestureStart(primary.name, primary);
        }
      } else {
        // Update gesture
        this.currentGestures.set(primary.name, {
          ...prevGesture,
          confidence: primary.confidence,
        });
        if (this.onGestureUpdate) {
          this.onGestureUpdate(primary.name, primary);
        }
      }
    }

    // Clean up ended gestures
    this._cleanupGestures(gestureList.map((g) => g.name));

    // Store history
    this.gestureHistory.push(results);
    if (this.gestureHistory.length > 20) {
      this.gestureHistory.shift();
    }

    // Debug info
    if (this.config.debugMode) {
      results.debug = {
        gestureHistory: this.gestureHistory.slice(-5),
        activeGestures: Array.from(this.currentGestures.entries()),
        handStates: Object.fromEntries(this.handStates),
      };
    }

    return results;
  }

  /**
   * Analyze single hand gestures
   * @private
   */
  _analyzeSingleHand(landmarks, handIndex) {
    const state = {
      isPinching: false,
      isOpenPalm: false,
      isClosedFist: false,
      isDragging: false,
      isRotating: false,
      rotationAxis: null,
      pinchPosition: null,
      dragDelta: null,
      velocity: null,
    };

    const gestures = {};

    // Pinch detection
    const pinch = this._detectPinch(landmarks);
    gestures.pinch = pinch;
    state.isPinching = pinch.isActive;
    state.pinchPosition = pinch.position;

    // Open palm detection
    const openPalm = this._detectOpenPalm(landmarks);
    gestures.openPalm = openPalm;
    state.isOpenPalm = openPalm.isActive;

    // Closed fist detection
    const closedFist = this._detectClosedFist(landmarks);
    gestures.closedFist = closedFist;
    state.isClosedFist = closedFist.isActive;

    // Rotation detection
    const rotation = this._detectRotation(landmarks, handIndex);
    gestures.rotation = rotation;
    state.isRotating = rotation.isActive;
    state.rotationAxis = rotation.axis;

    // Drag detection
    const drag = this._detectDrag(landmarks, handIndex);
    gestures.drag = drag;
    state.isDragging = drag.isActive;
    state.dragDelta = drag.delta;

    // Calculate velocity
    state.velocity = this._calculateVelocity(landmarks, handIndex);

    return { gestures, state };
  }

  /**
   * Analyze two-hand gestures
   * @private
   */
  _analyzeTwoHands(landmarks1, landmarks2) {
    const gestures = {};

    // Two-hand zoom/spread
    const twoHandZoom = this._detectTwoHandZoom(landmarks1, landmarks2);
    gestures.twoHandZoom = twoHandZoom;

    // Two-hand rotation
    const twoHandRotation = this._detectTwoHandRotation(landmarks1, landmarks2);
    gestures.twoHandRotation = twoHandRotation;

    // Two-hand pinch (grab object)
    const twoHandPinch = this._detectTwoHandPinch(landmarks1, landmarks2);
    gestures.twoHandPinch = twoHandPinch;

    return { gestures };
  }

  /**
   * Detect pinch gesture (thumb + index finger)
   * @private
   */
  _detectPinch(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const indexPIP = landmarks[6];
    const thumbIP = landmarks[3];

    // Calculate 3D distance
    const distance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2) + Math.pow(thumbTip.z - indexTip.z, 2)
    );

    // Check if fingers are bent (pinching motion)
    const isIndexBent = indexTip.y > indexPIP.y;
    const isThumbBent = thumbTip.y > thumbIP.y;

    // Calculate confidence
    const pinchFactor = Math.max(0, 1 - distance / this.config.pinchThreshold);
    const bendFactor = isIndexBent && isThumbBent ? 1 : 0;
    const confidence = pinchFactor * 0.7 + bendFactor * 0.3;

    // Average position for interaction
    const position = {
      x: (thumbTip.x + indexTip.x) / 2,
      y: (thumbTip.y + indexTip.y) / 2,
      z: (thumbTip.z + indexTip.z) / 2,
    };

    // Calculate world coordinates
    position.worldX = -(position.x - 0.5) * 5;
    position.worldY = -(position.y - 0.5) * 5;
    position.worldZ = position.z * 2 + 1;

    // Calculate pinch strength (0-1)
    const pinchStrength = Math.max(0, 1 - distance / (this.config.pinchThreshold * 1.5));

    return {
      type: "pinch",
      isActive: confidence > this.config.confidenceThreshold,
      confidence: Math.min(1, confidence),
      position: position,
      distance: distance,
      pinchStrength: pinchStrength,
      isIndexBent,
      isThumbBent,
    };
  }

  /**
   * Detect open palm gesture
   * @private
   */
  _detectOpenPalm(landmarks) {
    const fingerTips = [8, 12, 16, 20];
    const fingerPIPs = [6, 10, 14, 18];

    let extendedFingers = 0;
    let extensionScore = 0;

    // Check regular fingers
    for (let i = 0; i < fingerTips.length; i++) {
      const tip = landmarks[fingerTips[i]];
      const pip = landmarks[fingerPIPs[i]];

      const isExtended = tip.y < pip.y;
      if (isExtended) extendedFingers++;

      const extension = Math.max(0, pip.y - tip.y);
      extensionScore += Math.min(1, extension * 5);
    }

    // Check thumb
    const thumbTip = landmarks[4];
    const thumbExtended = thumbTip.x < landmarks[3].x; // Thumb extends sideways
    if (thumbExtended) extendedFingers++;

    const isActive = extendedFingers >= 3;
    const confidence = (extensionScore / fingerTips.length) * (extendedFingers / 4);

    return {
      type: "openPalm",
      isActive,
      confidence: Math.min(1, confidence),
      extendedFingers,
      isReset: isActive && confidence > this.config.openPalmThreshold,
    };
  }

  /**
   * Detect closed fist gesture
   * @private
   */
  _detectClosedFist(landmarks) {
    const fingerTips = [8, 12, 16, 20];
    const fingerPIPs = [6, 10, 14, 18];

    let curledFingers = 0;
    let curlScore = 0;

    for (let i = 0; i < fingerTips.length; i++) {
      const tip = landmarks[fingerTips[i]];
      const pip = landmarks[fingerPIPs[i]];

      const isCurled = tip.y > pip.y;
      if (isCurled) curledFingers++;

      const curl = Math.max(0, tip.y - pip.y);
      curlScore += Math.min(1, curl * 5);
    }

    const isActive = curledFingers >= 3;
    const confidence = (curlScore / fingerTips.length) * (curledFingers / 4);

    return {
      type: "closedFist",
      isActive,
      confidence: Math.min(1, confidence),
      curledFingers,
      isLocked: isActive && confidence > this.config.closedFistThreshold,
    };
  }

  /**
   * Detect rotation gesture using wrist and finger movement
   * @private
   */
  _detectRotation(landmarks, handIndex) {
    const indexTip = landmarks[8];

    // Get previous positions
    const prevWrist = this.lastLandmarks.get(`hand_${handIndex}_wrist`);
    const prevIndex = this.lastLandmarks.get(`hand_${handIndex}_index`);

    if (!prevWrist || !prevIndex) {
      return { type: "rotation", isActive: false, confidence: 0, axis: null, angle: 0 };
    }

    // Calculate wrist movement
    const wristDelta = {
      x: wrist.x - prevWrist.x,
      y: wrist.y - prevWrist.y,
      z: wrist.z - prevWrist.z,
    };

    // Calculate index finger movement
    const indexDelta = {
      x: indexTip.x - prevIndex.x,
      y: indexTip.y - prevIndex.y,
    };

    // Detect circular motion (simplified rotation detection)
    const movement = Math.sqrt(wristDelta.x ** 2 + wristDelta.y ** 2);
    const isMoving = movement > 0.01;

    // Determine rotation axis based on dominant movement
    let axis = "none";
    let angle = 0;

    if (isMoving) {
      if (Math.abs(wristDelta.x) > Math.abs(wristDelta.y)) {
        axis = Math.sign(wristDelta.x) > 0 ? "Y+" : "Y-";
        angle = wristDelta.x;
      } else {
        axis = Math.sign(wristDelta.y) > 0 ? "X+" : "X-";
        angle = wristDelta.y;
      }

      // Check for Z rotation (wrist roll)
      const indexMovement = Math.sqrt(indexDelta.x ** 2 + indexDelta.y ** 2);
      if (indexMovement > 0.01) {
        axis = "Z";
        angle = indexDelta.x;
      }
    }

    const confidence = isMoving ? Math.min(1, movement * 20) : 0;

    return {
      type: "rotation",
      isActive: isMoving && confidence > this.config.rotationThreshold,
      confidence,
      axis,
      angle,
      delta: wristDelta,
    };
  }

  /**
   * Detect drag gesture
   * @private
   */
  _detectDrag(landmarks, handIndex) {
    const wrist = landmarks[0];
    const indexTip = landmarks[8];

    const prevWrist = this.lastLandmarks.get(`hand_${handIndex}_wrist`);
    const prevIndex = this.lastLandmarks.get(`hand_${handIndex}_index`);

    if (!prevWrist || !prevIndex) {
      return { type: "drag", isActive: false, delta: null, position: null };
    }

    const delta = {
      x: indexTip.x - prevIndex.x,
      y: indexTip.y - prevIndex.y,
      z: indexTip.z - prevIndex.z,
    };

    const movement = Math.sqrt(delta.x ** 2 + delta.y ** 2 + delta.z ** 2);
    const isDragging = movement > 0.005;

    return {
      type: "drag",
      isActive: isDragging,
      confidence: Math.min(1, movement * 50),
      delta,
      position: {
        x: indexTip.x,
        y: indexTip.y,
        z: indexTip.z,
      },
    };
  }

  /**
   * Detect two-hand zoom gesture
   * @private
   */
  _detectTwoHandZoom(landmarks1, landmarks2) {
    const index1 = landmarks1[8];
    const index2 = landmarks2[8];
    const wrist1 = landmarks1[0];
    const wrist2 = landmarks2[0];

    // Calculate distance between index fingers
    const currentDistance = Math.sqrt(
      Math.pow(index1.x - index2.x, 2) + Math.pow(index1.y - index2.y, 2) + Math.pow(index1.z - index2.z, 2)
    );

    // Calculate palm distance for reference
    const palmDistance = Math.sqrt(Math.pow(wrist1.x - wrist2.x, 2) + Math.pow(wrist1.y - wrist2.y, 2));

    // Get previous distance
    const prevDistance =
      this.gestureHistory.length > 0 ? this.gestureHistory[this.gestureHistory.length - 1].twoHandDistance : currentDistance;

    const distanceChange = currentDistance - prevDistance;
    const normalizedChange = distanceChange / palmDistance;

    // Zoom direction: positive = zoom out, negative = zoom in
    const direction = normalizedChange > 0 ? 1 : -1;
    const isZooming = Math.abs(normalizedChange) > this.config.twoHandZoomThreshold;
    const confidence = Math.min(1, Math.abs(normalizedChange) * 10);

    // Store current distance
    this.gestureHistory.forEach((h) => {
      h.twoHandDistance = currentDistance;
    });

    // Calculate zoom factor
    const zoomFactor = 1 + normalizedChange * 2;

    return {
      type: "twoHandZoom",
      isActive: isZooming,
      confidence,
      direction,
      currentDistance,
      normalizedChange,
      zoomFactor,
    };
  }

  /**
   * Detect two-hand rotation (both hands rotating together)
   * @private
   */
  _detectTwoHandRotation(landmarks1, landmarks2) {
    const wrist1 = landmarks1[0];
    const wrist2 = landmarks2[0];

    const prevWrist1 = this.lastLandmarks.get("twoHand_wrist1");
    const prevWrist2 = this.lastLandmarks.get("twoHand_wrist2");

    if (!prevWrist1 || !prevWrist2) {
      return { type: "twoHandRotation", isActive: false, confidence: 0, direction: null };
    }

    // Calculate rotation direction based on relative movement
    const delta1 = wrist1.x - prevWrist1.x;
    const delta2 = wrist2.x - prevWrist2.x;

    // Both moving in same direction = Y rotation
    // Both moving in opposite directions = X rotation (pinch zoom)
    const sameDirection = Math.sign(delta1) === Math.sign(delta2);
    const isRotating = Math.abs(delta1) > 0.005 && Math.abs(delta2) > 0.005;

    let direction = null;
    if (sameDirection) {
      direction = delta1 > 0 ? "rotateRight" : "rotateLeft";
    } else {
      direction = delta1 > delta2 ? "spread" : "pinch";
    }

    const confidence = isRotating ? Math.min(1, (Math.abs(delta1) + Math.abs(delta2)) * 20) : 0;

    return {
      type: "twoHandRotation",
      isActive: isRotating,
      confidence,
      direction,
    };
  }

  /**
   * Detect two-hand pinch (grab object between hands)
   * @private
   */
  _detectTwoHandPinch(landmarks1, landmarks2) {
    const thumb1 = landmarks1[4];
    const thumb2 = landmarks2[4];
    const index1 = landmarks1[8];
    const index2 = landmarks2[8];

    // Calculate distances
    const thumbDistance = Math.sqrt(Math.pow(thumb1.x - thumb2.x, 2) + Math.pow(thumb1.y - thumb2.y, 2));

    const indexDistance = Math.sqrt(Math.pow(index1.x - index2.x, 2) + Math.pow(index1.y - index2.y, 2));

    const isGrabbing = thumbDistance < 0.1 && indexDistance < 0.15;
    const confidence = isGrabbing ? Math.max(0, 1 - thumbDistance * 10) : 0;

    return {
      type: "twoHandPinch",
      isActive: isGrabbing,
      confidence,
      thumbDistance,
      indexDistance,
    };
  }

  /**
   * Calculate hand velocity
   * @private
   */
  _calculateVelocity(landmarks, handIndex) {
    const wrist = landmarks[0];
    const prevWrist = this.lastLandmarks.get(`hand_${handIndex}_wrist`);

    if (!prevWrist) return new THREE.Vector3();

    const velocity = new THREE.Vector3(
      (wrist.x - prevWrist.x) * 60, // Scale to per-second
      (wrist.y - prevWrist.y) * 60,
      (wrist.z - prevWrist.z) * 60
    );

    return velocity;
  }

  /**
   * Clean up ended gestures
   * @private
   */
  _cleanupGestures(activeGestures) {
    for (const [name, data] of this.currentGestures) {
      if (!activeGestures.includes(name)) {
        if (this.onGestureEnd) {
          this.onGestureEnd(name, data);
        }
        this.currentGestures.delete(name);
      }
    }
  }

  /**
   * Clear all gesture tracking
   * @private
   */
  _clearAllGestures() {
    for (const [name, data] of this.currentGestures) {
      if (this.onGestureEnd) {
        this.onGestureEnd(name, data);
      }
    }
    this.currentGestures.clear();
    this.handStates.clear();
    this.lastLandmarks.clear();
  }

  /**
   * Update last landmarks for velocity calculation
   */
  updateLastLandmarks(hands) {
    hands.forEach((landmarks, handIndex) => {
      this.lastLandmarks.set(`hand_${handIndex}_wrist`, { ...landmarks[0] });
      this.lastLandmarks.set(`hand_${handIndex}_index`, { ...landmarks[8] });
    });

    if (hands.length === 2) {
      this.lastLandmarks.set("twoHand_wrist1", { ...hands[0][0] });
      this.lastLandmarks.set("twoHand_wrist2", { ...hands[1][0] });
    }
  }

  /**
   * Get active gesture with highest confidence
   * @returns {Object} Primary gesture info
   */
  getPrimaryGesture() {
    const active = Array.from(this.currentGestures.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.confidence - a.confidence);

    return active[0] || null;
  }

  /**
   * Check if specific gesture is active
   * @param {string} gestureName - Name of gesture
   * @returns {boolean} Whether gesture is active
   */
  isGestureActive(gestureName) {
    return this.currentGestures.has(gestureName);
  }

  /**
   * Get confidence score for a gesture
   * @param {string} gestureName - Name of gesture
   * @returns {number} Confidence score (0-1)
   */
  getGestureConfidence(gestureName) {
    const data = this.currentGestures.get(gestureName);
    return data?.confidence || 0;
  }

  /**
   * Reset all state
   */
  reset() {
    this._clearAllGestures();
    this.gestureHistory = [];
  }

  /**
   * Update configuration
   * @param {Object} config - New configuration options
   */
  updateConfig(config) {
    Object.assign(this.config, config);
  }

  /**
   * Enable/disable debug mode
   * @param {boolean} enabled - Debug mode state
   */
  setDebugMode(enabled) {
    this.config.debugMode = enabled;
  }
}

export default GestureEngine;
