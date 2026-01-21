/**
 * ============================================================================
 * QUEST GENERATOR — Random Quest Creation
 * ============================================================================
 * 
 * AI AGENT ORIENTATION:
 * ---------------------
 * This is a STATELESS utility class that generates random quest objects.
 * It does NOT track state — that's PersistenceManager's job.
 * 
 * USAGE:
 *   const quests = QuestGenerator.generateDailyQuests(3);
 * 
 * QUEST OBJECT STRUCTURE (returned by all generate methods):
 * {
 *   id: string,           // Unique ID with timestamp (e.g., "kill_zombie_1705093200000_123")
 *   title: string,        // Display name (e.g., "Kill 10 Zombies")
 *   description: string,  // Lore text from LORE_TEMPLATES
 *   type: "kill"|"mine"|"gather",
 *   category: string,     // For icon lookup (e.g., "undead", "mining")
 *   rarity: "common"|"rare"|"legendary",
 *   requiredCount: number,
 *   targetMobId?: string,      // For kill quests (e.g., "minecraft:zombie")
 *   targets?: string[],        // For kill quests (mob IDs)
 *   targetBlockIds?: string[], // For mine quests
 *   targetItemIds?: string[],  // For gather quests
 *   reward: {
 *     scoreboardIncrement: number, // SP to award
 *     rewardItems: [{ typeId: string, amount: number }]
 *   }
 * }
 * 
 * RARITY DISTRIBUTION:
 * - Common: 60% (multiplier: 1x)
 * - Rare: 30% (multiplier: 2x)
 * - Legendary: 10% (multiplier: 5x)
 * 
 * DATA SOURCE: ../data/QuestData.js (MOB_POOL, ITEM_POOL, LORE_TEMPLATES)
 * 
 * ============================================================================
 */

import { MOB_POOL, ITEM_POOL, LORE_TEMPLATES } from "../data/QuestData.js";
import { rollRarity, calculateBaseQuestReward } from "./RewardCalculator.js";
// === PHASE 1: ENCOUNTER SYSTEM INTEGRATION ===
// Import encounter quest generator for rare/legendary quests
import { generateEncounterQuest } from "./EncounterManager.js";

export class QuestGenerator {
  static generateDailyQuests(count = 3) {
    const quests = [];
    const usedTargets = new Set();

    for (let i = 0; i < count; i++) {
      let quest;
      let targetId = null;
      let attempts = 0;

      do {
        quest = this.generateQuest();
        // Identify the core target of this quest to prevent duplicates
        // For kill quests: targetMobId
        // For gather/mine quests: targetItemIds (use the first one)
        targetId = quest.targetMobId || (quest.targetItemIds && quest.targetItemIds.length > 0 ? quest.targetItemIds[0] : null);

        attempts++;
      } while (targetId && usedTargets.has(targetId) && attempts < 10);

      if (targetId) {
        usedTargets.add(targetId);
      }
      quests.push(quest);
    }
    return quests;
  }

