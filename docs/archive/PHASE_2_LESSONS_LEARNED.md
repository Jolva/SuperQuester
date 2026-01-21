# Phase 2: Lessons Learned

**Date:** 2026-01-19
**Phase:** Encounter System Phase 2 (Mob Spawning)
**Status:** Successfully Completed

---

## For Future AI Agents

This document captures critical lessons learned during Phase 2 implementation to help future AI agents avoid the same pitfalls.

---

## Critical Issue #1: Chunk Loading with dimension.spawnEntity()

### The Problem
Spawning entities with `dimension.spawnEntity()` fails with `LocationInUnloadedChunkError` when the target chunk is not loaded.

### When This Happens
- Player accepts quest at quest board (X=72, Z=-278)
- Spawn location is far away (X=180, Z=-307 or even X=102, Z=-278)
- Chunk at spawn location is not loaded
- Spawn fails immediately

### What Doesn't Work
❌ Using `tickingarea add` command alone (not instant)
❌ Spawning immediately after tickingarea command
❌ Hoping the chunk is "close enough" to be loaded

### What DOES Work
✅ Create ticking area with `dimension.runCommand()`
✅ **Wait 1 second** (20 ticks) using `system.runTimeout()`
✅ Then spawn entities

### Code Pattern
```javascript
// Step 1: Create ticking area
dimension.runCommand(`tickingarea add circle ${x} ${y} ${z} 1 encounter_spawn_temp`);

// Step 2: WAIT for chunk to load
system.runTimeout(() => {
  // Step 3: Now spawn entities
  const entity = dimension.spawnEntity(mobType, spawnPos);

  // Step 4: Clean up ticking area
  dimension.runCommand(`tickingarea remove encounter_spawn_temp`);
}, 20); // 20 ticks = 1 second
```

### Why This Matters
Without the delay, **100% of spawns will fail** if the player is at a different location. This is not a "sometimes" bug - it's guaranteed failure.

---

## Critical Issue #2: Safe Zone System Conflicts

### The Problem
The codebase has a safe zone system (`safeZone.js`) that automatically removes hostile mobs within 20 blocks of the quest board.

### How It Manifests
- Encounter mobs spawn successfully
- Safe zone's `entitySpawn` event fires
- Mobs are immediately removed (within same tick)
- Player sees no mobs, quest cannot be completed

### The Trap for AI Agents
This is **extremely hard to debug** because:
- Spawn logs show success: `Spawned 3/3 mobs`
- No error messages appear
- Mobs exist for a fraction of a second
- Players report "mobs not spawning" when they actually ARE spawning

### Detection Method
Look for this log message:
```
[SafeZone] Removing unauthorized hostile: minecraft:skeleton (Cause: ...)
```

If you see this after spawn success logs, the safe zone is removing encounter mobs.

### Solution
Modify `safeZone.js` to check for encounter mob tag BEFORE removal:

```javascript
// In safeZone.js, entitySpawn handler
if (entity.hasTag && entity.hasTag("sq_encounter_mob")) {
  return; // This is an encounter mob - don't remove it
}

if (isHostile(entity.typeId) && isInSafeZone(entity.location)) {
  entity.remove(); // Only remove non-encounter hostiles
}
```

### Where to Add This
File: `packs/QuestSystemBP/scripts/safeZone.js`
Function: `registerSafeZoneEvents()` → `world.afterEvents.entitySpawn.subscribe()`
Line: ~209 (before hostile check)

---

## Critical Issue #3: Asynchronous Spawn Returns Empty Array

### The Problem
Because spawning is now asynchronous (delayed by 1 second), the `spawnEncounterMobs()` function returns an empty array.

### The Code
```javascript
export function spawnEncounterMobs(quest, location, dimension) {
  const spawnedEntityIds = [];

  system.runTimeout(() => {
    // Spawn happens here
    spawnedEntityIds.push(entity.id);
  }, 20);

  return spawnedEntityIds; // Returns EMPTY - spawn hasn't happened yet
}
```

### Impact
- `quest.spawnData.spawnedEntityIds` will be empty array `[]`
- Despawn operations still work (they query by tag, not by ID)
- Entity ID tracking is non-functional in Phase 2

