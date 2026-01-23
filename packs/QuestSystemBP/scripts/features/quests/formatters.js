/**
 * formatters.js
 * Quest display formatting utilities.
 * 
 * Handles:
 * - Quest icon selection (rarity badges, category icons)
 * - Quest color palettes (rarity-based colors for UI)
 * - Quest display helpers
 */

// =============================================================================
// QUEST ICON SELECTION
// =============================================================================

/**
 * Gets the appropriate icon for a quest.
 * Priority: Rarity badge (if enabled) > Category icon > Type icon > Default
 * 
 * @param {Object} quest - Quest object
 * @param {boolean} showRarityBadge - Whether to show rarity badge for rare/legendary/mythic
 * @param {Object} TEXTURES - Texture paths object
 * @param {Object} CATEGORY_TEXTURES - Category texture mappings
 * @returns {string} Texture path for the icon
 */
export function getQuestIcon(quest, showRarityBadge, TEXTURES, CATEGORY_TEXTURES) {
  // Rarity badge override (for special visual emphasis)
  if (showRarityBadge) {
    if (quest.rarity === "mythic") return TEXTURES.MYTHIC;
    if (quest.rarity === "legendary") return TEXTURES.LEGENDARY;
    if (quest.rarity === "rare") return TEXTURES.RARE;
  }

  // Category-based icon (primary system)
  if (quest.category && CATEGORY_TEXTURES[quest.category]) {
    return CATEGORY_TEXTURES[quest.category];
  }

  // Fallback to type-based (legacy support)
  if (quest.type === "kill") return TEXTURES.CATEGORY_UNDEAD;
  if (quest.type === "mine") return TEXTURES.CATEGORY_MINING;
  if (quest.type === "gather") return TEXTURES.CATEGORY_GATHERING;

  return TEXTURES.DEFAULT;
}

// =============================================================================
// QUEST COLOR PALETTES
// =============================================================================

/**
 * Gets color codes for quest display based on rarity.
 * Returns separate colors for chat messages and UI buttons.
 * 
 * @param {string} rarity - Quest rarity (common, rare, legendary, mythic)
 * @returns {{ chat: string, button: string }} Color codes for different contexts
 */
export function getQuestColors(rarity) {
  // Returns { chat: "code", button: "code" }
  // NOTE: button colors should be light for visibility on custom stone button textures
  switch (rarity) {
    case "mythic":
      return { chat: "§d§l", button: "§d" }; // Light Purple/Light Purple (mythic tier)
    case "legendary":
      return { chat: "§6§l", button: "§6" }; // Gold/Gold (already visible)
    case "rare":
      return { chat: "§b", button: "§b" };   // Aqua/Aqua (changed from dark blue)
    case "common":
    default:
      return { chat: "§7", button: "§f" };   // Gray chat / White button (changed from black)
  }
}
