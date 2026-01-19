# SuperQuester SP Economy Overhaul
## Implementation Specification v1.0

---

## Executive Summary

This document specifies a complete restructuring of the SP (Super Points) economy system. The current implementation has hardcoded values scattered across multiple files with no configuration layer. This overhaul introduces a modular architecture with centralized configuration, enabling easy balancing and future feature expansion.

**Key Changes:**
- All SP values multiplied by ~10x (1-5 SP → 10-5000 SP range)
- New `mythic` rarity tier
- Quest type modifiers (kill vs gather vs explore, etc.)
- Jackpot system with critical reward rolls
- Streak bonuses for consecutive completions
- First-of-day bonus
- Difficulty scaling based on target counts
- Reroll cost rebalanced to 100 SP (from 50 SP at old scale)

---

## File Structure

Create the following new files:

```
scripts/
├── data/
│   └── EconomyConfig.js       # NEW: All economy constants
├── systems/
│   ├── SPManager.js           # NEW: SP read/write operations
│   ├── RewardCalculator.js    # NEW: Reward computation logic
│   └── StreakTracker.js       # NEW: Completion streak tracking
```

Modify these existing files:
```
scripts/
├── main.js                    # Remove SP logic, import new modules
├── QuestGenerator.js          # Import config, use RewardCalculator
```

---

## Phase 1: EconomyConfig.js

**File Path:** `scripts/data/EconomyConfig.js`

This file contains ONLY static configuration data. No functions, no logic, no imports. Just exportable objects that other modules consume.

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// EconomyConfig.js
// SuperQuester Economy Configuration
// ═══════════════════════════════════════════════════════════════════════════
// This file is the SINGLE SOURCE OF TRUTH for all economy-related values.
// To rebalance the game, edit numbers here. Do not hardcode values elsewhere.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Base SP reward ranges by rarity.
 * When a quest is generated, a random value between min and max is selected.
 * Ranges intentionally overlap to create exciting variance.
 */
export const BASE_REWARDS = {
    common: {
        min: 100,
        max: 250
    },
    rare: {
        min: 200,
        max: 600
    },
    legendary: {
        min: 500,
        max: 1500
    },
    mythic: {
        min: 1200,
        max: 5000
    }
};

/**
 * Rarity definitions including generation weights and display formatting.
 * Weights are relative - they don't need to sum to 100.
 */
export const RARITY_CONFIG = {
    common: {
        weight: 70,
        color: "§f",           // White
        label: "Common",
        labelFormatted: "§fCommon"
    },
    rare: {
        weight: 22,
        color: "§9",           // Blue
        label: "Rare",
        labelFormatted: "§9Rare"
    },
    legendary: {
        weight: 7,
        color: "§6",           // Gold
        label: "Legendary",
        labelFormatted: "§6Legendary"
    },
    mythic: {
        weight: 1,
        color: "§d",           // Light Purple
        label: "Mythic",
        labelFormatted: "§d§lMythic"  // Bold for extra emphasis
    }
};

/**
 * Quest type modifiers applied to base reward.
 * Values are multipliers (1.0 = no change, 0.85 = 15% less, 1.25 = 25% more).
 */
export const QUEST_TYPE_MODIFIERS = {
    kill: 1.0,        // Standard combat - baseline risk/reward
    mine: 0.9,        // Can be pre-farmed, lower effort
    gather: 0.85,     // Lowest effort - items often already in inventory
    craft: 0.95,      // Requires materials but no danger
    explore: 1.15,    // Time investment, cannot be pre-completed
    deliver: 1.0,     // Standard fetch quest
    survive: 1.25,    // High risk - no deaths, timed challenges
    boss: 1.5         // Reserved for mythic boss encounters
};

/**
 * Jackpot (critical reward) configuration by rarity.
 * When a jackpot triggers, the final reward is multiplied.
 */
export const JACKPOT_CONFIG = {
    common: {
        chance: 0.05,          // 5% chance
        multiplier: 2.0        // 2x reward
    },
    rare: {
        chance: 0.08,          // 8% chance
        multiplier: 2.0        // 2x reward
    },
    legendary: {
        chance: 0.10,          // 10% chance
        multiplier: 2.5        // 2.5x reward
    },
    mythic: {
        chance: 0.15,          // 15% chance
        multiplier: 3.0        // 3x reward (up to 15,000 SP!)
    }
};

/**
 * Streak bonus configuration.
 * Players earn bonus SP for completing multiple quests in a session.
 * Bonuses are checked in order - player receives the highest applicable tier.
 */
export const STREAK_CONFIG = {
    enabled: true,
    resetOnLogout: true,       // Streak resets when player disconnects
    resetOnNewDay: true,       // Streak resets at daily quest refresh
    thresholds: [
        {
            count: 3,
            bonusPercent: 0.10,    // +10% SP
            label: "Hat Trick",
            color: "§e"            // Yellow
        },
        {
            count: 5,
            bonusPercent: 0.25,    // +25% SP
            label: "On Fire",
            color: "§6"            // Gold
        },
        {
            count: 10,
            bonusPercent: 0.50,    // +50% SP
            label: "Unstoppable",
            color: "§c"            // Red
        }
    ]
};

