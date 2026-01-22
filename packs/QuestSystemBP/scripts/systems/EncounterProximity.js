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
 * - Directional arrow (16-direction custom glyphs) relative to player facing
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
  calculateDistance,
  getQuestBoardPosition
} from "./LocationValidator.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Check interval in ticks (20 ticks = 1 second)
 * Set to 2 ticks (10 updates/second) for fluid arrow navigation
 */
const CHECK_INTERVAL_TICKS = 2;

// ============================================================================
// NAVIGATION CONSTANTS (Phase 5)
// ============================================================================

/**
 * Arrow glyphs for 16 directions (22.5° increments)
 * Maps to glyph_E1.png spritesheet in resource pack
 * Unicode Private Use Area: E100-E10F
 */
const DIRECTION_ARROWS = {
  N:   "\uE100",  // 0° - ahead
  NNE: "\uE101",  // 22.5°
  NE:  "\uE102",  // 45°
  ENE: "\uE103",  // 67.5°
  E:   "\uE104",  // 90° - right
  ESE: "\uE105",  // 112.5°
  SE:  "\uE106",  // 135°
  SSE: "\uE107",  // 157.5°
  S:   "\uE108",  // 180° - behind
  SSW: "\uE109",  // 202.5° / -157.5°
  SW:  "\uE10A",  // 225° / -135°
  WSW: "\uE10B",  // 247.5° / -112.5°
  W:   "\uE10C",  // 270° / -90° - left
  WNW: "\uE10D",  // 292.5° / -67.5°
  NW:  "\uE10E",  // 315° / -45°
  NNW: "\uE10F"   // 337.5° / -22.5°
};

/**
 * Beacon configuration (Phase 5 Enhanced)
 * Sky beacon appears when player is close enough to help locate the target
 *
 * IMPROVEMENTS:
 * - Two-stage activation (far = top cap only, near = full beam)
 * - Thicker beam via ring columns
 * - Spiral animation for visibility
 * - Base flare for close-up presence
 * - Top cap marker for long-distance visibility
 * - Faster pulse rate (1 second vs 2 seconds)
 */
const BEACON_FAR_DISTANCE = 300;         // Show faint top cap at this distance
const BEACON_NEAR_DISTANCE = 150;        // Show full beam at this distance
const BEACON_PULSE_INTERVAL = 20;        // ticks (1 second for better visibility)
const BEACON_HEIGHT = 80;                // Taller beam for "beacon from sky" effect
const BEACON_PARTICLE_COUNT = 40;        // More particles for smoother appearance

// Beam thickness configuration
const BEAM_RADIUS = 1.8;                 // How thick the beam is
const BEAM_COLUMNS = 10;                 // Number of mini-columns around center
const BEAM_SHIMMER = 0.15;               // Random variance for sparkle effect

// Top cap configuration (visible from far away)
const TOP_CAP_RADIUS = 2.5;              // Size of the star/burst at top
const TOP_CAP_PARTICLES = 18;            // Number of particles in top ring
const TOP_CAP_HEIGHT_VARIANCE = 1.5;     // Vertical spread of top cap

// Base flare configuration (visible up close)
const BASE_FLARE_RADIUS = 3;             // Ground burst radius
const BASE_FLARE_PARTICLES = 24;         // Number of particles in ground burst
const BASE_FLARE_HEIGHT = 0.8;           // Vertical spread of base flare

