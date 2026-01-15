import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { ensureObjective } from "./scoreboard.js";
import { getMobType } from "./quests/mobTypes.js";
import { CONFIG } from "./config.js";
import { registerSafeZoneEvents } from "./safeZone.js";
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

// Log on world load (Kept from original main.js)
world.afterEvents.worldInitialize.subscribe(() => {
  console.warn('Quest System BP loaded successfully');
  world.setDefaultSpawnLocation({ x: -319, y: 74, z: 210 });
});

// Load data when player joins
world.afterEvents.playerSpawn.subscribe((ev) => {
  const { player } = ev;
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

// Initialize Daily Quests (Global Daily Quests - REMOVED)
// let currentAvailableQuests = QuestGenerator.generateDailyQuests(3);

/** -----------------------------
 *  Config
 *  ----------------------------- */

// const MAX_ACTIVE_QUESTS = 2; // REMOVED
const FALLBACK_COMMAND = "!quests";
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const SCOREBOARD_OBJECTIVE_ID = "TownQuests";
const SCOREBOARD_OBJECTIVE_DISPLAY = "Town Quests";

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
  switch (rarity) {
    case "legendary":
      return { chat: "§6§l", button: "§6" }; // Gold/Gold
    case "rare":
      return { chat: "§b", button: "§1" }; // Aqua/Dark Blue (Button)
    case "common":
    default:
      return { chat: "§7", button: "§0" }; // Gray/Black
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
        lifetimeSPEarned: 0
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
        lifetimeSPEarned: 0
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
    player.playSound("random.orb", { pitch: 1.2 });
    return true;
  }

  // CASE 2: Paid reroll
  const price = calculateRerollPrice(data.paidRerollsThisCycle);
  const objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE_ID);

  if (!objective || !player.scoreboardIdentity) {
    player.sendMessage("§cError accessing scoreboard.§r");
    return false;
  }

  const currentSP = objective.getScore(player.scoreboardIdentity) ?? 0;

  if (currentSP < price) {
    player.sendMessage(`§cNot enough SP! Need ${price}, have ${currentSP}.§r`);
    player.playSound("note.bass", { pitch: 0.5 });
    return false;
  }

  // Deduct SP and refresh
  objective.setScore(player.scoreboardIdentity, currentSP - price);
  data.paidRerollsThisCycle += 1;
  data.available = QuestGenerator.generateDailyQuests(3);
  data.active = null;
  data.progress = 0;
  data.lastRefreshTime = Date.now();
  PersistenceManager.saveQuestData(player, data);

  const nextPrice = calculateRerollPrice(data.paidRerollsThisCycle);
  player.sendMessage(`§a✓ Rerolled for ${price} SP! Next reroll: ${nextPrice} SP§r`);
  player.playSound("random.orb", { pitch: 1.0 });

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

async function showQuestBoard(player, forcedTab = null, isStandalone = false) {
  player.playSound("item.book.page_turn");
  // ensureQuestData handles expiry now, called inside tab functions too, but calling here helps consistency
  const data = ensureQuestData(player);

  const tab = forcedTab || getPlayerTab(player);
  if (!isStandalone) {
    setPlayerTab(player, tab); // Ensure state is synced only if navigating
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
    await showQuestBoard(player, action.tab, isStandalone);
    return;
  }

  if (action.type === "refresh") {
    const success = handleRefresh(player);
    await showQuestBoard(player, BOARD_TABS.AVAILABLE, isStandalone);
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
        player.playSound("random.totem", { pitch: 1.0 });
        player.playSound("ambient.weather.thunder", { pitch: 0.8 });
        player.dimension.spawnParticle("minecraft:totem_particle", player.location);
        player.sendMessage("§6§l[LEGENDARY CONTRACT ACCEPTED]§r");
      } else if (def.rarity === "rare") {
        player.playSound("random.levelup", { pitch: 1.5 });
        player.dimension.spawnParticle("minecraft:villager_happy", player.location);
      } else {
        player.playSound("random.orb", { pitch: 1.0 });
      }
    }
    return;
  }

  if (action.type === "turnIn") {
    handleQuestTurnIn(player);
    await showQuestBoard(player, BOARD_TABS.ACTIVE, isStandalone);
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
    await showQuestBoard(player, BOARD_TABS.AVAILABLE, isStandalone);
  }
}

async function showManageQuest(player, isStandalone = false) {
  const data = ensureQuestData(player);
  if (!data.active) {
    await showQuestBoard(player, BOARD_TABS.ACTIVE, isStandalone);
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
    await showQuestBoard(player, BOARD_TABS.ACTIVE, isStandalone);
    return;
  }

  if (res.selection === 0) {
    const removed = handleQuestAbandon(player);
    if (removed) {
      const c = getQuestColors(removed.rarity);
      player.sendMessage(`§eAbandoned: ${c.chat}${removed.title}§r`);
    }
    await showQuestBoard(player, BOARD_TABS.ACTIVE, isStandalone);
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
    scored.push({
      name: participant.displayName || participant.name || "Unknown",
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

  // Audio: Triumphant level-up
  player.playSound("random.levelup", { location: pos, volume: 1.0, pitch: 1.2 });

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
  if (reward) {
    // Scoreboard points
    if (reward.scoreboardIncrement) {
      const objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE_ID);
      try {
        if (objective && player.scoreboardIdentity) {
          objective.addScore(player.scoreboardIdentity, reward.scoreboardIncrement);
        }
      } catch (e) {
        console.warn("Failed to update score: " + e);
      }
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
  const spEarned = reward?.scoreboardIncrement ?? 0;
  data.lifetimeCompleted += 1;
  data.lifetimeSPEarned += spEarned;

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
    player.playSound("random.levelup");
    player.dimension.spawnParticle("minecraft:villager_happy", player.location);
  }

  // Clear HUD
  player.onScreenDisplay?.setActionBar?.("");
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
    });
  }
}

function bootstrap() {
  ensureObjective(SCOREBOARD_OBJECTIVE_ID, "dummy", SCOREBOARD_OBJECTIVE_DISPLAY);
  wireInteractions();
  world.afterEvents.entityDie.subscribe(handleEntityDeath);
  world.afterEvents.playerBreakBlock.subscribe(handleBlockBreak);
  wireEntityHitTracking();
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
}

bootstrap();
