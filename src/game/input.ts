// ===== 键盘输入管理 =====
export class Input {
  left = false;
  right = false;
  jumpHeld = false;
  private jq = false;

  onReset?: () => void;   // R 牺牲本轮
  onClear?: () => void;   // C 重画本关
  onPause?: () => void;   // Esc 暂停
  onMute?: () => void;    // M 静音
  onAny?: () => void;     // 任意键（用于关闭提示）

  private down = (e: KeyboardEvent) => {
    const c = e.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW'].includes(c)) {
      e.preventDefault();
    }
    if (c === 'ArrowLeft' || c === 'KeyA') this.left = true;
    else if (c === 'ArrowRight' || c === 'KeyD') this.right = true;
    else if (c === 'ArrowUp' || c === 'KeyW' || c === 'Space') {
      if (!e.repeat) this.jq = true;
      this.jumpHeld = true;
    } else if (c === 'KeyR') this.onReset?.();
    else if (c === 'KeyC') this.onClear?.();
    else if (c === 'Escape') this.onPause?.();
    else if (c === 'KeyM') this.onMute?.();
    if (!e.repeat) this.onAny?.();
  };

  private up = (e: KeyboardEvent) => {
    const c = e.code;
    if (c === 'ArrowLeft' || c === 'KeyA') this.left = false;
    else if (c === 'ArrowRight' || c === 'KeyD') this.right = false;
    else if (c === 'ArrowUp' || c === 'KeyW' || c === 'Space') this.jumpHeld = false;
  };

  /** 取走一次性跳跃请求（边沿触发） */
  consumeJump(): boolean {
    const j = this.jq;
    this.jq = false;
    return j;
  }

  /** 丢弃未处理的跳跃请求 */
  discardJump() {
    this.jq = false;
  }

  attach() {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
  }

  detach() {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
  }
}
