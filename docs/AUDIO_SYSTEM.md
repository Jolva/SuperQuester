# SuperQuester Audio System — Technical Reference

> **Last Updated:** 2026-01-16  
> **For:** Future AI agents adding sounds to the Quest System

---

## 📁 File Structure

```
packs/QuestSystemRP/
├── sounds/
│   ├── sound_definitions.json    ← REQUIRED: All sound definitions go here
│   ├── quest/                    ← Ambient/board sounds
│   │   └── magical_beacon.ogg
│   └── ui/                       ← UI and interaction sounds
│       ├── available_open.ogg
│       ├── active_open.ogg
│       ├── legends_open.ogg
│       ├── legends_first_place.ogg
│       ├── npc_questmaster_greet.ogg
│       ├── npc_questmaster_idle.ogg
│       ├── quest_accept_rare.ogg
│       └── quest_accept_legendary.ogg
└── sounds.json                   ← Legacy file (can be empty {})
```

---

## ⚠️ CRITICAL: Sound Files MUST Be in a Subfolder

Bedrock will **silently fail** if audio files are directly in `sounds/`.

❌ **WRONG:** `sounds/my_sound.ogg`  
✅ **CORRECT:** `sounds/ui/my_sound.ogg`

---

## 📝 Adding a New Sound (Step-by-Step)

### Step 1: Add the .ogg file
Place in appropriate subfolder:
- `sounds/ui/` — UI clicks, menu opens, button sounds
- `sounds/quest/` — Quest-related gameplay sounds
- `sounds/npc/` — NPC vocalizations (if you create this folder)
- `sounds/ambient/` — Environmental loops (if you create this folder)

### Step 2: Add definition to `sounds/sound_definitions.json`

```json
"your.sound_id": {
  "category": "ui",
  "sounds": [
    {
      "name": "sounds/ui/your_sound_file",
      "volume": 1.0,
      "load_on_low_memory": true
    }
  ]
}
```

**Category options:** `ui`, `player`, `neutral`, `hostile`, `block`, `ambient`, `music`

**Note:** Path is relative to resource pack root, no `.ogg` extension.

### Step 3: Play in script (main.js or other)

```javascript
player.playSound("your.sound_id", { volume: 0.8, pitch: 1.0 });
```

### Step 4: Deploy
```bash
python tools/cache_buster.py
```

---

## 🔊 Currently Implemented Sounds

| Sound ID | File Path | Trigger Location | Code Location |
|----------|-----------|------------------|---------------|
| `quest.board_ambient` | `sounds/quest/magical_beacon` | Near quest board | `AtmosphereManager.js` |
| `quest.board_chime` | `sounds/quest/magical_beacon` | Near quest board (accent) | `AtmosphereManager.js` |
| `ui.available_open` | `sounds/ui/available_open` | Open Available menu | `main.js:showQuestBoard()` |
| `ui.active_open` | `sounds/ui/active_open` | Open Active menu | `main.js:showQuestBoard()` |
| `ui.legends_open` | `sounds/ui/legends_open` | Open Leaderboard menu | `main.js:showQuestBoard()` |
| `ui.legends_first_place` | `sounds/ui/legends_first_place` | #1 ranked player opens Leaderboard (2s delay, plays for nearby players) | `main.js:showQuestBoard()` |
| `ui.npc_questmaster_greet` | `sounds/ui/npc_questmaster_greet` | Talk to Quest Master | `main.js` (NPC handler) |
| `ui.npc_questmaster_idle` | `sounds/ui/npc_questmaster_idle` | Quest Master flavor (20%) | `main.js` (NPC handler) |
| `quest.accept_rare` | `sounds/ui/quest_accept_rare` | Accept Rare quest | `main.js:handleUiAction()` |
| `quest.accept_legendary` | `sounds/ui/quest_accept_legendary` | Accept Legendary quest | `main.js:handleUiAction()` |
| `quest.abandon` | `sounds/ui/quest_abandon` | Quest abandoned | `main.js:handleQuestAbandon()` |
| `quest.complete_single` | `sounds/ui/quest_complete_single` | Individual quest turn-in | `main.js:handleQuestTurnIn()` |
| `quest.complete_all` | `sounds/ui/quest_complete_all` | All quests complete fanfare | `main.js:triggerQuestClearCelebration()` |
| `quest.reroll` | `sounds/ui/quest_reroll` | Successful quest reroll (free or paid) | `main.js:handleRefresh()` |

