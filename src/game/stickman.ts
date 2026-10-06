// ===== 程序化火柴人渲染 =====
// 所有姿势均由数学实时计算：跑动摆臂、跳跃蜷腿、下落挥臂、待机呼吸

export interface StickPose {
  x: number;       // 脚底中心 x
  y: number;       // 脚底中心 y
  facing: number;  // 1 / -1
  state: 'idle' | 'run' | 'jump' | 'fall';
  animT: number;
  squash: number;  // 挤压拉伸系数（落地 >0，起跳 <0）
}

export interface StickStyle {
  color: string;
  alpha: number;
  lw: number;      // 线宽
  jitter?: number; // 手绘抖动幅度（旧稿用）
  seed?: number;
}

interface P { x: number; y: number }

export function drawStickman(ctx: CanvasRenderingContext2D, p: StickPose, s: StickStyle) {
  const j = s.jitter ?? 0;
  const sd = (s.seed ?? 1) * 7.31;
  const nz = (k: number) => j * Math.sin(p.animT * 13 + sd * (k + 1) * 1.73);
  const pt = (x: number, y: number, k: number): P => ({ x: x + nz(k), y: y + nz(k + 3) });

  const cx = p.x, cy = p.y;
  ctx.save();
  ctx.globalAlpha = s.alpha;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 挤压拉伸（绕脚底）
  const sq = p.squash;
  ctx.translate(cx, cy);
  ctx.scale(1 - sq * 0.22, 1 + sq * 0.3);
  ctx.translate(-cx, -cy);

  const headR = 7.2;
  const bob = p.state === 'idle' ? Math.sin(p.animT * 2.2) * 0.9 : 0;
  const hipX = cx, hipY = cy - 20 + bob * 0.4;
  const shX = cx, shY = cy - 35 + bob;
  const headX = cx + p.facing * 1.4 + nz(9) * 0.4;
  const headY = cy - 43.5 + bob;

  let f1: P, f2: P, h1: P, h2: P;
  if (p.state === 'run') {
    const ph = p.animT * 11.5;
    const sw = Math.sin(ph);
    f1 = pt(cx - 4.5 + sw * 7.5, cy - Math.max(0, sw) * 6.5, 0);
    f2 = pt(cx + 4.5 - sw * 7.5, cy - Math.max(0, -sw) * 6.5, 6);
    h1 = pt(shX - 7 - sw * 6.5, shY + 11, 12);
    h2 = pt(shX + 7 + sw * 6.5, shY + 11, 15);
  } else if (p.state === 'jump') {
    f1 = pt(cx - 6, cy - 13, 0);
    f2 = pt(cx + 7.5, cy - 7, 6);
    h1 = pt(shX - 9, shY - 7, 12);
    h2 = pt(shX + 9.5, shY - 9, 15);
  } else if (p.state === 'fall') {
    const w = Math.sin(p.animT * 16) * 2.5;
    f1 = pt(cx - 7, cy - 2, 0);
    f2 = pt(cx + 7, cy - 5.5, 6);
    h1 = pt(shX - 10, shY - 9 + w, 12);
    h2 = pt(shX + 10, shY - 8 - w, 15);
  } else {
    f1 = pt(cx - 5, cy, 0);
    f2 = pt(cx + 5, cy, 6);
    h1 = pt(shX - 6.5, shY + 12.5, 12);
    h2 = pt(shX + 6.5, shY + 12.5, 15);
  }

  const limb = (a: P, b: P, c: P) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
    ctx.stroke();
  };

  // 腿（膝盖略向前）
  const legBend = p.facing * 2.4;
  limb(pt(hipX, hipY, 18), pt((hipX + f1.x) / 2 + legBend, (hipY + f1.y) / 2 + 1.5, 20), f1);
  limb(pt(hipX, hipY, 18), pt((hipX + f2.x) / 2 + legBend, (hipY + f2.y) / 2 + 1.5, 23), f2);
  // 脊柱
  const spineA = pt(shX, shY, 26), spineB = pt(hipX, hipY, 18);
  ctx.beginPath();
  ctx.moveTo(spineA.x, spineA.y);
  ctx.lineTo(spineB.x, spineB.y);
  ctx.stroke();
  // 手臂（肘部略向后）
  const armBend = -p.facing * 2.2;
  limb(pt(shX, shY, 26), pt((shX + h1.x) / 2 + armBend, (shY + h1.y) / 2 + 2.5, 28), h1);
  limb(pt(shX, shY, 26), pt((shX + h2.x) / 2 + armBend, (shY + h2.y) / 2 + 2.5, 30), h2);
  // 头
  const hc = pt(headX, headY, 33);
  ctx.beginPath();
  ctx.arc(hc.x, hc.y, headR, 0, Math.PI * 2);
  ctx.stroke();
  // 眼睛（两只小点，朝向移动方向）
  const ex = hc.x + p.facing * 2.6;
  ctx.beginPath();
  ctx.arc(ex - 1.8, hc.y - 1.2, 0.95, 0, Math.PI * 2);
  ctx.arc(ex + 1.8, hc.y - 1.2, 0.95, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** 旧稿遗骸：躺在地上的小火柴人 + 粗糙的划掉叉痕 */
export function drawRemnant(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, t: number) {
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 蜷躺的身体
  ctx.beginPath();
  ctx.arc(x - 10, y - 5.5, 5.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 4.5, y - 4);
  ctx.quadraticCurveTo(x + 3, y - 9, x + 10, y - 5);
  ctx.stroke();
  // 伸开的手腿
  ctx.beginPath();
  ctx.moveTo(x - 4.5, y - 4);
  ctx.lineTo(x - 13, y - 1);
  ctx.moveTo(x + 10, y - 5);
  ctx.lineTo(x + 15, y - 2);
  ctx.moveTo(x + 2, y - 7);
  ctx.lineTo(x + 4, y - 13);
  ctx.stroke();
  // ×× 眼
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x - 12.5, y - 7.5);
  ctx.lineTo(x - 9.5, y - 4.5);
  ctx.moveTo(x - 9.5, y - 7.5);
  ctx.lineTo(x - 12.5, y - 4.5);
  ctx.stroke();

  // 划掉的叉痕（随时间轻微呼吸）
  const w = 1 + Math.sin(t * 2.2) * 0.05;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 2.6;
  ctx.save();
  ctx.translate(x, y - 8);
  ctx.scale(w, w);
  ctx.beginPath();
  ctx.moveTo(-17, -9);
  ctx.quadraticCurveTo(-2, -2, 17, 7);
  ctx.moveTo(16, -10);
  ctx.quadraticCurveTo(0, -4, -16, 8);
  ctx.moveTo(-8, -12);
  ctx.quadraticCurveTo(4, -6, 14, 2);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}
