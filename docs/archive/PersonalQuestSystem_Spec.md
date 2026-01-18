> ⛔ **ARCHIVED — IMPLEMENTED**
> 
> This specification was used during the design phase of the Personal Quest System.
> **The system has been fully implemented** as of January 2026.
> 
> ⚠️ **Do NOT use this document for implementation guidance.**
> The actual code may differ from what's described here.
> 
> For current architecture, see:
> - `docs/ARCHITECTURE.md`
> - `docs/AI_CONTEXT.md`
> - The actual source code in `packs/QuestSystemBP/scripts/main.js`

---

# Personal Quest System: Technical Specification

**Version:** 1.0  
**Date:** January 2026  
**Author:** Quest System Design Team  
**For:** AntiGravity (Implementation)

**STATUS: ✅ IMPLEMENTED**

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

*[Remainder of original spec preserved for historical reference]*
