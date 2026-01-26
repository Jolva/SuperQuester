/**
 * updateSheep.js
 * Update Sheep NPC interaction and dialog system.
 * 
 * Handles:
 * - Update Sheep interaction detection
 * - Update log display with scrollable list
 * - Individual update details
 * - Sheep sound effects
 */

import { ActionFormData } from "@minecraft/server-ui";
import { updateLog } from "../../data/updateLog.js";
import { TEXTURES } from "../../data/textures.js";

/**
 * Helper function to play decline sound with variety.
 * @param {import("@minecraft/server").Player} player
 */
function playDeclineSound(player) {
  try {
    // 50% chance for each decline variant
    const soundEvent = Math.random() < 0.5
      ? "ui.npc_update_sheep_tos_decline"
      : "ui.npc_update_sheep_decline_v2";
    player.playSound(soundEvent, { volume: 0.8, pitch: 1.0 });
  } catch (e) {
    console.warn("[UpdateSheep] Failed to play decline sound:", e);
  }
}

/**
 * Shows the Update Sheep Terms of Service dialog.
 * First-time interaction gate before allowing access to update content.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {Function} onAccept - Callback when player agrees to TOS
 */
function showUpdateSheepTOS(player, onAccept) {
  // Play intro sound
  try {
    player.playSound("ui.npc_update_sheep_tos_intro", { volume: 0.8, pitch: 1.0 });
  } catch (e) {
    console.warn("[UpdateSheep] Failed to play TOS intro sound:", e);
  }

  const form = new ActionFormData()
    .title("§lUpdate Sheep™ Terms of Service")
    .body(
      "§7By accessing Update Sheep™ content, you agree to:\n\n" +
      "§f• Receive updates about Super Quester features\n" +
      "§f• Accept that update content may contain spoilers\n" +
      "§f• Understand that past updates may reference removed features\n\n" +
      "§7This agreement is one-time and permanent."
    )
    .button("§a✓ I Agree")
    .button("§c✗ I Do Not Agree");

  form.show(player).then((response) => {
    if (response.canceled) {
      // User closed dialog - treat as decline
      playDeclineSound(player);
      return;
    }

    if (response.selection === 0) {
      // Agreed
      onAccept(player);
    } else {
      // Declined
      playDeclineSound(player);
    }
  });
}

/**
 * Shows a reminder dialog when player returns without accepting TOS.
 * Gives player another chance to accept or definitively decline.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {Function} onAccept - Callback if player changes mind and agrees
 */
function showTOSReminderDialog(player, onAccept) {
  // Play reminder sound
  try {
    player.playSound("ui.npc_update_sheep_return_not_agreed", { volume: 0.8, pitch: 1.0 });
  } catch (e) {
    console.warn("[UpdateSheep] Failed to play reminder sound:", e);
  }

  const form = new ActionFormData()
    .title("§lUpdate Sheep™")
    .body(
      "§7Baa... You haven't agreed to the terms yet!\n\n" +
      "§fWould you like to access Update Sheep™ content?"
    )
    .button("§a✓ Yes, I Agree Now")
    .button("§7Maybe Later");

  form.show(player).then((response) => {
    if (response.canceled || response.selection === 1) {
      // Still declining or closed
      playDeclineSound(player);
      return;
    }

    if (response.selection === 0) {
      // Changed mind - accept now
      onAccept(player);
    }
  });
}

/**
 * Handles TOS acceptance - updates player state and plays celebration.
 * Centralized to ensure consistent handling from both TOS flows.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {Function} ensureQuestData - Function to get player data
 * @param {Object} PersistenceManager - Data persistence layer
 */
function handleTOSAcceptance(player, ensureQuestData, PersistenceManager) {
  // Update state
  const data = ensureQuestData(player);
  data.updateSheepTOSAccepted = true;
  PersistenceManager.saveQuestData(player, data);

  console.log(`[UpdateSheep] ${player.name} accepted TOS`);

  // Play acceptance sound
  try {
    player.playSound("ui.npc_update_sheep_accept", { volume: 0.8, pitch: 1.0 });
  } catch (e) {
    console.warn("[UpdateSheep] Failed to play accept sound:", e);
  }

  // Optional: Play celebration bah-bah (20% chance for variety)
  if (Math.random() < 0.2) {
    try {
      player.playSound("ui.npc_update_sheep_bah_bah", { volume: 0.8, pitch: 1.0 });
    } catch (e) {
      console.warn("[UpdateSheep] Failed to play celebration sound:", e);
    }
  }

  // Show update content immediately
  showUpdateSheepDialog(player);
}

