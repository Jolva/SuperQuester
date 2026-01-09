import { world } from "@minecraft/server";

const ensuredObjectives = new Set();

export function ensureObjective(name, criteria = "dummy", displayName) {
  if (!name || ensuredObjectives.has(name)) {
    return;
  }

  ensuredObjectives.add(name);

  const overworld = world.getDimension("overworld");
  if (!overworld) {
    return;
  }

  try {
    if (!world.scoreboard.getObjective(name)) {
      world.scoreboard.addObjective(name, displayName ?? name);
    }
  } catch (e) {
    // Ignore errors if already exists
  }
}
