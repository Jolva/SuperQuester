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
