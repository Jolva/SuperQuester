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
