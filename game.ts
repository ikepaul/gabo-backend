import { Card, GameCard, getRandomDeck, shuffle } from "./Card";
import GameDTO from "./GameDTO";
import Player from "./Player";
import { v4 as uuidv4 } from "uuid";
import { toPlayerDTO } from "./PlayerDTO";
import User from "./User";
import GameInfo from "./GameInfo";

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
  name: string;

  constructor(name: string, numOfCards: number, playerLimit: number) {
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
    this.name = name;
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
      id,
    } = { ...structuredClone(this) };

    const playersDTO = players.map((p) => toPlayerDTO(p));

    return {
      id,
      state,
      players: playersDTO,
      activePlayerId,
      topCard: pile[0],
      deckSize: deck.length,
      numOfCards,
      spectators,
    };
  }

  get Info(): GameInfo {
    const { players, spectators, numOfCards, playerLimit, name, id } = {
      ...structuredClone(this),
    };

    return {
      spectatorCount: spectators.length,
      playerCount: players.length,
      playerLimit,
      numOfCards,
      name,
      id,
    };
  }

  addPlayer(user: User) {
    const player = {
      user,
      numOfStartPeeks: 0,
      availableGives: [],
      cards: [],
      score: this.highestScore(),
      calledGabo: false,
    };
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

  endGame() {
    this.activePlayerId = "";
    this.activeAbility = "";
    this.pickedUpCard = undefined;
    this.pickedFromPile = false;
    this.hasLooked = false;

    this.players.forEach((player, i) => {
      const handValue = this.calcHandValue(player.cards);
      if (player.calledGabo) {
        if (handValue > 5) {
          player.score += 25;
          return;
        }
        //Implement counter gabo
        return;
      }
      player.score += handValue;
    });
    this.state = "Finished";
  }

  topCard(): Card {
    return this.pile[0];
  }
  endTurn(): boolean {
    const currentIndex: number = this.players.findIndex(
      (p) => p.user.uid === this.activePlayerId
    );
    const nextPlayer = this.players[(currentIndex + 1) % this.players.length];

    if (nextPlayer.calledGabo) {
      console.log("endinggame");
      this.endGame();
      return true;
    }

    const nextPlayerId = nextPlayer.user.uid;

    this.activePlayerId = nextPlayerId;
    this.activeAbility = "";
    this.pickedUpCard = undefined;
    this.pickedFromPile = false;
    this.hasLooked = false;
    return false;
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

  highestScore(): number {
    let score = 0;
    this.players.forEach((p) => {
      score = p.score > score ? p.score : score;
    });
    return score;
  }

  callGabo(uid: string): boolean {
    if (this.activePlayerId !== uid) {
      return false;
    }
    const player = this.players.find((p) => p.user.uid == uid);
    if (!player) {
      return false;
    }

    player.calledGabo = true;
    return true; //No error when calling gabo
  }
  private calcHandValue(cards: GameCard[]): number {
    return cards.reduce((a, b) => a + this.cardValue(b), 0);
  }

  private cardValue(card: GameCard): number {
    if (card.suit == "Hearts" && card.value == "King") {
      return 0;
    }
    switch (card.value) {
      case "Ace":
        return 1;
      case "King":
        return 13;
      case "Queen":
        return 12;
      case "Jack":
        return 11;
      case "Joker":
        return 1;
    }
    return card.value;
  }
}
