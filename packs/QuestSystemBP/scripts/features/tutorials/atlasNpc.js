/**
 * atlasNpc.js
 * Atlas NPC tutorial and dialog system.
 * 
 * Handles:
 * - Atlas NPC interaction detection
 * - Tutorial dialog display with topic selection
 * - Individual tutorial page display
 * - NPC naming and sound effects
 */

import { ActionFormData } from "@minecraft/server-ui";

// =============================================================================
// ATLAS DIALOG & TUTORIAL PAGES
// =============================================================================

/**
 * Shows the Atlas NPC dialog with tutorial/explanation content.
 * Presents a menu of tutorial topics for the player to explore.
 * 
 * @param {import("@minecraft/server").Player} player
 * @param {Object} deps - Dependencies object containing:
 *   - TEXTURES: Icon texture paths
 *   - showQuestBoard: Function to open quest board
 * @param {Function} showTutorialPageCallback - Callback to show tutorial page
 */
export function showQuestMasterDialog(player, deps, showTutorialPageCallback) {
  const { TEXTURES, showQuestBoard } = deps;

  const form = new ActionFormData()
    .title("§lAtlas")
    .body(
      "§7Greetings, adventurer! I am the keeper of the Quest Board, Atlas.\n\n" +
      "§fSelect a topic to learn more:"
    )
    .button("§2How Quests Work", TEXTURES.DEFAULT)
    .button("§eAbout Super Points (SP)", TEXTURES.SP_COIN)
    .button("§bRerolls & Refreshes", TEXTURES.REFRESH)
    .button("§dQuest Rarities", TEXTURES.MYTHIC)
    .button("§aOpen Quest Board", TEXTURES.CATEGORY_UNDEAD)
    .button("§7Nevermind");

  form.show(player).then((response) => {
    if (response.canceled || response.selection === 5) return;

    switch (response.selection) {
      case 0:
        showTutorialPageCallback(player, "how_quests_work");
        break;
      case 1:
        showTutorialPageCallback(player, "super_points");
        break;
      case 2:
        showTutorialPageCallback(player, "rerolls");
        break;
      case 3:
        showTutorialPageCallback(player, "rarities");
        break;
      case 4:
        // Open the actual quest board
        showQuestBoard(player, "available", true);
        break;
    }
  });
}

/**
 * Shows a specific tutorial page as a MessageForm (OK to go back).
 * Displays detailed information about a specific topic with option to return to Atlas dialog.
 * 
 * @param {import("@minecraft/server").Player} player
 * @param {string} topic - Tutorial topic key (from tutorials data)
 * @param {Object} deps - Dependencies object containing:
 *   - tutorials: Tutorial content data
 * @param {Function} showQuestMasterDialogCallback - Callback to return to Atlas dialog
 */
export function showTutorialPage(player, topic, deps, showQuestMasterDialogCallback) {
  const { tutorials } = deps;
  const page = tutorials[topic];
  if (!page) return;

  const msg = new ActionFormData()
    .title(page.title)
    .body(page.body)
    .button("§aBack to Atlas", "textures/quest_ui/icon_crown")
    .button("§7Close");

  msg.show(player).then((response) => {
    if (response.selection === 0) {
      showQuestMasterDialogCallback(player);
    }
  });
}

// =============================================================================
// NPC INTERACTION HANDLER
// =============================================================================

/**
 * Atlas NPC interaction handler.
 * Detects when a player interacts with the Atlas NPC entity and shows the tutorial dialog.
 * 
 * @param {Object} ev - EntityHitEntityAfterEvent from Minecraft
 * @param {Object} deps - Dependencies object containing:
 *   - lastInteractTime: Map for debouncing interactions
 *   - system: Minecraft system API
 * @param {Function} showQuestMasterDialogCallback - Callback to show Atlas dialog
 */
export function handleAtlasInteract(ev, deps, showQuestMasterDialogCallback) {
  const { lastInteractTime, system } = deps;
  const entity = ev.sourceEntity;
  if (!entity) return;

  const nearbyPlayers = entity.dimension.getPlayers({
    location: entity.location,
    maxDistance: 3
  });

  if (nearbyPlayers.length === 0) return;
  const player = nearbyPlayers[0];

  // Debounce check
  const now = Date.now();
  const lastTime = lastInteractTime.get(player.name + "_npc") || 0;
  if (now - lastTime < 500) return;
  lastInteractTime.set(player.name + "_npc", now);

  // Auto-name the NPC
  if (entity.nameTag !== "Atlas") {
    entity.nameTag = "Atlas";
  }

  // Play sounds
  player.playSound("ui.npc_questmaster_greet", { volume: 0.8, pitch: 1.0 });

  if (Math.random() < 0.2) {
    system.runTimeout(() => {
      player.playSound("ui.npc_questmaster_idle", { volume: 0.5, pitch: 1.0 });
    }, 15);
  }

  showQuestMasterDialogCallback(player);
}
