/**
 * ============================================================================
 * ENCOUNTER SPAWNER — Mob Spawning, Tracking, and Cleanup
 * ============================================================================
 *
 * AI AGENT ORIENTATION:
 * ---------------------
 * This module handles all spawning and despawning of encounter mobs for the
 * encounter quest system. It provides utilities for mob tagging, tracking,
 * and cleanup operations.
 *
 * CRITICAL CONTEXT:
 * - Part of Encounter System (Phases 1-4 complete)
 * - Phase 1: Quest generation only (no spawning)
 * - Phase 2: Spawning at fixed test location (removed)
 * - Phase 3: Two-stage flow: zone assignment → proximity spawn trigger
 * - Phase 4: Logout/login persistence (despawn/respawn) ✅ COMPLETE
 *
 * TAGGING SYSTEM:
 * Every encounter mob gets TWO tags:
 * 1. "sq_encounter_mob" - Universal marker for all encounter mobs
 * 2. "sq_quest_<questId>" - Links mob to specific quest instance
 *
 * This dual-tag system enables:
 * - Fast filtering of encounter mobs vs. natural spawns
 * - Precise tracking of which mobs belong to which quest
 * - Cleanup operations (despawn all mobs for a specific quest)
 * - Kill attribution (increment progress for correct quest owner)
 *
 * SPAWN MECHANICS:
 * - Location determined by EncounterProximity.js when player enters zone
 * - Terrain validation via LocationValidator.js (18-22 blocks from player)
 * - Variance: ±3 blocks X/Z to prevent mob stacking
 * - Fire protection: Undead mobs don't burn in sunlight
 *
 * KILL ATTRIBUTION MODEL:
 * - Quest owner kills mob ✅
 * - Other player kills mob ✅
 * - Environmental damage (lava, fall, drowning) ✅
 * - Fire/sunlight damage ❌ (blocked by protection system)
 * - Natural despawn ❌ (no entityDie event)
 *
 * DESPAWN TRIGGERS:
 * - Quest turn-in (cleanup remaining mobs)
 * - Quest abandon (remove all mobs, allow re-accept)
 * - Player logout (temporary despawn, respawn on login)
 * - Phase 5 will add: Server restart cleanup (orphan removal)
 *
 * PROTECTION SYSTEM:
 * - initializeEncounterMobProtection() blocks fire damage for tagged mobs
 * - Other environmental damage (drowning, lava, fall) goes through
 * - This prevents undead burning but allows stuck mobs to die naturally
 *
 * DEPENDENCIES:
 * - Used by: main.js (playerSpawn, playerLeave, entityDie, turn-in, abandon)
 * - Imports: @minecraft/server (world, system)
 *
 * MODIFICATION GUIDELINES:
 * - Always use try/catch around entity operations (entities may be removed)
 * - Log all spawn/despawn operations for debugging
 * - Maintain backward compatibility with quest schema
 *
 * ============================================================================
 */

import { world, system } from "@minecraft/server";

// ============================================================================
// CONSTANTS
// ============================================================================

// ============================================================================
// PHASE 3: Test location constants removed
// Zone selection now handled by LocationValidator.js
// Spawn triggering now handled by EncounterProximity.js
// ============================================================================

/**
 * Tag applied to ALL encounter mobs for universal filtering
 */
const TAG_ENCOUNTER_MOB = "sq_encounter_mob";

/**
 * Tag prefix for quest-specific tracking
 * Full tag format: "sq_quest_<questId>"
 */
const TAG_QUEST_PREFIX = "sq_quest_";

// ============================================================================
// ENCOUNTER MOB PROTECTION
// ============================================================================

let damageProtectionInitialized = false;

/**
 * Damage causes to block for encounter mobs
 * Only blocks sunlight/fire - lets drowning, lava, fall damage through
 * so mobs don't get permanently stuck
 */
const BLOCKED_DAMAGE_CAUSES = [
  "fire",
  "fireTick",
  "fire_tick",
  "onFire",
  "burning"
];

/**
 * Initialize damage protection for encounter mobs
 * Only blocks fire/sunlight damage - other environmental damage goes through
 * This prevents undead burning but allows stuck mobs to die naturally
 *
 * Call this once at world initialization
 */
export function initializeEncounterMobProtection() {
  if (damageProtectionInitialized) return;

  const damageEvent = world.beforeEvents.entityDamage ?? world.beforeEvents.entityHurt;
  if (!damageEvent) {
    console.warn("[EncounterSpawner] Could not initialize damage protection - no damage event available");
    return;
  }

  damageEvent.subscribe((ev) => {
    const entity = ev.entity ?? ev.hurtEntity;
    if (!entity) return;

    // Only protect encounter mobs
    try {
      if (!entity.hasTag(TAG_ENCOUNTER_MOB)) return;
    } catch {
      return; // Entity invalid
    }

    // Only block fire/sunlight damage - let other environmental damage through
    const cause = ev.damageSource?.cause;
    if (cause && BLOCKED_DAMAGE_CAUSES.includes(cause)) {
      ev.cancel = true;
    }
  });

  damageProtectionInitialized = true;
  console.log("[EncounterSpawner] Encounter mob fire protection initialized");
}

