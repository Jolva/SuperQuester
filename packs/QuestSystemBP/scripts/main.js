import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { ensureObjective } from "./scoreboard.js";
import { getMobType } from "./quests/mobTypes.js";
import { CONFIG } from "./config.js";
import { registerSafeZoneEvents } from "./safeZone.js";
import { PersistenceManager } from "./systems/PersistenceManager.js";
import { QuestGenerator } from "./systems/QuestGenerator.js";
import { AtmosphereManager } from "./systems/AtmosphereManager.js";

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

// Initialize Daily Quests (V1: On Server Start / Reload)
let currentAvailableQuests = QuestGenerator.generateDailyQuests(3);
console.warn(`[QuestSystem] Generated ${currentAvailableQuests.length} daily quests.`);

/** -----------------------------
 *  Config
 *  ----------------------------- */

const MAX_ACTIVE_QUESTS = 2;
const FALLBACK_COMMAND = "!quests";

const SCOREBOARD_OBJECTIVE_ID = "TownQuests";
const SCOREBOARD_OBJECTIVE_DISPLAY = "Town Quests";

/**
 * Textures
 */
const TEXTURES = {
  TAB_AVAILABLE: "textures/quest_ui/quest_tab_avail.png",
  TAB_ACTIVE: "textures/quest_ui/quest_tab_active.png",
  TAB_LEADERBOARD: "textures/quest_ui/quest_tab_stats.png",
  QUEST_KILL: "textures/quest_ui/cat_slay.png",
  QUEST_MINE: "textures/quest_ui/cat_mine.png",
  QUEST_GATHER: "textures/quest_ui/cat_mine.png",
  DEFAULT: "textures/items/book_writable",
};

// Replaces static QUEST_DEFINITIONS logic
// const QUEST_POOL = Object.values(QUEST_DEFINITIONS);

const BOARD_TABS = {
  AVAILABLE: "available",
  ACTIVE: "active",
  LEADERBOARD: "leaderboard",
};

// Map quest types/logic to specific textures if not directly on definition
function getQuestIcon(def) {
  if (def.icon) return def.icon;
  if (def.type === "kill") return TEXTURES.QUEST_KILL;
  if (def.type === "mine") return TEXTURES.QUEST_MINE;
  if (def.type === "gather") return TEXTURES.QUEST_GATHER;
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

function getPlayerQuests(player) {
  const key = getPlayerKey(player);
  if (!activeQuestsByPlayer.has(key)) activeQuestsByPlayer.set(key, []);
  return activeQuestsByPlayer.get(key);
}

function getQuestDefinition(questId) {
  // Try to find in current daily rotation
  return currentAvailableQuests.find(q => q.id === questId);
}

function createQuestState(definition) {
  // Snapshot ALL definition data so the quest is self-contained and persists even if definition invalidates
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    type: definition.type,
    goal: definition.requiredCount ?? 0,
    progress: 0,
    status: "active",
    acceptedAtMs: Date.now(),

    // Core Logic Data
    targets: definition.targets ? Array.from(definition.targets) : undefined, // Persist Set as Array
    targetBlockIds: definition.targetBlockIds,
    targetItemIds: definition.targetItemIds,
    targetMobId: definition.targetMobId,

    // Reward Data
    reward: definition.reward,

    // Visuals
    icon: definition.icon, // if any
    rarity: definition.rarity
  };
}

function getActiveQuestState(player, questId) {
  return getPlayerQuests(player).find((q) => q.id === questId);
}

function tryAddQuest(player, questId) {
  const questDef = getQuestDefinition(questId);
  if (!questDef) {
    return { ok: false, reason: "§cThat quest is unavailable.§r" };
  }

  const quests = getPlayerQuests(player);

  if (quests.length >= MAX_ACTIVE_QUESTS) {
    return { ok: false, reason: `§cYou can only take up to ${MAX_ACTIVE_QUESTS} quests at a time.§r` };
  }

  if (quests.some((q) => q.id === questDef.id)) {
    return { ok: false, reason: "§eYou already have that quest active.§r" };
  }

  const newState = createQuestState(questDef);
  quests.push(newState);

  if (questDef.type === "kill" || questDef.type === "mine") {
    updateQuestHud(player, newState);
  }

  PersistenceManager.saveQuests(player, quests);

  return { ok: true, quest: newState };
}

