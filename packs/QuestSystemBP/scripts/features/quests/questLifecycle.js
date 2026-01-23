/**
 * questLifecycle.js
 * Quest lifecycle management - accept, abandon, turn-in, and refresh.
 * 
 * Handles:
 * - Quest acceptance from available pool
 * - Quest abandonment (returning to available pool)
 * - Quest turn-in validation and rewards
 * - Quest refresh/reroll (free and paid)
 * - Encounter system integration (zone assignment, mob spawning/despawning)
 */

import { world, system, ItemStack } from "@minecraft/server";

// =============================================================================
// REFRESH/REROLL SYSTEM
// =============================================================================

/**
 * Calculates the SP cost for a paid reroll based on how many have been used.
 * First N rerolls are flat price, then exponential.
 * 
 * @param {number} paidRerollsThisCycle - Number of paid rerolls used since last free refresh
 * @param {Object} COSTS - Economy config (rerollBase, rerollFreeCount, rerollExponent)
 * @returns {number} SP cost for the next reroll
 */
export function calculateRerollPrice(paidRerollsThisCycle, COSTS) {
  // First N rerolls cost base price
  if (paidRerollsThisCycle < COSTS.rerollFreeCount) {
    return COSTS.rerollBase;
  }

  // Subsequent rerolls use exponential pricing
  // Example with config (100, 2, 2): 100, 100, 200, 400, 800...
  return COSTS.rerollBase * Math.pow(COSTS.rerollExponent, paidRerollsThisCycle - COSTS.rerollFreeCount);
}

/**
 * Handles quest refresh/reroll button click.
 * Supports both free rerolls (earned from completing all 3 quests) and paid rerolls.
 * 
 * @param {import("@minecraft/server").Player} player
 * @param {Object} deps - Dependencies object containing:
 *   - ensureQuestData: Function to get player quest data
 *   - QuestGenerator: Quest generation system
 *   - PersistenceManager: Data persistence system
 *   - purchase: SP purchase function
 *   - COSTS: Economy config
 * @returns {boolean} Success
 */
export function handleRefresh(player, deps) {
  const { ensureQuestData, QuestGenerator, PersistenceManager, purchase, COSTS } = deps;
  const data = ensureQuestData(player);

  // CASE 1: Free reroll available
  if (data.freeRerollAvailable) {
    data.freeRerollAvailable = false;
    data.available = QuestGenerator.generateDailyQuests(3);
    data.active = null;
    data.progress = 0;
    data.lastRefreshTime = Date.now();
    data.paidRerollsThisCycle = 0;  // Reset pricing on free use
    PersistenceManager.saveQuestData(player, data);

    player.sendMessage("§a✓ Used free reroll! Complete all 3 quests to earn another.§r");
    player.playSound("quest.reroll", { volume: 0.9, pitch: 1.0 });
    return true;
  }

  // CASE 2: Paid reroll
  const price = calculateRerollPrice(data.paidRerollsThisCycle, COSTS);

  // Attempt purchase using SPManager
  const purchaseResult = purchase(player, price);

  if (!purchaseResult.success) {
    player.sendMessage(purchaseResult.message);
    player.playSound("note.bass", { pitch: 0.5 });
    return false;
  }

  data.paidRerollsThisCycle += 1;
  data.available = QuestGenerator.generateDailyQuests(3);
  data.active = null;
  data.progress = 0;
  data.lastRefreshTime = Date.now();
  PersistenceManager.saveQuestData(player, data);

  const nextPrice = calculateRerollPrice(data.paidRerollsThisCycle, COSTS);
  player.sendMessage(`§a✓ Rerolled for ${price} SP! Next reroll: ${nextPrice} SP§r`);
  player.playSound("quest.reroll", { volume: 0.9, pitch: 1.0 });

  return true;
}

// =============================================================================
// QUEST ACCEPTANCE
// =============================================================================

/**
 * Accepts a quest from the available pool and makes it active.
 * Handles validation, encounter zone assignment, and HUD initialization.
 * 
 * @param {import("@minecraft/server").Player} player
 * @param {number} questIndex - Index in available array (0, 1, or 2)
 * @param {Object} deps - Dependencies object containing:
 *   - ensureQuestData: Function
 *   - PersistenceManager: System
 *   - selectEncounterZone: Function (for encounter quests)
 *   - getQuestBoardPosition: Function
 *   - calculateDistance: Function
 *   - getDirection: Function
 *   - updateQuestHud: Function
 * @returns {{ ok: boolean, reason?: string, quest?: any }}
 */
