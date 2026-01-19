# SuperQuester SP Economy Overhaul
## Implementation Specification v2.0

---

## Executive Summary

This document specifies a complete restructuring of the SP (Super Points) economy system. The current implementation has hardcoded values scattered across multiple files with no configuration layer. This overhaul introduces a modular architecture with centralized configuration, enabling easy balancing and future feature expansion.

**Key Changes:**
- All SP values multiplied by ~10x (1-5 SP → 10-5000 SP range)
- New `mythic` rarity tier
- Quest type modifiers (kill vs gather vs explore, etc.)
- Jackpot system with critical reward rolls
- Streak bonuses for consecutive completions
- First-of-day bonus (aligned with 24h refresh system)
- Difficulty scaling based on target counts
- Exponential reroll pricing (base 100 SP, from 50 SP at old scale)

**Architecture Notes:**
- Wraps existing `modifySP()` and `initializePlayerSP()` rather than replacing
- Dual completion handlers: entity death (kill quests) + manual turn-in (gather/mine)
- Timestamp-based daily tracking aligned with quest refresh system

---

## File Structure

Create the following new files:

```
packs/QuestSystemBP/scripts/
├── data/
│   └── EconomyConfig.js       # NEW: All economy constants
├── systems/
│   ├── SPManager.js           # NEW: SP read/write operations (wraps existing)
│   ├── RewardCalculator.js    # NEW: Reward computation logic
│   └── StreakTracker.js       # NEW: Completion streak tracking
```

Modify these existing files:
```
packs/QuestSystemBP/scripts/
├── main.js                    # Integrate new modules, update completion handlers
├── systems/QuestGenerator.js  # Import config, use RewardCalculator
```

---

## Phase 1: EconomyConfig.js

**File Path:** `packs/QuestSystemBP/scripts/data/EconomyConfig.js`

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
 *
 * Note: Only kill, mine, gather are currently implemented. Others reserved for future.
 */
export const QUEST_TYPE_MODIFIERS = {
    kill: 1.0,        // Standard combat - baseline risk/reward
    mine: 0.9,        // Can be pre-farmed, lower effort
    gather: 0.85,     // Lowest effort - items often already in inventory
    craft: 0.95,      // FUTURE: Requires materials but no danger
    explore: 1.15,    // FUTURE: Time investment, cannot be pre-completed
    deliver: 1.0,     // FUTURE: Standard fetch quest
    survive: 1.25,    // FUTURE: High risk - no deaths, timed challenges
    boss: 1.5         // FUTURE: Reserved for mythic boss encounters
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
 *
 * REROLL PRICING STRATEGY:
 * - First reroll per cycle: FREE (earned by completing all 3 quests)
 * - Next 2 paid rerolls: 100 SP each (base price)
 * - Subsequent rerolls: Exponential (100 * 2^(n-2) where n = paid reroll count)
 *   Example: 100, 100, 200, 400, 800, 1600...
 * - Resets to FREE on 24-hour daily refresh
 */
export const COSTS = {
    rerollBase: 100,           // Base cost for paid rerolls (was 50 in old system)
    rerollFreeCount: 2,        // First N paid rerolls cost base price
    rerollExponent: 2,         // Multiplier exponent for subsequent rerolls

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

**File Path:** `packs/QuestSystemBP/scripts/systems/SPManager.js`

This module provides a clean API for SP operations. It wraps the existing `modifySP()` function and adds new functionality without duplicating working code.

**ARCHITECTURE NOTE:** Your existing `modifySP()` and `initializePlayerSP()` functions in main.js are already well-designed. This module wraps them to provide a clean import interface and adds admin functions.

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// SPManager.js
// Centralized SP (Super Points) Management
// ═══════════════════════════════════════════════════════════════════════════
// This module provides a clean API for SP operations by wrapping the existing
// well-tested functions in main.js. It adds admin utilities and import structure.
// ═══════════════════════════════════════════════════════════════════════════

import { world } from "@minecraft/server";

const SCOREBOARD_OBJECTIVE = "SuperPoints";

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
            "§e★ SP"  // Matches existing display name
        );
        console.warn(`[SPManager] Created scoreboard objective: ${SCOREBOARD_OBJECTIVE}`);
    }

    return objective;
}

/**
 * Gets a player's current SP balance.
 * Reads from scoreboard as authoritative source.
 *
 * NOTE: This is a re-export wrapper. The actual implementation is getSP() in main.js
 * We import and re-export to maintain clean module boundaries.
 *
 * @param {Player} player - The player to check
 * @returns {number} Current SP balance (0 if not set)
 */
