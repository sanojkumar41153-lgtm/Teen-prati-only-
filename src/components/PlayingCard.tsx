import React from 'react';
import { Card, SUIT_SYMBOLS, formatRank } from '../engine/teenPatti';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  dimmed?: boolean;
  highlighted?: boolean;
  delayMs?: number;
}

const SIZE_CLASSES: Record<NonNullable<PlayingCardProps['size']>, string> = {
  xs: 'w-9 h-13 rounded-md text-[11px]',
  sm: 'w-12 h-[68px] rounded-lg text-xs',
  md: 'w-16 h-[92px] rounded-xl text-sm',
  lg: 'w-20 h-[116px] sm:w-22 sm:h-[126px] rounded-xl text-base',
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  faceDown = false,
  size = 'md',
  dimmed = false,
  highlighted = false,
  delayMs = 0,
}) => {
  const sizeCls = SIZE_CLASSES[size];

  if (faceDown || !card) {
    return (
      <div
        style={{ animationDelay: `${delayMs}ms` }}
        className={`animate-card-deal relative select-none border border-amber-400/50 bg-[#145C3A] shadow-md overflow-hidden flex items-center justify-center ${sizeCls} ${
          dimmed ? 'opacity-40 grayscale' : ''
        }`}
        aria-label="Face-down playing card"
      >
        <div
          className="absolute inset-1 rounded-[inherit] border border-amber-300/35"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(251,191,36,0.12) 0px, rgba(251,191,36,0.12) 2px, transparent 2px, transparent 6px)',
          }}
        />
        <div className="w-3.5 h-3.5 rotate-45 border border-amber-300/70 bg-amber-400/20" />
      </div>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const symbol = SUIT_SYMBOLS[card.suit];
  const rankStr = formatRank(card.rank);
  const colorCls = isRed ? 'text-red-600' : 'text-slate-900';

  return (
    <div
      style={{ animationDelay: `${delayMs}ms` }}
      className={`animate-card-deal relative select-none bg-white border ${
        highlighted
          ? 'border-amber-400 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/20'
          : 'border-slate-200 shadow-md'
      } ${sizeCls} ${dimmed ? 'opacity-45 grayscale' : ''} flex flex-col justify-between p-1.5`}
      aria-label={`${rankStr} of ${card.suit}`}
    >
      <div className={`leading-none font-bold flex flex-col items-center self-start ${colorCls}`}>
        <span>{rankStr}</span>
        <span className="text-[0.8em] leading-none">{symbol}</span>
      </div>

      <div
        className={`self-center leading-none ${
          size === 'xs'
            ? 'text-base'
            : size === 'sm'
              ? 'text-xl'
              : size === 'md'
                ? 'text-2xl'
                : 'text-3xl'
        } ${colorCls}`}
      >
        {symbol}
      </div>

      <div
        className={`leading-none font-bold flex flex-col items-center self-end rotate-180 ${colorCls}`}
      >
        <span>{rankStr}</span>
        <span className="text-[0.8em] leading-none">{symbol}</span>
      </div>
    </div>
  );
};
