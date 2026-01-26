/**
 * routing.js
 * Quest Board navigation and routing system.
 * 
 * Handles:
 * - Block-to-menu mapping (BLOCK_MENU_MAP)
 */

// =============================================================================
// BLOCK-TO-MENU MAPPING
// =============================================================================

/**
 * Maps custom block IDs to their corresponding Quest Board menus.
 * Used in wireInteractions to route block clicks to the correct menu.
 */
export const BLOCK_MENU_MAP = {
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
