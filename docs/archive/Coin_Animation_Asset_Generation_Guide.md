# SP Coin Animation: AI Image Generation Guide

## Overview
This document provides detailed prompts for generating 6 coin animation frames using AI art tools (NanoBanana, ChatGPT image generation, etc.). The goal is to create a smooth spinning coin animation that conveys rotation through a series of distinct perspective views.

## Technical Specifications
- **Resolution**: 64x64 pixels (matches existing sp_coin.png)
- **File Format**: PNG with transparency
- **Background**: Fully transparent
- **Style**: Match existing SP coin aesthetic (gold/bronze metallic)
- **File Names**: sp_coin_0.png through sp_coin_5.png

## Animation Concept
The coin should appear to spin horizontally (like a coin flip), showing:
1. Front face (static default)
2. Slight rotation showing depth
3. Edge-on view (thin vertical line)
4. Three-quarter back view
5. Back face (reverse of front design)
6. (Optional: could loop back through frames or end at back)

## Design Philosophy
**Consistency**: All frames should clearly be the same coin object
**Readability**: Even at 20x20 display size, rotation should be obvious
**Metallic Shine**: Lighting/highlights should shift with rotation angle
**Fantasy Aesthetic**: Fits RPG theme, slightly stylized rather than photorealistic

## Frame-by-Frame Specifications

### Frame 0: Static Default (sp_coin_0.png)
**Purpose**: Default coin display when not animating
**View**: Straight-on front face
**Description**: 
- Gold/bronze metallic coin
- Central emblem or design (consider: star, crown, "S" monogram, or abstract fantasy symbol)
- Subtle texture or pattern around edge
- Slight highlight on upper-right to show dimensionality
- Clean, crisp edges

**AI Prompt Template**:
```
A golden fantasy coin viewed directly from the front, 64x64 pixels, transparent background. The coin has a polished metallic surface with a [STAR/CROWN/EMBLEM] in the center. Subtle engravings or patterns around the outer edge. Slight highlight on the upper portion suggesting top-right light source. RPG game icon style, clear and readable at small sizes.
```

### Frame 1: Slight Rotation (sp_coin_1.png)
**Purpose**: First animation frame showing initial rotation
**View**: 15-20 degree rotation from front
**Description**:
- Same coin beginning to turn
- Central emblem still mostly visible but slightly compressed
- One edge starting to show thickness
- Highlight begins shifting with rotation
- Subtle perspective distortion

**AI Prompt Template**:
```
The same golden fantasy coin rotated approximately 15 degrees, showing slight perspective. The [EMBLEM] is beginning to compress horizontally. The left edge of the coin shows a hint of thickness. Metallic surface reflects light differently than the front view. 64x64 pixels, transparent background, RPG game icon style.
```

### Frame 2: Quarter Turn (sp_coin_2.png)
**Purpose**: Mid-rotation showing obvious movement
**View**: 45-degree rotation, elliptical appearance
**Description**:
- Coin clearly rotated, oval/elliptical shape
- Central emblem compressed to about 50% width
- Both edges visible showing thickness
- Highlight more concentrated on exposed edge
- Clearly different from front view

**AI Prompt Template**:
```
The golden fantasy coin rotated 45 degrees, appearing elliptical/oval in shape. The [EMBLEM] is horizontally compressed. Both edges of the coin are visible showing metallic thickness. The surface shows a gradient of light as it curves away. 64x64 pixels, transparent background, RPG game icon style.
```

### Frame 3: Edge-On (sp_coin_3.png)
**Purpose**: Dramatic peak of animation
**View**: 90-degree rotation, pure edge view
**Description**:
- Coin seen from the side as a thin vertical line/rectangle
- Width should be about 4-6 pixels maximum
- Shows full thickness/height of coin
- Metallic edge catches light (gold/bronze highlight)
- Most dramatic perspective change

**AI Prompt Template**:
```
The golden fantasy coin viewed exactly from the edge, appearing as a thin vertical metallic line approximately 4-6 pixels wide. Shows the full height of the coin with golden metallic edge reflecting light. 64x64 pixels, transparent background, RPG game icon style. The thinnest view of the coin.
```

