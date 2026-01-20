/**
 * ============================================================================
 * ENCOUNTER TABLE — Curated Mob Group Definitions
 * ============================================================================
 *
 * AI AGENT ORIENTATION:
 * ---------------------
 * This module defines PRE-CONFIGURED mob encounters for Rare and Legendary quests.
 * Unlike standard kill quests (which spawn naturally), encounter quests spawn
 * specific mob groups at calculated distances from the quest board.
 *
 * CRITICAL CONTEXT:
 * - This is part of the Encounter System (Phase 1-5 implementation)
 * - Rare/Legendary quests now use encounters instead of random kill quests
 * - Common and Mythic tiers are NOT affected by this system
 *
 * DATA STRUCTURE:
 * Each encounter defines:
 * - id: Unique identifier (used for tracking and debugging)
 * - name: Display name shown to players
 * - description: Quest board flavor text
 * - tier: "rare" or "legendary" (determines spawn ring distance)
 * - mobs: Array of mob groups to spawn (see schema below)
 * - totalMobCount: Sum of all mob counts (for progress tracking)
 *
 * MOB GROUP SCHEMA:
 * {
 *   type: string,           // Full entity ID (e.g., "minecraft:skeleton")
 *   count: number,          // How many to spawn
 *   equipment: object|null, // Future: custom armor/weapons (not implemented in Phase 1)
 *   nameTag: string|null    // Custom name tag (e.g., "Frost Archer")
 * }
 *
 * SPAWN MECHANICS (implemented in later phases):
 * - Rare encounters: Spawn 60-120 blocks from quest board
 * - Legendary encounters: Spawn 100-200 blocks from quest board
 * - Mobs are tagged with quest ID for kill tracking
 * - Mobs persist across logout/login until quest completes
 *
 * REWARD SYSTEM:
 * - Rewards calculated by EncounterManager using RewardCalculator
 * - Based on totalMobCount and tier (same as standard kill quests)
 * - Rare base: ~50 SP, Legendary base: ~150 SP (before bonuses)
 *
 * MODIFICATION GUIDELINES:
 * - To add new encounters: Add objects to ENCOUNTER_TABLE array
 * - Keep totalMobCount accurate (manually sum mob counts)
 * - Use full entity IDs with "minecraft:" prefix
 * - Test new encounters with "!encounter test generate <tier>" command
 *
 * DEPENDENCIES:
 * - Used by: EncounterManager.js (quest generation)
 * - No external dependencies
 *
 * ============================================================================
 */

export const ENCOUNTER_TABLE = [
  // ============================================
  // RARE TIER (4 encounters)
  // Target: 3-6 mobs, straightforward composition
  // Spawn distance: 18-22 blocks from player
  // ============================================
  {
    id: "skeleton_warband",
    name: "Skeleton Warband",
    description: "A group of skeletal warriors has assembled nearby.",
    tier: "rare",
    mobs: [
      { type: "minecraft:skeleton", count: 5, equipment: null, nameTag: null }
    ],
    totalMobCount: 5
  },
  {
    id: "zombie_pack",
    name: "Shambling Horde",
    description: "The dead are walking. Put them down.",
    tier: "rare",
    mobs: [
      { type: "minecraft:zombie", count: 6, equipment: null, nameTag: null }
    ],
    totalMobCount: 6
  },
  {
    id: "spider_nest",
    name: "Spider Nest",
    description: "Arachnids have infested the area.",
    tier: "rare",
    mobs: [
      { type: "minecraft:spider", count: 4, equipment: null, nameTag: null },
      { type: "minecraft:cave_spider", count: 2, equipment: null, nameTag: null }
    ],
    totalMobCount: 6  // 4 spiders + 2 cave spiders
  },
  {
    id: "creeper_cluster",
    name: "Creeper Problem",
    description: "Something hisses in the shadows...",
    tier: "rare",
    mobs: [
      { type: "minecraft:creeper", count: 3, equipment: null, nameTag: null }
    ],
    totalMobCount: 3  // Fewer mobs, but creepers are dangerous
  },

  // ============================================
  // LEGENDARY TIER (4 encounters)
  // Target: 6-14 mobs, mixed mob types, named elites
  // Spawn distance: 18-22 blocks from player
  // ============================================
  {
    id: "skeleton_legion",
    name: "Skeleton Legion",
    description: "An organized force of the undead marches on the realm.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:skeleton", count: 8, equipment: null, nameTag: null },
      { type: "minecraft:stray", count: 3, equipment: null, nameTag: "Frost Archer" }
    ],
    totalMobCount: 11  // 8 skeletons + 3 strays
  },
  {
    id: "zombie_siege",
    name: "Zombie Siege",
    description: "A massive horde approaches. Hold the line.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:zombie", count: 10, equipment: null, nameTag: null },
      { type: "minecraft:husk", count: 4, equipment: null, nameTag: null }
    ],
    totalMobCount: 14  // 10 zombies + 4 husks (largest encounter)
  },
  {
    id: "phantom_swarm",
    name: "Phantom Swarm",
    description: "Nightmares made flesh circle overhead.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:phantom", count: 6, equipment: null, nameTag: null }
    ],
    totalMobCount: 6  // Fewer mobs, but flying and dangerous
  },
  {
    id: "witch_coven",
    name: "Witch Coven",
    description: "Dark magic corrupts this land.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:witch", count: 3, equipment: null, nameTag: null },
      { type: "minecraft:zombie_villager", count: 4, equipment: null, nameTag: "Cursed Villager" }
    ],
    totalMobCount: 7  // 3 witches + 4 zombie villagers
  }
];

/**
 * Get all encounters for a specific tier
 *
 * @param {string} tier - "rare" or "legendary"
 * @returns {Array} Array of encounter definitions matching the tier
 *
 * @example
 * const rareEncounters = getEncountersByTier("rare");
 * // Returns: [skeleton_warband, zombie_pack, spider_nest, creeper_cluster]
 */
export function getEncountersByTier(tier) {
  return ENCOUNTER_TABLE.filter(encounter => encounter.tier === tier);
}

/**
 * Get a specific encounter by ID (for debugging/testing)
 *
 * @param {string} id - Encounter ID (e.g., "skeleton_warband")
 * @returns {Object|undefined} Encounter definition or undefined if not found
 *
 * @example
 * const encounter = getEncounterById("skeleton_warband");
 * if (encounter) {
 *   console.log(encounter.name);  // "Skeleton Warband"
 * }
 */
export function getEncounterById(id) {
  return ENCOUNTER_TABLE.find(encounter => encounter.id === id);
}
