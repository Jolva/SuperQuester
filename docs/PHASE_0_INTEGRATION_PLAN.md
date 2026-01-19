# Phase 0: Encounter System Integration Plan

**Created:** 2026-01-19
**Status:** Pre-Implementation Review
**Quest Board Location:** `{ x: 72, y: 75, z: -278 }`

---

## Executive Summary

The Super Quester codebase is **well-architected and ready** for encounter system integration. The quest generation pipeline, persistence layer, and event handling infrastructure are all proven stable and extensible. This document maps the integration strategy across all 5 phases.

**Readiness Assessment:** 8/10
**Primary Blockers:** None (need new utilities, not architectural changes)
**Risk Level:** Low (phased approach with rollback points)

---

## I. Current System Architecture Overview

### Quest Flow
```
Player interacts with board → UI shows Available/Active/Leaderboard
  → Player accepts quest → Quest copied to `active` slot
  → Progress tracked via entityDie/blockBreak events
  → Turn-in validates completion → Awards SP + items → Clears active
```

### Quest Data Schema (Current)
```javascript
{
  id: string,
  title: string,
  description: string,
  type: "kill"|"mine"|"gather",
  category: string,
  rarity: "common"|"rare"|"legendary"|"mythic",
  requiredCount: number,
  targets: string[],              // Mob IDs for kill quests
  targetBlockIds?: string[],       // Block IDs for mine quests
  targetItemIds?: string[],        // Item IDs for gather quests
  reward: {
    scoreboardIncrement: number,
    rewardItems: [{ typeId, amount }]
  }
}
```

### Player Data Schema (Persisted)
```javascript
{
  available: [Quest|null, Quest|null, Quest|null],
  active: Quest|null,
  progress: number,
  lastRefreshTime: number,
  lastCompletionTime: number,
  freeRerollAvailable: bool,
  paidRerollsThisCycle: number,
  lifetimeCompleted: number,
  currentSP: number
}
```

### Event Subscriptions (All in main.js)
- `world.afterEvents.worldInitialize` → Init scoreboards
- `world.afterEvents.playerSpawn` → Teleport to hub, load data
- `world.afterEvents.playerLeave` → Clean up music/pets
- `world.afterEvents.entityDie` → Track kill progress (via `lastHitPlayerByEntityId`)
- `world.afterEvents.playerBreakBlock` → Track mining progress
- `world.afterEvents.entityHit` → Attribute kills to last hitter

---

## II. Integration Points by Phase

### Phase 1: Data Structures & Tables

#### Files to Create
1. **`/scripts/data/EncounterTable.js`**
   - Export `ENCOUNTER_TABLE` (array of encounter definitions)
   - One function: `getEncountersByTier(tier)`

2. **`/scripts/systems/EncounterManager.js`**
   - `selectRandomEncounter(tier)` → Returns encounter definition
   - `generateEncounterQuest(tier, playerId)` → Returns quest object

#### Files to Modify
- **`QuestGenerator.js`** (lines ~74-114)
  - In `generateQuest()`, after rolling rarity:
    ```javascript
    if ((rarity === "rare" || rarity === "legendary") && Math.random() < 1.0) {
      // Always use encounters for Rare/Legendary (can tune this later)
      return EncounterManager.generateEncounterQuest(rarity, playerId);
    }
    ```
  - This replaces the normal kill quest generation for these tiers

#### Extended Quest Schema
```javascript
{
  ...existing fields...,
  isEncounter: true,                    // Flag for encounter-based quests
  encounterId: string,                  // e.g., "skeleton_warband"
  encounterName: string,                // Display name
  encounterMobs: [                      // Mob composition
    { type: string, count: number, equipment: object|null, nameTag: string|null }
  ],
  totalMobCount: number,                // Sum of all counts
  spawnData: {                          // Added when quest is accepted
    location: { x, y, z },
    spawnedEntityIds: string[],         // Track entity IDs for cleanup
    dimensionId: string                 // "overworld", "nether", "end"
  } | null
}
```

#### Validation Checklist
- [ ] `EncounterTable.js` loads without errors
- [ ] `getEncountersByTier("rare")` returns 4 encounters
- [ ] `getEncountersByTier("legendary")` returns 4 encounters
- [ ] Quest board UI displays encounter names/descriptions correctly
- [ ] Accepting encounter quest copies full definition to `active`

---

