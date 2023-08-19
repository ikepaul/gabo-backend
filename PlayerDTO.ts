import { GameCard } from "./Card";
import Player from "./Player";

type PlayerDTO = Omit<Player, "availableGives">

export default PlayerDTO;

export function toPlayerDTO(player: Player): PlayerDTO {
  return {id:player.id, cards: player.cards};
}