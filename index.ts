import { createServer } from "http";
import { Server, Socket } from "socket.io";
import Game, { Ability } from "./Game";
import GameHandler from "./GameHandler";
import { Card, GameCard, GameCardDTO } from "./Card";
import Player, { InfoGive } from "./Player";
import PlayerDTO, { toPlayerDTO } from "./PlayerDTO";
import GameDTO from "./GameDTO";

const TOTAL_TIME_TO_GIVE = 5000;
const UPDATE_DELAY_TO_GIVE = 200;

const gameHandler: GameHandler = {};

interface ServerToClientEvents {
  spectatorAdded: (socketId: string) => void;
  giveCard: (card: InfoGive, availableGives: InfoGive) => void;
  cardFlip: (topCard: Card, ownerId: string, placement: number) => void;
  punishmentCard: (playerId: string, punishmentCard: GameCardDTO) => void;
  drawFromDeck: (deckSize: number) => void;
  updateTopCard: (topCard: Card) => void;
  handCardSwap: (socketId: string, placement: number, c: Card) => void;
  cardSwap: (
    playerPlacement: { ownerId: string; placement: number },
    opponentPlacement: { ownerId: string; placement: number }
  ) => void;
  endTurn: (activePlayerId: string) => void;
  gameSetup: (g: GameDTO) => void;
  playerLeft: (updatedPlayers: PlayerDTO[], activePlayerId: string) => void;
  spectatorLeft: (updatedPlayers: string[]) => void;
  updateTimerGive: (
    ownerId: string,
    placement: number,
    timeLeft: number
  ) => void;
  timeoutGive: (ownerId: string, placement: number) => void;
  useAbility: (ability: Ability) => void;
}

interface ClientToServerEvents {
  restartGame: (gameId: string) => void;

  createGame: (
    numOfCards: number,
    playerLimit: number,
    response: (gameId: string) => void
  ) => void;

  joinGame: (gameId: string, response: (status: "ok" | "404") => void) => void;

  leaveGame: (
    gameId: string,
    response: (successOrError: string) => void
  ) => void;

  giveCard: (gameId: string, placement: number) => void;

  cardFlip: (
    gameId: string,
    card: GameCardDTO,
    response: (maxTime: number) => void
  ) => void;

  drawFromDeck: (gameId: string, response: (card: Card) => void) => void;

  drawFromPile: (
    gameId: string,
    response: (card: Card, topCard: Card) => void
  ) => void;

  putOnPile: (gameId: string, ack: () => void) => void;

  handCardSwap: (gameId: string, placement: number) => void;

  getGame: (gameId: string, response: (game: GameDTO) => void) => void;

  lookSelf: (
    gameId: string,
    placement: number,
    response: (card: GameCard) => void
  ) => void;

  lookOther: (
    gameId: string,
    card: GameCardDTO,
    response: (card: GameCard) => void
  ) => void;
}

interface InterServerEvents {}

interface SocketData {}

const httpServer = createServer();
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: { origin: "*" },
});

function restartGame(gameId: string) {
  const game: Game = gameHandler[gameId];
  if (game === undefined) {
    console.log("Game doesnt exist!");
    return;
  }
  startGame(game);
}

