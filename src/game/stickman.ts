// ===== 程序化火柴人渲染 v2 =====
// 升级：两段式四肢（解析 IK 生成真实膝盖/手肘）+ 步态循环（支撑/摆动相）
//       + 空中姿态由 vy 连续驱动（起跳蹬伸→团身→展臂准备落地，apex 无跳变）
//       + 躯干前倾随速度 + 待机呼吸/重心起伏

export interface StickPose {
  x: number;       // 脚底中心 x
  y: number;       // 脚底中心 y
  facing: number;  // 1 / -1
  state: 'idle' | 'run' | 'jump' | 'fall';
  animT: number;
  squash: number;  // 挤压拉伸系数（落地 >0，起跳 <0）
  vx?: number;     // 水平速度（前倾与步幅用，缺省 0）
  vy?: number;     // 垂直速度（空中姿态连续变形，缺省 0）
}

export interface StickStyle {
  color: string;
  alpha: number;
  lw: number;      // 线宽
  jitter?: number; // 手绘抖动幅度（旧稿用）
  seed?: number;
}

interface P { x: number; y: number }

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lp = (a: P, b: P, k: number): P => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 两骨解析 IK：a=根（髋/肩），b=末端（脚/手），L=单段长度，bend=弯曲方向 ±1 → 返回中间关节 */
function joint2(a: P, b: P, L: number, bend: number): P {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const dc = Math.min(d, L * 2 - 0.6);
  const t = dc / d;
  const mx = a.x + dx * t * 0.5, my = a.y + dy * t * 0.5;
  const h = Math.sqrt(Math.max(0, L * L - (dc * 0.5) ** 2));
  const px = -dy / d, py = dx / d;
  return { x: mx + px * h * bend, y: my + py * h * bend };
}

