import { Card, getRandomDeck, shuffle } from "./Card";
import GameDTO from "./GameDTO";
import Player from "./Player";
import { v4 as uuidv4 } from "uuid";
import { toPlayerDTO } from "./PlayerDTO";
import User from "./User";

export type GameState = "Waiting" | "Setup" | "Playing" | "Finished";
export type Ability =
  | "look-self"
  | "look-other"
  | "swap-then-look"
  | "look-then-swap";
const maxNumOfCards = 8;
const minNumOfCards = 1;
const maxPlayerLimit = 4;
const minPlayerLimit = 1;
const numOfStartPeeks = 2;

export default class Game {
  players: Player[];
  spectators: User[]; //List of ids
  state: GameState;
  activePlayerId: string;

  activeAbility: Ability | "";
  hasLooked: boolean;

  pile: Card[];
  deck: Card[];
  pickedUpCard: Card | undefined;
  pickedFromPile: boolean;

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

    const playersDTO = players.map((p) => toPlayerDTO(p));

    return {
      state,
      players: playersDTO,
      activePlayerId,
      topCard: pile[0],
      deckSize: deck.length,
      numOfCards,
      spectators,
    };
  }

  addPlayer(user: User) {
    const player = { user, numOfStartPeeks: 0, availableGives: [], cards: [] };
    this.players.push(player);
    return player;
  }

  removePlayer(playerId: string) {
    const playerIndex = this.players.findIndex((p) => p.user.uid === playerId);
    if (playerIndex !== -1) {
      if (this.activePlayerId == playerId) {
        this.activePlayerId =
          this.players[(playerIndex + 1) % this.players.length].user.uid;
      }
      this.deck.push(...this.players[playerIndex].cards);
      this.players.splice(playerIndex, 1);
    }
  }

  addSpectator(user: User) {
    this.spectators.push(user);
  }

  removeSpectator(userId: string) {
    const index = this.spectators.findIndex((s) => s.uid === userId);
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
    this.players.forEach((p) => {
      p.availableGives = [];
      p.numOfStartPeeks = numOfStartPeeks;
    });
    this.dealCards(this.numOfCards);
    this.activePlayerId = this.players[0].user.uid;
    this.pickedUpCard = undefined;
    this.state = "Setup";
    this.pile = [];
    this.activeAbility = "";
    this.pickedUpCard = undefined;
    this.pickedFromPile = false;
    this.hasLooked = false;
  }

  dealCards(numOfCards: number) {
    this.players.forEach((p) => {
      p.cards = this.takeCardsFromTopOfDeck(numOfCards).map(
        (c: Card, i: number) => ({ ...c, placement: i, ownerId: p.user.uid })
      );
    });
  }

  topCard(): Card {
    return this.pile[0];
  }
  endTurn() {
    const currentIndex: number = this.players.findIndex(
      (p) => p.user.uid === this.activePlayerId
    );
    const nextPlayer =
      this.players[(currentIndex + 1) % this.players.length].user.uid;

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

  get everyoneHasLooked(): boolean {
    return this.players.every((player) => player.numOfStartPeeks <= 0);
  }
}