function setPlayerTab(player, tab) {
  playerTabState.set(getPlayerKey(player), tab);
}

function getPlayerTab(player) {
  const key = getPlayerKey(player);
  if (playerTabState.has(key)) return playerTabState.get(key);

  // Default logic: if has active quests, go to Active, else Available
  const quests = getPlayerQuests(player);
  const hasActive = quests.some((q) => q.status !== "complete");
  // If they have completed quests effectively they are 'active' until turned in,
  // but let's stick to the requested main tabs.
  // We can merge 'Active' and 'Completed' concepts into 'Active' tab or handle logic.
  // The 'Active' tab will show both in-progress and completed-waiting-turn-in.
  return hasActive ? BOARD_TABS.ACTIVE : BOARD_TABS.AVAILABLE;
}

/** -----------------------------
 *  Quest expiry / abandon
 *  ----------------------------- */

function abandonQuest(player, questId) {
  const quests = getPlayerQuests(player);
  const index = quests.findIndex((quest) => quest.id === questId);
  if (index === -1) return null;

  const [removed] = quests.splice(index, 1);
  PersistenceManager.saveQuests(player, quests);
  player.onScreenDisplay?.setActionBar?.("");
  return removed;
}

function expireQuestsForPlayer(player) {
  const quests = getPlayerQuests(player);
  if (!quests.length) return;

  const expiryMs = CONFIG.questBoard?.expiryMs ?? 1000 * 60 * 60 * 24;
  const now = Date.now();
  const expiredTitles = [];

  for (let i = quests.length - 1; i >= 0; i -= 1) {
    const quest = quests[i];
    if (quest.status === "complete") continue;
    if (typeof quest.acceptedAtMs !== "number") continue;
    if (now - quest.acceptedAtMs < expiryMs) continue;

    quests.splice(i, 1);
    expiredTitles.push(quest.title);
  }

  if (!expiredTitles.length) return;

  for (const title of expiredTitles) {
    player.sendMessage(`§eQuest expired:§r ${title}`);
  }

  const activeQuest = quests.find((q) => (q.type === "kill" || q.type === "mine") && q.status !== "complete");
  if (activeQuest) {
    updateQuestHud(player, activeQuest);
  } else {
    player.onScreenDisplay?.setActionBar?.("");
  }
}

/** -----------------------------
 *  UI helpers
 *  ----------------------------- */

function getAvailableQuestDefinitions(player) {
  const quests = getPlayerQuests(player);
  const activeIds = new Set(quests.map((quest) => quest.id));
  return currentAvailableQuests.filter((def) => !activeIds.has(def.id));
}

function getMyQuests(player) {
  return getPlayerQuests(player);
}

// Tabs structure
const TABS_CONFIG = [
  { id: BOARD_TABS.AVAILABLE, label: "Available", icon: TEXTURES.TAB_AVAILABLE },
  { id: BOARD_TABS.ACTIVE, label: "Active", icon: TEXTURES.TAB_ACTIVE },
  { id: BOARD_TABS.LEADERBOARD, label: "Leaderboard", icon: TEXTURES.TAB_LEADERBOARD },
];

/**
 * Adds the tab navigation buttons at the top of the form.
 * Returns the mapping of indices to actions for these buttons.
 */
function addTabButtons(form, currentTab, actionsList) {
  for (const tab of TABS_CONFIG) {
    const isCurrent = tab.id === currentTab;
    // Minecraft color codes: §l for bold, §r to reset, §8 for dark gray if inactive?
    // User requested: "Use Minecraft color codes (§) and formatting to distinguish... Use bold text (§l) for the current selection."
    const label = isCurrent ? `§l${tab.label}§r` : `${tab.label}`;

    form.button(label, tab.icon);
    actionsList.push({ type: "nav", tab: tab.id });
  }
}