/**
 * First completion of the day bonus.
 * Encourages daily engagement.
 */
export const FIRST_COMPLETION_BONUS = {
    enabled: true,
    flatBonus: 100,            // +100 SP added to first quest reward
    percentBonus: 0.0          // Additional percentage (0 = disabled)
};

/**
 * Difficulty scaling based on quest target count.
 * Higher targets = more SP beyond a baseline.
 */
export const DIFFICULTY_SCALING = {
    enabled: true,
    baseTargets: {
        kill: 5,               // No bonus for killing 5 or fewer
        mine: 10,              // No bonus for mining 10 or fewer
        gather: 10,            // No bonus for gathering 10 or fewer
        craft: 3               // No bonus for crafting 3 or fewer
    },
    bonusPerUnit: {
        kill: 5,               // +5 SP per mob beyond base
        mine: 3,               // +3 SP per block beyond base
        gather: 3,             // +3 SP per item beyond base
        craft: 8               // +8 SP per crafted item beyond base
    }
};

/**
 * All SP costs in the economy.
 * Centralized here for easy balancing.
 */
export const COSTS = {
    rerollBoard: 100,          // Cost to refresh the quest board
    // Future costs:
    gacha: {
        singlePull: 500,
        tenPull: 4500          // 10% discount for bulk
    }
};

/**
 * Feedback message templates.
 * Uses Minecraft formatting codes.
 * Placeholders: {amount}, {streak}, {bonus}
 */
