# Super Points HUD Display - Architecture Overview (REVISED)

## Goal

Replace the vanilla scoreboard sidebar with a custom HUD element in the lower-right corner showing a coin icon and the player's SP count—matching the mockup design.

![Mockup Reference: Gold coin icon with "SP: 20" in lower right, near hotbar]

---

## Why This Approach

JSON UI cannot directly read from Script API dynamic properties or even specific scoreboard objectives. However, it **can** bind to title text. We use the title command as a "data bridge" between Script API and JSON UI.

```
┌─────────────┐    runCommandAsync    ┌─────────────┐      binding       ┌─────────────┐
│  Script API │  ─────────────────►   │   Bedrock   │  ───────────────►  │   JSON UI   │
│  (SP data)  │      titleraw         │   Engine    │  #hud_title_text   │ (HUD display)│
└─────────────┘                       └─────────────┘                    └─────────────┘
```

---

## Display Slot Clarification

Minecraft Bedrock has multiple on-screen text display areas. This system uses:

| Slot | Current Use | This Project |
|------|-------------|--------------|
| **Title** | Unused | SP data bridge (SPVAL:XX) |
| **ActionBar** | Quest progress display | No change |
| **Sidebar** | SP leaderboard (★ SP) | Remove in Phase 4 |

The title and actionbar slots are independent—quest progress ("Mine Stone: 3/10") will continue working alongside the SP display.

---

## Implementation Phases

### Phase 1: Script API Sends Visible Title
**Owner:** AntiGravity  
**Status:** Not Started

Script API sends the player's SP value via `titleraw` command with a recognizable prefix. Title is intentionally visible for verification.

**Key Implementation Notes:**
- Use `runCommandAsync()` (not `runCommand`)
- Wrap in try/catch for edge cases
- Keep sidebar visible (do NOT remove yet)

**Deliverable:** When SP changes (or on spawn), player sees title text `SPVAL:20`

**Verification:** Title visible AND sidebar still shows same SP value

---

### Phase 2: JSON UI Binds to Title Text
**Owner:** Joe (JSON UI) + AntiGravity (review)  
**Status:** Not Started

Create `hud_screen.json` in resource pack with a label element bound to `#hud_title_text_string`.

**Files to Create/Modify:**
- Create `RP/ui/hud_screen.json`
- Modify `RP/ui/_ui_defs.json` to register it

**Deliverable:** A visible label on the HUD (top-left, bright red, obvious) that mirrors the title text

**Verification:** Both the title AND the JSON UI label show `SPVAL:20`

---

### Phase 2.5: String Extraction Validation ⚠️ CHECKPOINT
**Owner:** Joe (JSON UI)  
**Status:** Not Started

**This is a critical validation checkpoint before proceeding.**

Test the string manipulation binding to strip "SPVAL:" prefix:

```json
{
    "binding_type": "view",
    "source_property_name": "(#hud_title_text_string - 'SPVAL:')",
    "target_property_name": "#text"
}
```

**Why this checkpoint exists:** Bedrock JSON UI's string manipulation is limited and not always well-documented. The subtraction operator for strings is shown on Bedrock Wiki but may have quirks. We validate this works BEFORE investing time in positioning and styling.

**Deliverable:** Label shows just `20` (not `SPVAL:20`)

**If it fails:** 
- Try alternative syntax: `('§z' + (#hud_title_text_string - 'SPVAL:'))`
- Try contains() based visibility conditions
- Consider changing prefix format
- Worst case: display full string and style around it

---

### Phase 3: Make Title Invisible
**Owner:** AntiGravity  
**Status:** Not Started

Change title fade parameters to minimize visibility while JSON UI still receives the data.

**Change:**
```javascript
// From (visible):
player.runCommandAsync(`titleraw @s times 10 40 10`);

// To (invisible):
player.runCommandAsync(`titleraw @s times 0 1 0`);
```

**Deliverable:** No visible title flash, JSON UI label still displays correctly

**Verification:** SP number visible in JSON UI label, no title text appearing on screen

---

### Phase 4: Remove Sidebar & Position HUD Element
**Owner:** AntiGravity (sidebar) + Joe (JSON UI positioning)  
**Status:** Not Started

**AntiGravity:** Remove the sidebar display:
```javascript
// REMOVE or comment out this line:
world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective });
```

**Joe:** Reposition the JSON UI label:
- Move to lower-right corner
- Anchor appropriately relative to hotbar
- Apply styling (font size, color, shadow)

**Deliverable:** SP number appears in correct screen position, sidebar is gone

**Verification:** Number in lower-right, no sidebar visible, value still updates correctly

---

### Phase 5: Add Coin Icon
**Owner:** Joe (JSON UI)  
**Status:** Not Started

Add image element using existing coin texture (`textures/quest_ui/sp_coin.png`), position adjacent to the number.

**Deliverable:** Final HUD matches mockup—coin icon + SP count in lower right

**Verification:** Looks like the mockup, updates correctly, survives rejoin

---

