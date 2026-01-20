/**
 * ============================================================================
 * LOCATION VALIDATOR — Ring-Based Zone Selection & Terrain Validation
 * ============================================================================
 *
 * AI AGENT ORIENTATION:
 * ---------------------
 * This module handles encounter zone selection and spawn point validation.
 * It's part of the Phase 3 (Revised) proximity-based spawning system.
 *
 * CRITICAL CONTEXT:
 * - Phase 2 spawned mobs immediately on quest accept (at test location)
 * - Phase 3 (Original) failed: terrain validation at 60-200 blocks → unloaded chunks
 * - Phase 3 (Revised) solution: two-stage spawn flow
 *
 * TWO-STAGE SPAWN FLOW:
 * 1. Quest Accept: selectEncounterZone() picks zone center (no validation)
 * 2. Player Arrival: findSpawnPointNearPlayer() validates terrain (chunks loaded)
 *
 * KEY INSIGHT:
 * When player is near the zone, chunks ARE loaded. Terrain validation works
 * because we defer it until the player's presence guarantees loaded chunks.
 *
 * ZONE SYSTEM:
 * - Zone center: Random point in tier ring (60-120 or 100-200 blocks from board)
 * - Trigger radius: 50 blocks - when player enters this, spawning begins
 * - Spawn distance: 40-60 blocks from player (far enough to avoid pop-in)
 *
 * DEPENDENCIES:
 * - Used by: main.js (handleQuestAccept), EncounterProximity.js (spawn trigger)
 * - No internal dependencies
 *
 * ============================================================================
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Quest board location (center of ring calculations)
 */
const QUEST_BOARD_POS = { x: 72, z: -278 };

/**
 * Ring configuration for each tier
 * Defines how far from the quest board encounters can spawn
 */
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

/**
 * Zone trigger radius
 * When player is within this distance of zone center, spawn sequence begins
 */
const ZONE_TRIGGER_RADIUS = 50;

/**
 * Spawn distance from player when they arrive at zone
 * Mobs spawn in this ring around the player
 *
 * Set to 18-22 blocks: close enough to guarantee loaded chunks,
 * far enough to not spawn directly on top of player
 */
const SPAWN_DISTANCE = {
  inner: 18,
  outer: 22
};

/**
 * Maximum attempts to find valid spawn point
 */
const MAX_SPAWN_ATTEMPTS = 15;

/**
 * Blocks that are invalid for mob spawning
 */
const INVALID_SPAWN_BLOCKS = [
  // Liquids
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava",

  // Leaves (all variants)
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
  "minecraft:leaves",
  "minecraft:leaves2",

  // Hazardous blocks
  "minecraft:cactus",
  "minecraft:sweet_berry_bush",
  "minecraft:powder_snow"
];

/**
 * Pre-scouted fallback locations
 * Used if terrain validation fails even with loaded chunks
 */
const FALLBACK_LOCATIONS = {
  rare: [
    { x: 117, y: 69, z: -362 },  // ~95 blocks from board
    { x: 167, y: 63, z: -267 },  // ~95 blocks from board
    { x: 140, y: 68, z: -195 }   // ~108 blocks from board
  ],
  legendary: [
    { x: 220, y: 63, z: -319 },  // ~152 blocks from board
    { x: 239, y: 63, z: -258 },  // ~168 blocks from board
    { x: 156, y: 63, z: -117 }   // ~183 blocks from board
  ]
};

// ============================================================================
// RING GEOMETRY
// ============================================================================

/**
 * Get a random point within a ring (annulus)
 * Uses square root distribution for even area coverage
 *
 * @param {number} centerX - Ring center X coordinate
 * @param {number} centerZ - Ring center Z coordinate
 * @param {number} innerRadius - Minimum distance from center
 * @param {number} outerRadius - Maximum distance from center
 * @returns {{x: number, z: number}} Random point in ring
 */
export function getRandomPointInRing(centerX, centerZ, innerRadius, outerRadius) {
  // Random angle (0 to 2π)
  const angle = Math.random() * 2 * Math.PI;

  // Random radius with sqrt for uniform area distribution
  const minR2 = innerRadius * innerRadius;
  const maxR2 = outerRadius * outerRadius;
  const radius = Math.sqrt(minR2 + Math.random() * (maxR2 - minR2));

  return {
    x: Math.floor(centerX + radius * Math.cos(angle)),
    z: Math.floor(centerZ + radius * Math.sin(angle))
  };
}

/**
 * Calculate distance between two points (XZ plane only)
 *
 * @param {{x: number, z: number}} point1 - First point
 * @param {{x: number, z: number}} point2 - Second point
 * @returns {number} Distance in blocks (floored)
 */
export function calculateDistance(point1, point2) {
  const dx = point2.x - point1.x;
  const dz = point2.z - point1.z;
  return Math.floor(Math.sqrt(dx * dx + dz * dz));
}

