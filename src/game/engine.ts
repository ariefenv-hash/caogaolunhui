// ===== 游戏引擎 =====
// 核心：60Hz 固定步长物理 + 每帧位置录制 + 回声确定性重放
import {
  W, H, STEP, GRAVITY, MOVE_SPEED, JUMP_V, SPRING_V, MAX_FALL,
  COYOTE_T, JUMP_BUFFER, PLAYER_W, PLAYER_H, INK, GHOST_COLORS, GROUP_COLORS,
} from './constants';
import type { LevelDef, Rect } from './types';
import { Input } from './input';
import { sfx } from './audio';
import { Particles } from './particles';
import { drawStickman, drawRemnant } from './stickman';
import {
  makePaper, drawSolids, drawDoor, drawPlate, drawSaw, drawLaser, drawSpring,
  drawPortal, drawDrop, drawSpikeStrip, drawSawPath, drawLinks, drawStamp,
} from './render';

export interface WinStats {
  attempts: number;
  drafts: number;
  drops: number;
  dropsTotal: number;
  time: number;
}

export interface Snapshot {
  mode: 'play' | 'won';
  paused: boolean;
  attempts: number;
  drafts: number;
  drops: number;
  dropsTotal: number;
  t: number;
  muted: boolean;
}

export interface GameCallbacks {
  onWin: (s: WinStats) => void;
  onPauseChange: (p: boolean) => void;
  onAnyKey: () => void;
}

interface Echo {
  xs: number[]; ys: number[]; st: number[];
  len: number;              // 帧数
  ci: number;               // 颜色索引
  remX: number; remY: number; // 遗骸位置（脚底中心）
}

interface Player {
  x: number; y: number; vx: number; vy: number;
  onGround: boolean; coyote: number; jbuf: number;
  facing: number; animT: number; squash: number;
}

