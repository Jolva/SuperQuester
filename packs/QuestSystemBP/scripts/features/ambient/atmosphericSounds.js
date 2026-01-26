/**
 * atmosphericSounds.js
 * Dog barking and cat spawning ambient systems.
 * 
 * Handles:
 * - Distance-based dog barking (closer = more chaos)
 * - Monkey sounds in core zone
 * - Physical cat spawning around players (cat protection squad)
 * - Cat despawning when leaving zones
 */

// =============================================================================
// DOG BARKING ZONE
// =============================================================================

/**
 * Initializes the dog barking zone loop.
 * Creates distance-based audio chaos near the quest board.
 * 
 * @param {Object} deps - Dependencies object containing:
 *   - system: Minecraft system API
 *   - world: Minecraft world API
 *   - playerDogState: Map tracking per-player dog sound state
 *   - QUEST_BOARD_LOCATION: Quest board coordinates
 *   - DOG_SOUNDS: Array of dog sound IDs
 *   - MONKEY_SOUNDS: Array of monkey sound IDs
 *   - DOG_DISTANCE_TIERS: Array of distance tier configs
 *   - DOG_MAX_RADIUS: Maximum dog zone radius
 *   - DOG_CHECK_INTERVAL: How often to check player proximity (ticks)
 *   - DOG_REPLAY_TICKS: How often to replay sounds while in zone
 */
export function initializeDogBarkingLoop(deps) {
  const {
    system,
    world,
    playerDogState,
    QUEST_BOARD_LOCATION,
    DOG_SOUNDS,
    MONKEY_SOUNDS,
    DOG_DISTANCE_TIERS,
    DOG_MAX_RADIUS,
    DOG_CHECK_INTERVAL,
    DOG_REPLAY_TICKS
  } = deps;

  system.runInterval(() => {
    const currentTick = system.currentTick;

    for (const player of world.getPlayers()) {
      const location = player.location;
      const playerId = player.id;

      // Calculate 2D distance to quest board
      const dx = location.x - QUEST_BOARD_LOCATION.x;
      const dz = location.z - QUEST_BOARD_LOCATION.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // Get or create player's dog state
      let state = playerDogState.get(playerId);
      if (!state) {
        state = { inZone: false, lastTier: -1, nextBarkTick: 0 };
        playerDogState.set(playerId, state);
      }

      // Find which tier the player is in (check from smallest to largest)
      let activeTier = null;
      for (let i = DOG_DISTANCE_TIERS.length - 1; i >= 0; i--) {
        if (distance <= DOG_DISTANCE_TIERS[i].maxDist) {
          activeTier = DOG_DISTANCE_TIERS[i];
          break;
        }
      }

      if (activeTier && distance <= DOG_MAX_RADIUS) {
        // Player is in a dog zone!
        const tierChanged = state.lastTier !== activeTier.maxDist;

        if (!state.inZone || tierChanged) {
          // ENTERED zone or CHANGED tier - play sounds immediately!
          state.inZone = true;
          state.lastTier = activeTier.maxDist;
          state.nextBarkTick = currentTick + DOG_REPLAY_TICKS;

          // Play N tracks based on tier
          for (let i = 0; i < activeTier.tracks; i++) {
            const soundId = DOG_SOUNDS[i % DOG_SOUNDS.length];
            const randomDelay = 5 + Math.floor(Math.random() * 20);

            system.runTimeout(() => {
              try {
                const volume = activeTier.minVol + Math.random() * (activeTier.maxVol - activeTier.minVol);
                const pitch = 0.8 + Math.random() * 0.4;
                player.playSound(soundId, { volume, pitch });
              } catch (e) {
                // Silently fail
              }
            }, randomDelay);
          }

          // Core zone bonus chaos!
          if (activeTier.maxDist <= 2) {
            // Extra barks!
            DOG_SOUNDS.forEach((soundId, idx) => {
              const randomDelay = 10 + Math.floor(Math.random() * 30);
              system.runTimeout(() => {
                try {
                  const volume = 0.03 + Math.random() * 0.025;
                  const pitch = 0.7 + Math.random() * 0.5;
                  player.playSound(soundId, { volume, pitch });
                } catch (e) {
                  // Silently fail
                }
              }, randomDelay);
            });

            // Monkeys join the chaos!
            MONKEY_SOUNDS.forEach(monkeySound => {
              const monkeyDelay = 5 + Math.floor(Math.random() * 15);
              system.runTimeout(() => {
                try {
                  const volume = 0.15 + Math.random() * 0.1;
                  const pitch = 0.9 + Math.random() * 0.3;
                  player.playSound(monkeySound, { volume, pitch });
                } catch (e) {
                  // Silently fail
                }
              }, monkeyDelay);
            });
          }

        } else if (currentTick >= state.nextBarkTick) {
          // Time to replay!
          state.nextBarkTick = currentTick + DOG_REPLAY_TICKS;

          for (let i = 0; i < activeTier.tracks; i++) {
            const soundId = DOG_SOUNDS[i % DOG_SOUNDS.length];
            const randomDelay = 5 + Math.floor(Math.random() * 20);

            system.runTimeout(() => {
              try {
                const volume = activeTier.minVol + Math.random() * (activeTier.maxVol - activeTier.minVol);
                const pitch = 0.8 + Math.random() * 0.4;
                player.playSound(soundId, { volume, pitch });
              } catch (e) {
                // Silently fail
              }
            }, randomDelay);
          }

          // Core zone bonus!
          if (activeTier.maxDist <= 2) {
            MONKEY_SOUNDS.forEach(monkeySound => {
              const monkeyDelay = 5 + Math.floor(Math.random() * 15);
              system.runTimeout(() => {
                try {
                  const volume = 0.15 + Math.random() * 0.1;
                  const pitch = 0.9 + Math.random() * 0.3;
                  player.playSound(monkeySound, { volume, pitch });
                } catch (e) {
                  // Silently fail
                }
              }, monkeyDelay);
            });
          }
        }

      } else {
        // Player is outside all zones
        if (state.inZone) {
          state.inZone = false;
          state.lastTier = -1;
          state.nextBarkTick = 0;

          // Stop all dog sounds
          DOG_SOUNDS.forEach(soundId => {
            try {
              player.runCommandAsync(`stopsound @s ${soundId}`);
            } catch (e) {
              // Silently fail
            }
          });

          // Stop monkey sounds
          MONKEY_SOUNDS.forEach(soundId => {
            try {
              player.runCommandAsync(`stopsound @s ${soundId}`);
            } catch (e) {
              // Silently fail
            }
          });
        }
      }
    }
  }, DOG_CHECK_INTERVAL);
}

