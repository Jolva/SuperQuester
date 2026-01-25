/**
 * ui.js
 * Quest Board UI rendering system.
 * 
 * Handles:
 * - Menu UI rendering (Available, Active, Quest Details)
 * - Main Quest Board entry point (showQuestBoard)
 * - Quest management UI (Abandon confirmation)
 */

import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

// =============================================================================
// MENU UI RENDERERS
// =============================================================================

/**
 * Renders the Available Quests tab.
 * @param {import("@minecraft/server").Player} player
 * @param {Array} actions - Actions array for button mapping
 * @param {boolean} isStandalone - Whether shown standalone or as part of quest board
 * @param {Object} deps - Dependencies object containing:
 *   - TEXTURES: Texture paths
 *   - TWENTY_FOUR_HOURS_MS: Time constant
 *   - ensureQuestData: Function
 *   - calculateRerollPrice: Function
 *   - getQuestIcon: Function
 *   - getQuestColors: Function
 * @returns {ActionFormData} The form to display
 */
export async function showAvailableTab(player, actions, isStandalone, deps) {
  const { TEXTURES, TWENTY_FOUR_HOURS_MS, ensureQuestData, calculateRerollPrice, getQuestIcon, getQuestColors } = deps;
  const data = ensureQuestData(player);

  // Count non-null quests
  const availableQuests = data.available.filter(q => q !== null);
  const activeCount = data.active ? 1 : 0;

  // Calculate refresh button text
  let refreshLabel;
  if (data.freeRerollAvailable) {
    refreshLabel = "§a⟳ Refresh Quests (FREE)§r";
  } else {
    const price = calculateRerollPrice(data.paidRerollsThisCycle);
    refreshLabel = `§e⟳ Refresh Quests (${price} SP)§r`;
  }

  // Time until free refresh
  const msUntilRefresh = (data.lastRefreshTime + TWENTY_FOUR_HOURS_MS) - Date.now();
  const hoursLeft = Math.max(0, Math.floor(msUntilRefresh / (1000 * 60 * 60)));
  const minsLeft = Math.max(0, Math.floor((msUntilRefresh % (1000 * 60 * 60)) / (1000 * 60)));
  const timerText = msUntilRefresh > 0 ? `§7Auto-refresh in: ${hoursLeft}h ${minsLeft}m§r` : "";

  const header = isStandalone ? "" : "§2§l[ AVAILABLE ]§r\n\n";
  const body = [
    `${header}§7Active: ${activeCount}/1§r`,
    timerText,
    "",
    availableQuests.length ? "§fNew Requests:§r" : "§7All quests accepted. Complete them or refresh!§r",
  ].filter(Boolean).join("\n");

  const title = isStandalone ? "§lAvailable Quests§r" : "§lQuest Board§r";

  const form = new ActionFormData()
    .title(title)
    .body(body);

  // 1. Quest buttons (mythic/legendary/rare show rarity badge, common shows category icon)
  data.available.forEach((quest, index) => {
    if (quest) {
      const showRarityBadge = quest.rarity === "mythic" || quest.rarity === "legendary" || quest.rarity === "rare";
      const icon = getQuestIcon(quest, showRarityBadge);
      const colors = getQuestColors(quest.rarity);
      form.button(`${colors.button}${quest.title}§r`, icon);
      actions.push({ type: "view_details", questIndex: index, fromStandalone: isStandalone });
    }
  });

  // 2. Refresh button — swaps between refresh arrows (free) and SP coin (paid)
  const refreshIcon = data.freeRerollAvailable ? TEXTURES.REFRESH : TEXTURES.SP_COIN;
  form.button(refreshLabel, refreshIcon);
  actions.push({ type: "refresh", fromStandalone: isStandalone });

  // 3. Close option (always good UX)
  form.button("Close");
  actions.push({ type: "close" });

  return form;
}

/**
 * Renders the Active Quest tab.
 * @param {import("@minecraft/server").Player} player
 * @param {Array} actions - Actions array for button mapping
 * @param {boolean} isStandalone - Whether shown standalone or as part of quest board
 * @param {Object} deps - Dependencies object containing:
 *   - TEXTURES: Texture paths
 *   - ensureQuestData: Function
 *   - getQuestIcon: Function
 *   - getQuestColors: Function
 * @returns {ActionFormData} The form to display
 */