### Phase 2: Basic Mob Spawning

#### Files to Create
1. **`/scripts/systems/EncounterSpawner.js`**
   - `spawnEncounterMobs(quest, location, dimension)` → Returns entity IDs
   - `despawnEncounterMobs(questId, dimension)` → Removes tagged mobs
   - `tagEncounterMob(entity, questId)` → Applies quest tags

#### Files to Modify
- **`main.js`** - `handleQuestAccept()` (lines ~924-955)
  - After quest copied to `active`:
    ```javascript
    if (quest.isEncounter) {
      const testLocation = {
        x: 72 + 30,  // 30 blocks from quest board
        y: 75,
        z: -278
      };
      const dimension = player.dimension;
      const entityIds = EncounterSpawner.spawnEncounterMobs(quest, testLocation, dimension);

      quest.spawnData = {
        location: testLocation,
        spawnedEntityIds: entityIds,
        dimensionId: dimension.id
      };
    }
    ```

- **`main.js`** - `handleEntityDeath()` (estimated lines ~1551-1618)
  - Extend kill attribution logic:
    ```javascript
    if (quest.isEncounter) {
      // Check if entity has tag `sq_quest_${quest.id}`
      const questTag = `sq_quest_${quest.id}`;
      if (entity.hasTag(questTag)) {
        quest.progress++;
        // Save & check completion
      }
    }
    ```

- **`main.js`** - `handleQuestTurnIn()` (lines ~1661-1798)
  - Before awarding rewards:
    ```javascript
    if (quest.isEncounter) {
      EncounterSpawner.despawnEncounterMobs(quest.id, player.dimension);
    }
    ```

- **`main.js`** - `handleQuestAbandon()` (lines ~962-991)
  - Before returning quest to available:
    ```javascript
    if (quest.isEncounter && quest.spawnData) {
      EncounterSpawner.despawnEncounterMobs(quest.id, player.dimension);
      quest.spawnData = null;
    }
    ```

#### Mob Tagging System
Every spawned mob gets two tags:
- `sq_encounter_mob` (universal marker)
- `sq_quest_${questId}` (specific quest tracking)

#### Validation Checklist
- [ ] Accepting Rare/Legendary quest spawns mobs 30 blocks from board (X=102, Y=75, Z=-278)
- [ ] All mobs have correct tags (`sq_encounter_mob`, `sq_quest_${id}`)
- [ ] Killing tagged mob increments `quest.progress`
- [ ] Progress notification sent to player after each kill
- [ ] Completing all kills triggers turn-in eligibility
- [ ] Turn-in despawns remaining mobs
- [ ] Abandon despawns all mobs
- [ ] Environmental kills (lava, fall damage) count toward progress

---

### Phase 3: Ring-Based Spawning

#### Files to Create
1. **`/scripts/systems/LocationValidator.js`**
   - `findValidSpawnLocation(dimension, centerX, centerZ, tier)` → Returns {x,y,z} or null
   - `getRandomPointInRing(centerX, centerZ, innerRadius, outerRadius)` → {x, z}
   - `validateSpawnSurface(dimension, x, z)` → boolean
   - `getFallbackLocation(tier)` → {x, y, z}

#### Ring Configuration
```javascript
const RING_CONFIG = {
  rare: { innerRadius: 60, outerRadius: 120 },
  legendary: { innerRadius: 100, outerRadius: 200 }
};
```

#### Fallback Locations (TO BE CONFIGURED)
```javascript
const FALLBACK_LOCATIONS = {
  rare: [
    { x: 100, y: 64, z: -200 },   // PLACEHOLDER - Pick safe spots
    { x: 0, y: 70, z: -350 },     // PLACEHOLDER
    { x: 150, y: 65, z: -280 }    // PLACEHOLDER
  ],
  legendary: [
    { x: 180, y: 68, z: -400 },   // PLACEHOLDER
    { x: -100, y: 72, z: -150 },  // PLACEHOLDER
    { x: 200, y: 66, z: -100 }    // PLACEHOLDER
  ]
};
```

**ACTION REQUIRED:** You must manually select 3 safe coordinates per tier in your world before Phase 3 testing.

#### Invalid Spawn Blocks
```javascript
const INVALID_SPAWN_BLOCKS = [
  "minecraft:water",
  "minecraft:lava",
  "minecraft:flowing_water",
  "minecraft:flowing_lava",
  // All leaf variants (oak, spruce, birch, jungle, acacia, dark_oak, mangrove, cherry, azalea)
];
```