io.on("connection", (socket: Socket) => {
  console.log(socket.id + " connected");
  const handleCreateGame = (
    numOfCards: number,
    playerLimit: number,
    response: (gameId: string) => void
  ) => {
    const game = new Game(numOfCards, playerLimit);
    gameHandler[game.id] = game;
    game.addSpectator(socket.id);
    socket.join(game.id);
    response(game.id);
  };
  const handleJoinGame = (
    gameId: string,
    response: (status: "ok" | "404") => void
  ) => {
    const game: Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!");
      response("404");
      return;
    }

    game.addSpectator(socket.id);
    response("ok");
    socket.join(game.id);
    io.to(game.id).emit("spectatorAdded", socket.id);
  };

  const handleLeaveGame = (
    gameId: string,
    response: (successOrError: string) => void
  ) => {
    const game: Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!");
      response("404");
      return;
    }
    socket.leave(game.id);
    response("Success");
  };

  const handleGiveCard = (gameId: string, placement: number) => {
    const game: Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!");
      return;
    }

    const player = game.players.find((p) => p.id === socket.id);

    if (player !== undefined && player.availableGives.length > 0) {
      const firstAvailableGive = player.availableGives.shift();
      if (firstAvailableGive === undefined) {
        return;
      }

      const opponent = game.players.find(
        (p) => p.id === firstAvailableGive.ownerId
      );

      if (opponent !== undefined) {
        const index = player.cards.findIndex((c) => c.placement === placement);
        const [card] = player.cards.splice(index, 1);

        opponent.cards.push({
          ...card,
          placement: firstAvailableGive.placement,
        });
        io.to(game.id).emit(
          "giveCard",
          { placement, ownerId: socket.id },
          firstAvailableGive
        );
        socket.emit("timeoutGive", firstAvailableGive.ownerId, card.placement);
      }
    }
  };

  const handleCardFlip = (
    gameId: string,
    cardPlacement: GameCardDTO,
    response: (maxTime: number) => void
  ) => {
    const game: Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!");
      return;
    }
    const topCard = game.topCard();
    const card = game.players
      .find((p) => p.id == cardPlacement.ownerId)
      ?.cards.find((c) => c.placement === cardPlacement.placement);

    console.log(card);
    if (!card) {
      return;
    }

    if (topCard !== undefined && topCard.value == card.value) {
      const owner = game.players.find((p) => p.id === cardPlacement.ownerId);
      if (owner == undefined) {
        return;
      }

      const cardIndex = owner.cards.findIndex(
        (c) => c.placement === card.placement
      );
      if (cardIndex === -1) {
        return;
      }

      owner.cards.splice(cardIndex, 1);
      game.pile.unshift({ suit: card.suit, value: card.value }); //Add card to pile
      io.to(game.id).emit(
        "cardFlip",
        game.topCard(),
        cardPlacement.ownerId,
        card.placement
      );

      console.log("emitting card flip");

      if (cardPlacement.ownerId !== socket.id) {
        const clicker = game.players.find((p) => p.id === socket.id);
        if (clicker) {
          clicker.availableGives.push({
            ownerId: cardPlacement.ownerId,
            placement: card.placement,
          });
          response(TOTAL_TIME_TO_GIVE);
          createCardTimer(
            socket,
            cardPlacement.ownerId,
            card.placement,
            clicker
          );
        }
      }
    } else {
      const pickedUpCard = game.takeCardFromTopOfDeck();
      const player = game.players.find((p) => p.id === socket.id);

      if (!player) {
        return;
      }

      // Find first empty place for punishment card
      let placement = game.numOfCards; //Begins at number of cards so we know its a punishment simply because its placement is more than the number of cards in the game.
      while (player?.cards.some((pc) => pc.placement == placement)) {
        placement++;
      }
      const punishmentCard = { ...pickedUpCard, placement, ownerId: player.id };
      player?.cards.push(punishmentCard);
      io.to(game.id).emit("punishmentCard", socket.id, {
        ownerId: socket.id,
        placement,
      });
    }
  };

  const handleDrawFromDeck = (
    gameId: string,
    response: (card: Card) => void
  ) => {
    const game: Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!");
      return;
    }
    if (
      game.activePlayerId === socket.id &&
      !game.pickedUpCard &&
      !game.activeAbility
    ) {
      const card = game.takeCardFromTopOfDeck();
      game.pickedUpCard = card;

      io.to(game.id).emit("drawFromDeck", game.deck.length);
      response(card);
    }
  };

  const handleDrawFromPile = (
    gameId: string,
    response: (card: Card, topCard: Card) => void
  ) => {
    const game: Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!");
      return;
    }
    if (
      game.activePlayerId === socket.id &&
      !game.pickedUpCard &&
      !game.activeAbility &&
      game.topCard()
    ) {
      const card = game.takeCardFromTopOfPile();
      response(card, game.pile[0]);
      game.pickedUpCard = card;
    }
  };

  const handlePutOnPile = (gameId: string, ack: () => void) => {
    const game: Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!");
      return;
    }
    if (game.activePlayerId === socket.id && game.pickedUpCard) {
      ack();
      game.pile.unshift(game.pickedUpCard);
      io.to(game.id).emit("updateTopCard", game.pile[0]);
      if (!game.pickedFromPile) {
        useCardAbility(game);
      } else {
        endTurn(game);
      }
      game.pickedUpCard = undefined;
    }
  };

  const useCardAbility = (game: Game): void => {
    switch (game.pickedUpCard?.value) {
      case 7:
      case 8:
        game.activeAbility = "look-self";
        socket.emit("useAbility", "look-self");
        break;
      case 9:
      case 10:
        game.activeAbility = "look-other";
        socket.emit("useAbility", "look-other");
        break;
      case "Jack":
      case "Queen":
        game.activeAbility = "swap-then-look";
        socket.emit("useAbility", "swap-then-look");
        break;
      case "King":
        game.activeAbility = "look-then-swap";
        socket.emit("useAbility", "look-then-swap");
        break;
      default:
        endTurn(game);
        return;
    }
  };

  const handleHandCardSwap = (gameId: string, placement: number) => {
    const game: Game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!");
      return;
    }
    if (game.activePlayerId === socket.id && game.pickedUpCard) {
      const p = game.players.find((p) => p.id === socket.id);
      if (p) {
        const c = p.cards.find((c) => c.placement === placement);
        if (c) {
          const newTopCard = { suit: c.suit, value: c.value };
          game.pile.unshift(newTopCard);
          c.suit = game.pickedUpCard.suit;
          c.value = game.pickedUpCard.value;
          game.pickedUpCard = undefined;
          io.to(game.id).emit("handCardSwap", socket.id, placement, newTopCard);
          endTurn(game);
        }
      }
    }
  };

  const handleGetGame = (gameId: string, response: (game: GameDTO) => void) => {
    response(gameHandler[gameId].DTO);
  };

  const handleLookSelf = (
    gameId: string,
    placement: number,
    response: (card: GameCard) => void
  ) => {
    const game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!");
      return;
    }

    if (
      game.activePlayerId === socket.id &&
      game.activeAbility === "look-self"
    ) {
      const card = game.players
        .find((p) => p.id === socket.id)
        ?.cards.find((c) => c.placement === placement);
      if (card === undefined) {
        return "Card doesnt exist";
      }
      response(card);
      endTurn(game);
    }
  };

  const handleLookOther = (
    gameId: string,
    { ownerId, placement }: GameCardDTO,
    response: (card: GameCard) => void
  ) => {
    if (ownerId === socket.id) {
      return;
    }

    const game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!");
      return;
    }

    if (
      game.activePlayerId === socket.id &&
      game.activeAbility === "look-other"
    ) {
      const card = game.players
        .find((p) => p.id === ownerId)
        ?.cards.find((c) => c.placement === placement);
      if (card === undefined) {
        return;
      }
      response(card);
      endTurn(game);
    }
  };

  const handleSwapThenLook = (
    gameId: string,
    playerPlacement: { ownerId: string; placement: number },
    opponentPlacement: { ownerId: string; placement: number },
    response: (receivedCard: GameCard) => void
  ) => {
    const game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!");
      return;
    }
    if (game.activePlayerId !== socket.id) {
      return;
    }
    if (playerPlacement.ownerId !== socket.id) {
      return;
    }
    if (game.activeAbility !== "swap-then-look") {
      return;
    }

    const receivedCard = cardSwap(game, playerPlacement, opponentPlacement);

    if (!receivedCard) {
      return;
    }

    io.to(gameId).emit(
      "cardSwap",
      {
        ownerId: playerPlacement.ownerId,
        placement: playerPlacement.placement,
      },
      {
        ownerId: opponentPlacement.ownerId,
        placement: opponentPlacement.placement,
      }
    );

    response(receivedCard);

    endTurn(game);
  };

  const handleLookThenSwap = (
    gameId: string,
    playerPlacement: { ownerId: string; placement: number },
    opponentPlacement: { ownerId: string; placement: number },
    ack: () => void
  ) => {
    const game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!");
      return;
    }
    if (game.activePlayerId !== socket.id) {
      return;
    }
    if (playerPlacement.ownerId !== socket.id) {
      return;
    }
    if (game.activeAbility !== "look-then-swap") {
      return;
    }

    const success = cardSwap(game, playerPlacement, opponentPlacement);

    if (!success) {
      return;
    }

    io.to(gameId).emit(
      "cardSwap",
      {
        ownerId: playerPlacement.ownerId,
        placement: playerPlacement.placement,
      },
      {
        ownerId: opponentPlacement.ownerId,
        placement: opponentPlacement.placement,
      }
    );

    ack();

    endTurn(game);
  };

  const handleLookBeforeSwap = (
    gameId: string,
    ownerId: string,
    placement: number,
    response: (card: GameCard) => void
  ) => {
    if (ownerId === socket.id) {
      return;
    }

    const game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!");
      return;
    }

    if (
      game.activePlayerId === socket.id &&
      game.activeAbility === "look-then-swap" &&
      !game.hasLooked
    ) {
      const card = game.players
        .find((p) => p.id === ownerId)
        ?.cards.find((c) => c.placement === placement);
      if (card === undefined) {
        return;
      }
      response(card);
    }
  };
  const handleCancelAbility = (gameId: string) => {
    const game = gameHandler[gameId];
    if (game === undefined) {
      console.log("Game doesnt exist!");
      return;
    }

    if (game.activeAbility && game.activePlayerId == socket.id) {
      endTurn(game);
    }
  };

  socket.on("restartGame", restartGame);

  socket.on("createGame", handleCreateGame);

  socket.on("joinGame", handleJoinGame);

  socket.on("leaveGame", handleLeaveGame);

  socket.on("giveCard", handleGiveCard);

  socket.on("cardFlip", handleCardFlip);

  socket.on("drawFromDeck", handleDrawFromDeck);

  socket.on("drawFromPile", handleDrawFromPile);

  socket.on("putOnPile", handlePutOnPile);

  socket.on("handCardSwap", handleHandCardSwap);

  socket.on("getGame", handleGetGame);

  socket.on("lookSelf", handleLookSelf);

  socket.on("lookOther", handleLookOther);

  socket.on("swapThenLook", handleSwapThenLook);

  socket.on("lookThenSwap", handleLookThenSwap);

  socket.on("lookBeforeSwap", handleLookBeforeSwap);

  socket.on("cancelAbility", handleCancelAbility);
});

