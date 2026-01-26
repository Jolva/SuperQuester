/**
 * ============================================================================
 * SUPERQUESTER — MAIN ENTRY POINT
 * ============================================================================
 * 
 * AI AGENT ORIENTATION:
 * ---------------------
 * This is the central nervous system of the SuperQuester add-on. It handles:
 *   • Event subscriptions (player spawn, entity death, block break, interactions)
 *   • UI flow (Quest Board tabs, NPC dialogs, quest details)
 *   • Core game logic (quest acceptance, turn-in, progress tracking)
 *   • Ambient systems (town music, atmospheric sounds, cat spawning)
 * 
 * KEY ARCHITECTURE PATTERNS:
 * --------------------------
 * 1. PERSONAL QUEST SYSTEM: Each player has their own quest pool stored in
 *    dynamic properties via PersistenceManager. Call `ensureQuestData(player)`
 *    before any quest operation to get/create their data.
 * 
 * 2. SNAPSHOT RULE: When a player accepts a quest, the ENTIRE quest object is
 *    copied to their saved data. We never reference QuestGenerator after accept.
 * 
 * 3. SP DUAL-STORAGE: Super Points are stored in BOTH scoreboard (display) and
 *    dynamic properties (backup). Use `getSP()` and `modifySP()` helpers.
 * 
 * 4. UI FLOW: showQuestBoard() -> tab functions -> handleUiAction() -> effects
 * 
 * FILE ORGANIZATION (scroll order):
 * ----------------------------------
 *   Lines 1-110:    Imports, constants, configuration
 *   Lines 110-170:  World/player event handlers
 *   Lines 170-380:  State maps, player registry
 *   Lines 380-470:  SP helpers (getSP, modifySP, initializePlayerSP)
 *   Lines 470-700:  Quest data helpers (ensureQuestData, accept, abandon, etc.)
 *   Lines 700-1100: UI functions (tabs, forms, action handlers)
 *   Lines 1100-1350: Leaderboard, celebration, HUD, completion logic
 *   Lines 1350-1520: Entity death, block break, turn-in handlers
 *   Lines 1520-1600: Atlas NPC dialog and tutorial pages
 *   Lines 1600-1710: Block interaction wiring
 *   Lines 1710-2207: bootstrap() with ambient systems (music, dogs, cats)
 * 
 * RELATED FILES:
 * --------------
 *   • safeZone.js — Hub protection (20-block radius)
 *   • systems/PersistenceManager.js — Player data storage
 *   • systems/QuestGenerator.js — Random quest generation
 *   • systems/AtmosphereManager.js — Quest board proximity effects (10-block zone)
 *   • data/QuestData.js — Mob/item pools, lore templates
 * 
 * ============================================================================
 */

import { world, system, ItemStack, DisplaySlotId } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getMobType } from "./features/quests/mobTypes.js";
import { registerSafeZoneEvents, handleSafeZoneCommand } from "./safeZone.js";
import { PersistenceManager } from "./systems/PersistenceManager.js";
import { QuestGenerator } from "./systems/QuestGenerator.js";
import { AtmosphereManager } from "./systems/AtmosphereManager.js";

// SP Economy imports
import {
    initializeSPObjective,
    getSP as getSPFromManager,
    addSP,
    deductSP,
    purchase,
    adminAddSP,
    setModifySPReference
} from "./systems/SPManager.js";

// Celebration System
import {
    celebrateSPGain,
    celebrateQuestComplete
} from "./systems/CelebrationManager.js";

// SP Count-Up Animation
import * as SPAnimator from "./systems/SPAnimator.js";

import {
    calculateCompletionReward,
    rollRarity
} from "./systems/RewardCalculator.js";

import {
    initializeStreakTracking,
    incrementStreak,
    resetAllStreaks,
    getStreakInfo
} from "./systems/StreakTracker.js";

import { COSTS, STREAK_CONFIG } from "./data/EconomyConfig.js";

// === PHASE 1: DATA TABLE IMPORTS ===
import { TEXTURES, CATEGORY_TEXTURES } from "./data/textures.js";
import { tutorials } from "./data/tutorials.js";

// === PHASE 2: EVENT SYSTEM IMPORTS ===
import { registerEvents } from "./events/registerEvents.js";

// === PHASE 3: FEATURE IMPORTS ===
import {
  registerPlayerName,
  lookupPlayerName,
  getLeaderboardEntries,
  showLeaderboardTab,
  getUnknownLeaderboardEntries,
  setPlayerNameRegistryEntry,
  pruneUnknownZeroScoreEntries
} from "./features/leaderboard/leaderboardService.js";

// Quest Board UI and routing
import { BLOCK_MENU_MAP } from "./features/questBoard/routing.js";
import {
  showQuestBoard as showQuestBoardUI,
  showAvailableTab,
  showActiveTab,
  showQuestDetails,
  showManageQuest
} from "./features/questBoard/ui.js";
import { handleUiAction as handleUiActionBase } from "./features/questBoard/actions.js";

// Quest system
import { getQuestIcon as getQuestIconBase, getQuestColors as getQuestColorsBase } from "./features/quests/formatters.js";
import {
  calculateRerollPrice as calculateRerollPriceBase,
  handleRefresh as handleRefreshBase,
  handleQuestAccept as handleQuestAcceptBase,
  handleQuestAbandon as handleQuestAbandonBase
} from "./features/quests/questLifecycle.js";

// HUD system
import { updateSPDisplay as updateSPDisplayBase, updateQuestHud as updateQuestHudBase, sendSPDisplayValue } from "./features/hud/hudManager.js";

// Tutorial system
import {
  showQuestMasterDialog as showQuestMasterDialogBase,
  showTutorialPage as showTutorialPageBase,
  handleAtlasInteract as handleAtlasInteractBase
} from "./features/tutorials/atlasNpc.js";

// Update Sheep NPC
import { handleUpdateSheepInteract } from "./features/updateSheep/updateSheep.js";

// Ambient systems
import { initializeTownMusicLoop, initializeSPSSMusicLoop } from "./features/ambient/music.js";
import { initializeDogBarkingLoop, initializeCatSquadLoop } from "./features/ambient/atmosphericSounds.js";
import { registerChatCommands } from "./features/debug/chatCommands.js";

// Debug commands
import {
  handleBuilderCommand,
  handleForceDailyCommand,
  handleRegisterNamesCommand,
  handleListUnknownLeaderboardCommand,
  handleSetLeaderboardNameCommand,
  handlePruneUnknownLeaderboardCommand,
  handleAdminGiveSP as handleAdminGiveSPBase
} from "./features/debug/commands.js";

// === PHASE 3 & 4: ENCOUNTER SYSTEM IMPORTS ===
// Spawner functions (mob management)
import {
  spawnEncounterMobs,
  despawnEncounterMobs,
  respawnRemainingMobs,
  respawnMissingMobs,
  isEncounterMob,
  getQuestIdFromMob,
  countRemainingMobs,
  initializeEncounterMobProtection,
  cleanupOrphanedMobs
} from "./systems/EncounterSpawner.js";

// Location functions (zone selection, terrain validation)
import {
  selectEncounterZone,
  calculateDistance,
  getQuestBoardPosition,
  getDirection
} from "./systems/LocationValidator.js";

// Proximity monitoring (spawn trigger on zone entry)
import { startProximityMonitoring } from "./systems/EncounterProximity.js";

// =============================================================================
// CONSTANTS — WORLD LOCATIONS
// =============================================================================
// These coordinates define the hub area. If you move the town, update ALL of these!

/** The quest board / town center location. Used for music zone, dog zone, cats. */
const QUEST_BOARD_LOCATION = { x: 72, y: 75, z: -278 };

/** Player spawn point (on staircase facing the quest board). */
const HUB_SPAWN_LOCATION = { x: 84, y: 78, z: -278 };

/** Spawn rotation: yaw=90 means facing West toward the quest board. */
const HUB_SPAWN_ROTATION = { x: 0, y: 90 };

/** Town/music zone radius in blocks (should match safe zone). */
const TOWN_RADIUS = 20;

// =============================================================================
// CONSTANTS — AMBIENT SOUND SYSTEMS
// =============================================================================

// --- Town Music Zone ---
const TOWN_MUSIC_SOUND_ID = "questboard.music.town";
const TRACK_DURATION_TICKS = 880; // ~44 seconds (slight overlap for seamless loop)
const MUSIC_CHECK_INTERVAL = 10;  // Check every 0.5 seconds

// --- SPSS Music Zone (Super Points Super Store) ---
const SPSS_MUSIC_SOUND_ID = "spss.music.store";
const SPSS_TRACK_DURATION_TICKS = 880; // ~44 seconds (adjust based on your track length)
const SPSS_MUSIC_CHECK_INTERVAL = 10;  // Check every 0.5 seconds
// SPSS Zone Boundaries - CUSTOMIZE THESE COORDINATES!
// Define the rectangular area of your SPSS store
const SPSS_ZONE_BOUNDS = {
  minX: 91,   // Replace with your store's minimum X coordinate
  maxX: 102,   // Replace with your store's maximum X coordinate
  minY: 77,   // Replace with your store's minimum Y coordinate (floor level)
  maxY: 85,   // Replace with your store's maximum Y coordinate (ceiling level)
  minZ: -294, // Replace with your store's minimum Z coordinate
  maxZ: -287  // Replace with your store's maximum Z coordinate
};