export async function showActiveTab(player, actions, isStandalone, deps) {
  const { TEXTURES, ensureQuestData, getQuestIcon, getQuestColors } = deps;
  const data = ensureQuestData(player);

  const header = isStandalone ? "" : "§2§l[ ACTIVE ]§r\n\n";
  const body = data.active
    ? `${header}§7Your Current Quest:§r`
    : `${header}§7No active quest. Pick one from Available!§r`;

  const title = isStandalone ? "§lActive Quest§r" : "§lQuest Board§r";

  const form = new ActionFormData()
    .title(title)
    .body(body);

  // 1. Content
  if (data.active) {
    const quest = data.active;
    const icon = getQuestIcon(quest);
    const colors = getQuestColors(quest.rarity);

    // Check completion
    const isComplete = (quest.type === "gather")
      ? true // Gather quests validate on turn-in
      : data.progress >= quest.requiredCount;

    // For mining/kill, we use data.progress. Gather is checked on turn-in.

    if (isComplete) {
      form.button(`§aTurn In: ${quest.title}§r`, TEXTURES.COMPLETE);
      actions.push({ type: "turnIn", fromStandalone: isStandalone });

      form.button("§cManage / Abandon§r", "textures/quest_ui/button_abandon");
      actions.push({ type: "manage", fromStandalone: isStandalone });
    } else {
      const progressStr = `${data.progress}/${quest.requiredCount}`;
      form.button(`${colors.button}${quest.title}\n§8${progressStr}§r`, icon);
      actions.push({ type: "manage", fromStandalone: isStandalone });
    }
  }

  form.button("Close");
  actions.push({ type: "close" });

  return form;
}

/**
 * Renders the Quest Details screen (contract view).
 * @param {import("@minecraft/server").Player} player
 * @param {number} questIndex - Index of quest in available array
 * @param {boolean} isStandalone - Whether shown standalone
 * @param {Object} deps - Dependencies object containing:
 *   - ensureQuestData: Function
 *   - getQuestColors: Function
 * @param {Function} showQuestBoard - Reference to showQuestBoard for navigation
 * @param {Function} handleUiAction - Reference to handleUiAction for accept
 * @returns {Promise<void>}
 */
export async function showQuestDetails(player, questIndex, isStandalone, deps, showQuestBoard, handleUiAction) {
  const { ensureQuestData, getQuestColors } = deps;
  const data = ensureQuestData(player);
  const def = data.available[questIndex];
  if (!def) return;

  // Formatting strings
  const scoreRaw = def.reward?.scoreboardIncrement || 0;
  const itemsRaw = def.reward?.rewardItems || [];

  let rewardsStr = "";
  if (scoreRaw > 0) rewardsStr += `\n§e+${scoreRaw} Super Points§r`;
  for (const item of itemsRaw) {
    // Attempt to pretty print item name
    const name = item.typeId.replace("minecraft:", "").replace(/_/g, " ");
    rewardsStr += `\n§b+${item.amount} ${name}§r`;
  }
  if (!rewardsStr) rewardsStr = "\n§7None§r";

  // Rarity Display
  let rarityText = "§7Tier: COMMON§r";
  if (def.rarity === "rare") rarityText = "§bTier: RARE§r";
  if (def.rarity === "legendary") rarityText = "§6§lTier: LEGENDARY§r";
  if (def.rarity === "mythic") rarityText = "§d§lTier: MYTHIC§r";

  let warningText = "";
  if (def.rarity === "legendary") {
    warningText = "\n\n§c⚠ HIGH VALUE TARGET ⚠§r";
  }
  if (def.rarity === "mythic") {
    warningText = "\n\n§d§l⚠ ULTRA RARE MYTHIC ⚠§r";
  }

  const colors = getQuestColors(def.rarity);

  const form = new ActionFormData()
    .title("Quest Contract")
    .body(
      `${colors.chat}${def.title}§r` +
      `\n\n${rarityText}${warningText}` +
      `\n\n§7Difficulty: Normal§r` +
      `\n\n§o"${def.description || "No description provided."}"§r` +
      `\n\n§cOBJECTIVES:§r` +
      `\n- ${def.title}` +
      `\n\n§eREWARDS:§r` +
      rewardsStr
    )
    .button("§a§lACCEPT CONTRACT§r", "textures/quest_ui/icon_complete")
    .button("§7Decline", "textures/quest_ui/icon_alert");

  const res = await form.show(player);

  if (res.canceled) {
    await showQuestBoard(player, "available", isStandalone, false);
    return;
  }

  if (res.selection === 0) {
    // Accept
    await handleUiAction(player, { type: "accept", questIndex, fromStandalone: isStandalone });
    return;
  }

  // Decline (selection === 1)
  await showQuestBoard(player, "available", isStandalone, false);
}

