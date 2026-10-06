// ===== 极简 WebAudio 音效合成器 =====
export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol = 0.1, delay = 0) {
    const c = this.ensure();
    if (!c) return;
    try {
      const t = c.currentTime + delay;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(1, f0), t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.03);
    } catch {
      /* 忽略音频错误 */
    }
  }

  jump() { this.tone(300, 560, 0.12, 'square', 0.05); }
  spring() { this.tone(240, 760, 0.22, 'square', 0.07); }
  death() {
    this.tone(320, 55, 0.3, 'sawtooth', 0.09);
    this.tone(190, 48, 0.36, 'triangle', 0.07, 0.04);
  }
  plate() { this.tone(760, 700, 0.05, 'square', 0.045); }
  door(open: boolean) { this.tone(open ? 240 : 400, open ? 430 : 210, 0.18, 'triangle', 0.06); }
  drop() { this.tone(900, 1380, 0.09, 'sine', 0.07); }
  echo() { this.tone(520, 250, 0.16, 'sine', 0.045); }
  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.16, 'triangle', 0.07, i * 0.1));
  }
}

/** 全局单例 */
export const sfx = new Sfx();
