import { world } from '@minecraft/server';

// Minimal test script to verify pack loading
world.afterEvents.worldInitialize.subscribe(() => {
  console.warn('Quest System BP loaded successfully');
});