#### Files to Modify
- **`main.js`** - `handleQuestAccept()` (replace test location logic)
  - Before spawning:
    ```javascript
    if (quest.isEncounter) {
      const boardPos = { x: 72, z: -278 };
      let spawnLocation = await LocationValidator.findValidSpawnLocation(
        player.dimension,
        boardPos.x,
        boardPos.z,
        quest.rarity
      );

      if (!spawnLocation) {
        spawnLocation = LocationValidator.getFallbackLocation(quest.rarity);
        player.sendMessage("§7Using backup location...");
      }

      const entityIds = EncounterSpawner.spawnEncounterMobs(quest, spawnLocation, player.dimension);
      quest.spawnData = { location: spawnLocation, spawnedEntityIds: entityIds, dimensionId: player.dimension.id };

      // Notify player of distance
      const distance = Math.floor(Math.sqrt(
        Math.pow(spawnLocation.x - boardPos.x, 2) +
        Math.pow(spawnLocation.z - boardPos.z, 2)
      ));
      player.sendMessage(`§e${quest.encounterName} §fawaits §c${distance} blocks §faway.`);
    }
    ```

#### Validation Checklist
- [ ] Rare encounters spawn 60-120 blocks from board
- [ ] Legendary encounters spawn 100-200 blocks from board
- [ ] No spawns on water/lava/leaves
- [ ] Fallback triggers after 20 failed attempts
- [ ] Distance notification accurate
- [ ] Spawn location persisted in quest data

---

### Phase 4: Logout/Login Persistence

#### Files to Modify
- **`main.js`** - `playerLeave` event (lines ~247-262)
  - Add before cleanup:
    ```javascript
    const questData = await PersistenceManager.loadQuestData(event.playerId);
    if (questData.active && questData.active.isEncounter) {
      EncounterSpawner.despawnEncounterMobs(questData.active.id, player.dimension);
      // Quest data persists - don't clear it
    }
    ```

- **`main.js`** - `playerSpawn` event (lines ~186-244)
  - Add after data load (line ~220):
    ```javascript
    if (questData.active && questData.active.isEncounter && questData.active.spawnData) {
      // Respawn remaining mobs at original location
      const quest = questData.active;
      const remainingCount = quest.totalMobCount - quest.progress;

      if (remainingCount > 0) {
        const dimension = player.dimension;
        const entityIds = EncounterSpawner.respawnRemainingMobs(quest, dimension);
        quest.spawnData.spawnedEntityIds = entityIds;

        player.sendMessage(`§eYour encounter persists. §f${remainingCount} enemies remain.`);
      } else {
        // Quest was completed before logout processed
        // Turn-in will handle cleanup
      }
    }
    ```

#### New Function in EncounterSpawner.js
```javascript
export function respawnRemainingMobs(quest, dimension) {
  // Calculate which mobs to respawn based on progress
  let mobsToSpawn = quest.totalMobCount - quest.progress;
  const spawnedIds = [];

  for (const mobGroup of quest.encounterMobs) {
    if (mobsToSpawn <= 0) break;

    const countFromGroup = Math.min(mobGroup.count, mobsToSpawn);
    for (let i = 0; i < countFromGroup; i++) {
      const variance = {
        x: (Math.random() - 0.5) * 6,
        z: (Math.random() - 0.5) * 6
      };

      const spawnPos = {
        x: quest.spawnData.location.x + variance.x,
        y: quest.spawnData.location.y,
        z: quest.spawnData.location.z + variance.z
      };

      const entity = dimension.spawnEntity(mobGroup.type, spawnPos);
      tagEncounterMob(entity, quest.id);

      if (mobGroup.nameTag) {
        entity.nameTag = mobGroup.nameTag;
      }

      spawnedIds.push(entity.id);
    }

    mobsToSpawn -= countFromGroup;
  }

  return spawnedIds;
}
```

#### Validation Checklist
- [ ] Logout despawns all encounter mobs
- [ ] Quest progress persists through logout
- [ ] Login respawns only remaining mobs
- [ ] Mobs respawn at original location (not new random spot)
- [ ] "Encounter persists" message shown on login
- [ ] If quest completed before logout, turn-in works on login

---

### Phase 5: Abandon Flow & Orphan Cleanup

