/**
 * ============================================================================
 * SAFE ZONE — Hub Protection System
 * ============================================================================
 * 
 * AI AGENT ORIENTATION:
 * ---------------------
 * This module protects the town hub area from destruction and griefing.
 * It creates a 20-block cylindrical zone around the quest board where:
 *   • Players cannot break or place blocks (unless admin)
 *   • Hostile mobs are auto-removed on spawn
 *   • Explosion damage is blocked
 *   • Player damage from hostiles is cancelled
 * 
 * EXPORTS:
 * - isInSafeZone(location) → boolean
 * - setSafeZoneEnabled(enabled) → void
 * - isSafeZoneEnabled() → boolean
 * - registerSafeZoneEvents() → void (call once at startup)
 * - handleSafeZoneCommand(chatEvent) → boolean (for !safezone command)
 * 
 * ADMIN COMMANDS (in-game chat):
 *   !safezone on      — Enable protection
 *   !safezone off     — Disable protection
 *   !safezone status  — Show current settings
 * 
 * ADMIN BYPASS:
 * Players with "admin" tag, operator status, or name "Jolva" can build here.
 * 
 * HARDCODED VALUES:
 * - Center: { x: 72, y: 75, z: -278 } (quest board location)
 * - Radius: 20 blocks (2D cylinder, ignores Y)
 * 
 * ============================================================================
 */

import { world, system } from "@minecraft/server";
const WARN_MESSAGE = "§cProtected Hub: No Building Allowed.";
const DEFAULT_RADIUS = 20;

// PERMANENT Quest Board Location - This is the fixed center of the safe zone
const QUEST_BOARD_LOCATION = { x: 72, y: 75, z: -278 };

// Dynamic state - can be toggled in-game
let safeZoneEnabled = true;

/**
 * Gets the quest board location (hardcoded permanent location).
 * @returns {{ x: number, y: number, z: number }}
 */
function getBoardLocation() {
  return QUEST_BOARD_LOCATION;
}

/**
 * Get safe zone configuration, using dynamic board location.
 * @returns {{ enabled: boolean, center: {x: number, y: number, z: number} | null, radius: number }}
 */
function getSafeZoneConfig() {
  return {
    enabled: safeZoneEnabled,
    center: getBoardLocation(),
    radius: DEFAULT_RADIUS
  };
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
 * Toggle safe zone on or off
 * @param {boolean} enabled 
 */
export function setSafeZoneEnabled(enabled) {
  safeZoneEnabled = enabled;
  console.warn(`[SafeZone] Protection ${enabled ? "ENABLED" : "DISABLED"}`);
}

/**
 * Get current safe zone status
 * @returns {boolean}
 */
export function isSafeZoneEnabled() {
  return safeZoneEnabled;
}

/**
 * Checks if a player is permitted to bypass safe zone restrictions.
 * @param {import("@minecraft/server").Player} player 
 */
function canBypass(player) {
  // Check for admin tag
  if (player.hasTag && player.hasTag("admin")) return true;

  // Check for operator status
  try {
    if (player.isOp && typeof player.isOp === "function" && player.isOp()) {
      return true;
    }
  } catch (e) {
    // isOp may not be available in all versions
  }

  // Fallback: hardcoded names (can be expanded)
  const ADMIN_NAMES = ["Jolva"];
  if (ADMIN_NAMES.includes(player.name)) return true;

  return false;
}

export function registerSafeZoneEvents() {
  console.warn("[SafeZone] Registering protection events (20 block radius around quest board)");

  // 1. Block Break Prevention
  world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    try {
      if (!safeZoneEnabled) return;
      if (canBypass(ev.player)) return;
      if (isInSafeZone(ev.block.location)) {
        ev.cancel = true;
        system.run(() => {
          ev.player.onScreenDisplay?.setActionBar?.(WARN_MESSAGE);
        });
      }
    } catch (e) {
      console.warn(`[SafeZone Error] Break: ${e}`);
    }
  });

  // 2. Block Place Prevention
  if (world.beforeEvents.playerPlaceBlock) {
    world.beforeEvents.playerPlaceBlock.subscribe((ev) => {
      try {
        if (!safeZoneEnabled) return;
        if (canBypass(ev.player)) return;
        if (isInSafeZone(ev.block.location)) {
          ev.cancel = true;
          system.run(() => {
            ev.player.onScreenDisplay?.setActionBar?.(WARN_MESSAGE);
          });
        }
      } catch (e) {
        console.warn(`[SafeZone Error] Place: ${e}`);
      }
    });
  }

  // 3. Prevent Player Damage from Hostile Mobs in Safe Zone
  const damageEvent = world.beforeEvents.entityDamage ?? world.beforeEvents.entityHurt;
  if (damageEvent) {
    damageEvent.subscribe((ev) => {
      if (!safeZoneEnabled) return;

      const entity = ev.entity ?? ev.hurtEntity;
      if (!entity || entity.typeId !== "minecraft:player") return;

      if (isInSafeZone(entity.location)) {
        const attacker = ev.damageSource.damagingEntity;
        if (attacker && isHostile(attacker.typeId)) {
          ev.cancel = true;
        }
      }
    });
  }

  // 4. Prevent Explosion Damage in Safe Zone (creepers, TNT, etc.)
  if (world.beforeEvents.explosion) {
    world.beforeEvents.explosion.subscribe((ev) => {
      if (!safeZoneEnabled) return;

      // Check if explosion origin is in safe zone
      if (ev.source && isInSafeZone(ev.source.location)) {
        ev.cancel = true;
        return;
      }

      // Filter out blocks that would be destroyed in safe zone
      if (ev.getImpactedBlocks) {
        const blocks = ev.getImpactedBlocks();
        const safeBlocks = blocks.filter(block => !isInSafeZone(block.location));
        ev.setImpactedBlocks(safeBlocks);
      }
    });
  }

  // 5. Clean up hostile mobs that spawn in safe zone
  world.afterEvents.entitySpawn.subscribe((ev) => {
    if (!safeZoneEnabled) return;

    const { entity, cause } = ev;
    if (!entity.isValid()) return;

    // Allow manual spawning by admins/testing
    if (cause === "SpawnEgg" || cause === "Command" || cause === "Override") return;

    // Only check hostiles in safe zone
    if (!isHostile(entity.typeId) || !isInSafeZone(entity.location)) return;

    // ENCOUNTER SYSTEM EXCEPTION: Delay check to allow tags to be applied
    // The encounter spawner adds tags immediately after spawn, but this event
    // fires synchronously. Wait 1 tick then check for the tag.
    const entityId = entity.id;
    system.runTimeout(() => {
      try {
        // Re-fetch entity - it may have been removed or become invalid
        if (!entity.isValid()) return;

        // Check for encounter mob tag (applied by EncounterSpawner)
        if (entity.hasTag && entity.hasTag("sq_encounter_mob")) {
          return; // This is an encounter mob - don't remove it
        }

        // Not an encounter mob - remove it
        console.warn(`[SafeZone] Removing unauthorized hostile: ${entity.typeId} (Cause: ${cause})`);
        entity.remove();
      } catch (e) {
        // Entity may have been removed already
      }
    }, 1); // 1 tick delay to allow tags to be applied
  });

  // 6. Prevent Enderman block pickup in safe zone
  world.afterEvents.entityLoad.subscribe((ev) => {
    if (!safeZoneEnabled) return;

    const { entity } = ev;
    if (entity.typeId === "minecraft:enderman" && isInSafeZone(entity.location)) {
      // Remove enderman's carried block if any or just remove endermen entirely
      try {
        entity.remove();
      } catch (e) { }
    }
  });
}

