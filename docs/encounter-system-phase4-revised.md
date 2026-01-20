# Super Quester: Encounter System — Phase 4 Implementation (Revised)

**Phase:** 4 of 5
**Status:** ✅ COMPLETE
**Focus:** Logout/Login Persistence
**Branch:** `feat/superquester-encounter-system`
**Prerequisite:** Phase 3 (revised) complete and validated
**Validates:** State-aware persistence, mob despawn on logout, respawn on login

---

## Implementation Summary

Phase 4 has been successfully implemented with the following key features:

### What Was Implemented
1. **Logout/Login Persistence** - Encounter state survives player disconnect
2. **Mob Despawn on Logout** - Mobs are removed when player leaves
3. **Mob Respawn on Login** - Remaining mobs respawn at original location
4. **Fire Protection** - Undead mobs don't burn in sunlight (via damage event cancellation)
5. **Persistent Actionbar UI** - Shows quest name, progress, and distance
6. **Spawn Distance Fix** - Reduced to 18-22 blocks to ensure chunk loading

### Key Bug Fixes During Implementation
- **Mobs dying instantly**: Original 40-60 block spawn distance caused chunk loading issues
- **Sunlight burning**: Added fire damage protection for encounter mobs
- **UI too large**: Changed from title/subtitle to actionbar-only display

### Files Modified
- `EncounterSpawner.js` - Added `respawnRemainingMobs()`, `initializeEncounterMobProtection()`
- `EncounterProximity.js` - Added persistent actionbar UI for pending/spawned states
- `LocationValidator.js` - Changed spawn distance from 40-60 to 18-22 blocks
- `main.js` - Added playerLeave/playerSpawn handlers, protection initialization

---

## Objective

Handle player disconnection gracefully across all encounter states. The new state machine (`pending` → `spawned` → `complete`) requires different handling for each state.

By the end of this phase:
- Logging out with a `pending` encounter preserves zone (no mobs to handle)
- Logging out with a `spawned` encounter despawns mobs, preserves progress
- Logging back in respawns remaining mobs at the stored location
- Logging back in with a `complete` encounter reminds player to turn in

---

## State-Aware Persistence Matrix

| State on Logout | Mobs Exist? | Logout Action | Login Action |
|-----------------|-------------|---------------|--------------|
| `pending` | No | Nothing to despawn | Nothing to spawn; remind to travel to zone |
| `spawned` | Yes | Despawn all mobs | Respawn remaining mobs at `spawnData.location` |
| `complete` | No (killed) | Nothing to despawn | Remind to turn in |

---

## Files to Modify

### 1. `EncounterSpawner.js` — Add Respawn Function

**Location:** `/scripts/systems/EncounterSpawner.js`

**Add this function (same as original Phase 4 spec):**

```javascript
/**
 * Respawn remaining mobs for an encounter after player login
 * Only spawns mobs that haven't been killed yet (based on progress)
 * 
 * @param {Object} quest - The encounter quest object
 * @param {number} progress - Current kill progress
 * @param {Dimension} dimension - Minecraft dimension to spawn in
 * @returns {string[]} Array of spawned entity IDs
 */
export function respawnRemainingMobs(quest, progress, dimension) {
  if (!quest.spawnData || !quest.spawnData.location) {
    console.error(`[EncounterSpawner] Cannot respawn - no spawn location stored`);
    return [];
  }
  
  const location = quest.spawnData.location;
  const spawnedEntityIds = [];
  
  // Calculate how many mobs need to respawn
  let mobsToSpawn = quest.totalMobCount - progress;
  
  if (mobsToSpawn <= 0) {
    console.log(`[EncounterSpawner] No mobs to respawn - encounter complete`);
    return [];
  }
  
  // Spawn mobs from each group until we've spawned enough
  for (const mobGroup of quest.encounterMobs) {
    if (mobsToSpawn <= 0) break;
    
    const countFromGroup = Math.min(mobGroup.count, mobsToSpawn);
    
    for (let i = 0; i < countFromGroup; i++) {
      const variance = {
        x: (Math.random() - 0.5) * 6,
        z: (Math.random() - 0.5) * 6
      };
      
      const spawnPos = {
        x: location.x + variance.x,
        y: location.y,
        z: location.z + variance.z
      };
      
      try {
        const entity = dimension.spawnEntity(mobGroup.type, spawnPos);
        
        entity.addTag(TAG_ENCOUNTER_MOB);
        entity.addTag(`${TAG_QUEST_PREFIX}${quest.id}`);
        
        if (mobGroup.nameTag) {
          entity.nameTag = mobGroup.nameTag;
        }
        
        spawnedEntityIds.push(entity.id);
      } catch (error) {
        console.error(`[EncounterSpawner] Failed to respawn ${mobGroup.type}: ${error}`);
      }
    }
    
    mobsToSpawn -= countFromGroup;
  }
  
  console.log(`[EncounterSpawner] Respawned ${spawnedEntityIds.length} mobs for quest ${quest.id}`);
  return spawnedEntityIds;
}
```

