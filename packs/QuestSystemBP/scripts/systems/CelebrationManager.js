/**
 * CelebrationManager.js
 * Centralized utility for triggering celebrations throughout SuperQuester.
 *
 * Phase 1: Basic SP gain feedback
 * Phase 2: Will add rarity-scaled quest completion celebrations
 */

import { world, system } from "@minecraft/server";

// ============================================
// CONFIGURATION
// ============================================

const CELEBRATION_CONFIG = {
    // Generic SP gain feedback (subtle, frequent)
    spGain: {
        minAmountForEffect: 1,       // minimum SP to trigger any effect
        particleCount: 90,           // Tripled burst
        particleSpread: 2.5,         // horizontal spread
        particleHeight: 1.5,         // vertical spread
        particleType: "minecraft:lava_particle",
        soundVolume: 0.6,
    },
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Trigger subtle feedback for any SP gain.
 * Called from modifySP() - should be lightweight.
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
    for (let burst = 0; burst < 10; burst++) {
        system.runTimeout(() => {
            for (let i = 0; i < config.particleCount; i++) {
                const offset = {
                    x: pos.x + (Math.random() - 0.5) * config.particleSpread,
                    y: pos.y + 1 + Math.random() * config.particleHeight,
                    z: pos.z + (Math.random() - 0.5) * config.particleSpread
                };
                dim.spawnParticle(config.particleType, offset);
            }
        }, burst * 2);  // Burst every 2 ticks for 20 ticks total
    }
    
    // Coin sound (random variant for variety)
    const variant = Math.floor(Math.random() * 3) + 1;
    player.playSound(`celebration.coin_clink_${variant}`, { 
        volume: config.soundVolume, 
        pitch: 0.9 + Math.random() * 0.2
    });
}

/**
 * Placeholder for Phase 2 - quest completion celebration.
 * For now, just calls the basic SP gain effect.
 *
 * @param {Player} player - The player who completed the quest
 * @param {Object} options - Celebration context
 */
export function celebrateQuestComplete(player, options) {
    // Phase 2 will implement full rarity-scaled celebrations
    // For now, delegate to basic SP feedback
    celebrateSPGain(player, options.spAmount || 50);
}