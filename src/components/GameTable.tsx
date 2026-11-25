import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Layers, RefreshCw, ShieldAlert, Trophy, ArrowLeft, PlusCircle } from 'lucide-react';
import {
  BOT_ROSTER,
  Player,
  compareHands,
  createShuffledDeck,
  decideAiAction,
  evaluateHand,
  shouldAiAcceptSideShow,
} from '../engine/teenPatti';
import { soundFX } from '../utils/sound';
import { GameMode } from './LobbyScreen';
import { PlayingCard } from './PlayingCard';

interface GameTableProps {
  playerCount: 3 | 4 | 5 | 7;
  mode: GameMode;
  bootAmount: number;
  initialUserGems: number;
  onSyncUserGems: (gems: number) => void;
  onExitToLobby: () => void;
}

type TablePhase = 'PLAYING' | 'ROUND_OVER';

interface PendingSideShow {
  requesterIndex: number;
  targetIndex: number;
}

interface RoundResult {
  winnerIndices: number[];
  potWon: number;
  winningLabel: string;
  reason: string;
}

function buildInitialPlayers(
  playerCount: 3 | 4 | 5 | 7,
  mode: GameMode,
  initialUserGems: number
): Player[] {
  const players: Player[] = [];
  for (let i = 0; i < playerCount; i++) {
    if (mode === 'friends') {
      players.push({
        id: i,
        name: i === 0 ? 'Player 1' : `Player ${i + 1}`,
        isHuman: true,
        gems: i === 0 ? Math.max(initialUserGems, 1000) : 1000,
        cards: [],
        isSeen: false,
        status: 'ACTIVE',
        totalBetInRound: 0,
      });
    } else if (i === 0) {
      players.push({
        id: 0,
        name: 'You',
        isHuman: true,
        gems: initialUserGems,
        cards: [],
        isSeen: false,
        status: 'ACTIVE',
        totalBetInRound: 0,
      });
    } else {
      const bot = BOT_ROSTER[(i - 1) % BOT_ROSTER.length];
      players.push({
        id: i,
        name: bot.name,
        isHuman: false,
        personality: bot.personality,
        gems: 1000 + Math.floor(Math.random() * 4) * 100,
        cards: [],
        isSeen: false,
        status: 'ACTIVE',
        totalBetInRound: 0,
      });
    }
  }
  return players;
}

function dealRoundState(
  existingPlayers: Player[],
  bootAmount: number,
  dealerIndex: number,
  mode: GameMode
): {
  players: Player[];
  pot: number;
  currentTurnIndex: number;
  currentBlindStake: number;
} {
  const deck = createShuffledDeck();
  let pot = 0;

  const players: Player[] = existingPlayers.map((p, idx) => {
    // Re-buy bots automatically if low between rounds so table stays active
    let startingGems = p.gems;
    if (!p.isHuman && startingGems < bootAmount * 2) {
      startingGems = 1000;
    }
    if (mode === 'friends' && startingGems < bootAmount) {
      startingGems = 1000;
    }
    const ante = Math.min(startingGems, bootAmount);
    pot += ante;
    const cards = deck.slice(idx * 3, idx * 3 + 3);
    return {
      ...p,
      gems: startingGems - ante,
      cards,
      isSeen: false,
      status: 'ACTIVE',
      totalBetInRound: ante,
      lastAction: `Boot ${ante}`,
    };
  });

  const firstTurn = (dealerIndex + 1) % players.length;

  return {
    players,
    pot,
    currentTurnIndex: firstTurn,
    currentBlindStake: bootAmount,
  };
}