async function showAvailableTab(player, actions, isStandalone = false) {
  const available = getAvailableQuestDefinitions(player);
  const quests = getPlayerQuests(player);

  // If standalone, simplify header, otherwise use full header
  const header = isStandalone ? "" : "§2§l[ AVAILABLE ]§r\n\n";
  const body = [
    `${header}§7Active: ${quests.length}/${MAX_ACTIVE_QUESTS}§r`,
    "",
    available.length ? "§fNew Requests:§r" : "§7No new quests available. Check back later.§r",
  ].join("\n");

  const title = isStandalone ? "§lAvailable Quests§r" : "§lQuest Board§r";

  const form = new ActionFormData()
    .title(title)
    .body(body);

  // 1. Tabs
  if (!isStandalone) {
    addTabButtons(form, BOARD_TABS.AVAILABLE, actions);
  }

  // 2. Content
  for (const def of available) {
    const icon = getQuestIcon(def);
    const colors = getQuestColors(def.rarity);
    // Use button-safe color for the form
    form.button(`${colors.button}${def.title}§r`, icon);
    actions.push({ type: "view_details", questId: def.id, fromStandalone: isStandalone });
  }

  // 3. Close option (always good UX)
  form.button("Close");
  actions.push({ type: "close" });

  return form;
}

