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
