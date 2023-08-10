type Suit = "Joker" | "Clubs" | "Diamonds" | "Spades" | "Hearts";
type Value =
  2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | "Jack"
  | "Queen"
  | "King"
  | "Ace"
  | "Joker";

  
interface Card {
  suit: Suit
  value: Value
}

interface GameCard extends Card{
  placement: number
}

interface Player {
  id: string,
  cards: GameCard[]
}

interface PlayerDTO {
  id: string,
  cards: GameCard[]
}


type GameState = "Waiting" | "Playing" | "Finished"

interface Game {
  players: Player[];
  state: GameState;
  activePlayerId: string;
  pile: Card[];
  pickedUpCard: Card |undefined;
}

interface GameDTO {
  state: GameState;
  activePlayerId: string;
  topCard: Card | undefined;
  players: PlayerDTO[];
}

function gameToDTO(g:Game):GameDTO {
  const {state, players, activePlayerId, pile} = {...g};

  return {state, players, activePlayerId, topCard: pile[0]}
}


export {Value,Suit,Card,GameCard,Player, PlayerDTO,Game, GameDTO, gameToDTO}