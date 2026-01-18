# Phase 1: Script API Sends Visible Title (REVISED)

## Objective

Implement a function that sends the player's current SP value to them via `titleraw` command. In this phase, the title should be **visible** so we can verify the data bridge is working before we make it invisible in Phase 4.

---

## Context

This is the first step in building a custom HUD element to display Super Points. JSON UI can bind to title text, so we're using `titleraw` as a data bridge between Script API and the UI layer.

**Why titleraw?** Regular `title` commands don't give us the control we need. `titleraw` accepts rawtext JSON which ensures consistent formatting.

**Important:** The vanilla sidebar remains visible during this phase. We won't remove it until Phase 4 confirms the JSON UI display works correctly.

---

## Implementation

### New Function: `updateSPDisplay(player)`

```javascript
/**
 * Sends the player's current SP value via title for HUD display.
 * JSON UI will bind to this title text to show a custom SP counter.
 * 
 * @param {Player} player - The player to update
 */
function updateSPDisplay(player) {
    const sp = getSP(player);
    
    try {
        // Set title display times first (ticks: fade_in, stay, fade_out)
        // Phase 1: Visible timing for verification (0.5s in, 2s stay, 0.5s out)
        // Phase 4 will change this to 0, 1, 0 to make it invisible
        player.runCommandAsync(`titleraw @s times 10 40 10`);
        
        // Send title with SP value
        // Format: "SPVAL:<number>" - JSON UI will strip the prefix
        player.runCommandAsync(`titleraw @s title {"rawtext":[{"text":"SPVAL:${sp}"}]}`);
    } catch (e) {
        // Player may not be fully loaded or in a state to receive commands
        console.warn(`[SuperQuester] Failed to update SP display for ${player.name}: ${e}`);
    }
}
```

### Important API Note

**Use `runCommandAsync()` not `runCommand()`!** 

The Script API uses async command execution. The current codebase already uses `runCommandAsync()` for scoreboard identity creation, so this is consistent with existing patterns.

### When to Call

**1. After SP modifications** — Add to the existing `modifySP()` function:

```javascript
function modifySP(player, delta) {
    // ... existing SP modification logic ...
    
    // Update scoreboard
    objective.setScore(player, newBalance);
    
    // Update backup in dynamic properties
    const data = getPlayerQuestData(player);
    data.currentSP = newBalance;
    savePlayerQuestData(player, data);
    
    // NEW: Update HUD display
    updateSPDisplay(player);
    
    return newBalance;
}
```

**2. On player spawn** — Add after `initializePlayerSP()` in the existing spawn handler:

```javascript
// In the existing playerSpawn.subscribe handler (around line 177)
world.afterEvents.playerSpawn.subscribe((event) => {
    if (event.initialSpawn) {
        const player = event.player;
        
        // Existing SP initialization
        initializePlayerSP(player);
        
        // NEW: Update HUD display after a short delay
        // Delay ensures player is fully loaded and can receive title commands
        system.runTimeout(() => {
            updateSPDisplay(player);
        }, 20); // 1 second delay
    }
});
```

**Note:** If the spawn handler structure differs, the key point is: call `updateSPDisplay(player)` shortly after `initializePlayerSP(player)` completes, with a ~1 second delay.

---

## What NOT to Change (Yet)

**Keep the sidebar visible!** Do NOT remove or comment out this line:

```javascript
world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective });
```

The sidebar remains our fallback and visual reference during Phases 1-3. We'll remove it in Phase 4 only after confirming the JSON UI display works.

---

## Slot Clarification

This implementation uses the **title** slot. The existing quest progress display uses the **actionbar** slot:

```javascript
// Existing code - uses ACTIONBAR (different slot, no conflict)
player.onScreenDisplay?.setActionBar?.(`${textColor}${questState.title}...`);
```

These are separate display areas and will not interfere with each other:
- **ActionBar:** Quest progress ("Mine Stone: 3/10")
- **Title:** SP data bridge ("SPVAL:50") — will become invisible in Phase 4

---

## Verification Steps

### Test 1: Manual SP Grant
1. Join the world
2. Run `/scriptevent sq:givesp @s 50`
3. **Expected:** Title appears on screen showing `SPVAL:50`
4. **Also visible:** Sidebar still shows "★ SP" with your score

### Test 2: Quest Completion
1. Complete a quest that awards SP
2. **Expected:** Title appears showing `SPVAL:<new total>`

### Test 3: Paid Reroll
1. Have enough SP to afford a reroll
2. Use a paid reroll
3. **Expected:** Title appears showing `SPVAL:<reduced total>`

### Test 4: Player Join
1. Leave the world completely
2. Rejoin the world
3. **Expected:** ~1 second after spawning, title appears showing current SP

### Test 5: Multiple Players (if possible)
1. Have two players in the world
2. Give SP to one player: `/scriptevent sq:givesp PlayerName 25`
3. **Expected:** Only that player sees the title update
4. **Verify:** Other player's display is unaffected

---

## Files to Modify

| File | Changes |
|------|---------|
| `scripts/main.js` | Add `updateSPDisplay()` function |
| `scripts/main.js` | Add `updateSPDisplay(player)` call at end of `modifySP()` |
| `scripts/main.js` | Add `updateSPDisplay(player)` call in spawn handler after `initializePlayerSP()` |

---

## Error Handling

The try/catch in `updateSPDisplay()` handles cases where:
- Player entity isn't fully loaded
- Player is in a dimension transition
- Player is disconnecting
- Any other edge case where commands can't be sent

Errors are logged but don't break the SP system—the scoreboard update still happens regardless of display update success.

---

## Definition of Done

- [ ] `updateSPDisplay(player)` function exists with try/catch wrapper
- [ ] Function uses `runCommandAsync()` (not `runCommand`)
- [ ] Function is called after SP modifications in `modifySP()`
- [ ] Function is called on player initial spawn (with delay)
- [ ] Title visibly appears with format `SPVAL:<number>`
- [ ] Number shown matches actual SP balance (verify against sidebar)
- [ ] Sidebar still visible and functioning (NOT removed)
- [ ] Works for multiple players independently
- [ ] No console errors during normal operation

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| No title appears | `runCommandAsync` failing silently | Check console for caught errors |
| Title shows wrong number | `getSP()` returning stale data | Verify scoreboard is updating correctly |
| Title appears for wrong player | Targeting issue | Verify `@s` selector in titleraw |
| Error on player join | Player not ready | Increase delay in spawn handler |
| "runCommand is not a function" | Using wrong API | Change to `runCommandAsync` |

---

## Next Phase Preview

Once Phase 1 is verified, Phase 2 creates the JSON UI binding:
- Create `RP/ui/hud_screen.json`
- Add a visible test label bound to `#hud_title_text_string`
- Verify the label shows `SPVAL:XX` matching the title

Phase 2.5 (validation checkpoint) will specifically test string extraction before we proceed to positioning and styling.
