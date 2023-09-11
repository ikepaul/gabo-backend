import { Card } from "./Card";
import { GameState } from "./Game";
import PlayerDTO from "./PlayerDTO";
import User from "./User";

export default interface GameDTO {
  state: GameState;
  activePlayerId: string;
  topCard: Card | undefined;
  players: PlayerDTO[];
  spectators: User[]; //List of ids
  deckSize: number;
  numOfCards: number;
  id: string;
}
