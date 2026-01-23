/**
 * hudManager.js
 * HUD (Heads-Up Display) management system.
 * 
 * Handles:
 * - SP (Super Points) display updates with animation support
 * - Quest progress action bar display
 * - HUD clearing and state management
 */

// =============================================================================
// SP DISPLAY UPDATES
// =============================================================================

/**
 * Updates the SP display in the HUD.
 * Supports both instant updates and animated count-up effects.
 * 
 * @param {import("@minecraft/server").Player} player
 * @param {number} value - SP value to display (or null to read from player)
 * @param {Object} options - Options object
 * @param {boolean} options.animate - Whether to animate the count-up
 * @param {number} options.oldValue - Previous value (required for animation)
 * @param {Function} getSP - Function to get current SP value
 * @param {Object} SPAnimator - Animation system
 */
export function updateSPDisplay(player, value, options, getSP, SPAnimator) {
  if (options.animate && options.oldValue !== undefined) {
    const newValue = value ?? getSP(player);
    if (options.oldValue !== newValue) {
      SPAnimator.animateCountUp(
        player,
        options.oldValue,
        newValue,
        (p, v) => sendSPDisplayValue(p, v)  // callback to actually update display
      );
      return;
    }
  }
  
  // Instant update (no animation)
  const displayValue = value ?? getSP(player);
  sendSPDisplayValue(player, displayValue);
}

/**
 * Raw SP display update - actually sends the titleraw command.
 * This is called by SPAnimator during count-up or directly for instant updates.
 * 
 * @param {import("@minecraft/server").Player} player
 * @param {number} value - The exact SP value to display
 */
export function sendSPDisplayValue(player, value) {
  try {
    // Invisible timing: 0 fade in, 1 tick stay, 0 fade out
    // JSON UI still captures the value even with minimal duration
    player.runCommandAsync(`titleraw @s times 0 1 0`);

    // Send title with SP value
    player.runCommandAsync(`titleraw @s title {"rawtext":[{"text":"SPVAL:${value}"}]}`);

  } catch (e) {
    console.warn(`[SuperQuester] Failed to update SP display for ${player.name}: ${e}`);
  }
}

// =============================================================================
// QUEST PROGRESS HUD
// =============================================================================

/**
 * Updates the quest progress display in the action bar.
 * Shows quest title, progress, and goal with rarity-based coloring.
 * 
 * @param {import("@minecraft/server").Player} player
 * @param {Object} questState - Quest state object
 * @param {string} questState.status - "active", "complete", etc.
 * @param {string} questState.type - Quest type (kill, mine, gather, encounter)
 * @param {string} questState.rarity - Quest rarity (common, rare, legendary, mythic)
 * @param {string} questState.title - Quest title
 * @param {number} questState.progress - Current progress
 * @param {number} questState.goal - Goal/required count
 * @returns {void}
 */
export function updateQuestHud(player, questState) {
  if (questState.status === "active") {
    // Gather HUD is handled in loop, Kill/Mine here
    // Logic same: show progress
  }

  if (questState.status === "complete") {
    player.onScreenDisplay?.setActionBar?.("§aQuest complete! Return to board.§r");
    return;
  }

  // If we are passing in a temporary state object, we trust it has progress/goal
  if (questState.type === "kill" || questState.type === "mine" || questState.type === "gather") {
    if (questState.goal <= 0) return;

    // Rarity-based text color
    let textColor = "§7"; // Common: gray
    if (questState.rarity === "legendary") textColor = "§6"; // Legendary: gold
    else if (questState.rarity === "rare") textColor = "§b"; // Rare: aqua

    // Clean text display (icons removed due to action bar height clipping)
    player.onScreenDisplay?.setActionBar?.(`${textColor}${questState.title}: ${questState.progress}/${questState.goal}§r`);
  }
}