/**
 * Register the !safezone command for toggling protection
 * @param {import("@minecraft/server").ChatSendBeforeEvent} ev 
 */
export function handleSafeZoneCommand(ev) {
  const { sender, message } = ev;

  if (!message.startsWith("!safezone")) return false;

  // Check if player is admin
  if (!canBypass(sender)) {
    sender.sendMessage("§cYou don't have permission to use this command.§r");
    ev.cancel = true;
    return true;
  }

  const args = message.trim().split(/\s+/);
  const subcommand = args[1]?.toLowerCase();

  ev.cancel = true;

  switch (subcommand) {
    case "on":
    case "enable":
      setSafeZoneEnabled(true);
      sender.sendMessage("§a✓ Safe Zone protection ENABLED§r");
      sender.sendMessage(`§7Radius: ${DEFAULT_RADIUS} blocks around quest board§r`);
      break;

    case "off":
    case "disable":
      setSafeZoneEnabled(false);
      sender.sendMessage("§c✗ Safe Zone protection DISABLED§r");
      sender.sendMessage("§7Players can now build/break in the protected area§r");
      break;

    case "status":
      const config = getSafeZoneConfig();
      sender.sendMessage("§6=== Safe Zone Status ===§r");
      sender.sendMessage(`§7Protection: ${safeZoneEnabled ? "§aENABLED" : "§cDISABLED"}§r`);
      if (config.center) {
        sender.sendMessage(`§7Center: X:${config.center.x}, Y:${config.center.y}, Z:${config.center.z}§r`);
      } else {
        sender.sendMessage("§7Center: §cNot set (place quest board first)§r");
      }
      sender.sendMessage(`§7Radius: ${config.radius} blocks§r`);
      break;

    case "radius":
      sender.sendMessage(`§7Current radius: ${DEFAULT_RADIUS} blocks§r`);
      sender.sendMessage("§7(Radius is hardcoded - modify safeZone.js to change)§r");
      break;

    default:
      sender.sendMessage("§6=== Safe Zone Commands ===§r");
      sender.sendMessage("§e!safezone on§r - Enable protection");
      sender.sendMessage("§e!safezone off§r - Disable protection");
      sender.sendMessage("§e!safezone status§r - Show current settings");
      break;
  }

  return true;
}

function isHostile(typeId) {
  const HOSTILES = [
    // Undead
    "minecraft:zombie", "minecraft:zombie_villager", "minecraft:drowned",
    "minecraft:husk", "minecraft:skeleton", "minecraft:stray",
    "minecraft:wither_skeleton", "minecraft:phantom", "minecraft:zoglin",

    // Monsters
    "minecraft:creeper", "minecraft:spider", "minecraft:cave_spider",
    "minecraft:witch", "minecraft:slime", "minecraft:magma_cube",
    "minecraft:silverfish", "minecraft:endermite", "minecraft:guardian",
    "minecraft:elder_guardian",

    // Nether
    "minecraft:blaze", "minecraft:ghast", "minecraft:hoglin",
    "minecraft:piglin_brute",

    // Illagers
    "minecraft:pillager", "minecraft:vindicator", "minecraft:evoker",
    "minecraft:ravager", "minecraft:vex", "minecraft:illusioner",

    // Others
    "minecraft:enderman", "minecraft:shulker", "minecraft:warden"
  ];
  return HOSTILES.includes(typeId);
}
