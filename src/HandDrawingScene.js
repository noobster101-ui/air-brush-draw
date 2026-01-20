import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

// Import new Open Air Brush modules
import HandTracker from "./HandTracker";
import GestureEngine from "./GestureEngine";
import PhysicsEngine from "./PhysicsEngine";
import AirBrushHUD from "./AirBrushHUD";
import ImageManipulator from "./ImageManipulator";
import VisualEffects from "./VisualEffects";

function HandDrawingScene({
  activeTool,
  selectedColor,
  brushSize,
  showGrid,
  videoOpacity,
  isRecording,
  selectedGlove = "skeleton",
  uploadedImage = null,
  onImageUpload,
}) {
  const videoRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const cubesRef = useRef([]);
  const occupiedGridRef = useRef(new Set());
  const historyRef = useRef({ undo: [], redo: [] });
  const lastSaveTimeRef = useRef(0);
  const [handDetected, setHandDetected] = useState(false);
  const [handCount, setHandCount] = useState(0);
  const [gestureStatus, setGestureStatus] = useState("Loading camera...");

  const currentColorRef = useRef(parseInt(selectedColor.replace("#", "0x"), 16));
  const currentBrushSizeRef = useRef(brushSize || 0.08); // Smaller default brush size for better detail
  const currentToolRef = useRef(activeTool);
  const handsRef = useRef(null);
  const cameraMPRef = useRef(null);
  const wasDrawingRef = useRef(false);
  const lastDrawPositionRef = useRef(null);
  const prevTwoHandDistRef = useRef(null);
  const ctxRef = useRef(null);
  const currentGloveRef = useRef(selectedGlove);

  // Transparent image control state
  const imageMeshRef = useRef(null);
  const imageTextureRef = useRef(null);

  // New advanced components
  const gestureEngineRef = useRef(null);
  const handTrackerRef = useRef(null);
  const physicsEngineRef = useRef(null);
  const airBrushHUDRef = useRef(null);
  const imageManipulatorRef = useRef(null);
  const visualEffectsRef = useRef(null);
  const lastGestureRef = useRef(null);
  const interactionModeRef = useRef("draw");
  const isPinchingRef = useRef(false);

  // Initialize Open Air Brush components on mount
  useEffect(() => {
    if (sceneRef.current && cameraRef.current) {
      // Initialize HandTracker
      handTrackerRef.current = new HandTracker(sceneRef.current, {
        smoothingFactor: 0.3,
        showSkeleton: true,
        showJoints: true,
        jointSize: 0.008, // Smaller joints for better detail
        jointGlowSize: 0.015, // Smaller glow
      });

      // Initialize GestureEngine
      gestureEngineRef.current = new GestureEngine({
        pinchThreshold: 0.06,
        openPalmThreshold: 0.7,
        twoHandZoomThreshold: 0.02,
        confidenceThreshold: 0.65,
        hysteresisBuffer: 5,
        debugMode: false,
        onGestureStart: (gesture, data) => {
          console.log(`Gesture started: ${gesture}`, data);
        },
        onGestureEnd: (gesture, data) => {
          console.log(`Gesture ended: ${gesture}`, data);
        },
      });

      // Initialize PhysicsEngine
      physicsEngineRef.current = new PhysicsEngine({
        positionDamping: 0.85,
        rotationDamping: 0.9,
        scaleDamping: 0.8,
        springStiffness: 0.15,
        springDamping: 0.8,
        enableSnap: true,
        snapGridSize: 0.1,
      });

      // Initialize AirBrushHUD
      airBrushHUDRef.current = new AirBrushHUD(sceneRef.current, cameraRef.current, {
        particleCount: 50,
        particleSize: 0.02,
        particleLifetime: 500,
        showFPS: true,
        showLandmarkIndices: false,
        showDebug: false,
      });
    }
  }, []);

  // Update refs
  useEffect(() => {
    currentColorRef.current = parseInt(selectedColor.replace("#", "0x"), 16);
    currentBrushSizeRef.current = brushSize || 0.15;
    currentToolRef.current = activeTool;
    currentGloveRef.current = selectedGlove;
  }, [selectedColor, brushSize, activeTool, selectedGlove]);

  // Handle uploaded image
  useEffect(() => {
    if (uploadedImage && imageMeshRef.current) {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin(""); // Enable CORS for external images

      // Create a loading state
      setGestureStatus("📷 Loading image with full quality...");

      loader.load(
        uploadedImage,
        (texture) => {
          imageTextureRef.current = texture;

          // Maximum quality texture settings for perfect clarity
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = rendererRef.current?.capabilities ? rendererRef.current.capabilities.getMaxAnisotropy() : 4;
          texture.generateMipmaps = true;
          texture.encoding = THREE.sRGBEncoding;

          if (imageMeshRef.current) {
            // Use high-quality material for perfect image display
            imageMeshRef.current.material = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
              opacity: 1.0, // Full opacity for perfect clarity
              side: THREE.DoubleSide,
              depthWrite: false,
              depthTest: true,
            });

            // Adjust plane size to match image aspect ratio exactly
            const imageAspect = texture.image ? texture.image.width / texture.image.height : 4 / 3;
            const maxSize = Math.min(window.innerWidth, window.innerHeight) * 0.8; // 80% of screen
            const baseSize = Math.min(maxSize, 10); // Cap at reasonable size

            imageMeshRef.current.geometry.dispose();
            imageMeshRef.current.geometry = new THREE.PlaneGeometry(baseSize, baseSize / imageAspect);

            // Position image prominently in 3D space
            imageMeshRef.current.position.set(0, 0, 1);
            imageMeshRef.current.rotation.set(0, 0, 0);
            imageMeshRef.current.scale.set(1, 1, 1);
            imageMeshRef.current.visible = true;

            // Register with physics engine for smooth animations
            if (sceneRef.current && physicsEngineRef.current) {
              physicsEngineRef.current.registerObject(imageMeshRef.current, { mass: 0 });
            }

            setGestureStatus("🖼️ Image loaded! Click 'Export to 3D' to create 3D object");
          }
        },
        undefined,
        (error) => {
          console.error("Error loading image:", error);
          setGestureStatus("❌ Failed to load image");
        }
      );
    }
  }, [uploadedImage]);

  // Create cube
  const createCube = useCallback((position, color, size) => {
    if (!sceneRef.current) return;

    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
      emissive: new THREE.Color(color).multiplyScalar(0.5),
      emissiveIntensity: 0.8,
      metalness: 0.3,
      roughness: 0.4,
    });

    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);

    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(position.x, position.y, position.z);
    cube.add(wireframe);
    cube.castShadow = true;
    cube.receiveShadow = true;

    sceneRef.current.add(cube);
    cubesRef.current.push(cube);

    const gridSize = 0.1;
    const gridKey = `${Math.round(position.x / gridSize)},${Math.round(position.y / gridSize)},${Math.round(position.z / gridSize)}`;
    occupiedGridRef.current.add(gridKey);
  }, []);

  // Save state
  const saveState = useCallback(() => {
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 500) return;
    lastSaveTimeRef.current = now;

    const state = cubesRef.current.map((cube) => ({
      position: { x: cube.position.x, y: cube.position.y, z: cube.position.z },
      color: cube.material.color.getHex(),
      size: cube.geometry.parameters.width,
    }));

    const lastState = historyRef.current.undo[historyRef.current.undo.length - 1];
    if (lastState && JSON.stringify(state) === JSON.stringify(lastState)) return;

    historyRef.current.undo.push(state);
    historyRef.current.redo = [];
    if (historyRef.current.undo.length > 100) {
      historyRef.current.undo.shift();
    }
  }, []);

  // Undo/Redo
  window.undo = useCallback(() => {
    if (historyRef.current.undo.length === 0) return;
    const previousState = historyRef.current.undo.pop();
    if (previousState && sceneRef.current) {
      cubesRef.current.forEach((cube) => sceneRef.current.remove(cube));
      cubesRef.current = [];
      occupiedGridRef.current.clear();
      previousState.forEach((data) => createCube(data.position, data.color, data.size));
    }
  }, [createCube]);

  window.redo = useCallback(() => {
    if (historyRef.current.redo.length === 0) return;
    const nextState = historyRef.current.redo.pop();
    if (nextState && sceneRef.current) {
      cubesRef.current.forEach((cube) => sceneRef.current.remove(cube));
      cubesRef.current = [];
      occupiedGridRef.current.clear();
      nextState.forEach((data) => createCube(data.position, data.color, data.size));
    }
  }, [createCube]);

  const addCube = useCallback(
    (pos, color, size) => {
      const gridSize = 0.05; // Smaller grid for better detail with smaller cubes
      const gridPos = {
        x: Math.round(pos.x / gridSize) * gridSize,
        y: Math.round(pos.y / gridSize) * gridSize,
        z: Math.round(pos.z / gridSize) * gridSize,
      };
      const gridKey = `${Math.round(gridPos.x / gridSize)},${Math.round(gridPos.y / gridSize)},${Math.round(gridPos.z / gridSize)}`;
      if (occupiedGridRef.current.has(gridKey)) return;
      createCube(gridPos, color, size);
    },
    [createCube]
  );

  const eraseCube = useCallback((pos, radius = 0.2) => {
    let erased = false;
    for (let i = cubesRef.current.length - 1; i >= 0; i--) {
      const cube = cubesRef.current[i];
      if (cube.position.distanceTo(pos) < radius) {
        const gridKey = `${Math.round(cube.position.x / 0.1)},${Math.round(cube.position.y / 0.1)},${Math.round(cube.position.z / 0.1)}`;
        occupiedGridRef.current.delete(gridKey);
        sceneRef.current.remove(cube);
        cubesRef.current.splice(i, 1);
        erased = true;
      }
    }
    return erased;
  }, []);

  // File operations
  window.saveProject = useCallback(() => {
    const data = {
      cubes: cubesRef.current.map((cube) => ({
        position: { x: cube.position.x, y: cube.position.y, z: cube.position.z },
        color: cube.material.color.getHex(),
        size: cube.geometry.parameters.width,
      })),
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `air-brush-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  window.loadProject = useCallback(
    (jsonData) => {
      try {
        const data = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
        if (!data.cubes || !Array.isArray(data.cubes)) return false;
        cubesRef.current.forEach((cube) => {
          if (sceneRef.current) sceneRef.current.remove(cube);
        });
        cubesRef.current = [];
        occupiedGridRef.current.clear();
        data.cubes.forEach((cubeData) => createCube(cubeData.position, cubeData.color, cubeData.size));
        historyRef.current.undo = [];
        historyRef.current.redo = [];
        lastSaveTimeRef.current = 0;
        saveState();
        return true;
      } catch (e) {
        return false;
      }
    },
    [createCube, saveState]
  );

  window.exportAsImage = useCallback(() => {
    if (rendererRef.current) {
      const link = document.createElement("a");
      link.download = `air-brush-${Date.now()}.png`;
      link.href = rendererRef.current.domElement.toDataURL("image/png");
      link.click();
    }
  }, []);

  window.clearScene = useCallback(() => {
    if (sceneRef.current) {
      cubesRef.current.forEach((cube) => sceneRef.current.remove(cube));
      cubesRef.current = [];
      occupiedGridRef.current.clear();
      historyRef.current.undo = [];
      historyRef.current.redo = [];
      lastSaveTimeRef.current = 0;
      saveState();
    }
  }, [saveState]);

  // Draw futuristic hand
  const drawFuturisticHand = (ctx, landmarks, gloveStyle) => {
    const connections = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [0, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      [0, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      [0, 17],
      [17, 18],
      [18, 19],
      [19, 20],
      [5, 9],
      [9, 13],
      [13, 17],
    ];

    const gloveSchemes = {
      skeleton: { line: "#00ff00", fill: "#ffffff", accent: "#00ff00" },
      iron: { line: "#ff6600", fill: "#ffaa00", accent: "#ffcc00" },
      hulk: { line: "#00ff00", fill: "#00cc00", accent: "#99ff99" },
      thanos: { line: "#ff0000", fill: "#cc0000", accent: "#ff6666" },
      cyber: { line: "#00ffff", fill: "#0088aa", accent: "#88ffff" },
      ghost: { line: "#88ff88", fill: "#aaffaa", accent: "#ccffcc" },
    };

    const scheme = gloveSchemes[gloveStyle] || gloveSchemes.skeleton;

    // Special effects
    if (gloveStyle === "iron") {
      const palmX = (1 - landmarks[0].x) * ctx.canvas.width;
      const palmY = landmarks[0].y * ctx.canvas.height;
      const gradient = ctx.createRadialGradient(palmX, palmY, 5, palmX, palmY, 40);
      gradient.addColorStop(0, "rgba(255, 170, 0, 0.8)");
      gradient.addColorStop(1, "rgba(255, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(palmX, palmY, 40, 0, Math.PI * 2);
      ctx.fill();
    } else if (gloveStyle === "cyber") {
      ctx.shadowColor = "#00ffff";
      ctx.shadowBlur = 10;
    }

    // Draw connections - thinner lines for better detail
    connections.forEach(([start, end]) => {
      const lmStart = landmarks[start];
      const lmEnd = landmarks[end];
      ctx.beginPath();
      ctx.moveTo((1 - lmStart.x) * ctx.canvas.width, lmStart.y * ctx.canvas.height);
      ctx.lineTo((1 - lmEnd.x) * ctx.canvas.width, lmEnd.y * ctx.canvas.height);
      ctx.strokeStyle = scheme.line;
      ctx.lineWidth = gloveStyle === "skeleton" ? 1.5 : 2; // Thinner lines
      ctx.lineCap = "round";
      ctx.stroke();
    });

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Draw landmarks - smaller dots
    landmarks.forEach((lm, index) => {
      const x = (1 - lm.x) * ctx.canvas.width;
      const y = lm.y * ctx.canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2); // Smaller dots (was 8)
      ctx.fillStyle = index === 8 ? scheme.accent : scheme.fill;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });
  };

  // Initialize Three.js with advanced effects
  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // Normal camera - wider FOV for full screen drawing
    const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 4);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.position = "fixed";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.zIndex = "2";
    renderer.domElement.style.pointerEvents = "none";
    document.body.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Initialize advanced components
    imageManipulatorRef.current = new ImageManipulator(scene);
    visualEffectsRef.current = new VisualEffects(renderer, scene, camera);

    // Enhanced lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 10);
    scene.add(directionalLight);

    // Point light for glow effects
    const pointLight = new THREE.PointLight(0x00ffff, 0.5, 20);
    pointLight.position.set(0, 5, 5);
    scene.add(pointLight);

    // Animated holographic grid
    const gridHelper = visualEffectsRef.current.createAnimatedGrid(15, 30, 0x00ffff, 0x002222);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -1;
    scene.add(gridHelper);
    window.gridHelper = gridHelper;

    // Add holographic rings for ambiance
    const ring1 = visualEffectsRef.current.createHolographicRing(new THREE.Vector3(0, 0, -2), 8, 0x00ffff);
    scene.add(ring1);
    const ring2 = visualEffectsRef.current.createHolographicRing(new THREE.Vector3(0, 0, -3), 12, 0x0088ff);
    scene.add(ring2);

    // Create transparent image display mesh (initially hidden)
    const imageGeometry = new THREE.PlaneGeometry(4, 3);
    const imageMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false, // Better for transparent objects
      depthTest: true,
    });
    imageMeshRef.current = new THREE.Mesh(imageGeometry, imageMaterial);
    imageMeshRef.current.position.set(0, 0, 2);
    imageMeshRef.current.visible = false;
    scene.add(imageMeshRef.current);

    // MediaPipe Hands
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    handsRef.current = hands;

    hands.onResults((results) => {
      try {
        if (!ctxRef.current) return;
        const ctx = ctxRef.current;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const numHands = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
        setHandCount(numHands);

        if (numHands === 0) {
          setHandDetected(false);
          setGestureStatus("Show your hand to camera");
          prevTwoHandDistRef.current = null;
          if (gestureEngineRef.current) gestureEngineRef.current.reset();
          if (handTrackerRef.current) handTrackerRef.current.clearAllHands();
          return;
        }

        setHandDetected(true);

        // Always show video/camera view - no Matrix overlay when hands detected
        if (videoRef.current && videoRef.current.readyState >= 2) {
          // Show video feed consistently
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, -ctx.canvas.width, 0, ctx.canvas.width, ctx.canvas.height);
          ctx.restore();
        }

        // Update HandTracker with new landmarks
        if (handTrackerRef.current) {
          handTrackerRef.current.update(results.multiHandLandmarks);
        }

        // Update GestureEngine with new landmarks
        let gestures = null;
        if (gestureEngineRef.current) {
          gestureEngineRef.current.updateLastLandmarks(results.multiHandLandmarks);
          gestures = gestureEngineRef.current.analyze(results.multiHandLandmarks);

          // Update AirBrushHUD with gesture info
          if (airBrushHUDRef.current && results.multiHandLandmarks.length > 0) {
            const primaryHand = results.multiHandLandmarks[0];
            const pinch = primaryHand && primaryHand[8] ? primaryHand[8] : null;
            if (pinch) {
              const pos = new THREE.Vector3(-(pinch.x - 0.5) * 5, -(pinch.y - 0.5) * 5, pinch.z * 2 + 1);

              if (gestures.primaryGesture && gestures.primaryConfidence) {
                airBrushHUDRef.current.updateConfidenceRing(gestures.primaryConfidence, pos, gestures.primaryGesture);

                // Add particles based on gesture
                if (gestures.primaryGesture === "pinch" && gestures.gestures.pinch) {
                  airBrushHUDRef.current.addParticle(pos, "pinch");
                } else if (gestures.primaryGesture === "openPalm") {
                  airBrushHUDRef.current.addParticle(pos, "openPalm");
                }
              } else {
                airBrushHUDRef.current.updateConfidenceRing(0, null);
              }

              // Show interaction ring when pinching
              if (gestures.gestures.pinch?.isActive) {
                airBrushHUDRef.current.showInteractionRing(pos, gestures.gestures.pinch.pinchStrength);
              } else {
                airBrushHUDRef.current.hideInteractionRing();
              }
            }
          }
        }

        // Draw hands with enhanced visuals
        results.multiHandLandmarks.forEach((landmarks, index) => {
          drawFuturisticHand(ctx, landmarks, currentGloveRef.current);

          // Add glowing dots on joints - smaller for better detail
          landmarks.forEach((lm, lmIndex) => {
            const x = (1 - lm.x) * ctx.canvas.width;
            const y = lm.y * ctx.canvas.height;

            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2); // Smaller dots (was 3)
            ctx.fillStyle = lmIndex === 8 ? "#00ffff" : "#ffffff"; // Highlight index tip
            ctx.shadowColor = "#00ffff";
            ctx.shadowBlur = 3; // Reduced glow
            ctx.fill();
            ctx.shadowBlur = 0;
          });
        });

        // Handle gesture-based interactions using new Jarvis system
        if (gestures && gestures.primaryGesture) {
          const gesture = gestures.primaryGesture;

          switch (gesture) {
            case "pinch":
              // New behavior:
              // - When pinch STARTS (finger close): stop drawing
              // - When pinch ENDS and hand MOVES: draw
              if (gestures.pinch.confidence > 0.5) {
                const drawPosition = new THREE.Vector3(
                  -(gestures.pinch.position.worldX || gestures.pinch.position.x - 0.5) * 8,
                  -(gestures.pinch.position.worldY || gestures.pinch.position.y - 0.5) * 8,
                  (gestures.pinch.position.worldZ || gestures.pinch.position.z * 1) + 0.3
                );

                // Add particle trail
                if (airBrushHUDRef.current) {
                  airBrushHUDRef.current.addParticle(drawPosition, "pinch");
                }

                if (interactionModeRef.current === "draw") {
                  // Pinch just started - stop drawing
                  if (!isPinchingRef.current) {
                    isPinchingRef.current = true;
                    wasDrawingRef.current = false;
                    lastDrawPositionRef.current = null;
                    setGestureStatus("✋ Pinch held - Move to draw");
                  }

                  // Pinch is held - don't draw, just track position
                  lastDrawPositionRef.current = drawPosition.clone();
                }
              } else {
                // Pinch released - if hand moves, start drawing
                if (isPinchingRef.current) {
                  isPinchingRef.current = false;
                  // Will start drawing on next movement
                }
              }
              break;

            case "openPalm":
              // Open palm - stop any drawing
              isPinchingRef.current = false;
              wasDrawingRef.current = false;
              lastDrawPositionRef.current = null;

              if (gestures.openPalm.confidence > 0.7) {
                if (airBrushHUDRef.current) {
                  airBrushHUDRef.current.showSuccess(new THREE.Vector3(0, 0, 0));
                }
                if (physicsEngineRef.current) {
                  physicsEngineRef.current.objects.forEach((physicsData) => {
                    if (physicsData.object.name === "manipulatedObject") {
                      physicsEngineRef.current.resetObject(physicsData.object, true, 500);
                    }
                  });
                }
                setGestureStatus("🔄 Reset with bounce effect");
              }
              break;

            case "closedFist":
              // Lock interaction mode to draw
              interactionModeRef.current = "draw";
              setGestureStatus("🔒 Interaction locked to draw");

              // Add haptic feedback if available
              if (navigator.vibrate) {
                navigator.vibrate(50);
              }
              break;

            case "twoHandZoom":
              if (gestures.twoHandZoom.confidence > 0.6 && cameraRef.current) {
                const zoomSpeed = 0.3;
                if (gestures.twoHandZoom.direction > 0) {
                  // Hands apart - zoom IN
                  cameraRef.current.position.z = Math.max(1, cameraRef.current.position.z - zoomSpeed);
                  setGestureStatus("🔍 Zoom In (spread hands)");
                } else {
                  // Hands together - zoom OUT
                  cameraRef.current.position.z = Math.min(20, cameraRef.current.position.z + zoomSpeed);
                  setGestureStatus("🔍 Zoom Out (pinch hands)");
                }

                // Also resize uploaded image if visible
                if (imageMeshRef.current?.visible) {
                  const imageScaleSpeed = 0.1;
                  if (gestures.twoHandZoom.direction > 0) {
                    // Hands apart - zoom image IN
                    const newScale = Math.min(10, imageMeshRef.current.scale.x + imageScaleSpeed);
                    imageMeshRef.current.scale.set(newScale, newScale, 1);
                    setGestureStatus("🖼️ Zooming image in...");
                  } else {
                    // Hands together - zoom image OUT
                    const newScale = Math.max(0.5, imageMeshRef.current.scale.x - imageScaleSpeed);
                    imageMeshRef.current.scale.set(newScale, newScale, 1);
                    setGestureStatus("🖼️ Zooming image out...");
                  }
                }
              }
              break;

            case "rotation":
              if (gestures.rotation.confidence > 0.5) {
                // Apply rotation with physics for smooth momentum
                const rotationAmount = gestures.rotation.angle * 0.1;

                if (physicsEngineRef.current) {
                  physicsEngineRef.current.applyRotationImpulse(sceneRef.current, new THREE.Euler(rotationAmount, 0, 0));
                }

                sceneRef.current.rotation.x += rotationAmount;
                setGestureStatus(`🔄 Rotating (${gestures.rotation.axis || "unknown"})`);

                // Also rotate uploaded image if visible
                if (imageMeshRef.current?.visible) {
                  imageMeshRef.current.rotation.z += rotationAmount;
                  setGestureStatus(`🖼️ Rotating image...`);
                }
              }
              break;

            case "drag":
              if (gestures.drag.confidence > 0.4) {
                // Handle draw-on-move when pinch was just released
                if (wasDrawingRef.current && lastDrawPositionRef.current) {
                  const distMoved = lastDrawPositionRef.current ? gestures.drag.position.distanceTo(lastDrawPositionRef.current) : 0;
                  if (distMoved > 0.008) {
                    saveState();
                    addCube(gestures.drag.position, currentColorRef.current, currentBrushSizeRef.current);
                    lastDrawPositionRef.current = gestures.drag.position.clone();
                    setGestureStatus(`✏️ Drawing... (${cubesRef.current.length} cubes)`);
                  }
                }

                // Smooth drag with velocity
                const dragDelta = gestures.drag.delta;
                if (dragDelta && cameraRef.current) {
                  cameraRef.current.position.x += dragDelta.x * 5;
                  cameraRef.current.position.y -= dragDelta.y * 5;
                  setGestureStatus("✋ Panning camera...");
                }

                // Also move uploaded image if visible
                if (imageMeshRef.current?.visible) {
                  const moveScale = 0.5;
                  imageMeshRef.current.position.x += dragDelta.x * moveScale * 5;
                  imageMeshRef.current.position.y -= dragDelta.y * moveScale * 5;
                  setGestureStatus("🖼️ Moving image...");
                }
              }
              break;
          }
        } else {
          // Legacy fallback for backwards compatibility
          if (numHands === 2) {
            // Two-hand zoom (legacy support)
            const landmarks1 = results.multiHandLandmarks[0];
            const landmarks2 = results.multiHandLandmarks[1];

            const index1 = landmarks1[8];
            const index2 = landmarks2[8];
            const twoHandDist = Math.sqrt(Math.pow(index1.x - index2.x, 2) + Math.pow(index1.y - index2.y, 2));

            if (prevTwoHandDistRef.current !== null) {
              const distChange = twoHandDist - prevTwoHandDistRef.current;
              if (Math.abs(distChange) > 0.015 && cameraRef.current) {
                if (distChange > 0) {
                  // Hands apart - zoom IN
                  cameraRef.current.position.z = Math.max(1, cameraRef.current.position.z - 0.2);
                  setGestureStatus("🔍 Zoom In (spread hands)");
                } else {
                  // Hands together - zoom OUT
                  cameraRef.current.position.z = Math.min(20, cameraRef.current.position.z + 0.2);
                  setGestureStatus("🔍 Zoom Out (pinch hands)");
                }
              }
            }
            prevTwoHandDistRef.current = twoHandDist;
          } else {
            // Single hand - legacy pinch detection
            prevTwoHandDistRef.current = null;
            const landmarks = results.multiHandLandmarks[0];

            // Pinch detection - use simpler distance-based detection
            const indexTip = landmarks[8];
            const thumbTip = landmarks[4];

            // Calculate 3D distance between thumb and index
            const pinchDist = Math.sqrt(
              Math.pow(indexTip.x - thumbTip.x, 2) + Math.pow(indexTip.y - thumbTip.y, 2) + Math.pow(indexTip.z - thumbTip.z, 2)
            );

            // Use a simple distance threshold (no finger bend requirement)
            const isPinching = pinchDist < 0.06; // Slightly relaxed threshold

            const drawPosition = new THREE.Vector3(-(indexTip.x - 0.5) * 8, -(indexTip.y - 0.5) * 8, indexTip.z * 1 + 0.3);

            if (isPinching) {
              // Add particles for visual feedback
              if (airBrushHUDRef.current) {
                airBrushHUDRef.current.addParticle(drawPosition, "pinch");
              }

              // Pinch held - stop drawing, just track position
              if (currentToolRef.current === "draw") {
                if (!isPinchingRef.current) {
                  isPinchingRef.current = true;
                  wasDrawingRef.current = false;
                  lastDrawPositionRef.current = null;
                  setGestureStatus("✋ Pinch held - Move to draw");
                }
                lastDrawPositionRef.current = drawPosition.clone();
              } else {
                // Erase mode
                const distMoved = lastDrawPositionRef.current ? drawPosition.distanceTo(lastDrawPositionRef.current) : 999;
                if (distMoved > 0.01) {
                  if (!wasDrawingRef.current) saveState();
                  eraseCube(drawPosition, 0.2);
                  lastDrawPositionRef.current = drawPosition.clone();
                  wasDrawingRef.current = true;
                  setGestureStatus("🧽 Erasing...");
                }
              }
            } else {
              // Pinch released - if moving, draw
              if (isPinchingRef.current) {
                isPinchingRef.current = false;
                wasDrawingRef.current = true; // Enable drawing on move
                if (currentToolRef.current === "draw") {
                  setGestureStatus("✋ Release - Move hand to draw");
                }
              }

              // If not pinching and wasDrawing is enabled, check for movement-based drawing
              if (wasDrawingRef.current && currentToolRef.current === "draw") {
                const distMoved = lastDrawPositionRef.current ? drawPosition.distanceTo(lastDrawPositionRef.current) : 0;
                if (distMoved > 0.008) {
                  if (!wasDrawingRef.current) saveState();
                  addCube(drawPosition, currentColorRef.current, currentBrushSizeRef.current);
                  lastDrawPositionRef.current = drawPosition.clone();
                  setGestureStatus(`✏️ Drawing... (${cubesRef.current.length} cubes)`);
                }
              }

              lastDrawPositionRef.current = drawPosition.clone();

              // End physics drag
              if (physicsEngineRef.current) {
                physicsEngineRef.current.objects.forEach((physicsData) => {
                  if (physicsData.isDragging) {
                    physicsEngineRef.current.endDrag(physicsData.object);
                  }
                });
              }

              setGestureStatus(currentToolRef.current === "draw" ? "✋ Pinch & release, then move to draw" : "✋ Pinch to erase");
            }
          }
        }

        // Update last gesture for hysteresis
        lastGestureRef.current = gestures?.primaryGesture;
      } catch (error) {
        console.error("Error in hand tracking results:", error);
        setGestureStatus("❌ Hand tracking error - check console");
      }
    });

    // Start camera
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.style.display = "block";
          videoRef.current.style.visibility = "visible";

          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            const cameraMP = new Camera(videoRef.current, {
              onFrame: async () => {
                if (videoRef.current && videoRef.current.readyState >= 2 && handsRef.current) {
                  try {
                    await handsRef.current.send({ image: videoRef.current });
                  } catch (e) {}
                }
              },
              width: 640,
              height: 480,
            });
            cameraMPRef.current = cameraMP;
            cameraMP.start();
          };
        }
      } catch (error) {
        console.error("Camera error:", error);
        setHandDetected(false);
      }
    };

    startCamera();

    // Animation with visual effects and Jarvis components
    const animate = () => {
      requestAnimationFrame(animate);

      const deltaTime = 0.016; // Approximate 60fps delta

      // Update physics engine
      if (physicsEngineRef.current) {
        physicsEngineRef.current.update(deltaTime);
      }

      // Update AirBrushHUD
      if (airBrushHUDRef.current) {
        airBrushHUDRef.current.update(deltaTime);
      }

      // Update HandTracker
      if (handTrackerRef.current) {
        handTrackerRef.current.update([]);
      }

      // Update visual effects
      if (visualEffectsRef.current) {
        visualEffectsRef.current.update();
        if (window.gridHelper) {
          visualEffectsRef.current.animateGrid(window.gridHelper);
          // Always show grid as background
          window.gridHelper.visible = true;
        }

        // Keep visual effects consistent regardless of hand detection
        visualEffectsRef.current.setBloom(1.0);
        visualEffectsRef.current.setHolographic(0.5);
      }

      // Render with post-processing
      if (visualEffectsRef.current) {
        visualEffectsRef.current.render();
      } else if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Resize
    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    saveState();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (cameraMPRef.current) cameraMPRef.current.stop();

      // Dispose Open Air Brush modules
      if (handTrackerRef.current) handTrackerRef.current.dispose();
      if (physicsEngineRef.current) physicsEngineRef.current.dispose();
      if (airBrushHUDRef.current) airBrushHUDRef.current.dispose();
      if (visualEffectsRef.current) visualEffectsRef.current.dispose();

      if (rendererRef.current) rendererRef.current.dispose();
      document.body.removeChild(rendererRef.current.domElement);
    };
  }, [saveState, addCube, showGrid]);

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          window.undo();
        } else if (e.key === "y") {
          e.preventDefault();
          window.redo();
        } else if (e.key === "s") {
          e.preventDefault();
          window.saveProject();
        } else if (e.key === "e") {
          e.preventDefault();
          window.exportAsImage();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* Video - visible as background */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
          zIndex: 0,
          opacity: videoOpacity,
          display: "block",
          visibility: "visible",
          backgroundColor: "#000000",
        }}
      />

      {/* Hand tracking canvas */}
      <canvas
        ref={(el) => {
          if (el) ctxRef.current = el.getContext("2d");
        }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* 3D canvas */}
      <canvas
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* Uploaded Image Display with 3D Creation */}
      {uploadedImage && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 50,
            background: "rgba(0,0,0,0.95)",
            padding: "20px",
            borderRadius: "15px",
            border: "2px solid #00ffff",
            boxShadow: "0 0 50px rgba(0, 255, 255, 0.7)",
            textAlign: "center",
            maxWidth: "90vw",
            maxHeight: "90vh",
            overflow: "auto",
          }}
        >
          <h3 style={{ color: "#00ffff", marginBottom: "15px", fontSize: "20px" }}>🖼️ Image Preview</h3>
          <img
            src={uploadedImage}
            alt="Uploaded"
            style={{
              maxWidth: "100%",
              maxHeight: "60vh",
              borderRadius: "8px",
              border: "2px solid #00ffff",
              objectFit: "contain",
              boxShadow: "0 0 20px rgba(0, 255, 255, 0.3)",
            }}
          />
          <div style={{ marginTop: "20px", display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={async () => {
                try {
                  // Load image using AirBrushHUD success animation
                  if (airBrushHUDRef.current) {
                    airBrushHUDRef.current.showSuccess(new THREE.Vector3(0, 0, 0));
                  }

                  // Create physics-based image object with perfect clarity
                  if (physicsEngineRef.current && sceneRef.current && imageTextureRef.current) {
                    const imgGroup = new THREE.Group();

                    // Create main image plane with high quality
                    const imageAspect = imageTextureRef.current.image
                      ? imageTextureRef.current.image.width / imageTextureRef.current.image.height
                      : 4 / 3;
                    const maxSize = Math.min(window.innerWidth, window.innerHeight) * 0.6;
                    const baseSize = Math.min(maxSize, 8);

                    const imgGeometry = new THREE.PlaneGeometry(baseSize, baseSize / imageAspect);
                    const imgMaterial = new THREE.MeshBasicMaterial({
                      map: imageTextureRef.current,
                      transparent: true,
                      opacity: 1.0,
                      side: THREE.DoubleSide,
                      depthWrite: false,
                    });

                    const imgMesh = new THREE.Mesh(imgGeometry, imgMaterial);
                    imgGroup.add(imgMesh);

                    imgGroup.position.set(0, 0, 0);
                    imgGroup.name = "image3DObject";
                    sceneRef.current.add(imgGroup);
                    physicsEngineRef.current.registerObject(imgGroup, { mass: 0.5 });

                    // Animate with bounce effect
                    physicsEngineRef.current.animateTo(
                      imgGroup,
                      {
                        position: new THREE.Vector3(0, 0, 2),
                        rotation: new THREE.Euler(0, Math.PI * 0.1, 0),
                        scale: new THREE.Vector3(1, 1, 1),
                      },
                      1000,
                      "easeOutBounce"
                    );
                  }

                  setGestureStatus("🎯 3D Image object created successfully!");
                  // Close the modal
                  const event = new CustomEvent("closeImage");
                  window.dispatchEvent(event);
                } catch (error) {
                  console.error("Failed to export to 3D:", error);
                  setGestureStatus("❌ Failed to create 3D object");
                  if (airBrushHUDRef.current) {
                    airBrushHUDRef.current.showError(new THREE.Vector3(0, 0, 0));
                  }
                }
              }}
              style={{
                padding: "15px 30px",
                background: "linear-gradient(135deg, rgba(0, 255, 255, 0.3), rgba(0, 150, 255, 0.3))",
                border: "2px solid #00ffff",
                borderRadius: "10px",
                color: "#00ffff",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "bold",
                transition: "all 0.3s ease",
                boxShadow: "0 0 20px rgba(0, 255, 255, 0.4)",
              }}
              onMouseOver={(e) => {
                e.target.style.background = "linear-gradient(135deg, rgba(0, 255, 255, 0.5), rgba(0, 150, 255, 0.5))";
                e.target.style.boxShadow = "0 0 30px rgba(0, 255, 255, 0.6)";
              }}
              onMouseOut={(e) => {
                e.target.style.background = "linear-gradient(135deg, rgba(0, 255, 255, 0.3), rgba(0, 150, 255, 0.3))";
                e.target.style.boxShadow = "0 0 20px rgba(0, 255, 255, 0.4)";
              }}
            >
              🚀 Export to 3D
            </button>
            <button
              onClick={() => {
                const event = new CustomEvent("closeImage");
                window.dispatchEvent(event);
              }}
              style={{
                padding: "15px 30px",
                background: "linear-gradient(135deg, rgba(255, 0, 0, 0.3), rgba(255, 100, 0, 0.3))",
                border: "2px solid #ff4444",
                borderRadius: "10px",
                color: "#ff4444",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "bold",
                transition: "all 0.3s ease",
                boxShadow: "0 0 20px rgba(255, 68, 68, 0.4)",
              }}
              onMouseOver={(e) => {
                e.target.style.background = "linear-gradient(135deg, rgba(255, 0, 0, 0.5), rgba(255, 100, 0, 0.5))";
                e.target.style.boxShadow = "0 0 30px rgba(255, 68, 68, 0.6)";
              }}
              onMouseOut={(e) => {
                e.target.style.background = "linear-gradient(135deg, rgba(255, 0, 0, 0.3), rgba(255, 100, 0, 0.3))";
                e.target.style.boxShadow = "0 0 20px rgba(255, 68, 68, 0.4)";
              }}
            >
              ❌ Close
            </button>
          </div>
          <div style={{ marginTop: "15px", color: "#00ff88", fontSize: "14px" }}>✨ Image quality preserved at maximum clarity</div>
        </div>
      )}

      {/* Floating Control Card */}
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          background: "rgba(0,0,0,0.9)",
          color: "white",
          padding: "20px",
          borderRadius: "15px",
          fontFamily: "Arial, sans-serif",
          fontSize: "13px",
          zIndex: 100,
          minWidth: "280px",
          border: handDetected ? "2px solid #00ff00" : "2px solid #ffaa00",
          boxShadow: "0 0 25px rgba(0, 255, 255, 0.4)",
        }}
      >
        <div style={{ color: "#00ffff", fontWeight: "bold", marginBottom: "12px", fontSize: "17px", textAlign: "center" }}>
          ✋ Open Air Brush
        </div>

        <div style={{ color: handDetected ? "#00ff00" : "#ffaa00", marginBottom: "10px", textAlign: "center", fontSize: "14px" }}>
          {handDetected ? `✓ ${handCount} Hand${handCount > 1 ? "s" : ""} Detected` : "⏳ Show your hand"}
        </div>

        <div
          style={{
            color: "#ffff00",
            fontWeight: "bold",
            marginBottom: "10px",
            fontSize: "14px",
            textAlign: "center",
            padding: "8px",
            background: "rgba(255,255,0,0.1)",
            borderRadius: "6px",
          }}
        >
          🎯 {gestureStatus}
        </div>

        {/* Current Settings */}
        <div
          style={{
            background: "rgba(255,0,255,0.15)",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "10px",
            border: "1px solid #ff00ff",
          }}
        >
          <div style={{ color: "#ff00ff", fontWeight: "bold", marginBottom: "6px" }}>📋 Current:</div>
          <div>
            🎨 Color:{" "}
            <span
              style={{
                display: "inline-block",
                width: "16px",
                height: "16px",
                background: selectedColor,
                borderRadius: "3px",
                verticalAlign: "middle",
                border: "1px solid #fff",
              }}
            ></span>
          </div>
          <div>📏 Size: {brushSize.toFixed(2)}</div>
          <div>
            🧤 Glove: <span style={{ textTransform: "capitalize", color: "#00ffff" }}>{selectedGlove}</span>
          </div>
          <div>
            🎯 Mode:{" "}
            <span style={{ color: activeTool === "draw" ? "#00ff00" : "#ff0000" }}>{activeTool === "draw" ? "✏️ DRAW" : "🧽 ERASE"}</span>
          </div>
        </div>

        {/* Instructions */}
        <div
          style={{
            background: "rgba(0,255,0,0.15)",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "10px",
            border: "1px solid #00ff00",
          }}
        >
          <div style={{ color: "#00ff00", fontWeight: "bold", marginBottom: "6px" }}>✋ Controls:</div>
          <div>✏️ Pinch = Draw</div>
          <div>🧽 Pinch on cube = Erase</div>
          <div>🙌 Two hands = Zoom</div>
        </div>

        {/* File Operations */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginTop: "10px" }}>
          <button
            onClick={() => document.getElementById("imageUpload").click()}
            style={{
              padding: "10px",
              background: "rgba(0, 255, 255, 0.2)",
              border: "1px solid #00ffff",
              borderRadius: "6px",
              color: "#00ffff",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            📷 Upload Image
          </button>
          <button
            onClick={window.saveProject}
            style={{
              padding: "10px",
              background: "rgba(255, 255, 0, 0.2)",
              border: "1px solid #ffff00",
              borderRadius: "6px",
              color: "#ffff00",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            💾 Save
          </button>
          <button
            onClick={() => document.getElementById("loadProject").click()}
            style={{
              padding: "10px",
              background: "rgba(0, 255, 0, 0.2)",
              border: "1px solid #00ff00",
              borderRadius: "6px",
              color: "#00ff00",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            📂 Load
          </button>
          <button
            onClick={window.exportAsImage}
            style={{
              padding: "10px",
              background: "rgba(255, 0, 255, 0.2)",
              border: "1px solid #ff00ff",
              borderRadius: "6px",
              color: "#ff00ff",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            📷 Export
          </button>
        </div>

        <input id="imageUpload" type="file" accept="image/*" onChange={onImageUpload} style={{ display: "none" }} />
        <input
          id="loadProject"
          type="file"
          accept=".json"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                if (window.loadProject) window.loadProject(ev.target.result);
              };
              reader.readAsText(file);
            }
          }}
          style={{ display: "none" }}
        />

        {isRecording && (
          <div
            style={{
              marginTop: "12px",
              color: "#ff0000",
              fontWeight: "bold",
              fontSize: "16px",
              textAlign: "center",
              animation: "blink 0.5s infinite",
              padding: "10px",
              background: "rgba(255,0,0,0.3)",
              borderRadius: "6px",
              border: "1px solid #ff0000",
            }}
          >
            ● RECORDING
          </div>
        )}

        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid rgba(255,255,255,0.2)",
            fontSize: "11px",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          ⌨️ Ctrl+Z Undo | Ctrl+S Save
        </div>
      </div>

      <style>{`@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0.3; } }`}</style>
    </>
  );
}

export default HandDrawingScene;