**Ensure constants are accessible:**
```javascript
const TAG_ENCOUNTER_MOB = "sq_encounter_mob";
const TAG_QUEST_PREFIX = "sq_quest_";
```

---

### 2. `main.js` — Player Leave Handler

**Location:** `playerLeave` event subscription

**Update imports:**
```javascript
import { 
  spawnEncounterMobs, 
  despawnEncounterMobs,
  respawnRemainingMobs,
  isEncounterMob,
  getQuestIdFromMob
} from "./systems/EncounterSpawner.js";
```

**Add state-aware encounter handling:**

```javascript
world.afterEvents.playerLeave.subscribe(async (event) => {
  const playerId = event.playerId;
  
  // === NEW: State-aware encounter cleanup on logout ===
  try {
    const questData = await PersistenceManager.loadQuestData(playerId);
    
    if (questData?.active?.isEncounter) {
      const quest = questData.active;
      
      switch (quest.encounterState) {
        case "pending":
          // No mobs spawned yet - nothing to despawn
          console.log(`[main] Player ${playerId} logged out with pending encounter - no cleanup needed`);
          break;
          
        case "spawned":
          // Mobs exist - despawn them
          if (quest.spawnData) {
            const dimensionId = quest.spawnData.dimensionId || "overworld";
            const dimension = world.getDimension(dimensionId);
            
            const despawnCount = despawnEncounterMobs(quest.id, dimension);
            console.log(`[main] Player ${playerId} logged out - despawned ${despawnCount} encounter mobs`);
            
            // Clear entity IDs but keep location for respawn
            quest.spawnData.spawnedEntityIds = [];
            await PersistenceManager.saveQuestData(playerId, questData);
          }
          break;
          
        case "complete":
          // All mobs dead - nothing to despawn
          console.log(`[main] Player ${playerId} logged out with complete encounter - no cleanup needed`);
          break;
      }
    }
  } catch (error) {
    console.error(`[main] Error handling encounter cleanup on player leave: ${error}`);
  }
  // === END NEW CODE ===
  
  // ... existing cleanup logic (music, pets, etc.) ...
});
```

---

### 3. `main.js` — Player Spawn Handler

**Location:** `playerSpawn` event subscription

**Add state-aware encounter restoration:**