// =============================================================================
// CAT PROTECTION SQUAD
// =============================================================================

/**
 * Initializes the cat spawning loop.
 * Spawns physical cats around players to "protect" them from phantom dogs.
 * 
 * @param {Object} deps - Dependencies object containing:
 *   - system: Minecraft system API
 *   - world: Minecraft world API
 *   - playerCatSquad: Map tracking per-player cat entities
 *   - QUEST_BOARD_LOCATION: Quest board coordinates
 *   - CAT_DISTANCE_TIERS: Array of distance tier configs
 *   - CAT_MAX_RADIUS: Maximum cat zone radius
 *   - CAT_CHECK_INTERVAL: How often to check player proximity (ticks)
 *   - CAT_SPAWN_RADIUS: Radius around player to spawn cats
 *   - CAT_VARIANTS: Array of cat variant IDs
 */
export function initializeCatSquadLoop(deps) {
  const {
    system,
    world,
    playerCatSquad,
    QUEST_BOARD_LOCATION,
    CAT_DISTANCE_TIERS,
    CAT_MAX_RADIUS,
    CAT_CHECK_INTERVAL,
    CAT_SPAWN_RADIUS,
    CAT_VARIANTS
  } = deps;

  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      const location = player.location;
      const playerId = player.id;

      // Calculate 3D distance to quest board
      const dx = location.x - QUEST_BOARD_LOCATION.x;
      const dy = location.y - QUEST_BOARD_LOCATION.y;
      const dz = location.z - QUEST_BOARD_LOCATION.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Get or create player's cat squad state
      let squad = playerCatSquad.get(playerId);
      if (!squad) {
        squad = { cats: [], lastTier: -1 };
        playerCatSquad.set(playerId, squad);
      }

      // Clean up any invalid (dead/removed) cats from the list
      squad.cats = squad.cats.filter(cat => {
        try {
          return cat.isValid();
        } catch (e) {
          return false;
        }
      });

      // Find which tier the player is in
      let activeTier = null;
      for (let i = CAT_DISTANCE_TIERS.length - 1; i >= 0; i--) {
        if (distance <= CAT_DISTANCE_TIERS[i].maxDist) {
          activeTier = CAT_DISTANCE_TIERS[i];
          break;
        }
      }

      if (activeTier) {
        // Player is in a cat zone!
        const targetCatCount = activeTier.cats;
        const currentCatCount = squad.cats.length;

        // Spawn more cats if needed
        if (currentCatCount < targetCatCount) {
          const catsToSpawn = targetCatCount - currentCatCount;

          for (let i = 0; i < catsToSpawn; i++) {
            try {
              // Random position around player
              const angle = Math.random() * Math.PI * 2;
              const spawnX = player.location.x + Math.cos(angle) * CAT_SPAWN_RADIUS;
              const spawnZ = player.location.z + Math.sin(angle) * CAT_SPAWN_RADIUS;
              const spawnY = player.location.y + 1;

              const spawnLoc = { x: spawnX, y: spawnY, z: spawnZ };
              const dimension = player.dimension;
              const cat = dimension.spawnEntity("minecraft:cat", spawnLoc);

              if (cat) {
                cat.addTag("quest_board_cat");
                cat.addTag("guardian_cat");
                squad.cats.push(cat);
              }
            } catch (e) {
              // Silently fail
            }
          }
        }

        // Remove excess cats if tier decreased
        else if (currentCatCount > targetCatCount) {
          const catsToRemove = currentCatCount - targetCatCount;
          for (let i = 0; i < catsToRemove; i++) {
            const cat = squad.cats.pop();
            try {
              if (cat && cat.isValid()) {
                cat.dimension.spawnParticle("minecraft:explosion_particle", cat.location);
                cat.remove();
              }
            } catch (e) { /* cat already gone */ }
          }
        }

        squad.lastTier = activeTier.maxDist;

      } else {
        // Player is outside all zones - despawn all cats
        if (squad.cats.length > 0) {
          squad.cats.forEach(cat => {
            try {
              if (cat.isValid()) {
                cat.dimension.spawnParticle("minecraft:explosion_particle", cat.location);
                cat.remove();
              }
            } catch (e) { /* cat already gone */ }
          });
          squad.cats = [];
          squad.lastTier = -1;
        }
      }
    }
  }, CAT_CHECK_INTERVAL);
}
