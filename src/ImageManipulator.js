/**
 * Image Manipulator for Jarvis Air Brush 3D
 * Handles 3D image loading, manipulation, and interaction
 */

import * as THREE from "three";

class ImageManipulator {
  constructor(scene) {
    this.scene = scene;
    this.imageObject = null;
    this.controls = {
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
    };
    this.isDragging = false;
    this.dragStart = new THREE.Vector3();
    this.objectStart = new THREE.Vector3();
  }

  /**
   * Load image as 3D plane
   * @param {string} imageUrl - URL of the image to load
   * @returns {Promise} Promise that resolves when image is loaded
   */
  loadImage(imageUrl) {
    return new Promise((resolve, reject) => {
      // Remove existing image
      this.removeImage();

      const loader = new THREE.TextureLoader();
      loader.load(
        imageUrl,
        (texture) => {
          // Create plane geometry with aspect ratio
          const aspectRatio = texture.image.width / texture.image.height;
          const geometry = new THREE.PlaneGeometry(3 * aspectRatio, 3);

          // Create material with the texture
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
          });

          // Create mesh
          this.imageObject = new THREE.Mesh(geometry, material);
          this.imageObject.position.copy(this.controls.position);
          this.imageObject.rotation.copy(this.controls.rotation);
          this.imageObject.scale.copy(this.controls.scale);

          // Add to scene
          this.scene.add(this.imageObject);

          resolve(this.imageObject);
        },
        undefined,
        (error) => {
          console.error("Error loading image:", error);
          reject(error);
        }
      );
    });
  }

  /**
   * Load image as sprite (always faces camera)
   * @param {string} imageUrl - URL of the image to load
   * @returns {Promise} Promise that resolves when image is loaded
   */
  loadImageAsSprite(imageUrl) {
    return new Promise((resolve, reject) => {
      // Remove existing image
      this.removeImage();

      const loader = new THREE.TextureLoader();
      loader.load(
        imageUrl,
        (texture) => {
          // Create sprite material
          const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
          });

          // Create sprite
          this.imageObject = new THREE.Sprite(material);
          this.imageObject.scale.set(3, 3, 1);
          this.imageObject.position.copy(this.controls.position);

          // Add to scene
          this.scene.add(this.imageObject);

          resolve(this.imageObject);
        },
        undefined,
        (error) => {
          console.error("Error loading sprite:", error);
          reject(error);
        }
      );
    });
  }

  /**
   * Remove current image from scene
   */
  removeImage() {
    if (this.imageObject) {
      this.scene.remove(this.imageObject);
      if (this.imageObject.geometry) this.imageObject.geometry.dispose();
      if (this.imageObject.material) {
        if (this.imageObject.material.map) this.imageObject.material.map.dispose();
        this.imageObject.material.dispose();
      }
      this.imageObject = null;
    }
  }

  /**
   * Set position of the image
   * @param {Vector3} position - New position
   */
  setPosition(position) {
    this.controls.position.copy(position);
    if (this.imageObject) {
      this.imageObject.position.copy(position);
    }
  }

  /**
   * Set rotation of the image
   * @param {Euler} rotation - New rotation
   */
  setRotation(rotation) {
    this.controls.rotation.copy(rotation);
    if (this.imageObject) {
      this.imageObject.rotation.copy(rotation);
    }
  }

  /**
   * Set scale of the image
   * @param {Vector3} scale - New scale
   */
  setScale(scale) {
    this.controls.scale.copy(scale);
    if (this.imageObject) {
      this.imageObject.scale.copy(scale);
    }
  }

  /**
   * Translate image by offset
   * @param {Vector3} offset - Translation offset
   */
  translate(offset) {
    this.controls.position.add(offset);
    if (this.imageObject) {
      this.imageObject.position.add(offset);
    }
  }

  /**
   * Rotate image by offset
   * @param {Euler} offset - Rotation offset
   */
  rotate(offset) {
    this.controls.rotation.x += offset.x;
    this.controls.rotation.y += offset.y;
    this.controls.rotation.z += offset.z;
    if (this.imageObject) {
      this.imageObject.rotation.x += offset.x;
      this.imageObject.rotation.y += offset.y;
      this.imageObject.rotation.z += offset.z;
    }
  }

  /**
   * Scale image by factor
   * @param {Vector3} factor - Scale factor
   */
  scale(factor) {
    this.controls.scale.multiply(factor);
    if (this.imageObject) {
      this.imageObject.scale.multiply(factor);
    }
  }

  /**
   * Start dragging operation
   * @param {Vector3} startPosition - Initial drag position
   */
  startDrag(startPosition) {
    this.isDragging = true;
    this.dragStart.copy(startPosition);
    this.objectStart.copy(this.controls.position);
  }

  /**
   * Update drag position
   * @param {Vector3} currentPosition - Current drag position
   */
  updateDrag(currentPosition) {
    if (!this.isDragging) return;

    const offset = new THREE.Vector3().subVectors(currentPosition, this.dragStart);
    const newPosition = new THREE.Vector3().addVectors(this.objectStart, offset);

    this.setPosition(newPosition);
  }

  /**
   * End dragging operation
   */
  endDrag() {
    this.isDragging = false;
  }

  /**
   * Get current image bounds for interaction detection
   * @returns {Object} Bounds object with min/max coordinates
   */
  getBounds() {
    if (!this.imageObject) return null;

    const box = new THREE.Box3().setFromObject(this.imageObject);
    return {
      min: box.min,
      max: box.max,
      center: box.getCenter(new THREE.Vector3()),
    };
  }

  /**
   * Check if a point is within the image bounds
   * @param {Vector3} point - Point to check
   * @returns {boolean} True if point is within bounds
   */
  containsPoint(point) {
    const bounds = this.getBounds();
    if (!bounds) return false;

    return (
      point.x >= bounds.min.x &&
      point.x <= bounds.max.x &&
      point.y >= bounds.min.y &&
      point.y <= bounds.max.y &&
      point.z >= bounds.min.z &&
      point.z <= bounds.max.z
    );
  }

  /**
   * Animate image to target position/rotation/scale
   * @param {Object} target - Target transforms
   * @param {number} duration - Animation duration in ms
   */
  animateTo(target, duration = 1000) {
    if (!this.imageObject) return;

    const startPosition = this.controls.position.clone();
    const startRotation = this.controls.rotation.clone();
    const startScale = this.controls.scale.clone();

    const endPosition = target.position || startPosition;
    const endRotation = target.rotation || startRotation;
    const endScale = target.scale || startScale;

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth easing
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      // Interpolate transforms
      this.controls.position.lerpVectors(startPosition, endPosition, easeProgress);
      this.controls.rotation.x = THREE.MathUtils.lerp(startRotation.x, endRotation.x, easeProgress);
      this.controls.rotation.y = THREE.MathUtils.lerp(startRotation.y, endRotation.y, easeProgress);
      this.controls.rotation.z = THREE.MathUtils.lerp(startRotation.z, endRotation.z, easeProgress);
      this.controls.scale.lerpVectors(startScale, endScale, easeProgress);

      // Apply to object
      if (this.imageObject) {
        this.imageObject.position.copy(this.controls.position);
        this.imageObject.rotation.copy(this.controls.rotation);
        this.imageObject.scale.copy(this.controls.scale);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Reset image to default position/rotation/scale
   */
  reset() {
    this.controls.position.set(0, 0, 0);
    this.controls.rotation.set(0, 0, 0);
    this.controls.scale.set(1, 1, 1);

    if (this.imageObject) {
      this.imageObject.position.copy(this.controls.position);
      this.imageObject.rotation.copy(this.controls.rotation);
      this.imageObject.scale.copy(this.controls.scale);
    }
  }

  /**
   * Get current transform state
   * @returns {Object} Current position, rotation, and scale
   */
  getState() {
    return {
      position: this.controls.position.clone(),
      rotation: this.controls.rotation.clone(),
      scale: this.controls.scale.clone(),
    };
  }

  /**
   * Set transform state
   * @param {Object} state - State object with position, rotation, scale
   */
  setState(state) {
    if (state.position) this.setPosition(state.position);
    if (state.rotation) this.setRotation(state.rotation);
    if (state.scale) this.setScale(state.scale);
  }
}

export default ImageManipulator;
