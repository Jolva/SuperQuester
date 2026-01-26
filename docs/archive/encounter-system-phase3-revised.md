# Super Quester: Encounter System — Phase 3 Implementation (Revised)

**Phase:** 3 of 5
**Focus:** Proximity-Based Encounter Spawning
**Branch:** `feature/encounter-system`
**Prerequisite:** Phase 2 complete (roll back Phase 3 changes if needed)
**Validates:** Zone assignment, proximity detection, terrain validation on arrival, two-stage spawn flow

---

## Why This Revision?

The original Phase 3 attempted terrain validation at quest accept time. This fails because chunks 60-200 blocks away aren't loaded — Bedrock throws `LocationInUnloadedChunkError`.

**New approach:** Assign an encounter zone on accept, spawn mobs when player arrives. Terrain validation works because the player's presence loads the chunks.

---

## New Encounter Flow

```
1. Player accepts quest
   └─→ Pick zone center (ring geometry, no validation needed)
   └─→ Store zone center on quest
   └─→ "Skeleton Warband awaits ~95 blocks away"
   └─→ "Location: 167, -267" (zone center)

2. Player travels toward zone
   └─→ Tick listener monitors distance

3. Player enters zone threshold (50 blocks from center)
   └─→ "The enemy is near!"
   └─→ Scan for valid spawn point (player is here, chunks loaded)
   └─→ Find spot 40-60 blocks from player (loaded but not visible)
   └─→ Spawn mobs
   └─→ "The enemy approaches!"
   └─→ Mark encounter as spawned

4. Combat & completion (unchanged from Phase 2)
```

---

## Quest State Changes

**New fields on encounter quest:**

```javascript
{
  // ... existing fields ...
  
  encounterZone: {
    center: { x: number, y: number, z: number },  // Ring point (assigned on accept)
    radius: 50,                                     // Threshold to trigger spawn
    tier: "rare" | "legendary"
  },
  
  encounterState: "pending" | "spawned" | "complete",  // NEW: Track spawn status
  
  spawnData: null | {                              // Populated when mobs actually spawn
    location: { x: number, y: number, z: number },
    spawnedEntityIds: string[],
    dimensionId: string
  }
}
```

**State transitions:**
- `pending`: Quest accepted, zone assigned, mobs not yet spawned
- `spawned`: Player arrived, mobs in world
- `complete`: All mobs killed (ready for turn-in)

---

## Ring Configuration (Unchanged)

**Quest Board Location:** `{ x: 72, y: 75, z: -278 }`

| Tier | Inner Radius | Outer Radius |
|------|--------------|--------------|
| Rare | 60 blocks | 120 blocks |
| Legendary | 100 blocks | 200 blocks |

---

## Files to Create

### 1. `/scripts/systems/LocationValidator.js` (Revised)

