/**
 * ============================================================================
 * ENCOUNTER PROXIMITY — Zone Monitoring, Spawn Triggering & Navigation
 * ============================================================================
 *
 * AI AGENT ORIENTATION:
 * ---------------------
 * This module monitors player positions, triggers encounter spawns when
 * players enter their assigned zones, and provides navigation assistance
 * via directional arrows and sky beacons.
 *
 * CRITICAL CONTEXT:
 * - Part of Encounter System (Phases 1-5 complete)
 * - Phase 3: Zone-based proximity triggering
 * - Phase 4: Logout/login persistence
 * - Phase 5: Navigation enhancement (arrows, beacons) ✅ COMPLETE
 *
 * SPAWN SEQUENCE:
 * 1. Player enters zone (within 50 blocks of center)
 * 2. "The enemy is near!" alert + sound
 * 3. Short dramatic pause (500ms)
 * 4. Find valid spawn point 18-22 blocks from player
 * 5. Spawn mobs at validated location
 * 6. "The enemy approaches!" alert + sound
 * 7. Update quest state to "spawned"
 *
 * NAVIGATION SYSTEM (Phase 5):
 * - Directional arrow (↑↗→↘↓↙←↖) relative to player facing
 * - Sky beacon particle column when within 150 blocks
 * - Beacon pulses every 2 seconds (40 ticks)
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
// NAVIGATION CONSTANTS (Phase 5)
// ============================================================================

/**
 * Arrow characters for 8 directions
 * Used to show player which way to go relative to their facing direction
 */
const DIRECTION_ARROWS = {
  N:  "↑",
  NE: "↗",
  E:  "→",
  SE: "↘",
  S:  "↓",
  SW: "↙",
  W:  "←",
  NW: "↖"
};

/**
 * Beacon configuration
 * Sky beacon appears when player is close enough to help locate the target
 */
const BEACON_ACTIVATION_DISTANCE = 150;
const BEACON_PULSE_INTERVAL = 40;  // ticks (2 seconds)
const BEACON_HEIGHT = 50;
const BEACON_PARTICLE_COUNT = 30;

let beaconTickCounter = 0;

// ============================================================================
// STATE
// ============================================================================

let isRunning = false;
let runIntervalId = null;

// Track players currently being processed to avoid double-triggers
const playersBeingProcessed = new Set();

// ============================================================================
// NAVIGATION FUNCTIONS (Phase 5)
// ============================================================================

/**
 * Get directional arrow based on player facing vs target direction
 * The arrow shows which way to turn relative to where the player is looking
 *
 * @param {Player} player - The player
 * @param {{x: number, z: number}} target - Target location
 * @returns {string} Arrow character
 */
function getDirectionArrow(player, target) {
  const playerPos = player.location;

  // Vector from player to target
  const dx = target.x - playerPos.x;
  const dz = target.z - playerPos.z;

  // World angle to target (degrees)
  // Minecraft: yaw 0 = south (+Z), yaw 90 = west (-X), yaw -90 = east (+X), yaw 180/-180 = north (-Z)
  // atan2(x, z) gives angle where 0 = +Z (south), 90 = +X (east), -90 = -X (west), 180 = -Z (north)
  // We need to negate to match Minecraft's yaw convention (positive = clockwise when viewed from above)
  const worldAngleToTarget = -Math.atan2(dx, dz) * (180 / Math.PI);

  // Player's facing direction (yaw)
  const playerYaw = player.getRotation().y;

  // Relative angle: positive = target is to the right, negative = target is to the left
  let relativeAngle = worldAngleToTarget - playerYaw;

  // Normalize to -180 to 180
  while (relativeAngle > 180) relativeAngle -= 360;
  while (relativeAngle < -180) relativeAngle += 360;

  // Convert to 8-direction arrow
  // 0° = ahead (↑), 90° = right (→), -90° = left (←), 180° = behind (↓)
  if (relativeAngle >= -22.5 && relativeAngle < 22.5) return DIRECTION_ARROWS.N;    // ahead
  if (relativeAngle >= 22.5 && relativeAngle < 67.5) return DIRECTION_ARROWS.NE;   // ahead-right
  if (relativeAngle >= 67.5 && relativeAngle < 112.5) return DIRECTION_ARROWS.E;   // right
  if (relativeAngle >= 112.5 && relativeAngle < 157.5) return DIRECTION_ARROWS.SE; // behind-right
  if (relativeAngle >= 157.5 || relativeAngle < -157.5) return DIRECTION_ARROWS.S; // behind
  if (relativeAngle >= -157.5 && relativeAngle < -112.5) return DIRECTION_ARROWS.SW; // behind-left
  if (relativeAngle >= -112.5 && relativeAngle < -67.5) return DIRECTION_ARROWS.W;  // left
  if (relativeAngle >= -67.5 && relativeAngle < -22.5) return DIRECTION_ARROWS.NW;  // ahead-left

  return DIRECTION_ARROWS.N;  // Fallback
}

