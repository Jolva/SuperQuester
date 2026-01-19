# Super Quester: Encounter System Technical Specification

## Executive Summary

This document specifies the implementation of an encounter-based quest system for Rare and Legendary tier quests. Common quests remain unchanged. Encounter quests spawn curated mob groups at ring-based distances from the quest board, with full persistence across player sessions.

---

## Design Decisions

| Topic | Decision |
|-------|----------|
| Timeout | None - encounters persist indefinitely |
| Logout behavior | Mobs despawn; respawn at original location on login |
| Player death | Progress retained, player continues until complete |
| Concurrent quests | One active encounter per player |
| Multiplayer | Multiple players can have simultaneous encounters |
| Kill attribution | Any player can kill mobs; quest owner receives credit |
| Environmental kills | Count toward completion |
| Abandon behavior | Quest returns to player's board unchanged; mobs despawn |
| Terrain validation | Raycast from sky, reject water/lava/leaves, 20 attempts max |
| Spawn fallback | Pre-defined safe coordinates per zone |

---

## Phase 1: Encounter Data Structures & Tables

### Objective
Establish the data layer for encounters. No spawning yet - this phase wires encounter definitions into quest generation for Rare and Legendary tiers.

### 1.1 Encounter Definition Schema

```javascript
const EncounterDefinition = {
  id: string,                    // Unique identifier, e.g., "skeleton_warband"
  name: string,                  // Display name, e.g., "Skeleton Warband"
  description: string,           // Quest board description
  tier: "rare" | "legendary",    // Which quest tier can roll this
  mobs: [
    {
      type: string,              // Entity ID, e.g., "minecraft:skeleton"
      count: number,             // How many to spawn
      equipment: object | null,  // Optional: armor, weapons
      nameTag: string | null     // Optional: display name
    }
  ],
  totalMobCount: number          // Sum of all mob counts (computed)
};
```

### 1.2 Encounter Table (Initial Set)

```javascript
const ENCOUNTER_TABLE = [
  // === RARE TIER ===
  {
    id: "skeleton_warband",
    name: "Skeleton Warband",
    description: "A group of skeletal warriors has assembled nearby.",
    tier: "rare",
    mobs: [
      { type: "minecraft:skeleton", count: 5, equipment: null, nameTag: null }
    ],
    totalMobCount: 5
  },
  {
    id: "zombie_pack",
    name: "Shambling Horde",
    description: "The dead are walking. Put them down.",
    tier: "rare",
    mobs: [
      { type: "minecraft:zombie", count: 6, equipment: null, nameTag: null }
    ],
    totalMobCount: 6
  },
  {
    id: "spider_nest",
    name: "Spider Nest",
    description: "Arachnids have infested the area.",
    tier: "rare",
    mobs: [
      { type: "minecraft:spider", count: 4, equipment: null, nameTag: null },
      { type: "minecraft:cave_spider", count: 2, equipment: null, nameTag: null }
    ],
    totalMobCount: 6
  },
  {
    id: "creeper_cluster",
    name: "Creeper Problem",
    description: "Something hisses in the shadows...",
    tier: "rare",
    mobs: [
      { type: "minecraft:creeper", count: 3, equipment: null, nameTag: null }
    ],
    totalMobCount: 3
  },

  // === LEGENDARY TIER ===
  {
    id: "skeleton_legion",
    name: "Skeleton Legion",
    description: "An organized force of the undead marches on the realm.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:skeleton", count: 8, equipment: null, nameTag: null },
      { type: "minecraft:stray", count: 3, equipment: null, nameTag: "Frost Archer" }
    ],
    totalMobCount: 11
  },
  {
    id: "zombie_siege",
    name: "Zombie Siege",
    description: "A massive horde approaches. Hold the line.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:zombie", count: 10, equipment: null, nameTag: null },
      { type: "minecraft:husk", count: 4, equipment: null, nameTag: null }
    ],
    totalMobCount: 14
  },
  {
    id: "phantom_swarm",
    name: "Phantom Swarm",
    description: "Nightmares made flesh circle overhead.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:phantom", count: 6, equipment: null, nameTag: null }
    ],
    totalMobCount: 6
  },
  {
    id: "witch_coven",
    name: "Witch Coven",
    description: "Dark magic corrupts this land.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:witch", count: 3, equipment: null, nameTag: null },
      { type: "minecraft:zombie_villager", count: 4, equipment: null, nameTag: "Cursed Villager" }
    ],
    totalMobCount: 7
  }
];
```

