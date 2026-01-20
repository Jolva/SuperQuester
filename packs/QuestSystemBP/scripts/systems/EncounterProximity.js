/**
 * ============================================================================
 * ENCOUNTER PROXIMITY — Tick-Based Zone Monitoring & Spawn Triggering
 * ============================================================================
 *
 * AI AGENT ORIENTATION:
 * ---------------------
 * This module monitors player positions and triggers encounter spawns when
 * players enter their assigned zones. It's the core of Phase 3's proximity-based
 * spawning system.
 *
 * CRITICAL CONTEXT:
 * - Called via startProximityMonitoring() from world init
 * - Runs every 20 ticks (~1 second) to check all players
 * - Only triggers spawn for encounters in "pending" state
 * - Sets encounterState to "spawned" after mob spawn
 *
 * SPAWN SEQUENCE:
 * 1. Player enters zone (within 50 blocks of center)
 * 2. "The enemy is near!" alert + sound
 * 3. Short dramatic pause (500ms)
 * 4. Find valid spawn point 40-60 blocks from player
 * 5. Spawn mobs at validated location
 * 6. "The enemy approaches!" alert + sound
 * 7. Update quest state to "spawned"
 *
 * PERFORMANCE:
 * - 1-second check interval (not every tick)
 * - Early-exit for players without pending encounters
 * - Lightweight distance calculation
 *
 * DEPENDENCIES:
 * - PersistenceManager: Load/save quest data
 * - EncounterSpawner: spawnEncounterMobs()
 * - LocationValidator: isPlayerInZone(), findSpawnPointNearPlayer(), etc.
 *
 * ============================================================================
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

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Check interval in ticks (20 ticks = 1 second)
 * Balance between responsiveness and performance
 */
const CHECK_INTERVAL_TICKS = 20;

// ============================================================================
// STATE
// ============================================================================

let isRunning = false;
let runIntervalId = null;

// Track players currently being processed to avoid double-triggers
const playersBeingProcessed = new Set();

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Start the proximity monitoring system
 * Called once from world initialization
 */
export function startProximityMonitoring() {
  if (isRunning) {
    console.warn("[EncounterProximity] Already running");
    return;
  }

  isRunning = true;
  console.log("[EncounterProximity] Started proximity monitoring");

  // Run check every CHECK_INTERVAL_TICKS
  runIntervalId = system.runInterval(() => {
    checkAllPlayers();
  }, CHECK_INTERVAL_TICKS);
}

/**
 * Stop the proximity monitoring system
 * For cleanup or debugging
 */
export function stopProximityMonitoring() {
  if (!isRunning) return;

  isRunning = false;

  if (runIntervalId !== null) {
    system.clearRun(runIntervalId);
    runIntervalId = null;
  }

  playersBeingProcessed.clear();
  console.log("[EncounterProximity] Stopped proximity monitoring");
}

// ============================================================================
// INTERNAL LOGIC
// ============================================================================

/**
 * Check all online players for zone proximity
 */
function checkAllPlayers() {
  for (const player of world.getPlayers()) {
    // Skip if player is already being processed (spawn in progress)
    if (playersBeingProcessed.has(player.id)) continue;

    checkPlayerProximity(player);
  }
}

/**
 * Check if a player has entered their encounter zone
 * Also shows distance ticker for spawned encounters
 * @param {Player} player
 */
function checkPlayerProximity(player) {
  // Load quest data synchronously via ensureQuestData pattern
  // Note: PersistenceManager.loadQuestData returns the data object directly
  const questData = PersistenceManager.loadQuestData(player);

  // Early exit: No quest data
  if (!questData) return;

  // Early exit: No active quest
  if (!questData.active) return;

  // Early exit: Not an encounter quest
  if (!questData.active.isEncounter) return;

  const quest = questData.active;

  // === PERSISTENT OBJECTIVE DISPLAY FOR SPAWNED ENCOUNTERS ===
  // Use actionbar only - less intrusive than title/subtitle
  if (quest.encounterState === "spawned" && quest.spawnData?.location) {
    const spawnLoc = quest.spawnData.location;
    const playerLoc = player.location;
    const distance = Math.floor(calculateDistance(playerLoc, spawnLoc));

    // Count ACTUAL mobs alive (not just expected remaining)
    const dimension = player.dimension;
    let actualMobCount = 0;
    try {
      const tagToFind = `sq_quest_${quest.id}`;
      const entities = dimension.getEntities({ tags: [tagToFind] });
      actualMobCount = [...entities].length;
    } catch (e) {
      // Query may fail
    }

    // Calculate progress
    const progress = quest.totalMobCount - actualMobCount;

    try {
      // Actionbar only - compact, persistent, non-intrusive
      player.runCommandAsync(`titleraw @s actionbar {"rawtext":[{"text":"§6${quest.encounterName} §7| §fKill: §c${progress}§7/§c${quest.totalMobCount} §7| §e${distance}m away"}]}`);
    } catch (e) {
      // Actionbar may fail, not critical
    }
    return; // Don't check for zone entry if already spawned
  }

  // === PENDING ENCOUNTER: Show travel objective ===
  if (quest.encounterState === "pending" && quest.encounterZone) {
    const zone = quest.encounterZone;
    const playerLoc = player.location;
    const distanceToZone = Math.floor(calculateDistance(playerLoc, zone.center));

    try {
      // Actionbar only - compact travel info
      player.runCommandAsync(`titleraw @s actionbar {"rawtext":[{"text":"§6${quest.encounterName} §7| §fTravel to zone §7| §e${distanceToZone}m §7(${zone.center.x}, ${zone.center.z})"}]}`);
    } catch (e) {
      // Actionbar may fail
    }
  }

  // Early exit: Already complete
  if (quest.encounterState === "complete") return;

  // Early exit: Not pending (shouldn't happen after above checks)
  if (quest.encounterState !== "pending") return;

  // Early exit: No zone assigned (shouldn't happen, but safety check)
  if (!quest.encounterZone) return;

  const zone = quest.encounterZone;

  // Check if player is in the zone
  if (!isPlayerInZone(player, zone.center)) return;

  // Player has entered the zone - trigger spawn sequence
  console.log(`[EncounterProximity] Player ${player.name} entered zone for ${quest.encounterName}`);

  // Mark as being processed to prevent double-trigger
  playersBeingProcessed.add(player.id);

  // Trigger spawn (async sequence)
  triggerEncounterSpawn(player, questData);
}

