# Phase 4: Position HUD Element + Remove Sidebar

## Objective

1. Move the SP label from top-left to **lower-right** (near hotbar)
2. Style it properly (gold/yellow color, appropriate size)
3. Remove the vanilla sidebar

**This is where it starts looking like the mockup!**

---

## Context

Current state:
- Red `102` in top-left corner ✅
- Title bridge working (with brief flash on updates — acceptable) ✅
- Sidebar still visible in upper-right ✅

Target state:
- Gold/yellow SP number in lower-right, near hotbar
- No sidebar
- Ready for coin icon in Phase 5

---

## Implementation

### Part A: Update JSON UI (`hud_screen.json`)

Replace the contents of `packs/QuestSystemRP/ui/hud_screen.json`:

```json
{
    "namespace": "hud",

    "sp_display_label": {
        "type": "label",
        "text": "#text",
        "color": [1.0, 0.85, 0.0],
        "font_size": "large",
        "font_type": "default",
        "shadow": true,
        "anchor_from": "bottom_right",
        "anchor_to": "bottom_right",
        "offset": [-10, -55],
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

    "root_panel": {
        "modifications": [
            {
                "array_name": "controls",
                "operation": "insert_front",
                "value": [
                    { "sp_display_label@hud.sp_display_label": {} }
                ]
            }
        ]
    }
}
```

**What changed:**
| Property | Before | After | Why |
|----------|--------|-------|-----|
| Element name | `sp_test_label` | `sp_display_label` | Clearer naming |
| `color` | `[1.0, 0.2, 0.2]` (red) | `[1.0, 0.85, 0.0]` (gold) | Match mockup |
| `anchor_from` | `top_left` | `bottom_right` | Position near hotbar |
| `anchor_to` | `top_left` | `bottom_right` | Position near hotbar |
| `offset` | `[10, 10]` | `[-10, -55]` | Fine-tune position |

**Offset explanation:**
- `-10` horizontal = 10 pixels from right edge
- `-55` vertical = 55 pixels up from bottom (above hotbar)

These values may need adjustment based on testing. The hotbar is roughly 40-45 pixels tall.

---

### Part B: Remove Sidebar (`main.js`)

Find and **comment out or remove** the line that sets the sidebar display. It should be in the scoreboard initialization area:

**Find this line (around line 1770 or in scoreboard setup):**
```javascript
world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective });
```

**Comment it out:**
```javascript
// Sidebar removed - SP now displays via custom HUD element
// world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective });
```

**Note:** The scoreboard objective still exists and tracks SP — we're just not displaying it in the sidebar anymore.

---

## File Changes Summary

| File | Change |
|------|--------|
| `packs/QuestSystemRP/ui/hud_screen.json` | Replace contents (new positioning/styling) |
| `scripts/main.js` | Comment out `setObjectiveAtDisplaySlot` line |

---

## Verification Steps

### Test 1: Position Check
1. Apply both changes, reload world
2. **Expected:** Gold number visible in lower-right, above hotbar
3. **Expected:** No sidebar visible

### Test 2: Not Overlapping Hotbar
1. Look at the position relative to hotbar
2. **Expected:** Number is clearly above the hotbar, not overlapping
3. **If overlapping:** Adjust offset Y value (try `-60` or `-65`)

### Test 3: Value Still Updates
1. Run `/scriptevent sq:givesp @s 25`
2. **Expected:** Gold number updates to new value

### Test 4: Different Screen Sizes (if possible)
1. Try resizing window or different device
2. **Check:** Does it stay anchored to bottom-right appropriately?

### Test 5: Sidebar Truly Gone
1. Verify upper-right corner is clean
2. **Expected:** No "★ SP" or player scores visible

---

## Position Adjustment Guide

If the position isn't quite right:

| Issue | Fix |
|-------|-----|
| Too far from edge | Decrease offset values (e.g., `-5` instead of `-10`) |
| Too close to edge | Increase offset values (e.g., `-15` instead of `-10`) |
| Overlapping hotbar | Increase Y offset (e.g., `-65` instead of `-55`) |
| Too high above hotbar | Decrease Y offset (e.g., `-45` instead of `-55`) |
| Want it more centered | Try `anchor_from: "bottom_middle"` with appropriate X offset |

The mockup shows it in the lower-right corner, to the right of the hunger bar. Adjust as needed to match.

---

## Color Reference

Current gold: `[1.0, 0.85, 0.0]`

Other options if you want to tweak:
| Color | RGB Values |
|-------|------------|
| Pure yellow | `[1.0, 1.0, 0.0]` |
| Gold (current) | `[1.0, 0.85, 0.0]` |
| Orange gold | `[1.0, 0.7, 0.0]` |
| Minecraft gold text | `[1.0, 0.67, 0.0]` |

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Number not visible | Off-screen or wrong anchor | Check anchor_from/anchor_to match |
| Still red | Old file cached | Verify file saved, reload world |
| Sidebar still showing | Line not commented | Find and comment the setObjectiveAtDisplaySlot line |
| Number in wrong corner | Anchor mismatch | Both anchors must be `bottom_right` |
| Overlapping other HUD | Offset needs adjustment | Tweak offset values |

---

## Definition of Done

- [ ] SP number displays in lower-right area
- [ ] Color is gold/yellow (not red)
- [ ] Position is above hotbar, not overlapping
- [ ] Sidebar is completely gone
- [ ] Number still updates when SP changes
- [ ] Looks reasonably close to mockup positioning

---

## Known Issue (Carried Forward)

Brief title flash still occurs on SP updates. Acceptable for now — will revisit if it becomes annoying in real gameplay.

---

## Next Phase Preview

**Phase 5: Add Coin Icon**

The final phase! Add the coin image next to the number:
- Create a panel to hold both icon and label
- Add image element with `sp_coin.png`
- Position them side by side

After Phase 5, it should match the mockup exactly!