```javascript
world.afterEvents.playerSpawn.subscribe(async (event) => {
  // Only handle initial spawns (login), not respawns after death
  if (!event.initialSpawn) return;
  
  const player = event.player;
  
  // ... existing teleport to hub logic ...
  
  // Load player data
  const questData = await PersistenceManager.loadQuestData(player);
  
  // === NEW: State-aware encounter restoration on login ===
  if (questData?.active?.isEncounter) {
    const quest = questData.active;
    const progress = questData.progress || 0;
    
    switch (quest.encounterState) {
      case "pending":
        // Player hasn't reached the zone yet - remind them
        const zone = quest.encounterZone;
        if (zone) {
          player.sendMessage(`§eYou have an active encounter: §f${quest.encounterName}`);
          player.sendMessage(`§7Travel to zone: ${zone.center.x}, ${zone.center.z}`);
        }
        break;
        
      case "spawned":
        // Mobs were despawned on logout - respawn them
        if (quest.spawnData?.location) {
          const remaining = quest.totalMobCount - progress;
          
          if (remaining > 0) {
            const dimension = player.dimension;
            const entityIds = respawnRemainingMobs(quest, progress, dimension);
            
            // Update spawned entity IDs
            quest.spawnData.spawnedEntityIds = entityIds;
            await PersistenceManager.saveQuestData(player, questData);
            
            player.sendMessage(`§eYour encounter persists. §f${remaining} enemies remain.`);
            player.sendMessage(`§7Location: ${quest.spawnData.location.x}, ${quest.spawnData.location.y}, ${quest.spawnData.location.z}`);
          } else {
            // Progress shows complete but state wasn't updated - fix it
            quest.encounterState = "complete";
            await PersistenceManager.saveQuestData(player, questData);
            player.sendMessage(`§a${quest.encounterName} §fis complete! Return to the board.`);
          }
        }
        break;
        
      case "complete":
        // Encounter done, just needs turn-in
        player.sendMessage(`§a${quest.encounterName} §fis complete! Return to the board to claim your reward.`);
        break;
    }
  }
  // === END NEW CODE ===
  
  // ... existing initialization logic ...
});
```

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Logout immediately after accepting (pending) | Zone preserved, no mobs to handle |
| Logout while traveling to zone (pending) | Zone preserved, no mobs to handle |
| Logout after "The enemy is near!" but before spawn completes | Tricky edge case - mobs may or may not exist. If `spawnData` is null, treat as pending. |
| Logout mid-combat (spawned) | Mobs despawn, progress preserved, respawn on login |
| Logout after killing all mobs (complete) | No mobs to despawn, reminder on login |
| Kill mob, logout immediately | Progress saved on each kill, correct count respawns |
| Server crash during spawned state | Phase 5 orphan cleanup handles this |

---

## Validation Checklist