/**
 * Get cardinal direction from one point to another
 *
 * @param {{x: number, z: number}} from - Starting point
 * @param {{x: number, z: number}} to - Target point
 * @returns {string} Direction string (e.g., "north", "southeast", "nearby")
 */
export function getDirection(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;

  const absX = Math.abs(dx);
  const absZ = Math.abs(dz);

  let direction = "";

  // In Minecraft: -Z is north, +Z is south, +X is east, -X is west
  if (absZ > absX * 0.5) {
    direction += dz < 0 ? "north" : "south";
  }
  if (absX > absZ * 0.5) {
    direction += dx > 0 ? "east" : "west";
  }

  return direction || "nearby";
}

// ============================================================================
// ZONE SELECTION (Called on quest accept)
// ============================================================================

/**
 * Select an encounter zone center point
 * NO terrain validation - just picks a point in the tier's ring
 *
 * @param {string} tier - "rare" or "legendary"
 * @returns {{center: {x: number, y: number, z: number}, radius: number, tier: string} | null}
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

  // Y coordinate is estimated - actual spawn Y determined on arrival
  const estimatedY = 65;

  console.log(`[LocationValidator] Zone selected for ${tier}: (${point.x}, ${point.z})`);

  return {
    center: { x: point.x, y: estimatedY, z: point.z },
    radius: ZONE_TRIGGER_RADIUS,
    tier: tier
  };
}

// ============================================================================
// PROXIMITY CHECKING (Called by EncounterProximity.js)
// ============================================================================

/**
 * Check if player is within zone trigger radius
 *
 * @param {Player} player - The player to check
 * @param {{x: number, y: number, z: number}} zoneCenter - Center of encounter zone
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

// ============================================================================
// SPAWN POINT FINDING (Called when player arrives at zone)
// ============================================================================

/**
 * Find a valid spawn point near the player
 * Called ONLY when player is in the zone (chunks are loaded)
 *
 * @param {Dimension} dimension - Minecraft dimension
 * @param {Player} player - Player who triggered the zone
 * @returns {{x: number, y: number, z: number} | null} Valid spawn location or null
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

      // Check if surface is valid (not water, lava, leaves, etc.)
      if (INVALID_SPAWN_BLOCKS.includes(topBlock.typeId)) continue;

      // Check for air above (mobs need headroom)
      const spawnY = topBlock.location.y + 1;
      const blockAbove = dimension.getBlock({ x: point.x, y: spawnY, z: point.z });

      // Must be AIR - not water, not any other block
      if (!blockAbove || blockAbove.typeId !== "minecraft:air") continue;

      // Check second block above for tall mobs
      const blockAbove2 = dimension.getBlock({ x: point.x, y: spawnY + 1, z: point.z });

      // Must also be AIR
      if (!blockAbove2 || blockAbove2.typeId !== "minecraft:air") continue;

      // Additional check: make sure we're above sea level or at least not underwater
      // In swamps, the "topmost block" can be mud at the bottom of water
      // Check if there's water anywhere in the column above
      let hasWaterAbove = false;
      for (let checkY = spawnY; checkY <= spawnY + 5; checkY++) {
        const checkBlock = dimension.getBlock({ x: point.x, y: checkY, z: point.z });
        if (checkBlock && (checkBlock.typeId === "minecraft:water" || checkBlock.typeId === "minecraft:flowing_water")) {
          hasWaterAbove = true;
          break;
        }
      }
      if (hasWaterAbove) continue;

      console.log(`[LocationValidator] Found valid spawn at (${point.x}, ${spawnY}, ${point.z}) on attempt ${attempt + 1}`);

      return { x: point.x, y: spawnY, z: point.z };

    } catch (error) {
      // Chunk edge case - try again
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
 * @returns {{x: number, y: number, z: number}} Fallback coordinates
 */
export function getFallbackLocation(tier) {
  const locations = FALLBACK_LOCATIONS[tier] || FALLBACK_LOCATIONS.rare;

  if (!locations || locations.length === 0) {
    // Emergency fallback: near quest board
    return { x: QUEST_BOARD_POS.x + 50, y: 65, z: QUEST_BOARD_POS.z };
  }

  const selected = locations[Math.floor(Math.random() * locations.length)];
  console.log(`[LocationValidator] Using fallback for ${tier}: (${selected.x}, ${selected.y}, ${selected.z})`);

  return { ...selected };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Get the quest board position
 * @returns {{x: number, z: number}}
 */
export function getQuestBoardPosition() {
  return { ...QUEST_BOARD_POS };
}

/**
 * Get ring configuration for a tier
 * @param {string} tier - "rare" or "legendary"
 * @returns {{innerRadius: number, outerRadius: number} | null}
 */
export function getRingConfig(tier) {
  return RING_CONFIG[tier] || null;
}

/**
 * Get the zone trigger radius
 * @returns {number}
 */
export function getZoneTriggerRadius() {
  return ZONE_TRIGGER_RADIUS;
}