### 1.3 Quest Generation Integration

Modify quest generation for Rare and Legendary tiers:

```javascript
function generateEncounterQuest(tier, playerId) {
  // Filter encounters by tier
  const availableEncounters = ENCOUNTER_TABLE.filter(e => e.tier === tier);
  
  // Random selection
  const encounter = availableEncounters[Math.floor(Math.random() * availableEncounters.length)];
  
  return {
    questId: generateUniqueId(),
    playerId: playerId,
    type: "encounter",
    tier: tier,
    encounterId: encounter.id,
    encounterName: encounter.name,
    description: encounter.description,
    mobs: structuredClone(encounter.mobs),  // Deep copy
    totalMobCount: encounter.totalMobCount,
    mobsKilled: 0,
    status: "available",  // available | active | complete
    spawnLocation: null,  // Set in Phase 3
    assignedAt: null,     // Timestamp when accepted
  };
}
```

### 1.4 Validation Criteria

- [ ] Encounter table loads without errors
- [ ] `generateEncounterQuest("rare")` returns valid rare encounters
- [ ] `generateEncounterQuest("legendary")` returns valid legendary encounters
- [ ] Quest object contains all required fields
- [ ] Rare/Legendary quests on board display encounter names and descriptions

---

## Phase 2: Basic Mob Spawning

### Objective
Spawn encounter mobs at a fixed test location near the quest board. Validate tagging, kill tracking, and completion detection before adding spatial complexity.

### 2.1 Test Spawn Location

For Phase 2 only, spawn mobs 30 blocks from the quest board in a known safe direction:

```javascript
const TEST_SPAWN_OFFSET = { x: 30, y: 0, z: 0 };

function getTestSpawnLocation(questBoardPos) {
  return {
    x: questBoardPos.x + TEST_SPAWN_OFFSET.x,
    y: questBoardPos.y,
    z: questBoardPos.z + TEST_SPAWN_OFFSET.z
  };
}
```

### 2.2 Mob Tagging System

Every spawned mob must be tagged to its quest instance:

```javascript
function spawnEncounterMobs(quest, spawnLocation, dimension) {
  const spawnedEntities = [];
  
  for (const mobGroup of quest.mobs) {
    for (let i = 0; i < mobGroup.count; i++) {
      // Slight position variance to prevent stacking
      const variance = {
        x: (Math.random() - 0.5) * 6,
        z: (Math.random() - 0.5) * 6
      };
      
      const spawnPos = {
        x: spawnLocation.x + variance.x,
        y: spawnLocation.y,
        z: spawnLocation.z + variance.z
      };
      
      const entity = dimension.spawnEntity(mobGroup.type, spawnPos);
      
      // Tag with quest ID for tracking
      entity.addTag(`sq_quest_${quest.questId}`);
      entity.addTag("sq_encounter_mob");
      
      // Optional name tag
      if (mobGroup.nameTag) {
        entity.nameTag = mobGroup.nameTag;
      }
      
      spawnedEntities.push(entity.id);
    }
  }
  
  return spawnedEntities;
}
```

### 2.3 Kill Tracking

Subscribe to entity death events:

