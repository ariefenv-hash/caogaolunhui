import { useCallback, useState } from 'react';
import { MenuScreen } from './components/MenuScreen';
import { LevelSelect } from './components/LevelSelect';
import { GameScreen } from './components/GameScreen';
import { LEVELS } from './game/levels';
import { loadProgress, saveProgress, type Progress } from './progress';
import type { WinStats } from './game/engine';

type Screen = { k: 'menu' } | { k: 'select' } | { k: 'game'; level: number };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ k: 'menu' });
  const [prog, setProg] = useState<Progress>(loadProgress);

  const updateProg = useCallback((p: Progress) => {
    setProg(p);
    saveProgress(p);
  }, []);

  const handleComplete = useCallback((idx: number, s: WinStats) => {
    setProg((prev) => {
      const best = prev.best[idx];
      const next: Progress = {
        unlocked: Math.max(prev.unlocked, Math.min(LEVELS.length, idx + 2)),
        best: {
          ...prev.best,
          [idx]: {
            attempts: best ? Math.min(best.attempts, s.attempts) : s.attempts,
            drops: Math.max(best?.drops ?? 0, s.drops),
            time: best ? Math.min(best.time, s.time) : s.time,
          },
        },
        muted: prev.muted,
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const startIdx = Math.min(prog.unlocked - 1, LEVELS.length - 1);
  const continueLabel =
    prog.unlocked <= 1 ? '翻开本子' : `继续 · 第 ${startIdx + 1} 页`;

  if (screen.k === 'menu') {
    return (
      <MenuScreen
        continueLabel={continueLabel}
        onStart={() => setScreen({ k: 'game', level: startIdx })}
        onSelect={() => setScreen({ k: 'select' })}
      />
    );
  }

  if (screen.k === 'select') {
    return (
      <LevelSelect
        progress={prog}
        onPick={(i) => setScreen({ k: 'game', level: i })}
        onBack={() => setScreen({ k: 'menu' })}
      />
    );
  }

  return (
    <GameScreen
      key={screen.level}
      levelIdx={screen.level}
      hasNext={screen.level + 1 < LEVELS.length}
      onExit={() => setScreen({ k: 'select' })}
      onNext={() => setScreen({ k: 'game', level: Math.min(screen.level + 1, LEVELS.length - 1) })}
      onComplete={handleComplete}
    />
  );
}
