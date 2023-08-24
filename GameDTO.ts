import { Card } from "./Card";
import { GameState } from "./Game";
import PlayerDTO from "./PlayerDTO";

export default interface GameDTO {
  state: GameState;
  activePlayerId: string;
  topCard: Card | undefined;
  players: PlayerDTO[];
  spectators: string[]; //List of ids
  deckSize: number;
  numOfCards: number;
};