```javascript
/**
 * LocationValidator.js (Revised)
 * 
 * Handles:
 * - Ring-based zone center selection (no terrain validation)
 * - Proximity-based spawn point finding (when player arrives)
 * - Terrain validation (only called when chunks are loaded)
 */

import { world } from "@minecraft/server";

// === CONFIGURATION ===

const QUEST_BOARD_POS = { x: 72, z: -278 };

const RING_CONFIG = {
  rare: {
    innerRadius: 60,
    outerRadius: 120
  },
  legendary: {
    innerRadius: 100,
    outerRadius: 200
  }
};

// Zone threshold - how close player must be to trigger spawn
const ZONE_TRIGGER_RADIUS = 50;

// Spawn distance from player when they arrive
const SPAWN_DISTANCE = {
  inner: 40,  // Far enough they don't see pop-in
  outer: 60   // Close enough to be in loaded chunks
};

const MAX_SPAWN_ATTEMPTS = 15;

const INVALID_SPAWN_BLOCKS = [
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava",
  "minecraft:leaves",
  "minecraft:leaves2",
  "minecraft:oak_leaves",
  "minecraft:spruce_leaves",
  "minecraft:birch_leaves",
  "minecraft:jungle_leaves",
  "minecraft:acacia_leaves",
  "minecraft:dark_oak_leaves",
  "minecraft:mangrove_leaves",
  "minecraft:cherry_leaves",
  "minecraft:azalea_leaves",
  "minecraft:azalea_leaves_flowered",
  "minecraft:cactus",
  "minecraft:sweet_berry_bush",
  "minecraft:powder_snow"
];

// === FALLBACK LOCATIONS ===
// Pre-scouted safe spots (used if terrain validation fails even with loaded chunks)

const FALLBACK_LOCATIONS = {
  rare: [
    { x: 117, y: 69, z: -362 },
    { x: 167, y: 63, z: -267 },
    { x: 140, y: 68, z: -195 }
  ],
  legendary: [
    { x: 220, y: 63, z: -319 },
    { x: 239, y: 63, z: -258 },
    { x: 156, y: 63, z: -117 }
  ]
};

// === RING GEOMETRY ===

/**
 * Get a random point within a ring (annulus)
 * Uses square root distribution for even area coverage
 */
export function getRandomPointInRing(centerX, centerZ, innerRadius, outerRadius) {
  const angle = Math.random() * 2 * Math.PI;
  const minR2 = innerRadius * innerRadius;
  const maxR2 = outerRadius * outerRadius;
  const distance = Math.sqrt(Math.random() * (maxR2 - minR2) + minR2);
  
  return {
    x: Math.floor(centerX + distance * Math.cos(angle)),
    z: Math.floor(centerZ + distance * Math.sin(angle))
  };
}

/**
 * Calculate distance between two points (XZ plane)
 */
export function calculateDistance(point1, point2) {
  return Math.floor(Math.sqrt(
    Math.pow(point1.x - point2.x, 2) +
    Math.pow(point1.z - point2.z, 2)
  ));
}

/**
 * Get cardinal direction from one point to another
 */
export function getDirection(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  
  // Determine primary direction
  const absX = Math.abs(dx);
  const absZ = Math.abs(dz);
  
  let direction = "";
  
  if (absZ > absX * 0.5) {
    direction += dz < 0 ? "north" : "south";
  }
  if (absX > absZ * 0.5) {
    direction += dx > 0 ? "east" : "west";
  }
  
  return direction || "nearby";
}

// === ZONE SELECTION (Called on quest accept) ===

/**
 * Select an encounter zone center point
 * NO terrain validation - just picks a point in the ring
 * 
 * @param {string} tier - "rare" or "legendary"
 * @returns {{center: {x, y, z}, radius: number, tier: string}} Zone definition
 */
export function selectEncounterZone(tier) {
  const ring = RING_CONFIG[tier];
  
  if (!ring) {
    console.error(`[LocationValidator] Unknown tier: ${tier}`);
    return null;
  }
  
  const point = getRandomPointInRing(
    QUEST_BOARD_POS.x,
    QUEST_BOARD_POS.z,
    ring.innerRadius,
    ring.outerRadius
  );
  
  // Y coordinate is approximate - will be determined on spawn
  // Use a reasonable default based on typical terrain
  const estimatedY = 65;
  
  return {
    center: { x: point.x, y: estimatedY, z: point.z },
    radius: ZONE_TRIGGER_RADIUS,
    tier: tier
  };
}

// === PROXIMITY CHECKING (Called every tick for active encounters) ===

/**
 * Check if player is within zone trigger radius
 * 
 * @param {Player} player - The player to check
 * @param {{x, y, z}} zoneCenter - Center of encounter zone
 * @returns {boolean} True if player is close enough to trigger spawn
 */
export function isPlayerInZone(player, zoneCenter) {
  const playerPos = player.location;
  const distance = calculateDistance(
    { x: playerPos.x, z: playerPos.z },
    { x: zoneCenter.x, z: zoneCenter.z }
  );
  
  return distance <= ZONE_TRIGGER_RADIUS;
}

// === SPAWN POINT FINDING (Called when player arrives at zone) ===

/**
 * Find a valid spawn point near the player
 * Called ONLY when player is in the zone (chunks are loaded)
 * 
 * @param {Dimension} dimension - Minecraft dimension
 * @param {Player} player - Player who triggered the zone
 * @returns {{x, y, z} | null} Valid spawn location or null
 */
export function findSpawnPointNearPlayer(dimension, player) {
  const playerPos = player.location;
  
  for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt++) {
    // Pick random point 40-60 blocks from player
    const point = getRandomPointInRing(
      playerPos.x,
      playerPos.z,
      SPAWN_DISTANCE.inner,
      SPAWN_DISTANCE.outer
    );
    
    try {
      // Get topmost block - this WILL work because player is nearby
      const topBlock = dimension.getTopmostBlock({ x: point.x, z: point.z });
      
      if (!topBlock) continue;
      
      // Check if surface is valid
      if (INVALID_SPAWN_BLOCKS.includes(topBlock.typeId)) continue;
      
      // Check for air above
      const spawnY = topBlock.y + 1;
      const blockAbove = dimension.getBlock({ x: point.x, y: spawnY, z: point.z });
      
      if (blockAbove && blockAbove.typeId !== "minecraft:air") continue;
      
      // Check second block above for tall mobs
      const blockAbove2 = dimension.getBlock({ x: point.x, y: spawnY + 1, z: point.z });
      
      if (blockAbove2 && blockAbove2.typeId !== "minecraft:air") continue;
      
      console.log(`[LocationValidator] Found valid spawn at ${point.x}, ${spawnY}, ${point.z} (attempt ${attempt + 1})`);
      
      return { x: point.x, y: spawnY, z: point.z };
      
    } catch (error) {
      // Chunk still not loaded (edge case) - try again
      console.warn(`[LocationValidator] Spawn validation failed: ${error}`);
      continue;
    }
  }
  
  console.warn(`[LocationValidator] Failed to find spawn point after ${MAX_SPAWN_ATTEMPTS} attempts`);
  return null;
}

/**
 * Get a fallback spawn location
 * Used if terrain validation fails even with loaded chunks
 * 
 * @param {string} tier - "rare" or "legendary"
 * @returns {{x, y, z}} Fallback coordinates
 */
export function getFallbackLocation(tier) {
  const locations = FALLBACK_LOCATIONS[tier];
  
  if (!locations || locations.length === 0) {
    return { x: QUEST_BOARD_POS.x + 50, y: 65, z: QUEST_BOARD_POS.z };
  }
  
  return locations[Math.floor(Math.random() * locations.length)];
}

// === UTILITY ===

export function getQuestBoardPosition() {
  return { ...QUEST_BOARD_POS };
}

export function getRingConfig(tier) {
  return RING_CONFIG[tier] || null;
}

export function getZoneTriggerRadius() {
  return ZONE_TRIGGER_RADIUS;
}
```