const ST_IDLE = 0, ST_RUN = 1, ST_JUMP = 2, ST_FALL = 3;

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const shrink = (r: Rect, k: number): Rect => ({ x: r.x + k, y: r.y + k, w: r.w - k * 2, h: r.h - k * 2 });

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private level: LevelDef;
  private cb: GameCallbacks;
  private dpr = 1;
  private paper: HTMLCanvasElement;

  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;

  mode: 'play' | 'won' = 'play';
  paused = false;

  private tick = 0;
  private attemptT = 0;
  private levelTime = 0;
  private attempts = 1;

  private player: Player;
  private rec: { xs: number[]; ys: number[]; st: number[] } = { xs: [], ys: [], st: [] };
  private echoes: Echo[] = [];

  private dropsGot: boolean[];
  private plateT: number[];
  private platePressed: boolean[];
  private prevGroupOpen: Record<string, boolean> = {};
  private doorAnim: number[];
  private springAnim: number[];

  private particles = new Particles();
  private shake = 0;
  private stampT = 0;
  private hitstop = 0;
  private winT = 0;
  private winSent = false;

  input = new Input();

  constructor(canvas: HTMLCanvasElement, level: LevelDef, cb: GameCallbacks) {
    this.canvas = canvas;
    this.level = level;
    this.cb = cb;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * this.dpr;
    canvas.height = H * this.dpr;
    this.paper = makePaper();

    this.player = this.spawnPlayer();
    this.dropsGot = level.drops.map(() => false);
    this.plateT = level.plates.map(() => 0);
    this.platePressed = level.plates.map(() => false);
    this.doorAnim = level.doors.map(() => 0);
    this.springAnim = level.springs.map(() => 0);
  }

  // ---------- 生命周期 ----------
  start() {
    if (this.running) return;
    this.running = true;
    // 站酷快乐体加载完成后重绘预渲染纸张（水印等文字随字体更新）
    try { document.fonts.ready.then(() => { this.paper = makePaper(); }); } catch { /* 旧浏览器忽略 */ }
    // 调试钩子（便于自动化测试检查内部状态）
    (window as unknown as { __dl?: Game }).__dl = this;
    this.input.onReset = () => this.die();
    this.input.onClear = () => this.fullRestart();
    this.input.onPause = () => this.togglePause();
    this.input.onMute = () => {
      sfx.muted = !sfx.muted;
      try { localStorage.setItem('dl.muted', sfx.muted ? '1' : '0'); } catch { /* noop */ }
    };
    this.input.onAny = () => this.cb.onAnyKey();
    this.input.attach();
    this.last = performance.now();
    const loop = (ts: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (ts - this.last) / 1000);
      this.last = ts;
      if (!this.paused) {
        this.acc += dt;
        while (this.acc >= STEP) {
          this.update(STEP);
          this.acc -= STEP;
        }
      }
      this.render();
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.detach();
  }

  togglePause() {
    if (this.mode === 'won') return;
    this.paused = !this.paused;
    this.input.discardJump();
    this.cb.onPauseChange(this.paused);
  }

  snapshot(): Snapshot {
    return {
      mode: this.mode,
      paused: this.paused,
      attempts: this.attempts,
      drafts: this.echoes.length,
      drops: this.dropsGot.filter(Boolean).length,
      dropsTotal: this.dropsGot.length,
      t: this.attemptT,
      muted: sfx.muted,
    };
  }

  // ---------- 玩家与轮回 ----------
  private spawnPlayer(): Player {
    const s = this.level.start;
    return { x: s.x, y: s.y, vx: 0, vy: 0, onGround: false, coyote: 0, jbuf: 0, facing: 1, animT: 0, squash: 0 };
  }

  private respawn() {
    this.player = this.spawnPlayer();
    this.tick = 0;
    this.attemptT = 0;
    this.rec = { xs: [], ys: [], st: [] };
    this.stampT = 1.1;
    this.hitstop = 0.12;
    this.particles.clear();
  }

  /** C 键：重画本关（清空全部草稿） */
  fullRestart() {
    if (this.mode !== 'play') return;
    this.echoes = [];
    this.dropsGot = this.dropsGot.map(() => false);
    this.attempts = 1;
    this.levelTime = 0;
    this.respawn();
  }

  /** 死亡 / 牺牲：本轮操作存为旧稿 */
  private die() {
    if (this.mode !== 'play' || this.paused) return;
    const p = this.player;
    sfx.death();
    this.particles.burst(p.x + PLAYER_W / 2, p.y + PLAYER_H, INK, 16, 300);
    this.shake = 0.22;
    this.hitstop = 0.1;

    if (this.rec.xs.length >= 15 && this.echoes.length < 40) {
      const n = this.rec.xs.length;
      this.echoes.push({
        xs: this.rec.xs, ys: this.rec.ys, st: this.rec.st,
        len: n,
        ci: this.echoes.length % GHOST_COLORS.length,
        remX: p.x + PLAYER_W / 2,
        remY: p.y + PLAYER_H,
      });
    }
    this.attempts++;
    this.respawn();
    sfx.echo();
  }

  // ---------- 机关状态 ----------
  private sawPos(sw: { x1: number; y1: number; x2: number; y2: number; r: number; speed: number; phase?: number }) {
    const len = Math.hypot(sw.x2 - sw.x1, sw.y2 - sw.y1);
    const dur = Math.max(0.001, len / sw.speed);
    const ph = sw.phase ?? 0;
    const t = (this.attemptT + ph * dur) % (2 * dur);
    const k = t < dur ? t / dur : 2 - t / dur;
    return { x: sw.x1 + (sw.x2 - sw.x1) * k, y: sw.y1 + (sw.y2 - sw.y1) * k };
  }

  private laserOn(lz: { on: number; off: number; phase?: number }) {
    const cyc = lz.on + lz.off;
    return ((this.attemptT * 1000 + (lz.phase ?? 0)) % cyc) < lz.on;
  }

  private laserWarn(lz: { on: number; off: number; phase?: number }) {
    const cyc = lz.on + lz.off;
    return !this.laserOn(lz) && cyc - ((this.attemptT * 1000 + (lz.phase ?? 0)) % cyc) < 380;
  }

  private laserRect(lz: { x: number; y: number; len: number; orient: 'v' | 'h' }): Rect {
    return lz.orient === 'v'
      ? { x: lz.x - 4, y: lz.y, w: 8, h: lz.len }
      : { x: lz.x, y: lz.y - 4, w: lz.len, h: 8 };
  }

  // ---------- 主更新 ----------
  private update(dt: number) {
    this.levelTime += dt;
    if (this.mode === 'won') {
      this.winT += dt;
      this.particles.update(dt);
      if (this.winT > 0.7 && !this.winSent) {
        this.winSent = true;
        this.cb.onWin(this.winStats());
      }
      return;
    }
    if (this.hitstop > 0) { this.hitstop -= dt; return; }

    this.attemptT += dt;
    this.tick++;
    const L = this.level;
    const p = this.player;
    p.animT += dt;

    // 输入 → 速度（键盘与触屏虚拟按键合并）
    const left = this.input.axisLeft, right = this.input.axisRight;
    if (left && !right) { p.vx = -MOVE_SPEED; p.facing = -1; }
    else if (right && !left) { p.vx = MOVE_SPEED; p.facing = 1; }
    else p.vx = 0;

    // 土狼时间 & 跳跃缓冲
    p.coyote = p.onGround ? COYOTE_T : Math.max(0, p.coyote - dt);
    if (this.input.consumeJump()) p.jbuf = JUMP_BUFFER;
    else p.jbuf = Math.max(0, p.jbuf - dt);
    if (p.jbuf > 0 && p.coyote > 0) {
      p.vy = JUMP_V;
      p.jbuf = 0; p.coyote = 0; p.onGround = false;
      p.squash = -0.3;
      sfx.jump();
      this.particles.dust(p.x + PLAYER_W / 2, p.y + PLAYER_H, 5);
    }
    if (!this.input.jumpHeld && p.vy < -280) p.vy = -280; // 可变跳跃高度
    p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);

    // 固体 = 静态平台 + 关闭的门
    const solids: Rect[] = L.solids.slice();
    for (const d of L.doors) {
      if (!(this.prevGroupOpen[d.group] ?? false)) solids.push(d);
    }

    const pr: Rect = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };

    // X 轴移动与碰撞
    p.x += p.vx * dt;
    p.x = Math.max(4, Math.min(W - 4 - PLAYER_W, p.x));
    for (const s of solids) {
      if (overlap({ x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H }, s)) {
        if (p.vx > 0) p.x = s.x - PLAYER_W;
        else if (p.vx < 0) p.x = s.x + s.w;
      }
    }

    // Y 轴移动与碰撞
    p.y += p.vy * dt;
    p.onGround = false;
    for (const s of solids) {
      if (overlap({ x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H }, s)) {
        if (p.vy > 0) {
          p.y = s.y - PLAYER_H;
          if (p.vy > 430) {
            p.squash = 0.45;
            this.particles.dust(p.x + PLAYER_W / 2, p.y + PLAYER_H, 6);
          }
          p.vy = 0;
          p.onGround = true;
        } else if (p.vy < 0) {
          p.y = s.y + s.h;
          p.vy = 20;
        }
      }
    }
    p.squash -= p.squash * Math.min(1, 11 * dt);

    const pRect = (): Rect => ({ x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H });

    // 被关闭的门夹住
    for (const d of L.doors) {
      if (!(this.prevGroupOpen[d.group] ?? false) && overlap(pRect(), d)) { this.die(); return; }
    }

    // 弹簧
    L.springs.forEach((sp, i) => {
      const r: Rect = { x: sp.x, y: sp.y, w: sp.w, h: 14 };
      if (overlap(pRect(), r) && p.vy >= -10) {
        p.vy = SPRING_V;
        p.onGround = false;
        p.squash = -0.5;
        this.springAnim[i] = 0.35;
        sfx.spring();
        this.particles.dust(sp.x + sp.w / 2, sp.y + 8, 8);
      }
    });

    // 危险物
    const pcx = p.x + PLAYER_W / 2;
    const pcy = p.y + PLAYER_H / 2;
    for (const s of L.spikes) {
      if (overlap(pRect(), shrink(s, 5))) { this.die(); return; }
    }
    for (const sw of L.saws) {
      const pos = this.sawPos(sw);
      const dx = pcx - pos.x, dy = pcy - pos.y;
      if (dx * dx + dy * dy < (sw.r + 11) * (sw.r + 11)) { this.die(); return; }
    }
    for (const lz of L.lasers) {
      if (this.laserOn(lz) && overlap(pRect(), this.laserRect(lz))) { this.die(); return; }
    }
    if (p.y > H + 60) { this.die(); return; }

    // 墨滴收集
    L.drops.forEach((d, i) => {
      if (this.dropsGot[i]) return;
      const dx = pcx - d.x, dy = pcy - d.y;
      if (dx * dx + dy * dy < 28 * 28) {
        this.dropsGot[i] = true;
        sfx.drop();
        this.particles.burst(d.x, d.y, '#33507e', 8, 170);
      }
    });

    // 到达出口
    if (overlap(pRect(), shrink(L.portal, 8))) {
      this.mode = 'won';
      this.winT = 0;
      sfx.win();
      this.particles.burst(L.portal.x + L.portal.w / 2, L.portal.y + L.portal.h / 2, INK, 22, 250);
      return;
    }

    // ---- 机关踏板：活人 / 回声身体 / 遗骸 都能踩 ----
    const bodies: Rect[] = [pRect()];
    for (const e of this.echoes) {
      if (this.tick < e.len) {
        bodies.push({ x: e.xs[this.tick], y: e.ys[this.tick], w: PLAYER_W, h: PLAYER_H });
      }
      bodies.push({ x: e.remX - 15, y: e.remY - 16, w: 30, h: 16 });
    }
    L.plates.forEach((pl, i) => {
      const r: Rect = { x: pl.x, y: pl.y - 8, w: pl.w, h: 18 };
      const was = this.platePressed[i];
      let hit = false;
      for (const b of bodies) {
        if (overlap(b, r)) { hit = true; break; }
      }
      this.plateT[i] = hit ? this.plateT[i] + dt : 0;
      this.platePressed[i] = this.plateT[i] >= 0.05;
      if (this.platePressed[i] && !was) sfx.plate();
    });

    // 门组状态
    const groupOk: Record<string, boolean> = {};
    for (const pl of L.plates) {
      if (!(pl.group in groupOk)) groupOk[pl.group] = true;
    }
    for (const pl of L.plates) {
      if (!this.platePressed[L.plates.indexOf(pl)]) groupOk[pl.group] = false;
    }
    for (const key of Object.keys(groupOk)) {
      const prev = this.prevGroupOpen[key] ?? false;
      if (prev !== groupOk[key]) {
        sfx.door(groupOk[key]);
        this.prevGroupOpen[key] = groupOk[key];
      }
    }
    L.doors.forEach((d, i) => {
      const target = (this.prevGroupOpen[d.group] ?? false) ? 1 : 0;
      const cur = this.doorAnim[i];
      this.doorAnim[i] = cur + Math.sign(target - cur) * Math.min(Math.abs(target - cur), dt * 4.5);
    });

    // ---- 录制本帧（回声重放的依据）----
    const st = p.onGround ? (p.vx !== 0 ? ST_RUN : ST_IDLE) : (p.vy < 0 ? ST_JUMP : ST_FALL);
    this.rec.xs.push(p.x);
    this.rec.ys.push(p.y);
    this.rec.st.push((p.facing === -1 ? 1 : 0) | (st << 1));

    // 特效计时
    this.particles.update(dt);
    this.shake = Math.max(0, this.shake - dt);
    this.stampT = Math.max(0, this.stampT - dt);
    for (let i = 0; i < this.springAnim.length; i++) {
      this.springAnim[i] = Math.max(0, this.springAnim[i] - dt);
    }
  }

  private winStats(): WinStats {
    return {
      attempts: this.attempts,
      drafts: this.echoes.length,
      drops: this.dropsGot.filter(Boolean).length,
      dropsTotal: this.dropsGot.length,
      time: this.levelTime,
    };
  }

  // ---------- 渲染 ----------
  private render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.paper, 0, 0, W, H);
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * 12 * this.shake, (Math.random() - 0.5) * 12 * this.shake);
    }

    const L = this.level;
    const t = this.attemptT;

    drawLinks(ctx, L.plates, L.doors, GROUP_COLORS);
    drawSolids(ctx, L.solids);
    L.doors.forEach((d, i) => drawDoor(ctx, d, this.doorAnim[i], GROUP_COLORS[d.group]));
    L.plates.forEach((pl, i) => drawPlate(ctx, pl, this.platePressed[i], GROUP_COLORS[pl.group]));
    L.springs.forEach((sp, i) => drawSpring(ctx, sp, Math.min(1, this.springAnim[i] / 0.35)));
    L.drops.forEach((d, i) => { if (!this.dropsGot[i]) drawDrop(ctx, d.x, d.y, t + i * 1.7); });
    drawPortal(ctx, L.portal, t);
    L.spikes.forEach((s) => drawSpikeStrip(ctx, s));
    L.saws.forEach((sw) => drawSawPath(ctx, sw));
    L.lasers.forEach((lz) => {
      drawLaser(ctx, lz, this.laserOn(lz) ? 'on' : this.laserWarn(lz) ? 'warn' : 'off', t);
    });
    L.saws.forEach((sw) => {
      const pos = this.sawPos(sw);
      drawSaw(ctx, pos.x, pos.y, sw.r, t * sw.speed * 0.05);
    });

    // 遗骸（永久旧稿）
    for (const e of this.echoes) drawRemnant(ctx, e.remX, e.remY, GHOST_COLORS[e.ci], t + e.ci * 2);

    // 移动中的旧稿（回声重放）：姿态由状态推导 vx/vy，与真人一致
    for (const e of this.echoes) {
      if (this.tick >= e.len) continue;
      const stByte = e.st[this.tick];
      const facing = (stByte & 1) === 1 ? -1 : 1;
      const state = (['idle', 'run', 'jump', 'fall'] as const)[stByte >> 1];
      const evx = state === 'run' ? facing * MOVE_SPEED : 0;
      const evy = state === 'jump' ? -620 : state === 'fall' ? 620 : 0;
      drawStickman(ctx, {
        x: e.xs[this.tick] + PLAYER_W / 2,
        y: e.ys[this.tick] + PLAYER_H,
        facing,
        state,
        animT: this.tick / 60 + e.ci * 3,
        squash: 0,
        vx: evx, vy: evy,
      }, { color: GHOST_COLORS[e.ci], alpha: 0.55, lw: 2.6, jitter: 0.9, seed: e.ci + 1 });
    }

    // 当前火柴人（胜利时被吸入漩涡）
    const p = this.player;
    if (this.mode === 'won') {
      const k = Math.min(1, this.winT / 0.55);
      const cx0 = p.x + PLAYER_W / 2, cy0 = p.y + PLAYER_H;
      const cx1 = L.portal.x + L.portal.w / 2, cy1 = L.portal.y + L.portal.h / 2;
      ctx.save();
      ctx.translate(cx0 + (cx1 - cx0) * k, cy0 + (cy1 - cy0) * k);
      ctx.rotate(k * 7);
      ctx.scale(1 - k, 1 - k);
      drawStickman(ctx, {
        x: 0, y: 0, facing: p.facing, state: 'fall', animT: p.animT, squash: 0,
      }, { color: INK, alpha: 1 - k * 0.6, lw: 3.4 });
      ctx.restore();
    } else {
      const state = p.onGround ? (p.vx !== 0 ? 'run' as const : 'idle' as const)
        : (p.vy < 0 ? 'jump' as const : 'fall' as const);
      drawStickman(ctx, {
        x: p.x + PLAYER_W / 2, y: p.y + PLAYER_H,
        facing: p.facing, state, animT: p.animT, squash: p.squash,
        vx: p.vx, vy: p.vy,
      }, { color: INK, alpha: 1, lw: 3.4 });
    }

    this.particles.draw(ctx);
    if (this.stampT > 0) drawStamp(ctx, `第 ${this.attempts} 稿`, this.stampT);
    ctx.restore();
  }
}
