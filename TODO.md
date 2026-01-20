# TODO - Pinch Draw Fix

## Goal

Fix pinch gesture behavior so that:

- Move finger = draw/erase (no pinch required)
- Pinch = stop drawing (safety feature)

## Changes Made

### 1. HandDrawingScene.js

- [x] Modify gesture handling to draw on finger movement (no pinch required)
- [x] Add pinch detection to STOP drawing when pinching
- [x] Update erase mode to work the same way
- [x] Update UI instructions to reflect new behavior

## Implementation Plan

1. **Remove pinch requirement for drawing:**

   - Draw directly when index finger moves
   - Use `drag` gesture from GestureEngine for movement detection

2. **Add pinch as stop mechanism:**

   - When pinch is detected (thumb + index close), stop drawing
   - Only resume drawing when pinch is released

3. **Update legacy fallback code:**

   - Same logic for the fallback single-hand detection

4. **Update UI text:**
   - Change "Pinch & release, then move to draw" to "Move finger to draw"
   - Change "Pinch to erase" to "Move finger to erase"

## New Behavior Summary

| Action | Old Behavior             | New Behavior                |
| ------ | ------------------------ | --------------------------- |
| Draw   | Pinch → Release → Move   | Simply move finger          |
| Erase  | Pinch on cube            | Simply move finger on cube  |
| Stop   | N/A                      | Pinch (thumb + index close) |
| Zoom   | Two hands apart/together | Two hands apart/together    |