### Why This Is Acceptable
In Phase 2, despawn operations use tag-based queries, not entity IDs:
```javascript
// Despawn doesn't need entity IDs - uses tags instead
const entities = dimension.getEntities({ tags: [`sq_quest_${questId}`] });
```

### Future Consideration for Phase 3+
If you need entity IDs for tracking, you'll need to:
1. Store quest data in a module-level registry
2. Update spawn data AFTER the delayed spawn completes
3. Use `PersistenceManager.saveQuestData()` from within the timeout

---

## Debugging Best Practices

### Always Check Console Logs First
The implementation logs every major operation:
```
[EncounterSpawner] Spawned X/Y mobs for quest <id>
[Encounter] Player <name> killed mob for quest <id> (X/Y)
[Encounter] Quest <id> completed via kill tracking!
[SafeZone] Removing unauthorized hostile: <type> (Cause: ...)
```

If you don't see these logs, the code isn't running.

### Test Location Coordinates Matter
- **Close to quest board:** Easier to find, good for testing
- **Far from quest board:** More realistic, tests chunk loading
- **Phase 2 final:** X=73, Y=75, Z=-278 (1 block from board)

### Spawn Cause Enum Values
When debugging safe zone issues, check spawn cause:
- `"SpawnEgg"` - Player spawned with egg
- `"Command"` - /summon command
- `"Loaded"` - Chunk loaded, mob persisted
- `"Event"` or other - dimension.spawnEntity() (THIS IS WHAT ENCOUNTERS USE)

Safe zone allows `"SpawnEgg"`, `"Command"`, `"Override"` but NOT other causes.
Encounter mobs need tag exception, not cause exception.

---

## Testing Strategy That Worked

### 1. Start Simple
Accept quest → Check spawn logs → Teleport to spawn location

### 2. Iterate Location
- Started at X=180 (too far, hard to find)
- Moved to X=102 (30 blocks, still safe zone issue)
- Ended at X=73 (1 block, perfect for testing)

### 3. Use Debug Commands
```
/scriptevent sq:encounter info    # Check spawn data
/scriptevent sq:encounter count   # Verify mobs alive
/tp 73 75 -278                    # Teleport to spawn
```

### 4. Watch for Quick Wins
If kill tracking works on first kill, the whole system is working.
Don't over-test - move to next phase.

---

## Common Mistakes to Avoid

### ❌ Don't: Spawn Without Delay
```javascript
dimension.runCommand(`tickingarea add ...`);
dimension.spawnEntity(mobType, spawnPos); // FAILS
```

### ✅ Do: Always Wait for Chunk
```javascript
dimension.runCommand(`tickingarea add ...`);
system.runTimeout(() => {
  dimension.spawnEntity(mobType, spawnPos); // WORKS
}, 20);
```

---

### ❌ Don't: Forget Safe Zone Integration
If spawn location is within 20 blocks of quest board, safe zone WILL remove mobs.

### ✅ Do: Add Tag Exception
```javascript
if (entity.hasTag("sq_encounter_mob")) return; // Skip removal
```

---

### ❌ Don't: Debug by Changing Location First
Location changes mask the real issue (chunk loading or safe zone).

### ✅ Do: Fix Root Cause First
1. Add delayed spawn for chunk loading
2. Add safe zone exception for encounter mobs
3. THEN adjust location if needed

---

## Performance Considerations

### Ticking Area Cleanup
Always remove temporary ticking areas after spawn:
```javascript
dimension.runCommand(`tickingarea remove encounter_spawn_temp`);
```

Orphan ticking areas waste server resources.

### Player Iteration for Kill Tracking
Phase 2 iterates all players to find quest owner:
```javascript
for (const player of world.getPlayers()) {
  // Check if this player owns the quest
}
```

This is O(n) where n = player count. Acceptable for small servers (3-10 players).
For 100+ player servers, consider a quest ownership registry.

### Entity Query Efficiency
Tag-based queries are efficient:
```javascript
dimension.getEntities({ tags: ["sq_quest_12345"] })
```

This is much faster than:
```javascript
dimension.getEntities().filter(e => e.getTags().includes("sq_quest_12345"))
```

