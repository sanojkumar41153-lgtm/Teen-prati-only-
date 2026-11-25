export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export interface Card {
  id: string;
  suit: Suit;
  rank: number; // 2..14 (11=J, 12=Q, 13=K, 14=A)
}

export type HandCategory =
  | 'TRAIL'
  | 'PURE_SEQUENCE'
  | 'SEQUENCE'
  | 'COLOR'
  | 'PAIR'
  | 'HIGH_CARD';

export interface HandEvaluation {
  category: HandCategory;
  label: string;
  score: number[]; // Lexicographically comparable tuple
}

export type PlayerStatus = 'ACTIVE' | 'PACKED';

export interface Player {
  id: number;
  name: string;
  isHuman: boolean;
  personality?: 'cautious' | 'balanced' | 'bold';
  gems: number;
  cards: Card[];
  isSeen: boolean;
  status: PlayerStatus;
  totalBetInRound: number;
  lastAction?: string;
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export function formatRank(rank: number): string {
  switch (rank) {
    case 14:
      return 'A';
    case 13:
      return 'K';
    case 12:
      return 'Q';
    case 11:
      return 'J';
    default:
      return String(rank);
  }
}

export function createShuffledDeck(): Card[] {
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const deck: Card[] = [];
  for (const suit of suits) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
      });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function getSequenceStrength(sortedDesc: number[]): number | null {
  const [a, b, c] = sortedDesc;
  // A-K-Q (14, 13, 12) is the highest sequence in Teen Patti
  if (a === 14 && b === 13 && c === 12) return 15;
  // A-2-3 (14, 3, 2) is the second-highest sequence in Teen Patti
  if (a === 14 && b === 3 && c === 2) return 14;
  // Standard descending sequence (e.g., K-Q-J = 13 down to 4-3-2 = 4)
  if (a - b === 1 && b - c === 1) return a;
  return null;
}

export function evaluateHand(cards: Card[]): HandEvaluation {
  if (cards.length !== 3) {
    return { category: 'HIGH_CARD', label: 'High Card', score: [0] };
  }

  const ranksDesc = cards.map((c) => c.rank).sort((a, b) => b - a);
  const [r1, r2, r3] = ranksDesc;
  const isFlush =
    cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
  const seqStrength = getSequenceStrength(ranksDesc);

  // 1. Trail / Trio
  if (r1 === r2 && r2 === r3) {
    return {
      category: 'TRAIL',
      label: `Trail (${formatRank(r1)}s)`,
      score: [6, r1],
    };
  }

  // 2. Pure Sequence (Straight Flush)
  if (isFlush && seqStrength !== null) {
    return {
      category: 'PURE_SEQUENCE',
      label: 'Pure Sequence',
      score: [5, seqStrength],
    };
  }

  // 3. Sequence (Straight)
  if (seqStrength !== null) {
    return {
      category: 'SEQUENCE',
      label: 'Sequence',
      score: [4, seqStrength],
    };
  }

  // 4. Color (Flush)
  if (isFlush) {
    return {
      category: 'COLOR',
      label: 'Color',
      score: [3, r1, r2, r3],
    };
  }

  // 5. Pair
  if (r1 === r2 || r2 === r3 || r1 === r3) {
    const pairRank = r1 === r2 ? r1 : r2 === r3 ? r2 : r1;
    const kicker = r1 === r2 ? r3 : r2 === r3 ? r1 : r2;
    return {
      category: 'PAIR',
      label: `Pair (${formatRank(pairRank)}s)`,
      score: [2, pairRank, kicker],
    };
  }

  // 6. High Card
  return {
    category: 'HIGH_CARD',
    label: `High Card (${formatRank(r1)})`,
    score: [1, r1, r2, r3],
  };
}

