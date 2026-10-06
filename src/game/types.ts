// ===== 类型定义 =====
export interface Rect { x: number; y: number; w: number; h: number }
export interface Vec { x: number; y: number }

export interface SawDef {
  x1: number; y1: number; x2: number; y2: number;
  r: number; speed: number; phase?: number;
}

export interface LaserDef {
  x: number; y: number; len: number;
  orient: 'v' | 'h';
  on: number;  // 开启时长 ms
  off: number; // 关闭时长 ms
  phase?: number;
}

export interface PlateDef { x: number; y: number; w: number; group: string }
export interface DoorDef { x: number; y: number; w: number; h: number; group: string }
export interface SpringDef { x: number; y: number; w: number }

export interface LevelDef {
  id: number;
  name: string;
  hint: string;
  start: Vec;
  portal: Rect;
  solids: Rect[];
  spikes: Rect[];
  saws: SawDef[];
  lasers: LaserDef[];
  plates: PlateDef[];
  doors: DoorDef[];
  springs: SpringDef[];
  drops: Vec[];
}

export interface BestRecord {
  attempts: number;
  drops: number;
  time: number;
}
