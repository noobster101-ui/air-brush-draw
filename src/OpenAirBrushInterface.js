/**
 * Open Air Brush Interface
 * Main UI component for hand gesture 3D drawing application
 */
import { useState, useRef, useEffect, useCallback } from "react";
import HandDrawingScene from "./HandDrawingScene";

function OpenAirBrushInterface() {
  const [activeTool, setActiveTool] = useState("draw");
  const [selectedColor, setSelectedColor] = useState("#00ffff");
  const [brushSize, setBrushSize] = useState(0.15);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoOpacity, setVideoOpacity] = useState(0.5);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedGlove, setSelectedGlove] = useState("skeleton");
  const [uploadedImage, setUploadedImage] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const loadInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const colors = [
    "#00ffff",
    "#ff00ff",
    "#ffff00",
    "#00ff00",
    "#ff0000",
    "#0000ff",
    "#ffffff",
    "#000000",
    "#ffa500",
    "#800080",
    "#008000",
    "#808080",
  ];
  const gloves = [
    { id: "skeleton", name: "Bone", color: "#00ff00" },
    { id: "iron", name: "Iron", color: "#ff6600" },
    { id: "hulk", name: "Hulk", color: "#00cc00" },
    { id: "thanos", name: "Titan", color: "#cc0000" },
    { id: "cyber", name: "Cyber", color: "#00ffff" },
    { id: "ghost", name: "Ghost", color: "#aaffaa" },
  ];
  const tools = [
    { id: "draw", name: "Draw", icon: "✏️" },
    { id: "erase", name: "Erase", icon: "🧽" },
  ];

  useEffect(() => {
    // Mobile detection
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth <= 768) {
        setSidebarCollapsed(true);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    // Listen for open instructions event from child components
    const handleOpenInstructions = () => {
      setShowInstructions(true);
    };
    window.addEventListener("openInstructions", handleOpenInstructions);

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          if (window.undo) window.undo();
        } else if (e.key === "y") {
          e.preventDefault();
          if (window.redo) window.redo();
        } else if (e.key === "s") {
          e.preventDefault();
          handleSaveProject();
        } else if (e.key === "e") {
          e.preventDefault();
          handleExportImage();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("openInstructions", handleOpenInstructions);
    };
  }, []);

  const handleSaveProject = () => {
    if (window.saveProject) window.saveProject();
  };
  const handleExportImage = () => {
    if (window.exportAsImage) window.exportAsImage();
  };
  const handleUndo = () => {
    if (window.undo) window.undo();
  };
  const handleRedo = () => {
    if (window.redo) window.redo();
  };
  const handleClearScene = () => {
    if (window.clearScene && window.confirm("Clear all drawings?")) window.clearScene();
  };

  const startRecording = useCallback(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) {
      alert("3D scene not ready.");
      return;
    }
    const stream = canvas.captureStream(30);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `open-air-brush-${Date.now()}.webm`;
      a.click();
      recordedChunksRef.current = [];
    };
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setRecordingTime(0);
  }, []);

  const formatTime = (s) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // Sidebar toggle function
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Instructions content
  const instructionsContent = (
    <div
      style={{
        background: "rgba(0,0,0,0.95)",
        padding: "25px",
        borderRadius: "15px",
        border: "2px solid #00ffff",
        boxShadow: "0 0 40px rgba(0, 255, 255, 0.5)",
        maxWidth: "450px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h2
        style={{
          color: "#00ffff",
          marginBottom: "20px",
          textAlign: "center",
          fontSize: "24px",
          textShadow: "0 0 15px rgba(0, 255, 255, 0.8)",
        }}
      >
        ✋ Open Air Brush
        <br />
        <span style={{ fontSize: "14px", color: "#88ccff" }}>Hand Gesture 3D Drawing</span>
      </h2>

      <div
        style={{
          background: "rgba(255,255,0,0.1)",
          padding: "15px",
          borderRadius: "10px",
          border: "1px solid #ffff00",
          marginBottom: "15px",
        }}
      >
        <h3 style={{ color: "#ffff00", marginBottom: "10px", fontSize: "16px" }}>📖 How to Use</h3>
        <p style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", lineHeight: "1.6" }}>
          Use your hand gestures to draw in 3D space! Make sure your hand is visible to the camera.
        </p>
      </div>

      <div
        style={{
          background: "rgba(0,255,0,0.1)",
          padding: "15px",
          borderRadius: "10px",
          border: "1px solid #00ff00",
          marginBottom: "15px",
        }}
      >
        <h3 style={{ color: "#00ff00", marginBottom: "12px", fontSize: "16px" }}>✋ Hand Gestures</h3>
        <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.9)", lineHeight: "1.8" }}>
          <div>
            ✏️ <strong>Move finger</strong> = Draw 3D cubes
          </div>
          <div>
            🧽 <strong>Move finger (Erase mode)</strong> = Erase cubes
          </div>
          <div>
            ✋ <strong>Pinch finger & thumb</strong> = Pause drawing
          </div>
          <div>
            ✋ ✋<strong>Two hands apart</strong> = Zoom Out
          </div>
          <div>
            🙌 <strong>Two hands together</strong> = Zoom In
          </div>
          <div>
            🖐️ <strong>Open palm</strong> = Reset view with effect
          </div>
          <div>
            ✊ <strong>Fist/Closed hand</strong> = Lock to draw mode
          </div>
        </div>
      </div>

      <div
        style={{
          background: "rgba(0,255,255,0.1)",
          padding: "15px",
          borderRadius: "10px",
          border: "1px solid #00ffff",
          marginBottom: "15px",
        }}
      >
        <h3 style={{ color: "#00ffff", marginBottom: "10px", fontSize: "16px" }}>🎮 Quick Tips</h3>
        <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.9)", lineHeight: "1.6" }}>
          <div>• Start with your index finger pointing up</div>
          <div>• Move slowly for precise control</div>
          <div>• Use two hands for zooming images</div>
          <div>• Ctrl+Z to undo, Ctrl+S to save</div>
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <button
          onClick={() => setShowInstructions(false)}
          style={{
            padding: "15px 40px",
            background: "linear-gradient(135deg, rgba(0,255,255,0.3), rgba(0,150,255,0.3))",
            border: "2px solid #00ffff",
            borderRadius: "10px",
            color: "#00ffff",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
            boxShadow: "0 0 20px rgba(0, 255, 255, 0.4)",
            transition: "all 0.3s ease",
          }}
          onMouseOver={(e) => {
            e.target.style.background = "linear-gradient(135deg, rgba(0,255,255,0.5), rgba(0,150,255,0.5))";
            e.target.style.boxShadow = "0 0 30px rgba(0, 255, 255, 0.6)";
          }}
          onMouseOut={(e) => {
            e.target.style.background = "linear-gradient(135deg, rgba(0,255,255,0.3), rgba(0,150,255,0.3))";
            e.target.style.boxShadow = "0 0 20px rgba(0, 255, 255, 0.4)";
          }}
        >
          Got it! Let's Draw 🎨
        </button>
      </div>

      <div
        style={{
          marginTop: "15px",
          textAlign: "center",
          fontSize: "11px",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        💡 Tip: Click the ❓ button anytime to see these instructions again
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a1a", fontFamily: "Arial, sans-serif", overflow: "hidden" }}>
      {/* Instructions Popup Overlay */}
      {showInstructions && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            overflow: "auto",
          }}
          onClick={() => setShowInstructions(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>{instructionsContent}</div>
        </div>
      )}

      {/* Help Button (❓) */}
      <button
        onClick={() => setShowInstructions(true)}
        style={{
          position: "fixed",
          top: isMobile ? "20px" : "20px",
          right: isMobile ? (mobileMenuOpen ? "auto" : "10px") : sidebarCollapsed ? "60px" : "270px",
          zIndex: 2000,
          width: isMobile ? "40px" : "45px",
          height: isMobile ? "40px" : "45px",
          background: "rgba(255, 255, 0, 0.2)",
          border: "2px solid #ffff00",
          borderRadius: "50%",
          color: "#ffff00",
          fontSize: isMobile ? "18px" : "20px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 15px rgba(255, 255, 0, 0.4)",
          transition: "all 0.3s ease",
        }}
        title="Show Instructions"
        onMouseOver={(e) => {
          e.target.style.background = "rgba(255, 255, 0, 0.4)";
          e.target.style.transform = "scale(1.1)";
        }}
        onMouseOut={(e) => {
          e.target.style.background = "rgba(255, 255, 0, 0.2)";
          e.target.style.transform = "scale(1)";
        }}
      >
        ❓
      </button>

      {/* Mobile Hamburger Menu Button */}
      {isMobile && (
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            position: "fixed",
            top: "15px",
            left: "15px",
            zIndex: 2000,
            width: "50px",
            height: "50px",
            background: "rgba(0, 255, 255, 0.2)",
            border: "2px solid #00ffff",
            borderRadius: "10px",
            color: "#00ffff",
            fontSize: "24px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 15px rgba(0, 255, 255, 0.4)",
          }}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      )}

      {/* Mobile Overlay Menu */}
      {isMobile && mobileMenuOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "auto",
            height: "100%",
            background: "rgba(0, 0, 0, 0.95)",
            zIndex: 1500,
            overflow: "auto",
            padding: "80px 20px 20px",
          }}
        >
          {/* Mobile Tools */}
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ color: "#00ffff", marginBottom: "10px", fontSize: "14px", textTransform: "uppercase" }}>Tools</h3>
            <div style={{ display: "flex", gap: "10px" }}>
              {tools.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTool(t.id);
                    setMobileMenuOpen(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "15px",
                    background: activeTool === t.id ? "rgba(0,255,255,0.25)" : "rgba(255,255,255,0.1)",
                    border: activeTool === t.id ? "2px solid #00ffff" : "1px solid rgba(255,255,255,0.3)",
                    borderRadius: "8px",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  <span style={{ fontSize: "24px" }}>{t.icon}</span>
                  <br />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Colors */}
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ color: "#00ffff", marginBottom: "10px", fontSize: "14px", textTransform: "uppercase" }}>Colors</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "6px" }}>
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setSelectedColor(c);
                    setMobileMenuOpen(false);
                  }}
                  style={{
                    aspectRatio: "1",
                    background: c,
                    border: selectedColor === c ? "3px solid #fff" : "2px solid rgba(255,255,255,0.3)",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Mobile Brush Size */}
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ color: "#00ffff", marginBottom: "8px", fontSize: "14px", textTransform: "uppercase" }}>
              Brush Size: {brushSize.toFixed(2)}
            </h3>
            <input
              type="range"
              min="0.05"
              max="0.3"
              step="0.01"
              value={brushSize}
              onChange={(e) => setBrushSize(parseFloat(e.target.value))}
              style={{ width: "100%", height: "30px" }}
            />
          </div>

          {/* Mobile Actions */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "20px" }}>
            <button
              onClick={() => document.getElementById("imgUp").click()}
              style={{
                padding: "12px",
                background: "rgba(0, 255, 255, 0.15)",
                border: "1px solid #00ffff",
                borderRadius: "8px",
                color: "#00ffff",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              📷 Upload
            </button>
            <button
              onClick={handleSaveProject}
              style={{
                padding: "12px",
                background: "rgba(255, 255, 0, 0.15)",
                border: "1px solid #ffff00",
                borderRadius: "8px",
                color: "#ffff00",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              💾 Save
            </button>
            <button
              onClick={() => loadInputRef.current?.click()}
              style={{
                padding: "12px",
                background: "rgba(0, 255, 0, 0.15)",
                border: "1px solid #00ff00",
                borderRadius: "8px",
                color: "#00ff00",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              📂 Load
            </button>
            <button
              onClick={handleExportImage}
              style={{
                padding: "12px",
                background: "rgba(255, 0, 255, 0.15)",
                border: "1px solid #ff00ff",
                borderRadius: "8px",
                color: "#ff00ff",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              📤 Export
            </button>
          </div>

          {/* Mobile Clear Button */}
          <button
            onClick={handleClearScene}
            style={{
              width: "100%",
              padding: "15px",
              background: "rgba(255, 0, 0, 0.15)",
              border: "1px solid #ff0000",
              borderRadius: "8px",
              color: "#ff0000",
              cursor: "pointer",
              fontSize: "14px",
              marginBottom: "20px",
            }}
          >
            🗑️ Clear Scene
          </button>

          {/* Mobile Recording */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            style={{
              width: "100%",
              padding: "15px",
              background: isRecording ? "rgba(255,0,0,0.2)" : "rgba(0,255,0,0.15)",
              border: isRecording ? "1px solid #ff0000" : "1px solid #00ff00",
              borderRadius: "8px",
              color: isRecording ? "#ff0000" : "#00ff00",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              marginBottom: "20px",
            }}
          >
            {isRecording ? "⏹️ Stop " + formatTime(recordingTime) : "⏺ Record"}
          </button>

          {/* Mobile Gesture Instructions */}
          <div
            style={{
              padding: "15px",
              background: "rgba(0, 255, 255, 0.1)",
              borderRadius: "8px",
              border: "1px solid rgba(0, 255, 255, 0.3)",
              fontSize: "12px",
              color: "rgba(255,255,255,0.8)",
            }}
          >
            <strong style={{ color: "#00ffff" }}>✋ Gestures:</strong>
            <br />
            ✏️ Move finger = Draw
            <br />
            🧽 Move finger = Erase
            <br />
            ✋ Pinch = Stop
            <br />
            🙌 Two hands near = Zoom
          </div>
        </div>
      )}

      {/* Sidebar Toggle Button (Desktop) */}
      {!isMobile && (
        <button
          onClick={toggleSidebar}
          style={{
            position: "fixed",
            left: sidebarCollapsed ? "10px" : "290px",
            top: "15px",
            zIndex: 2000,
            width: "40px",
            height: "40px",
            background: "rgba(0, 255, 255, 0.2)",
            border: "2px solid #00ffff",
            borderRadius: "8px",
            color: "#00ffff",
            fontSize: "18px",
            cursor: "pointer",
            transition: "left 0.3s ease",
            boxShadow: "0 0 15px rgba(0, 255, 255, 0.4)",
          }}
          title={sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
        >
          {sidebarCollapsed ? "▶" : "◀"}
        </button>
      )}

      {/* Collapsible Sidebar */}
      <div
        style={{
          width: sidebarCollapsed || isMobile ? "0px" : "260px",
          background: "rgba(15, 20, 35, 0.98)",
          borderRight: "2px solid #00ffff",
          padding: sidebarCollapsed || isMobile ? "0px" : "15px",
          overflowY: "auto",
          overflowX: "hidden",
          boxShadow: "4px 0 20px rgba(0, 255, 255, 0.15)",
          zIndex: 1000,
          position: "relative",
          flexShrink: 0,
          transition: "all 0.3s ease",
          opacity: sidebarCollapsed || isMobile ? 0 : 1,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "15px", borderBottom: "2px solid #00ffff", paddingBottom: "12px" }}>
          <h2
            style={{ color: "#00ffff", margin: 0, fontSize: "18px", textShadow: "0 0 15px rgba(0, 255, 255, 0.8)", letterSpacing: "2px" }}
          >
            ✋ OPEN AIR BRUSH
          </h2>
          <p style={{ color: "#88ccff", margin: "8px 0 0", fontSize: "10px", opacity: 0.9 }}>Hand Gesture 3D Drawing</p>
        </div>
        <div style={{ marginBottom: "12px" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "6px", fontSize: "11px", textTransform: "uppercase" }}>Tools</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTool(t.id)}
                style={{
                  padding: "10px",
                  background: activeTool === t.id ? "rgba(0,255,255,0.25)" : "rgba(255,255,255,0.1)",
                  border: activeTool === t.id ? "2px solid #00ffff" : "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "6px",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "11px",
                }}
              >
                <span style={{ fontSize: "18px" }}>{t.icon}</span>
                <br />
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: "12px" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "6px", fontSize: "11px", textTransform: "uppercase" }}>Colors</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "4px" }}>
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                style={{
                  aspectRatio: "1",
                  background: c,
                  border: selectedColor === c ? "3px solid #fff" : "2px solid rgba(255,255,255,0.3)",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ marginBottom: "12px" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "4px", fontSize: "11px", textTransform: "uppercase" }}>
            Brush Size: {brushSize.toFixed(2)}
          </h3>
          <input
            type="range"
            min="0.05"
            max="0.3"
            step="0.01"
            value={brushSize}
            onChange={(e) => setBrushSize(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ marginBottom: "12px" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "4px", fontSize: "11px", textTransform: "uppercase" }}>Glove</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "4px" }}>
            {gloves.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGlove(g.id)}
                style={{
                  padding: "6px",
                  background: selectedGlove === g.id ? g.color + "40" : "rgba(255,255,255,0.1)",
                  border: `2px solid ${selectedGlove === g.id ? g.color : "transparent"}`,
                  borderRadius: "4px",
                  color: g.color,
                  cursor: "pointer",
                  fontSize: "10px",
                  fontWeight: "bold",
                }}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: "12px" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "4px", fontSize: "11px", textTransform: "uppercase" }}>
            Video: {Math.round(videoOpacity * 100)}%
          </h3>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={videoOpacity}
            onChange={(e) => setVideoOpacity(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", color: "#fff", fontSize: "10px" }}>
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Grid
          </label>
        </div>
        <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
          <button
            onClick={handleUndo}
            style={{
              flex: 1,
              padding: "8px",
              background: "rgba(255,255,0,0.15)",
              border: "1px solid #ffff00",
              borderRadius: "4px",
              color: "#ffff00",
              cursor: "pointer",
              fontSize: "10px",
            }}
          >
            Undo
          </button>
          <button
            onClick={handleRedo}
            style={{
              flex: 1,
              padding: "8px",
              background: "rgba(0,255,0,0.15)",
              border: "1px solid #00ff00",
              borderRadius: "4px",
              color: "#00ff00",
              cursor: "pointer",
              fontSize: "10px",
            }}
          >
            Redo
          </button>
        </div>
        <div style={{ marginBottom: "12px" }}>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            style={{
              width: "100%",
              padding: "10px",
              background: isRecording ? "rgba(255,0,0,0.2)" : "rgba(0,255,0,0.15)",
              border: isRecording ? "1px solid #ff0000" : "1px solid #00ff00",
              borderRadius: "4px",
              color: isRecording ? "#ff0000" : "#00ff00",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "bold",
            }}
          >
            {isRecording ? "Stop " + formatTime(recordingTime) : "Record"}
          </button>
        </div>
        <div style={{ marginTop: "auto" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "6px", fontSize: "11px", textTransform: "uppercase" }}>Actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
            <button
              onClick={() => document.getElementById("imgUp").click()}
              style={{
                padding: "6px",
                background: "rgba(0,255,255,0.15)",
                border: "1px solid #00ffff",
                borderRadius: "4px",
                color: "#00ffff",
                cursor: "pointer",
                fontSize: "9px",
              }}
            >
              Upload
            </button>
            <button
              onClick={handleSaveProject}
              style={{
                padding: "6px",
                background: "rgba(255,255,0,0.15)",
                border: "1px solid #ffff00",
                borderRadius: "4px",
                color: "#ffff00",
                cursor: "pointer",
                fontSize: "9px",
              }}
            >
              Save
            </button>
            <button
              onClick={() => loadInputRef.current?.click()}
              style={{
                padding: "6px",
                background: "rgba(0,255,0,0.15)",
                border: "1px solid #00ff00",
                borderRadius: "4px",
                color: "#00ff00",
                cursor: "pointer",
                fontSize: "9px",
              }}
            >
              Load
            </button>
            <button
              onClick={handleExportImage}
              style={{
                padding: "6px",
                background: "rgba(255,0,255,0.15)",
                border: "1px solid #ff00ff",
                borderRadius: "4px",
                color: "#ff00ff",
                cursor: "pointer",
                fontSize: "9px",
              }}
            >
              Export
            </button>
          </div>
          <button
            onClick={handleClearScene}
            style={{
              width: "100%",
              padding: "8px",
              marginTop: "6px",
              background: "rgba(255,0,0,0.15)",
              border: "1px solid #ff0000",
              borderRadius: "4px",
              color: "#ff0000",
              cursor: "pointer",
              fontSize: "10px",
            }}
          >
            Clear
          </button>
        </div>
        <div
          style={{
            marginTop: "12px",
            paddingTop: "8px",
            borderTop: "1px solid rgba(0,255,255,0.3)",
            fontSize: "9px",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <strong style={{ color: "#00ffff" }}>Gestures:</strong> Pinch to draw, Two hands zoom, Open palm reset
        </div>
      </div>
      <div
        style={{ flex: 1, position: "relative", overflow: "hidden", zIndex: 1, marginLeft: sidebarCollapsed && !isMobile ? "0px" : "0px" }}
      >
        <HandDrawingScene
          activeTool={activeTool}
          selectedColor={selectedColor}
          brushSize={brushSize}
          showGrid={showGrid}
          videoOpacity={videoOpacity}
          isRecording={isRecording}
          selectedGlove={selectedGlove}
          uploadedImage={uploadedImage}
          sidebarCollapsed={sidebarCollapsed}
          isMobile={isMobile}
          onImageUpload={(e) => {
            const f = e.target.files[0];
            if (f) {
              const r = new FileReader();
              r.onload = (ev) => setUploadedImage(ev.target.result);
              r.readAsDataURL(f);
            }
          }}
        />
      </div>
      <input
        id="imgUp"
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files[0];
          if (f) {
            const r = new FileReader();
            r.onload = (ev) => setUploadedImage(ev.target.result);
            r.readAsDataURL(f);
          }
        }}
      />
      <input
        ref={loadInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files[0];
          if (f) {
            const r = new FileReader();
            r.onload = (ev) => {
              if (window.loadProject) window.loadProject(ev.target.result);
            };
            r.readAsText(f);
          }
        }}
      />
    </div>
  );
}
export default OpenAirBrushInterface;