// Animation
let beaconTickCounter = 0;
let beaconSpiralPhase = 0;               // For spiral animation

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

  // Convert to 16-direction arrow (22.5° per direction, ±11.25° boundaries)
  // 0° = ahead (N), 90° = right (E), -90° = left (W), 180° = behind (S)
  if (relativeAngle >= -11.25 && relativeAngle < 11.25) return DIRECTION_ARROWS.N;
  if (relativeAngle >= 11.25 && relativeAngle < 33.75) return DIRECTION_ARROWS.NNE;
  if (relativeAngle >= 33.75 && relativeAngle < 56.25) return DIRECTION_ARROWS.NE;
  if (relativeAngle >= 56.25 && relativeAngle < 78.75) return DIRECTION_ARROWS.ENE;
  if (relativeAngle >= 78.75 && relativeAngle < 101.25) return DIRECTION_ARROWS.E;
  if (relativeAngle >= 101.25 && relativeAngle < 123.75) return DIRECTION_ARROWS.ESE;
  if (relativeAngle >= 123.75 && relativeAngle < 146.25) return DIRECTION_ARROWS.SE;
  if (relativeAngle >= 146.25 && relativeAngle < 168.75) return DIRECTION_ARROWS.SSE;
  if (relativeAngle >= 168.75 || relativeAngle < -168.75) return DIRECTION_ARROWS.S;
  if (relativeAngle >= -168.75 && relativeAngle < -146.25) return DIRECTION_ARROWS.SSW;
  if (relativeAngle >= -146.25 && relativeAngle < -123.75) return DIRECTION_ARROWS.SW;
  if (relativeAngle >= -123.75 && relativeAngle < -101.25) return DIRECTION_ARROWS.WSW;
  if (relativeAngle >= -101.25 && relativeAngle < -78.75) return DIRECTION_ARROWS.W;
  if (relativeAngle >= -78.75 && relativeAngle < -56.25) return DIRECTION_ARROWS.WNW;
  if (relativeAngle >= -56.25 && relativeAngle < -33.75) return DIRECTION_ARROWS.NW;
  if (relativeAngle >= -33.75 && relativeAngle < -11.25) return DIRECTION_ARROWS.NNW;

  return DIRECTION_ARROWS.N;  // Fallback
}

/**
 * Spawn a base flare effect at ground level
 * Creates a radial burst that's visible when player is near the beacon
 *
 * @param {Dimension} dimension - Minecraft dimension
 * @param {{x: number, y: number, z: number}} pos - Ground position
 */
function spawnBaseFlare(dimension, pos) {
  try {
    for (let i = 0; i < BASE_FLARE_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * BASE_FLARE_RADIUS;

      dimension.spawnParticle("minecraft:endrod", {
        x: pos.x + Math.cos(angle) * radius,
        y: pos.y + (Math.random() * BASE_FLARE_HEIGHT),
        z: pos.z + Math.sin(angle) * radius
      });
    }
  } catch (error) {
    // Chunk may not be loaded
  }
}

/**
 * Spawn a top cap marker at the peak of the beacon
 * Creates a bright star/burst that's visible from far away
 *
 * @param {Dimension} dimension - Minecraft dimension
 * @param {{x: number, y: number, z: number}} pos - Top position
 */
function spawnTopCap(dimension, pos) {
  try {
    const topY = pos.y + BEACON_HEIGHT + 2;

    // Ring of particles at the top
    for (let i = 0; i < TOP_CAP_PARTICLES; i++) {
      const angle = (Math.PI * 2 * i) / TOP_CAP_PARTICLES;

      dimension.spawnParticle("minecraft:endrod", {
        x: pos.x + Math.cos(angle) * TOP_CAP_RADIUS,
        y: topY + (Math.random() * TOP_CAP_HEIGHT_VARIANCE),
        z: pos.z + Math.sin(angle) * TOP_CAP_RADIUS
      });
    }

    // Center burst for extra brightness
    for (let i = 0; i < 6; i++) {
      dimension.spawnParticle("minecraft:endrod", {
        x: pos.x + (Math.random() - 0.5) * 0.5,
        y: topY + (Math.random() * TOP_CAP_HEIGHT_VARIANCE),
        z: pos.z + (Math.random() - 0.5) * 0.5
      });
    }
  } catch (error) {
    // Chunk may not be loaded
  }
}

/**
 * Spawn the full beacon effect with thick beam, spiral animation, and effects
 * Creates a dramatic sky beacon that's visible from distance
 *
 * @param {Dimension} dimension - Minecraft dimension
 * @param {{x: number, y: number, z: number}} target - Target location
 * @param {boolean} fullBeam - If true, show full beam; if false, show top cap only
 */