export const REWARD_MESSAGES = {
    normal: "§6+{amount} SP",
    jackpot: "§6§l★ JACKPOT! +{amount} SP ★",
    withStreak: "§6+{amount} SP §7({streak} {bonus})",
    jackpotWithStreak: "§6§l★ JACKPOT! +{amount} SP ★ §7({streak})",
    firstOfDay: "§6+{amount} SP §a(+{bonus} Daily Bonus!)",
    insufficientFunds: "§cNot enough SP! Need {required}, have {current}."
};
```

---

## Phase 2: SPManager.js

**File Path:** `scripts/systems/SPManager.js`

This module owns ALL SP read/write operations. Nothing else should touch the scoreboard or dynamic properties for SP.

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// SPManager.js
// Centralized SP (Super Points) Management
// ═══════════════════════════════════════════════════════════════════════════
// This module is the ONLY code that should read or write SP values.
// All SP operations flow through here to maintain consistency.
// ═══════════════════════════════════════════════════════════════════════════

import { world } from "@minecraft/server";

const SCOREBOARD_OBJECTIVE = "SuperPoints";
const DYNAMIC_PROPERTY_KEY = "currentSP";

/**
 * Ensures the SP scoreboard objective exists.
 * Call this once during world initialization.
 * @returns {ScoreboardObjective} The SP objective
 */
export function initializeSPObjective() {
    let objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE);
    
    if (!objective) {
        objective = world.scoreboard.addObjective(
            SCOREBOARD_OBJECTIVE,
            "§6✦ Super Points"
        );
        console.warn(`[SPManager] Created scoreboard objective: ${SCOREBOARD_OBJECTIVE}`);
    }
    
    return objective;
}

/**
 * Gets a player's current SP balance.
 * Reads from scoreboard as authoritative source.
 * @param {Player} player - The player to check
 * @returns {number} Current SP balance (0 if not set)
 */
export function getSP(player) {
    const objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE);
    
    if (!objective) {
        console.error(`[SPManager] Scoreboard objective ${SCOREBOARD_OBJECTIVE} not found!`);
        return 0;
    }
    
    try {
        const score = objective.getScore(player.scoreboardIdentity);
        return score ?? 0;
    } catch (error) {
        // Player has no score yet
        return 0;
    }
}

/**
 * Sets a player's SP to an exact value.
 * Updates both scoreboard and backup dynamic property.
 * @param {Player} player - The player to update
 * @param {number} amount - The exact SP value to set
 * @returns {boolean} Success status
 */
export function setSP(player, amount) {
    // Clamp to non-negative
    const safeAmount = Math.max(0, Math.floor(amount));
    
    const objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE);
    
    if (!objective) {
        console.error(`[SPManager] Scoreboard objective ${SCOREBOARD_OBJECTIVE} not found!`);
        return false;
    }
    
    try {
        // Update scoreboard (authoritative)
        objective.setScore(player.scoreboardIdentity, safeAmount);
        
        // Update backup in dynamic properties
        syncBackupProperty(player, safeAmount);
        
        return true;
    } catch (error) {
        console.error(`[SPManager] Failed to set SP for ${player.name}: ${error}`);
        return false;
    }
}

/**
 * Adds SP to a player's balance.
 * @param {Player} player - The player to credit
 * @param {number} amount - Amount to add (must be positive)
 * @returns {{ success: boolean, newBalance: number }}
 */
export function addSP(player, amount) {
    if (amount < 0) {
        console.error(`[SPManager] addSP called with negative amount: ${amount}. Use deductSP instead.`);
        return { success: false, newBalance: getSP(player) };
    }
    
    const currentBalance = getSP(player);
    const newBalance = currentBalance + Math.floor(amount);
    const success = setSP(player, newBalance);
    
    return { success, newBalance };
}

/**
 * Deducts SP from a player's balance.
 * Will not reduce below zero.
 * @param {Player} player - The player to debit
 * @param {number} amount - Amount to deduct (must be positive)
 * @returns {{ success: boolean, newBalance: number, actualDeducted: number }}
 */
export function deductSP(player, amount) {
    if (amount < 0) {
        console.error(`[SPManager] deductSP called with negative amount: ${amount}. Use addSP instead.`);
        return { success: false, newBalance: getSP(player), actualDeducted: 0 };
    }
    
    const currentBalance = getSP(player);
    const actualDeducted = Math.min(currentBalance, Math.floor(amount));
    const newBalance = currentBalance - actualDeducted;
    const success = setSP(player, newBalance);
    
    return { success, newBalance, actualDeducted };
}

/**
 * Checks if a player can afford a cost.
 * @param {Player} player - The player to check
 * @param {number} cost - The cost to check against
 * @returns {boolean} True if player has enough SP
 */
export function canAfford(player, cost) {
    return getSP(player) >= cost;
}

/**
 * Attempts a purchase - deducts SP if affordable.
 * @param {Player} player - The player making the purchase
 * @param {number} cost - The cost of the purchase
 * @returns {{ success: boolean, newBalance: number, message: string }}
 */
export function purchase(player, cost) {
    const currentBalance = getSP(player);
    
    if (currentBalance < cost) {
        return {
            success: false,
            newBalance: currentBalance,
            message: `§cNot enough SP! Need §e${cost}§c, have §e${currentBalance}§c.`
        };
    }
    
    const result = deductSP(player, cost);
    
    return {
        success: result.success,
        newBalance: result.newBalance,
        message: result.success ? `§6-${cost} SP §7(Balance: ${result.newBalance})` : "§cTransaction failed."
    };
}

/**
 * Syncs backup dynamic property with scoreboard value.
 * Called internally after every SP modification.
 * @param {Player} player - The player to sync
 * @param {number} value - The SP value to store
 */
function syncBackupProperty(player, value) {
    try {
        // Get existing quest data or create new object
        const existingData = player.getDynamicProperty("questData");
        let questData = {};
        
        if (existingData && typeof existingData === "string") {
            try {
                questData = JSON.parse(existingData);
            } catch (parseError) {
                console.warn(`[SPManager] Could not parse existing questData, creating fresh.`);
                questData = {};
            }
        }
        
        // Update SP backup field
        questData.currentSP = value;
        
        // Write back
        player.setDynamicProperty("questData", JSON.stringify(questData));
    } catch (error) {
        console.warn(`[SPManager] Failed to sync backup property: ${error}`);
        // Non-fatal - scoreboard is authoritative
    }
}

/**
 * Attempts to recover SP from backup if scoreboard shows 0.
 * Call this on player join.
 * @param {Player} player - The player to check
 * @returns {{ recovered: boolean, amount: number }}
 */
export function attemptRecovery(player) {
    const scoreboardValue = getSP(player);
    
    // Only attempt recovery if scoreboard shows 0
    if (scoreboardValue > 0) {
        return { recovered: false, amount: scoreboardValue };
    }
    
    try {
        const existingData = player.getDynamicProperty("questData");
        
        if (existingData && typeof existingData === "string") {
            const questData = JSON.parse(existingData);
            
            if (questData.currentSP && questData.currentSP > 0) {
                // Recover from backup
                setSP(player, questData.currentSP);
                console.warn(`[SPManager] Recovered ${questData.currentSP} SP for ${player.name} from backup.`);
                return { recovered: true, amount: questData.currentSP };
            }
        }
    } catch (error) {
        console.warn(`[SPManager] Recovery check failed: ${error}`);
    }
    
    return { recovered: false, amount: 0 };
}

/**
 * Admin function: Set a player's SP to a specific value.
 * Logs the action for auditing.
 * @param {Player} target - Player to modify
 * @param {number} amount - New SP value
 * @param {string} reason - Reason for modification (logged)
 * @returns {boolean} Success status
 */
export function adminSetSP(target, amount, reason = "admin action") {
    const oldBalance = getSP(target);
    const success = setSP(target, amount);
    
    if (success) {
        console.warn(`[SPManager][ADMIN] ${target.name}: ${oldBalance} → ${amount} SP (${reason})`);
    }
    
    return success;
}

/**
 * Admin function: Add SP to a player.
 * Logs the action for auditing.
 * @param {Player} target - Player to credit
 * @param {number} amount - SP to add
 * @param {string} reason - Reason for modification (logged)
 * @returns {{ success: boolean, newBalance: number }}
 */
export function adminAddSP(target, amount, reason = "admin gift") {
    const oldBalance = getSP(target);
    const result = addSP(target, amount);
    
    if (result.success) {
        console.warn(`[SPManager][ADMIN] ${target.name}: +${amount} SP (${oldBalance} → ${result.newBalance}) (${reason})`);
    }
    
    return result;
}
```

---

## Phase 3: RewardCalculator.js

