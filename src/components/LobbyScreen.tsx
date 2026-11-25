import React from 'react';
import { Layers, Users, Bot, PlusCircle } from 'lucide-react';

export type GameMode = 'bots' | 'friends';

interface LobbyScreenProps {
  gems: number;
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  bootAmount: number;
  onBootChange: (boot: number) => void;
  onStartGame: (playerCount: 3 | 4 | 5 | 7) => void;
  onRefillGems: () => void;
}

const PLAYER_COUNTS: Array<3 | 4 | 5 | 7> = [3, 4, 5, 7];
const BOOT_OPTIONS = [10, 25, 50];

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  gems,
  mode,
  onModeChange,
  bootAmount,
  onBootChange,
  onStartGame,
  onRefillGems,
}) => {
  return (
    <main className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-[#145C3A] border border-amber-400/35 flex items-center justify-center shadow-lg mb-5">
          <Layers className="w-11 h-11 text-amber-400" strokeWidth={1.75} />
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-bold text-amber-400 tracking-wide text-balance">
          WELCOME TO TEEN PRATI
        </h1>

        <div className="mt-3 flex items-center justify-center gap-3 text-base text-white/90">
          <span>
            Your Gems:{' '}
            <strong className="font-mono-nums text-amber-300 font-semibold">
              {gems.toLocaleString()}
            </strong>
          </span>
          {gems < 200 && (
            <button
              type="button"
              onClick={onRefillGems}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#145C3A] hover:bg-[#197047] border border-amber-400/40 text-xs font-semibold text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Claim +1,000 Free Gems
            </button>
          )}
        </div>

        {/* Table Mode & Boot Controls */}
        <div className="mt-7 w-full max-w-md space-y-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/65">Table Mode</span>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#061D15] border border-white/10">
              <button
                type="button"
                onClick={() => onModeChange('bots')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'bots'
                    ? 'bg-[#145C3A] text-amber-300 shadow-sm border border-amber-400/30'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <Bot className="w-4 h-4 shrink-0" />
                Solo vs Table Bots
              </button>
              <button
                type="button"
                onClick={() => onModeChange('friends')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'friends'
                    ? 'bg-[#145C3A] text-amber-300 shadow-sm border border-amber-400/30'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                Pass &amp; Play Friends
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/65">Table Boot (Opening Stake)</span>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#061D15] border border-white/10">
              {BOOT_OPTIONS.map((boot) => (
                <button
                  key={boot}
                  type="button"
                  onClick={() => onBootChange(boot)}
                  className={`py-2 px-3 rounded-lg text-sm font-semibold font-mono-nums transition-colors whitespace-nowrap cursor-pointer ${
                    bootAmount === boot
                      ? 'bg-[#145C3A] text-amber-300 border border-amber-400/30'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {boot} Gems
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3, 4, 5, 7 Players Game Buttons */}
        <div className="mt-7 w-full max-w-[260px] flex flex-col gap-3">
          {PLAYER_COUNTS.map((count) => {
            const disabled = mode === 'bots' && gems < bootAmount;
            return (
              <button
                key={count}
                type="button"
                disabled={disabled}
                onClick={() => onStartGame(count)}
                className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed text-[#09291E] font-bold text-base shadow-md transition-all whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                {count} Players Game
              </button>
            );
          })}
        </div>

        <p className="mt-7 text-sm text-white/70">
          Play with friends <span aria-hidden="true">·</span> Free Virtual Gems
        </p>
      </div>
    </main>
  );
};