---

### 2. `/scripts/systems/EncounterProximity.js` (New)

```javascript
/**
 * EncounterProximity.js
 * 
 * Tick-based system that monitors player positions and triggers
 * encounter spawns when players enter their assigned zones.
 */

import { world, system } from "@minecraft/server";
import { PersistenceManager } from "./PersistenceManager.js";
import { spawnEncounterMobs } from "./EncounterSpawner.js";
import { 
  isPlayerInZone, 
  findSpawnPointNearPlayer, 
  getFallbackLocation,
  calculateDistance 
} from "./LocationValidator.js";

// Check interval (every 20 ticks = 1 second)
const CHECK_INTERVAL = 20;

let tickCounter = 0;
let isRunning = false;

/**
 * Start the proximity monitoring system
 */
export function startProximityMonitoring() {
  if (isRunning) return;
  
  isRunning = true;
  console.log("[EncounterProximity] Started proximity monitoring");
  
  system.runInterval(() => {
    tickCounter++;
    
    if (tickCounter >= CHECK_INTERVAL) {
      tickCounter = 0;
      checkAllPlayers();
    }
  }, 1);
}

/**
 * Check all online players for zone proximity
 */
async function checkAllPlayers() {
  for (const player of world.getPlayers()) {
    try {
      await checkPlayerProximity(player);
    } catch (error) {
      console.error(`[EncounterProximity] Error checking player ${player.name}: ${error}`);
    }
  }
}

/**
 * Check if a player has entered their encounter zone
 */
async function checkPlayerProximity(player) {
  const questData = await PersistenceManager.loadQuestData(player.id);
  
  // Must have active encounter quest in "pending" state
  if (!questData?.active?.isEncounter) return;
  if (questData.active.encounterState !== "pending") return;
  if (!questData.active.encounterZone) return;
  
  const quest = questData.active;
  const zone = quest.encounterZone;
  
  // Check if player is in the zone
  if (!isPlayerInZone(player, zone.center)) return;
  
  // Player has entered the zone - trigger spawn sequence
  console.log(`[EncounterProximity] Player ${player.name} entered zone for ${quest.encounterName}`);
  
  await triggerEncounterSpawn(player, questData);
}

/**
 * Trigger the encounter spawn sequence
 */
async function triggerEncounterSpawn(player, questData) {
  const quest = questData.active;
  const dimension = player.dimension;
  
  // Stage 1: Alert player
  player.sendMessage(`§c§lThe enemy is near!`);
  player.playSound("mob.wither.spawn", { volume: 0.3 });
  
  // Small delay for dramatic effect (500ms)
  await sleep(500);
  
  // Stage 2: Find spawn location
  let spawnLocation = findSpawnPointNearPlayer(dimension, player);
  
  let usedFallback = false;
  if (!spawnLocation) {
    spawnLocation = getFallbackLocation(quest.encounterZone.tier);
    usedFallback = true;
    console.warn(`[EncounterProximity] Using fallback for ${quest.id}`);
  }
  
  // Stage 3: Spawn the mobs
  const entityIds = spawnEncounterMobs(quest, spawnLocation, dimension);
  
  // Stage 4: Update quest state
  quest.encounterState = "spawned";
  quest.spawnData = {
    location: spawnLocation,
    spawnedEntityIds: entityIds,
    dimensionId: dimension.id
  };
  
  await PersistenceManager.saveQuestData(player.id, questData);
  
  // Stage 5: Alert player
  const distance = calculateDistance(player.location, spawnLocation);
  player.sendMessage(`§e§lThe enemy approaches!`);
  player.sendMessage(`§7${quest.totalMobCount} enemies, ${distance} blocks away`);
  
  if (usedFallback) {
    player.sendMessage(`§7(Spawned at backup location)`);
  }
  
  player.playSound("mob.wither.shoot", { volume: 0.5 });
}

/**
 * Utility: Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => system.runTimeout(resolve, Math.ceil(ms / 50)));
}

/**
 * Stop the proximity monitoring system
 */
export function stopProximityMonitoring() {
  isRunning = false;
  console.log("[EncounterProximity] Stopped proximity monitoring");
}
```