```javascript
import { world } from "@minecraft/server";

world.afterEvents.entityDie.subscribe((event) => {
  const entity = event.deadEntity;
  
  // Check if this is an encounter mob
  if (!entity.hasTag("sq_encounter_mob")) return;
  
  // Find which quest this mob belongs to
  const questTag = entity.getTags().find(tag => tag.startsWith("sq_quest_"));
  if (!questTag) return;
  
  const questId = questTag.replace("sq_quest_", "");
  
  // Update quest progress
  incrementQuestKillCount(questId);
});

function incrementQuestKillCount(questId) {
  const quest = getActiveQuest(questId);
  if (!quest) return;
  
  quest.mobsKilled++;
  saveQuestState(quest);
  
  // Check completion
  if (quest.mobsKilled >= quest.totalMobCount) {
    completeEncounterQuest(quest);
  } else {
    // Notify player of progress
    notifyProgress(quest.playerId, quest.mobsKilled, quest.totalMobCount);
  }
}
```

### 2.4 Completion Handler

```javascript
function completeEncounterQuest(quest) {
  quest.status = "complete";
  
  // Award SP based on tier
  const rewards = {
    rare: 50,
    legendary: 150
  };
  
  awardSuperPoints(quest.playerId, rewards[quest.tier]);
  
  // Notify player
  const player = world.getPlayers().find(p => p.id === quest.playerId);
  if (player) {
    player.sendMessage(`§6Quest Complete: ${quest.encounterName}!`);
    player.playSound("random.levelup");
  }
  
  // Cleanup
  removeQuestFromActive(quest.questId);
  
  // Generate replacement quest for board
  generateReplacementQuest(quest.playerId, quest.tier);
}
```

### 2.5 Validation Criteria

- [ ] Accepting a Rare/Legendary quest spawns mobs 30 blocks from board
- [ ] All spawned mobs have correct tags
- [ ] Killing a tagged mob increments `mobsKilled`
- [ ] Player receives progress notification after each kill
- [ ] Killing all mobs triggers completion
- [ ] SP awarded correctly (50 for Rare, 150 for Legendary)
- [ ] Environmental kills (lava, fall damage) count
- [ ] Kills by other players count toward quest owner's progress

---

## Phase 3: Ring-Based Spawning

### Objective
Replace fixed test location with ring-based random spawning. Implement terrain validation and fallback system.

### 3.1 Ring Configuration

```javascript
const RING_CONFIG = {
  rare: {
    innerRadius: 60,
    outerRadius: 120
  },
  legendary: {
    innerRadius: 100,
    outerRadius: 200
  }
  // Future: mythic with overlapping range
};
```

### 3.2 Random Point in Ring

```javascript
function getRandomPointInRing(centerX, centerZ, innerRadius, outerRadius) {
  // Random angle
  const angle = Math.random() * 2 * Math.PI;
  
  // Random distance (weighted toward outer edge for even distribution)
  const minR2 = innerRadius * innerRadius;
  const maxR2 = outerRadius * outerRadius;
  const distance = Math.sqrt(Math.random() * (maxR2 - minR2) + minR2);
  
  return {
    x: Math.floor(centerX + distance * Math.cos(angle)),
    z: Math.floor(centerZ + distance * Math.sin(angle))
  };
}
```

### 3.3 Terrain Validation

```javascript
const INVALID_SPAWN_BLOCKS = [
  "minecraft:water",
  "minecraft:lava",
  "minecraft:flowing_water",
  "minecraft:flowing_lava",
  "minecraft:leaves",
  "minecraft:leaves2",
  "minecraft:azalea_leaves",
  "minecraft:azalea_leaves_flowered",
  "minecraft:oak_leaves",
  "minecraft:spruce_leaves",
  "minecraft:birch_leaves",
  "minecraft:jungle_leaves",
  "minecraft:acacia_leaves",
  "minecraft:dark_oak_leaves",
  "minecraft:mangrove_leaves",
  "minecraft:cherry_leaves"
];

async function findValidSpawnLocation(dimension, centerX, centerZ, tier, maxAttempts = 20) {
  const ring = RING_CONFIG[tier];
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const point = getRandomPointInRing(centerX, centerZ, ring.innerRadius, ring.outerRadius);
    
    // Get topmost block at this XZ
    const topBlock = dimension.getTopmostBlock({ x: point.x, z: point.z });
    
    if (!topBlock) continue;  // Void or unloaded chunk
    
    const blockType = topBlock.typeId;
    
    // Check if block type is valid
    if (INVALID_SPAWN_BLOCKS.includes(blockType)) continue;
    
    // Check for air above
    const blockAbove = dimension.getBlock({
      x: point.x,
      y: topBlock.y + 1,
      z: point.z
    });
    
    if (blockAbove && blockAbove.typeId !== "minecraft:air") continue;
    
    // Valid location found
    return {
      x: point.x,
      y: topBlock.y + 1,  // Spawn on top of the block
      z: point.z
    };
  }
  
  // All attempts failed - use fallback
  return null;
}
```

