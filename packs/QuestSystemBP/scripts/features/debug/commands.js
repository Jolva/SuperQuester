/**
 * commands.js
 * Debug and admin command handlers.
 * 
 * Handles:
 * - Builder mode toggle (!builder)
 * - Force daily quest refresh (!forcedaily)
 * - Register player names (!registernames)
 * - Admin SP giving (/scriptevent sq:givesp)
 */

// =============================================================================
// PLAYER DEBUG COMMANDS
// =============================================================================

/**
 * Handles the !builder command - toggles creative mode and flight.
 * 
 * @param {Object} ev - MessageCreate event
 * @param {Object} deps - Dependencies object containing:
 *   - builderModePlayers: Set tracking builder mode status
 *   - system: Minecraft system API
 */
export function handleBuilderCommand(ev, deps) {
  const { builderModePlayers, system } = deps;
  ev.cancel = true;

  if (builderModePlayers.has(ev.sender.name)) {
    builderModePlayers.delete(ev.sender.name);
    system.run(() => ev.sender.sendMessage("§eBuilder Mode: OFF. Quest Board enabled.§r"));
  } else {
    builderModePlayers.add(ev.sender.name);
    system.run(() => ev.sender.sendMessage("§aBuilder Mode: ON. Quest Board disabled (you can now build).§r"));
  }
}

/**
 * Handles the !forcedaily command - forces daily quest refresh.
 * 
 * @param {Object} ev - MessageCreate event
 * @param {Object} deps - Dependencies object containing:
 *   - ensureQuestData: Function to get player quest data
 *   - PersistenceManager: Data persistence system
 *   - system: Minecraft system API
 */
export function handleForceDailyCommand(ev, deps) {
  const { ensureQuestData, PersistenceManager, system } = deps;
  ev.cancel = true;

  const data = ensureQuestData(ev.sender);
  data.lastRefreshTime = 0; // Force expiry on next access
  PersistenceManager.saveQuestData(ev.sender, data);
  system.run(() => ev.sender.sendMessage("§eDebug: Next board open will trigger 24h refresh.§r"));
}

/**
 * Handles the !registernames command - registers all online players to leaderboard.
 * 
 * @param {Object} ev - MessageCreate event
 * @param {Object} deps - Dependencies object containing:
 *   - world: Minecraft world API
 *   - registerPlayerName: Function to register player names
 *   - system: Minecraft system API
 */
export function handleRegisterNamesCommand(ev, deps) {
  const { world, registerPlayerName, system } = deps;
  ev.cancel = true;

  system.run(() => {
    const players = world.getAllPlayers();
    let count = 0;
    for (const p of players) {
      registerPlayerName(p);
      count++;
    }
    ev.sender.sendMessage(`§aRegistered ${count} player name(s) for leaderboard.§r`);
  });
}

/**
 * Handles the !leaderboardids command - lists unknown leaderboard entries.
 * 
 * @param {Object} ev - MessageCreate event
 * @param {Object} deps - Dependencies object containing:
 *   - getUnknownLeaderboardEntries: Function to list unknown entries
 *   - system: Minecraft system API
 */
export function handleListUnknownLeaderboardCommand(ev, deps) {
  const { getUnknownLeaderboardEntries, system } = deps;
  ev.cancel = true;

  system.run(() => {
    const { entries, missingObjective } = getUnknownLeaderboardEntries();
    if (missingObjective) {
      ev.sender.sendMessage("§cLeaderboard objective missing.§r");
      return;
    }

    if (!entries.length) {
      ev.sender.sendMessage("§aNo unknown leaderboard entries found.§r");
      return;
    }

    ev.sender.sendMessage("§eUnknown leaderboard entries (ID / Score):§r");
    for (const entry of entries) {
      ev.sender.sendMessage(`§7${entry.id}§r §f/ ${entry.score}§r`);
    }
    ev.sender.sendMessage("§7Use: !setleaderboardname <id> <name>§r");
  });
}

