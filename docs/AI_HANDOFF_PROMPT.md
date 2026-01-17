# SuperQuester — AI Handoff Prompt

Copy and paste this entire prompt to continue work on the SuperQuester audio system (or any other feature).

---

## 🎮 Project Context

I'm working on **SuperQuester**, a Minecraft Bedrock add-on that implements a Daily Quest System. It uses the Script API (@minecraft/server, @minecraft/server-ui) with custom entities, blocks, and UI.

**Key Directories:**
- `packs/QuestSystemBP/` — Behavior Pack (scripts, entities, blocks)
- `packs/QuestSystemRP/` — Resource Pack (textures, sounds, UI)
- `docs/` — Documentation for AI agents

**Main Files:**
- `packs/QuestSystemBP/scripts/main.js` — Core quest logic and UI
- `packs/QuestSystemBP/scripts/systems/AtmosphereManager.js` — Proximity effects near quest board
- `packs/QuestSystemRP/sounds/sound_definitions.json` — All custom sound definitions

---

## 🔊 Audio System Status

We've implemented a custom audio system. **CRITICAL KNOWLEDGE:**

1. Sound files MUST be in a **subfolder** within `sounds/` (e.g., `sounds/ui/`, `sounds/quest/`)
2. The `sound_definitions.json` file goes in `sounds/` folder (not pack root)
3. Paths in definitions are relative to resource pack root (e.g., `sounds/ui/my_sound`)
4. Audio must be **mono .ogg** files at 44100Hz

**See:** `docs/AUDIO_SYSTEM.md` for complete technical reference.

**Currently Implemented Sounds:**
- Menu open sounds (Available, Active, Leaderboard)
- Quest Master NPC greet and idle
- Quest accept sounds (Rare, Legendary)
- Quest board proximity ambient with distance-based volume falloff

**Still Needed (from `docs/quest_board_audio_pass_v_1.md`):**
- Common quest accept
- Reroll success
- Error/denial
- Progress tick
- Quest complete (single and all)
- Quest abandon

---

## 🛠️ Development Workflow

```bash
# After any changes:
python tools/cache_buster.py

# Start server:
./bedrock_server.exe

# Test sounds in-game:
/playsound your.sound_id @s
```

---

## 📝 Current Task

[DESCRIBE YOUR CURRENT TASK HERE]

Examples:
- "Add the quest_error.ogg sound that plays when a player doesn't have enough SP to reroll"
- "Implement the quest completion celebration sounds"
- "Add a new sound for [specific trigger]"

---

## 📚 Key Documentation to Read First

1. `docs/AUDIO_SYSTEM.md` — How to add sounds (critical)
2. `docs/quest_board_audio_pass_v_1.md` — Sound design wishlist
3. `docs/ARCHITECTURE.md` — Overall project structure
4. `docs/AI_CONTEXT.md` — General AI context

---

## ⚠️ Important Constraints

- Use `python tools/cache_buster.py` after every change
- Don't modify `manifest.json` UUIDs manually (cache buster handles this)
- Audio files must be mono OGG in a subfolder
- Test with `/playsound` command before testing full trigger

---