---

## Files to Modify

### 3. `EncounterManager.js` — Update Quest Generation

**Add the `encounterZone` and `encounterState` fields:**

```javascript
import { selectEncounterZone } from "./LocationValidator.js";

export function generateEncounterQuest(tier) {
  const encounter = selectRandomEncounter(tier);
  
  if (!encounter) {
    return null;
  }
  
  // Select encounter zone (just coordinates, no terrain validation)
  const zone = selectEncounterZone(tier);
  
  if (!zone) {
    return null;
  }
  
  const rewardCalc = calculateBaseQuestReward(tier, "kill", encounter.totalMobCount);
  
  const rarityToMultiplier = {
    "common": 1,
    "rare": 2,
    "legendary": 5,
    "mythic": 10
  };
  const itemMultiplier = rarityToMultiplier[tier] || 1;
  const baseDiamonds = Math.ceil(encounter.totalMobCount / 10);
  const rewardItems = [{
    typeId: "minecraft:diamond",
    amount: Math.max(1, Math.ceil(baseDiamonds * itemMultiplier))
  }];
  
  return {
    // Standard fields
    id: generateUniqueId(),
    title: encounter.name,
    description: encounter.description,
    type: "encounter",
    category: "combat",
    rarity: tier,
    requiredCount: encounter.totalMobCount,
    targets: encounter.mobs.map(m => m.type.replace("minecraft:", "")),
    
    reward: {
      scoreboardIncrement: rewardCalc.total,
      rewardItems: rewardItems
    },
    
    // Encounter fields
    isEncounter: true,
    encounterId: encounter.id,
    encounterName: encounter.name,
    encounterMobs: structuredClone(encounter.mobs),
    totalMobCount: encounter.totalMobCount,
    
    // NEW: Zone and state
    encounterZone: zone,
    encounterState: "pending",  // pending → spawned → complete
    
    // Populated when player arrives at zone
    spawnData: null
  };
}
```