/**
 * Handles the !setleaderboardname command - sets a name for a leaderboard ID.
 * 
 * @param {Object} ev - MessageCreate event
 * @param {Object} deps - Dependencies object containing:
 *   - setPlayerNameRegistryEntry: Function to set registry mapping
 *   - system: Minecraft system API
 */
export function handleSetLeaderboardNameCommand(ev, deps) {
  const { setPlayerNameRegistryEntry, system } = deps;
  ev.cancel = true;

  const parts = ev.message.trim().split(/\s+/);
  if (parts.length < 3) {
    system.run(() => ev.sender.sendMessage("§cUsage: !setleaderboardname <id> <name>§r"));
    return;
  }

  const [, id, ...nameParts] = parts;
  const name = nameParts.join(" ").trim();

  if (!id || !name) {
    system.run(() => ev.sender.sendMessage("§cUsage: !setleaderboardname <id> <name>§r"));
    return;
  }

  system.run(() => {
    setPlayerNameRegistryEntry(id, name);
    ev.sender.sendMessage(`§aMapped leaderboard ID ${id} → ${name}§r`);
  });
}

/**
 * Handles the !pruneleaderboardunknowns command - removes unknown entries with 0 score.
 * 
 * @param {Object} ev - MessageCreate event
 * @param {Object} deps - Dependencies object containing:
 *   - pruneUnknownZeroScoreEntries: Function to prune unknown zero-score entries
 *   - system: Minecraft system API
 */
export function handlePruneUnknownLeaderboardCommand(ev, deps) {
  const { pruneUnknownZeroScoreEntries, system } = deps;
  ev.cancel = true;

  system.run(() => {
    const { removed, missingObjective } = pruneUnknownZeroScoreEntries();
    if (missingObjective) {
      ev.sender.sendMessage("§cLeaderboard objective missing.§r");
      return;
    }

    ev.sender.sendMessage(`§aPruned ${removed} unknown leaderboard entr${removed === 1 ? "y" : "ies"} with 0 score.§r`);
  });
}

// =============================================================================
// ADMIN COMMANDS
// =============================================================================

/**
 * Handles /scriptevent sq:givesp - gives SP to players.
 * Usage:
 *   /scriptevent sq:givesp 500              - Give yourself 500 SP
 *   /scriptevent sq:givesp 1000 PlayerName  - Give PlayerName 1000 SP
 * 
 * @param {Object} ev - ScriptEvent
 * @param {Object} deps - Dependencies object containing:
 *   - world: Minecraft world API
 *   - adminAddSP: Function to add SP (admin version, no celebration)
 */
export function handleAdminGiveSP(ev, deps) {
  const { world, adminAddSP } = deps;
  const source = ev.sourceEntity;
  const args = ev.message.trim().split(/\s+/);

  if (args.length < 2) {
    if (source) {
      source.sendMessage("§cUsage: /scriptevent sq:givesp <player|@s> <amount>");
    }
    return;
  }

  const [targetArg, amountArg] = args;
  const amount = parseInt(amountArg, 10);

  if (isNaN(amount)) {
    if (source) {
      source.sendMessage("§cInvalid amount. Must be an integer.");
    }
    return;
  }

  // Resolve target player
  let targetPlayer;
  if (targetArg === "@s") {
    if (!source) {
      console.warn("[SuperQuester] @s used from non-player source");
      return;
    }
    targetPlayer = source;
  } else {
    targetPlayer = world.getAllPlayers().find(p => p.name === targetArg);
    if (!targetPlayer) {
      if (source) {
        source.sendMessage(`§cPlayer "${targetArg}" not found or not online.`);
      }
      return;
    }
  }

  // Give SP using admin function (no celebration)
  adminAddSP(targetPlayer, amount);

  // Confirmation message
  if (source) {
    if (targetPlayer === source) {
      source.sendMessage(`§aGave yourself ${amount} SP.§r`);
    } else {
      source.sendMessage(`§aGave ${amount} SP to ${targetPlayer.name}.§r`);
      targetPlayer.sendMessage(`§aYou received ${amount} SP from an admin.§r`);
    }
  }

  console.log(`[SuperQuester] Admin gave ${amount} SP to ${targetPlayer.name}`);
}