### 3.4 Fallback Locations

```javascript
// Configure these based on your world - pick 3 known safe spots per tier
const FALLBACK_LOCATIONS = {
  rare: [
    { x: 100, y: 64, z: 50 },
    { x: -80, y: 70, z: 100 },
    { x: 60, y: 65, z: -90 }
  ],
  legendary: [
    { x: 180, y: 68, z: 120 },
    { x: -150, y: 72, z: 160 },
    { x: 140, y: 66, z: -170 }
  ]
};

function getFallbackLocation(tier) {
  const locations = FALLBACK_LOCATIONS[tier];
  return locations[Math.floor(Math.random() * locations.length)];
}
```

### 3.5 Updated Spawn Flow

```javascript
async function activateEncounterQuest(quest, questBoardPos, dimension) {
  // Find valid spawn location
  let spawnLocation = await findValidSpawnLocation(
    dimension,
    questBoardPos.x,
    questBoardPos.z,
    quest.tier
  );
  
  // Use fallback if no valid location found
  if (!spawnLocation) {
    spawnLocation = getFallbackLocation(quest.tier);
    console.warn(`Using fallback location for quest ${quest.questId}`);
  }
  
  // Store location for persistence
  quest.spawnLocation = spawnLocation;
  quest.status = "active";
  quest.assignedAt = Date.now();
  
  // Spawn the mobs
  spawnEncounterMobs(quest, spawnLocation, dimension);
  
  // Save quest state
  saveQuestState(quest);
  
  // Notify player
  const player = world.getPlayers().find(p => p.id === quest.playerId);
  if (player) {
    const distance = Math.floor(Math.sqrt(
      Math.pow(spawnLocation.x - questBoardPos.x, 2) +
      Math.pow(spawnLocation.z - questBoardPos.z, 2)
    ));
    player.sendMessage(`§e${quest.encounterName} §fawaits §c${distance} blocks §faway.`);
  }
}
```

### 3.6 Validation Criteria

- [ ] Rare encounters spawn within 60-120 blocks of board
- [ ] Legendary encounters spawn within 100-200 blocks of board
- [ ] No spawns occur on water, lava, or tree canopy
- [ ] Fallback triggers after 20 failed attempts
- [ ] Player receives distance notification on quest accept
- [ ] Spawn location is saved to quest state

---

## Phase 4: Logout/Login Persistence

### Objective
Handle player disconnection gracefully. Despawn mobs on logout, respawn at original location on login.

### 4.1 Quest State Schema (Expanded)

```javascript
const PersistedQuestState = {
  questId: string,
  playerId: string,
  type: "encounter",
  tier: string,
  encounterId: string,
  encounterName: string,
  mobs: array,           // Original mob composition
  totalMobCount: number,
  mobsKilled: number,    // Progress
  status: string,
  spawnLocation: {       // Original spawn point
    x: number,
    y: number,
    z: number
  },
  assignedAt: number,
  spawnedEntityIds: array  // Track spawned mobs for cleanup
};
```

### 4.2 Player Leave Handler

