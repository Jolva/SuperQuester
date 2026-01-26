/**
 * CelebrationManager.js
 * Centralized utility for triggering celebrations throughout SuperQuester.
 *
 * Phase 1: Basic SP gain feedback ✓ (LOCKED - DO NOT MODIFY)
 * Phase 2: Rarity-scaled quest completion celebrations
 */

import { world, system } from "@minecraft/server";

// ============================================
// CONFIGURATION
// ============================================

const CELEBRATION_CONFIG = {
    // *** PHASE 1: DO NOT MODIFY - Rapid lava burst with 9 waves ***
    spGain: {
        minAmountForEffect: 1,       // minimum SP to trigger any effect
        particleCount: 100,          // 9 waves × 100 = 900 total particles
        particleSpread: 2.5,         // horizontal spread
        particleHeight: 1.5,         // vertical spread
        particleType: "minecraft:lava_particle",  // Golden embers
        soundVolume: 0.6,
    },
    
    // *** PHASE 2: NEW - Quest completion by rarity ***
    questComplete: {
        common: {
            particleCount: 4,
            particleType: "minecraft:villager_happy",
            pattern: "burst",        // burst | ring | spiral
            durationTicks: 1,        // instant
            soundLayers: 1,
            titleCard: false,
        },
        rare: {
            particleCount: 10,
            particleType: "minecraft:villager_happy",
            pattern: "ring",
            durationTicks: 10,       // 0.5 seconds
            soundLayers: 2,
            titleCard: true,
            titleColor: "§9",        // blue
        },
        legendary: {
            particleCount: 20,
            particleType: "minecraft:totem_particle",
            secondaryParticle: "minecraft:end_rod",
            pattern: "spiral",
            durationTicks: 30,       // 1.5 seconds
            soundLayers: 3,
            titleCard: true,
            titleColor: "§6",        // gold
        },
        mythic: {
            particleCount: 30,
            particleType: "minecraft:totem_particle",
            secondaryParticle: "minecraft:end_rod",
            pattern: "spiral",
            durationTicks: 50,       // 2.5 seconds
            soundLayers: 4,
            titleCard: true,
            titleColor: "§d§l",      // bold light purple
            spawnFirework: true,
        }
    },
    
    // Jackpot overlay settings
    jackpot: {
        extraParticles: 15,
        extraDurationTicks: 20,
    },
    
    // Streak bonus overlay
    streak: {
        extraParticles: 5,
    }
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Trigger celebration for quest turn-in.
 * This is the main celebration entry point for PHASE 2.
 * 
 * @param {Player} player - The player who completed the quest
 * @param {Object} options - Celebration context
 * @param {string} options.rarity - "common" | "rare" | "legendary" | "mythic"
 * @param {number} options.spAmount - SP awarded
 * @param {boolean} options.isJackpot - Whether jackpot triggered
 * @param {string|null} options.streakLabel - Streak info if applicable
 */
export function celebrateQuestComplete(player, options) {
    const { rarity, spAmount, isJackpot, streakLabel } = options;
    const config = CELEBRATION_CONFIG.questComplete[rarity] || CELEBRATION_CONFIG.questComplete.common;
    
    // Base celebration
    spawnParticlePattern(player, config);
    playCompletionSounds(player, config, rarity);
    
    if (config.titleCard) {
        showRewardTitle(player, spAmount, config.titleColor);
    }
    
    if (config.spawnFirework) {
        spawnDelayedFirework(player, config.durationTicks);
    }
    
    // Overlay effects for special conditions
    if (isJackpot) {
        overlayJackpotCelebration(player);
    }
    
    if (streakLabel) {
        overlayStreakCelebration(player, streakLabel);
    }
}

// ============================================================================
// PHASE 1 LOCKED SECTION - DO NOT MODIFY
// ============================================================================
// The celebrateSPGain() function below remains unchanged from Phase 1.
// It uses rapid lava particle bursts (9 waves × 100 particles) and is called
// whenever SP is gained. DO NOT ALTER THIS FUNCTION OR ITS CONFIG.
// ============================================================================

/**
 * Trigger subtle feedback for any SP gain.
 * Called from modifySP() - should be lightweight.
 * 
 * PHASE 1 LOCKED - DO NOT MODIFY
 * 
 * @param {Player} player - The player gaining SP
 * @param {number} amount - SP amount gained (positive)
 */
export function celebrateSPGain(player, amount) {
    if (amount < CELEBRATION_CONFIG.spGain.minAmountForEffect) return;
    
    const config = CELEBRATION_CONFIG.spGain;
    const pos = player.location;
    const dim = player.dimension;
    
    // Spawn particles in rapid bursts to create continuous rising effect
    // New particles spawn before old ones turn to ash, hiding the ash phase
    for (let burst = 0; burst < 9; burst++) {
        system.runTimeout(() => {
            for (let i = 0; i < config.particleCount; i++) {
                const offset = {
                    x: pos.x + (Math.random() - 0.5) * config.particleSpread,
                    y: pos.y + 1 + Math.random() * config.particleHeight,
                    z: pos.z + (Math.random() - 0.5) * config.particleSpread
                };
                dim.spawnParticle(config.particleType, offset);
            }
        }, burst * 2);  // Burst every 2 ticks for 18 ticks total
    }
    
    // Coin sound (random variant for variety)
    const variant = Math.floor(Math.random() * 3) + 1;
    player.playSound(`celebration.coin_clink_${variant}`, { 
        volume: config.soundVolume, 
        pitch: 0.9 + Math.random() * 0.2
    });
}

// ============================================================================
// PHASE 2 IMPLEMENTATION - Helper Functions Below
// ============================================================================

// ============================================
// PARTICLE PATTERNS (PRIVATE)
// ============================================

/**
 * Spawn particles in configured pattern over time.
 */
function spawnParticlePattern(player, config) {
    const pos = player.location;
    const dim = player.dimension;
    
    switch (config.pattern) {
        case "burst":
            spawnBurstPattern(dim, pos, config);
            break;
        case "ring":
            spawnRingPattern(dim, pos, config);
            break;
        case "spiral":
            spawnSpiralPattern(dim, pos, config);
            break;
    }
}

/**
 * Instant burst - particles spawn at random offsets immediately.
 * Used for: Common quests
 */
function spawnBurstPattern(dim, pos, config) {
    for (let i = 0; i < config.particleCount; i++) {
        const offset = {
            x: pos.x + (Math.random() - 0.5) * 2,
            y: pos.y + 1 + Math.random() * 1.5,
            z: pos.z + (Math.random() - 0.5) * 2
        };
        dim.spawnParticle(config.particleType, offset);
    }
}

/**
 * Ring pattern - particles spawn in expanding circles over time.
 * Used for: Rare quests
 */
function spawnRingPattern(dim, pos, config) {
    const ticksPerWave = Math.max(1, Math.floor(config.durationTicks / 3));
    const particlesPerWave = Math.floor(config.particleCount / 3);
    
    for (let wave = 0; wave < 3; wave++) {
        system.runTimeout(() => {
            const radius = 1 + wave * 0.5;  // expanding radius
            for (let i = 0; i < particlesPerWave; i++) {
                const angle = (i / particlesPerWave) * Math.PI * 2;
                const offset = {
                    x: pos.x + Math.cos(angle) * radius,
                    y: pos.y + 1 + wave * 0.3,
                    z: pos.z + Math.sin(angle) * radius
                };
                dim.spawnParticle(config.particleType, offset);
            }
        }, wave * ticksPerWave);
    }
}

/**
 * Spiral pattern - particles rise in a helix pattern over time.
 * Used for: Legendary and Mythic quests
 */
function spawnSpiralPattern(dim, pos, config) {
    const totalSteps = Math.min(config.durationTicks, 25);  // cap iterations for performance
    const particlesPerStep = Math.ceil(config.particleCount / totalSteps);
    
    let step = 0;
    const intervalId = system.runInterval(() => {
        if (step >= totalSteps) {
            system.clearRun(intervalId);
            return;
        }
        
        const progress = step / totalSteps;
        const radius = 1.5 - progress * 0.5;  // shrinking spiral
        const height = progress * 3;           // rising
        const baseAngle = progress * Math.PI * 4;  // 2 full rotations
        
        for (let i = 0; i < particlesPerStep; i++) {
            const angle = baseAngle + (i / particlesPerStep) * Math.PI * 0.5;
            const offset = {
                x: pos.x + Math.cos(angle) * radius,
                y: pos.y + 1 + height,
                z: pos.z + Math.sin(angle) * radius
            };
            dim.spawnParticle(config.particleType, offset);
            
            // Secondary particle on alternating steps for legendary+
            if (config.secondaryParticle && i % 2 === 0) {
                dim.spawnParticle(config.secondaryParticle, offset);
            }
        }
        
        step++;
    }, 2);  // every 2 ticks = 10 times per second
}

// ============================================
// SOUND SYSTEM (PRIVATE)
// ============================================

/**
 * Play layered sounds based on rarity.
 */
function playCompletionSounds(player, config, rarity) {
    // Layer 1: Base coin sound (all rarities)
    const variant = Math.floor(Math.random() * 3) + 1;
    player.playSound(`celebration.coin_clink_${variant}`, { volume: 0.8 });
    
    // Layer 2+: Fanfare for rare and above
    if (config.soundLayers >= 2 && rarity !== "common") {
        system.runTimeout(() => {
            player.playSound(`celebration.fanfare_${rarity}`, { volume: 1.0 });
        }, 3);  // slight delay for layering
    }
    
    // Layer 3+: Add existing quest.complete_single for legendary+
    if (config.soundLayers >= 3) {
        system.runTimeout(() => {
            player.playSound("quest.complete_single", { volume: 0.7, pitch: 1.1 });
        }, 8);
    }
    
    // Layer 4: Extra accent for mythic
    if (config.soundLayers >= 4) {
        system.runTimeout(() => {
            player.playSound("random.levelup", { volume: 0.5, pitch: 1.2 });
        }, 15);
    }
}

// ============================================
// TITLE CARDS (PRIVATE)
// ============================================

/**
 * Show floating SP reward via action bar (doesn't interfere with SP HUD display).
 * 
 * CRITICAL: We use action bar instead of setTitle() because the SP display system
 * uses titleraw to send "SPVAL:XX" to the JSON UI. Using setTitle() would override
 * the SP display in the upper right corner.
 */
function showRewardTitle(player, spAmount, colorCode) {
    // Format reward with color and subtitle-style text
    const rewardText = `${colorCode}+${spAmount} SP §7Quest Complete!§r`;
    
    // Show in action bar (stays for 1.5 seconds = 30 ticks)
    player.onScreenDisplay.setActionBar(rewardText);
    
    // Clear after duration to avoid blocking other action bar messages
    system.runTimeout(() => {
        player.onScreenDisplay.setActionBar("");
    }, 30);
}

// ============================================
// SPECIAL EFFECTS (PRIVATE)
// ============================================

/**
 * Spawn a firework after delay (mythic only).
 */
function spawnDelayedFirework(player, delay) {
    system.runTimeout(() => {
        const pos = player.location;
        const dim = player.dimension;
        
        try {
            // Spawn firework rocket entity
            const firework = dim.spawnEntity("minecraft:fireworks_rocket", {
                x: pos.x,
                y: pos.y + 1,
                z: pos.z
            });
            // Firework will auto-explode after a moment
        } catch (e) {
            // Fallback: extra totem particles if firework fails
            for (let i = 0; i < 10; i++) {
                dim.spawnParticle("minecraft:totem_particle", {
                    x: pos.x + (Math.random() - 0.5) * 2,
                    y: pos.y + 2 + Math.random() * 2,
                    z: pos.z + (Math.random() - 0.5) * 2
                });
            }
        }
    }, delay);
}

/**
 * Overlay effect for jackpot wins.
 */
function overlayJackpotCelebration(player) {
    const config = CELEBRATION_CONFIG.jackpot;
    const pos = player.location;
    const dim = player.dimension;
    
    // Extra particle burst after base celebration starts
    system.runTimeout(() => {
        for (let i = 0; i < config.extraParticles; i++) {
            dim.spawnParticle("minecraft:totem_particle", {
                x: pos.x + (Math.random() - 0.5) * 3,
                y: pos.y + 1 + Math.random() * 2,
                z: pos.z + (Math.random() - 0.5) * 3
            });
        }
        
        // Jackpot sound
        player.playSound("celebration.jackpot", { volume: 1.0 });
        
        // Jackpot message in action bar (doesn't interfere with SP display)
        player.onScreenDisplay.setActionBar("§6§l✦ JACKPOT! ✦§r");
        
        // Clear after 2 seconds
        system.runTimeout(() => {
            player.onScreenDisplay.setActionBar("");
        }, 40);
    }, 20);
}

/**
 * Overlay effect for streak bonuses.
 */
function overlayStreakCelebration(player, streakLabel) {
    const config = CELEBRATION_CONFIG.streak;
    
    system.runTimeout(() => {
        player.playSound("celebration.streak", { volume: 0.8 });
        
        // Show streak in action bar (doesn't interfere with SP display)
        player.onScreenDisplay.setActionBar(`§a${streakLabel}§r`);
        
        // Clear after 1.5 seconds
        system.runTimeout(() => {
            player.onScreenDisplay.setActionBar("");
        }, 30);
    }, 35);
}