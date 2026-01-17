import { system, world } from "@minecraft/server";

export class AtmosphereManager {
  static init() {
    // Run every 10 ticks (0.5 seconds)
    system.runInterval(() => {
      this.tick();
    }, 10);
  }

  static tick() {
    // Hardcoded Quest Board Location
    const boardLoc = { x: 71, y: 78, z: -278 };

    for (const player of world.getPlayers()) {
      if (!player.location) continue;

      const dx = player.location.x - boardLoc.x;
      const dy = player.location.y - boardLoc.y;
      const dz = player.location.z - boardLoc.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // The "Ascension" Zone (Distance < 10 blocks)
      if (dist < 10) {
        // --- VISUALS ---
        // REMOVED: Blindness (This was causing the black screen).
        // REMOVED: Darkness.

        // KEEP: Night Vision (200 ticks = 10s) -> Makes it bright and clear.
        player.addEffect("night_vision", 200, { amplifier: 0, showParticles: false });

        // KEEP: Slow Falling -> Adds the floaty "Holy" weightlessness.
        player.addEffect("slow_falling", 200, { amplifier: 0, showParticles: false });

        // --- PARTICLES ---
        // White sparkles (end_rod).
        // Added +0.5 to center them in the block.
        player.dimension.spawnParticle("minecraft:end_rod", {
          x: boardLoc.x + 0.5,
          y: boardLoc.y + 1.5,
          z: boardLoc.z + 0.5
        });

        // --- AUDIO (Distance-based volume falloff) ---
        // Full volume at <1 block, 10% quieter per block away
        // Formula: volume = baseVolume * (1 - (distance * 0.1))
        // Clamped to minimum 0.1 to prevent complete silence at edge

        const MAX_VOLUME = 1.05;  // Volume when standing right at the board (reduced 30%)
        const FALLOFF_RATE = 0.10;  // 10% reduction per block
        const MIN_VOLUME = 0.1;  // Minimum volume at edge of zone

        // Calculate volume based on distance (closer = louder)
        const volumeMultiplier = Math.max(MIN_VOLUME, 1 - (dist * FALLOFF_RATE));
        const currentVolume = MAX_VOLUME * volumeMultiplier;

        // Base Hum (custom magical sound)
        player.playSound("quest.board_ambient", { volume: currentVolume, pitch: 1.0 });

        // Accent Chime (Once per second -> Every 20 ticks, slightly quieter)
        if (system.currentTick % 20 === 0) {
          player.playSound("quest.board_chime", { volume: currentVolume * 0.6, pitch: 1.3 });
        }
      }
    }
  }
}