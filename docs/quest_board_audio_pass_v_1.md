# QuestBoard Audio Pass — v1 (Actionable & 11Labs-Ready)

This document defines a **practical first-pass sound design plan** for the QuestBoard add-on. It is intentionally scoped to sounds that:

- Players will actually hear frequently
- Meaningfully improve UX and game feel
- Can be generated affordably with AI tools like ElevenLabs (~$20 budget)

This is **not** an exhaustive wishlist. Think of it as the *"ship this and it already feels premium"* pass.

---

## 🎧 Sound Design Table (Practical v1)

| File name | When it plays | 11Labs prompt ideas / sound description |
|----------|---------------|-----------------------------------------|
| `quest_board_open.ogg` | Opening the Quest Board UI | Short medieval UI sound, soft parchment page turn mixed with subtle wooden creak, warm and inviting, game UI style |
| `quest_tab_switch.ogg` | Switching tabs (Available / Active / Leaderboard) | Light wooden UI click with paper shuffle, very subtle, non-intrusive, fantasy menu sound |
| `quest_accept_common.ogg` | Accepting a **Common** quest | Soft magical tick with wood and parchment, subtle confirmation sound, low intensity fantasy UI |
| `quest_accept_rare.ogg` | Accepting a **Rare** quest | Bright magical chime, slightly longer than a UI click, uplifting but restrained, fantasy RPG reward tone |
| `quest_accept_legendary.ogg` | Accepting a **Legendary** quest | Epic magical swell, low choir hit with stone and wind, short dramatic sting, fantasy achievement sound |
| `quest_reroll.ogg` | Successful quest reroll | Magical refresh sound, swirling particles, brief whoosh with sparkle, fantasy UI reroll |
| `quest_error.ogg` | Not enough SP / invalid action | Muted bass thud with low wooden knock, gentle denial sound, not harsh, fantasy UI error |
| `quest_progress_tick.ogg` | Kill/gather progress increment | Very subtle UI tick, soft metallic or magical blip, designed for repetition, non-annoying |
| `quest_complete_single.ogg` | Individual quest completed | Short celebratory chime, clean and positive, fantasy RPG completion sound |
| `quest_complete_all.ogg` | All quests completed / celebration phase | Short fanfare, triumphant but compact, brass and choir accent, fantasy victory sting |
| `quest_abandon.ogg` | Quest abandoned | Paper crumple mixed with soft magical fade, subtle disappointment tone, fantasy UI sound |
| `quest_board_ambient.ogg` | Near quest board (looping) | Low mystical ambient hum, stone hall resonance, faint magical energy, seamless loop, fantasy environment |
| `quest_board_chime.ogg` | Periodic proximity accent | Soft magical bell or crystal chime, light and airy, fantasy ambience accent |
| `npc_questmaster_greet.ogg` | Interacting with Quest Master | Friendly non-verbal fantasy NPC vocalization, warm and welcoming, medieval merchant style |
| `npc_questmaster_idle.ogg` | Quest Master idle ambient | Occasional soft NPC hum or throat clear, subtle, non-repeating feel, fantasy village NPC |

---

## 🎯 Usage Notes

- **Keep UI sounds short** (0.2–0.7s). Long tails get annoying fast.
- **Mono, 44.1kHz, OGG** for everything.
- If a sound repeats often, it should almost disappear into muscle memory.
- Epic sounds should be **rare** or they stop feeling epic.

---

## 🚀 Next Logical Expansions (Optional)

Once v1 feels solid, you can expand into:

- Leaderboard-specific sounds (rank up, overtake)
- Milestone achievements (first quest, 10/50/100 quests)
- Subtle progress checkpoint cues (50%, 75%)
- Variant intensity tiers (common → rare → legendary motifs)

But don’t do those until this pass is locked and shipped.

---

**Status:** Ready to execute with ElevenLabs + Ableton
