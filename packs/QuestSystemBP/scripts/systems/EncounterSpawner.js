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
 * - Part of Encounter System Phase 3 (proximity-based spawning)
 * - Phase 1 created quest generation only (no spawning)
 * - Phase 2 added spawning at fixed test location (now removed)
 * - Phase 3 uses two-stage flow: zone assignment → proximity spawn trigger
 * - Phase 4 will add logout/login persistence (despawn/respawn)
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
 * SPAWN MECHANICS (PHASE 3):
 * - Location determined by EncounterProximity.js when player enters zone
 * - Terrain validation via LocationValidator.js (40-60 blocks from player)
 * - Variance: ±3 blocks X/Z to prevent mob stacking
 * - Spawns asynchronously with 1-second chunk loading delay
 *
 * KILL ATTRIBUTION MODEL:
 * Phase 2 uses simple "any death counts" model:
 * - Quest owner kills mob ✅
 * - Other player kills mob ✅
 * - Environmental damage (lava, fall) ✅
 * - Mob-on-mob damage ✅
 * - Natural despawn ❌ (no entityDie event)
 *
 * DESPAWN TRIGGERS:
 * - Quest turn-in (cleanup remaining mobs)
 * - Quest abandon (remove all mobs, allow re-accept)
 * - Phase 4 will add: Logout (temporary despawn)
 * - Phase 5 will add: Server restart cleanup (orphan removal)
 *
 * DEPENDENCIES:
 * - Used by: main.js (handleQuestAccept, entityDie, handleQuestTurnIn, handleQuestAbandon)
 * - Imports: @minecraft/server (world, dimension, entity APIs)
 *
 * MODIFICATION GUIDELINES:
 * - Always use try/catch around entity operations (entities may be removed)
 * - Log all spawn/despawn operations for debugging
 * - Maintain backward compatibility with Phase 1 quest schema
 * - Test location constants can be modified for different worlds
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
  // CHUNK LOADING FIX
  // ========================================================================
  // Ensure the spawn chunk is loaded before attempting to spawn entities.
  // Without this, spawns fail with LocationInUnloadedChunkError when the
  // player accepts quest from a distant location (e.g., quest board).
  //
  // Strategy: Use tickingarea command + delayed spawn to allow chunk loading
  try {
    // Force load the chunk using tickingarea command
    // This ensures the chunk is loaded and ticking for entity spawns
    dimension.runCommand(`tickingarea add circle ${location.x} ${location.y} ${location.z} 1 encounter_spawn_temp`);
  } catch (error) {
    // Ticking area may already exist or command may fail
    // Log but continue - spawn will fail naturally if chunk isn't loaded
    console.warn(`[EncounterSpawner] Could not create ticking area: ${error}`);
  }

  // Delay spawn by 1 second (20 ticks) to allow chunk to fully load
  // This is necessary because tickingarea command doesn't guarantee immediate loading
  system.runTimeout(() => {
    // Iterate through mob groups (e.g., [{ type: "skeleton", count: 8 }, { type: "stray", count: 3 }])
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

    // ========================================================================
    // CLEANUP: Remove temporary ticking area
    // ========================================================================
    // Now that mobs are spawned, we can remove the ticking area.
    // The mobs will persist even after the ticking area is removed.
    try {
      dimension.runCommand(`tickingarea remove encounter_spawn_temp`);
    } catch (error) {
      // Area may not exist or removal may fail - not critical
      console.warn(`[EncounterSpawner] Could not remove ticking area: ${error}`);
    }
  }, 20); // 20 ticks = 1 second delay

  // Return empty array immediately - actual spawn happens asynchronously
  // Note: This means spawn data will initially show 0 entity IDs
  // The actual entity IDs are populated after the delayed spawn
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