```javascript
world.afterEvents.playerLeave.subscribe((event) => {
  const playerId = event.playerId;
  
  // Find active encounter for this player
  const quest = getActiveEncounterQuest(playerId);
  if (!quest) return;
  
  // Despawn all encounter mobs
  despawnEncounterMobs(quest);
  
  // Quest state persists - don't remove it
  console.log(`Player ${playerId} logged out. Encounter mobs despawned, quest preserved.`);
});

function despawnEncounterMobs(quest) {
  const dimension = world.getDimension("overworld");
  
  // Find all entities with this quest's tag
  const tagToFind = `sq_quest_${quest.questId}`;
  
  for (const entity of dimension.getEntities()) {
    if (entity.hasTag(tagToFind)) {
      entity.remove();
    }
  }
  
  // Clear spawned entity IDs
  quest.spawnedEntityIds = [];
  saveQuestState(quest);
}
```

### 4.3 Player Join Handler

```javascript
world.afterEvents.playerSpawn.subscribe((event) => {
  // Only handle initial spawns, not respawns after death
  if (!event.initialSpawn) return;
  
  const player = event.player;
  
  // Check for persisted active encounter
  const quest = getActiveEncounterQuest(player.id);
  if (!quest || quest.status !== "active") return;
  
  // Calculate remaining mobs
  const remainingMobs = calculateRemainingMobs(quest);
  
  if (remainingMobs.length === 0) {
    // Quest was actually complete
    completeEncounterQuest(quest);
    return;
  }
  
  // Respawn remaining mobs at original location
  const dimension = world.getDimension("overworld");
  respawnRemainingMobs(quest, remainingMobs, dimension);
  
  // Notify player
  const remaining = quest.totalMobCount - quest.mobsKilled;
  player.sendMessage(`§eYour encounter persists. §f${remaining} enemies remain.`);
});

function calculateRemainingMobs(quest) {
  // Figure out what's left to spawn based on kills
  let killsRemaining = quest.totalMobCount - quest.mobsKilled;
  const remaining = [];
  
  for (const mobGroup of quest.mobs) {
    if (killsRemaining <= 0) break;
    
    const countFromThisGroup = Math.min(mobGroup.count, killsRemaining);
    if (countFromThisGroup > 0) {
      remaining.push({
        ...mobGroup,
        count: countFromThisGroup
      });
      killsRemaining -= countFromThisGroup;
    }
  }
  
  return remaining;
}

function respawnRemainingMobs(quest, remainingMobs, dimension) {
  const spawnLocation = quest.spawnLocation;
  
  for (const mobGroup of remainingMobs) {
    for (let i = 0; i < mobGroup.count; i++) {
      const variance = {
        x: (Math.random() - 0.5) * 6,
        z: (Math.random() - 0.5) * 6
      };
      
      const spawnPos = {
        x: spawnLocation.x + variance.x,
        y: spawnLocation.y,
        z: spawnLocation.z + variance.z
      };
      
      const entity = dimension.spawnEntity(mobGroup.type, spawnPos);
      entity.addTag(`sq_quest_${quest.questId}`);
      entity.addTag("sq_encounter_mob");
      
      if (mobGroup.nameTag) {
        entity.nameTag = mobGroup.nameTag;
      }
    }
  }
}
```

### 4.4 Validation Criteria

- [ ] Logging out despawns all encounter mobs
- [ ] Quest progress (mobsKilled) persists through logout
- [ ] Logging back in respawns only remaining mobs
- [ ] Mobs respawn at original location, not new random spot
- [ ] Player receives "encounter persists" message on login
- [ ] If quest was completed before logout processed, completion triggers on login

---

## Phase 5: Abandon Flow

### Objective
Allow players to abandon active encounters cleanly. Quest returns to board, mobs despawn.

### 5.1 Abandon Handler

```javascript
function abandonEncounterQuest(playerId) {
  const quest = getActiveEncounterQuest(playerId);
  if (!quest) {
    return { success: false, reason: "No active encounter" };
  }
  
  // Despawn all mobs
  despawnEncounterMobs(quest);
  
  // Reset quest state
  quest.status = "available";
  quest.mobsKilled = 0;
  quest.spawnLocation = null;
  quest.assignedAt = null;
  quest.spawnedEntityIds = [];
  
  // Return to player's board (not re-rolled)
  returnQuestToBoard(quest);
  
  // Notify player
  const player = world.getPlayers().find(p => p.id === playerId);
  if (player) {
    player.sendMessage(`§7Quest abandoned: ${quest.encounterName}`);
  }
  
  return { success: true };
}
```