---

## 🎛️ Key Code Patterns

### Menu Open Sounds (with tab detection)
Located in `main.js` around line 589:
```javascript
if (playOpenSound) {
  if (tab === BOARD_TABS.AVAILABLE) {
    player.playSound("ui.available_open", { volume: 0.8, pitch: 1.0 });
  } else if (tab === BOARD_TABS.ACTIVE) {
    player.playSound("ui.active_open", { volume: 0.8, pitch: 1.0 });
  } else if (tab === BOARD_TABS.LEADERBOARD) {
    player.playSound("ui.legends_open", { volume: 0.8, pitch: 1.0 });
  }
}
```

### Rarity-Based Quest Acceptance Sounds
Located in `main.js` around line 658:
```javascript
if (def.rarity === "legendary") {
  player.playSound("quest.accept_legendary", { volume: 1.0, pitch: 1.0 });
} else if (def.rarity === "rare") {
  player.playSound("quest.accept_rare", { volume: 1.0, pitch: 1.0 });
} else {
  player.playSound("random.orb", { pitch: 1.0 });  // Vanilla for common
}
```

### Distance-Based Volume Falloff
Located in `AtmosphereManager.js`:
```javascript
const MAX_VOLUME = 1.05;
const FALLOFF_RATE = 0.10;  // 10% per block
const MIN_VOLUME = 0.1;

const volumeMultiplier = Math.max(MIN_VOLUME, 1 - (dist * FALLOFF_RATE));
const currentVolume = MAX_VOLUME * volumeMultiplier;
player.playSound("quest.board_ambient", { volume: currentVolume, pitch: 1.0 });
```

---

## 🎵 Audio File Requirements

| Property | Requirement |
|----------|-------------|
| Format | `.ogg` (Ogg Vorbis) |
| Channels | **Mono** (stereo may cause issues) |
| Sample Rate | 44100 Hz |
| Duration | 0.2s–1.5s for UI, longer for ambient |

**FFmpeg conversion command:**
```bash
ffmpeg -i input.mp3 -ac 1 -ar 44100 -c:a libvorbis -q:a 4 output.ogg
```

---

## 🚫 Common Mistakes

1. **File in wrong folder** → Put in subfolder like `sounds/ui/`, not `sounds/`
2. **Missing definition** → Must add to `sound_definitions.json`
3. **Wrong path** → Paths are relative to pack root, not to sounds folder
4. **Included .ogg extension** → Don't include extension in definition
5. **Forgot cache buster** → Always run `python tools/cache_buster.py`
6. **Stereo audio** → Convert to mono

---

## 📋 Sounds Still Needed

- [ ] `quest_accept_common.ogg` — Common quest acceptance
- [ ] `quest_error.ogg` — Not enough SP / error

### ✅ Completed
- [x] `quest_reroll.ogg` — Successful reroll
- [x] `quest_progress_tick.ogg` — Kill/gather increment (5 variants!)
- [x] `quest_complete_single.ogg` — Individual quest complete
- [x] `quest_complete_all.ogg` — All quests complete fanfare
- [x] `quest_abandon.ogg` — Quest abandoned


---

## 📍 Where to Add New Sound Triggers

| Trigger Type | File | Function/Area |
|--------------|------|---------------|
| Menu opens | `main.js` | `showQuestBoard()` |
| Quest acceptance | `main.js` | `handleUiAction()` → `action.type === "accept"` |
| Quest completion | `main.js` | `markQuestComplete()`, `handleQuestTurnIn()` |
| Quest abandoned | `main.js` | `handleQuestAbandon()` |
| Refresh/reroll | `main.js` | `handleRefresh()` |
| Error feedback | `main.js` | `handleRefresh()` (when SP check fails) |
| Proximity ambient | `AtmosphereManager.js` | `tick()` |
| NPC interaction | `main.js` | Script event handler for `quest:npc_interact` |

---

## ✅ Testing Checklist

1. Add sound file to correct subfolder
2. Add definition to `sound_definitions.json`
3. Add `player.playSound()` call in appropriate location
4. Run `python tools/cache_buster.py`
5. Start server, connect with client
6. Test with `/playsound your.sound_id @s` first
7. Then test actual trigger in-game
