/**
 * ============================================================================
 * MOB TYPES — Entity Type ID Mapping
 * ============================================================================
 * 
 * AI AGENT ORIENTATION:
 * ---------------------
 * This utility maps specific mob variant type IDs to their canonical base type.
 * Used by handleEntityDeath to match kills against quest targets.
 * 
 * EXAMPLE: A quest targeting "zombie" should count zombies, baby zombies,
 * husks, drowned, etc. This function helps with that mapping.
 * 
 * USAGE:
 *   const mobType = getMobType(entity);
 *   // Returns: "zombie", "skeleton", "spider", etc. or null if no mapping
 * 
 * ============================================================================
 */

/**
 * Maps entity type IDs to their canonical mob type.
 * @param {Entity} entity - The Minecraft entity
 * @returns {string|null} - The canonical mob type or null
 */
export function getMobType(entity) {
  if (!entity || !entity.typeId) return null;

  const typeId = entity.typeId.replace("minecraft:", "");

  // Zombie family
  if (typeId === "zombie" || typeId === "zombie_villager" ||
    typeId === "husk" || typeId === "drowned") {
    return "zombie";
  }

  // Skeleton family
  if (typeId === "skeleton" || typeId === "stray" || typeId === "wither_skeleton") {
    return "skeleton";
  }

  // Spider family
  if (typeId === "spider" || typeId === "cave_spider") {
    return "spider";
  }

  // Creeper (just itself, but kept for consistency)
  if (typeId === "creeper") {
    return "creeper";
  }

  // Enderman (just itself)
  if (typeId === "enderman") {
    return "enderman";
  }

  // Slime family
  if (typeId === "slime" || typeId === "magma_cube") {
    return "slime";
  }

  // Blaze (just itself)
  if (typeId === "blaze") {
    return "blaze";
  }

  // Ghast (just itself)
  if (typeId === "ghast") {
    return "ghast";
  }

  // Piglin family (includes piglin brutes, zombified piglins)
  if (typeId === "piglin" || typeId === "piglin_brute" || typeId === "zombified_piglin") {
    return "piglin";
  }

  // Witch (just itself)
  if (typeId === "witch") {
    return "witch";
  }

  // Wither (boss)
  if (typeId === "wither") {
    return "wither";
  }

  // Ender Dragon (boss)
  if (typeId === "ender_dragon") {
    return "ender_dragon";
  }

  // No mapping found
  return null;
}
