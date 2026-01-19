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
 * Reference to modifySP function from main.js.
 * This will be set when main.js imports this module.
 */
let modifySPRef = null;

/**
 * Internal function to set the modifySP reference.
 * Called by main.js during initialization.
 * @param {Function} fn - The modifySP function from main.js
 */
export function setModifySPReference(fn) {
    modifySPRef = fn;
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

    if (!modifySPRef) {
        console.error(`[SPManager] modifySP reference not set! Call setModifySPReference from main.js`);
        return { success: false, newBalance: getSP(player) };
    }

    // Call the existing modifySP function from main.js
    // This maintains animation triggers and backup sync
    const newBalance = modifySPRef(player, amount);

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

    if (!modifySPRef) {
        console.error(`[SPManager] modifySP reference not set! Call setModifySPReference from main.js`);
        return { success: false, newBalance: getSP(player), actualDeducted: 0 };
    }

    const currentBalance = getSP(player);
    const actualDeducted = Math.min(currentBalance, Math.floor(amount));

    // Call the existing modifySP function with negative delta
    const newBalance = modifySPRef(player, -actualDeducted);

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
