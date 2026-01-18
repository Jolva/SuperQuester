import { world, system, ItemStack, DisplaySlotId } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { getMobType } from "./quests/mobTypes.js";
import { CONFIG } from "./config.js";
import { registerSafeZoneEvents, handleSafeZoneCommand } from "./safeZone.js";
import { PersistenceManager } from "./systems/PersistenceManager.js";
import { QuestGenerator } from "./systems/QuestGenerator.js";
import { AtmosphereManager } from "./systems/AtmosphereManager.js";
// Icon system removed — see Boss Bar implementation for quest tracking HUD

/**
 * QuestBoard Add-on — High-Utility UX Refactor
 * - Simulated Tab System (Available, Active, Leaderboard)
 * - Visual Hierarchy & Texture Integration
 * - Persistent User State (player.name)
 */

// PERMANENT Hub Spawn Location (staircase leading to quest board)
const HUB_SPAWN_LOCATION = { x: 84, y: 78, z: -278 };
// Rotation: yaw = horizontal (0=south, 90=west, 180=north, -90=east), pitch = vertical
const HUB_SPAWN_ROTATION = { x: 0, y: 90 }; // Facing West toward the quest board

// === TOWN MUSIC ZONE CONFIGURATION ===
// Town center coordinates (same as Quest Board / Safe Zone center)
// Change these if your town center moves!
const TOWN_CENTER = { x: 72, y: 75, z: -278 };
const TOWN_RADIUS = 40; // blocks

// Music track configuration
// Change TRACK_DURATION_TICKS if you change the audio file length!
// Current track: ~45 seconds. Replay at 44 seconds (880 ticks) for seamless loop.
const TOWN_MUSIC_SOUND_ID = "questboard.music.town";
const TRACK_DURATION_TICKS = 880; // ~44 seconds (slight overlap for seamless loop)
const MUSIC_CHECK_INTERVAL = 10; // Check every 10 ticks (0.5 seconds)

// === RIDICULOUS DOG BARKING ZONE ===
// Distance-based intensity: The closer you get, the more dogs bark!
const QUEST_BOARD_LOCATION = { x: 72, y: 75, z: -278 }; // Same as town center
const DOG_SOUNDS = [
  "atmosphere.dogs_01",
  "atmosphere.dogs_02",
  "atmosphere.dogs_03"
];
const DOG_CHECK_INTERVAL = 10; // Check every 10 ticks (0.5 seconds)
const DOG_REPLAY_TICKS = 60; // Replay barking every 3 seconds while in zone

// Distance tiers: [maxDistance, numberOfTracks, maxVolume]
// Outer ring (3-6 blocks): 1 track, faint (15-25%)
// Mid ring (1-3 blocks): 2 tracks, moderate (30-40%)
// Inner ring (<1 block): 3 tracks, FULL CHAOS (40-50%)
const DOG_DISTANCE_TIERS = [
  { maxDist: 6, tracks: 1, minVol: 0.15, maxVol: 0.25 },  // Outer: faint single track
  { maxDist: 3, tracks: 2, minVol: 0.30, maxVol: 0.40 },  // Mid: two tracks, moderate
  { maxDist: 1, tracks: 3, minVol: 0.40, maxVol: 0.50 },  // Inner: FULL CHAOS
];
const DOG_MAX_RADIUS = 6; // Outer detection radius

// === CAT PROTECTION SQUAD ===
// Physical cats spawn around players to protect them from the phantom dogs!
// The closer you get to the quest board, the more cats appear
const CAT_CHECK_INTERVAL = 20; // Check every 20 ticks (1 second)
const CAT_MAX_RADIUS = 6; // Same as dog zone
const CAT_SPAWN_RADIUS = 1.5; // How far from player to spawn cats