### Pending State Persistence
- [ ] Accept quest (state = "pending")
- [ ] Logout immediately
- [ ] Login → "You have an active encounter" message with zone coordinates
- [ ] `encounterState` still "pending"
- [ ] No mobs spawned (correct - player hasn't arrived yet)

### Spawned State Persistence
- [ ] Accept quest, travel to zone, trigger spawn (state = "spawned")
- [ ] Kill 3 of 6 mobs
- [ ] Logout → mobs despawn, console shows despawn count
- [ ] Login → only 3 mobs respawn
- [ ] Mobs respawn at original `spawnData.location`
- [ ] "Your encounter persists. 3 enemies remain." message
- [ ] Kill remaining 3 → quest completes normally
- [ ] Turn-in works, SP awarded

### Complete State Persistence
- [ ] Complete all kills (state = "complete")
- [ ] Logout before turn-in
- [ ] Login → "is complete! Return to the board" message
- [ ] No mobs spawn
- [ ] Turn-in works normally

### Multi-Player
- [ ] Player A has spawned encounter, Player B online
- [ ] Player A logs out → only Player A's mobs despawn
- [ ] Player B's encounter (if any) unaffected

---

## Testing Commands

```javascript
if (message === "!encounter test logout") {
  const questData = await PersistenceManager.loadQuestData(player);
  
  if (questData?.active?.isEncounter) {
    const quest = questData.active;
    player.sendMessage(`§e=== Simulating Logout ===`);
    player.sendMessage(`§fState: ${quest.encounterState}`);
    
    if (quest.encounterState === "spawned" && quest.spawnData) {
      const dimension = player.dimension;
      const despawnCount = despawnEncounterMobs(quest.id, dimension);
      quest.spawnData.spawnedEntityIds = [];
      await PersistenceManager.saveQuestData(player, questData);
      player.sendMessage(`§aDespawned ${despawnCount} mobs`);
    } else {
      player.sendMessage(`§7No mobs to despawn (state: ${quest.encounterState})`);
    }
    player.sendMessage(`§7Use !encounter test login to simulate login`);
  } else {
    player.sendMessage(`§cNo active encounter`);
  }
  return true;
}

if (message === "!encounter test login") {
  const questData = await PersistenceManager.loadQuestData(player);
  
  if (questData?.active?.isEncounter) {
    const quest = questData.active;
    const progress = questData.progress || 0;
    
    player.sendMessage(`§e=== Simulating Login ===`);
    player.sendMessage(`§fState: ${quest.encounterState}`);
    player.sendMessage(`§fProgress: ${progress}/${quest.totalMobCount}`);
    
    if (quest.encounterState === "spawned" && quest.spawnData?.location) {
      const remaining = quest.totalMobCount - progress;
      
      if (remaining > 0) {
        const dimension = player.dimension;
        const entityIds = respawnRemainingMobs(quest, progress, dimension);
        quest.spawnData.spawnedEntityIds = entityIds;
        await PersistenceManager.saveQuestData(player, questData);
        player.sendMessage(`§aRespawned ${entityIds.length} mobs`);
      } else {
        player.sendMessage(`§aNo mobs to respawn - encounter complete`);
      }
    } else if (quest.encounterState === "pending") {
      player.sendMessage(`§7Encounter pending - travel to zone first`);
    } else {
      player.sendMessage(`§7Encounter complete - return to board`);
    }
  } else {
    player.sendMessage(`§cNo active encounter`);
  }
  return true;
}

if (message === "!encounter state") {
  const questData = await PersistenceManager.loadQuestData(player);
  
  if (questData?.active?.isEncounter) {
    const quest = questData.active;
    const progress = questData.progress || 0;
    
    player.sendMessage(`§e=== Encounter State ===`);
    player.sendMessage(`§fName: ${quest.encounterName}`);
    player.sendMessage(`§fState: ${quest.encounterState}`);
    player.sendMessage(`§fProgress: ${progress}/${quest.totalMobCount}`);
    
    if (quest.encounterZone) {
      player.sendMessage(`§fZone: ${quest.encounterZone.center.x}, ${quest.encounterZone.center.z}`);
    }
    if (quest.spawnData?.location) {
      player.sendMessage(`§fSpawn: ${quest.spawnData.location.x}, ${quest.spawnData.location.y}, ${quest.spawnData.location.z}`);
      player.sendMessage(`§fEntity IDs: ${quest.spawnData.spawnedEntityIds?.length || 0}`);
    }
  } else {
    player.sendMessage(`§cNo active encounter`);
  }
  return true;
}
```

---

## Rollback Plan

If Phase 4 causes issues:

1. Remove encounter logic from `playerLeave` handler
2. Remove encounter logic from `playerSpawn` handler
3. Remove `respawnRemainingMobs()` from `EncounterSpawner.js`

Phase 3 functionality remains intact. Encounters will work but won't survive logout properly.

---

## Phase 4 Complete When

All validation checklist items pass:
1. Pending state survives logout/login (zone preserved)
2. Spawned state survives logout/login (mobs despawn/respawn correctly)
3. Complete state survives logout/login (turn-in reminder shown)
4. Progress preserved across all states
5. Respawn location matches original spawn location

**Do not proceed to Phase 5** until all Phase 4 validations pass.

---

## Notes for Implementation

1. **Match existing API signature**: Use `PersistenceManager.loadQuestData(player)` not `player.id` — match Phase 2/3 pattern.

2. **Dimension on login**: Player may spawn in a different dimension than where encounter was. Use stored `dimensionId` from `spawnData` for despawn, but current `player.dimension` for respawn (player needs to be near the mobs).

3. **Race condition**: The proximity system might fire while login respawn is happening. The `encounterState === "spawned"` check should prevent double-spawning, but worth testing.

4. **Entity ID cleanup**: On logout, clear `spawnedEntityIds` but keep `location`. The IDs are invalid after despawn anyway.

---

## What Phase 5 Will Add

Phase 5 is the final polish:
- Orphan mob cleanup on server start
- Full abandon flow validation
- Edge case hardening
