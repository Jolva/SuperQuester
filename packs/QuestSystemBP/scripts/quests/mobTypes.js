const MOB_TYPE_MAP = new Map([
  ["minecraft:zombie", "zombie"],
  ["minecraft:drowned", "zombie"],
  ["minecraft:husk", "zombie"],
  // Add future mob identifier to canonical type pairs here.
]);

export function getMobType(entity) {
  if (!entity) {
    return undefined;
  }

  const typeId = typeof entity === "string" ? entity : entity.typeId;
  if (typeof typeId !== "string") {
    return undefined;
  }

  return MOB_TYPE_MAP.get(typeId);
}
