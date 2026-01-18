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

  // Enderman
  if (typeId === "enderman") {
    return "enderman";
  }

  // Slime family
  if (typeId === "slime" || typeId === "magma_cube") {
    return "slime";
  }

  // Piglin family  
  if (typeId === "piglin" || typeId === "piglin_brute" || typeId === "zombified_piglin") {
    return "piglin";
  }

  // Illager family
  if (typeId === "pillager" || typeId === "vindicator" ||
    typeId === "evoker" || typeId === "ravager") {
    return "illager";
  }

  // Default: return the simple type ID
  return typeId;
}