**File Path:** `scripts/systems/RewardCalculator.js`

This module computes quest rewards with all modifiers applied.

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// RewardCalculator.js
// Quest Reward Computation Engine
// ═══════════════════════════════════════════════════════════════════════════
// Calculates SP rewards based on rarity, quest type, difficulty, and bonuses.
// Returns a detailed reward object for display and awarding.
// ═══════════════════════════════════════════════════════════════════════════

import {
    BASE_REWARDS,
    QUEST_TYPE_MODIFIERS,
    JACKPOT_CONFIG,
    STREAK_CONFIG,
    FIRST_COMPLETION_BONUS,
    DIFFICULTY_SCALING,
    REWARD_MESSAGES
} from "../data/EconomyConfig.js";

import { getPlayerStreak } from "./StreakTracker.js";

/**
 * Generates a random integer between min and max (inclusive).
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer in range
 */
function randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculates the complete SP reward for a quest at generation time.
 * This determines what SP value gets stamped onto the quest object.
 * Does NOT include player-specific bonuses (streaks, first-of-day).
 * 
 * @param {string} rarity - Quest rarity: "common", "rare", "legendary", "mythic"
 * @param {string} questType - Quest type: "kill", "mine", "gather", "craft", etc.
 * @param {number} targetCount - How many of the thing (kill 10 zombies = 10)
 * @returns {{ baseReward: number, typeModifier: number, difficultyBonus: number, total: number }}
 */
export function calculateBaseQuestReward(rarity, questType, targetCount) {
    const rarityLower = rarity.toLowerCase();
    const typeLower = questType.toLowerCase();
    
    // 1. Roll base reward from rarity range
    const range = BASE_REWARDS[rarityLower];
    if (!range) {
        console.error(`[RewardCalculator] Unknown rarity: ${rarity}, defaulting to common`);
        return calculateBaseQuestReward("common", questType, targetCount);
    }
    
    const baseReward = randomInRange(range.min, range.max);
    
    // 2. Get quest type modifier
    const typeModifier = QUEST_TYPE_MODIFIERS[typeLower] ?? 1.0;
    
    // 3. Calculate difficulty scaling bonus
    let difficultyBonus = 0;
    if (DIFFICULTY_SCALING.enabled) {
        const baseTarget = DIFFICULTY_SCALING.baseTargets[typeLower] ?? 0;
        const bonusPerUnit = DIFFICULTY_SCALING.bonusPerUnit[typeLower] ?? 0;
        
        if (targetCount > baseTarget) {
            difficultyBonus = (targetCount - baseTarget) * bonusPerUnit;
        }
    }
    
    // 4. Compute total (before player-specific bonuses)
    const afterType = Math.floor(baseReward * typeModifier);
    const total = afterType + difficultyBonus;
    
    return {
        baseReward,
        typeModifier,
        difficultyBonus,
        total
    };
}

/**
 * Calculates the final SP reward when a player completes a quest.
 * Applies player-specific bonuses: jackpot, streaks, first-of-day.
 * 
 * @param {number} questSPValue - The SP value stamped on the quest at generation
 * @param {string} rarity - Quest rarity for jackpot calculation
 * @param {Player} player - The completing player
 * @param {boolean} isFirstOfDay - Whether this is the player's first quest today
 * @returns {RewardResult} Complete reward breakdown
 * 
 * @typedef {Object} RewardResult
 * @property {number} baseAmount - Quest's base SP value
 * @property {number} finalAmount - Total SP after all bonuses
 * @property {boolean} isJackpot - Whether jackpot triggered
 * @property {number} jackpotMultiplier - Multiplier applied (1.0 if no jackpot)
 * @property {string|null} streakLabel - Name of streak bonus if applicable
 * @property {number} streakBonus - Percentage bonus from streak (0.0 to 0.5)
 * @property {boolean} isFirstOfDay - Whether first-of-day bonus applied
 * @property {number} firstOfDayBonus - Flat SP from first-of-day
 * @property {string} message - Formatted message to display to player
 */
export function calculateCompletionReward(questSPValue, rarity, player, isFirstOfDay) {
    const rarityLower = rarity.toLowerCase();
    
    let amount = questSPValue;
    let isJackpot = false;
    let jackpotMultiplier = 1.0;
    let streakLabel = null;
    let streakBonus = 0;
    let firstOfDayBonusAmount = 0;
    
    // 1. Check for jackpot
    const jackpotConfig = JACKPOT_CONFIG[rarityLower];
    if (jackpotConfig && Math.random() < jackpotConfig.chance) {
        isJackpot = true;
        jackpotMultiplier = jackpotConfig.multiplier;
        amount = Math.floor(amount * jackpotMultiplier);
    }
    
    // 2. Apply streak bonus
    if (STREAK_CONFIG.enabled) {
        const playerStreak = getPlayerStreak(player);
        
        // Find highest applicable streak threshold
        const applicableStreak = STREAK_CONFIG.thresholds
            .slice()  // Copy to avoid mutation
            .reverse()  // Start from highest
            .find(threshold => playerStreak >= threshold.count);
        
        if (applicableStreak) {
            streakLabel = applicableStreak.label;
            streakBonus = applicableStreak.bonusPercent;
            amount = Math.floor(amount * (1 + streakBonus));
        }
    }
    
    // 3. Apply first-of-day bonus
    if (FIRST_COMPLETION_BONUS.enabled && isFirstOfDay) {
        firstOfDayBonusAmount = FIRST_COMPLETION_BONUS.flatBonus;
        amount += firstOfDayBonusAmount;
        
        if (FIRST_COMPLETION_BONUS.percentBonus > 0) {
            amount = Math.floor(amount * (1 + FIRST_COMPLETION_BONUS.percentBonus));
        }
    }
    
    // 4. Build display message
    const message = buildRewardMessage({
        amount,
        isJackpot,
        streakLabel,
        streakBonus,
        isFirstOfDay,
        firstOfDayBonus: firstOfDayBonusAmount
    });
    
    return {
        baseAmount: questSPValue,
        finalAmount: amount,
        isJackpot,
        jackpotMultiplier,
        streakLabel,
        streakBonus,
        isFirstOfDay,
        firstOfDayBonus: firstOfDayBonusAmount,
        message
    };
}

