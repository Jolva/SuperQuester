/**
 * leaderboardService.js
 * Centralized leaderboard system for the Quest Board.
 * 
 * Handles:
 * - Player name registry (maps scoreboard IDs to player names for offline display)
 * - Leaderboard data retrieval (top players by SP)
 * - Leaderboard tab UI rendering
 * 
 * The name registry solves the "offline player" problem where scoreboard participants
 * show as "offlinePlayerName" after logout. We store name mappings in world dynamic
 * properties to persist player names.
 */

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

// =============================================================================
// CONSTANTS
// =============================================================================

const PLAYER_NAME_REGISTRY_KEY = "superquester:player_name_registry";
const SCOREBOARD_OBJECTIVE_ID = "superpoints";
const LEADERBOARD_ENTRY_LIMIT = 10;

// =============================================================================
// PLAYER NAME REGISTRY (Offline Player Name Persistence)
// =============================================================================

/**
 * Loads the player name registry from world dynamic properties.
 * Maps scoreboard participant ID -> player name for offline display.
 * 
 * @returns {Object} Map of scoreboard participant ID -> player name
 */
export function loadPlayerNameRegistry() {
  try {
    const data = world.getDynamicProperty(PLAYER_NAME_REGISTRY_KEY);
    if (typeof data === 'string') {
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn(`[Registry] Failed to load player name registry: ${e}`);
  }
  return {};
}

/**
 * Saves the player name registry to world dynamic properties.
 * 
 * @param {Object} registry - Map of scoreboard participant ID -> player name
 */
export function savePlayerNameRegistry(registry) {
  try {
    world.setDynamicProperty(PLAYER_NAME_REGISTRY_KEY, JSON.stringify(registry));
  } catch (e) {
    console.warn(`[Registry] Failed to save player name registry: ${e}`);
  }
}

/**
 * Registers a player's name in the registry using their scoreboard identity.
 * Should be called when a player joins/spawns.
 * 
 * @param {import("@minecraft/server").Player} player
 */
export function registerPlayerName(player) {
  if (!player || !player.isValid()) return;

  // Ensure player has a scoreboard identity
  const objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE_ID);
  if (!objective) return;

  try {
    // Ensure player has a scoreboard identity by adding 0 if they don't have one
    if (!player.scoreboardIdentity) {
      player.runCommandAsync(`scoreboard players add @s ${SCOREBOARD_OBJECTIVE_ID} 0`).catch(() => { });
      // The identity won't be available until next tick, so we'll try again
      system.runTimeout(() => registerPlayerName(player), 5);
      return;
    }

    const registry = loadPlayerNameRegistry();
    const participantId = player.scoreboardIdentity.id.toString();

    // Only update if name changed or new entry
    if (registry[participantId] !== player.name) {
      registry[participantId] = player.name;
      savePlayerNameRegistry(registry);
    }
  } catch (e) {
    console.warn(`[Registry] Failed to register player ${player.name}: ${e}`);
  }
}

/**
 * Looks up a player name from the registry.
 * 
 * @param {string|number} participantId - The scoreboard participant ID
 * @returns {string|null} The player name or null if not found
 */
export function lookupPlayerName(participantId) {
  const registry = loadPlayerNameRegistry();
  return registry[participantId.toString()] || null;
}

// =============================================================================
// LEADERBOARD DATA
// =============================================================================

/**
 * Gets leaderboard entries sorted by SP (descending).
 * Returns top N players and the current player's position.
 * 
 * @param {import("@minecraft/server").Player} player - Current player (for highlighting)
 * @returns {Object} { entries: Array, currentPlayer: Object|null, missingObjective: boolean }
 */
export function getLeaderboardEntries(player) {
  const objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE_ID);
  if (!objective) {
    return { entries: [], currentPlayer: null, missingObjective: true };
  }

  const participants = objective.getParticipants();
  const scored = [];

  for (const participant of participants) {
    const score = objective.getScore(participant);
    if (typeof score !== "number") continue;

    // Try to get name from registry first (works for offline players)
    let name = lookupPlayerName(participant.id);
    if (!name) {
      // Check if displayName looks like the offline placeholder
      const displayName = participant.displayName || participant.name || "Unknown";
      if (displayName.includes("offlinePlayerName") || displayName.includes("commands.scoreboard")) {
        name = "Unknown Player";
      } else {
        name = displayName;
      }
    }

    scored.push({
      name,
      score,
      participant,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const topEntries = scored.slice(0, LEADERBOARD_ENTRY_LIMIT);

  let currentPlayerEntry = null;
  if (player && player.scoreboardIdentity) {
    const playerScore = objective.getScore(player.scoreboardIdentity);
    if (typeof playerScore === "number") {
      currentPlayerEntry = {
        name: player.name,
        score: playerScore
      };
    }
  }

  return {
    entries: topEntries,
    currentPlayer: currentPlayerEntry,
    missingObjective: false
  };
}

// =============================================================================
// LEADERBOARD UI
// =============================================================================

/**
 * Renders the leaderboard tab UI.
 * Shows top players by SP and the current player's score.
 * 
 * @param {import("@minecraft/server").Player} player - Current player
 * @param {Array} actions - Actions array for button mapping
 * @param {boolean} isStandalone - Whether shown standalone or as part of quest board
 * @returns {ActionFormData} The form to display
 */
export async function showLeaderboardTab(player, actions, isStandalone) {
  const { entries, currentPlayer, missingObjective } = getLeaderboardEntries(player);

  const header = isStandalone ? "" : "§2§l[ LEADERBOARD ]§r\n\n";
  let bodyText = missingObjective
    ? "§cLeaderboard unavailable.§r"
    : `${header}§7Top Survivors:§r\n`;

  if (!missingObjective) {
    if (entries.length === 0) {
      bodyText += "§7No records yet.§r";
    } else {
      entries.forEach((entry, i) => {
        bodyText += `\n${i + 1}. §e${entry.name}§r : ${entry.score}`;
      });
      if (currentPlayer) {
        bodyText += `\n\n§lYou: ${currentPlayer.score}§r`;
      }
    }
  }

  const title = isStandalone ? "§lLeaderboard§r" : "§lQuest Board§r";

  const form = new ActionFormData()
    .title(title)
    .body(bodyText);

  // 1. Refresh button
  form.button("Refresh");
  actions.push({ type: "refresh_leaderboard", fromStandalone: isStandalone });

  // 2. Close button
  form.button("Close");
  actions.push({ type: "close" });

  return form;
}
