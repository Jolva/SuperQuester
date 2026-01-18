# Phase 5: Add Coin Icon

## Objective

Add the SP coin icon next to the number to complete the mockup vision.

**This is the final phase!**

---

## Context

Current state:
- Gold `152` in lower-right ✅
- Sidebar removed ✅
- Title bridge working ✅

Target state:
- Coin icon + number side by side
- Matches the original mockup

---

## Implementation

### Update `hud_screen.json`

Replace the contents of `packs/QuestSystemRP/ui/hud_screen.json`:

```json
{
    "namespace": "hud",

    "sp_coin_icon": {
        "type": "image",
        "texture": "textures/quest_ui/sp_coin",
        "size": [20, 20],
        "layer": 100
    },

    "sp_value_label": {
        "type": "label",
        "text": "#text",
        "color": [1.0, 0.85, 0.0],
        "font_size": "large",
        "font_type": "default",
        "shadow": true,
        "layer": 100,
        "bindings": [
            {
                "binding_name": "#hud_title_text_string",
                "binding_type": "global"
            },
            {
                "binding_type": "view",
                "source_property_name": "('§z' + (#hud_title_text_string - 'SPVAL:'))",
                "target_property_name": "#text"
            }
        ]
    },

    "sp_hud_panel": {
        "type": "stack_panel",
        "orientation": "horizontal",
        "size": ["100%c", "100%c"],
        "anchor_from": "bottom_right",
        "anchor_to": "bottom_right",
        "offset": [-10, -55],
        "layer": 100,
        "controls": [
            { "coin@hud.sp_coin_icon": {} },
            { 
                "spacer": {
                    "type": "panel",
                    "size": [4, 0]
                }
            },
            { "value@hud.sp_value_label": {} }
        ]
    },

    "root_panel": {
        "modifications": [
            {
                "array_name": "controls",
                "operation": "insert_front",
                "value": [
                    { "sp_hud_panel@hud.sp_hud_panel": {} }
                ]
            }
        ]
    }
}
```

---

## What's New

| Element | Purpose |
|---------|---------|
| `sp_coin_icon` | Image element displaying the coin texture |
| `sp_value_label` | The number label (moved from previous `sp_display_label`) |
| `sp_hud_panel` | Stack panel that holds coin + spacer + number horizontally |
| `spacer` | 4px gap between coin and number |

### Key Concepts

**Stack Panel:** Automatically arranges children in a row (horizontal) or column (vertical). We use horizontal orientation to place coin and number side by side.

**Size `100%c`:** Means "100% of children" — the panel shrinks to fit its contents rather than expanding.

**Texture Path:** Note there's no `.png` extension — Minecraft finds it automatically.

---

## Texture Verification

Make sure the coin texture exists at:
```
packs/QuestSystemRP/textures/quest_ui/sp_coin.png
```

The `size: [20, 20]` assumes a square icon. Adjust if your texture has different proportions.

---

## Verification Steps

### Test 1: Icon Appears
1. Apply changes, reload world
2. **Expected:** Coin icon visible to the left of the number

### Test 2: Alignment
1. Check that coin and number are vertically centered with each other
2. **Expected:** They should appear on the same baseline, side by side

### Test 3: Spacing
1. Check gap between coin and number
2. **If too close:** Increase spacer size (e.g., `[6, 0]`)
3. **If too far:** Decrease spacer size (e.g., `[2, 0]`)

### Test 4: Position
1. Verify overall position is still good relative to hotbar
2. **If needs adjustment:** Modify `offset` in `sp_hud_panel`

### Test 5: Updates Still Work
1. Run `/scriptevent sq:givesp @s 50`
2. **Expected:** Number updates, coin stays in place

---

## Adjustment Guide

### Icon Size
```json
"size": [20, 20]  // Current - small
"size": [24, 24]  // Medium
"size": [32, 32]  // Large (matches mockup more closely?)
```

### Spacing Between Icon and Number
```json
"size": [4, 0]   // Current - tight
"size": [6, 0]   // Comfortable
"size": [8, 0]   // Roomy
```

### Overall Position
```json
"offset": [-10, -55]  // Current
"offset": [-15, -55]  // More padding from right edge
"offset": [-10, -60]  // Higher above hotbar
```

### Swap Order (Number First, Then Coin)
If you want the number on the left and coin on the right, swap the controls array:
```json
"controls": [
    { "value@hud.sp_value_label": {} },
    { "spacer": { "type": "panel", "size": [4, 0] } },
    { "coin@hud.sp_coin_icon": {} }
]
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| No coin visible | Wrong texture path | Verify path matches actual file location |
| Coin appears but wrong size | Size mismatch | Adjust `size` values |
| Elements stacked vertically | Orientation wrong | Ensure `"orientation": "horizontal"` |
| Coin and number overlap | Stack panel not working | Check `type` is `stack_panel` |
| Everything disappeared | JSON syntax error | Validate JSON, check content log |
| Position shifted | Panel size changed | Adjust offset values |

---

## Definition of Done

- [ ] Coin icon visible
- [ ] Number visible next to coin
- [ ] They're aligned horizontally (side by side)
- [ ] Spacing looks good
- [ ] Position is in lower-right, above hotbar
- [ ] Number still updates when SP changes
- [ ] Matches the mockup vision! 🎉

---

## Known Issues (Carried Forward)

- Brief title flash on SP updates (acceptable)

---

## 🎉 Project Complete Checklist

After Phase 5, verify the full system:

- [ ] SP stored in scoreboard (authoritative)
- [ ] SP backed up in dynamic properties
- [ ] `modifySP()` updates both scoreboard and backup
- [ ] `sq:givesp` admin command works
- [ ] Custom HUD shows coin + SP count
- [ ] HUD updates on SP changes
- [ ] HUD updates on player join
- [ ] Sidebar is gone
- [ ] Works for multiple players independently
- [ ] Survives world reload

**You did it!** From "is this even possible?" to a working custom HUD. The "whole ass" approach paid off.
