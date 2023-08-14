import { createServer } from "http";
import { Server, Socket } from "socket.io";
import {Card, Game, GameCard, InfoGive, Player, Suit, Value, gameToDTO} from "./game";

const numOfPlayers = 2;

const TOTAL_TIME_TO_GIVE = 5000;
const UPDATE_DELAY_TO_GIVE = 200;


const game:Game = {players: [], activePlayerId: "", pickedUpCard: undefined, pile: [],deck: [],state: "Waiting"};
const waitingRoom: string[] = [];

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {"origin": "*"}
});




io.on("connection", (socket: Socket) => {
  socket.on("RestartGame", () => {
    startGame();
  })

  socket.on("LogGame", () => {
    console.log(game);
  })

  console.log(socket.id + " connected")
  let numInLobby: number | undefined =io.sockets.adapter.rooms.get("Lobby")?.size 
  if (numInLobby === undefined || numInLobby < numOfPlayers) {
    socket.join("Lobby");
  }
  else {
    console.log(socket.id + " added to waiting room");
    waitingRoom.push(socket.id);
  }

  socket.on("give-card", (placement: number) => {
    const player = game.players.find(p => p.id === socket.id);
    if (player !== undefined) {
      if (player.availableGives.length > 0) {
        const ag = player.availableGives.shift();
        const opponent = game.players.find(p => p.id === ag?.ownerId);
        if (ag !== undefined && opponent!==undefined) {
          const index = player.cards.findIndex(c => c.placement === placement)
          const [card] = player.cards.splice(index, 1);
          
          opponent.cards.push({...card, placement: ag.placement})
          io.to("Lobby").emit("give-card", {placement, ownerId: socket.id}, ag)
          socket.emit("timeout-give", ag.ownerId, card.placement);
        }
      }
    }
  })

  socket.on("card-flip", (card:GameCard,ownerId:string, clickerId: string, response) => { 
    if (topCard().value == card.value) {
      const owner = game.players.find(p => p.id === ownerId);
      const cardIndex = owner?.cards.findIndex(c => c.placement === card.placement);
      if (cardIndex !== undefined) {
        owner?.cards.splice(cardIndex, 1);
        game.pile.unshift({suit: card.suit, value: card.value});
        io.to("Lobby").emit("card-flip",topCard(), ownerId, card.placement);
        if (ownerId !== clickerId) {
          const clicker = game.players.find(p => p.id === clickerId);
          if (clicker) {
            clicker.availableGives.push({ownerId, placement: card.placement});
            response(TOTAL_TIME_TO_GIVE)
            const updater = (timeLeft:number) => {
              socket.emit("update-timer-give", ownerId, card.placement, timeLeft)
            }
            const handler = () => {
              const index = clicker.availableGives.findIndex(ag => ag.ownerId === ownerId && ag.placement === card.placement);
              if (index !== -1) {
                clicker.availableGives.splice(index,1);
              }
        
              socket.emit("timeout-give", ownerId, card.placement);
            }
            createTimerWithUpdates(updater, handler, TOTAL_TIME_TO_GIVE, UPDATE_DELAY_TO_GIVE)
          }
        }
      }
    }
    else {
      //Punishment card
    }
  })

  socket.on("draw-from-deck", (response) => {
    if (game.activePlayerId === socket.id && !(game.pickedUpCard)) {
      
      const card = takeCardFromTopOfDeck();
      game.pickedUpCard=card;

      if (game.deck.length == 0) {
        game.deck = shuffle(game.pile.splice(1));
      }
      io.to("Lobby").emit("draw-from-deck", (game.deck.length))
      response(card);
    }
  })

  socket.on("draw-from-pile", (response) => {
    if (game.activePlayerId === socket.id && !(game.pickedUpCard) && topCard()) {
      const card = takeCardFromTopOfPile();
      response(card, game.pile[0]);
      game.pickedUpCard=card;
    }
  })

  socket.on("put-on-pile", (ack) => {
    if (game.activePlayerId === socket.id && game.pickedUpCard) {
      ack();
      game.pile.unshift(game.pickedUpCard)
      io.to("Lobby").emit("update-topcard", game.pile[0])
      endTurn();
    }
  })

  socket.on("hand-card-swap", (placement: number) => {
    if (game.activePlayerId === socket.id && game.pickedUpCard) {
      const p = game.players.find((p) => p.id === socket.id);
      if (p) {
        const c = p.cards.find(c => c.placement === placement);
        if (c) {
          game.pile.unshift({suit: c.suit, value: c.value});
          c.suit = game.pickedUpCard.suit;
          c.value = game.pickedUpCard.value;
          game.pickedUpCard = undefined;
        }
        io.to("Lobby").emit("hand-card-swap", socket.id, placement, c)
        endTurn();
      }
    }
  })
});
function createTimerWithUpdates(updater: ((timeLeft: number) => void), handler: (() => void), totalTime:number ,updateDelay: number = 1000) {
  const helper = (n:number) => {
    setTimeout(() => {
      if (n == 0) {
        handler();
      }
      else {

        const timeLeft = updateDelay*n;
        updater(timeLeft);
        helper(n -1)
      }
    },updateDelay)
  }

  const numberOfIterations = Math.floor(totalTime/updateDelay)-1;
  helper(numberOfIterations);
}