// ============================================================================
// MOB SPAWNING
// ============================================================================

/**
 * Spawn all mobs for an encounter quest
 *
 * WORKFLOW:
 * 1. Iterate through each mob group in quest.encounterMobs
 * 2. For each mob in the group, spawn at location with variance
 * 3. Apply universal tag (sq_encounter_mob)
 * 4. Apply quest-specific tag (sq_quest_<questId>)
 * 5. Apply custom name tag if specified (e.g., "Frost Archer")
 * 6. Track entity IDs for later despawn operations
 *
 * POSITION VARIANCE:
 * - Random offset of ±3 blocks on X and Z axes
 * - Prevents mobs from spawning on top of each other
 * - Creates natural-looking mob group spread
 *
 * ERROR HANDLING:
 * - Catches spawn failures (invalid mob type, loaded chunk, etc.)
 * - Logs errors but continues spawning remaining mobs
 * - Returns partial entity list if some spawns fail
 *
 * @param {Object} quest - The encounter quest object from generateEncounterQuest()
 * @param {{x: number, y: number, z: number}} location - Spawn center point
 * @param {Dimension} dimension - Minecraft dimension to spawn in (usually overworld)
 * @returns {string[]} Array of spawned entity IDs for tracking
 *
 * @example
 * const quest = { id: "enc_12345", encounterMobs: [...], ... };
 * const location = { x: 102, y: 75, z: -278 };
 * const dimension = player.dimension;
 * const entityIds = spawnEncounterMobs(quest, location, dimension);
 * // Returns: ["entity_id_1", "entity_id_2", ...]
 */
export function spawnEncounterMobs(quest, location, dimension) {
  const spawnedEntityIds = [];

  // ========================================================================
  // PHASE 3 UPDATE: Simplified spawning
  // ========================================================================
  // In Phase 3, player triggers spawn by being NEAR the zone, so chunks are
  // already loaded. We no longer need tickingarea commands or delays.
  //
  // The original Phase 2 code used tickingarea + 1s delay because spawning
  // happened at quest accept (far from spawn location). That's no longer needed.
  // ========================================================================

  console.log(`[EncounterSpawner] Starting spawn for quest ${quest.id} at (${location.x}, ${location.y}, ${location.z})`);

  // Iterate through mob groups (e.g., [{ type: "minecraft:skeleton", count: 8 }, { type: "minecraft:stray", count: 3 }])
  for (const mobGroup of quest.encounterMobs) {
    // Spawn each individual mob in the group
    for (let i = 0; i < mobGroup.count; i++) {
      // Calculate position variance to prevent stacking
      // Random value between -0.5 and +0.5, multiplied by 6 = range of ±3 blocks
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
        // Spawn the entity
        const entity = dimension.spawnEntity(mobGroup.type, spawnPos);

        // Apply universal encounter mob tag
        entity.addTag(TAG_ENCOUNTER_MOB);

        // Apply quest-specific tag for tracking
        entity.addTag(`${TAG_QUEST_PREFIX}${quest.id}`);

        // Apply custom name tag if defined (e.g., "Frost Archer" for strays)
        if (mobGroup.nameTag) {
          entity.nameTag = mobGroup.nameTag;
        }

        // Track entity ID for later despawn operations
        spawnedEntityIds.push(entity.id);
      } catch (error) {
        // Log spawn failure but continue with remaining mobs
        console.error(`[EncounterSpawner] Failed to spawn ${mobGroup.type}: ${error}`);
      }
    }
  }

  // Log spawn operation for debugging
  console.log(`[EncounterSpawner] Spawned ${spawnedEntityIds.length}/${quest.totalMobCount} mobs for quest ${quest.id}`);

  return spawnedEntityIds;
}

// ============================================================================
// MOB DESPAWNING
// ============================================================================

/**
 * Despawn all mobs associated with a quest
 *
 * WORKFLOW:
 * 1. Query dimension for all entities with quest-specific tag
 * 2. Remove each entity (calls entity.remove())
 * 3. Count successful removals
 * 4. Log operation for debugging
 *
 * USE CASES:
 * - Quest turn-in: Remove remaining mobs after completion
 * - Quest abandon: Clean up mobs so quest can be re-accepted
 * - Phase 4: Logout despawn (temporary removal)
 * - Phase 5: Orphan cleanup (server restart recovery)
 *
 * ERROR HANDLING:
 * - Catches entity removal failures (entity already removed, etc.)
 * - Catches query failures (invalid dimension, etc.)
 * - Returns count of successfully despawned mobs
 *
 * @param {string} questId - The quest ID (from quest.id)
 * @param {Dimension} dimension - Minecraft dimension to search
 * @returns {number} Number of mobs successfully despawned
 *
 * @example
 * const count = despawnEncounterMobs("enc_12345", player.dimension);
 * // Returns: 8 (despawned 8 out of 11 mobs, 3 already killed)
 */