function cardSwap(
  game: Game,
  playerPlacement: { ownerId: string; placement: number },
  opponentPlacement: { ownerId: string; placement: number }
): GameCard | undefined {
  const player = game.players.find((p) => p.id === playerPlacement.ownerId);
  const opponent = game.players.find((p) => p.id === opponentPlacement.ownerId);

  if (player === undefined || opponent === undefined) {
    return;
  }

  const playerCardIndex = player.cards.findIndex(
    (c) => c.placement === playerPlacement.placement
  );
  const opponentCardIndex = opponent.cards.findIndex(
    (c) => c.placement === opponentPlacement.placement
  );
  if (playerCardIndex === -1 || opponentCardIndex === -1) {
    return;
  }

  //Remove each card
  const [playerCard] = player.cards.splice(playerCardIndex, 1);
  const [opponentCard] = opponent.cards.splice(opponentCardIndex, 1);

  //Swap placement numbers of the cards
  const temp = opponentCard.placement;
  opponentCard.placement = playerCard.placement;
  playerCard.placement = temp;

  //Put them back in the others cards
  player.cards.push(opponentCard);
  opponent.cards.push(playerCard);

  return opponentCard;
}

function createCardTimer(
  socket: Socket,
  ownerId: string,
  placement: number,
  clicker: Player
) {
  const updater = (timeLeft: number) => {
    socket.emit("updateTimerGive", ownerId, placement, timeLeft);
  };
  const handler = () => {
    const index = clicker.availableGives.findIndex(
      (ag) => ag.ownerId === ownerId && ag.placement === placement
    );
    if (index !== -1) {
      clicker.availableGives.splice(index, 1);
    }

    socket.emit("timeoutGive", ownerId, placement);
  };
  createTimerWithUpdates(
    updater,
    handler,
    TOTAL_TIME_TO_GIVE,
    UPDATE_DELAY_TO_GIVE
  );
}

function createTimerWithUpdates(
  updater: (timeLeft: number) => void,
  handler: () => void,
  totalTime: number,
  updateDelay: number = 1000
) {
  const helper = (n: number) => {
    setTimeout(() => {
      if (n == 0) {
        handler();
      } else {
        const timeLeft = updateDelay * n;
        updater(timeLeft);
        helper(n - 1);
      }
    }, updateDelay);
  };

  const numberOfIterations = Math.floor(totalTime / updateDelay) - 1;
  helper(numberOfIterations);
}

function endTurn(game: Game) {
  game.endTurn();

  io.to(game.id).emit("endTurn", game.activePlayerId);
}

function startGame(game: Game) {
  game.startGame();
  io.in(game.id).emit("gameSetup", game.DTO);
}

io.of("/").adapter.on("leave-room", (room, id) => {
  const game = gameHandler[room];
  if (game !== undefined) {
    if (game.spectators.includes(id)) {
      game.removeSpectator(id);
      io.to(game.id).emit("spectatorLeft", game.spectators);
    }

    if (game.players.some((p) => p.id === id)) {
      game.removePlayer(id);
      io.to(game.id).emit("playerLeft", game.DTO.players, game.activePlayerId);
    }
  }
});

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