export function handleQuestAccept(player, questIndex, deps) {
  const {
    ensureQuestData,
    PersistenceManager,
    selectEncounterZone,
    getQuestBoardPosition,
    calculateDistance,
    getDirection,
    updateQuestHud
  } = deps;
  
  const data = ensureQuestData(player);

  // Validate: already have active quest?
  if (data.active !== null) {
    return { ok: false, reason: "§cYou already have an active quest! Complete or abandon it first.§r" };
  }

  // Validate: index in bounds?
  if (questIndex < 0 || questIndex >= data.available.length) {
    return { ok: false, reason: "§cInvalid quest selection.§r" };
  }

  // Validate: slot not empty?
  const quest = data.available[questIndex];
  if (quest === null) {
    return { ok: false, reason: "§cThat quest slot is empty.§r" };
  }

  // Accept the quest
  data.active = { ...quest };  // Copy to active
  data.progress = 0;
  data.available[questIndex] = null;  // Mark slot as taken

  // ========================================================================
  // PHASE 3: ENCOUNTER SYSTEM - Zone Assignment on Quest Accept
  // ========================================================================
  // If this is an encounter quest (rare/legendary), assign a zone center
  // but DO NOT spawn mobs yet. Spawning happens when player enters the zone.
  //
  // TWO-STAGE SPAWN FLOW:
  // 1. Quest Accept (here): Assign zone center (no terrain validation needed)
  // 2. Player Arrival: EncounterProximity.js detects zone entry, spawns mobs
  //
  // This solves LocationInUnloadedChunkError - chunks ARE loaded when player
  // is near the zone, so terrain validation works.
  //
  // STATE MACHINE:
  // - encounterState: "pending" -> "spawned" -> "complete"
  // - spawnData: null until mobs actually spawn
  // ========================================================================
  if (data.active.isEncounter) {
    // Assign encounter zone (random point in tier ring)
    const zone = selectEncounterZone(data.active.rarity);
    data.active.encounterZone = zone;
    data.active.encounterState = "pending";
    data.active.spawnData = null;

    // Calculate distance and direction for player notification
    const boardPos = getQuestBoardPosition();
    const distance = calculateDistance(boardPos, zone.center);
    const direction = getDirection(boardPos, zone.center);

    // Notify player about zone location
    player.sendMessage(`§e${data.active.encounterName} §fawaits §c~${distance} blocks §fto the §e${direction}§f.`);
    player.sendMessage(`§7Travel to the area to begin the encounter.`);
    player.sendMessage(`§7Zone center: ${zone.center.x}, ${zone.center.z}`);
  }
  // === END ENCOUNTER SPAWNING ===

  // Save quest data (includes spawnData if encounter)
  PersistenceManager.saveQuestData(player, data);

  // Start HUD if applicable
  if (quest.type === "kill" || quest.type === "mine" || quest.type === "encounter") {
    updateQuestHud(player, { ...data.active, progress: 0, goal: quest.requiredCount, status: "active" });
  }

  return { ok: true, quest: quest };
}

// =============================================================================
// QUEST ABANDONMENT
// =============================================================================

/**
 * Abandons the active quest and returns it to the available pool.
 * Handles encounter mob despawning if applicable.
 * 
 * @param {import("@minecraft/server").Player} player
 * @param {Object} deps - Dependencies object containing:
 *   - ensureQuestData: Function
 *   - PersistenceManager: System
 *   - despawnEncounterMobs: Function (for encounter quests)
 * @returns {any|null} The abandoned quest, or null if none active
 */