/**
 * Trigger the encounter spawn sequence
 * @param {Player} player
 * @param {object} questData
 */
function triggerEncounterSpawn(player, questData) {
  const dimension = player.dimension;

  // Stage 1: Alert player
  player.sendMessage(`§c§lThe enemy is near!`);
  try {
    player.playSound("mob.wither.spawn", { volume: 0.3, pitch: 1.2 });
  } catch (e) {
    // Sound may fail, continue anyway
  }

  // Stage 2: Dramatic pause, then spawn
  // 500ms = 10 ticks
  system.runTimeout(() => {
    completeSpawnSequence(player, questData, dimension);
  }, 10);
}

/**
 * Complete the spawn sequence after the dramatic pause
 * @param {Player} player
 * @param {object} questData
 * @param {Dimension} dimension
 */
function completeSpawnSequence(player, questData, dimension) {
  const quest = questData.active;

  console.log(`[EncounterProximity] completeSpawnSequence called for ${player.name}`);
  console.log(`[EncounterProximity] Quest exists: ${!!quest}, State: ${quest?.encounterState}`);

  // Verify quest is still valid (player may have abandoned during pause)
  if (!quest || quest.encounterState !== "pending") {
    console.warn(`[EncounterProximity] Early return - quest invalid or not pending`);
    playersBeingProcessed.delete(player.id);
    return;
  }

  // Find spawn location (terrain validation)
  let spawnLocation = findSpawnPointNearPlayer(dimension, player);
  let usedFallback = false;

  console.log(`[EncounterProximity] Spawn location found: ${!!spawnLocation}`);

  if (!spawnLocation) {
    spawnLocation = getFallbackLocation(quest.encounterZone.tier);
    usedFallback = true;
    console.warn(`[EncounterProximity] Using fallback for ${quest.id}`);
  }

  console.log(`[EncounterProximity] Final spawn location: (${spawnLocation.x}, ${spawnLocation.y}, ${spawnLocation.z})`);

  // Spawn the mobs
  console.log(`[EncounterProximity] Calling spawnEncounterMobs...`);
  const entityIds = spawnEncounterMobs(quest, spawnLocation, dimension);
  console.log(`[EncounterProximity] spawnEncounterMobs returned ${entityIds.length} entity IDs`);

  // Update quest state
  quest.encounterState = "spawned";
  quest.spawnData = {
    location: spawnLocation,
    spawnedEntityIds: entityIds,
    dimensionId: dimension.id
  };

  // Save quest data
  PersistenceManager.saveQuestData(player, questData);

  // Stage 3: Alert player about spawn
  const distance = calculateDistance(player.location, spawnLocation);
  player.sendMessage(`§e§lThe enemy approaches!`);
  player.sendMessage(`§7${quest.totalMobCount} enemies, ~${distance} blocks away`);

  if (usedFallback) {
    player.sendMessage(`§7(Spawned at backup location)`);
  }

  try {
    player.playSound("mob.wither.shoot", { volume: 0.5, pitch: 0.8 });
  } catch (e) {
    // Sound may fail, continue anyway
  }

  // Clear processing flag
  playersBeingProcessed.delete(player.id);

  console.log(`[EncounterProximity] Spawned ${quest.encounterName} for ${player.name} at (${spawnLocation.x}, ${spawnLocation.y}, ${spawnLocation.z})`);
}