/**
 * Spawn a vertical column of particles at the target location
 * Creates a sky beacon effect to help players locate the encounter
 *
 * @param {Dimension} dimension - Minecraft dimension
 * @param {{x: number, y: number, z: number}} target - Target location
 */
function spawnBeaconParticles(dimension, target) {
  try {
    // Get actual ground level at target
    const topBlock = dimension.getTopmostBlock({ x: target.x, z: target.z });
    const groundY = topBlock ? topBlock.y + 1 : target.y;

    // Spawn particles in a vertical column
    for (let i = 0; i < BEACON_PARTICLE_COUNT; i++) {
      const y = groundY + (i * (BEACON_HEIGHT / BEACON_PARTICLE_COUNT));

      // Small XZ variance for visual interest
      const variance = {
        x: (Math.random() - 0.5) * 0.5,
        z: (Math.random() - 0.5) * 0.5
      };

      dimension.spawnParticle(
        "minecraft:endrod",
        {
          x: target.x + variance.x,
          y: y,
          z: target.z + variance.z
        }
      );
    }
  } catch (error) {
    // Chunk may not be loaded - that's fine
  }
}

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
    // Increment beacon counter (Phase 5)
    beaconTickCounter++;
    if (beaconTickCounter >= BEACON_PULSE_INTERVAL) {
      beaconTickCounter = 0;
    }

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
    const arrow = getDirectionArrow(player, spawnLoc);

    // Use stored progress from questData (incremented by kill handler in main.js)
    // This is more reliable than live mob count which can fail or be inconsistent
    const progress = questData.progress || 0;

    try {
      // Actionbar with directional arrow (Phase 5)
      player.runCommandAsync(`titleraw @s actionbar {"rawtext":[{"text":"§6${quest.encounterName} §7| §fKill: §a${progress}§7/§c${quest.totalMobCount} §7| §e${arrow} §f${distance}m"}]}`);
    } catch (e) {
      // Actionbar may fail, not critical
    }

    // Spawn beacon if close enough (Phase 5)
    if (distance <= BEACON_ACTIVATION_DISTANCE && beaconTickCounter === 0) {
      spawnBeaconParticles(dimension, spawnLoc);
    }

    return; // Don't check for zone entry if already spawned
  }

  // === PENDING ENCOUNTER: Show travel objective ===
  if (quest.encounterState === "pending" && quest.encounterZone) {
    const zone = quest.encounterZone;
    const playerLoc = player.location;
    const distanceToZone = Math.floor(calculateDistance(playerLoc, zone.center));
    const arrow = getDirectionArrow(player, zone.center);

    try {
      // Actionbar with directional arrow (Phase 5)
      player.runCommandAsync(`titleraw @s actionbar {"rawtext":[{"text":"§6${quest.encounterName} §7| §fTravel to zone §7| §e${arrow} §f${distanceToZone}m"}]}`);
    } catch (e) {
      // Actionbar may fail
    }

    // Spawn beacon if close enough (Phase 5)
    if (distanceToZone <= BEACON_ACTIVATION_DISTANCE && beaconTickCounter === 0) {
      spawnBeaconParticles(player.dimension, zone.center);
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
