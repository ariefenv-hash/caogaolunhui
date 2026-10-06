// ===== 手绘方格纸风格的世界渲染 =====
import { W, H, INK, RED } from './constants';
import type { Rect, SawDef, LaserDef, PlateDef, DoorDef, SpringDef, Vec } from './types';

/** 预渲染一张方格纸背景（离屏画布，只画一次） */
export function makePaper(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;

  // 纸底色
  g.fillStyle = '#fbf7ec';
  g.fillRect(0, 0, W, H);

  // 纸张噪点
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  g.fillStyle = 'rgba(150,140,110,0.05)';
  for (let i = 0; i < 260; i++) {
    g.fillRect(rnd() * W, rnd() * H, 1.6, 1.6);
  }

  // 方格
  g.strokeStyle = 'rgba(96,140,170,0.17)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 32; x < W; x += 32) { g.moveTo(x, 0); g.lineTo(x, H); }
  for (let y = 32; y < H; y += 32) { g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();

  // 左侧红色页边线
  g.strokeStyle = 'rgba(217,88,88,0.35)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(76, 0);
  g.lineTo(76, H);
  g.stroke();

  // 装订孔
  for (const y of [130, 360, 590]) {
    g.fillStyle = '#e9e2d0';
    g.beginPath();
    g.arc(38, y, 11, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(90,80,60,0.35)';
    g.lineWidth = 1.4;
    g.stroke();
  }

  // 角落手写小字
  g.font = '15px "ZCOOL KuaiLe", "Kaiti SC", "KaiTi", "STKaiti", serif';
  g.fillStyle = 'rgba(80,80,95,0.28)';
  g.fillText('草稿纸 No.1 · Draft Loop', 96, 44);

  return c;
}

/** 手绘风固体平台：纸块 + 抖动双线描边 + 顶部投影线 */
export function drawSolids(ctx: CanvasRenderingContext2D, solids: Rect[]) {
  ctx.save();
  for (const s of solids) {
    // 纸块填充
    ctx.fillStyle = '#ece4cf';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    // 内部斜纹
    ctx.save();
    ctx.beginPath();
    ctx.rect(s.x, s.y, s.w, s.h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(47,47,56,0.07)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let d = -s.h; d < s.w; d += 14) {
      ctx.moveTo(s.x + d, s.y + s.h);
      ctx.lineTo(s.x + d + s.h, s.y);
    }
    ctx.stroke();
    ctx.restore();
    // 抖动描边（手绘感：两段微偏移的线）
    const wob = (x: number, y: number, k: number) =>
      Math.sin(x * 0.045 + y * 0.031 + k * 2.7) * 1.3;
    ctx.strokeStyle = 'rgba(47,47,56,0.92)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x + wob(s.x, s.y, 1), s.y + wob(s.y, s.x, 2));
    ctx.lineTo(s.x + s.w + wob(s.x + s.w, s.y, 3), s.y + wob(s.y + s.w, s.x, 4));
    ctx.moveTo(s.x + s.w, s.y);
    ctx.lineTo(s.x + s.w, s.y + s.h);
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x, s.y + s.h);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(47,47,56,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + s.h);
    ctx.lineTo(s.x + s.w, s.y + s.h);
    ctx.stroke();
    // 顶部表面高光线
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(s.x + 2, s.y + 2.4);
    ctx.lineTo(s.x + s.w - 2, s.y + 2.4);
    ctx.stroke();
  }
  ctx.restore();
}

/** 机关踏板与门的彩色虚线连接 */
export function drawLinks(
  ctx: CanvasRenderingContext2D,
  plates: PlateDef[],
  doors: DoorDef[],
  colors: Record<string, string>,
) {
  ctx.save();
  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 1.6;
  for (const pl of plates) {
    for (const d of doors) {
      if (pl.group !== d.group) continue;
      ctx.strokeStyle = colors[pl.group] ?? INK;
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.moveTo(pl.x + pl.w / 2, pl.y - 6);
      ctx.lineTo(d.x + d.w / 2, d.y + d.h / 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawDoor(ctx: CanvasRenderingContext2D, d: DoorDef, open01: number, color: string) {
  ctx.save();
  // 顶部滑槽
  ctx.fillStyle = 'rgba(60,60,70,0.55)';
  ctx.fillRect(d.x - 4, d.y - 10, d.w + 8, 9);
  // 门框
  ctx.strokeStyle = 'rgba(60,60,70,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(d.x - 4, d.y - 10, d.w + 8, d.h + 12);

  const ph = d.h * (1 - open01);
  if (ph > 2) {
    // 门板（上滑，底部让出通道）
    ctx.fillStyle = '#efe9da';
    ctx.fillRect(d.x, d.y, d.w, ph);
    // 斜纹填充
    ctx.save();
    ctx.beginPath();
    ctx.rect(d.x, d.y, d.w, ph);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let yy = -d.w; yy < ph + d.h; yy += 11) {
      ctx.moveTo(d.x - 2, d.y + yy);
      ctx.lineTo(d.x + d.w + 2, d.y + yy - d.w - 8);
    }
    ctx.stroke();
    ctx.restore();
    // 门板边框 + 锁点
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    ctx.strokeRect(d.x, d.y, d.w, ph);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(d.x + d.w / 2, d.y + Math.min(ph / 2, 26), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPlate(ctx: CanvasRenderingContext2D, pl: PlateDef, pressed: boolean, color: string) {
  ctx.save();
  const y = pl.y + (pressed ? 4 : 0);
  // 底座支架
  ctx.strokeStyle = 'rgba(60,60,70,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pl.x + 4, pl.y + 12);
  ctx.lineTo(pl.x + 4, pl.y + 6);
  ctx.moveTo(pl.x + pl.w - 4, pl.y + 12);
  ctx.lineTo(pl.x + pl.w - 4, pl.y + 6);
  ctx.stroke();
  // 踏板面
  if (pressed) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.roundRect(pl.x - 4, y - 5, pl.w + 8, 16, 5);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#f4efe2';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.roundRect(pl.x, y, pl.w, 7, 3);
  ctx.fill();
  ctx.stroke();
  // 未踩下时的小箭头提示
  if (!pressed) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = color;
    const cx = pl.x + pl.w / 2;
    ctx.beginPath();
    ctx.moveTo(cx, pl.y - 14);
    ctx.lineTo(cx - 5, pl.y - 6);
    ctx.lineTo(cx + 5, pl.y - 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawSpring(ctx: CanvasRenderingContext2D, sp: SpringDef, c01: number) {
  ctx.save();
  const baseY = sp.y + 14;
  const topY = sp.y + 4 + c01 * 8;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  // 弹簧圈
  ctx.beginPath();
  const n = 4;
  for (let i = 0; i <= n; i++) {
    const yy = baseY - ((baseY - topY) * i) / n;
    const xx = i % 2 === 0 ? sp.x + 6 : sp.x + sp.w - 6;
    if (i === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  }
  ctx.stroke();
  // 顶板
  ctx.fillStyle = '#f4efe2';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.roundRect(sp.x - 4, topY - 5, sp.w + 8, 7, 3);
  ctx.fill();
  ctx.stroke();
  // 底座
  ctx.fillStyle = 'rgba(60,60,70,0.7)';
  ctx.fillRect(sp.x - 2, baseY - 2, sp.w + 4, 5);
  ctx.restore();
}

export function drawSpikeStrip(ctx: CanvasRenderingContext2D, s: Rect) {
  ctx.save();
  const n = Math.max(2, Math.floor(s.w / 15));
  const step = s.w / n;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y + s.h);
  for (let i = 0; i < n; i++) {
    ctx.lineTo(s.x + step * i + step / 2, s.y);
    ctx.lineTo(s.x + step * (i + 1), s.y + s.h);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(210,80,70,0.13)';
  ctx.fill();
  ctx.strokeStyle = RED;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

export function drawSawPath(ctx: CanvasRenderingContext2D, sw: SawDef) {
  ctx.save();
  ctx.strokeStyle = RED;
  ctx.globalAlpha = 0.16;
  ctx.setLineDash([5, 7]);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(sw.x1, sw.y1);
  ctx.lineTo(sw.x2, sw.y2);
  ctx.stroke();
  ctx.restore();
}

export function drawSaw(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // 齿
  ctx.fillStyle = '#f3ede0';
  ctx.strokeStyle = RED;
  ctx.lineWidth = 2;
  const teeth = 10;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
    const a2 = ((i + 1) / teeth) * Math.PI * 2;
    ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    ctx.lineTo(Math.cos(a1) * (r + 7), Math.sin(a1) * (r + 7));
    ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 中心
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawLaser(ctx: CanvasRenderingContext2D, lz: LaserDef, state: 'on' | 'warn' | 'off', t: number) {
  const { x, y, len, orient } = lz;
  const x2 = orient === 'v' ? x : x + len;
  const y2 = orient === 'v' ? y + len : y;
  ctx.save();
  // 两端发射器
  ctx.fillStyle = INK;
  ctx.fillRect(x - 6, y - 7, 12, 12);
  ctx.fillRect(x2 - 6, y2 - 5, 12, 12);
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(x, y, 2.6, 0, Math.PI * 2);
  ctx.arc(x2, y2, 2.6, 0, Math.PI * 2);
  ctx.fill();

  if (state === 'on') {
    ctx.strokeStyle = RED;
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalAlpha = 0.92;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.globalAlpha = 0.5 + Math.sin(t * 60) * 0.2;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (state === 'warn') {
    ctx.strokeStyle = RED;
    ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 42);
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPortal(ctx: CanvasRenderingContext2D, portal: Rect, t: number) {
  const cx = portal.x + portal.w / 2;
  const cy = portal.y + portal.h / 2;
  ctx.save();
  // 微光底
  ctx.fillStyle = 'rgba(47,47,56,0.05)';
  ctx.beginPath();
  ctx.arc(cx, cy, 38, 0, Math.PI * 2);
  ctx.fill();
  // 螺旋
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const turns = 4.4 * Math.PI;
  for (let a = 0; a < turns; a += 0.12) {
    const r = 2 + (a / turns) * 26;
    const ang = a + t * 1.6;
    const px = cx + Math.cos(ang) * r;
    const py = cy + Math.sin(ang) * r * 1.35;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // 环绕小点
  ctx.fillStyle = INK;
  for (let i = 0; i < 3; i++) {
    const ang = t * 2 + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * 32, cy + Math.sin(ang) * 40, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // 标签
  ctx.font = '15px "ZCOOL KuaiLe", "Kaiti SC", "KaiTi", "STKaiti", serif';
  ctx.fillStyle = 'rgba(47,47,56,0.55)';
  ctx.textAlign = 'center';
  ctx.fillText('出 口', cx, portal.y - 10);
  ctx.restore();
}

export function drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const bob = Math.sin(t * 2.6) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = '#33507e';
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  // 水滴形
  ctx.moveTo(0, -13);
  ctx.bezierCurveTo(9, -2, 8.5, 6, 0, 8.5);
  ctx.bezierCurveTo(-8.5, 6, -9, -2, 0, -13);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(-2.6, 1.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 重生印章：第 N 稿 */
export function drawStamp(ctx: CanvasRenderingContext2D, text: string, t: number) {
  // t 从 1.1 递减到 0
  let alpha = 1;
  let scale = 1;
  if (t > 0.9) { alpha = (1.1 - t) / 0.2; scale = 1 + (t - 0.9) * 3; }
  else if (t < 0.25) { alpha = t / 0.25; }
  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  ctx.translate(W / 2, H * 0.4);
  ctx.rotate(-0.08);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#c23b34';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(-150, -52, 300, 104, 10);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(-141, -44, 282, 88, 8);
  ctx.stroke();
  ctx.fillStyle = '#c23b34';
  ctx.font = '46px "ZCOOL KuaiLe", "Kaiti SC", "KaiTi", "STKaiti", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 2);
  ctx.restore();
}
