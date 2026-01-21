# Super Quester: Encounter System — Phase 3 Implementation

**Phase:** 3 of 5
**Focus:** Ring-Based Spawning with Terrain Validation
**Branch:** `feature/encounter-system`
**Prerequisite:** Phase 2 complete and validated
**Validates:** Ring geometry, terrain checks, fallback system, distance notifications

---

## Objective

Replace the fixed test spawn location with ring-based random spawning. Encounters now spawn at tier-appropriate distances from the quest board, with terrain validation to avoid water, lava, and tree canopies.

By the end of this phase:
- Rare encounters spawn 60-120 blocks from the quest board
- Legendary encounters spawn 100-200 blocks from the quest board
- Spawn locations avoid water, lava, and leaves
- Fallback locations trigger after failed terrain validation
- Player receives distance notification on quest accept

---

## Ring Configuration

**Quest Board Location:** `{ x: 72, y: 75, z: -278 }`

| Tier | Inner Radius | Outer Radius | Feel |
|------|--------------|--------------|------|
| Rare | 60 blocks | 120 blocks | "Just outside town" |
| Legendary | 100 blocks | 200 blocks | "A real expedition" |

Note: Rings overlap intentionally (100-120 block zone). This creates unpredictability — a Legendary might spawn closer than expected.

---

## Files to Create

### 1. `/scripts/systems/LocationValidator.js`