// --- Dog Barking Zone (comedic escalation near quest board) ---
const DOG_SOUNDS = ["atmosphere.dogs_01", "atmosphere.dogs_02", "atmosphere.dogs_03"];
const MONKEY_SOUNDS = ["atmosphere.monkeys_01"]; // Join the chaos in core zone!
const DOG_CHECK_INTERVAL = 10;  // Check every 0.5 seconds
const DOG_REPLAY_TICKS = 60;    // Replay barking every 3 seconds while in zone

// Distance tiers: The closer to the board, the MORE dogs you hear!
// Far ring (15-20 blocks): 1 track, very faint
// Outer ring (10-15 blocks): 1 track, faint
// Mid-outer ring (6-10 blocks): 2 tracks, gentle
// Mid ring (4-6 blocks): 2 tracks, moderate  
// Inner ring (2-4 blocks): 3 tracks, loud
// Core zone (<2 blocks): 3 tracks, FULL CHAOS + bonus barks
const DOG_DISTANCE_TIERS = [
  { maxDist: 20, tracks: 1, minVol: 0.006, maxVol: 0.012 },  // Far: barely audible
  { maxDist: 15, tracks: 1, minVol: 0.012, maxVol: 0.018 },  // Outer: faint
  { maxDist: 10, tracks: 2, minVol: 0.018, maxVol: 0.03 },   // Mid-outer: gentle
  { maxDist: 6, tracks: 2, minVol: 0.03, maxVol: 0.04 },     // Mid: moderate
  { maxDist: 4, tracks: 3, minVol: 0.04, maxVol: 0.055 },    // Inner: loud
  { maxDist: 2, tracks: 3, minVol: 0.045, maxVol: 0.055 },   // Core: chaos
];
const DOG_MAX_RADIUS = 20; // Full safe zone coverage!

// === CAT PROTECTION SQUAD ===
// Physical cats spawn around players to protect them from the phantom dogs!
// The closer you get to the quest board, the more cats appear
const CAT_CHECK_INTERVAL = 20; // Check every 20 ticks (1 second)
const CAT_MAX_RADIUS = 20; // Full safe zone coverage!
const CAT_SPAWN_RADIUS = 1.5; // How far from player to spawn cats

// === ENCOUNTER PERSISTENCE MONITOR ===
const ENCOUNTER_PERSISTENCE_CHECK_INTERVAL = 200; // 10 seconds
const ENCOUNTER_PERSISTENCE_MAX_DISTANCE = 96; // Only respawn when player is near the spawn area

// Distance tiers: [maxDistance, numberOfCats]
// Expanded to cover full 20-block safe zone!
// Far ring (15-20 blocks): 4 cats - scout squad
// Outer ring (10-15 blocks): 8 cats
// Mid-outer ring (6-10 blocks): 16 cats
// Mid ring (4-6 blocks): 24 cats  
// Inner ring (2-4 blocks): 32 cats
// Core zone (<2 blocks): 40 cats (MAXIMUM PROTECTION)
const CAT_DISTANCE_TIERS = [
  { maxDist: 20, cats: 1 },   // Far: scout cats
  { maxDist: 15, cats: 2 },   // Outer: patrol cats
  { maxDist: 10, cats: 3 },  // Mid-outer: guard cats
  { maxDist: 6, cats: 5 },   // Mid: defensive cats
  { maxDist: 4, cats: 6 },   // Inner: protective cats
  { maxDist: 2, cats: 8 },   // Core: FULL CAT ARMY
];

// Cat variants for variety (Bedrock cat types)
const CAT_VARIANTS = [
  "minecraft:cat_tabby",
  "minecraft:cat_tuxedo",
  "minecraft:cat_red",
  "minecraft:cat_siamese",
  "minecraft:cat_british_shorthair",
  "minecraft:cat_calico",
  "minecraft:cat_persian",
  "minecraft:cat_ragdoll",
  "minecraft:cat_white",
  "minecraft:cat_jellie",
  "minecraft:cat_black"
];

// =============================================================================
// NOTE: World lifecycle event subscriptions have been moved to registerEvents.js (Phase 2)
// - world.afterEvents.worldInitialize → handleWorldInitialize()
// - world.afterEvents.playerSpawn → handlePlayerSpawn()  
// - world.afterEvents.playerLeave → handlePlayerLeave()
// =============================================================================

// Initialize Daily Quests (Global Daily Quests - REMOVED)
// let currentAvailableQuests = QuestGenerator.generateDailyQuests(3);

/** -----------------------------
 *  Config
 *  ----------------------------- */

// NOTE: TEXTURES, CATEGORY_TEXTURES, and tutorials
// have been moved to /data/ modules and imported at the top of this file.

// const MAX_ACTIVE_QUESTS = 2; // REMOVED
const FALLBACK_COMMAND = "!quests";
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const SCOREBOARD_OBJECTIVE_ID = "SuperPoints";
const SCOREBOARD_OBJECTIVE_DISPLAY = "§e★ SP";

/**
 * Textures
 */
const TEXTURES = {
  // Quest Categories
  CATEGORY_UNDEAD: "textures/quest_ui/icon_undead.png",
  CATEGORY_BEAST: "textures/quest_ui/icon_beast.png",
  CATEGORY_MONSTER: "textures/quest_ui/icon_monster.png",
  CATEGORY_PASSIVE: "textures/quest_ui/icon_passive.png",
  CATEGORY_NETHER: "textures/quest_ui/icon_nether.png",
  CATEGORY_AQUATIC: "textures/quest_ui/icon_aquatic.png",
  CATEGORY_GATHERING: "textures/quest_ui/icon_gathering.png",
  CATEGORY_MINING: "textures/quest_ui/icon_mining.png",
  CATEGORY_FARMING: "textures/quest_ui/icon_farming.png",

  // UI Elements
  REFRESH: "textures/quest_ui/icon_refresh.png",
  COMPLETE: "textures/quest_ui/icon_complete.png",
  MYTHIC: "textures/quest_ui/icon_mythic.png",
  LEGENDARY: "textures/quest_ui/icon_legendary.png",
  RARE: "textures/quest_ui/icon_rare.png",
  CLOCK: "textures/quest_ui/icon_clock.png",
  TROPHY: "textures/quest_ui/icon_trophy.png",
  ALERT: "textures/quest_ui/icon_alert.png",
  SP_COIN: "textures/quest_ui/icon_sp_coin.png",
  CROWN: "textures/quest_ui/icon_crown.png",

  // Fallback
  DEFAULT: "textures/items/book_writable",
};

const CATEGORY_TEXTURES = {
  // Kill quest categories
  undead: TEXTURES.CATEGORY_UNDEAD,
  beast: TEXTURES.CATEGORY_BEAST,
  monster: TEXTURES.CATEGORY_MONSTER,
  passive: TEXTURES.CATEGORY_PASSIVE,
  nether: TEXTURES.CATEGORY_NETHER,
  aquatic: TEXTURES.CATEGORY_AQUATIC,

  // Resource quest categories
  gathering: TEXTURES.CATEGORY_GATHERING,
  mining: TEXTURES.CATEGORY_MINING,
  farming: TEXTURES.CATEGORY_FARMING,
};

/**
 * Get icon for a quest based on rarity and category
 * @param {Object} quest - Quest object with category and rarity fields
 * @param {boolean} showRarityBadge - If true, legendary/rare quests show rarity icon instead
 * @returns {string} Texture path
 */
// =============================================================================
// Quest formatting helpers (Phase 4 - Wrappers)
// =============================================================================

// Wrapper functions to inject dependencies
function getQuestIconWrapper(quest, showRarityBadge = false) {
  return getQuestIconBase(quest, showRarityBadge, TEXTURES, CATEGORY_TEXTURES);
}

function getQuestColorsWrapper(rarity) {
  return getQuestColorsBase(rarity);
}

const LEADERBOARD_ENTRY_LIMIT = 10;

// =============================================================================
// IN-MEMORY STATE
// =============================================================================
// These Maps track per-player runtime state. They are NOT persisted across
// server restarts — use PersistenceManager for permanent data!

/** 
 * Tracks which player last hit each entity (for kill quest attribution).
 * Map<entityId, { id: playerId, time: timestamp }>
 * Used by handleEntityDeath to credit the correct player for kills.
 */
const lastHitPlayerByEntityId = new Map();

// === TOWN MUSIC ZONE STATE ===
// Tracks per-player music state: { inZone: boolean, nextReplayTick: number }
const playerMusicState = new Map();

// === SPSS MUSIC ZONE STATE ===
// Tracks per-player SPSS music state: { inZone: boolean, nextReplayTick: number }
const playerSPSSMusicState = new Map();

// === DOG BARKING ZONE STATE ===
// Tracks per-player dog barking state: { inZone: boolean, nextBarkTick: number }
const playerDogBarkState = new Map();

