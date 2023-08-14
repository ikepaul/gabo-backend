import { GameCard } from "./Card";

export interface InfoGive {
  ownerId: string;
  placement: number;
}

export default interface Player {
  id: string;
  cards: GameCard[];
  availableGives: InfoGive[];
}

