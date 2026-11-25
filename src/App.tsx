import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { GameMode, LobbyScreen } from './components/LobbyScreen';
import { GameTable } from './components/GameTable';
import { RulesModal } from './components/RulesModal';
import { soundFX } from './utils/sound';

const STORAGE_KEY_GEMS = 'teen_prati_gems_v1';
const DEFAULT_GEMS = 1000;

export default function App() {
  const [gems, setGems] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GEMS);
      if (saved !== null) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed >= 0) return parsed;
      }
    } catch {
      // Ignore storage read errors
    }
    return DEFAULT_GEMS;
  });

  const [mode, setMode] = useState<GameMode>('bots');
  const [bootAmount, setBootAmount] = useState<number>(10);
  const [activeTablePlayers, setActiveTablePlayers] = useState<3 | 4 | 5 | 7 | null>(
    null
  );
  const [rulesOpen, setRulesOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_GEMS, String(gems));
    } catch {
      // Ignore storage write errors
    }
  }, [gems]);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundFX.setMuted(next);
  };

  const handleRefillGems = () => {
    soundFX.playChip();
    setGems((prev) => prev + 1000);
  };

  return (
    <div className="min-h-screen bg-[#09291E] text-white flex flex-col">
      {/* Top Bar */}
      <header className="h-16 bg-[#145C3A] border-b border-amber-400/20 px-4 sm:px-8 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => setActiveTablePlayers(null)}
          className="font-display text-lg sm:text-xl font-bold tracking-wide text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Teen Prati Only
        </button>

        <nav className="flex items-center gap-5 sm:gap-7 text-sm font-medium text-white/85">
          <button
            type="button"
            onClick={() => setActiveTablePlayers(null)}
            className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Lobby
          </button>
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Hand Rankings
          </button>
          <button
            type="button"
            onClick={handleToggleMute}
            className="inline-flex items-center gap-1.5 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{muted ? 'Muted' : 'Sound'}</span>
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              if (gems < 200) handleRefillGems();
              else setRulesOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-[#09291E] hover:bg-[#0D3527] border border-amber-400/40 text-xs sm:text-sm font-semibold font-mono-nums text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {gems < 200 ? '+1,000 Free Gems' : `${gems.toLocaleString()} Gems`}
          </button>
        </div>
      </header>

      {activeTablePlayers === null ? (
        <LobbyScreen
          gems={gems}
          mode={mode}
          onModeChange={setMode}
          bootAmount={bootAmount}
          onBootChange={setBootAmount}
          onStartGame={(count) => setActiveTablePlayers(count)}
          onRefillGems={handleRefillGems}
        />
      ) : (
        <GameTable
          key={`${activeTablePlayers}-${mode}-${bootAmount}`}
          playerCount={activeTablePlayers}
          mode={mode}
          bootAmount={bootAmount}
          initialUserGems={gems}
          onSyncUserGems={setGems}
          onExitToLobby={() => setActiveTablePlayers(null)}
        />
      )}

      <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