// === CAT PROTECTION SQUAD STATE ===
// Tracks per-player spawned cats: { cats: Entity[], lastTier: number }
const playerCatSquad = new Map();

// === QUEST DATA CACHE ===
// In-memory cache of player quest data to prevent race conditions on rapid updates.
// Map<playerId, QuestData>
// Loaded from dynamic properties on player join, updated on every quest change,
// and saved back to dynamic properties. This prevents multiple rapid events
// (like killing 9 mobs quickly) from overwriting each other's progress.
const playerQuestDataCache = new Map();

// === PLAYER NAME REGISTRY ===
// Stores player names in world dynamic properties so leaderboard can display
// correct names even when players are offline.
const PLAYER_NAME_REGISTRY_KEY = "superquester:player_names";









/** -----------------------------
 *  Super Points (SP) Helpers
 *  ----------------------------- */

/**
 * Gets a player's current SP balance.
 * Reads from scoreboard (authoritative source).
 * 
 * @param {import("@minecraft/server").Player} player
 * @returns {number}
 */
function getSP(player) {
  const objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE_ID);
  if (!objective || !player.scoreboardIdentity) return 0;
  return objective.getScore(player.scoreboardIdentity) ?? 0;
}

/**
 * Modifies a player's Super Points balance.
 * Updates both the scoreboard (authoritative) and dynamic property backup.
 *
 * @param {import("@minecraft/server").Player} player - The player to modify
 * @param {number} delta - Amount to add (positive) or subtract (negative)
 * @param {Object} options - Optional configuration (e.g., skipCelebration)
 * @returns {number} The new balance
 */
function modifySP(player, delta, options = {}) {
  const objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE_ID);
  if (!objective) {
    console.warn("[SP] Cannot modify SP - objective not found");
    return 0;
  }

  // Capture old value BEFORE modification for animation
  let current = 0;
  if (player.scoreboardIdentity) {
    current = objective.getScore(player.scoreboardIdentity) ?? 0;
  }
  const oldValue = current;

  // Calculate new balance (floor at 0)
  const newBalance = Math.max(0, current + delta);

  // Update scoreboard
  objective.setScore(player, newBalance);

  // Ensure player is registered in leaderboard name registry
  // This is critical for script events that modify SP directly
  registerPlayerName(player);

  // Update backup in dynamic properties using cache
  const data = ensureQuestData(player);
  if (data) {
    data.currentSP = newBalance;
    PersistenceManager.saveQuestData(player, data);
  }

  // Animated display update for gains, instant for losses
  if (delta > 0) {
    updateSPDisplay(player, newBalance, { 
      animate: true, 
      oldValue: oldValue 
    });
  } else {
    updateSPDisplay(player, newBalance, { animate: false });
  }

  // Celebration feedback for SP gains (with delay to let animation start)
  if (delta > 0 && !options.skipCelebration) {
    system.runTimeout(() => {
      celebrateSPGain(player, delta);
    }, 5);  // 5-tick delay (~0.25s) to coordinate with count-up
  }

  return newBalance;
}

// Export modifySP for SPManager to wrap
export { modifySP };

// Set modifySP reference in SPManager so it can wrap this function
setModifySPReference(modifySP);

/**
 * Initializes a player's SP on join.
 * Handles recovery from backup if scoreboard was wiped.
 * 
 * @param {import("@minecraft/server").Player} player
 */
function initializePlayerSP(player) {
  const objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE_ID);
  if (!objective) return;

  const data = PersistenceManager.loadQuestData(player);

  // Get scoreboard value (may need identity to exist first)
  let scoreboardSP = 0;
  if (player.scoreboardIdentity) {
    scoreboardSP = objective.getScore(player.scoreboardIdentity) ?? 0;
  }

  // Get backup value
  const backupSP = data?.currentSP ?? 0;

  // Recovery: if scoreboard is 0 but backup has value, restore
  if (scoreboardSP === 0 && backupSP > 0) {
    objective.setScore(player, backupSP);
    console.warn(`[SuperQuester] Restored ${player.name}'s SP from backup: ${backupSP}`);
  }

  // Ensure backup is in sync (covers new players and normal cases)
  if (data && scoreboardSP > 0 && backupSP !== scoreboardSP) {
    data.currentSP = scoreboardSP;
    PersistenceManager.saveQuestData(player, data);
  }
}

/**
 * SP HUD DISPLAY SYSTEM
 * =====================
 * Sends the player's SP value via titleraw for JSON UI display.
 *
 * TITLE BRIDGE PROTOCOL:
 * - Format: "SPVAL:XX"
 * - JSON UI binds to #hud_title_text_string and extracts the number
 *
 * HOW IT WORKS:
 * 1. Script API sends "SPVAL:XX" via titleraw (invisible, 1 tick duration)
 * 2. JSON UI (hud_screen.json) binds to #hud_title_text_string (global)
 * 3. String extraction: strips "SPVAL:" prefix to display the number
 * 4. Result: Custom HUD shows static coin + number
 *
 * PHASE 3: NOW WITH ANIMATION!
 * - Supports animated count-up via SPAnimator
 * - Pass options.animate = true for count-up effect
 * - Pass options.oldValue for starting point
 *
 * @param {import("@minecraft/server").Player} player
 * @param {number} value - SP value to display (if not animating, reads from scoreboard)
 * @param {Object} options - Animation options
 * @param {boolean} options.animate - Whether to animate the change
 * @param {number} options.oldValue - Previous value (required if animate=true)
 */
// =============================================================================
// =============================================================================
// HUD Management (Phase 4 - Wrappers)
// =============================================================================

/**
 * Updates SP display with animation support - wrapper
 */
function updateSPDisplay(player, value, options = {}) {
  return updateSPDisplayBase(player, value, options, getSP, SPAnimator);
}

/** -----------------------------
 *  State helpers
 *  ----------------------------- */

function getPlayerKey(player) {
  // Use name as requested for persistence across simple reloads if needed, though ID is safer usually.
  return player.name;
}

/**
 * Ensures player has valid quest data, creating or refreshing as needed.
 * Call this before any quest system access.
 *
 * IMPORTANT: Uses in-memory cache to prevent race conditions on rapid updates.
 * Multiple rapid kills (e.g., 9 mobs dying quickly) will all see the same
 * cached object instead of reloading stale data from disk.
 *
 * @param {import("@minecraft/server").Player} player
 * @returns {QuestData}
 */
function ensureQuestData(player) {
  // Check cache first to prevent race conditions
  if (playerQuestDataCache.has(player.id)) {
    return playerQuestDataCache.get(player.id);
  }

  // Not in cache - load from persistence
  let data = PersistenceManager.loadQuestData(player);

  if (!data) {
    // Check for old format
    const oldQuests = PersistenceManager.loadQuests(player);  // Old method

    if (oldQuests && oldQuests.length > 0) {
      // MIGRATE: Convert old format to new
      data = {
        available: QuestGenerator.generateDailyQuests(3),
        active: oldQuests[0] || null,  // Take first old quest as active
        progress: oldQuests[0]?.progress || 0,
        lastRefreshTime: Date.now(),
        lastCompletionTime: 0,  // Track last quest completion for first-of-day bonus
        freeRerollAvailable: true,
        paidRerollsThisCycle: 0,
        lifetimeCompleted: 0,
        currentSP: 0,  // Backup of SP balance (synced with scoreboard)
        updateSheepTOSAccepted: false,  // Update Sheep TOS acceptance status
        updateSheepTOSPrompted: false   // Tracks if player has seen TOS before
      };

      // Clear old data
      PersistenceManager.wipeData(player);
      PersistenceManager.saveQuestData(player, data);

      player.sendMessage("§e⚡ Quest system upgraded! Your progress has been preserved.§r");
    } else {
      // Truly new player — create fresh
      data = {
        available: QuestGenerator.generateDailyQuests(3),
        active: null,
        progress: 0,
        lastRefreshTime: Date.now(),
        lastCompletionTime: 0,  // Track last quest completion for first-of-day bonus
        freeRerollAvailable: true,  // Start with 1 free reroll
        paidRerollsThisCycle: 0,
        lifetimeCompleted: 0,
        currentSP: 0,  // Backup of SP balance (synced with scoreboard)
        updateSheepTOSAccepted: false,  // Update Sheep TOS acceptance status
        updateSheepTOSPrompted: false   // Tracks if player has seen TOS before
      };

      PersistenceManager.saveQuestData(player, data);
      console.warn(`[QuestSystem] Initialized quest data for ${player.name}`);
    }

    // Cache the new data
    playerQuestDataCache.set(player.id, data);
    return data;
  }

  // CASE 2: Existing player — check 24h expiry
  const hoursSinceRefresh = Date.now() - data.lastRefreshTime;

  if (hoursSinceRefresh >= TWENTY_FOUR_HOURS_MS) {
    // Auto-refresh: full wipe (even incomplete quests)
    data.available = QuestGenerator.generateDailyQuests(3);
    data.active = null;
    data.progress = 0;
    data.lastRefreshTime = Date.now();
    data.paidRerollsThisCycle = 0;  // Reset pricing
    // NOTE: freeRerollAvailable unchanged — don't grant on timer

    // Reset streak tracking on new day
    if (STREAK_CONFIG.resetOnNewDay) {
      resetAllStreaks();
    }

    PersistenceManager.saveQuestData(player, data);

    player.sendMessage("§e⏰ Your daily quests have refreshed!§r");
    console.warn(`[QuestSystem] Auto-refreshed quests for ${player.name} (24h expired)`);
  }

  // Cache the loaded/refreshed data
  playerQuestDataCache.set(player.id, data);
  return data;
}

