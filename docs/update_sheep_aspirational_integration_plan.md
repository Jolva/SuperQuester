# Update Sheep™ – Aspirational Integration Plan

> Goal: Integrate the Update Sheep™ NPC as a friendly, protected, stateful interaction point that gates update information behind a one-time Terms of Service agreement.
>
> This document intentionally avoids implementation details and assumes an agent (e.g. Claude Code) will adapt it to the existing project architecture.

---

## 1. Concept Overview

Update Sheep™ is a non-hostile NPC whose primary role is to:
- Present a mandatory Terms of Service (TOS) interaction
- Persist player agreement state
- Provide text-based update summaries once agreement is accepted
- Offer audio feedback for interaction outcomes (accept, decline, return, invalid actions)

The character should feel official, cheerful, and gently persistent.

---

## 2. Core Design Principles

- **One-time consent**: Players only see the TOS flow until they accept.
- **Persistent state**: Agreement status is stored per player.
- **Idempotent interaction**: Repeated interactions produce predictable results.
- **Non-destructive**: Update Sheep cannot be harmed or altered by players.
- **Audio as feedback, not content**: Spoken audio punctuates actions; updates remain text-only.

---

## 3. Player State Model (Per Player)

Suggested abstract state flag:
- `updateSheepTOSAccepted: boolean`

States:
1. **Unseen / Not Accepted**
2. **Declined (but returnable)**
3. **Accepted (terminal)**

Once accepted, the player never re-enters the TOS flow.

---

## 4. Interaction Flow (High-Level)

### 4.1 First Interaction (Not Accepted)
- Trigger introductory audio (`npc_update_sheep_tos_intro.ogg`)
- Display modal UI explaining TOS
- Present two buttons:
  - **Agree**
  - **Do Not Agree**

### 4.2 Decline Path
- Play decline audio (`npc_update_sheep_tos_decline.ogg` or `_v2` on repeat)
- Close UI
- Do not change player state

### 4.3 Return Without Agreement
- Play return reminder audio (`npc_update_sheep_return_not_agreed.ogg`)
- Re-present the same TOS UI

### 4.4 Acceptance Path
- Play acceptance audio (`npc_update_sheep_accept.ogg`)
- Optionally follow with celebratory feedback (`npc_update_sheep_bah_bah.ogg`)
- Persist `updateSheepTOSAccepted = true`
- Transition player to update-summary experience

### 4.5 Post-Acceptance Interaction
- Skip TOS entirely
- Display text-based update summaries
- Optional ambient or acknowledgement audio (`npc_update_sheep_bah.ogg` variants)

---

## 5. Audio Integration (Conceptual)

Audio files act as **UI feedback cues**, not narration.

Suggested usage:
- Intro / Gatekeeping: `npc_update_sheep_tos_intro.ogg`
- Decline (first): `npc_update_sheep_tos_decline.ogg`
- Decline (repeat): `npc_update_sheep_decline_v2.ogg`
- Return reminder: `npc_update_sheep_return_not_agreed.ogg`
- Acceptance: `npc_update_sheep_accept.ogg`
- Non-verbal reactions:
  - Neutral: `npc_update_sheep_bah.ogg`
  - Slightly awkward: `npc_update_sheep_bah_2.ogg`
  - Celebratory / rare: `npc_update_sheep_bah_bah.ogg`

Guideline: Avoid repeating the same bah variant consecutively.

---

## 6. Protection & World Rules

Update Sheep™ should be treated as a protected entity:
- Player damage attempts are intercepted or nullified
- On invalid actions (e.g. attack):
  - Cancel or undo damage
  - Play a short audio cue (e.g. `bah` variant or compliance tone)
  - Optionally show a brief on-screen message

This may reuse or hook into existing protection-zone logic.

---

## 7. UI Responsibilities (Abstract)

The UI system should support:
- Modal dialogs with blocking choice
- Two-button decision layouts
- Text-only update summaries
- Optional lightweight action bar or toast messages

UI presentation details are intentionally left flexible.

---

## 8. Persistence & Save Strategy

Agreement state should:
- Be stored per player
- Persist across sessions
- Be readable by both interaction logic and UI logic

Exact storage mechanism is left to the implementation agent.

---

## 9. Extensibility (Future-Proofing)

This system should allow for:
- New update summary formats
- Additional Update Sheep interactions
- Seasonal or version-based messaging
- Optional re-consent if major updates occur (future consideration)

---

## 10. Non-Goals (Explicit)

- No voiced reading of patch notes
- No complex branching dialogue trees
- No comedic timing logic beyond simple audio selection
- No dependency on exact engine APIs in this document

---

## 11. Handoff Note for Agentic Implementation

This plan defines **intent, flow, and constraints**, not code.

The implementing agent is expected to:
- Map these concepts onto the existing project structure
- Reuse existing systems where possible (UI, protection, persistence)
- Make reasonable technical decisions consistent with the project style

End state success criteria:
- Update Sheep feels consistent, persistent, and non-annoying
- Players understand the agreement gate intuitively
- Audio feedback enhances interactions without overwhelming them