## Technical Components

### Script API Side

**File:** `scripts/main.js`

**New Function:** `updateSPDisplay(player)`

```javascript
function updateSPDisplay(player) {
    const sp = getSP(player);
    
    try {
        // Set timing (Phase 1: visible, Phase 3: invisible)
        player.runCommandAsync(`titleraw @s times 10 40 10`);
        
        // Send SP value with prefix for JSON UI to parse
        player.runCommandAsync(`titleraw @s title {"rawtext":[{"text":"SPVAL:${sp}"}]}`);
    } catch (e) {
        console.warn(`[SuperQuester] Failed to update SP display for ${player.name}: ${e}`);
    }
}
```

**Trigger Points (Event-Driven):**
- End of `modifySP()` function
- After `initializePlayerSP()` in spawn handler (with 1 second delay)

**Note:** Start with event-driven only. Add periodic interval only if JSON UI misses updates during testing.

### Resource Pack Side

**File:** `RP/ui/hud_screen.json`

**New Elements:**
- `sp_hud_panel` - Container panel, anchored bottom-right
- `sp_coin_icon` - Image element with coin texture  
- `sp_value_label` - Label bound to title text with string extraction

**Key Bindings:**
```json
{
    "binding_name": "#hud_title_text_string",
    "binding_type": "global"
}
```

**String Extraction (to be validated in Phase 2.5):**
```json
{
    "binding_type": "view",
    "source_property_name": "(#hud_title_text_string - 'SPVAL:')",
    "target_property_name": "#text"
}
```

---

## File Changes Summary

| File | Phase | Change Type | Description |
|------|-------|-------------|-------------|
| `scripts/main.js` | 1 | Modify | Add `updateSPDisplay()` function and calls |
| `RP/ui/hud_screen.json` | 2 | Create | Custom HUD element definitions |
| `RP/ui/_ui_defs.json` | 2 | Modify | Register hud_screen.json |
| `scripts/main.js` | 3 | Modify | Change title times to 0/1/0 |
| `scripts/main.js` | 4 | Modify | Remove sidebar display call |

**Existing Assets (no changes needed):**
- `RP/textures/quest_ui/sp_coin.png` — Coin icon texture

---

## Risks & Mitigations

| Risk | Likelihood | Phase | Mitigation |
|------|------------|-------|------------|
| `runCommandAsync` fails silently | Low | 1 | Try/catch with logging |
| Title text causes visible flicker | Medium | 3 | Test fade 0/1/0 timing carefully |
| String extraction doesn't work | Medium | 2.5 | **Checkpoint exists specifically for this** |
| Other titles (achievements) interfere | Low | 3+ | Use unique prefix, test with achievements |
| JSON UI binding doesn't update | Medium | 2 | Validate binding before proceeding |
| Performance impact from commands | Low | 1+ | Event-driven only, no interval |

---

## Sidebar Transition Plan

| Phase | Sidebar Status | Why |
|-------|---------------|-----|
| 1 | ✅ Visible | Verify title shows correct value by comparing |
| 2 | ✅ Visible | Verify JSON UI shows correct value by comparing |
| 2.5 | ✅ Visible | Validate string extraction works |
| 3 | ✅ Visible | Verify invisible title still feeds JSON UI |
| 4 | ❌ Removed | Only after JSON UI display confirmed working |
| 5 | ❌ Gone | Final state |

**The sidebar is our safety net.** We don't remove it until we're confident the replacement works.

---

## Rollback Plan

If this approach fails at any phase:

1. **Re-enable vanilla sidebar** (if removed):
   ```javascript
   world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective });
   ```

2. **Remove JSON UI modifications:**
   - Delete `RP/ui/hud_screen.json`
   - Revert `RP/ui/_ui_defs.json`

3. **Remove title sending code:**
   - Remove `updateSPDisplay()` function
   - Remove calls from `modifySP()` and spawn handler

4. **Revert title times** (if changed):
   - No action needed, removing the function handles this

The vanilla sidebar display (currently working) remains our fallback throughout.

---

## Success Criteria

- [ ] Coin icon visible in lower-right corner
- [ ] SP value displays next to coin
- [ ] Value updates when player earns SP (quest completion)
- [ ] Value updates when player spends SP (paid reroll)
- [ ] No visible title text flashing
- [ ] Works for each player independently (shows their own SP)
- [ ] Quest progress actionbar still works normally
- [ ] Minimal performance impact
- [ ] Survives world reload / player rejoin
- [ ] Works on multiple connected players simultaneously

---

## Questions for AntiGravity

1. ~~Is there already a central place where we could hook `updateSPDisplay()` after SP changes?~~ 
   **Answer:** Yes, end of `modifySP()` function.

2. Any concerns about `runCommandAsync()` frequency? (We're doing event-driven only, not interval)

3. The spawn handler at line ~177 calls `initializePlayerSP()` — can you add the display update call there with a 1-second delay?

4. Preferred prefix format? Current plan uses `SPVAL:` — any reason to change it?