### Frame 4: Three-Quarter Back (sp_coin_4.png)
**Purpose**: Reveals back side, mirrors Frame 2 geometry
**View**: 135-degree rotation (or 45-degrees from back)
**Description**:
- Elliptical shape like Frame 2 but mirrored
- Beginning to show the back face design
- Back emblem/design horizontally compressed
- Edges visible but perspective flipped from Frame 2
- Lighting shifts to opposite side

**AI Prompt Template**:
```
The golden fantasy coin rotated to show the back face at 45 degrees. Elliptical/oval shape similar to the quarter-turn view but showing the reverse side. The back design [SAME EMBLEM or DIFFERENT REVERSE DESIGN] is horizontally compressed. 64x64 pixels, transparent background, RPG game icon style.
```

### Frame 5: Full Back View (sp_coin_5.png)
**Purpose**: Completes flip animation showing reverse
**View**: 180-degree rotation, straight-on back face
**Description**:
- Straight-on view like Frame 0 but showing back
- Could have same emblem as front, or different back design
- Mirror image of Frame 0's composition
- Same lighting direction for consistency
- Completes the "flip" cycle

**AI Prompt Template**:
```
The golden fantasy coin viewed directly from the back/reverse side, 64x64 pixels, transparent background. Shows the reverse face with [SAME EMBLEM or ALTERNATE DESIGN like text/pattern/different symbol]. Mirror composition of the front view. Polished metallic surface with highlight in same position. RPG game icon style, clear and readable at small sizes.
```

## Design Variations to Consider

### Option A: Symmetrical Coin
- Front and back are identical (Frame 0 = Frame 5)
- Animation loops seamlessly
- Simpler to create
- Still reads as spinning due to intermediate frames

### Option B: Distinct Back Face
- Front has emblem, back has text/number/different symbol
- More visual interest
- Shows "both sides" of the coin literally
- Slightly more complex

### Option C: Progressive Shine
- Same design throughout
- Lighting/highlight shifts dramatically with rotation
- Emphasizes the metallic spinning effect
- Focus on material properties over design variety

## Implementation Notes

### Testing the Frames
After generation:
1. Place all 6 images in resource pack
2. Manually cycle through frame numbers to verify smooth transition
3. Check readability at 20x20 display size
4. Verify transparency renders correctly

### Common AI Generation Issues
- **Inconsistent sizing**: May need manual cropping/alignment
- **Background not transparent**: May need manual removal
- **Perspective inconsistency**: Regenerate frames that don't match rotation progression
- **Too much detail**: Simplify if emblem becomes unreadable when rotated
- **Frame 3 too thick**: Edge view should be very thin (4-6 pixels)

### Iteration Strategy
1. Generate Frame 0 first, get it perfect
2. Use Frame 0 as reference for all other frames
3. Generate Frame 3 (edge) next as the most distinct
4. Fill in intermediate frames (1, 2, 4, 5)
5. Test animation loop before committing

## Quality Checklist
- [ ] All frames are exactly 64x64 pixels
- [ ] Transparent backgrounds on all frames
- [ ] Coin object is centered and consistent size
- [ ] Rotation progression is smooth and obvious
- [ ] Readable at 20x20 display size
- [ ] Metallic/reflective quality is consistent
- [ ] Lighting direction is consistent across frames
- [ ] No artifacts or rough edges
- [ ] Files named correctly (sp_coin_0 through sp_coin_5)

## Example Prompt Workflow (ChatGPT/NanoBanana)

**Session Start**:
```
I need to create 6 frames of a spinning gold coin for a Minecraft RPG interface. Each frame should be 64x64 pixels with transparent background. The coin is metallic gold/bronze with a [YOUR EMBLEM] in the center. I'll request each frame separately, showing progressive rotation from front view to edge view to back view. Style should be fantasy RPG game icon, clear and simple enough to read at 20x20 pixels.
```

**Then request each frame individually using the templates above**, adjusting emblem details as needed.

## Recommended Emblem Options
- **Star**: Classic RPG currency symbol
- **Crown**: Fits "SuperQuester" fantasy theme
- **"S" Monogram**: Branded to "Super Points"
- **Gem/Jewel**: Center focal point, catches light well
- **Abstract Swirl**: Stylized, less literal
- **Roman Numeral**: Suggests value/prestige

Choose based on overall SuperQuester aesthetic and what generates best with your AI tools.
