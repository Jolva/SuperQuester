# Leaderboard Fix: Player Name Registry

## Objective

Fix the "Unknown Player" issue in the leaderboard by implementing a persistent name registry that maps player IDs to display names.

**Current behavior:** Offline players show as "Unknown Player" in the leaderboard.  
**Target behavior:** All players show their actual names, even when offline.

---

## The Problem

When building the leaderboard, we iterate through scoreboard participants:

```javascript
for (const participant of objective.getParticipants()) {
    const entity = participant.getEntity();
    const name = entity?.name;  // ← Returns undefined for offline players!
}
```

The scoreboard stores scores by internal identity, but `getEntity()` only works for **currently online** players. Offline players return `undefined`, so we can't retrieve their names.

---

## The Solution

Create a **world-level name registry** using dynamic properties that maps player IDs to their names. Update it whenever a player joins, and use it as a fallback when building the leaderboard.

```
┌─────────────┐     join/spawn      ┌──────────────────┐
│   Player    │  ────────────────►  │  Name Registry   │
│  (online)   │   save name         │  (world dynprop) │
└─────────────┘                     └──────────────────┘
                                            │
                                            ▼
┌─────────────┐     build list      ┌──────────────────┐
│ Leaderboard │  ◄────────────────  │  Lookup names    │
│   Display   │   use registry      │  (online first)  │
└─────────────┘                     └──────────────────┘
```

---

## Implementation

### Part A: Add Name Registry Helper Functions

Add these functions near your other persistence/utility functions in `main.js`:

```javascript
/**
 * Retrieves the player name registry from world dynamic properties.
 * @returns {Object} Map of player IDs to display names
 */
function getPlayerNameRegistry() {
    try {
        const data = world.getDynamicProperty("playerNameRegistry");
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.warn(`[SuperQuester] Failed to parse name registry: ${e}`);
        return {};
    }
}

/**
 * Saves the player name registry to world dynamic properties.
 * @param {Object} registry - Map of player IDs to display names
 */
function savePlayerNameRegistry(registry) {
    try {
        world.setDynamicProperty("playerNameRegistry", JSON.stringify(registry));
    } catch (e) {
        console.warn(`[SuperQuester] Failed to save name registry: ${e}`);
    }
}

/**
 * Registers or updates a player's name in the registry.
 * Call this on player spawn/join.
 * @param {Player} player
 */
function registerPlayerName(player) {
    const registry = getPlayerNameRegistry();
    registry[player.id] = player.name;
    savePlayerNameRegistry(registry);
}

/**
 * Looks up a player's name from the registry.
 * @param {string} playerId - The player's ID
 * @returns {string|undefined} The player's name, or undefined if not found
 */
function lookupPlayerName(playerId) {
    const registry = getPlayerNameRegistry();
    return registry[playerId];
}
```

---

### Part B: Register Names on Player Join

In the existing `playerSpawn` handler (where `initializePlayerSP()` is called), add a call to register the player's name:

```javascript
world.afterEvents.playerSpawn.subscribe((event) => {
    if (event.initialSpawn) {
        const player = event.player;
        
        // Existing SP initialization
        initializePlayerSP(player);
        
        // NEW: Register player name for leaderboard
        registerPlayerName(player);
        
        // Existing HUD update (with delay)
        system.runTimeout(() => {
            updateSPDisplay(player);
        }, 20);
    }
});
```

**Note:** We register on `initialSpawn` only, not every respawn. This is sufficient since player names don't change mid-session.

---

### Part C: Update Leaderboard Building Logic

Find the code that builds the leaderboard (likely in a function that handles the leaderboard form/display). Update it to use the registry as a fallback:

**Before (current logic):**
```javascript
for (const participant of objective.getParticipants()) {
    const score = objective.getScore(participant);
    const entity = participant.getEntity();
    const displayName = entity?.name ?? "Unknown Player";
    
    leaderboardEntries.push({ name: displayName, score });
}
```

