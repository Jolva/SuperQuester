/**
 * music.js
 * Town music zone system - plays ambient music when players enter the town area.
 * 
 * Handles:
 * - Music zone detection (proximity to quest board)
 * - Music playback with seamless looping
 * - Music stop on zone exit
 * - Per-player music state tracking
 */

// =============================================================================
// MUSIC SYSTEM
// =============================================================================

/**
 * Initializes the town music zone loop.
 * Checks player proximity to the quest board and manages music playback.
 * 
 * @param {Object} deps - Dependencies object containing:
 *   - system: Minecraft system API
 *   - world: Minecraft world API
 *   - playerMusicState: Map tracking per-player music state
 *   - QUEST_BOARD_LOCATION: Quest board coordinates
 *   - TOWN_RADIUS: Music zone radius
 *   - TOWN_MUSIC_SOUND_ID: Sound ID for town music
 *   - TRACK_DURATION_TICKS: Duration of music track in ticks
 *   - MUSIC_CHECK_INTERVAL: How often to check player proximity (ticks)
 */
export function initializeTownMusicLoop(deps) {
  const {
    system,
    world,
    playerMusicState,
    QUEST_BOARD_LOCATION,
    TOWN_RADIUS,
    TOWN_MUSIC_SOUND_ID,
    TRACK_DURATION_TICKS,
    MUSIC_CHECK_INTERVAL
  } = deps;

  system.runInterval(() => {
    const currentTick = system.currentTick;

    for (const player of world.getPlayers()) {
      const location = player.location;
      const playerId = player.id;

      // Calculate 2D distance to town center (cylinder check, ignore Y)
      const dx = location.x - QUEST_BOARD_LOCATION.x;
      const dz = location.z - QUEST_BOARD_LOCATION.z;
      const distanceSquared = dx * dx + dz * dz;
      const isInZone = distanceSquared <= (TOWN_RADIUS * TOWN_RADIUS);

      // Get or create player's music state
      let state = playerMusicState.get(playerId);
      if (!state) {
        state = { inZone: false, nextReplayTick: 0 };
        playerMusicState.set(playerId, state);
      }

      if (isInZone) {
        // Player is in the town zone
        if (!state.inZone) {
          // ENTERED the zone - start music!
          state.inZone = true;
          state.nextReplayTick = currentTick + TRACK_DURATION_TICKS;
          try {
            player.runCommandAsync(`playsound ${TOWN_MUSIC_SOUND_ID} @s ~ ~ ~ 0.75 1`);
          } catch (e) {
            console.warn(`[TownMusic] Failed to play for ${player.name}: ${e}`);
          }
        } else if (currentTick >= state.nextReplayTick) {
          // STILL in zone and time to loop - replay track!
          state.nextReplayTick = currentTick + TRACK_DURATION_TICKS;
          try {
            player.runCommandAsync(`playsound ${TOWN_MUSIC_SOUND_ID} @s ~ ~ ~ 0.75 1`);
          } catch (e) {
            console.warn(`[TownMusic] Failed to loop for ${player.name}: ${e}`);
          }
        }
      } else {
        // Player is outside the town zone
        if (state.inZone) {
          // LEFT the zone - stop music!
          state.inZone = false;
          state.nextReplayTick = 0;
          try {
            player.runCommandAsync(`stopsound @s ${TOWN_MUSIC_SOUND_ID}`);
          } catch (e) {
            console.warn(`[TownMusic] Failed to stop for ${player.name}: ${e}`);
          }
        }
      }
    }
  }, MUSIC_CHECK_INTERVAL);
}