// === DAILY COMPLETION TRACKING ===
// Uses timestamp comparison aligned with quest refresh system

/**
 * Checks if player has completed a quest today.
 * Uses timestamp comparison aligned with quest refresh system.
 * @param {import("@minecraft/server").Player} player
 * @returns {boolean} True if player completed a quest in last 24 hours
 */
function hasCompletedQuestToday(player) {
  const data = ensureQuestData(player);
  if (!data.lastCompletionTime) return false;

  const timeSinceCompletion = Date.now() - data.lastCompletionTime;
  return timeSinceCompletion < TWENTY_FOUR_HOURS_MS;
}

/**
 * Marks that player has completed a quest.
 * Records timestamp for first-of-day bonus tracking.
 * @param {import("@minecraft/server").Player} player
 */
function markDailyCompletion(player) {
  const data = ensureQuestData(player);
  data.lastCompletionTime = Date.now();
  PersistenceManager.saveQuestData(player, data);
}

// =============================================================================
// Quest Lifecycle (Phase 4 - Wrappers)
// =============================================================================

/**
 * Calculates SP cost for the next paid reroll - wrapper
 */
function calculateRerollPrice(paidRerollsThisCycle) {
  return calculateRerollPriceBase(paidRerollsThisCycle, COSTS);
}

/**
 * Handles the refresh/reroll button click - wrapper
 */
function handleRefresh(player) {
  const deps = {
    ensureQuestData,
    QuestGenerator,
    PersistenceManager,
    purchase,
    COSTS
  };
  return handleRefreshBase(player, deps);
}

/**
 * Accepts a quest from the available pool - wrapper
 */
function handleQuestAccept(player, questIndex) {
  const deps = {
    ensureQuestData,
    PersistenceManager,
    selectEncounterZone,
    getQuestBoardPosition,
    calculateDistance,
    getDirection,
    world,
    updateQuestHud
  };
  return handleQuestAcceptBase(player, questIndex, deps);
}

/**
 * Abandons the active quest - wrapper
 */
function handleQuestAbandon(player) {
  const deps = {
    ensureQuestData,
    PersistenceManager,
    world,
    despawnEncounterMobs
  };
  return handleQuestAbandonBase(player, deps);
}

/** -----------------------------
 *  Quest Board UI (Phase 3B - Wrappers)
 *  ----------------------------- */

// Wrapper functions to inject dependencies into the extracted UI modules
// These maintain the same external API while delegating to extracted code

/**
 * Main Quest Board display - wrapper for extracted UI module
 */
async function showQuestBoard(player, forcedTab = null, isStandalone = false, playOpenSound = true) {
  const deps = {
    TEXTURES,
    TWENTY_FOUR_HOURS_MS,
    ensureQuestData,
    calculateRerollPrice,
    getQuestIcon: getQuestIconWrapper,
    getQuestColors: getQuestColorsWrapper,
    showLeaderboardTab,
    getLeaderboardEntries,
    handleQuestAbandon
  };
  
  await showQuestBoardUI(player, forcedTab, isStandalone, playOpenSound, deps, handleUiAction);
}

/**
 * UI action handler - wrapper for extracted actions module
 */
async function handleUiAction(player, action) {
  const deps = {
    getQuestColors: getQuestColorsWrapper,
    handleRefresh,
    handleQuestAccept,
    ensureQuestData,
    handleQuestAbandon
  };
  
  await handleUiActionBase(player, action, deps, showQuestBoard, 
    (player, questIndex, isStandalone) => showQuestDetails(player, questIndex, isStandalone, deps, showQuestBoard, handleUiAction),
    (player, isStandalone) => showManageQuest(player, isStandalone, deps, showQuestBoard)
  );
}

/** -----------------------------
 *  Leaderboard Logic
 *  ----------------------------- */

/** -----------------------------
 *  Kill/Event Logic
 *  ----------------------------- */

/**
 * Triggers celebration effects when player completes all 3 quests.
 * @param {import("@minecraft/server").Player} player
 * @param {number} spEarned - SP from the final quest (for message)
 */
function triggerQuestClearCelebration(player, spEarned) {
  const pos = player.location;
  const dim = player.dimension;

  // === PHASE 1: Immediate Impact (0ms) ===

  // Visual: Totem-style particle burst
  dim.spawnParticle("minecraft:totem_particle", pos);

  // Audio: Triumphant fanfare for all quests complete
  player.playSound("quest.complete_all", { location: pos, volume: 1.0, pitch: 1.0 });

  // Title card
  player.onScreenDisplay.setTitle("§6§l★ ALL QUESTS COMPLETE ★", {
    subtitle: "§a3 new quests available! §7(+1 free reroll)",
    fadeInDuration: 10,   // 0.5 sec
    stayDuration: 60,     // 3 sec
    fadeOutDuration: 20   // 1 sec
  });

  // === PHASE 2: Accent (0.5 sec) ===

  system.runTimeout(() => {
    player.playSound("random.orb", { location: pos, volume: 0.5, pitch: 1.5 });
    dim.spawnParticle("minecraft:villager_happy", {
      x: pos.x + 1, y: pos.y + 1, z: pos.z
    });
    dim.spawnParticle("minecraft:villager_happy", {
      x: pos.x - 1, y: pos.y + 1, z: pos.z
    });
  }, 10);  // 10 ticks = 0.5 sec

  // === PHASE 3: Flourish (1 sec) ===

  system.runTimeout(() => {
    player.playSound("ui.toast.challenge_complete", { location: pos, volume: 0.8, pitch: 1.0 });
  }, 20);  // 20 ticks = 1 sec

  // === Chat Message (persistent record) ===

  player.sendMessage("§6═══════════════════════════════════════");
  player.sendMessage("§6       ★ DAILY QUESTS CLEARED! ★");
  player.sendMessage("§a       3 new quests are ready!");
  player.sendMessage("§7       Free reroll earned for next time.");
  player.sendMessage(`§e       (+${spEarned} SP from final quest)`);
  player.sendMessage("§6═══════════════════════════════════════");
}

/**
 * Updates quest HUD - wrapper for extracted HUD module
 */
function updateQuestHud(player, questState) {
  return updateQuestHudBase(player, questState);
}

/**
 * Handles instant quest completion with immediate rewards.
 * This replaces the old turn-in system - rewards are now given immediately when quest objectives are completed.
 * @param {Player} player - The player who completed the quest
 * @param {Object} questState - The quest that was completed
 */