#### Files to Modify
- **`main.js`** - Add orphan cleanup on world init (lines ~176+)
  ```javascript
  world.afterEvents.worldInitialize.subscribe(() => {
    // ... existing init code ...

    // Cleanup orphaned encounter mobs from crashes
    EncounterSpawner.cleanupOrphanedMobs();
  });
  ```

#### New Function in EncounterSpawner.js
```javascript
export function cleanupOrphanedMobs() {
  const dimension = world.getDimension("overworld");
  let cleaned = 0;

  for (const entity of dimension.getEntities()) {
    if (entity.hasTag("sq_encounter_mob")) {
      // Find quest tag
      const questTag = entity.getTags().find(tag => tag.startsWith("sq_quest_"));

      if (!questTag) {
        // No quest tag - orphan
        entity.remove();
        cleaned++;
        continue;
      }

      // Check if quest still exists and is active
      const questId = questTag.replace("sq_quest_", "");

      // NOTE: This requires iterating all players' quest data
      // Could optimize by storing active encounter IDs in world dynamic property
      let questFound = false;
      for (const player of world.getPlayers()) {
        const questData = PersistenceManager.loadQuestDataSync(player.id);
        if (questData.active && questData.active.id === questId && questData.active.status === "active") {
          questFound = true;
          break;
        }
      }

      if (!questFound) {
        entity.remove();
        cleaned++;
      }
    }
  }

  if (cleaned > 0) {
    console.warn(`[EncounterSpawner] Cleaned up ${cleaned} orphaned mobs`);
  }
}
```

#### UI Enhancement for Active Quest
- **`main.js`** - Quest board UI (lines ~1100-1200 estimated)
  - When player has active encounter, show "Manage" button on Active tab
  - Button options:
    - "Continue Quest" (close UI)
    - "§cAbandon Quest" (call `handleQuestAbandon()`)

#### Validation Checklist
- [ ] Abandon button appears on Active tab for encounters
- [ ] Abandoning despawns all mobs
- [ ] Abandoned quest returns to available slot
- [ ] Quest progress resets to 0
- [ ] Re-accepting generates NEW spawn location
- [ ] Server restart cleans up orphaned mobs from crashes

---

## III. Answers to Your Original Questions

### 1. Quest Board Location
**Answer:** `{ x: 72, y: 75, z: -278 }` in the Overworld

### 2. Existing Quest System Integration
**Answer:**
- Quest generation: [QuestGenerator.js](c:/Users/josep/Documents/SuperQuester/packs/QuestSystemBP/scripts/systems/QuestGenerator.js)
- Quest storage: [PersistenceManager.js](c:/Users/josep/Documents/SuperQuester/packs/QuestSystemBP/scripts/systems/PersistenceManager.js) using `player.setDynamicProperty()`
- Quest UI: [main.js:1100-1400](c:/Users/josep/Documents/SuperQuester/packs/QuestSystemBP/scripts/main.js) (ActionFormData-based board)
- Common quests: Yes, working properly (70% generation rate)
- Data persistence: Player-level dynamic properties (JSON serialized)

### 3. Current Reward System
**Answer:**
- `awardSuperPoints()` → Not a standalone function, but integrated into `handleQuestTurnIn()`
- SP economy: Fully implemented via [SPManager.js](c:/Users/josep/Documents/SuperQuester/packs/QuestSystemBP/scripts/systems/SPManager.js)
- Reward calculation: [RewardCalculator.js](c:/Users/josep/Documents/SuperQuester/packs/QuestSystemBP/scripts/systems/RewardCalculator.js) (base + jackpot + streak + first-of-day)
- Scoreboard: "SuperPoints" objective (authoritative) + backup in dynamic properties

**Integration:** Encounter quests will use the exact same reward pipeline. SP value is stamped on quest at generation time, then modified by completion bonuses.

### 4. Player Death Handling
**Answer:** Current system has NO explicit death handler. Progress persists because:
- Quest data is saved after every kill
- Player respawning doesn't clear active quest
- Encounter mobs remain spawned

**For Encounters:** We should add explicit death handling in Phase 4:
```javascript
world.afterEvents.playerDie.subscribe((event) => {
  // Do nothing - encounters persist through death per spec
  // But could add optional respawn notification
});
```

### 5. One Active Encounter Limitation
**Answer:** Already enforced by current architecture:
- Player data has single `active` slot (not array)
- Cannot accept new quest while one is active
- This applies to ALL quest types (kill, mine, gather, encounter)

