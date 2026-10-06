// ===== 全局常量 =====
export const W = 1280; // 设计分辨率宽
export const H = 720;  // 设计分辨率高
export const STEP = 1 / 60; // 固定物理步长

// 物理参数
export const GRAVITY = 2300;
export const MOVE_SPEED = 272;
export const JUMP_V = -780;      // 跳跃高度约 132px
export const SPRING_V = -1280;   // 弹簧高度约 356px
export const MAX_FALL = 1350;
export const COYOTE_T = 0.09;    // 土狼时间
export const JUMP_BUFFER = 0.12; // 跳跃预输入缓冲

export const PLAYER_W = 22;
export const PLAYER_H = 46;
export const MAX_ECHOES = 40;    // 回声上限（防止内存爆炸）

// 配色（方格纸手绘风）
export const INK = '#2f2f38';
export const RED = '#c23b34';
export const GROUP_COLORS: Record<string, string> = {
  A: '#3f6fd4',
  B: '#e0862f',
  C: '#3f9c5d',
};
// 旧稿（回声）的彩铅颜色，按顺序循环
export const GHOST_COLORS = [
  '#4a72d0', '#cf6f5a', '#4f9e63', '#9a68cc', '#3f9ea8',
  '#c96a9a', '#b08a3e', '#6a86c9', '#cc8a4a', '#7a9a4a',
];
