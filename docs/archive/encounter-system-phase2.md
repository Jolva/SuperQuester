# Super Quester: Encounter System — Phase 2 Implementation

**Phase:** 2 of 5
**Focus:** Basic Mob Spawning
**Branch:** `feature/encounter-system`
**Prerequisite:** Phase 1 complete and validated
**Validates:** Mob tagging, kill tracking, completion detection, despawn on turn-in/abandon

---

## Objective

Spawn encounter mobs at a fixed test location near the quest board. This phase validates the core spawning and tracking mechanics before adding ring-based spatial complexity in Phase 3.

By the end of this phase:
- Accepting a Rare/Legendary quest spawns mobs 30 blocks from the quest board
- All spawned mobs are tagged for tracking
- Killing tagged mobs increments quest progress
- Completing all kills enables turn-in
- Turn-in and abandon both despawn remaining mobs
- Environmental kills (lava, fall damage) count toward progress

---

## Test Spawn Configuration

**Quest Board Location:** `{ x: 72, y: 75, z: -278 }`
**Test Spawn Location:** `{ x: 102, y: 75, z: -278 }` (30 blocks east)

This fixed location is temporary for Phase 2 testing only. Phase 3 replaces it with ring-based random spawning.

---

## Files to Create

### 1. `/scripts/systems/EncounterSpawner.js`

```javascript
/**
 * EncounterSpawner.js
 * Handles spawning, despawning, and tracking of encounter mobs.
 */

import { world } from "@minecraft/server";

// === CONSTANTS ===

// Test spawn offset from quest board (Phase 2 only)
const TEST_SPAWN_OFFSET = { x: 30, y: 0, z: 0 };

// Quest board location
const QUEST_BOARD_POS = { x: 72, y: 75, z: -278 };

// Tag prefixes
const TAG_ENCOUNTER_MOB = "sq_encounter_mob";
const TAG_QUEST_PREFIX = "sq_quest_";

// === SPAWNING ===

/**
 * Get the test spawn location (Phase 2 only)
 * @returns {{x: number, y: number, z: number}} Spawn coordinates
 */
export function getTestSpawnLocation() {
  return {
    x: QUEST_BOARD_POS.x + TEST_SPAWN_OFFSET.x,
    y: QUEST_BOARD_POS.y + TEST_SPAWN_OFFSET.y,
    z: QUEST_BOARD_POS.z + TEST_SPAWN_OFFSET.z
  };
}

/**
 * Spawn all mobs for an encounter quest
 * @param {Object} quest - The encounter quest object
 * @param {{x: number, y: number, z: number}} location - Spawn center point
 * @param {Dimension} dimension - Minecraft dimension to spawn in
 * @returns {string[]} Array of spawned entity IDs
 */
export function spawnEncounterMobs(quest, location, dimension) {
  const spawnedEntityIds = [];
  
  for (const mobGroup of quest.encounterMobs) {
    for (let i = 0; i < mobGroup.count; i++) {
      // Add position variance to prevent mob stacking
      const variance = {
        x: (Math.random() - 0.5) * 6,  // -3 to +3 blocks
        z: (Math.random() - 0.5) * 6
      };
      
      const spawnPos = {
        x: location.x + variance.x,
        y: location.y,
        z: location.z + variance.z
      };
      
      try {
        const entity = dimension.spawnEntity(mobGroup.type, spawnPos);
        
        // Apply tags for tracking
        entity.addTag(TAG_ENCOUNTER_MOB);
        entity.addTag(`${TAG_QUEST_PREFIX}${quest.id}`);
        
        // Apply custom name tag if specified
        if (mobGroup.nameTag) {
          entity.nameTag = mobGroup.nameTag;
        }
        
        spawnedEntityIds.push(entity.id);
      } catch (error) {
        console.error(`[EncounterSpawner] Failed to spawn ${mobGroup.type}: ${error}`);
      }
    }
  }
  
  console.log(`[EncounterSpawner] Spawned ${spawnedEntityIds.length} mobs for quest ${quest.id}`);
  return spawnedEntityIds;
}

// === DESPAWNING ===

/**
 * Despawn all mobs associated with a quest
 * @param {string} questId - The quest ID
 * @param {Dimension} dimension - Minecraft dimension to search
 * @returns {number} Number of mobs despawned
 */
export function despawnEncounterMobs(questId, dimension) {
  const tagToFind = `${TAG_QUEST_PREFIX}${questId}`;
  let despawnCount = 0;
  
  try {
    // Query all entities with the encounter mob tag
    const entities = dimension.getEntities({
      tags: [tagToFind]
    });
    
    for (const entity of entities) {
      try {
        entity.remove();
        despawnCount++;
      } catch (error) {
        console.error(`[EncounterSpawner] Failed to remove entity: ${error}`);
      }
    }
  } catch (error) {
    console.error(`[EncounterSpawner] Failed to query entities: ${error}`);
  }
  
  console.log(`[EncounterSpawner] Despawned ${despawnCount} mobs for quest ${questId}`);
  return despawnCount;
}

// === UTILITY ===

/**
 * Check if an entity is an encounter mob
 * @param {Entity} entity - The entity to check
 * @returns {boolean} True if entity is an encounter mob
 */
export function isEncounterMob(entity) {
  try {
    return entity.hasTag(TAG_ENCOUNTER_MOB);
  } catch {
    return false;
  }
}

/**
 * Get the quest ID from an encounter mob's tags
 * @param {Entity} entity - The entity to check
 * @returns {string|null} Quest ID or null if not found
 */
export function getQuestIdFromMob(entity) {
  try {
    const tags = entity.getTags();
    const questTag = tags.find(tag => tag.startsWith(TAG_QUEST_PREFIX));
    
    if (questTag) {
      return questTag.replace(TAG_QUEST_PREFIX, "");
    }
  } catch {
    // Entity may have been removed
  }
  
  return null;
}

/**
 * Count remaining alive mobs for a quest
 * @param {string} questId - The quest ID
 * @param {Dimension} dimension - Minecraft dimension to search
 * @returns {number} Number of alive mobs
 */
export function countRemainingMobs(questId, dimension) {
  const tagToFind = `${TAG_QUEST_PREFIX}${questId}`;
  
  try {
    const entities = dimension.getEntities({
      tags: [tagToFind]
    });
    return entities.length;
  } catch {
    return 0;
  }
}
```