**No changes needed** - encounters automatically inherit this constraint.

---

## IV. Technical Concerns Addressed

### 1. Mob Spawning Timing (Async vs Sync)
**Solution:** Make all spawning async from Phase 2 onward:
```javascript
async function handleQuestAccept(player, slotIndex) {
  // ... existing validation ...

  if (quest.isEncounter) {
    const location = await LocationValidator.findValidSpawnLocation(...);
    await EncounterSpawner.spawnEncounterMobs(quest, location, dimension);
  }

  // ... save & notify ...
}
```

### 2. Chunk Loading
**Solution:** Use Minecraft's `dimension.getTopmostBlock()` which handles chunk loading automatically. If chunk not loaded, it returns `undefined` and we retry with different location (within 20 attempts).

For spawning, use `system.runTimeout()` to defer spawn by 1 tick if needed:
```javascript
export async function spawnEncounterMobs(quest, location, dimension) {
  return new Promise((resolve) => {
    system.runTimeout(() => {
      const entityIds = [];
      // ... spawn logic ...
      resolve(entityIds);
    }, 1);
  });
}
```

### 3. Dimension Assumption
**Solution:** Current quest system works only in Overworld (players are teleported to hub on spawn). Encounters will follow same pattern:
- Only spawn in "overworld" dimension
- If future expansion needed, store `dimensionId` in `spawnData`

### 4. Entity ID Tracking
**Solution:** Phase 2 will immediately implement `spawnedEntityIds` array:
```javascript
quest.spawnData = {
  location: { x, y, z },
  spawnedEntityIds: [entity1.id, entity2.id, ...],
  dimensionId: "overworld"
};
```

This enables:
- Targeted despawning (filter by ID)
- Orphan detection (check if entity still exists)
- Debug tooling (list active encounter mobs)

---

## V. Recommended Debug Commands

Add these to chat command handler for testing:

```javascript
// In main.js beforeEvents.chatSend handler

if (message === "!encounter debug spawn skeleton_warband") {
  // Force spawn encounter at player location
  const encounter = EncounterTable.ENCOUNTER_TABLE.find(e => e.id === "skeleton_warband");
  const location = player.location;
  EncounterSpawner.spawnEncounterMobs({ id: "debug", encounterMobs: encounter.mobs }, location, player.dimension);
  return true;
}

if (message === "!encounter debug cleanup") {
  // Force orphan cleanup
  EncounterSpawner.cleanupOrphanedMobs();
  player.sendMessage("§aOrphan cleanup completed");
  return true;
}

if (message === "!encounter debug complete") {
  // Force complete active encounter
  const questData = await PersistenceManager.loadQuestData(player.id);
  if (questData.active && questData.active.isEncounter) {
    questData.active.progress = questData.active.totalMobCount;
    await PersistenceManager.saveQuestData(player.id, questData);
    player.sendMessage("§aEncounter marked complete - return to board");
  }
  return true;
}

if (message === "!encounter debug info") {
  // Show active encounter details
  const questData = await PersistenceManager.loadQuestData(player.id);
  if (questData.active && questData.active.isEncounter) {
    const q = questData.active;
    player.sendMessage(`§eActive: ${q.encounterName}`);
    player.sendMessage(`§fProgress: ${q.progress}/${q.totalMobCount}`);
    player.sendMessage(`§7Location: ${q.spawnData?.location.x}, ${q.spawnData?.location.y}, ${q.spawnData?.location.z}`);
    player.sendMessage(`§7Spawned IDs: ${q.spawnData?.spawnedEntityIds.length || 0}`);
  } else {
    player.sendMessage("§cNo active encounter");
  }
  return true;
}
```

---

## VI. Implementation Checklist

### Pre-Phase 1
- [ ] Create git branch: `feature/encounter-system`
- [ ] Backup current world save
- [ ] Document current SP economy state (for comparison)
- [ ] Test current quest system (complete 3 quests as baseline)

### Phase 1: Data Structures
- [ ] Create `/scripts/data/EncounterTable.js`
- [ ] Create `/scripts/systems/EncounterManager.js`
- [ ] Modify `QuestGenerator.js` to roll encounters
- [ ] Test: Accept Rare quest, verify encounter data in quest object
- [ ] Test: Quest board UI shows encounter name/description