async function showActiveTab(player, actions, isStandalone = false) {
  const myQuests = getMyQuests(player);

  const header = isStandalone ? "" : "§2§l[ ACTIVE ]§r\n\n";
  const body = [
    `${header}§7Your Quests (${myQuests.length}/${MAX_ACTIVE_QUESTS}):§r`,
    myQuests.length ? "" : "§7You have no active quests.§r"
  ].join("\n");

  const title = isStandalone ? "§lActive Quests§r" : "§lQuest Board§r";

  const form = new ActionFormData()
    .title(title)
    .body(body);

  // 1. Tabs
  if (!isStandalone) {
    addTabButtons(form, BOARD_TABS.ACTIVE, actions);
  }

  // 2. Content
  for (const quest of myQuests) {
    // For ACTIVE quests, the 'quest' object IS the definition (self-contained now).
    // We don't need getQuestDefinition(quest.id) anymore for active quests.
    const icon = getQuestIcon(quest);
    const colors = getQuestColors(quest.rarity);

    if (quest.status === "complete") {
      form.button(`§aTurn In: ${quest.title}§r`, "textures/quest_ui/quest_tab_done.png");
      actions.push({ type: "turnIn", questId: quest.id, fromStandalone: isStandalone });
    } else {
      // Show progress
      const progressStr = quest.goal > 0 ? `${quest.progress}/${quest.goal}` : "In Progress";
      // Use §8 (Dark Gray) for subtitle text to be readable on button (light gray background)
      form.button(`${colors.button}${quest.title}\n§8${progressStr}§r`, icon);
      // Clicking an active quest gives options (Abandon)
      actions.push({ type: "manage", questId: quest.id, fromStandalone: isStandalone });
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
  expireQuestsForPlayer(player);

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
    // Switch tab - Nav usually implies tab switching so we might drop standalone?
    // But if we have a refresh button under Leaderboard standalone, we want to keep it.
    await showQuestBoard(player, action.tab, isStandalone);
    return;
  }

  if (action.type === "view_details") {
    // Show new details screen
    await showQuestDetails(player, action.questId, isStandalone);
    return;
  }

  if (action.type === "accept") {
    const result = tryAddQuest(player, action.questId);
    if (!result.ok) {
      player.sendMessage(result.reason);
    } else {
      const def = getQuestDefinition(action.questId);
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
    // Refresh the board, respecting standalone state
    await showQuestBoard(player, BOARD_TABS.AVAILABLE, isStandalone);
    return;
  }

  if (action.type === "turnIn") {
    handleQuestTurnIn(player, action.questId);
    await showQuestBoard(player, BOARD_TABS.ACTIVE, isStandalone);
    return;
  }

  if (action.type === "manage") {
    // Show management for specific quest (Abandon)
    await showManageQuest(player, action.questId, isStandalone);
    return;
  }
}

async function showQuestDetails(player, questId, isStandalone = false) {
  const def = getQuestDefinition(questId);
  if (!def) return;

  // Formatting strings
  const scoreRaw = def.reward?.scoreboardIncrement || 0;
  const itemsRaw = def.reward?.rewardItems || [];

  let rewardsStr = "";
  if (scoreRaw > 0) rewardsStr += `\n§e+${scoreRaw} Town Reputation§r`;
  for (const item of itemsRaw) {
    // Attempt to pretty print item name (e.g. minecraft:iron_ingot -> Iron Ingot)
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
    await handleUiAction(player, { type: "accept", questId, fromStandalone: isStandalone });
    return;
  }

  // Decline (Button 2 -> Index 1) or Cancel
  if (res.canceled || res.selection === 1) {
    await showQuestBoard(player, BOARD_TABS.AVAILABLE, isStandalone);
  }
}

async function showManageQuest(player, questId, isStandalone = false) {
  const state = getActiveQuestState(player, questId);
  if (!state) {
    await showQuestBoard(player, BOARD_TABS.ACTIVE, isStandalone);
    return;
  }

  // For Active Quests, 'state' contains all info. We don't use 'def' anymore.
  // const def = getQuestDefinition(questId); (Removed)

  const form = new MessageFormData()
    .title("§cAbandon Quest?")
    .body("Are you sure you want to abandon this quest? Progress will be lost.")
    .button1("Yes")
    .button2("No");

  const res = await form.show(player);
  // Button 1 ("Yes") -> 0
  // Button 2 ("No") -> 1

  if (res.canceled || res.selection === 1) {
    // Button 2 (No) -> 1, or Canceled
    await showQuestBoard(player, BOARD_TABS.ACTIVE, isStandalone);
    return;
  }

  if (res.selection === 0) {
    const removed = abandonQuest(player, questId);
    if (removed) {
      const colors = getQuestColors(removed.rarity);
      player.sendMessage(`§eAbandoned: ${colors.chat}${removed.title}§r`);
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

function updateQuestHud(player, questState) {
  if (questState.status === "complete") {
    player.onScreenDisplay?.setActionBar?.("§aQuest complete! Return to board.§r");
    return;
  }

  if (questState.type === "kill" || questState.type === "mine" || questState.type === "gather") {
    if (questState.goal <= 0) return;
    const remaining = Math.max(questState.goal - questState.progress, 0);
    let icon = "⚔️";
    if (questState.type === "mine") icon = "⛏️";
    if (questState.type === "gather") icon = "🎒";

    player.onScreenDisplay?.setActionBar?.(`§b${icon} ${questState.title}: ${questState.progress}/${questState.goal}§r`);
  }
}

function markQuestComplete(player, questState) {
  if (questState.status === "complete") return;
  questState.status = "complete";
  updateQuestHud(player, questState);

  const colors = getQuestColors(questState.rarity);
  player.sendMessage(`§aQuest Complete: ${colors.chat}${questState.title}§r`);

  PersistenceManager.saveQuests(player, getPlayerQuests(player));
  player.playSound("random.levelup");
  player.dimension.spawnParticle("minecraft:villager_happy", player.location);
}

function handleEntityDeath(ev) {
  const { damageSource, deadEntity } = ev;
  if (!deadEntity) return;

  // 1. Determine Identity
  const fullId = deadEntity.typeId; // e.g. "minecraft:skeleton"
  const simpleId = fullId.replace("minecraft:", ""); // e.g. "skeleton"
  const mobType = getMobType(deadEntity); // e.g. "zombie" (canonical) or undefined

  console.warn(`[DEBUG] Entity Died: ${fullId} (Simple: ${simpleId}, Mapped: ${mobType})`);

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

  const quests = getPlayerQuests(killer);
  for (const quest of quests) {
    if (quest.type !== "kill" || quest.status === "complete") continue;

    // Support Set or Array from persistence
    const targets = Array.isArray(quest.targets) ? new Set(quest.targets) : quest.targets;

    // Debug Log for verification
    if (targets) {
      console.warn(`[DEBUG] Checking Quest: "${quest.title}" Targets: ${JSON.stringify(Array.from(targets))}`);
    }

    // 2. Check Match (Robust)
    let match = false;
    if (targets && targets.has(fullId)) match = true;
    if (targets && targets.has(simpleId)) match = true;
    if (targets && mobType && targets.has(mobType)) match = true;

    if (!match) continue;

    quest.progress += 1;
    console.warn(`[DEBUG] Progress Update: ${quest.progress}/${quest.goal}`);

    if (quest.progress >= quest.goal) {
      quest.progress = quest.goal;
      markQuestComplete(killer, quest);
    } else {
      updateQuestHud(killer, quest);
    }
    PersistenceManager.saveQuests(killer, quests);
  }
}

function handleBlockBreak(ev) {
  const { player, brokenBlockPermutation } = ev;
  const quests = getPlayerQuests(player);

  for (const quest of quests) {
    if (quest.type !== "mine" || quest.status === "complete") continue;

    const blockId = brokenBlockPermutation.type.id;
    // Debug Log
    if (quest.targetBlockIds) {
      console.warn(`[DEBUG] Mine Event: ${blockId} | Checking Quest: "${quest.title}" Targets: ${JSON.stringify(quest.targetBlockIds)}`);
    }

    // Self-contained check
    // quest.targetBlockIds is on the object now
    if (!quest.targetBlockIds?.includes(blockId)) continue;

    quest.progress += 1;
    console.warn(`[DEBUG] Mine Progress: ${quest.progress}/${quest.goal}`);

    if (quest.progress >= quest.goal) {
      quest.progress = quest.goal;
      markQuestComplete(player, quest);
    } else {
      updateQuestHud(player, quest);
    }
    PersistenceManager.saveQuests(player, quests);
  }
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

function handleQuestTurnIn(player, questId) {
  const quests = getPlayerQuests(player);
  const index = quests.findIndex((q) => q.id === questId);
  if (index === -1) return;

  const quest = quests[index];
  if (quest.status !== "complete") {
    player.sendMessage("§eCompletion pending...§r");
    return;
  }

  // Self-contained data
  const reward = quest.reward; // Was definition.reward

  // Check requirements if it's a gather quest
  if (quest.type === "gather" && quest.targetItemIds) {
    const inventory = player.getComponent("inventory")?.container;
    if (!inventory) return;

    // 1. Count Total
    let totalCount = 0;

    console.warn(`[DEBUG] Turn In Scan: Looking for ${JSON.stringify(quest.targetItemIds)}`);

    for (let i = 0; i < inventory.size; i++) {
      const item = inventory.getItem(i);
      if (item) {
        // console.warn(`[DEBUG] Slot ${i}: ${item.typeId} x${item.amount}`);
        if (quest.targetItemIds.includes(item.typeId)) {
          totalCount += item.amount;
          console.warn(`[DEBUG] MATCH! Found ${item.amount} of ${item.typeId}`);
        }
      }
    }

    if (totalCount < quest.goal) {
      player.sendMessage(`§cYou need ${quest.goal - totalCount} more items!§r`);
      return;
    }

    // 2. Consume Items
    let remainingToRemove = quest.goal;
    for (let i = 0; i < inventory.size; i++) {
      if (remainingToRemove <= 0) break;
      const item = inventory.getItem(i);
      if (item && quest.targetItemIds.includes(item.typeId)) {
        if (item.amount <= remainingToRemove) {
          remainingToRemove -= item.amount;
          inventory.setItem(i, undefined); // Remove stack
        } else {
          item.amount -= remainingToRemove;
          remainingToRemove = 0;
          inventory.setItem(i, item); // Update stack
        }
      }
    }

    // Complete the quest state now if it wasn't already (gather quests might not auto-complete on progress)
    quest.status = "complete";
  }

  if (quest.status !== "complete") {
    player.sendMessage("§eCompletion pending...§r");
    return;
  }

  if (reward) {
    // 1. Scoreboard (Script API)
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

    // 2. Items
    if (reward.rewardItems) {
      const inventory = player.getComponent("inventory")?.container;
      if (inventory) {
        for (const rItem of reward.rewardItems) {
          try {
            const itemStack = new ItemStack(rItem.typeId, rItem.amount);
            inventory.addItem(itemStack);
            player.sendMessage(`§aReceived Reward: ${rItem.amount}x ${rItem.typeId.replace("minecraft:", "")}§r`);
          } catch (e) {
            console.warn("Error giving reward: " + e);
            player.sendMessage(`§cInv full or error giving reward: ${rItem.typeId}§r`);
          }
        }
      }
    }
  }

  player.sendMessage(`§aQuest Complete: ${quest.title}§r`);
  PersistenceManager.saveQuests(player, quests);
  player.playSound("random.levelup");
  player.dimension.spawnParticle("minecraft:villager_happy", player.location);

  // Clean up if we want them to stay in "Completed" state or remove them?
  // Current logic: It stays 'complete' in the list until expired or manually removed?
  // Wait, if we just set it to complete, it stays in the list.
  // The original handleQuestTurnInLogic had:
  // quest.status = "complete" -> Then save.
  // Then the 'expireQuestsForPlayer' removes it eventually? Or it stays in "Active" tab as "Turn In"?
  // Wait, if it's "Active" tab, we show "Turn In" button only if status is "complete"?
  // Ah, the logic in handleQuestTurnIn is triggered BY the "Turn In" button.
  // So once we do this logic, we should probably REMOVE it from the list or mark it "Archived"?
  // Original logic:
  // It marked it complete.
  // But wait, the "Turn In" button in `showActiveTab` calls `handleQuestTurnIn`.
  // If `handleQuestTurnIn` just marks it complete AGAIN, that's a loop.
  // Look at original logic. It checked `if (def && def.reward)`. Then it did rewards.
  // Then what? It didn't remove it from the array.
  // `markQuestComplete` sets status to 'complete'.
  // `handleQuestTurnIn` is called when player clicks "Turn In" (which appears when status IS complete).
  // So this function is actually "Claim Rewards".
  // After claiming rewards, we should REMOVE the quest.

  // FIX: Remove quest after claiming rewards in turn-in.
  const removeIdx = quests.findIndex(q => q.id === questId);
  if (removeIdx !== -1) {
    quests.splice(removeIdx, 1);
    PersistenceManager.saveQuests(player, quests);
  }
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
    const now = Date.now();
    for (const [id, data] of lastHitPlayerByEntityId) {
      if (now - data.time > 30000) lastHitPlayerByEntityId.delete(id);
    }
  }, 100);

  // Quest Loop: Inventory Monitor & Persistent HUD (Every 20 ticks / 1 second)
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      const quests = getPlayerQuests(player);
      let changed = false;
      let hudQuest = null;

      for (const quest of quests) {
        // 1. Gather Logic (Active only)
        if (quest.status === "active" && quest.type === "gather" && quest.targetItemIds) {
          const inventory = player.getComponent("inventory")?.container;
          if (inventory) {
            let count = 0;
            for (let i = 0; i < inventory.size; i++) {
              const item = inventory.getItem(i);
              if (item && quest.targetItemIds.includes(item.typeId)) count += item.amount;
            }
            if (quest.progress !== count) {
              quest.progress = count;
              changed = true;

              // If goal met, mark complete
              if (quest.progress >= quest.goal) {
                markQuestComplete(player, quest);
                // markQuestComplete saves, so we can reset changed to avoid double save (though harmless)
                changed = false;
              }
            }
          }
        }

        // 2. HUD Priority Determination
        // Priority A: Any Completed Quest (Show "Return to Board")
        if (quest.status === "complete") {
          hudQuest = quest;
          // We prioritize 'Complete' over 'Active', so we can overwrite any previously found active quest
        }
        // Priority B: Active Quest (Show Progress)
        else if (quest.status === "active" && !hudQuest) {
          // Only pick this if we haven't found a completed quest yet
          // (And if we haven't found another active one? First active one wins for now)
          hudQuest = quest;
        }
        // Note: If we found a completed quest, we keep it as hudQuest and ignore subsequent active ones.
        // If we find ANOTHER completed quest, it overrides the previous completed one (Last finished wins).
      }

      // 3. Update HUD
      if (hudQuest) {
        updateQuestHud(player, hudQuest);
      }

      // 4. Persist Changes
      if (changed) {
        PersistenceManager.saveQuests(player, quests);
      }
    }
  }, 20);
}

bootstrap();
