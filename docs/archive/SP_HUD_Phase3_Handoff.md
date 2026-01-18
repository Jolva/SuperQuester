# Phase 3: Make Title Invisible

## Objective

Change the title timing parameters so the title text doesn't visibly flash on screen, while JSON UI continues to receive and display the data.

**This is a small, low-risk change.**

---

## Context

Phase 2.5 confirmed:
- String extraction works ✅
- Label shows just `102` (no prefix) ✅
- The `§z` concatenation trick was needed ✅

Currently, the title visibly flashes `SPVAL:102` every time SP changes. We need to make that invisible while keeping the JSON UI label working.

---

## Implementation

### Single Change in `main.js`

Find the `updateSPDisplay()` function and change the timing line:

**Before (Phase 1 - visible):**
```javascript
player.runCommandAsync(`titleraw @s times 10 40 10`);
```

**After (Phase 3 - invisible):**
```javascript
player.runCommandAsync(`titleraw @s times 0 1 0`);
```

**Parameters:** `times <fade_in> <stay> <fade_out>` (in ticks, 20 ticks = 1 second)
- `0` fade in = instant appear
- `1` stay = minimal duration (1 tick = 0.05 seconds)
- `0` fade out = instant disappear

---

## Full Updated Function

```javascript
/**
 * Sends the player's current SP value via title for HUD display.
 * JSON UI will bind to this title text to show a custom SP counter.
 * 
 * @param {import("@minecraft/server").Player} player
 */
function updateSPDisplay(player) {
    const sp = getSP(player);
    
    try {
        // Phase 3: Invisible timing (0 fade in, 1 tick stay, 0 fade out)
        player.runCommandAsync(`titleraw @s times 0 1 0`);
        
        // Send title with SP value - JSON UI strips the prefix
        player.runCommandAsync(`titleraw @s title {"rawtext":[{"text":"SPVAL:${sp}"}]}`);
    } catch (e) {
        console.warn(`[SuperQuester] Failed to update SP display for ${player.name}: ${e}`);
    }
}
```

---

## Verification Steps

### Test 1: No Visible Flash
1. Apply the code change
2. Run `/scriptevent sq:givesp @s 50`
3. **Expected:** 
   - ❌ NO visible title text in center of screen
   - ✅ Red label in top-left updates to new value

### Test 2: JSON UI Still Works
1. Complete a quest or do multiple SP changes
2. **Expected:** Red label continues to update correctly

### Test 3: Player Join
1. Leave and rejoin the world
2. **Expected:** 
   - ❌ No title flash on spawn
   - ✅ Red label shows current SP after ~1.5 seconds

### Test 4: Rapid Changes
1. Run several `/scriptevent sq:givesp @s 1` commands quickly
2. **Expected:** 
   - ❌ No flickering title text
   - ✅ Label updates smoothly

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Title still flashes briefly | Stay time too long | Verify `times 0 1 0` (not `0 10 0`) |
| Label stops updating | Timing too aggressive | Try `times 0 2 0` |
| Label shows stale data | Title not being sent | Check function is still being called |

---

## Definition of Done

- [ ] Title text no longer visibly flashes on screen
- [ ] JSON UI label still shows correct SP value
- [ ] Label still updates when SP changes
- [ ] No visible flash on player join/spawn

---

## Risk Level: Low 🟢

This is purely a timing change. If something goes wrong:
- Revert to `times 10 40 10` to make it visible again
- JSON UI binding is unaffected by this change

---

## Next Phase Preview

**Phase 4: Position HUD Element + Remove Sidebar**

Once the title is invisible, we:
1. Move the label from top-left to lower-right (near hotbar)
2. Style it properly (gold color, appropriate size)
3. Remove the vanilla sidebar (`setObjectiveAtDisplaySlot` call)

That's when it starts looking like the mockup!
