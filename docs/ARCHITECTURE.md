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