# Personal Quest System: Technical Specification

**Version:** 1.0  
**Date:** January 2026  
**Author:** Quest System Design Team  
**For:** AntiGravity (Implementation)

---

## Table of Contents

1. [Overview](#overview)
2. [Goals & Design Principles](#goals--design-principles)
3. [Data Schema](#data-schema)
4. [State Machine](#state-machine)
5. [Core Functions](#core-functions)
6. [UI Changes](#ui-changes)
7. [Celebration System](#celebration-system)
8. [File-by-File Changes](#file-by-file-changes)
9. [Testing Scenarios](#testing-scenarios)
10. [Phase 2 Parking Lot](#phase-2-parking-lot)

---

## Overview

### Current State

- Quests are generated **globally** at server start via `QuestGenerator.generateDailyQuests(3)`
- All players see the same 3 "Available" quests
- Players can accept up to 2 quests at a time (stored per-player in dynamic properties)
- Quest refresh only happens on server restart

### Target State

- Each player gets their own **personal** pool of 3 available quests
- Quests auto-refresh after **24 real-world hours** if not completed
- Players earn a **free reroll token** by completing all 3 quests
- Players can spend **Super Points (SP)** to buy additional rerolls
- Completing all 3 quests triggers a **celebration** and auto-populates 3 new quests

---

## Goals & Design Principles

1. **Personal Agency** — Players control their own quest destiny
2. **Completion Incentive** — Finishing all 3 rewards you with free content
3. **Economy Sink** — SP has meaningful use beyond leaderboard flex
4. **Clear Mental Model** — Simple rules, predictable behavior
5. **Whole Ass** — No half-measures; full implementation

---

## Data Schema

### New Dynamic Property Key

```
OLD: "superquester:active_data"  →  Array of active quest states
NEW: "superquester:quest_data"   →  Full quest data object (JSON string)
```

### Schema Definition

```javascript
/**
 * @typedef {Object} QuestData
 * @property {Quest[]} available - 3 quest slots (null if accepted/completed)
 * @property {Quest|null} active - Currently active quest (max 1 at a time)
 * @property {number} progress - Progress toward active quest goal
 * @property {number} lastRefreshTime - Unix timestamp (ms) of last refresh
 * @property {boolean} freeRerollAvailable - Single token, does not stack
 * @property {number} paidRerollsThisCycle - Count for price doubling
 * @property {number} lifetimeCompleted - Stats tracking
 * @property {number} lifetimeSPEarned - Stats tracking
 */

// Example stored value:
{
  "available": [
    {
      "id": "kill_zombie_5_uncommon_1705093200000",
      "title": "Kill 7 Zombies",
      "description": "The undead threaten our village...",
      "type": "kill",
      "requiredCount": 7,
      "rarity": "uncommon",
      "targetMobId": "minecraft:zombie",
      "targets": ["zombie", "minecraft:zombie"],
      "reward": {
        "scoreboardIncrement": 2,
        "rewardItems": [{ "typeId": "minecraft:diamond", "amount": 2 }]
      }
    },
    {
      "id": "gather_oak_log_12_common_1705093200001",
      "title": "Gather 12 Oak Log",
      "description": "The carpenter needs supplies...",
      "type": "gather",
      "requiredCount": 12,
      "rarity": "common",
      "targetItemIds": ["minecraft:oak_log"],
      "reward": {
        "scoreboardIncrement": 1,
        "rewardItems": [{ "typeId": "minecraft:iron_ingot", "amount": 1 }]
      }
    },
    null  // Slot 2 was accepted, now empty
  ],
  "active": { /* quest object currently being worked on */ },
  "progress": 3,
  "lastRefreshTime": 1705093200000,
  "freeRerollAvailable": true,
  "paidRerollsThisCycle": 0,
  "lifetimeCompleted": 15,
  "lifetimeSPEarned": 42
}
```

### Quest Object Structure

Unchanged from current implementation. Each quest contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (includes timestamp) |
| `title` | string | Display name |
| `description` | string | Flavor text / lore |
| `type` | string | `"kill"` \| `"mine"` \| `"gather"` |
| `requiredCount` | number | Goal amount |
| `rarity` | string | `"common"` \| `"rare"` \| `"legendary"` |
| `targetMobId` | string? | For kill quests |
| `targets` | string[]? | For kill quests (mob IDs) |
| `targetBlockIds` | string[]? | For mine quests |
| `targetItemIds` | string[]? | For gather quests |
| `reward` | object | `{ scoreboardIncrement, rewardItems }` |

---

## State Machine

### Quest Data Initialization

```
┌─────────────────────────────────────────────────────────────────┐
│              PLAYER ACCESSES QUEST SYSTEM                       │
│        (Board interaction, turn-in, progress update)            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Has questData?       │
                    │  (dynamic property)   │
                    └───────────────────────┘
                       │              │
                      No             Yes
                       │              │
                       ▼              ▼
              ┌─────────────────┐   ┌─────────────────────────────┐
              │ FIRST TIME:     │   │ Check 24h expiry:           │
              │ • Generate 3    │   │ (Date.now() - lastRefresh)  │
              │ • freeReroll=1  │   │       >= 86400000?          │
              │ • Save & return │   └─────────────────────────────┘
              └─────────────────┘            │           │
                                           Yes          No
                                            │           │
                                            ▼           ▼
                              ┌──────────────────┐  (return data)
                              │ AUTO-REFRESH:    │
                              │ • Generate 3     │
                              │ • Clear active   │
                              │ • Reset progress │
                              │ • Reset pricing  │
                              │ • Update timer   │
                              │ • Save & return  │
                              └──────────────────┘
```

### Reroll Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLAYER CLICKS "REFRESH"                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  freeRerollAvailable? │
                    └───────────────────────┘
                       │              │
                      Yes            No
                       │              │
                       ▼              ▼
              ┌─────────────────┐   ┌─────────────────────────────┐
              │ FREE REROLL:    │   │ CALCULATE PRICE:            │
              │ • freeReroll=0  │   │ paidRerolls < 2 → 50 SP     │
              │ • Generate 3    │   │ paidRerolls >= 2 →          │
              │ • Clear active  │   │   50 * 2^(paidRerolls - 1)  │
              │ • Reset pricing │   └─────────────────────────────┘
              │ • Update timer  │              │
              │ • Show message  │              ▼
              └─────────────────┘   ┌───────────────────────┐
                                    │ Player has enough SP? │
                                    └───────────────────────┘
                                       │              │
                                      Yes            No
                                       │              │
                                       ▼              ▼
                              ┌──────────────────┐  ┌──────────────┐
                              │ PAID REROLL:     │  │ "Not enough  │
                              │ • Deduct SP      │  │  SP!" toast  │
                              │ • paidRerolls++  │  └──────────────┘
                              │ • Generate 3     │
                              │ • Clear active   │
                              │ • Update timer   │
                              │ • Show message   │
                              └──────────────────┘
```

### Quest Turn-In Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLAYER TURNS IN QUEST                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Validate completion  │
                    │  (type-specific)      │
                    └───────────────────────┘
                                │
                         (if valid)
                                │
                                ▼
                    ┌───────────────────────┐
                    │ • Give rewards (items)│
                    │ • Add SP to scoreboard│
                    │ • Clear active quest  │
                    │ • Update stats        │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ All 3 slots null?     │
                    │ (all quests turned in)│
                    └───────────────────────┘
                       │              │
                      Yes            No
                       │              │
                       ▼              ▼
              ┌─────────────────┐   ┌──────────────────┐
              │ FULL CLEAR!     │   │ Normal turn-in   │
              │ • Generate 3    │   │ message only     │
              │ • freeReroll=1  │   └──────────────────┘
              │ • Reset pricing │
              │ • Update timer  │
              │ • CELEBRATION!  │
              └─────────────────┘
```

### Reroll Pricing Table

| Paid Reroll # | Cost | Formula |
|---------------|------|---------|
| 1st | 50 SP | Base price |
| 2nd | 50 SP | Base price |
| 3rd | 100 SP | 50 × 2¹ |
| 4th | 200 SP | 50 × 2² |
| 5th | 400 SP | 50 × 2³ |
| 6th | 800 SP | 50 × 2⁴ |
| nth (n>2) | 50 × 2^(n-2) SP | Exponential |

**Price resets when:**
- 24h timer fires (auto-refresh)
- Player earns a free reroll (completing all 3)
- Player uses a free reroll

---

## Core Functions

### PersistenceManager.js — New Methods

```javascript
// NEW KEY (keep old KEY for migration if needed)
static QUEST_DATA_KEY = "superquester:quest_data";

/**
 * Loads the full quest data object for a player.
 * @param {Player} player
 * @returns {QuestData|null}
 */
static loadQuestData(player) {
  if (!player || !player.isValid()) return null;
  try {
    const data = player.getDynamicProperty(this.QUEST_DATA_KEY);
    if (typeof data !== 'string') return null;
    return JSON.parse(data);
  } catch (e) {
    console.warn(`[Persistence] Failed to load quest data for ${player.name}: ${e}`);
    return null;
  }
}

/**
 * Saves the full quest data object for a player.
 * @param {Player} player
 * @param {QuestData} questData
 */
static saveQuestData(player, questData) {
  if (!player || !player.isValid()) return;
  try {
    const data = JSON.stringify(questData);
    player.setDynamicProperty(this.QUEST_DATA_KEY, data);
  } catch (e) {
    console.warn(`[Persistence] Failed to save quest data for ${player.name}: ${e}`);
  }
}
```

### main.js — New/Modified Functions

#### ensureQuestData(player)

```javascript
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Ensures player has valid quest data, creating or refreshing as needed.
 * Call this before any quest system access.
 * @param {Player} player
 * @returns {QuestData}
 */
function ensureQuestData(player) {
  let data = PersistenceManager.loadQuestData(player);
  
  // CASE 1: New player — first time setup
  if (!data) {
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
```

#### calculateRerollPrice(paidRerollsThisCycle)

```javascript
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
```

#### handleRefresh(player)

```javascript
/**
 * Handles the refresh/reroll button click.
 * @param {Player} player
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
```

#### handleQuestAccept(player, questIndex) — Replaces tryAddQuest

```javascript
/**
 * Accepts a quest from the available pool.
 * @param {Player} player
 * @param {number} questIndex - Index in available array (0, 1, or 2)
 * @returns {{ ok: boolean, reason?: string, quest?: Quest }}
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
```

#### handleQuestTurnIn(player) — Modified

```javascript
/**
 * Handles turning in the active quest.
 * @param {Player} player
 */
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
      if (objective && player.scoreboardIdentity) {
        objective.addScore(player.scoreboardIdentity, reward.scoreboardIncrement);
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
```

#### handleQuestAbandon(player)

```javascript
/**
 * Abandons the active quest and returns it to the available pool.
 * @param {Player} player
 * @returns {Quest|null} The abandoned quest, or null if none active
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
  }
  
  data.active = null;
  data.progress = 0;
  PersistenceManager.saveQuestData(player, data);
  
  player.onScreenDisplay?.setActionBar?.("");
  
  return quest;
}
```

---

## UI Changes

### Available Tab — Add Refresh Button

Modify `showAvailableTab()` to include a refresh button with dynamic pricing:

```javascript
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
  
  // 1. Tabs (if not standalone)
  if (!isStandalone) {
    addTabButtons(form, BOARD_TABS.AVAILABLE, actions);
  }
  
  // 2. Quest buttons
  data.available.forEach((quest, index) => {
    if (quest) {
      const icon = getQuestIcon(quest);
      const colors = getQuestColors(quest.rarity);
      form.button(`${colors.button}${quest.title}§r`, icon);
      actions.push({ type: "view_details", questIndex: index, fromStandalone: isStandalone });
    }
  });
  
  // 3. Refresh button
  form.button(refreshLabel, "textures/quest_ui/sp_coin.png");
  actions.push({ type: "refresh", fromStandalone: isStandalone });
  
  // 4. Close
  form.button("Close");
  actions.push({ type: "close" });
  
  return form;
}
```

### Active Tab — Simplified

Since max active is now 1, simplify the display:

```javascript
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
  
  if (!isStandalone) {
    addTabButtons(form, BOARD_TABS.ACTIVE, actions);
  }
  
  if (data.active) {
    const quest = data.active;
    const icon = getQuestIcon(quest);
    const colors = getQuestColors(quest.rarity);
    const isComplete = (quest.type === "gather") 
      ? true  // Gather quests validate on turn-in
      : data.progress >= quest.requiredCount;
    
    if (isComplete) {
      form.button(`§aTurn In: ${quest.title}§r`, "textures/quest_ui/quest_tab_done.png");
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
```

### Handle Refresh Action

Add to `handleUiAction()`:

```javascript
if (action.type === "refresh") {
  const success = handleRefresh(player);
  await showQuestBoard(player, BOARD_TABS.AVAILABLE, action.fromStandalone);
  return;
}
```

---

## Celebration System

```javascript
/**
 * Triggers celebration effects when player completes all 3 quests.
 * @param {Player} player
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
```

### Particle & Sound Reference

| Effect | ID | Notes |
|--------|-----|-------|
| Totem burst | `minecraft:totem_particle` | Green/yellow, dramatic |
| Happy sparkles | `minecraft:villager_happy` | Green, subtle |
| Level up | `random.levelup` | Classic satisfaction |
| Orb pickup | `random.orb` | Good for accents |
| Achievement | `ui.toast.challenge_complete` | Triumphant |

---

## File-by-File Changes

### PersistenceManager.js

| Change | Description |
|--------|-------------|
| Add `QUEST_DATA_KEY` | New constant: `"superquester:quest_data"` |
| Add `loadQuestData()` | Load full quest data object |
| Add `saveQuestData()` | Save full quest data object |
| Keep old methods | `loadQuests()` / `saveQuests()` for migration |

### QuestGenerator.js

| Change | Description |
|--------|-------------|
| No changes needed | `generateDailyQuests(3)` works as-is |
| Consider | Add `generatePersonalQuests()` alias for clarity |

### main.js

| Change | Description |
|--------|-------------|
| Remove `currentAvailableQuests` | No longer global |
| Remove `MAX_ACTIVE_QUESTS` | Now always 1 (active stored in data) |
| Add `ensureQuestData()` | Central data access function |
| Add `calculateRerollPrice()` | Pricing logic |
| Add `handleRefresh()` | Reroll button handler |
| Add `triggerQuestClearCelebration()` | Celebration effects |
| Modify `showAvailableTab()` | Add refresh button, use personal data |
| Modify `showActiveTab()` | Simplify for single active quest |
| Modify `handleUiAction()` | Add "refresh" action type |
| Modify `handleQuestTurnIn()` | Add full-clear detection |
| Modify `handleEntityDeath()` | Use `ensureQuestData()` |
| Modify `handleBlockBreak()` | Use `ensureQuestData()` |
| Modify inventory loop | Use `ensureQuestData()` |
| Modify `playerSpawn` handler | Migrate or initialize data |

### New Assets Needed

| File | Description |
|------|-------------|
| `textures/quest_ui/sp_coin.png` | SP currency icon for refresh button and future UI elements |

---

## Testing Scenarios

### Happy Path

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | New player opens board | 3 quests generated, freeReroll = true |
| 2 | Player accepts quest | Quest moves to active, slot becomes null |
| 3 | Player completes & turns in | Rewards given, slot stays null |
| 4 | Player turns in 3rd quest | CELEBRATION, 3 new quests, freeReroll = true |
| 5 | Player uses free reroll | 3 new quests, freeReroll = false |
| 6 | Player buys reroll (1st) | Costs 50 SP, paidRerolls = 1 |
| 7 | Player buys reroll (3rd) | Costs 100 SP, paidRerolls = 3 |

### Edge Cases

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 8 | 24h passes with 2/3 complete | All quests wiped, 3 new generated, pricing reset |
| 9 | Player abandons quest | Quest returns to available slot |
| 10 | Inventory full on turn-in | Items drop at feet |
| 11 | Player has 0 SP, tries paid reroll | Error message, no change |
| 12 | Server restart mid-quest | Data persists, progress intact |
| 13 | Player completes quest but doesn't turn in before 24h | Quest wiped (teach them to finish work!) |

### Migration

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 14 | Existing player with old data format | Graceful migration or fresh start |

---

## Phase 2 Parking Lot

Items explicitly deferred for future implementation:

| Feature | Notes |
|---------|-------|
| **Pity System** | After X pulls without legendary, guarantee one |
| **SP Sidebar Display** | Permanent icon/counter on screen |
| **Audit Logging** | Console logs for balancing: purchases, rewards |
| **Gacha Capsule System** | Separate document — spend SP for mystery rewards |
| **Gacha Block** | Physical block for capsule purchases |
| **Pull Animations** | Delay + particles for capsule opening |
| **Statistics Tab** | Show lifetimeCompleted, lifetimeSPEarned |

---

## Appendix: Migration Strategy

If you need to support players with existing old-format data:

```javascript
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
      
      // Save new format
      PersistenceManager.saveQuestData(player, data);
      
      player.sendMessage("§e⚡ Quest system upgraded! Your progress has been preserved.§r");
      return data;
    }
    
    // Truly new player — create fresh
    // ... (existing new player logic)
  }
  
  return data;
}
```

---

## Summary

This specification transforms the quest system from a global pool to personal quest ownership. Key changes:

1. **Personal quest pools** — Each player has their own 3 available quests
2. **24h auto-refresh** — Quests reset daily, encouraging regular play
3. **Free reroll token** — Earned by completing all 3, incentivizing completion
4. **Paid rerolls** — SP economy sink with exponential pricing
5. **Celebration system** — Rewarding "full clear" moment with fanfare

The implementation touches primarily `main.js` and `PersistenceManager.js`, with the core `QuestGenerator.js` remaining unchanged.

---

*End of Specification*
