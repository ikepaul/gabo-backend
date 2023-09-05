import { GameCard, GameCardDTO } from "./Card";
import Player from "./Player";

type PlayerDTO = Omit<Player, "availableGives" | "cards"> & {
  cards: GameCardDTO[];
};

export default PlayerDTO;

export function toPlayerDTO({
  user,
  cards,
  numOfStartPeeks,
  score,
  calledGabo,
}: Player): PlayerDTO {
  const cardsDTO: GameCardDTO[] = cards.map((c) => ({
    ownerId: user.uid,
    placement: c.placement,
  }));
  return { user, cards: cardsDTO, numOfStartPeeks, score, calledGabo };
}
