# SuperQuester Architecture

## Core Philosophy
SuperQuester is a Minecraft Bedrock Add-On focused on persistent, procedurally generated RPG quests.
**Critical Rule:** All gameplay logic runs on the Server side (`@minecraft/server`). UI is handled via `@minecraft/server-ui`.

## System Modules

### 1. Data Layer (`scripts/data/`)
* **Purpose:** Stores static pools of data (Mobs, Items, Lore Templates).
* **Rules:** Pure data exports only. No logic functions.
* **Key Files:** `QuestData.js`.

### 2. Logic Systems (`scripts/systems/`)
* **QuestGenerator.js:** The "Chef." Takes data from the Data Layer and constructs unique Quest Objects.
    * *Note:* Generated quests are transient.
* **PersistenceManager.js:** The "Vault." Handles saving/loading data to `player.setDynamicProperty`.
    * *Critical:* Uses "Self-Contained State." When a quest is accepted, the ENTIRE definition is copied to the player. We do NOT reference definitions by ID after acceptance.
* **AtmosphereManager.js:** The "Vibe." Handles audio loops, particle effects, and status effects based on player location.

### 3. Core Helpers (`scripts/`)
* **scoreboard.js:** Manages scoreboard objectives (e.g., Town Reputation).
* **safeZone.js:** Handles event cancellation for the town hub protection.
* **ui_manager.js:** Utilities for UI construction.

### 4. The Controller (`scripts/main.js`)
* **Purpose:** The central nervous system.
* **Responsibilities:**
    * Initializes the World (Generates Daily Quests).
    * Event Listeners (Entity Death, Block Break, Player Spawn).
    * UI State Machine (Handling Form responses).
    * Coordinates between Systems and Helpers.

## UI Flow
1.  **Board Interact:** Triggers `showQuestBoard`.
2.  **Available Tab:** Displays generated daily quests.
3.  **Selection:** Opens `showQuestDetails` (The Contract).
    * *Action:* Accepting triggers `PersistenceManager.saveQuests`.

---

## SP HUD System

Custom HUD element displaying player's Super Points with a coin icon in the bottom-right corner.

**How It Works:**
1. Script API sends `SPVAL:XX` via `titleraw` command (invisible, 1 tick duration)
2. JSON UI binds to `#hud_title_text_string` global binding
3. String extraction: `('§z' + (#hud_title_text_string - 'SPVAL:'))` strips prefix
4. Stack panel displays coin icon + number

**Key Files:**
- `scripts/main.js` → `updateSPDisplay()` function (sends title)
- `ui/hud_screen.json` → JSON UI binding and layout
- `textures/quest_ui/sp_coin.png` → 32x32 coin icon (displayed at 20x20)

**Called From:**
- `modifySP()` — after every SP change
- Player spawn handler — 1.5s after join

**Important Notes:**
- Sidebar was removed; SP only shows via custom HUD now
- Brief title flash on updates is expected (acceptable trade-off)
- Archived handoff docs in `docs/archive/SP_HUD_*.md`