export function handleQuestAbandon(player, deps) {
  const { ensureQuestData, PersistenceManager, despawnEncounterMobs } = deps;
  const data = ensureQuestData(player);

  if (!data.active) {
    player.sendMessage("§cNo active quest to abandon.§r");
    return null;
  }

  const quest = data.active;

  // ========================================================================
  // PHASE 3: ENCOUNTER SYSTEM - Handle Abandon for Both States
  // ========================================================================
  // If this is an encounter quest, handle based on encounterState:
  // - "pending": No mobs spawned yet, just reset state
  // - "spawned": Mobs in world, need to despawn them
  //
  // WORKFLOW:
  // 1. Check if quest is encounter type
  // 2. If spawned with spawnData, despawn all mobs
  // 3. Reset encounterState to "pending" for re-accept
  // 4. Clear spawnData (zone stays the same if re-accepted)
  // ========================================================================
  if (quest.isEncounter) {
    // Only despawn if mobs were actually spawned
    if (quest.encounterState === "spawned" && quest.spawnData) {
      const dimension = world.getDimension(quest.spawnData.dimensionId || "overworld");
      const despawnedCount = despawnEncounterMobs(quest.id, dimension);
      console.log(`[Encounter] Abandoned quest ${quest.id}, despawned ${despawnedCount} mobs`);
    }

    // Reset encounter state for re-accept
    quest.encounterState = "pending";
    quest.spawnData = null;
    // Note: encounterZone stays the same if re-accepted from board
  }
  // === END ENCOUNTER DESPAWN ===

  // Find an empty slot to return it to (or first slot if somehow all full)
  const emptyIndex = data.available.findIndex(slot => slot === null);
  if (emptyIndex !== -1) {
    data.available[emptyIndex] = quest;
  } else {
    // Edge case: No empty slots (shouldn't happen if accept logic is correct, but safe fallback: put in slot 0)
    data.available[0] = quest;
  }

  data.active = null;
  data.progress = 0;
  PersistenceManager.saveQuestData(player, data);

  player.onScreenDisplay?.setActionBar?.("");

  // Play abandon sound
  player.playSound("quest.abandon", { volume: 0.8, pitch: 1.0 });

  return quest;
}

// =============================================================================
// QUEST TURN-IN
// =============================================================================

/**
 * Handles quest turn-in validation, reward calculation, and completion.
 * Validates completion requirements, awards rewards, triggers celebrations,
 * and handles full quest clear bonus.
 * 
 * @param {import("@minecraft/server").Player} player
 * @param {Object} deps - Massive dependencies object (see function body for full list)
 * @returns {void}
 */
