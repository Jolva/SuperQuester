# Custom Icon System — Implementation Handoff

## Overview

We've designed a custom icon system using Bedrock's bitmap font mechanism. The user has created a sprite sheet with 18 icons. This document tells you how to wire it up.

## Assets Ready

### 1. Sprite Sheet (User Will Provide)
- **File**: `glyph_E1.png`
- **Dimensions**: 512×512 pixels
- **Grid**: 8×8 cells, each 64×64 pixels
- **Location**: Place at `packs/QuestSystemRP/font/glyph_E1.png`

### 2. Font Mapping (Provided)
- **File**: `default8.json` (attached)
- **Location**: Place at `packs/QuestSystemRP/font/default8.json`

### 3. Icon Constants (Provided)
- **File**: `icons.js` (attached)
- **Location**: Place at `packs/QuestSystemBP/scripts/icons.js`

## Resource Pack Setup

Ensure folder structure:
```
packs/QuestSystemRP/
├── font/
│   ├── default8.json      ← Mapping file
│   └── glyph_E1.png       ← Sprite sheet
├── manifest.json
└── pack_icon.png
```

### Verify RP Manifest
Make sure `packs/QuestSystemRP/manifest.json` has a unique UUID and the RP is linked to the world.

## Code Changes

### 1. Import Icons in main.js

```javascript
import { ICONS, getIconForCategory } from "./icons.js";
```

### 2. Update updateQuestHud Function

Replace the current emoji-based icon selection:

```javascript
// OLD CODE — REMOVE THIS
let icon = "⚔️";
if (questState.type === "mine") icon = "⛏️";
if (questState.type === "gather") icon = "🎒";
```

With category-based icon lookup and rarity-colored text:

```javascript
// NEW CODE
const icon = getIconForCategory(questState.category) || ICONS.ALERT;

// Determine text color based on rarity
let textColor = "§7"; // Common: gray
if (questState.rarity === "legendary") textColor = "§6"; // Legendary: gold
else if (questState.rarity === "rare") textColor = "§b"; // Rare: aqua

player.onScreenDisplay?.setActionBar?.(
  `${icon} ${textColor}${questState.title}: ${questState.progress}/${questState.goal}§r`
);
```

### 3. Category Propagation (Already Fixed)

The `QuestGenerator.js` now propagates the `category` field from the data pools:

```javascript
// In generateKillQuest():
return {
  // ...
  category: target.category, // For icon system lookup
  // ...
};

// In generateGatherQuest():
const quest = {
  // ...
  category: target.category, // For icon system lookup
  // ...
};
```

Categories in `QuestData.js`:
- **MOB_POOL**: `undead`, `beast`, `monster`
- **ITEM_POOL**: `gathering`, `mining`, `farming`

## Rarity Badge Icons

The rarity icons (`ICONS.LEGENDARY`, `ICONS.RARE`) are reserved for **UI display only**:

| Icon | Constant | Usage |
|------|----------|-------|
| `\uE10B` | `ICONS.LEGENDARY` | Quest list / details UI |
| `\uE10C` | `ICONS.RARE` | Quest list / details UI |

Action bar uses **text color** to indicate rarity instead, keeping the HUD clean.

## Icon Reference

| Character | Constant | Icon | Usage |
|-----------|----------|------|-------|
| `\uE100` | `ICONS.SKULL` | Skull | `undead` category |
| `\uE101` | `ICONS.CLAW` | Claw | `beast` category |
| `\uE102` | `ICONS.EVIL_EYE` | Evil Eye | `monster` category |
| `\uE103` | `ICONS.FEATHER` | Feather | `passive` category |
| `\uE104` | `ICONS.PORTAL` | Portal | `nether` category |
| `\uE105` | `ICONS.WATER_DROP` | Water Drop | `aquatic` category |
| `\uE106` | `ICONS.LOGS` | Logs | `gathering` category |
| `\uE107` | `ICONS.PICKAXE` | Pickaxe | `mining` category |
| `\uE108` | `ICONS.WHEAT` | Wheat | `farming` category |
| `\uE109` | `ICONS.REFRESH` | Refresh | Reroll button |
| `\uE10A` | `ICONS.CHECKMARK` | Checkmark | Quest complete |
| `\uE10B` | `ICONS.LEGENDARY` | Legendary | Rarity badge (UI only) |
| `\uE10C` | `ICONS.RARE` | Rare | Rarity badge (UI only) |
| `\uE10D` | `ICONS.CLOCK` | Clock | Timer display |
| `\uE10E` | `ICONS.TROPHY` | Trophy | Jackpot |
| `\uE10F` | `ICONS.ALERT` | Exclamation | Alert / fallback |
| `\uE110` | `ICONS.SP_COIN` | SP Coin | Currency |
| `\uE111` | `ICONS.CROWN` | Crown | Future use |

## Testing

1. Load into world with RP active
2. Accept a kill quest (e.g., zombie) → Should show skull icon in action bar
3. Accept a mining quest → Should show pickaxe icon
4. Accept a farming quest → Should show wheat icon
5. Accept/generate a **legendary** quest → Title text should be gold (`§6`)
6. Accept/generate a **rare** quest → Title text should be aqua (`§b`)
7. Verify icons render at correct size (not squished or stretched)

## Troubleshooting

**Icons show as boxes or missing texture:**
- Verify `glyph_E1.png` is in `packs/QuestSystemRP/font/`
- Verify `default8.json` is in `packs/QuestSystemRP/font/`
- Check RP is enabled in world settings
- Restart Minecraft completely (not just reload world)

**Icons show but wrong image:**
- Check sprite sheet grid alignment (64px cells)
- Verify JSON coordinates match sprite positions

**Icons squished/wrong aspect:**
- Sprite sheet must be exactly 512×512
- Each cell must be exactly 64×64

**Category icon not appearing:**
- Verify `category` field exists on the quest object
- Check `getIconForCategory()` mapping in `icons.js` includes all categories
