/**
 * SPAnimator.js
 * Handles animated SP count-up display with audio feedback.
 * 
 * Uses ease-out curve for satisfying "slot machine" feel.
 * Manages concurrent animations (new SP gain interrupts previous).
 */

import { system } from "@minecraft/server";

// ============================================
// CONFIGURATION
// ============================================

const ANIMATION_CONFIG = {
    // Duration scaling based on SP amount
    timing: {
        minDurationTicks: 6,      // 0.3 seconds minimum
        maxDurationTicks: 40,     // 2.0 seconds maximum
        ticksPerHundredSP: 8,     // Base scaling
    },
    
    // Tick count scaling
    ticks: {
        minTicks: 3,
        maxTicks: 30,
        ticksPerTenSP: 1,         // Roughly 1 tick per 10 SP gained
    },
    
    // Audio settings
    audio: {
        tickVolume: 0.4,          // Subtle, not annoying
        landVolume: 0.7,          // Final tick is louder
        tickPitchBase: 1.0,
        tickPitchVariance: 0.15,  // Slight randomization
        pitchRiseOnProgress: 0.3, // Pitch rises as count approaches target
    },
};

// Track active animations per player to handle interrupts
const activeAnimations = new Map();

// ============================================
// PUBLIC API
// ============================================

/**
 * Animate SP display from oldValue to newValue.
 * 
 * @param {Player} player - The player to update
 * @param {number} oldValue - Starting SP value
 * @param {number} newValue - Target SP value
 * @param {Function} displayCallback - Function to call to update display: (player, value) => void
 */
export function animateCountUp(player, oldValue, newValue, displayCallback) {
    const playerId = player.id;
    const delta = newValue - oldValue;
    
    // Cancel any existing animation for this player
    if (activeAnimations.has(playerId)) {
        const existing = activeAnimations.get(playerId);
        system.clearRun(existing.intervalId);
        // Jump to the previous target before starting new animation
        displayCallback(player, existing.targetValue);
    }
    
    // For negative changes or zero, just instant update
    if (delta <= 0) {
        displayCallback(player, newValue);
        return;
    }
    
    // Calculate animation parameters
    const totalTicks = calculateTickCount(delta);
    const durationTicks = calculateDuration(delta);
    const tickInterval = Math.max(1, Math.floor(durationTicks / totalTicks));
    
    // Generate the value sequence with ease-out curve
    const valueSequence = generateEaseOutSequence(oldValue, newValue, totalTicks);
    
    // Start animation
    let currentTick = 0;
    
    const intervalId = system.runInterval(() => {
        if (currentTick >= valueSequence.length) {
            // Animation complete
            system.clearRun(intervalId);
            activeAnimations.delete(playerId);
            
            // Final display update and "land" sound
            displayCallback(player, newValue);
            playLandSound(player);
            return;
        }
        
        const displayValue = valueSequence[currentTick];
        const progress = currentTick / (valueSequence.length - 1);
        
        // Update display
        displayCallback(player, displayValue);
        
        // Play tick sound (skip first tick, it's the starting value)
        if (currentTick > 0) {
            playTickSound(player, progress);
        }
        
        currentTick++;
    }, tickInterval);
    
    // Store animation state for potential interruption
    activeAnimations.set(playerId, {
        intervalId,
        targetValue: newValue,
        startValue: oldValue,
    });
}

/**
 * Instantly set SP display (no animation).
 * Also cancels any running animation.
 * 
 * @param {Player} player - The player to update
 * @param {number} value - SP value to display
 * @param {Function} displayCallback - Function to call to update display
 */
export function setInstant(player, value, displayCallback) {
    const playerId = player.id;
    
    // Cancel any existing animation
    if (activeAnimations.has(playerId)) {
        system.clearRun(activeAnimations.get(playerId).intervalId);
        activeAnimations.delete(playerId);
    }
    
    displayCallback(player, value);
}

/**
 * Check if player has an active count-up animation.
 * 
 * @param {Player} player 
 * @returns {boolean}
 */
export function isAnimating(player) {
    return activeAnimations.has(player.id);
}

// ============================================
// ANIMATION MATH (PRIVATE)
// ============================================

/**
 * Calculate how many visual ticks (updates) to show.
 */
function calculateTickCount(delta) {
    const config = ANIMATION_CONFIG.ticks;
    const calculated = Math.ceil(delta / 10) * config.ticksPerTenSP;
    return Math.min(config.maxTicks, Math.max(config.minTicks, calculated));
}

/**
 * Calculate total animation duration in ticks.
 */
function calculateDuration(delta) {
    const config = ANIMATION_CONFIG.timing;
    const calculated = Math.ceil(delta / 100) * config.ticksPerHundredSP;
    return Math.min(config.maxDurationTicks, Math.max(config.minDurationTicks, calculated));
}

/**
 * Generate sequence of values with ease-out curve.
 * Ease-out: starts fast, slows down at end (most satisfying for scores).
 * 
 * @param {number} start - Starting value
 * @param {number} end - Ending value
 * @param {number} steps - Number of steps
 * @returns {number[]} Array of integer values
 */
function generateEaseOutSequence(start, end, steps) {
    const sequence = [];
    const delta = end - start;
    
    for (let i = 0; i < steps; i++) {
        // Ease-out cubic: 1 - (1 - t)^3
        const t = i / (steps - 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = Math.round(start + delta * eased);
        sequence.push(value);
    }
    
    // Ensure final value is exact
    sequence[sequence.length - 1] = end;
    
    return sequence;
}

// ============================================
// AUDIO (PRIVATE)
// ============================================

/**
 * Play a counting tick sound.
 * Pitch rises slightly as we approach the target.
 */
function playTickSound(player, progress) {
    const config = ANIMATION_CONFIG.audio;
    
    // Calculate pitch: base + variance + progress rise
    const randomVariance = (Math.random() - 0.5) * config.tickPitchVariance;
    const progressBoost = progress * config.pitchRiseOnProgress;
    const pitch = config.tickPitchBase + randomVariance + progressBoost;
    
    try {
        // Fallback to vanilla sound (custom sounds can be added later)
        player.playSound("random.click", {
            volume: config.tickVolume * 0.5,
            pitch: pitch,
        });
    } catch (e) {
        // Silently fail if sound can't play
    }
}

/**
 * Play the final "landing" sound when count-up completes.
 */
function playLandSound(player) {
    const config = ANIMATION_CONFIG.audio;
    
    try {
        // Fallback to vanilla sound (custom sounds can be added later)
        player.playSound("random.orb", {
            volume: config.landVolume,
            pitch: 1.2,
        });
    } catch (e) {
        // Silently fail if sound can't play
    }
}

// ============================================
// CLEANUP
// ============================================

/**
 * Clear all animations (call on world unload or player leave).
 */
export function clearAllAnimations() {
    for (const [playerId, state] of activeAnimations) {
        system.clearRun(state.intervalId);
    }
    activeAnimations.clear();
}

/**
 * Clear animation for specific player (call on player leave).
 */
export function clearPlayerAnimation(player) {
    const playerId = player.id;
    if (activeAnimations.has(playerId)) {
        system.clearRun(activeAnimations.get(playerId).intervalId);
        activeAnimations.delete(playerId);
    }
}
