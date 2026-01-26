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
 *
 * @param {Object} ev - Script event from Minecraft
 */
export function handleUpdateSheepInteract(ev) {
  const entity = ev.sourceEntity;
  if (!entity) return;

  const nearbyPlayers = entity.dimension.getPlayers({
    location: entity.location,
    maxDistance: 3
  });

  if (nearbyPlayers.length === 0) return;
  const player = nearbyPlayers[0];

  // Auto-name the NPC
  if (entity.nameTag !== "Update Sheep™") {
    entity.nameTag = "Update Sheep™";
  }

  // Play greeting sound
  try {
    player.playSound("ui.npc_update_sheep_greet", { volume: 0.8, pitch: 1.0 });
  } catch (e) {
    console.warn("[UpdateSheep] Failed to play sound:", e);
  }

  showUpdateSheepDialog(player);
}