```javascript
/**
 * LocationValidator.js
 * Handles ring-based spawn location selection and terrain validation.
 */

import { world } from "@minecraft/server";

// === CONFIGURATION ===

// Quest board position (center point for rings)
const QUEST_BOARD_POS = { x: 72, z: -278 };

// Ring definitions by tier
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

// Maximum attempts before using fallback
const MAX_VALIDATION_ATTEMPTS = 20;

// Block types that are invalid for spawning
const INVALID_SPAWN_BLOCKS = [
  // Water
  "minecraft:water",
  "minecraft:flowing_water",
  
  // Lava
  "minecraft:lava",
  "minecraft:flowing_lava",
  
  // Leaves (all variants)
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
  
  // Other problematic surfaces
  "minecraft:cactus",
  "minecraft:sweet_berry_bush",
  "minecraft:powder_snow"
];

// === FALLBACK LOCATIONS ===
// ACTION REQUIRED: Replace these placeholders with actual safe coordinates from your world

const FALLBACK_LOCATIONS = {
  rare: [
    { x: 100, y: 64, z: -200 },   // PLACEHOLDER - Replace with safe spot 1
    { x: 50, y: 70, z: -350 },    // PLACEHOLDER - Replace with safe spot 2
    { x: 150, y: 65, z: -280 }    // PLACEHOLDER - Replace with safe spot 3
  ],
  legendary: [
    { x: 200, y: 68, z: -400 },   // PLACEHOLDER - Replace with safe spot 1
    { x: -50, y: 72, z: -150 },   // PLACEHOLDER - Replace with safe spot 2
    { x: 250, y: 66, z: -100 }    // PLACEHOLDER - Replace with safe spot 3
  ]
};

// === RING GEOMETRY ===

/**
 * Get a random point within a ring (annulus)
 * Uses square root distribution for even area coverage
 * 
 * @param {number} centerX - Ring center X coordinate
 * @param {number} centerZ - Ring center Z coordinate
 * @param {number} innerRadius - Inner ring radius
 * @param {number} outerRadius - Outer ring radius
 * @returns {{x: number, z: number}} Random point in ring
 */
export function getRandomPointInRing(centerX, centerZ, innerRadius, outerRadius) {
  // Random angle (0 to 2π)
  const angle = Math.random() * 2 * Math.PI;
  
  // Random distance with square root distribution for even area coverage
  // Without sqrt, points would cluster toward center
  const minR2 = innerRadius * innerRadius;
  const maxR2 = outerRadius * outerRadius;
  const distance = Math.sqrt(Math.random() * (maxR2 - minR2) + minR2);
  
  return {
    x: Math.floor(centerX + distance * Math.cos(angle)),
    z: Math.floor(centerZ + distance * Math.sin(angle))
  };
}

/**
 * Calculate distance between two points (XZ plane only)
 * 
 * @param {{x: number, z: number}} point1 
 * @param {{x: number, z: number}} point2 
 * @returns {number} Distance in blocks
 */
export function calculateDistance(point1, point2) {
  return Math.floor(Math.sqrt(
    Math.pow(point1.x - point2.x, 2) +
    Math.pow(point1.z - point2.z, 2)
  ));
}

// === TERRAIN VALIDATION ===

/**
 * Check if a block type is valid for mob spawning
 * 
 * @param {string} blockTypeId - Block type ID (e.g., "minecraft:grass_block")
 * @returns {boolean} True if valid spawn surface
 */
function isValidSpawnBlock(blockTypeId) {
  return !INVALID_SPAWN_BLOCKS.includes(blockTypeId);
}

/**
 * Validate a spawn location for terrain suitability
 * Checks the surface block and ensures air above
 * 
 * @param {Dimension} dimension - Minecraft dimension
 * @param {number} x - X coordinate
 * @param {number} z - Z coordinate
 * @returns {{valid: boolean, location: {x: number, y: number, z: number}|null}} Validation result
 */
export function validateSpawnLocation(dimension, x, z) {
  try {
    // Get the topmost block at this XZ position
    // This handles chunk loading automatically
    const topBlock = dimension.getTopmostBlock({ x, z });
    
    if (!topBlock) {
      // Chunk not loaded or void
      return { valid: false, location: null };
    }
    
    const blockTypeId = topBlock.typeId;
    
    // Check if surface block is valid
    if (!isValidSpawnBlock(blockTypeId)) {
      return { valid: false, location: null };
    }
    
    // Check for air above (mobs need headroom)
    const spawnY = topBlock.y + 1;
    const blockAbove = dimension.getBlock({ x, y: spawnY, z });
    
    if (blockAbove && blockAbove.typeId !== "minecraft:air") {
      return { valid: false, location: null };
    }
    
    // Optional: Check two blocks above for tall mobs
    const blockAbove2 = dimension.getBlock({ x, y: spawnY + 1, z });
    if (blockAbove2 && blockAbove2.typeId !== "minecraft:air") {
      return { valid: false, location: null };
    }
    
    return {
      valid: true,
      location: { x, y: spawnY, z }
    };
    
  } catch (error) {
    console.error(`[LocationValidator] Error validating ${x}, ${z}: ${error}`);
    return { valid: false, location: null };
  }
}

// === MAIN FUNCTIONS ===

/**
 * Find a valid spawn location within the appropriate ring for a tier
 * Attempts random points until valid terrain is found or max attempts reached
 * 
 * @param {Dimension} dimension - Minecraft dimension
 * @param {string} tier - "rare" or "legendary"
 * @returns {{x: number, y: number, z: number}|null} Valid spawn location or null
 */
export function findValidSpawnLocation(dimension, tier) {
  const ring = RING_CONFIG[tier];
  
  if (!ring) {
    console.error(`[LocationValidator] Unknown tier: ${tier}`);
    return null;
  }
  
  for (let attempt = 0; attempt < MAX_VALIDATION_ATTEMPTS; attempt++) {
    // Get random point in ring
    const point = getRandomPointInRing(
      QUEST_BOARD_POS.x,
      QUEST_BOARD_POS.z,
      ring.innerRadius,
      ring.outerRadius
    );
    
    // Validate terrain
    const result = validateSpawnLocation(dimension, point.x, point.z);
    
    if (result.valid) {
      console.log(`[LocationValidator] Found valid location at ${result.location.x}, ${result.location.y}, ${result.location.z} (attempt ${attempt + 1})`);
      return result.location;
    }
  }
  
  console.warn(`[LocationValidator] Failed to find valid location after ${MAX_VALIDATION_ATTEMPTS} attempts for tier: ${tier}`);
  return null;
}

/**
 * Get a fallback location for a tier
 * Used when terrain validation fails repeatedly
 * 
 * @param {string} tier - "rare" or "legendary"
 * @returns {{x: number, y: number, z: number}} Fallback coordinates
 */
export function getFallbackLocation(tier) {
  const locations = FALLBACK_LOCATIONS[tier];
  
  if (!locations || locations.length === 0) {
    console.error(`[LocationValidator] No fallback locations for tier: ${tier}`);
    // Emergency fallback: near quest board
    return { x: QUEST_BOARD_POS.x + 50, y: 75, z: QUEST_BOARD_POS.z };
  }
  
  // Random selection from fallbacks
  const fallback = locations[Math.floor(Math.random() * locations.length)];
  console.warn(`[LocationValidator] Using fallback location: ${fallback.x}, ${fallback.y}, ${fallback.z}`);
  
  return fallback;
}

/**
 * Get the quest board position
 * @returns {{x: number, z: number}} Board coordinates
 */
export function getQuestBoardPosition() {
  return { ...QUEST_BOARD_POS };
}

/**
 * Get ring configuration for a tier
 * @param {string} tier - "rare" or "legendary"
 * @returns {{innerRadius: number, outerRadius: number}|null} Ring config or null
 */
export function getRingConfig(tier) {
  return RING_CONFIG[tier] || null;
}
```

