/**
 * chatCommands.js
 * Centralized chat command registration for ! commands.
 * 
 * Handles:
 * - Player/admin/debug chat commands (e.g., !quests, !builder, !forcedaily)
 * - Encounter testing commands (!encounter ...)
 * - Fallback chat handling for platforms without beforeEvents.chatSend
 */

// =============================================================================
// CHAT COMMAND REGISTRATION
// =============================================================================

/**
 * Registers chat command handlers and subscriptions.
 * 
 * @param {Object} deps - Dependency injection
 * @param {import("@minecraft/server").World} deps.world
 * @param {import("@minecraft/server").System} deps.system
 * @param {string} deps.FALLBACK_COMMAND
 * @param {Set<string>} deps.builderModePlayers
 * @param {Function} deps.showQuestBoard
 * @param {Function} deps.handleSafeZoneCommand
 * @param {Function} deps.handleBuilderCommand
 * @param {Function} deps.handleForceDailyCommand
 * @param {Function} deps.handleRegisterNamesCommand
 * @param {Function} deps.handleListUnknownLeaderboardCommand
 * @param {Function} deps.handleSetLeaderboardNameCommand
 * @param {Function} deps.handlePruneUnknownLeaderboardCommand
 * @param {Function} deps.ensureQuestData
 * @param {Object} deps.PersistenceManager
 * @param {Function} deps.registerPlayerName
 * @param {Function} deps.getUnknownLeaderboardEntries
 * @param {Function} deps.setPlayerNameRegistryEntry
 * @param {Function} deps.pruneUnknownZeroScoreEntries
 * @param {Function} deps.calculateDistance
 * @param {Function} deps.respawnRemainingMobs
 * @param {Function} deps.despawnEncounterMobs
 * @param {Function} deps.countRemainingMobs
 * @param {Function} deps.cleanupOrphanedMobs
 */