// Distance tiers: [maxDistance, numberOfCats]
// Outer ring (4-6 blocks): 3 cats
// Mid ring (2-4 blocks): 9 cats  
// Inner ring (<2 blocks): 18 cats (MAXIMUM PROTECTION)
const CAT_DISTANCE_TIERS = [
  { maxDist: 6, cats: 3 },    // Outer: 3 guardian cats
  { maxDist: 4, cats: 9 },    // Mid: 9 cats
  { maxDist: 2, cats: 18 },   // Inner: FULL CAT ARMY (expanded to 2 blocks!)
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


// Log on world load (Kept from original main.js)
world.afterEvents.worldInitialize.subscribe(() => {
  console.warn('Quest System BP loaded successfully');
  world.setDefaultSpawnLocation(HUB_SPAWN_LOCATION);
});

// Load data when player joins AND force spawn at hub
world.afterEvents.playerSpawn.subscribe((ev) => {
  const { player, initialSpawn } = ev;

  // Force ALL players to spawn at hub (new players AND respawns)
  // This overrides beds and other spawn points
  system.runTimeout(() => {
    try {
      player.teleport(HUB_SPAWN_LOCATION, {
        rotation: HUB_SPAWN_ROTATION,
        checkForBlocks: true
      });
    } catch (e) {
      console.warn(`[Spawn] Failed to teleport ${player.name}: ${e}`);
    }
  }, 5); // Small delay to ensure player is fully loaded

  // Register player name for leaderboard (fixes offline player name display)
  // Also initialize SP (handles backup recovery if scoreboard was wiped)
  system.runTimeout(() => {
    registerPlayerName(player);
    initializePlayerSP(player);
  }, 10); // Delay to ensure scoreboard identity is ready

  // Load quest data
  const quests = PersistenceManager.loadQuests(player);

  if (quests && quests.length > 0) {
    activeQuestsByPlayer.set(getPlayerKey(player), quests);

    // Resume HUD if applicable
    const activeQuest = quests.find(q => (q.type === "kill" || q.type === "mine") && q.status !== "complete");
    if (activeQuest) {
      updateQuestHud(player, activeQuest);
    }
  }
});

// Clean up music state and despawn cats when player leaves
world.afterEvents.playerLeave.subscribe((ev) => {
  const playerId = ev.playerId;
  playerMusicState.delete(playerId);
  playerDogBarkState.delete(playerId);

  // Despawn any guardian cats
  const catSquad = playerCatSquad.get(playerId);
  if (catSquad && catSquad.cats) {
    catSquad.cats.forEach(cat => {
      try {
        if (cat.isValid()) cat.remove();
      } catch (e) { /* cat already gone */ }
    });
  }
  playerCatSquad.delete(playerId);
});

// Initialize Daily Quests (Global Daily Quests - REMOVED)
// let currentAvailableQuests = QuestGenerator.generateDailyQuests(3);

/** -----------------------------
 *  Config
 *  ----------------------------- */

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

const BOARD_TABS = {
  AVAILABLE: "available",
  ACTIVE: "active",
  LEADERBOARD: "leaderboard",
};

/**
 * Get icon for a quest based on rarity and category
 * @param {Object} quest - Quest object with category and rarity fields
 * @param {boolean} showRarityBadge - If true, legendary/rare quests show rarity icon instead
 * @returns {string} Texture path
 */
function getQuestIcon(quest, showRarityBadge = false) {
  // Rarity badge override (for special visual emphasis)
  if (showRarityBadge) {
    if (quest.rarity === "legendary") return TEXTURES.LEGENDARY;
    if (quest.rarity === "rare") return TEXTURES.RARE;
  }

  // Category-based icon (primary system)
  if (quest.category && CATEGORY_TEXTURES[quest.category]) {
    return CATEGORY_TEXTURES[quest.category];
  }

  // Fallback to type-based (legacy support)
  if (quest.type === "kill") return TEXTURES.CATEGORY_UNDEAD;
  if (quest.type === "mine") return TEXTURES.CATEGORY_MINING;
  if (quest.type === "gather") return TEXTURES.CATEGORY_GATHERING;

  return TEXTURES.DEFAULT;
}

const LEADERBOARD_ENTRY_LIMIT = 10;

// Color Palettes
function getQuestColors(rarity) {
  // Returns { chat: "code", button: "code" }
  // NOTE: button colors should be light for visibility on custom stone button textures
  switch (rarity) {
    case "legendary":
      return { chat: "§6§l", button: "§6" }; // Gold/Gold (already visible)
    case "rare":
      return { chat: "§b", button: "§b" };   // Aqua/Aqua (changed from dark blue)
    case "common":
    default:
      return { chat: "§7", button: "§f" };   // Gray chat / White button (changed from black)
  }
}

/** -----------------------------
 *  State (in-memory)
 *  ----------------------------- */

/**
 * Map<playerId, QuestState[]>
 */
const activeQuestsByPlayer = new Map();
const lastHitPlayerByEntityId = new Map();

// UI State: Track which tab the player is viewing
const playerTabState = new Map();

// === TOWN MUSIC ZONE STATE ===
// Tracks per-player music state: { inZone: boolean, nextReplayTick: number }
const playerMusicState = new Map();

// === DOG BARKING ZONE STATE ===
// Tracks per-player dog barking state: { inZone: boolean, nextBarkTick: number }
const playerDogBarkState = new Map();

// === CAT PROTECTION SQUAD STATE ===
// Tracks per-player spawned cats: { cats: Entity[], lastTier: number }
const playerCatSquad = new Map();

// === PLAYER NAME REGISTRY ===
// Stores player names in world dynamic properties so leaderboard can display
// correct names even when players are offline.
const PLAYER_NAME_REGISTRY_KEY = "superquester:player_names";

/**
 * Loads the player name registry from world dynamic properties.
 * @returns {Object} Map of scoreboard participant ID -> player name
 */
function loadPlayerNameRegistry() {
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
 * @param {Object} registry - Map of scoreboard participant ID -> player name
 */
function savePlayerNameRegistry(registry) {
  try {
    world.setDynamicProperty(PLAYER_NAME_REGISTRY_KEY, JSON.stringify(registry));
  } catch (e) {
    console.warn(`[Registry] Failed to save player name registry: ${e}`);
  }
}

/**
 * Registers a player's name in the registry using their scoreboard identity.
 * Should be called when a player joins/spawns.
 * @param {import("@minecraft/server").Player} player
 */
function registerPlayerName(player) {
  if (!player || !player.isValid()) return;

  // We need the player to have a scoreboard identity to map correctly.
  // If they don't have one yet, we'll create it by adding 0 points.
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
      // console.warn(`[Registry] Registered player: ${player.name} (ID: ${participantId})`);
    }
  } catch (e) {
    console.warn(`[Registry] Failed to register player ${player.name}: ${e}`);
  }
}

/**
 * Looks up a player name from the registry.
 * @param {string} participantId - The scoreboard participant ID
 * @returns {string|null} The player name or null if not found
 */
function lookupPlayerName(participantId) {
  const registry = loadPlayerNameRegistry();
  return registry[participantId.toString()] || null;
}

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
 * @returns {number} The new balance
 */
function modifySP(player, delta) {
  const objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE_ID);
  if (!objective) {
    console.warn("[SP] Cannot modify SP - objective not found");
    return 0;
  }

  // Get current balance
  let current = 0;
  if (player.scoreboardIdentity) {
    current = objective.getScore(player.scoreboardIdentity) ?? 0;
  }

  // Calculate new balance (floor at 0)
  const newBalance = Math.max(0, current + delta);

  // Update scoreboard
  objective.setScore(player, newBalance);

  // Update backup in dynamic properties
  const data = PersistenceManager.loadQuestData(player);
  if (data) {
    data.currentSP = newBalance;
    PersistenceManager.saveQuestData(player, data);
  }

  return newBalance;
}

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
 * @param {import("@minecraft/server").Player} player
 * @returns {QuestData}
 */
function ensureQuestData(player) {
  // Try new format first
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
        freeRerollAvailable: true,
        paidRerollsThisCycle: 0,
        lifetimeCompleted: 0,
        currentSP: 0  // Backup of SP balance (synced with scoreboard)
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
        freeRerollAvailable: true,  // Start with 1 free reroll
        paidRerollsThisCycle: 0,
        lifetimeCompleted: 0,
        currentSP: 0  // Backup of SP balance (synced with scoreboard)
      };

      PersistenceManager.saveQuestData(player, data);
      console.warn(`[QuestSystem] Initialized quest data for ${player.name}`);
    }
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
    PersistenceManager.saveQuestData(player, data);

    player.sendMessage("§e⏰ Your daily quests have refreshed!§r");
    console.warn(`[QuestSystem] Auto-refreshed quests for ${player.name} (24h expired)`);
  }

  return data;
}

/**
 * Calculates SP cost for the next paid reroll.
 * @param {number} paidRerollsThisCycle
 * @returns {number} SP cost
 */
function calculateRerollPrice(paidRerollsThisCycle) {
  const BASE_PRICE = 50;

  if (paidRerollsThisCycle < 2) {
    return BASE_PRICE;
  }

  // 3rd reroll = 50 * 2^1 = 100
  // 4th reroll = 50 * 2^2 = 200
  // etc.
  return BASE_PRICE * Math.pow(2, paidRerollsThisCycle - 1);
}

/**
 * Handles the refresh/reroll button click.
 * @param {import("@minecraft/server").Player} player
 * @returns {boolean} success
 */