export function getSP(player) {
    const objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE);
    if (!objective || !player.scoreboardIdentity) return 0;
    return objective.getScore(player.scoreboardIdentity) ?? 0;
}

/**
 * Adds SP to a player's balance.
 * Wraps the existing modifySP() function with positive delta.
 * Updates both scoreboard and backup, triggers HUD animation.
 *
 * @param {Player} player - The player to credit
 * @param {number} amount - Amount to add (must be positive)
 * @returns {{ success: boolean, newBalance: number }}
 */
export function addSP(player, amount) {
    if (amount < 0) {
        console.error(`[SPManager] addSP called with negative amount: ${amount}. Use deductSP instead.`);
        return { success: false, newBalance: getSP(player) };
    }

    // Call the existing modifySP function from main.js (import via context)
    // This maintains animation triggers and backup sync
    const newBalance = player.__modifySP(amount);

    return { success: true, newBalance };
}

/**
 * Deducts SP from a player's balance.
 * Wraps the existing modifySP() function with negative delta.
 * Will not reduce below zero.
 *
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

    // Call the existing modifySP function with negative delta
    const newBalance = player.__modifySP(-actualDeducted);

    return { success: true, newBalance, actualDeducted };
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
 * Attempts to recover SP from backup if scoreboard shows 0.
 *
 * NOTE: Your existing initializePlayerSP() in main.js already does this!
 * This is a wrapper to provide a named export for the spec.
 *
 * Call this on player join.
 * @param {Player} player - The player to check
 * @returns {{ recovered: boolean, amount: number }}
 */