/**
 * Builds a formatted reward message for player display.
 * @param {Object} params - Reward parameters
 * @returns {string} Formatted Minecraft color-coded string
 */
function buildRewardMessage({ amount, isJackpot, streakLabel, streakBonus, isFirstOfDay, firstOfDayBonus }) {
    // Format amount with commas for readability
    const formattedAmount = amount.toLocaleString();
    
    // Determine message template based on bonuses
    if (isJackpot && streakLabel) {
        // Jackpot + Streak
        return `§6§l★ JACKPOT! +${formattedAmount} SP ★ §r§7(${streakLabel})`;
    }
    
    if (isJackpot) {
        // Jackpot only
        return `§6§l★ JACKPOT! +${formattedAmount} SP ★`;
    }
    
    if (isFirstOfDay && streakLabel) {
        // First of day + Streak
        return `§6+${formattedAmount} SP §a(Daily Bonus!) §7(${streakLabel} +${Math.round(streakBonus * 100)}%)`;
    }
    
    if (isFirstOfDay) {
        // First of day only
        return `§6+${formattedAmount} SP §a(+${firstOfDayBonus} Daily Bonus!)`;
    }
    
    if (streakLabel) {
        // Streak only
        return `§6+${formattedAmount} SP §7(${streakLabel} +${Math.round(streakBonus * 100)}%)`;
    }
    
    // Normal reward
    return `§6+${formattedAmount} SP`;
}

/**
 * Previews possible reward range for UI display.
 * Shows min-max SP a quest could award (without player bonuses).
 * 
 * @param {string} rarity - Quest rarity
 * @param {string} questType - Quest type
 * @param {number} targetCount - Target count
 * @returns {{ min: number, max: number, jackpotMax: number }}
 */
export function previewRewardRange(rarity, questType, targetCount) {
    const rarityLower = rarity.toLowerCase();
    const typeLower = questType.toLowerCase();
    
    const range = BASE_REWARDS[rarityLower] ?? BASE_REWARDS.common;
    const typeModifier = QUEST_TYPE_MODIFIERS[typeLower] ?? 1.0;
    const jackpotConfig = JACKPOT_CONFIG[rarityLower] ?? JACKPOT_CONFIG.common;
    
    // Calculate difficulty bonus (same for min and max since it's fixed)
    let difficultyBonus = 0;
    if (DIFFICULTY_SCALING.enabled) {
        const baseTarget = DIFFICULTY_SCALING.baseTargets[typeLower] ?? 0;
        const bonusPerUnit = DIFFICULTY_SCALING.bonusPerUnit[typeLower] ?? 0;
        if (targetCount > baseTarget) {
            difficultyBonus = (targetCount - baseTarget) * bonusPerUnit;
        }
    }
    
    const min = Math.floor(range.min * typeModifier) + difficultyBonus;
    const max = Math.floor(range.max * typeModifier) + difficultyBonus;
    const jackpotMax = Math.floor(max * jackpotConfig.multiplier);
    
    return { min, max, jackpotMax };
}

/**
 * Rolls a rarity based on configured weights.
 * @returns {string} Rarity key: "common", "rare", "legendary", or "mythic"
 */