function markQuestComplete(player, questState) {
  const data = ensureQuestData(player);
  if (!data.active || data.active.id !== questState.id) {
    console.warn(`[markQuestComplete] Quest mismatch or no active quest for player ${player.name}`);
    return;
  }

  const quest = data.active;
  
  // === GATHER QUEST ITEM CONSUMPTION ===
  // For gather quests, we need to consume the required items from inventory
  if (quest.type === "gather" && quest.targetItemIds) {
    const inventory = player.getComponent("inventory")?.container;
    if (!inventory) {
      console.warn(`[markQuestComplete] No inventory found for gather quest completion`);
      return;
    }

    // Count available items
    let totalCount = 0;
    for (let i = 0; i < inventory.size; i++) {
      const item = inventory.getItem(i);
      if (item && quest.targetItemIds.includes(item.typeId)) {
        totalCount += item.amount;
      }
    }

    if (totalCount < quest.requiredCount) {
      // This shouldn't happen if called correctly, but safety check
      console.warn(`[markQuestComplete] Insufficient items for gather quest: ${totalCount}/${quest.requiredCount}`);
      return;
    }

    // Consume the required items
    let remainingToRemove = quest.requiredCount;
    for (let i = 0; i < inventory.size; i++) {
      if (remainingToRemove <= 0) break;
      const item = inventory.getItem(i);
      if (item && quest.targetItemIds.includes(item.typeId)) {
        if (item.amount <= remainingToRemove) {
          remainingToRemove -= item.amount;
          inventory.setItem(i, undefined);
        } else {
          item.amount -= remainingToRemove;
          remainingToRemove = 0;
          inventory.setItem(i, item);
        }
      }
    }
    
    // Notify player about item consumption
    const itemNames = quest.targetItemIds.map(id => id.replace("minecraft:", "").replace(/_/g, " ")).join(", ");
    player.sendMessage(`§7Consumed: ${quest.requiredCount}x ${itemNames}§r`);
  }

  // === ENCOUNTER CLEANUP ===
  // Despawn remaining encounter mobs if this is an encounter quest
  if (quest.isEncounter && quest.spawnData) {
    try {
      const dimension = world.getDimension(quest.spawnData.dimensionId || "overworld");
      const despawnedCount = despawnEncounterMobs(quest.id, dimension);
      if (despawnedCount > 0) {
        console.log(`[markQuestComplete] Despawned ${despawnedCount} remaining mobs for quest ${quest.id}`);
      }
    } catch (error) {
      console.error(`[markQuestComplete] Error despawning encounter mobs: ${error}`);
    }
  }

  // === REWARD CALCULATION AND DISTRIBUTION ===
  const reward = quest.reward;
  const questBaseSP = reward?.scoreboardIncrement ?? 0;
  const isFirstOfDay = !hasCompletedQuestToday(player);

  const rewardResult = calculateCompletionReward(
    questBaseSP,
    quest.rarity,
    player,
    isFirstOfDay
  );

  // Award SP
  if (rewardResult.finalAmount > 0) {
    addSP(player, rewardResult.finalAmount, { skipCelebration: true });
    
    // Trigger celebration with small delay to ensure SP display updates first
    system.runTimeout(() => {
      celebrateQuestComplete(player, {
        rarity: quest.rarity,
        spAmount: rewardResult.finalAmount,
        isJackpot: rewardResult.isJackpot || false,
        streakLabel: rewardResult.streakLabel || null
      });
    }, 3);
  }

  // Increment streak
  incrementStreak(player);

  // Mark daily completion
  markDailyCompletion(player);

  // Display reward message
  player.sendMessage(rewardResult.message);

  // Play jackpot sound if triggered
  if (rewardResult.isJackpot) {
    player.playSound("random.levelup", { volume: 1.0, pitch: 1.2 });
  }

  // Award item rewards
  if (reward && reward.rewardItems) {
    const inventory = player.getComponent("inventory")?.container;
    if (inventory) {
      for (const rItem of reward.rewardItems) {
        try {
          const itemStack = new ItemStack(rItem.typeId, rItem.amount);
          inventory.addItem(itemStack);
          player.sendMessage(`§aReceived: ${rItem.amount}x ${rItem.typeId.replace("minecraft:", "")}§r`);
        } catch (e) {
          // Inventory full — drop at feet
          player.dimension.spawnItem(new ItemStack(rItem.typeId, rItem.amount), player.location);
          player.sendMessage(`§eInventory full! Dropped: ${rItem.amount}x ${rItem.typeId.replace("minecraft:", "")}§r`);
        }
      }
    }
  }

  // Update stats
  data.lifetimeCompleted += 1;

  // Clear active quest
  data.active = null;
  data.progress = 0;

  // === CHECK FOR ALL QUESTS COMPLETE ===
  const allComplete = data.available.every(slot => slot === null);

  if (allComplete) {
    // All 3 quests completed! Auto-generate new quests and trigger celebration
    data.available = QuestGenerator.generateDailyQuests(3);
    data.lastRefreshTime = Date.now();
    data.freeRerollAvailable = true;
    data.paidRerollsThisCycle = 0;

    PersistenceManager.saveQuestData(player, data);

    // Trigger all-quests-complete celebration
    triggerQuestClearCelebration(player, rewardResult.finalAmount);
    player.sendMessage("§6§l★ ALL QUESTS COMPLETE! ★§r");
    player.sendMessage("§eFresh quests have been generated. Check the Quest Board!§r");
  } else {
    // Normal completion
    PersistenceManager.saveQuestData(player, data);

    const colors = getQuestColorsWrapper(quest.rarity);
    player.sendMessage(`§a✓ Quest Complete: ${colors.chat}${quest.title}§r`);
    player.playSound("quest.complete_single", { volume: 1.0, pitch: 1.0 });
    player.dimension.spawnParticle("minecraft:villager_happy", player.location);
  }

  // Clear HUD
  player.onScreenDisplay?.setActionBar?.("");
}

function handleEntityDeath(ev) {
  const { damageSource, deadEntity } = ev;
  if (!deadEntity) return;

  // ========================================================================
  // PHASE 2: ENCOUNTER SYSTEM - Kill Tracking via Tags
  // ========================================================================
  // Check if this is an encounter mob FIRST, before standard kill quest logic.
  // Encounter mobs use tag-based tracking instead of entity type matching.
  //
  // KILL ATTRIBUTION MODEL (Phase 2):
  // - ANY death of an encounter mob counts (player kill, environmental, etc.)
  // - No need to check who killed it - just increment quest progress
  // - Find quest owner by iterating all players (acceptable for small server)
  //
  // WORKFLOW:
  // 1. Check if dead entity has encounter mob tag
  // 2. Extract quest ID from entity tags
  // 3. Find player who owns that quest
  // 4. Increment their progress
  // 5. Notify player and check for completion
  // 6. Return early to skip standard kill quest logic
  //
  // IMPORTANT: This block runs BEFORE the killer check, so environmental
  // kills (lava, fall damage) are properly attributed to the quest owner.
  // ========================================================================
  if (isEncounterMob(deadEntity)) {
    const questId = getQuestIdFromMob(deadEntity);

    if (questId) {
      // Find which player owns this quest
      // For small servers (3 players), iterating is acceptable
      // For larger servers, consider a lookup table: questId -> playerId
      for (const player of world.getPlayers()) {
        const questData = ensureQuestData(player);

        // Check if this player owns the encounter quest
        if (questData.active &&
            questData.active.isEncounter &&
            questData.active.id === questId) {

          // Increment progress
          questData.progress++;

          // Calculate remaining mobs
          const remaining = questData.active.totalMobCount - questData.progress;

          // Notify player of progress
          if (remaining > 0) {
            player.sendMessage(`§a${questData.active.encounterName}: §f${questData.progress}/${questData.active.totalMobCount} §7(${remaining} remaining)`);
            player.playSound("quest.progress_tick", { volume: 0.6, pitch: 1.0 });
          } else {
            // All mobs killed - quest complete!
            questData.active.encounterState = "complete";  // Phase 3: State transition
            player.sendMessage(`§a${questData.active.encounterName}: §6COMPLETE!`);
            player.playSound("random.levelup");
            markQuestComplete(player, questData.active);
          }

          // HUD updates for encounter quests are handled by EncounterProximity
          // No need to call updateQuestHud here

          // Save progress
          PersistenceManager.saveQuestData(player, questData);

          // Only one player can own this quest - stop searching
          break;
        }
      }
    }

    // Encounter mob handled - skip standard kill quest logic
    return;
  }
  // === END ENCOUNTER KILL TRACKING ===

  const fullId = deadEntity.typeId;
  const simpleId = fullId.replace("minecraft:", "");
  const mobType = getMobType(deadEntity);

  // console.warn(`[DEBUG] Entity Died: ${fullId}`);

  let killer = damageSource?.damagingEntity;

  // Track indirect kills via map
  if (!killer || killer.typeId !== "minecraft:player") {
    const entry = lastHitPlayerByEntityId.get(deadEntity.id);
    if (entry) {
      const candidate = world.getPlayers().find((p) => p.id === entry.id);
      if (candidate) killer = candidate;
    }
  }
  lastHitPlayerByEntityId.delete(deadEntity.id);

  if (!killer || killer.typeId !== "minecraft:player") return;

  const data = ensureQuestData(killer);
  if (!data.active) return;

  const quest = data.active;
  if (quest.type !== "kill") return;

  // Check if already complete
  if (data.progress >= quest.requiredCount) return;

  // Support Array from persistence (JSON) -> Convert to Set for lookup
  const rawTargets = quest.targets || [];
  // If it was saved as {} (Set bug), treat as empty array
  const targets = (Array.isArray(rawTargets) || rawTargets instanceof Set) ? new Set(rawTargets) : new Set();

  let match = false;
  if (targets && targets.has(fullId)) match = true;
  if (targets && targets.has(simpleId)) match = true;
  if (targets && mobType && targets.has(mobType)) match = true;

  if (!match) return;

  data.progress += 1;

  // Play progress tick sound (randomly selects from 5 variants)
  killer.playSound("quest.progress_tick", { volume: 0.6, pitch: 1.0 });

  // console.warn(`[DEBUG] Progress Update: ${data.progress}/${quest.requiredCount}`);

  if (data.progress >= quest.requiredCount) {
    data.progress = quest.requiredCount;
    markQuestComplete(killer, quest);
  } else {
    updateQuestHud(killer, { ...quest, progress: data.progress, goal: quest.requiredCount, status: "active" });
  }
  PersistenceManager.saveQuestData(killer, data);
}

function handleBlockBreak(ev) {
  const { player, brokenBlockPermutation } = ev;
  const data = ensureQuestData(player);
  if (!data.active) return;

  const quest = data.active;
  if (quest.type !== "mine") return;
  if (data.progress >= quest.requiredCount) return;

  const blockId = brokenBlockPermutation.type.id;

  if (!quest.targetBlockIds?.includes(blockId)) return;

  data.progress += 1;

  // Play progress tick sound (randomly selects from 5 variants)
  player.playSound("quest.progress_tick", { volume: 0.6, pitch: 1.0 });

  // console.warn(`[DEBUG] Mine Progress: ${data.progress}/${quest.requiredCount}`);

  if (data.progress >= quest.requiredCount) {
    data.progress = quest.requiredCount;
    markQuestComplete(player, quest);
  } else {
    updateQuestHud(player, { ...quest, progress: data.progress, goal: quest.requiredCount, status: "active" });
  }
  PersistenceManager.saveQuestData(player, data);
}

