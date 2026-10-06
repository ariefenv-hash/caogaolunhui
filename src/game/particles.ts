// ===== 粒子特效：墨水飞溅、灰尘 =====
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; max: number;
  r: number; c: string; g: number;
}

export class Particles {
  private list: Particle[] = [];

  burst(x: number, y: number, c: string, n = 14, spd = 280) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = spd * (0.3 + Math.random() * 0.7);
      const life = 0.45 + Math.random() * 0.3;
      this.list.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 130,
        life, max: life,
        r: 2 + Math.random() * 3.4,
        c, g: 950,
      });
    }
  }

  dust(x: number, y: number, n = 6) {
    for (let i = 0; i < n; i++) {
      const life = 0.3 + Math.random() * 0.18;
      this.list.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y - 2,
        vx: (Math.random() - 0.5) * 100,
        vy: -Math.random() * 80,
        life, max: life,
        r: 1.6 + Math.random() * 2.6,
        c: 'rgba(125,125,138,0.55)',
        g: 160,
      });
    }
  }

  update(dt: number) {
    const keep: Particle[] = [];
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      keep.push(p);
    }
    this.list = keep;
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const a = p.life / p.max;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.list = [];
  }
}