function spawnBeaconParticles(dimension, target, fullBeam = true) {
  try {
    // Get actual ground level at target
    const topBlock = dimension.getTopmostBlock({ x: target.x, z: target.z });
    const groundY = topBlock ? topBlock.y + 1 : target.y;

    if (!fullBeam) {
      // Far away: just show top cap for performance
      spawnTopCap(dimension, { x: target.x, y: groundY, z: target.z });
      return;
    }

    // Near: show full beam with all effects

    // 1. THICK BEAM: Multiple columns in a ring with spiral animation
    for (let c = 0; c < BEAM_COLUMNS; c++) {
      const angle = (Math.PI * 2 * c) / BEAM_COLUMNS + beaconSpiralPhase;
      const offsetX = Math.cos(angle) * BEAM_RADIUS;
      const offsetZ = Math.sin(angle) * BEAM_RADIUS;

      // Spawn particles along this column with tapered distribution
      for (let i = 0; i < BEACON_PARTICLE_COUNT; i++) {
        // Cubic taper: more particles towards the top for "beacon from sky" feel
        const t = i / (BEACON_PARTICLE_COUNT - 1);
        const biased = 1 - Math.pow(1 - t, 3);
        const y = groundY + biased * BEACON_HEIGHT;

        // Small shimmer for sparkle effect
        const shimmerX = (Math.random() - 0.5) * BEAM_SHIMMER;
        const shimmerZ = (Math.random() - 0.5) * BEAM_SHIMMER;

        dimension.spawnParticle("minecraft:endrod", {
          x: target.x + offsetX + shimmerX,
          y: y,
          z: target.z + offsetZ + shimmerZ
        });
      }
    }

    // 2. BASE FLARE: Ground burst for close-up visibility
    spawnBaseFlare(dimension, { x: target.x, y: groundY, z: target.z });

    // 3. TOP CAP: Bright marker at the peak
    spawnTopCap(dimension, { x: target.x, y: groundY, z: target.z });

    // Advance spiral animation phase
    beaconSpiralPhase += 0.1;  // Slow rotation over time

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

    // Spawn beacon with two-stage activation (Phase 5 Enhanced)
    if (beaconTickCounter === 0) {
      if (distance <= BEACON_NEAR_DISTANCE) {
        // Near: Full beam with all effects
        spawnBeaconParticles(player.dimension, spawnLoc, true);

        // Play subtle beacon pulse sound
        try {
          player.playSound("beacon.ambient", { volume: 0.3, pitch: 1.2 });
        } catch (e) {
          // Sound may fail
        }
      } else if (distance <= BEACON_FAR_DISTANCE) {
        // Far: Top cap only (performance friendly)
        spawnBeaconParticles(player.dimension, spawnLoc, false);
      }
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

    // Spawn beacon with two-stage activation (Phase 5 Enhanced)
    if (beaconTickCounter === 0) {
      if (distanceToZone <= BEACON_NEAR_DISTANCE) {
        // Near: Full beam with all effects
        spawnBeaconParticles(player.dimension, zone.center, true);

        // Play subtle beacon pulse sound
        try {
          player.playSound("beacon.ambient", { volume: 0.3, pitch: 1.2 });
        } catch (e) {
          // Sound may fail
        }
      } else if (distanceToZone <= BEACON_FAR_DISTANCE) {
        // Far: Top cap only (performance friendly)
        spawnBeaconParticles(player.dimension, zone.center, false);
      }
    }
  }

  // === COMPLETE ENCOUNTER: Navigate back to quest board ===
  if (quest.encounterState === "complete") {
    const boardPos = getQuestBoardPosition();
    const playerLoc = player.location;
    const distance = Math.floor(calculateDistance(playerLoc, boardPos));
    const arrow = getDirectionArrow(player, boardPos);

    try {
      player.runCommandAsync(`titleraw @s actionbar {"rawtext":[{"text":"§aQuest complete! §7| §fReturn to board §7| §e${arrow} §f${distance}m"}]}`);
    } catch (e) {
      // Actionbar may fail, not critical
    }

    return;
  }

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
