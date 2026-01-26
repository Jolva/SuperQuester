/**
 * ============================================================================
 * ENCOUNTER MANAGER — Encounter-Based Quest Generation
 * ============================================================================
 *
 * AI AGENT ORIENTATION:
 * ---------------------
 * This module generates encounter-based quests for Rare and Legendary tiers.
 * It is called by QuestGenerator when a rare/legendary rarity is rolled.
 *
 * CRITICAL CONTEXT - SYSTEM INTEGRATION:
 * - This is part of the Encounter System (Phase 1 of 5)
 * - Phase 1: Data structures only (THIS FILE) - no mob spawning yet
 * - Phase 2-5: Mob spawning, persistence, ring-based locations (future)
 * - Common/Mythic quests are UNCHANGED - they bypass this entirely
 *
 * QUEST GENERATION FLOW:
 * 1. QuestGenerator.generateQuest() rolls rarity
 * 2. If rare/legendary → calls generateEncounterQuest(tier)
 * 3. This function selects random encounter from EncounterTable
 * 4. Calculates rewards using RewardCalculator (same as standard quests)
 * 5. Returns complete quest object ready for player's available slots
 *
 * REWARD CALCULATION (Self-Contained):
 * - SP reward: Uses calculateBaseQuestReward(tier, "kill", mobCount)
 * - Item reward: Diamond scaling (1 per 10 mobs) × rarity multiplier
 * - Matches existing quest reward patterns for consistency
 *
 * QUEST OBJECT SCHEMA:
 * Encounter quests have TWO sets of fields:
 * 1. STANDARD FIELDS: Same as normal quests (for UI/persistence compatibility)
 *    - id, title, description, type, category, rarity, requiredCount, targets, reward
 * 2. ENCOUNTER FIELDS: New fields specific to encounters
 *    - isEncounter (flag), encounterId, encounterName, encounterMobs, totalMobCount
 * 3. SPAWN DATA: Null in Phase 1, populated in Phase 2 when quest is accepted
 *
 * PHASE PROGRESSION (for future AI agents):
 * - Phase 1 (CURRENT): Quest generation only, no spawning
 * - Phase 2: Basic mob spawning at test location (30 blocks from board)
 * - Phase 3: Ring-based spawning with terrain validation
 * - Phase 4: Logout/login persistence (despawn/respawn mechanics)
 * - Phase 5: Abandon flow and orphan cleanup
 *
 * MODIFICATION GUIDELINES:
 * - DO NOT modify reward calculation without updating documentation
 * - Keep quest schema compatible with existing UI (main.js quest board)
 * - Use structuredClone() when copying encounter mobs (prevent mutation)
 * - Maintain fallback behavior (return null if encounter selection fails)
 *
 * DEPENDENCIES:
 * - EncounterTable.js: Source of encounter definitions
 * - RewardCalculator.js: SP reward computation
 * - Called by: QuestGenerator.js (rare/legendary routing)
 * - Used by: main.js (quest acceptance, tracking, completion)
 *
 * ============================================================================
 */

import { ENCOUNTER_TABLE, getEncountersByTier } from "../data/EncounterTable.js";
import { calculateBaseQuestReward } from "./RewardCalculator.js";

/**
 * Generate a unique quest ID for encounter quests
 * Format: "enc_<timestamp>_<random>"
 *
 * @returns {string} Unique identifier
 *
 * @example
 * generateUniqueId() // "enc_1705093200000_k3j8a9c"
 */
