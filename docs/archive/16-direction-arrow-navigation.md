# 16-Direction Custom Glyph Arrow Navigation System

**Feature:** Upgrade quest navigation from 8 text arrows to 16 custom PNG glyph arrows
**Branch:** `feat/superquester-encounter-system`
**Status:** Implemented

---

## Overview

Replaced the 8 Unicode text arrows with 16 custom PNG glyph arrows for smoother, more precise navigation feedback in the action bar.

**Before:** `Zombie Siege | Travel to zone | ↗ 54m` (8 directions, 45° bins)
**After:** `Zombie Siege | Travel to zone | [custom glyph] 54m` (16 directions, 22.5° bins)

---

## Files Modified

| Action | File |
|--------|------|
| CREATE | `packs/QuestSystemRP/font/glyph_E1.png` |
| MODIFY | `packs/QuestSystemBP/scripts/systems/EncounterProximity.js` |

---

## Glyph Spritesheet

**File:** `packs/QuestSystemRP/font/glyph_E1.png`

A 256x256 transparent PNG spritesheet with 16x16 pixel cells. The 16 arrow PNGs are placed in row 0, columns 0-15.

**Source PNGs:** `packs/QuestSystemRP/textures/quest_ui/arrow_*.png`

| Unicode | Grid Pos | Source File | Pixel X | Pixel Y |
|---------|----------|-------------|---------|---------|
| `\uE100` | 0,0 | arrow_000_n.png | 0 | 0 |
| `\uE101` | 0,1 | arrow_022_nne.png | 16 | 0 |
| `\uE102` | 0,2 | arrow_045_ne.png | 32 | 0 |
| `\uE103` | 0,3 | arrow_067_ene.png | 48 | 0 |
| `\uE104` | 0,4 | arrow_090_e.png | 64 | 0 |
| `\uE105` | 0,5 | arrow_112_ese.png | 80 | 0 |
| `\uE106` | 0,6 | arrow_135_se.png | 96 | 0 |
| `\uE107` | 0,7 | arrow_157_sse.png | 112 | 0 |
| `\uE108` | 0,8 | arrow_180_s.png | 128 | 0 |
| `\uE109` | 0,9 | arrow_202_ssw.png | 144 | 0 |
| `\uE10A` | 0,10 | arrow_225_sw.png | 160 | 0 |
| `\uE10B` | 0,11 | arrow_247_wsw.png | 176 | 0 |
| `\uE10C` | 0,12 | arrow_270_w.png | 192 | 0 |
| `\uE10D` | 0,13 | arrow_292_wnw.png | 208 | 0 |
| `\uE10E` | 0,14 | arrow_315_nw.png | 224 | 0 |
| `\uE10F` | 0,15 | arrow_337_nnw.png | 240 | 0 |

**How Bedrock glyph files work:**
- Filename `glyph_E1.png` → Unicode range `\uE1XX`
- Grid position determines character: row×16 + column = XX (hex)
- Row 0, Column 0 = `\uE100`; Row 0, Column 15 = `\uE10F`

---

## Code Changes

### DIRECTION_ARROWS Constant

**File:** `packs/QuestSystemBP/scripts/systems/EncounterProximity.js`

```javascript
const DIRECTION_ARROWS = {
  N:   "\uE100",  // 0° - ahead
  NNE: "\uE101",  // 22.5°
  NE:  "\uE102",  // 45°
  ENE: "\uE103",  // 67.5°
  E:   "\uE104",  // 90° - right
  ESE: "\uE105",  // 112.5°
  SE:  "\uE106",  // 135°
  SSE: "\uE107",  // 157.5°
  S:   "\uE108",  // 180° - behind
  SSW: "\uE109",  // 202.5° / -157.5°
  SW:  "\uE10A",  // 225° / -135°
  WSW: "\uE10B",  // 247.5° / -112.5°
  W:   "\uE10C",  // 270° / -90° - left
  WNW: "\uE10D",  // 292.5° / -67.5°
  NW:  "\uE10E",  // 315° / -45°
  NNW: "\uE10F"   // 337.5° / -22.5°
};
```

### getDirectionArrow() Function

Uses 16-direction logic with 22.5° bins (±11.25° boundaries).

---

## Angle Bin Reference

| Direction | Center | Range |
|-----------|--------|-------|
| N (ahead) | 0° | -11.25° to 11.25° |
| NNE | 22.5° | 11.25° to 33.75° |
| NE | 45° | 33.75° to 56.25° |
| ENE | 67.5° | 56.25° to 78.75° |
| E (right) | 90° | 78.75° to 101.25° |
| ESE | 112.5° | 101.25° to 123.75° |
| SE | 135° | 123.75° to 146.25° |
| SSE | 157.5° | 146.25° to 168.75° |
| S (behind) | 180° | 168.75° to -168.75° |
| SSW | -157.5° | -168.75° to -146.25° |
| SW | -135° | -146.25° to -123.75° |
| WSW | -112.5° | -123.75° to -101.25° |
| W (left) | -90° | -101.25° to -78.75° |
| WNW | -67.5° | -78.75° to -56.25° |
| NW | -45° | -56.25° to -33.75° |
| NNW | -22.5° | -33.75° to -11.25° |

---

## Testing

### Test 1: Glyph Display
Run in-game to verify all glyphs render correctly.

### Test 2: Navigation Accuracy
1. Accept an encounter quest
2. Face directly toward the target → should show N arrow (E100)
3. Slowly rotate right → arrows should transition smoothly through all 16 directions
4. Verify arrow updates every 22.5° of rotation

### Test 3: Action Bar Format
Confirm display format remains: `§6[Name] §7| §f[Status] §7| §e[arrow] §f[distance]m`

---

## Rollback

If issues occur, revert `DIRECTION_ARROWS` and `getDirectionArrow()` to original 8-direction Unicode arrows. The `glyph_E1.png` file can remain (unused glyphs cause no harm).
