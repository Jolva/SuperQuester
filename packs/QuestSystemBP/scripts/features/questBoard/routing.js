/**
 * routing.js
 * Quest Board navigation and routing system.
 * 
 * Handles:
 * - Block-to-tab mapping (BLOCK_TAB_MAP)
 * - Player tab state persistence (which tab player is viewing)
 * - Tab navigation helpers
 */

// =============================================================================
// BLOCK-TO-TAB MAPPING
// =============================================================================

/**
 * Maps custom block IDs to their corresponding Quest Board tabs.
 * Used in wireInteractions to route block clicks to the correct tab.
 */
export const BLOCK_TAB_MAP = {
  // Available Column
  "quest:avail_top": "available",
  "quest:avail_mid": "available",
  "quest:avail_bot": "available",
  // Active Column
  "quest:active_top": "active",
  "quest:active_mid": "active",
  "quest:active_bot": "active",
  // Leaderboard Column
  "quest:leader_top": "leaderboard",
  "quest:leader_mid": "leaderboard",
  "quest:leader_bot": "leaderboard"
};

// =============================================================================
// TAB STATE MANAGEMENT
// =============================================================================

/**
 * In-memory map tracking each player's current Quest Board tab.
 * Key: player.name, Value: tab ID (from BOARD_TABS)
 */
const playerTabState = new Map();

/**
 * Sets the current tab for a player.
 * @param {import("@minecraft/server").Player} player
 * @param {string} tab - Tab ID from BOARD_TABS
 */
export function setPlayerTab(player, tab) {
  playerTabState.set(player.name, tab);
}

/**
 * Gets the current tab for a player, with smart defaults.
 * @param {import("@minecraft/server").Player} player
 * @param {Object} BOARD_TABS - Tab constants (must be passed in)
 * @param {Function} ensureQuestData - Function to get player quest data (must be passed in)
 * @returns {string} The tab ID
 */
export function getPlayerTab(player, BOARD_TABS, ensureQuestData) {
  const key = player.name;
  if (playerTabState.has(key)) return playerTabState.get(key);

  // Default logic: if has active quests, go to Active, else Available
  const data = ensureQuestData(player);
  const hasActive = data.active !== null;
  return hasActive ? BOARD_TABS.ACTIVE : BOARD_TABS.AVAILABLE;
}
