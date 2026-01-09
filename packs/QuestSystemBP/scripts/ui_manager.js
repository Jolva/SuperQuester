import { ActionFormData } from "@minecraft/server-ui";

export function openQuestBoard(player) {
  const form = new ActionFormData()
    .title("Quest Board")
    .body("Welcome adventurer! Select a quest below.")
    // Native support for icons: text, texture_path
    .button("Kill Zombies", "textures/items/diamond_sword")
    .button("Gather Wood", "textures/blocks/log_oak")
    .button("Close");

  form.show(player).then((response) => {
    if (response.canceled) return;
    if (response.selection === 0) player.sendMessage("You accepted: Kill Zombies!");
    if (response.selection === 1) player.sendMessage("You accepted: Gather Wood!");
  });
}