export function rollRarity() {
    // Import here to avoid circular dependency
    const { RARITY_CONFIG } = require("../data/EconomyConfig.js");
    
    const rarities = Object.entries(RARITY_CONFIG);
    const totalWeight = rarities.reduce((sum, [_, config]) => sum + config.weight, 0);
    
    let roll = Math.random() * totalWeight;
    
    for (const [rarity, config] of rarities) {
        roll -= config.weight;
        if (roll <= 0) {
            return rarity;
        }
    }
    
    // Fallback (shouldn't happen)
    return "common";
}
```

---

## Phase 4: StreakTracker.js

**File Path:** `scripts/systems/StreakTracker.js`

Tracks per-player quest completion streaks.

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// StreakTracker.js
// Quest Completion Streak Tracking
// ═══════════════════════════════════════════════════════════════════════════
// Tracks how many quests each player has completed in their current session.
// Streaks reset on logout and/or daily quest refresh based on config.
// ═══════════════════════════════════════════════════════════════════════════

import { world } from "@minecraft/server";
import { STREAK_CONFIG } from "../data/EconomyConfig.js";

/**
 * In-memory streak storage.
 * Key: player ID, Value: { count: number, lastCompletion: timestamp }
 * 
 * Note: This is intentionally NOT persisted. Streaks are session-based.
 * If you want persistent streaks, move to dynamic properties.
 */
const playerStreaks = new Map();

/**
 * Gets the current streak count for a player.
 * @param {Player} player - The player to check
 * @returns {number} Current streak count (0 if none)
 */
export function getPlayerStreak(player) {
    const data = playerStreaks.get(player.id);
    return data?.count ?? 0;
}

/**
 * Increments a player's streak after quest completion.
 * @param {Player} player - The player who completed a quest
 * @returns {number} New streak count
 */
export function incrementStreak(player) {
    const current = getPlayerStreak(player);
    const newCount = current + 1;
    
    playerStreaks.set(player.id, {
        count: newCount,
        lastCompletion: Date.now()
    });
    
    return newCount;
}

/**
 * Resets a player's streak to zero.
 * @param {Player} player - The player to reset
 */
export function resetStreak(player) {
    playerStreaks.delete(player.id);
}

/**
 * Resets all player streaks.
 * Call this on daily quest refresh if STREAK_CONFIG.resetOnNewDay is true.
 */
export function resetAllStreaks() {
    playerStreaks.clear();
    console.warn("[StreakTracker] All streaks reset (daily refresh)");
}

/**
 * Gets streak info for display purposes.
 * @param {Player} player - The player to check
 * @returns {{ count: number, label: string|null, nextThreshold: number|null, color: string }}
 */
export function getStreakInfo(player) {
    const count = getPlayerStreak(player);
    
    if (!STREAK_CONFIG.enabled || count === 0) {
        return {
            count: 0,
            label: null,
            nextThreshold: STREAK_CONFIG.thresholds[0]?.count ?? null,
            color: "§7"
        };
    }
    
    // Find current tier
    const currentTier = STREAK_CONFIG.thresholds
        .slice()
        .reverse()
        .find(t => count >= t.count);
    
    // Find next tier
    const nextTier = STREAK_CONFIG.thresholds.find(t => count < t.count);
    
    return {
        count,
        label: currentTier?.label ?? null,
        nextThreshold: nextTier?.count ?? null,
        color: currentTier?.color ?? "§7"
    };
}

/**
 * Initialize event handlers for streak resets.
 * Call this once during world initialization.
 */
export function initializeStreakTracking() {
    if (STREAK_CONFIG.resetOnLogout) {
        world.afterEvents.playerLeave.subscribe((event) => {
            // Clear streak data for leaving player
            // Note: We can't use player.id in playerLeave, use playerId from event
            const playerId = event.playerId;
            
            // Find and remove by iterating (playerLeave gives playerId string)
            for (const [id, _] of playerStreaks) {
                if (id === playerId) {
                    playerStreaks.delete(id);
                    console.warn(`[StreakTracker] Streak reset for disconnected player: ${event.playerName}`);
                    break;
                }
            }
        });
    }
    
    console.warn("[StreakTracker] Initialized. Reset on logout: " + STREAK_CONFIG.resetOnLogout);
}
```

---

## Phase 5: Migration Steps

### Step 5.1: Create New Files

Create all four new files as specified above:
1. `scripts/data/EconomyConfig.js`
2. `scripts/systems/SPManager.js`
3. `scripts/systems/RewardCalculator.js`
4. `scripts/systems/StreakTracker.js`

### Step 5.2: Update main.js Imports

At the top of `main.js`, add:

```javascript
// SP Economy imports
import { 
    initializeSPObjective, 
    getSP, 
    addSP, 
    deductSP, 
    purchase,
    attemptRecovery,
    adminAddSP 
} from "./systems/SPManager.js";

import { 
    calculateCompletionReward,
    rollRarity 
} from "./systems/RewardCalculator.js";

import { 
    initializeStreakTracking, 
    incrementStreak, 
    resetAllStreaks,
    getStreakInfo 
} from "./systems/StreakTracker.js";

import { COSTS } from "./data/EconomyConfig.js";
```

### Step 5.3: Update Initialization

Find the world initialization / script load section in `main.js`. Add:

```javascript
// Initialize SP economy systems
initializeSPObjective();
initializeStreakTracking();
```

### Step 5.4: Update Player Join Handler

Find where player join is handled. Add recovery check:

```javascript
world.afterEvents.playerSpawn.subscribe((event) => {
    if (event.initialSpawn) {
        const player = event.player;
        
        // Attempt SP recovery from backup
        const recovery = attemptRecovery(player);
        if (recovery.recovered) {
            player.sendMessage(`§a[SuperQuester] §7Recovered ${recovery.amount} SP from backup.`);
        }
    }
});
```

### Step 5.5: Replace modifySP Function

Find the existing `modifySP` function in `main.js`. It should be REMOVED entirely. All code that called `modifySP` should now call `addSP` or `deductSP` from SPManager.