---

## Files to Modify

### 2. `main.js` — Quest Accept Handler

**Location:** `handleQuestAccept()` function (approximately lines 924-955 per Phase 0 doc)

**Current Flow:**
```javascript
// Player accepts quest from board
// Quest is copied from available slot to active slot
// Save player data
```

**Required Change:** After quest is copied to `active`, spawn encounter mobs if applicable.

**Add import at top of file:**
```javascript
import { 
  spawnEncounterMobs, 
  despawnEncounterMobs, 
  getTestSpawnLocation,
  isEncounterMob,
  getQuestIdFromMob
} from "./systems/EncounterSpawner.js";
```

**Insert after quest is assigned to active slot:**
```javascript
async function handleQuestAccept(player, slotIndex) {
  // ... existing validation and quest copying logic ...
  
  // Quest is now in questData.active
  const quest = questData.active;
  
  // === NEW: Spawn encounter mobs ===
  if (quest.isEncounter) {
    const spawnLocation = getTestSpawnLocation();  // Phase 2: Fixed location
    const dimension = player.dimension;
    
    const entityIds = spawnEncounterMobs(quest, spawnLocation, dimension);
    
    // Store spawn data on quest for later cleanup
    quest.spawnData = {
      location: spawnLocation,
      spawnedEntityIds: entityIds,
      dimensionId: dimension.id
    };
    
    // Notify player
    player.sendMessage(`§e${quest.encounterName} §fhas appeared nearby!`);
  }
  // === END NEW CODE ===
  
  // ... existing save logic ...
  await PersistenceManager.saveQuestData(player.id, questData);
  
  // ... existing notification logic ...
}
```

---

### 3. `main.js` — Entity Death Handler

