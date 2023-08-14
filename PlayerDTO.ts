import { GameCard } from "./Card";

export default interface PlayerDTO {
  id: string,
  cards: GameCard[]
};