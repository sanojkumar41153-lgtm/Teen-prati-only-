import React from 'react';
import { X } from 'lucide-react';
import { Card } from '../engine/teenPatti';
import { PlayingCard } from './PlayingCard';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HAND_EXAMPLES: Array<{
  rank: string;
  name: string;
  desc: string;
  cards: Card[];
}> = [
  {
    rank: '01',
    name: 'Trail (Three of a Kind)',
    desc: 'Three cards of the same rank. A-A-A is the highest possible hand.',
    cards: [
      { id: 'ex-1a', suit: 'spades', rank: 14 },
      { id: 'ex-1b', suit: 'hearts', rank: 14 },
      { id: 'ex-1c', suit: 'diamonds', rank: 14 },
    ],
  },
  {
    rank: '02',
    name: 'Pure Sequence (Straight Flush)',
    desc: 'Three consecutive cards of the same suit. A-K-Q ranks highest, followed by A-2-3.',
    cards: [
      { id: 'ex-2a', suit: 'hearts', rank: 14 },
      { id: 'ex-2b', suit: 'hearts', rank: 13 },
      { id: 'ex-2c', suit: 'hearts', rank: 12 },
    ],
  },
  {
    rank: '03',
    name: 'Sequence (Run)',
    desc: 'Three consecutive cards of mixed suits. A-K-Q is highest, followed by A-2-3.',
    cards: [
      { id: 'ex-3a', suit: 'clubs', rank: 14 },
      { id: 'ex-3b', suit: 'diamonds', rank: 2 },
      { id: 'ex-3c', suit: 'spades', rank: 3 },
    ],
  },
  {
    rank: '04',
    name: 'Color (Flush)',
    desc: 'Any three cards of the same suit that are not in sequence.',
    cards: [
      { id: 'ex-4a', suit: 'spades', rank: 13 },
      { id: 'ex-4b', suit: 'spades', rank: 9 },
      { id: 'ex-4c', suit: 'spades', rank: 5 },
    ],
  },
  {
    rank: '05',
    name: 'Pair (Double)',
    desc: 'Two cards of the same rank plus one kicker.',
    cards: [
      { id: 'ex-5a', suit: 'diamonds', rank: 11 },
      { id: 'ex-5b', suit: 'clubs', rank: 11 },
      { id: 'ex-5c', suit: 'hearts', rank: 7 },
    ],
  },
  {
    rank: '06',
    name: 'High Card',
    desc: 'When no combination is formed, the highest card rank wins.',
    cards: [
      { id: 'ex-6a', suit: 'spades', rank: 14 },
      { id: 'ex-6b', suit: 'hearts', rank: 10 },
      { id: 'ex-6c', suit: 'clubs', rank: 4 },
    ],
  },
];

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl bg-[#0D3527] border border-amber-400/25 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#0D3527]/95 backdrop-blur border-b border-white/10">
          <h2 id="rules-modal-title" className="font-display text-xl font-bold text-amber-400">
            Teen Prati Hand Rankings &amp; Rules
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
            aria-label="Close rules"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3 text-sm text-white/85 leading-relaxed">
            <p>
              Every player places the opening Boot into the center pot and receives three cards face down.
            </p>
            <ul className="space-y-1.5 text-white/80">
              <li>
                <strong className="text-amber-300">Blind vs. Seen:</strong> Play Blind at 1x the current stake, or tap See Cards anytime to view your hand and play Seen at 2x the Blind stake.
              </li>
              <li>
                <strong className="text-amber-300">Chaal &amp; 2x Raise:</strong> Match the current stake to stay in the round, or double it when raising.
              </li>
              <li>
                <strong className="text-amber-300">Side Show:</strong> When 3 or more players remain and both you and the previous active player are Seen, request a private comparison. If accepted, the lower hand packs.
              </li>
              <li>
                <strong className="text-amber-300">Show:</strong> When only 2 active players remain, call Show to reveal cards and award the pot to the stronger hand.
              </li>
            </ul>
          </div>

          <div className="border-t border-white/10 pt-5 space-y-3">
            <h3 className="text-sm font-semibold text-amber-300 tracking-wide">
              Hand Hierarchy (Highest to Lowest)
            </h3>
            <div className="divide-y divide-white/10">
              {HAND_EXAMPLES.map((item) => (
                <div
                  key={item.rank}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 max-w-sm">
                    <div className="text-sm font-semibold text-white">
                      {item.rank}. {item.name}
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed">{item.desc}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.cards.map((c) => (
                      <PlayingCard key={c.id} card={c} size="xs" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