/**
 * Renders the Manage Quest screen (Abandon confirmation).
 * @param {import("@minecraft/server").Player} player
 * @param {boolean} isStandalone - Whether shown standalone
 * @param {Object} deps - Dependencies object containing:
 *   - ensureQuestData: Function
 *   - getQuestColors: Function
 *   - handleQuestAbandon: Function
 * @param {Function} showQuestBoard - Reference to showQuestBoard for navigation
 * @returns {Promise<void>}
 */
export async function showManageQuest(player, isStandalone, deps, showQuestBoard) {
  const { ensureQuestData, getQuestColors, handleQuestAbandon } = deps;
  const data = ensureQuestData(player);
  if (!data.active) {
    await showQuestBoard(player, "active", isStandalone, false);
    return;
  }

  const quest = data.active;
  const colors = getQuestColors(quest.rarity);

  const form = new ActionFormData()
    .title("§cAbandon Quest?")
    .body(`Are you sure you want to abandon:\n${colors.chat}${quest.title}§r\n\nProgress will be lost and it will return to available quests.`)
    .button("§c§lYes, Abandon", "textures/quest_ui/button_abandon")
    .button("§aNo, Keep", "textures/quest_ui/icon_complete");

  const res = await form.show(player);

  if (res.canceled || res.selection === 1) {
    // "No, Keep" or canceled
    await showQuestBoard(player, "active", isStandalone, false);
    return;
  }

  if (res.selection === 0) {
    // "Yes, Abandon"
    const removed = handleQuestAbandon(player);
    if (removed) {
      const c = getQuestColors(removed.rarity);
      player.sendMessage(`§eAbandoned: ${c.chat}${removed.title}§r`);
    }
    await showQuestBoard(player, "active", isStandalone, false);
  }
}

// =============================================================================
// MAIN QUEST BOARD ENTRY POINT
// =============================================================================

/**
 * Main Quest Board display function. Routes to appropriate menu and handles initial sounds.
 * @param {import("@minecraft/server").Player} player
 * @param {string|null} forcedMenu - Force a specific menu (or null for default)
 * @param {boolean} isStandalone - Whether this is standalone or full board navigation
 * @param {boolean} playOpenSound - Whether to play the tab open sound
 * @param {Object} deps - Dependencies object containing all required functions and constants
 * @param {Function} handleUiAction - Reference to handleUiAction for button actions
 * @returns {Promise<void>}
 */
export async function showQuestBoard(player, forcedMenu, isStandalone, playOpenSound, deps, handleUiAction) {
  const {
    ensureQuestData,
    showLeaderboardTab,
    getLeaderboardEntries
  } = deps;

  // ensureQuestData handles expiry now, called inside menu functions too, but calling here helps consistency
  const data = ensureQuestData(player);
  const menu = forcedMenu || (data.active ? "active" : "available");

  // Play menu open sounds based on which tab is opening (initial open only)
  if (playOpenSound) {
    if (menu === "available") {
      player.playSound("ui.available_open", { volume: 0.8, pitch: 1.0 });
    } else if (menu === "active") {
      player.playSound("ui.active_open", { volume: 0.8, pitch: 1.0 });
    } else if (menu === "leaderboard") {
      player.playSound("ui.legends_open", { volume: 0.8, pitch: 1.0 });

      // Check if this player is ranked #1 on the leaderboard
      const { entries } = getLeaderboardEntries(player);
      const isFirstPlace = entries.length > 0 && entries[0].name === player.name;

      if (isFirstPlace) {
        // Wait 2 seconds (40 ticks) then play special sound for all nearby players
        system.runTimeout(() => {
          const nearbyPlayers = player.dimension.getPlayers({
            location: player.location,
            maxDistance: 15
          });

          for (const nearby of nearbyPlayers) {
            nearby.playSound("ui.legends_first_place", {
              location: player.location,  // Sound emanates from the #1 player
              volume: 1.0,
              pitch: 1.0
            });
          }
        }, 40);  // 40 ticks = 2 seconds
      }
    }
  }

  let form;
  const actions = []; // List of actions corresponding to buttons by index

  switch (menu) {
    case "available":
      form = await showAvailableTab(player, actions, isStandalone, deps);
      break;
    case "active":
      form = await showActiveTab(player, actions, isStandalone, deps);
      break;
    case "leaderboard":
      form = await showLeaderboardTab(player, actions, isStandalone);
      break;
    default:
      form = await showAvailableTab(player, actions, isStandalone, deps);
      break;
  }

  const res = await form.show(player);
  if (res.canceled) return;

  const action = actions[res.selection];
  if (!action) return;

  handleUiAction(player, action);
}