function handleRefresh(player) {
  const data = ensureQuestData(player);

  // CASE 1: Free reroll available
  if (data.freeRerollAvailable) {
    data.freeRerollAvailable = false;
    data.available = QuestGenerator.generateDailyQuests(3);
    data.active = null;
    data.progress = 0;
    data.lastRefreshTime = Date.now();
    data.paidRerollsThisCycle = 0;  // Reset pricing on free use
    PersistenceManager.saveQuestData(player, data);

    player.sendMessage("§a✓ Used free reroll! Complete all 3 quests to earn another.§r");
    player.playSound("quest.reroll", { volume: 0.9, pitch: 1.0 });
    return true;
  }

  // CASE 2: Paid reroll
  const price = calculateRerollPrice(data.paidRerollsThisCycle);
  const currentSP = getSP(player);

  if (currentSP < price) {
    player.sendMessage(`§cNot enough SP! Need ${price}, have ${currentSP}.§r`);
    player.playSound("note.bass", { pitch: 0.5 });
    return false;
  }

  // Deduct SP using centralized helper (updates both scoreboard and backup)
  modifySP(player, -price);

  data.paidRerollsThisCycle += 1;
  data.available = QuestGenerator.generateDailyQuests(3);
  data.active = null;
  data.progress = 0;
  data.lastRefreshTime = Date.now();
  PersistenceManager.saveQuestData(player, data);

  const nextPrice = calculateRerollPrice(data.paidRerollsThisCycle);
  player.sendMessage(`§a✓ Rerolled for ${price} SP! Next reroll: ${nextPrice} SP§r`);
  player.playSound("quest.reroll", { volume: 0.9, pitch: 1.0 });

  return true;
}

/**
 * Accepts a quest from the available pool.
 * @param {import("@minecraft/server").Player} player
 * @param {number} questIndex - Index in available array (0, 1, or 2)
 * @returns {{ ok: boolean, reason?: string, quest?: any }}
 */
function handleQuestAccept(player, questIndex) {
  const data = ensureQuestData(player);

  // Validate: already have active quest?
  if (data.active !== null) {
    return { ok: false, reason: "§cYou already have an active quest! Complete or abandon it first.§r" };
  }

  // Validate: index in bounds?
  if (questIndex < 0 || questIndex >= data.available.length) {
    return { ok: false, reason: "§cInvalid quest selection.§r" };
  }

  // Validate: slot not empty?
  const quest = data.available[questIndex];
  if (quest === null) {
    return { ok: false, reason: "§cThat quest slot is empty.§r" };
  }

  // Accept the quest
  data.active = { ...quest };  // Copy to active
  data.progress = 0;
  data.available[questIndex] = null;  // Mark slot as taken
  PersistenceManager.saveQuestData(player, data);

  // Start HUD if applicable
  if (quest.type === "kill" || quest.type === "mine") {
    updateQuestHud(player, { ...data.active, progress: 0, goal: quest.requiredCount, status: "active" });
  }

  return { ok: true, quest: quest };
}

/**
 * Abandons the active quest and returns it to the available pool.
 * @param {import("@minecraft/server").Player} player
 * @returns {any|null} The abandoned quest, or null if none active
 */
function handleQuestAbandon(player) {
  const data = ensureQuestData(player);

  if (!data.active) {
    player.sendMessage("§cNo active quest to abandon.§r");
    return null;
  }

  const quest = data.active;

  // Find an empty slot to return it to (or first slot if somehow all full)
  const emptyIndex = data.available.findIndex(slot => slot === null);
  if (emptyIndex !== -1) {
    data.available[emptyIndex] = quest;
  } else {
    // Edge case: No empty slots (shouldn't happen if accept logic is correct, but safe fallback: put in slot 0)
    data.available[0] = quest;
  }

  data.active = null;
  data.progress = 0;
  PersistenceManager.saveQuestData(player, data);

  player.onScreenDisplay?.setActionBar?.("");

  // Play abandon sound
  player.playSound("quest.abandon", { volume: 0.8, pitch: 1.0 });

  return quest;
}

function setPlayerTab(player, tab) {
  playerTabState.set(getPlayerKey(player), tab);
}

function getPlayerTab(player) {
  const key = getPlayerKey(player);
  if (playerTabState.has(key)) return playerTabState.get(key);

  const data = ensureQuestData(player);
  // Default logic: if has active quests, go to Active, else Available
  const hasActive = data.active !== null;
  return hasActive ? BOARD_TABS.ACTIVE : BOARD_TABS.AVAILABLE;
}

/** -----------------------------
 *  UI helpers
 *  ----------------------------- */

const TABS_CONFIG = [
  { id: BOARD_TABS.AVAILABLE, label: "Available" },
  { id: BOARD_TABS.ACTIVE, label: "Active" },
  { id: BOARD_TABS.LEADERBOARD, label: "Leaderboard" },
];

/**
 * Adds the tab navigation buttons at the top of the form.
 * Returns the mapping of indices to actions for these buttons.
 */
function addTabButtons(form, currentTab, actionsList) {
  for (const tab of TABS_CONFIG) {
    const isCurrent = tab.id === currentTab;
    const label = isCurrent ? `§l${tab.label}§r` : `${tab.label}`;

    form.button(label, tab.icon);
    actionsList.push({ type: "nav", tab: tab.id });
  }
}

async function showAvailableTab(player, actions, isStandalone = false) {
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

  // 1. Tabs
  if (!isStandalone) {
    addTabButtons(form, BOARD_TABS.AVAILABLE, actions);
  }

  // 2. Quest buttons (rare/legendary show rarity badge, common shows category icon)
  data.available.forEach((quest, index) => {
    if (quest) {
      const showRarityBadge = quest.rarity === "legendary" || quest.rarity === "rare";
      const icon = getQuestIcon(quest, showRarityBadge);
      const colors = getQuestColors(quest.rarity);
      form.button(`${colors.button}${quest.title}§r`, icon);
      actions.push({ type: "view_details", questIndex: index, fromStandalone: isStandalone });
    }
  });

  // 3. Refresh button — swaps between refresh arrows (free) and SP coin (paid)
  const refreshIcon = data.freeRerollAvailable ? TEXTURES.REFRESH : TEXTURES.SP_COIN;
  form.button(refreshLabel, refreshIcon);
  actions.push({ type: "refresh", fromStandalone: isStandalone });

  // 4. Close option (always good UX)
  form.button("Close");
  actions.push({ type: "close" });

  return form;
}