**Before (REMOVE THIS):**
```javascript
function modifySP(player, amount) {
    // ... old implementation
}
```

**After:**
All calls to `modifySP(player, amount)` become:
- If adding: `addSP(player, amount)`
- If deducting: `deductSP(player, Math.abs(amount))`

### Step 5.6: Update QuestGenerator.js

Find `QuestGenerator.js` and update imports:

```javascript
import { 
    calculateBaseQuestReward, 
    rollRarity 
} from "./systems/RewardCalculator.js";

import { 
    BASE_REWARDS, 
    RARITY_CONFIG, 
    QUEST_TYPE_MODIFIERS 
} from "./data/EconomyConfig.js";
```

Find where quest SP reward is assigned (lines ~147 and ~174 per investigation). Replace hardcoded values:

**Before:**
```javascript
const baseReward = 1; // Hardcoded!
const spReward = baseReward * rarityMultiplier;
```

**After:**
```javascript
const rewardCalc = calculateBaseQuestReward(rarity, questType, targetCount);
const spReward = rewardCalc.total;
```

Also update the quest object to store rarity for later use:

```javascript
const quest = {
    // ... existing fields
    rarity: rarity,           // Store for completion reward calc
    questType: questType,     // Store for completion reward calc
    spReward: spReward,       // Pre-calculated base reward
    // ... rest of quest object
};
```

### Step 5.7: Update Quest Completion Handler

Find `handleQuestTurnIn` or equivalent function in `main.js`. Update reward logic:

**Before (approximate):**
```javascript
const spEarned = quest.spReward;
modifySP(player, spEarned);
player.sendMessage(`§6+${spEarned} SP`);
```

**After:**
```javascript
// Check if first quest of day
const isFirstOfDay = !hasCompletedQuestToday(player); // You'll need to implement this

// Calculate final reward with all bonuses
const rewardResult = calculateCompletionReward(
    quest.spReward,
    quest.rarity,
    player,
    isFirstOfDay
);

// Award SP
addSP(player, rewardResult.finalAmount);

// Increment streak
incrementStreak(player);

// Mark daily completion
markDailyCompletion(player); // You'll need to implement this

// Display reward message
player.sendMessage(rewardResult.message);

// Optional: Play sound for jackpot
if (rewardResult.isJackpot) {
    player.playSound("random.levelup");
}

// Trigger HUD animation
await updateSPDisplayWithAnimation(player);
```

### Step 5.8: Update Reroll Handler

Find where board reroll is handled. Update to use config:

**Before:**
```javascript
const rerollCost = 50; // or calculated in function
```

**After:**
```javascript
import { COSTS } from "./data/EconomyConfig.js";

// In reroll handler:
const result = purchase(player, COSTS.rerollBoard);

if (!result.success) {
    player.sendMessage(result.message);
    return;
}

// Proceed with reroll...
player.sendMessage(`§7Board refreshed! ${result.message}`);
```

### Step 5.9: Add First-of-Day Tracking

Add these helper functions to `main.js` or a utility file:

```javascript
/**
 * Checks if player has completed a quest today.
 * Uses dynamic properties to persist across sessions.
 */
function hasCompletedQuestToday(player) {
    try {
        const lastCompletion = player.getDynamicProperty("lastQuestCompletionDate");
        if (!lastCompletion) return false;
        
        const today = new Date().toDateString();
        return lastCompletion === today;
    } catch {
        return false;
    }
}

/**
 * Marks that player has completed a quest today.
 */
function markDailyCompletion(player) {
    const today = new Date().toDateString();
    player.setDynamicProperty("lastQuestCompletionDate", today);
}
```

### Step 5.10: Update Daily Reset

Find where daily quests are regenerated. Add streak reset:

```javascript
function regenerateDailyQuests() {
    // ... existing quest generation code
    
    // Reset all streaks if configured
    if (STREAK_CONFIG.resetOnNewDay) {
        resetAllStreaks();
    }
}
```

---

## Phase 6: Admin Command

Add scriptevent handler for admin SP commands in `main.js`:

```javascript
import { adminAddSP } from "./systems/SPManager.js";

system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "sq:givesp") {
        const player = event.sourceEntity;
        if (!player || player.typeId !== "minecraft:player") {
            console.warn("[Admin] givesp must be run by a player");
            return;
        }
        
        const args = event.message.trim().split(/\s+/);
        
        // Format: /scriptevent sq:givesp <amount> [targetPlayer]
        if (args.length === 0 || isNaN(parseInt(args[0]))) {
            player.sendMessage("§cUsage: /scriptevent sq:givesp <amount> [player]");
            return;
        }
        
        const amount = parseInt(args[0]);
        let target = player;
        
        // If player name specified, find them
        if (args.length > 1) {
            const targetName = args.slice(1).join(" ");
            const foundPlayers = world.getPlayers({ name: targetName });
            
            if (foundPlayers.length === 0) {
                player.sendMessage(`§cPlayer not found: ${targetName}`);
                return;
            }
            
            target = foundPlayers[0];
        }
        
        const result = adminAddSP(target, amount, `gift from ${player.name}`);
        
        if (result.success) {
            player.sendMessage(`§aGave §e${amount} SP §ato §b${target.name}§a. New balance: §e${result.newBalance}`);
            
            if (target.id !== player.id) {
                target.sendMessage(`§6+${amount} SP §7(admin gift)`);
            }
        } else {
            player.sendMessage("§cFailed to award SP.");
        }
    }
});
```