export function drawStickman(ctx: CanvasRenderingContext2D, p: StickPose, s: StickStyle) {
  const j = s.jitter ?? 0;
  const sd = (s.seed ?? 1) * 7.31;
  const nz = (k: number) => j * Math.sin(p.animT * 13 + sd * (k + 1) * 1.73);
  const pt = (x: number, y: number, k: number): P => ({ x: x + nz(k), y: y + nz(k + 3) });

  const cx = p.x, cy = p.y;
  const F = p.facing;
  const vy = p.vy ?? 0;
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
  let hipY: number, shX: number, shY: number, headX: number, headY: number;

  // 腿长/臂长（单段）：髋高 19、站直时膝微屈
  const LEG = 10.4, ARM = 9.2;
  // 膝盖朝前、手肘朝后的弯曲符号（由朝向镜像）
  const kneeBend = -F, elbowBend = F;

  const limb2 = (root: P, end: P, segLen: number, bend: number, jk: number) => {
    const mid = joint2(root, end, segLen, bend);
    ctx.beginPath();
    ctx.moveTo(root.x, root.y);
    ctx.quadraticCurveTo(mid.x + nz(jk) * 0.5, mid.y + nz(jk + 4) * 0.5, end.x, end.y);
    ctx.stroke();
  };

  const hip: P = { x: cx, y: 0 };       // y 稍后填
  let f1: P, f2: P, h1: P, h2: P;

  if (p.state === 'run') {
    // ---- 步态循环：支撑相（脚贴地后扫）+ 摆动相（屈膝前摆）----
    const speedK = clamp01(Math.abs(p.vx ?? 0) / 272);
    const ph = p.animT * (10.5 + 2.5 * speedK);   // 步频随速度微增
    const stride = 9.5 + 2.5 * speedK;
    const lift = 9.5;
    const swA = Math.cos(ph), swB = Math.cos(ph + Math.PI);
    const liftA = Math.max(0, -Math.sin(ph));
    const liftB = Math.max(0, Math.sin(ph));

    // 身体上下起伏（两倍步频：触地吸收最低、蹬伸最高）
    const bob = -1.8 * Math.cos(2 * ph);
    hipY = cy - 19 + bob * 0.5;
    // 躯干前倾（跑动姿态，随速度略增）
    const lean = 2.1 + 0.9 * speedK;
    shX = cx + F * lean;
    shY = hipY - 14.6;
    headX = shX + F * 1.3;
    headY = shY - 8.3 + bob * 0.22;

    f1 = pt(cx + F * swA * stride, cy - liftA * lift, 0);
    f2 = pt(cx + F * swB * stride, cy - liftB * lift, 6);
    // 摆臂与同侧腿反相，屈肘 90°，手在髋侧前后摆
    h1 = pt(shX + F * (swB * 7.5 + 0.8), shY + 10.8 + 1.6 * Math.cos(2 * ph), 12);
    h2 = pt(shX + F * (swA * 7.5 + 0.8), shY + 10.8 + 1.6 * Math.cos(2 * ph + Math.PI), 15);
  } else if (p.state === 'jump' || p.state === 'fall') {
    // ---- 空中连续姿态：由 vy 驱动，apex 处两侧姿态重合 → 无跳变 ----
    hipY = cy - 19.5;
    shX = cx + F * 0.8;
    shY = hipY - 14.8;
    headX = shX + F * 1.2;
    headY = shY - 8.4;

    // 中性收腿（vy≈0，两种状态在此衔接）
    const nF1: P = { x: cx - F * 5, y: cy - 9 };
    const nF2: P = { x: cx + F * 6, y: cy - 13 };
    const nH1: P = { x: shX - F * 8, y: shY + 6 };
    const nH2: P = { x: shX + F * 8, y: shY - 4 };

    if (vy < 0) {
      // 上升：蹬伸展开 → 收腿团身，接近 apex 时向中性姿态汇合（与下落段连续）
      const k = clamp01(-vy / 780);
      const m = clamp01(k * 1.15 - 0.15) * 0.55;
      const extF1: P = { x: cx - F * 4, y: cy - 3 };
      const extF2: P = { x: cx + F * 7.5, y: cy - 6 };
      const extH1: P = { x: shX - F * 9, y: shY + 11 };
      const extH2: P = { x: shX + F * 7, y: shY + 8.5 };
      const tuckF1: P = { x: cx - F * 7.5, y: cy - 15 };
      const tuckF2: P = { x: cx + F * 6, y: cy - 8 };
      const tuckH1: P = { x: shX - F * 10, y: shY - 3 };
      const tuckH2: P = { x: shX + F * 6.5, y: shY - 9 };
      f1 = lp(lp(extF1, tuckF1, k), nF1, m);
      f2 = lp(lp(extF2, tuckF2, k), nF2, m);
      h1 = lp(lp(extH1, tuckH1, k), nH1, m);
      h2 = lp(lp(extH2, tuckH2, k), nH2, m);
    } else {
      // 下落：中性 → 展臂张腿准备落地（越接近地面越慌）
      const k = clamp01(vy / 950);
      const wob = Math.sin(p.animT * 13) * 2.4 * k;
      const spF1: P = { x: cx - F * 8.5, y: cy - 3 };
      const spF2: P = { x: cx + F * 8, y: cy - 6.5 };
      const spH1: P = { x: shX - F * 11.5, y: shY - 6 + wob };
      const spH2: P = { x: shX + F * 11.5, y: shY - 6 - wob };
      f1 = lp(nF1, spF1, k);
      f2 = lp(nF2, spF2, k);
      h1 = lp(nH1, spH1, k);
      h2 = lp(nH2, spH2, k);
    }
  } else {
    // ---- 待机：呼吸起伏 + 重心微移 + 手臂自然下垂微摆 ----
    const br = Math.sin(p.animT * 2.2);
    const sway = Math.sin(p.animT * 0.9) * 0.7;
    hipY = cy - 19 + br * 0.35;
    shX = cx + sway;
    shY = hipY - 14.7 + br * 0.55;
    headX = shX + F * 1.4;
    headY = shY - 8.5 + br * 0.5;

    f1 = pt(cx - 5.2, cy, 0);
    f2 = pt(cx + 5.2, cy, 6);
    h1 = pt(shX - 6.4, shY + 12.4 + br * 0.3, 12);
    h2 = pt(shX + 6.4, shY + 12.4 - br * 0.3, 15);
  }
  hip.y = hipY;

  // 两段式腿：髋 → 膝（IK，朝前弯）→ 脚
  limb2(hip, f1, LEG, kneeBend, 18);
  limb2(hip, f2, LEG, kneeBend, 21);
  // 脊柱（带前倾）
  const spineA = pt(shX, shY, 26), spineB = pt(cx, hipY, 18);
  ctx.beginPath();
  ctx.moveTo(spineA.x, spineA.y);
  ctx.lineTo(spineB.x, spineB.y);
  ctx.stroke();
  // 两段式臂：肩 → 肘（IK，朝后弯）→ 手
  const shoulder: P = { x: spineA.x, y: spineA.y };
  limb2(shoulder, h1, ARM, elbowBend, 28);
  limb2(shoulder, h2, ARM, elbowBend, 30);
  // 头
  const hc = pt(headX, headY, 33);
  ctx.beginPath();
  ctx.arc(hc.x, hc.y, headR, 0, Math.PI * 2);
  ctx.stroke();
  // 眼睛（两只小点，朝向移动方向）
  const ex = hc.x + F * 2.6;
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
