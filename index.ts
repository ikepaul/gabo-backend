import { createServer } from "http";
import { Server, Socket } from "socket.io";
import Game from "./Game";
import GameHandler from "./GameHandler";
import { Card, GameCard } from "./Card";
import Player from "./Player";
import { toPlayerDTO } from "./PlayerDTO";
import GameDTO from "./GameDTO";



const TOTAL_TIME_TO_GIVE = 5000;
const UPDATE_DELAY_TO_GIVE = 200;


const gameHandler: GameHandler = {}
const waitingRoom: string[] = [];

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {"origin": "*"}
});

function restartGame(gameId: string) {
  const game:Game = gameHandler[gameId];
  if (game === undefined) {
    console.log("Game doesnt exist!")
    return;
  }
  startGame(game);
}



io.on("connection", (socket: Socket) => {
  console.log(socket.id + " connected")
  const handleCreateGame = (numOfCards: number, playerLimit: number, response: ((gameId:string) => void)) => {
    const game = new Game(numOfCards,playerLimit);
    gameHandler[game.id] = game;
    game.addPlayer(socket.id);
    socket.join(game.id);
    response(game.id);
  }
  const handleJoinGame = (gameId:string, response:((playersOrError:Player[] |string) => void)) => {
    const game:Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!")
      response("404")
      return;
    }
    if (game.players.length >= game.playerLimit) {
      console.log("Game is full")
      response("Full")
      return;
    }
    const player = game.addPlayer(socket.id);
    socket.join(game.id);
    response(game.players.filter(p => p.id !== socket.id));
    io.to(game.id).emit("player-joined", toPlayerDTO(player))
  }

  const handleLeaveGame = (gameId:string, response:((successOrError:string) => void)) => {
    const game:Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!")
      response("404")
      return;
    }
    socket.leave(game.id);
    response("Success");
  }

  const handleGiveCard = (gameId:string,placement: number) => {
    const game:Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!")
      return;
    }
    const player = game.players.find(p => p.id === socket.id);
    if (player !== undefined && player.availableGives.length > 0) {
      const availableGives = player.availableGives.shift();
      const opponent = game.players.find(p => p.id === availableGives?.ownerId);
      if (availableGives !== undefined && opponent!==undefined) {
        const index = player.cards.findIndex(c => c.placement === placement)
        const [card] = player.cards.splice(index, 1);
        
        opponent.cards.push({...card, placement: availableGives.placement})
        io.to(game.id).emit("give-card", {placement, ownerId: socket.id}, availableGives)
        socket.emit("timeout-give", availableGives.ownerId, card.placement);
      }
    }
  }

  const handleCardFlip = (gameId:string,card:GameCard,ownerId:string, response: ((maxTime:number ) => void)) => { 
    const game:Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!")
      return;
    }
    const topCard = game.topCard();
    if (topCard !== undefined && topCard.value == card.value) {
      const owner = game.players.find(p => p.id === ownerId);
      if (owner == undefined) {return;}

      const cardIndex = owner.cards.findIndex(c => c.placement === card.placement);
      if (cardIndex === -1) {return;}

      owner.cards.splice(cardIndex, 1);
      game.pile.unshift({suit: card.suit, value: card.value}); //Add card to pile
      io.to(game.id).emit("card-flip",game.topCard(), ownerId, card.placement);
      
      if (ownerId !== socket.id) {
        const clicker = game.players.find(p => p.id === socket.id);
        if (clicker) {
          clicker.availableGives.push({ownerId, placement: card.placement});
          response(TOTAL_TIME_TO_GIVE)
          createCardTimer(socket,ownerId, card.placement,clicker);
        }
      }
    }
    else {
      const pickedUpCard = game.takeCardFromTopOfDeck();
      const player = game.players.find(p => p.id === socket.id);
      
      // Find first empty place for punishment card
      let placement = game.numOfCards; //Begins at number of cards so we know its a punishment simply because its placement is more than the number of cards in the game.
      while (player?.cards.some(pc => pc.placement == placement)) {
        placement++;
      }
      const punishmentCard = {...pickedUpCard, placement};
      player?.cards.push(punishmentCard);
      io.to(game.id).emit('punishment-card',socket.id, punishmentCard);
    }
  }

  const handleDrawFromDeck = (gameId:string,response: ((card: Card) => void)) => {
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
  }

  const handleDrawFromPile = (gameId:string,response: ((card: Card, topCard: Card) => void) ) => {
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
  }

  const handlePutOnPile = (gameId:string,ack:(() => void)) => {
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
  }
  
  const handleHandCardSwap = (gameId:string,placement: number) => {
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
  }

  const handleGetGame = (gameId:string,response : ((game:GameDTO) =>void)) => {
    response(gameHandler[gameId].DTO);
  }

  socket.on("RestartGame", restartGame);
  
  socket.on("create-game", handleCreateGame);
  
  socket.on("join-game", handleJoinGame);

  socket.on("leave-game", handleLeaveGame);

  socket.on("give-card", handleGiveCard);

  socket.on("card-flip", handleCardFlip);

  socket.on("draw-from-deck", handleDrawFromDeck);

  socket.on("draw-from-pile", handleDrawFromPile);

  socket.on("put-on-pile", handlePutOnPile);

  socket.on("hand-card-swap", handleHandCardSwap);

  socket.on("get-game", handleGetGame);
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
  game.startGame();
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
      if (numInLobby == playerLimit) {
        startGame();
      }
  }
})



 */