**After (with registry fallback):**
```javascript
for (const participant of objective.getParticipants()) {
    const score = objective.getScore(participant);
    const entity = participant.getEntity();
    
    // Try live entity first, then registry, then fallback
    let displayName;
    if (entity) {
        displayName = entity.name;
    } else {
        // Offline player - try the registry
        // participant.displayName often contains the ID for scoreboard entries
        displayName = lookupPlayerName(participant.displayName) ?? "Unknown Player";
    }
    
    leaderboardEntries.push({ name: displayName, score });
}
```

**Important:** The `participant.displayName` property may contain different values depending on how the score was set. You may need to experiment to find what matches the player ID. Alternatives to try:

```javascript
// Option A: Use displayName directly
displayName = lookupPlayerName(participant.displayName);

// Option B: If scores were set with player.id
displayName = lookupPlayerName(participant.id);

// Option C: Try both
displayName = lookupPlayerName(participant.displayName) 
           ?? lookupPlayerName(participant.id)
           ?? "Unknown Player";
```

---

## Verification Steps

### Test 1: Name Registration
1. Join the world with a player (e.g., "Jolva")
2. Check that no errors appear in console
3. **Internal verification:** The name should now be in the registry

### Test 2: Online Player in Leaderboard
1. Open the leaderboard
2. **Expected:** Your name appears correctly (as before)

### Test 3: Offline Player in Leaderboard
1. Have a second player join and earn some SP
2. Have that player leave the world
3. Open the leaderboard
4. **Expected:** The offline player's name appears correctly (not "Unknown Player")

### Test 4: World Reload Persistence
1. Save and quit the world
2. Rejoin the world
3. Open leaderboard
4. **Expected:** All previously registered players still show correct names

### Test 5: New Player (Never Registered)
1. If possible, test with a completely new player who has a score but was never in the registry
2. **Expected:** Falls back to "Unknown Player" gracefully

---

## Edge Cases to Consider

| Scenario | Expected Behavior |
|----------|-------------------|
| Player changes their Xbox/account name | Old name persists until they rejoin |
| Player joins for first time | Name registered immediately |
| Score exists but player never joined since update | Shows "Unknown Player" (legacy data) |
| Registry corrupted | Falls back gracefully, logs warning |

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Still shows "Unknown Player" | Registry lookup key mismatch | Try different participant properties (see Part C options) |
| Console errors on join | JSON parse failure | Check registry isn't corrupted, reset if needed |
| Names not persisting across reload | Dynamic property not saving | Verify `setDynamicProperty` call succeeds |
| Only some offline players fixed | They joined before this update | They'll be registered next time they join |

### Debug Helper

Add this temporary command to inspect the registry:

```javascript
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "sq:debugnames") {
        const registry = getPlayerNameRegistry();
        console.warn(`[SuperQuester] Name Registry: ${JSON.stringify(registry, null, 2)}`);
        event.sourceEntity?.sendMessage?.(`Registry has ${Object.keys(registry).length} entries`);
    }
});
```

Run with: `/scriptevent sq:debugnames`

---

## Definition of Done

- [ ] `getPlayerNameRegistry()` function exists
- [ ] `savePlayerNameRegistry()` function exists  
- [ ] `registerPlayerName(player)` function exists
- [ ] `lookupPlayerName(playerId)` function exists
- [ ] Player names are registered on initial spawn
- [ ] Leaderboard uses registry fallback for offline players
- [ ] Online players still show correctly
- [ ] Offline players show their actual names
- [ ] Registry persists across world reloads
- [ ] No console errors during normal operation

---

## Files to Modify

| File | Changes |
|------|---------|
| `scripts/main.js` | Add 4 helper functions |
| `scripts/main.js` | Add `registerPlayerName()` call in spawn handler |
| `scripts/main.js` | Update leaderboard building logic |

---

## Notes

- This is additive—it doesn't change how scores are stored or tracked
- Existing players will be registered the next time they join
- The registry is lightweight (just ID → name mappings)
- This pattern could be extended later for other player metadata if needed

---

## Questions?

1. Can you confirm where the leaderboard building logic lives? (Function name / line number)
2. What does `participant.displayName` return in your current code? (This affects the lookup key)
3. Any concerns about dynamic property size limits? (Shouldn't be an issue for family LAN server scale)
