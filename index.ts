import { createServer } from "http";
import { Server, Socket } from "socket.io";
import Game from "./Game";
import GameHandler from "./GameHandler";
import { GameCard } from "./Card";
import Player from "./Player";


const maxPlayers = 2;
const numOfCards = 4;

const TOTAL_TIME_TO_GIVE = 5000;
const UPDATE_DELAY_TO_GIVE = 200;


const gameHandler: GameHandler = {"dawg": (new Game())}
const waitingRoom: string[] = [];

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {"origin": "*"}
});




io.on("connection", (socket: Socket) => {
  console.log(socket.id + " connected")
  
  socket.on("RestartGame", (gameId) => {
    const game:Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!")
      return;
    }
    startGame(game);
  })

  socket.on("create-game", (response) => {
    const game = new Game();
    gameHandler[game.id] = game;
    game.addPlayer(socket.id);
    socket.join(game.id);
    response(game.id);
  })

  socket.on("join-game", (gameId, response) => {
    const game:Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!")
      response("404")
      return;
    }
    if (game.players.length >= maxPlayers) {
      
      console.log("Game is full")
      response("Full")
      return;
    }
    game.addPlayer(socket.id);
    socket.join(game.id);
    response(game.players.filter(p => p.id !== socket.id));
    if (game.players.length == maxPlayers) {
      startGame(game);
    }
  })

  socket.on("leave-game", (gameId, response) => {
    const game:Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!")
      response("Error: game " + gameId + " does not exist!")
      return;
    }
    socket.leave(game.id);
    response("Successfully left game: " + game.id);
  })

  // let numInLobby: number | undefined =io.sockets.adapter.rooms.get("Lobby")?.size 
  // if (numInLobby === undefined || numInLobby < maxPlayers) {
  //   socket.join("Lobby");
  // }
  // else {
  //   console.log(socket.id + " added to waiting room");
  //   waitingRoom.push(socket.id);
  // }

  socket.on("give-card", (gameId:string,placement: number) => {
    const game:Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!")
      return;
    }
    const player = game.players.find(p => p.id === socket.id);
    if (player !== undefined) {
      if (player.availableGives.length > 0) {
        const ag = player.availableGives.shift();
        const opponent = game.players.find(p => p.id === ag?.ownerId);
        if (ag !== undefined && opponent!==undefined) {
          const index = player.cards.findIndex(c => c.placement === placement)
          const [card] = player.cards.splice(index, 1);
          
          opponent.cards.push({...card, placement: ag.placement})
          io.to(game.id).emit("give-card", {placement, ownerId: socket.id}, ag)
          socket.emit("timeout-give", ag.ownerId, card.placement);
        }
      }
    }
  })

  socket.on("card-flip", (gameId:string,card:GameCard,ownerId:string, clickerId: string, response) => { 
    const game:Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!")
      return;
    }
    if (game.topCard().value == card.value) {
      const owner = game.players.find(p => p.id === ownerId);
      const cardIndex = owner?.cards.findIndex(c => c.placement === card.placement);
      if (cardIndex !== undefined) {
        owner?.cards.splice(cardIndex, 1);
        game.pile.unshift({suit: card.suit, value: card.value});
        io.to(game.id).emit("card-flip",game.topCard(), ownerId, card.placement);
        if (ownerId !== clickerId) {
          const clicker = game.players.find(p => p.id === clickerId);
          if (clicker) {
            clicker.availableGives.push({ownerId, placement: card.placement});
            response(TOTAL_TIME_TO_GIVE)
            createCardTimer(socket,ownerId, card.placement,clicker);
          }
        }
      }
    }
    else {
      //Punishment card
    }
  })

  socket.on("draw-from-deck", (gameId:string,response) => {
    const game:Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!")
      return;
    }
    if (game.activePlayerId === socket.id && !(game.pickedUpCard)) {
      
      const card = game.takeCardFromTopOfDeck();
      game.pickedUpCard=card;

      io.to(game.id).emit("draw-from-deck", (game.deck.length))
      response(card);
    }
  })

  socket.on("draw-from-pile", (gameId:string,response) => {
    const game:Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!")
      return;
    }
    if (game.activePlayerId === socket.id && !(game.pickedUpCard) && game.topCard()) {
      const card = game.takeCardFromTopOfPile();
      response(card, game.pile[0]);
      game.pickedUpCard=card;
    }
  })

  socket.on("put-on-pile", (gameId:string,ack) => {
    const game:Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!")
      return;
    }
    if (game.activePlayerId === socket.id && game.pickedUpCard) {
      ack();
      game.pile.unshift(game.pickedUpCard)
      io.to(game.id).emit("update-topcard", game.pile[0])
      endTurn(game);
    }
  })

  socket.on("hand-card-swap", (gameId:string,placement: number) => {
    const game:Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!")
      return;
    }
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
        io.to(game.id).emit("hand-card-swap", socket.id, placement, c)
        endTurn(game);
      }
    }
  })
});

function createCardTimer(socket:Socket,ownerId:string,placement:number,clicker:Player ) {
  const updater = (timeLeft:number) => {
    socket.emit("update-timer-give", ownerId, placement, timeLeft)
  }
  const handler = () => {
    const index = clicker.availableGives.findIndex(ag => ag.ownerId === ownerId && ag.placement === placement);
    if (index !== -1) {
      clicker.availableGives.splice(index,1);
    }

    socket.emit("timeout-give", ownerId, placement);
  }
  createTimerWithUpdates(updater, handler, TOTAL_TIME_TO_GIVE, UPDATE_DELAY_TO_GIVE)
}

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

function endTurn(game: Game) {
  game.endTurn();

  io.to(game.id).emit("end-turn", game.activePlayerId)
}

function startGame(game:Game) {
  game.startGame(numOfCards);
  io.in(game.id).emit("game-setup", game.DTO)
}

io.of("/").adapter.on("leave-room", (room,id) => {
  console.log(room,id)
  const game = gameHandler[room];
  if (game !== undefined) {
    game.removePlayer(id);
    console.log(game.players);
    io.to(game.id).emit("player-left", game.players, game.activePlayerId);
  }
})

httpServer.listen(3000);

/* 
io.of("/").adapter.on("join-room", (room,id) => {
  switch (room) {
    case "Lobby":
      console.log(id + " joined lobby");
      game.players.push({id, cards:[], availableGives: []})
      let numInLobby: number | undefined =io.sockets.adapter.rooms.get("Lobby")?.size 
      if (numInLobby == maxPlayers) {
        startGame();
      }
  }
})



 */