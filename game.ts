import { Card, getRandomDeck, shuffle } from "./Card";
import GameDTO from "./GameDTO";
import Player from "./Player";
import { v4 as uuidv4 } from "uuid";

export type GameState = "Waiting" | "Playing" | "Finished";
export type Ability =
  | "look-self"
  | "look-other"
  | "swap-then-look"
  | "look-then-swap";
const maxNumOfCards = 8;
const minNumOfCards = 1;
const maxPlayerLimit = 4;
const minPlayerLimit = 1;
export default class Game {
  players: Player[];
  spectators: string[]; //List of ids
  state: GameState;
  activePlayerId: string;
  activeAbility: Ability | "";
  hasLooked: boolean;
  pile: Card[];
  pickedUpCard: Card | undefined;
  pickedFromPile: boolean;
  deck: Card[];
  id: string;
  numOfCards: number;
  playerLimit: number;

  constructor(numOfCards: number, playerLimit: number) {
    if (numOfCards > maxNumOfCards) {
      numOfCards = maxNumOfCards;
    }
    if (numOfCards < minNumOfCards) {
      numOfCards = minNumOfCards;
    }
    if (playerLimit > maxPlayerLimit) {
      playerLimit = maxPlayerLimit;
    }
    if (playerLimit < minPlayerLimit) {
      playerLimit = minPlayerLimit;
    }
    this.players = [];
    this.spectators = [];
    this.activePlayerId = "";
    this.pickedUpCard = undefined;
    this.pickedFromPile = false;
    this.activeAbility = "";
    this.hasLooked = false;
    this.pile = [];
    this.deck = [];
    this.state = "Waiting";
    this.id = uuidv4();
    this.numOfCards = numOfCards;
    this.playerLimit = playerLimit;
  }

  get DTO(): GameDTO {
    const {
      state,
      players,
      activePlayerId,
      pile,
      deck,
      numOfCards,
      spectators,
    } = { ...structuredClone(this) };

    return {
      state,
      players,
      activePlayerId,
      topCard: pile[0],
      deckSize: deck.length,
      numOfCards,
      spectators,
    };
  }

  addPlayer(userId: string) {
    const player = { id: userId, availableGives: [], cards: [] };
    this.players.push(player);
    return player;
  }

  removePlayer(playerId: string) {
    const playerIndex = this.players.findIndex((p) => p.id === playerId);
    if (playerIndex !== -1) {
      if (this.activePlayerId == playerId) {
        this.activePlayerId =
          this.players[(playerIndex + 1) % this.players.length].id;
      }
      this.deck.push(...this.players[playerIndex].cards);
      this.players.splice(playerIndex, 1);
    }
  }

  addSpectator(userId: string) {
    this.spectators.push(userId);
  }

  removeSpectator(userId: string) {
    const index = this.spectators.findIndex((s) => s === userId);
    if (index !== -1) {
      this.spectators.splice(index, 1);
    }
  }

  startGame() {
    this.deck = getRandomDeck();
    while (
      this.players.length < this.playerLimit &&
      this.spectators.length > 0
    ) {
      const newPlayer = this.spectators.shift();
      if (newPlayer) {
        this.addPlayer(newPlayer);
      }
    }
    this.players.forEach((p) => (p.availableGives = []));
    this.dealCards(this.numOfCards);
    this.activePlayerId = this.players[0].id;
    this.pickedUpCard = undefined;
    this.state = "Playing";
    this.pile = [];
    this.activeAbility = "";
    this.pickedUpCard = undefined;
    this.pickedFromPile = false;
    this.hasLooked = false;
  }

  dealCards(numOfCards: number) {
    this.players.forEach((p) => {
      p.cards = this.takeCardsFromTopOfDeck(numOfCards).map(
        (c: Card, i: number) => ({ ...c, placement: i })
      );
    });
  }

  topCard(): Card {
    return this.pile[0];
  }
  endTurn() {
    const currentIndex: number = this.players.findIndex(
      (p) => p.id === this.activePlayerId
    );
    const nextPlayer =
      this.players[(currentIndex + 1) % this.players.length].id;

    this.activePlayerId = nextPlayer;
    this.activeAbility = "";
    this.pickedUpCard = undefined;
    this.pickedFromPile = false;
    this.hasLooked = false;
  }
  takeCardsFromTopOfDeck(n: number): Card[] {
    const cards: Card[] = [];

    for (let i = 0; i < n; i++) {
      cards.push(this.takeCardFromTopOfDeck());
    }

    return cards;
  }

  takeCardFromTopOfDeck(): Card {
    const card = this.deck.pop();
    if (card === undefined) {
      throw new Error("Cant take card from empty deck.");
    }
    if (this.deck.length == 0) {
      this.deck = shuffle(this.pile.splice(1));
    }
    return card;
  }

  takeCardFromTopOfPile(): Card {
    const card = this.pile.shift();
    if (card === undefined) {
      throw new Error("Cant take card from empty pile.");
    }
    this.pickedFromPile = true;
    return card;
  }
}
