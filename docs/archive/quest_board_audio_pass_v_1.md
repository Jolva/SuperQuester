> ⛔ **ARCHIVED — SUPERSEDED**
> 
> This was the original audio design wishlist. Most sounds have been implemented.
> 
> **For the current authoritative audio reference, see:**
> `docs/AUDIO_SYSTEM.md`

---

# QuestBoard Audio Pass — v1 (Actionable & 11Labs-Ready)

**STATUS: ✅ MOSTLY IMPLEMENTED**

This document defines a **practical first-pass sound design plan** for the QuestBoard add-on. It is intentionally scoped to sounds that:

- Players will actually hear frequently
- Meaningfully improve UX and game feel
- Can be generated affordably with AI tools like ElevenLabs (~$20 budget)

This is **not** an exhaustive wishlist. Think of it as the *"ship this and it already feels premium"* pass.

---

## 🎧 Sound Design Table (Practical v1)

| File name | When it plays | Status |
|----------|---------------|--------|
| `quest_board_open.ogg` | Opening the Quest Board UI | ✅ Implemented (tab-specific sounds) |
| `quest_tab_switch.ogg` | Switching tabs | ⏸️ Deferred |
| `quest_accept_common.ogg` | Accepting a **Common** quest | ❌ Not implemented |
| `quest_accept_rare.ogg` | Accepting a **Rare** quest | ✅ Implemented |
| `quest_accept_legendary.ogg` | Accepting a **Legendary** quest | ✅ Implemented |
| `quest_reroll.ogg` | Successful quest reroll | ✅ Implemented |
| `quest_error.ogg` | Not enough SP / invalid action | ❌ Not implemented |
| `quest_progress_tick.ogg` | Kill/gather progress increment | ✅ Implemented (5 variants!) |
| `quest_complete_single.ogg` | Individual quest completed | ✅ Implemented |
| `quest_complete_all.ogg` | All quests completed | ✅ Implemented |
| `quest_abandon.ogg` | Quest abandoned | ✅ Implemented |
| `quest_board_ambient.ogg` | Near quest board (looping) | ✅ Implemented |
| `quest_board_chime.ogg` | Periodic proximity accent | ✅ Implemented |
| `npc_questmaster_greet.ogg` | Interacting with Quest Master | ✅ Implemented |
| `npc_questmaster_idle.ogg` | Quest Master idle ambient | ✅ Implemented |

---

*[Original design notes preserved below for historical reference]*