export function compareEvaluations(a: HandEvaluation, b: HandEvaluation): number {
  const len = Math.max(a.score.length, b.score.length);
  for (let i = 0; i < len; i++) {
    const va = a.score[i] ?? 0;
    const vb = b.score[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

export function compareHands(cardsA: Card[], cardsB: Card[]): number {
  return compareEvaluations(evaluateHand(cardsA), evaluateHand(cardsB));
}

export type AiDecision =
  | { type: 'SEE_AND_ACT' }
  | { type: 'CHAAL'; raise: boolean }
  | { type: 'PACK' }
  | { type: 'SHOW' }
  | { type: 'SIDE_SHOW' };

export function decideAiAction(params: {
  player: Player;
  activePlayersCount: number;
  currentBlindStake: number;
  bootAmount: number;
  pot: number;
  previousActivePlayer: Player | null;
  roundTurns: number;
}): AiDecision {
  const {
    player,
    activePlayersCount,
    currentBlindStake,
    bootAmount,
    previousActivePlayer,
    roundTurns,
  } = params;

  const evalResult = evaluateHand(player.cards);
  const categoryRank = evalResult.score[0]; // 1..6
  const highCard = evalResult.score[1] ?? 2;
  const stakeRatio = currentBlindStake / bootAmount;
  const personality = player.personality ?? 'balanced';
  const riskOffset =
    personality === 'bold' ? 0.14 : personality === 'cautious' ? -0.14 : 0;

  // Blind AI behavior: play a couple blind turns early, occasionally peek
  if (!player.isSeen) {
    const canBlindPlay = stakeRatio <= 4 && roundTurns < activePlayersCount * 2;
    const peekChance =
      stakeRatio >= 4 ? 0.85 : stakeRatio >= 2 ? 0.55 : 0.28 - riskOffset * 0.5;

    if (canBlindPlay && Math.random() > peekChance && player.gems >= currentBlindStake) {
      const blindRaise =
        stakeRatio < 2 && personality === 'bold' && Math.random() < 0.25;
      return { type: 'CHAAL', raise: blindRaise };
    }
    return { type: 'SEE_AND_ACT' };
  }

  // Seen AI behavior
  const callCost = currentBlindStake * 2;

  // If 2 players remain, strong hands or high stakes trigger Show
  if (activePlayersCount === 2 && roundTurns >= 3) {
    if (categoryRank >= 3 && stakeRatio >= 2 && Math.random() < 0.45) {
      return { type: 'SHOW' };
    }
    if (categoryRank === 2 && stakeRatio >= 2 && Math.random() < 0.65) {
      return { type: 'SHOW' };
    }
    if (categoryRank === 1 && highCard < 12 && stakeRatio >= 2) {
      return Math.random() < 0.55 ? { type: 'PACK' } : { type: 'SHOW' };
    }
  }

  // Side Show check when > 2 active players and previous active player is Seen
  if (
    activePlayersCount > 2 &&
    previousActivePlayer &&
    previousActivePlayer.isSeen &&
    roundTurns >= activePlayersCount &&
    categoryRank >= 2 &&
    categoryRank <= 3 &&
    stakeRatio >= 2 &&
    Math.random() < 0.32
  ) {
    return { type: 'SIDE_SHOW' };
  }

  // Hand strength scoring (0..1)
  let strength = 0.2;
  if (categoryRank >= 5) strength = 0.98;
  else if (categoryRank === 4) strength = 0.92;
  else if (categoryRank === 3) strength = 0.82;
  else if (categoryRank === 2) {
    strength = 0.55 + (highCard / 14) * 0.22;
  } else {
    strength = 0.16 + (highCard / 14) * 0.24;
  }

  const adjustedStrength = strength + riskOffset;

  // Fold weak hands when stakes escalate
  if (stakeRatio >= 8 && adjustedStrength < 0.72) {
    return activePlayersCount === 2 ? { type: 'SHOW' } : { type: 'PACK' };
  }
  if (stakeRatio >= 4 && adjustedStrength < 0.48) {
    return activePlayersCount === 2 && Math.random() < 0.4
      ? { type: 'SHOW' }
      : { type: 'PACK' };
  }
  if (stakeRatio >= 2 && adjustedStrength < 0.32) {
    return { type: 'PACK' };
  }
  if (adjustedStrength < 0.24 && Math.random() < 0.55) {
    return { type: 'PACK' };
  }

  // Raise on strong hands if affordable
  const canRaise =
    player.gems >= callCost * 2 &&
    stakeRatio < 8 &&
    adjustedStrength > 0.75 &&
    Math.random() < 0.4;

  if (player.gems <= 0) {
    return { type: 'PACK' };
  }

  return { type: 'CHAAL', raise: canRaise };
}

export function shouldAiAcceptSideShow(aiPlayer: Player): boolean {
  const evalResult = evaluateHand(aiPlayer.cards);
  const rank = evalResult.score[0];
  if (rank >= 3) return true;
  if (rank === 2) return Math.random() < 0.7;
  return Math.random() < 0.35;
}

export const BOT_ROSTER: Array<{
  name: string;
  personality: 'cautious' | 'balanced' | 'bold';
}> = [
  { name: 'Aarav', personality: 'balanced' },
  { name: 'Meera', personality: 'cautious' },
  { name: 'Kabir', personality: 'bold' },
  { name: 'Zoya', personality: 'balanced' },
  { name: 'Vikram', personality: 'bold' },
  { name: 'Naina', personality: 'cautious' },
];
