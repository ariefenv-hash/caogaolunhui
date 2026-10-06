import { useEffect, useRef } from 'react';
import { drawStickman } from '../game/stickman';

/** 主菜单的迷你动画：火柴人不断奔跑→化作旧稿，预演核心机制 */
function MiniStage() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const W = 560, Hh = 170;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = Hh * dpr;

    const GHOST = ['#4a72d0', '#cf6f5a', '#4f9e63', '#9a68cc'];
    const deaths: number[] = [];
    let t = 0;
    let raf = 0;
    let last = performance.now();

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      t += dt;
      const CYCLE = 2.4;
      const k = t % CYCLE;
      if (k < dt * 1.5 && t > CYCLE) {
        deaths.push(30 + 430);
        if (deaths.length > 3) deaths.shift();
      }
      const x = 30 + Math.min(1, k / 2.0) * 430;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, Hh);
      // 迷你方格纸
      ctx.strokeStyle = 'rgba(96,140,170,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = 0; gx < W; gx += 24) { ctx.moveTo(gx, 0); ctx.lineTo(gx, Hh); }
      for (let gy = 0; gy < Hh; gy += 24) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(60,60,70,0.6)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, 140);
      ctx.lineTo(W, 140);
      ctx.stroke();

      deaths.forEach((dx, i) => {
        ctx.save();
        ctx.globalAlpha = 0.45;
        drawStickman(ctx, {
          x: dx, y: 140, facing: 1, state: 'fall', animT: ts / 1000 + i, squash: 0,
        }, { color: GHOST[(deaths.length - 1 - i) % GHOST.length], alpha: 0.4, lw: 2.4 });
        ctx.restore();
      });

      if (k < 2.05) {
        drawStickman(ctx, {
          x, y: 140, facing: 1, state: 'run', animT: ts / 1000, squash: 0,
        }, { color: '#2f2f38', alpha: 1, lw: 3.2 });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="mini-stage" aria-hidden="true" />;
}

interface Props {
  onStart: () => void;
  onSelect: () => void;
  continueLabel: string;
}

export function MenuScreen({ onStart, onSelect, continueLabel }: Props) {
  return (
    <div className="screen menu-screen">
      <div className="menu-card">
        <div className="menu-seal">百稿通关</div>
        <h1 className="menu-title">草稿轮回</h1>
        <p className="menu-sub">Draft Loop · 一本会记住你每次死亡的草稿纸</p>
        <MiniStage />
        <p className="menu-desc">
          你是草稿纸上的火柴人。每次倒下，这一轮的奔跑都会留下一份
          <b>「旧稿」</b>，原样重演你的一生；消散后化作<b>永久的划痕</b>替你踩住机关。
          死亡不是失败——是草稿。
        </p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={onStart}>{continueLabel}</button>
          <button className="btn" onClick={onSelect}>挑选页面</button>
        </div>
        <div className="menu-keys">
          <span>A / D 移动</span><span>空格 / W 跳跃</span><span>R 牺牲本轮</span>
          <span>C 重画本关</span><span>Esc 暂停</span><span>M 音效</span>
        </div>
      </div>
    </div>
  );
}
