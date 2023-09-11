//This is the info needed for displaying each game in the list of games,
//Change naming, "GameInfo" is a bit misleading

export default interface GameInfo {
  numOfCards: number;
  playerLimit: number;
  playerCount: number;
  spectatorCount: number;
  name: string;
  id: string;
}