function wireEntityHitTracking() {
  const hitEvent = world.afterEvents?.entityHit;
  if (!hitEvent?.subscribe) return;
  hitEvent.subscribe((ev) => {
    const { entity, hitEntity } = ev;
    if (!entity || entity.typeId !== "minecraft:player") return;
    if (!hitEntity) return;
    lastHitPlayerByEntityId.set(hitEntity.id, { id: entity.id, time: Date.now() });
  });
}

/**
 * Shows the Atlas NPC dialog - wrapper
 */
function showQuestMasterDialog(player) {
  const deps = {
    TEXTURES,
    showQuestBoard
  };
  return showQuestMasterDialogBase(player, deps, showTutorialPage);
}

/**
 * Shows a tutorial page - wrapper
 */
function showTutorialPage(player, topic) {
  const deps = {
    tutorials
  };
  return showTutorialPageBase(player, topic, deps, showQuestMasterDialog);
}

/** -----------------------------
 *  Interaction & Wiring
 *  ----------------------------- */

// NOTE: BLOCK_MENU_MAP moved to features/questBoard/routing.js (Phase 3B)

const lastInteractTime = new Map();
const builderModePlayers = new Set();

function wireInteractions() {
  const handleInteraction = (player, block) => {
    if (!player || !block) return false;

    // Builder Mode check
    if (builderModePlayers.has(player.name)) return false;

    // Sneaking lets you place blocks/interact normally (Bypass UI)
    if (player.isSneaking) return false;

    // Check if it's our block FIRST
    const menuType = BLOCK_MENU_MAP[block.typeId];
    if (!menuType) return false;

    // Debounce only for our blocks
    const now = Date.now();
    const lastTime = lastInteractTime.get(player.name) || 0;
    if (now - lastTime < 500) return true; // Blocked (ignored) but return true to say "handled/cancel"
    lastInteractTime.set(player.name, now);

    // Save Board Location
    if (!world.getDynamicProperty("superquester:board_location") || player.isSneaking) {
      world.setDynamicProperty("superquester:board_location", JSON.stringify(block.location));
    }

    // Open quest board (Defer to next tick to avoid Restricted Execution error)
    system.run(() => showQuestBoard(player, menuType, true)); // true = standalone
    return true;
  };

  const itemUseOn = world.beforeEvents?.itemUseOn;
  if (itemUseOn) {
    itemUseOn.subscribe((ev) => {
      if (handleInteraction(ev.source, ev.block)) {
        ev.cancel = true;
      }
    });
  }

  const interact = world.beforeEvents?.playerInteractWithBlock;
  if (interact) {
    interact.subscribe((ev) => {
      if (handleInteraction(ev.player, ev.block)) {
        ev.cancel = true;
      }
    });
  }

  registerChatCommands({
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
  });
}

// =============================================================================
// EVENT HANDLER FUNCTIONS (PHASE 2)
// =============================================================================
// These functions are called by registerEvents.js

/**
 * World initialize handler - runs once when world loads
 */
function handleWorldInitialize() {
  console.warn('Quest System BP loaded successfully');
  world.setDefaultSpawnLocation(HUB_SPAWN_LOCATION);

  // Initialize SP economy systems
  initializeSPObjective();
  initializeStreakTracking();

  // Phase 3: Start encounter proximity monitoring
  startProximityMonitoring(ensureQuestData);

  // Initialize encounter mob protection (fire damage blocked for tagged mobs)
  initializeEncounterMobProtection();

  // Phase 5: Clean up orphaned encounter mobs from crashes
  // IMPORTANT: Delay cleanup to give players time to join first
  system.runTimeout(() => {
    cleanupOrphanedMobs(ensureQuestData);
  }, 100); // 5 second delay (100 ticks)

  // Encounter persistence monitor (respawn missing mobs mid-mission)
  startEncounterPersistenceMonitor();
}

/**
 * Periodically ensure encounter mobs persist near the player
 * If mobs despawn naturally or due to chunk issues, respawn missing count
 */
function startEncounterPersistenceMonitor() {
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      const data = ensureQuestData(player);
      const quest = data?.active;

      if (!quest?.isEncounter) continue;
      if (quest.encounterState !== "spawned") continue;
      if (!quest.spawnData?.location) continue;

      const progress = data.progress || 0;
      const remainingExpected = quest.totalMobCount - progress;
      if (remainingExpected <= 0) continue;

      const dimensionId = quest.spawnData.dimensionId || player.dimension.id || "overworld";
      if (player.dimension.id !== dimensionId) continue;

      const distanceToSpawn = calculateDistance(player.location, quest.spawnData.location);
      if (distanceToSpawn > ENCOUNTER_PERSISTENCE_MAX_DISTANCE) continue;

      const dimension = player.dimension;
      const alive = countRemainingMobs(quest.id, dimension);

      if (alive < remainingExpected) {
        const missing = remainingExpected - alive;
        const respawnedIds = respawnMissingMobs(quest, missing, dimension);

        if (respawnedIds.length > 0) {
          quest.spawnData.spawnedEntityIds = [
            ...(quest.spawnData.spawnedEntityIds || []),
            ...respawnedIds
          ];
          PersistenceManager.saveQuestData(player, data);
          console.log(`[EncounterPersistence] Respawned ${respawnedIds.length}/${missing} missing mobs for quest ${quest.id}`);
        }
      }
    }
  }, ENCOUNTER_PERSISTENCE_CHECK_INTERVAL);
}

/**
 * Player spawn handler - runs when player joins or respawns
 */
function handlePlayerSpawn(ev) {
  const { player, initialSpawn } = ev;

  // Only force teleport to hub on INITIAL spawn (first time joining)
  if (initialSpawn) {
    system.runTimeout(() => {
      try {
        player.teleport(HUB_SPAWN_LOCATION, {
          rotation: HUB_SPAWN_ROTATION,
          checkForBlocks: true
        });
      } catch (e) {
        console.warn(`[Spawn] Failed to teleport ${player.name}: ${e}`);
      }
    }, 5);
  }

  // Register player name for leaderboard + initialize SP
  system.runTimeout(() => {
    registerPlayerName(player);
    initializePlayerSP(player);

    system.runTimeout(() => {
      updateSPDisplay(player);
    }, 20);
  }, 10);

  // Load quest data
  system.runTimeout(() => {
    const data = ensureQuestData(player);

    // Resume HUD if player has an active quest
    if (data && data.active) {
      const quest = data.active;
      if ((quest.type === "kill" || quest.type === "mine") && data.progress < quest.requiredCount) {
        updateQuestHud(player, {
          ...quest,
          progress: data.progress,
          goal: quest.requiredCount,
          status: "active"
        });
      }
    }

    // Encounter restoration on login
    if (initialSpawn && data?.active?.isEncounter) {
      const quest = data.active;
      const progress = data.progress || 0;

      switch (quest.encounterState) {
        case "pending":
          if (quest.encounterZone) {
            const zone = quest.encounterZone;
            player.sendMessage(`§eYou have an active encounter: §f${quest.encounterName}`);
            player.sendMessage(`§7Travel to zone: ${zone.center.x}, ${zone.center.z}`);
          }
          break;

        case "spawned":
          if (quest.spawnData?.location) {
            const remaining = quest.totalMobCount - progress;

            if (remaining > 0) {
              const dimension = player.dimension;
              const entityIds = respawnRemainingMobs(quest, progress, dimension);

              quest.spawnData.spawnedEntityIds = entityIds;
              PersistenceManager.saveQuestData(player, data);

              player.sendMessage(`§eYour encounter persists. §f${remaining} enemies remain.`);
              player.sendMessage(`§7Location: ${Math.floor(quest.spawnData.location.x)}, ${Math.floor(quest.spawnData.location.y)}, ${Math.floor(quest.spawnData.location.z)}`);
            } else {
              quest.encounterState = "complete";
              PersistenceManager.saveQuestData(player, data);
              player.sendMessage(`§a${quest.encounterName} §fis complete! Return to the board.`);
            }
          }
          break;

        case "complete":
          player.sendMessage(`§a${quest.encounterName} §fis complete! Return to the board to claim your reward.`);
          break;
      }
    }
  }, 15);
}

/**
 * Player leave handler - cleans up music state, cats, encounters
 */
