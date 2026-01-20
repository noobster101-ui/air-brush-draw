/**
 * Video Grid Component
 * Displays multiple video tiles in a grid layout like the reference image
 */

import { useState, useRef, useEffect } from "react";

function VideoGrid({ mainVideoRef, videoOpacity, isMobile }) {
  const [gridVideos, setGridVideos] = useState([]);
  const [showGrid, setShowGrid] = useState(true);
  const [gridLayout, setGridLayout] = useState("2x2"); // 1x1, 2x2, 3x3, etc.

  // Add a video to the grid
  const addVideoToGrid = (videoBlob) => {
    const videoUrl = URL.createObjectURL(videoBlob);
    const newVideo = {
      id: Date.now(),
      url: videoUrl,
      type: "recorded",
      timestamp: new Date().toLocaleTimeString(),
    };
    setGridVideos((prev) => [...prev, newVideo].slice(-8)); // Keep max 8 videos
  };

  // Remove video from grid
  const removeVideoFromGrid = (videoId) => {
    setGridVideos((prev) => prev.filter((v) => v.id !== videoId));
  };

  // Clear all grid videos
  const clearGrid = () => {
    gridVideos.forEach((video) => URL.revokeObjectURL(video.url));
    setGridVideos([]);
  };

  // Expose functions to window for external access
  useEffect(() => {
    window.addVideoToGrid = addVideoToGrid;
    window.clearVideoGrid = clearGrid;
    return () => {
      window.addVideoToGrid = null;
      window.clearVideoGrid = null;
    };
  }, []);

  // Grid layout configurations
  const getGridConfig = (layout) => {
    const configs = {
      "1x1": { cols: 1, rows: 1, maxVideos: 1 },
      "2x2": { cols: 2, rows: 2, maxVideos: 4 },
      "3x3": { cols: 3, rows: 3, maxVideos: 9 },
      "4x2": { cols: 4, rows: 2, maxVideos: 8 },
    };
    return configs[layout] || configs["2x2"];
  };

  const config = getGridConfig(gridLayout);
  const displayVideos = gridVideos.slice(0, config.maxVideos);

  if (!showGrid || displayVideos.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: isMobile ? "80px" : "100px",
        right: isMobile ? "10px" : "20px",
        width: isMobile ? "120px" : "200px",
        height: isMobile ? "120px" : "200px",
        background: "rgba(0,0,0,0.8)",
        border: "2px solid #00ffff",
        borderRadius: "10px",
        zIndex: 150,
        display: "grid",
        gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
        gridTemplateRows: `repeat(${config.rows}, 1fr)`,
        gap: "2px",
        padding: "5px",
        boxShadow: "0 0 20px rgba(0, 255, 255, 0.3)",
      }}
    >
      {/* Grid Toggle Button */}
      <button
        onClick={() => setShowGrid(false)}
        style={{
          position: "absolute",
          top: "-8px",
          right: "-8px",
          width: "20px",
          height: "20px",
          background: "#ff4444",
          border: "2px solid #ffffff",
          borderRadius: "50%",
          color: "white",
          fontSize: "12px",
          cursor: "pointer",
          zIndex: 160,
        }}
        title="Hide Grid"
      >
        ×
      </button>

      {/* Layout Toggle */}
      <select
        value={gridLayout}
        onChange={(e) => setGridLayout(e.target.value)}
        style={{
          position: "absolute",
          top: "-25px",
          left: "5px",
          fontSize: "10px",
          padding: "2px",
          background: "rgba(0,0,0,0.8)",
          color: "#00ffff",
          border: "1px solid #00ffff",
          borderRadius: "3px",
        }}
      >
        <option value="1x1">1×1</option>
        <option value="2x2">2×2</option>
        <option value="3x3">3×3</option>
        <option value="4x2">4×2</option>
      </select>

      {/* Video Tiles */}
      {displayVideos.map((video, index) => (
        <div
          key={video.id}
          style={{
            position: "relative",
            background: "#000",
            borderRadius: "3px",
            overflow: "hidden",
            border: "1px solid rgba(0, 255, 255, 0.3)",
          }}
        >
          <video
            src={video.url}
            autoPlay
            loop
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />

          {/* Video Info Overlay */}
          <div
            style={{
              position: "absolute",
              bottom: "0",
              left: "0",
              right: "0",
              background: "rgba(0,0,0,0.7)",
              color: "#00ffff",
              fontSize: "8px",
              padding: "2px",
              textAlign: "center",
            }}
          >
            {video.timestamp}
          </div>

          {/* Remove Button */}
          <button
            onClick={() => removeVideoFromGrid(video.id)}
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              width: "12px",
              height: "12px",
              background: "#ff4444",
              border: "none",
              borderRadius: "50%",
              color: "white",
              fontSize: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}

      {/* Empty Slots */}
      {Array.from({ length: config.maxVideos - displayVideos.length }).map((_, index) => (
        <div
          key={`empty-${index}`}
          style={{
            background: "rgba(0, 255, 255, 0.1)",
            border: "1px dashed rgba(0, 255, 255, 0.3)",
            borderRadius: "3px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(0, 255, 255, 0.5)",
            fontSize: "10px",
          }}
        >
          Empty
        </div>
      ))}
    </div>
  );
}

export default VideoGrid;