**Location:** `entityDie` event subscription (approximately lines 1551-1618 per Phase 0 doc)

**Current Flow:**
```javascript
world.afterEvents.entityDie.subscribe((event) => {
  // Check if killed entity was a quest target
  // Check if killer has active quest matching target
  // Increment progress if match
});
```

**Required Change:** Add encounter-specific kill tracking that uses tags instead of entity type matching.

**Find the existing `entityDie` subscription and extend it:**
```javascript
world.afterEvents.entityDie.subscribe(async (event) => {
  const deadEntity = event.deadEntity;
  
  // === NEW: Check for encounter mob kill ===
  if (isEncounterMob(deadEntity)) {
    const questId = getQuestIdFromMob(deadEntity);
    
    if (questId) {
      // Find which player owns this quest
      for (const player of world.getPlayers()) {
        const questData = await PersistenceManager.loadQuestData(player.id);
        
        if (questData.active && 
            questData.active.isEncounter && 
            questData.active.id === questId) {
          
          // Increment progress
          questData.progress++;
          
          // Notify player
          const remaining = questData.active.totalMobCount - questData.progress;
          if (remaining > 0) {
            player.sendMessage(`§a${questData.active.encounterName}: §f${questData.progress}/${questData.active.totalMobCount} §7(${remaining} remaining)`);
          } else {
            player.sendMessage(`§a${questData.active.encounterName}: §6COMPLETE! §7Return to the board.`);
            player.playSound("random.levelup");
          }
          
          // Save progress
          await PersistenceManager.saveQuestData(player.id, questData);
          
          // Only one player can own a quest, stop searching
          break;
        }
      }
    }
    
    // Encounter mob handled - skip standard kill tracking
    return;
  }
  // === END NEW CODE ===
  
  // ... existing standard kill quest tracking logic continues below ...
});
```

**Important Notes:**
- Encounter mobs are tracked by tag, not by entity type
- Progress increments regardless of who killed the mob (other players, environmental damage)
- The `return` statement skips standard kill tracking for encounter mobs

---

### 4. `main.js` — Quest Turn-In Handler

**Location:** `handleQuestTurnIn()` function (approximately lines 1661-1798 per Phase 0 doc)

**Current Flow:**
```javascript
// Validate quest is complete
// Award SP and items
// Clear active quest
// Generate replacement quest
```

**Required Change:** Despawn any remaining encounter mobs before awarding rewards.

**Insert before rewards are awarded:**
```javascript
async function handleQuestTurnIn(player) {
  const questData = await PersistenceManager.loadQuestData(player.id);
  const quest = questData.active;
  
  // ... existing validation that quest is complete ...
  
  // === NEW: Clean up encounter mobs ===
  if (quest.isEncounter && quest.spawnData) {
    const dimension = world.getDimension(quest.spawnData.dimensionId || "overworld");
    despawnEncounterMobs(quest.id, dimension);
  }
  // === END NEW CODE ===
  
  // ... existing reward logic ...
  // Award SP, give items, etc.
  
  // ... existing cleanup logic ...
  // Clear active quest, generate replacement, save
}
```

---

### 5. `main.js` — Quest Abandon Handler

**Location:** `handleQuestAbandon()` function (approximately lines 962-991 per Phase 0 doc)

**Current Flow:**
```javascript
// Move quest from active back to available
// Reset progress
// Save player data
```

**Required Change:** Despawn encounter mobs and clear spawn data before returning quest to available.

**Insert before quest is returned to available:**
```javascript
async function handleQuestAbandon(player) {
  const questData = await PersistenceManager.loadQuestData(player.id);
  const quest = questData.active;
  
  if (!quest) {
    player.sendMessage("§cNo active quest to abandon.");
    return;
  }
  
  // === NEW: Clean up encounter mobs ===
  if (quest.isEncounter && quest.spawnData) {
    const dimension = world.getDimension(quest.spawnData.dimensionId || "overworld");
    despawnEncounterMobs(quest.id, dimension);
    
    // Clear spawn data so quest can be re-accepted with fresh spawn
    quest.spawnData = null;
  }
  // === END NEW CODE ===
  
  // Reset progress
  questData.progress = 0;
  
  // Return quest to available slot
  // ... existing logic to find available slot and move quest ...
  
  // Notify player
  player.sendMessage(`§7Quest abandoned: ${quest.title}`);
  
  // Save
  await PersistenceManager.saveQuestData(player.id, questData);
}
```