export function handleQuestTurnIn(player, deps) {
  const {
    ensureQuestData,
    PersistenceManager,
    QuestGenerator,
    despawnEncounterMobs,
    calculateCompletionReward,
    hasCompletedQuestToday,
    addSP,
    celebrateQuestComplete,
    incrementStreak,
    markDailyCompletion,
    getQuestColors,
    triggerQuestClearCelebration
  } = deps;

  const data = ensureQuestData(player);

  if (!data.active) {
    player.sendMessage("§cNo active quest to turn in.§r");
    return;
  }

  const quest = data.active;

  // === VALIDATE COMPLETION ===

  if (quest.type === "gather" && quest.targetItemIds) {
    const inventory = player.getComponent("inventory")?.container;
    if (!inventory) return;

    // Count items
    let totalCount = 0;
    for (let i = 0; i < inventory.size; i++) {
      const item = inventory.getItem(i);
      if (item && quest.targetItemIds.includes(item.typeId)) {
        totalCount += item.amount;
      }
    }

    if (totalCount < quest.requiredCount) {
      player.sendMessage(`§cNeed ${quest.requiredCount - totalCount} more items!§r`);
      return;
    }

    // Consume items
    let remainingToRemove = quest.requiredCount;
    for (let i = 0; i < inventory.size; i++) {
      if (remainingToRemove <= 0) break;
      const item = inventory.getItem(i);
      if (item && quest.targetItemIds.includes(item.typeId)) {
        if (item.amount <= remainingToRemove) {
          remainingToRemove -= item.amount;
          inventory.setItem(i, undefined);
        } else {
          item.amount -= remainingToRemove;
          remainingToRemove = 0;
          inventory.setItem(i, item);
        }
      }
    }
  } else if (quest.type === "kill" || quest.type === "mine" || quest.type === "encounter") {
    // Phase 3: For encounters, check encounterState instead of just progress
    if (quest.isEncounter) {
      if (quest.encounterState !== "complete") {
        if (quest.encounterState === "pending") {
          player.sendMessage(`§cYou haven't found the encounter yet. Travel to the zone.`);
        } else {
          player.sendMessage(`§cProgress: ${data.progress}/${quest.requiredCount}§r`);
        }
        return;
      }
    } else if (data.progress < quest.requiredCount) {
      player.sendMessage(`§cProgress: ${data.progress}/${quest.requiredCount}§r`);
      return;
    }
  }

  // ========================================================================
  // PHASE 2: ENCOUNTER SYSTEM - Despawn Remaining Mobs on Turn-In
  // ========================================================================
  // If this is an encounter quest, despawn any remaining mobs before
  // awarding rewards. This prevents orphaned mobs from staying in the world.
  //
  // WORKFLOW:
  // 1. Check if quest is encounter type
  // 2. Check if spawnData exists (quest was accepted and mobs spawned)
  // 3. Get dimension from spawn data
  // 4. Call despawnEncounterMobs() to remove all tagged mobs
  //
  // NOTE: Most mobs should already be dead (progress == totalMobCount),
  // but this handles edge cases like:
  // - Mobs killed by other players after quest complete
  // - Environmental kills that completed the quest
  // - Mobs that wandered away but are still alive
  // ========================================================================
  if (quest.isEncounter && quest.spawnData) {
    const dimension = world.getDimension(quest.spawnData.dimensionId || "overworld");
    const despawnedCount = despawnEncounterMobs(quest.id, dimension);

    // Log for debugging (in case some mobs remained after quest complete)
    if (despawnedCount > 0) {
      console.log(`[Encounter] Despawned ${despawnedCount} remaining mobs on turn-in for quest ${quest.id}`);
    }
  }
  // === END ENCOUNTER DESPAWN ===

  // === SUCCESSFUL TURN-IN ===

  // Calculate final reward with all bonuses
  const reward = quest.reward;
  const questBaseSP = reward?.scoreboardIncrement ?? 0;
  const isFirstOfDay = !hasCompletedQuestToday(player);

  const rewardResult = calculateCompletionReward(
    questBaseSP,
    quest.rarity,
    player,
    isFirstOfDay
  );

  // Award SP using new economy system
  if (rewardResult.finalAmount > 0) {
    addSP(player, rewardResult.finalAmount, { skipCelebration: true });
    
    // Trigger rarity-scaled celebration
    // Small delay ensures SP display updates first
    system.runTimeout(() => {
      celebrateQuestComplete(player, {
        rarity: quest.rarity,
        spAmount: rewardResult.finalAmount,
        isJackpot: rewardResult.isJackpot || false,
        streakLabel: rewardResult.streakLabel || null
      });
    }, 3);
  }

  // Increment streak
  incrementStreak(player);

  // Mark daily completion
  markDailyCompletion(player);

  // Display reward message (includes jackpot, streaks, daily bonus)
  player.sendMessage(rewardResult.message);

  // Play jackpot sound if triggered
  if (rewardResult.isJackpot) {
    player.playSound("random.levelup", { volume: 1.0, pitch: 1.2 });
  }

  // Items (unchanged)
  if (reward && reward.rewardItems) {
    const inventory = player.getComponent("inventory")?.container;
    if (inventory) {
      for (const rItem of reward.rewardItems) {
        try {
          const itemStack = new ItemStack(rItem.typeId, rItem.amount);
          inventory.addItem(itemStack);
          player.sendMessage(`§aReceived: ${rItem.amount}x ${rItem.typeId.replace("minecraft:", "")}§r`);
        } catch (e) {
          // Inventory full — drop at feet
          player.dimension.spawnItem(new ItemStack(rItem.typeId, rItem.amount), player.location);
          player.sendMessage(`§eInventory full! Dropped: ${rItem.amount}x ${rItem.typeId.replace("minecraft:", "")}§r`);
        }
      }
    }
  }

  // Update stats
  data.lifetimeCompleted += 1;

  // Clear active quest
  data.active = null;
  data.progress = 0;

  // === CHECK FOR FULL CLEAR ===
  const allComplete = data.available.every(slot => slot === null);

  if (allComplete) {
    // JACKPOT! Auto-populate new quests
    data.available = QuestGenerator.generateDailyQuests(3);
    data.lastRefreshTime = Date.now();
    data.freeRerollAvailable = true;
    data.paidRerollsThisCycle = 0;

    PersistenceManager.saveQuestData(player, data);

    // CELEBRATION!
    triggerQuestClearCelebration(player, rewardResult.finalAmount);
  } else {
    // Normal turn-in
    PersistenceManager.saveQuestData(player, data);

    const colors = getQuestColors(quest.rarity);
    player.sendMessage(`§a✓ Quest Complete: ${colors.chat}${quest.title}`);
    player.playSound("quest.complete_single", { volume: 1.0, pitch: 1.0 });
    player.dimension.spawnParticle("minecraft:villager_happy", player.location);
  }

  // Clear HUD
  player.onScreenDisplay?.setActionBar?.("");
}
