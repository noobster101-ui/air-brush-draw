# Image Interaction System - Implementation Plan

## Requirements Summary

1. Image appears ONLY after "Make 3D" button click
2. Display at original size, centered, no distortion
3. Touch-based interactions (only when NOT in Paint mode)
4. Paint mode disables image interactions

## Implementation Steps

### Step 1: Add State Variables

- [ ] `isImageSelected` - track if image is touched/selected
- [ ] `imageOriginalSize` - store original dimensions
- [ ] `isImageInScene` - track if 3D image is created

### Step 2: Update Modal Logic

- [ ] Remove automatic image display on upload
- [ ] "Make 3D" button shows modal with preview
- [ ] Clicking "Make 3D" creates 3D object

### Step 3: Create 3D Image Object

- [ ] Load image with original dimensions
- [ ] Center in view
- [ ] No scaling/distortion

### Step 4: Add Image Selection (Raycasting)

- [ ] Detect when finger touches image
- [ ] Set `isImageSelected = true`
- [ ] Visual feedback for selection

### Step 5: Implement Image Movement

- [ ] One finger drag moves image
- [ ] Stop when finger released
- [ ] `isImageSelected = false` on release

### Step 6: Implement Image Zoom (Two Hands)

- [ ] Two hands zoom image in/out
- [ ] Works independently of selection

### Step 7: Paint Mode Integration

- [ ] When `activeTool === "paint"`:
  - Disable image selection
  - Disable image movement
  - Disable image zoom
  - All input for drawing

## Files to Modify

- `src/HandDrawingScene.js` - Main component

## New Behavior Flow

```
Upload Image → No display yet
↓
Click "Make 3D" button
↓
Modal shows preview
↓
Click "Create 3D Object"
↓
Image appears in 3D scene (original size, centered)
↓
Touch image → Selection highlight → One finger drag to move
↓
Two hands → Zoom in/out
↓
Release finger → Deselect
↓
Paint mode → Image frozen, all input for drawing
```

## Code Structure Changes

```javascript
// New state
const [imageState, setImageState] = useState({
  inScene: false,
  selected: false,
  originalWidth: 0,
  originalHeight: 0,
});

// New refs
const imageDragStartRef = useRef(null);
const imageInitialScaleRef = useRef(1);
```