function topCard():Card {
  return game.pile[0];
}

function endTurn() {
  const currentIndex:number = game.players.findIndex((p) => p.id === game.activePlayerId);
  const nextPlayer = game.players[(currentIndex + 1)%game.players.length].id;

  game.activePlayerId = nextPlayer;
  game.pickedUpCard = undefined;

  io.to("Lobby").emit("end-turn", nextPlayer)
}

io.of("/").adapter.on("join-room", (room,id) => {
  switch (room) {
    case "Lobby":
      console.log(id + " joined lobby");
      game.players.push({id, cards:[], availableGives: []})
      let numInLobby: number | undefined =io.sockets.adapter.rooms.get("Lobby")?.size 
      if (numInLobby == numOfPlayers) {
        startGame();
      }
  }
})



io.of("/").adapter.on("leave-room", (room,id) => {
  switch (room) {
    case "Lobby":
      console.log(id + " left lobby");
      game.players.splice(game.players.findIndex((a) => a.id === id),1)
      addFromWaitingRoom();
      break;
  }
})

function addFromWaitingRoom() {
    const playerId = waitingRoom.shift();
    if (playerId !== undefined) {
      io.sockets.sockets.get(playerId)?.join("Lobby");
    }
}

function startGame() {
  game.deck = getRandomDeck();
  game.players.forEach(p => p.availableGives=[]);
  dealCards();
  game.activePlayerId = game.players[0].id;
  game.pickedUpCard = undefined;
  game.state="Playing"
  game.pile=[];
  io.in("Lobby").emit("game-setup", gameToDTO(game))
  console.log(game)
}
function getSortedDeck ():Card[]  {
  const numOfJokers = 1;
  const randomDeck:Card[] = [];
  for (let i = 0; i < 52 + numOfJokers; i++) {
    randomDeck.push(numToCard(i))
  }
  return randomDeck;
}

function getRandomDeck ():Card[] {
  return shuffle(getSortedDeck());
}

function shuffle(d:Card[]):Card[] {
  const deck = [...d];
  for (let i = deck.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * i);
    let temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }
  return deck;
}

function dealCards() {
  const numOfCards = 4;
  game.players.forEach(p => {
    p.cards = takeCardsFromTopOfDeck(numOfCards).map((c:Card,i:number) => ({...c,placement: i}));
  })
}

function takeCardsFromTopOfDeck(n:number):Card[] {
  const cards:Card[] = [];

  for (let i = 0; i < n; i++) {
    cards.push(takeCardFromTopOfDeck())
  }

  return cards;
} 

function takeCardFromTopOfDeck():Card {
  const card = game.deck.pop();
  if (card === undefined) {
    throw new Error("Cant take card from empty deck.");
  }
  return card;
}

function takeCardFromTopOfPile():Card {
  const card = game.pile.shift();
  if (card === undefined) {
    throw new Error("Cant take card from empty pile.");
  }
  return card;
}


function getRandomCards(n :number):GameCard[] {
  const cards:GameCard[] = [];
  for (let i:number = 0; i < n; i++) {
    const gameCard:GameCard = {...getRandomCard(), placement: i};
    cards.push(gameCard);
  };

  return cards;
} 

function getRandomCard():Card {
  const r = Math.random()*54;
  const card = numToCard(r);
  return card;
}

function numToCard(r:number):Card {
  if (r >= 52) {
    const joker:Card = {suit: "Joker", value: "Joker"} 
    return joker;
  }
  let suit:Suit = "Spades";
  switch (Math.floor(r / 13)) {
    case 0:
      suit = "Spades";
      break;
      
    case 1:
      suit = "Hearts";
      break;
      
    case 2:
      suit = "Clubs";
      break;
      
    case 3:
      suit = "Diamonds";
      break;
  
    default:
      throw new Error("Exception when creating random card-suit");
      break;
  }
  let value:Value = "Ace";
  switch (Math.floor(r%13)+2) {
    case 2:
      value = 2;
      break;
    case 3:
      value = 3;
      break;
    case 4:
      value = 4;
      break;
    case 5:
      value = 5;
      break;
    case 6:
      value = 6;
      break;
    case 7:
      value = 7;
      break;
    case 8:
      value = 8;
      break;
    case 9:
      value = 9;
      break;
    case 10:
      value = 10;
      break;
    case 11:
      value = "Jack";
      break;
    case 12:
      value = "Queen";
      break;
    case 13:
      value = "King";
      break;
    case 14:
      value = "Ace";
      break;
    default:
      throw new Error("Exception when creating random card-value");
      
  }
  return {suit,value}
}


httpServer.listen(3000);