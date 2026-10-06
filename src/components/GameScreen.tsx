import { useEffect, useRef, useState } from 'react';
import { Game, type Snapshot, type WinStats } from '../game/engine';
import { LEVELS } from '../game/levels';
import { sfx } from '../game/audio';

interface Props {
  levelIdx: number;
  onExit: () => void;
  onComplete: (idx: number, s: WinStats) => void;
  onNext: () => void;
  hasNext: boolean;
}

const EMPTY_HUD: Snapshot = {
  mode: 'play', paused: false, attempts: 1, drafts: 0,
  drops: 0, dropsTotal: 0, t: 0, muted: false,
};

export function GameScreen({ levelIdx, onExit, onComplete, onNext, hasNext }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<Snapshot>(EMPTY_HUD);
  const [won, setWon] = useState<WinStats | null>(null);
  const [hint, setHint] = useState(true);
  const [nonce, setNonce] = useState(0);
  const level = LEVELS[levelIdx];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    sfx.muted = (() => {
      try { return localStorage.getItem('dl.muted') === '1'; } catch { return false; }
    })();
    const g = new Game(canvas, LEVELS[levelIdx], {
      onWin: (s) => {
        setWon(s);
        onComplete(levelIdx, s);
      },
      onPauseChange: (p) => setHud((h) => ({ ...h, paused: p })),
      onAnyKey: () => setHint(false),
    });
    g.start();
    gameRef.current = g;
    const iv = window.setInterval(() => setHud(g.snapshot()), 90);
    return () => {
      window.clearInterval(iv);
      g.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelIdx, nonce]);

  const restart = () => {
    setWon(null);
    setHint(false);
    setNonce((n) => n + 1);
  };

  const resume = () => gameRef.current?.togglePause();
  const fmt = (t: number) => t.toFixed(1);

  return (
    <div className="screen game-screen">
      {/* 顶部 HUD */}
      <div className="hud">
        <div className="hud-left">
          <span className="chip chip-red">第 {hud.attempts} 稿</span>
          <span className="chip">旧稿 × {hud.drafts}</span>
          <span className="chip">墨滴 {hud.drops}/{hud.dropsTotal}</span>
        </div>
        <div className="hud-mid">{level.id}. {level.name}</div>
        <div className="hud-right">
          <span className="chip">{fmt(hud.t)}s</span>
          <span className="chip">M 音效{hud.muted ? '关' : '开'}</span>
          <span className="chip">Esc 暂停</span>
        </div>
      </div>

      {/* 画布 */}
      <div className="canvas-wrap">
        <canvas ref={canvasRef} className="game-canvas" />
        {/* 环形键位速记 */}
        <div className="key-tips">A/D 移动 · 空格 跳 · R 牺牲本轮 · C 重画本关</div>

        {/* 关卡提示 */}
        {hint && (
          <div className="overlay" onClick={() => setHint(false)}>
            <div className="overlay-card">
              <div className="ov-badge">第 {level.id} 页</div>
              <h3>{level.name}</h3>
              <p>{level.hint}</p>
              <button className="btn btn-primary" onClick={() => setHint(false)}>开始涂鸦</button>
            </div>
          </div>
        )}

        {/* 暂停 */}
        {hud.paused && !won && (
          <div className="overlay">
            <div className="overlay-card">
              <h3>暂 停</h3>
              <p>笔尖悬在纸上。旧稿们正安静地等你回来。</p>
              <div className="btn-col">
                <button className="btn btn-primary" onClick={resume}>继续（Esc）</button>
                <button className="btn" onClick={restart}>重画本关（清空旧稿）</button>
                <button className="btn" onClick={onExit}>返回目录</button>
              </div>
            </div>
          </div>
        )}

        {/* 通关结算 */}
        {won && (
          <div className="overlay">
            <div className="overlay-card win-card">
              <div className="ov-badge ov-badge-green">完成稿</div>
              <h3>这一页，画好了</h3>
              <div className="stat-grid">
                <div><i>用稿</i><b>{won.attempts} 张</b></div>
                <div><i>留下的旧稿</i><b>{won.drafts} 份</b></div>
                <div><i>墨滴</i><b>{won.drops}/{won.dropsTotal}</b></div>
                <div><i>用时</i><b>{won.time.toFixed(1)}s</b></div>
              </div>
              <div className="btn-col">
                {hasNext && <button className="btn btn-primary" onClick={onNext}>翻到下一页 →</button>}
                <button className="btn" onClick={restart}>再画一次</button>
                <button className="btn" onClick={onExit}>返回目录</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