---

## Kill Attribution Design

Phase 2 uses a simple model: **any death counts**.

| Kill Scenario | Counts? | Rationale |
|---------------|---------|-----------|
| Quest owner kills mob | ✅ Yes | Primary case |
| Another player kills mob | ✅ Yes | Collaborative play |
| Mob dies to lava/fire | ✅ Yes | Environmental kills valid |
| Mob dies to fall damage | ✅ Yes | Environmental kills valid |
| Mob dies to other mob | ✅ Yes | Rare but valid |
| Mob despawns naturally | ❌ No | No `entityDie` event fires |

This is intentional per the design decisions. The tag system ensures only encounter mobs count, regardless of kill source.

---

## Validation Checklist

### Spawn Mechanics
- [ ] Accepting Rare quest spawns mobs at test location (X=102, Y=75, Z=-278)
- [ ] Accepting Legendary quest spawns mobs at test location
- [ ] Correct number of mobs spawn (matches `totalMobCount`)
- [ ] Mixed mob groups spawn correctly (e.g., Spider Nest: 4 spiders + 2 cave spiders)
- [ ] Mobs spawn with slight position variance (not stacked)
- [ ] Named mobs have correct name tags (e.g., "Frost Archer")

### Tagging System
- [ ] All spawned mobs have `sq_encounter_mob` tag
- [ ] All spawned mobs have `sq_quest_${questId}` tag
- [ ] `isEncounterMob()` returns true for spawned mobs
- [ ] `getQuestIdFromMob()` returns correct quest ID

### Kill Tracking
- [ ] Killing tagged mob increments `questData.progress`
- [ ] Progress notification shows correct count (e.g., "3/6")
- [ ] Killing final mob shows "COMPLETE!" message
- [ ] Completion sound plays on final kill
- [ ] Environmental kills (push mob into lava) count
- [ ] Kills by other players count toward quest owner's progress

### Turn-In Flow
- [ ] Cannot turn in until `progress >= totalMobCount`
- [ ] Turn-in despawns any remaining mobs
- [ ] SP awarded correctly
- [ ] Items awarded correctly
- [ ] Quest removed from active slot
- [ ] Replacement quest generated

### Abandon Flow
- [ ] Abandon despawns all encounter mobs
- [ ] Quest returns to available slot
- [ ] Progress resets to 0
- [ ] `spawnData` cleared from quest
- [ ] Re-accepting quest spawns fresh mobs

### Edge Cases
- [ ] Logging out mid-encounter: mobs persist (Phase 4 will handle cleanup)
- [ ] Accepting Common quest: no mobs spawn (not an encounter)
- [ ] Accepting Mythic quest: no mobs spawn (not routed to encounters)

---

## Testing Commands

Add these to chat command handler for Phase 2 testing:

```javascript
if (message === "!encounter spawn test") {
  // Force spawn a test encounter at player location
  const { ENCOUNTER_TABLE } = await import("./data/EncounterTable.js");
  const { spawnEncounterMobs } = await import("./systems/EncounterSpawner.js");
  
  const testEncounter = ENCOUNTER_TABLE[0];  // skeleton_warband
  const testQuest = {
    id: "debug_test",
    encounterMobs: testEncounter.mobs
  };
  
  const entityIds = spawnEncounterMobs(testQuest, player.location, player.dimension);
  player.sendMessage(`§aSpawned ${entityIds.length} test mobs at your location`);
  return true;
}

if (message === "!encounter despawn test") {
  // Despawn test encounter mobs
  const { despawnEncounterMobs } = await import("./systems/EncounterSpawner.js");
  const count = despawnEncounterMobs("debug_test", player.dimension);
  player.sendMessage(`§aDespawned ${count} test mobs`);
  return true;
}

if (message === "!encounter info") {
  // Show active encounter details
  const questData = await PersistenceManager.loadQuestData(player.id);
  
  if (questData.active && questData.active.isEncounter) {
    const q = questData.active;
    player.sendMessage(`§e=== Active Encounter ===`);
    player.sendMessage(`§fName: ${q.encounterName}`);
    player.sendMessage(`§fProgress: ${questData.progress}/${q.totalMobCount}`);
    player.sendMessage(`§fQuest ID: ${q.id}`);
    
    if (q.spawnData) {
      const loc = q.spawnData.location;
      player.sendMessage(`§fSpawn: ${loc.x}, ${loc.y}, ${loc.z}`);
      player.sendMessage(`§fSpawned IDs: ${q.spawnData.spawnedEntityIds.length}`);
    } else {
      player.sendMessage(`§7No spawn data (not yet accepted?)`);
    }
  } else {
    player.sendMessage(`§cNo active encounter quest`);
  }
  return true;
}

if (message === "!encounter complete") {
  // Force complete active encounter (for testing turn-in)
  const questData = await PersistenceManager.loadQuestData(player.id);
  
  if (questData.active && questData.active.isEncounter) {
    questData.progress = questData.active.totalMobCount;
    await PersistenceManager.saveQuestData(player.id, questData);
    player.sendMessage(`§aEncounter marked complete - return to board to turn in`);
  } else {
    player.sendMessage(`§cNo active encounter quest`);
  }
  return true;
}

if (message === "!encounter count") {
  // Count remaining mobs for active encounter
  const { countRemainingMobs } = await import("./systems/EncounterSpawner.js");
  const questData = await PersistenceManager.loadQuestData(player.id);
  
  if (questData.active && questData.active.isEncounter) {
    const remaining = countRemainingMobs(questData.active.id, player.dimension);
    player.sendMessage(`§eAlive mobs: ${remaining}`);
    player.sendMessage(`§7Progress: ${questData.progress}/${questData.active.totalMobCount}`);
  } else {
    player.sendMessage(`§cNo active encounter quest`);
  }
  return true;
}
```

---

## Rollback Plan

If Phase 2 causes issues:

1. Remove encounter spawning from `handleQuestAccept()`
2. Remove encounter tracking from `entityDie` subscription
3. Remove encounter cleanup from `handleQuestTurnIn()` and `handleQuestAbandon()`
4. `EncounterSpawner.js` can remain — it's inert if not called

Phase 1 remains intact. Encounter quests will still generate and display correctly; they just won't spawn mobs until Phase 2 is re-enabled.

---

## Phase 2 Complete When

All validation checklist items pass, specifically:
1. Encounter mobs spawn at test location on quest accept
2. Kill tracking works via tag system
3. Progress persists correctly
4. Turn-in and abandon both clean up mobs
5. Environmental kills count

**Do not proceed to Phase 3** until all Phase 2 validations pass.

---

## Notes for Implementation

1. **Async handling**: The `entityDie` handler iterates all players to find the quest owner. This is acceptable for a 3-player server. For larger servers, consider a lookup table mapping `questId → playerId`.

2. **Dimension handling**: Always pass the dimension from the player or store it in `spawnData`. Don't assume Overworld.

3. **Entity removal safety**: Wrap `entity.remove()` in try/catch — entities may already be removed by the time we process them.

4. **Progress vs. entity count**: Don't rely on counting alive mobs for completion status. Use `questData.progress` as the source of truth — it persists even if mobs despawn unexpectedly.

5. **Test location visibility**: The test spawn point (X=102) is deliberately close to the board so you can visually confirm spawns. Phase 3 will push them further out.

---

## What Phase 3 Will Change

Phase 3 replaces `getTestSpawnLocation()` with ring-based random spawning:

- `LocationValidator.js` will handle terrain checks
- Spawn location will be 60-200 blocks from board depending on tier
- Player will receive distance notification
- Fallback locations for failed terrain validation

The core spawning and tracking logic from Phase 2 remains unchanged.