/**
 * Shows the Update Sheep dialog with game updates list.
 *
 * @param {import("@minecraft/server").Player} player
 */
export function showUpdateSheepDialog(player) {
  const form = new ActionFormData()
    .title("§lUpdate Sheep™")
    .body("§7Baa! Here's what's new in Super Quester:\n\n§fSelect an update to see details:");

  // Add buttons for each update
  updateLog.forEach((update) => {
    form.button(`§e${update.date}\n§f${update.title}`, TEXTURES.DEFAULT);
  });

  form.button("§7Close");

  form.show(player).then((response) => {
    if (response.canceled) return;
    
    if (response.selection === updateLog.length) {
      // Close button
      return;
    }

    // Show selected update details
    const update = updateLog[response.selection];
    if (update) {
      showUpdateDetails(player, update);
    }
  });
}

/**
 * Shows details for a specific update.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {Object} update - Update object with date, title, details
 */
function showUpdateDetails(player, update) {
  const form = new ActionFormData()
    .title(`§0${update.date}`)
    .body(`§f${update.title}\n\n${update.details}`)
    .button("§a← Back to Updates")
    .button("§7Close");

  form.show(player).then((response) => {
    if (response.canceled || response.selection === 1) return;
    
    if (response.selection === 0) {
      // Back button - show main dialog again
      showUpdateSheepDialog(player);
    }
  });
}

/**
 * Update Sheep interaction handler.
 * Detects when a player interacts with the Update Sheep entity.
 * Gates content access behind TOS acceptance.
 *
 * @param {Object} ev - Script event from Minecraft
 * @param {Function} ensureQuestData - Function to get player data
 * @param {Object} PersistenceManager - Data persistence layer
 * @param {Map} lastInteractTime - Debounce map to prevent rapid interactions
 */
export function handleUpdateSheepInteract(ev, ensureQuestData, PersistenceManager, lastInteractTime) {
  const entity = ev.sourceEntity;
  if (!entity) return;

  const nearbyPlayers = entity.dimension.getPlayers({
    location: entity.location,
    maxDistance: 3
  });

  if (nearbyPlayers.length === 0) return;
  const player = nearbyPlayers[0];

  // Debounce: Prevent rapid re-interaction (500ms cooldown)
  const now = Date.now();
  const interactKey = player.name + "_update_sheep";
  const lastTime = lastInteractTime.get(interactKey) || 0;
  if (now - lastTime < 500) {
    return; // Too soon, ignore interaction
  }
  lastInteractTime.set(interactKey, now);

  // Auto-name the NPC
  if (entity.nameTag !== "Update Sheep™") {
    entity.nameTag = "Update Sheep™";
  }

  // Get player's quest data to check TOS status
  const data = ensureQuestData(player);

  if (!data.updateSheepTOSAccepted) {
    // TOS not accepted - check if first time or returning
    if (!data.updateSheepTOSPrompted) {
      // FIRST TIME: Show full TOS intro with intro audio
      data.updateSheepTOSPrompted = true;
      PersistenceManager.saveQuestData(player, data);

      showUpdateSheepTOS(player, (acceptingPlayer) => {
        handleTOSAcceptance(acceptingPlayer, ensureQuestData, PersistenceManager);
      });
    } else {
      // RETURNING WITHOUT ACCEPTANCE: Show reminder with return audio
      showTOSReminderDialog(player, (acceptingPlayer) => {
        handleTOSAcceptance(acceptingPlayer, ensureQuestData, PersistenceManager);
      });
    }
  } else {
    // TOS already accepted - show normal greeting and content
    try {
      player.playSound("ui.npc_update_sheep_greet", { volume: 0.8, pitch: 1.0 });
    } catch (e) {
      console.warn("[UpdateSheep] Failed to play greeting sound:", e);
    }

    showUpdateSheepDialog(player);
  }
}