function generateUniqueId() {
  return `enc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Select a random encounter from the available pool for a tier
 *
 * @param {string} tier - "rare" or "legendary"
 * @returns {Object|null} Encounter definition from EncounterTable, or null if none found
 *
 * @example
 * const encounter = selectRandomEncounter("rare");
 * // Returns one of: skeleton_warband, zombie_pack, spider_nest, creeper_cluster
 */
export function selectRandomEncounter(tier) {
  const available = getEncountersByTier(tier);

  if (available.length === 0) {
    console.error(`[EncounterManager] No encounters found for tier: ${tier}`);
    return null;
  }

  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Generate a complete encounter-based quest object
 *
 * IMPORTANT: This function is SELF-CONTAINED for reward calculation.
 * It does NOT require external reward/item parameters - it calculates everything internally.
 *
 * WORKFLOW:
 * 1. Select random encounter from EncounterTable based on tier
 * 2. Calculate SP reward using RewardCalculator (based on mob count)
 * 3. Calculate item rewards using rarity multiplier (matches QuestGenerator pattern)
 * 4. Build quest object with both standard and encounter-specific fields
 * 5. Return ready-to-use quest for player's available slots
 *
 * SPAWN DATA:
 * - Set to null in Phase 1 (no spawning yet)
 * - Will be populated in Phase 2 when quest is accepted:
 *   {
 *     location: { x, y, z },           // Where mobs spawned
 *     spawnedEntityIds: string[],      // Track entity IDs for despawn
 *     dimensionId: "overworld"         // Dimension ID
 *   }
 *
 * @param {string} tier - "rare" or "legendary"
 * @returns {Object|null} Complete quest object, or null if encounter selection fails
 *
 * @example
 * const quest = generateEncounterQuest("rare");
 * // Returns quest with:
 * // - isEncounter: true
 * // - encounterMobs: [{ type: "minecraft:skeleton", count: 5, ... }]
 * // - reward: { scoreboardIncrement: ~50, rewardItems: [...] }
 */
export function generateEncounterQuest(tier) {
  // Step 1: Select random encounter
  const encounter = selectRandomEncounter(tier);

  if (!encounter) {
    console.error(`[EncounterManager] Failed to select encounter for tier: ${tier}`);
    return null;
  }

  // Step 2: Calculate SP reward using existing reward calculator
  // Encounters are treated as "kill" type quests for reward purposes
  const rewardCalc = calculateBaseQuestReward(tier, "kill", encounter.totalMobCount);

  // Step 3: Calculate item rewards using existing multiplier pattern
  // This matches QuestGenerator.js lines 99-111 (rarity-based item scaling)
  const rarityToMultiplier = {
    "common": 1,
    "rare": 2,
    "legendary": 5,
    "mythic": 10
  };
  const itemMultiplier = rarityToMultiplier[tier] || 1;

  // Base diamond reward scales with mob count (1 diamond per 10 mobs, same as kill quests)
  const baseDiamonds = Math.ceil(encounter.totalMobCount / 10);
  const rewardItems = [{
    typeId: "minecraft:diamond",
    amount: Math.max(1, Math.ceil(baseDiamonds * itemMultiplier))  // At least 1 diamond
  }];

  // Step 4: Build complete quest object
  return {
    // ========================================================================
    // STANDARD QUEST FIELDS (required for UI and persistence compatibility)
    // These fields match the schema used by kill/mine/gather quests
    // ========================================================================
    id: generateUniqueId(),
    title: encounter.name,                    // Display on quest board
    description: encounter.description,       // Flavor text
    type: "encounter",                        // NEW type (distinct from "kill", "mine", "gather")
    category: "combat",                       // For icon system (consistent across encounters)
    rarity: tier,                             // "rare" or "legendary"
    requiredCount: encounter.totalMobCount,   // How many mobs to kill (for progress bar)

    // Targets array: Mob type IDs for UI display
    // IMPORTANT: Strip "minecraft:" prefix for compatibility with main.js UI
    targets: encounter.mobs.map(m => m.type.replace("minecraft:", "")),

    reward: {
      scoreboardIncrement: rewardCalc.total,  // SP value (before completion bonuses)
      rewardItems: rewardItems                // Physical rewards
    },

    // ========================================================================
    // ENCOUNTER-SPECIFIC FIELDS (new in Phase 1)
    // These fields are used by the encounter system for spawning and tracking
    // ========================================================================
    isEncounter: true,                        // Flag for conditional logic in main.js
    encounterId: encounter.id,                // Reference back to ENCOUNTER_TABLE
    encounterName: encounter.name,            // Duplicate of title (for clarity)

    // encounterMobs: Full mob composition with spawn details
    // CRITICAL: Deep copy to prevent mutation of ENCOUNTER_TABLE
    // Note: structuredClone() not available in Minecraft JS, use JSON parse/stringify
    encounterMobs: JSON.parse(JSON.stringify(encounter.mobs)),

    totalMobCount: encounter.totalMobCount,   // Total mobs to spawn/track

    // ========================================================================
    // SPAWN DATA (populated in Phase 2 when quest is accepted)
    // Null for now - Phase 2 will set this when player accepts the quest
    // ========================================================================
    spawnData: null
    // Future structure:
    // {
    //   location: { x: number, y: number, z: number },
    //   spawnedEntityIds: string[],
    //   dimensionId: string
    // }
  };
}
