/**
 * ============================================================================
 * ENCOUNTER TABLE — Curated Mob Group Definitions
 * ============================================================================
 *
 * AI AGENT ORIENTATION:
 * ---------------------
 * This module defines PRE-CONFIGURED mob encounters for Rare, Legendary, and
 * Mythic quests. Unlike standard kill quests (which spawn naturally), encounter
 * quests spawn specific mob groups at calculated distances from the quest board.
 *
 * CRITICAL CONTEXT:
 * - This is part of the Encounter System (Phase 1-5 implementation)
 * - Rare/Legendary/Mythic quests now use encounters instead of random kill quests
 * - Common tier is NOT affected by this system
 *
 * DATA STRUCTURE:
 * Each encounter defines:
 * - id: Unique identifier (used for tracking and debugging)
 * - name: Display name shown to players
 * - description: Quest board flavor text
 * - tier: "rare", "legendary", or "mythic" (determines spawn ring distance)
 * - mobs: Array of mob groups to spawn (see schema below)
 * - totalMobCount: Sum of all mob counts (for progress tracking)
 *
 * MOB GROUP SCHEMA:
 * {
 *   type: string,           // Full entity ID (e.g., "minecraft:skeleton")
 *   count: number,          // How many to spawn
 *   equipment: object|null, // Future: custom armor/weapons (not implemented)
 *   nameTag: string|null    // Custom name tag (e.g., "Frost Archer")
 * }
 *
 * SPAWN MECHANICS:
 * - Rare encounters: Zone 60-120 blocks from quest board
 * - Legendary encounters: Zone 100-200 blocks from quest board
 * - Mythic encounters: Zone 120-220 blocks from quest board
 * - Mobs spawn 18-22 blocks from player when entering zone
 * - Mobs are tagged with quest ID for kill tracking
 * - Mobs persist across logout/login until quest completes
 *
 * SPECIAL NOTES:
 * - Vex are excluded from totalMobCount (they despawn naturally)
 * - Piglins/Hoglins may convert in overworld (intended chaos)
 * - Only tagged mobs count toward progress (spawned children don't count)
 *
 * REWARD SYSTEM:
 * - Rewards calculated by EncounterManager using RewardCalculator
 * - Based on totalMobCount and tier
 *
 * MODIFICATION GUIDELINES:
 * - To add new encounters: Add objects to ENCOUNTER_TABLE array
 * - Keep totalMobCount accurate (manually sum mob counts, exclude vex)
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
  // ============================================================================
  // THEME 1: UNDEAD HORDE (5 encounters)
  // The dead refuse to stay buried.
  // ============================================================================

  // --- RARE ---
  {
    id: "gravediggers_mistake",
    name: "Gravedigger's Mistake",
    description: "Something was disturbed that should have stayed buried.",
    tier: "rare",
    mobs: [
      { type: "minecraft:zombie", count: 4, equipment: null, nameTag: null },
      { type: "minecraft:zombie_villager", count: 1, equipment: null, nameTag: "The First Risen" }
    ],
    totalMobCount: 5
  },
  {
    id: "bone_collectors",
    name: "Bone Collectors",
    description: "Skeletons patrol the area, gathering remains for unknown purposes.",
    tier: "rare",
    mobs: [
      { type: "minecraft:skeleton", count: 4, equipment: null, nameTag: null }
    ],
    totalMobCount: 4
  },

  // --- LEGENDARY ---
  {
    id: "restless_battalion",
    name: "The Restless Battalion",
    description: "An entire unit of fallen soldiers marches again under a deathless commander.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:skeleton", count: 6, equipment: null, nameTag: null },
      { type: "minecraft:stray", count: 3, equipment: null, nameTag: null },
      { type: "minecraft:skeleton", count: 1, equipment: null, nameTag: "Captain Ashford" }
    ],
    totalMobCount: 10
  },
  {
    id: "drowned_expedition",
    name: "Drowned Expedition",
    description: "A doomed expedition has returned from the depths, waterlogged and hungry.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:drowned", count: 8, equipment: null, nameTag: null },
      { type: "minecraft:drowned", count: 1, equipment: null, nameTag: "Captain Tidewalker" }
    ],
    totalMobCount: 9
  },

  // --- MYTHIC ---
  {
    id: "bone_sovereign",
    name: "The Bone Sovereign",
    description: "A lord of the undead has claimed this land. Their legion answers only to them.",
    tier: "mythic",
    mobs: [
      { type: "minecraft:skeleton", count: 8, equipment: null, nameTag: null },
      { type: "minecraft:stray", count: 4, equipment: null, nameTag: "Frozen Honor Guard" },
      { type: "minecraft:wither_skeleton", count: 2, equipment: null, nameTag: "Ashen Champion" },
      { type: "minecraft:skeleton", count: 1, equipment: null, nameTag: "The Bone Sovereign" }
    ],
    totalMobCount: 15
  },

  // ============================================================================
  // THEME 2: ARACHNID INFESTATION (4 encounters)
  // Eight-legged horrors emerge from the darkness.
  // ============================================================================

  // --- RARE ---
  {
    id: "webspinner_den",
    name: "Webspinner Den",
    description: "The webs grow thick here. You are not alone.",
    tier: "rare",
    mobs: [
      { type: "minecraft:spider", count: 5, equipment: null, nameTag: null }
    ],
    totalMobCount: 5
  },
  {
    id: "venomous_outcrop",
    name: "Venomous Outcrop",
    description: "Cave spiders have spilled out from underground. Their bite burns.",
    tier: "rare",
    mobs: [
      { type: "minecraft:cave_spider", count: 4, equipment: null, nameTag: null }
    ],
    totalMobCount: 4
  },

  // --- LEGENDARY ---
  {
    id: "broodmother_children",
    name: "The Broodmother's Children",
    description: "A massive nest has hatched. The broodmother watches from the center.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:spider", count: 6, equipment: null, nameTag: null },
      { type: "minecraft:cave_spider", count: 4, equipment: null, nameTag: null },
      { type: "minecraft:spider", count: 1, equipment: null, nameTag: "The Broodmother" }
    ],
    totalMobCount: 11
  },

  // --- MYTHIC ---
  {
    id: "arachnid_apocalypse",
    name: "Arachnid Apocalypse",
    description: "The spider queens have united. Nowhere is safe from their crawling legions.",
    tier: "mythic",
    mobs: [
      { type: "minecraft:spider", count: 8, equipment: null, nameTag: null },
      { type: "minecraft:cave_spider", count: 6, equipment: null, nameTag: null },
      { type: "minecraft:spider", count: 2, equipment: null, nameTag: "Silk Matriarch" },
      { type: "minecraft:cave_spider", count: 1, equipment: null, nameTag: "The Venom Queen" }
    ],
    totalMobCount: 17
  },

  // ============================================================================
  // THEME 3: ILLAGER THREAT (6 encounters)
  // The outcast villagers strike back.
  // ============================================================================

  // --- RARE ---
  {
    id: "pillager_scouts",
    name: "Pillager Scouts",
    description: "A pillager scouting party probes our defenses.",
    tier: "rare",
    mobs: [
      { type: "minecraft:pillager", count: 4, equipment: null, nameTag: null }
    ],
    totalMobCount: 4
  },
  {
    id: "outcast_war_party",
    name: "Outcast War Party",
    description: "Vindicators sharpen their axes. They've come for blood.",
    tier: "rare",
    mobs: [
      { type: "minecraft:vindicator", count: 3, equipment: null, nameTag: null }
    ],
    totalMobCount: 3
  },

  // --- LEGENDARY ---
  {
    id: "raiding_party",
    name: "Raiding Party",
    description: "A full illager raiding party approaches. Archers and axemen work as one.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:pillager", count: 5, equipment: null, nameTag: null },
      { type: "minecraft:vindicator", count: 3, equipment: null, nameTag: null },
      { type: "minecraft:pillager", count: 1, equipment: null, nameTag: "Raid Captain" }
    ],
    totalMobCount: 9
  },
  {
    id: "dark_ritual",
    name: "Dark Ritual",
    description: "An evoker conducts a forbidden ceremony. Vexes swirl in anticipation.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:evoker", count: 1, equipment: null, nameTag: "The Ritualist" },
      { type: "minecraft:vex", count: 4, equipment: null, nameTag: null },
      { type: "minecraft:vindicator", count: 3, equipment: null, nameTag: "Ritual Guardian" }
    ],
    // Note: Vex excluded from count (4 vex not counted) - they despawn naturally
    totalMobCount: 4
  },

  // --- MYTHIC ---
  {
    id: "gray_horde",
    name: "The Gray Horde",
    description: "The illager clans have united under one banner. This is war.",
    tier: "mythic",
    mobs: [
      { type: "minecraft:pillager", count: 6, equipment: null, nameTag: null },
      { type: "minecraft:vindicator", count: 4, equipment: null, nameTag: null },
      { type: "minecraft:evoker", count: 2, equipment: null, nameTag: "Horde Warlock" },
      { type: "minecraft:ravager", count: 1, equipment: null, nameTag: "Siege Beast" },
      { type: "minecraft:pillager", count: 1, equipment: null, nameTag: "Warlord Grim" }
    ],
    totalMobCount: 14
  },
  {
    id: "mansion_breakout",
    name: "Mansion Breakout",
    description: "The woodland mansion's elite guard has mobilized. Evokers lead the charge.",
    tier: "mythic",
    mobs: [
      { type: "minecraft:vindicator", count: 6, equipment: null, nameTag: null },
      { type: "minecraft:evoker", count: 3, equipment: null, nameTag: null },
      { type: "minecraft:vex", count: 6, equipment: null, nameTag: null },
      { type: "minecraft:evoker", count: 1, equipment: null, nameTag: "The Arch-Evoker" }
    ],
    // Note: Vex excluded from count (6 vex not counted) - they despawn naturally
    totalMobCount: 10
  },

  // ============================================================================
  // THEME 4: NETHER BREACH (5 encounters)
  // The barrier between dimensions weakens.
  // ============================================================================

  // --- RARE ---
  {
    id: "piglin_trespassers",
    name: "Piglin Trespassers",
    description: "Piglins have crossed over, seeking gold. They found you instead.",
    tier: "rare",
    mobs: [
      { type: "minecraft:piglin", count: 4, equipment: null, nameTag: null }
    ],
    totalMobCount: 4
  },
  {
    id: "magma_flow",
    name: "Magma Flow",
    description: "Magma cubes bubble up from a dimensional rift.",
    tier: "rare",
    mobs: [
      { type: "minecraft:magma_cube", count: 5, equipment: null, nameTag: null }
    ],
    totalMobCount: 5
  },

  // --- LEGENDARY ---
  {
    id: "blaze_patrol",
    name: "Blaze Patrol",
    description: "Blazes drift through a tear in reality, scorching everything nearby.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:blaze", count: 5, equipment: null, nameTag: null },
      { type: "minecraft:blaze", count: 1, equipment: null, nameTag: "Inferno Sentinel" }
    ],
    totalMobCount: 6
  },
  {
    id: "bastion_vanguard",
    name: "Bastion Vanguard",
    description: "The bastion's warriors have arrived. Brutes lead the charge.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:piglin", count: 5, equipment: null, nameTag: null },
      { type: "minecraft:piglin_brute", count: 2, equipment: null, nameTag: null },
      { type: "minecraft:hoglin", count: 2, equipment: null, nameTag: null }
    ],
    totalMobCount: 9
  },

  // --- MYTHIC ---
  {
    id: "hells_army",
    name: "Hell's Army",
    description: "The Nether lords marshal their forces. Fire rains from the sky.",
    tier: "mythic",
    mobs: [
      { type: "minecraft:blaze", count: 4, equipment: null, nameTag: null },
      { type: "minecraft:piglin_brute", count: 4, equipment: null, nameTag: "Nether Guard" },
      { type: "minecraft:hoglin", count: 3, equipment: null, nameTag: null },
      { type: "minecraft:magma_cube", count: 4, equipment: null, nameTag: null },
      { type: "minecraft:blaze", count: 1, equipment: null, nameTag: "Infernal Commander" }
    ],
    totalMobCount: 16
  },

  // ============================================================================
  // THEME 5: ABOMINATIONS (5 encounters)
  // Unnatural creatures and cursed beings.
  // ============================================================================

  // --- RARE ---
  {
    id: "creeping_dread",
    name: "Creeping Dread",
    description: "That hissing sound? It's not just one of them.",
    tier: "rare",
    mobs: [
      { type: "minecraft:creeper", count: 4, equipment: null, nameTag: null }
    ],
    totalMobCount: 4
  },
  {
    id: "slime_surge",
    name: "Slime Surge",
    description: "A mass of slimes bounces toward you with unsettling purpose.",
    tier: "rare",
    mobs: [
      { type: "minecraft:slime", count: 6, equipment: null, nameTag: null }
    ],
    totalMobCount: 6
  },

  // --- LEGENDARY ---
  {
    id: "witchs_bargain",
    name: "Witch's Bargain",
    description: "A coven gathers to trade in curses. Their victims shamble nearby.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:witch", count: 3, equipment: null, nameTag: null },
      { type: "minecraft:zombie_villager", count: 4, equipment: null, nameTag: "Cursed Soul" },
      { type: "minecraft:witch", count: 1, equipment: null, nameTag: "Coven Mother" }
    ],
    totalMobCount: 8
  },
  {
    id: "nightmare_flock",
    name: "Nightmare Flock",
    description: "The sleepless nights have manifested. Phantoms blot out the stars.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:phantom", count: 7, equipment: null, nameTag: null },
      { type: "minecraft:phantom", count: 1, equipment: null, nameTag: "The Sleepless One" }
    ],
    totalMobCount: 8
  },

  // --- MYTHIC ---
  {
    id: "wither_cult",
    name: "The Wither Cult",
    description: "Fanatics of decay gather wither skeletons for a dark summoning. Stop them before it's too late.",
    tier: "mythic",
    mobs: [
      { type: "minecraft:wither_skeleton", count: 5, equipment: null, nameTag: null },
      { type: "minecraft:witch", count: 3, equipment: null, nameTag: "Cult Alchemist" },
      { type: "minecraft:zombie_villager", count: 4, equipment: null, nameTag: "Cult Thrall" },
      { type: "minecraft:wither_skeleton", count: 1, equipment: null, nameTag: "Herald of Withering" }
    ],
    totalMobCount: 13
  }
];

/**
 * Get all encounters for a specific tier
 *
 * @param {string} tier - "rare", "legendary", or "mythic"
 * @returns {Array} Array of encounter definitions matching the tier
 *
 * @example
 * const rareEncounters = getEncountersByTier("rare");
 * // Returns 10 rare encounters
 */
export function getEncountersByTier(tier) {
  return ENCOUNTER_TABLE.filter(encounter => encounter.tier === tier);
}

/**
 * Get a specific encounter by ID (for debugging/testing)
 *
 * @param {string} id - Encounter ID (e.g., "bone_collectors")
 * @returns {Object|undefined} Encounter definition or undefined if not found
 *
 * @example
 * const encounter = getEncounterById("bone_sovereign");
 * if (encounter) {
 *   console.log(encounter.name);  // "The Bone Sovereign"
 * }
 */
export function getEncounterById(id) {
  return ENCOUNTER_TABLE.find(encounter => encounter.id === id);
}
