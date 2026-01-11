import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { ensureObjective } from "./scoreboard.js";
import { getMobType } from "./quests/mobTypes.js";
import { CONFIG } from "./config.js";
import { registerSafeZoneEvents } from "./safeZone.js";
import { PersistenceManager } from "./systems/PersistenceManager.js";

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
    const activeKillQuest = quests.find(q => q.type === "kill" && q.status !== "complete");
    if (activeKillQuest) {
      updateKillQuestHud(player, activeKillQuest);
    }
  }
});

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

/**
 * Quest definitions.
 */
const QUEST_DEFINITIONS = {
  kill_zombies_10: {
    id: "kill_zombies_10",
    title: "Kill 10 zombies",
    type: "kill",
    requiredCount: 10,
    targets: new Set(["zombie"]),
    // icon: TEXTURES.QUEST_KILL, // Auto-assigned
    reward: {
      scoreboardIncrement: 1,
      rewardItems: [
        { typeId: "minecraft:diamond", amount: 3 }
      ]
    },
  },
  mine_coal_16: {
    id: "mine_coal_16",
    title: "Mine 16 coal ore",
    type: "mine",
    requiredCount: 16,
    // icon: TEXTURES.QUEST_MINE, // Auto-assigned
  },
  gather_wood_64: {
    id: "gather_wood_64",
    title: "Gather 64 logs",
    type: "gather",
    requiredCount: 64,
    // icon: TEXTURES.QUEST_GATHER, // Auto-assigned
  },
};

const QUEST_POOL = Object.values(QUEST_DEFINITIONS);

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
  return QUEST_DEFINITIONS[questId];
}

function createQuestState(definition) {
  return {
    id: definition.id,
    title: definition.title,
    type: definition.type,
    goal: definition.requiredCount ?? 0,
    progress: 0,
    status: "active",
    acceptedAtMs: Date.now(),
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

  if (questDef.type === "kill") {
    updateKillQuestHud(player, newState);
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

  const activeKillQuest = quests.find((q) => q.type === "kill" && q.status !== "complete");
  if (activeKillQuest) {
    updateKillQuestHud(player, activeKillQuest);
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
  return QUEST_POOL.filter((def) => !activeIds.has(def.id));
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
    form.button(`Accept: ${def.title}`, icon);
    actions.push({ type: "accept", questId: def.id, fromStandalone: isStandalone });
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
    const def = getQuestDefinition(quest.id);
    const icon = def ? getQuestIcon(def) : TEXTURES.DEFAULT;

    if (quest.status === "complete") {
      form.button(`§aTurn In: ${quest.title}§r`, "textures/quest_ui/quest_tab_done.png");
      actions.push({ type: "turnIn", questId: quest.id, fromStandalone: isStandalone });
    } else {
      // Show progress
      const progressStr = quest.goal > 0 ? `${quest.progress}/${quest.goal}` : "In Progress";
      form.button(`${quest.title}\n§7${progressStr}§r`, icon);
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

  if (action.type === "accept") {
    const result = tryAddQuest(player, action.questId);
    if (!result.ok) {
      player.sendMessage(result.reason);
    } else {
      const def = getQuestDefinition(action.questId);
      player.sendMessage(`§aAccepted: ${def.title}§r`);
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
    await showQuestDetails(player, action.questId, isStandalone);
    return;
  }
}

async function showQuestDetails(player, questId, isStandalone = false) {
  const state = getActiveQuestState(player, questId);
  if (!state) {
    await showQuestBoard(player, BOARD_TABS.ACTIVE, isStandalone);
    return;
  }

  const def = getQuestDefinition(questId);
  const form = new MessageFormData()
    .title("§cAbandon Quest?")
    .body("Are you sure you want to abandon this quest? Progress will be lost.")
    .button1("No")
    .button2("Yes");

  const res = await form.show(player);
  if (res.canceled || res.selection === 0) {
    await showQuestBoard(player, BOARD_TABS.ACTIVE, isStandalone);
    return;
  }

  if (res.selection === 1) {
    const removed = abandonQuest(player, questId);
    if (removed) player.sendMessage(`§eAbandoned: ${removed.title}§r`);
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

function updateKillQuestHud(player, questState) {
  if (questState.type !== "kill" || questState.goal <= 0) return;
  const remaining = Math.max(questState.goal - questState.progress, 0);
  if (questState.status === "complete") {
    player.onScreenDisplay?.setActionBar?.("§aQuest complete! Return to board.§r");
  } else {
    player.onScreenDisplay?.setActionBar?.(`§bTarget: ${remaining} remaining§r`);
  }
}

function markQuestComplete(player, questState) {
  if (questState.status === "complete") return;
  questState.status = "complete";
  updateKillQuestHud(player, questState);
  player.sendMessage(`§aQuest Complete: ${questState.title}§r`);
  PersistenceManager.saveQuests(player, getPlayerQuests(player));
  player.playSound("random.levelup");
  player.dimension.spawnParticle("minecraft:villager_happy", player.location);
}

function handleEntityDeath(ev) {
  const { damageSource, deadEntity } = ev;
  if (!deadEntity) return;

  const mobType = getMobType(deadEntity);
  if (!mobType) {
    lastHitPlayerByEntityId.delete(deadEntity.id);
    return;
  }

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
    const def = getQuestDefinition(quest.id);
    if (!def.targets?.has(mobType)) continue;

    quest.progress += 1;
    if (quest.progress >= quest.goal) {
      quest.progress = quest.goal;
      markQuestComplete(killer, quest);
    } else {
      updateKillQuestHud(killer, quest);
    }
    PersistenceManager.saveQuests(killer, quests);
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

  const def = getQuestDefinition(questId);
  if (def && def.reward) {
    // 1. Scoreboard (unchanged)
    if (def.reward.scoreboardIncrement) {
      player.runCommandAsync(`scoreboard players add @s ${SCOREBOARD_OBJECTIVE_ID} ${def.reward.scoreboardIncrement}`).catch(() => { });
    }

    // 2. Items (Inventory API)
    if (def.reward.rewardItems) {
      const inventory = player.getComponent("inventory")?.container;
      for (const itemDef of def.reward.rewardItems) {
        try {
          const itemStack = new ItemStack(itemDef.typeId, itemDef.amount);
          if (inventory) {
            const remainder = inventory.addItem(itemStack);
            // If there's a remainder (inventory full), spawn it
            if (remainder) {
              player.dimension.spawnItem(remainder, player.location);
              player.sendMessage("§eInventory full. Reward dropped at your feet.§r");
            }
          } else {
            // Fallback if no inventory component
            player.dimension.spawnItem(itemStack, player.location);
          }
        } catch (e) {
          console.warn(`Failed to give reward: ${e}`);
          // Last resort fallback
          try {
            const itemStack = new ItemStack(itemDef.typeId, itemDef.amount);
            player.dimension.spawnItem(itemStack, player.location);
          } catch (e2) { }
        }
      }
    }
  }

  quests.splice(index, 1);
  PersistenceManager.saveQuests(player, quests);
  player.onScreenDisplay?.setActionBar?.("");
  player.sendMessage(`§bRewards claimed for: ${quest.title}§r`);
  player.playSound("random.orb");
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
  wireEntityHitTracking();
  registerSafeZoneEvents();

  system.runInterval(() => {
    const now = Date.now();
    for (const [id, data] of lastHitPlayerByEntityId) {
      if (now - data.time > 30000) lastHitPlayerByEntityId.delete(id);
    }
  }, 100);
}

bootstrap();