**Usage:**
- `/scriptevent sq:givesp 500` — Give yourself 500 SP
- `/scriptevent sq:givesp 1000 Steve` — Give Steve 1000 SP

---

## Test Scenarios

After implementation, verify these scenarios:

### Test 1: Basic Quest Completion
1. Generate a common kill quest
2. Complete it
3. Verify SP awarded is between 100-250 (with type modifier applied)
4. Verify HUD updates correctly

**Expected:** SP in range ~100-250 for common kill

### Test 2: Rarity Scaling
1. Use admin command to give yourself test SP
2. Complete quests of each rarity
3. Record SP earned

**Expected ranges:**
| Rarity | Min | Max |
|--------|-----|-----|
| Common | ~85 | ~250 |
| Rare | ~170 | ~600 |
| Legendary | ~425 | ~1,500 |
| Mythic | ~1,020 | ~5,000 |

### Test 3: Jackpot Trigger
1. Complete 20+ legendary quests
2. At least 2 should trigger jackpot (10% chance)

**Expected:** Occasional "JACKPOT" message with 2.5x normal reward

### Test 4: Streak Bonus
1. Complete 3 quests in a row
2. Third quest should show "Hat Trick +10%"
3. Complete 2 more (5 total)
4. Fifth should show "On Fire +25%"

**Expected:** Streak labels appear at thresholds 3, 5, 10

### Test 5: First-of-Day Bonus
1. Complete first quest of a new day
2. Should show "+100 Daily Bonus!"
3. Complete second quest
4. Should NOT show daily bonus

**Expected:** +100 flat bonus on first quest only

### Test 6: Reroll Cost
1. Check SP balance
2. Use reroll
3. Verify 100 SP deducted

**Expected:** Reroll costs exactly 100 SP

### Test 7: Difficulty Scaling
1. Generate quest "Kill 15 zombies" (10 above base of 5)
2. Note SP reward
3. Generate quest "Kill 5 zombies"
4. Compare: first should be ~50 SP higher (+5 per extra mob × 10)

**Expected:** Higher target = higher SP reward

### Test 8: Type Modifiers
1. Generate same-rarity quests of different types
2. Compare SP values
3. Explore quest should average ~15% more than kill
4. Gather quest should average ~15% less than kill

**Expected:** Type modifiers visibly affect rewards

### Test 9: SP Recovery
1. Note your SP balance
2. Use command to corrupt scoreboard: `/scoreboard players set @s SuperPoints 0`
3. Leave and rejoin the world
4. SP should be recovered from backup

**Expected:** Recovery message, balance restored

### Test 10: Admin Command
1. Run `/scriptevent sq:givesp 999`
2. Verify +999 SP awarded
3. Run `/scriptevent sq:givesp 500 [otherPlayer]`
4. Verify other player receives 500 SP

**Expected:** Admin commands work for self and others

---

## Migration Checklist

- [ ] Create `scripts/data/EconomyConfig.js`
- [ ] Create `scripts/systems/SPManager.js`
- [ ] Create `scripts/systems/RewardCalculator.js`
- [ ] Create `scripts/systems/StreakTracker.js`
- [ ] Add imports to `main.js`
- [ ] Add initialization calls for SP systems
- [ ] Add player join recovery check
- [ ] Remove old `modifySP` function
- [ ] Update all `modifySP` calls to use `addSP`/`deductSP`
- [ ] Update `QuestGenerator.js` to use `calculateBaseQuestReward`
- [ ] Update quest completion handler to use `calculateCompletionReward`
- [ ] Update reroll handler to use `COSTS.rerollBoard`
- [ ] Add daily completion tracking functions
- [ ] Add streak reset to daily quest regeneration
- [ ] Add admin scriptevent handler
- [ ] Run all test scenarios
- [ ] Verify HUD animation still works with new SP amounts

---

## Notes for AntiGravity

1. **Do not hardcode any SP values** — Everything comes from `EconomyConfig.js`

2. **Import paths** — Adjust relative paths based on actual file structure. The paths assume scripts are organized as shown in the file structure section.

3. **ES Module syntax** — This spec uses `import`/`export`. If the project uses CommonJS (`require`), convert accordingly.

4. **Error handling** — The SPManager includes try/catch blocks. Don't remove these; scoreboard operations can fail.

5. **Logging** — `console.warn` is used for logs that should appear in content log. Use `console.log` for debug-only messages.

6. **Circular dependency warning** — `RewardCalculator.js` has a dynamic `require()` in `rollRarity()` to avoid circular import with `EconomyConfig`. If you restructure, watch for this.

7. **Testing incrementally** — Implement in order: Config → SPManager → RewardCalculator → StreakTracker → Integration. Test each phase before moving on.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-18 | Initial specification |
