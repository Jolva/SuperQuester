/**
 * actions.js
 * Quest Board action handling and button logic.
 * 
 * Handles:
 * - handleUiAction (main button dispatcher)
 * - Quest accept/abandon/turn-in logic
 * - Refresh/reroll logic
 * - Navigation between tabs and detail screens
 */

import { world } from "@minecraft/server";

// =============================================================================
// MAIN UI ACTION HANDLER
// =============================================================================

/**
 * Handles all Quest Board UI button actions.
 * Dispatches to appropriate handler based on action type.
 * 
 * @param {import("@minecraft/server").Player} player
 * @param {Object} action - Action object from button click
 * @param {Object} deps - Dependencies object containing:
 *   - BOARD_TABS: Tab constants
 *   - getQuestColors: Function
 *   - handleRefresh: Function
 *   - handleQuestAccept: Function
 *   - handleQuestTurnIn: Function
 * @param {Function} showQuestBoard - Reference to showQuestBoard for navigation
 * @param {Function} showQuestDetails - Reference to showQuestDetails for details view
 * @param {Function} showManageQuest - Reference to showManageQuest for abandon flow
 * @returns {Promise<void>}
 */
export async function handleUiAction(player, action, deps, showQuestBoard, showQuestDetails, showManageQuest) {
  const { BOARD_TABS, getQuestColors, handleRefresh, handleQuestAccept, handleQuestTurnIn } = deps;

  if (action.type === "close") return;

  const isStandalone = action.fromStandalone ?? false;

  if (action.type === "nav") {
    await showQuestBoard(player, action.tab, isStandalone, false);
    return;
  }

  if (action.type === "refresh") {
    const success = handleRefresh(player);
    await showQuestBoard(player, BOARD_TABS.AVAILABLE, isStandalone, false);
    return;
  }

  if (action.type === "view_details") {
    // Show details (needs index now)
    await showQuestDetails(player, action.questIndex, isStandalone);
    return;
  }

  if (action.type === "accept") {
    const result = handleQuestAccept(player, action.questIndex);
    if (!result.ok) {
      player.sendMessage(result.reason);
    } else {
      const def = result.quest;
      const colors = getQuestColors(def.rarity);
      player.sendMessage(`§aAccepted: ${colors.chat}${def.title}§r`);

      // FX: Rarity
      if (def.rarity === "legendary") {
        player.playSound("quest.accept_legendary", { volume: 1.0, pitch: 1.0 });
        player.dimension.spawnParticle("minecraft:totem_particle", player.location);
        player.sendMessage("§6§l[LEGENDARY CONTRACT ACCEPTED]§r");
      } else if (def.rarity === "rare") {
        player.playSound("quest.accept_rare", { volume: 1.0, pitch: 1.0 });
        player.dimension.spawnParticle("minecraft:villager_happy", player.location);
      } else {
        player.playSound("random.orb", { pitch: 1.0 });
      }
    }
    return;
  }

  if (action.type === "turnIn") {
    handleQuestTurnIn(player);
    return;
  }

  if (action.type === "manage") {
    // Show management for active quest (Abandon)
    await showManageQuest(player, isStandalone);
    return;
  }
}
