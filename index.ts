import { createServer } from "http";
import { Server, Socket } from "socket.io";
import {Card, Game, GameCard, Player, Suit, Value, gameToDTO} from "./game";

const game:Game = {players: [], activePlayerId: "", pickedUpCard: undefined, pile: [],state: "Waiting"};
let gameDeck:Card[] = getRandomDeck();
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
  if (numInLobby === undefined || numInLobby < 2) {
    socket.join("Lobby");
  }
  else {
    console.log(socket.id + " added to waiting room");
    waitingRoom.push(socket.id);
  }

  socket.on("card-click", (card:GameCard,ownerId:string, clickerId: string) => {
    console.log(card, ownerId, clickerId);
  })

  socket.on("draw-from-deck", (response) => {
    if (game.activePlayerId === socket.id && !(game.pickedUpCard)) {
      const card = takeCardFromTopOfDeck();
      response(card);
      game.pickedUpCard=card;
    }
  })

  socket.on("hand-card-swap", (placement: number) => {
    if (game.activePlayerId === socket.id && game.pickedUpCard) {
      const p = game.players.find((p) => p.id === socket.id);
      if (p) {
        const c = p.cards.find(c => c.placement === placement);
        if (c) {
          c.suit = game.pickedUpCard.suit;
          c.value = game.pickedUpCard.value;
          game.pile.unshift({suit: c.suit, value: c.value});
          game.pickedUpCard = undefined;
        }
        io.to("Lobby").emit("hand-card-swap", socket.id, placement, game.pile[0])
        endTurn();
      }
    }
  })
});

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
      game.players.push({id, cards:[]})
      let numInLobby: number | undefined =io.sockets.adapter.rooms.get("Lobby")?.size 
      if (numInLobby == 2) {
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
  gameDeck = getRandomDeck();
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
  for (let i = d.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * i);
    let temp = d[i];
    d[i] = d[j];
    d[j] = temp;
  }
  return d;
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
  const card = gameDeck.pop();
  if (card === undefined) {
    throw new Error("Cant take card from empty deck.");
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