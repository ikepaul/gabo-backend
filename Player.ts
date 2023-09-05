import { GameCard } from "./Card";
import User from "./User";

export interface InfoGive {
  ownerId: string;
  placement: number;
}

export default interface Player {
  user: User;
  cards: GameCard[];
  availableGives: InfoGive[];
  numOfStartPeeks: number;
  score: number;
  calledGabo: boolean;
}
