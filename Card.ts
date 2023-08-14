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

  
export interface Card {
  suit: Suit
  value: Value
}

export interface GameCard extends Card{
  placement: number
}
export function getSortedDeck ():Card[]  {
  const numOfJokers = 1;
  const randomDeck:Card[] = [];
  for (let i = 0; i < 52 + numOfJokers; i++) {
    randomDeck.push(numToCard(i))
  }
  return randomDeck;
}

export function getRandomDeck ():Card[] {
  return shuffle(getSortedDeck());
}

export function shuffle(d:Card[]):Card[] {
  const deck = [...d];
  for (let i = deck.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * i);
    let temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }
  return deck;
}

export function getRandomCard():Card {
  const r = Math.random()*54;
  const card = numToCard(r);
  return card;
}

export function getRandomCards(n :number):GameCard[] {
  const cards:GameCard[] = [];
  for (let i:number = 0; i < n; i++) {
    const gameCard:GameCard = {...getRandomCard(), placement: i};
    cards.push(gameCard);
  };

  return cards;
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