export function registerChatCommands(deps) {
  const {
    world,
    system,
    FALLBACK_COMMAND,
    builderModePlayers,
    showQuestBoard,
    handleSafeZoneCommand,
    handleBuilderCommand,
    handleForceDailyCommand,
    handleRegisterNamesCommand,
    handleListUnknownLeaderboardCommand,
    handleSetLeaderboardNameCommand,
    handlePruneUnknownLeaderboardCommand,
    ensureQuestData,
    PersistenceManager,
    registerPlayerName,
    getUnknownLeaderboardEntries,
    setPlayerNameRegistryEntry,
    pruneUnknownZeroScoreEntries,
    calculateDistance,
    respawnRemainingMobs,
    despawnEncounterMobs,
    countRemainingMobs,
    cleanupOrphanedMobs
  } = deps;

  const lastHandledChatCommand = new Map();

  const getChatKey = (sender) => sender?.id ?? sender?.name ?? "unknown";
  const getChatTick = () => (typeof system.currentTick === "number" ? system.currentTick : Date.now());

  const markHandled = (sender, message) => {
    lastHandledChatCommand.set(getChatKey(sender), { message, tick: getChatTick() });
  };

  const wasHandledRecently = (sender, message) => {
    const key = getChatKey(sender);
    const last = lastHandledChatCommand.get(key);
    if (!last || last.message !== message) return false;
    const now = getChatTick();
    return Math.abs(now - last.tick) <= 2;
  };

  const handleChatCommand = (ev) => {
    if (!ev?.message || !ev?.sender) return false;
    let handled = false;

    // Safe Zone Commands (!safezone on/off/status)
    if (ev.message.startsWith("!safezone")) {
      handled = handleSafeZoneCommand(ev) || handled;
    }

    if (ev.message === "!builder") {
      const localDeps = { builderModePlayers, system };
      handleBuilderCommand(ev, localDeps);
      handled = true;
    }

    if (ev.message === FALLBACK_COMMAND) {
      ev.cancel = true;
      system.run(() => showQuestBoard(ev.sender));
      handled = true;
    }

    // DEBUG: Force Daily Reset
    if (ev.message === "!forcedaily") {
      const localDeps = { ensureQuestData, PersistenceManager, system };
      handleForceDailyCommand(ev, localDeps);
      handled = true;
    }

    // DEBUG: Register all online player names for leaderboard
    if (ev.message === "!registernames") {
      const localDeps = { world, registerPlayerName, system };
      handleRegisterNamesCommand(ev, localDeps);
      handled = true;
    }

    // DEBUG: List unknown leaderboard entries (ID / Score)
    if (ev.message === "!leaderboardids") {
      const localDeps = { getUnknownLeaderboardEntries, system };
      handleListUnknownLeaderboardCommand(ev, localDeps);
      handled = true;
    }

    // DEBUG: Manually map leaderboard ID -> player name
    if (ev.message.startsWith("!setleaderboardname")) {
      const localDeps = { setPlayerNameRegistryEntry, system };
      handleSetLeaderboardNameCommand(ev, localDeps);
      handled = true;
    }

    // DEBUG: Prune unknown leaderboard entries with 0 score
    if (ev.message === "!pruneleaderboardunknowns") {
      const localDeps = { pruneUnknownZeroScoreEntries, system };
      handlePruneUnknownLeaderboardCommand(ev, localDeps);
      handled = true;
    }

    return handled;
  };

  const handleChatEvent = (ev, allowCancel) => {
    const isCommandMessage = typeof ev?.message === "string" && ev.message.startsWith("!");
    const eventForHandlers = allowCancel
      ? ev
      : { sender: ev.sender, message: ev.message, cancel: false };

    if (handleChatCommand(eventForHandlers) && allowCancel) {
      eventForHandlers.cancel = true;
    }

    // ========================================================================
    // PHASE 1 TESTING COMMANDS: Encounter System Validation
    // ========================================================================
    // These commands test the encounter data layer before mob spawning is added.
    // Test the encounter table, quest generation, and data integrity.
    //
    // Available commands:
    // - !encounter test table: Show encounter counts by tier
    // - !encounter test generate rare: Generate and display a rare encounter quest
    // - !encounter test generate legendary: Generate and display a legendary encounter quest
    // ========================================================================

    // Test: Encounter table validation
    if (eventForHandlers.message === "!encounter test table") {
      eventForHandlers.cancel = true;
      system.run(async () => {
        try {
          const { getEncountersByTier, ENCOUNTER_TABLE } = await import("../../data/EncounterTable.js");
          eventForHandlers.sender.sendMessage(`§a=== Encounter Table Status ===`);
          eventForHandlers.sender.sendMessage(`§fTotal encounters: §e${ENCOUNTER_TABLE.length}`);
          eventForHandlers.sender.sendMessage(`§fRare encounters: §e${getEncountersByTier("rare").length}`);
          eventForHandlers.sender.sendMessage(`§fLegendary encounters: §6${getEncountersByTier("legendary").length}`);
          eventForHandlers.sender.sendMessage(`§7Use !encounter test generate <tier> to test generation`);
        } catch (error) {
          eventForHandlers.sender.sendMessage(`§cError loading encounter table: ${error.message}`);
          console.error("[EncounterTest] Table load failed:", error);
        }
      });
    }

    // Test: Generate rare encounter quest
    if (eventForHandlers.message === "!encounter test generate rare") {
      eventForHandlers.cancel = true;
      system.run(async () => {
        try {
          const { generateEncounterQuest } = await import("../../systems/EncounterManager.js");
          const quest = generateEncounterQuest("rare");

          if (quest) {
            eventForHandlers.sender.sendMessage(`§a=== Rare Encounter Generated ===`);
            eventForHandlers.sender.sendMessage(`§fName: §e${quest.encounterName}`);
            eventForHandlers.sender.sendMessage(`§fID: §7${quest.id}`);
            eventForHandlers.sender.sendMessage(`§fMobs: §e${quest.totalMobCount}`);
            eventForHandlers.sender.sendMessage(`§fSP Reward: §e${quest.reward.scoreboardIncrement}`);
            eventForHandlers.sender.sendMessage(`§fItem Reward: §e${quest.reward.rewardItems[0]?.amount || 0}x ${quest.reward.rewardItems[0]?.typeId || "none"}`);
            eventForHandlers.sender.sendMessage(`§fType: §7${quest.type}`);
            eventForHandlers.sender.sendMessage(`§fisEncounter: §7${quest.isEncounter}`);
          } else {
            eventForHandlers.sender.sendMessage(`§cFailed to generate rare encounter`);
          }
        } catch (error) {
          eventForHandlers.sender.sendMessage(`§cError generating encounter: ${error.message}`);
          console.error("[EncounterTest] Generation failed:", error);
        }
      });
    }

    // Test: Generate legendary encounter quest
    if (eventForHandlers.message === "!encounter test generate legendary") {
      eventForHandlers.cancel = true;
      system.run(async () => {
        try {
          const { generateEncounterQuest } = await import("../../systems/EncounterManager.js");
          const quest = generateEncounterQuest("legendary");

          if (quest) {
            eventForHandlers.sender.sendMessage(`§6=== Legendary Encounter Generated ===`);
            eventForHandlers.sender.sendMessage(`§fName: §6${quest.encounterName}`);
            eventForHandlers.sender.sendMessage(`§fID: §7${quest.id}`);
            eventForHandlers.sender.sendMessage(`§fMobs: §6${quest.totalMobCount}`);
            eventForHandlers.sender.sendMessage(`§fSP Reward: §6${quest.reward.scoreboardIncrement}`);
            eventForHandlers.sender.sendMessage(`§fItem Reward: §6${quest.reward.rewardItems[0]?.amount || 0}x ${quest.reward.rewardItems[0]?.typeId || "none"}`);
            eventForHandlers.sender.sendMessage(`§fType: §7${quest.type}`);
            eventForHandlers.sender.sendMessage(`§fisEncounter: §7${quest.isEncounter}`);
          } else {
            eventForHandlers.sender.sendMessage(`§cFailed to generate legendary encounter`);
          }
        } catch (error) {
          eventForHandlers.sender.sendMessage(`§cError generating encounter: ${error.message}`);
          console.error("[EncounterTest] Generation failed:", error);
        }
      });
    }

    // ========================================================================
    // PHASE 3 TESTING COMMANDS: Zone & Proximity Debugging
    // ========================================================================
    // !encounter zone info - Show current zone details and distance
    // !encounter tp zone - Teleport to zone center
    // ========================================================================

    // Show encounter zone information
    if (eventForHandlers.message === "!encounter zone info") {
      eventForHandlers.cancel = true;
      system.run(() => {
        const questData = ensureQuestData(eventForHandlers.sender);

        if (!questData?.active?.isEncounter) {
          eventForHandlers.sender.sendMessage(`§cNo active encounter quest.`);
          return;
        }

        const quest = questData.active;
        const zone = quest.encounterZone;

        eventForHandlers.sender.sendMessage(`§e=== Encounter Zone Info ===`);
        eventForHandlers.sender.sendMessage(`§fName: §e${quest.encounterName}`);
        eventForHandlers.sender.sendMessage(`§fState: §7${quest.encounterState}`);

        if (zone) {
          eventForHandlers.sender.sendMessage(`§fZone center: §7${zone.center.x}, ${zone.center.z}`);
          eventForHandlers.sender.sendMessage(`§fTrigger radius: §7${zone.radius} blocks`);

          const dist = calculateDistance(eventForHandlers.sender.location, zone.center);
          eventForHandlers.sender.sendMessage(`§fYour distance: §e${dist} blocks`);

          if (dist <= zone.radius) {
            eventForHandlers.sender.sendMessage(`§aYou are INSIDE the zone!`);
          } else {
            eventForHandlers.sender.sendMessage(`§7${dist - zone.radius} blocks until zone entry`);
          }
        } else {
          eventForHandlers.sender.sendMessage(`§cNo zone assigned (unexpected)`);
        }

        if (quest.spawnData) {
          const loc = quest.spawnData.location;
          eventForHandlers.sender.sendMessage(`§fSpawn location: §7${loc.x}, ${loc.y}, ${loc.z}`);
        }
      });
    }

    // Teleport to zone center
    if (eventForHandlers.message === "!encounter tp zone") {
      eventForHandlers.cancel = true;
      system.run(() => {
        const questData = ensureQuestData(eventForHandlers.sender);

        if (!questData?.active?.isEncounter || !questData.active.encounterZone) {
          eventForHandlers.sender.sendMessage(`§cNo active encounter with zone.`);
          return;
        }

        const zone = questData.active.encounterZone;
        // Teleport high to avoid spawning inside terrain
        eventForHandlers.sender.teleport({ x: zone.center.x, y: 100, z: zone.center.z });
        eventForHandlers.sender.sendMessage(`§aTeleported to zone center (high altitude)`);
        eventForHandlers.sender.sendMessage(`§7Zone: ${zone.center.x}, ${zone.center.z}`);
      });
    }

    // Teleport to spawn location (if mobs have spawned)
    if (eventForHandlers.message === "!encounter tp spawn") {
      eventForHandlers.cancel = true;
      system.run(() => {
        const questData = ensureQuestData(eventForHandlers.sender);

        if (!questData?.active?.isEncounter) {
          eventForHandlers.sender.sendMessage(`§cNo active encounter quest.`);
          return;
        }

        if (!questData.active.spawnData || !questData.active.spawnData.location) {
          eventForHandlers.sender.sendMessage(`§cMobs haven't spawned yet. Travel to the zone first.`);
          return;
        }

        const loc = questData.active.spawnData.location;
        eventForHandlers.sender.teleport({ x: loc.x, y: loc.y + 1, z: loc.z });
        eventForHandlers.sender.sendMessage(`§aTeleported to spawn location: ${loc.x}, ${loc.y}, ${loc.z}`);
      });
    }

    // === PHASE 4: Debug commands for logout/login persistence testing ===

    // Simulate logout - despawns mobs without actually leaving
    if (eventForHandlers.message === "!encounter test logout") {
      eventForHandlers.cancel = true;
      system.run(() => {
        const questData = ensureQuestData(eventForHandlers.sender);

        if (!questData?.active?.isEncounter) {
          eventForHandlers.sender.sendMessage(`§cNo active encounter`);
          return;
        }

        const quest = questData.active;
        eventForHandlers.sender.sendMessage(`§e=== Simulating Logout ===`);
        eventForHandlers.sender.sendMessage(`§fState: ${quest.encounterState}`);

        if (quest.encounterState === "spawned" && quest.spawnData) {
          const dimension = eventForHandlers.sender.dimension;
          const despawnCount = despawnEncounterMobs(quest.id, dimension);
          quest.spawnData.spawnedEntityIds = [];
          PersistenceManager.saveQuestData(eventForHandlers.sender, questData);
          eventForHandlers.sender.sendMessage(`§aDespawned ${despawnCount} mobs`);
        } else {
          eventForHandlers.sender.sendMessage(`§7No mobs to despawn (state: ${quest.encounterState})`);
        }
        eventForHandlers.sender.sendMessage(`§7Use !encounter test login to simulate login`);
      });
    }

    // Simulate login - respawns remaining mobs
    if (eventForHandlers.message === "!encounter test login") {
      eventForHandlers.cancel = true;
      system.run(() => {
        const questData = ensureQuestData(eventForHandlers.sender);

        if (!questData?.active?.isEncounter) {
          eventForHandlers.sender.sendMessage(`§cNo active encounter`);
          return;
        }

        const quest = questData.active;
        const progress = questData.progress || 0;

        eventForHandlers.sender.sendMessage(`§e=== Simulating Login ===`);
        eventForHandlers.sender.sendMessage(`§fState: ${quest.encounterState}`);
        eventForHandlers.sender.sendMessage(`§fProgress: ${progress}/${quest.totalMobCount}`);

        if (quest.encounterState === "spawned" && quest.spawnData?.location) {
          const remaining = quest.totalMobCount - progress;

          if (remaining > 0) {
            const dimension = eventForHandlers.sender.dimension;
            const entityIds = respawnRemainingMobs(quest, progress, dimension);
            quest.spawnData.spawnedEntityIds = entityIds;
            PersistenceManager.saveQuestData(eventForHandlers.sender, questData);
            eventForHandlers.sender.sendMessage(`§aRespawned ${entityIds.length} mobs`);
          } else {
            eventForHandlers.sender.sendMessage(`§aNo mobs to respawn - encounter complete`);
          }
        } else if (quest.encounterState === "pending") {
          eventForHandlers.sender.sendMessage(`§7Encounter pending - travel to zone first`);
        } else {
          eventForHandlers.sender.sendMessage(`§7Encounter complete - return to board`);
        }
      });
    }

    // Show full encounter state details
    if (eventForHandlers.message === "!encounter state") {
      eventForHandlers.cancel = true;
      system.run(() => {
        const questData = ensureQuestData(eventForHandlers.sender);

        if (!questData?.active?.isEncounter) {
          eventForHandlers.sender.sendMessage(`§cNo active encounter`);
          return;
        }

        const quest = questData.active;
        const progress = questData.progress || 0;

        eventForHandlers.sender.sendMessage(`§e=== Encounter State ===`);
        eventForHandlers.sender.sendMessage(`§fName: ${quest.encounterName}`);
        eventForHandlers.sender.sendMessage(`§fState: ${quest.encounterState}`);
        eventForHandlers.sender.sendMessage(`§fProgress: ${progress}/${quest.totalMobCount}`);

        if (quest.encounterZone) {
          eventForHandlers.sender.sendMessage(`§fZone: ${quest.encounterZone.center.x}, ${quest.encounterZone.center.z}`);
        }
        if (quest.spawnData?.location) {
          const loc = quest.spawnData.location;
          eventForHandlers.sender.sendMessage(`§fSpawn: ${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)}`);
          eventForHandlers.sender.sendMessage(`§fEntity IDs stored: ${quest.spawnData.spawnedEntityIds?.length || 0}`);

          // Count ACTUAL mobs still alive in the world
          const actualCount = countRemainingMobs(quest.id, eventForHandlers.sender.dimension);
          eventForHandlers.sender.sendMessage(`§fActual mobs alive: §c${actualCount}`);
        }
      });
    }

    // ========================================================================
    // === PHASE 5: Navigation & Cleanup Debug Commands ===
    // ========================================================================

    // Test directional arrow calculation
    if (eventForHandlers.message === "!nav test arrow") {
      eventForHandlers.cancel = true;
      system.run(() => {
        const questData = ensureQuestData(eventForHandlers.sender);

        if (!questData?.active?.isEncounter) {
          eventForHandlers.sender.sendMessage(`§cNo active encounter`);
          return;
        }

        const quest = questData.active;
        let target = quest.encounterState === "pending"
          ? quest.encounterZone?.center
          : quest.spawnData?.location;

        if (target) {
          const playerPos = eventForHandlers.sender.location;
          const dx = target.x - playerPos.x;
          const dz = target.z - playerPos.z;
          const targetAngle = Math.atan2(-dx, -dz) * (180 / Math.PI);
          const playerYaw = eventForHandlers.sender.getRotation().y;
          let relativeAngle = targetAngle - playerYaw;
          while (relativeAngle > 180) relativeAngle -= 360;
          while (relativeAngle < -180) relativeAngle += 360;

          const distance = Math.floor(calculateDistance(playerPos, target));
          eventForHandlers.sender.sendMessage(`§e=== Navigation Debug ===`);
          eventForHandlers.sender.sendMessage(`§fTarget: ${Math.floor(target.x)}, ${Math.floor(target.z)}`);
          eventForHandlers.sender.sendMessage(`§fDistance: ${distance}m`);
          eventForHandlers.sender.sendMessage(`§fPlayer facing: ${playerYaw.toFixed(1)}°`);
          eventForHandlers.sender.sendMessage(`§fTarget angle: ${targetAngle.toFixed(1)}°`);
          eventForHandlers.sender.sendMessage(`§fRelative angle: ${relativeAngle.toFixed(1)}°`);
        } else {
          eventForHandlers.sender.sendMessage(`§cNo target location available`);
        }
      });
    }

    // Force orphan cleanup
    if (eventForHandlers.message === "!encounter cleanup") {
      eventForHandlers.cancel = true;
      system.run(() => {
        const count = cleanupOrphanedMobs(ensureQuestData);
        eventForHandlers.sender.sendMessage(`§aCleaned up ${count} orphaned mobs`);
      });
    }

    // === END PHASE 5 DEBUG COMMANDS ===

    if (isCommandMessage) {
      markHandled(eventForHandlers.sender, eventForHandlers.message);
    }
  };

  const chatEvent = world.beforeEvents?.chatSend;
  if (chatEvent?.subscribe) {
    chatEvent.subscribe((ev) => handleChatEvent(ev, true));
  }

  const chatEventAfter = world.afterEvents?.chatSend;
  if (chatEventAfter?.subscribe) {
    chatEventAfter.subscribe((ev) => {
      if (wasHandledRecently(ev.sender, ev.message)) return;
      handleChatEvent(ev, false);
    });
  }
}
