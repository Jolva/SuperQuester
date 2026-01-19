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
