import { world, system } from "@minecraft/server";
import { CONFIG } from "./config.js";

const WARN_MESSAGE = "§cProtected Hub: No Building Allowed.";

function getSafeZoneConfig() {
  return CONFIG?.safeZone ?? { enabled: false };
}

/**
 * Checks if a location is within the safe zone radius of the center.
 * @param {import("@minecraft/server").Vector3} location
 * @returns {boolean}
 */
export function isInSafeZone(location) {
  const { enabled, center, radius } = getSafeZoneConfig();
  if (!enabled) return false;
  if (!location || !center) return false;

  const dx = location.x - center.x;
  const dz = location.z - center.z;
  // Simple 2D distance check (cylinder protection)
  return (dx * dx + dz * dz) <= (radius * radius);
}

/**
 * Checks if a player is permitted to bypass safe zone restrictions.
 * @param {import("@minecraft/server").Player} player 
 */
function canBypass(player) {
  const { debug } = getSafeZoneConfig();
  if (debug) return false;
  return player.isOp();
}

export function registerSafeZoneEvents() {
  const { enabled } = getSafeZoneConfig();
  if (!enabled) return;

  // 1. Block Break
  world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    if (canBypass(ev.player)) return;

    if (isInSafeZone(ev.block.location)) {
      ev.cancel = true;
      system.run(() => {
        ev.player.onScreenDisplay?.setActionBar?.(WARN_MESSAGE);
      });
    }
  });

  // 2. Block Place
  // Note: API availability check is good practice
  if (world.beforeEvents.playerPlaceBlock) {
    world.beforeEvents.playerPlaceBlock.subscribe((ev) => {
      if (canBypass(ev.player)) return;

      if (isInSafeZone(ev.block.location)) {
        ev.cancel = true;
        system.run(() => {
          ev.player.onScreenDisplay?.setActionBar?.(WARN_MESSAGE);
        });
      }
    });
  }

  // 3. Peaceful Hub (Prevent Hostile Mob Damage)
  // We want to prevent players inside the safezone from taking damage from hostile mobs.
  // Or prevent hostile mobs from dealing damage at all inside the safe zone.
  // 3. Peaceful Hub (Prevent Hostile Mob Damage)
  const damageEvent = world.beforeEvents.entityDamage ?? world.beforeEvents.entityHurt;
  if (damageEvent) {
    damageEvent.subscribe((ev) => {
      // Compatibility: 'entity' vs 'hurtEntity' depending on API version
      const entity = ev.entity ?? ev.hurtEntity;
      if (!entity || entity.typeId !== "minecraft:player") return;

      if (isInSafeZone(entity.location)) {
        const attacker = ev.damageSource.damagingEntity;
        if (attacker && isHostile(attacker.typeId)) {
          ev.cancel = true;
        }
      }
    });
  } else {
    // Just log once so console isn't spammed, or ignore.
    console.warn("Milestone 3 Warning: world.beforeEvents.entityDamage/entityHurt is unavailable. Peaceful hub feature limited.");
  }

  // 4. Clean up hostile mobs that somehow spawn in
  world.afterEvents.entitySpawn.subscribe((ev) => {
    const { entity, cause } = ev;
    if (!entity.isValid()) return;

    // Allow manual spawning by admins/testing
    if (cause === "SpawnEgg" || cause === "Command" || cause === "Override") return;

    if (isHostile(entity.typeId) && isInSafeZone(entity.location)) {
      // Remove immediately
      try {
        entity.remove();
      } catch (e) { }
    }
  });
}

function isHostile(typeId) {
  // This list can be expanded or moved to config if needed
  const HOSTILES = [
    "minecraft:zombie", "minecraft:creeper", "minecraft:skeleton",
    "minecraft:spider", "minecraft:witch", "minecraft:enderman",
    "minecraft:pillager", "minecraft:ravager", "minecraft:zombie_villager",
    "minecraft:drowned", "minecraft:husk", "minecraft:stray",
    "minecraft:phantom", "minecraft:slime", "minecraft:magma_cube"
  ];
  return HOSTILES.includes(typeId);
}