  static generateQuest() {
    // 50/50 chance of Kill vs Gather/Mine
    const isKill = Math.random() < 0.5;
    let quest;

    if (isKill) {
      quest = this.generateKillQuest();
    } else {
      quest = this.generateGatherQuest();
    }

    // Roll rarity using weighted system from EconomyConfig
    const rarity = rollRarity();

    // ========================================================================
    // PHASE 1: ENCOUNTER SYSTEM INTEGRATION
    // ========================================================================
    // Route Rare and Legendary quests to the encounter system instead of
    // using standard kill/gather quests. This replaces random mob quests
    // with curated encounter groups that spawn at ring-based distances.
    //
    // IMPACT:
    // - Rare (22% chance): Now generates encounters instead of kill quests
    // - Legendary (7% chance): Now generates encounters instead of kill quests
    // - Mythic (1% chance): Now generates encounters instead of kill quests
    // - Common (70%): UNCHANGED, bypass this block entirely
    //
    // FALLBACK BEHAVIOR:
    // If encounter generation fails (shouldn't happen with valid data),
    // the code falls through to standard quest generation as a safety net.
    //
    // PHASE PROGRESSION:
    // - Phase 1 (CURRENT): Quest generation only, no spawning
    // - Phase 2+: Mob spawning, persistence, ring distances (future)
    // ========================================================================
    if (rarity === "rare" || rarity === "legendary" || rarity === "mythic") {
      const encounterQuest = generateEncounterQuest(rarity);

      if (encounterQuest) {
        // Encounter quest successfully generated - return it immediately
        // This quest has all standard fields + encounter-specific fields
        return encounterQuest;
      }

      // Fallback: If encounter generation failed, log warning and continue
      // to standard quest generation below as a safety net
      console.warn(`[QuestGenerator] Encounter generation failed for ${rarity}, falling back to standard quest`);
    }
    // === END ENCOUNTER SYSTEM INTEGRATION ===

    // Continue with original logic for Common/Mythic or fallback
    quest.rarity = rarity;

    // Calculate SP reward using new economy system
    const rewardCalc = calculateBaseQuestReward(
      rarity,
      quest.type,
      quest.requiredCount
    );
    quest.reward.scoreboardIncrement = rewardCalc.total;

    // Item rewards still use old multiplier system for now
    // Map rarity to multiplier for item rewards
    const rarityToMultiplier = {
      "common": 1,
      "rare": 2,
      "legendary": 5,
      "mythic": 10  // New mythic tier gets highest item rewards
    };
    const itemMultiplier = rarityToMultiplier[rarity] || 1;

    if (quest.reward && quest.reward.rewardItems) {
      quest.reward.rewardItems.forEach(item => {
        item.amount = Math.ceil(item.amount * itemMultiplier);
      });
    }

    return quest;
  }

  static generateKillQuest() {
    const target = MOB_POOL[Math.floor(Math.random() * MOB_POOL.length)];
    const variance = Math.floor(Math.random() * 5); // 0-4 extra
    const count = target.baseCount + variance;

    const loreList = LORE_TEMPLATES[target.category] || LORE_TEMPLATES["monster"];
    const lore = loreList[Math.floor(Math.random() * loreList.length)];

    // Reward: 1 Diamond per 10 mobs (rounded up), +1 Score
    const diamondCount = Math.ceil(count / 10);

    return {
      id: `kill_${target.id.split(":")[1]}_${Date.now()}_${Math.floor(Math.random() * 1000)}`, // Unique ID
      title: `Kill ${count} ${target.name}s`,
      description: lore,
      type: "kill",
      category: target.category, // For icon system lookup
      requiredCount: count,
      targets: [target.id.replace("minecraft:", "")], // Store as Array for JSON persistence
      // Note: mobTypes.js might expect simple IDs (e.g. "zombie") or full IDs. 
      // Main.js usually checks `getMobType` result. Let's ensure compatibility.
      // Current main.js uses `targets: new Set(["zombie"])`.

      // We'll store the raw typeId here, main.js might need adaptation if it expects "zombie" vs "minecraft:zombie"
      targetMobId: target.id,

      reward: {
        scoreboardIncrement: 1,
        rewardItems: [
          { typeId: "minecraft:diamond", amount: diamondCount }
        ]
      }
    };
  }

  static generateGatherQuest() {
    const target = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
    const variance = Math.floor(Math.random() * 10);
    const count = target.baseCount + variance;

    const loreList = LORE_TEMPLATES[target.category] || LORE_TEMPLATES["gathering"];
    const lore = loreList[Math.floor(Math.random() * loreList.length)];

    // Reward: 1 Iron Ingot per 16 items (rounded up), +1 Score
    const ironCount = Math.ceil(count / 16);

    const quest = {
      id: `${target.type}_${target.id.split(":")[1]}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: `${target.type === "mine" ? "Mine" : "Gather"} ${count} ${target.name}`,
      description: lore,
      type: target.type, // "mine" or "gather"
      category: target.category, // For icon system lookup
      requiredCount: count,
      reward: {
        scoreboardIncrement: 1,
        rewardItems: [
          { typeId: "minecraft:iron_ingot", amount: ironCount }
        ]
      }
    };

    if (target.type === "mine") {
      quest.targetBlockIds = target.blockIds || [target.id];
    } else {
      // gather
      quest.targetItemIds = [target.id]; // Logic support arrays
    }

    return quest;
  }
}