function handlePlayerLeave(ev) {
  const playerId = ev.playerId;
  playerMusicState.delete(playerId);
  playerDogBarkState.delete(playerId);
  const cachedQuestData = playerQuestDataCache.get(playerId);

  // Clean up SP count-up animations
  const players = world.getAllPlayers();
  const leavingPlayer = players.find(p => p.id === playerId);
  if (leavingPlayer) {
    SPAnimator.clearPlayerAnimation(leavingPlayer);
  }

  // Despawn guardian cats
  const catSquad = playerCatSquad.get(playerId);
  if (catSquad && catSquad.cats) {
    catSquad.cats.forEach(cat => {
      try {
        if (cat.isValid()) cat.remove();
      } catch (e) { /* cat already gone */ }
    });
  }
  playerCatSquad.delete(playerId);

  // Encounter cleanup on logout
  try {
    const quest = cachedQuestData?.active;
    if (quest?.isEncounter && quest.encounterState === "spawned" && quest.spawnData) {
      const dimensionId = quest.spawnData.dimensionId || "overworld";
      const dimension = world.getDimension(dimensionId);
      const despawnedCount = despawnEncounterMobs(quest.id, dimension);

      quest.spawnData.spawnedEntityIds = [];

      const leavingPlayer = world.getAllPlayers().find(p => p.id === playerId);
      if (leavingPlayer) {
        PersistenceManager.saveQuestData(leavingPlayer, cachedQuestData);
      }

      if (despawnedCount > 0) {
        console.log(`[main] Player ${playerId} logged out - despawned ${despawnedCount} mobs for quest ${quest.id}`);
      }
    }
  } catch (error) {
    console.error(`[main] Error handling encounter cleanup on player leave: ${error}`);
  }

  playerQuestDataCache.delete(playerId);
}

/**
 * Atlas NPC interaction handler - wrapper
 */
function handleAtlasInteract(ev) {
  const deps = {
    lastInteractTime,
    system
  };
  return handleAtlasInteractBase(ev, deps, showQuestMasterDialog);
}

/**
 * Admin command: sq:givesp handler - wrapper
 */
function handleAdminGiveSP(ev) {
  const deps = { world, adminAddSP };
  return handleAdminGiveSPBase(ev, deps);
}

/**
 * Admin command: sq:clearleaderboard handler
 */
function handleAdminClearLeaderboard(ev) {
  const source = ev.sourceEntity;
  const objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE_ID);

  if (!objective) {
    source?.sendMessage?.("§cLeaderboard objective missing.§r");
    return;
  }

  let removed = 0;
  try {
    for (const participant of objective.getParticipants()) {
      objective.removeParticipant(participant);
      removed++;
    }
  } catch (e) {
    console.warn(`[Leaderboard] Failed to clear leaderboard: ${e}`);
    source?.sendMessage?.("§cFailed to clear leaderboard. Check logs.§r");
    return;
  }

  source?.sendMessage?.(`§aCleared leaderboard (${removed} entr${removed === 1 ? "y" : "ies"}).§r`);
}

// =============================================================================
// BOOTSTRAP
// =============================================================================

function bootstrap() {
  // Initialize SuperPoints scoreboard objective
  let objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE_ID);
  if (!objective) {
    objective = world.scoreboard.addObjective(SCOREBOARD_OBJECTIVE_ID, SCOREBOARD_OBJECTIVE_DISPLAY);
  }
  // Clear sidebar - SP now displays via custom HUD element (Phase 4)
  // This actively clears persisted world data, not just prevents future setting
  try {
    world.scoreboard.clearObjectiveAtDisplaySlot(DisplaySlotId.Sidebar);
  } catch (e) {
    // May fail if nothing set, that's fine
  }

  // === PHASE 2: Register all event subscriptions ===
  registerEvents({
    handlers: {
      onWorldInitialize: handleWorldInitialize,
      onPlayerSpawn: handlePlayerSpawn,
      onPlayerLeave: handlePlayerLeave,
      onEntityDeath: handleEntityDeath,
      onBlockBreak: handleBlockBreak,
      onAtlasInteract: handleAtlasInteract,
      onAdminGiveSP: handleAdminGiveSP,
      onAdminClearLeaderboard: handleAdminClearLeaderboard,
    },
    wireInteractions,
    wireEntityHitTracking
  });

  registerSafeZoneEvents();
  AtmosphereManager.init();

  system.runInterval(() => {
    // Clean up entity hit map
    const now = Date.now();
    for (const [id, data] of lastHitPlayerByEntityId) {
      if (now - data.time > 30000) lastHitPlayerByEntityId.delete(id);
    }
  }, 100);

  // Quest Loop: Inventory Monitor & Persistent HUD (Every 20 ticks / 1 second)
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      const data = ensureQuestData(player); // Only load once
      if (!data.active) {
        player.onScreenDisplay?.setActionBar?.("");
        continue;
      }

      const quest = data.active;
      let changed = false;

      // Skip HUD updates for encounter quests - EncounterProximity handles those
      if (quest.isEncounter) {
        continue;
      }

      // 1. Gather Logic (Active only)
      if (quest.type === "gather" && quest.targetItemIds) {
        // Gather logic validates on turn-in usually, but we can show HUD progress
        // Note: spec says validate on turn-in, but HUD is nice.
        const inventory = player.getComponent("inventory")?.container;
        if (inventory) {
          let count = 0;
          for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item && quest.targetItemIds.includes(item.typeId)) count += item.amount;
          }
          // We don't save progress to DB for gather quests typically until turn in?
          // Actually spec says "progress" field exists.
          const previousProgress = data.progress;
          if (data.progress !== count) {
            data.progress = count;
            changed = true; // Save it so UI shows it if we reopen
          }

          // Check if we just hit the goal (notify player once)
          if (count >= quest.requiredCount && previousProgress < quest.requiredCount) {
            markQuestComplete(player, quest);
          } else {
            updateQuestHud(player, { ...quest, progress: count, goal: quest.requiredCount, status: "active" });
          }
        }
      } else {
        // Kill / Mine
        // Check if completion reached (already handled in events mostly, but HUD update here)
        if (data.progress >= quest.requiredCount) {
          updateQuestHud(player, { ...quest, progress: data.progress, goal: quest.requiredCount, status: "complete" });
        } else {
          updateQuestHud(player, { ...quest, progress: data.progress, goal: quest.requiredCount, status: "active" });
        }
      }

      // 4. Persist Changes
      if (changed) {
        PersistenceManager.saveQuestData(player, data);
      }
    }
  }, 20);

  // === AMBIENT SYSTEMS (Phase 6 - Extracted) ===
  // Initialize town music zone
  initializeTownMusicLoop({
    system,
    world,
    playerMusicState,
    QUEST_BOARD_LOCATION,
    TOWN_RADIUS,
    TOWN_MUSIC_SOUND_ID,
    TRACK_DURATION_TICKS,
    MUSIC_CHECK_INTERVAL
  });

  // Initialize SPSS music zone
  initializeSPSSMusicLoop({
    system,
    world,
    playerSPSSMusicState,
    SPSS_ZONE_BOUNDS,
    SPSS_MUSIC_SOUND_ID,
    SPSS_TRACK_DURATION_TICKS: SPSS_TRACK_DURATION_TICKS,
    SPSS_MUSIC_CHECK_INTERVAL
  });

  // Initialize dog barking zone
  initializeDogBarkingLoop({
    system,
    world,
    playerDogState: playerDogBarkState,
    QUEST_BOARD_LOCATION,
    DOG_SOUNDS,
    MONKEY_SOUNDS,
    DOG_DISTANCE_TIERS,
    DOG_MAX_RADIUS,
    DOG_CHECK_INTERVAL,
    DOG_REPLAY_TICKS
  });

  // Initialize cat protection squad
  initializeCatSquadLoop({
    system,
    world,
    playerCatSquad,
    QUEST_BOARD_LOCATION,
    CAT_DISTANCE_TIERS,
    CAT_MAX_RADIUS,
    CAT_CHECK_INTERVAL,
    CAT_SPAWN_RADIUS,
    CAT_VARIANTS
  });
}

// === ADMIN COMMANDS ===

/**
 * Update Sheep NPC interaction handler.
 * Triggered when a player interacts with the Update Sheep entity.
 */
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "sq:update_sheep_interact") {
    handleUpdateSheepInteract(event, ensureQuestData, PersistenceManager, lastInteractTime);
  }
});

/**
 * Update Sheep spawn handler.
 * Sets the name tag when the entity spawns.
 */
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "sq:update_sheep_spawned") {
    const entity = event.sourceEntity;
    if (entity && entity.typeId === "quest:update_sheep") {
      entity.nameTag = "Update Sheep™";
    }
  }
});

/**
 * Atlas spawn handler.
 * Sets the name tag when the entity spawns.
 */
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "quest:atlas_spawned") {
    const entity = event.sourceEntity;
    if (entity && entity.typeId === "quest:quest_master") {
      entity.nameTag = "Atlas";
    }
  }
});