export function despawnEncounterMobs(questId, dimension) {
  const tagToFind = `${TAG_QUEST_PREFIX}${questId}`;
  let despawnCount = 0;

  try {
    // Query all entities with the quest-specific tag
    // This is more efficient than iterating all entities and checking tags
    const entities = dimension.getEntities({
      tags: [tagToFind]
    });

    // Remove each entity
    for (const entity of entities) {
      try {
        entity.remove();
        despawnCount++;
      } catch (error) {
        // Entity may have been removed between query and removal
        console.error(`[EncounterSpawner] Failed to remove entity: ${error}`);
      }
    }
  } catch (error) {
    // Query may fail if dimension is invalid or unloaded
    console.error(`[EncounterSpawner] Failed to query entities for despawn: ${error}`);
  }

  // Log despawn operation for debugging
  console.log(`[EncounterSpawner] Despawned ${despawnCount} mobs for quest ${questId}`);

  return despawnCount;
}

// ============================================================================
// MOB RESPAWNING (PHASE 4: Logout/Login Persistence)
// ============================================================================

/**
 * Respawn remaining mobs for an encounter after player login
 * Only spawns mobs that haven't been killed yet (based on progress)
 *
 * WORKFLOW:
 * 1. Calculate how many mobs need to respawn (totalMobCount - progress)
 * 2. Spawn mobs from each group until we've spawned enough
 * 3. Apply tags and name tags as in original spawn
 * 4. Return entity IDs for tracking
 *
 * USE CASES:
 * - Player logs back in with spawned encounter (mobs were despawned on logout)
 * - Server restart recovery (future Phase 5)
 *
 * IMPORTANT:
 * - Uses stored spawnData.location from original spawn
 * - Player dimension is used (player must be near for chunks to be loaded)
 * - Progress determines how many mobs to spawn (remaining = total - killed)
 *
 * @param {Object} quest - The encounter quest object
 * @param {number} progress - Current kill progress
 * @param {Dimension} dimension - Minecraft dimension to spawn in
 * @returns {string[]} Array of spawned entity IDs
 *
 * @example
 * const entityIds = respawnRemainingMobs(quest, 3, player.dimension);
 * // If quest.totalMobCount is 6 and progress is 3, spawns 3 mobs
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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if an entity is an encounter mob
 *
 * Used in entityDie handler to quickly filter encounter mobs from natural spawns.
 * Checks for universal encounter mob tag (not quest-specific).
 *
 * @param {Entity} entity - The entity to check
 * @returns {boolean} True if entity is an encounter mob
 *
 * @example
 * world.afterEvents.entityDie.subscribe((event) => {
 *   if (isEncounterMob(event.deadEntity)) {
 *     // Handle encounter mob death
 *   }
 * });
 */
export function isEncounterMob(entity) {
  try {
    return entity.hasTag(TAG_ENCOUNTER_MOB);
  } catch {
    // Entity may have been removed or is invalid
    return false;
  }
}

/**
 * Get the quest ID from an encounter mob's tags
 *
 * Used to link a dead mob back to its quest for progress tracking.
 * Searches entity tags for the quest-specific tag format.
 *
 * @param {Entity} entity - The entity to check
 * @returns {string|null} Quest ID or null if not found
 *
 * @example
 * const questId = getQuestIdFromMob(deadEntity);
 * if (questId) {
 *   // Find quest owner and increment progress
 * }
 */
export function getQuestIdFromMob(entity) {
  try {
    const tags = entity.getTags();
    const questTag = tags.find(tag => tag.startsWith(TAG_QUEST_PREFIX));

    if (questTag) {
      // Remove prefix to get just the quest ID
      return questTag.replace(TAG_QUEST_PREFIX, "");
    }
  } catch {
    // Entity may have been removed or tags unavailable
  }

  return null;
}

/**
 * Count remaining alive mobs for a quest
 *
 * Useful for debugging and validation.
 * Can be used to verify spawn counts or check despawn completeness.
 *
 * @param {string} questId - The quest ID
 * @param {Dimension} dimension - Minecraft dimension to search
 * @returns {number} Number of alive mobs with quest tag
 *
 * @example
 * const remaining = countRemainingMobs("enc_12345", player.dimension);
 * player.sendMessage(`§eAlive mobs: ${remaining}`);
 */
export function countRemainingMobs(questId, dimension) {
  const tagToFind = `${TAG_QUEST_PREFIX}${questId}`;

  try {
    const entities = dimension.getEntities({
      tags: [tagToFind]
    });
    return entities.length;
  } catch {
    // Query failed or dimension invalid
    return 0;
  }
}
