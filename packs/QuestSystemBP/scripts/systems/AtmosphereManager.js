/**
 * ============================================================================
 * ATMOSPHERE MANAGER — Quest Board Proximity Effects
 * ============================================================================
 * 
 * AI AGENT ORIENTATION:
 * ---------------------
 * This module creates magical ambiance near the quest board. When players
 * approach within 10 blocks, they experience:
 *   • Night Vision (makes the area bright and clear)
 *   • Slow Falling (floaty "holy" weightlessness)
 *   • Particle effects (white end_rod sparkles above the board)
 *   • Custom ambient sounds (magical hum + chimes)
 * 
 * USAGE:
 *   AtmosphereManager.init();  // Call once at startup (in main.js bootstrap)
 * 
 * CONFIGURATION:
 * - Zone radius: 10 blocks (3D sphere around board)
 * - Effects refresh every 10 ticks (0.5 seconds)
 * - Audio volume scales with distance (louder when closer)
 * 
 * SOUNDS USED:
 * - quest.board_ambient — Base magical hum (every tick in zone)
 * - quest.board_chime — Accent chime (every 20 ticks / 1 second)
 * 
 * HARDCODED VALUES:
 * - Board location: { x: 72, y: 75, z: -278 }
 *   NOTE: This should match QUEST_BOARD_LOCATION in main.js!
 * 
 * ============================================================================
 */

import { system, world } from "@minecraft/server";

export class AtmosphereManager {
  // Quest Board location — should match main.js QUEST_BOARD_LOCATION
  static BOARD_LOCATION = { x: 72, y: 75, z: -278 };
  static ZONE_RADIUS = 10; // blocks

  static init() {
    // Run every 10 ticks (0.5 seconds)
    system.runInterval(() => {
      this.tick();
    }, 10);
    console.warn("[AtmosphereManager] Initialized — proximity effects active");
  }

  static tick() {
    const boardLoc = this.BOARD_LOCATION;

    for (const player of world.getPlayers()) {
      if (!player.location) continue;

      const dx = player.location.x - boardLoc.x;
      const dy = player.location.y - boardLoc.y;
      const dz = player.location.z - boardLoc.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // The "Ascension" Zone (Distance < 10 blocks)
      if (dist < this.ZONE_RADIUS) {
        // --- EFFECTS ---
        // Night Vision (200 ticks = 10s) -> Makes it bright and clear
        player.addEffect("night_vision", 200, { amplifier: 0, showParticles: false });

        // Slow Falling -> Adds the floaty "Holy" weightlessness
        player.addEffect("slow_falling", 200, { amplifier: 0, showParticles: false });

        // --- PARTICLES ---
        // White sparkles (end_rod) above the board
        player.dimension.spawnParticle("minecraft:end_rod", {
          x: boardLoc.x + 0.5,
          y: boardLoc.y + 1.5,
          z: boardLoc.z + 0.5
        });

        // --- AUDIO (Distance-based volume falloff) ---
        // Full volume at <1 block, 10% quieter per block away
        const MAX_VOLUME = 0.25;
        const FALLOFF_RATE = 0.10;
        const MIN_VOLUME = 0.025;

        const volumeMultiplier = Math.max(MIN_VOLUME, 1 - (dist * FALLOFF_RATE));
        const currentVolume = MAX_VOLUME * volumeMultiplier;

        // Base Hum (custom magical sound)
        player.playSound("quest.board_ambient", { volume: currentVolume, pitch: 1.0 });

        // Accent Chime (every 20 ticks / 1 second, slightly quieter)
        if (system.currentTick % 20 === 0) {
          player.playSound("quest.board_chime", { volume: currentVolume * 0.6, pitch: 1.3 });
        }
      }
    }
  }
}