### Phase 2: Basic Spawning
- [ ] Create `/scripts/systems/EncounterSpawner.js`
- [ ] Modify `handleQuestAccept()` for test spawning
- [ ] Modify `handleEntityDeath()` for tag-based tracking
- [ ] Modify `handleQuestTurnIn()` for despawn
- [ ] Modify `handleQuestAbandon()` for despawn
- [ ] Test: Spawn, kill all mobs, turn in, receive SP
- [ ] Test: Abandon, verify mobs despawn

### Phase 3: Ring Spawning
- [ ] Manually select 6 fallback coordinates (3 rare, 3 legendary)
- [ ] Create `/scripts/systems/LocationValidator.js`
- [ ] Modify `handleQuestAccept()` to use ring-based spawning
- [ ] Test: 10 rare spawns (verify 60-120 block distance)
- [ ] Test: 10 legendary spawns (verify 100-200 block distance)
- [ ] Test: Fallback triggers on ocean/lava spawn attempts

### Phase 4: Persistence
- [ ] Modify `playerLeave` event for despawn
- [ ] Modify `playerSpawn` event for respawn
- [ ] Add `respawnRemainingMobs()` to EncounterSpawner
- [ ] Test: Accept quest, kill 3/6 mobs, logout, login, verify 3 respawn
- [ ] Test: Complete quest, logout before turn-in, login, verify turn-in works

### Phase 5: Cleanup
- [ ] Add `cleanupOrphanedMobs()` to EncounterSpawner
- [ ] Call cleanup on world init
- [ ] Add "Manage" button to Active tab UI
- [ ] Test: Server restart with active encounter, verify cleanup
- [ ] Test: Abandon via UI button

### Post-Implementation
- [ ] Playtest 5 rare encounters (record SP earned, time to complete)
- [ ] Playtest 3 legendary encounters
- [ ] Document any bugs/edge cases
- [ ] Tune rewards if needed (via EconomyConfig.js)
- [ ] Merge to main branch

---

## VII. Risk Mitigation

| Risk | Mitigation Strategy |
|------|---------------------|
| Save file bloat | Only store `spawnData` for active encounters (cleared on completion) |
| Orphaned mobs from crashes | Cleanup on world init, periodic tick check (optional) |
| Spectator griefing | Trust-based (current system has no player whitelist) |
| Concurrent player conflicts | Ring spawning naturally separates encounters (60+ blocks apart) |
| Mob despawn on chunk unload | Store `spawnData.location` and respawn on chunk reload (Phase 4) |
| Quest completion race condition | Always check `progress >= totalMobCount` before turn-in |

---

## VIII. Success Metrics

After full implementation, validate:
- [ ] Rare encounters award 50 SP (before bonuses)
- [ ] Legendary encounters award 150 SP (before bonuses)
- [ ] Encounter quests generate at correct rates (22% rare, 7% legendary)
- [ ] No orphaned mobs after 10 logout/login cycles
- [ ] Spawn locations never in water/lava/leaves (test 50 spawns)
- [ ] Quest board UI performance unchanged (no lag)
- [ ] Player data save file size increase < 2KB per encounter

---

## IX. File Structure (Post-Implementation)

```
scripts/
├── main.js (MODIFIED: accept, turn-in, abandon, logout, login handlers)
├── systems/
│   ├── QuestGenerator.js (MODIFIED: encounter quest generation)
│   ├── EncounterManager.js (NEW: encounter selection logic)
│   ├── EncounterSpawner.js (NEW: spawn/despawn/respawn)
│   └── LocationValidator.js (NEW: terrain validation, fallback)
└── data/
    └── EncounterTable.js (NEW: encounter definitions)
```

---

## X. Next Steps

1. **Review this document** - Confirm architecture aligns with your vision
2. **Select fallback coordinates** - Manually fly to 6 safe locations and record coords
3. **Create feature branch** - `git checkout -b feature/encounter-system`
4. **Proceed to Phase 1** - Start with encounter table creation

**Estimated Implementation Time:**
- Phase 1: Low complexity (data structures only)
- Phase 2: Medium complexity (spawning logic)
- Phase 3: Medium complexity (terrain validation)
- Phase 4: Medium complexity (persistence)
- Phase 5: Low complexity (cleanup)

---

**Ready to proceed?** Once you approve this plan, we'll begin Phase 1 implementation.
