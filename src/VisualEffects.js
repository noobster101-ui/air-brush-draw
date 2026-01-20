/**
 * Visual Effects System for Jarvis Air Brush 3D
 * Handles post-processing effects, glows, and holographic visuals
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BloomPass } from "three/examples/jsm/postprocessing/BloomPass.js";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

class VisualEffects {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.composer = null;
    this.effects = {};
    this.enabled = true;

    this.initPostProcessing();
  }

  /**
   * Initialize post-processing pipeline
   */
  initPostProcessing() {
    // Create composer
    this.composer = new EffectComposer(this.renderer);

    // Add render pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Add bloom effect
    const bloomPass = new BloomPass(1.5, 25, 4, 256);
    this.composer.addPass(bloomPass);
    this.effects.bloom = bloomPass;

    // Add film grain effect
    const filmPass = new FilmPass(0.35, 0.025, 648, false);
    this.composer.addPass(filmPass);
    this.effects.film = filmPass;

    // Add custom holographic shader
    const holographicShader = {
      uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        intensity: { value: 0.5 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float intensity;
        varying vec2 vUv;

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);

          // Add holographic scanlines
          float scanline = sin(vUv.y * 100.0 + time * 2.0) * 0.1;
          color.rgb += scanline * intensity;

          // Add chromatic aberration
          vec2 aberration = vec2(0.002, 0.0);
          color.r = texture2D(tDiffuse, vUv + aberration).r;
          color.b = texture2D(tDiffuse, vUv - aberration).b;

          gl_FragColor = color;
        }
      `,
    };

    const holographicPass = new ShaderPass(holographicShader);
    this.composer.addPass(holographicPass);
    this.effects.holographic = holographicPass;
  }

  /**
   * Render with post-processing effects
   */
  render() {
    if (this.enabled && this.composer) {
      // Update time uniform for animated effects
      if (this.effects.holographic) {
        this.effects.holographic.uniforms.time.value = performance.now() * 0.001;
      }
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Set bloom intensity
   * @param {number} intensity - Bloom intensity (0-1)
   */
  setBloom(intensity) {
    if (this.effects.bloom) {
      this.effects.bloom.strength = intensity * 2;
    }
  }

  /**
   * Set holographic effect intensity
   * @param {number} intensity - Holographic intensity (0-1)
   */
  setHolographic(intensity) {
    if (this.effects.holographic) {
      this.effects.holographic.uniforms.intensity.value = intensity;
    }
  }

  /**
   * Enable/disable effects
   * @param {boolean} enabled - Whether effects are enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Create glowing material for objects
   * @param {number} color - Base color
   * @param {number} intensity - Glow intensity
   * @returns {MeshStandardMaterial} Glowing material
   */
  createGlowMaterial(color = 0x00ffff, intensity = 0.5) {
    return new THREE.MeshStandardMaterial({
      color: color,
      emissive: new THREE.Color(color).multiplyScalar(intensity),
      transparent: true,
      opacity: 0.9,
    });
  }

  /**
   * Add glow effect to an object
   * @param {Object3D} object - Object to add glow to
   * @param {number} color - Glow color
   * @param {number} intensity - Glow intensity
   */
  addGlow(object, color = 0x00ffff, intensity = 0.5) {
    if (!object.userData.originalMaterial) {
      object.userData.originalMaterial = object.material;
    }

    object.material = this.createGlowMaterial(color, intensity);
  }

  /**
   * Remove glow effect from object
   * @param {Object3D} object - Object to remove glow from
   */
  removeGlow(object) {
    if (object.userData.originalMaterial) {
      object.material = object.userData.originalMaterial;
      delete object.userData.originalMaterial;
    }
  }

  /**
   * Create animated grid helper with glow
   * @param {number} size - Grid size
   * @param {number} divisions - Grid divisions
   * @param {number} color1 - Primary color
   * @param {number} color2 - Secondary color
   * @returns {GridHelper} Animated grid
   */
  createAnimatedGrid(size = 20, divisions = 40, color1 = 0x00ffff, color2 = 0x002222) {
    const grid = new THREE.GridHelper(size, divisions, color1, color2);

    // Add glow material to grid lines
    grid.material = new THREE.LineBasicMaterial({
      color: color1,
      transparent: true,
      opacity: 0.6,
    });

    // Store original material for animation
    grid.userData.originalMaterial = grid.material.clone();

    return grid;
  }

  /**
   * Animate grid opacity for pulsing effect
   * @param {GridHelper} grid - Grid to animate
   */
  animateGrid(grid) {
    if (!grid || !grid.material) return;

    const time = performance.now() * 0.001;
    const pulse = (Math.sin(time * 2) + 1) * 0.5; // 0 to 1

    grid.material.opacity = 0.3 + pulse * 0.4;
  }

  /**
   * Create holographic ring effect
   * @param {Vector3} position - Ring position
   * @param {number} radius - Ring radius
   * @param {number} color - Ring color
   * @returns {Mesh} Ring mesh
   */
  createHolographicRing(position = new THREE.Vector3(), radius = 2, color = 0x00ffff) {
    const geometry = new THREE.RingGeometry(radius - 0.1, radius, 64);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });

    const ring = new THREE.Mesh(geometry, material);
    ring.position.copy(position);
    ring.rotation.x = -Math.PI / 2;

    // Add animation
    ring.userData.animate = (time) => {
      ring.rotation.z = time * 0.5;
      ring.material.opacity = 0.2 + Math.sin(time * 3) * 0.1;
    };

    return ring;
  }

  /**
   * Create energy sphere effect
   * @param {Vector3} position - Sphere position
   * @param {number} radius - Sphere radius
   * @param {number} color - Sphere color
   * @returns {Mesh} Sphere mesh
   */
  createEnergySphere(position = new THREE.Vector3(), radius = 0.5, color = 0x00ffff) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: new THREE.Color(color).multiplyScalar(0.3),
      transparent: true,
      opacity: 0.7,
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);

    // Add wireframe overlay
    const wireframeGeometry = new THREE.SphereGeometry(radius * 1.01, 16, 16);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.5,
      wireframe: true,
    });
    const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    sphere.add(wireframe);

    // Add animation
    sphere.userData.animate = (time) => {
      sphere.scale.setScalar(1 + Math.sin(time * 2) * 0.1);
      wireframe.rotation.x = time;
      wireframe.rotation.y = time * 0.7;
    };

    return sphere;
  }

  /**
   * Update all animated effects
   * @param {number} deltaTime - Time delta
   */
  update(deltaTime = 0.016) {
    const time = performance.now() * 0.001;

    // Update animated objects in scene
    this.scene.traverse((object) => {
      if (object.userData && object.userData.animate) {
        object.userData.animate(time);
      }
    });
  }

  /**
   * Dispose of all effects and resources
   */
  dispose() {
    if (this.composer) {
      this.composer.dispose();
    }

    // Dispose of custom materials
    this.scene.traverse((object) => {
      if (object.material && object.material.dispose) {
        object.material.dispose();
      }
      if (object.geometry && object.geometry.dispose) {
        object.geometry.dispose();
      }
    });
  }
}

export default VisualEffects;
