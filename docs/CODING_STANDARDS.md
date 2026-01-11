# Coding Standards & Constraints

## 1. Environment
* **Target:** Minecraft Bedrock Edition (Script API).
* **Syntax:** Modern JavaScript (ES6+). Use `const`/`let`, never `var`.
* **Imports:** Use absolute paths for internal modules (e.g., `./systems/PersistenceManager.js`).

## 2. Forbidden Patterns
* ❌ **NO external UI libraries:** We use raw `ActionFormData` and `MessageFormData`.
* ❌ **NO "inventory menu" hacks:** Do not use chest-GUI hacks. Use Server Forms.
* ❌ **NO vague variables:** Use descriptive names (`questId` vs `id`, `targetBlock` vs `t`).

## 3. Data Integrity Rules
* **Persistence:** Never trust volatile memory. If a quest state changes (progress, completion), call `PersistenceManager.saveQuests` IMMEDIATELY.
* **Snapshotting:** Active quests MUST contain their own `target`, `title`, and `reward` data. Never rely on the `QuestGenerator` to recreate an old quest.

## 4. UI Hacking (The JSON UI)
* We modify `RP/ui/server_form.json` to change the layout.
* **Warning:** This file overrides global vanilla UI. Edits here must be precise.
* **Do not** attempt to generate UI via script that relies on custom textures unless those textures are confirmed to exist in the RP.