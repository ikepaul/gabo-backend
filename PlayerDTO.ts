import { GameCard, GameCardDTO } from "./Card";
import Player from "./Player";

type PlayerDTO = Omit<Player, "availableGives" | "cards"> & {
  cards: GameCardDTO[];
};

export default PlayerDTO;

export function toPlayerDTO(player: Player): PlayerDTO {
  const cardsDTO: GameCardDTO[] = player.cards.map((c) => ({
    ownerId: player.id,
    placement: c.placement,
  }));
  return { id: player.id, cards: cardsDTO };
}