Always use the tag filter in getEntities() options.

---

## Integration Points for Phase 3

### What Phase 3 Will Replace

**Current (Phase 2):**
```javascript
export function getTestSpawnLocation() {
  return TEST_SPAWN_LOCATION; // Fixed location
}
```

**Phase 3:**
```javascript
export function findValidSpawnLocation(tier, dimension) {
  // 1. Calculate ring distance based on tier
  // 2. Generate random angle
  // 3. Calculate coordinates
  // 4. Validate terrain (no water, lava, leaves)
  // 5. Retry or fallback to safe zones
  return { x, y, z };
}
```

### What Phase 3 Will Keep
- Delayed spawn pattern (20 tick timeout)
- Ticking area creation/cleanup
- Tag-based tracking
- Safe zone exception
- All kill tracking logic
- Turn-in/abandon despawn logic

### What Phase 3 Will Add
- Ring distance calculation (60-120 for rare, 100-200 for legendary)
- Terrain validation (block type checks)
- Fallback coordinates (6 pre-defined safe zones)
- Spawn location logging (for debugging)

---

## Files Modified in Phase 2

### New Files
1. `packs/QuestSystemBP/scripts/systems/EncounterSpawner.js` (318 lines)
   - Complete mob spawning system
   - Delayed spawn with chunk loading
   - Tag-based despawn operations

### Modified Files
1. `packs/QuestSystemBP/scripts/main.js`
   - Added imports (lines 86-95)
   - Quest accept spawn (lines 977-994)
   - Entity death tracking (lines 1615-1683)
   - Turn-in despawn (lines 1854-1862)
   - Abandon despawn (lines 1039-1047)
   - Debug commands (lines 2869-2959)

2. `packs/QuestSystemBP/scripts/safeZone.js`
   - Added encounter mob exception (lines 209-213)

### Configuration Changed
- Test spawn location: X=73, Y=75, Z=-278
- Spawn delay: 20 ticks (1 second)
- Ticking area name: `encounter_spawn_temp`

---

## Success Metrics

### What "Working" Looks Like
1. ✅ Console shows: `Spawned X/X mobs` (not 0/X)
2. ✅ Mobs visible at spawn location
3. ✅ Killing mob shows: `Killed <mob> (1/X)`
4. ✅ Quest completes when all mobs dead
5. ✅ Turn-in awards SP and items

### What "Broken" Looks Like
1. ❌ Console shows: `Spawned 0/X mobs`
2. ❌ Mobs spawn then immediately disappear
3. ❌ Kills don't increment progress
4. ❌ Quest never completes
5. ❌ Turn-in doesn't give rewards

---

## Final Notes for AI Agents

### Don't Overthink It
Phase 2 is fundamentally simple:
1. Wait for chunk to load
2. Spawn mobs with tags
3. Track kills by tag
4. Despawn on turn-in/abandon

The complexity came from Minecraft's chunk loading and the existing safe zone system.

### Trust the Delayed Spawn Pattern
The 1-second delay feels hacky but it's the **only reliable solution** for chunk loading.
Don't try to optimize this - 1 second is imperceptible to players.

### Safe Zone Is Your Friend
The safe zone system protects the quest board area. Don't fight it - work with it.
The tag exception is the right approach.

### Test Early, Test Often
One successful quest completion validates the entire Phase 2 implementation.
Don't over-engineer - get it working, then move to Phase 3.

---

## Summary

**Phase 2 Success Formula:**
1. Delayed spawn (20 ticks) for chunk loading
2. Safe zone tag exception for encounter mobs
3. Tag-based kill tracking (not entity type)
4. Tag-based despawn queries (not entity IDs)
5. Test location near quest board for easy validation

Follow this pattern and Phase 2 will work on the first try.

**Total Implementation Time:** ~4 hours (including debugging)
**Total Code Changes:** ~400 lines across 3 files
**Test Results:** ✅ 2/2 quests completed successfully

Ready for Phase 3: Ring-Based Spawning with Terrain Validation

---

**Document Version:** 1.0
**Last Updated:** 2026-01-19
**Author:** AI Assistant (documenting for future AI agents)
