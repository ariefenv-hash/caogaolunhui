// ===== 进度存档（localStorage）=====
import type { BestRecord } from './game/types';
import { LEVELS } from './game/levels';

export interface Progress {
  unlocked: number; // 已解锁的关卡数（1-based）
  best: Record<number, BestRecord>;
  muted: boolean;
}

const KEY = 'draft-loop-v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      return {
        unlocked: Math.max(1, Math.min(LEVELS.length, p.unlocked ?? 1)),
        best: p.best ?? {},
        muted: p.muted ?? false,
      };
    }
  } catch { /* 损坏则重置 */ }
  return { unlocked: 1, best: {}, muted: false };
}

export function saveProgress(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* noop */ }
}