---

## Files to Modify

### 2. `EncounterSpawner.js` — Remove Test Location

**Location:** `/scripts/systems/EncounterSpawner.js`

**Remove or comment out the test location code:**

```javascript
// === REMOVE THESE (Phase 2 test code) ===

// Test spawn offset from quest board (Phase 2 only)
// const TEST_SPAWN_OFFSET = { x: 30, y: 0, z: 0 };

// Quest board location
// const QUEST_BOARD_POS = { x: 72, y: 75, z: -278 };

// export function getTestSpawnLocation() { ... }

// === END REMOVAL ===
```

The quest board position is now defined in `LocationValidator.js`. `EncounterSpawner.js` only needs to handle spawning at whatever location it's given.

---

### 3. `main.js` — Quest Accept Handler

**Location:** `handleQuestAccept()` function

**Replace the Phase 2 test location logic with ring-based spawning:**

**Update imports at top of file:**
```javascript
import { 
  spawnEncounterMobs, 
  despawnEncounterMobs,
  isEncounterMob,
  getQuestIdFromMob
} from "./systems/EncounterSpawner.js";

// NEW: Add LocationValidator import
import {
  findValidSpawnLocation,
  getFallbackLocation,
  getQuestBoardPosition,
  calculateDistance
} from "./systems/LocationValidator.js";
```

**Replace the spawn location logic in `handleQuestAccept()`:**

```javascript
async function handleQuestAccept(player, slotIndex) {
  // ... existing validation and quest copying logic ...
  
  // Quest is now in questData.active
  const quest = questData.active;
  
  // === UPDATED: Ring-based spawn location ===
  if (quest.isEncounter) {
    const dimension = player.dimension;
    
    // Find valid spawn location in tier-appropriate ring
    let spawnLocation = findValidSpawnLocation(dimension, quest.rarity);
    
    // Use fallback if terrain validation failed
    let usedFallback = false;
    if (!spawnLocation) {
      spawnLocation = getFallbackLocation(quest.rarity);
      usedFallback = true;
    }
    
    // Spawn the encounter mobs
    const entityIds = spawnEncounterMobs(quest, spawnLocation, dimension);
    
    // Store spawn data on quest
    quest.spawnData = {
      location: spawnLocation,
      spawnedEntityIds: entityIds,
      dimensionId: dimension.id
    };
    
    // Calculate and notify distance
    const boardPos = getQuestBoardPosition();
    const distance = calculateDistance(boardPos, spawnLocation);
    
    if (usedFallback) {
      player.sendMessage(`§e${quest.encounterName} §fawaits §c${distance} blocks §faway. §7(backup location)`);
      player.sendMessage(`§7Location: ${spawnLocation.x}, ${spawnLocation.y}, ${spawnLocation.z}`);
    } else {
      player.sendMessage(`§e${quest.encounterName} §fawaits §c${distance} blocks §faway.`);
      player.sendMessage(`§7Location: ${spawnLocation.x}, ${spawnLocation.y}, ${spawnLocation.z}`);
    }
  }
  // === END UPDATED CODE ===
  
  // ... existing save logic ...
  await PersistenceManager.saveQuestData(player.id, questData);
  
  // ... existing notification logic ...
}
```

