import { useState, useRef, useEffect, useCallback } from "react";
import HandDrawingScene from "./HandDrawingScene";

function JarvisInterface() {
  const [activeTool, setActiveTool] = useState("draw");
  const [selectedColor, setSelectedColor] = useState("#00ffff");
  const [brushSize, setBrushSize] = useState(0.15);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoOpacity, setVideoOpacity] = useState(0.5);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedGlove, setSelectedGlove] = useState("skeleton");
  const [uploadedImage, setUploadedImage] = useState(null);
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
    { id: "skeleton", name: "💀 Bone", color: "#00ff00" },
    { id: "iron", name: "🔥 Iron", color: "#ff6600" },
    { id: "hulk", name: "💚 Hulk", color: "#00cc00" },
    { id: "thanos", name: "💜 Titan", color: "#cc0000" },
    { id: "cyber", name: "💙 Cyber", color: "#00ffff" },
    { id: "ghost", name: "👻 Ghost", color: "#aaffaa" },
  ];

  const tools = [
    { id: "draw", name: "Draw", icon: "✏️" },
    { id: "erase", name: "Erase", icon: "🧽" },
  ];

  // Keyboard shortcuts
  useEffect(() => {
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

    const handleCloseImage = () => {
      setUploadedImage(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("closeImage", handleCloseImage);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("closeImage", handleCloseImage);
    };
  }, []);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLoadProject = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (window.loadProject) {
          const success = window.loadProject(e.target.result);
          if (success) {
            alert("Project loaded successfully!");
          } else {
            alert("Failed to load project.");
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSaveProject = () => {
    if (window.saveProject) {
      window.saveProject();
    }
  };

  const handleExportImage = () => {
    if (window.exportAsImage) {
      window.exportAsImage();
    }
  };

  const handleUndo = () => {
    if (window.undo) window.undo();
  };

  const handleRedo = () => {
    if (window.redo) window.redo();
  };

  const handleClearScene = () => {
    if (window.clearScene) {
      if (window.confirm("Clear all drawings?")) {
        window.clearScene();
      }
    }
  };

  // Recording
  const startRecording = useCallback(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) {
      alert("3D scene not ready. Please wait...");
      return;
    }

    const stream = canvas.captureStream(30);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `air-brush-recording-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      recordedChunksRef.current = [];
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);

    recordingTimerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingTime(0);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "#0a0a1a",
        fontFamily: "Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Left Sidebar */}
      <div
        style={{
          width: "280px",
          background: "rgba(0, 20, 40, 0.95)",
          borderRight: "2px solid #00ffff",
          boxShadow: "0 0 20px rgba(0, 255, 255, 0.3)",
          display: "flex",
          flexDirection: "column",
          padding: "15px",
          overflowY: "auto",
          zIndex: 100,
          position: "relative",
        }}
      >
        {/* Header */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "15px",
            borderBottom: "1px solid #00ffff",
            paddingBottom: "10px",
          }}
        >
          <h2
            style={{
              color: "#00ffff",
              margin: "0",
              fontSize: "18px",
              textShadow: "0 0 10px #00ffff",
            }}
          >
            JARVIS AIR BRUSH
          </h2>
          <p style={{ color: "#ffffff", margin: "5px 0 0 0", fontSize: "10px", opacity: 0.8 }}>Hand Gesture 3D Drawing</p>
        </div>

        {/* Tools */}
        <div style={{ marginBottom: "15px" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "8px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>
            Tools
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                style={{
                  background: activeTool === tool.id ? "rgba(0, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.1)",
                  border: activeTool === tool.id ? "2px solid #00ffff" : "1px solid rgba(255, 255, 255, 0.3)",
                  borderRadius: "8px",
                  padding: "12px 8px",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: "12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "5px",
                  transition: "all 0.2s ease",
                  boxShadow: activeTool === tool.id ? "0 0 15px rgba(0, 255, 255, 0.6)" : "none",
                }}
              >
                <span style={{ fontSize: "22px" }}>{tool.icon}</span>
                <span>{tool.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Color Palette */}
        <div style={{ marginBottom: "15px" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "8px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>
            Colors
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  background: color,
                  border: selectedColor === color ? "3px solid #ffffff" : "2px solid rgba(255, 255, 255, 0.3)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  boxShadow: selectedColor === color ? "0 0 15px rgba(0, 255, 255, 0.8)" : "none",
                  transition: "all 0.2s ease",
                }}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* Brush Size */}
        <div style={{ marginBottom: "15px" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "8px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>
            Brush Size
          </h3>
          <label style={{ color: "#ffffff", display: "block", marginBottom: "5px", fontSize: "11px" }}>
            Current: {brushSize.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.05"
            max="0.3"
            step="0.01"
            value={brushSize}
            onChange={(e) => setBrushSize(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#00ffff" }}
          />
        </div>

        {/* Glove Selector */}
        <div style={{ marginBottom: "15px" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "8px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>
            🧤 Glove Style
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
            {gloves.map((glove) => (
              <button
                key={glove.id}
                onClick={() => setSelectedGlove(glove.id)}
                style={{
                  padding: "8px 4px",
                  background: selectedGlove === glove.id ? glove.color + "40" : "rgba(255,255,255,0.1)",
                  border: `2px solid ${selectedGlove === glove.id ? glove.color : "transparent"}`,
                  borderRadius: "6px",
                  color: glove.color,
                  cursor: "pointer",
                  fontSize: "11px",
                  textAlign: "center",
                  fontWeight: "bold",
                }}
                title={glove.id}
              >
                {glove.name}
              </button>
            ))}
          </div>
        </div>

        {/* Video Settings */}
        <div style={{ marginBottom: "15px" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "8px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>
            Video Feed
          </h3>
          <label style={{ color: "#ffffff", display: "block", marginBottom: "4px", fontSize: "11px" }}>
            Opacity: {Math.round(videoOpacity * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={videoOpacity}
            onChange={(e) => setVideoOpacity(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#00ffff" }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", marginTop: "8px" }}>
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              style={{ accentColor: "#00ffff", width: "14px", height: "14px" }}
            />
            <span style={{ color: "#ffffff", fontSize: "11px" }}>Show Grid</span>
          </label>
        </div>

        {/* History */}
        <div style={{ marginBottom: "15px" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "8px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>
            History
          </h3>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleUndo}
              style={{
                flex: 1,
                padding: "10px",
                background: "rgba(255, 255, 0, 0.15)",
                border: "1px solid #ffff00",
                borderRadius: "6px",
                color: "#ffff00",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              ↩️ Undo
            </button>
            <button
              onClick={handleRedo}
              style={{
                flex: 1,
                padding: "10px",
                background: "rgba(0, 255, 0, 0.15)",
                border: "1px solid #00ff00",
                borderRadius: "6px",
                color: "#00ff00",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              ↪️ Redo
            </button>
          </div>
        </div>

        {/* Recording */}
        <div style={{ marginBottom: "15px" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "8px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>
            Recording
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              style={{
                flex: 1,
                padding: "10px",
                background: isRecording ? "rgba(255, 0, 0, 0.2)" : "rgba(0, 255, 0, 0.15)",
                border: isRecording ? "1px solid #ff0000" : "1px solid #00ff00",
                borderRadius: "6px",
                color: isRecording ? "#ff0000" : "#00ff00",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "bold",
              }}
            >
              {isRecording ? "⏹ Stop" : "⏺ Record"}
            </button>
            {isRecording && (
              <div
                style={{
                  background: "rgba(255, 0, 0, 0.3)",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  color: "#ff0000",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  fontWeight: "bold",
                  animation: "blink 1s infinite",
                }}
              >
                {formatTime(recordingTime)}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ marginTop: "auto" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "8px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>
            Quick Actions
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
            <button
              onClick={() => document.getElementById("imageUpload").click()}
              style={{
                padding: "8px",
                background: "rgba(0, 255, 255, 0.15)",
                border: "1px solid #00ffff",
                borderRadius: "6px",
                color: "#00ffff",
                cursor: "pointer",
                fontSize: "10px",
                textAlign: "center",
              }}
            >
              📷 Upload
            </button>
            <button
              onClick={handleSaveProject}
              style={{
                padding: "8px",
                background: "rgba(255, 255, 0, 0.15)",
                border: "1px solid #ffff00",
                borderRadius: "6px",
                color: "#ffff00",
                cursor: "pointer",
                fontSize: "10px",
                textAlign: "center",
              }}
            >
              💾 Save
            </button>
            <button
              onClick={() => loadInputRef.current?.click()}
              style={{
                padding: "8px",
                background: "rgba(0, 255, 0, 0.15)",
                border: "1px solid #00ff00",
                borderRadius: "6px",
                color: "#00ff00",
                cursor: "pointer",
                fontSize: "10px",
                textAlign: "center",
              }}
            >
              📂 Load
            </button>
            <button
              onClick={handleExportImage}
              style={{
                padding: "8px",
                background: "rgba(255, 0, 255, 0.15)",
                border: "1px solid #ff00ff",
                borderRadius: "6px",
                color: "#ff00ff",
                cursor: "pointer",
                fontSize: "10px",
                textAlign: "center",
              }}
            >
              📷 Export
            </button>
          </div>
          <button
            onClick={handleClearScene}
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "8px",
              background: "rgba(255, 0, 0, 0.15)",
              border: "1px solid #ff0000",
              borderRadius: "6px",
              color: "#ff0000",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            🗑️ Clear Scene
          </button>
          <input ref={loadInputRef} type="file" accept=".json" onChange={handleLoadProject} style={{ display: "none" }} />
        </div>

        {/* Help */}
        <div style={{ marginTop: "15px", paddingTop: "10px", borderTop: "1px solid rgba(0, 255, 255, 0.3)" }}>
          <h3 style={{ color: "#00ffff", marginBottom: "6px", fontSize: "11px", textTransform: "uppercase" }}>Advanced Gestures</h3>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "10px", lineHeight: "1.5" }}>
            <div>✋ Pinch = Draw/Erase</div>
            <div>🙌 Two hands = Zoom In/Out</div>
            <div>✋+✋ Two hands apart = Zoom Out</div>
            <div>✋+✋ Two hands together = Zoom In</div>
            <div>🤲 Open palm = Reset position</div>
            <div>✊ Fist = Lock to draw mode</div>
            <div>📷 Upload image then create 3D object</div>
          </div>
        </div>
      </div>

      {/* Main 3D Scene Area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <HandDrawingScene
          activeTool={activeTool}
          selectedColor={selectedColor}
          brushSize={brushSize}
          showGrid={showGrid}
          videoOpacity={videoOpacity}
          isRecording={isRecording}
          selectedGlove={selectedGlove}
          uploadedImage={uploadedImage}
          onImageUpload={handleImageUpload}
        />
      </div>

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

export default JarvisInterface;