---

### 4. `main.js` — Quest Accept Handler

**Simplify — no spawning on accept, just notify about zone:**

```javascript
import { 
  calculateDistance, 
  getQuestBoardPosition, 
  getDirection 
} from "./systems/LocationValidator.js";

async function handleQuestAccept(player, slotIndex) {
  // ... existing validation and quest copying logic ...
  
  const quest = questData.active;
  
  // === UPDATED: Just notify about zone, don't spawn ===
  if (quest.isEncounter) {
    const zone = quest.encounterZone;
    const boardPos = getQuestBoardPosition();
    
    const distance = calculateDistance(boardPos, zone.center);
    const direction = getDirection(boardPos, zone.center);
    
    player.sendMessage(`§e${quest.encounterName} §fawaits §c~${distance} blocks §fto the §e${direction}§f.`);
    player.sendMessage(`§7Travel to the area to begin the encounter.`);
    player.sendMessage(`§7Zone center: ${zone.center.x}, ${zone.center.z}`);
  }
  // === END UPDATED CODE ===
  
  await PersistenceManager.saveQuestData(player.id, questData);
  
  // ... existing notification logic ...
}
```

---

### 5. `main.js` — Start Proximity Monitoring on World Init

**Add to world initialization:**

```javascript
import { startProximityMonitoring } from "./systems/EncounterProximity.js";

world.afterEvents.worldInitialize.subscribe(() => {
  // ... existing init code ...
  
  // Start encounter proximity monitoring
  startProximityMonitoring();
});
```

---

### 6. `main.js` — Update Kill Tracking

**Handle `encounterState` transition to "complete":**

```javascript
// In the entityDie handler, after incrementing progress:

if (questData.progress >= questData.active.totalMobCount) {
  questData.active.encounterState = "complete";
  player.sendMessage(`§a${questData.active.encounterName}: §6COMPLETE! §7Return to the board.`);
  player.playSound("random.levelup");
}
```

---

### 7. `main.js` — Update Turn-In Validation

**Check `encounterState` instead of just progress:**

```javascript
// In handleQuestTurnIn:

if (quest.isEncounter) {
  if (quest.encounterState !== "complete") {
    player.sendMessage(`§cEncounter not complete yet.`);
    return;
  }
  
  // Despawn any remaining mobs (safety cleanup)
  if (quest.spawnData) {
    despawnEncounterMobs(quest.id, dimension);
  }
}
```

---

### 8. `main.js` — Update Abandon Handler

**Handle both pending and spawned states:**

```javascript
// In handleQuestAbandon:

if (quest.isEncounter) {
  // Only despawn if mobs were spawned
  if (quest.encounterState === "spawned" && quest.spawnData) {
    const dimension = world.getDimension(quest.spawnData.dimensionId || "overworld");
    despawnEncounterMobs(quest.id, dimension);
  }
  
  // Reset encounter state for re-accept
  quest.encounterState = "pending";
  quest.spawnData = null;
  
  // Note: encounterZone stays - same zone if re-accepted
  // Or regenerate: quest.encounterZone = selectEncounterZone(quest.rarity);
}
```

---

## Validation Checklist

### Zone Assignment (Quest Accept)
- [ ] Accepting Rare quest assigns zone 60-120 blocks from board
- [ ] Accepting Legendary quest assigns zone 100-200 blocks from board
- [ ] Player receives distance and direction notification
- [ ] Zone coordinates shown in chat
- [ ] `encounterState` is "pending"
- [ ] `spawnData` is null
- [ ] No mobs spawn yet

### Proximity Detection
- [ ] Tick system runs every ~1 second
- [ ] System detects player entering zone (within 50 blocks of center)
- [ ] System ignores players without active encounters
- [ ] System ignores encounters already in "spawned" state