---

## Fallback Coordinates — ACTION REQUIRED

Before testing Phase 3, you must configure actual fallback locations in your world.

**Process:**
1. Load your world
2. Fly to 6 safe, flat areas (3 for Rare range, 3 for Legendary range)
3. Stand on the ground and note coordinates
4. Update `FALLBACK_LOCATIONS` in `LocationValidator.js`

**Selection criteria:**
- Flat, open ground (grass, dirt, stone)
- No water, lava, or trees within 10 blocks
- Not inside any player builds
- Rare fallbacks: roughly 60-120 blocks from board
- Legendary fallbacks: roughly 100-200 blocks from board

**Example after configuration:**
```javascript
const FALLBACK_LOCATIONS = {
  rare: [
    { x: 135, y: 68, z: -320 },   // Plains biome east
    { x: 25, y: 71, z: -215 },    // Clearing north
    { x: 90, y: 65, z: -380 }     // Beach south
  ],
  legendary: [
    { x: 220, y: 70, z: -450 },   // Desert far east
    { x: -80, y: 68, z: -180 },   // Forest clearing west
    { x: 180, y: 72, z: -100 }    // Mountains north
  ]
};
```

---

## Validation Checklist

### Ring Geometry
- [ ] Rare encounters spawn 60-120 blocks from board (test 10 spawns)
- [ ] Legendary encounters spawn 100-200 blocks from board (test 10 spawns)
- [ ] Spawn points are distributed around board (not clustered in one direction)
- [ ] Distance notification is accurate (matches actual distance)

### Terrain Validation
- [ ] No spawns on water
- [ ] No spawns on lava
- [ ] No spawns on tree canopy (leaves)
- [ ] No spawns on cactus
- [ ] Mobs have headroom (not spawning inside blocks)

### Fallback System
- [ ] Fallback triggers after 20 failed attempts
- [ ] Fallback notification shows "(backup location)" message
- [ ] Fallback coordinates are valid (mobs spawn correctly)
- [ ] Each tier uses its own fallback pool

### Integration
- [ ] Kill tracking still works (Phase 2 functionality preserved)
- [ ] Turn-in still despawns mobs
- [ ] Abandon still despawns mobs
- [ ] Progress persists correctly
- [ ] Quest data includes correct `spawnData.location`

### Edge Cases
- [ ] Ocean biome: fallback triggers (mostly water)
- [ ] Dense forest: may need multiple attempts but eventually finds clearing
- [ ] Player in Nether: encounter still spawns in Overworld (or fails gracefully)

---

## Testing Commands

Update the debug commands for Phase 3 testing:

```javascript
if (message === "!encounter test ring rare") {
  // Test rare ring point generation (no actual spawn)
  const { getRandomPointInRing, getQuestBoardPosition, getRingConfig } = await import("./systems/LocationValidator.js");
  const board = getQuestBoardPosition();
  const ring = getRingConfig("rare");
  
  player.sendMessage(`§e=== Rare Ring Test ===`);
  for (let i = 0; i < 5; i++) {
    const point = getRandomPointInRing(board.x, board.z, ring.innerRadius, ring.outerRadius);
    const dist = Math.floor(Math.sqrt(Math.pow(point.x - board.x, 2) + Math.pow(point.z - board.z, 2)));
    player.sendMessage(`§7Point ${i + 1}: ${point.x}, ${point.z} (${dist} blocks)`);
  }
  return true;
}

if (message === "!encounter test ring legendary") {
  // Test legendary ring point generation
  const { getRandomPointInRing, getQuestBoardPosition, getRingConfig } = await import("./systems/LocationValidator.js");
  const board = getQuestBoardPosition();
  const ring = getRingConfig("legendary");
  
  player.sendMessage(`§6=== Legendary Ring Test ===`);
  for (let i = 0; i < 5; i++) {
    const point = getRandomPointInRing(board.x, board.z, ring.innerRadius, ring.outerRadius);
    const dist = Math.floor(Math.sqrt(Math.pow(point.x - board.x, 2) + Math.pow(point.z - board.z, 2)));
    player.sendMessage(`§7Point ${i + 1}: ${point.x}, ${point.z} (${dist} blocks)`);
  }
  return true;
}

if (message === "!encounter test terrain") {
  // Test terrain validation at player's current location
  const { validateSpawnLocation } = await import("./systems/LocationValidator.js");
  const loc = player.location;
  const result = validateSpawnLocation(player.dimension, Math.floor(loc.x), Math.floor(loc.z));
  
  if (result.valid) {
    player.sendMessage(`§aValid spawn location`);
    player.sendMessage(`§7Spawn Y: ${result.location.y}`);
  } else {
    player.sendMessage(`§cInvalid spawn location`);
  }
  return true;
}

if (message === "!encounter test fallback rare") {
  // Test fallback location for rare
  const { getFallbackLocation } = await import("./systems/LocationValidator.js");
  const loc = getFallbackLocation("rare");
  player.sendMessage(`§eFallback (rare): ${loc.x}, ${loc.y}, ${loc.z}`);
  return true;
}

if (message === "!encounter test fallback legendary") {
  // Test fallback location for legendary
  const { getFallbackLocation } = await import("./systems/LocationValidator.js");
  const loc = getFallbackLocation("legendary");
  player.sendMessage(`§6Fallback (legendary): ${loc.x}, ${loc.y}, ${loc.z}`);
  return true;
}

if (message === "!encounter tp spawn") {
  // Teleport to active encounter spawn location
  const questData = await PersistenceManager.loadQuestData(player.id);
  
  if (questData.active && questData.active.isEncounter && questData.active.spawnData) {
    const loc = questData.active.spawnData.location;
    player.teleport({ x: loc.x, y: loc.y + 1, z: loc.z });
    player.sendMessage(`§aTeleported to encounter location`);
  } else {
    player.sendMessage(`§cNo active encounter with spawn data`);
  }
  return true;
}
```

---

## Rollback Plan

If Phase 3 causes issues:

1. Revert `handleQuestAccept()` to use `getTestSpawnLocation()` from Phase 2
2. Re-add the test location code to `EncounterSpawner.js`
3. `LocationValidator.js` can remain — it's inert if not imported

Phase 2 functionality (kill tracking, turn-in, abandon) remains unchanged.

---

## Phase 3 Complete When

All validation checklist items pass, specifically:
1. Rare/Legendary spawn at correct ring distances
2. Terrain validation rejects water/lava/leaves
3. Fallback system works when validation fails
4. Distance notifications are accurate
5. All Phase 2 functionality still works

**Do not proceed to Phase 4** until all Phase 3 validations pass.

---

## Notes for Implementation

1. **`getTopmostBlock()` chunk loading**: This method handles chunk loading automatically. If the chunk isn't loaded, it may return undefined — this is handled by the validation returning `{ valid: false }`.

2. **Square root distribution**: The ring point selection uses `Math.sqrt()` to ensure even distribution across the ring area. Without this, points would cluster toward the center.

3. **Y coordinate**: The spawn Y is determined by terrain (`topBlock.y + 1`), not the ring config. Rings only define XZ distance.

4. **Safe zone interaction**: If your safe zone despawns hostile mobs, ensure the inner ring radius (60 blocks) is outside the safe zone radius. Otherwise, some Rare spawns might get immediately cleaned up.

5. **Performance**: 20 validation attempts is fast (simple block lookups). Don't reduce this number — ocean biomes legitimately need many attempts to find land.

---

## What Phase 4 Will Change

Phase 4 adds logout/login persistence:
- Mobs despawn when player logs out
- Mobs respawn at original location when player logs back in
- Quest progress survives logout
- `spawnData.location` from Phase 3 is critical for respawning at the correct spot
