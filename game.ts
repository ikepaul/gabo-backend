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

interface InfoGive {
  ownerId: string;
  placement: number;
}

interface Player {
  id: string;
  cards: GameCard[];
  availableGives: InfoGive[];
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
  deck: Card[];
}

interface GameDTO {
  state: GameState;
  activePlayerId: string;
  topCard: Card | undefined;
  players: PlayerDTO[];
  deckSize: number;
}

function gameToDTO(g:Game):GameDTO {
  const {state, players, activePlayerId, pile,deck} = {...g};

  return {state, players, activePlayerId, topCard: pile[0], deckSize: deck.length}
}


export {Value,Suit,Card,GameCard,Player, PlayerDTO,Game, GameDTO, gameToDTO, InfoGive}