### Spawn Trigger
- [ ] "The enemy is near!" message appears on zone entry
- [ ] Terrain validation finds valid spot 40-60 blocks from player
- [ ] Mobs spawn at validated location
- [ ] "The enemy approaches!" message with distance
- [ ] `encounterState` changes to "spawned"
- [ ] `spawnData` populated correctly

### Fallback
- [ ] If terrain validation fails, fallback location used
- [ ] "(Spawned at backup location)" message appears
- [ ] Mobs spawn at fallback successfully

### Kill Tracking
- [ ] Kill tracking works as before (Phase 2)
- [ ] Progress increments correctly
- [ ] `encounterState` changes to "complete" when done

### Turn-In & Abandon
- [ ] Turn-in validates `encounterState === "complete"`
- [ ] Turn-in despawns any remaining mobs
- [ ] Abandon despawns mobs if `encounterState === "spawned"`
- [ ] Abandon resets state to "pending"

---

## Testing Commands

```javascript
if (message === "!encounter zone info") {
  const questData = await PersistenceManager.loadQuestData(player.id);
  
  if (questData?.active?.isEncounter) {
    const quest = questData.active;
    const zone = quest.encounterZone;
    
    player.sendMessage(`§e=== Encounter Zone ===`);
    player.sendMessage(`§fName: ${quest.encounterName}`);
    player.sendMessage(`§fState: ${quest.encounterState}`);
    player.sendMessage(`§fZone center: ${zone.center.x}, ${zone.center.z}`);
    player.sendMessage(`§fTrigger radius: ${zone.radius}`);
    
    const dist = calculateDistance(player.location, zone.center);
    player.sendMessage(`§fYour distance: ${dist} blocks`);
    
    if (quest.spawnData) {
      player.sendMessage(`§fSpawn location: ${quest.spawnData.location.x}, ${quest.spawnData.location.y}, ${quest.spawnData.location.z}`);
    }
  } else {
    player.sendMessage(`§cNo active encounter`);
  }
  return true;
}

if (message === "!encounter tp zone") {
  const questData = await PersistenceManager.loadQuestData(player.id);
  
  if (questData?.active?.isEncounter && questData.active.encounterZone) {
    const zone = questData.active.encounterZone;
    player.teleport({ x: zone.center.x, y: 100, z: zone.center.z });
    player.sendMessage(`§aTeleported to zone center (high altitude)`);
  } else {
    player.sendMessage(`§cNo active encounter with zone`);
  }
  return true;
}

if (message === "!encounter force spawn") {
  // Force trigger spawn (for testing)
  const questData = await PersistenceManager.loadQuestData(player.id);
  
  if (questData?.active?.isEncounter && questData.active.encounterState === "pending") {
    const { triggerEncounterSpawn } = await import("./systems/EncounterProximity.js");
    // Note: You may need to export this function
    player.sendMessage(`§aForcing spawn trigger...`);
    // Manual trigger logic here
  } else {
    player.sendMessage(`§cNo pending encounter to trigger`);
  }
  return true;
}
```

---

## Rollback Plan

If Phase 3 (revised) causes issues:

1. Remove `EncounterProximity.js`
2. Remove `startProximityMonitoring()` call from world init
3. Revert `EncounterManager.js` to not include `encounterZone`/`encounterState`
4. Revert `handleQuestAccept()` to Phase 2 test spawning

Phase 2's direct spawning at test location will work again.

---

## Phase 3 Complete When

1. Zone assigned on accept (no spawn)
2. Player travels to zone
3. Proximity detection triggers spawn
4. Terrain validation works (chunks loaded)
5. Mobs spawn 40-60 blocks from player
6. Kill tracking and turn-in work correctly

---

## What Phase 4 Will Change

Phase 4 handles logout/login for the new state model:

- **Logout while `pending`**: No mobs to despawn, zone preserved
- **Logout while `spawned`**: Despawn mobs, preserve progress and location
- **Login with `pending`**: Nothing to do, player still needs to travel
- **Login with `spawned`**: Respawn remaining mobs at stored location
