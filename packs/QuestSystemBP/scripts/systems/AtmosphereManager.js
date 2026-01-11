import { system, world } from "@minecraft/server";

export class AtmosphereManager {
  static init() {
    // Run every 4 ticks (0.2 seconds) for rapid updates
    system.runInterval(() => {
      this.tick();
    }, 4);

    // Initial Cleanup
    system.run(() => {
      for (const player of world.getPlayers()) {
        player.removeTag("superquester:atmos_active");
      }
    });
  }

  /**
   * Triggered when a player specifically interacts with the board
   */
  static trigger(player) {
    if (!player) return;

    player.addTag("superquester:atmos_active");
    player.playSound("ambient.cave", { volume: 1.0, pitch: 0.5 });
  }

  static tick() {
    const locationJson = world.getDynamicProperty("superquester:board_location");
    if (!locationJson) return;

    let boardLoc;
    try {
      boardLoc = JSON.parse(locationJson);
    } catch (e) { return; }

    for (const player of world.getPlayers()) {
      if (!player.hasTag("superquester:atmos_active")) continue;
      if (!player.location) continue;

      const dx = player.location.x - boardLoc.x;
      const dy = player.location.y - boardLoc.y;
      const dz = player.location.z - boardLoc.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // EXIT CONDITION: If they move more than 8 blocks away (Tightened from 10)
      if (dist > 8) {
        player.removeTag("superquester:atmos_active");
        player.runCommand("effect @s clear");
        player.playSound("random.orb", { volume: 0.5, pitch: 1.5 });
        continue;
      }

      // ACTIVE CONDITION: Within 8 blocks
      // Base: Pitch Black
      player.addEffect("blindness", 40, { amplifier: 0, showParticles: false });
      player.addEffect("darkness", 40, { amplifier: 0, showParticles: false });

      // Strobe Light: "Blink 200% Faster"
      // Every 8 ticks, flash Night Vision for 2 ticks.
      // This creates a disorienting lightning/strobe effect in the dark.
      if (system.currentTick % 8 < 2) {
        player.addEffect("night_vision", 2, { amplifier: 0, showParticles: false });
      }
    }
  }
}
