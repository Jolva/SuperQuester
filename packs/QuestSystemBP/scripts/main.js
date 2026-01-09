import { world, system } from '@minecraft/server';

// Log on world load
world.afterEvents.worldInitialize.subscribe(() => {
  console.warn('Quest System BP loaded successfully');
});

// Minimal lectern detection
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  if (event.block.typeId === 'minecraft:lectern') {
    event.cancel = true;
    const player = event.player;
    system.run(() => {
      console.warn(`[Quest Board] ${player.name} clicked the lectern`);
      player.sendMessage('§6You clicked the Quest Board!');
    });
  }
});
