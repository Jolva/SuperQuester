# AI Context & Developer Notes

## Project Overview
SuperQuester is a Minecraft Bedrock Add-On that implements a procedural quest system. It separates logic (Behavior Pack) from visuals (Resource Pack).

### 🧠 Mental Model for Agents
*   **The Brain:** `main.js` is the central loop. It subscribes to world events and manages the UI flow.
*   **The Memory:** `PersistenceManager.js` saves/loads JSON data to `player.setDynamicProperty`. **We do not use a database.**
*   **The Content:** `QuestData.js` holds the *potential* quests (the "menu"). `QuestGenerator.js` cooks them into *actual* quests (the "meal").
*   **The Face:** `server_form.json` (in RP) is a modified UI definition that overrides vanilla forms to look like a wooden board.

## ⚠️ Critical Architecture Rules (DO NOT BREAK)

### 1. The "Snapshot" Rule
When a player accepts a quest, the **ENTIRE** quest object (Title, Description, Targets, Rewards) is copied into the player's saved data.
*   **WHY?** If we update the code and change/remove a quest ID from `QuestGenerator`, players who already accepted it must NOT lose their quest.
*   **CONSEQUENCE:** Once a quest is active, we read from the *Saved State*, not the *Generator*.

### 2. UI Constraints
*   **No External Libraries:** We use `@minecraft/server-ui`.
*   **Custom Textures:** We map `\uE100` style unicode chars or just use texture paths if the UI supports it (Server Forms support icon paths).
*   **Color Codes:** The UI uses strict Minecraft formatting codes (`§l`, `§r`, etc.).
*   **Button Factory:** The UI is dynamic. `main.js` generates buttons based on available quests.

### 3. Folder Structure quirks
*   `scripts/systems/` is for pure logic classes (`QuestGenerator`, `PersistenceManager`).
*   `scripts/` root contains singleton helpers (`scoreboard.js`, `safeZone.js`) and the entry point.
*   *Note:* Recent refactors moved some files. Always trust `find_by_name` over `PROJECT_MAP.md` if they disagree, but try to keep `PROJECT_MAP.md` updated.

## 🛠️ Debugging Tips for Agents
*   **Content Log:** Errors often appear in the Content Log. If the user says "it's not working", ask for Content Log errors.
*   **Console Logging:** `console.warn()` prints to the chat/log in Bedrock. Use it liberally for flow tracing.
*   **Reloading:** Changes to scripts often require a `/reload` or a world restart. Changes to `JSON` UI or Textures **ALWAYS** require a full game restart (or at least exiting to menu).

## 💡 Common Pitfalls
*   **"Read Only" Properties:** Some API properties are read-only. Always check MDN or the Bedrock Type definitions if unsure.
*   **Undefined Quest Props:** When loading old data, some properties might be missing. Always handle `undefined`.
*   **Inventory Full:** always check if `inventory.add()` succeeds or handle the items dropping on the ground.
