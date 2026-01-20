/**
 * Advanced Gesture Detection System for Jarvis Air Brush 3D
 * Handles complex hand gesture recognition with confidence thresholds
 */

class GestureDetector {
  constructor() {
    this.gestureHistory = [];
    this.confidenceThreshold = 0.7;
    this.hysteresisBuffer = 3;
    this.smoothingFactor = 0.3;
  }

  /**
   * Detect pinch gesture (thumb + index finger)
   * @param {Array} landmarks - Hand landmarks array
   * @returns {Object} { isPinching: boolean, confidence: number, position: Vector3 }
   */
  detectPinch(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    // Calculate 3D distance between thumb and index tips
    const distance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2) + Math.pow(thumbTip.z - indexTip.z, 2)
    );

    // Pinch threshold (adjust based on hand size)
    const pinchThreshold = 0.08;
    const isPinching = distance < pinchThreshold;

    // Calculate confidence based on distance and finger positions
    const confidence = Math.max(0, 1 - distance / pinchThreshold);

    // Get average position for interaction
    const position = {
      x: (thumbTip.x + indexTip.x) / 2,
      y: (thumbTip.y + indexTip.y) / 2,
      z: (thumbTip.z + indexTip.z) / 2,
    };

    return { isPinching, confidence, position };
  }

  /**
   * Detect open palm gesture
   * @param {Array} landmarks - Hand landmarks array
   * @returns {Object} { isOpenPalm: boolean, confidence: number }
   */
  detectOpenPalm(landmarks) {
    // Check if fingers are extended (not curled)
    const fingerTips = [8, 12, 16, 20]; // Index, middle, ring, pinky tips
    const fingerPIPs = [6, 10, 14, 18]; // Corresponding PIP joints

    let extendedFingers = 0;
    let totalConfidence = 0;

    for (let i = 0; i < fingerTips.length; i++) {
      const tip = landmarks[fingerTips[i]];
      const pip = landmarks[fingerPIPs[i]];

      // Finger is extended if tip is above PIP joint
      const isExtended = tip.y < pip.y;
      if (isExtended) extendedFingers++;

      // Confidence based on extension amount
      const extensionAmount = Math.max(0, pip.y - tip.y);
      totalConfidence += Math.min(1, extensionAmount * 10);
    }

    const isOpenPalm = extendedFingers >= 3; // At least 3 fingers extended
    const confidence = totalConfidence / fingerTips.length;

    return { isOpenPalm, confidence };
  }

  /**
   * Detect closed fist gesture
   * @param {Array} landmarks - Hand landmarks array
   * @returns {Object} { isClosedFist: boolean, confidence: number }
   */
  detectClosedFist(landmarks) {
    // Check if fingers are curled (tips below PIP joints)
    const fingerTips = [8, 12, 16, 20];
    const fingerPIPs = [6, 10, 14, 18];

    let curledFingers = 0;
    let totalConfidence = 0;

    for (let i = 0; i < fingerTips.length; i++) {
      const tip = landmarks[fingerTips[i]];
      const pip = landmarks[fingerPIPs[i]];

      // Finger is curled if tip is below PIP joint
      const isCurled = tip.y > pip.y;
      if (isCurled) curledFingers++;

      // Confidence based on curl amount
      const curlAmount = Math.max(0, tip.y - pip.y);
      totalConfidence += Math.min(1, curlAmount * 10);
    }

    const isClosedFist = curledFingers >= 3;
    const confidence = totalConfidence / fingerTips.length;

    return { isClosedFist, confidence };
  }

  /**
   * Detect two-hand zoom gesture
   * @param {Array} hands - Array of hand landmark arrays
   * @returns {Object} { isZooming: boolean, direction: number, confidence: number }
   */
  detectTwoHandZoom(hands) {
    if (hands.length !== 2) return { isZooming: false, direction: 0, confidence: 0 };

    const hand1 = hands[0];
    const hand2 = hands[1];

    const index1 = hand1[8];
    const index2 = hand2[8];

    // Calculate distance between index fingers
    const currentDistance = Math.sqrt(Math.pow(index1.x - index2.x, 2) + Math.pow(index1.y - index2.y, 2));

    // Compare with previous distance
    if (this.gestureHistory.length > 0) {
      const prevDistance = this.gestureHistory[this.gestureHistory.length - 1].twoHandDistance || currentDistance;
      const distanceChange = currentDistance - prevDistance;

      // Minimum change threshold to avoid noise
      const minChange = 0.02;
      const isZooming = Math.abs(distanceChange) > minChange;
      const direction = distanceChange > 0 ? 1 : -1; // 1 = zoom out, -1 = zoom in
      const confidence = Math.min(1, Math.abs(distanceChange) / 0.1);

      return { isZooming, direction, confidence };
    }

    return { isZooming: false, direction: 0, confidence: 0 };
  }

  /**
   * Detect rotation gesture using wrist movement
   * @param {Array} landmarks - Hand landmarks array
   * @returns {Object} { isRotating: boolean, axis: string, angle: number, confidence: number }
   */
  detectRotation(landmarks) {
    // Track wrist position over time
    const wrist = landmarks[0];

    if (this.gestureHistory.length < 5) {
      return { isRotating: false, axis: "none", angle: 0, confidence: 0 };
    }

    // Calculate movement vectors
    const recentPositions = this.gestureHistory.slice(-5).map((h) => h.wristPosition);
    const currentPos = { x: wrist.x, y: wrist.y, z: wrist.z };

    // Simple rotation detection based on circular motion
    // This is a simplified implementation - could be enhanced with more sophisticated tracking

    const isRotating = false; // Placeholder - implement circular motion detection
    const axis = "none";
    const angle = 0;
    const confidence = 0;

    return { isRotating, axis, angle, confidence };
  }

  /**
   * Main gesture analysis function
   * @param {Array} hands - Array of hand landmark arrays
   * @returns {Object} Detected gestures with confidence scores
   */
  analyzeGestures(hands) {
    const results = {
      pinch: null,
      openPalm: null,
      closedFist: null,
      twoHandZoom: null,
      rotation: null,
      primaryGesture: null,
    };

    if (hands.length === 0) return results;

    // Single hand gestures
    if (hands.length === 1) {
      const landmarks = hands[0];

      results.pinch = this.detectPinch(landmarks);
      results.openPalm = this.detectOpenPalm(landmarks);
      results.closedFist = this.detectClosedFist(landmarks);
      results.rotation = this.detectRotation(landmarks);
    }

    // Two hand gestures
    if (hands.length === 2) {
      results.twoHandZoom = this.detectTwoHandZoom(hands);
    }

    // Determine primary gesture based on confidence
    const gestures = [
      { name: "pinch", data: results.pinch },
      { name: "openPalm", data: results.openPalm },
      { name: "closedFist", data: results.closedFist },
      { name: "twoHandZoom", data: results.twoHandZoom },
      { name: "rotation", data: results.rotation },
    ].filter((g) => g.data && g.data.confidence > this.confidenceThreshold);

    if (gestures.length > 0) {
      // Sort by confidence and pick highest
      gestures.sort((a, b) => b.data.confidence - a.data.confidence);
      results.primaryGesture = gestures[0].name;
    }

    // Update gesture history
    this.updateHistory(hands);

    return results;
  }

  /**
   * Update gesture history for motion analysis
   * @param {Array} hands - Current hand data
   */
  updateHistory(hands) {
    const historyEntry = {
      timestamp: Date.now(),
      handCount: hands.length,
    };

    if (hands.length > 0) {
      historyEntry.wristPosition = {
        x: hands[0][0].x,
        y: hands[0][0].y,
        z: hands[0][0].z,
      };
    }

    if (hands.length === 2) {
      const index1 = hands[0][8];
      const index2 = hands[1][8];
      historyEntry.twoHandDistance = Math.sqrt(Math.pow(index1.x - index2.x, 2) + Math.pow(index1.y - index2.y, 2));
    }

    this.gestureHistory.push(historyEntry);

    // Keep only recent history
    if (this.gestureHistory.length > 10) {
      this.gestureHistory.shift();
    }
  }

  /**
   * Smooth gesture values to reduce jitter
   * @param {number} currentValue - Current raw value
   * @param {number} previousValue - Previous smoothed value
   * @returns {number} Smoothed value
   */
  smoothValue(currentValue, previousValue) {
    if (previousValue === undefined) return currentValue;
    return previousValue + (currentValue - previousValue) * this.smoothingFactor;
  }

  /**
   * Reset gesture detector state
   */
  reset() {
    this.gestureHistory = [];
  }
}

export default GestureDetector;