export function attemptRecovery(player) {
    // This will be implemented by wrapping initializePlayerSP from main.js
    // Or we can keep initializePlayerSP as-is and just call it from player join

    // For now, return a stub - the actual recovery is in main.js:517-543
    return { recovered: false, amount: getSP(player) };
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

**INTEGRATION NOTE:** The above code references `player.__modifySP()` which needs to be added to main.js. See Phase 5 for integration steps.

---

## Phase 3: RewardCalculator.js

**File Path:** `packs/QuestSystemBP/scripts/systems/RewardCalculator.js`

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
    RARITY_CONFIG
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

**File Path:** `packs/QuestSystemBP/scripts/systems/StreakTracker.js`

Tracks per-player quest completion streaks using the same pattern as your existing `playerMusicState` and `playerDogBarkState` Maps.

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// StreakTracker.js
// Quest Completion Streak Tracking
// ═══════════════════════════════════════════════════════════════════════════
// Tracks how many quests each player has completed in their current session.
// Streaks reset on logout and/or daily quest refresh based on config.
// Uses same in-memory Map pattern as music/dog state in main.js
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
1. `packs/QuestSystemBP/scripts/data/EconomyConfig.js`
2. `packs/QuestSystemBP/scripts/systems/SPManager.js`
3. `packs/QuestSystemBP/scripts/systems/RewardCalculator.js`
4. `packs/QuestSystemBP/scripts/systems/StreakTracker.js`

### Step 5.2: Update main.js Imports

At the top of `main.js` (after existing imports), add:

```javascript
// SP Economy imports
import {
    initializeSPObjective,
    getSP as getSPFromManager,  // Alias to avoid conflict
    addSP,
    deductSP,
    purchase,
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

### Step 5.3: Expose modifySP to SPManager

Find the existing `modifySP` function in main.js (around line 478). After it, add:

```javascript
// Expose modifySP to Player prototype for SPManager wrapper
// This allows SPManager to call the existing animation-aware function
Object.defineProperty(Object.getPrototypeOf(world.getAllPlayers()[0]), '__modifySP', {
    value: function(delta) {
        return modifySP(this, delta);
    },
    writable: false,
    configurable: false
});
```

**ALTERNATIVE (simpler):** Just export modifySP directly and import it in SPManager:

In main.js:
```javascript
export function modifySP(player, delta) {
    // ... existing implementation
}
```

In SPManager.js:
```javascript
import { modifySP } from "../main.js";

export function addSP(player, amount) {
    if (amount < 0) {
        console.error(`[SPManager] addSP called with negative amount: ${amount}`);
        return { success: false, newBalance: getSP(player) };
    }

    const newBalance = modifySP(player, amount);
    return { success: true, newBalance };
}

export function deductSP(player, amount) {
    if (amount < 0) {
        console.error(`[SPManager] deductSP called with negative amount: ${amount}`);
        return { success: false, newBalance: getSP(player), actualDeducted: 0 };
    }

    const currentBalance = getSP(player);
    const actualDeducted = Math.min(currentBalance, Math.floor(amount));
    const newBalance = modifySP(player, -actualDeducted);

    return { success: true, newBalance, actualDeducted };
}
```

### Step 5.4: Update Initialization

Find the world initialization handler in `main.js` (around line 150). Add:

```javascript
world.afterEvents.worldInitialize.subscribe(() => {
    console.warn('Quest System BP loaded successfully');
    world.setDefaultSpawnLocation(HUB_SPAWN_LOCATION);

    // Initialize SP economy systems
    initializeSPObjective();
    initializeStreakTracking();
});
```

### Step 5.5: Update QuestGenerator.js

Replace the rarity rolling logic in `QuestGenerator.js` (lines 84-98):

**Before:**
```javascript
// Rarity Logic
const roll = Math.random();
let rarity = "common";
let multiplier = 1;
let color = "§7";

if (roll >= 0.9) {
    rarity = "legendary";
    multiplier = 5;
    color = "§6§l";
} else if (roll >= 0.6) {
    rarity = "rare";
    multiplier = 2;
    color = "§b";
}

// Apply Rarity
quest.rarity = rarity;

// Multiply Rewards
if (quest.reward) {
    if (quest.reward.scoreboardIncrement) {
        quest.reward.scoreboardIncrement = Math.ceil(quest.reward.scoreboardIncrement * multiplier);
    }
    if (quest.reward.rewardItems) {
        quest.reward.rewardItems.forEach(item => {
            item.amount = Math.ceil(item.amount * multiplier);
        });
    }
}
```

**After:**
```javascript
import { rollRarity, calculateBaseQuestReward } from "./RewardCalculator.js";

// ... in generateQuest() method ...

// Roll rarity using weighted system
const rarity = rollRarity();
quest.rarity = rarity;

// Calculate SP reward using new system
const rewardCalc = calculateBaseQuestReward(
    rarity,
    quest.type,
    quest.requiredCount
);
quest.reward.scoreboardIncrement = rewardCalc.total;

// Item rewards still use old multiplier system for now
// (Can be enhanced later if needed)
```

### Step 5.6: Update Quest Completion Handlers

You have TWO completion paths that need updating:

#### A) Entity Death Handler (Kill Quests)

Find `handleEntityDeath` in main.js (around line 1641). Update:

**Before:**
```javascript
const spEarned = reward?.scoreboardIncrement ?? 0;

// Credit SP using dual-storage
if (spEarned > 0) {
    modifySP(player, spEarned);
```

**After:**
```javascript
// Calculate final reward with bonuses
const isFirstOfDay = !hasCompletedQuestToday(player);

const rewardResult = calculateCompletionReward(
    reward?.scoreboardIncrement ?? 0,
    activeQuest.rarity,
    player,
    isFirstOfDay
);

// Award SP
addSP(player, rewardResult.finalAmount);

// Increment streak
incrementStreak(player);

// Mark daily completion
markDailyCompletion(player);

// Display reward message
player.sendMessage(rewardResult.message);

// Play jackpot sound
if (rewardResult.isJackpot) {
    player.playSound("random.levelup", { volume: 1.0, pitch: 1.2 });
}
```

#### B) Manual Turn-In Handler (Gather/Mine Quests)

Find the turn-in logic in main.js and apply the same pattern as above.

### Step 5.7: Add Daily Completion Tracking

Add these helper functions to main.js (around line 700, near other quest helpers):

```javascript
// === CONSTANTS FOR DAILY TRACKING ===
// Reuse existing TWENTY_FOUR_HOURS_MS constant

/**
 * Checks if player has completed a quest today.
 * Uses timestamp comparison aligned with quest refresh system.
 * @param {Player} player
 * @returns {boolean} True if player completed a quest in last 24 hours
 */
function hasCompletedQuestToday(player) {
    const data = ensureQuestData(player);
    if (!data.lastCompletionTime) return false;

    const timeSinceCompletion = Date.now() - data.lastCompletionTime;
    return timeSinceCompletion < TWENTY_FOUR_HOURS_MS;
}

/**
 * Marks that player has completed a quest.
 * Records timestamp for first-of-day bonus tracking.
 * @param {Player} player
 */
function markDailyCompletion(player) {
    const data = ensureQuestData(player);
    data.lastCompletionTime = Date.now();
    PersistenceManager.saveQuestData(player, data);
}
```

Also update the QuestData schema initialization in `ensureQuestData()` to include:

```javascript
questData: {
    available: QuestGenerator.generateDailyQuests(3),
    active: null,
    progress: 0,
    lastRefreshTime: Date.now(),
    lastCompletionTime: 0,  // NEW: Track last quest completion
    freeRerollAvailable: true,
    paidRerollsThisCycle: 0,
    lifetimeCompleted: 0,
    currentSP: 0
}
```

### Step 5.8: Update Reroll Handler

Find `calculateRerollPrice` and `handleRefresh` in main.js (around lines 782-843). Update:

**Before:**
```javascript
function calculateRerollPrice(paidRerollsThisCycle) {
    const BASE_PRICE = 50;

    if (paidRerollsThisCycle < 2) {
        return BASE_PRICE;
    }

    return BASE_PRICE * Math.pow(2, paidRerollsThisCycle - 1);
}
```

**After:**
```javascript
import { COSTS } from "./data/EconomyConfig.js";

function calculateRerollPrice(paidRerollsThisCycle) {
    // First N rerolls cost base price
    if (paidRerollsThisCycle < COSTS.rerollFreeCount) {
        return COSTS.rerollBase;
    }

    // Subsequent rerolls use exponential pricing
    // Example: 100, 100, 200, 400, 800...
    return COSTS.rerollBase * Math.pow(COSTS.rerollExponent, paidRerollsThisCycle - COSTS.rerollFreeCount);
}
```

Update `handleRefresh` to use the `purchase()` function:

**Before:**
```javascript
// Deduct SP using centralized helper (updates both scoreboard and backup)
modifySP(player, -price);
```

**After:**
```javascript
// Attempt purchase
const purchaseResult = purchase(player, price);

if (!purchaseResult.success) {
    player.sendMessage(purchaseResult.message);
    player.playSound("note.bass", { pitch: 0.5 });
    return false;
}
```

### Step 5.9: Update Daily Quest Refresh

Find where daily quests auto-refresh in `ensureQuestData()` (around line 760). Add:

```javascript
if (hoursSinceRefresh >= TWENTY_FOUR_HOURS_MS) {
    // Auto-refresh: full wipe (even incomplete quests)
    data.available = QuestGenerator.generateDailyQuests(3);
    data.active = null;
    data.progress = 0;
    data.lastRefreshTime = Date.now();
    data.freeRerollAvailable = true;
    data.paidRerollsThisCycle = 0;

    // NEW: Reset streak tracking on new day
    if (STREAK_CONFIG.resetOnNewDay) {
        resetAllStreaks();
    }

    PersistenceManager.saveQuestData(player, data);
    player.sendMessage("§e⏰ Your daily quests have refreshed!§r");
    console.warn(`[QuestSystem] Auto-refreshed quests for ${player.name} (24h expired)`);
}
```

### Step 5.10: Add Admin Command

Add at the bottom of main.js (around line 2200):

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

---

## Test Scenarios

After implementation, verify these scenarios:

### Test 1: Basic Quest Completion
1. Generate a common kill quest
2. Complete it
3. Verify SP awarded is between 100-250 (with type modifier applied)
4. Verify HUD animation plays
5. Verify streak counter increments

**Expected:** SP in range ~85-250 for common kill (with 0.85-1.0 type modifier)

### Test 2: Rarity Scaling with Mythic
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
3. Verify jackpot sound plays
4. Verify message shows "★ JACKPOT! ★"

**Expected:** Occasional jackpot with 2.5x normal reward

### Test 4: Streak Bonus
1. Complete 3 quests in a row
2. Third quest should show "Hat Trick +10%"
3. Complete 2 more (5 total)
4. Fifth should show "On Fire +25%"
5. Logout and check streak resets

**Expected:** Streak labels appear at thresholds 3, 5, 10. Reset on logout.

### Test 5: First-of-Day Bonus
1. Complete first quest of a new 24h period
2. Should show "+100 Daily Bonus!"
3. Complete second quest within 24h
4. Should NOT show daily bonus

**Expected:** +100 flat bonus on first quest only, resets after 24h

### Test 6: Exponential Reroll Cost
1. Check SP balance
2. Use free reroll (should cost 0)
3. Use first paid reroll (should cost 100 SP)
4. Use second paid reroll (should cost 100 SP)
5. Use third paid reroll (should cost 200 SP)
6. Use fourth paid reroll (should cost 400 SP)

**Expected:** 0, 100, 100, 200, 400, 800...

### Test 7: Difficulty Scaling
1. Generate quest "Kill 15 zombies" (10 above base of 5)
2. Note SP reward
3. Generate quest "Kill 5 zombies"
4. Compare: first should be ~50 SP higher (+5 per extra mob × 10)

**Expected:** Higher target = higher SP reward

### Test 8: Type Modifiers
1. Generate same-rarity quests of different types
2. Compare SP values
3. Mine quest should be ~10% less than kill
4. Gather quest should be ~15% less than kill

**Expected:** Type modifiers affect generation rewards

### Test 9: SP Recovery
1. Note your SP balance
2. Use command to corrupt scoreboard: `/scoreboard players set @s SuperPoints 0`
3. Leave and rejoin the world
4. SP should be recovered from backup (existing system)

**Expected:** Balance restored by initializePlayerSP()

### Test 10: Admin Command
1. Run `/scriptevent sq:givesp 999`
2. Verify +999 SP awarded
3. Run `/scriptevent sq:givesp 500 [otherPlayer]`
4. Verify other player receives 500 SP and sees message

**Expected:** Admin commands work for self and others

---

## Migration Checklist

- [ ] Create `packs/QuestSystemBP/scripts/data/EconomyConfig.js`
- [ ] Create `packs/QuestSystemBP/scripts/systems/SPManager.js`
- [ ] Create `packs/QuestSystemBP/scripts/systems/RewardCalculator.js`
- [ ] Create `packs/QuestSystemBP/scripts/systems/StreakTracker.js`
- [ ] Add imports to `main.js`
- [ ] Export `modifySP` from `main.js` for SPManager
- [ ] Add initialization calls for SP systems in worldInitialize
- [ ] Update `QuestGenerator.js` to use `rollRarity()` and `calculateBaseQuestReward()`
- [ ] Update entity death handler to use `calculateCompletionReward()`
- [ ] Update manual turn-in handler to use `calculateCompletionReward()`
- [ ] Update reroll price calculation to use exponential config
- [ ] Update reroll handler to use `purchase()` function
- [ ] Add `hasCompletedQuestToday()` and `markDailyCompletion()` helpers
- [ ] Add `lastCompletionTime` to QuestData schema
- [ ] Add streak reset to daily quest refresh
- [ ] Add admin scriptevent handler
- [ ] Run all test scenarios
- [ ] Verify HUD animation still works with new SP amounts

---

## Architecture Clarifications (v2.0 Updates)

### 1. Reroll Pricing — Keep Exponential, Update Base

Your current exponential system is smart game design (prevents spam, makes rerolls feel meaningful). The updated config maintains this:

```javascript
COSTS: {
    rerollBase: 100,           // Base cost (was 50)
    rerollFreeCount: 2,        // First 2 paid rerolls at base price
    rerollExponent: 2          // Multiplier for subsequent rerolls
}
// Results in: FREE (from quest completion), then 100, 100, 200, 400, 800...
```

### 2. Daily Completion — Align with 24h System

Uses timestamps instead of date strings to match your quest refresh system:

```javascript
function hasCompletedQuestToday(player) {
    const data = ensureQuestData(player);
    if (!data.lastCompletionTime) return false;
    return (Date.now() - data.lastCompletionTime) < TWENTY_FOUR_HOURS_MS;
}
```

This ensures first-of-day bonus and quest refresh use the same 24-hour window.

### 3. Dual Completion Handlers

The reward calculation hooks into BOTH completion paths:
- **Entity Death:** Kill quest auto-completion (main.js ~line 1641)
- **Turn-In:** Gather/mine manual turn-in

Both call the same flow:
```javascript
calculateCompletionReward() → addSP() → incrementStreak() → markDailyCompletion()
```

### 4. SPManager Simplification

Wraps your existing `modifySP()` and `initializePlayerSP()` functions rather than replacing them. Your animation system and backup sync remain intact.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-18 | Initial specification |
| 2.0 | 2025-01-18 | Architecture review updates: exponential reroll pricing, timestamp-based daily tracking, dual completion handlers, SPManager wrapper pattern |
