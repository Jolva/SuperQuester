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

/**
 * Initializes the SPSS (Super Points Super Store) music zone loop.
 * Plays music when players are inside the SPSS store boundaries.
 * 
 * Zone Detection: Uses a 3D bounding box check (rectangular zone).
 * 
 * @param {Object} deps - Dependencies object containing:
 *   - system: Minecraft system API
 *   - world: Minecraft world API
 *   - playerSPSSMusicState: Map tracking per-player SPSS music state
 *   - SPSS_ZONE_BOUNDS: Bounding box { minX, maxX, minY, maxY, minZ, maxZ }
 *   - SPSS_MUSIC_SOUND_ID: Sound ID for SPSS music
 *   - SPSS_TRACK_DURATION_TICKS: Duration of music track in ticks
 *   - SPSS_MUSIC_CHECK_INTERVAL: How often to check player proximity (ticks)
 */
export function initializeSPSSMusicLoop(deps) {
  const {
    system,
    world,
    playerSPSSMusicState,
    SPSS_ZONE_BOUNDS,
    SPSS_MUSIC_SOUND_ID,
    SPSS_TRACK_DURATION_TICKS,
    SPSS_MUSIC_CHECK_INTERVAL
  } = deps;

  system.runInterval(() => {
    const currentTick = system.currentTick;

    for (const player of world.getPlayers()) {
      const location = player.location;
      const playerId = player.id;

      // Check if player is inside the SPSS bounding box
      const isInZone = (
        location.x >= SPSS_ZONE_BOUNDS.minX && location.x <= SPSS_ZONE_BOUNDS.maxX &&
        location.y >= SPSS_ZONE_BOUNDS.minY && location.y <= SPSS_ZONE_BOUNDS.maxY &&
        location.z >= SPSS_ZONE_BOUNDS.minZ && location.z <= SPSS_ZONE_BOUNDS.maxZ
      );

      // Get or create player's SPSS music state
      let state = playerSPSSMusicState.get(playerId);
      if (!state) {
        state = { inZone: false, nextReplayTick: 0 };
        playerSPSSMusicState.set(playerId, state);
      }

      if (isInZone) {
        // Player is in the SPSS zone
        if (!state.inZone) {
          // ENTERED the zone - start music!
          state.inZone = true;
          state.nextReplayTick = currentTick + SPSS_TRACK_DURATION_TICKS;
          try {
            player.runCommandAsync(`playsound ${SPSS_MUSIC_SOUND_ID} @s ~ ~ ~ 0.65 1`);
          } catch (e) {
            console.warn(`[SPSSMusic] Failed to play for ${player.name}: ${e}`);
          }
        } else if (currentTick >= state.nextReplayTick) {
          // STILL in zone and time to loop - replay track!
          state.nextReplayTick = currentTick + SPSS_TRACK_DURATION_TICKS;
          try {
            player.runCommandAsync(`playsound ${SPSS_MUSIC_SOUND_ID} @s ~ ~ ~ 0.65 1`);
          } catch (e) {
            console.warn(`[SPSSMusic] Failed to loop for ${player.name}: ${e}`);
          }
        }
      } else {
        // Player is outside the SPSS zone
        if (state.inZone) {
          // LEFT the zone - stop music!
          state.inZone = false;
          state.nextReplayTick = 0;
          try {
            player.runCommandAsync(`stopsound @s ${SPSS_MUSIC_SOUND_ID}`);
          } catch (e) {
            console.warn(`[SPSSMusic] Failed to stop for ${player.name}: ${e}`);
          }
        }
      }
    }
  }, SPSS_MUSIC_CHECK_INTERVAL);
}
