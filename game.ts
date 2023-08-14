import { Card, getRandomDeck, shuffle } from "./Card";
import GameDTO from "./GameDTO";
import Player from "./Player";
import { v4 as uuidv4 } from 'uuid';

export type GameState = "Waiting" | "Playing" | "Finished"

export default class Game {
  players: Player[];
  state: GameState;
  activePlayerId: string;
  pile: Card[];
  pickedUpCard: Card |undefined;
  deck: Card[];
  id: string;

  constructor() {
    this.players = [];
    this.activePlayerId= "";
    this.pickedUpCard= undefined;
    this.pile= [];
    this.deck= [];
    this.state= "Waiting";
    this.id= uuidv4();
  }

  get DTO():GameDTO {
    const {state, players, activePlayerId, pile,deck} = {...structuredClone(this)};
    
    return {state, players, activePlayerId, topCard: pile[0], deckSize: deck.length};
  }

  addPlayer(playerId: string) {
    this.players.push({id: playerId, availableGives: [], cards: []})
  }

  removePlayer(playerId: string) {
    const playerIndex= this.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      if(this.activePlayerId == playerId) {
        this.activePlayerId = this.players[(playerIndex + 1) % this.players.length].id;
      }
      this.deck.push(...this.players[playerIndex].cards)
      this.players.splice(playerIndex,1);
    }
  }

  startGame(numOfCards: number) {
    this.deck = getRandomDeck();
    this.players.forEach(p => p.availableGives=[]);
    this.dealCards(numOfCards);
    this.activePlayerId = this.players[0].id;
    this.pickedUpCard = undefined;
    this.state="Playing"
    this.pile=[];
  }

  dealCards(numOfCards: number) {
    this.players.forEach(p => {
      p.cards = this.takeCardsFromTopOfDeck(numOfCards).map((c:Card,i:number) => ({...c,placement: i}));
    })
  }

  topCard():Card {
    return this.pile[0];
  }
  endTurn() {
    const currentIndex:number = this.players.findIndex((p) => p.id === this.activePlayerId);
    const nextPlayer = this.players[(currentIndex + 1) % this.players.length].id;

    this.activePlayerId = nextPlayer;
    this.pickedUpCard = undefined;
  }
  takeCardsFromTopOfDeck(n:number):Card[] {
    const cards:Card[] = [];

    for (let i = 0; i < n; i++) {
      cards.push(this.takeCardFromTopOfDeck())
    }

    return cards;
  } 

  takeCardFromTopOfDeck():Card {
    const card = this.deck.pop();
    if (card === undefined) {
      throw new Error("Cant take card from empty deck.");
    }
    if (this.deck.length == 0) {
      this.deck = shuffle(this.pile.splice(1));
    }
    return card;
  }
  

  takeCardFromTopOfPile():Card {
    const card = this.pile.shift();
    if (card === undefined) {
      throw new Error("Cant take card from empty pile.");
    }
    return card;
  }
}