async function showActiveTab(player, actions, isStandalone = false) {
  const data = ensureQuestData(player);

  const header = isStandalone ? "" : "§2§l[ ACTIVE ]§r\n\n";
  const body = data.active
    ? `${header}§7Your Current Quest:§r`
    : `${header}§7No active quest. Pick one from Available!§r`;

  const title = isStandalone ? "§lActive Quest§r" : "§lQuest Board§r";

  const form = new ActionFormData()
    .title(title)
    .body(body);

  // 1. Tabs
  if (!isStandalone) {
    addTabButtons(form, BOARD_TABS.ACTIVE, actions);
  }

  // 2. Content
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

async function showLeaderboardTab(player, actions, isStandalone = false) {
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

  // 1. Tabs
  if (!isStandalone) {
    addTabButtons(form, BOARD_TABS.LEADERBOARD, actions);
  }

  // 2. Content (Leaderboard is mostly read-only, maybe a Refresh button?)
  form.button("Refresh");
  actions.push({ type: "nav", tab: BOARD_TABS.LEADERBOARD, fromStandalone: isStandalone });

  form.button("Close");
  actions.push({ type: "close" });

  return form;
}

async function showQuestBoard(player, forcedTab = null, isStandalone = false, playOpenSound = true) {
  // ensureQuestData handles expiry now, called inside tab functions too, but calling here helps consistency
  const data = ensureQuestData(player);

  const tab = forcedTab || getPlayerTab(player);
  if (!isStandalone) {
    setPlayerTab(player, tab); // Ensure state is synced only if navigating
  }

  // Play menu open sounds based on which tab is opening (initial open only)
  if (playOpenSound) {
    if (tab === BOARD_TABS.AVAILABLE) {
      player.playSound("ui.available_open", { volume: 0.8, pitch: 1.0 });
    } else if (tab === BOARD_TABS.ACTIVE) {
      player.playSound("ui.active_open", { volume: 0.8, pitch: 1.0 });
    } else if (tab === BOARD_TABS.LEADERBOARD) {
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

  switch (tab) {
    case BOARD_TABS.AVAILABLE:
      form = await showAvailableTab(player, actions, isStandalone);
      break;
    case BOARD_TABS.ACTIVE:
      form = await showActiveTab(player, actions, isStandalone);
      break;
    case BOARD_TABS.LEADERBOARD:
      form = await showLeaderboardTab(player, actions, isStandalone);
      break;
    default:
      form = await showAvailableTab(player, actions, isStandalone);
      break;
  }

  const res = await form.show(player);
  if (res.canceled) return;

  const action = actions[res.selection];
  if (!action) return;

  handleUiAction(player, action);
}

async function handleUiAction(player, action) {
  if (action.type === "close") return;

  const isStandalone = action.fromStandalone ?? false;

  if (action.type === "nav") {
    await showQuestBoard(player, action.tab, isStandalone, false);
    return;
  }

  if (action.type === "refresh") {
    const success = handleRefresh(player);
    await showQuestBoard(player, BOARD_TABS.AVAILABLE, isStandalone, false);
    return;
  }

  if (action.type === "view_details") {
    // Show details (needs index now)
    await showQuestDetails(player, action.questIndex, isStandalone);
    return;
  }

  if (action.type === "accept") {
    const result = handleQuestAccept(player, action.questIndex);
    if (!result.ok) {
      player.sendMessage(result.reason);
    } else {
      const def = result.quest;
      const colors = getQuestColors(def.rarity);
      player.sendMessage(`§aAccepted: ${colors.chat}${def.title}§r`);

      // FX: Rarity
      if (def.rarity === "legendary") {
        player.playSound("quest.accept_legendary", { volume: 1.0, pitch: 1.0 });
        player.dimension.spawnParticle("minecraft:totem_particle", player.location);
        player.sendMessage("§6§l[LEGENDARY CONTRACT ACCEPTED]§r");
      } else if (def.rarity === "rare") {
        player.playSound("quest.accept_rare", { volume: 1.0, pitch: 1.0 });
        player.dimension.spawnParticle("minecraft:villager_happy", player.location);
      } else {
        player.playSound("random.orb", { pitch: 1.0 });
      }
    }
    return;
  }

  if (action.type === "turnIn") {
    handleQuestTurnIn(player);
    return;
  }

  if (action.type === "manage") {
    // Show management for active quest (Abandon)
    await showManageQuest(player, isStandalone);
    return;
  }
}

async function showQuestDetails(player, questIndex, isStandalone = false) {
  const data = ensureQuestData(player);
  const def = data.available[questIndex];
  if (!def) return;

  // Formatting strings
  const scoreRaw = def.reward?.scoreboardIncrement || 0;
  const itemsRaw = def.reward?.rewardItems || [];

  let rewardsStr = "";
  if (scoreRaw > 0) rewardsStr += `\n§e+${scoreRaw} Town Reputation§r`;
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

  let warningText = "";
  if (def.rarity === "legendary") {
    warningText = "\n\n§c⚠ HIGH VALUE TARGET ⚠§r";
  }

  const colors = getQuestColors(def.rarity);

  const form = new MessageFormData()
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
    .button1("§lACCEPT CONTRACT§r")
    .button2("Decline");

  const res = await form.show(player);

  if (res.selection === 0) {
    // Accept (Button 1 -> Index 0)
    await handleUiAction(player, { type: "accept", questIndex, fromStandalone: isStandalone });
    return;
  }

  // Decline or Cancel
  if (res.canceled || res.selection === 1) {
    await showQuestBoard(player, BOARD_TABS.AVAILABLE, isStandalone, false);
  }
}

async function showManageQuest(player, isStandalone = false) {
  const data = ensureQuestData(player);
  if (!data.active) {
    await showQuestBoard(player, BOARD_TABS.ACTIVE, isStandalone, false);
    return;
  }

  const quest = data.active;
  const colors = getQuestColors(quest.rarity);

  const form = new MessageFormData()
    .title("§cAbandon Quest?")
    .body(`Are you sure you want to abandon:\n${colors.chat}${quest.title}§r\n\nProgress will be lost and it will return to available quests.`)
    .button1("Yes, Abandon")
    .button2("No, Keep");

  const res = await form.show(player);
  // Button 1 ("Yes") -> 0
  // Button 2 ("No") -> 1

  if (res.canceled || res.selection === 1) {
    // Button 2 (No) -> 1, or Canceled
    await showQuestBoard(player, BOARD_TABS.ACTIVE, isStandalone, false);
    return;
  }

  if (res.selection === 0) {
    const removed = handleQuestAbandon(player);
    if (removed) {
      const c = getQuestColors(removed.rarity);
      player.sendMessage(`§eAbandoned: ${c.chat}${removed.title}§r`);
    }
    await showQuestBoard(player, BOARD_TABS.ACTIVE, isStandalone, false);
  }
}

/** -----------------------------
 *  Leaderboard Logic
 *  ----------------------------- */

function getLeaderboardEntries(player) {
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
    // Fall back to displayName/name for online players or unknown entries
    let name = lookupPlayerName(participant.id);
    if (!name) {
      // Check if displayName looks like the offline placeholder
      const displayName = participant.displayName || participant.name || "Unknown";
      if (displayName.includes("offlinePlayerName") || displayName.includes("commands.scoreboard")) {
        name = "Unknown Player"; // Fallback if not in registry
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
  if (player) {
    // Try to find exact match
    currentPlayerEntry = scored.find(e => e.name === player.name) ||
      scored.find(e => e.participant.id === player.id);
  }

  return { entries: topEntries, currentPlayer: currentPlayerEntry, missingObjective: false };
}

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

function updateQuestHud(player, questState) {
  if (questState.status === "active") {
    // Gather HUD is handled in loop, Kill/Mine here
    // Logic same: show progress
  }

  if (questState.status === "complete") {
    player.onScreenDisplay?.setActionBar?.("§aQuest complete! Return to board.§r");
    return;
  }

  // If we are passing in a temporary state object, we trust it has progress/goal
  if (questState.type === "kill" || questState.type === "mine" || questState.type === "gather") {
    if (questState.goal <= 0) return;

    // Rarity-based text color
    let textColor = "§7"; // Common: gray
    if (questState.rarity === "legendary") textColor = "§6"; // Legendary: gold
    else if (questState.rarity === "rare") textColor = "§b"; // Rare: aqua

    // Clean text display (icons removed due to action bar height clipping)
    player.onScreenDisplay?.setActionBar?.(`${textColor}${questState.title}: ${questState.progress}/${questState.goal}§r`);
  }
}

// NOTE: markQuestComplete helper is less useful now as logic is split, but let's keep it for event handlers
function markQuestComplete(player, questState) {
  // Just playing sound/particle, turn-in logic does the real completion
  // But wait, for Kill/Mine we need to know they are "Ready to Turn In".
  // In new system: "Complete" means "Ready to Turn In" (status check in UI).
  // But we don't have a status field on the object in DB anymore (it's flattened).
  // So "Complete" is derived from progress >= goal.

  // This function is called when progress hits goal in events.
  player.onScreenDisplay?.setActionBar?.("§aQuest complete! Return to board.§r");

  const colors = getQuestColors(questState.rarity);
  player.sendMessage(`§aQuest Complete: ${colors.chat}${questState.title}§r`);
  player.playSound("random.levelup");
  player.dimension.spawnParticle("minecraft:villager_happy", player.location);
}

function handleEntityDeath(ev) {
  const { damageSource, deadEntity } = ev;
  if (!deadEntity) return;

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

function handleQuestTurnIn(player) {
  const data = ensureQuestData(player);

  if (!data.active) {
    player.sendMessage("§cNo active quest to turn in.§r");
    return;
  }

  const quest = data.active;

  // === VALIDATE COMPLETION ===

  if (quest.type === "gather" && quest.targetItemIds) {
    const inventory = player.getComponent("inventory")?.container;
    if (!inventory) return;

    // Count items
    let totalCount = 0;
    for (let i = 0; i < inventory.size; i++) {
      const item = inventory.getItem(i);
      if (item && quest.targetItemIds.includes(item.typeId)) {
        totalCount += item.amount;
      }
    }

    if (totalCount < quest.requiredCount) {
      player.sendMessage(`§cNeed ${quest.requiredCount - totalCount} more items!§r`);
      return;
    }

    // Consume items
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
  } else if (quest.type === "kill" || quest.type === "mine") {
    if (data.progress < quest.requiredCount) {
      player.sendMessage(`§cProgress: ${data.progress}/${quest.requiredCount}§r`);
      return;
    }
  }

  // === SUCCESSFUL TURN-IN ===

  // Award rewards
  const reward = quest.reward;
  const spEarned = reward?.scoreboardIncrement ?? 0;

  if (reward) {
    // Award SP using centralized helper (updates both scoreboard and backup)
    if (spEarned > 0) {
      modifySP(player, spEarned);
    }

    // Items
    if (reward.rewardItems) {
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
  }

  // Update stats
  data.lifetimeCompleted += 1;

  // Clear active quest
  data.active = null;
  data.progress = 0;

  // === CHECK FOR FULL CLEAR ===
  const allComplete = data.available.every(slot => slot === null);

  if (allComplete) {
    // JACKPOT! Auto-populate new quests
    data.available = QuestGenerator.generateDailyQuests(3);
    data.lastRefreshTime = Date.now();
    data.freeRerollAvailable = true;
    data.paidRerollsThisCycle = 0;

    PersistenceManager.saveQuestData(player, data);

    // CELEBRATION!
    triggerQuestClearCelebration(player, spEarned);
  } else {
    // Normal turn-in
    PersistenceManager.saveQuestData(player, data);

    const colors = getQuestColors(quest.rarity);
    player.sendMessage(`§a✓ Quest Complete: ${colors.chat}${quest.title}§r (+${spEarned} SP)`);
    player.playSound("quest.complete_single", { volume: 1.0, pitch: 1.0 });
    player.dimension.spawnParticle("minecraft:villager_happy", player.location);
  }

  // Clear HUD
  player.onScreenDisplay?.setActionBar?.("");
}

/** -----------------------------
 *  Atlas NPC
 *  ----------------------------- */

/**
 * Shows the Atlas NPC dialog with tutorial/explanation content
 * @param {import("@minecraft/server").Player} player
 */
function showQuestMasterDialog(player) {
  const form = new ActionFormData()
    .title("§5§lAtlas")
    .body(
      "§7Greetings, adventurer! I am the keeper of the Quest Board, Atlas.\n\n" +
      "§fSelect a topic to learn more:"
    )
    .button("§2How Quests Work", TEXTURES.DEFAULT)
    .button("§eAbout Super Points (SP)", TEXTURES.SP_COIN)
    .button("§bRerolls & Refreshes", TEXTURES.REFRESH)
    .button("§6Legendary Quests", TEXTURES.LEGENDARY)
    .button("§aOpen Quest Board", TEXTURES.CATEGORY_UNDEAD)
    .button("§7Nevermind");

  form.show(player).then((response) => {
    if (response.canceled || response.selection === 5) return;

    switch (response.selection) {
      case 0:
        showTutorialPage(player, "how_quests_work");
        break;
      case 1:
        showTutorialPage(player, "super_points");
        break;
      case 2:
        showTutorialPage(player, "rerolls");
        break;
      case 3:
        showTutorialPage(player, "legendary");
        break;
      case 4:
        // Open the actual quest board
        showQuestBoard(player, BOARD_TABS.AVAILABLE, true);
        break;
    }
  });
}

/**
 * Shows a specific tutorial page as a MessageForm (OK to go back)
 * @param {import("@minecraft/server").Player} player
 * @param {string} topic
 */
function showTutorialPage(player, topic) {
  const tutorials = {
    how_quests_work: {
      title: "§2How Quests Work",
      body:
        "§fThe Quest Board offers you §e3 personal quests§f that refresh every §b24 hours§f.\n\n" +
        "§7• §fYou can have §eONE active quest§f at a time\n" +
        "§7• §fComplete it by meeting the goal (kill mobs, mine blocks, or gather items)\n" +
        "§7• §fReturn to the board to §aturn in§f your completed quest\n" +
        "§7• §fCompleting all 3 quests triggers a §dbonus refresh§f!\n\n" +
        "§8Tip: Sneak + interact with the board to place blocks nearby."
    },
    super_points: {
      title: "§eSuper Points (SP)",
      body:
        "§6SP§f is the currency of the Quest Board.\n\n" +
        "§7• §fEarn SP by completing quests\n" +
        "§7• §fHarder quests (§brare§f, §6legendary§f) give more SP\n" +
        "§7• §fSP is tracked on the §dLeaderboard§f tab\n" +
        "§7• §fSpend SP on §cpaid rerolls§f when your free one is used\n\n" +
        "§8Future: SP will unlock rewards, cosmetics, and more!"
    },
    rerolls: {
      title: "§bRerolls & Refreshes",
      body:
        "§fDon't like your available quests? You have options:\n\n" +
        "§a§lFree Reroll§r\n" +
        "§7You get §eONE free reroll§7 per 24-hour cycle. Use it wisely!\n\n" +
        "§c§lPaid Rerolls§r\n" +
        "§7After your free reroll, you can spend §6SP§7 for more:\n" +
        "§7• 1st paid: §e50 SP§7 → 2nd: §e50 SP§7 → 3rd: §e100 SP§7...\n\n" +
        "§d§l24-Hour Refresh§r\n" +
        "§7Every 24 hours, your quests fully refresh and rerolls reset."
    },
    legendary: {
      title: "§6§lLegendary Quests",
      body:
        "§6Legendary quests§f are rare and highly rewarding!\n\n" +
        "§7• §fThey appear randomly in your quest pool\n" +
        "§7• §fThey have §cdifficult goals§f but §amassive SP rewards§f\n" +
        "§7• §fSome grant §dspecial item rewards§f\n" +
        "§7• §fThey're marked with a §6golden icon§f\n\n" +
        "§8If you see one, consider saving your reroll for something else!"
    }
  };

  const page = tutorials[topic];
  if (!page) return;

  const msg = new MessageFormData()
    .title(page.title)
    .body(page.body)
    .button1("§aBack to Atlas")
    .button2("§7Close");

  msg.show(player).then((response) => {
    if (response.selection === 0) {
      showQuestMasterDialog(player);
    }
  });
}

/** -----------------------------
 *  Interaction & Wiring
 *  ----------------------------- */

const BLOCK_TAB_MAP = {
  // Available Column
  "quest:avail_top": "available", "quest:avail_mid": "available", "quest:avail_bot": "available",
  // Active Column
  "quest:active_top": "active", "quest:active_mid": "active", "quest:active_bot": "active",
  // Leaderboard Column
  "quest:leader_top": "leaderboard", "quest:leader_mid": "leaderboard", "quest:leader_bot": "leaderboard"
};

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
    const tab = BLOCK_TAB_MAP[block.typeId];
    if (!tab) return false;

    // Debounce only for our blocks
    const now = Date.now();
    const lastTime = lastInteractTime.get(player.name) || 0;
    if (now - lastTime < 500) return true; // Blocked (ignored) but return true to say "handled/cancel"
    lastInteractTime.set(player.name, now);

    // Save Board Location and Trigger Atmosphere
    if (!world.getDynamicProperty("superquester:board_location") || player.isSneaking) {
      world.setDynamicProperty("superquester:board_location", JSON.stringify(block.location));
    }

    // Trigger the "Pitch Black" effect (Defer to next tick to avoid Restricted Execution error)
    system.run(() => {
      try {
        AtmosphereManager.trigger(player);
      } catch (e) { console.warn("Atmos error: " + e); }
    });
    system.run(() => showQuestBoard(player, tab, true)); // true = standalone
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

  // Chat fallback
  const chatEvent = world.beforeEvents?.chatSend;
  if (chatEvent?.subscribe) {
    chatEvent.subscribe((ev) => {
      // Safe Zone Commands (!safezone on/off/status)
      if (ev.message.startsWith("!safezone")) {
        handleSafeZoneCommand(ev);
        return;
      }

      if (ev.message === "!builder") {
        ev.cancel = true;

        if (builderModePlayers.has(ev.sender.name)) {
          builderModePlayers.delete(ev.sender.name);
          system.run(() => ev.sender.sendMessage("§eBuilder Mode: OFF. Quest Board enabled.§r"));
        } else {
          builderModePlayers.add(ev.sender.name);
          system.run(() => ev.sender.sendMessage("§aBuilder Mode: ON. Quest Board disabled (you can now build).§r"));
        }
        return;
      }

      if (ev.message === FALLBACK_COMMAND) {
        ev.cancel = true;
        system.run(() => showQuestBoard(ev.sender));
      }

      // DEBUG: Force Daily Reset
      if (ev.message === "!forcedaily") {
        ev.cancel = true;
        const data = ensureQuestData(ev.sender);
        data.lastRefreshTime = 0; // Force expiry on next access
        PersistenceManager.saveQuestData(ev.sender, data);
        system.run(() => ev.sender.sendMessage("§eDebug: Next board open will trigger 24h refresh.§r"));
      }

      // DEBUG: Register all online player names for leaderboard
      if (ev.message === "!registernames") {
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
    });
  }
}

function bootstrap() {
  // Initialize SuperPoints scoreboard objective
  let objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE_ID);
  if (!objective) {
    objective = world.scoreboard.addObjective(SCOREBOARD_OBJECTIVE_ID, SCOREBOARD_OBJECTIVE_DISPLAY);
  }
  // Display on sidebar so players can see their SP
  try {
    world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective });
  } catch (e) {
    // May fail if already set, that's fine
  }

  wireInteractions();
  world.afterEvents.entityDie.subscribe(handleEntityDeath);
  world.afterEvents.playerBreakBlock.subscribe(handleBlockBreak);
  wireEntityHitTracking();
  registerSafeZoneEvents();
  AtmosphereManager.init();

  // Atlas NPC Interaction
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "quest:npc_interact") return;

    // Find the player who triggered this (nearest player to the entity)
    const entity = ev.sourceEntity;
    if (!entity) return;

    // Get nearest player within 3 blocks
    const nearbyPlayers = entity.dimension.getPlayers({
      location: entity.location,
      maxDistance: 3
    });

    if (nearbyPlayers.length === 0) return;
    const player = nearbyPlayers[0];

    // Debounce check (reuse existing pattern)
    const now = Date.now();
    const lastTime = lastInteractTime.get(player.name + "_npc") || 0;
    if (now - lastTime < 500) return;
    lastInteractTime.set(player.name + "_npc", now);

    // Auto-name the NPC (force correct name on every interaction)
    if (entity.nameTag !== "§5Atlas") {
      entity.nameTag = "§5Atlas";
    }

    // Play Atlas greet sound
    player.playSound("ui.npc_questmaster_greet", { volume: 0.8, pitch: 1.0 });

    // Occasionally play idle sound too (20% chance for flavor)
    if (Math.random() < 0.2) {
      system.runTimeout(() => {
        player.playSound("ui.npc_questmaster_idle", { volume: 0.5, pitch: 1.0 });
      }, 15); // Slight delay (0.75 sec)
    }

    // Show dialog
    showQuestMasterDialog(player);
  });

  // === Admin Command: sq:givesp ===
  // Usage: /scriptevent sq:givesp <player|@s> <amount>
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "sq:givesp") return;

    const source = ev.sourceEntity;
    const args = ev.message.trim().split(/\s+/);

    // Validate args
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
      // Find player by name
      targetPlayer = world.getAllPlayers().find(p => p.name === targetArg);
      if (!targetPlayer) {
        if (source) {
          source.sendMessage(`§cPlayer "${targetArg}" not found or not online.`);
        }
        return;
      }
    }

    // Modify SP
    const oldBalance = getSP(targetPlayer);
    const newBalance = modifySP(targetPlayer, amount);
    const actualDelta = newBalance - oldBalance;

    // Admin feedback
    const sign = actualDelta >= 0 ? "+" : "";
    const feedback = `§a[SP Admin] §r${targetPlayer.name}: ${oldBalance} → ${newBalance} (${sign}${actualDelta})`;

    if (source) {
      source.sendMessage(feedback);
    } else {
      console.log(feedback);
    }
  });

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
          if (data.progress !== count) {
            data.progress = count;
            changed = true; // Save it so UI shows it if we reopen
          }

          // For gather, we do NOT auto-complete.
          updateQuestHud(player, { ...quest, progress: count, goal: quest.requiredCount, status: "active" });
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

  // === TOWN MUSIC ZONE LOOP ===
  // Checks every MUSIC_CHECK_INTERVAL ticks (~0.5 seconds) for player proximity to town
  // Plays music when entering, loops it while inside, stops when leaving
  system.runInterval(() => {
    const currentTick = system.currentTick;

    for (const player of world.getPlayers()) {
      const location = player.location;
      const playerId = player.id;

      // Calculate 2D distance to town center (cylinder check, ignore Y)
      const dx = location.x - TOWN_CENTER.x;
      const dz = location.z - TOWN_CENTER.z;
      const distanceSquared = dx * dx + dz * dz;
      const isInZone = distanceSquared <= (TOWN_RADIUS * TOWN_RADIUS);

      // Get or create player's music state
      let state = playerMusicState.get(playerId);
      if (!state) {
        state = { inZone: false, nextReplayTick: 0 };
        playerMusicState.set(playerId, state);
      }

      if (isInZone) {
        // Player is in the town zone
        if (!state.inZone) {
          // ENTERED the zone - start music!
          state.inZone = true;
          state.nextReplayTick = currentTick + TRACK_DURATION_TICKS;
          try {
            player.runCommandAsync(`playsound ${TOWN_MUSIC_SOUND_ID} @s ~ ~ ~ 0.75 1`);
            // console.warn(`[TownMusic] ${player.name} entered zone - starting music`);
          } catch (e) {
            console.warn(`[TownMusic] Failed to play for ${player.name}: ${e}`);
          }
        } else if (currentTick >= state.nextReplayTick) {
          // STILL in zone and time to loop - replay track!
          state.nextReplayTick = currentTick + TRACK_DURATION_TICKS;
          try {
            player.runCommandAsync(`playsound ${TOWN_MUSIC_SOUND_ID} @s ~ ~ ~ 0.75 1`);
            // console.warn(`[TownMusic] ${player.name} looping music`);
          } catch (e) {
            console.warn(`[TownMusic] Failed to loop for ${player.name}: ${e}`);
          }
        }
        // If still in zone but not time to replay yet, do nothing (music still playing)
      } else {
        // Player is outside the town zone
        if (state.inZone) {
          // LEFT the zone - stop music!
          state.inZone = false;
          state.nextReplayTick = 0;
          try {
            // Stop using stopsound command - target the specific sound
            player.runCommandAsync(`stopsound @s ${TOWN_MUSIC_SOUND_ID}`);
            // console.warn(`[TownMusic] ${player.name} left zone - stopping music`);
          } catch (e) {
            console.warn(`[TownMusic] Failed to stop for ${player.name}: ${e}`);
          }
        }
        // If already outside and music was stopped, do nothing
      }
    }
  }, MUSIC_CHECK_INTERVAL);

  // === RIDICULOUS DOG BARKING ZONE LOOP ===
  // Distance-based intensity: The closer you get, the more dogs you hear!
  // Outer (3-6 blocks): 1 faint track
  // Mid (1-3 blocks): 2 tracks at moderate volume
  // Inner (<1 block): 3 tracks FULL CHAOS + bonus barks
  system.runInterval(() => {
    const currentTick = system.currentTick;

    for (const player of world.getPlayers()) {
      const location = player.location;
      const playerId = player.id;

      // Calculate 3D distance to quest board
      const dx = location.x - QUEST_BOARD_LOCATION.x;
      const dy = location.y - QUEST_BOARD_LOCATION.y;
      const dz = location.z - QUEST_BOARD_LOCATION.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Get or create player's dog bark state
      let state = playerDogBarkState.get(playerId);
      if (!state) {
        state = { inZone: false, nextBarkTick: 0, lastTier: -1 };
        playerDogBarkState.set(playerId, state);
      }

      // Find which tier the player is in (check from innermost to outermost)
      let activeTier = null;
      for (let i = DOG_DISTANCE_TIERS.length - 1; i >= 0; i--) {
        if (distance <= DOG_DISTANCE_TIERS[i].maxDist) {
          activeTier = DOG_DISTANCE_TIERS[i];
          break;
        }
      }

      if (activeTier) {
        // Player is in a bark zone!
        const tierChanged = state.lastTier !== activeTier.maxDist;

        if (!state.inZone || currentTick >= state.nextBarkTick || tierChanged) {
          // ENTERED, tier changed, or time to bark again
          state.inZone = true;
          state.lastTier = activeTier.maxDist;
          state.nextBarkTick = currentTick + DOG_REPLAY_TICKS;

          // Shuffle the sounds array to randomize which tracks play
          const shuffledSounds = [...DOG_SOUNDS].sort(() => Math.random() - 0.5);

          // Play the appropriate number of tracks for this tier
          for (let i = 0; i < activeTier.tracks; i++) {
            const soundId = shuffledSounds[i];
            const delay = Math.floor(Math.random() * 5); // Stagger 0-5 ticks

            system.runTimeout(() => {
              try {
                // Random volume within tier's range
                const volume = activeTier.minVol + Math.random() * (activeTier.maxVol - activeTier.minVol);
                const pitch = 0.8 + Math.random() * 0.4; // 0.8-1.2 pitch
                player.playSound(soundId, { volume, pitch });
              } catch (e) {
                // Silently fail
              }
            }, delay);
          }

          // BONUS: Add extra random barks only in the inner zone (FULL CHAOS mode)
          if (activeTier.maxDist <= 1) {
            for (let i = 0; i < 3; i++) {
              const randomDelay = 10 + Math.floor(Math.random() * 20);
              const randomSound = DOG_SOUNDS[Math.floor(Math.random() * DOG_SOUNDS.length)];
              system.runTimeout(() => {
                try {
                  const volume = activeTier.minVol + Math.random() * (activeTier.maxVol - activeTier.minVol);
                  const pitch = 0.6 + Math.random() * 0.8; // Even more pitch variety for chaos
                  player.playSound(randomSound, { volume, pitch });
                } catch (e) {
                  // Silently fail
                }
              }, randomDelay);
            }
          }

          // console.warn(`[DogZone] ${player.name} in tier ${activeTier.maxDist}m (${activeTier.tracks} tracks)`);
        }
      } else {
        // Player is outside all zones
        if (state.inZone) {
          state.inZone = false;
          state.lastTier = -1;
          state.nextBarkTick = 0;
          // Stop all dog sounds
          DOG_SOUNDS.forEach(soundId => {
            try {
              player.runCommandAsync(`stopsound @s ${soundId}`);
            } catch (e) {
              // Silently fail
            }
          });
          // console.warn(`[DogZone] ${player.name} escaped the dogs`);
        }
      }
    }
  }, DOG_CHECK_INTERVAL);

  // === CAT PROTECTION SQUAD LOOP ===
  // Spawns physical cats around players to protect them from phantom dogs!
  // The closer to the quest board, the more cats spawn
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      const location = player.location;
      const playerId = player.id;

      // Calculate 3D distance to quest board
      const dx = location.x - QUEST_BOARD_LOCATION.x;
      const dy = location.y - QUEST_BOARD_LOCATION.y;
      const dz = location.z - QUEST_BOARD_LOCATION.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Get or create player's cat squad state
      let squad = playerCatSquad.get(playerId);
      if (!squad) {
        squad = { cats: [], lastTier: -1 };
        playerCatSquad.set(playerId, squad);
      }

      // Clean up any invalid (dead/removed) cats from the list
      squad.cats = squad.cats.filter(cat => {
        try {
          return cat.isValid();
        } catch (e) {
          return false;
        }
      });

      // Find which tier the player is in
      let activeTier = null;
      for (let i = CAT_DISTANCE_TIERS.length - 1; i >= 0; i--) {
        if (distance <= CAT_DISTANCE_TIERS[i].maxDist) {
          activeTier = CAT_DISTANCE_TIERS[i];
          break;
        }
      }

      if (activeTier) {
        // Player is in a cat zone!
        const targetCatCount = activeTier.cats;
        const currentCatCount = squad.cats.length;
        const tierChanged = squad.lastTier !== activeTier.maxDist;

        // Spawn more cats if needed
        if (currentCatCount < targetCatCount) {
          const catsToSpawn = targetCatCount - currentCatCount;

          for (let i = 0; i < catsToSpawn; i++) {
            try {
              // Random position around player
              const angle = Math.random() * Math.PI * 2;
              const spawnX = player.location.x + Math.cos(angle) * CAT_SPAWN_RADIUS;
              const spawnZ = player.location.z + Math.sin(angle) * CAT_SPAWN_RADIUS;
              const spawnY = player.location.y + 1; // Spawn 1 block above and let them fall

              // Spawn a random cat variant
              const catType = CAT_VARIANTS[Math.floor(Math.random() * CAT_VARIANTS.length)];

              // Spawn location 1 block above ground
              const spawnLoc = { x: spawnX, y: spawnY, z: spawnZ };

              // Use player's dimension
              const dimension = player.dimension;
              const cat = dimension.spawnEntity("minecraft:cat", spawnLoc);

              if (cat) {
                // Tag for identification - cats wander freely (no sitting!)
                cat.addTag("quest_board_cat");
                cat.addTag("guardian_cat");

                // NO taming - let them be wild and wander around!

                // Add to squad
                squad.cats.push(cat);

                // console.warn(`[CatSquad] Spawned guardian cat for ${player.name}`);
              }
            } catch (e) {
              // console.warn(`[CatSquad] Failed to spawn cat: ${e}`);
            }
          }
        }

        // Remove excess cats if tier decreased
        else if (currentCatCount > targetCatCount) {
          const catsToRemove = currentCatCount - targetCatCount;
          for (let i = 0; i < catsToRemove; i++) {
            const cat = squad.cats.pop();
            try {
              if (cat && cat.isValid()) {
                // Play a poof particle effect before removing
                cat.dimension.spawnParticle("minecraft:explosion_particle", cat.location);
                cat.remove();
              }
            } catch (e) { /* cat already gone */ }
          }
        }

        squad.lastTier = activeTier.maxDist;

      } else {
        // Player is outside all zones - despawn all cats
        if (squad.cats.length > 0) {
          squad.cats.forEach(cat => {
            try {
              if (cat.isValid()) {
                // Poof effect
                cat.dimension.spawnParticle("minecraft:explosion_particle", cat.location);
                cat.remove();
              }
            } catch (e) { /* cat already gone */ }
          });
          squad.cats = [];
          squad.lastTier = -1;
          // console.warn(`[CatSquad] ${player.name} left zone - cats despawned`);
        }
      }
    }
  }, CAT_CHECK_INTERVAL);
}

bootstrap();
