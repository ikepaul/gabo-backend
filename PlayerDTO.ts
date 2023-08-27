import { GameCard, GameCardDTO } from "./Card";
import Player from "./Player";

type PlayerDTO = Omit<Player, "availableGives" | "cards"> & {
  cards: GameCardDTO[];
};

export default PlayerDTO;

export function toPlayerDTO(player: Player): PlayerDTO {
  const cardsDTO: GameCardDTO[] = player.cards.map((c) => ({
    ownerId: player.user.uid,
    placement: c.placement,
  }));
  return { user: player.user, cards: cardsDTO };
}