export const GameTable: React.FC<GameTableProps> = ({
  playerCount,
  mode,
  bootAmount,
  initialUserGems,
  onSyncUserGems,
  onExitToLobby,
}) => {
  const [dealerIndex, setDealerIndex] = useState(0);
  const [players, setPlayers] = useState<Player[]>(() => {
    const base = buildInitialPlayers(playerCount, mode, initialUserGems);
    const dealt = dealRoundState(base, bootAmount, 0, mode);
    return dealt.players;
  });
  const [pot, setPot] = useState<number>(() => bootAmount * playerCount);
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(() => 1 % playerCount);
  const [currentBlindStake, setCurrentBlindStake] = useState<number>(bootAmount);
  const [roundTurns, setRoundTurns] = useState<number>(0);
  const [phase, setPhase] = useState<TablePhase>('PLAYING');
  const [statusMessage, setStatusMessage] = useState<string>(
    `Cards dealt · Boot ${bootAmount} Gems each`
  );
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [pendingSideShow, setPendingSideShow] = useState<PendingSideShow | null>(null);
  const [passCurtainOpen, setPassCurtainOpen] = useState<boolean>(mode === 'friends');

  useEffect(() => {
    soundFX.playDeal();
    if (mode === 'bots') {
      onSyncUserGems(players[0].gems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeIndices = useMemo(
    () =>
      players
        .map((p, idx) => (p.status === 'ACTIVE' ? idx : -1))
        .filter((idx) => idx !== -1),
    [players]
  );

  const currentPlayer = players[currentTurnIndex];

  // Find the active player who acted immediately before currentTurnIndex
  const previousActiveIndex = useMemo(() => {
    if (activeIndices.length <= 1) return null;
    for (let offset = 1; offset < players.length; offset++) {
      const idx = (currentTurnIndex - offset + players.length) % players.length;
      if (players[idx].status === 'ACTIVE') return idx;
    }
    return null;
  }, [activeIndices.length, currentTurnIndex, players]);

  const finishRoundWithWinner = (
    updatedPlayers: Player[],
    totalPot: number,
    winnerIndices: number[],
    reason: string
  ) => {
    const splitShare = Math.floor(totalPot / winnerIndices.length);
    const remainder = totalPot % winnerIndices.length;

    const finalPlayers = updatedPlayers.map((p, idx) => {
      const winPos = winnerIndices.indexOf(idx);
      if (winPos === -1) return p;
      const bonus = winPos === 0 ? remainder : 0;
      return {
        ...p,
        gems: p.gems + splitShare + bonus,
      };
    });

    if (mode === 'bots') {
      onSyncUserGems(finalPlayers[0].gems);
    }

    const firstWinner = finalPlayers[winnerIndices[0]];
    const winningEval = evaluateHand(firstWinner.cards);

    setPlayers(finalPlayers);
    setPot(totalPot);
    setPhase('ROUND_OVER');
    setPassCurtainOpen(false);
    setPendingSideShow(null);
    setRoundResult({
      winnerIndices,
      potWon: totalPot,
      winningLabel: reason === 'Last player standing' ? 'Uncontested Pot' : winningEval.label,
      reason,
    });
    setStatusMessage(
      winnerIndices.length > 1
        ? `Split Pot! ${winnerIndices.map((i) => finalPlayers[i].name).join(' & ')} win ${totalPot} Gems`
        : `${firstWinner.name} wins ${totalPot.toLocaleString()} Gems`
    );
    soundFX.playWin();
  };

  const advanceTurnFrom = (
    nextPlayers: Player[],
    nextPot: number,
    fromIndex: number,
    nextBlindStake: number,
    announcement: string
  ) => {
    const remaining = nextPlayers
      .map((p, idx) => (p.status === 'ACTIVE' ? idx : -1))
      .filter((idx) => idx !== -1);

    if (remaining.length === 1) {
      finishRoundWithWinner(nextPlayers, nextPot, [remaining[0]], 'Last player standing');
      return;
    }

    let nextIdx = (fromIndex + 1) % nextPlayers.length;
    while (nextPlayers[nextIdx].status !== 'ACTIVE') {
      nextIdx = (nextIdx + 1) % nextPlayers.length;
    }

    setPlayers(nextPlayers);
    setPot(nextPot);
    setCurrentBlindStake(nextBlindStake);
    setCurrentTurnIndex(nextIdx);
    setRoundTurns((t) => t + 1);
    setStatusMessage(announcement);

    if (mode === 'bots') {
      onSyncUserGems(nextPlayers[0].gems);
    } else if (mode === 'friends') {
      setPassCurtainOpen(true);
    }
  };

  const handleSeeCards = (playerIdx: number) => {
    if (phase !== 'PLAYING' || playerIdx !== currentTurnIndex) return;
    soundFX.playFlip();
    setPlayers((prev) =>
      prev.map((p, idx) =>
        idx === playerIdx ? { ...p, isSeen: true, lastAction: 'Seen' } : p
      )
    );
    setStatusMessage(`${players[playerIdx].name} viewed their cards`);
  };

  const handlePack = (playerIdx: number) => {
    if (phase !== 'PLAYING' || playerIdx !== currentTurnIndex) return;
    soundFX.playPack();
    const updated = players.map((p, idx) =>
      idx === playerIdx ? { ...p, status: 'PACKED' as const, lastAction: 'Packed' } : p
    );
    advanceTurnFrom(
      updated,
      pot,
      playerIdx,
      currentBlindStake,
      `${players[playerIdx].name} packed`
    );
  };

  const handleBet = (playerIdx: number, raise: boolean) => {
    if (phase !== 'PLAYING' || playerIdx !== currentTurnIndex) return;
    const actor = players[playerIdx];
    const nextBlindStake = raise ? currentBlindStake * 2 : currentBlindStake;
    const rawCost = actor.isSeen ? nextBlindStake * 2 : nextBlindStake;
    const cost = Math.min(actor.gems, rawCost);

    soundFX.playChip();
    const actionText = actor.isSeen
      ? raise
        ? `Chaal 2x (${cost})`
        : `Chaal (${cost})`
      : raise
        ? `Blind 2x (${cost})`
        : `Blind (${cost})`;

    const updated = players.map((p, idx) =>
      idx === playerIdx
        ? {
            ...p,
            gems: p.gems - cost,
            totalBetInRound: p.totalBetInRound + cost,
            lastAction: actionText,
          }
        : p
    );

    advanceTurnFrom(
      updated,
      pot + cost,
      playerIdx,
      nextBlindStake,
      `${actor.name} played ${actionText} Gems`
    );
  };

  const handleShow = (playerIdx: number) => {
    if (phase !== 'PLAYING' || playerIdx !== currentTurnIndex || activeIndices.length !== 2) {
      return;
    }
    const actor = players[playerIdx];
    const rawCost = actor.isSeen ? currentBlindStake * 2 : currentBlindStake;
    const cost = Math.min(actor.gems, rawCost);
    soundFX.playChip();

    const updated = players.map((p, idx) =>
      idx === playerIdx
        ? {
            ...p,
            gems: p.gems - cost,
            totalBetInRound: p.totalBetInRound + cost,
            lastAction: `Show (${cost})`,
          }
        : p
    );

    const [idxA, idxB] = activeIndices;
    const cmp = compareHands(updated[idxA].cards, updated[idxB].cards);
    const winners = cmp > 0 ? [idxA] : cmp < 0 ? [idxB] : [idxA, idxB];
    finishRoundWithWinner(
      updated,
      pot + cost,
      winners,
      `${actor.name} called Show`
    );
  };

  const resolveSideShow = (
    requesterIdx: number,
    targetIdx: number,
    accepted: boolean,
    playersSnapshot: Player[],
    potSnapshot: number
  ) => {
    const requester = playersSnapshot[requesterIdx];
    const target = playersSnapshot[targetIdx];

    if (!accepted) {
      const updated = playersSnapshot.map((p, idx) =>
        idx === targetIdx ? { ...p, lastAction: 'Declined Show' } : p
      );
      setPendingSideShow(null);
      advanceTurnFrom(
        updated,
        potSnapshot,
        requesterIdx,
        currentBlindStake,
        `${target.name} declined Side Show`
      );
      return;
    }

    const cmp = compareHands(requester.cards, target.cards);
    // In Teen Patti, if requester wins strictly, target packs; on loss or tie, requester packs
    const loserIdx = cmp > 0 ? targetIdx : requesterIdx;
    const winnerIdx = loserIdx === targetIdx ? requesterIdx : targetIdx;
    soundFX.playPack();

    const updated = playersSnapshot.map((p, idx) =>
      idx === loserIdx
        ? { ...p, status: 'PACKED' as const, lastAction: 'Lost Side Show' }
        : idx === winnerIdx
          ? { ...p, lastAction: 'Won Side Show' }
          : p
    );

    setPendingSideShow(null);
    advanceTurnFrom(
      updated,
      potSnapshot,
      requesterIdx,
      currentBlindStake,
      `Side Show: ${updated[winnerIdx].name} beat ${updated[loserIdx].name}`
    );
  };

  const handleSideShowRequest = (playerIdx: number) => {
    if (
      phase !== 'PLAYING' ||
      playerIdx !== currentTurnIndex ||
      activeIndices.length <= 2 ||
      previousActiveIndex === null
    ) {
      return;
    }
    const actor = players[playerIdx];
    const target = players[previousActiveIndex];
    if (!actor.isSeen || !target.isSeen) return;

    const cost = Math.min(actor.gems, currentBlindStake * 2);
    soundFX.playChip();

    const updated = players.map((p, idx) =>
      idx === playerIdx
        ? {
            ...p,
            gems: p.gems - cost,
            totalBetInRound: p.totalBetInRound + cost,
            lastAction: `Side Show (${cost})`,
          }
        : p
    );
    const nextPot = pot + cost;

    if (!target.isHuman) {
      const accepted = shouldAiAcceptSideShow(target);
      resolveSideShow(playerIdx, previousActiveIndex, accepted, updated, nextPot);
    } else {
      setPlayers(updated);
      setPot(nextPot);
      setPendingSideShow({ requesterIndex: playerIdx, targetIndex: previousActiveIndex });
    }
  };

  // Bot automation loop
  useEffect(() => {
    if (phase !== 'PLAYING' || pendingSideShow || !currentPlayer || currentPlayer.isHuman) {
      return;
    }

    const timer = window.setTimeout(() => {
      const prevPlayer = previousActiveIndex !== null ? players[previousActiveIndex] : null;
      const decision = decideAiAction({
        player: currentPlayer,
        activePlayersCount: activeIndices.length,
        currentBlindStake,
        bootAmount,
        pot,
        previousActivePlayer: prevPlayer,
        roundTurns,
      });

      if (decision.type === 'SEE_AND_ACT') {
        soundFX.playFlip();
        const seenSnapshot = players.map((p, idx) =>
          idx === currentTurnIndex ? { ...p, isSeen: true, lastAction: 'Seen' } : p
        );
        // After peeking, act immediately in the next micro-step via updated decision
        const seenActor = seenSnapshot[currentTurnIndex];
        const postSee = decideAiAction({
          player: seenActor,
          activePlayersCount: activeIndices.length,
          currentBlindStake,
          bootAmount,
          pot,
          previousActivePlayer: prevPlayer,
          roundTurns,
        });

        if (postSee.type === 'PACK') {
          soundFX.playPack();
          const packed = seenSnapshot.map((p, idx) =>
            idx === currentTurnIndex
              ? { ...p, status: 'PACKED' as const, lastAction: 'Packed' }
              : p
          );
          advanceTurnFrom(
            packed,
            pot,
            currentTurnIndex,
            currentBlindStake,
            `${seenActor.name} viewed cards & packed`
          );
          return;
        }

        if (postSee.type === 'SHOW' && activeIndices.length === 2) {
          const rawCost = currentBlindStake * 2;
          const cost = Math.min(seenActor.gems, rawCost);
          soundFX.playChip();
          const updated = seenSnapshot.map((p, idx) =>
            idx === currentTurnIndex
              ? {
                  ...p,
                  gems: p.gems - cost,
                  totalBetInRound: p.totalBetInRound + cost,
                  lastAction: `Show (${cost})`,
                }
              : p
          );
          const [idxA, idxB] = activeIndices;
          const cmp = compareHands(updated[idxA].cards, updated[idxB].cards);
          const winners = cmp > 0 ? [idxA] : cmp < 0 ? [idxB] : [idxA, idxB];
          finishRoundWithWinner(
            updated,
            pot + cost,
            winners,
            `${seenActor.name} called Show`
          );
          return;
        }

        const raise = postSee.type === 'CHAAL' ? postSee.raise : false;
        const nextBlind = raise ? currentBlindStake * 2 : currentBlindStake;
        const cost = Math.min(seenActor.gems, nextBlind * 2);
        soundFX.playChip();
        const actionLabel = raise ? `Chaal 2x (${cost})` : `Chaal (${cost})`;
        const updated = seenSnapshot.map((p, idx) =>
          idx === currentTurnIndex
            ? {
                ...p,
                gems: p.gems - cost,
                totalBetInRound: p.totalBetInRound + cost,
                lastAction: actionLabel,
              }
            : p
        );
        advanceTurnFrom(
          updated,
          pot + cost,
          currentTurnIndex,
          nextBlind,
          `${seenActor.name} viewed cards & played ${actionLabel} Gems`
        );
        return;
      }

      if (decision.type === 'PACK') {
        handlePack(currentTurnIndex);
      } else if (decision.type === 'SHOW' && activeIndices.length === 2) {
        handleShow(currentTurnIndex);
      } else if (
        decision.type === 'SIDE_SHOW' &&
        activeIndices.length > 2 &&
        prevPlayer?.isSeen
      ) {
        handleSideShowRequest(currentTurnIndex);
      } else {
        const raise = decision.type === 'CHAAL' ? decision.raise : false;
        handleBet(currentTurnIndex, raise);
      }
    }, 750);

    return () => window.clearTimeout(timer);
  });

  const handleNextRound = () => {
    const nextDealer = (dealerIndex + 1) % players.length;
    const dealt = dealRoundState(players, bootAmount, nextDealer, mode);
    setDealerIndex(nextDealer);
    setPlayers(dealt.players);
    setPot(dealt.pot);
    setCurrentTurnIndex(dealt.currentTurnIndex);
    setCurrentBlindStake(dealt.currentBlindStake);
    setRoundTurns(0);
    setPhase('PLAYING');
    setRoundResult(null);
    setPendingSideShow(null);
    setPassCurtainOpen(mode === 'friends');
    setStatusMessage(`New round dealt · Boot ${bootAmount} Gems each`);
    if (mode === 'bots') {
      onSyncUserGems(dealt.players[0].gems);
    }
    soundFX.playDeal();
  };

  const handleClaimRefillAndContinue = () => {
    const refilled = players.map((p, idx) =>
      idx === 0 ? { ...p, gems: p.gems + 1000 } : p
    );
    const nextDealer = (dealerIndex + 1) % refilled.length;
    const dealt = dealRoundState(refilled, bootAmount, nextDealer, mode);
    setDealerIndex(nextDealer);
    setPlayers(dealt.players);
    setPot(dealt.pot);
    setCurrentTurnIndex(dealt.currentTurnIndex);
    setCurrentBlindStake(dealt.currentBlindStake);
    setRoundTurns(0);
    setPhase('PLAYING');
    setRoundResult(null);
    setPendingSideShow(null);
    setPassCurtainOpen(mode === 'friends');
    setStatusMessage('Claimed +1,000 Free Gems · New round dealt');
    onSyncUserGems(dealt.players[0].gems);
    soundFX.playDeal();
  };

  // Partition non-bottom seats cleanly for 3, 4, 5, and 7 players
  // Bottom seat is index 0 in 'bots' mode, or player 0 in 'friends' mode.
  const seatGroups = useMemo(() => {
    if (playerCount === 3) {
      return { left: [] as number[], top: [1, 2], right: [] as number[] };
    }
    if (playerCount === 4) {
      return { left: [1], top: [2], right: [3] };
    }
    if (playerCount === 5) {
      return { left: [1], top: [2, 3], right: [4] };
    }
    // 7 players: bottom=0, left=[2, 1] (top-to-bottom), top=[3, 4], right=[5, 6]
    return { left: [2, 1], top: [3, 4], right: [5, 6] };
  }, [playerCount]);

  // Determine which human player controls the bottom action dock
  const actingSeatIndex =
    mode === 'bots'
      ? 0
      : phase === 'PLAYING'
        ? currentTurnIndex
        : 0;
  const actingPlayer = players[actingSeatIndex];
  const isHumanTurn =
    phase === 'PLAYING' &&
    !pendingSideShow &&
    !passCurtainOpen &&
    currentPlayer?.isHuman &&
    currentTurnIndex === actingSeatIndex;

  const currentCallCost = actingPlayer
    ? Math.min(
        actingPlayer.gems,
        actingPlayer.isSeen ? currentBlindStake * 2 : currentBlindStake
      )
    : 0;
  const currentRaiseCost = actingPlayer
    ? Math.min(
        actingPlayer.gems,
        (actingPlayer.isSeen ? currentBlindStake * 2 : currentBlindStake) * 2
      )
    : 0;
  const canSideShow =
    isHumanTurn &&
    actingPlayer.isSeen &&
    activeIndices.length > 2 &&
    previousActiveIndex !== null &&
    players[previousActiveIndex].isSeen;
  const canShow = isHumanTurn && activeIndices.length === 2;
  const canRaise = isHumanTurn && actingPlayer.gems >= currentRaiseCost && currentBlindStake < bootAmount * 16;

  const renderSeatCard = (seatIdx: number) => {
    const p = players[seatIdx];
    const isTurn = phase === 'PLAYING' && currentTurnIndex === seatIdx;
    const isWinner = roundResult?.winnerIndices.includes(seatIdx) ?? false;
    const showFaceUp =
      (phase === 'ROUND_OVER' && p.status === 'ACTIVE' && roundResult?.reason !== 'Last player standing') ||
      (mode === 'friends' && isTurn && !passCurtainOpen && p.isSeen);

    return (
      <div
        key={p.id}
        className={`relative flex flex-col items-center gap-2 px-3 py-2.5 rounded-xl border transition-all min-w-[146px] sm:min-w-[162px] ${
          isWinner
            ? 'bg-[#145C3A]/95 border-amber-400 shadow-lg shadow-amber-500/20'
            : isTurn
              ? 'bg-[#0F452E]/95 border-amber-400/80 shadow-md'
              : 'bg-[#061E15]/85 border-white/12'
        } ${p.status === 'PACKED' ? 'opacity-50' : ''}`}
      >
        <div className="w-full flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-white truncate max-w-[92px]">
            {p.name}
          </span>
          <span className="text-xs font-mono-nums text-amber-300 font-semibold whitespace-nowrap">
            {p.gems.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-center gap-1">
          {p.cards.map((card, cIdx) => (
            <PlayingCard
              key={card.id}
              card={card}
              faceDown={!showFaceUp}
              size="sm"
              dimmed={p.status === 'PACKED'}
              highlighted={isWinner}
              delayMs={cIdx * 50}
            />
          ))}
        </div>

        <div className="w-full flex items-center justify-between gap-1.5 text-[11px] text-white/75">
          <span className="truncate">
            {p.status === 'PACKED'
              ? 'Packed'
              : p.isSeen
                ? 'Seen'
                : 'Blind'}
          </span>
          {p.lastAction && (
            <span className="text-amber-300/90 font-medium truncate">
              {p.lastAction}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-[calc(100vh-64px)] flex flex-col justify-between px-3 sm:px-6 py-4 max-w-6xl mx-auto gap-4">
      {/* Top Sub-bar: Back to Lobby + Table Info */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onExitToLobby}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0D3527] hover:bg-[#145C3A] border border-white/15 text-xs sm:text-sm font-medium text-white/90 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Lobby
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm text-white/75 whitespace-nowrap">
          <span>{playerCount} Players</span>
          <span aria-hidden="true">·</span>
          <span>{mode === 'bots' ? 'Solo vs Bots' : 'Pass & Play'}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-nums text-amber-300">Boot {bootAmount}</span>
        </div>
      </div>

      {/* Main Emerald Felt Table Arena */}
      <section className="relative flex-1 rounded-3xl overflow-hidden border-2 border-amber-500/30 bg-gradient-to-b from-[#145C3A] to-[#09291E] shadow-2xl p-4 sm:p-6 flex flex-col justify-between min-h-[470px]">
        {/* Generated Luxury Felt Texture Backdrop with graceful fallback */}
        <img
          src="/src/assets/images/game_card_table_felt_1795570188770.jpg"
          alt="Emerald card table surface"
          referrerPolicy="no-referrer"
          className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover opacity-55"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45" />

        {/* Pass & Play Privacy Curtain */}
        {mode === 'friends' && phase === 'PLAYING' && passCurtainOpen && !pendingSideShow && (
          <div className="absolute inset-0 z-30 bg-[#072017]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <Layers className="w-12 h-12 text-amber-400 mb-3" />
            <h2 className="font-display text-2xl font-bold text-amber-300">
              Pass Device to {currentPlayer.name}
            </h2>
            <p className="mt-2 text-sm text-white/75 max-w-sm">
              Keep your cards private. Tap below once only {currentPlayer.name} is looking at the screen.
            </p>
            <button
              type="button"
              onClick={() => setPassCurtainOpen(false)}
              className="mt-6 min-h-[48px] px-7 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#09291E] font-bold text-sm shadow-lg transition-colors cursor-pointer"
            >
              I am {currentPlayer.name} · Start Turn
            </button>
          </div>
        )}

        {/* Pass & Play Side Show Decision Curtain */}
        {pendingSideShow && (
          <div className="absolute inset-0 z-30 bg-[#072017]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <ShieldAlert className="w-12 h-12 text-amber-400 mb-3" />
            <h2 className="font-display text-2xl font-bold text-amber-300">
              Side Show Request
            </h2>
            <p className="mt-2 text-sm text-white/80 max-w-md">
              <strong>{players[pendingSideShow.requesterIndex].name}</strong> wants to compare cards privately with{' '}
              <strong>{players[pendingSideShow.targetIndex].name}</strong>. The lower hand packs.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  resolveSideShow(
                    pendingSideShow.requesterIndex,
                    pendingSideShow.targetIndex,
                    false,
                    players,
                    pot
                  )
                }
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0D3527] hover:bg-[#145C3A] border border-white/20 text-sm font-semibold text-white cursor-pointer"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() =>
                  resolveSideShow(
                    pendingSideShow.requesterIndex,
                    pendingSideShow.targetIndex,
                    true,
                    players,
                    pot
                  )
                }
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#09291E] text-sm font-bold cursor-pointer"
              >
                Accept &amp; Compare
              </button>
            </div>
          </div>
        )}

        {/* Top Row Opponent Seats */}
        <div className="relative z-10 flex flex-wrap items-start justify-center gap-3 sm:gap-5">
          {seatGroups.top.map((idx) => renderSeatCard(idx))}
        </div>

        {/* Middle Row: Left Flank — Center Pot — Right Flank */}
        <div className="relative z-10 my-4 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex flex-row md:flex-col items-center md:items-start justify-center gap-3">
            {seatGroups.left.map((idx) => renderSeatCard(idx))}
          </div>

          {/* Center Pot & Round Status */}
          <div className="mx-auto flex flex-col items-center text-center px-6 py-4 rounded-2xl bg-[#061D15]/85 border border-amber-400/35 shadow-xl min-w-[230px] max-w-sm">
            <span className="text-xs font-medium text-white/70">Total Table Pot</span>
            <div className="mt-0.5 font-mono-nums text-3xl font-bold text-amber-400">
              {pot.toLocaleString()} Gems
            </div>
            <div className="mt-1.5 text-xs text-white/75 flex items-center gap-2 font-mono-nums">
              <span>Blind: {currentBlindStake}</span>
              <span aria-hidden="true">·</span>
              <span>Seen: {currentBlindStake * 2}</span>
            </div>
            <p className="mt-2.5 text-xs sm:text-sm font-medium text-amber-200/95">
              {statusMessage}
            </p>

            {phase === 'ROUND_OVER' && roundResult && (
              <div className="mt-4 pt-3 border-t border-white/15 w-full flex flex-col items-center gap-2.5">
                <div className="flex items-center gap-1.5 text-sm font-bold text-amber-300">
                  <Trophy className="w-4 h-4" />
                  <span>{roundResult.winningLabel}</span>
                </div>
                {mode === 'bots' && players[0].gems < bootAmount ? (
                  <button
                    type="button"
                    onClick={handleClaimRefillAndContinue}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#09291E] font-bold text-sm cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Claim +1,000 Gems &amp; Deal
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNextRound}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#09291E] font-bold text-sm cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Deal Next Round
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-end justify-center gap-3">
            {seatGroups.right.map((idx) => renderSeatCard(idx))}
          </div>
        </div>

        {/* Bottom Dock: Acting Human Player Hand & Controls */}
        {actingPlayer && (
          <div className="relative z-10 mt-auto pt-2 flex flex-col items-center gap-3">
            <div
              className={`flex flex-col sm:flex-row items-center gap-4 px-5 py-3.5 rounded-2xl border transition-all ${
                roundResult?.winnerIndices.includes(actingSeatIndex)
                  ? 'bg-[#145C3A]/95 border-amber-400 shadow-lg shadow-amber-500/20'
                  : isHumanTurn
                    ? 'bg-[#08241A]/95 border-amber-400/75 shadow-lg'
                    : 'bg-[#061D15]/90 border-white/15'
              } ${actingPlayer.status === 'PACKED' ? 'opacity-65' : ''}`}
            >
              {/* Player Cards */}
              <div className="flex items-center gap-2">
                {actingPlayer.cards.map((card, idx) => {
                  const showMyCards =
                    actingPlayer.isSeen ||
                    (phase === 'ROUND_OVER' &&
                      actingPlayer.status === 'ACTIVE' &&
                      roundResult?.reason !== 'Last player standing');
                  return (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      faceDown={!showMyCards}
                      size="md"
                      dimmed={actingPlayer.status === 'PACKED'}
                      highlighted={roundResult?.winnerIndices.includes(actingSeatIndex)}
                      delayMs={idx * 60}
                    />
                  );
                })}
              </div>

              {/* Player Info + Hand Rank */}
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-[140px]">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">
                    {actingPlayer.name}
                  </span>
                  <span className="text-xs text-white/70">
                    {actingPlayer.status === 'PACKED'
                      ? 'Packed'
                      : actingPlayer.isSeen
                        ? 'Seen'
                        : 'Blind'}
                  </span>
                </div>
                <div className="text-sm font-mono-nums font-semibold text-amber-300 mt-0.5">
                  {actingPlayer.gems.toLocaleString()} Gems
                </div>
                <div className="text-xs text-white/75 mt-1">
                  {actingPlayer.isSeen || phase === 'ROUND_OVER'
                    ? evaluateHand(actingPlayer.cards).label
                    : 'Playing Blind (1x Stake)'}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {isHumanTurn && !actingPlayer.isSeen && (
                <button
                  type="button"
                  onClick={() => handleSeeCards(actingSeatIndex)}
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#145C3A] hover:bg-[#197047] border border-amber-400/45 text-amber-300 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  See Cards
                </button>
              )}

              {isHumanTurn && (
                <>
                  <button
                    type="button"
                    onClick={() => handlePack(actingSeatIndex)}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0D3527] hover:bg-red-950/80 border border-white/20 hover:border-red-400/50 text-white/90 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Pack
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBet(actingSeatIndex, false)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#09291E] font-bold text-sm shadow-md transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {actingPlayer.isSeen ? 'Chaal' : 'Blind'} ({currentCallCost})
                  </button>

                  {canRaise && (
                    <button
                      type="button"
                      onClick={() => handleBet(actingSeatIndex, true)}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#145C3A] hover:bg-[#1A7349] border border-amber-400/50 text-amber-300 font-bold text-sm transition-colors whitespace-nowrap cursor-pointer"
                    >
                      2x Raise ({currentRaiseCost})
                    </button>
                  )}

                  {canSideShow && (
                    <button
                      type="button"
                      onClick={() => handleSideShowRequest(actingSeatIndex)}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0D3527] hover:bg-[#145C3A] border border-amber-400/35 text-amber-200 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Side Show ({currentCallCost})
                    </button>
                  )}

                  {canShow && (
                    <button
                      type="button"
                      onClick={() => handleShow(actingSeatIndex)}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-300 hover:bg-amber-200 text-[#09291E] font-bold text-sm shadow-md transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Show ({currentCallCost})
                    </button>
                  )}
                </>
              )}

              {phase === 'PLAYING' && !isHumanTurn && !passCurtainOpen && (
                <div className="min-h-[44px] flex items-center text-sm text-white/75">
                  Waiting for {currentPlayer?.name} to act…
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
};