### 5.2 Board Interaction Update

When player interacts with quest board while having an active encounter:

```javascript
function handleBoardInteraction(player) {
  const activeQuest = getActiveEncounterQuest(player.id);
  
  if (activeQuest && activeQuest.status === "active") {
    // Show "active quest" UI with abandon option
    showActiveQuestUI(player, activeQuest);
  } else {
    // Show normal quest board
    showQuestBoardUI(player);
  }
}

function showActiveQuestUI(player, quest) {
  const form = new ActionFormData()
    .title("Active Encounter")
    .body(`§e${quest.encounterName}\n\n§fProgress: ${quest.mobsKilled}/${quest.totalMobCount}\n§7${quest.description}`)
    .button("Continue Quest")
    .button("§cAbandon Quest");
  
  form.show(player).then((response) => {
    if (response.selection === 1) {
      abandonEncounterQuest(player.id);
    }
  });
}
```

### 5.3 Orphan Prevention

On server start, clean up any orphaned mobs (from crashes, etc.):

```javascript
function cleanupOrphanedMobs() {
  const dimension = world.getDimension("overworld");
  let cleaned = 0;
  
  for (const entity of dimension.getEntities()) {
    if (entity.hasTag("sq_encounter_mob")) {
      // Check if corresponding quest exists and is active
      const questTag = entity.getTags().find(tag => tag.startsWith("sq_quest_"));
      if (questTag) {
        const questId = questTag.replace("sq_quest_", "");
        const quest = getQuest(questId);
        
        if (!quest || quest.status !== "active") {
          entity.remove();
          cleaned++;
        }
      } else {
        // No quest tag - orphan
        entity.remove();
        cleaned++;
      }
    }
  }
  
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} orphaned encounter mobs`);
  }
}

// Run on world load
world.afterEvents.worldInitialize.subscribe(() => {
  cleanupOrphanedMobs();
});
```

### 5.4 Validation Criteria

- [ ] Abandoning quest despawns all associated mobs
- [ ] Abandoned quest returns to board with status "available"
- [ ] Quest progress resets to 0 on abandon
- [ ] Player can immediately re-accept the same quest
- [ ] Re-accepting generates new spawn location
- [ ] Server restart cleans up any orphaned mobs

---

## Data Persistence Strategy

All quest state must survive server restarts. Use dynamic properties on the world:

```javascript
const QUEST_STORAGE_KEY = "sq_encounter_quests";

function saveAllQuests(quests) {
  world.setDynamicProperty(QUEST_STORAGE_KEY, JSON.stringify(quests));
}

function loadAllQuests() {
  const data = world.getDynamicProperty(QUEST_STORAGE_KEY);
  return data ? JSON.parse(data) : {};
}
```

---

## Reward Tuning (Reference)

| Tier | SP Reward | Typical Mob Count |
|------|-----------|-------------------|
| Rare | 50 SP | 3-6 mobs |
| Legendary | 150 SP | 6-14 mobs |

These values should be tuned based on playtest feedback.

---

## Future Considerations (Not In Scope)

- **Mythic tier**: Overlapping ring range, boss mobs, special mechanics
- **Navigation system**: Directional HUD guidance to encounter location
- **Encounter modifiers**: Armored variants, buffs, environmental effects
- **Time-limited encounters**: Optional pressure for experienced players

---

## Implementation Order

1. **Phase 1**: Encounter data structures & tables
2. **Phase 2**: Basic mob spawning (fixed test location)
3. **Phase 3**: Ring-based spawning with terrain validation
4. **Phase 4**: Logout/login persistence
5. **Phase 5**: Abandon flow

Each phase should be fully tested before proceeding to the next.
