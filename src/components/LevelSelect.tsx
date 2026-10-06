import { LEVELS } from '../game/levels';
import type { Progress } from '../progress';

interface Props {
  progress: Progress;
  onPick: (idx: number) => void;
  onBack: () => void;
}

export function LevelSelect({ progress, onPick, onBack }: Props) {
  return (
    <div className="screen select-screen">
      <div className="select-card">
        <div className="select-head">
          <h2>目 录</h2>
          <button className="btn btn-small" onClick={onBack}>← 封面</button>
        </div>
        <div className="level-grid">
          {LEVELS.map((lv, i) => {
            const locked = i + 1 > progress.unlocked;
            const best = progress.best[i];
            return (
              <button
                key={lv.id}
                className={`level-card${locked ? ' locked' : ''}`}
                disabled={locked}
                onClick={() => onPick(i)}
              >
                <span className="lv-no">第 {lv.id} 页</span>
                <span className="lv-name">{locked ? '未解锁' : lv.name}</span>
                {!locked && best && (
                  <span className="lv-best">
                    最少 {best.attempts} 稿 · 墨滴 {best.drops}/{LEVELS[i].drops.length}
                  </span>
                )}
                {!locked && !best && <span className="lv-best">未通关</span>}
                {locked && <span className="lv-best">先通过前一页</span>}
              </button>
            );
          })}
        </div>
        <p className="select-tip">通关一页即解锁下一页；墨滴是全收集的荣耀挑战。</p>
      </div>
    </div>
  );
}
