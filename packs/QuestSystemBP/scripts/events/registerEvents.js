/**
 * registerEvents.js
 * Centralized event subscription registration.
 * 
 * This module wires up all world events, system events, and player events
 * to their respective handler functions. Handler functions are passed in
 * via the handlers parameter to avoid circular dependencies.
 * 
 * Event Types Registered:
 * - World lifecycle (worldInitialize)
 * - Player lifecycle (playerSpawn, playerLeave)
 * - Game actions (entityDie, playerBreakBlock)
 * - Custom events (scriptEventReceive for Atlas NPC, admin commands)
 * - UI interactions (block interactions, chat commands)
 */

import { world, system } from "@minecraft/server";

/**
 * Registers all event subscriptions for the quest system.
 * Call this once during bootstrap.
 * 
 * @param {Object} params - Configuration object
 * @param {Object} params.handlers - Handler function references
 * @param {Function} params.handlers.onWorldInitialize - World init handler
 * @param {Function} params.handlers.onPlayerSpawn - Player spawn handler
 * @param {Function} params.handlers.onPlayerLeave - Player leave handler
 * @param {Function} params.handlers.onEntityDeath - Entity death handler
 * @param {Function} params.handlers.onBlockBreak - Block break handler
 * @param {Function} params.handlers.onAtlasInteract - Atlas NPC interaction handler
 * @param {Function} params.handlers.onAdminGiveSP - Admin SP gift command handler
 * @param {Function} params.wireInteractions - Function to wire block/chat interactions
 * @param {Function} params.wireEntityHitTracking - Function to wire entity hit tracking
 */
export function registerEvents({ handlers, wireInteractions, wireEntityHitTracking }) {
  // =============================================================================
  // WORLD LIFECYCLE EVENTS
  // =============================================================================
  
  /**
   * World initialization - runs once when world loads
   * Sets up spawn point, initializes economy systems, starts background tasks
   */
  world.afterEvents.worldInitialize.subscribe(handlers.onWorldInitialize);

  // =============================================================================
  // PLAYER LIFECYCLE EVENTS
  // =============================================================================
  
  /**
   * Player spawn - runs when player joins or respawns
   * Handles initial teleport, SP initialization, quest data loading
   */
  world.afterEvents.playerSpawn.subscribe(handlers.onPlayerSpawn);

  /**
   * Player leave - runs when player disconnects
   * Cleans up music state, despawns cats, handles encounter mob cleanup
   */
  world.afterEvents.playerLeave.subscribe(handlers.onPlayerLeave);

  // =============================================================================
  // GAME ACTION EVENTS
  // =============================================================================
  
  /**
   * Entity death - tracks quest progress for kill quests
   */
  world.afterEvents.entityDie.subscribe(handlers.onEntityDeath);

  /**
   * Block break - tracks quest progress for mining quests
   */
  world.afterEvents.playerBreakBlock.subscribe(handlers.onBlockBreak);

  // =============================================================================
  // INTERACTION EVENTS
  // =============================================================================
  
  /**
   * Wire up block interactions (quest board) and chat commands
   * This function internally subscribes to:
   * - world.beforeEvents.itemUseOn (quest board blocks)
   * - world.beforeEvents.playerInteractWithBlock (quest board with empty hand)
   * - world.beforeEvents.chatSend (chat commands like !encounter, !safezone, etc.)
   */
  wireInteractions();

  /**
   * Wire up entity hit tracking for quest progress
   * This function internally subscribes to:
   * - world.afterEvents.entityHurt (tracks last player to hit entity)
   */
  wireEntityHitTracking();

  // =============================================================================
  // CUSTOM SCRIPT EVENTS (Atlas NPC, Admin Commands, Debug Commands)
  // =============================================================================
  
  /**
   * Atlas NPC interaction
   * Listens for quest:npc_interact event from the Atlas entity
   */
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id === "quest:npc_interact") {
      handlers.onAtlasInteract(ev);
    }
  });

  /**
   * Admin command: sq:givesp
   * Usage: /scriptevent sq:givesp <player|@s> <amount>
   */
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id === "sq:givesp") {
      handlers.onAdminGiveSP(ev);
    }
  });

  /**
   * Admin command: sq:clearleaderboard
   * Usage: /scriptevent sq:clearleaderboard
   */
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id === "sq:clearleaderboard") {
      handlers.onAdminClearLeaderboard(ev);
    }
  });

  // NOTE: Debug/testing commands (sq:test_*, sq:encounter, etc.) will be
  // moved to debug/commands.js in Phase 6. For now they remain in bootstrap.
}