/**
 * Admin scriptevent handler for giving SP to players.
 * Usage:
 *   /scriptevent sq:givesp 500              - Give yourself 500 SP
 *   /scriptevent sq:givesp 1000 PlayerName  - Give PlayerName 1000 SP
 */
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "sq:givesp") {
    const player = event.sourceEntity;
    if (!player || player.typeId !== "minecraft:player") {
      console.warn("[Admin] givesp must be run by a player");
      return;
    }

    const args = event.message.trim().split(/\s+/);

    // Format: /scriptevent sq:givesp <amount> [targetPlayer]
    if (args.length === 0 || isNaN(parseInt(args[0]))) {
      player.sendMessage("§cUsage: /scriptevent sq:givesp <amount> [player]");
      return;
    }

    const amount = parseInt(args[0]);
    let target = player;

    // If player name specified, find them
    if (args.length > 1) {
      const targetName = args.slice(1).join(" ");
      const foundPlayers = world.getPlayers({ name: targetName });

      if (foundPlayers.length === 0) {
        player.sendMessage(`§cPlayer not found: ${targetName}`);
        return;
      }

      target = foundPlayers[0];
    }

    const result = adminAddSP(target, amount, `gift from ${player.name}`);

    if (result.success) {
      player.sendMessage(`§aGave §e${amount} SP §ato §b${target.name}§a. New balance: §e${result.newBalance}`);

      if (target.id !== player.id) {
        target.sendMessage(`§6+${amount} SP §7(admin gift)`);
      }
    } else {
      player.sendMessage("§cFailed to award SP.");
    }
  }
});

// ============================================================================
// CELEBRATION SYSTEM - Test Command
// ============================================================================
// Test command for celebration effects
// Usage: /scriptevent sq:test_spgain [amount]
// ============================================================================
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "sq:test_spgain") return;

  const player = event.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") {
    console.warn("[Celebration] Test command must be run by a player");
    return;
  }

  const amount = parseInt(event.message) || 50;
  celebrateSPGain(player, amount);
  player.sendMessage(`§aTesting celebration effect with §e${amount} SP§a gain`);
});

// ============================================================================
// PHASE 2: Quest Celebration Test Commands
// Usage: /scriptevent sq:test_celebration <rarity> [modifier]
// 
// Examples:
//   /scriptevent sq:test_celebration common
//   /scriptevent sq:test_celebration rare
//   /scriptevent sq:test_celebration legendary
//   /scriptevent sq:test_celebration mythic
//   /scriptevent sq:test_celebration legendary jackpot
//   /scriptevent sq:test_celebration rare streak
//   /scriptevent sq:test_celebration mythic jackpot
// ============================================================================
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "sq:test_celebration") return;

  const player = event.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") {
    console.warn("[Celebration] Test command must be run by a player");
    return;
  }

  const args = event.message.split(" ");
  const rarity = args[0] || "common";
  const modifier = args[1] || null;
  
  // Validate rarity
  const validRarities = ["common", "rare", "legendary", "mythic"];
  if (!validRarities.includes(rarity)) {
    player.sendMessage(`§cInvalid rarity: ${rarity}. Use: common, rare, legendary, or mythic`);
    return;
  }
  
  // SP amounts per rarity for testing
  const spAmounts = { common: 25, rare: 75, legendary: 200, mythic: 500 };
  
  celebrateQuestComplete(player, {
    rarity: rarity,
    spAmount: spAmounts[rarity],
    isJackpot: modifier === "jackpot",
    streakLabel: modifier === "streak" ? "3-Quest Streak!" : null
  });
  
  player.sendMessage(`§aTesting §e${rarity}§a celebration${modifier ? ` with §e${modifier}` : ""}`);
});

// ============================================================================
// PHASE 3: SP COUNT-UP ANIMATION - Test Commands
// ============================================================================
// Test commands for the SP count-up animation system
// Usage: /scriptevent sq:test_countup [amount]
// Usage: /scriptevent sq:test_instant [value]
// Usage: /scriptevent sq:test_rapid
// ============================================================================

// Test SP count-up animation with various amounts
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "sq:test_countup") return;

  const player = event.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") {
    console.warn("[SPAnimator] Test command must be run by a player");
    return;
  }

  const amount = parseInt(event.message) || 50;
  const currentSP = getSP(player);
  
  // Simulate gaining SP with animation
  SPAnimator.animateCountUp(
    player,
    currentSP,
    currentSP + amount,
    sendSPDisplayValue
  );
  
  player.sendMessage(`§aTesting count-up animation: §e${currentSP} → ${currentSP + amount}`);
});

// Test instant display (no animation)
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "sq:test_instant") return;

  const player = event.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") {
    console.warn("[SPAnimator] Test command must be run by a player");
    return;
  }

  const value = parseInt(event.message) || 9999;
  sendSPDisplayValue(player, value);
  player.sendMessage(`§aSet display to §e${value}§a instantly (no animation)`);
});

// Test rapid SP gains (interrupt handling)
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "sq:test_rapid") return;

  const player = event.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") {
    console.warn("[SPAnimator] Test command must be run by a player");
    return;
  }

  const base = getSP(player);
  
  player.sendMessage("§aTesting rapid gains (interrupt handling)...");
  
  // Fire three SP gains in quick succession
  SPAnimator.animateCountUp(player, base, base + 25, sendSPDisplayValue);
  
  system.runTimeout(() => {
    SPAnimator.animateCountUp(player, base + 25, base + 75, sendSPDisplayValue);
  }, 10);
  
  system.runTimeout(() => {
    SPAnimator.animateCountUp(player, base + 75, base + 150, sendSPDisplayValue);
  }, 20);
});

// ============================================================================
// PHASE 2: ENCOUNTER SYSTEM - Debug Script Events
// ============================================================================
// Admin commands for testing encounter functionality
// These use /scriptevent instead of chat commands for reliability
//
// Available commands:
// - /scriptevent sq:encounter info - Show active encounter details
// - /scriptevent sq:encounter count - Count remaining alive mobs
// - /scriptevent sq:encounter complete - Force complete active encounter
// - /scriptevent sq:encounter spawn - Spawn test encounter at player location
// - /scriptevent sq:encounter despawn - Despawn test encounter mobs
// ============================================================================
system.afterEvents.scriptEventReceive.subscribe((event) => {
  // Only handle encounter-related events
  if (!event.id.startsWith("sq:encounter")) return;

  const player = event.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") {
    console.warn("[Encounter] Commands must be run by a player");
    return;
  }

  const command = event.message.trim();

  // === INFO: Show active encounter details ===
  if (command === "info") {
    const questData = ensureQuestData(player);

    if (questData.active && questData.active.isEncounter) {
      const q = questData.active;
      player.sendMessage(`§e=== Active Encounter ===`);
      player.sendMessage(`§fName: ${q.encounterName}`);
      player.sendMessage(`§fProgress: ${questData.progress}/${q.totalMobCount}`);
      player.sendMessage(`§fQuest ID: ${q.id}`);

      if (q.spawnData) {
        const loc = q.spawnData.location;
        player.sendMessage(`§fSpawn: ${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)}`);
        player.sendMessage(`§fSpawned IDs: ${q.spawnData.spawnedEntityIds.length}`);
      } else {
        player.sendMessage(`§7No spawn data (not yet accepted?)`);
      }
    } else {
      player.sendMessage(`§cNo active encounter quest`);
    }
  }

  // === COUNT: Count remaining alive mobs ===
  else if (command === "count") {
    const questData = ensureQuestData(player);

    if (questData.active && questData.active.isEncounter) {
      const remaining = countRemainingMobs(questData.active.id, player.dimension);
      player.sendMessage(`§eAlive mobs: ${remaining}`);
      player.sendMessage(`§7Progress: ${questData.progress}/${questData.active.totalMobCount}`);
    } else {
      player.sendMessage(`§cNo active encounter quest`);
    }
  }

  // === COMPLETE: Force complete active encounter (for testing turn-in) ===
  else if (command === "complete") {
    const questData = ensureQuestData(player);

    if (questData.active && questData.active.isEncounter) {
      questData.progress = questData.active.totalMobCount;
      PersistenceManager.saveQuestData(player, questData);
      player.sendMessage(`§aEncounter marked complete - return to board to turn in`);
    } else {
      player.sendMessage(`§cNo active encounter quest`);
    }
  }

  // === SPAWN: Spawn test encounter at player location ===
  else if (command === "spawn") {
    // Import encounter table dynamically
    import("./data/EncounterTable.js").then(({ ENCOUNTER_TABLE }) => {
      const testEncounter = ENCOUNTER_TABLE[0];  // skeleton_warband
      const testQuest = {
        id: "debug_test",
        encounterMobs: testEncounter.mobs
      };

      const entityIds = spawnEncounterMobs(testQuest, player.location, player.dimension);
      player.sendMessage(`§aSpawned ${entityIds.length} test mobs at your location`);
    }).catch(error => {
      player.sendMessage(`§cFailed to spawn test encounter: ${error.message}`);
      console.error("[Encounter] Spawn test failed:", error);
    });
  }

  // === DESPAWN: Despawn test encounter mobs ===
  else if (command === "despawn") {
    const count = despawnEncounterMobs("debug_test", player.dimension);
    player.sendMessage(`§aDespawned ${count} test mobs`);
  }

  // === UNKNOWN COMMAND ===
  else {
    player.sendMessage(`§cUnknown encounter command: ${command}`);
    player.sendMessage(`§7Available: info, count, complete, spawn, despawn`);
  }
});

bootstrap();
